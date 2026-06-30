    function __tmGetCalendarDocsToGroupMapSync() {
        const cachedMap = window.__tmCalendarDocsToGroupCache?.map;
        if (cachedMap instanceof Map) return new Map(cachedMap);
        const docsToGroup = new Map();
        try {
            const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
            groups.forEach((g) => {
                const gid = String(g?.id || '').trim();
                const docs = __tmNormalizeGroupDocEntries(g);
                if (!gid) return;
                docs.forEach((d) => {
                    const did = String((typeof d === 'object' ? d?.id : d) || '').trim();
                    if (!did) return;
                    if (!docsToGroup.has(did)) docsToGroup.set(did, gid);
                });
            });
        } catch (e) {}
        return docsToGroup;
    }

    function __tmFlattenCalendarTaskTreeSync() {
        const out = [];
        const seen = new Set();
        const walk = (tasks) => {
            const list = Array.isArray(tasks)
                ? tasks.slice().sort((a, b) => {
                    try { return __tmCompareTasksByDocFlow(a, b); } catch (e) { return 0; }
                })
                : [];
            list.forEach((task) => {
                if (!task || typeof task !== 'object') return;
                const id = String(task?.id || '').trim();
                if (!id || seen.has(id)) return;
                seen.add(id);
                out.push(task);
                if (Array.isArray(task?.children) && task.children.length > 0) walk(task.children);
            });
        };
        (Array.isArray(state.taskTree) ? state.taskTree : []).forEach((doc) => walk(doc?.tasks || []));
        return out;
    }

    function __tmGetCalendarFlatTaskByIdSync(id) {
        const tid = String(id || '').trim();
        if (!tid) return null;
        return globalThis.__tmRuntimeState?.getTaskById?.(tid, { includePending: true, preferPending: true })
            || state.flatTasks?.[tid]
            || state.pendingInsertedTasks?.[tid]
            || null;
    }

    function __tmGetCalendarFlatTasksSync() {
        const values = (state.flatTasks && typeof state.flatTasks === 'object')
            ? Object.values(state.flatTasks).map((task) => {
                const tid = String(task?.id || '').trim();
                return __tmGetCalendarFlatTaskByIdSync(tid) || task;
            })
            : [];
        try {
            Object.values(state.pendingInsertedTasks || {}).forEach((task) => {
                if (!task || typeof task !== 'object') return;
                const tid = String(task?.id || '').trim();
                if (!tid || values.some((item) => String(item?.id || '').trim() === tid)) return;
                values.push(task);
            });
        } catch (e) {}
        return values.sort((a, b) => {
            try { return __tmCompareTasksByDocFlow(a, b); } catch (e) { return 0; }
        });
    }

    function __tmGetCalendarTaskCandidatesSync() {
        const docsToGroup = __tmGetCalendarDocsToGroupMapSync();

        const pickFrom = (source) => {
            const list = Array.isArray(source) ? source : [];
            const out = [];
            const seen = new Set();
            list.forEach((task) => {
                if (!task || typeof task !== 'object') return;
                const id = String(task?.id || '').trim();
                if (!id || seen.has(id)) return;
                seen.add(id);
                out.push(task);
            });
            return out;
        };

        const filteredTasks = pickFrom(state.filteredTasks);
        if (filteredTasks.length > 0) return { tasks: filteredTasks, docsToGroup };

        const treeTasks = pickFrom(__tmFlattenCalendarTaskTreeSync());
        if (treeTasks.length > 0) return { tasks: treeTasks, docsToGroup };

        const cachedTasks = pickFrom(window.__tmCalendarAllTasksCache?.tasks);
        if (cachedTasks.length > 0) return { tasks: cachedTasks, docsToGroup };

        const flatTasks = pickFrom(__tmGetCalendarFlatTasksSync());
        return { tasks: flatTasks, docsToGroup };
    }

    function __tmResolveCalendarTaskDisplayTitle(task, fallback = '') {
        const t = (task && typeof task === 'object') ? task : {};
        const fb = String(fallback || '').trim();
        try {
            if (API && typeof API.parseTaskStatus === 'function') {
                const parsed = API.parseTaskStatus(String(t?.markdown || ''));
                const parsedTitle = String(parsed?.content || '').trim();
                if (parsedTitle) return parsedTitle;
            }
        } catch (e) {}
        let title = String(t?.content || t?.title || t?.raw_content || '').trim();
        if (!title) title = fb;
        if (!title) return '(无标题)';
        try {
            if (API && typeof API.normalizeTaskContent === 'function') {
                const normalized = String(API.normalizeTaskContent(title) || '').trim();
                if (normalized) title = normalized;
            }
        } catch (e) {}
        title = title.split(/\r?\n/, 1)[0].replace(/\s+/g, ' ').trim();
        return title || fb || '(无标题)';
    }

    function __tmBuildCalendarRepeatHistoryTask(sourceTask, historyItem, orderIndex = 0) {
        const source = (sourceTask && typeof sourceTask === 'object') ? sourceTask : null;
        const taskId = String(source?.id || '').trim();
        if (!source || !taskId) return null;
        const history = (() => {
            try {
                if (typeof __tmNormalizeTaskRepeatHistory === 'function') {
                    return __tmNormalizeTaskRepeatHistory([historyItem])[0] || null;
                }
            } catch (e) {}
            const raw = (historyItem && typeof historyItem === 'object') ? historyItem : {};
            return {
                completedAt: String(raw.completedAt || '').trim(),
                sourceStart: __tmNormalizeDateOnly(raw.sourceStart || ''),
                sourceDue: __tmNormalizeDateOnly(raw.sourceDue || ''),
                content: String(raw.content || '').trim(),
            };
        })();
        if (!history) return null;
        const sourceStart = __tmNormalizeDateOnly(history.sourceStart || history.sourceDue || '');
        const sourceDue = __tmNormalizeDateOnly(history.sourceDue || history.sourceStart || '');
        if (!sourceStart && !sourceDue) return null;
        const completedAt = String(history.completedAt || '').trim();
        const historyStamp = completedAt || `${sourceStart}_${sourceDue}_${orderIndex}`;
        const completedStamp = historyStamp.replace(/[^0-9A-Za-z_-]/g, '').slice(0, 32) || String(orderIndex);
        const fallbackId = `repeatinst:${taskId}:${completedStamp || orderIndex}`;
        let virtualTask = null;
        try {
            if (typeof __tmBuildRecurringInstanceTask === 'function') {
                virtualTask = __tmBuildRecurringInstanceTask(source, history, orderIndex);
            }
        } catch (e) {
            virtualTask = null;
        }
        const title = String(history.content || source.content || source.raw_content || '').trim() || '(无内容)';
        const next = {
            ...source,
            ...(virtualTask && typeof virtualTask === 'object' ? virtualTask : {}),
            id: String(virtualTask?.id || fallbackId).trim() || fallbackId,
            sourceTaskId: taskId,
            recurringSourceTaskId: taskId,
            recurringCompletedAt: completedAt,
            isRecurringInstance: true,
            isRecurringInstanceReadOnly: true,
            done: true,
            content: title,
            raw_content: title,
            markdown: `- [x] ${title}`,
            startDate: sourceStart,
            start_date: sourceStart,
            completionTime: sourceDue,
            completion_time: sourceDue,
            repeatHistory: [],
            repeat_history: [],
        };
        try { normalizeTaskFields(next, next.docName || next.doc_name || source.docName || '未命名文档'); } catch (e) {}
        return next;
    }

    function __tmAppendCalendarTaskAndRepeatHistory(out, task) {
        const list = Array.isArray(out) ? out : null;
        if (!list || !task || typeof task !== 'object') return;
        list.push(task);
        let repeatHistory = [];
        try {
            repeatHistory = typeof __tmNormalizeTaskRepeatHistory === 'function'
                ? __tmNormalizeTaskRepeatHistory(task.repeatHistory || task.repeat_history || '')
                : (Array.isArray(task.repeatHistory) ? task.repeatHistory : []);
        } catch (e) {
            repeatHistory = Array.isArray(task.repeatHistory) ? task.repeatHistory : [];
        }
        repeatHistory.forEach((historyItem, historyIndex) => {
            const virtualTask = __tmBuildCalendarRepeatHistoryTask(task, historyItem, historyIndex);
            if (virtualTask?.id) list.push(virtualTask);
        });
    }

    function __tmResolveCalendarCachedTaskForDetail(taskId, options = {}) {
        const rawId = String(taskId || '').trim();
        if (!rawId) return null;
        const cacheTasks = Array.isArray(window.__tmCalendarAllTasksCache?.tasks) ? window.__tmCalendarAllTasksCache.tasks : [];
        if (!cacheTasks.length) return null;
        const opts = (options && typeof options === 'object') ? options : {};
        const aliases = new Set([rawId]);
        try {
            const resolvedId = typeof __tmResolveOptimisticTaskId === 'function'
                ? String(__tmResolveOptimisticTaskId(rawId) || '').trim()
                : '';
            if (resolvedId) aliases.add(resolvedId);
        } catch (e) {}
        (Array.isArray(opts.aliases) ? opts.aliases : []).forEach((id) => {
            const tid = String(id || '').trim();
            if (tid) aliases.add(tid);
        });

        const byId = new Map();
        const childrenByParent = new Map();
        cacheTasks.forEach((task) => {
            if (!task || typeof task !== 'object') return;
            const tid = String(task.id || '').trim();
            if (!tid) return;
            if (!byId.has(tid)) byId.set(tid, task);
            const isRecurringInstance = task.isRecurringInstance === true || String(tid || '').startsWith('repeatinst:');
            if (isRecurringInstance) return;
            const parentId = String(task.parentTaskId || task.parent_task_id || '').trim();
            if (!parentId) return;
            if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
            childrenByParent.get(parentId).push(task);
        });

        let sourceTask = null;
        for (const alias of aliases) {
            sourceTask = byId.get(alias) || null;
            if (sourceTask) break;
        }
        if (!sourceTask) return null;

        const cloneSubtree = (task, visiting = new Set()) => {
            if (!task || typeof task !== 'object') return null;
            const tid = String(task.id || '').trim();
            if (!tid || visiting.has(tid)) return null;
            visiting.add(tid);
            const childMap = new Map();
            (Array.isArray(task.children) ? task.children : []).forEach((child) => {
                const cid = String(child?.id || '').trim();
                if (cid) childMap.set(cid, child);
            });
            (childrenByParent.get(tid) || []).forEach((child) => {
                const cid = String(child?.id || '').trim();
                if (cid && !childMap.has(cid)) childMap.set(cid, child);
            });
            const children = Array.from(childMap.values()).sort((a, b) => {
                try { return __tmCompareTasksByDocFlow(a, b); } catch (e) { return 0; }
            }).map((child) => cloneSubtree(child, visiting)).filter(Boolean);
            visiting.delete(tid);
            const parentTaskId = String(task.parentTaskId || task.parent_task_id || '').trim();
            return {
                ...task,
                parentTaskId,
                parent_task_id: parentTaskId,
                children,
            };
        };

        return cloneSubtree(sourceTask);
    }
    globalThis.__tmResolveCalendarCachedTaskForDetail = __tmResolveCalendarCachedTaskForDetail;

    function __tmPatchCalendarAllTasksCacheTask(taskId, patch = {}) {
        const tid = String(taskId || '').trim();
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        const cache = window.__tmCalendarAllTasksCache;
        const tasks = Array.isArray(cache?.tasks) ? cache.tasks : null;
        if (!tid || !tasks) return false;
        const hasStartDate = Object.prototype.hasOwnProperty.call(nextPatch, 'startDate');
        const hasCompletionTime = Object.prototype.hasOwnProperty.call(nextPatch, 'completionTime');
        const hasTaskDateColor = Object.prototype.hasOwnProperty.call(nextPatch, 'taskDateColor')
            || Object.prototype.hasOwnProperty.call(nextPatch, 'color');
        let touched = false;
        tasks.forEach((task) => {
            if (!task || typeof task !== 'object') return;
            if (String(task.id || '').trim() !== tid) return;
            if (hasStartDate) {
                const value = String(nextPatch.startDate ?? '').trim();
                task.startDate = value;
                task.start_date = value;
            }
            if (hasCompletionTime) {
                const value = String(nextPatch.completionTime ?? '').trim();
                task.completionTime = value;
                task.completion_time = value;
            }
            if (hasTaskDateColor) {
                const value = String((Object.prototype.hasOwnProperty.call(nextPatch, 'taskDateColor') ? nextPatch.taskDateColor : nextPatch.color) ?? '').trim();
                task.taskDateColor = value;
                task.task_date_color = value;
                task.custom_task_date_color = value;
                task['custom-task-date-color'] = value;
                const configuredColorKey = typeof __tmGetTaskMetaAttrKey === 'function' ? __tmGetTaskMetaAttrKey('taskDateColor') : '';
                if (configuredColorKey) task[configuredColorKey] = value;
            }
            touched = true;
        });
        try { cache.ts = 0; } catch (e) {}
        return touched;
    }

    let __tmCalendarTaskCacheWarmPromise = null;

    function __tmIsCalendarMainViewActiveForTaskCache() {
        try {
            if (String(state.viewMode || '').trim() !== 'calendar') return false;
            const root = state.modal?.querySelector?.('#tmCalendarRoot');
            return root instanceof HTMLElement && root.isConnected;
        } catch (e) {
            return false;
        }
    }

    function __tmShouldAllowCalendarTaskCacheFullLoad(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (opts.allowInactiveFullLoad === true || opts.allowInactiveView === true) return true;
        return __tmIsCalendarMainViewActiveForTaskCache();
    }

    function __tmPushCalendarTaskCacheDiag(phase, detail = {}) {
    }

    function __tmRequestCalendarTaskCacheWarmRefresh(options = {}, tasks = []) {
        const opts = (options && typeof options === 'object') ? options : {};
        const reason = String(opts.source || opts.reason || 'taskdate-cache-warm').trim() || 'taskdate-cache-warm';
        const taskCount = Array.isArray(tasks) ? tasks.length : 0;
        if (!__tmIsCalendarMainViewActiveForTaskCache()) {
            __tmPushCalendarTaskCacheDiag('taskdate-warm-refresh-skip', {
                reason,
                taskCount,
                skipReason: 'inactive-calendar-view',
            });
            return false;
        }
        const calApi = globalThis.__tmCalendar;
        let refreshApi = 'none';
        let requested = false;
        try {
            if (calApi && typeof calApi.requestRefresh === 'function') {
                refreshApi = 'requestRefresh';
                requested = calApi.requestRefresh({
                    reason,
                    main: true,
                    side: true,
                    flushTaskPanel: false,
                    hard: opts.hard === true,
                }) !== false;
            }
        } catch (e) {
            requested = false;
        }
        __tmPushCalendarTaskCacheDiag('taskdate-warm-refresh', {
            reason,
            taskCount,
            refreshApi,
            requested,
            flushTaskPanel: false,
        });
        return requested;
    }

    async function __tmLoadAllTasksForCalendarCache(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const limit = __TM_TASK_INDEX_QUERY_LIMIT;
        const allDocIds = await resolveDocIdsFromGroups({
            groupId: 'all',
            includeQuickAddDoc: true,
            forceRefreshScope: opts.forceRefreshScope === true,
        });
        const docKey = allDocIds.slice().sort().join(',');
        const key = `${limit}|${docKey}`;
        const maxAgeMs = Number.isFinite(Number(opts.maxAgeMs)) ? Math.max(0, Math.floor(Number(opts.maxAgeMs))) : 8000;
        const prev = window.__tmCalendarAllTasksCache;
        const forceFresh = opts.force === true || opts.forceFresh === true;
        if (!forceFresh && prev && prev.key === key && Array.isArray(prev.tasks) && (Date.now() - (Number(prev.ts) || 0) < maxAgeMs)) {
            return prev.tasks;
        }
        if (!allDocIds.length) {
            window.__tmCalendarAllTasksCache = { key, ts: Date.now(), tasks: [] };
            return [];
        }
        try { await MetaStore.load?.(); } catch (e) {}
        const res = await API.getTasksByDocuments(allDocIds, limit, { doneOnly: false, forceFresh });
        const tasks = Array.isArray(res?.tasks) ? res.tasks : [];
        const out = [];
        for (const task of tasks) {
            if (!task || typeof task !== 'object') continue;
            const prevTask = __tmGetCalendarFlatTaskByIdSync(task.id);
            let parsedDone = !!task.done;
            try {
                const parsed = API.parseTaskStatus(task.markdown);
                parsedDone = !!parsed.done;
                task.done = parsedDone;
                task.content = parsed.content;
            } catch (e) {}
            try { MetaStore.applyToTask?.(task); } catch (e) {}
            try { __tmMergeVisibleDateFieldsFromPrevTask(task, prevTask); } catch (e) {}
            task.done = parsedDone;
            try { normalizeTaskFields(task, task.docName || '未命名文档'); } catch (e) {}
            __tmAppendCalendarTaskAndRepeatHistory(out, task);
        }
        window.__tmCalendarAllTasksCache = { key, ts: Date.now(), tasks: out };
        return out;
    }

    function __tmCalendarTaskCacheIsFresh(maxAgeMs = 8000) {
        const prev = window.__tmCalendarAllTasksCache;
        if (!prev || !Array.isArray(prev.tasks)) return false;
        return (Date.now() - (Number(prev.ts) || 0)) < maxAgeMs;
    }

    window.tmEnsureCalendarTaskCache = async function(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (!__tmShouldAllowCalendarTaskCacheFullLoad(opts)) {
            const cachedTasks = Array.isArray(window.__tmCalendarAllTasksCache?.tasks) ? window.__tmCalendarAllTasksCache.tasks : [];
            __tmPushCalendarTaskCacheDiag('taskcache-skip-inactive-view', {
                source: opts.source,
                refresh: opts.refresh === true,
                cachedCount: cachedTasks.length,
            });
            return cachedTasks;
        }
        if (__tmCalendarTaskCacheWarmPromise) return __tmCalendarTaskCacheWarmPromise;
        const run = Promise.resolve().then(async () => {
            try { await window.tmCalendarWarmDocsToGroupCache?.(); } catch (e) {}
            const tasks = await __tmLoadAllTasksForCalendarCache(opts);
            if (opts.refresh !== false) {
                try { __tmRequestCalendarTaskCacheWarmRefresh(opts, tasks); } catch (e) {}
            }
            return tasks;
        });
        let tracked = null;
        tracked = run.finally(() => {
            if (__tmCalendarTaskCacheWarmPromise === tracked) __tmCalendarTaskCacheWarmPromise = null;
        });
        __tmCalendarTaskCacheWarmPromise = tracked;
        return tracked;
    };

    window.tmWarmCalendarTaskCacheIfStale = function(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const maxAgeMs = Number.isFinite(Number(opts.maxAgeMs)) ? Math.max(0, Math.floor(Number(opts.maxAgeMs))) : 8000;
        if (__tmCalendarTaskCacheWarmPromise) return false;
        if (__tmCalendarTaskCacheIsFresh(maxAgeMs)) return false;
        if (!__tmShouldAllowCalendarTaskCacheFullLoad(opts)) {
            __tmPushCalendarTaskCacheDiag('taskcache-warm-skip-inactive-view', {
                source: opts.source,
                refresh: opts.refresh === true,
                maxAgeMs,
            });
            return false;
        }
        try {
            Promise.resolve().then(() => window.tmEnsureCalendarTaskCache?.(opts)).catch(() => null);
            return true;
        } catch (e) {
            return false;
        }
    };

    function __tmBuildCalendarTaskRowsSync(limit = 0) {
        const hasLimit = Number.isFinite(Number(limit)) && Number(limit) > 0;
        const max = hasLimit ? Math.max(1, Math.min(500, Math.floor(Number(limit)))) : Number.POSITIVE_INFINITY;
        const { tasks, docsToGroup } = __tmGetCalendarTaskCandidatesSync();
        const map = new Map(tasks.map((t) => [String(t?.id || '').trim(), t]).filter(([k]) => !!k));
        const depthMemo = new Map();
        const getDepth = (id) => {
            const tid = String(id || '').trim();
            if (!tid) return 0;
            if (depthMemo.has(tid)) return depthMemo.get(tid);
            const task = map.get(tid);
            if (!task) return 0;
            const pid = String(task.parentTaskId || '').trim();
            const depth = pid ? Math.min(20, getDepth(pid) + 1) : 0;
            depthMemo.set(tid, depth);
            return depth;
        };

        const out = [];
        for (const task of tasks) {
            if (!task || task.done) continue;
            const id = String(task.id || '').trim();
            if (!id) continue;
            const title = __tmResolveCalendarTaskDisplayTitle(task, '(无标题)');
            const docId = String(task.root_id || '').trim();
            const gid = docId ? docsToGroup.get(docId) : '';
            const calendarId = gid ? `group:${gid}` : 'default';
            out.push({
                id,
                task,
                title,
                duration: String(task?.duration || '').trim(),
                tomatoSummary: __tmGetTaskTomatoSummaryText(task),
                tomatoSummaryHtml: __tmGetTaskTomatoSummaryHtml(task),
                tomatoEstimateCount: __tmGetTomatoCountDisplay(__tmGetTaskTomatoEstimateCount(task)),
                tomatoCount: __tmGetTomatoCountDisplay(__tmGetTaskTomatoCount(task)),
                spent: __tmGetTaskSpentDisplay(task),
                spentHtml: __tmGetTaskSpentDisplayHtml(task),
                calendarId,
                depth: getDepth(id),
            });
            if (out.length >= max) break;
        }
        return out;
    }

    function __tmBuildCalendarTaskTableFallbackHtml() {
        const rawColOrder = Array.isArray(SettingsStore.data.columnOrder) && SettingsStore.data.columnOrder.length
            ? SettingsStore.data.columnOrder
            : ['content', 'tomatoSummary'];
        const knownColumnKeys = typeof __tmGetKnownColumnKeys === 'function' ? __tmGetKnownColumnKeys() : null;
        const colOrder = rawColOrder
            .map((col) => String(col || '').trim())
            .filter((col, index, arr) => col && (!knownColumnKeys || knownColumnKeys.has(col)) && arr.indexOf(col) === index);
        if (!colOrder.length) colOrder.push('content', 'tomatoSummary');
        const widths = SettingsStore.data.columnWidths || SettingsStore.data.calendarColumnWidths || {};
        const tableLayout = __tmGetTableWidthLayout(colOrder, widths, state.tableAvailableWidth);
        const headers = {
            content: `<th data-col="content" style="${tableLayout.cellStyle('content', 'white-space: nowrap; overflow: hidden;')}">任务内容<span class="tm-col-resize" onmousedown="startColResize(event, 'content')"></span></th>`,
            tomatoSummary: `<th data-col="tomatoSummary" style="${tableLayout.cellStyle('tomatoSummary', 'text-align: center; white-space: nowrap; overflow: hidden;')}">专注<span class="tm-col-resize" onmousedown="startColResize(event, 'tomatoSummary')"></span></th>`,
        };
        const buildCell = (item, col) => {
            if (col === 'content') {
                let contentHtml = '';
                try {
                    contentHtml = `${API.renderTaskContentHtml(item.task?.markdown, item.title)}${__tmRenderGlobalCollectDocTaskInlineIcon(item.task)}`;
                } catch (e) {
                    contentHtml = esc(item.title);
                }
                const depthPad = 8 + Math.min(6, Math.max(0, Number(item.depth) || 0)) * 14;
                return `
                        <td style="${tableLayout.cellStyle('content')}">
                            <div class="tm-task-cell" style="padding-left:${depthPad}px;">
                                <span class="tm-task-text">
                                    <span class="tm-task-content-clickable"${__tmBuildTooltipAttrs(String(item.title || '').trim() || '(无内容)', { side: 'bottom', ariaLabel: false })} style="${__tmBuildTaskTitleOpacityStyle(item.task)}">${contentHtml}</span>
                                </span>
                            </div>
                        </td>`;
            }
            if (col === 'tomatoSummary') return `<td class="tm-cell-editable tm-task-meta-cell" data-tm-task-time-field="tomatoSummary" style="${tableLayout.cellStyle('tomatoSummary', 'text-align: center; font-variant-numeric: inherit;')}" onclick="tmBeginCellEdit('${escSq(item.id)}','tomatoSummary',this,event)">${item.tomatoSummaryHtml || esc(item.tomatoSummary || '')}</td>`;
            return '';
        };
        const rows = __tmBuildCalendarTaskRowsSync(300);
        const tbody = rows.length
            ? rows.map((item) => {
                return `
                    <tr data-id="${esc(item.id)}" data-calendar-id="${esc(item.calendarId)}">
                        ${colOrder.map((col) => buildCell(item, col)).join('')}
                    </tr>
                `;
            }).join('')
            : `<tr><td colspan="${Math.max(1, colOrder.length || 3)}" style="text-align: center; padding: 40px; color: var(--tm-secondary-text);">暂无任务</td></tr>`;
        const thead = colOrder.map((col) => headers[col] || '').join('');
        return `
            <div class="tm-calendar-task-list" style="height:100%; display:flex; flex-direction:column;">
                <table class="tm-table" id="tmTaskTable" data-tm-table="calendar" style="${tableLayout.tableStyle}">
                    <thead><tr>${thead}</tr></thead>
                    <tbody>${tbody}</tbody>
                </table>
            </div>
        `;
    }

    window.tmGetCalendarDragTasks = function(limit) {
        const max = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(500, Math.floor(Number(limit)))) : 200;
        const { tasks, docsToGroup } = __tmGetCalendarTaskCandidatesSync();

        const mode = String(SettingsStore.data.tomatoSpentAttrMode || 'minutes').trim() || 'minutes';
        const useHours = !!(SettingsStore.data.enableTomatoIntegration && mode === 'hours');

        const out = [];
        for (const t of tasks) {
            if (!t) continue;
            if (t.done) continue;
            const id = String(t.id || '').trim();
            if (!id) continue;
            const title = __tmResolveCalendarTaskDisplayTitle(t, '');
            const docId = String(t.root_id || '').trim();
            const gid = docId ? docsToGroup.get(docId) : '';
            const calendarId = gid ? `group:${gid}` : 'default';

            const mins = __tmParseDurationMinutes(t?.duration);
            const durationMin = (Number.isFinite(Number(mins)) && Number(mins) > 0) ? Math.round(Number(mins)) : 60;

            let spent = '';
            try {
                if (useHours) spent = __tmFormatSpentHours(__tmParseNumber(t?.tomatoHours)) || '';
                else spent = __tmFormatSpentMinutes(__tmGetTaskSpentMinutes(t)) || '';
            } catch (e) {}

            out.push({ id, title: title || '(无标题)', spent, durationMin, calendarId });
            if (out.length >= max) break;
        }
        return out;
    };

    window.tmQueryCalendarTasks = function(params) {
        const p = (params && typeof params === 'object') ? params : {};
        const size = Number.isFinite(Number(p.pageSize)) ? Math.max(20, Math.min(500, Math.floor(Number(p.pageSize)))) : 200;
        const page = Number.isFinite(Number(p.page)) ? Math.max(1, Math.floor(Number(p.page))) : 1;
        const q = String(p.query || '').trim().toLowerCase();

        const { tasks, docsToGroup } = __tmGetCalendarTaskCandidatesSync();
        const map = new Map(tasks.map((t) => [String(t?.id || '').trim(), t]).filter(([k]) => !!k));
        const childSet = new Set();
        for (const t of tasks) {
            const pid = String(t?.parentTaskId || '').trim();
            if (pid) childSet.add(pid);
        }
        const depthMemo = new Map();
        const getDepth = (id) => {
            if (!id) return 0;
            if (depthMemo.has(id)) return depthMemo.get(id);
            const t = map.get(id);
            if (!t) return 0;
            const pid = String(t.parentTaskId || '').trim();
            const d = pid ? Math.min(20, getDepth(pid) + 1) : 0;
            depthMemo.set(id, d);
            return d;
        };

        const mode = String(SettingsStore.data.tomatoSpentAttrMode || 'minutes').trim() || 'minutes';
        const useHours = !!(SettingsStore.data.enableTomatoIntegration && mode === 'hours');

        const all = [];
        for (const t of tasks) {
            if (!t) continue;
            if (t.done) continue;
            const id = String(t.id || '').trim();
            if (!id) continue;
            const title = __tmResolveCalendarTaskDisplayTitle(t, '(无标题)');
            if (q && !title.toLowerCase().includes(q)) continue;
            const docId = String(t.root_id || '').trim();
            const gid = docId ? docsToGroup.get(docId) : '';
            const calendarId = gid ? `group:${gid}` : 'default';

            const mins = __tmParseDurationMinutes(t?.duration);
            const durationMin = (Number.isFinite(Number(mins)) && Number(mins) > 0) ? Math.round(Number(mins)) : 60;

            let spent = '';
            try {
                if (useHours) spent = __tmFormatSpentHours(__tmParseNumber(t?.tomatoHours)) || '';
                else spent = __tmFormatSpentMinutes(__tmGetTaskSpentMinutes(t)) || '';
            } catch (e) {}

            all.push({
                id,
                title,
                spent,
                durationMin,
                calendarId,
                depth: getDepth(id),
                hasChildren: childSet.has(id),
            });
        }

        const total = all.length;
        if (total === 0) {
            try { window.tmWarmCalendarTaskCacheIfStale?.({ refresh: true }); } catch (e) {}
        }
        const start = (page - 1) * size;
        const items = all.slice(start, start + size);
        return { total, page, pageSize: size, items };
    };

    window.tmQueryCalendarTaskDateEvents = async function(rangeStart, rangeEnd, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const queryStartedAt = Date.now();
        const startKey = __tmNormalizeDateOnly(rangeStart);
        const endKey = __tmNormalizeDateOnly(rangeEnd);
        const forceFreshUntil = Number(globalThis.__tmCalendarTaskDateForceFreshUntil || 0) || 0;
        const forceFresh = opts.forceFresh === true || (forceFreshUntil > Date.now());
        const toTs = (k) => {
            const kk = String(k || '').trim();
            if (!kk) return 0;
            const d = new Date(`${kk}T12:00:00`);
            return Number.isNaN(d.getTime()) ? 0 : d.getTime();
        };
        const rangeStartTs = toTs(startKey) || 0;
        const rangeEndTs = toTs(endKey) || 0;
        const nextDay = (k) => {
            const ts = toTs(k);
            if (!ts) return '';
            const d = new Date(ts + 86400000);
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        };
        const pushTaskDateQueryDiag = (phase, detail = {}) => {
        };
        const scheduleTaskDateCacheWarm = (reason = 'taskdate-fast-first') => {
            const runtimeMobile = (() => {
                try {
                    return !!(globalThis.__tmRuntimeHost?.getInfo?.()?.runtimeMobileClient
                        ?? (typeof __tmIsRuntimeMobileClient === 'function' && __tmIsRuntimeMobileClient()));
                } catch (e) {
                    return false;
                }
            })();
            const jobStartedAt = Date.now();
            const maxPostponeMs = runtimeMobile ? 18000 : 8000;
            const getWarmWaitMeta = () => {
                const reasons = [];
                let waitMs = 0;
                const now = Date.now();
                try {
                    if (typeof __tmGetHighPriorityInteractionWaitMs === 'function') {
                        const highPriorityWait = __tmGetHighPriorityInteractionWaitMs(runtimeMobile ? 160 : 80);
                        if (highPriorityWait > 0) {
                            waitMs = Math.max(waitMs, highPriorityWait);
                            reasons.push('high-priority-interaction');
                        }
                    }
                } catch (e) {}
                try {
                    if (typeof __tmShouldDeferMainViewRefreshForActiveScroll === 'function'
                        && __tmShouldDeferMainViewRefreshForActiveScroll({ mode: 'current', reason })) {
                        const scrollWait = typeof __tmGetDeferredMainViewRefreshDelay === 'function'
                            ? __tmGetDeferredMainViewRefreshDelay({ mode: 'current', reason })
                            : (runtimeMobile ? 2200 : 900);
                        waitMs = Math.max(waitMs, scrollWait);
                        reasons.push('main-scroll-active');
                    }
                } catch (e) {}
                try {
                    const modal = state.modal instanceof Element ? state.modal : document;
                    const activeScroll = modal?.querySelector?.('.tm-scroll-active');
                    if (activeScroll) {
                        waitMs = Math.max(waitMs, runtimeMobile ? 2200 : 900);
                        reasons.push('scroll-active');
                    }
                } catch (e) {}
                try {
                    const body = state.modal?.querySelector?.('.tm-body.tm-body--kanban');
                    if (body instanceof HTMLElement) {
                        const lastScrollTs = Number(body.__tmKanbanSnapLastScrollTs || body.__tmLastUserScrollTs || 0) || 0;
                        const panActive = body.classList.contains('tm-body--kanban-pan-active')
                            || body.__tmKanbanSnapPanActive
                            || body.__tmKanbanSnapPointerActive
                            || Number(body.__tmKanbanSnapAnimRaf || 0) > 0
                            || Number(body.__tmKanbanSnapSettleTimer || 0) > 0;
                        if (panActive || (lastScrollTs > 0 && now - lastScrollTs < 1600)) {
                            waitMs = Math.max(waitMs, runtimeMobile ? 2200 : 900);
                            reasons.push('kanban-scroll-active');
                        }
                    }
                } catch (e) {}
                try {
                    const bodies = Array.from(state.modal?.querySelectorAll?.('.tm-kanban-col-body') || []);
                    if (bodies.some((item) => {
                        const lastScrollTs = Number(item?.__tmLastUserScrollTs || 0) || 0;
                        return item?.classList?.contains?.('tm-scroll-active') || (lastScrollTs > 0 && now - lastScrollTs < 1600);
                    })) {
                        waitMs = Math.max(waitMs, runtimeMobile ? 2200 : 900);
                        reasons.push('kanban-col-scroll-active');
                    }
                } catch (e) {}
                return {
                    waitMs: Math.max(0, Math.min(runtimeMobile ? 5200 : 2600, Math.round(waitMs || 0))),
                    reason: Array.from(new Set(reasons)).join(','),
                };
            };
            const run = () => {
                const waitMeta = getWarmWaitMeta();
                const elapsedMs = Date.now() - jobStartedAt;
                if (waitMeta.waitMs > 0 && elapsedMs < maxPostponeMs) {
                    try { setTimeout(run, waitMeta.waitMs); } catch (e) {}
                    return;
                }
                try {
                    window.tmWarmCalendarTaskCacheIfStale?.({
                        refresh: true,
                        source: reason,
                        maxAgeMs: 8000,
                    });
                } catch (e) {}
            };
            try {
                const delayMs = runtimeMobile ? 1800 : 700;
                setTimeout(() => {
                    try {
                        if (typeof __tmScheduleIdleTask === 'function') {
                            __tmScheduleIdleTask(run, runtimeMobile ? 1800 : 900);
                            return;
                        }
                    } catch (e2) {}
                    run();
                }, delayMs);
            } catch (e) {
                window.tmWarmCalendarTaskCacheIfStale?.({
                    refresh: true,
                    source: reason,
                    maxAgeMs: 8000,
                });
            }
        };
        const buildTaskDateEventsFromTasks = (tasks, docsToGroup = new Map()) => {
            const filtered = Array.isArray(tasks) ? tasks : [];
            const groupMap = docsToGroup instanceof Map ? docsToGroup : new Map();
            const out = [];
            for (const t of filtered) {
                if (!t) continue;
                const id = String(t.id || '').trim();
                if (!id) continue;
                let done = !!t.done;
                try {
                    if (state.doneOverrides && Object.prototype.hasOwnProperty.call(state.doneOverrides, id)) {
                        done = !!state.doneOverrides[id];
                    } else {
                        const liveTask = __tmGetCalendarFlatTaskByIdSync(id);
                        if (liveTask) done = !!liveTask.done;
                    }
                } catch (e) {}
                const s0 = __tmNormalizeDateOnly(t?.startDate);
                const e0 = __tmNormalizeDateOnly(t?.completionTime);
                if (!s0 && !e0) continue;
                const milestoneRaw = t?.milestone;
                const isMilestone = typeof milestoneRaw === 'boolean'
                    ? milestoneRaw
                    : ['1', 'true'].includes(String(milestoneRaw || '').trim().toLowerCase());
                const hasBothDates = !!s0 && !!e0;
                const start = (isMilestone && hasBothDates) ? e0 : (s0 || e0);
                let end = e0 || s0 || start;
                if (start && end && start > end) end = start;
                const startTs = toTs(start);
                const endExKey = nextDay(end);
                const endExTs = toTs(endExKey);
                if (rangeStartTs && endExTs && endExTs <= rangeStartTs) continue;
                if (rangeEndTs && startTs && startTs >= rangeEndTs) continue;

                const title = __tmResolveCalendarTaskDisplayTitle(t, '(无标题)');
                const docId = String(t.root_id || '').trim();
                const gid = docId ? groupMap.get(docId) : '';
                const calendarId = gid ? `group:${gid}` : 'default';
                const taskDateColorAttrValue = typeof __tmReadTaskMetaAttrValue === 'function'
                    ? __tmReadTaskMetaAttrValue(t, 'taskDateColor')
                    : '';
                const taskDateColor = String(t?.taskDateColor || t?.task_date_color || t?.custom_task_date_color || taskDateColorAttrValue || t?.['custom-task-date-color'] || '').trim();
                const allDayBottomRaw = t?.allDayBottom ?? t?.custom_all_day_bottom ?? t?.customAllDayBottom;
                const allDayBottom = allDayBottomRaw === true
                    || allDayBottomRaw === 1
                    || ['1', 'true'].includes(String(allDayBottomRaw || '').trim().toLowerCase());
                out.push({
                    id,
                    title,
                    start,
                    endExclusive: endExKey || nextDay(start),
                    calendarId,
                    docId,
                    taskDateColor,
                    color: taskDateColor,
                    sourceStart: s0 || '',
                    sourceCompletion: e0 || '',
                    milestone: isMilestone,
                    sourceTaskId: String(t?.sourceTaskId || '').trim(),
                    recurringSourceTaskId: String(t?.recurringSourceTaskId || '').trim(),
                    recurringCompletedAt: String(t?.recurringCompletedAt || '').trim(),
                    isRecurringInstance: t?.isRecurringInstance === true,
                    isRecurringInstanceReadOnly: t?.isRecurringInstanceReadOnly === true,
                    allDayBottom,
                    done,
                });
            }
            return out;
        };
        if (!__tmShouldAllowCalendarTaskCacheFullLoad(opts)) {
            try {
                const cache = window.__tmCalendarAllTasksCache;
                const cachedTasks = Array.isArray(cache?.tasks) ? cache.tasks : [];
                const cacheAgeMs = Date.now() - (Number(cache?.ts) || 0);
                if (cachedTasks.length > 0) {
                    const events = buildTaskDateEventsFromTasks(cachedTasks, __tmGetCalendarDocsToGroupMapSync());
                    pushTaskDateQueryDiag('taskdate-inactive-cache', {
                        taskCount: cachedTasks.length,
                        eventCount: events.length,
                        cacheAgeMs,
                        forcedButInactive: forceFresh,
                        activeViewMode: String(state.viewMode || '').trim(),
                    });
                    return events;
                }
                const candidateMeta = __tmGetCalendarTaskCandidatesSync();
                const candidateTasks = Array.isArray(candidateMeta?.tasks) ? candidateMeta.tasks : [];
                if (candidateTasks.length > 0) {
                    const events = buildTaskDateEventsFromTasks(candidateTasks, candidateMeta?.docsToGroup);
                    pushTaskDateQueryDiag('taskdate-inactive-memory', {
                        taskCount: candidateTasks.length,
                        eventCount: events.length,
                        forcedButInactive: forceFresh,
                        activeViewMode: String(state.viewMode || '').trim(),
                    });
                    return events;
                }
            } catch (e) {}
            pushTaskDateQueryDiag('taskdate-skip-inactive-view', {
                forcedButInactive: forceFresh,
                activeViewMode: String(state.viewMode || '').trim(),
            });
            return [];
        }
        if (!forceFresh && opts.fastFirst !== false) {
            try {
                const cache = window.__tmCalendarAllTasksCache;
                const cachedTasks = Array.isArray(cache?.tasks) ? cache.tasks : [];
                const cacheAgeMs = Date.now() - (Number(cache?.ts) || 0);
                const fastMaxStaleMs = Number.isFinite(Number(opts.fastMaxStaleMs))
                    ? Math.max(8000, Math.round(Number(opts.fastMaxStaleMs)))
                    : 300000;
                if (cachedTasks.length > 0 && cacheAgeMs >= 0 && cacheAgeMs <= fastMaxStaleMs) {
                    const docsToGroup = __tmGetCalendarDocsToGroupMapSync();
                    const events = buildTaskDateEventsFromTasks(cachedTasks, docsToGroup);
                    if (cacheAgeMs > 8000) scheduleTaskDateCacheWarm('taskdate-stale-cache-first');
                    pushTaskDateQueryDiag(cacheAgeMs > 8000 ? 'taskdate-stale-cache' : 'taskdate-cache', {
                        taskCount: cachedTasks.length,
                        eventCount: events.length,
                        cacheAgeMs,
                        fastFirst: true,
                    });
                    return events;
                }
                const candidateMeta = __tmGetCalendarTaskCandidatesSync();
                const candidateTasks = Array.isArray(candidateMeta?.tasks) ? candidateMeta.tasks : [];
                if (candidateTasks.length > 0) {
                    const events = buildTaskDateEventsFromTasks(candidateTasks, candidateMeta?.docsToGroup);
                    scheduleTaskDateCacheWarm('taskdate-memory-first');
                    pushTaskDateQueryDiag('taskdate-memory', {
                        taskCount: candidateTasks.length,
                        eventCount: events.length,
                        cacheAgeMs: Number.isFinite(cacheAgeMs) ? cacheAgeMs : 0,
                        fastFirst: true,
                    });
                    return events;
                }
            } catch (e) {}
        }

        const getDocsToGroupMap = async () => {
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
            if (prev && prev.key === key && prev.map instanceof Map) return prev.map;

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
            return map;
        };

        let docsToGroup = new Map();
        try { docsToGroup = await getDocsToGroupMap(); } catch (e) {}

        let filtered = [];
        try { filtered = await __tmLoadAllTasksForCalendarCache({ ...opts, forceFresh, maxAgeMs: 8000 }); } catch (e) { filtered = []; }
        const out = buildTaskDateEventsFromTasks(filtered, docsToGroup);
        pushTaskDateQueryDiag('taskdate-full', {
            taskCount: filtered.length,
            eventCount: out.length,
            fastFirst: false,
        });
        return out;
    };

    window.tmRenderCalendarTaskTableHtml = function() {
        const originalOrder = SettingsStore.data.columnOrder;
        const originalWidths = SettingsStore.data.columnWidths;
        const originalTableAvailableWidth = state.tableAvailableWidth;
        const originalFilteredTasks = state.filteredTasks;
        let patchedFilteredTasks = false;
        try {
            // Ensure calendarColumnWidths is initialized with defaults if missing or empty
            if (!SettingsStore.data.calendarColumnWidths || Object.keys(SettingsStore.data.calendarColumnWidths).length === 0) {
                SettingsStore.data.calendarColumnWidths = { content: 140, tomatoSummary: 112 };
            }
            if (!(Array.isArray(state.filteredTasks) && state.filteredTasks.length > 0)) {
                const fallbackTasks = __tmGetCalendarTaskCandidatesSync().tasks;
                if (Array.isArray(fallbackTasks) && fallbackTasks.length > 0) {
                    state.filteredTasks = fallbackTasks;
                    patchedFilteredTasks = true;
                } else {
                    try { window.tmWarmCalendarTaskCacheIfStale?.({ refresh: true }); } catch (e) {}
                }
            }

            SettingsStore.data.columnOrder = ['content', 'tomatoSummary'];
            SettingsStore.data.columnWidths = SettingsStore.data.calendarColumnWidths;

            const colOrder = SettingsStore.data.columnOrder;
            const widths = SettingsStore.data.columnWidths || {};
            const tableFillColumns = SettingsStore.data.kanbanFillColumns === true;
            const tableAvailableWidth = tableFillColumns ? (() => {
                const values = [];
                try {
                    const el = state.modal?.querySelector?.('.tm-body.tm-body--calendar');
                    if (el) values.push(Number(el.clientWidth) || 0);
                } catch (e) {}
                try {
                    const root = __tmGetMountRoot?.();
                    if (root instanceof Element && root !== document.body && root !== document.documentElement) {
                        values.push(Number(root.clientWidth) || 0);
                    }
                } catch (e) {}
                try {
                    const vw = Number(window.innerWidth || document.documentElement?.clientWidth || 0);
                    if (vw > 0) values.push(Math.max(0, vw - 48));
                } catch (e) {}
                return values.find((n) => Number.isFinite(n) && n > 0) || 0;
            })() : 0;
            state.tableAvailableWidth = tableAvailableWidth;
            const tableLayout = __tmGetTableWidthLayout(colOrder, widths, tableAvailableWidth);
            const headers = {
                content: `<th data-col="content" style="${tableLayout.cellStyle('content', 'white-space: nowrap; overflow: hidden;')}">任务内容<span class="tm-col-resize" onmousedown="startColResize(event, 'content')"></span></th>`,
                tomatoSummary: `<th data-col="tomatoSummary" style="${tableLayout.cellStyle('tomatoSummary', 'text-align: center; white-space: nowrap; overflow: hidden;')}">专注<span class="tm-col-resize" onmousedown="startColResize(event, 'tomatoSummary')"></span></th>`,
            };
            const thead = colOrder.map((col) => headers[col] || __tmBuildTableHeaderCellHtml(col, tableLayout)).join('');
            return `
                <div class="tm-calendar-task-list" style="height:100%; display:flex; flex-direction:column;">
                    <table class="tm-table" id="tmTaskTable" data-tm-table="calendar" style="${tableLayout.tableStyle}">
                        <thead><tr>${thead}</tr></thead>
                        <tbody>${renderTaskList()}</tbody>
                    </table>
                </div>
            `;
        } catch (e) {
            try { console.error('[tmRenderCalendarTaskTableHtml] render failed', e); } catch (e2) {}
            try { return __tmBuildCalendarTaskTableFallbackHtml(); } catch (e2) {}
            return '';
        } finally {
            if (patchedFilteredTasks) state.filteredTasks = originalFilteredTasks;
            state.tableAvailableWidth = originalTableAvailableWidth;
            SettingsStore.data.columnOrder = originalOrder;
            SettingsStore.data.columnWidths = originalWidths;
        }
    };

    window.tmCalendarApplyCollapseDom = function() {
        try { __tmApplyVisibilityFromState(state.modal); } catch (e) {}
    };

    window.tmCalendarGetTaskDragMeta = function(id) {
        const tid = String(id || '').trim();
        if (!tid) return null;
        const t = __tmGetCalendarFlatTaskByIdSync(tid);
        if (!t) return null;

        const buildDocsToGroupKey = () => {
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
            return parts.join('|');
        };

        const key = buildDocsToGroupKey();
        let docsToGroup = null;
        const cached = window.__tmCalendarDocsToGroupCache;
        if (cached && cached.key === key && cached.map instanceof Map) {
            docsToGroup = cached.map;
        } else {
            docsToGroup = new Map();
            try {
                const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
                groups.forEach((g) => {
                    const gid = String(g?.id || '').trim();
                    const docs = __tmNormalizeGroupDocEntries(g);
                    if (!gid) return;
                    docs.forEach((d) => {
                        const did = String((typeof d === 'object' ? d?.id : d) || '').trim();
                        if (!did) return;
                        if (!docsToGroup.has(did)) docsToGroup.set(did, gid);
                    });
                });
            } catch (e) {}
            try { Promise.resolve().then(() => window.tmCalendarWarmDocsToGroupCache?.()).catch(() => null); } catch (e) {}
        }
        const docId = String(t.root_id || t.docId || '').trim();
        let gid = docId ? String(docsToGroup.get(docId) || '').trim() : '';
        if (!gid && docId) {
            try {
                const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
                for (const g of groups) {
                    const gId = String(g?.id || '').trim();
                    if (!gId) continue;
                    const docs = __tmNormalizeGroupDocEntries(g);
                    const hit = docs.some((d) => String((typeof d === 'object' ? d?.id : d) || '').trim() === docId);
                    if (hit) {
                        gid = gId;
                        break;
                    }
                }
            } catch (e) {}
        }
        const calendarId = gid ? `group:${gid}` : 'default';

        const mins = __tmParseDurationMinutes(t?.duration);
        const durationMin = (Number.isFinite(Number(mins)) && Number(mins) > 0) ? Math.round(Number(mins)) : 60;
        const title = __tmResolveCalendarTaskDisplayTitle(t, '(无标题)');
        return {
            title,
            durationMin,
            calendarId,
            priority: String(t.priority || '').trim(),
            startDate: String(t.startDate || '').trim(),
            completionTime: String(t.completionTime || '').trim(),
            allDayBottom: t.allDayBottom === true || t.allDayBottom === '1' || String(t.custom_all_day_bottom || '').trim() === '1',
        };
    };

    function __tmCalendarFloatingDragDetach() {
        const cleanup = state.__tmCalendarFloatingDragCleanup;
        if (typeof cleanup !== 'function') return;
        try { cleanup(); } catch (e) {}
        state.__tmCalendarFloatingDragCleanup = null;
    }

    function __tmShouldSuppressCalendarFloatingMiniPanel() {
        const viewMode = String(state.viewMode || '').trim();
        if (viewMode === 'whiteboard') return true;
        if (viewMode !== 'calendar') return false;
        return __tmIsRuntimeMobileClient() || __tmHostUsesMobileUI();
    }

    function __tmIsWhiteboardFloatingMiniSource(el) {
        const node = el instanceof Element ? el : null;
        if (!node) return false;
        return !!node.closest?.([
            '.tm-whiteboard-pool-item',
            '.tm-whiteboard-pool-h2',
            '.tm-whiteboard-node',
            '.tm-whiteboard-stream-task-head',
            '.tm-whiteboard-stream-task-node',
            '.tm-whiteboard-doc-body',
            '.tm-whiteboard-sidebar',
            '.tm-whiteboard-layout',
            '.tm-body--whiteboard',
        ].join(','));
    }

    function __tmCalendarFloatingDragStart(taskId, meta, ev, opts = {}) {
        if (__tmShouldSuppressCalendarFloatingMiniPanel()) return false;
        const sourceEl = ev?.target instanceof Element
            ? ev.target
            : (ev?.currentTarget instanceof Element ? ev.currentTarget : null);
        const currentEl = ev?.currentTarget instanceof Element ? ev.currentTarget : null;
        if (__tmIsWhiteboardFloatingMiniSource(sourceEl) || __tmIsWhiteboardFloatingMiniSource(currentEl)) return false;
        if (state.whiteboardPoolDragStart || state.whiteboardNodeDrag) return false;
        const id = String(taskId || '').trim();
        if (!id) return false;
        const calendar = globalThis.__tmCalendar;
        if (!calendar || typeof calendar.showFloatingMiniCalendar !== 'function') return false;
        const options = (opts && typeof opts === 'object') ? opts : {};
        const nextMeta = (meta && typeof meta === 'object') ? meta : (
            (typeof window.tmCalendarGetTaskDragMeta === 'function')
                ? window.tmCalendarGetTaskDragMeta(id)
                : null
        );
        let shown = false;
        try {
            shown = !!calendar.showFloatingMiniCalendar({
                taskId: id,
                meta: nextMeta,
                dragPayload: nextMeta,
                clientX: Number(ev?.clientX),
                clientY: Number(ev?.clientY),
                mode: options.mode,
                containerRect: options.containerRect,
            });
        } catch (e) {}
        if (!shown) return false;
        if (options.html5 === false) return true;
        __tmCalendarFloatingDragDetach();
        const onDocDragOver = (e2) => {
            try {
                calendar.updateFloatingMiniCalendarDrag?.({
                    clientX: Number(e2?.clientX),
                    clientY: Number(e2?.clientY),
                    target: e2?.target,
                });
            } catch (e3) {}
        };
        const onDocDragEnd = () => {
            __tmCalendarFloatingDragEnd();
        };
        try { globalThis.__tmRuntimeEvents?.on?.(document, 'dragover', onDocDragOver, true); } catch (e) {}
        try { globalThis.__tmRuntimeEvents?.on?.(document, 'dragend', onDocDragEnd, true); } catch (e) {}
        state.__tmCalendarFloatingDragCleanup = () => {
            try { globalThis.__tmRuntimeEvents?.off?.(document, 'dragover', onDocDragOver, true); } catch (e2) {}
            try { globalThis.__tmRuntimeEvents?.off?.(document, 'dragend', onDocDragEnd, true); } catch (e2) {}
        };
        return true;
    }

    function __tmCalendarFloatingDragMove(ev, opts = {}) {
        if (__tmShouldSuppressCalendarFloatingMiniPanel()) return null;
        const calendar = globalThis.__tmCalendar;
        if (!calendar || typeof calendar.updateFloatingMiniCalendarDrag !== 'function') return null;
        const options = (opts && typeof opts === 'object') ? opts : {};
        try {
            return calendar.updateFloatingMiniCalendarDrag({
                clientX: Number(ev?.clientX),
                clientY: Number(ev?.clientY),
                target: ev?.target,
                mode: options.mode,
            });
        } catch (e) {
            return null;
        }
    }

    function __tmCalendarFloatingDragEnd() {
        __tmCalendarFloatingDragDetach();
        try { globalThis.__tmCalendar?.hideFloatingMiniCalendar?.(); } catch (e) {}
    }

    window.tmCalendarGetDraggingTaskId = function() {
        return String(state.draggingTaskId || '').trim();
    };

    window.tmIsTaskDone = function(id) {
        const tid = String(id || '').trim();
        if (!tid) return false;
        try {
            if (state.doneOverrides && Object.prototype.hasOwnProperty.call(state.doneOverrides, tid)) {
                return !!state.doneOverrides[tid];
            }
        } catch (e) {}
        const t = __tmGetCalendarFlatTaskByIdSync(tid);
        if (t) return !!t.done;
        try {
            const cachedTasks = window.__tmCalendarAllTasksCache?.tasks;
            if (Array.isArray(cachedTasks)) {
                const cached = cachedTasks.find((item) => String(item?.id || '').trim() === tid);
                if (cached) return !!cached.done;
            }
        } catch (e) {}
        return false;
    };

    async function __tmSyncCalendarTaskDatePatchAfterUpdate(taskId, patch = {}, options = {}) {
        const tid = String(taskId || '').trim();
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        const opts = (options && typeof options === 'object') ? options : {};
        if (!tid || !Object.keys(nextPatch).length || opts.refreshCalendar === false) return false;
        const calApi = globalThis.__tmCalendar;
        if (!calApi) return false;
        const reason = String(opts.reason || opts.source || 'task-date-update').trim() || 'task-date-update';
        try {
            try { window.__tmCalendarAllTasksCache = null; } catch (e) {}
            try { __tmInvalidateCalendarTaskDateEventsCache(); } catch (e) {}
            if (typeof calApi.syncTaskDatePatchInPlace === 'function') {
                const result = calApi.syncTaskDatePatchInPlace(tid, nextPatch, { reason });
                if (result?.needsMainRefresh || result?.needsSideRefresh) {
                    calApi.requestRefresh?.({
                        reason,
                        main: result.needsMainRefresh === true,
                        side: result.needsSideRefresh === true,
                        flushTaskPanel: false,
                        hard: opts.hard === true,
                    });
                }
                return result?.touched === true;
            }
            if (typeof calApi.syncTaskDateInPlace === 'function') {
                const summary = await calApi.syncTaskDateInPlace(tid, { main: true, side: true });
                if (summary?.needsMainRefresh || summary?.needsSideRefresh) {
                    calApi.requestRefresh?.({
                        reason,
                        main: summary.needsMainRefresh === true,
                        side: summary.needsSideRefresh === true,
                        flushTaskPanel: false,
                        hard: opts.hard === true,
                    });
                }
                return summary?.touched === true;
            }
        } catch (e) {}
        return false;
    }

    window.tmUpdateTaskDates = async function(taskId, patch = {}, options = {}) {
        const requestedId = String(taskId || '').trim();
        if (!requestedId) throw new Error('缺少任务 ID');
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        const opts = (options && typeof options === 'object') ? options : {};
        const hasStartDate = Object.prototype.hasOwnProperty.call(nextPatch, 'startDate');
        const hasCompletionTime = Object.prototype.hasOwnProperty.call(nextPatch, 'completionTime');
        const hasTaskDateColor = Object.prototype.hasOwnProperty.call(nextPatch, 'taskDateColor')
            || Object.prototype.hasOwnProperty.call(nextPatch, 'color');
        if (!hasStartDate && !hasCompletionTime && !hasTaskDateColor) throw new Error('缺少日期字段');
        let resolvedId = requestedId;
        let task = __tmGetCalendarFlatTaskByIdSync(requestedId);
        if (!task) {
            try {
                const nextResolved = await __tmResolveTaskIdFromAnyBlockId(requestedId);
                if (nextResolved) resolvedId = String(nextResolved || '').trim() || requestedId;
            } catch (e) {}
        }
        if (!task && resolvedId && resolvedId !== requestedId) {
            task = __tmGetCalendarFlatTaskByIdSync(resolvedId);
        }
        if (!task) {
            try { task = await __tmEnsureTaskInStateById(resolvedId || requestedId); } catch (e) { task = null; }
        }
        if (!task && resolvedId && resolvedId !== requestedId) {
            try { task = await __tmBuildTaskLikeFromBlockId(resolvedId); } catch (e) { task = null; }
        }
        if (!task) {
            try { task = await __tmBuildTaskLikeFromBlockId(requestedId); } catch (e) { task = null; }
        }
        const persistId = String(task?.id || resolvedId || requestedId).trim();
        if (!persistId) {
            throw new Error('未找到任务');
        }

        const normalizeDate = (value) => {
            const raw = String(value || '').trim();
            if (!raw) return '';
            try { return __tmNormalizeDateOnly(raw); } catch (e) { return raw; }
        };

        const prevStart = String(task?.startDate || '').trim();
        const prevEnd = String(task?.completionTime || '').trim();
        const taskDateColorAttrValue = typeof __tmReadTaskMetaAttrValue === 'function'
            ? __tmReadTaskMetaAttrValue(task, 'taskDateColor')
            : '';
        const prevColor = String(task?.taskDateColor || task?.task_date_color || task?.custom_task_date_color || taskDateColorAttrValue || task?.['custom-task-date-color'] || '').trim();
        let nextStart = hasStartDate ? normalizeDate(nextPatch.startDate) : prevStart;
        let nextEnd = hasCompletionTime ? normalizeDate(nextPatch.completionTime) : prevEnd;
        const nextColor = hasTaskDateColor
            ? String((Object.prototype.hasOwnProperty.call(nextPatch, 'taskDateColor') ? nextPatch.taskDateColor : nextPatch.color) ?? '').trim()
            : prevColor;

        if (nextStart && nextEnd && nextStart > nextEnd) {
            if (hasStartDate && hasCompletionTime) nextEnd = nextStart;
            else if (hasStartDate) nextEnd = nextStart;
            else nextStart = nextEnd;
        }

        const shouldPersistStartDate = hasStartDate || nextStart !== prevStart;
        const shouldPersistCompletionTime = hasCompletionTime || nextEnd !== prevEnd;
        const attrPatch = {};
        if (shouldPersistStartDate) attrPatch.startDate = nextStart;
        if (shouldPersistCompletionTime) attrPatch.completionTime = nextEnd;
        if (hasTaskDateColor) attrPatch.taskDateColor = nextColor;
        const repeatRule = __tmNormalizeTaskRepeatRule(task?.repeatRule || task?.repeat_rule || '', {
            startDate: nextStart || prevStart,
            completionTime: nextEnd || prevEnd,
        });
        if ((shouldPersistStartDate || shouldPersistCompletionTime) && repeatRule.enabled) {
            attrPatch.repeatState = __tmNormalizeTaskRepeatState({
                ...(task?.repeatState && typeof task.repeatState === 'object' ? task.repeatState : {}),
                lastInstanceStart: nextStart,
                lastInstanceDue: nextEnd,
            });
        }
        const refreshReason = String(opts.source || 'calendar-dates').trim() || 'calendar-dates';
        const taskDocId = String(task?.root_id || task?.docId || '').trim();
        let attrTargetId = String(opts.attrTargetId || '').trim();
        if (!attrTargetId) {
            try {
                if (typeof __tmResolveStableTaskAttrHostId === 'function') {
                    attrTargetId = String(await __tmResolveStableTaskAttrHostId(persistId, task?.parent_id || task?.parentId || '', task) || '').trim();
                }
            } catch (e) {
                attrTargetId = '';
            }
        }
        if (!attrTargetId) {
            try {
                if (typeof __tmGetTaskAttrHostId === 'function') {
                    attrTargetId = String(__tmGetTaskAttrHostId(task) || '').trim();
                }
            } catch (e) {
                attrTargetId = '';
            }
        }
        if (!attrTargetId) {
            try {
                if (typeof __tmResolveTaskAttrHostIdFromAnyBlockId === 'function') {
                    attrTargetId = String(await __tmResolveTaskAttrHostIdFromAnyBlockId(persistId) || '').trim();
                }
            } catch (e) {
                attrTargetId = '';
            }
        }
        if (!attrTargetId) attrTargetId = persistId;
        const skipSnapshotPersist = opts.skipSnapshotPersist === true;
        const skipTaskIndexPersist = opts.skipTaskIndexPersist === true;
        const viewPatch = {};
        if (shouldPersistStartDate) viewPatch.startDate = nextStart;
        if (shouldPersistCompletionTime) viewPatch.completionTime = nextEnd;
        if (hasTaskDateColor) viewPatch.taskDateColor = nextColor;
        if (opts.background === true) {
            try { __tmPatchCalendarAllTasksCacheTask(persistId, attrPatch); } catch (e) {}
            try { __tmApplyTaskFieldPatchToLocalMirrors?.(persistId, attrPatch); } catch (e) {}
            try {
                __tmMarkLocalTaskPatchWatermark?.(persistId, attrPatch, { source: refreshReason });
            } catch (e) {}
            try {
                if (taskDocId) __tmInvalidateTasksQueryCacheByDocId?.(taskDocId);
                else __tmInvalidateAllSqlCaches?.();
            } catch (e) {}
        }
        const persistSkipFlush = opts.skipFlush === true;
        let needsProjectionRefresh = false;
        try {
            needsProjectionRefresh = __tmDoesPatchNeedProjectionRefresh(persistId, viewPatch, {
                forceProjectionRefresh: opts.forceProjectionRefresh === true,
            });
        } catch (e) {
            needsProjectionRefresh = false;
        }
        const inversePatch = {};
        if (shouldPersistStartDate) inversePatch.startDate = prevStart;
        if (shouldPersistCompletionTime) inversePatch.completionTime = prevEnd;
        if (hasTaskDateColor) inversePatch.taskDateColor = prevColor;
        const persistWait = opts.wait === true;
        const recordBackgroundUndo = opts.background === true && opts.recordUndo !== false;
        const persistPromise = __tmApplyTaskMetaPatchWithUndo(persistId, attrPatch, {
                source: refreshReason,
                label: __tmBuildUndoLabelFromMetaPatch(attrPatch, '日期'),
                refresh: false,
                refreshCalendar: false,
                withFilters: false,
                skipNoopCheck: opts.skipNoopCheck === true || opts.background === true,
                hard: opts.hard === true,
                broadcast: opts.broadcast !== false,
                queued: true,
                background: opts.background === true,
                wait: persistWait,
                skipFlush: persistSkipFlush,
                docId: taskDocId,
                skipSnapshotPersist,
                skipTaskIndexPersist,
                skipInteractionGate: opts.background === true || opts.skipInteractionGate === true,
                attrTargetId,
                mirrorTaskAttrs: opts.mirrorTaskAttrs !== false,
                syncMirrorTaskAttrs: opts.syncMirrorTaskAttrs === true,
                recordUndo: recordBackgroundUndo ? false : opts.recordUndo !== false,
                renderOptimistic: opts.renderOptimistic !== false,
});
        if (recordBackgroundUndo) {
            try {
                if (!__tmUndoState?.applying && typeof __tmPushUndoRecord === 'function') {
                    __tmPushUndoRecord({
                        type: 'attrPatch',
                        taskId: persistId,
                        requestedTaskId: requestedId,
                        attrTargetId,
                        patch: attrPatch,
                        inversePatch,
                        label: __tmBuildUndoLabelFromMetaPatch(attrPatch, '日期'),
                        source: refreshReason,
                    });
                }
            } catch (e) {}
        }
        const refreshViaQueuedOptimisticPatch = opts.renderOptimistic !== false && opts.background !== true;
        if ((shouldPersistStartDate || shouldPersistCompletionTime) && opts.refresh !== false && !refreshViaQueuedOptimisticPatch) {
            try {
                __tmRefreshTaskTimeAcrossViews(persistId, {
                    patch: viewPatch,
                    withFilters: needsProjectionRefresh ? true : false,
                    reason: refreshReason,
                });
            } catch (e) {}
            try {
                const currentViewMode = String(state.viewMode || '').trim();
                if (needsProjectionRefresh) {
                    if (currentViewMode === 'list') {
                        __tmScheduleListProjectionRefresh({
                            mode: 'current',
                            withFilters: true,
                            reason: refreshReason,
                        }, opts.immediateProjectionRefresh === true
                            ? { immediate: true }
                            : __tmBuildListProjectionRefreshScheduleOptions(viewPatch, {
                                reason: refreshReason,
                            }));
                    } else if (currentViewMode === 'kanban' && opts.background === true) {
                        try {
                            const delayMs = 280;
                            const pending = (state.__tmKanbanDateProjectionRefreshPending && typeof state.__tmKanbanDateProjectionRefreshPending === 'object')
                                ? state.__tmKanbanDateProjectionRefreshPending
                                : { taskIds: [] };
                            const ids = new Set(Array.isArray(pending.taskIds) ? pending.taskIds : []);
                            ids.add(persistId);
                            state.__tmKanbanDateProjectionRefreshPending = {
                                mode: 'current',
                                withFilters: true,
                                reason: refreshReason,
                                taskIds: Array.from(ids),
                            };
                            if (state.__tmKanbanDateProjectionRefreshTimer) {
                                try { clearTimeout(state.__tmKanbanDateProjectionRefreshTimer); } catch (e2) {}
                            }
                            const flushDelayedKanbanDateProjection = () => {
                                const interactionWait = (typeof __tmGetHighPriorityInteractionWaitMs === 'function')
                                    ? __tmGetHighPriorityInteractionWaitMs(48)
                                    : 0;
                                if (interactionWait > 0) {
                                    state.__tmKanbanDateProjectionRefreshTimer = setTimeout(flushDelayedKanbanDateProjection, interactionWait);
                                    return;
                                }
                                state.__tmKanbanDateProjectionRefreshTimer = 0;
                                const next = state.__tmKanbanDateProjectionRefreshPending;
                                state.__tmKanbanDateProjectionRefreshPending = null;
                                if (!next) return;
                                try {
                                    const refreshDetail = {
                                        ...next,
                                        reason: String(next.reason || 'kanban-date-projection-delayed').trim() || 'kanban-date-projection-delayed',
                                    };
                                    const scheduleRefresh = () => {
                                        try { __tmScheduleViewRefresh(refreshDetail); } catch (e4) {}
                                    };
                                    try {
                                        __tmScheduleIdleTask(scheduleRefresh, 900);
                                    } catch (e4) {
                                        try { setTimeout(scheduleRefresh, 360); } catch (e5) {}
                                    }
                                } catch (e3) {}
                            };
                            state.__tmKanbanDateProjectionRefreshTimer = setTimeout(flushDelayedKanbanDateProjection, delayMs);
                        } catch (e) {}
                    } else if (currentViewMode && currentViewMode !== 'calendar') {
                        __tmScheduleViewRefresh({
                            mode: 'current',
                            withFilters: true,
                            reason: refreshReason,
                        });
                    }
                }
            } catch (e) {}
        }
        const resultPatch = {
            id: persistId,
            startDate: nextStart,
            completionTime: nextEnd,
            taskDateColor: nextColor,
            color: nextColor,
        };
        const finishAfterPersist = async () => {
            try {
                await persistPromise;
            } catch (error) {
                throw error;
            }
            try {
                const recordReschedule = globalThis.__tmRecordTaskProcrastinationDateReschedule;
                if (hasCompletionTime && typeof recordReschedule === 'function') {
                    const recorded = recordReschedule(task, { completionTime: nextEnd }, { completionTime: prevEnd }, {
                        taskId: persistId,
                        docId: String(task?.root_id || task?.docId || '').trim(),
                        source: refreshReason,
                    });
                    if (recorded && state.homepageOpen) {
                        try { __tmScheduleHomepageRefresh('procrastination-task-reschedule'); } catch (e2) {}
                    }
                }
            } catch (e) {}
            try {
                const calendarPatch = {};
                if (shouldPersistStartDate || shouldPersistCompletionTime) {
                    calendarPatch.startDate = nextStart;
                    calendarPatch.completionTime = nextEnd;
                }
                if (hasTaskDateColor) calendarPatch.taskDateColor = nextColor;
                if (Object.keys(calendarPatch).length > 0) {
                    await __tmSyncCalendarTaskDatePatchAfterUpdate(persistId, calendarPatch, {
                        source: refreshReason,
                        refreshCalendar: opts.refreshCalendar !== false,
                        hard: opts.hard === true,
                    });
                }
            } catch (error) {
            }
            return resultPatch;
        };
        if (opts.background === true && !persistWait) {
            finishAfterPersist().then(() => {
                return null;
            }).catch(() => null);
            return resultPatch;
        }
        await finishAfterPersist();
        return resultPatch;
    };
