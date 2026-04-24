    function __tmGetTaskRepeatRule(taskLike, options = {}) {
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : {};
        return __tmNormalizeTaskRepeatRule(task.repeatRule || task.repeat_rule || '', {
            startDate: task?.startDate,
            completionTime: task?.completionTime,
            ...((options && typeof options === 'object') ? options : {}),
        });
    }

    async function __tmResolveTaskForRepeat(taskId) {
        const requestedId = String(taskId || '').trim();
        if (!requestedId) return null;
        let task = globalThis.__tmRuntimeState?.getTaskById?.(requestedId) || state.flatTasks?.[requestedId] || state.pendingInsertedTasks?.[requestedId] || null;
        if (!task) {
            try { task = await __tmEnsureTaskInStateById(requestedId); } catch (e) { task = null; }
        }
        if (!task) {
            try { task = await __tmBuildTaskLikeFromBlockId(requestedId); } catch (e) { task = null; }
        }
        if (!task) return null;
        try { MetaStore.applyToTask(task); } catch (e) {}
        try { normalizeTaskFields(task, String(task.doc_name || task.docName || '').trim()); } catch (e) {}
        return task;
    }

    async function __tmApplyTaskRepeatRule(taskId, ruleInput, options = {}) {
        const task = await __tmResolveTaskForRepeat(taskId);
        if (!task?.id) throw new Error('未找到任务');
        const opts = (options && typeof options === 'object') ? options : {};
        const nextRule = __tmNormalizeTaskRepeatRule(ruleInput, {
            startDate: task?.startDate,
            completionTime: task?.completionTime,
        });
        const nextState = __tmNormalizeTaskRepeatState({
            ...(task?.repeatState && typeof task.repeatState === 'object' ? task.repeatState : {}),
            lastInstanceStart: __tmNormalizeDateOnly(task?.startDate || ''),
            lastInstanceDue: __tmNormalizeDateOnly(task?.completionTime || ''),
        });
        const patch = {
            repeatRule: nextRule,
            repeatState: nextState,
        };
        const result = await __tmApplyTaskMetaPatchWithUndo(task.id, patch, {
            source: String(opts.source || 'task-repeat').trim() || 'task-repeat',
            label: '循环规则',
            refresh: opts.refresh !== false,
            refreshCalendar: opts.refreshCalendar !== false,
            withFilters: opts.withFilters !== false,
            hard: opts.hard === true,
            recordUndo: opts.recordUndo !== false,
        });
        return {
            ...result,
            rule: nextRule,
            state: nextState,
            summary: __tmGetTaskRepeatSummary(nextRule, {
                startDate: task?.startDate,
                completionTime: task?.completionTime,
            }),
        };
    }

    async function __tmDeleteTaskRepeatHistoryEntry(taskId, completedAt, options = {}) {
        const task = await __tmResolveTaskForRepeat(taskId);
        if (!task?.id) throw new Error('未找到任务');
        const key = String(completedAt || '').trim();
        const currentHistory = __tmNormalizeTaskRepeatHistory(task?.repeatHistory || task?.repeat_history || '');
        const nextHistory = currentHistory.filter((item) => String(item?.completedAt || '').trim() !== key);
        if (nextHistory.length === currentHistory.length) return false;
        await __tmApplyTaskMetaPatchWithUndo(task.id, {
            repeatHistory: nextHistory,
        }, {
            source: String(options?.source || 'task-repeat-history-delete').trim() || 'task-repeat-history-delete',
            label: '删除循环记录',
            refresh: false,
            refreshCalendar: false,
            withFilters: true,
            hard: false,
            recordUndo: options?.recordUndo !== false,
        });
        __tmPurgeRecurringInstanceTasks(task.id, [key]);
        try {
            __tmRefreshViewsAfterTaskMutation({
                refresh: true,
                refreshCalendar: true,
                withFilters: true,
                hard: false,
            });
        } catch (e) {}
        return true;
    }

    const __tmRecurringAdvanceTimers = new Map();

    function __tmClearRecurringTaskAdvanceTimer(taskId) {
        const tid = String(taskId || '').trim();
        if (!tid) return false;
        const timer = __tmRecurringAdvanceTimers.get(tid);
        if (!timer) return false;
        try { clearTimeout(timer); } catch (e) {}
        __tmRecurringAdvanceTimers.delete(tid);
        return true;
    }

    async function __tmAdvanceRecurringTaskAfterCompletion(taskId, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (String(opts.source || '').trim() === 'task-repeat-advance') return false;
        const waited = await __tmWaitForGlobalUnlock(12000);
        if (!waited) return false;
        let task = await __tmResolveTaskForRepeat(taskId);
        try {
            const latestTaskId = await __tmResolveTaskIdFromAnyBlockId(String(task?.id || taskId || '').trim());
            if (latestTaskId && latestTaskId !== String(task?.id || '').trim()) {
                const latestTask = await __tmResolveTaskForRepeat(latestTaskId);
                if (latestTask?.id) task = latestTask;
            }
        } catch (e) {}
        if (!task?.id || !task.done) return false;
        const repeatRule = __tmGetTaskRepeatRule(task);
        if (!repeatRule.enabled || repeatRule.type === 'none') return false;
        const completedAt = String(opts.completedAt || __tmNowInChinaTimezoneIso()).trim() || __tmNowInChinaTimezoneIso();
        const nextPatch = __tmBuildTaskRepeatAdvancePatch(task, repeatRule, { completedAt });
        if (!nextPatch) return false;
        const nextHistory = __tmNormalizeTaskRepeatHistory([
            {
                completedAt,
                sourceStart: __tmNormalizeDateOnly(task?.startDate || ''),
                sourceDue: __tmNormalizeDateOnly(task?.completionTime || ''),
                nextStart: __tmNormalizeDateOnly(nextPatch.startDate || ''),
                nextDue: __tmNormalizeDateOnly(nextPatch.completionTime || ''),
            },
            ...__tmNormalizeTaskRepeatHistory(task?.repeatHistory || task?.repeat_history || ''),
        ]);
        const historyHead = nextHistory[0] || null;
        nextPatch.repeatHistory = nextHistory;
        await __tmApplyTaskMetaPatchWithUndo(task.id, nextPatch, {
            source: 'task-repeat-advance',
            label: '循环推进',
            refresh: false,
            refreshCalendar: false,
            withFilters: true,
            hard: false,
            recordUndo: false,
        });
        try {
            task.startDate = String(nextPatch.startDate || '').trim();
            task.start_date = task.startDate;
            task.completionTime = String(nextPatch.completionTime || '').trim();
            task.completion_time = task.completionTime;
            task.repeatState = __tmNormalizeTaskRepeatState(nextPatch.repeatState);
            task.repeat_state = task.repeatState;
            task.repeatHistory = __tmNormalizeTaskRepeatHistory(nextPatch.repeatHistory);
            task.repeat_history = task.repeatHistory;
            if (state.flatTasks?.[task.id]) state.flatTasks[task.id] = task;
            if (state.pendingInsertedTasks?.[task.id]) {
                state.pendingInsertedTasks[task.id].startDate = task.startDate;
                state.pendingInsertedTasks[task.id].start_date = task.startDate;
                state.pendingInsertedTasks[task.id].completionTime = task.completionTime;
                state.pendingInsertedTasks[task.id].completion_time = task.completionTime;
                state.pendingInsertedTasks[task.id].repeatState = task.repeatState;
                state.pendingInsertedTasks[task.id].repeat_state = task.repeatState;
                state.pendingInsertedTasks[task.id].repeatHistory = task.repeatHistory;
                state.pendingInsertedTasks[task.id].repeat_history = task.repeatHistory;
            }
            try {
                MetaStore.set(task.id, {
                    startDate: task.startDate,
                    completionTime: task.completionTime,
                    repeatState: task.repeatState,
                    repeatHistory: task.repeatHistory,
                });
            } catch (e) {}
        } catch (e) {}
        if (historyHead && String(opts?.scheduleId || '').trim()) {
            try { await __tmReassignCompletedScheduleToRecurringInstance(String(opts.scheduleId || '').trim(), task, historyHead); } catch (e) {}
        }
        let resetTaskId = String(task.id || '').trim();
        try {
            const resolvedResetTaskId = await __tmResolveTaskIdFromAnyBlockId(resetTaskId);
            if (resolvedResetTaskId) resetTaskId = String(resolvedResetTaskId || '').trim() || resetTaskId;
        } catch (e) {}
        if (!resetTaskId) resetTaskId = String(task.id || '').trim();
        const __tmSyncRecurringMainTaskDoneState = (nextDone) => {
            const value = !!nextDone;
            const syncIds = Array.from(new Set([
                String(resetTaskId || '').trim(),
                String(task?.id || '').trim(),
            ].filter(Boolean)));
            try {
                if (task && typeof task === 'object') task.done = value;
            } catch (e) {}
            syncIds.forEach((targetId) => {
                try {
                    if (state.flatTasks?.[targetId]) state.flatTasks[targetId].done = value;
                } catch (e) {}
                try {
                    if (state.pendingInsertedTasks?.[targetId]) state.pendingInsertedTasks[targetId].done = value;
                } catch (e) {}
                try {
                    if (!state.doneOverrides || typeof state.doneOverrides !== 'object') state.doneOverrides = {};
                    state.doneOverrides[targetId] = value;
                } catch (e) {}
                try { MetaStore.set(targetId, { done: value }); } catch (e) {}
            });
        };
        let resetDoneOk = false;
        try {
            await __tmSetDoneKernel(resetTaskId, false, null, {
                force: true,
                suppressHint: true,
                source: 'task-repeat-advance',
                recordUndo: false,
                refreshMode: 'local',
            });
        } catch (e) {}
        try {
            const latest = globalThis.__tmRuntimeState?.getFlatTaskById?.(resetTaskId)
                || globalThis.__tmRuntimeState?.getFlatTaskById?.(task.id)
                || state.flatTasks?.[resetTaskId]
                || state.flatTasks?.[task.id]
                || null;
            resetDoneOk = !!latest && latest.done !== true;
        } catch (e) {}
        if (resetDoneOk) {
            __tmSyncRecurringMainTaskDoneState(false);
        }
        if (!resetDoneOk) {
            try {
                resetDoneOk = await __tmSetDoneByIdStateless(resetTaskId, false);
            } catch (e) {
                resetDoneOk = false;
            }
            if (resetDoneOk) {
                __tmSyncRecurringMainTaskDoneState(false);
            }
        }
        if (!resetDoneOk) {
            try {
                hint('⚠ 循环推进后未能自动取消主任务完成，请手动取消勾选', 'warning');
            } catch (e) {}
            return false;
        }
        try {
            const calendarOnlyRefresh = String(opts?.source || '').trim() === 'calendar'
                && (globalThis.__tmRuntimeState?.isViewMode?.('calendar') ?? (String(state.viewMode || '').trim() === 'calendar'));
            const shouldRefreshCalendarSide = !!(calendarOnlyRefresh || __tmShouldShowCalendarSideDock());
            if (globalThis.__tmCalendar && (typeof globalThis.__tmCalendar.requestRefresh === 'function' || typeof globalThis.__tmCalendar.refreshInPlace === 'function')) {
                __tmRequestCalendarRefresh({
                    reason: 'task-repeat-advance',
                    main: calendarOnlyRefresh,
                    side: shouldRefreshCalendarSide,
                    flushTaskPanel: true,
                    hard: false,
                }, { hard: false });
            }
        } catch (e) {}
        try {
            __tmRefreshTaskFieldsAcrossViews(resetTaskId, {
                done: false,
                startDate: nextPatch.startDate,
                completionTime: nextPatch.completionTime,
                repeatState: nextPatch.repeatState,
                repeatHistory: nextPatch.repeatHistory,
            }, {
                withFilters: true,
                reason: 'task-repeat-advance',
                forceProjectionRefresh: __tmDoesPatchAffectProjection(resetTaskId, {
                    done: false,
                    startDate: nextPatch.startDate,
                    completionTime: nextPatch.completionTime,
                }),
                fallback: true,
            });
        } catch (e) {}
        try {
            const summary = __tmGetTaskRepeatSummary(repeatRule, {
                startDate: nextPatch.startDate,
                completionTime: nextPatch.completionTime,
            });
            hint(`🔁 已推进到下一次${summary ? `：${summary}` : ''}`, 'success');
        } catch (e) {}
        return true;
    }

    function __tmScheduleRecurringTaskAdvanceAfterCompletion(taskId, options = {}) {
        const tid = String(taskId || '').trim();
        if (!tid) return;
        const opts = (options && typeof options === 'object') ? options : {};
        __tmClearRecurringTaskAdvanceTimer(tid);
        try {
            const timer = setTimeout(() => {
                __tmRecurringAdvanceTimers.delete(tid);
                __tmAdvanceRecurringTaskAfterCompletion(tid, opts).catch(() => null);
            }, Math.max(120, Number(opts.delayMs) || 280));
            __tmRecurringAdvanceTimers.set(tid, timer);
        } catch (e) {}
    }

    function __tmBuildTaskRepeatDueAdvancePatch(taskLike, ruleInput, options = {}) {
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : {};
        const rule = __tmNormalizeTaskRepeatRule(ruleInput, {
            startDate: task?.startDate,
            completionTime: task?.completionTime,
        });
        if (!rule.enabled || rule.trigger !== 'due' || rule.type === 'none') return null;
        const todayKey = __tmNormalizeDateOnly(options.todayKey || new Date());
        if (!todayKey) return null;
        let nextTask = {
            ...task,
            startDate: __tmNormalizeDateOnly(task?.startDate || ''),
            completionTime: __tmNormalizeDateOnly(task?.completionTime || ''),
            repeatState: __tmNormalizeTaskRepeatState(task?.repeatState),
        };
        let compareKey = __tmNormalizeDateOnly(nextTask?.completionTime || nextTask?.startDate || '');
        if (!compareKey || compareKey >= todayKey) return null;
        let advancedCount = 0;
        let guard = 0;
        while (compareKey && compareKey < todayKey && guard < 400) {
            const patch = __tmBuildTaskRepeatAdvancePatch(nextTask, rule, {
                advancedAt: String(options.advancedAt || new Date().toISOString()).trim() || new Date().toISOString(),
                completedAt: String(nextTask?.repeatState?.lastCompletedAt || '').trim(),
            });
            if (!patch) break;
            nextTask = {
                ...nextTask,
                startDate: __tmNormalizeDateOnly(patch.startDate || ''),
                completionTime: __tmNormalizeDateOnly(patch.completionTime || ''),
                repeatState: __tmNormalizeTaskRepeatState(patch.repeatState),
            };
            compareKey = __tmNormalizeDateOnly(nextTask?.completionTime || nextTask?.startDate || '');
            advancedCount += 1;
            guard += 1;
        }
        if (!advancedCount) return null;
        return {
            startDate: nextTask.startDate,
            completionTime: nextTask.completionTime,
            repeatState: nextTask.repeatState,
            __advancedCount: advancedCount,
        };
    }

    let __tmRecurringDueReconcilePromise = null;
    async function __tmReconcileRecurringTasksOnLoad(taskIdsInput, options = {}) {
        if (__tmRecurringDueReconcilePromise) return await __tmRecurringDueReconcilePromise;
        const taskIds = Array.from(new Set((Array.isArray(taskIdsInput) ? taskIdsInput : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean)));
        if (!taskIds.length) return 0;
        const opts = (options && typeof options === 'object') ? options : {};
        const job = (async () => {
            let changed = 0;
            const todayKey = __tmNormalizeDateOnly(opts.todayKey || new Date());
            for (const taskId of taskIds) {
                const task = await __tmResolveTaskForRepeat(taskId);
                if (!task?.id || task.done) continue;
                const rule = __tmGetTaskRepeatRule(task);
                if (!rule.enabled || rule.trigger !== 'due' || rule.type === 'none') continue;
                const patch = __tmBuildTaskRepeatDueAdvancePatch(task, rule, { todayKey });
                if (!patch) continue;
                await __tmApplyTaskMetaPatchWithUndo(task.id, patch, {
                    source: 'task-repeat-due',
                    label: '循环推进',
                    refresh: false,
                    refreshCalendar: false,
                    withFilters: true,
                    hard: false,
                    recordUndo: false,
                    broadcast: true,
                });
                changed += 1;
            }
            return changed;
        })();
        __tmRecurringDueReconcilePromise = job;
        try {
            return await job;
        } finally {
            if (__tmRecurringDueReconcilePromise === job) __tmRecurringDueReconcilePromise = null;
        }
    }

    window.tmGetTaskRepeatRule = async function(taskId) {
        const task = await __tmResolveTaskForRepeat(taskId);
        if (!task?.id) return null;
        const rule = __tmGetTaskRepeatRule(task);
        return {
            ...rule,
            summary: __tmGetTaskRepeatSummary(rule, {
                startDate: task?.startDate,
                completionTime: task?.completionTime,
            }),
        };
    };

    window.tmSetTaskRepeatRule = async function(taskId, ruleInput = {}, options = {}) {
        return await __tmApplyTaskRepeatRule(taskId, ruleInput, options);
    };

    window.tmClearTaskRepeatRule = async function(taskId, options = {}) {
        return await __tmApplyTaskRepeatRule(taskId, { enabled: false, type: 'none' }, options);
    };

    window.tmEditTaskRepeatRule = async function(taskId, options = {}) {
        const task = await __tmResolveTaskForRepeat(taskId);
        if (!task?.id) {
            hint('⚠ 未找到任务', 'warning');
            return null;
        }
        const nextRule = await showTaskRepeatRuleDialog(task, {
            title: String(options?.title || '循环设置').trim() || '循环设置',
        });
        if (nextRule === null) return null;
        if (!nextRule.enabled || nextRule.type === 'none') {
            return await window.tmClearTaskRepeatRule(task.id, { source: 'task-repeat-dialog' });
        }
        return await window.tmSetTaskRepeatRule(task.id, {
            ...nextRule,
            anchorDate: task?.completionTime || task?.startDate || __tmNormalizeDateOnly(new Date()),
        }, { source: 'task-repeat-dialog' });
    };

    window.tmCalendarWarmDocsToGroupCache = async function() {
        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        const parts = [];
        for (const g of groups) {
            const gid = String(g?.id || '').trim();
            if (!gid) continue;
            const ds = __tmGetGroupSourceEntries(g).map((d) => {
                const did = String(d?.id || '').trim();
                if (!did) return '';
                return did + (d.kind === 'notebook' ? '#nb' : (d.recursive ? '*' : ''));
            }).filter(Boolean);
            parts.push(`${gid}:${ds.join(',')}`);
        }
        const key = parts.join('|');
        const prev = window.__tmCalendarDocsToGroupCache;
        if (prev && prev.key === key && prev.map instanceof Map) return true;

        const map = new Map();
        for (const g of groups) {
            const gid = String(g?.id || '').trim();
            if (!gid) continue;
            const entries = __tmGetGroupSourceEntries(g);
            for (const entry of entries) {
                await __tmExpandSourceEntryDocIds(entry, (did0) => {
                    const did = String(did0 || '').trim();
                    if (!did || map.has(did)) return;
                    map.set(did, gid);
                });
            }
        }
        window.__tmCalendarDocsToGroupCache = { key, map };
        return true;
    };

    let __tmCalendarSidebarDocItemsWarmPromise = null;

