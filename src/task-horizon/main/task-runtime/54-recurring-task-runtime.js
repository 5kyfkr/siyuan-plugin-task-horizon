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
        let task = globalThis.__tmTaskBoundary?.getTask?.(requestedId) || null;
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

    function __tmBuildTaskTomatoBaselinePatch(taskLike) {
        const values = __tmGetTaskTomatoCumulativeValues(taskLike);
        return {
            tomatoBaselineMinutes: values.tomatoMinutes,
            tomatoBaselineHours: values.tomatoHours,
            tomatoBaselineCount: values.tomatoCount,
            tomatoBaselineSet: true,
        };
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
        const removedCumulative = __tmGetTaskTomatoCumulativeValues(removed);
        const rollbackBaseline = nextHead ? {
            tomatoBaselineMinutes: nextHead.tomatoMinutes,
            tomatoBaselineHours: nextHead.tomatoHours,
            tomatoBaselineCount: nextHead.tomatoCount,
            tomatoBaselineSet: true,
        } : {
            tomatoBaselineMinutes: Math.max(0, removedCumulative.tomatoMinutes - __tmNormalizeTaskTomatoAmount(removed.tomatoOccurrenceMinutes)),
            tomatoBaselineHours: Math.max(0, removedCumulative.tomatoHours - __tmNormalizeTaskTomatoAmount(removed.tomatoOccurrenceHours)),
            tomatoBaselineCount: Math.max(0, removedCumulative.tomatoCount - __tmNormalizeTaskTomatoCount(removed.tomatoOccurrenceCount)),
            tomatoBaselineSet: true,
        };
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
                pendingNativeDoneReset: false,
                ...rollbackBaseline,
                fsrsCard: removed.fsrsBefore || currentState.fsrsCard,
            }),
        };
    }

    function __tmGetTaskRepeatScheduleSignature(ruleInput) {
        const rule = __tmNormalizeTaskRepeatRule(ruleInput);
        return JSON.stringify([
            rule.enabled,
            rule.trigger,
            rule.type,
            rule.every,
            rule.weekdays,
            rule.monthlyMode,
            rule.monthDays,
            rule.monthWeek,
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
        const occurrenceReset = scheduleChanged || (nextRule.maxOccurrences > 0 && currentRule.maxOccurrences <= 0);
        let occurrenceCount = currentState.occurrenceCount;
        if (occurrenceReset) {
            occurrenceCount = 1;
        } else if (nextRule.maxOccurrences > 0 && nextRule.maxOccurrences < occurrenceCount) {
            throw new Error(`结束次数不能小于当前第 ${occurrenceCount} 次`);
        }
        let nextState = __tmNormalizeTaskRepeatState({
            ...currentState,
            occurrenceCount,
            lastInstanceStart: __tmNormalizeDateOnly(task?.startDate || ''),
            lastInstanceDue: __tmNormalizeDateOnly(task?.completionTime || ''),
            pendingNativeDoneReset: (!nextRule.enabled || nextRule.type === 'none')
                ? false
                : currentState.pendingNativeDoneReset,
            fsrsCard: nextRule.type === 'fsrs' ? currentState.fsrsCard : null,
            ...((occurrenceReset || !currentState.tomatoBaselineSet)
                ? __tmBuildTaskTomatoBaselinePatch(task)
                : {}),
        });
        const patch = {
            repeatRule: nextRule,
            repeatState: nextState,
        };
        if (scheduleChanged && __tmMonthRepeatCore?.isExplicit(nextRule)) {
            const currentKey = __tmNormalizeDateOnly(task.completionTime || task.startDate || nextRule.anchorDate);
            const firstKey = __tmMonthRepeatCore.nextDateKey(nextRule, currentKey, true);
            if (!firstKey) throw new Error('月循环没有有效日期，请检查日期和结束条件');
            const deltaDays = __tmGetTaskRepeatLocalDayOrdinal(firstKey) - __tmGetTaskRepeatLocalDayOrdinal(currentKey);
            nextRule.anchorDate = firstKey;
            if (task.startDate) patch.startDate = __tmShiftTaskRepeatDateKey(task.startDate, deltaDays);
            if (task.completionTime || !task.startDate) patch.completionTime = firstKey;
            nextState.lastInstanceStart = patch.startDate || '';
            nextState.lastInstanceDue = patch.completionTime || '';
        }
        if (nextRule.type === 'fsrs') {
            const dueKey = __tmNormalizeDateOnly(task?.completionTime || task?.startDate || new Date());
            const fsrsTask = {
                ...task,
                completionTime: dueKey,
                repeatState: nextState,
            };
            if (scheduleChanged || !nextState.fsrsCard) {
                nextState = __tmBuildFsrsInitialState(fsrsTask, nextState);
                patch.repeatState = nextState;
            }
            if (!__tmNormalizeDateOnly(task?.completionTime || '')) patch.completionTime = dueKey;
        }
        return patch;
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
        const opts = (options && typeof options === 'object') ? options : {};
        const source = String(opts.source || 'task-repeat-history-delete').trim() || 'task-repeat-history-delete';
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
        if (removedIndex === 0) {
            try { __tmClearRecurringTaskAdvanceTimer(task.id); } catch (e) {}
        }
        const shouldResetNativeDone = opts.resetNativeDone === true
            && removedIndex === 0
            && typeof __tmSetDoneKernel === 'function'
            && typeof __tmIsRecurringNativeDoneHeld === 'function'
            && __tmIsRecurringNativeDoneHeld(task);
        if (shouldResetNativeDone) {
            const resetResult = await __tmSetDoneKernel(task.id, false, null, {
                force: true,
                previousDone: true,
                suppressHint: true,
                source,
                recordUndo: opts.recordUndo !== false,
                skipAutoCompleteParent: true,
                skipInteractionGate: true,
                additionalPatch: nextPatch,
                deferProjection: true,
                refreshAncestorViews: false,
                deferCompletionEffects: true,
            });
            if (resetResult === false) throw new Error('撤销循环记录时未能清除任务完成状态');
        } else {
            await __tmApplyTaskMetaPatchWithUndo(task.id, nextPatch, {
                source,
                label: '删除循环记录',
                refresh: false,
                refreshCalendar: false,
                withFilters: true,
                hard: false,
                recordUndo: opts.recordUndo !== false,
            });
        }
        try { __tmApplyTaskFieldPatchToLocalMirrors(task.id, nextPatch); } catch (e) {}
        const removedVirtualTaskId = String(
            __tmBuildRecurringInstanceTask(task, removedEntry, Math.max(0, removedIndex))?.id || ''
        ).trim();
        __tmPurgeRecurringInstanceTasks(task.id, [key]);
        try {
            globalThis.__tmTaskSnapshotService?.scheduleAfterLocalPatch?.(task.id, nextPatch, {
                source,
                persistSnapshot: true,
            });
        } catch (e) {}
        try {
            const docId = String(task.root_id || task.docId || '').trim();
            globalThis.__tmTaskMutationBus?.apply?.({
                type: 'taskLifecycle',
                phase: 'local',
                taskId: task.id,
                task: { ...task },
                docId,
                source,
                patch: { ...nextPatch },
                changeSet: {
                    upsertedTaskIds: [task.id],
                    deletedTaskIds: removedVirtualTaskId ? [removedVirtualTaskId] : [],
                    affectedGroupIds: [task.id],
                    affectedDocumentIds: docId ? [docId] : [],
                    structural: true,
                },
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
                    occurrenceNumber: Math.max(0, parseInt(entry.occurrenceNumber, 10) || 0),
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

    const __tmRecurringNativeDoneResetInFlight = new Map();

    async function __tmResetRecurringNativeDoneIfDue(taskInput, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const task = (taskInput && typeof taskInput === 'object')
            ? taskInput
            : await __tmResolveTaskForRepeat(taskInput);
        if (!task?.id) return false;
        const taskId = String(task.id || '').trim();
        if (!taskId) return false;
        const inFlight = __tmRecurringNativeDoneResetInFlight.get(taskId);
        if (inFlight) return await inFlight;
        const job = (async () => {
            const currentState = __tmNormalizeTaskRepeatState(task?.repeatState || task?.repeat_state || '');
            if (currentState.pendingNativeDoneReset !== true) return false;
            const clearedState = __tmNormalizeTaskRepeatState({
                ...currentState,
                pendingNativeDoneReset: false,
            });
            const repeatRule = __tmGetTaskRepeatRule(task);
            const nativeDone = __tmIsTaskNativeDone(task);
            const held = __tmIsRecurringNativeDoneHeld(task);
            const resetDateKey = __tmGetRecurringNativeDoneResetDateKey(task);
            const todayKey = __tmNormalizeDateOnly(opts.todayKey || new Date());

            if (!repeatRule.enabled || repeatRule.type === 'none' || !nativeDone || !held || !resetDateKey) {
                await __tmApplyTaskMetaPatchWithUndo(taskId, { repeatState: clearedState }, {
                    source: String(opts.source || 'task-repeat-native-reset-reconcile').trim() || 'task-repeat-native-reset-reconcile',
                    label: '循环状态对账',
                    refresh: false,
                    refreshCalendar: false,
                    withFilters: true,
                    hard: false,
                    recordUndo: false,
                    broadcast: true,
                });
                return true;
            }
            if (!todayKey || todayKey < resetDateKey) return false;
            if (typeof window.tmSetDone !== 'function') throw new Error('任务完成写入队列未就绪');
            const resetResult = await window.tmSetDone(taskId, false, null, {
                force: true,
                wait: true,
                suppressHint: true,
                source: 'task-repeat-native-reset',
                recordUndo: false,
                skipAutoCompleteParent: true,
                skipInteractionGate: true,
                deferProjection: true,
                refreshAncestorViews: false,
                additionalPatch: {
                    repeatState: clearedState,
                    taskCompleteAt: '',
                },
            });
            if (resetResult === false) throw new Error('循环任务未能恢复为未完成状态');
            try {
                globalThis.__tmTaskSnapshotService?.scheduleAfterLocalPatch?.(taskId, {
                    done: false,
                    repeatState: clearedState,
                    taskCompleteAt: '',
                }, { source: 'task-repeat-native-reset', persistSnapshot: true });
            } catch (e) {}
            return true;
        })();
        __tmRecurringNativeDoneResetInFlight.set(taskId, job);
        try {
            return await job;
        } finally {
            if (__tmRecurringNativeDoneResetInFlight.get(taskId) === job) {
                __tmRecurringNativeDoneResetInFlight.delete(taskId);
            }
        }
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

        const suppliedTask = (options && typeof options === 'object' && options.task && typeof options.task === 'object')
            ? options.task
            : null;
        let advanceTaskId = requestedTaskId;
        try {
            const resolvedId = await __tmResolveTaskIdFromAnyBlockId(requestedTaskId);
            if (resolvedId) advanceTaskId = String(resolvedId || '').trim() || advanceTaskId;
        } catch (e) {}
        if (String(suppliedTask?.id || '').trim() !== advanceTaskId) {
            try {
                const resolvedTask = await __tmResolveTaskForRepeat(advanceTaskId);
                if (resolvedTask?.id) advanceTaskId = String(resolvedTask.id || '').trim() || advanceTaskId;
            } catch (e) {}
        }
        if (!advanceTaskId) {

            return false;
        }
        if (__tmRecurringAdvanceInFlightIds.has(advanceTaskId)) {
            return false;
        }
        __tmRecurringAdvanceInFlightIds.add(advanceTaskId);

        try {
            return await __tmAdvanceRecurringTaskAfterCompletionInternal(advanceTaskId, options);
        } finally {
            __tmRecurringAdvanceInFlightIds.delete(advanceTaskId);
        }
    }

    async function __tmAdvanceRecurringTaskAfterCompletionInternal(taskId, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};

        if (String(opts.source || '').trim() === 'task-repeat-advance') {
            return false;
        }
        if (opts.fromMutationEffect !== true) {
            const waited = await __tmWaitForGlobalUnlock(12000);

            if (!waited) throw new Error('循环推进等待任务写入超时');
        }
        let task = (opts.task && typeof opts.task === 'object') ? opts.task : await __tmResolveTaskForRepeat(taskId);
        try {
            const latestTaskId = await __tmResolveTaskIdFromAnyBlockId(String(task?.id || taskId || '').trim());
            if (latestTaskId && latestTaskId !== String(task?.id || '').trim()) {
                const latestTask = await __tmResolveTaskForRepeat(latestTaskId);
                if (latestTask?.id) task = latestTask;
            }
        } catch (e) {}
        if (!task?.id) {
            return false;
        }
        if (!__tmIsTaskNativeDone(task)) {
            return false;
        }
        const repeatRule = __tmGetTaskRepeatRule(task);
        if (!repeatRule.enabled || repeatRule.type === 'none') {
            return false;
        }
        const currentRepeatState = __tmNormalizeTaskRepeatState(task?.repeatState);
        const completedAt = __tmNormalizeTaskCompleteAtValue(
            opts.completedAt
            || task?.taskCompleteAt
            || task?.task_complete_at
            || '',
        );
        if (!completedAt) {
            return false;
        }
        const nativeDoneHeld = typeof __tmIsRecurringNativeDoneHeld === 'function'
            && __tmIsRecurringNativeDoneHeld(task);
        const currentHistory = __tmNormalizeTaskRepeatHistory(task?.repeatHistory || task?.repeat_history || '');
        const matchingHistory = currentHistory.find((item) => String(item?.completedAt || '').trim() === completedAt) || null;
        const alreadyAdvanced = String(currentRepeatState.lastCompletedAt || '').trim() === completedAt || !!matchingHistory;

        if (nativeDoneHeld && !alreadyAdvanced) {
            return false;
        }
        let keepNativeDone = alreadyAdvanced
            && currentRepeatState.pendingNativeDoneReset === true
            && String(currentRepeatState.lastCompletedAt || '').trim() === completedAt;
        let nextPatch = null;
        let historyHead = matchingHistory;
        if (!alreadyAdvanced) {
            try {
                await __tmSettleTomatoAfterTaskDone(task.id, {
                    task,
                    attrHostId: String(__tmGetTaskAttrHostId(task) || task.id).trim() || task.id,
                    source: String(opts.source || 'task-repeat-advance').trim() || 'task-repeat-advance',
                });
            } catch (e) {}
            task = await __tmResolveTaskForRepeat(task.id) || task;
            const occurrenceFocus = __tmGetTaskTomatoFocusValues(task);
            const cumulativeFocus = __tmGetTaskTomatoCumulativeValues(task);
            if (repeatRule.type === 'fsrs') {
                const fsrsRating = __tmNormalizeFsrsRating(opts.fsrsRating);
                if (!fsrsRating || fsrsRating === 1) {

                    return false;
                }
                const fsrsPatch = __tmBuildFsrsReviewPatch(task, fsrsRating, {
                    completedAt,
                    reviewedAt: completedAt,
                });
                nextPatch = {
                    startDate: fsrsPatch.startDate,
                    completionTime: fsrsPatch.completionTime,
                    repeatState: fsrsPatch.repeatState,
                    __fsrsReview: fsrsPatch.review,
                };
            } else {
                nextPatch = __tmBuildTaskRepeatAdvancePatch(task, repeatRule, { completedAt });
            }
            if (!nextPatch) {
                return false;
            }
            keepNativeDone = SettingsStore?.data?.recurringTaskKeepNativeDoneUntilNextOccurrence === true;
            nextPatch.repeatState = __tmNormalizeTaskRepeatState({
                ...nextPatch.repeatState,
                ...__tmBuildTaskTomatoBaselinePatch(task),
                pendingNativeDoneReset: keepNativeDone,
            });
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
                    tomatoMinutes: String(cumulativeFocus.tomatoMinutes),
                    tomatoHours: String(cumulativeFocus.tomatoHours),
                    tomatoCount: String(cumulativeFocus.tomatoCount),
                    tomatoOccurrenceMinutes: String(occurrenceFocus.tomatoMinutes),
                    tomatoOccurrenceHours: String(occurrenceFocus.tomatoHours),
                    tomatoOccurrenceCount: String(occurrenceFocus.tomatoCount),
                    remark: String(task?.remark || '').trim(),
                    docSeq: Number.isFinite(Number(task?.docSeq)) ? Number(task.docSeq) : Number.NaN,
                    rating: nextPatch.__fsrsReview?.rating || 0,
                    fsrsBefore: nextPatch.__fsrsReview?.beforeCard || null,
                    fsrsAfter: nextPatch.__fsrsReview?.afterCard || null,
                },
                ...currentHistory,
            ]);
            historyHead = nextHistory[0] || null;
            delete nextPatch.__fsrsReview;
            nextPatch.repeatHistory = nextHistory;

            try {
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
                    inlineQueuedPersist: opts.fromMutationEffect === true,
                    deferProjection: true,
                });

            } catch (error) {

                throw error;
            }
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
        let latestTask = task;
        if (!keepNativeDone) {
            let resetResult;

            if (opts.fromMutationEffect === true) {
                resetResult = await __tmSetDoneKernel(resetTaskId, false, null, {
                    force: true,
                    previousDone: true,
                    suppressHint: true,
                    source: 'task-repeat-advance',
                    recordUndo: false,
                    skipAutoCompleteParent: true,
                    deferProjection: true,
                    refreshAncestorViews: false,
                    deferCompletionEffects: true,
                });
            } else {
                if (typeof window.tmSetDone !== 'function') throw new Error('任务完成写入队列未就绪');
                resetResult = await window.tmSetDone(resetTaskId, false, null, {
                    force: true,
                    wait: true,
                    suppressHint: true,
                    source: 'task-repeat-advance',
                    recordUndo: false,
                    skipAutoCompleteParent: true,
                    skipInteractionGate: true,
                    deferProjection: true,
                    refreshAncestorViews: false,
                });
            }
            if (resetResult === false) throw new Error('循环推进后未能重置任务完成状态');
            latestTask = await __tmResolveTaskForRepeat(resetTaskId);
            if (!latestTask || __tmIsTaskNativeDone(latestTask)) throw new Error('循环推进后任务仍处于完成状态');

        } else {
            latestTask = await __tmResolveTaskForRepeat(resetTaskId);
            if (!latestTask || !__tmIsTaskNativeDone(latestTask)) {
                const [nativeMarkdown, nativeAttrs] = await Promise.all([
                    API.getBlockKramdown(resetTaskId),
                    __tmReadDocCheckboxBlockAttrs(resetTaskId),
                ]);
                const nativeStatus = API.parseTaskStatus(nativeMarkdown);
                const nativeTask = {
                    done: nativeStatus?.done === true,
                    taskMarker: nativeStatus?.marker,
                    markdown: String(nativeMarkdown || ''),
                };
                const nativeCompletedAt = __tmNormalizeTaskCompleteAtValue(nativeAttrs?.taskCompleteAt || '');
                if (!__tmIsTaskNativeDone(nativeTask) || nativeCompletedAt !== completedAt) {
                    throw new Error('循环推进后任务完成状态未能保留');
                }
                const nativeMarker = __tmResolveTaskMarker(nativeTask);
                latestTask = {
                    ...(latestTask || task),
                    ...((nextPatch && typeof nextPatch === 'object') ? nextPatch : {}),
                    done: true,
                    taskMarker: nativeMarker,
                    task_marker: nativeMarker,
                    taskCompleteAt: nativeCompletedAt,
                    task_complete_at: nativeCompletedAt,
                    ...(typeof nativeTask.markdown === 'string' ? { markdown: nativeTask.markdown } : {}),
                };
            }

        }
        task = latestTask;
        __tmSyncRecurringInstanceTasks(task);
        let recurringInstanceTaskId = '';
        try {
            recurringInstanceTaskId = String(
                historyHead ? (__tmBuildRecurringInstanceTask(task, historyHead, 0)?.id || '') : ''
            ).trim();
        } catch (e) {}
        try { window.__tmCalendarAllTasksCache = null; } catch (e) {}
        const finalPatch = {
            ...((nextPatch && typeof nextPatch === 'object') ? nextPatch : {}),
            done: false,
            taskCompleteAt: keepNativeDone ? completedAt : '',
            customStatus: String(task.customStatus || task.custom_status || '').trim(),
        };
        const finalLocalPatch = { ...finalPatch };
        delete finalLocalPatch.done;
        try { __tmApplyTaskFieldPatchToLocalMirrors(resetTaskId, finalLocalPatch); } catch (e) {}
        const persistedPatch = keepNativeDone
            ? { ...((nextPatch && typeof nextPatch === 'object') ? nextPatch : {}) }
            : finalPatch;

        try {
            globalThis.__tmTaskMutationBus?.apply?.({
                type: 'taskLifecycle',
                phase: 'local',
                taskId: resetTaskId,
                task: { ...task },
                docId: String(task.root_id || task.docId || '').trim(),
                source: 'task-repeat-advance',
                patch: finalPatch,
                changeSet: {
                    upsertedTaskIds: [resetTaskId, recurringInstanceTaskId].filter(Boolean),
                    deletedTaskIds: [],
                    affectedGroupIds: [resetTaskId],
                    affectedDocumentIds: [String(task.root_id || task.docId || '').trim()].filter(Boolean),
                    structural: true,
                },
            });
        } catch (e) {}
        try {
            __tmDispatchTaskAttrPatchUpdated(resetTaskId, persistedPatch, {
                resolvedTaskId: resetTaskId,
                attrHostId: String(__tmGetTaskAttrHostId(task) || resetTaskId).trim() || resetTaskId,
                source: 'task-repeat-advance',
                localMutation: true,
            });
        } catch (e) {}
        try {
            __tmScheduleTaskSnapshotAfterLocalPatch?.(resetTaskId, persistedPatch, {
                source: 'task-repeat-advance',
                persistSnapshot: true,
            });
        } catch (e) {}
        try {
            // The list/checklist in-place rerender is short-circuited when the
            // DOM render signature is unchanged. That signature only samples
            // row ids/order, so a pure field change (dates moved to the next
            // occurrence, inserted completion record, done flag held) can be
            // skipped and the view stays stale until a manual refresh reloads
            // the whole scope. Invalidate the signature so this refresh always
            // rebuilds the rows that reflect the advanced state.
            try { state.listDomRenderSignature = ''; } catch (e) {}
            __tmScheduleViewRefresh?.({
                mode: 'current',
                withFilters: true,
                reason: 'task-repeat-advance-final',
                taskIds: [resetTaskId],
                bypassDefer: true,
            });
        } catch (e) {

        }
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
            }, Math.max(32, Number(opts.delayMs) || 80));
            __tmRecurringAdvanceTimers.set(tid, timer);
        } catch (e) {}
    }

    try { globalThis.__tmAdvanceRecurringTaskAfterCompletion = __tmAdvanceRecurringTaskAfterCompletion; } catch (e) {}

    let __tmRecurringNativeDoneResetSweepPromise = null;
    let __tmRecurringNativeDoneResetSweepTimer = null;
    let __tmRecurringNativeDoneResetLastDateKey = '';

    function __tmCollectRecurringNativeDoneResetTaskIds() {
        const ids = new Set();
        const collect = (task) => {
            if (!task?.id) return;
            const repeatState = __tmNormalizeTaskRepeatState(task?.repeatState || task?.repeat_state || '');
            if (repeatState.pendingNativeDoneReset === true) ids.add(String(task.id || '').trim());
        };
        const flatTasks = state?.flatTasks;
        if (flatTasks instanceof Map) flatTasks.forEach(collect);
        else if (flatTasks && typeof flatTasks === 'object') Object.values(flatTasks).forEach(collect);
        const visitTree = (nodes) => (Array.isArray(nodes) ? nodes : []).forEach((node) => {
            collect(node);
            visitTree(node?.tasks || node?.children);
        });
        visitTree(state?.taskTree);
        return Array.from(ids).filter(Boolean);
    }

    async function __tmRunRecurringNativeDoneResetSweep(options = {}) {
        if (__tmRecurringNativeDoneResetSweepPromise) return await __tmRecurringNativeDoneResetSweepPromise;
        const opts = (options && typeof options === 'object') ? options : {};
        const todayKey = __tmNormalizeDateOnly(opts.todayKey || new Date());
        if (!todayKey) return 0;
        if (opts.force !== true && __tmRecurringNativeDoneResetLastDateKey === todayKey) return 0;
        const job = (async () => {
            let changed = 0;
            let failed = false;
            const taskIds = __tmCollectRecurringNativeDoneResetTaskIds();
            for (const taskId of taskIds) {
                try {
                    if (await __tmResetRecurringNativeDoneIfDue(taskId, {
                        todayKey,
                        source: String(opts.source || 'task-repeat-native-reset-sweep').trim() || 'task-repeat-native-reset-sweep',
                    })) changed += 1;
                } catch (e) {
                    failed = true;
                }
            }
            if (!failed) __tmRecurringNativeDoneResetLastDateKey = todayKey;
            if (changed > 0) {
                try {
                    __tmRefreshViewsAfterTaskMutation({
                        refresh: true,
                        refreshCalendar: true,
                        withFilters: true,
                        hard: false,
                        reason: 'task-repeat-native-reset-sweep',
                        taskIds,
                    });
                } catch (e) {}
            }
            return changed;
        })();
        __tmRecurringNativeDoneResetSweepPromise = job;
        try {
            return await job;
        } finally {
            if (__tmRecurringNativeDoneResetSweepPromise === job) __tmRecurringNativeDoneResetSweepPromise = null;
        }
    }

    function __tmArmRecurringNativeDoneResetSweepTimer() {
        if (__tmRecurringNativeDoneResetSweepTimer) clearTimeout(__tmRecurringNativeDoneResetSweepTimer);
        const now = new Date();
        const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0);
        __tmRecurringNativeDoneResetSweepTimer = setTimeout(() => {
            __tmRecurringNativeDoneResetSweepTimer = null;
            void __tmRunRecurringNativeDoneResetSweep({ source: 'task-repeat-native-reset-midnight' });
            __tmArmRecurringNativeDoneResetSweepTimer();
        }, Math.max(1000, nextMidnight.getTime() - now.getTime()));
    }

    function __tmScheduleRecurringNativeDoneResetSweep(source = '') {
        __tmArmRecurringNativeDoneResetSweepTimer();
        return __tmRunRecurringNativeDoneResetSweep({
            source: String(source || 'task-repeat-native-reset-schedule').trim() || 'task-repeat-native-reset-schedule',
        });
    }

    function __tmDisposeRecurringNativeDoneResetSweep() {
        if (__tmRecurringNativeDoneResetSweepTimer) clearTimeout(__tmRecurringNativeDoneResetSweepTimer);
        __tmRecurringNativeDoneResetSweepTimer = null;
        __tmRecurringNativeDoneResetLastDateKey = '';
    }

    try {
        globalThis.__tmRunRecurringNativeDoneResetSweep = __tmRunRecurringNativeDoneResetSweep;
        globalThis.__tmScheduleRecurringNativeDoneResetSweep = __tmScheduleRecurringNativeDoneResetSweep;
        globalThis.__tmDisposeRecurringNativeDoneResetSweep = __tmDisposeRecurringNativeDoneResetSweep;
    } catch (e) {}

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
                let task = await __tmResolveTaskForRepeat(taskId);
                if (!task?.id) continue;
                let repeatState = __tmNormalizeTaskRepeatState(task?.repeatState);
                if (repeatState.pendingNativeDoneReset === true) {
                    const pendingResetRule = __tmGetTaskRepeatRule(task);
                    const pendingResetDateKey = __tmGetRecurringNativeDoneResetDateKey(task);
                    const shouldContinueAfterNativeReset = pendingResetRule.enabled
                        && pendingResetRule.type !== 'none'
                        && __tmIsTaskNativeDone(task)
                        && __tmIsRecurringNativeDoneHeld(task)
                        && !!pendingResetDateKey
                        && !!todayKey
                        && todayKey >= pendingResetDateKey;
                    const reset = await __tmResetRecurringNativeDoneIfDue(task, {
                        todayKey,
                        source: 'task-repeat-load-native-reset',
                    });
                    if (!reset) continue;
                    changed += 1;
                    const refreshedTask = await __tmResolveTaskForRepeat(taskId);
                    if (!shouldContinueAfterNativeReset && !__tmIsTaskNativeDone(refreshedTask || task)) continue;
                    const refreshedRepeatState = __tmNormalizeTaskRepeatState(
                        refreshedTask?.repeatState || refreshedTask?.repeat_state || repeatState,
                    );
                    task = {
                        ...task,
                        ...(refreshedTask?.id ? refreshedTask : {}),
                        ...(shouldContinueAfterNativeReset ? {
                            done: false,
                            taskMarker: ' ',
                            task_marker: ' ',
                            taskCompleteAt: '',
                            task_complete_at: '',
                        } : {}),
                        repeatState: __tmNormalizeTaskRepeatState({
                            ...refreshedRepeatState,
                            pendingNativeDoneReset: false,
                        }),
                    };
                    repeatState = __tmNormalizeTaskRepeatState(task.repeatState);
                }
                const rule = __tmGetTaskRepeatRule(task);
                if (!rule.enabled || rule.type === 'none') continue;
                if (__tmIsTaskNativeDone(task)) {
                    const kernelCompletedAt = __tmNormalizeTaskCompleteAtValue(task?.taskCompleteAt || task?.task_complete_at || '');
                    if (!kernelCompletedAt) continue;
                    const repeatHistory = __tmNormalizeTaskRepeatHistory(task?.repeatHistory || task?.repeat_history || '');
                    const storedCompletedAt = __tmNormalizeTaskCompleteAtValue(
                        String(repeatState.lastCompletedAt || '').trim()
                        || String(repeatHistory[0]?.completedAt || '').trim()
                    );
                    const completionTimeDrift = Date.parse(kernelCompletedAt) - Date.parse(storedCompletedAt);
                    const completedAt = (storedCompletedAt && kernelCompletedAt
                        && completionTimeDrift >= 0 && completionTimeDrift <= 1000)
                        ? storedCompletedAt
                        : kernelCompletedAt;
                    if (!completedAt) continue;
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
        if (rule.type === 'fsrs') throw new Error('FSRS 间隔重复请使用“重来”重新安排');
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
        const draftTask = options?.draft === true && options?.task && typeof options.task === 'object'
            ? options.task
            : null;
        const task = draftTask || await __tmResolveTaskForRepeat(taskId);
        if (!task?.id) {
            hint('⚠ 未找到任务', 'warning');
            return null;
        }
        const nextRule = await showTaskRepeatRuleDialog(task, {
            title: String(options?.title || '循环设置').trim() || '循环设置',
        });
        if (nextRule === null) return null;
        if (draftTask) return nextRule;
        if (!nextRule.enabled || nextRule.type === 'none') {
            return await window.tmClearTaskRepeatRule(task.id, { source: 'task-repeat-dialog' });
        }
        return await window.tmSetTaskRepeatRule(task.id, nextRule, { source: 'task-repeat-dialog' });
    };

    window.tmReviewFsrsTask = async function(taskId, ratingInput, options = {}) {
        const task = await __tmResolveTaskForRepeat(taskId);
        if (!task?.id) throw new Error('未找到任务');
        const rule = __tmGetTaskRepeatRule(task);
        if (!rule.enabled || rule.type !== 'fsrs') throw new Error('该任务未开启 FSRS 间隔重复');
        const rating = __tmNormalizeFsrsRating(ratingInput);
        if (!rating) throw new Error('FSRS 评分无效');
        if (__tmIsTaskDoneEffective(task)) throw new Error('任务已完成，请等待循环推进完成');
        const opts = (options && typeof options === 'object') ? options : {};
        if (rating === 1) {
            const patch = __tmBuildFsrsReviewPatch(task, rating, {
                reviewedAt: opts.reviewedAt || new Date(),
            });
            const result = await __tmApplyTaskMetaPatchWithUndo(task.id, {
                startDate: patch.startDate,
                completionTime: patch.completionTime,
                repeatState: patch.repeatState,
            }, {
                source: String(opts.source || 'fsrs-review-again').trim() || 'fsrs-review-again',
                label: 'FSRS 重来',
                refresh: opts.refresh !== false,
                refreshCalendar: opts.refreshCalendar !== false,
                withFilters: opts.withFilters !== false,
                hard: false,
                recordUndo: opts.recordUndo !== false,
                broadcast: opts.broadcast !== false,
            });
            if (opts.suppressHint !== true) hint(`已重新安排到 ${patch.completionTime}`, 'success');
            return { ...result, rating, nextDue: patch.completionTime, completed: false };
        }
        const completed = await window.tmSetDone(task.id, true, null, {
            source: String(opts.source || 'fsrs-review').trim() || 'fsrs-review',
            fsrsRating: rating,
            wait: true,
            suppressHint: opts.suppressHint === true,
        });
        return { rating, completed: completed !== false };
    };

    async function __tmApplyFollowReminderDraft(payload = {}) {
        const source = (payload && typeof payload === 'object') ? payload : {};
        const taskRef = String(source.taskId || source.blockId || source.attrHostId || '').trim();
        if (!taskRef) throw new Error('任务 ID 为空');
        const task = await __tmResolveTaskForRepeat(taskRef);
        if (!task?.id) throw new Error('未找到任务');
        const completionTime = __tmNormalizeDateOnly(source.completionTime || '');
        if (!completionTime) throw new Error('任务截止日不能为空');
        const currentRule = __tmNormalizeTaskRepeatRule(task?.repeatRule, {
            startDate: task?.startDate,
            completionTime: task?.completionTime,
        });
        const currentState = __tmNormalizeTaskRepeatState(task?.repeatState);
        const completionChanged = __tmNormalizeDateOnly(task?.completionTime || '') !== completionTime;
        if (completionChanged) {
            await __tmApplyTaskMetaPatchWithUndo(task.id, {
                completionTime,
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
            changed: completionChanged,
            taskId: String(task.id || taskRef).trim() || taskRef,
            attrHostId: attrHostId || String(task.id || taskRef).trim() || taskRef,
            taskTitle: String(task?.content || task?.raw_content || task?.rawContent || task?.markdown || '任务').trim() || '任务',
            startDate: __tmNormalizeDateOnly(task?.startDate || ''),
            completionTime,
            repeatRule: currentRule,
            repeatState: currentState,
        };
    }

    async function __tmClearFollowReminderDraft(payload = {}) {
        const source = (payload && typeof payload === 'object') ? payload : {};
        const taskRef = String(source.taskId || source.blockId || source.attrHostId || '').trim();
        if (!taskRef) throw new Error('任务 ID 为空');
        const task = await __tmResolveTaskForRepeat(taskRef);
        if (!task?.id) throw new Error('未找到任务');
        const currentRule = __tmNormalizeTaskRepeatRule(task?.repeatRule, {
            startDate: task?.startDate,
            completionTime: task?.completionTime,
        });
        const currentState = __tmNormalizeTaskRepeatState(task?.repeatState);
        let attrHostId = '';
        try { attrHostId = String(__tmGetTaskAttrHostId(task) || '').trim(); } catch (e) {}
        return {
            ok: true,
            changed: false,
            taskId: String(task.id || taskRef).trim() || taskRef,
            attrHostId: attrHostId || String(task.id || taskRef).trim() || taskRef,
            completionTime: __tmNormalizeDateOnly(task?.completionTime || ''),
            repeatRule: currentRule,
            repeatState: currentState,
        };
    }

    try {
        const previousBridge = (__tmNs.reminderBridge && typeof __tmNs.reminderBridge === 'object')
            ? __tmNs.reminderBridge
            : {};
        __tmNs.reminderBridge = {
            ...previousBridge,
            version: 3,
            capabilities: Object.freeze({
                ...(previousBridge.capabilities || {}),
                completeFromReminder: typeof previousBridge.completeFromReminder === 'function',
                applyFollowDraft: true,
                clearFollowDraft: true,
                taskOwnsRepeatSchedule: true,
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
