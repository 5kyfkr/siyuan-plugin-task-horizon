    // Session-only task date filtering. The same calendar is mounted in the
    // shortcut sidebar or its non-modal flyout; task data stays in TaskStore.
    const __tmDateFilter = (() => {
        let candidates = [], panel = null, dock = null, trigger = null, popup = null;
        let sidebar = null, host = null, controller = null, unstack = null;
        let viewDate = '', focusDate = '', preview = null, drag = null;
        let pageViewport = null, pageLayer = null, dateGrid = null, pageGhost = null, pageIncoming = null, pageGhostTimer = 0;
        let wheelDelta = 0, wheelEventAt = 0, wheelPageAt = -Infinity, wheelDirection = 0;
        let mode = '', preferences = null, savePreferences = null;
        const day = value => __tmNormalizeDateOnly(value);
        const today = () => __tmGetTodayDateKey();
        const parse = value => {
            const [y, m, d] = value.split('-').map(Number);
            return new Date(y, m - 1, d, 12);
        };
        const shift = (value, amount) => {
            const date = parse(value);date.setDate(date.getDate() + amount);return day(date);
        };
        const weekStart = value => shift(value, -((parse(value).getDay() - (Number(SettingsStore.data.calendarFirstDay) === 0 ? 0 : 1) + 7) % 7));
        const range = () => state.dateFilter || null;
        const supported = () => !state.homepageOpen && !state.attachmentLibraryOpen;
        const active = () => supported() && !!range();
        const signature = () => active() ? `${range().from}:${range().to}` : '';
        const shortDate = value => `${parse(value).getMonth() + 1}月${parse(value).getDate()}日`;
        const label = () => {
            const selected = range();
            if (!selected) return '';
            if (selected.from === selected.to) return shortDate(selected.from);
            const acrossYears = selected.from.slice(0, 4) !== selected.to.slice(0, 4);
            const format = value => `${acrossYears ? value.slice(0, 4) + '年' : ''}${shortDate(value)}`;
            return `${format(selected.from)}-${format(selected.to)}`;
        };
        const svg = name => __tmRenderLucideIcon(name);

        function matches(task, selected = range()) {
            if (!selected) return true;
            if (typeof __tmIsCheckinTask === 'function' && __tmIsCheckinTask(task)) {
                const planned = __tmGetTaskCheckinCurrentDate(task, selected.from);
                return !!planned && planned >= selected.from && planned <= selected.to
                    || __tmGetTaskCheckinHistory(task).some(entry => entry.scheduledDate >= selected.from && entry.scheduledDate <= selected.to);
            }
            const start = day(task?.startDate || task?.start_date || '');
            const end = day(task?.completionTime || task?.completion_time || '');
            if (!start && !end) return false;
            const from = start && end ? (start < end ? start : end) : start || end;
            const to = start && end ? (start > end ? start : end) : start || end;
            return from <= selected.to && to >= selected.from;
        }

        function setCandidates(tasks) {
            candidates = Array.isArray(tasks) ? tasks : [];
        }

        const count = () => candidates.filter(task => matches(task)).length;

        function filterCalendarEvents(events, options = {}) {
            if (options.calendar !== 'main' || !active()) return events;
            const ids = new Set((state.filteredTasks || []).filter(task => matches(task)).map(task => String(task.id)));
            return events.filter(event => {
                if (![event.taskId, event.recurringSourceTaskId, event.sourceTaskId].some(id => id && ids.has(String(id)))) return false;
                const from = day(event.start), end = day(event.endExclusive);
                return matches({ startDate: from, completionTime: end ? shift(end, -1) : from });
            });
        }

        function setRange(from, to = from) {
            const a = day(from), b = day(to);
            state.dateFilter = a && b ? { from: a < b ? a : b, to: a < b ? b : a } : null;
            preview = null;
            if (b) focusDate = b;
            state.listDomRenderSignature = '';state.listRenderSignature = '';
            __tmInvalidateFilteredTaskDerivedStateCache();
            refresh();
            __tmScheduleRender({ withFilters: true });
        }

        function clearForContextChange() {
            if (drag) finishDrag(false);
            if (!range()) return false;
            state.dateFilter = null;
            preview = null;
            state.listDomRenderSignature = '';state.listRenderSignature = '';
            __tmInvalidateFilteredTaskDerivedStateCache();
            refresh();
            return true;
        }

        function pick(value, extend = false) {
            focusDate = value;
            if (extend && range()) setRange(range().from, value);
            else if (range()?.from === value && range().to === value) setRange(null);
            else setRange(value);
        }

        function paintSelection() {
            if (!dateGrid) return;
            const selected = preview || range();
            const incomingCells = pageIncoming?.querySelectorAll('.tm-date-filter-day');
            Array.from(dateGrid.children).forEach((cell, index) => {
                const value = cell.dataset.tmFilterDate;
                const inside = !!selected && value >= selected.from && value <= selected.to;
                for (const target of incomingCells ? [cell, incomingCells[index]] : [cell]) {
                    if (!target) continue;
                    target.classList.toggle('is-in-range', inside);
                    target.classList.toggle('is-start', inside && value === selected.from);
                    target.classList.toggle('is-end', inside && value === selected.to);
                    target.classList.toggle('is-endpoint', inside && (value === selected.from || value === selected.to));
                    target.setAttribute('aria-pressed', String(inside));
                }
            });
        }

        function syncSelectionBar() {
            const bar = panel?.querySelector('[data-tm-filter-selection]');
            if (!bar) return;
            bar.hidden = !range();
            const text = bar.querySelector('[data-tm-filter-selection-label]');
            text.textContent = label();text.title = label();
        }

        function stopPageAnimation() {
            clearTimeout(pageGhostTimer);pageGhostTimer = 0;
            pageGhost?.remove();pageGhost = null;pageIncoming = null;
        }

        function animatePage(previous, direction) {
            if (!previous) return;
            pageIncoming = pageLayer.cloneNode(true);
            for (const visual of [previous, pageIncoming]) {
                visual.className = 'tm-date-filter-slide-page';
                visual.removeAttribute('data-tm-filter-page');
                visual.querySelectorAll('*').forEach(node => {
                    for (const name of node.getAttributeNames()) {
                        if (name.startsWith('data-tm-filter-') || name === 'id' || name === 'tabindex') node.removeAttribute(name);
                    }
                });
            }
            const overlay = document.createElement('div');
            overlay.className = `tm-date-filter-page-ghost tm-date-filter-page-ghost--${direction < 0 ? 'previous' : 'next'}`;
            overlay.setAttribute('aria-hidden', 'true');overlay.inert = true;
            const track = document.createElement('div');track.className = 'tm-date-filter-slide-track';
            track.append(...(direction > 0 ? [previous, pageIncoming] : [pageIncoming, previous]));
            overlay.append(track);pageGhost = overlay;
            // Only visual copies move. The live grid remains stationary for hit testing.
            pageViewport.append(overlay);
            const finish = () => { if (pageGhost === overlay) stopPageAnimation(); };
            track.addEventListener('animationend', finish, { once: true });
            pageGhostTimer = setTimeout(finish, 320);
        }

        function refresh(force = false, slideDirection = 0) {
            syncSelectionBar();
            if (trigger) {
                trigger.classList.toggle('is-active', active());
                trigger.title = active() ? `日期筛选：${label()}` : '日期筛选';
                trigger.setAttribute('aria-label', trigger.title);
            }
            if (!panel || (drag && !force)) return;
            if (dock.hidden && popup.hidden) return;
            const date = parse(viewDate || today());
            const week = preferences?.calendarView === 'week';
            const month = day(new Date(date.getFullYear(), date.getMonth(), 1, 12));
            const start = weekStart(week ? viewDate : month);
            const days = Array.from({ length: week ? 7 : 42 }, (_, index) => shift(start, index));
            const focus = days.includes(focusDate) ? focusDate : days.includes(today()) ? today() : days.includes(month) ? month : days[0];
            const firstDay = Number(SettingsStore.data.calendarFirstDay) === 0 ? 0 : 1;
            const liveCandidates = candidates.map(task => globalThis.__tmTaskBoundary?.getTask?.(task.id) || task);
            const samePage = dateGrid.firstElementChild?.dataset.tmFilterDate === days[0] && dateGrid.children.length === days.length;
            if (slideDirection || !samePage) stopPageAnimation();
            const departingPage = slideDirection && pageLayer.isConnected
                && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? pageLayer.cloneNode(true) : null;
            panel.querySelector('[data-tm-filter-month]').textContent = `${date.getFullYear()}年${date.getMonth() + 1}月`;
            const toggle = panel.querySelector('[data-tm-filter-action="view"]');
            toggle.innerHTML = svg('caret-down');
            toggle.title = week ? '展开整月' : '折叠为单周';
            toggle.setAttribute('aria-label', toggle.title);toggle.setAttribute('aria-expanded', String(!week));
            pageLayer.querySelector('[data-tm-filter-weekdays]').innerHTML = Array.from({ length: 7 }, (_, i) => `<span>${'日一二三四五六'[(firstDay + i) % 7]}</span>`).join('');
            dateGrid.innerHTML = days.map(value => {
                const busy = liveCandidates.some(task => matches(task, { from: value, to: value }));
                return `<button type="button" class="tm-date-filter-day${parse(value).getMonth() !== date.getMonth() ? ' is-other' : ''}${value === today() ? ' is-today' : ''}" data-tm-filter-date="${value}" tabindex="${value === focus ? '0' : '-1'}" aria-label="${value}${busy ? '，有任务' : ''}" aria-pressed="false"${value === today() ? ' aria-current="date"' : ''}><span class="tm-date-filter-number">${parse(value).getDate()}${busy ? '<i class="tm-date-filter-dot" aria-hidden="true"></i>' : ''}</span></button>`;
            }).join('');
            paintSelection();positionPopup();
            animatePage(departingPage, slideDirection);
        }

        function changePage(direction) {
            if (preferences.calendarView === 'week') viewDate = shift(viewDate, direction * 7);
            else {
                const date = parse(viewDate);date.setDate(1);date.setMonth(date.getMonth() + direction);viewDate = day(date);
            }
            refresh(true, direction);
        }

        function resetWheel() {
            wheelDelta = 0;wheelEventAt = 0;wheelPageAt = -Infinity;wheelDirection = 0;
        }

        function onWheel(event) {
            if (event.ctrlKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
            event.preventDefault();
            if (drag) return;
            const now = performance.now(), direction = Math.sign(event.deltaY);
            if (now - wheelEventAt > 180 || Math.sign(wheelDelta) !== direction) wheelDelta = 0;
            wheelEventAt = now;
            if (now - wheelPageAt < 260 && wheelDirection === direction) { wheelDelta = 0;return; }
            wheelDelta += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? dateGrid.clientHeight : 1);
            if (Math.abs(wheelDelta) < 40) return;
            wheelDelta = 0;wheelPageAt = now;wheelDirection = direction;
            changePage(direction);
        }

        function dateAtPoint(x, y) {
            if (!dateGrid?.isConnected) return null;
            const rect = dateGrid.getBoundingClientRect();
            const clip = (popup.hidden ? dock : popup).getBoundingClientRect();
            if (!rect.width || !rect.height || x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom
                || x < clip.left || x >= clip.right || y < clip.top || y >= clip.bottom) return null;
            const count = dateGrid.children.length, rows = count / 7;
            const column = Math.floor((x - rect.left) * 7 / rect.width);
            const row = Math.floor((y - rect.top) * rows / rect.height);
            const index = row * 7 + column, cell = dateGrid.children[index];
            return cell ? { value: cell.dataset.tmFilterDate, index, count, rearmDistance: Math.min(rect.width / 7, rect.height / rows) / 2 } : null;
        }

        function updateDragTarget(value) {
            drag.to = value;
            preview = { from: drag.from < drag.to ? drag.from : drag.to, to: drag.from < drag.to ? drag.to : drag.from };
            paintSelection();
        }

        function moveDrag(event) {
            if (!drag || event.pointerId !== drag.pointerId) return;
            const { clientX: x, clientY: y } = event;
            if (x === drag.lastX && y === drag.lastY) return;
            drag.lastX = x;drag.lastY = y;
            if (Math.hypot(x - drag.startX, y - drag.startY) >= 4) drag.moved = true;
            const hit = dateAtPoint(x, y);
            if (!hit || !drag.moved) return;
            const edge = hit.index === 0 ? -1 : hit.index === hit.count - 1 ? 1 : 0;
            if (drag.pageLatch) {
                // Neither animation frames, edge jitter nor leaving the grid can
                // rearm paging. A deliberate move into an interior date can.
                if (edge || Math.hypot(x - drag.pageLatch.x, y - drag.pageLatch.y) < hit.rearmDistance) return;
                drag.pageLatch = null;
            }
            updateDragTarget(hit.value);
            if (edge && hit.value !== drag.from) {
                drag.pageLatch = { x, y };
                changePage(edge);
                // Keep the endpoint the user actually reached. The date now
                // drawn under the stationary pointer is not another selection.
            }
        }

        function finishDrag(commit) {
            if (!drag) return;
            const selected = drag;drag = null;preview = null;
            panel.classList.remove('is-selecting');
            try { if (panel.hasPointerCapture(selected.pointerId)) panel.releasePointerCapture(selected.pointerId); } catch (e) {}
            if (!commit) { paintSelection();return; }
            if (selected.moved) setRange(selected.from, selected.to);
            else pick(selected.to, selected.shift);
        }

        function positionPopup() {
            if (!popup || popup.hidden || !host?.isConnected || !trigger?.isConnected) return;
            const area = host.getBoundingClientRect(), anchor = trigger.getBoundingClientRect();
            const left = Math.max(8, area.left), right = Math.min(innerWidth - 8, area.right);
            const top = Math.max(8, area.top), bottom = Math.min(innerHeight - 8, area.bottom);
            popup.style.width = `${Math.max(1, Math.min(272, right - left))}px`;
            popup.style.maxHeight = `${Math.max(1, bottom - top)}px`;
            const height = popup.getBoundingClientRect().height;
            popup.style.left = `${Math.max(left, Math.min(anchor.right + 8, right - popup.offsetWidth))}px`;
            popup.style.top = `${Math.max(top, Math.min(anchor.bottom - height, bottom - height))}px`;
        }

        function closePopup(restoreFocus = false) {
            if (!popup || popup.hidden) return;
            finishDrag(false);stopPageAnimation();resetWheel();
            popup.hidden = true;unstack?.();unstack = null;
            trigger.setAttribute('aria-expanded', 'false');
            if (restoreFocus && trigger.isConnected) trigger.focus({ preventScroll: true });
        }

        function openPopup() {
            if (mode !== 'rail') return;
            popup.append(panel);popup.hidden = false;
            trigger.setAttribute('aria-expanded', 'true');
            unstack = __tmModalStackBind(() => closePopup(true));
            refresh();
            panel.querySelector('[tabindex="0"]')?.focus({ preventScroll: true });
        }

        function mount(nextSidebar, nextHost, nextMode, prefs, persist) {
            if (panel && mode !== nextMode) { finishDrag(false);stopPageAnimation();resetWheel(); }
            sidebar = nextSidebar;host = nextHost;mode = nextMode;preferences = prefs;savePreferences = persist;
            if (!panel) {
                controller = new AbortController();const signal = controller.signal;
                viewDate = range()?.to || today();focusDate = viewDate;
                panel = document.createElement('section');panel.className = 'tm-date-filter-calendar';panel.setAttribute('aria-label', '日期筛选日历');
                panel.innerHTML = `<div class="tm-date-filter-header"><div class="tm-date-filter-month"><button type="button" data-tm-filter-action="view"></button><span data-tm-filter-month aria-live="polite"></span></div><div class="tm-date-filter-navigation"><button type="button" data-tm-filter-action="prev" aria-label="上一月或周" title="上一月或周">${svg('chevron-left')}</button><button type="button" data-tm-filter-action="today" title="定位今天">今天</button><button type="button" data-tm-filter-action="next" aria-label="下一月或周" title="下一月或周">${svg('caret-right')}</button></div></div><div class="tm-date-filter-page" data-tm-filter-page><div class="tm-date-filter-weekdays" data-tm-filter-weekdays aria-hidden="true"></div><div class="tm-date-filter-days" data-tm-filter-days role="group" aria-label="选择日期"></div></div>`;
                pageLayer = panel.querySelector('[data-tm-filter-page]');
                panel.insertAdjacentHTML('afterbegin', `<div class="tm-date-filter-selection" data-tm-filter-selection hidden><span data-tm-filter-selection-label aria-live="polite"></span><button type="button" data-tm-filter-action="clear" aria-label="清除日期筛选" title="清除日期筛选">${svg('x')}</button></div>`);
                dateGrid = pageLayer.querySelector('[data-tm-filter-days]');
                pageViewport = document.createElement('div');pageViewport.className = 'tm-date-filter-page-viewport';
                pageLayer.replaceWith(pageViewport);pageViewport.append(pageLayer);
                dock = document.createElement('div');dock.className = 'tm-date-filter-dock';
                sidebar.insertBefore(dock, sidebar.querySelector('footer'));
                trigger = document.createElement('button');trigger.type = 'button';trigger.className = 'tm-shortcut-tool tm-date-filter-trigger';
                trigger.innerHTML = svg('calendar-blank');trigger.setAttribute('aria-expanded', 'false');trigger.setAttribute('aria-haspopup', 'dialog');
                sidebar.querySelector('footer').prepend(trigger);
                popup = document.createElement('div');popup.className = 'tm-date-filter-flyout';popup.hidden = true;
                popup.setAttribute('role', 'dialog');popup.setAttribute('aria-label', '日期筛选');document.body.append(popup);
                trigger.addEventListener('click', () => popup.hidden ? openPopup() : closePopup(true), { signal });
                panel.addEventListener('click', event => {
                    const action = event.target.closest('[data-tm-filter-action]')?.dataset.tmFilterAction;
                    if (action === 'view') {
                        preferences.calendarView = preferences.calendarView === 'week' ? 'month' : 'week';
                        if (preferences.calendarView === 'week') viewDate = range() ? focusDate : today();
                        savePreferences();refresh();
                    } else if (action === 'prev' || action === 'next') changePage(action === 'prev' ? -1 : 1);
                    else if (action === 'today') { viewDate = today();focusDate = today();refresh(); }
                    else if (action === 'clear') {
                        setRange(null);
                        if (event.detail === 0) dateGrid.querySelector('[tabindex="0"]')?.focus({ preventScroll: true });
                    }
                    const cell = event.target.closest('[data-tm-filter-date]');
                    if (cell && dateGrid.contains(cell) && event.detail === 0 && !event.pointerType) pick(cell.dataset.tmFilterDate, event.shiftKey);
                }, { signal });
                panel.addEventListener('pointerdown', event => {
                    const cell = event.target.closest('[data-tm-filter-date]');
                    if (!cell || !dateGrid.contains(cell) || event.button !== 0 || drag) return;
                    event.preventDefault();panel.classList.add('is-selecting');cell.focus({ preventScroll: true });
                    drag = { pointerId: event.pointerId, from: cell.dataset.tmFilterDate, to: cell.dataset.tmFilterDate,
                        shift: event.shiftKey, moved: false, pageLatch: null,
                        startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY };
                    try { panel.setPointerCapture(event.pointerId); } catch (e) {}
                }, { signal });
                panel.addEventListener('wheel', onWheel, { passive: false, signal });
                // Mobile and Dock hosts stop bubbling at the plugin boundary.
                // Track this captured gesture before it reaches that boundary.
                document.addEventListener('pointermove', moveDrag, { signal, capture: true });
                document.addEventListener('pointerup', event => {
                    if (event.pointerId === drag?.pointerId) finishDrag(true);
                }, { signal, capture: true });
                const cancelPointer = event => { if (event.pointerId === drag?.pointerId) finishDrag(false); };
                document.addEventListener('pointercancel', cancelPointer, { signal, capture: true });
                panel.addEventListener('lostpointercapture', cancelPointer, { signal });
                addEventListener('blur', () => finishDrag(false), { signal });
                document.addEventListener('pointerdown', event => {
                    if (!popup.hidden && !popup.contains(event.target) && !trigger.contains(event.target)) closePopup();
                }, { signal });
                panel.addEventListener('keydown', event => {
                    const cell = event.target.closest('[data-tm-filter-date]');
                    const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
                    if (!cell || !dateGrid.contains(cell) || offset === undefined || drag) return;
                    event.preventDefault();focusDate = shift(cell.dataset.tmFilterDate, offset);
                    if (!dateGrid.querySelector(`[data-tm-filter-date="${focusDate}"]`)) viewDate = focusDate;
                    refresh();dateGrid.querySelector(`[data-tm-filter-date="${focusDate}"]`)?.focus({ preventScroll: true });
                }, { signal });
                addEventListener('resize', positionPopup, { signal });
            }
            dock.hidden = !supported() || !['full', 'drawer'].includes(mode);
            trigger.hidden = !supported() || mode !== 'rail';
            if (mode !== 'rail') { closePopup();if (panel.parentElement !== dock) dock.append(panel); }
            else if (popup.hidden && panel.parentElement !== popup) popup.append(panel);
            const theme = getComputedStyle(host);
            ['--tm-bg-color', '--tm-header-bg', '--tm-text-color', '--tm-secondary-text', '--tm-border-color', '--tm-primary-color', '--tm-hover-bg'].forEach(name => popup.style.setProperty(name, theme.getPropertyValue(name)));
            popup.style.zIndex = String(Math.max(100, Number(getComputedStyle(host).zIndex) || 0) + 20);
            refresh();
        }

        function dispose() {
            finishDrag(false);stopPageAnimation();resetWheel();
            closePopup();controller?.abort();controller = null;
            panel?.remove();dock?.remove();trigger?.remove();popup?.remove();
            panel = dock = trigger = popup = sidebar = host = pageViewport = pageLayer = dateGrid = null;drag = preview = null;
        }

        return { active, signature, matches, count, setCandidates, setRange, clearForContextChange, filterCalendarEvents, mount, refresh, dispose };
    })();
    globalThis.__tmDateFilter = __tmDateFilter;
    window.tmClearDateFilter = () => __tmDateFilter.setRange(null);
