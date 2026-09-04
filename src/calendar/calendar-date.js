(function (global) {
    'use strict';

    const DAY_MS = 24 * 60 * 60 * 1000;

    function toDate(value) {
        if (value instanceof Date) {
            return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
        }
        if (typeof value === 'number') {
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? null : date;
        }
        if (typeof value === 'string') {
            const raw = value.trim();
            // Date-only keys represent a local calendar day. Native parsing
            // treats `YYYY-MM-DD` as UTC, which shifts the anchor to the
            // previous day in time zones west of UTC and breaks day
            // navigation at month boundaries.
            const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
                ? new Date(`${raw}T12:00:00`)
                : new Date(raw);
            return Number.isNaN(date.getTime()) ? null : date;
        }
        return null;
    }

    function startOfDay(value) {
        const date = toDate(value) || new Date();
        date.setHours(0, 0, 0, 0);
        return date;
    }

    function addDays(value, amount) {
        const date = toDate(value) || new Date();
        date.setDate(date.getDate() + Number(amount || 0));
        return date;
    }

    function startOfWeek(value, firstDay = 1) {
        const date = startOfDay(value);
        const normalizedFirstDay = Number(firstDay) === 0 ? 0 : 1;
        const distance = (date.getDay() - normalizedFirstDay + 7) % 7;
        date.setDate(date.getDate() - distance);
        return date;
    }

    function endOfMonth(value) {
        const date = startOfDay(value);
        date.setMonth(date.getMonth() + 1, 0);
        return date;
    }

    function resolveViewConfig(viewType, views) {
        const key = String(viewType || '').trim() || 'timeGridWeek';
        const configured = views && typeof views === 'object' && views[key]
            ? views[key]
            : {};
        const type = String(configured.type || key).trim();
        const durationDays = Number(configured.duration?.days);
        return {
            key,
            type,
            durationDays: Number.isFinite(durationDays) && durationDays > 0 ? Math.round(durationDays) : 0,
            hiddenDays: Array.isArray(configured.hiddenDays) ? configured.hiddenDays.slice() : [],
        };
    }

    function getVisibleRange(viewType, anchor, options = {}) {
        const date = startOfDay(anchor);
        const firstDay = Number(options.firstDay) === 0 ? 0 : 1;
        const config = resolveViewConfig(viewType, options.views);
        let start = date;
        let end = addDays(date, 1);
        const key = config.key;
        const type = config.type;

        if (key === 'dayGridMonth' || type === 'dayGridMonth' || key === 'listMonth' || type === 'listMonth') {
            if (key === 'listMonth' || type === 'listMonth') {
                start = new Date(date.getFullYear(), date.getMonth(), 1);
                end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
            } else if (options.monthScroll === true) {
                // The desktop virtual strip expands this browsing window as
                // the user scrolls; past and future grow independently, so a
                // symmetric window (both sides mounted) must be allowed.
                const configuredPast = Number(options.monthScrollPast);
                const configuredFuture = Number(options.monthScrollFuture);
                const pastMonths = Math.min(60, Math.max(0, Math.round(Number.isFinite(configuredPast) ? configuredPast : 0)));
                const futureMonths = Math.min(60, Math.max(0, Math.round(Number.isFinite(configuredFuture) ? configuredFuture : 2)));
                const firstMonth = new Date(date.getFullYear(), date.getMonth() - pastMonths, 1);
                const lastMonth = new Date(date.getFullYear(), date.getMonth() + futureMonths + 1, 0);
                start = startOfWeek(firstMonth, firstDay);
                end = addDays(startOfWeek(lastMonth, firstDay), 7);
            } else {
                const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
                const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1);
                start = startOfWeek(monthStart, firstDay);
                const lastVisibleDay = addDays(monthEnd, -1);
                end = addDays(startOfWeek(lastVisibleDay, firstDay), 7);
                if (options.fixedWeekCount === true) end = addDays(start, 42);
            }
        } else if (key === 'timeGrid3Day' || config.durationDays === 3) {
            start = date;
            end = addDays(start, 3);
        } else if (key === 'timeGridWorkdays' || type === 'timeGridWorkdays') {
            start = startOfWeek(date, 1);
            end = addDays(start, 5);
        } else if (key === 'timeGridDay' || type === 'timeGridDay') {
            start = date;
            end = addDays(start, 1);
        } else {
            start = startOfWeek(date, firstDay);
            end = addDays(start, 7);
        }

        return {
            start,
            end,
            startMs: start.getTime(),
            endMs: end.getTime(),
            days: Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS)),
        };
    }

    function formatDateKey(value) {
        const date = toDate(value);
        if (!date) return '';
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function formatViewTitle(viewType, range, locale = 'zh-CN') {
        const start = toDate(range?.start) || new Date();
        const end = toDate(range?.end) || start;
        const key = String(viewType || '').trim();
        if (key === 'dayGridMonth' || key === 'listMonth') {
            return locale.toLowerCase().startsWith('zh')
                ? `${start.getFullYear()}年${start.getMonth() + 1}月`
                : new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(start);
        }
        if (key === 'timeGridDay') {
            return locale.toLowerCase().startsWith('zh')
                ? `${start.getMonth() + 1}月${start.getDate()}日`
                : new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(start);
        }
        const last = addDays(end, -1);
        if (start.getFullYear() === last.getFullYear() && start.getMonth() === last.getMonth()) {
            return locale.toLowerCase().startsWith('zh')
                ? `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}-${last.getDate()}日`
                : `${new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(start)} - ${last.getDate()}`;
        }
        return locale.toLowerCase().startsWith('zh')
            ? `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日 - ${last.getMonth() + 1}月${last.getDate()}日`
            : `${new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(start)} - ${new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(last)}`;
    }

    function overlaps(start, end, rangeStart, rangeEnd) {
        const a = toDate(start)?.getTime();
        const b = toDate(end)?.getTime();
        const c = toDate(rangeStart)?.getTime();
        const d = toDate(rangeEnd)?.getTime();
        return [a, b, c, d].every(Number.isFinite) && b > c && a < d;
    }

    global.__tmCalendarDate = Object.freeze({
        DAY_MS,
        toDate,
        startOfDay,
        addDays,
        startOfWeek,
        endOfMonth,
        resolveViewConfig,
        getVisibleRange,
        formatDateKey,
        formatViewTitle,
        overlaps,
    });
})(typeof globalThis !== 'undefined' ? globalThis : window);
