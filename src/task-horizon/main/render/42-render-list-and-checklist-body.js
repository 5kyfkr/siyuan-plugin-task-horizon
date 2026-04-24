    function __tmBuildRenderSceneListBodyHtml(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const bodyAnimClass = String(opts.bodyAnimClass || '');
        const tableAvailableWidth = Number.isFinite(Number(opts.tableAvailableWidth))
            ? Number(opts.tableAvailableWidth)
            : (Number(state.tableAvailableWidth) || 0);

    const __tmRenderListBodyHtml = () => `
                ${(() => {
                    const renderContext = __tmBuildListRenderContext({ tableAvailableWidth });
                    return `
                <div class="tm-list-pane">
                    <div class="tm-body tm-body--list${bodyAnimClass}">
                    <table class="tm-table" id="tmTaskTable" style="${renderContext.tableLayout.tableStyle}">
                        <thead>
                            <tr>
                                ${renderContext.colOrder.map((col) => __tmBuildTableHeaderCellHtml(col, renderContext.tableLayout)).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${renderTaskList(renderContext)}
                        </tbody>
                    </table>
                    </div>
                    <div class="tm-table-scrollbar"><div class="tm-table-scrollbar-thumb"></div></div>
                </div>
                    `;
                })()}
            `;


        return __tmRenderListBodyHtml();
    }

    function __tmBuildRenderSceneChecklistBodyHtml(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const bodyAnimClass = String(opts.bodyAnimClass || '');

        function __tmRenderChecklistBodyHtml() {
            const rowModel = __tmBuildTaskRowModel();
            const checklistVirtualThreshold = 50;
            const checklistVirtualEnabled = Array.isArray(state.filteredTasks) && state.filteredTasks.length > checklistVirtualThreshold;
            const checklistStep = Math.max(100, Math.min(1200, Number(state.listRenderStep) || 100));
            const checklistTaskLimit = checklistVirtualEnabled
                ? Math.max(checklistStep, Math.min(state.filteredTasks.length, Number(state.listRenderLimit) || checklistStep))
                : Number.POSITIVE_INFINITY;
            let renderedChecklistTaskCount = 0;
            const isDark = __tmIsDarkMode();
            const enableGroupBg = !!SettingsStore.data.enableGroupTaskBgByGroupColor;
            const checklistCompact = !!SettingsStore.data.checklistCompactMode;
            const compactRightFontSize = __tmGetChecklistCompactRightFontSize();
            const compactChecklistMetaFieldSet = checklistCompact
                ? (globalThis.__tmViewPolicy?.getCompactChecklistMetaFieldSetForCurrentHost?.() || new Set(__tmGetCompactChecklistMetaFieldsForCurrentHost()))
                : new Set(__TM_CHECKLIST_COMPACT_META_FIELD_DEFAULTS);
            const wrapCfg = __tmGetWrapConfig();
            const escSq = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const sheetMode = __tmChecklistUseSheetMode();
            const detailWidth = Math.max(260, Math.min(520, Math.round(Number(SettingsStore.data.checklistDetailWidth) || 320)));
            const progressBarColor = isDark
                ? __tmNormalizeHexColor(SettingsStore.data.progressBarColorDark, '#81c784')
                : __tmNormalizeHexColor(SettingsStore.data.progressBarColorLight, '#4caf50');
            const selectedId = String(state.detailTaskId || '').trim();
            const fallbackId = __tmResolveFirstVisibleTaskIdFromRowModel(rowModel);
            const dismissed = !!state.checklistDetailDismissed;
            const activeId = state.flatTasks?.[selectedId]
                ? selectedId
                : ((sheetMode || dismissed) ? '' : fallbackId);
            if (activeId !== selectedId) state.detailTaskId = activeId;
            if (!sheetMode) state.checklistDetailSheetOpen = false;
            let currentGroupBg = '';
            let currentGroupAccent = '';

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

            const resolvePinnedTaskGroupAccentColor = (task) => {
                if (!enableGroupBg || !task) return '';
                if (state.groupByDocName || state.groupByTaskName || (!state.groupByDocName && !state.groupByTime && !state.quadrantEnabled)) {
                    return __tmGetDocColorHex(task.root_id, isDark) || '';
                }
                if (state.groupByTime) {
                    const diffDays = Number(__tmGetTaskTimePriorityInfo(task)?.diffDays);
                    const timeBaseColor = isDark
                        ? __tmNormalizeHexColor(SettingsStore.data.timeGroupBaseColorDark, '#6ba5ff')
                        : __tmNormalizeHexColor(SettingsStore.data.timeGroupBaseColorLight, '#1a73e8');
                    const timeOverdueColor = isDark
                        ? __tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorDark, '#ff6b6b')
                        : __tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorLight, '#d93025');
                    if (!Number.isFinite(diffDays)) return 'var(--tm-secondary-text)';
                    if (diffDays < 0) return timeOverdueColor || 'var(--tm-danger-color)';
                    return __tmWithAlpha(timeBaseColor || 'var(--tm-primary-color)', __tmClamp(1 - diffDays * (isDark ? 0.085 : 0.11), isDark ? 0.52 : 0.42, 1));
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
                            return colorMap[String(rule?.color || '')] || 'var(--tm-text-color)';
                        }
                    }
                }
                return '';
            };

            const renderGroup = (row) => {
                const isCollapsed = !!row?.collapsed;
                const toggle = `<span class="tm-group-toggle" style="cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:16px;color:var(--tm-text-color);">${__tmRenderToggleIcon(16, isCollapsed ? 0 : 90, 'tm-group-toggle-icon')}</span>`;
                const countHtml = Number(row?.count) > 0 ? `<span class="tm-badge tm-badge--count">${Number(row.count) || 0}</span>` : '';
                const durationHtml = String(row?.durationSum || '').trim()
                    ? `<span class="tm-badge tm-badge--duration"><span class="tm-badge__icon">${__tmRenderBadgeIcon('chart-column')}</span>${esc(String(row.durationSum || '').trim())}</span>`
                    : '';
                const pinnedIconHtml = row.kind === 'pinned'
                    ? `<span class="tm-checklist-group-pin-icon">${__tmRenderBadgeIcon('pin', 14)}</span>`
                    : '';
                let labelColor = 'var(--tm-text-color)';
                if (row.kind === 'doc') labelColor = String(row.labelColor || 'var(--tm-group-doc-label-color)');
                else if (row.kind === 'task') labelColor = String(row.labelColor || 'var(--tm-primary-color)');
                else if (row.kind === 'time') labelColor = String(row.labelColor || 'var(--tm-text-color)');
                else if (row.kind === 'pinned') labelColor = 'var(--tm-warning-color)';
                else if (row.kind === 'normal') labelColor = 'var(--tm-text-color)';
                else if (row.kind === 'quadrant') {
                    const colorMap = { red: 'var(--tm-quadrant-red)', yellow: 'var(--tm-quadrant-yellow)', blue: 'var(--tm-quadrant-blue)', green: 'var(--tm-quadrant-green)' };
                    labelColor = colorMap[String(row.color || '')] || 'var(--tm-text-color)';
                } else if (row.kind === 'h2') {
                    labelColor = String(row.labelColor || __tmGetHeadingSubgroupLabelColor('var(--tm-group-doc-label-color)', isDark));
                }
                if (row.kind === 'task' && row.groupDocColor) {
                    currentGroupBg = enableGroupBg ? (__tmGroupBgFromLabelColor(row.groupDocColor, isDark) || '') : '';
                    currentGroupAccent = String(row.groupDocColor || labelColor || '');
                } else if (row.kind === 'pinned') {
                    currentGroupBg = '';
                    currentGroupAccent = 'var(--tm-danger-color)';
                } else if (row.kind === 'normal') {
                    currentGroupBg = '';
                    currentGroupAccent = 'transparent';
                } else if (row.kind === 'h2' && state.groupByDocName) {
                    // 文档分组下的标题子分组沿用文档组背景，不要被标题标签颜色覆盖。
                } else {
                    currentGroupBg = enableGroupBg ? (__tmGroupBgFromLabelColor(labelColor, isDark) || '') : '';
                    currentGroupAccent = String(labelColor || '');
                }
                const createBtnHtml = (row.kind === 'h2' && state.groupByDocName)
                    ? __tmBuildHeadingGroupCreateBtnHtml(row.docId, row.headingId, '在该标题下新建任务')
                    : '';
                const labelHtml = row.kind === 'doc'
                    ? __tmRenderDocGroupLabel(row.docId || row.id, row.label || '')
                    : (row.kind === 'h2'
                        ? __tmRenderHeadingLevelIconLabel(row.label || '', row.headingLevel || SettingsStore.data.taskHeadingLevel || 'h2')
                        : esc(String(row.label || '')));
                return `
                    <div class="tm-checklist-group ${row.kind === 'doc' ? 'tm-checklist-group--doc' : ''} ${row.kind === 'pinned' ? 'tm-checklist-group--pinned' : ''} ${row.kind === 'task' ? 'tm-checklist-group--task' : ''} ${row.kind === 'h2' ? 'tm-checklist-group--h2' : ''} ${row.kind === 'time' ? 'tm-checklist-group--time' : ''} ${row.kind === 'quadrant' ? 'tm-checklist-group--quadrant' : ''} ${isCollapsed ? 'tm-checklist-group--collapsed' : ''}" data-group-key="${esc(String(row.key || ''))}" onclick="tmToggleGroupCollapse('${escSq(String(row.key || ''))}', event)">
                        ${toggle}
                        ${pinnedIconHtml}
                        <span class="tm-checklist-group-label" style="color:${labelColor};">${labelHtml}</span>
                        ${createBtnHtml}
                        ${countHtml}
                        ${durationHtml}
                    </div>
                `;
            };

            const renderTask = (row) => {
                const task = state.flatTasks?.[String(row?.id || '').trim()];
                if (!task) return '';
                const isMultiSelected = __tmIsTaskMultiSelected(task.id);
                if ((state.groupByTaskName || (!state.groupByDocName && !state.groupByTime && !state.quadrantEnabled)) && task.root_id) {
                    const taskDocColor = __tmGetDocColorHex(task.root_id, isDark) || '';
                    currentGroupBg = (enableGroupBg && taskDocColor) ? (__tmGroupBgFromLabelColor(taskDocColor, isDark) || '') : '';
                    currentGroupAccent = taskDocColor || '';
                }
                const depth = Math.max(0, Number(row?.depth) || 0);
                const hasChildren = !!row?.hasChildren;
                const collapsed = !!row?.collapsed;
                const allChildren = Array.isArray(task.children) ? task.children : [];
                const totalChildren = allChildren.length;
                const completedChildren = allChildren.filter((child) => child?.done).length;
                const progressPercent = totalChildren > 0 ? Math.round((completedChildren / totalChildren) * 100) : 0;
                const resolvedGroupBg = currentGroupBg || resolvePinnedTaskGroupBg(task);
                const resolvedGroupAccent = currentGroupAccent || resolvePinnedTaskGroupAccentColor(task);
                const baseBg = checklistCompact
                    ? ''
                    : (resolvedGroupBg ? `background-color:${resolvedGroupBg};` : '');
                const accentStyle = checklistCompact && resolvedGroupAccent
                    ? `--tm-checklist-accent-color:${resolvedGroupAccent};`
                    : '';
                const progressBg = progressPercent > 0
                    ? (checklistCompact
                        ? `--tm-checklist-progress-color:${progressBarColor};--tm-checklist-progress-percent:${progressPercent}%;`
                        : `background-image:linear-gradient(90deg, ${progressBarColor} ${progressPercent}%, transparent ${progressPercent}%);background-repeat:no-repeat;background-size:100% 3px;background-position:left bottom;`)
                    : '';
                const tomatoFocusTaskId = SettingsStore.data.enableTomatoIntegration ? String(state.timerFocusTaskId || '').trim() : '';
                const tomatoFocusModeEnabled = __tmIsTomatoFocusModeEnabled();
                const timerCls = tomatoFocusTaskId
                    ? (tomatoFocusTaskId === String(task.id)
                        ? ' tm-timer-focus'
                        : (tomatoFocusModeEnabled ? ' tm-timer-dim' : ''))
                    : '';
                const multiSelectCls = isMultiSelected ? ' tm-task-row--multi-selected' : '';
                const activeCls = String(task.id) === activeId ? ' tm-checklist-item--active' : '';
                const doneCls = task.done ? ' tm-checklist-item--done' : '';
                const reminderHtml = __tmHasReminderMark(task) ? __tmRenderReminderIcon() : '';
                const remarkIconHtml = __tmRenderRemarkIcon(task.remark);
                const statusOptions = __tmGetStatusOptions(SettingsStore.data.customStatusOptions || []);
                const statusOption = __tmResolveTaskStatusDisplayOption(task, statusOptions, { fallbackColor: '#757575' });
                const statusChipStyle = __tmBuildStatusChipStyle(statusOption.color);
                const indent = checklistCompact ? depth * 14 : depth * 22;
                const showTaskDocName = globalThis.__tmViewPolicy?.shouldShowCompactChecklistDocName?.() ?? __tmShouldShowCompactChecklistDocName();
                const isAllTabsView = !(state.activeDocId && state.activeDocId !== 'all');
                const showCompactDocName = checklistCompact && isAllTabsView && compactChecklistMetaFieldSet.has('docName') && !!task.docName;
                const showCompactStartDate = checklistCompact && compactChecklistMetaFieldSet.has('startDate') && !!task.startDate;
                const showCompactCompletionTime = checklistCompact && compactChecklistMetaFieldSet.has('completionTime') && !!task.completionTime;
                const compactRemainingTimeLabel = checklistCompact && compactChecklistMetaFieldSet.has('remainingTime')
                    ? String(__tmGetTaskRemainingTimeLabel(task) || '').trim()
                    : '';
                const showCompactRemainingTime = !!compactRemainingTimeLabel && !!(String(task?.startDate || '').trim() || String(task?.completionTime || '').trim());
                const compactDurationText = checklistCompact && compactChecklistMetaFieldSet.has('duration')
                    ? String(task.duration || '').trim()
                    : '';
                const showCompactDuration = !!compactDurationText;
                const showCompactStatusTag = !checklistCompact || compactChecklistMetaFieldSet.has('status');
                const meta = [];
                const priorityIcon = __tmRenderPriorityJira(task.priority, false);
                if (showTaskDocName && task.docName) meta.push(`<span class="tm-checklist-meta-chip">${__tmRenderLucideIcon('file-text')} ${esc(String(task.docName || ''))}</span>`);
                if (task.h2) meta.push(`<span class="tm-checklist-meta-chip">${__tmRenderHeadingLevelInlineIcon(task.headingLevel || SettingsStore.data.taskHeadingLevel || 'h2', { size: 14 })} ${esc(__tmNormalizeHeadingText(task.h2))}</span>`);
                if (String(task.priority || '').trim() && String(task.priority || '').trim() !== 'none') meta.push(`<span class="tm-checklist-meta-chip" data-tm-field="priority">${priorityIcon}</span>`);
                if (task.completionTime) meta.push(`<span class="tm-checklist-meta-chip" data-tm-task-time-field="completionTime">${esc(__tmFormatTaskTime(task.completionTime))}</span>`);
                if (task.duration) meta.push(`<span class="tm-checklist-meta-chip" data-tm-task-time-field="duration">${__tmRenderLucideIcon('timer')} ${esc(String(task.duration || ''))}</span>`);
                if (totalChildren > 0) meta.push(`<span class="tm-checklist-meta-chip">子任务 ${completedChildren}/${totalChildren}</span>`);
                const compactMetaParts = [];
                if (showCompactDocName) compactMetaParts.push(`<span class="tm-checklist-meta-compact-doc">${esc(String(task.docName || ''))}</span>`);
                if (showCompactStartDate) compactMetaParts.push(`<span class="tm-checklist-meta-compact-start" data-tm-task-time-field="startDateCompact">${esc(__tmFormatTaskTimeCompact(task.startDate))}</span>`);
                if (showCompactCompletionTime) compactMetaParts.push(`<span class="tm-checklist-meta-compact-time" data-tm-task-time-field="completionTimeCompact">${esc(__tmFormatTaskTimeCompact(task.completionTime))}</span>`);
                if (showCompactRemainingTime) compactMetaParts.push(`<span class="tm-checklist-meta-compact-remaining" data-tm-task-time-field="remainingTimeCompact">${esc(compactRemainingTimeLabel)}</span>`);
                if (showCompactDuration) compactMetaParts.push(`<span class="tm-checklist-meta-compact-duration" data-tm-task-time-field="durationCompact">${esc(compactDurationText)}</span>`);
                const hasCompactMeta = compactMetaParts.length > 0;
                const compactMeta = hasCompactMeta
                    ? `<div class="tm-checklist-meta-compact">${compactMetaParts.join('')}</div>`
                    : '';
                const titleRowClass = `tm-checklist-title-row${hasChildren ? ' tm-checklist-title-row--has-children' : ''}${hasCompactMeta ? ' tm-checklist-title-row--has-compact-meta' : ''}`;
                const itemIndentStyle = checklistCompact
                    ? `--tm-checklist-compact-indent:${indent}px;`
                    : `margin-left:${indent}px;`;
                const useDesktopTaskDragLogic = __tmShouldUseDesktopTaskDragLogic();
                const itemDragAttrs = `draggable="true" ondragstart="tmDragTaskStart(event, '${escSq(String(task.id || ''))}')" ondragend="tmDragTaskEnd(event)"`;
                const titleDragAttrs = '';
                const itemContextMenuAttr = useDesktopTaskDragLogic
                    ? `oncontextmenu="tmShowTaskContextMenu(event, '${escSq(String(task.id || ''))}')"`
                    : 'oncontextmenu="event.preventDefault();event.stopPropagation();return false;"';
                const touchDragAttr = __tmShouldUseBrowserTouchTaskDrag()
                    ? `onpointerdown="tmTaskTouchDragStart(event, '${escSq(String(task.id || ''))}')"`
                    : '';
                renderedChecklistTaskCount += 1;
                return `
                    <div class="tm-checklist-item${activeCls}${doneCls}${timerCls}${multiSelectCls}" data-id="${esc(String(task.id || ''))}" data-depth="${depth}" ${itemDragAttrs} ondragenter="tmTaskRowDragOver(event, '${escSq(String(task.id || ''))}')" ondragover="tmTaskRowDragOver(event, '${escSq(String(task.id || ''))}')" ondragleave="tmTaskRowDragLeave(event, '${escSq(String(task.id || ''))}')" ondrop="tmTaskRowDrop(event, '${escSq(String(task.id || ''))}')" ${touchDragAttr} style="${itemIndentStyle}${accentStyle}${baseBg}${progressBg}" onclick="tmChecklistSelectTask('${escSq(String(task.id || ''))}', event)" ${itemContextMenuAttr}>
                        <div class="tm-checklist-leading${hasChildren ? ' tm-checklist-leading--branch' : ''}${hasChildren && collapsed ? ' tm-checklist-leading--collapsed' : ''}">
                            ${hasChildren ? `<span class="tm-tree-toggle" onclick="tmToggleCollapse('${escSq(String(task.id || ''))}', event)" style="opacity:1;pointer-events:auto;color:var(--tm-text-color);">${__tmRenderToggleIcon(16, collapsed ? 0 : 90, 'tm-tree-toggle-icon')}</span>` : '<span class="tm-tree-toggle tm-tree-toggle--placeholder" aria-hidden="true"></span>'}
                            ${hasChildren && collapsed ? '<span class="tm-task-leading-ring" aria-hidden="true"></span>' : ''}
                            ${__tmRenderTaskCheckbox(String(task.id || ''), task, { checked: task.done, extraClass: GlobalLock.isLocked() ? 'tm-operating' : '', stopMouseDown: true, stopPointerDown: true, stopClick: true })}
                        </div>
                        <div class="tm-checklist-item-main">
                            <div class="${titleRowClass}">
                                <div class="tm-checklist-title-main"><div class="tm-checklist-title"><span class="tm-checklist-title-button"><span ${titleDragAttrs} onclick="tmChecklistTitleClick('${escSq(String(task.id || ''))}', event)"${__tmBuildTooltipAttrs(String(task.content || '').trim() || '(无内容)', { side: 'bottom', ariaLabel: false })}>${API.renderTaskContentHtml(task.markdown, String(task.content || '').trim() || '(无内容)')}${__tmRenderRecurringTaskInlineIcon(task)}${__tmRenderRecurringInstanceBadge(task, { className: 'tm-recurring-instance-badge--inline' })}</span></span>${reminderHtml}<span data-tm-field="remarkIcon">${remarkIconHtml}</span></div></div>
                                ${compactMeta}
                                ${showCompactStatusTag ? `<span class="tm-status-tag" data-tm-field="status" style="${statusChipStyle}">${esc(String(statusOption?.name || statusOption?.id || ''))}</span>` : ''}
                                ${task.pinned ? `<span class="tm-checklist-meta-chip" data-tm-field="pinned" title="置顶">${__tmRenderLucideIcon('pin')}</span>` : ''}
                                ${hasChildren ? `<span class="tm-checklist-mobile-toggle" onclick="tmToggleCollapse('${escSq(String(task.id || ''))}', event)" style="opacity:1;pointer-events:auto;">${__tmRenderToggleIcon(16, collapsed ? 0 : 90, 'tm-tree-toggle-icon')}</span>` : ''}
                            </div>
                            ${meta.length ? `<div class="tm-checklist-meta">${meta.join('')}</div>` : ''}
                        </div>
                    </div>
                `;
            };

            const renderDropGap = (row) => {
                const targetTaskId = String(row?.targetTaskId || '').trim();
                const dropKind = String(row?.kind || 'child').trim() || 'child';
                const depth = Math.max(0, Number(row?.depth) || 0);
                if (!targetTaskId) return '';
                return `<div class="tm-task-drop-gap" data-drop-kind="${esc(dropKind)}" data-target-task-id="${esc(targetTaskId)}" data-depth="${depth}" ondragenter="tmTaskRowDragOver(event, '${escSq(targetTaskId)}', '${escSq(dropKind)}')" ondragover="tmTaskRowDragOver(event, '${escSq(targetTaskId)}', '${escSq(dropKind)}')" ondragleave="tmTaskRowDragLeave(event)" ondrop="tmTaskRowDrop(event, '${escSq(targetTaskId)}', '${escSq(dropKind)}')"></div>`;
            };

            const items = [];
            let compactGroupCard = null;
            const flushCompactGroupCard = () => {
                if (!compactGroupCard) return;
                const cardClasses = [
                    'tm-checklist-group-card',
                    `tm-checklist-group-card--${compactGroupCard.kind || 'default'}`,
                    compactGroupCard.children.length ? '' : 'tm-checklist-group-card--collapsed',
                ].filter(Boolean).join(' ');
                const cardStyle = [];
                if (compactGroupCard.accent) cardStyle.push(`--tm-checklist-card-accent:${compactGroupCard.accent};`);
                if (compactGroupCard.groupBg) cardStyle.push(`--tm-checklist-card-group-bg:${compactGroupCard.groupBg};`);
                const cardBodyHtml = compactGroupCard.children.length
                    ? `<div class="tm-checklist-group-card-items">${compactGroupCard.children.join('')}</div>`
                    : '';
                items.push(`<section class="${cardClasses}"${cardStyle.length ? ` style="${cardStyle.join('')}"` : ''}>${compactGroupCard.header}${cardBodyHtml}</section>`);
                compactGroupCard = null;
            };
            for (const row of rowModel) {
                if (row?.type === 'group') {
                    if (renderedChecklistTaskCount >= checklistTaskLimit) break;
                    const groupHtml = renderGroup(row);
                    if (checklistCompact && row.kind !== 'h2') {
                        flushCompactGroupCard();
                        compactGroupCard = {
                            kind: String(row.kind || 'default'),
                            accent: String(currentGroupAccent || '').trim(),
                            groupBg: String(currentGroupBg || '').trim(),
                            header: groupHtml,
                            children: [],
                        };
                        continue;
                    }
                    if (checklistCompact && row.kind === 'h2' && compactGroupCard) {
                        compactGroupCard.children.push(groupHtml);
                        continue;
                    }
                    flushCompactGroupCard();
                    items.push(groupHtml);
                    continue;
                }
                if (row?.type === 'drop-gap') {
                    const gapHtml = renderDropGap(row);
                    if (!gapHtml) continue;
                    if (checklistCompact && compactGroupCard) compactGroupCard.children.push(gapHtml);
                    else items.push(gapHtml);
                    continue;
                }
                if (renderedChecklistTaskCount >= checklistTaskLimit) break;
                const html = renderTask(row);
                if (!html) continue;
                if (checklistCompact && compactGroupCard) compactGroupCard.children.push(html);
                else items.push(html);
            }
            flushCompactGroupCard();
            const itemsHtml = items.join('');
            const totalChecklistTaskCount = rowModel.reduce((acc, row) => (row?.type === 'task' ? acc + 1 : acc), 0);
            const checklistRemain = (checklistVirtualEnabled && renderedChecklistTaskCount >= checklistTaskLimit)
                ? Math.max(0, totalChecklistTaskCount - renderedChecklistTaskCount)
                : 0;
            const checklistLoadMoreHtml = checklistRemain > 0
                ? `<div class="tm-checklist-load-more" style="padding:10px 0;text-align:center;"><button type="button" class="tm-btn tm-btn-secondary" onclick="tmListLoadMoreRows(event)">继续加载</button></div>`
                : '';
            const detailTask = activeId ? (state.flatTasks?.[activeId] || null) : null;
            const detailHtml = detailTask
                ? __tmBuildTaskDetailInnerHtml(detailTask, { embedded: true, closeable: true })
                : `<div class="tm-checklist-empty-detail">选择左侧任务后，这里会显示可编辑的详情。</div>`;
            return `
                <div class="tm-body${bodyAnimClass} tm-body--checklist">
                    <div class="tm-checklist-layout">
                        <div class="tm-checklist-pane${checklistCompact ? ` tm-checklist-pane--compact tm-checklist-pane--right-font-${compactRightFontSize}` : ''}${wrapCfg.enabled ? ' tm-checklist-pane--wrap' : ''}${state.groupByDocName ? ' tm-checklist-pane--group-doc' : ''}">
                            <div class="tm-checklist-scroll">
                                <div class="tm-checklist-items">${itemsHtml || `<div class="tm-checklist-empty-detail">暂无任务</div>`}${checklistLoadMoreHtml}</div>
                            </div>
                            <div class="tm-checklist-scrollbar"><div class="tm-checklist-scrollbar-thumb"></div></div>
                        </div>
                        ${sheetMode
                            ? `<div id="tmChecklistSheetBackdrop" class="tm-checklist-sheet-backdrop ${state.checklistDetailSheetOpen && detailTask ? 'tm-checklist-sheet-backdrop--open' : ''}" onclick="tmChecklistCloseSheet(event)"></div>
                        <div id="tmChecklistSheet" class="tm-checklist-sheet ${state.checklistDetailSheetOpen && detailTask ? 'tm-checklist-sheet--open' : ''}" onpointerdown="tmChecklistSheetDragStart(event)">
                            <div class="tm-checklist-sheet-handle"></div>
                            <div class="tm-checklist-sheet-body" id="tmChecklistSheetPanel">${detailHtml}</div>
                        </div>`
                            : `<div class="tm-checklist-resizer" onmousedown="tmStartChecklistDetailResize(event)" title="拖拽调整详情宽度"></div>
                        <aside class="tm-checklist-side" style="width:${detailWidth}px;min-width:${detailWidth}px;flex-basis:${detailWidth}px;">
                            <div class="tm-checklist-detail-wrap" id="tmChecklistDetailPanel">${detailHtml}</div>
                        </aside>`}
                    </div>
                </div>
            `;
        }


        return __tmRenderChecklistBodyHtml();
    }
