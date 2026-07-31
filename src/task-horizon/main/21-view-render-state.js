    const __TM_VIEW_RENDER_WINDOW_POLICY = Object.freeze({
        list: Object.freeze({ desktopInitial: 80, mobileInitial: 64, desktopGrow: 40, mobileGrow: 32 }),
        checklist: Object.freeze({ desktopInitial: 120, mobileInitial: 20, desktopGrow: 60, mobileGrow: 20 }),
        timeline: Object.freeze({ desktopInitial: 80, mobileInitial: 64, desktopGrow: 40, mobileGrow: 32 }),
    });
    const __TM_PROGRESSIVE_VIEW_BATCH_SIZE = 20;
    const __TM_KANBAN_PROGRESSIVE_BATCH_SIZE = 10;

    function __tmCancelProgressiveViewRender() {
        const job = state?.__tmProgressiveViewRender;
        try {
            if (job?.frameId && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(job.frameId);
        } catch (e) {}
        try {
            if (job?.frameId && typeof clearTimeout === 'function') clearTimeout(job.frameId);
        } catch (e) {}
        try { state.__tmProgressiveViewRender = null; } catch (e) {}
        return true;
    }

    function __tmStartProgressiveViewRender(mode = '') {
        __tmCancelProgressiveViewRender();
        const value = String(mode || state?.viewMode || '').trim();
        const tasks = Array.isArray(state?.filteredTasks) ? state.filteredTasks : [];
        const isKanban = value === 'kanban';
        const batchSize = isKanban ? __TM_KANBAN_PROGRESSIVE_BATCH_SIZE : __TM_PROGRESSIVE_VIEW_BATCH_SIZE;
        if ((value !== 'list' && value !== 'timeline' && !isKanban) || tasks.length <= batchSize) return null;
        const sequence = Math.max(0, Math.round(Number(state.__tmProgressiveViewRenderSeq) || 0)) + 1;
        const job = {
            sequence,
            mode: value,
            tasksRef: tasks,
            batchSize,
            frameId: 0,
            columns: isKanban ? [] : null,
            columnCursor: 0,
        };
        state.__tmProgressiveViewRenderSeq = sequence;
        state.__tmProgressiveViewRender = job;
        return job;
    }

    function __tmRegisterKanbanProgressiveColumn(job, column) {
        if (!__tmIsProgressiveViewRenderCurrent(job, 'kanban')) return false;
        if (!column || typeof column.loadNextBatch !== 'function') return false;
        const key = String(column.key || '').trim();
        if (!key) return false;
        if (!Array.isArray(job.columns)) job.columns = [];
        const entry = { key, loadNextBatch: column.loadNextBatch, done: false };
        const existingIndex = job.columns.findIndex((item) => String(item?.key || '').trim() === key);
        if (existingIndex >= 0) job.columns[existingIndex] = entry;
        else job.columns.push(entry);
        return true;
    }

    function __tmIsProgressiveViewRenderCurrent(job, mode = '') {
        const current = state?.__tmProgressiveViewRender;
        const value = String(mode || state?.viewMode || '').trim();
        return !!job
            && current === job
            && String(job.mode || '').trim() === value
            && Array.isArray(state?.filteredTasks)
            && state.filteredTasks === job.tasksRef;
    }

    function __tmFinishProgressiveViewRender(job, mode = '') {
        if (!__tmIsProgressiveViewRenderCurrent(job, mode)) return false;
        __tmCancelProgressiveViewRender();
        const modal = state?.modal;
        try { __tmApplyReminderTaskNameMarks(modal); } catch (e) {}
        try { __tmScheduleReminderTaskNameMarksRefresh(modal); } catch (e) {}
        try { __tmApplyTodayScheduledTaskNameMarks(modal); } catch (e) {}
        try { __tmScheduleTodayScheduledTaskNameMarksRefresh(modal); } catch (e) {}
        try { __tmBindFloatingTooltipsAfterLocalRerender(modal); } catch (e) {}
        return true;
    }

    function __tmScheduleProgressiveViewRender(mode = '', job = null) {
        if (!__tmIsProgressiveViewRenderCurrent(job, mode)) return false;
        if (job.frameId) return true;
        if (String(mode || '').trim() === 'kanban') {
            const runKanbanBatch = () => {
                job.frameId = 0;
                if (!__tmIsProgressiveViewRenderCurrent(job, 'kanban')) return;
                const columns = Array.isArray(job.columns) ? job.columns : [];
                if (!columns.some((column) => column?.done !== true)) {
                    __tmFinishProgressiveViewRender(job, 'kanban');
                    return;
                }
                for (let attempts = 0; attempts < columns.length; attempts += 1) {
                    const index = Math.max(0, Number(job.columnCursor) || 0) % columns.length;
                    job.columnCursor = (index + 1) % columns.length;
                    const column = columns[index];
                    if (!column || column.done === true) continue;
                    let result = null;
                    try { result = column.loadNextBatch(state?.modal); } catch (e) {}
                    if (!result || result.done === true) column.done = true;
                    break;
                }
                if (!__tmIsProgressiveViewRenderCurrent(job, 'kanban')) return;
                try { job.frameId = requestAnimationFrame(runKanbanBatch); } catch (e) {
                    try { job.frameId = setTimeout(runKanbanBatch, 16); } catch (e2) { __tmCancelProgressiveViewRender(); }
                }
            };
            try {
                job.frameId = requestAnimationFrame(() => {
                    if (!__tmIsProgressiveViewRenderCurrent(job, 'kanban')) return;
                    try { job.frameId = requestAnimationFrame(runKanbanBatch); } catch (e) { runKanbanBatch(); }
                });
            } catch (e) {
                try { job.frameId = setTimeout(runKanbanBatch, 0); } catch (e2) { __tmCancelProgressiveViewRender(); }
            }
            return true;
        }
        const run = () => {
            job.frameId = 0;
            if (!__tmIsProgressiveViewRenderCurrent(job, mode)) return;
            const total = Array.isArray(state?.filteredTasks) ? state.filteredTasks.length : 0;
            const limit = Math.max(0, Math.round(Number(state?.listRenderLimit) || 0));
            const runtimeWindow = typeof window !== 'undefined' ? window : null;
            const loadMore = mode === 'timeline'
                ? runtimeWindow?.tmTimelineLoadMoreRows
                : runtimeWindow?.tmListLoadMoreRows;
            if (limit >= total || typeof loadMore !== 'function') {
                __tmFinishProgressiveViewRender(job, mode);
                return;
            }
            try { loadMore(); } catch (e) {}
            if (!__tmIsProgressiveViewRenderCurrent(job, mode)) return;
            try {
                job.frameId = requestAnimationFrame(run);
            } catch (e) {
                try { setTimeout(run, 16); } catch (e2) { __tmCancelProgressiveViewRender(); }
            }
        };
        try {
            job.frameId = requestAnimationFrame(() => {
                if (!__tmIsProgressiveViewRenderCurrent(job, mode)) return;
                try { job.frameId = requestAnimationFrame(run); } catch (e) { run(); }
            });
        } catch (e) {
            try { job.frameId = setTimeout(run, 0); } catch (e2) { __tmCancelProgressiveViewRender(); }
        }
        return true;
    }

    function __tmIsListLikeViewMode(mode) {
        const value = String(mode || state?.viewMode || '').trim();
        return value === 'list' || value === 'checklist' || value === 'timeline';
    }

    function __tmGetViewRenderWindowPolicy(mode = '') {
        const value = String(mode || state?.viewMode || 'list').trim() || 'list';
        const source = __TM_VIEW_RENDER_WINDOW_POLICY[value] || __TM_VIEW_RENDER_WINDOW_POLICY.list;
        let mobileLike = false;
        try {
            mobileLike = !!(__tmIsMobileDevice() || __tmIsRuntimeMobileClient() || __tmHostUsesMobileUI());
        } catch (e) {}
        const progressiveJob = state?.__tmProgressiveViewRender;
        const isProgressive = progressiveJob
            && String(progressiveJob.mode || '').trim() === value
            && Array.isArray(state?.filteredTasks)
            && state.filteredTasks === progressiveJob.tasksRef;
        return {
            mode: value,
            initial: isProgressive ? progressiveJob.batchSize : (mobileLike ? source.mobileInitial : source.desktopInitial),
            grow: isProgressive ? progressiveJob.batchSize : (mobileLike ? source.mobileGrow : source.desktopGrow),
        };
    }

    function __tmResetViewRenderWindow(mode = '', totalInput = null) {
        const value = String(mode || state?.viewMode || '').trim();
        if (!__tmIsListLikeViewMode(value)) return null;
        const policy = __tmGetViewRenderWindowPolicy(value);
        const total = Number.isFinite(Number(totalInput))
            ? Math.max(0, Math.round(Number(totalInput)))
            : Math.max(0, Array.isArray(state?.filteredTasks) ? state.filteredTasks.length : 0);
        state.listRenderStep = policy.initial;
        state.listRenderLimit = total > 0 ? Math.min(total, policy.initial) : policy.initial;
        return {
            ...policy,
            total,
            limit: state.listRenderLimit,
        };
    }

    function __tmGetViewRenderWindow(mode = '', totalInput = null) {
        const value = String(mode || state?.viewMode || '').trim();
        if (!__tmIsListLikeViewMode(value)) return null;
        const policy = __tmGetViewRenderWindowPolicy(value);
        const total = Number.isFinite(Number(totalInput))
            ? Math.max(0, Math.round(Number(totalInput)))
            : Math.max(0, Array.isArray(state?.filteredTasks) ? state.filteredTasks.length : 0);
        const currentLimit = Math.max(
            Math.min(total || policy.initial, policy.initial),
            Math.min(total || policy.initial, Number(state?.listRenderLimit) || policy.initial)
        );
        return {
            ...policy,
            total,
            limit: currentLimit,
            remaining: Math.max(0, total - currentLimit),
        };
    }

    function __tmGetViewRenderWindowContextKey(mode = '') {
        const value = String(mode || state?.viewMode || '').trim();
        const groupId = typeof SettingsStore !== 'undefined'
            ? String(SettingsStore?.data?.currentGroupId || 'all').trim() || 'all'
            : 'all';
        return [
            value,
            groupId,
            String(state?.activeDocId || 'all').trim() || 'all',
            String(state?.currentRule || '').trim(),
            String(state?.searchKeyword || '').trim(),
        ].join('|');
    }

    function __tmCaptureViewRenderWindow(mode = '') {
        const value = String(mode || state?.viewMode || '').trim();
        if (!__tmIsListLikeViewMode(value)) return null;
        const total = Math.max(0, Array.isArray(state?.filteredTasks) ? state.filteredTasks.length : 0);
        const current = __tmGetViewRenderWindow(value, total);
        if (!current) return null;
        return {
            mode: value,
            contextKey: __tmGetViewRenderWindowContextKey(value),
            limit: current.limit,
            step: Math.max(1, Math.round(Number(state?.listRenderStep) || current.initial)),
        };
    }

    function __tmRestoreViewRenderWindow(snapshot, totalInput = null) {
        const saved = (snapshot && typeof snapshot === 'object') ? snapshot : null;
        const mode = String(saved?.mode || '').trim();
        if (!saved || !__tmIsListLikeViewMode(mode)) return false;
        if (String(state?.viewMode || '').trim() !== mode) return false;
        if (String(saved.contextKey || '') !== __tmGetViewRenderWindowContextKey(mode)) return false;
        const policy = __tmGetViewRenderWindowPolicy(mode);
        const total = Number.isFinite(Number(totalInput))
            ? Math.max(0, Math.round(Number(totalInput)))
            : Math.max(0, Array.isArray(state?.filteredTasks) ? state.filteredTasks.length : 0);
        const savedLimit = Math.max(policy.initial, Math.round(Number(saved.limit) || policy.initial));
        state.listRenderStep = Math.max(1, Math.round(Number(saved.step) || policy.initial));
        state.listRenderLimit = total > 0 ? Math.min(total, savedLimit) : policy.initial;
        return true;
    }

    function __tmSliceTaskRowModelByTaskWindow(rowModelInput, startInput = 0, endInput = Number.POSITIVE_INFINITY) {
        const rowModel = Array.isArray(rowModelInput) ? rowModelInput : [];
        const start = Math.max(0, Math.round(Number(startInput) || 0));
        const endNumber = Number(endInput);
        const end = Number.isFinite(endNumber) ? Math.max(start, Math.round(endNumber)) : Number.POSITIVE_INFINITY;
        const rows = [];
        let pendingGroups = [];
        let taskIndex = 0;
        let stoppedAtWindowEnd = false;
        for (const row of rowModel) {
            if (row?.type === 'group') {
                pendingGroups.push(row);
                continue;
            }
            if (row?.type !== 'task') continue;
            if (taskIndex >= end) {
                stoppedAtWindowEnd = true;
                break;
            }
            if (taskIndex >= start) {
                if (pendingGroups.length) rows.push(...pendingGroups);
                rows.push(row);
            }
            pendingGroups = [];
            taskIndex += 1;
        }
        const ownsTrailingGroups = taskIndex === 0
            ? start === 0 && end > start
            : taskIndex > start && taskIndex <= end;
        if (!stoppedAtWindowEnd && pendingGroups.length && ownsTrailingGroups) {
            rows.push(...pendingGroups);
        }
        return {
            rows,
            start,
            end,
            visitedTaskCount: taskIndex,
            selectedTaskCount: rows.reduce((count, row) => count + (row?.type === 'task' ? 1 : 0), 0),
        };
    }

    function __tmGrowViewRenderWindow(mode = '', totalInput = null) {
        const current = __tmGetViewRenderWindow(mode, totalInput);
        if (!current) return null;
        const nextLimit = Math.min(current.total, current.limit + current.grow);
        state.listRenderStep = current.initial;
        state.listRenderLimit = nextLimit;
        return {
            ...current,
            previousLimit: current.limit,
            limit: nextLimit,
            remaining: Math.max(0, current.total - nextLimit),
        };
    }
