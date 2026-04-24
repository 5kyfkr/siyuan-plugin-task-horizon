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
        const task = state.flatTasks?.[id];
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
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : (state.flatTasks?.[id] || null);
        const row = rowEl instanceof HTMLElement
            ? rowEl
            : ((state.modal instanceof Element)
                ? state.modal.querySelector(`#tmTaskTable tbody tr[data-id="${CSS.escape(id)}"]`)
                : null);
        if (!(row instanceof HTMLElement)) {
            try { __tmPushRefreshDebug('list-time-patch', { taskId: id, ok: false, reason: 'row-missing' }); } catch (e) {}
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
        setCell('duration', esc(String(task.duration || '')), { html: true });
        const remainingInfo = __tmGetTaskRemainingTimeInfo(task);
        const remainingLabel = String(remainingInfo?.label || '').trim();
        const remainingHtml = __tmRenderTaskRemainingTimeInfoHtml(remainingInfo);
        setCell('remainingTime', remainingHtml, { html: true, title: remainingLabel });
        const ok = touched || !sawNode;
        try {
            __tmPushRefreshDebug('list-time-patch', {
                taskId: id,
                ok,
                reason: ok ? (touched ? 'patched' : 'no-visible-time-nodes') : 'node-missing',
                sawNode,
                touched,
            });
        } catch (e) {}
        return ok;
    }

    function __tmUpdateChecklistTaskTimeInDOM(taskId, itemEl = null, taskLike = null) {
        const id = String(taskId || '').trim();
        if (!id) return false;
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : (state.flatTasks?.[id] || null);
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
        };
        const enabledCompactFields = (!!SettingsStore?.data?.checklistCompactMode)
            ? (globalThis.__tmViewPolicy?.getCompactChecklistMetaFieldSetForCurrentHost?.() || new Set(__tmGetCompactChecklistMetaFieldsForCurrentHost()))
            : null;
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
                } else {
                    node.style.display = 'none';
                    if (options.html === true) node.innerHTML = '';
                    else node.textContent = '';
                }
                touched = true;
            });
            return true;
        };
        const completionText = __tmFormatTaskTime(task.completionTime);
        const durationText = String(task.duration || '').trim();
        const compactStartText = __tmFormatTaskTimeCompact(task.startDate);
        const compactCompletionText = __tmFormatTaskTimeCompact(task.completionTime);
        const compactRemainingText = String(__tmGetTaskRemainingTimeLabel(task) || '').trim();
        const compactDurationText = String(task.duration || '').trim();

        if (!syncNode('completionTime', esc(completionText), { html: true, shouldExist: !!task.completionTime })) valid = false;
        if (!syncNode('duration', `${__tmRenderLucideIcon('timer')} ${esc(durationText)}`, { html: true, shouldExist: !!durationText })) valid = false;
        if (!syncNode('startDateCompact', compactStartText, { shouldExist: !!compactStartText })) valid = false;
        if (!syncNode('completionTimeCompact', compactCompletionText, { shouldExist: !!compactCompletionText })) valid = false;
        if (!syncNode('remainingTimeCompact', compactRemainingText, { shouldExist: !!compactRemainingText && !!(String(task?.startDate || '').trim() || String(task?.completionTime || '').trim()) })) valid = false;
        if (!syncNode('durationCompact', compactDurationText, { shouldExist: !!compactDurationText })) valid = false;
        __tmSyncChecklistMetaContainerVisibility(item);
        return valid && (touched || !sawNode);
    }

    function __tmUpdateKanbanTaskTimeInDOM(taskId) {
        const id = String(taskId || '').trim();
        if (!id) return false;
        const task = state.flatTasks?.[id];
        if (!task || !(state.modal instanceof Element)) return false;
        const card = state.modal.querySelector(`.tm-kanban-card[data-id="${CSS.escape(id)}"]`);
        if (!(card instanceof HTMLElement)) return false;
        const dateNode = card.querySelector('[data-tm-task-time-field="date"]');
        if (!(dateNode instanceof HTMLElement)) return true;
        dateNode.textContent = String(task?.completionTime || task?.startDate || '').trim() || '日期';
        return true;
    }

    function __tmUpdateWhiteboardTaskTimeInDOM(taskId) {
        const id = String(taskId || '').trim();
        if (!id || !(state.modal instanceof Element)) return false;
        const task = state.flatTasks?.[id] || null;
        if (!task) return false;
        const nodes = state.modal.querySelectorAll(
            `.tm-whiteboard-node[data-task-id="${CSS.escape(id)}"] [data-tm-task-time-field="date"], ` +
            `.tm-whiteboard-stream-task-head[data-id="${CSS.escape(id)}"] [data-tm-task-time-field="date"], ` +
            `.tm-whiteboard-stream-task-node[data-id="${CSS.escape(id)}"] [data-tm-task-time-field="date"]`
        );
        if (!nodes.length) return true;
        const text = String(task?.completionTime || task?.startDate || '').trim() || '日期';
        nodes.forEach((node) => {
            if (node instanceof HTMLElement) node.textContent = text;
        });
        return true;
    }

    async function __tmCommitTaskTimeFields(taskId, patch = {}, options = {}) {
        const tid = String(taskId || '').trim();
        if (!tid) return { changed: false, task: null };
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        const opts = (options && typeof options === 'object') ? options : {};
        const task0 = state.flatTasks?.[tid] || null;
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
            __tmPushRefreshDebug('local-time-tx-mark', {
                taskId: tid,
                suppressIds,
                docIds: [String(task0?.root_id || '').trim(), String(task0?.docId || '').trim()].filter(Boolean),
            });
        } catch (e) {}
        const datePatch = {};
        const metaPatch = {};
        if (Object.prototype.hasOwnProperty.call(nextPatch, 'startDate')) datePatch.startDate = String(nextPatch.startDate || '').trim();
        if (Object.prototype.hasOwnProperty.call(nextPatch, 'completionTime')) datePatch.completionTime = String(nextPatch.completionTime || '').trim();
        if (Object.prototype.hasOwnProperty.call(nextPatch, 'duration')) metaPatch.duration = String(nextPatch.duration || '').trim();
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
                renderOptimistic: opts.renderOptimistic !== false,
            });
            changed = true;
        }
        return {
            changed,
            task: state.flatTasks?.[tid] || null,
        };
    }

    function __tmRefreshTaskTimeAcrossViews(taskId, options = {}) {
        const tid = String(taskId || '').trim();
        if (!tid) return false;
        const task = state.flatTasks?.[tid] || null;
        if (!task) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const viewMode = String(state.viewMode || '').trim();
        const patch = (opts.patch && typeof opts.patch === 'object') ? opts.patch : {};
        const hasCalendarDatePatch = Object.prototype.hasOwnProperty.call(patch, 'startDate')
            || Object.prototype.hasOwnProperty.call(patch, 'completionTime');
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
            refreshed = !!__tmUpdateKanbanTaskTimeInDOM(tid) || refreshed;
            if (!refreshed) refreshed = !!__tmRerenderCurrentViewInPlace(state.modal) || refreshed;
        } else if (viewMode === 'whiteboard') {
            refreshed = !!__tmUpdateWhiteboardTaskTimeInDOM(tid) || refreshed;
            if (!refreshed) refreshed = !!__tmRerenderCurrentViewInPlace(state.modal) || refreshed;
        }

        try { refreshed = !!__tmRefreshVisibleTaskDetailForTask(tid) || refreshed; } catch (e) {}
        try {
            __tmPushRefreshDebug('task-time-local-refresh-result', {
                taskId: tid,
                viewMode,
                patch: { ...patch },
                refreshed,
                shouldFallback,
                hasCalendarDatePatch,
                currentRule: !!state.currentRule,
                groupByTime: !!state.groupByTime,
                quadrantEnabled: !!state.quadrantEnabled,
            });
        } catch (e) {}

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
                try {
                    __tmPushRefreshDebug('task-time-calendar-sync-result', {
                        taskId: tid,
                        isCalendarView,
                        syncResult: { ...syncResult },
                    });
                } catch (e) {}
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

