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
    const CALENDAR_MONTH_MIN_ROW_HEIGHT = 78;
    const CALENDAR_HOUR_SLOT_HEIGHT_DELTA_MAP = Object.freeze({
        normal: 0,
        high: 10,
        higher: 20,
        ultra: 30,
    });
    const DEVICE_NOTIFICATION_CHANNEL = 'siyuan-plugin-task-horizon';
    const EVENT_SOURCE_IDS = {
        mainTaskDate: 'tm-taskdate-main',
        sideTaskDate: 'tm-taskdate-side',
        mainSchedule: 'tm-schedule-main',
        sideSchedule: 'tm-schedule-side',
    };

    function setStylePropertyIfChanged(node, prop, value, priority = '') {
        if (!(node instanceof HTMLElement)) return false;
        const nextValue = String(value ?? '');
        const nextPriority = String(priority || '');
        try {
            if (
                node.style.getPropertyValue(prop) === nextValue
                && node.style.getPropertyPriority(prop) === nextPriority
            ) {
                return false;
            }
            node.style.setProperty(prop, nextValue, nextPriority);
            return true;
        } catch (e) {}
        return false;
    }

    function setImportantStyleIfChanged(node, prop, value) {
        return setStylePropertyIfChanged(node, prop, value, 'important');
    }

    function removeStylePropertyIfPresent(node, prop) {
        if (!(node instanceof HTMLElement)) return false;
        try {
            if (!node.style.getPropertyValue(prop) && !node.style.getPropertyPriority(prop)) return false;
            node.style.removeProperty(prop);
            return true;
        } catch (e) {}
        return false;
    }

    const state = {
        mounted: false,
        rootEl: null,
        calendarEl: null,
        calendar: null,
        miniCalendarEl: null,
        miniMonthKey: '',
        miniAbort: null,
        taskListEl: null,
        taskPageHost: null,
        taskPageHtml: '',
        taskPageRenderRaf: null,
        taskPageRenderWrap: null,
        taskPageRenderSettings: null,
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
        calendarDropAbort: null,
        calendarDropPreviewDayKey: '',
        settingsAbort: null,
        uiAbort: null,
        modalEl: null,
        deviceScheduleModalEl: null,
        deviceScheduleAbort: null,
        isMobileDevice: false,
        isDockHost: false,
        sidebarOpen: false,
        mobileDragCloseTimer: null,
        sidebarColorMenuCloseHandler: null,
        sidebarColorMenuBindTimer: null,
        sidebarResizeCleanup: null,
        onVisibilityChange: null,
        calendarResizeObserver: null,
        calendarResizeBox: null,
        mainLayoutRaf: null,
        mainLayoutWrap: null,
        mainLayoutHost: null,
        mainLayoutCalendar: null,
        mainLayoutNeedsUpdateSize: false,
        mainTimeGridAutoCenterKey: '',
        mainTimeGridAutoCenterPendingKey: '',
        mainTimeGridAutoCenterToken: 0,
        allDayCollapsed: false,
        cnHolidaySignature: '',
        calendarMutationVersion: 0,
        calendarRenderedVersionMain: 0,
        calendarRenderedVersionSide: 0,
        calendarRefreshTimer: null,
        calendarRefreshPending: null,
        calendarRefreshLastApplied: null,
        mainCalendarStatus: {
            records: 0,
            schedules: 0,
            taskDates: 0,
            holidays: 0,
            reminders: 0,
            rawTotal: 0,
            bad: 0,
            minTxt: '-',
            maxTxt: '-',
            total: 0,
        },
        scheduleCache: {
            list: null,
            loadedAt: 0,
            inflight: null,
            sourceSignature: '',
        },
        linkedDocIdCache: new Map(),
        reminderCache: {
            list: null,
            loadedAt: 0,
            inflight: null,
        },
        scheduleReminder: {
            enabled: false,
            refreshTimer: null,
            refreshRunning: false,
            refreshQueued: false,
            pendingReason: '',
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
            allDayCollapsed: false,
            resizeBox: null,
            settingsStore: null,
            resolveTask: null,
            dragHost: null,
            draggable: null,
            nativeDropAbort: null,
            previewEl: null,
            popoverObserver: null,
            popoverClickCapture: null,
            autoCenterKey: '',
            autoCenterPendingKey: '',
            autoCenterToken: 0,
        },
        floatingMini: {
            open: false,
            mode: 'desktop',
            overlayEl: null,
            panelEl: null,
            hostEl: null,
            priorityTooltipEl: null,
            priorityTooltipHideTimer: null,
            containerRect: null,
            monthKey: '',
            selectedDateKey: '',
            sourceDateKey: '',
            hoverDateKey: '',
            dragTaskId: '',
            dragPayload: null,
            dragPriorityKey: 'none',
            priorityHoverKey: '',
            abort: null,
            autoFlipTimer: null,
            autoFlipAction: '',
            pointerClientX: NaN,
            pointerClientY: NaN,
            lastDropAt: 0,
            idleHideTimer: null,
            enteredPanel: false,
        },
    };

    const __tmCalendarDomPassCache = {
        timeGridHeight: new WeakMap(),
        timeAxis: new WeakMap(),
        nowIndicator: new WeakMap(),
        holidayDots: new WeakMap(),
        lunarLabels: new WeakMap(),
    };

    function __tmCreateNodeListStamp(nodes) {
        const list = Array.isArray(nodes) ? nodes : Array.from(nodes || []);
        return {
            count: list.length,
            first: list.length ? list[0] : null,
            last: list.length ? list[list.length - 1] : null,
        };
    }

    function __tmSameNodeListStamp(a, b) {
        return !!a && !!b
            && a.count === b.count
            && a.first === b.first
            && a.last === b.last;
    }

    function __tmShouldSkipCalendarDomPass(cacheMap, rootEl, key, stamps) {
        if (!(rootEl instanceof HTMLElement) || !cacheMap) return false;
        const prev = cacheMap.get(rootEl);
        if (!prev || prev.key !== key) return false;
        const prevStamps = Array.isArray(prev.stamps) ? prev.stamps : [];
        if (prevStamps.length !== stamps.length) return false;
        for (let i = 0; i < stamps.length; i += 1) {
            if (!__tmSameNodeListStamp(prevStamps[i], stamps[i])) return false;
        }
        return true;
    }

    function __tmRememberCalendarDomPass(cacheMap, rootEl, key, stamps) {
        if (!(rootEl instanceof HTMLElement) || !cacheMap) return;
        cacheMap.set(rootEl, { key, stamps });
    }

    function __tmApplyTimeGridHeightLayout(rootEl, settings) {
        if (!(rootEl instanceof HTMLElement)) return false;
        const nextSettings = settings || getSettings();
        const slotHeight = getCalendarHalfHourSlotHeight(nextSettings);
        const contentHeight = getCalendarTimeGridContentHeight(nextSettings);
        const slotNodes = Array.from(rootEl.querySelectorAll('.fc-timegrid-slots tr, .fc-timegrid-slots td, .fc-timegrid-slot, .fc-timegrid-slot-lane, .fc-timegrid-slot-label, .fc-timegrid-slot-frame'));
        const contentNodes = Array.from(rootEl.querySelectorAll('.fc-timegrid-body, .fc-timegrid-cols, .fc-timegrid-cols table, .fc-timegrid-slots, .fc-timegrid-slots table'));
        const passKey = `${slotHeight}|${contentHeight}`;
        const stamps = [
            __tmCreateNodeListStamp(slotNodes),
            __tmCreateNodeListStamp(contentNodes),
        ];
        try { applyCalendarSlotHeightStyle(rootEl, nextSettings); } catch (e) {}
        if (__tmShouldSkipCalendarDomPass(__tmCalendarDomPassCache.timeGridHeight, rootEl, passKey, stamps)) return true;
        for (const node of slotNodes) {
            if (!(node instanceof HTMLElement)) continue;
            try { node.style.setProperty('height', `${slotHeight}px`, 'important'); } catch (e) {}
            try { node.style.setProperty('min-height', `${slotHeight}px`, 'important'); } catch (e) {}
            try { node.style.setProperty('max-height', `${slotHeight}px`, 'important'); } catch (e) {}
            try { node.style.setProperty('box-sizing', 'border-box', 'important'); } catch (e) {}
        }
        for (const node of contentNodes) {
            if (!(node instanceof HTMLElement)) continue;
            try { node.style.setProperty('height', `${contentHeight}px`, 'important'); } catch (e) {}
            try { node.style.setProperty('min-height', `${contentHeight}px`, 'important'); } catch (e) {}
            try { node.style.setProperty('box-sizing', 'border-box', 'important'); } catch (e) {}
        }
        __tmRememberCalendarDomPass(__tmCalendarDomPassCache.timeGridHeight, rootEl, passKey, stamps);
        return true;
    }

    function __tmPerfCreate(kind, meta = {}) {
        try {
            if (typeof globalThis.__tmTaskHorizonPerfCreate === 'function') {
                return globalThis.__tmTaskHorizonPerfCreate(kind, meta);
            }
        } catch (e) {}
        return null;
    }

    function __tmPerfMark(trace, stage, detail = {}) {
        try {
            if (trace && typeof globalThis.__tmTaskHorizonPerfMark === 'function') {
                return globalThis.__tmTaskHorizonPerfMark(trace, stage, detail);
            }
        } catch (e) {}
        return trace;
    }

    function __tmPerfFinish(trace, detail = {}) {
        try {
            if (trace && typeof globalThis.__tmTaskHorizonPerfFinish === 'function') {
                return globalThis.__tmTaskHorizonPerfFinish(trace, detail);
            }
        } catch (e) {}
        return trace;
    }

    const MAIN_CALENDAR_CUSTOM_VIEWS = {
        timeGridDay: {
            type: 'timeGridDay',
            titleFormat: { month: 'numeric', day: 'numeric' },
        },
        timeGrid3Day: {
            type: 'timeGrid',
            duration: { days: 3 },
            buttonText: '3日',
            titleFormat: { month: 'numeric', day: 'numeric' },
        },
        timeGridWorkdays: {
            type: 'timeGridWeek',
            hiddenDays: [0, 6],
            buttonText: '工作日',
            titleFormat: { month: 'numeric', day: 'numeric' },
        },
        timeGridWeek: {
            type: 'timeGridWeek',
            titleFormat: { month: 'numeric', day: 'numeric' },
        },
        dayGridMonth: {
            type: 'dayGridMonth',
            titleFormat: { month: 'numeric' },
            fixedWeekCount: false,
            moreLinkText: (n) => `+${n}`,
        },
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
    const SCHEDULE_EDITOR_MORANDI_PRESET_COLORS = Object.freeze([
        '#D57A63',
        '#F7C27A',
        '#DAD85A',
        '#A5C8B9',
        '#76C5CF',
        '#7FA2DA',
        '#A489C5',
        '#C779A0',
    ]);

    function getMainCalendarViewTypeFromButton(buttonEl) {
        if (!(buttonEl instanceof HTMLElement)) return '';
        const classes = Array.from(buttonEl.classList || []);
        for (const className of classes) {
            const match = /^fc-([A-Za-z0-9]+)-button$/.exec(String(className || '').trim());
            const viewType = String(match?.[1] || '').trim();
            if (viewType && MAIN_CALENDAR_ALLOWED_VIEWS.has(viewType)) return viewType;
        }
        return '';
    }

    function syncMainCalendarDesktopViewSegmented(rightChunk, calendar, enabled) {
        const chunkEl = rightChunk instanceof Element ? rightChunk : null;
        const cal = calendar || null;
        if (!chunkEl) return;
        const buttonGroup = chunkEl.querySelector('.fc-button-group');
        if (!(buttonGroup instanceof HTMLElement)) return;
        const viewButtons = Array.from(buttonGroup.querySelectorAll('.fc-button')).filter((buttonEl) => {
            return !!getMainCalendarViewTypeFromButton(buttonEl);
        });
        if (!viewButtons.length) return;
        buttonGroup.classList.toggle('tm-calendar-view-segmented', !!enabled);
        buttonGroup.classList.toggle('tm-view-segmented', !!enabled);
        buttonGroup.classList.toggle('bc-tabs-list', !!enabled);
        if (enabled) {
            buttonGroup.setAttribute('role', 'tablist');
            buttonGroup.setAttribute('aria-label', '日历视图');
        } else {
            try { buttonGroup.removeAttribute('role'); } catch (e) {}
            try { buttonGroup.removeAttribute('aria-label'); } catch (e) {}
        }
        const activeView = String(cal?.view?.type || '').trim();
        viewButtons.forEach((buttonEl) => {
            const viewType = getMainCalendarViewTypeFromButton(buttonEl);
            const active = !!viewType && viewType === activeView;
            buttonEl.classList.toggle('tm-view-seg-item', !!enabled);
            buttonEl.classList.toggle('bc-tabs-trigger', !!enabled);
            buttonEl.classList.toggle('tm-view-seg-item--active', !!enabled && active);
            if (enabled) {
                buttonEl.setAttribute('role', 'tab');
                buttonEl.setAttribute('aria-selected', active ? 'true' : 'false');
                buttonEl.setAttribute('data-state', active ? 'active' : 'inactive');
                const label = String(MAIN_CALENDAR_VIEW_LABELS[viewType] || viewType || buttonEl.textContent || '').trim();
                if (label) buttonEl.title = `切换到${label}视图`;
            } else {
                try { buttonEl.removeAttribute('role'); } catch (e) {}
                try { buttonEl.removeAttribute('aria-selected'); } catch (e) {}
                try { buttonEl.removeAttribute('data-state'); } catch (e) {}
            }
        });
    }

    function esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
    }

    function normalizeColorInputHex(value, fallback = '#7FA2DA') {
        const normalize = (input) => {
            const raw = String(input || '').trim();
            const match = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(raw);
            if (!match) return '';
            let hex = String(match[1] || '').trim();
            if (hex.length === 3) hex = hex.split('').map((ch) => `${ch}${ch}`).join('');
            return `#${hex.toUpperCase()}`;
        };
        return normalize(value) || normalize(fallback) || '#7FA2DA';
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
        try { syncMainCalendarDesktopViewSegmented(rightChunk, cal, !useCompactSelect); } catch (e) {}
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
                    const targetDate = resolveMainCalendarAnchorDate(currentDate, nextView, getSettings());
                    if (targetDate instanceof Date) cal.changeView(nextView, targetDate);
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

    function isSideDayTimelineRoot(rootEl) {
        return !!(rootEl instanceof HTMLElement && (rootEl.id === 'tmCalendarSideDockTimeline' || !!rootEl.closest?.('#tmCalendarSideDockTimeline')));
    }

    function getAllDayCollapseScope(rootEl) {
        return isSideDayTimelineRoot(rootEl) ? 'sideDay' : 'main';
    }

    function getAllDayCollapsed(rootEl) {
        return getAllDayCollapseScope(rootEl) === 'sideDay'
            ? state.sideDay.allDayCollapsed === true
            : state.allDayCollapsed === true;
    }

    function setAllDayCollapsed(rootEl, next) {
        const value = next === true;
        if (getAllDayCollapseScope(rootEl) === 'sideDay') state.sideDay.allDayCollapsed = value;
        else state.allDayCollapsed = value;
        return value;
    }

    function isTimeGridViewType(viewType) {
        const type = String(viewType || '').trim();
        return !!type && type.startsWith('timeGrid');
    }

    function isTimeGridAllDayCollapseSupported(calendar) {
        const viewType = String(calendar?.view?.type || '').trim();
        return !!viewType && viewType !== 'dayGridMonth' && isTimeGridViewType(viewType);
    }

    function getAllDaySummaryCount(calendar) {
        if (!calendar || typeof calendar.getEvents !== 'function') return 0;
        const view = calendar?.view || null;
        const rangeStart = view?.activeStart instanceof Date && !Number.isNaN(view.activeStart.getTime()) ? view.activeStart.getTime() : NaN;
        const rangeEnd = view?.activeEnd instanceof Date && !Number.isNaN(view.activeEnd.getTime()) ? view.activeEnd.getTime() : NaN;
        let total = 0;
        for (const eventApi of (calendar.getEvents() || [])) {
            if (eventApi?.allDay !== true) continue;
            const ext = eventApi?.extendedProps || {};
            if (String(ext.__tmSource || '').trim() === 'cnHoliday') continue;
            const start = eventApi?.start instanceof Date && !Number.isNaN(eventApi.start.getTime()) ? eventApi.start.getTime() : NaN;
            let end = eventApi?.end instanceof Date && !Number.isNaN(eventApi.end.getTime()) ? eventApi.end.getTime() : NaN;
            if (!Number.isFinite(start)) continue;
            if (!Number.isFinite(end) || end <= start) end = start + 86400000;
            if (Number.isFinite(rangeStart) && Number.isFinite(rangeEnd) && !(start < rangeEnd && end > rangeStart)) continue;
            total += 1;
        }
        return total;
    }

    function getAllDaySummaryText(count) {
        const n = Math.max(0, Math.floor(Number(count) || 0));
        return n > 0 ? `+${n} 个任务` : '0 个任务';
    }

    function getAllDayAxisCushions(rootEl) {
        if (!(rootEl instanceof HTMLElement)) return [];
        return Array.from(rootEl.querySelectorAll('.fc-timegrid-axis-cushion')).filter((node) => {
            if (!(node instanceof HTMLElement)) return false;
            const text = String(node.getAttribute('data-tm-cal-original-label') || node.textContent || '').replace(/\s+/g, '').trim();
            return text === '全天';
        });
    }

    function getAllDayRowContext(axisCushion) {
        if (!(axisCushion instanceof HTMLElement)) return null;
        const axisFrame = axisCushion.closest('.fc-timegrid-axis-frame') || axisCushion.parentElement || null;
        const axisCell = axisFrame?.closest?.('th, td') || axisCushion.closest?.('th, td') || null;
        const allDayRow = axisCell?.closest?.('tr') || axisFrame?.closest?.('tr') || null;
        const contentCells = allDayRow
            ? Array.from(allDayRow.children || []).filter((node) => node instanceof HTMLElement && node !== axisCell)
            : [];
        const summaryHost = contentCells.find((cell) => (
            cell instanceof HTMLElement
            && cell.querySelector('.fc-daygrid-body, .fc-scrollgrid-sync-table, .fc-timegrid-all-day, .fc-timegrid-allday, .fc-timegrid-all-day-events, [data-date], table')
        )) || contentCells.find((cell) => cell instanceof HTMLElement && cell.children.length > 0) || contentCells[0] || null;
        const contentTargets = [];
        contentCells.forEach((cell) => {
            if (!(cell instanceof HTMLElement)) return;
            Array.from(cell.children || []).forEach((child) => {
                if (!(child instanceof HTMLElement)) return;
                if (child.classList.contains('tm-cal-allday-summary')) return;
                contentTargets.push(child);
            });
        });
        return {
            axisFrame: axisFrame instanceof HTMLElement ? axisFrame : null,
            axisCell: axisCell instanceof HTMLElement ? axisCell : null,
            allDayRow: allDayRow instanceof HTMLElement ? allDayRow : null,
            contentCells,
            summaryHost: summaryHost instanceof HTMLElement ? summaryHost : null,
            contentTargets,
        };
    }

    function setInlineStyle(el, prop, value, important = false) {
        if (!(el instanceof HTMLElement) || !prop) return;
        try {
            if (value == null || value === '') el.style.removeProperty(prop);
            else el.style.setProperty(prop, String(value), important ? 'important' : '');
        } catch (e) {}
    }

    function applyAllDayCollapsedLayout(rootEl, collapsed) {
        const collapsedRowHeight = 34;
        const collapsedRowHeightCss = `${collapsedRowHeight}px`;
        const axisCushions = getAllDayAxisCushions(rootEl);
        for (const axisCushion of axisCushions) {
            if (!(axisCushion instanceof HTMLElement)) continue;
            const rowContext = getAllDayRowContext(axisCushion);
            const allDayRow = rowContext?.allDayRow || null;
            const summaryHost = rowContext?.summaryHost || null;
            const contentCells = Array.isArray(rowContext?.contentCells) ? rowContext.contentCells : [];
            const contentTargets = Array.isArray(rowContext?.contentTargets) ? rowContext.contentTargets : [];
            const rowCells = allDayRow?.querySelectorAll?.('th, td') || [];
            for (const cell of rowCells) {
                if (!(cell instanceof HTMLElement)) continue;
                setInlineStyle(cell, 'height', collapsed ? collapsedRowHeightCss : '', true);
                setInlineStyle(cell, 'min-height', collapsed ? collapsedRowHeightCss : '', true);
                setInlineStyle(cell, 'max-height', collapsed ? collapsedRowHeightCss : '', true);
                setInlineStyle(cell, 'overflow', collapsed ? 'visible' : '', true);
                setInlineStyle(cell, 'padding-top', collapsed ? '0' : '', true);
                setInlineStyle(cell, 'padding-bottom', collapsed ? '0' : '', true);
                setInlineStyle(cell, 'vertical-align', collapsed ? 'middle' : '', true);
            }
            if (allDayRow instanceof HTMLElement) {
                setInlineStyle(allDayRow, 'height', collapsed ? collapsedRowHeightCss : '', true);
                setInlineStyle(allDayRow, 'min-height', collapsed ? collapsedRowHeightCss : '', true);
                setInlineStyle(allDayRow, 'max-height', collapsed ? collapsedRowHeightCss : '', true);
            }
            for (const cell of contentCells) {
                if (!(cell instanceof HTMLElement)) continue;
                setInlineStyle(cell, 'position', 'relative', true);
                setInlineStyle(cell, 'overflow', collapsed ? 'hidden' : '', true);
                setInlineStyle(cell, 'height', collapsed ? collapsedRowHeightCss : '', true);
                setInlineStyle(cell, 'min-height', collapsed ? collapsedRowHeightCss : '', true);
                setInlineStyle(cell, 'max-height', collapsed ? collapsedRowHeightCss : '', true);
                setInlineStyle(cell, 'border-left-color', collapsed ? 'transparent' : '', true);
                setInlineStyle(cell, 'border-right-color', collapsed ? 'transparent' : '', true);
                setInlineStyle(cell, 'box-shadow', collapsed ? 'none' : '', true);
            }
            if (summaryHost instanceof HTMLElement) {
                setInlineStyle(summaryHost, 'position', 'relative', true);
                setInlineStyle(summaryHost, 'height', collapsed ? collapsedRowHeightCss : '', true);
                setInlineStyle(summaryHost, 'min-height', collapsed ? collapsedRowHeightCss : '', true);
                setInlineStyle(summaryHost, 'max-height', collapsed ? collapsedRowHeightCss : '', true);
                setInlineStyle(summaryHost, 'overflow', 'visible', true);
            }
            for (const node of contentTargets) {
                if (!(node instanceof HTMLElement)) continue;
                setInlineStyle(node, 'display', collapsed ? 'none' : '', true);
                setInlineStyle(node, 'visibility', collapsed ? 'hidden' : '', true);
                setInlineStyle(node, 'height', collapsed ? '0px' : '', true);
                setInlineStyle(node, 'min-height', collapsed ? '0px' : '', true);
                setInlineStyle(node, 'max-height', collapsed ? '0px' : '', true);
                setInlineStyle(node, 'overflow', collapsed ? 'hidden' : '', true);
                setInlineStyle(node, 'margin-top', collapsed ? '0px' : '', true);
                setInlineStyle(node, 'margin-bottom', collapsed ? '0px' : '', true);
                setInlineStyle(node, 'padding-top', collapsed ? '0px' : '', true);
                setInlineStyle(node, 'padding-bottom', collapsed ? '0px' : '', true);
                setInlineStyle(node, 'border-top-width', collapsed ? '0px' : '', true);
                setInlineStyle(node, 'border-bottom-width', collapsed ? '0px' : '', true);
            }
        }
    }

    function syncTimeGridAllDaySummaryOverlay(rootEl, calendar, collapsed, count, axisCushions) {
        if (!(rootEl instanceof HTMLElement)) return false;
        const overlayClass = 'tm-cal-allday-summary-overlay';
        rootEl.querySelectorAll(`.tm-cal-allday-summary:not(.${overlayClass})`).forEach((node) => {
            try { node.remove(); } catch (e) {}
        });
        let summaryBtn = rootEl.querySelector(`.${overlayClass}`);
        if (!(summaryBtn instanceof HTMLButtonElement)) {
            summaryBtn = document.createElement('button');
            summaryBtn.type = 'button';
            summaryBtn.className = `tm-cal-allday-summary ${overlayClass}`;
            try { rootEl.appendChild(summaryBtn); } catch (e) { summaryBtn = null; }
        }
        if (!(summaryBtn instanceof HTMLButtonElement)) return false;
        const rowContext = (axisCushions || []).map((axisCushion) => getAllDayRowContext(axisCushion)).find((ctx) => ctx?.allDayRow instanceof HTMLElement) || null;
        const allDayRow = rowContext?.allDayRow || null;
        const axisCell = rowContext?.axisCell || rowContext?.axisFrame || null;
        if (!(allDayRow instanceof HTMLElement)) {
            summaryBtn.hidden = true;
            return false;
        }
        const rootRect = rootEl.getBoundingClientRect();
        const rowRect = allDayRow.getBoundingClientRect();
        const axisRect = axisCell instanceof HTMLElement ? axisCell.getBoundingClientRect() : null;
        const summaryHeight = Math.max(28, Math.round(rowRect.height));
        const left = Math.max(0, Math.round((axisRect?.right || rowRect.left) - rootRect.left));
        const right = Math.max(left + 60, Math.round(rowRect.right - rootRect.left));
        const width = Math.max(60, right - left);
        const top = Math.max(0, Math.round(rowRect.top - rootRect.top));
        try { rootEl.style.setProperty('position', 'relative'); } catch (e) {}
        try { summaryBtn.style.position = 'absolute'; } catch (e) {}
        try { summaryBtn.style.left = `${left}px`; } catch (e) {}
        try { summaryBtn.style.top = `${top}px`; } catch (e) {}
        try { summaryBtn.style.width = `${width}px`; } catch (e) {}
        try { summaryBtn.style.right = 'auto'; } catch (e) {}
        try { summaryBtn.style.transform = 'none'; } catch (e) {}
        try { summaryBtn.style.zIndex = '7'; } catch (e) {}
        try { summaryBtn.style.height = `${summaryHeight}px`; } catch (e) {}
        try { summaryBtn.style.borderRadius = '0'; } catch (e) {}
        try { summaryBtn.style.border = '0'; } catch (e) {}
        try { summaryBtn.style.background = 'var(--tm-cal-allday-summary-bg-current, var(--tm-cal-allday-summary-bg, color-mix(in srgb, #eef1f4 76%, var(--tm-bg-color, #fff) 24%)))'; } catch (e) {}
        try { summaryBtn.style.color = 'color-mix(in srgb, var(--tm-text-color, #000) 82%, var(--tm-secondary-text, #666) 18%)'; } catch (e) {}
        try { summaryBtn.style.cursor = 'pointer'; } catch (e) {}
        try { summaryBtn.style.padding = '0 14px'; } catch (e) {}
        try { summaryBtn.style.fontSize = '13px'; } catch (e) {}
        try { summaryBtn.style.boxSizing = 'border-box'; } catch (e) {}
        summaryBtn.textContent = getAllDaySummaryText(count);
        summaryBtn.title = collapsed ? '展开全天任务' : '';
        summaryBtn.setAttribute('aria-label', collapsed ? `展开全天任务，当前隐藏 ${Math.max(0, count)} 项` : '全天任务汇总');
        summaryBtn.hidden = !collapsed;
        bindAllDayCollapseActivator(summaryBtn, rootEl, calendar);
        return true;
    }

    function bindAllDayCollapseActivator(el, rootEl, calendar) {
        if (!(el instanceof HTMLElement) || el.__tmAllDayCollapseBound) return;
        el.__tmAllDayCollapseBound = true;
        const swallow = (ev) => {
            try { ev?.stopPropagation?.(); } catch (e) {}
        };
        const activate = (ev) => {
            try { ev?.preventDefault?.(); } catch (e) {}
            try { ev?.stopPropagation?.(); } catch (e) {}
            toggleTimeGridAllDayCollapsed(rootEl, calendar);
        };
        el.addEventListener('pointerdown', swallow);
        el.addEventListener('mousedown', swallow);
        el.addEventListener('touchstart', swallow, { passive: true });
        el.addEventListener('click', activate);
        el.addEventListener('keydown', (ev) => {
            const key = String(ev?.key || '').trim();
            if (key !== 'Enter' && key !== ' ') return;
            activate(ev);
        });
    }

    function syncTimeGridAllDayCollapseUi(rootEl, calendar) {
        if (!(rootEl instanceof HTMLElement)) return false;
        const supported = isTimeGridAllDayCollapseSupported(calendar);
        const collapsed = supported && getAllDayCollapsed(rootEl);
        rootEl.classList.toggle('tm-cal-allday-collapsible', supported);
        rootEl.classList.toggle('tm-cal-allday-collapsed', collapsed);
        try { ensureInlineAllDayAxisToggle(rootEl, calendar); } catch (e) {}
        try { applyAllDayCollapsedLayout(rootEl, collapsed); } catch (e) {}
        try { applyTimeGridAllDayMoreLinkLayout(rootEl, calendar); } catch (e) {}
        const count = supported ? getAllDaySummaryCount(calendar) : 0;
        const axisCushions = getAllDayAxisCushions(rootEl);
        const existingSummary = rootEl.querySelector('.tm-cal-allday-summary-overlay');
        if (!axisCushions.length) {
            const isViewSwitching = !!(
                rootEl.classList.contains('tm-cal-view-switching')
                || rootEl.closest('.tm-calendar-wrap--view-switching')
            );
            if (!isViewSwitching && existingSummary instanceof HTMLElement) existingSummary.hidden = true;
            return false;
        }
        try { syncTimeGridAllDaySummaryOverlay(rootEl, calendar, collapsed, count, axisCushions); } catch (e) {}
        return true;
    }

    function scheduleSyncTimeGridAllDayCollapseUi(rootEl, calendar) {
        if (!(rootEl instanceof HTMLElement)) return false;
        try { syncTimeGridAllDayCollapseUi(rootEl, calendar); } catch (e) {}
        const run = () => {
            rootEl.__tmAllDayCollapseSyncRaf = 0;
            try { syncTimeGridAllDayCollapseUi(rootEl, calendar); } catch (e) {}
        };
        if (rootEl.__tmAllDayCollapseSyncRaf) {
            try { cancelAnimationFrame(rootEl.__tmAllDayCollapseSyncRaf); } catch (e) {}
        }
        if (rootEl.__tmAllDayCollapseSyncTimer) {
            try { clearTimeout(rootEl.__tmAllDayCollapseSyncTimer); } catch (e) {}
        }
        try {
            rootEl.__tmAllDayCollapseSyncRaf = requestAnimationFrame(run);
        } catch (e) {
            run();
        }
        try {
            rootEl.__tmAllDayCollapseSyncTimer = setTimeout(() => {
                rootEl.__tmAllDayCollapseSyncTimer = 0;
                try { syncTimeGridAllDayCollapseUi(rootEl, calendar); } catch (e2) {}
            }, 40);
        } catch (e) {}
        return true;
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
.tm-calendar-host .fc .fc-timegrid .fc-col-header-cell.fc-day-today .fc-col-header-cell-cushion,
.tm-calendar-host.fc .fc-timegrid .fc-col-header-cell.fc-day-today .fc-col-header-cell-cushion,
.tm-calendar-wrap .fc .fc-timegrid .fc-col-header-cell.fc-day-today .fc-col-header-cell-cushion,
#tmCalendarSideDockTimeline .fc .fc-timegrid .fc-col-header-cell.fc-day-today .fc-col-header-cell-cushion,
.tm-calendar-host .fc .fc-timegrid .fc-col-header-cell.fc-day-today .tm-cn-week-head,
.tm-calendar-host.fc .fc-timegrid .fc-col-header-cell.fc-day-today .tm-cn-week-head,
.tm-calendar-wrap .fc .fc-timegrid .fc-col-header-cell.fc-day-today .tm-cn-week-head,
#tmCalendarSideDockTimeline .fc .fc-timegrid .fc-col-header-cell.fc-day-today .tm-cn-week-head{color:var(--tm-text-color) !important;font-weight:700 !important;}
.tm-calendar-host:not(.tm-cal-allday-collapsed) .fc .fc-timegrid .fc-daygrid-day-bottom,
#tmCalendarSideDockTimeline:not(.tm-cal-allday-collapsed) .fc .fc-timegrid .fc-daygrid-day-bottom{width:100% !important;margin-top:0 !important;padding:0 !important;line-height:1 !important;box-sizing:border-box !important;}
.tm-calendar-host:not(.tm-cal-allday-collapsed) .fc .fc-timegrid .fc-daygrid-more-link,
#tmCalendarSideDockTimeline:not(.tm-cal-allday-collapsed) .fc .fc-timegrid .fc-daygrid-more-link{display:flex !important;align-items:center !important;justify-content:center !important;float:none !important;width:100% !important;min-width:28px !important;height:var(--tm-calendar-month-more-link-height, 19px) !important;min-height:var(--tm-calendar-month-more-link-height, 19px) !important;max-width:100% !important;margin:0 !important;padding:0 6px 0 7px !important;border-radius:5px !important;background-image:linear-gradient(var(--tm-calendar-month-more-bg, rgba(127, 127, 127, 0.11)), var(--tm-calendar-month-more-bg, rgba(127, 127, 127, 0.11))) !important;background-position:left top !important;background-size:100% 100% !important;background-repeat:no-repeat !important;background-color:var(--tm-calendar-month-more-bg, rgba(127, 127, 127, 0.11)) !important;box-shadow:inset 0 -1px 0 var(--fc-page-bg-color, var(--tm-bg-color, #fff)) !important;color:var(--tm-calendar-month-more-text, var(--tm-secondary-text)) !important;font-size:11px !important;font-weight:700 !important;line-height:1.1 !important;text-align:center !important;text-decoration:none !important;overflow:hidden !important;text-overflow:ellipsis !important;white-space:nowrap !important;box-sizing:border-box !important;}
.fc .fc-daygrid-body-natural .fc-daygrid-day-events{margin-bottom:0 !important;}
/* Fallback only:
   最终的全天标题/时间字号不要在这段字符串里改。
   这里是运行时后注入的兜底样式，真正生效的字号由 applyTaskEventTitleClamp()
   在渲染节点时直接写 inline style，优先级更高。 */
.fc .fc-timegrid-all-day .fc-daygrid-event,
.fc .fc-popover .fc-daygrid-event{padding-top:0 !important;padding-bottom:0 !important;font-size:11px !important;}
.fc .fc-timegrid-all-day .fc-daygrid-event .fc-event-main,
.fc .fc-popover .fc-daygrid-event .fc-event-main{padding-top:0 !important;padding-bottom:0 !important;}
.fc .fc-timegrid-all-day .fc-daygrid-event .fc-event-main-frame,
.fc .fc-popover .fc-daygrid-event .fc-event-main-frame{display:flex !important;align-items:stretch !important;width:100% !important;min-width:0 !important;height:auto !important;}
.fc .fc-timegrid-all-day .fc-daygrid-event .fc-event-main,
.fc .fc-popover .fc-daygrid-event .fc-event-main{display:block !important;width:100% !important;min-width:0 !important;height:auto !important;}
.fc .fc-timegrid-all-day .tm-cal-task-event,
.fc .fc-popover .tm-cal-task-event{height:100% !important;font-size:11px !important;}
.fc .fc-timegrid-all-day .tm-cal-task-event-title,
.fc .fc-popover .tm-cal-task-event-title{line-height:1.1 !important;font-size:11px !important;}
.fc .fc-timegrid-all-day .tm-cal-task-event-title-text,
.fc .fc-popover .tm-cal-task-event-title-text{line-height:1.1 !important;font-size:11px !important;}
.fc .fc-timegrid-all-day .tm-cal-task-event-time,
.fc .fc-popover .tm-cal-task-event-time{font-size:9px !important;}
.fc a.fc-event:focus,
.fc .fc-daygrid-event:focus,
.fc .fc-daygrid-event:focus-within{outline:none !important;box-shadow:none !important;}
.tm-calendar-host .fc .fc-timegrid-now-indicator-container,
#tmCalendarSideDockTimeline .fc .fc-timegrid-now-indicator-container{overflow:visible !important;}
.tm-calendar-host .fc .fc-timegrid-now-indicator-line,
#tmCalendarSideDockTimeline .fc .fc-timegrid-now-indicator-line{border-top-width:2px !important;margin-top:-1px !important;overflow:visible !important;z-index:6 !important;}
.tm-calendar-host .fc .fc-timegrid-now-indicator-line::before,
#tmCalendarSideDockTimeline .fc .fc-timegrid-now-indicator-line::before{content:"";position:absolute;left:0;top:50%;width:10px;height:10px;border-radius:999px;background:var(--fc-now-indicator-color, var(--tm-primary-color));transform:translate(-50%, -50%);box-shadow:0 0 0 2px var(--fc-page-bg-color, #fff);}
.tm-calendar-host .fc .fc-timegrid-now-indicator-arrow,
#tmCalendarSideDockTimeline .fc .fc-timegrid-now-indicator-arrow{display:none !important;}
.tm-calendar-host .fc .fc-dayGridMonth-view .fc-daygrid-day.fc-day-today .fc-daygrid-day-number,
.tm-calendar-host.fc .fc-dayGridMonth-view .fc-daygrid-day.fc-day-today .fc-daygrid-day-number,
.tm-calendar-wrap .fc .fc-dayGridMonth-view .fc-daygrid-day.fc-day-today .fc-daygrid-day-number{font-weight:400 !important;}
        `.trim();
        const existing = document.getElementById(id);
        if (existing && existing.tagName === 'STYLE') {
            if (existing.textContent !== css) existing.textContent = css;
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

    function normalizeDateOnly(value) {
        if (!(value instanceof Date)) return null;
        if (Number.isNaN(value.getTime())) return null;
        return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }

    function normalizeCalendar3DayTodayPosition(value) {
        const num = Number(value);
        return (num === 2 || num === 3) ? num : 1;
    }

    function getAligned3DayTodayStart(settings) {
        const today = normalizeDateOnly(new Date());
        if (!(today instanceof Date)) return null;
        const pos = normalizeCalendar3DayTodayPosition(settings?.threeDayTodayPosition || settings?.calendar3DayTodayPosition);
        if (pos <= 1) return today;
        const start = new Date(today.getTime());
        start.setDate(start.getDate() - (pos - 1));
        return start;
    }

    function resolveMainCalendarAnchorDate(date, viewType, settings) {
        const base = normalizeDateOnly(date);
        if (!(base instanceof Date)) return null;
        if (String(viewType || '').trim() !== 'timeGrid3Day') return base;
        const today = normalizeDateOnly(new Date());
        if (!(today instanceof Date)) return base;
        if (formatDateKey(base) !== formatDateKey(today)) return base;
        return getAligned3DayTodayStart(settings) || base;
    }

    function realignMainCalendar3DayTodayRange(calendar, settings) {
        const cal = calendar || state.calendar;
        if (!cal) return false;
        const viewType = String(cal?.view?.type || '').trim();
        if (viewType !== 'timeGrid3Day') return false;
        const today = normalizeDateOnly(new Date());
        const currentStart = normalizeDateOnly(cal?.view?.currentStart || cal?.view?.activeStart || cal?.getDate?.());
        const currentEnd = normalizeDateOnly(cal?.view?.currentEnd || cal?.view?.activeEnd);
        const expectedStart = getAligned3DayTodayStart(settings || getSettings());
        if (!(today instanceof Date) || !(currentStart instanceof Date) || !(currentEnd instanceof Date) || !(expectedStart instanceof Date)) return false;
        if (today.getTime() < currentStart.getTime() || today.getTime() >= currentEnd.getTime()) return false;
        if (formatDateKey(currentStart) === formatDateKey(expectedStart)) return false;
        try {
            cal.gotoDate(expectedStart);
            return true;
        } catch (e) {}
        return false;
    }

    function alignMainCalendar3DayTodayPosition(calendar, settings) {
        const cal = calendar || state.calendar;
        const currentStart = normalizeDateOnly(cal?.view?.currentStart || cal?.view?.activeStart || cal?.getDate?.());
        const today = normalizeDateOnly(new Date());
        if (!(currentStart instanceof Date) || !(today instanceof Date)) return false;
        if (formatDateKey(currentStart) !== formatDateKey(today)) return false;
        return realignMainCalendar3DayTodayRange(cal, settings);
    }

    function parseCalendarTimeToMinutes(value) {
        const raw = String(value || '').trim();
        const m = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        if (!m) return NaN;
        const hh = Number(m[1]);
        const mm = Number(m[2]);
        const ss = Number(m[3] || 0);
        if (!Number.isInteger(hh) || !Number.isInteger(mm) || !Number.isInteger(ss)) return NaN;
        return hh * 60 + mm + (ss / 60);
    }

    function getDateMinutesOfDay(value) {
        const date = value instanceof Date ? value : null;
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return NaN;
        return (date.getHours() * 60) + date.getMinutes() + (date.getSeconds() / 60) + (date.getMilliseconds() / 60000);
    }

    function isTimeGridViewType(value) {
        const type = String(value || '').trim();
        return !!type && type.startsWith('timeGrid');
    }

    function getTimeGridBodyScroller(rootEl) {
        if (!(rootEl instanceof HTMLElement)) return null;
        const selectors = [
            '.fc-timegrid-body .fc-scroller-harness .fc-scroller',
            '.fc-timegrid-body .fc-scroller-liquid-absolute',
            '.fc-timegrid-body .fc-scroller',
            '.fc-scroller-liquid-absolute .fc-scroller',
        ];
        for (const selector of selectors) {
            const node = rootEl.querySelector(selector);
            if (node instanceof HTMLElement) return node;
        }
        const candidates = Array.from(rootEl.querySelectorAll('.fc-timegrid-body .fc-scroller, .fc-scroller')).filter((node) => node instanceof HTMLElement);
        let best = null;
        let bestScore = -1;
        for (const node of candidates) {
            const score = Math.max(Number(node.scrollHeight || 0), Number(node.clientHeight || 0));
            if (score <= bestScore) continue;
            best = node;
            bestScore = score;
        }
        return best instanceof HTMLElement ? best : null;
    }

    function getTimeGridAutoCenterScopeMeta(scope) {
        if (scope === 'sideDay') {
            return {
                target: state.sideDay,
                keyField: 'autoCenterKey',
                pendingField: 'autoCenterPendingKey',
                tokenField: 'autoCenterToken',
            };
        }
        return {
            target: state,
            keyField: 'mainTimeGridAutoCenterKey',
            pendingField: 'mainTimeGridAutoCenterPendingKey',
            tokenField: 'mainTimeGridAutoCenterToken',
        };
    }

    function clearTimeGridAutoCenterState(scope) {
        const meta = getTimeGridAutoCenterScopeMeta(scope);
        const target = meta?.target;
        if (!target) return false;
        target[meta.keyField] = '';
        target[meta.pendingField] = '';
        target[meta.tokenField] = Number(target[meta.tokenField] || 0) + 1;
        return true;
    }

    function shouldAutoCenterCurrentTime(rootEl, calendar, settings, scope = 'main') {
        if (!(rootEl instanceof HTMLElement) || !calendar) return null;
        const viewType = String(calendar?.view?.type || '').trim();
        if (!isTimeGridViewType(viewType)) return null;
        const today = normalizeDateOnly(new Date());
        if (!(today instanceof Date)) return null;
        const visibleRange = getCalendarVisibleSlotRange(settings || getSettings());
        const startMinutes = parseCalendarTimeToMinutes(visibleRange.slotMinTime);
        const endMinutes = parseCalendarTimeToMinutes(visibleRange.slotMaxTime);
        if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || endMinutes <= startMinutes) return null;
        let anchorKey = '';
        if (scope === 'sideDay') {
            const currentDate = normalizeDateOnly(calendar?.getDate?.() || calendar?.view?.currentStart || calendar?.view?.activeStart);
            if (!(currentDate instanceof Date)) return null;
            if (formatDateKey(currentDate) !== formatDateKey(today)) return null;
            anchorKey = formatDateKey(currentDate);
        } else {
            const range = getMainCalendarVisibleRange(calendar);
            const start = normalizeDateOnly(range?.start);
            const end = normalizeDateOnly(range?.end);
            if (!(start instanceof Date) || !(end instanceof Date)) return null;
            if (today.getTime() < start.getTime() || today.getTime() > end.getTime()) return null;
            anchorKey = `${formatDateKey(start)}|${formatDateKey(end)}`;
        }
        return {
            key: [scope, viewType, anchorKey, visibleRange.start, visibleRange.end, getCalendarHalfHourSlotHeight(settings || getSettings())].join('|'),
            targetDate: new Date(),
            startMinutes,
            endMinutes,
        };
    }

    function centerCurrentTimeInTimeGrid(rootEl, calendar, settings, targetDate = new Date()) {
        if (!(rootEl instanceof HTMLElement) || !calendar) return false;
        const guard = shouldAutoCenterCurrentTime(rootEl, calendar, settings, isSideDayTimelineRoot(rootEl) ? 'sideDay' : 'main');
        if (!guard) return false;
        const scroller = getTimeGridBodyScroller(rootEl);
        if (!(scroller instanceof HTMLElement)) return false;
        const clientHeight = Number(scroller.clientHeight || 0);
        const scrollHeight = Number(scroller.scrollHeight || 0);
        if (clientHeight <= 0 || scrollHeight <= 0) return false;
        const scrollerRect = scroller.getBoundingClientRect();
        let targetContentY = NaN;
        const indicator = rootEl.querySelector('.fc-timegrid-now-indicator-line');
        if (indicator instanceof HTMLElement) {
            const rect = indicator.getBoundingClientRect();
            const centerY = ((rect.top + rect.bottom) / 2) - scrollerRect.top + Number(scroller.scrollTop || 0);
            if (Number.isFinite(centerY)) targetContentY = centerY;
        }
        if (!Number.isFinite(targetContentY)) {
            const nextSettings = settings || getSettings();
            const slotHeight = getTimeGridSlotHeight(rootEl, getCalendarHalfHourSlotHeight(nextSettings));
            const nowMinutesRaw = getDateMinutesOfDay(targetDate);
            const nowMinutes = Math.min(guard.endMinutes, Math.max(guard.startMinutes, nowMinutesRaw));
            if (!Number.isFinite(slotHeight) || slotHeight <= 0 || !Number.isFinite(nowMinutes)) return false;
            let contentStartY = Number(scroller.scrollTop || 0);
            const slotsEl = rootEl.querySelector('.fc-timegrid-slots');
            if (slotsEl instanceof HTMLElement) {
                const slotsRect = slotsEl.getBoundingClientRect();
                const offsetTop = (slotsRect.top - scrollerRect.top) + Number(scroller.scrollTop || 0);
                if (Number.isFinite(offsetTop)) contentStartY = Math.max(0, offsetTop);
            }
            targetContentY = contentStartY + ((nowMinutes - guard.startMinutes) / 30) * slotHeight;
        }
        if (!Number.isFinite(targetContentY)) return false;
        const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
        const nextTop = Math.max(0, Math.min(maxScrollTop, targetContentY - (clientHeight / 2)));
        try {
            scroller.scrollTo({ top: nextTop, behavior: 'auto' });
        } catch (e) {
            try { scroller.scrollTop = nextTop; } catch (e2) {}
        }
        return true;
    }

    function scheduleCurrentTimeAutoCenter(rootEl, calendar, settings, options = {}) {
        if (!(rootEl instanceof HTMLElement) || !calendar) return false;
        const scope = options?.scope === 'sideDay' ? 'sideDay' : 'main';
        const force = options?.force === true;
        const guard = shouldAutoCenterCurrentTime(rootEl, calendar, settings, scope);
        if (!guard) {
            try { clearTimeGridAutoCenterState(scope); } catch (e) {}
            return false;
        }
        const meta = getTimeGridAutoCenterScopeMeta(scope);
        const target = meta?.target;
        if (!target) return false;
        if (!force) {
            if (target[meta.keyField] === guard.key) return false;
            if (target[meta.pendingField] === guard.key) return false;
        }
        target[meta.pendingField] = guard.key;
        const token = Number(target[meta.tokenField] || 0) + 1;
        target[meta.tokenField] = token;
        const delays = [0, 120, 320];
        const runAttempt = (index) => {
            if (Number(target[meta.tokenField] || 0) !== token) return;
            if (!rootEl.isConnected) {
                if (target[meta.pendingField] === guard.key) target[meta.pendingField] = '';
                return;
            }
            const ok = centerCurrentTimeInTimeGrid(rootEl, calendar, settings, guard.targetDate);
            if (index < delays.length - 1) {
                const wait = Math.max(0, delays[index + 1] - delays[index]);
                setTimeout(() => runAttempt(index + 1), wait);
                return;
            }
            if (Number(target[meta.tokenField] || 0) !== token) return;
            if (ok) target[meta.keyField] = guard.key;
            if (target[meta.pendingField] === guard.key) target[meta.pendingField] = '';
        };
        try {
            requestAnimationFrame(() => runAttempt(0));
        } catch (e) {
            runAttempt(0);
        }
        return true;
    }

    function formatMonthDayZh(date, options = {}) {
        const dt = date instanceof Date ? date : null;
        if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return '';
        const omitMonth = options?.omitMonth === true;
        const month = `${dt.getMonth() + 1}月`;
        const day = `${dt.getDate()}日`;
        return omitMonth ? day : `${month}${day}`;
    }

    function getMainCalendarVisibleRange(calendar) {
        const cal = calendar || state.calendar;
        const view = cal?.view || null;
        const viewType = String(view?.type || '').trim();
        const start = view?.currentStart instanceof Date
            ? new Date(view.currentStart.getTime())
            : (view?.activeStart instanceof Date ? new Date(view.activeStart.getTime()) : null);
        const endExclusive = view?.currentEnd instanceof Date
            ? new Date(view.currentEnd.getTime())
            : (view?.activeEnd instanceof Date ? new Date(view.activeEnd.getTime()) : null);
        if (!(start instanceof Date) || Number.isNaN(start.getTime()) || !(endExclusive instanceof Date) || Number.isNaN(endExclusive.getTime()) || endExclusive.getTime() <= start.getTime()) {
            return { start: null, end: null };
        }
        const hiddenDays = (() => {
            try {
                const raw = cal?.getOption?.('hiddenDays');
                if (Array.isArray(raw)) {
                    return new Set(raw.map((it) => Number(it)).filter((it) => Number.isInteger(it) && it >= 0 && it <= 6));
                }
            } catch (e) {}
            if (viewType === 'timeGridWorkdays') return new Set([0, 6]);
            return new Set();
        })();
        let visibleStart = null;
        let visibleEnd = null;
        for (let cursor = new Date(start.getTime()); cursor.getTime() < endExclusive.getTime(); cursor.setDate(cursor.getDate() + 1)) {
            const dow = cursor.getDay();
            if (hiddenDays.has(dow)) continue;
            const current = new Date(cursor.getTime());
            if (!(visibleStart instanceof Date)) visibleStart = current;
            visibleEnd = current;
        }
        return {
            start: visibleStart,
            end: visibleEnd,
        };
    }

    function formatMainCalendarTitle(calendar) {
        const cal = calendar || state.calendar;
        const view = cal?.view || null;
        const viewType = String(view?.type || '').trim();
        if (!viewType) return '';
        const currentDate = cal?.getDate?.();
        if (viewType === 'timeGridDay') return formatMonthDayZh(currentDate);
        if (viewType === 'dayGridMonth') {
            if (!(currentDate instanceof Date) || Number.isNaN(currentDate.getTime())) return '';
            return `${currentDate.getMonth() + 1}月`;
        }
        const visibleRange = getMainCalendarVisibleRange(cal);
        const start = visibleRange.start;
        const end = visibleRange.end;
        if (!(start instanceof Date) || Number.isNaN(start.getTime()) || !(end instanceof Date) || Number.isNaN(end.getTime())) {
            return formatMonthDayZh(currentDate);
        }
        const sameMonth = start.getMonth() === end.getMonth();
        return `${formatMonthDayZh(start)} - ${formatMonthDayZh(end, { omitMonth: sameMonth })}`;
    }

    function syncMainCalendarToolbarTitle(wrap, calendar) {
        const titleEl = wrap?.querySelector?.('.fc-toolbar-title');
        if (!(titleEl instanceof HTMLElement)) return false;
        const nextTitle = formatMainCalendarTitle(calendar);
        if (!nextTitle) return false;
        try {
            const viewType = String(calendar?.view?.type || state.calendar?.view?.type || '').trim();
            const lunarDayEl = viewType === 'timeGridDay'
                ? titleEl.querySelector?.(':scope > .tm-cn-lunar--day')
                : null;
            titleEl.replaceChildren(document.createTextNode(nextTitle));
            if (lunarDayEl instanceof HTMLElement && String(lunarDayEl.textContent || '').trim()) {
                titleEl.appendChild(lunarDayEl);
            }
            titleEl.setAttribute('data-tm-calendar-title', nextTitle);
            titleEl.title = nextTitle;
        } catch (e) { return false; }
        return true;
    }

    function scheduleMainCalendarToolbarTitleSync(wrap, calendar) {
        if (!(wrap instanceof Element) || !calendar) return false;
        const run = () => {
            try { syncMainCalendarToolbarTitle(wrap, calendar); } catch (e) {}
        };
        run();
        try { requestAnimationFrame(run); } catch (e) {}
        try { setTimeout(run, 0); } catch (e) {}
        try { setTimeout(run, 40); } catch (e) {}
        try { setTimeout(run, 160); } catch (e) {}
        return true;
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
        const accent = String(color || '').trim() || 'var(--tm-primary-color)';
        const rgb = parseColorToRgb(accent);
        const softBg = rgb ? toRgbaString(rgb, 0.22) : 'rgba(0, 120, 212, 0.22)';
        const softBorder = rgb ? toRgbaString(rgb, 0.28) : 'rgba(0, 120, 212, 0.28)';
        const hoverBg = rgb ? toRgbaString(rgb, 0.3) : 'rgba(0, 120, 212, 0.3)';
        const textColor = isDarkThemeMode() ? 'rgba(255, 255, 255, 0.96)' : '#222';
        try { el.style.setProperty('--tm-cal-schedule-accent', accent); } catch (e) {}
        try { el.style.setProperty('--tm-cal-schedule-text', textColor); } catch (e) {}
        try { el.style.setProperty('--tm-cal-schedule-bg', softBg); } catch (e) {}
        try { el.style.setProperty('--tm-cal-schedule-border', softBorder); } catch (e) {}
        try { el.style.setProperty('--tm-cal-schedule-stripe', accent); } catch (e) {}
        try { el.style.setProperty('--tm-cal-schedule-hover-bg', hoverBg); } catch (e) {}
        try { el.classList.add('tm-cal-schedule-event'); } catch (e) {}
        try { el.style.setProperty('--fc-event-border-color', 'transparent'); } catch (e) {}
        try { el.style.setProperty('background', softBg, 'important'); } catch (e) {}
        try { el.style.setProperty('background-color', softBg, 'important'); } catch (e) {}
        try { el.style.setProperty('border', '0', 'important'); } catch (e) {}
        try { el.style.setProperty('border-color', 'transparent', 'important'); } catch (e) {}
        try { applyCalendarEventStripeFill(el, 4); } catch (e) {}
        try { el.style.setProperty('display', 'block', 'important'); } catch (e) {}
        try { el.style.setProperty('width', '100%', 'important'); } catch (e) {}
        try { el.style.setProperty('min-width', '0', 'important'); } catch (e) {}
        try { el.style.setProperty('box-sizing', 'border-box', 'important'); } catch (e) {}
        try { el.style.setProperty('margin-left', '0', 'important'); } catch (e) {}
        try { el.style.setProperty('margin-right', '0', 'important'); } catch (e) {}
        try { applyCalendarEventDoneBorderTone(el, el.classList.contains('tm-cal-event--done')); } catch (e) {}
        try { el.style.setProperty('border-radius', '5px', 'important'); } catch (e) {}
        try { el.style.setProperty('outline', 'none', 'important'); } catch (e) {}
        try { el.style.setProperty('box-shadow', 'inset 0 -1px 0 var(--fc-page-bg-color, var(--tm-bg-color, #fff))', 'important'); } catch (e) {}
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
        const accent = String(color || '').trim() || 'var(--tm-primary-color)';
        const rgb = parseColorToRgb(accent);
        const textColor = isDarkThemeMode() ? 'rgba(255, 255, 255, 0.96)' : '#222';
        const softBg = rgb ? toRgbaString(rgb, 0.22) : 'rgba(0, 120, 212, 0.22)';
        const softBorder = rgb ? toRgbaString(rgb, 0.28) : 'rgba(0, 120, 212, 0.28)';
        try { el.classList.add('tm-cal-allday-soft-event'); } catch (e) {}
        try { el.classList.remove('tm-cal-schedule-event'); } catch (e) {}
        try { el.style.setProperty('--tm-cal-schedule-accent', accent); } catch (e) {}
        try { el.style.setProperty('--tm-cal-schedule-text', textColor); } catch (e) {}
        try { el.style.setProperty('--tm-cal-schedule-bg', softBg); } catch (e) {}
        try { el.style.setProperty('--tm-cal-schedule-border', softBorder); } catch (e) {}
        try { el.style.setProperty('--tm-cal-schedule-stripe', accent); } catch (e) {}
        try { el.style.setProperty('--fc-event-border-color', 'transparent'); } catch (e) {}
        try { el.style.setProperty('background', softBg, 'important'); } catch (e) {}
        try { el.style.setProperty('background-color', softBg, 'important'); } catch (e) {}
        try { el.style.setProperty('border', '0', 'important'); } catch (e) {}
        try { el.style.setProperty('border-color', 'transparent', 'important'); } catch (e) {}
        try { applyCalendarEventStripeFill(el, 3); } catch (e) {}
        try { el.style.setProperty('display', 'block', 'important'); } catch (e) {}
        try { el.style.setProperty('width', '100%', 'important'); } catch (e) {}
        try { el.style.setProperty('min-width', '0', 'important'); } catch (e) {}
        try { el.style.setProperty('box-sizing', 'border-box', 'important'); } catch (e) {}
        try { el.style.setProperty('margin-left', '0', 'important'); } catch (e) {}
        try { el.style.setProperty('margin-right', '0', 'important'); } catch (e) {}
        try { applyCalendarEventDoneBorderTone(el, el.classList.contains('tm-cal-event--done')); } catch (e) {}
        try { el.style.setProperty('border-radius', '5px', 'important'); } catch (e) {}
        try { el.style.setProperty('outline', 'none', 'important'); } catch (e) {}
        try { el.style.setProperty('box-shadow', 'inset 0 -1px 0 var(--fc-page-bg-color, var(--tm-bg-color, #fff))', 'important'); } catch (e) {}
        try {
            const inAllDayRow = !!el.closest?.('.fc-timegrid-all-day, .fc-timegrid-allday');
            if (inAllDayRow) {
                el.style.setProperty('height', '23px', 'important');
                el.style.setProperty('min-height', '23px', 'important');
                el.style.setProperty('max-height', '23px', 'important');
            } else {
                el.style.removeProperty('height');
                el.style.removeProperty('min-height');
                el.style.removeProperty('max-height');
            }
        } catch (e) {}
        try { el.style.setProperty('color', textColor, 'important'); } catch (e) {}
        try { el.style.setProperty('font-size', '11px', 'important'); } catch (e) {}
        try {
            const nodes = el.querySelectorAll('.fc-event-main, .fc-event-main-frame, .fc-event-time, .fc-event-title, .tm-cal-task-event, .tm-cal-task-event-title, .tm-cal-task-event-title-text, .tm-cal-task-event-time, .tm-cal-schedule-stack');
            nodes.forEach((node) => {
                try { node.style.setProperty('color', textColor, 'important'); } catch (e2) {}
                try {
                    if (node.matches?.('.fc-event-time, .tm-cal-task-event-time')) {
                        node.style.setProperty('font-size', '10px', 'important');
                    } else if (node.matches?.('.fc-event-title, .tm-cal-task-event, .tm-cal-task-event-title, .tm-cal-task-event-title-text, .tm-cal-schedule-stack')) {
                        node.style.setProperty('font-size', '11px', 'important');
                    }
                    if (node.matches?.('.fc-event-title, .tm-cal-task-event-title, .tm-cal-task-event-title-text')) {
                        node.style.setProperty('line-height', '1.1', 'important');
                    }
                } catch (e3) {}
                try {
                    if (el.closest?.('.fc-timegrid-all-day, .fc-timegrid-allday') && (node.matches?.('.fc-event-main, .fc-event-main-frame, .tm-cal-task-event, .tm-cal-schedule-stack'))) {
                        node.style.setProperty('height', '100%', 'important');
                        node.style.setProperty('min-height', '0', 'important');
                        node.style.setProperty('box-sizing', 'border-box', 'important');
                    }
                } catch (e3) {}
            });
        } catch (e) {}
        try { syncAllDayEventHarnessSpacing(el); } catch (e) {}
        try {
            if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
                window.requestAnimationFrame(() => {
                    try { syncAllDayEventHarnessSpacing(el); } catch (e2) {}
                });
            }
        } catch (e) {}
    }

    function shouldUseAllDaySoftEventVisual(arg, source) {
        const viewType = String(arg?.view?.type || '').trim();
        const isAllDayLike = arg?.event?.allDay === true || viewType.startsWith('dayGrid');
        if (!isAllDayLike) return false;
        if (source === 'schedule' || source === 'taskdate' || source === 'reminder') return true;
        if (source !== 'cnHoliday') return false;
        try {
            const id = String(arg?.event?.id || '').trim();
            const display = String(arg?.event?.display || '').trim();
            const el = arg?.el;
            if (display === 'background' || id.startsWith('cn-holiday-bg:')) return false;
            if (el?.classList?.contains?.('fc-bg-event')) return false;
        } catch (e) {}
        return true;
    }

    function shouldUseAllDayEventContentLayout(arg) {
        const viewType = String(arg?.view?.type || '').trim();
        return arg?.event?.allDay === true || viewType.startsWith('dayGrid');
    }

    function resolveCalendarEventClassNames(arg) {
        if (arg?.isMirror) return ['tm-cal-selection-mirror', 'tm-cal-schedule-event'];
        const ext = arg?.event?.extendedProps || {};
        const source = String(ext.__tmSource || '').trim();
        const classNames = [];
        if (resolveCalendarEventDoneState(ext)) classNames.push('tm-cal-event--done');
        if (shouldUseAllDaySoftEventVisual(arg, source)) classNames.push('tm-cal-allday-soft-event');
        return classNames;
    }

    function normalizeAllDayEventContentLayout(eventEl) {
        const el = eventEl instanceof Element ? eventEl : null;
        if (!el) return;
        try {
            const wraps = el.querySelectorAll?.('.tm-cal-task-event, .tm-cal-schedule-stack');
            if (!wraps || !wraps.length) return;
            wraps.forEach((wrapEl) => {
                if (!(wrapEl instanceof HTMLElement)) return;
                try {
                    if (wrapEl.classList.contains('tm-cal-schedule-stack')) {
                        wrapEl.classList.add('tm-cal-schedule-stack--allday');
                    } else {
                        wrapEl.classList.add('tm-cal-task-event--allday');
                    }
                } catch (e1) {}
                const titleEl = wrapEl.querySelector?.('.tm-cal-task-event-title') || null;
                applyTaskEventTitleClamp(wrapEl, titleEl, { hasLeadingSlot: !!wrapEl.querySelector?.('.tm-cal-task-event-leading') });
            });
        } catch (e) {}
    }

    function syncAllDayEventHarnessSpacing(eventEl) {
        const el = eventEl instanceof Element ? eventEl : null;
        if (!el) return;
        const harness = el.closest?.('.fc-daygrid-event-harness');
        if (!(harness instanceof HTMLElement)) return;
        const allDayWrap = harness.closest?.('.fc-timegrid-all-day, .fc-timegrid-allday');
        if (!(allDayWrap instanceof HTMLElement)) return;
        const container = harness.parentElement;
        if (!(container instanceof HTMLElement)) return;
        const gapPx = 1;
        const parsePx = (value) => {
            const match = String(value || '').match(/-?\d+(?:\.\d+)?/);
            return match ? Number(match[0]) : null;
        };
        const getCurrentOffset = (node, propName) => {
            const raw = parsePx(node.style.getPropertyValue(propName));
            if (Number.isFinite(raw)) return raw;
            try {
                const computed = window.getComputedStyle(node).getPropertyValue(propName);
                const parsed = parsePx(computed);
                return Number.isFinite(parsed) ? parsed : null;
            } catch (e) {}
            return null;
        };
        const isVisibleHarness = (node) => {
            if (!(node instanceof HTMLElement)) return false;
            if (!node.classList.contains('fc-daygrid-event-harness')) return false;
            try {
                const style = window.getComputedStyle(node);
                if (style.display === 'none' || style.visibility === 'hidden') return false;
            } catch (e) {}
            return true;
        };
        const harnesses = Array.from(container.children || []).filter(isVisibleHarness);
        let visibleIndex = 0;
        harnesses.forEach((node) => {
            const isAbs = node.classList.contains('fc-daygrid-event-harness-abs');
            const propName = isAbs ? 'top' : 'margin-top';
            const baseKey = isAbs ? 'tmCalAllDayBaseTop' : 'tmCalAllDayBaseMarginTop';
            const appliedKey = isAbs ? 'tmCalAllDayAppliedTopOffset' : 'tmCalAllDayAppliedMarginOffset';
            const currentOffset = getCurrentOffset(node, propName);
            const previousApplied = Number(node.dataset?.[appliedKey] || '0');
            const baseOffset = Number.isFinite(currentOffset) ? (currentOffset - previousApplied) : null;
            try {
                if (Number.isFinite(baseOffset)) node.dataset[baseKey] = String(baseOffset);
                const resolvedBase = Number(node.dataset?.[baseKey] || '');
                if (!Number.isFinite(resolvedBase)) return;
                const nextOffset = visibleIndex * gapPx;
                node.dataset[appliedKey] = String(nextOffset);
                node.style.setProperty(propName, `${resolvedBase + nextOffset}px`);
            } catch (e) {}
            visibleIndex += 1;
        });
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
        title.draggable = false;
        const titleText = document.createElement('span');
        titleText.className = 'tm-cal-task-event-title-text';
        titleText.textContent = String(text || '').trim() || '任务';
        titleText.draggable = false;
        const swallowDragStart = (ev) => {
            try { ev.preventDefault?.(); } catch (e) {}
            try { ev.stopPropagation?.(); } catch (e) {}
        };
        title.addEventListener('dragstart', swallowDragStart);
        titleText.addEventListener('dragstart', swallowDragStart);
        const range = String(rangeText || '').trim();
        title.appendChild(titleText);
        if (!range) return { title, titleText, timeText: null };
        title.classList.add('tm-cal-task-event-title--stack');
        const timeText = document.createElement('span');
        timeText.className = 'tm-cal-task-event-time';
        timeText.textContent = range;
        timeText.draggable = false;
        timeText.addEventListener('dragstart', swallowDragStart);
        title.appendChild(timeText);
        return { title, titleText, timeText };
    }

    function buildCnHolidayEventContent(arg) {
        const ext = arg?.event?.extendedProps || {};
        const type = Number(ext.__tmCnHolidayType);
        const name = normalizeCnHolidayName(String(ext.__tmCnHolidayName || '').trim());
        if (!name) return true;
        try {
            const id = String(arg?.event?.id || '').trim();
            const display = String(arg?.event?.display || '').trim();
            if (display === 'background' || id.startsWith('cn-holiday-bg:')) return true;
        } catch (e) {}
        if (type === 0) {
            const wrapEl = document.createElement('span');
            wrapEl.className = 'tm-cal-task-event tm-cal-task-event--block tm-cal-task-event--allday tm-cn-holiday-title';
            const { title } = buildTaskEventTitleNode(String(arg?.event?.title || '').trim() || name);
            applyTaskEventTitleClamp(wrapEl, title);
            wrapEl.title = name;
            wrapEl.appendChild(title);
            return { domNodes: [wrapEl] };
        }
        if (type !== 2 && type !== 3 && type !== 4) return true;
        const isWork = type === 4;
        const pill = document.createElement('span');
        pill.className = `tm-cn-holiday-pill ${isWork ? 'tm-cn-holiday-pill--work' : 'tm-cn-holiday-pill--rest'}`;
        const badge = document.createElement('span');
        badge.className = 'tm-cn-holiday-badge';
        badge.textContent = isWork ? '班' : '休';
        pill.appendChild(badge);
        const label = document.createElement('span');
        label.className = 'tm-cn-holiday-label';
        label.textContent = name;
        pill.appendChild(label);
        pill.title = `${isWork ? '上班' : '休息'}${name ? `：${name}` : ''}`;
        return { domNodes: [pill] };
    }

    function normalizeCalendarMonthDayNumberCell(arg) {
        try {
            const viewType = String(arg?.view?.type || '').trim();
            const date = arg?.date instanceof Date ? arg.date : null;
            const el = arg?.el instanceof HTMLElement ? arg.el : null;
            if (viewType === 'dayGridMonth' && date && !Number.isNaN(date.getTime())) {
                const label = el?.querySelector?.('.fc-daygrid-day-number');
                if (!(label instanceof HTMLElement)) return;
                const nextText = String(date.getDate());
                const textNode = Array.from(label.childNodes || []).find((node) => node?.nodeType === 3);
                if (textNode) textNode.nodeValue = nextText;
                else label.appendChild(document.createTextNode(nextText));
                if (el?.classList?.contains?.('fc-day-today')) {
                    try { label.style.setProperty('font-weight', '400', 'important'); } catch (e) {}
                }
            }
        } catch (e) {}
    }

    function buildCalendarEventLeadingNode(kind = '') {
        const leading = document.createElement('span');
        leading.className = 'tm-cal-task-event-leading';
        leading.setAttribute('aria-hidden', 'true');
        leading.draggable = false;
        if (kind === 'marker') {
            const mark = document.createElement('span');
            mark.className = 'tm-cal-task-event-leading-mark';
            mark.setAttribute('aria-hidden', 'true');
            mark.draggable = false;
            leading.appendChild(mark);
        }
        return leading;
    }

    function applyTaskEventCheckboxOffset(inputEl, options = {}) {
        if (!(inputEl instanceof HTMLElement)) return;
        const isAllDay = options?.allDay === true;
        const isBlockLike = options?.blockLike === true || isAllDay;
        try { inputEl.style.appearance = 'none'; } catch (e) {}
        try { inputEl.style.webkitAppearance = 'none'; } catch (e) {}
        try { inputEl.style.position = 'relative'; } catch (e) {}
        try { inputEl.style.top = '0'; } catch (e) {}
        try { inputEl.style.transform = 'none'; } catch (e) {}
        try { inputEl.style.display = 'block'; } catch (e) {}
        try { inputEl.style.width = '12px'; } catch (e) {}
        try { inputEl.style.height = '12px'; } catch (e) {}
        try { inputEl.style.minWidth = '12px'; } catch (e) {}
        try { inputEl.style.maxWidth = '12px'; } catch (e) {}
        try { inputEl.style.minHeight = '12px'; } catch (e) {}
        try { inputEl.style.maxHeight = '12px'; } catch (e) {}
        try { inputEl.style.flex = '0 0 12px'; } catch (e) {}
        try { inputEl.style.boxSizing = 'border-box'; } catch (e) {}
        try { inputEl.style.margin = '0'; } catch (e) {}
        try { inputEl.style.padding = '0'; } catch (e) {}
        try { inputEl.style.lineHeight = '0'; } catch (e) {}
        try { inputEl.style.fontSize = '0'; } catch (e) {}
        try { inputEl.style.cursor = 'pointer'; } catch (e) {}
        try { inputEl.style.marginLeft = isBlockLike ? '-2px' : '0'; } catch (e) {}
    }

    function isPointInsideElement(clientX, clientY, el) {
        if (!(el instanceof Element)) return false;
        const x = Number(clientX);
        const y = Number(clientY);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
        const rect = el.getBoundingClientRect?.();
        if (!rect) return false;
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }

    function collectCalendarEventHitCandidates(target, clientX, clientY, preferredEventEl = null) {
        const x = Number(clientX);
        const y = Number(clientY);
        const seen = new Set();
        const list = [];
        const pushEvent = (input) => {
            const base = input instanceof Element ? input : null;
            if (!base) return;
            const eventEl = base.matches?.('.fc-event')
                ? base
                : (base.closest?.('[data-tm-cal-event-id]') || base.closest?.('.fc-event'));
            if (!(eventEl instanceof Element)) return;
            if (seen.has(eventEl)) return;
            seen.add(eventEl);
            list.push(eventEl);
        };
        pushEvent(preferredEventEl);
        pushEvent(target);
        if (Number.isFinite(x) && Number.isFinite(y) && typeof document.elementsFromPoint === 'function') {
            const stack = document.elementsFromPoint(x, y);
            for (const el of stack || []) pushEvent(el);
        }
        const scopeBase = target instanceof Element
            ? target
            : (preferredEventEl instanceof Element ? preferredEventEl : null);
        const scope = scopeBase?.closest?.('.fc-popover')
            || scopeBase?.closest?.('.tm-calendar-host')
            || scopeBase?.closest?.('#tmCalendarSideDockTimeline')
            || null;
        if (scope instanceof Element) {
            const nodes = scope.querySelectorAll?.('[data-tm-cal-event-id].fc-event, .fc-event');
            nodes?.forEach?.((el) => {
                if (!(el instanceof Element)) return;
                const checkEl = el.querySelector?.('.tm-cal-task-event-check') || null;
                const titleEl = el.querySelector?.('.tm-cal-task-event-title-text')
                    || el.querySelector?.('.tm-cal-task-event-title')
                    || null;
                if (isPointInsideElement(x, y, checkEl)
                    || isPointInsideElement(x, y, titleEl)
                    || isPointInsideElement(x, y, el)) {
                    pushEvent(el);
                }
            });
        }
        return list;
    }

    function resolveCalendarEventInteractiveHit(pointerEvent, options = {}) {
        const evt = pointerEvent && typeof pointerEvent === 'object' ? pointerEvent : null;
        const target = evt?.target;
        const x = Number(evt?.clientX);
        const y = Number(evt?.clientY);
        const preferredEventEl = options?.preferredEventEl instanceof Element ? options.preferredEventEl : null;
        const candidates = collectCalendarEventHitCandidates(target, x, y, preferredEventEl);
        const fallbackEventEl = candidates[0] || (preferredEventEl instanceof Element ? preferredEventEl : null);
        for (const eventEl of candidates) {
            const checkboxEl = eventEl.querySelector?.('.tm-cal-task-event-check') || null;
            if (isPointInsideElement(x, y, checkboxEl)) {
                return { kind: 'checkbox', eventEl, checkboxEl };
            }
        }
        for (const eventEl of candidates) {
            const titleEl = eventEl.querySelector?.('.tm-cal-task-event-title-text')
                || eventEl.querySelector?.('.tm-cal-task-event-title')
                || null;
            if (isPointInsideElement(x, y, titleEl)) {
                return { kind: 'title', eventEl, titleEl };
            }
        }
        return fallbackEventEl ? { kind: 'event', eventEl: fallbackEventEl } : null;
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
        const dirRes = await fetch('/api/file/putFile', { method: 'POST', body: formDir });
        if (!dirRes.ok) throw new Error(`HTTP ${dirRes.status}`);
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
            // Keep 30-minute slots marked as minor so CSS can render them dashed.
            slotLabelInterval: '01:00:00',
            slotMinTime: visibleRange.slotMinTime,
            slotMaxTime: visibleRange.slotMaxTime,
            slotLabelContent: (arg) => {
                const d = arg?.date;
                if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
                if (d.getMinutes() !== 0) return '';
                return `${d.getHours()}`;
            },
        };
    }

    function normalizeCalendarHourSlotHeightMode(value) {
        const mode = String(value || '').trim();
        return Object.prototype.hasOwnProperty.call(CALENDAR_HOUR_SLOT_HEIGHT_DELTA_MAP, mode) ? mode : 'normal';
    }

    function normalizeCalendarMonthMinVisibleEvents(value) {
        const num = Math.round(Number(value));
        if (!Number.isFinite(num)) return 3;
        return Math.max(1, Math.min(8, num));
    }

    function readCalendarCssPixelValue(el, propName, fallback) {
        const fallbackNum = Number(fallback);
        const safeFallback = Number.isFinite(fallbackNum) ? fallbackNum : 0;
        if (!(el instanceof HTMLElement)) return safeFallback;
        try {
            const raw = window.getComputedStyle(el).getPropertyValue(propName);
            const parsed = Number.parseFloat(raw);
            return Number.isFinite(parsed) ? parsed : safeFallback;
        } catch (e) {}
        return safeFallback;
    }

    function getMainCalendarMonthFitMetrics(rootEl, hostEl, viewportHeight, fallbackVisibleEvents) {
        const targetHost = hostEl instanceof HTMLElement ? hostEl : null;
        if (!targetHost) {
            return { rowHeight: 0, visibleEvents: fallbackVisibleEvents };
        }
        const monthViewRoot = targetHost.querySelector('.fc-dayGridMonth-view.fc-view.fc-daygrid, .fc-dayGridMonth-view');
        if (!(monthViewRoot instanceof HTMLElement)) {
            return { rowHeight: 0, visibleEvents: fallbackVisibleEvents };
        }
        const rows = monthViewRoot.querySelectorAll('.fc-daygrid-body tbody tr');
        const rowCount = rows?.length || 0;
        if (!rowCount || !(Number(viewportHeight) > 0)) {
            return { rowHeight: 0, visibleEvents: fallbackVisibleEvents };
        }
        const bodyEl = monthViewRoot.querySelector('.fc-daygrid-body') || monthViewRoot;
        const rootRect = (() => {
            try {
                if (rootEl instanceof HTMLElement) return rootEl.getBoundingClientRect();
            } catch (e) {}
            try { return targetHost.getBoundingClientRect(); } catch (e) {}
            return null;
        })();
        const bodyRect = (() => {
            try { return bodyEl.getBoundingClientRect(); } catch (e) {}
            return null;
        })();
        const availableHeight = (() => {
            if (!rootRect || !bodyRect) return 0;
            const bottom = rootRect.top + Number(viewportHeight || rootRect.height || 0);
            const next = Math.floor(bottom - bodyRect.top - 2);
            return next > 0 ? next : 0;
        })();
        if (!availableHeight) {
            return { rowHeight: 0, visibleEvents: fallbackVisibleEvents };
        }
        const rowHeight = Math.max(CALENDAR_MONTH_MIN_ROW_HEIGHT, Math.floor(availableHeight / rowCount));
        const headerHeight = readCalendarCssPixelValue(targetHost, '--tm-calendar-month-day-header-height', 28);
        const eventLineHeight = Math.max(1, readCalendarCssPixelValue(targetHost, '--tm-calendar-month-event-line-height', 20));
        const verticalPadding = readCalendarCssPixelValue(targetHost, '--tm-calendar-month-day-vertical-padding', 8);
        const fitVisibleEvents = Math.floor(Math.max(0, rowHeight - headerHeight - verticalPadding) / eventLineHeight);
        return {
            rowHeight,
            visibleEvents: normalizeCalendarMonthMinVisibleEvents(fitVisibleEvents || fallbackVisibleEvents),
        };
    }

    function normalizeCalendarSidebarDefaultPage(value) {
        return String(value || '').trim() === 'tasks' ? 'tasks' : 'calendar';
    }

    function getCalendarHalfHourSlotHeight(settings) {
        const source = (settings && typeof settings === 'object') ? settings : getSettings();
        const mode = normalizeCalendarHourSlotHeightMode(source?.hourSlotHeightMode || source?.calendarHourSlotHeightMode);
        return SIDE_DAY_HALF_HOUR_SLOT_HEIGHT + (CALENDAR_HOUR_SLOT_HEIGHT_DELTA_MAP[mode] / 2);
    }

    function applyCalendarSlotHeightStyle(rootEl, settings) {
        if (!(rootEl instanceof HTMLElement)) return false;
        const nextSettings = settings || getSettings();
        const slotHeight = getCalendarHalfHourSlotHeight(nextSettings);
        const contentHeight = getCalendarTimeGridContentHeight(nextSettings);
        try { rootEl.style.setProperty('--tm-calendar-half-hour-slot-height', `${slotHeight}px`); } catch (e) {}
        try { rootEl.style.setProperty('--tm-calendar-timegrid-content-height', `${contentHeight}px`); } catch (e) {}
        return true;
    }

    function syncMainCalendarMonthViewLayout(wrap, host, calendar, settings) {
        const targetWrap = (wrap instanceof HTMLElement) ? wrap : (state.wrapEl instanceof HTMLElement ? state.wrapEl : null);
        const targetHost = (host instanceof HTMLElement) ? host : (state.calendarEl instanceof HTMLElement ? state.calendarEl : null);
        const targetRoot = state.rootEl instanceof HTMLElement ? state.rootEl : null;
        const targetCalendar = calendar || state.calendar || null;
        const nextSettings = settings || getSettings();
        const viewType = String(targetCalendar?.view?.type || '').trim();
        const isMonthView = viewType === 'dayGridMonth';
        const monthMinVisibleEvents = normalizeCalendarMonthMinVisibleEvents(
            nextSettings?.monthMinVisibleEvents ?? nextSettings?.calendarMonthMinVisibleEvents
        );
        const monthAdaptiveRowHeight = nextSettings?.monthAdaptiveRowHeight !== false
            && nextSettings?.calendarMonthAdaptiveRowHeight !== false;
        const viewportHeight = (() => {
            const rootRectHeight = Number(targetRoot?.getBoundingClientRect?.().height || 0);
            const rootClientHeight = Number(targetRoot?.clientHeight || 0);
            const wrapParentHeight = Number(targetWrap?.parentElement?.clientHeight || 0);
            const wrapRectHeight = Number(targetWrap?.getBoundingClientRect?.().height || 0);
            const next = Math.round(
                rootClientHeight
                || rootRectHeight
                || wrapParentHeight
                || wrapRectHeight
                || 0
            );
            return next > 0 ? next : 0;
        })();
        const monthFitMetrics = isMonthView && monthAdaptiveRowHeight
            ? getMainCalendarMonthFitMetrics(targetRoot, targetHost, viewportHeight, monthMinVisibleEvents)
            : { rowHeight: 0, visibleEvents: monthMinVisibleEvents };
        const monthVisibleEvents = normalizeCalendarMonthMinVisibleEvents(monthFitMetrics.visibleEvents);
        const targets = [targetRoot, targetWrap, targetHost];
        for (const el of targets) {
            if (!(el instanceof HTMLElement)) continue;
            try { el.style.setProperty('--tm-calendar-month-visible-events', String(monthVisibleEvents)); } catch (e) {}
            if (isMonthView && monthAdaptiveRowHeight && monthFitMetrics.rowHeight > 0) {
                try { el.style.setProperty('--tm-calendar-month-fit-row-height', `${monthFitMetrics.rowHeight}px`); } catch (e) {}
            } else {
                try { el.style.removeProperty('--tm-calendar-month-fit-row-height'); } catch (e) {}
            }
            if (viewportHeight > 0) {
                try { el.style.setProperty('--tm-calendar-month-viewport-height', `${viewportHeight}px`); } catch (e) {}
            } else {
                try { el.style.removeProperty('--tm-calendar-month-viewport-height'); } catch (e) {}
            }
        }
        try { targetRoot?.classList.toggle('tm-calendar-root--month-view', isMonthView); } catch (e) {}
        try { targetWrap?.classList.toggle('tm-calendar-wrap--month-view', isMonthView); } catch (e) {}
        try { targetHost?.classList.toggle('tm-calendar-host--month-view', isMonthView); } catch (e) {}
        if (!targetCalendar) return isMonthView;
        const desiredHeight = isMonthView ? 'auto' : 'parent';
        try {
            if (targetCalendar.getOption?.('height') !== desiredHeight) {
                targetCalendar.setOption('height', desiredHeight);
            }
        } catch (e) {}
        const desiredDayMaxEvents = isMonthView ? (monthAdaptiveRowHeight ? monthVisibleEvents : monthMinVisibleEvents) : true;
        let dayMaxChanged = false;
        try {
            if (targetCalendar.getOption?.('dayMaxEvents') !== desiredDayMaxEvents) {
                targetCalendar.setOption('dayMaxEvents', desiredDayMaxEvents);
                dayMaxChanged = true;
            }
        } catch (e) {}
        if (dayMaxChanged && targetWrap instanceof HTMLElement) {
            try {
                requestAnimationFrame(() => {
                    try { scheduleMainCalendarLayoutRefresh(targetWrap, targetHost, targetCalendar, { updateSize: false }); } catch (e2) {}
                });
            } catch (e) {}
        }
        return isMonthView;
    }

    function applyMainCalendarMonthCellMinHeightLayout(host, calendar) {
        const targetHost = (host instanceof HTMLElement) ? host : (state.calendarEl instanceof HTMLElement ? state.calendarEl : null);
        const targetCalendar = calendar || state.calendar || null;
        const viewType = String(targetCalendar?.view?.type || '').trim();
        if (!(targetHost instanceof HTMLElement) || viewType !== 'dayGridMonth') return false;
        const monthViewRoot = targetHost.querySelector('.fc-dayGridMonth-view.fc-view.fc-daygrid, .fc-dayGridMonth-view');
        if (!(monthViewRoot instanceof HTMLElement)) return false;

        const setImportant = setImportantStyleIfChanged;

        monthViewRoot.querySelectorAll('.fc-daygrid-day-frame').forEach((node) => {
            setImportant(node, 'height', 'var(--tm-calendar-month-fit-row-height, auto)');
            setImportant(node, 'min-height', 'var(--tm-calendar-month-day-min-height)');
            setImportant(node, 'display', 'flex');
            setImportant(node, 'flex-direction', 'column');
            setImportant(node, 'box-sizing', 'border-box');
        });

        monthViewRoot.querySelectorAll('.fc-daygrid-day-top').forEach((node) => {
            setImportant(node, 'min-height', 'var(--tm-calendar-month-day-header-height)');
            setImportant(node, 'flex', '0 0 auto');
        });

        monthViewRoot.querySelectorAll('.fc-daygrid-day-events').forEach((node) => {
            setImportant(node, 'min-height', 'calc(var(--tm-calendar-month-event-line-height) * var(--tm-calendar-month-visible-events))');
            setImportant(node, 'display', 'flex');
            setImportant(node, 'flex-direction', 'column');
            setImportant(node, 'justify-content', 'flex-start');
            setImportant(node, 'box-sizing', 'border-box');
        });

        monthViewRoot.querySelectorAll('.fc-daygrid-day-bottom').forEach((node) => {
            setImportant(node, 'margin-top', '0');
            setImportant(node, 'min-height', '0');
            setImportant(node, 'padding-top', '0');
            setImportant(node, 'line-height', '1');
        });

        return true;
    }

    function applyMainCalendarMonthMoreLinkLayout(host, calendar) {
        const targetHost = (host instanceof HTMLElement) ? host : (state.calendarEl instanceof HTMLElement ? state.calendarEl : null);
        const targetCalendar = calendar || state.calendar || null;
        if (!(targetHost instanceof HTMLElement)) return false;
        const viewType = String(targetCalendar?.view?.type || '').trim();
        const isMonthView = viewType === 'dayGridMonth';
        if (!isMonthView && !targetHost.querySelector('.tm-cal-month-more-inline, .tm-cal-month-more-standalone, .tm-cal-month-more-inline-source')) {
            return false;
        }
        const setImportant = (node, prop, value) => {
            setImportantStyleIfChanged(node, prop, value);
        };
        const removeInlineProps = (node, props) => {
            if (!(node instanceof HTMLElement) || !Array.isArray(props)) return;
            props.forEach((prop) => {
                removeStylePropertyIfPresent(node, prop);
            });
        };
        const bottomInlineProps = [
            'position',
            'top',
            'left',
            'right',
            'bottom',
            'z-index',
            'display',
            'align-items',
            'height',
            'min-height',
            'max-height',
            'width',
            'max-width',
            'margin',
            'margin-top',
            'margin-right',
            'margin-bottom',
            'margin-left',
            'padding',
            'padding-top',
            'line-height',
            'pointer-events',
            'box-sizing',
        ];
        const linkInlineProps = [
            'display',
            'align-items',
            'justify-content',
            'float',
            'width',
            'min-width',
            'height',
            'min-height',
            'max-height',
            'max-width',
            'margin',
            'padding',
            'border-radius',
            'background',
            'background-color',
            'background-image',
            'background-position',
            'background-size',
            'background-repeat',
            'color',
            'font-size',
            'font-weight',
            'line-height',
            'text-decoration',
            'overflow',
            'text-overflow',
            'white-space',
            'pointer-events',
            'box-sizing',
            'box-shadow',
        ];
        const inlineSourceReserveProps = [
            ['width', 'tmCalMonthMoreReserveWidth', 'tmCalMonthMoreReserveWidthPriority'],
            ['max-width', 'tmCalMonthMoreReserveMaxWidth', 'tmCalMonthMoreReserveMaxWidthPriority'],
            ['margin-right', 'tmCalMonthMoreReserveMarginRight', 'tmCalMonthMoreReserveMarginRightPriority'],
        ];
        const restoreInlineSourceEventReserve = (harness) => {
            if (!(harness instanceof HTMLElement)) return;
            const eventEl = harness.querySelector?.('.fc-event');
            if (!(eventEl instanceof HTMLElement) || eventEl.dataset?.tmCalMonthMoreReserveApplied !== '1') return;
            inlineSourceReserveProps.forEach(([prop, valueKey, priorityKey]) => {
                const value = eventEl.dataset?.[valueKey] || '';
                const priority = eventEl.dataset?.[priorityKey] || '';
                try {
                    if (value) eventEl.style.setProperty(prop, value, priority);
                    else eventEl.style.removeProperty(prop);
                } catch (e) {}
                try { delete eventEl.dataset[valueKey]; } catch (e) {}
                try { delete eventEl.dataset[priorityKey]; } catch (e) {}
            });
            try { delete eventEl.dataset.tmCalMonthMoreReserveApplied; } catch (e) {}
        };
        const reserveInlineSourceEventSpace = (harness, widthPx) => {
            if (!(harness instanceof HTMLElement)) return false;
            const eventEl = harness.querySelector?.('.fc-event');
            const rawReserveWidth = Number(widthPx);
            const reserveWidth = Number.isFinite(rawReserveWidth)
                ? Math.max(0, Number(rawReserveWidth.toFixed(2)))
                : 0;
            if (!(eventEl instanceof HTMLElement) || reserveWidth <= 0) return false;
            if (eventEl.dataset?.tmCalMonthMoreReserveApplied !== '1') {
                inlineSourceReserveProps.forEach(([prop, valueKey, priorityKey]) => {
                    try { eventEl.dataset[valueKey] = eventEl.style.getPropertyValue(prop) || ''; } catch (e) {}
                    try { eventEl.dataset[priorityKey] = eventEl.style.getPropertyPriority(prop) || ''; } catch (e) {}
                });
                try { eventEl.dataset.tmCalMonthMoreReserveApplied = '1'; } catch (e) {}
            }
            setImportant(eventEl, 'width', `calc(100% - ${reserveWidth}px)`);
            setImportant(eventEl, 'max-width', `calc(100% - ${reserveWidth}px)`);
            setImportant(eventEl, 'margin-right', `${reserveWidth}px`);
            return true;
        };
        const styleMoreLink = (moreLink, mode) => {
            if (!(moreLink instanceof HTMLElement)) return;
            setImportant(moreLink, 'display', 'inline-flex');
            setImportant(moreLink, 'align-items', 'center');
            setImportant(moreLink, 'justify-content', 'center');
            setImportant(moreLink, 'float', 'none');
            setImportant(moreLink, 'min-width', '28px');
            setImportant(moreLink, 'height', 'var(--tm-calendar-month-more-link-height, 19px)');
            setImportant(moreLink, 'min-height', 'var(--tm-calendar-month-more-link-height, 19px)');
            setImportant(moreLink, 'max-width', '100%');
            setImportant(moreLink, 'margin', '0');
            setImportant(moreLink, 'padding', '0 6px 0 7px');
            setImportant(moreLink, 'border-radius', '5px');
            setImportant(moreLink, 'background-image', 'linear-gradient(var(--tm-calendar-month-more-bg, rgba(127, 127, 127, 0.11)), var(--tm-calendar-month-more-bg, rgba(127, 127, 127, 0.11)))');
            setImportant(moreLink, 'background-position', 'left top');
            setImportant(moreLink, 'background-size', '100% 100%');
            setImportant(moreLink, 'background-repeat', 'no-repeat');
            setImportant(moreLink, 'background-color', 'var(--tm-calendar-month-more-bg, rgba(127, 127, 127, 0.11))');
            setImportant(moreLink, 'color', 'var(--tm-calendar-month-more-text, var(--tm-secondary-text))');
            setImportant(moreLink, 'font-size', '11px');
            setImportant(moreLink, 'font-weight', '700');
            setImportant(moreLink, 'line-height', '1.1');
            setImportant(moreLink, 'text-decoration', 'none');
            setImportant(moreLink, 'overflow', 'hidden');
            setImportant(moreLink, 'text-overflow', 'ellipsis');
            setImportant(moreLink, 'white-space', 'nowrap');
            setImportant(moreLink, 'pointer-events', 'auto');
            setImportant(moreLink, 'box-sizing', 'border-box');
            setImportant(moreLink, 'box-shadow', 'inset 0 -1px 0 var(--fc-page-bg-color, var(--tm-bg-color, #fff))');
            if (mode === 'standalone') setImportant(moreLink, 'width', '100%');
            else {
                try { moreLink.style.removeProperty('width'); } catch (e) {}
            }
        };
        targetHost.querySelectorAll('.tm-cal-month-more-inline, .tm-cal-month-more-standalone').forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            node.classList.remove('tm-cal-month-more-inline');
            node.classList.remove('tm-cal-month-more-standalone');
            try { node.style.removeProperty('--tm-calendar-month-more-inline-top'); } catch (e) {}
            try { node.style.removeProperty('--tm-calendar-month-more-standalone-top'); } catch (e) {}
            removeInlineProps(node, bottomInlineProps);
            const moreLink = node.querySelector?.('.fc-more-link');
            removeInlineProps(moreLink, linkInlineProps);
        });
        targetHost.querySelectorAll('.tm-cal-month-more-inline-source').forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            restoreInlineSourceEventReserve(node);
            node.classList.remove('tm-cal-month-more-inline-source');
            try { node.style.removeProperty('--tm-calendar-month-more-inline-width'); } catch (e) {}
        });

        if (!isMonthView) return false;
        const monthViewRoot = targetHost.querySelector('.fc-dayGridMonth-view.fc-view.fc-daygrid, .fc-dayGridMonth-view');
        if (!(monthViewRoot instanceof HTMLElement)) return false;

        const isSingleDayCalendarEvent = (eventEl) => {
            try {
                if (!(eventEl instanceof HTMLElement)) return null;
                const eventId = String(eventEl.getAttribute('data-tm-cal-event-id') || '').trim();
                const eventApi = eventId && targetCalendar?.getEventById ? targetCalendar.getEventById(eventId) : null;
                if (!eventApi) return null;
                const start = eventApi.start instanceof Date ? eventApi.start : null;
                if (!start || Number.isNaN(start.getTime())) return null;
                const startKey = formatDateKey(start);
                if (!startKey) return null;
                const end = eventApi.end instanceof Date ? eventApi.end : null;
                if (eventApi.allDay === true) {
                    const expectedEndKey = shiftDateKey(startKey, 1);
                    const endKey = end && !Number.isNaN(end.getTime()) ? formatDateKey(end) : expectedEndKey;
                    return !!endKey && !!expectedEndKey && endKey <= expectedEndKey;
                }
                if (!end || Number.isNaN(end.getTime())) return true;
                return formatDateKey(end) === startKey;
            } catch (e) {}
            return null;
        };

        const setStandalone = (bottom, moreLink, top) => {
            if (!(bottom instanceof HTMLElement)) return;
            const safeTop = Math.max(0, Math.round(Number(top) || 0));
            bottom.classList.add('tm-cal-month-more-standalone');
            try { bottom.style.setProperty('--tm-calendar-month-more-standalone-top', `${safeTop}px`); } catch (e) {}
            setImportant(bottom, 'position', 'absolute');
            setImportant(bottom, 'top', `${safeTop}px`);
            setImportant(bottom, 'left', '2px');
            setImportant(bottom, 'right', '2px');
            setImportant(bottom, 'z-index', '7');
            setImportant(bottom, 'display', 'flex');
            setImportant(bottom, 'align-items', 'center');
            setImportant(bottom, 'height', 'var(--tm-calendar-month-more-link-height, 19px)');
            setImportant(bottom, 'min-height', 'var(--tm-calendar-month-more-link-height, 19px)');
            setImportant(bottom, 'max-width', 'calc(100% - 4px)');
            setImportant(bottom, 'margin', '0');
            setImportant(bottom, 'padding', '0');
            setImportant(bottom, 'line-height', '1');
            setImportant(bottom, 'box-sizing', 'border-box');
            styleMoreLink(moreLink, 'standalone');
        };

        const setInline = (bottom, moreLink, lastHarness, top, linkWidth) => {
            if (!(bottom instanceof HTMLElement) || !(lastHarness instanceof HTMLElement)) return;
            bottom.classList.add('tm-cal-month-more-inline');
            lastHarness.classList.add('tm-cal-month-more-inline-source');
            const inlineRight = 4;
            const inlineGap = 1;
            const rawReserveWidth = (Number(linkWidth) || 0) + inlineRight + inlineGap;
            const reserveWidth = Math.max(0, Number(rawReserveWidth.toFixed(2)));
            try { bottom.style.setProperty('--tm-calendar-month-more-inline-top', `${top}px`); } catch (e) {}
            try { lastHarness.style.setProperty('--tm-calendar-month-more-inline-width', `${reserveWidth}px`); } catch (e) {}
            reserveInlineSourceEventSpace(lastHarness, reserveWidth);
            setImportant(bottom, 'position', 'absolute');
            setImportant(bottom, 'top', `${top}px`);
            setImportant(bottom, 'right', `${inlineRight}px`);
            setImportant(bottom, 'z-index', '8');
            setImportant(bottom, 'display', 'flex');
            setImportant(bottom, 'align-items', 'center');
            setImportant(bottom, 'max-width', 'calc(100% - 8px)');
            setImportant(bottom, 'min-height', '0');
            setImportant(bottom, 'margin', '0');
            setImportant(bottom, 'padding', '0');
            setImportant(bottom, 'line-height', '1');
            setImportant(bottom, 'pointer-events', 'none');
            styleMoreLink(moreLink, 'inline');
            try {
                const sourceEventEl = lastHarness.querySelector?.('.fc-event');
                const sourceRect = sourceEventEl instanceof HTMLElement ? sourceEventEl.getBoundingClientRect() : null;
                const sourceHeight = Number(sourceRect?.height || 0);
                if (sourceHeight > 0) {
                    const exactHeight = `${Math.max(1, Number(sourceHeight.toFixed(2)))}px`;
                    setImportant(bottom, 'height', exactHeight);
                    setImportant(bottom, 'min-height', exactHeight);
                    setImportant(bottom, 'max-height', exactHeight);
                    setImportant(moreLink, 'height', exactHeight);
                    setImportant(moreLink, 'min-height', exactHeight);
                    setImportant(moreLink, 'max-height', exactHeight);
                }
            } catch (e) {}
        };

        const getElementRect = (node) => {
            try {
                const rect = node instanceof HTMLElement ? node.getBoundingClientRect() : null;
                if (rect && rect.width > 0 && rect.height > 0) return rect;
            } catch (e) {}
            return null;
        };
        const isVisibleHarness = (node) => {
            if (!(node instanceof HTMLElement)) return false;
            if (!node.classList.contains('fc-daygrid-event-harness')) return false;
            try {
                const style = window.getComputedStyle(node);
                if (style.display === 'none' || style.visibility === 'hidden') return false;
            } catch (e) {}
            return !!getElementRect(node);
        };
        const overlapsEventsRoot = (rect, eventsRect) => {
            if (!rect || !eventsRect) return false;
            const horizontal = rect.right > eventsRect.left + 1 && rect.left < eventsRect.right - 1;
            const vertical = rect.bottom > eventsRect.top + 1 && rect.top < eventsRect.bottom - 1;
            return horizontal && vertical;
        };
        const getVisibleEventsBottom = (eventsRect, harnessRects) => {
            if (!eventsRect || !Array.isArray(harnessRects)) return 0;
            let maxBottom = 0;
            harnessRects.forEach((item) => {
                const rect = item?.rect || null;
                if (!rect || !overlapsEventsRoot(rect, eventsRect)) return;
                maxBottom = Math.max(maxBottom, rect.bottom - eventsRect.top);
            });
            return Math.max(0, Math.ceil(maxBottom));
        };
        const getStandaloneTop = (eventsRect, harnessRects) => {
            const bottomPx = getVisibleEventsBottom(eventsRect, harnessRects);
            return bottomPx > 0 ? bottomPx + 1 : 0;
        };
        const allVisibleHarnessRects = Array.from(monthViewRoot.querySelectorAll('.fc-daygrid-event-harness'))
            .filter(isVisibleHarness)
            .map((node) => ({ node, rect: getElementRect(node) }))
            .filter((item) => !!item.rect);

        monthViewRoot.querySelectorAll('.fc-daygrid-day-events').forEach((eventsRoot) => {
            if (!(eventsRoot instanceof HTMLElement)) return;
            const bottom = Array.from(eventsRoot.children || []).find((node) => node instanceof HTMLElement && node.classList.contains('fc-daygrid-day-bottom'));
            const moreLink = bottom?.querySelector?.('.fc-more-link');
            if (!(bottom instanceof HTMLElement) || !(moreLink instanceof HTMLElement)) return;
            const eventsRect = getElementRect(eventsRoot);
            if (!eventsRect) return;
            const overlappingHarnessRects = allVisibleHarnessRects.filter((item) => overlapsEventsRoot(item.rect, eventsRect));
            const visibleHarnesses = Array.from(eventsRoot.children || []).filter((node) => {
                return isVisibleHarness(node);
            });
            if (!visibleHarnesses.length) {
                setStandalone(bottom, moreLink, getStandaloneTop(eventsRect, overlappingHarnessRects));
                return;
            }

            let lastHarness = null;
            let lastTop = -Infinity;
            let lastLeft = -Infinity;
            for (const node of visibleHarnesses) {
                try {
                    const rect = node.getBoundingClientRect();
                    if (rect.top > lastTop + 0.5 || (Math.abs(rect.top - lastTop) <= 0.5 && rect.left > lastLeft)) {
                        lastHarness = node;
                        lastTop = rect.top;
                        lastLeft = rect.left;
                    }
                } catch (e) {}
            }
            if (!(lastHarness instanceof HTMLElement)) return;

            const lastEventEl = lastHarness.querySelector?.('.fc-event');
            styleMoreLink(moreLink, 'inline');
            const linkRect = (() => {
                try { return moreLink.getBoundingClientRect(); } catch (e) {}
                return null;
            })();
            const lastRect = (() => {
                try { return lastHarness.getBoundingClientRect(); } catch (e) {}
                return null;
            })();
            const lastEventRect = (() => {
                try {
                    if (lastEventEl instanceof HTMLElement) {
                        const rect = lastEventEl.getBoundingClientRect();
                        if (rect && rect.width > 0 && rect.height > 0) return rect;
                    }
                } catch (e) {}
                return null;
            })();
            if (!lastRect) return;
            const lastVisualRect = lastEventRect || lastRect;
            const rawLinkWidth = Number(linkRect?.width || 0);
            const linkWidth = Number.isFinite(rawLinkWidth)
                ? Math.max(28, Number(rawLinkWidth.toFixed(2)))
                : 28;
            const isSingleDay = isSingleDayCalendarEvent(lastEventEl);
            const visuallySpansCells = lastVisualRect.width > eventsRect.width + 4;
            const canAttachInline = (isSingleDay === true)
                ? !visuallySpansCells
                : (isSingleDay === null && !visuallySpansCells && !lastHarness.classList.contains('fc-daygrid-event-harness-abs'));
            const visibleBottom = getVisibleEventsBottom(eventsRect, overlappingHarnessRects);
            const lastBottom = Math.ceil(lastVisualRect.bottom - eventsRect.top);
            if (!canAttachInline || lastRect.width < linkWidth + 28 || visibleBottom > lastBottom + 2) {
                setStandalone(bottom, moreLink, visibleBottom > 0 ? visibleBottom + 1 : 0);
                return;
            }
            const top = Math.max(0, Number((lastVisualRect.top - eventsRect.top).toFixed(2)));

            setInline(bottom, moreLink, lastHarness, top, linkWidth);
        });
        return true;
    }

    function applyTimeGridAllDayMoreLinkLayout(rootEl, calendar) {
        const targetRoot = rootEl instanceof HTMLElement
            ? rootEl
            : (state.calendarEl instanceof HTMLElement ? state.calendarEl : null);
        if (!(targetRoot instanceof HTMLElement)) return false;
        const viewType = String(calendar?.view?.type || '').trim();
        if (!viewType.startsWith('timeGrid')) return false;
        if (targetRoot.classList.contains('tm-cal-allday-collapsed')) return false;
        const timeGridRoot = targetRoot.querySelector('.fc-timegrid, .fc-timeGridDay-view, .fc-timeGridWeek-view, .fc-timeGrid3Day-view, .fc-timeGridWorkdays-view');
        const scope = timeGridRoot instanceof HTMLElement ? timeGridRoot : targetRoot;
        const setImportant = (node, prop, value) => {
            setImportantStyleIfChanged(node, prop, value);
        };
        const removeInlineProps = (node, props) => {
            if (!(node instanceof HTMLElement) || !Array.isArray(props)) return;
            props.forEach((prop) => {
                removeStylePropertyIfPresent(node, prop);
            });
        };
        const bottomInlineProps = [
            'position',
            'top',
            'right',
            'z-index',
            'display',
            'align-items',
            'width',
            'height',
            'min-height',
            'max-height',
            'max-width',
            'margin',
            'margin-top',
            'margin-left',
            'margin-right',
            'padding',
            'line-height',
            'pointer-events',
            'box-sizing',
            'overflow',
        ];
        const linkInlineProps = [
            'display',
            'align-items',
            'justify-content',
            'float',
            'width',
            'min-width',
            'height',
            'min-height',
            'max-height',
            'max-width',
            'margin',
            'padding',
            'border-radius',
            'background-color',
            'background-image',
            'background-position',
            'background-size',
            'background-repeat',
            'box-shadow',
            'color',
            'font-size',
            'font-weight',
            'line-height',
            'text-align',
            'text-decoration',
            'overflow',
            'text-overflow',
            'white-space',
            'pointer-events',
            'box-sizing',
        ];
        const eventReserveProps = [
            ['width', 'tmCalTimegridMoreReserveWidth', 'tmCalTimegridMoreReserveWidthPriority'],
            ['max-width', 'tmCalTimegridMoreReserveMaxWidth', 'tmCalTimegridMoreReserveMaxWidthPriority'],
            ['margin-right', 'tmCalTimegridMoreReserveMarginRight', 'tmCalTimegridMoreReserveMarginRightPriority'],
        ];
        const restoreInlineSourceEventReserve = (harness) => {
            if (!(harness instanceof HTMLElement)) return;
            const eventEl = harness.querySelector?.('.fc-event');
            if (!(eventEl instanceof HTMLElement) || eventEl.dataset?.tmCalTimegridMoreReserveApplied !== '1') return;
            eventReserveProps.forEach(([prop, valueKey, priorityKey]) => {
                const value = eventEl.dataset?.[valueKey] || '';
                const priority = eventEl.dataset?.[priorityKey] || '';
                try {
                    if (value) eventEl.style.setProperty(prop, value, priority);
                    else eventEl.style.removeProperty(prop);
                } catch (e) {}
                try { delete eventEl.dataset[valueKey]; } catch (e) {}
                try { delete eventEl.dataset[priorityKey]; } catch (e) {}
            });
            try { delete eventEl.dataset.tmCalTimegridMoreReserveApplied; } catch (e) {}
        };
        const reserveInlineSourceEventSpace = (harness, widthPx) => {
            if (!(harness instanceof HTMLElement)) return false;
            const eventEl = harness.querySelector?.('.fc-event');
            const rawReserveWidth = Number(widthPx);
            const reserveWidth = Number.isFinite(rawReserveWidth)
                ? Math.max(0, Number(rawReserveWidth.toFixed(2)))
                : 0;
            if (!(eventEl instanceof HTMLElement) || reserveWidth <= 0) return false;
            if (eventEl.dataset?.tmCalTimegridMoreReserveApplied !== '1') {
                eventReserveProps.forEach(([prop, valueKey, priorityKey]) => {
                    try { eventEl.dataset[valueKey] = eventEl.style.getPropertyValue(prop) || ''; } catch (e) {}
                    try { eventEl.dataset[priorityKey] = eventEl.style.getPropertyPriority(prop) || ''; } catch (e) {}
                });
                try { eventEl.dataset.tmCalTimegridMoreReserveApplied = '1'; } catch (e) {}
            }
            setImportant(eventEl, 'width', `calc(100% - ${reserveWidth}px)`);
            setImportant(eventEl, 'max-width', `calc(100% - ${reserveWidth}px)`);
            setImportant(eventEl, 'margin-right', `${reserveWidth}px`);
            return true;
        };
        const styleMoreLink = (moreLink, mode) => {
            if (!(moreLink instanceof HTMLElement)) return;
            setImportant(moreLink, 'display', 'inline-flex');
            setImportant(moreLink, 'align-items', 'center');
            setImportant(moreLink, 'justify-content', 'center');
            setImportant(moreLink, 'float', 'none');
            setImportant(moreLink, 'min-width', '28px');
            setImportant(moreLink, 'height', 'var(--tm-calendar-month-more-link-height, 19px)');
            setImportant(moreLink, 'min-height', 'var(--tm-calendar-month-more-link-height, 19px)');
            setImportant(moreLink, 'max-width', '100%');
            setImportant(moreLink, 'margin', '0');
            setImportant(moreLink, 'padding', '0 6px 0 7px');
            setImportant(moreLink, 'border-radius', '5px');
            setImportant(moreLink, 'background-image', 'linear-gradient(var(--tm-calendar-month-more-bg, rgba(127, 127, 127, 0.11)), var(--tm-calendar-month-more-bg, rgba(127, 127, 127, 0.11)))');
            setImportant(moreLink, 'background-position', 'left top');
            setImportant(moreLink, 'background-size', '100% 100%');
            setImportant(moreLink, 'background-repeat', 'no-repeat');
            setImportant(moreLink, 'background-color', 'var(--tm-calendar-month-more-bg, rgba(127, 127, 127, 0.11))');
            setImportant(moreLink, 'box-shadow', 'inset 0 -1px 0 var(--fc-page-bg-color, var(--tm-bg-color, #fff))');
            setImportant(moreLink, 'color', 'var(--tm-calendar-month-more-text, var(--tm-secondary-text))');
            setImportant(moreLink, 'font-size', '11px');
            setImportant(moreLink, 'font-weight', '700');
            setImportant(moreLink, 'line-height', '1.1');
            setImportant(moreLink, 'text-align', 'center');
            setImportant(moreLink, 'text-decoration', 'none');
            setImportant(moreLink, 'overflow', 'hidden');
            setImportant(moreLink, 'text-overflow', 'ellipsis');
            setImportant(moreLink, 'white-space', 'nowrap');
            setImportant(moreLink, 'box-sizing', 'border-box');
            setImportant(moreLink, 'pointer-events', 'auto');
            if (mode === 'standalone') setImportant(moreLink, 'width', '100%');
            else setImportant(moreLink, 'width', 'auto');
        };
        const getElementRect = (node) => {
            try {
                const rect = node instanceof HTMLElement ? node.getBoundingClientRect() : null;
                if (rect && rect.width > 0 && rect.height > 0) return rect;
            } catch (e) {}
            return null;
        };
        const isVisibleHarness = (node) => {
            if (!(node instanceof HTMLElement)) return false;
            if (!node.classList.contains('fc-daygrid-event-harness')) return false;
            if (node.classList.contains('fc-daygrid-event-harness-abs')) return false;
            try {
                const computed = window.getComputedStyle(node);
                if (computed.display === 'none' || computed.visibility === 'hidden') return false;
            } catch (e) {}
            return !!getElementRect(node);
        };
        const getVisibleHarnesses = (eventsRoot) => {
            if (!(eventsRoot instanceof HTMLElement)) return null;
            return Array.from(eventsRoot.children || []).filter(isVisibleHarness);
        };
        const getLastVisibleHarness = (eventsRoot) => {
            const harnesses = getVisibleHarnesses(eventsRoot) || [];
            let lastHarness = null;
            let lastTop = -Infinity;
            let lastLeft = -Infinity;
            for (const harness of harnesses) {
                try {
                    const rect = harness.getBoundingClientRect();
                    if (rect.top > lastTop + 0.5 || (Math.abs(rect.top - lastTop) <= 0.5 && rect.left > lastLeft)) {
                        lastHarness = harness;
                        lastTop = rect.top;
                        lastLeft = rect.left;
                    }
                } catch (e) {}
            }
            return lastHarness instanceof HTMLElement ? lastHarness : null;
        };
        const getEventRectFromHarness = (harness) => {
            const eventEl = harness?.querySelector?.('.fc-event');
            return eventEl instanceof HTMLElement ? getElementRect(eventEl) : null;
        };
        const isSingleDayCalendarEvent = (eventEl) => {
            try {
                if (!(eventEl instanceof HTMLElement)) return null;
                const eventId = String(eventEl.getAttribute('data-tm-cal-event-id') || '').trim();
                const eventApi = eventId && calendar?.getEventById ? calendar.getEventById(eventId) : null;
                if (!eventApi) return null;
                const start = eventApi.start instanceof Date ? eventApi.start : null;
                if (!start || Number.isNaN(start.getTime())) return null;
                const startKey = formatDateKey(start);
                if (!startKey) return null;
                const end = eventApi.end instanceof Date ? eventApi.end : null;
                if (eventApi.allDay === true) {
                    const expectedEndKey = shiftDateKey(startKey, 1);
                    const endKey = end && !Number.isNaN(end.getTime()) ? formatDateKey(end) : expectedEndKey;
                    return !!endKey && !!expectedEndKey && endKey <= expectedEndKey;
                }
                if (!end || Number.isNaN(end.getTime())) return true;
                return formatDateKey(end) === startKey;
            } catch (e) {}
            return null;
        };
        const syncMoreLinkToEventSize = (bottom, moreLink, eventRect) => {
            if (!(bottom instanceof HTMLElement) || !(moreLink instanceof HTMLElement)) return;
            const eventHeight = Number(eventRect?.height || 0);
            if (Number.isFinite(eventHeight) && eventHeight > 0) {
                const exactHeight = `${Math.max(1, Number(eventHeight.toFixed(2)))}px`;
                setImportant(bottom, 'height', exactHeight);
                setImportant(bottom, 'min-height', exactHeight);
                setImportant(bottom, 'max-height', exactHeight);
                setImportant(moreLink, 'height', exactHeight);
                setImportant(moreLink, 'min-height', exactHeight);
                setImportant(moreLink, 'max-height', exactHeight);
            }
        };
        const setStandalone = (bottom, moreLink, eventsRect, refRect) => {
            if (!(bottom instanceof HTMLElement)) return;
            bottom.classList.add('tm-cal-timegrid-more-standalone');
            const leftInset = Math.max(0, Number(((refRect?.left || eventsRect?.left || 0) - (eventsRect?.left || 0)).toFixed(2)));
            const rightInset = Math.max(0, Number(((eventsRect?.right || refRect?.right || 0) - (refRect?.right || eventsRect?.right || 0)).toFixed(2)));
            setImportant(bottom, 'position', 'static');
            setImportant(bottom, 'display', 'block');
            setImportant(bottom, 'width', leftInset || rightInset ? `calc(100% - ${Number((leftInset + rightInset).toFixed(2))}px)` : '100%');
            setImportant(bottom, 'max-width', '100%');
            setImportant(bottom, 'margin-top', '0');
            setImportant(bottom, 'margin-left', `${leftInset}px`);
            setImportant(bottom, 'margin-right', `${rightInset}px`);
            setImportant(bottom, 'padding', '0');
            setImportant(bottom, 'line-height', '1');
            setImportant(bottom, 'pointer-events', 'auto');
            setImportant(bottom, 'box-sizing', 'border-box');
            styleMoreLink(moreLink, 'standalone');
            syncMoreLinkToEventSize(bottom, moreLink, refRect);
        };
        const setInline = (eventsRoot, bottom, moreLink, lastHarness, eventsRect, lastEventRect) => {
            if (!(eventsRoot instanceof HTMLElement) || !(bottom instanceof HTMLElement) || !(lastHarness instanceof HTMLElement)) return false;
            const lastEventEl = lastHarness.querySelector?.('.fc-event');
            if (!(lastEventEl instanceof HTMLElement) || !lastEventRect || !eventsRect) return false;
            bottom.classList.add('tm-cal-timegrid-more-inline');
            lastHarness.classList.add('tm-cal-timegrid-more-inline-source');
            styleMoreLink(moreLink, 'inline');
            const linkRect = getElementRect(moreLink);
            const linkWidth = Math.max(28, Number((Number(linkRect?.width || 28)).toFixed(2)));
            const rightInset = Math.max(0, Number((eventsRect.right - lastEventRect.right).toFixed(2)));
            const inlineGap = 1;
            const reserveWidth = Math.max(0, Number((linkWidth + rightInset + inlineGap).toFixed(2)));
            reserveInlineSourceEventSpace(lastHarness, reserveWidth);
            try { eventsRoot.style.setProperty('position', 'relative', 'important'); } catch (e) {}
            const measuredEventRect = getElementRect(lastEventEl) || lastEventRect;
            const top = Math.max(0, Number((measuredEventRect.top - eventsRect.top).toFixed(2)));
            setImportant(bottom, 'position', 'absolute');
            setImportant(bottom, 'top', `${top}px`);
            setImportant(bottom, 'right', `${rightInset}px`);
            setImportant(bottom, 'z-index', '8');
            setImportant(bottom, 'display', 'flex');
            setImportant(bottom, 'align-items', 'center');
            setImportant(bottom, 'width', `${linkWidth}px`);
            setImportant(bottom, 'max-width', 'calc(100% - 8px)');
            setImportant(bottom, 'margin', '0');
            setImportant(bottom, 'padding', '0');
            setImportant(bottom, 'line-height', '1');
            setImportant(bottom, 'pointer-events', 'none');
            setImportant(bottom, 'box-sizing', 'border-box');
            setImportant(bottom, 'overflow', 'hidden');
            syncMoreLinkToEventSize(bottom, moreLink, measuredEventRect);
            return true;
        };
        targetRoot.querySelectorAll('.tm-cal-timegrid-more-inline, .tm-cal-timegrid-more-standalone').forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            node.classList.remove('tm-cal-timegrid-more-inline');
            node.classList.remove('tm-cal-timegrid-more-standalone');
            removeInlineProps(node, bottomInlineProps);
            const moreLink = node.querySelector?.('.fc-more-link');
            removeInlineProps(moreLink, linkInlineProps);
        });
        targetRoot.querySelectorAll('.tm-cal-timegrid-more-inline-source').forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            restoreInlineSourceEventReserve(node);
            node.classList.remove('tm-cal-timegrid-more-inline-source');
        });
        let count = 0;
        scope.querySelectorAll('.fc-daygrid-day-bottom').forEach((bottom) => {
            if (!(bottom instanceof HTMLElement)) return;
            if (bottom.closest('.fc-popover')) return;
            const moreLink = bottom.querySelector?.('.fc-daygrid-more-link, .fc-more-link');
            if (!(moreLink instanceof HTMLElement)) return;
            const eventsRoot = bottom.closest?.('.fc-daygrid-day-events');
            const eventsRect = getElementRect(eventsRoot);
            const lastHarness = getLastVisibleHarness(eventsRoot);
            const lastEventEl = lastHarness?.querySelector?.('.fc-event');
            const lastEventRect = getEventRectFromHarness(lastHarness);
            if (eventsRoot instanceof HTMLElement && eventsRect && lastHarness instanceof HTMLElement && lastEventEl instanceof HTMLElement && lastEventRect) {
                const isSingleDay = isSingleDayCalendarEvent(lastEventEl);
                const visuallySpansCells = lastEventRect.width > eventsRect.width + 4;
                if ((isSingleDay === true || isSingleDay === null) && !visuallySpansCells) {
                    if (setInline(eventsRoot, bottom, moreLink, lastHarness, eventsRect, lastEventRect)) {
                        count += 1;
                        return;
                    }
                }
            }
            setStandalone(bottom, moreLink, eventsRect, lastEventRect);
            count += 1;
        });
        return count > 0;
    }

    function applyMainCalendarSlotHeightLayout(rootEl, settings) {
        return __tmApplyTimeGridHeightLayout(rootEl, settings);
    }

    function getCalendarTimeGridContentHeight(settings) {
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

    function getSideDayContentHeight(settings) {
        return getCalendarTimeGridContentHeight(settings);
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
        return __tmApplyTimeGridHeightLayout(rootEl, settings);
    }

    function applyTimeAxisColumnLayout(rootEl, axisWidthPx = 40) {
        if (!(rootEl instanceof HTMLElement)) return false;
        const width = `${Math.max(34, Math.round(Number(axisWidthPx) || 40))}px`;
        const isSideDockRoot = isSideDayTimelineRoot(rootEl);
        const hourFontSize = '14px';
        const allDayFontSize = '14px';
        const hourOpacity = '0.82';
        const allDayOpacity = '0.74';
        const labelColor = 'color-mix(in srgb, var(--tm-text-color) 72%, var(--tm-secondary-text) 28%)';
        const hourTranslateY = isSideDockRoot ? '-46%' : '12%';
        const widthNodes = Array.from(rootEl.querySelectorAll('.fc-scrollgrid col:first-child, .fc-scrollgrid-section > td:first-child, .fc-scrollgrid-section > th:first-child, td.fc-timegrid-slot-label, .fc-timegrid-axis, .fc-timegrid-axis-frame, .fc-timegrid-slot-label-frame, .fc-timegrid-axis-cushion, .fc-timegrid-slot-label-cushion'));
        const centerNodes = Array.from(rootEl.querySelectorAll('.fc-timegrid-axis, td.fc-timegrid-slot-label, .fc-timegrid-axis-frame, .fc-timegrid-slot-label-frame, .fc-timegrid-axis-cushion, .fc-timegrid-slot-label-cushion'));
        const flexNodes = Array.from(rootEl.querySelectorAll('.fc-timegrid-axis-frame, .fc-timegrid-slot-label-frame, .fc-timegrid-axis-cushion, .fc-timegrid-slot-label-cushion'));
        const hourNodes = Array.from(rootEl.querySelectorAll('.fc-timegrid-slots .fc-timegrid-axis-cushion, .fc-timegrid-slot-label-cushion'));
        const allDayAxis = Array.from(getAllDayAxisCushions(rootEl) || []);
        const passKey = [
            width,
            hourTranslateY,
            labelColor,
            hourFontSize,
            allDayFontSize,
            hourOpacity,
            allDayOpacity,
            isSideDockRoot ? 1 : 0,
        ].join('|');
        const stamps = [
            __tmCreateNodeListStamp(widthNodes),
            __tmCreateNodeListStamp(centerNodes),
            __tmCreateNodeListStamp(flexNodes),
            __tmCreateNodeListStamp(hourNodes),
            __tmCreateNodeListStamp(allDayAxis),
        ];
        try { rootEl.style.setProperty('--tm-calendar-axis-width', width); } catch (e) {}
        try { rootEl.style.setProperty('--tm-calendar-hour-translate-y', hourTranslateY); } catch (e) {}
        if (__tmShouldSkipCalendarDomPass(__tmCalendarDomPassCache.timeAxis, rootEl, passKey, stamps)) return true;
        for (const node of widthNodes) {
            if (!(node instanceof Element)) continue;
            try { node.style.setProperty('width', width, 'important'); } catch (e) {}
            try { node.style.setProperty('min-width', width, 'important'); } catch (e) {}
            try { node.style.setProperty('max-width', width, 'important'); } catch (e) {}
            try { node.style.setProperty('box-sizing', 'border-box', 'important'); } catch (e) {}
        }
        for (const node of centerNodes) {
            if (!(node instanceof HTMLElement)) continue;
            try { node.style.setProperty('text-align', 'center', 'important'); } catch (e) {}
            try { node.style.setProperty('justify-content', 'center', 'important'); } catch (e) {}
            try { node.style.setProperty('color', labelColor, 'important'); } catch (e) {}
        }
        for (const node of flexNodes) {
            if (!(node instanceof HTMLElement)) continue;
            try { node.style.setProperty('display', 'flex', 'important'); } catch (e) {}
            try { node.style.setProperty('margin', '0 auto', 'important'); } catch (e) {}
            try { node.style.setProperty('padding-left', '0', 'important'); } catch (e) {}
            try { node.style.setProperty('padding-right', '0', 'important'); } catch (e) {}
        }
        for (const node of hourNodes) {
            if (!(node instanceof HTMLElement)) continue;
            try { node.style.setProperty('font-size', hourFontSize, 'important'); } catch (e) {}
            try { node.style.setProperty('line-height', '1', 'important'); } catch (e) {}
            try { node.style.setProperty('opacity', hourOpacity, 'important'); } catch (e) {}
            try { node.style.setProperty('font-weight', '400', 'important'); } catch (e) {}
            try { node.style.setProperty('color', labelColor, 'important'); } catch (e) {}
            try { node.style.setProperty('align-items', 'flex-start', 'important'); } catch (e) {}
            try { node.style.setProperty('padding-top', '0', 'important'); } catch (e) {}
            try { node.style.setProperty('transform', `translateY(var(--tm-calendar-hour-translate-y, ${hourTranslateY}))`, 'important'); } catch (e) {}
        }
        for (const node of allDayAxis) {
            if (!(node instanceof HTMLElement)) continue;
            try { node.style.setProperty('font-size', allDayFontSize, 'important'); } catch (e) {}
            try { node.style.setProperty('line-height', '1', 'important'); } catch (e) {}
            try { node.style.setProperty('opacity', allDayOpacity, 'important'); } catch (e) {}
            try { node.style.setProperty('font-weight', '600', 'important'); } catch (e) {}
            try { node.style.setProperty('color', labelColor, 'important'); } catch (e) {}
            try { node.style.setProperty('align-items', 'center', 'important'); } catch (e) {}
            try { node.style.setProperty('transform', 'none', 'important'); } catch (e) {}
        }
        try { ensureInlineAllDayAxisToggle(rootEl); } catch (e) {}
        __tmRememberCalendarDomPass(__tmCalendarDomPassCache.timeAxis, rootEl, passKey, stamps);
        return true;
    }

    function syncSideDayLayout(rootEl, calendar, settings) {
        if (!(rootEl instanceof HTMLElement)) return false;
        const nextSettings = settings || getSettings();
        try { calendar?.setOption?.('height', 'parent'); } catch (e) {}
        try { applyTimeAxisColumnLayout(rootEl, 40); } catch (e) {}
        try { forceSideDaySlotHeight(rootEl, nextSettings); } catch (e) {}
        try { calendar?.updateSize?.(); } catch (e) {}
        try { enhanceNowIndicator(rootEl); } catch (e) {}
        try { scheduleCurrentTimeAutoCenter(rootEl, calendar, nextSettings, { scope: 'sideDay' }); } catch (e) {}
        try {
            requestAnimationFrame(() => {
                try { applyTimeAxisColumnLayout(rootEl, 40); } catch (e2) {}
                try { forceSideDaySlotHeight(rootEl, nextSettings); } catch (e2) {}
                try { calendar?.updateSize?.(); } catch (e2) {}
                try { enhanceNowIndicator(rootEl); } catch (e2) {}
                try { scheduleCurrentTimeAutoCenter(rootEl, calendar, nextSettings, { scope: 'sideDay' }); } catch (e2) {}
            });
        } catch (e) {}
        return true;
    }

    function refreshAllDayCollapseLayout(rootEl, calendar) {
        if (!(rootEl instanceof HTMLElement) || !calendar) return false;
        try { syncTimeGridAllDayCollapseUi(rootEl, calendar); } catch (e) {}
        if (isSideDayTimelineRoot(rootEl)) {
            try { syncSideDayLayout(rootEl, calendar, getSettings()); } catch (e) {}
            try { scheduleSyncTimeGridAllDayCollapseUi(rootEl, calendar); } catch (e) {}
            return true;
        }
        const wrap = state.wrapEl || rootEl.closest?.('.tm-calendar-wrap') || rootEl;
        try { applyMainCalendarSlotHeightLayout(wrap, getSettings()); } catch (e) {}
        try { applyTimeAxisColumnLayout(rootEl, 40); } catch (e) {}
        try { calendar.updateSize?.(); } catch (e) {}
        try { stabilizeCalendarLayout(calendar, wrap, { hard: false }); } catch (e) {}
        try { scheduleSyncTimeGridAllDayCollapseUi(rootEl, calendar); } catch (e) {}
        return true;
    }

    function toggleTimeGridAllDayCollapsed(rootEl, calendar, nextCollapsed) {
        if (!(rootEl instanceof HTMLElement) || !calendar) return false;
        if (!isTimeGridAllDayCollapseSupported(calendar)) return false;
        const next = typeof nextCollapsed === 'boolean' ? nextCollapsed : !getAllDayCollapsed(rootEl);
        setAllDayCollapsed(rootEl, next);
        refreshAllDayCollapseLayout(rootEl, calendar);
        return next;
    }

    function getCalendarForRoot(rootEl) {
        return isSideDayTimelineRoot(rootEl) ? (state.sideDay?.calendar || null) : (state.calendar || null);
    }

    function ensureInlineAllDayAxisToggle(rootEl, calendar) {
        if (!(rootEl instanceof HTMLElement)) return false;
        const cal = calendar || getCalendarForRoot(rootEl);
        if (!isTimeGridAllDayCollapseSupported(cal)) return false;
        const axisNodes = getAllDayAxisCushions(rootEl);
        if (!axisNodes.length) return false;
        const labelColor = 'color-mix(in srgb, var(--tm-text-color) 72%, var(--tm-secondary-text) 28%)';
        const collapsed = getAllDayCollapsed(rootEl);
        for (const node of axisNodes) {
            if (!(node instanceof HTMLElement)) continue;
            node.setAttribute('data-tm-cal-original-label', '全天');
            const legacyLabel = node.querySelector('.tm-cal-allday-inline-label');
            if (legacyLabel instanceof HTMLElement) {
                try { legacyLabel.remove(); } catch (e) {}
            }
            const toggleCandidates = Array.from(node.querySelectorAll('.tm-cal-allday-toggle')).filter((el) => el instanceof HTMLButtonElement);
            let toggleBtn = toggleCandidates[0] instanceof HTMLButtonElement ? toggleCandidates[0] : null;
            toggleCandidates.slice(1).forEach((el) => {
                try { el.remove(); } catch (e) {}
            });
            if (!(toggleBtn instanceof HTMLButtonElement)) {
                node.textContent = '';
                toggleBtn = document.createElement('button');
                toggleBtn.type = 'button';
                toggleBtn.className = 'tm-cal-allday-toggle bc-btn bc-btn--sm';
                toggleBtn.innerHTML = '<span class="tm-cal-allday-toggle-text">全天</span>';
                try { toggleBtn.style.visibility = 'hidden'; } catch (e) {}
                node.appendChild(toggleBtn);
            } else if (!(toggleBtn.querySelector('.tm-cal-allday-toggle-text') instanceof HTMLElement)) {
                toggleBtn.innerHTML = '<span class="tm-cal-allday-toggle-text">全天</span>';
            }
            if (toggleBtn.parentElement !== node) {
                try { node.appendChild(toggleBtn); } catch (e) {}
            }
            Array.from(node.childNodes || []).forEach((child) => {
                if (child === toggleBtn) return;
                try { child.parentNode?.removeChild(child); } catch (e) {}
            });
            try { toggleBtn.classList.add('bc-btn', 'bc-btn--sm'); } catch (e) {}
            try { node.style.setProperty('display', 'flex', 'important'); } catch (e) {}
            try { node.style.setProperty('flex-direction', 'row', 'important'); } catch (e) {}
            try { node.style.setProperty('align-items', 'center', 'important'); } catch (e) {}
            try { node.style.setProperty('justify-content', 'center', 'important'); } catch (e) {}
            try { node.style.setProperty('gap', '0', 'important'); } catch (e) {}
            try { node.style.setProperty('padding', '1px 0', 'important'); } catch (e) {}
            try { node.style.setProperty('overflow', 'visible', 'important'); } catch (e) {}
            try { node.style.setProperty('white-space', 'nowrap', 'important'); } catch (e) {}
            try { node.style.setProperty('writing-mode', 'horizontal-tb', 'important'); } catch (e) {}
            try { node.style.setProperty('text-orientation', 'mixed', 'important'); } catch (e) {}
            try { toggleBtn.style.display = 'inline-flex'; } catch (e) {}
            try { toggleBtn.style.alignItems = 'center'; } catch (e) {}
            try { toggleBtn.style.justifyContent = 'center'; } catch (e) {}
            try { toggleBtn.style.gap = '0'; } catch (e) {}
            try { toggleBtn.style.width = 'auto'; } catch (e) {}
            try { toggleBtn.style.minWidth = '0'; } catch (e) {}
            try { toggleBtn.style.height = '16px'; } catch (e) {}
            try { toggleBtn.style.padding = '0 6px'; } catch (e) {}
            try { toggleBtn.style.cursor = 'pointer'; } catch (e) {}
            try { toggleBtn.style.boxSizing = 'border-box'; } catch (e) {}
            try { toggleBtn.style.removeProperty('border'); } catch (e) {}
            try { toggleBtn.style.removeProperty('border-radius'); } catch (e) {}
            try { toggleBtn.style.removeProperty('background'); } catch (e) {}
            try { toggleBtn.style.removeProperty('color'); } catch (e) {}
            try { toggleBtn.style.setProperty('--tm-ui-background', 'var(--tm-bg-color, #fff)'); } catch (e) {}
            try { toggleBtn.style.setProperty('--tm-ui-foreground', labelColor); } catch (e) {}
            try { toggleBtn.style.setProperty('--tm-ui-secondary', 'color-mix(in srgb, var(--tm-bg-color, #fff) 92%, var(--tm-text-color, #000) 8%)'); } catch (e) {}
            try { toggleBtn.style.setProperty('--tm-ui-secondary-foreground', labelColor); } catch (e) {}
            try { toggleBtn.style.setProperty('--tm-ui-border', 'color-mix(in srgb, var(--tm-text-color, #000) 12%, transparent)'); } catch (e) {}
            try { toggleBtn.style.setProperty('--tm-ui-ring', 'color-mix(in srgb, var(--tm-primary-color) 26%, transparent)'); } catch (e) {}
            try { toggleBtn.style.setProperty('--tm-ui-radius', '999px'); } catch (e) {}
            const textEl = toggleBtn.querySelector('.tm-cal-allday-toggle-text');
            if (textEl instanceof HTMLElement) {
                try { textEl.style.display = 'inline-block'; } catch (e) {}
                try { textEl.style.lineHeight = '0.9'; } catch (e) {}
                try { textEl.style.whiteSpace = 'nowrap'; } catch (e) {}
                try { textEl.style.color = labelColor; } catch (e) {}
                try { textEl.style.fontSize = '10px'; } catch (e) {}
                try { textEl.style.fontWeight = '600'; } catch (e) {}
            }
            const iconEl = toggleBtn.querySelector('.tm-cal-allday-toggle-icon');
            if (iconEl instanceof HTMLElement) {
                try { iconEl.remove(); } catch (e) {}
            }
            toggleBtn.setAttribute('aria-label', collapsed ? '展开全天任务' : '折叠全天任务');
            toggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            toggleBtn.title = collapsed ? '展开全天任务' : '折叠全天任务';
            try { toggleBtn.style.visibility = ''; } catch (e) {}
            bindAllDayCollapseActivator(toggleBtn, rootEl, cal);
        }
        return true;
    }

    function enhanceNowIndicator(rootEl) {
        if (!(rootEl instanceof HTMLElement)) return false;
        const pageBg = String(window.getComputedStyle(rootEl).getPropertyValue('--fc-page-bg-color') || '').trim() || '#fff';
        const nowColor = String(window.getComputedStyle(rootEl).getPropertyValue('--fc-now-indicator-color') || '').trim() || 'var(--tm-primary-color)';
        const containers = Array.from(rootEl.querySelectorAll('.fc-timegrid-now-indicator-container'));
        const arrows = Array.from(rootEl.querySelectorAll('.fc-timegrid-now-indicator-arrow'));
        const lines = Array.from(rootEl.querySelectorAll('.fc-timegrid-now-indicator-line'));
        const passKey = `${pageBg}|${nowColor}`;
        const stamps = [
            __tmCreateNodeListStamp(containers),
            __tmCreateNodeListStamp(arrows),
            __tmCreateNodeListStamp(lines),
        ];
        if (__tmShouldSkipCalendarDomPass(__tmCalendarDomPassCache.nowIndicator, rootEl, passKey, stamps)) return lines.length > 0;
        containers.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            try { node.style.setProperty('overflow', 'visible', 'important'); } catch (e) {}
        });
        arrows.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            try { node.style.setProperty('display', 'none', 'important'); } catch (e) {}
        });
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
        __tmRememberCalendarDomPass(__tmCalendarDomPassCache.nowIndicator, rootEl, passKey, stamps);
        return lines.length > 0;
    }

    function refreshCalendarSlotHeight(settings) {
        const nextSettings = settings || getSettings();
        try { clearTimeGridAutoCenterState('main'); } catch (e) {}
        try { clearTimeGridAutoCenterState('sideDay'); } catch (e) {}
        try { applyCalendarSlotHeightStyle(state.wrapEl, nextSettings); } catch (e) {}
        try { applyMainCalendarSlotHeightLayout(state.wrapEl, nextSettings); } catch (e) {}
        try { state.calendar?.updateSize?.(); } catch (e) {}
        try { scheduleCurrentTimeAutoCenter(state.calendarEl, state.calendar, nextSettings, { scope: 'main', force: true }); } catch (e) {}
        try { scheduleSyncTimeGridAllDayCollapseUi(state.calendarEl, state.calendar); } catch (e) {}
        try { syncSideDayLayout(state.sideDay?.rootEl, state.sideDay?.calendar, nextSettings); } catch (e) {}
        try { scheduleSyncTimeGridAllDayCollapseUi(state.sideDay?.rootEl, state.sideDay?.calendar); } catch (e) {}
        try {
            requestAnimationFrame(() => {
                try { applyCalendarSlotHeightStyle(state.wrapEl, nextSettings); } catch (e2) {}
                try { applyMainCalendarSlotHeightLayout(state.wrapEl, nextSettings); } catch (e2) {}
                try { state.calendar?.updateSize?.(); } catch (e2) {}
                try { scheduleCurrentTimeAutoCenter(state.calendarEl, state.calendar, nextSettings, { scope: 'main', force: true }); } catch (e2) {}
                try { scheduleSyncTimeGridAllDayCollapseUi(state.calendarEl, state.calendar); } catch (e2) {}
                try { syncSideDayLayout(state.sideDay?.rootEl, state.sideDay?.calendar, nextSettings); } catch (e2) {}
                try { scheduleSyncTimeGridAllDayCollapseUi(state.sideDay?.rootEl, state.sideDay?.calendar); } catch (e2) {}
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
        const monthAdaptiveRowHeight0 = readStoredBool('tm_calendar_month_adaptive_row_height', typeof s.calendarMonthAdaptiveRowHeight === 'boolean' ? s.calendarMonthAdaptiveRowHeight : true);
        const monthMinVisibleEvents0 = normalizeCalendarMonthMinVisibleEvents(readStoredString('tm_calendar_month_min_visible_events', s.calendarMonthMinVisibleEvents).trim() || '3');
        const visibleStartTime0 = normalizeCalendarVisibleTime(readStoredString('tm_calendar_visible_start_time', s.calendarVisibleStartTime).trim() || '00:00', '00:00', false);
        const visibleEndTime0 = normalizeCalendarVisibleTime(readStoredString('tm_calendar_visible_end_time', s.calendarVisibleEndTime).trim() || '24:00', '24:00', true);
        const threeDayTodayPosition0 = normalizeCalendar3DayTodayPosition(readStoredString('tm_calendar_3day_today_position', s.calendar3DayTodayPosition).trim() || '1');
        return {
            enabled: !!s.calendarEnabled,
            linkDockTomato: !!s.calendarLinkDockTomato,
            firstDay: Number(s.calendarFirstDay) === 0 ? 0 : 1,
            threeDayTodayPosition: threeDayTodayPosition0,
            monthAggregate: !!s.calendarMonthAggregate,
            showSchedule: s.calendarShowSchedule !== false,
            scheduleReminderEnabled: readStoredBool('tm_calendar_schedule_reminder_enabled', typeof s.calendarScheduleReminderEnabled === 'boolean' ? !!s.calendarScheduleReminderEnabled : undefined),
            scheduleReminderSystemEnabled: readStoredBool('tm_calendar_schedule_reminder_system_enabled', typeof s.calendarScheduleReminderSystemEnabled === 'boolean' ? !!s.calendarScheduleReminderSystemEnabled : undefined),
            scheduleReminderDefaultMode: defaultMode0,
            allDayReminderEnabled: readStoredBool('tm_calendar_all_day_reminder_enabled', typeof s.calendarAllDayReminderEnabled === 'boolean' ? !!s.calendarAllDayReminderEnabled : undefined),
            allDayReminderTime: allDayTime0 || '09:00',
            showTaskDates: s.calendarShowTaskDates !== false,
            hideScheduledTaskDatesInAllDay: readStoredBool('tm_calendar_hide_scheduled_task_dates_in_all_day', typeof s.calendarHideScheduledTaskDatesInAllDay === 'boolean' ? !!s.calendarHideScheduledTaskDatesInAllDay : undefined),
            newScheduleMaxDurationMin: normalizeNewScheduleMaxDuration(s.calendarNewScheduleMaxDurationMin),
            hourSlotHeightMode: hourSlotHeightMode0,
            monthAdaptiveRowHeight: monthAdaptiveRowHeight0,
            monthMinVisibleEvents: monthMinVisibleEvents0,
            taskDateAllDayReminderEnabled: readStoredBool('tm_calendar_taskdate_all_day_reminder_enabled', typeof s.calendarTaskDateAllDayReminderEnabled === 'boolean' ? !!s.calendarTaskDateAllDayReminderEnabled : undefined),
            allDaySummaryIncludeExtras: s.calendarAllDaySummaryIncludeExtras !== false,
            taskDateColorMode: String(s.calendarTaskDateColorMode || 'group').trim() || 'group',
            priorityIconStyle: normalizeFloatingMiniPriorityIconStyle(readStoredString('tm_priority_icon_style', s.priorityIconStyle).trim() || 'jira'),
            scheduleFollowDocColor: readStoredBool('tm_calendar_schedule_follow_doc_color', typeof s.calendarScheduleFollowDocColor === 'boolean' ? !!s.calendarScheduleFollowDocColor : undefined),
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
            showOtherBlockCheckbox: readStoredBool('tm_calendar_show_other_block_checkbox', typeof s.calendarShowOtherBlockCheckbox === 'boolean' ? !!s.calendarShowOtherBlockCheckbox : undefined),
            colorFocus: String(s.calendarColorFocus || 'var(--tm-primary-color)'),
            colorBreak: String(s.calendarColorBreak || 'var(--tm-success-color)'),
            colorStopwatch: String(s.calendarColorStopwatch || 'var(--tm-warning-color, #f9ab00)'),
            colorIdle: String(s.calendarColorIdle || '#9aa0a6'),
            calendarsConfig: (s.calendarCalendarsConfig && typeof s.calendarCalendarsConfig === 'object' && !Array.isArray(s.calendarCalendarsConfig)) ? s.calendarCalendarsConfig : {},
            defaultCalendarId: String(s.calendarDefaultCalendarId || 'default'),
            lastViewType: String(s.calendarLastViewType || '').trim(),
            lastDate: String(s.calendarLastDate || '').trim(),
            sidebarWidth: Number(s.calendarSidebarWidth) || 280,
            defaultSidebarPage: normalizeCalendarSidebarDefaultPage(s.calendarSidebarDefaultPage),
            collapseDesktopSidebarDefault: !!s.calendarSidebarCollapsedDesktopDefault,
            collapseCalendars: !!s.calendarSidebarCollapseCalendars,
            collapseDocGroups: !!s.calendarSidebarCollapseDocGroups,
            collapseTomato: !!s.calendarSidebarCollapseTomato,
            collapseTasks: !!s.calendarSidebarCollapseTasks,
        };
    }

    function isDarkThemeMode() {
        try {
            return String(document.documentElement.getAttribute('data-theme-mode') || '').trim().toLowerCase() === 'dark';
        } catch (e) {}
        return false;
    }

    function resolveCalendarDocColor(docId, fallback = '') {
        const id = String(docId || '').trim();
        if (!id) return String(fallback || '').trim();
        try {
            const getter = window.tmGetDocColorHex;
            if (typeof getter === 'function') {
                const resolved = String(getter(id, { isDark: isDarkThemeMode() }) || '').trim();
                if (resolved) return resolved;
            }
        } catch (e) {}
        return String(fallback || '').trim();
    }

    function getScheduleLinkedDocId(item) {
        return String(
            item?.docId
            || item?.rootId
            || item?.root_id
            || item?.linkedDocId
            || item?.linked_doc_id
            || ''
        ).trim();
    }

    async function loadBlockRootDocIdMap(ids) {
        const uniq = [];
        const seen = new Set();
        for (const rawId of (Array.isArray(ids) ? ids : [])) {
            const id = String(rawId || '').trim();
            if (!id || seen.has(id)) continue;
            seen.add(id);
            uniq.push(id);
        }
        const out = new Map();
        if (uniq.length === 0) return out;
        const chunkSize = 200;
        for (let i = 0; i < uniq.length; i += chunkSize) {
            const chunk = uniq.slice(i, i + chunkSize);
            const inList = chunk.map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
            const sql = `SELECT id, root_id FROM blocks WHERE id IN (${inList}) LIMIT ${Math.max(1, Math.min(5000, chunk.length))}`;
            const res = await postJSON('/api/query/sql', { stmt: sql });
            const json = await res.json().catch(() => ({}));
            const rows = (res.ok && json?.code === 0 && Array.isArray(json?.data)) ? json.data : [];
            for (const row of rows) {
                const id = String(row?.id || '').trim();
                const docId = String(row?.root_id || '').trim();
                if (id && docId && !out.has(id)) out.set(id, docId);
            }
        }
        return out;
    }

    async function buildScheduleLinkedDocIdMap(items) {
        const schedules = Array.isArray(items) ? items : [];
        const cache = state.linkedDocIdCache instanceof Map ? state.linkedDocIdCache : (state.linkedDocIdCache = new Map());
        const out = new Map();
        const needFetch = [];
        const seenNeedFetch = new Set();
        for (const it of schedules) {
            const taskId = String(it?.taskId || it?.task_id || it?.linkedTaskId || it?.linked_task_id || '').trim();
            const blockId = getScheduleLinkedBlockId(it);
            const directDocId = getScheduleLinkedDocId(it);
            const aliasIds = Array.from(new Set([taskId, blockId].filter((v) => !!String(v || '').trim())));
            if (directDocId) {
                for (const aliasId of aliasIds) {
                    cache.set(aliasId, directDocId);
                    out.set(aliasId, directDocId);
                }
                continue;
            }
            for (const aliasId of aliasIds) {
                const cachedDocId = String(cache.get(aliasId) || '').trim();
                if (cachedDocId) {
                    out.set(aliasId, cachedDocId);
                    continue;
                }
                if (!seenNeedFetch.has(aliasId)) {
                    seenNeedFetch.add(aliasId);
                    needFetch.push(aliasId);
                }
            }
        }
        if (needFetch.length > 0) {
            try {
                const fetched = await loadBlockRootDocIdMap(needFetch);
                for (const [id, docId] of fetched.entries()) {
                    const doc = String(docId || '').trim();
                    if (!id || !doc) continue;
                    cache.set(id, doc);
                    out.set(id, doc);
                }
            } catch (e) {}
        }
        return out;
    }

    function shouldOpenTaskDetailOnCalendarTaskClick() {
        const liveStore = state.settingsStore || state.sideDay?.settingsStore || null;
        if (typeof liveStore?.data?.checklistCompactTitleOpenDetailPage === 'boolean') {
            return !!liveStore.data.checklistCompactTitleOpenDetailPage;
        }
        try {
            const raw = localStorage.getItem('tm_checklist_compact_title_open_detail_page');
            if (raw != null) {
                const normalized = String(raw).trim().toLowerCase();
                return normalized === 'true' || normalized === '1';
            }
        } catch (e) {}
        return false;
    }

    function shouldEnableCalendarEventContextMenu() {
        return !(state.isMobileDevice || isLikelyMobileRuntime());
    }

    function shouldSuppressCalendarTaskListContextMenu() {
        return !!(state.isMobileDevice || isLikelyMobileRuntime());
    }

    function setCalendarTouchGestureLock(rootEl, locked) {
        if (!(rootEl instanceof HTMLElement)) return false;
        const next = !!locked && (state.isMobileDevice || isLikelyMobileRuntime());
        try { rootEl.classList.toggle('tm-cal-touch-gesture-lock', next); } catch (e) {}
        return next;
    }

    async function openCalendarLinkedTask(taskId, ev) {
        const tid = String(taskId || '').trim();
        if (!tid) return false;
        if (shouldOpenTaskDetailOnCalendarTaskClick() && typeof window.tmOpenTaskDetail === 'function') {
            try {
                const opened = await window.tmOpenTaskDetail(tid, ev);
                if (opened !== false) return true;
            } catch (e) {}
        }
        if (typeof window.tmJumpToTask === 'function') {
            try {
                await window.tmJumpToTask(tid, ev);
                return true;
            } catch (e) {}
        }
        return false;
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
        const list = [{ id: 'default', name: '未分组', color: 'var(--tm-primary-color)' }];
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

    function getCalendarConfigEntry(calendarId, settings) {
        const id = String(calendarId || '').trim();
        if (!id) return null;
        const cfg = settings?.calendarsConfig || {};
        const entry = cfg?.[id];
        return (entry && typeof entry === 'object' && !Array.isArray(entry)) ? entry : null;
    }

    function isCalendarEnabled(calendarId, settings) {
        const entry = getCalendarConfigEntry(calendarId, settings);
        if (!entry) return true;
        if ('enabled' in entry) return !!entry.enabled;
        return true;
    }

    function isCalendarDocEnabled(calendarId, docId, settings) {
        if (!settings?.scheduleFollowDocColor) return true;
        const cid = String(calendarId || '').trim();
        const did = String(docId || '').trim();
        if (!cid || !did) return true;
        const entry = getCalendarConfigEntry(cid, settings);
        const docsEnabled = (entry?.docsEnabled && typeof entry.docsEnabled === 'object' && !Array.isArray(entry.docsEnabled))
            ? entry.docsEnabled
            : null;
        if (!docsEnabled) return true;
        if (!(did in docsEnabled)) return true;
        return docsEnabled[did] !== false;
    }

    function getCalendarSidebarDocItems(settings) {
        if (!settings?.scheduleFollowDocColor) return null;
        let cached = null;
        try {
            const getter = window.tmCalendarGetSidebarDocItems;
            if (typeof getter === 'function') cached = getter() || null;
        } catch (e) {}
        const cachedKey = String(cached?.key || '').trim();
        try {
            const warmer = window.tmCalendarWarmSidebarDocItems;
            if (typeof warmer === 'function') {
                Promise.resolve()
                    .then(() => warmer())
                    .then((next) => {
                        const nextKey = String(next?.key || '').trim();
                        if (!nextKey || nextKey === cachedKey) return;
                        const root = state.wrapEl;
                        if (!(root instanceof Element)) return;
                        try { renderSidebar(root, getSettings()); } catch (e2) {}
                    })
                    .catch(() => null);
            }
        } catch (e) {}
        return (cached && typeof cached === 'object') ? cached : null;
    }

    function getCalendarDocsToGroupMapSnapshot() {
        const cached = window.__tmCalendarDocsToGroupCache?.map;
        if (cached instanceof Map) return cached;
        try {
            const warmer = window.tmCalendarWarmDocsToGroupCache;
            if (typeof warmer === 'function') {
                Promise.resolve().then(() => warmer()).catch(() => null);
            }
        } catch (e) {}
        const out = new Map();
        const groups = state.settingsStore?.data?.docGroups || state.sideDay?.settingsStore?.data?.docGroups;
        if (Array.isArray(groups)) {
            for (const g of groups) {
                const gid = String(g?.id || '').trim();
                if (!gid) continue;
                const docs = Array.isArray(g?.docs) ? g.docs : [];
                for (const doc of docs) {
                    const did = String((typeof doc === 'object' ? doc?.id : doc) || '').trim();
                    if (!did || out.has(did)) continue;
                    out.set(did, gid);
                }
            }
        }
        return out;
    }

    function resolveDocOwnerCalendarId(docId) {
        const did = String(docId || '').trim();
        if (!did) return 'default';
        const map = getCalendarDocsToGroupMapSnapshot();
        const gid = String(map?.get?.(did) || '').trim();
        return gid ? calendarIdForGroup(gid) : 'default';
    }

    function isCalendarDocVisibleForEvent(calendarId, docId, settings) {
        const did = String(docId || '').trim();
        if (!did) return true;
        const eventCalendarId = String(calendarId || 'default').trim() || 'default';
        if (!isCalendarDocEnabled(eventCalendarId, did, settings)) return false;
        const ownerCalendarId = resolveDocOwnerCalendarId(did);
        if (eventCalendarId === 'default' && ownerCalendarId !== 'default' && !isCalendarDocEnabled(ownerCalendarId, did, settings)) {
            return false;
        }
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
        const taskDatesCanCustomize = !settings.scheduleFollowDocColor && String(settings.taskDateColorMode || 'group').trim() !== 'group';
        const taskDatesDot = taskDatesCanCustomize ? (settings.taskDatesColor || '#6b7280') : '#6b7280';
        const showTomato = !!settings.linkDockTomato;
        const sidebarDocItems = getCalendarSidebarDocItems(settings);
        const showDocRows = !!settings.scheduleFollowDocColor && !!sidebarDocItems?.calendars;

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
                            <span class="tm-calendar-nav-dot" style="background:${esc(settings.scheduleColor || 'var(--tm-primary-color)')};" data-tm-cal-color-kind="schedule" data-tm-cal-color-key="schedule" data-tm-cal-color-value="${esc(settings.scheduleColor || 'var(--tm-primary-color)')}"></span>
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
                    if (showDocRows) {
                        const docs = Array.isArray(sidebarDocItems?.calendars?.[d.id]) ? sidebarDocItems.calendars[d.id] : [];
                        const childDisabled = !showSchedule || !enabled;
                        for (const doc of docs) {
                            const docId = String(doc?.id || '').trim();
                            const docName = String(doc?.name || docId || '未命名文档').trim() || '未命名文档';
                            if (!docId) continue;
                            const docEnabled = isCalendarDocEnabled(d.id, docId, settings);
                            const docColor = resolveCalendarDocColor(docId, d.color || 'var(--tm-primary-color)') || d.color || 'var(--tm-primary-color)';
                            calItems.push(`
                                <div class="tm-calendar-nav-item-row tm-calendar-nav-item--indent tm-calendar-nav-item--indent2 ${childDisabled ? 'tm-calendar-nav-item--disabled' : ''}">
                                    <label class="tm-calendar-nav-item tm-calendar-nav-item--grow ${childDisabled ? 'tm-calendar-nav-item--disabled' : ''}">
                                        <span class="tm-calendar-nav-left">
                                            <span class="tm-calendar-nav-dot" style="background:${esc(docColor)};"></span>
                                            <span class="tm-calendar-nav-label" title="${esc(docName)}">${esc(docName)}</span>
                                        </span>
                                        <input class="tm-calendar-nav-check" type="checkbox" data-tm-cal-calendar-doc="${esc(d.id)}" data-tm-cal-doc-id="${esc(docId)}" ${docEnabled ? 'checked' : ''} ${childDisabled ? 'disabled' : ''}>
                                    </label>
                                </div>
                            `);
                        }
                    }
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
        try { wrap.querySelector('.tm-calendar-nav')?.__tmCalendarNavScrollUpdateThumb?.(); } catch (e) {}
    }

    function bindCalendarNavScrollFx(wrap) {
        const pane = wrap?.querySelector?.('.tm-calendar-nav');
        const track = wrap?.querySelector?.('.tm-calendar-nav-scrollbar');
        const thumb = track?.querySelector?.('.tm-calendar-nav-scrollbar-thumb');
        if (!(pane instanceof HTMLElement) || !(track instanceof HTMLElement) || !(thumb instanceof HTMLElement)) return;
        const updateThumb = () => {
            const viewport = Number(pane.clientHeight || 0);
            const total = Number(pane.scrollHeight || 0);
            const trackHeight = Number(track.clientHeight || 0);
            const canScroll = !!viewport && !!total && total > viewport + 1 && !!trackHeight;
            track.classList.toggle('tm-calendar-nav-scrollbar--enabled', canScroll);
            if (!canScroll) {
                track.classList.remove('tm-calendar-nav-scrollbar--visible');
                thumb.style.height = '0px';
                thumb.style.transform = 'translateY(0)';
                return;
            }
            const ratio = Math.min(1, viewport / total);
            const thumbHeight = Math.max(24, Math.round(trackHeight * ratio));
            const maxTop = Math.max(0, trackHeight - thumbHeight);
            const progress = Math.min(1, Math.max(0, Number(pane.scrollTop || 0) / Math.max(1, total - viewport)));
            const top = Math.round(maxTop * progress);
            thumb.style.height = `${thumbHeight}px`;
            thumb.style.transform = `translateY(${top}px)`;
        };
        pane.__tmCalendarNavScrollUpdateThumb = updateThumb;
        if (pane.__tmCalendarNavScrollFxBound) {
            try { updateThumb(); } catch (e) {}
            return;
        }
        pane.__tmCalendarNavScrollFxBound = true;
        const show = () => {
            updateThumb();
            track.classList.add('tm-calendar-nav-scrollbar--visible');
            try { clearTimeout(pane.__tmCalendarNavScrollFxTimer); } catch (e) {}
            pane.__tmCalendarNavScrollFxTimer = setTimeout(() => {
                try { track.classList.remove('tm-calendar-nav-scrollbar--visible'); } catch (e2) {}
            }, 600);
        };
        pane.addEventListener('scroll', show, { passive: true });
        try {
            const ro = new ResizeObserver(() => updateThumb());
            ro.observe(pane);
            const navWrap = pane.closest('.tm-calendar-nav-wrap');
            if (navWrap instanceof HTMLElement) ro.observe(navWrap);
            pane.querySelectorAll('.tm-calendar-nav-section').forEach((el) => {
                if (el instanceof HTMLElement) ro.observe(el);
            });
            pane.__tmCalendarNavScrollResizeObserver = ro;
        } catch (e) {}
        try {
            const mo = new MutationObserver(() => {
                try { requestAnimationFrame(() => updateThumb()); } catch (e2) { updateThumb(); }
            });
            mo.observe(pane, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
            pane.__tmCalendarNavScrollMutationObserver = mo;
        } catch (e) {}
        try { requestAnimationFrame(() => updateThumb()); } catch (e) {}
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
        let tasks = Array.isArray(res?.items) ? res.items : [];
        if (tasks.length === 0) {
            const fallbackApi = globalThis.tmGetCalendarDragTasks;
            if (typeof fallbackApi === 'function') {
                try {
                    tasks = (fallbackApi(60) || []).map((t) => ({
                        id: t?.id,
                        title: t?.title,
                        spent: t?.spent,
                        durationMin: t?.durationMin,
                        calendarId: t?.calendarId,
                        depth: 0,
                    })).filter((t) => String(t?.id || '').trim());
                } catch (e) {
                    tasks = [];
                }
            }
        }
        if (tasks.length === 0) {
            try { globalThis.tmWarmCalendarTaskCacheIfStale?.({ refresh: true }); } catch (e) {}
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
            const dot = colorMap.get(calendarId) || 'var(--tm-primary-color)';
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

    function formatCalendarTaskDurationLabel(durationMin) {
        const mins = Number(durationMin);
        if (!Number.isFinite(mins) || mins <= 0) return '';
        if (mins < 60) return `${Math.round(mins)} 分钟`;
        const hours = Math.floor(mins / 60);
        const rest = Math.round(mins % 60);
        return rest > 0 ? `${hours} 小时 ${rest} 分` : `${hours} 小时`;
    }

    function renderCompactTaskPageHtml(settings) {
        const queryApi = globalThis.tmQueryCalendarTasks;
        let tasks = [];
        if (typeof queryApi === 'function') {
            try {
                const pageSize = Number.isFinite(Number(state.taskPageSize))
                    ? Math.max(60, Math.min(500, Math.floor(Number(state.taskPageSize))))
                    : 200;
                const page = Number.isFinite(Number(state.taskPage))
                    ? Math.max(1, Math.floor(Number(state.taskPage)))
                    : 1;
                const query = String(state.taskQuery || '').trim();
                const res = queryApi({ pageSize, page, query }) || null;
                tasks = Array.isArray(res?.items) ? res.items : [];
            } catch (e) {
                tasks = [];
            }
        }
        if (tasks.length === 0) {
            const fallbackApi = globalThis.tmGetCalendarDragTasks;
            if (typeof fallbackApi === 'function') {
                try {
                    tasks = (fallbackApi(200) || []).map((t) => ({
                        id: t?.id,
                        title: t?.title,
                        spent: t?.spent,
                        durationMin: t?.durationMin,
                        calendarId: t?.calendarId,
                        depth: 0,
                    })).filter((t) => String(t?.id || '').trim());
                } catch (e) {
                    tasks = [];
                }
            }
        }
        if (tasks.length === 0) {
            try { globalThis.tmWarmCalendarTaskCacheIfStale?.({ refresh: true }); } catch (e) {}
            return `<div class="tm-calendar-task-empty">暂无任务</div>`;
        }
        const defs = getCalendarDefs(settings);
        const colorMap = new Map(defs.map((d) => [d.id, d.color]));
        const itemsHtml = tasks.map((t) => {
            const id = String(t?.id || '').trim();
            if (!id) return '';
            const title = String(t?.title || '').trim() || '(无标题)';
            const spent = String(t?.spent || '').trim();
            const durationMin = Number(t?.durationMin);
            const depth = Math.max(0, Number(t?.depth) || 0);
            const calendarId = String(t?.calendarId || 'default').trim() || 'default';
            const accent = colorMap.get(calendarId) || 'var(--tm-primary-color)';
            const safeDuration = (Number.isFinite(durationMin) && durationMin > 0) ? Math.round(durationMin) : 60;
            const durationLabel = formatCalendarTaskDurationLabel(safeDuration);
            const metaParts = [];
            if (durationLabel) metaParts.push(`<span class="tm-checklist-meta-compact-time" title="预计时长">${esc(durationLabel)}</span>`);
            if (spent) metaParts.push(`<span class="tm-checklist-meta-compact-time" title="已耗时">${esc(spent)}</span>`);
            const tooltipAttrs = ` data-tm-floating-tooltip-label="${esc(title)}" data-tm-tooltip-side="bottom" data-tm-tooltip-align="center"`;
            return `
                <div class="tm-cal-task tm-cal-task--checklist tm-checklist-item" draggable="true" ondragstart="tmDragTaskStart(event, '${esc(id)}')" ondragend="tmDragTaskEnd(event)" data-id="${esc(id)}" data-task-id="${esc(id)}" data-task-title="${esc(title)}" data-task-spent="${esc(spent)}" data-task-duration-min="${esc(String(safeDuration))}" data-calendar-id="${esc(calendarId)}" style="--tm-checklist-accent-color:${esc(accent)};--tm-checklist-compact-indent:${Math.min(8, depth) * 14}px;">
                    <div class="tm-checklist-leading">
                        <span class="tm-tree-toggle tm-tree-toggle--placeholder" aria-hidden="true"></span>
                        <input class="tm-task-checkbox tm-cal-task-check" type="checkbox" title="完成">
                    </div>
                    <div class="tm-checklist-item-main">
                        <div class="tm-checklist-title-row">
                            <div class="tm-checklist-title-main">
                                <div class="tm-checklist-title">
                                    <span class="tm-checklist-title-button">
                                        <span class="tm-task-content-clickable" title="${esc(title)}"${tooltipAttrs}>${esc(title)}</span>
                                    </span>
                                </div>
                            </div>
                            ${metaParts.length ? `<div class="tm-checklist-meta-compact">${metaParts.join('')}</div>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        return `<div class="tm-checklist-items">${itemsHtml}</div>`;
    }

    function destroyTaskDraggable() {
        const current = state.taskDraggable;
        if (Array.isArray(current)) {
            current.forEach((instance) => {
                try { instance?.destroy?.(); } catch (e) {}
            });
        } else {
            try {
                if (current && typeof current.destroy === 'function') current.destroy();
            } catch (e) {}
        }
        state.taskDraggable = null;
    }

    function bindTaskDraggable(wrap, settings) {
        destroyTaskDraggable();
        const Draggable = globalThis.FullCalendar?.Draggable;
        if (typeof Draggable !== 'function') return;
        const root = (wrap instanceof Element) ? wrap : (state.wrapEl instanceof Element ? state.wrapEl : null);
        if (!(root instanceof Element)) return;
        const hosts = [];
        const panelHost = root.querySelector('[data-tm-cal-role="task-list"]');
        const compactPageHost = root.querySelector('[data-tm-cal-role="task-page-list"]');
        const tableHost = root.querySelector('[data-tm-cal-role="task-table"] #tmTaskTable tbody');
        if (panelHost instanceof Element) hosts.push({ el: panelHost, kind: 'list' });
        if (compactPageHost instanceof Element && compactPageHost !== panelHost) hosts.push({ el: compactPageHost, kind: 'list' });
        if (tableHost instanceof Element && tableHost !== panelHost && tableHost !== compactPageHost) hosts.push({ el: tableHost, kind: 'table' });
        state.taskListEl = hosts[0]?.el || null;
        if (!hosts.length) return;
        const draggables = [];
        hosts.forEach(({ el: host, kind }) => {
            const isTableBody = String(host?.tagName || '').toUpperCase() === 'TBODY';
            try {
                const instance = new Draggable(host, {
                    itemSelector: (kind === 'table' || isTableBody) ? 'tr[data-id]' : '.tm-cal-task, .tm-checklist-item[data-id]',
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
                            taskId = String(el?.getAttribute?.('data-task-id') || el?.getAttribute?.('data-id') || '').trim();
                            title = String(el?.getAttribute?.('data-task-title') || '').trim();
                            calendarId = String(el?.getAttribute?.('data-calendar-id') || '').trim();
                            durMin = Number(el?.getAttribute?.('data-task-duration-min'));
                            if (taskId && (!title || !calendarId || !Number.isFinite(durMin))) {
                                try {
                                    const meta = (typeof window.tmCalendarGetTaskDragMeta === 'function') ? window.tmCalendarGetTaskDragMeta(taskId) : null;
                                    if (!title) title = String(meta?.title || '').trim();
                                    if (!calendarId) calendarId = String(meta?.calendarId || '').trim();
                                    if (!Number.isFinite(durMin)) durMin = Number(meta?.durationMin);
                                } catch (e) {}
                            }
                            if (!title) {
                                try { title = String(el?.querySelector?.('.tm-task-content-clickable')?.textContent || '').trim(); } catch (e) {}
                            }
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
                draggables.push(instance);
            } catch (e) {}
        });
        state.taskDraggable = draggables.length ? draggables : null;
    }

    function renderTaskPage(wrap, settings) {
        const root = wrap?.querySelector?.('[data-tm-cal-role="task-page"]');
        const host = wrap?.querySelector?.('[data-tm-cal-role="task-page-list"]');
        if (!root || !host) return;
        const savedChecklistPane = host.querySelector('.tm-checklist-scroll');
        const savedTop = Number((savedChecklistPane instanceof HTMLElement ? savedChecklistPane.scrollTop : host.scrollTop) || 0);
        const savedLeft = Number((savedChecklistPane instanceof HTMLElement ? savedChecklistPane.scrollLeft : host.scrollLeft) || 0);
        let html = '';
        let usesChecklistView = false;
        if (typeof window.tmRenderCalendarSidebarChecklistHtml === 'function') {
            try {
                html = String(window.tmRenderCalendarSidebarChecklistHtml() || '');
                usesChecklistView = !!html;
            } catch (e) {
                html = '';
                usesChecklistView = false;
            }
        }
        if (!html) {
            try { html = String(renderCompactTaskPageHtml(settings) || ''); } catch (e) { html = ''; }
        }
        const nextHtml = html || `<div class="tm-calendar-task-empty">暂无任务</div>`;
        const canReuseDom = state.taskPageHost === host && String(state.taskPageHtml || '') === nextHtml;
        if (!canReuseDom) {
            host.innerHTML = nextHtml;
            state.taskPageHtml = nextHtml;
        }
        try { host.classList.toggle('tm-calendar-task-page-list--checklist', usesChecklistView); } catch (e) {}
        try { window.tmBindFloatingTooltipsForTaskModal?.(host); } catch (e) {}
        state.taskPageHost = host;
        try {
            const nextChecklistPane = host.querySelector('.tm-checklist-scroll');
            if (nextChecklistPane instanceof HTMLElement) {
                nextChecklistPane.scrollTop = savedTop;
                nextChecklistPane.scrollLeft = savedLeft;
            } else {
                host.scrollTop = savedTop;
                host.scrollLeft = savedLeft;
            }
        } catch (e) {}
        state.taskListEl = host;
        try { state.taskTableAbort?.abort?.(); } catch (e) {}
        try {
            const abort = new AbortController();
            state.taskTableAbort = abort;
            bindSidebarAutoHideOnTaskDrag(host, abort.signal);
            if (getRuntimeClientKindHint() === 'mobile-browser') {
                host.addEventListener('contextmenu', (e) => {
                    try { e.preventDefault(); } catch (e2) {}
                    try { e.stopPropagation(); } catch (e2) {}
                }, { signal: abort.signal, capture: true });
            }
        } catch (e) {
            state.taskTableAbort = null;
        }
        if (usesChecklistView) {
            try { window.tmAfterRenderCalendarSidebarChecklist?.(); } catch (e) {}
            bindTaskDraggable(wrap, settings);
            Promise.resolve().then(() => markTodayScheduledTaskRows(host)).catch(() => null);
            if (canReuseDom) return;
            return;
        }
        try {
            const abort = state.taskTableAbort;
            if (!abort) return;

            const getTaskIdFromEvent = (ev) => {
                const target = ev?.target;
                if (!(target instanceof Element)) return '';
                const row = target.closest('.tm-cal-task[data-task-id], tr[data-id]');
                return String(row?.getAttribute?.('data-task-id') || row?.getAttribute?.('data-id') || '').trim();
            };

            const getTaskRowFromEvent = (ev) => {
                const target = ev?.target;
                if (!(target instanceof Element)) return null;
                return target.closest('.tm-cal-task[data-task-id], tr[data-id]');
            };

            const syncDoneVisualState = (row, done) => {
                if (!(row instanceof HTMLElement)) return;
                try { row.classList.toggle('tm-cal-task--done', !!done); } catch (e) {}
                try { row.classList.toggle('tm-checklist-item--done', !!done); } catch (e) {}
                const titleEl = row.querySelector('.tm-task-content-clickable');
                if (titleEl instanceof HTMLElement) {
                    try { titleEl.classList.toggle('tm-cal-task-title--done', !!done); } catch (e) {}
                }
            };

            host.addEventListener('change', (e) => {
                const el = e.target;
                if (!(el instanceof HTMLInputElement)) return;
                if (String(el.type || '').toLowerCase() !== 'checkbox') return;
                if (!el.classList.contains('tm-task-checkbox') && !el.classList.contains('tm-cal-task-check')) return;
                const taskId = getTaskIdFromEvent(e);
                if (!taskId) return;
                syncDoneVisualState(getTaskRowFromEvent(e), !!el.checked);
                if (typeof window.tmSetDone === 'function') {
                    try { window.tmSetDone(taskId, !!el.checked, e, { source: 'calendar' }); } catch (e2) {}
                }
            }, { signal: abort.signal, capture: true });

            host.addEventListener('click', (e) => {
                const target = e.target;
                if (!(target instanceof Element)) return;
                if (target.closest('.tm-cal-task-check, .tm-task-checkbox')) {
                    return;
                }
                const taskId = getTaskIdFromEvent(e);
                if (!taskId) return;
                if (target.closest('.tm-task-content-clickable, .tm-cal-task-title--checklist')) {
                    try { openCalendarLinkedTask(taskId, e); } catch (e2) {}
                    return;
                }
                if (getTaskRowFromEvent(e) && typeof window.tmRowClick === 'function') {
                    try { window.tmRowClick(e, taskId); } catch (e2) {}
                }
            }, { signal: abort.signal });

            host.addEventListener('contextmenu', (e) => {
                const target = e.target;
                if (!(target instanceof Element)) return;
                const row = getTaskRowFromEvent(e);
                if (!row) return;
                if (shouldSuppressCalendarTaskListContextMenu()) {
                    try { e.preventDefault(); } catch (e2) {}
                    try { e.stopPropagation(); } catch (e2) {}
                    return;
                }
                const taskId = String(row.getAttribute('data-task-id') || row.getAttribute('data-id') || '').trim();
                if (!taskId) return;
                if (typeof window.tmShowTaskContextMenu === 'function') {
                    try { window.tmShowTaskContextMenu(e, taskId); } catch (e2) {}
                }
            }, { signal: abort.signal });
        } catch (e) {}
        try { globalThis.tmCalendarApplyCollapseDom?.(); } catch (e) {}
        bindTaskDraggable(wrap, settings);
        Promise.resolve().then(() => markTodayScheduledTaskRows(host)).catch(() => null);
    }

    function scheduleTaskPageRender(wrap, settings) {
        state.taskPageRenderWrap = wrap || state.wrapEl || null;
        state.taskPageRenderSettings = settings || state.taskPageRenderSettings || null;
        try { __tmPushCalendarRefreshTrace('calendar-task-page-render-queued', { hasWrap: !!state.taskPageRenderWrap }); } catch (e) {}
        if (state.taskPageRenderRaf) return false;
        try {
            state.taskPageRenderRaf = requestAnimationFrame(() => {
                state.taskPageRenderRaf = null;
                const nextWrap = state.taskPageRenderWrap;
                const nextSettings = state.taskPageRenderSettings;
                state.taskPageRenderWrap = null;
                state.taskPageRenderSettings = null;
                if (!nextWrap) return;
                try { __tmPushCalendarRefreshTrace('calendar-task-page-render-perform', { hasWrap: !!nextWrap }); } catch (e) {}
                try { renderTaskPanel(nextWrap, nextSettings || getSettings()); } catch (e) {}
                try { renderTaskPage(nextWrap, nextSettings || getSettings()); } catch (e) {}
            });
            return true;
        } catch (e) {
            state.taskPageRenderRaf = null;
            try { renderTaskPanel(state.taskPageRenderWrap, state.taskPageRenderSettings || getSettings()); } catch (e2) {}
            try { renderTaskPage(state.taskPageRenderWrap, state.taskPageRenderSettings || getSettings()); } catch (e2) {}
            state.taskPageRenderWrap = null;
            state.taskPageRenderSettings = null;
            return false;
        }
    }

    function scheduleMainCalendarLayoutRefresh(wrap, host, calendar, options = {}) {
        const targetWrap = wrap || state.wrapEl || null;
        const targetHost = (host instanceof Element) ? host : (state.calendarEl instanceof Element ? state.calendarEl : null);
        const targetCalendar = calendar || state.calendar || null;
        if (!(targetWrap instanceof Element) || !targetCalendar) return false;
        state.mainLayoutWrap = targetWrap;
        state.mainLayoutHost = targetHost;
        state.mainLayoutCalendar = targetCalendar;
        state.mainLayoutNeedsUpdateSize = state.mainLayoutNeedsUpdateSize || options.updateSize === true;
        if (state.mainLayoutRaf) return true;
        try {
            state.mainLayoutRaf = requestAnimationFrame(() => {
                const nextWrap = state.mainLayoutWrap;
                const nextHost = state.mainLayoutHost;
                const nextCalendar = state.mainLayoutCalendar;
                const needUpdateSize = !!state.mainLayoutNeedsUpdateSize;
                state.mainLayoutRaf = null;
                state.mainLayoutNeedsUpdateSize = false;
                if (!(nextWrap instanceof Element) || !nextCalendar) return;
                try { syncMainCalendarMonthViewLayout(nextWrap, nextHost, nextCalendar, getSettings()); } catch (e) {}
                try { syncMainCalendarToolbarTitle(nextWrap, nextCalendar); } catch (e) {}
                try { applyMainCalendarMonthCellMinHeightLayout(nextHost, nextCalendar); } catch (e) {}
                try { applyMainCalendarMonthMoreLinkLayout(nextHost, nextCalendar); } catch (e) {}
                try { applyTimeGridAllDayMoreLinkLayout(nextHost, nextCalendar); } catch (e) {}
                try { applyMainCalendarSlotHeightLayout(nextWrap, getSettings()); } catch (e) {}
                try { if (nextHost instanceof Element) applyTimeAxisColumnLayout(nextHost, 40); } catch (e) {}
                if (needUpdateSize) {
                    try { nextCalendar.updateSize(); } catch (e) {}
                }
                try { applyMainCalendarMonthMoreLinkLayout(nextHost, nextCalendar); } catch (e) {}
                try { applyTimeGridAllDayMoreLinkLayout(nextHost, nextCalendar); } catch (e) {}
                try { scheduleSyncTimeGridAllDayCollapseUi(nextHost || state.calendarEl, nextCalendar); } catch (e) {}
                try { if (nextHost instanceof Element) enhanceNowIndicator(nextHost); } catch (e) {}
                try { if (nextHost instanceof HTMLElement) scheduleCurrentTimeAutoCenter(nextHost, nextCalendar, getSettings(), { scope: 'main' }); } catch (e) {}
                try { applyCnHolidayDots(nextWrap); } catch (e) {}
                try { applyCnLunarLabels(nextWrap); } catch (e) {}
            });
            return true;
        } catch (e) {
            state.mainLayoutRaf = null;
            state.mainLayoutNeedsUpdateSize = false;
            try { syncMainCalendarMonthViewLayout(targetWrap, targetHost, targetCalendar, getSettings()); } catch (e2) {}
            try { syncMainCalendarToolbarTitle(targetWrap, targetCalendar); } catch (e2) {}
            try { applyMainCalendarMonthCellMinHeightLayout(targetHost, targetCalendar); } catch (e2) {}
            try { applyMainCalendarMonthMoreLinkLayout(targetHost, targetCalendar); } catch (e2) {}
            try { applyTimeGridAllDayMoreLinkLayout(targetHost, targetCalendar); } catch (e2) {}
            try { applyMainCalendarSlotHeightLayout(targetWrap, getSettings()); } catch (e2) {}
            try { if (targetHost instanceof Element) applyTimeAxisColumnLayout(targetHost, 40); } catch (e2) {}
            try { if (options.updateSize === true) targetCalendar.updateSize(); } catch (e2) {}
            try { applyMainCalendarMonthMoreLinkLayout(targetHost, targetCalendar); } catch (e2) {}
            try { applyTimeGridAllDayMoreLinkLayout(targetHost, targetCalendar); } catch (e2) {}
            try { scheduleSyncTimeGridAllDayCollapseUi(targetHost || state.calendarEl, targetCalendar); } catch (e2) {}
            try { if (targetHost instanceof Element) enhanceNowIndicator(targetHost); } catch (e2) {}
            try { if (targetHost instanceof HTMLElement) scheduleCurrentTimeAutoCenter(targetHost, targetCalendar, getSettings(), { scope: 'main' }); } catch (e2) {}
            try { applyCnHolidayDots(targetWrap); } catch (e2) {}
            try { applyCnLunarLabels(targetWrap); } catch (e2) {}
            return false;
        }
    }

    async function markTodayScheduledTaskRows(host) {
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const list = await loadScheduleForRange(dayStart, dayEnd);
        const todayTaskIds = new Set(
            (Array.isArray(list) ? list : [])
                .map((x) => String(x?.taskId || '').trim())
                .filter(Boolean)
        );
        host?.querySelectorAll?.('tr[data-id], .tm-cal-task[data-task-id], .tm-checklist-item[data-id]')?.forEach?.((row) => {
            const tid = String(row?.getAttribute?.('data-task-id') || row?.getAttribute?.('data-id') || '').trim();
            const marked = !!(tid && todayTaskIds.has(tid));
            const textEl = row.querySelector('.tm-task-content-clickable, .tm-task-text, .tm-cal-task-title--checklist, .tm-checklist-title-button > span');
            if (textEl instanceof HTMLElement) {
                if (marked) textEl.style.color = 'var(--tm-primary-color)';
                else textEl.style.removeProperty('color');
            }
            if (row instanceof HTMLElement) {
                try { row.classList.toggle('tm-cal-task--today', marked); } catch (e) {}
            }
        });
    }

    function setSidePage(wrap, next) {
        const v = (next === 'tasks') ? 'tasks' : 'calendar';
        state.sidePage = v;
        try {
            wrap.classList.toggle('tm-calendar-wrap--tasks-page', v === 'tasks');
            const inner = wrap.querySelector('.tm-calendar-sidebar-inner');
            if (inner) inner.style.gap = (v === 'tasks') ? '8px' : '10px';
            wrap.querySelectorAll('[data-tm-cal-side-page]').forEach((el) => {
                const key = String(el.getAttribute('data-tm-cal-side-page') || '');
                el.style.display = (key === v) ? '' : 'none';
            });
            wrap.querySelectorAll('[data-tm-cal-side-tab]').forEach((el) => {
                const key = String(el.getAttribute('data-tm-cal-side-tab') || '');
                el.classList.toggle('tm-calendar-side-tab--active', key === v);
            });
            wrap.querySelector('.tm-calendar-nav')?.__tmCalendarNavScrollUpdateThumb?.();
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

    function shouldAutoHideSidebarOnTaskDrag() {
        return !!(state.isMobileDevice || state.isDockHost === true);
    }

    function clearSidebarDragCloseTimer() {
        if (!state.mobileDragCloseTimer) return;
        try { clearTimeout(state.mobileDragCloseTimer); } catch (e) {}
        state.mobileDragCloseTimer = null;
    }

    function closeSidebarForTaskDrag() {
        clearSidebarDragCloseTimer();
        try {
            const wrapEl = state.wrapEl;
            if (wrapEl) setCalendarSidebarOpen(wrapEl, false);
        } catch (e) {}
    }

    function bindSidebarAutoHideOnTaskDrag(host, signal) {
        if (!(host instanceof HTMLElement)) return;
        if (!shouldAutoHideSidebarOnTaskDrag()) return;
        const resolveDragTarget = (target) => {
            if (!(target instanceof Element)) return null;
            return target.closest('tr[data-id], .tm-cal-task, .tm-checklist-item[data-id]');
        };
        let touchSession = null;
        const clearTouchSession = () => {
            touchSession = null;
            clearSidebarDragCloseTimer();
        };
        if (state.isMobileDevice) {
            host.addEventListener('touchstart', (ev) => {
                const dragTarget = resolveDragTarget(ev?.target);
                if (!dragTarget) {
                    clearTouchSession();
                    return;
                }
                const touch = ev?.touches?.[0] || ev?.changedTouches?.[0] || null;
                touchSession = {
                    startX: Number(touch?.clientX),
                    startY: Number(touch?.clientY),
                    sidebarClosed: false,
                };
                clearSidebarDragCloseTimer();
                state.mobileDragCloseTimer = setTimeout(() => {
                    state.mobileDragCloseTimer = null;
                    if (!touchSession || touchSession.sidebarClosed) return;
                    touchSession.sidebarClosed = true;
                    closeSidebarForTaskDrag();
                }, 180);
            }, { passive: true, signal });
            host.addEventListener('touchmove', (ev) => {
                if (!touchSession) return;
                const touch = ev?.touches?.[0] || ev?.changedTouches?.[0] || null;
                const x = Number(touch?.clientX);
                const y = Number(touch?.clientY);
                if (!Number.isFinite(x) || !Number.isFinite(y)) return;
                const startX = Number(touchSession.startX);
                const startY = Number(touchSession.startY);
                const dx = x - (Number.isFinite(startX) ? startX : x);
                const dy = y - (Number.isFinite(startY) ? startY : y);
                const absX = Math.abs(dx);
                const absY = Math.abs(dy);
                if (!touchSession.sidebarClosed && absX >= 16 && absX >= absY) {
                    touchSession.sidebarClosed = true;
                    closeSidebarForTaskDrag();
                    return;
                }
                if (absY >= 14 && absY > absX * 1.2) {
                    clearTouchSession();
                }
            }, { passive: true, signal });
            host.addEventListener('touchend', clearTouchSession, { passive: true, signal });
            host.addEventListener('touchcancel', clearTouchSession, { passive: true, signal });
        }
        host.addEventListener('dragstart', (ev) => {
            const dragTarget = resolveDragTarget(ev?.target);
            if (!dragTarget) return;
            if (touchSession) touchSession.sidebarClosed = true;
            closeSidebarForTaskDrag();
        }, { signal });
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

    function formatMiniCalendarTargetLabel(dateKey) {
        const key = String(dateKey || '').trim();
        if (!key) return '';
        const d = parseDateOnly(key);
        if (!(d instanceof Date) || Number.isNaN(d.getTime())) return key;
        const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${weekDays[d.getDay()] || ''}`.trim();
    }

    function buildMiniCalendarModel(opts) {
        const options = (opts && typeof opts === 'object') ? opts : {};
        const firstDay = Number(options.firstDay) === 0 ? 0 : 1;
        const monthKeyRaw = String(options.monthKey || '').trim();
        const selectedKey = String(options.selectedDateKey || '').trim();
        const sourceKey = String(options.sourceDateKey || '').trim();
        const hoverKey = String(options.hoverDateKey || '').trim();
        const fallbackDate = parseDateOnly(selectedKey || sourceKey || hoverKey) || new Date();
        const monthKey = monthKeyRaw || miniMonthKeyFromDate(fallbackDate);
        const title = miniMonthTitleFromKey(monthKey) || '';

        const monthMatch = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
        const y = monthMatch ? Number(monthMatch[1]) : NaN;
        const m = monthMatch ? Number(monthMatch[2]) : NaN;
        if (!Number.isFinite(y) || !Number.isFinite(m)) {
            return { monthKey, title, dows: [], cells: [] };
        }

        const first = new Date(y, m - 1, 1, 12, 0, 0);
        const firstDow = (first.getDay() - firstDay + 7) % 7;
        const daysInMonth = new Date(y, m, 0, 12, 0, 0).getDate();
        const visibleCellCount = Math.max(35, Math.ceil((firstDow + daysInMonth) / 7) * 7);
        const start = new Date(first.getTime());
        start.setDate(first.getDate() - firstDow);
        const todayKey = formatDateKey(new Date());
        const dows = firstDay === 0
            ? ['日', '一', '二', '三', '四', '五', '六']
            : ['一', '二', '三', '四', '五', '六', '日'];
        const cells = [];

        for (let i = 0; i < visibleCellCount; i += 1) {
            const d = new Date(start.getTime());
            d.setDate(start.getDate() + i);
            const key = formatDateKey(d);
            const other = d.getMonth() !== (m - 1);
            cells.push({
                key,
                day: d.getDate(),
                other,
                isToday: key === todayKey,
                isSelected: !!key && key === selectedKey,
                isHover: !!key && key === hoverKey,
                isSource: !!key && key === sourceKey,
            });
        }

        return { monthKey, title, dows, cells, weekRows: visibleCellCount / 7 };
    }

    function buildMiniCalendarHtml(model, opts) {
        const options = (opts && typeof opts === 'object') ? opts : {};
        const kind = String(options.kind || '').trim();
        const showTargetLabel = !!options.showTargetLabel;
        const hoverKey = String(options.hoverDateKey || '').trim();
        const selectedKey = String(options.selectedDateKey || '').trim();
        const targetLabel = String(
            options.targetLabel
            || formatMiniCalendarTargetLabel(hoverKey || selectedKey)
            || ''
        ).trim();
        const hintText = String(options.hintText || '').trim();
        const rootClass = [
            'tm-mini-cal',
            kind ? `tm-mini-cal--${kind}` : '',
        ].filter(Boolean).join(' ');
        const cellsHtml = (Array.isArray(model?.cells) ? model.cells : []).map((cell) => {
            const cls = [
                'tm-mini-cal-day',
                cell?.other ? 'tm-mini-cal-day--other' : '',
                cell?.isToday ? 'tm-mini-cal-day--today' : '',
                cell?.isSelected ? 'tm-mini-cal-day--active' : '',
                cell?.isSource ? 'tm-mini-cal-day--source' : '',
                cell?.isHover ? 'tm-mini-cal-day--drop-target' : '',
            ].filter(Boolean).join(' ');
            return `<button class="${cls}" type="button" data-tm-mini-date="${esc(String(cell?.key || ''))}" data-tm-mini-other="${cell?.other ? '1' : '0'}">${Number(cell?.day) || ''}</button>`;
        }).join('');
        return `
            <div class="${rootClass}" data-tm-mini-root="1" data-tm-mini-kind="${esc(kind || 'default')}">
                <div class="tm-mini-cal-header">
                    <button class="tm-mini-cal-btn" type="button" data-tm-mini-action="prev">‹</button>
                    <div class="tm-mini-cal-title">${esc(String(model?.title || ''))}</div>
                    <button class="tm-mini-cal-btn" type="button" data-tm-mini-action="next">›</button>
                </div>
                ${showTargetLabel ? `<div class="tm-mini-cal-target${targetLabel ? ' is-active' : ''}" data-tm-mini-target>${esc(targetLabel || '拖到日期上修改完成日期')}</div>` : ''}
                <div class="tm-mini-cal-grid">
                    ${(Array.isArray(model?.dows) ? model.dows : []).map((t) => `<div class="tm-mini-cal-dow">${esc(String(t || ''))}</div>`).join('')}
                    ${cellsHtml}
                </div>
                ${hintText ? `<div class="tm-mini-cal-hint">${esc(hintText)}</div>` : ''}
            </div>
        `;
    }

    function syncMiniCalendarInteractiveState(host, opts) {
        const container = host instanceof Element ? host : null;
        if (!container) return;
        const options = (opts && typeof opts === 'object') ? opts : {};
        const selectedKey = String(options.selectedDateKey || '').trim();
        const sourceKey = String(options.sourceDateKey || '').trim();
        const hoverKey = String(options.hoverDateKey || '').trim();
        const targetLabel = String(
            options.targetLabel
            || formatMiniCalendarTargetLabel(hoverKey || selectedKey)
            || ''
        ).trim();
        container.querySelectorAll('[data-tm-mini-date]').forEach((el) => {
            if (!(el instanceof HTMLElement)) return;
            const key = String(el.getAttribute('data-tm-mini-date') || '').trim();
            try { el.classList.toggle('tm-mini-cal-day--active', !!key && key === selectedKey); } catch (e) {}
            try { el.classList.toggle('tm-mini-cal-day--source', !!key && key === sourceKey); } catch (e) {}
            try { el.classList.toggle('tm-mini-cal-day--drop-target', !!key && key === hoverKey); } catch (e) {}
        });
        const targetEl = container.querySelector('[data-tm-mini-target]');
        if (targetEl instanceof HTMLElement) {
            try { targetEl.textContent = targetLabel || '拖到日期上修改完成日期'; } catch (e) {}
            try { targetEl.classList.toggle('is-active', !!targetLabel); } catch (e) {}
        }
    }

    function renderMiniCalendarHost(host, opts) {
        const container = host instanceof Element ? host : null;
        if (!container) return null;
        const model = buildMiniCalendarModel(opts);
        container.innerHTML = buildMiniCalendarHtml(model, opts);
        syncMiniCalendarInteractiveState(container, opts);
        return model;
    }

    function renderMiniCalendar(wrap) {
        const mini = wrap?.querySelector?.('.tm-calendar-mini');
        const calendar = state.calendar;
        if (!mini || !(mini instanceof Element) || !calendar) return;
        const firstDay = Number(getSettings().firstDay) === 0 ? 0 : 1;

        const selected = calendar?.getDate?.() instanceof Date ? calendar.getDate() : null;
        const selectedKey = selected ? formatDateKey(selected) : '';

        if (!state.miniMonthKey) state.miniMonthKey = miniMonthKeyFromDate(selected || new Date());
        renderMiniCalendarHost(mini, {
            kind: 'sidebar',
            monthKey: state.miniMonthKey,
            selectedDateKey: selectedKey,
            firstDay,
        });

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
                calendar.gotoDate(resolveMainCalendarAnchorDate(d, curView, getSettings()) || d);
                if (curView === 'dayGridMonth') calendar.changeView('timeGridDay', d);
            } catch (e2) {}
            renderMiniCalendar(wrap);
        }, { signal: abort.signal });
    }

    const FLOATING_MINI_PRIORITY_OPTIONS = Object.freeze([
        { key: 'high', label: '高' },
        { key: 'medium', label: '中' },
        { key: 'low', label: '低' },
        { key: 'none', label: '无' },
    ]);

    function normalizeFloatingMiniPriorityKey(value) {
        const raw = String(value || '').trim().toLowerCase();
        if (raw === 'a' || raw === 'high' || raw === '高') return 'high';
        if (raw === 'b' || raw === 'medium' || raw === '中') return 'medium';
        if (raw === 'c' || raw === 'low' || raw === '低') return 'low';
        return 'none';
    }

    function normalizeFloatingMiniPriorityIconStyle(value) {
        return String(value || '').trim().toLowerCase() === 'flag' ? 'flag' : 'jira';
    }

    function getFloatingMiniPriorityLabel(priorityKey) {
        const key = normalizeFloatingMiniPriorityKey(priorityKey);
        if (key === 'high') return '高';
        if (key === 'medium') return '中';
        if (key === 'low') return '低';
        return '无';
    }

    function renderFloatingMiniPriorityIcon(priorityKey) {
        const key = normalizeFloatingMiniPriorityKey(priorityKey);
        const iconStyle = normalizeFloatingMiniPriorityIconStyle(getSettings()?.priorityIconStyle);
        if (iconStyle === 'flag') {
            return '<svg viewBox="0 0 256 256" aria-hidden="true"><path fill="currentColor" stroke="none" d="M40.14,46.88A12,12,0,0,0,36,56V224a12,12,0,0,0,24,0V181.72c22.84-17.12,42.1-9.12,70.68,5,16.23,8,34.74,17.2,54.8,17.2,14.72,0,30.28-4.94,46.38-18.88A12,12,0,0,0,236,176V56a12,12,0,0,0-19.86-9.07c-24.71,21.41-44.53,13.31-74.82-1.68C113.19,31.27,78.17,13.94,40.14,46.88ZM212,170.26c-22.84,17.13-42.1,9.11-70.68-5C118.16,153.76,90.33,140,60,153.87V61.69c22.84-17.12,42.1-9.12,70.68,5,16.23,8,34.74,17.2,54.8,17.2A63,63,0,0,0,212,78.08Z"></path></svg>';
        }
        if (key === 'high') {
            return '<svg viewBox="0 0 18 18" aria-hidden="true"><polyline points="2.5,10.1 9,6.1 15.5,10.1" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        }
        if (key === 'medium') {
            return '<svg viewBox="0 0 18 18" aria-hidden="true"><line x1="2.5" y1="5.6" x2="15.5" y2="5.6" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><line x1="2.5" y1="10.6" x2="15.5" y2="10.6" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>';
        }
        if (key === 'low') {
            return '<svg viewBox="0 0 18 18" aria-hidden="true"><polyline points="2.5,7.1 9,11.1 15.5,7.1" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        }
        return '<svg viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="5.2" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>';
    }

    function clearFloatingMiniPriorityTooltipTimer() {
        if (state.floatingMini.priorityTooltipHideTimer) {
            try { clearTimeout(state.floatingMini.priorityTooltipHideTimer); } catch (e) {}
            state.floatingMini.priorityTooltipHideTimer = null;
        }
    }

    function removeFloatingMiniPriorityTooltip() {
        clearFloatingMiniPriorityTooltipTimer();
        const tooltipEl = state.floatingMini.priorityTooltipEl;
        if (tooltipEl instanceof HTMLElement) {
            try { tooltipEl.remove(); } catch (e) {}
        }
        state.floatingMini.priorityTooltipEl = null;
    }

    function ensureFloatingMiniPriorityTooltip() {
        let tooltipEl = state.floatingMini.priorityTooltipEl;
        if (tooltipEl instanceof HTMLElement) return tooltipEl;
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'tm-floating-mini-cal__tooltip';
        document.body.appendChild(tooltipEl);
        state.floatingMini.priorityTooltipEl = tooltipEl;
        return tooltipEl;
    }

    function positionFloatingMiniPriorityTooltip(priorityKey, targetEl) {
        const tooltipEl = state.floatingMini.priorityTooltipEl;
        const panel = state.floatingMini.panelEl;
        const key = normalizeFloatingMiniPriorityKey(priorityKey);
        const button = targetEl instanceof HTMLElement
            ? targetEl
            : panel?.querySelector?.(`[data-tm-mini-priority="${key}"]`);
        if (!(button instanceof HTMLElement) || !(tooltipEl instanceof HTMLElement)) return false;
        const margin = 8;
        const gap = 8;
        const rect = button.getBoundingClientRect();
        const tipRect = tooltipEl.getBoundingClientRect();
        let left = rect.left + ((rect.width - tipRect.width) / 2);
        let top = rect.top - tipRect.height - gap;
        if (top < margin) {
            top = Math.min(window.innerHeight - margin - tipRect.height, rect.bottom + gap);
        }
        if (left < margin) left = margin;
        if (left + tipRect.width > window.innerWidth - margin) {
            left = Math.max(margin, window.innerWidth - margin - tipRect.width);
        }
        tooltipEl.style.left = `${Math.round(left)}px`;
        tooltipEl.style.top = `${Math.round(top)}px`;
        tooltipEl.style.zIndex = String(getOverlayZIndex(panel, 200120) + 1);
        return true;
    }

    function showFloatingMiniPriorityTooltip(priorityKey, targetEl = null) {
        const key = normalizeFloatingMiniPriorityKey(priorityKey);
        const label = getFloatingMiniPriorityLabel(key);
        if (!label) return false;
        clearFloatingMiniPriorityTooltipTimer();
        const tooltipEl = ensureFloatingMiniPriorityTooltip();
        if (!(tooltipEl instanceof HTMLElement)) return false;
        tooltipEl.textContent = label;
        tooltipEl.classList.remove('is-open');
        positionFloatingMiniPriorityTooltip(key, targetEl);
        try {
            requestAnimationFrame(() => {
                if (state.floatingMini.priorityTooltipEl !== tooltipEl) return;
                positionFloatingMiniPriorityTooltip(key, targetEl);
                tooltipEl.classList.add('is-open');
            });
        } catch (e) {
            positionFloatingMiniPriorityTooltip(key, targetEl);
            tooltipEl.classList.add('is-open');
        }
        return true;
    }

    function hideFloatingMiniPriorityTooltip(immediate = false) {
        const tooltipEl = state.floatingMini.priorityTooltipEl;
        if (!(tooltipEl instanceof HTMLElement)) {
            clearFloatingMiniPriorityTooltipTimer();
            return false;
        }
        clearFloatingMiniPriorityTooltipTimer();
        if (immediate) {
            removeFloatingMiniPriorityTooltip();
            return true;
        }
        tooltipEl.classList.remove('is-open');
        state.floatingMini.priorityTooltipHideTimer = setTimeout(() => {
            if (state.floatingMini.priorityTooltipEl === tooltipEl) {
                removeFloatingMiniPriorityTooltip();
            }
        }, 120);
        return true;
    }

    function renderFloatingMiniPriorityBar() {
        const panel = state.floatingMini.panelEl;
        const bar = panel?.querySelector?.('[data-tm-floating-mini-role="priority-bar"]');
        if (!(bar instanceof HTMLElement)) return false;
        const currentKey = normalizeFloatingMiniPriorityKey(state.floatingMini.dragPriorityKey);
        const hoverKey = String(state.floatingMini.priorityHoverKey || '').trim()
            ? normalizeFloatingMiniPriorityKey(state.floatingMini.priorityHoverKey)
            : '';
        const isFlagStyle = normalizeFloatingMiniPriorityIconStyle(getSettings()?.priorityIconStyle) === 'flag';
        bar.innerHTML = FLOATING_MINI_PRIORITY_OPTIONS.map((item) => {
            const key = normalizeFloatingMiniPriorityKey(item.key);
            const classes = [
                'tm-floating-mini-cal__priority-btn',
                `tm-floating-mini-cal__priority-btn--${key}`,
                isFlagStyle ? 'is-flag-style' : '',
                currentKey === key ? 'is-current' : '',
                hoverKey === key ? 'is-drop-target' : '',
            ].filter(Boolean).join(' ');
            return `<button class="${classes}" type="button" data-tm-mini-priority="${esc(key)}" aria-label="设置重要性为${esc(item.label)}">${renderFloatingMiniPriorityIcon(key)}</button>`;
        }).join('');
        bar.querySelectorAll('[data-tm-mini-priority]').forEach((el) => {
            if (!(el instanceof HTMLElement) || el.__tmFloatingMiniPriorityTipBound) return;
            const show = () => {
                const key = normalizeFloatingMiniPriorityKey(el.getAttribute('data-tm-mini-priority') || '');
                showFloatingMiniPriorityTooltip(key, el);
            };
            const hide = () => {
                hideFloatingMiniPriorityTooltip();
            };
            el.addEventListener('mouseenter', show);
            el.addEventListener('focus', show, true);
            el.addEventListener('mouseleave', hide);
            el.addEventListener('blur', hide, true);
            el.addEventListener('pointerdown', () => hideFloatingMiniPriorityTooltip(true), true);
            el.__tmFloatingMiniPriorityTipBound = true;
        });
        return true;
    }

    function setFloatingMiniPriorityHover(priorityKey) {
        const nextKey = String(priorityKey || '').trim() ? normalizeFloatingMiniPriorityKey(priorityKey) : '';
        if (String(state.floatingMini.priorityHoverKey || '').trim() === nextKey) return false;
        state.floatingMini.priorityHoverKey = nextKey;
        const rendered = renderFloatingMiniPriorityBar();
        if (nextKey) showFloatingMiniPriorityTooltip(nextKey);
        else hideFloatingMiniPriorityTooltip(true);
        return rendered;
    }

    async function applyFloatingMiniTaskPriority(taskId, priorityKey) {
        const id = String(taskId || state.floatingMini.dragTaskId || '').trim();
        if (!id) {
            toast('⚠ 未识别到拖拽任务', 'warning');
            return false;
        }
        if (typeof window.tmSetTaskPriority !== 'function') {
            toast('⚠ 未找到重要性更新接口', 'warning');
            return false;
        }
        const nextKey = normalizeFloatingMiniPriorityKey(priorityKey);
        try {
            await window.tmSetTaskPriority(id, nextKey === 'none' ? '' : nextKey, {
                silent: true,
                source: 'floating-mini-priority',
            });
            state.floatingMini.dragPriorityKey = nextKey;
            state.floatingMini.priorityHoverKey = '';
            if (state.floatingMini.dragPayload && typeof state.floatingMini.dragPayload === 'object') {
                try { state.floatingMini.dragPayload.priority = nextKey === 'none' ? '' : nextKey; } catch (e) {}
            }
            hideFloatingMiniPriorityTooltip(true);
            toast(`✅ 重要性已更新为${getFloatingMiniPriorityLabel(nextKey)}`, 'success');
            hideFloatingMiniCalendar();
            return true;
        } catch (e) {
            toast(`❌ 更新重要性失败：${String(e?.message || e || '')}`, 'error');
            return false;
        }
    }

    function clearFloatingMiniAutoFlipTimer() {
        if (state.floatingMini.autoFlipTimer) {
            try { clearTimeout(state.floatingMini.autoFlipTimer); } catch (e) {}
            state.floatingMini.autoFlipTimer = null;
        }
        state.floatingMini.autoFlipAction = '';
    }

    function clearFloatingMiniIdleHideTimer() {
        if (state.floatingMini.idleHideTimer) {
            try { clearTimeout(state.floatingMini.idleHideTimer); } catch (e) {}
            state.floatingMini.idleHideTimer = null;
        }
    }

    function markFloatingMiniPanelEntered() {
        if (state.floatingMini.enteredPanel) return false;
        state.floatingMini.enteredPanel = true;
        clearFloatingMiniIdleHideTimer();
        return true;
    }

    function scheduleFloatingMiniIdleHideTimer() {
        clearFloatingMiniIdleHideTimer();
        if (!state.floatingMini.open) return false;
        if (state.floatingMini.enteredPanel) return false;
        state.floatingMini.idleHideTimer = setTimeout(() => {
            state.floatingMini.idleHideTimer = null;
            if (!state.floatingMini.open) return;
            if (state.floatingMini.enteredPanel) return;
            hideFloatingMiniCalendar();
        }, 3000);
        return true;
    }

    function shouldMarkFloatingMiniPanelEntered(hit) {
        const targetEl = hit?.targetEl instanceof Element ? hit.targetEl : null;
        if (!(targetEl instanceof Element)) return false;
        const action = String(hit?.action || '').trim();
        if (action === 'priority' || action === 'prev' || action === 'next') return true;
        if (String(hit?.dateKey || '').trim()) return true;
        try {
            return !!targetEl.closest?.('[data-tm-floating-mini-role="calendar"], [data-tm-floating-mini-role="priority-bar"]');
        } catch (e) {
            return false;
        }
    }

    function clearFloatingMiniAbort() {
        try { state.floatingMini.abort?.abort?.(); } catch (e) {}
        state.floatingMini.abort = null;
    }

    function resolveFloatingMiniMode(mode) {
        const raw = String(mode || '').trim();
        if (raw === 'mobile') return 'mobile';
        if (raw === 'desktop') return 'desktop';
        return (state.isMobileDevice || isLikelyMobileRuntime()) ? 'mobile' : 'desktop';
    }

    function normalizeFloatingMiniContainerRect(rectLike) {
        const src = (rectLike && typeof rectLike === 'object') ? rectLike : null;
        const left = Number(src?.left);
        const top = Number(src?.top);
        const width = Number(src?.width);
        const height = Number(src?.height);
        if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(width) || !Number.isFinite(height)) return null;
        if (width <= 0 || height <= 0) return null;
        return {
            left,
            top,
            width,
            height,
            right: left + width,
            bottom: top + height,
        };
    }

    function syncFloatingMiniPanelPosition(opts) {
        const panel = state.floatingMini.panelEl;
        if (!(panel instanceof HTMLElement)) return false;
        const options = (opts && typeof opts === 'object') ? opts : {};
        const containerRect = normalizeFloatingMiniContainerRect(options.containerRect || state.floatingMini.containerRect);
        if (state.floatingMini.mode === 'mobile') {
            const viewportWidth = Math.max(320, Number(window.innerWidth) || 0);
            const viewportHeight = Math.max(320, Number(window.innerHeight) || 0);
            const panelRect = panel.getBoundingClientRect();
            const panelHeight = Math.max(220, Math.round(panelRect.height || panel.offsetHeight || 300));
            const compactViewport = viewportWidth <= 420;
            const insetX = compactViewport ? 18 : 24;
            const topInset = 12;
            const bottomInset = compactViewport ? 22 : 16;
            const pointerYRaw = Number.isFinite(Number(options.clientY))
                ? Number(options.clientY)
                : Number(state.floatingMini.pointerClientY);
            const boundsLeft = containerRect
                ? Math.max(8, Math.round(containerRect.left + Math.min(14, Math.max(8, containerRect.width * 0.04))))
                : insetX;
            const boundsRight = containerRect
                ? Math.max(8, Math.round(viewportWidth - containerRect.right + Math.min(14, Math.max(8, containerRect.width * 0.04))))
                : insetX;
            const boundsTop = containerRect
                ? Math.max(8, Math.round(containerRect.top + 8))
                : topInset;
            const boundsBottom = containerRect
                ? Math.max(8, Math.round(viewportHeight - containerRect.bottom + 8))
                : 10;
            const safeBottomInset = Math.max(boundsBottom, bottomInset);
            const bottomPanelTop = Math.max(boundsTop, viewportHeight - safeBottomInset - panelHeight);
            const canStickBottom = (viewportHeight - safeBottomInset - panelHeight) >= boundsTop;
            const liftedPanelTop = Number.isFinite(pointerYRaw)
                ? Math.max(boundsTop, Math.min(bottomPanelTop, Math.round(pointerYRaw - panelHeight - 24)))
                : bottomPanelTop;
            const bottomPlacementOverlapsPointer = Number.isFinite(pointerYRaw)
                ? pointerYRaw >= (bottomPanelTop - 20)
                : false;
            const canLiftAbovePointer = Number.isFinite(pointerYRaw)
                ? ((liftedPanelTop + panelHeight + 12) <= pointerYRaw)
                : false;
            const middlePanelTop = Math.max(
                boundsTop,
                Math.min(
                    bottomPanelTop,
                    Math.round(
                        containerRect
                            ? (containerRect.top + ((containerRect.height - panelHeight) / 2))
                            : ((viewportHeight - panelHeight) / 2)
                    )
                )
            );
            try {
                panel.style.left = `${boundsLeft}px`;
                panel.style.right = `${boundsRight}px`;
                panel.style.maxWidth = containerRect ? 'none' : '';
                if (canStickBottom && !(bottomPlacementOverlapsPointer && canLiftAbovePointer)) {
                    panel.style.top = 'auto';
                    panel.style.bottom = `${safeBottomInset}px`;
                } else {
                    panel.style.top = `${canLiftAbovePointer ? liftedPanelTop : middlePanelTop}px`;
                    panel.style.bottom = 'auto';
                }
            } catch (e) {}
            return true;
        }
        const viewportWidth = Math.max(320, Number(window.innerWidth) || 0);
        const viewportHeight = Math.max(320, Number(window.innerHeight) || 0);
        const panelRect = panel.getBoundingClientRect();
        const panelWidth = Math.max(240, Math.round(panelRect.width || panel.offsetWidth || 320));
        const panelHeight = Math.max(260, Math.round(panelRect.height || panel.offsetHeight || 340));
        const clientXRaw = Number.isFinite(Number(options.clientX))
            ? Number(options.clientX)
            : Number(state.floatingMini.pointerClientX);
        const clientYRaw = Number.isFinite(Number(options.clientY))
            ? Number(options.clientY)
            : Number(state.floatingMini.pointerClientY);
        const horizontalInset = viewportWidth <= 960 ? 16 : 24;
        const bottomInset = 18;
        const topInset = containerRect
            ? Math.max(16, Math.round(containerRect.top + 12))
            : 20;
        const centeredLeft = Math.max(
            horizontalInset,
            Math.min(viewportWidth - panelWidth - horizontalInset, Math.round((viewportWidth - panelWidth) / 2))
        );
        const bottomTop = Math.max(topInset, viewportHeight - panelHeight - bottomInset);
        const middleTop = Math.max(
            topInset,
            Math.min(
                bottomTop,
                Math.round(
                    containerRect
                        ? (containerRect.top + ((containerRect.height - panelHeight) / 2))
                        : ((viewportHeight - panelHeight) / 2)
                )
            )
        );
        const centerZoneLeft = centeredLeft - 32;
        const centerZoneRight = centeredLeft + panelWidth + 32;
        const pointerNearBottomCenter = Number.isFinite(clientXRaw) && Number.isFinite(clientYRaw)
            ? (clientXRaw >= centerZoneLeft && clientXRaw <= centerZoneRight && clientYRaw >= (bottomTop - 36))
            : false;
        const pointerNearBottomBand = Number.isFinite(clientYRaw)
            ? clientYRaw > (containerRect ? (containerRect.top + containerRect.height * 0.72) : (viewportHeight * 0.72))
            : false;
        const preferTop = pointerNearBottomCenter || pointerNearBottomBand;
        try {
            panel.style.left = `${centeredLeft}px`;
            panel.style.right = 'auto';
            if (preferTop) {
                panel.style.top = `${middleTop}px`;
                panel.style.bottom = 'auto';
            } else {
                panel.style.top = 'auto';
                panel.style.bottom = `${bottomInset}px`;
            }
        } catch (e) {}
        return true;
    }

    function ensureFloatingMiniOverlay(mode) {
        const nextMode = resolveFloatingMiniMode(mode);
        const existingOverlay = state.floatingMini.overlayEl;
        const existingPanel = state.floatingMini.panelEl;
        const existingHost = state.floatingMini.hostEl;
        if (
            existingOverlay instanceof HTMLElement
            && existingPanel instanceof HTMLElement
            && existingHost instanceof HTMLElement
            && String(existingOverlay.getAttribute('data-tm-floating-mini-mode') || '').trim() === nextMode
        ) {
            return existingHost;
        }

        clearFloatingMiniAbort();
        clearFloatingMiniAutoFlipTimer();
        clearFloatingMiniIdleHideTimer();
        if (existingOverlay instanceof HTMLElement) {
            try { existingOverlay.remove(); } catch (e) {}
        }
        state.floatingMini.overlayEl = null;
        state.floatingMini.panelEl = null;
        state.floatingMini.hostEl = null;

        const overlay = document.createElement('div');
        overlay.className = `tm-floating-mini-cal tm-floating-mini-cal--${nextMode}`;
        overlay.setAttribute('data-tm-floating-mini-mode', nextMode);
        overlay.innerHTML = `
            <div class="tm-floating-mini-cal__backdrop" data-tm-floating-mini-action="close"></div>
            <div class="tm-floating-mini-cal__panel">
                <div class="tm-floating-mini-cal__priority-bar" data-tm-floating-mini-role="priority-bar"></div>
                <div class="tm-calendar-mini tm-floating-mini-cal__calendar" data-tm-floating-mini-role="calendar"></div>
            </div>
        `;
        document.body.appendChild(overlay);
        const panel = overlay.querySelector('.tm-floating-mini-cal__panel');
        const host = overlay.querySelector('[data-tm-floating-mini-role="calendar"]');
        if (!(panel instanceof HTMLElement) || !(host instanceof HTMLElement)) {
            try { overlay.remove(); } catch (e) {}
            return null;
        }

        const abort = new AbortController();
        state.floatingMini.abort = abort;
        state.floatingMini.overlayEl = overlay;
        state.floatingMini.panelEl = panel;
        state.floatingMini.hostEl = host;
        state.floatingMini.mode = nextMode;

        overlay.addEventListener('click', (e) => {
            const priorityEl = e?.target?.closest?.('[data-tm-mini-priority]');
            const priorityKey = normalizeFloatingMiniPriorityKey(priorityEl?.getAttribute?.('data-tm-mini-priority') || '');
            if (priorityEl instanceof HTMLElement) {
                try { e.preventDefault(); } catch (e2) {}
                try { e.stopPropagation(); } catch (e2) {}
                void applyFloatingMiniTaskPriority('', priorityKey);
                return;
            }
            const action = String(e?.target?.closest?.('[data-tm-floating-mini-action]')?.getAttribute?.('data-tm-floating-mini-action') || '').trim();
            if (action === 'close') {
                hideFloatingMiniCalendar();
            }
        }, { signal: abort.signal });

        host.addEventListener('click', (e) => {
            const actionEl = e.target?.closest?.('[data-tm-mini-action]');
            const action = String(actionEl?.getAttribute?.('data-tm-mini-action') || '').trim();
            if (action === 'prev') {
                state.floatingMini.monthKey = miniMonthKeyShift(state.floatingMini.monthKey, -1) || state.floatingMini.monthKey;
                renderFloatingMiniCalendarPanel();
                return;
            }
            if (action === 'next') {
                state.floatingMini.monthKey = miniMonthKeyShift(state.floatingMini.monthKey, 1) || state.floatingMini.monthKey;
                renderFloatingMiniCalendarPanel();
            }
        }, { signal: abort.signal });

        overlay.addEventListener('dragover', (e) => {
            const info = updateFloatingMiniCalendarDrag({
                clientX: e?.clientX,
                clientY: e?.clientY,
                target: e?.target,
            });
            if (info.overFloatingMini) {
                try { e.preventDefault(); } catch (e2) {}
                try {
                    if (e?.dataTransfer) {
                        e.dataTransfer.dropEffect = (info.dateKey || info.action) ? 'move' : 'none';
                    }
                } catch (e2) {}
            }
        }, { signal: abort.signal });

        overlay.addEventListener('dragleave', (e) => {
            const rel = e?.relatedTarget instanceof Element ? e.relatedTarget : null;
            if (rel && overlay.contains(rel)) return;
            setFloatingMiniPriorityHover('');
            clearFloatingMiniCalendarHover();
        }, { signal: abort.signal });

        overlay.addEventListener('drop', async (e) => {
            try { e.preventDefault(); } catch (e2) {}
            const info = updateFloatingMiniCalendarDrag({
                clientX: e?.clientX,
                clientY: e?.clientY,
                target: e?.target,
            });
            const payload = parseTaskDropPayload(e, null, null) || state.floatingMini.dragPayload || null;
            const taskId = String(payload?.taskId || state.floatingMini.dragTaskId || '').trim();
            if (!taskId) {
                toast('⚠ 未识别到拖拽任务', 'warning');
                return;
            }
            if (info.action === 'priority') {
                await applyFloatingMiniTaskPriority(taskId, info.priorityKey);
                return;
            }
            if (!info.dateKey) return;
            await applyFloatingMiniCalendarDate(taskId, info.dateKey);
        }, { signal: abort.signal });

        return host;
    }

    function renderFloatingMiniCalendarPanel() {
        const host = state.floatingMini.hostEl;
        if (!(host instanceof HTMLElement) || !state.floatingMini.open) return false;
        try { renderFloatingMiniPriorityBar(); } catch (e) {}
        const selectedDateKey = String(state.floatingMini.selectedDateKey || '').trim();
        const sourceDateKey = String(state.floatingMini.sourceDateKey || '').trim();
        const hoverDateKey = String(state.floatingMini.hoverDateKey || '').trim();
        const fallbackDate = parseDateOnly(selectedDateKey || sourceDateKey || hoverDateKey) || new Date();
        if (!state.floatingMini.monthKey) {
            state.floatingMini.monthKey = miniMonthKeyFromDate(fallbackDate);
        }
        renderMiniCalendarHost(host, {
            kind: 'floating',
            monthKey: state.floatingMini.monthKey,
            selectedDateKey,
            sourceDateKey,
            hoverDateKey,
            firstDay: Number(getSettings().firstDay) === 0 ? 0 : 1,
            showTargetLabel: true,
        });
        return true;
    }

    function setFloatingMiniCalendarHover(dateKey) {
        const nextKey = String(dateKey || '').trim();
        if (String(state.floatingMini.hoverDateKey || '').trim() === nextKey) return false;
        state.floatingMini.hoverDateKey = nextKey;
        const host = state.floatingMini.hostEl;
        if (host instanceof HTMLElement) {
            syncMiniCalendarInteractiveState(host, {
                selectedDateKey: state.floatingMini.selectedDateKey,
                sourceDateKey: state.floatingMini.sourceDateKey,
                hoverDateKey: state.floatingMini.hoverDateKey,
            });
        }
        return true;
    }

    function clearFloatingMiniCalendarHover(opts) {
        const options = (opts && typeof opts === 'object') ? opts : {};
        if (options.preserveAutoFlip !== true) {
            clearFloatingMiniAutoFlipTimer();
        }
        return setFloatingMiniCalendarHover('');
    }

    function applyFloatingMiniMonthFlip(action) {
        const nextAction = String(action || '').trim();
        if (!state.floatingMini.open) return false;
        if (nextAction !== 'prev' && nextAction !== 'next') return false;
        const delta = nextAction === 'prev' ? -1 : 1;
        const nextMonthKey = miniMonthKeyShift(state.floatingMini.monthKey, delta);
        if (!nextMonthKey || nextMonthKey === state.floatingMini.monthKey) return false;
        state.floatingMini.monthKey = nextMonthKey;
        state.floatingMini.hoverDateKey = '';
        renderFloatingMiniCalendarPanel();
        return true;
    }

    function scheduleFloatingMiniMonthFlip(action) {
        const nextAction = String(action || '').trim();
        if (!nextAction || (nextAction !== 'prev' && nextAction !== 'next')) {
            clearFloatingMiniAutoFlipTimer();
            return false;
        }
        if (state.floatingMini.autoFlipTimer && state.floatingMini.autoFlipAction === nextAction) return true;
        clearFloatingMiniAutoFlipTimer();
        state.floatingMini.autoFlipAction = nextAction;
        const scheduleNextTick = () => {
            state.floatingMini.autoFlipTimer = setTimeout(() => {
                state.floatingMini.autoFlipTimer = null;
                if (!state.floatingMini.open) {
                    state.floatingMini.autoFlipAction = '';
                    return;
                }
                if (state.floatingMini.autoFlipAction !== nextAction) return;
                const flipped = applyFloatingMiniMonthFlip(nextAction);
                if (!flipped) {
                    state.floatingMini.autoFlipAction = '';
                    return;
                }
                if (state.floatingMini.autoFlipAction === nextAction) {
                    scheduleNextTick();
                }
            }, 1000);
        };
        scheduleNextTick();
        return true;
    }

    function getFloatingMiniHitFromTarget(target) {
        const overlay = state.floatingMini.overlayEl;
        const el = target instanceof Element ? target : null;
        if (!(overlay instanceof HTMLElement) || !(el instanceof Element)) {
            return { overFloatingMini: false, action: '', dateKey: '', priorityKey: '', targetEl: null };
        }
        if (!overlay.contains(el)) {
            return { overFloatingMini: false, action: '', dateKey: '', priorityKey: '', targetEl: el };
        }
        const priorityEl = el.closest('[data-tm-mini-priority]');
        const priorityKey = normalizeFloatingMiniPriorityKey(priorityEl?.getAttribute?.('data-tm-mini-priority') || '');
        if (priorityEl instanceof HTMLElement) {
            return { overFloatingMini: true, action: 'priority', dateKey: '', priorityKey, targetEl: priorityEl };
        }
        const actionEl = el.closest('[data-tm-mini-action]');
        const action = String(actionEl?.getAttribute?.('data-tm-mini-action') || '').trim();
        if (action === 'prev' || action === 'next') {
            return { overFloatingMini: true, action, dateKey: '', priorityKey: '', targetEl: actionEl };
        }
        const dateEl = el.closest('[data-tm-mini-date]');
        const dateKey = String(dateEl?.getAttribute?.('data-tm-mini-date') || '').trim();
        if (dateKey) {
            return { overFloatingMini: true, action: '', dateKey, priorityKey: '', targetEl: dateEl };
        }
        return { overFloatingMini: true, action: '', dateKey: '', priorityKey: '', targetEl: el };
    }

    function isPointInsideRect(x, y, rect) {
        const left = Number(rect?.left);
        const right = Number(rect?.right);
        const top = Number(rect?.top);
        const bottom = Number(rect?.bottom);
        if (!Number.isFinite(left) || !Number.isFinite(right) || !Number.isFinite(top) || !Number.isFinite(bottom)) return false;
        return x >= left && x <= right && y >= top && y <= bottom;
    }

    function getFloatingMiniHitFromPoint(clientX, clientY) {
        const x = Number(clientX);
        const y = Number(clientY);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return { overFloatingMini: false, action: '', dateKey: '', priorityKey: '', targetEl: null };
        }
        const panel = state.floatingMini.panelEl;
        const host = state.floatingMini.hostEl;
        if (!(panel instanceof HTMLElement)) {
            return { overFloatingMini: false, action: '', dateKey: '', priorityKey: '', targetEl: null };
        }
        const panelRect = panel.getBoundingClientRect();
        if (!isPointInsideRect(x, y, panelRect)) {
            return { overFloatingMini: false, action: '', dateKey: '', priorityKey: '', targetEl: null };
        }
        if (panel instanceof HTMLElement) {
            const priorityNodes = panel.querySelectorAll('[data-tm-mini-priority]');
            for (const node of priorityNodes) {
                if (!(node instanceof HTMLElement)) continue;
                if (!isPointInsideRect(x, y, node.getBoundingClientRect())) continue;
                return {
                    overFloatingMini: true,
                    action: 'priority',
                    dateKey: '',
                    priorityKey: normalizeFloatingMiniPriorityKey(node.getAttribute('data-tm-mini-priority') || ''),
                    targetEl: node,
                };
            }
            const actionNodes = panel.querySelectorAll('[data-tm-mini-action]');
            for (const node of actionNodes) {
                if (!(node instanceof HTMLElement)) continue;
                if (isPointInsideRect(x, y, node.getBoundingClientRect())) {
                    const action = String(node.getAttribute('data-tm-mini-action') || '').trim();
                    if (action === 'prev' || action === 'next') {
                        return { overFloatingMini: true, action, dateKey: '', priorityKey: '', targetEl: node };
                    }
                }
            }
        }
        if (host instanceof HTMLElement) {
            const dateNodes = host.querySelectorAll('[data-tm-mini-date]');
            for (const node of dateNodes) {
                if (!(node instanceof HTMLElement)) continue;
                if (!isPointInsideRect(x, y, node.getBoundingClientRect())) continue;
                const dateKey = String(node.getAttribute('data-tm-mini-date') || '').trim();
                return { overFloatingMini: true, action: '', dateKey, priorityKey: '', targetEl: node };
            }
        }
        return { overFloatingMini: true, action: '', dateKey: '', priorityKey: '', targetEl: panel };
    }

    function updateFloatingMiniCalendarDrag(opts) {
        if (!state.floatingMini.open) {
            return { overFloatingMini: false, action: '', dateKey: '', targetEl: null };
        }
        const options = (opts && typeof opts === 'object') ? opts : {};
        const clientX = Number(options.clientX);
        const clientY = Number(options.clientY);
        if (Number.isFinite(clientX)) state.floatingMini.pointerClientX = clientX;
        if (Number.isFinite(clientY)) state.floatingMini.pointerClientY = clientY;
        let targetEl = options.target instanceof Element ? options.target : null;
        if (!(targetEl instanceof Element) && Number.isFinite(clientX) && Number.isFinite(clientY)) {
            try { targetEl = document.elementFromPoint(clientX, clientY); } catch (e) { targetEl = null; }
        }
        let hit = getFloatingMiniHitFromTarget(targetEl);
        if (!hit.overFloatingMini && Number.isFinite(clientX) && Number.isFinite(clientY)) {
            hit = getFloatingMiniHitFromPoint(clientX, clientY);
        }
        if (!hit.overFloatingMini) {
            setFloatingMiniPriorityHover('');
            clearFloatingMiniCalendarHover();
            return hit;
        }
        if (shouldMarkFloatingMiniPanelEntered(hit)) {
            markFloatingMiniPanelEntered();
        }
        if (hit.action === 'priority') {
            clearFloatingMiniAutoFlipTimer();
            clearFloatingMiniCalendarHover();
            setFloatingMiniPriorityHover(hit.priorityKey);
            return hit;
        }
        if (hit.action === 'prev' || hit.action === 'next') {
            setFloatingMiniPriorityHover('');
            clearFloatingMiniCalendarHover({ preserveAutoFlip: true });
            scheduleFloatingMiniMonthFlip(hit.action);
            return hit;
        }
        clearFloatingMiniAutoFlipTimer();
        setFloatingMiniPriorityHover('');
        if (hit.dateKey) {
            setFloatingMiniCalendarHover(hit.dateKey);
            return hit;
        }
        clearFloatingMiniCalendarHover();
        return hit;
    }

    async function applyFloatingMiniCalendarDate(taskId, dateKey) {
        const id = String(taskId || state.floatingMini.dragTaskId || '').trim();
        const normalizedDateKey = String(dateKey || '').trim();
        if (!id || !normalizedDateKey) return false;
        if (typeof window.tmUpdateTaskDates !== 'function') {
            toast('⚠ 未找到任务日期更新接口', 'warning');
            return false;
        }
        try {
            await window.tmUpdateTaskDates(id, { completionTime: normalizedDateKey });
            try {
                scheduleCalendarRefresh({
                    reason: 'floating-mini-taskdate-save',
                    main: true,
                    side: true,
                    flushTaskPanel: true,
                    rangeStart: normalizedDateKey,
                    rangeEnd: normalizedDateKey,
                });
            } catch (e2) {}
            state.floatingMini.lastDropAt = Date.now();
            state.floatingMini.selectedDateKey = normalizedDateKey;
            state.floatingMini.sourceDateKey = normalizedDateKey;
            state.floatingMini.hoverDateKey = '';
            toast(`✅ 完成日期已更新为 ${normalizedDateKey}`, 'success');
            hideFloatingMiniCalendar();
            return true;
        } catch (e) {
            toast(`❌ 更新任务日期失败：${String(e?.message || e || '')}`, 'error');
            return false;
        }
    }

    async function finalizeFloatingMiniCalendarTouchDrop(opts) {
        if (!state.floatingMini.open) return false;
        const options = (opts && typeof opts === 'object') ? opts : {};
        const isMobileDrop = String(options.mode || state.floatingMini.mode || '').trim() === 'mobile';
        try {
            const hit = updateFloatingMiniCalendarDrag(options);
            const taskId = String(options.taskId || options.dragTaskId || state.floatingMini.dragTaskId || '').trim();
            if (hit?.action === 'priority') {
                return applyFloatingMiniTaskPriority(taskId, hit.priorityKey);
            }
            const dateKey = String(hit?.dateKey || state.floatingMini.hoverDateKey || '').trim();
            if (!dateKey) return false;
            return await applyFloatingMiniCalendarDate(taskId, dateKey);
        } finally {
            if (isMobileDrop) {
                hideFloatingMiniCalendar();
            }
        }
    }

    function showFloatingMiniCalendar(opts) {
        const options = (opts && typeof opts === 'object') ? opts : {};
        const taskId = String(options.taskId || options.dragTaskId || '').trim();
        let meta = (options.meta && typeof options.meta === 'object') ? options.meta : null;
        if (!meta && taskId && typeof window.tmCalendarGetTaskDragMeta === 'function') {
            try { meta = window.tmCalendarGetTaskDragMeta(taskId); } catch (e) {}
        }
        const selectedDateKey = String(meta?.completionTime || options.completionTime || '').trim();
        const fallbackDate = parseDateOnly(selectedDateKey) || new Date();
        const host = ensureFloatingMiniOverlay(options.mode);
        if (!(host instanceof HTMLElement)) return false;

        state.floatingMini.open = true;
        state.floatingMini.dragTaskId = taskId;
        state.floatingMini.dragPayload = options.dragPayload || meta || null;
        state.floatingMini.dragPriorityKey = normalizeFloatingMiniPriorityKey(meta?.priority || options.priority || '');
        state.floatingMini.selectedDateKey = selectedDateKey;
        state.floatingMini.sourceDateKey = selectedDateKey;
        state.floatingMini.hoverDateKey = '';
        state.floatingMini.priorityHoverKey = '';
        state.floatingMini.containerRect = normalizeFloatingMiniContainerRect(options.containerRect);
        state.floatingMini.monthKey = String(options.monthKey || '').trim() || miniMonthKeyFromDate(fallbackDate);
        state.floatingMini.pointerClientX = Number(options.clientX);
        state.floatingMini.pointerClientY = Number(options.clientY);
        state.floatingMini.enteredPanel = false;

        renderFloatingMiniCalendarPanel();
        try {
            state.floatingMini.overlayEl?.classList?.add?.('is-open');
        } catch (e) {}
        try { syncFloatingMiniPanelPosition(options); } catch (e) {}
        scheduleFloatingMiniIdleHideTimer();
        return true;
    }

    function hideFloatingMiniCalendar() {
        clearFloatingMiniAutoFlipTimer();
        clearFloatingMiniIdleHideTimer();
        clearFloatingMiniAbort();
        removeFloatingMiniPriorityTooltip();
        const overlay = state.floatingMini.overlayEl;
        if (overlay instanceof HTMLElement) {
            try { overlay.remove(); } catch (e) {}
        }
        state.floatingMini.open = false;
        state.floatingMini.overlayEl = null;
        state.floatingMini.panelEl = null;
        state.floatingMini.hostEl = null;
        state.floatingMini.priorityTooltipEl = null;
        state.floatingMini.containerRect = null;
        state.floatingMini.monthKey = '';
        state.floatingMini.selectedDateKey = '';
        state.floatingMini.sourceDateKey = '';
        state.floatingMini.hoverDateKey = '';
        state.floatingMini.dragTaskId = '';
        state.floatingMini.dragPayload = null;
        state.floatingMini.dragPriorityKey = 'none';
        state.floatingMini.priorityHoverKey = '';
        state.floatingMini.pointerClientX = NaN;
        state.floatingMini.pointerClientY = NaN;
        state.floatingMini.enteredPanel = false;
        return true;
    }

    function syncCalendarDropDayPreview(host, dateKey) {
        if (!(host instanceof Element)) return;
        const nextKey = String(dateKey || '').trim();
        const prevKey = String(state.calendarDropPreviewDayKey || '').trim();
        if (nextKey === prevKey) return;
        if (prevKey) {
            try {
                host.querySelectorAll(`.fc-daygrid-day[data-date="${CSS.escape(prevKey)}"]`).forEach((el) => {
                    try { el.classList.remove('tm-cal-drop-target'); } catch (e) {}
                    try {
                        if (el.getAttribute('data-tm-drop-native-today') === '1') {
                            el.classList.remove('fc-day-today');
                            el.removeAttribute('data-tm-drop-native-today');
                        }
                    } catch (e) {}
                });
            } catch (e) {}
        }
        state.calendarDropPreviewDayKey = nextKey;
        if (!nextKey) return;
        try {
            host.querySelectorAll(`.fc-daygrid-day[data-date="${CSS.escape(nextKey)}"]`).forEach((el) => {
                try { el.classList.add('tm-cal-drop-target'); } catch (e) {}
                try {
                    if (!el.classList.contains('fc-day-today')) {
                        el.classList.add('fc-day-today');
                        el.setAttribute('data-tm-drop-native-today', '1');
                    }
                } catch (e) {}
            });
        } catch (e) {}
    }

    function bindCalendarDrop(wrap) {
        const host = state.calendarEl;
        if (!host) return;
        try { state.calendarDropAbort?.abort?.(); } catch (e) {}
        try { syncCalendarDropDayPreview(host, ''); } catch (e) { state.calendarDropPreviewDayKey = ''; }
        const abort = new AbortController();
        state.calendarDropAbort = abort;
        const PREVIEW_EVENT_ID = '__tm-cal-drag-preview-main__';
        let previewKey = '';
        let liveDrag = null;
        let scrollRefreshFrame = null;
        const isFullCalendarManagedDrag = () => {
            try {
                return !!document.querySelector('.fc-event-mirror, .fc-event-dragging');
            } catch (e) {}
            return false;
        };
        const syncPreviewDayCell = (dateKey) => syncCalendarDropDayPreview(host, dateKey);
        const clearDropPreview = () => {
            previewKey = '';
            liveDrag = null;
            if (scrollRefreshFrame != null) {
                try { cancelAnimationFrame(scrollRefreshFrame); } catch (e) {}
                scrollRefreshFrame = null;
            }
            syncPreviewDayCell('');
            try { state.calendar?.getEventById?.(PREVIEW_EVENT_ID)?.remove?.(); } catch (e) {}
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
        };
        const renderDropPreview = (payload, hit) => {
            const start = hit?.start;
            if (!payload?.taskId || !(start instanceof Date) || Number.isNaN(start.getTime())) {
                clearDropPreview();
                return;
            }
            const allDay = hit?.allDay === true;
            const viewType = String(state.calendar?.view?.type || '').trim();
            syncPreviewDayCell(viewType === 'dayGridMonth' ? formatDateKey(start) : '');
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
            const color = String(defs.find((d) => String(d?.id || '').trim() === calId)?.color || 'var(--tm-primary-color)').trim() || 'var(--tm-primary-color)';
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
        const resolveMonthDayKeyFromPoint = (x, y) => {
            const viewType = String(state.calendar?.view?.type || '').trim();
            if (viewType !== 'dayGridMonth') return '';
            const xp = Number(x);
            const yp = Number(y);
            if (!Number.isFinite(xp) || !Number.isFinite(yp)) return '';
            const resolveDateFromEl = (el) => {
                if (!(el instanceof Element)) return '';
                const cell = el.closest?.('.fc-daygrid-day[data-date]');
                if (!(cell instanceof HTMLElement) || !host.contains(cell)) return '';
                return String(cell.getAttribute('data-date') || '').trim();
            };
            try {
                if (typeof document.elementsFromPoint === 'function') {
                    const layered = document.elementsFromPoint(xp, yp);
                    for (const el of layered) {
                        const key = resolveDateFromEl(el);
                        if (key) return key;
                    }
                }
            } catch (e) {}
            try {
                const direct = document.elementFromPoint(xp, yp);
                const key = resolveDateFromEl(direct);
                if (key) return key;
            } catch (e) {}
            const cells = Array.from(host.querySelectorAll('.fc-daygrid-day[data-date]'));
            for (const cell of cells) {
                try {
                    const rect = cell.getBoundingClientRect();
                    if (xp >= rect.left && xp <= rect.right && yp >= rect.top && yp <= rect.bottom) {
                        return String(cell.getAttribute('data-date') || '').trim();
                    }
                } catch (e) {}
            }
            return '';
        };
        const syncMonthHighlightByPoint = (x, y) => {
            const viewType = String(state.calendar?.view?.type || '').trim();
            if (viewType !== 'dayGridMonth') {
                syncPreviewDayCell('');
                return '';
            }
            const xp = Number(x);
            const yp = Number(y);
            if (!Number.isFinite(xp) || !Number.isFinite(yp)) {
                syncPreviewDayCell('');
                return '';
            }
            try {
                const rect = host.getBoundingClientRect();
                const inside = xp >= rect.left && xp <= rect.right && yp >= rect.top && yp <= rect.bottom;
                if (!inside) {
                    syncPreviewDayCell('');
                    return '';
                }
            } catch (e) {}
            const key = resolveMonthDayKeyFromPoint(xp, yp);
            syncPreviewDayCell(key);
            return key;
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
        const refreshPreviewFromLiveDrag = () => {
            const xp = Number(liveDrag?.x);
            const yp = Number(liveDrag?.y);
            if (!liveDrag?.payload?.taskId || !Number.isFinite(xp) || !Number.isFinite(yp)) return;
            try {
                const rect = host.getBoundingClientRect();
                const inside = xp >= rect.left && xp <= rect.right && yp >= rect.top && yp <= rect.bottom;
                if (!inside) {
                    clearDropPreview();
                    return;
                }
            } catch (e) {}
            syncMonthHighlightByPoint(xp, yp);
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

        host.addEventListener('dragover', (e) => {
            // 检查是否为白板连线操作，如果是则不阻止默认行为
            const types = Array.from(e.dataTransfer?.types || []);
            const isWhiteboardLink = types.includes('application/x-tm-task-link');
            if (isWhiteboardLink) return;
            if (isFullCalendarManagedDrag()) return;

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
                rememberLiveDrag(payload, e.clientX, e.clientY);
                syncMonthHighlightByPoint(e.clientX, e.clientY);
                const hit = getDropInfo(e.target, e.clientX, e.clientY);
                renderDropPreview(payload, hit);
                return;
            }
            e.preventDefault();
            const payload = parseTaskDropPayload(e, null, null) || buildDraggingTaskPayload(null);
            rememberLiveDrag(payload, e.clientX, e.clientY);
            syncMonthHighlightByPoint(e.clientX, e.clientY);
            const hit = getDropInfo(e.target, e.clientX, e.clientY);
            renderDropPreview(payload, hit);
        }, { signal: abort.signal });
        host.addEventListener('dragenter', (e) => {
            if (isFullCalendarManagedDrag()) return;
            syncMonthHighlightByPoint(e.clientX, e.clientY);
        }, { signal: abort.signal });
        host.addEventListener('scroll', schedulePreviewRefresh, { signal: abort.signal, capture: true });
        Array.from(host.querySelectorAll('.fc-scroller')).forEach((scroller) => {
            try { scroller.addEventListener('scroll', schedulePreviewRefresh, { signal: abort.signal, passive: true }); } catch (e) {}
        });
        host.addEventListener('dragleave', (e) => {
            try {
                const r = host.getBoundingClientRect();
                const x = Number(e.clientX);
                const y = Number(e.clientY);
                const out = !Number.isFinite(x) || !Number.isFinite(y) || x < r.left || x > r.right || y < r.top || y > r.bottom;
                if (out) clearDropPreview();
            } catch (e2) {}
        }, { signal: abort.signal });
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
        }, { signal: abort.signal });
        document.addEventListener('drop', () => {
            clearDropPreview();
        }, { signal: abort.signal, capture: true });
        window.addEventListener('dragend', clearDropPreview, { signal: abort.signal });
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

    function getScheduleLinkedBlockId(item) {
        return String(
            item?.blockId
            || item?.block_id
            || item?.linkedBlockId
            || item?.linked_block_id
            || ''
        ).trim();
    }

    function normalizeScheduleList(arr) {
        const list0 = Array.isArray(arr) ? arr : [];
        let changed = false;
        const out = list0.map((it) => {
            const base = (it && typeof it === 'object') ? it : {};
            const id0 = String(base.id || '').trim();
            const taskId0 = String(base.taskId || base.task_id || base.linkedTaskId || base.linked_task_id || '').trim();
            const blockId0 = getScheduleLinkedBlockId(base);
            const id = id0 || uuid();
            if (id !== id0) changed = true;
            if (taskId0 && taskId0 !== String(base.taskId || '').trim()) changed = true;
            if (blockId0 && blockId0 !== String(base.blockId || '').trim()) changed = true;
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
            const completedOccurrences0 = normalizeScheduleCompletedOccurrences(base.completedOccurrences);
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
            if (JSON.stringify(Array.isArray(base.completedOccurrences) ? base.completedOccurrences : []) !== JSON.stringify(completedOccurrences0)) changed = true;
            return {
                ...base,
                id,
                taskId: taskId0,
                blockId: blockId0,
                reminderMode: reminderMode0,
                reminderEnabled: reminderEnabled0,
                reminderOffsetMin: reminderOffsetMin0,
                repeatType: repeatType0,
                repeatEvery: repeatEvery0,
                repeatUntil: repeatUntil0,
                repeatMonthlyMode: repeatMonthlyMode0,
                notificationSchedules: notificationSchedules0,
                completedOccurrences: completedOccurrences0,
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

    function normalizeScheduleCompletedOccurrenceKey(value) {
        const n = Math.trunc(Number(value));
        if (!Number.isFinite(n) || n <= 0) return '';
        return String(n);
    }

    function normalizeScheduleCompletedOccurrences(value) {
        const list = Array.isArray(value) ? value : [];
        const out = [];
        const seen = new Set();
        for (const entry of list) {
            const key = normalizeScheduleCompletedOccurrenceKey(
                entry?.startMs
                ?? entry?.occurrenceStartMs
                ?? entry?.time
                ?? entry
            );
            if (!key || seen.has(key)) continue;
            seen.add(key);
            out.push(key);
        }
        out.sort((a, b) => Number(a) - Number(b));
        return out;
    }

    function getScheduleCompletedOccurrenceSet(item) {
        const set = new Set();
        const arr = normalizeScheduleCompletedOccurrences(item?.completedOccurrences);
        for (const key of arr) set.add(key);
        return set;
    }

    function isScheduleOccurrenceDone(item, occurrenceStartMs) {
        const key = normalizeScheduleCompletedOccurrenceKey(occurrenceStartMs);
        if (!key) return false;
        return getScheduleCompletedOccurrenceSet(item).has(key);
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
        let version = Number(opts.version);
        if (!Number.isFinite(version) || version <= 0) {
            version = (Number(state.calendarMutationVersion) || 0) + 1;
        }
        state.calendarMutationVersion = Math.max(Number(state.calendarMutationVersion) || 0, version);
        const serialized = JSON.stringify(list, null, 2);
        setScheduleCache(list, computeScheduleSourceSignature(serialized));
        try { localStorage.setItem(STORAGE.SCHEDULE_LS_KEY, serialized); } catch (e) {}
        try {
            await putFileText(STORAGE.SCHEDULE_FILE, serialized);
        } catch (e) {
            try { console.warn('[task-horizon] save schedule file failed', e); } catch (e2) {}
            throw e;
        }
        try {
            const scheduleId = String(opts.scheduleId || '').trim();
            const scheduleIds = Array.isArray(opts.scheduleIds)
                ? opts.scheduleIds.map((id) => String(id || '').trim()).filter(Boolean)
                : (scheduleId ? [scheduleId] : []);
            window.dispatchEvent(new CustomEvent('tm:calendar-schedule-updated', {
                detail: {
                    ts: Date.now(),
                    version,
                    reason: String(opts.reason || 'save-schedule-all').trim() || 'save-schedule-all',
                    source: String(opts.source || 'schedule').trim() || 'schedule',
                    op: String(opts.op || 'replace').trim() || 'replace',
                    scheduleId,
                    scheduleIds,
                    rangeStart: String(opts.rangeStart || '').trim(),
                    rangeEnd: String(opts.rangeEnd || '').trim(),
                },
            }));
        } catch (e) {}
        if (!opts.skipDeviceSync && shouldPreferDeviceNotificationBackend()) {
            try { scheduleScheduleMobileSync('save-schedule-all'); } catch (e) {}
        }
        return true;
    }

    function __tmPushCalendarRefreshTrace() {
        return null;
    }

    function __tmRecordCalendarRefreshDebug() {
        return null;
    }

    function __tmCalendarRangeTouchesDayKey(rangeStartMs, rangeEndMs, dayKey) {
        const key = String(dayKey || '').trim();
        if (!key) return false;
        const day = parseDateOnly(key);
        if (!(day instanceof Date) || Number.isNaN(day.getTime())) return false;
        const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0).getTime();
        const dayEnd = dayStart + 86400000;
        const startMs = Number(rangeStartMs);
        const endMs = Number(rangeEndMs);
        if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
            return overlap(startMs, endMs, dayStart, dayEnd);
        }
        if (Number.isFinite(startMs)) {
            return startMs >= dayStart && startMs < dayEnd;
        }
        return false;
    }

    function __tmNormalizeCalendarRefreshDetail(input) {
        const raw = (input && typeof input === 'object') ? input : {};
        const rangeStartMs = (() => {
            const n = toMs(raw.rangeStart || raw.start || raw.startMs);
            return Number.isFinite(n) && n > 0 ? n : 0;
        })();
        const rangeEndMs = (() => {
            const n = toMs(raw.rangeEnd || raw.end || raw.endMs);
            return Number.isFinite(n) && n > 0 ? n : 0;
        })();
        const sideDayDate = (() => {
            if (String(state.sideDay?.dateKey || '').trim()) return null;
            try { return state.sideDay?.calendar?.getDate?.() || null; } catch (e) { return null; }
        })();
        const sideDayKey = String(
            state.sideDay?.dateKey
            || ((sideDayDate instanceof Date && !Number.isNaN(sideDayDate.getTime())) ? formatDateKey(sideDayDate) : '')
        ).trim();
        const autoSide = !!state.sideDay?.calendar && __tmCalendarRangeTouchesDayKey(rangeStartMs, rangeEndMs, sideDayKey);
        return {
            reason: String(raw.reason || 'calendar-refresh').trim() || 'calendar-refresh',
            reasons: Array.isArray(raw.reasons) ? raw.reasons.map((it) => String(it || '').trim()).filter(Boolean) : [],
            hard: raw.hard === true,
            layoutOnly: raw.layoutOnly === true,
            main: raw.main !== false,
            side: raw.side === true || (raw.side !== false && autoSide),
            flushTaskPanel: raw.flushTaskPanel !== false,
            version: Number.isFinite(Number(raw.version)) ? Number(raw.version) : 0,
            rangeStartMs,
            rangeEndMs,
        };
    }

    function __tmMergeCalendarRefreshDetail(prev, next) {
        if (!prev) return __tmNormalizeCalendarRefreshDetail(next);
        const detail = __tmNormalizeCalendarRefreshDetail(next);
        const reasons = [];
        const seen = new Set();
        [prev.reason, ...(Array.isArray(prev.reasons) ? prev.reasons : []), detail.reason, ...(Array.isArray(detail.reasons) ? detail.reasons : [])]
            .map((it) => String(it || '').trim())
            .filter(Boolean)
            .forEach((it) => {
                if (seen.has(it)) return;
                seen.add(it);
                reasons.push(it);
            });
        return {
            reason: reasons[reasons.length - 1] || detail.reason || prev.reason || 'calendar-refresh',
            reasons,
            hard: prev.hard === true || detail.hard === true,
            layoutOnly: prev.layoutOnly === true && detail.layoutOnly === true,
            main: prev.main !== false || detail.main !== false,
            side: prev.side === true || detail.side === true,
            flushTaskPanel: prev.flushTaskPanel !== false || detail.flushTaskPanel !== false,
            version: Math.max(Number(prev.version) || 0, Number(detail.version) || 0),
            rangeStartMs: (() => {
                const vals = [Number(prev.rangeStartMs) || 0, Number(detail.rangeStartMs) || 0].filter((it) => Number.isFinite(it) && it > 0);
                return vals.length ? Math.min(...vals) : 0;
            })(),
            rangeEndMs: (() => {
                const vals = [Number(prev.rangeEndMs) || 0, Number(detail.rangeEndMs) || 0].filter((it) => Number.isFinite(it) && it > 0);
                return vals.length ? Math.max(...vals) : 0;
            })(),
        };
    }

    function __tmApplyCalendarRefreshDetail(detail) {
        const next = __tmNormalizeCalendarRefreshDetail(detail);
        const wrap = state.wrapEl;
        const mainCalendar = state.calendar;
        const sideCalendar = state.sideDay?.calendar || null;
        const settings = getSettings();
        __tmRecordCalendarRefreshDebug('apply', next, {
            hasMain: !!mainCalendar,
            hasSide: !!sideCalendar,
            viewType: String(mainCalendar?.view?.type || '').trim(),
        });
        if (next.flushTaskPanel !== false && wrap) {
            try { scheduleTaskPageRender(wrap, settings); } catch (e) {}
        }
        if (next.main !== false && mainCalendar) {
            try {
                if (next.layoutOnly === true) {
                    if (wrap) applyCalendarSlotHeightStyle(wrap, settings);
                    scheduleMainCalendarLayoutRefresh(wrap, state.calendarEl, mainCalendar, { updateSize: next.hard === true });
                    stabilizeCalendarLayout(mainCalendar, wrap, { hard: next.hard === true });
                } else if (typeof mainCalendar.batchRendering === 'function') {
                    mainCalendar.batchRendering(() => {
                        try { mainCalendar.refetchEvents?.(); } catch (e) {}
                    });
                } else {
                    try { mainCalendar.refetchEvents?.(); } catch (e) {}
                }
            } catch (e) {}
            if (next.layoutOnly !== true) {
                try { scheduleMainCalendarLayoutRefresh(wrap, state.calendarEl, mainCalendar, { updateSize: next.hard === true }); } catch (e) {}
                try { stabilizeCalendarLayout(mainCalendar, wrap, { hard: next.hard === true }); } catch (e) {}
            }
            state.calendarRenderedVersionMain = Math.max(Number(state.calendarRenderedVersionMain) || 0, Number(next.version) || 0);
        }
        if (next.side === true && sideCalendar) {
            try {
                if (next.layoutOnly === true) {
                    refreshSideDayLayout();
                } else if (typeof sideCalendar.batchRendering === 'function') {
                    sideCalendar.batchRendering(() => {
                        try { sideCalendar.refetchEvents?.(); } catch (e) {}
                    });
                } else {
                    try { sideCalendar.refetchEvents?.(); } catch (e) {}
                }
            } catch (e) {}
            if (next.layoutOnly !== true) {
                try { refreshSideDayLayout(); } catch (e) {}
            }
            state.calendarRenderedVersionSide = Math.max(Number(state.calendarRenderedVersionSide) || 0, Number(next.version) || 0);
        }
        state.calendarRefreshLastApplied = { ...next, appliedAt: Date.now() };
        return true;
    }

    function scheduleCalendarRefresh(detail = {}) {
        state.calendarRefreshPending = __tmMergeCalendarRefreshDetail(state.calendarRefreshPending, detail);
        const pending = state.calendarRefreshPending;
        __tmRecordCalendarRefreshDebug('queue', pending, {
            hasTimer: !!state.calendarRefreshTimer,
        });
        if (state.calendarRefreshTimer) return true;
        state.calendarRefreshTimer = setTimeout(() => {
            state.calendarRefreshTimer = null;
            const next = state.calendarRefreshPending;
            state.calendarRefreshPending = null;
            if (!next) return;
            __tmApplyCalendarRefreshDetail(next);
        }, 24);
        return true;
    }

    function refetchAllCalendars(options = {}) {
        return scheduleCalendarRefresh({
            reason: String(options?.reason || 'legacy-refetch').trim() || 'legacy-refetch',
            main: options?.main !== false,
            side: options?.side !== false,
            hard: options?.hard === true,
            layoutOnly: options?.layoutOnly === true,
            flushTaskPanel: options?.flushTaskPanel !== false,
            rangeStart: options?.rangeStart,
            rangeEnd: options?.rangeEnd,
            version: Number(options?.version) || 0,
        });
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

    function scheduleReminderDispatchLockStorageKey(lockKey) {
        return `tm-calendar-schedule-reminder-dispatch:${String(lockKey || '').trim()}`;
    }

    function tryAcquireScheduleReminderDispatchLock(lockKey, ttlMs = 90000) {
        const safeKey = String(lockKey || '').trim();
        if (!safeKey) return true;
        const now = Date.now();
        const expiresAt = now + Math.max(1000, Math.round(Number(ttlMs) || 90000));
        const storageKey = scheduleReminderDispatchLockStorageKey(safeKey);
        try {
            const raw = String(localStorage.getItem(storageKey) || '').trim();
            if (raw) {
                const parsed = JSON.parse(raw);
                const until = Number(parsed?.expiresAt || 0);
                if (Number.isFinite(until) && until > now) return false;
            }
        } catch (e) {}
        try {
            localStorage.setItem(storageKey, JSON.stringify({ expiresAt, updatedAt: now }));
            return true;
        } catch (e) {}
        return true;
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

    function hasOfficialMobileRuntimeSignal() {
        try {
            if (globalThis?.JSAndroid) return true;
        } catch (e) {}
        try {
            if (globalThis?.JSHarmony) return true;
        } catch (e) {}
        try {
            const hasIosBridge = !!globalThis?.webkit?.messageHandlers;
            if (!hasIosBridge) return false;
            const ua = String(navigator?.userAgent || '');
            const maxTouchPoints = Number(navigator?.maxTouchPoints) || 0;
            if (/iPhone|iPad|iPod/i.test(ua)) return true;
            if (maxTouchPoints > 0) return true;
            return true;
        } catch (e) {}
        return false;
    }

    function isMobileBrowserViewport() {
        try {
            if (navigator?.userAgentData?.mobile === true) return true;
        } catch (e) {}
        try {
            const ua = String(navigator?.userAgent || '');
            if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet|HarmonyOS/i.test(ua)) return true;
            if (/Huawei|HUAWEI/.test(ua) && !/Chrome|Chromium|EdgA|Firefox/.test(ua)) return true;
        } catch (e) {}
        try {
            const maxTouchPoints = Number(navigator?.maxTouchPoints) || 0;
            const width = Number(window?.innerWidth) || 0;
            const coarse = !!window?.matchMedia?.('(pointer: coarse)')?.matches;
            if ((coarse || maxTouchPoints > 0) && width > 0 && width <= 900) return true;
        } catch (e) {}
        return false;
    }

    function isLikelyMobileRuntime() {
        try {
            if (globalThis.__taskHorizonPluginIsMobile !== undefined) return !!globalThis.__taskHorizonPluginIsMobile;
        } catch (e) {}
        if (hasOfficialMobileRuntimeSignal()) return true;
        return isMobileBrowserViewport();
    }

    function isNativeMobileRuntime() {
        try {
            if (globalThis.__taskHorizonPluginIsNativeMobile !== undefined) return !!globalThis.__taskHorizonPluginIsNativeMobile;
        } catch (e) {}
        return hasOfficialMobileRuntimeSignal();
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
        return isNativeMobileRuntime() && hasDeviceNotificationBridge();
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
            if (isScheduleOccurrenceDone(item, occurrenceStartMs)) continue;
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
                if (isScheduleOccurrenceDone(item, occurrence?.startMs)) continue;
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
        sr.refreshRunning = false;
        sr.refreshQueued = false;
        sr.pendingReason = '';
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
        if (sr.refreshRunning) {
            sr.refreshQueued = true;
            sr.pendingReason = String(reason || '').trim() || sr.pendingReason || 'refresh';
            return;
        }
        sr.refreshRunning = true;
        try {
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
                    if (isScheduleOccurrenceDone(it, occurrence?.startMs)) continue;
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
                if (isScheduleOccurrenceDone(it, occurrenceStartMs)) continue;
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
                        if (!tryAcquireScheduleReminderDispatchLock(`allday:${dateKey0}:${String(atMs0)}`)) return;
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
                    if (!tryAcquireScheduleReminderDispatchLock(`single:${key}`)) return;
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
        } finally {
            sr.refreshRunning = false;
            if (sr.refreshQueued || sr.pendingReason) {
                const nextReason = sr.pendingReason || String(reason || '').trim() || 'refresh';
                sr.refreshQueued = false;
                sr.pendingReason = '';
                try { scheduleScheduleReminderRefresh(nextReason); } catch (e) {}
            }
        }
    }

    function scheduleScheduleReminderRefresh(reason) {
        const sr = state.scheduleReminder;
        const nextReason = String(reason || '').trim() || 'refresh';
        sr.pendingReason = nextReason;
        if (sr.refreshRunning) {
            sr.refreshQueued = true;
            return;
        }
        if (sr.refreshTimer) return;
        sr.refreshTimer = setTimeout(() => {
            sr.refreshTimer = null;
            const runReason = sr.pendingReason || nextReason;
            sr.pendingReason = '';
            refreshScheduleReminderTimers(runReason).catch(() => null);
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
            try {
                scheduleCalendarRefresh({
                    reason: `shared-file:${String(reason || '').trim() || 'sync'}`,
                    main: true,
                    side: true,
                    flushTaskPanel: true,
                });
            } catch (e) {}
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
        const calendarDefs = getCalendarDefs(settings);
        const calendarColor = String((calendarDefs.find((d) => String(d?.id || '').trim() === calendarId)?.color) || '').trim();
        const preferCalendarColor = base.preferCalendarColor === true;
        let color = String(base.color || '').trim();
        if (!color && preferCalendarColor && calendarColor) color = calendarColor;
        try {
            const store = state.settingsStore || state.sideDay?.settingsStore || null;
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
        await saveScheduleAll(list, {
            reason: 'add-task-schedule',
            op: 'add',
            scheduleId: item.id,
            scheduleIds: [item.id],
            rangeStart: item.start,
            rangeEnd: item.end,
        });
        if (base.refresh !== false) {
            __tmSchedulePostMutationRefresh(item, 'upsert', {
                reason: 'add-task-schedule',
                side: base.side === true,
                flushTaskPanel: true,
                version: Number(state.calendarMutationVersion) || 0,
            });
        }
        return item;
    }

    async function setScheduleOccurrenceDone(scheduleId, occurrenceStartMs, done, options = {}) {
        const sid = String(scheduleId || '').trim();
        const occurrenceKey = normalizeScheduleCompletedOccurrenceKey(occurrenceStartMs);
        if (!sid || !occurrenceKey) throw new Error('invalid schedule occurrence payload');
        const list = await loadScheduleAll();
        const idx = list.findIndex((item) => String(item?.id || '').trim() === sid);
        if (idx < 0) throw new Error('未找到日程');
        const prevItem = (list[idx] && typeof list[idx] === 'object') ? list[idx] : {};
        if (normalizeScheduleRepeatType(getScheduleRepeatType(prevItem)) === 'none') return false;
        const nextDone = done === true;
        const completedSet = getScheduleCompletedOccurrenceSet(prevItem);
        if (nextDone) completedSet.add(occurrenceKey);
        else completedSet.delete(occurrenceKey);
        const nextCompletedOccurrences = Array.from(completedSet).sort((a, b) => Number(a) - Number(b));
        const prevCompletedOccurrences = normalizeScheduleCompletedOccurrences(prevItem.completedOccurrences);
        if (JSON.stringify(prevCompletedOccurrences) === JSON.stringify(nextCompletedOccurrences)) return true;
        const nextItem = {
            ...prevItem,
            completedOccurrences: nextCompletedOccurrences,
        };
        list[idx] = nextItem;
        const opt = (options && typeof options === 'object') ? options : {};
        await saveScheduleAll(list, {
            reason: 'schedule-occurrence-done',
            source: String(opt.source || 'schedule-occurrence').trim() || 'schedule-occurrence',
            op: 'update',
            scheduleId: sid,
            scheduleIds: [sid],
            rangeStart: nextItem.start,
            rangeEnd: nextItem.end,
        });
        if (opt.refresh !== false) {
            scheduleCalendarRefresh({
                reason: 'schedule-occurrence-done',
                main: true,
                side: true,
                flushTaskPanel: false,
                hard: false,
                rangeStart: nextItem.start,
                rangeEnd: nextItem.end,
                version: Number(state.calendarMutationVersion) || 0,
            });
        }
        return true;
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
        try {
            const eventEl = wrapEl?.closest?.('.fc-event');
            eventEl?.classList?.toggle?.('tm-cal-event--done', v);
            applyCalendarEventDoneBorderTone(eventEl, v);
        } catch (e) {}
        const styleNodes = new Set();
        if (titleEl instanceof HTMLElement) styleNodes.add(titleEl);
        try {
            const titleTextEl = wrapEl?.querySelector?.('.tm-cal-task-event-title-text');
            const timeEl = wrapEl?.querySelector?.('.tm-cal-task-event-time');
            if (titleTextEl instanceof HTMLElement) styleNodes.add(titleTextEl);
            if (timeEl instanceof HTMLElement) styleNodes.add(timeEl);
        } catch (e) {}
        styleNodes.forEach((node) => {
            try {
                const isTime = node.classList.contains('tm-cal-task-event-time');
                if (v) {
                    node.style.setProperty('text-decoration', isTime ? 'none' : 'line-through', 'important');
                    node.style.setProperty('opacity', isTime ? '0.72' : '0.9', 'important');
                    node.style.setProperty('color', 'var(--tm-secondary-text, #8a8a8a)', 'important');
                } else {
                    node.style.removeProperty('text-decoration');
                    node.style.removeProperty('opacity');
                    node.style.removeProperty('color');
                }
            } catch (e) {}
        });
    }

    function applyCalendarEventDoneBorderTone(eventEl, done) {
        const el = eventEl instanceof Element ? eventEl : null;
        if (!el) return;
        const nextColor = done
            ? 'color-mix(in srgb, var(--tm-cal-schedule-accent) 36%, var(--tm-border-color) 64%)'
            : 'var(--tm-cal-schedule-stripe, var(--tm-cal-schedule-accent, var(--tm-primary-color)))';
        try { el.style.setProperty('--tm-cal-schedule-stripe', nextColor, 'important'); } catch (e) {}
        try { el.style.setProperty('border-left-color', nextColor, 'important'); } catch (e) {}
    }

    function applyCalendarEventStripeFill(eventEl, stripeWidthPx = 3) {
        const el = eventEl instanceof Element ? eventEl : null;
        if (!el) return;
        const stripeWidth = Math.max(0, Number(stripeWidthPx) || 0);
        const stripeCss = `${stripeWidth}px`;
        const stripeColor = 'var(--tm-cal-schedule-stripe, var(--tm-cal-schedule-accent, var(--tm-primary-color)))';
        const bgColor = 'var(--tm-cal-schedule-bg, transparent)';
        try { el.style.setProperty('border-left', '0', 'important'); } catch (e) {}
        try { el.style.setProperty('padding-left', stripeCss, 'important'); } catch (e) {}
        try { el.style.setProperty('background-color', bgColor, 'important'); } catch (e) {}
        try {
            el.style.setProperty(
                'background-image',
                `linear-gradient(to bottom, ${stripeColor} 0 calc(100% - 1px), transparent calc(100% - 1px)), linear-gradient(${bgColor}, ${bgColor})`,
                'important'
            );
        } catch (e) {}
        try { el.style.setProperty('background-size', `${stripeCss} 100%, 100% 100%`, 'important'); } catch (e) {}
        try { el.style.setProperty('background-position', 'left top, left top', 'important'); } catch (e) {}
        try { el.style.setProperty('background-repeat', 'no-repeat, no-repeat', 'important'); } catch (e) {}
    }

    function isRecurringScheduleEventExt(ext) {
        return String(ext?.__tmSource || '').trim() === 'schedule'
            && normalizeScheduleRepeatType(ext?.__tmRepeatType) !== 'none'
            && !!String(ext?.__tmScheduleId || '').trim()
            && !!normalizeScheduleCompletedOccurrenceKey(ext?.__tmOccurrenceStartMs);
    }

    function resolveCalendarEventDoneState(ext, options = {}) {
        const source = String(ext?.__tmSource || '').trim();
        if (source === 'reminder') return ext?.__tmReminderDone === true;
        if (!(source === 'taskdate' || source === 'schedule')) return false;
        const tid = String(ext?.__tmTaskId || ext?.__tmBlockId || '').trim();
        const opt = (options && typeof options === 'object') ? options : {};
        let taskDone = false;
        if (Object.prototype.hasOwnProperty.call(opt, 'taskDoneOverride')) {
            taskDone = !!opt.taskDoneOverride;
        } else if (tid && typeof window.tmIsTaskDone === 'function') {
            try { taskDone = !!window.tmIsTaskDone(tid); } catch (e) { taskDone = false; }
        }
        if (taskDone) return true;
        if (source === 'schedule' && isRecurringScheduleEventExt(ext)) {
            return ext?.__tmScheduleOccurrenceDone === true;
        }
        return false;
    }

    async function handleCalendarEventCheckboxToggle(cb, wrapEl, titleText, ext, taskId) {
        if (!(cb instanceof HTMLInputElement)) return false;
        const source = String(ext?.__tmSource || '').trim();
        const tid = String(taskId || '').trim();
        const nextDone = cb.checked === true;
        applyTaskDoneVisual(wrapEl, titleText, nextDone);
        try {
            if (source === 'schedule' && isRecurringScheduleEventExt(ext)) {
                const scheduleId = String(ext?.__tmScheduleId || '').trim();
                const occurrenceStartMs = Number(ext?.__tmOccurrenceStartMs);
                const setter = globalThis.__tmCalendar?.setScheduleOccurrenceDone;
                if (!scheduleId || !Number.isFinite(occurrenceStartMs) || typeof setter !== 'function') {
                    throw new Error('循环日程实例状态接口不可用');
                }
                const result = setter(scheduleId, occurrenceStartMs, nextDone, {
                    source: 'calendar-checkbox',
                });
                if (result && typeof result.then === 'function') await result;
                return true;
            }
            if (!tid || typeof window.tmSetDone !== 'function') {
                throw new Error('任务完成接口不可用');
            }
            const scheduleId = source === 'schedule'
                ? String(ext?.__tmScheduleId || '').trim()
                : '';
            const result = window.tmSetDone(tid, nextDone, null, { source: 'calendar', scheduleId });
            if (result && typeof result.then === 'function') await result;
            return true;
        } catch (e) {
            cb.checked = !nextDone;
            applyTaskDoneVisual(wrapEl, titleText, !nextDone);
            throw e;
        }
    }

    function isOtherBlockCalendarEvent(ext) {
        const taskId = String(ext?.__tmTaskId || '').trim();
        const blockId = String(ext?.__tmBlockId || '').trim();
        if (!blockId) return false;
        return !taskId || taskId === blockId;
    }

    function shouldShowCalendarEventCheckbox(ext) {
        if (!isOtherBlockCalendarEvent(ext)) return true;
        return getSettings().showOtherBlockCheckbox === true;
    }

    function applyTaskEventTitleClamp(wrapEl, titleEl, options = {}) {
        try {
            const stacked = !!titleEl?.classList?.contains?.('tm-cal-task-event-title--stack');
            const isTaskWrap = !!wrapEl?.classList?.contains?.('tm-cal-task-event');
            const isScheduleStack = !!wrapEl?.classList?.contains?.('tm-cal-schedule-stack');
            const isBlockWrap = !!wrapEl?.classList?.contains?.('tm-cal-task-event--block')
                || !!wrapEl?.classList?.contains?.('tm-cal-schedule-stack--block');
            const isAllDayWrap = !!wrapEl?.classList?.contains?.('tm-cal-task-event--allday')
                || !!wrapEl?.classList?.contains?.('tm-cal-schedule-stack--allday');
            const hasLeadingSlot = options?.hasLeadingSlot === true
                || !!wrapEl?.querySelector?.('.tm-cal-task-event-leading');
            if (wrapEl instanceof HTMLElement) {
                if (isBlockWrap && hasLeadingSlot) {
                    wrapEl.style.display = 'grid';
                    wrapEl.style.gridTemplateColumns = '14px minmax(0, 1fr)';
                    wrapEl.style.columnGap = '6px';
                    wrapEl.style.rowGap = '0';
                    wrapEl.style.alignItems = stacked ? 'flex-start' : 'center';
                    wrapEl.style.removeProperty('gap');
                } else {
                    wrapEl.style.display = 'flex';
                    wrapEl.style.removeProperty('grid-template-columns');
                    wrapEl.style.removeProperty('column-gap');
                    wrapEl.style.removeProperty('row-gap');
                    wrapEl.style.alignItems = (stacked || isAllDayWrap) ? 'flex-start' : 'center';
                    wrapEl.style.gap = hasLeadingSlot ? (isAllDayWrap ? '4px' : '6px') : '6px';
                }
                if (isTaskWrap) {
                    if (isAllDayWrap) wrapEl.style.padding = '3px 4px 4px 4px';
                    else if (isBlockWrap) wrapEl.style.padding = '1px 4px 1px 4px';
                    else wrapEl.style.padding = stacked ? '1px 4px 1px 2px' : '1px 4px 1px 6px';
                }
                if (isScheduleStack) {
                    wrapEl.style.padding = isAllDayWrap
                        ? '3px 4px 4px 4px'
                        : ((stacked || isBlockWrap) ? '1px 4px 1px 2px' : '1px 4px 1px 5px');
                }
                try {
                    const leadingEl = wrapEl.querySelector('.tm-cal-task-event-leading');
                    if (leadingEl instanceof HTMLElement) {
                        leadingEl.style.marginLeft = isBlockWrap ? '-2px' : '0';
                    }
                } catch (e) {}
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
                // Source of truth:
                // 全天区/“更多”弹层标题字号最终在这里写入 inline style。
                // 这会覆盖 calendar-view.css 和 ensureFcCompactAllDayStyle() 里的同类规则。
                if (isAllDayWrap) {
                    titleEl.style.setProperty('font-size', '11px', 'important');
                    titleEl.style.setProperty('line-height', '1.1', 'important');
                } else {
                    titleEl.style.removeProperty('font-size');
                    titleEl.style.removeProperty('line-height');
                }
            }
            try {
                const titleTextEl = wrapEl?.querySelector?.('.tm-cal-task-event-title-text');
                if (titleTextEl instanceof HTMLElement) {
                    titleTextEl.style.display = 'block';
                    titleTextEl.style.minWidth = '0';
                    titleTextEl.style.maxWidth = '100%';
                    titleTextEl.style.overflow = 'hidden';
                    titleTextEl.style.textOverflow = stacked ? 'clip' : 'ellipsis';
                    titleTextEl.style.whiteSpace = stacked ? 'normal' : 'nowrap';
                    if (isAllDayWrap) {
                        titleTextEl.style.setProperty('font-size', '11px', 'important');
                        titleTextEl.style.setProperty('line-height', '1.1', 'important');
                    } else {
                        titleTextEl.style.removeProperty('font-size');
                        titleTextEl.style.removeProperty('line-height');
                    }
                }
                const timeTextEl = wrapEl?.querySelector?.('.tm-cal-task-event-time');
                if (timeTextEl instanceof HTMLElement) {
                    if (isAllDayWrap) {
                        timeTextEl.style.setProperty('font-size', '10px', 'important');
                        timeTextEl.style.setProperty('line-height', '1.1', 'important');
                    } else {
                        timeTextEl.style.removeProperty('font-size');
                        timeTextEl.style.removeProperty('line-height');
                    }
                }
                if (wrapEl instanceof HTMLElement) {
                    if (isAllDayWrap) {
                        wrapEl.style.setProperty('font-size', '11px', 'important');
                        wrapEl.style.setProperty('line-height', '1.1', 'important');
                    } else {
                        wrapEl.style.removeProperty('font-size');
                        wrapEl.style.removeProperty('line-height');
                    }
                }
            } catch (e) {}
            try {
                const fcTitleEl = wrapEl?.querySelector?.('.fc-event-title');
                if (fcTitleEl instanceof HTMLElement) {
                    if (isAllDayWrap) {
                        fcTitleEl.style.setProperty('font-size', '11px', 'important');
                        fcTitleEl.style.setProperty('line-height', '1.1', 'important');
                    } else {
                        fcTitleEl.style.removeProperty('font-size');
                        fcTitleEl.style.removeProperty('line-height');
                    }
                }
                const fcTimeEl = wrapEl?.querySelector?.('.fc-event-time');
                if (fcTimeEl instanceof HTMLElement) {
                    if (isAllDayWrap) {
                        fcTimeEl.style.setProperty('font-size', '10px', 'important');
                        fcTimeEl.style.setProperty('line-height', '1.1', 'important');
                    } else {
                        fcTimeEl.style.removeProperty('font-size');
                        fcTimeEl.style.removeProperty('line-height');
                    }
                }
            } catch (e) {}
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
            const clampedTitleNodes = new Set();
            const clampedTextNodes = new Set();
            const wraps = rootEl.querySelectorAll?.('.tm-cal-task-event, .tm-cal-schedule-stack');
            if (wraps && wraps.length) {
                wraps.forEach((w) => {
                    const titleNode = w.querySelector?.('.tm-cal-task-event-title') || null;
                    applyTaskEventTitleClamp(
                        w,
                        titleNode,
                        { hasLeadingSlot: !!w.querySelector?.('.tm-cal-task-event-leading') }
                    );
                    if (titleNode instanceof HTMLElement) clampedTitleNodes.add(titleNode);
                    try {
                        w.querySelectorAll?.('.tm-cal-task-event-title-text, .tm-cal-task-event-time')?.forEach?.((node) => {
                            if (node instanceof HTMLElement) clampedTextNodes.add(node);
                        });
                    } catch (e) {}
                });
            }
            const titleNodes = rootEl.querySelectorAll?.('.tm-cal-task-event-title, .fc-event-title');
            if (titleNodes && titleNodes.length) {
                titleNodes.forEach((t) => {
                    if (!(t instanceof HTMLElement)) return;
                    if (clampedTitleNodes.has(t)) return;
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
                    if (clampedTextNodes.has(t)) return;
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
        try { clearTimeGridAutoCenterState('sideDay'); } catch (e) {}
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
        state.sideDay.resizeBox = null;
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
            const color = String(defs.find((d) => String(d?.id || '').trim() === calId)?.color || 'var(--tm-primary-color)').trim() || 'var(--tm-primary-color)';
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
            height: 'parent',
            expandRows: true,
            firstDay: Number(settings.firstDay) === 0 ? 0 : 1,
            headerToolbar: false,
            dayHeaders: false,
            stickyHeaderDates: true,
            nowIndicator: true,
            editable: true,
            eventStartEditable: true,
            eventDurationEditable: true,
            eventResizableFromStart: true,
            selectable: true,
            selectMirror: true,
            fixedMirrorParent: document.body,
            scrollTimeReset: false,
            droppable: true,
            dropAccept: 'tr[data-id], .tm-cal-task, .tm-checklist-item[data-id], .tm-kanban-card[data-id]',
            allDaySlot: true,
            slotEventOverlap: false,
            dayMaxEvents: true,
            moreLinkText: (n) => `+${n}`,
            moreLinkClick: 'popover',
            handleWindowResize: true,
            ...slotLayout,
            dayCellDidMount: normalizeCalendarMonthDayNumberCell,
            eventOrder: 'start,-duration,__tmRank,title',
            eventOrderStrict: true,
            eventClassNames: (arg) => {
                return resolveCalendarEventClassNames(arg);
            },
            eventContent: (arg) => {
                const ext = arg?.event?.extendedProps || {};
                const source = String(ext.__tmSource || '').trim();
                const viewType = String(arg?.view?.type || '').trim();
                const isBlockLike = arg?.event?.allDay === true || viewType.startsWith('dayGrid');
                const hideRangeText = String(arg?.view?.type || '').trim() === 'dayGridMonth';
                if (source === 'taskdate' || (source === 'schedule' && (String(ext.__tmTaskId || '').trim() || String(ext.__tmBlockId || '').trim()))) {
                    const tid = String(ext.__tmTaskId || ext.__tmBlockId || '').trim();
                    const done = resolveCalendarEventDoneState(ext);
                    const isAllDay = arg?.event?.allDay === true;
                    const useAllDayLayout = shouldUseAllDayEventContentLayout(arg);
                    const wrapEl = document.createElement('span');
                    wrapEl.className = source === 'schedule' ? 'tm-cal-task-event tm-cal-task-event--schedule' : 'tm-cal-task-event';
                    if (shouldEnableCalendarEventContextMenu()) {
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
                    }
                    const rangeText = !hideRangeText && source === 'schedule'
                        ? formatScheduleEventRangeText(arg?.event?.start, arg?.event?.end, arg?.event?.allDay === true)
                        : '';
                    const { title, titleText } = buildTaskEventTitleNode(String(arg?.event?.title || '').trim() || '任务', rangeText);
                    if (isBlockLike) wrapEl.classList.add('tm-cal-task-event--block');
                    if (useAllDayLayout) wrapEl.classList.add('tm-cal-task-event--allday');
                    if (rangeText) wrapEl.classList.add('tm-cal-task-event--stacked');
                    let cb = null;
                    let leadingEl = null;
                    if (shouldShowCalendarEventCheckbox(ext)) {
                        cb = document.createElement('input');
                        cb.type = 'checkbox';
                        cb.className = 'tm-cal-task-event-check';
                        cb.checked = done;
                        cb.onclick = (ev) => {
                            try { ev.stopPropagation(); } catch (e) {}
                        };
                        applyTaskEventCheckboxOffset(cb, { allDay: useAllDayLayout, blockLike: isBlockLike });
                        if (rangeText && !isBlockLike && !isAllDay) {
                            try { cb.style.marginTop = '4px'; } catch (e) {}
                        }
                        cb.onchange = async (ev) => {
                            try { ev.stopPropagation(); } catch (e) {}
                            try {
                                await handleCalendarEventCheckboxToggle(cb, wrapEl, titleText, ext, tid);
                            } catch (e) {
                                return;
                            }
                        };
                    }
                    if (isBlockLike) {
                        leadingEl = buildCalendarEventLeadingNode(cb ? '' : 'marker');
                        if (cb) leadingEl.appendChild(cb);
                    }
                    applyTaskEventTitleClamp(wrapEl, title, { hasLeadingSlot: !!leadingEl });
                    applyTaskDoneVisual(wrapEl, titleText, done);
                    titleText.onclick = (ev) => {
                        try { ev.stopPropagation(); } catch (e) {}
                        try { ev.preventDefault(); } catch (e) {}
                        if (!tid) return;
                        try { openCalendarLinkedTask(tid, ev); } catch (e) {}
                    };
                    if (leadingEl) wrapEl.appendChild(leadingEl);
                    else if (cb) wrapEl.appendChild(cb);
                    wrapEl.appendChild(title);
                    return { domNodes: [wrapEl] };
                }
                if (source === 'schedule') {
                    const useAllDayLayout = shouldUseAllDayEventContentLayout(arg);
                    const wrapEl = document.createElement('span');
                    wrapEl.className = 'tm-cal-schedule-stack';
                    if (isBlockLike) wrapEl.classList.add('tm-cal-schedule-stack--block');
                    if (useAllDayLayout) wrapEl.classList.add('tm-cal-schedule-stack--allday');
                    const { title } = buildTaskEventTitleNode(
                        String(arg?.event?.title || '').trim() || '日程',
                        hideRangeText ? '' : formatScheduleEventRangeText(arg?.event?.start, arg?.event?.end, arg?.event?.allDay === true)
                    );
                    const leadingEl = isBlockLike ? buildCalendarEventLeadingNode('marker') : null;
                    applyTaskEventTitleClamp(wrapEl, title, { hasLeadingSlot: !!leadingEl });
                    if (leadingEl) wrapEl.appendChild(leadingEl);
                    wrapEl.appendChild(title);
                    return { domNodes: [wrapEl] };
                }
                if (source === 'reminder') {
                    const done = resolveCalendarEventDoneState(ext);
                    const isAllDay = arg?.event?.allDay === true;
                    const useAllDayLayout = shouldUseAllDayEventContentLayout(arg);
                    const wrapEl = document.createElement('span');
                    wrapEl.className = 'tm-cal-task-event';
                    const tid = String(ext.__tmReminderBlockId || '').trim();
                    const { title, titleText } = buildTaskEventTitleNode(String(arg?.event?.title || '').trim() || '任务提醒');
                    if (isBlockLike) wrapEl.classList.add('tm-cal-task-event--block');
                    if (useAllDayLayout) wrapEl.classList.add('tm-cal-task-event--allday');
                    applyTaskEventTitleClamp(wrapEl, title);
                    applyTaskDoneVisual(wrapEl, titleText, done);
                    titleText.onclick = (ev) => {
                        try { ev.stopPropagation(); } catch (e) {}
                        try { ev.preventDefault(); } catch (e) {}
                        if (!tid) return;
                        try { openCalendarLinkedTask(tid, ev); } catch (e) {}
                    };
                    wrapEl.appendChild(title);
                    return { domNodes: [wrapEl] };
                }
                if (source === 'cnHoliday') {
                    return buildCnHolidayEventContent(arg);
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
                        try { el.classList.toggle('tm-cal-event--done', resolveCalendarEventDoneState(ext)); } catch (e1) {}
                        const eid = String(arg?.event?.id || '').trim();
                        if (eid) el.setAttribute('data-tm-cal-event-id', eid);
                        if (source) el.setAttribute('data-tm-cal-source', source);
                        if (source === 'schedule' || source === 'tomato' || arg?.isMirror) applyScheduleEventColorVars(el, String(arg?.event?.backgroundColor || arg?.event?.borderColor || 'var(--tm-primary-color)'));
                        if (shouldUseAllDaySoftEventVisual(arg, source)) {
                            applyAllDaySoftEventColorVars(el, String(arg?.event?.backgroundColor || arg?.event?.borderColor || 'var(--tm-primary-color)'));
                            normalizeAllDayEventContentLayout(el);
                        }
                        try {
                            const wrapEl = el.querySelector?.('.tm-cal-task-event');
                            const titleEl = wrapEl?.querySelector?.('.tm-cal-task-event-title-text') || wrapEl?.querySelector?.('.tm-cal-task-event-title') || null;
                            if (wrapEl) applyTaskDoneVisual(wrapEl, titleEl, resolveCalendarEventDoneState(ext));
                        } catch (e2) {}
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
                        if (sid && el && !el.__tmScheduleCtxBound && shouldEnableCalendarEventContextMenu()) {
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
                        if (tid && el && !el.__tmTaskCtxBound && shouldEnableCalendarEventContextMenu()) {
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
            eventsSet: () => {
                try { scheduleSyncTimeGridAllDayCollapseUi(rootEl, cal); } catch (e) {}
            },
            eventDragStart: () => {
                try { setCalendarTouchGestureLock(rootEl, true); } catch (e) {}
            },
            eventDragStop: () => {
                try { setCalendarTouchGestureLock(rootEl, false); } catch (e) {}
            },
            eventResizeStart: () => {
                try { setCalendarTouchGestureLock(rootEl, true); } catch (e) {}
            },
            eventResizeStop: () => {
                try { setCalendarTouchGestureLock(rootEl, false); } catch (e) {}
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
                    const [cnHolidayDays, reminders] = await Promise.all([
                        (curSettings.showCnHoliday || curSettings.showLunar)
                            ? Promise.all(years.map((y) => loadCnHolidayYear(y))).then((arr) => arr.flat())
                            : Promise.resolve([]),
                        curSettings.linkDockTomato ? loadReminderBlocks().catch(() => []) : Promise.resolve([]),
                    ]);
                    try {
                        const wantMap = !!(curSettings.showCnHoliday || curSettings.showLunar);
                        state.cnHolidayMap = wantMap ? buildCnHolidayMap(cnHolidayDays, info.start, info.end, !!curSettings.showLunar) : new Map();
                        state.cnHolidaySignature = wantMap
                            ? `${info?.start?.toISOString?.() || ''}|${info?.end?.toISOString?.() || ''}|${cnHolidayDays.length}|${curSettings.showCnHoliday ? 1 : 0}|${curSettings.showLunar ? 1 : 0}`
                            : '';
                        applyCnHolidayDots(rootEl);
                        applyCnLunarLabels(rootEl);
                    } catch (e0) {}
                    const d = curSettings.showCnHoliday ? buildCnHolidayEvents(cnHolidayDays, info.start, info.end, 'timeGridDay', curSettings) : [];
                    const e = buildEventsFromReminders(reminders, info.start, info.end, curSettings);
                    success((d || []).concat(e || []));
                } catch (e) {
                    failure(e);
                }
            },
            eventSources: [
                {
                    id: EVENT_SOURCE_IDS.sideSchedule,
                    events: async (info, success, failure) => {
                        try {
                            const curSettings = getSettings();
                            const events = await __tmBuildScheduleSourceEvents(info.start, info.end, curSettings);
                            success(events);
                        } catch (e) {
                            failure(e);
                        }
                    },
                },
                {
                    id: EVENT_SOURCE_IDS.sideTaskDate,
                    events: async (info, success, failure) => {
                        try {
                            const curSettings = getSettings();
                            const sideViewType = 'timeGridDay';
                            const events = await __tmBuildTaskDateSourceEvents(info.start, info.end, curSettings, sideViewType);
                            success(events);
                        } catch (e) {
                            failure(e);
                        }
                    },
                },
            ],
            eventsSet: () => {
                try {
                    state.calendarRenderedVersionSide = Math.max(
                        Number(state.calendarRenderedVersionSide) || 0,
                        Number(state.calendarMutationVersion) || 0
                    );
                } catch (e) {}
            },
            eventClick: (arg) => {
                const jsEvent = arg?.jsEvent || null;
                const target = jsEvent?.target;
                const interactiveHit = resolveCalendarEventInteractiveHit(jsEvent, { preferredEventEl: arg?.el });
                const hitEventEl = interactiveHit?.eventEl instanceof Element ? interactiveHit.eventEl : null;
                const hitEventId = String(hitEventEl?.getAttribute?.('data-tm-cal-event-id') || '').trim();
                const activeEvent = hitEventId ? (cal?.getEventById?.(hitEventId) || arg?.event || null) : (arg?.event || null);
                try {
                    if (interactiveHit?.kind === 'checkbox') {
                        const checkboxEl = interactiveHit.checkboxEl;
                        if (checkboxEl && target !== checkboxEl && !(target instanceof Element && target.closest('.tm-cal-task-event-check'))) {
                            jsEvent?.preventDefault?.();
                            checkboxEl.click?.();
                        }
                        return;
                    }
                } catch (e0) {}
                try {
                    if (target instanceof Element && target.closest('.tm-cal-task-event-check')) return;
                } catch (e0) {}
                const ext = activeEvent?.extendedProps || {};
                const source = String(ext.__tmSource || '').trim();
                if (source === 'taskdate') {
                    const tid = String(ext.__tmTaskId || '').trim();
                    try {
                        if (tid) openCalendarLinkedTask(tid, jsEvent);
                    } catch (e) {}
                    return;
                }
                if (source === 'reminder') {
                    const tid = String(ext.__tmReminderBlockId || '').trim();
                    try {
                        if (tid) openCalendarLinkedTask(tid, jsEvent);
                    } catch (e) {}
                    return;
                }
                if (interactiveHit?.kind === 'title') {
                    const tid = String(ext.__tmTaskId || '').trim();
                    if (source === 'schedule' && tid) {
                        try { openCalendarLinkedTask(tid, jsEvent); } catch (e) {}
                        return;
                    }
                }
                if (source === 'schedule') {
                    try {
                        const baseStart = String(ext.__tmScheduleBaseStart || '').trim();
                        const baseEnd = String(ext.__tmScheduleBaseEnd || '').trim();
                        openScheduleModal({
                            id: String(ext.__tmScheduleId || activeEvent?.id || ''),
                            title: String(activeEvent?.title || ''),
                            start: baseStart ? new Date(baseStart) : activeEvent?.start,
                            end: baseEnd ? new Date(baseEnd) : activeEvent?.end,
                            allDay: activeEvent?.allDay === true,
                            color: String(activeEvent?.backgroundColor || activeEvent?.borderColor || 'var(--tm-primary-color)'),
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
                    await saveScheduleAll(list, {
                        reason: 'schedule-event-drop',
                        op: 'update',
                        scheduleId: id,
                        scheduleIds: [id],
                        rangeStart: list[idx]?.start,
                        rangeEnd: list[idx]?.end,
                    });
                    __tmSchedulePostMutationRefresh(list[idx], 'upsert', {
                        reason: 'schedule-event-drop',
                        flushTaskPanel: true,
                        version: Number(state.calendarMutationVersion) || 0,
                    });
                    toast('✅ 已更新日程', 'success');
                    return;
                }
                if (source === 'taskdate') {
                    try {
                        if (shouldCreateScheduleFromTaskDateDrop(arg)) {
                            await createScheduleFromTaskDateDrop(arg);
                            toast('✅ 已加入日程', 'success');
                            return;
                        }
                        await persistTaskDateEventChange(arg);
                        toast('✅ 已更新任务日期', 'success');
                    } catch (e) {
                        try { arg.revert(); } catch (e2) {}
                        toast(`❌ 更新任务日期失败：${String(e?.message || e || '')}`, 'error');
                    }
                    return;
                }
                try { arg.revert(); } catch (e) {}
            },
            eventResize: async (arg) => {
                const ext = arg?.event?.extendedProps || {};
                const source = String(ext.__tmSource || '').trim();
                if (source === 'taskdate') {
                    try {
                        await persistTaskDateEventChange(arg);
                        toast('✅ 已更新任务日期', 'success');
                    } catch (e) {
                        try { arg.revert(); } catch (e2) {}
                        toast(`❌ 更新任务日期失败：${String(e?.message || e || '')}`, 'error');
                    }
                    return;
                }
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
                await saveScheduleAll(list, {
                    reason: 'schedule-event-resize',
                    op: 'update',
                    scheduleId: id,
                    scheduleIds: [id],
                    rangeStart: list[idx]?.start,
                    rangeEnd: list[idx]?.end,
                });
                __tmSchedulePostMutationRefresh(list[idx], 'upsert', {
                    reason: 'schedule-event-resize',
                    flushTaskPanel: true,
                    version: Number(state.calendarMutationVersion) || 0,
                });
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
                try { scheduleSyncTimeGridAllDayCollapseUi(rootEl, cal); } catch (e) {}
                try {
                    setTimeout(() => {
                        try { syncSideDayLayout(rootEl, cal, getSettings()); } catch (e2) {}
                        try { scheduleSyncTimeGridAllDayCollapseUi(rootEl, cal); } catch (e2) {}
                    }, 0);
                } catch (e) {}
            },
            viewDidMount: () => {
                try {
                    requestAnimationFrame(() => syncSideDayLayout(rootEl, cal, getSettings()));
                } catch (e) {}
                try { scheduleSyncTimeGridAllDayCollapseUi(rootEl, cal); } catch (e) {}
            },
            loading: (isLoading) => {
                try { rootEl.classList.toggle('tm-cal-view-switching', !!isLoading); } catch (e) {}
                if (isLoading) return;
                try {
                    requestAnimationFrame(() => {
                        try { rootEl.classList.remove('tm-cal-view-switching'); } catch (e3) {}
                        try { syncSideDayLayout(rootEl, cal, getSettings()); } catch (e2) {}
                        try { scheduleSyncTimeGridAllDayCollapseUi(rootEl, cal); } catch (e2) {}
                    });
                } catch (e) {}
            },
        });
        cal.render();
        syncSideDayLayout(rootEl, cal, settings);
        scheduleSyncTimeGridAllDayCollapseUi(rootEl, cal);
        state.sideDay.calendar = cal;
        scheduleClampSideDayPopover(rootEl);

        // 修复：使用 ResizeObserver 监听侧边栏日历容器尺寸变化
        if (rootEl && typeof ResizeObserver === 'function') {
            const sideDayResizeObserver = new ResizeObserver((entries) => {
                const entry = Array.isArray(entries) && entries.length ? entries[0] : null;
                const nextBox = {
                    width: Math.round(Number(entry?.contentRect?.width || rootEl.clientWidth || 0)),
                    height: Math.round(Number(entry?.contentRect?.height || rootEl.clientHeight || 0)),
                };
                const prevBox = state.sideDay?.resizeBox || null;
                if (prevBox && prevBox.width === nextBox.width && prevBox.height === nextBox.height) return;
                state.sideDay.resizeBox = nextBox;
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

    function buildEventsFromSchedule(items, rangeStart, rangeEnd, settings, linkedTaskTitleMap, linkedDocIdMap) {
        if (!settings.showSchedule) return [];
        const defs = getCalendarDefs(settings);
        const defMap = new Map(defs.map((d) => [d.id, d]));
        const registry = shouldPreferDeviceNotificationBackend() ? loadScheduleMobileRegistry() : null;
        const docIdMap = linkedDocIdMap instanceof Map ? linkedDocIdMap : null;
        const out = [];
        for (const it of (Array.isArray(items) ? items : [])) {
            const rs = toMs(it?.start);
            const re = toMs(it?.end);
            if (!Number.isFinite(rs) || !Number.isFinite(re) || re <= rs) continue;
            const start = new Date(rs);
            const end = new Date(re);
            const taskId = String(it?.taskId || it?.task_id || it?.linkedTaskId || it?.linked_task_id || '').trim();
            const blockId = getScheduleLinkedBlockId(it);
            const taskLikeId = taskId || blockId;
            const linkedTitle = (linkedTaskTitleMap instanceof Map && taskId) ? String(linkedTaskTitleMap.get(taskId) || '').trim() : '';
            const titleBase = linkedTitle || (String(it?.title || '').trim() || '日程');
            const calendarId = String(it?.calendarId || 'default');
            if (!isCalendarEnabled(calendarId, settings)) continue;
            const calColor = defMap.get(calendarId)?.color || 'var(--tm-primary-color)';
            const rawColor = String(it?.color || '').trim();
            const preferGroupCalendarColor = !!taskLikeId && String(calendarId || '').trim().startsWith('group:');
            const directDocId = getScheduleLinkedDocId(it);
            const linkedDocId = String(
                directDocId
                || (taskId ? docIdMap?.get(taskId) : '')
                || (blockId ? docIdMap?.get(blockId) : '')
                || ''
            ).trim();
            if (!isCalendarDocVisibleForEvent(calendarId, linkedDocId, settings)) continue;
            const docColor = (settings.scheduleFollowDocColor && linkedDocId)
                ? resolveCalendarDocColor(linkedDocId, '')
                : '';
            const color = docColor || rawColor || (preferGroupCalendarColor ? calColor : (settings.scheduleColor || calColor));
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
            const completedOccurrenceSet = getScheduleCompletedOccurrenceSet(it);
            const occurrences = collectScheduleOccurrencesInRange(it, rangeStart, rangeEnd, {
                limit: String(repeatType || 'none') === 'none' ? 1 : 300,
            });
            for (const occurrence of occurrences) {
                const occStart = occurrence?.start instanceof Date ? occurrence.start : start;
                const occEnd = occurrence?.end instanceof Date ? occurrence.end : end;
                const allDay = allDayBase || isAllDayRange(occStart, occEnd);
                const occStartMs = Number(occurrence?.startMs || occStart.getTime());
                const occurrenceDone = Number.isFinite(occStartMs) && completedOccurrenceSet.has(String(Math.trunc(occStartMs)));
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
                        __tmTaskId: taskLikeId,
                        __tmBlockId: blockId,
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
                        __tmScheduleOccurrenceDone: occurrenceDone,
                        __tmDocId: linkedDocId,
                        calendarId,
                    },
                });
            }
        }
        return out;
    }

    function __tmGetCalendarVisibleRange(calendar) {
        const cal = calendar || null;
        const start = cal?.view?.activeStart instanceof Date ? cal.view.activeStart : (cal?.view?.currentStart instanceof Date ? cal.view.currentStart : null);
        const end = cal?.view?.activeEnd instanceof Date ? cal.view.activeEnd : (cal?.view?.currentEnd instanceof Date ? cal.view.currentEnd : null);
        if (!(start instanceof Date) || Number.isNaN(start.getTime()) || !(end instanceof Date) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
            return null;
        }
        return { start, end };
    }

    function __tmBuildSingleScheduleEventsForCalendar(item, calendar, settings) {
        const range = __tmGetCalendarVisibleRange(calendar);
        if (!range) return [];
        const taskId = String(item?.taskId || item?.task_id || item?.linkedTaskId || item?.linked_task_id || '').trim();
        const blockId = getScheduleLinkedBlockId(item);
        const directDocId = getScheduleLinkedDocId(item);
        const docMap = new Map();
        if (directDocId) {
            if (taskId) docMap.set(taskId, directDocId);
            if (blockId) docMap.set(blockId, directDocId);
        }
        return buildEventsFromSchedule([item], range.start, range.end, settings, new Map(), docMap);
    }

    function __tmApplyScheduleExtendedPropsInPlace(eventApi, nextEvent) {
        if (!eventApi || typeof eventApi.setExtendedProp !== 'function') return false;
        const ext = (nextEvent && typeof nextEvent === 'object' && nextEvent.extendedProps && typeof nextEvent.extendedProps === 'object')
            ? nextEvent.extendedProps
            : {};
        const keys = [
            '__tmSource',
            '__tmScheduleId',
            '__tmTaskId',
            '__tmBlockId',
            '__tmRank',
            '__tmReminderMode',
            '__tmReminderEnabled',
            '__tmReminderOffsetMin',
            '__tmNotificationSchedules',
            '__tmRepeatType',
            '__tmRepeatEvery',
            '__tmRepeatUntil',
            '__tmRepeatMonthlyMode',
            '__tmScheduleBaseStart',
            '__tmScheduleBaseEnd',
            '__tmOccurrenceStartMs',
            '__tmScheduleOccurrenceDone',
            '__tmDocId',
            'calendarId',
        ];
        keys.forEach((key) => {
            try { eventApi.setExtendedProp(key, Object.prototype.hasOwnProperty.call(ext, key) ? ext[key] : null); } catch (e) {}
        });
        return true;
    }

    function __tmFindCalendarEventsByScheduleId(calendar, scheduleId) {
        const cal = calendar || null;
        const sid = String(scheduleId || '').trim();
        if (!cal || !sid || typeof cal.getEvents !== 'function') return [];
        try {
            return cal.getEvents().filter((eventApi) => {
                const ext = eventApi?.extendedProps || {};
                return String(ext.__tmScheduleId || '').trim() === sid;
            });
        } catch (e) {
            return [];
        }
    }

    function __tmSyncCalendarUiAfterDirectEventMutation(calendar) {
        const cal = calendar || null;
        if (!cal) return false;
        if (cal === state.calendar) {
            try { scheduleSyncTimeGridAllDayCollapseUi(state.calendarEl, cal); } catch (e) {}
            try { scheduleMainCalendarLayoutRefresh(state.wrapEl, state.calendarEl, cal, { updateSize: false }); } catch (e) {}
            return true;
        }
        if (cal === state.sideDay?.calendar) {
            try { scheduleSyncTimeGridAllDayCollapseUi(state.sideDay.rootEl, cal); } catch (e) {}
            try { refreshSideDayLayout(); } catch (e) {}
            return true;
        }
        return false;
    }

    function __tmPatchVisibleSingleScheduleInCalendar(calendar, item, action, settings) {
        const cal = calendar || null;
        const scheduleId = String(item?.id || '').trim();
        if (!cal || !scheduleId) return { touched: false, needsRefresh: false };
        if (String(getScheduleRepeatType(item)).trim() !== 'none') {
            if (action === 'delete') {
                const recurringEvents = __tmFindCalendarEventsByScheduleId(cal, scheduleId);
                if (recurringEvents.length > 0) {
                    recurringEvents.forEach((eventApi) => {
                        try { eventApi.remove?.(); } catch (e) {}
                    });
                    __tmSyncCalendarUiAfterDirectEventMutation(cal);
                    return { touched: true, needsRefresh: false };
                }
                return { touched: false, needsRefresh: false };
            }
            return { touched: false, needsRefresh: true };
        }
        const visibleRange = __tmGetCalendarVisibleRange(cal);
        const overlaps = !!(visibleRange && hasScheduleOccurrenceInRange(item, visibleRange.start, visibleRange.end));
        const eventApi = cal.getEventById?.(scheduleId) || null;
        if (action === 'delete') {
            if (eventApi) {
                try { eventApi.remove?.(); } catch (e) {}
                __tmSyncCalendarUiAfterDirectEventMutation(cal);
                return { touched: true, needsRefresh: false };
            }
            return { touched: false, needsRefresh: overlaps };
        }
        if (!eventApi) {
            return { touched: false, needsRefresh: overlaps };
        }
        const nextEvent = __tmBuildSingleScheduleEventsForCalendar(item, cal, settings)
            .find((entry) => String(entry?.id || '').trim() === scheduleId) || null;
        if (!nextEvent) {
            try { eventApi.remove?.(); } catch (e) {}
            __tmSyncCalendarUiAfterDirectEventMutation(cal);
            return { touched: true, needsRefresh: false };
        }
        try { eventApi.setProp?.('title', String(nextEvent.title || '').trim() || '日程'); } catch (e) {}
        try { eventApi.setProp?.('backgroundColor', String(nextEvent.backgroundColor || nextEvent.borderColor || 'var(--tm-primary-color)')); } catch (e) {}
        try { eventApi.setProp?.('borderColor', String(nextEvent.borderColor || nextEvent.backgroundColor || 'var(--tm-primary-color)')); } catch (e) {}
        try {
            if (Array.isArray(nextEvent.classNames) && typeof eventApi.setProp === 'function') {
                eventApi.setProp('classNames', nextEvent.classNames.slice());
            }
        } catch (e) {}
        try { eventApi.setDates?.(nextEvent.start, nextEvent.end, { allDay: nextEvent.allDay === true }); } catch (e) {}
        try { __tmApplyScheduleExtendedPropsInPlace(eventApi, nextEvent); } catch (e) {}
        return { touched: true, needsRefresh: false };
    }

    function __tmPatchVisibleSingleScheduleInPlace(item, action = 'upsert') {
        const settings = getSettings();
        const calendars = [
            { key: 'main', calendar: state.calendar || null },
            { key: 'side', calendar: state.sideDay?.calendar || null },
        ];
        const summary = {
            touchedMain: false,
            touchedSide: false,
            needsMainRefresh: false,
            needsSideRefresh: false,
        };
        calendars.forEach((entry) => {
            const cal = entry.calendar;
            if (!cal) return;
            let result = { touched: false, needsRefresh: false };
            try {
                if (typeof cal.batchRendering === 'function') {
                    cal.batchRendering(() => {
                        result = __tmPatchVisibleSingleScheduleInCalendar(cal, item, action, settings);
                    });
                } else {
                    result = __tmPatchVisibleSingleScheduleInCalendar(cal, item, action, settings);
                }
            } catch (e) {
                result = { touched: false, needsRefresh: true };
            }
            if (entry.key === 'main') {
                summary.touchedMain = result.touched === true;
                summary.needsMainRefresh = result.needsRefresh === true;
            } else if (entry.key === 'side') {
                summary.touchedSide = result.touched === true;
                summary.needsSideRefresh = result.needsRefresh === true;
            }
        });
        return summary;
    }

    function __tmRefetchScheduleSources(options = {}) {
        const opt = (options && typeof options === 'object') ? options : {};
        return {
            main: opt.main === true && !!state.calendar
                ? __tmRefetchCalendarSource(state.calendar, EVENT_SOURCE_IDS.mainSchedule)
                : false,
            side: opt.side === true && !!state.sideDay?.calendar
                ? __tmRefetchCalendarSource(state.sideDay.calendar, EVENT_SOURCE_IDS.sideSchedule)
                : false,
        };
    }

    function __tmSchedulePostMutationRefresh(item, action, options = {}) {
        const opt = (options && typeof options === 'object') ? options : {};
        const patchSummary = item ? __tmPatchVisibleSingleScheduleInPlace(item, action) : {
            touchedMain: false,
            touchedSide: false,
            needsMainRefresh: opt.main !== false,
            needsSideRefresh: opt.side === true,
        };
        let needsMainRefresh = opt.main === true ? true : (patchSummary.needsMainRefresh === true);
        let needsSideRefresh = opt.side === true ? true : (patchSummary.needsSideRefresh === true);
        if (opt.hard !== true) {
            const refetchResult = __tmRefetchScheduleSources({
                main: needsMainRefresh && opt.main !== true,
                side: needsSideRefresh && opt.side !== true,
            });
            if (refetchResult.main) needsMainRefresh = false;
            if (refetchResult.side) needsSideRefresh = false;
        }
        if (!needsMainRefresh && !needsSideRefresh) {
            if (opt.flushTaskPanel !== false && state.wrapEl) {
                try { scheduleTaskPageRender(state.wrapEl, getSettings()); } catch (e) {}
            }
            return patchSummary;
        }
        scheduleCalendarRefresh({
            reason: String(opt.reason || 'schedule-mutation').trim() || 'schedule-mutation',
            main: needsMainRefresh,
            side: needsSideRefresh,
            flushTaskPanel: opt.flushTaskPanel !== false,
            hard: opt.hard === true,
            rangeStart: opt.rangeStart || item?.start,
            rangeEnd: opt.rangeEnd || item?.end,
            version: Number(opt.version) || (Number(state.calendarMutationVersion) || 0),
        });
        return patchSummary;
    }

    function buildScheduleTaskDayKeySet(items, rangeStart, rangeEnd) {
        const out = new Set();
        const list = Array.isArray(items) ? items : [];
        for (const it of list) {
            const taskId = String(it?.taskId || it?.task_id || it?.linkedTaskId || it?.linked_task_id || '').trim();
            const blockId = getScheduleLinkedBlockId(it);
            const aliasIds = Array.from(new Set([taskId, blockId].filter((v) => !!String(v || '').trim())));
            if (!aliasIds.length) continue;
            const repeatType = getScheduleRepeatType(it);
            const occurrences = collectScheduleOccurrencesInRange(it, rangeStart, rangeEnd, {
                limit: String(repeatType || 'none') === 'none' ? 1 : 300,
            });
            for (const occurrence of occurrences) {
                const start = occurrence?.start instanceof Date ? occurrence.start : new Date(toMs(it?.start));
                const end = occurrence?.end instanceof Date ? occurrence.end : new Date(toMs(it?.end));
                if (!(start instanceof Date) || Number.isNaN(start.getTime())) continue;
                const startMs = start.getTime();
                const endMs0 = (end instanceof Date && !Number.isNaN(end.getTime())) ? end.getTime() : (startMs + 30 * 60000);
                const endMs = Math.max(startMs + 1, endMs0);
                const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0, 0);
                const endDayDate = new Date(endMs - 1);
                const endDay = new Date(endDayDate.getFullYear(), endDayDate.getMonth(), endDayDate.getDate(), 12, 0, 0, 0);
                let guard = 0;
                while (cursor.getTime() <= endDay.getTime() && guard < 370) {
                    const dayKey = formatDateKey(cursor);
                    for (const aliasId of aliasIds) {
                        out.add(`${aliasId}|${dayKey}`);
                    }
                    cursor.setDate(cursor.getDate() + 1);
                    guard += 1;
                }
            }
        }
        return out;
    }

    function hasTaskScheduleOverlapInDateRange(taskId, startKey, endExKey, scheduleTaskDaySet) {
        const tid = String(taskId || '').trim();
        if (!tid || !(scheduleTaskDaySet instanceof Set)) return false;
        const start = parseDateOnly(startKey);
        const endEx = parseDateOnly(endExKey);
        if (!(start instanceof Date) || Number.isNaN(start.getTime())) return false;
        if (!(endEx instanceof Date) || Number.isNaN(endEx.getTime()) || endEx.getTime() <= start.getTime()) return false;
        const cursor = new Date(start.getTime());
        let guard = 0;
        while (cursor.getTime() < endEx.getTime() && guard < 370) {
            if (scheduleTaskDaySet.has(`${tid}|${formatDateKey(cursor)}`)) return true;
            cursor.setDate(cursor.getDate() + 1);
            guard += 1;
        }
        return false;
    }

    function buildEventsFromTaskDates(items, settings, options = {}) {
        if (!settings.showTaskDates) return [];
        const scheduleTaskDaySet = (options && options.scheduleTaskDaySet instanceof Set)
            ? options.scheduleTaskDaySet
            : null;
        const defs = getCalendarDefs(settings);
        const defMap = new Map(defs.map((d) => [d.id, d]));
        return (Array.isArray(items) ? items : []).map((it) => {
            const taskId = String(it?.id || '').trim();
            const title = String(it?.title || '').trim() || '任务';
            const startKey = String(it?.start || '').trim();
            const endExKey = String(it?.endExclusive || '').trim();
            const sourceStartKey = String(it?.sourceStart || '').trim();
            const sourceCompletionKey = String(it?.sourceCompletion || '').trim();
            const isMilestone = it?.milestone === true;
            const calendarId = String(it?.calendarId || 'default').trim() || 'default';
            const docId = String(it?.docId || it?.rootId || it?.root_id || '').trim();
            if (!taskId || !startKey || !endExKey) return null;
            if (!isCalendarEnabled(calendarId, settings)) return null;
            if (!isCalendarDocVisibleForEvent(calendarId, docId, settings)) return null;
            if (hasTaskScheduleOverlapInDateRange(taskId, startKey, endExKey, scheduleTaskDaySet)) return null;
            const calColor = defMap.get(calendarId)?.color || '#6b7280';
            const mode = String(settings.taskDateColorMode || 'group').trim() || 'group';
            const docColor = (settings.scheduleFollowDocColor && docId)
                ? resolveCalendarDocColor(docId, '')
                : '';
            const bg = docColor || ((mode === 'group') ? calColor : (settings.taskDatesColor || '#6b7280'));
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
                    __tmTaskDateSourceStartKey: sourceStartKey,
                    __tmTaskDateSourceCompletionKey: sourceCompletionKey,
                    __tmTaskDateMilestone: isMilestone,
                    __tmDocId: docId,
                    calendarId,
                },
            };
        }).filter(Boolean);
    }

    function __tmUpdateMainCalendarStatus(patch = {}) {
        const prev = (state.mainCalendarStatus && typeof state.mainCalendarStatus === 'object')
            ? state.mainCalendarStatus
            : {};
        const next = {
            records: Number(patch.records ?? prev.records ?? 0) || 0,
            schedules: Number(patch.schedules ?? prev.schedules ?? 0) || 0,
            taskDates: Number(patch.taskDates ?? prev.taskDates ?? 0) || 0,
            holidays: Number(patch.holidays ?? prev.holidays ?? 0) || 0,
            reminders: Number(patch.reminders ?? prev.reminders ?? 0) || 0,
            rawTotal: Number(patch.rawTotal ?? prev.rawTotal ?? 0) || 0,
            bad: Number(patch.bad ?? prev.bad ?? 0) || 0,
            minTxt: String(patch.minTxt ?? prev.minTxt ?? '-').trim() || '-',
            maxTxt: String(patch.maxTxt ?? prev.maxTxt ?? '-').trim() || '-',
            rangeStart: String(patch.rangeStart ?? prev.rangeStart ?? '').trim(),
            rangeEnd: String(patch.rangeEnd ?? prev.rangeEnd ?? '').trim(),
        };
        next.total = next.records + next.schedules + next.taskDates + next.holidays + next.reminders;
        state.mainCalendarStatus = next;
        const statusEl = state.wrapEl?.querySelector?.('[data-tm-cal-role="status"]');
        if (statusEl instanceof HTMLElement) {
            statusEl.textContent = `事件: ${next.total}（番茄:${next.records} 文档:${next.schedules} 跨天:${next.taskDates} 节假:${next.holidays} 提醒:${next.reminders} 原始:${next.rawTotal} 异常:${next.bad} 范围:${next.minTxt}~${next.maxTxt}）`;
        }
        return next;
    }

    async function __tmBuildScheduleSourceEvents(rangeStart, rangeEnd, settings) {
        const start = rangeStart instanceof Date ? rangeStart : null;
        const end = rangeEnd instanceof Date ? rangeEnd : null;
        if (!(start instanceof Date) || Number.isNaN(start.getTime()) || !(end instanceof Date) || Number.isNaN(end.getTime())) return [];
        const schedules = await loadScheduleForRange(start, end);
        if (!Array.isArray(schedules) || schedules.length === 0) return [];
        const [scheduleTaskTitleMap, scheduleTaskDocIdMap] = await Promise.all([
            __tmBuildScheduleLinkedTaskTitleMap(schedules).catch(() => new Map()),
            buildScheduleLinkedDocIdMap(schedules).catch(() => new Map()),
        ]);
        return buildEventsFromSchedule(schedules, start, end, settings, scheduleTaskTitleMap, scheduleTaskDocIdMap);
    }

    async function __tmBuildTaskDateSourceEvents(rangeStart, rangeEnd, settings, viewType) {
        const view = String(viewType || '').trim();
        const start = rangeStart instanceof Date ? rangeStart : null;
        const end = rangeEnd instanceof Date ? rangeEnd : null;
        if (!(start instanceof Date) || Number.isNaN(start.getTime()) || !(end instanceof Date) || Number.isNaN(end.getTime())) return [];
        const rangeSpanDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
        const isTimeGridRange = isTimeGridViewType(view);
        const shouldApplyMonthTaskDateDedupe = rangeSpanDays >= 27 || view === 'dayGridMonth';
        const [taskDates, schedules] = await Promise.all([
            (settings.showTaskDates && typeof window.tmQueryCalendarTaskDateEvents === 'function')
                ? Promise.resolve().then(() => window.tmQueryCalendarTaskDateEvents(start, end)).catch(() => [])
                : Promise.resolve([]),
            loadScheduleForRange(start, end).catch(() => []),
        ]);
        const scheduleTaskDaySet = (shouldApplyMonthTaskDateDedupe || (isTimeGridRange && settings.hideScheduledTaskDatesInAllDay))
            ? buildScheduleTaskDayKeySet(schedules, start, end)
            : null;
        return buildEventsFromTaskDates(taskDates, settings, { scheduleTaskDaySet });
    }

    function __tmRefetchCalendarSource(calendar, sourceId) {
        const cal = calendar || null;
        const id = String(sourceId || '').trim();
        if (!cal || !id) return false;
        try {
            const source = cal.getEventSourceById?.(id) || null;
            if (!source || typeof source.refetch !== 'function') return false;
            source.refetch();
            return true;
        } catch (e) {
            return false;
        }
    }

    async function __tmBuildVisibleTaskDateEvent(taskId, calendar, settings) {
        const tid = String(taskId || '').trim();
        const cal = calendar || null;
        if (!tid || !cal || typeof window.tmQueryCalendarTaskDateEvents !== 'function') return null;
        const range = __tmGetCalendarVisibleRange(cal);
        if (!range) return null;
        const viewType = String(cal?.view?.type || '').trim();
        const rangeSpanDays = Math.max(0, Math.round((range.end.getTime() - range.start.getTime()) / 86400000));
        const isTimeGridRange = isTimeGridViewType(viewType);
        const shouldApplyMonthTaskDateDedupe = rangeSpanDays >= 27 || viewType === 'dayGridMonth';
        let scheduleTaskDaySet = null;
        if (shouldApplyMonthTaskDateDedupe || (isTimeGridRange && settings.hideScheduledTaskDatesInAllDay)) {
            try {
                const schedules = await loadScheduleForRange(range.start, range.end);
                scheduleTaskDaySet = buildScheduleTaskDayKeySet(schedules, range.start, range.end);
            } catch (e) {}
        }
        const taskDates = await Promise.resolve()
            .then(() => window.tmQueryCalendarTaskDateEvents(range.start, range.end))
            .catch(() => []);
        const single = (Array.isArray(taskDates) ? taskDates : []).filter((item) => String(item?.id || '').trim() === tid);
        if (!single.length) return null;
        const events = buildEventsFromTaskDates(single, settings, { scheduleTaskDaySet });
        return events.find((item) => String(item?.id || '').trim() === `taskdate:${tid}`) || null;
    }

    function __tmApplyTaskDateEventProps(eventApi, nextEvent) {
        if (!eventApi || !nextEvent) return false;
        try { eventApi.setProp?.('title', String(nextEvent.title || '').trim() || '任务'); } catch (e) {}
        try { eventApi.setProp?.('backgroundColor', String(nextEvent.backgroundColor || nextEvent.borderColor || '#6b7280')); } catch (e) {}
        try { eventApi.setProp?.('borderColor', String(nextEvent.borderColor || nextEvent.backgroundColor || '#6b7280')); } catch (e) {}
        try { eventApi.setProp?.('textColor', String(nextEvent.textColor || '#fff')); } catch (e) {}
        try {
            if (Array.isArray(nextEvent.classNames)) {
                eventApi.setProp?.('classNames', nextEvent.classNames.slice());
            }
        } catch (e) {}
        try { eventApi.setDates?.(nextEvent.start, nextEvent.end, { allDay: nextEvent.allDay === true }); } catch (e) {}
        return true;
    }

    async function __tmPatchTaskDateInCalendar(calendar, taskId, settings) {
        const cal = calendar || null;
        const tid = String(taskId || '').trim();
        if (!cal || !tid) return { touched: false, needsRefresh: false };
        const eventId = `taskdate:${tid}`;
        const existing = cal.getEventById?.(eventId) || null;
        let nextEvent = null;
        try {
            nextEvent = await __tmBuildVisibleTaskDateEvent(tid, cal, settings);
        } catch (e) {
            return { touched: false, needsRefresh: true };
        }
        if (!existing && !nextEvent) return { touched: false, needsRefresh: false };
        if (existing && !nextEvent) {
            try { existing.remove?.(); } catch (e) {}
            return { touched: true, needsRefresh: false };
        }
        if (!existing && nextEvent) {
            try { cal.addEvent?.(nextEvent); } catch (e) { return { touched: false, needsRefresh: true }; }
            return { touched: true, needsRefresh: false };
        }
        try { __tmApplyTaskDateEventProps(existing, nextEvent); } catch (e) { return { touched: false, needsRefresh: true }; }
        return { touched: true, needsRefresh: false };
    }

    async function syncTaskDateInPlace(taskId, options = {}) {
        const tid = String(taskId || '').trim();
        if (!tid) return { touched: false, needsMainRefresh: false, needsSideRefresh: false };
        const opt = (options && typeof options === 'object') ? options : {};
        const settings = getSettings();
        const targets = [];
        if (opt.main !== false && state.calendar) targets.push({ key: 'main', calendar: state.calendar, sourceId: EVENT_SOURCE_IDS.mainTaskDate });
        if (opt.side !== false && state.sideDay?.calendar && state.sideDay.calendar !== state.calendar) targets.push({ key: 'side', calendar: state.sideDay.calendar, sourceId: EVENT_SOURCE_IDS.sideTaskDate });
        const summary = { touched: false, needsMainRefresh: false, needsSideRefresh: false };
        for (const target of targets) {
            let result = { touched: false, needsRefresh: false };
            try {
                if (typeof target.calendar?.batchRendering === 'function') {
                    result = await new Promise((resolve) => {
                        target.calendar.batchRendering(async () => {
                            try { resolve(await __tmPatchTaskDateInCalendar(target.calendar, tid, settings)); } catch (e) { resolve({ touched: false, needsRefresh: true }); }
                        });
                    });
                } else {
                    result = await __tmPatchTaskDateInCalendar(target.calendar, tid, settings);
                }
            } catch (e) {
                result = { touched: false, needsRefresh: true };
            }
            if (result.needsRefresh === true) {
                const refetched = __tmRefetchCalendarSource(target.calendar, target.sourceId);
                result = {
                    touched: refetched,
                    needsRefresh: !refetched,
                };
            }
            summary.touched = summary.touched || result.touched === true;
            if (target.key === 'main') summary.needsMainRefresh = result.needsRefresh === true;
            if (target.key === 'side') summary.needsSideRefresh = result.needsRefresh === true;
        }
        return summary;
    }

    function toLocalDateKey(value) {
        if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';
        return formatDateKey(new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0));
    }

    function shiftDateKey(dateKey, deltaDays) {
        const base = parseDateOnly(dateKey);
        if (!(base instanceof Date) || Number.isNaN(base.getTime())) return '';
        const delta = Number.isFinite(Number(deltaDays)) ? Math.trunc(Number(deltaDays)) : 0;
        base.setDate(base.getDate() + delta);
        return formatDateKey(base);
    }

    function buildTaskDatePatchFromEvent(eventApi) {
        const ext = eventApi?.extendedProps || {};
        const taskId = String(ext.__tmTaskId || '').trim();
        const start = eventApi?.start instanceof Date ? eventApi.start : null;
        if (!taskId || !(start instanceof Date) || Number.isNaN(start.getTime())) return null;
        if (eventApi?.allDay !== true) throw new Error('任务日期事件仅支持按天调整');
        const startKey = toLocalDateKey(start);
        if (!startKey) return null;
        const end0 = eventApi?.end instanceof Date ? eventApi.end : null;
        let endExclusiveKey = '';
        if (end0 instanceof Date && !Number.isNaN(end0.getTime()) && end0.getTime() > start.getTime()) {
            endExclusiveKey = toLocalDateKey(end0);
        }
        if (!endExclusiveKey || endExclusiveKey <= startKey) {
            endExclusiveKey = shiftDateKey(startKey, 1);
        }
        const endKey = shiftDateKey(endExclusiveKey, -1) || startKey;
        const sourceStartKey = String(ext.__tmTaskDateSourceStartKey || '').trim();
        const sourceCompletionKey = String(ext.__tmTaskDateSourceCompletionKey || '').trim();
        const hasSourceStart = !!sourceStartKey;
        const hasSourceCompletion = !!sourceCompletionKey;
        const isMilestone = ext.__tmTaskDateMilestone === true;

        let nextStart = '';
        let nextEnd = '';
        if (isMilestone && hasSourceCompletion) {
            nextStart = hasSourceStart ? sourceStartKey : '';
            nextEnd = endKey || startKey;
            if (nextStart && nextEnd && nextStart > nextEnd) nextStart = nextEnd;
        } else if (hasSourceStart && hasSourceCompletion) {
            nextStart = startKey;
            nextEnd = endKey;
        } else if (hasSourceStart) {
            nextStart = startKey;
            nextEnd = startKey !== endKey ? endKey : '';
        } else if (hasSourceCompletion) {
            nextStart = startKey !== endKey ? startKey : '';
            nextEnd = endKey;
        } else {
            nextStart = startKey;
            nextEnd = endKey;
        }

        return {
            taskId,
            startDate: nextStart,
            completionTime: nextEnd,
            startKey,
            endExclusiveKey,
        };
    }

    function syncTaskDateEventExtendedProps(eventApi, patch) {
        if (!eventApi || typeof eventApi.setExtendedProp !== 'function' || !patch || typeof patch !== 'object') return;
        try { eventApi.setExtendedProp('__tmTaskDateStartKey', String(patch.startKey || '').trim()); } catch (e) {}
        try { eventApi.setExtendedProp('__tmTaskDateEndExclusiveKey', String(patch.endExclusiveKey || '').trim()); } catch (e) {}
        try { eventApi.setExtendedProp('__tmTaskDateSourceStartKey', String(patch.startDate || '').trim()); } catch (e) {}
        try { eventApi.setExtendedProp('__tmTaskDateSourceCompletionKey', String(patch.completionTime || '').trim()); } catch (e) {}
    }

    async function persistTaskDateEventChange(arg) {
        const patch = buildTaskDatePatchFromEvent(arg?.event);
        if (!patch) throw new Error('无效的任务日期事件');
        if (typeof window.tmUpdateTaskDates !== 'function') throw new Error('未检测到任务日期更新接口');
        await window.tmUpdateTaskDates(patch.taskId, {
            startDate: patch.startDate,
            completionTime: patch.completionTime,
        }, { refresh: false });
        syncTaskDateEventExtendedProps(arg?.event, patch);
        try {
            scheduleCalendarRefresh({
                reason: 'taskdate-event-change',
                main: true,
                side: true,
                flushTaskPanel: true,
                rangeStart: patch.startDate || patch.startKey,
                rangeEnd: patch.completionTime || patch.endExclusiveKey,
            });
        } catch (e) {}
        return patch;
    }

    function shouldCreateScheduleFromTaskDateDrop(arg) {
        const eventApi = arg?.event;
        const start = eventApi?.start instanceof Date ? eventApi.start : null;
        if (!(start instanceof Date) || Number.isNaN(start.getTime())) return false;
        const end0 = eventApi?.end instanceof Date ? eventApi.end : null;
        const end = (end0 instanceof Date && !Number.isNaN(end0.getTime()) && end0.getTime() > start.getTime())
            ? end0
            : new Date(start.getTime() + 60 * 60000);
        return !(eventApi?.allDay === true && isAllDayRange(start, end));
    }

    async function createScheduleFromTaskDateDrop(arg) {
        const eventApi = arg?.event;
        const ext = eventApi?.extendedProps || {};
        const taskId = String(ext.__tmTaskId || '').trim();
        const start = eventApi?.start instanceof Date ? eventApi.start : null;
        if (!taskId || !(start instanceof Date) || Number.isNaN(start.getTime())) {
            throw new Error('无效的任务日期事件');
        }
        const settings = getSettings();
        let dragMeta = null;
        try {
            dragMeta = (typeof window.tmCalendarGetTaskDragMeta === 'function')
                ? window.tmCalendarGetTaskDragMeta(taskId)
                : null;
        } catch (e) {}
        const durationMin = clampNewScheduleDurationMin(Number(dragMeta?.durationMin), settings);
        const end0 = eventApi?.end instanceof Date ? eventApi.end : null;
        const end = (end0 instanceof Date && !Number.isNaN(end0.getTime()) && end0.getTime() > start.getTime())
            ? end0
            : new Date(start.getTime() + durationMin * 60000);
        const title = String(eventApi?.title || dragMeta?.title || '').trim() || '任务';
        const calendarId = String(dragMeta?.calendarId || ext.calendarId || '').trim() || pickDefaultCalendarId(settings);
        const defs = getCalendarDefs(settings);
        const sourceColor = String(
            eventApi?.backgroundColor
            || eventApi?.borderColor
            || defs.find((d) => String(d?.id || '').trim() === calendarId)?.color
            || ''
        ).trim();
        const item = await addTaskSchedule({
            taskId,
            title,
            start,
            end,
            calendarId,
            color: sourceColor,
            durationMin,
            allDay: false,
        });
        try { arg?.revert?.(); } catch (e) {}
        return item;
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
        const monthCells = Array.from(root.querySelectorAll('.fc-daygrid-day[data-date]'));
        const headerCells = Array.from(root.querySelectorAll('.fc-col-header-cell[data-date]'));
        const passKey = `${String(state.cnHolidaySignature || map.size)}|${monthCells.length}|${headerCells.length}`;
        const stamps = [
            __tmCreateNodeListStamp(monthCells),
            __tmCreateNodeListStamp(headerCells),
        ];
        if (__tmShouldSkipCalendarDomPass(__tmCalendarDomPassCache.holidayDots, root, passKey, stamps)) return;
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
        for (const cell of monthCells) {
            const dateKey = cell.getAttribute('data-date') || '';
            const label = cell.querySelector('.fc-daygrid-day-number');
            ensure(label, dateKey);
        }
        for (const cell of headerCells) {
            const dateKey = cell.getAttribute('data-date') || '';
            const label = cell.querySelector('.fc-col-header-cell-cushion');
            ensure(label, dateKey);
        }
        __tmRememberCalendarDomPass(__tmCalendarDomPassCache.holidayDots, root, passKey, stamps);
    }

    function applyCnLunarLabels(rootEl) {
        const root = rootEl || state.rootEl;
        if (!root || !(root instanceof Element)) return;
        const settings = getSettings();
        const map = state.cnHolidayMap instanceof Map ? state.cnHolidayMap : new Map();
        const monthCells = Array.from(root.querySelectorAll('.fc-daygrid-day[data-date]'));
        const headerCells = Array.from(root.querySelectorAll('.fc-col-header-cell[data-date]'));
        const passKey = `${String(state.cnHolidaySignature || map.size)}|${settings.showLunar ? 1 : 0}|${String(state.calendar?.view?.type || '').trim()}|${monthCells.length}|${headerCells.length}`;
        const stamps = [
            __tmCreateNodeListStamp(monthCells),
            __tmCreateNodeListStamp(headerCells),
        ];
        const removeAll = () => {
            root.querySelectorAll('.tm-cn-lunar').forEach((el) => { try { el.remove(); } catch (e) {} });
        };
        if (!settings.showLunar) {
            removeAll();
            __tmRememberCalendarDomPass(__tmCalendarDomPassCache.lunarLabels, root, passKey, stamps);
            return;
        }
        if (__tmShouldSkipCalendarDomPass(__tmCalendarDomPassCache.lunarLabels, root, passKey, stamps)) return;
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
        for (const cell of monthCells) {
            const dateKey = cell.getAttribute('data-date') || '';
            addMonth(cell, dateKey);
        }
        const vtNow = String(state.calendar?.view?.type || '').trim();
        if (vtNow !== 'dayGridMonth') {
            for (const cell of headerCells) {
                const dateKey = cell.getAttribute('data-date') || '';
                const label = cell.querySelector('.fc-col-header-cell-cushion');
                addWeek(label, dateKey);
            }
        }
        __tmRememberCalendarDomPass(__tmCalendarDomPassCache.lunarLabels, root, passKey, stamps);
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
        const colors = { success: 'var(--tm-success-color)', error: 'var(--tm-danger-color)', info: 'var(--tm-primary-color)', warning: 'var(--tm-warning-color, #f9ab00)' };
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
                        try {
                            __tmSchedulePostMutationRefresh(currentItem, 'upsert', {
                                reason: 'refresh-device-schedule',
                                flushTaskPanel: true,
                                version: Number(state.calendarMutationVersion) || 0,
                            });
                        } catch (e2) {}
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
            const nextColor = String(def?.color || 'var(--tm-primary-color)').trim() || 'var(--tm-primary-color)';
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
            const color = getInputValue('color') || 'var(--tm-primary-color)';
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
            const blockIdKeep = String(blockId0 || getScheduleLinkedBlockId(prevItem) || '').trim();
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
                blockId: blockIdKeep,
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
            await saveScheduleAll(nextList, {
                reason: 'save-schedule-draft',
                op: 'update',
                scheduleId: String(draftItem?.id || scheduleId || '').trim(),
                scheduleIds: [String(draftItem?.id || scheduleId || '').trim()].filter(Boolean),
                rangeStart: draftItem?.start,
                rangeEnd: draftItem?.end,
            });
            try {
                const store = state.settingsStore;
                if (store && store.data) {
                    store.data.calendarDefaultCalendarId = String(draftItem.calendarId || calendarId0 || 'default').trim() || 'default';
                    if (store.data.calendarShowSchedule === false) store.data.calendarShowSchedule = true;
                    await store.save();
                }
            } catch (e2) {}
            try {
                __tmSchedulePostMutationRefresh(nextList[idx] || draftItem, 'upsert', {
                    reason: 'save-schedule-draft',
                    flushTaskPanel: true,
                    version: Number(state.calendarMutationVersion) || 0,
                });
            } catch (e2) {}
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
        const blockId0 = getScheduleLinkedBlockId(init);
        const taskDateStartKey0 = String(init.taskDateStartKey || init.startKey || '').trim();
        const taskDateEndExclusiveKey0 = String(init.taskDateEndExclusiveKey || init.endExclusiveKey || '').trim();
        const taskStartDate0 = String(init.taskStartDate || init.startDate || '').trim();
        const taskCompletionTime0 = String(init.taskCompletionTime || init.completionTime || '').trim();
        const isEdit = !!scheduleId;
        const taskDateEditor = !isEdit && (
            init.taskDateEditor === true
            || (!!(taskId0 || blockId0) && !!(taskDateStartKey0 || taskDateEndExclusiveKey0 || taskStartDate0 || taskCompletionTime0))
        );
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
        const calDef0 = calDefs.find((d) => d.id === calendarId0) || calDefs[0] || { id: 'default', name: '时间轴', color: 'var(--tm-primary-color)' };
        const color0 = String(init.color || '').trim() || String(calDef0.color || 'var(--tm-primary-color)');
        const colorInputValue0 = normalizeColorInputHex(color0, calDef0.color || '#7FA2DA');
        const calendarOptions = calDefs.map((d) => `<option value="${esc(d.id)}" ${d.id === calendarId0 ? 'selected' : ''}>${esc(d.name)}</option>`).join('');
        const colorPresetButtonsHtml = SCHEDULE_EDITOR_MORANDI_PRESET_COLORS.map((color) => `
            <button
                class="tm-calendar-edit-color-chip${color === colorInputValue0 ? ' is-active' : ''}"
                type="button"
                data-tm-cal-color-preset="${esc(color)}"
                title="莫兰迪预设 ${esc(color)}"
                aria-label="选择预设颜色 ${esc(color)}"
                style="--tm-cal-color-swatch:${esc(color)};"
                ${taskDateEditor ? 'disabled' : ''}>
            </button>
        `).join('');
        const deviceSummary0 = taskDateEditor
            ? '此事件来自任务日期，仅支持同步修改任务的开始日期和完成日期'
            : (isEdit ? getScheduleCurrentDeviceNotificationSummary(init) : '保存后会自动同步当前设备预约');

        const startLocal = start ? `${formatDateKey(start)}T${pad2(start.getHours())}:${pad2(start.getMinutes())}` : '';
        const endLocal = end ? `${formatDateKey(end)}T${pad2(end.getHours())}:${pad2(end.getMinutes())}` : '';
        const startInputType = taskDateEditor ? 'date' : 'datetime-local';
        const endInputType = taskDateEditor ? 'date' : 'datetime-local';
        const startInputValue = taskDateEditor ? taskStartDate0 : startLocal;
        const endInputValue = taskDateEditor ? taskCompletionTime0 : endLocal;
        const startLabel = taskDateEditor ? '开始日期' : '开始';
        const endLabel = taskDateEditor ? '完成日期' : '结束';
        const modalTitle = taskDateEditor ? '编辑任务日期' : (isEdit ? '编辑日程' : '新建日程');

        const modal = document.createElement('div');
        modal.className = 'tm-calendar-edit-modal';
        modal.innerHTML = `
            <div class="tm-calendar-edit-box">
                <div class="tm-calendar-edit-title">${modalTitle}</div>
                <div class="tm-calendar-edit-row"${taskDateEditor ? ' style="opacity:.55;"' : ''}>
                    <div class="tm-calendar-edit-label">标题</div>
                    <input class="tm-calendar-edit-input" type="text" value="${esc(title0)}" placeholder="请输入标题" data-tm-cal-field="title" ${taskDateEditor ? 'disabled' : ''}>
                </div>
                <div class="tm-calendar-edit-row"${taskDateEditor ? ' style="opacity:.55;"' : ''}>
                    <div class="tm-calendar-edit-label">日历</div>
                    <select class="tm-calendar-edit-input" data-tm-cal-field="calendarId" ${taskDateEditor ? 'disabled' : ''}>${calendarOptions}</select>
                </div>
                <div class="tm-calendar-edit-row">
                    <div class="tm-calendar-edit-label">${startLabel}</div>
                    <input class="tm-calendar-edit-input" type="${startInputType}" value="${esc(startInputValue)}" data-tm-cal-field="start">
                </div>
                <div class="tm-calendar-edit-row">
                    <div class="tm-calendar-edit-label">${endLabel}</div>
                    <input class="tm-calendar-edit-input" type="${endInputType}" value="${esc(endInputValue)}" data-tm-cal-field="end">
                </div>
                <div class="tm-calendar-edit-row tm-calendar-edit-row--color"${taskDateEditor ? ' style="opacity:.55;"' : ''}>
                    <div class="tm-calendar-edit-label">颜色</div>
                    <div class="tm-calendar-edit-color-wrap">
                        <input class="tm-calendar-edit-input tm-calendar-edit-color-input" type="color" value="${esc(colorInputValue0)}" data-tm-cal-field="color" aria-label="当前颜色" ${taskDateEditor ? 'disabled' : ''}>
                        <div class="tm-calendar-edit-color-presets" data-tm-cal-color-presets aria-label="莫兰迪预设颜色">
                            ${colorPresetButtonsHtml}
                        </div>
                    </div>
                </div>
                <div class="tm-calendar-edit-row"${taskDateEditor ? ' style="opacity:.55;"' : ''}>
                    <div class="tm-calendar-edit-label">提醒</div>
                    <select class="tm-calendar-edit-input" data-tm-cal-field="reminderSelect" ${taskDateEditor ? 'disabled' : ''}>
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
                <div class="tm-calendar-edit-row"${taskDateEditor ? ' style="opacity:.55;"' : ''}>
                    <div class="tm-calendar-edit-label">循环</div>
                    <select class="tm-calendar-edit-input" data-tm-cal-field="repeatType" ${taskDateEditor ? 'disabled' : ''}>
                        <option value="none" ${repeatType0 === 'none' ? 'selected' : ''}>不循环</option>
                        <option value="daily" ${repeatType0 === 'daily' ? 'selected' : ''}>每天</option>
                        <option value="workday" ${repeatType0 === 'workday' ? 'selected' : ''}>工作日</option>
                        <option value="weekly" ${repeatType0 === 'weekly' ? 'selected' : ''}>每周</option>
                        <option value="monthly" ${repeatType0 === 'monthly' ? 'selected' : ''}>每月</option>
                        <option value="yearly" ${repeatType0 === 'yearly' ? 'selected' : ''}>每年</option>
                    </select>
                </div>
                <div class="tm-calendar-edit-row tm-calendar-edit-row--repeat-detail" data-tm-cal-row="repeatEvery"${taskDateEditor ? ' style="opacity:.55;"' : ''}>
                    <div class="tm-calendar-edit-label">间隔</div>
                    <input class="tm-calendar-edit-input tm-calendar-edit-input--repeat-every" type="number" min="1" step="1" value="${esc(String(repeatEvery0 || 1))}" data-tm-cal-field="repeatEvery" ${taskDateEditor ? 'disabled' : ''}>
                    <div class="tm-calendar-edit-value" data-tm-cal-field="repeatEveryUnit" style="opacity:.85;">${esc(getScheduleRepeatUnitLabel(repeatType0, repeatEvery0))}</div>
                </div>
                <div class="tm-calendar-edit-row tm-calendar-edit-row--repeat-detail" data-tm-cal-row="repeatMonthlyMode"${taskDateEditor ? ' style="opacity:.55;"' : ''}>
                    <div class="tm-calendar-edit-label">月规则</div>
                    <select class="tm-calendar-edit-input tm-calendar-edit-input--repeat-monthly" data-tm-cal-field="repeatMonthlyMode" ${taskDateEditor ? 'disabled' : ''}>
                        <option value="date" ${repeatMonthlyMode0 !== 'weekday' ? 'selected' : ''}>按日期</option>
                        <option value="weekday" ${repeatMonthlyMode0 === 'weekday' ? 'selected' : ''}>按星期</option>
                    </select>
                    <div class="tm-calendar-edit-value" data-tm-cal-field="repeatMonthlySummary" style="opacity:.85;">${esc(start ? `每月${getScheduleMonthlyWeekPatternLabel(start)}` : '根据开始时间自动计算')}</div>
                </div>
                <div class="tm-calendar-edit-row tm-calendar-edit-row--repeat-detail" data-tm-cal-row="repeatUntil"${taskDateEditor ? ' style="opacity:.55;"' : ''}>
                    <div class="tm-calendar-edit-label">循环截止</div>
                    <input class="tm-calendar-edit-input" type="date" value="${esc(repeatUntil0)}" data-tm-cal-field="repeatUntil" ${taskDateEditor ? 'disabled' : ''}>
                </div>
                <div class="tm-calendar-edit-row"${taskDateEditor ? ' style="opacity:.55;"' : ''}>
                    <div class="tm-calendar-edit-label">当前设备预约</div>
                    <div class="tm-calendar-edit-value" data-tm-cal-field="deviceScheduleSummary" style="flex:1;line-height:1.4;opacity:.85;">${esc(deviceSummary0)}</div>
                    ${isEdit && !taskDateEditor ? `<button class="tm-btn tm-btn-secondary tm-calendar-edit-inline-action" type="button" data-tm-cal-action="viewDeviceSchedule">查看</button>` : ''}
                </div>
                <div class="tm-calendar-edit-actions">
                    <button class="tm-btn tm-btn-secondary" data-tm-cal-action="cancel">取消</button>
                    <div style="flex:1;"></div>
                    ${isEdit && !taskDateEditor ? `<button class="tm-btn tm-btn-danger" data-tm-cal-action="delete">删除</button>` : ''}
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
        const setFieldRowHidden = (rowName, hidden) => {
            const row = modal.querySelector(`[data-tm-cal-row="${rowName}"]`);
            if (!(row instanceof HTMLElement)) return;
            row.hidden = !!hidden;
            row.style.display = hidden ? 'none' : '';
            row.setAttribute('aria-hidden', hidden ? 'true' : 'false');
        };
        const normalizeTaskDateInput = (raw) => {
            const s = String(raw || '').trim();
            if (!s) return '';
            const dt = parseDateOnly(s);
            if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) throw new Error('日期格式不合法');
            return formatDateKey(dt);
        };
        const getStartDraft = () => {
            const raw = getInputValue('start');
            const dt = raw ? new Date(raw) : start;
            return (dt instanceof Date && !Number.isNaN(dt.getTime())) ? dt : start;
        };
        const syncColorToCalendar = () => {
            if (taskDateEditor) return;
            const calendarId = getInputValue('calendarId') || calendarId0 || 'default';
            const colorEl = modal.querySelector('[data-tm-cal-field="color"]');
            if (!(colorEl instanceof HTMLInputElement)) return;
            const defs = getCalendarDefs(getSettings());
            const def = defs.find((d) => String(d?.id || '').trim() === calendarId);
            const nextColor = String(def?.color || 'var(--tm-primary-color)').trim() || 'var(--tm-primary-color)';
            colorEl.value = normalizeColorInputHex(nextColor, colorEl.value || colorInputValue0);
            syncColorPresetState();
        };
        const colorEl = modal.querySelector('[data-tm-cal-field="color"]');
        const colorPresetEls = Array.from(modal.querySelectorAll('[data-tm-cal-color-preset]'));
        const syncColorPresetState = () => {
            if (!(colorEl instanceof HTMLInputElement)) return;
            const activeColor = normalizeColorInputHex(colorEl.value, colorInputValue0);
            colorPresetEls.forEach((button) => {
                if (!(button instanceof HTMLButtonElement)) return;
                const presetColor = normalizeColorInputHex(button.getAttribute('data-tm-cal-color-preset'), '');
                const active = !!presetColor && presetColor === activeColor;
                button.classList.toggle('is-active', active);
                button.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
        };
        if (colorEl instanceof HTMLInputElement) {
            colorEl.addEventListener('input', () => {
                syncColorPresetState();
            }, { signal: abort.signal });
            colorEl.addEventListener('change', () => {
                syncColorPresetState();
            }, { signal: abort.signal });
        }
        colorPresetEls.forEach((button) => {
            if (!(button instanceof HTMLButtonElement)) return;
            button.addEventListener('click', () => {
                if (!(colorEl instanceof HTMLInputElement) || colorEl.disabled) return;
                const presetColor = normalizeColorInputHex(button.getAttribute('data-tm-cal-color-preset'), colorEl.value || colorInputValue0);
                colorEl.value = presetColor;
                syncColorPresetState();
            }, { signal: abort.signal });
        });
        syncColorPresetState();
        const syncMonthlyModeSummary = () => {
            const monthlyModeEl = modal.querySelector('[data-tm-cal-field="repeatMonthlyMode"]');
            const summaryEl = modal.querySelector('[data-tm-cal-field="repeatMonthlySummary"]');
            if (!(monthlyModeEl instanceof HTMLSelectElement) || !summaryEl) return;
            if (taskDateEditor) {
                monthlyModeEl.disabled = true;
                monthlyModeEl.style.opacity = '0.55';
                summaryEl.textContent = '任务日期事件不可编辑循环规则';
                return;
            }
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
            const disabled = taskDateEditor || repeatType === 'none';
            const showRepeatDetails = repeatType !== 'none';
            const showMonthlyMode = repeatType === 'monthly';
            setFieldRowHidden('repeatEvery', !showRepeatDetails);
            setFieldRowHidden('repeatMonthlyMode', !showMonthlyMode);
            setFieldRowHidden('repeatUntil', !showRepeatDetails);
            if (repeatEveryEl instanceof HTMLInputElement) {
                repeatEveryEl.disabled = disabled;
                repeatEveryEl.style.opacity = disabled ? '0.55' : '1';
                if (!repeatEveryEl.value || Number(repeatEveryEl.value) <= 0) repeatEveryEl.value = String(repeatEvery0 || 1);
            }
            if (repeatEveryUnitEl) {
                repeatEveryUnitEl.textContent = taskDateEditor
                    ? '任务日期事件不可编辑'
                    : (disabled
                    ? '关闭循环时忽略'
                    : `每 ${getScheduleRepeatUnitLabel(repeatType, getInputValue('repeatEvery') || repeatEvery0)}`);
            }
            syncMonthlyModeSummary();
            untilEl.disabled = disabled;
            untilEl.style.opacity = disabled ? '0.55' : '1';
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
                const color = getInputValue('color') || 'var(--tm-primary-color)';
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
                    blockId: String(blockId0 || getScheduleLinkedBlockId(init) || '').trim(),
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
                            const colorNow = getInputValue('color') || 'var(--tm-primary-color)';
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
                            const blockIdKeep = String(blockId0 || getScheduleLinkedBlockId(prevItem) || '').trim();
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
                                blockId: blockIdKeep,
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
                            await saveScheduleAll(nextList, {
                                reason: 'device-schedule-resolve-latest',
                                op: 'update',
                                scheduleId: String(draftItem?.id || scheduleId || '').trim(),
                                scheduleIds: [String(draftItem?.id || scheduleId || '').trim()].filter(Boolean),
                                rangeStart: draftItem?.start,
                                rangeEnd: draftItem?.end,
                            });
                            try {
                                __tmSchedulePostMutationRefresh(nextList[idx] || draftItem, 'upsert', {
                                    reason: 'device-schedule-resolve-latest',
                                    flushTaskPanel: true,
                                    version: Number(state.calendarMutationVersion) || 0,
                                });
                            } catch (e) {}
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
                if (taskDateEditor) {
                    const targetId = String(taskId0 || blockId0 || '').trim();
                    if (!targetId) {
                        toast('⚠ 缺少任务标识', 'warning');
                        return;
                    }
                    let nextStartDate = '';
                    let nextCompletionDate = '';
                    try {
                        nextStartDate = normalizeTaskDateInput(getInputValue('start'));
                        nextCompletionDate = normalizeTaskDateInput(getInputValue('end'));
                    } catch (err) {
                        toast(`⚠ ${String(err?.message || err || '日期格式不合法')}`, 'warning');
                        return;
                    }
                    try {
                        await window.tmUpdateTaskDates(targetId, {
                            startDate: nextStartDate,
                            completionTime: nextCompletionDate,
                        });
                        try {
                            scheduleCalendarRefresh({
                                reason: 'taskdate-editor-save',
                                main: true,
                                side: true,
                                flushTaskPanel: true,
                                rangeStart: nextStartDate,
                                rangeEnd: nextCompletionDate,
                            });
                        } catch (e2) {}
                        closeModal();
                        toast('✅ 已同步任务日期', 'success');
                    } catch (err) {
                        toast(`❌ 保存失败：${String(err?.message || err || '')}`, 'error');
                    }
                    return;
                }
                const title = getInputValue('title');
                const calendarId = getInputValue('calendarId') || calendarId0 || 'default';
                const s0 = getInputValue('start');
                const e0 = getInputValue('end');
                const color = getInputValue('color') || 'var(--tm-primary-color)';
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
                const blockIdKeep = String(blockId0 || getScheduleLinkedBlockId(prevItem) || '').trim();
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
                    blockId: blockIdKeep,
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
                await saveScheduleAll(list, {
                    reason: 'save-schedule-modal',
                    op: idx >= 0 ? 'update' : 'add',
                    scheduleId: id,
                    scheduleIds: [id],
                    rangeStart: item.start,
                    rangeEnd: item.end,
                });
                try {
                    const store = state.settingsStore;
                    if (store && store.data) {
                        store.data.calendarDefaultCalendarId = calendarId;
                        if (store.data.calendarShowSchedule === false) store.data.calendarShowSchedule = true;
                        await store.save();
                    }
                } catch (e2) {}
                if (blockIdKeep && !taskIdKeep && typeof window.tmAutoAddOtherBlocksToCurrentGroup === 'function') {
                    try {
                        const addResult = await window.tmAutoAddOtherBlocksToCurrentGroup([blockIdKeep], { silent: true, forceRefresh: true });
                        if (addResult?.reason === 'no-group') {
                            toast('⚠ 已保存日程，但未加入其他块页签，请先创建或选择文档分组', 'warning');
                        }
                    } catch (e2) {}
                }
                closeModal();
                __tmSchedulePostMutationRefresh(item, 'upsert', {
                    reason: 'save-schedule-modal',
                    flushTaskPanel: true,
                    hard: String(state.calendar?.view?.type || '').trim() === 'dayGridMonth',
                    version: Number(state.calendarMutationVersion) || 0,
                });
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
            try { applyMainCalendarMonthCellMinHeightLayout(state.calendarEl, cal); } catch (e3) {}
            try { applyMainCalendarMonthMoreLinkLayout(state.calendarEl, cal); } catch (e3) {}
            try { applyMainCalendarSlotHeightLayout(wrap, getSettings()); } catch (e3) {}
            try { scheduleSyncTimeGridAllDayCollapseUi(state.calendarEl, cal); } catch (e3) {}
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
        try { __tmPushCalendarRefreshTrace('calendar-refreshInPlace', { options: { ...opt } }); } catch (e) {}
        try { ensureFcCompactAllDayStyle(); } catch (e) {}
        if (opt.layoutOnly !== true) {
            try { scheduleTaskPageRender(wrap, getSettings()); } catch (e2) {}
            try { cal.refetchEvents(); } catch (e2) {}
        }
        try { applyCalendarSlotHeightStyle(wrap, getSettings()); } catch (e) {}
        try { scheduleMainCalendarLayoutRefresh(wrap, state.calendarEl, cal, { updateSize: false }); } catch (e) {}
        stabilizeCalendarLayout(cal, wrap, opt);
        return true;
    }

    function collectCalendarsForTaskSync() {
        const list = [];
        if (state.calendar) list.push(state.calendar);
        if (state.sideDay?.calendar && state.sideDay.calendar !== state.calendar) list.push(state.sideDay.calendar);
        return list;
    }

    function findCalendarEventsByTaskId(cal, taskId) {
        const api = cal && typeof cal.getEvents === 'function' ? cal : null;
        const tid = String(taskId || '').trim();
        if (!api || !tid) return [];
        try {
            return api.getEvents().filter((eventApi) => {
                const ext = eventApi?.extendedProps || {};
                const linkedTaskId = String(ext.__tmTaskId || '').trim();
                const linkedBlockId = String(ext.__tmBlockId || '').trim();
                return linkedTaskId === tid || linkedBlockId === tid;
            });
        } catch (e) {
            return [];
        }
    }

    function applyRenderedEventDoneStateById(eventId, done) {
        const eid = String(eventId || '').trim();
        if (!eid) return false;
        const roots = [state.wrapEl, state.sideDay?.rootEl, document.body];
        let touched = false;
        roots.forEach((root) => {
            if (!(root instanceof Element)) return;
            const nodes = root.querySelectorAll?.('.fc-event[data-tm-cal-event-id]');
            if (!nodes || !nodes.length) return;
            nodes.forEach((el) => {
                if (String(el.getAttribute('data-tm-cal-event-id') || '').trim() !== eid) return;
                touched = true;
                try { el.classList.toggle('tm-cal-event--done', !!done); } catch (e) {}
                const wrapEl = el.querySelector?.('.tm-cal-task-event');
                if (wrapEl instanceof HTMLElement) {
                    const checkEl = wrapEl.querySelector?.('.tm-cal-task-event-check');
                    if (checkEl instanceof HTMLInputElement) checkEl.checked = !!done;
                    const titleEl = wrapEl.querySelector?.('.tm-cal-task-event-title-text') || wrapEl.querySelector?.('.tm-cal-task-event-title') || null;
                    try { applyTaskDoneVisual(wrapEl, titleEl, !!done); } catch (e) {}
                }
            });
        });
        return touched;
    }

    function syncTaskDoneInPlace(taskId, done, options = {}) {
        const tid = String(taskId || '').trim();
        if (!tid) return false;
        const opt = (options && typeof options === 'object') ? options : {};
        const nextDone = !!done;
        let touched = false;
        let needsRefetch = false;
        const calendars = collectCalendarsForTaskSync();
        calendars.forEach((cal) => {
            const events = findCalendarEventsByTaskId(cal, tid);
            events.forEach((eventApi) => {
                const ext = eventApi?.extendedProps || {};
                const source = String(ext.__tmSource || '').trim();
                if (source === 'taskdate') {
                    if (nextDone) {
                        try { eventApi.remove(); } catch (e) {}
                        touched = true;
                    } else {
                        needsRefetch = true;
                    }
                    return;
                }
                const resolvedDone = resolveCalendarEventDoneState(ext, { taskDoneOverride: nextDone });
                if (applyRenderedEventDoneStateById(eventApi?.id, resolvedDone)) touched = true;
            });
        });
        if (state.wrapEl instanceof HTMLElement) {
            try { scheduleTaskPageRender(state.wrapEl, getSettings()); } catch (e) {}
        }
        if (needsRefetch && opt.allowRefetch !== false) {
            try {
                scheduleCalendarRefresh({
                    reason: 'sync-task-done-fallback',
                    main: true,
                    side: true,
                    flushTaskPanel: true,
                    hard: false,
                });
            } catch (e) {}
            return true;
        }
        return touched;
    }

    function refreshSideDayLayout() {
        const rootEl = state.sideDay?.rootEl;
        const cal = state.sideDay?.calendar;
        if (!(rootEl instanceof HTMLElement) || !cal) return false;
        try { syncSideDayLayout(rootEl, cal, getSettings()); } catch (e) {}
        try { scheduleSyncTimeGridAllDayCollapseUi(rootEl, cal); } catch (e) {}
        try {
            requestAnimationFrame(() => {
                try { syncSideDayLayout(rootEl, cal, getSettings()); } catch (e2) {}
                try { scheduleSyncTimeGridAllDayCollapseUi(rootEl, cal); } catch (e2) {}
            });
        } catch (e) {}
        try {
            setTimeout(() => {
                try { syncSideDayLayout(rootEl, cal, getSettings()); } catch (e2) {}
                try { scheduleSyncTimeGridAllDayCollapseUi(rootEl, cal); } catch (e2) {}
            }, 0);
        } catch (e) {}
        return true;
    }

    function syncWrapBottomInset(rootEl, wrapEl, options = {}) {
        const wrap = wrapEl instanceof HTMLElement ? wrapEl : state.wrapEl;
        if (!(wrap instanceof HTMLElement)) return '0px';
        const root = rootEl instanceof HTMLElement ? rootEl : state.rootEl;
        const isMobileDevice = options.isMobileDevice === true;
        const isDockHost = options.isDockHost === true;
        const isLandscape = (() => {
            try { return !!window.matchMedia?.('(orientation: landscape)')?.matches; } catch (e) { return false; }
        })();
        let value = '';
        try {
            const host = (rootEl instanceof Element ? rootEl.closest?.('.tm-main-stage') : null)
                || wrap.closest?.('.tm-main-stage');
            if (host instanceof HTMLElement) {
                value = String(getComputedStyle(host).getPropertyValue('--tm-view-bottom-inset') || '').trim();
            }
        } catch (e) {}
        if (!value) {
            const showMobileBottomViewBar = isDockHost
                ? (!isLikelyMobileRuntime() || !isLandscape)
                : !!(isMobileDevice && !isLandscape);
            value = showMobileBottomViewBar
                ? 'calc(var(--tm-mobile-bottom-viewbar-offset, env(safe-area-inset-bottom, 0px)) + 52px)'
                : '0px';
        }
        try { if (root instanceof HTMLElement) root.style.setProperty('--tm-view-bottom-inset', value || '0px'); } catch (e) {}
        try { wrap.style.setProperty('--tm-view-bottom-inset', value || '0px'); } catch (e) {}
        return value || '0px';
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
            try {
                const local = String(rootEl?.dataset?.tmUiMode || '').trim();
                if (local === 'mobile') return true;
            } catch (e) {}
            try {
                const bodyMode = String(document.body?.dataset?.tmUiMode || '').trim();
                if (bodyMode === 'mobile') return true;
            } catch (e) {}
            return false;
        })();
        const isMobileDevice = hostForcesMobileUi
            || !!globalThis.__taskHorizonPluginIsMobile
            || isLikelyMobileRuntime();
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
            return false;
        })();
        state.isMobileDevice = !!isMobileDevice;
        state.isDockHost = !!isDockHost;
        try {
            Promise.resolve().then(() => globalThis.tmCalendarWarmDocsToGroupCache?.()).catch(() => null);
        } catch (e) {}
        try {
            rootEl.style.height = '100%';
            rootEl.style.minHeight = '0';
        } catch (e) {}

        const wrap = document.createElement('div');
        wrap.className = 'tm-calendar-wrap' + (isMobileDevice ? ' tm-calendar-wrap--mobile' : '');
        try { syncWrapBottomInset(rootEl, wrap, { isMobileDevice, isDockHost }); } catch (e) {}
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
                            <div class="tm-calendar-nav-wrap">
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
                                <div class="tm-calendar-nav-scrollbar">
                                    <div class="tm-calendar-nav-scrollbar-thumb"></div>
                                </div>
                            </div>
                        </div>
                        <div class="tm-calendar-side-page" data-tm-cal-side-page="tasks" data-tm-cal-role="task-page" style="display:none; flex:1; overflow:hidden; flex-direction:column; min-height:0;">
                            <div class="tm-calendar-task-page-list tm-calendar-task-page-list--compact" data-tm-cal-role="task-page-list"></div>
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
        state.sidePage = normalizeCalendarSidebarDefaultPage(s.defaultSidebarPage);
        renderSidebar(wrap, s);
        bindCalendarNavScrollFx(wrap);
        renderTaskPanel(wrap, s);
        renderTaskPage(wrap, s);
        setSidePage(wrap, state.sidePage);
        if (isMobileDevice || isDockHost) setCalendarSidebarOpen(wrap, false, state.sidePage);
        else setCalendarSidebarOpen(wrap, !s.collapseDesktopSidebarDefault);
        bindSidebarResize(wrap);
        let calendar = null;
        let mainCalendarEventsPerfTrace = null;
        let mainCalendarEventsLoadSeq = 0;
        let mainCalendarLastEventCount = 0;
        const ensureMainCalendarEventsPerfTrace = (info) => {
            if (mainCalendarEventsPerfTrace && mainCalendarEventsPerfTrace.finished !== true) return mainCalendarEventsPerfTrace;
            mainCalendarEventsLoadSeq += 1;
            const trace = __tmPerfCreate('calendarEvents', {
                calendar: 'main',
                loadSeq: mainCalendarEventsLoadSeq,
                viewType: String((calendar && calendar.view && calendar.view.type) || state._lastViewType || preferredInitialView || 'timeGridWeek'),
                rangeStart: formatDateKey(info?.start),
                rangeEnd: formatDateKey(info?.end),
            });
            if (trace) {
                __tmPerfMark(trace, 'calendar-events-start', {
                    calendar: 'main',
                    loadSeq: mainCalendarEventsLoadSeq,
                    viewType: String((calendar && calendar.view && calendar.view.type) || state._lastViewType || preferredInitialView || 'timeGridWeek'),
                    rangeStart: formatDateKey(info?.start),
                    rangeEnd: formatDateKey(info?.end),
                });
            }
            mainCalendarEventsPerfTrace = trace;
            mainCalendarLastEventCount = 0;
            return trace;
        };
        const finishMainCalendarEventsPerfTrace = (detail = {}) => {
            if (!mainCalendarEventsPerfTrace) return;
            const trace = mainCalendarEventsPerfTrace;
            mainCalendarEventsPerfTrace = null;
            __tmPerfMark(trace, 'calendar-events-ready', {
                calendar: 'main',
                eventCount: Number(mainCalendarLastEventCount || 0),
                viewType: String((calendar && calendar.view && calendar.view.type) || state._lastViewType || preferredInitialView || 'timeGridWeek'),
                ...(detail && typeof detail === 'object' ? detail : {}),
            });
            __tmPerfFinish(trace, {
                calendar: 'main',
                eventCount: Number(mainCalendarLastEventCount || 0),
                viewType: String((calendar && calendar.view && calendar.view.type) || state._lastViewType || preferredInitialView || 'timeGridWeek'),
                ...(detail && typeof detail === 'object' ? detail : {}),
            });
        };
        const preferredInitialView = (() => {
            if (isMobileDevice) return 'timeGridDay';
            const v = String(s.lastViewType || '').trim();
            if (v && MAIN_CALENDAR_ALLOWED_VIEWS.has(v)) return v;
            return 'timeGridWeek';
        })();
        const preferredInitialDate = (() => {
            const explicit = parseDateOnly(state.opts?.date || state.opts?.initialDate);
            if (explicit) return resolveMainCalendarAnchorDate(explicit, preferredInitialView, s) || explicit;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return resolveMainCalendarAnchorDate(today, preferredInitialView, s) || today;
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
            moreLinkText: (n) => `+${n}`,
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
            dayCellDidMount: normalizeCalendarMonthDayNumberCell,
            eventContent: (arg) => {
                const ext = arg?.event?.extendedProps || {};
                const source = String(ext.__tmSource || '').trim();
                const viewType = String(arg?.view?.type || '').trim();
                const isBlockLike = arg?.event?.allDay === true || viewType.startsWith('dayGrid');
                const hideRangeText = String(arg?.view?.type || '').trim() === 'dayGridMonth';
                if (source === 'taskdate' || (source === 'schedule' && (String(ext.__tmTaskId || '').trim() || String(ext.__tmBlockId || '').trim()))) {
                    const tid = String(ext.__tmTaskId || ext.__tmBlockId || '').trim();
                    const done = resolveCalendarEventDoneState(ext);
                    const isAllDay = arg?.event?.allDay === true;
                    const useAllDayLayout = shouldUseAllDayEventContentLayout(arg);
                    const wrapEl = document.createElement('span');
                    wrapEl.className = source === 'schedule' ? 'tm-cal-task-event tm-cal-task-event--schedule' : 'tm-cal-task-event';
                    if (shouldEnableCalendarEventContextMenu()) {
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
                    }
                    const rangeText = !hideRangeText && source === 'schedule'
                        ? formatScheduleEventRangeText(arg?.event?.start, arg?.event?.end, arg?.event?.allDay === true)
                        : '';
                    const { title, titleText } = buildTaskEventTitleNode(String(arg?.event?.title || '').trim() || '任务', rangeText);
                    if (isBlockLike) wrapEl.classList.add('tm-cal-task-event--block');
                    if (useAllDayLayout) wrapEl.classList.add('tm-cal-task-event--allday');
                    if (rangeText) wrapEl.classList.add('tm-cal-task-event--stacked');
                    let cb = null;
                    let leadingEl = null;
                    if (shouldShowCalendarEventCheckbox(ext)) {
                        cb = document.createElement('input');
                        cb.type = 'checkbox';
                        cb.className = 'tm-cal-task-event-check';
                        cb.checked = done;
                        cb.onclick = (ev) => {
                            try { ev.stopPropagation(); } catch (e) {}
                        };
                        applyTaskEventCheckboxOffset(cb, { allDay: useAllDayLayout, blockLike: isBlockLike });
                        if (rangeText && !isBlockLike && !isAllDay) {
                            try { cb.style.marginTop = '4px'; } catch (e) {}
                        }
                        cb.onchange = async (ev) => {
                            try { ev.stopPropagation(); } catch (e) {}
                            try {
                                await handleCalendarEventCheckboxToggle(cb, wrapEl, titleText, ext, tid);
                            } catch (e) {
                                return;
                            }
                        };
                    }
                    if (isBlockLike) {
                        leadingEl = buildCalendarEventLeadingNode(cb ? '' : 'marker');
                        if (cb) leadingEl.appendChild(cb);
                    }
                    applyTaskEventTitleClamp(wrapEl, title, { hasLeadingSlot: !!leadingEl });
                    applyTaskDoneVisual(wrapEl, titleText, done);
                    titleText.onclick = (ev) => {
                        try { ev.stopPropagation(); } catch (e) {}
                        try { ev.preventDefault(); } catch (e) {}
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
                        if (!tid) return;
                        try { openCalendarLinkedTask(tid, ev); } catch (e) {}
                    };
                    if (leadingEl) wrapEl.appendChild(leadingEl);
                    else if (cb) wrapEl.appendChild(cb);
                    wrapEl.appendChild(title);
                    return { domNodes: [wrapEl] };
                }
                if (source === 'schedule') {
                    const useAllDayLayout = shouldUseAllDayEventContentLayout(arg);
                    const wrapEl = document.createElement('span');
                    wrapEl.className = 'tm-cal-schedule-stack';
                    if (isBlockLike) wrapEl.classList.add('tm-cal-schedule-stack--block');
                    if (useAllDayLayout) wrapEl.classList.add('tm-cal-schedule-stack--allday');
                    const { title } = buildTaskEventTitleNode(
                        String(arg?.event?.title || '').trim() || '日程',
                        hideRangeText ? '' : formatScheduleEventRangeText(arg?.event?.start, arg?.event?.end, arg?.event?.allDay === true)
                    );
                    const leadingEl = isBlockLike ? buildCalendarEventLeadingNode('marker') : null;
                    applyTaskEventTitleClamp(wrapEl, title, { hasLeadingSlot: !!leadingEl });
                    if (leadingEl) wrapEl.appendChild(leadingEl);
                    wrapEl.appendChild(title);
                    return { domNodes: [wrapEl] };
                }
                if (source === 'reminder') {
                    const done = resolveCalendarEventDoneState(ext);
                    const useAllDayLayout = shouldUseAllDayEventContentLayout(arg);
                    const wrapEl = document.createElement('span');
                    wrapEl.className = 'tm-cal-task-event';
                    const tid = String(ext.__tmReminderBlockId || '').trim();
                    const { title, titleText } = buildTaskEventTitleNode(String(arg?.event?.title || '').trim() || '任务提醒');
                    if (isBlockLike) wrapEl.classList.add('tm-cal-task-event--block');
                    if (useAllDayLayout) wrapEl.classList.add('tm-cal-task-event--allday');
                    applyTaskEventTitleClamp(wrapEl, title);
                    applyTaskDoneVisual(wrapEl, titleText, done);
                    titleText.onclick = (ev) => {
                        try { ev.stopPropagation(); } catch (e) {}
                        try { ev.preventDefault(); } catch (e) {}
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
                        if (!tid) return;
                        try { openCalendarLinkedTask(tid, ev); } catch (e) {}
                    };
                    wrapEl.appendChild(title);
                    return { domNodes: [wrapEl] };
                }
                if (source !== 'cnHoliday') return true;
                return buildCnHolidayEventContent(arg);
            },
            eventDidMount: (arg) => {
                try {
                    const ext = arg?.event?.extendedProps || {};
                    const source = String(ext.__tmSource || '').trim();
                    try {
                        const el = arg?.el;
                        if (el && el instanceof Element) {
                            applyCalendarEventClampFromRoot(el);
                            try { el.classList.toggle('tm-cal-event--done', resolveCalendarEventDoneState(ext)); } catch (e1) {}
                            const eid = String(arg?.event?.id || '').trim();
                            if (eid) el.setAttribute('data-tm-cal-event-id', eid);
                            if (source) el.setAttribute('data-tm-cal-source', source);
                            if (source === 'schedule' || source === 'tomato' || arg?.isMirror) applyScheduleEventColorVars(el, String(arg?.event?.backgroundColor || arg?.event?.borderColor || 'var(--tm-primary-color)'));
                            if (shouldUseAllDaySoftEventVisual(arg, source)) {
                                applyAllDaySoftEventColorVars(el, String(arg?.event?.backgroundColor || arg?.event?.borderColor || 'var(--tm-primary-color)'));
                                normalizeAllDayEventContentLayout(el);
                            }
                            try {
                                const wrapEl = el.querySelector?.('.tm-cal-task-event');
                                const titleEl = wrapEl?.querySelector?.('.tm-cal-task-event-title-text') || wrapEl?.querySelector?.('.tm-cal-task-event-title') || null;
                                if (wrapEl) applyTaskDoneVisual(wrapEl, titleEl, resolveCalendarEventDoneState(ext));
                            } catch (e2) {}
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
                        if (sid && el && !el.__tmScheduleCtxBound && shouldEnableCalendarEventContextMenu()) {
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
                        if (tid && el && !el.__tmTaskCtxBound && shouldEnableCalendarEventContextMenu()) {
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
            eventsSet: () => {
                try { scheduleSyncTimeGridAllDayCollapseUi(host, calendar); } catch (e) {}
                try { scheduleMainCalendarLayoutRefresh(wrap, host, calendar, { updateSize: false }); } catch (e) {}
            },
            eventDragStart: () => {
                try { setCalendarTouchGestureLock(host, true); } catch (e) {}
            },
            eventDragStop: () => {
                try { setCalendarTouchGestureLock(host, false); } catch (e) {}
            },
            eventResizeStart: () => {
                try { setCalendarTouchGestureLock(host, true); } catch (e) {}
            },
            eventResizeStop: () => {
                try { setCalendarTouchGestureLock(host, false); } catch (e) {}
            },
            eventOrder: 'start,-duration,__tmRank,title',
            eventOrderStrict: true,
            eventClassNames: (arg) => {
                return resolveCalendarEventClassNames(arg);
            },
            editable: true,
            eventStartEditable: true,
            eventDurationEditable: true,
            eventResizableFromStart: true,
            longPressDelay: isMobileDevice ? 1000 : undefined,
            eventLongPressDelay: isMobileDevice ? 1000 : undefined,
            selectLongPressDelay: isMobileDevice ? 1000 : undefined,
            eventDragMinDistance: isMobileDevice ? 0 : undefined,
            selectable: true,
            selectMirror: true,
            fixedMirrorParent: document.body,
            scrollTimeReset: false,
            droppable: true,
            dropAccept: '.tm-cal-task, .tm-checklist-item[data-id], tr[data-id], .tm-kanban-card[data-id]',
            eventAllow: (dropInfo) => {
                try {
                    const viewType = String(calendar?.view?.type || '').trim();
                    syncCalendarDropDayPreview(host, viewType === 'dayGridMonth' ? formatDateKey(dropInfo?.start) : '');
                } catch (e) {}
                return true;
            },
            drop: () => {
                try { syncCalendarDropDayPreview(host, ''); } catch (e) {}
            },
            eventReceive: async (info) => {
                try {
                    const ext = info?.event?.extendedProps || {};
                    const payload = parseTaskDropPayload(info?.jsEvent, info?.draggedEl, null);
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
                    const calendarId = String(ext.calendarId || payload?.calendarId || '').trim() || pickDefaultCalendarId(settings);
                    const title = String(payload?.title || info?.event?.title || '').trim() || '任务';
                    const dropAllDayHint = (() => {
                        const t = info?.jsEvent?.target;
                        if (!(t instanceof Element)) return false;
                        return !!t.closest('.fc-timegrid-all-day, .fc-timegrid-allday, .fc-daygrid-day');
                    })();
                    const allDay = (info?.event?.allDay === true) || dropAllDayHint;
                    await addTaskSchedule({ taskId, title, start, end, calendarId, durationMin: durMin, allDay });
                    try { info?.event?.remove?.(); } catch (e2) {}
                    toast('✅ 已加入日程', 'success');
                } catch (e) {
                    try { info?.event?.remove?.(); } catch (e2) {}
                    toast(`❌ 加入日程失败：${String(e?.message || e || '')}`, 'error');
                }
            },
            events: async (info, success, failure) => {
                try {
                    ensureMainCalendarEventsPerfTrace(info);
                    const startMs = toMs(info?.start);
                    const endMs = toMs(info?.end);
                    const rangeSpanDays = (Number.isFinite(startMs) && Number.isFinite(endMs))
                        ? Math.max(0, Math.round((endMs - startMs) / 86400000))
                        : 0;
                    const activeViewType = String((calendar && calendar.view && calendar.view.type) || '').trim();
                    const fallbackViewType = String(state._lastViewType || preferredInitialView || 'timeGridWeek').trim();
                    const viewType = activeViewType || fallbackViewType || 'timeGridWeek';
                    const isTimeGridRange = isTimeGridViewType(viewType);
                    const isMonthRange = rangeSpanDays >= 27;
                    const shouldApplyMonthTaskDateDedupe = isMonthRange
                        || String(viewType || '').trim() === 'dayGridMonth'
                        || activeViewType === 'dayGridMonth'
                        || fallbackViewType === 'dayGridMonth';
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
                    const [records, cnHolidayDays, reminders] = await Promise.all([
                        loadRecordsForRange(info.start, info.end),
                        (settings.showCnHoliday || settings.showLunar) ? Promise.all(years.map((y) => loadCnHolidayYear(y))).then((arr) => arr.flat()) : Promise.resolve([]),
                        settings.linkDockTomato ? loadReminderBlocks().catch(() => []) : Promise.resolve([]),
                    ]);
                    try {
                        const wantMap = !!(settings.showCnHoliday || settings.showLunar);
                        state.cnHolidayMap = wantMap ? buildCnHolidayMap(cnHolidayDays, info.start, info.end, !!settings.showLunar) : new Map();
                        state.cnHolidaySignature = wantMap
                            ? `${info?.start?.toISOString?.() || ''}|${info?.end?.toISOString?.() || ''}|${cnHolidayDays.length}|${settings.showCnHoliday ? 1 : 0}|${settings.showLunar ? 1 : 0}|${String(viewType || '').trim()}`
                            : '';
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
                    const d = settings.showCnHoliday ? buildCnHolidayEvents(cnHolidayDays, info.start, info.end, viewType, settings) : [];
                    const e = buildEventsFromReminders(reminders, info.start, info.end, settings);
                    const scheduleCount = Number(state.mainCalendarStatus?.schedules || 0);
                    const taskDateCount = Number(state.mainCalendarStatus?.taskDates || 0);
                    const events = a.concat(d, e);
                    mainCalendarLastEventCount = (Array.isArray(events) ? events.length : 0) + taskDateCount + scheduleCount;
                    __tmPerfMark(mainCalendarEventsPerfTrace, 'calendar-events-fetched', {
                        calendar: 'main',
                        eventCount: Number(mainCalendarLastEventCount || 0),
                        tomatoCount: Array.isArray(a) ? a.length : 0,
                        scheduleCount,
                        taskDateCount,
                        holidayCount: Array.isArray(d) ? d.length : 0,
                        reminderCount: Array.isArray(e) ? e.length : 0,
                        rangeStart: formatDateKey(info?.start),
                        rangeEnd: formatDateKey(info?.end),
                        spanDays: rangeSpanDays,
                    });
                    const sum = summarizeRange(records);
                    const minTxt = sum.minMs ? formatDateKey(new Date(sum.minMs)) : '-';
                    const maxTxt = sum.maxMs ? formatDateKey(new Date(sum.maxMs)) : '-';
                    __tmUpdateMainCalendarStatus({
                        records: Array.isArray(a) ? a.length : 0,
                        holidays: Array.isArray(d) ? d.length : 0,
                        reminders: Array.isArray(e) ? e.length : 0,
                        rawTotal: sum.total,
                        bad: sum.bad,
                        minTxt,
                        maxTxt,
                        rangeStart: formatDateKey(info?.start),
                        rangeEnd: formatDateKey(info?.end),
                    });
                    success(events);
                } catch (e) {
                    __tmPerfFinish(mainCalendarEventsPerfTrace, {
                        calendar: 'main',
                        error: String(e?.message || e || '').trim() || 'calendar-events-failed',
                        eventCount: Number(mainCalendarLastEventCount || 0),
                    });
                    mainCalendarEventsPerfTrace = null;
                    failure(e);
                }
            },
            eventSources: [
                {
                    id: EVENT_SOURCE_IDS.mainSchedule,
                    events: async (info, success, failure) => {
                        try {
                            const settings = getSettings();
                            const events = await __tmBuildScheduleSourceEvents(info.start, info.end, settings);
                            __tmUpdateMainCalendarStatus({
                                schedules: Array.isArray(events) ? events.length : 0,
                                rangeStart: formatDateKey(info?.start),
                                rangeEnd: formatDateKey(info?.end),
                            });
                            success(events);
                        } catch (e) {
                            failure(e);
                        }
                    },
                },
                {
                    id: EVENT_SOURCE_IDS.mainTaskDate,
                    events: async (info, success, failure) => {
                        try {
                            const settings = getSettings();
                            const activeViewType = String((calendar && calendar.view && calendar.view.type) || '').trim();
                            const fallbackViewType = String(state._lastViewType || preferredInitialView || 'timeGridWeek').trim();
                            const viewType = activeViewType || fallbackViewType || 'timeGridWeek';
                            const events = await __tmBuildTaskDateSourceEvents(info.start, info.end, settings, viewType);
                            __tmUpdateMainCalendarStatus({
                                taskDates: Array.isArray(events) ? events.length : 0,
                                rangeStart: formatDateKey(info?.start),
                                rangeEnd: formatDateKey(info?.end),
                            });
                            success(events);
                        } catch (e) {
                            failure(e);
                        }
                    },
                },
            ],
            eventsSet: () => {
                try {
                    state.calendarRenderedVersionMain = Math.max(
                        Number(state.calendarRenderedVersionMain) || 0,
                        Number(state.calendarMutationVersion) || 0
                    );
                } catch (e) {}
            },
            eventClick: (arg) => {
                const jsEvent = arg?.jsEvent || null;
                const target = jsEvent?.target;
                const interactiveHit = resolveCalendarEventInteractiveHit(jsEvent, { preferredEventEl: arg?.el });
                const hitEventEl = interactiveHit?.eventEl instanceof Element ? interactiveHit.eventEl : null;
                const hitEventId = String(hitEventEl?.getAttribute?.('data-tm-cal-event-id') || '').trim();
                const activeEvent = hitEventId ? (calendar?.getEventById?.(hitEventId) || arg?.event || null) : (arg?.event || null);
                try {
                    if (jsEvent) {
                        jsEvent.__tmCalHandled = true;
                        jsEvent.preventDefault?.();
                    }
                } catch (e0) {}
                if (_tmClickTracker && _tmClickTracker.ts > 0 && jsEvent) {
                    const dur = Date.now() - _tmClickTracker.ts;
                    const x = Number(jsEvent.clientX);
                    const y = Number(jsEvent.clientY);
                    if (Number.isFinite(x) && Number.isFinite(y)) {
                        const dx = Math.abs(x - _tmClickTracker.x);
                        const dy = Math.abs(y - _tmClickTracker.y);
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dur > 500 || dist > 5) return;
                    }
                }
                if (interactiveHit?.kind === 'checkbox') {
                    const checkboxEl = interactiveHit.checkboxEl;
                    try {
                        if (checkboxEl && target !== checkboxEl && !(target instanceof Element && target.closest('.tm-cal-task-event-check'))) {
                            jsEvent?.preventDefault?.();
                            checkboxEl.click?.();
                        }
                    } catch (e0) {}
                    return;
                }
                try {
                    if (target instanceof Element && target.closest('.tm-cal-task-event-check')) return;
                } catch (e0) {}
                const ext = activeEvent?.extendedProps || {};
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
                        if (tid) openCalendarLinkedTask(tid, jsEvent);
                    } catch (e) {}
                    return;
                }
                if (source === 'reminder') {
                    const tid = String(ext.__tmReminderBlockId || '').trim();
                    try {
                        if (tid) openCalendarLinkedTask(tid, jsEvent);
                    } catch (e) {}
                    return;
                }
                if (interactiveHit?.kind === 'title') {
                    const tid = String(ext.__tmTaskId || '').trim();
                    if (source === 'schedule' && tid) {
                        try { openCalendarLinkedTask(tid, jsEvent); } catch (e) {}
                        return;
                    }
                }
                if (source === 'schedule') {
                    try {
                        const baseStart = String(ext.__tmScheduleBaseStart || '').trim();
                        const baseEnd = String(ext.__tmScheduleBaseEnd || '').trim();
                        openScheduleModal({
                            id: String(ext.__tmScheduleId || activeEvent?.id || ''),
                            title: String(activeEvent?.title || ''),
                            start: baseStart ? new Date(baseStart) : activeEvent?.start,
                            end: baseEnd ? new Date(baseEnd) : activeEvent?.end,
                            allDay: activeEvent?.allDay === true,
                            color: String(activeEvent?.backgroundColor || activeEvent?.borderColor || 'var(--tm-primary-color)'),
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
                    openRecordModal(activeEvent || arg.event);
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
                if (isMobileDevice) {
                    const viewType = String(calendar?.view?.type || '').trim();
                    if (viewType.startsWith('timeGrid')) return;
                }
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
                    await saveScheduleAll(list, {
                        reason: 'side-schedule-event-drop',
                        op: 'update',
                        scheduleId: id,
                        scheduleIds: [id],
                        rangeStart: list[idx]?.start,
                        rangeEnd: list[idx]?.end,
                    });
                    __tmSchedulePostMutationRefresh(list[idx], 'upsert', {
                        reason: 'side-schedule-event-drop',
                        flushTaskPanel: true,
                        version: Number(state.calendarMutationVersion) || 0,
                    });
                    toast('✅ 已更新日程', 'success');
                    return;
                }
                if (source === 'taskdate') {
                    try {
                        if (shouldCreateScheduleFromTaskDateDrop(arg)) {
                            await createScheduleFromTaskDateDrop(arg);
                            toast('✅ 已加入日程', 'success');
                            return;
                        }
                        await persistTaskDateEventChange(arg);
                        toast('✅ 已更新任务日期', 'success');
                    } catch (e) {
                        try { arg.revert(); } catch (e2) {}
                        toast(`❌ 更新任务日期失败：${String(e?.message || e || '')}`, 'error');
                    }
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
                    await saveScheduleAll(list, {
                        reason: 'side-schedule-event-resize',
                        op: 'update',
                        scheduleId: id,
                        scheduleIds: [id],
                        rangeStart: list[idx]?.start,
                        rangeEnd: list[idx]?.end,
                    });
                    __tmSchedulePostMutationRefresh(list[idx], 'upsert', {
                        reason: 'side-schedule-event-resize',
                        flushTaskPanel: true,
                        version: Number(state.calendarMutationVersion) || 0,
                    });
                    toast('✅ 已更新日程', 'success');
                    return;
                }
                if (source === 'taskdate') {
                    try {
                        await persistTaskDateEventChange(arg);
                        toast('✅ 已更新任务日期', 'success');
                    } catch (e) {
                        try { arg.revert(); } catch (e2) {}
                        toast(`❌ 更新任务日期失败：${String(e?.message || e || '')}`, 'error');
                    }
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
                try {
                    if (alignMainCalendar3DayTodayPosition(calendar, getSettings())) return;
                } catch (e) {}
                try { syncMainCalendarMonthViewLayout(wrap, host, calendar, getSettings()); } catch (e) {}
                try { bindCalendarDrop(wrap); } catch (e) {}
                try { syncMainCalendarViewSelect(wrap, calendar, { compact: !!(isMobileDevice || isDockHost) }); } catch (e) {}
                try { scheduleMainCalendarToolbarTitleSync(wrap, calendar); } catch (e) {}
                try { scheduleSyncTimeGridAllDayCollapseUi(host, calendar); } catch (e) {}
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
                try { scheduleMainCalendarLayoutRefresh(wrap, host, calendar, { updateSize: false }); } catch (e) {}
            },
            loading: (isLoading) => {
                try {
                    try {
                        wrap.classList.toggle('tm-calendar-wrap--view-switching', !!isLoading);
                        host.classList.toggle('tm-cal-view-switching', !!isLoading);
                    } catch (e2) {}
                    if (isLoading) {
                        ensureMainCalendarEventsPerfTrace({
                            start: calendar?.view?.activeStart,
                            end: calendar?.view?.activeEnd,
                        });
                    }
                    if (!isLoading) {
                        try {
                            requestAnimationFrame(() => {
                                try { wrap.classList.remove('tm-calendar-wrap--view-switching'); } catch (e3) {}
                                try { host.classList.remove('tm-cal-view-switching'); } catch (e3) {}
                            });
                        } catch (e3) {}
                        finishMainCalendarEventsPerfTrace({
                            rangeStart: formatDateKey(calendar?.view?.activeStart),
                            rangeEnd: formatDateKey(calendar?.view?.activeEnd),
                        });
                        scheduleMainCalendarLayoutRefresh(wrap, host, calendar, { updateSize: true });
                        try { scheduleMainCalendarToolbarTitleSync(wrap, calendar); } catch (e3) {}
                    }
                } catch (e) {}
            },
        });
        state.calendar = calendar;

        try { calendar.render(); } catch (e) {}
        try { syncMainCalendarMonthViewLayout(wrap, host, calendar, getSettings()); } catch (e) {}
        try { scheduleMainCalendarToolbarTitleSync(wrap, calendar); } catch (e) {}
        try { bindCalendarDrop(wrap); } catch (e) {}
        try { scheduleMainCalendarLayoutRefresh(wrap, host, calendar, { updateSize: true }); } catch (e) {}
        try { syncMainCalendarViewSelect(wrap, calendar, { compact: !!(isMobileDevice || isDockHost) }); } catch (e) {}
        try {
            state.filteredTasksListener = () => {
                try { scheduleTaskPageRender(wrap, getSettings()); } catch (e2) {}
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
                try { scheduleMainCalendarLayoutRefresh(wrap, host, calendar, { updateSize: true }); } catch (e2) {}
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
            const calendarResizeObserver = new ResizeObserver((entries) => {
                const entry = Array.isArray(entries) && entries.length ? entries[0] : null;
                const nextBox = {
                    width: Math.round(Number(entry?.contentRect?.width || calendarHost.clientWidth || 0)),
                    height: Math.round(Number(entry?.contentRect?.height || calendarHost.clientHeight || 0)),
                };
                const prevBox = state.calendarResizeBox || null;
                if (prevBox && prevBox.width === nextBox.width && prevBox.height === nextBox.height) return;
                state.calendarResizeBox = nextBox;
                // 使用 requestAnimationFrame 确保在渲染周期中执行
                try { scheduleMainCalendarLayoutRefresh(wrap, host, calendar, { updateSize: true }); } catch (e2) {}
            });
            calendarResizeObserver.observe(calendarHost);
            try { if (rootEl instanceof HTMLElement) calendarResizeObserver.observe(rootEl); } catch (e) {}
            try { if (wrap instanceof HTMLElement) calendarResizeObserver.observe(wrap); } catch (e) {}
            state.calendarResizeObserver = calendarResizeObserver;
        }

        const onToolbarClick = (e) => {
            const tabEl = e.target?.closest?.('[data-tm-cal-side-tab]');
            const tabKey = String(tabEl?.getAttribute?.('data-tm-cal-side-tab') || '').trim();
            if (tabKey) {
                setSidePage(wrap, tabKey);
                try { scheduleTaskPageRender(wrap, getSettings()); } catch (e2) {}
                return;
            }
            const masterEl = e.target?.closest?.('[data-tm-cal-master]');
            if (masterEl) return;
            const fcTodayButton = e.target?.closest?.('.fc-today-button');
            if (fcTodayButton) {
                try { clearTimeGridAutoCenterState('main'); } catch (e2) {}
                try {
                    requestAnimationFrame(() => {
                        try { scheduleCurrentTimeAutoCenter(host, calendar, getSettings(), { scope: 'main', force: true }); } catch (e3) {}
                    });
                } catch (e2) {}
                return;
            }
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
                scheduleTaskPageRender(wrap, getSettings());
                return;
            }
            if (action === 'taskNext') {
                state.taskPage = (Number(state.taskPage) || 1) + 1;
                scheduleTaskPageRender(wrap, getSettings());
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
                        window.tmRefreshCalendarInPlace({ silent: false, hard: true }).catch(() => null);
                    } else if (typeof window.tmRefresh === 'function') {
                        window.tmRefresh().catch(() => null);
                    } else {
                        scheduleCalendarRefresh({
                            reason: 'calendar-toolbar-refresh',
                            main: true,
                            side: true,
                            flushTaskPanel: true,
                            hard: true,
                        });
                    }
                } catch (e2) {}
                return;
            }
            if (action === 'today') {
                try {
                    const currentView = String(calendar?.view?.type || '').trim();
                    clearTimeGridAutoCenterState('main');
                    calendar.gotoDate(resolveMainCalendarAnchorDate(new Date(), currentView, getSettings()) || new Date());
                    scheduleCurrentTimeAutoCenter(host, calendar, getSettings(), { scope: 'main', force: true });
                } catch (e2) {}
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
                if (target.closest('.tm-cal-task-event-check')) return;
                const hostEl = target.closest('.tm-calendar-host');
                const inPopover = !!target.closest('.fc-popover');
                if (!hostEl && !inPopover) return;
                if (target.closest('.fc-header-toolbar')) return;
                if (target.closest('.tm-cal-allday-summary, .tm-cal-allday-toggle')) return;
                // 修复：点击"更多"链接时不拦截，让 FullCalendar 默认处理
                // 检查多种可能的更多链接类名
                if (target.closest('.fc-more')) return;
                if (target.closest('.fc-more-link')) return;
                if (target.closest('.fc-popover-close')) return;
                // 检查是否是点击在更多链接内部的文本或图标
                if (target.classList.contains('fc-more-link')) return;
                if (target.classList.contains('fc-more')) return;
                // 注意：不拦截 .fc-popover，因为弹出窗口内部的事件需要支持点击跳转
                const interactiveHit = resolveCalendarEventInteractiveHit(e);
                const eventEl = interactiveHit?.eventEl instanceof Element ? interactiveHit.eventEl : null;
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
                    if (interactiveHit?.kind === 'checkbox') {
                        const checkEl = interactiveHit.checkboxEl;
                        if (target !== checkEl && !target.closest('.tm-cal-task-event-check')) {
                            try { e.preventDefault?.(); } catch (e2) {}
                            try { checkEl.click?.(); } catch (e2) {}
                        }
                        return;
                    }
                    if (interactiveHit?.kind === 'title') {
                        try { e.preventDefault?.(); } catch (e2) {}
                        try { openCalendarLinkedTask(tid, e); } catch (e2) {}
                        return;
                    }
                }
                if (source === 'taskdate') {
                    if (tid) {
                        try { openCalendarLinkedTask(tid, e); } catch (e2) {}
                    }
                    return;
                }
                if (source === 'reminder') {
                    if (rid) {
                        try { openCalendarLinkedTask(rid, e); } catch (e2) {}
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
                            color: String(api?.backgroundColor || api?.borderColor || 'var(--tm-primary-color)'),
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
                if (getSettings().scheduleFollowDocColor || String(getSettings().taskDateColorMode || 'group').trim() === 'group') return;
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
            try { scheduleTaskPageRender(wrap, getSettings()); } catch (e2) {}
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
                if (kk === 'focus') store.data.calendarColorFocus = 'var(--tm-primary-color)';
                if (kk === 'break') store.data.calendarColorBreak = 'var(--tm-success-color)';
                if (kk === 'stopwatch') store.data.calendarColorStopwatch = 'var(--tm-warning-color, #f9ab00)';
                if (kk === 'idle') store.data.calendarColorIdle = '#9aa0a6';
            } else {
                return;
            }
            try { await store.save(); } catch (e2) {}
            try { renderSidebar(wrap, getSettings()); } catch (e2) {}
            try { scheduleTaskPageRender(wrap, getSettings()); } catch (e2) {}
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
            const value = String(dot.getAttribute('data-tm-cal-color-value') || '').trim() || 'var(--tm-primary-color)';
            if (kind === 'taskDates' && (getSettings().scheduleFollowDocColor || String(getSettings().taskDateColorMode || 'group').trim() === 'group')) return;
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
                try { scheduleTaskPageRender(wrap, getSettings()); } catch (e2) {}
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
                try { scheduleTaskPageRender(wrap, getSettings()); } catch (e2) {}
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
            const docCalId = String(el.getAttribute('data-tm-cal-calendar-doc') || '').trim();
            const docId = String(el.getAttribute('data-tm-cal-doc-id') || '').trim();
            if (docCalId && docId) {
                const prev = (store.data.calendarCalendarsConfig && typeof store.data.calendarCalendarsConfig === 'object' && !Array.isArray(store.data.calendarCalendarsConfig))
                    ? store.data.calendarCalendarsConfig
                    : {};
                const entry = (prev[docCalId] && typeof prev[docCalId] === 'object') ? prev[docCalId] : {};
                const nextDocsEnabled = (entry.docsEnabled && typeof entry.docsEnabled === 'object' && !Array.isArray(entry.docsEnabled))
                    ? { ...entry.docsEnabled }
                    : {};
                if (checked) delete nextDocsEnabled[docId];
                else nextDocsEnabled[docId] = false;
                const nextEntry = { ...entry };
                if (Object.keys(nextDocsEnabled).length > 0) nextEntry.docsEnabled = nextDocsEnabled;
                else delete nextEntry.docsEnabled;
                store.data.calendarCalendarsConfig = { ...prev, [docCalId]: nextEntry };
                try { await store.save(); } catch (e2) {}
                try { renderSidebar(wrap, getSettings()); } catch (e2) {}
                try { refetchAllCalendars(); } catch (e2) {}
                return;
            }
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
        try { clearTimeGridAutoCenterState('main'); } catch (e) {}
        if (state.rootEl instanceof HTMLElement) {
            try { state.rootEl.classList.remove('tm-calendar-root--month-view'); } catch (e) {}
            try { state.rootEl.style.removeProperty('--tm-view-bottom-inset'); } catch (e) {}
            try { state.rootEl.style.removeProperty('--tm-calendar-month-visible-events'); } catch (e) {}
            try { state.rootEl.style.removeProperty('--tm-calendar-month-viewport-height'); } catch (e) {}
        }
        if (state.wrapEl) {
            try { state.wrapEl.classList.remove('tm-calendar-wrap--month-view'); } catch (e) {}
            try { state.wrapEl.style.removeProperty('--tm-calendar-month-visible-events'); } catch (e) {}
            try { state.wrapEl.style.removeProperty('--tm-calendar-month-viewport-height'); } catch (e) {}
            try {
                const navPane = state.wrapEl.querySelector('.tm-calendar-nav');
                if (navPane instanceof HTMLElement) {
                    if (navPane.__tmCalendarNavScrollFxTimer) {
                        clearTimeout(navPane.__tmCalendarNavScrollFxTimer);
                        navPane.__tmCalendarNavScrollFxTimer = 0;
                    }
                    navPane.__tmCalendarNavScrollResizeObserver?.disconnect?.();
                    navPane.__tmCalendarNavScrollResizeObserver = null;
                    navPane.__tmCalendarNavScrollMutationObserver?.disconnect?.();
                    navPane.__tmCalendarNavScrollMutationObserver = null;
                    navPane.__tmCalendarNavScrollUpdateThumb = null;
                    navPane.__tmCalendarNavScrollFxBound = false;
                }
            } catch (e) {}
            try { if (state.onToolbarClick) state.wrapEl.removeEventListener('click', state.onToolbarClick); } catch (e) {}
            try { if (state.onSidebarContextMenu) state.wrapEl.removeEventListener('contextmenu', state.onSidebarContextMenu); } catch (e) {}
            try { if (state.onFilterChange) state.wrapEl.removeEventListener('change', state.onFilterChange); } catch (e) {}
            try { if (state.onCalendarEventClickFallbackCapture) state.wrapEl.removeEventListener('click', state.onCalendarEventClickFallbackCapture, true); } catch (e) {}
        }
        state.onToolbarClick = null;
        state.onSidebarContextMenu = null;
        state.onFilterChange = null;
        state.onCalendarEventClickFallbackCapture = null;
        if (state.calendarEl instanceof HTMLElement) {
            try { state.calendarEl.classList.remove('tm-calendar-host--month-view'); } catch (e) {}
            try { state.calendarEl.style.removeProperty('--tm-calendar-month-visible-events'); } catch (e) {}
            try { state.calendarEl.style.removeProperty('--tm-calendar-month-viewport-height'); } catch (e) {}
        }
        state.wrapEl = null;
        if (state.uiAbort) {
            try { state.uiAbort.abort(); } catch (e) {}
            state.uiAbort = null;
        }
        if (state.taskPageRenderRaf) {
            try { cancelAnimationFrame(state.taskPageRenderRaf); } catch (e) {}
            state.taskPageRenderRaf = null;
        }
        state.taskPageRenderWrap = null;
        state.taskPageRenderSettings = null;
        if (state.mainLayoutRaf) {
            try { cancelAnimationFrame(state.mainLayoutRaf); } catch (e) {}
            state.mainLayoutRaf = null;
        }
        state.mainLayoutWrap = null;
        state.mainLayoutHost = null;
        state.mainLayoutCalendar = null;
        state.mainLayoutNeedsUpdateSize = false;
        try { state.calendarDropAbort?.abort?.(); } catch (e) {}
        state.calendarDropAbort = null;
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
        state.calendarResizeBox = null;
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
        destroyTaskDraggable();
        if (state.mobileDragCloseTimer) {
            try { clearTimeout(state.mobileDragCloseTimer); } catch (e) {}
            state.mobileDragCloseTimer = null;
        }
        try { hideFloatingMiniCalendar(); } catch (e) {}
        state.taskListEl = null;
        state.taskPageHost = null;
        state.taskPageHtml = '';
        state.cnHolidaySignature = '';
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
        state.isDockHost = false;
        state.sidebarOpen = false;
    }

    function renderSettings(containerEl, settingsStore) {
        if (!containerEl || !(containerEl instanceof Element)) return false;
        state.settingsStore = settingsStore || state.settingsStore || null;
        const s = getSettings();
        const monthMinVisibleEventsDisabled = s.monthAdaptiveRowHeight !== false;
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
                    <div class="tm-calendar-settings-label">3日视图今天位置</div>
                    <select class="tm-calendar-settings-select" data-tm-cal-setting="calendar3DayTodayPosition">
                        <option value="1" ${Number(s.threeDayTodayPosition) === 1 ? 'selected' : ''}>第1日</option>
                        <option value="2" ${Number(s.threeDayTodayPosition) === 2 ? 'selected' : ''}>第2日</option>
                        <option value="3" ${Number(s.threeDayTodayPosition) === 3 ? 'selected' : ''}>第3日</option>
                    </select>
                </div>
                <div class="tm-calendar-settings-row">
                    <div class="tm-calendar-settings-label">默认折叠桌面端日历左侧侧边栏</div>
                    <input class="b3-switch fn__flex-center" type="checkbox" data-tm-cal-setting="calendarSidebarCollapsedDesktopDefault" ${s.collapseDesktopSidebarDefault ? 'checked' : ''}>
                </div>
                <div class="tm-calendar-settings-row">
                    <div class="tm-calendar-settings-label">侧边栏默认打开区域</div>
                    <select class="tm-calendar-settings-select" data-tm-cal-setting="calendarSidebarDefaultPage">
                        <option value="calendar" ${s.defaultSidebarPage === 'calendar' ? 'selected' : ''}>日历区域</option>
                        <option value="tasks" ${s.defaultSidebarPage === 'tasks' ? 'selected' : ''}>任务区域</option>
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
                    <div class="tm-calendar-settings-label">月视图自适应行高</div>
                    <input class="b3-switch fn__flex-center" type="checkbox" data-tm-cal-setting="calendarMonthAdaptiveRowHeight" ${s.monthAdaptiveRowHeight !== false ? 'checked' : ''}>
                </div>
                <div class="tm-calendar-settings-row" style="${monthMinVisibleEventsDisabled ? 'opacity:0.55;' : ''}">
                    <div class="tm-calendar-settings-label">月视图最少展示日程</div>
                    <select class="tm-calendar-settings-select" data-tm-cal-setting="calendarMonthMinVisibleEvents" ${monthMinVisibleEventsDisabled ? 'disabled' : ''}>
                        <option value="1" ${Number(s.monthMinVisibleEvents) === 1 ? 'selected' : ''}>1 条</option>
                        <option value="2" ${Number(s.monthMinVisibleEvents) === 2 ? 'selected' : ''}>2 条</option>
                        <option value="3" ${Number(s.monthMinVisibleEvents) === 3 ? 'selected' : ''}>3 条</option>
                        <option value="4" ${Number(s.monthMinVisibleEvents) === 4 ? 'selected' : ''}>4 条</option>
                        <option value="5" ${Number(s.monthMinVisibleEvents) === 5 ? 'selected' : ''}>5 条</option>
                        <option value="6" ${Number(s.monthMinVisibleEvents) === 6 ? 'selected' : ''}>6 条</option>
                        <option value="7" ${Number(s.monthMinVisibleEvents) === 7 ? 'selected' : ''}>7 条</option>
                        <option value="8" ${Number(s.monthMinVisibleEvents) === 8 ? 'selected' : ''}>8 条</option>
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
                    <div class="tm-calendar-settings-label">全天区隐藏已安排任务</div>
                    <input class="b3-switch fn__flex-center" type="checkbox" data-tm-cal-setting="calendarHideScheduledTaskDatesInAllDay" ${s.hideScheduledTaskDatesInAllDay ? 'checked' : ''}>
                </div>
                <div class="tm-calendar-settings-row">
                    <div class="tm-calendar-settings-label">其他块显示复选框</div>
                    <input class="b3-switch fn__flex-center" type="checkbox" data-tm-cal-setting="calendarShowOtherBlockCheckbox" ${s.showOtherBlockCheckbox ? 'checked' : ''}>
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
                <div class="tm-calendar-settings-row">
                    <div class="tm-calendar-settings-label">日程跟随文档颜色</div>
                    <input class="b3-switch fn__flex-center" type="checkbox" data-tm-cal-setting="calendarScheduleFollowDocColor" ${s.scheduleFollowDocColor ? 'checked' : ''}>
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
            } else if (key === 'calendar3DayTodayPosition') {
                store.data[key] = normalizeCalendar3DayTodayPosition(el.value);
            } else if (key === 'calendarNewScheduleMaxDurationMin') {
                const allowed = new Set([60, 120, 180, 240]);
                const num = Number(el.value);
                store.data[key] = allowed.has(num) ? num : 60;
            } else if (key === 'calendarHourSlotHeightMode') {
                store.data[key] = normalizeCalendarHourSlotHeightMode(el.value);
            } else if (key === 'calendarMonthMinVisibleEvents') {
                store.data[key] = normalizeCalendarMonthMinVisibleEvents(el.value);
            } else if (key === 'calendarSidebarDefaultPage') {
                store.data[key] = normalizeCalendarSidebarDefaultPage(el.value);
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
                    try { clearTimeGridAutoCenterState('main'); } catch (e2) {}
                    try { clearTimeGridAutoCenterState('sideDay'); } catch (e2) {}
                    try { applyCalendarVisibleSlotRange(state.calendar, settings); } catch (e2) {}
                    try { applyCalendarVisibleSlotRange(state.sideDay?.calendar, settings); } catch (e2) {}
                    try { state.calendar?.updateSize?.(); } catch (e2) {}
                    try { scheduleMainCalendarLayoutRefresh(state.wrapEl, state.calendarEl, state.calendar, { updateSize: true }); } catch (e2) {}
                    try { syncSideDayLayout(state.sideDay?.rootEl, state.sideDay?.calendar, settings); } catch (e2) {}
                } else if (key === 'calendar3DayTodayPosition') {
                    const settings = getSettings();
                    try { realignMainCalendar3DayTodayRange(state.calendar, settings); } catch (e2) {}
                } else if (key === 'calendarSidebarCollapsedDesktopDefault') {
                    try {
                        const root = state.wrapEl;
                        if (root instanceof HTMLElement && !root.classList.contains('tm-calendar-wrap--mobile') && state.isDockHost !== true) {
                            setCalendarSidebarOpen(root, !store.data.calendarSidebarCollapsedDesktopDefault, state.sidePage || 'calendar');
                        }
                    } catch (e2) {}
                } else if (key === 'calendarSidebarDefaultPage') {
                    try {
                        const root = state.wrapEl;
                        const nextPage = normalizeCalendarSidebarDefaultPage(store.data.calendarSidebarDefaultPage);
                        state.sidePage = nextPage;
                        if (root instanceof HTMLElement) {
                            setSidePage(root, nextPage);
                            if (nextPage === 'tasks') scheduleTaskPageRender(root, getSettings());
                        }
                    } catch (e2) {}
                } else if (key === 'calendarHourSlotHeightMode') {
                    const settings = getSettings();
                    try { refreshCalendarSlotHeight(settings); } catch (e2) {}
                } else if (key === 'calendarMonthMinVisibleEvents' || key === 'calendarMonthAdaptiveRowHeight') {
                    if (key === 'calendarMonthAdaptiveRowHeight') {
                        try { renderSettings(containerEl, store); } catch (e2) {}
                    }
                    const settings = getSettings();
                    try { syncMainCalendarMonthViewLayout(state.wrapEl, state.calendarEl, state.calendar, settings); } catch (e2) {}
                    try { scheduleMainCalendarLayoutRefresh(state.wrapEl, state.calendarEl, state.calendar, { updateSize: true }); } catch (e2) {}
                } else if (key === 'calendarScheduleReminderEnabled' || key === 'calendarScheduleReminderSystemEnabled' || key === 'calendarScheduleReminderDefaultMode' || key === 'calendarAllDayReminderEnabled' || key === 'calendarAllDayReminderTime' || key === 'calendarTaskDateAllDayReminderEnabled' || key === 'calendarAllDaySummaryIncludeExtras') {
                    try { renderSettings(containerEl, store); } catch (e2) {}
                    try { scheduleScheduleReminderRefresh('settings'); } catch (e2) {}
                } else if (key === 'calendarShowOtherBlockCheckbox' || key === 'calendarHideScheduledTaskDatesInAllDay' || key === 'calendarTaskDateColorMode' || key === 'calendarScheduleFollowDocColor') {
                    try {
                        const root = state.wrapEl;
                        if (root) renderSidebar(root, getSettings());
                    } catch (e2) {}
                    try { refetchAllCalendars(); } catch (e2) {}
                } else if (key === 'calendarNewScheduleMaxDurationMin') {
                    try {
                        const root = state.wrapEl;
                        if (root) scheduleTaskPageRender(root, getSettings());
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
                color: String(item.color || 'var(--tm-primary-color)'),
                calendarId: String(item.calendarId || 'default'),
                taskId: String(item.taskId || item.task_id || item.linkedTaskId || item.linked_task_id || '').trim(),
                blockId: getScheduleLinkedBlockId(item),
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

    function buildScheduleEditorInitFromInput(input) {
        const extra = (input && typeof input === 'object') ? input : {};
        const settings = getSettings();
        const taskId = String(extra.taskId || '').trim();
        const blockId = getScheduleLinkedBlockId(extra);
        const title0 = String(extra.title || '').trim();
        const calendarId0 = String(extra.calendarId || '').trim() || pickDefaultCalendarId(settings);
        const reminderMode0 = String(extra.reminderMode || '').trim() || 'inherit';
        const startKey = String(extra.taskDateStartKey || extra.startKey || '').trim();
        const endExKey = String(extra.taskDateEndExclusiveKey || extra.endExclusiveKey || '').trim();
        const color0 = String(extra.color || '').trim();
        const taskStartDate0 = String(extra.taskStartDate || extra.startDate || '').trim();
        const taskCompletionTime0 = String(extra.taskCompletionTime || extra.completionTime || '').trim();

        if (startKey && endExKey) {
            const startDate = parseDateOnly(startKey);
            const endDate = parseDateOnly(endExKey);
            if (startDate && endDate) {
                const s = new Date(startDate.getTime());
                s.setHours(0, 0, 0, 0);
                const e = new Date(endDate.getTime());
                e.setHours(0, 0, 0, 0);
                if (e.getTime() > s.getTime()) {
                    return {
                        title: title0 || (taskId ? '任务' : '日程'),
                        start: s,
                        end: e,
                        allDay: true,
                        color: color0,
                        calendarId: calendarId0,
                        taskId,
                        blockId,
                        taskDateEditor: true,
                        taskStartDate: taskStartDate0,
                        taskCompletionTime: taskCompletionTime0,
                        taskDateStartKey: startKey,
                        taskDateEndExclusiveKey: endExKey,
                        reminderMode: reminderMode0,
                        reminderEnabled: extra.reminderEnabled,
                        reminderOffsetMin: extra.reminderOffsetMin,
                    };
                }
            }
        }

        let start = extra.start instanceof Date ? new Date(extra.start.getTime()) : null;
        if (!(start instanceof Date) || Number.isNaN(start.getTime())) {
            const startMs = toMs(extra.start);
            if (Number.isFinite(startMs) && startMs > 0) start = new Date(startMs);
        }
        const allDay = extra.allDay === true;
        if (!(start instanceof Date) || Number.isNaN(start.getTime())) {
            start = new Date();
            start.setSeconds(0, 0);
        }
        if (allDay) start.setHours(0, 0, 0, 0);

        let end = extra.end instanceof Date ? new Date(extra.end.getTime()) : null;
        if (!(end instanceof Date) || Number.isNaN(end.getTime())) {
            const endMs = toMs(extra.end);
            if (Number.isFinite(endMs) && endMs > 0) end = new Date(endMs);
        }
        if (!(end instanceof Date) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
            end = new Date(start.getTime() + (allDay ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000));
        }
        if (allDay) {
            end.setHours(0, 0, 0, 0);
            if (end.getTime() <= start.getTime()) end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        }

        return {
            title: title0 || (taskId ? '任务' : '日程'),
            start,
            end,
            allDay,
            color: color0,
            calendarId: calendarId0,
            taskId,
            blockId,
            reminderMode: reminderMode0,
            reminderEnabled: extra.reminderEnabled,
            reminderOffsetMin: extra.reminderOffsetMin,
        };
    }

    async function openScheduleEditor(input) {
        const extra = (input && typeof input === 'object') ? input : {};
        const sid = String(extra.id || extra.scheduleId || '').trim();
        if (sid) return await openScheduleEditorById(sid);
        const tid = String(extra.taskId || '').trim();
        const blockId = getScheduleLinkedBlockId(extra);
        try {
            if (tid) {
                const list = await loadScheduleAll();
                const items = (Array.isArray(list) ? list : []).filter((x) => {
                    const t = String(x?.taskId || x?.task_id || x?.linkedTaskId || x?.linked_task_id || '').trim();
                    return t === tid;
                }).sort((a, b) => toMs(a?.start) - toMs(b?.start));
                if (items.length > 0) {
                    const now = Date.now();
                    const next = items.find((x) => {
                        const s = toMs(x?.start);
                        return Number.isFinite(s) && s >= now;
                    }) || items[items.length - 1];
                    const nextId = String(next?.id || '').trim();
                    if (nextId) return await openScheduleEditorById(nextId);
                }
            }
            if (blockId) {
                const list = await loadScheduleAll();
                const items = (Array.isArray(list) ? list : []).filter((x) => getScheduleLinkedBlockId(x) === blockId).sort((a, b) => toMs(a?.start) - toMs(b?.start));
                if (items.length > 0) {
                    const now = Date.now();
                    const next = items.find((x) => {
                        const s = toMs(x?.start);
                        return Number.isFinite(s) && s >= now;
                    }) || items[items.length - 1];
                    const nextId = String(next?.id || '').trim();
                    if (nextId) return await openScheduleEditorById(nextId);
                }
            }
            openScheduleModal(buildScheduleEditorInitFromInput(extra));
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
                if (startKey && endExKey) {
                    openScheduleModal(buildScheduleEditorInitFromInput({
                        ...extra,
                        taskId: tid,
                    }));
                    return true;
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
        const removedItem = list.find((x) => String(x?.id || '').trim() === id) || null;
        const next = list.filter((x) => String(x?.id || '').trim() !== id);
        if (next.length === list.length) return false;
        await saveScheduleAll(next, {
            reason: 'delete-schedule',
            op: 'delete',
            scheduleId: id,
            scheduleIds: [id],
            rangeStart: removedItem?.start,
            rangeEnd: removedItem?.end,
        });
        if (opts.closeModal !== false) {
            try { closeModal(); } catch (e) {}
        }
        try {
            __tmSchedulePostMutationRefresh(removedItem, 'delete', {
                reason: 'delete-schedule',
                flushTaskPanel: true,
                hard: String(state.calendar?.view?.type || '').trim() === 'dayGridMonth',
                rangeStart: removedItem?.start,
                rangeEnd: removedItem?.end,
                version: Number(state.calendarMutationVersion) || 0,
            });
        } catch (e) {}
        return true;
    }

    async function reassignScheduleLinkedTask(scheduleId, nextTaskId, options = {}) {
        const id = String(scheduleId || '').trim();
        const taskId = String(nextTaskId || '').trim();
        if (!id || !taskId) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const list = await loadScheduleAll();
        const idx = list.findIndex((item) => String(item?.id || '').trim() === id);
        if (idx < 0) return false;
        const prevItem = (list[idx] && typeof list[idx] === 'object') ? list[idx] : {};
        if (normalizeScheduleRepeatType(getScheduleRepeatType(prevItem)) !== 'none') return true;
        list[idx] = {
            ...prevItem,
            taskId,
            task_id: taskId,
            linkedTaskId: taskId,
            linked_task_id: taskId,
        };
        await saveScheduleAll(list, {
            reason: 'reassign-schedule-linked-task',
            op: 'update',
            scheduleId: id,
            scheduleIds: [id],
            rangeStart: list[idx]?.start,
            rangeEnd: list[idx]?.end,
        });
        if (opts.refetch !== false) {
            try {
                scheduleCalendarRefresh({
                    reason: 'reassign-schedule-linked-task',
                    main: true,
                    side: true,
                    flushTaskPanel: true,
                    rangeStart: list[idx]?.start,
                    rangeEnd: list[idx]?.end,
                    version: Number(state.calendarMutationVersion) || 0,
                });
            } catch (e) {}
        }
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
        showFloatingMiniCalendar,
        hideFloatingMiniCalendar,
        updateFloatingMiniCalendarDrag,
        finalizeFloatingMiniCalendarTouchDrop,
        mountSideDayTimeline,
        unmountSideDayTimeline,
        setSideDayDate,
        shiftSideDay,
        getSideDayDate,
        relayoutSideDayDate,
        addTaskSchedule,
        setScheduleOccurrenceDone,
        listTaskSchedulesByDay,
        openScheduleEditor,
        openScheduleEditorById,
        openScheduleEditorByTaskId,
        deleteScheduleById,
        reassignScheduleLinkedTask,
        setSettingsStore,
        requestRefresh: scheduleCalendarRefresh,
        refreshInPlace,
        syncTaskDateInPlace,
        syncTaskDoneInPlace,
        refreshSideDayLayout,
    };
})();
