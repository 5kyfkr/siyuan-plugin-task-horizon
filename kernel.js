(function () {
    'use strict';

    const PLUGIN_VERSION = '1';
    const SETTINGS_FILE = 'task-settings.json';
    const TASK_ATTR_STORAGE_FILE = 'task-attr-storage.json';
    const TASK_ATTR_ITEM_STORAGE_VERSION = 1;
    const MCP_CONFIG_FILE = 'agent-mcp-config.json';
    const SCHEDULE_FILE = 'calendar-events.json';
    const AGENT_SCHEDULE_FILE = 'agent-scheduled-events.json';
    const SCHEDULE_REMINDER_MODES = Object.freeze(['inherit', 'custom']);
    const SCHEDULE_REMINDER_OFFSETS = Object.freeze([0, 5, 10, 15, 30, 60]);
    const POLICY_FILE = 'ai-policy-config.json';
    const POLICY_CONFIG_FIELDS = Object.freeze(['weeklyAvailability', 'fixedOccupancy', 'deadlinePriority', 'defaultCalendarID', 'customInstructions']);
    const DURATION_DEFAULT_MINUTES_MIN = 15;
    const DURATION_DEFAULT_MINUTES_MAX = 480;
    const ATTR_OWNER = 'custom-task-horizon-attr-host-owner';
    const ATTR_UPDATED_AT = 'custom-task-horizon-attr-host-updated-at';
    const ATTACHMENT_ATTR_PREFIX = 'custom-data-assets-th-';
    const ATTACHMENT_META_ATTR = 'custom-data-assets-th-meta';
    const REMINDER_ATTR = 'custom-tomato-reminder';
    const REMINDER_REPEAT_MODE_FOLLOW_TASK = 'followTaskRepeat';
    const REMINDER_REPEAT_MODE_MANUAL = 'manual';
    const REPEAT_ATTRS = Object.freeze(['custom-task-repeat-rule', 'custom-task-repeat-state', 'custom-task-repeat-history']);
    const ID_RE = /^[0-9]{14}-[A-Za-z0-9]+$/;
    const VIRTUAL_TASK_ID_RE = /^repeatinst:([0-9]{14}-[A-Za-z0-9]+):([^:]+)$/;
    const SAFE_ATTR_RE = /^custom-[A-Za-z0-9_-]+$/;
    const DELETE_TOKEN_TTL = 10 * 60 * 1000;
    const PREVIEW_TOKEN_TTL = 10 * 60 * 1000;
    const TASK_SCOPE_TOKEN_TTL = 10 * 60 * 1000;
    const TASK_SCOPE_MAX_ENTRIES = 64;
    const UNDO_RECORD_TTL = 30 * 60 * 1000;
    const UNDO_RECORD_MAX_ENTRIES = 64;

    const MCP_TOOL_GROUPS = Object.freeze([
        {
            id: 'tasks',
            label: '任务',
            description: '查询、新建、修改、移动和删除任务。',
            tools: [
                ['list_task_scopes', '列出任务范围'],
                ['get_task', '读取任务详情'],
                ['query_tasks', '筛选任务'],
                ['create_task', '新建任务'],
                ['update_task', '更新任务'],
                ['move_task', '移动任务'],
                ['delete_task', '删除任务'],
                ['batch_tasks', '批量处理任务'],
            ],
        },
        {
            id: 'schedules',
            label: '日程',
            description: '查询和管理任务日程。',
            tools: [
                ['query_schedules', '查询日程'],
                ['create_schedule', '新建日程'],
                ['update_schedule', '更新日程'],
                ['delete_schedule', '删除日程'],
                ['batch_schedules', '批量处理日程'],
            ],
        },
        {
            id: 'operations',
            label: '组合操作',
            description: '在一次确认中协调任务和日程修改。',
            tools: [
                ['apply_task_operation_plan', '执行任务与日程计划'],
            ],
        },
        {
            id: 'reminders',
            label: '提醒与自动化',
            description: '设置任务提醒和 AI 定时任务。',
            tools: [
                ['configure_task_reminder', '设置任务提醒'],
                ['manage_agent_schedules', '管理 AI 定时任务'],
            ],
        },
        {
            id: 'policy',
            label: '安排规则',
            description: '读取、预览和修改任务规划规则。',
            tools: [
                ['get_task_policy', '读取安排规则'],
                ['preview_task_policy_patch', '预览规则修改'],
                ['apply_task_policy_patch', '应用规则修改'],
            ],
        },
        {
            id: 'stats',
            label: '统计复盘',
            description: '聚合任务完成情况和时间投入。',
            tools: [
                ['aggregate_task_stats', '任务完成统计'],
                ['aggregate_time_usage', '时间投入统计'],
                ['query_focus_statistics', '专注统计'],
                ['query_routine_statistics', '日常统计'],
                ['list_focus_sessions', '专注明细'],
            ],
        },
    ]);
    const MCP_TOOL_NAMES = Object.freeze(MCP_TOOL_GROUPS.flatMap((group) => group.tools.map((tool) => tool[0])));
    const MCP_READ_ONLY_TOOLS = new Set([
        'list_task_scopes', 'get_task', 'query_tasks', 'query_schedules',
        'get_task_policy', 'preview_task_policy_patch', 'aggregate_task_stats', 'aggregate_time_usage',
        'query_focus_statistics', 'query_routine_statistics', 'list_focus_sessions',
    ]);
    const MCP_ACTION_EFFECTS = Object.freeze({
        manage_agent_schedules: Object.freeze({
            list: Object.freeze({ localRead: true }),
            create: Object.freeze({ localWrite: true }),
            update: Object.freeze({ localWrite: true }),
            delete: Object.freeze({ localWrite: true }),
        }),
        delete_task: Object.freeze({
            get: Object.freeze({ localRead: true }),
            delete: Object.freeze({ localWrite: true }),
        }),
        batch_tasks: Object.freeze({
            get: Object.freeze({ localRead: true }),
            apply: Object.freeze({ localWrite: true }),
        }),
        delete_schedule: Object.freeze({
            get: Object.freeze({ localRead: true }),
            delete: Object.freeze({ localWrite: true }),
        }),
        batch_schedules: Object.freeze({
            get: Object.freeze({ localRead: true }),
            apply: Object.freeze({ localWrite: true }),
        }),
    });

    const ERROR = Object.freeze({
        INVALID_ARGUMENT: 'INVALID_ARGUMENT',
        NOT_FOUND: 'NOT_FOUND',
        CONFLICT: 'CONFLICT',
        CONFIRMATION_REQUIRED: 'CONFIRMATION_REQUIRED',
        STALE_REVISION: 'STALE_REVISION',
        STORAGE_MISSING: 'STORAGE_MISSING',
        STORAGE_CORRUPT: 'STORAGE_CORRUPT',
        STORAGE_ERROR: 'STORAGE_ERROR',
        UNSUPPORTED: 'UNSUPPORTED',
    });

    const BUILTIN_FIELDS = Object.freeze([
        { id: 'priority', label: '重要性', type: 'string', attr: 'custom-priority', writable: true },
        { id: 'customStatus', label: '状态', type: 'string', attr: 'custom-status', writable: true },
        { id: 'startDate', label: '开始日期', type: 'date', attr: 'custom-start-date', writable: true, mirror: true },
        { id: 'completionTime', label: '截止日期', type: 'date', attr: 'custom-completion-time', writable: true, mirror: true },
        { id: 'taskCompleteAt', label: '完成时间', type: 'datetime', attr: 'custom-task-complete-at', writable: false, system: true },
        { id: 'duration', label: '预估时长', type: 'duration', attr: 'custom-duration', writable: true },
        { id: 'remark', label: '备注', type: 'string', attr: 'custom-remark', writable: true },
        { id: 'taskDateColor', label: '任务日期颜色', type: 'color', attr: 'custom-task-date-color', writable: true, mirror: true },
        { id: 'customTime', label: '自定义时间', type: 'string', attr: 'custom-time', writable: true, mirror: true },
        { id: 'milestone', label: '里程碑', type: 'boolean', attr: 'custom-milestone-event', writable: true },
        { id: 'pinned', label: '置顶', type: 'boolean', attr: 'custom-pinned', writable: true },
        { id: 'allDayBottom', label: '全天置底', type: 'boolean', attr: 'custom-all-day-bottom', writable: true },
        { id: 'tomatoEstimateCount', label: '预计番茄数', type: 'number', attr: 'custom-tomato-estimate-count', writable: true },
        { id: 'tomatoCount', label: '实际番茄数', type: 'number', attr: 'custom-tomato-count', writable: false, system: true },
        { id: 'tomatoMinutes', label: '实际专注分钟', type: 'number', attr: 'custom-tomato-minutes', writable: false, system: true },
        { id: 'tomatoHours', label: '实际专注小时', type: 'number', attr: 'custom-tomato-time', writable: false, system: true },
    ]);
    const DEFAULT_STATUS_OPTIONS = Object.freeze([
        { id: 'todo', name: '待办', color: '#757575', marker: ' ' },
        { id: 'done', name: '已完成', color: '#4CAF50', marker: 'X' },
        { id: 'cancelled', name: '已取消', color: '#9E9E9E', marker: '-' },
        { id: 'blocked', name: '阻塞', color: '#F44336', marker: ' ' },
        { id: 'review', name: '待审核', color: '#FF9800', marker: ' ' },
    ]);
    const PRIORITY_DEFINITIONS = Object.freeze([
        { id: 'high', name: '高' },
        { id: 'medium', name: '中' },
        { id: 'low', name: '低' },
        { id: 'none', name: '未设置' },
    ]);
    const TASK_READ_FIELDS = Object.freeze([
        'markdown', 'parentListID', 'parentTaskID', 'documentName', 'documentPath', 'created', 'updated',
        'attrHostID', 'attrHostState',
        ...BUILTIN_FIELDS.map((field) => field.id),
        'priorityScore', 'priorityName', 'customStatusName',
        'attachments', 'attachmentCount', 'reminder', 'hasReminder', 'repeatRule', 'repeatState', 'repeatHistory',
        'customFieldValues', 'virtualTask', 'virtualType', 'readOnly', 'sourceTaskID',
    ]);

    class DomainError extends Error {
        constructor(code, message, details) {
            super(String(message || code));
            this.code = code || ERROR.STORAGE_ERROR;
            this.details = details || null;
        }
    }

    const state = {
        mcpEnabled: false,
        mcpAuthorized: false,
        mcpDesiredEnabled: false,
        mcpTools: Object.create(null),
        registeredTools: new Set(),
        taskLanes: new Map(),
        scheduleLane: Promise.resolve(),
        agentScheduleLane: Promise.resolve(),
        deleteTokens: new Map(),
        reminderTokens: new Map(),
        policyTokens: new Map(),
        operationTokens: new Map(),
        taskScopes: new Map(),
        documentGroupSnapshot: null,
        undoRecords: new Map(),
        undoSequence: 0,
        lastUndo: null,
    };

    function nowIso() {
        return new Date().toISOString();
    }

    function text(value) {
        return String(value == null ? '' : value).trim();
    }

    function own(obj, key) {
        return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
    }

    function clampInt(value, min, max, fallback) {
        const parsed = Math.floor(Number(value));
        if (!Number.isFinite(parsed)) return fallback;
        return Math.max(min, Math.min(max, parsed));
    }

    function uniqueStrings(values) {
        const seen = new Set();
        const out = [];
        (Array.isArray(values) ? values : []).forEach((value) => {
            const item = text(value);
            if (!item || seen.has(item)) return;
            seen.add(item);
            out.push(item);
        });
        return out;
    }

    function requireID(value, label) {
        const id = text(value);
        if (!ID_RE.test(id)) throw new DomainError(ERROR.INVALID_ARGUMENT, `${label || 'ID'} 格式无效`);
        return id;
    }

    function escapeSql(value) {
        return String(value == null ? '' : value).replace(/'/g, "''");
    }

    function stableJson(value) {
        if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
        if (value && typeof value === 'object') {
            return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
        }
        return JSON.stringify(value);
    }

    function token(prefix) {
        return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    }

    function newNodeID() {
        const now = new Date();
        const stamp = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, '0'),
            String(now.getDate()).padStart(2, '0'),
            String(now.getHours()).padStart(2, '0'),
            String(now.getMinutes()).padStart(2, '0'),
            String(now.getSeconds()).padStart(2, '0'),
        ].join('');
        const suffix = Math.random().toString(36).slice(2, 9).padEnd(7, '0');
        return `${stamp}-${suffix}`;
    }

    function success(data, meta) {
        return { ok: true, data: data == null ? null : data, error: null, meta: meta || {} };
    }

    function failure(error) {
        const err = error instanceof DomainError
            ? error
            : new DomainError(ERROR.STORAGE_ERROR, text(error && error.message) || '操作失败');
        return {
            ok: false,
            data: null,
            error: { code: err.code, message: err.message, details: err.details || null },
            meta: {},
        };
    }

    async function asResult(handler) {
        const startedAt = Date.now();
        try {
            const value = await handler();
            rememberUndo(state.lastUndo);
            if (value && typeof value === 'object' && typeof value.ok === 'boolean') return value;
            return success(value, { durationMs: Date.now() - startedAt });
        } catch (error) {
            const result = failure(error);
            result.meta.durationMs = Date.now() - startedAt;
            return result;
        }
    }

    async function api(path, body) {
        const response = await siyuan.client.fetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {}),
        });
        let payload;
        try {
            payload = await response.json();
        } catch (error) {
            throw new DomainError(ERROR.STORAGE_ERROR, `思源接口返回无效数据: ${path}`);
        }
        if (!response.ok || !payload || Number(payload.code) !== 0) {
            const message = text(payload && payload.msg) || `思源接口调用失败: ${path}`;
            const code = /not found|不存在/i.test(message) ? ERROR.NOT_FOUND : ERROR.STORAGE_ERROR;
            throw new DomainError(code, message, {
                path,
                status: response.status,
                kernelCode: payload && payload.code,
                data: payload && payload.data,
            });
        }
        return payload.data;
    }

    async function sql(statement) {
        const rows = await api('/api/query/sql', { stmt: statement });
        return Array.isArray(rows) ? rows : [];
    }

    function jsonStorageError(path, record) {
        const status = text(record && record.status) || 'unavailable';
        const cause = text(record && record.error && record.error.message);
        if (status === 'missing') {
            return new DomainError(ERROR.STORAGE_MISSING, `未找到 ${path}`, { path, status, cause });
        }
        if (status === 'corrupt') {
            return new DomainError(ERROR.STORAGE_CORRUPT, `${path} 内容损坏`, { path, status, cause });
        }
        return new DomainError(ERROR.STORAGE_ERROR, `读取 ${path} 失败`, { path, status, cause });
    }

    async function readJsonState(path) {
        try {
            const content = await siyuan.storage.get(path);
            const raw = await content.text();
            if (!text(raw)) {
                return { status: 'corrupt', value: null, error: new Error('empty file') };
            }
            try {
                return { status: 'valid', value: JSON.parse(raw), error: null };
            } catch (error) {
                return { status: 'corrupt', value: null, error };
            }
        } catch (error) {
            const message = text(error && error.message);
            const missing = /(?:not\s+found|not\s+exist|cannot\s+find|enoent|找不到|不存在)/i.test(message);
            return { status: missing ? 'missing' : 'unavailable', value: null, error };
        }
    }

    async function readJson(path, fallback) {
        const record = await readJsonState(path);
        return record.status === 'valid' ? record.value : fallback;
    }

    async function writeJson(path, value) {
        let serialized;
        try {
            serialized = JSON.stringify(value, null, 2);
            await siyuan.storage.put(path, serialized);
        } catch (error) {
            throw new DomainError(ERROR.STORAGE_ERROR, `保存 ${path} 失败`, { cause: text(error && error.message) });
        }
        const verified = await readJsonState(path);
        let expected;
        try { expected = JSON.parse(serialized); }
        catch (error) {
            throw new DomainError(ERROR.STORAGE_ERROR, `保存 ${path} 后无法校验`, { cause: text(error && error.message) });
        }
        if (verified.status !== 'valid' || stableJson(verified.value) !== stableJson(expected)) {
            throw new DomainError(ERROR.STORAGE_ERROR, `保存 ${path} 后回读不一致`, {
                path,
                status: verified.status,
                cause: text(verified.error && verified.error.message),
            });
        }
    }

    async function getSettings() {
        const settings = await readJson(SETTINGS_FILE, {});
        return settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
    }

    function normalizeAttrKey(value, fallback) {
        const candidate = text(value);
        if (candidate && SAFE_ATTR_RE.test(candidate)) return candidate;
        return SAFE_ATTR_RE.test(text(fallback)) ? text(fallback) : '';
    }

    function normalizeCustomFieldID(value) {
        return text(value).toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function customFieldAttr(field) {
        const id = normalizeCustomFieldID(field && field.id) || 'field';
        let name = text(field && field.attrKey);
        if (name.indexOf('custom-tm-') === 0) name = name.slice('custom-tm-'.length);
        name = normalizeCustomFieldID(name) || id;
        return `custom-tm-${name}`;
    }

    function normalizeCustomValue(field, value) {
        const type = text(field && field.type);
        const options = Array.isArray(field && field.options) ? field.options : [];
        const findName = (candidate) => {
            const tokenValue = text(candidate);
            const option = options.find((item) => text(item && item.id) === tokenValue || text(item && item.name) === tokenValue);
            return text(option && option.name) || tokenValue;
        };
        if (type === 'multi') {
            const values = Array.isArray(value) ? value : String(value == null ? '' : value).split(',');
            return uniqueStrings(values.map(findName)).join(', ');
        }
        if (type === 'text') return text(value);
        return findName(value);
    }

    async function getFieldRegistry() {
        const settings = await getSettings();
        const keyOverrides = settings.taskMetaAttrKeys && typeof settings.taskMetaAttrKeys === 'object'
            ? settings.taskMetaAttrKeys
            : {};
        const aliasOverrides = settings.taskMetaAttrKeyAliases && typeof settings.taskMetaAttrKeyAliases === 'object'
            ? settings.taskMetaAttrKeyAliases
            : {};
        const defs = BUILTIN_FIELDS.map((field) => {
            let fallback = field.attr;
            if (field.id === 'tomatoEstimateCount') fallback = text(settings.tomatoEstimateAttrKey) || fallback;
            if (field.id === 'tomatoCount') fallback = text(settings.tomatoCountAttrKey) || fallback;
            if (field.id === 'tomatoMinutes') fallback = text(settings.tomatoSpentAttrKeyMinutes) || fallback;
            if (field.id === 'tomatoHours') fallback = text(settings.tomatoSpentAttrKeyHours) || fallback;
            const attr = normalizeAttrKey(keyOverrides[field.id], fallback) || fallback;
            const aliases = uniqueStrings([
                ...(Array.isArray(aliasOverrides[field.id]) ? aliasOverrides[field.id] : []),
                field.attr,
            ].map((key) => normalizeAttrKey(key, '')).filter(Boolean)).filter((key) => key !== attr);
            return { ...field, attr, aliases };
        });
        const customFields = (Array.isArray(settings.customFieldDefs) ? settings.customFieldDefs : [])
            .map((field) => {
                const id = text(field && field.id);
                if (!id) return null;
                return {
                    ...field,
                    id,
                    label: text(field.name) || id,
                    type: text(field.type) || 'single',
                    attr: customFieldAttr(field),
                    aliases: [],
                    writable: field.agentWritable !== false,
                    custom: true,
                };
            })
            .filter(Boolean);
        const configuredStatusOptions = (Array.isArray(settings.customStatusOptions) ? settings.customStatusOptions : DEFAULT_STATUS_OPTIONS)
            .map((option) => ({
                id: text(option && (option.id || option.value)),
                name: text(option && (option.name || option.label || option.id || option.value)),
                color: text(option && option.color),
                marker: option && Object.prototype.hasOwnProperty.call(option, 'marker') ? String(option.marker ?? '') : '',
            }))
            .filter((option) => option.id);
        const statusOptions = configuredStatusOptions.length ? configuredStatusOptions : DEFAULT_STATUS_OPTIONS.map((option) => ({ ...option }));
        const all = defs.concat(customFields);
        return {
            settings,
            fields: all,
            byId: new Map(all.map((field) => [field.id, field])),
            statusOptions,
            statusById: new Map(statusOptions.map((option) => [option.id, option])),
        };
    }

    function isStrictDateKey(value) {
        const matched = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!matched) return false;
        const year = Number(matched[1]);
        const month = Number(matched[2]);
        const day = Number(matched[3]);
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.getUTCFullYear() === year
            && date.getUTCMonth() === month - 1
            && date.getUTCDate() === day;
    }

    function normalizeDateValue(value, field) {
        const raw = text(value);
        if (!raw) return '';
        if (!/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?(?:\.\d{3})?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(raw)) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, `${field} 日期格式无效`);
        }
        if (!isStrictDateKey(raw.slice(0, 10))) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, `${field} 日期不存在`);
        }
        return raw;
    }

    function normalizeBoolean(value) {
        if (value === true || value === false) return value;
        const raw = text(value).toLowerCase();
        if (raw === '1' || raw === 'true' || raw === 'yes') return true;
        if (!raw || raw === '0' || raw === 'false' || raw === 'no') return false;
        throw new DomainError(ERROR.INVALID_ARGUMENT, '布尔字段格式无效');
    }

    async function normalizeTaskPatch(input, options) {
        const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const opts = options && typeof options === 'object' ? options : {};
        const registry = await getFieldRegistry();
        const out = {};
        if (own(source, 'title')) {
            const title = text(source.title);
            if (!title) throw new DomainError(ERROR.INVALID_ARGUMENT, '任务标题不能为空');
            out.title = title;
        }
        if (own(source, 'done')) out.done = normalizeBoolean(source.done);
        for (const field of registry.fields) {
            if (field.custom || !own(source, field.id)) continue;
            if (!field.writable && opts.allowSystem !== true) {
                throw new DomainError(ERROR.INVALID_ARGUMENT, `${field.id} 为只读字段`);
            }
            const value = source[field.id];
            if (field.type === 'boolean') out[field.id] = normalizeBoolean(value);
            else if (field.type === 'number') {
                if (text(value) === '') out[field.id] = '';
                else {
                    const number = Number(value);
                    if (!Number.isFinite(number) || number < 0) throw new DomainError(ERROR.INVALID_ARGUMENT, `${field.id} 必须是非负数`);
                    out[field.id] = String(number);
                }
            } else if (field.type === 'date' || field.type === 'datetime') out[field.id] = normalizeDateValue(value, field.id);
            else out[field.id] = text(value);
        }
        if (own(source, 'customFieldValues')) {
            const values = source.customFieldValues;
            if (!values || typeof values !== 'object' || Array.isArray(values)) {
                throw new DomainError(ERROR.INVALID_ARGUMENT, 'customFieldValues 必须是对象');
            }
            const custom = {};
            Object.keys(values).forEach((fieldID) => {
                const field = registry.byId.get(fieldID);
                if (!field || !field.custom || !field.writable) {
                    throw new DomainError(ERROR.INVALID_ARGUMENT, `未注册或不可写的自定义字段: ${fieldID}`);
                }
                custom[fieldID] = normalizeCustomValue(field, values[fieldID]);
            });
            out.customFieldValues = custom;
        }
        if (own(source, 'attachments')) {
            if (!Array.isArray(source.attachments)) throw new DomainError(ERROR.INVALID_ARGUMENT, 'attachments 必须是数组');
            out.attachments = uniqueStrings(source.attachments.map((item) => text(item?.path || item?.assetPath || item)));
        }
        ['repeatRule', 'repeatState', 'repeatHistory', 'reminder'].forEach((key) => {
            if (own(source, key)) out[key] = source[key] == null || source[key] === '' ? null : source[key];
        });
        const allowed = new Set([
            'title', 'done', 'customFieldValues', 'attachments', 'repeatRule', 'repeatState', 'repeatHistory', 'reminder',
            ...registry.fields.map((field) => field.id),
        ]);
        const unknown = Object.keys(source).filter((key) => !allowed.has(key));
        if (unknown.length) throw new DomainError(ERROR.INVALID_ARGUMENT, `不支持的任务字段: ${unknown.join(', ')}`);
        return { patch: out, registry };
    }

    function buildAttrPayload(patch, registry, taskID) {
        const attrs = {};
        Object.keys(patch || {}).forEach((fieldID) => {
            if (fieldID === 'title' || fieldID === 'done' || fieldID === 'customFieldValues') return;
            const field = registry.byId.get(fieldID);
            if (!field || !field.attr) return;
            const value = patch[fieldID];
            attrs[field.attr] = field.type === 'boolean' ? (value ? '1' : '') : String(value == null ? '' : value);
        });
        const custom = patch && patch.customFieldValues;
        if (custom && typeof custom === 'object') {
            Object.keys(custom).forEach((fieldID) => {
                const field = registry.byId.get(fieldID);
                if (field && field.custom && field.attr) attrs[field.attr] = String(custom[fieldID] == null ? '' : custom[fieldID]);
            });
        }
        if (own(patch, 'repeatRule')) attrs[REPEAT_ATTRS[0]] = patch.repeatRule == null ? '' : JSON.stringify(patch.repeatRule);
        if (own(patch, 'repeatState')) attrs[REPEAT_ATTRS[1]] = patch.repeatState == null ? '' : JSON.stringify(patch.repeatState);
        if (own(patch, 'repeatHistory')) attrs[REPEAT_ATTRS[2]] = patch.repeatHistory == null ? '' : JSON.stringify(patch.repeatHistory);
        if (own(patch, 'reminder')) attrs[REMINDER_ATTR] = patch.reminder == null ? '' : JSON.stringify(patch.reminder);
        if (Object.keys(attrs).length) {
            attrs[ATTR_OWNER] = taskID;
            attrs[ATTR_UPDATED_AT] = String(Date.now());
        }
        return attrs;
    }

    async function appendAttachmentAttrPayload(taskID, patch, attrs) {
        if (!own(patch, 'attachments')) return attrs;
        const current = await readAttrs(taskID);
        Object.keys(current).forEach((key) => {
            if (key.startsWith(ATTACHMENT_ATTR_PREFIX)
                && /^\d+$/.test(key.slice(ATTACHMENT_ATTR_PREFIX.length))) attrs[key] = '';
        });
        const paths = Array.isArray(patch.attachments) ? patch.attachments : [];
        paths.forEach((path, index) => { attrs[`${ATTACHMENT_ATTR_PREFIX}${index + 1}`] = text(path); });
        attrs[ATTACHMENT_META_ATTR] = paths.length
            ? JSON.stringify(paths.map((path) => ({ path: text(path), addedAt: Date.now() })))
            : '';
        return attrs;
    }

    function parseDone(markdown) {
        const line = String(markdown || '').split(/\r?\n/, 1)[0];
        const matched = line.match(/^\s*[*+-]\s+\[([^\]\r\n]?)\]/);
        const marker = matched ? String(matched[1] || '') : '';
        return !!marker && marker !== ' ';
    }

    const TASK_MARKER_PATTERN = /^([ \t]*)((?:[-*+]|\d+[.)]))[ \t]*(?:(?:\{:[ \t]*[^}\r\n]*\})[ \t]*)*\[([^\]\r\n]?)\][ \t]*/;

    function locateTaskOwnTitle(row) {
        const markdown = String(row && row.markdown || '');
        const lines = markdown.split(/\r?\n/);
        const firstLine = String(lines[0] || '');
        const markerMatch = TASK_MARKER_PATTERN.exec(firstLine);
        if (!markerMatch) {
            return { lines, markerMatch: null, lineIndex: 0, title: text(firstLine) };
        }

        const inlineTitle = text(firstLine.slice(markerMatch[0].length));
        if (inlineTitle) {
            return { lines, markerMatch, lineIndex: 0, title: inlineTitle };
        }

        const markerIndent = markerMatch[1].replace(/\t/g, '    ').length;
        for (let index = 1; index < lines.length; index += 1) {
            const line = String(lines[index] || '');
            const trimmed = line.trim();
            if (!trimmed || /^\{:[ \t]*[^}]*\}$/.test(trimmed)) continue;

            const indentation = (line.match(/^[ \t]*/) || [''])[0];
            if (indentation.replace(/\t/g, '    ').length <= markerIndent) break;
            const content = line.slice(indentation.length);
            if (/^(?:[-*+]|\d+[.)])(?:[ \t]+|$)/.test(content)) break;
            return { lines, markerMatch, lineIndex: index, indentation, title: text(content) };
        }
        return { lines, markerMatch, lineIndex: -1, title: '' };
    }

    function taskOwnTitle(row) {
        const located = locateTaskOwnTitle(row);
        if (located.title || located.markerMatch) return located.title;
        return text(row && row.raw_content);
    }

    function normalizeReminderTaskLookupTitle(value) {
        return text(value)
            .normalize('NFKC')
            .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
            .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
            .replace(/\\([\\`*_[\]{}()#+\-.!>])/g, '$1')
            .replace(/(?:\*\*|__|~~|`)/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLocaleLowerCase();
    }

    function reminderTaskTitleDistance(leftValue, rightValue) {
        const left = Array.from(normalizeReminderTaskLookupTitle(leftValue));
        const right = Array.from(normalizeReminderTaskLookupTitle(rightValue));
        if (!left.length) return right.length;
        if (!right.length) return left.length;
        let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
        for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
            const current = [leftIndex];
            for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
                current[rightIndex] = Math.min(
                    current[rightIndex - 1] + 1,
                    previous[rightIndex] + 1,
                    previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
                );
            }
            previous = current;
        }
        return previous[right.length];
    }

    function reminderTaskFuzzyTerms(value) {
        const characters = Array.from(normalizeReminderTaskLookupTitle(value).replace(/\s+/g, ''));
        if (characters.length < 3) return [];
        const size = characters.length >= 4 ? 2 : 1;
        const terms = [];
        for (let index = 0; index <= characters.length - size; index += 1) {
            const term = characters.slice(index, index + size).join('');
            if (term && !terms.includes(term)) terms.push(term);
        }
        return terms.slice(0, 16);
    }

    function reminderTaskFuzzyDistanceLimit(leftValue, rightValue) {
        const length = Math.max(
            Array.from(normalizeReminderTaskLookupTitle(leftValue)).length,
            Array.from(normalizeReminderTaskLookupTitle(rightValue)).length,
        );
        return length < 3 ? 0 : Math.min(3, Math.max(1, Math.floor(length * 0.2)));
    }

    async function readBlockDOM(blockID) {
        const id = requireID(blockID, '块 ID');
        const result = await api('/api/block/getBlockDOM', { id });
        const dom = String(result?.dom || '').trim();
        if (!dom || !dom.includes(`data-node-id="${id}"`)) {
            throw new DomainError(ERROR.STORAGE_ERROR, '读取到的任务块 DOM 与任务 ID 不一致', { taskID: id });
        }
        return dom;
    }

    function normalizeTaskMarker(value, fallback = ' ') {
        let raw = value == null ? '' : String(value);
        if (raw === '__space__') raw = ' ';
        const first = Array.from(raw)[0] || '';
        const marker = first && first !== '[' && first !== ']' ? first : '';
        if (marker) {
            try {
                if (typeof TextEncoder === 'undefined' || new TextEncoder().encode(marker).length === 1) return marker;
            } catch (error) {}
        }
        return fallback === value ? ' ' : normalizeTaskMarker(fallback, ' ');
    }

    function guessStatusMarker(option) {
        const source = `${text(option?.id)} ${text(option?.name)}`.toLowerCase();
        if (/cancel|取消|放弃/.test(source)) return '-';
        if (/\bdone\b|完成/.test(source)) return 'X';
        return ' ';
    }

    function statusOptionMarker(option) {
        const fallback = guessStatusMarker(option);
        return normalizeTaskMarker(option?.marker, fallback);
    }

    function isTaskMarkerDone(marker) {
        return normalizeTaskMarker(marker, ' ') !== ' ';
    }

    function replaceTaskDOMMarker(dom, marker) {
        let next = String(dom || '');
        const nextMarker = normalizeTaskMarker(marker, ' ');
        const done = isTaskMarkerDone(nextMarker);
        if (/\bdata-task="[^"]*"/.test(next)) next = next.replace(/\bdata-task="[^"]*"/, `data-task="${nextMarker}"`);
        else next = next.replace(/(<div\b[^>]*\bdata-type="NodeListItem"[^>]*)(>)/, `$1 data-task="${nextMarker}"$2`);
        next = next.replace(/(<div\b[^>]*\bdata-type="NodeListItem"[^>]*\bclass=")([^"]*)(")/, (all, before, classes, after) => {
            const tokens = String(classes || '').split(/\s+/).filter((name) => name && name !== 'protyle-task--done');
            if (done) tokens.push('protyle-task--done');
            return `${before}${Array.from(new Set(tokens)).join(' ')}${after}`;
        });
        next = next.replace(/#icon(?:Uncheck|Check)/, done ? '#iconCheck' : '#iconUncheck');
        return next;
    }

    function replaceTaskDOMDone(dom, done) {
        return replaceTaskDOMMarker(dom, done ? 'X' : ' ');
    }

    function escapeTaskDOMText(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function replaceTaskDOMTitle(dom, title) {
        const source = String(dom || '');
        const pattern = /(<div\b[^>]*\bdata-type="NodeParagraph"[^>]*>)[\s\S]*?(<div\b[^>]*\bclass="[^"]*protyle-attr[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>)/;
        if (!pattern.test(source)) {
            throw new DomainError(ERROR.STORAGE_ERROR, '任务块中未找到可更新的标题段落');
        }
        const content = `<div contenteditable="true">${escapeTaskDOMText(title)}</div>`;
        return source.replace(pattern, `$1${content}$2`);
    }

    async function verifyTaskDirect(taskID, expected = {}) {
        const id = requireID(taskID, '任务 ID');
        const source = expected && typeof expected === 'object' ? expected : {};
        if (own(source, 'marker')) {
            const dom = await readBlockDOM(id);
            const matched = dom.match(/\bdata-task="([^"]*)"/);
            const actualMarker = normalizeTaskMarker(matched?.[1], ' ');
            const expectedMarker = normalizeTaskMarker(source.marker, ' ');
            if (actualMarker !== expectedMarker) {
                throw new DomainError(ERROR.CONFLICT, '任务状态标记写入后校验失败', {
                    taskID: id,
                    expectedMarker,
                    actualMarker,
                });
            }
        }
        const attrs = source.attrs && typeof source.attrs === 'object' ? source.attrs : null;
        if (attrs && Object.keys(attrs).length) {
            const actual = await readAttrs(id);
            const mismatch = Object.entries(attrs).find(([key, value]) => String(actual[key] == null ? '' : actual[key]) !== String(value == null ? '' : value));
            if (mismatch) {
                throw new DomainError(ERROR.CONFLICT, '任务字段写入后校验失败', { taskID: id, field: mismatch[0] });
            }
        }
        return true;
    }

    async function getTaskRow(taskID) {
        const id = requireID(taskID, '任务 ID');
        const rows = await sql(`
            SELECT
                task.id,
                task.markdown,
                task.content AS raw_content,
                task.parent_id,
                task.root_id,
                task.box,
                task.path AS block_path,
                task.sort AS block_sort,
                task.created,
                task.updated,
                COALESCE(doc.content, '') AS doc_name,
                COALESCE(doc.hpath, '') AS doc_path,
                COALESCE(parent.type, '') AS parent_type,
                COALESCE(CASE WHEN list_parent.type = 'i' AND list_parent.subtype = 't' THEN list_parent.id ELSE '' END, '') AS parent_task_id,
                (SELECT s.id FROM blocks s
                    WHERE s.parent_id = task.parent_id AND s.id <> task.id
                    AND (s.sort < task.sort OR (s.sort = task.sort AND s.created < task.created)
                        OR (s.sort = task.sort AND s.created = task.created AND s.id < task.id))
                    ORDER BY s.sort DESC, s.created DESC, s.id DESC LIMIT 1) AS previous_sibling_id,
                (SELECT s.id FROM blocks s
                    WHERE s.parent_id = task.parent_id AND s.id <> task.id
                    AND (s.sort > task.sort OR (s.sort = task.sort AND s.created > task.created)
                        OR (s.sort = task.sort AND s.created = task.created AND s.id > task.id))
                    ORDER BY s.sort ASC, s.created ASC, s.id ASC LIMIT 1) AS next_sibling_id,
                (SELECT COUNT(*) FROM blocks s WHERE s.parent_id = task.parent_id AND s.type = 'i' AND s.subtype = 't') AS parent_task_count,
                (SELECT id FROM blocks s WHERE s.parent_id = task.parent_id AND s.type = 'i' AND s.subtype = 't' ORDER BY s.sort ASC, s.created ASC, s.id ASC LIMIT 1) AS first_task_id
            FROM blocks task
            LEFT JOIN blocks doc ON doc.id = task.root_id
            LEFT JOIN blocks parent ON parent.id = task.parent_id
            LEFT JOIN blocks list_parent ON list_parent.id = parent.parent_id
            WHERE task.id = '${escapeSql(id)}' AND task.type = 'i' AND task.subtype = 't'
            LIMIT 1
        `);
        if (!rows.length) throw new DomainError(ERROR.NOT_FOUND, '未找到任务', { taskID: id });
        return rows[0];
    }

    async function getBlockRole(blockID, label) {
        const id = requireID(blockID, label || '块 ID');
        const rows = await sql(`SELECT id, parent_id, root_id, type, subtype FROM blocks WHERE id = '${escapeSql(id)}' LIMIT 1`);
        if (!rows.length) throw new DomainError(ERROR.NOT_FOUND, `未找到${label || '块'}`, { blockID: id });
        const row = rows[0];
        return {
            id,
            parentID: text(row.parent_id),
            rootID: text(row.root_id),
            type: text(row.type).toLowerCase(),
            subtype: text(row.subtype).toLowerCase(),
        };
    }

    async function requireDocumentBlock(documentID) {
        const block = await getBlockRole(documentID, '目标文档');
        if (block.type !== 'd') {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '目标文档 ID 必须指向文档块', { blockID: block.id, actualType: block.type });
        }
        return block;
    }

    function buildAttrContext(row) {
        const taskID = text(row && row.id);
        const parentID = text(row && row.parent_id);
        const parentType = text(row && row.parent_type).toLowerCase();
        const count = Number(row && row.parent_task_count);
        const firstTaskID = text(row && row.first_task_id);
        if (parentType !== 'l') {
            return {
                taskID,
                parentListID: '',
                state: 'invalid-list-item',
                primaryHostID: taskID,
                legacyHostIDs: [],
                mirrorHostIDs: [],
            };
        }
        if (parentType === 'l' && count === 1 && (!firstTaskID || firstTaskID === taskID)) {
            return {
                taskID,
                parentListID: parentID,
                state: 'state1-parent',
                primaryHostID: taskID,
                legacyHostIDs: [],
                mirrorHostIDs: [],
            };
        }
        if (parentType === 'l' && count > 1 && firstTaskID === taskID) {
            return {
                taskID,
                parentListID: parentID,
                state: 'state3-list-item',
                primaryHostID: taskID,
                legacyHostIDs: [],
                mirrorHostIDs: [],
            };
        }
        return {
            taskID,
            parentListID: parentID,
            state: 'state2-list-item',
            primaryHostID: taskID,
            // A parent-list attribute could only ever belong to its first task.
            // Letting later siblings read it leaks legacy metadata across tasks.
            legacyHostIDs: [],
            mirrorHostIDs: [],
        };
    }

    async function resolveTaskBinding(blockID, control = {}) {
        let current = requireID(blockID, '块 ID');
        for (let depth = 0; depth < 30; depth += 1) {
            assertFocusStatsDeadline(control, 'task-binding-resolve');
            const row = await getBlockRole(current, '块');
            const type = row.type;
            const subtype = row.subtype;
            if (type === 'i' && subtype === 't') {
                const task = await getTaskRow(row.id);
                const context = buildAttrContext(task);
                return { taskID: task.id, task, ...context };
            }
            if (type === 'l') {
                const tasks = await sql(`SELECT id FROM blocks WHERE parent_id = '${escapeSql(row.id)}' AND type = 'i' AND subtype = 't' ORDER BY sort ASC, created ASC, id ASC LIMIT 2`);
                if (tasks.length) {
                    const task = await getTaskRow(tasks[0].id);
                    const context = buildAttrContext(task);
                    return { taskID: task.id, task, ...context };
                }
            }
            const parentID = row.parentID;
            if (!parentID || parentID === current) break;
            current = parentID;
        }
        throw new DomainError(ERROR.NOT_FOUND, '该块不属于任务');
    }

    async function readAttrs(blockID) {
        const data = await api('/api/attr/getBlockAttrs', { id: requireID(blockID, '属性宿主 ID') });
        return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    }

    async function setAttrs(blockID, attrs) {
        if (!attrs || !Object.keys(attrs).length) return;
        await api('/api/attr/setBlockAttrs', { id: requireID(blockID, '属性宿主 ID'), attrs });
    }

    async function readTaskAttributes(binding, registry) {
        const primaryAttrs = await readAttrs(binding.taskID);
        return decodeTaskAttributes(primaryAttrs, registry);
    }

    function decodeTaskAttributes(primaryAttrsInput, registry) {
        const primaryAttrs = primaryAttrsInput && typeof primaryAttrsInput === 'object' ? primaryAttrsInput : {};
        const secondaryAttrs = null;
        const hostAttrs = primaryAttrs;
        const fields = {};
        const customFieldValues = {};
        registry.fields.forEach((field) => {
            const keys = uniqueStrings([field.attr].concat(field.aliases || []));
            let value = '';
            const sources = [primaryAttrs];
            for (const source of sources) {
                if (!source) continue;
                for (const key of keys) {
                    if (own(source, key) && String(source[key] == null ? '' : source[key]) !== '') {
                        value = String(source[key]);
                        break;
                    }
                }
                if (value !== '') break;
            }
            if (field.custom) customFieldValues[field.id] = value;
            else if (field.type === 'boolean') fields[field.id] = value === '1' || value === 'true';
            else if (field.type === 'number') fields[field.id] = value === '' ? null : Number(value);
            else fields[field.id] = value;
        });
        fields.customFieldValues = customFieldValues;
        const readOwnedValue = (key) => {
            if (own(primaryAttrs, key)) return String(primaryAttrs[key] == null ? '' : primaryAttrs[key]);
            if (secondaryAttrs && own(secondaryAttrs, key)) return String(secondaryAttrs[key] == null ? '' : secondaryAttrs[key]);
            return '';
        };
        const parseStructuredValue = (value) => {
            const raw = text(value);
            if (!raw) return null;
            try { return JSON.parse(raw); } catch (error) { return raw; }
        };
        const attachmentKeys = uniqueStrings(Object.keys(primaryAttrs).concat(Object.keys(secondaryAttrs || {})))
            .filter((key) => key.startsWith(ATTACHMENT_ATTR_PREFIX) && /^\d+$/.test(key.slice(ATTACHMENT_ATTR_PREFIX.length)))
            .sort((left, right) => Number(left.slice(ATTACHMENT_ATTR_PREFIX.length)) - Number(right.slice(ATTACHMENT_ATTR_PREFIX.length)));
        const attachmentMeta = parseStructuredValue(readOwnedValue(ATTACHMENT_META_ATTR));
        const attachmentMetaItems = Array.isArray(attachmentMeta)
            ? attachmentMeta
            : (Array.isArray(attachmentMeta && attachmentMeta.items) ? attachmentMeta.items : []);
        const attachmentAddedAt = new Map(attachmentMetaItems.map((item) => [text(item && (item.path || item.assetPath || item.value)), Number(item && (item.addedAt || item.added_at || item.ts)) || 0]));
        fields.attachments = attachmentKeys.map((key) => readOwnedValue(key)).map(text).filter(Boolean).map((path) => ({
            path,
            name: (() => {
                const clean = path.replace(/^block:/, '').split(/[?#]/)[0];
                const parts = clean.split(/[\\/]+/).filter(Boolean);
                try { return decodeURIComponent(parts[parts.length - 1] || clean); } catch (error) { return parts[parts.length - 1] || clean; }
            })(),
            kind: path.startsWith('block:') ? 'block-ref' : (path.startsWith('file:') ? 'local-path' : 'asset'),
            addedAt: attachmentAddedAt.get(path) || 0,
        }));
        fields.attachmentCount = fields.attachments.length;
        fields.reminder = parseStructuredValue(readOwnedValue('custom-tomato-reminder'));
        fields.hasReminder = fields.reminder != null;
        fields.repeatRule = parseStructuredValue(readOwnedValue('custom-task-repeat-rule'));
        fields.repeatState = parseStructuredValue(readOwnedValue('custom-task-repeat-state'));
        fields.repeatHistory = parseStructuredValue(readOwnedValue('custom-task-repeat-history'));
        return fields;
    }

    function customFieldDefinitions(registry) {
        return registry.fields.filter((field) => field.custom).map((field) => {
            const options = (Array.isArray(field.options) ? field.options : []).map((option) => {
                const id = text(option && option.id);
                return {
                    id,
                    label: text(option && (option.name || option.label)) || id,
                    parentID: text(option && (option.parentID || option.parentId)),
                    archived: option?.archived === true,
                };
            }).filter((option) => option.id);
            const optionByID = new Map(options.map((option) => [option.id, option]));
            const parentByID = new Map(options.map((option) => [
                option.id,
                option.parentID && option.parentID !== option.id && optionByID.has(option.parentID) ? option.parentID : '',
            ]));
            const cyclicIDs = new Set();
            options.forEach((option) => {
                const chain = [];
                const positions = new Map();
                let currentID = option.id;
                while (currentID && optionByID.has(currentID) && !positions.has(currentID)) {
                    positions.set(currentID, chain.length);
                    chain.push(currentID);
                    currentID = parentByID.get(currentID) || '';
                }
                if (currentID && positions.has(currentID)) {
                    chain.slice(positions.get(currentID)).forEach((id) => cyclicIDs.add(id));
                }
            });
            cyclicIDs.forEach((id) => parentByID.set(id, ''));
            const serializedOptions = options.map((option) => {
                const lineage = [];
                let current = option;
                while (current) {
                    lineage.unshift(current);
                    current = optionByID.get(parentByID.get(current.id) || '') || null;
                }
                const ancestorIDs = lineage.slice(0, -1).map((item) => item.id);
                return {
                    id: option.id,
                    label: option.label,
                    parentID: parentByID.get(option.id) || '',
                    depth: ancestorIDs.length,
                    path: lineage.map((item) => item.label).join(' / '),
                    ancestorIDs,
                    archived: option.archived,
                    effectiveArchived: lineage.some((item) => item.archived),
                };
            });
            return {
                id: field.id,
                label: text(field.label || field.name) || field.id,
                type: text(field.type) || 'single',
                attr: text(field.attr),
                maxDepth: 3,
                options: serializedOptions,
            };
        });
    }

    function statusDefinitions(registry) {
        return (Array.isArray(registry && registry.statusOptions) ? registry.statusOptions : []).map((option) => ({
            id: text(option.id),
            name: text(option.name) || text(option.id),
            color: text(option.color),
            marker: statusOptionMarker(option),
        }));
    }

    function priorityDefinitions() {
        return PRIORITY_DEFINITIONS.map((item) => ({ ...item }));
    }

    function resolveStatusName(value, registry) {
        const id = text(value);
        if (!id) return '未设置';
        return text(registry?.statusById?.get(id)?.name) || id;
    }

    function resolvePriorityName(value) {
        const id = text(value).toLowerCase();
        if (!id || id === 'none') return '未设置';
        const matched = PRIORITY_DEFINITIONS.find((item) => item.id === id);
        return matched ? matched.name : text(value);
    }

    function applyTaskDisplayNames(dto, registry) {
        const task = dto && typeof dto === 'object' ? dto : {};
        task.customStatusName = resolveStatusName(task.customStatus, registry);
        task.priorityName = resolvePriorityName(task.priority);
        return task;
    }

    function shouldIncludeTaskFieldMetadata(fields, fieldID, nameFieldID) {
        return !Array.isArray(fields) || !fields.length || fields.includes(fieldID) || fields.includes(nameFieldID);
    }

    function projectTaskDTO(dto, fields, extraAlways) {
        if (!Array.isArray(fields) || !fields.length) return { ...dto };
        const always = new Set(['id', 'title', 'done', 'documentID'].concat(Array.isArray(extraAlways) ? extraAlways : []));
        if (fields.includes('customStatus')) always.add('customStatusName');
        if (fields.includes('priority')) always.add('priorityName');
        const selected = {};
        Object.keys(dto || {}).forEach((key) => {
            if (always.has(key) || fields.includes(key)) selected[key] = dto[key];
        });
        return selected;
    }

    async function taskDTO(rowOrID, fields, registryInput) {
        const row = typeof rowOrID === 'string' ? await getTaskRow(rowOrID) : rowOrID;
        const context = buildAttrContext(row);
        const registry = registryInput || await getFieldRegistry();
        const attrs = await readTaskAttributes({ taskID: row.id, ...context }, registry);
        const dto = {
            id: text(row.id),
            title: taskOwnTitle(row),
            markdown: String(row.markdown || ''),
            done: parseDone(row.markdown),
            parentListID: text(row.parent_id),
            parentTaskID: text(row.parent_task_id),
            parentType: text(row.parent_type),
            previousSiblingID: text(row.previous_sibling_id),
            nextSiblingID: text(row.next_sibling_id),
            firstTaskID: text(row.first_task_id),
            documentID: text(row.root_id),
            documentName: text(row.doc_name),
            documentPath: text(row.doc_path),
            created: text(row.created),
            updated: text(row.updated),
            attrHostID: context.primaryHostID,
            attrHostState: context.state,
            priorityScore: null,
            ...attrs,
        };
        return projectTaskDTO(applyTaskDisplayNames(dto, registry), fields);
    }

    async function taskPlacementDTO(rowOrID) {
        const taskID = typeof rowOrID === 'string' ? rowOrID : rowOrID?.id;
        const source = rowOrID && typeof rowOrID === 'object' ? rowOrID : {};
        const parentType = text(source.parent_type || source.parentType).toLowerCase();
        const preferredListID = text(source.parentListID || source.parentListId)
            || (parentType === 'l' || parentType === 'nodelist' ? text(source.parent_id || source.parentID) : '');
        return readTaskPlacementFromTree(taskID, preferredListID);
    }

    function applyScopedTaskValues(dto, taskID, fields, scope) {
        const value = scope && scope.taskValues instanceof Map ? scope.taskValues.get(text(taskID)) : null;
        const includes = (field) => !Array.isArray(fields) || !fields.length || fields.includes(field);
        if (includes('priorityScore')) dto.priorityScore = value && Number.isFinite(Number(value.priorityScore)) ? Number(value.priorityScore) : null;
        ['tomatoMinutes', 'tomatoHours', 'tomatoCount'].forEach((field) => {
            if (includes(field) && value && Number.isFinite(Number(value[field]))) dto[field] = Number(value[field]);
        });
        return dto;
    }

    async function getTaskDTO(taskID, fields, scopeToken) {
        const registry = await getFieldRegistry();
        const dto = await taskDTO(taskID, fields, registry);
        const scope = text(scopeToken) ? normalizeTaskScope({ scopeToken }) : null;
        if (scope) {
            const inTaskSet = scope.taskIDs.includes(dto.id);
            const inDocumentSet = scope.scopeMode === 'documents' && scope.documentIDs.includes(dto.documentID);
            if (!inTaskSet && !inDocumentSet) throw new DomainError(ERROR.NOT_FOUND, '任务不属于指定范围');
        }
        applyScopedTaskValues(dto, dto.id, fields, scope);
        if (!Array.isArray(fields) || !fields.length || fields.includes('customFieldValues')) {
            dto.customFieldDefinitions = customFieldDefinitions(registry);
        }
        if (shouldIncludeTaskFieldMetadata(fields, 'customStatus', 'customStatusName')) dto.statusDefinitions = statusDefinitions(registry);
        if (shouldIncludeTaskFieldMetadata(fields, 'priority', 'priorityName')) dto.priorityDefinitions = priorityDefinitions();
        return dto;
    }

    async function getTaskDTOByReference(taskID, fields, scopeToken) {
        const rawID = text(taskID);
        if (VIRTUAL_TASK_ID_RE.test(rawID)) {
            if (!text(scopeToken)) throw new DomainError(ERROR.NOT_FOUND, '循环虚拟任务需要有效的任务范围令牌');
            const scope = normalizeTaskScope({ scopeToken });
            const virtualTask = scope.virtualTaskMap.get(rawID);
            if (!virtualTask) throw new DomainError(ERROR.NOT_FOUND, '循环虚拟任务不属于指定范围');
            const registry = await getFieldRegistry();
            const dto = projectTaskDTO(applyTaskDisplayNames({ ...virtualTask }, registry), fields, ['virtualTask', 'virtualType', 'readOnly', 'sourceTaskID']);
            if (!Array.isArray(fields) || !fields.length || fields.includes('customFieldValues')) {
                dto.customFieldDefinitions = customFieldDefinitions(registry);
            }
            if (shouldIncludeTaskFieldMetadata(fields, 'customStatus', 'customStatusName')) dto.statusDefinitions = statusDefinitions(registry);
            if (shouldIncludeTaskFieldMetadata(fields, 'priority', 'priorityName')) dto.priorityDefinitions = priorityDefinitions();
            return dto;
        }
        const binding = await resolveTaskBinding(rawID);
        return getTaskDTO(binding.taskID, fields, scopeToken);
    }

    function runTaskLane(taskID, handler) {
        const id = text(taskID);
        const previous = state.taskLanes.get(id) || Promise.resolve();
        const next = previous.catch(() => null).then(handler);
        state.taskLanes.set(id, next);
        const cleanup = () => {
            if (state.taskLanes.get(id) === next) state.taskLanes.delete(id);
        };
        next.then(cleanup, cleanup);
        return next;
    }

    function runTaskLanes(taskIDs, handler) {
        const ids = uniqueStrings(taskIDs).sort();
        if (!ids.length) return Promise.resolve().then(handler);
        const previous = ids.map((id) => state.taskLanes.get(id) || Promise.resolve());
        const next = Promise.all(previous.map((item) => item.catch(() => null))).then(handler);
        ids.forEach((id) => state.taskLanes.set(id, next));
        const cleanup = () => {
            ids.forEach((id) => {
                if (state.taskLanes.get(id) === next) state.taskLanes.delete(id);
            });
        };
        next.then(cleanup, cleanup);
        return next;
    }

    function runScheduleLane(handler) {
        const next = state.scheduleLane.catch(() => null).then(handler);
        state.scheduleLane = next;
        return next;
    }

    async function persistTaskAttrs(binding, attrs) {
        if (!Object.keys(attrs || {}).length) return;
        const operations = await buildTaskAttrWriteOperations(binding, attrs);
        await pushTaskTransaction(operations);
    }

    function taskOwnedAttrKeys(registry) {
        const keys = new Set([ATTACHMENT_META_ATTR, REMINDER_ATTR, ...REPEAT_ATTRS]);
        registry.fields.forEach((field) => {
            if (field.attr) keys.add(field.attr);
            (Array.isArray(field.aliases) ? field.aliases : []).forEach((key) => keys.add(key));
        });
        return keys;
    }

    function activeAttrValue(attrs, key) {
        return own(attrs, key) ? String(attrs[key] == null ? '' : attrs[key]) : '';
    }

    function activeAttachmentAttrs(attrs) {
        const out = {};
        Object.keys(attrs || {}).sort().forEach((key) => {
            if (!key.startsWith(ATTACHMENT_ATTR_PREFIX)) return;
            const value = activeAttrValue(attrs, key);
            if (value !== '') out[key] = value;
        });
        return out;
    }

    async function listTaskAttrMigrationCandidates(registry) {
        const exactKeys = Array.from(taskOwnedAttrKeys(registry));
        const conditions = exactKeys.map((key) => `a.name = '${escapeSql(key)}'`);
        conditions.push(`a.name LIKE '${escapeSql(ATTACHMENT_ATTR_PREFIX)}%'`);
        const candidates = [];
        const pageSize = 500;
        for (let offset = 0; ; offset += pageSize) {
            const rows = await sql(`
                SELECT DISTINCT a.block_id AS id
                FROM attributes a
                JOIN blocks b ON b.id = a.block_id
                WHERE b.type = 'l' AND (${conditions.join(' OR ')})
                ORDER BY a.block_id
                LIMIT ${pageSize} OFFSET ${offset}
            `);
            candidates.push(...rows.map((row) => text(row.id)).filter(Boolean));
            if (rows.length < pageSize) break;
        }
        return uniqueStrings(candidates);
    }

    function planSingleAttrMigration(sourceAttrs, itemAttrs, key, itemPatch, parentPatch, conflicts) {
        const sourceValue = activeAttrValue(sourceAttrs, key);
        if (sourceValue === '') return { copied: 0, cleared: 0 };
        if (!own(itemAttrs, key)) {
            itemPatch[key] = sourceValue;
            parentPatch[key] = '';
            return { copied: 1, cleared: 1 };
        }
        if (activeAttrValue(itemAttrs, key) === sourceValue) {
            parentPatch[key] = '';
            return { copied: 0, cleared: 1 };
        }
        conflicts.push(key);
        return { copied: 0, cleared: 0 };
    }

    async function migrateListTaskAttrs(listID, registry) {
        const sourceAttrs = await readAttrs(listID);
        const taskRows = await sql(`
            SELECT id FROM blocks
            WHERE parent_id = '${escapeSql(listID)}' AND type = 'i' AND subtype = 't'
            ORDER BY sort ASC, created ASC, id ASC LIMIT 2
        `);
        if (!taskRows.length) return { status: 'skipped-empty' };

        const taskID = requireID(taskRows[0].id, '迁移目标任务 ID');
        const owner = text(sourceAttrs[ATTR_OWNER]);
        if (taskRows.length === 1) {
            if (owner && owner !== taskID) return { status: 'skipped-owner', taskID, owner };
        } else if (!owner || owner !== taskID) {
            return { status: owner ? 'skipped-owner' : 'skipped-ambiguous', taskID, owner };
        }

        const itemAttrs = await readAttrs(taskID);
        const itemPatch = {};
        const parentPatch = {};
        const conflicts = [];
        let copied = 0;
        let cleared = 0;
        const exactKeys = Array.from(taskOwnedAttrKeys(registry)).filter((key) => (
            key !== ATTACHMENT_META_ATTR && key !== REMINDER_ATTR
        ));
        exactKeys.forEach((key) => {
            const result = planSingleAttrMigration(sourceAttrs, itemAttrs, key, itemPatch, parentPatch, conflicts);
            copied += result.copied;
            cleared += result.cleared;
        });

        const sourceAttachments = activeAttachmentAttrs(sourceAttrs);
        const itemAttachments = activeAttachmentAttrs(itemAttrs);
        const sourceAttachmentKeys = Object.keys(sourceAttachments);
        if (sourceAttachmentKeys.length) {
            if (!Object.keys(itemAttachments).length) {
                Object.assign(itemPatch, sourceAttachments);
                sourceAttachmentKeys.forEach((key) => { parentPatch[key] = ''; });
                copied += sourceAttachmentKeys.length;
                cleared += sourceAttachmentKeys.length;
            } else if (stableJson(itemAttachments) === stableJson(sourceAttachments)) {
                sourceAttachmentKeys.forEach((key) => { parentPatch[key] = ''; });
                cleared += sourceAttachmentKeys.length;
            } else {
                conflicts.push('attachments');
            }
        }

        const reminderItemPatch = {};
        const reminderParentPatch = {};
        const reminderConflicts = [];
        const reminderResult = planSingleAttrMigration(
            sourceAttrs,
            itemAttrs,
            REMINDER_ATTR,
            reminderItemPatch,
            reminderParentPatch,
            reminderConflicts,
        );
        const sourceReminder = activeAttrValue(sourceAttrs, REMINDER_ATTR);
        let bookmarkResult = { copied: 0, cleared: 0 };
        if (sourceReminder && activeAttrValue(sourceAttrs, 'bookmark') === '⏰') {
            bookmarkResult = planSingleAttrMigration(
                sourceAttrs,
                itemAttrs,
                'bookmark',
                reminderItemPatch,
                reminderParentPatch,
                reminderConflicts,
            );
        }
        if (reminderConflicts.length) {
            conflicts.push(...reminderConflicts);
        } else {
            Object.assign(itemPatch, reminderItemPatch);
            Object.assign(parentPatch, reminderParentPatch);
            copied += reminderResult.copied + bookmarkResult.copied;
            cleared += reminderResult.cleared + bookmarkResult.cleared;
        }

        const simulatedParentAttrs = { ...sourceAttrs, ...parentPatch };
        const remainingManaged = Array.from(taskOwnedAttrKeys(registry)).some((key) => (
            key !== ATTACHMENT_META_ATTR
            && activeAttrValue(simulatedParentAttrs, key) !== ''
        )) || Object.keys(activeAttachmentAttrs(simulatedParentAttrs)).length > 0;
        if (!remainingManaged) {
            if (own(sourceAttrs, ATTR_OWNER)) parentPatch[ATTR_OWNER] = '';
            if (own(sourceAttrs, ATTR_UPDATED_AT)) parentPatch[ATTR_UPDATED_AT] = '';
        }
        if (copied > 0) {
            itemPatch[ATTR_OWNER] = taskID;
            itemPatch[ATTR_UPDATED_AT] = String(Date.now());
        }

        const operations = [];
        if (Object.keys(itemPatch).length) {
            operations.push({ action: 'setAttrs', id: taskID, data: JSON.stringify(itemPatch) });
        }
        if (Object.keys(parentPatch).length) {
            operations.push({ action: 'setAttrs', id: listID, data: JSON.stringify(parentPatch) });
        }
        if (operations.length) await pushTaskTransaction(operations);
        return {
            status: operations.length ? 'migrated' : (conflicts.length ? 'conflict' : 'unchanged'),
            taskID,
            copied,
            cleared,
            conflicts: uniqueStrings(conflicts),
        };
    }

    async function ensureTaskAttrItemStorageMigration() {
        const current = await readJson(TASK_ATTR_STORAGE_FILE, null);
        if (current && Number(current.version) >= TASK_ATTR_ITEM_STORAGE_VERSION) return current;

        const registry = await getFieldRegistry();
        const candidateIDs = await listTaskAttrMigrationCandidates(registry);
        const report = {
            version: 0,
            targetVersion: TASK_ATTR_ITEM_STORAGE_VERSION,
            status: 'running',
            startedAt: nowIso(),
            completedAt: '',
            candidates: candidateIDs.length,
            migrated: 0,
            copied: 0,
            cleared: 0,
            conflicts: [],
            skippedOwner: [],
            skippedAmbiguous: [],
            skippedEmpty: [],
            failures: [],
        };
        for (const listID of candidateIDs) {
            try {
                const result = await migrateListTaskAttrs(listID, registry);
                if (result.status === 'migrated') report.migrated += 1;
                report.copied += Number(result.copied) || 0;
                report.cleared += Number(result.cleared) || 0;
                if (result.conflicts && result.conflicts.length) {
                    report.conflicts.push({ listID, taskID: result.taskID, keys: result.conflicts });
                }
                if (result.status === 'skipped-owner') {
                    report.skippedOwner.push({ listID, taskID: result.taskID, owner: result.owner });
                } else if (result.status === 'skipped-ambiguous') {
                    report.skippedAmbiguous.push({ listID, taskID: result.taskID });
                } else if (result.status === 'skipped-empty') {
                    report.skippedEmpty.push(listID);
                }
            } catch (error) {
                report.failures.push({ listID, message: text(error && error.message) || String(error) });
            }
        }
        report.completedAt = nowIso();
        report.status = report.failures.length ? 'failed' : 'complete';
        if (!report.failures.length) report.version = TASK_ATTR_ITEM_STORAGE_VERSION;
        await writeJson(TASK_ATTR_STORAGE_FILE, report);
        if (report.failures.length) {
            throw new DomainError(ERROR.STORAGE_ERROR, '任务属性迁移未完成', { failures: report.failures });
        }
        return report;
    }

    async function buildCanonicalTaskAttrs(binding, patchAttrs, registry) {
        const taskID = requireID(binding.taskID, '任务 ID');
        const out = {};
        const allowed = taskOwnedAttrKeys(registry);
        const sourceAttrs = await readAttrs(taskID);
        Object.entries(sourceAttrs).forEach(([key, value]) => {
            const attachmentSlot = key.startsWith(ATTACHMENT_ATTR_PREFIX)
                && /^\d+$/.test(key.slice(ATTACHMENT_ATTR_PREFIX.length));
            if (!allowed.has(key) && !attachmentSlot) return;
            out[key] = String(value == null ? '' : value);
        });
        Object.assign(out, patchAttrs || {});
        if (Object.keys(out).length) {
            out[ATTR_OWNER] = taskID;
            out[ATTR_UPDATED_AT] = String(Date.now());
        }
        return out;
    }

    async function buildTaskAttrWriteOperations(binding, attrs) {
        if (!Object.keys(attrs || {}).length) return [];
        const taskID = requireID(binding.taskID, '任务 ID');
        return [{ action: 'setAttrs', id: taskID, data: JSON.stringify(attrs) }];
    }

    async function pushTaskTransaction(doOperations) {
        const operations = (Array.isArray(doOperations) ? doOperations : []).filter(Boolean);
        if (!operations.length) return false;
        await api('/api/transactions', {
            reqId: Date.now(),
            transactions: [{ doOperations: operations }],
        });
        return true;
    }

    async function buildTaskAttrPreservationOperation(row, registryInput) {
        const context = buildAttrContext(row);
        if (!context.taskID) return null;
        const registry = registryInput || await getFieldRegistry();
        const patch = await buildCanonicalTaskAttrs(context, {}, registry);
        if (!Object.keys(patch).length) return null;
        return { action: 'setAttrs', id: context.taskID, data: JSON.stringify(patch) };
    }

    async function preserveTaskAttrsOnOwnBlockBeforeMove(row) {
        const operation = await buildTaskAttrPreservationOperation(row);
        if (!operation) return false;
        await pushTaskTransaction([operation]);
        return true;
    }

    async function reconcileTaskAttrHostsNow(taskIDs, registryInput) {
        const requestedIDs = uniqueStrings(taskIDs).map((id) => requireID(id, '任务 ID'));
        if (!requestedIDs.length) return { taskIDs: [], reconciled: 0, writtenHosts: [] };
        const registry = registryInput || await getFieldRegistry();
        const items = [];
        for (const taskID of requestedIDs) {
            let row;
            try {
                row = await getTaskRow(taskID);
            } catch (error) {
                if (text(error && error.code) === ERROR.NOT_FOUND) continue;
                throw error;
            }
            row = await ensureTaskListMutationTarget(taskID, registry, row);
            const context = buildAttrContext(row);
            items.push({
                taskID,
                state: context.state,
                attrHostID: taskID,
                mirrorHostIDs: [],
                writtenHosts: [],
            });
        }
        return {
            taskIDs: items.map((item) => item.taskID),
            reconciled: items.length,
            writtenHosts: uniqueStrings(items.flatMap((item) => item.writtenHosts)),
            items,
        };
    }

    async function reconcileTaskAttrHosts(taskIDs) {
        const ids = uniqueStrings(taskIDs).map((id) => requireID(id, '任务 ID'));
        return runTaskLanes(ids, () => reconcileTaskAttrHostsNow(ids));
    }

    async function persistReminderAttrs(binding, attrs) {
        if (!Object.keys(attrs || {}).length) return;
        await setAttrs(binding.taskID, attrs);
    }

    async function captureAttrSnapshots(binding, keys) {
        const hostIDs = [requireID(binding.taskID, '任务 ID')];
        const snapshots = [];
        for (const hostID of hostIDs) {
            const current = await readAttrs(hostID);
            const attrs = {};
            keys.forEach((key) => { attrs[key] = own(current, key) ? String(current[key] ?? '') : ''; });
            snapshots.push({ hostID, attrs });
        }
        return snapshots;
    }

    async function restoreAttrSnapshots(snapshots) {
        const failures = [];
        for (const snapshot of snapshots || []) {
            try { await setAttrs(snapshot.hostID, snapshot.attrs); }
            catch (error) { failures.push({ hostID: snapshot.hostID, error: text(error && error.message) || String(error) }); }
        }
        return failures;
    }

    async function normalizeUiAttrPayload(rawAttrs) {
        const source = rawAttrs && typeof rawAttrs === 'object' && !Array.isArray(rawAttrs) ? rawAttrs : {};
        const registry = await getFieldRegistry();
        const allowed = new Set([ATTR_OWNER, ATTR_UPDATED_AT, ATTACHMENT_META_ATTR, ...REPEAT_ATTRS]);
        registry.fields.forEach((field) => {
            if (field.attr) allowed.add(field.attr);
            (Array.isArray(field.aliases) ? field.aliases : []).forEach((key) => allowed.add(key));
        });
        const out = {};
        Object.entries(source).forEach(([rawKey, value]) => {
            const key = text(rawKey);
            const attachmentSlot = key.startsWith(ATTACHMENT_ATTR_PREFIX)
                && /^\d+$/.test(key.slice(ATTACHMENT_ATTR_PREFIX.length));
            if (!allowed.has(key) && !attachmentSlot) {
                throw new DomainError(ERROR.INVALID_ARGUMENT, `不支持的任务属性: ${key || '(empty)'}`);
            }
            out[key] = String(value == null ? '' : value);
        });
        return out;
    }

    async function persistUiTaskAttrs(taskID, rawAttrs, options) {
        const id = requireID(taskID, '任务 ID');
        const laneID = text(options?.laneID || options?.laneId) || id;
        return runTaskLane(laneID, async () => {
            const attrs = await normalizeUiAttrPayload(rawAttrs);
            const registry = await getFieldRegistry();
            const row = await ensureTaskListMutationTarget(id, registry);
            const context = buildAttrContext(row);
            const canonicalAttrs = await buildCanonicalTaskAttrs({ taskID: id, ...context }, attrs, registry);
            if (!Object.keys(canonicalAttrs).length) {
                return { taskID: id, attrHostID: context.primaryHostID, mirrorHostIDs: context.mirrorHostIDs, written: 0 };
            }
            const operations = await buildTaskAttrWriteOperations({ taskID: id, ...context }, canonicalAttrs);
            await pushTaskTransaction(operations);
            return {
                taskID: id,
                attrHostID: context.primaryHostID,
                mirrorHostIDs: context.mirrorHostIDs,
                written: Object.keys(canonicalAttrs).length,
            };
        });
    }

    const REMINDER_INTERVALS = Object.freeze(['once', 'daily', 'workday', 'weekly', 'monthly', 'yearly']);
    const REMINDER_CONTROLLED_KEYS = Object.freeze([
        'blockId', 'taskId', 'blockName', 'blockContent', 'rootId', 'enabled',
        'repeatMode', 'interval', 'every', 'times', 'startDate', 'endDate', 'maxOccurrences',
        'monthlyMode', 'calendarMode', 'syncTaskDone', 'taskStartDate',
        'taskCompletionTime', 'taskRepeatRule', 'taskRepeatState',
        'completedOccurrences', 'completed', 'done', 'followAnchor', 'followDayOffset',
        'time', 'timeKey', 'reminderTime', 'notifyTime', 'at', 'dateTime', 'datetime',
        'remindAt', 'scheduledAt', 'date', 'dateKey', 'day', 'startDateKey', 'until',
        'repeatUntil', 'repeatType', 'repeat_type', 'type', 'repeat', 'monthly_mode',
        'repeatMonthlyMode', 'repeat_calendar_mode', 'repeatCalendarMode',
        'sync_task_done', 'followTaskRepeat', 'task_repeat_rule', 'task_repeat_state',
    ]);

    function parseJsonObject(value) {
        const raw = text(value);
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
        } catch (error) {
            return null;
        }
    }

    function normalizeReminderDate(value, label, required) {
        const raw = text(value);
        if (!raw) {
            if (required) throw new DomainError(ERROR.INVALID_ARGUMENT, `${label}不能为空`);
            return '';
        }
        const key = raw.slice(0, 10);
        if (!isStrictDateKey(key)) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, `${label}格式无效，应为 YYYY-MM-DD`);
        }
        return key;
    }

    function normalizeReminderTimes(value) {
        if (!Array.isArray(value) || !value.length) throw new DomainError(ERROR.INVALID_ARGUMENT, '提醒时间不能为空');
        const times = uniqueStrings(value.map((item) => text(item))).map((item) => {
            const matched = item.match(/^(\d{2}):(\d{2})$/);
            const hour = matched ? Number(matched[1]) : NaN;
            const minute = matched ? Number(matched[2]) : NaN;
            if (!matched || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
                throw new DomainError(ERROR.INVALID_ARGUMENT, `提醒时间无效: ${item || '(empty)'}`);
            }
            return item;
        }).sort();
        if (times.length > 12) throw new DomainError(ERROR.INVALID_ARGUMENT, '单个任务最多设置 12 个提醒时间');
        return times;
    }

    function normalizeReminderEvery(value) {
        const every = value == null || text(value) === '' ? 1 : Number(value);
        if (!Number.isInteger(every) || every < 1 || every > 365) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '提醒间隔必须是 1 到 365 的整数');
        }
        return every;
    }

    async function readReminderTaskState(taskID) {
        const row = await getTaskRow(taskID);
        const binding = buildAttrContext(row);
        const primaryAttrs = await readAttrs(binding.taskID);
        const raw = String(primaryAttrs[REMINDER_ATTR] == null ? '' : primaryAttrs[REMINDER_ATTR]);
        const reminderSourceHostID = raw ? binding.taskID : '';
        const task = await taskDTO(row);
        const relevant = {
            reminder: raw,
            attrHostID: binding.taskID,
            attrHostState: binding.state,
            reminderSourceHostID,
            title: task.title,
            documentID: task.documentID,
            startDate: task.startDate,
            completionTime: task.completionTime,
            repeatRule: task.repeatRule,
            repeatState: task.repeatState,
        };
        return {
            row,
            task,
            binding,
            primaryAttrs,
            reminderRaw: raw,
            reminder: parseJsonObject(raw),
            reminderSourceHostID,
            fingerprint: stableJson(relevant),
        };
    }

    function reminderBaseRecord(current, taskState) {
        const previous = current && typeof current === 'object' ? { ...current } : {};
        REMINDER_CONTROLLED_KEYS.forEach((key) => { delete previous[key]; });
        const now = nowIso();
        return {
            ...previous,
            blockId: taskState.binding.primaryHostID,
            taskId: taskState.task.id,
            blockName: taskState.task.title || '任务',
            blockContent: taskState.task.title || '任务',
            rootId: taskState.task.documentID,
            enabled: true,
            createdAt: text(current && current.createdAt) || now,
            updatedAt: now,
        };
    }

    function buildFollowTaskReminder(args, taskState) {
        const follow = args.follow && typeof args.follow === 'object' && !Array.isArray(args.follow) ? args.follow : {};
        const taskStartDate = normalizeReminderDate(taskState.task.startDate, '任务开始日期', false);
        const taskCompletionTime = normalizeReminderDate(follow.date || taskState.task.completionTime, '跟随提醒日期', true);
        const repeatRule = taskState.task.repeatRule && typeof taskState.task.repeatRule === 'object'
            ? taskState.task.repeatRule
            : null;
        const repeatEnabled = !!(repeatRule && repeatRule.enabled !== false && text(repeatRule.type) !== 'none');
        return {
            ...reminderBaseRecord(taskState.reminder, taskState),
            repeatMode: REMINDER_REPEAT_MODE_FOLLOW_TASK,
            interval: 'once',
            every: 1,
            times: normalizeReminderTimes(follow.times),
            startDate: taskCompletionTime,
            endDate: '',
            monthlyMode: 'date',
            calendarMode: 'solar',
            syncTaskDone: true,
            taskStartDate,
            taskCompletionTime,
            taskRepeatRule: repeatEnabled ? repeatRule : null,
            taskRepeatState: repeatEnabled && taskState.task.repeatState && typeof taskState.task.repeatState === 'object'
                ? taskState.task.repeatState
                : null,
            completedOccurrences: [],
            followAnchor: 'completionTime',
            followDayOffset: 0,
        };
    }

    function buildIndependentReminder(args, taskState) {
        const schedule = args.schedule && typeof args.schedule === 'object' && !Array.isArray(args.schedule) ? args.schedule : {};
        const interval = text(schedule.interval) || 'once';
        if (!REMINDER_INTERVALS.includes(interval)) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, `不支持的提醒重复方式: ${interval}`);
        }
        const startDate = normalizeReminderDate(schedule.startDate, '提醒开始日期', true);
        const endDate = normalizeReminderDate(schedule.endDate, '提醒结束日期', false);
        if (endDate && endDate < startDate) throw new DomainError(ERROR.INVALID_ARGUMENT, '提醒结束日期不能早于开始日期');
        return {
            ...reminderBaseRecord(taskState.reminder, taskState),
            repeatMode: REMINDER_REPEAT_MODE_MANUAL,
            interval,
            every: normalizeReminderEvery(schedule.every),
            times: normalizeReminderTimes(schedule.times),
            startDate,
            endDate,
            monthlyMode: text(schedule.monthlyMode) === 'weekday' ? 'weekday' : 'date',
            calendarMode: (interval === 'monthly' || interval === 'yearly') && text(schedule.calendarMode) === 'lunar' ? 'lunar' : 'solar',
            syncTaskDone: false,
            taskStartDate: '',
            taskCompletionTime: '',
            taskRepeatRule: null,
            taskRepeatState: null,
            completedOccurrences: [],
            followAnchor: '',
            followDayOffset: 0,
        };
    }

    function normalizeReminderOperation(args, taskState) {
        const operation = text(args && args.operation);
        if (operation !== 'set' && operation !== 'clear') {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '提醒操作必须是 set 或 clear');
        }
        if (operation === 'clear') return { operation, mode: '', reminder: null };
        const mode = text(args && args.mode);
        if (mode !== 'follow_task' && mode !== 'independent') {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '提醒模式必须是 follow_task 或 independent');
        }
        const reminder = mode === 'follow_task'
            ? buildFollowTaskReminder(args, taskState)
            : buildIndependentReminder(args, taskState);
        return { operation, mode, reminder };
    }

    function reminderPreviewData(taskState, normalized, previewToken, expiresAt) {
        const previousReminder = taskState.reminder && typeof taskState.reminder === 'object' ? taskState.reminder : null;
        const previousFollowDate = previousReminder && previousReminder.repeatMode === REMINDER_REPEAT_MODE_FOLLOW_TASK
            ? text(previousReminder.taskCompletionTime || previousReminder.startDate).slice(0, 10)
            : '';
        const currentCompletion = text(taskState.task.completionTime).slice(0, 10);
        const willClearCompletion = normalized.operation === 'clear'
            && isStrictDateKey(previousFollowDate)
            && currentCompletion === previousFollowDate;
        return {
            previewToken,
            expiresAt: new Date(expiresAt).toISOString(),
            requiresConfirmation: true,
            taskID: taskState.task.id,
            taskTitle: taskState.task.title,
            operation: normalized.operation,
            mode: normalized.mode,
            current: taskState.reminder,
            next: normalized.reminder,
            consequence: normalized.operation === 'clear'
                ? { hasReminder: false, syncTaskDone: false, completionCleared: willClearCompletion }
                : {
                    hasReminder: true,
                    syncTaskDone: normalized.reminder.syncTaskDone === true,
                    startDate: normalized.reminder.startDate,
                    times: normalized.reminder.times,
                    interval: normalized.reminder.interval,
                },
        };
    }

    async function previewTaskReminder(args) {
        pruneTokens(state.reminderTokens);
        const binding = await resolveTaskBinding(args && args.taskID);
        const taskState = await readReminderTaskState(binding.taskID);
        const normalized = normalizeReminderOperation(args, taskState);
        const previewToken = token('reminder');
        const expiresAt = Date.now() + PREVIEW_TOKEN_TTL;
        state.reminderTokens.set(previewToken, {
            taskID: taskState.task.id,
            fingerprint: taskState.fingerprint,
            normalized,
            expiresAt,
        });
        return reminderPreviewData(taskState, normalized, previewToken, expiresAt);
    }

    async function persistTaskReminder(binding, taskState, normalized) {
        const registry = await getFieldRegistry();
        const completionField = registry.byId.get('completionTime');
        if (!completionField || !completionField.attr) throw new DomainError(ERROR.STORAGE_ERROR, '任务截止日期字段不可写');

        const previousReminder = taskState.reminder && typeof taskState.reminder === 'object' ? taskState.reminder : null;
        const previousFollowDate = previousReminder && previousReminder.repeatMode === REMINDER_REPEAT_MODE_FOLLOW_TASK
            ? text(previousReminder.taskCompletionTime || previousReminder.startDate).slice(0, 10)
            : '';
        const currentCompletion = normalizeReminderDate(taskState.task.completionTime, '任务截止日期', false);
        let completionTime = currentCompletion;
        let completionChanged = false;
        let completionCleared = false;
        if (normalized.operation === 'set' && normalized.mode === 'follow_task' && normalized.reminder) {
            completionTime = normalized.reminder.taskCompletionTime;
            completionChanged = currentCompletion !== completionTime;
        } else if (normalized.operation === 'clear'
            && isStrictDateKey(previousFollowDate)
            && currentCompletion === previousFollowDate) {
            completionTime = '';
            completionChanged = true;
            completionCleared = true;
        }

        const deadlineAttrs = completionChanged
            ? buildAttrPayload({ completionTime }, registry, binding.taskID)
            : {};
        const reminderAttrs = {
            [REMINDER_ATTR]: normalized.reminder ? JSON.stringify(normalized.reminder) : '',
            bookmark: normalized.reminder ? '⏰' : '',
            [ATTR_OWNER]: binding.taskID,
            [ATTR_UPDATED_AT]: String(Date.now()),
        };
        const snapshotKeys = uniqueStrings(Object.keys(deadlineAttrs).concat(Object.keys(reminderAttrs)));
        const snapshots = await captureAttrSnapshots(taskState.binding, snapshotKeys);
        try {
            if (completionChanged) {
                await persistTaskAttrs({ taskID: binding.taskID, ...taskState.binding }, deadlineAttrs);
                const persistedTask = await taskDTO(binding.taskID, ['completionTime']);
                if (persistedTask.completionTime !== completionTime) {
                    throw new DomainError(ERROR.STORAGE_ERROR, '任务截止日期写入后回读校验失败');
                }
            }
            await persistReminderAttrs({ taskID: binding.taskID, ...taskState.binding }, reminderAttrs);
            const persistedAttrs = await readAttrs(taskState.binding.primaryHostID);
            const persistedReminder = parseJsonObject(persistedAttrs[REMINDER_ATTR]);
            const reminderPersisted = normalized.reminder
                ? !!persistedReminder && stableJson(persistedReminder) === stableJson(normalized.reminder)
                : !text(persistedAttrs[REMINDER_ATTR]);
            if (!reminderPersisted) throw new DomainError(ERROR.STORAGE_ERROR, '提醒写入后回读校验失败');
            const task = await taskDTO(binding.taskID);
            return {
                taskID: binding.taskID,
                taskTitle: taskState.task.title,
                task,
                attrHostID: taskState.binding.primaryHostID,
                operation: normalized.operation,
                mode: normalized.mode || (previousFollowDate ? 'follow_task' : 'independent'),
                hasReminder: !!normalized.reminder,
                reminder: normalized.reminder,
                completionTime,
                completionChanged,
                completionCleared,
                refresh: taskMutationRefresh('reminder', [binding.taskID], [task.documentID]),
            };
        } catch (error) {
            const rollbackFailures = await restoreAttrSnapshots(snapshots);
            if (rollbackFailures.length) {
                throw new DomainError(ERROR.STORAGE_ERROR, '提醒写入失败，且属性回滚未完全成功', {
                    cause: text(error && error.message) || String(error),
                    rollbackFailures,
                });
            }
            throw error;
        }
    }

    async function findReminderTaskByExactTitle(taskTitle) {
        const title = text(taskTitle);
        if (!title) return '';
        const lookupTitle = normalizeReminderTaskLookupTitle(title);
        const rows = await sql(`
            SELECT task.id, task.markdown, task.content AS raw_content, task.updated
            FROM blocks task
            WHERE task.type = 'i'
              AND task.subtype = 't'
              AND (
                instr(lower(task.markdown), lower('${escapeSql(lookupTitle)}')) > 0
                OR instr(lower(task.content), lower('${escapeSql(lookupTitle)}')) > 0
              )
            ORDER BY task.updated DESC, task.created DESC, task.sort ASC, task.id ASC
        `);
        const matches = rows.filter((row) => normalizeReminderTaskLookupTitle(taskOwnTitle(row)) === lookupTitle);
        return text(matches.find((row) => !parseDone(row.markdown))?.id || matches[0]?.id);
    }

    async function findReminderTaskByFuzzyTitle(taskTitle) {
        const lookupTitle = normalizeReminderTaskLookupTitle(taskTitle);
        const terms = reminderTaskFuzzyTerms(lookupTitle);
        if (!terms.length) return null;
        const conditions = terms.map((term) => {
            const value = escapeSql(term);
            return `(instr(lower(task.markdown), lower('${value}')) > 0 OR instr(lower(task.content), lower('${value}')) > 0)`;
        });
        const rows = await sql(`
            SELECT task.id, task.markdown, task.content AS raw_content, task.updated
            FROM blocks task
            WHERE task.type = 'i'
              AND task.subtype = 't'
              AND (${conditions.join(' OR ')})
            ORDER BY task.updated DESC, task.created DESC, task.sort ASC, task.id ASC
        `);
        const matches = rows.map((row) => {
            const matchedTitle = taskOwnTitle(row);
            return {
                id: text(row.id),
                matchedTitle,
                done: parseDone(row.markdown),
                distance: reminderTaskTitleDistance(lookupTitle, matchedTitle),
            };
        }).filter((item) => item.id && item.distance <= reminderTaskFuzzyDistanceLimit(lookupTitle, item.matchedTitle));
        matches.sort((left, right) => left.distance - right.distance || Number(left.done) - Number(right.done));
        const match = matches[0];
        return match ? {
            taskID: match.id,
            matchType: match.distance === 0 ? 'exact' : 'fuzzy',
            matchDistance: match.distance,
            matchedTitle: match.matchedTitle,
        } : null;
    }

    async function findReminderTaskByTitle(taskTitle) {
        const exactTaskID = await findReminderTaskByExactTitle(taskTitle);
        if (exactTaskID) return { taskID: exactTaskID, matchType: 'exact', matchDistance: 0 };
        return await findReminderTaskByFuzzyTitle(taskTitle);
    }

    async function applyTaskReminder(args) {
        const source = args && typeof args === 'object' ? args : {};
        let taskID = text(source.taskID || source.taskId);
        let created = null;
        let taskReused = false;
        let taskMatchType = '';
        let taskMatchDistance = null;
        if (!taskID) {
            if (text(source.operation) !== 'set') throw new DomainError(ERROR.INVALID_ARGUMENT, '清除提醒时必须提供任务 ID');
            const taskTitle = text(source.taskTitle || source.title);
            const documentID = text(source.documentID || source.documentId);
            if (!taskTitle) throw new DomainError(ERROR.INVALID_ARGUMENT, '没有绑定任务时必须提供提醒对应的任务标题');
            const taskMatch = await findReminderTaskByTitle(taskTitle);
            taskID = text(taskMatch?.taskID);
            taskReused = !!taskID;
            taskMatchType = taskReused ? text(taskMatch?.matchType) : '';
            taskMatchDistance = taskReused && Number.isFinite(Number(taskMatch?.matchDistance)) ? Number(taskMatch.matchDistance) : null;
            if (!taskID) {
                if (!documentID) throw new DomainError(ERROR.INVALID_ARGUMENT, '没有匹配任务时必须提供插件默认新建位置的文档 ID');
                created = await createTask({ title: taskTitle, documentID });
                taskID = text(created?.task?.id);
            }
        }
        try {
            const binding = await resolveTaskBinding(taskID);
            const result = await runTaskLane(binding.taskID, async () => {
                const taskState = await readReminderTaskState(binding.taskID);
                const normalized = normalizeReminderOperation(source, taskState);
                return persistTaskReminder(binding, taskState, normalized);
            });
            return {
                ...result,
                taskCreated: !!created,
                taskReused,
                taskMatchType,
                taskMatchDistance,
                createdDocumentID: created ? text(created.task?.documentID) : '',
            };
        } catch (error) {
            if (created && taskID) {
                try { await api('/api/block/deleteBlock', { id: text(created.insertedBlockID) || taskID }); } catch (rollbackError) {}
                state.lastUndo = null;
            }
            throw error;
        }
    }

    async function executeTaskReminder(args) {
        pruneTokens(state.reminderTokens);
        const previewToken = text(args && args.previewToken);
        const preview = state.reminderTokens.get(previewToken);
        if (!preview) throw new DomainError(ERROR.CONFIRMATION_REQUIRED, '请先预览提醒变更并使用有效确认令牌');
        const binding = await resolveTaskBinding(args && args.taskID);
        const requestedOperation = text(args && args.operation);
        if (binding.taskID !== preview.taskID || (requestedOperation && requestedOperation !== preview.normalized.operation)) {
            throw new DomainError(ERROR.CONFIRMATION_REQUIRED, '提醒确认令牌与当前操作不匹配');
        }
        return runTaskLane(binding.taskID, async () => {
            const taskState = await readReminderTaskState(binding.taskID);
            if (taskState.fingerprint !== preview.fingerprint) {
                state.reminderTokens.delete(previewToken);
                throw new DomainError(ERROR.STALE_REVISION, '任务或提醒在预览后已发生变化，请重新预览');
            }
            const normalized = preview.normalized.operation === 'set'
                ? normalizeReminderOperation({
                    ...args,
                    operation: preview.normalized.operation,
                    mode: preview.normalized.mode,
                    follow: preview.normalized.mode === 'follow_task' ? {
                        date: preview.normalized.reminder.taskCompletionTime,
                        times: preview.normalized.reminder.times,
                    } : undefined,
                    schedule: preview.normalized.mode === 'independent' ? {
                        startDate: preview.normalized.reminder.startDate,
                        endDate: preview.normalized.reminder.endDate,
                        times: preview.normalized.reminder.times,
                        interval: preview.normalized.reminder.interval,
                        every: preview.normalized.reminder.every,
                        monthlyMode: preview.normalized.reminder.monthlyMode,
                        calendarMode: preview.normalized.reminder.calendarMode,
                    } : undefined,
                }, taskState)
                : preview.normalized;
            const result = await persistTaskReminder(binding, taskState, normalized);
            state.reminderTokens.delete(previewToken);
            return result;
        });
    }

    async function configureTaskReminder(args) {
        if (!text(args && args.phase)) {
            requireAction(args, 'apply');
            return applyTaskReminder(args);
        }
        requirePhaseAction(args, 'apply');
        return args.phase === 'preview' ? previewTaskReminder(args) : executeTaskReminder(args);
    }

    const AGENT_SCHEDULE_KINDS = Object.freeze(['once', 'daily', 'weekdays', 'weekly']);
    const AGENT_SCHEDULE_LEASE_MS = 15 * 60 * 1000;
    const AGENT_SCHEDULE_RETRY_DELAYS = Object.freeze([60 * 1000, 5 * 60 * 1000]);
    const AGENT_SCHEDULE_TERMINAL_STATUSES = new Set(['succeeded', 'skipped_empty', 'blocked', 'config_error']);
    const AGENT_SCHEDULE_FINISH_STATUSES = new Set([...AGENT_SCHEDULE_TERMINAL_STATUSES, 'failed']);

    function cloneAgentSchedule(value) {
        return value == null ? value : JSON.parse(JSON.stringify(value));
    }

    function normalizeAgentScheduleTime(value) {
        const match = text(value).match(/^(\d{2}):(\d{2})$/);
        const hour = match ? Number(match[1]) : NaN;
        const minute = match ? Number(match[2]) : NaN;
        if (!match || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, 'AI 定时任务时间无效，应为 HH:mm');
        }
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }

    function normalizeAgentScheduleEvent(input, current) {
        const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const previous = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
        const schedule = source.schedule && typeof source.schedule === 'object' && !Array.isArray(source.schedule)
            ? source.schedule
            : (previous.schedule || {});
        const output = source.output && typeof source.output === 'object' && !Array.isArray(source.output)
            ? source.output
            : (previous.output || {});
        const kind = text(schedule.kind || previous.schedule && previous.schedule.kind);
        if (!AGENT_SCHEDULE_KINDS.includes(kind)) throw new DomainError(ERROR.INVALID_ARGUMENT, 'AI 定时任务重复方式无效');
        const date = kind === 'once' ? normalizeReminderDate(schedule.date || previous.schedule && previous.schedule.date, 'AI 定时任务日期', true) : '';
        const name = text(source.name || previous.name).slice(0, 120);
        const prompt = text(source.prompt || previous.prompt).slice(0, 20000);
        if (!name || !prompt) throw new DomainError(ERROR.INVALID_ARGUMENT, 'AI 定时任务名称和指令不能为空');
        const id = text(source.id || previous.id) || token('agent_schedule');
        const now = Date.now();
        const outputMode = text(output.mode || previous.output && previous.output.mode);
        const event = {
            id,
            type: 'agent_prompt',
            createdAt: Number(previous.createdAt || source.createdAt) || now,
            updatedAt: Number(source.updatedAt || previous.updatedAt) || now,
            name,
            enabled: source.enabled == null ? previous.enabled !== false : source.enabled !== false,
            prompt,
            conversationId: text(source.conversationId || previous.conversationId),
            condition: text(source.condition || previous.condition) === 'today_has_completed_tasks' ? 'today_has_completed_tasks' : 'always',
            schedule: {
                kind,
                date,
                weekday: kind === 'weekly' ? clampInt(schedule.weekday == null ? previous.schedule && previous.schedule.weekday : schedule.weekday, 0, 6, 1) : 0,
                time: normalizeAgentScheduleTime(schedule.time || previous.schedule && previous.schedule.time),
            },
            output: {
                mode: outputMode === 'document'
                    ? 'document'
                    : outputMode === 'daily_note'
                        ? 'daily_note'
                        : 'notification',
                documentId: text(output.documentId || previous.output && previous.output.documentId),
                documentMode: text(output.documentMode || previous.output && previous.output.documentMode) === 'monthly_child' ? 'monthly_child' : 'target',
                insertPosition: text(output.insertPosition || previous.output && previous.output.insertPosition) === 'top' ? 'top' : 'bottom',
            },
            lastOccurrence: source.lastOccurrence && typeof source.lastOccurrence === 'object'
                ? cloneAgentSchedule(source.lastOccurrence)
                : cloneAgentSchedule(previous.lastOccurrence || {}),
            lastRun: source.lastRun && typeof source.lastRun === 'object'
                ? cloneAgentSchedule(source.lastRun)
                : cloneAgentSchedule(previous.lastRun || {}),
        };
        if (event.output.mode === 'document' && !event.output.documentId) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, 'AI 定时任务写入文档时必须指定文档 ID');
        }
        return event;
    }

    async function loadAgentSchedules(options) {
        const record = await readJsonState(AGENT_SCHEDULE_FILE);
        if (record.status === 'missing' && options?.allowMissing !== false) return [];
        if (record.status !== 'valid') throw jsonStorageError(AGENT_SCHEDULE_FILE, record);
        const stored = record.value;
        const source = Array.isArray(stored) ? stored : (Array.isArray(stored && stored.events) ? stored.events : []);
        if (!Array.isArray(stored) && !Array.isArray(stored && stored.events)) {
            throw jsonStorageError(AGENT_SCHEDULE_FILE, {
                status: 'corrupt',
                error: new Error('scheduled event list is invalid'),
            });
        }
        const seen = new Set();
        const items = [];
        for (const item of source) {
            try {
                const normalized = normalizeAgentScheduleEvent(item, item);
                if (!seen.has(normalized.id)) {
                    seen.add(normalized.id);
                    items.push(normalized);
                }
            } catch (error) {}
        }
        return items;
    }

    function runAgentScheduleLane(task) {
        const run = state.agentScheduleLane.then(task, task);
        state.agentScheduleLane = run.catch(() => {});
        return run;
    }

    async function resolveAgentScheduleOutputDocument(input) {
        const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const parentDocumentID = requireID(source.parentDocumentID || source.parentDocumentId, '父文档 ID');
        const month = text(source.month);
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '月度子文档月份无效，应为 YYYY-MM');
        }
        return runAgentScheduleLane(async () => {
            const parentRows = await sql(`SELECT id, box, path, hpath FROM blocks WHERE id = '${escapeSql(parentDocumentID)}' AND type = 'd' LIMIT 1`);
            const parent = parentRows[0];
            if (!parent) throw new DomainError(ERROR.NOT_FOUND, 'AI 定时任务父文档不存在');
            const box = text(parent.box);
            const parentPath = text(parent.path);
            const parentHPath = text(parent.hpath).replace(/\/$/, '');
            if (!box || !parentPath.endsWith('.sy') || !parentHPath) {
                throw new DomainError(ERROR.STORAGE_ERROR, '无法解析 AI 定时任务父文档路径');
            }
            const childPathPrefix = `${parentPath.slice(0, -3)}/`;
            const rows = await sql(`
                SELECT id, path FROM blocks
                WHERE type = 'd'
                  AND box = '${escapeSql(box)}'
                  AND content = '${escapeSql(month)}'
                  AND path LIKE '${escapeSql(childPathPrefix)}%'
                ORDER BY created ASC, id ASC
            `);
            const existing = rows.find((row) => {
                const childPath = text(row && row.path);
                const relative = childPath.startsWith(childPathPrefix) ? childPath.slice(childPathPrefix.length) : '';
                return relative.endsWith('.sy') && !relative.slice(0, -3).includes('/');
            });
            if (existing) return { documentID: requireID(existing.id, '月度子文档 ID'), created: false, month };
            const created = await api('/api/filetree/createDocWithMd', {
                notebook: box,
                path: `${parentHPath}/${month}`,
                parentID: parentDocumentID,
                markdown: '',
            });
            return { documentID: requireID(created, '月度子文档 ID'), created: true, month };
        });
    }

    async function saveAgentSchedule(input) {
        return runAgentScheduleLane(async () => {
            const requestedID = text(input && input.id);
            const items = await loadAgentSchedules({ allowMissing: !requestedID });
            const index = requestedID ? items.findIndex((item) => item.id === requestedID) : -1;
            const current = index >= 0 ? items[index] : null;
            const event = preserveAgentScheduleRuntime(normalizeAgentScheduleEvent(input, current), current);
            event.updatedAt = Date.now();
            if (index >= 0) items[index] = event;
            else items.push(event);
            await writeJson(AGENT_SCHEDULE_FILE, items);
            return cloneAgentSchedule(event);
        });
    }

    function preserveAgentScheduleRuntime(event, current) {
        if (!current) return event;
        const currentLedger = current.lastOccurrence && typeof current.lastOccurrence === 'object' ? current.lastOccurrence : {};
        const incomingLedger = event.lastOccurrence && typeof event.lastOccurrence === 'object' ? event.lastOccurrence : {};
        const ownsRunningOccurrence = text(currentLedger.status) === 'running'
            && text(incomingLedger.status) === 'running'
            && text(currentLedger.occurrenceKey) === text(incomingLedger.occurrenceKey)
            && text(currentLedger.ownerId)
            && text(currentLedger.ownerId) === text(incomingLedger.ownerId);
        if (!ownsRunningOccurrence) {
            event.lastOccurrence = cloneAgentSchedule(current.lastOccurrence || {});
            event.lastRun = cloneAgentSchedule(current.lastRun || {});
        }
        if (!text(event.conversationId)) event.conversationId = text(current.conversationId);
        return event;
    }

    async function replaceAgentSchedules(input) {
        const source = Array.isArray(input) ? input : (Array.isArray(input && input.events) ? input.events : null);
        if (!source) throw new DomainError(ERROR.INVALID_ARGUMENT, 'AI 定时任务列表格式无效');
        if (source.length > 500) throw new DomainError(ERROR.INVALID_ARGUMENT, 'AI 定时任务最多保留 500 条');
        return runAgentScheduleLane(async () => {
            const currentItems = await loadAgentSchedules({ allowMissing: true });
            const currentByID = new Map(currentItems.map((event) => [event.id, event]));
            const seen = new Set();
            const next = source.map((item) => {
                const requestedID = text(item && item.id);
                if (requestedID && seen.has(requestedID)) {
                    throw new DomainError(ERROR.INVALID_ARGUMENT, `AI 定时任务 ID 重复: ${requestedID}`);
                }
                const current = requestedID ? currentByID.get(requestedID) : null;
                const event = preserveAgentScheduleRuntime(normalizeAgentScheduleEvent(item, current), current);
                if (seen.has(event.id)) throw new DomainError(ERROR.INVALID_ARGUMENT, `AI 定时任务 ID 重复: ${event.id}`);
                seen.add(event.id);
                return event;
            });
            await writeJson(AGENT_SCHEDULE_FILE, next);
            return cloneAgentSchedule(next);
        });
    }

    async function deleteAgentSchedule(scheduleID) {
        const id = text(scheduleID);
        if (!id) throw new DomainError(ERROR.INVALID_ARGUMENT, '缺少 AI 定时任务 ID');
        return runAgentScheduleLane(async () => {
            const items = await loadAgentSchedules();
            const next = items.filter((item) => item.id !== id);
            if (next.length === items.length) throw new DomainError(ERROR.NOT_FOUND, 'AI 定时任务不存在');
            await writeJson(AGENT_SCHEDULE_FILE, next);
            return { id, deleted: true };
        });
    }

    async function claimAgentScheduleOccurrence(input) {
        const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const scheduleID = text(source.scheduleID || source.id);
        const occurrenceKey = text(source.occurrenceKey);
        const manual = source.manual === true;
        const preserveResult = source.preserveResult === true;
        if (!scheduleID || !occurrenceKey) throw new DomainError(ERROR.INVALID_ARGUMENT, '缺少 AI 定时任务 ID 或发生键');
        return runAgentScheduleLane(async () => {
            const items = await loadAgentSchedules();
            const index = items.findIndex((item) => item.id === scheduleID);
            if (index < 0) throw new DomainError(ERROR.NOT_FOUND, 'AI 定时任务不存在');
            const event = items[index];
            const ledger = event.lastOccurrence && typeof event.lastOccurrence === 'object' ? event.lastOccurrence : {};
            const now = Date.now();
            if (!manual && text(ledger.occurrenceKey) === occurrenceKey) {
                if (AGENT_SCHEDULE_TERMINAL_STATUSES.has(text(ledger.status))) {
                    return { claimed: false, reason: 'terminal', event: cloneAgentSchedule(event) };
                }
                if (text(ledger.status) === 'running' && Number(ledger.leaseUntil) > now) {
                    return { claimed: false, reason: 'running', event: cloneAgentSchedule(event) };
                }
                if (text(ledger.status) === 'failed' && (Number(ledger.attempts) >= 3 || Number(ledger.nextAttemptAt) > now)) {
                    return { claimed: false, reason: Number(ledger.attempts) >= 3 ? 'retry_exhausted' : 'retry_wait', event: cloneAgentSchedule(event) };
                }
            }
            const ownerID = token('runner');
            const attempts = !manual && text(ledger.occurrenceKey) === occurrenceKey ? Number(ledger.attempts) || 0 : 0;
            if (!manual) {
                event.lastOccurrence = {
                    occurrenceKey,
                    status: 'running',
                    ownerId: ownerID,
                    leaseUntil: now + AGENT_SCHEDULE_LEASE_MS,
                    attempts: attempts + 1,
                    nextAttemptAt: 0,
                    startedAt: now,
                    finishedAt: 0,
                    error: '',
                };
            }
            event.lastRun = preserveResult
                ? { ...(event.lastRun || {}), occurrenceKey, status: 'running', error: '', finishedAt: 0 }
                : {
                    occurrenceKey,
                    status: 'running',
                    startedAt: now,
                    finishedAt: 0,
                    title: '',
                    markdown: '',
                    blockId: '',
                    error: '',
                    deliveryPending: false,
                };
            items[index] = event;
            await writeJson(AGENT_SCHEDULE_FILE, items);
            return { claimed: true, ownerID, event: cloneAgentSchedule(event) };
        });
    }

    async function renewAgentScheduleOccurrence(input) {
        const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const scheduleID = text(source.scheduleID || source.id);
        const occurrenceKey = text(source.occurrenceKey);
        const ownerID = text(source.ownerID || source.ownerId);
        if (!scheduleID || !occurrenceKey || !ownerID) throw new DomainError(ERROR.INVALID_ARGUMENT, '缺少 AI 定时任务续租参数');
        return runAgentScheduleLane(async () => {
            const items = await loadAgentSchedules();
            const index = items.findIndex((item) => item.id === scheduleID);
            if (index < 0) throw new DomainError(ERROR.NOT_FOUND, 'AI 定时任务不存在');
            const event = items[index];
            const ledger = event.lastOccurrence && typeof event.lastOccurrence === 'object' ? event.lastOccurrence : {};
            if (text(ledger.status) !== 'running'
                || text(ledger.occurrenceKey) !== occurrenceKey
                || text(ledger.ownerId) !== ownerID) {
                throw new DomainError(ERROR.CONFLICT, 'AI 定时任务执行权已失效');
            }
            const leaseUntil = Date.now() + AGENT_SCHEDULE_LEASE_MS;
            event.lastOccurrence = { ...ledger, leaseUntil };
            items[index] = event;
            await writeJson(AGENT_SCHEDULE_FILE, items);
            return { leaseUntil, event: cloneAgentSchedule(event) };
        });
    }

    async function finishAgentScheduleOccurrence(input) {
        const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const scheduleID = text(source.scheduleID || source.id);
        const occurrenceKey = text(source.occurrenceKey);
        const ownerID = text(source.ownerID || source.ownerId);
        const status = text(source.status);
        const manual = source.manual === true;
        const patch = source.patch && typeof source.patch === 'object' && !Array.isArray(source.patch) ? source.patch : {};
        if (!scheduleID || !occurrenceKey) throw new DomainError(ERROR.INVALID_ARGUMENT, '缺少 AI 定时任务 ID 或发生键');
        if (!AGENT_SCHEDULE_FINISH_STATUSES.has(status)) throw new DomainError(ERROR.INVALID_ARGUMENT, 'AI 定时任务完成状态无效');
        return runAgentScheduleLane(async () => {
            const items = await loadAgentSchedules();
            const index = items.findIndex((item) => item.id === scheduleID);
            if (index < 0) throw new DomainError(ERROR.NOT_FOUND, 'AI 定时任务不存在');
            const event = items[index];
            const ledger = event.lastOccurrence && typeof event.lastOccurrence === 'object' ? event.lastOccurrence : {};
            if (!manual && (text(ledger.occurrenceKey) !== occurrenceKey || !ownerID || text(ledger.ownerId) !== ownerID)) {
                throw new DomainError(ERROR.CONFLICT, 'AI 定时任务执行权已失效');
            }
            const now = Date.now();
            if (!manual) {
                const attempts = Number(ledger.attempts) || 1;
                event.lastOccurrence = {
                    ...ledger,
                    occurrenceKey,
                    status,
                    leaseUntil: 0,
                    nextAttemptAt: status === 'failed' && attempts < 3
                        ? now + AGENT_SCHEDULE_RETRY_DELAYS[Math.min(attempts - 1, AGENT_SCHEDULE_RETRY_DELAYS.length - 1)]
                        : 0,
                    finishedAt: now,
                    error: text(patch.error).slice(0, 2000),
                };
            }
            event.lastRun = {
                ...(event.lastRun || {}),
                ...cloneAgentSchedule(patch),
                occurrenceKey,
                status,
                finishedAt: now,
            };
            if (!manual && event.schedule.kind === 'once' && AGENT_SCHEDULE_TERMINAL_STATUSES.has(status)) event.enabled = false;
            items[index] = event;
            await writeJson(AGENT_SCHEDULE_FILE, items);
            return cloneAgentSchedule(event);
        });
    }

    async function manageAgentSchedules(args) {
        const action = text(args && args.action);
        if (action === 'list') return { items: await loadAgentSchedules() };
        if (action === 'create') return saveAgentSchedule({ ...(args.event || {}), id: '' });
        if (action === 'update') {
            const id = text(args && (args.scheduleID || args.id));
            if (!id) throw new DomainError(ERROR.INVALID_ARGUMENT, '缺少 AI 定时任务 ID');
            const current = (await loadAgentSchedules()).find((item) => item.id === id);
            if (!current) throw new DomainError(ERROR.NOT_FOUND, 'AI 定时任务不存在');
            return saveAgentSchedule({ ...current, ...(args.patch || {}), id });
        }
        if (action === 'delete') return deleteAgentSchedule(args && (args.scheduleID || args.id));
        throw new DomainError(ERROR.INVALID_ARGUMENT, 'AI 定时任务操作必须是 list、create、update 或 delete');
    }

    function normalizeExplicitAttrs(rawAttrs) {
        const source = rawAttrs && typeof rawAttrs === 'object' && !Array.isArray(rawAttrs) ? rawAttrs : {};
        const out = {};
        Object.entries(source).forEach(([rawKey, value]) => {
            const key = text(rawKey);
            if (key !== 'alias' && key !== 'bookmark' && !SAFE_ATTR_RE.test(key)) {
                throw new DomainError(ERROR.INVALID_ARGUMENT, `属性名无效: ${key || '(empty)'}`);
            }
            out[key] = String(value == null ? '' : value);
        });
        return out;
    }

    async function persistUiBlockOperationNow(input) {
        const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const action = text(source.action);
        if (action === 'setAttrs') {
            const id = requireID(source.id, '块 ID');
            const attrs = normalizeExplicitAttrs(source.attrs);
            await setAttrs(id, attrs);
            return { id, written: Object.keys(attrs).length };
        }
        if (action === 'batchSetAttrs') {
            const entries = Array.isArray(source.entries) ? source.entries.slice(0, 200) : [];
            const blockAttrs = entries.map((entry) => ({
                id: requireID(entry && entry.id, '块 ID'),
                attrs: normalizeExplicitAttrs(entry && entry.attrs),
            })).filter((entry) => Object.keys(entry.attrs).length > 0);
            if (blockAttrs.length > 0) {
                await api('/api/attr/batchSetBlockAttrs', { blockAttrs });
            }
            return { written: entries.length };
        }
        if (action === 'updateBlock') {
            const id = requireID(source.id, '块 ID');
            const data = String(source.data == null ? '' : source.data);
            const dataType = text(source.dataType) === 'dom' ? 'dom' : 'markdown';
            const result = await api('/api/block/updateBlock', { id, data, dataType });
            return { id: extractInsertedID(result) || id };
        }
        if (action === 'insertBlock' || action === 'appendBlock' || action === 'prependBlock') {
            const parentID = requireID(source.parentID || source.parentId, '父块 ID');
            const requestedID = text(source.requestedID || source.requestedId);
            if (requestedID) {
                requireID(requestedID, '预生成块 ID');
                const existing = await sql(`SELECT id FROM blocks WHERE id = '${escapeSql(requestedID)}' LIMIT 1`);
                if (existing.length) return { id: requestedID, recovered: true };
            }
            const dataType = text(source.dataType) === 'dom' ? 'dom' : 'markdown';
            const payload = { parentID, data: String(source.data == null ? '' : source.data), dataType };
            if (action === 'insertBlock') {
                if (text(source.nextID || source.nextId)) payload.nextID = requireID(source.nextID || source.nextId, '后一块 ID');
                if (text(source.previousID || source.previousId)) payload.previousID = requireID(source.previousID || source.previousId, '前一块 ID');
            }
            const endpoint = action === 'insertBlock'
                ? '/api/block/insertBlock'
                : action === 'prependBlock'
                    ? '/api/block/prependBlock'
                    : '/api/block/appendBlock';
            const result = await api(endpoint, payload);
            const id = requestedID || extractInsertedID(result);
            if (!id) throw new DomainError(ERROR.STORAGE_ERROR, '写入块后未返回块 ID');
            return { id };
        }
        if (action === 'createSubtask') {
            const parentTaskID = requireID(source.parentTaskID || source.parentTaskId, '父任务 ID');
            const taskID = requireID(source.taskID || source.taskId, '子任务 ID');
            const listID = requireID(source.listID || source.listId, '子列表 ID');
            const listData = String(source.listData == null ? '' : source.listData).trim();
            const itemData = String(source.itemData == null ? '' : source.itemData).trim();
            const requestedPreviousID = text(source.previousTaskID || source.previousTaskId);
            if (requestedPreviousID) requireID(requestedPreviousID, '前一子任务 ID');
            if (!listData || !itemData) throw new DomainError(ERROR.INVALID_ARGUMENT, '子任务 DOM 不能为空');
            if (!listData.includes(`data-node-id="${listID}"`)
                || !listData.includes(`data-node-id="${taskID}"`)
                || !itemData.includes(`data-node-id="${taskID}"`)) {
                throw new DomainError(ERROR.STORAGE_ERROR, '子任务 DOM 与预生成块 ID 不一致');
            }
            const readBlockDOM = async (id) => {
                try {
                    const result = await api('/api/block/getBlockDOM', { id });
                    return String(result?.dom || '').trim();
                } catch (e) {
                    return '';
                }
            };
            const resolveLastChildID = async (id) => {
                try {
                    const children = await api('/api/block/getChildBlocks', { id });
                    const rows = Array.isArray(children) ? children : [];
                    const direct = rows
                        .map((row) => text(row?.id))
                        .filter((childID) => childID && childID !== taskID);
                    if (direct.length) return direct[direct.length - 1];
                } catch (e) {}
                try {
                    const rows = await sql(`SELECT id FROM blocks WHERE parent_id = '${escapeSql(id)}' ORDER BY sort ASC, created ASC, id ASC`);
                    const direct = rows.map((row) => text(row?.id)).filter((childID) => childID && childID !== taskID);
                    return direct.length ? direct[direct.length - 1] : '';
                } catch (e) {}
                return '';
            };
            const taskRows = await sql(`SELECT id, parent_id, type, subtype FROM blocks WHERE id = '${escapeSql(taskID)}' LIMIT 1`);
            if (taskRows.length) {
                const taskRow = taskRows[0];
                const listRows = await sql(`SELECT id, parent_id, type FROM blocks WHERE id = '${escapeSql(listID)}' LIMIT 1`);
                if (listRows.length
                    && text(taskRow.parent_id) === listID
                    && text(listRows[0].parent_id) === parentTaskID
                    && text(listRows[0].type).toLowerCase() === 'l') {
                    return { id: taskID, listID, recovered: true, authoritative: true };
                }
                const listDOM = await readBlockDOM(listID);
                const parentDOM = listDOM ? await readBlockDOM(parentTaskID) : '';
                if (listDOM.includes(`data-node-id="${taskID}"`)
                    && parentDOM.includes(`data-node-id="${listID}"`)) {
                    return { id: taskID, listID, recovered: true, authoritative: true };
                }
                throw new DomainError(ERROR.CONFLICT, '预生成子任务 ID 已被其他块占用');
            }
            const listRows = await sql(`SELECT id, parent_id, type FROM blocks WHERE id = '${escapeSql(listID)}' LIMIT 1`);
            if (listRows.length) {
                if (text(listRows[0].parent_id) !== parentTaskID || text(listRows[0].type).toLowerCase() !== 'l') {
                    throw new DomainError(ERROR.CONFLICT, '预生成子列表 ID 已被其他块占用');
                }
                const previousID = requestedPreviousID || await resolveLastChildID(listID);
                await api('/api/transactions', {
                    reqId: Date.now(),
                    transactions: [{
                        doOperations: [{
                            action: 'insert',
                            id: taskID,
                            parentID: listID,
                            ...(previousID ? { previousID } : {}),
                            data: itemData,
                        }],
                    }],
                });
                return { id: taskID, listID, previousID, authoritative: true };
            }
            // The document transaction is durable before the SQL task index catches
            // up. Inspect the DOM once before retrying an operation after a crash so
            // the same stable IDs recover instead of creating duplicate blocks.
            const existingListDOM = await readBlockDOM(listID);
            if (existingListDOM) {
                const parentDOM = await readBlockDOM(parentTaskID);
                if (!parentDOM.includes(`data-node-id="${listID}"`)) {
                    throw new DomainError(ERROR.CONFLICT, '预生成子列表已存在于其他父任务');
                }
                if (existingListDOM.includes(`data-node-id="${taskID}"`)) {
                    return { id: taskID, listID, recovered: true, authoritative: true };
                }
                const previousID = requestedPreviousID || await resolveLastChildID(listID);
                await api('/api/transactions', {
                    reqId: Date.now(),
                    transactions: [{
                        doOperations: [{
                            action: 'insert',
                            id: taskID,
                            parentID: listID,
                            ...(previousID ? { previousID } : {}),
                            data: itemData,
                        }],
                    }],
                });
                return { id: taskID, listID, previousID, recoveredList: true, authoritative: true };
            }
            const parentPreviousID = await resolveLastChildID(parentTaskID);
            await api('/api/transactions', {
                reqId: Date.now(),
                transactions: [{
                    doOperations: [{
                        action: 'insert',
                        id: listID,
                        parentID: parentTaskID,
                        ...(parentPreviousID ? { previousID: parentPreviousID } : {}),
                        data: listData,
                    }],
                }],
            });
            return { id: taskID, listID, previousID: parentPreviousID, atomic: true, authoritative: true };
        }
        if (action === 'moveBlock') {
            const id = requireID(source.id, '块 ID');
            const payload = { id };
            if (text(source.previousID || source.previousId)) payload.previousID = requireID(source.previousID || source.previousId, '前一块 ID');
            const nextID = text(source.nextID || source.nextId);
            if (!payload.previousID && nextID) {
                requireID(nextID, '后一块 ID');
                const nextRows = await sql(`SELECT id, parent_id FROM blocks WHERE id = '${escapeSql(nextID)}' LIMIT 1`);
                if (!nextRows.length) throw new DomainError(ERROR.NOT_FOUND, '后一块不存在');
                const parentID = text(nextRows[0].parent_id);
                const siblings = await sql(`SELECT id FROM blocks WHERE parent_id = '${escapeSql(parentID)}' ORDER BY sort ASC, created ASC, id ASC`);
                const ordered = siblings.map((item) => text(item.id)).filter((itemID) => itemID && itemID !== id);
                const nextIndex = ordered.indexOf(nextID);
                if (nextIndex < 0) throw new DomainError(ERROR.CONFLICT, '后一块的位置已经变化');
                if (nextIndex > 0) payload.previousID = ordered[nextIndex - 1];
                else payload.parentID = requireID(parentID, '父块 ID');
            } else if (text(source.parentID || source.parentId)) {
                payload.parentID = requireID(source.parentID || source.parentId, '父块 ID');
            }
            if (Object.keys(payload).length === 1) throw new DomainError(ERROR.INVALID_ARGUMENT, '移动块缺少目标位置');
            await api('/api/block/moveBlock', payload);
            return { id };
        }
        if (action === 'deleteBlock') {
            const id = requireID(source.id, '块 ID');
            const existing = await sql(`SELECT id FROM blocks WHERE id = '${escapeSql(id)}' LIMIT 1`);
            if (!existing.length) return { id, recovered: true };
            await api('/api/block/deleteBlock', { id });
            return { id };
        }
        if (action === 'updateMarker') {
            const id = requireID(source.id, '任务 ID');
            const marker = String(source.marker == null ? '' : source.marker);
            if (marker.length !== 1) throw new DomainError(ERROR.INVALID_ARGUMENT, '任务状态标记必须是单个字符');
            await ensureTaskListMutationTarget(id);
            await api('/api/block/updateTaskListItemMarker', { id, marker });
            return { id, marker };
        }
        if (action === 'batchUpdateMarker') {
            const items = (Array.isArray(source.items) ? source.items : []).slice(0, 200).map((item) => {
                const id = requireID(item && item.id, '任务 ID');
                const marker = String(item?.marker == null ? '' : item.marker);
                if (marker.length !== 1) throw new DomainError(ERROR.INVALID_ARGUMENT, '任务状态标记必须是单个字符');
                return { id, marker };
            });
            if (!items.length) return { items: [] };
            for (const id of uniqueStrings(items.map((item) => item.id))) {
                await ensureTaskListMutationTarget(id);
            }
            await api('/api/block/batchUpdateTaskListItemMarker', { items });
            return { items };
        }
        throw new DomainError(ERROR.INVALID_ARGUMENT, `不支持的 UI 块操作: ${action || '(empty)'}`);
    }

    async function persistUiBlockOperation(input) {
        const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const laneID = text(
            source.laneID
            || source.laneId
            || source.id
            || source.requestedID
            || source.requestedId
            || source.parentID
            || source.parentId
            || (Array.isArray(source.items) ? source.items[0]?.id : '')
            || (Array.isArray(source.entries) ? source.entries[0]?.id : '')
            || 'global'
        );
        return runTaskLane(`ui-block:${laneID}`, () => persistUiBlockOperationNow(source));
    }

    function taskMutationRefresh(action, taskIDs, documentIDs) {
        const unique = (values) => Array.from(new Set((Array.isArray(values) ? values : [])
            .map((value) => text(value))
            .filter(Boolean)));
        return {
            kind: 'task-mutation',
            action: text(action),
            taskIDs: unique(taskIDs),
            documentIDs: unique(documentIDs),
        };
    }

    function taskCommandChangeSet(action, value, input) {
        const source = input && typeof input === 'object' ? input : {};
        const result = value && typeof value === 'object' ? value : {};
        if (action === 'reconcileAttrs') {
            return {
                upsertedTaskIds: uniqueStrings(result.taskIDs || source.taskIDs || source.taskIds),
                deletedTaskIds: [],
                fieldChanges: [],
                placementChanges: [],
                affectedGroupIds: [],
                affectedDocumentIds: [],
            };
        }
        if (action === 'batchMove') {
            const results = Array.isArray(result.results) ? result.results : [];
            const taskIDs = uniqueStrings(result.taskIDs || source.taskIDs || source.taskIds);
            return {
                upsertedTaskIds: taskIDs,
                deletedTaskIds: [],
                fieldChanges: [],
                placementChanges: results.map((item, index) => ({
                    taskID: text(item?.placement?.taskID || item?.placement?.taskId || taskIDs[index]),
                    placement: item?.placement || null,
                    previousPlacement: item?.previousPlacement || null,
                })).filter((item) => item.taskID),
                affectedGroupIds: uniqueStrings([
                    source.parentTaskID,
                    source.parentTaskId,
                    source.targetTaskID,
                    source.targetTaskId,
                    result.parentTaskID,
                    ...results.flatMap((item) => [
                        item?.placement?.parentTaskID,
                        item?.previousPlacement?.parentTaskID,
                    ]),
                ]),
                affectedDocumentIds: uniqueStrings([
                    ...(Array.isArray(result.refresh?.documentIDs) ? result.refresh.documentIDs : []),
                    ...results.flatMap((item) => [
                        item?.placement?.documentID,
                        item?.previousPlacement?.documentID,
                    ]),
                ]),
            };
        }
        const task = result.task && typeof result.task === 'object'
            ? result.task
            : (result.id && result.title ? result : null);
        const taskID = text(
            task?.id
            || result.deletedTaskID
            || result.taskID
            || result.realId
            || source.taskID
            || source.taskId
            || source.requestedTaskID
            || source.requestedTaskId
        );
        const placement = result.placement && typeof result.placement === 'object'
            ? result.placement
            : null;
        const refresh = result.refresh && typeof result.refresh === 'object'
            ? result.refresh
            : {};
        const documentIDs = uniqueStrings([
            ...(Array.isArray(refresh.documentIDs) ? refresh.documentIDs : []),
            task?.documentID,
            placement?.documentID,
            source.documentID,
            source.documentId,
            source.targetDocumentID,
            source.targetDocumentId,
        ]);
        const deleted = action === 'delete'
            ? uniqueStrings([taskID, ...(Array.isArray(result?.deletedTaskIDs) ? result.deletedTaskIDs : [])])
            : [];
        const upserted = action !== 'delete' && taskID ? [taskID] : [];
        const fieldChanges = (action === 'patch' || action === 'attrs') && taskID
            ? [{ taskID, fields: Object.keys(source.patch || source.attrs || {}) }]
            : [];
        const placementChanges = action === 'move' && taskID
            ? [{ taskID, placement: placement || null, previousPlacement: result.previousPlacement || null }]
            : [];
        return {
            upsertedTaskIds: upserted,
            deletedTaskIds: deleted,
            fieldChanges,
            placementChanges,
            affectedGroupIds: uniqueStrings([
                source.parentTaskID,
                source.parentTaskId,
                source.targetTaskID,
                source.targetTaskId,
                placement?.parentTaskID,
                result.previousPlacement?.parentTaskID,
            ]),
            affectedDocumentIds: documentIDs,
        };
    }

    function taskCommandFailureOutcome(error) {
        const code = text(error && error.code) || ERROR.STORAGE_ERROR;
        if (code === ERROR.CONFLICT || code === ERROR.STALE_REVISION) return 'conflict';
        if (code === ERROR.INVALID_ARGUMENT || code === ERROR.NOT_FOUND || code === ERROR.UNSUPPORTED) return 'rejected';
        return 'unknown';
    }

    async function executeTaskCommand(input) {
        const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const action = text(source.action || source.kind || source.type);
        const commandID = text(source.commandID || source.commandId) || token('taskcmd');
        const laneID = text(source.laneID || source.laneId || source.taskID || source.taskId || source.parentTaskID || source.parentTaskId || commandID);
        const run = async () => {
            let value;
            if (action === 'patch') {
                const taskID = requireID(source.taskID || source.taskId, '任务 ID');
                value = await applyTaskPatch(taskID, source.patch || {}, {
                    ...(source.options && typeof source.options === 'object' ? source.options : {}),
                    laneID,
                    recordUndo: source.recordUndo !== false,
                });
            } else if (action === 'attrs') {
                const taskID = requireID(source.taskID || source.taskId, '任务 ID');
                value = await persistUiTaskAttrs(taskID, source.attrs || {}, { laneID });
            } else if (action === 'reconcileAttrs') {
                value = await reconcileTaskAttrHosts(source.taskIDs || source.taskIds || []);
            } else if (action === 'create') {
                value = await createTask({ ...source, laneID });
            } else if (action === 'move') {
                value = await moveTask({ ...source, laneID }, { recordUndo: source.recordUndo !== false });
            } else if (action === 'batchMove') {
                value = await batchMoveTasks({ ...source, laneID });
            } else if (action === 'delete') {
                value = await deleteTaskNow(source.taskID || source.taskId);
            } else if (action === 'blockOperation') {
                value = await persistUiBlockOperation({ ...(source.operation || {}), laneID });
            } else {
                throw new DomainError(ERROR.INVALID_ARGUMENT, `不支持的任务命令: ${action || '(empty)'}`);
            }
            const task = value?.task && typeof value.task === 'object'
                ? value.task
                : ((value && value.id && value.title) ? value : null);
            return {
                commandID,
                action,
                outcome: 'committed',
                task,
                value,
                changeSet: taskCommandChangeSet(action, value, source),
            };
        };
        try {
            // Existing finite command handlers own their task lanes. The gateway
            // is the sole dispatch boundary and must not nest a second lane.
            return await run();
        } catch (error) {
            const failed = failure(error);
            return {
                commandID,
                action,
                outcome: taskCommandFailureOutcome(error),
                task: null,
                value: null,
                changeSet: taskCommandChangeSet(action, null, source),
                error: failed.error,
            };
        }
    }

    async function executeTaskCommandValue(input) {
        const receipt = await executeTaskCommand(input);
        if (receipt.outcome === 'committed') return receipt.value;
        throw new DomainError(
            text(receipt.error?.code) || ERROR.STORAGE_ERROR,
            text(receipt.error?.message) || '任务命令未提交',
            receipt.error?.details || null,
        );
    }

    async function applyTaskPatch(taskID, rawPatch, options) {
        const id = requireID(taskID, '任务 ID');
        const laneID = text(options?.laneID || options?.laneId) || id;
        return runTaskLane(laneID, async () => {
            let row = await getTaskRow(id);
            const normalized = await normalizeTaskPatch(rawPatch, options);
            const patch = normalized.patch;
            if (!Object.keys(patch).length) return taskDTO(row);
            row = await ensureTaskListMutationTarget(id, normalized.registry, row);
            const context = buildAttrContext(row);
            const before = await taskDTO(row);
            let taskMarker = null;
            if (own(patch, 'customStatus') && patch.customStatus) {
                const statusOption = normalized.registry.statusById.get(patch.customStatus);
                if (!statusOption) {
                    throw new DomainError(ERROR.INVALID_ARGUMENT, `未配置的任务状态: ${patch.customStatus}`);
                }
                taskMarker = statusOptionMarker(statusOption);
                patch.done = isTaskMarkerDone(taskMarker);
            } else if (own(patch, 'done')) {
                taskMarker = patch.done ? 'X' : ' ';
            }
            if (own(patch, 'done') && !own(patch, 'taskCompleteAt')) patch.taskCompleteAt = patch.done ? nowIso() : '';
            const patchAttrs = await appendAttachmentAttrPayload(id, patch, buildAttrPayload(patch, normalized.registry, id));
            const attrs = await buildCanonicalTaskAttrs({ taskID: id, ...context }, patchAttrs, normalized.registry);
            const operations = [];
            if (own(patch, 'title') || taskMarker !== null) {
                let dom = await readBlockDOM(id);
                if (own(patch, 'title')) dom = replaceTaskDOMTitle(dom, patch.title);
                if (taskMarker !== null) dom = replaceTaskDOMMarker(dom, taskMarker);
                operations.push({ action: 'update', id, data: dom });
            }
            if (Object.keys(attrs).length) {
                operations.push(...await buildTaskAttrWriteOperations({ taskID: id, ...context }, attrs));
            }
            await pushTaskTransaction(operations);
            await verifyTaskDirect(id, { ...(taskMarker !== null ? { marker: taskMarker } : {}), attrs });
            const after = applyTaskDisplayNames({
                ...before,
                ...patch,
                id,
                title: own(patch, 'title') ? patch.title : before.title,
                done: own(patch, 'done') ? !!patch.done : before.done,
                customFieldValues: own(patch, 'customFieldValues')
                    ? { ...(before.customFieldValues || {}), ...(patch.customFieldValues || {}) }
                    : before.customFieldValues,
                updated: nowIso(),
                attrHostID: context.primaryHostID,
            }, normalized.registry);
            let undoID = '';
            if (!options || options.recordUndo !== false) {
                const inverse = {};
                const expected = {};
                Object.keys(patch).forEach((key) => {
                    if (key === 'taskCompleteAt') return;
                    if (key === 'title') {
                        inverse.title = before.title;
                        expected.title = after.title;
                    } else if (key === 'done') {
                        inverse.done = before.done;
                        expected.done = after.done;
                    } else if (key === 'customFieldValues') {
                        inverse.customFieldValues = {};
                        expected.customFieldValues = {};
                        Object.keys(patch.customFieldValues || {}).forEach((fieldID) => {
                            inverse.customFieldValues[fieldID] = before.customFieldValues?.[fieldID] ?? '';
                            expected.customFieldValues[fieldID] = after.customFieldValues?.[fieldID] ?? '';
                        });
                    } else {
                        inverse[key] = before[key];
                        expected[key] = after[key];
                    }
                });
                state.lastUndo = {
                    id: token('undo'),
                    createdAt: Date.now(),
                    label: `更新任务：${after.title}`,
                    verify: async () => {
                        const current = await taskDTO(id);
                        return Object.keys(expected).every((key) => {
                            if (key !== 'customFieldValues') return stableJson(current[key]) === stableJson(expected[key]);
                            return Object.keys(expected.customFieldValues || {}).every((fieldID) => (
                                stableJson(current.customFieldValues?.[fieldID] ?? '') === stableJson(expected.customFieldValues[fieldID])
                            ));
                        });
                    },
                    execute: () => applyTaskPatch(id, inverse, { allowSystem: true, recordUndo: false }),
                };
                rememberUndo(state.lastUndo);
                undoID = state.lastUndo.id;
            }
            return {
                task: after,
                changes: patch,
                undoID,
                refresh: taskMutationRefresh('update', [id], [after.documentID]),
            };
        });
    }

    function extractInsertedID(data) {
        try {
            return text(data[0].doOperations[0].id);
        } catch (error) {
            return '';
        }
    }

    async function resolveInsertedTaskID(insertedID) {
        const id = requireID(insertedID, '新块 ID');
        const rows = await sql(`
            WITH RECURSIVE tree(id, depth) AS (
                SELECT '${escapeSql(id)}', 0
                UNION ALL
                SELECT b.id, tree.depth + 1 FROM blocks b JOIN tree ON b.parent_id = tree.id WHERE tree.depth < 4
            )
            SELECT b.id FROM blocks b JOIN tree ON tree.id = b.id
            WHERE b.type = 'i' AND b.subtype = 't'
            ORDER BY tree.depth ASC, b.sort ASC, b.created ASC LIMIT 1
        `);
        if (rows.length) return text(rows[0].id);
        throw new DomainError(ERROR.STORAGE_ERROR, '任务已写入但暂未解析到真实任务块', { insertedID: id });
    }

    async function createTask(input) {
        const source = input && typeof input === 'object' ? input : {};
        const title = text(source.title || source.content);
        if (!title) throw new DomainError(ERROR.INVALID_ARGUMENT, '任务标题不能为空');
        const parentTaskID = text(source.parentTaskID || source.parentTaskId);
        const documentID = text(source.documentID || source.documentId || source.docID || source.docId);
        const parentID = parentTaskID ? requireID(parentTaskID, '父任务 ID') : requireID(documentID, '文档 ID');
        if (parentTaskID) await getTaskRow(parentTaskID);
        else await requireDocumentBlock(documentID);
        const markdown = `- [${source.patch && source.patch.done ? 'x' : ' '}] ${title}`;
        const result = await api('/api/block/appendBlock', { parentID, data: markdown, dataType: 'markdown' });
        const insertedID = extractInsertedID(result);
        if (!insertedID) throw new DomainError(ERROR.STORAGE_ERROR, '新建任务失败：未返回块 ID');
        const taskID = await resolveInsertedTaskID(insertedID);
        const patch = { ...(source.patch && typeof source.patch === 'object' ? source.patch : {}) };
        delete patch.title;
        let task;
        if (Object.keys(patch).length) task = (await applyTaskPatch(taskID, patch, { recordUndo: false })).task;
        else task = await taskDTO(taskID);
        const createdFingerprint = stableJson((() => {
            const snapshot = { ...task };
            delete snapshot.updated;
            return snapshot;
        })());
        state.lastUndo = {
            id: token('undo'),
            createdAt: Date.now(),
            label: `新建任务：${task.title}`,
            verify: async () => {
                const current = { ...(await taskDTO(taskID)) };
                delete current.updated;
                return stableJson(current) === createdFingerprint;
            },
            execute: async () => {
                return deleteTaskNow(taskID);
            },
        };
        rememberUndo(state.lastUndo);
        return {
            task,
            insertedBlockID: insertedID,
            undoID: state.lastUndo.id,
            refresh: taskMutationRefresh('create', [taskID], [task.documentID]),
        };
    }

    function normalizeTreeBlock(value) {
        const source = value && typeof value === 'object' ? value : {};
        return {
            ...source,
            id: text(source.id || source.ID),
            type: text(source.type || source.Type).toLowerCase(),
            subtype: text(source.subType || source.subtype || source.SubType).toLowerCase(),
        };
    }

    function isTreeBlockType(block, shortType, nodeType) {
        const type = text(block?.type).toLowerCase();
        return type === shortType || type === nodeType;
    }

    function isTreeDocumentBlock(block) {
        return isTreeBlockType(block, 'd', 'nodedocument');
    }

    function isTreeListBlock(block) {
        return isTreeBlockType(block, 'l', 'nodelist');
    }

    function isTreeTaskBlock(block) {
        return isTreeBlockType(block, 'i', 'nodelistitem') && text(block?.subtype).toLowerCase() === 't';
    }

    async function readBlockTreePath(blockID, label = '块') {
        const id = requireID(blockID, `${label} ID`);
        const raw = await api('/api/block/getBlockBreadcrumb', { id, excludeTypes: [] });
        const path = (Array.isArray(raw) ? raw : []).map(normalizeTreeBlock).filter((item) => item.id);
        const current = path.find((item) => item.id === id) || null;
        if (!current) throw new DomainError(ERROR.NOT_FOUND, `未找到${label}`, { blockID: id });
        const document = path.find(isTreeDocumentBlock) || null;
        return { id, path, current, document };
    }

    async function tryReadBlockTreePath(blockID, label = '块') {
        try {
            return await readBlockTreePath(blockID, label);
        } catch (error) {
            if (error instanceof DomainError && error.code === ERROR.NOT_FOUND) return null;
            throw error;
        }
    }

    async function readTreeChildren(blockID) {
        const id = requireID(blockID, '父块 ID');
        const raw = await api('/api/block/getChildBlocks', { id });
        return (Array.isArray(raw) ? raw : []).map(normalizeTreeBlock).filter((item) => item.id);
    }

    async function inspectTaskListsUnder(ownerID, preferredListID = '', targetTaskID = '') {
        const ownerChildren = await readTreeChildren(ownerID);
        const listBlocks = ownerChildren.filter(isTreeListBlock);
        const preferredID = text(preferredListID);
        const targetID = text(targetTaskID);
        const preferredList = preferredID ? listBlocks.find((list) => list.id === preferredID) : null;
        const preferred = preferredList ? {
            list: preferredList,
            children: await readTreeChildren(preferredList.id),
        } : null;
        if (preferred && (!targetID || preferred.children.some((item) => item.id === targetID))) {
            return { ownerChildren, entries: [preferred], taskList: preferred };
        }
        const entries = preferred ? [preferred] : [];
        for (const list of listBlocks) {
            if (preferred && list.id === preferred.list.id) continue;
            const entry = { list, children: await readTreeChildren(list.id) };
            entries.push(entry);
            const matched = targetID
                ? entry.children.some((item) => item.id === targetID)
                : entry.list.subtype === 't' || entry.children.some(isTreeTaskBlock);
            if (matched) return { ownerChildren, entries, taskList: entry };
        }
        return { ownerChildren, entries, taskList: null };
    }

    function placementFromTaskList(taskID, listID, children, context = {}) {
        const id = requireID(taskID, '任务 ID');
        const taskIDs = (Array.isArray(children) ? children : [])
            .filter(isTreeTaskBlock)
            .map((item) => item.id);
        const index = taskIDs.indexOf(id);
        if (index < 0) {
            throw new DomainError(ERROR.CONFLICT, '任务不在预期列表中', {
                taskID: id,
                listID: text(listID),
                childTaskIDs: taskIDs,
            });
        }
        return {
            taskID: id,
            parentListID: text(listID),
            parentTaskID: text(context.parentTaskID),
            parentType: 'l',
            previousSiblingID: index > 0 ? taskIDs[index - 1] : '',
            nextSiblingID: index + 1 < taskIDs.length ? taskIDs[index + 1] : '',
            firstTaskID: text(taskIDs[0]),
            documentID: text(context.documentID),
        };
    }

    async function readTaskTreeContext(taskID) {
        const id = requireID(taskID, '任务 ID');
        const location = await readBlockTreePath(id, '任务');
        if (!isTreeTaskBlock(location.current)) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '目标块不是任务', { blockID: id });
        }
        const currentIndex = location.path.findIndex((item) => item.id === id);
        const ancestors = currentIndex >= 0 ? location.path.slice(0, currentIndex) : location.path;
        const parentTasks = ancestors.filter(isTreeTaskBlock);
        return {
            ...location,
            documentID: text(location.document?.id),
            parentTaskID: text(parentTasks[parentTasks.length - 1]?.id),
            ancestorTaskIDs: parentTasks.map((item) => item.id),
        };
    }

    async function readTaskPlacementFromTree(taskID, preferredListID = '') {
        const context = await readTaskTreeContext(taskID);
        const preferredID = text(preferredListID);
        if (preferredID) {
            try {
                const preferredChildren = await readTreeChildren(preferredID);
                if (preferredChildren.some((item) => item.id === context.id && isTreeTaskBlock(item))) {
                    return placementFromTaskList(context.id, preferredID, preferredChildren, context);
                }
            } catch (error) {}
        }
        const currentIndex = context.path.findIndex((item) => item.id === context.id);
        const ownerCandidates = (currentIndex >= 0 ? context.path.slice(0, currentIndex) : context.path)
            .slice()
            .reverse()
            .filter((item, index, items) => item.id && items.findIndex((candidate) => candidate.id === item.id) === index);
        if (!ownerCandidates.length) {
            throw new DomainError(ERROR.CONFLICT, '无法确定任务所在文档', { taskID: context.id });
        }
        const summarizeBlock = (item) => ({
            id: item.id,
            type: item.type,
            subtype: item.subtype,
        });
        const attempts = [];
        for (const owner of ownerCandidates) {
            const inspected = isTreeListBlock(owner)
                ? {
                    ownerChildren: await readTreeChildren(owner.id),
                    entries: [],
                }
                : await inspectTaskListsUnder(owner.id, '', context.id);
            if (isTreeListBlock(owner)) {
                inspected.entries.push({ list: owner, children: inspected.ownerChildren });
            }
            const matches = inspected.entries.filter((entry) => entry.children.some((item) => item.id === context.id));
            attempts.push({
                owner: summarizeBlock(owner),
                ownerChildren: inspected.ownerChildren.map(summarizeBlock),
                candidateLists: inspected.entries.map((entry) => ({
                    list: summarizeBlock(entry.list),
                    children: entry.children.map(summarizeBlock),
                })),
                matchingListIDs: matches.map((entry) => entry.list.id),
            });
            if (matches.length === 1) {
                return placementFromTaskList(context.id, matches[0].list.id, matches[0].children, context);
            }
            if (matches.length > 1) break;
        }
        const diagnostic = {
            taskID: context.id,
            documentID: context.documentID,
            parentTaskID: context.parentTaskID,
            ancestorTaskIDs: context.ancestorTaskIDs,
            preferredListID: preferredID,
            breadcrumb: context.path.map(summarizeBlock),
            ownerCandidates: ownerCandidates.map(summarizeBlock),
            attempts,
            matchingListIDs: attempts.flatMap((attempt) => attempt.matchingListIDs),
        };
        throw new DomainError(ERROR.CONFLICT, '无法确定任务所在列表', diagnostic);
    }

    function comparablePlacement(value) {
        const source = value && typeof value === 'object' ? value : {};
        return {
            parentListID: text(source.parentListID || source.parentListId || source.parentID),
            documentID: text(source.documentID || source.documentId),
            previousSiblingID: text(source.previousSiblingID || source.previousSiblingId || source.previousID),
            nextSiblingID: text(source.nextSiblingID || source.nextSiblingId || source.nextID),
        };
    }

    async function capturePlacement(taskID, rowInput) {
        const source = rowInput && typeof rowInput === 'object' ? rowInput : {};
        const parentType = text(source.parent_type || source.parentType).toLowerCase();
        const preferredListID = text(source.parentListID || source.parentListId)
            || (parentType === 'l' || parentType === 'nodelist' ? text(source.parent_id || source.parentID) : '');
        const placement = await readTaskPlacementFromTree(taskID, preferredListID);
        return {
            ...placement,
            parentID: placement.parentListID,
            previousID: placement.previousSiblingID,
            nextID: placement.nextSiblingID,
        };
    }

    async function firstTaskIDInList(listID) {
        const id = text(listID);
        if (!id) return '';
        try {
            const children = await readTreeChildren(id);
            return text(children.find(isTreeTaskBlock)?.id);
        } catch (error) {
            return '';
        }
    }

    async function reconcileMovedTaskAttrHosts(taskID, before, moved) {
        const placement = moved?.placement && typeof moved.placement === 'object' ? moved.placement : {};
        const oldFirstTaskID = await firstTaskIDInList(before?.parentID);
        const newFirstTaskID = await firstTaskIDInList(placement.parentListID || placement.parentID);
        const taskIDs = uniqueStrings([
            taskID,
            before?.previousID,
            before?.nextID,
            placement.previousSiblingID,
            placement.nextSiblingID,
            placement.firstTaskID,
            oldFirstTaskID,
            newFirstTaskID,
        ]);
        return reconcileTaskAttrHostsNow(taskIDs);
    }

    async function buildMovePlan(taskID, source, currentPlacement = null) {
        const input = source && typeof source === 'object' ? source : {};
        const payload = { id: taskID };
        const preferredListID = text(
            input.targetListID || input.targetListId || input.parentListID || input.parentListId
                || currentPlacement?.parentListID || currentPlacement?.parentListId
        );
        if (text(input.previousID || input.previousId)) {
            const previous = await readBlockTreePath(input.previousID || input.previousId, '前一块');
            if (previous.id === taskID) throw new DomainError(ERROR.INVALID_ARGUMENT, '任务不能相对自身移动');
            if (isTreeDocumentBlock(previous.current)) throw new DomainError(ERROR.INVALID_ARGUMENT, '前一块不能是文档块');
            payload.previousID = previous.id;
            const targetPlacement = isTreeTaskBlock(previous.current)
                ? await readTaskPlacementFromTree(previous.id, preferredListID)
                : null;
            return {
                payload,
                targetListID: text(targetPlacement?.parentListID || preferredListID),
                targetContext: targetPlacement ? {
                    parentTaskID: targetPlacement.parentTaskID,
                    documentID: targetPlacement.documentID,
                } : null,
            };
        }
        if (text(input.nextID || input.nextId)) {
            const nextID = requireID(input.nextID || input.nextId, '后一任务 ID');
            if (nextID === taskID) throw new DomainError(ERROR.INVALID_ARGUMENT, '任务不能相对自身移动');
            const nextPlacement = await readTaskPlacementFromTree(nextID, preferredListID);
            let previousID = text(nextPlacement.previousSiblingID);
            if (previousID === taskID) {
                const liveCurrentPlacement = currentPlacement && typeof currentPlacement === 'object'
                    ? currentPlacement
                    : await readTaskPlacementFromTree(taskID);
                previousID = liveCurrentPlacement.parentListID === nextPlacement.parentListID
                    ? text(liveCurrentPlacement.previousSiblingID)
                    : '';
            }
            if (previousID) payload.previousID = previousID;
            else payload.parentID = nextPlacement.parentListID;
            return {
                payload,
                targetListID: nextPlacement.parentListID,
                targetContext: {
                    parentTaskID: nextPlacement.parentTaskID,
                    documentID: nextPlacement.documentID,
                },
            };
        }
        if (text(input.parentID || input.parentId || input.documentID || input.documentId)) {
            const explicitParentID = text(input.parentID || input.parentId);
            const target = await readBlockTreePath(
                explicitParentID || input.documentID || input.documentId,
                explicitParentID ? '移动目标' : '目标文档',
            );
            const allowed = isTreeDocumentBlock(target.current)
                || isTreeListBlock(target.current)
                || isTreeTaskBlock(target.current);
            if (!allowed) throw new DomainError(ERROR.INVALID_ARGUMENT, '任务只能移动到文档、列表或父任务中');
            if (!explicitParentID && !isTreeDocumentBlock(target.current)) {
                throw new DomainError(ERROR.INVALID_ARGUMENT, '目标文档 ID 必须指向文档块');
            }
            if (target.id === taskID) throw new DomainError(ERROR.INVALID_ARGUMENT, '任务不能移动到自身内部');
            payload.parentID = target.id;
            const currentIndex = target.path.findIndex((item) => item.id === target.id);
            const ancestors = currentIndex >= 0 ? target.path.slice(0, currentIndex) : target.path;
            const parentTasks = ancestors.filter(isTreeTaskBlock);
            return {
                payload,
                targetListID: isTreeListBlock(target.current) ? target.id : '',
                targetContext: isTreeListBlock(target.current) ? {
                    parentTaskID: text(parentTasks[parentTasks.length - 1]?.id),
                    documentID: text(target.document?.id),
                } : null,
            };
        }
        throw new DomainError(ERROR.INVALID_ARGUMENT, '缺少目标位置');
    }

    async function confirmMovePlanPlacement(taskID, plan) {
        const movePlan = plan && typeof plan === 'object' ? plan : {};
        const targetListID = text(movePlan.targetListID);
        const targetContext = movePlan.targetContext && typeof movePlan.targetContext === 'object'
            ? movePlan.targetContext
            : null;
        if (targetListID && targetContext?.documentID) {
            try {
                const children = await readTreeChildren(targetListID);
                if (children.some((item) => item.id === taskID && isTreeTaskBlock(item))) {
                    return placementFromTaskList(taskID, targetListID, children, targetContext);
                }
            } catch (error) {}
        }
        return readTaskPlacementFromTree(taskID, targetListID);
    }

    function normalizeTaskMoveMode(value) {
        const mode = text(value || '');
        if (!mode || mode === 'doc') return 'docTop';
        if (['docTop', 'docBottom', 'document-list', 'recycle-document', 'heading', 'before', 'after', 'child', 'child-top'].includes(mode)) return mode;
        throw new DomainError(ERROR.INVALID_ARGUMENT, `不支持的任务移动方式: ${mode}`);
    }

    async function resolveTaskMoveCommand(taskID, source) {
        const input = source && typeof source === 'object' ? source : {};
        const rawMode = text(input.mode);
        if (!rawMode) {
            const legacyParentTaskID = text(input.parentTaskID || input.parentTaskId);
            if (legacyParentTaskID) {
                return {
                    mode: text(input.childPosition || input.position).toLowerCase() === 'top' ? 'child-top' : 'child',
                    parentTaskID: requireID(legacyParentTaskID, '父任务 ID'),
                    requestedListID: input.requestedListID || input.requestedListId,
                    childPosition: text(input.childPosition || input.position).toLowerCase() === 'top' ? 'top' : 'bottom',
                };
            }
            if (text(input.previousID || input.previousId || input.nextID || input.nextId || input.parentID || input.parentId || input.documentID || input.documentId)) {
                return { mode: 'direct', moveInput: input };
            }
        }
        const mode = normalizeTaskMoveMode(input.mode);
        if (mode === 'child' || mode === 'child-top') {
            const parentTaskID = requireID(input.parentTaskID || input.parentTaskId || input.targetTaskID || input.targetTaskId, '父任务 ID');
            return {
                mode,
                parentTaskID,
                requestedListID: input.requestedListID || input.requestedListId,
                childPosition: mode === 'child-top' ? 'top' : 'bottom',
            };
        }
        if (mode === 'before' || mode === 'after') {
            const targetTaskID = requireID(input.targetTaskID || input.targetTaskId, '目标任务 ID');
            const targetListID = text(input.targetListID || input.targetListId);
            return {
                mode,
                moveInput: mode === 'before'
                    ? { nextID: targetTaskID, targetListID }
                    : { previousID: targetTaskID, targetListID },
            };
        }
        if (mode === 'heading') {
            const headingID = requireID(input.headingID || input.headingId || input.targetHeadingID || input.targetHeadingId, '标题 ID');
            const heading = await getBlockRole(headingID, '标题块');
            if (heading.type !== 'h') throw new DomainError(ERROR.INVALID_ARGUMENT, '目标块不是标题');
            const documentID = text(input.targetDocumentID || input.targetDocumentId || input.documentID || input.documentId);
            if (documentID && heading.rootID !== documentID) {
                throw new DomainError(ERROR.CONFLICT, '目标标题不属于指定文档');
            }
            return {
                mode,
                headingID,
                requestedListID: input.requestedListID || input.requestedListId,
            };
        }
        if (mode === 'document-list') {
            const documentID = requireID(
                input.targetDocumentID || input.targetDocumentId || input.documentID || input.documentId,
                '目标文档 ID',
            );
            await requireDocumentBlock(documentID);
            return {
                mode,
                documentID,
                sourceListID: text(input.sourceListID || input.sourceListId),
                sourceDocumentID: text(input.sourceDocumentID || input.sourceDocumentId),
                moveInput: input,
            };
        }
        if (mode === 'recycle-document') {
            const documentID = requireID(
                input.targetDocumentID || input.targetDocumentId || input.documentID || input.documentId,
                '目标文档 ID',
            );
            await requireDocumentBlock(documentID);
            return { mode, documentID };
        }
        const documentID = requireID(
            input.targetDocumentID || input.targetDocumentId || input.documentID || input.documentId,
            '目标文档 ID',
        );
        await requireDocumentBlock(documentID);
        const targetLists = await inspectTaskListsUnder(
            documentID,
            input.targetListID || input.targetListId,
        );
        const containerID = text(targetLists.taskList?.list?.id);
        if (!containerID) {
            return {
                mode,
                documentID,
                independentDocument: true,
                independentPosition: mode === 'docBottom' ? 'bottom' : 'top',
            };
        }
        const siblingIDs = targetLists.taskList.children
            .filter(isTreeTaskBlock)
            .map((item) => item.id)
            .filter((id) => id !== taskID);
        if (!siblingIDs.length) return { mode, moveInput: { parentID: containerID } };
        return {
            mode,
            moveInput: mode === 'docBottom'
                ? { previousID: siblingIDs[siblingIDs.length - 1] }
                : { nextID: siblingIDs[0] },
        };
    }

    function applyPlacementToTaskDTO(task, placement) {
        const dto = task && typeof task === 'object' ? task : {};
        const target = placement && typeof placement === 'object' ? placement : {};
        dto.parentListID = text(target.parentListID);
        dto.parentTaskID = text(target.parentTaskID);
        dto.parentType = text(target.parentType);
        dto.previousSiblingID = text(target.previousSiblingID);
        dto.nextSiblingID = text(target.nextSiblingID);
        dto.firstTaskID = text(target.firstTaskID);
        dto.documentID = text(target.documentID);
        return dto;
    }

    function nestedTaskListDOM(listID, taskDOM) {
        const id = requireID(listID, '子列表 ID');
        const dom = String(taskDOM || '').trim();
        if (!dom || !dom.includes('data-type="NodeListItem"')) {
            throw new DomainError(ERROR.STORAGE_ERROR, '无法读取待移动任务的标准块 DOM');
        }
        return `<div data-subtype="t" data-node-id="${id}" data-type="NodeList" class="list" updated="${id.slice(0, 14)}">${dom}<div class="protyle-attr" contenteditable="false">&ZeroWidthSpace;</div></div>`;
    }

    async function ensureTaskListContainer(row, registryInput) {
        const source = row && typeof row === 'object' ? row : {};
        if (text(source.parent_type).toLowerCase() !== 'd') return source;
        const documentID = requireID(source.parent_id || source.root_id, '任务所在文档 ID');
        try {
            const liveDocumentChildren = await api('/api/block/getChildBlocks', { id: documentID });
            const liveChildren = Array.isArray(liveDocumentChildren) ? liveDocumentChildren : [];
            const directTask = liveChildren.some((child) => text(child?.id) === text(source.id)
                && text(child?.type).toLowerCase() === 'i'
                && text(child?.subType || child?.subtype).toLowerCase() === 't');
            if (!directTask) {
                for (const child of liveChildren) {
                    const childType = text(child?.type).toLowerCase();
                    if (childType !== 'l' && childType !== 'nodelist') continue;
                    const listChildren = await api('/api/block/getChildBlocks', { id: text(child?.id) });
                    const liveTasks = (Array.isArray(listChildren) ? listChildren : []).filter((item) => (
                        text(item?.type).toLowerCase() === 'i'
                        && text(item?.subType || item?.subtype).toLowerCase() === 't'
                    ));
                    const liveIndex = liveTasks.findIndex((item) => text(item?.id) === text(source.id));
                    if (liveIndex < 0) continue;
                    return {
                        ...source,
                        parent_id: text(child?.id),
                        parent_type: 'l',
                        parent_task_id: '',
                        previous_sibling_id: text(liveTasks[liveIndex - 1]?.id),
                        next_sibling_id: text(liveTasks[liveIndex + 1]?.id),
                        parent_task_count: liveTasks.length,
                        first_task_id: text(liveTasks[0]?.id),
                        __taskHorizonLivePlacement: true,
                    };
                }
            }
        } catch (error) {}
        const childRows = await sql(`
            SELECT id, type, subtype FROM blocks
            WHERE parent_id = '${escapeSql(documentID)}'
            ORDER BY sort ASC, created ASC, id ASC
        `);
        const nakedTaskRows = childRows.filter((child) => (
            text(child.type).toLowerCase() === 'i' && text(child.subtype).toLowerCase() === 't'
        ));
        if (!nakedTaskRows.length) return source;

        const registry = registryInput || await getFieldRegistry();
        const nakedTaskIDs = new Set(nakedTaskRows.map((child) => text(child.id)).filter(Boolean));
        const prepared = new Map();
        for (const taskID of nakedTaskIDs) {
            const taskRow = taskID === text(source.id) ? source : await getTaskRow(taskID);
            const [taskDOM, rawAttrs] = await Promise.all([readBlockDOM(taskID), readAttrs(taskID)]);
            const context = buildAttrContext(taskRow);
            const canonicalAttrs = await buildCanonicalTaskAttrs({ taskID, ...context }, {}, registry);
            prepared.set(taskID, {
                taskRow,
                taskDOM,
                rawAttrs,
                canonicalAttrs,
                listID: newNodeID(),
            });
        }

        const operations = [];
        let previousFinalID = '';
        for (const child of childRows) {
            const childID = text(child.id);
            const entry = prepared.get(childID);
            if (!entry) {
                previousFinalID = childID;
                continue;
            }
            const insertOperation = {
                action: 'insert',
                id: entry.listID,
                parentID: documentID,
                data: nestedTaskListDOM(entry.listID, entry.taskDOM),
            };
            if (previousFinalID) insertOperation.previousID = previousFinalID;
            operations.push({ action: 'delete', id: childID }, insertOperation);
            const restoredTaskAttrs = { ...entry.rawAttrs, ...entry.canonicalAttrs };
            if (Object.keys(restoredTaskAttrs).length) {
                operations.push({ action: 'setAttrs', id: childID, data: JSON.stringify(restoredTaskAttrs) });
            }
            previousFinalID = entry.listID;
        }
        await pushTaskTransaction(operations);

        for (const [taskID, entry] of prepared) {
            const children = await api('/api/block/getChildBlocks', { id: entry.listID });
            const childIDs = (Array.isArray(children) ? children : [])
                .map((child) => text(child && (child.id || child.ID)))
                .filter(Boolean);
            if (!childIDs.includes(taskID)) {
                throw new DomainError(ERROR.CONFLICT, '顶层任务项修复后未进入任务列表', {
                    taskID,
                    listID: entry.listID,
                    childIDs,
                });
            }
        }

        const repaired = prepared.get(text(source.id));
        if (!repaired) return source;
        return {
            ...source,
            parent_id: repaired.listID,
            parent_type: 'l',
            parent_task_id: '',
            previous_sibling_id: '',
            next_sibling_id: '',
            parent_task_count: 1,
            first_task_id: text(source.id),
            __taskHorizonStructureRepaired: true,
        };
    }

    async function ensureTaskListMutationTarget(taskID, registryInput, rowInput) {
        const id = requireID(taskID, '任务 ID');
        let row = rowInput && typeof rowInput === 'object' ? rowInput : await getTaskRow(id);
        row = await ensureTaskListContainer(row, registryInput);
        const parentType = text(row && row.parent_type).toLowerCase();
        if (parentType !== 'l') {
            throw new DomainError(ERROR.CONFLICT, '任务不在合法的列表容器中', {
                taskID: id,
                parentID: text(row && row.parent_id),
                parentType,
            });
        }
        return row;
    }

    async function moveIndependentTaskListToDocument(taskID, documentID, sourceListID, sourceDocumentID, source) {
        const id = requireID(taskID, '任务 ID');
        const targetDocumentID = requireID(documentID, '目标文档 ID');
        await requireDocumentBlock(targetDocumentID);
        const archiveDocumentID = requireID(sourceDocumentID, '归档文档 ID');
        await requireDocumentBlock(archiveDocumentID);
        const archiveChildren = await api('/api/block/getChildBlocks', { id: archiveDocumentID });
        const liveArchiveChildren = Array.isArray(archiveChildren) ? archiveChildren : [];
        const listCandidates = liveArchiveChildren.filter((item) => {
            const type = text(item?.type).toLowerCase();
            return type === 'l' || type === 'nodelist';
        });
        const requestedListID = text(sourceListID);
        if (requestedListID) requireID(requestedListID, '归档任务列表 ID');
        const orderedCandidates = listCandidates.slice().sort((left, right) => {
            if (text(left?.id) === requestedListID) return -1;
            if (text(right?.id) === requestedListID) return 1;
            return 0;
        });
        const matches = [];
        for (const candidate of orderedCandidates) {
            const candidateID = text(candidate?.id);
            if (!candidateID) continue;
            const children = await api('/api/block/getChildBlocks', { id: candidateID });
            const childIDs = (Array.isArray(children) ? children : [])
                .map((item) => text(item?.id))
                .filter(Boolean);
            if (childIDs.includes(id)) matches.push({ id: candidateID, childIDs });
        }
        const directTask = liveArchiveChildren.some((item) => (
            text(item?.id) === id
            && text(item?.type).toLowerCase() === 'i'
            && text(item?.subType || item?.subtype).toLowerCase() === 't'
        ));
        if (matches.length !== 1 && !directTask) {
            throw new DomainError(ERROR.CONFLICT, '无法从归档文档确定任务所在列表', {
                taskID: id,
                archiveDocumentID,
                requestedListID,
                matchedListIDs: matches.map((item) => item.id),
            });
        }
        if (matches.length > 1) {
            throw new DomainError(ERROR.CONFLICT, '任务同时出现在多个归档列表中', {
                taskID: id,
                archiveDocumentID,
                matchedListIDs: matches.map((item) => item.id),
            });
        }
        const sourceMatch = matches[0] || null;
        const sourceList = sourceMatch ? {
            id: sourceMatch.id,
            parentID: archiveDocumentID,
            rootID: archiveDocumentID,
            type: 'l',
            subtype: 't',
        } : null;
        const sourceChildIDs = sourceMatch ? sourceMatch.childIDs.slice() : [id];
        const sourceTaskIndex = sourceChildIDs.indexOf(id);
        const sourcePreviousID = sourceTaskIndex > 0 ? text(sourceChildIDs[sourceTaskIndex - 1]) : '';
        const sourceNextID = sourceTaskIndex >= 0 ? text(sourceChildIDs[sourceTaskIndex + 1]) : '';
        const canMoveSourceList = !!sourceList
            && sourceChildIDs.length === 1
            && sourceChildIDs[0] === id;

        const input = source && typeof source === 'object' ? source : {};
        const previousID = text(input.previousID || input.previousId);
        const nextID = text(input.nextID || input.nextId);
        let expectedPreviousID = '';
        let expectedNextID = '';
        const targetChildren = await api('/api/block/getChildBlocks', { id: targetDocumentID });
        const orderedTargetIDs = (Array.isArray(targetChildren) ? targetChildren : [])
            .map((item) => text(item?.id))
            .filter((blockID) => blockID
                && blockID !== (canMoveSourceList ? sourceList.id : '')
                && blockID !== (directTask ? id : ''));
        if (previousID) {
            if (!orderedTargetIDs.includes(previousID)) {
                throw new DomainError(ERROR.CONFLICT, '默认位置的前一块已经变化', { previousID, targetDocumentID });
            }
            expectedPreviousID = previousID;
        } else if (nextID) {
            const nextIndex = orderedTargetIDs.indexOf(nextID);
            if (nextIndex < 0) throw new DomainError(ERROR.CONFLICT, '默认位置的后一块已经变化', { nextID, targetDocumentID });
            expectedNextID = nextID;
            if (nextIndex > 0) expectedPreviousID = orderedTargetIDs[nextIndex - 1];
        }

        let listID = '';
        if (canMoveSourceList) {
            listID = sourceList.id;
            const movePayload = expectedPreviousID
                ? { id: sourceList.id, previousID: expectedPreviousID }
                : { id: sourceList.id, parentID: targetDocumentID };
            await api('/api/block/moveBlock', movePayload);
        } else {
            const scaffoldResult = await api('/api/block/insertBlock', {
                parentID: targetDocumentID,
                ...(expectedPreviousID ? { previousID: expectedPreviousID } : {}),
                data: '- [ ]',
                dataType: 'markdown',
            });
            listID = requireID(extractInsertedID(scaffoldResult), '恢复任务列表 ID');
            const scaffoldChildren = await api('/api/block/getChildBlocks', { id: listID });
            const scaffoldTaskID = requireID(
                (Array.isArray(scaffoldChildren) ? scaffoldChildren : [])[0]?.id,
                '恢复任务列表占位任务 ID',
            );
            try {
                await api('/api/block/moveBlock', { id, parentID: listID });
                const movedChildren = await api('/api/block/getChildBlocks', { id: listID });
                const movedChildIDs = (Array.isArray(movedChildren) ? movedChildren : [])
                    .map((item) => text(item?.id))
                    .filter(Boolean);
                if (!movedChildIDs.includes(id)) {
                    throw new DomainError(ERROR.CONFLICT, '任务恢复后未进入独立列表', { taskID: id, listID, movedChildIDs });
                }
                await api('/api/block/deleteBlock', { id: scaffoldTaskID });
            } catch (error) {
                try {
                    const children = await api('/api/block/getChildBlocks', { id: listID });
                    const childIDs = (Array.isArray(children) ? children : []).map((item) => text(item?.id)).filter(Boolean);
                    if (!childIDs.includes(id)) await api('/api/block/deleteBlock', { id: listID });
                } catch (e) {}
                throw error;
            }
        }

        await api('/api/sqlite/flushTransaction', {});
        const [documentChildren, verifiedListChildren] = await Promise.all([
            api('/api/block/getChildBlocks', { id: targetDocumentID }),
            api('/api/block/getChildBlocks', { id: listID }),
        ]);
        const documentChildIDs = (Array.isArray(documentChildren) ? documentChildren : [])
            .map((item) => text(item?.id))
            .filter(Boolean);
        const verifiedTaskIDs = (Array.isArray(verifiedListChildren) ? verifiedListChildren : [])
            .map((item) => text(item?.id))
            .filter(Boolean);
        const listIndex = documentChildIDs.indexOf(listID);
        const actualPreviousID = listIndex > 0 ? text(documentChildIDs[listIndex - 1]) : '';
        const actualNextID = listIndex >= 0 ? text(documentChildIDs[listIndex + 1]) : '';
        if (listIndex < 0
            || actualPreviousID !== expectedPreviousID
            || (expectedNextID && actualNextID !== expectedNextID)
            || verifiedTaskIDs.length !== 1
            || verifiedTaskIDs[0] !== id) {
            throw new DomainError(ERROR.CONFLICT, '任务未落盘到默认新建位置', {
                taskID: id,
                listID,
                targetDocumentID,
                expectedPreviousID,
                expectedNextID,
                actualPreviousID,
                actualNextID,
                listChildIDs: verifiedTaskIDs,
            });
        }
        const placement = {
            taskID: id,
            parentListID: listID,
            parentTaskID: '',
            parentType: 'l',
            previousSiblingID: '',
            nextSiblingID: '',
            firstTaskID: id,
            documentID: targetDocumentID,
        };
        return {
            placement,
            listID,
            sourceListID: text(sourceList?.id),
            sourcePreviousID,
            sourceNextID,
            authoritative: true,
        };
    }

    async function moveTaskIntoHeading(taskID, headingID, requestedListID, sourceRow) {
        const id = requireID(taskID, '任务 ID');
        const hid = requireID(headingID, '标题 ID');
        const heading = await getBlockRole(hid, '标题块');
        if (heading.type !== 'h') throw new DomainError(ERROR.INVALID_ARGUMENT, '目标块不是标题');
        const before = sourceRow && typeof sourceRow === 'object' ? sourceRow : await getTaskRow(id);
        const sourceList = before.__taskHorizonStructureRepaired === true
            ? { id: text(before.parent_id), parentID: text(before.root_id), rootID: text(before.root_id), type: 'l', subtype: 't' }
            : await getBlockRole(before.parent_id, '任务列表');
        let sourceListChildren = [];
        let sourceListParent = null;
        try {
            sourceListChildren = await api('/api/block/getChildBlocks', { id: sourceList.id });
            sourceListParent = before.__taskHorizonStructureRepaired === true
                ? { id: text(before.root_id), type: 'd' }
                : await getBlockRole(sourceList.parentID, '任务列表父块');
        } catch (e) {
            sourceListChildren = [];
            sourceListParent = null;
        }
        const sourceChildIDs = (Array.isArray(sourceListChildren) ? sourceListChildren : [])
            .map((item) => text(item?.id))
            .filter(Boolean);
        const canMoveSourceList = sourceList.type === 'l'
            && sourceListParent?.type === 'd'
            && sourceChildIDs.length === 1
            && sourceChildIDs[0] === id;

        let listID = '';
        let scaffoldTaskID = '';
        let movePayload;
        if (canMoveSourceList) {
            listID = sourceList.id;
            movePayload = { id: listID, previousID: hid, parentID: heading.parentID };
            await api('/api/block/moveBlock', movePayload);
        } else {
            const scaffoldResult = await api('/api/block/insertBlock', {
                previousID: hid,
                data: '- [ ]',
                dataType: 'markdown',
            });
            listID = requireID(extractInsertedID(scaffoldResult), '标题任务列表 ID');
            const scaffoldChildren = await api('/api/block/getChildBlocks', { id: listID });
            scaffoldTaskID = requireID((Array.isArray(scaffoldChildren) ? scaffoldChildren : [])[0]?.id, '标题任务列表占位任务 ID');
            movePayload = { id, parentID: listID };
            try {
                await api('/api/block/moveBlock', movePayload);
                const movedChildren = await api('/api/block/getChildBlocks', { id: listID });
                const movedChildIDs = (Array.isArray(movedChildren) ? movedChildren : [])
                    .map((item) => text(item?.id))
                    .filter(Boolean);
                if (!movedChildIDs.includes(id)) {
                    throw new DomainError(ERROR.CONFLICT, '任务移动后未进入独立列表', { taskID: id, listID, movedChildIDs });
                }
                await api('/api/block/deleteBlock', { id: scaffoldTaskID });
            } catch (error) {
                try {
                    const children = await api('/api/block/getChildBlocks', { id: listID });
                    const childIDs = (Array.isArray(children) ? children : []).map((item) => text(item?.id)).filter(Boolean);
                    if (!childIDs.includes(id)) await api('/api/block/deleteBlock', { id: listID });
                } catch (e) {}
                throw error;
            }
        }

        await api('/api/sqlite/flushTransaction', {});
        const [documentChildren, verifiedListChildren] = await Promise.all([
            api('/api/block/getChildBlocks', { id: heading.parentID }),
            api('/api/block/getChildBlocks', { id: listID }),
        ]);
        const documentChildIDs = (Array.isArray(documentChildren) ? documentChildren : [])
            .map((item) => text(item?.id))
            .filter(Boolean);
        const verifiedTaskIDs = (Array.isArray(verifiedListChildren) ? verifiedListChildren : [])
            .map((item) => text(item?.id))
            .filter(Boolean);
        const headingIndex = documentChildIDs.indexOf(hid);
        if (headingIndex < 0 || documentChildIDs[headingIndex + 1] !== listID || !verifiedTaskIDs.includes(id)) {
            throw new DomainError(ERROR.CONFLICT, '任务未落盘到目标标题下', {
                taskID: id,
                headingID: hid,
                listID,
                headingNextID: headingIndex >= 0 ? text(documentChildIDs[headingIndex + 1]) : '',
                listChildIDs: verifiedTaskIDs,
            });
        }
        const placement = {
            taskID: id,
            parentListID: listID,
            parentTaskID: '',
            parentType: 'l',
            previousSiblingID: canMoveSourceList ? text(before.previous_sibling_id) : '',
            nextSiblingID: '',
            firstTaskID: id,
            documentID: heading.rootID,
        };
        return {
            task: applyPlacementToTaskDTO(await taskDTO(before), placement),
            placement,
            listID,
            authoritative: true,
        };
    }

    async function moveTaskIntoIndependentDocument(taskID, documentID, independentPosition, sourceRow) {
        const id = requireID(taskID, '任务 ID');
        const targetDocumentID = requireID(documentID, '目标文档 ID');
        const position = text(independentPosition).toLowerCase() === 'bottom' ? 'bottom' : 'top';
        await requireDocumentBlock(targetDocumentID);
        const before = sourceRow && typeof sourceRow === 'object' ? sourceRow : await getTaskRow(id);
        const sourceList = before.__taskHorizonStructureRepaired === true
            ? { id: text(before.parent_id), parentID: text(before.root_id), rootID: text(before.root_id), type: 'l', subtype: 't' }
            : await getBlockRole(before.parent_id, '任务列表');
        let sourceListChildren = [];
        let sourceListParent = null;
        try {
            sourceListChildren = await api('/api/block/getChildBlocks', { id: sourceList.id });
            sourceListParent = before.__taskHorizonStructureRepaired === true
                ? { id: text(before.root_id), type: 'd' }
                : await getBlockRole(sourceList.parentID, '任务列表父块');
        } catch (e) {
            sourceListChildren = [];
            sourceListParent = null;
        }
        const sourceChildIDs = (Array.isArray(sourceListChildren) ? sourceListChildren : [])
            .map((item) => text(item?.id))
            .filter(Boolean);
        const canMoveSourceList = sourceList.type === 'l'
            && sourceListParent?.type === 'd'
            && sourceChildIDs.length === 1
            && sourceChildIDs[0] === id;
        const targetChildrenBefore = await api('/api/block/getChildBlocks', { id: targetDocumentID });
        const targetChildIDsBefore = (Array.isArray(targetChildrenBefore) ? targetChildrenBefore : [])
            .map((item) => text(item?.id))
            .filter((childID) => childID && childID !== sourceList.id);
        const targetLastChildID = text(targetChildIDsBefore[targetChildIDsBefore.length - 1]);

        let listID = '';
        let scaffoldTaskID = '';
        if (canMoveSourceList) {
            listID = sourceList.id;
            const payload = position === 'bottom' && targetLastChildID
                ? { id: listID, previousID: targetLastChildID }
                : { id: listID, parentID: targetDocumentID };
            await api('/api/block/moveBlock', payload);
        } else {
            const endpoint = position === 'bottom' ? '/api/block/appendBlock' : '/api/block/insertBlock';
            const scaffoldResult = await api(endpoint, {
                parentID: targetDocumentID,
                data: '- [ ]',
                dataType: 'markdown',
            });
            listID = requireID(extractInsertedID(scaffoldResult), '回收站任务列表 ID');
            const scaffoldChildren = await api('/api/block/getChildBlocks', { id: listID });
            scaffoldTaskID = requireID((Array.isArray(scaffoldChildren) ? scaffoldChildren : [])[0]?.id, '回收站占位任务 ID');
            try {
                await api('/api/block/moveBlock', { id, parentID: listID });
                const movedChildren = await api('/api/block/getChildBlocks', { id: listID });
                const movedChildIDs = (Array.isArray(movedChildren) ? movedChildren : [])
                    .map((item) => text(item?.id))
                    .filter(Boolean);
                if (!movedChildIDs.includes(id)) {
                    throw new DomainError(ERROR.CONFLICT, '任务移动后未进入回收站独立列表', { taskID: id, listID, movedChildIDs });
                }
                await api('/api/block/deleteBlock', { id: scaffoldTaskID });
            } catch (error) {
                try {
                    const children = await api('/api/block/getChildBlocks', { id: listID });
                    const childIDs = (Array.isArray(children) ? children : []).map((item) => text(item?.id)).filter(Boolean);
                    if (!childIDs.includes(id)) await api('/api/block/deleteBlock', { id: listID });
                } catch (e) {}
                throw error;
            }
        }

        await api('/api/sqlite/flushTransaction', {});
        const [documentChildren, verifiedListChildren] = await Promise.all([
            api('/api/block/getChildBlocks', { id: targetDocumentID }),
            api('/api/block/getChildBlocks', { id: listID }),
        ]);
        const documentChildIDs = (Array.isArray(documentChildren) ? documentChildren : [])
            .map((item) => text(item?.id))
            .filter(Boolean);
        const verifiedTaskIDs = (Array.isArray(verifiedListChildren) ? verifiedListChildren : [])
            .map((item) => text(item?.id))
            .filter(Boolean);
        const expectedDocumentListID = position === 'bottom'
            ? text(documentChildIDs[documentChildIDs.length - 1])
            : text(documentChildIDs[0]);
        if (expectedDocumentListID !== listID || verifiedTaskIDs.length !== 1 || verifiedTaskIDs[0] !== id) {
            throw new DomainError(ERROR.CONFLICT, '任务未落盘到目标文档的独立列表', {
                taskID: id,
                listID,
                targetDocumentID,
                position,
                actualDocumentEdgeID: expectedDocumentListID,
                listChildIDs: verifiedTaskIDs,
            });
        }
        const placement = {
            taskID: id,
            parentListID: listID,
            parentTaskID: '',
            parentType: 'l',
            previousSiblingID: '',
            nextSiblingID: '',
            firstTaskID: id,
            documentID: targetDocumentID,
        };
        return {
            task: applyPlacementToTaskDTO(await taskDTO(before), placement),
            placement,
            listID,
            authoritative: true,
        };
    }

    async function moveTaskIntoParent(taskID, parentTaskID, requestedListID, childPosition, sourceRow) {
        const id = requireID(taskID, '任务 ID');
        const parentID = requireID(parentTaskID, '父任务 ID');
        const position = text(childPosition).toLowerCase() === 'top' ? 'top' : 'bottom';
        if (id === parentID) throw new DomainError(ERROR.INVALID_ARGUMENT, '任务不能移动到自身内部');

        const before = sourceRow && typeof sourceRow === 'object' ? sourceRow : await getTaskRow(id);
        const parentContext = await readTaskTreeContext(parentID);
        if (parentContext.ancestorTaskIDs.includes(id)) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '父任务不能移动到自己的子任务中');
        }
        const targetLists = await inspectTaskListsUnder(parentID, requestedListID);
        if (targetLists.taskList) {
            const listID = requireID(targetLists.taskList.list.id, '子列表 ID');
            const liveChildren = targetLists.taskList.children;
            const liveTaskIDs = liveChildren.filter(isTreeTaskBlock).map((item) => item.id);
            const currentIndex = liveTaskIDs.indexOf(id);
            const alreadyAtEdge = currentIndex >= 0
                && (position === 'top' ? currentIndex === 0 : currentIndex === liveTaskIDs.length - 1);
            if (alreadyAtEdge) {
                const placement = placementFromTaskList(id, listID, liveChildren, {
                    parentTaskID: parentID,
                    documentID: parentContext.documentID,
                });
                return {
                    changed: false,
                    reason: 'already-there',
                    task: applyPlacementToTaskDTO(await taskDTO(before), placement),
                    placement,
                    listID,
                    recovered: true,
                };
            }
            const siblingIDs = liveTaskIDs.filter((taskIDValue) => taskIDValue !== id);
            const firstSiblingID = text(siblingIDs[0]);
            const lastSiblingID = text(siblingIDs[siblingIDs.length - 1]);
            const movePayload = position === 'bottom' && lastSiblingID
                ? { id, previousID: lastSiblingID }
                : { id, parentID: listID };
            await api('/api/block/moveBlock', movePayload);
            const placement = placementFromTaskList(id, listID, await readTreeChildren(listID), {
                parentTaskID: parentID,
                documentID: parentContext.documentID,
            });
            return {
                task: applyPlacementToTaskDTO(await taskDTO(before), placement),
                placement,
                listID,
                authoritative: true,
            };
        }

        const listID = requireID(requestedListID, '预生成子列表 ID');
        const duplicateList = await tryReadBlockTreePath(listID, '预生成子列表');
        if (duplicateList) {
            throw new DomainError(ERROR.CONFLICT, '预生成子列表 ID 已被其他块占用');
        }
        const domResult = await api('/api/block/getBlockDOM', { id });
        const taskDOM = String(domResult && domResult.dom || '').trim();
        if (!taskDOM.includes(`data-node-id="${id}"`)) {
            throw new DomainError(ERROR.STORAGE_ERROR, '读取到的任务块 DOM 与任务 ID 不一致');
        }
        const targetLastChildID = text(targetLists.ownerChildren
            .filter((item) => item.id !== id)
            .slice(-1)[0]?.id);
        const insertOperation = {
            action: 'insert',
            id: listID,
            parentID,
            data: nestedTaskListDOM(listID, taskDOM),
        };
        if (targetLastChildID) insertOperation.previousID = targetLastChildID;
        await api('/api/transactions', {
            reqId: Date.now(),
            transactions: [{
                doOperations: [{ action: 'delete', id }, insertOperation],
            }],
        });
        const placement = placementFromTaskList(id, listID, await readTreeChildren(listID), {
            parentTaskID: parentID,
            documentID: parentContext.documentID,
        });
        return {
            task: applyPlacementToTaskDTO(await taskDTO(before), placement),
            placement,
            listID,
            atomic: true,
            authoritative: true,
        };
    }

    async function verifyBatchChildMove(listID, taskIDs) {
        const children = await api('/api/block/getChildBlocks', { id: listID });
        const childIDs = (Array.isArray(children) ? children : [])
            .map((item) => text(item && (item.id || item.ID)))
            .filter(Boolean);
        const selected = new Set(taskIDs);
        const actualOrder = childIDs.filter((id) => selected.has(id));
        if (actualOrder.length !== taskIDs.length || actualOrder.some((id, index) => id !== taskIDs[index])) {
            throw new DomainError(ERROR.CONFLICT, '批量移动后的位置校验失败', {
                listID,
                expectedTaskIDs: taskIDs,
                actualTaskIDs: actualOrder,
            });
        }
        return childIDs;
    }

    async function batchMoveTasksIntoParent(taskIDs, parentTaskID, requestedListID, childPosition) {
        const ids = uniqueStrings(taskIDs).map((id) => requireID(id, '任务 ID'));
        const parentID = requireID(parentTaskID, '父任务 ID');
        const position = text(childPosition).toLowerCase() === 'top' ? 'top' : 'bottom';
        if (ids.length < 2) throw new DomainError(ERROR.INVALID_ARGUMENT, '批量移动至少需要两个任务');
        if (ids.includes(parentID)) throw new DomainError(ERROR.INVALID_ARGUMENT, '任务不能移动到自身内部');

        const [rows, parentContext, registry] = await Promise.all([
            Promise.all(ids.map((id) => getTaskRow(id))),
            readTaskTreeContext(parentID),
            getFieldRegistry(),
        ]);
        const previousPlacements = await Promise.all(ids.map((id, index) => capturePlacement(id, rows[index])));
        if (ids.some((id) => parentContext.ancestorTaskIDs.includes(id))) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '父任务不能移动到自己的子任务中');
        }

        const attrOperations = (await Promise.all(rows.map((row) => buildTaskAttrPreservationOperation(row, registry)))).filter(Boolean);
        const requestedID = text(requestedListID);
        const targetLists = await inspectTaskListsUnder(parentID, requestedID);
        let listID = text(targetLists.taskList?.list?.id);
        if (!listID && requestedID) {
            requireID(requestedID, '预生成子列表 ID');
            const duplicateList = await tryReadBlockTreePath(requestedID, '预生成子列表');
            if (duplicateList) {
                throw new DomainError(ERROR.CONFLICT, '预生成子列表 ID 已被其他块占用');
            }
        }
        let transactionCount = 0;

        if (listID) {
            const siblingIDs = targetLists.taskList.children
                .filter(isTreeTaskBlock)
                .map((item) => item.id)
                .filter((id) => !ids.includes(id));
            const anchorID = position === 'bottom' ? text(siblingIDs[siblingIDs.length - 1]) : '';
            const moveOperations = ids.slice().reverse().map((id) => (
                anchorID
                    ? { action: 'move', id, previousID: anchorID }
                    : { action: 'move', id, parentID: listID }
            ));
            await pushTaskTransaction([...attrOperations, ...moveOperations]);
            transactionCount = 1;
        } else {
            listID = requireID(requestedID, '预生成子列表 ID');
            const seedID = position === 'top' ? ids[ids.length - 1] : ids[0];
            const seedAttr = attrOperations.find((operation) => text(operation.id) === seedID);
            const taskDOM = await readBlockDOM(seedID);
            const targetLastChildID = text(targetLists.ownerChildren
                .filter((item) => !ids.includes(item.id))
                .slice(-1)[0]?.id);
            const insertOperation = {
                action: 'insert',
                id: listID,
                parentID,
                data: nestedTaskListDOM(listID, taskDOM),
            };
            if (targetLastChildID) insertOperation.previousID = targetLastChildID;
            const remainingIDs = ids.filter((id) => id !== seedID);
            const remainingAttrs = attrOperations.filter((operation) => text(operation.id) !== seedID);
            const moveOperations = remainingIDs.slice().reverse().map((id) => (
                position === 'bottom'
                    ? { action: 'move', id, previousID: seedID }
                    : { action: 'move', id, parentID: listID }
            ));
            await pushTaskTransaction([
                { action: 'delete', id: seedID },
                insertOperation,
                ...(seedAttr ? [seedAttr] : []),
                ...remainingAttrs,
                ...moveOperations,
            ]);
            transactionCount = 1;
        }

        const childIDs = await verifyBatchChildMove(listID, ids);
        const firstTaskID = text(childIDs[0]);
        const results = await Promise.all(rows.map(async (row, rowIndex) => {
            const id = text(row.id);
            const index = childIDs.indexOf(id);
            const placement = {
                taskID: id,
                parentListID: listID,
                parentTaskID: parentID,
                parentType: 'l',
                previousSiblingID: index > 0 ? text(childIDs[index - 1]) : '',
                nextSiblingID: index >= 0 && index + 1 < childIDs.length ? text(childIDs[index + 1]) : '',
                firstTaskID,
                documentID: parentContext.documentID,
            };
            return {
                task: applyPlacementToTaskDTO(await taskDTO(row, undefined, registry), placement),
                placement,
                previousPlacement: previousPlacements[rowIndex],
                authoritative: true,
            };
        }));
        return {
            results,
            taskIDs: ids,
            listID,
            parentTaskID: parentID,
            transactionCount,
            authoritative: true,
            refresh: taskMutationRefresh('move', ids, [
                ...previousPlacements.map((placement) => text(placement.documentID)),
                parentContext.documentID,
            ]),
        };
    }

    async function batchMoveTasks(input) {
        const source = input && typeof input === 'object' ? input : {};
        const taskIDs = uniqueStrings([
            ...(Array.isArray(source.taskIDs) ? source.taskIDs : []),
            ...(Array.isArray(source.taskIds) ? source.taskIds : []),
        ]);
        const parentTaskID = requireID(source.parentTaskID || source.parentTaskId || source.targetTaskID || source.targetTaskId, '父任务 ID');
        const position = text(source.childPosition || source.position).toLowerCase() === 'top'
            || text(source.mode).toLowerCase() === 'child-top'
            ? 'top'
            : 'bottom';
        return runTaskLanes([...taskIDs, parentTaskID], () => batchMoveTasksIntoParent(
            taskIDs,
            parentTaskID,
            source.requestedListID || source.requestedListId,
            position,
        ));
    }

    async function moveTask(input, options) {
        const source = input && typeof input === 'object' ? input : {};
        const taskID = requireID(source.taskID || source.taskId, '任务 ID');
        const laneID = text(source.laneID || source.laneId) || taskID;
        const targetLaneIDs = uniqueStrings([
            laneID,
            source.parentTaskID,
            source.parentTaskId,
            source.targetTaskID,
            source.targetTaskId,
            source.previousID,
            source.previousId,
            source.nextID,
            source.nextId,
            source.parentID,
            source.parentId,
            source.targetListID,
            source.targetListId,
            source.targetDocumentID,
            source.targetDocumentId,
            source.documentID,
            source.documentId,
            source.headingID,
            source.headingId,
        ]);
        return runTaskLanes(targetLaneIDs, async () => {
            if (normalizeTaskMoveMode(source.mode) === 'document-list') {
                const command = await resolveTaskMoveCommand(taskID, source);
                const moved = await moveIndependentTaskListToDocument(
                    taskID,
                    command.documentID,
                    command.sourceListID,
                    command.sourceDocumentID,
                    command.moveInput,
                );
                const previousPlacement = {
                    parentID: text(moved.sourceListID || command.sourceListID),
                    documentID: text(command.sourceDocumentID),
                    previousID: text(moved.sourcePreviousID),
                    nextID: text(moved.sourceNextID),
                };
                await reconcileMovedTaskAttrHosts(taskID, previousPlacement, moved);
                return {
                    ...moved,
                    changed: moved.changed !== false,
                    previousPlacement,
                    undoID: '',
                    refresh: taskMutationRefresh('move', [taskID], [command.sourceDocumentID, command.documentID]),
                };
            }
            let preparedTaskRow = await getTaskRow(taskID);
            preparedTaskRow = await ensureTaskListContainer(preparedTaskRow);
            const useAuthoritativePlacement = source.authoritative === true
                || preparedTaskRow.__taskHorizonStructureRepaired === true;
            const before = await capturePlacement(taskID, preparedTaskRow);
            const beforeTask = useAuthoritativePlacement ? preparedTaskRow : null;
            if (beforeTask) await preserveTaskAttrsOnOwnBlockBeforeMove(beforeTask);
            const command = await resolveTaskMoveCommand(taskID, source);
            const parentTaskID = text(command.parentTaskID);
            let moved;
            if (command.mode === 'heading') {
                moved = await moveTaskIntoHeading(
                    taskID,
                    command.headingID,
                    command.requestedListID,
                    preparedTaskRow,
                );
            } else if (command.mode === 'recycle-document') {
                moved = await moveTaskIntoIndependentDocument(taskID, command.documentID, 'top', preparedTaskRow);
            } else if (command.independentDocument === true) {
                moved = await moveTaskIntoIndependentDocument(
                    taskID,
                    command.documentID,
                    command.independentPosition,
                    preparedTaskRow,
                );
            } else if (parentTaskID) {
                moved = await moveTaskIntoParent(
                    taskID,
                    parentTaskID,
                    command.requestedListID,
                    command.childPosition,
                    preparedTaskRow,
                );
            } else {
                const movePlan = await buildMovePlan(taskID, command.moveInput, before);
                await api('/api/block/moveBlock', movePlan.payload);
                const placement = await confirmMovePlanPlacement(taskID, movePlan);
                moved = {
                    task: applyPlacementToTaskDTO(await taskDTO(beforeTask || preparedTaskRow), placement),
                    placement,
                    authoritative: true,
                };
            }
            await reconcileMovedTaskAttrHosts(taskID, before, moved);
            const confirmedPlacement = moved?.placement || await readTaskPlacementFromTree(taskID);
            moved.placement = confirmedPlacement;
            moved.task = applyPlacementToTaskDTO(await taskDTO(taskID), confirmedPlacement);
            const task = moved.task;
            const expectedPlacement = confirmedPlacement;
            const placementChanged = stableJson(comparablePlacement(before)) !== stableJson(comparablePlacement(confirmedPlacement));
            let undoID = '';
            if (source.recordUndo !== false && (!options || options.recordUndo !== false) && moved.atomic !== true) {
                state.lastUndo = {
                    id: token('undo'),
                    createdAt: Date.now(),
                    label: `移动任务：${task.title}`,
                    verify: async () => stableJson(comparablePlacement(await capturePlacement(taskID, expectedPlacement))) === stableJson(comparablePlacement(expectedPlacement)),
                    execute: async () => {
                        const restorePlan = await buildMovePlan(taskID, before, expectedPlacement);
                        await api('/api/block/moveBlock', restorePlan.payload);
                        const restoredPlacement = await confirmMovePlanPlacement(taskID, restorePlan);
                        const restoredTask = applyPlacementToTaskDTO(await taskDTO(taskID), restoredPlacement);
                        return {
                            task: restoredTask,
                            refresh: taskMutationRefresh('move', [taskID], [task.documentID, restoredTask.documentID]),
                        };
                    },
                };
                rememberUndo(state.lastUndo);
                undoID = state.lastUndo.id;
            }
            return {
                ...moved,
                changed: moved.changed !== false && placementChanged,
                ...(placementChanged ? {} : { reason: moved.reason || 'already-there' }),
                task,
                previousPlacement: before,
                undoID,
                refresh: taskMutationRefresh('move', [taskID], [before.documentID, task.documentID]),
            };
        });
    }

    function isScheduleLinkedToTaskOrVirtualSource(item, taskID) {
        const id = text(taskID);
        if (!id) return false;
        const linkedTaskID = text(item && (item.taskId || item.task_id || item.linkedTaskId));
        const virtualMatch = linkedTaskID.match(VIRTUAL_TASK_ID_RE);
        const sourceTaskID = text(item && (item.sourceTaskId || item.sourceTaskID)) || text(virtualMatch && virtualMatch[1]);
        return linkedTaskID === id || sourceTaskID === id;
    }

    async function collectTaskSubtreeIDs(taskID) {
        const id = requireID(taskID, '任务 ID');
        const rows = await sql(`
            WITH RECURSIVE task_tree(id, depth) AS (
                SELECT id, 0 FROM blocks WHERE id = '${escapeSql(id)}'
                UNION ALL
                SELECT b.id, task_tree.depth + 1
                FROM blocks b JOIN task_tree ON b.parent_id = task_tree.id
                WHERE task_tree.depth < 128
            )
            SELECT b.id FROM blocks b JOIN task_tree ON task_tree.id = b.id
            WHERE b.type = 'i' AND b.subtype = 't'
            ORDER BY task_tree.depth ASC, b.sort ASC, b.created ASC, b.id ASC
        `);
        return uniqueStrings([id, ...rows.map((item) => item && item.id)]);
    }

    async function deleteTaskNow(taskID) {
        const id = requireID(taskID, '任务 ID');
        const row = await getTaskRow(id);
        const cleanupWarnings = [];
        let deletedTaskIDs = [id];
        try {
            deletedTaskIDs = await collectTaskSubtreeIDs(id);
        } catch (error) {
            cleanupWarnings.push({
                step: 'collect-task-subtree',
                message: text(error && error.message) || '无法收集任务子树',
            });
        }
        await api('/api/block/deleteBlock', { id });
        try {
            await runScheduleLane(async () => {
                const schedules = await loadSchedules({ allowMissing: true });
                const next = schedules.filter((item) => (
                    !deletedTaskIDs.some((deletedID) => isScheduleLinkedToTaskOrVirtualSource(item, deletedID))
                ));
                if (next.length !== schedules.length) await saveSchedules(next);
            });
        } catch (error) {
            cleanupWarnings.push({
                step: 'delete-task-schedules',
                message: text(error && error.message) || '清除任务日程失败',
            });
        }
        return {
            deletedTaskID: id,
            deletedTaskIDs,
            cleanupWarnings,
            refresh: taskMutationRefresh('delete', deletedTaskIDs, [row.root_id]),
        };
    }

    function pruneTokens(map) {
        const now = Date.now();
        for (const [key, item] of map.entries()) {
            if (!item || Number(item.expiresAt) <= now) map.delete(key);
        }
    }

    function normalizeRegisteredScopeIDs(values, label) {
        if (!Array.isArray(values)) throw new DomainError(ERROR.INVALID_ARGUMENT, `${label}必须是数组`);
        const ids = uniqueStrings(values);
        const invalid = ids.find((id) => !ID_RE.test(id));
        if (invalid) throw new DomainError(ERROR.INVALID_ARGUMENT, `${label}包含无效 ID`, { id: invalid });
        return ids;
    }

    function cloneScopeValue(value, fallback) {
        try {
            const cloned = JSON.parse(JSON.stringify(value));
            return cloned === undefined ? fallback : cloned;
        } catch (error) {
            return fallback;
        }
    }

    function normalizeRegisteredVirtualTasks(values) {
        if (values == null) return [];
        if (!Array.isArray(values)) throw new DomainError(ERROR.INVALID_ARGUMENT, '循环虚拟任务范围必须是数组');
        const seen = new Set();
        return values.map((item) => {
            const source = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
            const id = text(source.id);
            const match = id.match(VIRTUAL_TASK_ID_RE);
            if (!match) throw new DomainError(ERROR.INVALID_ARGUMENT, '循环虚拟任务包含无效 ID', { id });
            if (seen.has(id)) return null;
            seen.add(id);
            const sourceTaskID = text(source.sourceTaskID || source.sourceTaskId || match[1]);
            if (sourceTaskID !== match[1]) throw new DomainError(ERROR.INVALID_ARGUMENT, '循环虚拟任务来源不匹配', { id, sourceTaskID });
            const documentID = text(source.documentID || source.documentId);
            if (documentID && !ID_RE.test(documentID)) throw new DomainError(ERROR.INVALID_ARGUMENT, '循环虚拟任务文档 ID 无效', { id, documentID });
            const dto = {
                id,
                virtualTask: true,
                virtualType: 'recurring-history',
                readOnly: true,
                sourceTaskID,
                title: text(source.title) || '(无内容)',
                markdown: String(source.markdown || ''),
                done: true,
                parentListID: '',
                parentTaskID: '',
                documentID,
                documentName: text(source.documentName),
                documentPath: text(source.documentPath),
                created: text(source.created),
                updated: text(source.updated),
                attrHostID: '',
                attrHostState: 'virtual-read-only',
                priority: text(source.priority),
                priorityScore: Number.isFinite(Number(source.priorityScore)) ? Number(source.priorityScore) : null,
                customStatus: text(source.customStatus),
                startDate: text(source.startDate),
                completionTime: text(source.completionTime),
                taskCompleteAt: text(source.taskCompleteAt),
                duration: text(source.duration),
                remark: text(source.remark),
                taskDateColor: text(source.taskDateColor),
                customTime: text(source.customTime),
                milestone: source.milestone === true,
                pinned: source.pinned === true,
                allDayBottom: source.allDayBottom === true,
                tomatoEstimateCount: Number.isFinite(Number(source.tomatoEstimateCount)) ? Number(source.tomatoEstimateCount) : null,
                tomatoCount: Number.isFinite(Number(source.tomatoCount)) ? Number(source.tomatoCount) : null,
                tomatoMinutes: Number.isFinite(Number(source.tomatoMinutes)) ? Number(source.tomatoMinutes) : null,
                tomatoHours: Number.isFinite(Number(source.tomatoHours)) ? Number(source.tomatoHours) : null,
                attachments: Array.isArray(source.attachments) ? cloneScopeValue(source.attachments, []) : [],
                attachmentCount: Math.max(0, Number(source.attachmentCount) || (Array.isArray(source.attachments) ? source.attachments.length : 0)),
                reminder: cloneScopeValue(source.reminder, null),
                hasReminder: source.hasReminder === true || source.reminder != null,
                repeatRule: cloneScopeValue(source.repeatRule, null),
                repeatState: cloneScopeValue(source.repeatState, null),
                customFieldValues: source.customFieldValues && typeof source.customFieldValues === 'object' && !Array.isArray(source.customFieldValues)
                    ? cloneScopeValue(source.customFieldValues, {})
                    : {},
            };
            return dto;
        }).filter(Boolean);
    }

    function pruneTaskScopes() {
        pruneTokens(state.taskScopes);
        while (state.taskScopes.size >= TASK_SCOPE_MAX_ENTRIES) {
            const oldest = state.taskScopes.keys().next().value;
            if (!oldest) break;
            state.taskScopes.delete(oldest);
        }
    }

    function registerTaskScope(input) {
        const source = input && typeof input === 'object' ? input : {};
        const taskIDs = normalizeRegisteredScopeIDs(source.taskIDs, '任务范围');
        const documentIDs = normalizeRegisteredScopeIDs(source.documentIDs || [], '文档范围');
        const scopeMode = text(source.scopeMode) === 'documents' ? 'documents' : 'tasks';
        if (scopeMode === 'documents' && !documentIDs.length) throw new DomainError(ERROR.INVALID_ARGUMENT, '文档任务范围缺少文档 ID');
        const virtualTasks = normalizeRegisteredVirtualTasks(source.virtualTasks);
        const virtualTaskMap = new Map(virtualTasks.map((item) => [item.id, item]));
        const taskIDSet = new Set(taskIDs);
        const documentIDSet = new Set(documentIDs);
        const documentTaskIDs = new Set();
        const taskValues = new Map();
        (Array.isArray(source.taskValues) ? source.taskValues : []).forEach((item) => {
            const id = text(item && item.id);
            const inDocumentScope = scopeMode === 'documents' && documentIDSet.has(text(item && item.documentID));
            if (!taskIDSet.has(id) && !inDocumentScope) return;
            if (inDocumentScope) documentTaskIDs.add(id);
            const values = {};
            ['priorityScore', 'tomatoMinutes', 'tomatoHours', 'tomatoCount'].forEach((field) => {
                const raw = item && item[field];
                if (raw == null || String(raw).trim() === '') return;
                const value = Number(raw);
                if (Number.isFinite(value)) values[field] = value;
            });
            if (Object.keys(values).length) taskValues.set(id, values);
        });
        const realTaskCount = scopeMode === 'documents'
            ? new Set(taskIDs.concat(Array.from(documentTaskIDs))).size
            : taskIDs.length;
        pruneTaskScopes();
        const scopeToken = token('task_scope');
        const expiresAt = Date.now() + TASK_SCOPE_TOKEN_TTL;
        state.taskScopes.set(scopeToken, {
            scopeToken,
            scopeID: text(source.scopeID),
            scopeMode,
            taskIDs,
            documentIDs,
            realTaskCount,
            taskValues,
            virtualTasks,
            virtualTaskMap,
            createdAt: Date.now(),
            expiresAt,
        });
        return {
            scopeToken,
            scopeID: text(source.scopeID),
            scopeMode,
            taskCount: realTaskCount + virtualTasks.length,
            realTaskCount,
            virtualTaskCount: virtualTasks.length,
            documentCount: documentIDs.length,
            expiresAt: new Date(expiresAt).toISOString(),
        };
    }

    function registerDocumentGroupSnapshot(input) {
        const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const groups = Array.isArray(source.groups) ? source.groups : [];
        const tabGroups = Array.isArray(source.tabGroups) ? source.tabGroups : [];
        const membersByGroup = new Map();
        const namesByGroup = new Map();
        groups.forEach((group) => {
            const groupID = text(group && group.id);
            if (!groupID || membersByGroup.has(groupID)) return;
            const documentIDs = uniqueStrings(group && (group.documentIDs || group.documentIds))
                .filter((id) => ID_RE.test(id));
            membersByGroup.set(groupID, new Set(documentIDs));
            namesByGroup.set(groupID, text(group && group.name));
        });
        const membersByTabGroup = new Map();
        const namesByTabGroup = new Map();
        tabGroups.forEach((group) => {
            const groupID = text(group && group.id);
            if (!groupID || membersByTabGroup.has(groupID)) return;
            const documentIDs = uniqueStrings(group && (group.documentIDs || group.documentIds))
                .filter((id) => ID_RE.test(id));
            membersByTabGroup.set(groupID, new Set(documentIDs));
            namesByTabGroup.set(groupID, text(group && group.name));
        });
        state.documentGroupSnapshot = {
            registeredAt: Date.now(),
            membersByGroup,
            namesByGroup,
            membersByTabGroup,
            namesByTabGroup,
        };
        return {
            groupCount: membersByGroup.size,
            tabGroupCount: membersByTabGroup.size,
            documentCount: new Set([
                ...Array.from(membersByGroup.values()).flatMap((ids) => Array.from(ids)),
                ...Array.from(membersByTabGroup.values()).flatMap((ids) => Array.from(ids)),
            ]).size,
        };
    }

    function resolveTaskScopeToken(value) {
        const scopeToken = text(value);
        if (!scopeToken) return null;
        pruneTokens(state.taskScopes);
        const item = state.taskScopes.get(scopeToken);
        if (!item) throw new DomainError(ERROR.NOT_FOUND, '任务范围已过期或不存在，请重新读取当前视图范围');
        item.expiresAt = Date.now() + TASK_SCOPE_TOKEN_TTL;
        state.taskScopes.delete(scopeToken);
        state.taskScopes.set(scopeToken, item);
        return item;
    }

    async function previewTaskDelete(taskID) {
        pruneTokens(state.deleteTokens);
        const task = await taskDTO(requireID(taskID, '任务 ID'));
        const deletedTaskIDs = await collectTaskSubtreeIDs(task.id);
        const schedules = await loadSchedules();
        const linkedSchedules = schedules.filter((item) => (
            deletedTaskIDs.some((deletedID) => isScheduleLinkedToTaskOrVirtualSource(item, deletedID))
        ));
        const previewToken = token('delete_task');
        state.deleteTokens.set(previewToken, {
            kind: 'task',
            taskID: task.id,
            fingerprint: `${task.updated}:${task.id}`,
            expiresAt: Date.now() + DELETE_TOKEN_TTL,
        });
        return {
            previewToken,
            expiresAt: new Date(Date.now() + DELETE_TOKEN_TTL).toISOString(),
            task: { id: task.id, title: task.title, documentName: task.documentName },
            deletedTaskIDs,
            linkedScheduleCount: linkedSchedules.length,
        };
    }

    async function executeTaskDelete(taskID, previewToken) {
        pruneTokens(state.deleteTokens);
        const id = requireID(taskID, '任务 ID');
        const item = state.deleteTokens.get(text(previewToken));
        if (!item || item.kind !== 'task' || item.taskID !== id) {
            throw new DomainError(ERROR.CONFIRMATION_REQUIRED, '请先预览删除并使用有效确认令牌');
        }
        const row = await getTaskRow(id);
        if (item.fingerprint !== `${text(row.updated)}:${id}`) {
            state.deleteTokens.delete(text(previewToken));
            throw new DomainError(ERROR.CONFLICT, '任务在预览后已发生变化，请重新预览');
        }
        state.deleteTokens.delete(text(previewToken));
        return deleteTaskNow(id);
    }

    function normalizeTaskQueryDateRange(value) {
        if (value == null) return null;
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, 'dateRange 格式无效');
        }
        const field = text(value.field);
        if (!['taskSpan', 'startDate', 'completionTime', 'taskCompleteAt'].includes(field)) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, 'dateRange.field 不受支持');
        }
        const normalizeDay = (input, label) => {
            const day = text(input);
            if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
                throw new DomainError(ERROR.INVALID_ARGUMENT, `${label} 必须为 YYYY-MM-DD`);
            }
            return day;
        };
        const from = normalizeDay(value.from, 'dateRange.from');
        const to = normalizeDay(value.to, 'dateRange.to');
        if (!from && !to) throw new DomainError(ERROR.INVALID_ARGUMENT, 'dateRange 至少需要 from 或 to');
        if (from && to && from > to) throw new DomainError(ERROR.INVALID_ARGUMENT, 'dateRange.from 不能晚于 to');
        const mode = text(value.mode) || 'overlap';
        if (!['overlap', 'within'].includes(mode)) throw new DomainError(ERROR.INVALID_ARGUMENT, 'dateRange.mode 不受支持');
        return { field, from, to, mode };
    }

    function normalizeTaskQueryFilters(input) {
        const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        const normalizeSet = (value, label) => {
            if (value == null) return [];
            if (!Array.isArray(value)) throw new DomainError(ERROR.INVALID_ARGUMENT, `${label} 必须为数组`);
            const items = uniqueStrings(value);
            if (items.length > 50) throw new DomainError(ERROR.INVALID_ARGUMENT, `${label} 最多 50 项`);
            return items;
        };
        return {
            ...source,
            keyword: text(source.keyword).slice(0, 200),
            priorities: normalizeSet(source.priorities, 'priorities'),
            customStatuses: normalizeSet(source.customStatuses, 'customStatuses'),
            dateRange: normalizeTaskQueryDateRange(source.dateRange),
        };
    }

    function taskDoneExpression(alias) {
        const table = text(alias) || 'task';
        return `(${table}.markdown LIKE '%[x]%' OR ${table}.markdown LIKE '%[X]%')`;
    }

    function taskFieldAttrExpression(registry, fieldID, alias) {
        const field = registry && registry.byId && registry.byId.get(fieldID);
        if (!field) throw new DomainError(ERROR.UNSUPPORTED, `任务字段不可用: ${fieldID}`);
        return completionAttrExpression([field.attr].concat(field.aliases || []), alias);
    }

    function appendTaskDateRangeConditions(conditions, range, registry, alias) {
        if (!range) return;
        const startExpr = taskFieldAttrExpression(registry, 'startDate', alias);
        const dueExpr = taskFieldAttrExpression(registry, 'completionTime', alias);
        if (range.field === 'taskSpan') {
            const hasDate = `(${startExpr} != '' OR ${dueExpr} != '')`;
            const effectiveStart = `(CASE WHEN ${startExpr} != '' THEN substr(${startExpr}, 1, 10) ELSE substr(${dueExpr}, 1, 10) END)`;
            const effectiveEnd = `(CASE WHEN ${dueExpr} != '' THEN substr(${dueExpr}, 1, 10) ELSE substr(${startExpr}, 1, 10) END)`;
            conditions.push(hasDate);
            if (range.mode === 'within') {
                if (range.from) conditions.push(`${effectiveStart} >= '${escapeSql(range.from)}'`);
                if (range.to) conditions.push(`${effectiveEnd} <= '${escapeSql(range.to)}'`);
            } else {
                if (range.from) conditions.push(`${effectiveEnd} >= '${escapeSql(range.from)}'`);
                if (range.to) conditions.push(`${effectiveStart} <= '${escapeSql(range.to)}'`);
            }
            return;
        }
        const fieldExpr = taskFieldAttrExpression(registry, range.field, alias);
        const dayExpr = `substr(${fieldExpr}, 1, 10)`;
        conditions.push(`${fieldExpr} != ''`);
        if (range.from) conditions.push(`${dayExpr} >= '${escapeSql(range.from)}'`);
        if (range.to) conditions.push(`${dayExpr} <= '${escapeSql(range.to)}'`);
    }

    function buildTaskWhere(filters, cursor, normalizedScope, registry) {
        const source = filters && typeof filters === 'object' ? filters : {};
        const conditions = ["task.type = 'i'", "task.subtype = 't'"];
        const scope = normalizedScope || normalizeTaskScope(source);
        appendTaskScopeConditions(conditions, scope, 'task');
        if (scope.tokenBacked && Array.isArray(source.ids) && source.ids.length) {
            const explicitRealIDs = uniqueStrings(source.ids).filter((id) => ID_RE.test(id));
            conditions.push(explicitRealIDs.length
                ? `task.id IN (${explicitRealIDs.map((id) => `'${escapeSql(id)}'`).join(',')})`
                : '1 = 0');
        }
        if (scope.tokenBacked && Array.isArray(source.documentIDs) && source.documentIDs.length) {
            const explicitDocumentIDs = uniqueStrings(source.documentIDs).filter((id) => ID_RE.test(id));
            conditions.push(explicitDocumentIDs.length
                ? `task.root_id IN (${explicitDocumentIDs.map((id) => `'${escapeSql(id)}'`).join(',')})`
                : '1 = 0');
        }
        if (text(source.keyword)) {
            const keyword = escapeSql(text(source.keyword));
            conditions.push(`(instr(task.content, '${keyword}') > 0 OR instr(task.markdown, '${keyword}') > 0)`);
        }
        const doneExpr = taskDoneExpression('task');
        if (source.done === true) conditions.push(doneExpr);
        if (source.done === false) conditions.push(`NOT ${doneExpr}`);
        if (source.priorities.length) {
            const priorityExpr = taskFieldAttrExpression(registry, 'priority', 'task');
            conditions.push(`${priorityExpr} IN (${source.priorities.map((value) => `'${escapeSql(value)}'`).join(',')})`);
        }
        if (source.customStatuses.length) {
            const statusExpr = taskFieldAttrExpression(registry, 'customStatus', 'task');
            conditions.push(`${statusExpr} IN (${source.customStatuses.map((value) => `'${escapeSql(value)}'`).join(',')})`);
        }
        appendTaskDateRangeConditions(conditions, source.dateRange, registry, 'task');
        if (source.overdue === true || source.overdue === false) {
            const dueExpr = taskFieldAttrExpression(registry, 'completionTime', 'task');
            const today = (() => {
                const now = new Date();
                return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            })();
            const overdueExpr = `(NOT ${doneExpr} AND ${dueExpr} != '' AND substr(${dueExpr}, 1, 10) < '${today}')`;
            conditions.push(source.overdue ? overdueExpr : `NOT ${overdueExpr}`);
        }
        const cursorMatch = text(cursor).match(/^(\d{14}):([0-9]{14}-[A-Za-z0-9]+)$/);
        if (cursorMatch) {
            conditions.push(`(task.updated < '${cursorMatch[1]}' OR (task.updated = '${cursorMatch[1]}' AND task.id < '${escapeSql(cursorMatch[2])}'))`);
        }
        return conditions.join(' AND ');
    }

    function filterVirtualTaskRows(scope, filters) {
        const source = filters && typeof filters === 'object' ? filters : {};
        if (source.includeVirtual === false) return [];
        const idSet = Array.isArray(source.ids) && source.ids.length ? new Set(uniqueStrings(source.ids)) : null;
        const documentSet = Array.isArray(source.documentIDs) && source.documentIDs.length ? new Set(uniqueStrings(source.documentIDs)) : null;
        const prioritySet = source.priorities.length ? new Set(source.priorities) : null;
        const statusSet = source.customStatuses.length ? new Set(source.customStatuses) : null;
        const keyword = text(source.keyword).toLocaleLowerCase();
        return (Array.isArray(scope && scope.virtualTasks) ? scope.virtualTasks : []).filter((item) => {
            if (idSet && !idSet.has(item.id)) return false;
            if (documentSet && !documentSet.has(item.documentID)) return false;
            if (source.done === false) return false;
            if (source.overdue === true) return false;
            if (prioritySet && !prioritySet.has(text(item.priority))) return false;
            if (statusSet && !statusSet.has(text(item.customStatus))) return false;
            if (source.dateRange) {
                const range = source.dateRange;
                const start = text(item.startDate).slice(0, 10);
                const due = text(item.completionTime).slice(0, 10);
                if (range.field === 'taskSpan') {
                    if (!start && !due) return false;
                    const effectiveStart = start || due;
                    const effectiveEnd = due || start;
                    if (range.mode === 'within') {
                        if (range.from && effectiveStart < range.from) return false;
                        if (range.to && effectiveEnd > range.to) return false;
                    } else {
                        if (range.from && effectiveEnd < range.from) return false;
                        if (range.to && effectiveStart > range.to) return false;
                    }
                } else {
                    const value = text(item[range.field]).slice(0, 10);
                    if (!value || (range.from && value < range.from) || (range.to && value > range.to)) return false;
                }
            }
            if (keyword) {
                const haystack = [item.title, item.markdown, item.remark, item.documentName, item.priority, item.customStatus]
                    .map((value) => text(value).toLocaleLowerCase())
                    .join('\n');
                if (!haystack.includes(keyword)) return false;
            }
            return true;
        });
    }

    async function queryTaskRows(input) {
        const source = input && typeof input === 'object' ? input : {};
        const limit = clampInt(source.limit, 1, 200, 50);
        const registry = await getFieldRegistry();
        const filters = normalizeTaskQueryFilters(source.filters);
        const scope = normalizeTaskScope(filters);
        const virtualRows = filterVirtualTaskRows(scope, filters);
        const virtualCursor = text(source.cursor).match(/^virtual:(\d+)$/);
        if (virtualCursor) {
            if (!scope.tokenBacked) throw new DomainError(ERROR.INVALID_ARGUMENT, '循环虚拟任务游标需要有效范围令牌');
            const offset = Math.max(0, Number(virtualCursor[1]) || 0);
            const page = virtualRows.slice(offset, offset + limit);
            const nextOffset = offset + page.length;
            return {
                items: page.map((item) => projectTaskDTO(applyTaskDisplayNames({ ...item }, registry), source.fields, ['virtualTask', 'virtualType', 'readOnly', 'sourceTaskID'])),
                nextCursor: nextOffset < virtualRows.length ? `virtual:${nextOffset}` : '',
                limit,
                customFieldDefinitions: (!Array.isArray(source.fields) || !source.fields.length || source.fields.includes('customFieldValues'))
                    ? customFieldDefinitions(registry)
                    : [],
                statusDefinitions: shouldIncludeTaskFieldMetadata(source.fields, 'customStatus', 'customStatusName') ? statusDefinitions(registry) : [],
                priorityDefinitions: shouldIncludeTaskFieldMetadata(source.fields, 'priority', 'priorityName') ? priorityDefinitions() : [],
            };
        }
        const rows = await sql(`
            SELECT
                task.id, task.markdown, task.content AS raw_content, task.parent_id, task.root_id,
                task.box, task.path AS block_path, task.sort AS block_sort, task.created, task.updated,
                COALESCE(doc.content, '') AS doc_name, COALESCE(doc.hpath, '') AS doc_path,
                COALESCE(parent.type, '') AS parent_type,
                (SELECT COUNT(*) FROM blocks s WHERE s.parent_id = task.parent_id AND s.type = 'i' AND s.subtype = 't') AS parent_task_count,
                (SELECT id FROM blocks s WHERE s.parent_id = task.parent_id AND s.type = 'i' AND s.subtype = 't' ORDER BY s.sort ASC, s.created ASC, s.id ASC LIMIT 1) AS first_task_id
            FROM blocks task
            LEFT JOIN blocks doc ON doc.id = task.root_id
            LEFT JOIN blocks parent ON parent.id = task.parent_id
            WHERE ${buildTaskWhere(filters, source.cursor, scope, registry)}
            ORDER BY task.updated DESC, task.id DESC
            LIMIT ${limit + 1}
        `);
        const page = rows.slice(0, limit);
        const tasks = [];
        for (const row of page) {
            const dto = await taskDTO(row, source.fields, registry);
            tasks.push(applyScopedTaskValues(dto, row.id, source.fields, scope));
        }
        const hasMoreRealRows = rows.length > limit;
        let nextCursor = '';
        if (hasMoreRealRows) {
            const last = page[page.length - 1];
            nextCursor = last ? `${text(last.updated)}:${text(last.id)}` : '';
        } else if (virtualRows.length) {
            const remaining = Math.max(0, limit - tasks.length);
            const virtualPage = virtualRows.slice(0, remaining);
            tasks.push(...virtualPage.map((item) => projectTaskDTO(applyTaskDisplayNames({ ...item }, registry), source.fields, ['virtualTask', 'virtualType', 'readOnly', 'sourceTaskID'])));
            if (virtualPage.length < virtualRows.length) nextCursor = `virtual:${virtualPage.length}`;
        }
        return {
            items: tasks,
            nextCursor,
            limit,
            customFieldDefinitions: (!Array.isArray(source.fields) || !source.fields.length || source.fields.includes('customFieldValues'))
                ? customFieldDefinitions(registry)
                : [],
            statusDefinitions: shouldIncludeTaskFieldMetadata(source.fields, 'customStatus', 'customStatusName') ? statusDefinitions(registry) : [],
            priorityDefinitions: shouldIncludeTaskFieldMetadata(source.fields, 'priority', 'priorityName') ? priorityDefinitions() : [],
        };
    }

    async function searchDocumentRows(input) {
        const source = input && typeof input === 'object' ? input : {};
        const keyword = text(source.keyword).slice(0, 200);
        const limit = clampInt(source.limit, 1, 50, 20);
        const terms = keyword.split(/\s+/).map((item) => text(item)).filter(Boolean).slice(0, 8);
        if (!terms.length) return { items: [], limit };
        const conditions = terms.map((term) => {
            const value = escapeSql(term);
            return `(instr(lower(doc.content), lower('${value}')) > 0 OR instr(lower(doc.hpath), lower('${value}')) > 0)`;
        });
        const exact = escapeSql(keyword);
        const rows = await sql(`
            SELECT doc.id, doc.content AS name, doc.hpath AS path, doc.box, doc.updated
            FROM blocks doc
            WHERE doc.type = 'd' AND ${conditions.join(' AND ')}
            ORDER BY
                CASE
                    WHEN lower(doc.content) = lower('${exact}') THEN 0
                    WHEN instr(lower(doc.content), lower('${exact}')) = 1 THEN 1
                    ELSE 2
                END,
                doc.updated DESC, doc.id DESC
            LIMIT ${limit}
        `);
        return {
            items: rows.map((row) => ({
                id: text(row.id),
                name: text(row.name) || `文档 ${text(row.id).slice(-6)}`,
                path: text(row.path),
                box: text(row.box),
                updated: text(row.updated),
            })),
            limit,
        };
    }

    async function listTaskScopes() {
        const settings = await getSettings();
        const groups = (Array.isArray(settings.docGroups) ? settings.docGroups : []).map((group) => ({
            id: text(group && group.id),
            name: text(group && group.name) || '未命名分组',
            documents: Array.isArray(group && group.docs) ? group.docs.map((item) => ({ id: text(item && (item.id || item.docId)), recursive: !!(item && item.recursive) })).filter((item) => item.id) : [],
        }));
        const documents = await sql("SELECT DISTINCT d.id, d.content AS name, d.hpath AS path FROM blocks t JOIN blocks d ON d.id = t.root_id WHERE t.type = 'i' AND t.subtype = 't' ORDER BY d.hpath COLLATE NOCASE LIMIT 500");
        return { groups, documents: documents.map((row) => ({ id: text(row.id), name: text(row.name), path: text(row.path) })) };
    }

    function normalizeSchedule(input, existing) {
        const source = input && typeof input === 'object' ? input : {};
        const base = existing && typeof existing === 'object' ? existing : {};
        const out = { ...base };
        const copy = (target, aliases) => {
            for (const key of aliases) {
                if (own(source, key)) {
                    out[target] = source[key];
                    return;
                }
            }
        };
        copy('taskId', ['taskId', 'taskID']);
        copy('title', ['title']);
        copy('start', ['start']);
        copy('end', ['end']);
        copy('allDay', ['allDay']);
        copy('calendarId', ['calendarId', 'calendarID']);
        copy('color', ['color']);
        copy('plannedMinutes', ['plannedMinutes', 'durationMinutes']);
        copy('reminderMode', ['reminderMode']);
        copy('reminderEnabled', ['reminderEnabled']);
        copy('reminderOffsetMin', ['reminderOffsetMin']);
        out.taskId = text(out.taskId);
        out.title = text(out.title);
        out.start = text(out.start);
        out.end = text(out.end);
        out.calendarId = text(out.calendarId);
        out.color = text(out.color);
        out.allDay = !!out.allDay;
        if (out.plannedMinutes != null && text(out.plannedMinutes) !== '') {
            const minutes = Number(out.plannedMinutes);
            if (!Number.isFinite(minutes) || minutes < 0) throw new DomainError(ERROR.INVALID_ARGUMENT, '计划时长无效');
            out.plannedMinutes = minutes;
        }
        const explicitReminderMode = own(source, 'reminderMode');
        const reminderMode = text(out.reminderMode) || 'inherit';
        if (explicitReminderMode && !SCHEDULE_REMINDER_MODES.includes(reminderMode)) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '日程提醒模式无效');
        }
        out.reminderMode = reminderMode === 'custom' ? 'custom' : 'inherit';
        if (out.reminderMode === 'custom') {
            if (own(source, 'reminderEnabled') && typeof source.reminderEnabled !== 'boolean') {
                throw new DomainError(ERROR.INVALID_ARGUMENT, '日程提醒开关无效');
            }
            out.reminderEnabled = out.reminderEnabled === true;
            const reminderOffset = Number(out.reminderOffsetMin);
            if (own(source, 'reminderOffsetMin') && !SCHEDULE_REMINDER_OFFSETS.includes(reminderOffset)) {
                throw new DomainError(ERROR.INVALID_ARGUMENT, '日程提醒提前时间无效');
            }
            out.reminderOffsetMin = SCHEDULE_REMINDER_OFFSETS.includes(reminderOffset) ? reminderOffset : 0;
        } else {
            out.reminderEnabled = null;
            out.reminderOffsetMin = null;
        }
        const startMs = Date.parse(out.start);
        const endMs = Date.parse(out.end);
        if (!out.start || !Number.isFinite(startMs)) throw new DomainError(ERROR.INVALID_ARGUMENT, '日程开始时间无效');
        if (!out.end || !Number.isFinite(endMs) || endMs <= startMs) throw new DomainError(ERROR.INVALID_ARGUMENT, '日程结束时间必须晚于开始时间');
        return out;
    }

    function clearVirtualScheduleTaskLinkMetadata(item) {
        if (!item || typeof item !== 'object') return item;
        delete item.virtualTask;
        delete item.virtualType;
        delete item.sourceTaskId;
        delete item.docId;
        delete item.recurringCompletedAt;
        return item;
    }

    async function normalizeScheduleTaskLink(item, scopeToken) {
        const taskID = text(item && item.taskId);
        if (!taskID) return clearVirtualScheduleTaskLinkMetadata(item);
        if (VIRTUAL_TASK_ID_RE.test(taskID)) {
            const scope = normalizeTaskScope({ scopeToken });
            const virtualTask = scope.virtualTaskMap.get(taskID);
            if (!virtualTask) {
                throw new DomainError(ERROR.NOT_FOUND, '循环虚拟任务不在当前任务范围内，请重新读取当前视图范围');
            }
            item.taskId = virtualTask.id;
            item.virtualTask = true;
            item.virtualType = text(virtualTask.virtualType) || 'recurring-history';
            item.sourceTaskId = text(virtualTask.sourceTaskID);
            item.docId = text(virtualTask.documentID);
            item.recurringCompletedAt = text(virtualTask.taskCompleteAt || virtualTask.completionTime);
            if (!text(item.title)) item.title = text(virtualTask.title) || '(无内容)';
            return item;
        }
        const binding = await resolveTaskBinding(taskID);
        item.taskId = binding.taskID;
        return clearVirtualScheduleTaskLinkMetadata(item);
    }

    async function loadSchedules(options) {
        const record = await readJsonState(SCHEDULE_FILE);
        if (record.status === 'missing' && options?.allowMissing !== false) return [];
        if (record.status !== 'valid') throw jsonStorageError(SCHEDULE_FILE, record);
        if (!Array.isArray(record.value)) {
            throw jsonStorageError(SCHEDULE_FILE, {
                status: 'corrupt',
                error: new Error('schedule list is invalid'),
            });
        }
        return record.value.filter((item) => item && typeof item === 'object');
    }

    async function saveSchedules(items) {
        await writeJson(SCHEDULE_FILE, Array.isArray(items) ? items : []);
    }

    async function saveScheduleSnapshot(items, options) {
        const incoming = Array.isArray(items) ? items.filter((item) => item && typeof item === 'object') : [];
        const opts = options && typeof options === 'object' ? options : {};
        const operation = text(opts.op) || 'replace';
        const changedIDs = uniqueStrings([opts.scheduleId].concat(Array.isArray(opts.scheduleIds) ? opts.scheduleIds : []));
        const current = await loadSchedules({ allowMissing: true });
        const incomingByID = new Map(incoming.map((item) => [text(item.id), item]).filter((entry) => entry[0]));
        let next;
        if (operation === 'delete' && changedIDs.length) {
            const removed = new Set(changedIDs);
            next = current.filter((item) => !removed.has(text(item.id)));
        } else if ((operation === 'create' || operation === 'update') && changedIDs.length) {
            const changed = new Set(changedIDs);
            next = current.map((item) => changed.has(text(item.id)) && incomingByID.has(text(item.id)) ? incomingByID.get(text(item.id)) : item);
            changedIDs.forEach((id) => {
                if (incomingByID.has(id) && !next.some((item) => text(item.id) === id)) next.push(incomingByID.get(id));
            });
        } else if (opts.allowSchedulePrune === true) {
            next = incoming;
        } else {
            next = incoming.slice();
            current.forEach((item) => {
                const id = text(item.id);
                if (id && !incomingByID.has(id)) next.push(item);
            });
        }
        await saveSchedules(next);
        return { items: next, count: next.length };
    }

    async function querySchedules(input) {
        const source = input && typeof input === 'object' ? input : {};
        const filters = source.filters && typeof source.filters === 'object' ? source.filters : {};
        const limit = clampInt(source.limit, 1, 500, 100);
        const taskIDs = new Set(uniqueStrings(filters.taskIDs || filters.taskIds));
        const fromMs = text(filters.from) ? Date.parse(filters.from) : NaN;
        const toMs = text(filters.to) ? Date.parse(filters.to) : NaN;
        const list = await loadSchedules();
        const items = list.filter((item) => {
            if (taskIDs.size && !taskIDs.has(text(item.taskId || item.task_id || item.linkedTaskId))) return false;
            const startMs = Date.parse(item.start);
            const endMs = Date.parse(item.end);
            if (Number.isFinite(fromMs) && Number.isFinite(endMs) && endMs < fromMs) return false;
            if (Number.isFinite(toMs) && Number.isFinite(startMs) && startMs > toMs) return false;
            return true;
        }).slice(0, limit);
        return { items, totalMatched: items.length, limit };
    }

    async function createSchedule(input, options) {
        return runScheduleLane(async () => {
            const list = await loadSchedules({ allowMissing: true });
            const item = normalizeSchedule(input);
            await normalizeScheduleTaskLink(item, input && input.scopeToken);
            item.id = text(input && input.id) || token('schedule');
            if (list.some((current) => text(current.id) === item.id)) throw new DomainError(ERROR.CONFLICT, '日程 ID 已存在');
            list.push(item);
            await saveSchedules(list);
            let undoID = '';
            if (!options || options.recordUndo !== false) {
                const expected = stableJson(item);
                state.lastUndo = {
                    id: token('undo'), createdAt: Date.now(), label: `新建日程：${item.title || item.id}`,
                    verify: async () => {
                        const current = (await loadSchedules()).find((entry) => text(entry.id) === item.id);
                        return !!current && stableJson(current) === expected;
                    },
                    execute: () => deleteScheduleNow(item.id),
                };
                rememberUndo(state.lastUndo);
                undoID = state.lastUndo.id;
            }
            return { schedule: item, undoID };
        });
    }

    async function updateSchedule(input, options) {
        return runScheduleLane(async () => {
            const id = text(input && (input.id || input.scheduleID || input.scheduleId));
            if (!id) throw new DomainError(ERROR.INVALID_ARGUMENT, '缺少日程 ID');
            const list = await loadSchedules();
            const index = list.findIndex((item) => text(item.id) === id);
            if (index < 0) throw new DomainError(ERROR.NOT_FOUND, '未找到日程');
            const before = { ...list[index] };
            const patch = input && input.patch && typeof input.patch === 'object' ? input.patch : input;
            const next = normalizeSchedule(patch, before);
            if (own(patch, 'taskId') || own(patch, 'taskID')) {
                await normalizeScheduleTaskLink(next, text(input && input.scopeToken) || text(patch && patch.scopeToken));
            }
            next.id = id;
            list[index] = next;
            await saveSchedules(list);
            let undoID = '';
            if (!options || options.recordUndo !== false) {
                const expected = stableJson(next);
                state.lastUndo = {
                    id: token('undo'), createdAt: Date.now(), label: `更新日程：${next.title || id}`,
                    verify: async () => {
                        const current = (await loadSchedules()).find((entry) => text(entry.id) === id);
                        return !!current && stableJson(current) === expected;
                    },
                    execute: () => restoreScheduleSnapshot(before),
                };
                rememberUndo(state.lastUndo);
                undoID = state.lastUndo.id;
            }
            return { schedule: next, changes: patch, undoID };
        });
    }

    async function restoreScheduleSnapshot(snapshot) {
        return runScheduleLane(async () => {
            const id = text(snapshot && snapshot.id);
            if (!id) throw new DomainError(ERROR.INVALID_ARGUMENT, '缺少日程 ID');
            const list = await loadSchedules();
            const index = list.findIndex((item) => text(item.id) === id);
            if (index < 0) throw new DomainError(ERROR.NOT_FOUND, '未找到日程');
            const restored = { ...snapshot, id };
            list[index] = restored;
            await saveSchedules(list);
            return { schedule: restored, changes: restored };
        });
    }

    async function deleteScheduleNow(scheduleID) {
        return runScheduleLane(async () => {
            const id = text(scheduleID);
            if (!id) throw new DomainError(ERROR.INVALID_ARGUMENT, '缺少日程 ID');
            const list = await loadSchedules();
            const index = list.findIndex((item) => text(item.id) === id);
            if (index < 0) throw new DomainError(ERROR.NOT_FOUND, '未找到日程');
            const removed = list[index];
            list.splice(index, 1);
            await saveSchedules(list);
            return { deletedScheduleID: id, schedule: removed };
        });
    }

    async function previewScheduleDelete(scheduleID) {
        pruneTokens(state.deleteTokens);
        const id = text(scheduleID);
        const list = await loadSchedules();
        const item = list.find((current) => text(current.id) === id);
        if (!item) throw new DomainError(ERROR.NOT_FOUND, '未找到日程');
        const previewToken = token('delete_schedule');
        state.deleteTokens.set(previewToken, { kind: 'schedule', scheduleID: id, fingerprint: stableJson(item), expiresAt: Date.now() + DELETE_TOKEN_TTL });
        return { previewToken, expiresAt: new Date(Date.now() + DELETE_TOKEN_TTL).toISOString(), schedule: item };
    }

    async function executeScheduleDelete(scheduleID, previewToken) {
        pruneTokens(state.deleteTokens);
        const id = text(scheduleID);
        const item = state.deleteTokens.get(text(previewToken));
        if (!item || item.kind !== 'schedule' || item.scheduleID !== id) {
            throw new DomainError(ERROR.CONFIRMATION_REQUIRED, '请先预览删除并使用有效确认令牌');
        }
        const list = await loadSchedules();
        const current = list.find((schedule) => text(schedule.id) === id);
        if (!current) throw new DomainError(ERROR.NOT_FOUND, '未找到日程');
        if (item.fingerprint !== stableJson(current)) {
            state.deleteTokens.delete(text(previewToken));
            throw new DomainError(ERROR.CONFLICT, '日程在预览后已发生变化，请重新预览');
        }
        state.deleteTokens.delete(text(previewToken));
        return deleteScheduleNow(id);
    }

    function mutationReceipt(items) {
        const rows = Array.isArray(items) ? items : [];
        return {
            mutationGroupID: token('mutation'),
            undoID: text(state.lastUndo?.id),
            summary: {
                total: rows.length,
                succeeded: rows.filter((item) => item.ok).length,
                failed: rows.filter((item) => !item.ok && !item.skipped).length,
                skipped: rows.filter((item) => item.skipped).length,
            },
            items: rows,
        };
    }

    function pruneUndoRecords() {
        const cutoff = Date.now() - UNDO_RECORD_TTL;
        for (const [id, undo] of state.undoRecords) {
            if (!undo || Number(undo.createdAt) < cutoff) state.undoRecords.delete(id);
        }
        while (state.undoRecords.size > UNDO_RECORD_MAX_ENTRIES) {
            state.undoRecords.delete(state.undoRecords.keys().next().value);
        }
    }

    function rememberUndo(undo) {
        if (!undo || !text(undo.id) || typeof undo.execute !== 'function') return null;
        if (!Number.isFinite(Number(undo.sequence)) || Number(undo.sequence) <= 0) {
            state.undoSequence += 1;
            undo.sequence = state.undoSequence;
        }
        pruneUndoRecords();
        state.undoRecords.delete(undo.id);
        state.undoRecords.set(undo.id, undo);
        pruneUndoRecords();
        return undo;
    }

    function setGroupedUndo(label, steps) {
        const items = (Array.isArray(steps) ? steps : []).filter((item) => item && typeof item.execute === 'function');
        if (!items.length) {
            state.lastUndo = null;
            return null;
        }
        state.lastUndo = {
            id: token('undo'),
            createdAt: Date.now(),
            label,
            verify: async () => {
                for (const item of items) {
                    if (typeof item.verify === 'function' && !(await item.verify())) return false;
                }
                return true;
            },
            execute: async () => {
                const results = [];
                for (const item of items.slice().reverse()) results.push(await item.execute());
                return { items: results };
            },
        };
        rememberUndo(state.lastUndo);
        return state.lastUndo;
    }

    function groupUndoMutations(input) {
        pruneUndoRecords();
        const source = input && typeof input === 'object' ? input : {};
        const undoIDs = uniqueStrings(source.undoIDs || source.undoIds).slice(0, 50);
        if (!undoIDs.length) throw new DomainError(ERROR.INVALID_ARGUMENT, '缺少需要组合的撤销令牌');
        if (!undoIDs.includes(text(state.lastUndo && state.lastUndo.id))) {
            throw new DomainError(ERROR.CONFLICT, '组合撤销前已有新的写入，请重新执行当前操作');
        }
        const steps = undoIDs.map((id) => state.undoRecords.get(id));
        if (steps.some((undo) => !undo)) {
            throw new DomainError(ERROR.NOT_FOUND, '部分撤销令牌已过期，无法安全组合');
        }
        steps.sort((left, right) => Number(left.sequence) - Number(right.sequence));
        const grouped = setGroupedUndo(text(source.label).slice(0, 120) || '撤销本轮 AI 操作', steps);
        grouped.childUndoIDs = steps.map((undo) => undo.id);
        rememberUndo(grouped);
        return { undoID: grouped.id, label: grouped.label, count: undoIDs.length };
    }

    function operationKind(domain, operation, index) {
        const itemIndex = Math.max(0, Number(index) || 0);
        const label = domain === 'schedules' ? '日程' : '任务';
        const supported = domain === 'schedules'
            ? ['create', 'update', 'delete']
            : ['create', 'update', 'move', 'delete'];
        const fields = ['kind', 'action', 'type'].map((key) => ({
            key,
            value: text(operation && operation[key]).toLowerCase(),
        })).filter((item) => item.value);
        if (!fields.length) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, `第 ${itemIndex + 1} 项${label}操作缺少 kind/action/type`, {
                index: itemIndex,
                domain,
                supported,
            });
        }
        const normalized = fields.map((item) => (
            domain === 'tasks' && item.value === 'patch' ? 'update' : item.value
        ));
        const kinds = Array.from(new Set(normalized));
        if (kinds.length > 1) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, `第 ${itemIndex + 1} 项${label}操作类型冲突`, {
                index: itemIndex,
                domain,
                fields: Object.fromEntries(fields.map((item) => [item.key, item.value])),
            });
        }
        if (!supported.includes(kinds[0])) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, `第 ${itemIndex + 1} 项${label}操作未知: ${fields[0].value}`, {
                index: itemIndex,
                domain,
                operation: fields[0].value,
                supported,
            });
        }
        return kinds[0];
    }

    async function executeTaskOperations(operations) {
        const rows = [];
        const undoSteps = [];
        state.lastUndo = null;
        const items = Array.isArray(operations) ? operations : [];
        for (let index = 0; index < items.length; index += 1) {
            const operation = items[index];
            let kind = '';
            try {
                kind = operationKind('tasks', operation, index);
                state.lastUndo = null;
                let value;
                if (kind === 'create') value = await createTask(operation);
                else if (kind === 'update') value = await applyTaskPatch(operation.taskID || operation.taskId, operation.patch || {});
                else if (kind === 'move') value = await moveTask(operation);
                else if (kind === 'delete') value = await deleteTaskNow(operation.taskID || operation.taskId);
                const task = value && (value.task || value);
                if (kind !== 'delete' && state.lastUndo) undoSteps.push(state.lastUndo);
                rows.push({ kind: `task:${kind}`, targetID: text(task && task.id) || text(operation.taskID || operation.taskId), targetLabel: text(task && task.title), ok: true, changes: value, error: null, reversible: kind !== 'delete' });
            } catch (error) {
                rows.push({ kind: `task:${kind}`, targetID: text(operation && (operation.taskID || operation.taskId)), targetLabel: text(operation && operation.title), ok: false, changes: null, error: failure(error).error, reversible: false });
            }
        }
        setGroupedUndo('撤销本次任务操作', undoSteps);
        return mutationReceipt(rows);
    }

    async function executeScheduleOperations(operations) {
        const rows = [];
        const undoSteps = [];
        state.lastUndo = null;
        const items = Array.isArray(operations) ? operations : [];
        for (let index = 0; index < items.length; index += 1) {
            const operation = items[index];
            let kind = '';
            try {
                kind = operationKind('schedules', operation, index);
                state.lastUndo = null;
                let value;
                if (kind === 'create') value = await createSchedule(operation);
                else if (kind === 'update') value = await updateSchedule(operation);
                else if (kind === 'delete') value = await deleteScheduleNow(operation.scheduleID || operation.scheduleId || operation.id);
                const schedule = value && (value.schedule || value);
                if (kind !== 'delete' && state.lastUndo) undoSteps.push(state.lastUndo);
                rows.push({ kind: `schedule:${kind}`, targetID: text(schedule && schedule.id) || text(operation.id), targetLabel: text(schedule && schedule.title), ok: true, changes: value, error: null, reversible: kind !== 'delete' });
            } catch (error) {
                rows.push({ kind: `schedule:${kind}`, targetID: text(operation && (operation.id || operation.scheduleID || operation.scheduleId)), targetLabel: text(operation && operation.title), ok: false, changes: null, error: failure(error).error, reversible: false });
            }
        }
        setGroupedUndo('撤销本次日程操作', undoSteps);
        return mutationReceipt(rows);
    }

    function operationsHaveDelete(domain, operations) {
        return (Array.isArray(operations) ? operations : []).some((item, index) => operationKind(domain, item, index) === 'delete');
    }

    function requirePhaseAction(args, executeAction) {
        const phase = text(args && args.phase);
        const action = text(args && args.action);
        const expected = phase === 'preview' ? 'get' : executeAction;
        if (phase !== 'preview' && phase !== 'execute') {
            throw new DomainError(ERROR.INVALID_ARGUMENT, 'phase 必须是 preview 或 execute');
        }
        if (action !== expected) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, `${phase} 阶段必须使用 action=${expected}`);
        }
    }

    function requireAction(args, expected) {
        const action = text(args && args.action);
        if (action !== expected) throw new DomainError(ERROR.INVALID_ARGUMENT, `必须使用 action=${expected}`);
    }

    async function guardOperationPreview(kind, operations, phase, previewToken) {
        pruneTokens(state.operationTokens);
        const normalizedOperations = (Array.isArray(operations) ? operations : []).map((operation, index) => {
            const normalized = { ...(operation || {}), kind: operationKind(kind, operation, index) };
            delete normalized.action;
            delete normalized.type;
            return normalized;
        });
        const fingerprint = stableJson(normalizedOperations);
        if (!operationsHaveDelete(kind, operations)) {
            return phase === 'preview'
                ? { previewOnly: true, previewToken: '', operations, requiresToken: false }
                : null;
        }
        if (phase === 'preview') {
            const value = token(`${kind}_plan`);
            state.operationTokens.set(value, { kind, fingerprint, expiresAt: Date.now() + PREVIEW_TOKEN_TTL });
            return { previewOnly: true, previewToken: value, expiresAt: new Date(Date.now() + PREVIEW_TOKEN_TTL).toISOString(), operations };
        }
        const item = state.operationTokens.get(text(previewToken));
        if (!item || item.kind !== kind || item.fingerprint !== fingerprint) {
            throw new DomainError(ERROR.CONFIRMATION_REQUIRED, '包含删除的批处理必须先预览并使用确认令牌');
        }
        state.operationTokens.delete(text(previewToken));
        return null;
    }

    function defaultDurationDefaults() {
        return {
            enabled: true,
            syncToManualDrag: false,
            fallbackMinutes: 25,
            rules: [
                { id: 'meeting', name: '会议', keywords: ['会议', '例会', '周会'], minutes: 30 },
                { id: 'writing', name: '写作', keywords: ['报告', '周报', '复盘', '方案', '文档', '撰写'], minutes: 60 },
                { id: 'communication-admin', name: '沟通杂务', keywords: ['邮件', '回复', '整理', '报销', '归档'], minutes: 15 },
            ],
        };
    }

    function normalizeDurationMatchText(value) {
        const raw = text(value).replace(/\s+/g, ' ').trim();
        try { return raw.normalize('NFKC').toLowerCase(); } catch (error) { return raw.toLowerCase(); }
    }

    function normalizeDurationMinutes(value, fallback, path) {
        const minutes = Number(value);
        if (!Number.isFinite(minutes) || minutes < DURATION_DEFAULT_MINUTES_MIN || minutes > DURATION_DEFAULT_MINUTES_MAX) {
            if (path) throw new DomainError(ERROR.INVALID_ARGUMENT, `${path} 应为 ${DURATION_DEFAULT_MINUTES_MIN}-${DURATION_DEFAULT_MINUTES_MAX} 分钟`);
            return fallback;
        }
        return Math.round(minutes);
    }

    function normalizeDurationDefaults(value, options) {
        const strict = options?.strict === true;
        const defaults = defaultDurationDefaults();
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            if (strict) throw new DomainError(ERROR.INVALID_ARGUMENT, 'durationDefaults 策略格式无效');
            return defaults;
        }
        const source = value;
        const rawRules = Array.isArray(source.rules) ? source.rules : defaults.rules;
        const rules = rawRules.map((item, index) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
                if (strict) throw new DomainError(ERROR.INVALID_ARGUMENT, `durationDefaults.rules.${index} 格式无效`);
                return null;
            }
            const name = text(item.name).slice(0, 40);
            const rawKeywords = Array.isArray(item.keywords) ? item.keywords : [];
            const seen = new Set();
            const keywords = rawKeywords.map((keyword) => text(keyword).slice(0, 80)).filter((keyword) => {
                const normalized = normalizeDurationMatchText(keyword);
                if (!normalized || seen.has(normalized)) return false;
                seen.add(normalized);
                return true;
            });
            if (strict && !name) throw new DomainError(ERROR.INVALID_ARGUMENT, `durationDefaults.rules.${index}.name 不能为空`);
            if (strict && !keywords.length) throw new DomainError(ERROR.INVALID_ARGUMENT, `durationDefaults.rules.${index}.keywords 不能为空`);
            return {
                id: text(item.id).slice(0, 80) || `duration-rule-${index + 1}`,
                name: name || `规则 ${index + 1}`,
                keywords,
                minutes: normalizeDurationMinutes(item.minutes, defaults.fallbackMinutes, strict ? `durationDefaults.rules.${index}.minutes` : ''),
            };
        }).filter(Boolean);
        return {
            enabled: source.enabled !== false,
            syncToManualDrag: source.syncToManualDrag === true,
            fallbackMinutes: normalizeDurationMinutes(source.fallbackMinutes, defaults.fallbackMinutes, strict ? 'durationDefaults.fallbackMinutes' : ''),
            rules,
        };
    }

    function resolveDurationCandidates(candidates, durationDefaults, options) {
        const config = normalizeDurationDefaults(durationDefaults);
        const manualDrag = options?.manualDrag === true;
        const enabled = config.enabled !== false && (!manualDrag || config.syncToManualDrag === true);
        return (Array.isArray(candidates) ? candidates : []).slice(0, 200).map((candidate, index) => {
            const source = candidate && typeof candidate === 'object' ? candidate : {};
            const taskID = text(source.taskID || source.taskId || source.id) || `duration-candidate-${index + 1}`;
            if (!enabled) return { taskID, minutes: null, source: 'missing', ruleID: '', ruleName: '' };
            const title = normalizeDurationMatchText(source.title);
            const matchedRule = config.rules.find((rule) => rule.keywords.some((keyword) => title.includes(normalizeDurationMatchText(keyword)))) || null;
            if (matchedRule) {
                return {
                    taskID,
                    minutes: matchedRule.minutes,
                    source: 'rule',
                    ruleID: matchedRule.id,
                    ruleName: matchedRule.name,
                };
            }
            return { taskID, minutes: config.fallbackMinutes, source: 'fallback', ruleID: '', ruleName: '' };
        });
    }

    async function resolveTaskDurationDefaults(input) {
        const source = input && typeof input === 'object' ? input : {};
        const policy = await getPolicy();
        const manualDrag = text(source.mode) === 'manual-drag';
        const items = resolveDurationCandidates(source.items || source.durationCandidates, policy.durationDefaults, { manualDrag });
        return { mode: manualDrag ? 'manual-drag' : 'ai', items };
    }

    function defaultPolicy() {
        const weeklyAvailability = {
            mon: '09:00-12:00, 14:00-18:00',
            tue: '09:00-12:00, 14:00-18:00',
            wed: '09:00-12:00, 14:00-18:00',
            thu: '09:00-12:00, 14:00-18:00',
            fri: '09:00-12:00, 14:00-18:00',
            sat: '09:00-12:00, 14:00-18:00',
            sun: '09:00-12:00, 14:00-18:00',
        };
        return {
            schemaVersion: 2,
            revision: 1,
            global: {
                weeklyAvailability,
                fixedOccupancy: [],
                deadlinePriority: { enabled: true },
                defaultCalendarID: '',
                customInstructions: '',
            },
            documentOverrides: {},
            groupOverrides: {},
            durationDefaults: defaultDurationDefaults(),
            previous: null,
        };
    }

    function normalizeStoredPolicyConfig(config) {
        const source = config && typeof config === 'object' && !Array.isArray(config) ? config : {};
        return Object.fromEntries(POLICY_CONFIG_FIELDS.filter((key) => own(source, key)).map((key) => [key, source[key]]));
    }

    function normalizeStoredPolicyOverrides(overrides) {
        const source = overrides && typeof overrides === 'object' && !Array.isArray(overrides) ? overrides : {};
        return Object.fromEntries(Object.entries(source)
            .filter(([, config]) => config && typeof config === 'object' && !Array.isArray(config))
            .map(([scopeID, config]) => [scopeID, normalizeStoredPolicyConfig(config)]));
    }

    function normalizePolicySnapshot(current) {
        if (!current || typeof current !== 'object' || Array.isArray(current)) return null;
        const defaults = defaultPolicy();
        const global = normalizeStoredPolicyConfig({ ...defaults.global, ...(current.global || {}) });
        if (!global.weeklyAvailability || typeof global.weeklyAvailability !== 'object' || !Object.keys(global.weeklyAvailability).length) {
            global.weeklyAvailability = defaults.global.weeklyAvailability;
        }
        const rawDocumentOverrides = current.documentOverrides && typeof current.documentOverrides === 'object' && !Array.isArray(current.documentOverrides)
            ? current.documentOverrides
            : (current.listOverrides && typeof current.listOverrides === 'object' && !Array.isArray(current.listOverrides) ? current.listOverrides : {});
        const rawGroupOverrides = current.groupOverrides && typeof current.groupOverrides === 'object' && !Array.isArray(current.groupOverrides)
            ? current.groupOverrides
            : {};
        const documentOverrides = normalizeStoredPolicyOverrides(rawDocumentOverrides);
        const groupOverrides = normalizeStoredPolicyOverrides(rawGroupOverrides);
        const durationDefaults = normalizeDurationDefaults(current.durationDefaults);
        const previous = current.previous && typeof current.previous === 'object' && !Array.isArray(current.previous)
            ? {
                ...current.previous,
                global: normalizeStoredPolicyConfig(current.previous.global),
                documentOverrides: normalizeStoredPolicyOverrides(current.previous.documentOverrides),
                groupOverrides: normalizeStoredPolicyOverrides(current.previous.groupOverrides),
                durationDefaults: normalizeDurationDefaults(current.previous.durationDefaults),
            }
            : null;
        const normalized = {
            ...defaults,
            ...current,
            schemaVersion: 2,
            global,
            documentOverrides,
            groupOverrides,
            durationDefaults,
            previous,
            revision: Math.max(1, Number(current.revision) || 1),
        };
        delete normalized.listOverrides;
        return normalized;
    }

    async function getPolicyRecord() {
        const record = await readJsonState(POLICY_FILE);
        if (record.status === 'missing') return { storageState: 'missing', policy: defaultPolicy() };
        if (record.status !== 'valid') throw jsonStorageError(POLICY_FILE, record);
        const policy = normalizePolicySnapshot(record.value);
        if (!policy) {
            throw jsonStorageError(POLICY_FILE, {
                status: 'corrupt',
                error: new Error('policy config is invalid'),
            });
        }
        return { storageState: 'valid', policy };
    }

    async function getPolicy() {
        return (await getPolicyRecord()).policy;
    }

    async function restorePolicySnapshot(input) {
        const record = await readJsonState(POLICY_FILE);
        if (record.status === 'valid') {
            const current = normalizePolicySnapshot(record.value);
            if (!current) throw jsonStorageError(POLICY_FILE, { status: 'corrupt', error: new Error('policy config is invalid') });
            return current;
        }
        if (record.status !== 'missing' && record.status !== 'corrupt') throw jsonStorageError(POLICY_FILE, record);
        const restored = normalizePolicySnapshot(input);
        if (!restored) throw new DomainError(ERROR.INVALID_ARGUMENT, '安排规则恢复数据无效');
        await writeJson(POLICY_FILE, restored);
        return restored;
    }

    function normalizePolicyDocumentGroups(settings) {
        return (Array.isArray(settings && settings.docGroups) ? settings.docGroups : []).map((group) => ({
            id: text(group && group.id),
            name: text(group && group.name) || '未命名文档分组',
            notebookID: text(group && (group.notebookId || group.notebookID)),
            documents: (Array.isArray(group && group.docs) ? group.docs : []).map((entry) => ({
                id: text(entry && typeof entry === 'object' ? (entry.id || entry.docId) : entry),
                recursive: !!(entry && typeof entry === 'object' && entry.recursive),
            })).filter((entry) => entry.id),
            excludedDocumentIDs: uniqueStrings(group && group.excludedDocIds),
        })).filter((group) => group.id);
    }

    async function policyDocumentMeta(documentIDs, groups) {
        const ids = uniqueStrings([
            ...documentIDs,
            ...groups.flatMap((group) => group.documents.filter((entry) => entry.recursive).map((entry) => entry.id)),
        ]).filter((id) => ID_RE.test(id));
        if (!ids.length) return new Map();
        const rows = await sql(`SELECT id, box, path, hpath FROM blocks WHERE type = 'd' AND id IN (${ids.map((id) => `'${escapeSql(id)}'`).join(',')})`);
        return new Map(rows.map((row) => [text(row.id), {
            id: text(row.id),
            box: text(row.box),
            path: text(row.path).replace(/\/+$/, ''),
            hpath: text(row.hpath).replace(/\/+$/, ''),
        }]));
    }

    function documentMatchesPolicyGroup(documentID, group, metaByID) {
        const id = text(documentID);
        if (!id || !group || group.excludedDocumentIDs.includes(id)) return false;
        const target = metaByID.get(id) || null;
        if (group.notebookID && target && target.box === group.notebookID) return true;
        return group.documents.some((entry) => {
            if (entry.id === id) return true;
            if (!entry.recursive || !target) return false;
            const root = metaByID.get(entry.id);
            if (!root || root.box !== target.box) return false;
            if (root.path && target.path) {
                const rootPath = root.path.replace(/\.sy$/i, '');
                return target.path === root.path || target.path.startsWith(`${rootPath}/`);
            }
            return !!root.hpath && !!target.hpath
                && (target.hpath === root.hpath || target.hpath.startsWith(`${root.hpath}/`));
        });
    }

    async function getTaskPolicy(input) {
        const source = input && typeof input === 'object' ? input : {};
        const policy = await getPolicy();
        const settings = await getSettings();
        const documentGroups = normalizePolicyDocumentGroups(settings);
        const documentIDs = uniqueStrings(source.documentIDs || source.documentIds).filter((id) => ID_RE.test(id)).slice(0, 200);
        const result = {
            ...policy,
            precedence: ['document', 'documentGroup', 'global'],
            documentGroups: documentGroups.map((group) => ({ id: group.id, name: group.name })),
            effectiveByDocument: {},
            durationEstimates: resolveDurationCandidates(source.durationCandidates, policy.durationDefaults),
        };
        if (!documentIDs.length) return result;
        const metaByID = await policyDocumentMeta(documentIDs, documentGroups);
        const groupSnapshot = state.documentGroupSnapshot;
        const useGroupSnapshot = !!groupSnapshot
            && (Date.now() - Number(groupSnapshot.registeredAt || 0)) < (30 * 60 * 1000)
            && documentGroups.every((group) => groupSnapshot.membersByGroup.has(group.id));
        documentIDs.forEach((documentID) => {
            const matchedGroups = documentGroups.filter((item) => useGroupSnapshot
                ? groupSnapshot.membersByGroup.get(item.id).has(documentID)
                : documentMatchesPolicyGroup(documentID, item, metaByID));
            const primaryGroup = matchedGroups[0] || null;
            const appliedGroup = matchedGroups.find((item) => policy.groupOverrides[item.id]) || null;
            result.effectiveByDocument[documentID] = {
                documentGroupID: primaryGroup?.id || '',
                documentGroupName: primaryGroup?.name || '',
                documentGroups: matchedGroups.map((item) => ({ id: item.id, name: item.name })),
                appliedGroupRuleID: appliedGroup?.id || '',
                appliedGroupRuleName: appliedGroup?.name || '',
                membershipSource: useGroupSnapshot ? 'pluginResolvedSnapshot' : 'sqlFallback',
                config: {
                    ...(policy.global || {}),
                    ...((appliedGroup && policy.groupOverrides[appliedGroup.id]) || {}),
                    ...(policy.documentOverrides[documentID] || {}),
                },
            };
        });
        return result;
    }

    function normalizePolicyConfigPatch(config, path) {
        if (!config || typeof config !== 'object' || Array.isArray(config)) throw new DomainError(ERROR.INVALID_ARGUMENT, `${path} 策略格式无效`);
        const allowed = new Set(POLICY_CONFIG_FIELDS);
        const out = {};
        Object.keys(config).forEach((key) => {
            if (!allowed.has(key)) throw new DomainError(ERROR.INVALID_ARGUMENT, `不支持的策略字段: ${path}.${key}`);
            out[key] = config[key];
        });
        return out;
    }

    function normalizePolicyOverridePatch(overrides, path) {
        if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) throw new DomainError(ERROR.INVALID_ARGUMENT, `${path} 策略格式无效`);
        return Object.fromEntries(Object.entries(overrides).map(([scopeID, config]) => [
            scopeID,
            config == null ? null : normalizePolicyConfigPatch(config, `${path}.${scopeID}`),
        ]));
    }

    function normalizePolicyPatch(patch) {
        const source = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {};
        const out = {};
        if (own(source, 'durationDefaults')) out.durationDefaults = normalizeDurationDefaults(source.durationDefaults, { strict: true });
        if (own(source, 'global')) out.global = normalizePolicyConfigPatch(source.global, 'global');
        if (own(source, 'documentOverrides') || own(source, 'listOverrides')) {
            const legacy = own(source, 'listOverrides') ? source.listOverrides : {};
            const current = own(source, 'documentOverrides') ? source.documentOverrides : {};
            if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) throw new DomainError(ERROR.INVALID_ARGUMENT, 'listOverrides 策略格式无效');
            if (!current || typeof current !== 'object' || Array.isArray(current)) throw new DomainError(ERROR.INVALID_ARGUMENT, 'documentOverrides 策略格式无效');
            out.documentOverrides = normalizePolicyOverridePatch({ ...legacy, ...current }, 'documentOverrides');
        }
        if (own(source, 'groupOverrides')) {
            out.groupOverrides = normalizePolicyOverridePatch(source.groupOverrides, 'groupOverrides');
        }
        if (!Object.keys(out).length) throw new DomainError(ERROR.INVALID_ARGUMENT, '策略补丁为空');
        return out;
    }

    function policyDiff(current, patch) {
        const changes = [];
        Object.keys(patch).forEach((section) => {
            const values = patch[section] || {};
            Object.keys(values).forEach((key) => {
                const before = current[section] && current[section][key];
                const after = values[key];
                if (stableJson(before) !== stableJson(after)) changes.push({ path: `${section}.${key}`, before: before == null ? null : before, after });
            });
        });
        return changes;
    }

    async function previewPolicyPatch(input) {
        pruneTokens(state.policyTokens);
        const current = await getPolicy();
        const expectedRevision = Number(input && input.expectedRevision);
        if (Number.isFinite(expectedRevision) && expectedRevision !== Number(current.revision)) {
            throw new DomainError(ERROR.STALE_REVISION, '策略版本已变化，请重新读取');
        }
        const patch = normalizePolicyPatch(input && input.patch);
        const changes = policyDiff(current, patch);
        const previewToken = token('policy');
        state.policyTokens.set(previewToken, { expectedRevision: current.revision, patch, expiresAt: Date.now() + PREVIEW_TOKEN_TTL });
        return { previewToken, expectedRevision: current.revision, changes, expiresAt: new Date(Date.now() + PREVIEW_TOKEN_TTL).toISOString() };
    }

    async function applyPolicyPatch(input) {
        pruneTokens(state.policyTokens);
        const current = await getPolicy();
        const item = state.policyTokens.get(text(input && input.previewToken));
        if (!item) throw new DomainError(ERROR.CONFIRMATION_REQUIRED, '请先预览策略变更');
        if (Number(current.revision) !== Number(item.expectedRevision) || Number(input && input.expectedRevision) !== Number(item.expectedRevision)) {
            throw new DomainError(ERROR.STALE_REVISION, '策略版本已变化，请重新预览');
        }
        const nextDocumentOverrides = { ...(current.documentOverrides || {}) };
        Object.entries(item.patch.documentOverrides || {}).forEach(([scopeID, value]) => {
            if (value == null) delete nextDocumentOverrides[scopeID];
            else nextDocumentOverrides[scopeID] = value;
        });
        const nextGroupOverrides = { ...(current.groupOverrides || {}) };
        Object.entries(item.patch.groupOverrides || {}).forEach(([scopeID, value]) => {
            if (value == null) delete nextGroupOverrides[scopeID];
            else nextGroupOverrides[scopeID] = value;
        });
        const next = {
            ...current,
            schemaVersion: 2,
            global: { ...(current.global || {}), ...(item.patch.global || {}) },
            documentOverrides: nextDocumentOverrides,
            groupOverrides: nextGroupOverrides,
            durationDefaults: item.patch.durationDefaults || current.durationDefaults,
            previous: {
                revision: current.revision,
                global: current.global,
                documentOverrides: current.documentOverrides,
                groupOverrides: current.groupOverrides,
                durationDefaults: current.durationDefaults,
            },
            revision: Number(current.revision) + 1,
        };
        await writeJson(POLICY_FILE, next);
        state.policyTokens.delete(text(input.previewToken));
        return { policy: next, changes: policyDiff(current, item.patch) };
    }

    function completionAttrExpression(names, alias) {
        const table = text(alias) || 't';
        const list = uniqueStrings(names).map((name) => `'${escapeSql(name)}'`).join(',');
        return `COALESCE((SELECT a.value FROM attributes a
            WHERE a.block_id = ${table}.id AND a.name IN (${list}) AND a.value != ''
            ORDER BY CASE WHEN a.name = '${escapeSql(names[0])}' THEN 0 ELSE 1 END LIMIT 1), '')`;
    }

    function normalizeTaskScope(input) {
        const source = input && typeof input === 'object' ? input : {};
        const registered = resolveTaskScopeToken(source.scopeToken);
        if (registered) {
            return {
                scopeToken: registered.scopeToken,
                scopeID: registered.scopeID,
                scopeMode: registered.scopeMode === 'documents' ? 'documents' : 'tasks',
                taskIDs: registered.taskIDs.slice(),
                documentIDs: registered.documentIDs.slice(),
                realTaskCount: Math.max(0, Number(registered.realTaskCount) || 0),
                taskValues: new Map(registered.taskValues || []),
                virtualTasks: (registered.virtualTasks || []).map((item) => ({ ...item })),
                virtualTaskMap: new Map(registered.virtualTaskMap || []),
                tokenBacked: true,
            };
        }
        return {
            scopeToken: '',
            scopeID: '',
            scopeMode: 'tasks',
            taskIDs: uniqueStrings(source.taskIDs || source.taskIds || source.ids).filter((id) => ID_RE.test(id)),
            documentIDs: uniqueStrings(source.documentIDs || source.documentIds || source.docIDs || source.docIds).filter((id) => ID_RE.test(id)),
            taskValues: new Map(),
            virtualTasks: [],
            virtualTaskMap: new Map(),
            tokenBacked: false,
        };
    }

    function appendTaskScopeConditions(conditions, scope, alias) {
        const table = text(alias) || 't';
        if (scope.tokenBacked) {
            if (scope.scopeMode === 'documents') {
                const branches = [];
                if (scope.taskIDs.length) branches.push(`${table}.id IN (${scope.taskIDs.map((id) => `'${escapeSql(id)}'`).join(',')})`);
                if (scope.documentIDs.length) branches.push(`${table}.root_id IN (${scope.documentIDs.map((id) => `'${escapeSql(id)}'`).join(',')})`);
                conditions.push(branches.length ? `(${branches.join(' OR ')})` : '1 = 0');
                return conditions;
            }
            conditions.push(scope.taskIDs.length
                ? `${table}.id IN (${scope.taskIDs.map((id) => `'${escapeSql(id)}'`).join(',')})`
                : '1 = 0');
            return conditions;
        }
        if (scope.taskIDs.length) conditions.push(`${table}.id IN (${scope.taskIDs.map((id) => `'${escapeSql(id)}'`).join(',')})`);
        if (scope.documentIDs.length) conditions.push(`${table}.root_id IN (${scope.documentIDs.map((id) => `'${escapeSql(id)}'`).join(',')})`);
        return conditions;
    }

    function taskScopeCoverage(scope) {
        return {
            scopeToken: text(scope && scope.scopeToken),
            scopeID: text(scope && scope.scopeID),
            scopeMode: text(scope && scope.scopeMode) || 'tasks',
            taskCount: Number.isFinite(Number(scope && scope.realTaskCount))
                ? Math.max(0, Number(scope.realTaskCount))
                : (Array.isArray(scope && scope.taskIDs) ? scope.taskIDs.length : 0),
            virtualTaskCount: Array.isArray(scope && scope.virtualTasks) ? scope.virtualTasks.length : 0,
            totalScopeTaskCount: (Number.isFinite(Number(scope && scope.realTaskCount))
                ? Math.max(0, Number(scope.realTaskCount))
                : (Array.isArray(scope && scope.taskIDs) ? scope.taskIDs.length : 0))
                + (Array.isArray(scope && scope.virtualTasks) ? scope.virtualTasks.length : 0),
            virtualTasksIncluded: false,
            documentCount: Array.isArray(scope && scope.documentIDs) ? scope.documentIDs.length : 0,
        };
    }

    async function getCompletedTaskRows(input) {
        const registry = await getFieldRegistry();
        const completeField = registry.byId.get('taskCompleteAt');
        const statusField = registry.byId.get('customStatus');
        const priorityField = registry.byId.get('priority');
        const completeExpr = completionAttrExpression([completeField.attr].concat(completeField.aliases || []));
        const statusExpr = completionAttrExpression([statusField.attr].concat(statusField.aliases || []));
        const priorityExpr = completionAttrExpression([priorityField.attr].concat(priorityField.aliases || []));
        const requestedCustomFieldIDs = uniqueStrings(input && input.customFieldIDs).slice(0, 20);
        const customFields = requestedCustomFieldIDs.map((fieldID, index) => {
            const field = registry.byId.get(fieldID);
            if (!field || !field.custom) throw new DomainError(ERROR.INVALID_ARGUMENT, `未注册的自定义字段: ${fieldID}`);
            return { field, alias: `custom_field_${index}` };
        });
        const customSelect = customFields.map(({ field, alias }) => `, ${completionAttrExpression([field.attr].concat(field.aliases || []))} AS ${alias}`).join('');
        const conditions = ["t.type = 'i'", "t.subtype = 't'", "(t.markdown LIKE '%[x]%' OR t.markdown LIKE '%[X]%')"];
        const scope = normalizeTaskScope(input);
        appendTaskScopeConditions(conditions, scope, 't');
        const fromDate = text(input && input.from);
        const toDate = text(input && input.to);
        if (fromDate && !isStrictDateKey(fromDate)) throw new DomainError(ERROR.INVALID_ARGUMENT, '统计起始日期格式无效，应为 YYYY-MM-DD');
        if (toDate && !isStrictDateKey(toDate)) throw new DomainError(ERROR.INVALID_ARGUMENT, '统计结束日期格式无效，应为 YYYY-MM-DD');
        if (fromDate && toDate && fromDate > toDate) throw new DomainError(ERROR.INVALID_ARGUMENT, '统计结束日期不能早于起始日期');
        const coverageRows = await sql(`
            SELECT COUNT(*) AS completed_in_scope,
                SUM(CASE WHEN ${completeExpr} = '' THEN 1 ELSE 0 END) AS missing_completion_time
            FROM blocks t
            WHERE ${conditions.join(' AND ')}
        `);
        const dateConditions = [];
        if (fromDate) dateConditions.push(`substr(completed_at, 1, 10) >= '${escapeSql(fromDate)}'`);
        if (toDate) dateConditions.push(`substr(completed_at, 1, 10) <= '${escapeSql(toDate)}'`);
        const rows = await sql(`
            SELECT * FROM (
                SELECT t.id, t.root_id, t.content AS title, d.content AS doc_name,
                    ${completeExpr} AS completed_at,
                    ${statusExpr} AS custom_status,
                    ${priorityExpr} AS priority
                    ${customSelect}
                FROM blocks t LEFT JOIN blocks d ON d.id = t.root_id
                WHERE ${conditions.join(' AND ')}
            ) completed_tasks
            ${dateConditions.length ? `WHERE completed_at != '' AND ${dateConditions.join(' AND ')}` : ''}
            ORDER BY completed_at ASC
        `);
        const coverage = coverageRows[0] || {};
        return {
            rows,
            customFields,
            registry,
            completedInScope: Number(coverage.completed_in_scope) || 0,
            missingCompletionTime: Number(coverage.missing_completion_time) || 0,
        };
    }

    function periodKey(value, period) {
        const raw = text(value).slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return 'unknown';
        if (period === 'day') return raw;
        if (period === 'year') return raw.slice(0, 4);
        if (period === 'week') {
            const date = new Date(`${raw}T00:00:00Z`);
            const day = date.getUTCDay() || 7;
            date.setUTCDate(date.getUTCDate() + 4 - day);
            const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
            const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
            return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
        }
        return raw.slice(0, 7);
    }

    function countBy(rows, keySelector) {
        const map = new Map();
        rows.forEach((row) => {
            const key = text(keySelector(row)) || '未设置';
            map.set(key, (map.get(key) || 0) + 1);
        });
        return Array.from(map, ([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
    }

    function countByLabeled(rows, valueSelector, labelSelector) {
        const map = new Map();
        rows.forEach((row) => {
            const value = text(valueSelector(row));
            const current = map.get(value) || { value, key: text(labelSelector(value)) || value || '未设置', count: 0 };
            current.count += 1;
            map.set(value, current);
        });
        return Array.from(map.values()).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
    }

    function customFieldBreakdown(rows, field, alias) {
        const definition = customFieldDefinitions({ fields: [field] })[0];
        const options = Array.isArray(definition?.options) ? definition.options : [];
        const optionByID = new Map(options.map((option) => [option.id, option]));
        const optionIDByValue = new Map();
        options.forEach((option) => {
            optionIDByValue.set(option.id, option.id);
            optionIDByValue.set(option.label, option.id);
        });
        const directRowsByID = new Map(options.map((option) => [option.id, new Set()]));
        const totalRowsByID = new Map(options.map((option) => [option.id, new Set()]));
        const unknownRowsByValue = new Map();
        const unsetRows = new Set();
        rows.forEach((row, rowIndex) => {
            const raw = text(row && row[alias]);
            const values = raw
                ? (text(field?.type) === 'multi' ? raw.split(',').map(text).filter(Boolean) : [raw])
                : [];
            if (!values.length) {
                unsetRows.add(rowIndex);
                return;
            }
            new Set(values).forEach((value) => {
                const optionID = optionIDByValue.get(value);
                if (!optionID) {
                    const rowIDs = unknownRowsByValue.get(value) || new Set();
                    rowIDs.add(rowIndex);
                    unknownRowsByValue.set(value, rowIDs);
                    return;
                }
                directRowsByID.get(optionID).add(rowIndex);
                const option = optionByID.get(optionID);
                [optionID].concat(option?.ancestorIDs || []).forEach((id) => totalRowsByID.get(id)?.add(rowIndex));
            });
        });
        const items = options.map((option) => ({
            value: option.id,
            key: option.label,
            count: directRowsByID.get(option.id)?.size || 0,
        })).filter((item) => item.count > 0);
        unknownRowsByValue.forEach((rowIDs, value) => items.push({ value, key: value, count: rowIDs.size }));
        if (unsetRows.size) items.push({ value: '', key: '未设置', count: unsetRows.size });
        items.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
        return {
            items,
            hierarchyItems: options.map((option) => ({
                ...option,
                directCount: directRowsByID.get(option.id)?.size || 0,
                totalCount: totalRowsByID.get(option.id)?.size || 0,
            })),
        };
    }

    const FOCUS_STATS_CONTRACT_VERSION = 2;
    const DOCK_TOMATO_PLUGIN_ID = 'siyuan-plugin-docktomato';
    const FOCUS_STATS_DEADLINE_MS = 10000;
    const FOCUS_STATS_SCOPE_TASK_LIMIT = 10000;
    const FOCUS_STATS_SNAPSHOT_TASK_LIMIT = 20000;
    const FOCUS_STATS_SNAPSHOT_BYTE_LIMIT = 8 * 1024 * 1024;

    function focusStatsScopeTooLarge(details = {}) {
        return new DomainError('FOCUS_SCOPE_TOO_LARGE', '专注统计任务范围过大', {
            maxTaskCount: FOCUS_STATS_SCOPE_TASK_LIMIT,
            ...details,
        });
    }

    function withFocusStatsDeadline(input) {
        const source = input && typeof input === 'object' ? { ...input } : {};
        const generated = Date.now() + FOCUS_STATS_DEADLINE_MS;
        const requested = Math.max(0, Number(source.deadlineAt) || 0);
        source.deadlineAt = requested > 0 ? Math.min(requested, generated) : generated;
        return source;
    }

    function assertFocusStatsDeadline(input, stage) {
        const deadlineAt = Math.max(0, Number(input?.deadlineAt) || 0);
        if (!deadlineAt || Date.now() < deadlineAt) return;
        throw new DomainError('STATS_QUERY_EXPIRED', '统计查询已超过执行期限', {
            deadlineAt,
            stage: text(stage),
        });
    }

    async function runWithFocusStatsDeadline(input, stage, operation) {
        assertFocusStatsDeadline(input, stage);
        const deadlineAt = Math.max(0, Number(input?.deadlineAt) || 0);
        const remainingMs = Math.max(1, deadlineAt - Date.now());
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        let timer = null;
        const timeout = new Promise((resolve, reject) => {
            timer = setTimeout(() => {
                try { controller?.abort?.(); } catch (e) {}
                reject(new DomainError('STATS_QUERY_EXPIRED', '统计查询已超过执行期限', {
                    deadlineAt,
                    stage: text(stage),
                }));
            }, remainingMs);
        });
        try {
            return await Promise.race([
                Promise.resolve().then(() => operation(controller?.signal)),
                timeout,
            ]);
        } finally {
            if (timer !== null) clearTimeout(timer);
        }
    }

    async function callDockTomatoRpc(method, input) {
        const requestInput = withFocusStatsDeadline(input);
        let payload;
        try {
            payload = await runWithFocusStatsDeadline(requestInput, `dock-rpc:${method}`, async (signal) => {
                const response = await siyuan.client.fetch(`/api/plugin/rpc?name=${encodeURIComponent(DOCK_TOMATO_PLUGIN_ID)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: token('dock_stats'),
                        method,
                        params: [requestInput],
                    }),
                    signal,
                });
                if (!response?.ok) {
                    throw new DomainError('DOCK_TOMATO_STATS_UNAVAILABLE', '底栏番茄钟统计服务不可用', {
                        method,
                        status: Number(response?.status) || 0,
                    });
                }
                try {
                    return await response.json();
                } catch (error) {
                    throw new DomainError(ERROR.STORAGE_CORRUPT, '底栏番茄钟统计响应无法解析', {
                        method,
                        cause: text(error?.message),
                    });
                }
            });
        } catch (error) {
            if (error instanceof DomainError) throw error;
            throw new DomainError('DOCK_TOMATO_STATS_UNAVAILABLE', '底栏番茄钟统计服务不可用', {
                method,
                cause: text(error?.message),
            });
        }
        if (payload?.error) {
            const rpcCode = Number(payload.error.code);
            const unavailable = rpcCode === -32001 || rpcCode === -32002;
            throw new DomainError(unavailable ? 'DOCK_TOMATO_STATS_UNAVAILABLE' : ERROR.UNSUPPORTED,
                unavailable ? '底栏番茄钟统计服务未加载' : '底栏番茄钟统计接口调用失败', {
                    method,
                    rpcCode,
                    rpcMessage: text(payload.error.message),
                });
        }

        const result = payload?.result;
        if (result?.ok !== true) {
            if (result?.ok === false && result.error) {
                throw new DomainError(text(result.error.code) || ERROR.STORAGE_ERROR,
                    text(result.error.message) || '底栏番茄钟统计失败', {
                        method,
                        ...(result.error.details && typeof result.error.details === 'object' ? result.error.details : {}),
                    });
            }
            throw new DomainError(ERROR.UNSUPPORTED, '底栏番茄钟统计响应格式不兼容', { method });
        }
        if (Number(result.data?.contractVersion) !== FOCUS_STATS_CONTRACT_VERSION) {
            throw new DomainError(ERROR.UNSUPPORTED, '底栏番茄钟统计核心不兼容', { method });
        }
        return result.data;
    }

    const queryDockTomatoFocusStats = (input) => callDockTomatoRpc('dockTomatoQueryFocus', input);
    const queryDockTomatoRoutineStats = (input) => callDockTomatoRpc('dockTomatoQueryRoutine', input);
    const listDockTomatoSessions = (input) => callDockTomatoRpc('dockTomatoListSessions', input);

    async function collectFocusSubtreeTaskIDs(rootTaskID, input) {
        const id = requireID(rootTaskID, '根任务 ID');
        assertFocusStatsDeadline(input, 'before-root-scope');
        const rows = await sql(`
            WITH RECURSIVE task_tree(id, depth) AS (
                SELECT id, 0
                FROM blocks
                WHERE id = '${escapeSql(id)}' AND type = 'i' AND subtype = 't'
                UNION ALL
                SELECT child.id, task_tree.depth + 1
                FROM task_tree
                JOIN blocks child_list
                    ON child_list.parent_id = task_tree.id AND child_list.type = 'l'
                JOIN blocks child
                    ON child.parent_id = child_list.id AND child.type = 'i' AND child.subtype = 't'
                WHERE task_tree.depth < 128
                LIMIT ${FOCUS_STATS_SCOPE_TASK_LIMIT + 1}
            )
            SELECT id, depth AS tree_depth
            FROM task_tree
            ORDER BY depth ASC, id ASC
            LIMIT ${FOCUS_STATS_SCOPE_TASK_LIMIT + 1}
        `);
        assertFocusStatsDeadline(input, 'after-root-scope');
        if (!rows.length || text(rows[0]?.id) !== id) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '根任务必须指向任务块', { rootTaskID: id });
        }
        if (rows.some((item) => Number(item?.tree_depth) >= 128)) {
            throw focusStatsScopeTooLarge({ rootTaskID: id, maxDepth: 128 });
        }
        const taskIDs = uniqueStrings(rows.map((item) => item?.id));
        if (taskIDs.length > FOCUS_STATS_SCOPE_TASK_LIMIT) {
            throw focusStatsScopeTooLarge({ rootTaskID: id, taskCount: taskIDs.length });
        }
        return taskIDs;
    }

    async function collectFocusDocumentTaskIDs(documentIDs, input) {
        const out = new Set();
        const ids = uniqueStrings(documentIDs).filter((id) => ID_RE.test(id));
        for (let offset = 0; offset < ids.length; offset += 100) {
            assertFocusStatsDeadline(input, 'document-scope');
            const chunk = ids.slice(offset, offset + 100);
            const rows = await sql(`SELECT id FROM blocks
                WHERE root_id IN (${chunk.map((id) => `'${escapeSql(id)}'`).join(',')})
                    AND type = 'i' AND subtype = 't'
                ORDER BY id ASC
                LIMIT ${FOCUS_STATS_SCOPE_TASK_LIMIT + 1}`);
            rows.forEach((row) => {
                const id = text(row?.id);
                if (id) out.add(id);
            });
            if (out.size > FOCUS_STATS_SCOPE_TASK_LIMIT) {
                throw focusStatsScopeTooLarge({ documentCount: ids.length, taskCount: out.size });
            }
        }
        return out;
    }

    async function resolveFocusCandidateIDs(input = {}) {
        const source = withFocusStatsDeadline(input);
        assertFocusStatsDeadline(source, 'focus-scope-start');
        const rootTaskID = text(source.rootTaskID || source.rootTaskId);
        const hasExplicitScope = !!text(source.scopeToken)
            || Object.prototype.hasOwnProperty.call(source, 'taskIDs')
            || Object.prototype.hasOwnProperty.call(source, 'taskIds')
            || Object.prototype.hasOwnProperty.call(source, 'documentIDs')
            || Object.prototype.hasOwnProperty.call(source, 'documentIds');
        if (!rootTaskID && !hasExplicitScope) return null;

        let scopedIDs = null;
        if (hasExplicitScope) {
            const rawTaskIDs = Array.isArray(source.taskIDs) ? source.taskIDs : (Array.isArray(source.taskIds) ? source.taskIds : []);
            const rawDocumentIDs = Array.isArray(source.documentIDs) ? source.documentIDs : (Array.isArray(source.documentIds) ? source.documentIds : []);
            if (rawTaskIDs.length > FOCUS_STATS_SCOPE_TASK_LIMIT || rawDocumentIDs.length > FOCUS_STATS_SCOPE_TASK_LIMIT) {
                throw focusStatsScopeTooLarge({
                    taskCount: rawTaskIDs.length,
                    documentCount: rawDocumentIDs.length,
                });
            }
            const scope = normalizeTaskScope(source);
            scopedIDs = new Set(scope.taskIDs);
            if (scopedIDs.size > FOCUS_STATS_SCOPE_TASK_LIMIT || scope.documentIDs.length > FOCUS_STATS_SCOPE_TASK_LIMIT) {
                throw focusStatsScopeTooLarge({ taskCount: scopedIDs.size, documentCount: scope.documentIDs.length });
            }
            const documentTaskIDs = await collectFocusDocumentTaskIDs(scope.documentIDs, source);
            documentTaskIDs.forEach((id) => scopedIDs.add(id));
            if (scopedIDs.size > FOCUS_STATS_SCOPE_TASK_LIMIT) {
                throw focusStatsScopeTooLarge({ taskCount: scopedIDs.size });
            }
        }

        let rootIDs = null;
        if (rootTaskID) rootIDs = new Set(await collectFocusSubtreeTaskIDs(rootTaskID, source));
        const candidateIDs = rootIDs && scopedIDs
            ? Array.from(rootIDs).filter((id) => scopedIDs.has(id))
            : Array.from(rootIDs || scopedIDs || []);
        if (candidateIDs.length > FOCUS_STATS_SCOPE_TASK_LIMIT) {
            throw focusStatsScopeTooLarge({ taskCount: candidateIDs.length });
        }
        assertFocusStatsDeadline(source, 'focus-scope-complete');
        return candidateIDs.sort();
    }

    function focusStatsUtf8ByteLength(value) {
        const source = String(value == null ? '' : value);
        let bytes = 0;
        for (let index = 0; index < source.length; index += 1) {
            const code = source.charCodeAt(index);
            if (code < 0x80) bytes += 1;
            else if (code < 0x800) bytes += 2;
            else if (code >= 0xD800 && code <= 0xDBFF && index + 1 < source.length
                && source.charCodeAt(index + 1) >= 0xDC00 && source.charCodeAt(index + 1) <= 0xDFFF) {
                bytes += 4;
                index += 1;
            } else bytes += 3;
        }
        return bytes;
    }

    function focusStatsSnapshotTooLarge(details = {}) {
        return new DomainError('FOCUS_SCOPE_TOO_LARGE', '任务统计快照过大', {
            maxTaskCount: FOCUS_STATS_SNAPSHOT_TASK_LIMIT,
            maxSnapshotBytes: FOCUS_STATS_SNAPSHOT_BYTE_LIMIT,
            ...details,
        });
    }

    function normalizeFocusTaskSnapshot(value, options = {}) {
        const source = value && typeof value === 'object' ? value : {};
        const rows = Array.isArray(source.tasks) ? source.tasks : (Array.isArray(value) ? value : []);
        if (rows.length > FOCUS_STATS_SNAPSHOT_TASK_LIMIT) throw focusStatsSnapshotTooLarge({ taskCount: rows.length });
        const customFieldID = text(options?.groupBy) === 'customField'
            ? text(options?.customFieldID || options?.customFieldId)
            : '';
        const tasks = new Map();
        const aliases = new Map();
        let snapshotBytes = 2;
        rows.forEach((row) => {
            if (!(row && typeof row === 'object')) return;
            const id = text(row.id || row.taskID || row.taskId);
            if (!id || tasks.has(id)) return;
            const aliasIDs = uniqueStrings([id].concat(Array.isArray(row.aliasIDs) ? row.aliasIDs : (Array.isArray(row.aliasIds) ? row.aliasIds : [])));
            const task = {
                id,
                aliasIDs,
                parentTaskID: text(row.parentTaskID || row.parentTaskId || row.parent_task_id),
                documentID: text(row.documentID || row.documentId || row.docId || row.root_id),
                documentName: text(row.documentName || row.docName || row.doc),
                title: text(row.title || row.content) || '未命名任务',
                done: row.done === true,
                customStatus: text(row.customStatus || row.custom_status),
                customStatusName: text(row.customStatusName),
                priority: text(row.priority),
                priorityName: text(row.priorityName),
                customFieldValues: customFieldID && row.customFieldValues && typeof row.customFieldValues === 'object'
                    ? { [customFieldID]: row.customFieldValues[customFieldID] }
                    : {},
                duration: row.duration,
                tomatoEstimateCount: row.tomatoEstimateCount,
                created: text(row.created),
            };
            let serialized = '';
            try { serialized = JSON.stringify(task); } catch (error) { throw focusStatsSnapshotTooLarge({ reason: 'not-serializable' }); }
            snapshotBytes += focusStatsUtf8ByteLength(serialized) + 1;
            if (snapshotBytes > FOCUS_STATS_SNAPSHOT_BYTE_LIMIT) {
                throw focusStatsSnapshotTooLarge({ taskCount: tasks.size + 1, bytes: snapshotBytes });
            }
            tasks.set(id, task);
            aliasIDs.forEach((alias) => { if (!aliases.has(alias)) aliases.set(alias, id); });
        });
        return { tasks, aliases, revision: Math.max(0, Number(source.revision) || 0), byteLength: snapshotBytes };
    }

    function snapshotTaskAncestors(taskID, snapshot) {
        const out = [];
        const seen = new Set([text(taskID)]);
        let parentID = text(snapshot?.tasks?.get(text(taskID))?.parentTaskID);
        while (parentID && !seen.has(parentID) && out.length < 200) {
            seen.add(parentID);
            out.push(parentID);
            parentID = text(snapshot.tasks.get(parentID)?.parentTaskID);
        }
        return out.reverse();
    }

    function normalizeSemanticTask(task, ancestorTaskIDs = []) {
        if (!(task && typeof task === 'object')) return null;
        return {
            id: text(task.id),
            aliasIDs: uniqueStrings([task.id].concat(task.aliasIDs || [])),
            parentTaskID: text(task.parentTaskID),
            ancestorTaskIDs: uniqueStrings(ancestorTaskIDs),
            documentID: text(task.documentID),
            documentName: text(task.documentName),
            title: text(task.title) || '未命名任务',
            done: task.done === true,
            customStatus: text(task.customStatus),
            customStatusName: text(task.customStatusName),
            priority: text(task.priority),
            priorityName: text(task.priorityName),
            customFieldValues: task.customFieldValues && typeof task.customFieldValues === 'object' ? { ...task.customFieldValues } : {},
            duration: task.duration,
            tomatoEstimateCount: task.tomatoEstimateCount,
            created: text(task.created),
        };
    }

    function createSnapshotTaskResolver(snapshotValue, options = {}) {
        const snapshot = normalizeFocusTaskSnapshot(snapshotValue, options);
        return {
            snapshot,
            async preload() {},
            async resolve(candidateIDs) {
                for (const candidate of uniqueStrings(candidateIDs)) {
                    const id = snapshot.aliases.get(candidate) || (snapshot.tasks.has(candidate) ? candidate : '');
                    if (!id) continue;
                    const task = snapshot.tasks.get(id);
                    return normalizeSemanticTask(task, snapshotTaskAncestors(id, snapshot));
                }
                return null;
            },
            async get(taskID) {
                const id = snapshot.aliases.get(text(taskID)) || text(taskID);
                const task = snapshot.tasks.get(id);
                return task ? normalizeSemanticTask(task, snapshotTaskAncestors(id, snapshot)) : null;
            },
        };
    }

    function createCompositeTaskResolver(snapshotValue, options = {}) {
        const snapshotResolver = createSnapshotTaskResolver(snapshotValue, options);
        let kernelResolverPromise = null;
        const kernelResolver = () => {
            if (!kernelResolverPromise) kernelResolverPromise = createKernelTaskResolver(options);
            return kernelResolverPromise;
        };
        return {
            snapshot: snapshotResolver.snapshot,
            async preload(candidateGroups, control = options) {
                const missing = [];
                const groups = Array.isArray(candidateGroups) ? candidateGroups : [];
                for (let index = 0; index < groups.length; index += 1) {
                    if (index % 256 === 0) assertFocusStatsDeadline(control, 'snapshot-preload');
                    const group = groups[index];
                    if (!await snapshotResolver.resolve(group)) missing.push(group);
                }
                if (missing.length) await (await kernelResolver()).preload(missing, control);
            },
            async resolve(candidateIDs) {
                const projected = await snapshotResolver.resolve(candidateIDs);
                if (projected) return projected;
                const persisted = await (await kernelResolver()).resolve(candidateIDs);
                if (!persisted) return null;
                return await snapshotResolver.get(persisted.id) || persisted;
            },
            async get(taskID) {
                const projected = await snapshotResolver.get(taskID);
                if (projected) return projected;
                return (await kernelResolver()).get(taskID);
            },
        };
    }

    async function readFocusBlockRolesBatch(blockIDs, control = {}) {
        const result = new Map();
        const ids = uniqueStrings(blockIDs);
        for (let offset = 0; offset < ids.length; offset += 200) {
            assertFocusStatsDeadline(control, 'task-binding-role-batch');
            const chunk = ids.slice(offset, offset + 200);
            const rows = await sql(`SELECT id, parent_id, root_id, type, subtype FROM blocks WHERE id IN (${chunk.map((id) => `'${escapeSql(id)}'`).join(',')})`);
            rows.forEach((row) => result.set(text(row.id), row));
        }
        return result;
    }

    async function readFocusListTasksBatch(listIDs, control = {}) {
        const result = new Map();
        const ids = uniqueStrings(listIDs);
        for (let offset = 0; offset < ids.length; offset += 100) {
            assertFocusStatsDeadline(control, 'task-binding-list-batch');
            const chunk = ids.slice(offset, offset + 100);
            const rows = await sql(`
                SELECT source.id AS list_id,
                    COALESCE((
                        SELECT child.id FROM blocks child
                        WHERE child.parent_id = source.id AND child.type = 'i' AND child.subtype = 't'
                        ORDER BY child.sort ASC, child.created ASC, child.id ASC
                        LIMIT 1
                    ), '') AS task_id
                FROM blocks source
                WHERE source.id IN (${chunk.map((id) => `'${escapeSql(id)}'`).join(',')})
            `);
            rows.forEach((row) => result.set(text(row.list_id), text(row.task_id)));
        }
        return result;
    }

    async function resolveFocusBindingsBatch(candidateGroups, control = {}) {
        const groups = (Array.isArray(candidateGroups) ? candidateGroups : [])
            .map((group) => uniqueStrings(group))
            .filter((group) => group.length);
        const resolved = new Map();
        const active = new Map(uniqueStrings(groups.flat()).map((id) => [id, {
            currentID: id,
            seen: new Set([id]),
        }]));
        for (let depth = 0; active.size && depth < 30; depth += 1) {
            assertFocusStatsDeadline(control, 'task-binding-depth');
            const roles = await readFocusBlockRolesBatch(Array.from(active.values(), (state) => state.currentID), control);
            const listTasks = await readFocusListTasksBatch(Array.from(roles.values())
                .filter((row) => text(row?.type).toLowerCase() === 'l')
                .map((row) => text(row.id)), control);
            for (const [candidateID, state] of active) {
                const row = roles.get(state.currentID);
                if (!row) {
                    resolved.set(candidateID, null);
                    active.delete(candidateID);
                    continue;
                }
                const type = text(row.type).toLowerCase();
                const subtype = text(row.subtype).toLowerCase();
                const taskID = type === 'i' && subtype === 't'
                    ? text(row.id)
                    : (type === 'l' ? text(listTasks.get(text(row.id))) : '');
                if (taskID) {
                    resolved.set(candidateID, taskID);
                    active.delete(candidateID);
                    continue;
                }
                const parentID = text(row.parent_id);
                if (!parentID || state.seen.has(parentID)) {
                    resolved.set(candidateID, null);
                    active.delete(candidateID);
                    continue;
                }
                state.seen.add(parentID);
                state.currentID = parentID;
            }
        }
        active.forEach((_state, candidateID) => resolved.set(candidateID, null));
        const taskIDs = new Set();
        groups.forEach((group) => {
            const taskID = group.map((candidate) => text(resolved.get(candidate))).find(Boolean) || '';
            group.forEach((candidate) => resolved.set(candidate, taskID || null));
            if (taskID) taskIDs.add(taskID);
        });
        return { resolved, taskIDs };
    }

    async function readFocusTaskRowsBatch(taskIDs, control = {}) {
        const result = new Map();
        let frontier = uniqueStrings(taskIDs);
        let depth = 0;
        while (frontier.length && depth < 200) {
            const pending = frontier.filter((id) => !result.has(id));
            if (!pending.length) break;
            const next = [];
            for (let offset = 0; offset < pending.length; offset += 100) {
                assertFocusStatsDeadline(control, 'focus-task-row-batch');
                const chunk = pending.slice(offset, offset + 100);
                const rows = await sql(`
                    SELECT
                        task.id,
                        task.markdown,
                        task.content AS raw_content,
                        task.parent_id,
                        task.root_id,
                        task.created,
                        task.updated,
                        COALESCE(doc.content, '') AS doc_name,
                        COALESCE(doc.hpath, '') AS doc_path,
                        COALESCE(parent.type, '') AS parent_type,
                        COALESCE(CASE WHEN list_parent.type = 'i' AND list_parent.subtype = 't' THEN list_parent.id ELSE '' END, '') AS parent_task_id,
                        0 AS parent_task_count,
                        '' AS first_task_id,
                        '' AS previous_sibling_id,
                        '' AS next_sibling_id
                    FROM blocks task
                    LEFT JOIN blocks doc ON doc.id = task.root_id
                    LEFT JOIN blocks parent ON parent.id = task.parent_id
                    LEFT JOIN blocks list_parent ON list_parent.id = parent.parent_id
                    WHERE task.id IN (${chunk.map((id) => `'${escapeSql(id)}'`).join(',')})
                        AND task.type = 'i' AND task.subtype = 't'
                `);
                rows.forEach((row) => {
                    const id = text(row.id);
                    if (!id) return;
                    result.set(id, row);
                    const parentID = text(row.parent_task_id);
                    if (parentID && !result.has(parentID)) next.push(parentID);
                });
            }
            frontier = uniqueStrings(next);
            depth += 1;
        }
        return result;
    }

    async function readFocusTaskAttrsBatch(taskIDs, attrNames = [], control = {}) {
        const result = new Map(uniqueStrings(taskIDs).map((id) => [id, {}]));
        const ids = Array.from(result.keys());
        const names = uniqueStrings(attrNames);
        if (!names.length) return result;
        for (let offset = 0; offset < ids.length; offset += 200) {
            assertFocusStatsDeadline(control, 'focus-task-attr-batch');
            const chunk = ids.slice(offset, offset + 200);
            const rows = await sql(`SELECT block_id, name, value FROM attributes WHERE block_id IN (${chunk.map((id) => `'${escapeSql(id)}'`).join(',')}) AND name IN (${names.map((name) => `'${escapeSql(name)}'`).join(',')})`);
            rows.forEach((row) => {
                const id = text(row.block_id);
                const name = text(row.name);
                if (result.has(id) && name) result.get(id)[name] = String(row.value == null ? '' : row.value);
            });
        }
        return result;
    }

    function focusTaskAttributeProjection(registry, customFieldID = '') {
        const fieldIDs = ['customStatus', 'priority', 'duration', 'tomatoEstimateCount'];
        if (customFieldID) fieldIDs.push(customFieldID);
        const fields = fieldIDs.map((fieldID) => registry?.byId?.get(fieldID)).filter(Boolean);
        return {
            attrNames: uniqueStrings(fields.flatMap((field) => [field.attr].concat(field.aliases || []))),
            fields,
        };
    }

    function decodeFocusTaskAttributes(attrs, projection, customFieldID = '') {
        const source = attrs && typeof attrs === 'object' ? attrs : {};
        const result = { customFieldValues: {} };
        (projection?.fields || []).forEach((field) => {
            const raw = uniqueStrings([field.attr].concat(field.aliases || []))
                .map((name) => own(source, name) ? String(source[name] == null ? '' : source[name]) : '')
                .find((value) => value !== '') || '';
            if (field.custom) {
                if (field.id === customFieldID) result.customFieldValues[field.id] = raw;
            } else if (field.type === 'boolean') result[field.id] = raw === '1' || raw === 'true';
            else if (field.type === 'number') result[field.id] = raw === '' ? null : Number(raw);
            else result[field.id] = raw;
        });
        return result;
    }

    function focusTaskDTOFromBatchRow(row, attrs, registry, fields, attrProjection, customFieldID) {
        const context = buildAttrContext(row);
        const dto = {
            id: text(row.id),
            title: taskOwnTitle(row),
            markdown: String(row.markdown || ''),
            done: parseDone(row.markdown),
            parentListID: text(row.parent_id),
            parentTaskID: text(row.parent_task_id),
            parentType: text(row.parent_type),
            documentID: text(row.root_id),
            documentName: text(row.doc_name),
            documentPath: text(row.doc_path),
            created: text(row.created),
            updated: text(row.updated),
            attrHostID: context.primaryHostID,
            attrHostState: context.state,
            priorityScore: null,
            ...decodeFocusTaskAttributes(attrs, attrProjection, customFieldID),
        };
        return projectTaskDTO(applyTaskDisplayNames(dto, registry), fields);
    }

    async function createKernelTaskResolver(options = {}) {
        const registry = await getFieldRegistry();
        const tasks = new Map();
        const candidates = new Map();
        const customFieldID = text(options?.groupBy) === 'customField'
            ? text(options?.customFieldID || options?.customFieldId)
            : '';
        const fields = ['created', 'customStatus', 'priority', 'duration', 'tomatoEstimateCount'];
        if (customFieldID) fields.push('customFieldValues');
        const attrProjection = focusTaskAttributeProjection(registry, customFieldID);
        const preload = async (candidateGroups, control = options) => {
            const groups = (Array.isArray(candidateGroups) ? candidateGroups : [])
                .map((group) => uniqueStrings(group))
                .filter((group) => group.length);
            const bindings = await resolveFocusBindingsBatch(groups, control);
            bindings.resolved.forEach((taskID, candidateID) => candidates.set(candidateID, taskID));
            const rows = await readFocusTaskRowsBatch(Array.from(bindings.taskIDs), control);
            const attrs = await readFocusTaskAttrsBatch(Array.from(rows.keys()), attrProjection.attrNames, control);
            rows.forEach((row, id) => {
                const ancestors = [];
                const seen = new Set([id]);
                let parentID = text(row.parent_task_id);
                while (parentID && !seen.has(parentID) && ancestors.length < 200) {
                    seen.add(parentID);
                    ancestors.unshift(parentID);
                    parentID = text(rows.get(parentID)?.parent_task_id);
                }
                const dto = focusTaskDTOFromBatchRow(row, attrs.get(id), registry, fields, attrProjection, customFieldID);
                tasks.set(id, normalizeSemanticTask(dto, ancestors));
            });
        };
        const loadTask = async (taskID) => {
            const id = text(taskID);
            if (!id) return null;
            if (tasks.has(id)) return tasks.get(id);
            assertFocusStatsDeadline(options, 'focus-task-load');
            let task = null;
            try {
                const [dto, context] = await Promise.all([
                    taskDTO(id, fields, registry),
                    readTaskTreeContext(id),
                ]);
                task = normalizeSemanticTask({
                    ...dto,
                    parentTaskID: context.parentTaskID,
                }, context.ancestorTaskIDs);
            } catch (e) {}
            tasks.set(id, task);
            return task;
        };
        return {
            snapshot: null,
            preload,
            async resolve(candidateIDs) {
                const ids = uniqueStrings(candidateIDs);
                const missing = ids.filter((candidate) => !candidates.has(candidate));
                if (missing.length) await preload([missing], options);
                for (const candidate of ids) {
                    const cachedID = candidates.get(candidate);
                    if (cachedID && tasks.has(cachedID)) return tasks.get(cachedID);
                }
                return null;
            },
            get: loadTask,
        };
    }

    function makeFocusAggregate() {
        return {
            focusSec: 0,
            countdownSec: 0,
            stopwatchSec: 0,
            distractionCount: 0,
            sessionCount: 0,
            focusSessionCount: 0,
            completedSessionCount: 0,
            countdownSessionCount: 0,
            stopwatchSessionCount: 0,
            lastEndMs: 0,
            buckets: new Map(),
        };
    }

    function mergeFocusStats(target, source) {
        target.focusSec += Number(source?.focusSec) || 0;
        target.countdownSec += Number(source?.countdownSec) || 0;
        target.stopwatchSec += Number(source?.stopwatchSec) || 0;
        target.distractionCount += Math.max(0, Number(source?.distractionCount) || 0);
        target.sessionCount += Math.max(0, Number(source?.sessionCount) || 0);
        target.focusSessionCount += Math.max(0, Number(source?.focusSessionCount) || 0);
        target.completedSessionCount += Math.max(0, Number(source?.completedSessionCount) || 0);
        target.countdownSessionCount += Math.max(0, Number(source?.countdownSessionCount) || 0);
        target.stopwatchSessionCount += Math.max(0, Number(source?.stopwatchSessionCount) || 0);
        target.lastEndMs = Math.max(target.lastEndMs, Number(source?.lastEndMs) || 0);
        (Array.isArray(source?.buckets) ? source.buckets : []).forEach((bucket) => {
            const key = text(bucket?.key);
            if (!key) return;
            if (!target.buckets.has(key)) target.buckets.set(key, { key, from: bucket.from, to: bucket.to, ...makeFocusAggregate() });
            mergeFocusStats(target.buckets.get(key), { ...bucket, buckets: [] });
        });
        return target;
    }

    function serializeFocusAggregate(value) {
        return {
            focusSec: value.focusSec,
            countdownSec: value.countdownSec,
            stopwatchSec: value.stopwatchSec,
            distractionCount: value.distractionCount,
            sessionCount: value.sessionCount,
            focusSessionCount: value.focusSessionCount,
            countdownSessionCount: value.countdownSessionCount,
            stopwatchSessionCount: value.stopwatchSessionCount,
            completedSessionCount: value.completedSessionCount,
            lastEndMs: value.lastEndMs,
            buckets: Array.from(value.buckets.values()).map((bucket) => ({
                key: bucket.key,
                from: bucket.from,
                to: bucket.to,
                ...serializeFocusAggregate({ ...bucket, buckets: new Map() }),
            })),
        };
    }

    function taskMatchesFocusScope(task, scope, taskIDs, documentIDs) {
        if (!scope) return true;
        if (!scope.taskIDs.length && !scope.documentIDs.length) return false;
        if (scope.scopeMode === 'documents' && scope.documentIDs.length) return documentIDs.has(task.documentID);
        if (scope.taskIDs.length) return taskIDs.has(task.id);
        if (scope.documentIDs.length) return documentIDs.has(task.documentID);
        return true;
    }

    function classificationValues(task, options, resolverTasks) {
        const groupBy = text(options?.groupBy || 'task');
        if (groupBy === 'document') return [{ id: task.documentID || '__unset', label: task.documentName || '未命名文档' }];
        if (groupBy === 'status') return [{ id: task.customStatus || '__unset', label: task.customStatusName || task.customStatus || '未设置' }];
        if (groupBy === 'priority') return [{ id: task.priority || 'none', label: task.priorityName || resolvePriorityName(task.priority) }];
        if (groupBy === 'customField') {
            const fieldID = text(options?.customFieldID || options?.customFieldId);
            const raw = task.customFieldValues?.[fieldID];
            const values = Array.isArray(raw) ? raw : (text(raw) ? [raw] : []);
            return values.length
                ? uniqueStrings(values).map((value) => ({ id: value, label: value }))
                : [{ id: '__unset', label: '未设置' }];
        }
        if (groupBy === 'parent') {
            const parentID = task.parentTaskID || task.id;
            const parent = resolverTasks.get(parentID);
            return [{ id: parentID, label: parent?.title || (parentID === task.id ? task.title : '父任务') }];
        }
        return [{ id: task.id, label: task.title }];
    }

    async function projectFocusStatistics(rawStats, input = {}, snapshotValue = null) {
        if (Number(rawStats?.contractVersion) !== FOCUS_STATS_CONTRACT_VERSION) {
            throw new DomainError(ERROR.UNSUPPORTED, '番茄统计数据契约不兼容');
        }
        const source = input && typeof input === 'object' ? input : {};
        assertFocusStatsDeadline(source, 'task-projection-start');
        const hasExplicitScope = !!text(source.scopeToken)
            || Object.prototype.hasOwnProperty.call(source, 'taskIDs')
            || Object.prototype.hasOwnProperty.call(source, 'taskIds')
            || Object.prototype.hasOwnProperty.call(source, 'documentIDs')
            || Object.prototype.hasOwnProperty.call(source, 'documentIds');
        const scope = hasExplicitScope ? normalizeTaskScope(source) : null;
        const scopeTaskIDs = new Set(scope?.taskIDs || []);
        const scopeDocumentIDs = new Set(scope?.documentIDs || []);
        const resolver = snapshotValue ? createCompositeTaskResolver(snapshotValue, source) : await createKernelTaskResolver(source);
        const taskAggregates = new Map();
        const taskObjects = new Map();
        const unattributed = makeFocusAggregate();
        const associations = Array.isArray(rawStats?.associations) ? rawStats.associations : [];
        await resolver.preload(associations.map((association) => association?.candidateIds || []), source);
        assertFocusStatsDeadline(source, 'task-projection-preloaded');

        for (let associationIndex = 0; associationIndex < associations.length; associationIndex += 1) {
            if (associationIndex % 128 === 0) assertFocusStatsDeadline(source, 'task-projection-scan');
            const association = associations[associationIndex];
            const task = await resolver.resolve(association?.candidateIds || []);
            if (!task || !taskMatchesFocusScope(task, scope, scopeTaskIDs, scopeDocumentIDs)) {
                if (!scope && (!task || !(association?.candidateIds || []).length)) mergeFocusStats(unattributed, association);
                continue;
            }
            taskObjects.set(task.id, task);
            if (!taskAggregates.has(task.id)) taskAggregates.set(task.id, makeFocusAggregate());
            mergeFocusStats(taskAggregates.get(task.id), association);
            for (const ancestorID of task.ancestorTaskIDs) {
                if (!taskObjects.has(ancestorID)) {
                    const ancestor = await resolver.get(ancestorID);
                    if (ancestor) taskObjects.set(ancestorID, ancestor);
                }
            }
        }

        const total = makeFocusAggregate();
        taskAggregates.forEach((aggregate) => mergeFocusStats(total, serializeFocusAggregate(aggregate)));
        if (!scope) mergeFocusStats(total, serializeFocusAggregate(unattributed));

        const tasks = Array.from(taskAggregates.entries()).map(([taskID, aggregate]) => ({
            ...taskObjects.get(taskID),
            ...serializeFocusAggregate(aggregate),
        })).sort((a, b) => b.lastEndMs - a.lastEndMs || b.focusSec - a.focusSec);

        const classification = new Map();
        tasks.forEach((task) => {
            classificationValues(task, source, taskObjects).forEach((item) => {
                if (!classification.has(item.id)) classification.set(item.id, { id: item.id, label: item.label, aggregate: makeFocusAggregate() });
                mergeFocusStats(classification.get(item.id).aggregate, task);
            });
        });

        let parentDetail = null;
        const rootTaskID = text(source.rootTaskID || source.rootTaskId);
        if (rootTaskID) {
            const self = taskAggregates.get(rootTaskID) || makeFocusAggregate();
            const descendants = makeFocusAggregate();
            tasks.filter((task) => task.id !== rootTaskID && task.ancestorTaskIDs.includes(rootTaskID))
                .forEach((task) => mergeFocusStats(descendants, task));
            const combined = makeFocusAggregate();
            mergeFocusStats(combined, serializeFocusAggregate(self));
            mergeFocusStats(combined, serializeFocusAggregate(descendants));
            parentDetail = {
                taskID: rootTaskID,
                self: serializeFocusAggregate(self),
                descendants: serializeFocusAggregate(descendants),
                combined: serializeFocusAggregate(combined),
            };
        }
        assertFocusStatsDeadline(source, 'task-projection-complete');

        return {
            contractVersion: FOCUS_STATS_CONTRACT_VERSION,
            range: rawStats.range,
            totals: serializeFocusAggregate(total),
            tasks,
            unattributed: serializeFocusAggregate(unattributed),
            classification: Array.from(classification.values()).map((item) => ({
                id: item.id,
                label: item.label,
                ...serializeFocusAggregate(item.aggregate),
            })).sort((a, b) => b.focusSec - a.focusSec),
            parentDetail,
            meta: {
                ...(rawStats.meta || {}),
                taskSnapshotRevision: resolver.snapshot?.revision || 0,
                taskScope: scope ? taskScopeCoverage(scope) : null,
            },
        };
    }

    async function queryFocusStatistics(input, snapshotValue = null) {
        const options = withFocusStatsDeadline(input);
        const candidateIDs = await resolveFocusCandidateIDs(options);
        const dockOptions = { ...options };
        if (candidateIDs !== null) {
            dockOptions.candidateIDs = candidateIDs;
            dockOptions.candidateIDsConstrainTotals = true;
        }
        assertFocusStatsDeadline(options, 'before-dock-query');
        const raw = await queryDockTomatoFocusStats(dockOptions);
        assertFocusStatsDeadline(options, 'after-dock-query');
        return projectFocusStatistics(raw, options, snapshotValue);
    }

    function withDefaultStatisticsRange(input) {
        const source = input && typeof input === 'object' ? { ...input } : {};
        const to = text(source.to) || new Date().toISOString();
        const toMs = Date.parse(to);
        if (!Number.isFinite(toMs)) throw new DomainError(ERROR.INVALID_ARGUMENT, 'to 不是有效时间');
        const from = text(source.from) || new Date(toMs - 30 * 86400000).toISOString();
        const fromMs = Date.parse(from);
        if (!Number.isFinite(fromMs) || toMs <= fromMs) throw new DomainError(ERROR.INVALID_ARGUMENT, 'from/to 必须构成有效时间范围');
        return { ...source, from, to };
    }

    async function queryAgentFocusStatistics(input) {
        requireAction(input, 'query');
        return queryFocusStatistics(withDefaultStatisticsRange(input));
    }

    async function queryAgentRoutineStatistics(input) {
        requireAction(input, 'query');
        return queryDockTomatoRoutineStats(withDefaultStatisticsRange(input));
    }

    async function listAgentFocusSessions(input) {
        requireAction(input, 'query');
        const options = withFocusStatsDeadline(withDefaultStatisticsRange(input));
        const result = await listDockTomatoSessions(options);
        assertFocusStatsDeadline(options, 'focus-session-projection-start');
        const resolver = await createKernelTaskResolver(options);
        const items = [];
        const resultItems = Array.isArray(result?.items) ? result.items : [];
        await resolver.preload(resultItems.map((item) => item?.candidateIds || []), options);
        for (let itemIndex = 0; itemIndex < resultItems.length; itemIndex += 1) {
            if (itemIndex % 128 === 0) assertFocusStatsDeadline(options, 'focus-session-projection-scan');
            const item = resultItems[itemIndex];
            const task = await resolver.resolve(item?.candidateIds || []);
            items.push({
                ...item,
                task: task ? {
                    id: task.id,
                    title: task.title,
                    documentID: task.documentID,
                    documentName: task.documentName,
                } : null,
            });
        }
        return { ...result, items };
    }

    async function aggregateTaskStats(input) {
        const source = input && typeof input === 'object' ? input : {};
        const scope = normalizeTaskScope(source);
        const completed = await getCompletedTaskRows(source);
        const rows = completed.rows;
        const period = ['day', 'week', 'month', 'year'].includes(text(source.period)) ? text(source.period) : 'month';
        return {
            totalCompleted: rows.length,
            period,
            trend: countBy(rows.filter((row) => text(row.completed_at)), (row) => periodKey(row.completed_at, period)).sort((a, b) => a.key.localeCompare(b.key)),
            byDocument: countBy(rows, (row) => row.doc_name || row.root_id),
            byStatus: countByLabeled(rows, (row) => row.custom_status, (value) => resolveStatusName(value, completed.registry)),
            byPriority: countByLabeled(rows, (row) => row.priority, resolvePriorityName),
            byCustomField: completed.customFields.map(({ field, alias }) => ({
                fieldID: field.id,
                label: text(field.label || field.name) || field.id,
                ...customFieldBreakdown(rows, field, alias),
            })),
            coverage: {
                from: text(source.from),
                to: text(source.to),
                completedInScope: completed.completedInScope,
                missingCompletionTime: completed.missingCompletionTime,
                source: 'done+taskCompleteAt',
                ...taskScopeCoverage(scope),
            },
            customFieldDefinitions: customFieldDefinitions(completed.registry),
            statusDefinitions: statusDefinitions(completed.registry),
            priorityDefinitions: priorityDefinitions(),
        };
    }

    function parseDurationMinutes(value) {
        const raw = text(value).toLowerCase();
        if (!raw) return null;
        if (/^\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
        let minutes = 0;
        const hour = raw.match(/(\d+(?:\.\d+)?)\s*(?:h|hour|小时)/);
        const minute = raw.match(/(\d+(?:\.\d+)?)\s*(?:m|min|分钟)/);
        if (hour) minutes += Number(hour[1]) * 60;
        if (minute) minutes += Number(minute[1]);
        return minutes > 0 ? minutes : null;
    }

    async function aggregateTimeUsage(input) {
        const source = input && typeof input === 'object' ? input : {};
        const scope = normalizeTaskScope(source);
        const effectiveTo = text(source.to) || new Date().toISOString();
        const effectiveToMs = Date.parse(effectiveTo);
        if (!Number.isFinite(effectiveToMs)) throw new DomainError(ERROR.INVALID_ARGUMENT, 'to 不是有效时间');
        const effectiveFrom = text(source.from) || new Date(effectiveToMs - 30 * 86400000).toISOString();
        const effectiveFromMs = Date.parse(effectiveFrom);
        if (!Number.isFinite(effectiveFromMs) || !Number.isFinite(effectiveToMs) || effectiveToMs <= effectiveFromMs) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, 'from/to 必须构成有效时间范围');
        }
        const registry = await getFieldRegistry();
        const durationField = registry.byId.get('duration');
        const estimateExpr = completionAttrExpression([durationField.attr].concat(durationField.aliases || []));
        const taskConditions = ["t.type = 'i'", "t.subtype = 't'"];
        appendTaskScopeConditions(taskConditions, scope, 't');
        const rows = await sql(`SELECT t.id, ${estimateExpr} AS estimate FROM blocks t WHERE ${taskConditions.join(' AND ')}`);
        let estimatedMinutes = 0;
        let estimateAvailable = 0;
        rows.forEach((row) => {
            const estimate = parseDurationMinutes(row.estimate);
            if (estimate != null) { estimatedMinutes += estimate; estimateAvailable += 1; }
        });
        const scopedTaskIDs = new Set(rows.map((row) => text(row.id)).filter(Boolean));
        const scopeRestricted = scope.tokenBacked || scope.taskIDs.length > 0 || scope.documentIDs.length > 0;
        const schedules = (await loadSchedules()).filter((item) => {
            if (scopeRestricted && !scopedTaskIDs.has(text(item.taskId || item.task_id || item.linkedTaskId))) return false;
            const startMs = Date.parse(item.start);
            const endMs = Date.parse(item.end);
            if (Number.isFinite(endMs) && endMs <= effectiveFromMs) return false;
            if (Number.isFinite(startMs) && startMs >= effectiveToMs) return false;
            return true;
        });
        let plannedMinutes = 0;
        let plannedAvailable = 0;
        schedules.forEach((item) => {
            let minutes = Number(item.plannedMinutes);
            if (!Number.isFinite(minutes) || minutes <= 0) {
                const start = Date.parse(item.start);
                const end = Date.parse(item.end);
                minutes = Number.isFinite(start) && Number.isFinite(end) && end > start ? (end - start) / 60000 : NaN;
            }
            if (Number.isFinite(minutes) && minutes > 0) { plannedMinutes += minutes; plannedAvailable += 1; }
        });
        const focusScope = scope.scopeMode === 'documents' && scope.documentIDs.length
            ? { documentIDs: scope.documentIDs }
            : (scope.taskIDs.length ? { taskIDs: scope.taskIDs } : (scope.documentIDs.length ? { documentIDs: scope.documentIDs } : {}));
        let actual;
        try {
            const focusStats = await queryFocusStatistics({
                from: effectiveFrom,
                to: effectiveTo,
                bucket: 'none',
                groupBy: 'task',
                ...focusScope,
            });
            const actualMinutes = Math.max(0, Number(focusStats?.totals?.focusSec) || 0) / 60;
            const actualAvailable = Array.isArray(focusStats?.tasks) ? focusStats.tasks.length : 0;
            actual = {
                minutes: Math.round(actualMinutes),
                availableCount: actualAvailable,
                missingCount: Math.max(0, rows.length - actualAvailable),
                available: true,
                source: 'docktomato-history',
            };
        } catch (error) {
            actual = {
                minutes: 0,
                availableCount: 0,
                missingCount: rows.length,
                available: false,
                source: 'docktomato-history',
                errorCode: text(error?.code) || ERROR.STORAGE_ERROR,
            };
        }
        return {
            estimated: { minutes: Math.round(estimatedMinutes), availableCount: estimateAvailable, missingCount: rows.length - estimateAvailable, available: estimateAvailable > 0 },
            planned: { minutes: Math.round(plannedMinutes), availableCount: plannedAvailable, missingCount: schedules.length - plannedAvailable, available: plannedAvailable > 0 },
            actual,
            coverage: { from: effectiveFrom, to: effectiveTo, ...taskScopeCoverage(scope) },
        };
    }

    async function undoLastMutation(input) {
        const undo = state.lastUndo;
        if (!undo || (input && text(input.undoID) && text(input.undoID) !== undo.id)) throw new DomainError(ERROR.NOT_FOUND, '没有可撤销的操作');
        if (typeof undo.verify === 'function' && !(await undo.verify())) {
            state.lastUndo = null;
            state.undoRecords.delete(undo.id);
            throw new DomainError(ERROR.CONFLICT, '相关任务或日程已被其他操作修改，撤销已取消');
        }
        state.lastUndo = null;
        state.undoRecords.delete(undo.id);
        (Array.isArray(undo.childUndoIDs) ? undo.childUndoIDs : []).forEach((id) => state.undoRecords.delete(id));
        try {
            const data = await undo.execute();
            return { undoID: undo.id, label: undo.label, data };
        } catch (error) {
            throw new DomainError(text(error && error.code) || ERROR.STORAGE_ERROR, text(error && error.message) || '撤销执行失败', {
                ...(error && error.details && typeof error.details === 'object' ? error.details : {}),
                undoConsumed: true,
            });
        }
    }

    function objectSchema(properties, required) {
        return { type: 'object', properties: properties || {}, required: required || [], additionalProperties: false };
    }

    function stringSchema(description, values) {
        const schema = { type: 'string', description: description || '' };
        if (Array.isArray(values)) schema.enum = values;
        return schema;
    }

    function normalizeMcpTools(value) {
        const source = value && typeof value === 'object' ? value : {};
        const normalized = Object.create(null);
        for (const name of MCP_TOOL_NAMES) normalized[name] = source[name] !== false;
        return normalized;
    }

    function isMcpToolEnabled(name) {
        return MCP_TOOL_NAMES.includes(name) && state.mcpTools[name] !== false;
    }

    function getMcpToolGroup(groupID) {
        const id = text(groupID);
        return MCP_TOOL_GROUPS.find((group) => group.id === id) || null;
    }

    function validateMcpToolCatalog(definitions) {
        const definedNames = new Set((Array.isArray(definitions) ? definitions : []).map((definition) => definition[0]));
        const configuredNames = new Set(MCP_TOOL_NAMES);
        const missingGroup = Array.from(definedNames).filter((name) => !configuredNames.has(name));
        const missingDefinition = Array.from(configuredNames).filter((name) => !definedNames.has(name));
        if (missingGroup.length || missingDefinition.length || configuredNames.size !== MCP_TOOL_NAMES.length) {
            throw new DomainError(ERROR.STORAGE_ERROR, '任务工具分组定义不完整', { missingGroup, missingDefinition });
        }
    }

    function agentCapabilityConfig(name, definition) {
        const config = {
            title: definition[1],
            description: `任务管理器插件：${definition[1]}`,
            inputSchema: definition[2],
        };
        const actionEffects = MCP_ACTION_EFFECTS[name];
        if (actionEffects) config.actionEffects = actionEffects;
        else config.effects = MCP_READ_ONLY_TOOLS.has(name) ? { localRead: true } : { localWrite: true };
        return config;
    }

    function mcpToolRuntime() {
        const agent = siyuan?.agent;
        if (typeof agent?.registerCapability === 'function' && typeof agent?.unregisterCapability === 'function') {
            return {
                kind: 'agent',
                register: (name, definition, handler) => agent.registerCapability(name, agentCapabilityConfig(name, definition), handler),
                unregister: (name) => agent.unregisterCapability(name),
            };
        }
        const legacy = siyuan?.mcp;
        if (typeof legacy?.registerTool === 'function' && typeof legacy?.unregisterTool === 'function') {
            return {
                kind: 'mcp',
                register: (name, definition, handler) => legacy.registerTool(name, {
                    title: definition[1],
                    description: `任务管理器插件：${definition[1]}`,
                    inputSchema: definition[2],
                    readOnly: MCP_READ_ONLY_TOOLS.has(name),
                }, handler),
                unregister: (name) => legacy.unregisterTool(name),
            };
        }
        return null;
    }

    function requireMcpOperationTools(domain, operations) {
        const toolMap = domain === 'schedules'
            ? { create: 'create_schedule', update: 'update_schedule', delete: 'delete_schedule' }
            : { create: 'create_task', update: 'update_task', move: 'move_task', delete: 'delete_task' };
        const disabled = new Set();
        const items = Array.isArray(operations) ? operations : [];
        for (let index = 0; index < items.length; index += 1) {
            const kind = operationKind(domain, items[index], index);
            const toolName = toolMap[kind];
            if (toolName && !isMcpToolEnabled(toolName)) disabled.add(toolName);
        }
        if (disabled.size) {
            throw new DomainError(ERROR.UNSUPPORTED, '批量操作包含已在设置中关闭的工具', { tools: Array.from(disabled) });
        }
    }

    function toolDefinitions() {
        const anyObject = { type: 'object', additionalProperties: true };
        const taskDateRange = objectSchema({
            field: stringSchema('日期字段', ['taskSpan', 'startDate', 'completionTime', 'taskCompleteAt']),
            from: stringSchema('起始日期 YYYY-MM-DD'),
            to: stringSchema('结束日期 YYYY-MM-DD'),
            mode: stringSchema('taskSpan 匹配方式', ['overlap', 'within']),
        }, ['field']);
        const taskQueryFilters = objectSchema({
            scopeToken: stringSchema('当前任务视图范围令牌'),
            ids: { type: 'array', items: { type: 'string' } },
            documentIDs: { type: 'array', items: { type: 'string' } },
            keyword: { type: 'string' },
            done: { type: 'boolean' },
            dateRange: taskDateRange,
            overdue: { type: 'boolean' },
            priorities: { type: 'array', items: { type: 'string' }, maxItems: 50 },
            customStatuses: { type: 'array', description: '状态 ID；可从 statusDefinitions 读取 ID 与中文状态名映射', items: { type: 'string' }, maxItems: 50 },
            includeVirtual: { type: 'boolean' },
        });
        const taskFields = {
            type: 'array',
            description: '返回字段投影；省略则返回全部。priority 与 customStatus 是稳定 ID，并分别配套中文 priorityName、customStatusName；completionTime=截止日期，taskCompleteAt=完成时间，priorityScore=加权分数，duration=预估时长，tomatoEstimateCount=预计番茄；循环任务的 tomatoCount/tomatoMinutes/tomatoHours 表示当前轮或历史当次专注，其他任务表示累计实际专注；attachments=附件，customFieldValues=自定义列。',
            items: { type: 'string', enum: TASK_READ_FIELDS },
        };
        const readAction = stringSchema('只读操作', ['get']);
        const listAction = stringSchema('只读操作', ['list']);
        const queryAction = stringSchema('只读操作', ['query']);
        const reminderFollow = objectSchema({
            date: stringSchema('从用户提醒要求直接解析的唯一日期 YYYY-MM-DD；今天/今晚必须使用当日，明天/明晚才使用次日；执行时同时写入任务截止日期，禁止另行询问或提供其他日期候选'),
            times: { type: 'array', items: stringSchema('HH:mm'), minItems: 1, maxItems: 12 },
        }, ['date', 'times']);
        const reminderSchedule = objectSchema({
            startDate: stringSchema('开始日期 YYYY-MM-DD'),
            endDate: stringSchema('可选结束日期 YYYY-MM-DD'),
            times: { type: 'array', items: stringSchema('HH:mm'), minItems: 1, maxItems: 12 },
            interval: stringSchema('重复方式', REMINDER_INTERVALS),
            every: { type: 'integer', minimum: 1, maximum: 365 },
            monthlyMode: stringSchema('月重复方式', ['date', 'weekday']),
            calendarMode: stringSchema('历法', ['solar', 'lunar']),
        }, ['startDate', 'times', 'interval']);
        const agentScheduleRule = objectSchema({
            kind: stringSchema('运行方式', AGENT_SCHEDULE_KINDS),
            date: stringSchema('单次运行日期 YYYY-MM-DD'),
            weekday: { type: 'integer', minimum: 0, maximum: 6 },
            time: stringSchema('运行时间 HH:mm'),
        }, ['kind', 'time']);
        const agentScheduleConfig = objectSchema({
            name: stringSchema('定时任务名称'),
            prompt: stringSchema('到点后交给智能体执行的指令'),
            enabled: { type: 'boolean' },
            condition: stringSchema('运行条件', ['always', 'today_has_completed_tasks']),
            schedule: agentScheduleRule,
            output: objectSchema({
                mode: stringSchema('输出方式：notification=通知展示，document=写入指定文档，daily_note=写入今天日记', ['notification', 'document', 'daily_note']),
                documentId: stringSchema('写入文档 ID'),
                documentMode: stringSchema('文档组织方式', ['target', 'monthly_child']),
                insertPosition: stringSchema('插入位置', ['bottom', 'top']),
            }),
        });
        const scheduleMutableFields = {
            taskId: stringSchema('可选真实任务、任务子块或循环虚拟实例 ID'),
            title: { type: 'string' },
            start: { type: 'string' },
            end: { type: 'string' },
            allDay: { type: 'boolean' },
            calendarId: { type: 'string' },
            color: { type: 'string' },
            plannedMinutes: { type: 'number' },
            reminderMode: stringSchema('inherit=继承全局日程提醒，custom=使用本日程提醒设置', SCHEDULE_REMINDER_MODES),
            reminderEnabled: { type: 'boolean', description: 'reminderMode=custom 时启用或关闭本日程提醒' },
            reminderOffsetMin: { type: 'integer', description: 'reminderMode=custom 时提前提醒分钟数，仅支持 0、5、10、15、30、60', minimum: 0, maximum: 60 },
        };
        const schedulePatch = objectSchema(scheduleMutableFields);
        const taskOperationKinds = ['create', 'update', 'move', 'delete'];
        const scheduleOperationKinds = ['create', 'update', 'delete'];
        const taskOperation = objectSchema({
            kind: stringSchema('规范操作类型', taskOperationKinds),
            action: stringSchema('兼容操作类型；patch 等价于 update', taskOperationKinds.concat('patch')),
            type: stringSchema('兼容操作类型；patch 等价于 update', taskOperationKinds.concat('patch')),
            taskID: stringSchema('更新、移动或删除的任务 ID'),
            title: stringSchema('创建任务时的标题'),
            documentID: stringSchema('创建或移动任务时的目标文档 ID'),
            parentTaskID: stringSchema('创建任务时的可选父任务 ID'),
            patch: anyObject,
            parentID: stringSchema('移动任务时的目标文档、列表或父任务 ID'),
            previousID: stringSchema('移动到该块之后'),
            nextID: stringSchema('移动到该任务之前'),
        });
        const scheduleOperation = objectSchema({
            kind: stringSchema('规范操作类型', scheduleOperationKinds),
            action: stringSchema('兼容操作类型', scheduleOperationKinds),
            type: stringSchema('兼容操作类型', scheduleOperationKinds),
            id: stringSchema('更新日程时的日程 ID'),
            scheduleID: stringSchema('删除日程时的日程 ID'),
            scopeToken: stringSchema('关联循环虚拟实例时必填的当前任务范围令牌'),
            ...scheduleMutableFields,
            patch: schedulePatch,
        });
        const taskOperations = { type: 'array', items: taskOperation };
        const scheduleOperations = { type: 'array', items: scheduleOperation };
        return [
            ['list_task_scopes', '列出任务范围', objectSchema({ action: listAction }, ['action']), async () => listTaskScopes()],
            ['get_task', '读取完整任务字段；返回 customFieldValues 时同时返回含父级、路径和归档状态的 customFieldDefinitions；循环虚拟任务只读且必须提供 scopeToken', objectSchema({ action: readAction, taskID: stringSchema('任务、子块或循环虚拟任务 ID'), scopeToken: stringSchema('读取当前视图或循环虚拟任务的范围令牌'), fields: taskFields }, ['action', 'taskID']), async (args) => getTaskDTOByReference(args.taskID, args.fields, args.scopeToken)],
            ['query_tasks', '在任务范围内按完成、日期、逾期、优先级和状态分页查询；省略 fields 返回全部字段；返回 customFieldValues 时同时返回含父级、路径和归档状态的 customFieldDefinitions', objectSchema({ action: queryAction, filters: taskQueryFilters, fields: taskFields, limit: { type: 'integer', minimum: 1, maximum: 200 }, cursor: { type: 'string' } }, ['action']), queryTaskRows],
            ['create_task', '直接在文档或父任务下创建单个任务，无需预览；未指定位置时使用对话提供的插件默认新建位置', objectSchema({ action: stringSchema('直接创建', ['create']), title: stringSchema('任务标题'), documentID: stringSchema('目标文档块 ID'), parentTaskID: stringSchema('可选父任务 ID，提供时优先于 documentID'), patch: anyObject }, ['action', 'title']), async (args) => { requireAction(args, 'create'); return createTask(args); }],
            ['update_task', '更新任务字段', objectSchema({ action: stringSchema('写操作', ['update']), taskID: { type: 'string' }, patch: anyObject }, ['action', 'taskID', 'patch']), async (args) => { requireAction(args, 'update'); return applyTaskPatch(args.taskID, args.patch); }],
            ['configure_task_reminder', '单次直接配置跟随任务或独立提醒；应先用 query_tasks 检索已有任务并在明确匹配时传入 taskID；没有绑定任务时使用 taskTitle 在全部任务中先精确、再按可见标题模糊匹配，允许少量错字并优先绑定未完成项，找不到才使用插件默认新建位置 documentID 自动创建任务并立即设置提醒，不要先调用 create_task；跟随任务提醒同时设置截止日期并默认同步完成任务；提醒类型未明确时必须先用 question 选择类型', objectSchema({
                action: stringSchema('直接写入', ['apply']),
                operation: stringSchema('提醒操作', ['set', 'clear']),
                taskID: stringSchema('已有任务或任务子块 ID；没有绑定任务时省略'),
                taskTitle: stringSchema('没有绑定任务时创建的任务标题'),
                documentID: stringSchema('全局没有同名任务、需要新建时使用的插件默认新建文档 ID'),
                mode: stringSchema('提醒模式', ['follow_task', 'independent']),
                follow: reminderFollow,
                schedule: reminderSchedule,
            }, ['action', 'operation']), configureTaskReminder],
            ['manage_agent_schedules', '管理 AI 定时任务；提醒类型未明确时必须先用 question 让用户选择 AI 定时任务、跟随任务提醒或独立提醒', objectSchema({
                action: stringSchema('操作', ['list', 'create', 'update', 'delete']),
                scheduleID: stringSchema('AI 定时任务 ID'),
                event: agentScheduleConfig,
                patch: agentScheduleConfig,
            }, ['action']), manageAgentSchedules],
            ['move_task', '移动任务并验证目标块类型', objectSchema({ action: stringSchema('写操作', ['move']), taskID: stringSchema('真实任务 ID'), parentID: stringSchema('目标文档、列表或父任务 ID'), documentID: stringSchema('目标文档块 ID'), previousID: stringSchema('移动到该块之后'), nextID: stringSchema('移动到该任务之前') }, ['action', 'taskID']), async (args) => { requireAction(args, 'move'); return moveTask(args); }],
            ['delete_task', '预览或删除任务', objectSchema({ action: stringSchema('预览只读，执行为删除', ['get', 'delete']), phase: stringSchema('阶段', ['preview', 'execute']), taskID: { type: 'string' }, previewToken: { type: 'string' } }, ['action', 'phase', 'taskID']), async (args) => {
                requirePhaseAction(args, 'delete');
                return args.phase === 'preview' ? previewTaskDelete(args.taskID) : executeTaskDelete(args.taskID, args.previewToken);
            }],
            ['batch_tasks', '批量执行任务操作；每项使用 kind，兼容 action/type', objectSchema({ action: stringSchema('预览只读，执行为写入', ['get', 'apply']), phase: stringSchema('阶段', ['preview', 'execute']), operations: taskOperations, previewToken: { type: 'string' } }, ['action', 'phase', 'operations']), async (args) => {
                requirePhaseAction(args, 'apply');
                requireMcpOperationTools('tasks', args.operations);
                return (await guardOperationPreview('tasks', args.operations, args.phase, args.previewToken)) || executeTaskOperations(args.operations);
            }],
            ['query_schedules', '查询日程；filters.taskIDs 可包含循环虚拟实例 ID', objectSchema({ action: queryAction, filters: anyObject, limit: { type: 'integer', minimum: 1, maximum: 500 } }, ['action']), querySchedules],
            ['create_schedule', '创建日程；提醒未指定时继承全局设置；可关联真实任务，或使用当前 scopeToken 关联只读循环虚拟实例', objectSchema({ action: stringSchema('写操作', ['create']), scopeToken: stringSchema('关联循环虚拟实例时必填的当前任务范围令牌'), ...scheduleMutableFields }, ['action', 'start', 'end']), async (args) => { requireAction(args, 'create'); return createSchedule(args); }],
            ['update_schedule', '更新日程及单条日程提醒；重新关联循环虚拟实例时必须提供当前 scopeToken', objectSchema({ action: stringSchema('写操作', ['update']), id: { type: 'string' }, scopeToken: stringSchema('重新关联循环虚拟实例时必填的当前任务范围令牌'), patch: schedulePatch }, ['action', 'id', 'patch']), async (args) => { requireAction(args, 'update'); return updateSchedule(args); }],
            ['delete_schedule', '预览或删除日程', objectSchema({ action: stringSchema('预览只读，执行为删除', ['get', 'delete']), phase: stringSchema('阶段', ['preview', 'execute']), scheduleID: { type: 'string' }, previewToken: { type: 'string' } }, ['action', 'phase', 'scheduleID']), async (args) => {
                requirePhaseAction(args, 'delete');
                return args.phase === 'preview' ? previewScheduleDelete(args.scheduleID) : executeScheduleDelete(args.scheduleID, args.previewToken);
            }],
            ['batch_schedules', '批量执行日程操作；每项使用 kind，兼容 action/type；关联循环虚拟实例的 create/update 操作各自携带当前 scopeToken', objectSchema({ action: stringSchema('预览只读，执行为写入', ['get', 'apply']), phase: stringSchema('阶段', ['preview', 'execute']), operations: scheduleOperations, previewToken: { type: 'string' } }, ['action', 'phase', 'operations']), async (args) => {
                requirePhaseAction(args, 'apply');
                requireMcpOperationTools('schedules', args.operations);
                return (await guardOperationPreview('schedules', args.operations, args.phase, args.previewToken)) || executeScheduleOperations(args.operations);
            }],
            ['apply_task_operation_plan', '协调任务与日程操作；每项使用 kind，兼容 action/type；关联循环虚拟实例的日程操作各自携带当前 scopeToken', objectSchema({ action: stringSchema('写操作', ['apply']), taskOperations, scheduleOperations }, ['action']), async (args) => {
                requireAction(args, 'apply');
                const taskOperations = Array.isArray(args.taskOperations) ? args.taskOperations : [];
                const scheduleOperations = Array.isArray(args.scheduleOperations) ? args.scheduleOperations : [];
                if (taskOperations.length + scheduleOperations.length > 50) throw new DomainError(ERROR.INVALID_ARGUMENT, '组合操作最多 50 项');
                if (operationsHaveDelete('tasks', taskOperations) || operationsHaveDelete('schedules', scheduleOperations)) throw new DomainError(ERROR.INVALID_ARGUMENT, '组合操作不支持删除，请使用独立删除工具');
                requireMcpOperationTools('tasks', taskOperations);
                requireMcpOperationTools('schedules', scheduleOperations);
                const taskReceipt = await executeTaskOperations(taskOperations);
                const taskUndo = state.lastUndo;
                const scheduleReceipt = await executeScheduleOperations(scheduleOperations);
                const scheduleUndo = state.lastUndo;
                setGroupedUndo('撤销本次任务与日程操作', [taskUndo, scheduleUndo]);
                return mutationReceipt(taskReceipt.items.concat(scheduleReceipt.items));
            }],
            ['get_task_policy', '读取任务规划策略；传入任务所属文档 ID 时同时返回按“文档 > 文档分组 > 全局”解析后的有效规则，可为缺少预估时长的任务返回确定性默认时长', objectSchema({ action: readAction, documentIDs: { type: 'array', items: { type: 'string' }, maxItems: 200 }, durationCandidates: { type: 'array', maxItems: 200, items: objectSchema({ taskID: { type: 'string' }, title: { type: 'string' }, documentID: { type: 'string' } }, ['taskID', 'title']) } }, ['action']), getTaskPolicy],
            ['preview_task_policy_patch', '预览规划策略变更', objectSchema({ action: readAction, expectedRevision: { type: 'integer' }, patch: anyObject }, ['action', 'expectedRevision', 'patch']), async (args) => { requireAction(args, 'get'); return previewPolicyPatch(args); }],
            ['apply_task_policy_patch', '应用已预览的规划策略变更', objectSchema({ action: stringSchema('写操作', ['apply']), expectedRevision: { type: 'integer' }, previewToken: { type: 'string' } }, ['action', 'expectedRevision', 'previewToken']), async (args) => { requireAction(args, 'apply'); return applyPolicyPatch(args); }],
            ['aggregate_task_stats', '聚合任务完成统计；自定义标签同时返回直接计数 items 与按祖先去重汇总的 hierarchyItems（directCount/totalCount）', objectSchema({ action: queryAction, scopeToken: stringSchema('当前任务视图范围令牌'), from: { type: 'string' }, to: { type: 'string' }, period: stringSchema('聚合周期', ['day', 'week', 'month', 'year']), taskIDs: { type: 'array', items: { type: 'string' } }, documentIDs: { type: 'array', items: { type: 'string' } }, customFieldIDs: { type: 'array', description: '需要按自定义标签直接计数和父级汇总时传入 customFieldDefinitions 中的字段 ID', items: { type: 'string' }, maxItems: 20 } }, ['action']), aggregateTaskStats],
            ['aggregate_time_usage', '聚合预估、计划和实际用时', objectSchema({ action: queryAction, scopeToken: stringSchema('当前任务视图范围令牌'), from: { type: 'string' }, to: { type: 'string' }, taskIDs: { type: 'array', items: { type: 'string' } }, documentIDs: { type: 'array', items: { type: 'string' } } }, ['action']), aggregateTimeUsage],
            ['query_focus_statistics', '查询任意时间范围的专注统计；未指定时间时默认最近30天，可按日、周、月、季度或年直接返回分桶结果', objectSchema({ action: queryAction, scopeToken: stringSchema('当前任务视图范围令牌'), from: { type: 'string' }, to: { type: 'string' }, bucket: stringSchema('时间分桶', ['none', 'hour', 'day', 'week', 'month', 'quarter', 'year']), groupBy: stringSchema('任务分类维度', ['task', 'parent', 'document', 'status', 'priority', 'customField']), customFieldID: { type: 'string' }, rootTaskID: { type: 'string' }, taskIDs: { type: 'array', items: { type: 'string' } }, documentIDs: { type: 'array', items: { type: 'string' } } }, ['action']), queryAgentFocusStatistics],
            ['query_routine_statistics', '查询任意时间范围的日常事务、专注、休息、覆盖和未记录时长', objectSchema({ action: queryAction, from: { type: 'string' }, to: { type: 'string' }, bucket: stringSchema('时间分桶', ['none', 'hour', 'day', 'week', 'month', 'quarter', 'year']) }, ['action']), queryAgentRoutineStatistics],
            ['list_focus_sessions', '分页读取专注会话明细；常规汇总应优先使用 query_focus_statistics', objectSchema({ action: queryAction, from: { type: 'string' }, to: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 500 }, cursor: { type: 'integer', minimum: 0 } }, ['action']), listAgentFocusSessions],
        ];
    }

    async function reconcileTools() {
        const definitions = toolDefinitions();
        validateMcpToolCatalog(definitions);
        const desired = new Map();
        if (state.mcpEnabled) {
            for (const definition of definitions) {
                if (isMcpToolEnabled(definition[0])) desired.set(definition[0], definition);
            }
        }
        const runtime = mcpToolRuntime();
        if ((desired.size || state.registeredTools.size) && !runtime) {
            throw new DomainError(ERROR.UNSUPPORTED, '当前思源内核未提供插件 Agent 能力接口');
        }
        for (const name of Array.from(state.registeredTools)) {
            if (desired.has(name)) continue;
            await runtime.unregister(name);
            state.registeredTools.delete(name);
        }
        for (const [name, definition] of desired) {
            if (state.registeredTools.has(name)) continue;
            await runtime.register(name, definition, async (args) => asResult(() => {
                if (!state.mcpEnabled || !isMcpToolEnabled(name)) {
                    throw new DomainError(ERROR.UNSUPPORTED, '该任务工具已在设置中关闭', { tool: name });
                }
                return definition[3](args || {});
            }));
            state.registeredTools.add(name);
        }
    }

    async function unregisterTools() {
        const names = Array.from(state.registeredTools);
        const runtime = mcpToolRuntime();
        for (const name of names) {
            try { await runtime?.unregister(name); } catch (error) {}
            state.registeredTools.delete(name);
        }
    }

    async function persistMcpConfig() {
        const tools = {};
        for (const name of MCP_TOOL_NAMES) tools[name] = isMcpToolEnabled(name);
        await writeJson(MCP_CONFIG_FILE, {
            schemaVersion: 2,
            enabled: state.mcpDesiredEnabled,
            tools,
            updatedAt: nowIso(),
        });
    }

    function mcpPersistedConfigSignature() {
        return JSON.stringify({
            enabled: state.mcpDesiredEnabled === true,
            tools: MCP_TOOL_NAMES.map((name) => [name, isMcpToolEnabled(name)]),
        });
    }

    function mcpRuntimeConfigSignature() {
        return `${state.mcpAuthorized === true ? 1 : 0}|${mcpPersistedConfigSignature()}`;
    }

    async function applyMcpConfigChange(change) {
        const previousEnabled = state.mcpEnabled;
        const previousAuthorized = state.mcpAuthorized;
        const previousDesiredEnabled = state.mcpDesiredEnabled;
        const previousTools = { ...state.mcpTools };
        const previousPersistedSignature = mcpPersistedConfigSignature();
        const previousRuntimeSignature = mcpRuntimeConfigSignature();
        let persistedChanged = false;
        let runtimeChanged = false;
        try {
            change();
            persistedChanged = mcpPersistedConfigSignature() !== previousPersistedSignature;
            runtimeChanged = mcpRuntimeConfigSignature() !== previousRuntimeSignature;
            if (runtimeChanged) await reconcileTools();
            if (persistedChanged) await persistMcpConfig();
            return getCapabilities();
        } catch (error) {
            state.mcpEnabled = previousEnabled;
            state.mcpAuthorized = previousAuthorized;
            state.mcpDesiredEnabled = previousDesiredEnabled;
            state.mcpTools = previousTools;
            if (runtimeChanged) {
                try { await reconcileTools(); } catch (rollbackError) {}
            }
            if (persistedChanged) {
                try { await persistMcpConfig(); } catch (rollbackError) {}
            }
            throw error;
        }
    }

    async function setMcpEnabled(enabled) {
        const desired = enabled === true;
        if (desired && !state.mcpAuthorized) {
            throw new DomainError(ERROR.UNSUPPORTED, '当前版本未获得任务 MCP 工具权益');
        }
        return await applyMcpConfigChange(() => {
            state.mcpDesiredEnabled = desired;
            state.mcpEnabled = state.mcpAuthorized && desired;
        });
    }

    async function syncMcpEntitlement(input) {
        const value = input && typeof input === 'object' ? input : {};
        if (typeof value.allowed !== 'boolean') {
            throw new DomainError(ERROR.INVALID_ARGUMENT, 'allowed 必须是布尔值');
        }
        return await applyMcpConfigChange(() => {
            state.mcpAuthorized = value.allowed === true;
            if (typeof value.enabled === 'boolean') state.mcpDesiredEnabled = value.enabled === true;
            state.mcpEnabled = state.mcpAuthorized && state.mcpDesiredEnabled;
        });
    }

    async function setMcpToolConfig(input) {
        const value = input && typeof input === 'object' ? input : {};
        if (typeof value.enabled !== 'boolean') {
            throw new DomainError(ERROR.INVALID_ARGUMENT, 'enabled 必须是布尔值');
        }
        if (value.enabled === true && !state.mcpAuthorized) {
            throw new DomainError(ERROR.UNSUPPORTED, '当前版本未获得任务 MCP 工具权益');
        }
        const toolName = text(value.toolName || value.tool);
        const groupID = text(value.groupID || value.group);
        if ((toolName && groupID) || (!toolName && !groupID)) {
            throw new DomainError(ERROR.INVALID_ARGUMENT, '必须且只能指定一个工具或分组');
        }
        let names;
        if (toolName) {
            if (!MCP_TOOL_NAMES.includes(toolName)) throw new DomainError(ERROR.NOT_FOUND, '未找到任务工具', { tool: toolName });
            names = [toolName];
        } else {
            const group = getMcpToolGroup(groupID);
            if (!group) throw new DomainError(ERROR.NOT_FOUND, '未找到任务工具分组', { group: groupID });
            names = group.tools.map((tool) => tool[0]);
        }
        return await applyMcpConfigChange(() => {
            for (const name of names) state.mcpTools[name] = value.enabled;
        });
    }

    function getCapabilities() {
        const definitions = toolDefinitions();
        validateMcpToolCatalog(definitions);
        const definitionMap = new Map(definitions.map((definition) => [definition[0], definition]));
        return {
            kernelAvailable: true,
            mcpAvailable: !!mcpToolRuntime(),
            mcpEnabled: state.mcpEnabled,
            mcpAuthorized: state.mcpAuthorized,
            registeredTools: Array.from(state.registeredTools),
            registeredToolCount: state.registeredTools.size,
            enabledToolCount: MCP_TOOL_NAMES.filter((name) => isMcpToolEnabled(name)).length,
            totalToolCount: MCP_TOOL_NAMES.length,
            toolGroups: MCP_TOOL_GROUPS.map((group) => ({
                id: group.id,
                label: group.label,
                description: group.description,
                enabledCount: group.tools.filter((tool) => isMcpToolEnabled(tool[0])).length,
                totalCount: group.tools.length,
                tools: group.tools.map(([name, label]) => ({
                    name,
                    label,
                    description: definitionMap.get(name)?.[1] || label,
                    enabled: isMcpToolEnabled(name),
                    registered: state.registeredTools.has(name),
                    readOnly: MCP_READ_ONLY_TOOLS.has(name),
                })),
            })),
            services: { tasks: true, schedules: true, reminders: true, agentSchedules: true, policy: true, stats: true, undo: true },
            contractVersion: PLUGIN_VERSION,
        };
    }

    async function getVerifiedCapabilities() {
        await sql('SELECT 1 AS task_horizon_session_probe');
        return getCapabilities();
    }

    async function bindRpc() {
        await siyuan.rpc.bind('taskHorizonGetCapabilities', () => asResult(() => getVerifiedCapabilities()));
        await siyuan.rpc.bind('taskHorizonSyncMcpEntitlement', (input) => asResult(() => syncMcpEntitlement(input || {})));
        await siyuan.rpc.bind('taskHorizonSetMcpEnabled', (enabled) => asResult(() => setMcpEnabled(enabled)));
        await siyuan.rpc.bind('taskHorizonSetMcpToolConfig', (input) => asResult(() => setMcpToolConfig(input || {})));
        await siyuan.rpc.bind('taskHorizonRegisterTaskScope', (input) => asResult(() => registerTaskScope(input || {})));
        await siyuan.rpc.bind('taskHorizonRegisterDocumentGroupSnapshot', (input) => asResult(() => registerDocumentGroupSnapshot(input || {})));
        await siyuan.rpc.bind('taskHorizonResolveTaskBinding', (blockID) => asResult(() => resolveTaskBinding(blockID)));
        await siyuan.rpc.bind('taskHorizonGetCustomFieldDefinitions', () => asResult(async () => customFieldDefinitions(await getFieldRegistry())));
        await siyuan.rpc.bind('taskHorizonGetTask', (taskID, fields) => asResult(() => getTaskDTO(taskID, fields)));
        await siyuan.rpc.bind('taskHorizonGetTaskPlacement', (taskID) => asResult(() => taskPlacementDTO(taskID)));
        await siyuan.rpc.bind('taskHorizonQueryTasks', (input) => asResult(() => queryTaskRows(input || {})));
        await siyuan.rpc.bind('taskHorizonSearchDocuments', (input) => asResult(() => searchDocumentRows(input || {})));
        await siyuan.rpc.bind('taskHorizonListTaskScopes', () => asResult(() => listTaskScopes()));
        await siyuan.rpc.bind('taskHorizonMutateTask', (input) => asResult(() => executeTaskCommand(input || {})));
        await siyuan.rpc.bind('taskHorizonCreateTask', (input) => asResult(() => executeTaskCommandValue({ ...(input || {}), action: 'create' })));
        await siyuan.rpc.bind('taskHorizonUpdateTask', (taskID, patch, options) => asResult(() => executeTaskCommandValue({ action: 'patch', taskID, patch: patch || {}, options: options || {} })));
        await siyuan.rpc.bind('taskHorizonConfigureTaskReminder', (input) => asResult(() => configureTaskReminder(input || {})));
        await siyuan.rpc.bind('taskHorizonLoadAgentSchedules', () => asResult(() => loadAgentSchedules({ allowMissing: false })));
        await siyuan.rpc.bind('taskHorizonReplaceAgentSchedules', (input) => asResult(() => replaceAgentSchedules(input || {})));
        await siyuan.rpc.bind('taskHorizonSaveAgentSchedule', (input) => asResult(() => saveAgentSchedule(input || {})));
        await siyuan.rpc.bind('taskHorizonDeleteAgentSchedule', (scheduleID) => asResult(() => deleteAgentSchedule(scheduleID)));
        await siyuan.rpc.bind('taskHorizonClaimAgentScheduleOccurrence', (input) => asResult(() => claimAgentScheduleOccurrence(input || {})));
        await siyuan.rpc.bind('taskHorizonRenewAgentScheduleOccurrence', (input) => asResult(() => renewAgentScheduleOccurrence(input || {})));
        await siyuan.rpc.bind('taskHorizonFinishAgentScheduleOccurrence', (input) => asResult(() => finishAgentScheduleOccurrence(input || {})));
        await siyuan.rpc.bind('taskHorizonResolveAgentScheduleOutputDocument', (input) => asResult(() => resolveAgentScheduleOutputDocument(input || {})));
        await siyuan.rpc.bind('taskHorizonPersistUiTaskAttrs', (taskID, attrs, options) => asResult(() => executeTaskCommandValue({ action: 'attrs', taskID, attrs: attrs || {}, ...(options || {}) })));
        await siyuan.rpc.bind('taskHorizonPersistUiBlockOperation', (input) => asResult(() => executeTaskCommandValue({ action: 'blockOperation', operation: input || {}, laneID: input?.laneID || input?.laneId })));
        await siyuan.rpc.bind('taskHorizonMoveTask', (input) => asResult(() => executeTaskCommandValue({ ...(input || {}), action: 'move' })));
        await siyuan.rpc.bind('taskHorizonPreviewDeleteTask', (taskID) => asResult(() => previewTaskDelete(taskID)));
        await siyuan.rpc.bind('taskHorizonDeleteTask', (taskID, previewToken) => asResult(() => executeTaskDelete(taskID, previewToken)));
        await siyuan.rpc.bind('taskHorizonLoadSchedules', () => asResult(() => loadSchedules({ allowMissing: false })));
        await siyuan.rpc.bind('taskHorizonSaveSchedules', (items, options) => asResult(() => runScheduleLane(() => saveScheduleSnapshot(items, options))));
        await siyuan.rpc.bind('taskHorizonQuerySchedules', (input) => asResult(() => querySchedules(input || {})));
        await siyuan.rpc.bind('taskHorizonCreateSchedule', (input) => asResult(() => createSchedule(input || {})));
        await siyuan.rpc.bind('taskHorizonUpdateSchedule', (input) => asResult(() => updateSchedule(input || {})));
        await siyuan.rpc.bind('taskHorizonPreviewDeleteSchedule', (scheduleID) => asResult(() => previewScheduleDelete(scheduleID)));
        await siyuan.rpc.bind('taskHorizonDeleteSchedule', (scheduleID, previewToken) => asResult(() => executeScheduleDelete(scheduleID, previewToken)));
        await siyuan.rpc.bind('taskHorizonGetPolicy', () => asResult(async () => {
            const record = await getPolicyRecord();
            return { ...record.policy, __storageState: record.storageState };
        }));
        await siyuan.rpc.bind('taskHorizonRestorePolicy', (input) => asResult(() => restorePolicySnapshot(input || {})));
        await siyuan.rpc.bind('taskHorizonResolveDurationDefaults', (input) => asResult(() => resolveTaskDurationDefaults(input || {})));
        await siyuan.rpc.bind('taskHorizonPreviewPolicyPatch', (input) => asResult(() => previewPolicyPatch(input || {})));
        await siyuan.rpc.bind('taskHorizonApplyPolicyPatch', (input) => asResult(() => applyPolicyPatch(input || {})));
        await siyuan.rpc.bind('taskHorizonAggregateTaskStats', (input) => asResult(() => aggregateTaskStats(input || {})));
        await siyuan.rpc.bind('taskHorizonAggregateTimeUsage', (input) => asResult(() => aggregateTimeUsage(input || {})));
        await siyuan.rpc.bind('taskHorizonProjectFocusStatistics', (rawStats, input, taskSnapshot) => asResult(() => (
            projectFocusStatistics(rawStats || {}, input || {}, taskSnapshot || null)
        )));
        await siyuan.rpc.bind('taskHorizonResolveFocusCandidateIDs', (input) => asResult(async () => ({
            candidateIDs: await resolveFocusCandidateIDs(input || {}),
        })));
        await siyuan.rpc.bind('taskHorizonQueryFocusStatistics', (input) => asResult(() => queryFocusStatistics(input || {})));
        await siyuan.rpc.bind('taskHorizonQueryRoutineStatistics', (input) => asResult(() => queryDockTomatoRoutineStats(input || {})));
        await siyuan.rpc.bind('taskHorizonListFocusSessions', (input) => asResult(() => listDockTomatoSessions(input || {})));
        await siyuan.rpc.bind('taskHorizonGroupUndoMutations', (input) => asResult(() => groupUndoMutations(input || {})));
        await siyuan.rpc.bind('taskHorizonUndoLastMutation', (input) => asResult(() => undoLastMutation(input || {})));
    }

    const RPC_NAMES = [
        'taskHorizonGetCapabilities', 'taskHorizonSyncMcpEntitlement', 'taskHorizonSetMcpEnabled', 'taskHorizonSetMcpToolConfig', 'taskHorizonRegisterTaskScope', 'taskHorizonResolveTaskBinding', 'taskHorizonGetCustomFieldDefinitions',
        'taskHorizonGetTask', 'taskHorizonGetTaskPlacement', 'taskHorizonQueryTasks', 'taskHorizonSearchDocuments', 'taskHorizonListTaskScopes', 'taskHorizonMutateTask', 'taskHorizonCreateTask', 'taskHorizonUpdateTask', 'taskHorizonConfigureTaskReminder',
        'taskHorizonLoadAgentSchedules', 'taskHorizonReplaceAgentSchedules', 'taskHorizonSaveAgentSchedule', 'taskHorizonDeleteAgentSchedule', 'taskHorizonClaimAgentScheduleOccurrence', 'taskHorizonRenewAgentScheduleOccurrence', 'taskHorizonFinishAgentScheduleOccurrence', 'taskHorizonResolveAgentScheduleOutputDocument', 'taskHorizonPersistUiTaskAttrs', 'taskHorizonPersistUiBlockOperation',
        'taskHorizonMoveTask', 'taskHorizonPreviewDeleteTask', 'taskHorizonDeleteTask',
        'taskHorizonLoadSchedules', 'taskHorizonSaveSchedules', 'taskHorizonQuerySchedules',
        'taskHorizonCreateSchedule', 'taskHorizonUpdateSchedule', 'taskHorizonPreviewDeleteSchedule',
        'taskHorizonDeleteSchedule', 'taskHorizonGetPolicy', 'taskHorizonRestorePolicy', 'taskHorizonResolveDurationDefaults', 'taskHorizonPreviewPolicyPatch',
        'taskHorizonApplyPolicyPatch', 'taskHorizonAggregateTaskStats', 'taskHorizonAggregateTimeUsage',
        'taskHorizonProjectFocusStatistics', 'taskHorizonResolveFocusCandidateIDs', 'taskHorizonQueryFocusStatistics', 'taskHorizonQueryRoutineStatistics', 'taskHorizonListFocusSessions',
        'taskHorizonGroupUndoMutations', 'taskHorizonUndoLastMutation',
    ];

    siyuan.plugin.lifecycle.onload = async function () {
        await ensureTaskAttrItemStorageMigration();
        await bindRpc();
        const config = await readJson(MCP_CONFIG_FILE, { schemaVersion: 2, enabled: false, tools: {} });
        const currentConfig = config && config.schemaVersion === 2 ? config : null;
        state.mcpAuthorized = false;
        state.mcpDesiredEnabled = currentConfig?.enabled === true;
        state.mcpEnabled = false;
        state.mcpTools = normalizeMcpTools(currentConfig?.tools);
        await reconcileTools();
    };

    siyuan.plugin.lifecycle.onrunning = function () {};

    siyuan.plugin.lifecycle.onunload = async function () {
        await unregisterTools();
        for (const name of RPC_NAMES) {
            try { await siyuan.rpc.unbind(name); } catch (error) {}
        }
        state.taskLanes.clear();
        state.deleteTokens.clear();
        state.reminderTokens.clear();
        state.policyTokens.clear();
        state.operationTokens.clear();
        state.taskScopes.clear();
        state.undoRecords.clear();
        state.undoSequence = 0;
        state.lastUndo = null;
    };
})();
