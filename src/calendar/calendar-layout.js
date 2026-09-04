(function (global) {
    'use strict';

    const dateMath = global.__tmCalendarDate || {};
    const DAY_MS = dateMath.DAY_MS || 86400000;

    function toMs(value) {
        const date = dateMath.toDate?.(value);
        return date ? date.getTime() : NaN;
    }

    function toLocalDayOrdinal(value) {
        const date = dateMath.toDate?.(value);
        if (!date) return NaN;
        return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
    }

    function layoutAllDay(events, range, options = {}) {
        const rangeStartDay = toLocalDayOrdinal(range?.start);
        const rangeEndDay = toLocalDayOrdinal(range?.end);
        const days = Math.max(1, Number(range?.days) || (rangeEndDay - rangeStartDay) || 1);
        const columns = Number(options.columns) > 0 ? Number(options.columns) : days;
        const visible = (Array.isArray(events) ? events : [])
            .filter((event) => event?.allDay === true)
            .map((event) => {
                const eventStart = toLocalDayOrdinal(event.start);
                const parsedEventEnd = toLocalDayOrdinal(event.end);
                const eventEnd = Number.isFinite(parsedEventEnd) ? parsedEventEnd : eventStart + 1;
                const start = Math.max(rangeStartDay, eventStart);
                const end = Math.min(rangeEndDay, eventEnd);
                if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
                const startCol = Math.max(0, start - rangeStartDay);
                const endCol = Math.min(columns, Math.max(startCol + 1, end - rangeStartDay));
                return {
                    event,
                    startCol,
                    endCol,
                    span: endCol - startCol,
                    isStart: start === eventStart,
                    isEnd: end === eventEnd,
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.startCol - b.startCol || b.span - a.span || String(a.event.title || '').localeCompare(String(b.event.title || '')));
        const laneEnds = [];
        const segments = [];
        visible.forEach((item) => {
            let lane = 0;
            while (laneEnds[lane] > item.startCol) lane += 1;
            laneEnds[lane] = item.endCol;
            segments.push({
                ...item,
                lane,
            });
        });
        return { segments, laneCount: laneEnds.length, columns, days };
    }

    function layoutTimed(events, range, options = {}) {
        const startMs = toMs(range?.start);
        const endMs = toMs(range?.end);
        const total = Math.max(1, endMs - startMs);
        const items = (Array.isArray(events) ? events : [])
            .filter((event) => event?.allDay !== true)
            .map((event) => {
                const eventStart = Math.max(startMs, toMs(event.start));
                const eventEnd = Math.min(endMs, toMs(event.end) || eventStart + 1800000);
                if (!Number.isFinite(eventStart) || !Number.isFinite(eventEnd) || eventEnd <= eventStart) return null;
                return {
                    event,
                    top: ((eventStart - startMs) / total) * 100,
                    height: Math.max(Number(options.minHeightPercent) || 0.6, ((eventEnd - eventStart) / total) * 100),
                    startMs: eventStart,
                    endMs: eventEnd,
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
        return { items, totalMs: total };
    }

    function buildViewModel(view, events, options = {}) {
        const range = view?.range || { start: view?.activeStart, end: view?.activeEnd };
        return {
            view,
            events: Array.isArray(events) ? events : [],
            allDay: layoutAllDay(events, range, options),
            timed: layoutTimed(events, range, options),
        };
    }

    global.__tmCalendarLayout = Object.freeze({ layoutAllDay, layoutTimed, buildViewModel });
})(typeof globalThis !== 'undefined' ? globalThis : window);
