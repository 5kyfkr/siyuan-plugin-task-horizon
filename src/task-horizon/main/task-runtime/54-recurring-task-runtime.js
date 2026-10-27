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

    // Completion is a task transition, even when its final native marker is
    // already reset for the next occurrence. Callers consume the receipt.
    function __tmBuildTaskCompletionPlan(task, intent, context) {
        const rule = __tmGetTaskRepeatRule(task);
        const recurring = rule.enabled && rule.type !== 'none' && rule.trigger !== 'checkin';
        const repeatState = __tmNormalizeTaskRepeatState(task.repeatState);
        const history = __tmNormalizeTaskRepeatHistory(task.repeatHistory);
        const occurrenceId = __tmGetTaskOccurrenceId(task);
        const existing = history.find((entry) => entry.id === context.operationId);
        const requestedOccurrence = String(intent.occurrenceId || occurrenceId);
        const previousDone = intent.nativeObserved
            ? intent.nativeObserved.previousDone === true
            : context.previousDone === true;
        const receipt = {
            outcome: 'committed', operationId: context.operationId, taskId: task.id,
            occurrenceId: requestedOccurrence, completionId: '', completedAt: '',
            completedOccurrence: false, recurring: !!recurring, advanced: false,
        };
        if (intent.source === 'task-repeat-native-reset') {
            const resetDateKey = __tmGetRecurringNativeDoneResetDateKey(task);
            if (!recurring || !__tmIsRecurringNativeDoneHeld(task)
                || !__tmIsSameTaskOccurrenceRound(requestedOccurrence, occurrenceId)
                || !resetDateKey || __tmNormalizeDateOnly(new Date(context.now)) < resetDateKey) {
                return { patch: {}, receipt: { ...receipt, outcome: 'alreadyApplied' } };
            }
            return { patch: {
                ...context.undoneStatus, done: false, taskCompleteAt: '',
                repeatState: __tmNormalizeTaskRepeatState({ ...repeatState, pendingNativeDoneReset: false }),
            }, receipt };
        }
        if (intent.restorePatch) {
            const restore = intent.restorePatch;
            const clean = (patch) => Object.fromEntries(Object.entries(patch || {}).filter(([key]) => !['markdown', 'taskMarker', 'task_marker', 'title', 'content', 'raw_content'].includes(key)));
            for (const [key, value] of Object.entries(clean(restore.expected))) {
                if (JSON.stringify(task[key] ?? '') !== JSON.stringify(value ?? '')) throw new Error('任务已有后续修改，不能覆盖新的状态');
            }
            return { patch: clean(restore.patch), receipt: { ...receipt, restoredState: true } };
        }
        const applied = (entry) => ({ patch: {}, receipt: {
            ...receipt, outcome: 'alreadyApplied', completionId: entry.id || '', completedAt: entry.completedAt,
            occurrenceId: entry.occurrenceId || requestedOccurrence,
            previousDates: { startDate: entry.sourceStart, completionTime: entry.sourceDue },
            nextDates: { startDate: entry.nextStart, completionTime: entry.nextDue },
            nextOccurrenceId: task.repeatState?.occurrenceId || '', origin: entry.origin || null,
        } });
        if (existing && intent.done === true) return applied(existing);
        if (intent.restoreState) {
            const restore = intent.restoreState;
            const entry = restore.historyEntry;
            if (entry?.id && history.some(item => item.id === entry.id)) return applied(entry);
            if (!entry || !__tmIsSameTaskOccurrenceRound(occurrenceId, restore.expectedOccurrenceId)
                || (entry.ruleSignature && entry.ruleSignature !== __tmGetTaskRepeatScheduleSignature(rule))) throw new Error('任务已有后续修改，不能恢复该次完成');
            return { patch: { ...restore.patch, repeatHistory: __tmNormalizeTaskRepeatHistory([entry, ...history]) },
                receipt: { ...applied(entry).receipt, outcome: 'committed', reappliedCompletionId: entry.id || entry.completedAt } };
        }
        let restoreId = String(intent.restoreCompletionId || '');
        if (recurring && intent.done === true) {
            const prior = __tmFindTaskRepeatHistoryEntryByOccurrence(history, requestedOccurrence);
            if (prior) return applied(prior);
        }
        if (!restoreId && recurring && intent.done === false && previousDone && __tmIsSameTaskOccurrenceRound(history[0]?.occurrenceId, occurrenceId)) {
            restoreId = history[0].id || history[0].completedAt;
        }
        if (recurring && requestedOccurrence !== occurrenceId) {
            const previous = __tmFindTaskRepeatHistoryEntryByOccurrence(history, requestedOccurrence);
            if (previous && intent.done === true) return applied(previous);
            if (previous && intent.done === false) restoreId = previous.id || previous.completedAt;
            // The same round can arrive with an id rendered by a different build
            // (legacy ids used to carry the view-date anchor). Only a round that
            // really moved on is a conflict; blocking the click is not a repair.
            else if (!restoreId && !__tmIsSameTaskOccurrenceRound(requestedOccurrence, occurrenceId)) throw new Error('任务轮次已变化，请刷新后重试');
        }
        if (!restoreId && intent.done === false && intent.nativeObserved?.previousDone === true && intent.nativeObserved.targetMarker === ' '
            && repeatState.pendingNativeDoneReset) restoreId = repeatState.lastCompletionId || repeatState.lastCompletedAt;
        if (restoreId) {
            let index = history.findIndex((entry) => entry.id === restoreId);
            if (index < 0) {
                const matching = history.map((entry, i) => entry.completedAt === restoreId ? i : -1).filter(i => i >= 0);
                if (matching.length > 1) throw new Error('存在同一时间的多条记录，请选择具体完成记录');
                index = matching[0] ?? -1;
            }
            if (index < 0) {
                if (repeatState.lastRestoredCompletionId === restoreId) return { patch: {}, receipt: { ...receipt, outcome: 'alreadyApplied', restoredCompletionId: restoreId } };
                throw new Error('未找到可撤销的完成记录');
            }
            const entry = history[index];
            if (index !== 0 || (entry.ruleSignature && entry.ruleSignature !== __tmGetTaskRepeatScheduleSignature(rule))) {
                throw new Error('任务已有后续完成或循环规则已修改，不能回退该记录');
            }
            const advanced = !!(entry.nextDue || entry.nextStart);
            const expectedDue = advanced ? entry.nextDue : entry.sourceDue;
            const expectedStart = advanced ? entry.nextStart : entry.sourceStart;
            if (String(task.completionTime || '') !== expectedDue || String(task.startDate || '') !== expectedStart) throw new Error('任务已改期，不能覆盖新的日期');
            const nextHistory = history.filter((_, i) => i !== index);
            const before = entry.before;
            const rollback = before ? {
                done: before.done, customStatus: before.customStatus,
                taskCompleteAt: before.taskCompleteAt,
                startDate: before.startDate, completionTime: before.completionTime,
                repeatState: __tmNormalizeTaskRepeatState(before.repeatState),
            } : {
                ...__tmBuildRecurringTaskRollbackPatch(task, entry, nextHistory),
                done: false, taskCompleteAt: '', ...context.undoneStatus,
            };
            rollback.repeatState = __tmNormalizeTaskRepeatState({ ...rollback.repeatState,
                occurrenceId: context.nextOccurrenceId || context.operationId + '-restored', lastRestoredCompletionId: entry.id || entry.completedAt });
            return {
                patch: { ...rollback, repeatHistory: nextHistory },
                receipt: { ...receipt, restoredCompletionId: entry.id || entry.completedAt, origin: entry.origin || null },
            };
        }
        const completedAt = String(context.completedAt || '').trim();
        const sameMarker = (intent.nativeObserved?.taskMarker || context.previousMarker) === (intent.nativeObserved?.targetMarker || context.targetMarker);
        const patch = {
            ...((intent.additionalPatch && typeof intent.additionalPatch === 'object') ? intent.additionalPatch : {}),
            ...(intent.done ? context.doneStatus : context.undoneStatus),
            done: intent.done === true,
            taskCompleteAt: context.targetClosed
                ? (sameMarker ? task.taskCompleteAt || completedAt : completedAt)
                : '',
        };
        if (!intent.done && repeatState.pendingNativeDoneReset) patch.repeatState = __tmNormalizeTaskRepeatState({ ...repeatState, pendingNativeDoneReset: false });
        if (!intent.done || previousDone) return { patch, receipt: { ...receipt, completedAt: patch.taskCompleteAt } };
        receipt.completedOccurrence = true;
        receipt.completedAt = completedAt;
        if (!recurring) return { patch, receipt };
        const fsrs = rule.type === 'fsrs';
        const rating = Number(intent.fsrsRating) || 0;
        if (fsrs && rating < 2) throw new Error('FSRS 任务需要选择困难、良好或简单；重来请使用复习菜单');
        const next = fsrs
            ? __tmBuildFsrsReviewPatch(task, rating, { completedAt, reviewedAt: completedAt })
            : __tmBuildTaskRepeatAdvancePatch(task, rule, { completedAt, advancedAt: context.now });
        if (!next && !(rule.maxOccurrences > 0 && repeatState.occurrenceCount >= rule.maxOccurrences)
            && !__tmBuildTaskRepeatAdvancePatch(task, { ...rule, until: '', maxOccurrences: 0 }, { completedAt })) {
            throw new Error('循环规则没有有效的下一日期，请检查规则和支持的日期范围');
        }
        const keepNativeDone = !!next && context.keepNativeDone === true;
        const focus = __tmGetTaskTomatoFocusValues(task);
        const cumulative = __tmGetTaskTomatoCumulativeValues(task);
        const beforeTask = intent.nativeObserved ? { ...task, ...intent.nativeObserved } : task;
        const entry = {
            id: context.operationId, occurrenceId, completedAt,
            ruleSignature: __tmGetTaskRepeatScheduleSignature(rule),
            occurrenceNumber: repeatState.occurrenceCount, totalOccurrences: rule.maxOccurrences,
            sourceStart: task.startDate || '', sourceDue: task.completionTime || '',
            nextStart: next?.startDate || '', nextDue: next?.completionTime || '',
            content: task.content || task.raw_content || '', docId: task.root_id || task.docId || '',
            docName: task.docName || task.doc_name || '', h2: task.h2 || '', h2Id: task.h2Id || '', h2Path: task.h2Path || '',
            priority: task.priority || '', customStatus: task.customStatus || '', duration: task.duration || '', remark: task.remark || '', docSeq: task.docSeq,
            tomatoMinutes: String(cumulative.tomatoMinutes), tomatoHours: String(cumulative.tomatoHours), tomatoCount: String(cumulative.tomatoCount),
            tomatoOccurrenceMinutes: String(focus.tomatoMinutes), tomatoOccurrenceHours: String(focus.tomatoHours), tomatoOccurrenceCount: String(focus.tomatoCount),
            rating: fsrs ? rating : 0, fsrsBefore: next?.review?.beforeCard || null, fsrsAfter: next?.review?.afterCard || null,
            before: {
                done: beforeTask.done === true, customStatus: beforeTask.customStatus || '', taskCompleteAt: beforeTask.taskCompleteAt || '',
                startDate: task.startDate || '', completionTime: task.completionTime || '', repeatState,
            },
            origin: intent.origin || (intent.scheduleId ? { scheduleId: intent.scheduleId } : null),
        };
        Object.assign(patch, {
            ...(next ? { startDate: next.startDate, completionTime: next.completionTime } : {}),
            repeatState: __tmNormalizeTaskRepeatState({
                ...(next?.repeatState || repeatState),
                occurrenceId: next ? (context.nextOccurrenceId || context.operationId + '-next') : occurrenceId,
                lastCompletionId: context.operationId, lastCompletedAt: completedAt,
                lastAdvancedAt: context.now, pendingNativeDoneReset: keepNativeDone,
                ...__tmBuildTaskTomatoBaselinePatch(task),
            }),
            repeatHistory: __tmNormalizeTaskRepeatHistory([entry, ...history]),
            ...((!next || keepNativeDone) ? context.doneStatus : context.undoneStatus),
            done: !next || keepNativeDone,
            taskCompleteAt: (!next || keepNativeDone) ? completedAt : '',
        });
        return { patch, receipt: {
            ...receipt, completionId: entry.id, advanced: !!next,
            nextOccurrenceId: patch.repeatState.occurrenceId,
            previousDates: { startDate: task.startDate || '', completionTime: task.completionTime || '' },
            nextDates: { startDate: patch.startDate || task.startDate || '', completionTime: patch.completionTime || task.completionTime || '' },
            origin: entry.origin,
        } };
    }

    async function __tmExecuteTaskCompletion(op) {
        const data = op.data || {};
        let task = data.baseline || await __tmReadTaskMutationBaseline(data.taskId);
        if (!task?.id) throw new Error('无法读取完整任务状态');
        const rule = __tmGetTaskRepeatRule(task);
        const occurrenceMatches = !data.occurrenceId || __tmIsSameTaskOccurrenceRound(data.occurrenceId, __tmGetTaskOccurrenceId(task));
        if (data.done && !data.previousDone && occurrenceMatches && !task.repeatHistory?.some(entry => entry.id === op.id) && rule.enabled && rule.trigger !== 'checkin') {
            await __tmSettleTomatoAfterTaskDone(task.id, { task, source: data.source, operationId: op.id, occurrenceId: data.occurrenceId, timerContext: data.timerContext, timerOnly: true, throwOnFailure: true });
            task = await __tmReadTaskMutationBaseline(task.id);
            if (!task) throw new Error('番茄结算后未能确认任务状态');
        }
        const doneStatus = __tmBuildCheckboxStatusPatch(task, true, data.statusPatch) || {};
        const undoneStatus = __tmBuildCheckboxStatusPatch(task, false, data.done ? null : data.statusPatch) || {};
        const plan = __tmBuildTaskCompletionPlan(task, data, {
            operationId: op.id, now: new Date().toISOString(),
            nextOccurrenceId: __tmCreateMutationOperationId() + '-round',
            completedAt: data.completedAt || data.patch?.taskCompleteAt || (data.done && !data.previousDone ? __tmNowInChinaTimezoneIso() : task.taskCompleteAt) || __tmNowInChinaTimezoneIso(),
            previousDone: data.previousDone,
            keepNativeDone: SettingsStore?.data?.recurringTaskKeepNativeDoneUntilNextOccurrence === true,
            doneStatus, undoneStatus,
            previousMarker: __tmResolveTaskMarker(task),
            targetMarker: data.nativeObserved?.targetMarker || __tmFindStatusOptionById((data.done ? doneStatus : undoneStatus).customStatus)?.marker || (data.done ? 'X' : ' '),
            targetClosed: __tmIsTaskMarkerClosed(data.nativeObserved?.targetMarker
                || __tmFindStatusOptionById((data.done ? doneStatus : undoneStatus).customStatus)?.marker
                || (data.done ? 'X' : ' ')),
        });
        data.completion = plan.receipt;
        if (!Object.keys(plan.patch).length) {
            const marker = __tmResolveTaskMarker(task);
            data.committedPatch = { done: task.done === true, customStatus: task.customStatus || '',
                taskCompleteAt: task.taskCompleteAt || '', startDate: task.startDate || '', completionTime: task.completionTime || '',
                repeatState: task.repeatState, repeatHistory: task.repeatHistory,
                taskMarker: marker, task_marker: marker, markdown: task.markdown };
            return { task, authoritative: true, completion: plan.receipt };
        }
        const expected = task.__tmCompletionExpected || {};
        const result = await __tmExecuteTaskCommandGateway({
            action: 'patch', commandID: op.id, taskID: task.id, patch: plan.patch,
            options: { allowSystem: true, expected }, recordUndo: false,
            laneID: __tmGetActiveTaskMutationLaneId(task.id),
        }, '任务完成状态');
        const confirmed = __tmNormalizeQueuedKernelTaskSnapshot(result.task || result.value?.task);
        if (!confirmed) throw new Error('任务写入未返回确认状态');
        const marker = __tmResolveTaskMarker(confirmed);
        const projection = { ...plan.patch, taskMarker: marker, task_marker: marker, markdown: confirmed.markdown };
        globalThis.__tmTaskStore?.upsertLocal?.(confirmed, { status: 'completion-committed' });
        __tmApplyTaskFieldPatchToLocalMirrors(task.id, projection);
        __tmMarkLocalTaskPatchWatermark(task.id, projection, { source: data.source });
        MetaStore.set(task.id, plan.patch);
        if (plan.patch.repeatHistory) __tmSyncRecurringInstanceTasks(confirmed);
        data.committedPatch = projection;
        if (data.recordUndo !== false && !__tmUndoState.applying) {
            const inverse = {};
            const before = data.nativeObserved ? { ...task, ...data.nativeObserved } : task;
            Object.keys(plan.patch).filter((key) => key !== 'repeatHistory').forEach((key) => { inverse[key] = before[key] ?? ''; });
            __tmPushUndoRecord({
                type: 'setDone', taskId: task.id, label: data.done ? '完成任务' : '取消完成',
                patch: { ...plan.patch, done: data.done }, inversePatch: inverse,
                completionId: plan.receipt.completionId || '',
                removedCompletion: plan.receipt.restoredCompletionId ? task.repeatHistory.find(entry => (entry.id || entry.completedAt) === plan.receipt.restoredCompletionId) : null,
                expectedOccurrenceId: confirmed.repeatState?.occurrenceId || '',
                expectedPatch: plan.receipt.completionId ? null : plan.patch,
            });
        }
        __tmDispatchTaskAttrPatchUpdated(task.id, plan.patch, { source: data.source, localMutation: true });
        globalThis.__tmTaskSnapshotService?.scheduleAfterLocalPatch?.(task.id, plan.patch, { source: data.source, persistSnapshot: true });
        state.listDomRenderSignature = '';
        __tmScheduleViewRefresh?.({ mode: 'current', withFilters: true, reason: 'task-completion', taskIds: [task.id], bypassDefer: true });
        return { task: confirmed, authoritative: true, completion: plan.receipt, changeSet: result.changeSet };
    }

    try { globalThis.__tmExecuteTaskCompletion = __tmExecuteTaskCompletion; } catch (e) {}

    async function __tmSynchronizeCompletionLinks(task, receipt, options = {}) {
        const errors = [];
        const attempt = async (run) => { try { if (await run() === false) throw new Error('关联状态未保存'); } catch (error) { errors.push(String(error?.message || error)); } };
        if (receipt.completionId) {
            const entry = task.repeatHistory?.find(item => item.id === receipt.completionId);
            if (entry && receipt.origin?.scheduleId) await attempt(() => __tmReassignCompletedScheduleToRecurringInstance(receipt.origin.scheduleId, task, entry, receipt.origin));
            const reminder = globalThis.__tomatoReminder;
            if (SettingsStore?.data?.enableTomatoIntegration && (!options.skipOriginReminder || !receipt.origin?.reminderId)) {
                if (reminder?.capabilities?.completionReceipt === true) await attempt(() => reminder.completeFollowTaskReminder(task.id, { completion: receipt }));
                else if (typeof reminder?.get === 'function') await attempt(async () => {
                    const record = await reminder.get(task.id);
                    if (record?.repeatMode === 'followTaskRepeat') throw new Error('请更新番茄钟以同步循环实例');
                    return true;
                });
            }
        }
        if (receipt.restoredCompletionId) {
            if (SettingsStore?.data?.enableTomatoIntegration && typeof globalThis.__tomatoReminder?.restoreTaskCompletion === 'function') await attempt(() => globalThis.__tomatoReminder.restoreTaskCompletion(task.id, receipt));
            if (typeof globalThis.__tmCalendar?.restoreTaskCompletion === 'function') await attempt(() => globalThis.__tmCalendar.restoreTaskCompletion(task.id, receipt));
        }
        return { ok: errors.length === 0, message: errors.join('；') };
    }

    async function __tmApplyCompletionReceiptEffects(taskId, options) {
        const receipt = options.completion;
        const task = globalThis.__tmTaskBoundary?.getTask?.(taskId);
        const followUpOps = [];
        let timerError = '';
        if (receipt.outcome === 'alreadyApplied' && !receipt.restoredCompletionId) {
            const linkage = task ? await __tmSynchronizeCompletionLinks(task, receipt) : { ok: true };
            return { completion: receipt, followUpOps, linkage };
        }
        if (receipt.completedOccurrence) {
            globalThis.__tmPublicApiRuntime?.notifyCompleted(task, receipt, options.source);
            if (Number(options.rewardPriorityScore) > 0) __tmDispatchTaskCompletedForReward(task, {
                taskId, priorityScore: options.rewardPriorityScore,
                completedAt: receipt.completedAt, previousDone: false, nextDone: true,
                idempotencyKey: receipt.operationId + ':reward', source: options.source,
            });
            if (!receipt.recurring) {
                try { await __tmSettleTomatoAfterTaskDone(taskId, { task, source: options.source, timerContext: options.timerContext, throwOnFailure: true }); }
                catch (error) { timerError = String(error?.message || error); }
            }
        }
        const linkage = task ? await __tmSynchronizeCompletionLinks(task, receipt, { skipOriginReminder: true }) : { ok: true };
        if (timerError) { linkage.ok = false; linkage.message = [timerError, linkage.message].filter(Boolean).join('；'); }
        if (options.skipAutoCompleteParent !== true) {
            const parent = await __tmSyncParentDoneStateFromSubtasks(taskId, {
                ...options, done: task ? __tmIsTaskDoneEffective(task) : receipt.completedOccurrence,
                returnMutationDefinition: true,
            });
            if (parent) followUpOps.push(parent);
        }
        if (!receipt.recurring) globalThis.__tmTaskLifecycle?.notifyCompletion?.(taskId, task ? __tmIsTaskDoneEffective(task) : receipt.completedOccurrence, {
            task, previousDone: options.previousDone, source: options.source,
        });
        try { await globalThis.__tomatoReminder?.taskContextChanged?.(taskId, { reason: 'task-completion', completion: receipt }); } catch (e) {}
        return { completion: receipt, completed: true, recurringAdvanced: receipt.advanced, followUpOps, linkage };
    }

    try { globalThis.__tmApplyCompletionReceiptEffects = __tmApplyCompletionReceiptEffects; } catch (e) {}

    function __tmBuildRecurringTaskRollbackPatch(task, removedEntry, nextHistory = []) {
        const removed = (removedEntry && typeof removedEntry === 'object') ? removedEntry : null;
        if (!removed) return null;
        const nextHead = Array.isArray(nextHistory) && nextHistory.length > 0 ? nextHistory[0] : null;
        const rollbackStart = __tmNormalizeDateOnly(
            removed.sourceStart
            || nextHead?.nextStart
            || nextHead?.sourceStart
            || removed.nextStart
            || task?.startDate
            || ''
        );
        const rollbackDue = __tmNormalizeDateOnly(
            removed.sourceDue
            || nextHead?.nextDue
            || nextHead?.sourceDue
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
            pendingNativeDoneReset: (!nextRule.enabled || nextRule.type === 'none' || nextRule.trigger === 'checkin')
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
        // Check-in schedules own their dates through anchorDate.
        if (nextRule.enabled && nextRule.trigger === 'checkin') {
            patch.completionTime = '';
            nextState.lastInstanceDue = '';
        }
        if (scheduleChanged && nextRule.trigger !== 'checkin' && __tmMonthRepeatCore?.isExplicit(nextRule)) {
            const currentKey = __tmNormalizeDateOnly(task.completionTime || task.startDate || nextRule.anchorDate);
            const firstKey = __tmMonthRepeatCore.nextDateKey(nextRule, currentKey, true);
            if (!firstKey) throw new Error('月循环没有有效日期，请检查日期和结束条件');
            nextRule.anchorDate = firstKey;
            patch.completionTime = firstKey;
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
        if (nextRule.enabled && nextRule.type !== 'none') {
            patch.startDate = '';
            nextState.lastInstanceStart = '';
        }
        return patch;
    }

    async function __tmApplyTaskRepeatRule(taskId, ruleInput, options = {}) {
        const task = await __tmResolveTaskForRepeat(taskId);
        if (!task?.id) throw new Error('未找到任务');
        const opts = (options && typeof options === 'object') ? options : {};
        const datePatch = {};
        for (const field of ['startDate', 'completionTime']) {
            if (Object.prototype.hasOwnProperty.call(opts.datePatch || {}, field)) datePatch[field] = opts.datePatch[field];
        }
        const patch = { ...datePatch, ...__tmBuildTaskRepeatRuleMetaPatch({ ...task, ...datePatch }, ruleInput) };
        const nextRule = patch.repeatRule;
        const nextState = patch.repeatState;
        if (__tmGetTaskRepeatScheduleSignature(task.repeatRule) !== __tmGetTaskRepeatScheduleSignature(nextRule)
            || nextState.occurrenceCount !== __tmNormalizeTaskRepeatState(task.repeatState).occurrenceCount) {
            nextState.occurrenceId = __tmCreateMutationOperationId() + '-rule';
            delete nextState.planOverride;
        }
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
        const removedIndex = currentHistory.findIndex((item) => String(item?.id || item?.completedAt || '').trim() === key || String(item?.completedAt || '').trim() === key);
        const removedEntry = removedIndex >= 0 ? currentHistory[removedIndex] : null;
        const nextHistory = removedIndex >= 0
            ? currentHistory.filter((_, index) => index !== removedIndex)
            : currentHistory.filter((item) => String(item?.completedAt || '').trim() !== key);
        if (nextHistory.length === currentHistory.length) return false;
        if (opts.resetNativeDone === true || opts.restore === true) {
            const restore = globalThis.__tmRequireTaskMutation('setDone');
            return await restore(task.id, false, {
                wait: true, restoreCompletionId: removedEntry.id || removedEntry.completedAt,
                recordUndo: opts.recordUndo !== false, source,
            }) !== false;
        }
        const nextPatch = {
            repeatHistory: nextHistory,
        };
        if (removedIndex === 0) {
            try { __tmClearRecurringTaskAdvanceTimer(task.id); } catch (e) {}
        }
        await __tmApplyTaskMetaPatchWithUndo(task.id, nextPatch, {
            source,
            label: '删除循环记录',
            refresh: false,
            refreshCalendar: false,
            withFilters: true,
            hard: false,
            recordUndo: opts.recordUndo !== false,
        });
        try { __tmApplyTaskFieldPatchToLocalMirrors(task.id, nextPatch); } catch (e) {}
        const removedVirtualTaskId = String(
            __tmBuildRecurringInstanceTask(task, removedEntry, Math.max(0, removedIndex))?.id || ''
        ).trim();
        __tmPurgeRecurringInstanceTasks(task.id, [removedEntry.completedAt]);
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
            const setDone = globalThis.__tmRequireTaskMutation?.('setDone');
            if (typeof setDone !== 'function') throw new Error('任务完成写入队列未就绪');
            // Reset only the held native marker; the UI entry treats unchecking
            // a held occurrence as undoing its completion and history.
            const resetResult = await setDone(taskId, false, {
                wait: true,
                suppressHint: true,
                source: 'task-repeat-native-reset',
                occurrenceId: __tmGetTaskOccurrenceId(task),
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
            if (resetResult?.completion?.outcome === 'alreadyApplied') return false;
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
            const advanced = await __tmAdvanceRecurringTaskAfterCompletionInternal(advanceTaskId, options);
            return advanced;
        } catch (error) {
            throw error;
        } finally {
            __tmRecurringAdvanceInFlightIds.delete(advanceTaskId);
        }
    }

    async function __tmAdvanceRecurringTaskAfterCompletionInternal(taskId, options = {}) {
        const task = await __tmResolveTaskForRepeat(taskId);
        if (!task || !__tmIsTaskNativeDone(task) || __tmIsCheckinTask(task)) return false;
        const rule = __tmGetTaskRepeatRule(task);
        if (!rule.enabled || rule.type === 'none' || __tmIsRecurringNativeDoneHeld(task)) return false;
        const completedAt = __tmNormalizeTaskCompleteAtValue(options.completedAt || task.taskCompleteAt || '');
        if (!completedAt) return false;
        const existing = __tmNormalizeTaskRepeatHistory(task.repeatHistory).find((entry) => entry.completedAt === completedAt);
        if (existing) {
            if (existing.id && !existing.nextStart && !existing.nextDue) return false;
            return await window.tmSetDone(task.id, false, null, {
                wait: true, force: true, recordUndo: false, suppressHint: true,
                skipAutoCompleteParent: true, source: 'task-repeat-recovery-reset',
            }) !== false;
        }
        const result = await window.tmSetDone(task.id, true, null, {
            wait: true, force: true, returnReceipt: true, recordUndo: false,
            operationId: 'recover-' + task.id + '-' + encodeURIComponent(completedAt),
            occurrenceId: __tmGetTaskOccurrenceId(task), completedAt,
            nativeObserved: { previousDone: false, done: false, targetMarker: 'X' },
            fsrsRating: options.fsrsRating || 3, source: 'task-repeat-load-reconcile',
            suppressHint: true,
        });
        return result?.outcome === 'committed' && result?.completedOccurrence === true;
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
            try { __tmRefreshNativeDocCheckinCheckboxes(); } catch (e) {}
            try {
                __tmRefreshViewsAfterTaskMutation({
                    refresh: true,
                    refreshCalendar: true,
                    withFilters: true,
                    hard: false,
                    reason: 'task-checkin-new-day',
                });
            } catch (e) {}
            void __tmRunRecurringNativeDoneResetSweep({ source: 'task-repeat-native-reset-midnight' });
            __tmArmRecurringNativeDoneResetSweepTimer();
        }, Math.max(1000, nextMidnight.getTime() - now.getTime()));
    }

    function __tmScheduleRecurringNativeDoneResetSweep(source = '') {
        try { __tmRefreshNativeDocCheckinCheckboxes(); } catch (e) {}
        __tmArmRecurringNativeDoneResetSweepTimer();
        return __tmRunRecurringNativeDoneResetSweep({
            source: String(source || 'task-repeat-native-reset-schedule').trim() || 'task-repeat-native-reset-schedule',
        });
    }

    function __tmDisposeRecurringNativeDoneResetSweep() {
        if (__tmRecurringNativeDoneResetSweepTimer) clearTimeout(__tmRecurringNativeDoneResetSweepTimer);
        __tmRecurringNativeDoneResetSweepTimer = null;
        __tmRecurringNativeDoneResetLastDateKey = '';
        if (typeof __tmRecurringReconcileGeneration !== 'undefined') {
            __tmRecurringReconcileGeneration += 1;
            __tmRecurringReconcilePending.clear();
        }
    }

    try {
        globalThis.__tmRunRecurringNativeDoneResetSweep = __tmRunRecurringNativeDoneResetSweep;
        globalThis.__tmScheduleRecurringNativeDoneResetSweep = __tmScheduleRecurringNativeDoneResetSweep;
        globalThis.__tmDisposeRecurringNativeDoneResetSweep = __tmDisposeRecurringNativeDoneResetSweep;
    } catch (e) {}

    let __tmRecurringDueReconcilePromise = null;
    const __tmRecurringReconcilePending = new Map();
    let __tmRecurringReconcileGeneration = 0;
    async function __tmReconcileRecurringTasksOnLoad(taskIdsInput, options = {}) {
        const taskIds = Array.from(new Set((Array.isArray(taskIdsInput) ? taskIdsInput : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean)));
        taskIds.forEach((id) => __tmRecurringReconcilePending.set(id, options));
        if (__tmRecurringDueReconcilePromise) return await __tmRecurringDueReconcilePromise;
        if (!taskIds.length) return 0;
        const generation = __tmRecurringReconcileGeneration;
        const job = (async () => {
            let changed = 0;
            while (__tmRecurringReconcilePending.size && generation === __tmRecurringReconcileGeneration) {
                const taskId = __tmRecurringReconcilePending.keys().next().value;
                const opts = __tmRecurringReconcilePending.get(taskId) || {};
                __tmRecurringReconcilePending.delete(taskId);
                const todayKey = __tmNormalizeDateOnly(opts.todayKey || new Date());
                const task = await __tmResolveTaskForRepeat(taskId);
                if (generation !== __tmRecurringReconcileGeneration) break;
                if (!task?.id) continue;
                const repeatState = __tmNormalizeTaskRepeatState(task?.repeatState);
                const lastEntry = task.repeatHistory?.find(entry => entry.id && entry.id === repeatState.lastCompletionId);
                if (repeatState.lastRestoredCompletionId) await __tmSynchronizeCompletionLinks(task, { restoredCompletionId: repeatState.lastRestoredCompletionId });
                if (lastEntry) {
                    const recovered = __tmBuildTaskCompletionPlan(task, { done: true }, { operationId: lastEntry.id });
                    await __tmSynchronizeCompletionLinks(task, recovered.receipt);
                    if (generation !== __tmRecurringReconcileGeneration) break;
                    if (!lastEntry.nextStart && !lastEntry.nextDue) continue;
                }
                if (repeatState.pendingNativeDoneReset === true) {
                    const reset = await __tmResetRecurringNativeDoneIfDue(task, {
                        todayKey,
                        source: 'task-repeat-load-native-reset',
                    });
                    if (reset) changed += 1;
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
        nextPatch.repeatState = __tmNormalizeTaskRepeatState({ ...nextPatch.repeatState,
            occurrenceId: __tmCreateMutationOperationId() + '-skip', planOverride: null });
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
            customOnly: options?.customOnly === true,
            initialTrigger: options?.initialTrigger,
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
        const currentRule = __tmNormalizeTaskRepeatRule(task?.repeatRule, {
            startDate: task?.startDate,
            completionTime: task?.completionTime,
        });
        const checkin = currentRule?.enabled && currentRule.trigger === 'checkin';
        const completionTime = __tmNormalizeDateOnly(checkin ? task?.completionTime || '' : source.completionTime || '');
        if (!checkin && !completionTime) throw new Error('任务截止日不能为空');
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
            version: 4,
            capabilities: Object.freeze({
                ...(previousBridge.capabilities || {}),
                completeFromReminder: typeof previousBridge.completeFromReminder === 'function',
                applyFollowDraft: true,
                clearFollowDraft: true,
                taskOwnsRepeatSchedule: true,
                completionReceipt: true,
                restoreCompletion: true,
            }),
            async completeFromReminder(payload = {}) {
                const taskId = String(payload.taskId || payload.blockId || '').trim();
                const task = await __tmResolveTaskForRepeat(taskId);
                if (!task || !SettingsStore.data.enableTomatoIntegration) return { ok: false, applied: false, code: 'UNAVAILABLE' };
                if (__tmIsCheckinTask(task)) {
                    const applied = await window.tmSetTaskCheckin(task.id, payload.dateKey || String(payload.occurrenceKey || '').slice(0, 10), true, { source: 'tomato-reminder-checkin' });
                    return { ok: applied === true, applied: applied === true };
                }
                const requestedOccurrence = payload.taskOccurrenceId || payload.reminder?.taskRepeatState?.occurrenceId;
                const knownCompletion = !!__tmFindTaskRepeatHistoryEntryByOccurrence(task.repeatHistory, requestedOccurrence);
                if (!knownCompletion && payload.dateKey && task.completionTime && payload.dateKey !== task.completionTime) {
                    return { ok: false, applied: false, code: 'CONFLICT', message: '任务已改期，请刷新提醒' };
                }
                const occurrenceId = payload.taskOccurrenceId || __tmGetTaskOccurrenceId({
                    id: task.id, repeatState: payload.reminder?.taskRepeatState, repeatRule: payload.reminder?.taskRepeatRule,
                });
                const operationId = payload.operationId || 'reminder-' + task.id + '-' + encodeURIComponent(occurrenceId + '|' + payload.occurrenceKey);
                const result = await globalThis.__tmRequireTaskMutation('setDone')(task.id, true, {
                    wait: true, operationId, occurrenceId, fsrsRating: 3,
                    completedAt: payload.completedAt || __tmNowInChinaTimezoneIso(),
                    source: 'tomato-reminder-complete', suppressHint: true,
                    origin: { reminderId: String(payload.blockId || task.id), dateKey: payload.dateKey || String(payload.occurrenceKey || '').slice(0, 10), timeKey: payload.timeKey || String(payload.occurrenceKey || '').slice(11), occurrenceKey: payload.occurrenceKey },
                });
                const completion = result?.completion;
                return { ok: !!completion, applied: !!completion, completion, taskId: task.id };
            },
            async restoreCompletion(payload = {}) {
                const owner = payload.owner || payload;
                const taskId = String(payload.taskId || owner.taskId || '').trim();
                const task = await __tmResolveTaskForRepeat(taskId);
                if (!task) return { ok: false, applied: false };
                if (!owner.completionId && task.taskCompleteAt !== owner.completedAt) return { ok: false, applied: false, code: 'CONFLICT' };
                const result = await globalThis.__tmRequireTaskMutation('setDone')(task.id, false, {
                    wait: true, restoreCompletionId: owner.completionId || '',
                    origin: { reminderId: payload.blockId || '' }, source: 'tomato-reminder-undo',
                });
                return { ok: result !== false, applied: result !== false, completion: result?.completion };
            },
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
