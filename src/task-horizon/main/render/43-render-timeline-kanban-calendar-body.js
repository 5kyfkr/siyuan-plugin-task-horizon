    function __tmBuildRenderSceneTimelineBodyHtml(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const bodyAnimClass = String(opts.bodyAnimClass || '');
        const rowModel = Array.isArray(opts.rowModel) ? opts.rowModel : null;

        const __tmRenderTimelineBodyHtml = (rowModel) => {
            const widths = SettingsStore.data.columnWidths || {};
            const isGloballyLocked = GlobalLock.isLocked();
            const leftWidth0 = Number(SettingsStore.data.timelineLeftWidth);
            const timelineContentWidth0 = Number(SettingsStore.data.timelineContentWidth);
            const timelineContentWidth = Number.isFinite(timelineContentWidth0) ? Math.max(10, Math.min(800, Math.round(timelineContentWidth0))) : (Number(widths.content) || 360);
            const timelineStartW = __tmGetFixedDateColumnWidth('startDate');
            const timelineEndW = __tmGetFixedDateColumnWidth('completionTime');
            const leftTableWidth = Math.round(timelineContentWidth + timelineStartW + timelineEndW + 2);
            const computedAuto = leftTableWidth;
            const leftWidth = (Number.isFinite(leftWidth0) && leftWidth0 > 0)
                ? Math.max(360, Math.min(900, Math.round(leftWidth0)))
                : Math.max(360, Math.min(900, computedAuto));
            const sidebarCollapsed = !!SettingsStore.data.timelineSidebarCollapsed;
            const splitClass = sidebarCollapsed ? ' tm-timeline-split--sidebar-collapsed' : '';
            const isDark = __tmIsDarkMode();
            const progressBarColor = isDark
                ? __tmNormalizeHexColor(SettingsStore.data.progressBarColorDark, '#81c784')
                : __tmNormalizeHexColor(SettingsStore.data.progressBarColorLight, '#4caf50');
            const completedTodayKey = __tmNormalizeDateOnly(new Date());
            const enableGroupBg = !!SettingsStore.data.enableGroupTaskBgByGroupColor;
            let currentGroupBg = '';
            const resolvePinnedTaskGroupBg = (task) => {
                if (!enableGroupBg || !task) return '';
                if (state.groupByDocName || state.groupByTaskName || (!state.groupByDocName && !state.groupByTime && !state.quadrantEnabled)) {
                    const taskDocColor = __tmGetDocColorHex(task.root_id, isDark) || '';
                    return taskDocColor ? (__tmGroupBgFromLabelColor(taskDocColor, isDark) || '') : '';
                }
                if (state.groupByTime) {
                    const diffDays = Number(__tmGetTaskTimePriorityInfo(task)?.diffDays);
                    const groupInfo = !Number.isFinite(diffDays)
                        ? { key: 'pending', sortValue: Number.POSITIVE_INFINITY }
                        : (diffDays < 0
                            ? { key: 'overdue', sortValue: diffDays }
                            : (diffDays >= 16
                                ? { key: 'farther', sortValue: 16 }
                                : { key: `days_${diffDays}`, sortValue: diffDays }));
                    const timeBaseColor = isDark
                        ? __tmNormalizeHexColor(SettingsStore.data.timeGroupBaseColorDark, '#6ba5ff')
                        : __tmNormalizeHexColor(SettingsStore.data.timeGroupBaseColorLight, '#1a73e8');
                    const timeOverdueColor = isDark
                        ? __tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorDark, '#ff6b6b')
                        : __tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorLight, '#d93025');
                    const key = String(groupInfo?.key || '');
                    const sortValue = Number(groupInfo?.sortValue);
                    const labelColor = (key === 'pending' || !Number.isFinite(sortValue))
                        ? 'var(--tm-secondary-text)'
                        : (sortValue < 0
                            ? (timeOverdueColor || 'var(--tm-danger-color)')
                            : __tmWithAlpha(timeBaseColor || 'var(--tm-primary-color)', __tmClamp(1 - sortValue * (isDark ? 0.085 : 0.11), isDark ? 0.52 : 0.42, 1)));
                    return __tmGroupBgFromLabelColor(labelColor, isDark) || '';
                }
                if (state.quadrantEnabled) {
                    const quadrantRules = (SettingsStore.data.quadrantConfig && SettingsStore.data.quadrantConfig.rules) || [];
                    const priority = String(task.priority || '').toLowerCase();
                    const importance = (priority === 'a' || priority === '高' || priority === 'high')
                        ? 'high'
                        : ((priority === 'b' || priority === '中' || priority === 'medium')
                            ? 'medium'
                            : ((priority === 'c' || priority === '低' || priority === 'low') ? 'low' : 'none'));
                    const diffDays = Number(__tmGetTaskTimePriorityInfo(task)?.diffDays);
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

            const renderGroupRow = (row) => {
                const isCollapsed = !!row?.collapsed;
                const toggle = `<span class="tm-group-toggle${isCollapsed ? ' tm-group-toggle--collapsed' : ''}" onclick="tmToggleGroupCollapse('${row.key}', event)" style="cursor:pointer;margin-right:0;display:inline-flex;align-items:center;justify-content:center;width:16px;">${__tmRenderToggleIcon(16, isCollapsed ? 0 : 90, 'tm-group-toggle-icon')}</span>`;
                if (row.kind === 'pinned') {
                    return `<tr class="tm-group-row tm-timeline-row" data-group-key="${esc(row.key)}"><td colspan="3" onclick="tmToggleGroupCollapse('${row.key}', event)" style="cursor:pointer;font-weight:bold;color:var(--tm-text-color);"><div class="tm-group-sticky">${toggle}<span class="tm-checklist-group-pin-icon">${__tmRenderBadgeIcon('pin', 14)}</span><span class="tm-group-label" style="color:var(--tm-warning-color);">${esc(row.label || '')}</span><span class="tm-badge tm-badge--count">${Number(row.count) || 0}</span></div></td></tr>`;
                }
                if (row.kind === 'doc') {
                    const labelColor = String(row.labelColor || 'var(--tm-group-doc-label-color)');
                    return `<tr class="tm-group-row tm-timeline-row" data-group-key="${esc(row.key)}"><td colspan="3" onclick="tmToggleGroupCollapse('${row.key}', event)" style="cursor:pointer;font-weight:bold;color:var(--tm-text-color);"><div class="tm-group-sticky">${toggle}<span class="tm-group-label" style="color:${labelColor};">${__tmRenderDocGroupLabel(row.docId || row.id, row.label || '')}</span><span class="tm-badge tm-badge--count">${Number(row.count) || 0}</span></div></td></tr>`;
                }
                // 按任务名分组：分组行使用 PHOSPHOR 风格图标
                if (row.kind === 'task') {
                    const labelColor = String(row.labelColor || 'var(--tm-primary-color)');
                    // 任务名分组：分组行不显示背景色，和文档分组保持一致
                    return `<tr class="tm-group-row tm-timeline-row" data-group-key="${esc(row.key)}"><td colspan="3" onclick="tmToggleGroupCollapse('${row.key}', event)" style="cursor:pointer;font-weight:bold;color:var(--tm-text-color);"><div class="tm-group-sticky">${toggle}<span class="tm-group-label" style="color:${labelColor};">${__tmRenderIconLabel('puzzle', row.label || '')}</span><span class="tm-badge tm-badge--count">${Number(row.count) || 0}</span></div></td></tr>`;
                }
                if (row.kind === 'time') {
                    const labelColor = String(row.labelColor || 'var(--tm-text-color)');
                    const durationSum = String(row.durationSum || '').trim();
                    const timeLabelHtml = String(row.labelHtml || '').trim() || esc(row.label || '');
                    return `<tr class="tm-group-row tm-timeline-row" data-group-key="${esc(row.key)}"><td colspan="3" onclick="tmToggleGroupCollapse('${row.key}', event)" style="cursor:pointer;font-weight:bold;color:var(--tm-text-color);"><div class="tm-group-sticky">${toggle}<span class="tm-group-label" style="color:${labelColor};">${timeLabelHtml}</span><span class="tm-badge tm-badge--count">${Number(row.count) || 0}</span>${durationSum ? `<span class="tm-badge tm-badge--duration"><span class="tm-badge__icon">${__tmRenderBadgeIcon('chart-column')}</span>${esc(durationSum)}</span>` : ''}</div></td></tr>`;
                }
                if (row.kind === 'h2') {
                    const createBtnHtml = __tmBuildHeadingGroupCreateBtnHtml(row.docId, row.headingId, '在该标题下新建任务');
                    const labelColor = String(row.labelColor || __tmGetHeadingSubgroupLabelColor('var(--tm-group-doc-label-color)', isDark));
                    return `<tr class="tm-group-row tm-timeline-row" data-group-kind="h2" data-group-key="${esc(row.key)}"><td colspan="3" onclick="tmToggleGroupCollapse('${row.key}', event)" style="cursor:pointer;font-weight:bold;color:var(--tm-text-color);"><div class="tm-group-sticky" style="padding-left:2ch;">${toggle}<span class="tm-group-label" style="color:${labelColor};">${__tmRenderHeadingLevelIconLabel(row.label || '', row.headingLevel || SettingsStore.data.taskHeadingLevel || 'h2')}</span><span class="tm-badge tm-badge--count">${Number(row.count) || 0}</span>${createBtnHtml}</div></td></tr>`;
                }
                if (row.kind === 'quadrant') {
                    const durationSum = String(row.durationSum || '').trim();
                    const colorMap = { red: 'var(--tm-quadrant-red)', yellow: 'var(--tm-quadrant-yellow)', blue: 'var(--tm-quadrant-blue)', green: 'var(--tm-quadrant-green)' };
                    const color = colorMap[String(row.color || '')] || 'var(--tm-text-color)';
                    return `<tr class="tm-group-row tm-timeline-row" data-group-key="${esc(row.key)}"><td colspan="3" onclick="tmToggleGroupCollapse('${row.key}', event)" style="cursor:pointer;font-weight:bold;color:${color};"><div class="tm-group-sticky">${toggle}${esc(row.label || '')}<span class="tm-badge tm-badge--count">${Number(row.count) || 0}</span>${durationSum ? `<span class="tm-badge tm-badge--duration"><span class="tm-badge__icon">${__tmRenderBadgeIcon('chart-column')}</span>${esc(durationSum)}</span>` : ''}</div></td></tr>`;
                }
                return `<tr class="tm-group-row tm-timeline-row" data-group-key="${esc(row.key)}"><td colspan="3" onclick="tmToggleGroupCollapse('${row.key}', event)" style="cursor:pointer;font-weight:bold;color:var(--tm-text-color);"><div class="tm-group-sticky">${toggle}${esc(row.label || '')}</div></td></tr>`;
            };

            const renderTaskRow = (row) => {
                const rowId = String(row?.id || '').trim();
                const task = globalThis.__tmRuntimeState?.getTaskById?.(rowId, { includePending: true, preferPending: true })
                    || state.flatTasks?.[rowId]
                    || state.pendingInsertedTasks?.[rowId]
                    || null;
                if (!task) return '';
                const isMultiSelected = __tmIsTaskMultiSelected(task.id);
                const depth = Math.max(0, Number(row.depth) || 0);
                const contentIndent = 12 + depth * 16;
                const treeGuides = depth > 0
                    ? `<span class="tm-tree-guides" aria-hidden="true">${Array.from({ length: depth }, (_, i) => `<span class="tm-tree-guide-line" style="left:${18 + i * 16}px"></span>`).join('')}</span>`
                    : '';
                const leadingClass = [
                    'tm-task-leading',
                    row.hasChildren && depth === 0 ? 'tm-task-leading--toplevel' : '',
                    row.hasChildren ? 'tm-task-leading--branch' : '',
                    row.hasChildren && row.collapsed ? 'tm-task-leading--collapsed' : '',
                ].filter(Boolean).join(' ');
                const leadingRing = row.hasChildren && row.collapsed
                    ? '<span class="tm-task-leading-ring" aria-hidden="true"></span>'
                    : '';
                const toggle = row.hasChildren
                    ? `<span class="tm-tree-toggle" onclick="tmToggleCollapse('${task.id}', event)">${__tmRenderToggleIcon(16, row.collapsed ? 0 : 90, 'tm-tree-toggle-icon')}</span>`
                    : '';
                const tomatoFocusTaskId = SettingsStore.data.enableTomatoIntegration ? String(state.timerFocusTaskId || '').trim() : '';
                const tomatoFocusModeEnabled = __tmIsTomatoFocusModeEnabled();
                const rowClass = tomatoFocusTaskId
                    ? (tomatoFocusTaskId === String(task.id)
                        ? 'tm-timer-focus'
                        : (tomatoFocusModeEnabled ? 'tm-timer-dim' : ''))
                    : '';
                const finalRowClass = [rowClass, isMultiSelected ? 'tm-task-row--multi-selected' : ''].filter(Boolean).join(' ');

                const allChildren = task.children || [];
                const totalChildren = allChildren.length;
                const completedChildren = allChildren.filter(c => c.done).length;
                const progressPercent = totalChildren > 0 ? Math.round((completedChildren / totalChildren) * 100) : 0;
                const isDoneSubtask = !!task.done && (Math.max(0, Number(row.depth) || 0) > 0);
                const groupBg = enableGroupBg ? (currentGroupBg || resolvePinnedTaskGroupBg(task)) : '';
                const doneSubtaskBg = (!enableGroupBg && isDoneSubtask) ? __tmWithAlpha(progressBarColor, isDark ? 0.22 : 0.14) : '';
                const baseBg = groupBg || doneSubtaskBg;
                const progressBgStyle = (row.hasChildren && progressPercent > 0)
                    ? (enableGroupBg && groupBg
                        ? `background-image:linear-gradient(90deg, ${progressBarColor} ${progressPercent}%, transparent ${progressPercent}%);background-repeat:no-repeat;background-size:100% 3px;background-position:left bottom;`
                        : `background-image:linear-gradient(90deg, ${progressBarColor} ${progressPercent}%, transparent ${progressPercent}%);background-repeat:no-repeat;`)
                    : '';
                const contentCellBgStyle = `${baseBg ? `background-color:${baseBg};` : ''}${progressBgStyle ? `${progressBgStyle};` : ''}`;
                const otherCellBgStyle = groupBg ? `background-color:${groupBg};` : '';
                const completedTodayBadgeHtml = row?.inCompletedRootGroup === true
                    ? __tmRenderCompletedTodayBadge(task, { todayKey: completedTodayKey })
                    : '';

                return `
                    <tr class="tm-timeline-row ${finalRowClass}" data-id="${task.id}" data-depth="${row.depth}" onclick="tmRowClick(event, '${task.id}')" oncontextmenu="tmShowTaskContextMenu(event, '${task.id}')">
                        <td class="tm-task-content-cell" style="width: ${timelineContentWidth}px; min-width: ${timelineContentWidth}px; max-width: ${timelineContentWidth}px; ${contentCellBgStyle}">
                            <div class="tm-task-cell" style="padding-left:${contentIndent}px">
                                ${treeGuides}
                                <span class="${leadingClass}">
                                    ${leadingRing}
                                ${__tmRenderTaskCheckbox(task.id, task, { checked: task.done, extraClass: isGloballyLocked ? 'tm-operating' : '' })}
                                    ${toggle}
                                </span>
                                <span class="tm-task-text ${task.done ? 'tm-task-done' : ''}" data-level="${row.depth}">
                                    <span class="tm-task-content-clickable" onclick="tmJumpToTask('${task.id}', event)"${__tmBuildTooltipAttrs(String(task.content || '').trim() || '(无内容)', { side: 'bottom', ariaLabel: false })} style="${__tmBuildTaskTitleOpacityStyle(task)}">${API.renderTaskContentHtml(task.markdown, task.content || '')}${__tmRenderGlobalCollectDocTaskInlineIcon(task)}${completedTodayBadgeHtml}${__tmRenderRecurringTaskInlineIcon(task)}${__tmRenderRecurringInstanceBadge(task, { className: 'tm-recurring-instance-badge--inline' })}</span>
                                </span>
                            </div>
                        </td>
                    <td class="tm-cell-editable tm-task-meta-cell" data-tm-task-time-field="startDate" style="width:${timelineStartW}px; min-width:${timelineStartW}px; max-width:${timelineStartW}px; ${otherCellBgStyle}" onclick="tmBeginCellEdit('${task.id}','startDate',this,event)">${__tmFormatTaskTime(task.startDate)}</td>
                    <td class="tm-cell-editable tm-task-meta-cell" data-tm-task-time-field="completionTime" style="width:${timelineEndW}px; min-width:${timelineEndW}px; max-width:${timelineEndW}px; ${otherCellBgStyle}" onclick="tmBeginCellEdit('${task.id}','completionTime',this,event)">${__tmFormatTaskTime(task.completionTime)}</td>
                    </tr>
                `;
            };

            const leftRows = [];
            for (const r of (Array.isArray(rowModel) ? rowModel : [])) {
                if (r?.type === 'group') {
                    let labelColor = '';
                    if (r.kind === 'doc') labelColor = String(r.labelColor || 'var(--tm-group-doc-label-color)');
                    else if (r.kind === 'task') labelColor = String(r.labelColor || 'var(--tm-primary-color)');
                    else if (r.kind === 'time') labelColor = String(r.labelColor || 'var(--tm-text-color)');
                    else if (r.kind === 'h2') labelColor = String(r.labelColor || __tmGetHeadingSubgroupLabelColor('var(--tm-group-doc-label-color)', isDark));
                    else if (r.kind === 'quadrant') {
                        const colorMap = { red: 'var(--tm-quadrant-red)', yellow: 'var(--tm-quadrant-yellow)', blue: 'var(--tm-quadrant-blue)', green: 'var(--tm-quadrant-green)' };
                        labelColor = colorMap[String(r.color || '')] || 'var(--tm-text-color)';
                    } else {
                        labelColor = 'var(--tm-text-color)';
                    }
                    // 任务名分组使用文档颜色作为背景
                    if (r.kind === 'task' && r.groupDocColor) {
                        currentGroupBg = enableGroupBg ? __tmGroupBgFromLabelColor(r.groupDocColor, isDark) : '';
                    } else {
                        currentGroupBg = enableGroupBg ? __tmGroupBgFromLabelColor(labelColor, isDark) : '';
                    }
                    leftRows.push(renderGroupRow(r));
                    continue;
                }
                if (r?.type === 'task') {
                    // 按任务名分组/不分组时，每个任务使用自己文档的颜色
                    let taskDocColor = '';
                    if (state.groupByTaskName || (!state.groupByDocName && !state.groupByTime && !state.quadrantEnabled)) {
                        const task = globalThis.__tmRuntimeState?.getTaskById?.(r.id, { includePending: true, preferPending: true })
                            || state.flatTasks?.[r.id]
                            || state.pendingInsertedTasks?.[r.id]
                            || null;
                        if (task?.root_id) {
                            taskDocColor = __tmGetDocColorHex(task.root_id, isDark) || '';
                        }
                        if (taskDocColor && enableGroupBg) {
                            currentGroupBg = __tmGroupBgFromLabelColor(taskDocColor, isDark);
                        } else {
                            currentGroupBg = '';
                        }
                    }
                    leftRows.push(renderTaskRow(r));
                    continue;
                }
            }
            const leftRowsHtml = leftRows.join('');

            return `
                <div class="tm-body tm-body--timeline${bodyAnimClass}">
                    <div class="tm-timeline-split${splitClass}">
                        <div class="tm-timeline-left" style="width:${leftWidth}px">
                            <div class="tm-timeline-left-body" id="tmTimelineLeftBody">
                                <table class="tm-table tm-timeline-table-left" id="tmTimelineLeftTable" style="width:${leftTableWidth}px;min-width:${leftTableWidth}px;max-width:${leftTableWidth}px;">
                                    <colgroup>
                                        <col id="tmTimelineColContent" style="width:${timelineContentWidth}px">
                                        <col id="tmTimelineColStart" style="width:${timelineStartW}px">
                                        <col id="tmTimelineColEnd" style="width:${timelineEndW}px">
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th style="width:${timelineContentWidth}px; min-width:${timelineContentWidth}px; max-width:${timelineContentWidth}px;">任务内容<span class="tm-col-resize" onmousedown="tmStartTimelineContentResize(event)"></span></th>
                                            <th data-col="startDate" style="width:${timelineStartW}px; min-width:${timelineStartW}px; max-width:${timelineStartW}px;">开始日期</th>
                                            <th data-col="completionTime" style="width:${timelineEndW}px; min-width:${timelineEndW}px; max-width:${timelineEndW}px;">截止日期</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${leftRowsHtml || `<tr><td colspan="3" style="text-align:center; padding:40px; color:var(--tm-secondary-text);">暂无任务</td></tr>`}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div class="tm-timeline-splitter" onmousedown="tmStartTimelineSplitResize(event)" title="拖拽调整宽度"></div>
                        <div class="tm-timeline-right">
                            <div class="tm-timeline-right-header"><div id="tmGanttHeader"></div></div>
                            <div class="tm-timeline-right-body" id="tmGanttBody"></div>
                        </div>
                    </div>
                </div>
            `;
        };


        return __tmRenderTimelineBodyHtml(rowModel);
    }

    function __tmBuildRenderSceneKanbanBodyHtml(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const bodyAnimClass = String(opts.bodyAnimClass || '');

        const __tmRenderKanbanBodyHtml = () => {
            const isGloballyLocked = GlobalLock.isLocked();
            const activeDocId = String(state.activeDocId || '').trim();
            const isAllTabsView = !(activeDocId && activeDocId !== 'all');
            const isCompact = !!SettingsStore.data.kanbanCompactMode;
            const baseKanbanW0 = Number(SettingsStore.data.kanbanColumnWidth);
            const baseKanbanW = Number.isFinite(baseKanbanW0) ? Math.max(220, Math.min(520, Math.round(baseKanbanW0))) : 320;
            const kanbanColW = isCompact ? Math.max(220, baseKanbanW - 40) : baseKanbanW;
            const kanbanFillColumns = !!SettingsStore.data.kanbanFillColumns;
            const kanbanCardFields = new Set(__tmGetTaskCardFieldList('kanban'));
            const kanbanCollapsedColumnKeys = __tmKanbanGetCollapsedColumnSet();
            const useKanbanCustomCardGesture = (typeof __tmIsMobileDevice === 'function' ? __tmIsMobileDevice() : __tmIsRuntimeMobileClient());
            const boardMode = __tmGetKanbanBoardMode();
            const headingMode = boardMode === 'heading';
            const timeBoardMode = boardMode === 'time';
            const showDoneCol = (headingMode || timeBoardMode) && !!state.showCompletedTasks && !!SettingsStore.data.kanbanShowDoneColumn;
            const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
            const statusOptionsRaw = Array.isArray(SettingsStore.data.customStatusOptions) ? SettingsStore.data.customStatusOptions : [];
            const statusOptions = __tmGetStatusOptions(statusOptionsRaw)
                .map(o => ({ id: String(o?.id || '').trim(), name: String(o?.name || '').trim(), color: String(o?.color || '').trim(), marker: o?.marker }))
                .filter(o => o.id);
            const defaultUndoneStatusId = __tmGetDefaultUndoneStatusId(statusOptions);
            const defaultUndoneOpt = statusOptions.find(o => o.id === defaultUndoneStatusId)
                || statusOptions[0]
                || { id: defaultUndoneStatusId || 'todo', name: '待办', color: '#757575' };
            const doneOpt = { id: '__done__', name: '已完成', color: '#9e9e9e', kind: 'status' };

            const docNameById = new Map();
            (Array.isArray(state.taskTree) ? state.taskTree : []).forEach(d => {
                const id = String(d?.id || '').trim();
                if (id) docNameById.set(id, String(d?.name || '').trim());
            });
            (Array.isArray(state.allDocuments) ? state.allDocuments : []).forEach(d => {
                const id = String(d?.id || '').trim();
                if (id && !docNameById.has(id)) docNameById.set(id, String(d?.name || '').trim());
            });

            const filteredRaw = Array.isArray(state.filteredTasks) ? state.filteredTasks : [];
            const filteredRawTaskById = new Map();
            filteredRaw.forEach((task) => {
                const id = String(task?.id || '').trim();
                if (id) filteredRawTaskById.set(id, task);
            });
            const getKanbanParentTaskId = (task) => {
                const id = String(task?.id || '').trim();
                const pid = String(task?.parentTaskId || task?.parentId || task?.parent_id || task?.parent_task_id || '').trim();
                return pid && pid !== id ? pid : '';
            };
            const getRawKanbanTaskById = (taskId) => {
                const tid = String(taskId || '').trim();
                if (!tid) return null;
                return filteredRawTaskById.get(tid)
                    || globalThis.__tmRuntimeState?.getTaskById?.(tid, { includePending: true, preferPending: true })
                    || state.flatTasks?.[tid]
                    || state.pendingInsertedTasks?.[tid]
                    || null;
            };
            const kanbanChildrenByParentId = new Map();
            const kanbanChildrenSeenByParentId = new Map();
            const pushKanbanChildForParent = (parentId, child) => {
                const pid = String(parentId || '').trim();
                const id = String(child?.id || '').trim();
                if (!pid || !id) return;
                let seen = kanbanChildrenSeenByParentId.get(pid);
                if (!seen) {
                    seen = new Set();
                    kanbanChildrenSeenByParentId.set(pid, seen);
                }
                if (seen.has(id)) return;
                seen.add(id);
                if (!kanbanChildrenByParentId.has(pid)) kanbanChildrenByParentId.set(pid, []);
                kanbanChildrenByParentId.get(pid).push(child);
            };
            const indexKanbanTaskChildren = (task) => {
                if (!task || typeof task !== 'object') return;
                const id = String(task?.id || '').trim();
                const pid = getKanbanParentTaskId(task);
                if (pid) pushKanbanChildForParent(pid, task);
                if (!id) return;
                (Array.isArray(task?.children) ? task.children : []).forEach((child) => {
                    pushKanbanChildForParent(id, child);
                });
            };
            Object.values((state.flatTasks && typeof state.flatTasks === 'object') ? state.flatTasks : {}).forEach(indexKanbanTaskChildren);
            filteredRaw.forEach(indexKanbanTaskChildren);
            const kanbanParentChildrenIndexedIds = new Set();
            const getKanbanChildTasksByParentId = (parentId) => {
                const pid = String(parentId || '').trim();
                if (!pid) return [];
                if (!kanbanParentChildrenIndexedIds.has(pid)) {
                    kanbanParentChildrenIndexedIds.add(pid);
                    const parent = getRawKanbanTaskById(pid);
                    (Array.isArray(parent?.children) ? parent.children : []).forEach((child) => {
                        pushKanbanChildForParent(pid, child);
                    });
                }
                return kanbanChildrenByParentId.get(pid) || [];
            };
            const isHiddenKanbanCompletedDescendant = (task) => {
                const tid = String(task?.id || '').trim();
                const parentId0 = getKanbanParentTaskId(task);
                if (!tid || !parentId0) return false;
                const chain = [task];
                const seen = new Set([tid]);
                let parentId = parentId0;
                while (parentId && !seen.has(parentId)) {
                    seen.add(parentId);
                    const parent = getRawKanbanTaskById(parentId);
                    if (!parent) break;
                    chain.push(parent);
                    parentId = getKanbanParentTaskId(parent);
                }
                if (chain.length < 2) return false;
                chain.reverse();
                let inheritedHideCompleted = false;
                for (let i = 0; i < chain.length - 1; i++) {
                    const parent = chain[i];
                    const child = chain[i + 1];
                    const hideCompletedDescendants = __tmResolveHideCompletedDescendantsFlag(parent, inheritedHideCompleted);
                    if (hideCompletedDescendants && !!child?.done) return true;
                    inheritedHideCompleted = hideCompletedDescendants;
                }
                return false;
            };
            const kanbanKeepSubtasksAttached = SettingsStore.data.kanbanPreventSubtaskSeparation === true;
            const filteredBase = filteredRaw.filter((task) => {
                if (!task || typeof task !== 'object') return false;
                if (!state.showCompletedTasks && !!task.done) return false;
                return !isHiddenKanbanCompletedDescendant(task);
            });
            let filtered = filteredBase;
            if (kanbanKeepSubtasksAttached) {
                const filteredById = new Map();
                filteredBase.forEach((task) => {
                    const id = String(task?.id || '').trim();
                    if (id) filteredById.set(id, task);
                });
                let hasInjectedDescendant = false;
                const shouldInjectAttachedTask = (task) => {
                    if (!task || typeof task !== 'object') return false;
                    if (!state.showCompletedTasks && !!task.done) return false;
                    if (isHiddenKanbanCompletedDescendant(task)) return false;
                    const docId = String(task?.root_id || task?.docId || '').trim();
                    if (!isAllTabsView && activeDocId && docId && docId !== activeDocId) return false;
                    return true;
                };
                const injectDescendantTask = (task) => {
                    const id = String(task?.id || '').trim();
                    if (!id || filteredById.has(id)) return false;
                    if (!shouldInjectAttachedTask(task)) return false;
                    filteredById.set(id, task);
                    hasInjectedDescendant = true;
                    return true;
                };
                let descendantFrontier = filteredBase
                    .map((task) => String(task?.id || '').trim())
                    .filter(Boolean);
                const visitedDescendantParentIds = new Set(descendantFrontier);
                for (let depth = 0; depth < 8 && descendantFrontier.length > 0; depth++) {
                    const nextFrontier = [];
                    descendantFrontier.forEach((parentId) => {
                        getKanbanChildTasksByParentId(parentId).forEach((child) => {
                            const childId = String(child?.id || '').trim();
                            if (!childId) return;
                            injectDescendantTask(child);
                            if (!visitedDescendantParentIds.has(childId)) {
                                visitedDescendantParentIds.add(childId);
                                nextFrontier.push(childId);
                            }
                        });
                    });
                    descendantFrontier = nextFrontier;
                }
                if (hasInjectedDescendant) {
                    filtered = Array.from(filteredById.values());
                }
            }
            const filteredIdList = filtered.map(t => String(t?.id || '').trim()).filter(Boolean);
            const filteredIdSet = new Set(filteredIdList);
            const indexById = new Map(filteredIdList.map((id, i) => [id, i]));
            const filteredTaskById = new Map();
            filtered.forEach((task) => {
                const id = String(task?.id || '').trim();
                if (id) filteredTaskById.set(id, task);
            });
            const getKanbanColumnTask = (task) => {
                if (!kanbanKeepSubtasksAttached || !task) return task;
                let current = task;
                const seen = new Set([String(task?.id || '').trim()].filter(Boolean));
                while (current) {
                    const pid = getKanbanParentTaskId(current);
                    if (!pid || seen.has(pid)) break;
                    const parent = filteredTaskById.get(pid);
                    if (!parent) break;
                    current = parent;
                    seen.add(pid);
                }
                return current || task;
            };
            const colsStatus = (() => {
                const out = [];
                const seen = new Set();
                const push = (col) => {
                    const id = String(col?.id || '').trim();
                    if (!id || seen.has(id)) return;
                    seen.add(id);
                    out.push(col);
                };
                statusOptions.forEach((opt) => {
                    push(opt);
                });
                if (!headingMode) {
                    filtered.forEach((task) => {
                        const columnTask = getKanbanColumnTask(task);
                        const statusId = __tmResolveTaskStatusId(columnTask, statusOptions);
                        if (!statusId || seen.has(statusId)) return;
                        const display = __tmResolveTaskStatusDisplayOption(columnTask, statusOptions, {
                            fallbackColor: columnTask?.done ? '#9e9e9e' : '#757575',
                            fallbackName: columnTask?.done ? '完成' : '待办',
                        });
                        push({
                            id: statusId,
                            name: String(display?.name || statusId).trim() || statusId,
                            color: String(display?.color || (columnTask?.done ? '#9e9e9e' : '#757575')).trim() || (columnTask?.done ? '#9e9e9e' : '#757575'),
                            kind: 'status',
                        });
                    });
                }
                if (showDoneCol) push(doneOpt);
                return out;
            })();
            const directChildStatsMemo = new Map();
            const getDirectChildStats = (task) => {
                const id = String(task?.id || '').trim();
                if (id && directChildStatsMemo.has(id)) return directChildStatsMemo.get(id);
                const allChildren = id ? getKanbanChildTasksByParentId(id) : (Array.isArray(task?.children) ? task.children : []);
                const stats = {
                    total: allChildren.length,
                    completed: allChildren.reduce((sum, child) => sum + ((child && child.done) ? 1 : 0), 0),
                };
                stats.remaining = Math.max(0, stats.total - stats.completed);
                if (id) directChildStatsMemo.set(id, stats);
                return stats;
            };
            const ruleForKanban = __tmGetCurrentRule();
            const allowDocFlowForKanban = __tmRuleUsesDocFlowSort(ruleForKanban);
            const isUngroupForKanban = !state.groupByDocName && !state.groupByTaskName && !state.groupByTime && !state.quadrantEnabled;
            const needDocFlowForKanban = allowDocFlowForKanban && (!!state.groupByDocName || isUngroupForKanban || !!state.groupByTaskName || !!state.groupByTime || !!state.quadrantEnabled);
            const escSq = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const kanbanDetailTaskId = String(state.kanbanDetailTaskId || '').trim();
            const kanbanDetailTask = kanbanDetailTaskId
                ? (
                    globalThis.__tmRuntimeState?.getTaskById?.(kanbanDetailTaskId, { includePending: true, preferPending: true })
                    || state.flatTasks?.[kanbanDetailTaskId]
                    || state.pendingInsertedTasks?.[kanbanDetailTaskId]
                    || null
                )
                : null;
            const kanbanDetailHtml = kanbanDetailTask
                ? `
                    <aside class="tm-kanban-detail-float" id="tmKanbanDetailFloat">
                        <div class="tm-kanban-detail-float__body" id="tmKanbanDetailPanel">
                            ${typeof __tmShouldRenderTaskDetailNoteView === 'function' && __tmShouldRenderTaskDetailNoteView('kanban', kanbanDetailTask)
                                ? __tmBuildTaskDetailNoteViewInnerHtml(kanbanDetailTask, { embedded: true, floating: true })
                                : __tmBuildTaskDetailInnerHtml(kanbanDetailTask, { embedded: true, floating: true })}
                        </div>
                    </aside>
                `
                : '';
            const isDark = __tmIsDarkMode();
            const timeBaseColor = isDark
                ? __tmNormalizeHexColor(SettingsStore.data.timeGroupBaseColorDark, '#6ba5ff')
                : __tmNormalizeHexColor(SettingsStore.data.timeGroupBaseColorLight, '#1a73e8');
            const timeOverdueColor = isDark
                ? __tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorDark, '#ff6b6b')
                : __tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorLight, '#d93025');
            const timePriorityMemo = new Map();
            const getTimePriorityInfo = (task) => __tmGetTaskTimePriorityInfo(task, { memo: timePriorityMemo });
            const getTimeGroupLabelColor = (groupInfo) => {
                const key = String(groupInfo?.key || '');
                const sortValue = Number(groupInfo?.sortValue);
                if (key === 'pending' || !Number.isFinite(sortValue)) return 'var(--tm-secondary-text)';
                if (sortValue < 0) return timeOverdueColor || 'var(--tm-danger-color)';
                const minA = isDark ? 0.52 : 0.42;
                const step = isDark ? 0.085 : 0.11;
                const alpha = __tmClamp(1 - sortValue * step, minA, 1);
                return __tmWithAlpha(timeBaseColor || 'var(--tm-primary-color)', alpha);
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
            const buildTimeBoardCreateDate = (groupInfo) => {
                const days = Number(groupInfo?.sortValue);
                if (!Number.isInteger(days) || days < 0 || days > 15) return '';
                const target = new Date();
                target.setHours(12, 0, 0, 0);
                target.setDate(target.getDate() + days);
                return __tmNormalizeDateOnly(target);
            };
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
                return { key: `days_${diffDays}`, label, labelHtml: buildTimeGroupLabelHtml(label, diffDays), sortValue: diffDays };
            };
            const getTimeBoardGroup = (task) => getTimeGroup(getKanbanColumnTask(task));
            const buildTimeBoardCols = () => {
                const groups = new Map();
                filtered.forEach((task) => {
                    if (showDoneCol && !!task?.done) return;
                    const info = getTimeBoardGroup(task);
                    const key = String(info?.key || 'pending').trim() || 'pending';
                    if (!groups.has(key)) {
                        groups.set(key, {
                            id: key,
                            name: String(info?.label || '').trim() || '待定',
                            labelHtml: String(info?.labelHtml || '').trim(),
                            color: getTimeGroupLabelColor(info),
                            kind: 'time',
                            sortValue: Number(info?.sortValue),
                            createDate: buildTimeBoardCreateDate(info),
                        });
                    }
                });
                return Array.from(groups.values()).sort((a, b) => {
                    const av = Number(a?.sortValue);
                    const bv = Number(b?.sortValue);
                    return (Number.isFinite(av) ? av : Infinity) - (Number.isFinite(bv) ? bv : Infinity);
                });
            };
            const getImportanceLevel = (task) => {
                const priority = String(task?.priority || '').toLowerCase();
                if (priority === 'a' || priority === '高' || priority === 'high') return 'high';
                if (priority === 'b' || priority === '中' || priority === 'medium') return 'medium';
                if (priority === 'c' || priority === '低' || priority === 'low') return 'low';
                return 'none';
            };
            const getTimeRange = (task) => {
                const timeStr = String(task?.completionTime || '').trim();
                if (!timeStr) return 'nodate';
                const taskDate = new Date(timeStr);
                if (isNaN(taskDate.getTime())) return 'nodate';
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const target = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
                const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
                if (diffDays < 0) return 'overdue';
                if (diffDays <= 7) return 'within7days';
                if (diffDays <= 15) return 'within15days';
                if (diffDays <= 30) return 'within30days';
                return 'beyond30days';
            };
            const getTaskDays = (task) => {
                const timeStr = String(task?.completionTime || '').trim();
                if (!timeStr) return Infinity;
                const taskDate = new Date(timeStr);
                if (isNaN(taskDate.getTime())) return Infinity;
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const target = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
                return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
            };
            const quadrantRules = (SettingsStore.data.quadrantConfig && Array.isArray(SettingsStore.data.quadrantConfig.rules))
                ? SettingsStore.data.quadrantConfig.rules
                : [];
            const quadrantOrder = ['urgent-important', 'not-urgent-important', 'urgent-not-important', 'not-urgent-not-important'];
            const quadrantColorMap = {
                red: 'var(--tm-quadrant-red)',
                yellow: 'var(--tm-quadrant-yellow)',
                blue: 'var(--tm-quadrant-blue)',
                green: 'var(--tm-quadrant-green)'
            };
            const resolveQuadrantRule = (task) => {
                const importance = getImportanceLevel(task);
                const timeRange = getTimeRange(task);
                const taskDays = getTaskDays(task);
                for (const rule of quadrantRules) {
                    const imp = Array.isArray(rule?.importance) ? rule.importance : [];
                    const trs = Array.isArray(rule?.timeRanges) ? rule.timeRanges : [];
                    if (!imp.includes(importance)) continue;
                    let ok = trs.includes(timeRange);
                    if (!ok) {
                        for (const range of trs) {
                            const s = String(range || '');
                            if (!s.startsWith('beyond') || s === 'beyond30days') continue;
                            const days = parseInt(s.replace('beyond', '').replace('days', ''), 10);
                            if (!isNaN(days) && taskDays > days) {
                                ok = true;
                                break;
                            }
                        }
                    }
                    if (ok) return rule;
                }
                return null;
            };
            const docsInOrder = __tmSortDocEntriesForTabs(state.taskTree || [], currentGroupId).map(d => String(d?.id || '').trim()).filter(Boolean);
            const docRank = new Map(docsInOrder.map((id, idx) => [id, idx]));

            const headingLevel = __tmNormalizeHeadingLevel(SettingsStore.data.taskHeadingLevel || 'h2');
            const headingLabelMap = { h1: '一级标题', h2: '二级标题', h3: '三级标题', h4: '四级标题', h5: '五级标题', h6: '六级标题' };
            const noHeadingLabel = `无${headingLabelMap[headingLevel] || '标题'}`;
            const tomatoFocusTaskId = SettingsStore.data.enableTomatoIntegration ? String(state.timerFocusTaskId || '').trim() : '';
            const tomatoFocusModeEnabled = tomatoFocusTaskId ? __tmIsTomatoFocusModeEnabled() : false;
            const tomatoFocusDescendantMemo = new Map();
            const hasTomatoFocusDescendant = (taskId) => {
                const id = String(taskId || '').trim();
                if (!id || !tomatoFocusTaskId) return false;
                if (tomatoFocusDescendantMemo.has(id)) return tomatoFocusDescendantMemo.get(id);
                const seen = new Set([id]);
                const stack = getKanbanChildTasksByParentId(id).slice();
                while (stack.length) {
                    const child = stack.pop();
                    const childId = String(child?.id || '').trim();
                    if (!childId || seen.has(childId)) continue;
                    if (childId === tomatoFocusTaskId) {
                        tomatoFocusDescendantMemo.set(id, true);
                        return true;
                    }
                    seen.add(childId);
                    getKanbanChildTasksByParentId(childId).forEach((nextChild) => stack.push(nextChild));
                }
                tomatoFocusDescendantMemo.set(id, false);
                return false;
            };
            const pickDocColor = (docId) => {
                const did = String(docId || '').trim();
                if (!did || did === '__unknown__') return '#757575';
                return __tmGetDocColorHex(did, isDark) || '#4f46e5';
            };
            const kanbanColsCacheKey = __tmBuildKanbanColsCacheKey({
                isAllTabsView,
                isCompact,
                kanbanColW,
                kanbanFillColumns,
                useKanbanCustomCardGesture,
                showCompletedTasks: !!state.showCompletedTasks,
                showDoneCol,
                boardMode,
                headingMode,
                currentGroupId,
                activeDocId,
                isDark,
                isGloballyLocked,
                groupByDocName: !!state.groupByDocName,
                groupByTaskName: !!state.groupByTaskName,
                groupByTime: !!state.groupByTime,
                quadrantEnabled: !!state.quadrantEnabled,
                kanbanCardFields: Array.from(kanbanCardFields).join('|'),
                tomatoFocusTaskId,
                tomatoFocusModeEnabled,
            });
            const renderKanbanBoardNavHtml = (items) => {
                const list = Array.isArray(items) ? items : [];
                if (list.length <= 1) return '';
                const buttons = list.map((item, index) => {
                    const label = String(item?.label || '').trim() || `看板 ${index + 1}`;
                    const title = String(item?.title || label).trim() || label;
                    const color = String(item?.color || '').trim();
                    const style = color ? ` style="--tm-kanban-board-nav-color:${esc(color)};"` : '';
                    return `<button type="button" class="tm-kanban-board-nav__item" data-tm-kanban-nav-index="${index}" data-tm-kanban-col-key="${esc(String(item?.key || ''))}" role="tab" aria-selected="false" title="${esc(title)}"${style} onclick="tmKanbanBoardNavJump(event, ${index})">${esc(label)}</button>`;
                }).join('');
                return `
                    <nav class="tm-kanban-board-nav" role="tablist" aria-label="看板导航" onpointerdown="event.stopPropagation()" onclick="event.stopPropagation()">
                        <div class="tm-kanban-board-nav__inner">
                            <span class="tm-kanban-board-nav__indicator" aria-hidden="true"></span>
                            ${buttons}
                        </div>
                    </nav>
                `;
            };
            if (__tmKanbanColsHtmlCache && __tmKanbanColsHtmlCache.key === kanbanColsCacheKey) {
                const cachedNavHtml = String(__tmKanbanColsHtmlCache.navHtml || '');
                return `
                    <div class="tm-body tm-body--kanban${bodyAnimClass}${isCompact ? ' tm-body--kanban-compact' : ''}${cachedNavHtml ? ' tm-body--kanban-has-board-nav' : ''}" ondragover="tmKanbanAutoScroll(event)">
                        ${cachedNavHtml}
                        <div class="tm-kanban tm-kanban--clean${isCompact ? ' tm-kanban--compact' : ''}${kanbanFillColumns ? ' tm-kanban--fill' : ''}">
                            ${__tmKanbanColsHtmlCache.html}
                        </div>
                        ${kanbanDetailHtml}
                    </div>
                `;
            }
            const cols = (() => {
                if (timeBoardMode) {
                    const timeCols = buildTimeBoardCols();
                    return showDoneCol ? [...timeCols, doneOpt] : timeCols;
                }
                if (!headingMode) return colsStatus;
                if (isAllTabsView) {
                    const globalNewTaskDocId = String(SettingsStore.data.newTaskDocId || '').trim();
                    const headingTasks = showDoneCol ? filtered.filter(t => !t?.done) : filtered;
                    const docIdSet = new Set(headingTasks.map(t => String(t?.root_id || '').trim()).filter(Boolean));
                    const ordered = __tmMoveGlobalNewTaskDocFirst(
                        docsInOrder.filter((id) => docIdSet.has(id) || (globalNewTaskDocId && id === globalNewTaskDocId))
                    );
                    Array.from(docIdSet).forEach((id) => {
                        if (!ordered.includes(id)) ordered.push(id);
                    });
                    const headingCols = ordered.map((docId) => ({
                        id: docId,
                        name: docNameById.get(docId) || '未知文档',
                        color: pickDocColor(docId),
                        kind: 'doc',
                        docId: docId,
                    }));
                    return showDoneCol ? [...headingCols, doneOpt] : headingCols;
                }
                const docId = activeDocId;

                // 获取当前文档的任务
                const docTasks = filtered.filter(t => {
                    if (String(t?.root_id || '').trim() !== docId) return false;
                    if (showDoneCol && !!t?.done) return false;
                    return true;
                });

                const headingLevel = __tmNormalizeHeadingLevel(SettingsStore.data.taskHeadingLevel || 'h2');
                const headingLabelMap = { h1: '一级标题', h2: '二级标题', h3: '三级标题', h4: '四级标题', h5: '五级标题', h6: '六级标题' };
                const noHeadingLabel = `无${headingLabelMap[headingLevel] || '标题'}`;
                const hasNoHeadingTasks = docTasks.some((task) => {
                    const bucket = __tmGetDocHeadingBucket(task, noHeadingLabel);
                    return String(bucket?.label || '').trim() === noHeadingLabel || String(bucket?.id || '').trim() === '__none__';
                });

                // 获取当前文档的原始标题列表（这个顺序是稳定的）
                const headings = Array.isArray(state.kanbanDocHeadingsByDocId?.[docId]) ? state.kanbanDocHeadingsByDocId[docId] : [];

                // 构建原始标题的顺序映射（用于稳定性，避免跳变）
                const headingOrderMap = new Map();
                headings.forEach((h, idx) => {
                    const hid = String(h?.id || '').trim();
                    if (hid) headingOrderMap.set(`id:${hid}`, idx);
                    const rank = Number(h?.rank);
                    if (Number.isFinite(rank)) headingOrderMap.set(`rank:${Math.trunc(rank)}`, idx);
                });

                // 构建 grouped：按标题分组任务
                const grouped = new Map();
                docTasks.forEach((task) => {
                    const b = __tmGetDocHeadingBucket(task, noHeadingLabel);
                    if (!grouped.has(b.key)) grouped.set(b.key, { label: b.label, id: b.id, items: [] });
                    grouped.get(b.key).items.push(task);
                });

                // 使用动态 buckets 获取正确的标题顺序（与表格视图一致）
                const sortedDocTasks = docTasks.slice();
                const buckets = __tmBuildDocHeadingBuckets(sortedDocTasks, noHeadingLabel);

                // 构建最终的列：有任务的按动态顺序，无任务的按原始标题顺序
                const cols0 = [];
                const usedKeys = new Set();

                // 第一批：有任务的标题（按动态 buckets 顺序）
                buckets.forEach(b => {
                    const group = grouped.get(b.key);
                    if (group?.items?.length > 0) {
                        const bucketKey = String(b?.key || '').trim() || `label:${String(b?.label || '').trim() || noHeadingLabel}`;
                        cols0.push({
                            bucketKey,
                            headingId: String(b?.id || '').trim(),
                            name: String(b?.label || '').trim() || '(空标题)',
                            color: pickDocColor(docId),
                            kind: 'heading',
                            docId,
                            hasItems: true,
                            orderIdx: headingOrderMap.has(bucketKey) ? headingOrderMap.get(bucketKey) : (bucketKey === `label:${noHeadingLabel}` ? -1 : 9999),
                        });
                        usedKeys.add(b.key);
                    }
                });

                // 第二批：有任务但不在动态 buckets 中的（添加额外分组）
                Array.from(grouped.keys()).forEach(key => {
                    if (!usedKeys.has(key) && (grouped.get(key)?.items?.length > 0)) {
                        cols0.push({
                            bucketKey: String(key || '').trim() || `label:${noHeadingLabel}`,
                            headingId: String(grouped.get(key)?.id || '').trim(),
                            name: String(grouped.get(key)?.label || '').trim() || '(空标题)',
                            color: pickDocColor(docId),
                            kind: 'heading',
                            docId,
                            hasItems: true,
                            orderIdx: headingOrderMap.has(key) ? headingOrderMap.get(key) : (key === `label:${noHeadingLabel}` ? -1 : 9999),
                        });
                    }
                });

                // 第三批：没有任务的原始标题（按原始文档顺序，显示但置灰）
                headings.forEach(h => {
                    const hid = String(h?.id || '').trim();
                    if (!hid) return;
                    const key = `id:${hid}`;
                    if (!usedKeys.has(key) && !grouped.has(key)) {
                        cols0.push({
                            bucketKey: key,
                            headingId: hid,
                            name: String(h?.content || '').trim() || '(空标题)',
                            color: pickDocColor(docId),
                            kind: 'heading',
                            docId,
                            hasItems: false,
                            orderIdx: headingOrderMap.get(key) ?? 999,
                        });
                    }
                });

                // 按文档中的标题顺序排序，空标题列也不改变已有标题的相对位置。
                cols0.sort((a, b) => {
                    const aIsNone = String(a?.name || '').trim() === noHeadingLabel;
                    const bIsNone = String(b?.name || '').trim() === noHeadingLabel;
                    if (aIsNone !== bIsNone) return aIsNone ? -1 : 1;
                    const ai = Number(a?.orderIdx);
                    const bi = Number(b?.orderIdx);
                    if (Number.isFinite(ai) && Number.isFinite(bi) && ai !== bi) return ai - bi;
                    if (Number.isFinite(ai) !== Number.isFinite(bi)) return Number.isFinite(ai) ? -1 : 1;
                    return String(a?.bucketKey || '').localeCompare(String(b?.bucketKey || ''));
                });

                // 只有存在未归属标题的任务时才显示"无标题"列
                const noneCol = cols0.find(c => c.name === noHeadingLabel);
                if (hasNoHeadingTasks && !noneCol) {
                    cols0.unshift({
                        bucketKey: `label:${noHeadingLabel}`,
                        headingId: '__none__',
                        name: noHeadingLabel,
                        color: pickDocColor(docId),
                        kind: 'heading',
                        docId,
                        hasItems: false,
                        orderIdx: -1
                    });
                }

                const headingCols = cols0.map(c => ({
                    id: c.bucketKey,
                    headingId: c.headingId,
                    name: c.name,
                    color: c.color,
                    kind: c.kind,
                    docId: c.docId,
                }));
                return showDoneCol ? [...headingCols, doneOpt] : headingCols;
            })();

            const tasksByStatus = new Map(cols.map(c => [String(c?.id || '').trim(), []]));
            filtered.forEach(task => {
                const columnTask = getKanbanColumnTask(task);
                let key = '';
                if (timeBoardMode) {
                    key = (showDoneCol && !!columnTask?.done)
                        ? '__done__'
                        : (String(getTimeBoardGroup(task)?.key || 'pending').trim() || 'pending');
                } else if (!headingMode) {
                    key = (showDoneCol && !!columnTask?.done) ? '__done__' : __tmResolveTaskStatusId(columnTask, statusOptions);
                } else if (showDoneCol && !!columnTask?.done) {
                    key = '__done__';
                } else if (isAllTabsView) {
                    key = String(columnTask?.root_id || '').trim() || '__unknown__';
                } else {
                    const did = String(columnTask?.root_id || '').trim();
                    if (did !== activeDocId) return;
                    key = __tmGetDocHeadingBucket(columnTask, noHeadingLabel).key;
                }
                if (!tasksByStatus.has(key)) tasksByStatus.set(key, []);
                tasksByStatus.get(key).push(task);
            });

            const completedTodayKey = __tmNormalizeDateOnly(new Date());
            const renderCard = (task, depthInCol, isSub, isChildRoot, parentTxt, childrenHtml, toggleHtml, isParent, inCompletedRootGroup = false) => {
                const id = String(task?.id || '').trim();
                if (!id) return '';
                const content = String(task?.content || '').trim();
                const docId = String(task?.root_id || '').trim();
                const docName = docNameById.get(docId) || '';
                const opt = __tmResolveTaskStatusDisplayOption(task, statusOptions, {
                    fallbackColor: task?.done ? '#9e9e9e' : '#757575',
                    fallbackName: task?.done ? '完成' : (defaultUndoneOpt?.name || '待办'),
                });
                const timeTxt = __tmGetTaskCardDateValue(task);
                const dateTxt = timeTxt ? __tmFormatTaskCardDateValue(task) : '';
                const directChildStats = getDirectChildStats(task);
                const totalChildren = directChildStats.total;
                const statusChipStyle = __tmBuildStatusChipStyle(opt.color || '#757575');
                const statusChip = task?.done
                    ? `<span class="tm-status-tag" style="${statusChipStyle};cursor:default;">${esc(opt.name || '完成')}</span>`
                    : `<span class="tm-status-tag" style="${statusChipStyle}" onclick="tmKanbanOpenStatusSelect('${id}', this, event)">${esc(opt.name || '')}</span>`;
                const priorityChipStyle = __tmBuildPriorityChipStyle(task?.priority);
                const priorityChip = `<span class="tm-kanban-priority-chip" style="${priorityChipStyle}" onclick="tmPickPriority('${id}', this, event)">${__tmRenderPriorityJira(task?.priority, false)}</span>`;
                const metaParts = [];
                if (kanbanCardFields.has('priority') && __tmShouldRenderTaskCardPriority(task)) metaParts.push(priorityChip);
                if (kanbanCardFields.has('status') && __tmShouldRenderTaskCardStatus(task)) metaParts.push(statusChip);
                if (kanbanCardFields.has('date') && __tmShouldRenderTaskCardDate(task)) {
                    const dateChipClass = `${timeTxt ? ' tm-kanban-chip--date-has-value' : ' tm-kanban-chip--date-empty'}${__tmIsTaskCardDateOverdue(task, completedTodayKey) ? ' tm-kanban-chip--date-overdue' : ''}`;
                    metaParts.push(`<span class="tm-kanban-chip tm-kanban-chip--muted tm-kanban-chip--date${dateChipClass}" data-tm-task-time-field="date" onclick="tmKanbanPickDate('${id}', event)" title="点击选择日期">${esc(dateTxt || '日期')}</span>`);
                }
                if (kanbanCardFields.has('tomatoSummary')) {
                    const text = __tmGetTaskTomatoSummaryText(task);
                    if (text) metaParts.push(`<span class="tm-kanban-chip tm-kanban-chip--muted" data-tm-task-time-field="tomatoSummary" onclick="tmEditFocusSummaryInline('${id}', this)" title="时长与番茄">${__tmGetTaskTomatoSummaryHtml(task)}</span>`);
                }
                if (kanbanCardFields.has('tomatoEstimateCount')) {
                    const text = __tmGetTomatoCountDisplay(__tmGetTaskTomatoEstimateCount(task));
                    if (text) metaParts.push(`<span class="tm-kanban-chip tm-kanban-chip--muted" data-tm-task-time-field="tomatoEstimateCount">${esc(text)}</span>`);
                }
                if (kanbanCardFields.has('tomatoCount')) {
                    const text = __tmGetTomatoCountDisplay(__tmGetTaskTomatoCount(task));
                    if (text) metaParts.push(`<span class="tm-kanban-chip tm-kanban-chip--muted" data-tm-task-time-field="tomatoCount">${__tmGetActualTomatoCountDisplayHtml(__tmGetTaskTomatoCount(task))}</span>`);
                }
                if (kanbanCardFields.has('h2') && task?.h2) metaParts.push(`<span class="tm-kanban-chip tm-kanban-chip--muted" style="cursor:default;">${__tmRenderHeadingLevelInlineIcon(task.headingLevel || SettingsStore.data.taskHeadingLevel || 'h2', { size: 14 })} ${esc(__tmNormalizeHeadingText(task.h2))}</span>`);
                const docChipHtml = (isAllTabsView && docName)
                    ? `<span class="tm-kanban-chip tm-kanban-chip--muted tm-kanban-chip--doc" style="cursor:default;" title="${esc(docName)}"><span class="tm-icon-label">${__tmRenderDocIcon(docId, { fallbackText: '📄', size: 14 })}<span>${esc(docName)}</span></span></span>`
                    : '';
                const remarkHtml = kanbanCardFields.has('remark') ? __tmRenderTaskCardRemark(task) : '';
                const multiSelectCls = __tmIsTaskMultiSelected(id) ? ' tm-task-row--multi-selected' : '';
                const cardDragAttrs = useKanbanCustomCardGesture
                    ? 'draggable="false"'
                    : `draggable="true" ondragstart="tmKanbanDragStart(event, '${id}')" ondragend="tmKanbanDragEnd(event, '${id}')"`;
                const cardPointerDownAttr = `onpointerdown="tmKanbanCardPointerDown(event, '${id}')"`;
                const cardClickAttr = `onclick="tmKanbanCardClick('${id}', event)"`;
                const cardContextMenuAttr = __tmIsRuntimeMobileClient()
                    ? 'oncontextmenu="event.preventDefault();event.stopPropagation();return false;"'
                    : `oncontextmenu="tmShowTaskContextMenu(event, '${id}')"`;
                const completedTodayBadgeHtml = inCompletedRootGroup === true
                    ? __tmRenderCompletedTodayBadge(task, { todayKey: completedTodayKey })
                    : '';
                const hasFocusDescendant = tomatoFocusTaskId && id !== tomatoFocusTaskId && hasTomatoFocusDescendant(id);
                const tomatoFocusCls = tomatoFocusTaskId
                    ? (tomatoFocusTaskId === id
                        ? ' tm-timer-focus'
                        : (tomatoFocusModeEnabled
                            ? (hasFocusDescendant ? ' tm-timer-focus-ancestor' : ' tm-timer-dim')
                            : ''))
                    : '';
                const cardClass = `tm-kanban-card${isSub ? ' tm-kanban-card--sub tm-kanban-subtask-row' : ''}${isChildRoot ? ' tm-kanban-card--childroot' : ''}${isParent ? ' tm-kanban-card--parent' : ''}${task?.done ? ' tm-kanban-card--done' : ''}${remarkHtml ? ' tm-kanban-card--has-remark' : ''}${multiSelectCls}${tomatoFocusCls}`;
                const cardAttrs = `data-id="${id}" ${cardDragAttrs} ${cardPointerDownAttr} ${cardClickAttr} ${cardContextMenuAttr} ondblclick="tmKanbanCardDblClick('${id}', event)"`;
                const checkboxHtml = __tmRenderTaskCheckboxWrap(id, task, {
                    checked: task?.done,
                    extraClass: isGloballyLocked ? 'tm-operating' : '',
                    collapsed: !!(isParent && totalChildren > 0 && __tmKanbanGetCollapsedSet().has(id) && !hasFocusDescendant),
                });
                const titleInnerHtml = `${API.renderTaskContentHtml(task.markdown, content || '(无内容)')}${__tmRenderGlobalCollectDocTaskInlineIcon(task)}${completedTodayBadgeHtml}${__tmRenderRecurringTaskInlineIcon(task)}${__tmRenderRecurringInstanceBadge(task, { className: 'tm-recurring-instance-badge--inline' })}`;
                const titleAttrs = `onclick="tmJumpToTask('${id}', event)"${__tmBuildTooltipAttrs(String(content || '(无内容)').trim() || '(无内容)', { side: 'bottom', ariaLabel: false })} style="${__tmBuildTaskTitleOpacityStyle(task)}"`;
                const parentTaskTitleCls = !isSub ? ' tm-parent-task-title' : '';
                const cardMetaParts = docChipHtml ? [...metaParts, docChipHtml] : metaParts;
                const cardMetaHtml = cardMetaParts.length ? `<div class="tm-kanban-card-meta">${cardMetaParts.join('')}</div>` : '';
                const subtaskMetaHtml = metaParts.length ? `<div class="tm-kanban-subtask-meta">${metaParts.join('')}</div>` : '';
                const completedChildren = Number(directChildStats.completed) || 0;
                const childProgressPercent = totalChildren > 0 ? Math.round((completedChildren / totalChildren) * 100) : 0;
                const isChildrenCollapsed = !!(totalChildren > 0 && __tmKanbanGetCollapsedSet().has(id) && !hasFocusDescendant);
                const subtaskToggleTitle = isChildrenCollapsed ? '展开子任务' : '折叠子任务';
                const subtaskCountButtonHtml = `<button class="tm-badge tm-badge--count tm-kanban-subtasks-count" type="button" onclick="tmKanbanToggleCollapse('${id}', event)" title="${subtaskToggleTitle}">${completedChildren}/${totalChildren}</button>`;
                const subtaskToggleControlHtml = toggleHtml
                    ? `<span class="tm-kanban-subtask-toggle-control">${subtaskCountButtonHtml}${toggleHtml}</span>`
                    : '';
                const nestedSubtasksHtml = (toggleHtml && totalChildren > 0)
                    ? `<div class="tm-kanban-subtasks tm-kanban-subtasks--nested"><div class="tm-kanban-subtasks-progress" role="presentation"><span style="width:${childProgressPercent}%"></span></div>${childrenHtml ? `<div class="tm-kanban-subtasks-list">${childrenHtml}</div>` : ''}</div>`
                    : '';

                if (isSub) {
                    return `
                        <div class="${cardClass}" ${cardAttrs}>
                            <div class="tm-kanban-subtask-row-main">
                                ${checkboxHtml}
                                <div class="tm-kanban-subtask-text">
                                    <span class="tm-kanban-subtask-title tm-task-content-clickable" ${titleAttrs}>${titleInnerHtml}</span>
                                    ${subtaskMetaHtml}
                                </div>
                                <div class="tm-kanban-subtask-actions">
                                    <button class="tm-kanban-more tm-kanban-subtask-more" onclick="tmOpenTaskDetail('${id}', event)" title="任务详情">${__tmRenderLucideIcon('dots-three')}</button>
                                    ${subtaskToggleControlHtml}
                                </div>
                            </div>
                            ${nestedSubtasksHtml}
                        </div>
                    `;
                }

                const childrenCollapsed = !!(isParent && isChildrenCollapsed);
                const subtasksSectionHtml = isParent && totalChildren > 0
                    ? `
                        <section class="tm-kanban-subtasks" aria-label="子任务">
                            <button class="tm-kanban-subtasks-head" type="button" aria-expanded="${childrenCollapsed ? 'false' : 'true'}" onclick="tmKanbanToggleCollapse('${id}', event)" title="${childrenCollapsed ? '展开子任务' : '折叠子任务'}">
                                <span class="tm-kanban-subtasks-label">${__tmRenderBadgeIcon('clipboard-list', 14)}<span>子任务</span></span>
                                <span class="tm-badge tm-badge--count">${completedChildren}/${totalChildren}</span>
                                <span class="tm-kanban-subtasks-chevron" aria-hidden="true"><svg class="tm-tree-toggle-icon" viewBox="0 0 16 16" width="12" height="12" style="transform:rotate(${childrenCollapsed ? '0deg' : '90deg'});"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                            </button>
                            <div class="tm-kanban-subtasks-progress" role="presentation"><span style="width:${childProgressPercent}%"></span></div>
                            ${childrenHtml ? `<div class="tm-kanban-subtasks-list">${childrenHtml}</div>` : ''}
                        </section>
                    `
                    : '';

                return `
                    <div class="${cardClass}" ${cardAttrs}>
                        <div class="tm-kanban-card-top tm-kanban-card-main">
                            <div class="tm-kanban-card-head">
                                ${!isParent ? (toggleHtml || '') : ''}
                                ${checkboxHtml}
                                <div class="tm-kanban-card-text">
                                    <span class="tm-kanban-card-title-inline tm-task-content-clickable${parentTaskTitleCls}" ${titleAttrs}>${titleInnerHtml}</span>
                                    ${cardMetaHtml}
                                </div>
                            </div>
                            <button class="tm-kanban-more" onclick="tmOpenTaskDetail('${id}', event)" title="任务详情">${__tmRenderLucideIcon('dots-three')}</button>
                        </div>
                        ${parentTxt ? `<div class="tm-kanban-parent-line" style="font-size:12px;color:var(--tm-secondary-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:6px;" title="${esc(parentTxt)}"><span>父任务：</span><span style="font-weight:${SettingsStore.data.parentTaskNameBoldEnabled === false ? '400' : '800'};color:var(--card-foreground);">${esc(parentTxt)}</span></div>` : ''}
                        ${remarkHtml}
                        ${subtasksSectionHtml}
                    </div>
                `;
            };

            const kanbanBoardNavItems = [];
            const colsHtml = cols.map(c => {
                const list0 = tasksByStatus.get(c.id) || [];
                const isDoneCol = String(c?.id || '').trim() === '__done__';
                const isCompletedStatusCol = isDoneCol || (!headingMode && __tmDoesStatusIdResolveToDone(String(c?.id || '').trim(), statusOptions));
                const map = new Map();
                const pinnedGroupBg = __tmIsDarkMode()
                    ? 'color-mix(in srgb, var(--tm-danger-color,#d32f2f) 18%, var(--tm-header-bg))'
                    : '#ffebee';
                list0.forEach(t => {
                    const id = String(t?.id || '').trim();
                    if (id) map.set(id, t);
                });
                const nearestMappedAncestorIdByTaskId = new Map();
                const getNearestMappedAncestorId = (task) => {
                    const id = String(task?.id || '').trim();
                    if (id && nearestMappedAncestorIdByTaskId.has(id)) {
                        return nearestMappedAncestorIdByTaskId.get(id);
                    }
                    let result = '';
                    if (!kanbanKeepSubtasksAttached) {
                        const directParentId = getKanbanParentTaskId(task);
                        result = directParentId && map.has(directParentId) ? directParentId : '';
                        if (id) nearestMappedAncestorIdByTaskId.set(id, result);
                        return result;
                    }
                    const seen = new Set([id].filter(Boolean));
                    let pid = getKanbanParentTaskId(task);
                    while (pid && !seen.has(pid)) {
                        seen.add(pid);
                        if (map.has(pid)) {
                            result = pid;
                            break;
                        }
                        const parent = getRawKanbanTaskById(pid);
                        if (!parent) break;
                        pid = getKanbanParentTaskId(parent);
                    }
                    if (id) nearestMappedAncestorIdByTaskId.set(id, result);
                    return result;
                };
                const childrenByParent = new Map();
                list0.forEach(t => {
                    const id = String(t?.id || '').trim();
                    const pid = getNearestMappedAncestorId(t);
                    if (!id || !pid) return;
                    if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
                    childrenByParent.get(pid).push(t);
                });
                let roots = list0.filter(t => {
                    return !getNearestMappedAncestorId(t);
                });
                const headingDoneTailEnabled = headingMode && !isDoneCol;
                const doneRootSplit = headingDoneTailEnabled
                    ? __tmSplitTasksByDoneState(roots)
                    : { active: roots, done: [] };
                roots = doneRootSplit.active;
                const completedRoots = doneRootSplit.done;
                const getIdx = (t) => indexById.get(String(t?.id || '').trim()) ?? 999999;
                const sortByIdx = (a, b) => getIdx(a) - getIdx(b);
                const getDocId = (t) => String(t?.root_id || t?.docId || '').trim();
                const compareRootByDocFlow = (a, b) => {
                    const ad = getDocId(a);
                    const bd = getDocId(b);
                    if (ad && bd && ad !== bd) {
                        const ar = docRank.has(ad) ? docRank.get(ad) : 999999;
                        const br = docRank.has(bd) ? docRank.get(bd) : 999999;
                        if (ar !== br) return ar - br;
                        return sortByIdx(a, b);
                    }
                    const flow = __tmCompareTasksByDocFlow(a, b);
                    if (flow !== 0) return flow;
                    return sortByIdx(a, b);
                };
                const compareChildByDocFlow = (a, b) => {
                    const ad = getDocId(a);
                    const bd = getDocId(b);
                    if (ad && bd && ad !== bd) return compareRootByDocFlow(a, b);
                    const flow = __tmCompareTasksByDocFlow(a, b);
                    if (flow !== 0) return flow;
                    return sortByIdx(a, b);
                };
                const rootCompare = needDocFlowForKanban ? compareRootByDocFlow : sortByIdx;
                const childCompare = needDocFlowForKanban ? compareChildByDocFlow : sortByIdx;
                const completedRecentCompare = (a, b) => __tmCompareCompletedTasksRecentFirst(a, b, rootCompare);
                roots.sort(isCompletedStatusCol ? completedRecentCompare : rootCompare);
                completedRoots.sort(completedRecentCompare);
                childrenByParent.forEach(arr => arr.sort(childCompare));

                const renderTree = (task, depthInCol, inheritedHideCompleted = false, inCompletedRootGroup = false) => {
                    const id = String(task?.id || '').trim();
                    const pid = getKanbanParentTaskId(task);
                    const parentInCol = !!(pid && map.has(pid));
                    const parent = pid
                        ? (
                            getRawKanbanTaskById(pid)
                            || state.flatTasks?.[pid]
                            || state.pendingInsertedTasks?.[pid]
                            || null
                        )
                        : null;
                    const hideCompletedDescendants = __tmResolveHideCompletedDescendantsFlag(task, inheritedHideCompleted);

                    // 在标题看板模式下，如果子任务的 h2Id 与父任务的 h2Id 不同，说明子任务已经被拖到不同的标题下独立显示了
                    // 在文档分组模式下，如果子任务的 docId 与父任务的 docId 不同，说明子任务已经被拖到不同的文档下独立显示了
                    // 这两种情况下都不再显示父任务信息
                    let parentTxt = '';
                    if (!parentInCol && parent) {
                        const taskH2Id = String(task?.h2Id || '').trim();
                        const parentH2Id = String(parent?.h2Id || '').trim();
                        const taskDocId = String(task?.docId || task?.root_id || '').trim();
                        const parentDocId = String(parent?.docId || parent?.root_id || '').trim();
                        // 如果 h2Id 不同，说明已经被拖到不同标题，不显示父任务信息
                        // 如果 docId 不同，说明已经被拖到不同文档，不显示父任务信息
                        if ((taskH2Id && parentH2Id && taskH2Id !== parentH2Id) || (taskDocId && parentDocId && taskDocId !== parentDocId)) {
                            parentTxt = ''; // 已独立，不显示父任务
                        } else {
                            parentTxt = String(parent.content || '').trim();
                        }
                    }
                    const childList = (childrenByParent.get(id) || []).filter((child) => __tmShouldKeepChildTaskVisible(task, child, inheritedHideCompleted));
                    const collapsed = childList.length ? (__tmKanbanGetCollapsedSet().has(id) && !hasTomatoFocusDescendant(id)) : false;
                    const toggleHtml = childList.length
                        ? `<button class="tm-kanban-subtask-toggle tm-kanban-subtasks-chevron" onclick="tmKanbanToggleCollapse('${id}', event)" title="${collapsed ? '展开子任务' : '折叠子任务'}"><svg class="tm-tree-toggle-icon" viewBox="0 0 16 16" width="12" height="12" style="transform:rotate(${collapsed ? '0deg' : '90deg'});"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`
                        : '';
                    const childrenHtml = (!collapsed && childList.length) ? childList.map(ch => renderTree(ch, depthInCol + 1, hideCompletedDescendants, inCompletedRootGroup)).join('') : '';
                    const cardHtml = renderCard(
                        task,
                        depthInCol,
                        depthInCol > 0,
                        depthInCol === 0 && !!pid,
                        parentTxt,
                        childrenHtml,
                        toggleHtml,
                        depthInCol === 0 && childList.length > 0,
                        inCompletedRootGroup
                    );
                    return cardHtml;
                };

                const renderGroupTitle = (groupKey, titleHtml, count, color, opt = {}) => {
                    const isCollapsed = state.collapsedGroups?.has(groupKey);
                    const indentCh = Number(opt?.indentCh);
                    const leftIndent = Number.isFinite(indentCh) && indentCh > 0 ? `${indentCh}ch` : '0';
                    const titleColor = String(color || '').trim();
                    const groupBg = titleColor ? __tmGroupBgFromLabelColor(titleColor, isDark) : '';
                    const dropKind = String(opt?.dropKind || '').trim();
                    const dropDocId = String(opt?.dropDocId || '').trim();
                    const dropHeadingId = String(opt?.dropHeadingId || '').trim();
                    const dropAttrs = dropKind
                        ? ` data-tm-kb-drop-kind="${esc(dropKind)}"${dropDocId ? ` data-tm-kb-drop-doc="${esc(dropDocId)}"` : ''}${dropHeadingId ? ` data-tm-kb-drop-heading="${esc(dropHeadingId)}"` : ''}`
                        : '';
                    const dropHandlers = dropKind
                        ? ` ondragover="tmKanbanGroupDragOver(event)" ondragleave="tmKanbanGroupDragLeave(event)" ondrop="tmKanbanGroupDrop(event)"`
                        : '';
                    return `
                        <div class="tm-kanban-group-title${dropKind ? ' tm-kanban-group-title--droppable' : ''}" data-group-key="${esc(groupKey)}" onclick="tmToggleGroupCollapse('${escSq(groupKey)}', event)" style="${titleColor ? `color:${titleColor};` : ''}${groupBg ? `background:${groupBg};` : ''}"${dropAttrs}${dropHandlers}>
                            <span style="display:inline-flex;align-items:center;min-width:0;padding-left:${leftIndent};">
                                <span class="tm-group-toggle${isCollapsed ? ' tm-group-toggle--collapsed' : ''}" style="cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:16px;"><svg class="tm-group-toggle-icon" viewBox="0 0 16 16" width="16" height="16"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                                <span>${titleHtml}</span>
                            </span>
                            <span class="tm-badge tm-badge--count">${Number(count) || 0}</span>
                        </div>
                    `;
                };

                const pinnedGroupLabelHtml = `<span style="display:inline-flex;align-items:center;gap:4px;min-width:0;color:var(--tm-warning-color);"><span class="tm-checklist-group-pin-icon" style="transform:translateY(-1px);">${__tmRenderBadgeIcon('pin', 14)}</span><span>置顶</span></span>`;
                const renderPinnedGroupTitle = (groupKey, count) => {
                    const isCollapsed = state.collapsedGroups?.has(groupKey);
                    return `
                        <div class="tm-kanban-group-title" data-group-key="${esc(groupKey)}" onclick="tmToggleGroupCollapse('${escSq(groupKey)}', event)" style="background:${pinnedGroupBg};">
                            <span style="display:inline-flex;align-items:center;min-width:0;">
                                <span class="tm-group-toggle${isCollapsed ? ' tm-group-toggle--collapsed' : ''}" style="cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:16px;color:var(--tm-text-color);"><svg class="tm-group-toggle-icon" viewBox="0 0 16 16" width="16" height="16"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                                <span>${pinnedGroupLabelHtml}</span>
                            </span>
                            <span class="tm-badge tm-badge--count">${Number(count) || 0}</span>
                        </div>
                    `;
                };

                const renderCompletedRootGroup = () => {
                    if (!headingDoneTailEnabled || completedRoots.length === 0) return '';
                    const doneGroupKey = __tmBuildCompletedRootGroupKey(`kanban:${String(c.id || '').trim() || 'col'}`);
                    const doneCollapsed = __tmIsCompletedRootGroupCollapsed(doneGroupKey);
                    const doneTitle = `<span style="color:var(--tm-secondary-text);">已完成任务</span>`;
                    const doneBody = doneCollapsed ? '' : `<div class="tm-kanban-group-items">${completedRoots.map(t => renderTree(t, 0, false, true)).join('')}</div>`;
                    return `<div class="tm-kanban-group">${renderGroupTitle(doneGroupKey, doneTitle, completedRoots.length, 'var(--tm-secondary-text)')}${doneBody}</div>`;
                };

                const renderGroupedByDoc = (opt = {}) => {
                    const o = (opt && typeof opt === 'object') ? opt : {};
                    const showDocTitle = !o.hideDocTitle; // 是否显示文档标题行
                    const explicitHeadingIndent = Number(o.headingIndentCh);
                    const headingIndent = Number.isFinite(explicitHeadingIndent)
                        ? Math.max(0, explicitHeadingIndent)
                        : (showDocTitle && !o.headingMode ? 2 : 0); // 隐藏文档层后，标题分组不再按文档子级缩进
                    // 辅助函数：检查任务是否被置顶
                    const isPinned = (t) => {
                        const p = t.pinned;
                        return p === true || p === 'true' || p === '1';
                    };
                    // 分离置顶和非置顶任务
                    const allPinned = roots.filter(isPinned);
                    const allNormal = roots.filter(t => !isPinned(t));
                    // 分别排序
                    allPinned.sort(allowDocFlowForKanban ? __tmCompareTasksByDocFlow : sortByIdx);
                    // 构建置顶分组 HTML
                    let resultHtml = '';
                    if (allPinned.length > 0) {
                        const pinnedGroupKey = `kanban_${c.id}_doc_pinned`;
                        const pinnedIsCollapsed = state.collapsedGroups?.has(pinnedGroupKey);
                        // 渲染置顶任务卡片，添加红色左边框
                        const renderPinnedTree = (t) => {
                            const html = renderTree(t, 0);
                            // 使用正则精确替换最外层的 tm-kanban-card class，添加红色左边框样式
                            return html.replace(/class="tm-kanban-card([^"]*)"/, (match, extras) => {
                                return `class="tm-kanban-card${extras}" style="border-left:3px solid var(--tm-danger-color,#d32f2f);"`;
                            });
                        };
                        const pinnedBody = pinnedIsCollapsed ? '' : `<div class="tm-kanban-group-items">${allPinned.map(renderPinnedTree).join('')}</div>`;
                        const pinnedTitle = renderPinnedGroupTitle(pinnedGroupKey, allPinned.length);
                        resultHtml += `<div class="tm-kanban-group">${pinnedTitle}${pinnedBody}</div>`;
                    }
                    // 对非置顶任务按文档分组
                    const rootByDoc = new Map();
                    const countByDoc = new Map();
                    allNormal.forEach(t => {
                        const did = String(t?.root_id || '').trim() || '__unknown__';
                        countByDoc.set(did, (countByDoc.get(did) || 0) + 1);
                    });
                    allNormal.forEach(t => {
                        const did = String(t?.root_id || '').trim() || '__unknown__';
                        if (!rootByDoc.has(did)) rootByDoc.set(did, []);
                        rootByDoc.get(did).push(t);
                    });
                    const docIds = Array.from(rootByDoc.keys());
                    docIds.sort((a, b) => {
                        const ar = docRank.has(a) ? docRank.get(a) : 999999;
                        const br = docRank.has(b) ? docRank.get(b) : 999999;
                        if (ar !== br) return ar - br;
                        const a0 = rootByDoc.get(a)?.[0];
                        const b0 = rootByDoc.get(b)?.[0];
                        return getIdx(a0) - getIdx(b0);
                    });
                    const docGroupsHtml = docIds.map((docId) => {
                        const items = rootByDoc.get(docId) || [];
                        const groupKey = `kanban_${c.id}_doc_${docId}`;
                        const isCollapsed = showDocTitle && state.collapsedGroups?.has(groupKey);
                        const docName = docNameById.get(docId) || '未知文档';
                        const labelColor = docId === '__unknown__' ? 'var(--tm-secondary-text)' : (__tmGetDocColorHex(docId, isDark) || 'var(--tm-group-doc-label-color)');
                        const title = `<span style="display:inline-flex;align-items:center;gap:6px;color:${labelColor};">${__tmRenderDocIcon(docId, { fallbackText: '📄', size: 14 })}<span>${esc(docName)}</span></span>`;
                        let body = '';
                        if (!isCollapsed) {
                            // 在标题看板模式下，即使设置中没有启用 docH2SubgroupEnabled，也启用二级标题分组
                            const enableH2 = ((!!SettingsStore.data.docH2SubgroupEnabled || headingMode) && !o.forceNoHeading)
                                && __tmDocHasAnyHeading(docId, items);
                            if (!enableH2) {
                                // 辅助函数：检查任务是否被置顶
                                const isPinned = (t) => {
                                    const p = t.pinned;
                                    return p === true || p === 'true' || p === '1';
                                };
                                // 分离置顶和非置顶任务
                                const pinnedItems = items.filter(isPinned);
                                const normalItems = items.filter(t => !isPinned(t));
                                // 分别排序
                                pinnedItems.sort(allowDocFlowForKanban ? __tmCompareTasksByDocFlow : sortByIdx);
                                normalItems.sort(allowDocFlowForKanban ? __tmCompareTasksByDocFlow : sortByIdx);
                                // 构建看板内容
                                let bodyContent = '';
                                if (pinnedItems.length > 0) {
                                    const pinnedBody = `<div class="tm-kanban-group-items">${pinnedItems.map(t => renderTree(t, 0)).join('')}</div>`;
                                    bodyContent += `<div class="tm-kanban-group"><div class="tm-kanban-group-title" style="display:flex;align-items:center;gap:4px;color:var(--tm-warning-color);">${pinnedGroupLabelHtml}</div>${pinnedBody}</div>`;
                                }
                                if (normalItems.length > 0) {
                                    const normalBody = `<div class="tm-kanban-group-items">${normalItems.map(t => renderTree(t, 0)).join('')}</div>`;
                                    bodyContent += `<div class="tm-kanban-group-items">${normalBody}</div>`;
                                }
                                body = bodyContent;
                            } else {
                                const headingLevel = String(SettingsStore.data.taskHeadingLevel || 'h2').trim() || 'h2';
                                const headingLabelMap = { h1: '一级标题', h2: '二级标题', h3: '三级标题', h4: '四级标题', h5: '五级标题', h6: '六级标题' };
                                const noHeadingLabel = `无${headingLabelMap[headingLevel] || '标题'}`;
                                const buckets = __tmBuildDocHeadingBuckets(items, noHeadingLabel);
                                const grouped = new Map();
                                items.forEach((task) => {
                                    const b = __tmGetDocHeadingBucket(task, noHeadingLabel);
                                    if (!grouped.has(b.key)) grouped.set(b.key, []);
                                    grouped.get(b.key).push(task);
                                });
                                // 重新排序 buckets：将"无二级标题"的 bucket 提取出来，其余保持文档内的原始顺序
                                // 先过滤掉没有任务的 bucket
                                const filteredBuckets = buckets.filter(b => (grouped.get(b.key) || []).length > 0);
                                // 将"无二级标题"的 bucket 和其他 bucket 分开
                                const noneBucket = filteredBuckets.find(b => b.label === noHeadingLabel);
                                const otherBuckets = filteredBuckets.filter(b => b.label !== noHeadingLabel);
                                // 其他 bucket 保持文档内的原始顺序，"无二级标题"的放最后
                                const sortedBuckets = noneBucket ? [...otherBuckets, noneBucket] : otherBuckets;
                                const h2Html = sortedBuckets.map((bucket) => {
                                    let bucketItems = grouped.get(bucket.key) || [];
                                    if (!bucketItems.length) return '';
                                    // 辅助函数：检查任务是否被置顶
                                    const isPinned = (t) => {
                                        const p = t.pinned;
                                        return p === true || p === 'true' || p === '1';
                                    };
                                    // 分离置顶和非置顶任务
                                    const pinnedItems = bucketItems.filter(isPinned);
                                    const normalItems = bucketItems.filter(t => !isPinned(t));
                                    // 分别排序
                                    pinnedItems.sort(allowDocFlowForKanban ? __tmCompareTasksByDocFlow : sortByIdx);
                                    normalItems.sort(allowDocFlowForKanban ? __tmCompareTasksByDocFlow : sortByIdx);
                                    // 置顶任务排在前面
                                    bucketItems = [...pinnedItems, ...normalItems];
                                    const h2Key = `kanban_${c.id}_doc_${docId}__h2_${encodeURIComponent(String(bucket.key || 'label:__none__'))}`;
                                    const h2Collapsed = state.collapsedGroups?.has(h2Key);
                                    const h2Title = __tmRenderHeadingLevelIconLabel(String(bucket.label || ''), SettingsStore.data.taskHeadingLevel || 'h2', {
                                        style: 'color:var(--tm-secondary-text);'
                                    });
                                    const h2Body = h2Collapsed ? '' : `<div class="tm-kanban-group-items">${bucketItems.map(t => renderTree(t, 0)).join('')}</div>`;
                                    return `<div class="tm-kanban-group">${renderGroupTitle(h2Key, h2Title, bucketItems.length, '', { indentCh: headingIndent })}${h2Body}</div>`;
                                }).join('');
                                body = `<div class="tm-kanban-group-items">${h2Html}</div>`;
                            }
                        }
                        const dropOpt = (headingMode && isAllTabsView && o.dropDoc && docId !== '__unknown__')
                            ? { dropKind: 'doc', dropDocId: docId }
                            : {};
                        const wrapDrop = dropOpt.dropKind
                            ? ` data-tm-kb-drop-kind="${esc(dropOpt.dropKind)}" data-tm-kb-drop-doc="${esc(docId)}" ondragover="tmKanbanGroupDragOver(event)" ondragleave="tmKanbanGroupDragLeave(event)" ondrop="tmKanbanGroupDrop(event)"`
                            : '';
                        // 如果不显示文档标题，则只返回body部分（二级标题分组）
                        if (!showDocTitle) {
                            return body;
                        }
                        return `<div class="tm-kanban-group"${wrapDrop}>${renderGroupTitle(groupKey, title, countByDoc.get(docId) || items.length, labelColor, dropOpt)}${body}</div>`;
                    }).join('');
                    resultHtml += docGroupsHtml;
                    return resultHtml;
                };

                const renderGroupedByTime = () => {
                    // 辅助函数：检查任务是否被置顶
                    const isPinned = (t) => {
                        const p = t.pinned;
                        return p === true || p === 'true' || p === '1';
                    };
                    // 分离置顶和非置顶任务
                    const allPinned = roots.filter(isPinned);
                    const allNormal = roots.filter(t => !isPinned(t));
                    // 分别排序
                    allPinned.sort(needDocFlowForKanban ? compareRootByDocFlow : sortByIdx);
                    allNormal.sort(needDocFlowForKanban ? compareRootByDocFlow : sortByIdx);
                    // 构建结果
                    let resultHtml = '';
                    // 如果有置顶任务，先渲染置顶分组
                    if (allPinned.length > 0) {
                        const pinnedGroupKey = `kanban_${c.id}_time_pinned`;
                        const pinnedIsCollapsed = state.collapsedGroups?.has(pinnedGroupKey);
                        // 渲染置顶任务卡片，添加红色左边框
                        const renderPinnedTree = (t) => {
                            const html = renderTree(t, 0);
                            // 使用正则精确替换最外层的 tm-kanban-card class，添加红色左边框样式
                            return html.replace(/class="tm-kanban-card([^"]*)"/, (match, extras) => {
                                return `class="tm-kanban-card${extras}" style="border-left:3px solid var(--tm-danger-color,#d32f2f);"`;
                            });
                        };
                        const pinnedBody = pinnedIsCollapsed ? '' : `<div class="tm-kanban-group-items">${allPinned.map(renderPinnedTree).join('')}</div>`;
                        const pinnedTitle = renderPinnedGroupTitle(pinnedGroupKey, allPinned.length);
                        resultHtml += `<div class="tm-kanban-group">${pinnedTitle}${pinnedBody}</div>`;
                    }
                    // 对非置顶任务按时间分组
                    const gm = new Map();
                    allNormal.forEach(t => {
                        const info = getTimeGroup(t);
                        const key = String(info.key || 'pending');
                        if (!gm.has(key)) gm.set(key, { ...info, items: [] });
                        gm.get(key).items.push(t);
                    });
                    const groups = Array.from(gm.values()).sort((a, b) => {
                        const av = Number(a?.sortValue);
                        const bv = Number(b?.sortValue);
                        return (Number.isFinite(av) ? av : Infinity) - (Number.isFinite(bv) ? bv : Infinity);
                    });
                    const timeGroupsHtml = groups.map((g) => {
                        const groupKey = `kanban_${c.id}_time_${g.key}`;
                        const isCollapsed = state.collapsedGroups?.has(groupKey);
                        const color = getTimeGroupLabelColor(g);
                        const title = `<span style="color:${color};">${esc(g.label || '')}</span>`;
                        const items = (Array.isArray(g.items) ? g.items : []).slice();
                        items.sort(needDocFlowForKanban ? compareRootByDocFlow : sortByIdx);
                        const body = isCollapsed ? '' : `<div class="tm-kanban-group-items">${items.map(t => renderTree(t, 0)).join('')}</div>`;
                        return `<div class="tm-kanban-group">${renderGroupTitle(groupKey, title, items.length, color)}${body}</div>`;
                    }).join('');
                    resultHtml += timeGroupsHtml;
                    return resultHtml;
                };

                const renderGroupedByQuadrant = () => {
                    // 辅助函数：检查任务是否被置顶
                    const isPinned = (t) => {
                        const p = t.pinned;
                        return p === true || p === 'true' || p === '1';
                    };
                    // 分离置顶和非置顶任务
                    const allPinned = roots.filter(isPinned);
                    const allNormal = roots.filter(t => !isPinned(t));
                    // 分别排序
                    allPinned.sort(needDocFlowForKanban ? compareRootByDocFlow : sortByIdx);
                    // 构建结果
                    let resultHtml = '';
                    // 如果有置顶任务，先渲染置顶分组
                    if (allPinned.length > 0) {
                        const pinnedGroupKey = `kanban_${c.id}_quadrant_pinned`;
                        const pinnedIsCollapsed = state.collapsedGroups?.has(pinnedGroupKey);
                        // 渲染置顶任务卡片，添加红色左边框
                        const renderPinnedTree = (t) => {
                            const html = renderTree(t, 0);
                            // 使用正则精确替换最外层的 tm-kanban-card class，添加红色左边框样式
                            return html.replace(/class="tm-kanban-card([^"]*)"/, (match, extras) => {
                                return `class="tm-kanban-card${extras}" style="border-left:3px solid var(--tm-danger-color,#d32f2f);"`;
                            });
                        };
                        const pinnedBody = pinnedIsCollapsed ? '' : `<div class="tm-kanban-group-items">${allPinned.map(renderPinnedTree).join('')}</div>`;
                        const pinnedTitle = renderPinnedGroupTitle(pinnedGroupKey, allPinned.length);
                        resultHtml += `<div class="tm-kanban-group">${pinnedTitle}${pinnedBody}</div>`;
                    }
                    // 对非置顶任务按四象限分组
                    const gm = new Map();
                    quadrantRules.forEach(r => {
                        const id = String(r?.id || '').trim();
                        if (!id) return;
                        gm.set(id, { rule: r, items: [] });
                    });
                    const unmatchedKey = '__unmatched__';
                    gm.set(unmatchedKey, { rule: { id: unmatchedKey, name: '未匹配四象限', color: '' }, items: [] });
                    allNormal.forEach(t => {
                        const rule = resolveQuadrantRule(t);
                        const key = String(rule?.id || unmatchedKey);
                        if (!gm.has(key)) gm.set(key, { rule: rule || { id: key, name: key, color: '' }, items: [] });
                        gm.get(key).items.push(t);
                    });
                    const orderKeys = [...quadrantOrder, ...Array.from(gm.keys()).filter(k => !quadrantOrder.includes(k) && k !== unmatchedKey), unmatchedKey];
                    const quadrantGroupsHtml = orderKeys
                        .filter(k => gm.has(k) && (gm.get(k).items || []).length > 0)
                        .map((k) => {
                            const g = gm.get(k);
                            const rule = g.rule || {};
                            const groupKey = `kanban_${c.id}_quadrant_${String(rule.id || k)}`;
                            const isCollapsed = state.collapsedGroups?.has(groupKey);
                            const color = quadrantColorMap[String(rule.color || '')] || 'var(--tm-text-color)';
                            const title = `<span style="color:${color};">${esc(String(rule.name || k))}</span>`;
                            const items = (Array.isArray(g.items) ? g.items : []).slice();
                            items.sort(needDocFlowForKanban ? compareRootByDocFlow : sortByIdx);
                            const body = isCollapsed ? '' : `<div class="tm-kanban-group-items">${items.map(t => renderTree(t, 0)).join('')}</div>`;
                            return `<div class="tm-kanban-group">${renderGroupTitle(groupKey, title, items.length, color)}${body}</div>`;
                        })
                        .join('');
                    resultHtml += quadrantGroupsHtml;
                    return resultHtml;
                };

                const renderGroupedByTaskName = () => {
                    // 辅助函数：检查任务是否被置顶
                    const isPinned = (t) => {
                        const p = t.pinned;
                        return p === true || p === 'true' || p === '1';
                    };
                    // 分离置顶和非置顶任务
                    const allPinned = roots.filter(isPinned);
                    const allNormal = roots.filter(t => !isPinned(t));
                    // 分别排序
                    allPinned.sort(sortByIdx);
                    // 构建结果
                    let resultHtml = '';
                    // 如果有置顶任务，先渲染置顶分组
                    if (allPinned.length > 0) {
                        const pinnedGroupKey = `kanban_${c.id}_task_pinned`;
                        const pinnedIsCollapsed = state.collapsedGroups?.has(pinnedGroupKey);
                        // 渲染置顶任务卡片，添加红色左边框
                        const renderPinnedTree = (t) => {
                            const html = renderTree(t, 0);
                            // 使用正则精确替换最外层的 tm-kanban-card class，添加红色左边框样式
                            return html.replace(/class="tm-kanban-card([^"]*)"/, (match, extras) => {
                                return `class="tm-kanban-card${extras}" style="border-left:3px solid var(--tm-danger-color,#d32f2f);"`;
                            });
                        };
                        const pinnedBody = pinnedIsCollapsed ? '' : `<div class="tm-kanban-group-items">${allPinned.map(renderPinnedTree).join('')}</div>`;
                        const pinnedTitle = renderPinnedGroupTitle(pinnedGroupKey, allPinned.length);
                        resultHtml += `<div class="tm-kanban-group">${pinnedTitle}${pinnedBody}</div>`;
                    }
                    // 对非置顶任务按任务名分组
                    const gm = new Map();
                    allNormal.forEach(t => {
                        const content = String(t?.content || '').trim();
                        if (!content) return;
                        if (!gm.has(content)) gm.set(content, { content, items: [] });
                        gm.get(content).items.push(t);
                    });
                    const groups = Array.from(gm.values()).sort((a, b) => String(a.content || '').localeCompare(String(b.content || ''), 'zh-CN'));
                    const taskNameGroupsHtml = groups.map((g) => {
                        const safeContent = String(g.content || '').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
                        const groupKey = `kanban_${c.id}_task_${safeContent}`;
                        const isCollapsed = state.collapsedGroups?.has(groupKey);
                        // 计算该分组中所有任务的文档颜色
                        const docIds = [...new Set(g.items.map(t => t.root_id).filter(Boolean))];
                        let groupDocColor = '';
                        if (docIds.length === 1) {
                            groupDocColor = docIds[0] === '__unknown__' ? '' : (__tmGetDocColorHex(docIds[0], isDark) || '');
                        }
                        const color = groupDocColor || 'var(--tm-primary-color)';
                        const title = `<span style="color:${color};">📝 ${esc(g.content || '')}</span>`;
                        const items = (Array.isArray(g.items) ? g.items : []).slice();
                        items.sort(sortByIdx);
                        const body = isCollapsed ? '' : `<div class="tm-kanban-group-items">${items.map(t => renderTree(t, 0)).join('')}</div>`;
                        return `<div class="tm-kanban-group">${renderGroupTitle(groupKey, title, g.items.length, color)}${body}</div>`;
                    }).join('');
                    resultHtml += taskNameGroupsHtml;
                    return resultHtml;
                };

                let listHtml = '';
                // 辅助函数：检查任务是否被置顶
                const isPinned = (t) => {
                    const p = t.pinned;
                    return p === true || p === 'true' || p === '1';
                };
                const renderDoneColumnList = () => {
                    const items = list0.slice().sort(completedRecentCompare);
                    return items.map((task) => {
                        const id = String(task?.id || '').trim();
                        if (!id) return '';
                        const pid = getKanbanParentTaskId(task);
                        const parent = pid
                            ? (
                                getRawKanbanTaskById(pid)
                                || state.flatTasks?.[pid]
                                || state.pendingInsertedTasks?.[pid]
                                || null
                            )
                            : null;
                        const parentTxt = parent ? String(parent?.content || '').trim() : '';
                        return renderCard(
                            task,
                            0,
                            false,
                            !!pid,
                            parentTxt,
                            '',
                            '',
                            false
                        );
                    }).join('');
                };
                // 辅助函数：渲染不分组模式下的看板内容（带置顶分组）
                const renderUngroupedWithPinned = () => {
                    // 分离置顶和非置顶任务
                    const allPinned = roots.filter(isPinned);
                    const allNormal = roots.filter(t => !isPinned(t));
                    // 分别排序
                    allPinned.sort(needDocFlowForKanban ? compareRootByDocFlow : sortByIdx);
                    allNormal.sort(needDocFlowForKanban ? compareRootByDocFlow : sortByIdx);
                    // 构建结果
                    let result = '';
                    // 如果有置顶任务，先渲染置顶分组
                    if (allPinned.length > 0) {
                        const pinnedGroupKey = `kanban_${c.id}_ungrouped_pinned`;
                        const pinnedIsCollapsed = state.collapsedGroups?.has(pinnedGroupKey);
                        // 渲染置顶任务卡片，添加红色左边框
                        const renderPinnedTree = (t) => {
                            const html = renderTree(t, 0);
                            // 使用正则精确替换最外层的 tm-kanban-card class，添加红色左边框样式
                            return html.replace(/class="tm-kanban-card([^"]*)"/, (match, extras) => {
                                return `class="tm-kanban-card${extras}" style="border-left:3px solid var(--tm-danger-color,#d32f2f);"`;
                            });
                        };
                        const pinnedBody = pinnedIsCollapsed ? '' : `<div class="tm-kanban-group-items">${allPinned.map(renderPinnedTree).join('')}</div>`;
                        const pinnedTitle = renderPinnedGroupTitle(pinnedGroupKey, allPinned.length);
                        result += `<div class="tm-kanban-group">${pinnedTitle}${pinnedBody}</div>`;
                    }
                    // 渲染普通任务
                    if (allNormal.length > 0) {
                        result += allNormal.map(t => renderTree(t, 0)).join('');
                    }
                    return result;
                };
                // 标题看板模式下，也支持按文档/时间/四象限/任务名分组
                if (isDoneCol) {
                    listHtml = renderDoneColumnList();
                } else if (timeBoardMode && state.quadrantEnabled) {
                    listHtml = renderGroupedByQuadrant();
                } else if (timeBoardMode && state.groupByDocName) {
                    listHtml = renderGroupedByDoc(isAllTabsView ? {} : { hideDocTitle: true });
                } else if (timeBoardMode && state.groupByTaskName) {
                    listHtml = renderGroupedByTaskName();
                } else if (timeBoardMode) {
                    listHtml = roots.length ? renderUngroupedWithPinned() : '';
                } else if (headingMode && state.groupByDocName && isAllTabsView) {
                    // 标题看板模式 + 按文档分组 + 全部视图：每个文档内按二级标题分组，不显示文档标题行
                    listHtml = renderGroupedByDoc({ dropDoc: true, forceNoHeading: false, hideDocTitle: true, headingMode: true });
                } else if (headingMode && state.groupByDocName) {
                    // 标题看板模式 + 按文档分组 + 单个文档：不启用二级标题分组，因为看板本身已经是按二级标题分组的
                    listHtml = renderGroupedByDoc({ dropDoc: false, forceNoHeading: true, hideDocTitle: true, headingMode: false });
                } else if (headingMode && state.groupByTime) {
                    // 标题看板模式 + 按时间分组
                    listHtml = renderGroupedByTime();
                } else if (headingMode && state.quadrantEnabled) {
                    // 标题看板模式 + 四象限分组
                    listHtml = renderGroupedByQuadrant();
                } else if (headingMode && state.groupByTaskName) {
                    // 标题看板模式 + 按任务名分组
                    listHtml = renderGroupedByTaskName();
                } else if (headingMode) {
                    // 标题看板模式 + 不分组
                    listHtml = roots.length ? renderUngroupedWithPinned() : '';
                } else if (state.quadrantEnabled) {
                    listHtml = renderGroupedByQuadrant();
                } else if (state.groupByDocName) {
                    listHtml = renderGroupedByDoc(isAllTabsView ? {} : { hideDocTitle: true });
                } else if (state.groupByTaskName) {
                    // 按任务名分组
                    listHtml = renderGroupedByTaskName();
                } else if (state.groupByTime) {
                    listHtml = renderGroupedByTime();
                } else {
                    // 不分组模式
                    listHtml = roots.length ? renderUngroupedWithPinned() : '';
                }
                listHtml += renderCompletedRootGroup();
                const count = list0.length;
                const kind = isDoneCol
                    ? 'status'
                    : (timeBoardMode ? 'time' : (headingMode ? (String(c?.kind || '').trim() || (isAllTabsView ? 'doc' : 'heading')) : 'status'));
                const columnKey = isDoneCol
                    ? `done:${boardMode || 'status'}`
                    : (timeBoardMode
                        ? `time:${String(c?.id || '').trim()}`
                        : (headingMode
                            ? (kind === 'doc'
                                ? `doc:${String(c?.id || '').trim()}`
                                : `heading:${String(c?.docId || '').trim()}:${String(c?.headingId || '__none__').trim() || '__none__'}`)
                            : `status:${String(c?.id || '').trim()}`));
                const isColumnCollapsed = kanbanCollapsedColumnKeys.has(columnKey);
                if (headingMode && !isDoneCol && kind === 'doc' && !String(listHtml || '').trim()) {
                    return '';
                }
                const title = isDoneCol
                    ? '✅ 已完成'
                    : (timeBoardMode
                    ? c.name
                    : (headingMode
                    ? (kind === 'doc' ? `📄 ${c.name}` : c.name)
                    : (c.id === '__done__' ? '✅ 已完成' : c.id === 'todo' ? `🗂️ ${c.name}` : c.name)));
                const dataAttrs = isDoneCol
                    ? `data-kind="status" data-status="__done__"`
                    : (timeBoardMode
                    ? `data-kind="time" data-time="${esc(c.id)}"`
                    : (headingMode
                    ? (kind === 'doc'
                        ? `data-kind="doc" data-doc="${esc(String(c?.id || '').trim())}"`
                        : `data-kind="heading" data-doc="${esc(String(c?.docId || '').trim())}" data-heading="${esc(String(c?.headingId || '__none__').trim())}"`)
                    : `data-kind="status" data-status="${esc(c.id)}"`));
                const colTintBg = (() => {
                    const rgba = __tmParseCssColorToRgba(String(c?.color || '').trim());
                    if (!rgba) return '';
                    const a = isDark ? 0.30 : 0.20;
                    return `rgba(${Math.round(rgba.r)}, ${Math.round(rgba.g)}, ${Math.round(rgba.b)}, ${a})`;
                })();
                const colTitleColor = String(c?.color || '').trim() || 'var(--tm-text-color)';
                const colStyleBase = kanbanFillColumns
                    ? `flex:1 0 ${kanbanColW}px;min-width:${kanbanColW}px;max-width:none;`
                    : `width:${kanbanColW}px;min-width:${kanbanColW}px;max-width:${kanbanColW}px;`;
                const collapsedColW = isCompact ? 50 : 56;
                const colStyle = `${isColumnCollapsed
                    ? `width:${collapsedColW}px;min-width:${collapsedColW}px;max-width:${collapsedColW}px;flex:0 0 ${collapsedColW}px;`
                    : colStyleBase}${colTintBg ? `--tm-kanban-col-tint:${colTintBg};` : ''}`;
                const docIdForTitle = String(c?.docId || c?.id || '').trim();
                const headingDocId = String(c?.docId || '').trim();
                const headingIdForCreate = String(c?.headingId || '__none__').trim() || '__none__';
                const statusIdForCreate = String(c?.id || '').trim();
                const statusDocIdForCreate = (!headingMode && !isAllTabsView)
                    ? String(state.activeDocId || '').trim()
                    : '';
                const timeDateForCreate = timeBoardMode && !isDoneCol ? __tmNormalizeDateOnly(c?.createDate || '') : '';
                const timeDocIdForCreate = (timeBoardMode && !isDoneCol && !isAllTabsView && !__tmIsOtherBlockTabId(state.activeDocId))
                    ? String(state.activeDocId || '').trim()
                    : '';
                const canOpenDocFromTitle = headingMode && !isDoneCol && kind === 'doc' && docIdForTitle && docIdForTitle !== '__unknown__';
                const canQuickAddToDoc = headingMode && isAllTabsView && !isDoneCol && kind === 'doc' && docIdForTitle && docIdForTitle !== '__unknown__';
                const canCreateInHeading = headingMode && !isAllTabsView && !isDoneCol && kind === 'heading' && !!headingDocId;
                const canQuickAddToStatus = !headingMode && !timeBoardMode && !isDoneCol && !!statusIdForCreate;
                const canQuickAddToTimeDate = timeBoardMode && !isDoneCol && !!timeDateForCreate;
                const titleContentHtml = timeBoardMode && !isDoneCol
                    ? `<span>${String(c?.labelHtml || '').trim() || esc(String(c?.name || ''))}</span>`
                    : (headingMode && !isDoneCol && kind === 'doc'
                    ? `${__tmRenderDocIcon(docIdForTitle, { fallbackText: '📄', size: 14 })}<span>${esc(String(c?.name || ''))}</span>`
                    : (headingMode && !isDoneCol && kind === 'heading'
                        ? `${__tmRenderHeadingLevelInlineIcon(c?.headingLevel || SettingsStore.data.taskHeadingLevel || 'h2', { size: 14 })}<span>${esc(String(c?.name || ''))}</span>`
                        : esc(title)));
                const titleTextHtml = canOpenDocFromTitle
                    ? `<button type="button" class="tm-kanban-col-title-text tm-kanban-col-title-text--link" title="点击跳转至文档：${esc(c.name)}" onclick="event.preventDefault();event.stopPropagation();tmOpenDocById('${escSq(docIdForTitle)}');">${titleContentHtml}</button>`
                    : `<span class="tm-kanban-col-title-text" title="${esc(c.name)}">${titleContentHtml}</span>`;
                const navLabel = String(isDoneCol ? '已完成' : (c?.name || title || '')).trim();
                kanbanBoardNavItems.push({
                    key: columnKey,
                    label: navLabel,
                    title: navLabel,
                    color: colTitleColor,
                    count,
                });
                const headerActionsHtml = `
                    <div class="tm-kanban-col-header-actions" onclick="event.stopPropagation()">
                        ${canQuickAddToDoc
                            ? `<button class="tm-group-create-btn tm-kanban-col-add tm-whiteboard-stream-doc-add-btn"
                                       type="button"
                                       title="新建任务"
                                       aria-label="新建任务"
                                       onpointerdown="event.stopPropagation()"
                                       onclick="event.preventDefault();event.stopPropagation();tmQuickAddOpenForDoc('${escSq(docIdForTitle)}');">
                                    ${__tmRenderLucideIcon('plus')}
                                </button>`
                            : ''}
                        ${canQuickAddToStatus
                            ? `<button class="tm-group-create-btn tm-kanban-col-add tm-whiteboard-stream-doc-add-btn"
                                       type="button"
                                       title="新建任务"
                                       aria-label="新建任务"
                                       onpointerdown="event.stopPropagation()"
                                       onclick="event.preventDefault();event.stopPropagation();tmQuickAddOpenForPreset('${escSq(statusDocIdForCreate)}','${escSq(statusIdForCreate)}');">
                                    ${__tmRenderLucideIcon('plus')}
                                </button>`
                            : ''}
                        ${canQuickAddToTimeDate
                            ? `<button class="tm-group-create-btn tm-kanban-col-add tm-whiteboard-stream-doc-add-btn"
                                       type="button"
                                       title="新建任务"
                                       aria-label="新建任务"
                                       onpointerdown="event.stopPropagation()"
                                       onclick="event.preventDefault();event.stopPropagation();tmQuickAddOpenForPreset('${escSq(timeDocIdForCreate)}','', '${escSq(timeDateForCreate)}');">
                                    ${__tmRenderLucideIcon('plus')}
                                </button>`
                            : ''}
                        ${canCreateInHeading
                            ? `<button class="tm-group-create-btn tm-kanban-col-add"
                                       type="button"
                                       title="在该标题下新建任务"
                                       aria-label="在该标题下新建任务"
                                       onpointerdown="event.stopPropagation()"
                                       onclick="event.preventDefault();event.stopPropagation();tmCreateTaskForHeadingGroup('${escSq(headingDocId)}','${escSq(headingIdForCreate)}', event)">
                                    <svg viewBox="0 0 16 16" aria-hidden="true">
                                        <path d="M8 3.25v9.5M3.25 8h9.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                                    </svg>
                                </button>`
                            : ''}
                        ${timeBoardMode ? (() => {
                            const durationSum = __tmCalcGroupDurationText(list0, { skipNonEmptyStatus: true });
                            return durationSum ? `<span class="tm-badge tm-badge--duration tm-badge--kanban-time-duration" style="color:${esc(colTitleColor)};"><span class="tm-badge__icon">${__tmRenderBadgeIcon('chart-column')}</span>${esc(durationSum)}</span>` : '';
                        })() : ''}
                        <button class="tm-kanban-col-collapse"
                                type="button"
                                title="折叠看板列"
                                aria-label="折叠看板列：${esc(c.name)}"
                                onclick="tmKanbanToggleColumnCollapse('${escSq(columnKey)}', event)">
                            ${__tmRenderLucideIcon('arrows-in-line-horizontal')}
                        </button>
                    </div>
                `;
                const titleHtml = `
                    <div class="tm-kanban-col-title" style="color:${esc(colTitleColor)};">
                        ${titleTextHtml}
                        <span class="tm-badge tm-badge--count">${count}</span>
                        ${headerActionsHtml}
                    </div>
                `;
                if (isColumnCollapsed) {
                    const collapsedTitle = isDoneCol ? '已完成' : String(c?.name || title || '').trim();
                    const collapsedIconInnerHtml = headingMode && !isDoneCol && kind === 'doc'
                        ? __tmRenderDocIcon(docIdForTitle, { fallbackText: '📄', size: 14 })
                        : '';
                    const collapsedIconHtml = collapsedIconInnerHtml
                        ? `<span class="tm-kanban-col-collapsed-icon" aria-hidden="true">${collapsedIconInnerHtml}</span>`
                        : '';
                    return `
                        <div class="tm-kanban-col tm-kanban-col--collapsed" ${dataAttrs} data-col-key="${esc(columnKey)}" style="${colStyle}" ondragover="tmKanbanDragOver(event)" ondragleave="tmKanbanDragLeave(event)" ondrop="tmKanbanDrop(event)">
                            <div class="tm-kanban-col-header tm-kanban-col-header--collapsed"
                                 style="color:${esc(colTitleColor)};"
                                 title="展开看板列：${esc(collapsedTitle)}"
                                 role="button"
                                 tabindex="0"
                                 aria-label="展开看板列：${esc(collapsedTitle)}"
                                 onclick="tmKanbanToggleColumnCollapse('${escSq(columnKey)}', event)"
                                 onkeydown="if(event.key==='Enter'||event.key===' '){tmKanbanToggleColumnCollapse('${escSq(columnKey)}', event)}">
                                <div class="tm-kanban-col-collapsed-label">
                                    ${collapsedIconHtml}
                                    <span class="tm-kanban-col-collapsed-title">${esc(collapsedTitle)}</span>
                                    <span class="tm-badge tm-badge--count">${count}</span>
                                </div>
                                <button class="tm-kanban-col-collapse tm-kanban-col-collapse--expand"
                                        type="button"
                                        title="展开看板列"
                                        aria-label="展开看板列：${esc(collapsedTitle)}"
                                        onclick="tmKanbanToggleColumnCollapse('${escSq(columnKey)}', event)">
                                    ${__tmRenderLucideIcon('arrows-out-line-horizontal')}
                                </button>
                            </div>
                        </div>
                    `;
                }
                return `
                    <div class="tm-kanban-col" ${dataAttrs} data-col-key="${esc(columnKey)}" style="${colStyle}" ondragover="tmKanbanDragOver(event)" ondragleave="tmKanbanDragLeave(event)" ondrop="tmKanbanDrop(event)">
                        <div class="tm-kanban-col-header">
                            ${titleHtml}
                        </div>
                        <div class="tm-kanban-col-body" ondragover="tmKanbanDragOver(event)" ondragleave="tmKanbanDragLeave(event)" ondrop="tmKanbanDrop(event)">
                            ${listHtml || `<div class="tm-kanban-empty">空</div>`}
                        </div>
                    </div>
                `;
            }).join('');
            const kanbanBoardNavHtml = renderKanbanBoardNavHtml(kanbanBoardNavItems);
            __tmKanbanColsHtmlCache = { key: kanbanColsCacheKey, html: colsHtml, navHtml: kanbanBoardNavHtml };

            return `
                <div class="tm-body tm-body--kanban${bodyAnimClass}${isCompact ? ' tm-body--kanban-compact' : ''}${kanbanBoardNavHtml ? ' tm-body--kanban-has-board-nav' : ''}" ondragover="tmKanbanAutoScroll(event)">
                    ${kanbanBoardNavHtml}
                    <div class="tm-kanban tm-kanban--clean${isCompact ? ' tm-kanban--compact' : ''}${kanbanFillColumns ? ' tm-kanban--fill' : ''}">
                        ${colsHtml}
                    </div>
                    ${kanbanDetailHtml}
                </div>
            `;
        };


        return __tmRenderKanbanBodyHtml();
    }

    function __tmBuildRenderSceneCalendarBodyHtml(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const bodyAnimClass = String(opts.bodyAnimClass || '');
        const __tmRenderCalendarBodyHtml = () => {
            return `
                <div class="tm-body tm-body--calendar${bodyAnimClass}" style="display:flex;flex-direction:column;min-height:0;">
                    <div id="tmCalendarRoot" style="flex:1;min-height:0;"></div>
                </div>
            `;
        };


        return __tmRenderCalendarBodyHtml();
    }
