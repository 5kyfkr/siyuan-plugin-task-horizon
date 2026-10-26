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
        const taskBranchId = String(opts.taskBranchId || '').trim();
        const fragmentStartTaskCount = Number.isFinite(Number(opts.fragmentStartTaskCount))
            ? Math.max(0, Math.round(Number(opts.fragmentStartTaskCount)))
            : 0;
        const fragmentEndTaskCount = Number.isFinite(Number(opts.fragmentEndTaskCount))
            ? Math.max(fragmentStartTaskCount, Math.round(Number(opts.fragmentEndTaskCount)))
            : 0;
        const renderWindowFragment = opts.fragmentOnly === true
            && !taskBranchId
            && fragmentEndTaskCount > fragmentStartTaskCount;

        function __tmRenderChecklistBodyHtml() {
            const initialChecklistTaskLimit = (() => {
                if (taskBranchId) return Number.POSITIVE_INFINITY;
                if (renderWindowFragment) return fragmentEndTaskCount;
                const total = Array.isArray(state.filteredTasks) ? state.filteredTasks.length : 0;
                const threshold = state.__tmSnapshotFirstRenderLimitMode ? 0 : 50;
                if (total <= threshold) return Number.POSITIVE_INFINITY;
                const step = Math.max(20, Math.min(1200, Number(state.listRenderStep) || 20));
                return Math.max(step, Math.min(total, Number(state.listRenderLimit) || step));
            })();
            // One extra visible row tells us whether another batch exists.
            // filteredTasks also includes tasks hidden by collapsed branches.
            const rowModel = __tmBuildTaskRowModel({
                maxTaskRows: initialChecklistTaskLimit + 1,
            });
            const visibleTaskRowCount = rowModel.reduce((count, row) => (
                row?.type === 'task' ? count + 1 : count
            ), 0);
            let taskBranchRows = null;
            if (taskBranchId) {
                const branchStart = rowModel.findIndex((row) => row?.type === 'task' && String(row?.id || '').trim() === taskBranchId);
                if (branchStart >= 0) {
                    const branchDepth = Math.max(0, Number(rowModel[branchStart]?.depth) || 0);
                    let branchEnd = branchStart + 1;
                    while (branchEnd < rowModel.length) {
                        const row = rowModel[branchEnd];
                        if (row?.type === 'group') break;
                        if (row?.type === 'task' && Math.max(0, Number(row?.depth) || 0) <= branchDepth) break;
                        branchEnd += 1;
                    }
                    const candidateRows = rowModel.slice(branchStart, branchEnd);
                    const descendantCount = candidateRows.reduce((count, row, index) => (
                        index > 0 && row?.type === 'task' ? count + 1 : count
                    ), 0);
                    const disclosureLimit = Math.max(1, Number(__tmCollapseMotion.config?.maxDisclosureItems) || 24);
                    if (descendantCount > 0 && descendantCount <= disclosureLimit) taskBranchRows = candidateRows;
                }
            }
            const completedTodayKey = __tmNormalizeDateOnly(new Date());
            const filteredTaskById = new Map(
                (Array.isArray(state.filteredTasks) ? state.filteredTasks : [])
                    .map((task) => [String(task?.id || '').trim(), task])
                    .filter(([taskId]) => !!taskId)
            );
            const checklistVirtualThreshold = state.__tmSnapshotFirstRenderLimitMode ? 0 : 50;
            const checklistVirtualEnabled = Array.isArray(state.filteredTasks) && state.filteredTasks.length > checklistVirtualThreshold;
            const checklistStep = Math.max(20, Math.min(1200, Number(state.listRenderStep) || 20));
            const checklistTaskLimit = taskBranchRows
                ? Number.POSITIVE_INFINITY
                : renderWindowFragment
                ? fragmentEndTaskCount
                : checklistVirtualEnabled
                ? Math.max(checklistStep, Math.min(state.filteredTasks.length, Number(state.listRenderLimit) || checklistStep))
                : Number.POSITIVE_INFINITY;
            // Large branch expansions fall back to the bounded full list even
            // though their row model was built without a limit.
            const hasMoreChecklistTaskRows = visibleTaskRowCount > checklistTaskLimit;
            let renderedChecklistTaskCount = 0;
            const isDark = __tmIsDarkMode();
            const enableGroupBg = !!SettingsStore.data.enableGroupTaskBgByGroupColor;
            const checklistFieldsBelow = !SettingsStore.data.checklistCompactMode;
            const checklistCompactTreeGuides = !!SettingsStore.data.checklistCompactTreeGuides;
            const compactRightFontSize = __tmGetChecklistCompactRightFontSize();
            const compactChecklistMetaFieldSet = globalThis.__tmViewPolicy?.getCompactChecklistMetaFieldSetForCurrentHost?.() || new Set(__tmGetCompactChecklistMetaFieldsForCurrentHost());
            const compactChecklistMetaFieldOrder = __tmGetChecklistCompactMetaFieldOrder();
            const compactCustomFieldDefs = __tmGetCustomFieldDefs().filter((field) => {
                const id = String(field?.id || '').trim();
                return id
                    && field?.enabled !== false
                    && String(field?.type || '').trim() !== 'text'
                    && compactChecklistMetaFieldSet.has(`customField:${id}`);
            });
            const wrapCfg = __tmGetWrapConfig();
            const escSq = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const sheetMode = __tmChecklistUseSheetMode();
            const detailWidth = Math.max(260, Math.min(520, Math.round(Number(SettingsStore.data.checklistDetailWidth) || 320)));
            const progressBarColor = __tmGetEffectiveProgressBarColor(isDark);
            const selectedId = String(state.detailTaskId || '').trim();
            const fallbackId = __tmResolveFirstVisibleTaskIdFromRowModel(rowModel);
            const dismissed = !!state.checklistDetailDismissed;
            const resolveChecklistDetailTask = (taskId) => {
                const tid = String(taskId || '').trim();
                if (!tid) return null;
                try {
                    const directTask = typeof __tmGetChecklistDetailTaskById === 'function'
                        ? __tmGetChecklistDetailTaskById(tid, { includePending: true, preferPending: true, includeWhiteboard: true })
                        : globalThis.__tmTaskBoundary?.getTask?.(tid);
                    if (directTask) return directTask;
                    const projectedTask = typeof __tmGetTaskDetailTaskById === 'function'
                        ? __tmGetTaskDetailTaskById(tid, { includePending: true, preferPending: true, includeWhiteboard: true })
                        : null;
                    if (projectedTask) return projectedTask;
                } catch (e) {}
                return globalThis.__tmTaskBoundary?.getTask?.(tid) || null;
            };
            const selectedTask = selectedId
                ? resolveChecklistDetailTask(selectedId)
                : null;
            const activeId = selectedTask
                ? selectedId
                : ((sheetMode || dismissed) ? '' : fallbackId);
            if (activeId !== selectedId) state.detailTaskId = activeId;
            if (!sheetMode) {
                state.checklistDetailSheetOpen = false;
                state.checklistDetailSheetFullscreen = false;
            }
            let currentGroupAccent = '';
            const compactTreeGuidesCache = new Map();
            const getCompactTreeGuidesHtml = (depth) => {
                const depthLevel = Math.max(0, Number(depth) || 0);
                if (!checklistCompactTreeGuides || depthLevel <= 0) return '';
                if (compactTreeGuidesCache.has(depthLevel)) return compactTreeGuidesCache.get(depthLevel);
                const html = `<span class="tm-checklist-tree-guides" aria-hidden="true">${Array.from({ length: depthLevel }, (_, i) => `<span class="tm-checklist-tree-guide-line" style="left:calc(var(--tm-checklist-tree-line-start) + ${i} * var(--tm-checklist-indent-step))"></span>`).join('')}</span>`;
                compactTreeGuidesCache.set(depthLevel, html);
                return html;
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
                const toggle = `<span class="tm-group-toggle" style="cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:16px;color:var(--tm-checklist-parent-toggle-color);">${__tmRenderToggleIcon(16, isCollapsed ? 0 : 90, 'tm-group-toggle-icon')}</span>`;
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
                else if (row.kind === 'pinned') labelColor = 'var(--tm-pinned-color)';
                else if (row.kind === 'done') labelColor = 'var(--tm-secondary-text)';
                else if (row.kind === 'done-doc') labelColor = String(row.labelColor || 'var(--tm-group-doc-label-color)');
                else if (row.kind === 'done-h2') labelColor = String(row.labelColor || __tmGetHeadingSubgroupLabelColor('var(--tm-group-doc-label-color)', isDark));
                else if (row.kind === 'done-date') labelColor = 'var(--tm-secondary-text)';
                else if (row.kind === 'normal') labelColor = 'var(--tm-text-color)';
                else if (row.kind === 'quadrant') {
                    const colorMap = { red: 'var(--tm-quadrant-red)', yellow: 'var(--tm-quadrant-yellow)', blue: 'var(--tm-quadrant-blue)', green: 'var(--tm-quadrant-green)' };
                    labelColor = colorMap[String(row.color || '')] || 'var(--tm-text-color)';
                } else if (row.kind === 'h2') {
                    labelColor = String(row.labelColor || __tmGetHeadingSubgroupLabelColor('var(--tm-group-doc-label-color)', isDark));
                }
                if (row.kind === 'task' && row.groupDocColor) {
                    currentGroupAccent = String(row.groupDocColor || labelColor || '');
                } else if (row.kind === 'pinned') {
                    currentGroupAccent = labelColor;
                } else if (row.kind === 'normal') {
                    currentGroupAccent = 'transparent';
                } else if (row.kind === 'h2' && state.groupByDocName) {
                    // 文档分组下的标题子分组沿用文档组背景，不要被标题标签颜色覆盖。
                } else {
                    currentGroupAccent = String(labelColor || '');
                }
                const createBtnHtml = (row.kind === 'doc' && state.groupByDocName)
                    ? __tmBuildDocGroupQuickAddBtnHtml(row.docId || row.id, '新建任务')
                    : ((row.kind === 'h2' && state.groupByDocName)
                        ? __tmBuildHeadingGroupCreateBtnHtml(row.docId, row.headingId, '在该标题下新建任务')
                        : (row.kind === 'time'
                            ? __tmBuildTimeGroupQuickAddBtnHtml((typeof __tmIsDocTabCustomGroupActiveId === 'function' && __tmIsDocTabCustomGroupActiveId(state.activeDocId)) ? '' : state.activeDocId, row)
                            : ''));
                const labelHtml = row.kind === 'doc' || row.kind === 'done-doc'
                    ? __tmRenderDocGroupLabel(row.docId || row.id, row.label || '', { size: 16 })
                    : (row.kind === 'h2' || row.kind === 'done-h2'
                        ? __tmRenderHeadingLevelIconLabel(row.label || '', row.headingLevel || SettingsStore.data.taskHeadingLevel || 'h2', { size: 16 })
                        : (row.kind === 'time'
                            ? (String(row.labelHtml || '').trim() || esc(String(row.label || '')))
                            : esc(String(row.label || ''))));
                const groupKind = String(row.kind || '').trim();
                const groupKey = String(row.key || '').trim();
                const timeGroupDropAttrs = groupKind === 'time'
                    ? ` ondragenter="tmTimeGroupDragOver(event, '${escSq(groupKey)}')" ondragover="tmTimeGroupDragOver(event, '${escSq(groupKey)}')" ondragleave="tmTimeGroupDragLeave(event)" ondrop="tmTimeGroupDrop(event, '${escSq(groupKey)}')"`
                    : '';
                const docDropId = String(row.docId || row.id || '').trim();
                const headingDropId = String(row.headingId || '').trim();
                const headingContextMenuAttrs = groupKind === 'h2'
                    ? __tmBuildHeadingGroupContextMenuAttrs(docDropId, headingDropId)
                    : '';
                const docHeadingGroupDropAttrs = state.groupByDocName && (groupKind === 'doc' || groupKind === 'h2') && docDropId
                    ? ` data-tm-doc-heading-drop-kind="${groupKind === 'h2' ? 'heading' : 'doc'}" data-tm-doc-heading-drop-doc="${esc(docDropId)}"${groupKind === 'h2' ? ` data-tm-doc-heading-drop-heading="${esc(headingDropId)}" data-tm-doc-heading-drop-label="${esc(__tmNormalizeHeadingText(row.label || ''))}" data-tm-doc-heading-drop-rank="${Number.isFinite(Number(row.h2Rank ?? row.headingRank)) ? Number(row.h2Rank ?? row.headingRank) : ''}"` : ''} ondragenter="tmDocHeadingGroupDragOver(event)" ondragover="tmDocHeadingGroupDragOver(event)" ondragleave="tmDocHeadingGroupDragLeave(event)" ondrop="tmDocHeadingGroupDrop(event)"`
                    : '';
                const completedSubgroup = groupKind.startsWith('done-');
                const completedSubgroupStyle = completedSubgroup ? `padding-left:${Math.max(1, Number(row.groupDepth) || 1)}ch;` : '';
                return `
                    <div class="tm-checklist-group ${row.kind === 'doc' || row.kind === 'done-doc' ? 'tm-checklist-group--doc' : ''} ${row.kind === 'pinned' ? 'tm-checklist-group--pinned' : ''} ${row.kind === 'task' || row.kind === 'done-title' ? 'tm-checklist-group--task' : ''} ${row.kind === 'h2' || row.kind === 'done-h2' ? 'tm-checklist-group--h2' : ''} ${row.kind === 'time' ? 'tm-checklist-group--time' : ''} ${row.kind === 'quadrant' ? 'tm-checklist-group--quadrant' : ''} ${completedSubgroup ? 'tm-checklist-group--completed-subgroup' : ''} ${isCollapsed ? 'tm-checklist-group--collapsed' : ''}" data-group-kind="${esc(groupKind)}" data-group-key="${esc(groupKey)}" style="--tm-checklist-group-accent:${esc(labelColor)};${completedSubgroupStyle}" onclick="tmToggleGroupCollapse('${escSq(groupKey)}', event)"${timeGroupDropAttrs}${docHeadingGroupDropAttrs}${headingContextMenuAttrs}>
                        ${pinnedIconHtml}
                        <span class="tm-checklist-group-label" style="color:${labelColor};">${labelHtml}</span>
                        ${countHtml}
                        ${durationHtml}
                        <span class="tm-checklist-group-controls">${createBtnHtml}${toggle}</span>
                    </div>
                `;
            };

            const renderTask = (row) => {
                const taskId = String(row?.id || '').trim();
                const task = filteredTaskById.get(taskId)
                    || globalThis.__tmTaskBoundary?.getTask?.(taskId);
                if (!task) return '';
                const isMultiSelected = __tmIsTaskMultiSelected(task.id);
                if ((state.groupByTaskName || (!state.groupByDocName && !state.groupByTime && !state.quadrantEnabled)) && task.root_id) {
                    const taskDocColor = __tmGetDocColorHex(task.root_id, isDark) || '';
                    currentGroupAccent = taskDocColor || '';
                }
                const depth = Math.max(0, Number(row?.depth) || 0);
                const treeGuides = getCompactTreeGuidesHtml(depth);
                const hasChildren = !!row?.hasChildren;
                const collapsed = !!row?.collapsed;
                const allChildren = Array.isArray(task.children) ? task.children : [];
                const totalChildren = allChildren.length;
                const completedChildren = allChildren.filter((child) => {
                    try {
                        return typeof __tmIsTaskClosedForDisplay === 'function'
                            ? __tmIsTaskClosedForDisplay(child)
                            : child?.done === true;
                    } catch (e) {
                        return child?.done === true;
                    }
                }).length;
                const progressPercent = totalChildren > 0 ? Math.round((completedChildren / totalChildren) * 100) : 0;
                const resolvedGroupAccent = currentGroupAccent || resolvePinnedTaskGroupAccentColor(task);
                const accentStyle = resolvedGroupAccent
                    ? `--tm-checklist-accent-color:${resolvedGroupAccent};`
                    : '';
                const progressBg = progressPercent > 0
                    ? `--tm-checklist-progress-color:${progressBarColor};--tm-checklist-progress-percent:${progressPercent}%;`
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
                const taskDone = typeof __tmIsTaskClosedForDisplay === 'function'
                    ? !!__tmIsTaskClosedForDisplay(task)
                    : !!task.done;
                const doneCls = taskDone ? ' tm-checklist-item--done' : '';
                const branchLeadingCls = hasChildren ? ' tm-checklist-item--has-branch-leading' : '';
                const reminderHtml = __tmHasReminderMark(task) ? __tmRenderReminderIcon() : '';
                const completedTodayBadgeHtml = __tmRenderCompletedTodayBadge(task, {
                    todayKey: completedTodayKey,
                    inCompletedRootGroup: row?.inCompletedRootGroup === true,
                });
                const compactRemarkHtml = __tmRenderChecklistTaskRemark(task);
                const remarkIconHtml = compactRemarkHtml ? '' : __tmRenderRemarkIcon(task.remark);
                const attachmentIconHtml = __tmRenderTaskAttachmentIcon(task);
                const statusOptions = __tmGetStatusOptions(SettingsStore.data.customStatusOptions || []);
                const statusOption = __tmResolveTaskStatusDisplayOption(task, statusOptions, { fallbackColor: '#757575' });
                const statusChipStyle = __tmBuildStatusChipStyle(statusOption.color);
                const isAllTabsView = !(state.activeDocId && state.activeDocId !== 'all')
                    || (typeof __tmIsDocTabCustomGroupActiveId === 'function' && __tmIsDocTabCustomGroupActiveId(state.activeDocId));
                const showCompactDocName = isAllTabsView && compactChecklistMetaFieldSet.has('docName') && !!task.docName;
                const compactHeadingText = compactChecklistMetaFieldSet.has('h2')
                    ? __tmNormalizeHeadingText(task.h2)
                    : '';
                const displayStartDate = __tmGetTaskDateFieldDisplayValue(task, 'startDate');
                const displayCompletionTime = __tmGetTaskDateFieldDisplayValue(task, 'completionTime');
                const showCompactStartDate = compactChecklistMetaFieldSet.has('startDate') && !!displayStartDate;
                const showCompactCompletionTime = compactChecklistMetaFieldSet.has('completionTime') && !!displayCompletionTime;
                const compactScheduleTime = compactChecklistMetaFieldSet.has('scheduleTime') ? __tmRenderTaskScheduleTimeHtml(task, { compact: true }) : '';
                const compactRemainingTimeInfo = compactChecklistMetaFieldSet.has('remainingTime')
                    ? __tmGetTaskRemainingTimeInfo(task)
                    : null;
                const compactRemainingTimeLabel = String(compactRemainingTimeInfo?.label || '').trim();
                const compactRemainingTimeHtml = compactRemainingTimeLabel
                    ? __tmRenderTaskRemainingTimeInfoHtml(compactRemainingTimeInfo)
                    : '';
                const showCompactRemainingTime = !!compactRemainingTimeLabel
                    && __tmShouldRenderTaskCardRemainingTime(task, showCompactStartDate || showCompactCompletionTime);
                const compactDurationText = compactChecklistMetaFieldSet.has('duration')
                    ? __tmFormatDurationDisplayValue(task.duration || '')
                    : '';
                const showCompactDuration = !!compactDurationText;
                const focusSummaryText = __tmGetTaskTomatoSummaryText(task);
                const focusSummaryHtml = __tmGetTaskTomatoSummaryHtml(task);
                const compactFocusSummaryText = compactChecklistMetaFieldSet.has('tomatoSummary')
                    ? focusSummaryText
                    : '';
                const compactFocusSummaryHtml = compactChecklistMetaFieldSet.has('tomatoSummary')
                    ? focusSummaryHtml
                    : '';
                const compactTomatoEstimateText = compactChecklistMetaFieldSet.has('tomatoEstimateCount')
                    ? __tmGetTomatoCountDisplay(__tmGetTaskTomatoEstimateCount(task))
                    : '';
                const compactTomatoCountText = compactChecklistMetaFieldSet.has('tomatoCount')
                    ? __tmGetTomatoCountDisplay(__tmGetTaskTomatoCount(task))
                    : '';
                const compactTomatoCountHtml = compactChecklistMetaFieldSet.has('tomatoCount')
                    ? __tmGetActualTomatoCountDisplayHtml(__tmGetTaskTomatoCount(task))
                    : '';
                const showCompactStatusTag = compactChecklistMetaFieldSet.has('status');
                const statusTagVisible = __tmShouldRenderChecklistTaskStatus(task, statusOption, statusOptions);
                const statusTagHtml = showCompactStatusTag
                    ? `<span class="tm-status-tag" data-tm-field="status" data-tm-checklist-compact-field="status" style="${statusChipStyle}"${statusTagVisible ? '' : ' hidden'}>${esc(String(statusOption?.name || statusOption?.id || ''))}</span>`
                    : '';
                const compactMetaParts = new Map();
                if (showCompactDocName) compactMetaParts.set('docName', `<span class="tm-checklist-meta-compact-doc" data-tm-checklist-compact-field="docName">${esc(String(task.docName || ''))}</span>`);
                if (compactHeadingText) compactMetaParts.set('h2', `<span class="tm-checklist-meta-compact-h2" data-tm-checklist-compact-field="h2" title="${esc(compactHeadingText)}">${API.renderTaskContentHtml(compactHeadingText, compactHeadingText)}</span>`);
                if (showCompactStartDate) compactMetaParts.set('startDate', `<span class="tm-checklist-meta-compact-start tm-checklist-meta-compact-date tm-checklist-meta-compact-date--start" data-tm-checklist-compact-field="startDate" data-tm-task-time-field="startDateCompact">${esc(__tmFormatTaskDateFieldDisplayValue(task, 'startDate', true))}</span>`);
                if (showCompactCompletionTime) compactMetaParts.set('completionTime', `<span class="tm-checklist-meta-compact-time tm-checklist-meta-compact-date tm-checklist-meta-compact-date--completion${__tmIsTaskCardDateOverdue(task, completedTodayKey) ? ' tm-checklist-meta-compact-date--overdue' : ''}" data-tm-checklist-compact-field="completionTime" data-tm-task-time-field="completionTimeCompact">${esc(__tmFormatTaskDateFieldDisplayValue(task, 'completionTime', true))}</span>`);
                if (compactScheduleTime) compactMetaParts.set('scheduleTime', compactScheduleTime);
                if (showCompactRemainingTime) compactMetaParts.set('remainingTime', `<span class="tm-checklist-meta-compact-remaining" data-tm-checklist-compact-field="remainingTime" data-tm-task-time-field="remainingTimeCompact" title="${esc(compactRemainingTimeLabel)}">${compactRemainingTimeHtml}</span>`);
                if (showCompactDuration) compactMetaParts.set('duration', `<span class="tm-checklist-meta-compact-duration" data-tm-checklist-compact-field="duration" data-tm-task-time-field="durationCompact">${esc(compactDurationText)}</span>`);
                if (compactFocusSummaryText) compactMetaParts.set('tomatoSummary', `<span class="tm-checklist-meta-compact-duration" data-tm-checklist-compact-field="tomatoSummary" data-tm-task-time-field="tomatoSummaryCompact" onclick="tmEditFocusSummaryInline('${esc(task.id)}', this)">${compactFocusSummaryHtml}</span>`);
                if (compactTomatoEstimateText) compactMetaParts.set('tomatoEstimateCount', `<span class="tm-checklist-meta-compact-duration" data-tm-checklist-compact-field="tomatoEstimateCount" data-tm-task-time-field="tomatoEstimateCountCompact">${esc(compactTomatoEstimateText)}</span>`);
                if (compactTomatoCountText) compactMetaParts.set('tomatoCount', `<span class="tm-checklist-meta-compact-duration" data-tm-checklist-compact-field="tomatoCount" data-tm-task-time-field="tomatoCountCompact">${compactTomatoCountHtml || esc(compactTomatoCountText)}</span>`);
                if (statusTagHtml) compactMetaParts.set('status', statusTagHtml);
                compactCustomFieldDefs.forEach((field) => {
                    const fieldId = String(field?.id || '').trim();
                    if (!fieldId || !__tmIsCustomFieldApplicableToTask(field, task)) return;
                    const fieldHtml = __tmBuildCustomFieldDisplayHtml(field, __tmGetTaskCustomFieldValue(task, fieldId), {
                        allowEmpty: false,
                        maxTags: String(field?.type || '').trim() === 'multi' ? 2 : 1,
                    });
                    if (!fieldHtml) return;
                    compactMetaParts.set(`customField:${fieldId}`, `<span class="tm-checklist-meta-compact-custom-field" data-tm-checklist-compact-field="customField:${esc(fieldId)}" data-tm-custom-field-cell="${esc(fieldId)}" title="${esc(String(field?.name || fieldId).trim() || fieldId)}">${fieldHtml}</span>`);
                });
                const hasCompactMeta = compactMetaParts.size > (compactMetaParts.has('status') ? 1 : 0)
                    || (compactMetaParts.has('status') && statusTagVisible);
                const compactMeta = compactMetaParts.size > 0
                    ? `<div class="tm-checklist-meta-compact"${hasCompactMeta ? '' : ' style="display:none;"'}>${compactChecklistMetaFieldOrder.map((key) => compactMetaParts.get(key) || '').join('')}</div>`
                    : '';
                const titleRowClass = `tm-checklist-title-row${hasChildren ? ' tm-checklist-title-row--has-children' : ''}${hasCompactMeta ? ' tm-checklist-title-row--has-compact-meta' : ''}`;
                const itemIndentStyle = `--tm-checklist-compact-indent:calc(${depth} * var(--tm-checklist-indent-step));`;
                const useDesktopTaskDragLogic = __tmShouldUseDesktopTaskDragLogic();
                const useCustomTouchTaskDrag = __tmShouldUseCustomTouchTaskDrag();
                const useDockPointerTaskDrag = (globalThis.__tmViewPolicy?.shouldUseDockPointerTaskDrag?.()
                    ?? globalThis.__tmRuntimeHost?.isDesktopDockHost?.()
                    ?? false) === true;
                const itemDragAttrs = useDesktopTaskDragLogic
                    ? `draggable="true" ondragstart="tmDragTaskStart(event, '${escSq(String(task.id || ''))}')" ondragend="tmDragTaskEnd(event)"`
                    : 'draggable="false"';
                const titleDragAttrs = useCustomTouchTaskDrag
                    ? `onpointerdown="tmTaskTouchDragStart(event, '${escSq(String(task.id || ''))}')"`
                    : useDockPointerTaskDrag
                    ? `draggable="true" ondragstart="tmDragTaskStart(event, '${escSq(String(task.id || ''))}')" ondragend="tmDragTaskEnd(event)"`
                    : '';
                const itemContextMenuAttr = useDesktopTaskDragLogic
                    ? `oncontextmenu="tmShowTaskContextMenu(event, '${escSq(String(task.id || ''))}')"`
                    : 'oncontextmenu="event.preventDefault();event.stopPropagation();return false;"';
                const touchDragAttr = __tmShouldUseCustomTouchTaskDrag()
                    ? `onpointerdown="tmTaskTouchDragStart(event, '${escSq(String(task.id || ''))}')"`
                    : '';
                const remarkSearchSnippetHtml = typeof __tmBuildTaskSearchSnippet === 'function'
                    ? __tmBuildTaskSearchSnippet(task, state.searchKeyword, { excludeFields: compactRemarkHtml ? ['remark'] : [] })
                    : '';
                renderedChecklistTaskCount += 1;
                const taskTitleHtml = API.renderTaskContentHtml(task.markdown, String(task.content || '').trim() || '(无内容)');
                const titleInnerHtml = __tmBuildChecklistTitleContentHtml(task, taskTitleHtml, completedTodayBadgeHtml);
                const titleWrap = typeof __tmGetTaskTitleWrapPresentation === 'function'
                    ? __tmGetTaskTitleWrapPresentation('checklist', task.id, taskTitleHtml)
                    : { key: '', className: '' };
                return `
                    <div data-tm-title-wrap-key="${titleWrap.key}" class="tm-checklist-item${titleWrap.className}${compactRemarkHtml ? ' tm-checklist-item--has-remark' : ''}${activeCls}${doneCls}${branchLeadingCls}${timerCls}${multiSelectCls}" data-id="${esc(String(task.id || ''))}" data-depth="${depth}" data-tm-placement-doc="${esc(String(task.docId || task.root_id || '').trim())}" data-tm-placement-parent="${esc(String(task.parentTaskId || task.parent_task_id || '').trim())}" data-tm-subtask-progress-owner="${esc(String(task.id || ''))}" ${itemDragAttrs} ondragenter="tmTaskRowDragOver(event, '${escSq(String(task.id || ''))}')" ondragover="tmTaskRowDragOver(event, '${escSq(String(task.id || ''))}')" ondragleave="tmTaskRowDragLeave(event, '${escSq(String(task.id || ''))}')" ondrop="tmTaskRowDrop(event, '${escSq(String(task.id || ''))}')" ${touchDragAttr} style="${itemIndentStyle}${accentStyle}${progressBg}" onclick="tmChecklistSelectTask('${escSq(String(task.id || ''))}', event)" ${itemContextMenuAttr}>
                        ${treeGuides}
                        <div class="tm-checklist-leading${hasChildren ? ' tm-checklist-leading--branch' : ''}${hasChildren && collapsed ? ' tm-checklist-leading--collapsed' : ''}">
                            ${hasChildren ? `<span class="tm-tree-toggle" onclick="tmToggleCollapse('${escSq(String(task.id || ''))}', event)" style="opacity:1;pointer-events:auto;color:var(--tm-checklist-parent-toggle-color);">${__tmRenderToggleIcon(16, collapsed ? 0 : 90, 'tm-tree-toggle-icon')}</span>` : '<span class="tm-tree-toggle tm-tree-toggle--placeholder" aria-hidden="true"></span>'}
                            ${hasChildren && collapsed ? '<span class="tm-task-leading-ring" aria-hidden="true"></span>' : ''}
                            ${__tmRenderTaskCheckbox(String(task.id || ''), task, { checked: taskDone, extraClass: GlobalLock.isLocked() ? 'tm-operating' : '', stopMouseDown: true, stopPointerDown: true, stopClick: true })}
                        </div>
                        <div class="tm-checklist-item-main">
                            <div class="${titleRowClass}">
                                <div class="tm-checklist-title-main"><div class="tm-checklist-title"><span class="tm-checklist-title-button"><span ${titleDragAttrs} onclick="tmChecklistTitleClick('${escSq(String(task.id || ''))}', event)"${__tmBuildTooltipAttrs(API.getTaskTitlePresentation(task.markdown, String(task.content || '').trim() || '(无内容)').text, { side: 'bottom', ariaLabel: false })} style="${__tmBuildTaskTitleOpacityStyle(task)}">${titleInnerHtml}</span></span>${reminderHtml}<span data-tm-field="remarkIcon">${remarkIconHtml}</span><span data-tm-field="attachmentIcon">${attachmentIconHtml}</span>${__tmRenderChecklistSubtaskProgress(String(task.id || ''), completedChildren, totalChildren)}</div></div>
                                ${compactMeta}
                                ${hasChildren ? `<span class="tm-checklist-mobile-toggle" onclick="tmToggleCollapse('${escSq(String(task.id || ''))}', event)" style="opacity:1;pointer-events:auto;">${__tmRenderToggleIcon(16, collapsed ? 0 : 90, 'tm-tree-toggle-icon')}</span>` : ''}
                            </div>
                            ${compactRemarkHtml}
                            ${remarkSearchSnippetHtml}
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
                if (renderWindowFragment && !compactGroupCard.hasFragmentTask && !compactGroupCard.hasFragmentGroup) {
                    compactGroupCard = null;
                    return;
                }
                const cardClasses = [
                    'tm-checklist-group-card',
                    `tm-checklist-group-card--${compactGroupCard.kind || 'default'}`,
                    compactGroupCard.children.length ? '' : 'tm-checklist-group-card--collapsed',
                ].filter(Boolean).join(' ');
                const cardStyle = [];
                if (compactGroupCard.accent) cardStyle.push(`--tm-checklist-card-accent:${compactGroupCard.accent};`);
                const cardBodyHtml = compactGroupCard.children.length
                    ? `<div class="tm-checklist-group-card-items">${compactGroupCard.children.join('')}</div>`
                    : '';
                items.push(`<section class="${cardClasses}"${cardStyle.length ? ` style="${cardStyle.join('')}"` : ''}>${compactGroupCard.header}${cardBodyHtml}</section>`);
                compactGroupCard = null;
            };
            for (const row of taskBranchRows || rowModel) {
                if (row?.type === 'group') {
                    if (renderedChecklistTaskCount >= checklistTaskLimit && hasMoreChecklistTaskRows) break;
                    const groupHtml = renderGroup(row);
                    const isCompletedSubgroup = String(row.kind || '').startsWith('done-');
                    if (isCompletedSubgroup && compactGroupCard?.kind === 'done') {
                        compactGroupCard.children.push(groupHtml);
                        continue;
                    }
                    if (row.kind !== 'h2') {
                        flushCompactGroupCard();
                        compactGroupCard = {
                            kind: String(row.kind || 'default'),
                            accent: String(currentGroupAccent || '').trim(),
                            header: groupHtml,
                            children: [],
                            hasFragmentTask: false,
                            hasFragmentGroup: renderWindowFragment && renderedChecklistTaskCount >= fragmentStartTaskCount,
                        };
                        continue;
                    }
                    if (row.kind === 'h2' && compactGroupCard) {
                        compactGroupCard.children.push(groupHtml);
                        continue;
                    }
                    flushCompactGroupCard();
                    items.push(groupHtml);
                    continue;
                }
                if (row?.type === 'drop-gap') {
                    if (renderWindowFragment && renderedChecklistTaskCount < fragmentStartTaskCount) continue;
                    const gapHtml = renderDropGap(row);
                    if (!gapHtml) continue;
                    if (compactGroupCard) compactGroupCard.children.push(gapHtml);
                    else items.push(gapHtml);
                    continue;
                }
                if (renderedChecklistTaskCount >= checklistTaskLimit) break;
                if (renderWindowFragment && renderedChecklistTaskCount < fragmentStartTaskCount) {
                    renderedChecklistTaskCount += 1;
                    continue;
                }
                const html = renderTask(row);
                if (!html) continue;
                if (compactGroupCard) {
                    compactGroupCard.hasFragmentTask = compactGroupCard.hasFragmentTask || renderWindowFragment;
                    compactGroupCard.children.push(html);
                }
                else items.push(html);
            }
            flushCompactGroupCard();
            if (renderWindowFragment) {
                const fragmentComplete = !hasMoreChecklistTaskRows;
                return `<div class="tm-checklist-items" data-tm-checklist-window-fragment="1" data-tm-checklist-window-fragment-complete="${fragmentComplete ? '1' : '0'}">${items.join('')}</div>`;
            }
            const itemsHtml = items.join('');
            if (taskBranchRows) {
                return `<div class="tm-checklist-items" data-tm-checklist-branch-fragment="${esc(taskBranchId)}">${itemsHtml}</div>`;
            }
            const checklistRemain = checklistVirtualEnabled && hasMoreChecklistTaskRows ? 1 : 0;
            const checklistLoadMoreHtml = checklistRemain > 0
                ? `<div class="tm-checklist-load-more" style="padding:10px 0;text-align:center;"><button type="button" class="tm-btn tm-btn-secondary" onclick="tmChecklistLoadMoreRows(event)">继续加载</button></div>`
                : '';
            const detailTask = activeId
                ? resolveChecklistDetailTask(activeId)
                : null;
            const detailHtml = detailTask
                ? (typeof __tmShouldRenderTaskDetailNoteView === 'function' && __tmShouldRenderTaskDetailNoteView('sheet', detailTask)
                    ? __tmBuildTaskDetailNoteViewInnerHtml(detailTask, { embedded: true, closeable: true })
                    : __tmBuildTaskDetailInnerHtml(detailTask, { embedded: true, closeable: true }))
                : `<div class="tm-checklist-empty-detail">选择左侧任务后，这里会显示可编辑的详情。</div>`;
            return `
                <div class="tm-body${bodyAnimClass} tm-body--checklist">
                    <div class="tm-checklist-layout">
                        <div class="tm-checklist-pane tm-checklist-pane--compact tm-checklist-pane--right-font-${compactRightFontSize}${checklistFieldsBelow ? ' tm-checklist-pane--fields-below' : ''}${checklistCompactTreeGuides ? ' tm-checklist-pane--tree-guides' : ''}${wrapCfg.enabled ? ' tm-checklist-pane--wrap' : ''}${state.groupByDocName ? ' tm-checklist-pane--group-doc' : ''}">
                            <div class="tm-checklist-scroll">
                                <div class="tm-checklist-items">${itemsHtml || `<div class="tm-checklist-empty-detail">暂无任务</div>`}${checklistLoadMoreHtml}</div>
                            </div>
                            <div class="tm-checklist-scrollbar"><div class="tm-checklist-scrollbar-thumb"></div></div>
                        </div>
                        ${sheetMode
                            ? `<div id="tmChecklistSheetBackdrop" class="tm-checklist-sheet-backdrop ${state.checklistDetailSheetOpen && detailTask ? 'tm-checklist-sheet-backdrop--open' : ''}" onclick="tmChecklistCloseSheet(event)"></div>
                        <div id="tmChecklistSheet" class="tm-checklist-sheet ${state.checklistDetailSheetOpen && detailTask ? 'tm-checklist-sheet--open' : ''}${state.checklistDetailSheetOpen && detailTask && state.checklistDetailSheetFullscreen ? ' tm-checklist-sheet--fullscreen' : ''}" onpointerdown="tmChecklistSheetDragStart(event)">
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
