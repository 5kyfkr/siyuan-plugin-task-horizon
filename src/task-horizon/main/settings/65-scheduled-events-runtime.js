    const __TM_SCHEDULED_EVENT_MAX_RESULT = 60000;
    const __TM_SCHEDULED_EVENT_CATCHUP_MS = 24 * 60 * 60 * 1000;
    const __TM_SCHEDULED_KERNEL_RPC_TIMEOUT_MS = 20 * 1000;
    const __TM_SCHEDULED_KERNEL_TIMEOUT_BACKOFF_MS = 5 * 60 * 1000;
    const __TM_SCHEDULED_LEASE_HEARTBEAT_MS = 4 * 60 * 1000;
    const __TM_SCHEDULED_FINISH_RETRY_DELAYS = [0, 400, 1200];
    const __TM_SCHEDULED_EVENTS_KERNEL_SCHEMA_VERSION = 2;
    const __TM_SCHEDULED_EVENT_TERMINAL_STATUSES = new Set(['succeeded', 'skipped_empty', 'blocked', 'config_error']);

    function __tmScheduledCoreSupported() {
        const raw = String(window.siyuan?.config?.system?.kernelVersion || window.siyuan?.config?.system?.version || '').trim().replace(/^v/i, '');
        if (!raw) return true;
        const parts = raw.split(/[.-]/).slice(0, 3).map((part) => Number(part) || 0);
        return parts[0] * 1000000 + parts[1] * 1000 + parts[2] >= 3007003;
    }

    function __tmScheduledPad(value) {
        return String(value).padStart(2, '0');
    }

    function __tmScheduledLocalDateKey(value) {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return `${date.getFullYear()}-${__tmScheduledPad(date.getMonth() + 1)}-${__tmScheduledPad(date.getDate())}`;
    }

    function __tmScheduledLocalDateTimeKey(value) {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return `${__tmScheduledLocalDateKey(date)}T${__tmScheduledPad(date.getHours())}:${__tmScheduledPad(date.getMinutes())}`;
    }

    function __tmScheduledParseTime(value, fallback = '19:00') {
        const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return fallback;
        const hour = Number(match[1]);
        const minute = Number(match[2]);
        if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) return fallback;
        return `${__tmScheduledPad(hour)}:${__tmScheduledPad(minute)}`;
    }

    function __tmScheduledSanitizeOutput(value) {
        return String(value || '')
            .replace(/(^|\n)[ \t]*(?:#{1,6}\s*)?按无人值守模式执行：[^\r\n]*?只读\s*SQL\s*(?:(?:补充|复查)\s*)?(?:统计\s*)?字段\s*[:：][ \t]*/gi, '$1')
            .trim();
    }

    function __tmScheduledNeutralizeTaskMarkers(value) {
        return String(value || '')
            .replace(/(^|\n)([ \t]*(?:[-*+]|\d+[.)]))[ \t]+\[[ xX]\][ \t]+/g, '$1$2 ');
    }

    function __tmScheduledOutputTitle(value, fallback = '定时事件结果') {
        const clean = __tmScheduledSanitizeOutput(value)
            .replace(/^#{1,6}\s+/, '')
            .replace(/[*_`]/g, '')
            .trim();
        return (clean || String(fallback || '定时事件结果').trim() || '定时事件结果').slice(0, 500);
    }

    function __tmScheduledExtractActionPrompt(value) {
        const source = String(value || '').trim();
        if (!source) return '';
        const leadingWords = /^(?:(?:请|帮我|给我|在|于)\s*)+/;
        return source
            .replace(leadingWords, '')
            .replace(/^(?:创建|新建|设置|添加|安排)\s*(?:一个)?\s*/, '')
            .replace(/(?:每天|每日|每个工作日|工作日|每周\s*[一二三四五六日天]?|单次|一次)/, ' ')
            .replace(/\b\d{4}-\d{2}-\d{2}\b/, ' ')
            .replace(/(?:今天|明天|后天)?\s*(?:凌晨|早上|上午|中午|下午|晚上)?\s*\d{1,2}(?::\d{2}|\s*(?:点|时)(?:\d{1,2}\s*分?)?)/, ' ')
            .replace(/(?:定时|到点)(?:事件|任务|提醒)?/, ' ')
            .replace(leadingWords, '')
            .replace(/^[\s,，.。:：;；、-]+|[\s,，.。:：;；、-]+$/g, '')
            .replace(/\s+/g, ' ')
            .trim() || source;
    }

    function __tmScheduledShouldExtractPrompt(prompt, name = '') {
        const source = String(prompt || '').trim();
        if (!source) return false;
        if (source === String(name || '').trim()) return true;
        const prefix = source.slice(0, 80);
        return /(?:定时|到点|每天|每日|每个工作日|工作日|每周\s*[一二三四五六日天]?|单次|一次)/.test(prefix)
            || /^(?:(?:请|帮我|给我|在|于)\s*)*(?:今天|明天|后天)?\s*(?:凌晨|早上|上午|中午|下午|晚上)?\s*\d{1,2}(?::\d{2}|\s*(?:点|时))/.test(prefix);
    }

    function __tmScheduledAt(dateValue, timeValue) {
        const dateKey = typeof dateValue === 'string' ? dateValue : __tmScheduledLocalDateKey(dateValue);
        const match = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const time = __tmScheduledParseTime(timeValue, '00:00').split(':').map(Number);
        if (!match) return null;
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), time[0], time[1], 0, 0);
        if (Number.isNaN(date.getTime()) || __tmScheduledLocalDateKey(date) !== dateKey) return null;
        return date;
    }

    function __tmScheduledNewId(prefix = 'scheduled') {
        try { return globalThis.Lute?.NewNodeID?.() || `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`; }
        catch (e) { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`; }
    }

    function __tmScheduledNormalizeLastRun(input) {
        const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const markdown = __tmScheduledSanitizeOutput(value.markdown).slice(0, __TM_SCHEDULED_EVENT_MAX_RESULT);
        return {
            occurrenceKey: String(value.occurrenceKey || '').trim(),
            status: String(value.status || 'idle').trim() || 'idle',
            startedAt: Number(value.startedAt) || 0,
            finishedAt: Number(value.finishedAt) || 0,
            title: __tmScheduledOutputTitle(value.title, ''),
            markdown,
            blockId: String(value.blockId || '').trim(),
            error: String(value.error || '').slice(0, 2000),
            deliveryPending: value.deliveryPending === true,
            deliveryCompleted: value.deliveryCompleted === true,
            manual: value.manual === true,
        };
    }

    function __tmScheduledNormalizeOccurrence(input) {
        const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        return {
            occurrenceKey: String(value.occurrenceKey || '').trim(),
            status: String(value.status || 'idle').trim() || 'idle',
            ownerId: String(value.ownerId || '').trim(),
            leaseUntil: Number(value.leaseUntil) || 0,
            attempts: Math.max(0, Math.min(3, Math.round(Number(value.attempts) || 0))),
            nextAttemptAt: Number(value.nextAttemptAt) || 0,
            startedAt: Number(value.startedAt) || 0,
            finishedAt: Number(value.finishedAt) || 0,
            error: String(value.error || '').slice(0, 2000),
        };
    }

    function __tmNormalizeScheduledEvent(input, options = {}) {
        const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const scheduleInput = value.schedule && typeof value.schedule === 'object' ? value.schedule : {};
        const outputInput = value.output && typeof value.output === 'object' ? value.output : {};
        const validKinds = new Set(['once', 'daily', 'weekdays', 'weekly']);
        const kind = validKinds.has(String(scheduleInput.kind || '')) ? String(scheduleInput.kind) : 'daily';
        const weekday = Math.max(0, Math.min(6, Math.round(Number(scheduleInput.weekday) || 0)));
        const name = String(value.name || '').trim().slice(0, 120) || '未命名定时事件';
        const rawPrompt = String(value.prompt || '').trim().slice(0, 20000);
        const prompt = __tmScheduledShouldExtractPrompt(rawPrompt, name)
            ? __tmScheduledExtractActionPrompt(rawPrompt)
            : rawPrompt;
        const event = {
            id: String(value.id || '').trim() || __tmScheduledNewId(),
            type: 'agent_prompt',
            createdAt: Number(value.createdAt) || Date.now(),
            updatedAt: Number(value.updatedAt) || Date.now(),
            name,
            enabled: value.enabled !== false,
            prompt,
            conversationId: String(value.conversationId || '').trim(),
            condition: String(value.condition || '') === 'today_has_completed_tasks' ? 'today_has_completed_tasks' : 'always',
            schedule: {
                kind,
                date: String(scheduleInput.date || '').trim(),
                weekday,
                time: __tmScheduledParseTime(scheduleInput.time, '19:00'),
            },
            output: {
                mode: String(outputInput.mode || '') === 'document'
                    ? 'document'
                    : String(outputInput.mode || '') === 'daily_note'
                        ? 'daily_note'
                        : 'notification',
                documentId: String(outputInput.documentId || '').trim(),
                documentMode: String(outputInput.documentMode || '') === 'monthly_child' ? 'monthly_child' : 'target',
                insertPosition: String(outputInput.insertPosition || '') === 'top' ? 'top' : 'bottom',
            },
            lastOccurrence: __tmScheduledNormalizeOccurrence(value.lastOccurrence || value.execution),
            lastRun: __tmScheduledNormalizeLastRun(value.lastRun),
        };
        if (options.stripRuntime === true) {
            delete event.conversationId;
            delete event.lastOccurrence;
            delete event.lastRun;
        }
        return event;
    }

    function __tmNormalizeScheduledEvents(input, options = {}) {
        const seen = new Set();
        return (Array.isArray(input) ? input : []).map((item) => __tmNormalizeScheduledEvent(item, options)).filter((event) => {
            if (!event.id || seen.has(event.id)) return false;
            seen.add(event.id);
            return true;
        });
    }

    function __tmScheduledOccurrenceOnDay(event, day) {
        const schedule = event?.schedule || {};
        const date = __tmScheduledAt(__tmScheduledLocalDateKey(day), schedule.time);
        if (!date) return null;
        if (schedule.kind === 'daily') return date;
        if (schedule.kind === 'weekdays') return date.getDay() >= 1 && date.getDay() <= 5 ? date : null;
        if (schedule.kind === 'weekly') return date.getDay() === Number(schedule.weekday) ? date : null;
        return null;
    }

    function __tmScheduledResolveTiming(input, nowValue = new Date(), catchupMs = __TM_SCHEDULED_EVENT_CATCHUP_MS) {
        const event = __tmNormalizeScheduledEvent(input);
        const now = nowValue instanceof Date ? new Date(nowValue.getTime()) : new Date(nowValue);
        if (Number.isNaN(now.getTime())) return { due: false, occurrence: null, occurrenceKey: '', nextAt: null, expired: false };
        let latest = null;
        let nextAt = null;
        if (event.schedule.kind === 'once') {
            const once = __tmScheduledAt(event.schedule.date, event.schedule.time);
            if (once && once.getTime() <= now.getTime()) latest = once;
            if (once && once.getTime() > now.getTime()) nextAt = once;
        } else {
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            for (let offset = 0; offset >= -8 && !latest; offset -= 1) {
                const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
                const occurrence = __tmScheduledOccurrenceOnDay(event, day);
                if (occurrence && occurrence.getTime() <= now.getTime()) latest = occurrence;
            }
            for (let offset = 0; offset <= 8 && !nextAt; offset += 1) {
                const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
                const occurrence = __tmScheduledOccurrenceOnDay(event, day);
                if (occurrence && occurrence.getTime() > now.getTime()) nextAt = occurrence;
            }
        }
        const occurrenceKey = latest ? `${event.id}:${__tmScheduledLocalDateTimeKey(latest)}` : '';
        const age = latest ? now.getTime() - latest.getTime() : Infinity;
        const expired = event.schedule.kind === 'once' && !!latest && age > catchupMs;
        const ledger = __tmScheduledNormalizeOccurrence(event.lastOccurrence);
        let due = event.enabled && !!latest && latest.getTime() >= event.createdAt && age >= 0 && age <= catchupMs;
        if (due && ledger.occurrenceKey === occurrenceKey) {
            if (__TM_SCHEDULED_EVENT_TERMINAL_STATUSES.has(ledger.status)) due = false;
            else if (ledger.status === 'running' && ledger.leaseUntil > now.getTime()) due = false;
            else if (ledger.status === 'failed') {
                if (ledger.attempts >= 3 || ledger.nextAttemptAt > now.getTime()) due = false;
            }
        }
        return { due, occurrence: latest, occurrenceKey, nextAt, expired };
    }

    function __tmScheduledValidate(event) {
        if (!event?.name || !event?.prompt) return '名称和提示词不能为空';
        if (!['once', 'daily', 'weekdays', 'weekly'].includes(event?.schedule?.kind)) return '重复规则无效';
        if (!__tmScheduledParseTime(event?.schedule?.time, '')) return '运行时间无效';
        if (event.schedule.kind === 'once' && !__tmScheduledAt(event.schedule.date, event.schedule.time)) return '单次事件日期无效';
        if (event.output?.mode === 'document' && !String(event.output.documentId || '').trim()) return '请选择目标文档或输入文档 ID';
        return '';
    }

    function __tmScheduledCompletedTaskSnapshot(task) {
        return {
            id: __tmScheduledTaskLogicalId(task),
            title: String(task?.content || task?.name || task?.markdown || '').replace(/^\s*-\s*\[[xX]\]\s*/, '').trim().slice(0, 500),
            documentId: String(task?.docId || task?.root_id || '').trim(),
            document: String(task?.docName || task?.doc_name || '').trim(),
            completedAt: String(task?.taskCompleteAt || task?.task_complete_at || '').trim(),
            priority: String(task?.priority || '').trim(),
            status: String(task?.status || '').trim(),
        };
    }

    function __tmScheduledTaskCompletionDateKey(task) {
        const raw = task?.taskCompleteAt ?? task?.task_complete_at ?? '';
        let timestamp = 0;
        try { if (typeof __tmParseTimeToTs === 'function') timestamp = Number(__tmParseTimeToTs(raw)) || 0; } catch (e) {}
        if (!timestamp) {
            const digits = String(raw || '').trim();
            const match = digits.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
            if (match) timestamp = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6])).getTime();
            else {
                const parsed = typeof raw === 'number' ? raw : Date.parse(String(raw || ''));
                if (Number.isFinite(parsed)) timestamp = Number(parsed);
            }
        }
        return timestamp > 0 ? __tmScheduledLocalDateKey(new Date(timestamp)) : '';
    }

    function __tmScheduledTaskLogicalId(task) {
        const sourceId = String(task?.sourceTaskId || task?.recurringSourceTaskId || '').trim();
        if (sourceId) return sourceId;
        const taskId = String(task?.id || '').trim();
        const virtualMatch = taskId.match(/^repeatinst:([^:]+):/);
        return String(virtualMatch?.[1] || taskId).trim();
    }

    function __tmScheduledFilterCompletedTasks(tasks, occurrence) {
        const dateKey = __tmScheduledLocalDateKey(occurrence || new Date());
        const seenLogicalTasks = new Set();
        return (Array.isArray(tasks) ? tasks : []).filter((task) => {
            if (task?.done !== true || __tmScheduledTaskCompletionDateKey(task) !== dateKey) return false;
            const logicalId = __tmScheduledTaskLogicalId(task);
            if (!logicalId) return false;
            const dedupeKey = `${logicalId}|${dateKey}`;
            if (seenLogicalTasks.has(dedupeKey)) return false;
            seenLogicalTasks.add(dedupeKey);
            return true;
        });
    }

    async function __tmScheduledLoadTodayCompletedTasks(occurrence) {
        const ids = new Set(Array.isArray(SettingsStore.data.selectedDocIds) ? SettingsStore.data.selectedDocIds.map((id) => String(id || '').trim()).filter(Boolean) : []);
        const groupScope = await __tmSummaryBuildGroupScope();
        (Array.isArray(groupScope?.allDocIds) ? groupScope.allDocIds : []).forEach((id) => {
            const value = String(id || '').trim();
            if (value) ids.add(value);
        });
        const tasks = await __tmSummaryLoadTasksByDocs(Array.from(ids), {
            ignoreExcludeCompleted: true,
            forceFresh: true,
            throwOnError: true,
        });
        return __tmScheduledFilterCompletedTasks(tasks, occurrence).map(__tmScheduledCompletedTaskSnapshot);
    }

    function __tmScheduledNotificationSummary(markdown) {
        return String(markdown || '')
            .replace(/```[\s\S]*?```/g, ' ')
            .replace(/[#>*_`\[\]()~-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 240);
    }

    function __tmScheduledHeadingKey(value) {
        return String(value || '')
            .replace(/^#{1,6}\s*/, '')
            .replace(/[\\*_`~]/g, '')
            .replace(/[：:]/g, '')
            .replace(/\s+/g, '')
            .trim()
            .toLowerCase();
    }

    function __tmScheduledStripDuplicateLeadingHeading(markdown, heading, resultTitle, dateKey) {
        const raw = String(markdown || '').trim();
        const match = raw.match(/^#{1,6}[ \t]+[^\r\n]*(?:\r?\n|$)(?:\r?\n)*/);
        if (!match) return raw;
        const candidateKey = __tmScheduledHeadingKey(match[0]);
        const headingKey = __tmScheduledHeadingKey(heading);
        const titleKey = __tmScheduledHeadingKey(resultTitle);
        const matchesTitle = titleKey && candidateKey === titleKey;
        const matchesHeading = headingKey && candidateKey === headingKey;
        if (!matchesHeading && !matchesTitle) return raw;
        return raw.slice(match[0].length).trim();
    }

    function __tmScheduledMonthKey(value) {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return `${date.getFullYear()}-${__tmScheduledPad(date.getMonth() + 1)}`;
    }

    async function __tmScheduledResolveOutputDocument(event, occurrence) {
        const documentId = String(event?.output?.documentId || '').trim();
        if (event?.output?.documentMode !== 'monthly_child') return documentId;
        const month = __tmScheduledMonthKey(occurrence || new Date());
        const gateway = await __tmScheduledKernelRpc('taskHorizonResolveAgentScheduleOutputDocument', {
            parentDocumentID: documentId,
            month,
        });
        if (!gateway.available) throw new Error('任务内核不可用，无法创建月度子文档');
        const resolvedId = String(gateway.data?.documentID || gateway.data?.documentId || '').trim();
        if (!resolvedId) throw new Error('任务内核未返回月度子文档 ID');
        return resolvedId;
    }

    async function __tmScheduledResolveDailyNoteDocument() {
        const runtimeSettings = typeof SettingsStore !== 'undefined' ? SettingsStore : null;
        const runtimeState = typeof state !== 'undefined' ? state : null;
        const runtimeApi = typeof API !== 'undefined' ? API : null;
        let notebook = '';
        const hasConfiguredNotebookResolver = typeof __tmResolveConfiguredDailyNoteNotebookId === 'function';
        try {
            notebook = hasConfiguredNotebookResolver
                ? String(__tmResolveConfiguredDailyNoteNotebookId() || '').trim()
                : '';
        } catch (e) {}
        if (!notebook && !hasConfiguredNotebookResolver) {
            notebook = String(runtimeSettings?.data?.newTaskDailyNoteNotebookId || '').trim();
        }
        if (!notebook) {
            const activeDocId = String(runtimeState?.activeDocId || '').trim();
            if (activeDocId && activeDocId !== 'all' && typeof runtimeApi?.getDocNotebook === 'function') {
                try { notebook = String(await runtimeApi.getDocNotebook(activeDocId) || '').trim(); } catch (e) {}
            }
        }
        if (!notebook && typeof runtimeApi?.getDocNotebook === 'function') {
            let fallbackDocId = '';
            try {
                fallbackDocId = typeof __tmResolveDefaultDocIdAsync === 'function'
                    ? String(await __tmResolveDefaultDocIdAsync() || '').trim()
                    : (typeof __tmResolveDefaultDocId === 'function' ? String(__tmResolveDefaultDocId() || '').trim() : '');
            } catch (e) {}
            if (fallbackDocId && fallbackDocId !== 'all') {
                try { notebook = String(await runtimeApi.getDocNotebook(fallbackDocId) || '').trim(); } catch (e) {}
            }
        }
        if (!notebook) {
            const notebooks = Array.isArray(runtimeState?.notebooks) ? runtimeState.notebooks : [];
            notebook = String(notebooks[0]?.id || notebooks[0]?.box || '').trim();
        }
        if (!notebook || typeof runtimeApi?.createDailyNote !== 'function') {
            throw new Error('无法确定今天日记所属笔记本');
        }
        const documentId = String(await runtimeApi.createDailyNote(notebook) || '').trim();
        if (!documentId) throw new Error('获取今天日记文档失败');
        return documentId;
    }

    async function __tmScheduledWriteDocument(event, documentId, markdown) {
        const runtimeSettings = typeof SettingsStore !== 'undefined' ? SettingsStore : null;
        const appendToBottom = event?.output?.mode === 'daily_note'
            ? runtimeSettings?.data?.newTaskDailyNoteAppendToBottom === true
            : event?.output?.insertPosition !== 'top';
        if (appendToBottom) {
            return String(await __tmBackendAdapter.appendBlock(documentId, markdown) || '').trim();
        }
        return String(await __tmBackendAdapter.prependBlock(documentId, markdown) || '').trim();
    }

    async function __tmScheduledDeliver(event, result, occurrence) {
        const resultTitle = __tmScheduledOutputTitle(result?.title, event.name || '定时事件');
        const title = `定时事件完成：${String(event.name || '未命名定时事件').trim()}`;
        const markdown = __tmScheduledSanitizeOutput(result?.markdown);
        const documentMarkdown = event.output.mode === 'document' || event.output.mode === 'daily_note'
            ? __tmScheduledNeutralizeTaskMarkers(markdown)
            : markdown;
        let blockId = '';
        let outputMarkdown = documentMarkdown;
        const dateKey = __tmScheduledLocalDateKey(occurrence || new Date());
        const heading = resultTitle.includes(dateKey) ? resultTitle : `${dateKey} ${resultTitle}`;
        const dedupeHeading = event.output.mode === 'notification' ? resultTitle : heading;
        outputMarkdown = __tmScheduledStripDuplicateLeadingHeading(documentMarkdown, dedupeHeading, resultTitle, dateKey);
        if (event.output.mode === 'document' || event.output.mode === 'daily_note') {
            const documentId = event.output.mode === 'daily_note'
                ? await __tmScheduledResolveDailyNoteDocument()
                : await __tmScheduledResolveOutputDocument(event, occurrence);
            blockId = await __tmScheduledWriteDocument(event, documentId, `## ${heading}\n\n${outputMarkdown}`);
        }
        const summary = __tmScheduledNotificationSummary(outputMarkdown) || title;
        const conversationNote = event.conversationId
            ? `已追加到任务智能体对话“定时：${event.name}”`
            : '';
        const body = [resultTitle, conversationNote, summary].filter(Boolean).join('\n');
        const calendarNotifier = globalThis.__tmCalendar?.showSystemNotification;
        let notificationResult = { ok: false, error: '未获取到可用的系统通知接口' };
        if (typeof calendarNotifier === 'function') {
            try {
                notificationResult = await calendarNotifier(title, body, {
                    channel: 'task-horizon-scheduled-events',
                    delayInSeconds: 0,
                });
            } catch (e) {
                notificationResult = { ok: false, error: String(e?.message || e || '系统通知发送失败') };
            }
        } else {
            try {
                const utils = globalThis.__taskHorizonPlatformUtils;
                if (utils && typeof utils.sendNotification === 'function') {
                    const id = await utils.sendNotification({ channel: 'task-horizon-scheduled-events', title, body, delayInSeconds: 0, timeoutType: 'never' });
                    notificationResult = Number(id) >= 0
                        ? { ok: true, id: Number(id) }
                        : { ok: false, error: '思源通知接口未返回有效通知 ID' };
                }
            } catch (e) {
                notificationResult = { ok: false, error: String(e?.message || e || '系统通知发送失败') };
            }
        }
        const notificationOk = notificationResult === true || notificationResult?.ok === true;
        const notificationError = notificationOk ? '' : String(notificationResult?.error || '系统通知发送失败').trim();
        if (!notificationOk) hint(`${title}\n${body}\n\n系统通知未发送：${notificationError}`, 'warning');
        return { blockId, notificationDelivered: notificationOk, notificationError };
    }

    function __tmScheduledStatusFromError(error) {
        const message = String(error?.message || error || '').trim();
        if (error?.code === 'TM_AUTOMATION_BLOCKED') return 'blocked';
        if (/尚未配置可用模型|无可用.*模型|agent.*不可用|requires siyuan/i.test(message)) return 'config_error';
        return 'failed';
    }

    async function __tmScheduledNotifyTerminalFailure(event, status, error, manual = false) {
        if (manual || !event) return;
        const current = __tmScheduledEventById(event.id) || event;
        if (status === 'failed' && Number(current.lastOccurrence?.attempts) < 3) return;
        const name = String(current.name || '未命名定时事件').trim();
        const reason = String(error || current.lastRun?.error || '未知错误').trim().slice(0, 500);
        const title = `定时事件执行失败：${name}`;
        let delivered = false;
        try {
            const utils = globalThis.__taskHorizonPlatformUtils;
            if (utils && typeof utils.sendNotification === 'function') {
                const id = await utils.sendNotification({
                    channel: 'task-horizon-scheduled-events',
                    title,
                    body: reason,
                    delayInSeconds: 0,
                    timeoutType: 'default',
                });
                delivered = Number(id) !== -1;
            }
        } catch (e) {}
        if (!delivered) hint(`${title}\n${reason}`, 'warning');
    }

    function __tmScheduledEventById(id) {
        const events = __tmNormalizeScheduledEvents(SettingsStore.data.scheduledEvents);
        SettingsStore.data.scheduledEvents = events;
        return events.find((event) => event.id === String(id || '').trim()) || null;
    }

    async function __tmScheduledKernelRpc(name, ...args) {
        const active = __tmScheduledRuntime.kernelRpcInFlight;
        if (active) {
            const error = new Error(`任务内核仍在处理上一次调用：${active.name}`);
            error.code = 'TM_KERNEL_RPC_BUSY';
            __tmScheduledRuntime.kernelBackoffUntil = Date.now() + __TM_SCHEDULED_KERNEL_TIMEOUT_BACKOFF_MS;
            throw error;
        }
        const pending = Promise.resolve().then(() => __tmCallTaskHorizonKernelRpc(name, ...args));
        __tmScheduledRuntime.kernelRpcInFlight = { name, pending };
        const clearPending = () => {
            if (__tmScheduledRuntime.kernelRpcInFlight?.pending === pending) {
                __tmScheduledRuntime.kernelRpcInFlight = null;
            }
        };
        pending.then(clearPending, clearPending);
        let timeoutID = 0;
        try {
            const result = await Promise.race([
                pending,
                new Promise((_, reject) => {
                    timeoutID = setTimeout(() => {
                        const error = new Error(`任务内核调用超时：${name}`);
                        error.code = 'TM_KERNEL_RPC_TIMEOUT';
                        reject(error);
                    }, __TM_SCHEDULED_KERNEL_RPC_TIMEOUT_MS);
                }),
            ]);
            __tmScheduledRuntime.kernelBackoffUntil = 0;
            return result;
        } catch (error) {
            if (String(error?.code || '') === 'TM_KERNEL_RPC_TIMEOUT') {
                __tmScheduledRuntime.kernelBackoffUntil = Date.now() + __TM_SCHEDULED_KERNEL_TIMEOUT_BACKOFF_MS;
            }
            throw error;
        } finally {
            if (timeoutID) clearTimeout(timeoutID);
        }
    }

    function __tmScheduledDefinitionFingerprint(events) {
        return JSON.stringify(__tmNormalizeScheduledEvents(events, { stripRuntime: true }));
    }

    async function __tmScheduledPersist(options = {}) {
        const events = __tmNormalizeScheduledEvents(SettingsStore.data.scheduledEvents);
        if (options.persistSettings === true) SettingsStore.syncToLocal?.();
        const gateway = await __tmScheduledKernelRpc('taskHorizonReplaceAgentSchedules', { events });
        if (gateway.available) {
            SettingsStore.data.scheduledEvents = __tmNormalizeScheduledEvents(gateway.data);
            SettingsStore.data.scheduledEventsSchemaVersion = __TM_SCHEDULED_EVENTS_KERNEL_SCHEMA_VERSION;
            SettingsStore.syncToLocal?.();
            if (options.persistSettings === true) {
                try { await SettingsStore.save?.({ suppressMobileCloseSyncDirty: true }); }
                catch (error) { console.warn('[task-horizon] scheduled event recovery mirror save failed', error); }
            }
            return true;
        }
        const error = new Error('任务内核不可用，定时事件未写入');
        error.code = 'TM_KERNEL_UNAVAILABLE';
        throw error;
    }

    async function __tmScheduledReadKernelSnapshot() {
        try {
            const gateway = await __tmScheduledKernelRpc('taskHorizonLoadAgentSchedules');
            if (!gateway.available) return { status: 'unavailable', events: null };
            return { status: 'valid', events: __tmNormalizeScheduledEvents(gateway.data) };
        } catch (error) {
            const code = String(error?.code || '').trim();
            if (code === 'STORAGE_MISSING') return { status: 'missing', events: null };
            if (code === 'STORAGE_CORRUPT') return { status: 'corrupt', events: null };
            return { status: 'unavailable', events: null };
        }
    }

    async function __tmScheduledReadKernelEvents() {
        const snapshot = await __tmScheduledReadKernelSnapshot();
        return snapshot.status === 'valid' ? snapshot.events : null;
    }

    async function __tmScheduledReadRemoteEvents() {
        const kernelEvents = await __tmScheduledReadKernelEvents();
        if (kernelEvents) return kernelEvents;
        try {
            const response = await fetch('/api/file/getFile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: SETTINGS_FILE_PATH }),
            });
            if (!response.ok) return null;
            const payload = JSON.parse(await response.text());
            return __tmNormalizeScheduledEvents(payload?.scheduledEvents);
        } catch (e) {
            return null;
        }
    }

    function __tmScheduledMergeEventSnapshots(localEvents, remoteEvents) {
        const local = __tmNormalizeScheduledEvents(localEvents);
        if (!Array.isArray(remoteEvents)) return local;
        const remote = __tmNormalizeScheduledEvents(remoteEvents);
        const map = new Map(remote.map((event) => [event.id, event]));
        local.forEach((current) => {
            const remoteEvent = map.get(current.id);
            if (!remoteEvent) return;
            const localTs = Math.max(Number(current.updatedAt) || 0, Number(current.lastOccurrence?.startedAt) || 0, Number(current.lastRun?.finishedAt) || 0);
            const remoteTs = Math.max(Number(remoteEvent.updatedAt) || 0, Number(remoteEvent.lastOccurrence?.startedAt) || 0, Number(remoteEvent.lastRun?.finishedAt) || 0);
            if (localTs >= remoteTs) map.set(current.id, current);
        });
        return Array.from(map.values());
    }

    function __tmScheduledMergeMigrationSnapshots(localEvents, kernelEvents) {
        const kernel = __tmNormalizeScheduledEvents(kernelEvents);
        const map = new Map(kernel.map((event) => [event.id, event]));
        __tmNormalizeScheduledEvents(localEvents).forEach((event) => {
            const current = map.get(event.id);
            if (!current) {
                map.set(event.id, event);
                return;
            }
            const localTs = Math.max(Number(event.updatedAt) || 0, Number(event.lastOccurrence?.startedAt) || 0, Number(event.lastRun?.finishedAt) || 0);
            const kernelTs = Math.max(Number(current.updatedAt) || 0, Number(current.lastOccurrence?.startedAt) || 0, Number(current.lastRun?.finishedAt) || 0);
            if (localTs >= kernelTs) map.set(event.id, event);
        });
        return Array.from(map.values());
    }

    function __tmScheduledMergeRemoteEvents(remoteEvents) {
        if (!Array.isArray(remoteEvents)) return false;
        SettingsStore.data.scheduledEvents = __tmScheduledMergeEventSnapshots(SettingsStore.data.scheduledEvents, remoteEvents);
        return true;
    }

    function __tmScheduledApplyKernelEvent(value) {
        if (!value || typeof value !== 'object') return null;
        const event = __tmNormalizeScheduledEvent(value);
        const events = __tmNormalizeScheduledEvents(SettingsStore.data.scheduledEvents);
        const index = events.findIndex((item) => item.id === event.id);
        if (index >= 0) events[index] = event;
        else events.push(event);
        SettingsStore.data.scheduledEvents = events;
        SettingsStore.syncToLocal?.();
        return event;
    }

    async function __tmScheduledClaim(eventId, occurrenceKey, manual, preserveResult = false) {
        const gateway = await __tmScheduledKernelRpc('taskHorizonClaimAgentScheduleOccurrence', {
            scheduleID: eventId,
            occurrenceKey,
            manual: manual === true,
            preserveResult: preserveResult === true,
        });
        if (!gateway.available) throw new Error('任务内核不可用，无法安全执行定时事件');
        const result = gateway.data || {};
        if (result.event) __tmScheduledApplyKernelEvent(result.event);
        if (result.claimed !== true) return null;
        const event = __tmScheduledApplyKernelEvent(result.event);
        if (!event) throw new Error('任务内核未返回定时事件状态');
        return { event, ownerId: String(result.ownerID || result.ownerId || '').trim() };
    }

    async function __tmScheduledFinish(claim, occurrenceKey, status, patch = {}, manual = false) {
        const event = claim?.event || claim;
        if (!event?.id) return null;
        const gateway = await __tmScheduledKernelRpc('taskHorizonFinishAgentScheduleOccurrence', {
            scheduleID: event.id,
            occurrenceKey,
            status,
            ownerID: String(claim?.ownerId || '').trim(),
            patch,
            manual: manual === true,
        });
        if (!gateway.available) throw new Error('任务内核不可用，无法完成定时事件');
        return __tmScheduledApplyKernelEvent(gateway.data);
    }

    function __tmScheduledDelay(delay) {
        return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(delay) || 0)));
    }

    async function __tmScheduledFinishWithRetry(claim, occurrenceKey, status, patch = {}, manual = false) {
        let lastError = null;
        for (const delay of __TM_SCHEDULED_FINISH_RETRY_DELAYS) {
            if (delay) await __tmScheduledDelay(delay);
            try {
                return await __tmScheduledFinish(claim, occurrenceKey, status, patch, manual);
            } catch (error) {
                lastError = error;
                if (['CONFLICT', 'NOT_FOUND', 'TM_KERNEL_RPC_TIMEOUT'].includes(String(error?.code || ''))) throw error;
            }
        }
        throw lastError || new Error('定时事件完成状态写入失败');
    }

    async function __tmScheduledRenewLease(claim, occurrenceKey, manual = false) {
        if (manual || !claim?.event?.id || !String(claim?.ownerId || '').trim()) return null;
        const gateway = await __tmScheduledKernelRpc('taskHorizonRenewAgentScheduleOccurrence', {
            scheduleID: claim.event.id,
            occurrenceKey,
            ownerID: String(claim.ownerId).trim(),
        });
        if (!gateway.available) throw new Error('任务内核不可用，无法续租定时事件');
        const event = __tmScheduledApplyKernelEvent(gateway.data?.event);
        if (event) claim.event = event;
        return gateway.data || null;
    }

    function __tmScheduledStartLeaseHeartbeat(claim, occurrenceKey, manual = false) {
        const state = { stopped: false, lost: false, timer: 0 };
        if (manual || !String(claim?.ownerId || '').trim()) {
            return { get lost() { return false; }, stop() {} };
        }
        const schedule = () => {
            if (state.stopped) return;
            state.timer = setTimeout(async () => {
                try {
                    await __tmScheduledRenewLease(claim, occurrenceKey, false);
                } catch (error) {
                    if (['CONFLICT', 'NOT_FOUND'].includes(String(error?.code || ''))) state.lost = true;
                    else console.warn('[task-horizon] scheduled lease renewal failed', error);
                } finally {
                    schedule();
                }
            }, __TM_SCHEDULED_LEASE_HEARTBEAT_MS);
        };
        schedule();
        return {
            get lost() { return state.lost; },
            stop() {
                state.stopped = true;
                if (state.timer) clearTimeout(state.timer);
                state.timer = 0;
            },
        };
    }

    async function __tmScheduledCheckpointDelivery(event, occurrenceKey, cached, delivery, manual) {
        const current = __tmScheduledEventById(event.id);
        const checkpoint = __tmScheduledNormalizeLastRun({
            ...(current?.lastRun || event.lastRun || {}),
            ...cached,
            ...delivery,
            occurrenceKey,
            status: 'delivery_commit_pending',
            finishedAt: Date.now(),
            deliveryPending: false,
            deliveryCompleted: true,
            manual: manual === true,
        });
        if (current) {
            current.lastRun = checkpoint;
            try { await __tmScheduledPersist(); }
            catch (error) { console.warn('[task-horizon] scheduled delivery checkpoint failed', error); }
        }
        return checkpoint;
    }

    async function __tmScheduledDeliverAndCommit(claim, event, occurrenceKey, cached, occurrence, manual, heartbeat, deliveryOnly = false) {
        if (heartbeat?.lost) {
            const error = new Error('定时事件执行权已失效');
            error.code = 'CONFLICT';
            throw error;
        }
        await __tmScheduledRenewLease(claim, occurrenceKey, manual);
        let delivery;
        try {
            delivery = await __tmScheduledDeliver(event, cached, occurrence);
        } catch (deliveryError) {
            await __tmScheduledFinishWithRetry(claim, occurrenceKey, 'failed', {
                ...cached,
                deliveryPending: true,
                deliveryCompleted: false,
                manual: manual === true,
                error: String(deliveryError?.message || deliveryError || '投递失败'),
            }, manual);
            await __tmScheduledNotifyTerminalFailure(event, 'failed', deliveryError?.message || deliveryError || '投递失败', manual);
            return { status: 'failed', deliveryOnly, deliveryPending: true, error: String(deliveryError?.message || deliveryError || '') };
        }
        const checkpoint = await __tmScheduledCheckpointDelivery(event, occurrenceKey, cached, delivery, manual);
        try {
            await __tmScheduledFinishWithRetry(claim, occurrenceKey, 'succeeded', checkpoint, manual);
        } catch (commitError) {
            console.warn('[task-horizon] scheduled delivery committed but state update is pending', commitError);
            return {
                status: 'commit_pending',
                deliveryOnly,
                deliveryCompleted: true,
                error: String(commitError?.message || commitError || ''),
                ...cached,
                ...delivery,
            };
        }
        return { status: 'succeeded', deliveryOnly, ...cached, ...delivery };
    }

    async function __tmScheduledResumeDeliveryCommit(event) {
        const lastRun = __tmScheduledNormalizeLastRun(event?.lastRun);
        if (lastRun.status !== 'delivery_commit_pending' || !lastRun.deliveryCompleted || !lastRun.occurrenceKey) return false;
        const manual = lastRun.manual === true;
        const claim = { event, ownerId: manual ? '' : String(event?.lastOccurrence?.ownerId || '').trim() };
        if (!manual && (!claim.ownerId || event?.lastOccurrence?.occurrenceKey !== lastRun.occurrenceKey)) return false;
        try {
            await __tmScheduledFinishWithRetry(claim, lastRun.occurrenceKey, 'succeeded', lastRun, manual);
            return true;
        } catch (error) {
            if (['CONFLICT', 'NOT_FOUND'].includes(String(error?.code || ''))) {
                __tmScheduledMergeRemoteEvents(await __tmScheduledReadKernelEvents());
            } else {
                console.warn('[task-horizon] scheduled delivery commit retry failed', error);
            }
            return false;
        }
    }

    async function __tmScheduledRun(eventId, options = {}) {
        const manual = options.manual === true;
        let event = __tmScheduledEventById(eventId);
        if (!event) throw new Error('定时事件不存在');
        const occurrence = options.occurrence instanceof Date ? options.occurrence : new Date();
        const occurrenceKey = manual
            ? `${event.id}:manual:${Date.now()}`
            : String(options.occurrenceKey || `${event.id}:${__tmScheduledLocalDateTimeKey(occurrence)}`);
        const configError = __tmScheduledValidate(event);
        if (configError) {
            const claimed = await __tmScheduledClaim(event.id, occurrenceKey, manual);
            if (claimed) {
                await __tmScheduledFinishWithRetry(claimed, occurrenceKey, 'config_error', { error: configError }, manual);
                await __tmScheduledNotifyTerminalFailure(claimed.event, 'config_error', configError, manual);
            }
            return { status: 'config_error', error: configError };
        }
        const claim = await __tmScheduledClaim(event.id, occurrenceKey, manual);
        if (!claim) return { status: 'deduplicated' };
        event = claim.event;
        const heartbeat = __tmScheduledStartLeaseHeartbeat(claim, occurrenceKey, manual);
        try {
            let completedTasks = [];
            if (event.condition === 'today_has_completed_tasks') {
                completedTasks = await __tmScheduledLoadTodayCompletedTasks(occurrence);
                if (!completedTasks.length) {
                    await __tmScheduledFinishWithRetry(claim, occurrenceKey, 'skipped_empty', {}, manual);
                    return { status: 'skipped_empty' };
                }
            }
            if ((!globalThis.__tmAI || typeof globalThis.__tmAI.runAutomation !== 'function')
                && String(SettingsStore.data.aiExperienceMode || 'agent') !== 'legacy') {
                try { await globalThis.__taskHorizonEnsureAiModuleLoaded?.(); } catch (e) {}
            }
            if (!globalThis.__tmAI || typeof globalThis.__tmAI.runAutomation !== 'function') {
                throw new Error('定时事件需要思源 3.7.3 或更高版本，并启用可用的智能体模型');
            }
            const conversationId = String(event.conversationId || '').trim();
            const context = completedTasks.length
                ? `\n\n以下是 ${__tmScheduledLocalDateKey(occurrence)} 当天实际完成的任务（完成日期只按 taskCompleteAt 计算）：\n${JSON.stringify(completedTasks.slice(0, 300), null, 2)}`
                : '';
            const result = await globalThis.__tmAI.runAutomation({
                prompt: `${event.prompt}${context}`,
                eventId: event.id,
                occurrenceKey,
                sessionID: conversationId,
                sessionTitle: `定时：${event.name}`,
                persistSession: true,
            });
            const resolvedConversationId = String(result?.sessionID || '').trim();
            if (resolvedConversationId && resolvedConversationId !== event.conversationId) {
                event.conversationId = resolvedConversationId;
                const current = __tmScheduledEventById(event.id);
                if (current) current.conversationId = event.conversationId;
                await __tmScheduledPersist();
            }
            const markdown = __tmScheduledSanitizeOutput(result?.markdown).slice(0, __TM_SCHEDULED_EVENT_MAX_RESULT);
            if (!markdown) throw new Error('智能体未返回内容');
            const cached = {
                title: __tmScheduledOutputTitle(result?.title, event.name),
                markdown,
                deliveryPending: event.output.mode !== 'notification',
                deliveryCompleted: false,
                manual,
            };
            const current = __tmScheduledEventById(event.id);
            if (current) {
                current.lastRun = __tmScheduledNormalizeLastRun({ ...current.lastRun, ...cached });
                await __tmScheduledPersist();
            }
            const outcome = await __tmScheduledDeliverAndCommit(claim, event, occurrenceKey, cached, occurrence, manual, heartbeat);
            return { conversationId: event.conversationId, ...outcome };
        } catch (error) {
            if (heartbeat.lost || ['CONFLICT', 'NOT_FOUND'].includes(String(error?.code || ''))) {
                return { status: 'deduplicated', error: '定时事件执行权已转移，本次结果未投递' };
            }
            const resolvedConversationId = String(error?.sessionID || '').trim();
            if (resolvedConversationId && resolvedConversationId !== event.conversationId) {
                event.conversationId = resolvedConversationId;
                const current = __tmScheduledEventById(event.id);
                if (current) current.conversationId = resolvedConversationId;
                try { await __tmScheduledPersist(); }
                catch (persistError) { console.warn('[task-horizon] scheduled conversation binding update failed', persistError); }
            }
            const status = __tmScheduledStatusFromError(error);
            try {
                await __tmScheduledFinishWithRetry(claim, occurrenceKey, status, { error: String(error?.message || error || '') }, manual);
            } catch (finishError) {
                console.warn('[task-horizon] scheduled failure state update is pending', finishError);
                return { status, statePending: true, error: String(error?.message || error || '') };
            }
            await __tmScheduledNotifyTerminalFailure(event, status, error?.message || error || '', manual);
            return { status, error: String(error?.message || error || '') };
        } finally {
            heartbeat.stop();
        }
    }

    async function __tmScheduledRetryPendingDelivery(event, occurrence) {
        const cached = event?.lastRun;
        if (!cached?.deliveryPending || !cached?.markdown) return null;
        const claim = await __tmScheduledClaim(event.id, cached.occurrenceKey, false, true);
        if (!claim) return { status: 'deduplicated', deliveryOnly: true };
        event = claim.event;
        const heartbeat = __tmScheduledStartLeaseHeartbeat(claim, cached.occurrenceKey, false);
        try {
            return await __tmScheduledDeliverAndCommit(claim, event, cached.occurrenceKey, cached, occurrence, false, heartbeat, true);
        } finally {
            heartbeat.stop();
        }
    }

    const __tmScheduledRuntime = {
        timer: null,
        running: false,
        queue: Promise.resolve(),
        initialized: false,
        disposed: false,
        focusHandler: null,
        visibilityHandler: null,
        kernelBackoffUntil: 0,
        kernelRpcInFlight: null,
    };

    function __tmScheduledEnqueue(task) {
        const run = __tmScheduledRuntime.queue.then(task, task);
        __tmScheduledRuntime.queue = run.catch(() => {});
        return run;
    }

    function __tmScheduledArmTimer() {
        if (__tmScheduledRuntime.disposed) return;
        if (__tmScheduledRuntime.timer) clearTimeout(__tmScheduledRuntime.timer);
        const now = Date.now();
        const delay = Math.max(1000, 60000 - (now % 60000) + 40);
        __tmScheduledRuntime.timer = setTimeout(async () => {
            __tmScheduledRuntime.timer = null;
            try {
                await __tmScheduledCheckDue();
            } catch (error) {
                console.warn('[task-horizon] scheduled minute check failed', error);
            } finally {
                __tmScheduledArmTimer();
            }
        }, delay);
    }

    async function __tmScheduledCheckDue() {
        if (__tmScheduledRuntime.running
            || __tmScheduledRuntime.disposed
            || Date.now() < __tmScheduledRuntime.kernelBackoffUntil
            || !__tmScheduledCoreSupported()) return;
        __tmScheduledRuntime.running = true;
        try {
            __tmScheduledMergeRemoteEvents(await __tmScheduledReadRemoteEvents());
            if (Date.now() < __tmScheduledRuntime.kernelBackoffUntil) return;
            const now = new Date();
            const events = __tmNormalizeScheduledEvents(SettingsStore.data.scheduledEvents);
            for (const snapshot of events) {
                try {
                    const event = __tmScheduledEventById(snapshot.id);
                    if (!event) continue;
                    if (event.lastRun?.status === 'delivery_commit_pending' && event.lastRun?.deliveryCompleted) {
                        await __tmScheduledEnqueue(() => __tmScheduledResumeDeliveryCommit(event));
                        continue;
                    }
                    if (!event.enabled) continue;
                    const timing = __tmScheduledResolveTiming(event, now);
                    if (timing.expired) {
                        event.enabled = false;
                        await __tmScheduledPersist({ persistSettings: true });
                        continue;
                    }
                    if (!timing.due) continue;
                    if (event.lastRun?.deliveryPending && event.lastRun.occurrenceKey === timing.occurrenceKey) {
                        await __tmScheduledEnqueue(() => __tmScheduledRetryPendingDelivery(event, timing.occurrence));
                    } else {
                        await __tmScheduledEnqueue(() => __tmScheduledRun(event.id, { occurrence: timing.occurrence, occurrenceKey: timing.occurrenceKey }));
                    }
                } catch (error) {
                    console.warn('[task-horizon] scheduled event check failed', snapshot?.id || '', error);
                }
            }
        } finally {
            __tmScheduledRuntime.running = false;
        }
    }

    const __tmScheduledEventsApi = {
        extractPrompt(value) {
            return __tmScheduledExtractActionPrompt(value);
        },
        list() {
            SettingsStore.data.scheduledEvents = __tmNormalizeScheduledEvents(SettingsStore.data.scheduledEvents);
            return SettingsStore.data.scheduledEvents.map((event) => JSON.parse(JSON.stringify(event)));
        },
        async importDefinitions(values) {
            const current = __tmNormalizeScheduledEvents(SettingsStore.data.scheduledEvents);
            const incoming = __tmNormalizeScheduledEvents(values, { stripRuntime: true });
            const events = new Map(current.map((event) => [event.id, event]));
            incoming.forEach((definition) => {
                const previous = events.get(definition.id);
                events.set(definition.id, __tmNormalizeScheduledEvent({
                    ...definition,
                    conversationId: previous?.conversationId || '',
                    lastOccurrence: previous?.lastOccurrence,
                    lastRun: previous?.lastRun,
                }));
            });
            SettingsStore.data.scheduledEvents = Array.from(events.values());
            try { await __tmScheduledPersist({ persistSettings: true }); }
            catch (error) {
                SettingsStore.data.scheduledEvents = current;
                SettingsStore.syncToLocal?.();
                throw error;
            }
            __tmScheduledArmTimer();
            return this.list();
        },
        async save(input) {
            const previousEvents = __tmNormalizeScheduledEvents(SettingsStore.data.scheduledEvents);
            const event = __tmNormalizeScheduledEvent(input);
            event.updatedAt = Date.now();
            const events = __tmNormalizeScheduledEvents(SettingsStore.data.scheduledEvents);
            const index = events.findIndex((item) => item.id === event.id);
            if (index >= 0) {
                event.createdAt = events[index].createdAt;
                event.conversationId = event.conversationId || events[index].conversationId;
                event.lastOccurrence = events[index].lastOccurrence;
                event.lastRun = events[index].lastRun;
                events[index] = event;
            } else {
                events.push(event);
            }
            SettingsStore.data.scheduledEvents = events;
            try { await __tmScheduledPersist({ persistSettings: true }); }
            catch (error) {
                SettingsStore.data.scheduledEvents = previousEvents;
                SettingsStore.syncToLocal?.();
                throw error;
            }
            __tmScheduledArmTimer();
            return JSON.parse(JSON.stringify(event));
        },
        async remove(id) {
            const targetID = String(id || '').trim();
            const previousEvents = __tmNormalizeScheduledEvents(SettingsStore.data.scheduledEvents);
            SettingsStore.data.scheduledEvents = __tmNormalizeScheduledEvents(SettingsStore.data.scheduledEvents).filter((event) => event.id !== targetID);
            try { await __tmScheduledPersist({ persistSettings: true }); }
            catch (error) {
                SettingsStore.data.scheduledEvents = previousEvents;
                SettingsStore.syncToLocal?.();
                throw error;
            }
            __tmScheduledArmTimer();
        },
        async runNow(id) {
            if (!__tmScheduledCoreSupported()) return { status: 'config_error', error: '定时事件需要思源 3.7.3 或更高版本' };
            try {
                return await __tmScheduledEnqueue(() => __tmScheduledRun(id, { manual: true, occurrence: new Date() }));
            } finally {
                __tmScheduledArmTimer();
            }
        },
        async refresh() {
            try {
                await __tmScheduledCheckDue();
                return this.list();
            } finally {
                __tmScheduledArmTimer();
            }
        },
        init() {
            if (__tmScheduledRuntime.initialized && !__tmScheduledRuntime.disposed) return;
            __tmScheduledRuntime.initialized = true;
            __tmScheduledRuntime.disposed = false;
            __tmScheduledRuntime.kernelBackoffUntil = 0;
            const sourceEvents = Array.isArray(SettingsStore.data.scheduledEvents) ? SettingsStore.data.scheduledEvents : [];
            const sourcePrompts = sourceEvents.map((event) => String(event?.prompt || '').trim());
            SettingsStore.data.scheduledEvents = __tmNormalizeScheduledEvents(sourceEvents);
            const normalizedPrompts = SettingsStore.data.scheduledEvents.map((event) => event.prompt);
            const promptMigrationNeeded = JSON.stringify(sourcePrompts) !== JSON.stringify(normalizedPrompts);
            const kernelMigrationNeeded = Number(SettingsStore.data.scheduledEventsSchemaVersion) < __TM_SCHEDULED_EVENTS_KERNEL_SCHEMA_VERSION;
            if (!__tmScheduledCoreSupported()) return;
            __tmScheduledRuntime.focusHandler = () => { this.refresh().catch(() => {}); };
            __tmScheduledRuntime.visibilityHandler = () => {
                if (document.visibilityState === 'visible') this.refresh().catch(() => {});
            };
            window.addEventListener('focus', __tmScheduledRuntime.focusHandler);
            document.addEventListener('visibilitychange', __tmScheduledRuntime.visibilityHandler);
            const refresh = async () => {
                const kernelSnapshot = await __tmScheduledReadKernelSnapshot();
                const kernelEvents = kernelSnapshot.status === 'valid' ? kernelSnapshot.events : null;
                const canRestoreKernel = kernelSnapshot.status === 'missing' || kernelSnapshot.status === 'corrupt';
                let persisted = false;
                if (Array.isArray(kernelEvents)) {
                    if (kernelMigrationNeeded) {
                        SettingsStore.data.scheduledEvents = __tmScheduledMergeMigrationSnapshots(SettingsStore.data.scheduledEvents, kernelEvents);
                        await __tmScheduledPersist();
                        persisted = true;
                    } else {
                        SettingsStore.data.scheduledEvents = __tmNormalizeScheduledEvents(kernelEvents);
                        SettingsStore.data.scheduledEventsSchemaVersion = __TM_SCHEDULED_EVENTS_KERNEL_SCHEMA_VERSION;
                        SettingsStore.syncToLocal?.();
                    }
                } else if (canRestoreKernel && SettingsStore.data.scheduledEvents.length > 0) {
                    await __tmScheduledPersist({ persistSettings: true });
                    persisted = true;
                }
                if (promptMigrationNeeded && !persisted && (Array.isArray(kernelEvents) || canRestoreKernel)) {
                    await __tmScheduledPersist({ persistSettings: true });
                    persisted = true;
                }
                if (!persisted
                    && Array.isArray(kernelEvents)
                    && __tmScheduledDefinitionFingerprint(sourceEvents) !== __tmScheduledDefinitionFingerprint(kernelEvents)) {
                    try { await SettingsStore.save?.({ suppressMobileCloseSyncDirty: true }); }
                    catch (error) { console.warn('[task-horizon] scheduled event recovery mirror refresh failed', error); }
                }
                await this.refresh();
            };
            refresh().catch(() => {});
        },
        dispose() {
            __tmScheduledRuntime.disposed = true;
            if (__tmScheduledRuntime.timer) clearTimeout(__tmScheduledRuntime.timer);
            __tmScheduledRuntime.timer = null;
            if (__tmScheduledRuntime.focusHandler) window.removeEventListener('focus', __tmScheduledRuntime.focusHandler);
            if (__tmScheduledRuntime.visibilityHandler) document.removeEventListener('visibilitychange', __tmScheduledRuntime.visibilityHandler);
            __tmScheduledRuntime.focusHandler = null;
            __tmScheduledRuntime.visibilityHandler = null;
            __tmScheduledRuntime.initialized = false;
        },
    };

    globalThis['siyuan-plugin-task-horizon'] = globalThis['siyuan-plugin-task-horizon'] || {};
    globalThis['siyuan-plugin-task-horizon'].scheduledEvents = __tmScheduledEventsApi;
    globalThis.__tmScheduledEventsTest = {
        normalizeEvent: __tmNormalizeScheduledEvent,
        normalizeEvents: __tmNormalizeScheduledEvents,
        resolveTiming: __tmScheduledResolveTiming,
        localDateKey: __tmScheduledLocalDateKey,
        localDateTimeKey: __tmScheduledLocalDateTimeKey,
        validate: __tmScheduledValidate,
        filterCompletedTasks: __tmScheduledFilterCompletedTasks,
        loadTodayCompletedTasks: __tmScheduledLoadTodayCompletedTasks,
        mergeEventSnapshots: __tmScheduledMergeEventSnapshots,
        extractPrompt: __tmScheduledExtractActionPrompt,
        sanitizeOutput: __tmScheduledSanitizeOutput,
        neutralizeTaskMarkers: __tmScheduledNeutralizeTaskMarkers,
        stripDuplicateLeadingHeading: __tmScheduledStripDuplicateLeadingHeading,
        deliver: __tmScheduledDeliver,
    };
