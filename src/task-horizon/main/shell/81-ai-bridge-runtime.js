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

    async function __tmAiGetCurrentViewTasks(limit = 5) {
        const max = Math.max(1, Math.min(100, Number(limit) || 5));
        const filtered = Array.isArray(state.filteredTasks) ? state.filteredTasks : [];
        if (filtered.length) {
            return filtered
                .slice(0, max)
                .map((task) => __tmAiClone(task))
                .filter(Boolean);
        }
        const list = [];
        const walk = (items) => {
            (Array.isArray(items) ? items : []).forEach((task) => {
                if (list.length >= max) return;
                if (task && typeof task === 'object') list.push(__tmAiClone(task));
                if (list.length < max) walk(task?.children || []);
            });
        };
        try {
            (Array.isArray(state.taskTree) ? state.taskTree : []).forEach((doc) => {
                if (list.length >= max) return;
                walk(doc?.tasks || []);
            });
        } catch (e) {}
        return list.slice(0, max).filter(Boolean);
    }

    async function __tmAiGetCurrentFilteredTasks(limit = 0) {
        const hasLimit = Number.isFinite(Number(limit)) && Number(limit) > 0;
        const max = hasLimit ? Math.max(1, Math.min(5000, Number(limit) || 200)) : Infinity;
        const filtered = Array.isArray(state.filteredTasks) ? state.filteredTasks : [];
        const list = filtered
            .slice(0, hasLimit ? max : filtered.length)
            .map((task) => __tmAiClone(task))
            .filter(Boolean);
        return hasLimit ? list.slice(0, max) : list;
    }

    async function __tmAiGetCurrentGroupTasks(limit = 0, options = {}) {
        const hasLimit = Number.isFinite(Number(limit)) && Number(limit) > 0;
        const max = hasLimit ? Math.max(1, Math.min(2000, Number(limit) || 20)) : Infinity;
        const includeDone = !!(options && typeof options === 'object' && options.includeDone);
        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        let targetDocs = [];
        if (currentGroupId === 'all') {
            const legacyIds = Array.isArray(SettingsStore.data.selectedDocIds) ? SettingsStore.data.selectedDocIds : [];
            legacyIds.forEach((id) => targetDocs.push({ id, kind: 'doc', recursive: false }));
            groups.forEach((group) => {
                targetDocs.push(...__tmGetGroupSourceEntries(group));
            });
        } else {
            const group = groups.find((it) => String(it?.id || '').trim() === currentGroupId);
            if (group) targetDocs = __tmGetGroupSourceEntries(group);
        }
        const docIds = [];
        const seenDocIds = new Set();
        const pushDocId = (id0) => {
            const id = String(id0 || '').trim();
            if (!id || seenDocIds.has(id)) return;
            seenDocIds.add(id);
            docIds.push(id);
        };
        await Promise.all((Array.isArray(targetDocs) ? targetDocs : []).map((entry) => __tmExpandSourceEntryDocIds(entry, pushDocId)));
        const docIdSet = new Set(docIds);
        if (!docIdSet.size) return [];
        const out = [];
        const seenTaskIds = new Set();
        const walk = (tasks) => {
            (Array.isArray(tasks) ? tasks : []).forEach((task) => {
                if (out.length >= max || !task || typeof task !== 'object') return;
                const taskId = String(task.id || '').trim();
                const docId = String(task.docId || task.root_id || '').trim();
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
        const docsForTabs = __tmSortDocEntriesForTabs(state.taskTree || [], currentGroupId)
            .map((doc) => String(doc?.id || '').trim())
            .filter(Boolean);
        if (docsForTabs.length) return Array.from(new Set(docsForTabs));
        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        let targetDocs = [];
        if (currentGroupId === 'all') {
            const legacyIds = Array.isArray(SettingsStore.data.selectedDocIds) ? SettingsStore.data.selectedDocIds : [];
            legacyIds.forEach((id) => targetDocs.push({ id, kind: 'doc', recursive: false }));
            groups.forEach((group) => {
                targetDocs.push(...__tmGetGroupSourceEntries(group));
            });
        } else {
            const group = groups.find((it) => String(it?.id || '').trim() === currentGroupId);
            if (group) targetDocs = __tmGetGroupSourceEntries(group);
        }
        const docIds = [];
        const seenDocIds = new Set();
        const pushDocId = (id0) => {
            const id = String(id0 || '').trim();
            if (!id || seenDocIds.has(id)) return;
            seenDocIds.add(id);
            docIds.push(id);
        };
        await Promise.all((Array.isArray(targetDocs) ? targetDocs : []).map((entry) => __tmExpandSourceEntryDocIds(entry, pushDocId)));
        return docIds.filter(Boolean);
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

    __tmNs.aiBridge = {
        getSettings() {
            return __tmAiClone({
                aiEnabled: !!SettingsStore.data.aiEnabled,
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
        async saveAiSettings(patch = {}) {
            if (!patch || typeof patch !== 'object') return this.getSettings();
            Object.entries(patch).forEach(([key, value]) => {
                if (!(key in SettingsStore.data)) return;
                SettingsStore.data[key] = value;
            });
            await SettingsStore.save();
            return this.getSettings();
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
        async getCurrentViewTasks(limit) {
            return await __tmAiGetCurrentViewTasks(limit);
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
                if (!fieldId) return;
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
        return {
            requestedId,
            taskId: String(task?.id || taskId || requestedId).trim(),
            attrHostId: String(binding?.attrHostId || __tmGetTaskAttrHostId(task) || taskId || requestedId).trim(),
            props,
        };
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
            setTimeout(() => {
                try { globalThis.__taskHorizonRefresh?.(); } catch (e) {}
            }, 0);
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
            await removePluginFile(SETTINGS_FILE_PATH);
        } catch (e) {}

        try {
            await removePluginFile(META_FILE_PATH);
        } catch (e) {}

        try {
            await Promise.all([
                removePluginFile(SEMANTIC_DATE_RECOGNIZED_FILE_PATH),
                removePluginFile(TASK_SNAPSHOT_FILE_PATH),
                removePluginFile(TASK_INDEX_FILE_PATH),
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

