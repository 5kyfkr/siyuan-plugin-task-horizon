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
        return globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid] || null;
    }

    function __tmGetCalendarFlatTasksSync() {
        const values = (state.flatTasks && typeof state.flatTasks === 'object')
            ? Object.values(state.flatTasks).map((task) => {
                const tid = String(task?.id || '').trim();
                return __tmGetCalendarFlatTaskByIdSync(tid) || task;
            })
            : [];
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

    let __tmCalendarTaskCacheWarmPromise = null;

    async function __tmLoadAllTasksForCalendarCache(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const limit = Number.isFinite(Number(SettingsStore.data.queryLimit)) ? Number(SettingsStore.data.queryLimit) : 2000;
        const allDocIds = await resolveDocIdsFromGroups({
            groupId: 'all',
            includeQuickAddDoc: true,
            forceRefreshScope: opts.forceRefreshScope === true,
        });
        const docKey = allDocIds.slice().sort().join(',');
        const key = `${limit}|${docKey}`;
        const maxAgeMs = Number.isFinite(Number(opts.maxAgeMs)) ? Math.max(0, Math.floor(Number(opts.maxAgeMs))) : 8000;
        const prev = window.__tmCalendarAllTasksCache;
        if (!opts.force && prev && prev.key === key && Array.isArray(prev.tasks) && (Date.now() - (Number(prev.ts) || 0) < maxAgeMs)) {
            return prev.tasks;
        }
        if (!allDocIds.length) {
            window.__tmCalendarAllTasksCache = { key, ts: Date.now(), tasks: [] };
            return [];
        }
        try { await MetaStore.load?.(); } catch (e) {}
        const res = await API.getTasksByDocuments(allDocIds, limit, { doneOnly: false });
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
            out.push(task);
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
        if (__tmCalendarTaskCacheWarmPromise) return __tmCalendarTaskCacheWarmPromise;
        const opts = (options && typeof options === 'object') ? options : {};
        const run = Promise.resolve().then(async () => {
            try { await window.tmCalendarWarmDocsToGroupCache?.(); } catch (e) {}
            const tasks = await __tmLoadAllTasksForCalendarCache(opts);
            if (opts.refresh !== false) {
                try { globalThis.__tmCalendar?.refreshInPlace?.({ hard: false }); } catch (e) {}
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
            const title = String(task.content || '').trim() || '(无标题)';
            const docId = String(task.root_id || '').trim();
            const gid = docId ? docsToGroup.get(docId) : '';
            const calendarId = gid ? `group:${gid}` : 'default';
            out.push({
                id,
                task,
                title,
                duration: String(task?.duration || '').trim(),
                spent: __tmGetTaskSpentDisplay(task),
                calendarId,
                depth: getDepth(id),
            });
            if (out.length >= max) break;
        }
        return out;
    }

    function __tmBuildCalendarTaskTableFallbackHtml() {
        const colOrder = Array.isArray(SettingsStore.data.columnOrder) && SettingsStore.data.columnOrder.length
            ? SettingsStore.data.columnOrder
            : ['content', 'duration', 'spent'];
        const widths = SettingsStore.data.columnWidths || SettingsStore.data.calendarColumnWidths || {};
        const tableLayout = __tmGetTableWidthLayout(colOrder, widths, state.tableAvailableWidth);
        const headers = {
            content: `<th data-col="content" style="${tableLayout.cellStyle('content', 'white-space: nowrap; overflow: hidden;')}">任务内容<span class="tm-col-resize" onmousedown="startColResize(event, 'content')"></span></th>`,
            duration: `<th data-col="duration" style="${tableLayout.cellStyle('duration', 'white-space: nowrap; overflow: hidden;')}">时长<span class="tm-col-resize" onmousedown="startColResize(event, 'duration')"></span></th>`,
            spent: `<th data-col="spent" style="${tableLayout.cellStyle('spent', 'text-align: center; white-space: nowrap; overflow: hidden;')}">耗时<span class="tm-col-resize" onmousedown="startColResize(event, 'spent')"></span></th>`,
        };
        const rows = __tmBuildCalendarTaskRowsSync(300);
        const tbody = rows.length
            ? rows.map((item) => {
                let contentHtml = '';
                try {
                    contentHtml = API.renderTaskContentHtml(item.task?.markdown, item.title);
                } catch (e) {
                    contentHtml = esc(item.title);
                }
                const depthPad = 8 + Math.min(6, Math.max(0, Number(item.depth) || 0)) * 14;
                return `
                    <tr data-id="${esc(item.id)}" data-calendar-id="${esc(item.calendarId)}">
                        <td style="${tableLayout.cellStyle('content')}">
                            <div class="tm-task-cell" style="padding-left:${depthPad}px;">
                                <span class="tm-task-text">
                                    <span class="tm-task-content-clickable"${__tmBuildTooltipAttrs(String(item.title || '').trim() || '(无内容)', { side: 'bottom', ariaLabel: false })}>${contentHtml}</span>
                                </span>
                            </div>
                        </td>
                        <td class="tm-task-meta-cell" style="${tableLayout.cellStyle('duration')}">${esc(item.duration || '')}</td>
                        <td class="tm-task-meta-cell" style="${tableLayout.cellStyle('spent', 'text-align: center; font-variant-numeric: inherit;')}">${esc(item.spent || '')}</td>
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
            const title = String(t.content || '').trim();
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
            const title = String(t.content || '').trim() || '(无标题)';
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

    window.tmQueryCalendarTaskDateEvents = async function(rangeStart, rangeEnd) {
        const startKey = __tmNormalizeDateOnly(rangeStart);
        const endKey = __tmNormalizeDateOnly(rangeEnd);
        const toTs = (k) => {
            const kk = String(k || '').trim();
            if (!kk) return 0;
            const d = new Date(`${kk}T12:00:00`);
            return Number.isNaN(d.getTime()) ? 0 : d.getTime();
        };
        const rangeStartTs = toTs(startKey) || 0;
        const rangeEndTs = toTs(endKey) || 0;

        const getAllDocIdsForCalendar = async () => {
            const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
            const legacyIds = Array.isArray(SettingsStore.data.selectedDocIds) ? SettingsStore.data.selectedDocIds : [];
            const quickAddDocId = String(SettingsStore.data.newTaskDocId || '').trim();
            const targetDocs = [];
            legacyIds.forEach((id) => {
                const did = String(id || '').trim();
                if (did) targetDocs.push({ id: did, kind: 'doc', recursive: false });
            });
            groups.forEach((g) => {
                targetDocs.push(...__tmGetGroupSourceEntries(g));
            });
            const finalIds = new Set();
            if (quickAddDocId && quickAddDocId !== '__dailyNote__') finalIds.add(quickAddDocId);
            await Promise.all(targetDocs.map((doc) => __tmExpandSourceEntryDocIds(doc, (sid) => {
                const s = String(sid || '').trim();
                if (s) finalIds.add(s);
            })));
            return Array.from(finalIds);
        };

        const getAllTasksForCalendar = async () => {
            const limit = Number.isFinite(Number(SettingsStore.data.queryLimit)) ? Number(SettingsStore.data.queryLimit) : 2000;
            const allDocIds = await getAllDocIdsForCalendar();
            const docKey = allDocIds.slice().sort().join(',');
            const key = `${limit}|${docKey}`;
            const prev = window.__tmCalendarAllTasksCache;
            if (prev && prev.key === key && Array.isArray(prev.tasks) && (Date.now() - (Number(prev.ts) || 0) < 8000)) return prev.tasks;
            try { await MetaStore.load?.(); } catch (e) {}
            const res = await API.getTasksByDocuments(allDocIds, limit, { doneOnly: false });
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
                task.done = parsedDone; // 以文档中的真实复选框状态为准
                try { normalizeTaskFields(task, task.docName || '未命名文档'); } catch (e) {}
                out.push(task);
            }
            window.__tmCalendarAllTasksCache = { key, ts: Date.now(), tasks: out };
            return out;
        };

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

        const nextDay = (k) => {
            const ts = toTs(k);
            if (!ts) return '';
            const d = new Date(ts + 86400000);
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        };

        let filtered = [];
        try { filtered = await getAllTasksForCalendar(); } catch (e) { filtered = []; }
        const out = [];
        for (const t of filtered) {
            if (!t) continue;
            if (t.done) continue;
            const id = String(t.id || '').trim();
            if (!id) continue;
            const s0 = __tmNormalizeDateOnly(t?.startDate);
            const e0 = __tmNormalizeDateOnly(t?.completionTime);
            if (!s0 && !e0) continue;
            const milestoneRaw = t?.milestone;
            const isMilestone = typeof milestoneRaw === 'boolean'
                ? milestoneRaw
                : ['1', 'true'].includes(String(milestoneRaw || '').trim().toLowerCase());
            const hasBothDates = !!s0 && !!e0;
            const start = (isMilestone && hasBothDates) ? e0 : (s0 || e0);
            const end = e0 || s0 || start;
            const startTs = toTs(start);
            const endExKey = nextDay(end);
            const endExTs = toTs(endExKey);
            if (rangeStartTs && endExTs && endExTs <= rangeStartTs) continue;
            if (rangeEndTs && startTs && startTs >= rangeEndTs) continue;

            const title = String(t.content || '').trim() || '(无标题)';
            const docId = String(t.root_id || '').trim();
            const gid = docId ? docsToGroup.get(docId) : '';
            const calendarId = gid ? `group:${gid}` : 'default';
            out.push({
                id,
                title,
                start,
                endExclusive: endExKey || nextDay(start),
                calendarId,
                docId,
                sourceStart: s0 || '',
                sourceCompletion: e0 || '',
                milestone: isMilestone,
            });
        }
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
                SettingsStore.data.calendarColumnWidths = { content: 140, duration: 60, spent: 60 };
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

            SettingsStore.data.columnOrder = ['content', 'duration', 'spent'];
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
                duration: `<th data-col="duration" style="${tableLayout.cellStyle('duration', 'white-space: nowrap; overflow: hidden;')}">时长<span class="tm-col-resize" onmousedown="startColResize(event, 'duration')"></span></th>`,
                spent: `<th data-col="spent" style="${tableLayout.cellStyle('spent', 'text-align: center; white-space: nowrap; overflow: hidden;')}">耗时<span class="tm-col-resize" onmousedown="startColResize(event, 'spent')"></span></th>`,
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
        const title = String(t.content || '').trim() || '(无标题)';
        return {
            title,
            durationMin,
            calendarId,
            priority: String(t.priority || '').trim(),
            startDate: String(t.startDate || '').trim(),
            completionTime: String(t.completionTime || '').trim(),
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

    function __tmCalendarFloatingDragStart(taskId, meta, ev, opts = {}) {
        if (__tmShouldSuppressCalendarFloatingMiniPanel()) return false;
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
        return !!(t && t.done);
    };

    window.tmUpdateTaskDates = async function(taskId, patch = {}, options = {}) {
        const requestedId = String(taskId || '').trim();
        if (!requestedId) throw new Error('缺少任务 ID');
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        const opts = (options && typeof options === 'object') ? options : {};
        try {
            __tmPushRefreshDebug('tmUpdateTaskDates-start', {
                taskId: requestedId,
                patch: { ...nextPatch },
                options: {
                    source: String(opts.source || '').trim(),
                    refresh: opts.refresh !== false,
                    hard: opts.hard === true,
                },
            });
        } catch (e) {}
        const hasStartDate = Object.prototype.hasOwnProperty.call(nextPatch, 'startDate');
        const hasCompletionTime = Object.prototype.hasOwnProperty.call(nextPatch, 'completionTime');
        if (!hasStartDate && !hasCompletionTime) throw new Error('缺少日期字段');
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
        if (!persistId) throw new Error('未找到任务');

        const normalizeDate = (value) => {
            const raw = String(value || '').trim();
            if (!raw) return '';
            try { return __tmNormalizeDateOnly(raw); } catch (e) { return raw; }
        };

        const prevStart = String(task?.startDate || '').trim();
        const prevEnd = String(task?.completionTime || '').trim();
        let nextStart = hasStartDate ? normalizeDate(nextPatch.startDate) : prevStart;
        let nextEnd = hasCompletionTime ? normalizeDate(nextPatch.completionTime) : prevEnd;

        if (nextStart && nextEnd && nextStart > nextEnd) {
            if (hasStartDate && hasCompletionTime) nextEnd = nextStart;
            else if (hasStartDate) nextEnd = nextStart;
            else nextStart = nextEnd;
        }

        const attrPatch = {};
        if (hasStartDate) attrPatch.startDate = nextStart;
        if (hasCompletionTime) attrPatch.completionTime = nextEnd;
        const repeatRule = __tmNormalizeTaskRepeatRule(task?.repeatRule || task?.repeat_rule || '', {
            startDate: nextStart || prevStart,
            completionTime: nextEnd || prevEnd,
        });
        if (repeatRule.enabled) {
            attrPatch.repeatState = __tmNormalizeTaskRepeatState({
                ...(task?.repeatState && typeof task.repeatState === 'object' ? task.repeatState : {}),
                lastInstanceStart: nextStart,
                lastInstanceDue: nextEnd,
            });
        }
        const refreshReason = String(opts.source || 'calendar-dates').trim() || 'calendar-dates';
        await __tmApplyTaskMetaPatchWithUndo(persistId, attrPatch, {
            source: refreshReason,
            label: __tmBuildUndoLabelFromMetaPatch(attrPatch, '日期'),
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
        if (opts.refresh !== false) {
            const viewPatch = {};
            if (hasStartDate) viewPatch.startDate = nextStart;
            if (hasCompletionTime) viewPatch.completionTime = nextEnd;
            try {
                __tmRefreshTaskTimeAcrossViews(persistId, {
                    patch: viewPatch,
                    withFilters: false,
                    reason: refreshReason,
                });
            } catch (e) {}
            try {
                const needsProjectionRefresh = __tmDoesPatchNeedProjectionRefresh(persistId, viewPatch);
                const currentViewMode = String(state.viewMode || '').trim();
                if (needsProjectionRefresh) {
                    if (currentViewMode === 'list') {
                        __tmScheduleListProjectionRefresh({
                            mode: 'current',
                            withFilters: true,
                            reason: refreshReason,
                        }, __tmBuildListProjectionRefreshScheduleOptions(viewPatch, {
                            reason: refreshReason,
                        }));
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
        try {
            __tmPushRefreshDebug('tmUpdateTaskDates-end', {
                taskId: persistId,
                startDate: nextStart,
                completionTime: nextEnd,
                source: String(opts.source || '').trim(),
            });
        } catch (e) {}
        return {
            id: persistId,
            startDate: nextStart,
            completionTime: nextEnd,
        };
    };

