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
            const timelineStartW = Math.max(10, Math.min(240, Math.round(Number(widths.startDate) || 90)));
            const timelineEndW = Math.max(10, Math.min(360, Math.round(Number(widths.completionTime) || 170)));
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
                            : { key: `days_${diffDays}`, sortValue: diffDays });
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
                    return `<tr class="tm-group-row tm-timeline-row" data-group-key="${esc(row.key)}"><td colspan="3" onclick="tmToggleGroupCollapse('${row.key}', event)" style="cursor:pointer;font-weight:bold;color:var(--tm-text-color);"><div class="tm-group-sticky">${toggle}<span class="tm-group-label" style="color:${labelColor};">${esc(row.label || '')}</span><span class="tm-badge tm-badge--count">${Number(row.count) || 0}</span>${durationSum ? `<span class="tm-badge tm-badge--duration"><span class="tm-badge__icon">${__tmRenderBadgeIcon('chart-column')}</span>${esc(durationSum)}</span>` : ''}</div></td></tr>`;
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
                const task = state.flatTasks[row.id];
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
                                    <span class="tm-task-content-clickable" onclick="tmJumpToTask('${task.id}', event)"${__tmBuildTooltipAttrs(String(task.content || '').trim() || '(无内容)', { side: 'bottom', ariaLabel: false })}>${API.renderTaskContentHtml(task.markdown, task.content || '')}${__tmRenderRecurringTaskInlineIcon(task)}${__tmRenderRecurringInstanceBadge(task, { className: 'tm-recurring-instance-badge--inline' })}</span>
                                </span>
                            </div>
                        </td>
                    <td class="tm-cell-editable tm-task-meta-cell" style="width:${timelineStartW}px; min-width:${timelineStartW}px; max-width:${timelineStartW}px; ${otherCellBgStyle}" onclick="tmBeginCellEdit('${task.id}','startDate',this,event)">${__tmFormatTaskTime(task.startDate)}</td>
                    <td class="tm-cell-editable tm-task-meta-cell" style="width:${timelineEndW}px; min-width:${timelineEndW}px; max-width:${timelineEndW}px; ${otherCellBgStyle}" onclick="tmBeginCellEdit('${task.id}','completionTime',this,event)">${__tmFormatTaskTime(task.completionTime)}</td>
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
                        const task = state.flatTasks[r.id];
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
                                            <th style="width:${timelineStartW}px; min-width:${timelineStartW}px; max-width:${timelineStartW}px;">开始日期</th>
                                            <th style="width:${timelineEndW}px; min-width:${timelineEndW}px; max-width:${timelineEndW}px;">截止日期</th>
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
            const isAllTabsView = !(state.activeDocId && state.activeDocId !== 'all');
            const isCompact = !!SettingsStore.data.kanbanCompactMode;
            const baseKanbanW0 = Number(SettingsStore.data.kanbanColumnWidth);
            const baseKanbanW = Number.isFinite(baseKanbanW0) ? Math.max(220, Math.min(520, Math.round(baseKanbanW0))) : 320;
            const kanbanColW = isCompact ? Math.max(220, baseKanbanW - 40) : baseKanbanW;
            const kanbanFillColumns = !!SettingsStore.data.kanbanFillColumns;
            const kanbanCardFields = new Set(__tmGetTaskCardFieldList('kanban'));
            const headingMode = SettingsStore.data.kanbanHeadingGroupMode === true;
            const showDoneCol = headingMode && !!SettingsStore.data.kanbanShowDoneColumn;
            const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
            const statusOptionsRaw = Array.isArray(SettingsStore.data.customStatusOptions) ? SettingsStore.data.customStatusOptions : [];
            const statusOptions = statusOptionsRaw
                .map(o => ({ id: String(o?.id || '').trim(), name: String(o?.name || '').trim(), color: String(o?.color || '').trim() }))
                .filter(o => o.id);
            const todoOpt = statusOptions.find(o => o.id === 'todo') || { id: 'todo', name: '待办', color: '#757575' };
            const doneOpt = { id: '__done__', name: '已完成', color: '#9e9e9e', kind: 'status' };
            const colsStatus = showDoneCol
                ? [todoOpt, ...statusOptions.filter(o => o.id !== 'todo'), doneOpt]
                : [todoOpt, ...statusOptions.filter(o => o.id !== 'todo')];

            const docNameById = new Map();
            (Array.isArray(state.taskTree) ? state.taskTree : []).forEach(d => {
                const id = String(d?.id || '').trim();
                if (id) docNameById.set(id, String(d?.name || '').trim());
            });
            (Array.isArray(state.allDocuments) ? state.allDocuments : []).forEach(d => {
                const id = String(d?.id || '').trim();
                if (id && !docNameById.has(id)) docNameById.set(id, String(d?.name || '').trim());
            });

            const filtered = Array.isArray(state.filteredTasks) ? state.filteredTasks : [];
            const directChildStatsMemo = new Map();
            const getDirectChildStats = (task) => {
                const id = String(task?.id || '').trim();
                if (id && directChildStatsMemo.has(id)) return directChildStatsMemo.get(id);
                const allChildren = Array.isArray(task?.children) ? task.children : [];
                const stats = {
                    total: allChildren.length,
                    completed: allChildren.reduce((sum, child) => sum + ((child && child.done) ? 1 : 0), 0),
                };
                stats.remaining = Math.max(0, stats.total - stats.completed);
                if (id) directChildStatsMemo.set(id, stats);
                return stats;
            };
            const filteredIdList = filtered.map(t => String(t?.id || '').trim()).filter(Boolean);
            const filteredIdSet = new Set(filteredIdList);
            const indexById = new Map(filteredIdList.map((id, i) => [id, i]));
            const ruleForKanban = __tmGetCurrentRule();
            const allowDocFlowForKanban = __tmRuleUsesDocFlowSort(ruleForKanban);
            const isUngroupForKanban = !state.groupByDocName && !state.groupByTaskName && !state.groupByTime && !state.quadrantEnabled;
            const needDocFlowForKanban = allowDocFlowForKanban && (!!state.groupByDocName || isUngroupForKanban || !!state.groupByTaskName || !!state.groupByTime || !!state.quadrantEnabled);
            const escSq = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const kanbanDetailTaskId = String(state.kanbanDetailTaskId || '').trim();
            const kanbanDetailTask = kanbanDetailTaskId ? (state.flatTasks?.[kanbanDetailTaskId] || null) : null;
            const kanbanDetailHtml = kanbanDetailTask
                ? `
                    <aside class="tm-kanban-detail-float" id="tmKanbanDetailFloat">
                        <div class="tm-kanban-detail-float__body" id="tmKanbanDetailPanel">
                            ${__tmBuildTaskDetailInnerHtml(kanbanDetailTask, { embedded: true, floating: true })}
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
            const getTimeGroup = (task) => {
                const timeStr = String(task?.completionTime || task?.startDate || '').trim();
                if (!timeStr) return { key: 'pending', label: '待定', sortValue: Infinity };
                const taskDate = new Date(timeStr);
                if (isNaN(taskDate.getTime())) return { key: 'pending', label: '待定', sortValue: Infinity };
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const target = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
                const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
                if (diffDays < 0) return { key: 'overdue', label: '已过期', sortValue: diffDays };
                if (diffDays === 0) return { key: 'today', label: '今天', sortValue: 0 };
                if (diffDays === 1) return { key: 'tomorrow', label: '明天', sortValue: 1 };
                if (diffDays <= 7) return { key: 'week', label: '本周', sortValue: diffDays };
                if (diffDays <= 14) return { key: 'nextweek', label: '下周', sortValue: diffDays };
                return { key: 'later', label: `${diffDays}天后`, sortValue: diffDays };
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
                showDoneCol,
                headingMode,
                currentGroupId,
                activeDocId: String(state.activeDocId || '').trim(),
                isDark,
                isGloballyLocked,
                groupByDocName: !!state.groupByDocName,
                groupByTaskName: !!state.groupByTaskName,
                groupByTime: !!state.groupByTime,
                quadrantEnabled: !!state.quadrantEnabled,
                kanbanCardFields: Array.from(kanbanCardFields).join('|'),
            });
            if (__tmKanbanColsHtmlCache && __tmKanbanColsHtmlCache.key === kanbanColsCacheKey) {
                return `
                    <div class="tm-body tm-body--kanban${bodyAnimClass}${isCompact ? ' tm-body--kanban-compact' : ''}" ondragover="tmKanbanAutoScroll(event)">
                        <div class="tm-kanban${isCompact ? ' tm-kanban--compact' : ''}${kanbanFillColumns ? ' tm-kanban--fill' : ''}">
                            ${__tmKanbanColsHtmlCache.html}
                        </div>
                        ${kanbanDetailHtml}
                    </div>
                `;
            }
            const cols = (() => {
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
                const docId = String(state.activeDocId || '').trim();

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
                        cols0.push({
                            bucketKey: String(b?.key || '').trim() || `label:${String(b?.label || '').trim() || noHeadingLabel}`,
                            headingId: String(b?.id || '').trim(),
                            name: String(b?.label || '').trim() || '(空标题)',
                            color: pickDocColor(docId),
                            kind: 'heading',
                            docId,
                            hasItems: true,
                            orderIdx: cols0.length, // 保持动态顺序
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
                            orderIdx: 9999,
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

                // 按原始标题顺序排序：无标题始终最左；其余有任务的在前，无任务的按原始顺序在后
                cols0.sort((a, b) => {
                    const aIsNone = String(a?.name || '').trim() === noHeadingLabel;
                    const bIsNone = String(b?.name || '').trim() === noHeadingLabel;
                    if (aIsNone !== bIsNone) return aIsNone ? -1 : 1;
                    if (a.hasItems !== b.hasItems) return a.hasItems ? -1 : 1;
                    return a.orderIdx - b.orderIdx;
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
                if (!showDoneCol && !!task?.done) return;
                let key = '';
                if (!headingMode) {
                    key = __tmResolveTaskStatusId(task, statusOptions);
                    if (!tasksByStatus.has(key) && showDoneCol && !!task?.done) key = '__done__';
                    if (!showDoneCol && key === '__done__') return;
                } else if (showDoneCol && !!task?.done) {
                    key = '__done__';
                } else if (isAllTabsView) {
                    key = String(task?.root_id || '').trim() || '__unknown__';
                } else {
                    const did = String(task?.root_id || '').trim();
                    if (did !== String(state.activeDocId || '').trim()) return;
                    key = __tmGetDocHeadingBucket(task, noHeadingLabel).key;
                }
                if (!tasksByStatus.has(key)) tasksByStatus.set(key, []);
                tasksByStatus.get(key).push(task);
            });

            const renderCard = (task, depthInCol, isSub, isChildRoot, parentTxt, childrenHtml, toggleHtml, isParent) => {
                const id = String(task?.id || '').trim();
                if (!id) return '';
                const content = String(task?.content || '').trim();
                const docId = String(task?.root_id || '').trim();
                const docName = docNameById.get(docId) || '';
                const opt = __tmResolveTaskStatusDisplayOption(task, statusOptions, {
                    fallbackColor: task?.done ? '#9e9e9e' : '#757575',
                    fallbackName: task?.done ? '完成' : (todoOpt?.name || '待办'),
                });
                const timeTxt = String(task?.completionTime || '').trim() || String(task?.startDate || '').trim();
                const dateTxt = timeTxt ? __tmFormatTaskTime(timeTxt) : '';
                const directChildStats = getDirectChildStats(task);
                const totalChildren = directChildStats.total;
                const statusChipStyle = __tmBuildStatusChipStyle(opt.color || '#757575');
                const statusChip = task?.done
                    ? `<span class="tm-status-tag" style="${statusChipStyle};cursor:default;">${esc(opt.name || '完成')}</span>`
                    : `<span class="tm-status-tag" style="${statusChipStyle}" onclick="tmKanbanOpenStatusSelect('${id}', this, event)">${esc(opt.name || '')}</span>`;
                const priorityChipStyle = __tmBuildPriorityChipStyle(task?.priority);
                const priorityChip = `<span class="tm-kanban-priority-chip" style="${priorityChipStyle}" onclick="tmPickPriority('${id}', this, event)">${__tmRenderPriorityJira(task?.priority, false)}</span>`;
                const metaParts = [];
                if (kanbanCardFields.has('priority')) metaParts.push(priorityChip);
                if (kanbanCardFields.has('status')) metaParts.push(statusChip);
                if (kanbanCardFields.has('date')) metaParts.push(`<span class="tm-kanban-chip tm-kanban-chip--muted" data-tm-task-time-field="date" onclick="tmKanbanPickDate('${id}', event)" title="点击选择日期">${esc(dateTxt || '日期')}</span>`);
                if (kanbanCardFields.has('h2') && task?.h2) metaParts.push(`<span class="tm-kanban-chip tm-kanban-chip--muted" style="cursor:default;">${__tmRenderHeadingLevelInlineIcon(task.headingLevel || SettingsStore.data.taskHeadingLevel || 'h2', { size: 14 })} ${esc(__tmNormalizeHeadingText(task.h2))}</span>`);
                const remarkHtml = kanbanCardFields.has('remark') ? __tmRenderTaskCardRemark(task) : '';
                const multiSelectCls = __tmIsTaskMultiSelected(id) ? ' tm-task-row--multi-selected' : '';
                const cardDragAttrs = __tmIsRuntimeMobileClient()
                    ? 'draggable="false"'
                    : `draggable="true" ondragstart="tmKanbanDragStart(event, '${id}')" ondragend="tmKanbanDragEnd(event, '${id}')"`;
                const cardPointerDownAttr = `onpointerdown="tmKanbanCardPointerDown(event, '${id}')"`;
                const cardClickAttr = `onclick="tmKanbanCardClick('${id}', event)"`;
                const cardContextMenuAttr = __tmIsRuntimeMobileClient()
                    ? 'oncontextmenu="event.preventDefault();event.stopPropagation();return false;"'
                    : `oncontextmenu="tmShowTaskContextMenu(event, '${id}')"`;

                return `
                    <div class="tm-kanban-card${isSub ? ' tm-kanban-card--sub' : ''}${isChildRoot ? ' tm-kanban-card--childroot' : ''}${isParent ? ' tm-kanban-card--parent' : ''}${task?.done ? ' tm-kanban-card--done' : ''}${remarkHtml ? ' tm-kanban-card--has-remark' : ''}${multiSelectCls}" data-id="${id}" ${cardDragAttrs} ${cardPointerDownAttr} ${cardClickAttr} ${cardContextMenuAttr} ondblclick="tmKanbanCardDblClick('${id}', event)" style="${isSub ? '' : ''}">
                        <div class="tm-kanban-card-top">
                            <div class="tm-kanban-card-head">
                                ${toggleHtml || ''}
                                    ${__tmRenderTaskCheckboxWrap(id, task, { checked: task?.done, extraClass: isGloballyLocked ? 'tm-operating' : '', collapsed: !!(isParent && totalChildren > 0 && __tmKanbanGetCollapsedSet().has(id)) })}
                                <span class="tm-kanban-card-title-inline tm-task-content-clickable" onclick="tmJumpToTask('${id}', event)"${__tmBuildTooltipAttrs(String(content || '(无内容)').trim() || '(无内容)', { side: 'bottom', ariaLabel: false })}>${API.renderTaskContentHtml(task.markdown, content || '(无内容)')}${__tmRenderRecurringTaskInlineIcon(task)}${__tmRenderRecurringInstanceBadge(task, { className: 'tm-recurring-instance-badge--inline' })}</span>
                            </div>
                            <button class="tm-kanban-more" onclick="tmOpenTaskDetail('${id}', event)" title="任务详情">${__tmRenderLucideIcon('dots-three')}</button>
                        </div>
                        ${parentTxt ? `<div class="tm-kanban-parent-line" style="font-size:12px;color:var(--tm-secondary-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:6px;" title="${esc(parentTxt)}"><span>父任务：</span><span style="font-weight:800;color:var(--card-foreground);">${esc(parentTxt)}</span></div>` : ''}
                        ${remarkHtml}
                        ${metaParts.length ? `<div class="tm-kanban-card-meta">${metaParts.join('')}</div>` : ''}
                        ${(isAllTabsView && docName) ? `<div style="font-size:12px;color:var(--tm-secondary-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${__tmRenderIconLabel('file-text', docName)}</div>` : ''}
                        ${childrenHtml ? `<div class="tm-kanban-subtasks">${childrenHtml}</div>` : ''}
                    </div>
                `;
            };

            const colsHtml = cols.map(c => {
                const list0 = tasksByStatus.get(c.id) || [];
                const map = new Map();
                const pinnedGroupBg = __tmIsDarkMode()
                    ? 'color-mix(in srgb, var(--tm-danger-color,#d32f2f) 18%, var(--tm-header-bg))'
                    : '#ffebee';
                list0.forEach(t => {
                    const id = String(t?.id || '').trim();
                    if (id) map.set(id, t);
                });
                const childrenByParent = new Map();
                list0.forEach(t => {
                    const id = String(t?.id || '').trim();
                    const pid = String(t?.parentTaskId || '').trim();
                    if (!id || !pid) return;
                    if (!map.has(pid)) return;
                    if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
                    childrenByParent.get(pid).push(t);
                });
                const roots = list0.filter(t => {
                    const pid = String(t?.parentTaskId || '').trim();
                    return !pid || !map.has(pid);
                });
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
                const getTaskUpdatedTs = (task) => {
                    const ts = __tmParseTimeToTs(task?.updated || task?.updatedAt || '');
                    return Number.isFinite(ts) ? ts : 0;
                };
                const compareByUpdatedDesc = (a, b) => {
                    const tsDiff = getTaskUpdatedTs(b) - getTaskUpdatedTs(a);
                    if (tsDiff !== 0) return tsDiff;
                    return sortByIdx(a, b);
                };
                roots.sort(needDocFlowForKanban ? compareRootByDocFlow : sortByIdx);
                childrenByParent.forEach(arr => arr.sort(needDocFlowForKanban ? compareChildByDocFlow : sortByIdx));

                const renderTree = (task, depthInCol, inheritedHideCompleted = false) => {
                    const id = String(task?.id || '').trim();
                    const pid = String(task?.parentTaskId || '').trim();
                    const parentInCol = !!(pid && map.has(pid));
                    const parent = pid ? state.flatTasks[pid] : null;
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
                    const collapsed = childList.length ? __tmKanbanGetCollapsedSet().has(id) : false;
                    const toggleHtml = childList.length
                        ? `<button class="tm-kanban-toggle" onclick="tmKanbanToggleCollapse('${id}', event)" title="${collapsed ? '展开子任务' : '折叠子任务'}"><svg class="tm-tree-toggle-icon" viewBox="0 0 16 16" width="10" height="10" style="transform:translate(-50%, -50%) rotate(${collapsed ? '0deg' : '90deg'});"><path d="M4.75 3.25l6.5 4.75-6.5 4.75" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`
                        : '';
                    const childrenHtml = (!collapsed && childList.length) ? childList.map(ch => renderTree(ch, depthInCol + 1, hideCompletedDescendants)).join('') : '';
                    const cardHtml = renderCard(
                        task,
                        depthInCol,
                        depthInCol > 0,
                        depthInCol === 0 && !!pid,
                        parentTxt,
                        childrenHtml,
                        toggleHtml,
                        depthInCol === 0 && childList.length > 0
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
                        <div class="tm-kanban-group-title${dropKind ? ' tm-kanban-group-title--droppable' : ''}" onclick="tmToggleGroupCollapse('${escSq(groupKey)}', event)" style="${titleColor ? `color:${titleColor};` : ''}${groupBg ? `background:${groupBg};` : ''}"${dropAttrs}${dropHandlers}>
                            <span style="display:inline-flex;align-items:center;min-width:0;padding-left:${leftIndent};">
                                <span class="tm-group-toggle" style="cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:16px;"><svg class="tm-group-toggle-icon" viewBox="0 0 16 16" width="16" height="16"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                                <span>${titleHtml}</span>
                            </span>
                            <span class="tm-badge tm-badge--count">${Number(count) || 0}</span>
                        </div>
                    `;
                };

                const renderGroupedByDoc = (opt = {}) => {
                    const o = (opt && typeof opt === 'object') ? opt : {};
                    const showDocTitle = !o.hideDocTitle; // 是否显示文档标题行
                    const headingIndent = o.headingMode ? 0 : 2; // 标题模式下二级标题不缩进，非标题模式下缩进2字符
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
                        // 自定义渲染置顶分组标题
                        const pinnedTitle = `
                            <div class="tm-kanban-group-title" onclick="tmToggleGroupCollapse('${escSq(pinnedGroupKey)}', event)" style="background:${pinnedGroupBg};">
                                <span style="display:inline-flex;align-items:center;min-width:0;">
                                    <span class="tm-group-toggle" style="cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:16px;color:var(--tm-text-color);"><svg class="tm-group-toggle-icon" viewBox="0 0 16 16" width="16" height="16"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                                    <span style="color:var(--tm-text-color);">📌 置顶</span>
                                </span>
                                <span class="tm-badge tm-badge--count">${allPinned.length}</span>
                            </div>
                        `;
                        resultHtml += `<div class="tm-kanban-group">${pinnedTitle}${pinnedBody}</div>`;
                    }
                    // 对非置顶任务按文档分组
                    const rootByDoc = new Map();
                    const countByDoc = new Map();
                    list0.forEach(t => {
                        if (isPinned(t)) return; // 跳过置顶任务
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
                        const isCollapsed = state.collapsedGroups?.has(groupKey);
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
                                    // 添加置顶分组
                                    const pinnedBody = `<div class="tm-kanban-group-items">${pinnedItems.map(t => renderTree(t, 0)).join('')}</div>`;
                                    bodyContent += `<div class="tm-kanban-group"><div class="tm-kanban-group-title" style="color:var(--tm-primary-color);">📌 置顶</div>${pinnedBody}</div>`;
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
                        const dropOpt = (SettingsStore.data.kanbanHeadingGroupMode && isAllTabsView && o.dropDoc && docId !== '__unknown__')
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
                        // 自定义渲染置顶分组标题
                        const pinnedTitle = `
                            <div class="tm-kanban-group-title" onclick="tmToggleGroupCollapse('${escSq(pinnedGroupKey)}', event)" style="background:${pinnedGroupBg};">
                                <span style="display:inline-flex;align-items:center;min-width:0;">
                                    <span class="tm-group-toggle" style="cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:16px;color:var(--tm-text-color);"><svg class="tm-group-toggle-icon" viewBox="0 0 16 16" width="16" height="16"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                                    <span style="color:var(--tm-text-color);">📌 置顶</span>
                                </span>
                                <span class="tm-badge tm-badge--count">${allPinned.length}</span>
                            </div>
                        `;
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
                        // 自定义渲染置顶分组标题
                        const pinnedTitle = `
                            <div class="tm-kanban-group-title" onclick="tmToggleGroupCollapse('${escSq(pinnedGroupKey)}', event)" style="background:${pinnedGroupBg};">
                                <span style="display:inline-flex;align-items:center;min-width:0;">
                                    <span class="tm-group-toggle" style="cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:16px;color:var(--tm-text-color);"><svg class="tm-group-toggle-icon" viewBox="0 0 16 16" width="16" height="16"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                                    <span style="color:var(--tm-text-color);">📌 置顶</span>
                                </span>
                                <span class="tm-badge tm-badge--count">${allPinned.length}</span>
                            </div>
                        `;
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
                        // 自定义渲染置顶分组标题
                        const pinnedTitle = `
                            <div class="tm-kanban-group-title" onclick="tmToggleGroupCollapse('${escSq(pinnedGroupKey)}', event)" style="background:${pinnedGroupBg};">
                                <span style="display:inline-flex;align-items:center;min-width:0;">
                                    <span class="tm-group-toggle" style="cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:16px;color:var(--tm-text-color);"><svg class="tm-group-toggle-icon" viewBox="0 0 16 16" width="16" height="16"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                                    <span style="color:var(--tm-text-color);">📌 置顶</span>
                                </span>
                                <span class="tm-badge tm-badge--count">${allPinned.length}</span>
                            </div>
                        `;
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
                const isDoneCol = String(c?.id || '').trim() === '__done__';
                // 辅助函数：检查任务是否被置顶
                const isPinned = (t) => {
                    const p = t.pinned;
                    return p === true || p === 'true' || p === '1';
                };
                const renderDoneColumnList = () => {
                    const items = list0.slice().sort(compareByUpdatedDesc);
                    return items.map((task) => {
                        const id = String(task?.id || '').trim();
                        if (!id) return '';
                        const pid = String(task?.parentTaskId || '').trim();
                        const parent = pid ? state.flatTasks?.[pid] : null;
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
                        // 自定义渲染置顶分组标题
                        const pinnedTitle = `
                            <div class="tm-kanban-group-title" onclick="tmToggleGroupCollapse('${escSq(pinnedGroupKey)}', event)" style="background:${pinnedGroupBg};">
                                <span style="display:inline-flex;align-items:center;min-width:0;">
                                    <span class="tm-group-toggle" style="cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:16px;color:var(--tm-text-color);"><svg class="tm-group-toggle-icon" viewBox="0 0 16 16" width="16" height="16"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                                    <span style="color:var(--tm-text-color);">📌 置顶</span>
                                </span>
                                <span class="tm-badge tm-badge--count">${allPinned.length}</span>
                            </div>
                        `;
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
                    listHtml = renderGroupedByDoc();
                } else if (state.groupByTaskName) {
                    // 按任务名分组
                    listHtml = renderGroupedByTaskName();
                } else if (state.groupByTime) {
                    listHtml = renderGroupedByTime();
                } else {
                    // 不分组模式
                    listHtml = roots.length ? renderUngroupedWithPinned() : '';
                }
                const count = list0.length;
                const kind = isDoneCol
                    ? 'status'
                    : (headingMode ? (String(c?.kind || '').trim() || (isAllTabsView ? 'doc' : 'heading')) : 'status');
                if (headingMode && !isDoneCol && kind === 'doc' && !String(listHtml || '').trim()) {
                    return '';
                }
                const title = isDoneCol
                    ? '✅ 已完成'
                    : (headingMode
                    ? (kind === 'doc' ? `📄 ${c.name}` : c.name)
                    : (c.id === '__done__' ? '✅ 已完成' : c.id === 'todo' ? `🗂️ ${c.name}` : c.name));
                const dataAttrs = isDoneCol
                    ? `data-kind="status" data-status="__done__"`
                    : (headingMode
                    ? (kind === 'doc'
                        ? `data-kind="doc" data-doc="${esc(String(c?.id || '').trim())}"`
                        : `data-kind="heading" data-doc="${esc(String(c?.docId || '').trim())}" data-heading="${esc(String(c?.headingId || '__none__').trim())}"`)
                    : `data-kind="status" data-status="${esc(c.id)}"`);
                const colHeaderBg = (() => {
                    const rgba = __tmParseCssColorToRgba(String(c?.color || '').trim());
                    if (!rgba) return '';
                    const a = isDark ? 0.30 : 0.20;
                    return `rgba(${Math.round(rgba.r)}, ${Math.round(rgba.g)}, ${Math.round(rgba.b)}, ${a})`;
                })();
                const colTitleColor = String(c?.color || '').trim() || 'var(--tm-text-color)';
                const colStyle = kanbanFillColumns
                    ? `flex:1 0 ${kanbanColW}px;min-width:${kanbanColW}px;max-width:none;`
                    : `width:${kanbanColW}px;min-width:${kanbanColW}px;max-width:${kanbanColW}px;`;
                const docIdForTitle = String(c?.docId || c?.id || '').trim();
                const headingDocId = String(c?.docId || '').trim();
                const headingIdForCreate = String(c?.headingId || '__none__').trim() || '__none__';
                const statusIdForCreate = String(c?.id || '').trim();
                const statusDocIdForCreate = (!headingMode && !isAllTabsView)
                    ? String(state.activeDocId || '').trim()
                    : '';
                const canOpenDocFromTitle = headingMode && !isDoneCol && kind === 'doc' && docIdForTitle && docIdForTitle !== '__unknown__';
                const canQuickAddToDoc = headingMode && isAllTabsView && !isDoneCol && kind === 'doc' && docIdForTitle && docIdForTitle !== '__unknown__';
                const canCreateInHeading = headingMode && !isAllTabsView && !isDoneCol && kind === 'heading' && !!headingDocId;
                const canQuickAddToStatus = !headingMode && !isDoneCol && !!statusIdForCreate;
                const titleContentHtml = headingMode && !isDoneCol && kind === 'doc'
                    ? `${__tmRenderDocIcon(docIdForTitle, { fallbackText: '📄', size: 14 })}<span>${esc(String(c?.name || ''))}</span>`
                    : (headingMode && !isDoneCol && kind === 'heading'
                        ? `${__tmRenderHeadingLevelInlineIcon(c?.headingLevel || SettingsStore.data.taskHeadingLevel || 'h2', { size: 14 })}<span>${esc(String(c?.name || ''))}</span>`
                        : esc(title));
                const titleHtml = canOpenDocFromTitle
                    ? `<button type="button" class="tm-kanban-col-title tm-kanban-col-title--link" style="color:${esc(colTitleColor)};" title="点击跳转至文档：${esc(c.name)}" onclick="event.preventDefault();event.stopPropagation();tmOpenDocById('${escSq(docIdForTitle)}');">${titleContentHtml}</button>`
                    : `<div class="tm-kanban-col-title" style="color:${esc(colTitleColor)};" title="${esc(c.name)}">${titleContentHtml}</div>`;
                const headerActionsHtml = `
                    <div class="tm-kanban-col-header-actions" onclick="event.stopPropagation()">
                        ${canQuickAddToDoc
                            ? `<button class="tm-group-create-btn tm-whiteboard-stream-doc-add-btn"
                                       type="button"
                                       title="新建任务"
                                       aria-label="新建任务"
                                       onpointerdown="event.stopPropagation()"
                                       onclick="event.preventDefault();event.stopPropagation();tmQuickAddOpenForDoc('${escSq(docIdForTitle)}');">
                                    ${__tmRenderLucideIcon('plus')}
                                </button>`
                            : ''}
                        ${canQuickAddToStatus
                            ? `<button class="tm-group-create-btn tm-whiteboard-stream-doc-add-btn"
                                       type="button"
                                       title="新建任务"
                                       aria-label="新建任务"
                                       onpointerdown="event.stopPropagation()"
                                       onclick="event.preventDefault();event.stopPropagation();tmQuickAddOpenForPreset('${escSq(statusDocIdForCreate)}','${escSq(statusIdForCreate)}');">
                                    ${__tmRenderLucideIcon('plus')}
                                </button>`
                            : ''}
                        ${canCreateInHeading
                            ? `<button class="tm-group-create-btn"
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
                        <span class="tm-badge tm-badge--count">${count}</span>
                    </div>
                `;
                return `
                    <div class="tm-kanban-col" ${dataAttrs} style="${colStyle}">
                        <div class="tm-kanban-col-header" style="${colHeaderBg ? `background:${colHeaderBg};` : ''}">
                            ${titleHtml}
                            ${headerActionsHtml}
                        </div>
                        <div class="tm-kanban-col-body" ondragover="tmKanbanDragOver(event)" ondragleave="tmKanbanDragLeave(event)" ondrop="tmKanbanDrop(event)">
                            ${listHtml || `<div style="color:var(--tm-secondary-text);font-size:12px;padding:8px 4px;">空</div>`}
                        </div>
                    </div>
                `;
            }).join('');
            __tmKanbanColsHtmlCache = { key: kanbanColsCacheKey, html: colsHtml };

            return `
                <div class="tm-body tm-body--kanban${bodyAnimClass}${isCompact ? ' tm-body--kanban-compact' : ''}" ondragover="tmKanbanAutoScroll(event)">
                    <div class="tm-kanban${isCompact ? ' tm-kanban--compact' : ''}${kanbanFillColumns ? ' tm-kanban--fill' : ''}">
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
