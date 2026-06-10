    function __tmCanUpdateTimelineDatesInPlace(task) {
        if (String(state.viewMode || '').trim() !== 'timeline') return false;
        if (!(state.modal instanceof Element) || !document.body.contains(state.modal)) return false;
        if (state.currentRule) return false;
        if (state.groupByTime || state.quadrantEnabled) return false;
        if (SettingsStore.data.timelineForceSortByCompletionNearToday) return false;
        const ganttBody = state.modal.querySelector('#tmGanttBody');
        const view = globalThis.__TaskHorizonGanttView;
        if (!(ganttBody instanceof HTMLElement) || !view) return false;
        const startTs0 = Number(ganttBody.dataset?.tmGanttStartTs);
        const dayCount0 = Number(ganttBody.dataset?.tmGanttDayCount);
        if (!Number.isFinite(startTs0) || !Number.isFinite(dayCount0) || dayCount0 <= 0) return false;
        const rangeStart = view.startOfDayTs(startTs0);
        const rangeEnd = rangeStart + ((dayCount0 - 1) * view.DAY_MS);
        const sTs0 = view.parseDateOnlyToTs(task?.startDate);
        const eTs0 = view.parseDateOnlyToTs(task?.completionTime);
        const targets = [sTs0, eTs0].filter((ts) => Number.isFinite(ts));
        if (!targets.length) return true;
        return targets.every((ts) => {
            const dayTs = view.startOfDayTs(ts);
            return dayTs >= rangeStart && dayTs <= rangeEnd;
        });
    }

    function __tmUpdateTimelineTaskInDOM(taskId) {
        const id = String(taskId || '').trim();
        if (!id) return false;
        const task = globalThis.__tmRuntimeState?.getTaskById?.(id, { includePending: true, preferPending: true })
            || state.flatTasks?.[id]
            || state.pendingInsertedTasks?.[id]
            || null;
        if (!task) return false;
        const modal = state.modal;
        if (!modal) return false;

        try {
            const row = modal.querySelector(`#tmTimelineLeftTable tbody tr[data-id="${id}"]`);
            if (row) {
                const tds = row.querySelectorAll('td');
                if (tds && tds.length >= 3) {
                    try { tds[1].textContent = __tmFormatTaskTime(task.startDate); } catch (e) {}
                    try { tds[2].textContent = __tmFormatTaskTime(task.completionTime); } catch (e) {}
                    try { __tmSyncTimelineDateColumnWidths(modal); } catch (e) {}
                }
            }
        } catch (e) {}

        try {
            const ganttBody = modal.querySelector('#tmGanttBody');
            if (!ganttBody) return false;
            const rowEl = ganttBody.querySelector(`.tm-gantt-row[data-id="${id}"]`);
            if (!rowEl) return false;

            const view = globalThis.__TaskHorizonGanttView;
            if (!view) return false;
            const startTs0 = Number(ganttBody.dataset?.tmGanttStartTs);
            const dayWidth0 = Number(ganttBody.dataset?.tmGanttDayWidth);
            const dayCount0 = Number(ganttBody.dataset?.tmGanttDayCount);
            if (!Number.isFinite(startTs0) || !Number.isFinite(dayWidth0) || !Number.isFinite(dayCount0) || dayWidth0 <= 0) return false;

            const sTs0 = view.parseDateOnlyToTs(task?.startDate);
            const eTs0 = view.parseDateOnlyToTs(task?.completionTime);
            const aTs = sTs0 || eTs0;
            const bTs = eTs0 || sTs0;
            const milestoneRaw = task?.milestone;
            const isMilestone = typeof milestoneRaw === 'boolean'
                ? milestoneRaw
                : ['1', 'true'].includes(String(milestoneRaw || '').trim().toLowerCase());

            const bar = rowEl.querySelector('.tm-gantt-bar');
            const marker = rowEl.querySelector('.tm-gantt-milestone');
            if (!aTs && !bTs) {
                if (bar) bar.remove();
                if (marker) marker.remove();
                try { state.__tmTimelineRenderDeps?.(); } catch (e) {}
                return true;
            }

            const displayStartTs = (isMilestone && bTs) ? bTs : aTs;
            const displayEndTs = bTs;
            const dayIdxOf = (ts) => Math.round((view.startOfDayTs(ts) - view.startOfDayTs(startTs0)) / view.DAY_MS);
            const startIdx = __tmClamp(dayIdxOf(displayStartTs), 0, dayCount0 - 1);
            const endIdx = __tmClamp(dayIdxOf(displayEndTs), 0, dayCount0 - 1);
            const left = Math.min(startIdx, endIdx) * dayWidth0;
            const width = (Math.abs(endIdx - startIdx) + 1) * dayWidth0;
            const milestoneLeft = endIdx * dayWidth0 + (dayWidth0 * 0.5);
            const isDark = __tmIsDarkMode();
            const barLayout = {
                left,
                width,
                dayWidth: dayWidth0,
                startTs: displayStartTs,
                endTs: displayEndTs,
                isDark,
            };

            if (isMilestone && bTs) {
                if (marker) marker.remove();
                const milestoneBarLayout = {
                    ...barLayout,
                    left: milestoneLeft - (dayWidth0 * 0.5),
                    width: dayWidth0,
                    dayWidth: dayWidth0,
                    startTs: bTs,
                    endTs: bTs,
                };
                if (bar) {
                    view.applyTimelineTaskBarElement?.(bar, task, milestoneBarLayout);
                    try { state.__tmTimelineRenderDeps?.(); } catch (e) {}
                    return true;
                }
                const barEl = document.createElement('div');
                view.applyTimelineTaskBarElement?.(barEl, task, milestoneBarLayout);
                rowEl.appendChild(barEl);
                try { state.__tmTimelineRenderDeps?.(); } catch (e) {}
                return true;
            }

            if (marker) marker.remove();

            if (bar) {
                view.applyTimelineTaskBarElement?.(bar, task, barLayout);
                try { state.__tmTimelineRenderDeps?.(); } catch (e) {}
                return true;
            }

            const barEl = document.createElement('div');
            view.applyTimelineTaskBarElement?.(barEl, task, barLayout);
            rowEl.appendChild(barEl);
            try { state.__tmTimelineRenderDeps?.(); } catch (e) {}
            return true;
        } catch (e) {}
        return false;
    }

    function __tmCanUpdateTaskTimeInListLike(task) {
        if (!(task && typeof task === 'object')) return false;
        if (!(state.modal instanceof Element) || !document.body.contains(state.modal)) return false;
        if (state.groupByTime || state.quadrantEnabled) return false;
        return true;
    }

    function __tmUpdateListTaskTimeInDOM(taskId, rowEl = null, taskLike = null) {
        const id = String(taskId || '').trim();
        if (!id) return false;
        const task = (taskLike && typeof taskLike === 'object')
            ? taskLike
            : (
                globalThis.__tmRuntimeState?.getTaskById?.(id, { includePending: true, preferPending: true })
                || state.flatTasks?.[id]
                || state.pendingInsertedTasks?.[id]
                || null
            );
        const row = rowEl instanceof HTMLElement
            ? rowEl
            : ((state.modal instanceof Element)
                ? state.modal.querySelector(`#tmTaskTable tbody tr[data-id="${CSS.escape(id)}"]`)
                : null);
        if (!(row instanceof HTMLElement)) {
return false;
        }
        if (!task) return false;
        let touched = false;
        let sawNode = false;
        const setCell = (field, value, options = {}) => {
            const cell = row.querySelector(`[data-tm-task-time-field="${field}"]`);
            if (!(cell instanceof HTMLElement)) return null;
            sawNode = true;
            if (options.html === true) cell.innerHTML = String(value || '');
            else cell.textContent = String(value || '');
            if (typeof options.title === 'string') {
                try { cell.setAttribute('title', options.title); } catch (e) {}
            }
            touched = true;
            return true;
        };
        setCell('startDate', __tmFormatTaskTime(task.startDate));
        setCell('completionTime', __tmFormatTaskTime(task.completionTime));
        const taskCompleteAtText = __tmFormatTaskCompletedAtTime(__tmResolveTaskCompletedAtRaw(task));
        setCell('taskCompleteAt', taskCompleteAtText, { title: taskCompleteAtText });
        setCell('duration', esc(__tmFormatDurationDisplayValue(task.duration || '')), { html: true });
        setCell('tomatoSummary', __tmGetTaskTomatoSummaryHtml(task), { html: true });
        setCell('tomatoEstimateCount', esc(__tmGetTomatoCountDisplay(__tmGetTaskTomatoEstimateCount(task))), { html: true });
        setCell('tomatoCount', __tmGetActualTomatoCountDisplayHtml(__tmGetTaskTomatoCount(task)), { html: true });
        const remainingInfo = __tmGetTaskRemainingTimeInfo(task);
        const remainingLabel = String(remainingInfo?.label || '').trim();
        const remainingHtml = __tmRenderTaskRemainingTimeInfoHtml(remainingInfo);
        setCell('remainingTime', remainingHtml, { html: true, title: remainingLabel });
        const ok = touched || !sawNode;
return ok;
    }

    function __tmUpdateChecklistTaskTimeInDOM(taskId, itemEl = null, taskLike = null) {
        const id = String(taskId || '').trim();
        if (!id) return false;
        const task = (taskLike && typeof taskLike === 'object')
            ? taskLike
            : (
                globalThis.__tmRuntimeState?.getTaskById?.(id, { includePending: true, preferPending: true })
                || state.flatTasks?.[id]
                || state.pendingInsertedTasks?.[id]
                || null
            );
        const item = itemEl instanceof HTMLElement
            ? itemEl
            : ((state.modal instanceof Element)
                ? state.modal.querySelector(`.tm-checklist-item[data-id="${CSS.escape(id)}"]`)
                : null);
        if (!task || !(item instanceof HTMLElement)) return false;
        const compactFieldMap = {
            startDateCompact: 'startDate',
            completionTimeCompact: 'completionTime',
            remainingTimeCompact: 'remainingTime',
            durationCompact: 'duration',
            tomatoSummaryCompact: 'tomatoSummary',
            tomatoEstimateCountCompact: 'tomatoEstimateCount',
            tomatoCountCompact: 'tomatoCount',
        };
        const enabledCompactFields = (!!SettingsStore?.data?.checklistCompactMode)
            ? (globalThis.__tmViewPolicy?.getCompactChecklistMetaFieldSetForCurrentHost?.() || new Set(__tmGetCompactChecklistMetaFieldsForCurrentHost()))
            : null;
        const taskStartDateValue = String(task?.startDate || task?.start_date || '').trim();
        const taskCompletionTimeValue = String(task?.completionTime || task?.completion_time || '').trim();
        if (taskStartDateValue && !String(task?.startDate || '').trim()) task.startDate = taskStartDateValue;
        if (taskCompletionTimeValue && !String(task?.completionTime || '').trim()) task.completionTime = taskCompletionTimeValue;
        let touched = false;
        let sawNode = false;
        let valid = true;
        const syncNode = (field, content, options = {}) => {
            const compactFieldKey = compactFieldMap[field] || '';
            const shouldExist = options.shouldExist !== false
                && (!compactFieldKey || (enabledCompactFields instanceof Set && enabledCompactFields.has(compactFieldKey)));
            let nodes = Array.from(item.querySelectorAll(`[data-tm-task-time-field="${CSS.escape(field)}"]`))
                .filter((node) => node instanceof HTMLElement);
            if (shouldExist && !nodes.length) {
                const created = __tmEnsureChecklistTimeNode(item, field);
                if (created instanceof HTMLElement) nodes = [created];
            }
            if (!nodes.length) return !shouldExist;
            sawNode = true;
            nodes.forEach((node) => {
                if (!(node instanceof HTMLElement)) return;
                if (shouldExist) {
                    node.style.display = '';
                    if (options.html === true) node.innerHTML = String(content || '');
                    else node.textContent = String(content || '');
                    if (typeof options.title === 'string') {
                        try { node.setAttribute('title', options.title); } catch (e) {}
                    }
                } else {
                    node.style.display = 'none';
                    if (options.html === true) node.innerHTML = '';
                    else node.textContent = '';
                    try { node.removeAttribute('title'); } catch (e) {}
                }
                touched = true;
            });
            return true;
        };
        const syncCompactDateClass = (field, className, overdue = false) => {
            Array.from(item.querySelectorAll(`[data-tm-task-time-field="${CSS.escape(field)}"]`)).forEach((node) => {
                if (!(node instanceof HTMLElement)) return;
                node.classList.add('tm-checklist-meta-compact-date', className);
                node.classList.toggle('tm-checklist-meta-compact-date--overdue', !!overdue);
            });
        };
        const completionText = __tmFormatTaskTime(taskCompletionTimeValue);
        const durationText = __tmFormatDurationDisplayValue(task.duration || '');
        const focusSummaryText = __tmGetTaskTomatoSummaryText(task);
        const focusSummaryHtml = __tmGetTaskTomatoSummaryHtml(task);
        const tomatoEstimateText = __tmGetTomatoCountDisplay(__tmGetTaskTomatoEstimateCount(task));
        const tomatoCountText = __tmGetTomatoCountDisplay(__tmGetTaskTomatoCount(task));
        const tomatoCountHtml = __tmGetActualTomatoCountDisplayHtml(__tmGetTaskTomatoCount(task));
        const compactStartText = __tmFormatTaskCardDateValueFromValue(taskStartDateValue);
        const compactCompletionText = __tmFormatTaskCardDateValueFromValue(taskCompletionTimeValue);
        const compactRemainingInfo = __tmGetTaskRemainingTimeInfo(task);
        const compactRemainingText = String(compactRemainingInfo?.label || '').trim();
        const compactRemainingHtml = compactRemainingText ? __tmRenderTaskRemainingTimeInfoHtml(compactRemainingInfo) : '';
        const compactDurationText = __tmFormatDurationDisplayValue(task.duration || '');
        const compactFocusSummaryText = focusSummaryText;
        const compactFocusSummaryHtml = focusSummaryHtml;
        const compactTomatoEstimateText = tomatoEstimateText;
        const compactTomatoCountText = tomatoCountText;
        const compactTomatoCountHtml = tomatoCountHtml;

        if (!syncNode('completionTime', esc(completionText), { html: true, shouldExist: !!taskCompletionTimeValue })) valid = false;
        if (!syncNode('duration', `${__tmRenderLucideIcon('timer')} ${esc(durationText)}`, { html: true, shouldExist: !!durationText })) valid = false;
        if (!syncNode('tomatoSummary', `${__tmRenderLucideIcon('timer')} ${focusSummaryHtml}`, { html: true, shouldExist: !!focusSummaryText })) valid = false;
        if (!syncNode('tomatoEstimateCount', esc(tomatoEstimateText), { html: true, shouldExist: !!tomatoEstimateText })) valid = false;
        if (!syncNode('tomatoCount', tomatoCountHtml, { html: true, shouldExist: !!tomatoCountText })) valid = false;
        if (!syncNode('startDateCompact', compactStartText, { shouldExist: !!compactStartText })) valid = false;
        if (!syncNode('completionTimeCompact', compactCompletionText, { shouldExist: !!compactCompletionText })) valid = false;
        syncCompactDateClass('startDateCompact', 'tm-checklist-meta-compact-date--start');
        syncCompactDateClass('completionTimeCompact', 'tm-checklist-meta-compact-date--completion', !!taskCompletionTimeValue && __tmIsTaskCardDateOverdue(task));
        if (!syncNode('remainingTimeCompact', compactRemainingHtml, { html: true, title: compactRemainingText, shouldExist: !!compactRemainingText && !!(taskStartDateValue || taskCompletionTimeValue) })) valid = false;
        if (!syncNode('durationCompact', compactDurationText, { shouldExist: !!compactDurationText })) valid = false;
        if (!syncNode('tomatoSummaryCompact', compactFocusSummaryHtml, { html: true, shouldExist: !!compactFocusSummaryText })) valid = false;
        if (!syncNode('tomatoEstimateCountCompact', compactTomatoEstimateText, { shouldExist: !!compactTomatoEstimateText })) valid = false;
        if (!syncNode('tomatoCountCompact', compactTomatoCountHtml, { html: true, shouldExist: !!compactTomatoCountText })) valid = false;
        __tmSyncChecklistMetaContainerVisibility(item);
        return valid && (touched || !sawNode);
    }

    function __tmApplyTaskCardDateChipState(node, task) {
        if (!(node instanceof HTMLElement)) return;
        const hasDateValue = !!String(__tmGetTaskCardDateValue(task) || '').trim();
        node.classList.add('tm-kanban-chip--date');
        node.classList.toggle('tm-kanban-chip--date-has-value', hasDateValue);
        node.classList.toggle('tm-kanban-chip--date-empty', !hasDateValue);
        node.classList.toggle('tm-kanban-chip--date-overdue', hasDateValue && __tmIsTaskCardDateOverdue(task));
    }

    function __tmUpdateKanbanTaskTimeInDOM(taskId, options = {}) {
        const id = String(taskId || '').trim();
        if (!id) return false;
        const task = globalThis.__tmRuntimeState?.getTaskById?.(id, { includePending: true, preferPending: true })
            || state.flatTasks?.[id]
            || state.pendingInsertedTasks?.[id]
            || null;
        if (!task || !(state.modal instanceof Element)) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const patch = (opts.patch && typeof opts.patch === 'object') ? opts.patch : {};
        const taskForRender = Object.keys(patch).length ? { ...task } : task;
        if (taskForRender !== task) {
            if (Object.prototype.hasOwnProperty.call(patch, 'startDate')) {
                taskForRender.startDate = String(patch.startDate ?? '').trim();
                taskForRender.start_date = taskForRender.startDate;
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'completionTime')) {
                taskForRender.completionTime = String(patch.completionTime ?? '').trim();
                taskForRender.completion_time = taskForRender.completionTime;
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'taskDateColor') || Object.prototype.hasOwnProperty.call(patch, 'color')) {
                taskForRender.taskDateColor = String((Object.prototype.hasOwnProperty.call(patch, 'taskDateColor') ? patch.taskDateColor : patch.color) ?? '').trim();
                taskForRender.task_date_color = taskForRender.taskDateColor;
                taskForRender.custom_task_date_color = taskForRender.taskDateColor;
            }
        }
        const card = state.modal.querySelector(`.tm-kanban-card[data-id="${CSS.escape(id)}"]`);
        if (!(card instanceof HTMLElement)) return false;
        let touched = false;
        const cardFields = (() => {
            try { return new Set(__tmGetTaskCardFieldList('kanban')); } catch (e) { return new Set(); }
        })();
        const syncExistingMetaNode = (field, html, options = {}) => {
            const node = card.querySelector(`[data-tm-task-time-field="${CSS.escape(field)}"]`);
            const shouldExist = options.shouldExist !== false;
            if (node instanceof HTMLElement) {
                if (!shouldExist) return false;
                if (options.html === true) node.innerHTML = String(html || '');
                else node.textContent = String(html || '');
                touched = true;
                return true;
            }
            return !shouldExist;
        };
        const dateNode = card.querySelector('[data-tm-task-time-field="date"]');
        const dateEnabled = cardFields.has('date');
        const dateShouldExist = dateEnabled && __tmShouldRenderTaskCardDate(taskForRender);
        if (dateNode instanceof HTMLElement) {
            if (!dateShouldExist) {
                dateNode.remove();
            } else {
                dateNode.textContent = __tmFormatTaskCardDateValue(taskForRender) || '日期';
                __tmApplyTaskCardDateChipState(dateNode, taskForRender);
            }
            touched = true;
        } else if (dateShouldExist) {
            return false;
        }
        const focusText = __tmGetTaskTomatoSummaryText(taskForRender);
        if (!syncExistingMetaNode('tomatoSummary', __tmGetTaskTomatoSummaryHtml(taskForRender), {
            html: true,
            shouldExist: cardFields.has('tomatoSummary') && !!focusText,
        })) return false;
        const estimateText = __tmGetTomatoCountDisplay(__tmGetTaskTomatoEstimateCount(taskForRender));
        if (!syncExistingMetaNode('tomatoEstimateCount', estimateText, {
            shouldExist: cardFields.has('tomatoEstimateCount') && !!estimateText,
        })) return false;
        const countText = __tmGetTomatoCountDisplay(__tmGetTaskTomatoCount(taskForRender));
        if (!syncExistingMetaNode('tomatoCount', __tmGetActualTomatoCountDisplayHtml(__tmGetTaskTomatoCount(taskForRender)), {
            html: true,
            shouldExist: cardFields.has('tomatoCount') && !!countText,
        })) return false;
        return true;
    }

    function __tmUpdateWhiteboardTaskTimeInDOM(taskId) {
        const id = String(taskId || '').trim();
        if (!id || !(state.modal instanceof Element)) return false;
        const task = globalThis.__tmRuntimeState?.getTaskById?.(id, { includePending: true, preferPending: true })
            || state.flatTasks?.[id]
            || state.pendingInsertedTasks?.[id]
            || null;
        if (!task) return false;
        const dateNodes = state.modal.querySelectorAll(
            `.tm-whiteboard-node[data-task-id="${CSS.escape(id)}"] [data-tm-task-time-field="date"], ` +
            `.tm-whiteboard-stream-task-head[data-id="${CSS.escape(id)}"] [data-tm-task-time-field="date"], ` +
            `.tm-whiteboard-stream-task-node[data-id="${CSS.escape(id)}"] [data-tm-task-time-field="date"]`
        );
        const focusNodes = state.modal.querySelectorAll(
            `.tm-whiteboard-node[data-task-id="${CSS.escape(id)}"] [data-tm-task-time-field="tomatoSummary"], ` +
            `.tm-whiteboard-stream-task-head[data-id="${CSS.escape(id)}"] [data-tm-task-time-field="tomatoSummary"], ` +
            `.tm-whiteboard-stream-task-node[data-id="${CSS.escape(id)}"] [data-tm-task-time-field="tomatoSummary"]`
        );
        const cardFields = (() => {
            try { return new Set(__tmGetTaskCardFieldList('whiteboard')); } catch (e) { return new Set(); }
        })();
        const dateShouldExist = cardFields.has('date') && __tmShouldRenderTaskCardDate(task);
        if (dateNodes.length) {
            if (!dateShouldExist) return false;
        } else if (dateShouldExist) {
            return false;
        }
        const text = __tmGetTaskCardDateValue(task) || '日期';
        const focusHtml = __tmGetTaskTomatoSummaryHtml(task);
        dateNodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            node.textContent = text;
            __tmApplyTaskCardDateChipState(node, task);
        });
        focusNodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            node.innerHTML = focusHtml;
        });
        return true;
    }

    async function __tmCommitTaskTimeFields(taskId, patch = {}, options = {}) {
        const tid = String(taskId || '').trim();
        if (!tid) return { changed: false, task: null };
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        const opts = (options && typeof options === 'object') ? options : {};
        const task0 = globalThis.__tmRuntimeState?.getTaskById?.(tid, { includePending: true, preferPending: true })
            || state.flatTasks?.[tid]
            || state.pendingInsertedTasks?.[tid]
            || null;
        try {
            const suppressIds = [
                tid,
                String(task0?.attrHostId || '').trim(),
                String(task0?.attr_host_id || '').trim(),
            ].filter(Boolean);
            __tmMarkLocalTimeTxSuppressionIds(suppressIds, [
                String(task0?.root_id || '').trim(),
                String(task0?.docId || '').trim(),
            ]);
            
        } catch (e) {}
        const datePatch = {};
        const metaPatch = {};
        if (Object.prototype.hasOwnProperty.call(nextPatch, 'startDate')) datePatch.startDate = String(nextPatch.startDate || '').trim();
        if (Object.prototype.hasOwnProperty.call(nextPatch, 'completionTime')) datePatch.completionTime = String(nextPatch.completionTime || '').trim();
        if (Object.prototype.hasOwnProperty.call(nextPatch, 'duration')) metaPatch.duration = String(nextPatch.duration || '').trim();
        if (Object.prototype.hasOwnProperty.call(nextPatch, 'tomatoEstimateCount')) metaPatch.tomatoEstimateCount = __tmNormalizeTomatoCountValue(nextPatch.tomatoEstimateCount);
        if (Object.prototype.hasOwnProperty.call(nextPatch, 'customTime')) metaPatch.customTime = String(nextPatch.customTime || '').trim();
        let changed = false;
        if (Object.keys(datePatch).length > 0) {
            await window.tmUpdateTaskDates(tid, datePatch, {
                source: String(opts.source || 'task-time').trim() || 'task-time',
                refresh: false,
                skipNoopCheck: opts.skipNoopCheck === true,
                hard: opts.hard === true,
                broadcast: opts.broadcast !== false,
                queued: opts.queued === true,
                background: opts.background === true,
                skipFlush: opts.skipFlush,
                attrTargetId: String(opts.attrTargetId || '').trim(),
                mirrorTaskAttrs: opts.mirrorTaskAttrs !== false,
                syncMirrorTaskAttrs: opts.syncMirrorTaskAttrs === true,
                renderOptimistic: opts.renderOptimistic !== false,
});
            changed = true;
        }
        if (Object.keys(metaPatch).length > 0) {
            await __tmApplyTaskMetaPatchWithUndo(tid, metaPatch, {
                source: String(opts.source || 'task-time').trim() || 'task-time',
                label: String(opts.label || '时间字段').trim() || '时间字段',
                refresh: false,
                refreshCalendar: false,
                withFilters: false,
                skipNoopCheck: opts.skipNoopCheck === true,
                hard: opts.hard === true,
                broadcast: opts.broadcast !== false,
                queued: opts.queued === true,
                background: opts.background === true,
                skipFlush: opts.skipFlush,
                attrTargetId: String(opts.attrTargetId || '').trim(),
                mirrorTaskAttrs: opts.mirrorTaskAttrs !== false,
                syncMirrorTaskAttrs: opts.syncMirrorTaskAttrs === true,
                renderOptimistic: opts.renderOptimistic !== false,
});
            changed = true;
        }
        return {
            changed,
            task: globalThis.__tmRuntimeState?.getTaskById?.(tid, { includePending: true, preferPending: true })
                || state.flatTasks?.[tid]
                || state.pendingInsertedTasks?.[tid]
                || null,
        };
    }

    function __tmRefreshTaskTimeAcrossViews(taskId, options = {}) {
        const tid = String(taskId || '').trim();
        if (!tid) return false;
        const task = globalThis.__tmRuntimeState?.getTaskById?.(tid, { includePending: true, preferPending: true })
            || state.flatTasks?.[tid]
            || state.pendingInsertedTasks?.[tid]
            || null;
        if (!task) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const viewMode = String(state.viewMode || '').trim();
        const patch = (opts.patch && typeof opts.patch === 'object') ? opts.patch : {};
        const hasCalendarDatePatch = Object.prototype.hasOwnProperty.call(patch, 'startDate')
            || Object.prototype.hasOwnProperty.call(patch, 'completionTime');
        const isKanbanTimeBoard = (() => {
            if (viewMode !== 'kanban') return false;
            try {
                return typeof __tmGetKanbanBoardMode === 'function' && __tmGetKanbanBoardMode() === 'time';
            } catch (e) {
                return false;
            }
        })();
        let refreshed = false;
        let shouldFallback = false;

        if (viewMode === 'timeline') {
            if (__tmCanUpdateTimelineDatesInPlace(task)) refreshed = !!__tmUpdateTimelineTaskInDOM(tid) || refreshed;
            else shouldFallback = true;
        } else if (viewMode === 'list') {
            if (__tmCanUpdateTaskTimeInListLike(task)) refreshed = !!__tmUpdateListTaskTimeInDOM(tid) || refreshed;
            else shouldFallback = true;
        } else if (viewMode === 'checklist') {
            if (__tmCanUpdateTaskTimeInListLike(task)) refreshed = !!__tmUpdateChecklistTaskTimeInDOM(tid) || refreshed;
            else shouldFallback = true;
        } else if (viewMode === 'kanban') {
            if (hasCalendarDatePatch) {
                refreshed = !!__tmUpdateKanbanTaskTimeInDOM(tid, { patch }) || refreshed;
                try { __tmMarkHighPriorityInteraction('kanban-date-local-update', 140); } catch (e) {}
                refreshed = true;
            } else {
                refreshed = !!__tmUpdateKanbanTaskTimeInDOM(tid) || refreshed;
                if (!refreshed) refreshed = !!__tmRerenderCurrentViewInPlace(state.modal) || refreshed;
            }
        } else if (viewMode === 'whiteboard') {
            refreshed = !!__tmUpdateWhiteboardTaskTimeInDOM(tid) || refreshed;
            if (!refreshed) refreshed = !!__tmRerenderCurrentViewInPlace(state.modal) || refreshed;
        }

        try { refreshed = !!__tmRefreshVisibleTaskDetailForTask(tid) || refreshed; } catch (e) {}
if (hasCalendarDatePatch && globalThis.__tmCalendar?.syncTaskDateInPlace) {
            Promise.resolve().then(async () => {
                const isCalendarView = viewMode === 'calendar';
                const syncResult = await globalThis.__tmCalendar.syncTaskDateInPlace(tid, {
                    main: isCalendarView,
                    side: !isCalendarView || __tmShouldShowCalendarSideDock(),
                }).catch(() => null);
                if (!syncResult) {
                    __tmRequestCalendarRefresh({
                        reason: String(opts.reason || 'task-time-calendar-fallback').trim() || 'task-time-calendar-fallback',
                        main: isCalendarView,
                        side: !isCalendarView || __tmShouldShowCalendarSideDock(),
                        flushTaskPanel: false,
                        hard: false,
                    }, { hard: false });
                    return;
                }
if ((syncResult.needsMainRefresh && isCalendarView) || syncResult.needsSideRefresh) {
                    __tmRequestCalendarRefresh({
                        reason: String(opts.reason || 'task-time-calendar-fallback').trim() || 'task-time-calendar-fallback',
                        main: isCalendarView && syncResult.needsMainRefresh,
                        side: syncResult.needsSideRefresh,
                        flushTaskPanel: false,
                        hard: false,
                    }, { hard: false });
                }
            }).catch(() => null);
        }

        if (!refreshed || shouldFallback) {
            try {
                __tmScheduleViewRefresh({
                    mode: 'current',
                    withFilters: opts.withFilters !== false,
                    reason: String(opts.reason || 'task-time-local-refresh').trim() || 'task-time-local-refresh',
                });
            } catch (e) {}
            return false;
        }
        return true;
    }

    const __TM_TASK_PRIORITY_NORMALIZE_MAP = Object.freeze({
        a: 'high',
        b: 'medium',
        c: 'low',
        high: 'high',
        medium: 'medium',
        low: 'low',
        none: '',
        '高': 'high',
        '中': 'medium',
        '低': 'low',
        '无': '',
    });

    function __tmBindTaskDateFollowUpdatedRefresh() {
        try {
            if (window.__tmTaskDateFollowUpdatedRefreshBound) return;
            window.__tmTaskDateFollowUpdatedRefreshBound = true;
            const onTaskDateFollowUpdated = (event) => {
                const detail = (event?.detail && typeof event.detail === 'object') ? event.detail : {};
                const taskId = String(detail.taskId || '').trim();
                const patch0 = (detail.patch && typeof detail.patch === 'object') ? detail.patch : {};
                if (!taskId) return;
                const patch = {};
                if (Object.prototype.hasOwnProperty.call(patch0, 'startDate')) patch.startDate = String(patch0.startDate || '').trim();
                if (Object.prototype.hasOwnProperty.call(patch0, 'completionTime')) patch.completionTime = String(patch0.completionTime || '').trim();
                if (!Object.keys(patch).length) return;
                const reason = String(detail.reason || 'calendar-schedule-dates-follow').trim() || 'calendar-schedule-dates-follow';
                const refreshed = __tmRefreshTaskTimeAcrossViews(taskId, {
                    patch,
                    withFilters: false,
                    reason,
                });
                if (!refreshed) {
                    try {
                        __tmScheduleViewRefresh({
                            mode: 'current',
                            withFilters: true,
                            reason,
                            taskIds: [taskId],
                        });
                    } catch (e) {}
                }
            };
            globalThis.__tmRuntimeEvents?.on?.(window, 'tm:task-date-follow-updated', onTaskDateFollowUpdated);
        } catch (e) {}
    }

    __tmBindTaskDateFollowUpdatedRefresh();

