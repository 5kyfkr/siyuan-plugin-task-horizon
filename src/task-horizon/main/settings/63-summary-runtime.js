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
        const groupDocIdsMap = {};
        const docGroupIdsMap = {};
        const allDocIds = new Set();
        scopes.filter(Boolean).forEach(({ gid, ids }) => {
            groupDocIdsMap[gid] = ids;
            ids.forEach((id) => {
                allDocIds.add(id);
                if (!Array.isArray(docGroupIdsMap[id])) docGroupIdsMap[id] = [];
                if (!docGroupIdsMap[id].includes(gid)) docGroupIdsMap[id].push(gid);
            });
        });
        Object.values(state.flatTasks || {}).forEach((task) => {
            const docId = String(task?.docId || task?.root_id || '').trim();
            if (docId) allDocIds.add(docId);
        });
        return { groupDocIdsMap, docGroupIdsMap, allDocIds: Array.from(allDocIds) };
    }

    function __tmSummaryStatusName(task, statusMap) {
        const sid = __tmResolveTaskStatusId(task);
        return statusMap.get(sid) || sid || __tmT("ai.notDone");
    }

    function __tmSummaryPriorityText(priority) {
        const p = String(priority || '').trim();
        if (p === 'high') return __tmT("common.high");
        if (p === 'medium') return __tmT("common.medium");
        if (p === 'low') return __tmT("common.low");
        return __tmT("common.none");
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

    function __tmSummaryDateOnlyText(value) {
        const match = String(value || '').trim().match(/^(\d{4}-\d{2}-\d{2})/);
        return match ? match[1] : '';
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
            const docName = String(t.docName || __tmT("kernel.untitledDocument"));
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
            const docName = String(t.docName || t.doc_name || __tmT("kernel.untitledDocument"));
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
            ? __tmT("settings.recurringTask", { occurrence: occurrence, value2: total > 0 ? `/${total}` : '' })
            : __tmT("calendar.recurringTask");
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
        const docGroupIdsMap = (ctx.docGroupIdsMap && typeof ctx.docGroupIdsMap === 'object') ? ctx.docGroupIdsMap : {};
        const f = filter || {};
        const start = String(f.start || '').trim();
        const end = String(f.end || '').trim();
        const statusIds = Array.isArray(f.statusIds) && f.statusIds.length
            ? f.statusIds.map((id) => String(id || '').trim()).filter(Boolean)
            : [String(f.status || '__all__').trim() || '__all__'];
        const priorityIds = Array.isArray(f.priorityIds) && f.priorityIds.length
            ? f.priorityIds.map((id) => String(id || '').trim()).filter(Boolean)
            : [String(f.priority || '__all__').trim() || '__all__'];
        const customFieldFilters = (f.customFieldFilters && typeof f.customFieldFilters === 'object' && !Array.isArray(f.customFieldFilters))
            ? f.customFieldFilters
            : {};
        const customFieldDefs = (Array.isArray(ctx?.customFieldDefs) ? ctx.customFieldDefs : (typeof __tmGetCustomFieldDefs === 'function' ? __tmGetCustomFieldDefs() : []))
            .filter((field) => field?.enabled !== false && ['single', 'multi'].includes(String(field?.type || '').trim()));
        const groupIds = __tmSummaryGetGroupIds(f);
        const allGroupsSelected = groupIds.includes('__all__');
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
            if (!allGroupsSelected) {
                const memberships = Array.isArray(docGroupIdsMap[docId]) ? docGroupIdsMap[docId] : [];
                const matches = groupIds.some((groupId) => memberships.includes(groupId));
                if (!matches) return;
            }

            const done = __tmIsTaskDoneEffective(task);
            const completedAtTs = __tmSummaryTaskCompletedAtTs(task);
            const completionDate = __tmSummaryDateKeyFromTs(completedAtTs);
            const dueDate = __tmSummaryDateOnlyText(task.completionTime || task.completion_time || '');
            const dateKey = done ? completionDate : dueDate;
            if (start && (!dateKey || dateKey < start)) return;
            if (end && (!dateKey || dateKey > end)) return;

            if (!statusIds.includes('__all__')) {
                const taskStatusId = __tmResolveTaskStatusId(task);
                const matchesStatus = statusIds.some((statusId) => {
                    if (statusId === '__done__') return done;
                    if (statusId === '__undone__') return __tmIsTaskActive(task);
                    return taskStatusId === statusId;
                });
                if (!matchesStatus) return;
            }

            const p = String(task.priority || '').trim() || 'none';
            if (!priorityIds.includes('__all__') && !priorityIds.includes(p)) return;

            const matchesCustomFieldFilters = Object.entries(customFieldFilters).every(([fieldId, selectedInput]) => {
                const selection = (selectedInput && typeof selectedInput === 'object' && !Array.isArray(selectedInput)) ? selectedInput : {};
                const selected = Array.isArray(selection.optionIds) ? selection.optionIds.map((id) => String(id || '').trim()).filter(Boolean) : [];
                const includeEmpty = selection.includeEmpty === true;
                if (!selected.length && !includeEmpty) return true;
                const field = customFieldDefs.find((item) => String(item?.id || '').trim() === fieldId);
                if (!field) return true;
                if (typeof __tmIsCustomFieldApplicableToTask === 'function' && !__tmIsCustomFieldApplicableToTask(field, task)) return false;
                const raw = typeof __tmGetTaskCustomFieldValue === 'function'
                    ? __tmGetTaskCustomFieldValue(task, fieldId)
                    : task?.customFieldValues?.[fieldId];
                const normalized = typeof __tmNormalizeCustomFieldValue === 'function'
                    ? __tmNormalizeCustomFieldValue(field, raw)
                    : raw;
                const values = Array.isArray(normalized)
                    ? normalized.map((value) => String(value || '').trim()).filter(Boolean)
                    : (String(normalized || '').trim() ? [String(normalized).trim()] : []);
                return values.length
                    ? values.some((value) => selected.includes(value))
                    : includeEmpty;
            });
            if (!matchesCustomFieldFilters) return;

            const customFieldValues = {};
            (Array.isArray(f.fields?.customFieldIds) ? f.fields.customFieldIds : []).forEach((fieldId0) => {
                const fieldId = String(fieldId0 || '').trim();
                const field = customFieldDefs.find((item) => String(item?.id || '').trim() === fieldId);
                if (!field) return;
                if (typeof __tmIsCustomFieldApplicableToTask === 'function' && !__tmIsCustomFieldApplicableToTask(field, task)) return;
                const raw = typeof __tmGetTaskCustomFieldValue === 'function'
                    ? __tmGetTaskCustomFieldValue(task, fieldId)
                    : task?.customFieldValues?.[fieldId];
                const normalized = typeof __tmNormalizeCustomFieldValue === 'function'
                    ? __tmNormalizeCustomFieldValue(field, raw)
                    : raw;
                const hasValue = Array.isArray(normalized)
                    ? normalized.length > 0
                    : String(normalized || '').trim() !== '';
                customFieldValues[fieldId] = hasValue
                    ? (typeof __tmSerializeCustomFieldValue === 'function'
                        ? __tmSerializeCustomFieldValue(field, normalized)
                        : (Array.isArray(normalized) ? normalized.join(', ') : String(normalized)))
                    : __tmT("common.notSet");
            });

            out.push({
                id: String(task.id || '').trim(),
                content: String(task.content || '').trim() || __tmT("settings.noContent"),
                done,
                taskMarker: __tmResolveTaskMarker(task),
                customStatus: __tmResolveTaskStatusId(task),
                priority: p,
                recurringLabel: __tmSummaryRecurringLabel(task),
                focusDuration: __tmSummaryFormatFocusDuration(task),
                completedAtTs,
                dateKey,
                dueDate,
                completionDate,
                docId,
                docName: String(docNameMap[docId] || task.docName || __tmT("kernel.untitledDocument")),
                customFieldValues,
                h2Id: String(task.h2Id || '').trim(),
                h2Name: String(task.h2 || task.h2Name || '').trim() || __tmT("homepage.noHeading"),
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
        const selectedGroupIds = __tmSummaryGetGroupIds(filter);
        const groupName = __tmSummaryGroupLabel(selectedGroupIds, ctx.groupNameMap, { compact: false });
        const docName = filter.docId === '__all__'
            ? (selectedGroupIds.includes('__all__') ? __tmT("settings.allDocumentsInAllGroups") : __tmT("settings.allDocumentsInTheSelectedGroups"))
            : (ctx.docNameMap?.[String(filter.docId || '')] || __tmT("settings.specifiedDocuments"));
        const selectedStatusIds = Array.isArray(filter.statusIds) && filter.statusIds.length
            ? filter.statusIds.map((id) => String(id || '').trim()).filter(Boolean)
            : [String(filter.status || '__all__').trim() || '__all__'];
        const statusName = selectedStatusIds.includes('__all__')
            ? __tmT("settings.allStatuses")
            : selectedStatusIds.map((id) => id === '__done__' ? __tmT("ai.completed") : (id === '__undone__' ? __tmT("ai.notDone") : (statusMap.get(id) || id))).join('、');
        const selectedPriorityIds = Array.isArray(filter.priorityIds) && filter.priorityIds.length
            ? filter.priorityIds.map((id) => String(id || '').trim()).filter(Boolean)
            : [String(filter.priority || '__all__').trim() || '__all__'];
        const priorityName = selectedPriorityIds.includes('__all__')
            ? __tmT("settings.allPriorities")
            : selectedPriorityIds.map(__tmSummaryPriorityText).join('、');
        const groupBy = String(filter.groupBy || 'status').trim() || 'status';
        const groupByName = groupBy === 'h2'
            ? __tmT("settings.byHeading")
            : (groupBy === 'date' ? __tmT("settings.byCompletionDate") : (groupBy === 'priority' ? __tmT("settings.byPriority") : (groupBy === 'doc' ? __tmT("task.byDocument") : __tmT("settings.byStatus"))));
        const fields = (filter.fields && typeof filter.fields === 'object') ? filter.fields : {};
        const showTaskName = fields.taskName !== false;
        const showDocName = fields.docName !== false;
        const showPriority = fields.priority !== false;
        const showStatus = fields.status !== false;
        const showDueDate = fields.dueDate === true;
        const showCompletionDate = fields.completionDate === true;
        const showFocusDuration = fields.focusDuration !== false;
        const customFieldDefs = (Array.isArray(ctx.customFieldDefs) ? ctx.customFieldDefs : (typeof __tmGetCustomFieldDefs === 'function' ? __tmGetCustomFieldDefs() : []))
            .filter((field) => field?.enabled !== false && ['single', 'multi'].includes(String(field?.type || '').trim()));
        const customFieldDisplayDefs = (Array.isArray(fields.customFieldIds) ? fields.customFieldIds : [])
            .map((fieldId) => customFieldDefs.find((field) => String(field?.id || '').trim() === String(fieldId || '').trim()))
            .filter(Boolean);
        const rangeLabel = (filter.start || filter.end)
            ? `${filter.start || __tmT("settings.earliest")} ~ ${filter.end || __tmT("settings.latest")}`
            : __tmT("settings.allTime");
        const renderTaskDates = (task, options = {}) => {
            const omitPrimary = options.omitPrimary === true;
            const parts = [];
            const dueDate = String(task.dueDate || '').trim();
            const completionDate = String(task.completionDate || '').trim();
            if (showDueDate && dueDate && !(omitPrimary && !task.done)) {
                parts.push(`[${dueDate}]`);
            }
            if (showCompletionDate && completionDate && !(omitPrimary && task.done)) {
                parts.push(`[${completionDate}]`);
            }
            return parts.join(' ');
        };

        lines.push(isDailyReport ? __tmT("settings.todaySReport") : (preset === 'this_week_report' ? __tmT("settings.thisWeekSReport") : (preset === 'last_week_report' ? __tmT("settings.lastWeekSReport") : __tmT("settings.taskSummary"))));
        lines.push('');
        lines.push(__tmT("settings.generatedAt", { now: now }));
        lines.push(__tmT("settings.filters", { rangeLabel: rangeLabel, groupName: groupName, docName: docName, statusName: statusName, priorityName: priorityName, groupByName: groupByName }));
        const selectedCustomFilters = (filter.customFieldFilters && typeof filter.customFieldFilters === 'object') ? filter.customFieldFilters : {};
        const customFilterLabels = Object.entries(selectedCustomFilters).map(([fieldId, selection]) => {
            const field = customFieldDefs.find((item) => String(item?.id || '').trim() === fieldId);
            if (!field) return '';
            const runtime = typeof __tmGetCustomFieldOptionRuntime === 'function' ? __tmGetCustomFieldOptionRuntime(field) : null;
            const names = (Array.isArray(selection?.optionIds) ? selection.optionIds : []).map((id) => {
                const optionId = String(id || '').trim();
                const option = (Array.isArray(field.options) ? field.options : []).find((item) => String(item?.id || '').trim() === optionId);
                return String(runtime?.pathById?.get?.(optionId) || option?.name || optionId).trim();
            }).filter(Boolean);
            if (selection?.includeEmpty === true) names.push(__tmT("common.notSet"));
            return names.length ? `${field.name}: ${names.join('、')}` : '';
        }).filter(Boolean);
        if (customFilterLabels.length) lines.push(__tmT("settings.summaryCustomFieldFilters", { value1: customFilterLabels.join('；') }));
        lines.push('');

        if (!tasks.length && !isDailyReport && !isWeeklyReport) {
            lines.push(__tmT("settings.noTasksMatched"));
            return lines.join('\n');
        }

        const todayKey = __tmSummaryDateFmt(new Date());
        const doneTasks = tasks.filter(t => t.done);
        const todoTasks = tasks.filter(t => __tmIsTaskActive(t));
        const overdueTasks = tasks.filter((t) => __tmIsTaskActive(t) && String(t.dueDate || '').trim() && String(t.dueDate || '').trim() < todayKey);
        if (isDailyReport || isWeeklyReport) {
            const renderTaskLines = (arr) => arr.length
                ? arr.map((t) => {
                    const body = showTaskName ? t.content : __tmT("settings.task");
                    const suffix = [];
                    if (showDocName) suffix.push(t.docName);
                    if (showPriority) suffix.push(__tmT("settings.importance", { pr: __tmSummaryPriorityText(t.priority) }));
                    if (showStatus) suffix.push(__tmSummaryStatusName(t, statusMap));
                    customFieldDisplayDefs.forEach((field) => {
                        const value = String(t.customFieldValues?.[String(field.id || '').trim()] || '').trim();
                        if (value) suffix.push(`${field.name}:${value}`);
                    });
                    if (t.recurringLabel) suffix.push(t.recurringLabel);
                    if (showFocusDuration && t.focusDuration) suffix.push(__tmT("settings.focusTime", { focusDuration: t.focusDuration }));
                    const dates = renderTaskDates(t);
                    return `- [${__tmResolveTaskMarker(t)}] ${body}${dates ? ` ${dates}` : ''}${suffix.length ? `（${suffix.join('｜')}）` : ''}`;
                }).join('\n')
                : __tmT("settings.none");
            const renderReportGroup = (title, arr, visibleTasks = arr) => {
                lines.push(`${__tmT(title)}（${arr.length}）`);
                lines.push('');
                lines.push(renderTaskLines(visibleTasks));
                lines.push('');
            };
            renderReportGroup("settings.completion", doneTasks);
            renderReportGroup("settings.planned", todoTasks, todoTasks.slice(0, 30));
            renderReportGroup("settings.overdue", overdueTasks);
            return lines.join('\n');
        }

        const sectionMap = new Map();
        const sectionLabel = (t) => {
            if (groupBy === 'h2') return String(t.h2Name || __tmT("homepage.noHeading"));
            if (groupBy === 'date') return String(t.dateKey || __tmT("settings.noDateSet"));
            if (groupBy === 'priority') return __tmT("settings.priority", { value1: __tmSummaryPriorityText(t.priority) });
            if (groupBy === 'doc') return String(t.docName || __tmT("kernel.untitledDocument"));
            return __tmSummaryStatusName(t, statusMap);
        };
        tasks.forEach((t) => {
            const key = sectionLabel(t);
            if (!sectionMap.has(key)) sectionMap.set(key, []);
            sectionMap.get(key).push(t);
        });

        const sectionOrder = Array.from(sectionMap.keys()).sort((a, b) => {
            if (groupBy === 'date') {
                const missingDate = __tmT("settings.noDateSet");
                if (a === missingDate) return -1;
                if (b === missingDate) return 1;
            }
            return String(a).localeCompare(String(b), 'zh-Hans-CN');
        });
        sectionOrder.forEach((name) => {
            const arr = sectionMap.get(name) || [];
            lines.push(`## ${name}（${arr.length}）`);
            lines.push('');
            arr.forEach((t) => {
                const dates = renderTaskDates(t, { omitPrimary: groupBy === 'date' });
                const pr = __tmSummaryPriorityText(t.priority);
                const checkbox = t.done ? '[x]' : '[ ]';
                const body = showTaskName ? t.content : __tmT("settings.task");
                const ext = [];
                const level = Math.max(0, Number(t.level) || 0);
                const indent = '  '.repeat(level);
                if (showDocName && groupBy !== 'doc') ext.push(t.docName);
                if (showPriority) ext.push(__tmT("settings.importance", { pr: pr }));
                if (showStatus) ext.push(__tmSummaryStatusName(t, statusMap));
                customFieldDisplayDefs.forEach((field) => {
                    const value = String(t.customFieldValues?.[String(field.id || '').trim()] || '').trim();
                    if (value) ext.push(`${field.name}:${value}`);
                });
                if (t.recurringLabel) ext.push(t.recurringLabel);
                if (showFocusDuration && t.focusDuration) ext.push(__tmT("settings.focusTime", { focusDuration: t.focusDuration }));
                lines.push(`${indent}- ${checkbox} ${body}${dates ? ` ${dates}` : ''}${ext.length ? `（${ext.join('｜')}）` : ''}`);
            });
            lines.push('');
        });

        const doneCount = tasks.filter(t => t.done).length;
        lines.push('---');
        lines.push('');
        lines.push(__tmT("settings.total", { length: tasks.length }));
        lines.push(__tmT("settings.completed", { doneCount: doneCount }));
        lines.push(__tmT("settings.unfinished", { value1: tasks.length - doneCount }));
        return lines.join('\n');
    }

    const __TM_SUMMARY_FILTER_STORAGE_KEY = 'tm_summary_filter';

    function __tmSummaryNormalizeGroupIds(value) {
        const source = Array.isArray(value) ? value : [value];
        const ids = Array.from(new Set(source
            .map((id) => String(id || '').trim())
            .filter((id) => id !== '__ungrouped__')
            .filter(Boolean)));
        if (!ids.length || ids.includes('__all__')) return ['__all__'];
        return ids;
    }

    function __tmSummaryGetGroupIds(filter) {
        if (Array.isArray(filter?.groupIds)) return __tmSummaryNormalizeGroupIds(filter.groupIds);
        return __tmSummaryNormalizeGroupIds(filter?.groupId || '__all__');
    }

    function __tmSummaryGroupLabel(groupIds, groupNameMap, options = {}) {
        const ids = __tmSummaryNormalizeGroupIds(groupIds);
        if (ids.includes('__all__')) return __tmT("settings.allGroups");
        const names = ids.map((id) => String(groupNameMap?.[id] || id)).filter(Boolean);
        if (names.length === 1 || options.compact === false) return names.join('、');
        return __tmT("settings.selectedGroups", { length: names.length });
    }

    function __tmSummaryNormalizeOptionIds(value, allOptionId = '') {
        const source = Array.isArray(value) ? value : [value];
        const ids = Array.from(new Set(source.map((id) => String(id || '').trim()).filter(Boolean)));
        return allOptionId && ids.includes(allOptionId) ? [allOptionId] : ids;
    }

    function __tmSummaryReadMultiPicker(root, key) {
        return __tmSummaryNormalizeOptionIds(Array.from(root?.querySelectorAll?.('[data-tm-summary-multi-option]:checked') || [])
            .filter((option) => String(option?.dataset?.tmSummaryOptionGroup || '') === String(key || ''))
            .map((option) => option.value));
    }

    function __tmSummarySyncMultiPicker(root, key, values, options = {}) {
        const optionEls = Array.from(root?.querySelectorAll?.('[data-tm-summary-multi-option]') || [])
            .filter((option) => String(option?.dataset?.tmSummaryOptionGroup || '') === String(key || ''));
        const allOptionId = String(options.allOptionId || '').trim();
        const available = new Set(optionEls.map((option) => String(option.value || '').trim()).filter(Boolean));
        let ids = __tmSummaryNormalizeOptionIds(values, allOptionId).filter((id) => available.has(id));
        if (allOptionId && (!ids.length || ids.includes(allOptionId))) ids = [allOptionId];
        const selected = new Set(ids);
        optionEls.forEach((option) => { option.checked = selected.has(String(option.value || '').trim()); });
        const picker = optionEls[0]?.closest?.('[data-tm-summary-multi-picker]');
        const label = picker?.querySelector?.('[data-tm-summary-picker-label]');
        if (label) {
            const names = optionEls.filter((option) => option.checked)
                .map((option) => String(option.dataset.tmSummaryOptionLabel || '').trim()).filter(Boolean);
            label.textContent = ids.includes(allOptionId) && allOptionId
                ? String(options.allLabel || names[0] || '')
                : (names.length ? names.join('、') : String(options.triggerLabel || label.dataset.tmSummaryPickerPlaceholder || ''));
        }
        return ids;
    }

    function __tmSummaryHandleMultiOptionChange(root, option) {
        const key = String(option?.dataset?.tmSummaryOptionGroup || '').trim();
        if (!key) return [];
        const groupOptions = Array.from(root?.querySelectorAll?.('[data-tm-summary-multi-option]') || [])
            .filter((item) => String(item?.dataset?.tmSummaryOptionGroup || '') === key);
        const allOption = groupOptions.find((item) => String(item?.dataset?.tmSummaryAllOption || '').trim());
        const allOptionId = String(allOption?.dataset?.tmSummaryAllOption || '').trim();
        let ids = __tmSummaryReadMultiPicker(root, key);
        const id = String(option?.value || '').trim();
        if (allOptionId && id === allOptionId && option.checked) {
            ids = [allOptionId];
        } else if (option.checked) {
            ids = ids.filter((item) => item !== allOptionId);
            if (!ids.includes(id)) ids.push(id);
        } else {
            ids = ids.filter((item) => item !== id);
        }
        return __tmSummarySyncMultiPicker(root, key, ids, {
            allOptionId,
            allLabel: allOption?.dataset?.tmSummaryOptionLabel || '',
        });
    }

    function __tmSummaryReadStatusIds(root) {
        return __tmSummaryReadMultiPicker(root, 'status');
    }

    function __tmSummaryReadCustomFieldFilters(root) {
        const filters = {};
        root?.querySelectorAll?.('[data-tm-summary-custom-filter]')?.forEach((picker) => {
            const fieldId = String(picker.getAttribute('data-tm-summary-custom-filter') || '').trim();
            const tokens = __tmSummaryReadMultiPicker(root, `custom:${fieldId}`);
            const optionIds = tokens.filter((id) => id.startsWith('option:')).map((id) => id.slice('option:'.length)).filter(Boolean);
            const includeEmpty = tokens.includes('__empty__');
            if (fieldId && (optionIds.length || includeEmpty)) filters[fieldId] = { optionIds, includeEmpty };
        });
        return filters;
    }

    function __tmSummaryRenderMultiPicker(options = {}) {
        const key = String(options.key || '').trim();
        const items = Array.isArray(options.items) ? options.items : [];
        const allOptionId = String(options.allOptionId || '').trim();
        const allLabel = String(options.allLabel || '').trim();
        const pickerAttribute = String(options.pickerAttribute || '').trim();
        const ariaLabel = String(options.ariaLabel || allLabel || '').trim();
        const markup = items.map((item) => {
            const id = String(item?.id || '').trim();
            const value = String(item?.value == null ? id : item.value);
            const name = String(item?.name || id);
            return `<label class="tm-summary-group-option"><input type="checkbox" data-tm-summary-multi-option data-tm-summary-option-group="${esc(key)}" data-tm-summary-option-label="${esc(name)}" value="${esc(value)}"${allOptionId && id === allOptionId ? ` data-tm-summary-all-option="${esc(allOptionId)}" checked` : ''}><span>${esc(name)}</span></label>`;
        }).join('');
        const defaultLabel = allLabel || String(options.triggerLabel || items[0]?.name || '');
        return `<details class="tm-summary-group-picker tm-summary-multi-picker" data-tm-summary-multi-picker ${pickerAttribute}>
            <summary class="tm-rule-select tm-summary-group-trigger" aria-label="${esc(ariaLabel)}">
                <span data-tm-summary-picker-label data-tm-summary-picker-placeholder="${esc(defaultLabel)}">${esc(defaultLabel)}</span><span class="tm-summary-group-trigger__icon" aria-hidden="true">${__tmLucideIconSvg('caret-down', { size: 14, className: 'tm-inline-icon__svg' })}</span>
            </summary>
            <div class="tm-summary-group-menu" role="group" aria-label="${esc(ariaLabel)}">${markup}</div>
        </details>`;
    }

    function __tmSummaryReadGroupIds(root) {
        const options = Array.from(root?.querySelectorAll?.('[data-tm-summary-group-option]:checked') || []);
        if (options.length) return __tmSummaryNormalizeGroupIds(options.map((option) => option.value));
        const hidden = root?.querySelector?.('[data-tm-summary="group"]');
        const raw = String(hidden?.value || '__all__').trim();
        return __tmSummaryNormalizeGroupIds(raw ? raw.split(',') : ['__all__']);
    }

    function __tmSummarySyncGroupPicker(root, groupIds = null) {
        const requested = __tmSummaryNormalizeGroupIds(groupIds || __tmSummaryReadGroupIds(root));
        const available = new Set(Array.from(root?.querySelectorAll?.('[data-tm-summary-group-option]') || [])
            .map((option) => String(option.value || '').trim())
            .filter(Boolean));
        const ids = requested.includes('__all__')
            ? ['__all__']
            : requested.filter((id) => available.has(id));
        if (!ids.length && available.has('__all__')) ids.push('__all__');
        const selected = new Set(ids);
        root?.querySelectorAll?.('[data-tm-summary-group-option]').forEach((option) => {
            option.checked = selected.has(String(option.value || '').trim());
        });
        const hidden = root?.querySelector?.('[data-tm-summary="group"]');
        if (hidden) hidden.value = ids.join(',');
        const label = root?.querySelector?.('[data-tm-summary-group-label]');
        if (label) label.textContent = __tmSummaryGroupLabel(ids, root?.__tmSummaryGroupNameMap || {});
        return ids;
    }

    function __tmSummaryHandleGroupOptionChange(root, option) {
        const id = String(option?.value || '').trim();
        let ids = __tmSummaryReadGroupIds(root);
        if (id === '__all__' && option.checked) {
            ids = ['__all__'];
        } else if (id === '__all__' && !option.checked) {
            ids = ids.filter((item) => item !== '__all__');
        } else if (option.checked) {
            ids = ids.filter((item) => item !== '__all__');
            if (!ids.includes(id)) ids.push(id);
        } else {
            ids = ids.filter((item) => item !== id);
        }
        return __tmSummarySyncGroupPicker(root, ids.length ? ids : ['__all__']);
    }

    function __tmSummaryNormalizeSavedFilter(value) {
        const source = (value && typeof value === 'object' && !Array.isArray(value)) ? value : null;
        if (!source) return null;
        const allowedPreset = new Set(['all', 'today_report', 'this_week_report', 'last_week_report', 'today', 'this_week', 'last_week', 'this_month', 'last_month', 'custom']);
        const allowedGroupBy = new Set(['status', 'date', 'priority', 'doc', 'h2']);
        const fields = (source.fields && typeof source.fields === 'object' && !Array.isArray(source.fields)) ? source.fields : {};
        const booleanOr = (key, fallback) => typeof fields[key] === 'boolean' ? fields[key] : fallback;
        const legacyDate = typeof fields.date === 'boolean' ? fields.date : false;
        const preset = String(source.preset || '').trim();
        const groupBy = String(source.groupBy || '').trim();
        const sourceGroupIds = Array.isArray(source.groupIds)
            ? source.groupIds
            : [String(source.groupId || '__all__').trim() || '__all__'];
        const groupIds = Array.from(new Set(sourceGroupIds
            .map((id) => String(id || '').trim())
            .filter((id) => id && id !== '__ungrouped__')));
        if (!groupIds.length || groupIds.includes('__all__')) groupIds.splice(0, groupIds.length, '__all__');
        const statusIds = __tmSummaryNormalizeOptionIds(
            Array.isArray(source.statusIds) ? source.statusIds : [String(source.status || '__all__').trim() || '__all__'],
            '__all__',
        );
        const allowedPriorityIds = new Set(['__all__', 'high', 'medium', 'low', 'none']);
        const priorityIds = __tmSummaryNormalizeOptionIds(
            Array.isArray(source.priorityIds) ? source.priorityIds : [String(source.priority || '__all__').trim() || '__all__'],
            '__all__',
        ).filter((id) => allowedPriorityIds.has(id));
        const customFieldFilters = {};
        if (source.customFieldFilters && typeof source.customFieldFilters === 'object' && !Array.isArray(source.customFieldFilters)) {
            Object.entries(source.customFieldFilters).forEach(([fieldId, optionIds]) => {
                const id = String(fieldId || '').trim();
                const sourceSelection = (optionIds && typeof optionIds === 'object' && !Array.isArray(optionIds)) ? optionIds : {};
                const selected = __tmSummaryNormalizeOptionIds(sourceSelection.optionIds);
                const includeEmpty = sourceSelection.includeEmpty === true;
                if (id && (selected.length || includeEmpty)) customFieldFilters[id] = { optionIds: selected, includeEmpty };
            });
        }
        const normalized = {
            preset: allowedPreset.has(preset) ? preset : 'this_week',
            start: __tmNormalizeDateOnly(source.start || ''),
            end: __tmNormalizeDateOnly(source.end || ''),
            groupId: groupIds.length === 1 ? groupIds[0] : '__all__',
            docId: String(source.docId || '__all__').trim() || '__all__',
            statusIds: statusIds.length ? statusIds : ['__all__'],
            priorityIds: priorityIds.length ? priorityIds : ['__all__'],
            customFieldFilters,
            groupBy: allowedGroupBy.has(groupBy) ? groupBy : 'status',
            fields: {
                taskName: booleanOr('taskName', true),
                docName: booleanOr('docName', false),
                priority: booleanOr('priority', false),
                status: booleanOr('status', false),
                dueDate: booleanOr('dueDate', legacyDate),
                completionDate: booleanOr('completionDate', legacyDate),
                focusDuration: booleanOr('focusDuration', false),
                customFieldIds: Array.from(new Set((Array.isArray(fields.customFieldIds) ? fields.customFieldIds : [])
                    .map((id) => String(id || '').trim()).filter(Boolean))),
            },
        };
        // Keep the legacy normalized shape stable while persisting the new multi-select value.
        if (Array.isArray(source.groupIds)) normalized.groupIds = groupIds;
        return normalized;
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
        __tmSummarySyncGroupPicker(root, __tmSummaryGetGroupIds(filter));
        if (options.includeDoc === true) setValue('doc', filter.docId, '__all__');
        __tmSummarySyncMultiPicker(root, 'status', filter.statusIds || [filter.status || '__all__'], {
            allOptionId: '__all__',
            allLabel: __tmT("settings.allStatuses"),
        });
        __tmSummarySyncMultiPicker(root, 'priority', filter.priorityIds || [filter.priority || '__all__'], {
            allOptionId: '__all__',
            allLabel: __tmT("settings.allPriorities"),
        });
        setValue('groupBy', filter.groupBy, 'status');
        const customFieldFilters = (filter.customFieldFilters && typeof filter.customFieldFilters === 'object') ? filter.customFieldFilters : {};
        root.querySelectorAll('[data-tm-summary-custom-filter]').forEach((picker) => {
            const fieldId = String(picker.getAttribute('data-tm-summary-custom-filter') || '').trim();
            const selection = customFieldFilters[fieldId] || {};
            const tokens = [
                ...(Array.isArray(selection.optionIds) ? selection.optionIds.map((id) => `option:${id}`) : []),
                ...(selection.includeEmpty === true ? ['__empty__'] : []),
            ];
            __tmSummarySyncMultiPicker(root, `custom:${fieldId}`, tokens);
        });
        Object.entries({
            fieldTaskName: filter.fields?.taskName !== false,
            fieldDocName: filter.fields?.docName === true,
            fieldPriority: filter.fields?.priority === true,
            fieldStatus: filter.fields?.status === true,
            fieldDueDate: filter.fields?.dueDate === true,
            fieldCompletionDate: filter.fields?.completionDate === true,
            fieldFocusDuration: filter.fields?.focusDuration === true,
        }).forEach(([key, checked]) => {
            const control = root.querySelector(`[data-tm-summary="${key}"]`);
            if (control) control.checked = checked;
        });
        const selectedCustomFieldIds = new Set(Array.isArray(filter.fields?.customFieldIds) ? filter.fields.customFieldIds.map((id) => String(id || '').trim()) : []);
        root.querySelectorAll('[data-tm-summary-custom-field-display]').forEach((control) => {
            control.checked = selectedCustomFieldIds.has(String(control.value || '').trim());
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
        const groupIds = __tmSummaryReadGroupIds(root);
        return {
            preset,
            start: __tmNormalizeDateOnly(start),
            end: __tmNormalizeDateOnly(end),
            groupIds,
            groupId: groupIds.length === 1 ? groupIds[0] : '__all__',
            docId: String(q('[data-tm-summary="doc"]')?.value || '__all__').trim(),
            statusIds: __tmSummaryReadStatusIds(root),
            priorityIds: __tmSummaryReadMultiPicker(root, 'priority'),
            customFieldFilters: __tmSummaryReadCustomFieldFilters(root),
            groupBy: String(q('[data-tm-summary="groupBy"]')?.value || 'status').trim(),
            fields: {
                taskName: q('[data-tm-summary="fieldTaskName"]')?.checked !== false,
                docName: q('[data-tm-summary="fieldDocName"]')?.checked !== false,
                priority: q('[data-tm-summary="fieldPriority"]')?.checked !== false,
                status: q('[data-tm-summary="fieldStatus"]')?.checked !== false,
                dueDate: q('[data-tm-summary="fieldDueDate"]')?.checked === true,
                completionDate: q('[data-tm-summary="fieldCompletionDate"]')?.checked === true,
                focusDuration: q('[data-tm-summary="fieldFocusDuration"]')?.checked !== false,
                customFieldIds: Array.from(root.querySelectorAll('[data-tm-summary-custom-field-display]:checked'))
                    .map((control) => String(control.value || '').trim()).filter(Boolean),
            },
        };
    }

    function __tmSummaryRefreshDocOptions(root, ctx) {
        const docSel = root.querySelector('[data-tm-summary="doc"]');
        if (!docSel) return;
        const prevDoc = String(docSel.value || '__all__').trim();
        const groupIds = __tmSummaryReadGroupIds(root);
        const allGroups = groupIds.includes('__all__');
        const docTaskCount = (ctx.docTaskCount && typeof ctx.docTaskCount === 'object') ? ctx.docTaskCount : {};
        const groupDocIdsMap = (ctx.groupDocIdsMap && typeof ctx.groupDocIdsMap === 'object') ? ctx.groupDocIdsMap : {};
        const allLabel = allGroups
            ? __tmT("settings.allDocumentsInAllGroups")
            : __tmT("settings.allDocumentsInTheSelectedGroups");
        const options = [{ id: '__all__', name: allLabel }];
        const ids = new Set();
        if (allGroups) {
            Object.entries(ctx.docNameMap || {}).forEach(([docId]) => {
                if (Number(docTaskCount[String(docId)] || 0)) ids.add(String(docId));
            });
        } else {
            groupIds.forEach((gid) => {
                (Array.isArray(groupDocIdsMap[gid]) ? groupDocIdsMap[gid] : []).forEach((docId) => ids.add(String(docId)));
            });
        }
        Array.from(ids).forEach((docId) => {
            const id = String(docId || '').trim();
            if (!id) return;
            const name = String((ctx.docNameMap || {})[id] || id);
            options.push({ id, name });
        });
        docSel.innerHTML = options
            .filter((it, idx, arr) => arr.findIndex((x) => String(x.id) === String(it.id)) === idx)
            .sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-Hans-CN'))
            .map((it) => `<option value="${esc(it.id)}">${esc(it.name)}</option>`)
            .join('');
        docSel.value = options.some(it => it.id === prevDoc) ? prevDoc : '__all__';
        __tmSummarySyncGroupPicker(root, groupIds);
    }

    async function __tmSummaryEnsureTasksForFilter(ctx, filter) {
        if (!ctx || typeof ctx !== 'object') return;
        const f = (filter && typeof filter === 'object') ? filter : {};
        const groupDocIdsMap = (ctx.groupDocIdsMap && typeof ctx.groupDocIdsMap === 'object') ? ctx.groupDocIdsMap : {};
        let targetDocIds = [];
        const docId = String(f.docId || '__all__').trim();
        const groupIds = __tmSummaryGetGroupIds(f);
        if (docId && docId !== '__all__') {
            targetDocIds = [docId];
        } else if (!groupIds.includes('__all__')) {
            const ids = new Set();
            groupIds.forEach((groupId) => {
                (Array.isArray(groupDocIdsMap[groupId]) ? groupDocIdsMap[groupId] : []).forEach((id) => ids.add(String(id)));
            });
            targetDocIds = Array.from(ids);
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
        const outsideCloseHandler = state.summaryModal.__tmSummaryOutsideCloseHandler;
        if (outsideCloseHandler) {
            try { document.removeEventListener('pointerdown', outsideCloseHandler, true); } catch (e) {}
            state.summaryModal.__tmSummaryOutsideCloseHandler = null;
        }
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
        const groupNameMap = { '__all__': __tmT("settings.allGroups") };
        groups.forEach((g) => {
            const gid = String(g?.id || '').trim();
            if (gid) groupNameMap[gid] = __tmResolveDocGroupName(g);
        });

        const groupOptions = [
            { id: '__all__', name: '全部分组' },
            ...groups.map((g) => ({ id: String(g?.id || '').trim(), name: __tmResolveDocGroupName(g) })).filter(g => g.id)
        ];
        const statusSelectOptions = [
            { id: '__all__', name: __tmT("settings.allStatuses") },
            { id: '__done__', name: __tmT("ai.completed") },
            { id: '__undone__', name: __tmT("ai.notDone") },
            ...Array.from(statusMap.keys()).map((id) => ({ id, name: statusMap.get(id) || id }))
        ];
        const customFieldDefs = (typeof __tmGetCustomFieldDefs === 'function' ? __tmGetCustomFieldDefs() : [])
            .filter((field) => field?.enabled !== false && ['single', 'multi'].includes(String(field?.type || '').trim()));
        const statusPickerMarkup = __tmSummaryRenderMultiPicker({
            key: 'status',
            items: statusSelectOptions,
            allOptionId: '__all__',
            allLabel: __tmT("settings.allStatuses"),
            ariaLabel: __tmT("kernel.status"),
        });
        const priorityPickerMarkup = __tmSummaryRenderMultiPicker({
            key: 'priority',
            items: [
                { id: '__all__', name: __tmT("settings.allPriorities") },
                { id: 'high', name: __tmT("common.high") },
                { id: 'medium', name: __tmT("common.medium") },
                { id: 'low', name: __tmT("common.low") },
                { id: 'none', name: __tmT("common.none") },
            ],
            allOptionId: '__all__',
            allLabel: __tmT("settings.allPriorities"),
            ariaLabel: __tmT("kernel.importance"),
        });
        const customFieldFilterMarkup = customFieldDefs.map((field) => {
            const fieldId = String(field?.id || '').trim();
            if (!fieldId) return '';
            const runtime = typeof __tmGetCustomFieldOptionRuntime === 'function' ? __tmGetCustomFieldOptionRuntime(field) : null;
            const items = (Array.isArray(runtime?.options) ? runtime.options : (Array.isArray(field.options) ? field.options : []))
                .map((option) => {
                    const id = String(option?.id || '').trim();
                    if (!id) return null;
                    return { id, value: `option:${id}`, name: runtime?.pathById?.get?.(id) || String(option?.name || id) };
                }).filter(Boolean);
            items.push({ id: '__empty__', value: '__empty__', name: __tmT("common.notSet") });
            return __tmSummaryRenderMultiPicker({
                key: `custom:${fieldId}`,
                items,
                triggerLabel: String(field.name || fieldId),
                ariaLabel: String(field.name || fieldId),
                pickerAttribute: `data-tm-summary-custom-filter="${esc(fieldId)}"`,
            });
        }).join('');
        const customFieldDisplayMarkup = customFieldDefs.map((field) => {
            const fieldId = String(field?.id || '').trim();
            if (!fieldId) return '';
            return `<label style="display:inline-flex;align-items:center;gap:4px;"><input type="checkbox" data-tm-summary="customFieldDisplay" data-tm-summary-custom-field-display value="${esc(fieldId)}">${esc(field.name || fieldId)}</label>`;
        }).join('');

        const isMobileSummary = __tmIsMobileDevice();
        state.summaryModal = document.createElement('div');
        state.summaryModal.className = `tm-modal tm-summary-modal${isMobileSummary ? ' tm-modal--mobile' : ''}`;
        state.summaryModal.style.cssText = 'z-index: 200001;';
        const box = document.createElement('div');
        box.className = 'tm-box tm-summary-box';
        box.innerHTML = `
            <div class="tm-header" style="padding:12px 16px;border-bottom:1px solid var(--tm-border-color);">
                <div style="font-size:16px;font-weight:600;">${__tmT("settings.taskSummary2")}</div>
                <button class="tm-btn tm-btn-gray" data-tm-summary-action="close" style="padding:4px 8px;font-size:12px;">✕</button>
            </div>
            <div class="tm-body tm-summary-body" style="padding:12px 16px;display:flex;flex-direction:column;gap:10px;overflow:auto;">
                <div class="tm-summary-toolbar" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                    <select class="tm-rule-select" data-tm-summary="preset" style="min-width:110px;">
                        <option value="all">${__tmT("settings.allTime")}</option>
                        <option value="today_report">${__tmT("settings.todaySReport2")}</option>
                        <option value="this_week_report">${__tmT("settings.thisWeekSReport2")}</option>
                        <option value="last_week_report">${__tmT("settings.lastWeekSReport2")}</option>
                        <option value="today">${__tmT("common.today")}</option>
                        <option value="this_week" selected>${__tmT("task.thisWeek")}</option>
                        <option value="last_week">${__tmT("settings.lastWeek")}</option>
                        <option value="this_month">${__tmT("task.thisMonth")}</option>
                        <option value="last_month">${__tmT("calendar.lastMonth")}</option>
                        <option value="custom">${__tmT("settings.custom")}</option>
                    </select>
                    <input class="tm-input" type="date" data-tm-summary="start" style="width:140px;">
                    <span style="color:var(--tm-secondary-text);">~</span>
                    <input class="tm-input" type="date" data-tm-summary="end" style="width:140px;">
                    <details class="tm-summary-group-picker" data-tm-summary-group-picker>
                        <summary class="tm-rule-select tm-summary-group-trigger" data-tm-summary-group-trigger aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.chooseDocumentGroupsForTheSummary")}">
                            <span data-tm-summary-group-label>${__tmT("settings.allGroups")}</span><span class="tm-summary-group-trigger__icon" aria-hidden="true">${__tmLucideIconSvg('caret-down', { size: 14, className: 'tm-inline-icon__svg' })}</span>
                        </summary>
                        <div class="tm-summary-group-menu" data-tm-summary-group-menu role="listbox" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.summarydocumentGroupsscope")}" aria-multiselectable="true">
                            ${groupOptions.map((g) => `<label class="tm-summary-group-option"><input type="checkbox" data-tm-summary-group-option value="${esc(g.id)}"${g.id === '__all__' ? ' checked' : ''}><span>${esc(g.name)}</span></label>`).join('')}
                        </div>
                    </details>
                    <input type="hidden" data-tm-summary="group" value="__all__">
                    <select class="tm-rule-select" data-tm-summary="doc" style="min-width:160px;"></select>
                    ${statusPickerMarkup}
                    ${priorityPickerMarkup}
                    <select class="tm-rule-select" data-tm-summary="groupBy" style="min-width:130px;">
                        <option value="status">${__tmT("settings.groupByStatus")}</option>
                        <option value="date">${__tmT("settings.groupByCompletionDate")}</option>
                        <option value="priority">${__tmT("settings.groupByPriority")}</option>
                        <option value="doc">${__tmT("calendar.groupByDocument")}</option>
                        <option value="h2">${__tmT("settings.groupByHeading")}</option>
                    </select>
                    ${customFieldFilterMarkup}
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;color:var(--tm-secondary-text);font-size:12px;">
                    <span>${__tmT("settings.fields")}</span>
                    <label style="display:inline-flex;align-items:center;gap:4px;"><input type="checkbox" data-tm-summary="fieldTaskName" checked>${__tmT("task.taskName")}</label>
                    <label style="display:inline-flex;align-items:center;gap:4px;"><input type="checkbox" data-tm-summary="fieldDocName">${__tmT("task.documentName")}</label>
                    <label style="display:inline-flex;align-items:center;gap:4px;"><input type="checkbox" data-tm-summary="fieldPriority">${__tmT("kernel.importance")}</label>
                    <label style="display:inline-flex;align-items:center;gap:4px;"><input type="checkbox" data-tm-summary="fieldStatus">${__tmT("kernel.status")}</label>
                    <label style="display:inline-flex;align-items:center;gap:4px;"><input type="checkbox" data-tm-summary="fieldDueDate">${__tmT("kernel.dueDate")}</label>
                    <label style="display:inline-flex;align-items:center;gap:4px;"><input type="checkbox" data-tm-summary="fieldCompletionDate">${__tmT("calendar.completionDate")}</label>
                    <label style="display:inline-flex;align-items:center;gap:4px;"><input type="checkbox" data-tm-summary="fieldFocusDuration">${__tmT("settings.focusTime2")}</label>
                    ${customFieldDisplayMarkup}
                </div>
                <textarea class="tm-summary-preview" data-tm-summary="preview" style="width:100%;height:100%;box-sizing:border-box;padding:12px;font-size:0.875rem;line-height:1.55;background:var(--tm-input-bg);color:var(--tm-text-color);border:1px solid var(--tm-input-border);border-radius:8px;resize:vertical;"></textarea>
            </div>
            <div class="tm-header tm-summary-footer" style="padding:12px 16px;border-top:1px solid var(--tm-border-color);justify-content:flex-end;gap:10px;">
                <button class="tm-btn tm-btn-secondary" data-tm-summary-action="refresh" style="padding:8px 16px;">${__tmT("settings.generate")}</button>
                <button class="tm-btn tm-btn-primary" data-tm-summary-action="copy" style="padding:8px 16px;">${__tmT("task.copy")}</button>
                <button class="tm-btn tm-btn-primary" data-tm-summary-action="export" style="padding:8px 16px;">${__tmT("settings.export")}</button>
            </div>
        `;
        state.summaryModal.appendChild(box);
        document.body.appendChild(state.summaryModal);
        if (isMobileSummary) {
            try { __tmApplyMobileBrowserViewportMetrics(state.summaryModal); } catch (e) {}
        }
        state.__summaryUnstack = __tmModalStackBind(() => __tmCloseSummaryModal());

        const root = state.summaryModal;
        root.__tmSummaryGroupNameMap = groupNameMap;
        const closeOtherPickers = (event) => {
            const target = event?.target;
            const activePicker = target instanceof Element
                ? target.closest('[data-tm-summary-group-picker], [data-tm-summary-multi-picker]')
                : null;
            if (!(target instanceof Node) || !root.contains(target)) {
                root.querySelectorAll('[data-tm-summary-group-picker][open], [data-tm-summary-multi-picker][open]')
                    .forEach((picker) => { picker.open = false; });
                return;
            }
            root.querySelectorAll('[data-tm-summary-group-picker][open], [data-tm-summary-multi-picker][open]')
                .forEach((picker) => { if (picker !== activePicker) picker.open = false; });
        };
        root.__tmSummaryOutsideCloseHandler = closeOtherPickers;
        document.addEventListener('pointerdown', closeOtherPickers, true);
        const savedFilter = __tmSummaryLoadSavedFilter();
        const ctx = {
            docNameMap,
            docTaskCount: {},
            groupDocIdsMap: {},
            docGroupIdsMap: {},
            allDocIds: [],
            statusMap,
            groupNameMap,
            customFieldDefs,
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
            root.querySelectorAll('[data-tm-summary-group-option]').forEach((control) => {
                control.disabled = loading;
            });
            root.querySelectorAll('[data-tm-summary-multi-option]').forEach((control) => {
                control.disabled = loading;
            });
            const groupTrigger = root.querySelector('[data-tm-summary-group-trigger]');
            if (groupTrigger) groupTrigger.setAttribute('aria-disabled', loading ? 'true' : 'false');
            const preview = root.querySelector('[data-tm-summary="preview"]');
            if (preview) preview.placeholder = loading ? __tmT("settings.loadingSummaryData") : '';
        };
        setLoading(true);

        root.addEventListener('change', async (e) => {
            if (ctx.loading) return;
            const target = e.target;
            if (!(target instanceof Element)) return;
            if (target.matches('[data-tm-summary-group-option]')) {
                __tmSummaryHandleGroupOptionChange(root, target);
                __tmSummaryRefreshDocOptions(root, ctx);
                const filter = __tmSummaryReadFilter(root);
                __tmSummarySaveFilter(filter);
                await __tmSummaryEnsureTasksForFilter(ctx, filter);
                await __tmSummaryEnsureH2Contexts(ctx, filter);
                if (state.summaryModal !== root) return;
                __tmSummaryUpdatePreview(root, ctx);
                return;
            }
            if (target.matches('[data-tm-summary-multi-option]')) {
                __tmSummaryHandleMultiOptionChange(root, target);
                const filter = __tmSummaryReadFilter(root);
                __tmSummarySaveFilter(filter);
                await __tmSummaryEnsureTasksForFilter(ctx, filter);
                await __tmSummaryEnsureH2Contexts(ctx, filter);
                if (state.summaryModal !== root) return;
                __tmSummaryUpdatePreview(root, ctx);
                return;
            }
            const key = String(target.getAttribute('data-tm-summary') || '').trim();
            if (!key) return;
            const filter = __tmSummaryReadFilter(root);
            __tmSummarySaveFilter(filter);
            await __tmSummaryEnsureTasksForFilter(ctx, filter);
            await __tmSummaryEnsureH2Contexts(ctx, filter);
            if (state.summaryModal !== root) return;
            __tmSummaryUpdatePreview(root, ctx);
        });

        root.addEventListener('click', async (e) => {
            closeOtherPickers(e);
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
                hint(__tmT("settings.summaryGenerated"), 'success');
                return;
            }
            if (action === 'copy') {
                const text = String(root.querySelector('[data-tm-summary="preview"]')?.value || '');
                if (!text.trim()) {
                    hint(__tmT("settings.nothingToCopy"), 'warning');
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
                hint(ok ? __tmT("settings.summaryMarkdownCopied") : __tmT("ai.copyFailed"), ok ? 'success' : 'error');
                return;
            }
            if (action === 'export') {
                const text = String(root.querySelector('[data-tm-summary="preview"]')?.value || '');
                if (!text.trim()) {
                    hint(__tmT("settings.nothingToExport"), 'warning');
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
                hint(__tmT("settings.markdownExported"), 'success');
            }
        });

        await new Promise((resolve) => requestAnimationFrame(resolve));
        if (state.summaryModal !== root) return;
        const docNamesPromise = __tmSummaryBuildDocNameMapByGroups(docNameMap);
        const customFieldScopePromise = typeof __tmRefreshCustomFieldScopeMembership === 'function'
            ? __tmRefreshCustomFieldScopeMembership()
            : Promise.resolve();
        const [groupScope] = await Promise.all([
            __tmSummaryBuildGroupScope(),
            customFieldScopePromise,
        ]);
        const summaryTasksPromise = __tmSummaryLoadTasksByDocs(groupScope.allDocIds);
        const [resolvedDocNameMap, summaryTasks] = await Promise.all([docNamesPromise, summaryTasksPromise]);
        if (state.summaryModal !== root) return;

        Object.assign(docNameMap, resolvedDocNameMap);
        ctx.groupDocIdsMap = groupScope.groupDocIdsMap;
        ctx.docGroupIdsMap = groupScope.docGroupIdsMap;
        ctx.allDocIds = groupScope.allDocIds;
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
