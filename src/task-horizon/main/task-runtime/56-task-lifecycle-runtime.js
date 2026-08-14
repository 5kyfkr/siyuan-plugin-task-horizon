    const __TM_TASK_LIFECYCLE_ATTR = 'custom-task-horizon-lifecycle';
    const __TM_COMPLETED_HEADING_TEXT = '已完成';
    const __tmTaskLifecycleHeadingLocks = new Map();
    const __tmTaskCompletionArchiveRequests = new Map();
    const __TM_TASK_COMPLETION_ARCHIVE_DEDUPE_MS = 5000;

    function __tmNormalizeTaskLifecycleMeta(value) {
        let source = value;
        if (typeof source === 'string' && String(source || '').trim()) {
            try { source = JSON.parse(source); } catch (e) { source = null; }
        }
        const raw = (source && typeof source === 'object' && !Array.isArray(source)) ? source : {};
        const out = { v: 1 };
        const completed = raw.completed && typeof raw.completed === 'object' ? raw.completed : null;
        const completedMode = String(completed?.mode || '').trim();
        const completedOriginDocId = String(completed?.originDocId || '').trim();
        if (completedOriginDocId && (completedMode === 'document' || completedMode === 'heading')) {
            out.completed = {
                originDocId: completedOriginDocId,
                mode: completedMode,
                archivedAt: String(completed?.archivedAt || '').trim(),
                ...(String(completed?.archiveDocId || '').trim() ? { archiveDocId: String(completed.archiveDocId).trim() } : {}),
                ...(String(completed?.archiveListId || '').trim() ? { archiveListId: String(completed.archiveListId).trim() } : {}),
            };
        }
        const recycle = raw.recycle && typeof raw.recycle === 'object' ? raw.recycle : null;
        const recycleOriginDocId = String(recycle?.originDocId || '').trim();
        if (recycleOriginDocId) {
            out.recycle = {
                originDocId: recycleOriginDocId,
                originParentTaskId: String(recycle?.originParentTaskId || '').trim(),
                archivedAt: String(recycle?.archivedAt || '').trim(),
                ...(String(recycle?.archiveDocId || '').trim() ? { archiveDocId: String(recycle.archiveDocId).trim() } : {}),
                ...(String(recycle?.archiveListId || '').trim() ? { archiveListId: String(recycle.archiveListId).trim() } : {}),
            };
        }
        return out;
    }

    async function __tmReadTaskLifecycleMeta(taskId) {
        const tid = String(taskId || '').trim();
        if (!tid) return { v: 1 };
        const response = await API.call('/api/attr/getBlockAttrs', { id: tid });
        if (!response || response.code !== 0) throw new Error(response?.msg || '读取任务归档信息失败');
        return __tmNormalizeTaskLifecycleMeta(response.data?.[__TM_TASK_LIFECYCLE_ATTR]);
    }

    async function __tmWriteTaskLifecycleMeta(taskId, value) {
        const tid = String(taskId || '').trim();
        if (!tid) throw new Error('未找到任务');
        const meta = __tmNormalizeTaskLifecycleMeta(value);
        const hasData = !!(meta.completed || meta.recycle);
        await __tmBackendAdapter.setAttrs(tid, {
            [__TM_TASK_LIFECYCLE_ATTR]: hasData ? JSON.stringify(meta) : '',
        });
        return meta;
    }

    function __tmGetTaskLifecycleLocalTask(taskId) {
        const tid = String(taskId || '').trim();
        if (!tid) return null;
        return globalThis.__tmTaskBoundary?.getTask?.(tid) || null;
    }

    async function __tmResolveTaskLifecycleTask(taskId) {
        const tid = String(taskId || '').trim();
        const localTask = __tmGetTaskLifecycleLocalTask(tid);
        let persistedTask = null;
        persistedTask = await API.getTaskById(tid);
        if (!persistedTask && !localTask) return { task: null, localTask: null };
        const task = { ...((localTask && typeof localTask === 'object') ? localTask : {}), ...((persistedTask && typeof persistedTask === 'object') ? persistedTask : {}) };
        if (persistedTask && typeof persistedTask.markdown === 'string') {
            try {
                const parsed = API.parseTaskStatus?.(persistedTask.markdown);
                if (parsed && typeof parsed.done === 'boolean') task.done = parsed.done;
            } catch (e) {}
        }
        if (persistedTask && typeof persistedTask === 'object') {
            ['repeat_rule', 'repeat_state', 'repeat_history', 'custom_status', 'task_complete_at'].forEach((key) => {
                if (Object.prototype.hasOwnProperty.call(persistedTask, key)) {
                    const canonical = key === 'repeat_rule'
                        ? 'repeatRule'
                        : (key === 'repeat_state'
                            ? 'repeatState'
                            : (key === 'repeat_history' ? 'repeatHistory' : (key === 'custom_status' ? 'customStatus' : 'taskCompleteAt')));
                    task[canonical] = persistedTask[key];
                }
            });
        }
        try { normalizeTaskFields(task, String(task.doc_name || task.docName || localTask?.docName || '').trim()); } catch (e) {}
        return { task, localTask };
    }

    function __tmIsTaskLifecycleDone(task, localTask = null) {
        if (task && typeof task.done === 'boolean') return task.done;
        if (localTask && typeof localTask.done === 'boolean') return localTask.done;
        try { return typeof __tmIsTaskDoneEffective === 'function' ? !!__tmIsTaskDoneEffective(task) : !!task?.done; } catch (e) {}
        return !!task?.done;
    }

    function __tmCanArchiveCompletedTask(task, done) {
        if (!(task && typeof task === 'object') || done !== true) return false;
        if (String(task.parentTaskId || task.parent_task_id || '').trim()) return false;
        try { if (__tmIsRecurringInstanceTask(task)) return false; } catch (e) {}
        try {
            const repeatRule = __tmGetTaskRepeatRule(task);
            if (repeatRule?.enabled === true && String(repeatRule.type || 'none').trim() !== 'none') return false;
        } catch (e) {}
        return true;
    }

    function __tmBuildTaskLifecycleHeading(headingPatch) {
        const patch = (headingPatch && typeof headingPatch === 'object') ? headingPatch : null;
        if (!patch || !String(patch.h2Id || '').trim()) return null;
        return {
            id: String(patch.h2Id || '').trim(),
            content: __tmNormalizeHeadingText(patch.h2 || ''),
            rank: Number(patch.h2Rank),
        };
    }

    async function __tmResolveTaskLifecycleDefaultPlacement(docId) {
        const did = String(docId || '').trim();
        if (!did) throw new Error('未找到目标文档');
        const resolved = await __tmResolveDefaultNewTaskInsertOptions(did, 'doc', { contentCount: 1 });
        const placement = (resolved && typeof resolved === 'object') ? resolved : {};
        let nextID = String(placement.insertBeforeId || '').trim();
        if (!nextID && placement.atTop === true) {
            try { nextID = String(await API.getFirstDirectChildIdOfDoc(did) || '').trim(); } catch (e) { nextID = ''; }
        }
        return {
            placement: {
                parentID: String(placement.insertParentId || did).trim() || did,
                nextID,
                previousID: String(placement.insertAfterId || '').trim(),
            },
            heading: __tmBuildTaskLifecycleHeading(placement.headingPatch),
        };
    }

    async function __tmWithTaskLifecycleHeadingLock(docId, runner) {
        const did = String(docId || '').trim();
        const previous = __tmTaskLifecycleHeadingLocks.get(did) || Promise.resolve();
        const current = previous.catch(() => null).then(runner);
        __tmTaskLifecycleHeadingLocks.set(did, current);
        try {
            return await current;
        } finally {
            if (__tmTaskLifecycleHeadingLocks.get(did) === current) __tmTaskLifecycleHeadingLocks.delete(did);
        }
    }

    async function __tmResolveCompletedHeadingPlacement(docId) {
        const did = String(docId || '').trim();
        if (!did) throw new Error('未找到任务所在文档');
        return await __tmWithTaskLifecycleHeadingLock(did, async () => {
            const kramdown = await API.getBlockKramdown(did);
            const headings = __tmParseHeadingBlocksFromKramdown(kramdown);
            let heading = (Array.isArray(headings) ? headings : []).find((item) => (
                String(item?.id || '').trim()
                && __tmNormalizeHeadingText(item?.content || '') === __TM_COMPLETED_HEADING_TEXT
            )) || null;
            let level = Number(heading?.level);
            if (!heading) {
                const configuredLevel = String(SettingsStore?.data?.taskHeadingLevel || 'h2').trim().toLowerCase();
                level = Number((configuredLevel.match(/^h([1-6])$/) || [])[1]) || 2;
                const headingId = String(await __tmAppendBlockOnce(did, `${'#'.repeat(level)} ${__TM_COMPLETED_HEADING_TEXT}`) || '').trim();
                if (!headingId) throw new Error('创建“已完成”标题失败');
                const flushed = await __tmBackendAdapter.flushTransaction();
                if (!flushed || Number(flushed.code) !== 0) {
                    throw new Error(flushed?.msg || '等待“已完成”标题写入失败');
                }
                heading = { id: headingId, content: __TM_COMPLETED_HEADING_TEXT, level };
            }
            let resolved = null;
            try { resolved = await __tmResolveHeadingGroupInsertPlacement(did, heading.id, `h${level}`); } catch (e) { resolved = null; }
            const resolvedHeading = resolved?.heading && typeof resolved.heading === 'object' ? resolved.heading : heading;
            return {
                placement: {
                    parentID: String(resolved?.parentID || did).trim() || did,
                    previousID: String(heading.id || '').trim(),
                },
                heading: {
                    id: String(heading.id || '').trim(),
                    content: __tmNormalizeHeadingText(resolvedHeading?.content || heading.content || __TM_COMPLETED_HEADING_TEXT),
                    rank: Number(resolvedHeading?.rank),
                },
                level,
            };
        });
    }

    async function __tmResolveTaskLifecycleParentPlacement(parentTaskId, originDocId) {
        const parentId = String(parentTaskId || '').trim();
        const did = String(originDocId || '').trim();
        if (!parentId || !did) return null;
        let parentTask = null;
        try { parentTask = await API.getTaskById(parentId); } catch (e) { parentTask = null; }
        if (!parentTask || String(parentTask.root_id || parentTask.docId || '').trim() !== did) return null;
        try { normalizeTaskFields(parentTask, String(parentTask.doc_name || parentTask.docName || '').trim()); } catch (e) {}
        try {
            const meta = await __tmResolveTaskMovePlacementMeta(parentId);
            const placement = { parentID: String(meta.targetChildListId || parentId).trim() || parentId };
            if (meta.lastDirectChildId) placement.previousID = String(meta.lastDirectChildId || '').trim();
            else if (!meta.targetChildListId && meta.targetContentAnchorId) placement.previousID = String(meta.targetContentAnchorId || '').trim();
            return {
                placement,
                parentTaskId: parentId,
                heading: String(meta.targetHeadingId || '').trim() ? {
                    id: String(meta.targetHeadingId || '').trim(),
                    content: __tmNormalizeHeadingText(meta.targetHeading || ''),
                    rank: Number(meta.targetHeadingRank),
                } : null,
            };
        } catch (e) {
            return null;
        }
    }

    async function __tmClearDeletedTaskReminders(taskIds, options = {}) {
        const ids = Array.from(new Set((Array.isArray(taskIds) ? taskIds : [taskIds])
            .map((id) => String(id || '').trim())
            .filter(Boolean)));
        if (!ids.length) return true;
        const opts = (options && typeof options === 'object') ? options : {};
        const reminderApi = globalThis.__tomatoReminder;
        if (typeof reminderApi?.get === 'function' && typeof reminderApi?.remove === 'function') {
            for (const taskId of ids) {
                const current = await reminderApi.get(taskId);
                if (current?.ok === false) throw new Error(String(current?.message || '读取任务提醒失败'));
                if (current?.hasReminder !== true && !current?.reminder) continue;
                const removed = await reminderApi.remove(taskId, {
                    source: String(opts.source || 'task-delete').trim() || 'task-delete',
                });
                if (removed?.ok !== true) throw new Error(String(removed?.message || '清除任务提醒失败'));
            }
            return true;
        }
        for (const taskId of ids) {
            await __tmExecuteTaskCommandGateway({
                action: 'patch',
                taskID: taskId,
                patch: { reminder: null },
                recordUndo: false,
                laneID: taskId,
            }, '清除任务提醒');
        }
        return true;
    }

    async function __tmCleanupDeletedTaskRelations(taskIds, options = {}) {
        const ids = Array.from(new Set((Array.isArray(taskIds) ? taskIds : [taskIds])
            .map((id) => String(id || '').trim())
            .filter(Boolean)));
        if (!ids.length) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        try {
            await __tmClearDeletedTaskReminders(ids, opts);
        } catch (e) {
            try { console.warn('[task-horizon] delete linked reminders after task delete failed', e); } catch (e2) {}
        }
        try {
            const calendarApi = globalThis.__tmCalendar;
            if (calendarApi && typeof calendarApi.deleteTaskSchedulesByTaskIds === 'function') {
                const request = calendarApi.deleteTaskSchedulesByTaskIds(ids, {
                    source: String(opts.source || 'task-delete').trim() || 'task-delete',
                    reason: String(opts.reason || 'task-delete-schedules').trim() || 'task-delete-schedules',
                    side: true,
                    flushTaskPanel: false,
                });
                if (opts.background === true) {
                    Promise.resolve(request).catch((e) => {
                        try { console.warn('[task-horizon] delete linked schedules after task delete failed', e); } catch (e2) {}
                    });
                } else await request;
            }
        } catch (e) {
            try { console.warn('[task-horizon] delete linked schedules after task delete failed', e); } catch (e2) {}
        }
        if (SettingsStore?.data?.deleteTaskRemovesWhiteboardCards !== false) {
            try {
                __tmDeleteWhiteboardSnapshotTasks(ids);
            } catch (e) {
                try { console.warn('[task-horizon] delete linked whiteboard cards after task delete failed', e); } catch (e2) {}
            }
        }
        return true;
    }

    async function __tmArchiveDeletedTask(data) {
        const payload = (data && typeof data === 'object') ? data : {};
        const tid = String(payload.taskId || '').trim();
        const { task } = await __tmResolveTaskLifecycleTask(tid);
        if (!task) throw new Error('任务已不存在');
        const meta = await __tmReadTaskLifecycleMeta(tid);
        const cleanupIds = Array.isArray(payload.scheduleCleanupTaskIds)
            ? payload.scheduleCleanupTaskIds
            : __tmCollectTaskTreeIdsForScheduleCleanup(task, tid);
        if (meta.recycle) {
            await __tmCleanupDeletedTaskRelations(cleanupIds, {
                source: String(payload.source || 'task-recycle').trim() || 'task-recycle',
                reason: 'task-recycle-schedules',
                background: false,
            });
            return { skipped: true, reason: 'already-recycled', taskId: tid };
        }
        const originDocId = String(payload.originDocId || payload.docId || task.root_id || task.docId || '').trim();
        const targetDocId = String(payload.targetDocId || SettingsStore?.data?.taskRecycleDocId || '').trim();
        if (!targetDocId) throw new Error('请先设置回收站文档');
        if (!originDocId) throw new Error('未找到任务所在文档');
        if (targetDocId === originDocId) throw new Error('回收站文档不能是任务当前文档');
        const moveResult = await __tmMoveTaskToPlacement(tid, targetDocId, { parentID: targetDocId }, {
            moveToRecycleDocument: true,
        });
        const nextMeta = {
            ...meta,
            recycle: {
                originDocId,
                originParentTaskId: String(payload.originParentTaskId || task.parentTaskId || task.parent_task_id || '').trim(),
                archivedAt: new Date().toISOString(),
                archiveDocId: targetDocId,
                archiveListId: String(moveResult?.listID || moveResult?.placement?.parentListId || '').trim(),
            },
        };
        await __tmWriteTaskLifecycleMeta(tid, nextMeta);
        await __tmCleanupDeletedTaskRelations(cleanupIds, {
            source: String(payload.source || 'task-recycle').trim() || 'task-recycle',
            reason: 'task-recycle-schedules',
            background: false,
        });
        payload.docId = originDocId;
        payload.targetDocId = targetDocId;
        return {
            ok: true,
            action: 'archiveDeleted',
            taskId: tid,
            originDocId,
            targetDocId,
            changeSet: moveResult?.changeSet,
        };
    }

    async function __tmArchiveCompletedTaskOnce(data) {
        const payload = (data && typeof data === 'object') ? data : {};
        const tid = String(payload.taskId || '').trim();
        const resolvedTask = await __tmResolveTaskLifecycleTask(tid);
        const task = resolvedTask.task;
        // setDone can enqueue this before SiYuan's SQL index exposes the new
        // marker. Only its explicit commit receipt may override that lag.
        const done = payload.committedDone === true
            ? true
            : __tmIsTaskLifecycleDone(task, resolvedTask.localTask);
        if (!__tmCanArchiveCompletedTask(task, done)) return { skipped: true, reason: 'ineligible', taskId: tid };
        const meta = await __tmReadTaskLifecycleMeta(tid);
        if (meta.recycle) return { skipped: true, reason: 'recycled', taskId: tid };
        if (meta.completed) return { skipped: true, reason: 'already-archived', taskId: tid };
        const mode = __tmNormalizeTaskCompletionArchiveMode(payload.mode || SettingsStore?.data?.taskCompletionArchiveMode);
        if (mode === 'none') return { skipped: true, reason: 'disabled', taskId: tid };
        const originDocId = String(payload.originDocId || task.root_id || task.docId || '').trim();
        if (!originDocId) throw new Error('未找到任务所在文档');
        let targetDocId = originDocId;
        let destination;
        if (mode === 'document') {
            targetDocId = String(payload.targetDocId || SettingsStore?.data?.taskCompletionArchiveDocId || '').trim();
            if (!targetDocId) throw new Error('请先设置完成归档文档');
            if (targetDocId === originDocId) return { skipped: true, reason: 'same-document', taskId: tid };
            destination = await __tmResolveTaskLifecycleDefaultPlacement(targetDocId);
        } else {
            destination = await __tmResolveCompletedHeadingPlacement(originDocId);
        }
        const moveResult = await __tmMoveTaskToPlacement(tid, targetDocId, destination.placement, {
            heading: destination.heading,
        });
        await __tmWriteTaskLifecycleMeta(tid, {
            ...meta,
            completed: {
                originDocId,
                mode,
                archivedAt: new Date().toISOString(),
                archiveDocId: targetDocId,
                archiveListId: String(moveResult?.listID || moveResult?.placement?.parentListId || '').trim(),
            },
        });
        payload.docId = originDocId;
        payload.targetDocId = targetDocId;
        return { ok: true, action: 'archiveCompleted', taskId: tid, originDocId, targetDocId, mode };
    }

    async function __tmArchiveCompletedTask(data) {
        const payload = (data && typeof data === 'object') ? data : {};
        const tid = String(payload.taskId || '').trim();
        if (!tid) return await __tmArchiveCompletedTaskOnce(payload);
        const existing = __tmTaskCompletionArchiveRequests.get(tid);
        if (existing?.promise) return await existing.promise;

        const entry = { promise: null, timer: null };
        entry.promise = __tmArchiveCompletedTaskOnce(payload);
        __tmTaskCompletionArchiveRequests.set(tid, entry);
        try {
            const result = await entry.promise;
            const timer = setTimeout(() => {
                if (__tmTaskCompletionArchiveRequests.get(tid) === entry) {
                    __tmTaskCompletionArchiveRequests.delete(tid);
                }
            }, __TM_TASK_COMPLETION_ARCHIVE_DEDUPE_MS);
            try { timer?.unref?.(); } catch (e) {}
            entry.timer = timer;
            return result;
        } catch (error) {
            if (__tmTaskCompletionArchiveRequests.get(tid) === entry) {
                __tmTaskCompletionArchiveRequests.delete(tid);
            }
            throw error;
        }
    }

    async function __tmRestoreCompletedTask(data) {
        const payload = (data && typeof data === 'object') ? data : {};
        const tid = String(payload.taskId || '').trim();
        const archivedRequest = __tmTaskCompletionArchiveRequests.get(tid);
        if (archivedRequest) {
            try { clearTimeout(archivedRequest.timer); } catch (e) {}
            __tmTaskCompletionArchiveRequests.delete(tid);
        }
        const resolvedTask = await __tmResolveTaskLifecycleTask(tid);
        if (!resolvedTask.task) throw new Error('任务已不存在');
        const meta = await __tmReadTaskLifecycleMeta(tid);
        if (!meta.completed) return { skipped: true, reason: 'not-archived', taskId: tid };
        if (meta.recycle) return { skipped: true, reason: 'recycled', taskId: tid };
        if (__tmIsTaskLifecycleDone(resolvedTask.task, resolvedTask.localTask)) {
            return { skipped: true, reason: 'still-completed', taskId: tid };
        }
        const targetDocId = String(meta.completed.originDocId || '').trim();
        if (!targetDocId) throw new Error('未找到原文档');
        const destination = await __tmResolveTaskLifecycleDefaultPlacement(targetDocId);
        await __tmMoveTaskToPlacement(tid, targetDocId, destination.placement, {
            heading: destination.heading,
            moveIndependentList: !destination.heading,
            sourceListId: String(meta.completed.archiveListId || '').trim(),
            sourceDocumentId: String(
                meta.completed.archiveDocId
                || resolvedTask.task.root_id
                || resolvedTask.task.docId
                || (meta.completed.mode === 'heading' ? targetDocId : '')
            ).trim(),
        });
        const nextMeta = { ...meta };
        delete nextMeta.completed;
        await __tmWriteTaskLifecycleMeta(tid, nextMeta);
        payload.targetDocId = targetDocId;
        return { ok: true, action: 'restoreCompleted', taskId: tid, targetDocId };
    }

    async function __tmRestoreDeletedTask(data) {
        const payload = (data && typeof data === 'object') ? data : {};
        const tid = String(payload.taskId || '').trim();
        const resolvedTask = await __tmResolveTaskLifecycleTask(tid);
        if (!resolvedTask.task) throw new Error('任务已不存在');
        const meta = await __tmReadTaskLifecycleMeta(tid);
        if (!meta.recycle) return { skipped: true, reason: 'not-recycled', taskId: tid };
        const restoreCompletion = !!meta.completed && !__tmIsTaskLifecycleDone(resolvedTask.task, resolvedTask.localTask);
        const targetDocId = String(restoreCompletion ? meta.completed.originDocId : meta.recycle.originDocId).trim();
        if (!targetDocId) throw new Error('未找到原文档');
        const parentDestination = restoreCompletion
            ? null
            : await __tmResolveTaskLifecycleParentPlacement(meta.recycle.originParentTaskId, targetDocId);
        const destination = parentDestination || await __tmResolveTaskLifecycleDefaultPlacement(targetDocId);
        await __tmMoveTaskToPlacement(tid, targetDocId, destination.placement, {
            parentTaskId: String(destination.parentTaskId || '').trim(),
            heading: destination.heading,
            moveIndependentList: !destination.parentTaskId && !destination.heading,
            sourceListId: String(meta.recycle.archiveListId || '').trim(),
            sourceDocumentId: String(
                meta.recycle.archiveDocId
                || resolvedTask.task.root_id
                || resolvedTask.task.docId
            ).trim(),
        });
        const nextMeta = { ...meta };
        delete nextMeta.recycle;
        if (restoreCompletion) delete nextMeta.completed;
        await __tmWriteTaskLifecycleMeta(tid, nextMeta);
        payload.targetDocId = targetDocId;
        return { ok: true, action: 'restoreDeleted', taskId: tid, targetDocId };
    }

    async function __tmExecuteTaskLifecycle(data) {
        const payload = (data && typeof data === 'object') ? data : {};
        const action = String(payload.action || '').trim();
        if (action === 'archiveDeleted') return await __tmArchiveDeletedTask(payload);
        if (action === 'archiveCompleted') return await __tmArchiveCompletedTask(payload);
        if (action === 'restoreDeleted') return await __tmRestoreDeletedTask(payload);
        if (action === 'restoreCompleted') return await __tmRestoreCompletedTask(payload);
        throw new Error(`未支持的任务归档动作: ${action || 'unknown'}`);
    }

    async function __tmPrepareTaskLifecycleMutationData(data) {
        const payload = (data && typeof data === 'object') ? data : {};
        const action = String(payload.action || '').trim();
        const taskId = String(payload.taskId || '').trim();
        if (!taskId || !action) throw new Error('任务归档参数无效');
        const prepared = (payload.lifecycleVerification && typeof payload.lifecycleVerification === 'object')
            ? payload.lifecycleVerification
            : null;
        if ((action === 'archiveDeleted' || action === 'archiveCompleted')
            && String(prepared?.action || '').trim() === action
            && String(prepared?.targetDocId || '').trim()) {
            return payload;
        }
        const resolved = await __tmResolveTaskLifecycleTask(taskId);
        const task = resolved.task;
        const meta = await __tmReadTaskLifecycleMeta(taskId);
        const verification = {
            action,
            targetDocId: '',
            originDocId: '',
            originParentTaskId: '',
            mode: '',
            clearCompleted: false,
        };
        if (action === 'archiveDeleted') {
            if (!Array.isArray(payload.scheduleCleanupTaskIds)) {
                payload.scheduleCleanupTaskIds = __tmCollectTaskTreeIdsForScheduleCleanup(task, taskId);
            }
            verification.originDocId = String(payload.originDocId || payload.docId || task?.root_id || task?.docId || '').trim();
            verification.originParentTaskId = String(payload.originParentTaskId || task?.parentTaskId || task?.parent_task_id || '').trim();
            verification.targetDocId = String(payload.targetDocId || SettingsStore?.data?.taskRecycleDocId || '').trim();
        } else if (action === 'archiveCompleted') {
            verification.originDocId = String(payload.originDocId || task?.root_id || task?.docId || '').trim();
            verification.mode = __tmNormalizeTaskCompletionArchiveMode(payload.mode || SettingsStore?.data?.taskCompletionArchiveMode);
            verification.targetDocId = verification.mode === 'document'
                ? String(payload.targetDocId || SettingsStore?.data?.taskCompletionArchiveDocId || '').trim()
                : verification.originDocId;
        } else if (action === 'restoreCompleted') {
            verification.targetDocId = String(meta.completed?.originDocId || '').trim();
        } else if (action === 'restoreDeleted') {
            const restoreCompletion = !!meta.completed && !__tmIsTaskLifecycleDone(task, resolved.localTask);
            verification.targetDocId = String(
                restoreCompletion ? meta.completed?.originDocId : meta.recycle?.originDocId
            ).trim();
            verification.clearCompleted = restoreCompletion;
        } else {
            throw new Error(`未支持的任务归档动作: ${action}`);
        }
        payload.lifecycleVerification = verification;
        if (action === 'archiveDeleted') {
            payload.originDocId = verification.originDocId;
            payload.originParentTaskId = verification.originParentTaskId;
            payload.targetDocId = verification.targetDocId;
        } else if (action === 'archiveCompleted') {
            payload.originDocId = verification.originDocId;
            payload.mode = verification.mode;
            payload.targetDocId = verification.targetDocId;
        }
        return payload;
    }

    function __tmEnqueueTaskLifecycle(action, taskId, data = {}, options = {}) {
        const tid = String(taskId || '').trim();
        if (!tid) return Promise.reject(new Error('未找到任务'));
        const payload = (data && typeof data === 'object') ? data : {};
        const opts = (options && typeof options === 'object') ? options : {};
        const lifecycleAction = String(action || '').trim();
        if (lifecycleAction === 'archiveDeleted' && !(payload.snapshot && typeof payload.snapshot === 'object')) {
            try { payload.snapshot = __tmCaptureTaskLocalSnapshot(tid); } catch (e) {}
        }
        const enqueue = globalThis.__tmRequireTaskMutation?.('enqueue');
        if (typeof enqueue !== 'function') return Promise.reject(new Error('任务归档队列未就绪'));
        let pendingPromise = null;
        const request = enqueue({
            type: 'taskLifecycle',
            docId: String(payload.originDocId || payload.docId || '').trim(),
            laneKey: `task:${tid}`,
            data: {
                ...payload,
                taskId: tid,
                action: lifecycleAction,
                suppressHint: true,
            },
        }, {
            wait: opts.wait === true,
            onPending: (promise, op) => {
                pendingPromise = promise;
                try { opts.onPending?.(promise, op); } catch (e) {}
            },
        });
        const settlement = pendingPromise || request;
        if (opts.wait !== true) {
            Promise.resolve(settlement).catch((error) => {
                try {
                    globalThis.__tmReportTaskMutationFailure?.(error, {
                        action: String(opts.errorAction || '自动归档').trim() || '自动归档',
                        source: String(payload.source || '').trim(),
                        taskId: tid,
                    });
                } catch (e) {}
            });
        }
        return opts.wait === true ? request : Promise.resolve(tid);
    }

    function __tmNotifyTaskLifecycleCompletion(taskId, done, options = {}) {
        const tid = String(taskId || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        if (!tid || opts.previousDone === !!done) return false;
        const task = (opts.task && typeof opts.task === 'object') ? opts.task : __tmGetTaskLifecycleLocalTask(tid);
        if (done === true) {
            const mode = __tmNormalizeTaskCompletionArchiveMode(SettingsStore?.data?.taskCompletionArchiveMode);
            if (mode === 'none') return false;
            if (task && !__tmCanArchiveCompletedTask(task, true)) return false;
            const targetDocId = mode === 'document' ? String(SettingsStore?.data?.taskCompletionArchiveDocId || '').trim() : '';
            if (mode === 'document' && !targetDocId) {
                try { hint('⚠ 请先设置完成归档文档', 'warning'); } catch (e) {}
                return false;
            }
            void __tmEnqueueTaskLifecycle('archiveCompleted', tid, {
                mode,
                committedDone: true,
                originDocId: String(task?.root_id || task?.docId || '').trim(),
                targetDocId,
                source: String(opts.source || 'task-completion').trim() || 'task-completion',
            }, { wait: false, errorAction: '完成归档' });
            return true;
        }
        void __tmEnqueueTaskLifecycle('restoreCompleted', tid, {
            source: String(opts.source || 'task-uncomplete').trim() || 'task-uncomplete',
        }, { wait: false, errorAction: '恢复完成任务' });
        return true;
    }

    try {
        globalThis.__tmTaskLifecycle = Object.freeze({
            execute: __tmExecuteTaskLifecycle,
            prepareMutation: __tmPrepareTaskLifecycleMutationData,
            readMeta: __tmReadTaskLifecycleMeta,
            notifyCompletion: __tmNotifyTaskLifecycleCompletion,
            archiveDeleted(taskId, options = {}) {
                const opts = (options && typeof options === 'object') ? options : {};
                const task = opts.task || __tmGetTaskLifecycleLocalTask(taskId);
                return __tmEnqueueTaskLifecycle('archiveDeleted', taskId, {
                    snapshot: opts.snapshot,
                    originDocId: String(opts.originDocId || opts.snapshot?.docId || task?.root_id || task?.docId || '').trim(),
                    originParentTaskId: String(opts.originParentTaskId || opts.snapshot?.parentTaskId || task?.parentTaskId || task?.parent_task_id || '').trim(),
                    targetDocId: String(opts.targetDocId || SettingsStore?.data?.taskRecycleDocId || '').trim(),
                    scheduleCleanupTaskIds: Array.isArray(opts.scheduleCleanupTaskIds) ? opts.scheduleCleanupTaskIds : undefined,
                    backgroundScheduleCleanup: opts.backgroundScheduleCleanup === true,
                    source: String(opts.source || 'task-recycle').trim() || 'task-recycle',
                }, { wait: opts.wait === true, errorAction: '移入回收站' });
            },
            restoreDeleted(taskId, options = {}) {
                const opts = (options && typeof options === 'object') ? options : {};
                const request = __tmEnqueueTaskLifecycle('restoreDeleted', taskId, {
                    snapshot: opts.snapshot,
                    scheduleCleanupTaskIds: Array.isArray(opts.scheduleCleanupTaskIds) ? opts.scheduleCleanupTaskIds : undefined,
                    source: String(opts.source || 'task-recycle-undo').trim() || 'task-recycle-undo',
                }, { wait: opts.wait === true, errorAction: '恢复回收站任务' });
                if (opts.wait !== true) return request;
                return Promise.resolve(request).then((result) => {
                    if (result?.ok === true) return result;
                    const reason = String(result?.reason || '').trim();
                    throw new Error(reason ? `任务未恢复: ${reason}` : '任务未恢复');
                });
            },
            restoreCompleted(taskId, options = {}) {
                const opts = (options && typeof options === 'object') ? options : {};
                return __tmEnqueueTaskLifecycle('restoreCompleted', taskId, {
                    source: String(opts.source || 'task-completion-restore').trim() || 'task-completion-restore',
                }, { wait: opts.wait === true, errorAction: '恢复完成任务' });
            },
        });
    } catch (e) {}
