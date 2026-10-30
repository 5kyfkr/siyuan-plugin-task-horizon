(function (root) {
    'use strict';

    function normalizeLanguage(value) {
        return /^zh(?:[-_]|$)/i.test(String(value || '')) ? 'zh-CN' : 'en';
    }

    function normalizePreference(value) {
        return value === 'en' || value === 'zh-CN' ? value : 'system';
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => (
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]
        ));
    }

    // Compatibility names identify untouched built-ins, never arbitrary user text.
    const defaultNames = {
        'status.todo': ['待办', 'To do', 'Todo'],
        'status.in_progress': ['进行中', 'In progress'],
        'status.done': ['已完成', 'Done', 'Completed'],
        'status.cancelled': ['放弃', '已取消', 'Abandoned', 'Cancelled'],
        'status.blocked': ['阻塞', 'Blocked'],
        'status.review': ['待审核', 'In review'],
        'rule.default_todo': ['未完成', 'Incomplete'],
        'rule.default_today': ['今日', 'Today'],
        'rule.default_overdue': ['已逾期', 'Overdue'],
        'rule.default_next_seven_days': ['未来七天', 'Next seven days'],
        'rule.default_unscheduled': ['未安排', 'Unscheduled'],
        'rule.default_all': ['全部', '全部任务', '所有任务', 'All', 'All tasks'],
        'rule.default_completed': ['已完成', 'Completed'],
        'rule.high_priority': ['高优先级', '高重要性', 'High priority', 'High importance'],
        'rule.urgent-important': ['重要紧急', 'Important & urgent', 'Important, urgent'],
        'rule.not-urgent-important': ['重要不紧急', 'Important & not urgent', 'Important, not urgent'],
        'rule.urgent-not-important': ['不重要紧急', 'Not important & urgent', 'Not important, urgent'],
        'rule.not-urgent-not-important': ['不重要不紧急', 'Not important & not urgent', 'Not important, not urgent'],
    };

    // Plain data and named parameters only. Translation values never execute code.
    function createI18n(messages, options = {}) {
        const locale = normalizeLanguage(options.locale || messages.__locale);
        const formatters = new Map();
        const missing = new Set();
        function t(key, params = {}) {
            let value = messages[key];
            if (typeof value !== 'string' && typeof params.count === 'number') {
                value = messages[`${key}.${locale === 'en' && params.count === 1 ? 'one' : 'other'}`];
            }
            if (typeof value !== 'string') {
                if (!missing.has(key)) {
                    missing.add(key);
                    if (typeof console !== 'undefined') console.warn('[task-horizon] Missing translation:', key);
                }
                return key;
            }
            return value.replace(/\{([A-Za-z_$][\w$]*)\}/g, (placeholder, name) => (
                Object.prototype.hasOwnProperty.call(params, name) ? String(params[name] ?? '') : placeholder
            ));
        }
        function date(value, format = {}) {
            const input = value instanceof Date ? value : new Date(value);
            if (Number.isNaN(input.getTime())) return '';
            const key = JSON.stringify(format);
            if (!formatters.has(key)) formatters.set(key, new Intl.DateTimeFormat(locale, format));
            return formatters.get(key).format(input);
        }
        function weekday(day, width = 'short') {
            return date(new Date(2024, 0, 7 + Number(day), 12), { weekday: width });
        }
        function builtinName(kind, item) {
            const name = String(item?.name ?? item?.label ?? item?.id ?? '');
            const key = kind + '.' + String(item?.id || '');
            return defaultNames[key]?.includes(name) ? t('builtin.' + key) : name;
        }
        const html = (key, params) => escapeHtml(t(key, params));
        return Object.freeze({ locale, preference: normalizePreference(options.preference), messages, t, html, date, weekday, builtinName });
    }

    const api = Object.freeze({ createI18n, normalizeLanguage, normalizePreference });
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (typeof document !== 'undefined') (root.__taskHorizonHostBridge ||= {}).i18nRuntime = api;
})(globalThis);
