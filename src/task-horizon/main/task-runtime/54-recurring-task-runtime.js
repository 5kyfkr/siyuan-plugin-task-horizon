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

    function __tmBuildRecurringTaskRollbackPatch(task, removedEntry, nextHistory = []) {
        const removed = (removedEntry && typeof removedEntry === 'object') ? removedEntry : null;
        if (!removed) return null;
        const nextHead = Array.isArray(nextHistory) && nextHistory.length > 0 ? nextHistory[0] : null;
        const rollbackStart = __tmNormalizeDateOnly(
            nextHead?.nextStart
            || nextHead?.sourceStart
            || removed.sourceStart
            || removed.nextStart
            || task?.startDate
            || ''
        );
        const rollbackDue = __tmNormalizeDateOnly(
            nextHead?.nextDue
            || nextHead?.sourceDue
            || removed.sourceDue
            || removed.nextDue
            || task?.completionTime
            || ''
        );
        if (!rollbackStart && !rollbackDue) return null;
        const carryCompletedAt = String(nextHead?.completedAt || '').trim();
        const currentState = __tmNormalizeTaskRepeatState(task?.repeatState);
        return {
            startDate: rollbackStart,
            completionTime: rollbackDue,
            repeatState: __tmNormalizeTaskRepeatState({
                ...currentState,
                occurrenceCount: Math.max(1, currentState.occurrenceCount - 1),
                lastCompletedAt: carryCompletedAt,
                lastAdvancedAt: carryCompletedAt,
                lastInstanceStart: rollbackStart,
                lastInstanceDue: rollbackDue,
            }),
        };
    }

    function __tmGetTaskRepeatScheduleSignature(ruleInput) {
        const rule = __tmNormalizeTaskRepeatRule(ruleInput);
        return JSON.stringify([
            rule.enabled,
            rule.type,
            rule.every,
            rule.monthlyMode,
            rule.calendarMode,
            rule.anchorDate,
        ]);
    }

    function __tmBuildTaskRepeatRuleMetaPatch(taskInput, ruleInput) {
        const task = (taskInput && typeof taskInput === 'object') ? taskInput : {};
        const nextRule = __tmNormalizeTaskRepeatRule(ruleInput, {
            startDate: task?.startDate,
            completionTime: task?.completionTime,
        });
        const currentRule = __tmNormalizeTaskRepeatRule(task?.repeatRule, {
            startDate: task?.startDate,
            completionTime: task?.completionTime,
        });
        const currentState = __tmNormalizeTaskRepeatState(task?.repeatState);
        const scheduleChanged = __tmGetTaskRepeatScheduleSignature(currentRule) !== __tmGetTaskRepeatScheduleSignature(nextRule);
        let occurrenceCount = currentState.occurrenceCount;
        if (scheduleChanged || (nextRule.maxOccurrences > 0 && currentRule.maxOccurrences <= 0)) {
            occurrenceCount = 1;
        } else if (nextRule.maxOccurrences > 0 && nextRule.maxOccurrences < occurrenceCount) {
            throw new Error(`结束次数不能小于当前第 ${occurrenceCount} 次`);
        }
        const nextState = __tmNormalizeTaskRepeatState({
            ...currentState,
            occurrenceCount,
            lastInstanceStart: __tmNormalizeDateOnly(task?.startDate || ''),
            lastInstanceDue: __tmNormalizeDateOnly(task?.completionTime || ''),
        });
        return {
            repeatRule: nextRule,
            repeatState: nextState,
        };
    }

    async function __tmApplyTaskRepeatRule(taskId, ruleInput, options = {}) {
        const task = await __tmResolveTaskForRepeat(taskId);
        if (!task?.id) throw new Error('未找到任务');
        const opts = (options && typeof options === 'object') ? options : {};
        const patch = __tmBuildTaskRepeatRuleMetaPatch(task, ruleInput);
        const nextRule = patch.repeatRule;
        const nextState = patch.repeatState;
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
        const removedIndex = currentHistory.findIndex((item) => String(item?.completedAt || '').trim() === key);
        const removedEntry = removedIndex >= 0 ? currentHistory[removedIndex] : null;
        const nextHistory = removedIndex >= 0
            ? currentHistory.filter((_, index) => index !== removedIndex)
            : currentHistory.filter((item) => String(item?.completedAt || '').trim() !== key);
        if (nextHistory.length === currentHistory.length) return false;
        const nextPatch = {
            repeatHistory: nextHistory,
        };
        if (removedIndex === 0) {
            const rollbackPatch = __tmBuildRecurringTaskRollbackPatch(task, removedEntry, nextHistory);
            if (rollbackPatch) Object.assign(nextPatch, rollbackPatch);
        }
        await __tmApplyTaskMetaPatchWithUndo(task.id, nextPatch, {
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

    async function __tmSetDetachedTaskRepeatHistoryEntry(taskId, done, entryInput = {}, options = {}) {
        const task = await __tmResolveTaskForRepeat(taskId);
        if (!task?.id) throw new Error('未找到任务');
        const opts = (options && typeof options === 'object') ? options : {};
        const entry = (entryInput && typeof entryInput === 'object') ? entryInput : {};
        const completedAt = String(entry.completedAt || opts.completedAt || __tmNowInChinaTimezoneIso()).trim() || __tmNowInChinaTimezoneIso();
        const currentHistory = __tmNormalizeTaskRepeatHistory(task?.repeatHistory || task?.repeat_history || '');
        const withoutEntry = currentHistory.filter((item) => String(item?.completedAt || '').trim() !== completedAt);
        const nextDone = done === true;
        const nextHistory = nextDone
            ? __tmNormalizeTaskRepeatHistory([
                {
                    completedAt,
                    occurrenceNumber: Math.max(0, Math.min(200, parseInt(entry.occurrenceNumber, 10) || 0)),
                    totalOccurrences: __tmNormalizeTaskRepeatMaxOccurrences(entry.totalOccurrences),
                    sourceStart: __tmNormalizeDateOnly(entry.sourceStart || entry.startDate || ''),
                    sourceDue: __tmNormalizeDateOnly(entry.sourceDue || entry.completionTime || entry.dueDate || ''),
                    nextStart: __tmNormalizeDateOnly(task?.startDate || ''),
                    nextDue: __tmNormalizeDateOnly(task?.completionTime || ''),
                    content: String(entry.content || task?.content || task?.raw_content || '').trim(),
                    docId: String(task?.root_id || task?.docId || '').trim(),
                    docName: String(task?.docName || task?.doc_name || '').trim(),
                    h2: String(task?.h2 || '').trim(),
                    h2Id: String(task?.h2Id || '').trim(),
                    h2Path: String(task?.h2Path || '').trim(),
                    priority: String(task?.priority || '').trim(),
                    customStatus: String(task?.customStatus || '').trim(),
                    duration: String(task?.duration || '').trim(),
                    remark: String(task?.remark || '').trim(),
                    docSeq: Number.isFinite(Number(task?.docSeq)) ? Number(task.docSeq) : Number.NaN,
                },
                ...withoutEntry,
            ])
            : withoutEntry;
        if (JSON.stringify(currentHistory) === JSON.stringify(nextHistory)) {
            return { changed: false, completedAt, taskId: task.id, repeatHistory: nextHistory };
        }
        const nextPatch = {
            repeatHistory: nextHistory,
        };
        if (!nextDone) {
            const removedIndex = currentHistory.findIndex((item) => String(item?.completedAt || '').trim() === completedAt);
            if (removedIndex === 0) {
                const rollbackPatch = __tmBuildRecurringTaskRollbackPatch(task, currentHistory[removedIndex], nextHistory);
                if (rollbackPatch) Object.assign(nextPatch, rollbackPatch);
            }
        }
        const result = await __tmApplyTaskMetaPatchWithUndo(task.id, nextPatch, {
            source: String(opts.source || 'task-repeat-detached-history').trim() || 'task-repeat-detached-history',
            label: nextDone ? '循环例外完成记录' : '删除循环例外完成记录',
            refresh: opts.refresh !== false,
            refreshCalendar: opts.refreshCalendar !== false,
            withFilters: opts.withFilters !== false,
            hard: opts.hard === true,
            recordUndo: opts.recordUndo !== false,
            broadcast: opts.broadcast !== false,
        });
        if (!nextDone) {
            __tmPurgeRecurringInstanceTasks(task.id, [completedAt]);
        }
        return {
            ...result,
            completedAt,
            repeatHistory: nextHistory,
        };
    }

    const __tmRecurringAdvanceTimers = new Map();
    const __tmRecurringAdvanceInFlightIds = new Set();

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
        const requestedTaskId = String(taskId || '').trim();
        if (!requestedTaskId) return false;
        let advanceTaskId = requestedTaskId;
        try {
            const resolvedId = await __tmResolveTaskIdFromAnyBlockId(requestedTaskId);
            if (resolvedId) advanceTaskId = String(resolvedId || '').trim() || advanceTaskId;
        } catch (e) {}
        try {
            const resolvedTask = await __tmResolveTaskForRepeat(advanceTaskId);
            if (resolvedTask?.id) advanceTaskId = String(resolvedTask.id || '').trim() || advanceTaskId;
        } catch (e) {}
        if (!advanceTaskId || __tmRecurringAdvanceInFlightIds.has(advanceTaskId)) return false;
        __tmRecurringAdvanceInFlightIds.add(advanceTaskId);
        try {
            return await __tmAdvanceRecurringTaskAfterCompletionInternal(advanceTaskId, options);
        } finally {
            __tmRecurringAdvanceInFlightIds.delete(advanceTaskId);
        }
    }

    async function __tmAdvanceRecurringTaskAfterCompletionInternal(taskId, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (String(opts.source || '').trim() === 'task-repeat-advance') return false;
        const waited = await __tmWaitForGlobalUnlock(12000);
        if (!waited) throw new Error('循环推进等待任务写入超时');
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
        const currentRepeatState = __tmNormalizeTaskRepeatState(task?.repeatState);
        const completedAt = __tmNormalizeTaskCompleteAtValue(
            opts.completedAt
            || task?.taskCompleteAt
            || task?.task_complete_at
            || '',
        );
        if (!completedAt) return false;
        const currentHistory = __tmNormalizeTaskRepeatHistory(task?.repeatHistory || task?.repeat_history || '');
        const matchingHistory = currentHistory.find((item) => String(item?.completedAt || '').trim() === completedAt) || null;
        const alreadyAdvanced = String(currentRepeatState.lastCompletedAt || '').trim() === completedAt || !!matchingHistory;
        let nextPatch = null;
        let historyHead = matchingHistory;
        if (!alreadyAdvanced) {
            nextPatch = __tmBuildTaskRepeatAdvancePatch(task, repeatRule, { completedAt });
            if (!nextPatch) return false;
            const nextHistory = __tmNormalizeTaskRepeatHistory([
                {
                    completedAt,
                    occurrenceNumber: currentRepeatState.occurrenceCount,
                    totalOccurrences: repeatRule.maxOccurrences,
                    sourceStart: __tmNormalizeDateOnly(task?.startDate || ''),
                    sourceDue: __tmNormalizeDateOnly(task?.completionTime || ''),
                    nextStart: __tmNormalizeDateOnly(nextPatch.startDate || ''),
                    nextDue: __tmNormalizeDateOnly(nextPatch.completionTime || ''),
                    content: String(task?.content || task?.raw_content || '').trim(),
                    docId: String(task?.root_id || task?.docId || '').trim(),
                    docName: String(task?.docName || task?.doc_name || '').trim(),
                    h2: String(task?.h2 || '').trim(),
                    h2Id: String(task?.h2Id || '').trim(),
                    h2Path: String(task?.h2Path || '').trim(),
                    priority: String(task?.priority || '').trim(),
                    customStatus: String(task?.customStatus || task?.custom_status || '').trim(),
                    duration: String(task?.duration || '').trim(),
                    remark: String(task?.remark || '').trim(),
                    docSeq: Number.isFinite(Number(task?.docSeq)) ? Number(task.docSeq) : Number.NaN,
                },
                ...currentHistory,
            ]);
            historyHead = nextHistory[0] || null;
            nextPatch.repeatHistory = nextHistory;
            await __tmApplyTaskMetaPatchWithUndo(task.id, nextPatch, {
                source: 'task-repeat-advance',
                label: '循环推进',
                refresh: false,
                refreshCalendar: false,
                withFilters: true,
                hard: false,
                recordUndo: false,
                queued: true,
                background: false,
                wait: true,
            });
            task = await __tmResolveTaskForRepeat(task.id) || task;
        }
        if (historyHead && String(opts?.scheduleId || '').trim()) {
            try { await __tmReassignCompletedScheduleToRecurringInstance(String(opts.scheduleId || '').trim(), task, historyHead); } catch (e) {}
        }
        let resetTaskId = String(task.id || '').trim();
        try {
            const resolvedResetTaskId = await __tmResolveTaskIdFromAnyBlockId(resetTaskId);
            if (resolvedResetTaskId) resetTaskId = String(resolvedResetTaskId || '').trim() || resetTaskId;
        } catch (e) {}
        if (!resetTaskId) resetTaskId = String(task.id || '').trim();
        if (typeof window.tmSetDone !== 'function') throw new Error('任务完成写入队列未就绪');
        const resetResult = await window.tmSetDone(resetTaskId, false, null, {
            force: true,
            wait: true,
            suppressHint: true,
            source: 'task-repeat-advance',
            recordUndo: false,
            skipAutoCompleteParent: true,
            skipInteractionGate: true,
            skipViewRefresh: true,
            skipOptimisticRefresh: true,
            skipSettledRefresh: true,
            refreshAncestorViews: false,
        });
        if (resetResult === false) throw new Error('循环推进后未能重置任务完成状态');
        const latestTask = await __tmResolveTaskForRepeat(resetTaskId);
        if (!latestTask || latestTask.done === true) throw new Error('循环推进后任务仍处于完成状态');
        task = latestTask;
        __tmSyncRecurringInstanceTasks(task);
        try { window.__tmCalendarAllTasksCache = null; } catch (e) {}
        try {
            __tmRefreshViewsAfterTaskMutation({
                refresh: true,
                refreshCalendar: true,
                withFilters: true,
                hard: false,
                reason: 'task-repeat-advance',
                taskIds: [resetTaskId],
            });
        } catch (e) {}
        try {
            const nextDate = __tmNormalizeDateOnly(nextPatch?.completionTime || nextPatch?.startDate || task?.completionTime || task?.startDate || '');
            if (opts.suppressHint !== true) hint(`🔁 已推进到下一次${nextDate ? `：${nextDate}` : ''}`, 'success');
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
                __tmAdvanceRecurringTaskAfterCompletion(tid, opts).then((advanced) => {
                    if (advanced !== true && opts.expectAdvance === true) {
                        try {
                            __tmRefreshViewsAfterTaskMutation({
                                refresh: true,
                                refreshCalendar: true,
                                withFilters: true,
                                hard: false,
                                reason: 'task-repeat-advance-noop',
                                taskIds: [tid],
                            });
                        } catch (e) {}
                    }
                }).catch((error) => {
                    try {
                        if (opts.suppressHint !== true) hint(`❌ 循环任务推进失败，已保留完成状态：${error?.message || String(error)}`, 'error');
                    } catch (e) {}
                    try {
                        __tmRefreshViewsAfterTaskMutation({
                            refresh: true,
                            refreshCalendar: true,
                            withFilters: true,
                            hard: false,
                            reason: 'task-repeat-advance-failed',
                            taskIds: [tid],
                        });
                    } catch (e) {}
                });
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
                if (!task?.id) continue;
                const rule = __tmGetTaskRepeatRule(task);
                if (!rule.enabled || rule.type === 'none') continue;
                if (task.done) {
                    const completedAt = __tmNormalizeTaskCompleteAtValue(task?.taskCompleteAt || task?.task_complete_at || '');
                    if (!completedAt) continue;
                    const repeatState = __tmNormalizeTaskRepeatState(task?.repeatState);
                    const repeatHistory = __tmNormalizeTaskRepeatHistory(task?.repeatHistory || task?.repeat_history || '');
                    const alreadyAdvanced = String(repeatState.lastCompletedAt || '').trim() === completedAt
                        || repeatHistory.some((item) => String(item?.completedAt || '').trim() === completedAt);
                    if (!alreadyAdvanced && !__tmBuildTaskRepeatAdvancePatch(task, rule, { completedAt })) continue;
                    const advanced = await __tmAdvanceRecurringTaskAfterCompletion(task.id, {
                        source: 'task-repeat-load-reconcile',
                        completedAt,
                        suppressHint: true,
                    });
                    if (advanced) changed += 1;
                    continue;
                }
                if (rule.trigger !== 'due') continue;
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

    window.tmSkipRecurringTaskOccurrence = async function(taskId, options = {}) {
        const task = await __tmResolveTaskForRepeat(taskId);
        if (!task?.id) throw new Error('未找到任务');
        const opts = (options && typeof options === 'object') ? options : {};
        const rule = __tmGetTaskRepeatRule(task);
        if (!rule.enabled || rule.type === 'none') throw new Error('该任务未开启循环');
        const nextPatch = __tmBuildTaskRepeatAdvancePatch(task, rule, {
            advancedAt: String(opts.advancedAt || new Date().toISOString()).trim() || new Date().toISOString(),
            completedAt: String(task?.repeatState?.lastCompletedAt || '').trim(),
        });
        if (!nextPatch) throw new Error('没有可跳过到的下一次循环');
        const sourceStart = __tmNormalizeDateOnly(task?.startDate || '');
        const sourceDue = __tmNormalizeDateOnly(task?.completionTime || '');
        const result = await __tmApplyTaskMetaPatchWithUndo(task.id, nextPatch, {
            source: String(opts.source || 'task-repeat-skip').trim() || 'task-repeat-skip',
            label: String(opts.label || '跳过循环本次').trim() || '跳过循环本次',
            refresh: opts.refresh !== false,
            refreshCalendar: opts.refreshCalendar !== false,
            withFilters: opts.withFilters !== false,
            hard: opts.hard === true,
            recordUndo: opts.recordUndo !== false,
            broadcast: opts.broadcast !== false,
        });
        return {
            ...result,
            rule,
            skippedStart: sourceStart,
            skippedDue: sourceDue,
            nextStart: __tmNormalizeDateOnly(nextPatch.startDate || ''),
            nextDue: __tmNormalizeDateOnly(nextPatch.completionTime || ''),
            summary: __tmGetTaskRepeatSummary(rule, {
                startDate: nextPatch.startDate,
                completionTime: nextPatch.completionTime,
            }),
        };
    };

    window.tmSetDetachedTaskRepeatHistoryEntry = async function(taskId, done, entryInput = {}, options = {}) {
        return await __tmSetDetachedTaskRepeatHistoryEntry(taskId, done, entryInput, options);
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
        return await window.tmSetTaskRepeatRule(task.id, nextRule, { source: 'task-repeat-dialog' });
    };

    async function __tmApplyFollowReminderDraft(payload = {}) {
        const source = (payload && typeof payload === 'object') ? payload : {};
        const taskRef = String(source.taskId || source.blockId || source.attrHostId || '').trim();
        if (!taskRef) throw new Error('任务 ID 为空');
        if (!Object.prototype.hasOwnProperty.call(source, 'repeatRule')) throw new Error('缺少任务循环草稿');
        const task = await __tmResolveTaskForRepeat(taskRef);
        if (!task?.id) throw new Error('未找到任务');
        const completionTime = __tmNormalizeDateOnly(source.completionTime || '');
        if (!completionTime) throw new Error('任务截止日不能为空');
        const candidateTask = {
            ...task,
            completionTime,
            completion_time: completionTime,
        };
        const ruleInput = source.repeatRule && typeof source.repeatRule === 'object'
            ? source.repeatRule
            : { enabled: false, type: 'none' };
        const repeatPatch = __tmBuildTaskRepeatRuleMetaPatch(candidateTask, ruleInput);
        const currentRule = __tmNormalizeTaskRepeatRule(task?.repeatRule, {
            startDate: task?.startDate,
            completionTime: task?.completionTime,
        });
        const currentState = __tmNormalizeTaskRepeatState(task?.repeatState);
        const completionChanged = __tmNormalizeDateOnly(task?.completionTime || '') !== completionTime;
        const repeatChanged = JSON.stringify(currentRule) !== JSON.stringify(repeatPatch.repeatRule)
            || JSON.stringify(currentState) !== JSON.stringify(repeatPatch.repeatState);
        if (completionChanged || repeatChanged) {
            await __tmApplyTaskMetaPatchWithUndo(task.id, {
                completionTime,
                ...repeatPatch,
            }, {
                source: String(source.source || 'tomato-reminder-follow-draft').trim() || 'tomato-reminder-follow-draft',
                label: '任务提醒联动',
                refresh: true,
                refreshCalendar: true,
                withFilters: true,
                recordUndo: source.recordUndo !== false,
            });
        }
        let attrHostId = '';
        try { attrHostId = String(__tmGetTaskAttrHostId(task) || '').trim(); } catch (e) {}
        return {
            ok: true,
            changed: completionChanged || repeatChanged,
            taskId: String(task.id || taskRef).trim() || taskRef,
            attrHostId: attrHostId || String(task.id || taskRef).trim() || taskRef,
            taskTitle: String(task?.content || task?.raw_content || task?.rawContent || task?.markdown || '任务').trim() || '任务',
            startDate: __tmNormalizeDateOnly(task?.startDate || ''),
            completionTime,
            repeatRule: repeatPatch.repeatRule,
            repeatState: repeatPatch.repeatState,
        };
    }

    async function __tmClearFollowReminderDraft(payload = {}) {
        const source = (payload && typeof payload === 'object') ? payload : {};
        const taskRef = String(source.taskId || source.blockId || source.attrHostId || '').trim();
        if (!taskRef) throw new Error('任务 ID 为空');
        const task = await __tmResolveTaskForRepeat(taskRef);
        if (!task?.id) throw new Error('未找到任务');
        const candidateTask = {
            ...task,
            completionTime: '',
            completion_time: '',
        };
        const repeatPatch = __tmBuildTaskRepeatRuleMetaPatch(candidateTask, {
            enabled: false,
            type: 'none',
        });
        const currentRule = __tmNormalizeTaskRepeatRule(task?.repeatRule, {
            startDate: task?.startDate,
            completionTime: task?.completionTime,
        });
        const currentState = __tmNormalizeTaskRepeatState(task?.repeatState);
        const completionChanged = !!__tmNormalizeDateOnly(task?.completionTime || '');
        const repeatChanged = JSON.stringify(currentRule) !== JSON.stringify(repeatPatch.repeatRule)
            || JSON.stringify(currentState) !== JSON.stringify(repeatPatch.repeatState);
        if (completionChanged || repeatChanged) {
            await __tmApplyTaskMetaPatchWithUndo(task.id, {
                completionTime: '',
                ...repeatPatch,
            }, {
                source: String(source.source || 'tomato-reminder-follow-delete').trim() || 'tomato-reminder-follow-delete',
                label: '删除任务提醒联动',
                refresh: true,
                refreshCalendar: true,
                withFilters: true,
                recordUndo: source.recordUndo !== false,
            });
        }
        let attrHostId = '';
        try { attrHostId = String(__tmGetTaskAttrHostId(task) || '').trim(); } catch (e) {}
        return {
            ok: true,
            changed: completionChanged || repeatChanged,
            taskId: String(task.id || taskRef).trim() || taskRef,
            attrHostId: attrHostId || String(task.id || taskRef).trim() || taskRef,
            completionTime: '',
            repeatRule: repeatPatch.repeatRule,
            repeatState: repeatPatch.repeatState,
        };
    }

    try {
        const previousBridge = (__tmNs.reminderBridge && typeof __tmNs.reminderBridge === 'object')
            ? __tmNs.reminderBridge
            : {};
        __tmNs.reminderBridge = {
            ...previousBridge,
            version: 2,
            capabilities: Object.freeze({
                ...(previousBridge.capabilities || {}),
                completeFromReminder: typeof previousBridge.completeFromReminder === 'function',
                applyFollowDraft: true,
                clearFollowDraft: true,
            }),
            applyFollowDraft: __tmApplyFollowReminderDraft,
            clearFollowDraft: __tmClearFollowReminderDraft,
        };
    } catch (e) {}

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
