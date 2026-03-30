(function () {
    let __tmSiyuanSdk = null;
    try {
        if (typeof require === 'function') {
            __tmSiyuanSdk = require('siyuan');
        }
    } catch (e) {}

    function ensureTmSiyuanSdk() {
        if (__tmSiyuanSdk && typeof __tmSiyuanSdk === 'object') return __tmSiyuanSdk;
        try {
            if (typeof require === 'function') {
                const sdk = require('siyuan');
                if (sdk && typeof sdk === 'object') {
                    __tmSiyuanSdk = sdk;
                    return __tmSiyuanSdk;
                }
            }
        } catch (e) {}
        try {
            if (typeof globalThis?.require === 'function') {
                const sdk = globalThis.require('siyuan');
                if (sdk && typeof sdk === 'object') {
                    __tmSiyuanSdk = sdk;
                    return __tmSiyuanSdk;
                }
            }
        } catch (e) {}
        try {
            if (typeof window?.require === 'function') {
                const sdk = window.require('siyuan');
                if (sdk && typeof sdk === 'object') {
                    __tmSiyuanSdk = sdk;
                    return __tmSiyuanSdk;
                }
            }
        } catch (e) {}
        return null;
    }

    const STORAGE = {
        DOCK_TOMATO_FILE_NEW: '/data/storage/petal/siyuan-plugin-docktomato/tomato-history.json',
        DOCK_TOMATO_FILE_LEGACY: '/data/storage/tomato-history.json',
        DOCK_TOMATO_LS_KEY: 'siyuan-tomato-history',
        SCHEDULE_FILE: '/data/storage/petal/siyuan-plugin-task-horizon/calendar-events.json',
        SCHEDULE_LS_KEY: 'tm-calendar-events',
        SCHEDULE_MOBILE_REGISTRY_LS_KEY: 'tm-calendar-mobile-notification-registry',
    };
    const SIDE_DAY_HALF_HOUR_SLOT_HEIGHT = 29;
    const CALENDAR_HOUR_SLOT_HEIGHT_DELTA_MAP = Object.freeze({
        normal: 0,
        high: 10,
        higher: 20,
        ultra: 30,
    });
    const DEVICE_NOTIFICATION_CHANNEL = 'siyuan-plugin-task-horizon';

    const state = {
        mounted: false,
        rootEl: null,
        calendarEl: null,
        calendar: null,
        miniCalendarEl: null,
        miniMonthKey: '',
        miniAbort: null,
        taskListEl: null,
        taskDraggable: null,
        settingsStore: null,
        opts: null,
        tomatoListener: null,
        tomatoRefetchTimer: null,
        _persistTimer: null,
        sidePage: 'calendar',
        taskQuery: '',
        taskPage: 1,
        taskPageSize: 200,
        filteredTasksListener: null,
        settingsAbort: null,
        uiAbort: null,
        modalEl: null,
        deviceScheduleModalEl: null,
        deviceScheduleAbort: null,
        isMobileDevice: false,
        sidebarOpen: false,
        mobileDragCloseTimer: null,
        sidebarColorMenuCloseHandler: null,
        sidebarColorMenuBindTimer: null,
        sidebarResizeCleanup: null,
        onVisibilityChange: null,
        calendarResizeObserver: null,
        scheduleCache: {
            list: null,
            loadedAt: 0,
            inflight: null,
            sourceSignature: '',
        },
        reminderCache: {
            list: null,
            loadedAt: 0,
            inflight: null,
        },
        scheduleReminder: {
            enabled: false,
            refreshTimer: null,
            periodicTimer: null,
            timers: new Map(),
            mobileSyncTimer: null,
            mobileSyncRunning: false,
            mobileSyncPending: false,
            scheduleUpdatedListener: null,
            toastHost: null,
            toastStyleEl: null,
            backgroundRefreshBound: false,
            backgroundVisibilityHandler: null,
            backgroundFocusHandler: null,
            backgroundPageShowHandler: null,
            backgroundLastRefreshAt: 0,
            sharedFileWatchTimer: null,
            sharedFileWatchRunning: false,
        },
        sideDay: {
            rootEl: null,
            calendar: null,
            dateKey: '',
            settingsStore: null,
            resolveTask: null,
            dragHost: null,
            draggable: null,
            nativeDropAbort: null,
            previewEl: null,
            popoverObserver: null,
            popoverClickCapture: null,
        },
    };

    const MAIN_CALENDAR_CUSTOM_VIEWS = {
        timeGrid3Day: { type: 'timeGrid', duration: { days: 3 }, buttonText: '3日' },
        timeGridWorkdays: { type: 'timeGridWeek', hiddenDays: [0, 6], buttonText: '工作日' },
    };

    const MAIN_CALENDAR_ALLOWED_VIEWS = new Set([
        'timeGridDay',
        'timeGrid3Day',
        'timeGridWorkdays',
        'timeGridWeek',
        'dayGridMonth',
    ]);

    const MAIN_CALENDAR_VIEW_OPTIONS = [
        { value: 'timeGridDay', label: '日' },
        { value: 'timeGrid3Day', label: '3日' },
        { value: 'timeGridWorkdays', label: '工作日' },
        { value: 'timeGridWeek', label: '周' },
        { value: 'dayGridMonth', label: '月' },
    ];

    const MAIN_CALENDAR_VIEW_LABELS = MAIN_CALENDAR_VIEW_OPTIONS.reduce((acc, item) => {
        const key = String(item?.value || '').trim();
        if (key) acc[key] = String(item?.label || key);
        return acc;
    }, Object.create(null));

    function esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
    }

    function syncMainCalendarViewSelectWidth(selectWrap, selectEl, label) {
        if (!(selectWrap instanceof HTMLElement) || !(selectEl instanceof HTMLSelectElement)) return;
        const text = String(label || '').trim() || '视图';
        let measureEl = document.getElementById('tmCalendarViewSelectMeasure');
        if (!(measureEl instanceof HTMLElement)) {
            measureEl = document.createElement('span');
            measureEl.id = 'tmCalendarViewSelectMeasure';
            measureEl.setAttribute('aria-hidden', 'true');
            measureEl.style.position = 'absolute';
            measureEl.style.visibility = 'hidden';
            measureEl.style.pointerEvents = 'none';
            measureEl.style.whiteSpace = 'nowrap';
            measureEl.style.left = '-9999px';
            measureEl.style.top = '0';
            measureEl.style.boxSizing = 'border-box';
            document.body.appendChild(measureEl);
        }
        const computed = window.getComputedStyle(selectEl);
        measureEl.style.font = computed.font;
        measureEl.style.fontFamily = computed.fontFamily;
        measureEl.style.fontSize = computed.fontSize;
        measureEl.style.fontWeight = computed.fontWeight;
        measureEl.style.letterSpacing = computed.letterSpacing;
        measureEl.style.textTransform = computed.textTransform;
        measureEl.textContent = text;
        const textWidth = Math.ceil(measureEl.getBoundingClientRect().width || 0);
        const borderLeft = parseFloat(computed.borderLeftWidth) || 0;
        const borderRight = parseFloat(computed.borderRightWidth) || 0;
        const paddingLeft = parseFloat(computed.paddingLeft) || 0;
        const paddingRight = parseFloat(computed.paddingRight) || 0;
        const iconAllowance = 10;
        const minWidth = 48;
        const nextWidth = Math.max(minWidth, Math.ceil(textWidth + paddingLeft + paddingRight + borderLeft + borderRight + iconAllowance));
        selectWrap.style.width = `${nextWidth}px`;
        selectEl.style.width = `${nextWidth}px`;
    }

    function syncMainCalendarViewSelect(wrap, calendar, opts = {}) {
        const root = wrap instanceof Element ? wrap : null;
        const cal = calendar || null;
        if (!root || !cal) return;
        const host = root.querySelector('.tm-calendar-host');
        const toolbar = host?.querySelector?.('.fc-header-toolbar');
        const rightChunk = toolbar?.querySelector?.('.fc-toolbar-chunk:last-child');
        if (!(rightChunk instanceof Element)) return;
        const useCompactSelect = opts.compact === true;
        const existingWrap = rightChunk.querySelector('.tm-calendar-view-select-wrap');
        if (!useCompactSelect) {
            try { existingWrap?.remove?.(); } catch (e) {}
            return;
        }
        let selectWrap = existingWrap;
        if (!(selectWrap instanceof Element)) {
            selectWrap = document.createElement('div');
            selectWrap.className = 'tm-calendar-view-select-wrap';
            const select = document.createElement('select');
            select.className = 'tm-calendar-view-select';
            select.setAttribute('data-tm-cal-view-select', 'main');
            select.setAttribute('aria-label', '切换日历视图');
            MAIN_CALENDAR_VIEW_OPTIONS.forEach((item) => {
                const opt = document.createElement('option');
                opt.value = item.value;
                opt.textContent = item.label;
                select.appendChild(opt);
            });
            select.addEventListener('change', () => {
                const nextView = String(select.value || '').trim();
                if (!MAIN_CALENDAR_ALLOWED_VIEWS.has(nextView)) return;
                try {
                    const currentDate = cal.getDate?.();
                    if (currentDate instanceof Date && !Number.isNaN(currentDate.getTime())) cal.changeView(nextView, currentDate);
                    else cal.changeView(nextView);
                } catch (e) {}
            });
            selectWrap.appendChild(select);
            rightChunk.appendChild(selectWrap);
        }
        const selectEl = selectWrap.querySelector('.tm-calendar-view-select');
        if (!(selectEl instanceof HTMLSelectElement)) return;
        const activeView = String(cal?.view?.type || '').trim();
        if (MAIN_CALENDAR_ALLOWED_VIEWS.has(activeView) && selectEl.value !== activeView) {
            selectEl.value = activeView;
        }
        const label = String(MAIN_CALENDAR_VIEW_LABELS[activeView] || activeView || '视图');
        selectEl.title = `切换日历视图：${label}`;
        syncMainCalendarViewSelectWidth(selectWrap, selectEl, label);
    }

    function findActionTarget(target, attrName = 'data-tm-cal-action') {
        const attr = String(attrName || '').trim();
        if (!attr) return null;
        let node = target;
        while (node) {
            if (node instanceof Element && typeof node.getAttribute === 'function') {
                const value = node.getAttribute(attr);
                if (value != null && String(value).trim()) return node;
            }
            node = node.parentElement || node.parentNode || null;
        }
        return null;
    }

    function getOverlayZIndex(baseEl, fallback = 200000) {
        try {
            const el = baseEl instanceof Element ? baseEl : null;
            if (!el) return fallback;
            const raw = window.getComputedStyle(el).zIndex;
            const parsed = Number(raw);
            if (Number.isFinite(parsed)) return parsed;
        } catch (e) {}
        return fallback;
    }

    function ensureFcCompactAllDayStyle() {
        const id = 'tm-fc-compact-allday-style';
        const css = `
.tm-calendar-host .fc .fc-timegrid-divider,
#tmCalendarSideDockTimeline .fc .fc-timegrid-divider{padding:0 !important;height:1px !important;}
.tm-calendar-host .fc .fc-timegrid-divider td,
#tmCalendarSideDockTimeline .fc .fc-timegrid-divider td{padding:0 !important;}
.tm-calendar-host .fc .fc-timegrid-divider div,
#tmCalendarSideDockTimeline .fc .fc-timegrid-divider div{margin:0 !important;}
.tm-calendar-host .fc .fc-timegrid-all-day .fc-daygrid-body,
#tmCalendarSideDockTimeline .fc .fc-timegrid-all-day .fc-daygrid-body{min-height:0 !important;}
.tm-calendar-host .fc .fc-timegrid-all-day .fc-scroller-harness,
#tmCalendarSideDockTimeline .fc .fc-timegrid-all-day .fc-scroller-harness{height:auto !important;max-height:none !important;}
.tm-calendar-host .fc .fc-timegrid-all-day .fc-scroller,
#tmCalendarSideDockTimeline .fc .fc-timegrid-all-day .fc-scroller{height:auto !important;max-height:none !important;overflow:hidden !important;}
.tm-calendar-host .fc .fc-timegrid-all-day .fc-scrollgrid-sync-table,
#tmCalendarSideDockTimeline .fc .fc-timegrid-all-day .fc-scrollgrid-sync-table{height:auto !important;}
.tm-calendar-host .fc .fc-timegrid-all-day table,
#tmCalendarSideDockTimeline .fc .fc-timegrid-all-day table{height:auto !important;}
.tm-calendar-host .fc .fc-timegrid-all-day .fc-daygrid-body,
#tmCalendarSideDockTimeline .fc .fc-timegrid-all-day .fc-daygrid-body{height:auto !important;}
.tm-calendar-host .fc .fc-timegrid-all-day .fc-daygrid-day-frame,
#tmCalendarSideDockTimeline .fc .fc-timegrid-all-day .fc-daygrid-day-frame{min-height:0 !important;padding-bottom:0 !important;}
.tm-calendar-host .fc .fc-timegrid-all-day .fc-daygrid-day-events,
#tmCalendarSideDockTimeline .fc .fc-timegrid-all-day .fc-daygrid-day-events{margin-bottom:0 !important;min-height:0 !important;}
.tm-calendar-host .fc .fc-timegrid-all-day .fc-daygrid-day-bottom,
#tmCalendarSideDockTimeline .fc .fc-timegrid-all-day .fc-daygrid-day-bottom{margin-top:0 !important;padding-top:0 !important;line-height:1 !important;}
.tm-calendar-host .fc .fc-timegrid-all-day .fc-daygrid-more-link,
#tmCalendarSideDockTimeline .fc .fc-timegrid-all-day .fc-daygrid-more-link{margin:0 !important;}
.fc .fc-daygrid-body-natural .fc-daygrid-day-events{margin-bottom:0 !important;}
.fc .fc-timegrid-all-day .fc-daygrid-event,
.fc .fc-popover .fc-daygrid-event{padding-top:0 !important;padding-bottom:0 !important;}
.fc .fc-timegrid-all-day .fc-daygrid-event .fc-event-main,
.fc .fc-popover .fc-daygrid-event .fc-event-main{padding-top:0 !important;padding-bottom:0 !important;}
.fc .fc-timegrid-all-day .fc-daygrid-event .fc-event-main-frame,
.fc .fc-popover .fc-daygrid-event .fc-event-main-frame{display:flex !important;align-items:center !important;height:100%;}
.fc .fc-timegrid-all-day .fc-daygrid-event .fc-event-main,
.fc .fc-popover .fc-daygrid-event .fc-event-main{display:flex !important;align-items:center !important;height:100%;}
.fc .fc-timegrid-all-day .tm-cal-task-event,
.fc .fc-popover .tm-cal-task-event{height:100% !important;}
.fc .fc-timegrid-all-day .tm-cal-task-event-title,
.fc .fc-popover .tm-cal-task-event-title{line-height:1.1 !important;}
.fc .fc-timegrid-all-day .tm-cal-task-event-title-text,
.fc .fc-popover .tm-cal-task-event-title-text{line-height:1.1 !important;}
.fc a.fc-event:focus,
.fc .fc-daygrid-event:focus,
.fc .fc-daygrid-event:focus-within{outline:none !important;box-shadow:none !important;}
.tm-calendar-host .fc .fc-timegrid-now-indicator-container,
#tmCalendarSideDockTimeline .fc .fc-timegrid-now-indicator-container{overflow:visible !important;}
.tm-calendar-host .fc .fc-timegrid-now-indicator-line,
#tmCalendarSideDockTimeline .fc .fc-timegrid-now-indicator-line{border-top-width:2px !important;margin-top:-1px !important;overflow:visible !important;z-index:6 !important;}
.tm-calendar-host .fc .fc-timegrid-now-indicator-line::before,
#tmCalendarSideDockTimeline .fc .fc-timegrid-now-indicator-line::before{content:"";position:absolute;left:0;top:50%;width:10px;height:10px;border-radius:999px;background:var(--fc-now-indicator-color, #0078d4);transform:translate(-50%, -50%);box-shadow:0 0 0 2px var(--fc-page-bg-color, #fff);}
.tm-calendar-host .fc .fc-timegrid-now-indicator-arrow,
#tmCalendarSideDockTimeline .fc .fc-timegrid-now-indicator-arrow{display:none !important;}
        `.trim();
        const existing = document.getElementById(id);
        if (existing && existing.tagName === 'STYLE') {
            existing.textContent = css;
            return;
        }
        const st = document.createElement('style');
        st.id = id;
        st.textContent = css;
        document.head.appendChild(st);
    }

    function pad2(n) {
        return String(n).padStart(2, '0');
    }

    function parseDateOnly(s) {
        const v = String(s || '').trim();
        if (!v) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
            const d = new Date(`${v}T12:00:00`);
            return Number.isNaN(d.getTime()) ? null : d;
        }
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    function toDurationStr(minutes) {
        const n = Number(minutes);
        const m = Number.isFinite(n) && n > 0 ? Math.round(n) : 60;
        const h = Math.floor(m / 60);
        const mm = m % 60;
        return `${pad2(h)}:${pad2(mm)}`;
    }

    function formatDateKey(d) {
        if (!(d instanceof Date)) return '';
        if (Number.isNaN(d.getTime())) return '';
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }

    function toMs(value) {
        if (!value) return NaN;
        if (value instanceof Date) return value.getTime();
        const n = Date.parse(String(value));
        return Number.isFinite(n) ? n : NaN;
    }

    function parseColorToRgb(color) {
        const raw = String(color || '').trim();
        if (!raw) return null;
        const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (hex) {
            const body = hex[1];
            if (body.length === 3) {
                return {
                    r: parseInt(body[0] + body[0], 16),
                    g: parseInt(body[1] + body[1], 16),
                    b: parseInt(body[2] + body[2], 16),
                };
            }
            return {
                r: parseInt(body.slice(0, 2), 16),
                g: parseInt(body.slice(2, 4), 16),
                b: parseInt(body.slice(4, 6), 16),
            };
        }
        const rgb = raw.match(/^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})(?:\s*[,/]\s*[\d.]+\s*)?\)$/i);
        if (!rgb) return null;
        const r = Math.min(255, Math.max(0, Number(rgb[1])));
        const g = Math.min(255, Math.max(0, Number(rgb[2])));
        const b = Math.min(255, Math.max(0, Number(rgb[3])));
        if (![r, g, b].every((v) => Number.isFinite(v))) return null;
        return { r, g, b };
    }

    function toRgbaString(rgb, alpha) {
        if (!rgb || !Number.isFinite(rgb.r) || !Number.isFinite(rgb.g) || !Number.isFinite(rgb.b)) return '';
        const a = Math.min(1, Math.max(0, Number(alpha)));
        return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${a})`;
    }

    function isDarkThemeMode() {
        try {
            const roots = [document?.documentElement, document?.body];
            return roots.some((el) => String(el?.getAttribute?.('data-theme-mode') || '').trim() === 'dark');
        } catch (e) {}
        return false;
    }

    function applyScheduleEventColorVars(eventEl, color) {
        const el = eventEl instanceof Element ? eventEl : null;
        if (!el) return;
        const accent = String(color || '').trim() || '#0078d4';
        const rgb = parseColorToRgb(accent);
        const softBg = rgb ? toRgbaString(rgb, 0.36) : 'rgba(0, 120, 212, 0.36)';
        const softBorder = rgb ? toRgbaString(rgb, 0.42) : 'rgba(0, 120, 212, 0.42)';
        const hoverBg = rgb ? toRgbaString(rgb, 0.44) : 'rgba(0, 120, 212, 0.44)';
        const textColor = isDarkThemeMode() ? 'rgba(255, 255, 255, 0.96)' : '#222';
        try { el.style.setProperty('--tm-cal-schedule-accent', accent); } catch (e) {}
        try { el.style.setProperty('--tm-cal-schedule-text', textColor); } catch (e) {}
        try { el.style.setProperty('--tm-cal-schedule-bg', softBg); } catch (e) {}
        try { el.style.setProperty('--tm-cal-schedule-border', softBorder); } catch (e) {}
        try { el.style.setProperty('--tm-cal-schedule-hover-bg', hoverBg); } catch (e) {}
        try { el.classList.add('tm-cal-schedule-event'); } catch (e) {}
        try { el.style.setProperty('background', softBg, 'important'); } catch (e) {}
        try { el.style.setProperty('background-color', softBg, 'important'); } catch (e) {}
        try { el.style.setProperty('border', `1px solid ${softBorder}`, 'important'); } catch (e) {}
        try { el.style.setProperty('border-left', `4px solid ${accent}`, 'important'); } catch (e) {}
        try { el.style.setProperty('border-radius', '5px', 'important'); } catch (e) {}
        try { el.style.setProperty('box-shadow', 'none', 'important'); } catch (e) {}
        try { el.style.setProperty('color', textColor, 'important'); } catch (e) {}
        try {
            const nodes = el.querySelectorAll('.fc-event-main, .fc-event-main-frame, .fc-event-time, .fc-event-title, .tm-cal-task-event, .tm-cal-task-event-title, .tm-cal-task-event-title-text, .tm-cal-task-event-time, .tm-cal-schedule-stack');
            nodes.forEach((node) => {
                try { node.style.setProperty('color', textColor, 'important'); } catch (e2) {}
            });
        } catch (e) {}
    }

    function applyAllDaySoftEventColorVars(eventEl, color) {
        const el = eventEl instanceof Element ? eventEl : null;
        if (!el) return;
        const accent = String(color || '').trim() || '#0078d4';
        const rgb = parseColorToRgb(accent);
        const textColor = isDarkThemeMode() ? 'rgba(255, 255, 255, 0.96)' : '#222';
        const softBg = rgb ? toRgbaString(rgb, 0.36) : 'rgba(0, 120, 212, 0.36)';
        const softBorder = rgb ? toRgbaString(rgb, 0.42) : 'rgba(0, 120, 212, 0.42)';
        try { el.classList.add('tm-cal-allday-soft-event'); } catch (e) {}
        try { el.classList.remove('tm-cal-schedule-event'); } catch (e) {}
        try { el.style.setProperty('--tm-cal-schedule-accent', accent); } catch (e) {}
        try { el.style.setProperty('--tm-cal-schedule-text', textColor); } catch (e) {}
        try { el.style.setProperty('--tm-cal-schedule-bg', softBg); } catch (e) {}
        try { el.style.setProperty('--tm-cal-schedule-border', softBorder); } catch (e) {}
        try { el.style.setProperty('background', softBg, 'important'); } catch (e) {}
        try { el.style.setProperty('background-color', softBg, 'important'); } catch (e) {}
        try { el.style.setProperty('border', `1px solid ${softBorder}`, 'important'); } catch (e) {}
        try { el.style.setProperty('border-left', `1px solid ${softBorder}`, 'important'); } catch (e) {}
        try { el.style.setProperty('border-radius', '5px', 'important'); } catch (e) {}
        try { el.style.setProperty('box-shadow', 'none', 'important'); } catch (e) {}
        try { el.style.setProperty('color', textColor, 'important'); } catch (e) {}
        try {
            const nodes = el.querySelectorAll('.fc-event-main, .fc-event-main-frame, .fc-event-time, .fc-event-title, .tm-cal-task-event, .tm-cal-task-event-title, .tm-cal-task-event-title-text, .tm-cal-task-event-time, .tm-cal-schedule-stack');
            nodes.forEach((node) => {
                try { node.style.setProperty('color', textColor, 'important'); } catch (e2) {}
            });
        } catch (e) {}
    }

    function isAllDayRange(start, end) {
        if (!(start instanceof Date) || !(end instanceof Date)) return false;
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
        if (end.getTime() <= start.getTime()) return false;
        if (start.getHours() !== 0 || start.getMinutes() !== 0 || start.getSeconds() !== 0 || start.getMilliseconds() !== 0) return false;
        if (end.getHours() !== 0 || end.getMinutes() !== 0 || end.getSeconds() !== 0 || end.getMilliseconds() !== 0) return false;
        const days = (end.getTime() - start.getTime()) / 86400000;
        return Number.isInteger(days) && days >= 1;
    }

    function formatCalendarClockText(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
    }

    function formatCalendarShortDateText(date, includeYear = false) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        return includeYear
            ? formatDateKey(date)
            : `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    }

    function formatCalendarDateTimeText(date, includeYear = false) {
        const dateText = formatCalendarShortDateText(date, includeYear);
        const timeText = formatCalendarClockText(date);
        if (!dateText) return timeText;
        if (!timeText) return dateText;
        return `${dateText} ${timeText}`;
    }

    function formatScheduleEventRangeText(start, end, allDay) {
        const startDate = (start instanceof Date && !Number.isNaN(start.getTime())) ? start : null;
        if (!startDate) return '';
        const endDate = (end instanceof Date && !Number.isNaN(end.getTime()) && end.getTime() > startDate.getTime()) ? end : null;
        const isAllDayEvent = allDay === true || (endDate ? isAllDayRange(startDate, endDate) : false);
        if (isAllDayEvent) {
            if (!endDate) return '全天';
            const endShown = new Date(endDate.getTime() - 86400000);
            if (formatDateKey(startDate) === formatDateKey(endShown)) return '全天';
            const includeYear = startDate.getFullYear() !== endShown.getFullYear();
            return `${formatCalendarShortDateText(startDate, includeYear)} - ${formatCalendarShortDateText(endShown, includeYear)} 全天`;
        }
        if (!endDate) return formatCalendarClockText(startDate);
        if (formatDateKey(startDate) === formatDateKey(endDate)) {
            return `${formatCalendarClockText(startDate)} - ${formatCalendarClockText(endDate)}`;
        }
        const includeYear = startDate.getFullYear() !== endDate.getFullYear();
        return `${formatCalendarDateTimeText(startDate, includeYear)} - ${formatCalendarDateTimeText(endDate, includeYear)}`;
    }

    function buildTaskEventTitleNode(text, rangeText = '') {
        const title = document.createElement('span');
        title.className = 'tm-cal-task-event-title';
        const titleText = document.createElement('span');
        titleText.className = 'tm-cal-task-event-title-text';
        titleText.textContent = String(text || '').trim() || '任务';
        title.appendChild(titleText);
        const range = String(rangeText || '').trim();
        if (!range) return { title, titleText, timeText: null };
        title.classList.add('tm-cal-task-event-title--stack');
        const timeText = document.createElement('span');
        timeText.className = 'tm-cal-task-event-time';
        timeText.textContent = range;
        title.appendChild(timeText);
        return { title, titleText, timeText };
    }

    function applyTaskEventCheckboxOffset(inputEl) {
        if (!(inputEl instanceof HTMLElement)) return;
        try { inputEl.style.alignSelf = 'start'; } catch (e) {}
        try { inputEl.style.margin = '0'; } catch (e) {}
        try { inputEl.style.position = 'relative'; } catch (e) {}
        try { inputEl.style.top = '3px'; } catch (e) {}
        try { inputEl.style.transform = 'none'; } catch (e) {}
    }

    function overlap(s1, e1, s2, e2) {
        if (!Number.isFinite(s1) || !Number.isFinite(e1) || !Number.isFinite(s2) || !Number.isFinite(e2)) return false;
        return s1 < e2 && e1 > s2;
    }

    async function postJSON(url, data) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data || {}),
        });
        return res;
    }

    async function getFileText(path) {
        const res = await postJSON('/api/file/getFile', { path });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return unwrapGetFileText(await res.text());
    }

    function unwrapGetFileText(raw) {
        const text = String(raw ?? '');
        const trimmed = text.replace(/^\uFEFF/, '').trim();
        if (!trimmed) return '';
        if (!trimmed.startsWith('{')) return text;
        if (!/\"(code|msg|data|content)\"\s*:/.test(trimmed)) return text;
        let obj = null;
        try {
            obj = JSON.parse(trimmed);
        } catch (e) {
            throw new Error(`getFile response looks like JSON but failed to parse: ${e?.message || e}`);
        }
        if (obj && typeof obj === 'object') {
            if (typeof obj.data === 'string') return obj.data;
            if (typeof obj.content === 'string') return obj.content;
            if (obj.data && typeof obj.data === 'object' && typeof obj.data.content === 'string') return obj.data.content;
            if (typeof obj.msg === 'string' && typeof obj.code !== 'undefined') {
                throw new Error(`getFile error: ${obj.code} ${obj.msg}`);
            }
        }
        return text;
    }

    async function delay(ms) {
        return await new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
    }

    async function getFileTextRetry(path, retries) {
        const n = Math.max(0, Number(retries) || 0);
        let lastErr = null;
        for (let i = 0; i <= n; i += 1) {
            try {
                return await getFileText(path);
            } catch (e) {
                lastErr = e;
                if (i < n) await delay(220);
            }
        }
        throw lastErr || new Error('getFileTextRetry failed');
    }

    async function putFileText(path, text) {
        const formDir = new FormData();
        formDir.append('path', '/data/storage/petal/siyuan-plugin-task-horizon');
        formDir.append('isDir', 'true');
        try { await fetch('/api/file/putFile', { method: 'POST', body: formDir }).catch(() => null); } catch (e) {}
        const form = new FormData();
        form.append('path', path);
        form.append('isDir', 'false');
        form.append('file', new Blob([String(text ?? '')], { type: 'application/json' }));
        const res = await fetch('/api/file/putFile', { method: 'POST', body: form });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return true;
    }

    async function loadDockTomatoHistoryFallbackAll() {
        try {
            const raw = await getFileTextRetry(STORAGE.DOCK_TOMATO_FILE_NEW, 1);
            if (raw && raw.trim()) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed;
                if (parsed && typeof parsed === 'object') {
                    if (Array.isArray(parsed.data)) return parsed.data;
                    if (Array.isArray(parsed.items)) return parsed.items;
                    if (Array.isArray(parsed.records)) return parsed.records;
                    if (Array.isArray(parsed.history)) return parsed.history;
                }
                return [];
            }
        } catch (e) {}
        try {
            const raw = await getFileTextRetry(STORAGE.DOCK_TOMATO_FILE_LEGACY, 1);
            if (raw && raw.trim()) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed;
                if (parsed && typeof parsed === 'object') {
                    if (Array.isArray(parsed.data)) return parsed.data;
                    if (Array.isArray(parsed.items)) return parsed.items;
                    if (Array.isArray(parsed.records)) return parsed.records;
                    if (Array.isArray(parsed.history)) return parsed.history;
                }
                return [];
            }
        } catch (e) {}
        try {
            const raw = String(localStorage.getItem(STORAGE.DOCK_TOMATO_LS_KEY) || '');
            if (!raw.trim()) return [];
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
            if (parsed && typeof parsed === 'object') {
                if (Array.isArray(parsed.data)) return parsed.data;
                if (Array.isArray(parsed.items)) return parsed.items;
                if (Array.isArray(parsed.records)) return parsed.records;
                if (Array.isArray(parsed.history)) return parsed.history;
            }
            return [];
        } catch (e) {
            return [];
        }
    }

    function normalizeCalendarVisibleTime(value, fallback, allow24Hour = false) {
        const raw = String(value || '').trim();
        const safeFallback = String(fallback || '').trim() || (allow24Hour ? '24:00' : '00:00');
        const m = raw.match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return safeFallback;
        const hh = Number(m[1]);
        const mm = Number(m[2]);
        if (!Number.isInteger(hh) || !Number.isInteger(mm)) return safeFallback;
        if (mm !== 0 && mm !== 30) return safeFallback;
        if (hh < 0 || hh > (allow24Hour ? 24 : 23)) return safeFallback;
        if (hh === 24 && mm !== 0) return safeFallback;
        return `${pad2(hh)}:${pad2(mm)}`;
    }

    function getCalendarVisibleSlotRange(settings) {
        const start = normalizeCalendarVisibleTime(settings?.visibleStartTime, '00:00', false);
        const end = normalizeCalendarVisibleTime(settings?.visibleEndTime, '24:00', true);
        const toMinutes = (text) => {
            const [hh, mm] = String(text || '').split(':').map((it) => Number(it));
            if (!Number.isInteger(hh) || !Number.isInteger(mm)) return NaN;
            return hh * 60 + mm;
        };
        const startMin = toMinutes(start);
        const endMin = toMinutes(end);
        if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) {
            return { start: '00:00', end: '24:00', slotMinTime: '00:00:00', slotMaxTime: '24:00:00' };
        }
        return {
            start,
            end,
            slotMinTime: `${start}:00`,
            slotMaxTime: end === '24:00' ? '24:00:00' : `${end}:00`,
        };
    }

    function buildCalendarVisibleTimeOptions(selectedValue, allow24Hour = false) {
        const selected = normalizeCalendarVisibleTime(selectedValue, allow24Hour ? '24:00' : '00:00', allow24Hour);
        const maxHour = allow24Hour ? 24 : 23;
        const options = [];
        for (let hh = 0; hh <= maxHour; hh += 1) {
            for (const mm of [0, 30]) {
                if (hh === 24 && mm !== 0) continue;
                const value = `${pad2(hh)}:${pad2(mm)}`;
                options.push(`<option value="${value}" ${value === selected ? 'selected' : ''}>${value}</option>`);
            }
        }
        return options.join('');
    }

    function applyCalendarVisibleSlotRange(calendar, settings) {
        if (!calendar) return false;
        const range = getCalendarVisibleSlotRange(settings || getSettings());
        try { calendar.setOption('slotMinTime', range.slotMinTime); } catch (e) {}
        try { calendar.setOption('slotMaxTime', range.slotMaxTime); } catch (e) {}
        return true;
    }

    function getTimeGridSlotLayoutOptions(settings) {
        const visibleRange = getCalendarVisibleSlotRange(settings || getSettings());
        return {
            slotDuration: '00:30:00',
            slotLabelInterval: '01:00',
            slotMinTime: visibleRange.slotMinTime,
            slotMaxTime: visibleRange.slotMaxTime,
            slotLabelContent: (arg) => {
                const d = arg?.date;
                if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
                return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
            },
        };
    }

    function normalizeCalendarHourSlotHeightMode(value) {
        const mode = String(value || '').trim();
        return Object.prototype.hasOwnProperty.call(CALENDAR_HOUR_SLOT_HEIGHT_DELTA_MAP, mode) ? mode : 'normal';
    }

    function getCalendarHalfHourSlotHeight(settings) {
        const source = (settings && typeof settings === 'object') ? settings : getSettings();
        const mode = normalizeCalendarHourSlotHeightMode(source?.hourSlotHeightMode || source?.calendarHourSlotHeightMode);
        return SIDE_DAY_HALF_HOUR_SLOT_HEIGHT + (CALENDAR_HOUR_SLOT_HEIGHT_DELTA_MAP[mode] / 2);
    }

    function applyCalendarSlotHeightStyle(rootEl, settings) {
        if (!(rootEl instanceof HTMLElement)) return false;
        const slotHeight = getCalendarHalfHourSlotHeight(settings);
        try { rootEl.style.setProperty('--tm-calendar-half-hour-slot-height', `${slotHeight}px`); } catch (e) {}
        return true;
    }

    function getSideDayContentHeight(settings) {
        const range = getCalendarVisibleSlotRange(settings || getSettings());
        const toMinutes = (value) => {
            const raw = String(value || '').trim();
            const m = raw.match(/^(\d{2}):(\d{2})/);
            if (!m) return NaN;
            return Number(m[1]) * 60 + Number(m[2]);
        };
        const minMinutes = toMinutes(range.slotMinTime);
        const maxMinutes = toMinutes(range.slotMaxTime);
        const totalMinutes = Number.isFinite(minMinutes) && Number.isFinite(maxMinutes) && maxMinutes > minMinutes
            ? (maxMinutes - minMinutes)
            : 24 * 60;
        const slotCount = Math.max(1, Math.round(totalMinutes / 30));
        return slotCount * getCalendarHalfHourSlotHeight(settings);
    }

    function getTimeGridSlotHeight(rootEl, fallback) {
        const safeFallback = Number.isFinite(Number(fallback)) ? Number(fallback) : getCalendarHalfHourSlotHeight();
        if (!(rootEl instanceof HTMLElement)) return safeFallback;
        const selectors = [
            '.fc-timegrid-slots tr',
            '.fc-timegrid-slot-frame',
            '.fc-timegrid-slot-lane',
            '.fc-timegrid-slot-label',
            '.fc-timegrid-slot',
        ];
        for (const selector of selectors) {
            const el = rootEl.querySelector(selector);
            if (!(el instanceof HTMLElement)) continue;
            try {
                const rect = el.getBoundingClientRect();
                if (Number.isFinite(rect.height) && rect.height > 0) return rect.height;
            } catch (e) {}
            try {
                const raw = window.getComputedStyle(el).height;
                const parsed = Number.parseFloat(raw);
                if (Number.isFinite(parsed) && parsed > 0) return parsed;
            } catch (e) {}
        }
        return safeFallback;
    }

    function forceSideDaySlotHeight(rootEl, settings) {
        if (!(rootEl instanceof HTMLElement)) return false;
        const nextSettings = settings || getSettings();
        const slotHeight = getCalendarHalfHourSlotHeight(nextSettings);
        const contentHeight = getSideDayContentHeight(nextSettings);
        try { applyCalendarSlotHeightStyle(rootEl, nextSettings); } catch (e) {}
        const slotSelectors = [
            '.fc-timegrid-slots tr',
            '.fc-timegrid-slots td',
            '.fc-timegrid-slot',
            '.fc-timegrid-slot-lane',
            '.fc-timegrid-slot-label',
            '.fc-timegrid-slot-frame',
        ];
        for (const selector of slotSelectors) {
            const nodes = rootEl.querySelectorAll(selector);
            for (const node of nodes) {
                if (!(node instanceof HTMLElement)) continue;
                try { node.style.height = `${slotHeight}px`; } catch (e) {}
                try { node.style.minHeight = `${slotHeight}px`; } catch (e) {}
                try { node.style.maxHeight = `${slotHeight}px`; } catch (e) {}
                try { node.style.boxSizing = 'border-box'; } catch (e) {}
            }
        }
        const slotsTable = rootEl.querySelector('.fc-timegrid-slots table');
        if (slotsTable instanceof HTMLElement) {
            try { slotsTable.style.height = `${contentHeight}px`; } catch (e) {}
            try { slotsTable.style.minHeight = `${contentHeight}px`; } catch (e) {}
        }
        const body = rootEl.querySelector('.fc-timegrid-body');
        if (body instanceof HTMLElement) {
            try { body.style.height = `${contentHeight}px`; } catch (e) {}
            try { body.style.minHeight = `${contentHeight}px`; } catch (e) {}
        }
        const cols = rootEl.querySelector('.fc-timegrid-cols');
        if (cols instanceof HTMLElement) {
            try { cols.style.height = `${contentHeight}px`; } catch (e) {}
            try { cols.style.minHeight = `${contentHeight}px`; } catch (e) {}
        }
        return true;
    }

    function syncSideDayLayout(rootEl, calendar, settings) {
        if (!(rootEl instanceof HTMLElement)) return false;
        const nextSettings = settings || getSettings();
        const contentHeight = getSideDayContentHeight(nextSettings);
        try { calendar?.setOption?.('height', 'auto'); } catch (e) {}
        try { calendar?.setOption?.('contentHeight', contentHeight); } catch (e) {}
        try { forceSideDaySlotHeight(rootEl, nextSettings); } catch (e) {}
        try { calendar?.updateSize?.(); } catch (e) {}
        try { enhanceNowIndicator(rootEl); } catch (e) {}
        try {
            requestAnimationFrame(() => {
                try { forceSideDaySlotHeight(rootEl, nextSettings); } catch (e2) {}
                try { calendar?.updateSize?.(); } catch (e2) {}
                try { enhanceNowIndicator(rootEl); } catch (e2) {}
            });
        } catch (e) {}
        return true;
    }

    function enhanceNowIndicator(rootEl) {
        if (!(rootEl instanceof HTMLElement)) return false;
        const pageBg = String(window.getComputedStyle(rootEl).getPropertyValue('--fc-page-bg-color') || '').trim() || '#fff';
        const nowColor = String(window.getComputedStyle(rootEl).getPropertyValue('--fc-now-indicator-color') || '').trim() || '#0078d4';
        const containers = rootEl.querySelectorAll('.fc-timegrid-now-indicator-container');
        containers.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            try { node.style.setProperty('overflow', 'visible', 'important'); } catch (e) {}
        });
        const arrows = rootEl.querySelectorAll('.fc-timegrid-now-indicator-arrow');
        arrows.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            try { node.style.setProperty('display', 'none', 'important'); } catch (e) {}
        });
        const lines = rootEl.querySelectorAll('.fc-timegrid-now-indicator-line');
        lines.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            try { node.style.setProperty('border-top-width', '2px', 'important'); } catch (e) {}
            try { node.style.setProperty('margin-top', '-1px', 'important'); } catch (e) {}
            try { node.style.setProperty('overflow', 'visible', 'important'); } catch (e) {}
            try { node.style.setProperty('z-index', '6', 'important'); } catch (e) {}
            let dot = node.querySelector('.tm-now-indicator-dot');
            if (!(dot instanceof HTMLElement)) {
                dot = document.createElement('span');
                dot.className = 'tm-now-indicator-dot';
                try { node.appendChild(dot); } catch (e) { dot = null; }
            }
            if (!(dot instanceof HTMLElement)) return;
            try { dot.style.position = 'absolute'; } catch (e) {}
            try { dot.style.left = '0'; } catch (e) {}
            try { dot.style.top = '50%'; } catch (e) {}
            try { dot.style.width = '10px'; } catch (e) {}
            try { dot.style.height = '10px'; } catch (e) {}
            try { dot.style.borderRadius = '999px'; } catch (e) {}
            try { dot.style.transform = 'translate(-50%, -50%)'; } catch (e) {}
            try { dot.style.background = nowColor; } catch (e) {}
            try { dot.style.boxShadow = `0 0 0 2px ${pageBg}`; } catch (e) {}
            try { dot.style.pointerEvents = 'none'; } catch (e) {}
            try { dot.style.display = 'block'; } catch (e) {}
            try { dot.style.zIndex = '1'; } catch (e) {}
        });
        return lines.length > 0;
    }

    function refreshCalendarSlotHeight(settings) {
        const nextSettings = settings || getSettings();
        try { applyCalendarSlotHeightStyle(state.wrapEl, nextSettings); } catch (e) {}
        try { state.calendar?.updateSize?.(); } catch (e) {}
        try { syncSideDayLayout(state.sideDay?.rootEl, state.sideDay?.calendar, nextSettings); } catch (e) {}
        try {
            requestAnimationFrame(() => {
                try { applyCalendarSlotHeightStyle(state.wrapEl, nextSettings); } catch (e2) {}
                try { state.calendar?.updateSize?.(); } catch (e2) {}
                try { syncSideDayLayout(state.sideDay?.rootEl, state.sideDay?.calendar, nextSettings); } catch (e2) {}
            });
        } catch (e) {}
        return true;
    }

    function getSettings() {
        const liveStore = state.settingsStore || state.sideDay?.settingsStore || null;
        const s = liveStore?.data || {};
        const preferLiveStore = !!liveStore?.loaded;
        const normalizeNewScheduleMaxDuration = (value) => {
            const allowed = [60, 120, 180, 240];
            const num = Number(value);
            return allowed.includes(num) ? num : 60;
        };
        const readStoredString = (key, fallback) => {
            if (preferLiveStore && typeof fallback !== 'undefined' && fallback !== null && String(fallback).trim() !== '') {
                return String(fallback);
            }
            try {
                const raw = localStorage.getItem(key);
                if (raw != null && String(raw).trim() !== '') return String(raw);
            } catch (e) {
            }
            if (typeof fallback !== 'undefined' && fallback !== null) return String(fallback);
            return '';
        };
        const readStoredBool = (key, fallback) => {
            if (preferLiveStore && typeof fallback === 'boolean') return fallback;
            try {
                const raw = localStorage.getItem(key);
                if (raw != null) {
                    const v = String(raw).trim().toLowerCase();
                    return v === 'true' || v === '1';
                }
            } catch (e) {
            }
            if (typeof fallback === 'boolean') return fallback;
            return false;
        };
        const tomatoMaster = s.calendarShowTomatoMaster !== false;
        const allDayTime0 = readStoredString('tm_calendar_all_day_reminder_time', s.calendarAllDayReminderTime).trim() || '09:00';
        const defaultMode0 = readStoredString('tm_calendar_schedule_reminder_default_mode', s.calendarScheduleReminderDefaultMode).trim() || '0';
        const hourSlotHeightMode0 = normalizeCalendarHourSlotHeightMode(readStoredString('tm_calendar_hour_slot_height_mode', s.calendarHourSlotHeightMode).trim() || 'normal');
        const visibleStartTime0 = normalizeCalendarVisibleTime(readStoredString('tm_calendar_visible_start_time', s.calendarVisibleStartTime).trim() || '00:00', '00:00', false);
        const visibleEndTime0 = normalizeCalendarVisibleTime(readStoredString('tm_calendar_visible_end_time', s.calendarVisibleEndTime).trim() || '24:00', '24:00', true);
        return {
            enabled: !!s.calendarEnabled,
            linkDockTomato: !!s.calendarLinkDockTomato,
            firstDay: Number(s.calendarFirstDay) === 0 ? 0 : 1,
            monthAggregate: !!s.calendarMonthAggregate,
            showSchedule: s.calendarShowSchedule !== false,
            scheduleReminderEnabled: readStoredBool('tm_calendar_schedule_reminder_enabled', typeof s.calendarScheduleReminderEnabled === 'boolean' ? !!s.calendarScheduleReminderEnabled : undefined),
            scheduleReminderSystemEnabled: readStoredBool('tm_calendar_schedule_reminder_system_enabled', typeof s.calendarScheduleReminderSystemEnabled === 'boolean' ? !!s.calendarScheduleReminderSystemEnabled : undefined),
            scheduleReminderDefaultMode: defaultMode0,
            allDayReminderEnabled: readStoredBool('tm_calendar_all_day_reminder_enabled', typeof s.calendarAllDayReminderEnabled === 'boolean' ? !!s.calendarAllDayReminderEnabled : undefined),
            allDayReminderTime: allDayTime0 || '09:00',
            showTaskDates: s.calendarShowTaskDates !== false,
            newScheduleMaxDurationMin: normalizeNewScheduleMaxDuration(s.calendarNewScheduleMaxDurationMin),
            hourSlotHeightMode: hourSlotHeightMode0,
            taskDateAllDayReminderEnabled: readStoredBool('tm_calendar_taskdate_all_day_reminder_enabled', typeof s.calendarTaskDateAllDayReminderEnabled === 'boolean' ? !!s.calendarTaskDateAllDayReminderEnabled : undefined),
            allDaySummaryIncludeExtras: s.calendarAllDaySummaryIncludeExtras !== false,
            taskDateColorMode: String(s.calendarTaskDateColorMode || 'group').trim() || 'group',
            scheduleColor: String(s.calendarScheduleColor || '').trim(),
            taskDatesColor: String(s.calendarTaskDatesColor || '').trim(),
            visibleStartTime: visibleStartTime0,
            visibleEndTime: visibleEndTime0,
            showCnHoliday: !!s.calendarShowCnHoliday,
            cnHolidayColor: String(s.calendarCnHolidayColor || '#ff3333').trim() || '#ff3333',
            showLunar: !!s.calendarShowLunar,
            showTomatoMaster: tomatoMaster,
            showFocus: tomatoMaster && (s.calendarShowFocus !== false),
            showBreak: tomatoMaster && (s.calendarShowBreak !== false),
            showStopwatch: tomatoMaster && (s.calendarShowStopwatch !== false),
            showIdle: tomatoMaster && !!s.calendarShowIdle,
            colorFocus: String(s.calendarColorFocus || '#1a73e8'),
            colorBreak: String(s.calendarColorBreak || '#34a853'),
            colorStopwatch: String(s.calendarColorStopwatch || '#f9ab00'),
            colorIdle: String(s.calendarColorIdle || '#9aa0a6'),
            calendarsConfig: (s.calendarCalendarsConfig && typeof s.calendarCalendarsConfig === 'object' && !Array.isArray(s.calendarCalendarsConfig)) ? s.calendarCalendarsConfig : {},
            defaultCalendarId: String(s.calendarDefaultCalendarId || 'default'),
            lastViewType: String(s.calendarLastViewType || '').trim(),
            lastDate: String(s.calendarLastDate || '').trim(),
            sidebarWidth: Number(s.calendarSidebarWidth) || 280,
            collapseCalendars: !!s.calendarSidebarCollapseCalendars,
            collapseDocGroups: !!s.calendarSidebarCollapseDocGroups,
            collapseTomato: !!s.calendarSidebarCollapseTomato,
            collapseTasks: !!s.calendarSidebarCollapseTasks,
        };
    }

    function modeLabel(mode) {
        const m = String(mode || '').trim();
        if (m === 'break' || m === 'stopwatch-break') return '休息';
        if (m === 'stopwatch') return '正计时';
        if (m === 'idle') return '闲置';
        return '专注';
    }

    function shouldShowMode(mode, settings) {
        const m = String(mode || '').trim();
        if (m === 'break' || m === 'stopwatch-break') return !!settings.showBreak;
        if (m === 'stopwatch') return !!settings.showStopwatch;
        if (m === 'idle') return !!settings.showIdle;
        return !!settings.showFocus;
    }

    function hashColor(input) {
        const s = String(input || '');
        let h = 2166136261;
        for (let i = 0; i < s.length; i += 1) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        const r = (h >>> 16) & 255;
        const g = (h >>> 8) & 255;
        const b = h & 255;
        const hex = (n) => n.toString(16).padStart(2, '0');
        return `#${hex(r)}${hex(g)}${hex(b)}`;
    }

    function calendarIdForGroup(groupId) {
        return `group:${String(groupId || '').trim()}`;
    }

    function getCalendarDefs(settings) {
        const list = [{ id: 'default', name: '未分组', color: '#0078d4' }];
        const groups = state.settingsStore?.data?.docGroups || state.sideDay?.settingsStore?.data?.docGroups;
        if (Array.isArray(groups)) {
            for (const g of groups) {
                const gid = String(g?.id || '').trim();
                const name = String(g?.name || '').trim();
                if (!gid || !name) continue;
                list.push({ id: calendarIdForGroup(gid), name, color: hashColor(gid) });
            }
        }
        const cfg = settings?.calendarsConfig || {};
        return list.map((c) => {
            const entry = cfg?.[c.id];
            const color = (entry && typeof entry === 'object' && typeof entry.color === 'string' && entry.color.trim()) ? entry.color.trim() : c.color;
            return { ...c, color };
        });
    }

    function isCalendarEnabled(calendarId, settings) {
        const cfg = settings?.calendarsConfig || {};
        const entry = cfg?.[calendarId];
        if (!entry || typeof entry !== 'object') return true;
        if ('enabled' in entry) return !!entry.enabled;
        return true;
    }

    function pickDefaultCalendarId(settings) {
        const defs = getCalendarDefs(settings);
        const preferred = String(settings?.defaultCalendarId || 'default');
        if (defs.some((d) => d.id === preferred && isCalendarEnabled(d.id, settings))) return preferred;
        const firstEnabled = defs.find((d) => isCalendarEnabled(d.id, settings));
        return firstEnabled ? firstEnabled.id : 'default';
    }

    function renderSidebar(wrap, settings) {
        if (!wrap) return;
        const calList = wrap.querySelector('[data-tm-cal-role="calendar-list"]');
        const tomatoList = wrap.querySelector('[data-tm-cal-role="tomato-list"]');
        const secCalendars = wrap.querySelector('[data-tm-cal-collapse="calendars"]')?.closest?.('.tm-calendar-nav-section') || null;
        const secTomato = wrap.querySelector('[data-tm-cal-collapse="tomato"]')?.closest?.('.tm-calendar-nav-section') || null;
        const secTasks = wrap.querySelector('[data-tm-cal-collapse="tasks"]')?.closest?.('.tm-calendar-nav-section') || null;
        const masterSchedule = wrap.querySelector('[data-tm-cal-master="schedule"]');
        const masterTomato = wrap.querySelector('[data-tm-cal-master="tomato"]');
        const defs = getCalendarDefs(settings);
        const showSchedule = !!settings.showSchedule;
        const taskDatesCanCustomize = String(settings.taskDateColorMode || 'group').trim() !== 'group';
        const taskDatesDot = taskDatesCanCustomize ? (settings.taskDatesColor || '#6b7280') : '#6b7280';
        const showTomato = !!settings.linkDockTomato;

        if (calList) {
            const calItems = [];
            calItems.push(`
                <div class="tm-calendar-nav-item-row">
                    <label class="tm-calendar-nav-item tm-calendar-nav-item--grow">
                        <span class="tm-calendar-nav-left">
                            <span class="tm-calendar-nav-dot" style="background:${esc(taskDatesDot)};" ${taskDatesCanCustomize ? `data-tm-cal-color-kind="taskDates" data-tm-cal-color-key="taskDates" data-tm-cal-color-value="${esc(taskDatesDot)}"` : ''}></span>
                            <span class="tm-calendar-nav-label">跨天任务</span>
                        </span>
                        <input class="tm-calendar-nav-check" type="checkbox" data-tm-cal-filter="taskDatesMaster" ${settings.showTaskDates ? 'checked' : ''}>
                    </label>
                </div>
            `);
            calItems.push(`
                <label class="tm-calendar-nav-item">
                    <span class="tm-calendar-nav-left">
                        <span class="tm-calendar-nav-dot" style="background:${esc(settings.cnHolidayColor || '#ff3333')};" data-tm-cal-color-kind="cnHoliday" data-tm-cal-color-key="cnHoliday" data-tm-cal-color-value="${esc(settings.cnHolidayColor || '#ff3333')}"></span>
                        <span class="tm-calendar-nav-label">节假日</span>
                    </span>
                    <input class="tm-calendar-nav-check" type="checkbox" data-tm-cal-filter="cnHoliday" ${settings.showCnHoliday ? 'checked' : ''}>
                </label>
            `);
            calItems.push(`
                <div class="tm-calendar-nav-item-row">
                    <label class="tm-calendar-nav-item tm-calendar-nav-item--grow">
                        <span class="tm-calendar-nav-left">
                            <span class="tm-calendar-nav-dot" style="background:${esc(settings.scheduleColor || '#0078d4')};" data-tm-cal-color-kind="schedule" data-tm-cal-color-key="schedule" data-tm-cal-color-value="${esc(settings.scheduleColor || '#0078d4')}"></span>
                            <span class="tm-calendar-nav-label">文档分组</span>
                        </span>
                        <input class="tm-calendar-nav-check" type="checkbox" data-tm-cal-filter="scheduleMaster" ${showSchedule ? 'checked' : ''}>
                    </label>
                    <span class="tm-calendar-nav-chevron" data-tm-cal-collapse="docGroups"></span>
                </div>
            `);
            if (!settings.collapseDocGroups) {
                for (const d of defs) {
                    const enabled = isCalendarEnabled(d.id, settings);
                    calItems.push(`
                        <div class="tm-calendar-nav-item-row tm-calendar-nav-item--indent ${!showSchedule ? 'tm-calendar-nav-item--disabled' : ''}">
                            <label class="tm-calendar-nav-item tm-calendar-nav-item--grow ${!showSchedule ? 'tm-calendar-nav-item--disabled' : ''}">
                                <span class="tm-calendar-nav-left">
                                    <span class="tm-calendar-nav-dot" style="background:${esc(d.color)};" data-tm-cal-color-kind="calendar" data-tm-cal-color-key="${esc(d.id)}" data-tm-cal-color-value="${esc(d.color)}"></span>
                                    <span class="tm-calendar-nav-label">${esc(d.name)}</span>
                                </span>
                                <input class="tm-calendar-nav-check" type="checkbox" data-tm-cal-calendar="${esc(d.id)}" ${enabled ? 'checked' : ''} ${showSchedule ? '' : 'disabled'}>
                            </label>
                        </div>
                    `);
                }
            }
            calList.innerHTML = calItems.join('');
        }

        if (secTomato) {
            try { secTomato.style.display = showTomato ? '' : 'none'; } catch (e) {}
        }
        if (tomatoList) {
            if (!showTomato) {
                tomatoList.innerHTML = '';
            } else {
            const items = [
                { key: 'focus', label: '专注', color: settings.colorFocus, checked: settings.showFocus !== false },
                { key: 'break', label: '休息', color: settings.colorBreak, checked: settings.showBreak !== false },
                { key: 'stopwatch', label: '正计时', color: settings.colorStopwatch, checked: settings.showStopwatch !== false },
                { key: 'idle', label: '闲置', color: settings.colorIdle, checked: !!settings.showIdle },
            ];
            tomatoList.innerHTML = items.map((it) => `
                <div class="tm-calendar-nav-item-row">
                    <label class="tm-calendar-nav-item tm-calendar-nav-item--grow">
                        <span class="tm-calendar-nav-left">
                            <span class="tm-calendar-nav-dot" style="background:${esc(it.color || '#9aa0a6')};" data-tm-cal-color-kind="tomato" data-tm-cal-color-key="${esc(it.key)}" data-tm-cal-color-value="${esc(it.color || '#9aa0a6')}"></span>
                            <span class="tm-calendar-nav-label">${esc(it.label)}</span>
                        </span>
                        <input class="tm-calendar-nav-check" type="checkbox" data-tm-cal-filter="${esc(it.key)}" ${it.checked ? 'checked' : ''} ${settings.showTomatoMaster ? '' : 'disabled'}>
                    </label>
                </div>
            `).join('');
            }
        }

        try {
            if (secCalendars) secCalendars.classList.toggle('tm-calendar-nav-section--collapsed', !!settings.collapseCalendars);
            if (secTomato) secTomato.classList.toggle('tm-calendar-nav-section--collapsed', !!settings.collapseTomato);
            if (secTasks) secTasks.classList.toggle('tm-calendar-nav-section--collapsed', !!settings.collapseTasks);
        } catch (e) {}
        try {
            if (masterSchedule) masterSchedule.checked = !!settings.showSchedule;
            if (masterTomato) {
                masterTomato.checked = showTomato ? !!settings.showTomatoMaster : false;
                masterTomato.disabled = !showTomato;
            }
        } catch (e) {}
    }

    function renderTaskPanel(wrap, settings) {
        const el = wrap?.querySelector?.('[data-tm-cal-role="task-list"]');
        state.taskListEl = el || null;
        if (!el) return;
        const api = globalThis.tmQueryCalendarTasks;
        if (typeof api !== 'function') {
            el.innerHTML = `<div class="tm-calendar-task-empty">未检测到任务数据</div>`;
            return;
        }
        let res = null;
        try { res = api({ pageSize: 60, page: 1, query: '' }) || null; } catch (e) { res = null; }
        const tasks = Array.isArray(res?.items) ? res.items : [];
        if (tasks.length === 0) {
            el.innerHTML = `<div class="tm-calendar-task-empty">暂无任务</div>`;
            return;
        }
        const defs = getCalendarDefs(settings);
        const colorMap = new Map(defs.map((d) => [d.id, d.color]));
        el.innerHTML = tasks.map((t) => {
            const id = String(t?.id || '').trim();
            if (!id) return '';
            const title = String(t?.title || '').trim();
            const spent = String(t?.spent || '').trim();
            const durationMin = Number(t?.durationMin);
            const depth = Number(t?.depth) || 0;
            const calendarId = String(t?.calendarId || 'default').trim() || 'default';
            const dot = colorMap.get(calendarId) || '#0078d4';
            const safeDuration = (Number.isFinite(durationMin) && durationMin > 0) ? Math.round(durationMin) : 60;
            return `
                <div class="tm-cal-task" draggable="true" data-tm-task-item="1" style="padding-left:${6 + Math.min(6, Math.max(0, depth)) * 10}px" data-task-id="${esc(id)}" data-task-title="${esc(title)}" data-task-spent="${esc(spent)}" data-task-duration-min="${esc(String(safeDuration))}" data-calendar-id="${esc(calendarId)}">
                    <div class="tm-cal-task-left">
                        <span class="tm-cal-task-dot" style="background:${esc(dot)};"></span>
                        <div class="tm-cal-task-title" title="${esc(title)}">${esc(title)}</div>
                    </div>
                    <div class="tm-cal-task-spent" title="${esc(spent)}">${esc(spent)}</div>
                </div>
            `;
        }).join('');
    }

    function bindTaskDraggable(settings) {
        try {
            if (state.taskDraggable && typeof state.taskDraggable.destroy === 'function') state.taskDraggable.destroy();
        } catch (e) {}
        state.taskDraggable = null;
        const Draggable = globalThis.FullCalendar?.Draggable;
        if (typeof Draggable !== 'function') return;
        const host = state.taskListEl;
        if (!host) return;
        const isTableBody = String(host?.tagName || '').toUpperCase() === 'TBODY';
        try {
            state.taskDraggable = new Draggable(host, {
                itemSelector: isTableBody ? 'tr[data-id]' : '.tm-cal-task',
                eventData: (el) => {
                    let taskId = '';
                    let title = '';
                    let calendarId = '';
                    let durMin = NaN;
                    if (isTableBody) {
                        taskId = String(el?.getAttribute?.('data-id') || '').trim();
                        calendarId = String(el?.getAttribute?.('data-calendar-id') || '').trim();
                        try {
                            const meta = (typeof window.tmCalendarGetTaskDragMeta === 'function') ? window.tmCalendarGetTaskDragMeta(taskId) : null;
                            title = String(meta?.title || '').trim();
                            if (!calendarId) calendarId = String(meta?.calendarId || '').trim();
                            durMin = Number(meta?.durationMin);
                        } catch (e) {}
                        if (!title) {
                            try { title = String(el?.querySelector?.('.tm-task-content-clickable')?.textContent || '').trim(); } catch (e) {}
                        }
                    } else {
                        taskId = String(el?.getAttribute?.('data-task-id') || '').trim();
                        title = String(el?.getAttribute?.('data-task-title') || '').trim();
                        calendarId = String(el?.getAttribute?.('data-calendar-id') || '').trim();
                        durMin = Number(el?.getAttribute?.('data-task-duration-min'));
                    }
                    if (!calendarId) calendarId = pickDefaultCalendarId(settings);
                    const safeMin = clampNewScheduleDurationMin(durMin, settings);
                    return {
                        title: title || '任务',
                        duration: toDurationStr(safeMin),
                        extendedProps: {
                            __tmTaskId: taskId,
                            __tmDurationMin: safeMin,
                            calendarId,
                        },
                    };
                },
            });
        } catch (e) {
            state.taskDraggable = null;
        }
    }

    function renderTaskPage(wrap, settings) {
        const root = wrap?.querySelector?.('[data-tm-cal-role="task-page"]');
        const host = wrap?.querySelector?.('[data-tm-cal-role="task-table"]');
        if (!root || !host) return;
        const savedTop = Number(host.scrollTop) || 0;
        const savedLeft = Number(host.scrollLeft) || 0;
        const api = globalThis.tmRenderCalendarTaskTableHtml;
        if (typeof api !== 'function') {
            host.innerHTML = `<div class="tm-calendar-task-empty">未检测到任务表格渲染接口</div>`;
            state.taskListEl = null;
            return;
        }
        let html = '';
        try { html = String(api() || ''); } catch (e) { html = ''; }
        host.innerHTML = html || `<div class="tm-calendar-task-empty">暂无任务</div>`;
        try { host.scrollTop = savedTop; } catch (e) {}
        try { host.scrollLeft = savedLeft; } catch (e) {}
        state.taskListEl = host.querySelector('#tmTaskTable tbody');
        try { state.taskTableAbort?.abort?.(); } catch (e) {}
        try {
            const abort = new AbortController();
            state.taskTableAbort = abort;

            const getTaskIdFromEvent = (ev) => {
                const target = ev?.target;
                if (!(target instanceof Element)) return '';
                const tr = target.closest('tr[data-id]');
                return String(tr?.getAttribute?.('data-id') || '').trim();
            };

            host.addEventListener('mousedown', (e) => {
                const target = e.target;
                if (!(target instanceof Element)) return;
                const resizeHandle = target.closest('.tm-col-resize');
                if (!resizeHandle) return;
                const th = resizeHandle.closest('th[data-col]');
                const col = String(th?.getAttribute?.('data-col') || '').trim();
                if (!col) return;
                if (typeof window.startColResize === 'function') {
                    try { window.startColResize(e, col); } catch (e2) {}
                }
            }, { signal: abort.signal });

            host.addEventListener('change', (e) => {
                const el = e.target;
                if (!(el instanceof HTMLInputElement)) return;
                if (String(el.type || '').toLowerCase() !== 'checkbox') return;
                const taskId = getTaskIdFromEvent(e);
                if (!taskId) return;
                if (el.classList.contains('tm-task-checkbox')) {
                    const tr = el.closest('tr[data-id]');
                    const textEl = tr?.querySelector?.('.tm-task-text');
                    try {
                        if (textEl && textEl.classList) textEl.classList.toggle('tm-task-done', !!el.checked);
                    } catch (e2) {}
                    if (typeof window.tmSetDone === 'function') {
                        try { window.tmSetDone(taskId, !!el.checked, e); } catch (e2) {}
                    }
                    return;
                }
                if (String(el.title || '').trim() === '置顶') {
                    if (typeof window.tmSetPinned === 'function') {
                        try { window.tmSetPinned(taskId, !!el.checked, e); } catch (e2) {}
                    }
                }
            }, { signal: abort.signal, capture: true });

            host.addEventListener('click', (e) => {
                const target = e.target;
                if (!(target instanceof Element)) return;

                const groupRow = target.closest('tr[data-group-key]');
                if (groupRow) {
                    const key = String(groupRow.getAttribute('data-group-key') || '').trim();
                    if (key && typeof window.tmToggleGroupCollapse === 'function') {
                        try { window.tmToggleGroupCollapse(key, e); } catch (e2) {}
                    }
                    return;
                }

                const taskId = getTaskIdFromEvent(e);
                if (!taskId) return;

                if (target.closest('.tm-tree-toggle')) {
                    if (typeof window.tmToggleCollapse === 'function') {
                        try { window.tmToggleCollapse(taskId, e); } catch (e2) {}
                    }
                    return;
                }

                if (target.closest('.tm-task-content-clickable')) {
                    if (typeof window.tmJumpToTask === 'function') {
                        try { window.tmJumpToTask(taskId, e); } catch (e2) {}
                    }
                    return;
                }

                const tr = target.closest('tr[data-id]');
                if (tr && typeof window.tmRowClick === 'function') {
                    try { window.tmRowClick(e, taskId); } catch (e2) {}
                }
            }, { signal: abort.signal });

            host.addEventListener('contextmenu', (e) => {
                const target = e.target;
                if (!(target instanceof Element)) return;
                const tr = target.closest('tr[data-id]');
                if (!tr) return;
                const taskId = String(tr.getAttribute('data-id') || '').trim();
                if (!taskId) return;
                if (typeof window.tmShowTaskContextMenu === 'function') {
                    try { window.tmShowTaskContextMenu(e, taskId); } catch (e2) {}
                }
            }, { signal: abort.signal });

            if (state.isMobileDevice) {
                const clearDragCloseTimer = () => {
                    if (state.mobileDragCloseTimer) {
                        try { clearTimeout(state.mobileDragCloseTimer); } catch (e2) {}
                        state.mobileDragCloseTimer = null;
                    }
                };
                const scheduleDragClose = (ev) => {
                    const target = ev?.target;
                    if (!(target instanceof Element)) return;
                    if (!target.closest('tr[data-id], .tm-cal-task')) return;
                    clearDragCloseTimer();
                    state.mobileDragCloseTimer = setTimeout(() => {
                        state.mobileDragCloseTimer = null;
                        try {
                            const wrapEl = state.wrapEl;
                            if (wrapEl) setCalendarSidebarOpen(wrapEl, false);
                        } catch (e2) {}
                    }, 180);
                };
                host.addEventListener('touchstart', scheduleDragClose, { passive: true, signal: abort.signal });
                host.addEventListener('touchmove', clearDragCloseTimer, { passive: true, signal: abort.signal });
                host.addEventListener('touchend', clearDragCloseTimer, { passive: true, signal: abort.signal });
                host.addEventListener('touchcancel', clearDragCloseTimer, { passive: true, signal: abort.signal });
                host.addEventListener('dragstart', (ev) => {
                    const target = ev?.target;
                    if (!(target instanceof Element)) return;
                    if (!target.closest('tr[data-id], .tm-cal-task')) return;
                    clearDragCloseTimer();
                    try {
                        const wrapEl = state.wrapEl;
                        if (wrapEl) setCalendarSidebarOpen(wrapEl, false);
                    } catch (e2) {}
                }, { signal: abort.signal });
            }
        } catch (e) {}
        try { globalThis.tmCalendarApplyCollapseDom?.(); } catch (e) {}
        bindTaskDraggable(settings);
        Promise.resolve().then(() => markTodayScheduledTaskRows(host)).catch(() => null);
    }

    async function markTodayScheduledTaskRows(host) {
        const tbody = host?.querySelector?.('#tmTaskTable tbody');
        if (!(tbody instanceof Element)) return;
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const list = await loadScheduleForRange(dayStart, dayEnd);
        const todayTaskIds = new Set(
            (Array.isArray(list) ? list : [])
                .map((x) => String(x?.taskId || '').trim())
                .filter(Boolean)
        );
        tbody.querySelectorAll('tr[data-id]').forEach((tr) => {
            const tid = String(tr?.getAttribute?.('data-id') || '').trim();
            const marked = !!(tid && todayTaskIds.has(tid));
            const textEl = tr.querySelector('.tm-task-content-clickable, .tm-task-text');
            if (textEl instanceof HTMLElement) {
                if (marked) textEl.style.color = '#1a73e8';
                else textEl.style.removeProperty('color');
            }
        });
    }

    function setSidePage(wrap, next) {
        const v = (next === 'tasks') ? 'tasks' : 'calendar';
        state.sidePage = v;
        try {
            wrap.classList.toggle('tm-calendar-wrap--tasks-page', v === 'tasks');
            const inner = wrap.querySelector('.tm-calendar-sidebar-inner');
            if (inner) inner.style.gap = (v === 'tasks') ? '0' : '10px';
            wrap.querySelectorAll('[data-tm-cal-side-page]').forEach((el) => {
                const key = String(el.getAttribute('data-tm-cal-side-page') || '');
                el.style.display = (key === v) ? '' : 'none';
            });
            wrap.querySelectorAll('[data-tm-cal-side-tab]').forEach((el) => {
                const key = String(el.getAttribute('data-tm-cal-side-tab') || '');
                el.classList.toggle('tm-calendar-side-tab--active', key === v);
            });
        } catch (e) {}
    }

    function setCalendarSidebarOpen(wrap, open, page) {
        try {
            if (!wrap?.classList) return false;
            if (page) setSidePage(wrap, page);
            const isMobile = !!wrap.classList.contains('tm-calendar-wrap--mobile');
            const next = !!open;
            if (isMobile) wrap.classList.toggle('tm-calendar-wrap--sidebar-open', next);
            else wrap.classList.toggle('tm-calendar-wrap--sidebar-collapsed', !next);
            state.sidebarOpen = next;
            try { requestAnimationFrame(() => { try { state.calendar?.updateSize?.(); } catch (e2) {} }); } catch (e) {}
            return next;
        } catch (e) {
            return false;
        }
    }

    function toggleMobileSidebar(wrap, open, page) {
        if (!wrap?.classList) return false;
        const isMobile = !!wrap.classList.contains('tm-calendar-wrap--mobile');
        const isOpen = isMobile
            ? wrap.classList.contains('tm-calendar-wrap--sidebar-open')
            : !wrap.classList.contains('tm-calendar-wrap--sidebar-collapsed');
        const next = (open === undefined) ? !isOpen : !!open;
        return setCalendarSidebarOpen(wrap, next, page);
    }

    function miniMonthKeyFromDate(d) {
        if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    }

    function miniMonthTitleFromKey(key) {
        const m = String(key || '').match(/^(\d{4})-(\d{2})$/);
        if (!m) return '';
        const y = Number(m[1]);
        const mm = Number(m[2]);
        if (!Number.isFinite(y) || !Number.isFinite(mm)) return '';
        return `${y}年${mm}月`;
    }

    function miniMonthKeyShift(key, deltaMonths) {
        const m = String(key || '').match(/^(\d{4})-(\d{2})$/);
        if (!m) return '';
        const y0 = Number(m[1]);
        const m0 = Number(m[2]);
        if (!Number.isFinite(y0) || !Number.isFinite(m0)) return '';
        const base = new Date(y0, m0 - 1, 1, 12, 0, 0);
        if (Number.isNaN(base.getTime())) return '';
        base.setMonth(base.getMonth() + (Number(deltaMonths) || 0));
        return miniMonthKeyFromDate(base);
    }

    function renderMiniCalendar(wrap) {
        const mini = wrap?.querySelector?.('.tm-calendar-mini');
        const calendar = state.calendar;
        if (!mini || !(mini instanceof Element) || !calendar) return;
        const firstDay = Number(getSettings().firstDay) === 0 ? 0 : 1;

        const selected = calendar?.getDate?.() instanceof Date ? calendar.getDate() : null;
        const selectedKey = selected ? formatDateKey(selected) : '';

        if (!state.miniMonthKey) state.miniMonthKey = miniMonthKeyFromDate(selected || new Date());
        const title = miniMonthTitleFromKey(state.miniMonthKey) || '';

        const monthMatch = String(state.miniMonthKey || '').match(/^(\d{4})-(\d{2})$/);
        const y = monthMatch ? Number(monthMatch[1]) : NaN;
        const m = monthMatch ? Number(monthMatch[2]) : NaN;
        if (!Number.isFinite(y) || !Number.isFinite(m)) return;

        const first = new Date(y, m - 1, 1, 12, 0, 0);
        const firstDow = (first.getDay() - firstDay + 7) % 7;
        const start = new Date(first.getTime());
        start.setDate(first.getDate() - firstDow);
        const todayKey = formatDateKey(new Date());

        const dows = firstDay === 0
            ? ['日', '一', '二', '三', '四', '五', '六']
            : ['一', '二', '三', '四', '五', '六', '日'];
        const cells = [];
        for (let i = 0; i < 42; i += 1) {
            const d = new Date(start.getTime());
            d.setDate(start.getDate() + i);
            const key = formatDateKey(d);
            const other = d.getMonth() !== (m - 1);
            const cls = [
                'tm-mini-cal-day',
                other ? 'tm-mini-cal-day--other' : '',
                key === todayKey ? 'tm-mini-cal-day--today' : '',
                key && key === selectedKey ? 'tm-mini-cal-day--active' : '',
            ].filter(Boolean).join(' ');
            cells.push(`<button class="${cls}" type="button" data-tm-mini-date="${esc(key)}">${d.getDate()}</button>`);
        }

        mini.innerHTML = `
            <div class="tm-mini-cal" data-tm-mini-root="1">
                <div class="tm-mini-cal-header">
                    <button class="tm-mini-cal-btn" type="button" data-tm-mini-action="prev">‹</button>
                    <div class="tm-mini-cal-title">${esc(title)}</div>
                    <button class="tm-mini-cal-btn" type="button" data-tm-mini-action="next">›</button>
                </div>
                <div class="tm-mini-cal-grid">
                    ${dows.map((t) => `<div class="tm-mini-cal-dow">${esc(t)}</div>`).join('')}
                    ${cells.join('')}
                </div>
            </div>
        `;

        try { state.miniAbort?.abort(); } catch (e) {}
        const abort = new AbortController();
        state.miniAbort = abort;
        mini.addEventListener('click', (e) => {
            const actionEl = e.target?.closest?.('[data-tm-mini-action]');
            const action = String(actionEl?.getAttribute?.('data-tm-mini-action') || '').trim();
            if (action === 'prev') {
                state.miniMonthKey = miniMonthKeyShift(state.miniMonthKey, -1);
                renderMiniCalendar(wrap);
                return;
            }
            if (action === 'next') {
                state.miniMonthKey = miniMonthKeyShift(state.miniMonthKey, 1);
                renderMiniCalendar(wrap);
                return;
            }
            const dateEl = e.target?.closest?.('[data-tm-mini-date]');
            const key = String(dateEl?.getAttribute?.('data-tm-mini-date') || '').trim();
            if (!key) return;
            const d = parseDateOnly(key);
            if (!d) return;
            try {
                const curView = String(calendar?.view?.type || 'timeGridWeek');
                calendar.gotoDate(d);
                if (curView === 'dayGridMonth') calendar.changeView('timeGridDay', d);
            } catch (e2) {}
            renderMiniCalendar(wrap);
        }, { signal: abort.signal });
    }

    function bindCalendarDrop(wrap) {
        const host = state.calendarEl;
        if (!host) return;
        const PREVIEW_EVENT_ID = '__tm-cal-drag-preview-main__';
        let previewKey = '';
        const isFullCalendarManagedDrag = () => {
            try {
                return !!document.querySelector('.fc-event-mirror, .fc-event-dragging');
            } catch (e) {}
            return false;
        };
        const clearDropPreview = () => {
            previewKey = '';
            try { state.calendar?.getEventById?.(PREVIEW_EVENT_ID)?.remove?.(); } catch (e) {}
        };
        const renderDropPreview = (payload, hit) => {
            const start = hit?.start;
            if (!payload?.taskId || !(start instanceof Date) || Number.isNaN(start.getTime())) {
                clearDropPreview();
                return;
            }
            const allDay = hit?.allDay === true;
            const safeMin = (Number.isFinite(Number(payload.durationMin)) && Number(payload.durationMin) > 0)
                ? Math.round(Number(payload.durationMin))
                : 60;
            const end = allDay
                ? new Date(start.getTime() + 24 * 60 * 60000)
                : new Date(start.getTime() + safeMin * 60000);
            const title = String(payload.title || '').trim() || '任务';
            const settings = getSettings();
            const calId = String(payload.calendarId || '').trim() || pickDefaultCalendarId(settings);
            const defs = getCalendarDefs(settings);
            const color = String(defs.find((d) => String(d?.id || '').trim() === calId)?.color || '#1a73e8').trim() || '#1a73e8';
            const nextKey = `${start.getTime()}|${end.getTime()}|${allDay ? 1 : 0}|${title}|${color}`;
            if (nextKey === previewKey) return;
            previewKey = nextKey;
            const cal = state.calendar;
            if (!cal) return;
            let ev = null;
            try { ev = cal.getEventById?.(PREVIEW_EVENT_ID) || null; } catch (e) { ev = null; }
            if (!ev) {
                try {
                    ev = cal.addEvent?.({
                        id: PREVIEW_EVENT_ID,
                        title,
                        start: safeISO(start),
                        end: safeISO(end),
                        allDay,
                        editable: false,
                        durationEditable: false,
                        startEditable: false,
                        overlap: true,
                        classNames: ['tm-cal-drag-preview'],
                    }) || null;
                } catch (e) { ev = null; }
            }
            try { ev?.setProp?.('title', title); } catch (e) {}
            try { ev?.setDates?.(start, end, { allDay }); } catch (e) {}
            try { ev?.setProp?.('backgroundColor', color); } catch (e) {}
            try { ev?.setProp?.('borderColor', color); } catch (e) {}
        };
        const getDropInfo = (target, x, y) => {
            const findColByX = (xPos) => {
                const xp = Number(xPos);
                if (!Number.isFinite(xp)) return null;
                const cols = Array.from(host.querySelectorAll('.fc-timegrid-col[data-date]'));
                for (const colEl of cols) {
                    try {
                        const r = colEl.getBoundingClientRect();
                        if (xp >= r.left && xp < r.right) return colEl;
                    } catch (e) {}
                }
                return cols[0] || null;
            };
            const pickSlotByXY = (xPos, yPos) => {
                const xp = Number(xPos);
                const yp = Number(yPos);
                if (!Number.isFinite(yp)) return null;
                const slots = Array.from(host.querySelectorAll('.fc-timegrid-slot[data-time]'));
                if (slots.length === 0) return null;
                let best = null;
                let bestDist = Number.POSITIVE_INFINITY;
                for (const s of slots) {
                    try {
                        const r = s.getBoundingClientRect();
                        const containsY = yp >= r.top && yp < r.bottom;
                        const containsX = !Number.isFinite(xp) || (xp >= r.left && xp < r.right);
                        if (containsY && containsX) return s;
                        const centerY = (r.top + r.bottom) / 2;
                        const d = Math.abs(centerY - yp);
                        if (d < bestDist) {
                            bestDist = d;
                            best = s;
                        }
                    } catch (e) {}
                }
                return best;
            };
            const resolveFrom = (el) => {
                if (!(el instanceof Element)) return null;
                const slot = el.closest?.('.fc-timegrid-slot,[data-time].fc-timegrid-slot');
                const col = el.closest?.('.fc-timegrid-col') || findColByX(x);
                const allDayWrap = el.closest?.('.fc-timegrid-all-day, .fc-timegrid-allday');
                const day = el.closest?.('.fc-daygrid-day');
                if (allDayWrap) {
                    const dateStr0 = String(el.closest?.('[data-date]')?.getAttribute?.('data-date') || '').trim();
                    if (dateStr0) {
                        const dt0 = new Date(`${dateStr0}T00:00:00`);
                        if (!Number.isNaN(dt0.getTime())) return { start: dt0, allDay: true };
                    }
                }
                if (slot && col && !allDayWrap) {
                    const dateStr = String(col.getAttribute('data-date') || '').trim();
                    const timeStr = String(slot.getAttribute('data-time') || '').trim();
                    if (dateStr && timeStr) {
                        const hhmm = timeStr.slice(0, 5);
                        const dt = new Date(`${dateStr}T${hhmm}:00`);
                        if (!Number.isNaN(dt.getTime())) return { start: dt, allDay: false };
                    }
                }
                if (col && !allDayWrap) {
                    const dateStr = String(col.getAttribute('data-date') || '').trim();
                    const slotByPoint = pickSlotByXY(x, y);
                    const timeStr = String(slotByPoint?.getAttribute?.('data-time') || '').trim();
                    if (dateStr && timeStr) {
                        const hhmm = timeStr.slice(0, 5);
                        const dt = new Date(`${dateStr}T${hhmm}:00`);
                        if (!Number.isNaN(dt.getTime())) return { start: dt, allDay: false };
                    }
                }
                if (day) {
                    const dateStr = String(day.getAttribute('data-date') || '').trim();
                    if (dateStr) {
                        const dt = new Date(`${dateStr}T09:00:00`);
                        if (!Number.isNaN(dt.getTime())) return { start: dt, allDay: true };
                    }
                }
                return null;
            };
            const el0 = (target instanceof Element) ? target : null;
            const r0 = resolveFrom(el0);
            if (r0) return r0;
            const layered = (() => {
                try {
                    if (typeof document.elementsFromPoint === 'function') {
                        return document.elementsFromPoint(Number(x) || 0, Number(y) || 0);
                    }
                } catch (e) {}
                return [];
            })();
            for (const el of layered) {
                const r = resolveFrom(el);
                if (r) return r;
            }
            return resolveFrom(document.elementFromPoint(x, y));
        };

        host.addEventListener('dragover', (e) => {
            // 检查是否为白板连线操作，如果是则不阻止默认行为
            const types = Array.from(e.dataTransfer?.types || []);
            const isWhiteboardLink = types.includes('application/x-tm-task-link');
            if (isWhiteboardLink) return;
            if (isFullCalendarManagedDrag()) {
                clearDropPreview();
                return;
            }

            const ok = e.dataTransfer && (
                types.includes('application/x-tm-task')
                || types.includes('application/x-tm-task-id')
                || types.includes('text/plain')
            );
            if (!ok) {
                const payload = buildDraggingTaskPayload(null);
                if (!payload?.taskId) {
                    clearDropPreview();
                    return;
                }
                e.preventDefault();
                const hit = getDropInfo(e.target, e.clientX, e.clientY);
                renderDropPreview(payload, hit);
                return;
            }
            e.preventDefault();
            const payload = parseTaskDropPayload(e, null, null) || buildDraggingTaskPayload(null);
            const hit = getDropInfo(e.target, e.clientX, e.clientY);
            renderDropPreview(payload, hit);
        });
        host.addEventListener('dragleave', (e) => {
            try {
                const r = host.getBoundingClientRect();
                const x = Number(e.clientX);
                const y = Number(e.clientY);
                const out = !Number.isFinite(x) || !Number.isFinite(y) || x < r.left || x > r.right || y < r.top || y > r.bottom;
                if (out) clearDropPreview();
            } catch (e2) {}
        });
        host.addEventListener('drop', async (e) => {
            try {
                if (isFullCalendarManagedDrag()) {
                    clearDropPreview();
                    return;
                }
                e.preventDefault();
                clearDropPreview();
                const payload = parseTaskDropPayload(e, null, null) || buildDraggingTaskPayload(null);
                const taskId = String(payload?.taskId || '').trim();
                const title = String(payload?.title || '').trim();
                const durationMin = Number(payload?.durationMin);
                const calendarId = String(payload?.calendarId || '').trim();
                if (!taskId) return;
                const hit = getDropInfo(e.target, e.clientX, e.clientY);
                const start = (hit?.start instanceof Date) ? hit.start : new Date();
                const allDay = hit?.allDay === true;
                const safeMin = (Number.isFinite(durationMin) && durationMin > 0) ? Math.round(durationMin) : 60;
                const end = allDay
                    ? new Date(start.getTime() + 24 * 60 * 60000)
                    : new Date(start.getTime() + safeMin * 60000);
                const settings = getSettings();
                const calId = calendarId || pickDefaultCalendarId(settings);
                await addTaskSchedule({
                    taskId,
                    title: title || '任务',
                    start,
                    end,
                    calendarId: calId,
                    durationMin: safeMin,
                    allDay,
                });
                toast('✅ 已加入日程', 'success');
            } catch (e2) {}
            finally {
                clearDropPreview();
            }
        });
    }

    function bindSidebarResize(wrap) {
        const sidebar = wrap?.querySelector?.('.tm-calendar-sidebar');
        const resizer = wrap?.querySelector?.('[data-tm-cal-role="sidebar-resizer"]');
        if (!sidebar || !resizer) return;
        try { state.sidebarResizeCleanup?.(); } catch (e) {}
        state.sidebarResizeCleanup = null;
        let dragging = false;
        let startX = 0;
        let startW = 0;
        let saveTimer = null;
        const clamp = (n) => Math.max(220, Math.min(560, n));
        const onMove = (e) => {
            if (!dragging) return;
            const x = Number(e.clientX) || 0;
            const w = clamp(startW + (x - startX));
            sidebar.style.width = `${w}px`;
            try {
                const store = state.settingsStore;
                if (store && store.data) {
                    store.data.calendarSidebarWidth = w;
                    if (saveTimer) clearTimeout(saveTimer);
                    saveTimer = setTimeout(() => { try { store.save(); } catch (e2) {} }, 200);
                }
            } catch (e2) {}
            try { state.calendar?.updateSize?.(); } catch (e2) {}
        };
        const clearSaveTimer = () => {
            if (saveTimer) {
                try { clearTimeout(saveTimer); } catch (e) {}
                saveTimer = null;
            }
        };
        const cleanupDocDrag = () => {
            dragging = false;
            clearSaveTimer();
            try { document.body.classList.remove('tm-cal-resizing'); } catch (e) {}
            try { document.removeEventListener('mousemove', onMove, true); } catch (e) {}
            try { document.removeEventListener('mouseup', onUp, true); } catch (e) {}
        };
        const onUp = () => {
            cleanupDocDrag();
        };
        state.sidebarResizeCleanup = cleanupDocDrag;
        resizer.addEventListener('mousedown', (e) => {
            try { e.preventDefault(); } catch (e2) {}
            dragging = true;
            startX = Number(e.clientX) || 0;
            startW = sidebar.getBoundingClientRect().width || (Number(getSettings().sidebarWidth) || 280);
            try { document.body.classList.add('tm-cal-resizing'); } catch (e2) {}
            try { document.addEventListener('mousemove', onMove, true); } catch (e2) {}
            try { document.addEventListener('mouseup', onUp, true); } catch (e2) {}
        });
    }

    function safeISO(d) {
        if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
        return d.toISOString();
    }

    function uuid() {
        try { return crypto.randomUUID(); } catch (e) {}
        return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function computeScheduleSourceSignature(raw) {
        const text = String(raw || '');
        let hash = 2166136261;
        for (let i = 0; i < text.length; i += 1) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return `${text.length}:${hash >>> 0}`;
    }

    function cloneScheduleList(items) {
        const src = Array.isArray(items) ? items : [];
        return src.map((it) => ((it && typeof it === 'object') ? { ...it } : {}));
    }

    function normalizeScheduleList(arr) {
        const list0 = Array.isArray(arr) ? arr : [];
        let changed = false;
        const out = list0.map((it) => {
            const base = (it && typeof it === 'object') ? it : {};
            const id0 = String(base.id || '').trim();
            const taskId0 = String(base.taskId || base.task_id || base.linkedTaskId || base.linked_task_id || '').trim();
            const id = id0 || uuid();
            if (id !== id0) changed = true;
            if (taskId0 && taskId0 !== String(base.taskId || '').trim()) changed = true;
            const reminderMode0 = String(base.reminderMode || '').trim() === 'custom' ? 'custom' : 'inherit';
            const allowed = new Set([0, 5, 10, 15, 30, 60]);
            const reminderEnabled0 = reminderMode0 === 'custom' ? (base.reminderEnabled === true) : null;
            const reminderOffsetRaw = Number(base.reminderOffsetMin);
            const reminderOffsetMin0 = reminderMode0 === 'custom'
                ? ((Number.isFinite(reminderOffsetRaw) && allowed.has(reminderOffsetRaw)) ? reminderOffsetRaw : 0)
                : null;
            const repeatType0 = getScheduleRepeatType(base);
            const repeatEvery0 = getScheduleRepeatEvery(base, repeatType0);
            const repeatUntil0 = getScheduleRepeatUntil(base);
            const repeatMonthlyMode0 = getScheduleRepeatMonthlyMode(base, repeatType0);
            const notificationSchedules0 = sanitizeScheduleNotificationSchedules(base.notificationSchedules);
            if (String(base.reminderMode || '').trim() !== reminderMode0) changed = true;
            if (getScheduleRepeatType({
                repeatType: base.repeatType,
                recurrenceType: base.recurrenceType,
                repeat: base.repeat,
                recurrence: base.recurrence,
            }) !== repeatType0) changed = true;
            if (getScheduleRepeatEvery({
                repeatEvery: base.repeatEvery,
                recurrenceEvery: base.recurrenceEvery,
                intervalEvery: base.intervalEvery,
                repeatInterval: base.repeatInterval,
                repeat: base.repeat,
                recurrence: base.recurrence,
            }, repeatType0) !== repeatEvery0) changed = true;
            if (normalizeScheduleRepeatUntil(
                base.repeatUntil
                ?? base.recurrenceUntil
                ?? base.repeatEnd
                ?? base.repeat?.until
                ?? base.recurrence?.until
            ) !== repeatUntil0) changed = true;
            if (getScheduleRepeatMonthlyMode({
                repeatMonthlyMode: base.repeatMonthlyMode,
                recurrenceMonthlyMode: base.recurrenceMonthlyMode,
                repeat: base.repeat,
                recurrence: base.recurrence,
            }, repeatType0) !== repeatMonthlyMode0) changed = true;
            if (JSON.stringify(base.notificationSchedules || {}) !== JSON.stringify(notificationSchedules0)) changed = true;
            return {
                ...base,
                id,
                taskId: taskId0,
                reminderMode: reminderMode0,
                reminderEnabled: reminderEnabled0,
                reminderOffsetMin: reminderOffsetMin0,
                repeatType: repeatType0,
                repeatEvery: repeatEvery0,
                repeatUntil: repeatUntil0,
                repeatMonthlyMode: repeatMonthlyMode0,
                notificationSchedules: notificationSchedules0,
            };
        });
        return { out, changed };
    }

    function normalizeScheduleRepeatType(value) {
        const raw = String(value || '').trim().toLowerCase();
        if (!raw || raw === 'none' || raw === 'once') return 'none';
        if (raw === 'weekday' || raw === 'weekdays') return 'workday';
        if (raw === 'everyday') return 'daily';
        if (raw === 'daily' || raw === 'workday' || raw === 'weekly' || raw === 'monthly' || raw === 'yearly') return raw;
        return 'none';
    }

    function normalizeScheduleRepeatEvery(value, repeatType) {
        if (normalizeScheduleRepeatType(repeatType) === 'none') return 1;
        const n = parseInt(value, 10);
        if (!Number.isFinite(n) || n <= 0) return 1;
        return Math.min(3650, Math.max(1, n));
    }

    function normalizeScheduleRepeatUntil(value) {
        if (value instanceof Date && !Number.isNaN(value.getTime())) return formatDateKey(value);
        const raw = String(value || '').trim();
        if (!raw) return '';
        const matched = raw.match(/^\d{4}-\d{2}-\d{2}/);
        if (matched) return matched[0];
        const dt = new Date(raw);
        if (Number.isNaN(dt.getTime())) return '';
        return formatDateKey(dt);
    }

    function getScheduleRepeatType(item) {
        const base = (item && typeof item === 'object') ? item : {};
        const raw = (() => {
            if (typeof base.repeatType === 'string') return base.repeatType;
            if (typeof base.recurrenceType === 'string') return base.recurrenceType;
            if (typeof base.repeat === 'string') return base.repeat;
            if (typeof base.recurrence === 'string') return base.recurrence;
            if (base.repeat && typeof base.repeat === 'object') return base.repeat.type;
            if (base.recurrence && typeof base.recurrence === 'object') return base.recurrence.type;
            return '';
        })();
        return normalizeScheduleRepeatType(raw);
    }

    function getScheduleRepeatEvery(item, repeatType) {
        const base = (item && typeof item === 'object') ? item : {};
        const raw = (
            base.repeatEvery
            ?? base.recurrenceEvery
            ?? base.intervalEvery
            ?? base.repeatInterval
            ?? (base.repeat && typeof base.repeat === 'object' ? (base.repeat.every ?? base.repeat.interval) : '')
            ?? (base.recurrence && typeof base.recurrence === 'object' ? (base.recurrence.every ?? base.recurrence.interval) : '')
        );
        return normalizeScheduleRepeatEvery(raw, repeatType || getScheduleRepeatType(base));
    }

    function normalizeScheduleRepeatMonthlyMode(value, repeatType) {
        if (normalizeScheduleRepeatType(repeatType) !== 'monthly') return 'date';
        return String(value || '').trim().toLowerCase() === 'weekday' ? 'weekday' : 'date';
    }

    function getScheduleRepeatMonthlyMode(item, repeatType) {
        const base = (item && typeof item === 'object') ? item : {};
        const raw = (
            base.repeatMonthlyMode
            ?? base.recurrenceMonthlyMode
            ?? (base.repeat && typeof base.repeat === 'object' ? base.repeat.monthlyMode : '')
            ?? (base.recurrence && typeof base.recurrence === 'object' ? base.recurrence.monthlyMode : '')
        );
        return normalizeScheduleRepeatMonthlyMode(raw, repeatType || getScheduleRepeatType(base));
    }

    function getScheduleRepeatUnitLabel(repeatType, every) {
        const type = normalizeScheduleRepeatType(repeatType);
        normalizeScheduleRepeatEvery(every, type);
        if (type === 'daily') return '天';
        if (type === 'workday') return '个工作日';
        if (type === 'weekly') return '周';
        if (type === 'monthly') return '个月';
        if (type === 'yearly') return '年';
        return '次';
    }

    function getScheduleRepeatUntil(item) {
        const base = (item && typeof item === 'object') ? item : {};
        const raw = (
            base.repeatUntil
            ?? base.recurrenceUntil
            ?? base.repeatEnd
            ?? (base.repeat && typeof base.repeat === 'object' ? base.repeat.until : '')
            ?? (base.recurrence && typeof base.recurrence === 'object' ? base.recurrence.until : '')
        );
        return normalizeScheduleRepeatUntil(raw);
    }

    function getScheduleWeekdayLabel(weekday) {
        const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const idx = Number(weekday);
        return labels[idx] || '周?';
    }

    function getScheduleMonthWeekOrdinal(dateLike) {
        const dt = dateLike instanceof Date ? dateLike : new Date(dateLike);
        if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return 1;
        return Math.max(1, Math.min(5, Math.floor((dt.getDate() - 1) / 7) + 1));
    }

    function getScheduleMonthlyWeekPatternLabel(dateLike) {
        const dt = dateLike instanceof Date ? dateLike : new Date(dateLike);
        if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return '第1个周一';
        return `第${getScheduleMonthWeekOrdinal(dt)}个${getScheduleWeekdayLabel(dt.getDay())}`;
    }

    function buildScheduleMonthlyWeekdayOccurrenceDate(baseDate, deltaMonths) {
        const base = baseDate instanceof Date ? baseDate : new Date(baseDate);
        if (!(base instanceof Date) || Number.isNaN(base.getTime())) return null;
        const months = Number(deltaMonths) || 0;
        const total = base.getFullYear() * 12 + base.getMonth() + months;
        const year = Math.floor(total / 12);
        const month = ((total % 12) + 12) % 12;
        const weekday = base.getDay();
        const ordinal = getScheduleMonthWeekOrdinal(base);
        const firstDay = new Date(year, month, 1);
        const firstWeekday = firstDay.getDay();
        const offset = (weekday - firstWeekday + 7) % 7;
        const day = 1 + offset + (ordinal - 1) * 7;
        const lastDay = new Date(year, month + 1, 0).getDate();
        if (day > lastDay) return null;
        return new Date(
            year,
            month,
            day,
            base.getHours(),
            base.getMinutes(),
            base.getSeconds(),
            base.getMilliseconds()
        );
    }

    function buildScheduleOccurrenceDate(baseDate, deltaDays) {
        const dt = new Date(baseDate.getTime());
        dt.setDate(dt.getDate() + (Number(deltaDays) || 0));
        return dt;
    }

    function buildScheduleMonthlyOccurrenceDate(baseDate, deltaMonths) {
        const months = Number(deltaMonths) || 0;
        const total = baseDate.getFullYear() * 12 + baseDate.getMonth() + months;
        const year = Math.floor(total / 12);
        const month = ((total % 12) + 12) % 12;
        const lastDay = new Date(year, month + 1, 0).getDate();
        const day = Math.min(baseDate.getDate(), lastDay);
        return new Date(
            year,
            month,
            day,
            baseDate.getHours(),
            baseDate.getMinutes(),
            baseDate.getSeconds(),
            baseDate.getMilliseconds()
        );
    }

    function buildScheduleYearlyOccurrenceDate(baseDate, deltaYears) {
        const year = baseDate.getFullYear() + (Number(deltaYears) || 0);
        const month = baseDate.getMonth();
        const lastDay = new Date(year, month + 1, 0).getDate();
        const day = Math.min(baseDate.getDate(), lastDay);
        return new Date(
            year,
            month,
            day,
            baseDate.getHours(),
            baseDate.getMinutes(),
            baseDate.getSeconds(),
            baseDate.getMilliseconds()
        );
    }

    function collectScheduleOccurrencesInRange(item, rangeStart, rangeEnd, options) {
        const startMs = toMs(item?.start);
        const endMs = toMs(item?.end);
        const rangeStartMs0 = toMs(rangeStart);
        const rangeEndMs0 = toMs(rangeEnd);
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return [];
        const rangeStartMs = Number.isFinite(rangeStartMs0) ? rangeStartMs0 : startMs;
        const rangeEndMs = Number.isFinite(rangeEndMs0) ? rangeEndMs0 : endMs;
        if (!Number.isFinite(rangeStartMs) || !Number.isFinite(rangeEndMs) || rangeEndMs <= rangeStartMs) return [];
        const durationMs = endMs - startMs;
        const baseStart = new Date(startMs);
        const repeatType = getScheduleRepeatType(item);
        const repeatEvery = getScheduleRepeatEvery(item, repeatType);
        const repeatUntil = getScheduleRepeatUntil(item);
        const repeatMonthlyMode = getScheduleRepeatMonthlyMode(item, repeatType);
        const limit = Math.max(1, Math.min(Number(options?.limit) || 400, 2400));
        const out = [];
        const dayMs = 86400000;
        const pushOccurrence = (occStart) => {
            if (!(occStart instanceof Date) || Number.isNaN(occStart.getTime())) return false;
            if (repeatUntil && formatDateKey(occStart) > repeatUntil) return false;
            const occStartMs = occStart.getTime();
            if (occStartMs >= rangeEndMs) return false;
            const occEndMs = occStartMs + durationMs;
            if (!overlap(occStartMs, occEndMs, rangeStartMs, rangeEndMs)) return true;
            out.push({
                start: new Date(occStartMs),
                end: new Date(occEndMs),
                startMs: occStartMs,
                endMs: occEndMs,
                isRecurring: repeatType !== 'none',
            });
            return true;
        };

        if (repeatType === 'none') {
            if (overlap(startMs, endMs, rangeStartMs, rangeEndMs)) {
                out.push({
                    start: new Date(startMs),
                    end: new Date(endMs),
                    startMs,
                    endMs,
                    isRecurring: false,
                });
            }
            return out;
        }

        if (repeatType === 'daily') {
            const jumpDays = Math.max(0, Math.floor((rangeStartMs - endMs) / dayMs) - 1);
            const startStep = Math.max(0, Math.floor(jumpDays / repeatEvery) * repeatEvery);
            for (let i = startStep; out.length < limit; i += repeatEvery) {
                if (!pushOccurrence(buildScheduleOccurrenceDate(baseStart, i))) break;
            }
            return out;
        }
        if (repeatType === 'workday') {
            const jumpDays = Math.max(0, Math.floor((rangeStartMs - endMs) / dayMs) - Math.max(7, repeatEvery * 7));
            let workdayOrdinal = 0;
            for (let i = 0; i < jumpDays; i += 1) {
                const dt = buildScheduleOccurrenceDate(baseStart, i);
                const weekday = dt.getDay();
                if (weekday !== 0 && weekday !== 6) workdayOrdinal += 1;
            }
            for (let i = jumpDays, guard = 0; out.length < limit && guard < 5000; i += 1, guard += 1) {
                const occStart = buildScheduleOccurrenceDate(baseStart, i);
                const weekday = occStart.getDay();
                if (weekday === 0 || weekday === 6) {
                    if (occStart.getTime() >= rangeEndMs) break;
                    if (repeatUntil && formatDateKey(occStart) > repeatUntil) break;
                    continue;
                }
                const shouldInclude = workdayOrdinal % repeatEvery === 0;
                if (shouldInclude && !pushOccurrence(occStart)) break;
                workdayOrdinal += 1;
            }
            return out;
        }
        if (repeatType === 'weekly') {
            const jumpWeeks = Math.max(0, Math.floor((rangeStartMs - endMs) / (dayMs * 7)) - 1);
            const startStep = Math.max(0, Math.floor(jumpWeeks / repeatEvery) * repeatEvery);
            for (let i = startStep; out.length < limit; i += repeatEvery) {
                if (!pushOccurrence(buildScheduleOccurrenceDate(baseStart, i * 7))) break;
            }
            return out;
        }
        if (repeatType === 'monthly') {
            const rangeStartDate = new Date(rangeStartMs);
            const baseMonthIndex = baseStart.getFullYear() * 12 + baseStart.getMonth();
            const rangeMonthIndex = rangeStartDate.getFullYear() * 12 + rangeStartDate.getMonth();
            const jumpMonths = Math.max(0, rangeMonthIndex - baseMonthIndex - 1);
            const startStep = Math.max(0, Math.floor(jumpMonths / repeatEvery) * repeatEvery);
            for (let i = startStep, guard = 0; out.length < limit && guard < 600; i += repeatEvery, guard += 1) {
                const occStart = repeatMonthlyMode === 'weekday'
                    ? buildScheduleMonthlyWeekdayOccurrenceDate(baseStart, i)
                    : buildScheduleMonthlyOccurrenceDate(baseStart, i);
                if (!occStart) continue;
                if (!pushOccurrence(occStart)) break;
            }
            return out;
        }
        if (repeatType === 'yearly') {
            const rangeStartDate = new Date(rangeStartMs);
            const jumpYears = Math.max(0, rangeStartDate.getFullYear() - baseStart.getFullYear() - 1);
            const startStep = Math.max(0, Math.floor(jumpYears / repeatEvery) * repeatEvery);
            for (let i = startStep, guard = 0; out.length < limit && guard < 200; i += repeatEvery, guard += 1) {
                if (!pushOccurrence(buildScheduleYearlyOccurrenceDate(baseStart, i))) break;
            }
            return out;
        }
        return out;
    }

    function hasScheduleOccurrenceInRange(item, rangeStart, rangeEnd) {
        return collectScheduleOccurrencesInRange(item, rangeStart, rangeEnd, { limit: 1 }).length > 0;
    }

    function setScheduleCache(items, sourceSignature) {
        state.scheduleCache.list = cloneScheduleList(items);
        state.scheduleCache.loadedAt = Date.now();
        if (typeof sourceSignature !== 'undefined') {
            state.scheduleCache.sourceSignature = String(sourceSignature || '');
        }
    }

    function persistScheduleLocalShadow(items) {
        const list = Array.isArray(items) ? items : [];
        setScheduleCache(list);
        try { localStorage.setItem(STORAGE.SCHEDULE_LS_KEY, JSON.stringify(list, null, 2)); } catch (e) {}
        return true;
    }

    async function loadScheduleAll() {
        const cacheTtlMs = 1200;
        try {
            const cache = state.scheduleCache;
            if (Array.isArray(cache.list) && (Date.now() - (Number(cache.loadedAt) || 0) < cacheTtlMs)) {
                return cloneScheduleList(cache.list);
            }
            if (cache.inflight) {
                const list = await cache.inflight;
                return cloneScheduleList(list);
            }
        } catch (e) {}
        state.scheduleCache.inflight = (async () => {
            try {
                // Keep reads side-effect free: mobile startup may run before cloud sync settles.
                const raw = await getFileTextRetry(STORAGE.SCHEDULE_FILE, 1);
                if (raw && raw.trim()) {
                    const parsed = JSON.parse(raw);
                    const { out } = normalizeScheduleList(parsed);
                    setScheduleCache(out, computeScheduleSourceSignature(raw));
                    return Array.isArray(state.scheduleCache.list) ? state.scheduleCache.list : out;
                }
            } catch (e) {}
            try {
                const raw = String(localStorage.getItem(STORAGE.SCHEDULE_LS_KEY) || '');
                if (!raw.trim()) {
                    setScheduleCache([], '');
                    return [];
                }
                const parsed = JSON.parse(raw);
                const { out } = normalizeScheduleList(parsed);
                setScheduleCache(out, computeScheduleSourceSignature(raw));
                return Array.isArray(state.scheduleCache.list) ? state.scheduleCache.list : out;
            } catch (e) {
                setScheduleCache([], '');
                return [];
            }
        })();
        try {
            const list = await state.scheduleCache.inflight;
            return cloneScheduleList(list);
        } finally {
            state.scheduleCache.inflight = null;
        }
    }

    async function refreshScheduleCacheFromSharedFile() {
        try {
            const raw = await getFileTextRetry(STORAGE.SCHEDULE_FILE, 1);
            const trimmed = String(raw || '').trim();
            if (!trimmed) return { changed: false, list: null };
            const nextSignature = computeScheduleSourceSignature(raw);
            const prevSignature = String(state.scheduleCache.sourceSignature || '');
            if (nextSignature && prevSignature && nextSignature === prevSignature) {
                return { changed: false, list: Array.isArray(state.scheduleCache.list) ? cloneScheduleList(state.scheduleCache.list) : null };
            }
            const parsed = JSON.parse(raw);
            const { out } = normalizeScheduleList(parsed);
            setScheduleCache(out, nextSignature);
            return { changed: nextSignature !== prevSignature, list: cloneScheduleList(out) };
        } catch (e) {
            return { changed: false, list: null };
        }
    }

    async function saveScheduleAll(items, options) {
        const list = Array.isArray(items) ? items : [];
        const opts = (options && typeof options === 'object') ? options : {};
        const serialized = JSON.stringify(list, null, 2);
        setScheduleCache(list, computeScheduleSourceSignature(serialized));
        try { localStorage.setItem(STORAGE.SCHEDULE_LS_KEY, serialized); } catch (e) {}
        try { await putFileText(STORAGE.SCHEDULE_FILE, serialized); } catch (e) {}
        try { window.dispatchEvent(new CustomEvent('tm:calendar-schedule-updated', { detail: { ts: Date.now() } })); } catch (e) {}
        if (!opts.skipDeviceSync && shouldPreferDeviceNotificationBackend()) {
            try { scheduleScheduleMobileSync('save-schedule-all'); } catch (e) {}
        }
        return true;
    }

    function refetchAllCalendars() {
        try { state.calendar?.refetchEvents?.(); } catch (e) {}
        try { state.sideDay?.calendar?.refetchEvents?.(); } catch (e) {}
    }

    function scheduleReminderFiredStorageKey(dateKey) {
        return `tm-calendar-schedule-reminder-fired:${String(dateKey || '').trim()}`;
    }

    function loadScheduleReminderFiredSet(dateKey) {
        const set = new Set();
        const key = scheduleReminderFiredStorageKey(dateKey);
        try {
            const raw = String(localStorage.getItem(key) || '');
            if (!raw.trim()) return set;
            const parsed = JSON.parse(raw);
            const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.items) ? parsed.items : []);
            for (const it of arr) {
                const s = String(it || '').trim();
                if (s) set.add(s);
            }
        } catch (e) {}
        return set;
    }

    function saveScheduleReminderFiredSet(dateKey, set) {
        const key = scheduleReminderFiredStorageKey(dateKey);
        try {
            const arr = Array.from(set || []);
            localStorage.setItem(key, JSON.stringify(arr.slice(-200)));
        } catch (e) {}
    }

    function buildScheduleReminderKey(scheduleId, atMs) {
        return `schedule:${String(scheduleId || '').trim()}:${String(atMs || '')}`;
    }

    function buildTaskDateReminderKey(taskId, atMs) {
        return `taskdate:${String(taskId || '').trim()}:${String(atMs || '')}`;
    }

    function getRuntimeBackendType() {
        try {
            if (__tmSiyuanSdk && typeof __tmSiyuanSdk.getBackend === 'function') {
                const backend = __tmSiyuanSdk.getBackend();
                if (typeof backend === 'string' && backend) return backend.toLowerCase();
            }
        } catch (e) {}
        try {
            const container = window?.siyuan?.config?.system?.container;
            if (typeof container === 'string' && container) return container.toLowerCase();
        } catch (e) {}
        return '';
    }

    function isLikelyMobileRuntime() {
        try {
            const ua = String(navigator?.userAgent || '');
            if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua)) return true;
            if (/HarmonyOS/i.test(ua)) return true;
            if (/Huawei|HUAWEI/.test(ua) && !/Chrome|Chromium|EdgA|Firefox/.test(ua)) return true;
            if (window.matchMedia?.('(any-pointer:coarse)')?.matches) {
                if (/Android|Linux/.test(ua) && !/Win|Mac|X11/.test(ua)) return true;
            }
        } catch (e) {}
        return false;
    }

    function hasDeviceNotificationBridge() {
        try {
            for (const candidate of getNotificationBridgeCandidates()) {
                if (typeof candidate?.owner?.[candidate?.send] === 'function') return true;
            }
        } catch (e) {}
        try {
            const msgHandler = globalThis?.webkit?.messageHandlers?.sendNotification;
            if (msgHandler && typeof msgHandler.postMessage === 'function') return true;
        } catch (e) {}
        return false;
    }

    function shouldUseOfficialMobileNotificationBackend() {
        // 🔧 修复：只检查真正的移动端设备
        // 桌面端虽然有 sendNotification，但应该使用实时提醒而不是预约机制
        const backend = getRuntimeBackendType();
        // 桌面端返回 false，移动端返回 true
        if (backend === 'desktop' || backend === 'pc') return false;
        
        return !!state.isMobileDevice
            || backend === 'android'
            || backend === 'harmony'
            || backend === 'ios'
            || isLikelyMobileRuntime()
            || hasDeviceNotificationBridge();
    }

    function shouldPreferDeviceNotificationBackend() {
        // 🔧 修复：只使用 isLikelyMobileRuntime() 来判断是否使用预约机制
        // 桌面端应该使用实时提醒机制，不预先预约系统通知
        // 移除 getPlatformUtilsCompat() 检查，因为它在桌面端也存在
        return shouldUseOfficialMobileNotificationBackend();
    }

    function normalizeNotificationId(value) {
        const num = Number(value);
        if (!Number.isFinite(num)) return null;
        return Math.trunc(num);
    }

    function extractNotificationIdFromUnknownPayload(payload, depth = 0) {
        if (depth > 4) return null;
        const direct = normalizeNotificationId(payload);
        if (direct !== null) return direct;
        if (payload == null) return null;
        if (typeof payload === 'string') {
            const trimmed = payload.trim();
            if (!trimmed) return null;
            const asNum = normalizeNotificationId(trimmed);
            if (asNum !== null) return asNum;
            try {
                const parsed = JSON.parse(trimmed);
                return extractNotificationIdFromUnknownPayload(parsed, depth + 1);
            } catch (e) {
                return null;
            }
        }
        if (Array.isArray(payload)) {
            for (const item of payload) {
                const nested = extractNotificationIdFromUnknownPayload(item, depth + 1);
                if (nested !== null) return nested;
            }
            return null;
        }
        if (typeof payload === 'object') {
            const priorityKeys = ['id', 'notificationId', 'notificationID', 'data', 'result', 'value'];
            for (const key of priorityKeys) {
                if (!(key in payload)) continue;
                const nested = extractNotificationIdFromUnknownPayload(payload[key], depth + 1);
                if (nested !== null) return nested;
            }
            for (const key of Object.keys(payload)) {
                const nested = extractNotificationIdFromUnknownPayload(payload[key], depth + 1);
                if (nested !== null) return nested;
            }
        }
        return null;
    }

    function getNotificationBridgeCandidates() {
        return [
            { owner: globalThis, send: 'sendNotification', cancel: 'cancelNotification' },
            { owner: window, send: 'sendNotification', cancel: 'cancelNotification' },
            { owner: globalThis?.JSAndroid, send: 'sendNotification', cancel: 'cancelNotification' },
            { owner: globalThis?.JSHarmony, send: 'sendNotification', cancel: 'cancelNotification' },
            { owner: window?.siyuan, send: 'sendNotification', cancel: 'cancelNotification' },
            { owner: window?.siyuan?.mobile, send: 'sendNotification', cancel: 'cancelNotification' },
        ];
    }

    function getPlatformUtilsCompat() {
        const globalPlatformUtils = globalThis.__taskHorizonPlatformUtils || globalThis.__tomatoPlatformUtils || null;
        if (globalPlatformUtils && (typeof globalPlatformUtils.sendNotification === 'function' || typeof globalPlatformUtils.cancelNotification === 'function')) {
            return globalPlatformUtils;
        }
        const sdk0 = ensureTmSiyuanSdk();
        const direct = sdk0?.platformUtils;
        if (direct && (typeof direct.sendNotification === 'function' || typeof direct.cancelNotification === 'function')) {
            return direct;
        }
        return null;
    }

    async function invokeNotificationBridge(owner, methodName, args) {
        const fn = owner?.[methodName];
        if (typeof fn !== 'function') return { called: false, value: null };
        try {
            const value = await fn.apply(owner, args);
            return { called: true, value };
        } catch (e) {
            return { called: true, value: null };
        }
    }

    async function sendDeviceNotificationCompat(title, body, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const safeTitle = String(title || '').trim();
        const safeBody = String(body || '').trim();
        const safeChannel = String(opts.channel || DEVICE_NOTIFICATION_CHANNEL).trim();
        const delayInSeconds = Math.max(0, Math.round(Number(opts.delayInSeconds) || 0));
        const timeoutType = String(
            opts.timeoutType || (opts.requireInteraction === true ? 'never' : (shouldUseOfficialMobileNotificationBackend() ? 'default' : 'never'))
        ).trim() || 'default';
        if (!safeTitle && !safeBody) return -1;
        sendDeviceNotificationCompat._lastFailureReason = '';
        const platformUtils = getPlatformUtilsCompat();
        if (platformUtils && typeof platformUtils.sendNotification === 'function') {
            try {
                const value = await platformUtils.sendNotification({
                    channel: safeChannel,
                    title: safeTitle,
                    body: safeBody,
                    delayInSeconds,
                    timeoutType,
                });
                const id = extractNotificationIdFromUnknownPayload(value);
                if (id !== null) {
                    if (id === -1) sendDeviceNotificationCompat._lastFailureReason = 'send-returned-minus-one';
                    return id;
                }
                sendDeviceNotificationCompat._lastFailureReason = 'send-no-numeric-return';
                return -1;
            } catch (e) {
                sendDeviceNotificationCompat._lastFailureReason = 'platform-utils-send-error';
                return -1;
            }
        }
        sendDeviceNotificationCompat._lastFailureReason = 'platform-utils-unavailable';
        return -1;
    }

    async function cancelDeviceNotificationCompat(id) {
        const safeId = normalizeNotificationId(id);
        if (safeId === null || safeId < 0) return false;
        const platformUtils = getPlatformUtilsCompat();
        if (platformUtils && typeof platformUtils.cancelNotification === 'function') {
            try {
                await platformUtils.cancelNotification(safeId);
                return true;
            } catch (e) {
                return false;
            }
        }
        return false;
    }

    function getOrCreateStableScheduleDeviceId() {
        const keys = ['tomato-sync-device-id', 'tm-calendar-sync-device-id'];
        const createId = () => 'device_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
        for (const key of keys) {
            try {
                const existing = String(localStorage.getItem(key) || '').trim();
                if (existing) {
                    try { localStorage.setItem(keys[0], existing); } catch (e) {}
                    return existing;
                }
            } catch (e) {}
        }
        const nextId = createId();
        for (const key of keys) {
            try { localStorage.setItem(key, nextId); } catch (e) {}
        }
        return nextId;
    }

    const SCHEDULE_SYNC_DEVICE_ID = getOrCreateStableScheduleDeviceId();
    const SCHEDULE_ALL_DAY_MOBILE_WINDOW_DAYS = 7;
    const SCHEDULE_MOBILE_WINDOW_DAYS = 30;
    const SCHEDULE_ALL_DAY_SUMMARY_REGISTRY_KEY = '__all_day_summary__';

    function sanitizeScheduleNotificationEntries(entries) {
        const src = Array.isArray(entries) ? entries : [];
        const out = [];
        for (const it of src) {
            const id = normalizeNotificationId(it?.id);
            const status = String(it?.status || '').trim();
            const keepNoId = status === 'scheduled-no-id';
            if (!keepNoId && (id === null || id < 0)) continue;
            out.push({
                notificationKey: String(it?.notificationKey || '').trim(),
                dateKey: String(it?.dateKey || '').trim(),
                timeKey: String(it?.timeKey || '').trim(),
                atMs: Number(it?.atMs) || 0,
                id: keepNoId ? -1 : id,
                delayInSeconds: Number(it?.delayInSeconds) || 0,
                status: keepNoId ? 'scheduled-no-id' : 'scheduled',
            });
        }
        return out;
    }

    function sanitizeScheduleNotificationSchedules(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
        const out = {};
        for (const [deviceId, schedule] of Object.entries(raw)) {
            const key = String(deviceId || '').trim();
            if (!key || !schedule || typeof schedule !== 'object') continue;
            out[key] = {
                planKey: String(schedule.planKey || '').trim(),
                updatedAt: String(schedule.updatedAt || '').trim(),
                status: String(schedule.status || '').trim(),
                canceledAt: String(schedule.canceledAt || '').trim(),
                cancelReason: String(schedule.cancelReason || '').trim(),
                entries: sanitizeScheduleNotificationEntries(schedule.entries),
            };
        }
        return out;
    }

    function loadScheduleMobileRegistry() {
        try {
            const raw = String(localStorage.getItem(STORAGE.SCHEDULE_MOBILE_REGISTRY_LS_KEY) || '').trim();
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
            const out = {};
            for (const [scheduleId, schedule] of Object.entries(parsed)) {
                const key = String(scheduleId || '').trim();
                if (!key || !schedule || typeof schedule !== 'object') continue;
                out[key] = {
                    planKey: String(schedule.planKey || '').trim(),
                    updatedAt: String(schedule.updatedAt || '').trim(),
                    status: String(schedule.status || '').trim(),
                    canceledAt: String(schedule.canceledAt || '').trim(),
                    cancelReason: String(schedule.cancelReason || '').trim(),
                    entries: sanitizeScheduleNotificationEntries(schedule.entries),
                };
            }
            return out;
        } catch (e) {
            return {};
        }
    }

    function saveScheduleMobileRegistry(registry) {
        try {
            localStorage.setItem(STORAGE.SCHEDULE_MOBILE_REGISTRY_LS_KEY, JSON.stringify(registry || {}));
        } catch (e) {}
    }

    function buildScheduleNotificationSchedulesView(item, registry) {
        const map = sanitizeScheduleNotificationSchedules(item?.notificationSchedules);
        const scheduleId = String(item?.id || '').trim();
        const deviceId = String(SCHEDULE_SYNC_DEVICE_ID || '').trim();
        if (!scheduleId || !deviceId) return map;
        const sourceRegistry = (registry && typeof registry === 'object') ? registry : loadScheduleMobileRegistry();
        const current = sourceRegistry?.[scheduleId];
        if (!current || typeof current !== 'object') return map;
        map[deviceId] = {
            planKey: String(current.planKey || '').trim(),
            updatedAt: String(current.updatedAt || '').trim(),
            status: String(current.status || '').trim(),
            canceledAt: String(current.canceledAt || '').trim(),
            cancelReason: String(current.cancelReason || '').trim(),
            entries: sanitizeScheduleNotificationEntries(current.entries),
        };
        return map;
    }

    function getScheduleNotificationClientLabel(deviceId, schedule) {
        const safeDeviceId = String(deviceId || '').trim();
        const clientKind = String(
            schedule?.clientKind
            || schedule?.sourceKind
            || schedule?.platformKind
            || schedule?.deviceType
            || ''
        ).trim().toLowerCase();
        if (clientKind === 'mobile' || clientKind === 'android' || clientKind === 'ios' || clientKind === 'harmony') {
            return '移动端';
        }
        if (clientKind === 'desktop' || clientKind === 'pc') {
            return '桌面端';
        }
        if (safeDeviceId && safeDeviceId === String(SCHEDULE_SYNC_DEVICE_ID || '').trim()) {
            return shouldUseOfficialMobileNotificationBackend() ? '移动端' : '桌面端';
        }
        return '未知端';
    }

    function getScheduleDeviceScheduleMap(item) {
        if (!item || typeof item !== 'object') return {};
        const current = item.notificationSchedules;
        if (!current || typeof current !== 'object' || Array.isArray(current)) {
            item.notificationSchedules = {};
        }
        return item.notificationSchedules;
    }

    function getScheduleDeviceSchedule(item, deviceId = SCHEDULE_SYNC_DEVICE_ID) {
        const map = getScheduleDeviceScheduleMap(item);
        const entry = map[String(deviceId || '').trim()];
        return (entry && typeof entry === 'object') ? entry : null;
    }

    function setScheduleDeviceSchedule(item, entry, deviceId = SCHEDULE_SYNC_DEVICE_ID) {
        const key = String(deviceId || '').trim();
        if (!key || !item || typeof item !== 'object') return null;
        const map = getScheduleDeviceScheduleMap(item);
        if (entry && typeof entry === 'object') {
            map[key] = entry;
            return map[key];
        }
        delete map[key];
        return null;
    }

    function buildScheduleNotificationKey(scheduleId, dateKey, timeKey, atMs) {
        return `schedule-mobile:${String(scheduleId || '').trim()}:${String(dateKey || '').trim()}:${String(timeKey || '').trim()}:${String(atMs || '')}`;
    }

    function buildScheduleNotificationEntry(atMs, scheduleId) {
        const dt = new Date(Number(atMs) || 0);
        if (Number.isNaN(dt.getTime())) return null;
        const dateKey = formatDateKey(dt);
        const timeKey = `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
        return {
            notificationKey: buildScheduleNotificationKey(scheduleId, dateKey, timeKey, dt.getTime()),
            dateKey,
            timeKey,
            atMs: dt.getTime(),
        };
    }

    function clampNewScheduleDurationMin(durationMin, settings) {
        const raw = Number(durationMin);
        const safeMin = (Number.isFinite(raw) && raw > 0) ? Math.max(1, Math.round(raw)) : 60;
        const limit = Number(settings?.newScheduleMaxDurationMin);
        if (!Number.isFinite(limit) || limit <= 0) return safeMin;
        return Math.min(safeMin, Math.round(limit));
    }

    function buildScheduleAllDaySummaryNotificationKey(dateKey, timeKey, atMs) {
        return `schedule-mobile-allday-summary:${String(dateKey || '').trim()}:${String(timeKey || '').trim()}:${String(atMs || '')}`;
    }

    function getScheduleMobileNotificationTitle(item, target) {
        const title = String(item?.title || '').trim() || '日程提醒';
        return target?.allDay ? `全天提醒: ${title}` : title;
    }

    function getScheduleMobileNotificationBody(item, target) {
        const title = String(item?.title || '').trim() || '日程';
        if (target?.allDay) return `${title}\n${String(target?.dateKey || '')} ${String(target?.timeKey || '')}`.trim();
        const offset = Number(target?.offsetMin);
        const startDt = new Date(Number(target?.startMs) || 0);
        const startText = Number.isNaN(startDt.getTime()) ? '' : `${pad2(startDt.getHours())}:${pad2(startDt.getMinutes())}`;
        if (Number.isFinite(offset) && offset > 0) {
            const prefix = offset % 60 === 0 ? `${Math.round(offset / 60)} 小时后开始` : `${Math.round(offset)} 分钟后开始`;
            return `${prefix}${startText ? `\n${startText}` : ''}`;
        }
        return startText || title;
    }

    function collectScheduleMobileNotificationTargets(item, settings) {
        if (!settings?.scheduleReminderEnabled) return [];
        const startMs = toMs(item?.start);
        const endMs = toMs(item?.end);
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return [];
        const start = new Date(startMs);
        const end = new Date(endMs);
        const allDay = (item?.allDay === true) || isAllDayRange(start, end);
        if (allDay) return [];
        const reminderMode = String(item?.reminderMode || '').trim() === 'custom' ? 'custom' : 'inherit';
        const defaultMode = String(settings?.scheduleReminderDefaultMode || '0').trim() || '0';
        const out = [];
        if (reminderMode === 'custom') {
            if (item?.reminderEnabled !== true) return out;
        } else {
            if (defaultMode === 'off') {
                return out;
            }
        }
        const offsetMin = (() => {
            if (reminderMode !== 'custom') {
                const n = Number(defaultMode);
                const allowed = new Set([0, 5, 10, 15, 30, 60]);
                return (Number.isFinite(n) && allowed.has(n)) ? n : 0;
            }
            const n = Number(item?.reminderOffsetMin);
            const allowed = new Set([0, 5, 10, 15, 30, 60]);
            return (Number.isFinite(n) && allowed.has(n)) ? n : 0;
        })();
        const now = Date.now();
        const repeatType = getScheduleRepeatType(item);
        const windowDays = repeatType === 'none'
            ? SCHEDULE_MOBILE_WINDOW_DAYS
            : SCHEDULE_ALL_DAY_MOBILE_WINDOW_DAYS;
        const rangeStart = new Date(Math.max(0, now - offsetMin * 60000));
        const rangeEnd = new Date(now + windowDays * 86400000 + offsetMin * 60000);
        const occurrences = collectScheduleOccurrencesInRange(item, rangeStart, rangeEnd, {
            limit: repeatType === 'none' ? 1 : windowDays + 8,
        });
        for (const occurrence of occurrences) {
            const occurrenceStartMs = Number(occurrence?.startMs);
            if (!Number.isFinite(occurrenceStartMs)) continue;
            const atMs = occurrenceStartMs - offsetMin * 60000;
            if (atMs <= now) continue;
            const entry = buildScheduleNotificationEntry(atMs, item?.id);
            if (!entry) continue;
            out.push({ ...entry, allDay: false, startMs: occurrenceStartMs, offsetMin });
        }
        return out;
    }

    function buildScheduleMobilePlanKey(item, settings, targets) {
        // 🔧 修复：使用稳定的标识符，不包含时间戳，避免每次重启都重新创建预约
        const targetSig = (Array.isArray(targets) ? targets : []).map((it) => `${it.notificationKey}@${it.dateKey}@${it.timeKey}`).join('|');
        return [
            String(item?.id || '').trim(),
            String(item?.title || '').trim(),
            String(item?.start || '').trim(),
            String(item?.end || '').trim(),
            String(item?.reminderMode || '').trim(),
            String(item?.reminderEnabled ?? ''),
            String(item?.reminderOffsetMin ?? ''),
            String(getScheduleRepeatType(item) || 'none'),
            String(getScheduleRepeatEvery(item) || '1'),
            String(getScheduleRepeatUntil(item) || ''),
            String(getScheduleRepeatMonthlyMode(item) || 'date'),
            String(settings?.scheduleReminderDefaultMode || '').trim(),
            String(settings?.allDayReminderEnabled ? '1' : '0'),
            String(settings?.allDayReminderTime || '').trim(),
            targetSig,
        ].join('::');
    }

    function shouldIncludeAllDayScheduleInMobileSummary(item, settings) {
        if (!settings?.scheduleReminderEnabled) return false;
        const startMs = toMs(item?.start);
        const endMs = toMs(item?.end);
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return false;
        const start = new Date(startMs);
        const end = new Date(endMs);
        const allDay = (item?.allDay === true) || isAllDayRange(start, end);
        if (!allDay) return false;
        const reminderMode = String(item?.reminderMode || '').trim() === 'custom' ? 'custom' : 'inherit';
        if (reminderMode === 'custom') return item?.reminderEnabled === true;
        return !!settings?.allDayReminderEnabled;
    }

    function collectAllDayScheduleSummaryTargets(list, settings) {
        if (!settings?.scheduleReminderEnabled) return [];
        const allDayTime = parseReminderTime(settings?.allDayReminderTime) || { hh: 9, mm: 0, key: '09:00' };
        const now = Date.now();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const windowEnd = today.getTime() + SCHEDULE_ALL_DAY_MOBILE_WINDOW_DAYS * 86400000;
        const grouped = new Map();
        for (const item of (Array.isArray(list) ? list : [])) {
            if (!shouldIncludeAllDayScheduleInMobileSummary(item, settings)) continue;
            const title = String(item?.title || '').trim() || '全天日程';
            const occurrences = collectScheduleOccurrencesInRange(item, today, new Date(windowEnd), {
                limit: getScheduleRepeatType(item) === 'none' ? 1 : SCHEDULE_ALL_DAY_MOBILE_WINDOW_DAYS + 6,
            });
            for (const occurrence of occurrences) {
                const sDay = occurrence?.start instanceof Date ? new Date(occurrence.start.getTime()) : null;
                const eDay = occurrence?.end instanceof Date ? new Date(occurrence.end.getTime()) : null;
                if (!(sDay instanceof Date) || !(eDay instanceof Date)) continue;
                sDay.setHours(0, 0, 0, 0);
                eDay.setHours(0, 0, 0, 0);
                let dayMs = Math.max(sDay.getTime(), today.getTime());
                let guard = 0;
                while (dayMs < eDay.getTime() && dayMs < windowEnd && guard < SCHEDULE_ALL_DAY_MOBILE_WINDOW_DAYS + 2) {
                    const day = new Date(dayMs);
                    const dateKey = formatDateKey(day);
                    const at = new Date(dayMs);
                    at.setHours(allDayTime.hh, allDayTime.mm, 0, 0);
                    const atMs = at.getTime();
                    if (atMs > now) {
                        const existing = grouped.get(dateKey) || { dateKey, timeKey: `${pad2(at.getHours())}:${pad2(at.getMinutes())}`, atMs, titles: [] };
                        existing.titles.push(title);
                        grouped.set(dateKey, existing);
                    }
                    dayMs += 86400000;
                    guard += 1;
                }
            }
        }
        return Array.from(grouped.values())
            .map((it) => ({
                ...it,
                notificationKey: buildScheduleAllDaySummaryNotificationKey(it.dateKey, it.timeKey, it.atMs),
                titles: Array.from(new Set((it.titles || []).filter(Boolean))),
            }))
            .sort((a, b) => Number(a?.atMs || 0) - Number(b?.atMs || 0));
    }

    function buildAllDayScheduleSummaryPlanKey(targets, settings) {
        const sig = (Array.isArray(targets) ? targets : [])
            .map((it) => `${it.notificationKey}@${it.atMs}:${(it.titles || []).join('|')}`)
            .join('||');
        return [
            'all-day-summary',
            String(settings?.scheduleReminderEnabled ? '1' : '0'),
            String(settings?.allDayReminderEnabled ? '1' : '0'),
            String(settings?.allDayReminderTime || '').trim(),
            String(SCHEDULE_ALL_DAY_MOBILE_WINDOW_DAYS),
            sig,
        ].join('::');
    }

    async function reconcileAllDayScheduleMobileSummary(list, settings, registry) {
        const registryKey = SCHEDULE_ALL_DAY_SUMMARY_REGISTRY_KEY;
        const existing = registry[registryKey] || null;
        const validExistingEntries = sanitizeScheduleNotificationEntries(existing?.entries);
        const targets = collectAllDayScheduleSummaryTargets(list, settings);
        if (targets.length === 0) {
            if (validExistingEntries.length === 0) {
                delete registry[registryKey];
                return false;
            }
            await cancelScheduleMobileNotificationEntries(validExistingEntries);
            delete registry[registryKey];
            return true;
        }
        const planKey = buildAllDayScheduleSummaryPlanKey(targets, settings);
        if (String(existing?.planKey || '').trim() === planKey && validExistingEntries.length === targets.length) {
            registry[registryKey] = { ...(existing || {}), entries: validExistingEntries };
            return false;
        }
        if (validExistingEntries.length > 0) {
            await cancelScheduleMobileNotificationEntries(validExistingEntries);
        }
        const nextEntries = [];
        for (const target of targets) {
            const delayInSeconds = Math.max(1, Math.ceil((Number(target.atMs) - Date.now()) / 1000));
            const title = `全天日程提醒 ${String(target.timeKey || '')}`.trim();
            const body = (target.titles || []).map((t) => `• ${t}`).join('\n');
            const notificationId = await sendDeviceNotificationCompat(title, body, { channel: DEVICE_NOTIFICATION_CHANNEL, delayInSeconds });
            const id = normalizeNotificationId(notificationId);
            if (id === null || id < 0) continue;
            nextEntries.push({
                notificationKey: target.notificationKey,
                dateKey: target.dateKey,
                timeKey: target.timeKey,
                atMs: target.atMs,
                id,
                delayInSeconds,
                status: 'scheduled',
            });
        }
        registry[registryKey] = {
            planKey,
            updatedAt: new Date().toISOString(),
            status: nextEntries.length > 0 ? 'scheduled' : 'empty',
            canceledAt: '',
            cancelReason: '',
            entries: nextEntries,
        };
        return true;
    }

    async function cancelScheduleMobileNotificationEntries(entries) {
        const arr = Array.isArray(entries) ? entries : [];
        for (const it of arr) {
            const id = normalizeNotificationId(it?.id);
            if (id === null || id < 0) continue;
            try { await cancelDeviceNotificationCompat(id); } catch (e) {}
        }
    }

    async function reconcileSingleScheduleMobileNotification(item, settings, registry) {
        // 🔧 修复：桌面端使用实时提醒模式，不预先预约系统通知
        // 只有真正的移动端（手机/平板）才使用预先预约机制
        const isMobile = isLikelyMobileRuntime() || state.isMobileDevice;
        if (!isMobile) {
            // 桌面端：清理旧的预约（如果有的话）
            const existing = getScheduleDeviceSchedule(item) || registry[String(item?.id || '').trim()] || null;
            const validExistingEntries = sanitizeScheduleNotificationEntries(existing?.entries);
            if (validExistingEntries.length > 0) {
                await cancelScheduleMobileNotificationEntries(validExistingEntries);
                delete registry[String(item?.id || '').trim()];
            }
            return { changed: false, item, reason: 'desktop-realtime-mode' };
        }
        
        if (!item || typeof item !== 'object') return { changed: false, item };
        const scheduleId = String(item.id || '').trim();
        if (!scheduleId) return { changed: false, item };
        const existing = getScheduleDeviceSchedule(item) || registry[scheduleId] || null;
        const validExistingEntries = sanitizeScheduleNotificationEntries(existing?.entries);
        const targets = collectScheduleMobileNotificationTargets(item, settings);
        if (targets.length === 0) {
            if (validExistingEntries.length === 0 && !getScheduleDeviceSchedule(item)) return { changed: false, item };
            await cancelScheduleMobileNotificationEntries(validExistingEntries);
            const nextSchedule = {
                ...(existing || {}),
                planKey: '',
                updatedAt: new Date().toISOString(),
                status: 'canceled',
                canceledAt: new Date().toISOString(),
                cancelReason: 'no-targets',
                entries: [],
            };
            setScheduleDeviceSchedule(item, nextSchedule);
            delete registry[scheduleId];
            return { changed: true, item };
        }
        const planKey = buildScheduleMobilePlanKey(item, settings, targets);
        if (String(existing?.planKey || '').trim() === planKey && validExistingEntries.length === targets.length) {
            registry[scheduleId] = {
                ...(existing || {}),
                entries: validExistingEntries,
            };
            return { changed: false, item };
        }
        if (validExistingEntries.length > 0) {
            await cancelScheduleMobileNotificationEntries(validExistingEntries);
        }
        const nextEntries = [];
        for (const target of targets) {
            const delayInSeconds = Math.max(1, Math.ceil((Number(target.atMs) - Date.now()) / 1000));
            const notificationId = await sendDeviceNotificationCompat(
                getScheduleMobileNotificationTitle(item, target),
                getScheduleMobileNotificationBody(item, target),
                { channel: DEVICE_NOTIFICATION_CHANNEL, delayInSeconds }
            );
            const id = normalizeNotificationId(notificationId);
            if (id === null || id < 0) continue;
            nextEntries.push({
                notificationKey: target.notificationKey,
                dateKey: target.dateKey,
                timeKey: target.timeKey,
                atMs: target.atMs,
                id,
                delayInSeconds,
                status: 'scheduled',
            });
        }
        const nextSchedule = {
            planKey,
            updatedAt: new Date().toISOString(),
            status: nextEntries.length > 0 ? 'scheduled' : 'empty',
            canceledAt: '',
            cancelReason: '',
            entries: nextEntries,
        };
        setScheduleDeviceSchedule(item, nextSchedule);
        if (nextEntries.length > 0) registry[scheduleId] = nextSchedule;
        else delete registry[scheduleId];
        return { changed: true, item };
    }

    async function cleanupOrphanScheduleMobileRegistry(scheduleIds, registry) {
        const keep = new Set((Array.isArray(scheduleIds) ? scheduleIds : []).map((id) => String(id || '').trim()).filter(Boolean));
        let changed = false;
        for (const [scheduleId, entry] of Object.entries(registry || {})) {
            const key = String(scheduleId || '').trim();
            if (key === SCHEDULE_ALL_DAY_SUMMARY_REGISTRY_KEY) continue;
            if (!key || keep.has(key)) continue;
            try { await cancelScheduleMobileNotificationEntries(entry?.entries); } catch (e) {}
            delete registry[key];
            changed = true;
        }
        return changed;
    }

    async function syncScheduleMobileNotifications(reason) {
        const sr = state.scheduleReminder;
        if (sr.mobileSyncRunning) {
            sr.mobileSyncPending = true;
            return false;
        }
        
        // 🔧 修复：桌面端使用实时提醒模式，不预先预约系统通知
        // 只有真正的移动端才执行预约同步
        const isMobile = isLikelyMobileRuntime() || state.isMobileDevice;
        if (!isMobile) {
            // 桌面端：只清理孤立的预约，不执行预约同步
            try {
                const list = await loadScheduleAll();
                const registry = loadScheduleMobileRegistry();
                const scheduleIds = Array.isArray(list) ? list.map(it => String(it?.id || '').trim()).filter(Boolean) : [];
                await cleanupOrphanScheduleMobileRegistry(scheduleIds, registry);
                saveScheduleMobileRegistry(registry);
            } catch (e) {}
            return false;
        }
        
        if (!shouldPreferDeviceNotificationBackend()) return false;
        sr.mobileSyncRunning = true;
        try {
            const settings = getSettings();
            const list = await loadScheduleAll();
            if (!Array.isArray(list)) {
                return false;
            }
            const registry = loadScheduleMobileRegistry();
            if (list.length === 0) {
                let changed = false;
                const allDayExisting = sanitizeScheduleNotificationEntries(registry[SCHEDULE_ALL_DAY_SUMMARY_REGISTRY_KEY]?.entries);
                if (allDayExisting.length > 0) {
                    await cancelScheduleMobileNotificationEntries(allDayExisting);
                    changed = true;
                }
                delete registry[SCHEDULE_ALL_DAY_SUMMARY_REGISTRY_KEY];
                const orphanChanged = await cleanupOrphanScheduleMobileRegistry([], registry);
                saveScheduleMobileRegistry(registry);
                return changed || orphanChanged;
            }
            const nextList = cloneScheduleList(list);
            let changed = false;
            for (let i = 0; i < nextList.length; i += 1) {
                const result = await reconcileSingleScheduleMobileNotification(nextList[i], settings, registry);
                if (result?.changed) {
                    nextList[i] = result.item;
                    changed = true;
                }
            }
            const allDayChanged = await reconcileAllDayScheduleMobileSummary(nextList, settings, registry);
            await cleanupOrphanScheduleMobileRegistry(nextList.map((it) => String(it?.id || '').trim()), registry);
            saveScheduleMobileRegistry(registry);
            if (changed) {
                // Device notification state should not overwrite the shared schedule file.
                persistScheduleLocalShadow(nextList);
                return true;
            }
            return !!allDayChanged;
        } catch (e) {
            return false;
        } finally {
            sr.mobileSyncRunning = false;
            if (sr.mobileSyncPending) {
                sr.mobileSyncPending = false;
                scheduleScheduleMobileSync(`pending:${String(reason || '').trim()}`);
            }
        }
    }

    function scheduleScheduleMobileSync(reason) {
        const sr = state.scheduleReminder;
        if (sr.mobileSyncTimer) return;
        sr.mobileSyncTimer = setTimeout(() => {
            sr.mobileSyncTimer = null;
            syncScheduleMobileNotifications(reason).catch(() => null);
        }, 180);
    }

    async function refreshScheduleCurrentDeviceNotificationById(scheduleId) {
        const id = String(scheduleId || '').trim();
        if (!id) return null;
        const list = await loadScheduleAll();
        const nextList = cloneScheduleList(list);
        const idx = nextList.findIndex((it) => String(it?.id || '').trim() === id);
        if (idx < 0) return null;
        const settings = getSettings();
        const registry = loadScheduleMobileRegistry();
        const result = await reconcileSingleScheduleMobileNotification(nextList[idx], settings, registry);
        let changed = !!result?.changed;
        if (result?.item) nextList[idx] = result.item;
        const isAllDay = (() => {
            const s = toMs(nextList[idx]?.start);
            const e = toMs(nextList[idx]?.end);
            if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return false;
            return (nextList[idx]?.allDay === true) || isAllDayRange(new Date(s), new Date(e));
        })();
        if (isAllDay) {
            const allDayChanged = await reconcileAllDayScheduleMobileSummary(nextList, settings, registry);
            changed = changed || !!allDayChanged;
        }
        saveScheduleMobileRegistry(registry);
        if (changed) persistScheduleLocalShadow(nextList);
        return nextList[idx] || null;
    }

    async function refreshScheduleCurrentDeviceNotificationDraft(item) {
        if (!item || typeof item !== 'object') return null;
        const scheduleId = String(item.id || '').trim();
        if (!scheduleId) return null;
        const list = await loadScheduleAll();
        const nextList = cloneScheduleList(list);
        const idx = nextList.findIndex((it) => String(it?.id || '').trim() === scheduleId);
        if (idx < 0) return null;
        nextList[idx] = {
            ...nextList[idx],
            ...item,
            notificationSchedules: sanitizeScheduleNotificationSchedules(item.notificationSchedules || nextList[idx]?.notificationSchedules),
        };
        const settings = getSettings();
        const registry = loadScheduleMobileRegistry();
        const result = await reconcileSingleScheduleMobileNotification(nextList[idx], settings, registry);
        if (result?.item) nextList[idx] = result.item;
        const isAllDay = (() => {
            const s = toMs(nextList[idx]?.start);
            const e = toMs(nextList[idx]?.end);
            if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return false;
            return (nextList[idx]?.allDay === true) || isAllDayRange(new Date(s), new Date(e));
        })();
        if (isAllDay) {
            await reconcileAllDayScheduleMobileSummary(nextList, settings, registry);
        }
        saveScheduleMobileRegistry(registry);
        persistScheduleLocalShadow(nextList);
        return nextList[idx] || null;
    }

    async function clearScheduleCurrentDeviceNotificationById(scheduleId) {
        const id = String(scheduleId || '').trim();
        if (!id) return null;
        const list = await loadScheduleAll();
        const nextList = cloneScheduleList(list);
        const idx = nextList.findIndex((it) => String(it?.id || '').trim() === id);
        if (idx < 0) return null;
        const item = nextList[idx];
        const existing = getScheduleDeviceSchedule(item);
        const validEntries = sanitizeScheduleNotificationEntries(existing?.entries);
        if (validEntries.length > 0) {
            await cancelScheduleMobileNotificationEntries(validEntries);
        }
        const nextSchedule = {
            ...(existing || {}),
            planKey: '',
            updatedAt: new Date().toISOString(),
            status: 'canceled',
            canceledAt: new Date().toISOString(),
            cancelReason: 'manual-clear',
            entries: [],
        };
        setScheduleDeviceSchedule(item, nextSchedule);
        const registry = loadScheduleMobileRegistry();
        delete registry[id];
        saveScheduleMobileRegistry(registry);
        await saveScheduleAll(nextList, { skipDeviceSync: true });
        return item;
    }

    async function clearScheduleAllDeviceNotificationEntriesById(scheduleId) {
        const id = String(scheduleId || '').trim();
        if (!id) return null;
        const list = await loadScheduleAll();
        const nextList = cloneScheduleList(list);
        const idx = nextList.findIndex((it) => String(it?.id || '').trim() === id);
        if (idx < 0) return null;
        const item = nextList[idx];
        const map = buildScheduleNotificationSchedulesView(item);
        for (const schedule of Object.values(map || {})) {
            const entries = sanitizeScheduleNotificationEntries(schedule?.entries);
            if (entries.length > 0) {
                await cancelScheduleMobileNotificationEntries(entries);
            }
        }
        nextList[idx] = {
            ...item,
            notificationSchedules: {},
        };
        const registry = loadScheduleMobileRegistry();
        delete registry[id];
        saveScheduleMobileRegistry(registry);
        await saveScheduleAll(nextList, { skipDeviceSync: true });
        return nextList[idx] || null;
    }

    function ensureScheduleReminderToastHost() {
        const sr = state.scheduleReminder;
        if (sr.toastHost && document.body.contains(sr.toastHost)) return sr.toastHost;
        const host = document.createElement('div');
        host.className = 'tm-calendar-reminder-host';
        document.body.appendChild(host);
        sr.toastHost = host;
        if (!sr.toastStyleEl) {
            const st = document.createElement('style');
            st.textContent = `
.tm-calendar-reminder-host{position:fixed;top:12px;right:12px;z-index:100020;display:flex;flex-direction:column;gap:10px;pointer-events:none;}
.tm-calendar-reminder-toast{min-width:240px;max-width:420px;background:var(--b3-theme-background);color:var(--b3-theme-on-background);border:1px solid var(--b3-border-color);border-radius:10px;padding:10px 12px;box-shadow:0 10px 28px rgba(0,0,0,.22);backdrop-filter:saturate(1.2) blur(8px);-webkit-backdrop-filter:saturate(1.2) blur(8px);opacity:0;transform:translateY(-6px);transition:opacity .16s ease,transform .16s ease;pointer-events:auto;cursor:pointer;}
.tm-calendar-reminder-toast.is-in{opacity:1;transform:translateY(0);}
.tm-calendar-reminder-head{display:flex;align-items:flex-start;gap:10px;}
.tm-calendar-reminder-title{flex:1 1 auto;font-size:14px;font-weight:600;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.tm-calendar-reminder-close{flex:0 0 auto;width:22px;height:22px;border:none;border-radius:6px;background:transparent;color:inherit;opacity:.65;cursor:pointer;padding:0;line-height:22px;font-size:16px;}
.tm-calendar-reminder-close:hover{opacity:1;background:var(--b3-theme-surface-light);}
.tm-calendar-reminder-title{font-size:14px;font-weight:600;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.tm-calendar-reminder-body{margin-top:4px;font-size:12px;line-height:1.35;opacity:.86;word-break:break-word;white-space:pre-line;}
            `.trim();
            document.head.appendChild(st);
            sr.toastStyleEl = st;
        }
        return host;
    }

    function showScheduleReminderToast(title, body) {
        try {
            const host = ensureScheduleReminderToastHost();
            const toastEl = document.createElement('div');
            toastEl.className = 'tm-calendar-reminder-toast';
            toastEl.innerHTML = `<div class="tm-calendar-reminder-head"><div class="tm-calendar-reminder-title">${esc(String(title || '日程提醒'))}</div><button class="tm-calendar-reminder-close" type="button" aria-label="关闭">×</button></div><div class="tm-calendar-reminder-body">${esc(String(body || ''))}</div>`;
            host.appendChild(toastEl);
            requestAnimationFrame(() => { try { toastEl.classList.add('is-in'); } catch (e) {} });
            const close = () => {
                try { toastEl.classList.remove('is-in'); } catch (e) {}
                setTimeout(() => { try { toastEl.remove(); } catch (e) {} }, 180);
            };
            toastEl.addEventListener('click', (e) => {
                const t = e?.target;
                if (t && t instanceof Element) {
                    if (t.closest('a,button,input,textarea,select,option')) return;
                }
                try { e.preventDefault?.(); } catch (e2) {}
                close();
            });
            const closeBtn = toastEl.querySelector('.tm-calendar-reminder-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    try { e.stopPropagation?.(); } catch (e2) {}
                    try { e.preventDefault?.(); } catch (e2) {}
                    close();
                });
            }
            setTimeout(() => { try { close(); } catch (e2) {} }, 10000);
        } catch (e) {}
    }

    function describeDeviceNotificationFailureReason(reason) {
        const key = String(reason || '').trim();
        if (!key) return '未知原因';
        if (key === 'platform-utils-unavailable') return '未获取到思源通知接口';
        if (key === 'send-returned-minus-one') return '思源通知接口返回了 -1';
        if (key === 'send-no-numeric-return') return '思源通知接口未返回有效通知 ID';
        if (key === 'platform-utils-send-error') return '调用思源通知接口时抛错';
        return key;
    }

    function showScheduleSystemNotification(title, body) {
        const safeTitle = String(title || '日程提醒');
        const safeBody = String(body || '');
        sendDeviceNotificationCompat(safeTitle, safeBody, { timeoutType: 'never' })
            .then((value) => {
                const id = normalizeNotificationId(value);
                if (id !== null && id >= 0) return;
                const reason = describeDeviceNotificationFailureReason(sendDeviceNotificationCompat._lastFailureReason);
                showScheduleReminderToast(safeTitle, `${safeBody}\n\n系统提醒失败：${reason}`);
            })
            .catch(() => {
                const reason = describeDeviceNotificationFailureReason(sendDeviceNotificationCompat._lastFailureReason);
                showScheduleReminderToast(safeTitle, `${safeBody}\n\n系统提醒失败：${reason}`);
            });
        return true;
    }

    function shouldShowImmediateScheduleSystemNotification() {
        const settings = getSettings();
        if (!settings?.scheduleReminderSystemEnabled) return false;
        return !shouldPreferDeviceNotificationBackend();
    }

    function clearScheduleReminderTimers() {
        const sr = state.scheduleReminder;
        try {
            if (sr.refreshTimer) {
                clearTimeout(sr.refreshTimer);
                sr.refreshTimer = null;
            }
        } catch (e) {}
        try {
            if (sr.periodicTimer) {
                clearTimeout(sr.periodicTimer);
                sr.periodicTimer = null;
            }
        } catch (e) {}
        try {
            if (sr.mobileSyncTimer) {
                clearTimeout(sr.mobileSyncTimer);
                sr.mobileSyncTimer = null;
            }
        } catch (e) {}
        try {
            if (sr.timers && typeof sr.timers.forEach === 'function') {
                sr.timers.forEach((t) => {
                    try { clearTimeout(t); } catch (e) {}
                });
            }
        } catch (e) {}
        try { sr.timers = new Map(); } catch (e) {}
    }

    async function refreshScheduleReminderTimers(reason) {
        const sr = state.scheduleReminder;
        const hasStore = !!(state.settingsStore && state.settingsStore.data) || !!(state.sideDay?.settingsStore && state.sideDay.settingsStore.data);
        if (!hasStore) return;
        const settings = getSettings();
        if (!settings.scheduleReminderEnabled) {
            sr.enabled = false;
            clearScheduleReminderTimers();
            if (shouldPreferDeviceNotificationBackend()) {
                try { scheduleScheduleMobileSync(reason || 'disabled'); } catch (e) {}
            }
            return;
        }
        sr.enabled = true;

        // 🔧 修复：桌面端启动时立即清理所有旧的系统通知预约
        // 避免旧的预约在到点时触发通知
        // 只使用 isLikelyMobileRuntime()，确保桌面端不使用预约机制
        const isMobile = isLikelyMobileRuntime() || state.isMobileDevice;
        if (!isMobile && settings.scheduleReminderEnabled) {
            // 桌面端：立即清理所有旧的预约
            try {
                const registry = loadScheduleMobileRegistry();
                const entriesToCancel = [];
                for (const [scheduleId, schedule] of Object.entries(registry)) {
                    if (schedule?.entries?.length) {
                        for (const entry of schedule.entries) {
                            entriesToCancel.push(entry);
                        }
                    }
                }
                if (entriesToCancel.length > 0) {
                    for (const entry of entriesToCancel) {
                        try { await cancelDeviceNotificationCompat(entry.id); } catch (e) {}
                    }
                    // 清空本地注册表
                    saveScheduleMobileRegistry({});
                }
            } catch (e) {
            }
        }

        if (shouldPreferDeviceNotificationBackend()) {
            try { scheduleScheduleMobileSync(reason || 'refresh'); } catch (e) {}
        }
        const now = Date.now();
        const todayKey = formatDateKey(new Date(now));
        const windowEnd = now + 36 * 60 * 60000;
        const list = await loadScheduleAll();
        const desired = new Map();
        const allDayTime = parseReminderTime(settings.allDayReminderTime) || { hh: 9, mm: 0, key: '09:00' };
        const defaultMode = String(settings.scheduleReminderDefaultMode || '0').trim() || '0';
        const defaultOffsetMin = (() => {
            if (defaultMode === 'off') return null;
            const n = Number(defaultMode);
            const allowed = new Set([0, 5, 10, 15, 30, 60]);
            return (Number.isFinite(n) && allowed.has(n)) ? n : 0;
        })();
        for (const it of (Array.isArray(list) ? list : [])) {
            if (!it || typeof it !== 'object') continue;
            const id = String(it.id || '').trim();
            if (!id) continue;
            const startMs = toMs(it.start);
            const endMs = toMs(it.end);
            if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;
            const start = new Date(startMs);
            const end = new Date(endMs);
            const allDay = (it.allDay === true) || isAllDayRange(start, end);
            const reminderMode = String(it.reminderMode || '').trim() === 'custom' ? 'custom' : 'inherit';
            if (reminderMode === 'custom') {
                if (it.reminderEnabled !== true) continue;
            } else {
                if (allDay) {
                    if (!settings.allDayReminderEnabled) continue;
                } else {
                    if (defaultMode === 'off') continue;
                }
            }
            if (allDay) {
                const occurrences = collectScheduleOccurrencesInRange(it, new Date(now), new Date(windowEnd), {
                    limit: getScheduleRepeatType(it) === 'none' ? 1 : 8,
                });
                for (const occurrence of occurrences) {
                    const sDay = occurrence?.start instanceof Date ? new Date(occurrence.start.getTime()) : null;
                    const eDay = occurrence?.end instanceof Date ? new Date(occurrence.end.getTime()) : null;
                    if (!(sDay instanceof Date) || !(eDay instanceof Date)) continue;
                    sDay.setHours(0, 0, 0, 0);
                    eDay.setHours(0, 0, 0, 0);
                    let dayMs = sDay.getTime();
                    const endDayMs = eDay.getTime();
                    while (dayMs < endDayMs && dayMs < windowEnd) {
                        const dt = new Date(dayMs);
                        dt.setHours(allDayTime.hh, allDayTime.mm, 0, 0);
                        const atMs = dt.getTime();
                        const dateKey = formatDateKey(dt);
                        const inWindow = (atMs < windowEnd) && (atMs > now);
                        if (inWindow) {
                            const fired = loadScheduleReminderFiredSet(dateKey);
                            const key = buildScheduleReminderKey(id, atMs);
                            if (!fired.has(key)) {
                                desired.set(key, { kind: 'schedule', atMs, scheduleId: id, title: String(it.title || '日程').trim() || '日程', allDay: true, dateKey });
                            }
                        }
                        dayMs += 86400000;
                    }
                }
                continue;
            }
            const offsetMin = (() => {
                if (reminderMode !== 'custom') return Number(defaultOffsetMin) || 0;
                const n = Number(it.reminderOffsetMin);
                const allowed = new Set([0, 5, 10, 15, 30, 60]);
                return (Number.isFinite(n) && allowed.has(n)) ? n : 0;
            })();
            const occurrences = collectScheduleOccurrencesInRange(
                it,
                new Date(Math.max(0, now - offsetMin * 60000)),
                new Date(windowEnd + offsetMin * 60000),
                { limit: getScheduleRepeatType(it) === 'none' ? 1 : 8 }
            );
            for (const occurrence of occurrences) {
                const occurrenceStartMs = Number(occurrence?.startMs);
                if (!Number.isFinite(occurrenceStartMs)) continue;
                const atMs = occurrenceStartMs - offsetMin * 60000;
                if (atMs <= now || atMs >= windowEnd) continue;
                const dt = new Date(atMs);
                const dateKey = formatDateKey(dt);
                const fired = loadScheduleReminderFiredSet(dateKey);
                const key = buildScheduleReminderKey(id, atMs);
                if (fired.has(key)) continue;
                desired.set(key, { kind: 'schedule', atMs, startMs: occurrenceStartMs, scheduleId: id, title: String(it.title || '日程').trim() || '日程', allDay: false, dateKey, offsetMin });
            }
        }

        if (settings.taskDateAllDayReminderEnabled && typeof window.tmQueryCalendarTaskDateEvents === 'function') {
            try {
                const today0 = new Date(now);
                today0.setHours(0, 0, 0, 0);
                const queryEnd = new Date(windowEnd + 86400000);
                const items = await Promise.resolve().then(() => window.tmQueryCalendarTaskDateEvents(today0, queryEnd)).catch(() => []);
                for (const it of (Array.isArray(items) ? items : [])) {
                    const tid = String(it?.id || '').trim();
                    const title = String(it?.title || '').trim() || '任务';
                    const startKey = String(it?.start || '').trim();
                    const endExKey = String(it?.endExclusive || it?.end || '').trim();
                    if (!tid || !startKey || !endExKey) continue;
                    const sDay = parseDateOnly(startKey);
                    const eDay = parseDateOnly(endExKey);
                    if (!(sDay instanceof Date) || Number.isNaN(sDay.getTime())) continue;
                    if (!(eDay instanceof Date) || Number.isNaN(eDay.getTime())) continue;
                    const sMs0 = new Date(sDay.getFullYear(), sDay.getMonth(), sDay.getDate(), 0, 0, 0, 0).getTime();
                    const eMs0 = new Date(eDay.getFullYear(), eDay.getMonth(), eDay.getDate(), 0, 0, 0, 0).getTime();
                    if (eMs0 <= sMs0) continue;
                    let dayMs = Math.max(sMs0, today0.getTime());
                    const untilMs = Math.min(eMs0, queryEnd.getTime());
                    while (dayMs < untilMs) {
                        const dt = new Date(dayMs);
                        dt.setHours(allDayTime.hh, allDayTime.mm, 0, 0);
                        const atMs = dt.getTime();
                        const dateKey = formatDateKey(dt);
                        const inWindow = (atMs < windowEnd) && (atMs > now);
                        if (inWindow) {
                            const fired = loadScheduleReminderFiredSet(dateKey);
                            const key = buildTaskDateReminderKey(tid, atMs);
                            if (!fired.has(key)) {
                                desired.set(key, { kind: 'taskdate', atMs, scheduleId: '', title, allDay: true, dateKey });
                            }
                        }
                        dayMs += 86400000;
                    }
                }
            } catch (e) {}
        }

        if (settings.allDaySummaryIncludeExtras) {
            const today0 = new Date(now);
            today0.setHours(0, 0, 0, 0);
            const queryEnd = new Date(windowEnd + 86400000);
            if (settings.linkDockTomato) {
                try {
                    const blocks = await loadReminderBlocks().catch(() => []);
                    const dayKeys = [];
                    for (let dayMs = today0.getTime(); dayMs < queryEnd.getTime(); dayMs += 86400000) {
                        const dt = new Date(dayMs);
                        dt.setHours(allDayTime.hh, allDayTime.mm, 0, 0);
                        const atMs = dt.getTime();
                        const dateKey = formatDateKey(dt);
                        const inWindow = (atMs < windowEnd) && (atMs > now);
                        if (inWindow) dayKeys.push({ dateKey, atMs });
                    }
                    for (const d0 of dayKeys) {
                        const dateKey = String(d0?.dateKey || '').trim();
                        const atMs = Number(d0?.atMs);
                        if (!dateKey || !Number.isFinite(atMs)) continue;
                        const fired = loadScheduleReminderFiredSet(dateKey);
                        for (const r of Array.isArray(blocks) ? blocks : []) {
                            if (!r || r.enabled === false) continue;
                            if (!doesReminderOccurOnDate(r, dateKey)) continue;
                            const blockId = String(r.blockId || r.block_id || r.taskBlockId || r.task_block_id || r.targetBlockId || r.target_block_id || r.id || '').trim();
                            const titleBase = String(r.blockName || r.blockContent || r.title || '').trim() || '任务提醒';
                            const times = getReminderTimes(r);
                            const completedSet = getReminderCompletedSet(r);
                            const done = isReminderDateCompleted(r, dateKey, times, completedSet);
                            const timeLabel = times.length > 0 ? ` (${times.join(',')})` : '';
                            const title = `${done ? '✓ ' : '⏰ '}${titleBase}${timeLabel}`;
                            const key = `reminder:${blockId || titleBase}:${dateKey}:${String(atMs)}`;
                            if (fired.has(key)) continue;
                            desired.set(key, { kind: 'reminder', atMs, scheduleId: '', title, allDay: true, dateKey });
                        }
                    }
                } catch (e) {}
            }
            if (settings.showCnHoliday) {
                try {
                    const years = Array.from(new Set([today0.getFullYear(), queryEnd.getFullYear()])).filter((x) => Number.isFinite(Number(x)));
                    const cnHolidayDays = await Promise.all(years.map((y) => loadCnHolidayYear(y))).then((arr) => arr.flat()).catch(() => []);
                    const evs = buildCnHolidayEvents(cnHolidayDays, today0, queryEnd, 'dayGridMonth', settings);
                    for (const ev of Array.isArray(evs) ? evs : []) {
                        const title = String(ev?.title || '').trim();
                        const dateKey = String(ev?.start || '').trim();
                        if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
                        const d = parseDateOnly(dateKey);
                        if (!(d instanceof Date) || Number.isNaN(d.getTime())) continue;
                        const dt = new Date(d.getTime());
                        dt.setHours(allDayTime.hh, allDayTime.mm, 0, 0);
                        const atMs = dt.getTime();
                        const inWindow = (atMs < windowEnd) && (atMs > now);
                        if (!inWindow) continue;
                        const fired = loadScheduleReminderFiredSet(dateKey);
                        const key = `cnHoliday:${dateKey}:${title}:${String(atMs)}`;
                        if (fired.has(key)) continue;
                        desired.set(key, { kind: 'cnHoliday', atMs, scheduleId: '', title, allDay: true, dateKey });
                    }
                } catch (e) {}
            }
        }
        const active = sr.timers || new Map();
        const desiredTimers = new Map();
        const allDayGroups = new Map();
        desired.forEach((meta, key) => {
            if (meta && meta.allDay === true) {
                const gk = `allday:${String(meta.atMs || '')}`;
                const arr = allDayGroups.get(gk) || [];
                arr.push({ key, meta });
                allDayGroups.set(gk, arr);
            } else {
                desiredTimers.set(key, { kind: 'single', key, meta });
            }
        });
        allDayGroups.forEach((items, gk) => {
            if (!Array.isArray(items) || items.length === 0) return;
            const atMs = Number(items[0]?.meta?.atMs);
            if (!Number.isFinite(atMs)) return;
            desiredTimers.set(gk, { kind: 'allday', atMs, items });
        });
        active.forEach((timerId, key) => {
            if (!desiredTimers.has(key)) {
                try { clearTimeout(timerId); } catch (e) {}
                try { active.delete(key); } catch (e) {}
            }
        });
        desiredTimers.forEach((pack, timerKey) => {
            if (active.has(timerKey)) return;
            const kind0 = String(pack?.kind || '').trim() || 'single';
            const atMs0 = kind0 === 'allday' ? Number(pack?.atMs) : Number(pack?.meta?.atMs);
            if (!Number.isFinite(atMs0)) return;
            const delayMs = Math.max(0, atMs0 - Date.now());
            const t = setTimeout(async () => {
                try {
                    const dt = new Date(atMs0);
                    const timeText = `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
                    const dateKey0 = formatDateKey(dt);
                    const fired = loadScheduleReminderFiredSet(dateKey0);
                    if (kind0 === 'allday') {
                        const items = Array.isArray(pack?.items) ? pack.items : [];
                        const titles = [];
                        const firedAny = [];
                        for (const it of items) {
                            const k0 = String(it?.key || '').trim();
                            if (!k0) continue;
                            const m0 = it?.meta || {};
                            const dk = String(m0.dateKey || dateKey0).trim() || dateKey0;
                            if (dk !== dateKey0) continue;
                            if (fired.has(k0)) continue;
                            fired.add(k0);
                            firedAny.push(k0);
                            const t0 = String(m0.title || '').trim() || '全天事件';
                            titles.push(t0);
                        }
                        if (firedAny.length === 0) return;
                        saveScheduleReminderFiredSet(dateKey0, fired);
                        const title = `全天提醒 ${timeText}`;
                        const body = titles.map((x) => `• ${x}`).join('\n');
                        showScheduleReminderToast(title, body);
                        if (shouldShowImmediateScheduleSystemNotification()) {
                            showScheduleSystemNotification(title, titles.join('\n'));
                        }
                        return;
                    }
                    const meta = pack?.meta || {};
                    const key = String(pack?.key || timerKey).trim();
                    const dateKey = String(meta.dateKey || dateKey0).trim() || dateKey0;
                    if (dateKey !== dateKey0) return;
                    // 非全天日程：直接触发提醒，不保存 fired 记录（修改后可重新触发）
                    const offset = Number(meta.offsetMin);
                    const startMs1 = (() => {
                        const s = Number(meta.startMs);
                        if (Number.isFinite(s) && s > 0) return s;
                        if (Number.isFinite(offset) && offset > 0) return atMs0 + offset * 60000;
                        return atMs0;
                    })();
                    const startDt = new Date(startMs1);
                    const startText = `${pad2(startDt.getHours())}:${pad2(startDt.getMinutes())}`;
                    const afterText = (() => {
                        if (!Number.isFinite(offset) || offset <= 0) return '';
                        if (offset % 60 === 0) {
                            const h = Math.round(offset / 60);
                            return `${h}小时后`;
                        }
                        return `${Math.round(offset)}分钟后`;
                    })();
                    const bodyInApp = (meta.allDay === true) ? `${startText}` : (afterText ? `${startText}（${afterText}）` : `${startText}`);
                    showScheduleReminderToast(meta.title, bodyInApp);
                    if (shouldShowImmediateScheduleSystemNotification()) {
                        showScheduleSystemNotification(meta.title, bodyInApp);
                    }
                } catch (e) {} finally {
                    try { scheduleScheduleReminderRefresh('fire'); } catch (e2) {}
                }
            }, Math.min(delayMs, 2147483000));
            active.set(timerKey, t);
        });
        
        sr.timers = active;
        if (sr.periodicTimer) {
            clearTimeout(sr.periodicTimer);
            sr.periodicTimer = null;
        }
        const periodicDelayMs = shouldPreferDeviceNotificationBackend() ? 60 * 1000 : 10 * 60 * 1000;
        sr.periodicTimer = setTimeout(() => {
            try { scheduleScheduleReminderRefresh(shouldPreferDeviceNotificationBackend() ? 'mobile-periodic' : 'periodic'); } catch (e) {}
        }, periodicDelayMs);
    }

    function scheduleScheduleReminderRefresh(reason) {
        const sr = state.scheduleReminder;
        if (sr.refreshTimer) return;
        sr.refreshTimer = setTimeout(() => {
            sr.refreshTimer = null;
            refreshScheduleReminderTimers(reason).catch(() => null);
        }, 180);
    }

    async function pollSharedScheduleFileAndSync(reason) {
        const sr = state.scheduleReminder;
        if (!shouldPreferDeviceNotificationBackend()) return false;
        if (document.visibilityState === 'hidden') return false;
        if (sr.sharedFileWatchRunning) return false;
        sr.sharedFileWatchRunning = true;
        try {
            const refreshed = await refreshScheduleCacheFromSharedFile();
            if (!refreshed?.changed) return false;
            try { refetchAllCalendars(); } catch (e) {}
            try { scheduleScheduleReminderRefresh(`shared-file:${String(reason || '').trim()}`); } catch (e) {}
            return true;
        } finally {
            sr.sharedFileWatchRunning = false;
        }
    }

    function stopSharedScheduleFileWatch() {
        const sr = state.scheduleReminder;
        if (sr.sharedFileWatchTimer) {
            try { clearTimeout(sr.sharedFileWatchTimer); } catch (e) {}
            sr.sharedFileWatchTimer = null;
        }
        sr.sharedFileWatchRunning = false;
    }

    function ensureSharedScheduleFileWatch() {
        const sr = state.scheduleReminder;
        if (!shouldPreferDeviceNotificationBackend()) {
            stopSharedScheduleFileWatch();
            return;
        }
        if (sr.sharedFileWatchTimer) return;
        const loop = () => {
            sr.sharedFileWatchTimer = setTimeout(async () => {
                sr.sharedFileWatchTimer = null;
                try { await pollSharedScheduleFileAndSync('watch'); } catch (e) {}
                ensureSharedScheduleFileWatch();
            }, 2500);
        };
        loop();
    }

    function bindScheduleReminderBackgroundRefresh() {
        const sr = state.scheduleReminder;
        if (sr.backgroundRefreshBound) return;
        const trigger = (reason) => {
            const now = Date.now();
            if (now - (Number(sr.backgroundLastRefreshAt) || 0) < 800) return;
            sr.backgroundLastRefreshAt = now;
            try { scheduleScheduleReminderRefresh(reason); } catch (e) {}
            try { pollSharedScheduleFileAndSync(reason); } catch (e) {}
        };
        sr.backgroundVisibilityHandler = () => {
            if (document.visibilityState === 'visible') trigger('app-visibility');
        };
        sr.backgroundFocusHandler = () => {
            trigger('app-focus');
        };
        sr.backgroundPageShowHandler = () => {
            trigger('app-pageshow');
        };
        try { document.addEventListener('visibilitychange', sr.backgroundVisibilityHandler, true); } catch (e) {}
        try { window.addEventListener('focus', sr.backgroundFocusHandler, true); } catch (e) {}
        try { window.addEventListener('pageshow', sr.backgroundPageShowHandler, true); } catch (e) {}
        sr.backgroundRefreshBound = true;
        try { ensureSharedScheduleFileWatch(); } catch (e) {}
    }

    function unbindScheduleReminderBackgroundRefresh() {
        const sr = state.scheduleReminder;
        if (sr.backgroundVisibilityHandler) {
            try { document.removeEventListener('visibilitychange', sr.backgroundVisibilityHandler, true); } catch (e) {}
            sr.backgroundVisibilityHandler = null;
        }
        if (sr.backgroundFocusHandler) {
            try { window.removeEventListener('focus', sr.backgroundFocusHandler, true); } catch (e) {}
            sr.backgroundFocusHandler = null;
        }
        if (sr.backgroundPageShowHandler) {
            try { window.removeEventListener('pageshow', sr.backgroundPageShowHandler, true); } catch (e) {}
            sr.backgroundPageShowHandler = null;
        }
        sr.backgroundRefreshBound = false;
        stopSharedScheduleFileWatch();
    }

    function bindScheduleReminderEngine() {
        const sr = state.scheduleReminder;
        if (sr.scheduleUpdatedListener) return;
        sr.scheduleUpdatedListener = () => { 
            scheduleScheduleReminderRefresh('schedule-updated'); 
        };
        try { window.addEventListener('tm:calendar-schedule-updated', sr.scheduleUpdatedListener); } catch (e) {}
        try { bindScheduleReminderBackgroundRefresh(); } catch (e) {}
        scheduleScheduleReminderRefresh('bind');
        try { pollSharedScheduleFileAndSync('bind'); } catch (e) {}
    }

    function unbindScheduleReminderEngine() {
        const sr = state.scheduleReminder;
        if (sr.scheduleUpdatedListener) {
            try { window.removeEventListener('tm:calendar-schedule-updated', sr.scheduleUpdatedListener); } catch (e) {}
            sr.scheduleUpdatedListener = null;
        }
        try { unbindScheduleReminderBackgroundRefresh(); } catch (e) {}
        clearScheduleReminderTimers();
        try {
            if (sr.toastHost) {
                sr.toastHost.remove();
                sr.toastHost = null;
            }
        } catch (e) {}
        try {
            if (sr.toastStyleEl) {
                sr.toastStyleEl.remove();
                sr.toastStyleEl = null;
            }
        } catch (e) {}
    }

    async function addTaskSchedule(input) {
        const base = (input && typeof input === 'object') ? input : {};
        const taskId = String(base.taskId || '').trim();
        let startMs = toMs(base.start);
        let endMs = toMs(base.end);
        const durationMin = Number(base.durationMin);
        const forceAllDay = base.allDay === true;
        if (!taskId || !Number.isFinite(startMs) || startMs <= 0) throw new Error('invalid schedule payload');
        if (forceAllDay) {
            const sDate = new Date(startMs);
            sDate.setHours(0, 0, 0, 0);
            let eDate = Number.isFinite(endMs) ? new Date(endMs) : null;
            if (!(eDate instanceof Date) || Number.isNaN(eDate.getTime())) {
                eDate = new Date(sDate.getTime() + 86400000);
            } else {
                eDate.setHours(0, 0, 0, 0);
                if (eDate.getTime() <= sDate.getTime()) eDate = new Date(sDate.getTime() + 86400000);
            }
            startMs = sDate.getTime();
            endMs = eDate.getTime();
        }
        if (!Number.isFinite(endMs) || endMs <= startMs) {
            const safeMin = (Number.isFinite(durationMin) && durationMin > 0) ? Math.max(15, Math.round(durationMin)) : 60;
            endMs = startMs + safeMin * 60000;
        }
        const start = new Date(startMs);
        const end = new Date(endMs);
        const settings = getSettings();
        const calendarId = String(base.calendarId || '').trim() || pickDefaultCalendarId(settings);
        const title = String(base.title || '').trim() || '任务';
        const color = String(base.color || '').trim();
        try {
            const store = state.settingsStore || state.sideDay?.settingsStore || null;
            const calendarDefs = getCalendarDefs(settings);
            if (store && store.data && calendarDefs.some((d) => String(d?.id || '').trim() === calendarId)) {
                let dirty = false;
                if (store.data.calendarShowSchedule === false) {
                    store.data.calendarShowSchedule = true;
                    dirty = true;
                }
                const prev = (store.data.calendarCalendarsConfig && typeof store.data.calendarCalendarsConfig === 'object' && !Array.isArray(store.data.calendarCalendarsConfig))
                    ? store.data.calendarCalendarsConfig
                    : {};
                const entry = (prev[calendarId] && typeof prev[calendarId] === 'object') ? prev[calendarId] : {};
                if (entry.enabled === false) {
                    store.data.calendarCalendarsConfig = { ...prev, [calendarId]: { ...entry, enabled: true } };
                    dirty = true;
                }
                if (dirty) await store.save();
            }
        } catch (e) {}
        const list = await loadScheduleAll();
        const item = {
            id: uuid(),
            title,
            start: safeISO(start),
            end: safeISO(end),
            allDay: forceAllDay ? true : isAllDayRange(start, end),
            color,
            calendarId,
            taskId,
            reminderMode: 'inherit',
            reminderEnabled: null,
            reminderOffsetMin: null,
        };
        list.push(item);
        await saveScheduleAll(list);
        refetchAllCalendars();
        return item;
    }

    function parseTaskDurationMinutes(raw) {
        const s = String(raw || '').trim().toLowerCase();
        if (!s) return 60;
        const num = Number(s);
        if (Number.isFinite(num) && num > 0) return Math.max(15, Math.round(num));
        const m1 = /(\d+(?:\.\d+)?)\s*h/.exec(s);
        if (m1) return Math.max(15, Math.round(Number(m1[1]) * 60));
        const m2 = /(\d+(?:\.\d+)?)\s*(m|min|分钟)/.exec(s);
        if (m2) return Math.max(15, Math.round(Number(m2[1])));
        return 60;
    }

    function parseTaskDropPayload(jsEvent, draggedEl, resolveTask) {
        const dt = jsEvent?.dataTransfer;
        let taskId = '';
        let calendarId = '';
        let titleFromPayload = '';
        let durationFromPayload = NaN;
        const tryJson = (raw) => {
            try { return JSON.parse(raw); } catch (e) {}
            return null;
        };
        try {
            const rawTask = String(dt?.getData?.('application/x-tm-task') || '').trim();
            const pTask = rawTask ? tryJson(rawTask) : null;
            if (pTask && typeof pTask === 'object') {
                taskId = String(pTask.id || pTask.taskId || '').trim() || taskId;
                calendarId = String(pTask.calendarId || '').trim() || calendarId;
                titleFromPayload = String(pTask.title || '').trim() || titleFromPayload;
                const m = Number(pTask.durationMin);
                if (Number.isFinite(m) && m > 0) durationFromPayload = Math.max(15, Math.round(m));
            }
        } catch (e) {}
        try {
            const d0 = draggedEl && typeof draggedEl.getAttribute === 'function' ? draggedEl : null;
            if (d0) {
                taskId = String(d0.getAttribute('data-id') || d0.getAttribute('data-task-id') || '').trim();
                if (!calendarId) calendarId = String(d0.getAttribute('data-calendar-id') || '').trim();
            }
        } catch (e) {}
        try { if (!taskId) taskId = String(dt?.getData?.('application/x-tm-task-id') || '').trim(); } catch (e) {}
        if (!taskId) {
            try {
                if (typeof window.tmCalendarGetDraggingTaskId === 'function') {
                    taskId = String(window.tmCalendarGetDraggingTaskId() || '').trim();
                }
            } catch (e) {}
        }
        if (!taskId) {
            try {
                const raw = String(dt?.getData?.('text/plain') || '').trim();
                if (raw) {
                    const p = tryJson(raw);
                    if (p && typeof p === 'object') {
                        taskId = String(p.taskId || '').trim() || String(Array.isArray(p.taskIds) ? p.taskIds[0] : '').trim();
                    } else {
                        taskId = raw;
                    }
                }
            } catch (e) {}
        }
        taskId = String(taskId || '').trim();
        if (!taskId) return null;
        const resolver = typeof resolveTask === 'function' ? resolveTask : null;
        const task = resolver ? resolver(taskId) : null;
        let title = String(task?.content || task?.title || '').trim() || taskId;
        let durationMin = parseTaskDurationMinutes(task?.duration);
        if (titleFromPayload) title = titleFromPayload;
        if (Number.isFinite(durationFromPayload) && durationFromPayload > 0) durationMin = durationFromPayload;
        try {
            const meta = (typeof window.tmCalendarGetTaskDragMeta === 'function')
                ? window.tmCalendarGetTaskDragMeta(taskId)
                : null;
            if (meta && typeof meta === 'object') {
                if (!calendarId) calendarId = String(meta.calendarId || '').trim() || calendarId;
                if (!(Number.isFinite(durationFromPayload) && durationFromPayload > 0)) {
                    const m = Number(meta.durationMin);
                    if (Number.isFinite(m) && m > 0) durationMin = Math.max(15, Math.round(m));
                }
                if (!titleFromPayload) {
                    const mt = String(meta.title || '').trim();
                    if (mt) title = mt;
                }
            }
        } catch (e) {}
        return { taskId, title, durationMin, calendarId: String(calendarId || '').trim() };
    }

    function buildDraggingTaskPayload(resolveTask) {
        let taskId = '';
        try {
            if (typeof window.tmCalendarGetDraggingTaskId === 'function') {
                taskId = String(window.tmCalendarGetDraggingTaskId() || '').trim();
            }
        } catch (e) {}
        if (!taskId) return null;
        const resolver = typeof resolveTask === 'function' ? resolveTask : null;
        const task = resolver ? resolver(taskId) : null;
        let title = String(task?.content || task?.title || '').trim() || taskId;
        let durationMin = parseTaskDurationMinutes(task?.duration);
        let calendarId = '';
        try {
            const meta = (typeof window.tmCalendarGetTaskDragMeta === 'function')
                ? window.tmCalendarGetTaskDragMeta(taskId)
                : null;
            if (meta && typeof meta === 'object') {
                const metaTitle = String(meta.title || '').trim();
                const metaCalendarId = String(meta.calendarId || '').trim();
                const metaDuration = Number(meta.durationMin);
                if (metaTitle) title = metaTitle;
                if (metaCalendarId) calendarId = metaCalendarId;
                if (Number.isFinite(metaDuration) && metaDuration > 0) {
                    durationMin = Math.max(15, Math.round(metaDuration));
                }
            }
        } catch (e) {}
        return { taskId, title, durationMin, calendarId };
    }

    function applyTaskDoneVisual(wrapEl, titleEl, done) {
        const v = !!done;
        try { wrapEl?.classList?.toggle?.('tm-cal-task-event--done', v); } catch (e) {}
        if (titleEl instanceof HTMLElement) {
            try {
                if (v) {
                    titleEl.style.textDecoration = 'line-through';
                    titleEl.style.opacity = '0.9';
                    titleEl.style.color = 'var(--tm-secondary-text, #8a8a8a)';
                } else {
                    titleEl.style.removeProperty('text-decoration');
                    titleEl.style.removeProperty('opacity');
                    titleEl.style.removeProperty('color');
                }
            } catch (e) {}
        }
    }

    function applyTaskEventTitleClamp(wrapEl, titleEl) {
        try {
            const stacked = !!titleEl?.classList?.contains?.('tm-cal-task-event-title--stack');
            const scheduleTask = !!wrapEl?.classList?.contains?.('tm-cal-task-event--schedule');
            if (wrapEl instanceof HTMLElement) {
                if (scheduleTask && stacked) {
                    wrapEl.style.display = 'grid';
                    wrapEl.style.gridTemplateColumns = '12px minmax(0, 1fr)';
                    wrapEl.style.columnGap = '6px';
                    wrapEl.style.rowGap = '0';
                    wrapEl.style.alignItems = 'start';
                } else {
                    wrapEl.style.display = 'flex';
                    wrapEl.style.removeProperty('grid-template-columns');
                    wrapEl.style.removeProperty('column-gap');
                    wrapEl.style.removeProperty('row-gap');
                    wrapEl.style.alignItems = stacked ? 'stretch' : 'center';
                }
                wrapEl.style.width = '100%';
                wrapEl.style.maxWidth = '100%';
                wrapEl.style.minWidth = '0';
                wrapEl.style.overflow = 'hidden';
                wrapEl.style.flex = '1 1 0';
            }
            if (titleEl instanceof HTMLElement) {
                titleEl.style.display = stacked ? 'flex' : 'block';
                if (stacked) {
                    titleEl.style.flexDirection = 'column';
                    titleEl.style.alignItems = 'flex-start';
                    titleEl.style.justifyContent = 'flex-start';
                    titleEl.style.gap = '1px';
                    titleEl.style.whiteSpace = 'normal';
                    titleEl.style.textOverflow = 'clip';
                } else {
                    titleEl.style.removeProperty('flex-direction');
                    titleEl.style.removeProperty('align-items');
                    titleEl.style.removeProperty('justify-content');
                    titleEl.style.removeProperty('gap');
                    titleEl.style.whiteSpace = 'nowrap';
                    titleEl.style.textOverflow = 'ellipsis';
                }
                titleEl.style.flex = '1 1 0';
                titleEl.style.minWidth = '0';
                titleEl.style.maxWidth = '100%';
                titleEl.style.overflow = 'hidden';
            }
        } catch (e) {}
    }

    function applyCalendarEventClampFromRoot(rootEl) {
        if (!(rootEl instanceof Element)) return;
        try {
            if (rootEl instanceof HTMLElement) {
                rootEl.style.maxWidth = '100%';
                rootEl.style.overflow = 'hidden';
            }
            const mainNodes = rootEl.querySelectorAll?.('.fc-event-main, .fc-event-main-frame, .fc-event-title-container');
            if (mainNodes && mainNodes.length) {
                mainNodes.forEach((n) => {
                    if (!(n instanceof HTMLElement)) return;
                    n.style.minWidth = '0';
                    n.style.maxWidth = '100%';
                    n.style.overflow = 'hidden';
                });
            }
            const wraps = rootEl.querySelectorAll?.('.tm-cal-task-event, .tm-cal-schedule-stack');
            if (wraps && wraps.length) {
                wraps.forEach((w) => applyTaskEventTitleClamp(w, w.querySelector?.('.tm-cal-task-event-title') || null));
            }
            const titleNodes = rootEl.querySelectorAll?.('.tm-cal-task-event-title, .fc-event-title');
            if (titleNodes && titleNodes.length) {
                titleNodes.forEach((t) => {
                    if (!(t instanceof HTMLElement)) return;
                    const stacked = t.classList.contains('tm-cal-task-event-title--stack');
                    t.style.display = stacked ? 'flex' : 'block';
                    if (stacked) {
                        t.style.flexDirection = 'column';
                        t.style.alignItems = 'flex-start';
                        t.style.justifyContent = 'flex-start';
                        t.style.gap = '1px';
                        t.style.whiteSpace = 'normal';
                        t.style.textOverflow = 'clip';
                    } else {
                        t.style.removeProperty('flex-direction');
                        t.style.removeProperty('align-items');
                        t.style.removeProperty('justify-content');
                        t.style.removeProperty('gap');
                        t.style.whiteSpace = 'nowrap';
                        t.style.textOverflow = 'ellipsis';
                    }
                    t.style.minWidth = '0';
                    t.style.maxWidth = '100%';
                    t.style.overflow = 'hidden';
                });
            }
            const textNodes = rootEl.querySelectorAll?.('.tm-cal-task-event-title-text, .tm-cal-task-event-time');
            if (textNodes && textNodes.length) {
                textNodes.forEach((t) => {
                    if (!(t instanceof HTMLElement)) return;
                    t.style.display = 'block';
                    t.style.minWidth = '0';
                    t.style.maxWidth = '100%';
                    t.style.overflow = 'hidden';
                    t.style.textOverflow = 'ellipsis';
                    t.style.whiteSpace = 'nowrap';
                });
            }
        } catch (e) {}
    }

    function clampSideDayPopover(rootEl) {
        if (!(rootEl instanceof HTMLElement)) return;
        const popovers = rootEl.querySelectorAll('.fc-popover');
        if (!popovers || !popovers.length) return;
        const rootRect = rootEl.getBoundingClientRect();
        const safePad = 4;
        const maxW = Math.max(160, Math.floor(rootRect.width - safePad * 2));
        popovers.forEach((pop) => {
            if (!(pop instanceof HTMLElement)) return;
            try {
                pop.style.left = `${safePad}px`;
                pop.style.right = 'auto';
                pop.style.maxWidth = `${maxW}px`;
                pop.style.width = `${maxW}px`;
                pop.style.minWidth = '0px';
                pop.style.boxSizing = 'border-box';
                const body = pop.querySelector('.fc-popover-body');
                if (body instanceof HTMLElement) {
                    body.style.maxWidth = '100%';
                    body.style.overflowX = 'hidden';
                }
                applyCalendarEventClampFromRoot(pop);
            } catch (e) {}
        });
    }

    function scheduleClampSideDayPopover(rootEl) {
        requestAnimationFrame(() => requestAnimationFrame(() => clampSideDayPopover(rootEl)));
    }

    function unmountSideDayTimeline() {
        if (state.sideDay.popoverClickCapture && state.sideDay.rootEl) {
            try { state.sideDay.rootEl.removeEventListener('click', state.sideDay.popoverClickCapture, true); } catch (e) {}
            state.sideDay.popoverClickCapture = null;
        }
        if (state.sideDay.popoverObserver) {
            try { state.sideDay.popoverObserver.disconnect(); } catch (e) {}
            state.sideDay.popoverObserver = null;
        }
        // 清理页面可见性变化监听器
        if (state.sideDay.onVisibilityChange) {
            try { document.removeEventListener('visibilitychange', state.sideDay.onVisibilityChange); } catch (e) {}
            state.sideDay.onVisibilityChange = null;
        }
        // 清理 ResizeObserver
        if (state.sideDay.resizeObserver) {
            try { state.sideDay.resizeObserver.disconnect(); } catch (e) {}
            state.sideDay.resizeObserver = null;
        }
        try { state.sideDay.draggable?.destroy?.(); } catch (e) {}
        state.sideDay.draggable = null;
        state.sideDay.dragHost = null;
        try { state.sideDay.nativeDropAbort?.abort?.(); } catch (e) {}
        state.sideDay.nativeDropAbort = null;
        if (state.sideDay.previewEl instanceof HTMLElement) {
            try { state.sideDay.previewEl.remove(); } catch (e) {}
            state.sideDay.previewEl = null;
        }
        try { state.sideDay.calendar?.destroy?.(); } catch (e) {}
        state.sideDay.calendar = null;
        state.sideDay.rootEl = null;
        state.sideDay.resolveTask = null;
    }

    function bindSideDayNativeDrop(rootEl, resolveTask) {
        try { state.sideDay.nativeDropAbort?.abort?.(); } catch (e) {}
        state.sideDay.nativeDropAbort = null;
        if (!(rootEl instanceof HTMLElement)) return;
        const abort = new AbortController();
        state.sideDay.nativeDropAbort = abort;
        let previewKey = '';
        let liveDrag = null;
        let scrollRefreshFrame = null;
        let livePreviewTimer = null;
        const ensureGhostPreview = () => {
            const layer = rootEl.querySelector('.fc-timegrid-col-events');
            if (!(layer instanceof HTMLElement)) return null;
            if (!(state.sideDay.previewEl instanceof HTMLElement) || !state.sideDay.previewEl.isConnected) {
                const harness = document.createElement('div');
                harness.className = 'tm-cal-side-drag-ghost fc-timegrid-event-harness';
                harness.style.display = 'none';
                harness.innerHTML = `
                    <div class="fc-timegrid-event fc-v-event fc-event fc-event-start fc-event-end tm-cal-drag-preview tm-cal-selection-mirror tm-cal-schedule-event">
                        <div class="fc-event-main">
                            <span class="tm-cal-task-event">
                                <span class="tm-cal-task-event-title">
                                    <span class="tm-cal-task-event-title-text"></span>
                                </span>
                            </span>
                        </div>
                    </div>
                `;
                layer.appendChild(harness);
                state.sideDay.previewEl = harness;
            } else if (state.sideDay.previewEl.parentElement !== layer) {
                try { layer.appendChild(state.sideDay.previewEl); } catch (e) {}
            }
            return state.sideDay.previewEl;
        };
        const clearDropPreview = () => {
            previewKey = '';
            liveDrag = null;
            if (scrollRefreshFrame != null) {
                try { cancelAnimationFrame(scrollRefreshFrame); } catch (e) {}
                scrollRefreshFrame = null;
            }
            if (livePreviewTimer != null) {
                try { clearInterval(livePreviewTimer); } catch (e) {}
                livePreviewTimer = null;
            }
            if (state.sideDay.previewEl instanceof HTMLElement) {
                try { state.sideDay.previewEl.style.display = 'none'; } catch (e) {}
            }
        };
        try { abort.signal.addEventListener('abort', clearDropPreview, { once: true }); } catch (e) {}
        const rememberLiveDrag = (payload, x, y) => {
            if (!payload?.taskId) {
                liveDrag = null;
                return;
            }
            const xp = Number(x);
            const yp = Number(y);
            if (!Number.isFinite(xp) || !Number.isFinite(yp)) {
                liveDrag = null;
                return;
            }
            liveDrag = { payload, x: xp, y: yp };
            if (livePreviewTimer == null) {
                livePreviewTimer = setInterval(() => {
                    refreshPreviewFromLiveDrag();
                }, 80);
            }
        };
        const renderDropPreview = (payload, hit) => {
            const start = hit?.start;
            if (!payload?.taskId || !(start instanceof Date) || Number.isNaN(start.getTime())) {
                clearDropPreview();
                return;
            }
            const allDay = hit?.allDay === true;
            const safeMin = (Number.isFinite(Number(payload.durationMin)) && Number(payload.durationMin) > 0)
                ? Math.round(Number(payload.durationMin))
                : 60;
            const end = allDay
                ? new Date(start.getTime() + 24 * 60 * 60000)
                : new Date(start.getTime() + safeMin * 60000);
            const title = String(payload.title || '').trim() || '任务';
            const settings = getSettings();
            const calId = String(payload.calendarId || '').trim() || pickDefaultCalendarId(settings);
            const defs = getCalendarDefs(settings);
            const color = String(defs.find((d) => String(d?.id || '').trim() === calId)?.color || '#1a73e8').trim() || '#1a73e8';
            const nextKey = `${start.getTime()}|${end.getTime()}|${allDay ? 1 : 0}|${title}|${color}`;
            if (nextKey === previewKey) return;
            previewKey = nextKey;
            const ghost = ensureGhostPreview();
            if (!(ghost instanceof HTMLElement)) return;
            const layer = ghost.parentElement;
            const slotsWrap = rootEl.querySelector('.fc-timegrid-slots');
            const scroller = rootEl.querySelector('.fc-timegrid-body .fc-scroller, .fc-timegrid-body .fc-scroller-liquid-absolute, .fc-scroller');
            const allDayWrap = rootEl.querySelector('.fc-timegrid-all-day, .fc-timegrid-allday');
            const titleEl = ghost.querySelector('.tm-cal-task-event-title-text');
            const eventEl = ghost.querySelector('.fc-event');
            if (!(layer instanceof HTMLElement) || !(slotsWrap instanceof HTMLElement) || !(titleEl instanceof HTMLElement) || !(eventEl instanceof HTMLElement)) {
                clearDropPreview();
                return;
            }
            const layerRect = layer.getBoundingClientRect();
            const slotsRect = slotsWrap.getBoundingClientRect();
            const scrollTop = (scroller instanceof HTMLElement) ? scroller.scrollTop : 0;
            const visibleRange = getCalendarVisibleSlotRange(settings);
            const startMinutesBase = (() => {
                const m = String(visibleRange.start || '00:00').match(/^(\d{2}):(\d{2})$/);
                return m ? (Number(m[1]) * 60 + Number(m[2])) : 0;
            })();
            const eventStartMinutes = start.getHours() * 60 + start.getMinutes();
            const previewDurationMin = Math.max(30, Math.round((end.getTime() - start.getTime()) / 60000));
            const slotHeight = getTimeGridSlotHeight(rootEl);
            const top = allDay
                ? 0
                : Math.max(0, (slotsRect.top - layerRect.top) - scrollTop + ((eventStartMinutes - startMinutesBase) / 30) * slotHeight);
            const height = allDay
                ? Math.max(22, ((allDayWrap instanceof HTMLElement) ? allDayWrap.getBoundingClientRect().height : 26) - 4)
                : Math.max(18, (previewDurationMin / 30) * slotHeight - 2);
            try { titleEl.textContent = title; } catch (e) {}
            try { ghost.style.display = 'block'; } catch (e) {}
            try { ghost.style.top = `${Math.round(top)}px`; } catch (e) {}
            try { ghost.style.height = `${Math.round(height)}px`; } catch (e) {}
            try { eventEl.classList.add('tm-cal-selection-mirror', 'tm-cal-schedule-event'); } catch (e) {}
            try { eventEl.classList.toggle('tm-cal-allday-soft-event', !!allDay); } catch (e) {}
            if (allDay) applyAllDaySoftEventColorVars(eventEl, color);
            else applyScheduleEventColorVars(eventEl, color);
        };
        const getDropInfo = (target, x, y) => {
            const pickCurrentSideDay = () => {
                try {
                    const d = state.sideDay?.calendar?.getDate?.();
                    if (d instanceof Date && !Number.isNaN(d.getTime())) {
                        const c = new Date(d.getTime());
                        c.setHours(0, 0, 0, 0);
                        return c;
                    }
                } catch (e) {}
                return null;
            };
            const getVisibleStartMinutes = () => {
                const range = getCalendarVisibleSlotRange(getSettings());
                const raw = String(range?.start || '00:00').trim();
                const m = raw.match(/^(\d{2}):(\d{2})$/);
                if (!m) return 0;
                return Number(m[1]) * 60 + Number(m[2]);
            };
            const findColByX = (xPos) => {
                const xp = Number(xPos);
                if (!Number.isFinite(xp)) return null;
                const cols = Array.from(rootEl.querySelectorAll('.fc-timegrid-col[data-date]'));
                for (const colEl of cols) {
                    try {
                        const r = colEl.getBoundingClientRect();
                        if (xp >= r.left && xp < r.right) return colEl;
                    } catch (e) {}
                }
                return cols[0] || null;
            };
            const resolveTimedByGeometry = (xPos, yPos) => {
                const xp = Number(xPos);
                const yp = Number(yPos);
                if (!Number.isFinite(xp) || !Number.isFinite(yp)) return null;
                const col = findColByX(xp);
                const dateStr = String(col?.getAttribute?.('data-date') || '').trim();
                if (!dateStr) return null;
                const slotsWrap = rootEl.querySelector('.fc-timegrid-slots');
                const slotsTable = slotsWrap?.querySelector?.('table');
                const scroller = rootEl.querySelector('.fc-timegrid-body .fc-scroller, .fc-timegrid-body .fc-scroller-liquid-absolute, .fc-scroller');
                if (!(slotsWrap instanceof HTMLElement) || !(slotsTable instanceof HTMLElement)) return null;
                const wrapRect = slotsWrap.getBoundingClientRect();
                const tableRect = slotsTable.getBoundingClientRect();
                const allDayWrap = rootEl.querySelector('.fc-timegrid-all-day, .fc-timegrid-allday');
                if (allDayWrap instanceof HTMLElement) {
                    try {
                        const adRect = allDayWrap.getBoundingClientRect();
                        if (yp >= adRect.top && yp < adRect.bottom) {
                            const dt0 = new Date(`${dateStr}T00:00:00`);
                            if (!Number.isNaN(dt0.getTime())) return { start: dt0, allDay: true };
                        }
                    } catch (e) {}
                }
                if (yp < wrapRect.top || yp > wrapRect.bottom) return null;
                const scrollTop = (scroller instanceof HTMLElement) ? scroller.scrollTop : 0;
                const offsetY = (yp - wrapRect.top) + scrollTop;
                const slotHeight = getTimeGridSlotHeight(rootEl);
                const slotIndex = Math.max(0, Math.floor(offsetY / slotHeight));
                const startMinutes = getVisibleStartMinutes() + slotIndex * 30;
                const hh = Math.floor(startMinutes / 60);
                const mm = startMinutes % 60;
                const dt = new Date(`${dateStr}T${pad2(hh)}:${pad2(mm)}:00`);
                if (!Number.isNaN(dt.getTime())) return { start: dt, allDay: false };
                return null;
            };
            const resolveFrom = (el) => {
                if (!(el instanceof Element)) return null;
                const allDayWrap = el.closest?.('.fc-timegrid-all-day, .fc-timegrid-allday');
                const day = el.closest?.('.fc-daygrid-day');
                if (allDayWrap) {
                    const dateStr0 = String(el.closest?.('[data-date]')?.getAttribute?.('data-date') || '').trim();
                    if (dateStr0) {
                        const dt0 = new Date(`${dateStr0}T00:00:00`);
                        if (!Number.isNaN(dt0.getTime())) return { start: dt0, allDay: true };
                    }
                    const cur = pickCurrentSideDay();
                    if (cur) return { start: cur, allDay: true };
                }
                const timed = resolveTimedByGeometry(x, y);
                if (timed) return timed;
                const dayEl = day || el.closest?.('[data-date]');
                const dateStr = String(dayEl?.getAttribute?.('data-date') || '').trim();
                if (dateStr) {
                    const dt = new Date(`${dateStr}T00:00:00`);
                    if (!Number.isNaN(dt.getTime())) return { start: dt, allDay: true };
                }
                return null;
            };
            const layered = (() => {
                try {
                    if (typeof document.elementsFromPoint === 'function') {
                        return document.elementsFromPoint(Number(x) || 0, Number(y) || 0);
                    }
                } catch (e) {}
                return [];
            })();
            let hit = resolveFrom((target instanceof Element) ? target : null);
            if (!hit) {
                for (const el of layered) {
                    hit = resolveFrom(el);
                    if (hit) break;
                }
            }
            if (!hit) hit = resolveTimedByGeometry(x, y) || resolveFrom(document.elementFromPoint(x, y));
            if (hit) return hit;
            const cur = pickCurrentSideDay();
            if (cur) return { start: cur, allDay: true };
            return null;
        };
        const refreshPreviewFromLiveDrag = () => {
            const xp = Number(liveDrag?.x);
            const yp = Number(liveDrag?.y);
            if (!liveDrag?.payload?.taskId || !Number.isFinite(xp) || !Number.isFinite(yp)) return;
            try {
                const r = rootEl.getBoundingClientRect();
                const inside = xp >= r.left && xp <= r.right && yp >= r.top && yp <= r.bottom;
                if (!inside) {
                    clearDropPreview();
                    return;
                }
            } catch (e) {}
            const hit = getDropInfo(document.elementFromPoint(xp, yp), xp, yp);
            renderDropPreview(liveDrag.payload, hit);
        };
        const schedulePreviewRefresh = () => {
            if (scrollRefreshFrame != null) return;
            scrollRefreshFrame = requestAnimationFrame(() => {
                scrollRefreshFrame = null;
                refreshPreviewFromLiveDrag();
            });
        };

        rootEl.addEventListener('dragover', (e) => {
            // 检查是否为白板连线操作，如果是则不阻止默认行为
            const types = Array.from(e.dataTransfer?.types || []);
            const isWhiteboardLink = types.includes('application/x-tm-task-link');
            if (isWhiteboardLink) return;

            const ok = e.dataTransfer && (
                types.includes('application/x-tm-task')
                || types.includes('application/x-tm-task-id')
                || types.includes('text/plain')
            );
            if (!ok) {
                const payload = buildDraggingTaskPayload(resolveTask);
                if (!payload?.taskId) {
                    clearDropPreview();
                    return;
                }
                e.preventDefault();
                rememberLiveDrag(payload, e.clientX, e.clientY);
                const hit = getDropInfo(e.target, e.clientX, e.clientY);
                renderDropPreview(payload, hit);
                return;
            }
            e.preventDefault();
            const payload = parseTaskDropPayload(e, null, resolveTask) || buildDraggingTaskPayload(resolveTask);
            rememberLiveDrag(payload, e.clientX, e.clientY);
            const hit = getDropInfo(e.target, e.clientX, e.clientY);
            renderDropPreview(payload, hit);
        }, { signal: abort.signal });
        document.addEventListener('dragover', (e) => {
            const types = Array.from(e.dataTransfer?.types || []);
            const isWhiteboardLink = types.includes('application/x-tm-task-link');
            if (isWhiteboardLink) return;
            const x = Number(e.clientX);
            const y = Number(e.clientY);
            const ok = e.dataTransfer && (
                types.includes('application/x-tm-task')
                || types.includes('application/x-tm-task-id')
                || types.includes('text/plain')
            );
            if (!ok) {
                const payload = buildDraggingTaskPayload(resolveTask);
                if (!payload?.taskId) {
                    clearDropPreview();
                    return;
                }
                e.preventDefault();
                rememberLiveDrag(payload, x, y);
                const hit = getDropInfo(document.elementFromPoint(x, y), x, y);
                renderDropPreview(payload, hit);
                return;
            }
            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                clearDropPreview();
                return;
            }
            const r = rootEl.getBoundingClientRect();
            const inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
            if (!inside) {
                clearDropPreview();
                return;
            }
            e.preventDefault();
            const payload = parseTaskDropPayload(e, null, resolveTask) || buildDraggingTaskPayload(resolveTask);
            rememberLiveDrag(payload, x, y);
            const hit = getDropInfo(document.elementFromPoint(x, y), x, y);
            renderDropPreview(payload, hit);
        }, { signal: abort.signal, capture: true });
        document.addEventListener('drag', (e) => {
            const payload = buildDraggingTaskPayload(resolveTask);
            if (!payload?.taskId) {
                clearDropPreview();
                return;
            }
            const x = Number(e.clientX);
            const y = Number(e.clientY);
            if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) return;
            try {
                const r = rootEl.getBoundingClientRect();
                const inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
                if (!inside) {
                    clearDropPreview();
                    return;
                }
            } catch (e2) {}
            rememberLiveDrag(payload, x, y);
            const hit = getDropInfo(document.elementFromPoint(x, y), x, y);
            renderDropPreview(payload, hit);
        }, { signal: abort.signal, capture: true });
        rootEl.addEventListener('scroll', schedulePreviewRefresh, { signal: abort.signal, capture: true });
        Array.from(rootEl.querySelectorAll('.fc-scroller')).forEach((scroller) => {
            try { scroller.addEventListener('scroll', schedulePreviewRefresh, { signal: abort.signal, passive: true }); } catch (e) {}
        });
        rootEl.addEventListener('dragleave', (e) => {
            try {
                const r = rootEl.getBoundingClientRect();
                const x = Number(e.clientX);
                const y = Number(e.clientY);
                const out = !Number.isFinite(x) || !Number.isFinite(y) || x < r.left || x > r.right || y < r.top || y > r.bottom;
                if (out) clearDropPreview();
            } catch (e2) {}
        }, { signal: abort.signal });
        window.addEventListener('dragend', clearDropPreview, { signal: abort.signal });
        document.addEventListener('drop', clearDropPreview, { signal: abort.signal, capture: true });

        rootEl.addEventListener('drop', async (e) => {
            try {
                const payload = parseTaskDropPayload(e, null, resolveTask) || buildDraggingTaskPayload(resolveTask);
                if (!payload?.taskId) return;
                e.preventDefault();
                clearDropPreview();
                const hit = getDropInfo(e.target, e.clientX, e.clientY);
                if (!hit?.start) return;
                const start = hit.start;
                const allDay = hit.allDay === true;
                const safeMin = (Number.isFinite(Number(payload.durationMin)) && Number(payload.durationMin) > 0)
                    ? Math.round(Number(payload.durationMin))
                    : 60;
                const end = allDay
                    ? new Date(start.getTime() + 24 * 60 * 60000)
                    : new Date(start.getTime() + safeMin * 60000);
                const calendarId = String(payload.calendarId || '').trim() || pickDefaultCalendarId(getSettings());
                await addTaskSchedule({
                    taskId: String(payload.taskId || '').trim(),
                    title: String(payload.title || '').trim() || '任务',
                    start,
                    end,
                    calendarId,
                    durationMin: safeMin,
                    allDay,
                });
                toast('✅ 已加入日程', 'success');
            } catch (e2) {}
            finally {
                clearDropPreview();
            }
        }, { signal: abort.signal });
    }

    function bindSideDayExternalDraggable(host, settings, resolveTask) {
        const Draggable = globalThis.FullCalendar?.Draggable;
        try { state.sideDay.draggable?.destroy?.(); } catch (e) {}
        state.sideDay.draggable = null;
        state.sideDay.dragHost = null;
        if (!(host instanceof HTMLElement)) return;
        if (typeof Draggable !== 'function') return;
        const itemSelector = 'tr[data-id], .tm-kanban-card[data-id]';
        const resolver = typeof resolveTask === 'function' ? resolveTask : null;
        try {
            state.sideDay.draggable = new Draggable(host, {
                itemSelector,
                eventData: (el) => {
                    const id = String(
                        el?.getAttribute?.('data-id')
                        || el?.getAttribute?.('data-task-id')
                        || ''
                    ).trim();
                    const task = resolver ? resolver(id) : null;
                    let title = String(task?.content || task?.title || '').trim() || id || '任务';
                    let safeMin = parseTaskDurationMinutes(task?.duration);
                    let calendarId = String(el?.getAttribute?.('data-calendar-id') || '').trim();
                    try {
                        const meta = (typeof window.tmCalendarGetTaskDragMeta === 'function')
                            ? window.tmCalendarGetTaskDragMeta(id)
                            : null;
                        if (meta && typeof meta === 'object') {
                            title = String(meta.title || title).trim() || title;
                            const m = Number(meta.durationMin);
                            if (Number.isFinite(m) && m > 0) safeMin = Math.max(15, Math.round(m));
                            if (!calendarId) calendarId = String(meta.calendarId || '').trim();
                        }
                    } catch (e) {}
                    if (!calendarId) calendarId = pickDefaultCalendarId(settings || getSettings());
                    return {
                        title,
                        duration: toDurationStr(safeMin),
                        extendedProps: {
                            __tmTaskId: id,
                            __tmDurationMin: safeMin,
                            calendarId,
                        },
                    };
                },
            });
            state.sideDay.dragHost = host;
        } catch (e) {
            state.sideDay.draggable = null;
            state.sideDay.dragHost = null;
        }
    }

    function mountSideDayTimeline(rootEl, opts) {
        if (!(rootEl instanceof HTMLElement)) return false;
        if (!window.FullCalendar) return false;
        if (state.sideDay.rootEl && state.sideDay.rootEl !== rootEl) {
            unmountSideDayTimeline();
        }
        try { ensureFcCompactAllDayStyle(); } catch (e) {}
        const inOpts = (opts && typeof opts === 'object') ? opts : {};
        state.sideDay.settingsStore = inOpts.settingsStore || state.settingsStore || null;
        if (!state.settingsStore && state.sideDay.settingsStore) {
            state.settingsStore = state.sideDay.settingsStore;
        }
        state.sideDay.resolveTask = (typeof inOpts.resolveTask === 'function') ? inOpts.resolveTask : null;
        const enableExternalDrag = inOpts.enableExternalDrag !== false;
        const dragHost = (inOpts.dragHost instanceof HTMLElement) ? inOpts.dragHost : null;
        if (enableExternalDrag) {
            try { state.sideDay.nativeDropAbort?.abort?.(); } catch (e) {}
            state.sideDay.nativeDropAbort = null;
            if (dragHost && dragHost !== state.sideDay.dragHost) {
                bindSideDayExternalDraggable(dragHost, getSettings(), state.sideDay.resolveTask);
            }
        } else {
            bindSideDayNativeDrop(rootEl, state.sideDay.resolveTask);
            try { state.sideDay.draggable?.destroy?.(); } catch (e) {}
            state.sideDay.draggable = null;
            state.sideDay.dragHost = null;
        }
        if (state.sideDay.calendar) {
            state.sideDay.rootEl = rootEl;
            try { state.sideDay.calendar.setOption('dayHeaders', false); } catch (e) {}
            if (String(inOpts.date || '').trim()) {
                try { state.sideDay.calendar.gotoDate(String(inOpts.date || '').trim()); } catch (e) {}
            }
            return true;
        }

        state.sideDay.rootEl = rootEl;
        const settings = getSettings();
        const slotLayout = getTimeGridSlotLayoutOptions(settings);
        const initialDate = String(inOpts.date || '').trim() || undefined;
        const cal = new window.FullCalendar.Calendar(rootEl, {
            locale: 'zh-cn',
            timeZone: 'local',
            initialView: 'timeGridDay',
            initialDate,
            height: 'auto',
            contentHeight: getSideDayContentHeight(settings),
            expandRows: false,
            firstDay: Number(settings.firstDay) === 0 ? 0 : 1,
            headerToolbar: false,
            dayHeaders: false,
            nowIndicator: true,
            editable: true,
            eventStartEditable: true,
            eventDurationEditable: true,
            eventResizableFromStart: true,
            selectable: true,
            selectMirror: true,
            scrollTimeReset: false,
            droppable: true,
            dropAccept: 'tr[data-id], .tm-cal-task, .tm-kanban-card[data-id]',
            allDaySlot: true,
            slotEventOverlap: false,
            dayMaxEvents: true,
            moreLinkClick: 'popover',
            handleWindowResize: true,
            ...slotLayout,
            eventOrder: '__tmRank,title',
            eventOrderStrict: true,
            eventClassNames: (arg) => {
                if (arg?.isMirror) return ['tm-cal-selection-mirror', 'tm-cal-schedule-event'];
                return [];
            },
            eventContent: (arg) => {
                const ext = arg?.event?.extendedProps || {};
                const source = String(ext.__tmSource || '').trim();
                const hideRangeText = String(arg?.view?.type || '').trim() === 'dayGridMonth';
                if (source === 'taskdate' || (source === 'schedule' && String(ext.__tmTaskId || '').trim())) {
                    const tid = String(ext.__tmTaskId || '').trim();
                    const done = (() => {
                        if (!tid) return false;
                        if (typeof window.tmIsTaskDone !== 'function') return false;
                        try { return !!window.tmIsTaskDone(tid); } catch (e) { return false; }
                    })();
                    const wrapEl = document.createElement('span');
                    wrapEl.className = source === 'schedule' ? 'tm-cal-task-event tm-cal-task-event--schedule' : 'tm-cal-task-event';
                    wrapEl.oncontextmenu = (ev) => {
                        try { ev.stopPropagation(); } catch (e) {}
                        try { ev.preventDefault(); } catch (e) {}
                        if (tid && typeof window.tmShowTaskContextMenu === 'function') {
                            const sid0 = String(ext.__tmScheduleId || '').trim();
                            try {
                                if (source === 'schedule' && sid0) window.tmShowTaskContextMenu(ev, tid, { scheduleId: sid0, title: String(arg?.event?.title || '').trim(), start: arg?.event?.start, end: arg?.event?.end });
                                else if (source === 'taskdate') window.tmShowTaskContextMenu(ev, tid, { taskDateStartKey: String(ext.__tmTaskDateStartKey || '').trim(), taskDateEndExclusiveKey: String(ext.__tmTaskDateEndExclusiveKey || '').trim(), calendarId: String(ext.calendarId || 'default').trim(), title: String(arg?.event?.title || '').trim() });
                                else window.tmShowTaskContextMenu(ev, tid);
                            } catch (e2) {}
                        }
                        return false;
                    };
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.className = 'tm-cal-task-event-check';
                    cb.checked = done;
                    applyTaskEventCheckboxOffset(cb);
                    cb.onchange = async (ev) => {
                        try { ev.stopPropagation(); } catch (e) {}
                        try { ev.preventDefault(); } catch (e) {}
                        if (!tid || typeof window.tmSetDone !== 'function') return;
                        const nextDone = cb.checked === true;
                        applyTaskDoneVisual(wrapEl, titleText, nextDone);
                        try {
                            const r = window.tmSetDone(tid, nextDone, ev);
                            if (r && typeof r.then === 'function') await r;
                        } catch (e) {}
                        refetchAllCalendars();
                    };
                    const rangeText = !hideRangeText && source === 'schedule'
                        ? formatScheduleEventRangeText(arg?.event?.start, arg?.event?.end, arg?.event?.allDay === true)
                        : '';
                    const { title, titleText } = buildTaskEventTitleNode(String(arg?.event?.title || '').trim() || '任务', rangeText);
                    applyTaskEventTitleClamp(wrapEl, title);
                    applyTaskDoneVisual(wrapEl, titleText, done);
                    titleText.onclick = (ev) => {
                        try { ev.stopPropagation(); } catch (e) {}
                        if (!tid || typeof window.tmJumpToTask !== 'function') return;
                        try { window.tmJumpToTask(tid, ev); } catch (e) {}
                    };
                    wrapEl.appendChild(cb);
                    wrapEl.appendChild(title);
                    return { domNodes: [wrapEl] };
                }
                if (source === 'schedule') {
                    const wrapEl = document.createElement('span');
                    wrapEl.className = 'tm-cal-schedule-stack';
                    const { title } = buildTaskEventTitleNode(
                        String(arg?.event?.title || '').trim() || '日程',
                        hideRangeText ? '' : formatScheduleEventRangeText(arg?.event?.start, arg?.event?.end, arg?.event?.allDay === true)
                    );
                    applyTaskEventTitleClamp(wrapEl, title);
                    wrapEl.appendChild(title);
                    return { domNodes: [wrapEl] };
                }
                if (source === 'reminder') {
                    const wrapEl = document.createElement('span');
                    wrapEl.className = source === 'schedule' ? 'tm-cal-task-event tm-cal-task-event--schedule' : 'tm-cal-task-event';
                    const tid = String(ext.__tmReminderBlockId || '').trim();
                    const { title, titleText } = buildTaskEventTitleNode(String(arg?.event?.title || '').trim() || '任务提醒');
                    applyTaskEventTitleClamp(wrapEl, title);
                    applyTaskDoneVisual(wrapEl, titleText, !!ext.__tmReminderDone);
                    titleText.onclick = (ev) => {
                        try { ev.stopPropagation(); } catch (e) {}
                        if (!tid || typeof window.tmJumpToTask !== 'function') return;
                        try { window.tmJumpToTask(tid, ev); } catch (e) {}
                    };
                    wrapEl.appendChild(title);
                    return { domNodes: [wrapEl] };
                }
                if (source === 'cnHoliday') {
                    const type = Number(ext.__tmCnHolidayType);
                    const name = normalizeCnHolidayName(String(ext.__tmCnHolidayName || '').trim());
                    if (!name) return true;
                    if (type === 0) return true;
                    if (type !== 2 && type !== 3 && type !== 4) return true;
                    const isWork = type === 4;
                    const pill = document.createElement('span');
                    pill.className = `tm-cn-holiday-pill ${isWork ? 'tm-cn-holiday-pill--work' : 'tm-cn-holiday-pill--rest'}`;
                    const badge = document.createElement('span');
                    badge.className = 'tm-cn-holiday-badge';
                    badge.textContent = isWork ? '班' : '休';
                    pill.appendChild(badge);
                    if (name) {
                        const label = document.createElement('span');
                        label.className = 'tm-cn-holiday-label';
                        label.textContent = name;
                        pill.appendChild(label);
                    }
                    pill.title = `${isWork ? '上班' : '休息'}${name ? `：${name}` : ''}`;
                    return { domNodes: [pill] };
                }
                return true;
            },
            eventDidMount: (arg) => {
                try {
                    const ext = arg?.event?.extendedProps || {};
                    const source = String(ext.__tmSource || '').trim();
                    const el = arg?.el;
                    if (el && el instanceof Element) {
                        applyCalendarEventClampFromRoot(el);
                        const eid = String(arg?.event?.id || '').trim();
                        if (eid) el.setAttribute('data-tm-cal-event-id', eid);
                        if (source) el.setAttribute('data-tm-cal-source', source);
                        if (source === 'schedule' || source === 'tomato' || arg?.isMirror) applyScheduleEventColorVars(el, String(arg?.event?.backgroundColor || arg?.event?.borderColor || '#0078d4'));
                        if ((source === 'schedule' || source === 'taskdate') && arg?.event?.allDay === true) applyAllDaySoftEventColorVars(el, String(arg?.event?.backgroundColor || arg?.event?.borderColor || '#0078d4'));
                        const tid = String(ext.__tmTaskId || '').trim();
                        if (tid) el.setAttribute('data-tm-cal-task-id', tid);
                        const rid = String(ext.__tmReminderBlockId || '').trim();
                        if (rid) el.setAttribute('data-tm-cal-reminder-id', rid);
                        const sid = String(ext.__tmScheduleId || '').trim();
                        if (sid) el.setAttribute('data-tm-cal-schedule-id', sid);
                    }
                    if (source === 'schedule') {
                        const sid = String(ext.__tmScheduleId || '').trim();
                        const tid = String(ext.__tmTaskId || '').trim();
                        if (sid && el && !el.__tmScheduleCtxBound) {
                            el.__tmScheduleCtxBound = true;
                            el.addEventListener('contextmenu', (ev) => {
                                try {
                                    try { ev.stopPropagation(); } catch (e2) {}
                                    try { ev.preventDefault(); } catch (e2) {}
                                    if (tid && typeof window.tmShowTaskContextMenu === 'function') {
                                        window.tmShowTaskContextMenu(ev, tid, {
                                            scheduleId: sid,
                                            title: String(arg?.event?.title || '').trim(),
                                            start: arg?.event?.start,
                                            end: arg?.event?.end,
                                        });
                                        return;
                                    }
                                    showScheduleEventContextMenu(ev, {
                                        scheduleId: sid,
                                        taskId: tid,
                                        title: String(arg?.event?.title || '').trim(),
                                        start: arg?.event?.start,
                                        end: arg?.event?.end,
                                    });
                                } catch (e) {}
                            });
                        }
                    }
                    if (source === 'taskdate') {
                        const tid = String(ext.__tmTaskId || '').trim();
                        if (tid && el && !el.__tmTaskCtxBound) {
                            el.__tmTaskCtxBound = true;
                            el.addEventListener('contextmenu', (ev) => {
                                try { ev.stopPropagation(); } catch (e) {}
                                try { ev.preventDefault(); } catch (e) {}
                                if (typeof window.tmShowTaskContextMenu === 'function') {
                                    const sid0 = String(ext.__tmScheduleId || '').trim();
                                    try {
                                        if (source === 'schedule' && sid0) window.tmShowTaskContextMenu(ev, tid, { scheduleId: sid0, title: String(arg?.event?.title || '').trim(), start: arg?.event?.start, end: arg?.event?.end });
                                        else if (source === 'taskdate') window.tmShowTaskContextMenu(ev, tid, { taskDateStartKey: String(ext.__tmTaskDateStartKey || '').trim(), taskDateEndExclusiveKey: String(ext.__tmTaskDateEndExclusiveKey || '').trim(), calendarId: String(ext.calendarId || 'default').trim(), title: String(arg?.event?.title || '').trim() });
                                        else window.tmShowTaskContextMenu(ev, tid);
                                    } catch (e) {}
                                }
                            });
                        }
                    }
                } catch (e) {}
            },
            drop: () => {},
            eventReceive: async (info) => {
                try {
                    const ext = info?.event?.extendedProps || {};
                    const payload = parseTaskDropPayload(info?.jsEvent, info?.draggedEl, state.sideDay.resolveTask);
                    const taskId = String(ext.__tmTaskId || payload?.taskId || '').trim();
                    const start = info?.event?.start;
                    let end = info?.event?.end;
                    const settings = getSettings();
                    const durMin = clampNewScheduleDurationMin(Number(ext.__tmDurationMin || payload?.durationMin), settings);
                    if (!taskId || !(start instanceof Date) || Number.isNaN(start.getTime())) {
                        try { info?.event?.remove?.(); } catch (e2) {}
                        return;
                    }
                    if (!(end instanceof Date) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
                        end = new Date(start.getTime() + durMin * 60000);
                    }
                    const title = String(payload?.title || info?.event?.title || '').trim() || '任务';
                    const calendarId = String(ext.calendarId || payload?.calendarId || '').trim() || pickDefaultCalendarId(settings);
                    const dropAllDayHint = (() => {
                        const t = info?.jsEvent?.target;
                        if (!(t instanceof Element)) return false;
                        return !!t.closest('.fc-timegrid-all-day, .fc-timegrid-allday, .fc-daygrid-day');
                    })();
                    const allDay = (info?.event?.allDay === true) || dropAllDayHint;
                    await addTaskSchedule({ taskId, title, start, end, calendarId, durationMin: durMin, allDay });
                    try { info?.event?.remove?.(); } catch (e2) {}
                    refetchAllCalendars();
                    toast('✅ 已加入日程', 'success');
                } catch (e) {
                    try { info?.event?.remove?.(); } catch (e2) {}
                    toast(`❌ 加入日程失败：${String(e?.message || e || '')}`, 'error');
                }
            },
            events: async (info, success, failure) => {
                try {
                    const curSettings = getSettings();
                    const years = (() => {
                        const y1 = info?.start instanceof Date ? info.start.getFullYear() : null;
                        const y2 = info?.end instanceof Date ? info.end.getFullYear() : null;
                        const set = new Set();
                        if (Number.isFinite(y1)) set.add(y1);
                        if (Number.isFinite(y2)) set.add(y2);
                        return Array.from(set.values()).filter((x) => Number.isFinite(Number(x)));
                    })();
                    const [schedules, taskDates, cnHolidayDays, reminders] = await Promise.all([
                        loadScheduleForRange(info.start || '', info.end || ''),
                        (curSettings.showTaskDates && typeof window.tmQueryCalendarTaskDateEvents === 'function')
                            ? Promise.resolve().then(() => window.tmQueryCalendarTaskDateEvents(info.start || '', info.end || '')).catch(() => [])
                            : Promise.resolve([]),
                        (curSettings.showCnHoliday || curSettings.showLunar)
                            ? Promise.all(years.map((y) => loadCnHolidayYear(y))).then((arr) => arr.flat())
                            : Promise.resolve([]),
                        curSettings.linkDockTomato ? loadReminderBlocks().catch(() => []) : Promise.resolve([]),
                    ]);
                    try {
                        const wantMap = !!(curSettings.showCnHoliday || curSettings.showLunar);
                        state.cnHolidayMap = wantMap ? buildCnHolidayMap(cnHolidayDays, info.start, info.end, !!curSettings.showLunar) : new Map();
                        applyCnHolidayDots(rootEl);
                        applyCnLunarLabels(rootEl);
                    } catch (e0) {}
                    const scheduleTaskTitleMap = await __tmBuildScheduleLinkedTaskTitleMap(schedules).catch(() => new Map());
                    const b = buildEventsFromSchedule(schedules, info.start, info.end, curSettings, scheduleTaskTitleMap);
                    const c = buildEventsFromTaskDates(taskDates, curSettings);
                    const d = curSettings.showCnHoliday ? buildCnHolidayEvents(cnHolidayDays, info.start, info.end, 'timeGridDay', curSettings) : [];
                    const e = buildEventsFromReminders(reminders, info.start, info.end, curSettings);
                    success((b || []).concat(c || [], d || [], e || []));
                } catch (e) {
                    failure(e);
                }
            },
            eventClick: (arg) => {
                const target = arg?.jsEvent?.target;
                try {
                    if (target instanceof Element) {
                        if (target.closest('.tm-cal-task-event-check')) return;
                    }
                } catch (e0) {}
                const ext = arg?.event?.extendedProps || {};
                const source = String(ext.__tmSource || '').trim();
                if (source === 'taskdate') {
                    const tid = String(ext.__tmTaskId || '').trim();
                    try {
                        if (tid && typeof window.tmJumpToTask === 'function') window.tmJumpToTask(tid, arg?.jsEvent);
                    } catch (e) {}
                    return;
                }
                if (source === 'reminder') {
                    const tid = String(ext.__tmReminderBlockId || '').trim();
                    try {
                        if (tid && typeof window.tmJumpToTask === 'function') window.tmJumpToTask(tid, arg?.jsEvent);
                    } catch (e) {}
                    return;
                }
                if (source === 'schedule') {
                    try {
                        const baseStart = String(ext.__tmScheduleBaseStart || '').trim();
                        const baseEnd = String(ext.__tmScheduleBaseEnd || '').trim();
                        openScheduleModal({
                            id: String(ext.__tmScheduleId || arg?.event?.id || ''),
                            title: String(arg?.event?.title || ''),
                            start: baseStart ? new Date(baseStart) : arg?.event?.start,
                            end: baseEnd ? new Date(baseEnd) : arg?.event?.end,
                            allDay: arg?.event?.allDay === true,
                            color: String(arg?.event?.backgroundColor || arg?.event?.borderColor || '#0078d4'),
                            calendarId: String(ext.calendarId || 'default'),
                            taskId: String(ext.__tmTaskId || ''),
                            reminderMode: String(ext.__tmReminderMode || ''),
                            reminderEnabled: ext.__tmReminderEnabled === true,
                            reminderOffsetMin: Number(ext.__tmReminderOffsetMin),
                            repeatType: String(ext.__tmRepeatType || ''),
                            repeatEvery: Number(ext.__tmRepeatEvery),
                            repeatUntil: String(ext.__tmRepeatUntil || ''),
                            repeatMonthlyMode: String(ext.__tmRepeatMonthlyMode || ''),
                            notificationSchedules: sanitizeScheduleNotificationSchedules(ext.__tmNotificationSchedules),
                        });
                    } catch (e2) {
                        toast(`❌ 打开编辑窗失败：${String(e2?.message || e2 || '')}`, 'error');
                    }
                }
            },
            eventDrop: async (arg) => {
                const ext = arg?.event?.extendedProps || {};
                const source = String(ext.__tmSource || '').trim();
                if (source === 'schedule') {
                    if (getScheduleRepeatType({ repeatType: ext.__tmRepeatType }) !== 'none') {
                        toast('⚠ 循环日程请在编辑窗口中修改', 'warning');
                        try { arg.revert(); } catch (e) {}
                        return;
                    }
                    const id = String(ext.__tmScheduleId || arg?.event?.id || '').trim();
                    const start = arg?.event?.start;
                    const end0 = arg?.event?.end;
                    if (!id || !(start instanceof Date) || Number.isNaN(start.getTime())) {
                        try { arg.revert(); } catch (e) {}
                        return;
                    }
                    const isAllDay = arg?.event?.allDay === true;
                    const end = (end0 instanceof Date && !Number.isNaN(end0.getTime()) && end0.getTime() > start.getTime())
                        ? end0
                        : new Date(start.getTime() + (isAllDay ? 24 * 60 : 60) * 60000);
                    const list = await loadScheduleAll();
                    const idx = list.findIndex((x) => String(x?.id || '') === id);
                    if (idx < 0) {
                        try { arg.revert(); } catch (e) {}
                        return;
                    }
                    const allDay = (arg?.event?.allDay === true) || isAllDayRange(start, end);
                    list[idx] = { ...list[idx], start: safeISO(start), end: safeISO(end), allDay };
                    await saveScheduleAll(list);
                    toast('✅ 已更新日程', 'success');
                    return;
                }
                if (source === 'taskdate') {
                    const taskId = String(ext.__tmTaskId || '').trim();
                    const start = arg?.event?.start;
                    const end0 = arg?.event?.end;
                    const calendarId = String(ext.calendarId || 'default').trim() || pickDefaultCalendarId(getSettings());
                    if (!taskId || !(start instanceof Date) || Number.isNaN(start.getTime())) {
                        try { arg.revert(); } catch (e) {}
                        return;
                    }
                    const isAllDay = arg?.event?.allDay === true;
                    const safeEnd = (end0 instanceof Date && !Number.isNaN(end0.getTime()) && end0.getTime() > start.getTime())
                        ? end0
                        : new Date(start.getTime() + (isAllDay ? 24 * 60 : 60) * 60000);
                    try {
                        const list = await loadScheduleAll();
                        list.push({
                            id: uuid(),
                            title: String(arg?.event?.title || '').trim() || '任务',
                            start: safeISO(start),
                            end: safeISO(safeEnd),
                            allDay: isAllDayRange(start, safeEnd),
                            color: '',
                            calendarId,
                            taskId,
                        });
                        await saveScheduleAll(list);
                        toast('✅ 已加入日程', 'success');
                    } catch (e) {}
                    try { arg.revert(); } catch (e) {}
                    refetchAllCalendars();
                    return;
                }
                try { arg.revert(); } catch (e) {}
            },
            eventResize: async (arg) => {
                const ext = arg?.event?.extendedProps || {};
                const source = String(ext.__tmSource || '').trim();
                if (source !== 'schedule') {
                    try { arg.revert(); } catch (e) {}
                    return;
                }
                if (getScheduleRepeatType({ repeatType: ext.__tmRepeatType }) !== 'none') {
                    toast('⚠ 循环日程请在编辑窗口中修改', 'warning');
                    try { arg.revert(); } catch (e) {}
                    return;
                }
                const id = String(ext.__tmScheduleId || arg?.event?.id || '').trim();
                const start = arg?.event?.start;
                const end = arg?.event?.end;
                if (!id || !(start instanceof Date) || !(end instanceof Date) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
                    try { arg.revert(); } catch (e) {}
                    return;
                }
                const list = await loadScheduleAll();
                const idx = list.findIndex((x) => String(x?.id || '') === id);
                if (idx < 0) {
                    try { arg.revert(); } catch (e) {}
                    return;
                }
                const allDay = (arg?.event?.allDay === true) || isAllDayRange(start, end);
                list[idx] = { ...list[idx], start: safeISO(start), end: safeISO(end), allDay };
                await saveScheduleAll(list);
                toast('✅ 已更新日程', 'success');
            },
            dateClick: (info) => {
                try {
                    if (info?.jsEvent) {
                        info.jsEvent.__tmCalHandled = true;
                        info.jsEvent.preventDefault?.();
                    }
                } catch (e0) {}
                const d = info?.date instanceof Date ? info.date : null;
                if (!d || Number.isNaN(d.getTime())) return;
                const start = new Date(d.getTime());
                start.setSeconds(0, 0);
                const end = new Date(start.getTime() + (info?.allDay === true ? 24 * 60 : 30) * 60000);
                openScheduleModal({ start, end, allDay: info?.allDay === true, calendarId: pickDefaultCalendarId(getSettings()) });
            },
            select: (info) => {
                try { cal.unselect(); } catch (e) {}
                const start = info?.start instanceof Date ? info.start : null;
                const end = info?.end instanceof Date ? info.end : null;
                if (!start || !end) return;
                openScheduleModal({ start, end, allDay: info?.allDay === true, calendarId: pickDefaultCalendarId(getSettings()) });
            },
            datesSet: () => {
                try {
                    requestAnimationFrame(() => syncSideDayLayout(rootEl, cal, getSettings()));
                } catch (e) {}
                try { setTimeout(() => syncSideDayLayout(rootEl, cal, getSettings()), 0); } catch (e) {}
            },
            viewDidMount: () => {
                try {
                    requestAnimationFrame(() => syncSideDayLayout(rootEl, cal, getSettings()));
                } catch (e) {}
            },
        });
        cal.render();
        syncSideDayLayout(rootEl, cal, settings);
        state.sideDay.calendar = cal;
        scheduleClampSideDayPopover(rootEl);

        // 修复：使用 ResizeObserver 监听侧边栏日历容器尺寸变化
        if (rootEl && typeof ResizeObserver === 'function') {
            const sideDayResizeObserver = new ResizeObserver(() => {
                requestAnimationFrame(() => {
                    try { syncSideDayLayout(rootEl, cal, getSettings()); } catch (e2) {}
                    try { clampSideDayPopover(rootEl); } catch (e2) {}
                });
            });
            sideDayResizeObserver.observe(rootEl);
            state.sideDay.resizeObserver = sideDayResizeObserver;
        }

        const onSideDayPopoverClickCapture = (ev) => {
            const target = ev?.target;
            if (!(target instanceof Element)) return;
            if (!target.closest('.fc-more-link, .fc-more')) return;
            scheduleClampSideDayPopover(rootEl);
        };
        rootEl.addEventListener('click', onSideDayPopoverClickCapture, true);
        state.sideDay.popoverClickCapture = onSideDayPopoverClickCapture;

        if (typeof MutationObserver === 'function') {
            const obs = new MutationObserver((mutations) => {
                for (const m of mutations || []) {
                    const nodes = m?.addedNodes || [];
                    for (const n of nodes) {
                        if (!(n instanceof Element)) continue;
                        if (n.matches?.('.fc-popover') || n.querySelector?.('.fc-popover')) {
                            scheduleClampSideDayPopover(rootEl);
                            return;
                        }
                    }
                }
            });
            try {
                obs.observe(rootEl, { childList: true, subtree: true });
                state.sideDay.popoverObserver = obs;
            } catch (e) {
                try { obs.disconnect(); } catch (e2) {}
            }
        }

        // 修复：页面从后台恢复时重新计算侧边栏日历尺寸
        // 使用 resize 事件来触发
        let lastSideDayVisibilityState = document.visibilityState;
        
        const onSideDayVisibilityChange = () => {
            if (document.visibilityState === 'visible' && lastSideDayVisibilityState === 'hidden') {
                // 页面从后台恢复到前台，触发 resize 事件让日历重新布局
                window.dispatchEvent(new Event('resize'));
            }
            lastSideDayVisibilityState = document.visibilityState;
        };
        document.addEventListener('visibilitychange', onSideDayVisibilityChange);
        state.sideDay.onVisibilityChange = onSideDayVisibilityChange;

        return true;
    }

    function setSideDayDate(dateKey) {
        const v = String(dateKey || '').trim();
        const cal = state.sideDay.calendar;
        if (!cal || !v) return false;
        try {
            cal.gotoDate(v);
            state.sideDay.dateKey = v;
            try { syncSideDayLayout(state.sideDay.rootEl, cal, getSettings()); } catch (e2) {}
            return true;
        } catch (e) {
            return false;
        }
    }

    function relayoutSideDayDate() {
        const cal = state.sideDay.calendar;
        if (!cal) return false;
        try {
            const d = cal.getDate();
            cal.gotoDate(d);
            state.sideDay.dateKey = formatDateKey(d);
            try { syncSideDayLayout(state.sideDay.rootEl, cal, getSettings()); } catch (e2) {}
            return true;
        } catch (e) {
            return false;
        }
    }

    function shiftSideDay(delta) {
        const cal = state.sideDay.calendar;
        if (!cal) return false;
        try {
            const d = cal.getDate();
            const n = new Date(d.getTime());
            n.setDate(n.getDate() + (Number(delta) || 0));
            cal.gotoDate(n);
            state.sideDay.dateKey = formatDateKey(n);
            return true;
        } catch (e) {
            return false;
        }
    }

    function getSideDayDate() {
        const cal = state.sideDay.calendar;
        if (!cal) return '';
        try {
            return formatDateKey(cal.getDate());
        } catch (e) {
            return '';
        }
    }

    async function listTaskSchedulesByDay(dayKey) {
        const d = parseDateOnly(dayKey);
        if (!(d instanceof Date) || Number.isNaN(d.getTime())) return [];
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
        const end = new Date(start.getTime() + 86400000);
        const s2 = start.getTime();
        const e2 = end.getTime();
        const list = await loadScheduleAll();
        return (Array.isArray(list) ? list : []).filter((it) => {
            const tid = String(it?.taskId || it?.task_id || it?.linkedTaskId || it?.linked_task_id || '').trim();
            if (!tid) return false;
            const s1 = toMs(it?.start);
            const e1 = toMs(it?.end);
            return overlap(s1, e1, s2, e2);
        }).sort((a, b) => {
            const sa = toMs(a?.start);
            const sb = toMs(b?.start);
            if (sa !== sb) return sa - sb;
            return String(a?.title || '').localeCompare(String(b?.title || ''), 'zh-Hans-CN');
        });
    }

    async function loadScheduleForRange(rangeStart, rangeEnd) {
        const list = await loadScheduleAll();
        return list.filter((it) => hasScheduleOccurrenceInRange(it, rangeStart, rangeEnd));
    }

    function __tmNormalizeTaskTitleFromRow(row) {
        const raw = String(row?.content || row?.raw_content || '').trim();
        if (raw) return raw;
        const md = String(row?.markdown || '').trim();
        if (!md) return '';
        return md.replace(/^\s*[-*]\s*\[[ xX]\]\s*/g, '').trim();
    }

    function __tmBuildTaskTitleIndexFromCalendarCache() {
        const prev = window.__tmCalendarAllTasksCache;
        const out = new Map();
        const tasks = prev && Array.isArray(prev.tasks) ? prev.tasks : [];
        for (const t of tasks) {
            const id = String(t?.id || '').trim();
            const title = String(t?.content || t?.raw_content || '').trim();
            if (id && title && !out.has(id)) out.set(id, title);
        }
        return out;
    }

    async function __tmLoadTaskTitlesByIds(ids) {
        const list = Array.isArray(ids) ? ids : [];
        const uniq = [];
        const seen = new Set();
        for (const x of list) {
            const id = String(x || '').trim();
            if (!/^[0-9]+-[a-zA-Z0-9]+$/.test(id)) continue;
            if (seen.has(id)) continue;
            seen.add(id);
            uniq.push(id);
        }
        const out = new Map();
        if (uniq.length === 0) return out;
        const chunkSize = 200;
        for (let i = 0; i < uniq.length; i += chunkSize) {
            const chunk = uniq.slice(i, i + chunkSize);
            const inList = chunk.map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
            const sql = `SELECT id, content, markdown FROM blocks WHERE id IN (${inList}) LIMIT ${Math.max(1, Math.min(5000, chunk.length))}`;
            const res = await postJSON('/api/query/sql', { stmt: sql });
            const json = await res.json().catch(() => ({}));
            const rows = (res.ok && json?.code === 0 && Array.isArray(json?.data)) ? json.data : [];
            for (const r of rows) {
                const id = String(r?.id || '').trim();
                if (!id) continue;
                const title = __tmNormalizeTaskTitleFromRow(r);
                if (title && !out.has(id)) out.set(id, title);
            }
        }
        return out;
    }

    async function __tmBuildScheduleLinkedTaskTitleMap(items) {
        const schedules = Array.isArray(items) ? items : [];
        const needIds = [];
        const seen = new Set();
        for (const it of schedules) {
            const tid = String(it?.taskId || it?.task_id || it?.linkedTaskId || it?.linked_task_id || '').trim();
            if (!/^[0-9]+-[a-zA-Z0-9]+$/.test(tid)) continue;
            if (seen.has(tid)) continue;
            seen.add(tid);
            needIds.push(tid);
        }
        if (needIds.length === 0) return new Map();
        const out = new Map();
        try {
            const cached = __tmBuildTaskTitleIndexFromCalendarCache();
            for (const id of needIds) {
                const v = cached.get(id);
                if (v && !out.has(id)) out.set(id, v);
            }
        } catch (e) {}
        const missing = needIds.filter((id) => !out.has(id));
        if (missing.length > 0) {
            try {
                const fetched = await __tmLoadTaskTitlesByIds(missing);
                for (const [k, v] of fetched.entries()) {
                    if (v && !out.has(k)) out.set(k, v);
                }
            } catch (e) {}
        }
        return out;
    }

    function buildEventsFromSchedule(items, rangeStart, rangeEnd, settings, linkedTaskTitleMap) {
        if (!settings.showSchedule) return [];
        const defs = getCalendarDefs(settings);
        const defMap = new Map(defs.map((d) => [d.id, d]));
        const registry = shouldPreferDeviceNotificationBackend() ? loadScheduleMobileRegistry() : null;
        const out = [];
        for (const it of (Array.isArray(items) ? items : [])) {
            const rs = toMs(it?.start);
            const re = toMs(it?.end);
            if (!Number.isFinite(rs) || !Number.isFinite(re) || re <= rs) continue;
            const start = new Date(rs);
            const end = new Date(re);
            const taskId = String(it?.taskId || it?.task_id || it?.linkedTaskId || it?.linked_task_id || '').trim();
            const linkedTitle = (linkedTaskTitleMap instanceof Map && taskId) ? String(linkedTaskTitleMap.get(taskId) || '').trim() : '';
            const titleBase = linkedTitle || (String(it?.title || '').trim() || '日程');
            const calendarId = String(it?.calendarId || 'default');
            if (!isCalendarEnabled(calendarId, settings)) continue;
            const calColor = defMap.get(calendarId)?.color || '#0078d4';
            const rawColor = String(it?.color || '').trim();
            const color = rawColor || settings.scheduleColor || calColor;
            const allDayBase = (it?.allDay === true) || isAllDayRange(start, end);
            const reminderMode = String(it?.reminderMode || '').trim() === 'custom' ? 'custom' : 'inherit';
            const reminderEnabled = reminderMode === 'custom' ? (it?.reminderEnabled === true) : null;
            const reminderOffsetMin = (() => {
                if (reminderMode !== 'custom') return null;
                const n = Number(it?.reminderOffsetMin);
                const allowed = new Set([0, 5, 10, 15, 30, 60]);
                return (Number.isFinite(n) && allowed.has(n)) ? n : 0;
            })();
            const repeatType = getScheduleRepeatType(it);
            const repeatEvery = getScheduleRepeatEvery(it, repeatType);
            const repeatUntil = getScheduleRepeatUntil(it);
            const repeatMonthlyMode = getScheduleRepeatMonthlyMode(it, repeatType);
            const occurrences = collectScheduleOccurrencesInRange(it, rangeStart, rangeEnd, {
                limit: String(repeatType || 'none') === 'none' ? 1 : 300,
            });
            for (const occurrence of occurrences) {
                const occStart = occurrence?.start instanceof Date ? occurrence.start : start;
                const occEnd = occurrence?.end instanceof Date ? occurrence.end : end;
                const allDay = allDayBase || isAllDayRange(occStart, occEnd);
                const occStartMs = Number(occurrence?.startMs || occStart.getTime());
                out.push({
                    id: repeatType === 'none' ? String(it?.id || uuid()) : `${String(it?.id || uuid())}:${occStartMs}`,
                    title: titleBase,
                    start: occStart,
                    end: occEnd,
                    allDay,
                    classNames: allDay ? ['tm-cal-allday-soft-event'] : ['tm-cal-schedule-event'],
                    editable: repeatType === 'none',
                    startEditable: repeatType === 'none',
                    durationEditable: repeatType === 'none',
                    backgroundColor: color,
                    borderColor: color,
                    __tmRank: 1,
                    extendedProps: {
                        __tmSource: 'schedule',
                        __tmScheduleId: String(it?.id || ''),
                        __tmTaskId: taskId,
                        __tmRank: 1,
                        __tmReminderMode: reminderMode,
                        __tmReminderEnabled: reminderEnabled,
                        __tmReminderOffsetMin: reminderOffsetMin,
                        __tmNotificationSchedules: buildScheduleNotificationSchedulesView(it, registry),
                        __tmRepeatType: repeatType,
                        __tmRepeatEvery: repeatEvery,
                        __tmRepeatUntil: repeatUntil,
                        __tmRepeatMonthlyMode: repeatMonthlyMode,
                        __tmScheduleBaseStart: safeISO(start),
                        __tmScheduleBaseEnd: safeISO(end),
                        __tmOccurrenceStartMs: occStartMs,
                        calendarId,
                    },
                });
            }
        }
        return out;
    }

    function buildEventsFromTaskDates(items, settings) {
        if (!settings.showTaskDates) return [];
        const defs = getCalendarDefs(settings);
        const defMap = new Map(defs.map((d) => [d.id, d]));
        return (Array.isArray(items) ? items : []).map((it) => {
            const taskId = String(it?.id || '').trim();
            const title = String(it?.title || '').trim() || '任务';
            const startKey = String(it?.start || '').trim();
            const endExKey = String(it?.endExclusive || '').trim();
            const calendarId = String(it?.calendarId || 'default').trim() || 'default';
            if (!taskId || !startKey || !endExKey) return null;
            if (!isCalendarEnabled(calendarId, settings)) return null;
            const calColor = defMap.get(calendarId)?.color || '#6b7280';
            const mode = String(settings.taskDateColorMode || 'group').trim() || 'group';
            const bg = (mode === 'group') ? calColor : (settings.taskDatesColor || '#6b7280');
            return {
                id: `taskdate:${taskId}`,
                title,
                start: startKey,
                end: endExKey,
                allDay: true,
                backgroundColor: bg,
                borderColor: bg,
                textColor: '#fff',
                __tmRank: 2,
                extendedProps: {
                    __tmSource: 'taskdate',
                    __tmTaskId: taskId,
                    __tmRank: 2,
                    __tmTaskDateStartKey: startKey,
                    __tmTaskDateEndExclusiveKey: endExKey,
                    calendarId,
                },
            };
        }).filter(Boolean);
    }

    function reminderOccurrenceKey(dateKey, timeKey) {
        return `${String(dateKey || '').trim()} ${String(timeKey || '').trim()}`.trim();
    }

    function parseReminderTime(raw) {
        const s = String(raw || '').trim();
        const m = s.match(/^(\d{1,2}):(\d{1,2})$/);
        if (!m) return null;
        const hh = Number(m[1]);
        const mm = Number(m[2]);
        if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
        if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
        const key = `${pad2(hh)}:${pad2(mm)}`;
        return { hh, mm, key };
    }

    function getReminderTimes(reminder) {
        const set = new Set();
        const out = [];
        const arr = Array.isArray(reminder?.times) ? reminder.times : [];
        for (const it of arr) {
            const p = parseReminderTime(it);
            if (!p) continue;
            if (set.has(p.key)) continue;
            set.add(p.key);
            out.push(p.key);
        }
        return out.sort();
    }

    function getReminderCompletedSet(reminder) {
        const set = new Set();
        const arr = reminder?.completedOccurrences || reminder?.completed || reminder?.done || [];
        if (!Array.isArray(arr)) return set;
        for (const it of arr) {
            if (!it) continue;
            if (typeof it === 'string') {
                const k = it.trim();
                if (k) set.add(k);
                continue;
            }
            const k = reminderOccurrenceKey(it.date || it.dateKey || it.day, it.time || it.timeKey);
            if (k) set.add(k);
        }
        return set;
    }

    function getReminderEvery(reminder) {
        const raw = reminder?.every ?? reminder?.intervalEvery ?? reminder?.repeatEvery;
        const n = parseInt(raw, 10);
        if (!Number.isFinite(n) || n <= 0) return 1;
        return Math.min(3650, Math.max(1, n));
    }

    function getReminderStartDateKey(reminder) {
        const v = String(reminder?.startDate || reminder?.startDateKey || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
        return formatDateKey(reminder?.createdAt ? new Date(reminder.createdAt) : new Date());
    }

    function doesReminderOccurOnDate(reminder, dateKey) {
        const dk = String(dateKey || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dk)) return false;
        if (reminder?.enabled === false) return false;
        const startKey = getReminderStartDateKey(reminder);
        if (!startKey || dk < startKey) return false;
        const endDateKey = String(reminder?.endDate || '').trim();
        if (endDateKey && /^\d{4}-\d{2}-\d{2}$/.test(endDateKey) && dk > endDateKey) return false;

        const interval = String(reminder?.interval || 'once').trim() || 'once';
        const every = interval === 'once' ? 1 : getReminderEvery(reminder);
        const target = new Date(`${dk}T00:00:00`);
        const created = new Date(`${startKey}T00:00:00`);
        if (Number.isNaN(target.getTime()) || Number.isNaN(created.getTime())) return false;
        const dayMs = 86400000;

        if (interval === 'once') return dk === startKey;
        if (interval === 'daily') {
            const diffDays = Math.floor((target.getTime() - created.getTime()) / dayMs);
            return diffDays >= 0 && diffDays % every === 0;
        }
        if (interval === 'weekly') {
            if (target.getDay() !== created.getDay()) return false;
            const diffWeeks = Math.floor((target.getTime() - created.getTime()) / (dayMs * 7));
            return diffWeeks >= 0 && diffWeeks % every === 0;
        }
        if (interval === 'monthly') {
            const diffMonths = (target.getFullYear() - created.getFullYear()) * 12 + (target.getMonth() - created.getMonth());
            if (diffMonths < 0 || diffMonths % every !== 0) return false;
            const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
            const day = Math.min(created.getDate(), lastDay);
            return target.getDate() === day;
        }
        if (interval === 'yearly') {
            const diffYears = target.getFullYear() - created.getFullYear();
            if (diffYears < 0 || diffYears % every !== 0) return false;
            if (target.getMonth() !== created.getMonth()) return false;
            const lastDay = new Date(target.getFullYear(), created.getMonth() + 1, 0).getDate();
            const day = Math.min(created.getDate(), lastDay);
            return target.getDate() === day;
        }
        return false;
    }

    function isReminderDateCompleted(reminder, dateKey, times, completedSet) {
        const arr = Array.isArray(times) ? times : [];
        if (arr.length === 0) return false;
        const set = completedSet instanceof Set ? completedSet : getReminderCompletedSet(reminder);
        return arr.every((t) => set.has(reminderOccurrenceKey(dateKey, t)));
    }

    async function loadReminderBlocks() {
        const now = Date.now();
        const cache = state.reminderCache || {};
        if (Array.isArray(cache.list) && (now - (cache.loadedAt || 0) < 60000)) return cache.list;
        if (cache.inflight && typeof cache.inflight.then === 'function') return await cache.inflight;
        const loader = (async () => {
            let blocks = [];
            try {
                const getter = globalThis.__tomatoReminder?.getBlocks;
                if (typeof getter === 'function') {
                    blocks = await getter();
                }
            } catch (e) {
                blocks = [];
            }
            if (!Array.isArray(blocks) || blocks.length === 0) {
                try {
                    const sql = `
                        SELECT b.id, b.content, b.type, b.root_id, a.value as reminder_data
                        FROM blocks b
                        JOIN attributes a ON b.id = a.block_id
                        WHERE a.name = 'custom-tomato-reminder'
                        AND a.value != ''
                        AND b.type IN ('p', 'h', 'i', 'l', 'c')
                        ORDER BY b.updated DESC
                        LIMIT 500
                    `;
                    const res = await postJSON('/api/query/sql', { stmt: sql });
                    const json = await res.json();
                    const rows = (res.ok && json?.code === 0 && Array.isArray(json?.data)) ? json.data : [];
                    blocks = rows.map((row) => {
                        try {
                            const reminderData = JSON.parse(String(row?.reminder_data || '{}'));
                            return {
                                blockId: String(row?.id || '').trim(),
                                blockContent: String(row?.content || '').trim(),
                                blockType: String(row?.type || '').trim(),
                                rootId: String(row?.root_id || '').trim(),
                                ...reminderData,
                            };
                        } catch (e) {
                            return null;
                        }
                    }).filter(Boolean);
                } catch (e) {
                    blocks = [];
                }
            }
            const safe = Array.isArray(blocks) ? blocks : [];
            state.reminderCache = { list: safe, loadedAt: Date.now(), inflight: null };
            return safe;
        })();
        state.reminderCache = { ...cache, inflight: loader };
        try {
            return await loader;
        } finally {
            if (state.reminderCache?.inflight === loader) state.reminderCache.inflight = null;
        }
    }

    function buildEventsFromReminders(reminders, rangeStart, rangeEnd, settings) {
        if (!settings.linkDockTomato) return [];
        const start = parseDateOnly(rangeStart instanceof Date ? formatDateKey(rangeStart) : String(rangeStart || ''));
        const end = parseDateOnly(rangeEnd instanceof Date ? formatDateKey(rangeEnd) : String(rangeEnd || ''));
        if (!(start instanceof Date) || !(end instanceof Date)) return [];
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) return [];
        const out = [];
        const dayMs = 86400000;
        const colorTodo = '#f2994a';
        const colorDone = '#9aa0a6';
        for (const r of Array.isArray(reminders) ? reminders : []) {
            if (!r || r.enabled === false) continue;
            const blockId = String(
                r.blockId || r.block_id || r.taskBlockId || r.task_block_id || r.targetBlockId || r.target_block_id || r.id || ''
            ).trim();
            const titleBase = String(r.blockName || r.blockContent || r.title || '').trim() || '任务提醒';
            const times = getReminderTimes(r);
            const completedSet = getReminderCompletedSet(r);
            for (let ts = start.getTime(); ts < end.getTime(); ts += dayMs) {
                const day = new Date(ts);
                const dateKey = formatDateKey(day);
                if (!doesReminderOccurOnDate(r, dateKey)) continue;
                const done = isReminderDateCompleted(r, dateKey, times, completedSet);
                const timeLabel = times.length > 0 ? ` (${times.join(',')})` : '';
                out.push({
                    id: `reminder:${blockId || titleBase}:${dateKey}`,
                    title: `${done ? '✓ ' : '⏰ '}${titleBase}${timeLabel}`,
                    start: dateKey,
                    end: formatDateKey(new Date(ts + dayMs)),
                    allDay: true,
                    editable: false,
                    backgroundColor: done ? colorDone : colorTodo,
                    borderColor: done ? colorDone : colorTodo,
                    textColor: '#fff',
                    classNames: done ? ['tm-cal-reminder-event', 'tm-cal-reminder-event--done'] : ['tm-cal-reminder-event'],
                    __tmRank: 3,
                    extendedProps: {
                        __tmSource: 'reminder',
                        __tmReminderBlockId: blockId,
                        __tmReminderDone: done,
                        __tmReminderDate: dateKey,
                        __tmRank: 3,
                    },
                });
            }
        }
        return out;
    }

    async function loadCnHolidayYear(year) {
        const y = Number(year);
        if (!Number.isFinite(y) || y < 1900 || y > 2100) return [];
        if (!state.cnHolidayCache) state.cnHolidayCache = new Map();
        const cached = state.cnHolidayCache.get(y);
        if (cached && Array.isArray(cached.data) && (Date.now() - (cached.ts || 0) < 12 * 3600 * 1000)) return cached.data;
        const lsKey = `tm_cn_holiday_${y}`;
        try {
            const raw = String(localStorage.getItem(lsKey) || '');
            if (raw) {
                const obj = JSON.parse(raw);
                const data = Array.isArray(obj?.data) ? obj.data : [];
                const ts = Number(obj?.ts) || 0;
                if (data.length && ts && (Date.now() - ts < 72 * 3600 * 1000)) {
                    state.cnHolidayCache.set(y, { ts, data });
                    return data;
                }
            }
        } catch (e) {}
        try {
            const res = await fetch(`https://holiday.ailcc.com/api/holiday/allyear/${y}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            const data = Array.isArray(json?.data) ? json.data : [];
            const ts = Date.now();
            state.cnHolidayCache.set(y, { ts, data });
            try { localStorage.setItem(lsKey, JSON.stringify({ ts, data })); } catch (e2) {}
            return data;
        } catch (e) {
            state.cnHolidayCache.set(y, { ts: Date.now(), data: [] });
            return [];
        }
    }

    function buildCnHolidayMap(days, rangeStart, rangeEnd, includeAllDays) {
        const map = new Map();
        const all = !!includeAllDays;
        for (const it of Array.isArray(days) ? days : []) {
            const dateKey = String(it?.date || '').trim();
            if (!dateKey) continue;
            const type = Number(it?.type);
            if (!all && (type !== 2 && type !== 3 && type !== 4)) continue;
            const name = String(it?.name || '').trim();
            const lunar = String(it?.lunar || it?.cnLunar || '').trim();
            map.set(dateKey, { type, name, lunar });
        }
        return map;
    }

    function applyCnHolidayDots(rootEl) {
        const root = rootEl || state.rootEl;
        if (!root || !(root instanceof Element)) return;
        const map = state.cnHolidayMap instanceof Map ? state.cnHolidayMap : new Map();
        const ensureWeekHead = (labelEl) => {
            if (!labelEl) return null;
            const exist = labelEl.querySelector?.(':scope > .tm-cn-week-head');
            if (exist) return exist;
            const head = document.createElement('span');
            head.className = 'tm-cn-week-head';
            while (labelEl.firstChild) {
                head.appendChild(labelEl.firstChild);
            }
            labelEl.appendChild(head);
            return head;
        };
        const ensure = (labelEl, dateKey) => {
            if (!labelEl) return;
            try {
                labelEl.querySelectorAll?.('.tm-cn-holiday-dot')?.forEach?.((el) => { try { el.remove(); } catch (e) {} });
            } catch (e) {}
            const it = map.get(String(dateKey || ''));
            if (!it) return;
            const type = Number(it.type);
            if (type !== 2 && type !== 3 && type !== 4) return;
            const dot = document.createElement('span');
            const isWork = type === 4;
            dot.className = `tm-cn-holiday-dot ${isWork ? 'tm-cn-holiday-dot--work' : 'tm-cn-holiday-dot--rest'}`;
            dot.textContent = isWork ? '班' : '休';
            dot.title = `${isWork ? '上班' : '休息'}${it.name ? `：${it.name}` : ''}`;
            try {
                const isWeek = !!labelEl.closest?.('.fc-col-header-cell');
                const host = isWeek ? ensureWeekHead(labelEl) : labelEl;
                const first = host.firstChild;
                if (first) host.insertBefore(dot, first);
                else host.appendChild(dot);
            } catch (e) {}
        };

        const monthCells = Array.from(root.querySelectorAll('.fc-daygrid-day[data-date]'));
        for (const cell of monthCells) {
            const dateKey = cell.getAttribute('data-date') || '';
            const label = cell.querySelector('.fc-daygrid-day-number');
            ensure(label, dateKey);
        }
        const headerCells = Array.from(root.querySelectorAll('.fc-col-header-cell[data-date]'));
        for (const cell of headerCells) {
            const dateKey = cell.getAttribute('data-date') || '';
            const label = cell.querySelector('.fc-col-header-cell-cushion');
            ensure(label, dateKey);
        }
    }

    function applyCnLunarLabels(rootEl) {
        const root = rootEl || state.rootEl;
        if (!root || !(root instanceof Element)) return;
        const settings = getSettings();
        const map = state.cnHolidayMap instanceof Map ? state.cnHolidayMap : new Map();
        const removeAll = () => {
            root.querySelectorAll('.tm-cn-lunar').forEach((el) => { try { el.remove(); } catch (e) {} });
        };
        if (!settings.showLunar) {
            removeAll();
            return;
        }
        removeAll();
        const lunarDayText = (raw) => {
            const s = String(raw || '').trim();
            if (!s) return '';
            const idx = s.lastIndexOf('月');
            if (idx >= 0 && idx < s.length - 1) return s.slice(idx + 1).trim();
            return s;
        };
        const ensureWeekHead = (labelEl) => {
            if (!labelEl) return null;
            const exist = labelEl.querySelector?.(':scope > .tm-cn-week-head');
            if (exist) return exist;
            const head = document.createElement('span');
            head.className = 'tm-cn-week-head';
            while (labelEl.firstChild) {
                head.appendChild(labelEl.firstChild);
            }
            labelEl.appendChild(head);
            return head;
        };
        const lunarFor = (dateKey) => {
            const it = map.get(String(dateKey || ''));
            const l = String(it?.lunar || '').trim();
            return lunarDayText(l);
        };
        const addWeek = (labelEl, dateKey) => {
            if (!labelEl) return;
            const lunar = lunarFor(dateKey);
            if (!lunar) return;
            ensureWeekHead(labelEl);
            const el = document.createElement('span');
            el.className = 'tm-cn-lunar tm-cn-lunar--week';
            el.textContent = lunar;
            try { el.style.setProperty('font-weight', '400', 'important'); } catch (e) {}
            try { labelEl.appendChild(el); } catch (e) {}
        };
        const addMonth = (cellEl, dateKey) => {
            if (!cellEl) return;
            const lunar = lunarFor(dateKey);
            if (!lunar) return;
            const num = cellEl.querySelector('.fc-daygrid-day-number');
            if (!num) return;
            const top = cellEl.querySelector('.fc-daygrid-day-top');
            if (!top) return;
            const el = document.createElement('span');
            el.className = 'tm-cn-lunar tm-cn-lunar--month';
            el.textContent = lunar;
            try {
                if (num && window.getComputedStyle) {
                    const cs = window.getComputedStyle(num);
                    if (cs?.fontSize) el.style.fontSize = cs.fontSize;
                    if (cs?.lineHeight) el.style.lineHeight = cs.lineHeight;
                    if (cs?.fontFamily) el.style.fontFamily = cs.fontFamily;
                    el.style.setProperty('font-weight', '400', 'important');
                }
            } catch (e) {}
            try {
                top.insertBefore(el, num);
            } catch (e) {}
        };
        const addDayTitle = (wrap) => {
            const vt = String(state.calendar?.view?.type || '').trim();
            if (vt !== 'timeGridDay') return;
            const titleEl = wrap?.querySelector?.('.fc-toolbar-title');
            if (!titleEl) return;
            const d = state.calendar?.getDate?.();
            const key = (d instanceof Date && !Number.isNaN(d.getTime())) ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` : '';
            if (!key) return;
            const lunar = lunarFor(key);
            if (!lunar) return;
            const el = document.createElement('span');
            el.className = 'tm-cn-lunar tm-cn-lunar--day';
            el.textContent = lunar;
            try { el.style.setProperty('font-weight', '400', 'important'); } catch (e) {}
            try { titleEl.appendChild(el); } catch (e) {}
        };
        const monthCells = Array.from(root.querySelectorAll('.fc-daygrid-day[data-date]'));
        for (const cell of monthCells) {
            const dateKey = cell.getAttribute('data-date') || '';
            addMonth(cell, dateKey);
        }
        const vtNow = String(state.calendar?.view?.type || '').trim();
        if (vtNow === 'dayGridMonth') return;

        const headerCells = Array.from(root.querySelectorAll('.fc-col-header-cell[data-date]'));
        for (const cell of headerCells) {
            const dateKey = cell.getAttribute('data-date') || '';
            const label = cell.querySelector('.fc-col-header-cell-cushion');
            addWeek(label, dateKey);
        }
    }

    function normalizeCnHolidayName(rawName) {
        const s0 = String(rawName || '').trim();
        if (!s0) return '';
        const s1 = s0
            .replace(/[（(]\s*[班休]\s*[）)]/g, '')
            .replace(/^\s*[班休]\s*/g, '')
            .trim();
        return s1;
    }

    function isCnFestivalName(name) {
        const n = String(name || '').trim();
        if (!n) return false;
        const set = new Set([
            '元旦',
            '除夕',
            '春节',
            '元宵节',
            '清明节',
            '劳动节',
            '端午节',
            '中秋节',
            '国庆节',
        ]);
        if (set.has(n)) return true;
        if (n.includes('节')) return true;
        return false;
    }

    function canonicalCnFestivalName(rawName) {
        const set = new Set([
            '元旦',
            '除夕',
            '春节',
            '元宵节',
            '清明节',
            '劳动节',
            '端午节',
            '中秋节',
            '国庆节',
        ]);
        let n = normalizeCnHolidayName(String(rawName || '').trim());
        if (!n) return '';
        if (n.endsWith('假期')) n = n.slice(0, -2);
        if (set.has(n)) return n;
        if (n.endsWith('节')) {
            const n2 = n.slice(0, -1);
            if (set.has(n2)) return n2;
        }
        return '';
    }

    function cnFestivalBonus(name, dateKey, lunar) {
        const n = String(name || '').trim();
        const k = String(dateKey || '').trim();
        const l = String(lunar || '').trim();
        if (!n || !k) return 0;
        if (n === '元旦' && k.endsWith('-01-01')) return 200;
        if (n === '劳动节' && k.endsWith('-05-01')) return 200;
        if (n === '国庆节' && k.endsWith('-10-01')) return 200;
        if (n === '春节' && l.includes('正月初一')) return 200;
        if (n === '元宵节' && l.includes('正月十五')) return 200;
        if (n === '端午节' && l.includes('五月初五')) return 200;
        if (n === '中秋节' && l.includes('八月十五')) return 200;
        if (n === '除夕' && l.includes('腊月') && (l.includes('廿九') || l.includes('二十九') || l.includes('三十') || l.includes('三十'))) return 200;
        if (n === '清明节') {
            if (l.includes('清明')) return 200;
            if (k.endsWith('-04-04') || k.endsWith('-04-05') || k.endsWith('-04-06')) return 50;
        }
        return 0;
    }

    function buildCnHolidayEvents(days, rangeStart, rangeEnd, viewType, settings) {
        const startMs = toMs(rangeStart);
        const endMs = toMs(rangeEnd);
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return [];
        const nextDay = (k) => {
            const d = parseDateOnly(k);
            if (!d) return '';
            const d2 = new Date(d.getTime() + 86400000);
            return formatDateKey(d2);
        };
        const vt = String(viewType || '').trim();
        const dayMap = new Map();
        for (const it of Array.isArray(days) ? days : []) {
            const dateKey = String(it?.date || '').trim();
            if (!dateKey) continue;
            const type = Number(it?.type);
            if (type !== 2 && type !== 3 && type !== 4) continue;
            const name = normalizeCnHolidayName(String(it?.name || '').trim());
            if (!name) continue;
            dayMap.set(dateKey, { type, name });
        }
        const best = new Map();
        for (const it of Array.isArray(days) ? days : []) {
            const dateKey = String(it?.date || '').trim();
            if (!dateKey) continue;
            const ds = toMs(dateKey);
            if (!Number.isFinite(ds)) continue;
            const type = Number(it?.type);
            if (type !== 2 && type !== 3 && type !== 4) continue;
            if (type === 4) continue;
            const extra = normalizeCnHolidayName(String(it?.extra_info || '').trim());
            const nameNorm = normalizeCnHolidayName(String(it?.name || '').trim());
            const extraCanon = canonicalCnFestivalName(extra);
            const nameCanon = canonicalCnFestivalName(nameNorm);
            const pickName = extraCanon || ((type === 2 && nameCanon) ? nameCanon : '');
            if (!pickName) continue;
            const lunar = String(it?.lunar || it?.cnLunar || '').trim();
            const score = (extraCanon ? 100 : 0) + cnFestivalBonus(pickName, dateKey, lunar) + (type === 2 ? 5 : 0) + (type === 3 ? 1 : 0);
            const prev = best.get(pickName) || null;
            if (!prev || score > prev.score || (score === prev.score && String(dateKey).localeCompare(String(prev.dateKey || '')) < 0)) {
                best.set(pickName, { name: pickName, dateKey, type, score });
            }
        }
        const chosen = Array.from(best.values()).sort((a, b) => String(a.dateKey || '').localeCompare(String(b.dateKey || '')));
        const out = [];
        const color = String(settings?.cnHolidayColor || '#ff3333').trim() || '#ff3333';
        for (const it of chosen) {
            const dateKey = String(it?.dateKey || '').trim();
            const name = String(it?.name || '').trim();
            if (!dateKey || !name) continue;
            const ds = toMs(dateKey);
            if (!Number.isFinite(ds) || ds < startMs || ds >= endMs) continue;

            if (vt === 'timeGridDay') {
                out.push({
                    id: `cn-holiday-bg:${dateKey}`,
                    title: '',
                    start: dateKey,
                    end: nextDay(dateKey) || undefined,
                    allDay: true,
                    editable: false,
                    display: 'background',
                    backgroundColor: 'rgba(234, 67, 53, 0.22)',
                    __tmRank: 9,
                    extendedProps: { __tmSource: 'cnHoliday', __tmCnHolidayName: name, __tmCnHolidayType: 0, __tmRank: 9 },
                });
            }
            out.push({
                id: `cn-holiday:${dateKey}:${name}`,
                title: name,
                start: dateKey,
                end: nextDay(dateKey) || undefined,
                allDay: true,
                editable: false,
                backgroundColor: color,
                borderColor: color,
                textColor: '#fff',
                classNames: ['tm-cn-holiday-event', 'tm-cn-holiday-event--festival'],
                __tmRank: 0,
                extendedProps: { __tmSource: 'cnHoliday', __tmCnHolidayName: name, __tmCnHolidayType: 0, __tmRank: 0 },
            });
        }
        return out;
    }

    function resolveModeColor(mode, settings) {
        const m = String(mode || '').trim();
        if (m === 'break' || m === 'stopwatch-break') return settings.colorBreak;
        if (m === 'stopwatch') return settings.colorStopwatch;
        if (m === 'idle') return settings.colorIdle;
        return settings.colorFocus;
    }

    function buildRecordKey(r) {
        const key = {
            timestamp: r?.timestamp ?? null,
            start: r?.start ?? '',
            end: r?.end ?? '',
            mode: r?.mode ?? '',
            sessionId: r?.sessionId ?? '',
        };
        return key;
    }

    function formatDurationMinutes(totalMinutes) {
        const n = Number(totalMinutes);
        if (!Number.isFinite(n) || n <= 0) return '0m';
        const total = Math.round(n);
        const h = Math.floor(total / 60);
        const m = total % 60;
        if (h > 0 && m > 0) return `${h}h${m}m`;
        if (h > 0) return `${h}h`;
        return `${m}m`;
    }

    function toast(msg, type) {
        const colors = { success: '#34a853', error: '#ea4335', info: '#4285f4', warning: '#f9ab00' };
        const el = document.createElement('div');
        el.className = 'tm-hint';
        el.style.background = colors[type] || '#666';
        el.textContent = String(msg || '');
        document.body.appendChild(el);
        setTimeout(() => { try { el.remove(); } catch (e) {} }, 2500);
    }

    function getScheduleAllDeviceNotificationEntries(item) {
        const map = buildScheduleNotificationSchedulesView(item);
        const result = [];
        for (const [deviceId, schedule] of Object.entries(map || {})) {
            const entries = sanitizeScheduleNotificationEntries(schedule?.entries);
            if (entries.length === 0) continue;
            result.push({ deviceId, schedule, entries });
        }
        return result;
    }

    function getScheduleCurrentDeviceNotificationSummary(item) {
        const current = buildScheduleNotificationSchedulesView(item)[String(SCHEDULE_SYNC_DEVICE_ID || '').trim()];
        const entries = sanitizeScheduleNotificationEntries(current?.entries);
        if (entries.length === 0) return '当前设备暂无已预约提醒';
        const sorted = entries.slice().sort((a, b) => Number(a?.atMs || 0) - Number(b?.atMs || 0));
        const first = sorted[0];
        const dt = new Date(Number(first?.atMs) || 0);
        const when = Number.isNaN(dt.getTime()) ? '' : `${formatDateKey(dt)} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
        const noIdCount = sorted.filter((it) => String(it?.status || '') === 'scheduled-no-id').length;
        return `当前设备已预约 ${sorted.length} 条${when ? `，最近一条 ${when}` : ''}${noIdCount > 0 ? `；其中 ${noIdCount} 条未返回通知ID` : ''}`;
    }

    function showScheduleDeviceScheduleDialog(item, options) {
        closeDeviceScheduleDialog();
        const opts = (options && typeof options === 'object') ? options : {};
        let currentItem = (item && typeof item === 'object') ? { ...item } : {};
        const scheduleId = String(currentItem?.id || '').trim();
        const modal = document.createElement('div');
        modal.className = 'tm-calendar-edit-modal';
        modal.dataset.tmCalDialog = 'deviceSchedule';
        modal.style.zIndex = String(getOverlayZIndex(state.modalEl, 200000) + 2);
        const abort = new AbortController();
        state.deviceScheduleAbort?.abort();
        state.deviceScheduleAbort = abort;
        const close = () => { closeDeviceScheduleDialog(); };
        let actionStatusText = '';
        let actionStatusKind = '';
        const render = () => {
            const groups = getScheduleAllDeviceNotificationEntries(currentItem);
            const currentSummary = getScheduleCurrentDeviceNotificationSummary(currentItem);
            const lines = [];
            for (const group of groups.sort((a, b) => String(a.deviceId || '').localeCompare(String(b.deviceId || '')))) {
                const clientLabel = getScheduleNotificationClientLabel(group?.deviceId, group?.schedule);
                lines.push(`设备: ${String(group.deviceId || '').trim() || 'unknown'}（${clientLabel}）`);
                const entries = group.entries.slice().sort((a, b) => Number(a?.atMs || 0) - Number(b?.atMs || 0));
                for (const entry of entries) {
                    const dt = new Date(Number(entry?.atMs) || 0);
                    const label = Number.isNaN(dt.getTime())
                        ? `${String(entry?.dateKey || '')} ${String(entry?.timeKey || '')}`.trim()
                        : `${formatDateKey(dt)} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
                    const idLabel = Number(entry?.id) >= 0 ? String(entry?.id ?? '') : '未返回';
                    const extra = String(entry?.status || '') === 'scheduled-no-id' ? '\n状态: 已尝试预约，但接口未返回通知ID' : '';
                    lines.push(`${label}\nid: ${idLabel}${extra}`);
                }
                lines.push('');
            }
            const detailText = lines.length > 0 ? lines.join('\n') : '当前设备暂无已预约提醒';
            const statusStyle = actionStatusKind === 'error'
                ? 'color:#d23f31;'
                : (actionStatusKind === 'success'
                    ? 'color:#2e7d32;'
                    : 'color:var(--b3-theme-primary);');
            modal.innerHTML = `
                <div class="tm-calendar-edit-box">
                    <div class="tm-calendar-edit-title">当前设备预约</div>
                    <div class="tm-calendar-edit-row" style="display:block;">
                        <div class="tm-calendar-edit-label" style="margin-bottom:8px;white-space:nowrap;">当前设备</div>
                        <div class="tm-calendar-edit-value" style="line-height:1.5;">${esc(currentSummary)}</div>
                    </div>
                    <div class="tm-calendar-edit-row" style="display:block;">
                        <div class="tm-calendar-edit-label" style="margin-bottom:8px;white-space:nowrap;">已下发通知</div>
                        <div class="tm-calendar-edit-value" style="white-space:pre-line;line-height:1.5;max-height:50vh;overflow:auto;">${esc(detailText)}</div>
                    </div>
                    ${actionStatusText ? `
                    <div class="tm-calendar-edit-row" style="display:block;">
                        <div class="tm-calendar-edit-value" style="line-height:1.5;${statusStyle}">${esc(actionStatusText)}</div>
                    </div>
                    ` : ''}
                    <div class="tm-calendar-edit-actions">
                        ${scheduleId ? `<button class="tm-btn tm-btn-secondary" data-tm-cal-action="refreshDeviceSchedule">更新预约</button>` : ''}
                        ${scheduleId ? `<button class="tm-btn tm-btn-danger" data-tm-cal-action="clearDeviceSchedule">清除当前设备预约</button>` : ''}
                        <div style="flex:1;"></div>
                        <button class="tm-btn tm-btn-secondary" data-tm-cal-action="closeDeviceSchedule">关闭</button>
                    </div>
                </div>
            `;
        };
        render();
        document.body.appendChild(modal);
        state.deviceScheduleModalEl = modal;
        modal.addEventListener('click', async (e) => {
            const btn = findActionTarget(e?.target, 'data-tm-cal-action');
            const action = String(btn?.getAttribute?.('data-tm-cal-action') || '');
            if (e.target === modal || action === 'closeDeviceSchedule') {
                close();
                return;
            }
            if (!action) return;
            if (action === 'refreshDeviceSchedule') {
                actionStatusKind = 'pending';
                actionStatusText = '正在更新当前设备预约...';
                render();
                try {
                    const nextItem = (typeof opts.resolveLatestItem === 'function')
                        ? await opts.resolveLatestItem(currentItem)
                        : await refreshScheduleCurrentDeviceNotificationById(scheduleId);
                    if (nextItem) {
                        currentItem = { ...nextItem };
                        const settingsNow = getSettings();
                        const currentTargets = collectScheduleMobileNotificationTargets(currentItem, settingsNow);
                        const currentEntries = getScheduleAllDeviceNotificationEntries(currentItem)
                            .filter((group) => String(group?.deviceId || '').trim() === String(SCHEDULE_SYNC_DEVICE_ID || '').trim())
                            .flatMap((group) => Array.isArray(group?.entries) ? group.entries : []);
                        if (currentEntries.length > 0) {
                            actionStatusKind = 'success';
                            actionStatusText = `已更新当前设备预约，共 ${currentEntries.length} 条`;
                        } else if (currentTargets.length > 0) {
                            actionStatusKind = 'error';
                            actionStatusText = `已保存当前修改，但通知发送失败：${describeDeviceNotificationFailureReason(sendDeviceNotificationCompat._lastFailureReason)}`;
                        } else {
                            actionStatusKind = 'pending';
                            actionStatusText = '已保存当前修改，但当前条件下没有可预约提醒';
                        }
                        render();
                        try { refetchAllCalendars(); } catch (e2) {}
                        if (currentEntries.length > 0) {
                            toast('✅ 已更新当前设备预约', 'success');
                        } else if (currentTargets.length > 0) {
                            toast('❌ 当前设备预约发送失败', 'error');
                        } else {
                            toast('ℹ 当前没有可预约提醒', 'warning');
                        }
                    } else {
                        actionStatusKind = 'error';
                        actionStatusText = '更新失败：未返回最新预约结果';
                        render();
                        toast('❌ 更新失败', 'error');
                    }
                } catch (err) {
                    actionStatusKind = 'error';
                    actionStatusText = `更新失败：${String(err?.message || err || '未知错误')}`;
                    render();
                    toast('❌ 更新失败', 'error');
                }
                return;
            }
            if (action === 'clearDeviceSchedule') {
                actionStatusKind = 'pending';
                actionStatusText = '正在清除当前设备预约...';
                render();
                try {
                    const nextItem = await clearScheduleCurrentDeviceNotificationById(scheduleId);
                    if (nextItem) {
                        currentItem = { ...nextItem };
                        actionStatusKind = 'success';
                        actionStatusText = '已清除当前设备预约';
                        render();
                        toast('✅ 已清除当前设备预约', 'success');
                    } else {
                        actionStatusKind = 'error';
                        actionStatusText = '清除失败：未找到可更新的预约状态';
                        render();
                        toast('❌ 清除失败', 'error');
                    }
                } catch (err) {
                    actionStatusKind = 'error';
                    actionStatusText = `清除失败：${String(err?.message || err || '未知错误')}`;
                    render();
                    toast('❌ 清除失败', 'error');
                }
                return;
            }
        }, { signal: abort.signal });
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') close();
        }, { signal: abort.signal });
    }

    async function loadRecordsForRange(rangeStart, rangeEnd) {
        const s = getSettings();
        if (!s.linkDockTomato) return [];
        const startMs = toMs(rangeStart);
        const endMs = toMs(rangeEnd);
        const dock = globalThis.__dockTomato;

        let records = null;
        if (s.linkDockTomato && dock && dock.history && typeof dock.history.loadRange === 'function') {
            try {
                records = await dock.history.loadRange(new Date(startMs).toISOString(), new Date(endMs).toISOString());
            } catch (e) {
                records = null;
            }
        }
        if (!Array.isArray(records) || records.length === 0) {
            const cachedAll = state._dockHistoryCache && Array.isArray(state._dockHistoryCache.all) ? state._dockHistoryCache.all : null;
            const cachedOk = Array.isArray(cachedAll) && cachedAll.length > 0;
            const cachedFresh = cachedOk && (Date.now() - (state._dockHistoryCache.ts || 0) < 60000);
            if (cachedFresh) {
                records = cachedAll;
            } else {
                let all = [];
                try { all = await loadDockTomatoHistoryFallbackAll(); } catch (e) { all = []; }
                if (Array.isArray(all) && all.length > 0) {
                    state._dockHistoryCache = { ts: Date.now(), all };
                    records = all;
                } else if (cachedOk) {
                    records = cachedAll;
                } else {
                    records = all;
                }
            }
            records = records.filter((r) => {
                const rs = toMs(r?.start);
                const re = toMs(r?.end);
                if (!Number.isFinite(rs) || !Number.isFinite(re) || re <= rs) return false;
                if (!shouldShowMode(r?.mode, s)) return false;
                return overlap(rs, re, startMs, endMs);
            });
        }
        return (Array.isArray(records) ? records : []).filter((r) => shouldShowMode(r?.mode, s));
    }

    function buildEventsFromRecords(records, settings, viewType) {
        const filtered = (Array.isArray(records) ? records : []).filter((r) => shouldShowMode(r?.mode, settings));
        if (settings.monthAggregate && String(viewType || '').trim() === 'dayGridMonth') {
            return [];
        }

        return filtered.map((r) => {
            const rs = toMs(r?.start);
            const re = toMs(r?.end);
            const start = new Date(rs);
            const end = new Date(re);
            const mode = String(r?.mode || '').trim();
            const titleBase = String(r?.taskBlockName || '').trim() || modeLabel(mode);
            const durMin = Number(r?.durationMin);
            const minutes = Number.isFinite(durMin) && durMin > 0 ? durMin : Math.max(1, Math.round((re - rs) / 60000));
            const color = resolveModeColor(mode, settings);
            return {
                id: `tm-${String(r?.sessionId || '')}-${String(r?.timestamp || re)}`,
                title: `${titleBase} · ${formatDurationMinutes(minutes)}`,
                start,
                end,
                classNames: ['tm-cal-schedule-event', 'tm-cal-tomato-event'],
                backgroundColor: color,
                borderColor: color,
                __tmRank: 0,
                extendedProps: {
                    __tmSource: 'tomato',
                    __tmRecordKey: buildRecordKey(r),
                    __tmRank: 0,
                    taskBlockId: String(r?.taskBlockId || '').trim(),
                    taskBlockName: String(r?.taskBlockName || '').trim(),
                    mode,
                    durationMin: minutes,
                },
            };
        });
    }

    function summarizeRange(records) {
        let min = Infinity;
        let max = -Infinity;
        let bad = 0;
        for (const r of records || []) {
            const s = toMs(r?.start);
            const e = toMs(r?.end);
            if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) {
                bad += 1;
                continue;
            }
            if (s < min) min = s;
            if (e > max) max = e;
        }
        return {
            total: Array.isArray(records) ? records.length : 0,
            bad,
            minMs: Number.isFinite(min) ? min : null,
            maxMs: Number.isFinite(max) ? max : null,
        };
    }

    function closeModal() {
        closeDeviceScheduleDialog();
        if (state.modalEl) {
            try { state.modalEl.remove(); } catch (e) {}
            state.modalEl = null;
        }
        if (state.uiAbort) {
            try { state.uiAbort.abort(); } catch (e) {}
            state.uiAbort = null;
        }
    }

    function closeDeviceScheduleDialog() {
        if (state.deviceScheduleModalEl) {
            try { state.deviceScheduleModalEl.remove(); } catch (e) {}
            state.deviceScheduleModalEl = null;
        }
        if (state.deviceScheduleAbort) {
            try { state.deviceScheduleAbort.abort(); } catch (e) {}
            state.deviceScheduleAbort = null;
        }
    }

    function openRecordModal(eventApi) {
        closeModal();
        const ext = eventApi?.extendedProps || {};
        const recordKey = ext.__tmRecordKey || null;
        const taskBlockId = String(ext.taskBlockId || '').trim();
        const taskBlockName = String(ext.taskBlockName || '').trim();
        const mode = String(ext.mode || '').trim();
        const start = eventApi?.start instanceof Date ? eventApi.start : null;
        const end = eventApi?.end instanceof Date ? eventApi.end : null;
        const startLocal = start ? `${formatDateKey(start)}T${pad2(start.getHours())}:${pad2(start.getMinutes())}` : '';
        const endLocal = end ? `${formatDateKey(end)}T${pad2(end.getHours())}:${pad2(end.getMinutes())}` : '';

        const modal = document.createElement('div');
        modal.className = 'tm-calendar-edit-modal';
        modal.innerHTML = `
            <div class="tm-calendar-edit-box">
                <div class="tm-calendar-edit-title">🍅 计时记录</div>
                <div class="tm-calendar-edit-row">
                    <div class="tm-calendar-edit-label">任务</div>
                    <div class="tm-calendar-edit-value">${esc(taskBlockName || '(未关联任务)')}</div>
                </div>
                <div class="tm-calendar-edit-row">
                    <div class="tm-calendar-edit-label">模式</div>
                    <div class="tm-calendar-edit-value">${esc(mode || '-')}</div>
                </div>
                <div class="tm-calendar-edit-row">
                    <div class="tm-calendar-edit-label">开始</div>
                    <input class="tm-calendar-edit-input" type="datetime-local" value="${esc(startLocal)}" data-tm-cal-field="start">
                </div>
                <div class="tm-calendar-edit-row">
                    <div class="tm-calendar-edit-label">结束</div>
                    <input class="tm-calendar-edit-input" type="datetime-local" value="${esc(endLocal)}" data-tm-cal-field="end">
                </div>
                <div class="tm-calendar-edit-actions">
                    ${taskBlockId ? `<button class="tm-btn tm-btn-secondary" data-tm-cal-action="jumpTask">跳转任务</button>` : ''}
                    <div style="flex:1;"></div>
                    <button class="tm-btn tm-btn-danger" data-tm-cal-action="delete">删除</button>
                    <button class="tm-btn tm-btn-success" data-tm-cal-action="save">保存</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        state.modalEl = modal;

        const abort = new AbortController();
        state.uiAbort?.abort();
        state.uiAbort = abort;
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        }, { signal: abort.signal });
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        }, { signal: abort.signal });

        const getInputValue = (field) => {
            const el = modal.querySelector(`[data-tm-cal-field="${field}"]`);
            return el ? String(el.value || '').trim() : '';
        };
        const syncColorToCalendar = () => {
            const calendarId = getInputValue('calendarId') || calendarId0 || 'default';
            const colorEl = modal.querySelector('[data-tm-cal-field="color"]');
            if (!(colorEl instanceof HTMLInputElement)) return;
            const defs = getCalendarDefs(getSettings());
            const def = defs.find((d) => String(d?.id || '').trim() === calendarId);
            const nextColor = String(def?.color || '#0078d4').trim() || '#0078d4';
            colorEl.value = nextColor;
        };
        const calendarSelEl = modal.querySelector('[data-tm-cal-field="calendarId"]');
        if (calendarSelEl) {
            calendarSelEl.addEventListener('change', () => {
                syncColorToCalendar();
            }, { signal: abort.signal });
        }

        const buildDraftScheduleItemFromModal = async () => {
            if (!scheduleId) return null;
            const title = getInputValue('title');
            const calendarId = getInputValue('calendarId') || calendarId0 || 'default';
            const s0 = getInputValue('start');
            const e0 = getInputValue('end');
            const color = getInputValue('color') || '#0078d4';
            const reminderSelect = String(getInputValue('reminderSelect') || '').trim() || 'inherit';
            const reminderMode = reminderSelect === 'inherit' ? 'inherit' : 'custom';
            const reminderEnabled = (() => {
                if (reminderSelect === 'inherit') return null;
                if (reminderSelect === 'off') return false;
                return true;
            })();
            const reminderOffsetMin = (() => {
                if (reminderSelect === 'inherit' || reminderSelect === 'off') return null;
                if (initAllDay) return null;
                const n = Number(reminderSelect);
                const allowed = new Set([0, 5, 10, 15, 30, 60]);
                return (Number.isFinite(n) && allowed.has(n)) ? n : 0;
            })();
            if (!s0 || !e0) {
                toast('⚠ 开始/结束不能为空', 'warning');
                return null;
            }
            const nextStart = new Date(s0);
            const nextEnd = new Date(e0);
            if (Number.isNaN(nextStart.getTime()) || Number.isNaN(nextEnd.getTime()) || nextEnd.getTime() <= nextStart.getTime()) {
                toast('⚠ 时间不合法', 'warning');
                return null;
            }
            const allDay = isAllDayRange(nextStart, nextEnd) || (initAllDay && isAllDayRange(nextStart, nextEnd));
            const list = await loadScheduleAll();
            const idx = list.findIndex((x) => String(x?.id || '') === scheduleId);
            if (idx < 0) {
                toast('⚠ 未找到日程', 'warning');
                return null;
            }
            const prevItem = list[idx] || {};
            const taskIdKeep = String(taskId0 || prevItem?.taskId || prevItem?.task_id || prevItem?.linkedTaskId || prevItem?.linked_task_id || '').trim();
            return {
                ...prevItem,
                id: scheduleId,
                title: title || '日程',
                start: safeISO(nextStart),
                end: safeISO(nextEnd),
                allDay,
                color,
                calendarId,
                taskId: taskIdKeep,
                reminderMode,
                reminderEnabled,
                reminderOffsetMin: allDay ? null : reminderOffsetMin,
                notificationSchedules: sanitizeScheduleNotificationSchedules(prevItem?.notificationSchedules),
            };
        };

        const saveDraftScheduleItemFromModal = async () => {
            const draftItem = await buildDraftScheduleItemFromModal();
            if (!draftItem) return null;
            const list = await loadScheduleAll();
            const nextList = cloneScheduleList(list);
            const idx = nextList.findIndex((x) => String(x?.id || '') === scheduleId);
            if (idx < 0) {
                toast('⚠ 未找到日程', 'warning');
                return null;
            }
            nextList[idx] = {
                ...nextList[idx],
                ...draftItem,
                notificationSchedules: sanitizeScheduleNotificationSchedules(draftItem.notificationSchedules || nextList[idx]?.notificationSchedules),
            };
            await saveScheduleAll(nextList);
            try {
                const store = state.settingsStore;
                if (store && store.data) {
                    store.data.calendarDefaultCalendarId = String(draftItem.calendarId || calendarId0 || 'default').trim() || 'default';
                    if (store.data.calendarShowSchedule === false) store.data.calendarShowSchedule = true;
                    await store.save();
                }
            } catch (e2) {}
            try { refetchAllCalendars(); } catch (e2) {}
            return nextList[idx] || draftItem;
        };

        modal.addEventListener('click', async (e) => {
            const btn = findActionTarget(e?.target, 'data-tm-cal-action');
            const action = String(btn?.getAttribute?.('data-tm-cal-action') || '');
            if (!action) return;
            if (action === 'openDockHistory') {
                const dock = globalThis.__dockTomato;
                const dateKey = start ? formatDateKey(start) : '';
                if (dock && typeof dock.openHistory === 'function') {
                    dock.openHistory(dateKey || 'today');
                } else {
                    toast('⚠ 未检测到番茄钟插件', 'warning');
                }
                return;
            }
            if (action === 'jumpTask') {
                if (taskBlockId && globalThis.siyuan?.block?.scrollToBlock) {
                    try { globalThis.siyuan.block.scrollToBlock(taskBlockId); } catch (e2) {}
                } else {
                    toast('⚠ 无法跳转任务块', 'warning');
                }
                return;
            }
            if (!recordKey) {
                toast('⚠ 记录标识缺失', 'warning');
                return;
            }
            const dock = globalThis.__dockTomato;
            const history = dock?.history;
            if (!history || typeof history.updateTime !== 'function' || typeof history.delete !== 'function') {
                toast('⚠ 未检测到番茄钟历史编辑接口', 'warning');
                return;
            }
            if (action === 'delete') {
                const ok = await history.delete(recordKey);
                if (ok) {
                    closeModal();
                    state.calendar?.refetchEvents?.();
                    toast('✅ 已删除', 'success');
                } else {
                    toast('❌ 删除失败', 'error');
                }
                return;
            }
            if (action === 'save') {
                const s0 = getInputValue('start');
                const e0 = getInputValue('end');
                if (!s0 || !e0) {
                    toast('⚠ 开始/结束不能为空', 'warning');
                    return;
                }
                const nextStart = new Date(s0);
                const nextEnd = new Date(e0);
                if (Number.isNaN(nextStart.getTime()) || Number.isNaN(nextEnd.getTime()) || nextEnd.getTime() <= nextStart.getTime()) {
                    toast('⚠ 时间不合法', 'warning');
                    return;
                }
                const ok = await history.updateTime(recordKey, { start: nextStart.toISOString(), end: nextEnd.toISOString() });
                if (ok) {
                    closeModal();
                    state.calendar?.refetchEvents?.();
                    toast('✅ 已保存', 'success');
                } else {
                    toast('❌ 保存失败', 'error');
                }
            }
        }, { signal: abort.signal });
    }

    function openScheduleModal(params) {
        closeModal();
        const init = params && typeof params === 'object' ? params : {};
        const settings = getSettings();
        const calDefs = getCalendarDefs(settings);
        const scheduleId = String(init.id || '');
        const taskId0 = String(init.taskId || '').trim();
        const isEdit = !!scheduleId;
        const initAllDay = init.allDay === true;
        const reminderMode0 = String(init?.reminderMode || '').trim() === 'custom' ? 'custom' : 'inherit';
        const reminderEnabled0 = reminderMode0 === 'custom' ? (init?.reminderEnabled === true) : null;
        const reminderOffset0 = (() => {
            const n = Number(init?.reminderOffsetMin);
            const allowed = new Set([0, 5, 10, 15, 30, 60]);
            return (Number.isFinite(n) && allowed.has(n)) ? n : 0;
        })();
        const reminderSelect0 = (() => {
            if (reminderMode0 !== 'custom') return 'inherit';
            if (initAllDay) return reminderEnabled0 ? 'on' : 'off';
            if (!reminderEnabled0) return 'off';
            return String(reminderOffset0);
        })();
        const repeatType0 = getScheduleRepeatType(init);
        const repeatEvery0 = getScheduleRepeatEvery(init, repeatType0);
        const repeatUntil0 = getScheduleRepeatUntil(init);
        const repeatMonthlyMode0 = getScheduleRepeatMonthlyMode(init, repeatType0);
        const start = init.start instanceof Date ? init.start : null;
        const end = init.end instanceof Date ? init.end : null;
        const title0 = String(init.title || '').trim();
        const calendarId0 = String(init.calendarId || '').trim() || pickDefaultCalendarId(settings);
        const calDef0 = calDefs.find((d) => d.id === calendarId0) || calDefs[0] || { id: 'default', name: '时间轴', color: '#0078d4' };
        const color0 = String(init.color || '').trim() || String(calDef0.color || '#0078d4');
        const calendarOptions = calDefs.map((d) => `<option value="${esc(d.id)}" ${d.id === calendarId0 ? 'selected' : ''}>${esc(d.name)}</option>`).join('');
        const deviceSummary0 = isEdit ? getScheduleCurrentDeviceNotificationSummary(init) : '保存后会自动同步当前设备预约';

        const startLocal = start ? `${formatDateKey(start)}T${pad2(start.getHours())}:${pad2(start.getMinutes())}` : '';
        const endLocal = end ? `${formatDateKey(end)}T${pad2(end.getHours())}:${pad2(end.getMinutes())}` : '';

        const modal = document.createElement('div');
        modal.className = 'tm-calendar-edit-modal';
        modal.innerHTML = `
            <div class="tm-calendar-edit-box">
                <div class="tm-calendar-edit-title">${isEdit ? '编辑日程' : '新建日程'}</div>
                <div class="tm-calendar-edit-row">
                    <div class="tm-calendar-edit-label">标题</div>
                    <input class="tm-calendar-edit-input" type="text" value="${esc(title0)}" placeholder="请输入标题" data-tm-cal-field="title">
                </div>
                <div class="tm-calendar-edit-row">
                    <div class="tm-calendar-edit-label">日历</div>
                    <select class="tm-calendar-edit-input" data-tm-cal-field="calendarId">${calendarOptions}</select>
                </div>
                <div class="tm-calendar-edit-row">
                    <div class="tm-calendar-edit-label">开始</div>
                    <input class="tm-calendar-edit-input" type="datetime-local" value="${esc(startLocal)}" data-tm-cal-field="start">
                </div>
                <div class="tm-calendar-edit-row">
                    <div class="tm-calendar-edit-label">结束</div>
                    <input class="tm-calendar-edit-input" type="datetime-local" value="${esc(endLocal)}" data-tm-cal-field="end">
                </div>
                <div class="tm-calendar-edit-row">
                    <div class="tm-calendar-edit-label">颜色</div>
                    <input class="tm-calendar-edit-input" style="width:120px;flex:none;padding:0;height:30px" type="color" value="${esc(color0)}" data-tm-cal-field="color">
                    <div style="flex:1;"></div>
                </div>
                <div class="tm-calendar-edit-row">
                    <div class="tm-calendar-edit-label">提醒</div>
                    <select class="tm-calendar-edit-input" data-tm-cal-field="reminderSelect">
                        <option value="inherit" ${reminderSelect0 === 'inherit' ? 'selected' : ''}>使用全局设置</option>
                        <option value="off" ${reminderSelect0 === 'off' ? 'selected' : ''}>关闭提醒</option>
                        ${initAllDay ? `<option value="on" ${reminderSelect0 === 'on' ? 'selected' : ''}>开启提醒（当天统一时间）</option>` : `
                            <option value="0" ${reminderSelect0 === '0' ? 'selected' : ''}>准时提醒</option>
                            <option value="5" ${reminderSelect0 === '5' ? 'selected' : ''}>5 分钟前</option>
                            <option value="10" ${reminderSelect0 === '10' ? 'selected' : ''}>10 分钟前</option>
                            <option value="15" ${reminderSelect0 === '15' ? 'selected' : ''}>15 分钟前</option>
                            <option value="30" ${reminderSelect0 === '30' ? 'selected' : ''}>30 分钟前</option>
                            <option value="60" ${reminderSelect0 === '60' ? 'selected' : ''}>1 小时前</option>
                        `}
                    </select>
                </div>
                <div class="tm-calendar-edit-row">
                    <div class="tm-calendar-edit-label">循环</div>
                    <select class="tm-calendar-edit-input" data-tm-cal-field="repeatType">
                        <option value="none" ${repeatType0 === 'none' ? 'selected' : ''}>不循环</option>
                        <option value="daily" ${repeatType0 === 'daily' ? 'selected' : ''}>每天</option>
                        <option value="workday" ${repeatType0 === 'workday' ? 'selected' : ''}>工作日</option>
                        <option value="weekly" ${repeatType0 === 'weekly' ? 'selected' : ''}>每周</option>
                        <option value="monthly" ${repeatType0 === 'monthly' ? 'selected' : ''}>每月</option>
                        <option value="yearly" ${repeatType0 === 'yearly' ? 'selected' : ''}>每年</option>
                    </select>
                </div>
                <div class="tm-calendar-edit-row">
                    <div class="tm-calendar-edit-label">间隔</div>
                    <input class="tm-calendar-edit-input" type="number" min="1" step="1" value="${esc(String(repeatEvery0 || 1))}" data-tm-cal-field="repeatEvery" style="width:96px;flex:none;">
                    <div class="tm-calendar-edit-value" data-tm-cal-field="repeatEveryUnit" style="opacity:.85;">${esc(getScheduleRepeatUnitLabel(repeatType0, repeatEvery0))}</div>
                </div>
                <div class="tm-calendar-edit-row">
                    <div class="tm-calendar-edit-label">月规则</div>
                    <select class="tm-calendar-edit-input" data-tm-cal-field="repeatMonthlyMode" style="width:140px;flex:none;">
                        <option value="date" ${repeatMonthlyMode0 !== 'weekday' ? 'selected' : ''}>按日期</option>
                        <option value="weekday" ${repeatMonthlyMode0 === 'weekday' ? 'selected' : ''}>按星期</option>
                    </select>
                    <div class="tm-calendar-edit-value" data-tm-cal-field="repeatMonthlySummary" style="opacity:.85;">${esc(start ? `每月${getScheduleMonthlyWeekPatternLabel(start)}` : '根据开始时间自动计算')}</div>
                </div>
                <div class="tm-calendar-edit-row">
                    <div class="tm-calendar-edit-label">循环截止</div>
                    <input class="tm-calendar-edit-input" type="date" value="${esc(repeatUntil0)}" data-tm-cal-field="repeatUntil">
                </div>
                <div class="tm-calendar-edit-row">
                    <div class="tm-calendar-edit-label">当前设备预约</div>
                    <div class="tm-calendar-edit-value" data-tm-cal-field="deviceScheduleSummary" style="flex:1;line-height:1.4;opacity:.85;">${esc(deviceSummary0)}</div>
                    ${isEdit ? `<button class="tm-btn tm-btn-secondary" type="button" data-tm-cal-action="viewDeviceSchedule" style="margin-left:8px;">查看</button>` : ''}
                </div>
                <div class="tm-calendar-edit-actions">
                    <button class="tm-btn tm-btn-secondary" data-tm-cal-action="cancel">取消</button>
                    <div style="flex:1;"></div>
                    ${isEdit ? `<button class="tm-btn tm-btn-danger" data-tm-cal-action="delete">删除</button>` : ''}
                    <button class="tm-btn tm-btn-success" data-tm-cal-action="save">保存</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        state.modalEl = modal;

        const abort = new AbortController();
        state.uiAbort?.abort();
        state.uiAbort = abort;
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        }, { signal: abort.signal });
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        }, { signal: abort.signal });

        const getInputValue = (field) => {
            const el = modal.querySelector(`[data-tm-cal-field="${field}"]`);
            return el ? String(el.value || '').trim() : '';
        };
        const getStartDraft = () => {
            const raw = getInputValue('start');
            const dt = raw ? new Date(raw) : start;
            return (dt instanceof Date && !Number.isNaN(dt.getTime())) ? dt : start;
        };
        const syncColorToCalendar = () => {
            const calendarId = getInputValue('calendarId') || calendarId0 || 'default';
            const colorEl = modal.querySelector('[data-tm-cal-field="color"]');
            if (!(colorEl instanceof HTMLInputElement)) return;
            const defs = getCalendarDefs(getSettings());
            const def = defs.find((d) => String(d?.id || '').trim() === calendarId);
            const nextColor = String(def?.color || '#0078d4').trim() || '#0078d4';
            colorEl.value = nextColor;
        };
        const syncMonthlyModeSummary = () => {
            const monthlyModeEl = modal.querySelector('[data-tm-cal-field="repeatMonthlyMode"]');
            const summaryEl = modal.querySelector('[data-tm-cal-field="repeatMonthlySummary"]');
            if (!(monthlyModeEl instanceof HTMLSelectElement) || !summaryEl) return;
            const repeatType = normalizeScheduleRepeatType(getInputValue('repeatType') || repeatType0);
            const startDraft = getStartDraft();
            const isMonthly = repeatType === 'monthly';
            monthlyModeEl.disabled = !isMonthly;
            monthlyModeEl.style.opacity = isMonthly ? '1' : '0.55';
            if (!isMonthly) {
                summaryEl.textContent = '仅每月循环时生效';
                return;
            }
            const monthlyMode = normalizeScheduleRepeatMonthlyMode(monthlyModeEl.value || repeatMonthlyMode0, repeatType);
            if (!(startDraft instanceof Date) || Number.isNaN(startDraft.getTime())) {
                summaryEl.textContent = monthlyMode === 'weekday' ? '根据开始时间计算第 N 个星期几' : '根据开始时间确定每月日期';
                return;
            }
            summaryEl.textContent = monthlyMode === 'weekday'
                ? `每月${getScheduleMonthlyWeekPatternLabel(startDraft)}`
                : `每月${startDraft.getDate()}日`;
        };
        const calendarSelEl = modal.querySelector('[data-tm-cal-field="calendarId"]');
        if (calendarSelEl) {
            calendarSelEl.addEventListener('change', () => {
                syncColorToCalendar();
            }, { signal: abort.signal });
        }
        const syncRepeatRuleState = () => {
            const repeatType = normalizeScheduleRepeatType(getInputValue('repeatType') || repeatType0);
            const repeatEveryEl = modal.querySelector('[data-tm-cal-field="repeatEvery"]');
            const repeatEveryUnitEl = modal.querySelector('[data-tm-cal-field="repeatEveryUnit"]');
            const untilEl = modal.querySelector('[data-tm-cal-field="repeatUntil"]');
            if (!(untilEl instanceof HTMLInputElement)) return;
            const disabled = repeatType === 'none';
            if (repeatEveryEl instanceof HTMLInputElement) {
                repeatEveryEl.disabled = disabled;
                repeatEveryEl.style.opacity = disabled ? '0.55' : '1';
                if (!repeatEveryEl.value || Number(repeatEveryEl.value) <= 0) repeatEveryEl.value = String(repeatEvery0 || 1);
            }
            if (repeatEveryUnitEl) {
                repeatEveryUnitEl.textContent = disabled
                    ? '关闭循环时忽略'
                    : `每 ${getScheduleRepeatUnitLabel(repeatType, getInputValue('repeatEvery') || repeatEvery0)}`;
            }
            syncMonthlyModeSummary();
            untilEl.disabled = disabled;
            untilEl.style.opacity = disabled ? '0.55' : '1';
            if (disabled) untilEl.value = '';
        };
        const repeatTypeEl = modal.querySelector('[data-tm-cal-field="repeatType"]');
        if (repeatTypeEl) {
            repeatTypeEl.addEventListener('change', () => {
                syncRepeatRuleState();
            }, { signal: abort.signal });
        }
        const repeatEveryEl = modal.querySelector('[data-tm-cal-field="repeatEvery"]');
        if (repeatEveryEl) {
            repeatEveryEl.addEventListener('input', () => {
                syncRepeatRuleState();
            }, { signal: abort.signal });
        }
        const repeatMonthlyModeEl = modal.querySelector('[data-tm-cal-field="repeatMonthlyMode"]');
        if (repeatMonthlyModeEl) {
            repeatMonthlyModeEl.addEventListener('change', () => {
                syncMonthlyModeSummary();
            }, { signal: abort.signal });
        }
        const startEl = modal.querySelector('[data-tm-cal-field="start"]');
        if (startEl) {
            startEl.addEventListener('input', () => {
                syncMonthlyModeSummary();
            }, { signal: abort.signal });
        }
        syncRepeatRuleState();
        const readRepeatRuleFromModal = (nextStart) => {
            const repeatType = normalizeScheduleRepeatType(getInputValue('repeatType') || repeatType0);
            const repeatEvery = normalizeScheduleRepeatEvery(getInputValue('repeatEvery') || repeatEvery0, repeatType);
            const repeatUntil = repeatType === 'none' ? '' : normalizeScheduleRepeatUntil(getInputValue('repeatUntil'));
            const repeatMonthlyMode = normalizeScheduleRepeatMonthlyMode(getInputValue('repeatMonthlyMode') || repeatMonthlyMode0, repeatType);
            const startKey = nextStart instanceof Date && !Number.isNaN(nextStart.getTime()) ? formatDateKey(nextStart) : '';
            if (repeatType !== 'none' && repeatUntil && startKey && repeatUntil < startKey) {
                throw new Error('循环截止不能早于开始日期');
            }
            return { repeatType, repeatEvery, repeatUntil, repeatMonthlyMode };
        };

        modal.addEventListener('click', async (e) => {
            const btn = findActionTarget(e?.target, 'data-tm-cal-action');
            const action = String(btn?.getAttribute?.('data-tm-cal-action') || '');
            if (!action) return;
            if (action === 'cancel') {
                closeModal();
                return;
            }
            if (action === 'viewDeviceSchedule') {
                try { e.preventDefault?.(); } catch (e2) {}
                try { e.stopPropagation?.(); } catch (e2) {}
                if (!scheduleId) {
                    toast('请先保存日程后再查看', 'warning');
                    return;
                }
                const title = getInputValue('title');
                const calendarId = getInputValue('calendarId') || calendarId0 || 'default';
                const s0 = getInputValue('start');
                const e0 = getInputValue('end');
                const color = getInputValue('color') || '#0078d4';
                const nextStart = s0 ? new Date(s0) : null;
                const nextEnd = e0 ? new Date(e0) : null;
                const canUseInputTime = !!(
                    nextStart instanceof Date
                    && nextEnd instanceof Date
                    && !Number.isNaN(nextStart.getTime())
                    && !Number.isNaN(nextEnd.getTime())
                    && nextEnd.getTime() > nextStart.getTime()
                );
                const repeatDraft = canUseInputTime
                    ? readRepeatRuleFromModal(nextStart)
                    : { repeatType: repeatType0, repeatEvery: repeatEvery0, repeatUntil: repeatUntil0, repeatMonthlyMode: repeatMonthlyMode0 };
                const currentViewItem = {
                    ...(init && typeof init === 'object' ? init : {}),
                    id: scheduleId,
                    title: title || title0 || '日程',
                    start: canUseInputTime ? safeISO(nextStart) : (init?.start instanceof Date ? safeISO(init.start) : String(init?.start || '')),
                    end: canUseInputTime ? safeISO(nextEnd) : (init?.end instanceof Date ? safeISO(init.end) : String(init?.end || '')),
                    allDay: canUseInputTime ? isAllDayRange(nextStart, nextEnd) || (initAllDay && isAllDayRange(nextStart, nextEnd)) : !!initAllDay,
                    color,
                    calendarId,
                    taskId: String(taskId0 || init?.taskId || '').trim(),
                    repeatType: repeatDraft.repeatType,
                    repeatEvery: repeatDraft.repeatEvery,
                    repeatUntil: repeatDraft.repeatUntil,
                    repeatMonthlyMode: repeatDraft.repeatMonthlyMode,
                    notificationSchedules: sanitizeScheduleNotificationSchedules(
                        init?.notificationSchedules
                    ),
                };
                try {
                    showScheduleDeviceScheduleDialog(currentViewItem, {
                        resolveLatestItem: async () => {
                            const titleNow = getInputValue('title');
                            const calendarIdNow = getInputValue('calendarId') || calendarId0 || 'default';
                            const startRaw = getInputValue('start');
                            const endRaw = getInputValue('end');
                            const colorNow = getInputValue('color') || '#0078d4';
                            const reminderSelectNow = String(getInputValue('reminderSelect') || '').trim() || 'inherit';
                            const reminderModeNow = reminderSelectNow === 'inherit' ? 'inherit' : 'custom';
                            const reminderEnabledNow = (() => {
                                if (reminderSelectNow === 'inherit') return null;
                                if (reminderSelectNow === 'off') return false;
                                return true;
                            })();
                            const reminderOffsetMinNow = (() => {
                                if (reminderSelectNow === 'inherit' || reminderSelectNow === 'off') return null;
                                if (initAllDay) return null;
                                const n = Number(reminderSelectNow);
                                const allowed = new Set([0, 5, 10, 15, 30, 60]);
                                return (Number.isFinite(n) && allowed.has(n)) ? n : 0;
                            })();
                            if (!startRaw || !endRaw) {
                                throw new Error('开始/结束不能为空');
                            }
                            const nextStart2 = new Date(startRaw);
                            const nextEnd2 = new Date(endRaw);
                            if (Number.isNaN(nextStart2.getTime()) || Number.isNaN(nextEnd2.getTime()) || nextEnd2.getTime() <= nextStart2.getTime()) {
                                throw new Error('时间不合法');
                            }
                            const repeatDraft2 = readRepeatRuleFromModal(nextStart2);
                            const list = await loadScheduleAll();
                            const nextList = cloneScheduleList(list);
                            const idx = nextList.findIndex((x) => String(x?.id || '') === scheduleId);
                            if (idx < 0) return null;
                            const prevItem = nextList[idx] || {};
                            const taskIdKeep = String(taskId0 || prevItem?.taskId || prevItem?.task_id || prevItem?.linkedTaskId || prevItem?.linked_task_id || '').trim();
                            const draftItem = {
                                ...prevItem,
                                id: scheduleId,
                                title: titleNow || '日程',
                                start: safeISO(nextStart2),
                                end: safeISO(nextEnd2),
                                allDay: isAllDayRange(nextStart2, nextEnd2) || (initAllDay && isAllDayRange(nextStart2, nextEnd2)),
                                color: colorNow,
                                calendarId: calendarIdNow,
                                taskId: taskIdKeep,
                                reminderMode: reminderModeNow,
                                reminderEnabled: reminderEnabledNow,
                                reminderOffsetMin: (isAllDayRange(nextStart2, nextEnd2) || (initAllDay && isAllDayRange(nextStart2, nextEnd2))) ? null : reminderOffsetMinNow,
                                repeatType: repeatDraft2.repeatType,
                                repeatEvery: repeatDraft2.repeatEvery,
                                repeatUntil: repeatDraft2.repeatUntil,
                                repeatMonthlyMode: repeatDraft2.repeatMonthlyMode,
                                notificationSchedules: sanitizeScheduleNotificationSchedules(prevItem?.notificationSchedules),
                            };
                            nextList[idx] = {
                                ...nextList[idx],
                                ...draftItem,
                                notificationSchedules: sanitizeScheduleNotificationSchedules(
                                    draftItem.notificationSchedules || nextList[idx]?.notificationSchedules
                                ),
                            };
                            await saveScheduleAll(nextList);
                            return await refreshScheduleCurrentDeviceNotificationDraft(nextList[idx]);
                        },
                    });
                } catch (err) {
                    console.error('[task-horizon] open device schedule dialog failed', err);
                    toast('❌ 打开预约详情失败', 'error');
                }
                return;
            }
            if (action === 'delete') {
                if (!scheduleId) return;
                await deleteScheduleById(scheduleId, { closeModal: true });
                toast('✅ 已删除', 'success');
                return;
            }
            if (action === 'save') {
                const title = getInputValue('title');
                const calendarId = getInputValue('calendarId') || calendarId0 || 'default';
                const s0 = getInputValue('start');
                const e0 = getInputValue('end');
                const color = getInputValue('color') || '#0078d4';
                const reminderSelect = String(getInputValue('reminderSelect') || '').trim() || 'inherit';
                const reminderMode = reminderSelect === 'inherit' ? 'inherit' : 'custom';
                const reminderEnabled = (() => {
                    if (reminderSelect === 'inherit') return null;
                    if (reminderSelect === 'off') return false;
                    return true;
                })();
                const reminderOffsetMin = (() => {
                    if (reminderSelect === 'inherit' || reminderSelect === 'off') return null;
                    if (initAllDay) return null;
                    const n = Number(reminderSelect);
                    const allowed = new Set([0, 5, 10, 15, 30, 60]);
                    return (Number.isFinite(n) && allowed.has(n)) ? n : 0;
                })();
                if (!s0 || !e0) {
                    toast('⚠ 开始/结束不能为空', 'warning');
                    return;
                }
                const nextStart = new Date(s0);
                const nextEnd = new Date(e0);
                if (Number.isNaN(nextStart.getTime()) || Number.isNaN(nextEnd.getTime()) || nextEnd.getTime() <= nextStart.getTime()) {
                    toast('⚠ 时间不合法', 'warning');
                    return;
                }
                let repeatDraft;
                try {
                    repeatDraft = readRepeatRuleFromModal(nextStart);
                } catch (err) {
                    toast(`⚠ ${String(err?.message || err || '')}`, 'warning');
                    return;
                }
                const allDay = isAllDayRange(nextStart, nextEnd) || (initAllDay && isAllDayRange(nextStart, nextEnd));
                const id = scheduleId || uuid();
                const list = await loadScheduleAll();
                const idx = list.findIndex((x) => String(x?.id || '') === id);
                const prevItem = idx >= 0 ? list[idx] : null;
                const taskIdKeep = String(taskId0 || prevItem?.taskId || prevItem?.task_id || prevItem?.linkedTaskId || prevItem?.linked_task_id || '').trim();
                const base = (prevItem && typeof prevItem === 'object') ? prevItem : {};
                const item = {
                    ...base,
                    id,
                    title: title || '日程',
                    start: safeISO(nextStart),
                    end: safeISO(nextEnd),
                    allDay,
                    color,
                    calendarId,
                    taskId: taskIdKeep,
                    reminderMode,
                    reminderEnabled,
                    reminderOffsetMin: allDay ? null : reminderOffsetMin,
                    repeatType: repeatDraft.repeatType,
                    repeatEvery: repeatDraft.repeatEvery,
                    repeatUntil: repeatDraft.repeatUntil,
                    repeatMonthlyMode: repeatDraft.repeatMonthlyMode,
                };
                if (idx >= 0) list[idx] = item;
                else list.push(item);
                await saveScheduleAll(list);
                try {
                    const store = state.settingsStore;
                    if (store && store.data) {
                        store.data.calendarDefaultCalendarId = calendarId;
                        if (store.data.calendarShowSchedule === false) store.data.calendarShowSchedule = true;
                        await store.save();
                    }
                } catch (e2) {}
                closeModal();
                refetchAllCalendars();
                try {
                    const cal = state.calendar;
                    const vt = String(cal?.view?.type || '');
                    if (cal && vt === 'dayGridMonth') {
                        const d = cal.getDate?.();
                        if (d) requestAnimationFrame(() => { try { cal.changeView('dayGridMonth', d); } catch (e3) {} });
                    }
                } catch (e2) {}
                try { setTimeout(() => { try { refetchAllCalendars(); } catch (e3) {} }, 380); } catch (e2) {}
                toast('✅ 已保存', 'success');
            }
        }, { signal: abort.signal });
    }

    function scheduleTomatoRefetch() {
        if (!state.calendar) return;
        if (state.tomatoRefetchTimer) return;
        state.tomatoRefetchTimer = setTimeout(() => {
            state.tomatoRefetchTimer = null;
            try { state.calendar?.refetchEvents?.(); } catch (e) {}
        }, 120);
    }

    function stabilizeCalendarLayout(cal, wrap, opt) {
        const hard = !!opt?.hard;
        const run = () => {
            try { cal.updateSize(); } catch (e3) {}
            try { applyCnHolidayDots(wrap); } catch (e3) {}
            try { applyCnLunarLabels(wrap); } catch (e3) {}
            try {
                const root = wrap || state.wrapEl || null;
                if (root && root.querySelectorAll) {
                    const nodes = root.querySelectorAll('.fc-daygrid-body-natural .fc-daygrid-day-events');
                    nodes.forEach((el) => {
                        try { el.style.marginBottom = '0'; } catch (e) {}
                    });
                }
            } catch (e3) {}
        };
        try { requestAnimationFrame(run); } catch (e2) {}
        if (hard) {
            try { setTimeout(run, 120); } catch (e2) {}
            try { setTimeout(run, 320); } catch (e2) {}
        }
    }

    function refreshInPlace(options) {
        const opt = (options && typeof options === 'object') ? options : {};
        const wrap = state.wrapEl;
        const cal = state.calendar;
        if (!wrap || !cal) return false;
        try { ensureFcCompactAllDayStyle(); } catch (e) {}
        if (opt.layoutOnly !== true) {
            try { renderTaskPage(wrap, getSettings()); } catch (e2) {}
            try { cal.refetchEvents(); } catch (e2) {}
        }
        try { applyCalendarSlotHeightStyle(wrap, getSettings()); } catch (e) {}
        stabilizeCalendarLayout(cal, wrap, opt);
        return true;
    }

    function refreshSideDayLayout() {
        const rootEl = state.sideDay?.rootEl;
        const cal = state.sideDay?.calendar;
        if (!(rootEl instanceof HTMLElement) || !cal) return false;
        try { syncSideDayLayout(rootEl, cal, getSettings()); } catch (e) {}
        try {
            requestAnimationFrame(() => {
                try { syncSideDayLayout(rootEl, cal, getSettings()); } catch (e2) {}
            });
        } catch (e) {}
        try { setTimeout(() => { try { syncSideDayLayout(rootEl, cal, getSettings()); } catch (e2) {} }, 0); } catch (e) {}
        return true;
    }

    function mount(rootEl, opts) {
        if (!rootEl || !(rootEl instanceof Element)) return false;
        if (!globalThis.FullCalendar || !globalThis.FullCalendar.Calendar) return false;
        unmount();

        try { ensureFcCompactAllDayStyle(); } catch (e) {}
        state.mounted = true;
        state.rootEl = rootEl;
        state.opts = opts || {};
        state.settingsStore = state.opts.settingsStore || null;
        const hostForcesMobileUi = (() => {
            try { if (globalThis.__taskHorizonForceMobileUI === true) return true; } catch (e) {}
            try {
                const local = String(rootEl?.dataset?.tmUiMode || '').trim();
                if (local === 'mobile') return true;
            } catch (e) {}
            try {
                const bodyMode = String(document.body?.dataset?.tmUiMode || '').trim();
                if (bodyMode === 'mobile') return true;
            } catch (e) {}
            try {
                const frameMode = String(window.frameElement?.dataset?.tmUiMode || '').trim();
                if (frameMode === 'mobile') return true;
            } catch (e) {}
            return false;
        })();
        const isMobileDevice = hostForcesMobileUi || !!globalThis.__taskHorizonPluginIsMobile || (() => {
            try { return !!window.matchMedia?.('(pointer: coarse)')?.matches; } catch (e) { return false; }
        })();
        const isDockHost = (() => {
            try {
                const local = String(rootEl?.dataset?.tmHostMode || '').trim();
                if (local === 'dock') return true;
            } catch (e) {}
            try {
                const hostEl = rootEl?.closest?.('[data-tm-host-mode]');
                const hostMode = String(hostEl?.getAttribute?.('data-tm-host-mode') || '').trim();
                if (hostMode === 'dock') return true;
            } catch (e) {}
            try {
                const bodyMode = String(document.body?.dataset?.tmHostMode || '').trim();
                if (bodyMode === 'dock') return true;
            } catch (e) {}
            try {
                const frameMode = String(window.frameElement?.dataset?.tmHostMode || '').trim();
                if (frameMode === 'dock') return true;
            } catch (e) {}
            try {
                return String(globalThis.__taskHorizonHostMode || '').trim() === 'dock';
            } catch (e) {
                return false;
            }
        })();
        state.isMobileDevice = !!isMobileDevice;
        try {
            Promise.resolve().then(() => globalThis.tmCalendarWarmDocsToGroupCache?.()).catch(() => null);
        } catch (e) {}
        try {
            rootEl.style.height = '100%';
            rootEl.style.minHeight = '0';
        } catch (e) {}

        const wrap = document.createElement('div');
        wrap.className = 'tm-calendar-wrap' + (isMobileDevice ? ' tm-calendar-wrap--mobile' : '');
        wrap.innerHTML = `
            <div class="tm-calendar-layout">
                <div class="tm-calendar-sidebar">
                    <div class="tm-calendar-sidebar-inner">
                        <div class="tm-calendar-side-tabs">
                            <button class="tm-calendar-side-tab tm-calendar-side-tab--active" data-tm-cal-side-tab="calendar">日历</button>
                            <button class="tm-calendar-side-tab" data-tm-cal-side-tab="tasks">任务</button>
                        </div>
                        <div class="tm-calendar-side-page" data-tm-cal-side-page="calendar">
                            <div class="tm-calendar-mini"></div>
                            <div class="tm-calendar-nav">
                                <div class="tm-calendar-nav-section">
                                    <div class="tm-calendar-nav-header" data-tm-cal-collapse="calendars">
                                        <span>我的日历</span>
                                        <span class="tm-calendar-nav-header-actions">
                                            <input class="tm-calendar-nav-master-check" type="checkbox" data-tm-cal-master="schedule">
                                            <span class="tm-calendar-nav-chevron"></span>
                                        </span>
                                    </div>
                                    <div class="tm-calendar-nav-list" data-tm-cal-role="calendar-list"></div>
                                </div>
                                <div class="tm-calendar-nav-section">
                                    <div class="tm-calendar-nav-header" data-tm-cal-collapse="tomato">
                                        <span>番茄</span>
                                        <span class="tm-calendar-nav-header-actions">
                                            <input class="tm-calendar-nav-master-check" type="checkbox" data-tm-cal-master="tomato">
                                            <span class="tm-calendar-nav-chevron"></span>
                                        </span>
                                    </div>
                                    <div class="tm-calendar-nav-list" data-tm-cal-role="tomato-list"></div>
                                </div>
                            </div>
                        </div>
                        <div class="tm-calendar-side-page" data-tm-cal-side-page="tasks" data-tm-cal-role="task-page" style="display:none; flex:1; overflow:hidden; flex-direction:column; min-height:0;">
                            <div class="tm-calendar-task-table-wrap" style="flex:1; overflow:hidden; display:flex; flex-direction:column; min-height:0;">
                                <div class="tm-calendar-task-table" data-tm-cal-role="task-table" style="flex:1; overflow:auto; min-height:0;"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="tm-calendar-sidebar-resizer" data-tm-cal-role="sidebar-resizer"></div>
                <div class="tm-calendar-mobile-backdrop" data-tm-cal-action="closeSidebar"></div>
                <div class="tm-calendar-main">
                    <div class="tm-calendar-host"></div>
                </div>
            </div>
        `;
        rootEl.appendChild(wrap);
        const host = wrap.querySelector('.tm-calendar-host');
        state.calendarEl = host;
        let _tmClickTracker = { x: 0, y: 0, ts: 0 };
        wrap.addEventListener('mousedown', (e) => {
            _tmClickTracker = { x: e.clientX, y: e.clientY, ts: Date.now() };
        }, true);
        const miniHost = wrap.querySelector('.tm-calendar-mini');
        state.miniCalendarEl = miniHost;
        const s = getSettings();
        try { applyCalendarSlotHeightStyle(wrap, s); } catch (e) {}
        try {
            const sidebar = wrap.querySelector('.tm-calendar-sidebar');
            const w = Number(s.sidebarWidth) || 280;
            if (sidebar) sidebar.style.width = `${Math.max(220, Math.min(560, w))}px`;
        } catch (e) {}
        renderSidebar(wrap, s);
        renderTaskPage(wrap, s);
        setSidePage(wrap, state.sidePage);
        if (isMobileDevice || isDockHost) setCalendarSidebarOpen(wrap, false);
        else setCalendarSidebarOpen(wrap, true);
        bindSidebarResize(wrap);
        let calendar = null;
        const preferredInitialView = (() => {
            if (isMobileDevice) return 'timeGridDay';
            const v = String(s.lastViewType || '').trim();
            if (v && MAIN_CALENDAR_ALLOWED_VIEWS.has(v)) return v;
            return 'timeGridWeek';
        })();
        const preferredInitialDate = (() => {
            const explicit = parseDateOnly(state.opts?.date || state.opts?.initialDate);
            if (explicit) return explicit;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return today;
        })();
        const slotLayout = getTimeGridSlotLayoutOptions(s);
        calendar = new FullCalendar.Calendar(host, {
            initialView: preferredInitialView,
            initialDate: preferredInitialDate,
            views: MAIN_CALENDAR_CUSTOM_VIEWS,
            height: 'parent',
            expandRows: true,
            handleWindowResize: true,
            locale: 'zh-cn',
            firstDay: Number(s.firstDay) === 0 ? 0 : 1,
            weekText: '周',
            allDayText: '全天',
            moreLinkText: (n) => `+${n} 更多`,
            noEventsText: '暂无记录',
            buttonText: {
                today: '今天',
                month: '月',
                week: '周',
                day: '日',
                timeGrid3Day: '3日',
                timeGridWorkdays: '工作日',
                list: '列表',
            },
            nowIndicator: true,
            slotEventOverlap: false,
            dayMaxEvents: true,
            moreLinkClick: 'popover',
            stickyHeaderDates: true,
            lazyFetching: false,
            ...slotLayout,
            headerToolbar: {
                left: 'prev today next',
                center: 'title',
                right: 'timeGridDay,timeGrid3Day,timeGridWorkdays,timeGridWeek,dayGridMonth',
            },
            eventDisplay: 'block',
            eventContent: (arg) => {
                const ext = arg?.event?.extendedProps || {};
                const source = String(ext.__tmSource || '').trim();
                const hideRangeText = String(arg?.view?.type || '').trim() === 'dayGridMonth';
                if (source === 'taskdate' || (source === 'schedule' && String(ext.__tmTaskId || '').trim())) {
                    const tid = String(ext.__tmTaskId || '').trim();
                    const done = (() => {
                        if (!tid) return false;
                        if (typeof window.tmIsTaskDone !== 'function') return false;
                        try { return !!window.tmIsTaskDone(tid); } catch (e) { return false; }
                    })();
                    const wrapEl = document.createElement('span');
                    wrapEl.className = source === 'schedule' ? 'tm-cal-task-event tm-cal-task-event--schedule' : 'tm-cal-task-event';
                    wrapEl.oncontextmenu = (ev) => {
                        try { ev.stopPropagation(); } catch (e) {}
                        try { ev.preventDefault(); } catch (e) {}
                        if (tid && typeof window.tmShowTaskContextMenu === 'function') {
                            const sid0 = String(ext.__tmScheduleId || '').trim();
                            try {
                                if (source === 'schedule' && sid0) window.tmShowTaskContextMenu(ev, tid, { scheduleId: sid0, title: String(arg?.event?.title || '').trim(), start: arg?.event?.start, end: arg?.event?.end });
                                else if (source === 'taskdate') window.tmShowTaskContextMenu(ev, tid, { taskDateStartKey: String(ext.__tmTaskDateStartKey || '').trim(), taskDateEndExclusiveKey: String(ext.__tmTaskDateEndExclusiveKey || '').trim(), calendarId: String(ext.calendarId || 'default').trim(), title: String(arg?.event?.title || '').trim() });
                                else window.tmShowTaskContextMenu(ev, tid);
                            } catch (e) {}
                        }
                        return false;
                    };
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.className = 'tm-cal-task-event-check';
                    cb.checked = done;
                    applyTaskEventCheckboxOffset(cb);
                    cb.onchange = async (ev) => {
                        try { ev.stopPropagation(); } catch (e) {}
                        try { ev.preventDefault(); } catch (e) {}
                        if (!tid || typeof window.tmSetDone !== 'function') return;
                        const nextDone = cb.checked === true;
                        applyTaskDoneVisual(wrapEl, titleText, nextDone);
                        try {
                            const r = window.tmSetDone(tid, nextDone, ev);
                            if (r && typeof r.then === 'function') await r;
                        } catch (e) {}
                        try { state.calendar?.refetchEvents?.(); } catch (e) {}
                    };
                    const rangeText = !hideRangeText && source === 'schedule'
                        ? formatScheduleEventRangeText(arg?.event?.start, arg?.event?.end, arg?.event?.allDay === true)
                        : '';
                    const { title, titleText } = buildTaskEventTitleNode(String(arg?.event?.title || '').trim() || '任务', rangeText);
                    applyTaskEventTitleClamp(wrapEl, title);
                    applyTaskDoneVisual(wrapEl, titleText, done);
                    titleText.onclick = (ev) => {
                        if (_tmClickTracker && _tmClickTracker.ts > 0) {
                            const dur = Date.now() - _tmClickTracker.ts;
                            const x = Number(ev.clientX);
                            const y = Number(ev.clientY);
                            if (Number.isFinite(x) && Number.isFinite(y)) {
                                const dx = Math.abs(x - _tmClickTracker.x);
                                const dy = Math.abs(y - _tmClickTracker.y);
                                const dist = Math.sqrt(dx * dx + dy * dy);
                                if (dur > 500 || dist > 5) return;
                            }
                        }
                        if (!tid || typeof window.tmJumpToTask !== 'function') return;
                        try { window.tmJumpToTask(tid, ev); } catch (e) {}
                    };
                    wrapEl.appendChild(cb);
                    wrapEl.appendChild(title);
                    return { domNodes: [wrapEl] };
                }
                if (source === 'schedule') {
                    const wrapEl = document.createElement('span');
                    wrapEl.className = 'tm-cal-schedule-stack';
                    const { title } = buildTaskEventTitleNode(
                        String(arg?.event?.title || '').trim() || '日程',
                        hideRangeText ? '' : formatScheduleEventRangeText(arg?.event?.start, arg?.event?.end, arg?.event?.allDay === true)
                    );
                    applyTaskEventTitleClamp(wrapEl, title);
                    wrapEl.appendChild(title);
                    return { domNodes: [wrapEl] };
                }
                if (source === 'reminder') {
                    const wrapEl = document.createElement('span');
                    wrapEl.className = source === 'schedule' ? 'tm-cal-task-event tm-cal-task-event--schedule' : 'tm-cal-task-event';
                    const tid = String(ext.__tmReminderBlockId || '').trim();
                    const { title, titleText } = buildTaskEventTitleNode(String(arg?.event?.title || '').trim() || '任务提醒');
                    applyTaskEventTitleClamp(wrapEl, title);
                    applyTaskDoneVisual(wrapEl, titleText, !!ext.__tmReminderDone);
                    titleText.onclick = (ev) => {
                        if (_tmClickTracker && _tmClickTracker.ts > 0) {
                            const dur = Date.now() - _tmClickTracker.ts;
                            const x = Number(ev.clientX);
                            const y = Number(ev.clientY);
                            if (Number.isFinite(x) && Number.isFinite(y)) {
                                const dx = Math.abs(x - _tmClickTracker.x);
                                const dy = Math.abs(y - _tmClickTracker.y);
                                const dist = Math.sqrt(dx * dx + dy * dy);
                                if (dur > 500 || dist > 5) return;
                            }
                        }
                        if (!tid || typeof window.tmJumpToTask !== 'function') return;
                        try { window.tmJumpToTask(tid, ev); } catch (e) {}
                    };
                    wrapEl.appendChild(title);
                    return { domNodes: [wrapEl] };
                }
                if (source !== 'cnHoliday') return true;
                const type = Number(ext.__tmCnHolidayType);
                const name = normalizeCnHolidayName(String(ext.__tmCnHolidayName || '').trim());
                if (!name) return true;
                if (type === 0) return true;
                if (type !== 2 && type !== 3 && type !== 4) return true;
                const isWork = type === 4;
                const pill = document.createElement('span');
                pill.className = `tm-cn-holiday-pill ${isWork ? 'tm-cn-holiday-pill--work' : 'tm-cn-holiday-pill--rest'}`;
                const badge = document.createElement('span');
                badge.className = 'tm-cn-holiday-badge';
                badge.textContent = isWork ? '班' : '休';
                pill.appendChild(badge);
                if (name) {
                    const label = document.createElement('span');
                    label.className = 'tm-cn-holiday-label';
                    label.textContent = name;
                    pill.appendChild(label);
                }
                pill.title = `${isWork ? '上班' : '休息'}${name ? `：${name}` : ''}`;
                return { domNodes: [pill] };
            },
            eventDidMount: (arg) => {
                try {
                    const ext = arg?.event?.extendedProps || {};
                    const source = String(ext.__tmSource || '').trim();
                    try {
                        const el = arg?.el;
                        if (el && el instanceof Element) {
                            applyCalendarEventClampFromRoot(el);
                            const eid = String(arg?.event?.id || '').trim();
                            if (eid) el.setAttribute('data-tm-cal-event-id', eid);
                            if (source) el.setAttribute('data-tm-cal-source', source);
                            if (source === 'schedule' || source === 'tomato' || arg?.isMirror) applyScheduleEventColorVars(el, String(arg?.event?.backgroundColor || arg?.event?.borderColor || '#0078d4'));
                            if ((source === 'schedule' || source === 'taskdate') && arg?.event?.allDay === true) applyAllDaySoftEventColorVars(el, String(arg?.event?.backgroundColor || arg?.event?.borderColor || '#0078d4'));
                            const aggDay = String(ext.__tmAggregateDay || '').trim();
                            if (aggDay) el.setAttribute('data-tm-cal-agg-day', aggDay);
                            const tid = String(ext.__tmTaskId || '').trim();
                            if (tid) el.setAttribute('data-tm-cal-task-id', tid);
                            const rid = String(ext.__tmReminderBlockId || '').trim();
                            if (rid) el.setAttribute('data-tm-cal-reminder-id', rid);
                            const sid = String(ext.__tmScheduleId || '').trim();
                            if (sid) el.setAttribute('data-tm-cal-schedule-id', sid);
                            const calId = String(ext.calendarId || '').trim();
                            if (calId) el.setAttribute('data-tm-cal-calendar-id', calId);
                            const recordKey = String(ext.__tmRecordKey || '').trim();
                            if (recordKey) el.setAttribute('data-tm-cal-record-key', recordKey);
                        }
                    } catch (e0) {}
                    if (source === 'schedule') {
                        const sid = String(ext.__tmScheduleId || '').trim();
                        const tid = String(ext.__tmTaskId || '').trim();
                        const el = arg?.el;
                        if (sid && el && !el.__tmScheduleCtxBound) {
                            el.__tmScheduleCtxBound = true;
                            el.addEventListener('contextmenu', (ev) => {
                                try {
                                    try { ev.stopPropagation(); } catch (e2) {}
                                    try { ev.preventDefault(); } catch (e2) {}
                                    if (tid && typeof window.tmShowTaskContextMenu === 'function') {
                                        window.tmShowTaskContextMenu(ev, tid, {
                                            scheduleId: sid,
                                            title: String(arg?.event?.title || '').trim(),
                                            start: arg?.event?.start,
                                            end: arg?.event?.end,
                                        });
                                        return;
                                    }
                                    showScheduleEventContextMenu(ev, {
                                        scheduleId: sid,
                                        taskId: tid,
                                        title: String(arg?.event?.title || '').trim(),
                                        start: arg?.event?.start,
                                        end: arg?.event?.end,
                                    });
                                } catch (e) {}
                            });
                        }
                    }
                    if (source === 'taskdate') {
                        const tid = String(ext.__tmTaskId || '').trim();
                        const el = arg?.el;
                        if (tid && el && !el.__tmTaskCtxBound) {
                            el.__tmTaskCtxBound = true;
                            el.addEventListener('contextmenu', (ev) => {
                                try { ev.stopPropagation(); } catch (e) {}
                                try { ev.preventDefault(); } catch (e) {}
                                if (typeof window.tmShowTaskContextMenu === 'function') {
                                    const sid0 = String(ext.__tmScheduleId || '').trim();
                                    try {
                                        if (source === 'schedule' && sid0) window.tmShowTaskContextMenu(ev, tid, { scheduleId: sid0, title: String(arg?.event?.title || '').trim(), start: arg?.event?.start, end: arg?.event?.end });
                                        else if (source === 'taskdate') window.tmShowTaskContextMenu(ev, tid, { taskDateStartKey: String(ext.__tmTaskDateStartKey || '').trim(), taskDateEndExclusiveKey: String(ext.__tmTaskDateEndExclusiveKey || '').trim(), calendarId: String(ext.calendarId || 'default').trim(), title: String(arg?.event?.title || '').trim() });
                                        else window.tmShowTaskContextMenu(ev, tid);
                                    } catch (e) {}
                                }
                            });
                        }
                    }
                    if (String(ext.__tmSource || '').trim() !== 'tomato') return;
                    const s2 = getSettings();
                    if (!s2.monthAggregate) return;
                    const vt = String(arg?.view?.type || state._lastViewType || '').trim();
                    if (vt !== 'dayGridMonth') return;
                    if (arg?.el) arg.el.style.display = 'none';
                } catch (e) {}
            },
            eventOrder: '__tmRank,title',
            eventOrderStrict: true,
            eventClassNames: (arg) => {
                if (arg?.isMirror) return ['tm-cal-selection-mirror', 'tm-cal-schedule-event'];
                return [];
            },
            editable: true,
            eventStartEditable: true,
            eventDurationEditable: true,
            eventResizableFromStart: true,
            longPressDelay: isMobileDevice ? 150 : undefined,
            eventLongPressDelay: isMobileDevice ? 150 : undefined,
            selectLongPressDelay: isMobileDevice ? 150 : undefined,
            eventDragMinDistance: isMobileDevice ? 0 : undefined,
            selectable: true,
            selectMirror: true,
            scrollTimeReset: false,
            droppable: true,
            dropAccept: '.tm-cal-task, tr[data-id], .tm-kanban-card[data-id]',
            eventReceive: async (info) => {
                try {
                    const ext = info?.event?.extendedProps || {};
                    const taskId = String(ext.__tmTaskId || '').trim();
                    const start = info?.event?.start;
                    let end = info?.event?.end;
                    const settings = getSettings();
                    const durMin = clampNewScheduleDurationMin(Number(ext.__tmDurationMin), settings);
                    if (!(start instanceof Date) || Number.isNaN(start.getTime())) return;
                    if (!(end instanceof Date) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
                        end = new Date(start.getTime() + durMin * 60000);
                    }
                    const calendarId = String(ext.calendarId || '').trim() || pickDefaultCalendarId(settings);
                    const title = String(info?.event?.title || '').trim() || '任务';
                    const item = {
                        id: uuid(),
                        title,
                        start: safeISO(start),
                        end: safeISO(end),
                        color: '',
                        calendarId,
                        taskId,
                    };
                    const list = await loadScheduleAll();
                    list.push(item);
                    await saveScheduleAll(list);
                    try { info?.event?.remove?.(); } catch (e2) {}
                    try { state.calendar?.refetchEvents?.(); } catch (e2) {}
                    try {
                        const store = state.settingsStore;
                        if (store && store.data) {
                            if (store.data.calendarShowSchedule === false) store.data.calendarShowSchedule = true;
                            await store.save();
                        }
                    } catch (e2) {}
                    toast('✅ 已加入日程', 'success');
                } catch (e) {
                    try { info?.revert?.(); } catch (e2) {}
                }
            },
            events: async (info, success, failure) => {
                try {
                    const viewType = String((calendar && calendar.view && calendar.view.type) || state._lastViewType || 'timeGridWeek');
                    const startMs = toMs(info?.start);
                    const endMs = toMs(info?.end);
                    const settings = getSettings();
                    const tomatoKey = [
                        String(viewType || ''),
                        formatDateKey(info?.start),
                        formatDateKey(info?.end),
                        settings.monthAggregate ? 'agg1' : 'agg0',
                        settings.showTomatoMaster ? 'tm1' : 'tm0',
                        settings.showFocus ? 'f1' : 'f0',
                        settings.showBreak ? 'b1' : 'b0',
                        settings.showStopwatch ? 's1' : 's0',
                        settings.showIdle ? 'i1' : 'i0',
                        settings.linkDockTomato ? 'link1' : 'link0',
                    ].join('|');
                    const years = (() => {
                        const y1 = info?.start instanceof Date ? info.start.getFullYear() : null;
                        const y2 = info?.end instanceof Date ? info.end.getFullYear() : null;
                        const set = new Set();
                        if (Number.isFinite(y1)) set.add(y1);
                        if (Number.isFinite(y2)) set.add(y2);
                        return Array.from(set.values()).filter((x) => Number.isFinite(Number(x)));
                    })();
                    const [records, schedules, taskDates, cnHolidayDays, reminders] = await Promise.all([
                        loadRecordsForRange(info.start, info.end),
                        loadScheduleForRange(info.start, info.end),
                        (settings.showTaskDates && typeof window.tmQueryCalendarTaskDateEvents === 'function')
                            ? Promise.resolve().then(() => window.tmQueryCalendarTaskDateEvents(info.start || '', info.end || '')).catch(() => [])
                            : Promise.resolve([]),
                        (settings.showCnHoliday || settings.showLunar) ? Promise.all(years.map((y) => loadCnHolidayYear(y))).then((arr) => arr.flat()) : Promise.resolve([]),
                        settings.linkDockTomato ? loadReminderBlocks().catch(() => []) : Promise.resolve([]),
                    ]);
                    try {
                        const wantMap = !!(settings.showCnHoliday || settings.showLunar);
                        state.cnHolidayMap = wantMap ? buildCnHolidayMap(cnHolidayDays, info.start, info.end, !!settings.showLunar) : new Map();
                        applyCnHolidayDots(wrap);
                        applyCnLunarLabels(wrap);
                    } catch (e0) {}
                    let a = buildEventsFromRecords(records, settings, viewType);
                    if (String(viewType || '').startsWith('dayGrid')) {
                        const hideMonthTomato = !!settings.monthAggregate && String(viewType || '').trim() === 'dayGridMonth';
                        const cached = state._tomatoEventCache;
                        const fresh = cached && cached.key === tomatoKey && Array.isArray(cached.events) && cached.events.length > 0 && (Date.now() - (cached.ts || 0) < 2 * 60 * 1000);
                        if (!hideMonthTomato && a.length === 0 && fresh) {
                            a = cached.events;
                        } else if (!hideMonthTomato && a.length > 0) {
                            state._tomatoEventCache = { key: tomatoKey, ts: Date.now(), events: a };
                        }
                    }
                    const scheduleTaskTitleMap = await __tmBuildScheduleLinkedTaskTitleMap(schedules).catch(() => new Map());
                    const b = buildEventsFromSchedule(schedules, info.start, info.end, settings, scheduleTaskTitleMap);
                    const c = buildEventsFromTaskDates(taskDates, settings);
                    const d = settings.showCnHoliday ? buildCnHolidayEvents(cnHolidayDays, info.start, info.end, viewType, settings) : [];
                    const e = buildEventsFromReminders(reminders, info.start, info.end, settings);
                    const events = a.concat(b, c, d, e);
                    const statusEl = wrap.querySelector('[data-tm-cal-role="status"]');
                    if (statusEl) {
                        const sum = summarizeRange(records);
                        const minTxt = sum.minMs ? formatDateKey(new Date(sum.minMs)) : '-';
                        const maxTxt = sum.maxMs ? formatDateKey(new Date(sum.maxMs)) : '-';
                        statusEl.textContent = `事件: ${events.length}（番茄:${a.length} 文档:${b.length} 跨天:${c.length} 节假:${d.length} 提醒:${e.length} 原始:${sum.total} 异常:${sum.bad} 范围:${minTxt}~${maxTxt}）`;
                    }
                    success(events);
                } catch (e) {
                    failure(e);
                }
            },
            eventClick: (arg) => {
                try {
                    if (arg?.jsEvent) {
                        arg.jsEvent.__tmCalHandled = true;
                        arg.jsEvent.preventDefault?.();
                    }
                } catch (e0) {}
                if (_tmClickTracker && _tmClickTracker.ts > 0 && arg?.jsEvent) {
                    const dur = Date.now() - _tmClickTracker.ts;
                    const x = Number(arg.jsEvent.clientX);
                    const y = Number(arg.jsEvent.clientY);
                    if (Number.isFinite(x) && Number.isFinite(y)) {
                        const dx = Math.abs(x - _tmClickTracker.x);
                        const dy = Math.abs(y - _tmClickTracker.y);
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dur > 500 || dist > 5) return;
                    }
                }
                const ext = arg?.event?.extendedProps || {};
                const aggDay = String(ext.__tmAggregateDay || '').trim();
                if (aggDay) {
                    try {
                        calendar.changeView('timeGridDay', aggDay);
                    } catch (e) {}
                    return;
                }
                const source = String(ext.__tmSource || '').trim();
                if (source === 'cnHoliday') {
                    return;
                }
                if (source === 'taskdate') {
                    const tid = String(ext.__tmTaskId || '').trim();
                    try {
                        if (tid && typeof window.tmJumpToTask === 'function') window.tmJumpToTask(tid, arg?.jsEvent);
                    } catch (e) {}
                    return;
                }
                if (source === 'reminder') {
                    const tid = String(ext.__tmReminderBlockId || '').trim();
                    try {
                        if (tid && typeof window.tmJumpToTask === 'function') window.tmJumpToTask(tid, arg?.jsEvent);
                    } catch (e) {}
                    return;
                }
                if (source === 'schedule') {
                    try {
                        const baseStart = String(ext.__tmScheduleBaseStart || '').trim();
                        const baseEnd = String(ext.__tmScheduleBaseEnd || '').trim();
                        openScheduleModal({
                            id: String(ext.__tmScheduleId || arg?.event?.id || ''),
                            title: String(arg?.event?.title || ''),
                            start: baseStart ? new Date(baseStart) : arg?.event?.start,
                            end: baseEnd ? new Date(baseEnd) : arg?.event?.end,
                            allDay: arg?.event?.allDay === true,
                            color: String(arg?.event?.backgroundColor || arg?.event?.borderColor || '#0078d4'),
                            calendarId: String(ext.calendarId || 'default'),
                            taskId: String(ext.__tmTaskId || ''),
                            reminderMode: String(ext.__tmReminderMode || ''),
                            reminderEnabled: ext.__tmReminderEnabled === true,
                            reminderOffsetMin: Number(ext.__tmReminderOffsetMin),
                            repeatType: String(ext.__tmRepeatType || ''),
                            repeatEvery: Number(ext.__tmRepeatEvery),
                            repeatUntil: String(ext.__tmRepeatUntil || ''),
                            repeatMonthlyMode: String(ext.__tmRepeatMonthlyMode || ''),
                            notificationSchedules: sanitizeScheduleNotificationSchedules(ext.__tmNotificationSchedules),
                        });
                    } catch (e2) {
                        try { toast(`❌ 打开编辑窗失败：${String(e2?.message || e2 || '')}`, 'error'); } catch (e3) {}
                    }
                    return;
                }
                try {
                    openRecordModal(arg.event);
                } catch (e2) {
                    try { toast(`❌ 打开记录窗失败：${String(e2?.message || e2 || '')}`, 'error'); } catch (e3) {}
                }
            },
            dateClick: (info) => {
                try {
                    if (info?.jsEvent) {
                        info.jsEvent.__tmCalHandled = true;
                        info.jsEvent.preventDefault?.();
                    }
                } catch (e0) {}
                const d = info?.date instanceof Date ? info.date : null;
                if (!d || Number.isNaN(d.getTime())) return;
                const start = new Date(d.getTime());
                start.setSeconds(0, 0);
                const end = new Date(start.getTime() + (info?.allDay === true ? 24 * 60 : 30) * 60000);
                openScheduleModal({ start, end, allDay: info?.allDay === true, calendarId: pickDefaultCalendarId(getSettings()) });
            },
            eventDrop: async (arg) => {
                const ext = arg?.event?.extendedProps || {};
                const source = String(ext.__tmSource || '').trim();
                if (source === 'schedule') {
                    if (getScheduleRepeatType({ repeatType: ext.__tmRepeatType }) !== 'none') {
                        toast('⚠ 循环日程请在编辑窗口中修改', 'warning');
                        try { arg.revert(); } catch (e) {}
                        return;
                    }
                    const id = String(ext.__tmScheduleId || arg?.event?.id || '').trim();
                    const start = arg?.event?.start;
                    const end = arg?.event?.end;
                    if (!id || !(start instanceof Date) || !(end instanceof Date) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
                        try { arg.revert(); } catch (e) {}
                        return;
                    }
                    const list = await loadScheduleAll();
                    const idx = list.findIndex((x) => String(x?.id || '') === id);
                    if (idx < 0) {
                        try { arg.revert(); } catch (e) {}
                        return;
                    }
                    const allDay = (arg?.event?.allDay === true) || isAllDayRange(start, end);
                    list[idx] = { ...list[idx], start: safeISO(start), end: safeISO(end), allDay };
                    await saveScheduleAll(list);
                    toast('✅ 已更新日程', 'success');
                    return;
                }
                if (source === 'taskdate') {
                    const taskId = String(ext.__tmTaskId || '').trim();
                    const start = arg?.event?.start;
                    const end0 = arg?.event?.end;
                    const calendarId = String(ext.calendarId || 'default').trim() || pickDefaultCalendarId(getSettings());
                    if (!taskId || !(start instanceof Date) || Number.isNaN(start.getTime())) {
                        try { arg.revert(); } catch (e) {}
                        return;
                    }
                    const isAllDay = arg?.event?.allDay === true;
                    const safeEnd = (end0 instanceof Date && !Number.isNaN(end0.getTime()) && end0.getTime() > start.getTime())
                        ? end0
                        : new Date(start.getTime() + (isAllDay ? 24 * 60 : 60) * 60000);
                    try {
                        const list = await loadScheduleAll();
                        list.push({
                            id: uuid(),
                            title: String(arg?.event?.title || '').trim() || '任务',
                            start: safeISO(start),
                            end: safeISO(safeEnd),
                            allDay: isAllDayRange(start, safeEnd),
                            color: '',
                            calendarId,
                            taskId,
                        });
                        await saveScheduleAll(list);
                        toast('✅ 已加入日程', 'success');
                    } catch (e) {}
                    try { arg.revert(); } catch (e) {}
                    try { state.calendar?.refetchEvents?.(); } catch (e) {}
                    return;
                }
                const recordKey = ext.__tmRecordKey || null;
                if (!recordKey) {
                    try { arg.revert(); } catch (e) {}
                    return;
                }
                const dock = globalThis.__dockTomato;
                const history = dock?.history;
                if (!history || typeof history.updateTime !== 'function') {
                    toast('⚠ 未检测到番茄钟历史编辑接口', 'warning');
                    try { arg.revert(); } catch (e) {}
                    return;
                }
                const start = arg?.event?.start;
                const end = arg?.event?.end;
                if (!(start instanceof Date) || !(end instanceof Date) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
                    try { arg.revert(); } catch (e) {}
                    return;
                }
                const ok = await history.updateTime(recordKey, { start: start.toISOString(), end: end.toISOString() });
                if (!ok) {
                    toast('❌ 更新失败', 'error');
                    try { arg.revert(); } catch (e) {}
                    return;
                }
                toast('✅ 已更新', 'success');
            },
            eventResize: async (arg) => {
                const ext = arg?.event?.extendedProps || {};
                const source = String(ext.__tmSource || '').trim();
                if (source === 'schedule') {
                    if (getScheduleRepeatType({ repeatType: ext.__tmRepeatType }) !== 'none') {
                        toast('⚠ 循环日程请在编辑窗口中修改', 'warning');
                        try { arg.revert(); } catch (e) {}
                        return;
                    }
                    const id = String(ext.__tmScheduleId || arg?.event?.id || '').trim();
                    const start = arg?.event?.start;
                    const end = arg?.event?.end;
                    if (!id || !(start instanceof Date) || !(end instanceof Date) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
                        try { arg.revert(); } catch (e) {}
                        return;
                    }
                    const list = await loadScheduleAll();
                    const idx = list.findIndex((x) => String(x?.id || '') === id);
                    if (idx < 0) {
                        try { arg.revert(); } catch (e) {}
                        return;
                    }
                    const allDay = (arg?.event?.allDay === true) || isAllDayRange(start, end);
                    list[idx] = { ...list[idx], start: safeISO(start), end: safeISO(end), allDay };
                    await saveScheduleAll(list);
                    toast('✅ 已更新日程', 'success');
                    return;
                }
                if (source === 'taskdate') {
                    try { arg.revert(); } catch (e) {}
                    return;
                }
                const recordKey = ext.__tmRecordKey || null;
                if (!recordKey) {
                    try { arg.revert(); } catch (e) {}
                    return;
                }
                const dock = globalThis.__dockTomato;
                const history = dock?.history;
                if (!history || typeof history.updateTime !== 'function') {
                    toast('⚠ 未检测到番茄钟历史编辑接口', 'warning');
                    try { arg.revert(); } catch (e) {}
                    return;
                }
                const start = arg?.event?.start;
                const end = arg?.event?.end;
                if (!(start instanceof Date) || !(end instanceof Date) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
                    try { arg.revert(); } catch (e) {}
                    return;
                }
                const ok = await history.updateTime(recordKey, { start: start.toISOString(), end: end.toISOString() });
                if (!ok) {
                    toast('❌ 更新失败', 'error');
                    try { arg.revert(); } catch (e) {}
                    return;
                }
                toast('✅ 已更新', 'success');
            },
            select: (info) => {
                try { calendar.unselect(); } catch (e) {}
                const start = info?.start instanceof Date ? info.start : null;
                const end = info?.end instanceof Date ? info.end : null;
                if (!start || !end) return;
                openScheduleModal({ start, end, allDay: info?.allDay === true, calendarId: pickDefaultCalendarId(getSettings()) });
            },
            datesSet: () => {
                try { syncMainCalendarViewSelect(wrap, calendar, { compact: !!(isMobileDevice || isDockHost) }); } catch (e) {}
                try {
                    const d = calendar?.getDate?.();
                    if (d) state.miniMonthKey = miniMonthKeyFromDate(d);
                    renderMiniCalendar(wrap);
                } catch (e) {}
                try {
                    const store = state.settingsStore;
                    if (store && store.data && calendar?.view?.type) {
                        const vt = String(calendar.view.type || '').trim();
                        if (vt) state._lastViewType = vt;
                        const dt = calendar.getDate?.();
                        const key = (dt instanceof Date && !Number.isNaN(dt.getTime())) ? `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}` : '';
                        if (vt) store.data.calendarLastViewType = vt;
                        if (key) store.data.calendarLastDate = key;
                        if (state._persistTimer) clearTimeout(state._persistTimer);
                        state._persistTimer = setTimeout(() => { try { store.save(); } catch (e2) {} }, 250);
                    }
                } catch (e) {}
                try {
                    requestAnimationFrame(() => {
                        try { enhanceNowIndicator(host); } catch (e2) {}
                        try { applyCnHolidayDots(wrap); } catch (e2) {}
                        try { applyCnLunarLabels(wrap); } catch (e2) {}
                    });
                    setTimeout(() => {
                        try { enhanceNowIndicator(host); } catch (e2) {}
                        try { applyCnHolidayDots(wrap); } catch (e2) {}
                        try { applyCnLunarLabels(wrap); } catch (e2) {}
                    }, 0);
                } catch (e) {}
            },
            loading: (isLoading) => {
                try {
                    if (!isLoading) {
                        requestAnimationFrame(() => {
                            try { calendar.updateSize(); } catch (e2) {}
                            try { enhanceNowIndicator(host); } catch (e2) {}
                        });
                    }
                } catch (e) {}
            },
        });
        state.calendar = calendar;

        try { calendar.render(); } catch (e) {}
        try { syncMainCalendarViewSelect(wrap, calendar, { compact: !!(isMobileDevice || isDockHost) }); } catch (e) {}
        try {
            state.filteredTasksListener = () => {
                try { renderTaskPage(wrap, getSettings()); } catch (e2) {}
            };
            window.addEventListener('tm:filtered-tasks-updated', state.filteredTasksListener);
        } catch (e) {}
        try {
            requestAnimationFrame(() => {
                try {
                    if (preferredInitialDate) {
                        const currentType = String(calendar?.view?.type || '').trim();
                        if (currentType && currentType !== preferredInitialView) calendar.changeView(preferredInitialView, preferredInitialDate);
                        else calendar.gotoDate(preferredInitialDate);
                    }
                } catch (e2) {}
                try { calendar.updateSize(); } catch (e2) {}
                try { enhanceNowIndicator(host); } catch (e2) {}
            });
        } catch (e) {}
        try { renderMiniCalendar(wrap); } catch (e) {}

        // 修复：页面从后台恢复时重新计算日历尺寸
        // 使用 resize 事件来触发
        let lastVisibilityState = document.visibilityState;
        
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible' && lastVisibilityState === 'hidden') {
                // 页面从后台恢复到前台，触发 resize 事件让日历重新布局
                window.dispatchEvent(new Event('resize'));
                try { scheduleScheduleReminderRefresh('visibility'); } catch (e) {}
            }
            lastVisibilityState = document.visibilityState;
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        state.onVisibilityChange = onVisibilityChange;

        // 修复：使用 ResizeObserver 监听日历容器尺寸变化，更可靠地处理布局问题
        const calendarHost = wrap?.querySelector?.('.tm-calendar-host');
        if (calendarHost && typeof ResizeObserver === 'function') {
            const calendarResizeObserver = new ResizeObserver(() => {
                // 使用 requestAnimationFrame 确保在渲染周期中执行
                requestAnimationFrame(() => {
                    try { calendar.updateSize(); } catch (e2) {}
                });
            });
            calendarResizeObserver.observe(calendarHost);
            state.calendarResizeObserver = calendarResizeObserver;
        }

        const onToolbarClick = (e) => {
            const tabEl = e.target?.closest?.('[data-tm-cal-side-tab]');
            const tabKey = String(tabEl?.getAttribute?.('data-tm-cal-side-tab') || '').trim();
            if (tabKey) {
                setSidePage(wrap, tabKey);
                try { renderTaskPage(wrap, getSettings()); } catch (e2) {}
                return;
            }
            const masterEl = e.target?.closest?.('[data-tm-cal-master]');
            if (masterEl) return;
            const collapseEl = e.target?.closest?.('[data-tm-cal-collapse]');
            const collapseKey = String(collapseEl?.getAttribute?.('data-tm-cal-collapse') || '').trim();
            if (collapseKey) {
                try {
                    const store = state.settingsStore;
                    if (store && store.data) {
                        if (collapseKey === 'calendars') store.data.calendarSidebarCollapseCalendars = !store.data.calendarSidebarCollapseCalendars;
                        if (collapseKey === 'docGroups') store.data.calendarSidebarCollapseDocGroups = !store.data.calendarSidebarCollapseDocGroups;
                        if (collapseKey === 'tomato') store.data.calendarSidebarCollapseTomato = !store.data.calendarSidebarCollapseTomato;
                        if (collapseKey === 'tasks') store.data.calendarSidebarCollapseTasks = !store.data.calendarSidebarCollapseTasks;
                        try { store.save(); } catch (e2) {}
                        try { renderSidebar(wrap, getSettings()); } catch (e2) {}
                    }
                } catch (e2) {}
                return;
            }
            const btn = findActionTarget(e?.target, 'data-tm-cal-action');
            const action = String(btn?.getAttribute?.('data-tm-cal-action') || '');
            if (!action) return;
            if (action === 'toggleSidebar') {
                toggleMobileSidebar(wrap, undefined, state.sidePage || 'calendar');
                return;
            }
            if (action === 'closeSidebar') {
                setCalendarSidebarOpen(wrap, false);
                return;
            }
            if (action === 'taskPrev') {
                state.taskPage = Math.max(1, (Number(state.taskPage) || 1) - 1);
                renderTaskPage(wrap, getSettings());
                return;
            }
            if (action === 'taskNext') {
                state.taskPage = (Number(state.taskPage) || 1) + 1;
                renderTaskPage(wrap, getSettings());
                return;
            }
            if (action === 'new') {
                const now = new Date();
                const start = new Date(now.getTime());
                start.setSeconds(0, 0);
                const end = new Date(start.getTime() + 60 * 60 * 1000);
                openScheduleModal({ start, end, calendarId: pickDefaultCalendarId(getSettings()) });
                return;
            }
            if (action === 'refresh') {
                const prevType = String(calendar?.view?.type || '').trim();
                const prevDate = (() => {
                    try { return calendar?.getDate?.() || null; } catch (e) { return null; }
                })();
                try {
                    const store = state.settingsStore;
                    if (store && store.data) {
                        if (prevType) store.data.calendarLastViewType = prevType;
                        const key = (prevDate instanceof Date && !Number.isNaN(prevDate.getTime())) ? `${prevDate.getFullYear()}-${pad2(prevDate.getMonth() + 1)}-${pad2(prevDate.getDate())}` : '';
                        if (key) store.data.calendarLastDate = key;
                        try { store.save(); } catch (e3) {}
                    }
                } catch (e2) {}
                try {
                    if (typeof window.tmRefreshCalendarInPlace === 'function') {
                        window.tmRefreshCalendarInPlace({ silent: false }).catch(() => null);
                    } else if (typeof window.tmRefresh === 'function') {
                        window.tmRefresh().catch(() => null);
                    } else {
                        refreshInPlace({ hard: true });
                    }
                } catch (e2) {}
                try {
                    if (prevType && prevDate instanceof Date && !Number.isNaN(prevDate.getTime())) {
                        requestAnimationFrame(() => {
                            try {
                                const nowType = String(calendar?.view?.type || '').trim();
                                if (nowType !== prevType) calendar.changeView(prevType, prevDate);
                                else calendar.gotoDate(prevDate);
                            } catch (e3) {}
                            try { refreshInPlace({ hard: true }); } catch (e3) {}
                        });
                    } else {
                        refreshInPlace({ hard: true });
                    }
                } catch (e2) {}
            }
            if (action === 'today') {
                try { calendar.today(); } catch (e2) {}
            }
        };
        wrap.addEventListener('click', onToolbarClick);
        wrap.addEventListener('pointerdown', (e) => {
            try {
                if (!state.isMobileDevice || !state.sidebarOpen) return;
                const t = e?.target;
                if (!(t instanceof Element)) return;
                if (t.closest('.tm-calendar-sidebar')) return;
                setCalendarSidebarOpen(wrap, false);
            } catch (e2) {}
        }, true);
        state.wrapEl = wrap;
        state.onToolbarClick = onToolbarClick;

        const onCalendarEventClickFallbackCapture = (e) => {
            try {
                if (e && e.__tmCalHandled) return;
                if (_tmClickTracker && _tmClickTracker.ts > 0) {
                    const dur = Date.now() - _tmClickTracker.ts;
                    const x = Number(e.clientX);
                    const y = Number(e.clientY);
                    if (Number.isFinite(x) && Number.isFinite(y)) {
                        const dx = Math.abs(x - _tmClickTracker.x);
                        const dy = Math.abs(y - _tmClickTracker.y);
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dur > 500 || dist > 5) return;
                    }
                }
                const target = e?.target;
                if (!(target instanceof Element)) return;
                const hostEl = target.closest('.tm-calendar-host');
                const inPopover = !!target.closest('.fc-popover');
                if (!hostEl && !inPopover) return;
                if (target.closest('.fc-header-toolbar')) return;
                // 修复：点击"更多"链接时不拦截，让 FullCalendar 默认处理
                // 检查多种可能的更多链接类名
                if (target.closest('.fc-more')) return;
                if (target.closest('.fc-more-link')) return;
                if (target.closest('.fc-popover-close')) return;
                // 检查是否是点击在更多链接内部的文本或图标
                if (target.classList.contains('fc-more-link')) return;
                if (target.classList.contains('fc-more')) return;
                // 注意：不拦截 .fc-popover，因为弹出窗口内部的事件需要支持点击跳转
                let eventEl = target.closest('[data-tm-cal-event-id]') || target.closest('.fc-event');
                if (!eventEl) {
                    const x = Number(e?.clientX);
                    const y = Number(e?.clientY);
                    if (Number.isFinite(x) && Number.isFinite(y) && typeof document.elementsFromPoint === 'function') {
                        const stack = document.elementsFromPoint(x, y);
                        for (const el of stack || []) {
                            if (!(el instanceof Element)) continue;
                            const evEl = el.closest?.('[data-tm-cal-event-id]') || el.closest?.('.fc-event');
                            if (evEl) {
                                eventEl = evEl;
                                break;
                            }
                        }
                    }
                }
                if (!eventEl) {
                    const x = Number(e?.clientX);
                    const y = Number(e?.clientY);
                    let dateEl = target.closest('[data-date]');
                    if (!dateEl && Number.isFinite(x) && Number.isFinite(y) && typeof document.elementsFromPoint === 'function') {
                        const stack = document.elementsFromPoint(x, y);
                        for (const el of stack || []) {
                            if (!(el instanceof Element)) continue;
                            const de = el.closest?.('[data-date]');
                            if (de) {
                                dateEl = de;
                                break;
                            }
                        }
                    }
                    if (dateEl) {
                        const candidates = Array.from(dateEl.querySelectorAll('[data-tm-cal-event-id].fc-event, .fc-event')).filter((el) => {
                            if (!(el instanceof Element)) return false;
                            return !!el.closest('.tm-calendar-host') || !!el.closest('.fc-popover');
                        });
                        if (candidates.length) {
                            const hit = (el) => {
                                if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
                                const r = el.getBoundingClientRect?.();
                                if (!r) return false;
                                return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
                            };
                            eventEl = candidates.find(hit) || (candidates.length === 1 ? candidates[0] : null);
                            if (!eventEl && Number.isFinite(x) && Number.isFinite(y)) {
                                const dist2 = (el) => {
                                    const r = el.getBoundingClientRect?.();
                                    if (!r) return Infinity;
                                    const cx = (x < r.left) ? r.left : (x > r.right ? r.right : x);
                                    const cy = (y < r.top) ? r.top : (y > r.bottom ? r.bottom : y);
                                    const dx = x - cx;
                                    const dy = y - cy;
                                    return dx * dx + dy * dy;
                                };
                                candidates.sort((a, b) => dist2(a) - dist2(b));
                                eventEl = candidates[0] || null;
                            }
                        }
                    }
                }
                if (!eventEl) {
                    return;
                }
                e.__tmCalHandled = true;
                try { e.stopPropagation?.(); } catch (e2) {}

                const aggDay = String(eventEl.getAttribute('data-tm-cal-agg-day') || '').trim();
                if (aggDay) {
                    try { calendar.changeView('timeGridDay', aggDay); } catch (e2) {}
                    return;
                }

                const eventId = String(eventEl.getAttribute('data-tm-cal-event-id') || '').trim();
                const api = eventId ? (calendar?.getEventById?.(eventId) || null) : null;
                const ext = api?.extendedProps || {};
                const source = String(eventEl.getAttribute('data-tm-cal-source') || ext.__tmSource || '').trim();
                if (source === 'cnHoliday') return;
                const tid = String(eventEl.getAttribute('data-tm-cal-task-id') || ext.__tmTaskId || '').trim();
                const rid = String(eventEl.getAttribute('data-tm-cal-reminder-id') || ext.__tmReminderBlockId || '').trim();
                if (tid) {
                    const x = Number(e?.clientX);
                    const y = Number(e?.clientY);
                    const checkEl = eventEl.querySelector?.('.tm-cal-task-event-check') || null;
                    const titleEl = eventEl.querySelector?.('.tm-cal-task-event-title-text') || eventEl.querySelector?.('.tm-cal-task-event-title') || null;
                    const hitRect = (el) => {
                        if (!el || !(el instanceof Element)) return false;
                        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
                        const r = el.getBoundingClientRect?.();
                        if (!r) return false;
                        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
                    };
                    if (hitRect(checkEl)) {
                        try { e.preventDefault?.(); } catch (e2) {}
                        try {
                            const next = !(checkEl.checked === true);
                            checkEl.checked = next;
                            if (typeof window.tmSetDone === 'function') {
                                try { window.tmSetDone(tid, next, e); } catch (e3) {}
                            }
                            try { state.calendar?.refetchEvents?.(); } catch (e3) {}
                        } catch (e2) {}
                        return;
                    }
                    if (hitRect(titleEl)) {
                        try { e.preventDefault?.(); } catch (e2) {}
                        if (typeof window.tmJumpToTask === 'function') {
                            try { window.tmJumpToTask(tid, e); } catch (e2) {}
                        }
                        return;
                    }
                }
                if (source === 'taskdate') {
                    if (tid && typeof window.tmJumpToTask === 'function') {
                        try { window.tmJumpToTask(tid, e); } catch (e2) {}
                    }
                    return;
                }
                if (source === 'reminder') {
                    if (rid && typeof window.tmJumpToTask === 'function') {
                        try { window.tmJumpToTask(rid, e); } catch (e2) {}
                    }
                    return;
                }
                if (source === 'schedule') {
                    try {
                        const baseStart = String(ext.__tmScheduleBaseStart || '').trim();
                        const baseEnd = String(ext.__tmScheduleBaseEnd || '').trim();
                        openScheduleModal({
                            id: String(ext.__tmScheduleId || api?.id || ''),
                            title: String(api?.title || ''),
                            start: baseStart ? new Date(baseStart) : api?.start,
                            end: baseEnd ? new Date(baseEnd) : api?.end,
                            allDay: api?.allDay === true,
                            color: String(api?.backgroundColor || api?.borderColor || '#0078d4'),
                            calendarId: String(ext.calendarId || 'default'),
                            taskId: String(ext.__tmTaskId || ''),
                            reminderMode: String(ext.__tmReminderMode || ''),
                            reminderEnabled: ext.__tmReminderEnabled === true,
                            reminderOffsetMin: Number(ext.__tmReminderOffsetMin),
                            repeatType: String(ext.__tmRepeatType || ''),
                            repeatEvery: Number(ext.__tmRepeatEvery),
                            repeatUntil: String(ext.__tmRepeatUntil || ''),
                            repeatMonthlyMode: String(ext.__tmRepeatMonthlyMode || ''),
                            notificationSchedules: sanitizeScheduleNotificationSchedules(ext.__tmNotificationSchedules),
                        });
                    } catch (e2) {
                        try { toast(`❌ 打开编辑窗失败：${String(e2?.message || e2 || '')}`, 'error'); } catch (e3) {}
                    }
                    return;
                }
                if (api) {
                    try {
                        openRecordModal(api);
                    } catch (e2) {
                        try { toast(`❌ 打开记录窗失败：${String(e2?.message || e2 || '')}`, 'error'); } catch (e3) {}
                    }
                }
            } catch (e0) {}
        };
        wrap.addEventListener('click', onCalendarEventClickFallbackCapture, true);
        state.onCalendarEventClickFallbackCapture = onCalendarEventClickFallbackCapture;

        const applySidebarColor = async (kind, key, color) => {
            const store = state.settingsStore;
            if (!store || !store.data) return;
            const k = String(kind || '').trim();
            const kk = String(key || '').trim();
            const c = String(color || '').trim();
            if (!k || !kk || !c) return;
            if (k === 'calendar') {
                const prev = (store.data.calendarCalendarsConfig && typeof store.data.calendarCalendarsConfig === 'object' && !Array.isArray(store.data.calendarCalendarsConfig))
                    ? store.data.calendarCalendarsConfig
                    : {};
                const entry = (prev[kk] && typeof prev[kk] === 'object') ? prev[kk] : {};
                store.data.calendarCalendarsConfig = { ...prev, [kk]: { ...entry, color: c } };
            } else if (k === 'schedule') {
                store.data.calendarScheduleColor = c;
            } else if (k === 'taskDates') {
                if (String(getSettings().taskDateColorMode || 'group').trim() === 'group') return;
                store.data.calendarTaskDatesColor = c;
            } else if (k === 'cnHoliday') {
                store.data.calendarCnHolidayColor = c;
            } else if (k === 'tomato') {
                if (kk === 'focus') store.data.calendarColorFocus = c;
                if (kk === 'break') store.data.calendarColorBreak = c;
                if (kk === 'stopwatch') store.data.calendarColorStopwatch = c;
                if (kk === 'idle') store.data.calendarColorIdle = c;
            } else {
                return;
            }
            try { await store.save(); } catch (e2) {}
            try { renderSidebar(wrap, getSettings()); } catch (e2) {}
            try { renderTaskPage(wrap, getSettings()); } catch (e2) {}
            try { calendar.refetchEvents(); } catch (e2) {}
        };

        const resetSidebarColor = async (kind, key) => {
            const store = state.settingsStore;
            if (!store || !store.data) return;
            const k = String(kind || '').trim();
            const kk = String(key || '').trim();
            if (!k || !kk) return;
            if (k === 'calendar') {
                const prev = (store.data.calendarCalendarsConfig && typeof store.data.calendarCalendarsConfig === 'object' && !Array.isArray(store.data.calendarCalendarsConfig))
                    ? store.data.calendarCalendarsConfig
                    : {};
                const entry = (prev[kk] && typeof prev[kk] === 'object') ? prev[kk] : null;
                if (!entry) return;
                const next = { ...entry };
                delete next.color;
                store.data.calendarCalendarsConfig = { ...prev, [kk]: next };
            } else if (k === 'schedule') {
                store.data.calendarScheduleColor = '';
            } else if (k === 'taskDates') {
                store.data.calendarTaskDatesColor = '#6b7280';
            } else if (k === 'cnHoliday') {
                store.data.calendarCnHolidayColor = '#ff3333';
            } else if (k === 'tomato') {
                if (kk === 'focus') store.data.calendarColorFocus = '#1a73e8';
                if (kk === 'break') store.data.calendarColorBreak = '#34a853';
                if (kk === 'stopwatch') store.data.calendarColorStopwatch = '#f9ab00';
                if (kk === 'idle') store.data.calendarColorIdle = '#9aa0a6';
            } else {
                return;
            }
            try { await store.save(); } catch (e2) {}
            try { renderSidebar(wrap, getSettings()); } catch (e2) {}
            try { renderTaskPage(wrap, getSettings()); } catch (e2) {}
            try { calendar.refetchEvents(); } catch (e2) {}
        };

        const onSidebarContextMenu = (e) => {
            const target = e.target;
            if (!(target instanceof Element)) return;
            const dot = target.closest('.tm-calendar-nav-dot[data-tm-cal-color-kind]');
            if (!dot) return;
            try {
                if (state.sidebarColorMenuBindTimer) {
                    clearTimeout(state.sidebarColorMenuBindTimer);
                    state.sidebarColorMenuBindTimer = null;
                }
                if (state.sidebarColorMenuCloseHandler) {
                    document.removeEventListener('click', state.sidebarColorMenuCloseHandler);
                    document.removeEventListener('contextmenu', state.sidebarColorMenuCloseHandler);
                    window.removeEventListener('resize', state.sidebarColorMenuCloseHandler);
                    state.sidebarColorMenuCloseHandler = null;
                }
            } catch (e2) {}
            const kind = String(dot.getAttribute('data-tm-cal-color-kind') || '').trim();
            const key = String(dot.getAttribute('data-tm-cal-color-key') || '').trim();
            const value = String(dot.getAttribute('data-tm-cal-color-value') || '').trim() || '#0078d4';
            if (kind === 'taskDates' && String(getSettings().taskDateColorMode || 'group').trim() === 'group') return;
            try { e.preventDefault(); } catch (e2) {}
            try { e.stopPropagation(); } catch (e2) {}
            const existingMenu = document.getElementById('tm-calendar-color-menu');
            if (existingMenu) existingMenu.remove();
            const menu = document.createElement('div');
            menu.id = 'tm-calendar-color-menu';
            menu.style.cssText = `
                position: fixed;
                top: ${e.clientY}px;
                left: ${e.clientX}px;
                background: var(--b3-theme-background);
                border: 1px solid var(--b3-theme-surface-light);
                border-radius: 4px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                padding: 4px 0;
                z-index: 200000;
                min-width: 140px;
                user-select: none;
            `;
            const createItem = (label, onClick, isDanger) => {
                const item = document.createElement('div');
                item.textContent = label;
                item.style.cssText = `
                    padding: 6px 12px;
                    cursor: pointer;
                    font-size: 13px;
                    color: ${isDanger ? 'var(--b3-theme-error)' : 'var(--b3-theme-on-background)'};
                    display: flex;
                    align-items: center;
                `;
                item.onmouseenter = () => item.style.backgroundColor = 'var(--b3-theme-surface-light)';
                item.onmouseleave = () => item.style.backgroundColor = 'transparent';
                item.onclick = (ev) => {
                    ev.stopPropagation();
                    menu.remove();
                    onClick?.();
                };
                return item;
            };
            menu.appendChild(createItem('设置颜色', () => {
                const input = document.createElement('input');
                input.type = 'color';
                input.value = value;
                input.style.position = 'fixed';
                input.style.left = '-9999px';
                input.style.top = '-9999px';
                const cleanup = () => { try { input.remove(); } catch (e3) {} };
                input.addEventListener('change', () => { applySidebarColor(kind, key, input.value).finally(cleanup); });
                input.addEventListener('blur', cleanup);
                document.body.appendChild(input);
                try { input.click(); } catch (e2) { cleanup(); }
            }));
            menu.appendChild(createItem('重置颜色', () => { resetSidebarColor(kind, key); }, true));
            document.body.appendChild(menu);
            const closeHandler = () => {
                try { menu.remove(); } catch (e2) {}
                try { document.removeEventListener('click', closeHandler); } catch (e2) {}
                try { document.removeEventListener('contextmenu', closeHandler); } catch (e2) {}
                try { window.removeEventListener('resize', closeHandler); } catch (e2) {}
                if (state.sidebarColorMenuCloseHandler === closeHandler) state.sidebarColorMenuCloseHandler = null;
                if (state.sidebarColorMenuBindTimer) {
                    try { clearTimeout(state.sidebarColorMenuBindTimer); } catch (e2) {}
                    state.sidebarColorMenuBindTimer = null;
                }
            };
            state.sidebarColorMenuCloseHandler = closeHandler;
            state.sidebarColorMenuBindTimer = setTimeout(() => {
                document.addEventListener('click', closeHandler);
                document.addEventListener('contextmenu', closeHandler);
                window.addEventListener('resize', closeHandler);
            }, 0);
        };
        wrap.addEventListener('contextmenu', onSidebarContextMenu);
        state.onSidebarContextMenu = onSidebarContextMenu;

        const onFilterChange = async (e) => {
            const el = e.target;
            if (!(el instanceof HTMLInputElement)) return;
            const store = state.settingsStore;
            if (!store || !store.data) return;
            const colorCalId = String(el.getAttribute('data-tm-cal-calendar-color') || '').trim();
            if (colorCalId) {
                const color = String(el.value || '').trim();
                const prev = (store.data.calendarCalendarsConfig && typeof store.data.calendarCalendarsConfig === 'object' && !Array.isArray(store.data.calendarCalendarsConfig))
                    ? store.data.calendarCalendarsConfig
                    : {};
                const entry = (prev[colorCalId] && typeof prev[colorCalId] === 'object') ? prev[colorCalId] : {};
                store.data.calendarCalendarsConfig = { ...prev, [colorCalId]: { ...entry, color } };
                try { await store.save(); } catch (e2) {}
                try { renderSidebar(wrap, getSettings()); } catch (e2) {}
                try { renderTaskPage(wrap, getSettings()); } catch (e2) {}
                try { calendar.refetchEvents(); } catch (e2) {}
                return;
            }
            const fixedColor = String(el.getAttribute('data-tm-cal-fixed-color') || '').trim();
            if (fixedColor) {
                const color = String(el.value || '').trim();
                if (fixedColor === 'schedule') store.data.calendarScheduleColor = color;
                if (fixedColor === 'taskDates') store.data.calendarTaskDatesColor = color;
                try { await store.save(); } catch (e2) {}
                try { renderSidebar(wrap, getSettings()); } catch (e2) {}
                try { renderTaskPage(wrap, getSettings()); } catch (e2) {}
                try { calendar.refetchEvents(); } catch (e2) {}
                return;
            }
            const tomatoColor = String(el.getAttribute('data-tm-cal-tomato-color') || '').trim();
            if (tomatoColor) {
                const color = String(el.value || '').trim();
                if (tomatoColor === 'focus') store.data.calendarColorFocus = color;
                if (tomatoColor === 'break') store.data.calendarColorBreak = color;
                if (tomatoColor === 'stopwatch') store.data.calendarColorStopwatch = color;
                if (tomatoColor === 'idle') store.data.calendarColorIdle = color;
                try { await store.save(); } catch (e2) {}
                try { renderSidebar(wrap, getSettings()); } catch (e2) {}
                try { calendar.refetchEvents(); } catch (e2) {}
                return;
            }
            const checked = !!el.checked;
            const master = String(el.getAttribute('data-tm-cal-master') || '').trim();
            if (master) {
                if (master === 'schedule') store.data.calendarShowSchedule = checked;
                if (master === 'tomato') store.data.calendarShowTomatoMaster = checked;
                try { await store.save(); } catch (e2) {}
                try { renderSidebar(wrap, getSettings()); } catch (e2) {}
                try { calendar.refetchEvents(); } catch (e2) {}
                return;
            }
            const calId = String(el.getAttribute('data-tm-cal-calendar') || '').trim();
            const key = String(el.getAttribute('data-tm-cal-filter') || '').trim();
            if (!calId && !key) return;

            if (calId) {
                const prev = (store.data.calendarCalendarsConfig && typeof store.data.calendarCalendarsConfig === 'object' && !Array.isArray(store.data.calendarCalendarsConfig))
                    ? store.data.calendarCalendarsConfig
                    : {};
                const entry = (prev[calId] && typeof prev[calId] === 'object') ? prev[calId] : {};
                store.data.calendarCalendarsConfig = { ...prev, [calId]: { ...entry, enabled: checked } };
                if (!checked && String(store.data.calendarDefaultCalendarId || 'default') === calId) {
                    const nextDefault = pickDefaultCalendarId(getSettings());
                    store.data.calendarDefaultCalendarId = nextDefault;
                }
            }

            if (key) {
                if (key === 'scheduleMaster') store.data.calendarShowSchedule = checked;
                if (key === 'taskDatesMaster') store.data.calendarShowTaskDates = checked;
                if (key === 'cnHoliday') store.data.calendarShowCnHoliday = checked;
                if (key === 'focus') store.data.calendarShowFocus = checked;
                if (key === 'break') store.data.calendarShowBreak = checked;
                if (key === 'stopwatch') store.data.calendarShowStopwatch = checked;
                if (key === 'idle') store.data.calendarShowIdle = checked;
            }
            try { await store.save(); } catch (e2) {}
            try { renderSidebar(wrap, getSettings()); } catch (e2) {}
            try { calendar.refetchEvents(); } catch (e2) {}
        };
        wrap.addEventListener('change', onFilterChange);
        state.onFilterChange = onFilterChange;

        state.tomatoListener = (ev) => {
            const s2 = getSettings();
            if (!s2.linkDockTomato) return;
            scheduleTomatoRefetch();
        };
        window.addEventListener('tomato:history-updated', state.tomatoListener);
        try { bindScheduleReminderEngine(); } catch (e) {}

        return true;
    }

    function unmount() {
        closeModal();
        if (state.wrapEl) {
            try { if (state.onToolbarClick) state.wrapEl.removeEventListener('click', state.onToolbarClick); } catch (e) {}
            try { if (state.onSidebarContextMenu) state.wrapEl.removeEventListener('contextmenu', state.onSidebarContextMenu); } catch (e) {}
            try { if (state.onFilterChange) state.wrapEl.removeEventListener('change', state.onFilterChange); } catch (e) {}
            try { if (state.onCalendarEventClickFallbackCapture) state.wrapEl.removeEventListener('click', state.onCalendarEventClickFallbackCapture, true); } catch (e) {}
        }
        state.onToolbarClick = null;
        state.onSidebarContextMenu = null;
        state.onFilterChange = null;
        state.onCalendarEventClickFallbackCapture = null;
        state.wrapEl = null;
        if (state.uiAbort) {
            try { state.uiAbort.abort(); } catch (e) {}
            state.uiAbort = null;
        }
        try { state.taskTableAbort?.abort?.(); } catch (e) {}
        state.taskTableAbort = null;
        if (state.tomatoListener) {
            try { window.removeEventListener('tomato:history-updated', state.tomatoListener); } catch (e) {}
            state.tomatoListener = null;
        }
        if (state.filteredTasksListener) {
            try { window.removeEventListener('tm:filtered-tasks-updated', state.filteredTasksListener); } catch (e) {}
            state.filteredTasksListener = null;
        }
        // 清理页面可见性变化监听器
        if (state.onVisibilityChange) {
            try { document.removeEventListener('visibilitychange', state.onVisibilityChange); } catch (e) {}
            state.onVisibilityChange = null;
        }
        // 清理 ResizeObserver
        if (state.calendarResizeObserver) {
            try { state.calendarResizeObserver.disconnect(); } catch (e) {}
            state.calendarResizeObserver = null;
        }
        if (state.tomatoRefetchTimer) {
            try { clearTimeout(state.tomatoRefetchTimer); } catch (e) {}
            state.tomatoRefetchTimer = null;
        }
        if (state.calendar) {
            try { state.calendar.destroy(); } catch (e) {}
        }
        state.calendar = null;
        try { state.miniAbort?.abort(); } catch (e) {}
        state.miniAbort = null;
        state.miniMonthKey = '';
        if (state.taskDraggable) {
            try { state.taskDraggable.destroy(); } catch (e) {}
        }
        if (state.mobileDragCloseTimer) {
            try { clearTimeout(state.mobileDragCloseTimer); } catch (e) {}
            state.mobileDragCloseTimer = null;
        }
        state.taskDraggable = null;
        state.taskListEl = null;
        if (state._persistTimer) {
            try { clearTimeout(state._persistTimer); } catch (e) {}
            state._persistTimer = null;
        }
        if (state.sidebarResizeCleanup) {
            try { state.sidebarResizeCleanup(); } catch (e) {}
            state.sidebarResizeCleanup = null;
        }
        if (state.sidebarColorMenuBindTimer) {
            try { clearTimeout(state.sidebarColorMenuBindTimer); } catch (e) {}
            state.sidebarColorMenuBindTimer = null;
        }
        if (state.sidebarColorMenuCloseHandler) {
            try { document.removeEventListener('click', state.sidebarColorMenuCloseHandler); } catch (e) {}
            try { document.removeEventListener('contextmenu', state.sidebarColorMenuCloseHandler); } catch (e) {}
            try { window.removeEventListener('resize', state.sidebarColorMenuCloseHandler); } catch (e) {}
            state.sidebarColorMenuCloseHandler = null;
        }
        if (state.rootEl) {
            try { state.rootEl.innerHTML = ''; } catch (e) {}
        }
        state.mounted = false;
        state.rootEl = null;
        state.calendarEl = null;
        state.miniCalendarEl = null;
        state.settingsStore = null;
        state.opts = null;
        state.isMobileDevice = false;
        state.sidebarOpen = false;
    }

    function renderSettings(containerEl, settingsStore) {
        if (!containerEl || !(containerEl instanceof Element)) return false;
        state.settingsStore = settingsStore || state.settingsStore || null;
        const s = getSettings();
        const visibleRange = getCalendarVisibleSlotRange(s);
        const visibleStartOptions = buildCalendarVisibleTimeOptions(visibleRange.start, false);
        const visibleEndOptions = buildCalendarVisibleTimeOptions(visibleRange.end, true);
        const tomatoRows = s.linkDockTomato ? `
                <div class="tm-calendar-settings-row">
                    <div class="tm-calendar-settings-label">月视图隐藏番茄钟</div>
                    <input class="b3-switch fn__flex-center" type="checkbox" data-tm-cal-setting="calendarMonthAggregate" ${s.monthAggregate ? 'checked' : ''}>
                </div>
                <div class="tm-calendar-settings-row">
                    <div class="tm-calendar-settings-label">显示休息记录</div>
                    <input class="b3-switch fn__flex-center" type="checkbox" data-tm-cal-setting="calendarShowBreak" ${s.showBreak ? 'checked' : ''}>
                </div>
                <div class="tm-calendar-settings-row">
                    <div class="tm-calendar-settings-label">显示闲置记录</div>
                    <input class="b3-switch fn__flex-center" type="checkbox" data-tm-cal-setting="calendarShowIdle" ${s.showIdle ? 'checked' : ''}>
                </div>
        ` : '';
        containerEl.innerHTML = `
            <div class="tm-calendar-settings">
                <div class="tm-calendar-settings-row">
                    <div class="tm-calendar-settings-label">启用日历视图</div>
                    <input class="b3-switch fn__flex-center" type="checkbox" data-tm-cal-setting="calendarEnabled" ${s.enabled ? 'checked' : ''}>
                </div>
                <div class="tm-calendar-settings-row">
                    <div class="tm-calendar-settings-label">联通底栏番茄钟</div>
                    <input class="b3-switch fn__flex-center" type="checkbox" data-tm-cal-setting="calendarLinkDockTomato" ${s.linkDockTomato ? 'checked' : ''}>
                </div>
                <div class="tm-calendar-settings-row">
                    <div class="tm-calendar-settings-label">日历起始日</div>
                    <select class="tm-calendar-settings-select" data-tm-cal-setting="calendarFirstDay">
                        <option value="1" ${Number(s.firstDay) === 1 ? 'selected' : ''}>周一</option>
                        <option value="0" ${Number(s.firstDay) === 0 ? 'selected' : ''}>周日</option>
                    </select>
                </div>
                <div class="tm-calendar-settings-row">
                    <div class="tm-calendar-settings-label">显示起始时间</div>
                    <select class="tm-calendar-settings-select" data-tm-cal-setting="calendarVisibleStartTime">${visibleStartOptions}</select>
                </div>
                <div class="tm-calendar-settings-row">
                    <div class="tm-calendar-settings-label">显示结束时间</div>
                    <select class="tm-calendar-settings-select" data-tm-cal-setting="calendarVisibleEndTime">${visibleEndOptions}</select>
                </div>
                <div class="tm-calendar-settings-row">
                    <div class="tm-calendar-settings-label">每小时格子高度</div>
                    <select class="tm-calendar-settings-select" data-tm-cal-setting="calendarHourSlotHeightMode">
                        <option value="normal" ${s.hourSlotHeightMode === 'normal' ? 'selected' : ''}>标准</option>
                        <option value="high" ${s.hourSlotHeightMode === 'high' ? 'selected' : ''}>高（+10px）</option>
                        <option value="higher" ${s.hourSlotHeightMode === 'higher' ? 'selected' : ''}>更高（+20px）</option>
                        <option value="ultra" ${s.hourSlotHeightMode === 'ultra' ? 'selected' : ''}>超高（+30px）</option>
                    </select>
                </div>
                <div class="tm-calendar-settings-row">
                    <div class="tm-calendar-settings-label">日程默认最大新建时长</div>
                    <select class="tm-calendar-settings-select" data-tm-cal-setting="calendarNewScheduleMaxDurationMin">
                        <option value="60" ${Number(s.newScheduleMaxDurationMin) === 60 ? 'selected' : ''}>1 小时</option>
                        <option value="120" ${Number(s.newScheduleMaxDurationMin) === 120 ? 'selected' : ''}>2 小时</option>
                        <option value="180" ${Number(s.newScheduleMaxDurationMin) === 180 ? 'selected' : ''}>3 小时</option>
                        <option value="240" ${Number(s.newScheduleMaxDurationMin) === 240 ? 'selected' : ''}>4 小时</option>
                    </select>
                </div>
                <div class="tm-calendar-settings-row">
                    <div class="tm-calendar-settings-label">显示农历</div>
                    <input class="b3-switch fn__flex-center" type="checkbox" data-tm-cal-setting="calendarShowLunar" ${s.showLunar ? 'checked' : ''}>
                </div>
                ${tomatoRows}
                <div class="tm-calendar-settings-row">
                    <div class="tm-calendar-settings-label">显示跨天任务</div>
                    <input class="b3-switch fn__flex-center" type="checkbox" data-tm-cal-setting="calendarShowTaskDates" ${s.showTaskDates ? 'checked' : ''}>
                </div>
                <div class="tm-calendar-settings-row">
                    <div class="tm-calendar-settings-label">日程提醒</div>
                    <input class="b3-switch fn__flex-center" type="checkbox" data-tm-cal-setting="calendarScheduleReminderEnabled" ${s.scheduleReminderEnabled ? 'checked' : ''}>
                </div>
                <div class="tm-calendar-settings-row" style="${s.scheduleReminderEnabled ? '' : 'opacity:0.55;pointer-events:none;'}">
                    <div class="tm-calendar-settings-label">日程默认提醒</div>
                    <select class="tm-calendar-settings-select" data-tm-cal-setting="calendarScheduleReminderDefaultMode">
                        <option value="off" ${String(s.scheduleReminderDefaultMode) === 'off' ? 'selected' : ''}>关闭</option>
                        <option value="0" ${String(s.scheduleReminderDefaultMode) === '0' ? 'selected' : ''}>准时提醒</option>
                        <option value="5" ${String(s.scheduleReminderDefaultMode) === '5' ? 'selected' : ''}>5 分钟前</option>
                        <option value="10" ${String(s.scheduleReminderDefaultMode) === '10' ? 'selected' : ''}>10 分钟前</option>
                        <option value="15" ${String(s.scheduleReminderDefaultMode) === '15' ? 'selected' : ''}>15 分钟前</option>
                        <option value="30" ${String(s.scheduleReminderDefaultMode) === '30' ? 'selected' : ''}>30 分钟前</option>
                        <option value="60" ${String(s.scheduleReminderDefaultMode) === '60' ? 'selected' : ''}>1 小时前</option>
                    </select>
                </div>
                <div class="tm-calendar-settings-row" style="${s.scheduleReminderEnabled ? '' : 'opacity:0.55;pointer-events:none;'}">
                    <div class="tm-calendar-settings-label">系统弹窗提醒</div>
                    <input class="b3-switch fn__flex-center" type="checkbox" data-tm-cal-setting="calendarScheduleReminderSystemEnabled" ${s.scheduleReminderSystemEnabled ? 'checked' : ''}>
                </div>
                <div class="tm-calendar-settings-row" style="${s.scheduleReminderEnabled ? '' : 'opacity:0.55;pointer-events:none;'}">
                    <div class="tm-calendar-settings-label">全天事件提醒</div>
                    <input class="b3-switch fn__flex-center" type="checkbox" data-tm-cal-setting="calendarAllDayReminderEnabled" ${s.allDayReminderEnabled ? 'checked' : ''}>
                </div>
                <div class="tm-calendar-settings-row" style="${s.scheduleReminderEnabled ? '' : 'opacity:0.55;pointer-events:none;'}">
                    <div class="tm-calendar-settings-label">跨天事项全天提醒</div>
                    <input class="b3-switch fn__flex-center" type="checkbox" data-tm-cal-setting="calendarTaskDateAllDayReminderEnabled" ${s.taskDateAllDayReminderEnabled ? 'checked' : ''}>
                </div>
                <div class="tm-calendar-settings-row" style="${s.scheduleReminderEnabled ? '' : 'opacity:0.55;pointer-events:none;'}">
                    <div class="tm-calendar-settings-label">全天汇总包含番茄/节日</div>
                    <input class="b3-switch fn__flex-center" type="checkbox" data-tm-cal-setting="calendarAllDaySummaryIncludeExtras" ${s.allDaySummaryIncludeExtras ? 'checked' : ''}>
                </div>
                <div class="tm-calendar-settings-row" style="${(s.scheduleReminderEnabled && (s.allDayReminderEnabled || s.taskDateAllDayReminderEnabled)) ? '' : 'opacity:0.55;pointer-events:none;'}">
                    <div class="tm-calendar-settings-label">全天提醒时间</div>
                    <input class="tm-calendar-settings-select" style="height:34px;" type="time" data-tm-cal-setting="calendarAllDayReminderTime" value="${esc(String(s.allDayReminderTime || '09:00'))}">
                </div>
                <div class="tm-calendar-settings-row">
                    <div class="tm-calendar-settings-label">跨天任务颜色</div>
                    <select class="tm-calendar-settings-select" data-tm-cal-setting="calendarTaskDateColorMode">
                        <option value="group" ${s.taskDateColorMode === 'group' ? 'selected' : ''}>跟随文档分组</option>
                        <option value="gray" ${s.taskDateColorMode === 'gray' ? 'selected' : ''}>统一灰色</option>
                    </select>
                </div>
                <div class="tm-calendar-settings-hint">
                    保存按钮会将上述设置写入任务管理器配置。日历编辑需要底栏番茄钟插件提供历史编辑接口。
                    <br>例如将显示起始时间设为 06:00，即可隐藏 00:00-06:00。
                </div>
            </div>
        `;

        state.settingsAbort?.abort();
        const abort = new AbortController();
        state.settingsAbort = abort;

        containerEl.addEventListener('change', async (e) => {
            const el = e.target;
            const key = String(el?.getAttribute?.('data-tm-cal-setting') || '');
            if (!key) return;
            const store = state.settingsStore;
            if (!store || !store.data) return;
            if (key === 'calendarFirstDay') {
                store.data[key] = String(el.value || '').trim() === '0' ? 0 : 1;
            } else if (key === 'calendarNewScheduleMaxDurationMin') {
                const allowed = new Set([60, 120, 180, 240]);
                const num = Number(el.value);
                store.data[key] = allowed.has(num) ? num : 60;
            } else if (key === 'calendarHourSlotHeightMode') {
                store.data[key] = normalizeCalendarHourSlotHeightMode(el.value);
            } else if (el.type === 'checkbox') {
                store.data[key] = !!el.checked;
            } else {
                store.data[key] = String(el.value || '');
            }
            if (key === 'calendarScheduleReminderSystemEnabled' && store.data[key]) {
                try {
                    if (typeof Notification !== 'undefined' && Notification && typeof Notification.requestPermission === 'function') {
                        const perm = String(Notification.permission || '');
                        if (perm !== 'granted') {
                            await Notification.requestPermission();
                        }
                    }
                } catch (e2) {}
            }
            try {
                if (typeof store.flushSave === 'function') {
                    store.saveDirty = true;
                    try { if (store.saveTimer) clearTimeout(store.saveTimer); } catch (e2) {}
                    store.saveTimer = null;
                    await store.flushSave();
                } else if (typeof store.save === 'function') {
                    await store.save();
                }
            } catch (e2) {}
            try {
                if (key === 'calendarLinkDockTomato') {
                    try { renderSettings(containerEl, store); } catch (e2) {}
                    try {
                        const root = state.rootEl;
                        if (root) renderSidebar(root, getSettings());
                    } catch (e2) {}
                    try { state.calendar?.refetchEvents?.(); } catch (e2) {}
                } else if (key === 'calendarVisibleStartTime' || key === 'calendarVisibleEndTime') {
                    const settings = getSettings();
                    try { applyCalendarVisibleSlotRange(state.calendar, settings); } catch (e2) {}
                    try { applyCalendarVisibleSlotRange(state.sideDay?.calendar, settings); } catch (e2) {}
                    try { state.calendar?.updateSize?.(); } catch (e2) {}
                    try { syncSideDayLayout(state.sideDay?.rootEl, state.sideDay?.calendar, settings); } catch (e2) {}
                } else if (key === 'calendarHourSlotHeightMode') {
                    const settings = getSettings();
                    try { refreshCalendarSlotHeight(settings); } catch (e2) {}
                } else if (key === 'calendarScheduleReminderEnabled' || key === 'calendarScheduleReminderSystemEnabled' || key === 'calendarScheduleReminderDefaultMode' || key === 'calendarAllDayReminderEnabled' || key === 'calendarAllDayReminderTime' || key === 'calendarTaskDateAllDayReminderEnabled' || key === 'calendarAllDaySummaryIncludeExtras') {
                    try { renderSettings(containerEl, store); } catch (e2) {}
                    try { scheduleScheduleReminderRefresh('settings'); } catch (e2) {}
                } else if (key === 'calendarNewScheduleMaxDurationMin') {
                    try {
                        const root = state.rootEl;
                        if (root) renderTaskPage(root, getSettings());
                    } catch (e2) {}
                } else if (state.calendar) {
                    if (key === 'calendarFirstDay') {
                        try { state.calendar.setOption('firstDay', Number(store.data.calendarFirstDay) === 0 ? 0 : 1); } catch (e2) {}
                        try { renderMiniCalendar(state.rootEl); } catch (e2) {}
                    }
                    try { state.calendar.refetchEvents(); } catch (e2) {}
                    if (key === 'calendarShowLunar') {
                        try { requestAnimationFrame(() => { try { applyCnLunarLabels(state.rootEl); } catch (e4) {} }); } catch (e4) {}
                    }
                    if (key === 'calendarMonthAggregate') {
                        try { state.calendar.rerenderEvents(); } catch (e2) {}
                        try {
                            const vt = String(state.calendar?.view?.type || '').trim();
                            if (vt === 'dayGridMonth') {
                                const d = state.calendar?.getDate?.();
                                if (d) requestAnimationFrame(() => { try { state.calendar.changeView('dayGridMonth', d); } catch (e4) {} });
                            }
                        } catch (e2) {}
                    }
                }
            } catch (e3) {}
        }, { signal: abort.signal });

        return true;
    }

    function cleanup() {
        unmountSideDayTimeline();
        unmount();
        try { unbindScheduleReminderEngine(); } catch (e) {}
        state.settingsAbort?.abort();
        state.settingsAbort = null;
    }

    function setSettingsStore(settingsStore) {
        state.settingsStore = settingsStore || state.settingsStore || null;
        try { bindScheduleReminderEngine(); } catch (e) {}
        try { scheduleScheduleReminderRefresh('set-store'); } catch (e) {}
        return true;
    }

    async function openScheduleEditorById(scheduleId) {
        const id = String(scheduleId || '').trim();
        if (!id) return false;
        try {
            const list = await loadScheduleAll();
            const item = (Array.isArray(list) ? list : []).find((x) => String(x?.id || '').trim() === id) || null;
            if (!item) {
                toast('⚠ 未找到日程', 'warning');
                return false;
            }
            const startMs = toMs(item.start);
            const endMs = toMs(item.end);
            if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
                toast('⚠ 日程时间不合法', 'warning');
                return false;
            }
            const start = new Date(startMs);
            const end = new Date(endMs);
            const allDay = (item.allDay === true) || isAllDayRange(start, end);
            openScheduleModal({
                id,
                title: String(item.title || '').trim(),
                start,
                end,
                allDay,
                color: String(item.color || '#0078d4'),
                calendarId: String(item.calendarId || 'default'),
                taskId: String(item.taskId || item.task_id || item.linkedTaskId || item.linked_task_id || '').trim(),
                reminderMode: String(item.reminderMode || ''),
                reminderEnabled: item.reminderEnabled,
                reminderOffsetMin: item.reminderOffsetMin,
                repeatType: getScheduleRepeatType(item),
                repeatEvery: getScheduleRepeatEvery(item),
                repeatUntil: getScheduleRepeatUntil(item),
                repeatMonthlyMode: getScheduleRepeatMonthlyMode(item),
                notificationSchedules: buildScheduleNotificationSchedulesView(item),
            });
            return true;
        } catch (e) {
            try { toast('❌ 打开失败', 'error'); } catch (e2) {}
            return false;
        }
    }

    async function openScheduleEditorByTaskId(taskId, opt) {
        const tid = String(taskId || '').trim();
        if (!tid) return false;
        const extra = (opt && typeof opt === 'object') ? opt : {};
        try {
            const list = await loadScheduleAll();
            const items = (Array.isArray(list) ? list : []).filter((x) => {
                const t = String(x?.taskId || x?.task_id || x?.linkedTaskId || x?.linked_task_id || '').trim();
                return t === tid;
            }).sort((a, b) => toMs(a?.start) - toMs(b?.start));
            if (items.length === 0) {
                const startKey = String(extra.taskDateStartKey || extra.startKey || '').trim();
                const endExKey = String(extra.taskDateEndExclusiveKey || extra.endExclusiveKey || '').trim();
                const title0 = String(extra.title || '').trim();
                if (startKey && endExKey) {
                    const startDate = parseDateOnly(startKey);
                    const endDate = parseDateOnly(endExKey);
                    if (startDate && endDate) {
                        const s = new Date(startDate.getTime());
                        s.setHours(0, 0, 0, 0);
                        const e = new Date(endDate.getTime());
                        e.setHours(0, 0, 0, 0);
                        if (e.getTime() > s.getTime()) {
                            openScheduleModal({
                                title: title0 || '任务',
                                start: s,
                                end: e,
                                allDay: true,
                                calendarId: String(extra.calendarId || 'default').trim() || 'default',
                                taskId: tid,
                                reminderMode: 'inherit',
                            });
                            return true;
                        }
                    }
                }
                toast('⚠ 该任务暂无日程', 'warning');
                return false;
            }
            const now = Date.now();
            const next = items.find((x) => {
                const s = toMs(x?.start);
                return Number.isFinite(s) && s >= now;
            }) || items[items.length - 1];
            const sid = String(next?.id || '').trim();
            if (!sid) return false;
            return await openScheduleEditorById(sid);
        } catch (e) {
            try { toast('❌ 打开失败', 'error'); } catch (e2) {}
            return false;
        }
    }

    async function deleteScheduleById(scheduleId, options = {}) {
        const id = String(scheduleId || '').trim();
        if (!id) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const list = await loadScheduleAll();
        const next = list.filter((x) => String(x?.id || '').trim() !== id);
        if (next.length === list.length) return false;
        await saveScheduleAll(next);
        if (opts.closeModal !== false) {
            try { closeModal(); } catch (e) {}
        }
        try { refetchAllCalendars(); } catch (e) {}
        try {
            const cal = state.calendar;
            const vt = String(cal?.view?.type || '');
            if (cal && vt === 'dayGridMonth') {
                const d = cal.getDate?.();
                if (d) requestAnimationFrame(() => { try { cal.changeView('dayGridMonth', d); } catch (e) {} });
            }
        } catch (e) {}
        try { setTimeout(() => { try { refetchAllCalendars(); } catch (e) {} }, 380); } catch (e) {}
        return true;
    }

    function showScheduleEventContextMenu(event, meta = {}) {
        const scheduleId = String(meta?.scheduleId || '').trim();
        if (!scheduleId) return false;
        try { event?.preventDefault?.(); } catch (e) {}
        try { event?.stopPropagation?.(); } catch (e) {}
        const existing = document.getElementById('tm-calendar-schedule-context-menu');
        if (existing) {
            try { existing.remove(); } catch (e) {}
        }
        const menu = document.createElement('div');
        menu.id = 'tm-calendar-schedule-context-menu';
        menu.style.cssText = `
            position: fixed;
            left: 0;
            top: 0;
            min-width: 180px;
            background: var(--b3-theme-background, #fff);
            color: var(--b3-theme-on-background, #222);
            border: 1px solid var(--b3-theme-surface-lighter, rgba(0,0,0,0.1));
            border-radius: 8px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.16);
            z-index: 100020;
            padding: 6px 0;
        `;
        const close = () => {
            try { menu.remove(); } catch (e) {}
            try { document.removeEventListener('click', close, true); } catch (e) {}
            try { document.removeEventListener('contextmenu', close, true); } catch (e) {}
        };
        const createItem = (label, onClick, danger = false) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.textContent = label;
            item.style.cssText = `
                display:block;
                width:100%;
                border:none;
                background:transparent;
                text-align:left;
                padding:8px 12px;
                cursor:pointer;
                color:${danger ? 'var(--b3-theme-error, #d32f2f)' : 'inherit'};
            `;
            item.onmouseenter = () => { item.style.background = 'var(--b3-theme-surface-light, rgba(0,0,0,0.05))'; };
            item.onmouseleave = () => { item.style.background = 'transparent'; };
            item.onclick = async (ev) => {
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                close();
                await onClick();
            };
            return item;
        };
        menu.appendChild(createItem('编辑日程', async () => {
            try { await openScheduleEditorById(scheduleId); } catch (e) { try { toast(`❌ ${String(e?.message || e)}`, 'error'); } catch (e2) {} }
        }));
        const taskId = String(meta?.taskId || '').trim();
        const taskName = String(meta?.title || '').trim() || '任务';
        const startMs = toMs(meta?.start);
        const endMs = toMs(meta?.end);
        const durationMin = (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs)
            ? Math.max(1, Math.round((endMs - startMs) / 60000))
            : 25;
        if (taskId) {
            menu.appendChild(createItem(`按 ${durationMin} 分钟开始番茄`, async () => {
                const timer = globalThis.__tomatoTimer;
                const startFromTaskBlock = timer?.startFromTaskBlock;
                const startCountdown = timer?.startCountdown;
                if (typeof startFromTaskBlock === 'function') {
                    await startFromTaskBlock(taskId, taskName, durationMin, 'countdown');
                    try { timer?.refreshUI?.(); } catch (e) {}
                    return;
                }
                if (typeof startCountdown === 'function') {
                    await startCountdown(taskId, taskName, durationMin);
                    try { timer?.refreshUI?.(); } catch (e) {}
                    return;
                }
                toast('⚠ 未检测到番茄计时功能', 'warning');
            }));
            menu.appendChild(createItem('跳转关联任务', async () => {
                try { window.tmJumpToTask?.(taskId, event); } catch (e) {}
            }));
        }
        menu.appendChild(createItem('删除日程', async () => {
            const ok = await deleteScheduleById(scheduleId, { closeModal: false });
            if (ok) toast('✅ 已删除', 'success');
            else toast('⚠ 未找到日程', 'warning');
        }, true));
        document.body.appendChild(menu);
        const rect = menu.getBoundingClientRect();
        const vw = Math.max(0, window.innerWidth || document.documentElement.clientWidth || 0);
        const vh = Math.max(0, window.innerHeight || document.documentElement.clientHeight || 0);
        const margin = 8;
        let x = Number(event?.clientX) || 0;
        let y = Number(event?.clientY) || 0;
        if (x + rect.width > vw - margin) x = Math.max(margin, vw - rect.width - margin);
        if (y + rect.height > vh - margin) y = Math.max(margin, vh - rect.height - margin);
        menu.style.left = `${Math.max(margin, x)}px`;
        menu.style.top = `${Math.max(margin, y)}px`;
        setTimeout(() => {
            try { document.addEventListener('click', close, true); } catch (e) {}
            try { document.addEventListener('contextmenu', close, true); } catch (e) {}
        }, 0);
        return true;
    }

    globalThis.__tmCalendar = {
        mount,
        unmount,
        renderSettings,
        cleanup,
        toggleSidebar: (open, page) => {
            const wrap = state.wrapEl;
            if (!wrap) return false;
            return toggleMobileSidebar(wrap, open, page);
        },
        openSidebar: (page) => {
            const wrap = state.wrapEl;
            if (!wrap) return false;
            return setCalendarSidebarOpen(wrap, true, page || state.sidePage || 'calendar');
        },
        closeSidebar: () => {
            const wrap = state.wrapEl;
            if (!wrap) return false;
            return setCalendarSidebarOpen(wrap, false);
        },
        mountSideDayTimeline,
        unmountSideDayTimeline,
        setSideDayDate,
        shiftSideDay,
        getSideDayDate,
        relayoutSideDayDate,
        addTaskSchedule,
        listTaskSchedulesByDay,
        openScheduleEditorById,
        openScheduleEditorByTaskId,
        deleteScheduleById,
        setSettingsStore,
        refreshInPlace,
        refreshSideDayLayout,
    };
})();
