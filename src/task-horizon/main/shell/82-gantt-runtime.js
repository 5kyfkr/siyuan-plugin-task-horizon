        function clamp(n, min, max) {
            return Math.max(min, Math.min(max, n));
        }

        function parseDateOnlyToTs(value) {
            const s = String(value || '').trim();
            if (!s) return 0;
            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
                const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
                const y = Number(m[1]);
                const mon = Number(m[2]) - 1;
                const d = Number(m[3]);
                const dt = new Date(y, mon, d, 12, 0, 0, 0);
                return Number.isNaN(dt.getTime()) ? 0 : dt.getTime();
            }
            const t = new Date(s).getTime();
            return Number.isNaN(t) ? 0 : t;
        }

        function formatDateOnlyFromTs(ts) {
            const d = new Date(ts);
            if (Number.isNaN(d.getTime())) return '';
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        }

        function startOfDayTs(ts) {
            const d = new Date(ts);
            if (Number.isNaN(d.getTime())) return 0;
            return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
        }

        const TIMELINE_EXTRA_FUTURE_MONTHS = 1;
        const TIMELINE_MAX_DAY_COUNT = 397;

        function extendTimelineEndTs(baseTs, extraMonths = TIMELINE_EXTRA_FUTURE_MONTHS) {
            const months = Math.max(0, Math.round(Number(extraMonths) || 0));
            const baseDayTs = startOfDayTs(baseTs);
            if (!baseDayTs || months <= 0) return baseDayTs;
            const baseDate = new Date(baseDayTs);
            const y = baseDate.getFullYear();
            const m = baseDate.getMonth();
            const d = baseDate.getDate();
            const targetMonthDate = new Date(y, m + months, 1, 0, 0, 0, 0);
            const targetY = targetMonthDate.getFullYear();
            const targetM = targetMonthDate.getMonth();
            const lastDay = new Date(targetY, targetM + 1, 0, 0, 0, 0, 0).getDate();
            return new Date(targetY, targetM, Math.min(d, lastDay), 0, 0, 0, 0).getTime();
        }

        function computeAutoRangeTs(taskItems, paddingDays, options = {}) {
            const anchorByStartDate = options?.anchorByStartDate === true;
            const extraFutureMonthsRaw = Number(options?.extraFutureMonths);
            const extraFutureMonths = Number.isFinite(extraFutureMonthsRaw)
                ? Math.max(0, Math.round(extraFutureMonthsRaw))
                : TIMELINE_EXTRA_FUTURE_MONTHS;
            let minTs = 0;
            let maxTs = 0;
            let latestStartTs = 0;
            let latestTaskEndTs = 0;
            for (const t of taskItems) {
                const sTs = parseDateOnlyToTs(t?.startDate);
                const eTs = parseDateOnlyToTs(t?.completionTime);
                if (anchorByStartDate) {
                    if (!sTs) continue;
                    const taskEndTs = eTs || sTs;
                    if (!minTs || sTs < minTs) minTs = sTs;
                    if (!latestStartTs || sTs > latestStartTs || (sTs === latestStartTs && taskEndTs > latestTaskEndTs)) {
                        latestStartTs = sTs;
                        latestTaskEndTs = taskEndTs;
                    }
                    continue;
                }
                const a = sTs || eTs;
                const b = eTs || sTs;
                if (!a || !b) continue;
                if (!minTs || a < minTs) minTs = a;
                if (!maxTs || b > maxTs) maxTs = b;
            }
            if (anchorByStartDate && latestStartTs) {
                maxTs = latestTaskEndTs || latestStartTs;
            } else if (anchorByStartDate && !latestStartTs) {
                return computeAutoRangeTs(taskItems, paddingDays, { extraFutureMonths });
            }
            const now = Date.now();
            if (!minTs || !maxTs) {
                const today = startOfDayTs(now);
                const start = today - 7 * DAY_MS;
                const endBase = startOfDayTs(today + 21 * DAY_MS);
                const end = extraFutureMonths > 0
                    ? extendTimelineEndTs(endBase, extraFutureMonths)
                    : endBase;
                return { startTs: start, endTs: end };
            }
            const pad = Math.max(0, Number(paddingDays) || 0) * DAY_MS;
            const startTs = startOfDayTs(minTs - pad);
            const endBaseTs = startOfDayTs(maxTs + pad);
            const endTs = extraFutureMonths > 0
                ? extendTimelineEndTs(endBaseTs, extraFutureMonths)
                : endBaseTs;
            return { startTs, endTs };
        }

        function buildDayCellsHtml(startTs, dayCount, dayWidth) {
            const cells = [];
            let lastMonthKey = '';
            for (let i = 0; i < dayCount; i++) {
                const ts = startTs + i * DAY_MS;
                const d = new Date(ts);
                const monthKey = `${d.getFullYear()}-${d.getMonth() + 1}`;
                const isNewMonth = monthKey !== lastMonthKey;
                if (isNewMonth) lastMonthKey = monthKey;
                const day = d.getDate();
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const cls = `tm-gantt-day${isWeekend ? ' tm-gantt-day--weekend' : ''}${isNewMonth ? ' tm-gantt-day--month-start' : ''}`;
                cells.push(`<div class="${cls}" style="width:${dayWidth}px">${day}</div>`);
            }
            return cells.join('');
        }

        function buildMonthHeaderHtml(startTs, dayCount, dayWidth) {
            const parts = [];
            let i = 0;
            while (i < dayCount) {
                const ts = startTs + i * DAY_MS;
                const d = new Date(ts);
                const y = d.getFullYear();
                const m = d.getMonth();
                const monthStartTs = new Date(y, m, 1, 0, 0, 0, 0).getTime();
                const nextMonthTs = new Date(y, m + 1, 1, 0, 0, 0, 0).getTime();
                const monthEndTs = nextMonthTs - DAY_MS;
                const startIndex = Math.max(0, Math.floor((monthStartTs - startTs) / DAY_MS));
                const endIndex = Math.min(dayCount - 1, Math.floor((monthEndTs - startTs) / DAY_MS));
                const spanDays = endIndex - startIndex + 1;
                const width = spanDays * dayWidth;
                const label = `${y}-${String(m + 1).padStart(2, '0')}`;
                parts.push(`<div class="tm-gantt-month" style="width:${width}px">${label}</div>`);
                i = endIndex + 1;
            }
            return parts.join('');
        }

        function getDayIndexByTs(startTs, ts) {
            return Math.round((startOfDayTs(ts) - startTs) / DAY_MS);
        }

        function formatTimelineHintDate(ts) {
            const d = new Date(ts);
            if (Number.isNaN(d.getTime())) return '';
            return `${d.getMonth() + 1}月${d.getDate()}日`;
        }

        function buildTimelineDayBgHtml(startTs, dayCount, dayWidth) {
            const cells = [];
            let lastMonthKey = '';
            for (let i = 0; i < dayCount; i++) {
                const ts = startTs + i * DAY_MS;
                const d = new Date(ts);
                const monthKey = `${d.getFullYear()}-${d.getMonth() + 1}`;
                const isNewMonth = monthKey !== lastMonthKey;
                if (isNewMonth) lastMonthKey = monthKey;
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const cls = `tm-gantt-day-bg${isWeekend ? ' tm-gantt-day-bg--weekend' : ''}${isNewMonth ? ' tm-gantt-day-bg--month-start' : ''}`;
                cells.push(`<div class="${cls}" style="width:${dayWidth}px"></div>`);
            }
            return cells.join('');
        }

        function getTimelineTaskVisualMeta(task, isDark) {
            const docId = String(task?.docId || task?.root_id || '').trim();
            const baseColor = __tmGetDocColorHex(docId, isDark);
            const done = !!task?.done;
            const milestoneRaw = task?.milestone;
            const isMilestone = typeof milestoneRaw === 'boolean'
                ? milestoneRaw
                : ['1', 'true'].includes(String(milestoneRaw || '').trim().toLowerCase());
            const timelineCardFieldSet = new Set(__tmNormalizeTimelineCardFields(SettingsStore?.data?.timelineCardFields));
            const barColor = done
                ? __tmDesaturateHex(__tmDarkenHex(baseColor, isDark ? 0.48 : 0.36), isDark ? 0.36 : 0.26)
                : baseColor;
            const statusOptions = __tmGetStatusOptions(SettingsStore?.data?.customStatusOptions);
            const statusOption = __tmResolveTaskStatusDisplayOption(task, statusOptions, { fallbackColor: '#9ca3af', fallbackName: done ? '完成' : '待办' });
            const rawStatusLabel = String(statusOption?.name || '').trim();
            const showTitle = timelineCardFieldSet.has('title');
            const showStatus = timelineCardFieldSet.has('status');
            const statusLabel = showStatus ? rawStatusLabel : '';
            const statusChipStyle = statusLabel ? __tmBuildStatusChipStyle(statusOption?.color || '#9ca3af') : '';
            const taskTitle = String(task?.content || '').trim() || '(无内容)';
            return {
                barColor,
                statusLabel,
                statusChipStyle,
                taskTitle,
                docId,
                done,
                isMilestone,
                iconName: isMilestone ? 'flag' : (done ? 'circle-check-big' : 'blocks'),
                showTitle,
                showLead: showTitle || !!statusLabel,
            };
        }

        function estimateTimelineBarContentWidth(visualMeta) {
            const visual = (visualMeta && typeof visualMeta === 'object') ? visualMeta : {};
            const titleLen = Array.from(String(visual.taskTitle || '').trim() || '(无内容)').length;
            const statusLen = Array.from(String(visual.statusLabel || '').trim()).length;
            const titleWidth = Math.min(260, Math.max(64, titleLen * 14));
            const statusWidth = statusLen ? Math.min(104, Math.max(54, statusLen * 12 + 26)) : 0;
            return 36 + titleWidth + (statusWidth ? (statusWidth + 10) : 0);
        }

        function resolveTimelineBarLayout(width, dayWidth, visualMeta = null) {
            const safeWidth = Math.max(0, Number(width) || 0);
            const safeDayWidth = Math.max(1, Number(dayWidth) || 1);
            const estimatedContentWidth = estimateTimelineBarContentWidth(visualMeta);
            const innerWidth = Math.max(0, safeWidth - 22);
            const wideThreshold = Math.max(220, safeDayWidth * 8, Math.min(estimatedContentWidth + 18, 296));
            const midThreshold = Math.max(156, safeDayWidth * 5, Math.min(Math.round(estimatedContentWidth * 0.72), 208));
            if (safeWidth >= wideThreshold && innerWidth >= estimatedContentWidth) return { mode: 'wide', overflow: false };
            if (safeWidth >= midThreshold && innerWidth >= Math.min(estimatedContentWidth, 152)) return { mode: 'mid', overflow: false };
            if (safeWidth >= Math.max(72, safeDayWidth * 2.4)) return { mode: 'narrow', overflow: true };
            return { mode: 'tiny', overflow: true };
        }

        function buildTimelineTaskBarInnerHtml(task, layout, visualMeta = null) {
            const visual = visualMeta || getTimelineTaskVisualMeta(task, !!layout?.isDark);
            const leadClassName = `tm-gantt-bar__lead${visual.isMilestone ? ' tm-gantt-bar__lead--milestone' : ''}`;
            const leadHtml = visual.showLead
                ? `<span class="${leadClassName}">${__tmRenderLucideIcon(visual.iconName, '', { size: 14 })}</span>`
                : '';
            const titleHtml = visual.showTitle
                ? `<span class="tm-gantt-bar__title">${esc(visual.taskTitle)}</span>`
                : '';
            const statusHtml = visual.statusLabel
                ? `<span class="tm-gantt-bar__status"><span class="tm-status-tag" style="${visual.statusChipStyle}">${esc(visual.statusLabel)}</span></span>`
                : '';
            const menuBtnHtml = `<button class="tm-gantt-bar__menu-btn" type="button" aria-label="时间轴菜单" title="时间轴菜单"><span class="tm-gantt-bar__menu-btn-text">···</span></button>`;
            if (visual.isMilestone) {
                return `
                    <div class="tm-gantt-bar__surface">
                        ${leadHtml}
                        <div class="tm-gantt-bar__drag-label" hidden></div>
                    </div>
                    <span class="tm-gantt-bar__label-layer tm-gantt-bar__label-layer--milestone">${titleHtml}${statusHtml}${menuBtnHtml}</span>
                    <div class="tm-gantt-bar__date-hint tm-gantt-bar__date-hint--start" data-role="start-date-hint" hidden></div>
                    <div class="tm-gantt-bar__date-hint tm-gantt-bar__date-hint--end" data-role="end-date-hint" hidden></div>
                    <div class="tm-gantt-bar-handle tm-gantt-bar-handle--start" data-handle="start"></div>
                    <div class="tm-gantt-bar-handle tm-gantt-bar-handle--end" data-handle="end"></div>
                `;
            }
            return `
                <div class="tm-gantt-bar__surface">
                    <span class="tm-gantt-bar__edge tm-gantt-bar__edge--end"></span>
                    <div class="tm-gantt-bar__drag-label" hidden></div>
                </div>
                <span class="tm-gantt-bar__label-layer">${leadHtml}${titleHtml}${statusHtml}${menuBtnHtml}</span>
                <div class="tm-gantt-bar__date-hint tm-gantt-bar__date-hint--start" data-role="start-date-hint" hidden></div>
                <div class="tm-gantt-bar__date-hint tm-gantt-bar__date-hint--end" data-role="end-date-hint" hidden></div>
                <div class="tm-gantt-bar-handle tm-gantt-bar-handle--start" data-handle="start"></div>
                <div class="tm-gantt-bar-handle tm-gantt-bar-handle--end" data-handle="end"></div>
            `;
        }

        function buildTimelineTaskBarTitle(layout, visualMeta = null) {
            const visual = visualMeta || getTimelineTaskVisualMeta(null, !!layout?.isDark);
            if (visual.isMilestone) {
                return `${visual.taskTitle}\n里程碑：${formatDateOnlyFromTs(layout?.endTs || layout?.startTs)}`;
            }
            return `${visual.taskTitle}\n${formatDateOnlyFromTs(layout?.startTs)} ~ ${formatDateOnlyFromTs(layout?.endTs)}`;
        }

        function buildTimelineTaskBarHtml(task, layout) {
            const visual = getTimelineTaskVisualMeta(task, !!layout?.isDark);
            const resolved = resolveTimelineBarLayout(layout?.width, layout?.dayWidth, visual);
            const mode = String(layout?.mode || resolved.mode || 'wide');
            const isOverflow = typeof layout?.overflow === 'boolean' ? layout.overflow : !!resolved.overflow;
            const barWidth = Math.max(1, Number(layout?.width) || 0);
            const fadeStart = barWidth;
            const title = buildTimelineTaskBarTitle(layout, visual);
            const milestoneClass = visual.isMilestone ? ' tm-gantt-bar--milestone' : '';
            return `<div class="tm-gantt-bar tm-gantt-bar--${mode}${isOverflow ? ' tm-gantt-bar--overflowing' : ''}${milestoneClass}" style="left:${Number(layout?.left) || 0}px;width:${barWidth}px;--tm-gantt-bar-fill:${visual.barColor};--tm-gantt-fade-start:${fadeStart}px;" title="${esc(title)}">${buildTimelineTaskBarInnerHtml(task, { ...layout, mode, overflow: isOverflow }, visual)}</div>`;
        }

        function buildTimelineMilestoneHtml(task, layout) {
            const width = Math.max(1, Number(layout?.width) || Number(layout?.dayWidth) || 1);
            const pointTs = layout?.endTs || layout?.startTs;
            const centerLeft = Number(layout?.left) || 0;
            return buildTimelineTaskBarHtml(task, {
                ...layout,
                left: centerLeft - (width * 0.5),
                width,
                dayWidth: Number(layout?.dayWidth) || width,
                startTs: pointTs,
                endTs: pointTs,
            });
        }

        function applyTimelineTaskBarElement(barEl, task, layout) {
            if (!(barEl instanceof HTMLElement)) return null;
            const visual = getTimelineTaskVisualMeta(task, !!layout?.isDark);
            const resolved = resolveTimelineBarLayout(layout?.width, layout?.dayWidth, visual);
            const mode = String(layout?.mode || resolved.mode || 'wide');
            const isOverflow = typeof layout?.overflow === 'boolean' ? layout.overflow : !!resolved.overflow;
            const left = Number(layout?.left) || 0;
            const width = Math.max(1, Number(layout?.width) || 0);
            const fadeStart = width;
            const title = buildTimelineTaskBarTitle(layout, visual);
            const keepDragging = barEl.classList.contains('tm-gantt-bar--dragging');
            const keepResizeStart = barEl.classList.contains('tm-gantt-bar--resizing-start');
            const keepResizeEnd = barEl.classList.contains('tm-gantt-bar--resizing-end');
            const keepHintStart = barEl.classList.contains('tm-gantt-bar--hint-start');
            barEl.className = `tm-gantt-bar tm-gantt-bar--${mode}${isOverflow ? ' tm-gantt-bar--overflowing' : ''}${visual.isMilestone ? ' tm-gantt-bar--milestone' : ''}`;
            if (keepDragging) barEl.classList.add('tm-gantt-bar--dragging');
            if (keepResizeStart) barEl.classList.add('tm-gantt-bar--resizing-start');
            if (keepResizeEnd) barEl.classList.add('tm-gantt-bar--resizing-end');
            if (keepHintStart) barEl.classList.add('tm-gantt-bar--hint-start');
            barEl.style.left = `${left}px`;
            barEl.style.width = `${width}px`;
            barEl.style.top = 'calc((var(--tm-row-height) - var(--tm-gantt-card-height)) / 2)';
            barEl.style.transform = 'none';
            try { barEl.style.removeProperty('background'); } catch (e) {}
            barEl.style.setProperty('--tm-gantt-bar-fill', visual.barColor);
            barEl.style.setProperty('--tm-gantt-fade-start', `${fadeStart}px`);
            barEl.title = title;
            barEl.innerHTML = buildTimelineTaskBarInnerHtml(task, { ...layout, mode, overflow: isOverflow }, visual);
            return barEl;
        }

        function renderGantt(opts) {
            const headerEl = opts?.headerEl;
            const bodyEl = opts?.bodyEl;
            const rowModel = Array.isArray(opts?.rowModel) ? opts.rowModel : [];
            const getTaskById = typeof opts?.getTaskById === 'function' ? opts.getTaskById : null;
            const onUpdateTaskDates = typeof opts?.onUpdateTaskDates === 'function' ? opts.onUpdateTaskDates : null;
            const onUpdateTaskMeta = typeof opts?.onUpdateTaskMeta === 'function' ? opts.onUpdateTaskMeta : null;
            if (!headerEl || !bodyEl || !getTaskById) return;

            const isMobileTimelineGlobal = (() => {
                try {
                    const modal = bodyEl?.closest?.('.tm-modal');
                    return !!(modal instanceof Element && modal.classList.contains('tm-modal--mobile'));
                } catch (e) {
                    return false;
                }
            })();
            const mobileTimelineModalEl = (() => {
                try {
                    const modal = bodyEl?.closest?.('.tm-modal');
                    return modal instanceof HTMLElement ? modal : null;
                } catch (e) {
                    return null;
                }
            })();
            let mobileTimelineTouchLockRelease = null;
            let groupChipScrollCleanup = null;
            const setMobileTimelineTouchLock = (enabled) => {
                if (!isMobileTimelineGlobal) return;
                if (!enabled) {
                    if (typeof mobileTimelineTouchLockRelease === 'function') {
                        try { mobileTimelineTouchLockRelease(); } catch (e) {}
                    }
                    mobileTimelineTouchLockRelease = null;
                    return;
                }
                if (typeof mobileTimelineTouchLockRelease === 'function') return;
                const modal = mobileTimelineModalEl;
                if (!(modal instanceof HTMLElement)) return;
                const touchOpts = { capture: true, passive: false };
                const pointerOpts = { capture: true, passive: false };
                const preventMoveDefault = (ev) => {
                    try {
                        if (!modal.classList.contains('tm-modal--timeline-touch-lock')) return;
                    } catch (e) {}
                    try { ev.preventDefault(); } catch (e) {}
                };
                try { modal.classList.add('tm-modal--timeline-touch-lock'); } catch (e) {}
                try { globalThis.__tmRuntimeEvents?.on?.(window, 'touchmove', preventMoveDefault, touchOpts); } catch (e) {}
                try { globalThis.__tmRuntimeEvents?.on?.(window, 'pointermove', preventMoveDefault, pointerOpts); } catch (e) {}
                mobileTimelineTouchLockRelease = () => {
                    try { globalThis.__tmRuntimeEvents?.off?.(window, 'touchmove', preventMoveDefault, touchOpts); } catch (e) {}
                    try { globalThis.__tmRuntimeEvents?.off?.(window, 'pointermove', preventMoveDefault, pointerOpts); } catch (e) {}
                    try { modal.classList.remove('tm-modal--timeline-touch-lock'); } catch (e) {}
                };
            };

            try { cleanupMap.get(bodyEl)?.(); } catch (e) {}

            const viewState = (opts.viewState && typeof opts.viewState === 'object') ? opts.viewState : {};
            const paddingDays = Number.isFinite(Number(viewState.paddingDays)) ? Number(viewState.paddingDays) : 7;
            const dayWidth = clamp(Number(viewState.dayWidth) || 24, 10, 60);
            const escSq = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

            const tasks = [];
            for (const r of rowModel) {
                if (r?.type !== 'task') continue;
                const t = getTaskById(r.id);
                if (t) tasks.push(t);
            }

            const range = computeAutoRangeTs(tasks, paddingDays);
            const startTs = range.startTs;
            const endTs = range.endTs;
            const dayCount = clamp(Math.round((endTs - startTs) / DAY_MS) + 1, 1, TIMELINE_MAX_DAY_COUNT);
            const totalWidth = dayCount * dayWidth;
            const showCollapsedGroupLabels = !!SettingsStore.data.timelineSidebarCollapsed;
            const timelineMultiSelectedSet = new Set(
                (Array.isArray(state.timelineMultiSelectedTaskIds) ? state.timelineMultiSelectedTaskIds : [])
                    .map((x) => String(x || '').trim())
                    .filter(Boolean)
            );
            try { bodyEl.dataset.tmGanttStartTs = String(startTs); } catch (e) {}
            try { bodyEl.dataset.tmGanttDayWidth = String(dayWidth); } catch (e) {}
            try { bodyEl.dataset.tmGanttDayCount = String(dayCount); } catch (e) {}
            try { bodyEl.dataset.tmGanttTotalWidth = String(totalWidth); } catch (e) {}

            headerEl.innerHTML = `
                <div class="tm-gantt-header-inner" style="width:${totalWidth}px">
                    <div class="tm-gantt-month-row">${buildMonthHeaderHtml(startTs, dayCount, dayWidth)}</div>
                    <div class="tm-gantt-day-row">${buildDayCellsHtml(startTs, dayCount, dayWidth)}</div>
                </div>
            `;

            const nowTs = Date.now();
            const todayLeftRaw = ((nowTs - startTs) / DAY_MS) * dayWidth;
            const todayLeft = clamp(todayLeftRaw, 0, totalWidth);
            const rowsHtml = [];
            const enableGroupBg = !!SettingsStore.data.enableGroupTaskBgByGroupColor;
            const isDark = __tmIsDarkMode();
            let currentGroupBg = '';
            const resolvePinnedTaskGroupBg = (task) => {
                if (!enableGroupBg || !task) return '';
                if (state.groupByDocName || state.groupByTaskName || (!state.groupByDocName && !state.groupByTime && !state.quadrantEnabled)) {
                    const taskDocColor = __tmGetDocColorHex(task.root_id, isDark) || '';
                    return taskDocColor ? (__tmGroupBgFromLabelColor(taskDocColor, isDark) || '') : '';
                }
                if (state.groupByTime) {
                    const diffDays = Number(__tmGetTaskTimePriorityInfo(task)?.diffDays);
                    const groupInfo = !Number.isFinite(diffDays)
                        ? { key: 'pending', sortValue: Number.POSITIVE_INFINITY }
                        : (diffDays < 0
                            ? { key: 'overdue', sortValue: diffDays }
                            : { key: `days_${diffDays}`, sortValue: diffDays });
                    const timeBaseColor = isDark
                        ? __tmNormalizeHexColor(SettingsStore.data.timeGroupBaseColorDark, '#6ba5ff')
                        : __tmNormalizeHexColor(SettingsStore.data.timeGroupBaseColorLight, '#1a73e8');
                    const timeOverdueColor = isDark
                        ? __tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorDark, '#ff6b6b')
                        : __tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorLight, '#d93025');
                    const key = String(groupInfo?.key || '');
                    const sortValue = Number(groupInfo?.sortValue);
                    const labelColor = (key === 'pending' || !Number.isFinite(sortValue))
                        ? 'var(--tm-secondary-text)'
                        : (sortValue < 0
                            ? (timeOverdueColor || 'var(--tm-danger-color)')
                            : __tmWithAlpha(timeBaseColor || 'var(--tm-primary-color)', __tmClamp(1 - sortValue * (isDark ? 0.085 : 0.11), isDark ? 0.52 : 0.42, 1)));
                    return __tmGroupBgFromLabelColor(labelColor, isDark) || '';
                }
                if (state.quadrantEnabled) {
                    const quadrantRules = (SettingsStore.data.quadrantConfig && SettingsStore.data.quadrantConfig.rules) || [];
                    const priority = String(task.priority || '').toLowerCase();
                    const importance = (priority === 'a' || priority === '高' || priority === 'high')
                        ? 'high'
                        : ((priority === 'b' || priority === '中' || priority === 'medium')
                            ? 'medium'
                            : ((priority === 'c' || priority === '低' || priority === 'low') ? 'low' : 'none'));
                    const diffDays = Number(__tmGetTaskTimePriorityInfo(task)?.diffDays);
                    const timeRange = !Number.isFinite(diffDays)
                        ? 'nodate'
                        : (diffDays < 0 ? 'overdue' : (diffDays <= 7 ? 'within7days' : (diffDays <= 15 ? 'within15days' : (diffDays <= 30 ? 'within30days' : 'beyond30days'))));
                    let ruleColor = '';
                    for (const rule of quadrantRules) {
                        const importanceMatch = Array.isArray(rule?.importance) && rule.importance.includes(importance);
                        let timeRangeMatch = Array.isArray(rule?.timeRanges) && rule.timeRanges.includes(timeRange);
                        if (!timeRangeMatch && Array.isArray(rule?.timeRanges)) {
                            for (const range of rule.timeRanges) {
                                if (!String(range || '').startsWith('beyond') || range === 'beyond30days') continue;
                                const days = parseInt(String(range).replace('beyond', '').replace('days', ''), 10);
                                if (!Number.isNaN(days) && diffDays > days) { timeRangeMatch = true; break; }
                            }
                        }
                        if (importanceMatch && timeRangeMatch) {
                            const colorMap = { red: 'var(--tm-quadrant-red)', yellow: 'var(--tm-quadrant-yellow)', blue: 'var(--tm-quadrant-blue)', green: 'var(--tm-quadrant-green)' };
                            ruleColor = colorMap[String(rule?.color || '')] || 'var(--tm-text-color)';
                            break;
                        }
                    }
                    return ruleColor ? (__tmGroupBgFromLabelColor(ruleColor, isDark) || '') : '';
                }
                return '';
            };
            const buildGanttGroupChipHtml = (groupRow, labelColor) => {
                if (!showCollapsedGroupLabels || !groupRow) return '';
                const isCollapsed = !!groupRow?.collapsed;
                const toggle = `<span class="tm-group-toggle${isCollapsed ? ' tm-group-toggle--collapsed' : ''}" style="margin-right:0;display:inline-flex;align-items:center;justify-content:center;width:16px;min-width:16px;">${__tmRenderToggleIcon(16, isCollapsed ? 0 : 90, 'tm-group-toggle-icon')}</span>`;
                const countHtml = `<span class="tm-badge tm-badge--count">${Number(groupRow?.count) || 0}</span>`;
                const durationSum = String(groupRow?.durationSum || '').trim();
                const durationHtml = durationSum ? `<span class="tm-badge tm-badge--duration"><span class="tm-badge__icon">${__tmRenderBadgeIcon('chart-column')}</span>${esc(durationSum)}</span>` : '';
                if (groupRow.kind === 'pinned') {
                    return `<span class="tm-gantt-group-chip">${toggle}<span class="tm-checklist-group-pin-icon">${__tmRenderBadgeIcon('pin', 14)}</span><span class="tm-group-label" style="color:var(--tm-warning-color);">${esc(groupRow?.label || '')}</span>${countHtml}</span>`;
                }
                if (groupRow.kind === 'doc') {
                    return `<span class="tm-gantt-group-chip">${toggle}<span class="tm-group-label" style="color:${labelColor};">${__tmRenderDocGroupLabel(groupRow.docId || groupRow.id, groupRow.label || '')}</span>${countHtml}</span>`;
                }
                if (groupRow.kind === 'task') {
                    return `<span class="tm-gantt-group-chip">${toggle}<span class="tm-group-label" style="color:${labelColor};">${__tmRenderIconLabel('puzzle', groupRow.label || '')}</span>${countHtml}</span>`;
                }
                if (groupRow.kind === 'time') {
                    return `<span class="tm-gantt-group-chip">${toggle}<span class="tm-group-label" style="color:${labelColor};">${esc(groupRow.label || '')}</span>${countHtml}${durationHtml}</span>`;
                }
                if (groupRow.kind === 'h2') {
                    return `<span class="tm-gantt-group-chip">${toggle}<span class="tm-group-label" style="color:${labelColor};">${__tmRenderHeadingLevelIconLabel(groupRow.label || '', groupRow.headingLevel || SettingsStore.data.taskHeadingLevel || 'h2')}</span>${countHtml}</span>`;
                }
                if (groupRow.kind === 'quadrant') {
                    return `<span class="tm-gantt-group-chip">${toggle}<span class="tm-group-label" style="color:${labelColor};">${esc(groupRow.label || '')}</span>${countHtml}${durationHtml}</span>`;
                }
                return `<span class="tm-gantt-group-chip">${toggle}<span class="tm-group-label">${esc(groupRow?.label || '')}</span>${countHtml}</span>`;
            };
            for (const r of rowModel) {
                if (r?.type === 'group') {
                    let labelColor = '';
                    if (r.kind === 'doc') labelColor = String(r.labelColor || 'var(--tm-group-doc-label-color)');
                    else if (r.kind === 'task') labelColor = String(r.labelColor || 'var(--tm-primary-color)');
                    else if (r.kind === 'time') labelColor = String(r.labelColor || 'var(--tm-text-color)');
                    else if (r.kind === 'h2') labelColor = String(r.labelColor || __tmGetHeadingSubgroupLabelColor('var(--tm-group-doc-label-color)', isDark));
                    else if (r.kind === 'quadrant') {
                        const colorMap = { red: 'var(--tm-quadrant-red)', yellow: 'var(--tm-quadrant-yellow)', blue: 'var(--tm-quadrant-blue)', green: 'var(--tm-quadrant-green)' };
                        labelColor = colorMap[String(r.color || '')] || 'var(--tm-text-color)';
                    } else {
                        labelColor = 'var(--tm-text-color)';
                    }
                    // 按任务名分组时使用文档颜色作为分组背景
                    if (r.kind === 'task' && r.groupDocColor) {
                        currentGroupBg = enableGroupBg ? (__tmGroupBgFromLabelColor(r.groupDocColor, isDark) || '') : '';
                    } else {
                        currentGroupBg = enableGroupBg ? (__tmGroupBgFromLabelColor(labelColor, isDark) || '') : '';
                    }
                    rowsHtml.push(`<div class="tm-gantt-row tm-gantt-row--group" data-group-key="${String(r?.key || '')}" style="width:${totalWidth}px;height:var(--tm-row-height);min-height:var(--tm-row-height);max-height:var(--tm-row-height);cursor:pointer">${buildGanttGroupChipHtml(r, labelColor)}</div>`);
                    continue;
                }
                if (r?.type !== 'task') continue;
                const task = getTaskById(r.id);
                const docId = String(task?.docId || task?.root_id || '').trim();

                // 按任务名分组/不分组时，每个任务使用自己文档的颜色
                if ((state.groupByTaskName || (!state.groupByDocName && !state.groupByTime && !state.quadrantEnabled)) && docId) {
                    const taskDocColor = __tmGetDocColorHex(docId, isDark);
                    currentGroupBg = (enableGroupBg && taskDocColor) ? (__tmGroupBgFromLabelColor(taskDocColor, isDark) || '') : '';
                }

                const sTs0 = parseDateOnlyToTs(task?.startDate);
                const eTs0 = parseDateOnlyToTs(task?.completionTime);
                const aTs = sTs0 || eTs0;
                const bTs = eTs0 || sTs0;
                const milestoneRaw = task?.milestone;
                const isMilestone = typeof milestoneRaw === 'boolean'
                    ? milestoneRaw
                    : ['1', 'true'].includes(String(milestoneRaw || '').trim().toLowerCase());
                const resolvedGroupBg = currentGroupBg || resolvePinnedTaskGroupBg(task);
                const rowBgStyle = (enableGroupBg && resolvedGroupBg) ? `background:${resolvedGroupBg};` : '';
                const isPinnedSelected = String(state.timelineDotPinnedTaskId || '').trim() === String(r.id);
                const selectedCls = isPinnedSelected ? ' tm-gantt-row--selected tm-gantt-row--dot-open' : '';
                const dotHoverCls = String(state.timelineLinkHoverTaskId || '').trim() === String(r.id) ? ' tm-gantt-row--link-hover' : '';
                const multiSelCls = timelineMultiSelectedSet.has(String(r.id)) ? ' tm-gantt-row--multi-selected' : '';
                const rowAttrs = `data-id="${String(r.id)}" data-doc-id="${docId}" style="width:${totalWidth}px;height:var(--tm-row-height);min-height:var(--tm-row-height);max-height:var(--tm-row-height);${rowBgStyle}" ondragenter="tmTimelineLinkRowDragOver(event, '${escSq(String(r.id))}', '${escSq(docId)}')" ondragover="tmTimelineLinkRowDragOver(event, '${escSq(String(r.id))}', '${escSq(docId)}')" ondragleave="tmTimelineLinkRowDragLeave(event, '${escSq(String(r.id))}')"`;
                const buildDotHtml = (kind, leftPx) => `<span class="tm-task-link-dot tm-task-link-dot--timeline tm-task-link-dot--${kind}${state.whiteboardLinkFromTaskId === String(r.id) ? ' tm-task-link-dot--active' : ''}" style="left:${leftPx}px;" draggable="true" onmousedown="tmTaskLinkDotPressStart(event, '${escSq(String(r.id))}', '${escSq(docId)}')" ondragstart="tmTaskLinkDotDragStart(event, '${escSq(String(r.id))}', '${escSq(docId)}')" ondragend="tmTaskLinkDotDragEnd(event)" ondragover="tmTaskLinkDotDragOver(event, '${escSq(String(r.id))}', '${escSq(docId)}')" ondrop="tmTaskLinkDotDrop(event, '${escSq(String(r.id))}', '${escSq(docId)}')" title="连接${kind === 'in' ? '输入' : '输出'}点"></span>`;
                if (!aTs && !bTs) {
                    rowsHtml.push(`<div class="tm-gantt-row${selectedCls}${dotHoverCls}${multiSelCls}" ${rowAttrs}></div>`);
                    continue;
                }
                if (isMilestone && eTs0) {
                    const endIdx0 = clamp(getDayIndexByTs(startTs, eTs0), 0, dayCount - 1);
                    const markerLeft = endIdx0 * dayWidth + (dayWidth * 0.5);
                    const left = markerLeft - (dayWidth * 0.5);
                    const width = dayWidth;
                    const inLeft = left;
                    const outLeft = left + width;
                    rowsHtml.push(`
                        <div class="tm-gantt-row${selectedCls}${dotHoverCls}${multiSelCls}" ${rowAttrs}>
                            ${buildTimelineMilestoneHtml(task, { left: markerLeft, width, dayWidth, startTs: eTs0, endTs: eTs0, isDark })}
                            ${buildDotHtml('in', inLeft)}
                            ${buildDotHtml('out', outLeft)}
                        </div>
                    `);
                    continue;
                }
                const startIdx = clamp(getDayIndexByTs(startTs, aTs), 0, dayCount - 1);
                const endIdx = clamp(getDayIndexByTs(startTs, bTs), 0, dayCount - 1);
                const left = Math.min(startIdx, endIdx) * dayWidth;
                const width = (Math.abs(endIdx - startIdx) + 1) * dayWidth;
                const inLeft = left;
                const outLeft = left + width;
                rowsHtml.push(`
                    <div class="tm-gantt-row${selectedCls}${dotHoverCls}${multiSelCls}" ${rowAttrs}>
                        ${buildTimelineTaskBarHtml(task, { left, width, dayWidth, startTs: aTs, endTs: bTs, isDark })}
                        ${buildDotHtml('in', inLeft)}
                        ${buildDotHtml('out', outLeft)}
                    </div>
                `);
            }

            bodyEl.innerHTML = `
                <div class="tm-gantt-body-inner" style="width:${totalWidth}px">
                    <div class="tm-gantt-day-bg-layer">${buildTimelineDayBgHtml(startTs, dayCount, dayWidth)}</div>
                    <div class="tm-gantt-today" style="left:${todayLeft}px"></div>
                    <svg class="tm-gantt-deps" aria-hidden="true"></svg>
                    ${rowsHtml.join('')}
                </div>
            `;

            const syncGroupChipOffset = () => {
                let offset = 0;
                if (isMobileTimelineGlobal) {
                    const scrollHost = mobileTimelineModalEl?.querySelector?.('.tm-body.tm-body--timeline');
                    offset = Number(scrollHost?.scrollLeft) || 0;
                } else {
                    offset = Number(bodyEl.scrollLeft) || 0;
                }
                try { bodyEl.style.setProperty('--tm-gantt-group-chip-offset', `${Math.max(0, offset)}px`); } catch (e) {}
            };
            try { syncGroupChipOffset(); } catch (e) {}
            try {
                if (isMobileTimelineGlobal) {
                    const scrollHost = mobileTimelineModalEl?.querySelector?.('.tm-body.tm-body--timeline');
                    if (scrollHost instanceof HTMLElement) {
                        const onGroupChipScroll = () => { try { syncGroupChipOffset(); } catch (e2) {} };
                        globalThis.__tmRuntimeEvents?.on?.(scrollHost, 'scroll', onGroupChipScroll, { passive: true });
                        groupChipScrollCleanup = () => {
                            try { globalThis.__tmRuntimeEvents?.off?.(scrollHost, 'scroll', onGroupChipScroll, { passive: true }); } catch (e2) {}
                        };
                    }
                } else {
                    const onGroupChipScroll = () => { try { syncGroupChipOffset(); } catch (e2) {} };
                    globalThis.__tmRuntimeEvents?.on?.(bodyEl, 'scroll', onGroupChipScroll, { passive: true });
                    groupChipScrollCleanup = () => {
                        try { globalThis.__tmRuntimeEvents?.off?.(bodyEl, 'scroll', onGroupChipScroll, { passive: true }); } catch (e2) {}
                    };
                }
            } catch (e) {}

            const renderDependencies = () => {
                const inner = bodyEl.querySelector('.tm-gantt-body-inner');
                if (!(inner instanceof Element)) return;
                const svg = inner.querySelector('.tm-gantt-deps');
                if (!(svg instanceof SVGElement)) return;
                const width = Math.max(
                    Math.ceil(Number(bodyEl.dataset?.tmGanttTotalWidth) || 0),
                    Math.ceil(inner.getBoundingClientRect?.().width || 0),
                    Math.ceil(inner.clientWidth || 0),
                    1
                );
                const height = Math.max(
                    Math.ceil(inner.getBoundingClientRect?.().height || 0),
                    Math.ceil(inner.clientHeight || 0),
                    1
                );
                try { svg.setAttribute('width', String(width)); } catch (e) {}
                try { svg.setAttribute('height', String(height)); } catch (e) {}
                try { svg.setAttribute('viewBox', `0 0 ${width} ${height}`); } catch (e) {}

                const links = __tmGetAllTaskLinks({ includeAuto: true });
                const rootRect = inner.getBoundingClientRect();
                const selectedTimelineLinkId = String(state.timelineSelectedLinkId || '').trim();
                const getPt = (taskId, kind) => {
                    const id = String(taskId || '').trim();
                    if (!id) return null;
                    const row = inner.querySelector(`.tm-gantt-row[data-id="${CSS.escape(id)}"]`);
                    if (!(row instanceof Element)) return null;
                    const bar = row.querySelector('.tm-gantt-bar, .tm-gantt-milestone');
                    const rect = bar instanceof Element ? bar.getBoundingClientRect() : null;
                    if (!rect) return null;
                    return {
                        x: kind === 'from'
                            ? (rect.right - rootRect.left)
                            : (rect.left - rootRect.left),
                        y: rect.top - rootRect.top + (rect.height / 2),
                    };
                };
                const pointsToSmoothPathD = (pts, radius = 10) => {
                    const list = Array.isArray(pts) ? pts.filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)) : [];
                    if (list.length < 2) return '';
                    if (list.length === 2) {
                        return `M ${list[0].x.toFixed(2)} ${list[0].y.toFixed(2)} L ${list[1].x.toFixed(2)} ${list[1].y.toFixed(2)}`;
                    }
                    const parts = [`M ${list[0].x.toFixed(2)} ${list[0].y.toFixed(2)}`];
                    for (let i = 1; i < list.length - 1; i += 1) {
                        const prev = list[i - 1];
                        const curr = list[i];
                        const next = list[i + 1];
                        const dx1 = curr.x - prev.x;
                        const dy1 = curr.y - prev.y;
                        const dx2 = next.x - curr.x;
                        const dy2 = next.y - curr.y;
                        const len1 = Math.hypot(dx1, dy1);
                        const len2 = Math.hypot(dx2, dy2);
                        if (len1 < 0.01 || len2 < 0.01) {
                            parts.push(`L ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`);
                            continue;
                        }
                        const r = Math.min(radius, len1 * 0.5, len2 * 0.5);
                        const p1 = { x: curr.x - (dx1 / len1) * r, y: curr.y - (dy1 / len1) * r };
                        const p2 = { x: curr.x + (dx2 / len2) * r, y: curr.y + (dy2 / len2) * r };
                        parts.push(`L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`);
                        parts.push(`Q ${curr.x.toFixed(2)} ${curr.y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`);
                    }
                    const last = list[list.length - 1];
                    parts.push(`L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`);
                    return parts.join(' ');
                };
                const getPathTailButtonPos = (pts, bounds) => {
                    const list = Array.isArray(pts) ? pts.filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)) : [];
                    const btnSize = 20;
                    const maxX = Math.max(0, (Number(bounds?.width) || 0) - btnSize);
                    const maxY = Math.max(0, (Number(bounds?.height) || 0) - btnSize);
                    if (list.length < 2) {
                        const fallbackX = Number(bounds?.fallbackX) || 0;
                        const fallbackY = Number(bounds?.fallbackY) || 0;
                        return {
                            x: Math.min(Math.max(fallbackX - (btnSize / 2), 0), maxX),
                            y: Math.min(Math.max(fallbackY - (btnSize / 2), 0), maxY),
                        };
                    }
                    const segLens = [];
                    let total = 0;
                    for (let i = 1; i < list.length; i += 1) {
                        const dx = Number(list[i].x) - Number(list[i - 1].x);
                        const dy = Number(list[i].y) - Number(list[i - 1].y);
                        const len = Math.hypot(dx, dy);
                        segLens.push(len);
                        total += len;
                    }
                    if (!(total > 0)) {
                        return {
                            x: Math.min(Math.max(Number(list[0]?.x || 0) - (btnSize / 2), 0), maxX),
                            y: Math.min(Math.max(Number(list[0]?.y || 0) - (btnSize / 2), 0), maxY),
                        };
                    }
                    let acc = 0;
                    const tailDistance = 30;
                    const target = total <= (tailDistance + 6)
                        ? (total * 0.72)
                        : Math.max(0, total - tailDistance);
                    for (let i = 1; i < list.length; i += 1) {
                        const prev = list[i - 1];
                        const next = list[i];
                        const seg = segLens[i - 1];
                        if (acc + seg < target) {
                            acc += seg;
                            continue;
                        }
                        const t = seg <= 0 ? 0 : ((target - acc) / seg);
                        const px = prev.x + ((next.x - prev.x) * t);
                        const py = prev.y + ((next.y - prev.y) * t);
                        return {
                            x: Math.min(Math.max(px - (btnSize / 2), 0), maxX),
                            y: Math.min(Math.max(py - (btnSize / 2), 0), maxY),
                        };
                    }
                    const last = list[list.length - 1];
                    return {
                        x: Math.min(Math.max(Number(last?.x || 0) - (btnSize / 2), 0), maxX),
                        y: Math.min(Math.max(Number(last?.y || 0) - (btnSize / 2), 0), maxY),
                    };
                };
                const buildTimelineDep = (from, to) => {
                    const gap = Math.max(14, Math.min(28, Math.abs(to.x - from.x) * 0.35));
                    const x1 = from.x + gap;
                    const x2 = to.x - gap;
                    const pts = [from, { x: x1, y: from.y }, { x: x2, y: to.y }, to];
                    return { d: pointsToSmoothPathD(pts, 10), pts };
                };
                const markerIdIn = `tmTlArrowIn`;
                const markerIdOut = `tmTlArrowOut`;
                const defs = `
                    <defs>
                        <marker id="${markerIdOut}" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
                            <path d="M0,0 L8,3 L0,6 Z" fill="var(--tm-primary-color)"></path>
                        </marker>
                        <marker id="${markerIdIn}" markerWidth="8" markerHeight="6" refX="1" refY="3" orient="auto-start-reverse" markerUnits="strokeWidth">
                            <path d="M8,0 L0,3 L8,6 Z" fill="var(--tm-primary-color)"></path>
                        </marker>
                    </defs>
                `;
                const paths = links.map((link) => {
                    const from = getPt(link.from, 'from');
                    const to = getPt(link.to, 'to');
                    if (!from || !to) return '';
                    const routed = buildTimelineDep(from, to);
                    const d = routed.d;
                    const isSelected = !!link.manual && String(link.id || '').trim() === selectedTimelineLinkId;
                    const cls = link.manual
                        ? `tm-gantt-dep tm-gantt-dep--manual${isSelected ? ' tm-gantt-dep--selected' : ''}`
                        : 'tm-gantt-dep tm-gantt-dep--auto';
                    if (!link.manual) return `<path class="${cls}" d="${d}" marker-end="url(#${markerIdOut})"></path>`;
                    const idEsc = String(link.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                    const btnPos = getPathTailButtonPos(routed.pts, {
                        width,
                        height,
                        fallbackX: (from.x + to.x) * 0.5,
                        fallbackY: (from.y + to.y) * 0.5,
                    });
                    return `
                        <g class="tm-gantt-dep-wrap${isSelected ? ' tm-gantt-dep-wrap--selected' : ''}">
                            <path class="tm-gantt-dep-hit" d="${d}" onclick="tmTimelineSelectLink('${idEsc}', event)"></path>
                            <path class="${cls}" d="${d}" marker-end="url(#${markerIdOut})" onclick="tmTimelineSelectLink('${idEsc}', event)"></path>
                            <foreignObject class="tm-gantt-dep-remove" x="${btnPos.x.toFixed(2)}" y="${btnPos.y.toFixed(2)}" width="20" height="20">
                                <button xmlns="http://www.w3.org/1999/xhtml" class="tm-gantt-dep-remove-btn" type="button" title="删除连线" onclick="tmTimelineRemoveLink('${idEsc}', event)">×</button>
                            </foreignObject>
                        </g>
                    `;
                }).join('');
                let previewPath = '';
                const fromTaskId = String(state.whiteboardLinkFromTaskId || '').trim();
                const preview = state.whiteboardLinkPreview && typeof state.whiteboardLinkPreview === 'object' ? state.whiteboardLinkPreview : null;
                if (fromTaskId && preview) {
                    const from = getPt(fromTaskId, 'from');
                    if (from) {
                        let to = null;
                        const targetTaskId = String(preview.targetTaskId || '').trim();
                        if (targetTaskId) to = getPt(targetTaskId, 'to');
                        if (!to) {
                            const cx = Number(preview.clientX);
                            const cy = Number(preview.clientY);
                            if (Number.isFinite(cx) && Number.isFinite(cy)) {
                                to = { x: cx - rootRect.left, y: cy - rootRect.top };
                            }
                        }
                        if (to) {
                            const d = buildTimelineDep(from, to).d;
                            previewPath = `<path class="tm-gantt-dep tm-gantt-dep--manual" d="${d}" marker-end="url(#${markerIdOut})"></path>`;
                        }
                    }
                }
                svg.innerHTML = defs + paths + previewPath;
            };
            renderDependencies();
            state.__tmTimelineRenderDeps = renderDependencies;
            let suppressCtrlClickSelectionToggle = null;
            const setTimelineDraggingX = (on) => {
                try { bodyEl.classList.toggle('tm-gantt-body--dragging-x', !!on); } catch (e) {}
            };

            const openGanttTaskContextMenu = (taskId, anchor) => {
                if (!onUpdateTaskDates && !onUpdateTaskMeta) return;
                const taskIdText = String(taskId || '').trim();
                if (!taskIdText) return;
                const rowEl = bodyEl.querySelector(`.tm-gantt-row[data-id="${CSS.escape(taskIdText)}"]`);
                if (!(rowEl instanceof Element) || rowEl.classList.contains('tm-gantt-row--group')) return;
                const task = getTaskById(taskIdText);
                if (!task) return;
                const milestoneRaw = task?.milestone;
                const isMilestone = typeof milestoneRaw === 'boolean'
                    ? milestoneRaw
                    : ['1', 'true'].includes(String(milestoneRaw || '').trim().toLowerCase());
                const x0 = Number(anchor?.x);
                const y0 = Number(anchor?.y);
                const x = Number.isFinite(x0) ? x0 : 12;
                const y = Number.isFinite(y0) ? y0 : 12;

                const existingMenu = document.getElementById('tm-task-context-menu');
                if (existingMenu) existingMenu.remove();
                try { window.tmHideDocTabMenu?.(); } catch (e2) {}
                try {
                    if (state.ganttContextMenuCloseBindTimer) {
                        clearTimeout(state.ganttContextMenuCloseBindTimer);
                        state.ganttContextMenuCloseBindTimer = null;
                    }
                    if (state.ganttContextMenuCloseHandler) {
                        __tmClearOutsideCloseHandler(state.ganttContextMenuCloseHandler);
                        state.ganttContextMenuCloseHandler = null;
                    }
                } catch (e2) {}

                const menu = document.createElement('div');
                menu.id = 'tm-task-context-menu';
                menu.style.cssText = `
                    position: fixed;
                    top: ${y}px;
                    left: ${x}px;
                    background: var(--b3-theme-background);
                    border: 1px solid var(--b3-theme-surface-light);
                    border-radius: 4px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                    padding: 4px 0;
                    z-index: 200000;
                    min-width: 160px;
                    user-select: none;
                `;

                const createItem = (label, onClick, isDanger) => {
                    const item = document.createElement('div');
                    const labelText = String(label || '');
                    if (/<[a-z][\s\S]*>/i.test(labelText)) item.innerHTML = labelText;
                    else item.textContent = labelText;
                    item.style.cssText = `
                        padding: 6px 12px;
                        cursor: pointer;
                        font-size: 13px;
                        color: ${isDanger ? 'var(--b3-theme-error)' : 'var(--b3-theme-on-background)'};
                        display: flex;
                        align-items: center;
                        gap: 8px;
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

                menu.appendChild(createItem('🧹 清除时间轴（清空起止）', async () => {
                    try {
                        await onUpdateTaskDates(String(taskIdText), { startDate: '', completionTime: '' });
                        try { hint('✅ 已清除时间轴', 'success'); } catch (e3) {}
                    } catch (e2) {
                        try { hint(`❌ 清除失败: ${e2?.message || String(e2)}`, 'error'); } catch (e3) {}
                    }
                }, true));

                if (onUpdateTaskMeta && !isMilestone) {
                    menu.appendChild(createItem('🚩 设为里程碑事件', async () => {
                        try {
                            const endDate = String(task?.completionTime || '').trim();
                            if (!endDate) {
                                hint('⚠️ 请先设置截止日期后再设为里程碑', 'error');
                                return;
                            }
                            await onUpdateTaskMeta(String(taskIdText), { milestone: true });
                            try { hint('✅ 已设为里程碑', 'success'); } catch (e3) {}
                        } catch (e2) {
                            try { hint(`❌ 设置失败: ${e2?.message || String(e2)}`, 'error'); } catch (e3) {}
                        }
                    }));
                }

                if (onUpdateTaskMeta && isMilestone) {
                    menu.appendChild(createItem('↩ 还原普通时间轴', async () => {
                        try {
                            await onUpdateTaskMeta(String(taskIdText), { milestone: false });
                            try { hint('✅ 已还原普通时间轴', 'success'); } catch (e3) {}
                        } catch (e2) {
                            try { hint(`❌ 还原失败: ${e2?.message || String(e2)}`, 'error'); } catch (e3) {}
                        }
                    }));
                }

                document.body.appendChild(menu);
                try { __tmClampFloatingMenuToViewport(menu, x, y, { margin: 8 }); } catch (e2) {}

                const closeHandler = (ev) => {
                    try {
                        if (menu.contains(ev?.target)) return;
                    } catch (e2) {}
                    try { menu.remove(); } catch (e2) {}
                    try { __tmClearOutsideCloseHandler(closeHandler); } catch (e2) {}
                    if (state.ganttContextMenuCloseHandler === closeHandler) state.ganttContextMenuCloseHandler = null;
                    if (state.ganttContextMenuCloseBindTimer) {
                        try { clearTimeout(state.ganttContextMenuCloseBindTimer); } catch (e2) {}
                        state.ganttContextMenuCloseBindTimer = null;
                    }
                };
                state.ganttContextMenuCloseHandler = closeHandler;
                state.ganttContextMenuCloseBindTimer = setTimeout(() => {
                    __tmScheduleBindOutsideCloseHandler(closeHandler);
                    if (state.ganttContextMenuCloseBindTimer) {
                        try { clearTimeout(state.ganttContextMenuCloseBindTimer); } catch (e2) {}
                        state.ganttContextMenuCloseBindTimer = null;
                    }
                }, 0);
            };

            const onPointerDown = (e) => {
                if (!onUpdateTaskDates) return;
                const target = e.target;
                if (!(target instanceof Element)) return;
                if (target.closest('.tm-task-link-dot')) return;
                if (target.closest('.tm-gantt-bar__menu-btn')) return;
                const handleEl = target.closest('.tm-gantt-bar-handle');
                const barEl = target.closest('.tm-gantt-bar');
                if (!barEl) return;
                if (isMobileTimelineGlobal && !handleEl) return;
                const rowEl = barEl.closest('.tm-gantt-row');
                const taskId = String(rowEl?.getAttribute?.('data-id') || '').trim();
                if (!taskId) return;

                const handleType = handleEl?.getAttribute?.('data-handle');
                const action = handleType === 'start' ? 'start' : handleType === 'end' ? 'end' : 'move';
                const withMultiModifier = (action === 'move') && !!(e?.ctrlKey || e?.metaKey) && Number(e?.button) === 0;

                const startTsStr = String(bodyEl.dataset?.tmGanttStartTs || '');
                const dayWidthStr = String(bodyEl.dataset?.tmGanttDayWidth || '');
                const dayCountStr = String(bodyEl.dataset?.tmGanttDayCount || '');
                const startTs0 = Number(startTsStr);
                const dayWidth0 = Number(dayWidthStr);
                const dayCount0 = Number(dayCountStr);
                if (!Number.isFinite(startTs0) || !Number.isFinite(dayWidth0) || !Number.isFinite(dayCount0) || dayWidth0 <= 0) return;

                const selectedSet = new Set(
                    (Array.isArray(state.timelineMultiSelectedTaskIds) ? state.timelineMultiSelectedTaskIds : [])
                        .map((x) => String(x || '').trim())
                        .filter(Boolean)
                );

                if (withMultiModifier && !selectedSet.has(taskId)) {
                    selectedSet.add(taskId);
                    state.timelineMultiSelectedTaskIds = Array.from(selectedSet);
                    suppressCtrlClickSelectionToggle = { taskId, at: Date.now() };
                    try { rowEl.classList.add('tm-gantt-row--multi-selected'); } catch (e2) {}
                    try { e.preventDefault(); } catch (e3) {}
                    try { e.stopPropagation(); } catch (e3) {}
                    return;
                }

                const activeTask = getTaskById(taskId);
                const startX = e.clientX;
                const initialLeftPx = Number.parseFloat(String(barEl.style.left || '').replace('px', '')) || 0;
                const initialWidthPx = Number.parseFloat(String(barEl.style.width || '').replace('px', '')) || dayWidth0;
                const initialStartIdx = clamp(Math.round(initialLeftPx / dayWidth0), 0, dayCount0 - 1);
                const initialLen = Math.max(1, Math.round(initialWidthPx / dayWidth0));
                const initialEndIdx = clamp(initialStartIdx + initialLen - 1, 0, dayCount0 - 1);

                let lastStartIdx = initialStartIdx;
                let lastEndIdx = initialEndIdx;
                let raf = 0;
                let dragging = true;
                let dragActive = false;
                const dragThreshold = action === 'move' ? 6 : 3;
                const setBarDragState = (targetBar, enabled, dragAction = action) => {
                    if (!(targetBar instanceof HTMLElement)) return;
                    try {
                        targetBar.classList.toggle('tm-gantt-bar--dragging', !!enabled);
                        targetBar.classList.toggle('tm-gantt-bar--resizing-start', !!enabled && dragAction === 'start');
                        targetBar.classList.toggle('tm-gantt-bar--resizing-end', !!enabled && dragAction === 'end');
                        targetBar.classList.toggle('tm-gantt-bar--hint-start', !!enabled && dragAction === 'start');
                    } catch (e2) {}
                };
                const syncSingleBar = (targetBar, taskObj, sIdx, eIdx) => {
                    if (!(targetBar instanceof HTMLElement) || !taskObj) return;
                    const leftPx = sIdx * dayWidth0;
                    const widthPx = (eIdx - sIdx + 1) * dayWidth0;
                    globalThis.__TaskHorizonGanttView?.applyTimelineTaskBarElement?.(targetBar, taskObj, {
                        left: leftPx,
                        width: widthPx,
                        dayWidth: dayWidth0,
                        startTs: startTs0 + sIdx * DAY_MS,
                        endTs: startTs0 + eIdx * DAY_MS,
                        isDark,
                    });
                };
                const updateBarDateHint = () => {
                    const startHintEl = barEl.querySelector('.tm-gantt-bar__date-hint--start');
                    const endHintEl = barEl.querySelector('.tm-gantt-bar__date-hint--end');
                    const lineEl = barEl.querySelector('.tm-gantt-bar__drag-label');
                    if (!(startHintEl instanceof HTMLElement) || !(endHintEl instanceof HTMLElement) || !(lineEl instanceof HTMLElement)) return;
                    const startLabel = formatTimelineHintDate(startTs0 + lastStartIdx * DAY_MS);
                    const endLabel = formatTimelineHintDate(startTs0 + lastEndIdx * DAY_MS);
                    let startText = '';
                    let endText = '';
                    if (groupMove && groupItems.length > 1) {
                        const first = groupItems[0];
                        const delta = first.lastStartIdx - first.initialStartIdx;
                        endText = `整体偏移 ${delta >= 0 ? '+' : ''}${delta} 天`;
                    } else if (action === 'start') {
                        startText = startLabel;
                    } else if (action === 'end') {
                        endText = endLabel;
                    } else {
                        endText = `${startLabel} - ${endLabel}`;
                    }
                    const widthPx = Number.parseFloat(String(barEl.style.width || '').replace('px', '')) || initialWidthPx;
                    const lineLeft = action === 'start' ? 0 : widthPx;
                    lineEl.hidden = false;
                    lineEl.style.left = `${lineLeft}px`;
                    startHintEl.hidden = !startText;
                    startHintEl.textContent = startText;
                    endHintEl.hidden = !endText;
                    endHintEl.textContent = endText;
                };
                const clearBarDateHint = () => {
                    const startHintEl = barEl.querySelector('.tm-gantt-bar__date-hint--start');
                    const endHintEl = barEl.querySelector('.tm-gantt-bar__date-hint--end');
                    const lineEl = barEl.querySelector('.tm-gantt-bar__drag-label');
                    if (startHintEl instanceof HTMLElement) {
                        startHintEl.hidden = true;
                        startHintEl.textContent = '';
                    }
                    if (endHintEl instanceof HTMLElement) {
                        endHintEl.hidden = true;
                        endHintEl.textContent = '';
                    }
                    if (lineEl instanceof HTMLElement) {
                        lineEl.hidden = true;
                    }
                };

                const groupItems = [];
                const groupMove = (action === 'move') && selectedSet.size > 1 && selectedSet.has(taskId);
                if (groupMove) {
                    selectedSet.forEach((sid) => {
                        const row = bodyEl.querySelector(`.tm-gantt-row[data-id="${CSS.escape(sid)}"]`);
                        if (!(row instanceof Element)) return;
                        const bar = row.querySelector('.tm-gantt-bar');
                        if (!(bar instanceof HTMLElement)) return;
                        const leftPx = Number.parseFloat(String(bar.style.left || '').replace('px', '')) || 0;
                        const widthPx = Number.parseFloat(String(bar.style.width || '').replace('px', '')) || dayWidth0;
                        const sIdx = clamp(Math.round(leftPx / dayWidth0), 0, dayCount0 - 1);
                        const len = Math.max(1, Math.round(widthPx / dayWidth0));
                        const eIdx = clamp(sIdx + len - 1, 0, dayCount0 - 1);
                        groupItems.push({ taskId: sid, barEl: bar, initialStartIdx: sIdx, initialEndIdx: eIdx, lastStartIdx: sIdx, lastEndIdx: eIdx });
                    });
                }

                const activateDrag = () => {
                    if (dragActive) return;
                    dragActive = true;
                    setTimelineDraggingX(true);
                    setMobileTimelineTouchLock(true);
                    setBarDragState(barEl, true);
                    groupItems.forEach((it) => setBarDragState(it.barEl, true, 'move'));
                };

                const applyBar = (sIdx, eIdx) => {
                    const s = clamp(Math.min(sIdx, eIdx), 0, dayCount0 - 1);
                    const e2 = clamp(Math.max(sIdx, eIdx), 0, dayCount0 - 1);
                    lastStartIdx = s;
                    lastEndIdx = e2;
                    syncSingleBar(barEl, activeTask, s, e2);
                };

                const onMove = (ev) => {
                    if (!dragging) return;
                    const dx = (ev.clientX - startX);
                    const deltaDays = Math.round(dx / dayWidth0);
                    if (groupMove && groupItems.length > 1) {
                        groupItems.forEach((it) => {
                            const len = Math.max(1, it.initialEndIdx - it.initialStartIdx + 1);
                            let nextStart = it.initialStartIdx + deltaDays;
                            let nextEnd = nextStart + len - 1;
                            if (nextStart < 0) { nextStart = 0; nextEnd = len - 1; }
                            if (nextEnd > dayCount0 - 1) { nextEnd = dayCount0 - 1; nextStart = nextEnd - len + 1; }
                            it.lastStartIdx = nextStart;
                            it.lastEndIdx = nextEnd;
                            it.barEl.style.left = `${nextStart * dayWidth0}px`;
                            it.barEl.style.width = `${(nextEnd - nextStart + 1) * dayWidth0}px`;
                        });
                        return;
                    }
                    if (action === 'start') {
                        applyBar(initialStartIdx + deltaDays, initialEndIdx);
                    } else if (action === 'end') {
                        applyBar(initialStartIdx, initialEndIdx + deltaDays);
                    } else {
                        const len = Math.max(1, initialEndIdx - initialStartIdx + 1);
                        let nextStart = initialStartIdx + deltaDays;
                        let nextEnd = nextStart + len - 1;
                        if (nextStart < 0) { nextStart = 0; nextEnd = len - 1; }
                        if (nextEnd > dayCount0 - 1) { nextEnd = dayCount0 - 1; nextStart = nextEnd - len + 1; }
                        applyBar(nextStart, nextEnd);
                    }
                };

                const onWinPointerMove = (ev) => {
                    if (!dragging) return;
                    if (raf) return;
                    try { ev.preventDefault(); } catch (e) {}
                    raf = requestAnimationFrame(() => {
                        raf = 0;
                        const dx = ev.clientX - startX;
                        if (!dragActive && Math.abs(dx) < dragThreshold) return;
                        activateDrag();
                        onMove(ev);
                        updateBarDateHint();
                    });
                };

                const onUp = async () => {
                    if (!dragging) return;
                    dragging = false;
                    try { globalThis.__tmRuntimeEvents?.off?.(window, 'pointermove', onWinPointerMove, true); } catch (e) {}
                    try { globalThis.__tmRuntimeEvents?.off?.(window, 'pointerup', onUp, true); } catch (e) {}
                    try { globalThis.__tmRuntimeEvents?.off?.(window, 'pointercancel', onUp, true); } catch (e) {}
                    try { globalThis.__tmRuntimeEvents?.off?.(window, 'blur', onUp, true); } catch (e) {}
                    if (raf) cancelAnimationFrame(raf);
                    if (!dragActive) return;
                    setTimelineDraggingX(false);
                    setMobileTimelineTouchLock(false);
                    setBarDragState(barEl, false);
                    clearBarDateHint();
                    groupItems.forEach((it) => setBarDragState(it.barEl, false));

                    if (groupMove && groupItems.length > 1) {
                        const changedItems = groupItems.filter((it) => it.lastStartIdx !== it.initialStartIdx || it.lastEndIdx !== it.initialEndIdx);
                        if (!changedItems.length) return;
                        for (const it of changedItems) {
                            const t = getTaskById(it.taskId);
                            const rawStart = String(t?.startDate || '').trim();
                            const rawEnd = String(t?.completionTime || '').trim();
                            if (!rawStart && !rawEnd) continue;
                            const nextStart = rawStart ? formatDateOnlyFromTs(startTs0 + it.lastStartIdx * DAY_MS) : '';
                            const nextEnd = rawEnd ? formatDateOnlyFromTs(startTs0 + it.lastEndIdx * DAY_MS) : '';
                            try {
                                await onUpdateTaskDates(String(it.taskId), { startDate: nextStart, completionTime: nextEnd });
                            } catch (e2) {}
                        }
                        return;
                    }

                    if (lastStartIdx === initialStartIdx && lastEndIdx === initialEndIdx) return;

                    const startDate = formatDateOnlyFromTs(startTs0 + lastStartIdx * DAY_MS);
                    const completionTime = formatDateOnlyFromTs(startTs0 + lastEndIdx * DAY_MS);
                    try {
                        await onUpdateTaskDates(String(taskId), { startDate, completionTime });
                    } catch (e2) {}
                };

                try {
                    barEl.setPointerCapture?.(e.pointerId);
                } catch (e2) {}

                globalThis.__tmRuntimeEvents?.on?.(window, 'pointermove', onWinPointerMove, true);
                globalThis.__tmRuntimeEvents?.on?.(window, 'pointerup', onUp, true);
                globalThis.__tmRuntimeEvents?.on?.(window, 'pointercancel', onUp, true);
                globalThis.__tmRuntimeEvents?.on?.(window, 'blur', onUp, true);

                try { e.preventDefault(); } catch (e3) {}
                try { e.stopPropagation(); } catch (e3) {}
            };

            const onPanPointerDown = (e) => {
                const target = e.target;
                if (!(target instanceof Element)) return;
                if (e && typeof e.button === 'number' && e.button !== 0) return;
                if (target.closest('.tm-task-link-dot')) return;
                if (target.closest('.tm-gantt-bar__menu-btn')) return;
                if (target.closest('.tm-gantt-bar, .tm-gantt-bar-handle, .tm-gantt-milestone')) return;

                const startX = e.clientX;
                const startY = e.clientY;
                const baseScrollLeft = bodyEl.scrollLeft;
                let active = false;
                let ended = false;
                let winMoveBound = false;
                const threshold = 6;

                const cleanup = () => {
                    if (ended) return;
                    ended = true;
                    if (winMoveBound) {
                        try { globalThis.__tmRuntimeEvents?.off?.(window, 'pointermove', onWinMove, true); } catch (e2) {}
                        try { globalThis.__tmRuntimeEvents?.off?.(window, 'pointerup', onWinUp, true); } catch (e2) {}
                        try { globalThis.__tmRuntimeEvents?.off?.(window, 'pointercancel', onWinUp, true); } catch (e2) {}
                        try { globalThis.__tmRuntimeEvents?.off?.(window, 'blur', onWinUp, true); } catch (e2) {}
                    }
                    setTimelineDraggingX(false);
                    setMobileTimelineTouchLock(false);
                    try { bodyEl.style.cursor = ''; } catch (e2) {}
                };

                const onWinMove = (ev) => {
                    if (ended) return;
                    const dx = ev.clientX - startX;
                    const dy = ev.clientY - startY;
                    if (!active) {
                        if (Math.abs(dx) < threshold) return;
                        if (Math.abs(dx) <= Math.abs(dy)) return;
                        active = true;
                        setTimelineDraggingX(true);
                        setMobileTimelineTouchLock(true);
                        try { bodyEl.setPointerCapture?.(e.pointerId); } catch (e2) {}
                        try { bodyEl.style.cursor = 'grabbing'; } catch (e2) {}
                    }
                    const totalWidth0 = Number(bodyEl.dataset?.tmGanttTotalWidth || 0) || totalWidth;
                    const maxLeft = Math.max(0, totalWidth0 - bodyEl.clientWidth);
                    bodyEl.scrollLeft = clamp(baseScrollLeft - dx, 0, maxLeft);
                    try { ev.preventDefault(); } catch (e2) {}
                };

                const onWinUp = () => {
                    cleanup();
                };

                winMoveBound = true;
                globalThis.__tmRuntimeEvents?.on?.(window, 'pointermove', onWinMove, true);
                globalThis.__tmRuntimeEvents?.on?.(window, 'pointerup', onWinUp, true);
                globalThis.__tmRuntimeEvents?.on?.(window, 'pointercancel', onWinUp, true);
                globalThis.__tmRuntimeEvents?.on?.(window, 'blur', onWinUp, true);
            };

            const onDblClick = async (e) => {
                if (!onUpdateTaskDates) return;
                const target = e.target;
                if (!(target instanceof Element)) return;
                if (target.closest('.tm-gantt-bar__menu-btn')) return;
                if (target.closest('.tm-gantt-bar, .tm-gantt-bar-handle, .tm-gantt-milestone, .tm-task-link-dot')) return;
                const rowEl = target.closest('.tm-gantt-row');
                const taskId = rowEl?.getAttribute?.('data-id');
                if (!taskId) return;

                const startTsStr = String(bodyEl.dataset?.tmGanttStartTs || '');
                const dayWidthStr = String(bodyEl.dataset?.tmGanttDayWidth || '');
                const dayCountStr = String(bodyEl.dataset?.tmGanttDayCount || '');
                const startTs0 = Number(startTsStr);
                const dayWidth0 = Number(dayWidthStr);
                const dayCount0 = Number(dayCountStr);
                if (!Number.isFinite(startTs0) || !Number.isFinite(dayWidth0) || !Number.isFinite(dayCount0) || dayWidth0 <= 0) return;

                const rect = bodyEl.getBoundingClientRect();
                const relX = e.clientX - rect.left + bodyEl.scrollLeft;
                const dayIdx = clamp(Math.floor(relX / dayWidth0), 0, dayCount0 - 1);
                const completionTs = startTs0 + dayIdx * DAY_MS;
                const completionTime = formatDateOnlyFromTs(completionTs);
                if (!completionTime) return;

                const task = getTaskById(taskId);
                const startDateRaw = String(task?.startDate || '').trim();
                const startTs = parseDateOnlyToTs(startDateRaw);
                let startDate = startDateRaw;
                if (!startDate) startDate = completionTime;
                else if (Number.isFinite(startTs) && startTs > completionTs) startDate = completionTime;

                try {
                    await onUpdateTaskDates(String(taskId), { startDate, completionTime });
                    try { hint(`✅ 截止日期：${completionTime}`, 'success'); } catch (e3) {}
                } catch (e2) {}
            };

            const onContextMenu = (e) => {
                const target = e.target;
                if (!(target instanceof Element)) return;
                if (target.closest('.tm-task-link-dot')) return;
                if (isMobileTimelineGlobal) {
                    if (target.closest('.tm-gantt-row, .tm-gantt-bar, .tm-gantt-bar-handle, .tm-gantt-milestone')) {
                        try { e.preventDefault(); } catch (e2) {}
                        try { e.stopPropagation(); } catch (e2) {}
                    }
                    return;
                }
                const rowEl = target.closest('.tm-gantt-row');
                const taskId = rowEl?.getAttribute?.('data-id');
                if (!taskId) return;
                try { e.preventDefault(); } catch (e2) {}
                try { e.stopPropagation(); } catch (e2) {}
                openGanttTaskContextMenu(taskId, { x: e.clientX, y: e.clientY });
            };

            const onClick = (e) => {
                const target = e.target;
                if (!(target instanceof Element)) return;
                if (!target.closest('.tm-gantt-dep-wrap, .tm-gantt-dep, .tm-gantt-dep-remove-btn')
                    && String(state.timelineSelectedLinkId || '').trim()) {
                    state.timelineSelectedLinkId = '';
                    try { state.__tmTimelineRenderDeps?.(); } catch (e2) {}
                }
                if (target.closest('.tm-task-link-dot')) return;
                const menuBtn = target.closest('.tm-gantt-bar__menu-btn');
                if (menuBtn) {
                    const rowEl0 = menuBtn.closest('.tm-gantt-row');
                    const taskId0 = String(rowEl0?.getAttribute?.('data-id') || '').trim();
                    if (taskId0) {
                        try { e.preventDefault(); } catch (e2) {}
                        try { e.stopPropagation(); } catch (e2) {}
                        const rect = menuBtn.getBoundingClientRect();
                        openGanttTaskContextMenu(taskId0, {
                            x: Math.round(rect.right - 8),
                            y: Math.round(rect.bottom + 8),
                        });
                    }
                    return;
                }
                const withMultiModifier = !!(e?.ctrlKey || e?.metaKey);
                const rowEl = target.closest('.tm-gantt-row');
                if (!(rowEl instanceof Element) || rowEl.classList.contains('tm-gantt-row--group')) {
                    if (String(state.timelineDotPinnedTaskId || '').trim()) {
                        state.timelineDotPinnedTaskId = '';
                        try { bodyEl.querySelectorAll('.tm-gantt-row--dot-open,.tm-gantt-row--selected').forEach(el => { el.classList.remove('tm-gantt-row--dot-open'); el.classList.remove('tm-gantt-row--selected'); }); } catch (e2) {}
                    }
                    return;
                }
                const taskId = String(rowEl.getAttribute('data-id') || '').trim();
                if (!taskId) return;
                if (target.closest('.tm-gantt-bar-handle')) return;
                const isBarClick = !!target.closest('.tm-gantt-bar, .tm-gantt-milestone');
                if (!isBarClick) {
                    if (String(state.timelineDotPinnedTaskId || '').trim()) {
                        state.timelineDotPinnedTaskId = '';
                        try { bodyEl.querySelectorAll('.tm-gantt-row--dot-open,.tm-gantt-row--selected').forEach(el => { el.classList.remove('tm-gantt-row--dot-open'); el.classList.remove('tm-gantt-row--selected'); }); } catch (e2) {}
                    }
                    if (!withMultiModifier) {
                        state.timelineMultiSelectedTaskIds = [];
                        try { bodyEl.querySelectorAll('.tm-gantt-row--multi-selected').forEach((el) => el.classList.remove('tm-gantt-row--multi-selected')); } catch (e2) {}
                    }
                    return;
                }
                if (withMultiModifier) {
                    const suppress = suppressCtrlClickSelectionToggle;
                    if (suppress
                        && String(suppress.taskId || '').trim() === taskId
                        && (Date.now() - Number(suppress.at || 0)) < 500) {
                        suppressCtrlClickSelectionToggle = null;
                        try { e.preventDefault(); } catch (e2) {}
                        try { e.stopPropagation(); } catch (e2) {}
                        return;
                    }
                    const set = new Set(
                        (Array.isArray(state.timelineMultiSelectedTaskIds) ? state.timelineMultiSelectedTaskIds : [])
                            .map((x) => String(x || '').trim())
                            .filter(Boolean)
                    );
                    if (set.has(taskId)) set.delete(taskId);
                    else set.add(taskId);
                    state.timelineMultiSelectedTaskIds = Array.from(set);
                    try {
                        if (set.has(taskId)) rowEl.classList.add('tm-gantt-row--multi-selected');
                        else rowEl.classList.remove('tm-gantt-row--multi-selected');
                    } catch (e2) {}
                    try { e.preventDefault(); } catch (e2) {}
                    try { e.stopPropagation(); } catch (e2) {}
                    return;
                }
                if (Array.isArray(state.timelineMultiSelectedTaskIds) && state.timelineMultiSelectedTaskIds.length) {
                    state.timelineMultiSelectedTaskIds = [];
                    try { bodyEl.querySelectorAll('.tm-gantt-row--multi-selected').forEach((el) => el.classList.remove('tm-gantt-row--multi-selected')); } catch (e2) {}
                }
                const prev = String(state.timelineDotPinnedTaskId || '').trim();
                const next = prev === taskId ? '' : taskId;
                state.timelineDotPinnedTaskId = next;
                try { bodyEl.querySelectorAll('.tm-gantt-row--dot-open,.tm-gantt-row--selected').forEach(el => { el.classList.remove('tm-gantt-row--dot-open'); el.classList.remove('tm-gantt-row--selected'); }); } catch (e2) {}
                if (next) {
                    try { rowEl.classList.add('tm-gantt-row--dot-open', 'tm-gantt-row--selected'); } catch (e2) {}
                }
            };

            globalThis.__tmRuntimeEvents?.on?.(bodyEl, 'pointerdown', onPointerDown, { passive: false });
            if (!isMobileTimelineGlobal) {
                globalThis.__tmRuntimeEvents?.on?.(bodyEl, 'pointerdown', onPanPointerDown, { passive: false });
            }
            globalThis.__tmRuntimeEvents?.on?.(bodyEl, 'dblclick', onDblClick);
            globalThis.__tmRuntimeEvents?.on?.(bodyEl, 'contextmenu', onContextMenu);
            globalThis.__tmRuntimeEvents?.on?.(bodyEl, 'click', onClick);
            cleanupMap.set(bodyEl, () => {
                try { globalThis.__tmRuntimeEvents?.off?.(bodyEl, 'pointerdown', onPointerDown, { passive: false }); } catch (e) {}
                try { globalThis.__tmRuntimeEvents?.off?.(bodyEl, 'pointerdown', onPanPointerDown, { passive: false }); } catch (e) {}
                try { globalThis.__tmRuntimeEvents?.off?.(bodyEl, 'dblclick', onDblClick); } catch (e) {}
                try { globalThis.__tmRuntimeEvents?.off?.(bodyEl, 'contextmenu', onContextMenu); } catch (e) {}
                try { globalThis.__tmRuntimeEvents?.off?.(bodyEl, 'click', onClick); } catch (e) {}
                try { groupChipScrollCleanup?.(); } catch (e) {}
                try { setMobileTimelineTouchLock(false); } catch (e) {}
                if (state.__tmTimelineRenderDeps === renderDependencies) state.__tmTimelineRenderDeps = null;
            });
        }

        globalThis.__TaskHorizonGanttView = {
            render: renderGantt,
            computeRangeTs: computeAutoRangeTs,
            parseDateOnlyToTs,
            formatDateOnlyFromTs,
            formatTimelineHintDate,
            startOfDayTs,
            extendTimelineEndTs,
            DAY_MS,
            TIMELINE_MAX_DAY_COUNT,
            resolveTimelineBarLayout,
            buildTimelineTaskBarHtml,
            buildTimelineMilestoneHtml,
            applyTimelineTaskBarElement,
        };
    })();

    if (document.readyState === 'loading') {
        __tmDomReadyHandler = init;
        globalThis.__tmRuntimeEvents?.on?.(document, 'DOMContentLoaded', __tmDomReadyHandler);
    } else {
        init();
    }
})();
