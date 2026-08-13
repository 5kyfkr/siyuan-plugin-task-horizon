    function __tmSummaryDateFmt(d) {
        if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    function __tmSummaryFormatChinaDateTime(value) {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const values = {};
        new Intl.DateTimeFormat('zh-CN', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
        }).formatToParts(date).forEach((part) => {
            if (part.type !== 'literal') values[part.type] = part.value;
        });
        return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
    }

    function __tmSummaryRangeFromPreset(preset) {
        const p = String(preset || '').trim();
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (p === 'today' || p === 'today_report') {
            const s = __tmSummaryDateFmt(today);
            return { start: s, end: s };
        }
        if (p === 'this_week' || p === 'this_week_report') {
            const day = (today.getDay() + 6) % 7;
            const s = new Date(today.getTime() - day * 86400000);
            const e = new Date(s.getTime() + 6 * 86400000);
            return { start: __tmSummaryDateFmt(s), end: __tmSummaryDateFmt(e) };
        }
        if (p === 'last_week' || p === 'last_week_report') {
            const day = (today.getDay() + 6) % 7;
            const thisWeekStart = new Date(today.getTime() - day * 86400000);
            const s = new Date(thisWeekStart.getTime() - 7 * 86400000);
            const e = new Date(thisWeekStart.getTime() - 86400000);
            return { start: __tmSummaryDateFmt(s), end: __tmSummaryDateFmt(e) };
        }
        if (p === 'this_month') {
            const s = new Date(today.getFullYear(), today.getMonth(), 1);
            const e = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            return { start: __tmSummaryDateFmt(s), end: __tmSummaryDateFmt(e) };
        }
        if (p === 'last_month') {
            const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const e = new Date(today.getFullYear(), today.getMonth(), 0);
            return { start: __tmSummaryDateFmt(s), end: __tmSummaryDateFmt(e) };
        }
        return { start: '', end: '' };
    }

    async function __tmSummaryBuildGroupScope() {
        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        const scopes = await Promise.all(groups.map(async (g) => {
            const gid = String(g?.id || '').trim();
            if (!gid) return null;
            const ids = [];
            const seen = new Set();
            const entries = __tmGetGroupSourceEntries(g);
            await Promise.all(entries.map(async (entry) => {
                try {
                    await __tmExpandSourceEntryDocIds(entry, (did0) => {
                        const did = String(did0 || '').trim();
                        if (!did || seen.has(did)) return;
                        seen.add(did);
                        ids.push(did);
                    });
                } catch (e) {}
            }));
            return { gid, ids };
        }));
        const docToGroup = new Map();
        const groupDocIdsMap = {};
        const allDocIds = new Set();
        scopes.filter(Boolean).forEach(({ gid, ids }) => {
            groupDocIdsMap[gid] = ids;
            ids.forEach((id) => {
                allDocIds.add(id);
                if (!docToGroup.has(id)) docToGroup.set(id, gid);
            });
        });
        if (allDocIds.size === 0) {
            Object.values(state.flatTasks || {}).forEach((task) => {
                const docId = String(task?.docId || task?.root_id || '').trim();
                if (docId) allDocIds.add(docId);
            });
        }
        return { docToGroup, groupDocIdsMap, allDocIds: Array.from(allDocIds) };
    }

    function __tmSummaryStatusName(task, statusMap) {
        const sid = __tmResolveTaskStatusId(task);
        return statusMap.get(sid) || sid || '未完成';
    }

    function __tmSummaryPriorityText(priority) {
        const p = String(priority || '').trim();
        if (p === 'high') return '高';
        if (p === 'medium') return '中';
        if (p === 'low') return '低';
        return '无';
    }

    function __tmSummaryDateKeyFromTs(ts) {
        const n = Number(ts);
        if (!Number.isFinite(n) || n <= 0) return '';
        const d = new Date(n);
        if (Number.isNaN(d.getTime())) return '';
        const pad = (x) => String(x).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    function __tmSummaryTaskCompletedAtTs(task) {
        const ts = __tmParseTimeToTs(task?.taskCompleteAt || task?.task_complete_at || '');
        return Number.isFinite(ts) && ts > 0 ? ts : 0;
    }

    async function __tmSummaryBuildDocNameMapByGroups(baseMap) {
        const out = (baseMap && typeof baseMap === 'object') ? { ...baseMap } : {};
        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        const notebookIds = new Set();
        for (const g of groups) {
            const docEntries = __tmNormalizeGroupDocEntries(g);
            docEntries.forEach((doc) => {
                const id = String(doc?.id || '').trim();
                if (!id || out[id]) return;
                const fromAll = (Array.isArray(state.allDocuments) ? state.allDocuments : []).find((d) => String(d?.id || '').trim() === id);
                if (fromAll?.name) out[id] = String(fromAll.name).trim() || id;
            });
            const notebookId = String(g?.notebookId || '').trim();
            if (notebookId) notebookIds.add(notebookId);
        }
        const notebookDocs = await Promise.all(Array.from(notebookIds).map(async (notebookId) => {
            try {
                return await API.getNotebookDocuments(notebookId);
            } catch (e) {
                return [];
            }
        }));
        notebookDocs.flat().forEach((doc) => {
            const id = String(doc?.id || '').trim();
            if (!id || out[id]) return;
            out[id] = String(doc?.name || '').trim() || id;
        });
        return out;
    }

    function __tmSummaryExpandRecurringTasks(tasks) {
        const out = [];
        const seen = new Set();
        const push = (task) => {
            const id = String(task?.id || '').trim();
            if (!id || seen.has(id)) return;
            seen.add(id);
            out.push(task);
        };
        (Array.isArray(tasks) ? tasks : []).forEach((task) => {
            if (!task || typeof task !== 'object') return;
            push(task);
            if (task.isRecurringInstance === true || String(task.id || '').startsWith('repeatinst:')) return;
            const history = __tmNormalizeTaskRepeatHistory(task.repeatHistory || task.repeat_history || '');
            const currentCompletedAt = task.done ? String(task.taskCompleteAt || task.task_complete_at || '').trim() : '';
            history.forEach((historyItem, index) => {
                if (currentCompletedAt && String(historyItem?.completedAt || '').trim() === currentCompletedAt) return;
                push(__tmBuildRecurringInstanceTask(task, historyItem, index));
            });
        });
        return out;
    }

    async function __tmSummaryLoadTasksByDocs(docIds, options = {}) {
        const ids = Array.isArray(docIds) ? docIds.map(x => String(x || '').trim()).filter(Boolean) : [];
        if (!ids.length) return [];
        const limit = __TM_TASK_INDEX_QUERY_LIMIT;
        let list = [];
        try {
            const res = await API.getTasksByDocuments(ids, limit, {
                doneOnly: false,
                ignoreExcludeCompleted: options?.ignoreExcludeCompleted === true,
                forceFresh: options?.forceFresh === true,
            });
            list = Array.isArray(res?.tasks) ? res.tasks : [];
        } catch (e) {
            if (options?.throwOnError === true) throw e;
            list = [];
        }
        return __tmSummaryExpandRecurringTasks(list.map((task) => {
            if (!task || typeof task !== 'object') return null;
            const t = { ...task };
            let parsedDone = !!t.done;
            try {
                const parsed = API.parseTaskStatus(t.markdown);
                parsedDone = !!parsed.done;
                t.done = parsedDone;
                t.content = parsed.content;
            } catch (e) {}
            try { MetaStore.applyToTask?.(t); } catch (e) {}
            t.done = parsedDone;
            const docName = String(t.docName || '未命名文档');
            try { normalizeTaskFields(t, docName); } catch (e) {}
            return t;
        }).filter(Boolean));
    }

    async function __tmSummaryLoadTasksByDocFallback(docId, options = {}) {
        const id = String(docId || '').trim();
        if (!id) return [];
        const limit = __TM_TASK_INDEX_QUERY_LIMIT;
        let list = [];
        try {
            const res = await API.getTasksByDocument(id, limit, { doneOnly: false, ignoreExcludeCompleted: options?.ignoreExcludeCompleted === true });
            list = Array.isArray(res?.tasks) ? res.tasks : [];
        } catch (e) {
            list = [];
        }
        return __tmSummaryExpandRecurringTasks(list.map((task) => {
            if (!task || typeof task !== 'object') return null;
            const t = { ...task };
            let parsedDone = !!t.done;
            try {
                const parsed = API.parseTaskStatus(t.markdown);
                parsedDone = !!parsed.done;
                t.done = parsedDone;
                t.content = parsed.content;
            } catch (e) {}
            try { MetaStore.applyToTask?.(t); } catch (e) {}
            t.done = parsedDone;
            const docName = String(t.docName || t.doc_name || '未命名文档');
            try { normalizeTaskFields(t, docName); } catch (e) {}
            return t;
        }).filter(Boolean));
    }

    async function __tmSummaryEnsureH2Contexts(ctx, filter) {
        if (String(filter?.groupBy || '').trim() !== 'h2') return;
        const tasks = Array.isArray(ctx?.summaryTasks) ? ctx.summaryTasks : [];
        const resolvedIds = ctx.summaryH2ResolvedIds instanceof Set ? ctx.summaryH2ResolvedIds : new Set();
        ctx.summaryH2ResolvedIds = resolvedIds;
        const ids = tasks
            .filter((task) => task?.isRecurringInstance !== true && !String(task?.id || '').startsWith('repeatinst:'))
            .map((task) => String(task?.id || '').trim())
            .filter((id) => id && !resolvedIds.has(id));
        if (!ids.length) return;
        let h2Map;
        try {
            h2Map = await API.fetchH2Contexts(ids);
        } catch (e) {
            return;
        }
        ids.forEach((id) => resolvedIds.add(id));
        tasks.forEach((task) => {
            const h2ctx = h2Map?.get?.(task?.id);
            if (!h2ctx || typeof h2ctx !== 'object') return;
            task.h2 = String(h2ctx.content || '').trim();
            task.h2Id = String(h2ctx.id || '').trim();
        });
    }

    function __tmSummaryCompareTasksByCompletion(a, b) {
        const aTs = Number(a?.completedAtTs) || 0;
        const bTs = Number(b?.completedAtTs) || 0;
        if (aTs !== bTs) return aTs - bTs;
        return String(a?.content || '').localeCompare(String(b?.content || ''), 'zh-Hans-CN');
    }

    function __tmSummaryRecurringLabel(task) {
        const isInstance = task?.isRecurringInstance === true || String(task?.id || '').startsWith('repeatinst:');
        let isRecurring = isInstance;
        if (!isRecurring) {
            try {
                const rule = __tmGetTaskRepeatRule(task);
                isRecurring = !!rule?.enabled && String(rule?.type || 'none') !== 'none';
            } catch (e) {}
        }
        if (!isRecurring) return '';
        const occurrence = Math.max(0, parseInt(task?.recurringOccurrenceNumber, 10) || 0);
        const total = Math.max(0, Math.min(200, parseInt(task?.recurringTotalOccurrences, 10) || 0));
        return occurrence > 0
            ? `循环任务 · 第 ${occurrence}${total > 0 ? `/${total}` : ''} 次`
            : '循环任务';
    }

    function __tmSummaryFormatFocusDuration(task) {
        if (!SettingsStore?.data?.enableTomatoIntegration) return '';
        const readHours = String(SettingsStore.data.tomatoSpentAttrMode || 'minutes').trim() === 'hours';
        const focus = __tmGetTaskTomatoFocusValues(task);
        const raw = readHours
            ? focus.tomatoHours
            : focus.tomatoMinutes;
        const amount = typeof __tmParseNumber === 'function' ? __tmParseNumber(raw) : Number(raw);
        if (!Number.isFinite(amount) || amount <= 0) return '';
        const minutes = readHours ? amount * 60 : amount;
        if (String(SettingsStore.data.durationFormat || 'hours').trim() === 'minutes') {
            return `${Math.round(minutes)}min`;
        }
        return String(__tmFormatSpentHours(minutes / 60) || '').trim();
    }

    function __tmSummaryCollectTasks(ctx, filter) {
        const out = [];
        const arr = Array.isArray(ctx.summaryTasks) ? ctx.summaryTasks : [];
        const docNameMap = ctx.docNameMap || {};
        const docToGroup = ctx.docToGroup || new Map();
        const groupDocIdsMap = (ctx.groupDocIdsMap && typeof ctx.groupDocIdsMap === 'object') ? ctx.groupDocIdsMap : {};
        const f = filter || {};
        const start = String(f.start || '').trim();
        const end = String(f.end || '').trim();
        const status = String(f.status || '__all__').trim();
        const priority = String(f.priority || '__all__').trim();
        const groupId = String(f.groupId || '__all__').trim();
        const docIdFilter = String(f.docId || '__all__').trim();
        const idMap = new Map();
        const levelMemo = new Map();

        arr.forEach((t) => {
            const id = String(t?.id || '').trim();
            if (id) idMap.set(id, t);
        });

        const resolveLevel = (task) => {
            const id = String(task?.id || '').trim();
            if (!id) return 0;
            if (levelMemo.has(id)) return levelMemo.get(id);
            const seen = new Set([id]);
            let level = 0;
            let pid = String(task?.parentTaskId || '').trim();
            while (pid && !seen.has(pid)) {
                seen.add(pid);
                const parent = idMap.get(pid);
                if (!parent) break;
                level += 1;
                pid = String(parent?.parentTaskId || '').trim();
            }
            levelMemo.set(id, level);
            return level;
        };

        arr.forEach((task) => {
            if (!task || !task.id) return;
            const docId = String(task.docId || task.root_id || '').trim();
            if (!docId) return;
            if (docIdFilter !== '__all__' && docId !== docIdFilter) return;
            const gid = String(docToGroup.get(docId) || '').trim();
            const groupDocIds = Array.isArray(groupDocIdsMap[groupId]) ? groupDocIdsMap[groupId] : [];
            if (groupId === '__ungrouped__') {
                if (gid) return;
            } else if (groupId !== '__all__') {
                if (!groupDocIds.includes(docId)) return;
            }

            const completedAtTs = __tmSummaryTaskCompletedAtTs(task);
            const dateKey = __tmSummaryDateKeyFromTs(completedAtTs);
            if (start && (!dateKey || dateKey < start)) return;
            if (end && (!dateKey || dateKey > end)) return;

            if (status === '__done__' && !task.done) return;
            if (status === '__undone__' && task.done) return;
            if (status !== '__all__' && status !== '__done__' && status !== '__undone__') {
                const sid = __tmResolveTaskStatusId(task);
                if (sid !== status) return;
            }

            const p = String(task.priority || '').trim() || 'none';
            if (priority !== '__all__' && p !== priority) return;

            out.push({
                id: String(task.id || '').trim(),
                content: String(task.content || '').trim() || '无内容',
                done: !!task.done,
                customStatus: __tmResolveTaskStatusId(task),
                priority: p,
                recurringLabel: __tmSummaryRecurringLabel(task),
                focusDuration: __tmSummaryFormatFocusDuration(task),
                completedAtTs,
                dateKey,
                dueDate: String(task.completionTime || '').trim(),
                docId,
                docName: String(docNameMap[docId] || task.docName || '未命名文档'),
                h2Id: String(task.h2Id || '').trim(),
                h2Name: String(task.h2 || task.h2Name || '').trim() || '无二级标题',
                level: resolveLevel(task),
            });
        });

        out.sort(__tmSummaryCompareTasksByCompletion);
        return out;
    }

    function __tmSummaryGenerateMarkdown(tasks, filter, ctx) {
        const lines = [];
        const now = __tmSummaryFormatChinaDateTime(new Date());
        const statusMap = ctx.statusMap || new Map();
        const preset = String(filter.preset || 'all').trim();
        const isDailyReport = preset === 'today_report';
        const isWeeklyReport = preset === 'this_week_report' || preset === 'last_week_report';
        const groupName = ctx.groupNameMap?.[String(filter.groupId || '__all__')] || '全部分组';
        const docName = filter.docId === '__all__'
            ? (filter.groupId && filter.groupId !== '__all__' ? '当前分区全部文档' : '全部分区内文档')
            : (ctx.docNameMap?.[String(filter.docId || '')] || '指定文档');
        const statusName = String(filter.status || '__all__') === '__all__'
            ? '全部状态'
            : (String(filter.status) === '__done__' ? '已完成' : (String(filter.status) === '__undone__' ? '未完成' : (statusMap.get(String(filter.status || '')) || String(filter.status || ''))));
        const priorityName = String(filter.priority || '__all__') === '__all__' ? '全部优先级' : __tmSummaryPriorityText(filter.priority);
        const groupBy = String(filter.groupBy || 'status').trim() || 'status';
        const groupByName = groupBy === 'h2'
            ? '按二级标题'
            : (groupBy === 'date' ? '按完成日期' : (groupBy === 'priority' ? '按重要性' : (groupBy === 'doc' ? '按文档' : '按状态')));
        const fields = (filter.fields && typeof filter.fields === 'object') ? filter.fields : {};
        const showTaskName = fields.taskName !== false;
        const showDocName = fields.docName !== false;
        const showPriority = fields.priority !== false;
        const showStatus = fields.status !== false;
        const showDate = fields.date !== false;
        const showFocusDuration = fields.focusDuration !== false;
        const rangeLabel = (filter.start || filter.end)
            ? `${filter.start || '最早'} ~ ${filter.end || '最晚'}`
            : '全部时间';

        lines.push(isDailyReport ? '# 今日日报' : (preset === 'this_week_report' ? '# 本周周报' : (preset === 'last_week_report' ? '# 上周周报' : '# 任务摘要')));
        lines.push('');
        lines.push(`> 生成时间：${now}`);
        lines.push(`> 筛选：${rangeLabel} | ${groupName} | ${docName} | ${statusName} | ${priorityName} | ${groupByName}`);
        lines.push('');

        if (!tasks.length) {
            lines.push('> 没有匹配到任务。');
            return lines.join('\n');
        }

        const todayKey = __tmSummaryDateFmt(new Date());
        const doneTasks = tasks.filter(t => t.done);
        const todoTasks = tasks.filter(t => !t.done);
        const overdueTasks = tasks.filter((t) => !t.done && String(t.dueDate || '').trim() && String(t.dueDate || '').trim() < todayKey);
        if (isDailyReport || isWeeklyReport) {
            const renderTaskLines = (arr) => arr.length
                ? arr.map((t) => {
                    const details = [t.recurringLabel, showFocusDuration && t.focusDuration ? `专注时长:${t.focusDuration}` : ''].filter(Boolean);
                    const suffix = [t.docName, ...details].filter(Boolean);
                    return `- [${t.done ? 'x' : ' '}] ${t.content}${suffix.length ? `（${suffix.join('｜')}）` : ''}`;
                }).join('\n')
                : '- 无';
            lines.push('## 完成情况');
            lines.push('');
            lines.push(renderTaskLines(doneTasks));
            lines.push('');
            lines.push('## 计划项');
            lines.push('');
            lines.push(renderTaskLines(todoTasks.slice(0, 30)));
            lines.push('');
            lines.push('## 逾期项');
            lines.push('');
            lines.push(renderTaskLines(overdueTasks));
            lines.push('');
        }

        const sectionMap = new Map();
        const sectionLabel = (t) => {
            if (groupBy === 'h2') return String(t.h2Name || '无二级标题');
            if (groupBy === 'date') return String(t.dateKey || '无完成日期');
            if (groupBy === 'priority') return `重要性：${__tmSummaryPriorityText(t.priority)}`;
            if (groupBy === 'doc') return String(t.docName || '未命名文档');
            return __tmSummaryStatusName(t, statusMap);
        };
        tasks.forEach((t) => {
            const key = sectionLabel(t);
            if (!sectionMap.has(key)) sectionMap.set(key, []);
            sectionMap.get(key).push(t);
        });

        const sectionOrder = Array.from(sectionMap.keys()).sort((a, b) => {
            if (groupBy === 'date') {
                if (a === '无完成日期') return -1;
                if (b === '无完成日期') return 1;
            }
            return String(a).localeCompare(String(b), 'zh-Hans-CN');
        });
        sectionOrder.forEach((name) => {
            const arr = sectionMap.get(name) || [];
            lines.push(`## ${name}（${arr.length}）`);
            lines.push('');
            arr.forEach((t) => {
                const d = (showDate && groupBy !== 'date' && t.dateKey) ? `[${t.dateKey}] ` : '';
                const pr = __tmSummaryPriorityText(t.priority);
                const checkbox = t.done ? '[x]' : '[ ]';
                const body = showTaskName ? t.content : '(任务)';
                const ext = [];
                const level = Math.max(0, Number(t.level) || 0);
                const indent = '  '.repeat(level);
                if (showDocName && groupBy !== 'doc') ext.push(t.docName);
                if (showPriority) ext.push(`优先级:${pr}`);
                if (showStatus) ext.push(__tmSummaryStatusName(t, statusMap));
                if (t.recurringLabel) ext.push(t.recurringLabel);
                if (showFocusDuration && t.focusDuration) ext.push(`专注时长:${t.focusDuration}`);
                lines.push(`${indent}- ${checkbox} ${d}${body}${ext.length ? `（${ext.join('｜')}）` : ''}`);
            });
            lines.push('');
        });

        const doneCount = tasks.filter(t => t.done).length;
        lines.push('---');
        lines.push('');
        lines.push(`- 总计：${tasks.length}`);
        lines.push(`- 已完成：${doneCount}`);
        lines.push(`- 未完成：${tasks.length - doneCount}`);
        return lines.join('\n');
    }

    const __TM_SUMMARY_FILTER_STORAGE_KEY = 'tm_summary_filter';

    function __tmSummaryNormalizeSavedFilter(value) {
        const source = (value && typeof value === 'object' && !Array.isArray(value)) ? value : null;
        if (!source) return null;
        const allowedPreset = new Set(['all', 'today_report', 'this_week_report', 'last_week_report', 'today', 'this_week', 'last_week', 'this_month', 'last_month', 'custom']);
        const allowedPriority = new Set(['__all__', 'high', 'medium', 'low', 'none']);
        const allowedGroupBy = new Set(['status', 'date', 'priority', 'doc', 'h2']);
        const fields = (source.fields && typeof source.fields === 'object' && !Array.isArray(source.fields)) ? source.fields : {};
        const booleanOr = (key, fallback) => typeof fields[key] === 'boolean' ? fields[key] : fallback;
        const preset = String(source.preset || '').trim();
        const priority = String(source.priority || '').trim();
        const groupBy = String(source.groupBy || '').trim();
        return {
            preset: allowedPreset.has(preset) ? preset : 'this_week',
            start: __tmNormalizeDateOnly(source.start || ''),
            end: __tmNormalizeDateOnly(source.end || ''),
            groupId: String(source.groupId || '__all__').trim() || '__all__',
            docId: String(source.docId || '__all__').trim() || '__all__',
            status: String(source.status || '__all__').trim() || '__all__',
            priority: allowedPriority.has(priority) ? priority : '__all__',
            groupBy: allowedGroupBy.has(groupBy) ? groupBy : 'status',
            fields: {
                taskName: booleanOr('taskName', true),
                docName: booleanOr('docName', false),
                priority: booleanOr('priority', false),
                status: booleanOr('status', false),
                date: booleanOr('date', false),
                focusDuration: booleanOr('focusDuration', false),
            },
        };
    }

    function __tmSummaryLoadSavedFilter() {
        return __tmSummaryNormalizeSavedFilter(Storage.get(__TM_SUMMARY_FILTER_STORAGE_KEY, null));
    }

    function __tmSummarySaveFilter(filter) {
        const normalized = __tmSummaryNormalizeSavedFilter(filter);
        if (normalized) Storage.set(__TM_SUMMARY_FILTER_STORAGE_KEY, normalized);
    }

    function __tmSummaryApplySavedFilter(root, filter, options = {}) {
        if (!root || !filter) return;
        const setValue = (key, value, fallback) => {
            const control = root.querySelector(`[data-tm-summary="${key}"]`);
            if (!control) return;
            const next = String(value || '').trim();
            const exists = control.tagName === 'SELECT'
                ? Array.from(control.options || []).some((option) => String(option.value || '') === next)
                : true;
            control.value = exists ? next : fallback;
        };
        setValue('preset', filter.preset, 'this_week');
        setValue('start', filter.start, '');
        setValue('end', filter.end, '');
        setValue('group', filter.groupId, '__all__');
        if (options.includeDoc === true) setValue('doc', filter.docId, '__all__');
        setValue('status', filter.status, '__all__');
        setValue('priority', filter.priority, '__all__');
        setValue('groupBy', filter.groupBy, 'status');
        Object.entries({
            fieldTaskName: filter.fields?.taskName !== false,
            fieldDocName: filter.fields?.docName === true,
            fieldPriority: filter.fields?.priority === true,
            fieldStatus: filter.fields?.status === true,
            fieldDate: filter.fields?.date === true,
            fieldFocusDuration: filter.fields?.focusDuration === true,
        }).forEach(([key, checked]) => {
            const control = root.querySelector(`[data-tm-summary="${key}"]`);
            if (control) control.checked = checked;
        });
    }

    function __tmSummaryReadFilter(root) {
        const q = (sel) => root.querySelector(sel);
        const preset = String(q('[data-tm-summary="preset"]')?.value || 'all').trim();
        const startInput = q('[data-tm-summary="start"]');
        const endInput = q('[data-tm-summary="end"]');
        let start = String(startInput?.value || '').trim();
        let end = String(endInput?.value || '').trim();
        if (preset !== 'custom') {
            const r = __tmSummaryRangeFromPreset(preset);
            start = r.start;
            end = r.end;
            if (startInput) startInput.value = start;
            if (endInput) endInput.value = end;
        }
        return {
            preset,
            start: __tmNormalizeDateOnly(start),
            end: __tmNormalizeDateOnly(end),
            groupId: String(q('[data-tm-summary="group"]')?.value || '__all__').trim(),
            docId: String(q('[data-tm-summary="doc"]')?.value || '__all__').trim(),
            status: String(q('[data-tm-summary="status"]')?.value || '__all__').trim(),
            priority: String(q('[data-tm-summary="priority"]')?.value || '__all__').trim(),
            groupBy: String(q('[data-tm-summary="groupBy"]')?.value || 'status').trim(),
            fields: {
                taskName: q('[data-tm-summary="fieldTaskName"]')?.checked !== false,
                docName: q('[data-tm-summary="fieldDocName"]')?.checked !== false,
                priority: q('[data-tm-summary="fieldPriority"]')?.checked !== false,
                status: q('[data-tm-summary="fieldStatus"]')?.checked !== false,
                date: q('[data-tm-summary="fieldDate"]')?.checked !== false,
                focusDuration: q('[data-tm-summary="fieldFocusDuration"]')?.checked !== false,
            },
        };
    }

    function __tmSummaryRefreshDocOptions(root, ctx) {
        const groupSel = root.querySelector('[data-tm-summary="group"]');
        const docSel = root.querySelector('[data-tm-summary="doc"]');
        if (!groupSel || !docSel) return;
        const prevDoc = String(docSel.value || '__all__').trim();
        const gid = String(groupSel.value || '__all__').trim();
        const docToGroup = ctx.docToGroup || new Map();
        const docTaskCount = (ctx.docTaskCount && typeof ctx.docTaskCount === 'object') ? ctx.docTaskCount : {};
        const groupDocIdsMap = (ctx.groupDocIdsMap && typeof ctx.groupDocIdsMap === 'object') ? ctx.groupDocIdsMap : {};
        const allLabel = gid === '__all__' ? '全部分区内文档' : (gid === '__ungrouped__' ? '未分组全部文档' : '当前分区全部文档');
        const options = [{ id: '__all__', name: allLabel }];
        if (gid !== '__all__' && gid !== '__ungrouped__') {
            const ids = Array.isArray(groupDocIdsMap[gid]) ? groupDocIdsMap[gid] : [];
            ids.forEach((docId) => {
                const id = String(docId || '').trim();
                if (!id) return;
                const name = String((ctx.docNameMap || {})[id] || id);
                options.push({ id, name });
            });
        } else {
            Object.entries(ctx.docNameMap || {}).forEach(([docId, name]) => {
                if (!Number(docTaskCount[String(docId)] || 0)) return;
                const g = String(docToGroup.get(String(docId)) || '').trim();
                if (gid === '__all__' || (gid === '__ungrouped__' ? !g : g === gid)) {
                    options.push({ id: String(docId), name: String(name || docId) });
                }
            });
        }
        docSel.innerHTML = options
            .filter((it, idx, arr) => arr.findIndex((x) => String(x.id) === String(it.id)) === idx)
            .sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-Hans-CN'))
            .map((it) => `<option value="${esc(it.id)}">${esc(it.name)}</option>`)
            .join('');
        docSel.value = options.some(it => it.id === prevDoc) ? prevDoc : '__all__';
    }

    async function __tmSummaryEnsureTasksForFilter(ctx, filter) {
        if (!ctx || typeof ctx !== 'object') return;
        const f = (filter && typeof filter === 'object') ? filter : {};
        const groupDocIdsMap = (ctx.groupDocIdsMap && typeof ctx.groupDocIdsMap === 'object') ? ctx.groupDocIdsMap : {};
        let targetDocIds = [];
        const docId = String(f.docId || '__all__').trim();
        const groupId = String(f.groupId || '__all__').trim();
        if (docId && docId !== '__all__') {
            targetDocIds = [docId];
        } else if (groupId && groupId !== '__all__' && groupId !== '__ungrouped__') {
            targetDocIds = Array.isArray(groupDocIdsMap[groupId]) ? groupDocIdsMap[groupId] : [];
        } else {
            return;
        }
        const ids = Array.from(new Set(targetDocIds.map((id) => String(id || '').trim()).filter(Boolean)));
        if (!ids.length) return;

        let tasks = await __tmSummaryLoadTasksByDocs(ids);
        const hitDocIds = new Set(tasks.map((t) => String(t?.docId || t?.root_id || '').trim()).filter(Boolean));
        const missingDocIds = ids.filter((id) => !hitDocIds.has(id));
        if (missingDocIds.length > 0) {
            for (const missingId of missingDocIds) {
                const extra = await __tmSummaryLoadTasksByDocFallback(missingId);
                if (extra.length > 0) tasks = tasks.concat(extra);
            }
        }
        const prev = Array.isArray(ctx.summaryTasks) ? ctx.summaryTasks : [];
        const merged = new Map();
        const previousById = new Map();
        prev.forEach((t) => {
            const id = String(t?.id || '').trim();
            if (!id) return;
            merged.set(id, t);
            previousById.set(id, t);
        });
        const refreshedSourceIds = new Set(tasks
            .filter((task) => task?.isRecurringInstance !== true && !String(task?.id || '').startsWith('repeatinst:'))
            .map((task) => String(task?.id || '').trim())
            .filter(Boolean));
        if (refreshedSourceIds.size > 0) {
            Array.from(merged.entries()).forEach(([id, task]) => {
                const sourceId = String(task?.sourceTaskId || task?.recurringSourceTaskId || '').trim();
                if (refreshedSourceIds.has(id) || (sourceId && refreshedSourceIds.has(sourceId))) merged.delete(id);
            });
        }
        tasks.forEach((t) => {
            const id = String(t?.id || '').trim();
            const previous = id ? previousById.get(id) : null;
            if (previous && ctx.summaryH2ResolvedIds instanceof Set && ctx.summaryH2ResolvedIds.has(id)) {
                t.h2 = String(previous?.h2 || '').trim();
                t.h2Id = String(previous?.h2Id || '').trim();
            }
            if (id) merged.set(id, t);
            const did = String(t?.docId || t?.root_id || '').trim();
            if (did) {
                ctx.docNameMap = (ctx.docNameMap && typeof ctx.docNameMap === 'object') ? ctx.docNameMap : {};
                if (!ctx.docNameMap[did]) ctx.docNameMap[did] = String(t?.docName || '').trim() || did;
            }
        });
        ctx.summaryTasks = Array.from(merged.values());
        const nextCount = {};
        (ctx.summaryTasks || []).forEach((t) => {
            const did = String(t?.docId || t?.root_id || '').trim();
            if (!did) return;
            nextCount[did] = Number(nextCount[did] || 0) + 1;
        });
        ctx.docTaskCount = nextCount;
    }

    function __tmSummaryUpdatePreview(root, ctx) {
        const filter = __tmSummaryReadFilter(root);
        const tasks = __tmSummaryCollectTasks(ctx, filter);
        const md = __tmSummaryGenerateMarkdown(tasks, filter, ctx);
        const textarea = root.querySelector('[data-tm-summary="preview"]');
        if (textarea) textarea.value = md;
    }

    function __tmCloseSummaryModal() {
        state.__summaryUnstack?.();
        state.__summaryUnstack = null;
        if (!state.summaryModal) return;
        try { state.summaryModal.remove(); } catch (e) {}
        state.summaryModal = null;
    }

    window.tmShowSummaryModal = async function() {
        try { __tmHideMobileMenu(); } catch (e) {}
        try { tmCloseDesktopMenu(); } catch (e) {}
        __tmCloseSummaryModal();

        const docNameMap = {};
        (Array.isArray(state.taskTree) ? state.taskTree : []).forEach((d) => {
            const id = String(d?.id || '').trim();
            if (id) docNameMap[id] = String(d?.name || '').trim() || id;
        });
        (Array.isArray(state.allDocuments) ? state.allDocuments : []).forEach((d) => {
            const id = String(d?.id || '').trim();
            if (id && !docNameMap[id]) docNameMap[id] = String(d?.name || '').trim() || id;
        });
        Object.values(state.flatTasks || {}).forEach((t) => {
            const docId = String(t?.docId || t?.root_id || '').trim();
            if (!docId) return;
            if (!docNameMap[docId]) docNameMap[docId] = String(t?.docName || '').trim() || docId;
        });

        const statusOptions = Array.isArray(SettingsStore.data.customStatusOptions) ? SettingsStore.data.customStatusOptions : [];
        const statusMap = new Map();
        statusOptions.forEach((o) => {
            const id = String(o?.id || '').trim();
            if (!id) return;
            statusMap.set(id, String(o?.name || id));
        });

        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        const groupNameMap = { '__all__': '全部分组', '__ungrouped__': '未分组' };
        groups.forEach((g) => {
            const gid = String(g?.id || '').trim();
            if (gid) groupNameMap[gid] = __tmResolveDocGroupName(g);
        });

        const groupOptions = [
            { id: '__all__', name: '全部分组' },
            ...groups.map((g) => ({ id: String(g?.id || '').trim(), name: __tmResolveDocGroupName(g) })).filter(g => g.id),
            { id: '__ungrouped__', name: '未分组' }
        ];
        const statusSelectOptions = [
            { id: '__all__', name: '全部状态' },
            { id: '__done__', name: '已完成' },
            { id: '__undone__', name: '未完成' },
            ...Array.from(statusMap.keys()).map((id) => ({ id, name: statusMap.get(id) || id }))
        ];

        const isMobileSummary = __tmIsMobileDevice();
        state.summaryModal = document.createElement('div');
        state.summaryModal.className = `tm-modal tm-summary-modal${isMobileSummary ? ' tm-modal--mobile' : ''}`;
        state.summaryModal.style.cssText = 'z-index: 200001;';
        const box = document.createElement('div');
        box.className = 'tm-box tm-summary-box';
        box.innerHTML = `
            <div class="tm-header" style="padding:12px 16px;border-bottom:1px solid var(--tm-border-color);">
                <div style="font-size:16px;font-weight:600;">📝 任务摘要</div>
                <button class="tm-btn tm-btn-gray" data-tm-summary-action="close" style="padding:4px 8px;font-size:12px;">✕</button>
            </div>
            <div class="tm-body tm-summary-body" style="padding:12px 16px;display:flex;flex-direction:column;gap:10px;overflow:auto;">
                <div class="tm-summary-toolbar" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                    <select class="tm-rule-select" data-tm-summary="preset" style="min-width:110px;">
                        <option value="all">全部时间</option>
                        <option value="today_report">今日日报</option>
                        <option value="this_week_report">本周周报</option>
                        <option value="last_week_report">上周周报</option>
                        <option value="today">今天</option>
                        <option value="this_week" selected>本周</option>
                        <option value="last_week">上周</option>
                        <option value="this_month">本月</option>
                        <option value="last_month">上月</option>
                        <option value="custom">自定义</option>
                    </select>
                    <input class="tm-input" type="date" data-tm-summary="start" style="width:140px;">
                    <span style="color:var(--tm-secondary-text);">~</span>
                    <input class="tm-input" type="date" data-tm-summary="end" style="width:140px;">
                    <select class="tm-rule-select" data-tm-summary="group" style="min-width:140px;">
                        ${groupOptions.map(g => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}
                    </select>
                    <select class="tm-rule-select" data-tm-summary="doc" style="min-width:160px;"></select>
                    <select class="tm-rule-select" data-tm-summary="status" style="min-width:130px;">
                        ${statusSelectOptions.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}
                    </select>
                    <select class="tm-rule-select" data-tm-summary="priority" style="min-width:120px;">
                        <option value="__all__">全部重要性</option>
                        <option value="high">高</option>
                        <option value="medium">中</option>
                        <option value="low">低</option>
                        <option value="none">无</option>
                    </select>
                    <select class="tm-rule-select" data-tm-summary="groupBy" style="min-width:130px;">
                        <option value="status">按状态分组</option>
                        <option value="date">按完成日期分组</option>
                        <option value="priority">按重要性分组</option>
                        <option value="doc">按文档分组</option>
                        <option value="h2">按二级标题分组</option>
                    </select>
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;color:var(--tm-secondary-text);font-size:12px;">
                    <span>显示字段:</span>
                    <label style="display:inline-flex;align-items:center;gap:4px;"><input type="checkbox" data-tm-summary="fieldTaskName" checked>任务名称</label>
                    <label style="display:inline-flex;align-items:center;gap:4px;"><input type="checkbox" data-tm-summary="fieldDocName">文档名称</label>
                    <label style="display:inline-flex;align-items:center;gap:4px;"><input type="checkbox" data-tm-summary="fieldPriority">优先级</label>
                    <label style="display:inline-flex;align-items:center;gap:4px;"><input type="checkbox" data-tm-summary="fieldStatus">状态</label>
                    <label style="display:inline-flex;align-items:center;gap:4px;"><input type="checkbox" data-tm-summary="fieldDate">日期</label>
                    <label style="display:inline-flex;align-items:center;gap:4px;"><input type="checkbox" data-tm-summary="fieldFocusDuration">专注时长</label>
                </div>
                <textarea class="tm-summary-preview" data-tm-summary="preview" style="width:100%;height:100%;box-sizing:border-box;padding:12px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:0.875rem;line-height:1.55;background:var(--tm-input-bg);color:var(--tm-text-color);border:1px solid var(--tm-input-border);border-radius:8px;resize:vertical;"></textarea>
            </div>
            <div class="tm-header tm-summary-footer" style="padding:12px 16px;border-top:1px solid var(--tm-border-color);justify-content:flex-end;gap:10px;">
                <button class="tm-btn tm-btn-secondary" data-tm-summary-action="refresh" style="padding:8px 16px;">生成</button>
                <button class="tm-btn tm-btn-primary" data-tm-summary-action="copy" style="padding:8px 16px;">复制</button>
                <button class="tm-btn tm-btn-primary" data-tm-summary-action="export" style="padding:8px 16px;">导出</button>
            </div>
        `;
        state.summaryModal.appendChild(box);
        document.body.appendChild(state.summaryModal);
        if (isMobileSummary) {
            try { __tmApplyMobileBrowserViewportMetrics(state.summaryModal); } catch (e) {}
        }
        state.__summaryUnstack = __tmModalStackBind(() => __tmCloseSummaryModal());

        const root = state.summaryModal;
        const savedFilter = __tmSummaryLoadSavedFilter();
        const ctx = {
            docNameMap,
            docTaskCount: {},
            docToGroup: new Map(),
            groupDocIdsMap: {},
            statusMap,
            groupNameMap,
            summaryTasks: [],
            summaryH2ResolvedIds: new Set(),
            loading: true,
        };
        __tmSummaryApplySavedFilter(root, savedFilter);
        const setLoading = (loading) => {
            ctx.loading = loading;
            root.toggleAttribute('aria-busy', loading);
            root.querySelectorAll('[data-tm-summary]:not([data-tm-summary="preview"]), [data-tm-summary-action]:not([data-tm-summary-action="close"])').forEach((control) => {
                control.disabled = loading;
            });
            const preview = root.querySelector('[data-tm-summary="preview"]');
            if (preview) preview.placeholder = loading ? '正在加载摘要数据…' : '';
        };
        setLoading(true);

        root.addEventListener('change', async (e) => {
            if (ctx.loading) return;
            const target = e.target;
            if (!(target instanceof Element)) return;
            const key = String(target.getAttribute('data-tm-summary') || '').trim();
            if (!key) return;
            if (key === 'group') __tmSummaryRefreshDocOptions(root, ctx);
            const filter = __tmSummaryReadFilter(root);
            __tmSummarySaveFilter(filter);
            await __tmSummaryEnsureTasksForFilter(ctx, filter);
            await __tmSummaryEnsureH2Contexts(ctx, filter);
            if (state.summaryModal !== root) return;
            __tmSummaryUpdatePreview(root, ctx);
        });

        root.addEventListener('click', async (e) => {
            const target = e.target?.closest?.('[data-tm-summary-action]');
            if (!target) return;
            const action = String(target.getAttribute('data-tm-summary-action') || '').trim();
            if (action === 'close') {
                __tmCloseSummaryModal();
                return;
            }
            if (ctx.loading) return;
            if (action === 'refresh') {
                const filter = __tmSummaryReadFilter(root);
                await __tmSummaryEnsureTasksForFilter(ctx, filter);
                await __tmSummaryEnsureH2Contexts(ctx, filter);
                if (state.summaryModal !== root) return;
                __tmSummaryUpdatePreview(root, ctx);
                hint('✅ 已生成摘要', 'success');
                return;
            }
            if (action === 'copy') {
                const text = String(root.querySelector('[data-tm-summary="preview"]')?.value || '');
                if (!text.trim()) {
                    hint('⚠️ 没有可复制内容', 'warning');
                    return;
                }
                let ok = false;
                try {
                    if (navigator?.clipboard?.writeText) {
                        await navigator.clipboard.writeText(text);
                        ok = true;
                    }
                } catch (e2) {}
                if (!ok) {
                    try {
                        const ta = root.querySelector('[data-tm-summary="preview"]');
                        ta?.focus?.();
                        ta?.select?.();
                        ok = document.execCommand('copy');
                    } catch (e2) {}
                }
                hint(ok ? '✅ 已复制摘要 Markdown' : '❌ 复制失败', ok ? 'success' : 'error');
                return;
            }
            if (action === 'export') {
                const text = String(root.querySelector('[data-tm-summary="preview"]')?.value || '');
                if (!text.trim()) {
                    hint('⚠️ 没有可导出的内容', 'warning');
                    return;
                }
                const filter = __tmSummaryReadFilter(root);
                const preset = String(filter.preset || 'summary').trim();
                const map = {
                    today_report: 'today-report',
                    this_week_report: 'this-week-report',
                    last_week_report: 'last-week-report',
                };
                const name = `${map[preset] || 'task-summary'}-${__tmSummaryDateFmt(new Date())}.md`;
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
                a.download = name;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    try { URL.revokeObjectURL(a.href); } catch (e2) {}
                    try { a.remove(); } catch (e2) {}
                }, 0);
                hint('✅ 已导出 Markdown', 'success');
            }
        });

        await new Promise((resolve) => requestAnimationFrame(resolve));
        if (state.summaryModal !== root) return;
        const docNamesPromise = __tmSummaryBuildDocNameMapByGroups(docNameMap);
        const groupScope = await __tmSummaryBuildGroupScope();
        const summaryTasksPromise = __tmSummaryLoadTasksByDocs(groupScope.allDocIds);
        const [resolvedDocNameMap, summaryTasks] = await Promise.all([docNamesPromise, summaryTasksPromise]);
        if (state.summaryModal !== root) return;

        Object.assign(docNameMap, resolvedDocNameMap);
        ctx.docToGroup = groupScope.docToGroup;
        ctx.groupDocIdsMap = groupScope.groupDocIdsMap;
        ctx.summaryTasks = summaryTasks;
        summaryTasks.forEach((task) => {
            const docId = String(task?.docId || task?.root_id || '').trim();
            if (!docId) return;
            ctx.docTaskCount[docId] = Number(ctx.docTaskCount[docId] || 0) + 1;
            if (!docNameMap[docId]) docNameMap[docId] = String(task?.docName || '').trim() || docId;
        });
        __tmSummaryRefreshDocOptions(root, ctx);
        __tmSummaryApplySavedFilter(root, savedFilter, { includeDoc: true });
        const initialFilter = __tmSummaryReadFilter(root);
        __tmSummarySaveFilter(initialFilter);
        await __tmSummaryEnsureTasksForFilter(ctx, initialFilter);
        await __tmSummaryEnsureH2Contexts(ctx, initialFilter);
        if (state.summaryModal !== root) return;
        setLoading(false);
        __tmSummaryUpdatePreview(root, ctx);
    };
