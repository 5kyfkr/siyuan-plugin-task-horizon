    const __tmAiClone = (value) => {
        try { return JSON.parse(JSON.stringify(value)); } catch (e) { return value; }
    };

    function __tmIsAiFeatureEnabled() {
        try {
            return !!SettingsStore?.data?.aiEnabled;
        } catch (e) {
            return false;
        }
    }

    async function __tmAiGetTaskSnapshot(taskId, options = {}) {
        const rawId = String(taskId || '').trim();
        if (!rawId) return null;
        const forceFresh = options === true || options?.forceFresh === true;
        if (/^repeatinst:/.test(rawId)) {
            const recurringInstance = globalThis.__tmRuntimeState?.getFlatTaskById?.(rawId)
                || state.flatTasks?.[rawId]
                || state.pendingInsertedTasks?.[rawId]
                || (Array.isArray(state.filteredTasks) ? state.filteredTasks.find((item) => String(item?.id || '').trim() === rawId) : null);
            if (recurringInstance) return __tmAiClone(recurringInstance);
        }
        let tid = rawId;
        try {
            const resolved = await __tmResolveTaskIdFromAnyBlockId(rawId);
            if (resolved) tid = resolved;
        } catch (e) {}
        let task = (!forceFresh && (globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid] || state.pendingInsertedTasks?.[tid]))
            ? { ...(globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid] || state.pendingInsertedTasks?.[tid]) }
            : null;
        if (!task && !forceFresh) {
            try {
                const filtered = Array.isArray(state.filteredTasks) ? state.filteredTasks : [];
                const found = filtered.find((it) => String(it?.id || '').trim() === tid);
                if (found) task = { ...found };
            } catch (e) {}
        }
        if (!task && !forceFresh) {
            try {
                const flatList = Object.values(state.flatTasks || {});
                const found = flatList.find((it) => {
                    const id = String(it?.id || '').trim();
                    const rootId = String(it?.root_id || it?.docId || '').trim();
                    const parentId = String(it?.parent_id || it?.parentTaskId || '').trim();
                    return tid && (id === tid || rootId === tid || parentId === tid);
                });
                if (found) task = { ...found };
            } catch (e) {}
        }
        if (!task) {
            try {
                const pending = state.pendingInsertedTasks?.[tid]
                    || state.pendingInsertedTasks?.[rawId]
                    || globalThis.__tmRuntimeState?.getTaskById?.(tid, { includePending: true, preferPending: true })
                    || globalThis.__tmRuntimeState?.getTaskById?.(rawId, { includePending: true, preferPending: true })
                    || null;
                if (pending) task = { ...pending };
            } catch (e) {}
        }
        if (!task) {
            try { task = await API.getTaskById(tid); } catch (e) { task = null; }
        }
        if (!task && rawId && rawId !== tid) {
            try { task = await API.getTaskById(rawId); } catch (e) { task = null; }
        }
        if (!task) {
            try { task = await __tmBuildTaskLikeFromBlockId(tid); } catch (e) { task = null; }
        }
        if (!task && rawId && rawId !== tid) {
            try { task = await __tmBuildTaskLikeFromBlockId(rawId); } catch (e) { task = null; }
        }
        if (!task) return null;
        try {
            const parsed = API.parseTaskStatus(task.markdown);
            task.done = !!parsed?.done;
            task.content = String(parsed?.content || task.content || task.raw_content || '').trim();
        } catch (e) {}
        try { normalizeTaskFields(task, String(task.doc_name || task.docName || '').trim()); } catch (e) {}
        const h2TaskId = String(task?.id || tid).trim() || tid;
        try {
            const h2Map = await API.fetchH2Contexts([h2TaskId]);
            const h2 = h2Map.get(h2TaskId);
            if (h2) {
                task.h2 = String(h2.content || '').trim();
                task.h2Id = String(h2.id || '').trim();
            }
        } catch (e) {}
        return __tmAiClone(task);
    }

    async function __tmGetTaskStatusDisplayByAnyId(taskIdOrBlockId) {
        const rawId = String(taskIdOrBlockId || '').trim();
        if (!rawId) return null;
        const snapshot = await __tmAiGetTaskSnapshot(rawId, { forceFresh: true });
        if (!snapshot || typeof snapshot !== 'object') return null;
        const status = __tmResolveTaskStatusDisplayOption(snapshot);
        return {
            taskId: String(snapshot.id || rawId).trim() || rawId,
            value: __tmResolveTaskStatusId(snapshot),
            marker: __tmResolveTaskMarker(snapshot),
            name: String(status?.name || '').trim(),
            color: String(status?.color || '').trim(),
        };
    }

    function __tmAiNormalizeDateKey(value) {
        const s = String(value || '').trim();
        if (!s) return '';
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return `${m[1]}-${m[2]}-${m[3]}`;
        const dt = new Date(s.replace('T', ' '));
        if (Number.isNaN(dt.getTime())) return '';
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    }

    function __tmAiVerifyPatchApplied(task, patch) {
        if (!task || !patch || typeof patch !== 'object') return false;
        const keys = Object.keys(patch);
        if (!keys.length) return false;
        return keys.every((key) => {
            if (key === 'done' || key === 'pinned' || key === 'milestone') return !!task[key] === !!patch[key];
            if (key === 'startDate' || key === 'completionTime') return __tmAiNormalizeDateKey(task[key]) === __tmAiNormalizeDateKey(patch[key]);
            return String(task[key] ?? '').trim() === String(patch[key] ?? '').trim();
        });
    }

    async function __tmAiResolveDocumentId(docId) {
        const rawId = String(docId || '').trim();
        if (!rawId) return '';
        try {
            const sql = `SELECT id, type, root_id FROM blocks WHERE id = '${rawId}' LIMIT 1`;
            const res = await API.call('/api/query/sql', { stmt: sql });
            const row = (res && res.code === 0 && Array.isArray(res.data)) ? res.data[0] : null;
            if (!row) return rawId;
            if (String(row.type || '').trim() === 'd') return String(row.id || rawId).trim() || rawId;
            return String(row.root_id || rawId).trim() || rawId;
        } catch (e) {
            return rawId;
        }
    }

    function __tmAiRequireOutbox(methodName) {
        const outbox = globalThis.__tmTaskOutbox || globalThis.__tmTaskHorizonOutbox || null;
        const method = outbox && typeof outbox[methodName] === 'function' ? outbox[methodName] : null;
        if (!method) throw new Error(`任务写入队列未就绪: ${methodName}`);
        return { outbox, method };
    }

    async function __tmAiGetDocumentSnapshot(docId, options = {}) {
        const did = await __tmAiResolveDocumentId(docId);
        if (!did) return null;
        let tasks = [];
        try {
            const limit = Number.isFinite(Number(options.limit))
                ? Math.max(50, Math.min(__TM_TASK_INDEX_QUERY_LIMIT, Math.round(Number(options.limit))))
                : __TM_TASK_INDEX_QUERY_LIMIT;
            const res = await API.getTasksByDocument(did, limit, { doneOnly: false });
            tasks = Array.isArray(res?.tasks) ? res.tasks.map((task) => {
                const next = { ...task };
                try {
                    const parsed = API.parseTaskStatus(next.markdown);
                    next.done = !!parsed?.done;
                    next.content = String(parsed?.content || next.content || next.raw_content || '').trim();
                } catch (e) {}
                try { normalizeTaskFields(next, String(next.doc_name || next.docName || '').trim()); } catch (e) {}
                return next;
            }) : [];
        } catch (e) {
            tasks = [];
        }
        if (!tasks.length) {
            try {
                tasks = Object.values(state.flatTasks || {}).filter((task) => {
                    const rootId = String(task?.root_id || task?.docId || '').trim();
                    return rootId && rootId === did;
                }).map((task) => ({ ...task }));
            } catch (e) {
                tasks = tasks || [];
            }
        }
        try {
            const h2Map = await API.fetchH2Contexts(tasks.map((task) => String(task?.id || '').trim()).filter(Boolean));
            tasks.forEach((task) => {
                const h2 = h2Map.get(String(task?.id || '').trim());
                if (h2) {
                    task.h2 = String(h2.content || '').trim();
                    task.h2Id = String(h2.id || '').trim();
                }
            });
        } catch (e) {}
        let kramdown = '';
        try { kramdown = await API.getBlockKramdown(did); } catch (e) { kramdown = ''; }
        const doc = state.allDocuments?.find((item) => String(item?.id || '').trim() === did)
            || state.taskTree?.find((item) => String(item?.id || '').trim() === did)
            || null;
        return __tmAiClone({
            id: did,
            name: String(doc?.name || tasks?.[0]?.doc_name || tasks?.[0]?.docName || '未命名文档').trim() || '未命名文档',
            path: String(tasks?.[0]?.doc_path || '').trim(),
            kramdown,
            tasks,
        });
    }

    async function __tmAiApplyTaskPatch(taskId, patch = {}) {
        const requestedId = String(taskId || '').trim();
        if (!requestedId) throw new Error('缺少任务 ID');
        const sourceTask = await __tmAiGetTaskSnapshot(requestedId, { forceFresh: true });
        if (!sourceTask) throw new Error('未找到任务');
        const tid = String(sourceTask.id || requestedId).trim() || requestedId;
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        const attrPatch = {};
        ['priority', 'customStatus', 'startDate', 'completionTime', 'duration', 'remark', 'pinned', 'milestone'].forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(nextPatch, key)) attrPatch[key] = nextPatch[key];
        });

        let nextMarkdown = String(sourceTask.markdown || '').trim();
        if (!nextMarkdown) nextMarkdown = `- [${sourceTask.done ? 'x' : ' '}] ${String(sourceTask.content || '').trim()}`;
        const hasTitle = Object.prototype.hasOwnProperty.call(nextPatch, 'title');
        const hasDone = Object.prototype.hasOwnProperty.call(nextPatch, 'done');
        const needsAttrs = Object.keys(attrPatch).length > 0;
        const contentWriter = hasTitle ? __tmAiRequireOutbox('patchContent') : null;
        const taskWriter = (hasDone || needsAttrs) ? __tmAiRequireOutbox('patchTask') : null;
        if (hasTitle || hasDone) {
            const nextTitle = hasTitle ? String(nextPatch.title || '').trim() : String(sourceTask.content || '').trim();
            const nextDone = hasDone ? !!nextPatch.done : !!sourceTask.done;
            const lines = String(nextMarkdown || '').split(/\r?\n/);
            const firstLine = String(lines[0] || '');
            const replaced = firstLine.replace(/^(\s*[\*\-]\s*)\[[ xX]\](\s*)/, `$1[${nextDone ? 'x' : ' '}]$2`);
            if (replaced !== firstLine) {
                lines[0] = replaced.replace(/^(\s*[\*\-]\s*\[[ xX]\]\s*).*/, `$1${nextTitle}`);
            } else {
                lines[0] = `- [${nextDone ? 'x' : ' '}] ${nextTitle}`;
            }
            nextMarkdown = lines.join('\n');
            const retentionSource = { ...sourceTask };
            const deleteMetaReadKeys = (field) => {
                try {
                    if (typeof __tmGetTaskMetaAttrReadKeys !== 'function') return;
                    __tmGetTaskMetaAttrReadKeys(field).forEach((key) => {
                        const attrKey = String(key || '').trim();
                        if (attrKey) delete retentionSource[attrKey];
                    });
                } catch (e) {}
            };
            if (Object.prototype.hasOwnProperty.call(attrPatch, 'startDate')) {
                delete retentionSource.startDate;
                delete retentionSource.start_date;
                delete retentionSource.custom_start_date;
                delete retentionSource['custom-start-date'];
                deleteMetaReadKeys('startDate');
            }
            if (Object.prototype.hasOwnProperty.call(attrPatch, 'completionTime')) {
                delete retentionSource.completionTime;
                delete retentionSource.completion_time;
                delete retentionSource.custom_completion_time;
                delete retentionSource['custom-completion-time'];
                deleteMetaReadKeys('completionTime');
            }
            if (Object.prototype.hasOwnProperty.call(attrPatch, 'customStatus')) {
                delete retentionSource.customStatus;
                delete retentionSource.custom_status;
                delete retentionSource['custom-status'];
                deleteMetaReadKeys('customStatus');
            }
            const excludeKeys = [];
            if (Object.prototype.hasOwnProperty.call(attrPatch, 'startDate')) excludeKeys.push('startDate');
            if (Object.prototype.hasOwnProperty.call(attrPatch, 'completionTime')) excludeKeys.push('completionTime');
            if (Object.prototype.hasOwnProperty.call(attrPatch, 'customStatus')) excludeKeys.push('customStatus');
            const retentionPatch = typeof __tmProtectMarkdownMutationTaskFields === 'function'
                ? __tmProtectMarkdownMutationTaskFields(tid, retentionSource, { source: 'ai-task-patch-markdown', excludeKeys })
                : {};
            if (hasTitle) {
                await contentWriter.method.call(contentWriter.outbox, tid, nextTitle, {
                    source: 'ai-task-patch-title',
                    reason: 'ai-task-patch-title',
                    background: true,
                    skipInteractionGate: true,
                    renderOptimistic: true,
                    withFilters: true,
                });
            }
            if (hasDone) {
                await taskWriter.method.call(taskWriter.outbox, tid, { done: nextDone }, {
                    source: 'ai-task-patch-done',
                    reason: 'ai-task-patch-done',
                    label: 'AI 修改完成状态',
                    background: true,
                    wait: false,
                    skipInteractionGate: true,
                    skipSettledRefresh: true,
                    withFilters: true,
                    showErrorHint: false,
                });
            }
            try {
                globalThis.__tmTaskSnapshotService?.scheduleAfterLocalPatch?.(tid, {
                    ...((retentionPatch && typeof retentionPatch === 'object') ? retentionPatch : {}),
                    markdown: nextMarkdown,
                    content: nextTitle,
                    done: nextDone,
                }, { source: 'ai-task-patch-markdown' });
            } catch (e) {}
        }

        if (needsAttrs) {
            await taskWriter.method.call(taskWriter.outbox, tid, attrPatch, {
                source: 'ai-task-patch-attrs',
                reason: 'ai-task-patch-attrs',
                label: 'AI 修改任务字段',
                background: true,
                wait: false,
                skipInteractionGate: true,
                skipSettledRefresh: true,
                withFilters: true,
                showErrorHint: false,
            });
        }

        try { __tmInvalidateTasksQueryCacheByDocId(String(sourceTask.docId || sourceTask.root_id || '').trim()); } catch (e) {}
        try {
            __tmScheduleViewRefresh({
                mode: 'current',
                withFilters: true,
                reason: 'ai-task-patch',
                taskIds: [tid],
            });
        } catch (e) {
            try { __tmScheduleRender({ withFilters: true, reason: 'ai-task-patch' }); } catch (e2) {}
        }
        const localTask = globalThis.__tmRuntimeState?.getTaskById?.(tid, { includePending: true, preferPending: true })
            || state.pendingInsertedTasks?.[tid]
            || state.flatTasks?.[tid]
            || sourceTask;
        const resultTask = {
            ...sourceTask,
            ...(localTask && typeof localTask === 'object' ? localTask : {}),
            ...attrPatch,
        };
        if (hasTitle) resultTask.content = String(nextPatch.title || '').trim();
        if (hasDone) resultTask.done = !!nextPatch.done;
        return __tmAiClone(resultTask);
    }

    async function __tmAiCreateTaskSuggestion(docId, content) {
        const did = String(docId || '').trim();
        const text = String(content || '').trim();
        if (!did) throw new Error('缺少文档');
        if (!text) throw new Error('任务建议为空');
        const createTask = __tmAiRequireOutbox('createTaskInDoc');
        const taskId = await createTask.method.call(createTask.outbox, {
            docId: did,
            content: text,
            atTop: true,
            pinned: false,
            localInsert: false,
            wait: false,
            skipOptimisticMainRefresh: true,
            skipOptimisticFilterWork: true,
        }, { wait: false });
        try {
            __tmScheduleViewRefresh({
                mode: 'current',
                withFilters: false,
                reason: 'ai-create-task-suggestion',
                taskIds: [taskId].filter(Boolean),
            });
        } catch (e) {
            try { __tmScheduleRender({ withFilters: false, reason: 'ai-create-task-suggestion' }); } catch (e2) {}
        }
        return await __tmAiGetTaskSnapshot(taskId);
    }

    async function __tmAiCreateTask(payload = {}) {
        const raw = (payload && typeof payload === 'object') ? payload : {};
        const patch0 = (raw.patch && typeof raw.patch === 'object')
            ? raw.patch
            : ((raw.fields && typeof raw.fields === 'object') ? raw.fields : {});
        const patch = {};
        ['title', 'done', 'priority', 'customStatus', 'startDate', 'completionTime', 'duration', 'remark', 'pinned', 'milestone'].forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(patch0, key)) patch[key] = patch0[key];
        });
        const parentTaskIdRaw = String(raw.parentTaskId || raw.parentId || raw.parent_task_id || '').trim();
        const docIdRaw = String(raw.docId || raw.documentId || raw.root_id || '').trim();
        const initialContent = String(raw.content || raw.title || raw.text || patch.title || '').trim();
        if (!initialContent) throw new Error('任务内容为空');

        let createdTaskId = '';
        if (parentTaskIdRaw) {
            const parentTask = await __tmAiGetTaskSnapshot(parentTaskIdRaw);
            if (!parentTask) throw new Error('未找到父任务');
            const pid = String(parentTask.id || parentTaskIdRaw).trim() || parentTaskIdRaw;
            const createSubtask = __tmAiRequireOutbox('createSubtask');
            createdTaskId = await createSubtask.method.call(createSubtask.outbox, pid, initialContent, {
                silent: true,
                wait: false,
                skipInteractionGate: true,
                skipOptimisticMainRefresh: true,
                skipOptimisticFilterWork: true,
                refreshCurrentView: false,
                skipSnapshotViewStateFilterRefresh: true,
            });
        } else {
            const did = await __tmAiResolveDocumentId(docIdRaw);
            if (!did) throw new Error('缺少文档');
            const createTask = __tmAiRequireOutbox('createTaskInDoc');
            createdTaskId = await createTask.method.call(createTask.outbox, {
                docId: did,
                content: initialContent,
                atTop: true,
                pinned: false,
                localInsert: false,
                wait: false,
                skipOptimisticMainRefresh: true,
                skipOptimisticFilterWork: true,
            }, { wait: false });
        }

        let nextTask = null;
        if (Object.keys(patch).length > 0) {
            nextTask = await __tmAiApplyTaskPatch(createdTaskId, patch);
        }
        if (!nextTask) {
            try { nextTask = await __tmAiGetTaskSnapshot(createdTaskId); } catch (e) { nextTask = null; }
        }
        try {
            __tmScheduleViewRefresh({
                mode: 'current',
                withFilters: false,
                reason: 'ai-create-task',
                taskIds: [createdTaskId].filter(Boolean),
            });
        } catch (e) {
            try { __tmScheduleRender({ withFilters: false, reason: 'ai-create-task' }); } catch (e2) {}
        }
        return nextTask || await __tmAiGetTaskSnapshot(createdTaskId);
    }

    function __tmAiTaskDocId(task) {
        const direct = String(task?.docId || task?.root_id || '').trim();
        if (direct) return direct;
        const taskId = String(task?.id || '').trim();
        const stored = taskId ? (state.flatTasks?.[taskId] || state.pendingInsertedTasks?.[taskId]) : null;
        return String(stored?.docId || stored?.root_id || '').trim();
    }

    function __tmAiTaskBlockId(task) {
        const id = String(task?.id || '').trim();
        if (!/^[0-9]{14}-[A-Za-z0-9]+$/.test(id)) return '';
        try {
            if (typeof __tmIsRecurringInstanceTask === 'function' && __tmIsRecurringInstanceTask(task)) return '';
        } catch (e) {}
        return task?.isRecurringInstance === true || task?.isRecurringInstanceReadOnly === true ? '' : id;
    }

    function __tmAiTaskReadValues(task) {
        const id = __tmAiTaskBlockId(task);
        if (!id) return null;
        let priorityScore = Number(task?.priorityScore);
        try {
            if (typeof __tmEnsureTaskPriorityScore === 'function') {
                priorityScore = Number(__tmEnsureTaskPriorityScore(task, { force: true }));
            }
        } catch (e) {}
        const documentID = __tmAiTaskDocId(task);
        return Number.isFinite(priorityScore) ? { id, documentID, priorityScore: Math.round(priorityScore) } : { id, documentID };
    }

    function __tmAiVirtualTaskDTO(task) {
        const id = String(task?.id || '').trim();
        const match = id.match(/^repeatinst:([0-9]{14}-[A-Za-z0-9]+):([^:]+)$/);
        if (!match) return null;
        let isRecurringInstance = task?.isRecurringInstance === true;
        try {
            if (typeof __tmIsRecurringInstanceTask === 'function') isRecurringInstance = __tmIsRecurringInstanceTask(task);
        } catch (e) {}
        if (!isRecurringInstance) return null;
        const sourceTaskID = String(
            task?.sourceTaskId
            || task?.recurringSourceTaskId
            || (typeof __tmResolveRecurringInstanceSourceTaskId === 'function' ? __tmResolveRecurringInstanceSourceTaskId(id, task) : '')
            || match[1]
        ).trim();
        if (sourceTaskID !== match[1]) return null;
        let priorityScore = Number(task?.priorityScore);
        try {
            if (typeof __tmEnsureTaskPriorityScore === 'function') {
                priorityScore = Number(__tmEnsureTaskPriorityScore(task, { force: true }));
            }
        } catch (e) {}
        const numberOrNull = (value) => Number.isFinite(Number(value)) && String(value ?? '').trim() !== '' ? Number(value) : null;
        const looseBoolean = (value) => value === true || value === 1 || ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
        const structured = (value, fallback) => {
            if (value == null || value === '') return fallback;
            if (typeof value === 'string') {
                try { return JSON.parse(value); } catch (e) { return value; }
            }
            return __tmAiClone(value);
        };
        const attachments = Array.isArray(task?.attachments) ? __tmAiClone(task.attachments) : [];
        const reminder = structured(task?.reminder ?? task?.tomatoReminder ?? task?.tomato_reminder, null);
        const customFieldValues = task?.customFieldValues && typeof task.customFieldValues === 'object' && !Array.isArray(task.customFieldValues)
            ? __tmAiClone(task.customFieldValues)
            : {};
        return {
            id,
            virtualTask: true,
            virtualType: 'recurring-history',
            readOnly: true,
            sourceTaskID,
            title: String(task?.content || task?.raw_content || task?.title || '').trim() || '(无内容)',
            markdown: String(task?.markdown || ''),
            done: true,
            documentID: __tmAiTaskDocId(task),
            documentName: String(task?.docName || task?.doc_name || task?.rawDocName || '').trim(),
            documentPath: String(task?.docPath || task?.doc_path || task?.blockPath || task?.block_path || '').trim(),
            created: String(task?.created || task?.recurringCompletedAt || '').trim(),
            updated: String(task?.updated || task?.recurringCompletedAt || '').trim(),
            priority: String(task?.priority || task?.custom_priority || '').trim(),
            priorityScore: Number.isFinite(priorityScore) ? Math.round(priorityScore) : null,
            customStatus: String(task?.customStatus || task?.custom_status || '').trim(),
            startDate: String(task?.recurringSourceStart || task?.startDate || task?.start_date || '').trim(),
            completionTime: String(task?.recurringSourceDue || task?.completionTime || task?.completion_time || '').trim(),
            taskCompleteAt: String(task?.taskCompleteAt || task?.task_complete_at || task?.recurringCompletedAt || '').trim(),
            duration: String(task?.duration || task?.custom_duration || '').trim(),
            remark: String(task?.remark || task?.custom_remark || '').trim(),
            taskDateColor: String(task?.taskDateColor || task?.task_date_color || task?.custom_task_date_color || '').trim(),
            customTime: String(task?.customTime || task?.custom_time || '').trim(),
            milestone: looseBoolean(task?.milestone ?? task?.custom_milestone),
            pinned: looseBoolean(task?.pinned ?? task?.custom_pinned),
            allDayBottom: looseBoolean(task?.allDayBottom ?? task?.custom_all_day_bottom),
            tomatoEstimateCount: numberOrNull(task?.tomatoEstimateCount ?? task?.tomato_estimate_count ?? task?.tomatoEstimate),
            tomatoCount: numberOrNull(task?.tomatoCount ?? task?.tomato_count),
            tomatoMinutes: numberOrNull(task?.tomatoMinutes ?? task?.tomato_minutes),
            tomatoHours: numberOrNull(task?.tomatoHours ?? task?.tomato_hours),
            attachments,
            attachmentCount: Math.max(0, Number(task?.attachmentCount) || attachments.length),
            reminder,
            hasReminder: reminder != null,
            repeatRule: structured(task?.repeatRule ?? task?.repeat_rule, null),
            repeatState: structured(task?.repeatState ?? task?.repeat_state, null),
            customFieldValues,
        };
    }

    function __tmAiFindLocalTask(taskId) {
        const id = String(taskId || '').trim();
        if (!id) return null;
        const direct = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id] || state.pendingInsertedTasks?.[id];
        if (direct) return direct;
        return (Array.isArray(state.filteredTasks) ? state.filteredTasks : []).find((item) => String(item?.id || '').trim() === id) || null;
    }

    async function __tmAiGetTaskReadScope(taskIds) {
        const ids = Array.from(new Set((Array.isArray(taskIds) ? taskIds : []).map((id) => String(id || '').trim()).filter(Boolean)));
        const taskIDs = ids.filter((id) => /^[0-9]{14}-[A-Za-z0-9]+$/.test(id));
        const virtualTasks = ids
            .filter((id) => /^repeatinst:/.test(id))
            .map((id) => __tmAiVirtualTaskDTO(__tmAiFindLocalTask(id)))
            .filter(Boolean);
        return {
            taskIDs,
            taskValues: await __tmAiGetTaskReadValues(taskIDs),
            virtualTasks,
            taskCount: taskIDs.length + virtualTasks.length,
        };
    }

    async function __tmAiGetDocumentTaskReadScope(docIds) {
        const documentIDs = Array.from(new Set((Array.isArray(docIds) ? docIds : [])
            .map((id) => String(id || '').trim())
            .filter((id) => /^[0-9]{14}-[A-Za-z0-9]+$/.test(id))));
        if (!documentIDs.length) return { documentIDs: [], taskIDs: [], taskValues: [], virtualTasks: [], taskCount: 0 };
        const tasks = await __tmAiGetSummaryTasksByDocIds(documentIDs, { ignoreExcludeCompleted: true });
        const taskMap = new Map();
        const virtualTaskMap = new Map();
        (Array.isArray(tasks) ? tasks : []).forEach((task) => {
            const virtualDTO = __tmAiVirtualTaskDTO(task);
            if (virtualDTO) {
                virtualTaskMap.set(virtualDTO.id, virtualDTO);
                return;
            }
            const taskID = __tmAiTaskBlockId(task);
            if (taskID && !taskMap.has(taskID)) taskMap.set(taskID, task);
            let historyItems = [];
            try {
                const rawHistory = task?.repeatHistory ?? task?.repeat_history ?? [];
                historyItems = Array.isArray(rawHistory)
                    ? rawHistory
                    : (typeof __tmNormalizeTaskRepeatHistory === 'function' ? __tmNormalizeTaskRepeatHistory(rawHistory) : []);
            } catch (e) { historyItems = []; }
            historyItems.forEach((historyItem, index) => {
                try {
                    const virtualTask = typeof __tmBuildRecurringInstanceTask === 'function'
                        ? __tmBuildRecurringInstanceTask(task, historyItem, index)
                        : null;
                    const dto = __tmAiVirtualTaskDTO(virtualTask);
                    if (dto) virtualTaskMap.set(dto.id, dto);
                } catch (e) {}
            });
        });
        const realTasks = Array.from(taskMap.values());
        const taskIDs = Array.from(taskMap.keys());
        const virtualTasks = Array.from(virtualTaskMap.values());
        return {
            scopeID: `documents:${documentIDs.slice().sort().join(',')}`,
            documentIDs,
            taskIDs,
            taskValues: realTasks.map((task) => __tmAiTaskReadValues(task)).filter(Boolean),
            virtualTasks,
            taskCount: taskIDs.length + virtualTasks.length,
        };
    }

    async function __tmAiGetTaskReadValues(taskIds) {
        const ids = Array.from(new Set((Array.isArray(taskIds) ? taskIds : []).map((id) => String(id || '').trim()).filter((id) => /^[0-9]{14}-[A-Za-z0-9]+$/.test(id))));
        const out = [];
        for (const id of ids) {
            let task = state.flatTasks?.[id] || state.pendingInsertedTasks?.[id] || null;
            if (!task) {
                try { task = await __tmAiGetTaskSnapshot(id, { forceFresh: false }); } catch (e) { task = null; }
            }
            const values = __tmAiTaskReadValues(task || { id });
            if (values) out.push(values);
        }
        return out;
    }

    async function __tmAiGetCurrentViewDocIdSet() {
        const groupDocIds = await __tmAiGetCurrentGroupDocIds();
        const groupDocIdSet = new Set(groupDocIds);
        const activeDocId = String(state.activeDocId || 'all').trim() || 'all';
        if (activeDocId === 'all' || __tmIsOtherBlockTabId(activeDocId)) return groupDocIdSet;
        const customGroupDocIds = __tmGetActiveDocTabCustomGroupDocIdSet(activeDocId, {
            currentGroupId: SettingsStore?.data?.currentGroupId || 'all',
            docs: state.taskTree || [],
        });
        if (customGroupDocIds instanceof Set && customGroupDocIds.size > 0) {
            return new Set(Array.from(customGroupDocIds).filter((docId) => groupDocIdSet.has(String(docId || '').trim())));
        }
        return groupDocIdSet.has(activeDocId) ? new Set([activeDocId]) : new Set();
    }

    async function __tmAiGetCurrentViewTasks(limit = 5) {
        const hasLimit = Number.isFinite(Number(limit)) && Number(limit) > 0;
        const max = hasLimit ? Math.max(1, Math.min(5000, Number(limit) || 5)) : Infinity;
        const allowedDocIds = await __tmAiGetCurrentViewDocIdSet();
        if (!allowedDocIds.size) return [];
        const filtered = Array.isArray(state.filteredTasks) ? state.filteredTasks : [];
        const list = filtered
            .filter((task) => allowedDocIds.has(__tmAiTaskDocId(task)))
            .slice(0, hasLimit ? max : filtered.length)
            .map((task) => __tmAiClone(task))
            .filter(Boolean);
        return hasLimit ? list.slice(0, max) : list;
    }

    async function __tmAiGetCurrentFilteredTasks(limit = 0) {
        return await __tmAiGetCurrentViewTasks(limit);
    }

    async function __tmAiGetCurrentGroupTasks(limit = 0, options = {}) {
        const hasLimit = Number.isFinite(Number(limit)) && Number(limit) > 0;
        const max = hasLimit ? Math.max(1, Math.min(2000, Number(limit) || 20)) : Infinity;
        const includeDone = !!(options && typeof options === 'object' && options.includeDone);
        const docIds = await __tmAiGetCurrentGroupDocIds();
        const docIdSet = new Set(docIds);
        if (!docIdSet.size) return [];
        const out = [];
        const seenTaskIds = new Set();
        const walk = (tasks) => {
            (Array.isArray(tasks) ? tasks : []).forEach((task) => {
                if (out.length >= max || !task || typeof task !== 'object') return;
                const taskId = String(task.id || '').trim();
                const docId = __tmAiTaskDocId(task);
                if (taskId && (includeDone || !task.done) && docIdSet.has(docId) && !seenTaskIds.has(taskId)) {
                    seenTaskIds.add(taskId);
                    out.push(__tmAiClone(task));
                }
                if (out.length < max) walk(task.children || []);
            });
        };
        try {
            (Array.isArray(state.taskTree) ? state.taskTree : []).forEach((doc) => {
                if (out.length >= max) return;
                walk(doc?.tasks || []);
            });
        } catch (e) {}
        return (hasLimit ? out.slice(0, max) : out).filter(Boolean);
    }

    async function __tmAiGetCurrentGroupDocIds() {
        const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        try {
            const docIds = await resolveDocIdsFromGroups({ groupId: currentGroupId, includeQuickAddDoc: true });
            return Array.from(new Set((Array.isArray(docIds) ? docIds : []).map((id) => String(id || '').trim()).filter(Boolean)));
        } catch (e) {
            return [];
        }
    }

    async function __tmAiGetDocumentGroupSnapshot() {
        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        const resolvedGroups = [];
        for (const group of groups) {
            const groupID = String(group?.id || '').trim();
            if (!groupID) continue;
            let documentIDs = [];
            try {
                documentIDs = await resolveDocIdsFromGroups({ groupId: groupID, includeQuickAddDoc: false });
            } catch (e) {}
            let name = String(group?.name || groupID).trim() || groupID;
            try { name = __tmResolveDocGroupName(group) || name; } catch (e) {}
            resolvedGroups.push({
                id: groupID,
                name,
                documentIDs: Array.from(new Set((Array.isArray(documentIDs) ? documentIDs : [])
                    .map((id) => String(id || '').trim())
                    .filter(Boolean))),
            });
        }
        const resolvedTabGroups = (typeof __tmGetDocTabCustomGroups === 'function' ? __tmGetDocTabCustomGroups() : [])
            .map((group) => {
                const groupID = String(group?.id || '').trim();
                if (!groupID || typeof __tmExpandDocTabCustomGroup !== 'function') return null;
                const members = __tmExpandDocTabCustomGroup(group, Array.isArray(state?.allDocuments) ? state.allDocuments : []);
                return {
                    id: groupID,
                    name: String(group?.name || groupID).trim() || groupID,
                    documentIDs: Array.from(members.keys()),
                };
            })
            .filter(Boolean);
        return { groups: resolvedGroups, tabGroups: resolvedTabGroups };
    }

    async function __tmAiGetCurrentViewContext() {
        const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        const currentGroup = currentGroupId === 'all'
            ? null
            : groups.find((group) => String(group?.id || '').trim() === currentGroupId) || null;
        let groupLabel = currentGroupId === 'all' ? '全部分组' : String(currentGroup?.name || currentGroup?.label || currentGroup?.title || currentGroupId).trim();
        try { groupLabel = currentGroupId === 'all' ? '全部分组' : (__tmResolveDocGroupName(currentGroup) || groupLabel); } catch (e) {}
        const activeDocId = String(state.activeDocId || 'all').trim() || 'all';
        let activeDocLabel = activeDocId === 'all' ? '全部页签' : activeDocId;
        try {
            if (__tmIsOtherBlockTabId(activeDocId)) activeDocLabel = '其他块';
            else if (__tmParseDocTabCustomGroupActiveId(activeDocId)) activeDocLabel = '自定义页签组';
            else if (activeDocId !== 'all') activeDocLabel = __tmGetDocDisplayName(activeDocId, activeDocId) || activeDocId;
        } catch (e) {}
        const view = String(state.viewMode || globalThis.__tmRuntimeState?.getViewMode?.('') || '').trim();
        const viewMeta = __TM_ALL_VIEWS.find((item) => item.id === view);
        const viewLabel = String(viewMeta?.label || view).trim();
        const ruleId = String(state.currentRule || '').trim();
        const searchKeyword = String(state.searchKeyword || '').trim();
        const filter = {
            ruleId,
            searchKeyword,
            archiveMode: state.docTabsArchiveMode === true,
            showCompleted: state.showCompletedTasks === true,
        };
        const documentIDs = Array.from(await __tmAiGetCurrentViewDocIdSet());
        const allTasks = await __tmAiGetCurrentViewTasks(0);
        const visibleTaskIDs = Array.from(new Set(allTasks.map((task) => __tmAiTaskBlockId(task)).filter(Boolean)));
        const taskValues = allTasks.map((task) => __tmAiTaskReadValues(task)).filter(Boolean);
        const virtualTasks = allTasks.map((task) => __tmAiVirtualTaskDTO(task)).filter(Boolean);
        const focusedTaskValue = String(state.detailTaskId || state.draggingTaskId || '').trim();
        const focusedTaskID = /^[0-9]{14}-[A-Za-z0-9]+$/.test(focusedTaskValue) ? focusedTaskValue : '';
        let selectedTaskIDs = [];
        let selectedVirtualTasks = [];
        try {
            const selectedIDs = __tmGetMultiSelectedTaskIds().map((id) => String(id || '').trim()).filter(Boolean);
            selectedTaskIDs = selectedIDs.filter((id) => /^[0-9]{14}-[A-Za-z0-9]+$/.test(id));
            const selectedIDSet = new Set(selectedIDs);
            selectedVirtualTasks = virtualTasks.filter((item) => selectedIDSet.has(item.id));
        } catch (e) {}
        const scopeID = [currentGroupId, activeDocId, view, ruleId, searchKeyword, filter.archiveMode ? 1 : 0, filter.showCompleted ? 1 : 0].join('|');
        return {
            scopeID,
            groupID: currentGroupId,
            groupLabel,
            activeDocID: activeDocId,
            activeDocLabel,
            view,
            viewLabel,
            filter,
            documentIDs,
            focusedTaskID,
            selectedTaskIDs,
            selectedVirtualTasks,
            visibleTaskCount: visibleTaskIDs.length + virtualTasks.length,
            realTaskCount: visibleTaskIDs.length,
            virtualTaskCount: virtualTasks.length,
            visibleTaskIDs,
            taskValues,
            virtualTasks,
            truncated: false,
        };
    }

    async function __tmQuickbarResolveConfiguredDocIds(forceRefresh = false) {
        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        const legacyIds = Array.isArray(SettingsStore.data.selectedDocIds) ? SettingsStore.data.selectedDocIds : [];
        const quickAddDocId = String(SettingsStore.data.newTaskDocId || '').trim();
        const targetDocs = [];
        legacyIds.forEach((id) => {
            const did = String(id || '').trim();
            if (did) targetDocs.push({ id: did, kind: 'doc', recursive: false });
        });
        groups.forEach((group) => {
            targetDocs.push(...__tmGetGroupSourceEntries(group));
        });
        const normalizedDocs = targetDocs
            .map((entry) => {
                const id = String((typeof entry === 'object' ? entry?.id : entry) || '').trim();
                if (!id) return null;
                return {
                    id,
                    kind: String((typeof entry === 'object' ? entry?.kind : '') || 'doc').trim() || 'doc',
                    recursive: !!(typeof entry === 'object' ? entry?.recursive : false)
                };
            })
            .filter(Boolean);
        const cacheKey = [
            quickAddDocId && quickAddDocId !== '__dailyNote__' ? `quickAdd:${quickAddDocId}` : '',
            ...normalizedDocs.map((entry) => `${entry.kind}:${entry.id}:${entry.recursive ? 1 : 0}`)
        ].filter(Boolean).join('|');
        const now = Date.now();
        const cacheEnt = __tmQuickbarResolveConfiguredDocIds.__cache;
        if (!forceRefresh
            && cacheEnt
            && cacheEnt.key === cacheKey
            && Array.isArray(cacheEnt.ids)
            && (now - Number(cacheEnt.t || 0)) < 30000) {
            return cacheEnt.ids.slice();
        }
        const inflight = __tmQuickbarResolveConfiguredDocIds.__inflight;
        if (!forceRefresh && inflight && inflight.key === cacheKey && inflight.promise) {
            const ids = await inflight.promise;
            return Array.isArray(ids) ? ids.slice() : [];
        }
        const seen = new Set();
        const finalIds = [];
        const pushDocId = (id0) => {
            const id = String(id0 || '').trim();
            if (!id || seen.has(id)) return;
            seen.add(id);
            finalIds.push(id);
        };
        const resolvePromise = Promise.resolve().then(async () => {
            if (quickAddDocId && quickAddDocId !== '__dailyNote__') pushDocId(quickAddDocId);
            await Promise.all(normalizedDocs.map((entry) => __tmExpandSourceEntryDocIds(entry, pushDocId)));
            const out = finalIds.slice();
            __tmQuickbarResolveConfiguredDocIds.__cache = { key: cacheKey, ids: out, t: Date.now() };
            return out;
        });
        __tmQuickbarResolveConfiguredDocIds.__inflight = { key: cacheKey, promise: resolvePromise };
        try {
            const ids = await resolvePromise;
            return Array.isArray(ids) ? ids.slice() : [];
        } finally {
            if (__tmQuickbarResolveConfiguredDocIds.__inflight?.key === cacheKey) {
                __tmQuickbarResolveConfiguredDocIds.__inflight = null;
            }
        }
    }

    async function __tmAiGetSummaryTasksByDocIds(docIds, options = {}) {
        return await __tmSummaryLoadTasksByDocs(docIds, { ignoreExcludeCompleted: options?.ignoreExcludeCompleted === true });
    }

    function __tmAiNormalizeKernelTask(task) {
        if (!task || typeof task !== 'object' || Array.isArray(task)) return null;
        const next = { ...task };
        const title = String(next.title || '').trim();
        const docId = String(next.documentID || next.docId || next.root_id || '').trim();
        const docName = String(next.documentName || next.docName || next.doc_name || '').trim();
        if (title) {
            next.content = title;
            next.raw_content = title;
        }
        if (docId) {
            next.docId = docId;
            next.root_id = docId;
        }
        if (docName) {
            next.docName = docName;
            next.doc_name = docName;
        }
        if (next.parentListID && !next.parent_id) next.parent_id = next.parentListID;
        if (next.parentTaskID && !next.parentTaskId) next.parentTaskId = next.parentTaskID;
        if (next.attrHostID && !next.attrHostId) next.attrHostId = next.attrHostID;
        return next;
    }

    async function __tmAiRefreshTaskMutation(payload = {}) {
        const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
        const uniqueIDs = (values) => Array.from(new Set((Array.isArray(values) ? values : [])
            .map((value) => String(value || '').trim())
            .filter(Boolean)));
        const tasks = (Array.isArray(source.tasks) ? source.tasks : [])
            .map(__tmAiNormalizeKernelTask)
            .filter((task) => String(task?.id || '').trim());
        const deletedTaskIDs = new Set(uniqueIDs(source.deletedTaskIDs));
        const requiresDocumentReload = source.requiresDocumentReload === true;
        const taskIDs = new Set(uniqueIDs(source.taskIDs));
        const documentIDs = new Set(uniqueIDs(source.documentIDs));
        const taskDocIDs = new Map();
        const rememberCurrentDoc = (taskID) => {
            const id = String(taskID || '').trim();
            if (!id) return;
            const current = globalThis.__tmRuntimeState?.getTaskById?.(id, { includePending: true, preferPending: true })
                || state.flatTasks?.[id]
                || state.pendingInsertedTasks?.[id]
                || null;
            const docId = String(current?.root_id || current?.docId || '').trim();
            if (docId) {
                documentIDs.add(docId);
                taskDocIDs.set(id, docId);
            }
        };
        taskIDs.forEach(rememberCurrentDoc);
        deletedTaskIDs.forEach((taskID) => {
            taskIDs.add(taskID);
            rememberCurrentDoc(taskID);
        });
        tasks.forEach((task) => {
            const taskID = String(task.id || '').trim();
            const docId = String(task.root_id || task.docId || '').trim();
            taskIDs.add(taskID);
            if (docId) {
                documentIDs.add(docId);
                taskDocIDs.set(taskID, docId);
            }
            if (deletedTaskIDs.has(taskID)) return;
            try {
                __tmCacheTaskInState(task, {
                    docNameFallback: task.doc_name || task.docName || '未命名文档',
                });
            } catch (e) {}
        });
        deletedTaskIDs.forEach((taskID) => {
            try { globalThis.__tmTaskStore?.removeLocal?.(taskID, { source: 'ai-task-mutation' }); } catch (e) {}
            try { globalThis.__tmTaskStore?.removePending?.(taskID, { source: 'ai-task-mutation' }); } catch (e) {}
        });
        documentIDs.forEach((docId) => {
            try { __tmInvalidateTasksQueryCacheByDocId(docId); } catch (e) {}
        });
        try { window.__tmCalendarAllTasksCache = null; } catch (e) {}

        const docIdList = Array.from(documentIDs);
        const taskIdList = Array.from(taskIDs);
        const refreshResults = [];
        if (docIdList.length && typeof __tmRefreshAffectedDocsIncrementally === 'function') {
            for (let index = 0; index < docIdList.length; index += 12) {
                const chunk = docIdList.slice(index, index + 12);
                const chunkSet = new Set(chunk);
                const blockIds = taskIdList.filter((taskID) => chunkSet.has(taskDocIDs.get(taskID)));
                try {
                    refreshResults.push(await __tmRefreshAffectedDocsIncrementally({
                        docIds: chunk,
                        blockIds,
                        withFilters: true,
                        forcePositionRank: requiresDocumentReload,
                        allowCalendar: true,
                        invalidateCalendarCache: true,
                        deferIfDetailBusy: true,
                        reason: 'ai-task-mutation',
                    }) === true);
                } catch (e) {
                    refreshResults.push(false);
                }
            }
        }
        const incrementallyRefreshed = refreshResults.length > 0 && refreshResults.every(Boolean);
        try {
            __tmRefreshViewsAfterTaskMutation({
                taskIds: taskIdList,
                withFilters: true,
                calendarOnly: incrementallyRefreshed,
                reason: 'ai-task-mutation',
            });
        } catch (e) {}
        return {
            taskIDs: taskIdList,
            documentIDs: docIdList,
            deletedTaskIDs: Array.from(deletedTaskIDs),
            incrementallyRefreshed,
        };
    }

    async function __tmAiRefreshScheduleMutation(payload = {}) {
        const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
        const reason = String(source.reason || 'ai-schedule-mutation').trim() || 'ai-schedule-mutation';
        const calendar = globalThis.__tmCalendar;
        let cacheReloaded = false;
        if (calendar && typeof calendar.refreshSchedulesFromSharedFile === 'function') {
            const refreshed = await calendar.refreshSchedulesFromSharedFile({ reason, main: true, side: true });
            cacheReloaded = Array.isArray(refreshed?.list);
        } else {
            try { calendar?.requestRefresh?.({ reason, main: true, side: true, hard: true }); } catch (e) {}
        }
        try {
            window.dispatchEvent(new CustomEvent('tm:calendar-schedule-updated', {
                detail: { ts: Date.now(), reason, source: 'ai-schedule-mutation', op: 'refresh' },
            }));
        } catch (e) {}
        return { cacheReloaded };
    }

    __tmNs.aiBridge = {
        getSettings() {
            return __tmAiClone({
                aiEnabled: !!SettingsStore.data.aiEnabled,
                aiExperienceMode: String(SettingsStore.data.aiExperienceMode || '').trim() === 'legacy' ? 'legacy' : 'agent',
                aiExperienceModeInitialized: SettingsStore.data.aiExperienceModeInitialized === true,
                agentMcpEnabled: SettingsStore.data.agentMcpEnabled === true,
                agentMcpAllowed: typeof window.tmLicenseHasFeature === 'function' && window.tmLicenseHasFeature('pro'),
                aiProvider: (() => {
                    const v = String(SettingsStore.data.aiProvider || '').trim();
                    if (v === 'deepseek') return 'deepseek';
                    if (v === 'openai') return 'openai';
                    if (v === 'anthropic') return 'anthropic';
                    return 'minimax';
                })(),
                aiMiniMaxApiKey: String(SettingsStore.data.aiMiniMaxApiKey || ''),
                aiMiniMaxBaseUrl: String(SettingsStore.data.aiMiniMaxBaseUrl || 'https://api.minimaxi.com/anthropic').trim() || 'https://api.minimaxi.com/anthropic',
                aiMiniMaxModel: String(SettingsStore.data.aiMiniMaxModel || 'MiniMax-M2.7-highspeed').trim() || 'MiniMax-M2.7-highspeed',
                aiDeepSeekApiKey: String(SettingsStore.data.aiDeepSeekApiKey || ''),
                aiDeepSeekBaseUrl: String(SettingsStore.data.aiDeepSeekBaseUrl || 'https://api.deepseek.com').trim() || 'https://api.deepseek.com',
                aiDeepSeekModel: String(SettingsStore.data.aiDeepSeekModel || 'deepseek-v4-flash').trim() || 'deepseek-v4-flash',
                aiOpenAIApiKey: String(SettingsStore.data.aiOpenAIApiKey || ''),
                aiOpenAIBaseUrl: String(SettingsStore.data.aiOpenAIBaseUrl || 'https://api.openai.com/v1').trim() || 'https://api.openai.com/v1',
                aiOpenAIModel: String(SettingsStore.data.aiOpenAIModel || 'gpt-5.4-mini').trim() || 'gpt-5.4-mini',
                aiAnthropicApiKey: String(SettingsStore.data.aiAnthropicApiKey || ''),
                aiAnthropicBaseUrl: String(SettingsStore.data.aiAnthropicBaseUrl || 'https://api.anthropic.com').trim() || 'https://api.anthropic.com',
                aiAnthropicModel: String(SettingsStore.data.aiAnthropicModel || 'claude-sonnet-4-5').trim() || 'claude-sonnet-4-5',
                aiMiniMaxTemperature: Number(SettingsStore.data.aiMiniMaxTemperature),
                aiMiniMaxMaxTokens: Number(SettingsStore.data.aiMiniMaxMaxTokens),
                aiMiniMaxTimeoutMs: Number(SettingsStore.data.aiMiniMaxTimeoutMs),
                aiConversationFontSize: Number.isFinite(Number(SettingsStore.data.aiConversationFontSize))
                    ? Math.max(12, Math.min(22, Math.round(Number(SettingsStore.data.aiConversationFontSize))))
                    : 14,
                aiDefaultContextMode: String(SettingsStore.data.aiDefaultContextMode || 'nearby').trim() === 'fulltext' ? 'fulltext' : 'nearby',
                aiScheduleWindows: Array.isArray(SettingsStore.data.aiScheduleWindows) ? SettingsStore.data.aiScheduleWindows.map(v => String(v || '').trim()).filter(Boolean) : ['09:00-18:00'],
                customStatusOptions: Array.isArray(SettingsStore.data.customStatusOptions)
                    ? SettingsStore.data.customStatusOptions.map((it) => ({
                        id: String(it?.id || '').trim(),
                        name: String(it?.name || '').trim(),
                        color: String(it?.color || '').trim(),
                    }))
                    : [],
            });
        },
        listActiveScheduledConversationIDs() {
            return Array.from(new Set((Array.isArray(SettingsStore.data.scheduledEvents) ? SettingsStore.data.scheduledEvents : [])
                .filter((event) => event?.enabled !== false)
                .map((event) => String(event?.conversationId || '').trim())
                .filter(Boolean)));
        },
        async getTaskCreationDestinations() {
            const configured = String(SettingsStore.data.newTaskDocId || '').trim();
            let defaultTarget = null;
            if (configured === '__dailyNote__') {
                let notebook = __tmResolveConfiguredDailyNoteNotebookId();
                if (!notebook) {
                    const currentDocID = String(state.activeDocId && state.activeDocId !== 'all' ? state.activeDocId : '').trim();
                    const current = currentDocID && typeof API.getBlock === 'function' ? await API.getBlock(currentDocID).catch(() => null) : null;
                    notebook = String(current?.box || state.notebooks?.[0]?.id || state.notebooks?.[0]?.box || '').trim();
                }
                if (notebook) {
                    const id = String(await API.createDailyNote(notebook) || '').trim();
                    if (id) defaultTarget = { id, label: '今天日记', kind: 'default' };
                }
            } else {
                const id = String(__tmResolveConfiguredQuickAddDocId() || await __tmResolveDefaultDocIdAsync() || '').trim();
                if (id) {
                    const doc = (Array.isArray(state.allDocuments) ? state.allDocuments : []).find((item) => String(item?.id || '').trim() === id)
                        || (Array.isArray(state.taskTree) ? state.taskTree : []).find((item) => String(item?.id || '').trim() === id);
                    defaultTarget = { id, label: String(doc?.name || '默认新建文档').trim() || '默认新建文档', kind: 'default' };
                }
            }
            const groupID = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
            const pinnedIDs = typeof __tmGetDocPinnedIdsForGroup === 'function'
                ? __tmGetDocPinnedIdsForGroup(groupID)
                : (Array.isArray(SettingsStore.data.docPinnedByGroup?.[groupID]) ? SettingsStore.data.docPinnedByGroup[groupID] : []);
            const pinned = pinnedIDs.map((id) => {
                const targetID = String(id || '').trim();
                const doc = (Array.isArray(state.allDocuments) ? state.allDocuments : []).find((item) => String(item?.id || '').trim() === targetID)
                    || (Array.isArray(state.taskTree) ? state.taskTree : []).find((item) => String(item?.id || '').trim() === targetID);
                return targetID ? { id: targetID, label: String(doc?.name || '未命名文档').trim() || '未命名文档', kind: 'pinned' } : null;
            }).filter(Boolean);
            return { defaultTarget, pinned, groupID };
        },
        async saveAiSettings(patch = {}) {
            if (!patch || typeof patch !== 'object') return this.getSettings();
            Object.entries(patch).forEach(([key, value]) => {
                if (!(key in SettingsStore.data)) return;
                if (key === 'agentMcpEnabled' || key === 'agentMcpEnabledInitialized') return;
                if (key === 'aiExperienceMode') value = String(value || '').trim() === 'legacy' ? 'legacy' : 'agent';
                SettingsStore.data[key] = value;
            });
            await SettingsStore.save();
            return this.getSettings();
        },
        async setAgentMcpEnabled(enabled) {
            return await __tmSetAgentMcpEnabled(enabled === true, { notify: false, refreshSettings: false });
        },
        async resolveTaskId(taskId) {
            const rawId = String(taskId || '').trim();
            if (!rawId) return '';
            try {
                const resolved = await __tmResolveTaskIdFromAnyBlockId(rawId);
                return String(resolved || rawId).trim();
            } catch (e) {
                return rawId;
            }
        },
        async getTaskSnapshot(taskId, options) {
            return await __tmAiGetTaskSnapshot(taskId, options);
        },
        async getDocumentSnapshot(docId, options) {
            return await __tmAiGetDocumentSnapshot(docId, options);
        },
        async applyTaskPatch(taskId, patch) {
            return await __tmAiApplyTaskPatch(taskId, patch);
        },
        async createTaskSuggestion(docId, content) {
            return await __tmAiCreateTaskSuggestion(docId, content);
        },
        async createTask(payload) {
            return await __tmAiCreateTask(payload);
        },
        async refreshTaskMutation(payload) {
            return await __tmAiRefreshTaskMutation(payload);
        },
        async refreshScheduleMutation(payload) {
            return await __tmAiRefreshScheduleMutation(payload);
        },
        async getCurrentViewTasks(limit) {
            return await __tmAiGetCurrentViewTasks(limit);
        },
        async getCurrentViewContext() {
            return await __tmAiGetCurrentViewContext();
        },
        async getTaskReadValues(taskIds) {
            return await __tmAiGetTaskReadValues(taskIds);
        },
        async getTaskReadScope(taskIds) {
            return await __tmAiGetTaskReadScope(taskIds);
        },
        async getDocumentTaskReadScope(docIds) {
            return await __tmAiGetDocumentTaskReadScope(docIds);
        },
        async getCurrentFilteredTasks(limit) {
            return await __tmAiGetCurrentFilteredTasks(limit);
        },
        async getCurrentGroupTasks(limit) {
            return await __tmAiGetCurrentGroupTasks(limit);
        },
        async getCurrentGroupDocIds() {
            return await __tmAiGetCurrentGroupDocIds();
        },
        async getDocumentGroupSnapshot() {
            return await __tmAiGetDocumentGroupSnapshot();
        },
        async getSummaryTasksByDocIds(docIds, options) {
            return await __tmAiGetSummaryTasksByDocIds(docIds, options);
        },
        async getConfiguredDocIds(options = {}) {
            return await __tmQuickbarResolveConfiguredDocIds(options?.forceRefresh === true);
        },
        async isDocIdConfigured(docId, options = {}) {
            const id = String(docId || '').trim();
            if (!id) return false;
            const ids = await __tmQuickbarResolveConfiguredDocIds(options?.forceRefresh === true);
            return ids.includes(id);
        },
        hint,
        esc,
        API,
        getCurrentTaskId() {
            return String(state.detailTaskId || state.draggingTaskId || '').trim();
        },
        getCurrentDocId() {
            try {
                const activeDocId = String(state.activeDocId || '').trim();
                if (activeDocId && activeDocId !== 'all') return activeDocId;
                try {
                    const focusedDocID = String(
                        typeof __tmResolveDocTopbarSourceDocId === 'function'
                            ? __tmResolveDocTopbarSourceDocId()
                            : ''
                    ).trim();
                    if (focusedDocID) return focusedDocID;
                } catch (e) {}
                const candidates = [];
                try {
                    if (__tmLastRightClickedTitleProtyle && __tmLastRightClickedTitleProtyle.isConnected) {
                        candidates.push(__tmLastRightClickedTitleProtyle);
                    }
                } catch (e) {}
                try {
                    if (__tmLastFocusedProtyle && __tmLastFocusedProtyle.isConnected) {
                        candidates.push(__tmLastFocusedProtyle);
                    }
                } catch (e) {}
                try {
                    const p = typeof __tmFindActiveProtyle === 'function' ? __tmFindActiveProtyle() : null;
                    if (p) candidates.push(p);
                } catch (e) {}
                for (const p of candidates) {
                    const id = String(__tmGetDocIdFromProtyle?.(p) || '').trim();
                    if (id) return id;
                }
                return '';
            } catch (e) {
                return '';
            }
        },
        getCurrentGroupId() {
            return String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        },
        async openAiPanel(payload = {}) {
            return await window.tmOpenAiSidebar(payload);
        },
        async closeAiPanel() {
            return await window.tmCloseAiSidebar();
        }
    };
    __tmNs.applyTaskAttrUpdateWithUndo = __tmApplyTaskAttrUpdateWithUndo;
    __tmNs.applyTaskMetaPatchWithUndo = __tmApplyTaskMetaPatchWithUndo;
    __tmNs.applyTaskStatus = __tmApplyTaskStatus;

    function __tmIsQuickbarTaskDone(task) {
        if (!(task && typeof task === 'object')) return false;
        if (task.done === true) return true;
        const statusId = String(task.customStatus || task.custom_status || '').trim();
        if (statusId) {
            try {
                if (typeof __tmDoesStatusIdResolveToDone === 'function' && __tmDoesStatusIdResolveToDone(statusId, SettingsStore?.data?.customStatusOptions || [])) return true;
            } catch (e) {}
        }
        try {
            const marker = typeof __tmResolveTaskMarker === 'function' ? __tmResolveTaskMarker(task, SettingsStore?.data?.customStatusOptions || []) : '';
            return typeof __tmIsTaskMarkerDone === 'function' ? __tmIsTaskMarkerDone(marker) : false;
        } catch (e) {
            return false;
        }
    }

    function __tmBuildQuickbarTaskCustomProps(task) {
        if (!(task && typeof task === 'object')) return null;
        const normalizeDate = (value) => {
            try { return value ? __tmNormalizeDateOnly(value) : ''; } catch (e) { return String(value || '').trim(); }
        };
        const readMeta = (field) => {
            try {
                return typeof __tmReadTaskMetaAttrValue === 'function'
                    ? String(__tmReadTaskMetaAttrValue(task, field) || '').trim()
                    : '';
            } catch (e) {
                return '';
            }
        };
        const done = __tmIsQuickbarTaskDone(task);
        const props = {
            'custom-priority': String(task.priority || task.custom_priority || readMeta('priority') || 'none').trim() || 'none',
            'custom-status': String(task.customStatus || task.custom_status || readMeta('customStatus') || '').trim(),
            'custom-completion-time': normalizeDate(task.completionTime || task.completion_time || readMeta('completionTime') || ''),
            'custom-start-date': normalizeDate(task.startDate || task.start_date || readMeta('startDate') || ''),
            'custom-duration': String(task.duration || task.custom_duration || readMeta('duration') || '').trim(),
            'custom-tomato-estimate-count': __tmGetTaskTomatoEstimateCount(task),
            'custom-tomato-count': __tmGetTaskTomatoCount(task),
            'custom-focus-summary': __tmGetTaskTomatoSummaryText(task),
            'custom-focus-spent-display': __tmGetTaskSpentDisplay(task),
            'custom-remark': String(task.remark || task.custom_remark || readMeta('remark') || '').trim(),
            'custom-pinned': String(task.pinned || task.custom_pinned || readMeta('pinned') || '').trim(),
            'bookmark': String(task.bookmark || '').trim(),
            done,
            taskCompleteAt: done ? __tmResolveTaskCompletedAtRaw(task, { completedOnly: false }) : '',
        };
        try {
            const mirrorStorageKey = (field, stableKey, value) => {
                const storageKey = typeof __tmGetTaskMetaAttrKey === 'function' ? __tmGetTaskMetaAttrKey(field) : '';
                if (storageKey && storageKey !== stableKey) props[storageKey] = value;
            };
            mirrorStorageKey('priority', 'custom-priority', props['custom-priority']);
            mirrorStorageKey('customStatus', 'custom-status', props['custom-status']);
            mirrorStorageKey('completionTime', 'custom-completion-time', props['custom-completion-time']);
            mirrorStorageKey('startDate', 'custom-start-date', props['custom-start-date']);
            mirrorStorageKey('duration', 'custom-duration', props['custom-duration']);
            mirrorStorageKey('remark', 'custom-remark', props['custom-remark']);
            mirrorStorageKey('pinned', 'custom-pinned', props['custom-pinned']);
            mirrorStorageKey('taskCompleteAt', 'custom-task-complete-at', props.taskCompleteAt);
        } catch (e) {}
        try {
            __tmGetCustomFieldDefs().forEach((field) => {
                const fieldId = String(field?.id || '').trim();
                if (!fieldId || field?.enabled === false) return;
                const attrKey = __tmBuildCustomFieldAttrStorageKey(field?.attrKey || field?.id || field?.name || 'field', fieldId);
                if (!attrKey) return;
                const normalized = __tmNormalizeCustomFieldValue(field, __tmGetTaskCustomFieldValue(task, fieldId));
                props[attrKey] = __tmSerializeCustomFieldValue(field, normalized);
            });
        } catch (e) {}
        return props;
    }

    async function __tmGetQuickbarTaskCustomPropsByAnyId(taskIdOrBlockId, options = {}) {
        const requestedId = String(taskIdOrBlockId || '').trim();
        if (!requestedId) return null;
        const opts = (options && typeof options === 'object') ? options : {};
        let binding = null;
        try { binding = await __tmResolveTaskBindingFromAnyBlockId(requestedId); } catch (e) { binding = null; }
        const taskId = String(binding?.taskId || requestedId).trim();
        let task = null;
        if (opts.forceFresh === true) {
            try { task = await __tmAiGetTaskSnapshot(taskId || requestedId, { forceFresh: true }); } catch (e) { task = null; }
        }
        if (!task) task = (binding?.task && typeof binding.task === 'object') ? binding.task : null;
        if (!task && taskId) {
            try { task = globalThis.__tmRuntimeState?.getTaskById?.(taskId, { includePending: true }) || state.flatTasks?.[taskId] || state.pendingInsertedTasks?.[taskId] || null; } catch (e) {}
        }
        if (!task && taskId) {
            try { task = await __tmEnsureTaskInStateById(taskId); } catch (e) { task = null; }
        }
        if (!task && taskId) {
            try { task = await __tmBuildTaskLikeFromBlockId(taskId); } catch (e) { task = null; }
        }
        if (!task && requestedId && requestedId !== taskId) {
            try { task = await __tmBuildTaskLikeFromBlockId(requestedId); } catch (e) { task = null; }
        }
        if (task && typeof task === 'object') {
            try {
                task = __tmCacheTaskInState(task, {
                    docNameFallback: task.doc_name || task.docName || '未命名文档'
                }) || task;
            } catch (e) {}
        }
        const props = __tmBuildQuickbarTaskCustomProps(task);
        if (!props) return null;
        const result = {
            requestedId,
            taskId: String(task?.id || taskId || requestedId).trim(),
            attrHostId: String(binding?.attrHostId || __tmGetTaskAttrHostId(task) || taskId || requestedId).trim(),
            props,
        };
        if (opts.includeContext === true && task && typeof task === 'object') {
            let attrContext = null;
            try {
                if (typeof __tmResolveTaskAttrContext === 'function') {
                    attrContext = await __tmResolveTaskAttrContext(
                        result.taskId,
                        task?.parent_id || task?.parentId || '',
                        task
                    );
                }
            } catch (e) {
                attrContext = null;
            }
            result.sourceDocId = String(task?.root_id || task?.docId || task?.rootId || '').trim();
            result.attrContext = attrContext;
        }
        return result;
    }

    async function __tmGetQuickbarApplicableCustomFieldIdsForDoc(docId) {
        const did = String(docId || '').trim();
        if (!did) return [];
        await __tmRefreshCustomFieldScopeMembership();
        return __tmGetCustomFieldDefs()
            .filter((field) => __tmIsCustomFieldApplicableToDoc(field, did))
            .map((field) => String(field?.id || '').trim())
            .filter(Boolean);
    }

    function __tmParseQuickbarTaskCreatedTs(task, taskId) {
        const raw = String(task?.created || task?.created_at || task?.createdAt || '').trim();
        if (raw) {
            try {
                const ts = __tmParseCreatedTs(raw);
                if (ts) return ts;
            } catch (e) {}
        }
        const bid = String(taskId || task?.id || '').trim();
        if (!bid) return 0;
        const match = bid.match(/^(\d{14})/);
        if (!match) return 0;
        try {
            return __tmParseCreatedTs(match[1]);
        } catch (e) {
            return 0;
        }
    }

    async function __tmResolveQuickbarSubtaskInheritanceTask(taskId, options = {}) {
        const tid = String(taskId || '').trim();
        if (!tid) return null;
        const opts = (options && typeof options === 'object') ? options : {};
        const fallbackAttrHostId = String(opts.attrHostId || '').trim();
        const forceFresh = opts.forceFresh === true;
        let task = forceFresh ? null : (
            globalThis.__tmRuntimeState?.getTaskById?.(tid, { includePending: true, preferPending: true })
            || state.flatTasks?.[tid]
            || state.pendingInsertedTasks?.[tid]
            || null
        );
        if (!task && forceFresh) {
            try { task = await API.getTaskById(tid); } catch (e) { task = null; }
        }
        if (!task && !forceFresh) {
            try { task = await __tmEnsureTaskInStateById(tid); } catch (e) { task = null; }
        }
        if (!task) {
            try { task = await __tmBuildTaskLikeFromBlockId(tid); } catch (e) { task = null; }
        }
        if (!task || typeof task !== 'object') return null;
        if (fallbackAttrHostId) {
            try {
                task.attrHostId = fallbackAttrHostId;
                task.attr_host_id = fallbackAttrHostId;
            } catch (e) {}
        }
        try {
            task = __tmCacheTaskInState(task, {
                docNameFallback: task.doc_name || task.docName || '未命名文档'
            }) || task;
        } catch (e) {}
        return task && typeof task === 'object' ? task : null;
    }

    async function __tmQuickbarMaybeInheritSubtaskFields(detail = {}) {
        const next = (detail && typeof detail === 'object' && !Array.isArray(detail)) ? detail : {};
        const taskId = String(next.taskId || next.requestedTaskId || '').trim();
        const parentTaskId = String(next.parentTaskId || '').trim();
        const attrHostId = String(next.attrHostId || '').trim();
        if (!taskId || !parentTaskId || taskId === parentTaskId) {
            return {
                ok: false,
                changed: false,
                reason: 'invalid-binding',
                taskId,
                parentTaskId,
                attrHostId,
            };
        }
        try { await __tmEnsureSettingsLoaded(false); } catch (e) {}
        const selectedFields = __tmNormalizeSubtaskInheritedFields(SettingsStore?.data?.subtaskInheritedFields, []);
        if (!selectedFields.length) {
            return {
                ok: true,
                changed: false,
                reason: 'no-fields',
                taskId,
                parentTaskId,
                attrHostId,
            };
        }
        const customFieldIds = selectedFields
            .map((fieldKey) => __tmParseCustomFieldColumnKey(fieldKey))
            .filter(Boolean);
        const maxAgeMs = Math.max(120000, Number(next.maxAgeMs) || 10 * 60 * 1000);
        const idCreatedTs = __tmParseQuickbarTaskCreatedTs(null, taskId);
        if (idCreatedTs && (Date.now() - idCreatedTs) > maxAgeMs) {
            return {
                ok: true,
                changed: false,
                reason: 'stale-child',
                taskId,
                parentTaskId,
                attrHostId,
            };
        }
        let childTask = await __tmResolveQuickbarSubtaskInheritanceTask(taskId, { attrHostId: attrHostId || taskId, forceFresh: true });
        if (!childTask) {
            return {
                ok: false,
                changed: false,
                retry: true,
                reason: 'child-missing',
                taskId,
                parentTaskId,
                attrHostId,
            };
        }
        let parentTask = await __tmResolveQuickbarSubtaskInheritanceTask(parentTaskId, { forceFresh: true });
        if (!parentTask) {
            return {
                ok: false,
                changed: false,
                retry: true,
                reason: 'parent-missing',
                taskId,
                parentTaskId,
                attrHostId,
            };
        }
        const createdTs = __tmParseQuickbarTaskCreatedTs(childTask, taskId);
        if (createdTs && (Date.now() - createdTs) > maxAgeMs) {
            return {
                ok: true,
                changed: false,
                reason: 'stale-child',
                taskId,
                parentTaskId,
                attrHostId,
            };
        }
        if (customFieldIds.length) {
            if (typeof __tmAttachCustomFieldAttrsToTasks !== 'function') {
                return {
                    ok: false,
                    changed: false,
                    retry: true,
                    reason: 'custom-field-unavailable',
                    taskId,
                    parentTaskId,
                    attrHostId,
                };
            }
            try {
                await __tmAttachCustomFieldAttrsToTasks([childTask, parentTask], { fieldIds: customFieldIds });
            } catch (e) {
                return {
                    ok: false,
                    changed: false,
                    retry: true,
                    reason: 'custom-field-attach-failed',
                    taskId,
                    parentTaskId,
                    attrHostId,
                };
            }
        }
        try {
            childTask = __tmCacheTaskInState(childTask, {
                docNameFallback: childTask.doc_name || childTask.docName || '未命名文档'
            }) || childTask;
            parentTask = __tmCacheTaskInState(parentTask, {
                docNameFallback: parentTask.doc_name || parentTask.docName || '未命名文档'
            }) || parentTask;
        } catch (e) {}
        const patch = __tmBuildMissingExternalSubtaskInheritedPatch(childTask, parentTask);
        if (!patch || !Object.keys(patch).length) {
            return {
                ok: true,
                changed: false,
                reason: 'no-patch',
                taskId,
                parentTaskId,
                attrHostId,
            };
        }
        const queueAttrHostId = String(attrHostId || childTask.attrHostId || childTask.attr_host_id || taskId).trim();
        const docId = String(next.docId || childTask.root_id || childTask.docId || parentTask.root_id || parentTask.docId || '').trim();
        const queued = __tmQueueExternalSubtaskInheritedPatches([{ 
            task: childTask,
            parentTask,
            patch,
            docId,
            attrHostId: queueAttrHostId,
        }], {
            source: String(next.source || 'quickbar-subtask-inherit-attrs').trim() || 'quickbar-subtask-inherit-attrs',
            attrTargetId: queueAttrHostId,
        });
        return {
            ok: true,
            changed: queued > 0,
            queued: queued > 0,
            reason: queued > 0 ? 'queued' : 'already-queued',
            taskId,
            parentTaskId,
            attrHostId: queueAttrHostId,
        };
    }

    __tmNs.quickbarBridge = {
        debugPush(channel, tag, payload = {}) {
            return __tmPushDebugChannel(channel, tag, payload);
        },
        async getTaskCustomPropsByAnyId(taskIdOrBlockId, options = {}) {
            return await __tmGetQuickbarTaskCustomPropsByAnyId(taskIdOrBlockId, options);
        },
        async getApplicableCustomFieldIdsForDoc(docId) {
            return await __tmGetQuickbarApplicableCustomFieldIdsForDoc(docId);
        },
        async maybeInheritSubtaskFields(detail = {}) {
            return await __tmQuickbarMaybeInheritSubtaskFields(detail);
        },
        formatTaskTime(value) {
            try { return __tmFormatTaskTime(value); } catch (e) { return String(value || '').trim(); }
        },
        formatTaskCompletedAtTime(value) {
            try { return __tmFormatTaskCompletedAtTime(value); } catch (e) { return String(value || '').trim(); }
        },
        notifyAttrUpdated(detail = {}) {
            const next = (detail && typeof detail === 'object' && !Array.isArray(detail)) ? detail : {};
            const taskId = String(next.taskId || '').trim();
            const requestedTaskId = String(next.requestedTaskId || '').trim();
            const attrHostId = String(next.attrHostId || '').trim();
            const attrKey = String(next.attrKey || '').trim();
            const value = String(next.value ?? '');
            const source = String(next.source || 'quickbar').trim() || 'quickbar';
            if (!taskId) return false;
            try {
                window.dispatchEvent(new CustomEvent('tm-task-attr-updated', {
                    detail: {
                        taskId,
                        requestedTaskId,
                        attrHostId: attrHostId || taskId,
                        attrKey,
                        value,
                        source,
                        __relayTransport: 'namespace',
                        __relaySource: 'quickbar',
                    }
                }));
            } catch (e) {
                try {
                    if (typeof __tmQuickbarTaskUpdateHandler === 'function') {
                        __tmQuickbarTaskUpdateHandler({
                            detail: {
                                taskId,
                                requestedTaskId,
                                attrHostId: attrHostId || taskId,
                                attrKey,
                                value,
                                source,
                                __relayTransport: 'namespace',
                                __relaySource: 'quickbar',
                            }
                        });
                    }
                } catch (e2) {}
            }
            try { __tmMarkQuickbarModifiedTask(taskId); } catch (e) {}
            try { globalThis.__taskHorizonMarkModified?.(taskId); } catch (e) {}
            const scheduled = typeof globalThis.__taskHorizonScheduleQuickbarRefresh === 'function'
                ? globalThis.__taskHorizonScheduleQuickbarRefresh({
                    source: 'quickbar-bridge',
                    taskId,
                    requestedTaskId,
                    attrHostId: attrHostId || taskId,
                    attrKey,
                })
                : false;
            if (!scheduled) {
                setTimeout(() => {
                    try { globalThis.__taskHorizonRefresh?.(); } catch (e) {}
                }, 0);
            }
            return true;
        },
        markModified(taskId = '') {
            const id = String(taskId || '').trim();
            if (!id) return false;
            try { __tmMarkQuickbarModifiedTask(id); } catch (e) {}
            try { globalThis.__taskHorizonMarkModified?.(id); } catch (e) {}
            return true;
        },
        getCollectedOtherBlockIds() {
            const ids = [];
            const pushRefs = (refs) => {
                __tmNormalizeOtherBlockRefs(refs).forEach((item) => {
                    const id = String(item?.id || '').trim();
                    if (id) ids.push(id);
                });
            };
            try { pushRefs(SettingsStore.data.otherBlockRefs); } catch (e) {}
            try {
                (Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : []).forEach((group) => {
                    pushRefs(group?.otherBlockRefs);
                });
            } catch (e) {}
            return Array.from(new Set(ids));
        },
        isCollectedOtherBlockId(blockId = '') {
            const id = String(blockId || '').trim();
            if (!id) return false;
            try { return this.getCollectedOtherBlockIds().includes(id); } catch (e) { return false; }
        },
        refresh() {
            try { globalThis.__taskHorizonRefresh?.(); return true; } catch (e) { return false; }
        }
    };
    __tmNs.getTaskStatusDisplayByAnyId = __tmGetTaskStatusDisplayByAnyId;
    __tmNs.getTaskReminderSnapshotByAnyId = __tmGetTaskReminderSnapshotByAnyId;
    __tmNs.getStats = __tmGetStatsSnapshot;
    __tmNs.getPerfTraceLatest = function() {
        return __tmClonePerfTrace(globalThis.__tmTaskHorizonPerfTraceLast || null);
    };
    __tmNs.getPerfTraceLog = function(limit = 5) {
        const count = Math.max(1, Math.min(80, Number(limit) || 5));
        return __tmPerfTraceStore.log.slice(-count).map((trace) => __tmClonePerfTrace(trace)).filter(Boolean);
    };
    __tmNs.clearPerfTraceLog = __tmClearPerfTraces;
    __tmNs.undoLastMutation = __tmUndoLastMutation;

    try { __tmSyncExplicitWindowExports(); } catch (e) {}

    __tmNs.uninstallCleanup = async function() {
        const removePluginFile = async (path) => {
            if (!path) return;
            try {
                await fetch('/api/file/removeFile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path }),
                }).catch(() => null);
            } catch (e) {}
        };

        try {
            await removePluginFile(META_FILE_PATH);
        } catch (e) {}

        try {
            await Promise.all([
                removePluginFile(SEMANTIC_DATE_RECOGNIZED_FILE_PATH),
                removePluginFile(TASK_SNAPSHOT_FILE_PATH),
                removePluginFile(TASK_INDEX_FILE_PATH),
                removePluginFile(DIAGNOSTIC_LOG_FILE_PATH),
                removePluginFile(`${PLUGIN_STORAGE_DIR}/ai-conversations.json`),
                removePluginFile(`${PLUGIN_STORAGE_DIR}/ai-debug.json`),
                removePluginFile(`${PLUGIN_STORAGE_DIR}/ai-prompt-templates.json`),
            ]);
        } catch (e) {}
        try { __tmInvalidateTaskIndexStoreCache(); } catch (e) {}

        try {
            [
                'tm_selected_doc_ids',
                'tm_query_limit',
                'tm_recursive_doc_limit',
                'tm_group_by_docname',
                'tm_group_by_taskname',
                'tm_group_by_time',
                'tm_group_mode',
                'tm_doc_h2_subgroup_enabled',
                'tm_collapsed_task_ids',
                'tm_collapsed_groups',
                'tm_expanded_completed_groups',
                'tm_current_rule',
                'tm_filter_rules',
                'tm_font_size',
                'tm_font_size_mobile',
                'tm_row_height_mode',
                'tm_row_height_px',
                'tm_enable_quickbar',
                'tm_pin_new_tasks_by_default',
                'tm_new_task_doc_id',
                'tm_enable_tomato_integration',
                'tm_tomato_spent_attr_mode',
                'tm_tomato_spent_attr_key_minutes',
                'tm_tomato_spent_attr_key_hours',
                'tm_tomato_count_attr_key',
                'tm_tomato_estimate_attr_key',
                'tm_timeline_card_fields',
                'tm_doc_topbar_button_swap_press_actions',
                'tm_topbar_button_visibility',
                'tm_default_doc_id',
                'tm_default_doc_id_by_group',
                'tm_priority_score_config',
                'tm_quadrant_config',
                'tm_doc_groups',
                'tm_current_group_id',
                'tm_custom_status_options',
                'tm_custom_duration_options',
                'tm_column_widths',
                'tm_column_order',
                'tm_topbar_gradient_light_start',
                'tm_topbar_gradient_light_end',
                'tm_topbar_gradient_dark_start',
                'tm_topbar_gradient_dark_end',
                'tm_topbar_text_color_light',
                'tm_topbar_text_color_dark',
                'tm_task_content_color_light',
                'tm_task_content_color_dark',
                'tm_group_doc_label_color_light',
                'tm_group_doc_label_color_dark',
                'tm_time_group_base_color_light',
                'tm_time_group_base_color_dark',
                'tm_time_group_overdue_color_light',
                'tm_time_group_overdue_color_dark',
                'tm_table_border_color_light',
                'tm_table_border_color_dark',
                'tm_theme_config',
                'tm_meta_cache',
                'tm_whiteboard_data_cache',
                'tm_whiteboard_all_tabs_layout_mode',
                'tm_whiteboard_all_tabs_doc_order_by_group',
                'tm_whiteboard_all_tabs_card_min_width',
                'tm_whiteboard_stream_mobile_two_columns',
                'tm_ai_enabled',
                'tm_ai_side_dock_enabled',
                'tm_ai_provider',
                'tm_ai_minimax_api_key',
                'tm_ai_minimax_base_url',
                'tm_ai_minimax_model',
                'tm_ai_deepseek_api_key',
                'tm_ai_deepseek_base_url',
                'tm_ai_deepseek_model',
                'tm_ai_openai_api_key',
                'tm_ai_openai_base_url',
                'tm_ai_openai_model',
                'tm_ai_anthropic_api_key',
                'tm_ai_anthropic_base_url',
                'tm_ai_anthropic_model',
                'tm_ai_minimax_temperature',
                'tm_ai_minimax_max_tokens',
                'tm_ai_minimax_timeout_ms',
                'tm_ai_default_context_mode',
                'tm_ai_schedule_windows',
                __TM_SEMANTIC_DATE_RECOGNIZED_KEY,
                'tm-ai-ui-prefs',
                'tm-calendar-events',
                'tm-calendar-mobile-notification-registry',
                '__tmQuickbarModifiedTasks',
            ].forEach((k) => {
                try { Storage.remove(k); } catch (e) {}
            });
            try {
                const extraPrefixKeys = [];
                for (let i = 0; i < localStorage.length; i += 1) {
                    const key = String(localStorage.key(i) || '');
                    if (!key) continue;
                    if (key.startsWith('tm_ai_') || key.startsWith('tm_calendar_')) extraPrefixKeys.push(key);
                }
                extraPrefixKeys.forEach((k) => {
                    try { Storage.remove(k); } catch (e) {}
                });
            } catch (e) {}
        } catch (e) {}
    };
