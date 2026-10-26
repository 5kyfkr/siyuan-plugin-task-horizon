(function () {
    'use strict';

    if (globalThis.__tmDuration) return;

    const UNIT_HOURS = 'hours';
    const UNIT_MINUTES = 'minutes';
    const HOURS_DECIMALS = 2;
    const UNIT_RE = /(\d+(?:\.\d+)?)\s*(天|小时|时|分钟|分|days?|day|d|hours?|hour|hrs?|hr|h|minutes?|minute|mins?|min|m)/gi;

    function normalizeUnit(value) {
        return String(value == null ? '' : value).trim().toLowerCase() === UNIT_MINUTES ? UNIT_MINUTES : UNIT_HOURS;
    }

    function toFiniteNumber(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    /**
     * 无单位数值按 unit 解释；带单位文本按单位求和。
     * 返回分钟数；空值或无法识别时返回 null。
     */
    function parse(value, unit) {
        const raw = String(value == null ? '' : value).trim();
        if (!raw) return null;
        if (/^-/.test(raw)) return null;
        const normalizedUnit = normalizeUnit(unit);

        // 2:30 / 0:45
        const clock = /^(\d+)\s*:\s*([0-5]\d)$/.exec(raw);
        if (clock) return Number(clock[1]) * 60 + Number(clock[2]);

        // 纯数字：按当前单位解释
        if (/^\d+(?:\.\d+)?$/.test(raw)) {
            const n = toFiniteNumber(raw);
            if (n == null || n < 0) return null;
            return normalizedUnit === UNIT_MINUTES ? n : n * 60;
        }

        let total = 0;
        let matched = false;
        UNIT_RE.lastIndex = 0;
        let m;
        while ((m = UNIT_RE.exec(raw))) {
            const n = Number(m[1]);
            if (!Number.isFinite(n) || n < 0) continue;
            const token = String(m[2] || '').toLowerCase();
            matched = true;
            if (token === '天' || token === 'day' || token === 'days' || token === 'd') total += n * 1440;
            else if (token === '小时' || token === '时' || token === 'hour' || token === 'hours' || token === 'hr' || token === 'hrs' || token === 'h') total += n * 60;
            else total += n;
        }
        return matched ? total : null;
    }

    function split(minutes) {
        const total = Math.max(0, Math.round(Number(minutes) || 0));
        return { hours: Math.floor(total / 60), minutes: total % 60, total };
    }

    function join(hours, minutes) {
        const h = Math.max(0, Math.round(Number(hours) || 0));
        const m = Math.max(0, Math.round(Number(minutes) || 0));
        return Math.max(0, h * 60 + m);
    }

    /**
     * 把分钟数写成当前单位的无单位数字字符串。
     * 小时模式最多两位小数（可无损回到分钟）；分钟模式写整数。
     */
    function toStorage(minutes, unit) {
        const total = Math.max(0, Math.round(Number(minutes) || 0));
        if (!total) return '';
        if (normalizeUnit(unit) === UNIT_MINUTES) return String(total);
        const factor = 10 ** HOURS_DECIMALS;
        return String(Math.round((total / 60) * factor) / factor);
    }

    function formatPreview(hours, minutes) {
        const h = Math.max(0, Math.round(Number(hours) || 0));
        const m = Math.max(0, Math.round(Number(minutes) || 0));
        const normalized = join(h, m);
        if (!normalized) return '';
        const parts = split(normalized);
        if (parts.hours && parts.minutes) return `${parts.hours}h${parts.minutes}m`;
        if (parts.hours) return `${parts.hours}h`;
        return `${parts.minutes}m`;
    }

    /**
     * 预设标签：跟随当前单位（小时模式 0.5h/1h，分钟模式 30m/60m），
     * 但调用方保存的仍是原数字。
     */
    function formatPresetLabel(value, unit) {
        const raw = String(value == null ? '' : value).trim();
        if (!raw) return '';
        const parsed = parse(raw, unit);
        if (parsed == null || !Number.isFinite(parsed) || parsed <= 0) return raw;
        const normalizedUnit = normalizeUnit(unit);
        const amount = toStorage(parsed, normalizedUnit);
        return `${amount}${normalizedUnit === UNIT_MINUTES ? 'm' : 'h'}`;
    }

    function getUnit() {
        try {
            let store = globalThis.__taskHorizonSettingsStore || globalThis.SettingsStore || null;
            if (!store && typeof SettingsStore !== 'undefined') store = SettingsStore;
            const value = store?.data?.durationFormat;
            if (value != null && String(value).trim()) return normalizeUnit(value);
        } catch (e) {}
        try {
            const raw = String(globalThis.localStorage?.getItem('tm_duration_format') || '');
            if (/minutes/i.test(raw)) return UNIT_MINUTES;
        } catch (e) {}
        return UNIT_HOURS;
    }

    globalThis.__tmDuration = Object.freeze({
        UNIT_HOURS,
        UNIT_MINUTES,
        normalizeUnit,
        parse,
        split,
        join,
        toStorage,
        formatPreview,
        formatPresetLabel,
        getUnit,
    });
})();
