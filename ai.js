(function () {
    const __tmT = globalThis.__taskHorizonHostBridge.i18n.t;

    if (globalThis.__tmAI && globalThis.__tmAI.loaded) return;
    const NS_KEY = 'siyuan-plugin-task-horizon';
    const HISTORY_PREFIX = 'tm-ai-history:';
    const AI_UI_PREFS_KEY = 'tm-ai-ui-prefs';
    const PLUGIN_STORAGE_DIR = '/data/storage/petal/siyuan-plugin-task-horizon';
    const AI_CONVERSATIONS_FILE_PATH = `${PLUGIN_STORAGE_DIR}/ai-conversations.json`;
    const AI_DEBUG_FILE_PATH = `${PLUGIN_STORAGE_DIR}/ai-debug.json`;
    const AI_PROMPT_TEMPLATES_FILE_PATH = `${PLUGIN_STORAGE_DIR}/ai-prompt-templates.json`;
    const DEFAULT_BASE_URL = 'https://api.minimaxi.com/anthropic';
    const DEFAULT_MODEL = 'MiniMax-M2.7-highspeed';
    const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
    const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash';
    const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
    const DEFAULT_OPENAI_MODEL = 'gpt-5.4-mini';
    const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
    const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-5';
    const AI_UI_REV = 'ui-rev-2026-03-17-3';
    const AI_SCENE_LABELS = {
        chat: __tmT("ai.aiChat"),
        smart: __tmT("ai.smartAnalysis"),
        schedule: __tmT("ai.schedulePlanning"),
        summary: __tmT("ai.summary"),
    };
    const AI_CONTEXT_SCOPE_LABELS = {
        none: __tmT("ai.chatOnly"),
        current_doc: __tmT("ai.currentDocument"),
        current_task: __tmT("ai.currentTask"),
        current_group: __tmT("ai.currentGroup"),
        current_view: __tmT("ai.topOfCurrentView"),
        manual: __tmT("ai.manualTasks"),
    };
    const AI_CONTEXT_MODE_LABELS = {
        none: __tmT("ai.noContext"),
        nearby: __tmT("ai.nearbyContext"),
        fulltext: __tmT("ai.fullTextContext"),
    };
    const AI_DEFAULT_PLANNER_OPTIONS = {
        planDate: '',
        planDateTo: '',
        breakHours: 2,
        gapMinutes: 30,
        maxTasks: 5,
        note: '',
    };
    const AI_DEFAULT_SUMMARY_OPTIONS = {
        preset: 'daily',
        dateFrom: '',
        dateTo: '',
        maxTasks: 60,
    };
    const AI_CHAT_SKILL_MAX_ROUNDS = 3;
    const AI_CHAT_SKILL_MAX_CALLS_PER_ROUND = 4;
    const AI_ALLOWED_TYPES = new Set(['chat', 'smart', 'schedule', 'summary']);
    const AI_ALLOWED_SCOPES = new Set(['none', 'current_doc', 'current_task', 'current_group', 'current_view', 'manual']);
    const AI_ALLOWED_CONTEXT_MODES = new Set(['none', 'nearby', 'fulltext']);
    const smartRenameCache = new Map();
    let modalEl = null;
    const aiRuntime = {
        host: null,
        mobile: false,
        mounted: false,
        busy: false,
        activeConversationId: '',
        currentViewTasks: [],
        currentViewTopTasks: [],
        currentGroupTasks: [],
        currentGroupTasksAll: [],
        currentGroupTaskKey: '',
        currentGroupTaskAllKey: '',
        setupCollapsed: false,
        taskPickerCollapsed: false,
        schedulePlannerCollapsed: true,
        labelCache: {
            doc: new Map(),
            task: new Map(),
        },
        drafts: new Map(),
        pendingOpen: null,
        lastRenderedAt: 0,
        historyOpen: false,
        chatPromptTemplateId: '',
        hostListenerController: null,
    };

    function loadAiUiPrefs() {
        try {
            const raw = localStorage.getItem(AI_UI_PREFS_KEY);
            const json = raw ? JSON.parse(raw) : {};
            return json && typeof json === 'object' && !Array.isArray(json) ? json : {};
        } catch (e) {
            return {};
        }
    }

    function saveAiUiPrefs(patch = {}) {
        try {
            const next = { ...loadAiUiPrefs(), ...(patch && typeof patch === 'object' ? patch : {}) };
            localStorage.setItem(AI_UI_PREFS_KEY, JSON.stringify(next));
        } catch (e) {}
    }

    function loadRememberedPlannerOptions() {
        const prefs = loadAiUiPrefs();
        const remembered = normalizePlannerOptions(prefs && typeof prefs === 'object' ? prefs.schedulePlannerOptions : null);
        return {
            ...remembered,
            planDate: '',
            planDateTo: '',
        };
    }

    function saveRememberedPlannerOptions(planner) {
        const normalized = normalizePlannerOptions(planner);
        saveAiUiPrefs({
            schedulePlannerOptions: {
                breakHours: normalized.breakHours,
                gapMinutes: normalized.gapMinutes,
                maxTasks: normalized.maxTasks,
                note: normalized.note,
            },
        });
    }

    {
        const uiPrefs = loadAiUiPrefs();
        aiRuntime.taskPickerCollapsed = !!uiPrefs.taskPickerCollapsed;
        aiRuntime.schedulePlannerCollapsed = typeof uiPrefs.schedulePlannerCollapsed === 'boolean' ? uiPrefs.schedulePlannerCollapsed : true;
        aiRuntime.chatPromptTemplateId = String(uiPrefs.chatPromptTemplateId || '').trim();
    }

    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const getTaskTitlePresentation = (source, fallback = __tmT("kernel.task")) => {
        const fallbackText = String(fallback || '').trim() || __tmT("kernel.task");
        try {
            const presentation = globalThis.__tmGetTaskTitlePresentation?.(source, fallbackText);
            if (presentation && typeof presentation.html === 'string' && typeof presentation.text === 'string') {
                return presentation;
            }
        } catch (e) {}
        const text = String(source || '').trim() || fallbackText;
        return { html: esc(text), text };
    };
    const bridge = () => window?.[NS_KEY]?.aiBridge || null;
    const clone = (v) => { try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; } };
    const todayKey = () => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };
    const toast = (msg, type) => {
        const b = bridge();
        if (b?.hint) b.hint(msg, type || 'info');
    };
    const strip = (line) => String(line || '')
        .replace(/\{\:\s*[^}]*\}/g, '')
        .replace(/\[\[([^\]]+)\]\]/g, '$1')
        .replace(/\(\(([^\)]+)\)\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/^>\s*/, '')
        .replace(/^#{1,6}\s+/, '')
        .replace(/^\s*[-*]\s+\[[ xX]\]\s*/, '')
        .replace(/^\s*[-*]\s+/, '')
        .trim();
    const normalizeLooseLabel = (value) => String(value || '').trim().toLowerCase().replace(/[\s_\-]+/g, '');
    const parseDateTimeLoose = (value) => {
        const s = String(value || '').trim();
        if (!s) return null;
        const compactDate = s.match(/^(\d{4})(\d{2})(\d{2})$/);
        if (compactDate) {
            const dt = new Date(Number(compactDate[1]), Number(compactDate[2]) - 1, Number(compactDate[3]), 0, 0, 0, 0);
            return Number.isNaN(dt.getTime()) ? null : dt;
        }
        const normalized = s.replace('T', ' ').replace(/\//g, '-');
        const m = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?$/);
        if (m) {
            const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0), 0, 0);
            return Number.isNaN(dt.getTime()) ? null : dt;
        }
        const dt = new Date(s);
        return Number.isNaN(dt.getTime()) ? null : dt;
    };
    const normalizeDateKey = (value) => {
        const dt = parseDateTimeLoose(value);
        if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return '';
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    };
    const normalizeTimeHm = (value) => {
        const m = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return '';
        const hh = Math.max(0, Math.min(23, Number(m[1])));
        const mm = Math.max(0, Math.min(59, Number(m[2])));
        return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    };
    const parseScheduleWindows = (value) => {
        const list = Array.isArray(value) ? value : String(value || '').split(/\r?\n/);
        return list.map((item) => String(item || '').trim()).filter(Boolean).map((item) => {
            const m = item.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
            if (!m) return null;
            const start = normalizeTimeHm(m[1]);
            const end = normalizeTimeHm(m[2]);
            return start && end && start < end ? { start, end, label: `${start}-${end}` } : null;
        }).filter(Boolean);
    };
    const hhmmOfDate = (date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    const isBlockWithinWindows = (start, end, windows) => {
        if (!Array.isArray(windows) || !windows.length) return true;
        const startHm = hhmmOfDate(start);
        const endHm = hhmmOfDate(end);
        return windows.some((win) => startHm >= win.start && endHm <= win.end);
    };
    const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n) || 0));
    const uid = (prefix = 'conv') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const isMobileClient = () => /android|iphone|ipad|ipod|harmonyos|mobile/i.test(String(navigator?.userAgent || ''));
    const hasLiveSidebarHost = () => !!(aiRuntime.host instanceof HTMLElement && document.body.contains(aiRuntime.host));
    const readTransferTaskId = (event) => {
        try {
            const data = event?.dataTransfer?.getData?.('application/x-tm-task-id');
            const id = String(data || '').trim();
            if (id) return id;
        } catch (e) {}
        try {
            const raw = event?.dataTransfer?.getData?.('application/x-tm-task');
            const parsed = raw ? JSON.parse(raw) : null;
            const id = String(parsed?.id || '').trim();
            if (id) return id;
        } catch (e) {}
        try {
            const text = String(event?.dataTransfer?.getData?.('text/plain') || '').trim();
            if (/^[\w-]{6,}$/.test(text)) return text;
        } catch (e) {}
        return '';
    };
    const ensurePluginStorageDir = async () => {
        if (globalThis.__tmSuppressStorageWrites === true) return;
        const formDir = new FormData();
        formDir.append('path', PLUGIN_STORAGE_DIR);
        formDir.append('isDir', 'true');
        globalThis.__tmHost?.appendStorageRequestApp?.(formDir);
        await fetch('/api/file/putFile', { method: 'POST', body: formDir }).catch(() => null);
    };
    const readJsonFile = async (path, fallback) => {
        try {
            const res = await fetch('/api/file/getFile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path }),
            });
            if (!res.ok) return clone(fallback);
            const text = await res.text();
            if (!text || !text.trim()) return clone(fallback);
            return JSON.parse(text);
        } catch (e) {
            return clone(fallback);
        }
    };
    const writeJsonFile = async (path, value) => {
        if (globalThis.__tmSuppressStorageWrites === true) return false;
        await ensurePluginStorageDir();
        const form = new FormData();
        form.append('path', path);
        form.append('isDir', 'false');
        form.append('file', new Blob([JSON.stringify(value ?? {}, null, 2)], { type: 'application/json' }));
        globalThis.__tmHost?.appendStorageRequestApp?.(form);
        await fetch('/api/file/putFile', { method: 'POST', body: form }).catch(() => null);
    };

    function historyKey(kind, id) {
        return `${HISTORY_PREFIX}${String(kind || 'generic').trim()}:${String(id || 'default').trim()}`;
    }

    function normalizePlannerOptions(input = {}) {
        const source = (input && typeof input === 'object') ? input : {};
        const planDate = normalizeDateKey(String(source.planDate || '').trim()) || '';
        let planDateTo = normalizeDateKey(String(source.planDateTo || '').trim()) || '';
        if (planDate && !planDateTo) planDateTo = planDate;
        if (planDate && planDateTo && planDateTo < planDate) planDateTo = planDate;
        return {
            planDate,
            planDateTo,
            breakHours: Math.max(0, Math.min(12, Number(source.breakHours ?? AI_DEFAULT_PLANNER_OPTIONS.breakHours) || 0)),
            gapMinutes: Math.max(0, Math.min(240, Math.round(Number(source.gapMinutes ?? AI_DEFAULT_PLANNER_OPTIONS.gapMinutes) || 0))),
            maxTasks: Math.max(1, Math.min(30, Math.round(Number(source.maxTasks ?? AI_DEFAULT_PLANNER_OPTIONS.maxTasks) || 1))),
            note: String(source.note || '').trim(),
        };
    }

    function startOfWeekDate(base) {
        const dt = base instanceof Date ? new Date(base.getTime()) : new Date();
        dt.setHours(0, 0, 0, 0);
        const day = dt.getDay();
        const diff = day === 0 ? -6 : (1 - day);
        dt.setDate(dt.getDate() + diff);
        return dt;
    }

    function endOfWeekDate(base) {
        const dt = startOfWeekDate(base);
        dt.setDate(dt.getDate() + 6);
        dt.setHours(23, 59, 59, 999);
        return dt;
    }

    function dateToKey(dt) {
        if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return '';
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    }

    function listDateKeysBetween(dateFrom, dateTo) {
        const startKey = normalizeDateKey(dateFrom || '') || todayKey();
        const endKey = normalizeDateKey(dateTo || startKey) || startKey;
        const out = [];
        const start = parseDateTimeLoose(`${startKey} 00:00`);
        const end = parseDateTimeLoose(`${endKey} 00:00`);
        if (!(start instanceof Date) || Number.isNaN(start.getTime())) return [startKey];
        if (!(end instanceof Date) || Number.isNaN(end.getTime()) || end.getTime() < start.getTime()) return [startKey];
        for (let dt = new Date(start.getTime()); dt.getTime() <= end.getTime() && out.length < 31; dt.setDate(dt.getDate() + 1)) {
            out.push(dateToKey(dt));
        }
        return out.length ? out : [startKey];
    }

    function formatPlannerDateRange(planDate, planDateTo) {
        const from = normalizeDateKey(planDate || '') || todayKey();
        const to = normalizeDateKey(planDateTo || from) || from;
        return from === to ? from : `${from} ~ ${to}`;
    }

    function isDateWithinRange(dateValue, dateFrom, dateTo) {
        const key = normalizeDateKey(dateValue || '');
        const from = normalizeDateKey(dateFrom || '') || todayKey();
        const to = normalizeDateKey(dateTo || from) || from;
        if (!key) return false;
        return key >= from && key <= to;
    }

    function normalizeSummaryOptions(input = {}) {
        const source = (input && typeof input === 'object') ? input : {};
        const preset = ['daily', 'weekly', 'custom'].includes(String(source.preset || '').trim()) ? String(source.preset).trim() : 'daily';
        let dateFrom = normalizeDateKey(String(source.dateFrom || '').trim());
        let dateTo = normalizeDateKey(String(source.dateTo || '').trim());
        if (preset === 'daily' && (!dateFrom || !dateTo)) {
            const today = todayKey();
            dateFrom = dateFrom || today;
            dateTo = dateTo || today;
        }
        if (preset === 'weekly' && (!dateFrom || !dateTo)) {
            const now = new Date();
            dateFrom = dateFrom || dateToKey(startOfWeekDate(now));
            dateTo = dateTo || dateToKey(endOfWeekDate(now));
        }
        if (dateFrom && dateTo && dateFrom > dateTo) {
            const swap = dateFrom;
            dateFrom = dateTo;
            dateTo = swap;
        }
        return {
            preset,
            dateFrom: dateFrom || '',
            dateTo: dateTo || dateFrom || '',
            maxTasks: Math.max(5, Math.min(200, Math.round(Number(source.maxTasks ?? AI_DEFAULT_SUMMARY_OPTIONS.maxTasks) || AI_DEFAULT_SUMMARY_OPTIONS.maxTasks))),
        };
    }

    function resolveSummaryRange(input = {}) {
        const summary = normalizeSummaryOptions(input);
        const from = normalizeDateKey(summary.dateFrom || '');
        const to = normalizeDateKey(summary.dateTo || summary.dateFrom || '');
        const finalFrom = from || todayKey();
        const finalTo = to || finalFrom;
        const presetLabel = summary.preset === 'weekly' ? __tmT("kernel.weeklyReport") : (summary.preset === 'custom' ? __tmT("ai.customSummary") : __tmT("ai.dailyReport"));
        return {
            ...summary,
            dateFrom: finalFrom,
            dateTo: finalTo,
            label: finalFrom === finalTo ? `${presetLabel} · ${finalFrom}` : `${presetLabel} · ${finalFrom} ~ ${finalTo}`,
        };
    }

    function resolveTaskUpdatedDateKey(task) {
        const raw = String(task?.updated || task?.updatedAt || task?.updateTime || task?.update_time || '').trim();
        if (!raw) return '';
        const direct = normalizeDateKey(raw);
        if (direct) return direct;
        const dt = parseDateTimeLoose(raw);
        return dt instanceof Date && !Number.isNaN(dt.getTime()) ? dateToKey(dt) : '';
    }

    function taskTouchesSummaryRange(task, range) {
        const target = resolveSummaryRange(range);
        const updatedKey = resolveTaskUpdatedDateKey(task);
        const dates = [
            updatedKey,
            normalizeDateKey(task?.startDate || ''),
        ].filter(Boolean);
        if (!dates.length) return false;
        return dates.some((it) => it >= target.dateFrom && it <= target.dateTo);
    }

    function normalizeMessage(message = {}) {
        const role = String(message?.role || 'assistant').trim();
        return {
            id: String(message?.id || uid('msg')).trim(),
            role: role === 'user' || role === 'assistant' || role === 'context' ? role : 'assistant',
            content: typeof message?.content === 'string' ? message.content.trim() : JSON.stringify(message?.content ?? '', null, 2),
            ts: Number(message?.ts || Date.now()),
            meta: (message?.meta && typeof message.meta === 'object') ? clone(message.meta) : {},
        };
    }

    function normalizePromptTemplate(template = {}) {
        const createdAt = Number(template?.createdAt || Date.now());
        const updatedAt = Number(template?.updatedAt || createdAt || Date.now());
        const content = typeof template?.content === 'string'
            ? template.content.replace(/\r\n/g, '\n')
            : String(template?.content || '');
        return {
            id: String(template?.id || uid('prompt')).trim(),
            name: String(template?.name || '').trim() || __tmT("ai.untitledPrompt"),
            content,
            createdAt,
            updatedAt,
        };
    }

    function normalizeConversation(conversation = {}) {
        const cfg = getConfig();
        const type = AI_ALLOWED_TYPES.has(String(conversation?.type || '').trim()) ? String(conversation.type).trim() : 'chat';
        const rememberedPlanner = loadRememberedPlannerOptions();
        const contextScope = AI_ALLOWED_SCOPES.has(String(conversation?.contextScope || '').trim())
            ? String(conversation.contextScope).trim()
            : (type === 'schedule' ? 'current_view' : 'current_doc');
        const contextMode = AI_ALLOWED_CONTEXT_MODES.has(String(conversation?.contextMode || '').trim())
            ? String(conversation.contextMode).trim()
            : (String(cfg.contextMode || 'nearby').trim() === 'fulltext'
                ? 'fulltext'
                : (String(cfg.contextMode || 'nearby').trim() === 'none' ? 'none' : 'nearby'));
        const createdAt = Number(conversation?.createdAt || Date.now());
        const updatedAt = Number(conversation?.updatedAt || createdAt || Date.now());
        return {
            id: String(conversation?.id || uid('conv')).trim(),
            title: String(conversation?.title || '').trim() || `${AI_SCENE_LABELS[type] || __tmT("ai.aiConversation")} ${new Date(updatedAt).toLocaleDateString()}`,
            type,
            contextScope,
            contextMode,
            selectedDocIds: Array.from(new Set((Array.isArray(conversation?.selectedDocIds) ? conversation.selectedDocIds : []).map((it) => String(it || '').trim()).filter(Boolean))),
            selectedTaskIds: Array.from(new Set((Array.isArray(conversation?.selectedTaskIds) ? conversation.selectedTaskIds : []).map((it) => String(it || '').trim()).filter(Boolean))),
            plannerOptions: normalizePlannerOptions(conversation?.plannerOptions || (type === 'schedule' ? rememberedPlanner : null)),
            summaryOptions: normalizeSummaryOptions(conversation?.summaryOptions),
            messages: (Array.isArray(conversation?.messages) ? conversation.messages : []).map(normalizeMessage).filter((it) => it.content).slice(-40),
            lastResult: (conversation?.lastResult && typeof conversation.lastResult === 'object') ? clone(conversation.lastResult) : null,
            createdAt,
            updatedAt,
            legacyKey: String(conversation?.legacyKey || '').trim(),
        };
    }

    function conversationTaskLimit(conversation) {
        const session = normalizeConversation(conversation || {});
        if (session.type === 'summary') return normalizeSummaryOptions(session.summaryOptions).maxTasks;
        return normalizePlannerOptions(session.plannerOptions).maxTasks;
    }

    async function findLegacyConversation(kind, id) {
        await ConversationStore.ensureLoaded();
        const key = historyKey(kind, id);
        return ConversationStore.list().find((it) => String(it?.legacyKey || '').trim() === key) || null;
    }

    async function ensureLegacyConversation(kind, id) {
        const existing = await findLegacyConversation(kind, id);
        if (existing) return existing;
        const created = legacyKindToConversation(kind, id, []);
        await ConversationStore.upsert(created);
        await ConversationStore.saveNow();
        return created;
    }

    async function loadHistory(kind, id) {
        const conversation = await findLegacyConversation(kind, id);
        return (Array.isArray(conversation?.messages) ? conversation.messages : []).map(normalizeMessage).filter((it) => it.content).slice(-20);
    }

    async function saveHistory(kind, id, list) {
        const conversation = await ensureLegacyConversation(kind, id);
        const messages = (Array.isArray(list) ? list : []).map(normalizeMessage).filter((it) => it.content).slice(-20);
        await updateConversation(conversation.id, { messages });
        return messages;
    }

    async function appendHistory(kind, id, role, content) {
        const conversation = await ensureLegacyConversation(kind, id);
        const current = Array.isArray(conversation?.messages) ? conversation.messages : [];
        const next = current.concat([normalizeMessage({
            role: String(role || '').trim() || 'assistant',
            content: typeof content === 'string' ? content.trim() : JSON.stringify(content, null, 2),
            ts: Date.now(),
        })]).slice(-20);
        await updateConversation(conversation.id, { messages: next });
        return next;
    }

    function legacyKindToConversation(kind, id, history) {
        const k = String(kind || '').trim();
        const did = String(id || '').trim();
        const baseMessages = (Array.isArray(history) ? history : []).map(normalizeMessage).filter((it) => it.content);
        const type = k === 'doc-smart' ? 'smart' : (k === 'doc-schedule' || k === 'task-schedule' ? 'schedule' : 'chat');
        const selectedDocIds = [];
        const selectedTaskIds = [];
        let contextScope = 'current_doc';
        if (k === 'task-title' || k === 'task-edit' || k === 'task-schedule') {
            contextScope = 'current_task';
            if (did) selectedTaskIds.push(did);
        } else if (did) {
            selectedDocIds.push(did);
        }
        const lastTs = Number(baseMessages[baseMessages.length - 1]?.ts || Date.now());
        return normalizeConversation({
            id: uid('legacy'),
            title: `${historyKindLabel(k)} · ${did || __tmT("ai.history")}`,
            type,
            contextScope,
            selectedDocIds,
            selectedTaskIds,
            messages: baseMessages,
            createdAt: Number(baseMessages[0]?.ts || lastTs),
            updatedAt: lastTs,
            legacyKey: historyKey(k, did),
        });
    }

    const ConversationStore = {
        loaded: false,
        saving: null,
        data: { activeId: '', conversations: [] },

        normalizePayload(payload) {
            const raw = (payload && typeof payload === 'object') ? payload : {};
            const conversations = (Array.isArray(raw.conversations) ? raw.conversations : []).map(normalizeConversation);
            let activeId = String(raw.activeId || '').trim();
            if (activeId && !conversations.some((it) => it.id === activeId)) activeId = '';
            return { activeId, conversations };
        },

        async ensureLoaded() {
            if (this.loaded) return;
            const raw = await readJsonFile(AI_CONVERSATIONS_FILE_PATH, { activeId: '', conversations: [] });
            this.data = this.normalizePayload(raw);
            this.loaded = true;
        },

        list() {
            return (Array.isArray(this.data?.conversations) ? this.data.conversations : [])
                .map(normalizeConversation)
                .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        },

        get(id) {
            const key = String(id || '').trim();
            return this.list().find((it) => it.id === key) || null;
        },

        async upsert(conversation) {
            await this.ensureLoaded();
            const next = normalizeConversation(conversation);
            const list = this.list().filter((it) => it.id !== next.id);
            list.push(next);
            this.data = this.normalizePayload({
                activeId: String(this.data.activeId || next.id).trim() || next.id,
                conversations: list,
            });
            return next;
        },

        async saveNow() {
            if (this.saving) return await this.saving;
            this.saving = (async () => {
                try {
                    await writeJsonFile(AI_CONVERSATIONS_FILE_PATH, this.data);
                } finally {
                    this.saving = null;
                }
            })();
            return await this.saving;
        },
    };

    const PromptTemplateStore = {
        loaded: false,
        saving: null,
        data: { templates: [] },

        normalizePayload(payload) {
            const raw = (payload && typeof payload === 'object') ? payload : {};
            const templates = (Array.isArray(raw.templates) ? raw.templates : []).map(normalizePromptTemplate);
            return { templates };
        },

        async ensureLoaded() {
            if (this.loaded) return this.data;
            const raw = await readJsonFile(AI_PROMPT_TEMPLATES_FILE_PATH, { templates: [] });
            this.data = this.normalizePayload(raw);
            this.loaded = true;
            return this.data;
        },

        list() {
            return (Array.isArray(this.data?.templates) ? this.data.templates : []).slice().sort((a, b) => {
                return Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0);
            });
        },

        get(id) {
            const key = String(id || '').trim();
            if (!key) return null;
            return this.list().find((it) => it.id === key) || null;
        },

        async saveNow() {
            if (!this.loaded) return;
            if (this.saving) await this.saving.catch(() => null);
            this.saving = writeJsonFile(AI_PROMPT_TEMPLATES_FILE_PATH, this.data).finally(() => {
                this.saving = null;
            });
            await this.saving.catch(() => null);
        },

        async upsert(template) {
            await this.ensureLoaded();
            const next = normalizePromptTemplate(template);
            const list = this.list().filter((it) => it.id !== next.id);
            list.push(next);
            this.data = { templates: list };
            return next;
        },

        async remove(id) {
            await this.ensureLoaded();
            const key = String(id || '').trim();
            this.data = { templates: this.list().filter((it) => it.id !== key) };
        },
    };

    async function listPromptTemplates() {
        await PromptTemplateStore.ensureLoaded();
        return PromptTemplateStore.list();
    }

    async function createPromptTemplate(input = {}) {
        const next = await PromptTemplateStore.upsert({
            id: uid('prompt'),
            name: String(input?.name || '').trim() || __tmT("ai.untitledPrompt"),
            content: String(input?.content || ''),
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
        await PromptTemplateStore.saveNow();
        return next;
    }

    async function updatePromptTemplate(id, patch = {}) {
        const current = PromptTemplateStore.get(id);
        if (!current) return null;
        const next = await PromptTemplateStore.upsert({
            ...current,
            ...patch,
            id: current.id,
            updatedAt: Date.now(),
        });
        await PromptTemplateStore.saveNow();
        return next;
    }

    async function deletePromptTemplate(id) {
        await PromptTemplateStore.remove(id);
        await PromptTemplateStore.saveNow();
    }

    function setActiveChatPromptTemplateId(id) {
        aiRuntime.chatPromptTemplateId = String(id || '').trim();
        saveAiUiPrefs({ chatPromptTemplateId: aiRuntime.chatPromptTemplateId });
    }

    async function promptTemplateNameDialog(title, defaultValue = '', hint = '') {
        return await new Promise((resolve) => {
            const modal = setModal(title, `
                ${hint ? `<div class="tm-ai-hint">${esc(hint)}</div>` : ''}
                <label class="tm-ai-label">
                    <span>${__tmT("ai.name")}</span>
                    <input class="tm-input" data-ai-template-input="name" value="${esc(defaultValue)}" placeholder="${globalThis.__taskHorizonHostBridge.i18n.html("ai.forExampleWeeklyReviewInvestigateRisksSuggestNextSteps")}">
                </label>
                <div class="tm-ai-actions">
                    <button class="tm-btn tm-btn-primary" data-ai-template-action="submit">${__tmT("common.ok")}</button>
                    <button class="tm-btn tm-btn-secondary" data-ai-template-action="cancel">${__tmT("common.cancel")}</button>
                </div>
            `);
            const body = modal.querySelector('.tm-ai-modal__body');
            const input = body?.querySelector?.('[data-ai-template-input="name"]');
            const close = (value) => {
                try { closeModal(); } catch (e) {}
                resolve(typeof value === 'string' ? value.trim() : '');
            };
            try { input?.focus?.(); input?.select?.(); } catch (e) {}
            const onClick = (event) => {
                if (String(event.target?.dataset?.aiAction || '').trim() === 'close') {
                    close('');
                    return;
                }
                const actionEl = event.target?.closest?.('[data-ai-template-action]');
                if (!actionEl) return;
                const action = String(actionEl.getAttribute('data-ai-template-action') || '').trim();
                if (action === 'cancel') {
                    close('');
                    return;
                }
                if (action === 'submit') {
                    close(String(input?.value || ''));
                }
            };
            const onKeyDown = (event) => {
                if (event.key === 'Escape') {
                    try { event.preventDefault(); } catch (e) {}
                    close('');
                    return;
                }
                if (event.key === 'Enter' && !event.shiftKey) {
                    try { event.preventDefault(); } catch (e) {}
                    close(String(input?.value || ''));
                }
            };
            modal.addEventListener('click', onClick);
            modal.addEventListener('keydown', onKeyDown);
        });
    }

    async function listConversations() {
        await ConversationStore.ensureLoaded();
        return ConversationStore.list();
    }

    async function getConversation(id) {
        await ConversationStore.ensureLoaded();
        return ConversationStore.get(id);
    }

    async function setActiveConversation(id) {
        await ConversationStore.ensureLoaded();
        const conversation = ConversationStore.get(id);
        if (!conversation) return null;
        ConversationStore.data.activeId = conversation.id;
        aiRuntime.activeConversationId = conversation.id;
        await ConversationStore.saveNow();
        return conversation;
    }

    async function createConversation(patch = {}) {
        await ConversationStore.ensureLoaded();
        const base = normalizeConversation({
            type: String(patch?.type || '').trim() || 'chat',
            contextScope: String(patch?.contextScope || '').trim(),
            contextMode: String(patch?.contextMode || '').trim(),
            selectedDocIds: patch?.selectedDocIds,
            selectedTaskIds: patch?.selectedTaskIds,
            plannerOptions: patch?.plannerOptions,
            summaryOptions: patch?.summaryOptions,
            title: patch?.title,
            messages: patch?.messages,
            lastResult: patch?.lastResult,
        });
        const next = normalizeConversation({
            ...base,
            updatedAt: Date.now(),
            createdAt: Date.now(),
            title: String(base.title || '').trim() || `${AI_SCENE_LABELS[base.type] || __tmT("ai.aiConversation")} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        });
        await ConversationStore.upsert(next);
        ConversationStore.data.activeId = next.id;
        aiRuntime.activeConversationId = next.id;
        await ConversationStore.saveNow();
        return next;
    }

    async function updateConversation(id, patch = {}) {
        const current = await getConversation(id);
        if (!current) return null;
        const next = normalizeConversation({
            ...current,
            ...clone(patch),
            id: current.id,
            updatedAt: Date.now(),
        });
        if (patch && typeof patch === 'object' && Object.prototype.hasOwnProperty.call(patch, 'plannerOptions')) {
            saveRememberedPlannerOptions(next.plannerOptions);
        }
        await ConversationStore.upsert(next);
        if (ConversationStore.data.activeId === current.id) aiRuntime.activeConversationId = current.id;
        await ConversationStore.saveNow();
        return next;
    }

    async function deleteConversation(id) {
        await ConversationStore.ensureLoaded();
        const key = String(id || '').trim();
        const list = ConversationStore.list().filter((it) => it.id !== key);
        ConversationStore.data = ConversationStore.normalizePayload({
            activeId: String(ConversationStore.data.activeId || '').trim() === key ? (list[0]?.id || '') : ConversationStore.data.activeId,
            conversations: list,
        });
        aiRuntime.activeConversationId = String(ConversationStore.data.activeId || '').trim();
        await ConversationStore.saveNow();
        return list;
    }

    async function appendConversationMessage(id, role, content, meta) {
        const current = await getConversation(id);
        if (!current) return null;
        const messages = current.messages.concat([normalizeMessage({ role, content, meta, ts: Date.now() })]).slice(-40);
        return await updateConversation(id, { messages });
    }

    async function appendConversationContext(id, patch = {}) {
        const current = await getConversation(id);
        if (!current) return null;
        const selectedTaskIds = Array.from(new Set(current.selectedTaskIds.concat(Array.isArray(patch?.selectedTaskIds) ? patch.selectedTaskIds : []).map((it) => String(it || '').trim()).filter(Boolean)));
        const selectedDocIds = Array.from(new Set(current.selectedDocIds.concat(Array.isArray(patch?.selectedDocIds) ? patch.selectedDocIds : []).map((it) => String(it || '').trim()).filter(Boolean)));
        const contextMessage = [];
        if (selectedTaskIds.length) contextMessage.push(__tmT("ai.taskContextAppendedItems", { length: selectedTaskIds.length }));
        if (selectedDocIds.length) contextMessage.push(__tmT("ai.documentContextAppendedItems", { length: selectedDocIds.length }));
        const next = await updateConversation(id, {
            selectedTaskIds,
            selectedDocIds,
            contextScope: patch?.contextScope || current.contextScope,
        });
        if (contextMessage.length) {
            return await appendConversationMessage(id, 'context', contextMessage.join('，'), { selectedTaskIds, selectedDocIds });
        }
        return next;
    }

    function renderHistory(history) {
        const list = Array.isArray(history) ? history.filter((it) => String(it?.content || '').trim()) : [];
        if (!list.length) return '';
        return `
            <div class="tm-ai-box">
                <h4>${__tmT("ai.conversationLog")}</h4>
                <div class="tm-ai-list">
                    ${list.map((it) => `<div class="tm-ai-item"><div class="tm-ai-hint" style="margin-bottom:6px;">${it.role === 'user' ? __tmT("ai.you") : 'AI'}</div><div>${esc(it.content)}</div></div>`).join('')}
                </div>
            </div>
        `;
    }

    async function openHistoryEntry(entry, filterId) {
        if (!entry) return;
        const history = await loadHistory(entry.kind, entry.id);
        const modal = setModal(__tmT("ai.record", { value1: historyKindLabel(entry.kind) }), `
            <div class="tm-ai-box">
                <h4>${__tmT("ai.recordDetails")}</h4>
                <div class="tm-ai-hint">${__tmT("ai.idItems", { id: esc(entry.id), value2: entry.updatedAt ? ` · ${esc(formatTs(entry.updatedAt))}` : '', count: entry.count })}</div>
            </div>
            ${renderHistory(history) || `<div class="tm-ai-box"><div class="tm-ai-hint">${__tmT("ai.noRecordContent")}</div></div>`}
            <div class="tm-ai-actions">
                <button class="tm-btn tm-btn-secondary" data-ai-action="back-history">${__tmT("ai.backToList")}</button>
                <button class="tm-btn tm-btn-primary" data-ai-action="continue-entry">${__tmT("ai.continue")}</button>
                <button class="tm-btn tm-btn-success" data-ai-action="close">${__tmT("common.close")}</button>
            </div>
        `);
        const body = modal.querySelector('.tm-ai-modal__body');
        body.addEventListener('click', async (event) => {
            const action = String(event.target?.dataset?.aiAction || '');
            if (!action) return;
            if (action === 'back-history') {
                await showHistory(filterId);
                return;
            }
            if (action !== 'continue-entry') return;
            if (entry.kind === 'doc-chat') {
                await openDocChat(entry.id);
            } else if (entry.kind === 'doc-smart') {
                await analyzeSmart(entry.id);
            } else if (entry.kind === 'doc-schedule') {
                await planSchedule(entry.id);
            } else if (entry.kind === 'task-title') {
                await optimizeTitle(entry.id);
            } else if (entry.kind === 'task-edit') {
                await editTask(entry.id);
            } else if (entry.kind === 'task-schedule') {
                await planSchedule({ taskId: entry.id });
            }
        });
    }

    function historyKindLabel(kind) {
        const key = String(kind || '').trim();
        if (key === 'doc-chat') return __tmT("ai.documentChat");
        if (key === 'doc-smart') return __tmT("ai.smartAnalysis");
        if (key === 'doc-schedule') return __tmT("ai.documentScheduling");
        if (key === 'task-title') return __tmT("ai.taskNaming");
        if (key === 'task-edit') return __tmT("ai.taskFieldEditing");
        if (key === 'task-schedule') return __tmT("ai.taskScheduling");
        return __tmT("ai.aiRecords");
    }

    async function listHistoryEntries(filterId) {
        await ConversationStore.ensureLoaded();
        const list = [];
        const tail = String(filterId || '').trim();
        ConversationStore.list().forEach((conversation) => {
            const rawKey = String(conversation?.legacyKey || '').trim();
            if (!rawKey.startsWith(HISTORY_PREFIX)) return;
            const rest = rawKey.slice(HISTORY_PREFIX.length);
            const splitAt = rest.indexOf(':');
            if (splitAt <= 0) return;
            const kind = rest.slice(0, splitAt);
            const id = rest.slice(splitAt + 1);
            if (tail && id !== tail) return;
            const history = (Array.isArray(conversation?.messages) ? conversation.messages : []).map(normalizeMessage).filter((it) => it.content).slice(-20);
            if (!history.length) return;
            const last = history[history.length - 1];
            list.push({
                key: rawKey,
                kind,
                id,
                count: history.length,
                updatedAt: Number(last?.ts || 0),
                preview: String(last?.content || '').trim().slice(0, 120),
            });
        });
        return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }

    function formatTs(ts) {
        const n = Number(ts || 0);
        if (!n) return '';
        try {
            return new Date(n).toLocaleString();
        } catch (e) {
            return '';
        }
    }

    async function removeHistory(kind, id) {
        await ConversationStore.ensureLoaded();
        const key = historyKey(kind, id);
        const list = ConversationStore.list().filter((it) => String(it?.legacyKey || '').trim() !== key);
        ConversationStore.data = ConversationStore.normalizePayload({
            activeId: String(ConversationStore.data.activeId || '').trim(),
            conversations: list,
        });
        if (!ConversationStore.get(ConversationStore.data.activeId)) {
            ConversationStore.data.activeId = String(list[0]?.id || '').trim();
            aiRuntime.activeConversationId = ConversationStore.data.activeId;
        }
        await ConversationStore.saveNow();
    }

    function getConfig() {
        const s = bridge()?.getSettings?.() || {};
        const providerRaw = String(s.aiProvider || '').trim();
        const provider = providerRaw === 'deepseek'
            ? 'deepseek'
            : (providerRaw === 'openai'
                ? 'openai'
                : (providerRaw === 'anthropic' ? 'anthropic' : 'minimax'));
        const statusOptions = Array.isArray(s.customStatusOptions)
            ? s.customStatusOptions.map((it) => ({
                id: String(it?.id || '').trim(),
                name: String(it?.name || '').trim(),
                color: String(it?.color || '').trim(),
            })).filter((it) => it.id || it.name)
            : [];
        const apiKey = provider === 'deepseek'
            ? String(s.aiDeepSeekApiKey || '').trim()
            : (provider === 'openai'
                ? String(s.aiOpenAIApiKey || '').trim()
                : (provider === 'anthropic'
                    ? String(s.aiAnthropicApiKey || '').trim()
                    : String(s.aiMiniMaxApiKey || '').trim()));
        const baseUrlFallback = provider === 'deepseek'
            ? DEFAULT_DEEPSEEK_BASE_URL
            : (provider === 'openai'
                ? DEFAULT_OPENAI_BASE_URL
                : (provider === 'anthropic' ? DEFAULT_ANTHROPIC_BASE_URL : DEFAULT_BASE_URL));
        const baseUrlRaw = provider === 'deepseek'
            ? String(s.aiDeepSeekBaseUrl || DEFAULT_DEEPSEEK_BASE_URL).trim()
            : (provider === 'openai'
                ? String(s.aiOpenAIBaseUrl || DEFAULT_OPENAI_BASE_URL).trim()
                : (provider === 'anthropic'
                    ? String(s.aiAnthropicBaseUrl || DEFAULT_ANTHROPIC_BASE_URL).trim()
                    : String(s.aiMiniMaxBaseUrl || DEFAULT_BASE_URL).trim()));
        const baseUrl = baseUrlRaw.replace(/\/+$/, '') || baseUrlFallback;
        const model = provider === 'deepseek'
            ? (String(s.aiDeepSeekModel || DEFAULT_DEEPSEEK_MODEL).trim() || DEFAULT_DEEPSEEK_MODEL)
            : (provider === 'openai'
                ? (String(s.aiOpenAIModel || DEFAULT_OPENAI_MODEL).trim() || DEFAULT_OPENAI_MODEL)
                : (provider === 'anthropic'
                    ? (String(s.aiAnthropicModel || DEFAULT_ANTHROPIC_MODEL).trim() || DEFAULT_ANTHROPIC_MODEL)
                    : (String(s.aiMiniMaxModel || DEFAULT_MODEL).trim() || DEFAULT_MODEL)));
        return {
            provider,
            enabled: !!s.aiEnabled,
            apiKey,
            baseUrl,
            model,
            temperature: Number.isFinite(Number(s.aiMiniMaxTemperature)) ? Number(s.aiMiniMaxTemperature) : 0.2,
            maxTokens: Number.isFinite(Number(s.aiMiniMaxMaxTokens)) ? Number(s.aiMiniMaxMaxTokens) : 1600,
            timeoutMs: Number.isFinite(Number(s.aiMiniMaxTimeoutMs)) ? Number(s.aiMiniMaxTimeoutMs) : 30000,
            conversationFontSize: Number.isFinite(Number(s.aiConversationFontSize))
                ? Math.max(12, Math.min(22, Math.round(Number(s.aiConversationFontSize))))
                : 14,
            contextMode: String(s.aiDefaultContextMode || 'nearby').trim() === 'fulltext'
                ? 'fulltext'
                : (String(s.aiDefaultContextMode || 'nearby').trim() === 'none' ? 'none' : 'nearby'),
            scheduleWindows: parseScheduleWindows(s.aiScheduleWindows || ['09:00-18:00']),
            statusOptions,
        };
    }

    function resolveConfiguredStatusOption(value, options) {
        const list = Array.isArray(options) ? options : [];
        const raw = String(value || '').trim();
        if (!raw) return null;
        const rawNorm = normalizeLooseLabel(raw);
        if (!rawNorm) return null;
        const exactId = list.find((it) => String(it?.id || '').trim() === raw);
        if (exactId) return exactId;
        const exactName = list.find((it) => String(it?.name || '').trim() === raw);
        if (exactName) return exactName;
        const looseName = list.find((it) => normalizeLooseLabel(it?.name) === rawNorm);
        if (looseName) return looseName;
        const looseId = list.find((it) => normalizeLooseLabel(it?.id) === rawNorm);
        if (looseId) return looseId;
        return null;
    }

    function resolveConfiguredStatusId(value, options) {
        const matched = resolveConfiguredStatusOption(value, options);
        return matched ? String(matched.id || '').trim() : String(value || '').trim();
    }

    function formatConfiguredStatusPrompt(options) {
        const list = Array.isArray(options) ? options.filter((it) => it.id || it.name) : [];
        if (!list.length) return __tmT("ai.noStatusConfigurationIsAvailable");
        return list.map((it) => `${String(it.name || it.id || '').trim()} -> ${String(it.id || '').trim()}`).join('；');
    }

    function providerLabel(provider) {
        if (provider === 'deepseek') return 'DeepSeek';
        if (provider === 'openai') return 'OpenAI';
        if (provider === 'anthropic') return 'Anthropic';
        return 'MiniMax';
    }

    function assertReady(allowDisabled) {
        const cfg = getConfig();
        if (!cfg.apiKey) throw new Error(__tmT("ai.fillInTheApiKeyInAiSettingsFirst", { value1: providerLabel(cfg.provider) }));
        if (!allowDisabled && !cfg.enabled) throw new Error(__tmT("ai.enableTheAiFeatureFirst"));
        return cfg;
    }

    function resolveRequestTimeoutMs(cfg, opt = {}) {
        const base = Math.max(5000, Number(opt.timeoutMs || cfg.timeoutMs || 30000));
        const mode = String(opt.contextMode || '').trim();
        return mode === 'fulltext' ? Math.max(base, 90000) : base;
    }

    function normalizeAiErrorMessage(message, provider) {
        const raw = String(message || '').trim();
        if (!raw) return __tmT("ai.requestFailed", { provider: provider });
        if (/failed to fetch/i.test(raw)) return __tmT("ai.theAiRequestCouldNotConnectOnMobileThe");
        if (/network/i.test(raw)) return __tmT("ai.networkRequestFailed", { raw: raw });
        return raw;
    }

    function shouldRetryDirectFromMobileProxy(raw) {
        const text = String(raw || '').trim().toLowerCase();
        if (!text) return false;
        return text.includes('authorization')
            || text.includes('api secret key')
            || text.includes('login fail')
            || text.includes('unauthorized')
            || text.includes('401');
    }

    function resolveMiniMaxOpenAiBaseUrl(baseUrl) {
        const raw = String(baseUrl || '').trim().replace(/\/+$/, '');
        if (!raw) return 'https://api.minimaxi.com/v1';
        if (/\/anthropic$/i.test(raw)) return raw.replace(/\/anthropic$/i, '/v1');
        if (/\/v1$/i.test(raw)) return raw;
        return `${raw}/v1`;
    }

    function resolveOpenAiBaseUrl(baseUrl) {
        const raw = String(baseUrl || '').trim().replace(/\/+$/, '');
        if (!raw) return DEFAULT_OPENAI_BASE_URL;
        if (/\/v1$/i.test(raw)) return raw;
        if (/\/openai$/i.test(raw)) return `${raw}/v1`;
        return `${raw}/v1`;
    }

    function resolveAnthropicBaseUrl(baseUrl) {
        const raw = String(baseUrl || '').trim().replace(/\/+$/, '');
        if (!raw) return DEFAULT_ANTHROPIC_BASE_URL;
        return raw.replace(/\/v1$/i, '');
    }

    function extractOpenAiMessageText(content) {
        if (Array.isArray(content)) {
            return content.map((item) => {
                if (typeof item === 'string') return item;
                if (item && typeof item === 'object') return String(item?.text || item?.content || '').trim();
                return '';
            }).filter(Boolean).join('\n').trim();
        }
        if (content && typeof content === 'object') {
            return String(content?.text || content?.content || '').trim();
        }
        return String(content || '').trim();
    }

    async function requestAiHttp(url, options = {}, meta = {}) {
        const controller = meta.controller;
        const timeoutMs = Math.max(5000, Number(meta.timeoutMs || 30000));
        const headersObj = (options?.headers && typeof options.headers === 'object') ? options.headers : {};
        const method = String(options?.method || 'POST').trim().toUpperCase();
        const rawBody = options?.body ?? '';
        const payload = (() => {
            if (typeof rawBody !== 'string') return rawBody ?? null;
            try { return JSON.parse(rawBody); } catch (e) { return rawBody; }
        })();
        const shouldProxy = meta.preferProxy !== false && isMobileClient();
        const directSignal = controller?.signal || options?.signal;
        const doDirectFetch = async () => await fetch(url, {
            ...options,
            signal: directSignal,
        });
        if (shouldProxy && meta.preferDirectFirst !== false) {
            try {
                return await doDirectFetch();
            } catch (e) {}
        }
        if (shouldProxy) {
            const headerMap = new Map();
            Object.entries(headersObj).forEach(([key, value]) => {
                const rawKey = String(key || '').trim();
                if (!rawKey) return;
                const lowerKey = rawKey.toLowerCase();
                headerMap.set(lowerKey, {
                    key: lowerKey === 'authorization' ? 'authorization' : rawKey,
                    value: String(value ?? ''),
                });
            });
            const headers = Array.from(headerMap.values()).filter((it) => it.key);
            const res = await fetch('/api/network/forwardProxy', {
                method: 'POST',
                signal: controller?.signal,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url,
                    method,
                    timeout: timeoutMs,
                    contentType: 'application/json',
                    headers,
                    payload,
                    payloadEncoding: typeof payload === 'string' ? 'text' : 'json',
                    responseEncoding: 'text',
                }),
            });
            const raw = await res.text();
            if (!res.ok) throw new Error(__tmT("ai.proxyRequestFailedHttp", { status: res.status }));
            let json = {};
            try { json = raw ? JSON.parse(raw) : {}; } catch (e) {}
            if (Number(json?.code || 0) !== 0) {
                const errMsg = String(json?.msg || __tmT("ai.proxyRequestFailed"));
                if (shouldRetryDirectFromMobileProxy(errMsg)) {
                    try { return await doDirectFetch(); } catch (e) {}
                }
                throw new Error(errMsg);
            }
            const status = Number(json?.data?.status || 0);
            const bodyText = String(json?.data?.body || '');
            if (!(status >= 200 && status < 300) && shouldRetryDirectFromMobileProxy(bodyText)) {
                try { return await doDirectFetch(); } catch (e) {}
            }
            return {
                ok: status >= 200 && status < 300,
                status,
                text: async () => bodyText,
            };
        }
        return await doDirectFetch();
    }

    async function callMiniMax(system, payload, opt = {}) {
        const cfg = assertReady(false);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), resolveRequestTimeoutMs(cfg, opt));
        try {
            const history = Array.isArray(opt.history) ? opt.history : [];
            const userPayload = JSON.stringify(payload);
            const parseHttpError = (raw, status) => {
                let msg = `HTTP ${status}`;
                try {
                    const parsed = JSON.parse(raw);
                    msg = String(
                        parsed?.error?.message
                        || parsed?.message
                        || parsed?.base_resp?.status_msg
                        || parsed?.status_msg
                        || parsed?.msg
                        || msg
                    );
                } catch (e) {}
                return msg;
            };
            if (cfg.provider === 'deepseek') {
                const messages = [{ role: 'system', content: String(system || '').trim() }]
                    .concat(history.map((item) => ({
                        role: item?.role === 'assistant' ? 'assistant' : 'user',
                        content: String(item?.content || '').trim(),
                    })).filter((item) => item.content))
                    .concat([{ role: 'user', content: userPayload }]);
                const res = await requestAiHttp(`${cfg.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${cfg.apiKey}`,
                    },
                    body: JSON.stringify({
                        model: String(opt.model || cfg.model || DEFAULT_DEEPSEEK_MODEL),
                        messages,
                        temperature: Math.max(0, Math.min(1.5, Number(opt.temperature ?? cfg.temperature ?? 0.2))),
                        max_tokens: Math.max(256, Math.min(8192, Math.round(Number(opt.maxTokens || cfg.maxTokens || 1600)))),
                        response_format: { type: 'json_object' },
                    }),
                }, { controller, timeoutMs: resolveRequestTimeoutMs(cfg, opt) });
                const raw = await res.text();
                if (!res.ok) throw new Error(parseHttpError(raw, res.status));
                const json = JSON.parse(raw);
                const text = String(json?.choices?.[0]?.message?.content || '').trim();
                if (!text) throw new Error(__tmT("ai.deepseekReturnedAnEmptyResponse"));
                return text;
            }
            if (cfg.provider === 'anthropic') {
                const baseUrl = resolveAnthropicBaseUrl(cfg.baseUrl);
                const anthropicMessages = history.map((item) => ({
                    role: item?.role === 'assistant' ? 'assistant' : 'user',
                    content: String(item?.content || '').trim(),
                })).filter((item) => item.content);
                anthropicMessages.push({ role: 'user', content: userPayload });
                const res = await requestAiHttp(`${baseUrl}/v1/messages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': cfg.apiKey,
                        Authorization: `Bearer ${cfg.apiKey}`,
                        'anthropic-version': '2023-06-01',
                        'anthropic-dangerous-direct-browser-access': 'true',
                    },
                    body: JSON.stringify({
                        model: String(opt.model || cfg.model || DEFAULT_ANTHROPIC_MODEL),
                        system: String(system || '').trim(),
                        messages: anthropicMessages,
                        max_tokens: Math.max(256, Math.min(8192, Math.round(Number(opt.maxTokens || cfg.maxTokens || 1600)))),
                        temperature: Math.max(0, Math.min(1.5, Number(opt.temperature ?? cfg.temperature ?? 0.2))),
                    }),
                }, { controller, timeoutMs: resolveRequestTimeoutMs(cfg, opt) });
                const raw = await res.text();
                if (!res.ok) throw new Error(parseHttpError(raw, res.status));
                const json = JSON.parse(raw);
                const text = Array.isArray(json?.content)
                    ? json.content.filter((it) => it?.type === 'text').map((it) => String(it?.text || '')).join('\n').trim()
                    : '';
                if (!text) throw new Error(__tmT("ai.anthropicReturnedAnEmptyResponse"));
                return text;
            }
            if (cfg.provider === 'openai') {
                const baseUrl = resolveOpenAiBaseUrl(cfg.baseUrl);
                const messages = [{ role: 'system', content: String(system || '').trim() }]
                    .concat(history.map((item) => ({
                        role: item?.role === 'assistant' ? 'assistant' : 'user',
                        content: String(item?.content || '').trim(),
                    })).filter((item) => item.content))
                    .concat([{ role: 'user', content: userPayload }]);
                const modelName = String(opt.model || cfg.model || DEFAULT_OPENAI_MODEL);
                const tokenBudget = Math.max(256, Math.min(8192, Math.round(Number(opt.maxTokens || cfg.maxTokens || 1600))));
                const requestBody = {
                    model: modelName,
                    messages,
                    max_completion_tokens: tokenBudget,
                };
                if (opt.expectJson !== false) {
                    requestBody.response_format = { type: 'json_object' };
                }
                const tryRequest = async (body) => requestAiHttp(`${baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${cfg.apiKey}`,
                    },
                    body: JSON.stringify(body),
                }, { controller, timeoutMs: resolveRequestTimeoutMs(cfg, opt) });
                let res = await tryRequest(requestBody);
                let raw = await res.text();
                if (!res.ok && requestBody.response_format && /response_format|json_object/i.test(raw)) {
                    const fallbackBody = { ...requestBody };
                    delete fallbackBody.response_format;
                    res = await tryRequest(fallbackBody);
                    raw = await res.text();
                }
                if (!res.ok) throw new Error(parseHttpError(raw, res.status));
                const json = JSON.parse(raw);
                const text = extractOpenAiMessageText(json?.choices?.[0]?.message?.content);
                if (!text) throw new Error(__tmT("ai.openaiReturnedAnEmptyResponse"));
                return text;
            }
            const messages = history.map((item) => ({
                role: item?.role === 'assistant' ? 'assistant' : 'user',
                content: String(item?.content || '').trim(),
            })).filter((item) => item.content);
            messages.push({ role: 'user', content: userPayload });
            const requestMiniMaxAnthropic = async () => {
                const res = await requestAiHttp(`${cfg.baseUrl}/v1/messages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': cfg.apiKey,
                        Authorization: `Bearer ${cfg.apiKey}`,
                        'anthropic-version': '2023-06-01',
                    },
                    body: JSON.stringify({
                        model: String(opt.model || cfg.model || DEFAULT_MODEL),
                        system,
                        messages,
                        max_tokens: Math.max(256, Math.min(8192, Math.round(Number(opt.maxTokens || cfg.maxTokens || 1600)))),
                        temperature: Math.max(0, Math.min(1.5, Number(opt.temperature ?? cfg.temperature ?? 0.2))),
                    }),
                }, { controller, timeoutMs: resolveRequestTimeoutMs(cfg, opt) });
                const raw = await res.text();
                if (!res.ok) throw new Error(parseHttpError(raw, res.status));
                const json = JSON.parse(raw);
                const text = Array.isArray(json?.content)
                    ? json.content.filter((it) => it?.type === 'text').map((it) => String(it?.text || '')).join('\n').trim()
                    : '';
                if (!text) throw new Error(__tmT("ai.minimaxReturnedAnEmptyResponse"));
                return text;
            };
            const requestMiniMaxOpenAi = async () => {
                const baseUrl = resolveMiniMaxOpenAiBaseUrl(cfg.baseUrl);
                const res = await requestAiHttp(`${baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${cfg.apiKey}`,
                    },
                    body: JSON.stringify({
                        model: String(opt.model || cfg.model || DEFAULT_MODEL),
                        messages: [{ role: 'system', content: String(system || '').trim() }].concat(messages),
                        temperature: Math.max(0, Math.min(1.5, Number(opt.temperature ?? cfg.temperature ?? 0.2))),
                        max_tokens: Math.max(256, Math.min(8192, Math.round(Number(opt.maxTokens || cfg.maxTokens || 1600)))),
                    }),
                }, { controller, timeoutMs: resolveRequestTimeoutMs(cfg, opt) });
                const raw = await res.text();
                if (!res.ok) throw new Error(parseHttpError(raw, res.status));
                const json = JSON.parse(raw);
                const text = extractOpenAiMessageText(json?.choices?.[0]?.message?.content);
                if (!text) throw new Error(__tmT("ai.minimaxOpenaiCompatibleReturnedAnEmptyResponse"));
                return text;
            };
            try {
                return await requestMiniMaxAnthropic();
            } catch (anthropicError) {
                const anthroMsg = String(anthropicError?.message || anthropicError || '').trim();
                const shouldFallbackToOpenAi = anthropicError?.name !== 'AbortError'
                    && (isMobileClient()
                        || shouldRetryDirectFromMobileProxy(anthroMsg)
                        || /anthropic|x-api-key|authorization|api secret key|login fail/i.test(anthroMsg));
                if (!shouldFallbackToOpenAi) throw anthropicError;
                try {
                    return await requestMiniMaxOpenAi();
                } catch (openAiError) {
                    const fallbackMsg = String(openAiError?.message || openAiError || '').trim();
                    throw new Error(fallbackMsg || anthroMsg || __tmT("ai.minimaxRequestFailed"));
                }
            }
        } catch (e) {
            const msg = String(e?.message || e || '').trim();
            if (e?.name === 'AbortError' || /aborted|abort|signal/i.test(msg)) {
                const mode = String(opt.contextMode || '').trim() === 'fulltext' ? __tmT("ai.fullTextMode") : __tmT("ai.currentMode");
                throw new Error(__tmT("ai.requestTimedOutAndWasAbortedRetryOrIncrease", { mode: mode }));
            }
            throw new Error(normalizeAiErrorMessage(msg, providerLabel(cfg.provider)));
        } finally {
            clearTimeout(timeout);
        }
    }

    async function saveDebugRecord(record) {
        if (globalThis.__tmSuppressStorageWrites === true) return;
        try {
            const formDir = new FormData();
            formDir.append('path', PLUGIN_STORAGE_DIR);
            formDir.append('isDir', 'true');
            globalThis.__tmHost?.appendStorageRequestApp?.(formDir);
            await fetch('/api/file/putFile', { method: 'POST', body: formDir }).catch(() => null);

            let list = [];
            try {
                const res = await fetch('/api/file/getFile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: AI_DEBUG_FILE_PATH }),
                });
                if (res.ok) {
                    const text = await res.text();
                    if (text && text.trim()) {
                        const json = JSON.parse(text);
                        if (Array.isArray(json)) list = json;
                    }
                }
            } catch (e) {}

            list.push({
                ts: Date.now(),
                ...record,
            });
            list = list.slice(-20);

            const form = new FormData();
            form.append('path', AI_DEBUG_FILE_PATH);
            form.append('isDir', 'false');
            form.append('file', new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' }));
            globalThis.__tmHost?.appendStorageRequestApp?.(form);
            await fetch('/api/file/putFile', { method: 'POST', body: form }).catch(() => null);
        } catch (e) {}
    }

    function parseJson(text) {
        const source = String(text || '').trim();
        const candidates = [];
        const pushCandidate = (value) => {
            const next = String(value || '').trim();
            if (!next) return;
            if (!candidates.includes(next)) candidates.push(next);
        };
        const normalizeCandidate = (value) => String(value || '')
            .replace(/^\uFEFF/, '')
            .replace(/[“”]/g, '"')
            .replace(/[‘’]/g, '"')
            .replace(/[，]/g, ',')
            .replace(/[：]/g, ':')
            .replace(/[（]/g, '(')
            .replace(/[）]/g, ')')
            .replace(/,\s*([}\]])/g, '$1')
            .trim();
        const extractBalancedJson = (input) => {
            const s = String(input || '');
            let start = -1;
            let open = '';
            let close = '';
            let depth = 0;
            let inString = false;
            let escaped = false;
            for (let i = 0; i < s.length; i += 1) {
                const ch = s[i];
                if (start < 0) {
                    if (ch === '{' || ch === '[') {
                        start = i;
                        open = ch;
                        close = ch === '{' ? '}' : ']';
                        depth = 1;
                        inString = false;
                        escaped = false;
                    }
                    continue;
                }
                if (inString) {
                    if (escaped) {
                        escaped = false;
                    } else if (ch === '\\') {
                        escaped = true;
                    } else if (ch === '"') {
                        inString = false;
                    }
                    continue;
                }
                if (ch === '"') {
                    inString = true;
                    continue;
                }
                if (ch === open) {
                    depth += 1;
                    continue;
                }
                if (ch === close) {
                    depth -= 1;
                    if (depth === 0) return s.slice(start, i + 1);
                }
            }
            return '';
        };

        pushCandidate(source);
        const fenced = source.match(/```json\s*([\s\S]*?)```/i);
        if (fenced) pushCandidate(String(fenced[1] || '').trim());
        const balanced = extractBalancedJson(source);
        if (balanced) pushCandidate(balanced);

        let lastError = null;
        for (const candidate of candidates) {
            const variants = [candidate, normalizeCandidate(candidate)];
            for (const variant of variants) {
                try {
                    return JSON.parse(variant);
                } catch (e) {
                    lastError = e;
                    const nested = extractBalancedJson(variant);
                    if (nested && nested !== variant) {
                        try {
                            return JSON.parse(normalizeCandidate(nested));
                        } catch (e2) {
                            lastError = e2;
                        }
                    }
                }
            }
        }
        throw new Error(String(lastError?.message || __tmT("ai.theAiResponseIsNotValidJson")));
    }

    function normalizeSchemaResult(parsed, expectedSchema) {
        const schema = String(expectedSchema || '').trim();
        const value = parsed && typeof parsed === 'object' ? parsed : {};
        if (!schema) return value;
        if (schema === 'smart_analysis') {
            if (value.analysis && typeof value.analysis === 'object') return value.analysis;
            if (value.result && typeof value.result === 'object') return value.result;
        }
        if (schema === 'task_rename_suggestions') {
            if (Array.isArray(value.taskRenameSuggestions)) return value;
            if (value.analysis && Array.isArray(value.analysis.taskRenameSuggestions)) return value.analysis;
            if (value.result && Array.isArray(value.result.taskRenameSuggestions)) return value.result;
        }
        if (schema === 'edit_task_fields') {
            if (value.patch && typeof value.patch === 'object') return value;
            if (value.result && value.result.patch) return value.result;
        }
        if (schema === 'optimize_title') {
            if (typeof value.suggestedTitle === 'string') return value;
            if (value.result && typeof value.result.suggestedTitle === 'string') return value.result;
        }
        if (schema === 'schedule_plan') {
            if (Array.isArray(value.timeBlocks)) return value;
            if (value.result && Array.isArray(value.result.timeBlocks)) return value.result;
        }
        if (schema === 'doc_chat') {
            if (typeof value.answer === 'string') return value;
            if (value.result && typeof value.result.answer === 'string') return value.result;
        }
        if (schema === 'chat_skill_plan') {
            if (Array.isArray(value.skillCalls) || Array.isArray(value.plan) || typeof value.done === 'boolean') return value;
            if (value.result && (Array.isArray(value.result.skillCalls) || Array.isArray(value.result.plan) || typeof value.result.done === 'boolean')) return value.result;
        }
        if (schema === 'chat_skill_final') {
            if (typeof value.answer === 'string') return value;
            if (value.result && typeof value.result.answer === 'string') return value.result;
        }
        return value;
    }

    function isLikelyTruncatedJson(text) {
        const s = String(text || '').trim();
        if (!s) return false;
        if (/unterminated|unexpected end/i.test(s)) return true;
        const quoteCount = (s.match(/(?<!\\)"/g) || []).length;
        if (quoteCount % 2 === 1) return true;
        const opens = (s.match(/[{\[]/g) || []).length;
        const closes = (s.match(/[}\]]/g) || []).length;
        return opens > closes;
    }

    async function callMiniMaxJson(system, payload, opt = {}) {
        let raw = await callMiniMax(system, payload, opt);
        try {
            return normalizeSchemaResult(parseJson(raw), opt.expectedSchema);
        } catch (e) {
            const msg = String(e?.message || e || '').trim();
            const needsRepair = /unterminated|unexpected|expected|json/i.test(msg);
            if (!needsRepair) throw e;
            if (isLikelyTruncatedJson(raw)) {
                try {
                    raw = await callMiniMax(system, payload, {
                        ...opt,
                        temperature: 0,
                        maxTokens: Math.max(1600, Math.min(3200, Math.round(Number(opt.maxTokens || 1200) * 1.8))),
                    });
                    return normalizeSchemaResult(parseJson(raw), opt.expectedSchema);
                } catch (retryError) {}
            }
            let repaired = '';
            let rebuilt = '';
            const cfg = getConfig();
            const defaultRepairModel = cfg.provider === 'deepseek'
                ? (cfg.model || DEFAULT_DEEPSEEK_MODEL)
                : (cfg.provider === 'openai'
                    ? (cfg.model || DEFAULT_OPENAI_MODEL)
                    : (cfg.provider === 'anthropic'
                        ? (cfg.model || DEFAULT_ANTHROPIC_MODEL)
                        : 'MiniMax-M2.7-highspeed'));
            const repairModel = String(opt.repairModel || defaultRepairModel);
            try {
                repaired = await callMiniMax(
                    __tmT("ai.youAreAJsonRepairAssistantFixTheContent"),
                    {
                        expected: String(opt.expectedSchema || '').trim(),
                        brokenJson: raw,
                    },
                    {
                        contextMode: opt.contextMode,
                        timeoutMs: Math.min(30000, Number(opt.timeoutMs || 30000)),
                        maxTokens: Math.max(600, Math.min(2200, Number(opt.maxTokens || 1200))),
                        temperature: 0,
                        history: [],
                        model: repairModel,
                    }
                );
                return normalizeSchemaResult(parseJson(repaired), opt.expectedSchema);
            } catch (repairError) {
                try {
                    rebuilt = await callMiniMax(
                        __tmT("ai.youAreAStructuredDataRebuildAssistantBasedOn"),
                        {
                            expectedSchema: String(opt.expectedSchema || '').trim(),
                            sourceText: repaired || raw,
                        },
                        {
                            contextMode: opt.contextMode,
                            timeoutMs: Math.min(30000, Number(opt.timeoutMs || 30000)),
                            maxTokens: Math.max(700, Math.min(2400, Number(opt.maxTokens || 1200))),
                            temperature: 0,
                            history: [],
                            model: repairModel,
                        }
                    );
                    return normalizeSchemaResult(parseJson(rebuilt), opt.expectedSchema);
                } catch (rebuildError) {
                    await saveDebugRecord({
                        kind: 'json-parse-failed',
                        expectedSchema: String(opt.expectedSchema || '').trim(),
                        parseError: msg,
                        repairError: String(repairError?.message || repairError || ''),
                        rebuildError: String(rebuildError?.message || rebuildError || ''),
                        rawResponse: raw,
                        repairedResponse: repaired,
                        rebuiltResponse: rebuilt,
                    });
                    throw e;
                }
            }
        }
    }

    function ensureAiStyle() {
        let style = document.getElementById('tm-ai-style');
        if (style) return style;
        style = document.createElement('style');
        style.id = 'tm-ai-style';
        style.textContent = `
.tm-ai-modal{position:fixed;inset:0;z-index:210000;display:flex;align-items:center;justify-content:center;}
.tm-ai-modal__mask{position:absolute;inset:0;background:rgba(0,0,0,.38);}
.tm-ai-modal__dialog{position:relative;width:min(900px,calc(100vw - 24px));max-height:min(86vh,900px);background:var(--b3-theme-background);color:var(--b3-theme-on-background);border:1px solid var(--b3-theme-surface-light);border-radius:12px;display:flex;flex-direction:column;overflow:hidden;}
.tm-ai-modal__header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--b3-theme-surface-light);}
.tm-ai-modal__body{padding:16px;overflow:auto;display:flex;flex-direction:column;gap:14px;}
.tm-ai-label{font-size:13px;font-weight:600;margin-bottom:6px;}
.tm-ai-hint{font-size:12px;opacity:.74;line-height:1.6;}
.tm-ai-textarea{width:100%;min-height:110px;resize:vertical;padding:10px 12px;box-sizing:border-box;border:1px solid var(--b3-theme-surface-light);border-radius:8px;background:var(--b3-theme-surface);color:inherit;}
.tm-ai-box{border:1px solid var(--b3-theme-surface-light);border-radius:10px;background:var(--b3-theme-surface);padding:12px;}
.tm-ai-box h4{margin:0 0 8px;font-size:13px;}
.tm-ai-list{display:flex;flex-direction:column;gap:8px;}
.tm-ai-item{border:1px solid var(--b3-theme-surface-light);border-radius:8px;padding:10px 12px;background:var(--b3-theme-background);}
.tm-ai-code{white-space:pre-wrap;word-break:break-word;font-family:Consolas,Monaco,monospace;font-size:12px;line-height:1.6;background:rgba(127,127,127,.08);padding:12px;border-radius:8px;}
.tm-ai-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;}
.tm-ai-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;}
.tm-ai-score{border:1px solid var(--b3-theme-surface-light);border-radius:8px;padding:10px;text-align:center;background:var(--b3-theme-background);}
.tm-ai-score b{display:block;font-size:22px;}
.tm-ai-sidebar{height:100%;display:flex;flex-direction:column;background:var(--b3-theme-background);color:var(--b3-theme-on-background);--tm-ai-history-bg:color-mix(in srgb, #ffd54f 18%, var(--b3-theme-background));--tm-ai-setup-bg:color-mix(in srgb, #4f8cff 16%, var(--b3-theme-background));--tm-ai-setup-border:color-mix(in srgb, #4f8cff 34%, var(--b3-theme-surface-light));}
[data-theme-mode="dark"] .tm-ai-sidebar{--tm-ai-history-bg:color-mix(in srgb, #f2c94c 24%, var(--b3-theme-background));--tm-ai-setup-bg:color-mix(in srgb, #4f8cff 22%, var(--b3-theme-background));--tm-ai-setup-border:color-mix(in srgb, #6ea2ff 42%, var(--b3-theme-surface-light));}
.tm-ai-sidebar__head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 10px;border-bottom:1px solid var(--b3-theme-surface-light);min-height:42px;box-sizing:border-box;}
.tm-ai-sidebar__title-row{display:flex;align-items:center;gap:4px;min-width:0;flex:0 0 auto;}
.tm-ai-sidebar__title{font-size:14px;font-weight:700;line-height:1.2;white-space:nowrap;}
.tm-ai-sidebar__title-toggle{width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;padding:0;border:none;background:transparent;color:var(--b3-theme-on-background);opacity:.72;cursor:pointer;flex-shrink:0;line-height:1;}
.tm-ai-sidebar__title-toggle:hover{opacity:1;}
.tm-ai-sidebar__title-toggle-icon{transition:transform .16s ease;}
.tm-ai-sidebar__head-title{flex:1 1 auto;min-width:120px;max-width:240px;}
.tm-ai-sidebar__head-title .tm-ai-sidebar__title-input{min-height:32px;height:32px;padding:0 12px;font-size:12px;border-radius:9px;}
.tm-ai-sidebar__head-actions{display:flex;gap:6px;align-items:center;flex-wrap:nowrap;justify-content:flex-end;flex-shrink:0;}
.tm-ai-sidebar__head .tm-btn{height:30px;min-height:30px;padding:0 10px;border-radius:8px;font-size:12px;line-height:1;white-space:nowrap;}
  .tm-ai-sidebar__history{padding:8px 10px;border-bottom:1px solid var(--b3-theme-surface-light);display:flex;flex-direction:column;gap:8px;max-height:170px;overflow:auto;background:var(--tm-ai-history-bg);}
 .tm-ai-sidebar__history.is-hidden{display:none;}
 .tm-ai-sidebar__history-item{border:1px solid var(--b3-theme-surface-light);background:var(--b3-theme-surface);border-radius:10px;padding:7px 9px;display:flex;flex-direction:column;gap:3px;text-align:left;cursor:pointer;color:inherit;}
 .tm-ai-sidebar__history-item.is-active{border-color:var(--b3-theme-primary);box-shadow:0 0 0 1px color-mix(in srgb, var(--b3-theme-primary) 18%, transparent);}
 .tm-ai-sidebar__history-item-head{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;}
 .tm-ai-sidebar__history-item-title{min-width:0;flex:1 1 auto;font-size:12px;font-weight:600;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
 .tm-ai-sidebar__history-item small{opacity:.68;font-size:11px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
 .tm-ai-sidebar__history-delete{font-size:11px;opacity:.7;flex-shrink:0;align-self:flex-start;line-height:1.2;}
.tm-ai-sidebar__panel{padding:8px 12px;display:flex;flex-direction:column;gap:8px;overflow:auto;min-height:0;flex:1 1 auto;}
.tm-ai-sidebar__setup{display:flex;flex-direction:column;gap:8px;padding:10px;border:1px solid var(--tm-ai-setup-border);border-radius:12px;background:var(--tm-ai-setup-bg);}
.tm-ai-sidebar__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
.tm-ai-sidebar__grid label{display:flex;flex-direction:column;gap:4px;font-size:12px;min-width:0;}
.tm-ai-sidebar__grid label > span{font-size:12px;font-weight:600;line-height:1.2;opacity:.92;padding-left:2px;}
.tm-ai-sidebar__setup-row{display:flex;flex-direction:column;gap:4px;}
.tm-ai-sidebar__setup-row > span{font-size:12px;font-weight:600;line-height:1.2;opacity:.92;padding-left:2px;}
.tm-ai-sidebar__segmented{display:flex;align-items:center;gap:4px;padding:4px;border:1px solid color-mix(in srgb, var(--b3-theme-surface-light) 78%, var(--b3-theme-on-background) 16%);border-radius:12px;background:color-mix(in srgb, var(--b3-theme-surface) 90%, var(--b3-theme-background));box-shadow:inset 0 1px 0 rgba(255,255,255,.03);overflow:hidden;}
.tm-ai-sidebar__segmented .tm-ai-sidebar__seg-btn{flex:1 1 25%;min-width:0;height:32px;padding:0 8px;border:none;border-radius:8px;background:transparent;color:var(--b3-theme-on-background);font-size:12px;font-weight:700;line-height:1;cursor:pointer;white-space:nowrap;transition:background-color .16s ease,color .16s ease,box-shadow .16s ease,transform .16s ease;}
.tm-ai-sidebar__segmented .tm-ai-sidebar__seg-btn:hover{background:rgba(127,127,127,.1);}
.tm-ai-sidebar__segmented .tm-ai-sidebar__seg-btn.is-active{background:color-mix(in srgb, var(--b3-theme-primary) 20%, var(--b3-theme-surface));color:color-mix(in srgb, var(--b3-theme-primary) 90%, white 6%);box-shadow:0 0 0 1px color-mix(in srgb, var(--b3-theme-primary) 24%, transparent);}
.tm-ai-sidebar__grid .tm-ai-sidebar__title-input,
.tm-ai-sidebar__grid .tm-rule-select{width:100%;height:40px;min-height:40px;box-sizing:border-box;border-radius:10px;border:1px solid color-mix(in srgb, var(--b3-theme-surface-light) 78%, var(--b3-theme-on-background) 16%);background-color:color-mix(in srgb, var(--b3-theme-surface) 90%, var(--b3-theme-background));background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2.25 4.25 6 8l3.75-3.75' fill='none' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;background-size:12px 12px;color:var(--b3-theme-on-background);font-size:13px;line-height:1.2;box-shadow:inset 0 1px 0 rgba(255,255,255,.03);transition:border-color .16s ease, box-shadow .16s ease, background-color .16s ease;outline:none;appearance:none;-webkit-appearance:none;}
.tm-ai-sidebar__grid .tm-ai-sidebar__title-input{padding:0 14px;}
.tm-ai-sidebar__grid .tm-ai-sidebar__title-input{background-image:none;background-position:initial;background-size:auto;background-repeat:repeat;}
.tm-ai-sidebar__grid .tm-rule-select{padding:0 36px 0 14px;}
.tm-ai-sidebar__grid .tm-ai-sidebar__title-input:focus,
.tm-ai-sidebar__grid .tm-rule-select:focus{border-color:color-mix(in srgb, var(--b3-theme-primary) 72%, var(--b3-theme-surface-light));box-shadow:0 0 0 3px color-mix(in srgb, var(--b3-theme-primary) 18%, transparent);background-color:color-mix(in srgb, var(--b3-theme-surface) 96%, var(--b3-theme-background));}
.tm-ai-sidebar__grid--planner{grid-template-columns:repeat(2,minmax(0,1fr));}
.tm-ai-sidebar__context,.tm-ai-sidebar__result{border:1px solid var(--b3-theme-surface-light);border-radius:12px;padding:10px;background:var(--b3-theme-surface);}
.tm-ai-sidebar__section-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;}
.tm-ai-sidebar__section-tools{display:flex;align-items:center;gap:6px;flex-shrink:0;}
.tm-ai-sidebar__section-title,.tm-ai-sidebar__result-title{font-size:13px;font-weight:700;margin-bottom:8px;}
.tm-ai-sidebar__section-head .tm-ai-sidebar__section-title{margin-bottom:0;}
.tm-ai-sidebar__section-toggle{width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;padding:0;border:none;background:transparent;color:var(--b3-theme-on-background);opacity:.72;cursor:pointer;flex-shrink:0;line-height:1;}
.tm-ai-sidebar__section-toggle:hover{opacity:1;}
.tm-ai-sidebar__section-toggle-icon{transition:transform .16s ease;}
.tm-ai-sidebar__mini-action{height:26px;min-height:26px;padding:0 8px;border-radius:8px;font-size:12px;line-height:1;}
.tm-ai-sidebar__mini-action[disabled]{opacity:.45;cursor:not-allowed;pointer-events:none;}
.tm-ai-sidebar__meta{font-size:12px;opacity:.76;line-height:1.6;}
 .tm-ai-sidebar__dropzone{margin-top:8px;border:1px dashed var(--b3-theme-surface-light);border-radius:8px;padding:8px 10px;font-size:12px;opacity:.75;background:rgba(127,127,127,.05);}
 .tm-ai-sidebar__chips{display:flex;flex-wrap:wrap;gap:6px;}
 .tm-ai-sidebar__chip{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:999px;background:rgba(127,127,127,.1);font-size:12px;}
 .tm-ai-sidebar__chip button{border:none;background:transparent;color:inherit;cursor:pointer;padding:0;}
 .tm-ai-sidebar__messages{display:flex;flex:1 1 auto;flex-direction:column;gap:8px;min-height:120px;max-height:none;overflow:auto;}
 .tm-ai-sidebar__message{border:1px solid var(--b3-theme-surface-light);border-radius:10px;padding:8px 10px;background:var(--b3-theme-surface);}
 .tm-ai-sidebar__message--user{border-color:color-mix(in srgb, var(--b3-theme-primary) 25%, var(--b3-theme-surface-light));}
 .tm-ai-sidebar__message--context{opacity:.88;background:rgba(127,127,127,.05);}
 .tm-ai-sidebar__message-role{font-size:12px;font-weight:700;margin-bottom:4px;opacity:.72;}
 .tm-ai-sidebar__message-body{white-space:pre-wrap;word-break:break-word;font-size:var(--tm-ai-conversation-font-size,0.875rem);line-height:1.6;}
 .tm-ai-sidebar__title-input{width:100%;max-width:100%;box-sizing:border-box;min-height:36px;padding:8px 12px;border:1px solid color-mix(in srgb, var(--b3-theme-surface-light) 82%, var(--b3-theme-on-background) 18%);border-radius:10px;background:color-mix(in srgb, var(--b3-theme-surface) 94%, var(--b3-theme-background));color:var(--b3-theme-on-background);box-shadow:inset 0 1px 0 rgba(255,255,255,.03);transition:border-color .16s ease, box-shadow .16s ease, background .16s ease;outline:none;appearance:none;-webkit-appearance:none;font-size:13px;}
 .tm-ai-sidebar__title-input:focus{border-color:color-mix(in srgb, var(--b3-theme-primary) 72%, var(--b3-theme-surface-light));box-shadow:0 0 0 3px color-mix(in srgb, var(--b3-theme-primary) 18%, transparent);background:color-mix(in srgb, var(--b3-theme-surface) 98%, var(--b3-theme-background));}
.tm-ai-sidebar__composer{display:flex;flex-direction:column;gap:8px;padding:10px 0 2px;border-top:1px solid var(--b3-theme-surface-light);margin-top:auto;background:var(--b3-theme-background);position:sticky;bottom:0;z-index:1;}
.tm-ai-sidebar__composer-shell{display:flex;flex-direction:column;gap:10px;padding:12px;border:1px solid color-mix(in srgb, var(--b3-theme-surface-light) 74%, var(--b3-theme-on-background) 12%);border-radius:16px;background:color-mix(in srgb, var(--b3-theme-surface) 86%, var(--b3-theme-background));box-shadow:0 10px 28px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.03);}
.tm-ai-sidebar__composer--schedule .tm-ai-sidebar__composer-shell{gap:12px;}
.tm-ai-sidebar__composer-toggle{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid color-mix(in srgb, var(--b3-theme-surface-light) 74%, var(--b3-theme-on-background) 10%);border-radius:14px;background:color-mix(in srgb, var(--b3-theme-surface) 90%, var(--b3-theme-background));cursor:pointer;color:inherit;text-align:left;}
.tm-ai-sidebar__composer-toggle:hover{border-color:color-mix(in srgb, var(--b3-theme-primary) 34%, var(--b3-theme-surface-light));}
.tm-ai-sidebar__composer-toggle-main{display:flex;flex-direction:column;gap:4px;min-width:0;}
.tm-ai-sidebar__composer-toggle-title{font-size:12px;font-weight:700;line-height:1.2;opacity:.82;}
.tm-ai-sidebar__composer-toggle-summary{font-size:12px;line-height:1.4;opacity:.72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.tm-ai-sidebar__composer-toggle-icon{flex-shrink:0;opacity:.72;transition:transform .16s ease;}
.tm-ai-sidebar__composer .tm-input,
.tm-ai-sidebar__composer .tm-rule-select{width:100%;height:40px;min-height:40px;box-sizing:border-box;border-radius:10px;border:1px solid color-mix(in srgb, var(--b3-theme-surface-light) 78%, var(--b3-theme-on-background) 16%);background-color:color-mix(in srgb, var(--b3-theme-surface) 90%, var(--b3-theme-background));color:var(--b3-theme-on-background);font-size:13px;line-height:1.2;box-shadow:inset 0 1px 0 rgba(255,255,255,.03);transition:border-color .16s ease, box-shadow .16s ease, background-color .16s ease;outline:none;appearance:none;-webkit-appearance:none;}
 .tm-ai-sidebar__composer .tm-rule-select{padding:0 36px 0 14px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2.25 4.25 6 8l3.75-3.75' fill='none' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;background-size:12px 12px;}
 .tm-ai-sidebar__composer .tm-input{padding:0 14px;}
.tm-ai-sidebar__composer .tm-input:focus,
.tm-ai-sidebar__composer .tm-rule-select:focus{border-color:color-mix(in srgb, var(--b3-theme-primary) 72%, var(--b3-theme-surface-light));box-shadow:0 0 0 3px color-mix(in srgb, var(--b3-theme-primary) 18%, transparent);background-color:color-mix(in srgb, var(--b3-theme-surface) 96%, var(--b3-theme-background));}
.tm-ai-sidebar__composer .tm-ai-textarea{min-height:72px;padding:12px 14px;border:1px solid color-mix(in srgb, var(--b3-theme-surface-light) 78%, var(--b3-theme-on-background) 16%);border-radius:12px;background:color-mix(in srgb, var(--b3-theme-surface) 90%, var(--b3-theme-background));box-shadow:inset 0 1px 0 rgba(255,255,255,.03);font-size:13px;line-height:1.55;transition:border-color .16s ease, box-shadow .16s ease, background-color .16s ease;}
.tm-ai-sidebar__composer .tm-ai-textarea:focus{border-color:color-mix(in srgb, var(--b3-theme-primary) 72%, var(--b3-theme-surface-light));box-shadow:0 0 0 3px color-mix(in srgb, var(--b3-theme-primary) 18%, transparent);background-color:color-mix(in srgb, var(--b3-theme-surface) 96%, var(--b3-theme-background));outline:none;}
.tm-ai-sidebar__composer-note{font-size:12px;line-height:1.5;opacity:.72;padding:0 2px;}
.tm-ai-sidebar__composer-foot{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;}
.tm-ai-sidebar__composer-foot .tm-ai-sidebar__composer-note{flex:1 1 auto;}
.tm-ai-sidebar__composer-foot .tm-btn{flex-shrink:0;}
.tm-ai-sidebar__promptbar{display:flex;flex-direction:column;gap:8px;margin-bottom:8px;padding:10px 12px;border:1px solid color-mix(in srgb, var(--b3-theme-surface-light) 74%, var(--b3-theme-on-background) 12%);border-radius:12px;background:color-mix(in srgb, var(--b3-theme-surface) 82%, var(--b3-theme-background));}
.tm-ai-sidebar__promptbar-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.tm-ai-sidebar__promptbar-select{flex:1 1 220px;min-width:180px;}
.tm-ai-sidebar__promptbar .tm-btn{height:30px;min-height:30px;padding:0 10px;border-radius:8px;font-size:12px;line-height:1;white-space:nowrap;}
.tm-ai-sidebar__promptbar-meta{font-size:12px;line-height:1.5;opacity:.72;}
.tm-ai-sidebar__composer .tm-btn.tm-btn-primary{height:42px;min-height:42px;padding:0 18px;border-radius:10px;font-size:13px;font-weight:700;line-height:1;}
.tm-ai-sidebar__composer-row{display:flex;align-items:stretch;gap:8px;}
 .tm-ai-sidebar__composer-row .tm-ai-textarea{flex:1 1 auto;margin:0;min-height:64px;height:64px;}
 .tm-ai-sidebar__send{align-self:stretch;min-height:64px;height:auto;white-space:nowrap;}
.tm-ai-sidebar__compact-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
.tm-ai-sidebar__compact-field{display:flex;flex-direction:column;gap:6px;min-width:0;}
.tm-ai-sidebar__compact-field span{font-size:12px;font-weight:600;line-height:1.2;opacity:.78;padding-left:2px;}
.tm-ai-sidebar__compact-field .tm-input{height:38px;min-height:38px;border-radius:12px;background:color-mix(in srgb, var(--b3-theme-surface) 92%, var(--b3-theme-background));}
 .tm-ai-sidebar__actions--left{justify-content:flex-start;}
 .tm-ai-sidebar__result-score{font-size:24px;font-weight:800;}
 .tm-ai-sidebar__result-body{white-space:pre-wrap;word-break:break-word;line-height:1.6;font-size:13px;}
 .tm-ai-sidebar__result-block{margin-top:10px;padding-top:10px;border-top:1px dashed color-mix(in srgb, var(--b3-theme-surface-light) 80%, transparent);}
 .tm-ai-sidebar__result-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}
 .tm-ai-sidebar__result-tags span{padding:4px 8px;border-radius:999px;background:rgba(127,127,127,.1);font-size:12px;}
 .tm-ai-sidebar__plan-list{display:flex;flex-direction:column;gap:6px;margin-top:8px;}
 .tm-ai-sidebar__plan-item{display:flex;align-items:flex-start;gap:8px;font-size:12px;line-height:1.55;}
 .tm-ai-sidebar__plan-index{width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;border-radius:999px;background:color-mix(in srgb, var(--b3-theme-primary) 14%, var(--b3-theme-surface));font-size:11px;font-weight:700;}
 .tm-ai-sidebar__trace-round{margin-top:8px;padding:8px 10px;border:1px solid color-mix(in srgb, var(--b3-theme-surface-light) 84%, transparent);border-radius:10px;background:color-mix(in srgb, var(--b3-theme-background) 90%, var(--b3-theme-surface));}
 .tm-ai-sidebar__trace-round-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;font-weight:700;}
 .tm-ai-sidebar__trace-round-meta{font-size:11px;opacity:.72;}
 .tm-ai-sidebar__trace-call{margin-top:8px;padding:8px 10px;border-radius:10px;background:var(--b3-theme-surface);border:1px solid var(--b3-theme-surface-light);}
 .tm-ai-sidebar__trace-call-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;font-size:12px;font-weight:700;}
 .tm-ai-sidebar__trace-chip{display:inline-flex;align-items:center;justify-content:center;min-height:20px;padding:0 8px;border-radius:999px;background:rgba(127,127,127,.1);font-size:11px;font-weight:700;white-space:nowrap;}
 .tm-ai-sidebar__trace-chip.is-success{background:color-mix(in srgb, #3cb371 18%, var(--b3-theme-surface));color:color-mix(in srgb, #177245 92%, var(--b3-theme-on-background));}
 .tm-ai-sidebar__trace-chip.is-fail{background:color-mix(in srgb, #e05a47 16%, var(--b3-theme-surface));color:color-mix(in srgb, #b53d2b 92%, var(--b3-theme-on-background));}
 .tm-ai-sidebar__trace-call-body{margin-top:6px;font-size:12px;line-height:1.55;opacity:.82;white-space:pre-wrap;word-break:break-word;}
 .tm-ai-sidebar__smart-list{display:flex;flex-direction:column;gap:8px;margin-top:8px;}
 .tm-ai-sidebar__smart-item{border:1px solid var(--b3-theme-surface-light);border-radius:10px;padding:8px 10px;background:var(--b3-theme-background);}
 .tm-ai-sidebar__smart-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;font-size:13px;font-weight:700;}
 .tm-ai-sidebar__smart-head > div,.tm-ai-sidebar__smart-head > span{min-width:0;word-break:break-word;}
 .tm-ai-sidebar__task-picker{display:flex;flex-direction:column;gap:6px;max-height:180px;overflow:auto;}
 .tm-ai-sidebar__task-row{display:flex;gap:8px;align-items:flex-start;font-size:13px;min-width:0;}
 .tm-ai-sidebar__task-row span{flex:1;min-width:0;word-break:break-word;}
 .tm-ai-sidebar__empty{padding:14px 10px;border:1px dashed var(--b3-theme-surface-light);border-radius:10px;font-size:12px;opacity:.72;}
.tm-ai-sidebar--mobile .tm-ai-sidebar__head{padding-top:8px;}
.tm-ai-sidebar--mobile .tm-ai-sidebar__grid,
.tm-ai-sidebar--mobile .tm-ai-sidebar__grid--planner{grid-template-columns:repeat(2,minmax(0,1fr));}
@media (max-width: 360px){
    .tm-ai-sidebar__head{flex-wrap:wrap;align-items:flex-start;}
    .tm-ai-sidebar__head-title{order:3;flex:1 1 100%;max-width:none;}
    .tm-ai-sidebar__head-actions{width:100%;justify-content:flex-end;}
    .tm-ai-sidebar--mobile .tm-ai-sidebar__grid,
    .tm-ai-sidebar--mobile .tm-ai-sidebar__grid--planner,
    .tm-ai-sidebar__compact-grid{grid-template-columns:minmax(0,1fr);}
    .tm-ai-sidebar__composer-foot{flex-direction:column;align-items:stretch;}
    .tm-ai-sidebar__composer-foot .tm-btn{width:100%;}
}
        `;
        document.head.appendChild(style);
        return style;
    }

    function ensureModal() {
        if (modalEl && document.body.contains(modalEl)) return modalEl;
        modalEl = document.createElement('div');
        modalEl.className = 'tm-ai-modal';
        modalEl.innerHTML = `
            <div class="tm-ai-modal__mask" data-ai-action="close"></div>
            <div class="tm-ai-modal__dialog">
                <div class="tm-ai-modal__header">
                    <div class="tm-ai-modal__title">AI</div>
                    <button class="tm-btn tm-btn-gray" data-ai-action="close">${__tmT("common.close")}</button>
                </div>
                <div class="tm-ai-modal__body"></div>
            </div>
        `;
        ensureAiStyle();
        modalEl.addEventListener('click', (event) => {
            if (String(event.target?.dataset?.aiAction || '') === 'close') closeModal();
        });
        document.body.appendChild(modalEl);
        return modalEl;
    }

    function setModal(title, html) {
        const modal = ensureModal();
        const titleEl = modal.querySelector('.tm-ai-modal__title');
        const bodyEl = modal.querySelector('.tm-ai-modal__body');
        if (titleEl) titleEl.textContent = title;
        if (bodyEl) bodyEl.innerHTML = html;
        return modal;
    }

    function renderProgressSteps(steps, currentStep) {
        const list = Array.isArray(steps) ? steps : [];
        if (!list.length) return '';
        return `
            <div class="tm-ai-box">
                <h4>${__tmT("ai.progress")}</h4>
                <div class="tm-ai-list">
                    ${list.map((step, idx) => {
                        const active = idx === currentStep;
                        const done = idx < currentStep;
                        const mark = done ? __tmT("ai.completed") : (active ? __tmT("ai.inProgress") : __tmT("ai.waiting"));
                        const opacity = done ? '1' : (active ? '1' : '.62');
                        return `<div class="tm-ai-item" style="opacity:${opacity};"><div style="font-weight:600;">${done ? '<span class="tm-selection-check" aria-hidden="true"></span>' : (active ? '…' : '○')} ${esc(step)}</div><div class="tm-ai-hint" style="margin-top:4px;">${mark}</div></div>`;
                    }).join('')}
                </div>
            </div>
        `;
    }

    function setProgressModal(title, steps, currentStep, hintText) {
        return setModal(title, `
            ${renderProgressSteps(steps, currentStep)}
            <div class="tm-ai-box">
                <h4>${__tmT("ai.processing2")}</h4>
                <div class="tm-ai-hint">${esc(hintText || __tmT("ai.processing"))}</div>
            </div>
        `);
    }

    function closeModal() {
        try { modalEl?.remove?.(); } catch (e) {}
        modalEl = null;
    }

    async function promptInput(title, placeholder, hint, opt = {}) {
        const cfg = getConfig();
        const historyHtml = renderHistory(opt.history);
        return await new Promise((resolve) => {
            const modal = setModal(title, `
                ${historyHtml}
                <div>
                    <div class="tm-ai-label">${__tmT("ai.additionalNotes")}</div>
                    <textarea class="tm-ai-textarea" data-ai-input="instruction" placeholder="${esc(placeholder || '')}">${esc(String(opt.defaultInstruction || ''))}</textarea>
                    <div class="tm-ai-hint">${esc(hint || '')}</div>
                </div>
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;">
                    <input class="b3-switch fn__flex-center" type="checkbox" data-ai-input="fulltext" ${cfg.contextMode === 'fulltext' ? 'checked' : ''}>${__tmT("ai.includeFullText")}</label>
                <div class="tm-ai-actions">
                    <button class="tm-btn tm-btn-secondary" data-ai-action="cancel">${__tmT("common.cancel")}</button>
                    <button class="tm-btn tm-btn-success" data-ai-action="run">${__tmT("ai.continue")}</button>
                </div>
            `);
            const body = modal.querySelector('.tm-ai-modal__body');
            body.addEventListener('click', function onClick(event) {
                const action = String(event.target?.dataset?.aiAction || '');
                if (!action) return;
                if (action === 'run') {
                    body.removeEventListener('click', onClick);
                    resolve({
                        instruction: String(body.querySelector('[data-ai-input="instruction"]')?.value || '').trim(),
                        mode: body.querySelector('[data-ai-input="fulltext"]')?.checked ? 'fulltext' : 'nearby',
                    });
                } else if (action === 'cancel') {
                    body.removeEventListener('click', onClick);
                    resolve(null);
                }
            });
        });
    }

    function taskLite(task) {
        const statusOptions = getConfig().statusOptions;
        const statusId = String(task?.customStatus || '').trim();
        const statusOption = resolveConfiguredStatusOption(statusId, statusOptions);
        return {
            id: String(task?.id || '').trim(),
            content: String(task?.content || '').trim(),
            docId: String(task?.docId || task?.root_id || '').trim(),
            docName: String(task?.docName || task?.doc_name || '').trim(),
            parentTaskId: String(task?.parentTaskId || task?.parent_task_id || '').trim(),
            done: !!task?.done,
            priority: String(task?.priority || '').trim(),
            customStatus: statusId,
            customStatusName: String(statusOption?.name || statusId).trim(),
            startDate: String(task?.startDate || '').trim(),
            completionTime: String(task?.completionTime || '').trim(),
            updated: String(task?.updated || task?.updatedAt || task?.updateTime || task?.update_time || '').trim(),
            duration: String(task?.duration || '').trim(),
            remark: String(task?.remark || '').trim(),
            pinned: !!task?.pinned,
            milestone: !!task?.milestone,
            heading: String(task?.h2 || '').trim(),
        };
    }

    const getTaskId = (task) => String(task?.id || '').trim();
    const getTaskParentId = (task) => String(task?.parentTaskId || task?.parentId || task?.parent_task_id || '').trim();



    function normalizeTaskFieldPatch(rawPatch) {
        const src = (rawPatch && typeof rawPatch === 'object') ? rawPatch : {};
        const patch = {};
        const has = (k) => Object.prototype.hasOwnProperty.call(src, k);
        const pick = (...keys) => {
            for (const key of keys) {
                if (has(key)) return { hit: true, value: src[key] };
            }
            return { hit: false, value: undefined };
        };
        const cleanDate = (v) => normalizeDateKey(v);
        const cleanPriority = (v) => {
            const t = String(v || '').trim().toLowerCase();
            if (!t) return '';
            if (['high', 'h', 'a', "高", "高重要性", "高优先级", "紧急"].includes(t)) return 'high';
            if (['medium', 'm', 'b', "中", "中重要性", "中优先级", "普通"].includes(t)) return 'medium';
            if (['low', 'l', 'c', "低", "低重要性", "低优先级"].includes(t)) return 'low';
            if (['none', "无", "未设置"].includes(t)) return 'none';
            return String(v || '').trim();
        };
        const title = pick('title', 'content', 'name');
        const done = pick('done', 'completed', 'isDone');
        const priority = pick('priority', 'importance');
        const customStatus = pick('customStatus', 'status');
        const startDate = pick('startDate', 'start', 'startTime');
        const completionTime = pick('completionTime', 'dueDate', 'due', 'deadline', 'endDate');
        const duration = pick('duration', 'estimate');
        const remark = pick('remark', 'note', 'notes', 'comment');
        const pinned = pick('pinned', 'pin');
        const milestone = pick('milestone', 'isMilestone');
        if (title.hit) patch.title = String(title.value || '').trim();
        if (done.hit) patch.done = !!done.value;
        if (priority.hit) patch.priority = cleanPriority(priority.value);
        if (customStatus.hit) patch.customStatus = resolveConfiguredStatusId(customStatus.value, getConfig().statusOptions);
        if (startDate.hit) patch.startDate = cleanDate(startDate.value);
        if (completionTime.hit) patch.completionTime = cleanDate(completionTime.value);
        if (duration.hit) patch.duration = String(duration.value || '').trim();
        if (remark.hit) patch.remark = String(remark.value || '').trim();
        if (pinned.hit) patch.pinned = !!pinned.value;
        if (milestone.hit) patch.milestone = !!milestone.value;
        return patch;
    }

    function verifyTaskPatchApplied(task, patch) {
        if (!task || !patch || typeof patch !== 'object') return false;
        const keys = Object.keys(patch);
        if (!keys.length) return false;
        return keys.every((key) => {
            if (key === 'done' || key === 'pinned' || key === 'milestone') return !!task[key] === !!patch[key];
            if (key === 'startDate' || key === 'completionTime') return normalizeDateKey(task[key]) === normalizeDateKey(patch[key]);
            return String(task[key] ?? '').trim() === String(patch[key] ?? '').trim();
        });
    }

    function normalizeChatTaskOperation(item = {}) {
        const taskId = String(item?.taskId || item?.id || '').trim();
        const patch = normalizeTaskFieldPatch(clone(item?.patch || item?.fields || {}));
        return {
            taskId,
            patch,
            reason: String(item?.reason || item?.summary || '').trim(),
        };
    }

    function normalizeChatCreateOperation(item = {}) {
        const patch = normalizeTaskFieldPatch(clone(item?.patch || item?.fields || {}));
        return {
            content: String(item?.content || item?.title || item?.text || '').trim(),
            docId: String(item?.docId || item?.documentId || item?.rootId || '').trim(),
            parentTaskId: String(item?.parentTaskId || item?.parentId || item?.parent_task_id || '').trim(),
            patch,
            reason: String(item?.reason || item?.summary || '').trim(),
        };
    }

    function describeTaskFieldPatch(patch = {}) {
        const parts = [];
        if (Object.prototype.hasOwnProperty.call(patch, 'title')) parts.push(__tmT("ai.titleChangedTo", { value1: String(patch.title || '').trim() || __tmT("ai.empty") }));
        if (Object.prototype.hasOwnProperty.call(patch, 'done')) parts.push(__tmT("ai.completionSetTo", { value1: patch.done ? __tmT("ai.completed") : __tmT("ai.notDone") }));
        if (Object.prototype.hasOwnProperty.call(patch, 'priority')) {
            const p = String(patch.priority || '').trim();
            const label = p === 'high' ? __tmT("common.high") : (p === 'medium' ? __tmT("common.medium") : (p === 'low' ? __tmT("common.low") : (p === 'none' ? __tmT("common.none") : p || __tmT("ai.empty"))));
            parts.push(__tmT("ai.setImportanceTo", { label: label }));
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'customStatus')) {
            const matched = resolveConfiguredStatusOption(patch.customStatus, getConfig().statusOptions);
            parts.push(__tmT("ai.statusSetTo", { value1: String(matched?.name || patch.customStatus || '').trim() || __tmT("ai.empty") }));
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'startDate')) parts.push(__tmT("ai.startDateSetTo", { value1: String(patch.startDate || '').trim() || __tmT("ai.empty") }));
        if (Object.prototype.hasOwnProperty.call(patch, 'completionTime')) parts.push(__tmT("ai.completionDateSetTo", { value1: String(patch.completionTime || '').trim() || __tmT("ai.empty") }));
        if (Object.prototype.hasOwnProperty.call(patch, 'duration')) parts.push(__tmT("ai.durationSetTo", { value1: String(patch.duration || '').trim() || __tmT("ai.empty") }));
        if (Object.prototype.hasOwnProperty.call(patch, 'remark')) parts.push(__tmT("ai.noteSetTo", { value1: String(patch.remark || '').trim() || __tmT("ai.empty") }));
        if (Object.prototype.hasOwnProperty.call(patch, 'pinned')) parts.push(`${patch.pinned ? __tmT("ai.pinTask") : __tmT("ai.unpin")}`);
        if (Object.prototype.hasOwnProperty.call(patch, 'milestone')) parts.push(`${patch.milestone ? __tmT("ai.setAsMilestone") : __tmT("ai.cancelmilestone")}`);
        return parts.join('，');
    }

    function describeChatCreateAction(item = {}) {
        const target = String(item?.targetLabel || '').trim();
        if (item?.isSubtask) return target ? __tmT("ai.createASubtaskUnder", { target: target }) : __tmT("ai.newSubtask");
        return target ? __tmT("ai.createATaskIn", { target: target }) : __tmT("common.newTask");
    }

    function buildChatSystemPrompt() {
        const cfg = getConfig();
        const statusGuide = formatConfiguredStatusPrompt(cfg.statusOptions);
        return __tmT("ai.youAreATaskAndProjectManagementAssistantOutput", { statusGuide: statusGuide });
    }

    async function applyChatTaskOperations(operations, taskPool = []) {
        const bridgeApi = bridge();
        const work = Array.isArray(operations) ? operations.map(normalizeChatTaskOperation).filter((it) => it.taskId && Object.keys(it.patch || {}).length) : [];
        const allowedIds = new Set((Array.isArray(taskPool) ? taskPool : []).map((task) => String(task?.id || '').trim()).filter(Boolean));
        const results = [];
        for (const item of work) {
            const taskId = String(item.taskId || '').trim();
            const patch = item.patch || {};
            const patchDesc = describeTaskFieldPatch(patch);
            if (!taskId) continue;
            if (allowedIds.size && !allowedIds.has(taskId)) {
                results.push({
                    taskId,
                    ok: false,
                    title: taskId,
                    patch,
                    patchDesc,
                    reason: item.reason,
                    error: __tmT("ai.theTaskIsNotInTheCurrentAiConversation"),
                });
                continue;
            }
            let before = null;
            try { before = await bridgeApi?.getTaskSnapshot?.(taskId, { forceFresh: true }); } catch (e) { before = null; }
            if (!before) {
                results.push({
                    taskId,
                    ok: false,
                    title: taskId,
                    patch,
                    patchDesc,
                    reason: item.reason,
                    error: __tmT("kernel.noTaskFound"),
                });
                continue;
            }
            try {
                const nextTask = await bridgeApi?.applyTaskPatch?.(taskId, patch);
                const ok = verifyTaskPatchApplied(nextTask, patch);
                results.push({
                    taskId,
                    ok,
                    title: String(nextTask?.content || before?.content || taskId).trim() || taskId,
                    beforeTitle: String(before?.content || taskId).trim() || taskId,
                    patch,
                    patchDesc,
                    reason: item.reason,
                    error: ok ? '' : __tmT("ai.theFieldPatchDidNotFullyApply"),
                });
            } catch (e) {
                results.push({
                    taskId,
                    ok: false,
                    title: String(before?.content || taskId).trim() || taskId,
                    beforeTitle: String(before?.content || taskId).trim() || taskId,
                    patch,
                    patchDesc,
                    reason: item.reason,
                    error: String(e?.message || e || __tmT("ai.modificationFailed")),
                });
            }
        }
        return results;
    }

    async function applyChatCreateOperations(operations, options = {}) {
        const bridgeApi = bridge();
        const taskPool = Array.isArray(options?.taskPool) ? options.taskPool : [];
        const doc = (options?.doc && typeof options.doc === 'object') ? options.doc : null;
        const work = Array.isArray(operations) ? operations.map(normalizeChatCreateOperation).filter((it) => it.content) : [];
        const allowedTaskIds = new Set(taskPool.map((task) => String(task?.id || '').trim()).filter(Boolean));
        const allowedDocIds = new Set();
        const docNameMap = new Map();
        taskPool.forEach((task) => {
            const did = String(task?.docId || task?.root_id || '').trim();
            if (!did) return;
            allowedDocIds.add(did);
            if (!docNameMap.has(did)) {
                docNameMap.set(did, String(task?.docName || task?.doc_name || did).trim() || did);
            }
        });
        const primaryDocId = String(doc?.id || '').trim();
        if (primaryDocId) {
            allowedDocIds.add(primaryDocId);
            docNameMap.set(primaryDocId, String(doc?.name || primaryDocId).trim() || primaryDocId);
        }
        const defaultDocId = primaryDocId || (allowedDocIds.size === 1 ? Array.from(allowedDocIds)[0] : '');
        const results = [];
        for (const item of work) {
            const patch = item.patch || {};
            const patchDesc = describeTaskFieldPatch(patch);
            let parentTaskId = String(item.parentTaskId || '').trim();
            let docId = String(item.docId || '').trim();
            let targetLabel = '';
            if (typeof bridgeApi?.createTask !== 'function') {
                results.push({
                    ok: false,
                    title: item.content,
                    isSubtask: !!parentTaskId,
                    targetLabel,
                    patch,
                    patchDesc,
                    reason: item.reason,
                    error: __tmT("ai.taskCreationIsNotAvailableInThisVersion"),
                });
                continue;
            }
            if (parentTaskId) {
                try {
                    parentTaskId = String(await bridgeApi?.resolveTaskId?.(parentTaskId) || parentTaskId).trim();
                } catch (e) {}
                if (allowedTaskIds.size && !allowedTaskIds.has(parentTaskId)) {
                    results.push({
                        ok: false,
                        title: item.content,
                        parentTaskId,
                        isSubtask: true,
                        targetLabel: parentTaskId,
                        patch,
                        patchDesc,
                        reason: item.reason,
                        error: __tmT("ai.theParentTaskIsNotInTheCurrentAi"),
                    });
                    continue;
                }
                let parentTask = taskPool.find((task) => String(task?.id || '').trim() === parentTaskId) || null;
                if (!parentTask) {
                    try { parentTask = await bridgeApi?.getTaskSnapshot?.(parentTaskId, { forceFresh: true }); } catch (e) { parentTask = null; }
                }
                if (!parentTask) {
                    results.push({
                        ok: false,
                        title: item.content,
                        parentTaskId,
                        isSubtask: true,
                        targetLabel: parentTaskId,
                        patch,
                        patchDesc,
                        reason: item.reason,
                        error: __tmT("ai.parentTaskNotFound"),
                    });
                    continue;
                }
                docId = String(parentTask?.docId || parentTask?.root_id || docId).trim();
                targetLabel = String(parentTask?.content || parentTaskId).trim() || parentTaskId;
            } else {
                docId = String(docId || defaultDocId).trim();
                targetLabel = docNameMap.get(docId) || String(doc?.name || docId).trim() || docId;
                if (!docId) {
                    results.push({
                        ok: false,
                        title: item.content,
                        isSubtask: false,
                        targetLabel,
                        patch,
                        patchDesc,
                        reason: item.reason,
                        error: __tmT("ai.noDocumentAvailableForTaskCreation"),
                    });
                    continue;
                }
                if (allowedDocIds.size && !allowedDocIds.has(docId)) {
                    results.push({
                        ok: false,
                        title: item.content,
                        docId,
                        isSubtask: false,
                        targetLabel,
                        patch,
                        patchDesc,
                        reason: item.reason,
                        error: __tmT("ai.theTargetDocumentIsNotInTheCurrentAi"),
                    });
                    continue;
                }
            }
            try {
                const nextTask = await bridgeApi.createTask({
                    docId,
                    parentTaskId,
                    content: item.content,
                    patch,
                });
                results.push({
                    ok: true,
                    taskId: String(nextTask?.id || '').trim(),
                    title: String(nextTask?.content || item.content).trim() || item.content,
                    docId: String(nextTask?.docId || nextTask?.root_id || docId).trim() || docId,
                    parentTaskId: String(nextTask?.parentTaskId || nextTask?.parent_task_id || parentTaskId).trim() || parentTaskId,
                    isSubtask: !!parentTaskId,
                    targetLabel,
                    patch,
                    patchDesc,
                    reason: item.reason,
                    error: '',
                });
            } catch (e) {
                results.push({
                    ok: false,
                    title: item.content,
                    docId,
                    parentTaskId,
                    isSubtask: !!parentTaskId,
                    targetLabel: targetLabel || (parentTaskId || docId),
                    patch,
                    patchDesc,
                    reason: item.reason,
                    error: String(e?.message || e || __tmT("ai.creationFailed")),
                });
            }
        }
        return results;
    }

    function buildChatExecutionSummary(taskResults, createResults, fallbackAnswer) {
        const taskList = Array.isArray(taskResults) ? taskResults : [];
        const createList = Array.isArray(createResults) ? createResults : [];
        const rawAnswer = String(fallbackAnswer || '').trim();
        if (!taskList.length && !createList.length) {
            if (/(已将任务|已把任务|已设置|已修改|已更新|已完成|已创建|已新建|已新增|已添加)/.test(rawAnswer)) {
                return __tmT("ai.noTasksWereCreatedOrUpdatedThisResponseContains", { rawAnswer: rawAnswer });
            }
            return rawAnswer;
        }
        const successTask = taskList.filter((it) => it?.ok);
        const failedTask = taskList.filter((it) => !it?.ok);
        const successCreate = createList.filter((it) => it?.ok);
        const failedCreate = createList.filter((it) => !it?.ok);
        const lines = [];
        if (successCreate.length) {
            lines.push(...successCreate.map((it) => `${describeChatCreateAction(it)}“${it.title || it.taskId || __tmT("kernel.task")}”${it.patchDesc ? __tmT("ai.with", { patchDesc: it.patchDesc }) : ''}`));
        }
        if (successTask.length) {
            lines.push(...successTask.map((it) => __tmT("ai.task", { taskId: it.title || it.taskId, value2: it.patchDesc ? __tmT("ai.s", { patchDesc: it.patchDesc }) : __tmT("ai.finishEditing") })));
        }
        if (failedCreate.length) {
            lines.push(...failedCreate.map((it) => __tmT("ai.failed", { value1: describeChatCreateAction(it), value2: it.title || __tmT("kernel.task"), value3: it.error || __tmT("plugin.unknownError") })));
        }
        if (failedTask.length) {
            lines.push(...failedTask.map((it) => __tmT("ai.failedToModifyTask", { taskId: it.title || it.taskId, value2: it.error || __tmT("plugin.unknownError") })));
        }
        if (!successTask.length && !failedTask.length && !successCreate.length && !failedCreate.length && rawAnswer) lines.push(rawAnswer);
        return lines.filter(Boolean).join('\n');
    }

    function truncateForAi(value, max = 180) {
        const text = String(value || '').trim();
        if (!text) return '';
        if (text.length <= max) return text;
        return `${text.slice(0, Math.max(0, max - 1)).trim()}…`;
    }

    function normalizeChatSkillCall(item = {}, index = 0) {
        const raw = (item && typeof item === 'object') ? item : {};
        return {
            id: String(raw.id || uid(`skill-${index + 1}`)).trim() || uid(`skill-${index + 1}`),
            skill: String(raw.skill || raw.tool || raw.name || '').trim(),
            input: (raw.input && typeof raw.input === 'object' && !Array.isArray(raw.input)) ? clone(raw.input) : {},
            reason: String(raw.reason || raw.summary || '').trim(),
        };
    }

    function normalizeChatSkillPlannerResult(raw = {}) {
        const src = (raw && typeof raw === 'object') ? raw : {};
        const legacyCalls = [];
        (Array.isArray(src?.taskOperations) ? src.taskOperations : []).forEach((item, index) => {
            const op = normalizeChatTaskOperation(item);
            if (!op.taskId || !Object.keys(op.patch || {}).length) return;
            legacyCalls.push({
                id: uid(`legacy-update-${index + 1}`),
                skill: 'update_task',
                input: { taskId: op.taskId, patch: op.patch },
                reason: op.reason,
            });
        });
        (Array.isArray(src?.createOperations) ? src.createOperations : []).forEach((item, index) => {
            const op = normalizeChatCreateOperation(item);
            if (!op.content) return;
            legacyCalls.push({
                id: uid(`legacy-create-${index + 1}`),
                skill: 'create_task',
                input: {
                    content: op.content,
                    docId: op.docId,
                    parentTaskId: op.parentTaskId,
                    patch: op.patch,
                },
                reason: op.reason,
            });
        });
        const normalizedCalls = ((Array.isArray(src.skillCalls) ? src.skillCalls : []).length
            ? src.skillCalls
            : legacyCalls
        ).map(normalizeChatSkillCall).filter((item) => item.skill).slice(0, AI_CHAT_SKILL_MAX_CALLS_PER_ROUND);
        const plan = (Array.isArray(src.plan) ? src.plan : [])
            .map((item) => String(item || '').trim())
            .filter(Boolean)
            .slice(0, 6);
        const warnings = (Array.isArray(src.warnings) ? src.warnings : [])
            .map((item) => String(item || '').trim())
            .filter(Boolean)
            .slice(0, 6);
        return {
            plan,
            warnings,
            reason: String(src.reason || src.summary || '').trim(),
            done: src.done === true || normalizedCalls.length === 0,
            skillCalls: normalizedCalls,
        };
    }

    function normalizeChatSkillFinalResult(raw = {}) {
        const src = (raw && typeof raw === 'object') ? raw : {};
        return {
            answer: String(src.answer || '').trim(),
            highlights: (Array.isArray(src.highlights) ? src.highlights : []).map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8),
            nextActions: (Array.isArray(src.nextActions) ? src.nextActions : []).map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8),
            warnings: (Array.isArray(src.warnings) ? src.warnings : []).map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8),
        };
    }

    function buildChatSkillPlannerPrompt() {
        return __tmT("ai.youAreTheAiExecutionPlannerInsideTheTask", { AI_CHAT_SKILL_MAX_CALLS_PER_ROUND: AI_CHAT_SKILL_MAX_CALLS_PER_ROUND });
    }

    function buildChatSkillFinalPrompt() {
        return __tmT("ai.youAreTheTaskManagerAssistantOutputOnlyJson");
    }

    async function buildChatSkillTurnContext(session, instruction) {
        const taskIds = await inferTaskIdsFromConversation(session);
        const taskSnapshots = await getSelectedTaskSnapshots(taskIds.slice(0, 24));
        const doc = await getPrimaryDocumentSnapshot(session, { taskId: taskIds[0] });
        const excerpt = buildDocExcerpt(doc, taskIds[0], session.contextMode);
        const docTasks = Array.isArray(doc?.tasks) ? doc.tasks.filter((item) => item && typeof item === 'object').slice(0, 80) : [];
        let scopeTasks = mergeSummaryTasks(taskSnapshots, docTasks).filter((item) => item && typeof item === 'object');
        if (!scopeTasks.length && session.contextScope === 'current_view') {
            const list = await bridge()?.getCurrentFilteredTasks?.(Math.max(24, conversationTaskLimit(session))) || await bridge()?.getCurrentViewTasks?.(Math.max(24, conversationTaskLimit(session)));
            scopeTasks = mergeSummaryTasks(Array.isArray(list) ? list : [], taskSnapshots, docTasks).filter((item) => item && typeof item === 'object');
        }
        if (!scopeTasks.length && session.contextScope === 'current_group') {
            const list = await bridge()?.getCurrentGroupTasks?.(0);
            scopeTasks = mergeSummaryTasks(Array.isArray(list) ? list : [], taskSnapshots, docTasks).filter((item) => item && typeof item === 'object');
        }
        const allowedTaskIds = new Set(scopeTasks.map((item) => String(item?.id || '').trim()).filter(Boolean));
        const allowedDocIds = new Set((Array.isArray(session.selectedDocIds) ? session.selectedDocIds : []).map((item) => String(item || '').trim()).filter(Boolean));
        if (doc?.id) allowedDocIds.add(String(doc.id).trim());
        scopeTasks.forEach((item) => {
            const docId = String(item?.docId || item?.root_id || '').trim();
            if (docId) allowedDocIds.add(docId);
        });
        return {
            session,
            instruction: String(instruction || '').trim(),
            taskIds,
            taskSnapshots,
            doc,
            excerpt,
            scopeTasks,
            allowedTaskIds,
            allowedDocIds,
            history: conversationHistoryToPrompt(session.messages),
        };
    }

    function buildChatSkillRegistry(turnContext) {
        const ctx = turnContext && typeof turnContext === 'object' ? turnContext : {};
        const b = bridge();
        const scopeTasks = Array.isArray(ctx.scopeTasks) ? ctx.scopeTasks : [];
        const allowedTaskIds = ctx.allowedTaskIds instanceof Set ? ctx.allowedTaskIds : new Set();
        const allowedDocIds = ctx.allowedDocIds instanceof Set ? ctx.allowedDocIds : new Set();
        const primaryDocId = String(ctx?.doc?.id || '').trim();
        const assertScopedTask = async (taskId) => {
            const rawId = String(taskId || '').trim();
            if (!rawId) throw new Error(__tmT("ai.missingTaskid"));
            let resolvedId = rawId;
            try { resolvedId = String(await b?.resolveTaskId?.(rawId) || rawId).trim() || rawId; } catch (e) {}
            if (allowedTaskIds.size && !allowedTaskIds.has(resolvedId)) throw new Error(__tmT("ai.theTaskIsNotInTheCurrentAiConversation"));
            const task = await b?.getTaskSnapshot?.(resolvedId, { forceFresh: true });
            if (!task) throw new Error(__tmT("kernel.noTaskFound"));
            return task;
        };
        const assertScopedDocId = async (docId) => {
            const resolved = String(docId || primaryDocId || '').trim();
            if (!resolved) throw new Error(__tmT("ai.missingDocid"));
            if (allowedDocIds.size && !allowedDocIds.has(resolved)) throw new Error(__tmT("ai.theDocumentIsNotInTheCurrentAiConversation"));
            return resolved;
        };
        return {
            read_current_view_tasks: {
                name: 'read_current_view_tasks',
                description: __tmT("ai.readVisibleTasksInTheCurrentView"),
                inputHint: '{ limit?: 1-50 }',
                readOnly: true,
                confirmPolicy: 'never',
                async run(input = {}) {
                    const limit = Math.max(1, Math.min(50, Math.round(Number(input?.limit || 12) || 12)));
                    const list = await b?.getCurrentFilteredTasks?.(limit) || await b?.getCurrentViewTasks?.(limit) || [];
                    return { total: Array.isArray(list) ? list.length : 0, tasks: (Array.isArray(list) ? list : []).slice(0, limit).map(taskLite) };
                },
                summarize(result = {}) {
                    return __tmT("ai.readTasksFromTheCurrentView", { value1: Number(result?.total || 0) });
                },
            },
            read_current_group_tasks: {
                name: 'read_current_group_tasks',
                description: __tmT("ai.readTasksInTheCurrentGroup"),
                inputHint: '{ limit?: 1-80 }',
                readOnly: true,
                confirmPolicy: 'never',
                async run(input = {}) {
                    const limit = Math.max(1, Math.min(80, Math.round(Number(input?.limit || 20) || 20)));
                    const list = await b?.getCurrentGroupTasks?.(0) || [];
                    const tasks = (Array.isArray(list) ? list : []).slice(0, limit).map(taskLite);
                    return { total: Array.isArray(list) ? list.length : 0, tasks };
                },
                summarize(result = {}) {
                    return __tmT("ai.readTasksFromTheCurrentGroup", { value1: Number(result?.total || 0) });
                },
            },
            read_document_snapshot: {
                name: 'read_document_snapshot',
                description: __tmT("ai.readTheCurrentContextDocumentSummaryBodyExcerptAnd"),
                inputHint: '{ docId?: string, limit?: 1-40 }',
                readOnly: true,
                confirmPolicy: 'never',
                async run(input = {}) {
                    const docId = await assertScopedDocId(input?.docId);
                    const limit = Math.max(1, Math.min(40, Math.round(Number(input?.limit || 20) || 20)));
                    const doc = await b?.getDocumentSnapshot?.(docId, { limit: 1400 });
                    if (!doc) throw new Error(__tmT("ai.documentNotFound"));
                    const excerpt = buildDocExcerpt(doc, '', ctx?.session?.contextMode);
                    return {
                        document: {
                            id: String(doc?.id || '').trim(),
                            name: String(doc?.name || '').trim(),
                            path: String(doc?.path || '').trim(),
                            excerpt: {
                                intro: truncateForAi(excerpt?.intro || '', 400),
                                nearby: truncateForAi(excerpt?.nearby || '', 400),
                                fulltext: truncateForAi(excerpt?.fulltext || '', 400),
                            },
                            tasks: (Array.isArray(doc?.tasks) ? doc.tasks : []).slice(0, limit).map(taskLite),
                        },
                    };
                },
                summarize(result = {}) {
                    const doc = result?.document || {};
                    return __tmT("ai.readDocumentAndItsTaskSummary", { value1: doc.name || doc.id || __tmT("kernel.untitledDocument") });
                },
            },
            read_task_snapshot: {
                name: 'read_task_snapshot',
                description: __tmT("ai.readDetailsOfASingleTask"),
                inputHint: '{ taskId: string }',
                readOnly: true,
                confirmPolicy: 'never',
                async run(input = {}) {
                    const task = await assertScopedTask(input?.taskId);
                    return { task: taskLite(task) };
                },
                summarize(result = {}) {
                    return __tmT("ai.readDetailsOfTask", { value1: result?.task?.content || result?.task?.id || __tmT("kernel.task") });
                },
            },
            search_tasks: {
                name: 'search_tasks',
                description: __tmT("ai.searchTasksByKeywordInTheCurrentContextTask"),
                inputHint: '{ query: string, limit?: 1-20 }',
                readOnly: true,
                confirmPolicy: 'never',
                async run(input = {}) {
                    const query = String(input?.query || '').trim().toLowerCase();
                    if (!query) throw new Error(__tmT("ai.missingQuery"));
                    const limit = Math.max(1, Math.min(20, Math.round(Number(input?.limit || 8) || 8)));
                    const pool = mergeSummaryTasks(scopeTasks, ctx.taskSnapshots, Array.isArray(ctx?.doc?.tasks) ? ctx.doc.tasks : []);
                    const score = (task) => {
                        const bag = [
                            String(task?.content || ''),
                            String(task?.remark || ''),
                            String(task?.docName || task?.doc_name || ''),
                            String(task?.h2 || ''),
                        ].join('\n').toLowerCase();
                        if (!bag) return -1;
                        if (bag.startsWith(query)) return 5;
                        if (bag.includes(query)) return 3;
                        const allTokens = query.split(/\s+/).filter(Boolean);
                        const hit = allTokens.filter((token) => bag.includes(token)).length;
                        return hit > 0 ? hit : -1;
                    };
                    const tasks = pool
                        .map((task) => ({ task, score: score(task) }))
                        .filter((item) => item.score > 0)
                        .sort((a, b) => b.score - a.score)
                        .slice(0, limit)
                        .map((item) => taskLite(item.task));
                    return { query, total: tasks.length, tasks };
                },
                summarize(result = {}) {
                    return __tmT("ai.searchedTasksFound", { value1: result?.query || '', value2: Number(result?.total || 0) });
                },
            },
            update_task: {
                name: 'update_task',
                description: __tmT("ai.modifyASingleTaskFieldWithinTheCurrentContext"),
                inputHint: '{ taskId: string, patch: { title?, done?, priority?, customStatus?, startDate?, completionTime?, duration?, remark?, pinned?, milestone? } }',
                readOnly: false,
                confirmPolicy: 'ask',
                async run(input = {}) {
                    const taskId = String(input?.taskId || '').trim();
                    const patch = normalizeTaskFieldPatch(input?.patch || {});
                    const [result] = await applyChatTaskOperations([{ taskId, patch, reason: String(input?.reason || '').trim() }], scopeTasks);
                    return { operation: result || null };
                },
                summarize(result = {}) {
                    const op = result?.operation || {};
                    return op?.ok
                        ? __tmT("ai.modifiedTask", { value1: op.title || op.taskId || __tmT("kernel.task") })
                        : __tmT("ai.failedToModifyTask2", { value1: op?.error || __tmT("plugin.unknownError") });
                },
            },
            create_task: {
                name: 'create_task',
                description: __tmT("ai.createATaskUnderTheCurrentContextDocumentOr"),
                inputHint: '{ content: string, docId?: string, parentTaskId?: string, patch?: {...} }',
                readOnly: false,
                confirmPolicy: 'ask',
                async run(input = {}) {
                    const [result] = await applyChatCreateOperations([{
                        content: String(input?.content || '').trim(),
                        docId: String(input?.docId || '').trim(),
                        parentTaskId: String(input?.parentTaskId || '').trim(),
                        patch: normalizeTaskFieldPatch(input?.patch || {}),
                        reason: String(input?.reason || '').trim(),
                    }], { taskPool: scopeTasks, doc: ctx.doc });
                    return { operation: result || null };
                },
                summarize(result = {}) {
                    const op = result?.operation || {};
                    return op?.ok
                        ? __tmT("ai.done", { value1: describeChatCreateAction(op), value2: op.title || op.taskId || __tmT("kernel.task") })
                        : __tmT("ai.failedToCreateTask", { value1: op?.error || __tmT("plugin.unknownError") });
                },
            },
            create_subtask: {
                name: 'create_subtask',
                description: __tmT("ai.createASubtaskUnderTheCurrentContextTask"),
                inputHint: '{ parentTaskId: string, content: string, patch?: {...} }',
                readOnly: false,
                confirmPolicy: 'ask',
                async run(input = {}) {
                    const parentTaskId = String(input?.parentTaskId || '').trim();
                    if (!parentTaskId) throw new Error(__tmT("ai.missingParenttaskid"));
                    const [result] = await applyChatCreateOperations([{
                        content: String(input?.content || '').trim(),
                        docId: '',
                        parentTaskId,
                        patch: normalizeTaskFieldPatch(input?.patch || {}),
                        reason: String(input?.reason || '').trim(),
                    }], { taskPool: scopeTasks, doc: ctx.doc });
                    return { operation: result || null };
                },
                summarize(result = {}) {
                    const op = result?.operation || {};
                    return op?.ok
                        ? __tmT("ai.createdSubtaskUnder", { value1: op.targetLabel || op.parentTaskId || __tmT("kernel.parentTask"), value2: op.title || op.taskId || __tmT("kernel.task") })
                        : __tmT("ai.failedToCreateSubtask", { value1: op?.error || __tmT("plugin.unknownError") });
                },
            },
            create_task_suggestion: {
                name: 'create_task_suggestion',
                description: __tmT("ai.quicklyWriteASuggestedTaskIntoADocument"),
                inputHint: '{ content: string, docId?: string }',
                readOnly: false,
                confirmPolicy: 'ask',
                async run(input = {}) {
                    const content = String(input?.content || '').trim();
                    if (!content) throw new Error(__tmT("ai.missingContent"));
                    const docId = await assertScopedDocId(input?.docId);
                    if (typeof b?.createTaskSuggestion !== 'function') throw new Error(__tmT("ai.suggestedTaskCreationIsNotAvailableInThisVersion"));
                    await b.createTaskSuggestion(docId, content);
                    return {
                        ok: true,
                        docId,
                        content,
                        docName: await resolveDocLabel(docId),
                    };
                },
                summarize(result = {}) {
                    return __tmT("ai.wroteSuggestedTaskIntoDocument", { value1: result?.content || __tmT("kernel.task"), value2: result?.docName || result?.docId || __tmT("kernel.documents") });
                },
            },
            list_configured_docs: {
                name: 'list_configured_docs',
                description: __tmT("ai.readTheDocumentListConfiguredInTheTaskManager"),
                inputHint: '{ limit?: 1-30 }',
                readOnly: true,
                confirmPolicy: 'never',
                async run(input = {}) {
                    const limit = Math.max(1, Math.min(30, Math.round(Number(input?.limit || 12) || 12)));
                    const ids = await b?.getConfiguredDocIds?.({ forceRefresh: false }) || [];
                    const docs = [];
                    for (const docId of ids.slice(0, limit)) {
                        let name = '';
                        try { name = await resolveDocLabel(docId); } catch (e) {}
                        docs.push({ id: String(docId || '').trim(), name: String(name || docId).trim() || String(docId || '').trim() });
                    }
                    return { total: Array.isArray(ids) ? ids.length : 0, docs };
                },
                summarize(result = {}) {
                    return __tmT("ai.readConfiguredDocuments", { value1: Number(result?.total || 0) });
                },
            },
            read_summary_tasks_by_doc_ids: {
                name: 'read_summary_tasks_by_doc_ids',
                description: __tmT("ai.readSummaryCandidateTasksByDocument"),
                inputHint: '{ docIds?: string[], limit?: 1-80 }',
                readOnly: true,
                confirmPolicy: 'never',
                async run(input = {}) {
                    const requested = Array.isArray(input?.docIds) ? input.docIds : [];
                    const docIds = (requested.length ? requested : Array.from(allowedDocIds))
                        .map((item) => String(item || '').trim())
                        .filter(Boolean)
                        .filter((item) => !allowedDocIds.size || allowedDocIds.has(item));
                    if (!docIds.length) throw new Error(__tmT("ai.noReadableDocumentsInTheCurrentContext"));
                    const limit = Math.max(1, Math.min(80, Math.round(Number(input?.limit || 24) || 24)));
                    const list = await b?.getSummaryTasksByDocIds?.(docIds, { ignoreExcludeCompleted: true }) || [];
                    return {
                        docIds,
                        total: Array.isArray(list) ? list.length : 0,
                        tasks: (Array.isArray(list) ? list : []).slice(0, limit).map(taskLite),
                    };
                },
                summarize(result = {}) {
                    return __tmT("ai.readSummaryTasksFromDocumentsInTotal", { value1: Array.isArray(result?.docIds) ? result.docIds.length : 0, value2: Number(result?.total || 0) });
                },
            },
            read_existing_schedules: {
                name: 'read_existing_schedules',
                description: __tmT("ai.readExistingSchedulesForADayOrADate"),
                inputHint: '{ date?: \"YYYY-MM-DD\", dateTo?: \"YYYY-MM-DD\" }',
                readOnly: true,
                confirmPolicy: 'never',
                async run(input = {}) {
                    const date = normalizeDateKey(String(input?.date || todayKey()).trim()) || todayKey();
                    const dateTo = normalizeDateKey(String(input?.dateTo || date).trim()) || date;
                    const schedules = await loadExistingSchedulesByRange(date, dateTo);
                    return {
                        date,
                        dateTo,
                        total: schedules.length,
                        schedules: schedules.slice(0, 30).map((item) => ({
                            id: String(item?.id || '').trim(),
                            taskId: String(item?.taskId || '').trim(),
                            title: String(item?.title || '').trim(),
                            start: String(item?.start || '').trim(),
                            end: String(item?.end || '').trim(),
                            dayKey: String(item?.dayKey || '').trim(),
                        })),
                    };
                },
                summarize(result = {}) {
                    const from = String(result?.date || '').trim();
                    const to = String(result?.dateTo || from).trim();
                    return __tmT("ai.readSchedulesFor", { value1: from === to ? from : `${from} ~ ${to}`, value2: Number(result?.total || 0) });
                },
            },
            write_schedule_to_calendar: {
                name: 'write_schedule_to_calendar',
                description: __tmT("ai.writeAScheduleDirectlyToTheCalendarForA"),
                inputHint: '{ taskId: string, start: \"YYYY-MM-DD HH:mm\", end: \"YYYY-MM-DD HH:mm\", title?: string, allDay?: boolean }',
                readOnly: false,
                confirmPolicy: 'ask',
                async run(input = {}) {
                    const task = await assertScopedTask(input?.taskId);
                    const start = parseDateTimeLoose(input?.start);
                    const end = parseDateTimeLoose(input?.end);
                    if (!(start instanceof Date) || Number.isNaN(start.getTime())) throw new Error(__tmT("ai.invalidStart"));
                    if (!(end instanceof Date) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) throw new Error(__tmT("ai.invalidEnd"));
                    const cal = globalThis.__tmCalendar;
                    if (!cal?.addTaskSchedule) throw new Error(__tmT("ai.calendarModuleIsNotLoaded"));
                    const title = String(input?.title || task?.content || task?.id || __tmT("kernel.task")).trim();
                    const item = await cal.addTaskSchedule({
                        taskId: String(task?.id || '').trim(),
                        title,
                        start,
                        end,
                        calendarId: 'default',
                        durationMin: Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000)),
                        allDay: !!input?.allDay,
                        refresh: false,
                    });
                    try {
                        if (typeof cal.requestRefresh === 'function') {
                            await cal.requestRefresh({
                                reason: 'ai-write-schedule-tool',
                                main: true,
                                side: true,
                                flushTaskPanel: true,
                                rangeStart: item?.start,
                                rangeEnd: item?.end,
                            });
                        } else {
                            await cal.refreshInPlace?.({ silent: false });
                        }
                    } catch (e) {}
                    return {
                        scheduleId: String(item?.id || '').trim(),
                        taskId: String(task?.id || '').trim(),
                        title,
                        start: `${dateToKey(start)} ${normalizeTimeHm(`${start.getHours()}:${String(start.getMinutes()).padStart(2, '0')}`)}`,
                        end: `${dateToKey(end)} ${normalizeTimeHm(`${end.getHours()}:${String(end.getMinutes()).padStart(2, '0')}`)}`,
                    };
                },
                summarize(result = {}) {
                    return __tmT("ai.wroteScheduleForTask", { value1: result?.title || result?.taskId || __tmT("kernel.task"), value2: result?.start || '', value3: result?.end || '' }).trim();
                },
            },
            delete_schedule: {
                name: 'delete_schedule',
                description: __tmT("ai.deleteAnExistingScheduleByItsScheduleId"),
                inputHint: '{ scheduleId: string }',
                readOnly: false,
                confirmPolicy: 'ask',
                async run(input = {}) {
                    const scheduleId = String(input?.scheduleId || '').trim();
                    if (!scheduleId) throw new Error(__tmT("ai.missingScheduleid"));
                    const cal = globalThis.__tmCalendar;
                    if (!cal?.deleteScheduleById) throw new Error(__tmT("ai.calendarModuleIsNotLoaded"));
                    const ok = await cal.deleteScheduleById(scheduleId, { closeModal: false });
                    if (!ok) throw new Error(__tmT("ai.failedToDeleteTheSchedule"));
                    try { await cal.refreshInPlace?.({ silent: false }); } catch (e) {}
                    return { scheduleId, ok: true };
                },
                summarize(result = {}) {
                    return __tmT("ai.scheduleDeleted", { value1: result?.scheduleId || '' }).trim();
                },
            },
        };
    }

    function listAvailableChatSkills(registry) {
        return Object.values(registry || {}).map((skill) => ({
            name: String(skill?.name || '').trim(),
            description: String(skill?.description || '').trim(),
            readOnly: !!skill?.readOnly,
            confirmPolicy: String(skill?.confirmPolicy || 'never').trim() || 'never',
            inputHint: String(skill?.inputHint || '').trim(),
        })).filter((item) => item.name);
    }

    function groupAvailableChatSkills(availableSkills) {
        const list = Array.isArray(availableSkills) ? availableSkills : [];
        return {
            read: list.filter((item) => item?.readOnly),
            write: list.filter((item) => !item?.readOnly),
        };
    }

    function createChatSkillErrorResult(call, error) {
        return {
            id: String(call?.id || uid('skill-error')).trim(),
            skill: String(call?.skill || '').trim(),
            ok: false,
            readOnly: false,
            durationMs: 0,
            summary: String(error || __tmT("ai.skillCallFailed")).trim(),
            error: String(error || __tmT("ai.skillCallFailed")).trim(),
            data: null,
        };
    }

    function normalizeChatSkillResultForPlanner(result = {}) {
        if (!result || typeof result !== 'object') return {};
        if (!result.ok) {
            return {
                ok: false,
                error: String(result.error || result.summary || __tmT("ai.failed2")).trim(),
            };
        }
        const data = result.data && typeof result.data === 'object' ? result.data : {};
        if (Array.isArray(data.tasks)) {
            return {
                total: Number(data.total || data.tasks.length || 0),
                tasks: data.tasks.slice(0, 12).map((task) => ({
                    id: String(task?.id || '').trim(),
                    content: truncateForAi(task?.content || '', 80),
                    done: !!task?.done,
                    docName: truncateForAi(task?.docName || '', 40),
                    startDate: String(task?.startDate || '').trim(),
                    completionTime: String(task?.completionTime || '').trim(),
                })),
            };
        }
        if (data.task) return { task: data.task };
        if (data.document) {
            return {
                document: {
                    id: String(data.document?.id || '').trim(),
                    name: truncateForAi(data.document?.name || '', 80),
                    path: truncateForAi(data.document?.path || '', 120),
                    excerpt: data.document?.excerpt || {},
                    tasks: Array.isArray(data.document?.tasks) ? data.document.tasks.slice(0, 12) : [],
                },
            };
        }
        if (Array.isArray(data.docs)) {
            return {
                total: Number(data.total || data.docs.length || 0),
                docs: data.docs.slice(0, 12).map((doc) => ({
                    id: String(doc?.id || '').trim(),
                    name: truncateForAi(doc?.name || '', 80),
                })),
            };
        }
        if (Array.isArray(data.schedules)) {
            return {
                total: Number(data.total || data.schedules.length || 0),
                schedules: data.schedules.slice(0, 12).map((item) => ({
                    id: String(item?.id || '').trim(),
                    taskId: String(item?.taskId || '').trim(),
                    title: truncateForAi(item?.title || '', 80),
                    start: String(item?.start || '').trim(),
                    end: String(item?.end || '').trim(),
                    dayKey: String(item?.dayKey || '').trim(),
                })),
            };
        }
        if (data.operation) return { operation: data.operation };
        return clone(data);
    }

    async function executeChatSkillCalls(skillCalls, registry) {
        const calls = Array.isArray(skillCalls) ? skillCalls : [];
        const out = [];
        for (const call of calls.slice(0, AI_CHAT_SKILL_MAX_CALLS_PER_ROUND)) {
            const spec = registry?.[String(call?.skill || '').trim()];
            if (!spec || typeof spec.run !== 'function') {
                out.push(createChatSkillErrorResult(call, __tmT("ai.unknownSkill", { value1: String(call?.skill || '').trim() || __tmT("ai.empty") })));
                continue;
            }
            const startedAt = Date.now();
            try {
                const data = await spec.run(call.input || {});
                const durationMs = Math.max(0, Date.now() - startedAt);
                out.push({
                    id: String(call.id || uid('skill-call')).trim(),
                    skill: spec.name,
                    ok: true,
                    readOnly: !!spec.readOnly,
                    durationMs,
                    summary: String(spec.summarize?.(data, call) || __tmT("ai.executedSuccessfully", { name: spec.name })).trim(),
                    error: '',
                    data: data && typeof data === 'object' ? clone(data) : data,
                });
            } catch (e) {
                const durationMs = Math.max(0, Date.now() - startedAt);
                out.push({
                    id: String(call.id || uid('skill-call')).trim(),
                    skill: spec.name,
                    ok: false,
                    readOnly: !!spec.readOnly,
                    durationMs,
                    summary: String(e?.message || e || __tmT("ai.executionFailed", { name: spec.name })).trim(),
                    error: String(e?.message || e || __tmT("ai.executionFailed", { name: spec.name })).trim(),
                    data: null,
                });
            }
        }
        return out;
    }

    async function runChatSkillLoop(turnContext) {
        const registry = buildChatSkillRegistry(turnContext);
        const availableSkills = listAvailableChatSkills(registry);
        const availableSkillGroups = groupAvailableChatSkills(availableSkills);
        const rounds = [];
        let combinedPlan = [];
        let combinedWarnings = [];
        let stopReason = '';
        let done = false;
        for (let round = 1; round <= AI_CHAT_SKILL_MAX_ROUNDS; round += 1) {
            const plannerRaw = await callMiniMaxJson(
                buildChatSkillPlannerPrompt(),
                {
                    conversationType: turnContext?.session?.type,
                    contextScope: turnContext?.session?.contextScope,
                    contextScopeLabel: AI_CONTEXT_SCOPE_LABELS[turnContext?.session?.contextScope] || turnContext?.session?.contextScope || '',
                    selectedDocIds: turnContext?.session?.selectedDocIds || [],
                    selectedTaskIds: turnContext?.taskIds || [],
                    availableSkills,
                    availableReadSkills: availableSkillGroups.read,
                    availableWriteSkills: availableSkillGroups.write,
                    document: turnContext?.doc ? {
                        id: turnContext.doc.id,
                        name: turnContext.doc.name,
                        path: turnContext.doc.path,
                        ...turnContext.excerpt,
                    } : null,
                    contextTasks: (Array.isArray(turnContext?.scopeTasks) ? turnContext.scopeTasks : []).slice(0, 40).map(taskLite),
                    priorRounds: rounds.map((item) => ({
                        round: item.round,
                        plan: item.plan,
                        warnings: item.warnings,
                        reason: item.reason,
                        results: item.results.map((result) => ({
                            id: result.id,
                            skill: result.skill,
                            ok: result.ok,
                            summary: result.summary,
                            data: normalizeChatSkillResultForPlanner(result),
                        })),
                    })),
                    userInstruction: turnContext?.instruction || '',
                },
                {
                    history: turnContext?.history || [],
                    contextMode: turnContext?.session?.contextMode,
                    expectedSchema: 'chat_skill_plan',
                    maxTokens: Math.max(1400, getConfig().maxTokens),
                }
            );
            const planner = normalizeChatSkillPlannerResult(plannerRaw);
            if (planner.plan.length) combinedPlan = planner.plan;
            if (planner.warnings.length) combinedWarnings = combinedWarnings.concat(planner.warnings).slice(-12);
            const results = planner.skillCalls.length ? await executeChatSkillCalls(planner.skillCalls, registry) : [];
            rounds.push({
                round,
                plan: planner.plan,
                warnings: planner.warnings,
                reason: planner.reason,
                requestedCalls: planner.skillCalls.map((item) => ({ id: item.id, skill: item.skill, reason: item.reason, input: clone(item.input || {}) })),
                results,
            });
            if (!planner.skillCalls.length || planner.done) {
                done = true;
                stopReason = planner.reason || (planner.done ? 'planner-done' : 'no-skill-calls');
                break;
            }
        }
        if (!done) stopReason = 'max-rounds-reached';
        return {
            plan: combinedPlan,
            warnings: Array.from(new Set(combinedWarnings.filter(Boolean))).slice(0, 12),
            rounds,
            availableSkills,
            done,
            stopReason,
        };
    }

    async function synthesizeChatSkillLoopResult(turnContext, loopResult) {
        const result = await callMiniMaxJson(
            buildChatSkillFinalPrompt(),
            {
                conversationType: turnContext?.session?.type,
                contextScope: turnContext?.session?.contextScope,
                document: turnContext?.doc ? {
                    id: turnContext.doc.id,
                    name: turnContext.doc.name,
                    path: turnContext.doc.path,
                } : null,
                userInstruction: turnContext?.instruction || '',
                plan: Array.isArray(loopResult?.plan) ? loopResult.plan : [],
                loopWarnings: Array.isArray(loopResult?.warnings) ? loopResult.warnings : [],
                stopReason: String(loopResult?.stopReason || '').trim(),
                rounds: (Array.isArray(loopResult?.rounds) ? loopResult.rounds : []).map((item) => ({
                    round: item.round,
                    plan: item.plan,
                    warnings: item.warnings,
                    reason: item.reason,
                    results: (Array.isArray(item.results) ? item.results : []).map((skillResult) => ({
                        id: skillResult.id,
                        skill: skillResult.skill,
                        ok: skillResult.ok,
                        summary: skillResult.summary,
                        error: skillResult.error,
                        data: normalizeChatSkillResultForPlanner(skillResult),
                    })),
                })),
            },
            {
                history: turnContext?.history || [],
                contextMode: turnContext?.session?.contextMode,
                expectedSchema: 'chat_skill_final',
                maxTokens: Math.max(1400, getConfig().maxTokens),
            }
        );
        return normalizeChatSkillFinalResult(result);
    }

    function extractTasksFromKramdown(docSnapshot) {
        const lines = String(docSnapshot?.kramdown || '').split(/\r?\n/);
        const tasks = [];
        let heading = '';
        for (const rawLine of lines) {
            const line = String(rawLine || '');
            const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
            if (headingMatch) {
                heading = strip(headingMatch[1]);
                continue;
            }
            const taskMatch = line.match(/(?:^|\s)[-*]\s+\[([ xX])\]\s+(.+)$/);
            if (!taskMatch) continue;
            const content = strip(String(taskMatch[2] || '').replace(/\{\:\s*[^}]*\}\s*$/g, ''));
            if (!content) continue;
            tasks.push({
                id: `km-${tasks.length + 1}`,
                content,
                done: String(taskMatch[1] || '').toLowerCase() === 'x',
                priority: '',
                customStatus: '',
                startDate: '',
                completionTime: '',
                duration: '',
                remark: '',
                pinned: false,
                milestone: false,
                h2: heading,
            });
        }
        return tasks;
    }

    function buildDocExcerpt(docSnapshot, taskId, mode) {
        if (String(mode || '').trim() === 'none') {
            return {
                mode: 'none',
                intro: '',
                nearby: '',
                fulltext: '',
                contextChars: 0,
            };
        }
        const lines = String(docSnapshot?.kramdown || '').split(/\r?\n/);
        const index = taskId ? lines.findIndex((line) => line.includes(`id="${taskId}"`) || line.includes(`id='${taskId}'`)) : -1;
        const intro = lines.slice(0, Math.max(40, index > 0 ? Math.min(index, 70) : 40)).filter((line) => !/id=/.test(line) && !/^\s*[-*]\s+\[[ xX]\]/.test(line));
        const nearby = index >= 0 ? lines.slice(Math.max(0, index - 16), Math.min(lines.length, index + 10)) : lines.slice(0, 24);
        const full = mode === 'fulltext' ? lines.slice(0, 800) : [];
        const result = {
            mode: mode === 'fulltext' ? 'fulltext' : 'nearby',
            intro: intro.map(strip).filter(Boolean).slice(0, 20).join('\n'),
            nearby: nearby.map(strip).filter(Boolean).slice(0, 30).join('\n'),
            fulltext: full.map(strip).filter(Boolean).slice(0, 400).join('\n'),
        };
        result.contextChars = [result.intro, result.nearby, result.fulltext].join('\n').trim().length;
        return result;
    }

    async function optimizeTitle(taskId) {
        const b = bridge();
        const task = await b.getTaskSnapshot(taskId);
        if (!task) throw new Error(__tmT("kernel.noTaskFound"));
        const hKey = ['task-title', String(taskId || '').trim()];
        const history = await loadHistory(hKey[0], hKey[1]);
        const input = await promptInput(__tmT("ai.aiOptimizeTaskName"), __tmT("ai.eGShorterMoreActionOrientedHighlightDeliverables"), __tmT("ai.theAiGeneratesTitleSuggestionsFromTaskAndDocument"), { history });
        if (!input) return;
        setModal(__tmT("ai.aiOptimizeTaskName"), `<div class="tm-ai-box"><h4>${__tmT("ai.processing2")}</h4><div class="tm-ai-hint">${__tmT("ai.generatingTitleSuggestions")}</div></div>`);
        const doc = await b.getDocumentSnapshot(String(task.docId || task.root_id || '').trim(), { limit: 500 });
        const excerpt = buildDocExcerpt(doc, task.id, input.mode);
        const result = await callMiniMaxJson(
            __tmT("ai.youAreATaskManagementExpertOutputOnlyJson"),
            {
                task: taskLite(task),
                document: { id: doc?.id, name: doc?.name, path: doc?.path, ...excerpt },
                siblingTasks: (doc?.tasks || []).filter((it) => String(it?.id || '') !== String(task.id || '')).slice(0, 12).map(taskLite),
                userInstruction: input.instruction,
            },
            { history, contextMode: input.mode, expectedSchema: 'optimize_title' }
        );
        const titles = Array.from(new Set([String(result?.suggestedTitle || '').trim(), ...(Array.isArray(result?.alternatives) ? result.alternatives.map((it) => String(it || '').trim()) : [])].filter(Boolean)));
        if (!titles.length) throw new Error(__tmT("ai.theAiDidNotGenerateAUsableTitle"));
        const reason = String(result?.reason || '').trim();
        const missing = Array.isArray(result?.missingInfo) ? result.missingInfo.map((it) => String(it || '').trim()).filter(Boolean) : [];
        await appendHistory(hKey[0], hKey[1], 'user', input.instruction || __tmT("ai.optimizeTheCurrentTaskName"));
        await appendHistory(hKey[0], hKey[1], 'assistant', [
            __tmT("ai.suggestedTitle", { value1: titles[0] }),
            titles.length > 1 ? __tmT("ai.alternativeTitles", { value1: titles.slice(1).join('；') }) : '',
            reason ? __tmT("ai.reason", { reason: reason }) : '',
            missing.length ? __tmT("ai.missingInfo", { value1: missing.join('；') }) : '',
        ].filter(Boolean).join('\n'));
        const modal = setModal(__tmT("ai.aiOptimizeTaskName"), `
            <div class="tm-ai-box"><h4>${__tmT("ai.currentTask")}</h4><div>${getTaskTitlePresentation(task.markdown || task.content, __tmT("kernel.noContent")).html}</div></div>
            <div class="tm-ai-box"><h4>${__tmT("ai.suggestedTitles")}</h4><div class="tm-ai-list">${titles.map((title, index) => `<label class="tm-ai-item"><input type="radio" name="tm-ai-title" value="${esc(title)}" ${index === 0 ? 'checked' : ''}> ${esc(title)}</label>`).join('')}</div></div>
            ${reason ? `<div class="tm-ai-box"><h4>${__tmT("ai.reason2")}</h4><div>${esc(reason)}</div></div>` : ''}
            ${missing.length ? `<div class="tm-ai-box"><h4>${__tmT("ai.missingInformation")}</h4><div class="tm-ai-list">${missing.map((it) => `<div class="tm-ai-item">${esc(it)}</div>`).join('')}</div></div>` : ''}
            <div class="tm-ai-actions">
                <button class="tm-btn tm-btn-secondary" data-ai-action="close">${__tmT("common.close")}</button>
                <button class="tm-btn tm-btn-primary" data-ai-action="copy">${__tmT("ai.copyPrimaryTitle")}</button>
                <button class="tm-btn tm-btn-primary" data-ai-action="continue">${__tmT("ai.continueChat")}</button>
                <button class="tm-btn tm-btn-success" data-ai-action="apply">${__tmT("ai.applyTitle")}</button>
            </div>
        `);
        const body = modal.querySelector('.tm-ai-modal__body');
        body.addEventListener('click', async (event) => {
            const action = String(event.target?.dataset?.aiAction || '');
            if (!action) return;
            if (action === 'copy') {
                try {
                    await navigator.clipboard.writeText(titles[0]);
                    toast(__tmT("ai.titleCopied"), 'success');
                } catch (e) {
                    toast(__tmT("ai.copyFailed"), 'error');
                }
            } else if (action === 'continue') {
                await optimizeTitle(taskId);
            } else if (action === 'apply') {
                const selected = String(body.querySelector('input[name="tm-ai-title"]:checked')?.value || titles[0] || '').trim();
                await b.applyTaskPatch(taskId, { title: selected });
                toast(__tmT("ai.updatedtaskHeading"), 'success');
                closeModal();
            }
        });
    }

    async function editTask(taskId) {
        const b = bridge();
        const task = await b.getTaskSnapshot(taskId);
        if (!task) throw new Error(__tmT("kernel.noTaskFound"));
        const hKey = ['task-edit', String(taskId || '').trim()];
        const history = await loadHistory(hKey[0], hKey[1]);
        const input = await promptInput(__tmT("ai.aiEditFields"), __tmT("ai.forExampleSetImportanceToHighStatusToIn"), __tmT("ai.theAiTranslatesNaturalLanguageIntoAFieldPatch"), { history });
        if (!input) return;
        if (!input.instruction) throw new Error(__tmT("ai.enterAnEditInstruction"));
        setModal(__tmT("ai.aiEditFields"), `<div class="tm-ai-box"><h4>${__tmT("ai.processing2")}</h4><div class="tm-ai-hint">${__tmT("ai.generatingFieldPatch")}</div></div>`);
        const doc = await b.getDocumentSnapshot(String(task.docId || task.root_id || '').trim(), { limit: 500 });
        const excerpt = buildDocExcerpt(doc, task.id, input.mode);
        const result = await callMiniMaxJson(
            __tmT("ai.youAreATaskFieldEditingAssistantOutputOnly"),
            {
                task: taskLite(task),
                document: { id: doc?.id, name: doc?.name, path: doc?.path, ...excerpt },
                userInstruction: input.instruction,
            },
            { history, contextMode: input.mode, expectedSchema: 'edit_task_fields' }
        );
        const patch = normalizeTaskFieldPatch(clone(result?.patch || {}));
        if (!patch || typeof patch !== 'object' || !Object.keys(patch).length) throw new Error(__tmT("ai.theAiDidNotGenerateAnApplicablePatch"));
        const warnings = Array.isArray(result?.warnings) ? result.warnings.map((it) => String(it || '').trim()).filter(Boolean) : [];
        const reason = String(result?.reason || '').trim();
        await appendHistory(hKey[0], hKey[1], 'user', input.instruction);
        await appendHistory(hKey[0], hKey[1], 'assistant', [
            __tmT("ai.fieldSuggestions"),
            JSON.stringify(patch, null, 2),
            reason ? __tmT("ai.reason", { reason: reason }) : '',
            warnings.length ? __tmT("ai.reminder", { value1: warnings.join('；') }) : '',
        ].filter(Boolean).join('\n'));
        const modal = setModal(__tmT("ai.aiEditFields"), `
            <div class="tm-ai-box"><h4>${__tmT("ai.fieldPreview")}</h4><div class="tm-ai-code">${esc(JSON.stringify(patch, null, 2))}</div></div>
            ${reason ? `<div class="tm-ai-box"><h4>${__tmT("ai.reason2")}</h4><div>${esc(reason)}</div></div>` : ''}
            ${warnings.length ? `<div class="tm-ai-box"><h4>${__tmT("ai.warnings")}</h4><div class="tm-ai-list">${warnings.map((it) => `<div class="tm-ai-item">${esc(it)}</div>`).join('')}</div></div>` : ''}
            <div class="tm-ai-actions">
                <button class="tm-btn tm-btn-secondary" data-ai-action="close">${__tmT("common.close")}</button>
                <button class="tm-btn tm-btn-primary" data-ai-action="copy">${__tmT("ai.copyJson")}</button>
                <button class="tm-btn tm-btn-primary" data-ai-action="continue">${__tmT("ai.continueChat")}</button>
                <button class="tm-btn tm-btn-success" data-ai-action="apply">${__tmT("ai.applyPatch")}</button>
            </div>
        `);
        const body = modal.querySelector('.tm-ai-modal__body');
        body.addEventListener('click', async (event) => {
            const action = String(event.target?.dataset?.aiAction || '');
            if (!action) return;
            if (action === 'copy') {
                try {
                    await navigator.clipboard.writeText(JSON.stringify(patch, null, 2));
                    toast(__tmT("ai.copiedPatch"), 'success');
                } catch (e) {
                    toast(__tmT("ai.copyFailed"), 'error');
                }
            } else if (action === 'continue') {
                await editTask(taskId);
            } else if (action === 'apply') {
                const nextTask = await b.applyTaskPatch(taskId, patch);
                if (!verifyTaskPatchApplied(nextTask, patch)) throw new Error(__tmT("ai.theFieldPatchDidNotFullyApplyCheckThe"));
                toast(__tmT("ai.fieldPatchApplied"), 'success');
                closeModal();
            }
        });
    }

    function smartMd(doc, result) {
        const s = result.smartScore || {};
        const d = s.byDimension || {};
        const section = (title, items) => Array.isArray(items) && items.length ? `## ${title}\n${items.map((it) => `- ${it}`).join('\n')}\n` : '';
        const renameSection = Array.isArray(result.taskRenameSuggestions) && result.taskRenameSuggestions.length
            ? __tmT("ai.taskRenameSuggestions", { value1: result.taskRenameSuggestions.map((it) => `- ${it.currentTitle || __tmT("kernel.untitledTask")} -> ${it.suggestedTitle || __tmT("ai.noSuggestionsProvided")}${it.reason ? `（${it.reason}）` : ''}`).join('\n') })
            : '';
        return [
            __tmT("ai.smartAnalysisReport", { value1: doc?.name || __tmT("kernel.documents") }),
            '',
            String(result.summary || ''),
            '',
            __tmT("ai.overall", { value1: Number(s.overall) || 0 }),
            `- Specific：${Number(d.specific) || 0}/100`,
            `- Measurable：${Number(d.measurable) || 0}/100`,
            `- Achievable：${Number(d.achievable) || 0}/100`,
            `- Relevant：${Number(d.relevant) || 0}/100`,
            `- TimeBound：${Number(d.timeBound) || 0}/100`,
            '',
            section(__tmT("ai.strengths"), result.strengths),
            section(__tmT("ai.issues"), result.issues),
            section(__tmT("ai.missingInformation"), result.missingInfo),
            section(__tmT("ai.suggestedTasks"), result.taskSuggestions),
            renameSection,
            section(__tmT("ai.suggestedMilestones"), result.milestoneSuggestions),
            section(__tmT("ai.schedulingHints"), result.scheduleHints),
        ].join('\n').trim();
    }

    async function generateTaskRenameSuggestions(doc, structuredTasks, input, history) {
        if (!Array.isArray(structuredTasks) || !structuredTasks.length) return [];
        const excerpt = buildDocExcerpt(doc, '', input.mode);
        const result = await callMiniMaxJson(
            __tmT("ai.youAreATaskNamingOptimizationAssistantOutputOnly"),
            {
                document: { id: doc.id, name: doc.name, path: doc.path, ...excerpt },
                taskCount: structuredTasks.length,
                tasks: structuredTasks.slice(0, 40).map(taskLite),
                userInstruction: input.instruction || __tmT("ai.addTaskNamingOptimizationSuggestions"),
            },
            { maxTokens: Math.min(1400, Math.max(900, getConfig().maxTokens)), contextMode: input.mode, timeoutMs: 45000, expectedSchema: 'task_rename_suggestions' }
        );
        return Array.isArray(result?.taskRenameSuggestions) ? result.taskRenameSuggestions.map((it) => ({
            taskId: String(it?.taskId || '').trim(),
            currentTitle: String(it?.currentTitle || '').trim(),
            suggestedTitle: String(it?.suggestedTitle || '').trim(),
            reason: String(it?.reason || '').trim(),
        })).filter((it) => it.taskId && it.suggestedTitle) : [];
    }

    async function analyzeSmart(docId) {
        const b = bridge();
        const did = String(docId || b.getCurrentDocId?.() || '').trim();
        if (!did) throw new Error(__tmT("ai.currentDocumentNotFound"));
        const hKey = ['doc-smart', did];
        const history = await loadHistory(hKey[0], hKey[1]);
        const input = await promptInput(__tmT("ai.aiSmartAnalysis"), __tmT("ai.eGFocusOnMeasurableGoalsAndTimeConstraints"), __tmT("ai.analyzesTheCurrentDocumentByDefaultCheckingFullText"), { history });
        if (!input) return;
        const smartSteps = [__tmT("ai.readDocument"), __tmT("ai.extractTasks"), __tmT("ai.requestSmartAnalysis"), __tmT("ai.organizeAnalysisResults")];
        setProgressModal(__tmT("ai.aiSmartAnalysis"), smartSteps, 0, __tmT("ai.readingTheCurrentDocument"));
        const doc = await b.getDocumentSnapshot(did, { limit: 1200 });
        if (!doc) throw new Error(__tmT("ai.failedToReadTheDocument"));
        setProgressModal(__tmT("ai.aiSmartAnalysis"), smartSteps, 1, __tmT("ai.extractingTasksAndBodyContext"));
        const excerpt = buildDocExcerpt(doc, '', input.mode);
        const docTasks = Array.isArray(doc.tasks) ? doc.tasks : [];
        const extractedTasks = extractTasksFromKramdown(doc);
        const structuredTasks = docTasks.length ? docTasks : extractedTasks;
        const docTextLength = String(doc?.kramdown || '').trim().length;
        const contextChars = Number(excerpt?.contextChars || 0);
        setProgressModal(__tmT("ai.aiSmartAnalysis"), smartSteps, 2, __tmT("ai.requestingSmartAnalysisDocumentStructuredTasksCharactersOfSource", { value1: doc.name || __tmT("kernel.untitledDocument"), length: structuredTasks.length, docTextLength: docTextLength, contextChars: contextChars }));
        let result;
        try {
            result = await callMiniMaxJson(
                __tmT("ai.youAreAProjectManagementConsultantOutputOnlyJson"),
                {
                    document: { id: doc.id, name: doc.name, path: doc.path, ...excerpt },
                    taskCount: structuredTasks.length,
                    tasks: structuredTasks.slice(0, 50).map(taskLite),
                    userInstruction: input.instruction,
                },
                { maxTokens: Math.min(1800, Math.max(1200, getConfig().maxTokens)), contextMode: input.mode, timeoutMs: 45000, expectedSchema: 'smart_analysis' }
            );
        } catch (e) {
            const msg = String(e?.message || e || __tmT("ai.smartAnalysisFailed"));
            setProgressModal(__tmT("ai.aiSmartAnalysis"), smartSteps, 2, __tmT("ai.smartAnalysisRequestFailed", { msg: msg }));
            throw e;
        }
        setProgressModal(__tmT("ai.aiSmartAnalysis"), smartSteps, 3, __tmT("ai.organizingAnalysisResults"));
        const report = {
            summary: String(result?.summary || '').trim(),
            smartScore: {
                overall: Math.max(0, Math.min(100, Math.round(Number(result?.smartScore?.overall) || 0))),
                byDimension: {
                    specific: Math.max(0, Math.min(100, Math.round(Number(result?.smartScore?.byDimension?.specific) || 0))),
                    measurable: Math.max(0, Math.min(100, Math.round(Number(result?.smartScore?.byDimension?.measurable) || 0))),
                    achievable: Math.max(0, Math.min(100, Math.round(Number(result?.smartScore?.byDimension?.achievable) || 0))),
                    relevant: Math.max(0, Math.min(100, Math.round(Number(result?.smartScore?.byDimension?.relevant) || 0))),
                    timeBound: Math.max(0, Math.min(100, Math.round(Number(result?.smartScore?.byDimension?.timeBound) || 0))),
                },
            },
            strengths: Array.isArray(result?.strengths) ? result.strengths.map((it) => String(it || '').trim()).filter(Boolean) : [],
            issues: Array.isArray(result?.issues) ? result.issues.map((it) => String(it || '').trim()).filter(Boolean) : [],
            missingInfo: Array.isArray(result?.missingInfo) ? result.missingInfo.map((it) => String(it || '').trim()).filter(Boolean) : [],
            taskSuggestions: Array.isArray(result?.taskSuggestions) ? result.taskSuggestions.map((it) => String(it || '').trim()).filter(Boolean) : [],
            taskRenameSuggestions: [],
            milestoneSuggestions: Array.isArray(result?.milestoneSuggestions) ? result.milestoneSuggestions.map((it) => String(it || '').trim()).filter(Boolean) : [],
            scheduleHints: Array.isArray(result?.scheduleHints) ? result.scheduleHints.map((it) => String(it || '').trim()).filter(Boolean) : [],
        };
        const cachedRenameSuggestions = smartRenameCache.get(did);
        if (!report.taskRenameSuggestions.length && Array.isArray(cachedRenameSuggestions) && cachedRenameSuggestions.length) {
            report.taskRenameSuggestions = cachedRenameSuggestions.map((it) => ({ ...it }));
        }
        const dims = report.smartScore.byDimension;
        const markdown = smartMd(doc, report);
        await appendHistory(hKey[0], hKey[1], 'user', input.instruction || __tmT("ai.analyzeHowSmartTheCurrentDocumentIs"));
        await appendHistory(hKey[0], hKey[1], 'assistant', markdown);
        const renderSmartResult = () => setModal(__tmT("ai.aiSmartAnalysis"), `
            <div class="tm-ai-box"><h4>${__tmT("ai.analysisInput")}</h4><div class="tm-ai-hint">${__tmT("ai.documents", { value1: esc(doc.name || __tmT("kernel.untitledDocument")), value2: esc(doc.id || '') })}</div><div class="tm-ai-hint">${__tmT("ai.contextModeStructuredTasksFullTextExtractionUsedIn", { mode: esc(input.mode), length: docTasks.length, length2: extractedTasks.length, length3: structuredTasks.length, length4: String(doc?.kramdown || '').trim().length, value6: Number(excerpt?.contextChars || 0) })}</div></div>
            <div class="tm-ai-box"><h4>${__tmT("ai.summary2")}</h4><div>${esc(report.summary || __tmT("ai.noSummaryReturned"))}</div></div>
            <div class="tm-ai-grid">
                <div class="tm-ai-score"><b>${report.smartScore.overall}/100</b><div>${__tmT("ai.overall2")}</div></div>
                <div class="tm-ai-score"><b>${dims.specific}/100</b><div>Specific</div></div>
                <div class="tm-ai-score"><b>${dims.measurable}/100</b><div>Measurable</div></div>
                <div class="tm-ai-score"><b>${dims.achievable}/100</b><div>Achievable</div></div>
                <div class="tm-ai-score"><b>${dims.relevant}/100</b><div>Relevant</div></div>
            </div>
            <div class="tm-ai-score"><b>${dims.timeBound}/100</b><div>TimeBound</div></div>
            ${report.strengths.length ? `<div class="tm-ai-box"><h4>${__tmT("ai.strengths")}</h4><div class="tm-ai-list">${report.strengths.map((it) => `<div class="tm-ai-item">${esc(it)}</div>`).join('')}</div></div>` : ''}
            ${report.issues.length ? `<div class="tm-ai-box"><h4>${__tmT("ai.issues")}</h4><div class="tm-ai-list">${report.issues.map((it) => `<div class="tm-ai-item">${esc(it)}</div>`).join('')}</div></div>` : ''}
            ${report.missingInfo.length ? `<div class="tm-ai-box"><h4>${__tmT("ai.missingInformation")}</h4><div class="tm-ai-list">${report.missingInfo.map((it) => `<div class="tm-ai-item">${esc(it)}</div>`).join('')}</div></div>` : ''}
            ${report.taskSuggestions.length ? `<div class="tm-ai-box"><h4>${__tmT("ai.suggestedTasks")}</h4><div class="tm-ai-list">${report.taskSuggestions.map((it, idx) => `<div class="tm-ai-item"><div>${esc(it)}</div><div class="tm-ai-actions" style="margin-top:8px;justify-content:flex-start;"><button class="tm-btn tm-btn-secondary" data-ai-action="create-task" data-ai-index="${idx}">${__tmT("ai.convertToNewTask")}</button></div></div>`).join('')}</div></div>` : ''}
            ${report.taskRenameSuggestions.length ? `<div class="tm-ai-box"><h4>${__tmT("ai.taskRenameSuggestions2")}</h4><div class="tm-ai-list">${report.taskRenameSuggestions.map((it, idx) => `
                <div class="tm-ai-item">
                    <div class="tm-ai-hint" style="margin-bottom:6px;">${__tmT("ai.currentTask")}</div>
                    <div>${esc(it.currentTitle || it.taskId)}</div>
                    <div class="tm-ai-hint" style="margin:8px 0 6px;">${__tmT("ai.suggestedName")}</div>
                    <textarea class="tm-ai-textarea" data-ai-rename-input="${idx}" style="min-height:60px;">${esc(it.suggestedTitle)}</textarea>
                    ${it.reason ? `<div class="tm-ai-hint" style="margin-top:8px;">${esc(it.reason)}</div>` : ''}
                    <div class="tm-ai-actions" style="margin-top:8px;justify-content:flex-start;">
                        <button class="tm-btn tm-btn-success" data-ai-action="apply-rename" data-ai-index="${idx}">${__tmT("ai.applyToTask")}</button>
                    </div>
                </div>
            `).join('')}</div></div>` : (structuredTasks.length ? `<div class="tm-ai-box"><h4>${__tmT("ai.taskRenameSuggestions2")}</h4><div class="tm-ai-hint">${__tmT("ai.thisReportHasNoPerTaskRenameSuggestionsYet")}</div><div class="tm-ai-actions" style="margin-top:10px;justify-content:flex-start;"><button class="tm-btn tm-btn-secondary" data-ai-action="generate-renames">${__tmT("ai.generateTaskRenameSuggestions")}</button></div></div>` : '')}
            ${report.milestoneSuggestions.length ? `<div class="tm-ai-box"><h4>${__tmT("ai.suggestedMilestones")}</h4><div class="tm-ai-list">${report.milestoneSuggestions.map((it) => `<div class="tm-ai-item">${esc(it)}</div>`).join('')}</div></div>` : ''}
            ${report.scheduleHints.length ? `<div class="tm-ai-box"><h4>${__tmT("ai.schedulingHints")}</h4><div class="tm-ai-list">${report.scheduleHints.map((it) => `<div class="tm-ai-item">${esc(it)}</div>`).join('')}</div></div>` : ''}
            <div class="tm-ai-actions">
                <button class="tm-btn tm-btn-secondary" data-ai-action="close">${__tmT("common.close")}</button>
                <button class="tm-btn tm-btn-primary" data-ai-action="copy-report">${__tmT("ai.copyReport")}</button>
                <button class="tm-btn tm-btn-primary" data-ai-action="download-report">${__tmT("ai.exportMarkdown")}</button>
                <button class="tm-btn tm-btn-primary" data-ai-action="continue">${__tmT("ai.continueChat")}</button>
            </div>
        `);
        const modal = renderSmartResult();
        const body = modal.querySelector('.tm-ai-modal__body');
        body.addEventListener('click', async (event) => {
            const action = String(event.target?.dataset?.aiAction || '');
            if (!action) return;
            if (action === 'copy-report') {
                try {
                    await navigator.clipboard.writeText(markdown);
                    toast(__tmT("ai.smartReportCopied"), 'success');
                } catch (e) {
                    toast(__tmT("ai.copyFailed"), 'error');
                }
            } else if (action === 'download-report') {
                const name = `${String(doc?.name || 'smart-report').replace(/[\\/:*?"<>|]+/g, '_')}-smart-report.md`;
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
                a.download = name;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    try { URL.revokeObjectURL(a.href); } catch (e) {}
                    try { a.remove(); } catch (e) {}
                }, 0);
                toast(__tmT("ai.markdownReportExported"), 'success');
            } else if (action === 'continue') {
                await analyzeSmart(did);
            } else if (action === 'generate-renames') {
                const renameSteps = [__tmT("ai.readCurrentAnalysisResults"), __tmT("ai.requestRenameSuggestions"), __tmT("ai.organizeSuggestionList")];
                setProgressModal(__tmT("ai.aiSmartAnalysis"), renameSteps, 0, __tmT("ai.preparingTaskRenameSuggestions"));
                try {
                    setProgressModal(__tmT("ai.aiSmartAnalysis"), renameSteps, 1, __tmT("ai.generatingTaskRenameSuggestionsCurrentTasks", { length: structuredTasks.length }));
                    report.taskRenameSuggestions = await generateTaskRenameSuggestions(doc, structuredTasks, input, history);
                    smartRenameCache.set(did, report.taskRenameSuggestions.map((it) => ({ ...it })));
                    setProgressModal(__tmT("ai.aiSmartAnalysis"), renameSteps, 2, __tmT("ai.organizingSuggestionList"));
                } catch (e) {
                    toast(`❌ ${String(e?.message || e || __tmT("ai.generationFailed"))}`, 'error');
                    report.taskRenameSuggestions = [];
                }
                renderSmartResult();
            } else if (action === 'create-task') {
                const idx = Number(event.target?.dataset?.aiIndex);
                const suggestion = report.taskSuggestions[idx];
                if (!suggestion) return;
                await b.createTaskSuggestion(did, suggestion);
                toast(__tmT("ai.suggestedTaskCreated"), 'success');
            } else if (action === 'apply-rename') {
                const idx = Number(event.target?.dataset?.aiIndex);
                const suggestion = report.taskRenameSuggestions[idx];
                if (!suggestion?.taskId) return;
                const inputEl = body.querySelector(`[data-ai-rename-input="${idx}"]`);
                const nextTitle = String(inputEl?.value || suggestion.suggestedTitle || '').trim();
                if (!nextTitle) {
                    toast(__tmT("ai.suggestedNameCannotBeEmpty"), 'error');
                    return;
                }
                await b.applyTaskPatch(suggestion.taskId, { title: nextTitle });
                suggestion.currentTitle = nextTitle;
                suggestion.suggestedTitle = nextTitle;
                if (inputEl) inputEl.value = nextTitle;
                try { event.target.textContent = __tmT("ai.applied"); } catch (e) {}
                toast(__tmT("ai.taskNameChangeApplied"), 'success');
            }
        });
    }

    async function openDocChat(docId) {
        const b = bridge();
        const did = String(docId || b.getCurrentDocId?.() || '').trim();
        if (!did) throw new Error(__tmT("ai.currentDocumentNotFound"));
        const hKey = ['doc-chat', did];
        const history = await loadHistory(hKey[0], hKey[1]);
        const input = await promptInput(__tmT("ai.aiChat"), __tmT("ai.eGSuggestNextStepsFromTheCurrentDocument"), __tmT("ai.answersUsingTheCurrentDocumentTasksAndNoteBlocks"), { history });
        if (!input) return;
        if (!input.instruction) throw new Error(__tmT("ai.enterAChatMessage"));
        setModal(__tmT("ai.aiChat"), `<div class="tm-ai-box"><h4>${__tmT("ai.processing2")}</h4><div class="tm-ai-hint">${__tmT("ai.preparingTheCurrentDocumentContext")}</div></div>`);
        const doc = await b.getDocumentSnapshot(did, { limit: 1200 });
        if (!doc) throw new Error(__tmT("ai.failedToReadTheDocument"));
        const excerpt = buildDocExcerpt(doc, '', input.mode);
        const docTasks = Array.isArray(doc?.tasks) ? doc.tasks.slice(0, 120) : [];
        const result = await callMiniMaxJson(
            buildChatSystemPrompt(),
            {
                document: { id: doc.id, name: doc.name, path: doc.path, ...excerpt },
                tasks: docTasks.map(taskLite),
                userInstruction: input.instruction,
            },
            { maxTokens: Math.max(1200, getConfig().maxTokens), history, contextMode: input.mode, expectedSchema: 'doc_chat' }
        );
        const createResults = await applyChatCreateOperations(result?.createOperations, { taskPool: docTasks, doc });
        const opResults = await applyChatTaskOperations(result?.taskOperations, docTasks);
        const answer = buildChatExecutionSummary(opResults, createResults, String(result?.answer || '').trim());
        const highlights = Array.isArray(result?.highlights) ? result.highlights.map((it) => String(it || '').trim()).filter(Boolean) : [];
        const nextActions = Array.isArray(result?.nextActions) ? result.nextActions.map((it) => String(it || '').trim()).filter(Boolean) : [];
        const warnings = Array.isArray(result?.warnings) ? result.warnings.map((it) => String(it || '').trim()).filter(Boolean) : [];
        opResults.filter((it) => !it.ok && it.error).forEach((it) => warnings.push(__tmT("ai.task2", { taskId: it.title || it.taskId, error: it.error })));
        createResults.filter((it) => !it.ok && it.error).forEach((it) => warnings.push(`${describeChatCreateAction(it)}“${it.title || __tmT("kernel.task")}”：${it.error}`));
        await appendHistory(hKey[0], hKey[1], 'user', input.instruction);
        await appendHistory(hKey[0], hKey[1], 'assistant', [
            answer || __tmT("ai.chatReplyGenerated"),
            highlights.length ? __tmT("ai.highlights", { value1: highlights.join('；') }) : '',
            nextActions.length ? __tmT("ai.nextSteps", { value1: nextActions.join('；') }) : '',
            warnings.length ? __tmT("ai.reminder", { value1: warnings.join('；') }) : '',
        ].filter(Boolean).join('\n\n'));
        const modal = setModal(__tmT("ai.aiChat"), `
            <div class="tm-ai-box"><h4>${__tmT("kernel.reply")}</h4><div>${esc(answer || __tmT("ai.theAiReturnedNoContent"))}</div></div>
            ${(createResults.length || opResults.length) ? `<div class="tm-ai-box"><h4>${__tmT("ai.executionResults")}</h4><div class="tm-ai-list">
                ${createResults.map((it) => `<div class="tm-ai-item">${esc(`${it.ok ? __tmT("ai.success") : __tmT("ai.failed2")}｜${describeChatCreateAction(it)}｜${it.title || it.taskId || __tmT("kernel.task")}${it.patchDesc ? `｜${it.patchDesc}` : ''}${it.error ? `｜${it.error}` : ''}`)}</div>`).join('')}
                ${opResults.map((it) => `<div class="tm-ai-item">${esc(`${it.ok ? __tmT("ai.success") : __tmT("ai.failed2")}｜${it.title || it.taskId}${it.patchDesc ? `｜${it.patchDesc}` : ''}${it.error ? `｜${it.error}` : ''}`)}</div>`).join('')}
            </div></div>` : ''}
            ${highlights.length ? `<div class="tm-ai-box"><h4>${__tmT("ai.highlights2")}</h4><div class="tm-ai-list">${highlights.map((it) => `<div class="tm-ai-item">${esc(it)}</div>`).join('')}</div></div>` : ''}
            ${nextActions.length ? `<div class="tm-ai-box"><h4>${__tmT("ai.nextStepSuggestions")}</h4><div class="tm-ai-list">${nextActions.map((it) => `<div class="tm-ai-item">${esc(it)}</div>`).join('')}</div></div>` : ''}
            ${warnings.length ? `<div class="tm-ai-box"><h4>${__tmT("ai.warnings")}</h4><div class="tm-ai-list">${warnings.map((it) => `<div class="tm-ai-item">${esc(it)}</div>`).join('')}</div></div>` : ''}
            <div class="tm-ai-actions">
                <button class="tm-btn tm-btn-secondary" data-ai-action="close">${__tmT("common.close")}</button>
                <button class="tm-btn tm-btn-primary" data-ai-action="copy-answer">${__tmT("ai.copyReply")}</button>
                <button class="tm-btn tm-btn-primary" data-ai-action="open-history">${__tmT("ai.viewRecords")}</button>
                <button class="tm-btn tm-btn-success" data-ai-action="continue">${__tmT("ai.continueChat")}</button>
            </div>
        `);
        const body = modal.querySelector('.tm-ai-modal__body');
        body.addEventListener('click', async (event) => {
            const action = String(event.target?.dataset?.aiAction || '');
            if (!action) return;
            if (action === 'copy-answer') {
                try {
                    await navigator.clipboard.writeText(answer || '');
                    toast(__tmT("ai.aiReplyCopied"), 'success');
                } catch (e) {
                    toast(__tmT("ai.copyFailed"), 'error');
                }
            } else if (action === 'open-history') {
                await showHistory(did);
            } else if (action === 'continue') {
                await openDocChat(did);
            }
        });
    }

    async function showHistory(filterId) {
        const entries = await listHistoryEntries(filterId);
        const currentDocId = String(filterId || bridge()?.getCurrentDocId?.() || '').trim();
        const title = currentDocId ? __tmT("ai.aiRecordsCurrentDocument") : __tmT("ai.aiRecords");
        const emptyHint = currentDocId ? __tmT("ai.theCurrentDocumentHasNoAiChatRecordsYet") : __tmT("ai.noAiChatRecordsYet");
        const modal = setModal(title, `
            <div class="tm-ai-box">
                <h4>${__tmT("ai.recordList")}</h4>
                ${entries.length ? `<div class="tm-ai-list">
                    ${entries.map((it, idx) => `
                        <div class="tm-ai-item">
                            <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
                                <div style="flex:1;min-width:0;">
                                    <div style="font-weight:600;">${esc(historyKindLabel(it.kind))}</div>
                                    <div class="tm-ai-hint">${__tmT("ai.idItems", { id: esc(it.id), value2: it.updatedAt ? ` · ${esc(formatTs(it.updatedAt))}` : '', count: it.count })}</div>
                                    ${it.preview ? `<div style="margin-top:6px;">${esc(it.preview)}</div>` : ''}
                                </div>
                                <div class="tm-ai-actions" style="justify-content:flex-start;">
                                    <button class="tm-btn tm-btn-secondary" data-ai-action="history-open" data-ai-index="${idx}">${__tmT("plugin.open")}</button>
                                    <button class="tm-btn tm-btn-secondary" data-ai-action="history-delete" data-ai-index="${idx}">${__tmT("common.delete")}</button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>` : `<div class="tm-ai-hint">${esc(emptyHint)}</div>`}
            </div>
            <div class="tm-ai-actions">
                <button class="tm-btn tm-btn-secondary" data-ai-action="close">${__tmT("common.close")}</button>
                <button class="tm-btn tm-btn-primary" data-ai-action="refresh-history">${__tmT("ai.refresh")}</button>
                <button class="tm-btn tm-btn-success" data-ai-action="open-chat">${__tmT("ai.aiChat")}</button>
            </div>
        `);
        const body = modal.querySelector('.tm-ai-modal__body');
        body.addEventListener('click', async (event) => {
            const action = String(event.target?.dataset?.aiAction || '');
            if (!action) return;
            if (action === 'refresh-history') {
                await showHistory(filterId);
                return;
            }
            if (action === 'open-chat') {
                await openDocChat(currentDocId || undefined);
                return;
            }
            const index = Number(event.target?.dataset?.aiIndex);
            const entry = Number.isInteger(index) ? entries[index] : null;
            if (!entry) return;
            if (action === 'history-delete') {
                await removeHistory(entry.kind, entry.id);
                toast(__tmT("ai.aiRecordDeleted"), 'success');
                await showHistory(filterId);
                return;
            }
            if (action !== 'history-open') return;
            await openHistoryEntry(entry, filterId);
        });
    }

    async function planSchedule(target) {
        const b = bridge();
        const targetTaskId = typeof target === 'object' ? String(target?.taskId || '').trim() : '';
        const docId0 = typeof target === 'object' ? String(target?.docId || '').trim() : String(target || b.getCurrentDocId?.() || '').trim();
        let docId = docId0;
        if (!docId && targetTaskId) {
            const task = await b.getTaskSnapshot(targetTaskId);
            docId = String(task?.docId || task?.root_id || '').trim();
        }
        if (!docId) throw new Error(__tmT("ai.schedulingTargetDocumentNotFound"));
        const hKey = ['doc-schedule', targetTaskId || docId];
        const history = await loadHistory(hKey[0], hKey[1]);
        const input = await promptInput(__tmT("ai.aiScheduling"), __tmT("ai.eGScheduleTodaySTasksIntoTheCalendar"), __tmT("ai.plansUsingTheCurrentDocumentTasksAndTheDay"), { history });
        if (!input) return;
        setModal(__tmT("ai.aiScheduling"), `<div class="tm-ai-box"><h4>${__tmT("ai.processing2")}</h4><div class="tm-ai-hint">${__tmT("ai.generatingTheSchedulePlanUpToTheFirstTasks")}</div></div>`);
        const doc = await b.getDocumentSnapshot(docId, { limit: 1200 });
        if (!doc) throw new Error(__tmT("ai.failedToReadTheDocument"));
        const dayKey = todayKey();
        const scheduleApi = globalThis.__tmCalendar || null;
        const existing = scheduleApi?.listTaskSchedulesByDay ? await scheduleApi.listTaskSchedulesByDay(dayKey) : [];
        const cfg = getConfig();
        const allowedWindows = Array.isArray(cfg.scheduleWindows) && cfg.scheduleWindows.length ? cfg.scheduleWindows : [{ start: '09:00', end: '18:00', label: '09:00-18:00' }];
        const allTasks = Array.isArray(doc.tasks) ? doc.tasks : [];
        const focusIds = new Set();
        if (targetTaskId) {
            focusIds.add(targetTaskId);
            allTasks.forEach((it) => {
                const tid = String(it?.id || '').trim();
                const pid = String(it?.parent_task_id || '').trim();
                if (tid && (tid === targetTaskId || pid === targetTaskId)) focusIds.add(tid);
            });
        }
        let focusTasks = [];
        try {
            const viewTasks = await ensureCurrentViewTopTasks(true);
            const orderedIds = (Array.isArray(viewTasks) ? viewTasks : []).map((it) => String(it?.id || '').trim()).filter(Boolean);
            if (orderedIds.length) {
                const byId = new Map(allTasks.map((it) => [String(it?.id || '').trim(), it]));
                focusTasks = orderedIds.map((id) => byId.get(id)).filter(Boolean);
            }
        } catch (e) {}
        if (targetTaskId) {
            const targetTask = allTasks.find((it) => String(it?.id || '').trim() === targetTaskId);
            const childTasks = allTasks.filter((it) => String(it?.parent_task_id || '').trim() === targetTaskId);
            const merged = [targetTask, ...childTasks, ...focusTasks].filter(Boolean);
            const seen = new Set();
            focusTasks = merged.filter((it) => {
                const tid = String(it?.id || '').trim();
                if (!tid || seen.has(tid)) return false;
                seen.add(tid);
                return true;
            });
        }
        if (!focusTasks.length) {
            focusTasks = targetTaskId
                ? allTasks.filter((it) => {
                    const tid = String(it?.id || '').trim();
                    const pid = String(it?.parent_task_id || '').trim();
                    return focusIds.has(tid) || !it?.done || pid === targetTaskId;
                }).sort((a, b) => {
                    const aFocus = focusIds.has(String(a?.id || '').trim()) ? 1 : 0;
                    const bFocus = focusIds.has(String(b?.id || '').trim()) ? 1 : 0;
                    return bFocus - aFocus;
                })
                : allTasks.filter((it) => !it?.done);
        }
        const excerpt = buildDocExcerpt(doc, targetTaskId, input.mode);
        const result = await callMiniMaxJson(
            __tmT("ai.youAreATaskSchedulingAssistantOutputOnlyJson"),
            {
                document: { id: doc.id, name: doc.name, path: doc.path, ...excerpt },
                focusTaskId: targetTaskId,
                tasks: focusTasks.slice(0, 5).map(taskLite),
                existingSchedules: (existing || []).slice(0, 80).map((it) => ({
                    title: String(it?.title || '').trim(),
                    taskId: String(it?.taskId || it?.task_id || it?.linkedTaskId || it?.linked_task_id || '').trim(),
                    start: String(it?.start || '').trim(),
                    end: String(it?.end || '').trim(),
                    allDay: !!it?.allDay,
                })),
                allowedWindows: allowedWindows.map((win) => win.label),
                userInstruction: input.instruction,
                today: dayKey,
            },
            { maxTokens: Math.max(1400, getConfig().maxTokens), history, contextMode: input.mode, expectedSchema: 'schedule_plan' }
        );
        const planDate = String(result?.planDate || dayKey).trim() || dayKey;
        const rawTimeBlocks = Array.isArray(result?.timeBlocks) ? result.timeBlocks.map((it) => ({
            taskId: String(it?.taskId || '').trim(),
            title: String(it?.title || '').trim(),
            start: String(it?.start || '').trim(),
            end: String(it?.end || '').trim(),
            allDay: it?.allDay === true,
            reason: String(it?.reason || '').trim(),
        })).filter((it) => it.start && it.end && (it.taskId || it.title)) : [];
        const timeBlocks = [];
        const outOfWindow = [];
        rawTimeBlocks.forEach((item) => {
            const start = parseDateTimeLoose(item.start);
            const end = parseDateTimeLoose(item.end);
            if (!(start instanceof Date) || !(end instanceof Date) || end.getTime() <= start.getTime()) return;
            if (!isBlockWithinWindows(start, end, allowedWindows)) {
                outOfWindow.push(`${item.title || item.taskId || __tmT("kernel.task")}：${item.start} ~ ${item.end}`);
                return;
            }
            timeBlocks.push(item);
        });
        if (!timeBlocks.length) throw new Error(__tmT("ai.theAiDidNotGenerateAUsableSchedule"));
        const unscheduled = Array.isArray(result?.unscheduledTasks) ? result.unscheduledTasks.map((it) => String(it || '').trim()).filter(Boolean) : [];
        const conflicts = Array.isArray(result?.conflicts) ? result.conflicts.map((it) => String(it || '').trim()).filter(Boolean) : [];
        if (outOfWindow.length) conflicts.push(__tmT("ai.schedulesOutsideTheAllowedTimeWindowsWereIgnoredAutomatically", { value1: outOfWindow.join('；') }));
        const assumptions = Array.isArray(result?.assumptions) ? result.assumptions.map((it) => String(it || '').trim()).filter(Boolean) : [];
        await appendHistory(hKey[0], hKey[1], 'user', input.instruction || __tmT("ai.generateASchedulePlanForTheCurrentTasks"));
        await appendHistory(hKey[0], hKey[1], 'assistant', [
            __tmT("ai.planDate", { planDate: planDate }),
            __tmT("ai.scheduleSuggestions"),
            ...timeBlocks.map((it) => `- ${it.title || it.taskId || __tmT("kernel.task")}：${it.start} ~ ${it.end}${it.reason ? `；${it.reason}` : ''}`),
            unscheduled.length ? __tmT("ai.notScheduled", { value1: unscheduled.join('；') }) : '',
            conflicts.length ? __tmT("ai.conflicts", { value1: conflicts.join('；') }) : '',
            assumptions.length ? __tmT("ai.assumptions", { value1: assumptions.join('；') }) : '',
        ].filter(Boolean).join('\n'));
        const modal = setModal(__tmT("ai.aiScheduling"), `
            <div class="tm-ai-box"><h4>${__tmT("ai.planDate2")}</h4><div>${esc(planDate)}</div><div class="tm-ai-hint" style="margin-top:6px;">${__tmT("ai.allowedSchedulingWindows", { value1: esc(allowedWindows.map((win) => win.label).join(' / ')) })}</div></div>
            <div class="tm-ai-box"><h4>${__tmT("ai.scheduleSuggestions2")}</h4><div class="tm-ai-list">${timeBlocks.map((it) => `<div class="tm-ai-item"><div><b>${esc(it.title || it.taskId || __tmT("kernel.task"))}</b></div><div class="tm-ai-hint">${esc(it.start)} ~ ${esc(it.end)}${it.reason ? `；${esc(it.reason)}` : ''}</div></div>`).join('')}</div></div>
            ${unscheduled.length ? `<div class="tm-ai-box"><h4>${__tmT("ai.unscheduledTasks")}</h4><div class="tm-ai-list">${unscheduled.map((it) => `<div class="tm-ai-item">${esc(it)}</div>`).join('')}</div></div>` : ''}
            ${conflicts.length ? `<div class="tm-ai-box"><h4>${__tmT("ai.conflicts2")}</h4><div class="tm-ai-list">${conflicts.map((it) => `<div class="tm-ai-item">${esc(it)}</div>`).join('')}</div></div>` : ''}
            ${assumptions.length ? `<div class="tm-ai-box"><h4>${__tmT("ai.assumptions2")}</h4><div class="tm-ai-list">${assumptions.map((it) => `<div class="tm-ai-item">${esc(it)}</div>`).join('')}</div></div>` : ''}
            <div class="tm-ai-actions">
                <button class="tm-btn tm-btn-secondary" data-ai-action="close">${__tmT("common.close")}</button>
                <button class="tm-btn tm-btn-primary" data-ai-action="continue">${__tmT("ai.continueChat")}</button>
                <button class="tm-btn tm-btn-success" data-ai-action="apply-schedule">${__tmT("ai.writeToCalendar")}</button>
            </div>
        `);
        const body = modal.querySelector('.tm-ai-modal__body');
        body.addEventListener('click', async (event) => {
            const action = String(event.target?.dataset?.aiAction || '');
            if (!action) return;
            if (action === 'continue') {
                await planSchedule(targetTaskId ? { taskId: targetTaskId, docId } : docId);
                return;
            }
            if (action !== 'apply-schedule') return;
            const cal = globalThis.__tmCalendar;
            if (!cal?.addTaskSchedule) throw new Error(__tmT("ai.calendarModuleIsNotLoaded"));
            for (const item of timeBlocks) {
                const start = parseDateTimeLoose(item.start);
                const end = parseDateTimeLoose(item.end);
                if (!(start instanceof Date) || !(end instanceof Date) || end.getTime() <= start.getTime()) continue;
                await cal.addTaskSchedule({
                    taskId: item.taskId,
                    title: item.title || item.taskId || __tmT("kernel.task"),
                    start,
                    end,
                    calendarId: 'default',
                    durationMin: Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000)),
                    allDay: !!item.allDay,
                    refresh: false,
                });
            }
            try {
                if (typeof cal.requestRefresh === 'function') {
                    await cal.requestRefresh({
                        reason: 'ai-apply-schedule',
                        main: true,
                        side: true,
                        flushTaskPanel: true,
                    });
                } else {
                    await cal.refreshInPlace?.({ silent: false });
                }
            } catch (e) {}
            toast(__tmT("ai.writtenToCalendar"), 'success');
            closeModal();
        });
    }

    function getConversationDraft(id) {
        const key = String(id || '').trim();
        if (!key) return { chat: '', smart: '', schedule: '' };
        if (!aiRuntime.drafts.has(key)) aiRuntime.drafts.set(key, { chat: '', smart: '', schedule: '' });
        return aiRuntime.drafts.get(key);
    }

    function renderChatPromptTemplateBar() {
        const templates = PromptTemplateStore.list();
        const activeId = PromptTemplateStore.get(aiRuntime.chatPromptTemplateId) ? aiRuntime.chatPromptTemplateId : '';
        const active = activeId ? PromptTemplateStore.get(activeId) : null;
        return `
            <div class="tm-ai-sidebar__promptbar">
                <div class="tm-ai-sidebar__promptbar-row">
                    <select class="tm-rule-select tm-ai-sidebar__promptbar-select" data-ai-sidebar-field="chatPromptTemplate">
                        <option value="">${__tmT("ai.selectAPromptTemplate")}</option>
                        ${templates.map((item) => `<option value="${esc(item.id)}" ${item.id === activeId ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}
                    </select>
                    <button class="tm-btn tm-btn-secondary" data-ai-sidebar-action="new-prompt-template">${__tmT("ai.new")}</button>
                    <button class="tm-btn tm-btn-secondary" data-ai-sidebar-action="save-prompt-template">${__tmT("common.save")}</button>
                    <button class="tm-btn tm-btn-secondary" data-ai-sidebar-action="rename-prompt-template" ${active ? '' : 'disabled'}>${__tmT("ai.rename")}</button>
                    <button class="tm-btn tm-btn-gray" data-ai-sidebar-action="delete-prompt-template" ${active ? '' : 'disabled'}>${__tmT("common.delete")}</button>
                </div>
                <div class="tm-ai-sidebar__promptbar-meta">
                    ${active
                        ? __tmT("ai.currentTemplate", { name: esc(active.name) })
                        : __tmT("ai.noTemplateBoundYetEnterContentFirstThenClick")}
                </div>
            </div>
        `;
    }

    function formatSchedulePlannerSummary(planner) {
        const value = normalizePlannerOptions(planner);
        const dateLabel = formatPlannerDateRange(value.planDate || todayKey(), value.planDateTo || value.planDate || todayKey());
        const breakHours = Number(value.breakHours || 0);
        const gapMinutes = Number(value.gapMinutes || 0);
        const maxTasks = Number(value.maxTasks || 0);
        return __tmT("ai.hDowntimeMGapsMax", { dateLabel: dateLabel, breakHours: breakHours, gapMinutes: gapMinutes, maxTasks: maxTasks });
    }

    async function applyChatPromptTemplateToConversation(conversationId, templateId) {
        const current = await getConversation(conversationId);
        if (!current) return null;
        const template = PromptTemplateStore.get(templateId);
        setActiveChatPromptTemplateId(template?.id || '');
        const draft = getConversationDraft(current.id);
        if (template) {
            draft.chat = String(template.content || '');
            toast(__tmT("ai.promptLoaded", { name: template.name }), 'success');
        }
        return template || null;
    }

    async function ensureCurrentViewTasks(force) {
        if (!force && Array.isArray(aiRuntime.currentViewTasks) && aiRuntime.currentViewTasks.length) return aiRuntime.currentViewTasks;
        const list = await bridge()?.getCurrentViewTasks?.(80);
        aiRuntime.currentViewTasks = Array.isArray(list) ? list.filter(Boolean) : [];
        aiRuntime.currentViewTopTasks = [];
        return aiRuntime.currentViewTasks;
    }

    async function ensureCurrentGroupTasks(force, options = {}) {
        const includeDone = !!options?.includeDone;
        const groupKey = String(bridge()?.getCurrentGroupId?.() || 'all').trim() || 'all';
        if (includeDone) {
            if (!force && aiRuntime.currentGroupTaskAllKey === groupKey && Array.isArray(aiRuntime.currentGroupTasksAll) && aiRuntime.currentGroupTasksAll.length) return aiRuntime.currentGroupTasksAll;
            const list = await bridge()?.getCurrentGroupTasks?.(0, { includeDone: true });
            aiRuntime.currentGroupTasksAll = Array.isArray(list) ? list.filter(Boolean) : [];
            aiRuntime.currentGroupTaskAllKey = groupKey;
            return aiRuntime.currentGroupTasksAll;
        }
        if (!force && aiRuntime.currentGroupTaskKey === groupKey && Array.isArray(aiRuntime.currentGroupTasks) && aiRuntime.currentGroupTasks.length) return aiRuntime.currentGroupTasks;
        const list = await bridge()?.getCurrentGroupTasks?.(0);
        aiRuntime.currentGroupTasks = Array.isArray(list) ? list.filter(Boolean) : [];
        aiRuntime.currentGroupTaskKey = groupKey;
        return aiRuntime.currentGroupTasks;
    }

    async function ensureCurrentViewTopTasks(force) {
        if (!force && Array.isArray(aiRuntime.currentViewTopTasks) && aiRuntime.currentViewTopTasks.length) return aiRuntime.currentViewTopTasks;
        const tasks = await ensureCurrentViewTasks(force);
        const taskCache = new Map();
        (Array.isArray(tasks) ? tasks : []).forEach((task) => {
            const id = getTaskId(task);
            if (id) taskCache.set(id, task);
        });
        const loadTask = async (taskId) => {
            const id = String(taskId || '').trim();
            if (!id) return null;
            if (taskCache.has(id)) return taskCache.get(id);
            try {
                const task = await bridge()?.getTaskSnapshot?.(id);
                if (task && typeof task === 'object') {
                    taskCache.set(id, task);
                    return task;
                }
            } catch (e) {}
            return null;
        };
        const resolveTopTask = async (task) => {
            let current = task;
            let currentId = getTaskId(task);
            const visited = new Set();
            for (let i = 0; i < 24 && currentId && !visited.has(currentId); i += 1) {
                visited.add(currentId);
                const parentId = getTaskParentId(current);
                if (!parentId) return current;
                currentId = parentId;
                current = await loadTask(currentId);
                if (!current) break;
            }
            return task;
        };
        const seen = new Set();
        const ordered = [];
        for (const task of Array.isArray(tasks) ? tasks : []) {
            const topTask = await resolveTopTask(task);
            const topId = getTaskId(topTask);
            if (!topId || seen.has(topId)) continue;
            seen.add(topId);
            ordered.push(clone(topTask));
        }
        aiRuntime.currentViewTopTasks = ordered.filter(Boolean);
        return aiRuntime.currentViewTopTasks;
    }

    async function resolveDocLabel(docId) {
        const id = String(docId || '').trim();
        if (!id) return '';
        if (aiRuntime.labelCache.doc.has(id)) return aiRuntime.labelCache.doc.get(id);
        let label = id;
        try {
            const doc = await bridge()?.getDocumentSnapshot?.(id, { limit: 80 });
            label = String(doc?.name || id).trim() || id;
        } catch (e) {}
        aiRuntime.labelCache.doc.set(id, label);
        return label;
    }

    async function resolveTaskLabel(taskId) {
        const id = String(taskId || '').trim();
        if (!id) return '';
        if (aiRuntime.labelCache.task.has(id)) return aiRuntime.labelCache.task.get(id);
        let label = id;
        try {
            const task = await bridge()?.getTaskSnapshot?.(id);
            label = String(task?.content || id).trim() || id;
        } catch (e) {}
        aiRuntime.labelCache.task.set(id, label);
        return label;
    }

    async function warmConversationLabels(conversation) {
        const session = normalizeConversation(conversation || {});
        const work = [];
        session.selectedDocIds.slice(0, 4).forEach((docId) => work.push(resolveDocLabel(docId)));
        session.selectedTaskIds.slice(0, 12).forEach((taskId) => work.push(resolveTaskLabel(taskId)));
        await Promise.all(work).catch(() => null);
    }

    function conversationHistoryToPrompt(messages) {
        return (Array.isArray(messages) ? messages : [])
            .filter((it) => it?.role === 'user' || it?.role === 'assistant')
            .slice(-12)
            .map((it) => ({ role: it.role, content: it.content }));
    }

    async function ensureConversationDefaults(conversation, options = {}) {
        const current = normalizeConversation(conversation || {});
        const b = bridge();
        const patch = {};
        const force = !!options.force;
        if (current.contextScope === 'none') {
            if (current.selectedDocIds.length > 0) patch.selectedDocIds = [];
            if (current.selectedTaskIds.length > 0) patch.selectedTaskIds = [];
        }
        if (current.contextScope === 'current_doc') {
            const docId = String(options.docId || b?.getCurrentDocId?.() || '').trim();
            const currentDocIds = current.selectedDocIds.map((it) => String(it || '').trim()).filter(Boolean);
            if (docId && (force || !(currentDocIds.length === 1 && currentDocIds[0] === docId))) patch.selectedDocIds = [docId];
            if (current.selectedTaskIds.length > 0) patch.selectedTaskIds = [];
        }
        if (current.contextScope === 'current_task') {
            const taskId = String(options.taskId || b?.getCurrentTaskId?.() || '').trim();
            const currentTaskIds = current.selectedTaskIds.map((it) => String(it || '').trim()).filter(Boolean);
            if (taskId && (force || !(currentTaskIds.length === 1 && currentTaskIds[0] === taskId))) patch.selectedTaskIds = [taskId];
            if (current.selectedDocIds.length > 0) patch.selectedDocIds = [];
        }
        if (current.contextScope === 'current_view') {
            const maxTasks = conversationTaskLimit(current);
            const viewTasks = await ensureCurrentViewTopTasks(force || !!options.refreshView);
            const nextIds = viewTasks
                .filter((task) => !task?.done)
                .slice(0, maxTasks || AI_DEFAULT_PLANNER_OPTIONS.maxTasks)
                .map((task) => String(task?.id || '').trim())
                .filter(Boolean);
            const currentIds = current.selectedTaskIds.map((it) => String(it || '').trim()).filter(Boolean);
            const validSet = new Set(nextIds);
            const keepCurrentSelection = !force && currentIds.length > 0 && currentIds.every((id) => validSet.has(id));
            if (!keepCurrentSelection) patch.selectedTaskIds = nextIds;
            if (current.selectedDocIds.length > 0) patch.selectedDocIds = [];
        }
        if (current.contextScope === 'current_group') {
            const groupTasks = await ensureCurrentGroupTasks(force || !!options.refreshView);
            const nextIds = groupTasks
                .filter((task) => !task?.done)
                .map((task) => String(task?.id || '').trim())
                .filter(Boolean);
            const currentIds = current.selectedTaskIds.map((it) => String(it || '').trim()).filter(Boolean);
            const validSet = new Set(nextIds);
            const keepCurrentSelection = !force && currentIds.length > 0 && currentIds.every((id) => validSet.has(id));
            if (!keepCurrentSelection) patch.selectedTaskIds = nextIds;
            if (current.selectedDocIds.length > 0) patch.selectedDocIds = [];
        }
        if (current.type === 'schedule') {
            patch.plannerOptions = {
                ...normalizePlannerOptions(current.plannerOptions),
                planDate: normalizeDateKey(current.plannerOptions?.planDate || todayKey()) || todayKey(),
                planDateTo: normalizeDateKey(current.plannerOptions?.planDateTo || current.plannerOptions?.planDate || todayKey()) || normalizeDateKey(current.plannerOptions?.planDate || todayKey()) || todayKey(),
            };
        }
        if (Object.keys(patch).length) return await updateConversation(current.id, patch);
        return current;
    }

    async function inferDocIdsFromConversation(conversation) {
        const session = normalizeConversation(conversation || {});
        if (session.contextScope === 'none') return [];
        const out = Array.from(new Set(session.selectedDocIds.map((it) => String(it || '').trim()).filter(Boolean)));
        if (out.length) return out;
        if (session.contextScope === 'current_doc') {
            const did = String(bridge()?.getCurrentDocId?.() || '').trim();
            if (did) return [did];
        }
        if (session.contextScope === 'current_task' || session.selectedTaskIds.length) {
            for (const taskId of session.selectedTaskIds) {
                try {
                    const task = await bridge()?.getTaskSnapshot?.(taskId);
                    const docId = String(task?.docId || task?.root_id || '').trim();
                    if (docId) out.push(docId);
                } catch (e) {}
            }
        }
        return Array.from(new Set(out.filter(Boolean)));
    }

    async function inferTaskIdsFromConversation(conversation) {
        const session = normalizeConversation(conversation || {});
        if (session.contextScope === 'none') return [];
        if (session.selectedTaskIds.length) return Array.from(new Set(session.selectedTaskIds));
        if (session.contextScope === 'current_task') {
            const taskId = String(bridge()?.getCurrentTaskId?.() || '').trim();
            return taskId ? [taskId] : [];
        }
        if (session.contextScope === 'current_group') {
            const groupTasks = await ensureCurrentGroupTasks(false);
            return groupTasks
                .filter((task) => !task?.done)
                .map((task) => String(task?.id || '').trim())
                .filter(Boolean);
        }
        if (session.contextScope === 'current_view' || session.type === 'schedule') {
            const viewTasks = await ensureCurrentViewTopTasks(false);
            const maxTasks = conversationTaskLimit(session);
            return viewTasks
                .filter((task) => !task?.done)
                .slice(0, maxTasks || AI_DEFAULT_PLANNER_OPTIONS.maxTasks)
                .map((task) => String(task?.id || '').trim())
                .filter(Boolean);
        }
        return [];
    }

    async function getSelectedTaskSnapshots(taskIds) {
        const out = [];
        for (const id0 of Array.isArray(taskIds) ? taskIds : []) {
            const id = String(id0 || '').trim();
            if (!id) continue;
            try {
                const task = await bridge()?.getTaskSnapshot?.(id);
                if (task) out.push(task);
            } catch (e) {}
        }
        return out;
    }

    async function getPrimaryDocumentSnapshot(conversation, options = {}) {
        const session = normalizeConversation(conversation || {});
        if (session.contextScope === 'none') return null;
        let docIds = await inferDocIdsFromConversation(conversation);
        if (!docIds.length && options.taskId) {
            const task = await bridge()?.getTaskSnapshot?.(options.taskId);
            const docId = String(task?.docId || task?.root_id || '').trim();
            if (docId) docIds = [docId];
        }
        const docId = String(docIds[0] || '').trim();
        if (!docId) return null;
        return await bridge()?.getDocumentSnapshot?.(docId, { limit: 1400 });
    }

    function summarizeSmartResult(result) {
        const report = (result && typeof result === 'object') ? result : {};
        const lines = [];
        if (report?.summary) lines.push(String(report.summary).trim());
        if (Array.isArray(report?.taskAnalyses) && report.taskAnalyses.length) lines.push(__tmT("ai.perTaskSuggestions", { length: report.taskAnalyses.length }));
        if (Array.isArray(report?.taskSuggestions) && report.taskSuggestions.length) lines.push(__tmT("ai.newSuggestedTasks", { length: report.taskSuggestions.length }));
        return lines.filter(Boolean).join('\n');
    }

    function summarizeScheduleResult(result) {
        const plan = (result && typeof result === 'object') ? result : {};
        const blocks = Array.isArray(plan?.timeBlocks) ? plan.timeBlocks : [];
        if (!blocks.length) return __tmT("ai.theAiDidNotGenerateAUsableSchedule");
        const dateLabel = formatPlannerDateRange(plan.planDate || todayKey(), plan.planDateTo || plan.planDate || todayKey());
        return [__tmT("ai.planRange", { dateLabel: dateLabel }), ...blocks.map((it) => `- ${it.title || it.taskId || __tmT("kernel.task")}：${it.start} ~ ${it.end}`)].join('\n');
    }

    async function buildSummaryCandidateTasks(conversation) {
        const session = normalizeConversation(conversation || {});
        const summary = resolveSummaryRange(session.summaryOptions);
        const maxTasks = summary.maxTasks || AI_DEFAULT_SUMMARY_OPTIONS.maxTasks;
        const summaryTaskLimit = Math.max(maxTasks, 120);
        let tasks = [];
        if (session.contextScope === 'manual' && session.selectedTaskIds.length) {
            tasks = await getSelectedTaskSnapshots(session.selectedTaskIds);
        } else if (session.contextScope === 'current_group') {
            const visibleTasks = await bridge()?.getCurrentFilteredTasks?.(0);
            const groupDocIds = await bridge()?.getCurrentGroupDocIds?.();
            const groupTasks = await bridge()?.getSummaryTasksByDocIds?.(groupDocIds, { ignoreExcludeCompleted: true });
            tasks = mergeSummaryTasks(visibleTasks, groupTasks).slice(0, summaryTaskLimit);
        } else if (session.contextScope === 'current_view') {
            const viewTasks = await bridge()?.getCurrentFilteredTasks?.(0);
            const viewDocIds = Array.from(new Set((Array.isArray(viewTasks) ? viewTasks : []).map((task) => String(task?.docId || task?.root_id || '').trim()).filter(Boolean)));
            const summaryTasks = await bridge()?.getSummaryTasksByDocIds?.(viewDocIds, { ignoreExcludeCompleted: true });
            tasks = mergeSummaryTasks(viewTasks, summaryTasks).slice(0, summaryTaskLimit);
        } else if (session.contextScope === 'current_task') {
            const selectedIds = await inferTaskIdsFromConversation(session);
            const seedId = String(selectedIds[0] || '').trim();
            const doc = await getPrimaryDocumentSnapshot({ ...session, selectedTaskIds: seedId ? [seedId] : selectedIds }, { taskId: seedId });
            const allTasks = Array.isArray(doc?.tasks) ? doc.tasks : [];
            const wanted = new Set(selectedIds.map((it) => String(it || '').trim()).filter(Boolean));
            if (seedId) {
                allTasks.forEach((task) => {
                    const tid = String(task?.id || '').trim();
                    const pid = String(task?.parent_task_id || '').trim();
                    if (tid && (wanted.has(tid) || wanted.has(pid))) wanted.add(tid);
                });
            }
            tasks = allTasks.filter((task) => wanted.has(String(task?.id || '').trim()));
        } else {
            const doc = await getPrimaryDocumentSnapshot(session);
            tasks = Array.isArray(doc?.tasks) && doc.tasks.length ? doc.tasks : extractTasksFromKramdown(doc);
        }
        const byId = new Map();
        (Array.isArray(tasks) ? tasks : []).forEach((task) => {
            const tid = String(task?.id || '').trim();
            if (tid && !byId.has(tid)) byId.set(tid, task);
        });
        const allTasks = Array.from(byId.values());
        const rangedTasks = allTasks.filter((task) => taskTouchesSummaryRange(task, summary));
        const fallbackTasks = rangedTasks.length ? rangedTasks : allTasks;
        return {
            summary,
            allTasks: allTasks.slice(0, summaryTaskLimit),
            rangedTasks: rangedTasks.slice(0, summaryTaskLimit),
            selectedTasks: fallbackTasks.slice(0, maxTasks),
        };
    }

    function summarizeSummaryResult(result) {
        const report = (result && typeof result === 'object') ? result : {};
        const lines = [];
        if (report?.title) lines.push(String(report.title).trim());
        if (report?.rangeLabel) lines.push(report.rangeLabel);
        if (report?.summary) lines.push(String(report.summary).trim());
        if (report?.stats?.included) lines.push(__tmT("ai.includedTasks", { included: report.stats.included }));
        return lines.filter(Boolean).join('\n');
    }

    function buildSummaryDebugMessage(summary, tasks, rangedTasks, extra = {}) {
        const range = resolveSummaryRange(summary);
        const list = Array.isArray(tasks) ? tasks : [];
        const ranged = Array.isArray(rangedTasks) ? rangedTasks : [];
        const samples = list.slice(0, 6).map((task) => {
            const updatedRaw = String(task?.updated || task?.updatedAt || task?.updateTime || task?.update_time || '').trim();
            const updatedKey = resolveTaskUpdatedDateKey(task);
            const hit = taskTouchesSummaryRange(task, range);
            return `${String(task?.content || task?.id || __tmT("kernel.task")).trim() || __tmT("kernel.task")} | done=${task?.done ? '1' : '0'} | updated=${updatedRaw || '-'} | parsed=${updatedKey || '-'} | hit=${hit ? '1' : '0'}`;
        });
        return [
            __tmT("ai.noSummarizableTasksInTheCurrentRange"),
            __tmT("ai.range", { dateFrom: range.dateFrom, dateTo: range.dateTo }),
            __tmT("ai.candidates", { length: list.length }),
            __tmT("ai.matched", { length: ranged.length }),
            extra?.contextScope ? __tmT("ai.context", { contextScope: extra.contextScope }) : '',
            extra?.docCount !== undefined ? __tmT("ai.documents2", { docCount: extra.docCount }) : '',
            samples.length ? __tmT("ai.samples", { value1: samples.join(' || ') }) : __tmT("ai.samplesNone"),
        ].filter(Boolean).join('；');
    }

    function mergeSummaryTasks(...groups) {
        const map = new Map();
        groups.forEach((group) => {
            (Array.isArray(group) ? group : []).forEach((task) => {
                const tid = String(task?.id || '').trim();
                if (!tid || map.has(tid)) return;
                map.set(tid, task);
            });
        });
        return Array.from(map.values());
    }

    async function runSummaryConversation(conversationId) {
        const session0 = await getConversation(conversationId);
        if (!session0) throw new Error(__tmT("ai.conversationNotFound"));
        const draft = getConversationDraft(session0.id);
        let session = await ensureConversationDefaults(session0);
        const { summary, allTasks, rangedTasks, selectedTasks } = await buildSummaryCandidateTasks(session);
        if (!allTasks.length) {
            let docCount = 0;
            try {
                if (session.contextScope === 'current_group') docCount = (await bridge()?.getCurrentGroupDocIds?.())?.length || 0;
                else if (session.contextScope === 'current_view') {
                    const viewTasks = await ensureCurrentViewTopTasks(false);
                    docCount = Array.from(new Set((Array.isArray(viewTasks) ? viewTasks : []).map((task) => String(task?.docId || task?.root_id || '').trim()).filter(Boolean))).length;
                } else {
                    docCount = (await inferDocIdsFromConversation(session)).length;
                }
            } catch (e) {}
            throw new Error(buildSummaryDebugMessage(summary, allTasks, rangedTasks, { contextScope: session.contextScope, docCount }));
        }
        const doc = await getPrimaryDocumentSnapshot(session, { taskId: selectedTasks[0]?.id || allTasks[0]?.id || '' });
        const excerpt = buildDocExcerpt(doc, selectedTasks[0]?.id || '', session.contextMode);
        const presetLabel = summary.preset === 'weekly' ? __tmT("kernel.weeklyReport") : (summary.preset === 'custom' ? __tmT("ai.summary3") : __tmT("ai.dailyReport"));
        const instruction = String(draft.summary || '').trim() || __tmT("ai.generateAutomaticallySelectRelevantTasksWithinTreatATask", { presetLabel: presetLabel, dateFrom: summary.dateFrom, value3: summary.dateFrom === summary.dateTo ? '' : __tmT("ai.to", { dateTo: summary.dateTo }) });
        const result = await callMiniMaxJson(
            __tmT("ai.youAreAWorkReviewAndReportingAssistantFirst"),
            {
                conversationType: session.type,
                contextScope: session.contextScope,
                reportPreset: summary.preset,
                dateRange: { from: summary.dateFrom, to: summary.dateTo, label: summary.label },
                document: doc ? { id: doc.id, name: doc.name, path: doc.path, ...excerpt } : null,
                tasks: allTasks.slice(0, Math.max(summary.maxTasks, 120)).map(taskLite),
                suggestedTasks: selectedTasks.slice(0, summary.maxTasks).map(taskLite),
                userInstruction: instruction,
            },
            {
                history: conversationHistoryToPrompt(session.messages),
                contextMode: session.contextMode,
                expectedSchema: 'work_summary',
                maxTokens: Math.max(1800, getConfig().maxTokens),
                timeoutMs: 50000,
            }
        );
        const includedIds = Array.isArray(result?.includedTaskIds) ? result.includedTaskIds.map((it) => String(it || '').trim()).filter(Boolean) : [];
        const includedSet = new Set(includedIds);
        const fallbackIncluded = includedIds.length ? allTasks.filter((task) => includedSet.has(String(task?.id || '').trim())) : selectedTasks;
        const report = {
            conversationId: session.id,
            preset: summary.preset,
            dateFrom: summary.dateFrom,
            dateTo: summary.dateTo,
            rangeLabel: summary.label,
            title: String(result?.title || `${presetLabel} · ${summary.dateFrom === summary.dateTo ? summary.dateFrom : `${summary.dateFrom} ~ ${summary.dateTo}`}`).trim(),
            summary: String(result?.summary || '').trim(),
            completedHighlights: Array.isArray(result?.completedHighlights) ? result.completedHighlights.map((it) => String(it || '').trim()).filter(Boolean) : [],
            progressHighlights: Array.isArray(result?.progressHighlights) ? result.progressHighlights.map((it) => String(it || '').trim()).filter(Boolean) : [],
            risks: Array.isArray(result?.risks) ? result.risks.map((it) => String(it || '').trim()).filter(Boolean) : [],
            nextSteps: Array.isArray(result?.nextSteps) ? result.nextSteps.map((it) => String(it || '').trim()).filter(Boolean) : [],
            notes: Array.isArray(result?.notes) ? result.notes.map((it) => String(it || '').trim()).filter(Boolean) : [],
            includedTaskIds: fallbackIncluded.map((task) => String(task?.id || '').trim()).filter(Boolean),
            stats: {
                candidate: Math.max(Number(result?.stats?.candidate || 0), allTasks.length),
                included: fallbackIncluded.length,
                done: fallbackIncluded.filter((task) => !!task?.done).length,
                todo: fallbackIncluded.filter((task) => !task?.done).length,
            },
            reportMarkdown: String(result?.reportMarkdown || '').trim(),
        };
        session = await appendConversationMessage(session.id, 'user', instruction, { scene: 'summary', summary });
        session = await appendConversationMessage(session.id, 'assistant', summarizeSummaryResult(report), { scene: 'summary', report });
        draft.summary = '';
        await updateConversation(session.id, {
            title: String(session0.title || '').trim() || `${AI_SCENE_LABELS.summary} · ${doc?.name || summary.label}`,
            lastResult: report,
            summaryOptions: summary,
        });
        return await getConversation(session.id);
    }

    async function runChatConversation(conversationId) {
        const session0 = await getConversation(conversationId);
        if (!session0) throw new Error(__tmT("ai.conversationNotFound"));
        const draft = getConversationDraft(session0.id);
        const instruction = String(draft.chat || '').trim();
        if (!instruction) throw new Error(__tmT("ai.enterAChatMessage"));
        let session = await ensureConversationDefaults(session0);
        const turnContext = await buildChatSkillTurnContext(session, instruction);
        const loopResult = await runChatSkillLoop(turnContext);
        const finalResult = await synthesizeChatSkillLoopResult(turnContext, loopResult);
        const answer = String(finalResult?.answer || '').trim() || __tmT("ai.theAiReturnedNoContent2");
        const highlights = Array.isArray(finalResult?.highlights) ? finalResult.highlights : [];
        const nextActions = Array.isArray(finalResult?.nextActions) ? finalResult.nextActions : [];
        const warnings = Array.isArray(finalResult?.warnings) ? finalResult.warnings.slice() : [];
        (Array.isArray(loopResult?.warnings) ? loopResult.warnings : []).forEach((item) => warnings.push(String(item || '').trim()));
        (Array.isArray(loopResult?.rounds) ? loopResult.rounds : []).forEach((round) => {
            (Array.isArray(round?.results) ? round.results : []).forEach((skillResult) => {
                if (!skillResult?.ok && skillResult?.error) warnings.push(`${skillResult.skill || 'skill'}：${skillResult.error}`);
            });
        });
        const dedupWarnings = Array.from(new Set(warnings.map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 10);
        session = await appendConversationMessage(session.id, 'user', instruction, { scene: 'chat' });
        session = await appendConversationMessage(session.id, 'assistant', [
            answer,
            Array.isArray(loopResult?.plan) && loopResult.plan.length ? __tmT("ai.executionPlan", { value1: loopResult.plan.join('；') }) : '',
            highlights.length ? __tmT("ai.highlights", { value1: highlights.join('；') }) : '',
            nextActions.length ? __tmT("ai.nextSteps", { value1: nextActions.join('；') }) : '',
            dedupWarnings.length ? __tmT("ai.reminder", { value1: dedupWarnings.join('；') }) : '',
        ].filter(Boolean).join('\n\n'), { scene: 'chat', answer, highlights, nextActions, warnings: dedupWarnings });
        draft.chat = '';
        await updateConversation(session.id, {
            title: String(session0.title || '').trim() || `${AI_SCENE_LABELS.chat} · ${turnContext?.doc?.name || __tmT("kernel.untitledDocument")}`,
            lastResult: {
                type: 'chat',
                answer,
                plan: Array.isArray(loopResult?.plan) ? loopResult.plan : [],
                highlights,
                nextActions,
                warnings: dedupWarnings,
                conversationId: session.id,
                skillTrace: Array.isArray(loopResult?.rounds) ? loopResult.rounds : [],
                availableReadSkills: groupAvailableChatSkills(loopResult?.availableSkills).read,
                availableWriteSkills: groupAvailableChatSkills(loopResult?.availableSkills).write,
                stopReason: String(loopResult?.stopReason || '').trim(),
                done: !!loopResult?.done,
            },
        });
        return await getConversation(session.id);
    }

    function normalizeSmartTaskAnalysis(item = {}) {
        const dims = item?.scores?.byDimension || item?.smartScore?.byDimension || {};
        return {
            taskId: String(item?.taskId || '').trim(),
            currentTitle: String(item?.currentTitle || '').trim(),
            suggestedTitle: String(item?.suggestedTitle || '').trim(),
            issues: Array.isArray(item?.issues) ? item.issues.map((it) => String(it || '').trim()).filter(Boolean) : [],
            suggestions: Array.isArray(item?.suggestions) ? item.suggestions.map((it) => String(it || '').trim()).filter(Boolean) : [],
            newTaskSuggestion: String(item?.newTaskSuggestion || '').trim(),
            score: {
                overall: clamp(item?.score?.overall || item?.smartScore?.overall || 0, 0, 100),
                byDimension: {
                    specific: clamp(dims?.specific || 0, 0, 100),
                    measurable: clamp(dims?.measurable || 0, 0, 100),
                    achievable: clamp(dims?.achievable || 0, 0, 100),
                    relevant: clamp(dims?.relevant || 0, 0, 100),
                    timeBound: clamp(dims?.timeBound || 0, 0, 100),
                },
            },
        };
    }

    async function runSmartConversation(conversationId) {
        const session0 = await getConversation(conversationId);
        if (!session0) throw new Error(__tmT("ai.conversationNotFound"));
        const draft = getConversationDraft(session0.id);
        const instruction = String(draft.smart || '').trim() || __tmT("ai.checkWhetherTheCurrentProjectAndTasksFollowThe");
        let session = await ensureConversationDefaults(session0);
        const doc = await getPrimaryDocumentSnapshot(session);
        if (!doc) throw new Error(__tmT("ai.documentToAnalyzeNotFound"));
        const docTasks = Array.isArray(doc.tasks) ? doc.tasks : [];
        const extractedTasks = extractTasksFromKramdown(doc);
        const structuredTasks = (docTasks.length ? docTasks : extractedTasks).slice(0, 60);
        const excerpt = buildDocExcerpt(doc, '', session.contextMode);
        const result = await callMiniMaxJson(
            __tmT("ai.youAreAProjectManagementConsultantOutputOnlyJson2"),
            {
                document: { id: doc.id, name: doc.name, path: doc.path, ...excerpt },
                tasks: structuredTasks.map(taskLite),
                taskCount: structuredTasks.length,
                userInstruction: instruction,
            },
            {
                history: conversationHistoryToPrompt(session.messages),
                contextMode: session.contextMode,
                expectedSchema: 'smart_analysis',
                maxTokens: Math.max(1800, getConfig().maxTokens),
                timeoutMs: 50000,
            }
        );
        const report = {
            conversationId: session.id,
            document: { id: doc.id, name: doc.name, path: doc.path },
            summary: String(result?.summary || '').trim(),
            smartScore: {
                overall: clamp(result?.smartScore?.overall || 0, 0, 100),
                byDimension: {
                    specific: clamp(result?.smartScore?.byDimension?.specific || 0, 0, 100),
                    measurable: clamp(result?.smartScore?.byDimension?.measurable || 0, 0, 100),
                    achievable: clamp(result?.smartScore?.byDimension?.achievable || 0, 0, 100),
                    relevant: clamp(result?.smartScore?.byDimension?.relevant || 0, 0, 100),
                    timeBound: clamp(result?.smartScore?.byDimension?.timeBound || 0, 0, 100),
                },
            },
            strengths: Array.isArray(result?.strengths) ? result.strengths.map((it) => String(it || '').trim()).filter(Boolean) : [],
            issues: Array.isArray(result?.issues) ? result.issues.map((it) => String(it || '').trim()).filter(Boolean) : [],
            missingInfo: Array.isArray(result?.missingInfo) ? result.missingInfo.map((it) => String(it || '').trim()).filter(Boolean) : [],
            taskSuggestions: Array.isArray(result?.taskSuggestions) ? result.taskSuggestions.map((it) => String(it || '').trim()).filter(Boolean) : [],
            milestoneSuggestions: Array.isArray(result?.milestoneSuggestions) ? result.milestoneSuggestions.map((it) => String(it || '').trim()).filter(Boolean) : [],
            scheduleHints: Array.isArray(result?.scheduleHints) ? result.scheduleHints.map((it) => String(it || '').trim()).filter(Boolean) : [],
            taskAnalyses: Array.isArray(result?.taskAnalyses) ? result.taskAnalyses.map(normalizeSmartTaskAnalysis).filter((it) => it.taskId || it.currentTitle) : [],
        };
        session = await appendConversationMessage(session.id, 'user', instruction, { scene: 'smart' });
        session = await appendConversationMessage(session.id, 'assistant', summarizeSmartResult(report), { scene: 'smart', report });
        draft.smart = '';
        await updateConversation(session.id, {
            title: String(session0.title || '').trim() || `${AI_SCENE_LABELS.smart} · ${doc.name || __tmT("kernel.untitledDocument")}`,
            lastResult: report,
        });
        return await getConversation(session.id);
    }

    async function buildScheduleCandidateTasks(conversation) {
        const session = normalizeConversation(conversation || {});
        const planner = normalizePlannerOptions(session.plannerOptions);
        const viewTasks = await ensureCurrentViewTopTasks(false);
        let selectedIds = Array.from(new Set(session.selectedTaskIds.map((it) => String(it || '').trim()).filter(Boolean)));
        if (!selectedIds.length && session.contextScope === 'current_task') {
            const rootTaskId = String(bridge()?.getCurrentTaskId?.() || '').trim();
            if (rootTaskId) {
                selectedIds.push(rootTaskId);
                try {
                    const doc = await getPrimaryDocumentSnapshot({ ...session, selectedTaskIds: [rootTaskId] }, { taskId: rootTaskId });
                    (Array.isArray(doc?.tasks) ? doc.tasks : []).forEach((task) => {
                        const tid = String(task?.id || '').trim();
                        const pid = String(task?.parent_task_id || '').trim();
                        if (tid && pid === rootTaskId) selectedIds.push(tid);
                    });
                } catch (e) {}
            }
        }
        if (!selectedIds.length) {
            selectedIds = viewTasks.filter((task) => !task?.done).slice(0, planner.maxTasks || AI_DEFAULT_PLANNER_OPTIONS.maxTasks).map((task) => String(task?.id || '').trim()).filter(Boolean);
        }
        return {
            orderedTasks: viewTasks,
            selectedTaskIds: selectedIds,
            selectedTasks: await getSelectedTaskSnapshots(selectedIds),
        };
    }

    async function runScheduleConversation(conversationId) {
        const session0 = await getConversation(conversationId);
        if (!session0) throw new Error(__tmT("ai.conversationNotFound"));
        const draft = getConversationDraft(session0.id);
        let session = await ensureConversationDefaults(session0);
        const planner = normalizePlannerOptions(session.plannerOptions);
        const { selectedTaskIds, selectedTasks } = await buildScheduleCandidateTasks(session);
        if (!selectedTaskIds.length || !selectedTasks.length) throw new Error(__tmT("ai.selectTasksToScheduleFirst"));
        const dayKey = normalizeDateKey(planner.planDate || todayKey()) || todayKey();
        const dayKeyTo = normalizeDateKey(planner.planDateTo || planner.planDate || dayKey) || dayKey;
        const planDays = listDateKeysBetween(dayKey, dayKeyTo);
        const doc = await getPrimaryDocumentSnapshot({ ...session, selectedTaskIds }, { taskId: selectedTaskIds[0] });
        const excerpt = buildDocExcerpt(doc, selectedTaskIds[0], session.contextMode);
        const existing = await loadExistingSchedulesByRange(dayKey, dayKeyTo);
        const cfg = getConfig();
        const allowedWindows = Array.isArray(cfg.scheduleWindows) && cfg.scheduleWindows.length ? cfg.scheduleWindows : [{ start: '09:00', end: '18:00', label: '09:00-18:00' }];
        const userInstruction = [String(draft.schedule || '').trim(), planDays.length > 1 ? __tmT("ai.finishThePlanWithinDays", { length: planDays.length }) : '', planner.breakHours > 0 ? __tmT("ai.iWantHoursOfDowntimeInThisPeriod", { breakHours: planner.breakHours }) : '', planner.gapMinutes > 0 ? __tmT("ai.gapsBetweenTasksMinutes", { gapMinutes: planner.gapMinutes }) : '', planner.note ? planner.note : ''].filter(Boolean).join('，');
        const result = await callMiniMaxJson(
            __tmT("ai.youAreATaskSchedulingAssistantOutputOnlyJson2"),
            {
                conversationType: session.type,
                contextScope: session.contextScope,
                plannerOptions: planner,
                today: todayKey(),
                planDate: dayKey,
                planDateTo: dayKeyTo,
                planDays,
                document: doc ? { id: doc.id, name: doc.name, path: doc.path, ...excerpt } : null,
                selectedTasks: selectedTasks.map(taskLite),
                selectedTaskIds,
                existingSchedules: (existing || []).slice(0, 200).map((it) => ({ title: String(it?.title || '').trim(), taskId: String(it?.taskId || it?.task_id || it?.linkedTaskId || it?.linked_task_id || '').trim(), start: String(it?.start || '').trim(), end: String(it?.end || '').trim(), allDay: !!it?.allDay, dayKey: String(it?.dayKey || '').trim() })),
                allowedWindows: allowedWindows.map((win) => win.label),
                breakHours: planner.breakHours,
                gapMinutes: planner.gapMinutes,
                userInstruction,
            },
            {
                history: conversationHistoryToPrompt(session.messages),
                contextMode: session.contextMode,
                expectedSchema: 'schedule_plan',
                maxTokens: Math.max(1500, getConfig().maxTokens),
                timeoutMs: 50000,
            }
        );
        const conflicts = Array.isArray(result?.conflicts) ? result.conflicts.map((it) => String(it || '').trim()).filter(Boolean) : [];
        const timeBlocks = [];
        (Array.isArray(result?.timeBlocks) ? result.timeBlocks : []).forEach((it) => {
            const start = parseDateTimeLoose(it?.start);
            const end = parseDateTimeLoose(it?.end);
            if (!(start instanceof Date) || !(end instanceof Date) || end.getTime() <= start.getTime()) return;
            if (!isDateWithinRange(start, dayKey, dayKeyTo) || !isDateWithinRange(end, dayKey, dayKeyTo)) {
                conflicts.push(__tmT("ai.isOutsideThePlannedDateRangeAndWasIgnored", { value1: it?.title || it?.taskId || __tmT("kernel.task") }));
                return;
            }
            if (!isBlockWithinWindows(start, end, allowedWindows)) {
                conflicts.push(__tmT("ai.isOutsideTheAllowedTimeWindowsAndWasIgnored", { value1: it?.title || it?.taskId || __tmT("kernel.task") }));
                return;
            }
            timeBlocks.push({
                taskId: String(it?.taskId || '').trim(),
                title: String(it?.title || '').trim(),
                start: `${normalizeDateKey(start)} ${hhmmOfDate(start)}`,
                end: `${normalizeDateKey(end)} ${hhmmOfDate(end)}`,
                allDay: it?.allDay === true,
                reason: String(it?.reason || '').trim(),
            });
        });
        if (!timeBlocks.length) throw new Error(__tmT("ai.theAiDidNotGenerateASchedulableResultFor"));
        const normalizedPlanWindow = normalizePlannerOptions({ planDate: String(result?.planDate || dayKey).trim(), planDateTo: String(result?.planDateTo || dayKeyTo).trim() });
        const plan = {
            conversationId: session.id,
            planDate: normalizedPlanWindow.planDate || dayKey,
            planDateTo: normalizedPlanWindow.planDateTo || dayKeyTo,
            timeBlocks,
            unscheduledTasks: Array.isArray(result?.unscheduledTasks) ? result.unscheduledTasks.map((it) => String(it || '').trim()).filter(Boolean) : [],
            conflicts,
            assumptions: Array.isArray(result?.assumptions) ? result.assumptions.map((it) => String(it || '').trim()).filter(Boolean) : [],
            allowedWindows,
            selectedTaskIds,
            existingSchedules: await loadExistingSchedulesByRange(normalizedPlanWindow.planDate || dayKey, normalizedPlanWindow.planDateTo || dayKeyTo),
        };
        session = await updateConversation(session.id, { selectedTaskIds, plannerOptions: planner });
        session = await appendConversationMessage(session.id, 'user', userInstruction || __tmT("ai.generateASchedulePlan"), { scene: 'schedule' });
        session = await appendConversationMessage(session.id, 'assistant', summarizeScheduleResult(plan), { scene: 'schedule', plan });
        draft.schedule = '';
        await updateConversation(session.id, {
            title: String(session0.title || '').trim() || `${AI_SCENE_LABELS.schedule} · ${doc?.name || __tmT("ai.currentView")}`,
            lastResult: plan,
        });
        return await getConversation(session.id);
    }

    async function loadExistingSchedulesByDate(planDate) {
        const cal = globalThis.__tmCalendar;
        if (!cal?.listTaskSchedulesByDay) return [];
        const dayKey = normalizeDateKey(planDate || todayKey()) || todayKey();
        const list = await cal.listTaskSchedulesByDay(dayKey);
        return (Array.isArray(list) ? list : []).map((item) => ({
            id: String(item?.id || '').trim(),
            taskId: String(item?.taskId || item?.task_id || '').trim(),
            title: String(item?.title || '').trim(),
            start: String(item?.start || '').trim(),
            end: String(item?.end || '').trim(),
        }));
    }

    async function loadExistingSchedulesByRange(planDate, planDateTo) {
        const days = listDateKeysBetween(planDate, planDateTo);
        const out = [];
        for (const dayKey of days) {
            const list = await loadExistingSchedulesByDate(dayKey);
            list.forEach((item) => out.push({ ...item, dayKey }));
        }
        return out;
    }

    async function applyConversationSchedule(conversationId) {
        const session = await getConversation(conversationId);
        const plan = session?.lastResult;
        const blocks = Array.isArray(plan?.timeBlocks) ? plan.timeBlocks : [];
        if (!blocks.length) throw new Error(__tmT("ai.noSchedulableResultInTheCurrentConversation"));
        const cal = globalThis.__tmCalendar;
        if (!cal?.addTaskSchedule) throw new Error(__tmT("ai.calendarModuleIsNotLoaded"));
        for (const item of blocks) {
            const start = parseDateTimeLoose(item.start);
            const end = parseDateTimeLoose(item.end);
            if (!(start instanceof Date) || !(end instanceof Date) || end.getTime() <= start.getTime()) continue;
            await cal.addTaskSchedule({
                taskId: item.taskId,
                title: item.title || item.taskId || __tmT("kernel.task"),
                start,
                end,
                calendarId: 'default',
                durationMin: Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000)),
                allDay: !!item.allDay,
                refresh: false,
            });
        }
        try {
            if (typeof cal.requestRefresh === 'function') {
                await cal.requestRefresh({
                    reason: 'ai-conversation-schedule',
                    main: true,
                    side: true,
                    flushTaskPanel: true,
                });
            } else {
                await cal.refreshInPlace?.({ silent: false });
            }
        } catch (e) {}
        const refreshed = await loadExistingSchedulesByRange(plan?.planDate || todayKey(), plan?.planDateTo || plan?.planDate || todayKey());
        await updateConversation(session.id, { lastResult: { ...(session.lastResult || {}), existingSchedules: refreshed } });
        toast(__tmT("ai.writtenToCalendar"), 'success');
        return true;
    }

    function renderSelectionChips(ids, cache, removeAction, emptyText, richTaskTitle = false) {
        const arr = Array.isArray(ids) ? ids : [];
        if (!arr.length) return `<div class="tm-ai-sidebar__meta">${esc(emptyText || __tmT("ai.noManuallyAttachedContextYet"))}</div>`;
        return `<div class="tm-ai-sidebar__chips">${arr.map((id) => {
            const label = String(cache.get(id) || id).trim() || id;
            const title = richTaskTitle ? getTaskTitlePresentation(label, id) : { html: esc(label), text: label };
            return `
            <span class="tm-ai-sidebar__chip">
                <span title="${esc(title.text)}">${title.html}</span>
                ${removeAction ? `<button type="button" data-ai-sidebar-action="${esc(removeAction)}" data-ai-id="${esc(id)}">×</button>` : ''}
            </span>
        `;
        }).join('')}</div>`;
    }

    function renderConversationMessages(messages) {
        const list = Array.isArray(messages) ? messages : [];
        if (!list.length) return `<div class="tm-ai-sidebar__empty">${__tmT("ai.noMessagesYetStartAChatRunASmart")}</div>`;
        return list.map((item) => {
            const role = item.role === 'user' ? __tmT("ai.you") : (item.role === 'context' ? __tmT("ai.context2") : 'AI');
            const cls = item.role === 'user' ? ' tm-ai-sidebar__message--user' : (item.role === 'context' ? ' tm-ai-sidebar__message--context' : '');
            return `
                <div class="tm-ai-sidebar__message${cls}">
                    <div class="tm-ai-sidebar__message-role">${esc(role)}</div>
                    <div class="tm-ai-sidebar__message-body">${esc(String(item.content || '').trim() || ' ')}</div>
                </div>
            `;
        }).join('');
    }

    function renderChatSkillPlan(result) {
        const plan = Array.isArray(result?.plan) ? result.plan.map((item) => String(item || '').trim()).filter(Boolean) : [];
        if (!plan.length) return '';
        return `
            <div class="tm-ai-sidebar__result-block">
                <div class="tm-ai-sidebar__result-title">${__tmT("ai.executionPlan2")}</div>
                <div class="tm-ai-sidebar__plan-list">${plan.map((item, index) => `
                    <div class="tm-ai-sidebar__plan-item">
                        <span class="tm-ai-sidebar__plan-index">${index + 1}</span>
                        <span>${esc(item)}</span>
                    </div>
                `).join('')}</div>
            </div>
        `;
    }

    function renderChatSkillTrace(result) {
        const rounds = Array.isArray(result?.skillTrace) ? result.skillTrace : [];
        if (!rounds.length) return '';
        return `
            <div class="tm-ai-sidebar__result-block">
                <div class="tm-ai-sidebar__result-title">${__tmT("ai.skillTrace")}</div>
                ${rounds.map((round) => {
                    const calls = Array.isArray(round?.results) ? round.results : [];
                    return `
                        <div class="tm-ai-sidebar__trace-round">
                            <div class="tm-ai-sidebar__trace-round-head">
                                <div>${__tmT("ai.round", { value1: Number(round?.round || 0) || 1 })}</div>
                                <div class="tm-ai-sidebar__trace-round-meta">${esc(String(round?.reason || '').trim() || (calls.length ? __tmT("ai.calledSkills", { length: calls.length }) : __tmT("ai.noCallsNeeded")))}</div>
                            </div>
                            ${calls.length ? calls.map((call) => `
                                <div class="tm-ai-sidebar__trace-call">
                                    <div class="tm-ai-sidebar__trace-call-head">
                                        <div>${esc(call?.skill || 'skill')}</div>
                                        <span class="tm-ai-sidebar__trace-chip ${call?.ok ? 'is-success' : 'is-fail'}">${call?.ok ? __tmT("ai.success") : __tmT("ai.failed2")}</span>
                                    </div>
                                    ${call?.summary ? `<div class="tm-ai-sidebar__trace-call-body">${esc(call.summary)}</div>` : ''}
                                    ${call?.error && !call?.ok ? `<div class="tm-ai-sidebar__meta">${__tmT("ai.reason3", { error: esc(call.error) })}</div>` : ''}
                                </div>
                            `).join('') : `<div class="tm-ai-sidebar__meta" style="margin-top:6px;">${__tmT("ai.noSkillsWereExecutedThisRound")}</div>`}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function renderChatSkillCatalog(result) {
        const readSkills = Array.isArray(result?.availableReadSkills) ? result.availableReadSkills : [];
        const writeSkills = Array.isArray(result?.availableWriteSkills) ? result.availableWriteSkills : [];
        if (!readSkills.length && !writeSkills.length) return '';
        const renderGroup = (title, list, cls) => {
            if (!Array.isArray(list) || !list.length) return '';
            return `
                <div class="tm-ai-sidebar__result-block">
                    <div class="tm-ai-sidebar__result-title">${esc(title)}</div>
                    <div class="tm-ai-sidebar__result-tags">${list.map((item) => `<span class="${esc(cls)}">${esc(item.name || '')}</span>`).join('')}</div>
                </div>
            `;
        };
        return [
            renderGroup(__tmT("ai.readSkills", { length: readSkills.length }), readSkills, ''),
            renderGroup(__tmT("ai.writeSkills", { length: writeSkills.length }), writeSkills, ''),
        ].filter(Boolean).join('');
    }

    function renderLastResult(conversation) {
        const result = conversation?.lastResult;
        if (!result || typeof result !== 'object') return '';
        if (conversation.type === 'chat') {
            if (Array.isArray(result?.skillTrace)) {
                const highlights = Array.isArray(result?.highlights) ? result.highlights : [];
                const nextActions = Array.isArray(result?.nextActions) ? result.nextActions : [];
                const warnings = Array.isArray(result?.warnings) ? result.warnings : [];
                return `
                    <div class="tm-ai-sidebar__result">
                        <div class="tm-ai-sidebar__result-title">${__tmT("ai.thisRoundSResults")}</div>
                        <div class="tm-ai-sidebar__result-body">${esc(result.answer || '')}</div>
                        ${renderChatSkillCatalog(result)}
                        ${renderChatSkillPlan(result)}
                        ${renderChatSkillTrace(result)}
                        ${highlights.length ? `<div class="tm-ai-sidebar__result-tags">${highlights.map((it) => `<span>${esc(it)}</span>`).join('')}</div>` : ''}
                        ${nextActions.length ? `<div class="tm-ai-sidebar__meta">${__tmT("ai.nextSteps", { value1: esc(nextActions.join('；')) })}</div>` : ''}
                        ${warnings.length ? `<div class="tm-ai-sidebar__meta">${__tmT("ai.reminder", { value1: esc(warnings.join('；')) })}</div>` : ''}
                    </div>
                `;
            }
            const highlights = Array.isArray(result?.highlights) ? result.highlights : [];
            const nextActions = Array.isArray(result?.nextActions) ? result.nextActions : [];
            const warnings = Array.isArray(result?.warnings) ? result.warnings : [];
            const taskOperations = Array.isArray(result?.taskOperations) ? result.taskOperations : [];
            const createOperations = Array.isArray(result?.createOperations) ? result.createOperations : [];
            return `
                <div class="tm-ai-sidebar__result">
                    <div class="tm-ai-sidebar__result-title">${__tmT("ai.thisRoundSResults")}</div>
                    <div class="tm-ai-sidebar__result-body">${esc(result.answer || '')}</div>
                    ${(createOperations.length || taskOperations.length) ? `<div class="tm-ai-sidebar__smart-list">
                        ${createOperations.map((it) => `
                        <div class="tm-ai-sidebar__smart-item">
                            <div class="tm-ai-sidebar__smart-head">
                                <div>${esc(it.title || it.taskId || __tmT("kernel.task"))}</div>
                                <span>${it.ok ? __tmT("ai.created") : __tmT("ai.failed2")}</span>
                            </div>
                            ${it.targetLabel ? `<div class="tm-ai-sidebar__meta">${esc(`${it.isSubtask ? __tmT("kernel.parentTask") : __tmT("kernel.documents")}：${it.targetLabel}`)}</div>` : ''}
                            ${it.patchDesc ? `<div class="tm-ai-sidebar__meta">${esc(it.patchDesc)}</div>` : ''}
                            ${it.error ? `<div class="tm-ai-sidebar__meta">${__tmT("ai.reason3", { error: esc(it.error) })}</div>` : ''}
                        </div>
                        `).join('')}
                        ${taskOperations.map((it) => `
                        <div class="tm-ai-sidebar__smart-item">
                            <div class="tm-ai-sidebar__smart-head">
                                <div>${esc(it.title || it.taskId || __tmT("kernel.task"))}</div>
                                <span>${it.ok ? __tmT("ai.executed") : __tmT("ai.failed2")}</span>
                            </div>
                            ${it.patchDesc ? `<div class="tm-ai-sidebar__meta">${esc(it.patchDesc)}</div>` : ''}
                            ${it.error ? `<div class="tm-ai-sidebar__meta">${__tmT("ai.reason3", { error: esc(it.error) })}</div>` : ''}
                        </div>
                        `).join('')}
                    </div>` : ''}
                    ${highlights.length ? `<div class="tm-ai-sidebar__result-tags">${highlights.map((it) => `<span>${esc(it)}</span>`).join('')}</div>` : ''}
                    ${nextActions.length ? `<div class="tm-ai-sidebar__meta">${__tmT("ai.nextSteps", { value1: esc(nextActions.join('；')) })}</div>` : ''}
                    ${warnings.length ? `<div class="tm-ai-sidebar__meta">${__tmT("ai.reminder", { value1: esc(warnings.join('；')) })}</div>` : ''}
                </div>
            `;
        }
        if (conversation.type === 'smart') {
            const dims = result?.smartScore?.byDimension || {};
            const rows = Array.isArray(result?.taskAnalyses) ? result.taskAnalyses : [];
            return `
                <div class="tm-ai-sidebar__result">
                    <div class="tm-ai-sidebar__result-title">${__tmT("ai.smartOverview")}</div>
                    <div class="tm-ai-sidebar__result-score">${clamp(result?.smartScore?.overall || 0, 0, 100)}/100</div>
                    <div class="tm-ai-sidebar__meta">S ${clamp(dims.specific || 0, 0, 100)} · M ${clamp(dims.measurable || 0, 0, 100)} · A ${clamp(dims.achievable || 0, 0, 100)} · R ${clamp(dims.relevant || 0, 0, 100)} · T ${clamp(dims.timeBound || 0, 0, 100)}</div>
                    ${result?.summary ? `<div class="tm-ai-sidebar__result-body" style="margin-top:8px;">${esc(result.summary)}</div>` : ''}
                    ${rows.length ? `<div class="tm-ai-sidebar__smart-list">${rows.map((item, index) => {
                        const currentTitle = getTaskTitlePresentation(item.currentTitle || item.taskId || __tmT("kernel.task"), item.taskId || __tmT("kernel.task"));
                        return `
                        <div class="tm-ai-sidebar__smart-item">
                            <div class="tm-ai-sidebar__smart-head">
                                <div title="${esc(currentTitle.text)}">${currentTitle.html}</div>
                                <span>${clamp(item?.score?.overall || 0, 0, 100)}/100</span>
                            </div>
                            ${item.suggestedTitle ? `<div class="tm-ai-sidebar__meta">${__tmT("ai.suggestedTitle2", { suggestedTitle: esc(item.suggestedTitle) })}</div>` : ''}
                            ${item.issues.length ? `<div class="tm-ai-sidebar__meta">${__tmT("ai.issues2", { value1: esc(item.issues.join('；')) })}</div>` : ''}
                            ${item.suggestions.length ? `<div class="tm-ai-sidebar__meta">${__tmT("ai.suggestions", { value1: esc(item.suggestions.join('；')) })}</div>` : ''}
                            <div class="tm-ai-sidebar__actions">
                                ${item.suggestedTitle && item.taskId ? `<button class="tm-btn tm-btn-secondary" data-ai-sidebar-action="apply-smart-rename" data-ai-index="${index}">${__tmT("ai.applyTitle")}</button>` : ''}
                                ${item.newTaskSuggestion ? `<button class="tm-btn tm-btn-secondary" data-ai-sidebar-action="create-smart-task" data-ai-index="${index}">${__tmT("ai.createSuggestedTask")}</button>` : ''}
                            </div>
                        </div>
                    `;
                    }).join('')}</div>` : ''}
                </div>
            `;
        }
        if (conversation.type === 'schedule') {
            const blocks = Array.isArray(result?.timeBlocks) ? result.timeBlocks : [];
            const existing = Array.isArray(result?.existingSchedules) ? result.existingSchedules : [];
            const dateLabel = formatPlannerDateRange(result?.planDate || todayKey(), result?.planDateTo || result?.planDate || todayKey());
            return `
                <div class="tm-ai-sidebar__result">
                    <div class="tm-ai-sidebar__result-title">${__tmT("ai.scheduleResults")}</div>
                    <div class="tm-ai-sidebar__meta">${__tmT("ai.planRange", { dateLabel: esc(dateLabel) })}</div>
                    <div class="tm-ai-sidebar__smart-list">${blocks.map((item) => `
                        <div class="tm-ai-sidebar__smart-item">
                            <div class="tm-ai-sidebar__smart-head">
                                <div>${esc(item.title || item.taskId || __tmT("kernel.task"))}</div>
                                <span>${esc(`${item.start} ~ ${item.end}`)}</span>
                            </div>
                            ${item.reason ? `<div class="tm-ai-sidebar__meta">${esc(item.reason)}</div>` : ''}
                            ${item.taskId ? `<div class="tm-ai-sidebar__actions"><button class="tm-btn tm-btn-secondary" data-ai-sidebar-action="edit-task-schedule" data-ai-task-id="${esc(item.taskId)}">${__tmT("ai.adjustDeleteThisTaskSSchedule")}</button></div>` : ''}
                        </div>
                    `).join('')}</div>
                    ${existing.length ? `<div class="tm-ai-sidebar__meta" style="margin-top:8px;">${__tmT("ai.existingSchedulesInRangeAdjustableDeletable")}</div><div class="tm-ai-sidebar__smart-list">${existing.map((item) => `<div class="tm-ai-sidebar__smart-item"><div class="tm-ai-sidebar__smart-head"><div>${esc(item.title || item.taskId || __tmT("kernel.schedule"))}</div><span>${esc(`${item.start} ~ ${item.end}`)}</span></div>${item.dayKey ? `<div class="tm-ai-sidebar__meta">${esc(item.dayKey)}</div>` : ''}<div class="tm-ai-sidebar__actions"><button class="tm-btn tm-btn-secondary" data-ai-sidebar-action="edit-schedule" data-ai-id="${esc(item.id || '')}" ${item.id ? '' : 'disabled'}>${__tmT("ai.adjustDelete")}</button></div></div>`).join('')}</div>` : ''}
                    ${Array.isArray(result?.conflicts) && result.conflicts.length ? `<div class="tm-ai-sidebar__meta">${__tmT("ai.conflicts", { value1: esc(result.conflicts.join('；')) })}</div>` : ''}
                    <div class="tm-ai-sidebar__actions">
                        <button class="tm-btn tm-btn-success" data-ai-sidebar-action="apply-schedule">${__tmT("ai.writeToCalendar")}</button>
                        <button class="tm-btn tm-btn-secondary" data-ai-sidebar-action="reload-existing-schedules">${__tmT("ai.refreshRangeSchedules")}</button>
                    </div>
                </div>
            `;
        }
        if (conversation.type === 'summary') {
            const completed = Array.isArray(result?.completedHighlights) ? result.completedHighlights : [];
            const progress = Array.isArray(result?.progressHighlights) ? result.progressHighlights : [];
            const risks = Array.isArray(result?.risks) ? result.risks : [];
            const nextSteps = Array.isArray(result?.nextSteps) ? result.nextSteps : [];
            const notes = Array.isArray(result?.notes) ? result.notes : [];
            return `
                <div class="tm-ai-sidebar__result">
                    <div class="tm-ai-sidebar__result-title">${__tmT("ai.summaryResult")}</div>
                    ${result?.title ? `<div class="tm-ai-sidebar__smart-head"><div>${esc(result.title)}</div><span>${esc(result.rangeLabel || '')}</span></div>` : ''}
                    ${result?.summary ? `<div class="tm-ai-sidebar__result-body" style="margin-top:8px;">${esc(result.summary)}</div>` : ''}
                    <div class="tm-ai-sidebar__meta">${__tmT("ai.includedDoneUnfinishedItems", { value1: esc(String(result?.stats?.included || 0)), value2: esc(String(result?.stats?.done || 0)), value3: esc(String(result?.stats?.todo || 0)) })}</div>
                    ${completed.length ? `<div class="tm-ai-sidebar__meta" style="margin-top:8px;">${__tmT("ai.completed2", { value1: esc(completed.join('；')) })}</div>` : ''}
                    ${progress.length ? `<div class="tm-ai-sidebar__meta">${__tmT("ai.progress2", { value1: esc(progress.join('；')) })}</div>` : ''}
                    ${risks.length ? `<div class="tm-ai-sidebar__meta">${__tmT("ai.risks", { value1: esc(risks.join('；')) })}</div>` : ''}
                    ${nextSteps.length ? `<div class="tm-ai-sidebar__meta">${__tmT("ai.nextSteps", { value1: esc(nextSteps.join('；')) })}</div>` : ''}
                    ${notes.length ? `<div class="tm-ai-sidebar__meta">${__tmT("ai.notes", { value1: esc(notes.join('；')) })}</div>` : ''}
                    ${result?.reportMarkdown ? `<div class="tm-ai-sidebar__message-body" style="margin-top:8px;">${esc(result.reportMarkdown)}</div>` : ''}
                    <div class="tm-ai-sidebar__actions">
                        <button class="tm-btn tm-btn-secondary" data-ai-sidebar-action="copy-summary">${__tmT("ai.copySummary")}</button>
                    </div>
                </div>
            `;
        }
        return '';
    }

    function renderSidebar(conversation, conversations) {
        const session = normalizeConversation(conversation || {});
        const draft = getConversationDraft(session.id);
        const hasContextSelection = session.selectedDocIds.length > 0 || session.selectedTaskIds.length > 0;
        const isCurrentGroupScope = session.contextScope === 'current_group';
        const canRefreshContext = session.contextScope !== 'manual' && session.contextScope !== 'none';
        const orderedTasks = session.contextScope === 'current_group'
            ? (Array.isArray(aiRuntime.currentGroupTasks) ? aiRuntime.currentGroupTasks : [])
            : (Array.isArray(aiRuntime.currentViewTopTasks) && aiRuntime.currentViewTopTasks.length
                ? aiRuntime.currentViewTopTasks
                : (Array.isArray(aiRuntime.currentViewTasks) ? aiRuntime.currentViewTasks : []));
        const planner = normalizePlannerOptions(session.plannerOptions);
        const summary = resolveSummaryRange(session.summaryOptions);
        const showTaskPicker = session.contextScope !== 'none' && (session.type === 'schedule' || session.contextScope === 'manual' || session.contextScope === 'current_view');
        const plannerSummary = formatSchedulePlannerSummary(planner);
        const root = aiRuntime.host;
        if (!(root instanceof HTMLElement)) return;
        const conversationFontSize = getConfig().conversationFontSize;
        root.innerHTML = `
            <div class="tm-ai-sidebar${aiRuntime.mobile ? ' tm-ai-sidebar--mobile' : ''}" style="--tm-ai-conversation-font-size:${Number((conversationFontSize / 16).toFixed(4))}rem;">
                <div class="tm-ai-sidebar__head">
                    <div class="tm-ai-sidebar__title-row">
                        <div class="tm-ai-sidebar__title">${__tmT("ai.aiWorkbench")}</div>
                        <button class="tm-ai-sidebar__title-toggle" data-ai-sidebar-action="toggle-setup" title="${aiRuntime.setupCollapsed ? __tmT("ai.expandTopSettings") : __tmT("ai.collapseTopSettings")}" aria-label="${aiRuntime.setupCollapsed ? __tmT("ai.expandTopSettings") : __tmT("ai.collapseTopSettings")}" aria-expanded="${aiRuntime.setupCollapsed ? 'false' : 'true'}">
                            <svg class="tm-ai-sidebar__title-toggle-icon" viewBox="0 0 24 24" width="16" height="16" style="transform:rotate(${aiRuntime.setupCollapsed ? '0deg' : '90deg'});" aria-hidden="true">
                                <path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.45" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                    <div class="tm-ai-sidebar__head-title">
                        <input class="tm-ai-sidebar__title-input" data-ai-sidebar-field="title" value="${esc(session.title)}" placeholder="${globalThis.__taskHorizonHostBridge.i18n.html("ai.conversationtitle")}">
                    </div>
                    <div class="tm-ai-sidebar__head-actions">
                        <button class="tm-btn tm-btn-info" data-ai-sidebar-action="toggle-history">${aiRuntime.historyOpen ? __tmT("ai.hide") : __tmT("ai.conversation")}</button>
                        <button class="tm-btn tm-btn-info" data-ai-sidebar-action="new-conversation">${__tmT("ai.new")}</button>
                        <button class="tm-btn tm-btn-gray" data-ai-sidebar-action="close-panel">${aiRuntime.mobile ? __tmT("common.close") : __tmT("ai.collapse")}</button>
                    </div>
                </div>
                <div class="tm-ai-sidebar__history${aiRuntime.historyOpen ? "" : " is-hidden"}">
                        ${(Array.isArray(conversations) ? conversations : []).map((item) => `
                            <button class="tm-ai-sidebar__history-item${item.id === session.id ? ' is-active' : ''}" data-ai-sidebar-action="select-conversation" data-ai-id="${esc(item.id)}">
                                <span class="tm-ai-sidebar__history-item-head">
                                    <span class="tm-ai-sidebar__history-item-title">${esc(item.title || AI_SCENE_LABELS[item.type] || __tmT("ai.aiConversation"))}</span>
                                    <span class="tm-ai-sidebar__history-delete" data-ai-sidebar-action="delete-conversation" data-ai-id="${esc(item.id)}">${__tmT("common.delete")}</span>
                                </span>
                                <small>${esc(AI_SCENE_LABELS[item.type] || item.type)} · ${esc(AI_CONTEXT_SCOPE_LABELS[item.contextScope] || item.contextScope)}</small>
                            </button>
                        `).join('')}
                    </div>
                <div class="tm-ai-sidebar__panel">
                    ${aiRuntime.setupCollapsed ? '' : `
                        <div class="tm-ai-sidebar__setup">
                            <div class="tm-ai-sidebar__setup-row">
                                <span>${__tmT("ai.scene")}</span>
                                <div class="tm-ai-sidebar__segmented" role="tablist" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("ai.aiScene")}">
                                    <button class="tm-ai-sidebar__seg-btn${session.type === 'chat' ? ' is-active' : ''}" type="button" data-ai-sidebar-action="set-scene" data-ai-value="chat" role="tab" aria-selected="${session.type === 'chat' ? 'true' : 'false'}">${__tmT("ai.aiChat")}</button>
                                    <button class="tm-ai-sidebar__seg-btn${session.type === 'smart' ? ' is-active' : ''}" type="button" data-ai-sidebar-action="set-scene" data-ai-value="smart" role="tab" aria-selected="${session.type === 'smart' ? 'true' : 'false'}">${__tmT("ai.smartAnalysis")}</button>
                                    <button class="tm-ai-sidebar__seg-btn${session.type === 'schedule' ? ' is-active' : ''}" type="button" data-ai-sidebar-action="set-scene" data-ai-value="schedule" role="tab" aria-selected="${session.type === 'schedule' ? 'true' : 'false'}">${__tmT("ai.schedulePlanning")}</button>
                                    <button class="tm-ai-sidebar__seg-btn${session.type === 'summary' ? ' is-active' : ''}" type="button" data-ai-sidebar-action="set-scene" data-ai-value="summary" role="tab" aria-selected="${session.type === 'summary' ? 'true' : 'false'}">${__tmT("ai.summary")}</button>
                                </div>
                            </div>
                            <div class="tm-ai-sidebar__grid">
                                <label><span>${__tmT("ai.scope")}</span><select class="tm-rule-select" data-ai-sidebar-field="contextScope"><option value="none" ${session.contextScope === 'none' ? 'selected' : ''}>${__tmT("ai.chatOnly")}</option><option value="current_doc" ${session.contextScope === 'current_doc' ? 'selected' : ''}>${__tmT("ai.currentDocument")}</option><option value="current_task" ${session.contextScope === 'current_task' ? 'selected' : ''}>${__tmT("ai.currentTask")}</option><option value="current_group" ${session.contextScope === 'current_group' ? 'selected' : ''}>${__tmT("ai.currentGroup")}</option><option value="current_view" ${session.contextScope === 'current_view' ? 'selected' : ''}>${__tmT("ai.topOfCurrentView")}</option><option value="manual" ${session.contextScope === 'manual' ? 'selected' : ''}>${__tmT("ai.manualTasks")}</option></select></label>
                                <label><span>${__tmT("ai.context2")}</span><select class="tm-rule-select" data-ai-sidebar-field="contextMode"><option value="none" ${session.contextMode === 'none' ? 'selected' : ''}>${__tmT("ai.noContext")}</option><option value="nearby" ${session.contextMode === 'nearby' ? 'selected' : ''}>${__tmT("ai.nearbyContext")}</option><option value="fulltext" ${session.contextMode === 'fulltext' ? 'selected' : ''}>${__tmT("ai.fullTextContext")}</option></select></label>
                            </div>
                            <div class="tm-ai-sidebar__context">
                                <div class="tm-ai-sidebar__section-head">
                                    <div class="tm-ai-sidebar__section-title">${__tmT("ai.context2")}</div>
                                    <div class="tm-ai-sidebar__section-tools">
                                        <button class="tm-btn tm-btn-secondary tm-ai-sidebar__mini-action" data-ai-sidebar-action="refresh-context" title="${globalThis.__taskHorizonHostBridge.i18n.html("ai.refreshContextFromTheCurrentScope")}" ${canRefreshContext ? '' : 'disabled'}>${__tmT("ai.refresh")}</button>
                                        <button class="tm-btn tm-btn-secondary tm-ai-sidebar__mini-action" data-ai-sidebar-action="clear-context" ${hasContextSelection ? '' : 'disabled'}>${__tmT("common.clear")}</button>
                                    </div>
                                </div>
                                <div class="tm-ai-sidebar__meta">${__tmT("kernel.documents")}</div>
                                ${renderSelectionChips(session.selectedDocIds, aiRuntime.labelCache.doc, 'remove-doc')}
                                <div class="tm-ai-sidebar__meta" style="margin-top:8px;">${__tmT("kernel.task")}</div>
                                ${isCurrentGroupScope
                                    ? `<div class="tm-ai-sidebar__empty">${__tmT("ai.inCurrentGroupModeAllUnfinishedTasksInThe")}</div>`
                                    : renderSelectionChips(session.selectedTaskIds, aiRuntime.labelCache.task, 'remove-task', __tmT("ai.noManuallyAttachedContextYetDragTasksInTo"), true)}
                            </div>
                            ${showTaskPicker ? `
                                <div class="tm-ai-sidebar__context">
                                    <div class="tm-ai-sidebar__section-head">
                                        <div class="tm-ai-sidebar__section-title">${__tmT("ai.candidateTasks")}</div>
                                        <button class="tm-ai-sidebar__section-toggle" data-ai-sidebar-action="toggle-task-picker" title="${aiRuntime.taskPickerCollapsed ? __tmT("ai.expandCandidateTasks") : __tmT("ai.collapseCandidateTasks")}" aria-label="${aiRuntime.taskPickerCollapsed ? __tmT("ai.expandCandidateTasks") : __tmT("ai.collapseCandidateTasks")}" aria-expanded="${aiRuntime.taskPickerCollapsed ? 'false' : 'true'}">
                                            <svg class="tm-ai-sidebar__section-toggle-icon" viewBox="0 0 24 24" width="16" height="16" style="transform:rotate(${aiRuntime.taskPickerCollapsed ? '0deg' : '90deg'});" aria-hidden="true">
                                                <path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.45" stroke-linecap="round" stroke-linejoin="round"></path>
                                            </svg>
                                        </button>
                                    </div>
                                    ${aiRuntime.taskPickerCollapsed ? '' : `
                                        <div class="tm-ai-sidebar__task-picker">
                                            ${orderedTasks.map((task) => {
                                                const tid = String(task?.id || '').trim();
                                                if (!tid) return '';
                                                const checked = session.selectedTaskIds.includes(tid) ? 'checked' : '';
                                                const title = getTaskTitlePresentation(task?.markdown || task?.content || tid, tid);
                                                return `<label class="tm-ai-sidebar__task-row"><input type="checkbox" data-ai-sidebar-field="pickedTask" value="${esc(tid)}" ${checked}> <span title="${esc(title.text)}">${title.html}</span></label>`;
                                            }).join('') || `<div class="tm-ai-sidebar__empty">${session.contextScope === 'current_group' ? __tmT("ai.noSelectableTasksInTheCurrentGroup") : __tmT("ai.noSelectableTasksInTheCurrentView")}</div>`}
                                        </div>
                                    `}
                                </div>
                            ` : ''}
                        </div>
                    `}
                    <div class="tm-ai-sidebar__messages">${renderConversationMessages(session.messages)}</div>
                    ${renderLastResult(session)}
                    ${session.type === 'schedule' ? `
                        <div class="tm-ai-sidebar__composer tm-ai-sidebar__composer--schedule">
                            <div class="tm-ai-sidebar__composer-shell">
                                <button class="tm-ai-sidebar__composer-toggle" data-ai-sidebar-action="toggle-schedule-planner" aria-expanded="${aiRuntime.schedulePlannerCollapsed ? 'false' : 'true'}" title="${aiRuntime.schedulePlannerCollapsed ? __tmT("ai.expandSchedulingParameters") : __tmT("ai.collapseSchedulingParameters")}">
                                    <span class="tm-ai-sidebar__composer-toggle-main">
                                        <span class="tm-ai-sidebar__composer-toggle-title">${__tmT("ai.schedulingParameters")}</span>
                                        <span class="tm-ai-sidebar__composer-toggle-summary">${esc(plannerSummary)}</span>
                                    </span>
                                    <svg class="tm-ai-sidebar__composer-toggle-icon" viewBox="0 0 24 24" width="16" height="16" style="transform:rotate(${aiRuntime.schedulePlannerCollapsed ? '0deg' : '90deg'});" aria-hidden="true">
                                        <path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.45" stroke-linecap="round" stroke-linejoin="round"></path>
                                    </svg>
                                </button>
                                ${aiRuntime.schedulePlannerCollapsed ? '' : `
                                    <div class="tm-ai-sidebar__compact-grid">
                                        <label class="tm-ai-sidebar__compact-field"><span>${__tmT("kernel.startDate")}</span><input class="tm-input" type="date" data-ai-sidebar-field="planDate" value="${esc(planner.planDate || todayKey())}"></label>
                                        <label class="tm-ai-sidebar__compact-field"><span>${__tmT("ai.endDate")}</span><input class="tm-input" type="date" data-ai-sidebar-field="planDateTo" value="${esc(planner.planDateTo || planner.planDate || todayKey())}"></label>
                                        <label class="tm-ai-sidebar__compact-field"><span>${__tmT("ai.downtime")}</span><input class="tm-input" type="number" min="0" max="12" step="0.5" data-ai-sidebar-field="breakHours" value="${esc(planner.breakHours)}"></label>
                                        <label class="tm-ai-sidebar__compact-field"><span>${__tmT("ai.taskGap")}</span><input class="tm-input" type="number" min="0" max="240" step="5" data-ai-sidebar-field="gapMinutes" value="${esc(planner.gapMinutes)}"></label>
                                        <label class="tm-ai-sidebar__compact-field"><span>${__tmT("ai.maxTasks")}</span><input class="tm-input" type="number" min="1" max="30" step="1" data-ai-sidebar-field="maxTasks" value="${esc(planner.maxTasks)}"></label>
                                    </div>
                                `}
                                <textarea class="tm-ai-textarea" data-ai-sidebar-draft="schedule" placeholder="${globalThis.__taskHorizonHostBridge.i18n.html("ai.addConstraintsSuchAsSchedulingDemandingTasksInThe")}">${esc(draft.schedule || planner.note || '')}</textarea>
                                <div class="tm-ai-sidebar__composer-foot">
                                    <div class="tm-ai-sidebar__composer-note">${__tmT("ai.schedulingParametersAreIntegratedIntoTheInputAreaAdd")}</div>
                                    <button class="tm-btn tm-btn-primary" data-ai-sidebar-action="run-scene" ${aiRuntime.busy ? 'disabled' : ''}>${aiRuntime.busy ? __tmT("ai.processing3") : __tmT("ai.generateSchedule")}</button>
                                </div>
                            </div>
                            ${aiRuntime.busy ? `<div class="tm-ai-sidebar__hint">${__tmT("ai.theAiIsWorkingPleaseWait")}</div>` : ""}
                        </div>
                    ` : session.type === 'smart' ? `
                        <div class="tm-ai-sidebar__composer">
                            <textarea class="tm-ai-textarea" data-ai-sidebar-draft="smart" placeholder="${globalThis.__taskHorizonHostBridge.i18n.html("ai.addReviewCriteriaSuchAsMeasurableGoalsAndDeadlines")}">${esc(draft.smart || '')}</textarea>
                            <div class="tm-ai-sidebar__actions"><button class="tm-btn tm-btn-primary" data-ai-sidebar-action="run-scene" ${aiRuntime.busy ? 'disabled' : ''}>${aiRuntime.busy ? __tmT("ai.processing3") : __tmT("ai.startAnalysis")}</button></div>
                            ${aiRuntime.busy ? `<div class="tm-ai-sidebar__hint">${__tmT("ai.theAiIsWorkingPleaseWait")}</div>` : ""}
                        </div>
                    ` : session.type === 'summary' ? `
                        <div class="tm-ai-sidebar__composer">
                            <div class="tm-ai-sidebar__grid tm-ai-sidebar__grid--planner">
                                <label><span>${__tmT("ai.summaryType")}</span><select class="tm-rule-select" data-ai-sidebar-field="summaryPreset"><option value="daily" ${summary.preset === 'daily' ? 'selected' : ''}>${__tmT("ai.dailyReport2")}</option><option value="weekly" ${summary.preset === 'weekly' ? 'selected' : ''}>${__tmT("ai.weeklyReport")}</option><option value="custom" ${summary.preset === 'custom' ? 'selected' : ''}>${__tmT("ai.customSummary")}</option></select></label>
                                <label><span>${__tmT("ai.maxTasks")}</span><input class="tm-input" type="number" min="5" max="200" step="5" data-ai-sidebar-field="summaryMaxTasks" value="${esc(summary.maxTasks)}"></label>
                                <label><span>${__tmT("kernel.startDate")}</span><input class="tm-input" type="date" data-ai-sidebar-field="summaryDateFrom" value="${esc(summary.dateFrom)}"></label>
                                <label><span>${__tmT("ai.endDate")}</span><input class="tm-input" type="date" data-ai-sidebar-field="summaryDateTo" value="${esc(summary.dateTo)}"></label>
                            </div>
                            <textarea class="tm-ai-textarea" data-ai-sidebar-draft="summary" placeholder="${globalThis.__taskHorizonHostBridge.i18n.html("ai.addAFocusSuchAsCompletedTasksBlockersAnd")}">${esc(draft.summary || '')}</textarea>
                            <div class="tm-ai-sidebar__actions"><button class="tm-btn tm-btn-primary" data-ai-sidebar-action="run-scene" ${aiRuntime.busy ? 'disabled' : ''}>${aiRuntime.busy ? __tmT("ai.processing3") : __tmT("ai.generateSummary")}</button></div>
                            ${aiRuntime.busy ? `<div class="tm-ai-sidebar__hint">${__tmT("ai.theAiIsWorkingPleaseWait")}</div>` : ""}
                        </div>
                    ` : `
                        <div class="tm-ai-sidebar__composer">
                            ${renderChatPromptTemplateBar()}
                            <div class="tm-ai-sidebar__composer-row">
                                <textarea class="tm-ai-textarea" data-ai-sidebar-draft="chat" placeholder="${globalThis.__taskHorizonHostBridge.i18n.html("ai.askForNextStepsBasedOnThisDocumentEnter")}">${esc(draft.chat || '')}</textarea>
                                <button class="tm-btn tm-btn-primary tm-ai-sidebar__send" data-ai-sidebar-action="run-scene" ${aiRuntime.busy ? 'disabled' : ''}>${aiRuntime.busy ? __tmT("ai.processing3") : __tmT("ai.send")}</button>
                            </div>
                            ${aiRuntime.busy ? `<div class="tm-ai-sidebar__hint">${__tmT("ai.theAiIsWorkingPleaseWait")}</div>` : ""}
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    async function refreshSidebar(options = {}) {
        if (!hasLiveSidebarHost()) {
            aiRuntime.host = null;
            return;
        }
        await PromptTemplateStore.ensureLoaded();
        const conversations = await listConversations();
        let activeId = String(options.activeConversationId || aiRuntime.activeConversationId || ConversationStore.data?.activeId || '').trim();
        if (!activeId) activeId = String(conversations[0]?.id || '').trim();
        let conversation = activeId ? await getConversation(activeId) : null;
        if (!conversation) {
            conversation = await createConversation({ type: 'chat' });
            activeId = conversation.id;
        }
        aiRuntime.activeConversationId = activeId;
        await ensureConversationDefaults(conversation);
        conversation = await getConversation(activeId);
        renderSidebar(conversation, await listConversations());
        await warmConversationLabels(conversation);
        renderSidebar(await getConversation(activeId), await listConversations());
        aiRuntime.lastRenderedAt = Date.now();
        return conversation;
    }

    async function mountSidebar(host, options = {}) {
        if (!(host instanceof HTMLElement)) return false;
        ensureAiStyle();
        const previousHost = aiRuntime.host;
        if (previousHost && previousHost !== host) {
            aiRuntime.hostListenerController?.abort?.();
            aiRuntime.hostListenerController = null;
            delete previousHost.dataset.tmAiSidebarBound;
        }
        aiRuntime.host = host;
        aiRuntime.mobile = !!options.mobile;
        if (!host.dataset.tmAiSidebarBound) {
            host.dataset.tmAiSidebarBound = '1';
            aiRuntime.hostListenerController?.abort?.();
            aiRuntime.hostListenerController = new AbortController();
            const listen = (type, listener) => host.addEventListener(type, listener, { signal: aiRuntime.hostListenerController.signal });
            listen('click', async (event) => {
                const actionEl = event.target?.closest?.('[data-ai-sidebar-action]');
                if (!actionEl) return;
                const action = String(actionEl.getAttribute('data-ai-sidebar-action') || '').trim();
                const id = String(actionEl.getAttribute('data-ai-id') || '').trim();
                const index = Number(actionEl.getAttribute('data-ai-index') || -1);
                const current = await getConversation(aiRuntime.activeConversationId || ConversationStore.data?.activeId);
                if (action === 'new-conversation') {
                    const created = await createConversation({ type: current?.type || 'chat', contextScope: current?.contextScope || 'current_doc' });
                    await refreshSidebar({ activeConversationId: created.id });
                    return;
                }
                if (action === 'select-conversation') {
                    await setActiveConversation(id);
                    await refreshSidebar({ activeConversationId: id });
                    return;
                }
                if (action === 'delete-conversation') {
                    await deleteConversation(id);
                    await refreshSidebar();
                    return;
                }
                if (action === 'new-prompt-template') {
                    if (!current || current.type !== 'chat') return;
                    const draft = getConversationDraft(current.id);
                    const name = await promptTemplateNameDialog(__tmT("ai.newPromptTemplate"), '', __tmT("ai.usesTheCurrentInputBoxContentAsTheTemplate"));
                    if (!name) return;
                    const created = await createPromptTemplate({ name, content: String(draft.chat || '') });
                    setActiveChatPromptTemplateId(created.id);
                    toast(__tmT("ai.promptTemplateCreated"), 'success');
                    await refreshSidebar({ activeConversationId: current.id });
                    return;
                }
                if (action === 'save-prompt-template') {
                    if (!current || current.type !== 'chat') return;
                    const draft = getConversationDraft(current.id);
                    let template = PromptTemplateStore.get(aiRuntime.chatPromptTemplateId);
                    if (!template) {
                        const name = await promptTemplateNameDialog(__tmT("ai.saveAsPromptTemplate"), '', __tmT("ai.noTemplateSelectedYetSavingWillCreateANew"));
                        if (!name) return;
                        template = await createPromptTemplate({ name, content: String(draft.chat || '') });
                        setActiveChatPromptTemplateId(template.id);
                    } else {
                        template = await updatePromptTemplate(template.id, { content: String(draft.chat || '') });
                    }
                    toast(__tmT("ai.promptTemplateSaved"), 'success');
                    await refreshSidebar({ activeConversationId: current.id });
                    return;
                }
                if (action === 'rename-prompt-template') {
                    const template = PromptTemplateStore.get(aiRuntime.chatPromptTemplateId);
                    if (!template) {
                        toast(__tmT("ai.selectAPromptTemplateFirst"), 'warning');
                        return;
                    }
                    const name = await promptTemplateNameDialog(__tmT("ai.renamePromptTemplate"), template.name);
                    if (!name) return;
                    await updatePromptTemplate(template.id, { name });
                    toast(__tmT("ai.templateNameUpdated"), 'success');
                    await refreshSidebar({ activeConversationId: current?.id || aiRuntime.activeConversationId });
                    return;
                }
                if (action === 'delete-prompt-template') {
                    const template = PromptTemplateStore.get(aiRuntime.chatPromptTemplateId);
                    if (!template) {
                        toast(__tmT("ai.selectAPromptTemplateFirst"), 'warning');
                        return;
                    }
                    const confirmed = window.confirm(__tmT("ai.deletePromptTemplate", { name: template.name }));
                    if (!confirmed) return;
                    await deletePromptTemplate(template.id);
                    setActiveChatPromptTemplateId('');
                    toast(__tmT("ai.promptTemplateDeleted"), 'success');
                    await refreshSidebar({ activeConversationId: current?.id || aiRuntime.activeConversationId });
                    return;
                }
                if (action === 'toggle-history') {
                    aiRuntime.historyOpen = !aiRuntime.historyOpen;
                    await refreshSidebar({ activeConversationId: current?.id || aiRuntime.activeConversationId });
                    return;
                }
                if (action === 'toggle-setup') {
                    aiRuntime.setupCollapsed = !aiRuntime.setupCollapsed;
                    await refreshSidebar({ activeConversationId: current?.id || aiRuntime.activeConversationId });
                    return;
                }
                if (action === 'toggle-task-picker') {
                    aiRuntime.taskPickerCollapsed = !aiRuntime.taskPickerCollapsed;
                    saveAiUiPrefs({ taskPickerCollapsed: aiRuntime.taskPickerCollapsed });
                    await refreshSidebar({ activeConversationId: current?.id || aiRuntime.activeConversationId });
                    return;
                }
                if (action === 'set-scene') {
                    if (!current) return;
                    const nextType = String(actionEl.getAttribute('data-ai-value') || '').trim();
                    if (!AI_ALLOWED_TYPES.has(nextType) || nextType === current.type) return;
                    await updateConversation(current.id, { type: nextType });
                    await refreshSidebar({ activeConversationId: current.id });
                    return;
                }
                if (action === 'toggle-schedule-planner') {
                    aiRuntime.schedulePlannerCollapsed = !aiRuntime.schedulePlannerCollapsed;
                    saveAiUiPrefs({ schedulePlannerCollapsed: aiRuntime.schedulePlannerCollapsed });
                    await refreshSidebar({ activeConversationId: current?.id || aiRuntime.activeConversationId });
                    return;
                }
                if (action === 'close-panel') {
                    try { await bridge()?.closeAiPanel?.(); } catch (e) {}
                    try { globalThis.tmCloseAiSidebar?.(); } catch (e) {}
                    return;
                }
                if (!current) return;
                if (action === 'use-current-doc') {
                    const docId = String(bridge()?.getCurrentDocId?.() || '').trim();
                    if (docId) await appendConversationContext(current.id, { selectedDocIds: [docId], contextScope: 'current_doc' });
                    await refreshSidebar();
                    return;
                }
                if (action === 'use-current-task') {
                    const taskId = String(bridge()?.getCurrentTaskId?.() || '').trim();
                    if (taskId) await appendConversationContext(current.id, { selectedTaskIds: [taskId], contextScope: 'current_task' });
                    await refreshSidebar();
                    return;
                }
                if (action === 'use-current-view') {
                    const tasks = await ensureCurrentViewTopTasks(true);
                    const maxTasks = normalizePlannerOptions(current.plannerOptions).maxTasks;
                    const ids = tasks.filter((task) => !task?.done).slice(0, maxTasks).map((task) => String(task?.id || '').trim()).filter(Boolean);
                    await updateConversation(current.id, { selectedTaskIds: ids, contextScope: 'current_view' });
                    await refreshSidebar();
                    return;
                }
                if (action === 'refresh-context') {
                    if (current.contextScope === 'manual' || current.contextScope === 'none') {
                        toast(current.contextScope === 'none' ? __tmT("ai.chatOnlyScopeHasNoAutomaticContextToRefresh") : __tmT("ai.manualTasksScopeHasNoAutomaticContextToRefresh"), 'warning');
                        return;
                    }
                    const next = await ensureConversationDefaults(current, { force: true, refreshView: true });
                    toast(__tmT("ai.contextRefreshedForTheCurrentScope"), 'success');
                    await refreshSidebar({ activeConversationId: next?.id || current.id });
                    return;
                }
                if (action === 'clear-context') {
                    await updateConversation(current.id, {
                        contextScope: 'manual',
                        selectedDocIds: [],
                        selectedTaskIds: [],
                    });
                    await refreshSidebar({ activeConversationId: current.id });
                    return;
                }
                if (action === 'remove-task') {
                    await updateConversation(current.id, { selectedTaskIds: current.selectedTaskIds.filter((it) => it !== id) });
                    await refreshSidebar();
                    return;
                }
                if (action === 'remove-doc') {
                    await updateConversation(current.id, { selectedDocIds: current.selectedDocIds.filter((it) => it !== id) });
                    await refreshSidebar();
                    return;
                }
                if (action === 'run-scene') {
                    if (aiRuntime.busy) return;
                    aiRuntime.busy = true;
                    await refreshSidebar({ activeConversationId: current.id });
                    try {
                        if (current.type === 'smart') await runSmartConversation(current.id);
                        else if (current.type === 'schedule') await runScheduleConversation(current.id);
                        else if (current.type === 'summary') await runSummaryConversation(current.id);
                        else await runChatConversation(current.id);
                        toast(__tmT("ai.aiResultUpdated"), 'success');
                    } catch (e) {
                        toast(`❌ ${String(e?.message || e)}`, 'error');
                    } finally {
                        aiRuntime.busy = false;
                    }
                    await refreshSidebar({ activeConversationId: current.id });
                    return;
                }
                if (action === 'reload-existing-schedules') {
                    const planDate = normalizeDateKey(current?.lastResult?.planDate || current?.plannerOptions?.planDate || todayKey()) || todayKey();
                    const planDateTo = normalizeDateKey(current?.lastResult?.planDateTo || current?.plannerOptions?.planDateTo || planDate) || planDate;
                    const existing = await loadExistingSchedulesByRange(planDate, planDateTo);
                    await updateConversation(current.id, { lastResult: { ...(current.lastResult || {}), planDate, planDateTo, existingSchedules: existing } });
                    await refreshSidebar({ activeConversationId: current.id });
                    return;
                }
                if (action === 'edit-schedule') {
                    try {
                        const sid = String(id || '').trim();
                        if (!sid) throw new Error(__tmT("kernel.missingScheduleId"));
                        const ok = await globalThis.__tmCalendar?.openScheduleEditorById?.(sid);
                        if (!ok) throw new Error(__tmT("ai.failedToOpenTheScheduleEditor"));
                    } catch (e) {
                        toast(`❌ ${String(e?.message || e)}`, 'error');
                    }
                    return;
                }
                if (action === 'edit-task-schedule') {
                    try {
                        const tid = String(actionEl.getAttribute('data-ai-task-id') || '').trim();
                        if (!tid) throw new Error(__tmT("plugin.missingTaskId"));
                        const ok = await globalThis.__tmCalendar?.openScheduleEditorByTaskId?.(tid);
                        if (!ok) throw new Error(__tmT("ai.thisTaskHasNoAdjustableSchedule"));
                    } catch (e) {
                        toast(`❌ ${String(e?.message || e)}`, 'error');
                    }
                    return;
                }
                if (action === 'apply-schedule') {
                    try { await applyConversationSchedule(current.id); } catch (e) { toast(`❌ ${String(e?.message || e)}`, 'error'); }
                    return;
                }
                if (action === 'apply-smart-rename') {
                    const item = Array.isArray(current?.lastResult?.taskAnalyses) ? current.lastResult.taskAnalyses[index] : null;
                    if (!item?.taskId || !item?.suggestedTitle) return;
                    await bridge()?.applyTaskPatch?.(item.taskId, { title: item.suggestedTitle });
                    toast(__tmT("ai.taskTitleApplied"), 'success');
                    return;
                }
                if (action === 'create-smart-task') {
                    const item = Array.isArray(current?.lastResult?.taskAnalyses) ? current.lastResult.taskAnalyses[index] : null;
                    const docId = String(current?.lastResult?.document?.id || current?.selectedDocIds?.[0] || '').trim();
                    if (!docId || !item?.newTaskSuggestion) return;
                    await bridge()?.createTaskSuggestion?.(docId, item.newTaskSuggestion);
                    toast(__tmT("ai.suggestedTaskCreated"), 'success');
                    return;
                }
                if (action === 'copy-summary') {
                    const text = String(current?.lastResult?.reportMarkdown || current?.lastResult?.summary || '').trim();
                    if (!text) return;
                    try {
                        await navigator.clipboard.writeText(text);
                        toast(__tmT("ai.summaryCopied"), 'success');
                    } catch (e) {
                        toast(__tmT("ai.copyFailed"), 'error');
                    }
                }
            });
            listen('change', async (event) => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) return;
                const field = String(target.getAttribute('data-ai-sidebar-field') || '').trim();
                const current = await getConversation(aiRuntime.activeConversationId || ConversationStore.data?.activeId);
                if (!current) return;
                if (field === 'title') {
                    await updateConversation(current.id, { title: target.value });
                    return;
                }
                if (field === 'type') {
                    await updateConversation(current.id, { type: target.value });
                    await refreshSidebar();
                    return;
                }
                if (field === 'contextScope') {
                    const nextScope = String(target.value || '').trim();
                    const patch = { contextScope: nextScope };
                    if (nextScope === 'none') {
                        patch.selectedDocIds = [];
                        patch.selectedTaskIds = [];
                    }
                    await updateConversation(current.id, patch);
                    await refreshSidebar();
                    return;
                }
                if (field === 'contextMode') {
                    await updateConversation(current.id, { contextMode: target.value });
                    return;
                }
                if (field === 'chatPromptTemplate') {
                    await applyChatPromptTemplateToConversation(current.id, String(target.value || '').trim());
                    await refreshSidebar({ activeConversationId: current.id });
                    return;
                }
                if (field === 'planDate' || field === 'planDateTo' || field === 'breakHours' || field === 'gapMinutes' || field === 'maxTasks') {
                    const nextPlanner = normalizePlannerOptions({ ...current.plannerOptions, [field]: target.value });
                    saveRememberedPlannerOptions(nextPlanner);
                    await updateConversation(current.id, { plannerOptions: nextPlanner });
                    if (field === 'maxTasks' && (current.contextScope === 'current_view' || current.type === 'schedule')) {
                        const tasks = await ensureCurrentViewTopTasks(false);
                        const ids = tasks.filter((task) => !task?.done).slice(0, nextPlanner.maxTasks).map((task) => String(task?.id || '').trim()).filter(Boolean);
                        await updateConversation(current.id, { selectedTaskIds: ids });
                    }
                    await refreshSidebar();
                    return;
                }
                if (field === 'summaryPreset' || field === 'summaryDateFrom' || field === 'summaryDateTo' || field === 'summaryMaxTasks') {
                    const raw = {
                        ...current.summaryOptions,
                        preset: field === 'summaryPreset' ? target.value : current.summaryOptions?.preset,
                        dateFrom: field === 'summaryDateFrom' ? target.value : current.summaryOptions?.dateFrom,
                        dateTo: field === 'summaryDateTo' ? target.value : current.summaryOptions?.dateTo,
                        maxTasks: field === 'summaryMaxTasks' ? target.value : current.summaryOptions?.maxTasks,
                    };
                    if (field === 'summaryPreset') {
                        if (String(target.value || '') === 'daily') {
                            raw.dateFrom = todayKey();
                            raw.dateTo = todayKey();
                        } else if (String(target.value || '') === 'weekly') {
                            raw.dateFrom = dateToKey(startOfWeekDate(new Date()));
                            raw.dateTo = dateToKey(endOfWeekDate(new Date()));
                        }
                    }
                    const nextSummary = normalizeSummaryOptions(raw);
                    await updateConversation(current.id, { summaryOptions: nextSummary });
                    if (field === 'summaryMaxTasks' && current.contextScope === 'current_view') {
                        const tasks = await ensureCurrentViewTopTasks(false);
                        const ids = tasks.filter((task) => !task?.done).slice(0, nextSummary.maxTasks).map((task) => String(task?.id || '').trim()).filter(Boolean);
                        await updateConversation(current.id, { selectedTaskIds: ids });
                    }
                    await refreshSidebar();
                    return;
                }
                if (field === 'pickedTask') {
                    const ids = Array.from(host.querySelectorAll('[data-ai-sidebar-field="pickedTask"]')).filter((el) => el?.checked).map((el) => String(el.value || '').trim()).filter(Boolean);
                    await updateConversation(current.id, { selectedTaskIds: ids, contextScope: 'manual' });
                }
            });
            listen('input', async (event) => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) return;
                const draftKey = String(target.getAttribute('data-ai-sidebar-draft') || '').trim();
                if (!draftKey) return;
                const current = await getConversation(aiRuntime.activeConversationId || ConversationStore.data?.activeId);
                if (!current) return;
                const draft = getConversationDraft(current.id);
                draft[draftKey] = String(target.value || '');
            });
            listen('keydown', async (event) => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) return;
                const draftKey = String(target.getAttribute('data-ai-sidebar-draft') || '').trim();
                if (draftKey !== 'chat') return;
                if (event.key !== 'Enter' || event.shiftKey) return;
                try { event.preventDefault(); } catch (e) {}
                if (aiRuntime.busy) return;
                const runBtn = host.querySelector('[data-ai-sidebar-action="run-scene"]');
                if (runBtn instanceof HTMLElement) runBtn.click();
            });
            listen('dragover', (event) => { try { event.preventDefault(); } catch (e) {} });
            listen('drop', async (event) => {
                try { event.preventDefault(); } catch (e) {}
                const taskId = readTransferTaskId(event);
                const current = await getConversation(aiRuntime.activeConversationId || ConversationStore.data?.activeId);
                if (!current || !taskId) return;
                await appendConversationContext(current.id, { selectedTaskIds: [taskId], contextScope: 'manual' });
                toast(__tmT("ai.taskAddedToTheCurrentConversationContext"), 'success');
                await refreshSidebar({ activeConversationId: current.id });
            });
        }
        await ensureCurrentViewTopTasks(false);
        await ensureCurrentGroupTasks(false);
        if (aiRuntime.pendingOpen) {
            const pending = aiRuntime.pendingOpen;
            aiRuntime.pendingOpen = null;
            await openSidebar(pending);
        } else {
            await refreshSidebar();
        }
        return true;
    }

    async function openSidebar(options = {}) {
        await ConversationStore.ensureLoaded();
        const payload = (options && typeof options === 'object') ? clone(options) : {};
        if (Object.prototype.hasOwnProperty.call(payload, 'showHistory')) aiRuntime.historyOpen = !!payload.showHistory;
        let conversation = payload.conversationId ? await getConversation(payload.conversationId) : null;
        if (!conversation) {
            const current = await getConversation(aiRuntime.activeConversationId || ConversationStore.data?.activeId);
            const shouldReuse = current && !payload.forceNew && (!payload.type || payload.type === current.type);
            conversation = shouldReuse ? current : await createConversation({
                type: String(payload.type || '').trim() || 'chat',
                contextScope: String(payload.contextScope || '').trim(),
                contextMode: String(payload.contextMode || '').trim(),
                selectedDocIds: payload.selectedDocIds,
                selectedTaskIds: payload.selectedTaskIds,
                plannerOptions: payload.plannerOptions,
                summaryOptions: payload.summaryOptions,
                title: payload.title,
            });
        }
        if (conversation && Object.keys(payload).length) {
            const patch = {};
            if (payload.type) patch.type = payload.type;
            if (payload.contextScope) patch.contextScope = payload.contextScope;
            if (payload.contextMode) patch.contextMode = payload.contextMode;
            if (Array.isArray(payload.selectedDocIds)) patch.selectedDocIds = payload.selectedDocIds;
            if (Array.isArray(payload.selectedTaskIds)) patch.selectedTaskIds = payload.selectedTaskIds;
            if (payload.plannerOptions) patch.plannerOptions = payload.plannerOptions;
            if (payload.summaryOptions) patch.summaryOptions = payload.summaryOptions;
            if (payload.title) patch.title = payload.title;
            if (Object.keys(patch).length) conversation = await updateConversation(conversation.id, patch);
        }
        aiRuntime.activeConversationId = conversation?.id || '';
        if (!hasLiveSidebarHost()) {
            aiRuntime.host = null;
            aiRuntime.pendingOpen = payload;
            try { await bridge()?.openAiPanel?.({ ...payload, __tmAiPendingOpen: true }); } catch (e) {}
            return conversation;
        }
        await refreshSidebar({ activeConversationId: aiRuntime.activeConversationId });
        if (payload.autorun && conversation) {
            try {
                if (conversation.type === 'smart') await runSmartConversation(conversation.id);
                if (conversation.type === 'schedule') await runScheduleConversation(conversation.id);
                if (conversation.type === 'summary') await runSummaryConversation(conversation.id);
                await refreshSidebar({ activeConversationId: conversation.id });
            } catch (e) {
                toast(`❌ ${String(e?.message || e)}`, 'error');
            }
        }
        return conversation;
    }

    async function testConnection() {
        const cfg = assertReady(true);
        const label = providerLabel(cfg.provider);
        toast(__tmT("ai.testingConnection", { label: label }), 'info');
        await callMiniMax(__tmT("ai.youAreATestAssistantOutputOnlyJsonPing"), { ping: 'pong' }, { maxTokens: 256, temperature: 0 });
        toast(__tmT("ai.connectionSucceeded", { label: label }), 'success');
    }

    async function exportMigrationData() {
        await Promise.all([
            ConversationStore.ensureLoaded(),
            PromptTemplateStore.ensureLoaded(),
        ]);
        const conversations = ConversationStore.normalizePayload(ConversationStore.data);
        const promptTemplates = PromptTemplateStore.normalizePayload(PromptTemplateStore.data);
        return {
            mode: 'legacy',
            conversations: clone(conversations),
            promptTemplates: clone(promptTemplates),
            summary: {
                conversations: Array.isArray(conversations.conversations) ? conversations.conversations.length : 0,
                promptTemplates: Array.isArray(promptTemplates.templates) ? promptTemplates.templates.length : 0,
            },
        };
    }

    async function importMigrationData(payload = {}) {
        const source = (payload && typeof payload === 'object') ? payload : {};
        await Promise.all([
            ConversationStore.ensureLoaded(),
            PromptTemplateStore.ensureLoaded(),
        ]);
        let conversationCount = 0;
        let promptTemplateCount = 0;

        if (source.conversations && typeof source.conversations === 'object') {
            const incoming = ConversationStore.normalizePayload(source.conversations);
            const current = ConversationStore.normalizePayload(ConversationStore.data);
            const map = new Map();
            (Array.isArray(current.conversations) ? current.conversations : []).forEach((item) => {
                const id = String(item?.id || '').trim();
                if (id) map.set(id, item);
            });
            (Array.isArray(incoming.conversations) ? incoming.conversations : []).forEach((item) => {
                const id = String(item?.id || '').trim();
                if (!id) return;
                map.set(id, item);
                conversationCount += 1;
            });
            const activeId = String(incoming.activeId || current.activeId || '').trim();
            ConversationStore.data = ConversationStore.normalizePayload({
                activeId,
                conversations: Array.from(map.values()),
            });
            await ConversationStore.saveNow();
        }

        if (source.promptTemplates && typeof source.promptTemplates === 'object') {
            const incoming = PromptTemplateStore.normalizePayload(source.promptTemplates);
            const current = PromptTemplateStore.normalizePayload(PromptTemplateStore.data);
            const map = new Map();
            (Array.isArray(current.templates) ? current.templates : []).forEach((item) => {
                const id = String(item?.id || '').trim();
                if (id) map.set(id, item);
            });
            (Array.isArray(incoming.templates) ? incoming.templates : []).forEach((item) => {
                const id = String(item?.id || '').trim();
                if (!id) return;
                map.set(id, item);
                promptTemplateCount += 1;
            });
            PromptTemplateStore.data = PromptTemplateStore.normalizePayload({ templates: Array.from(map.values()) });
            await PromptTemplateStore.saveNow();
        }

        return { conversations: conversationCount, promptTemplates: promptTemplateCount };
    }

    function cleanup() {
        closeModal();
        aiRuntime.hostListenerController?.abort?.();
        aiRuntime.hostListenerController = null;
        if (aiRuntime.host) delete aiRuntime.host.dataset.tmAiSidebarBound;
        aiRuntime.host = null;
        aiRuntime.pendingOpen = null;
        try { document.getElementById('tm-ai-style')?.remove?.(); } catch (e) {}
        try { delete globalThis.tmAiOptimizeTaskName; } catch (e) {}
        try { delete globalThis.tmAiEditTask; } catch (e) {}
        try { delete globalThis.tmAiAnalyzeDocumentSmart; } catch (e) {}
        try { delete globalThis.tmAiPlanDocumentSchedule; } catch (e) {}
        try { delete globalThis.tmAiPlanTaskSchedule; } catch (e) {}
        try { delete globalThis.tmAiOpenSummary; } catch (e) {}
        try { delete globalThis.tmAiOpenChat; } catch (e) {}
        try { delete globalThis.tmAiShowHistory; } catch (e) {}
        try { delete globalThis.tmAiMountSidebar; } catch (e) {}
        try { delete globalThis.tmAiTestConnection; } catch (e) {}
        try { delete globalThis.__tmAI; } catch (e) {}
    }

    globalThis.tmAiOptimizeTaskName = async (taskId) => { try { await optimizeTitle(taskId); } catch (e) { toast(`❌ ${String(e?.message || e)}`, 'error'); } };
    globalThis.tmAiEditTask = async (taskId) => { try { await editTask(taskId); } catch (e) { toast(`❌ ${String(e?.message || e)}`, 'error'); } };
    globalThis.tmAiAnalyzeDocumentSmart = async (docId) => { try { await openSidebar({ type: 'smart', contextScope: 'current_doc', selectedDocIds: docId ? [docId] : undefined, autorun: true }); } catch (e) { toast(`❌ ${String(e?.message || e)}`, 'error'); } };
    globalThis.tmAiPlanDocumentSchedule = async (docId) => { try { await openSidebar({ type: 'schedule', contextScope: 'current_view', selectedDocIds: docId ? [docId] : undefined }); } catch (e) { toast(`❌ ${String(e?.message || e)}`, 'error'); } };
    globalThis.tmAiPlanTaskSchedule = async (taskId) => { try { await openSidebar({ type: 'schedule', contextScope: 'current_task', selectedTaskIds: taskId ? [taskId] : undefined }); } catch (e) { toast(`❌ ${String(e?.message || e)}`, 'error'); } };
    globalThis.tmAiOpenSummary = async (docId) => { try { await openSidebar({ type: 'summary', contextScope: docId ? 'current_doc' : 'current_doc', selectedDocIds: docId ? [docId] : undefined }); } catch (e) { toast(`❌ ${String(e?.message || e)}`, 'error'); } };
    globalThis.tmAiOpenChat = async (docId) => { try { await openSidebar({ type: 'chat', contextScope: docId ? 'current_doc' : 'current_doc', selectedDocIds: docId ? [docId] : undefined }); } catch (e) { toast(`❌ ${String(e?.message || e)}`, 'error'); } };
    globalThis.tmAiShowHistory = async (docId) => { try { await openSidebar({ type: 'chat', contextScope: 'current_doc', selectedDocIds: docId ? [docId] : undefined, showHistory: true }); } catch (e) { toast(`❌ ${String(e?.message || e)}`, 'error'); } };
    globalThis.tmAiMountSidebar = async (host, options) => { try { return await mountSidebar(host, options); } catch (e) { toast(`❌ ${String(e?.message || e)}`, 'error'); return false; } };
    globalThis.tmAiTestConnection = async () => { try { return await testConnection(); } catch (e) { toast(`❌ ${String(e?.message || e)}`, 'error'); throw e; } };
    const setConversationFontSize = (value) => {
        const size = Number.isFinite(Number(value)) ? Math.max(12, Math.min(22, Math.round(Number(value)))) : 14;
        aiRuntime.host?.querySelector?.('.tm-ai-sidebar')?.style?.setProperty('--tm-ai-conversation-font-size', `${Number((size / 16).toFixed(4))}rem`);
        return size;
    };
    const reloadData = async () => {
        try { await ConversationStore.saving; } catch (e) {}
        try { await PromptTemplateStore.saving; } catch (e) {}
        ConversationStore.loaded = false;
        PromptTemplateStore.loaded = false;
        await Promise.all([
            ConversationStore.ensureLoaded(),
            PromptTemplateStore.ensureLoaded(),
        ]);
        if (aiRuntime.host?.isConnected) {
            await refreshSidebar({ activeConversationId: ConversationStore.data.activeId });
        }
        return true;
    };
    globalThis.__taskHorizonAiCleanup = cleanup;
    globalThis.__tmAI = {
        loaded: true,
        runtimeKind: 'legacy',
        isBusy: () => aiRuntime.busy === true,
        cleanup,
        testConnection,
        mountSidebar,
        openSidebar,
        refreshSidebar,
        reloadData,
        setConversationFontSize,
        listConversations,
        createConversation,
        updateConversation,
        deleteConversation,
        appendConversationContext,
        runChatConversation,
        runSmartConversation,
        runScheduleConversation,
        applyConversationSchedule,
        exportMigrationData,
        importMigrationData,
    };
})();
