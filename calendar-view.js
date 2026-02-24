(function () {
    const STORAGE = {
        DOCK_TOMATO_FILE_NEW: '/data/storage/petal/siyuan-plugin-docktomato/tomato-history.json',
        DOCK_TOMATO_FILE_LEGACY: '/data/storage/tomato-history.json',
        DOCK_TOMATO_LS_KEY: 'siyuan-tomato-history',
        SCHEDULE_FILE: '/data/storage/petal/siyuan-plugin-task-horizon/calendar-events.json',
        SCHEDULE_LS_KEY: 'tm-calendar-events',
    };

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
        isMobileDevice: false,
        sidebarOpen: false,
        mobileDragCloseTimer: null,
        sidebarColorMenuCloseHandler: null,
        sidebarColorMenuBindTimer: null,
    };

    function esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
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

    function isAllDayRange(start, end) {
        if (!(start instanceof Date) || !(end instanceof Date)) return false;
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
        if (end.getTime() <= start.getTime()) return false;
        if (start.getHours() !== 0 || start.getMinutes() !== 0 || start.getSeconds() !== 0 || start.getMilliseconds() !== 0) return false;
        if (end.getHours() !== 0 || end.getMinutes() !== 0 || end.getSeconds() !== 0 || end.getMilliseconds() !== 0) return false;
        const days = (end.getTime() - start.getTime()) / 86400000;
        return Number.isInteger(days) && days >= 1;
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
        return await res.text();
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

    function getSettings() {
        const s = state.settingsStore?.data || {};
        const tomatoMaster = s.calendarShowTomatoMaster !== false;
        return {
            enabled: !!s.calendarEnabled,
            linkDockTomato: !!s.calendarLinkDockTomato,
            firstDay: Number(s.calendarFirstDay) === 0 ? 0 : 1,
            monthAggregate: !!s.calendarMonthAggregate,
            showSchedule: s.calendarShowSchedule !== false,
            showTaskDates: s.calendarShowTaskDates !== false,
            taskDateColorMode: String(s.calendarTaskDateColorMode || 'group').trim() || 'group',
            scheduleColor: String(s.calendarScheduleColor || '').trim(),
            taskDatesColor: String(s.calendarTaskDatesColor || '').trim(),
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
        const groups = state.settingsStore?.data?.docGroups;
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
                        try {
                            const meta = (typeof window.tmCalendarGetTaskDragMeta === 'function') ? window.tmCalendarGetTaskDragMeta(taskId) : null;
                            title = String(meta?.title || '').trim();
                            calendarId = String(meta?.calendarId || '').trim();
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
                    const safeMin = (Number.isFinite(durMin) && durMin > 0) ? Math.round(durMin) : 60;
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
        const api = globalThis.tmRenderCalendarTaskTableHtml;
        if (typeof api !== 'function') {
            host.innerHTML = `<div class="tm-calendar-task-empty">未检测到任务表格渲染接口</div>`;
            state.taskListEl = null;
            return;
        }
        let html = '';
        try { html = String(api() || ''); } catch (e) { html = ''; }
        host.innerHTML = html || `<div class="tm-calendar-task-empty">暂无任务</div>`;
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
            }, { signal: abort.signal });

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
                            if (wrapEl) setMobileSidebarOpen(wrapEl, false);
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
                        if (wrapEl) setMobileSidebarOpen(wrapEl, false);
                    } catch (e2) {}
                }, { signal: abort.signal });
            }
        } catch (e) {}
        try { globalThis.tmCalendarApplyCollapseDom?.(); } catch (e) {}
        bindTaskDraggable(settings);
    }

    function setSidePage(wrap, next) {
        const v = (next === 'tasks') ? 'tasks' : 'calendar';
        state.sidePage = v;
        try {
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

    function setMobileSidebarOpen(wrap, open, page) {
        try {
            if (!wrap || !wrap.classList?.contains?.('tm-calendar-wrap--mobile')) return false;
            if (page) setSidePage(wrap, page);
            const next = !!open;
            wrap.classList.toggle('tm-calendar-wrap--sidebar-open', next);
            state.sidebarOpen = next;
            try { requestAnimationFrame(() => { try { state.calendar?.updateSize?.(); } catch (e2) {} }); } catch (e) {}
            return next;
        } catch (e) {
            return false;
        }
    }

    function toggleMobileSidebar(wrap, open, page) {
        const isMobile = !!wrap?.classList?.contains?.('tm-calendar-wrap--mobile');
        if (!isMobile) return false;
        const next = (open === undefined) ? !wrap.classList.contains('tm-calendar-wrap--sidebar-open') : !!open;
        return setMobileSidebarOpen(wrap, next, page);
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
        const getDropStart = (target, x, y) => {
            const resolveFrom = (el) => {
                if (!el) return null;
                const slot = el.closest?.('.fc-timegrid-slot');
                const col = el.closest?.('.fc-timegrid-col');
                const day = el.closest?.('.fc-daygrid-day');
                if (slot && col) {
                    const dateStr = String(col.getAttribute('data-date') || '').trim();
                    const timeStr = String(slot.getAttribute('data-time') || '').trim();
                    if (dateStr && timeStr) {
                        const hhmm = timeStr.slice(0, 5);
                        const dt = new Date(`${dateStr}T${hhmm}:00`);
                        return Number.isNaN(dt.getTime()) ? null : dt;
                    }
                }
                if (day) {
                    const dateStr = String(day.getAttribute('data-date') || '').trim();
                    if (dateStr) {
                        const dt = new Date(`${dateStr}T09:00:00`);
                        return Number.isNaN(dt.getTime()) ? null : dt;
                    }
                }
                return null;
            };
            const el0 = (target instanceof Element) ? target : null;
            const r0 = resolveFrom(el0);
            if (r0) return r0;
            return resolveFrom(document.elementFromPoint(x, y));
        };

        host.addEventListener('dragover', (e) => {
            const ok = e.dataTransfer && (Array.from(e.dataTransfer.types || []).includes('application/x-tm-task') || Array.from(e.dataTransfer.types || []).includes('text/plain'));
            if (ok) e.preventDefault();
        });
        host.addEventListener('drop', async (e) => {
            try {
                e.preventDefault();
                const raw = String(e.dataTransfer?.getData?.('application/x-tm-task') || e.dataTransfer?.getData?.('text/plain') || '');
                const data = JSON.parse(raw);
                const taskId = String(data?.id || '').trim();
                const title = String(data?.title || '').trim();
                const durationMin = Number(data?.durationMin);
                const calendarId = String(data?.calendarId || '').trim();
                if (!taskId) return;
                const start = getDropStart(e.target, e.clientX, e.clientY) || new Date();
                const safeMin = (Number.isFinite(durationMin) && durationMin > 0) ? Math.round(durationMin) : 60;
                const end = new Date(start.getTime() + safeMin * 60000);
                const settings = getSettings();
                const calId = calendarId || pickDefaultCalendarId(settings);
                const item = {
                    id: uuid(),
                    title: title || '任务',
                    start: safeISO(start),
                    end: safeISO(end),
                    color: '',
                    calendarId: calId,
                    taskId,
                };
                const list = await loadScheduleAll();
                list.push(item);
                await saveScheduleAll(list);
                try { state.calendar?.refetchEvents?.(); } catch (e2) {}
                toast('✅ 已加入日程', 'success');
            } catch (e2) {}
        });
    }

    function bindSidebarResize(wrap) {
        const sidebar = wrap?.querySelector?.('.tm-calendar-sidebar');
        const resizer = wrap?.querySelector?.('[data-tm-cal-role="sidebar-resizer"]');
        if (!sidebar || !resizer) return;
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
        const onUp = () => {
            dragging = false;
            try { document.body.classList.remove('tm-cal-resizing'); } catch (e) {}
            try { document.removeEventListener('mousemove', onMove, true); } catch (e) {}
            try { document.removeEventListener('mouseup', onUp, true); } catch (e) {}
        };
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

    async function loadScheduleAll() {
        try {
            const raw = await getFileText(STORAGE.SCHEDULE_FILE);
            if (raw && raw.trim()) {
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed) ? parsed : [];
            }
        } catch (e) {}
        try {
            const raw = String(localStorage.getItem(STORAGE.SCHEDULE_LS_KEY) || '');
            if (!raw.trim()) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    async function saveScheduleAll(items) {
        const list = Array.isArray(items) ? items : [];
        try { localStorage.setItem(STORAGE.SCHEDULE_LS_KEY, JSON.stringify(list)); } catch (e) {}
        try { await putFileText(STORAGE.SCHEDULE_FILE, JSON.stringify(list, null, 2)); } catch (e) {}
        return true;
    }

    async function loadScheduleForRange(rangeStart, rangeEnd) {
        const startMs = toMs(rangeStart);
        const endMs = toMs(rangeEnd);
        const list = await loadScheduleAll();
        return list.filter((it) => {
            const s = toMs(it?.start);
            const e = toMs(it?.end);
            if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return false;
            return overlap(s, e, startMs, endMs);
        });
    }

    function buildEventsFromSchedule(items, settings) {
        if (!settings.showSchedule) return [];
        const defs = getCalendarDefs(settings);
        const defMap = new Map(defs.map((d) => [d.id, d]));
        return (Array.isArray(items) ? items : []).map((it) => {
            const rs = toMs(it?.start);
            const re = toMs(it?.end);
            const start = new Date(rs);
            const end = new Date(re);
            const titleBase = String(it?.title || '').trim() || '日程';
            const calendarId = String(it?.calendarId || 'default');
            if (!isCalendarEnabled(calendarId, settings)) return null;
            const calColor = defMap.get(calendarId)?.color || '#0078d4';
            const rawColor = String(it?.color || '').trim();
            const color = rawColor || settings.scheduleColor || calColor;
            const taskId = String(it?.taskId || '').trim();
            const allDay = (it?.allDay === true) || isAllDayRange(start, end);
            return {
                id: String(it?.id || uuid()),
                title: titleBase,
                start,
                end,
                allDay,
                backgroundColor: color,
                borderColor: color,
                __tmRank: 1,
                extendedProps: {
                    __tmSource: 'schedule',
                    __tmScheduleId: String(it?.id || ''),
                    __tmTaskId: taskId,
                    __tmRank: 1,
                    calendarId,
                },
            };
        }).filter(Boolean);
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
                    calendarId,
                },
            };
        }).filter(Boolean);
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
        const startMs = toMs(rangeStart);
        const endMs = toMs(rangeEnd);
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return new Map();
        const map = new Map();
        const all = !!includeAllDays;
        for (const it of Array.isArray(days) ? days : []) {
            const dateKey = String(it?.date || '').trim();
            if (!dateKey) continue;
            const ds = toMs(dateKey);
            if (!Number.isFinite(ds) || ds < startMs || ds >= endMs) continue;
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
        if (state.modalEl) {
            try { state.modalEl.remove(); } catch (e) {}
            state.modalEl = null;
        }
        if (state.uiAbort) {
            try { state.uiAbort.abort(); } catch (e) {}
            state.uiAbort = null;
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
                    <button class="tm-btn tm-btn-secondary" data-tm-cal-action="openDockHistory">在番茄钟里打开</button>
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

        modal.addEventListener('click', async (e) => {
            const btn = e.target?.closest?.('[data-tm-cal-action]');
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
        const isEdit = !!scheduleId;
        const initAllDay = init.allDay === true;
        const start = init.start instanceof Date ? init.start : null;
        const end = init.end instanceof Date ? init.end : null;
        const title0 = String(init.title || '').trim();
        const calendarId0 = String(init.calendarId || '').trim() || pickDefaultCalendarId(settings);
        const calDef0 = calDefs.find((d) => d.id === calendarId0) || calDefs[0] || { id: 'default', name: '时间轴', color: '#0078d4' };
        const color0 = String(init.color || '').trim() || String(calDef0.color || '#0078d4');
        const calendarOptions = calDefs.map((d) => `<option value="${esc(d.id)}" ${d.id === calendarId0 ? 'selected' : ''}>${esc(d.name)}</option>`).join('');

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

        modal.addEventListener('click', async (e) => {
            const btn = e.target?.closest?.('[data-tm-cal-action]');
            const action = String(btn?.getAttribute?.('data-tm-cal-action') || '');
            if (!action) return;
            if (action === 'cancel') {
                closeModal();
                return;
            }
            if (action === 'delete') {
                if (!scheduleId) return;
                const list = await loadScheduleAll();
                const next = list.filter((x) => String(x?.id || '') !== scheduleId);
                await saveScheduleAll(next);
                closeModal();
                try { state.calendar?.refetchEvents?.(); } catch (e2) {}
                try {
                    const cal = state.calendar;
                    const vt = String(cal?.view?.type || '');
                    if (cal && vt === 'dayGridMonth') {
                        const d = cal.getDate?.();
                        if (d) requestAnimationFrame(() => { try { cal.changeView('dayGridMonth', d); } catch (e3) {} });
                    }
                } catch (e2) {}
                try { setTimeout(() => { try { state.calendar?.refetchEvents?.(); } catch (e3) {} }, 380); } catch (e2) {}
                toast('✅ 已删除', 'success');
                return;
            }
            if (action === 'save') {
                const title = getInputValue('title');
                const calendarId = getInputValue('calendarId') || calendarId0 || 'default';
                const s0 = getInputValue('start');
                const e0 = getInputValue('end');
                const color = getInputValue('color') || '#0078d4';
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
                const allDay = isAllDayRange(nextStart, nextEnd) || (initAllDay && isAllDayRange(nextStart, nextEnd));
                const id = scheduleId || uuid();
                const item = {
                    id,
                    title: title || '日程',
                    start: safeISO(nextStart),
                    end: safeISO(nextEnd),
                    allDay,
                    color,
                    calendarId,
                };
                const list = await loadScheduleAll();
                const idx = list.findIndex((x) => String(x?.id || '') === id);
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
                try { state.calendar?.refetchEvents?.(); } catch (e2) {}
                try {
                    const cal = state.calendar;
                    const vt = String(cal?.view?.type || '');
                    if (cal && vt === 'dayGridMonth') {
                        const d = cal.getDate?.();
                        if (d) requestAnimationFrame(() => { try { cal.changeView('dayGridMonth', d); } catch (e3) {} });
                    }
                } catch (e2) {}
                try { setTimeout(() => { try { state.calendar?.refetchEvents?.(); } catch (e3) {} }, 380); } catch (e2) {}
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

    function mount(rootEl, opts) {
        if (!rootEl || !(rootEl instanceof Element)) return false;
        if (!globalThis.FullCalendar || !globalThis.FullCalendar.Calendar) return false;
        unmount();

        state.mounted = true;
        state.rootEl = rootEl;
        state.opts = opts || {};
        state.settingsStore = state.opts.settingsStore || null;
        const isMobileDevice = !!globalThis.__taskHorizonPluginIsMobile || (() => {
            try { return !!window.matchMedia?.('(pointer: coarse)')?.matches; } catch (e) { return false; }
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
                        <div class="tm-calendar-sidebar-footer">
                            <button class="tm-btn tm-btn-secondary" data-tm-cal-action="today">今天</button>
                            <div style="flex:1;"></div>
                            <button class="tm-btn tm-btn-secondary" data-tm-cal-action="refresh">刷新</button>
                            <button class="tm-btn tm-btn-primary" data-tm-cal-action="new">新建</button>
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
        try {
            const sidebar = wrap.querySelector('.tm-calendar-sidebar');
            const w = Number(s.sidebarWidth) || 280;
            if (sidebar) sidebar.style.width = `${Math.max(220, Math.min(560, w))}px`;
        } catch (e) {}
        renderSidebar(wrap, s);
        renderTaskPage(wrap, s);
        setSidePage(wrap, state.sidePage);
        if (isMobileDevice) setMobileSidebarOpen(wrap, false);
        bindSidebarResize(wrap);
        let calendar = null;
        const preferredInitialView = (() => {
            const allow = new Set(['timeGridDay', 'timeGridWeek', 'dayGridMonth']);
            const v = String(s.lastViewType || '').trim();
            if (v && allow.has(v)) return v;
            return 'timeGridWeek';
        })();
        const preferredInitialDate = (() => {
            const d0 = parseDateOnly(s.lastDate);
            return d0 || undefined;
        })();
        calendar = new FullCalendar.Calendar(host, {
            initialView: preferredInitialView,
            initialDate: preferredInitialDate,
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
                list: '列表',
            },
            nowIndicator: true,
            dayMaxEvents: true,
            stickyHeaderDates: true,
            lazyFetching: false,
            headerToolbar: {
                left: 'today prev,next',
                center: 'title',
                right: 'timeGridDay,timeGridWeek,dayGridMonth',
            },
            eventDisplay: 'block',
            eventContent: (arg) => {
                const ext = arg?.event?.extendedProps || {};
                const source = String(ext.__tmSource || '').trim();
                if (source === 'taskdate' || (source === 'schedule' && String(ext.__tmTaskId || '').trim())) {
                    const tid = String(ext.__tmTaskId || '').trim();
                    const done = (() => {
                        if (!tid) return false;
                        if (typeof window.tmIsTaskDone !== 'function') return false;
                        try { return !!window.tmIsTaskDone(tid); } catch (e) { return false; }
                    })();
                    const wrapEl = document.createElement('span');
                    wrapEl.className = 'tm-cal-task-event';
                    if (done) wrapEl.classList.add('tm-cal-task-event--done');
                    wrapEl.oncontextmenu = (ev) => {
                        try { ev.stopPropagation(); } catch (e) {}
                        try { ev.preventDefault(); } catch (e) {}
                        if (tid && typeof window.tmShowTaskContextMenu === 'function') {
                            try { window.tmShowTaskContextMenu(ev, tid); } catch (e) {}
                        }
                        return false;
                    };
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.className = 'tm-cal-task-event-check';
                    cb.checked = done;
                    cb.onchange = (ev) => {
                        try { ev.stopPropagation(); } catch (e) {}
                        try { ev.preventDefault(); } catch (e) {}
                        if (!tid || typeof window.tmSetDone !== 'function') return;
                        try { window.tmSetDone(tid, cb.checked === true, ev); } catch (e) {}
                        try { state.calendar?.refetchEvents?.(); } catch (e) {}
                    };
                    const title = document.createElement('span');
                    title.className = 'tm-cal-task-event-title';
                    title.textContent = String(arg?.event?.title || '').trim() || '任务';
                    title.onclick = (ev) => {
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
                            const eid = String(arg?.event?.id || '').trim();
                            if (eid) el.setAttribute('data-tm-cal-event-id', eid);
                            if (source) el.setAttribute('data-tm-cal-source', source);
                            const aggDay = String(ext.__tmAggregateDay || '').trim();
                            if (aggDay) el.setAttribute('data-tm-cal-agg-day', aggDay);
                            const tid = String(ext.__tmTaskId || '').trim();
                            if (tid) el.setAttribute('data-tm-cal-task-id', tid);
                            const sid = String(ext.__tmScheduleId || '').trim();
                            if (sid) el.setAttribute('data-tm-cal-schedule-id', sid);
                            const calId = String(ext.calendarId || '').trim();
                            if (calId) el.setAttribute('data-tm-cal-calendar-id', calId);
                            const recordKey = String(ext.__tmRecordKey || '').trim();
                            if (recordKey) el.setAttribute('data-tm-cal-record-key', recordKey);
                        }
                    } catch (e0) {}
                    if (source === 'taskdate' || (source === 'schedule' && String(ext.__tmTaskId || '').trim())) {
                        const tid = String(ext.__tmTaskId || '').trim();
                        const el = arg?.el;
                        if (tid && el && !el.__tmTaskCtxBound) {
                            el.__tmTaskCtxBound = true;
                            el.addEventListener('contextmenu', (ev) => {
                                try { ev.stopPropagation(); } catch (e) {}
                                try { ev.preventDefault(); } catch (e) {}
                                if (typeof window.tmShowTaskContextMenu === 'function') {
                                    try { window.tmShowTaskContextMenu(ev, tid); } catch (e) {}
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
            slotDuration: '00:30:00',
            slotLabelInterval: '01:00',
            slotLabelContent: (arg) => {
                const d = arg?.date;
                if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
                return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
            },
            droppable: true,
            dropAccept: '.tm-cal-task, tr[data-id]',
            eventReceive: async (info) => {
                try {
                    const ext = info?.event?.extendedProps || {};
                    const taskId = String(ext.__tmTaskId || '').trim();
                    const start = info?.event?.start;
                    let end = info?.event?.end;
                    const durMin = Number(ext.__tmDurationMin);
                    if (!(start instanceof Date) || Number.isNaN(start.getTime())) return;
                    if (!(end instanceof Date) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
                        const safeMin = (Number.isFinite(durMin) && durMin > 0) ? Math.round(durMin) : 60;
                        end = new Date(start.getTime() + safeMin * 60000);
                    }
                    const settings = getSettings();
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
                    const [records, schedules, taskDates, cnHolidayDays] = await Promise.all([
                        loadRecordsForRange(info.start, info.end),
                        loadScheduleForRange(info.start, info.end),
                        (settings.showTaskDates && typeof window.tmQueryCalendarTaskDateEvents === 'function')
                            ? Promise.resolve().then(() => window.tmQueryCalendarTaskDateEvents(info.start?.toISOString?.() || '', info.end?.toISOString?.() || '')).catch(() => [])
                            : Promise.resolve([]),
                        (settings.showCnHoliday || settings.showLunar) ? Promise.all(years.map((y) => loadCnHolidayYear(y))).then((arr) => arr.flat()) : Promise.resolve([]),
                    ]);
                    try {
                        const wantMap = (settings.showCnHoliday && (String(viewType || '').trim() === 'dayGridMonth' || String(viewType || '').trim() === 'timeGridWeek')) || !!settings.showLunar;
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
                    const b = buildEventsFromSchedule(schedules, settings);
                    const c = buildEventsFromTaskDates(taskDates, settings);
                    const d = settings.showCnHoliday ? buildCnHolidayEvents(cnHolidayDays, info.start, info.end, viewType, settings) : [];
                    const events = a.concat(b, c, d);
                    const statusEl = wrap.querySelector('[data-tm-cal-role="status"]');
                    if (statusEl) {
                        const sum = summarizeRange(records);
                        const minTxt = sum.minMs ? formatDateKey(new Date(sum.minMs)) : '-';
                        const maxTxt = sum.maxMs ? formatDateKey(new Date(sum.maxMs)) : '-';
                        statusEl.textContent = `事件: ${events.length}（番茄:${a.length} 文档:${b.length} 跨天:${c.length} 节假:${d.length} 原始:${sum.total} 异常:${sum.bad} 范围:${minTxt}~${maxTxt}）`;
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
                if (source === 'schedule') {
                    try {
                        openScheduleModal({
                            id: String(ext.__tmScheduleId || arg?.event?.id || ''),
                            title: String(arg?.event?.title || ''),
                            start: arg?.event?.start,
                            end: arg?.event?.end,
                            allDay: arg?.event?.allDay === true,
                            color: String(arg?.event?.backgroundColor || arg?.event?.borderColor || '#0078d4'),
                            calendarId: String(ext.calendarId || 'default'),
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
                const end = new Date(start.getTime() + (info?.allDay === true ? 24 * 60 : 60) * 60000);
                openScheduleModal({ start, end, allDay: info?.allDay === true, calendarId: pickDefaultCalendarId(getSettings()) });
            },
            eventDrop: async (arg) => {
                const ext = arg?.event?.extendedProps || {};
                const source = String(ext.__tmSource || '').trim();
                if (source === 'schedule') {
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
                try {
                    const d = calendar?.getDate?.();
                    if (d) state.miniMonthKey = miniMonthKeyFromDate(d);
                    renderMiniCalendar(wrap);
                } catch (e) {}
                try {
                    const store = state.settingsStore;
                    if (store && store.data && calendar?.view?.type) {
                        const vt = String(calendar.view.type || '').trim();
                        const prevVt = String(state._lastViewType || '').trim();
                        if (vt) state._lastViewType = vt;
                        const dt = calendar.getDate?.();
                        const key = (dt instanceof Date && !Number.isNaN(dt.getTime())) ? `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}` : '';
                        if (vt) store.data.calendarLastViewType = vt;
                        if (key) store.data.calendarLastDate = key;
                        if (state._persistTimer) clearTimeout(state._persistTimer);
                        state._persistTimer = setTimeout(() => { try { store.save(); } catch (e2) {} }, 250);
                        if (prevVt && vt && prevVt !== vt) {
                            setTimeout(() => {
                                try { calendar.refetchEvents(); } catch (e2) {}
                            }, 0);
                        }
                    }
                } catch (e) {}
                try {
                    requestAnimationFrame(() => {
                        try { applyCnHolidayDots(wrap); } catch (e2) {}
                        try { applyCnLunarLabels(wrap); } catch (e2) {}
                    });
                    setTimeout(() => {
                        try { applyCnHolidayDots(wrap); } catch (e2) {}
                        try { applyCnLunarLabels(wrap); } catch (e2) {}
                    }, 0);
                } catch (e) {}
            },
            loading: (isLoading) => {
                try {
                    if (!isLoading) {
                        requestAnimationFrame(() => { try { calendar.updateSize(); } catch (e2) {} });
                    }
                } catch (e) {}
            },
        });
        state.calendar = calendar;

        try { calendar.render(); } catch (e) {}
        try {
            state.filteredTasksListener = () => {
                try { renderTaskPage(wrap, getSettings()); } catch (e2) {}
            };
            window.addEventListener('tm:filtered-tasks-updated', state.filteredTasksListener);
        } catch (e) {}
        try {
            requestAnimationFrame(() => {
                try { calendar.updateSize(); } catch (e2) {}
            });
        } catch (e) {}
        try { renderMiniCalendar(wrap); } catch (e) {}

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
            const btn = e.target?.closest?.('[data-tm-cal-action]');
            const action = String(btn?.getAttribute?.('data-tm-cal-action') || '');
            if (!action) return;
            if (action === 'toggleSidebar') {
                toggleMobileSidebar(wrap, undefined, state.sidePage || 'calendar');
                return;
            }
            if (action === 'closeSidebar') {
                setMobileSidebarOpen(wrap, false);
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
                    if (typeof window.tmRefresh === 'function') {
                        window.tmRefresh().catch(() => null);
                    }
                } catch (e2) {}
                try {
                    setTimeout(() => {
                        try {
                            const s2 = getSettings();
                            renderTaskPage(wrap, s2);
                        } catch (e3) {}
                    }, 650);
                } catch (e2) {}
                try { calendar.refetchEvents(); } catch (e2) {}
                try {
                    requestAnimationFrame(() => { try { calendar.updateSize(); } catch (e3) {} });
                } catch (e2) {}
                try {
                    const vt = String(calendar?.view?.type || '');
                    if (vt === 'dayGridMonth') {
                        const d = calendar?.getDate?.();
                        if (d) {
                            requestAnimationFrame(() => {
                                try { calendar.changeView('dayGridMonth', d); } catch (e4) {}
                            });
                        }
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
                        });
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
                setMobileSidebarOpen(wrap, false);
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
                if (!hostEl) return;
                if (target.closest('.fc-header-toolbar')) return;
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
                            return !!el.closest('.tm-calendar-host');
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
                if (tid) {
                    const x = Number(e?.clientX);
                    const y = Number(e?.clientY);
                    const checkEl = eventEl.querySelector?.('.tm-cal-task-event-check') || null;
                    const titleEl = eventEl.querySelector?.('.tm-cal-task-event-title') || null;
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
                if (source === 'schedule') {
                    try {
                        openScheduleModal({
                            id: String(ext.__tmScheduleId || api?.id || ''),
                            title: String(api?.title || ''),
                            start: api?.start,
                            end: api?.end,
                            allDay: api?.allDay === true,
                            color: String(api?.backgroundColor || api?.borderColor || '#0078d4'),
                            calendarId: String(ext.calendarId || 'default'),
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
        const tomatoRows = s.linkDockTomato ? `
                <div class="tm-calendar-settings-row">
                    <div class="tm-calendar-settings-label">月视图隐藏番茄钟</div>
                    <label class="tm-switch">
                        <input type="checkbox" data-tm-cal-setting="calendarMonthAggregate" ${s.monthAggregate ? 'checked' : ''}>
                        <span class="tm-switch-slider"></span>
                    </label>
                </div>
                <div class="tm-calendar-settings-row">
                    <div class="tm-calendar-settings-label">显示休息记录</div>
                    <label class="tm-switch">
                        <input type="checkbox" data-tm-cal-setting="calendarShowBreak" ${s.showBreak ? 'checked' : ''}>
                        <span class="tm-switch-slider"></span>
                    </label>
                </div>
                <div class="tm-calendar-settings-row">
                    <div class="tm-calendar-settings-label">显示闲置记录</div>
                    <label class="tm-switch">
                        <input type="checkbox" data-tm-cal-setting="calendarShowIdle" ${s.showIdle ? 'checked' : ''}>
                        <span class="tm-switch-slider"></span>
                    </label>
                </div>
        ` : '';
        containerEl.innerHTML = `
            <div class="tm-calendar-settings">
                <div class="tm-calendar-settings-row">
                    <div class="tm-calendar-settings-label">启用日历视图</div>
                    <label class="tm-switch">
                        <input type="checkbox" data-tm-cal-setting="calendarEnabled" ${s.enabled ? 'checked' : ''}>
                        <span class="tm-switch-slider"></span>
                    </label>
                </div>
                <div class="tm-calendar-settings-row">
                    <div class="tm-calendar-settings-label">联通底栏番茄钟</div>
                    <label class="tm-switch">
                        <input type="checkbox" data-tm-cal-setting="calendarLinkDockTomato" ${s.linkDockTomato ? 'checked' : ''}>
                        <span class="tm-switch-slider"></span>
                    </label>
                </div>
                <div class="tm-calendar-settings-row">
                    <div class="tm-calendar-settings-label">日历起始日</div>
                    <select class="tm-calendar-settings-select" data-tm-cal-setting="calendarFirstDay">
                        <option value="1" ${Number(s.firstDay) === 1 ? 'selected' : ''}>周一</option>
                        <option value="0" ${Number(s.firstDay) === 0 ? 'selected' : ''}>周日</option>
                    </select>
                </div>
                <div class="tm-calendar-settings-row">
                    <div class="tm-calendar-settings-label">显示农历</div>
                    <label class="tm-switch">
                        <input type="checkbox" data-tm-cal-setting="calendarShowLunar" ${s.showLunar ? 'checked' : ''}>
                        <span class="tm-switch-slider"></span>
                    </label>
                </div>
                ${tomatoRows}
                <div class="tm-calendar-settings-row">
                    <div class="tm-calendar-settings-label">显示跨天任务</div>
                    <label class="tm-switch">
                        <input type="checkbox" data-tm-cal-setting="calendarShowTaskDates" ${s.showTaskDates ? 'checked' : ''}>
                        <span class="tm-switch-slider"></span>
                    </label>
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
            } else if (el.type === 'checkbox') {
                store.data[key] = !!el.checked;
            } else {
                store.data[key] = String(el.value || '');
            }
            try {
                if (typeof store.save === 'function') await store.save();
            } catch (e2) {}
            try {
                if (key === 'calendarLinkDockTomato') {
                    try { renderSettings(containerEl, store); } catch (e2) {}
                    try {
                        const root = state.rootEl;
                        if (root) renderSidebar(root, getSettings());
                    } catch (e2) {}
                    try { state.calendar?.refetchEvents?.(); } catch (e2) {}
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
        unmount();
        state.settingsAbort?.abort();
        state.settingsAbort = null;
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
            return setMobileSidebarOpen(wrap, true, page || state.sidePage || 'calendar');
        },
        closeSidebar: () => {
            const wrap = state.wrapEl;
            if (!wrap) return false;
            return setMobileSidebarOpen(wrap, false);
        },
    };
})();
