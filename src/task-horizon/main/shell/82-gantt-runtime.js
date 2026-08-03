    (function () {
        const DAY_MS = 86400000;
        const cleanupMap = new WeakMap();
        const TIMELINE_SCALE_ORDER = ['day', 'week', 'month'];
        const TIMELINE_AVERAGE_MONTH_DAYS = 365.2425 / 12;
        const TIMELINE_MIN_RESIZE_WIDTH_PX = 22;
        const TIMELINE_SCALE_CONFIG = Object.freeze({
            day: Object.freeze({ label: '日', unitDays: 1, zoomWidths: Object.freeze([28, 32, 36, 40, 44]), snapDays: 1, windowDays: 397 }),
            week: Object.freeze({ label: '周', unitDays: 7, zoomWidths: Object.freeze([84, 98, 112, 126]), snapDays: 1, windowDays: 1095 }),
            month: Object.freeze({ label: '月', unitDays: TIMELINE_AVERAGE_MONTH_DAYS, zoomWidths: Object.freeze([80, 92, 104, 116, 128]), snapDays: 7, windowDays: 2192 }),
        });

        function clamp(n, min, max) {
            return Math.max(min, Math.min(max, n));
        }

        function normalizeTimelineScale(value) {
            const scale = String(value || '').trim().toLowerCase();
            return Object.prototype.hasOwnProperty.call(TIMELINE_SCALE_CONFIG, scale) ? scale : 'day';
        }

        function resolveTimelineScaleState(viewState = {}) {
            const target = (viewState && typeof viewState === 'object') ? viewState : {};
            const scale = normalizeTimelineScale(target.scale);
            const config = TIMELINE_SCALE_CONFIG[scale];
            const sourceIndexes = (target.zoomIndex && typeof target.zoomIndex === 'object') ? target.zoomIndex : {};
            const nextIndexes = { day: 2, week: 2, month: 2, ...sourceIndexes };
            if (!target.zoomIndex && scale === 'day' && Number.isFinite(Number(target.dayWidth))) {
                const legacyWidth = Number(target.dayWidth);
                nextIndexes.day = config.zoomWidths.reduce((bestIndex, width, index, widths) => (
                    Math.abs(width - legacyWidth) < Math.abs(widths[bestIndex] - legacyWidth) ? index : bestIndex
                ), 0);
            }
            const zoomIndex = clamp(Math.round(Number(nextIndexes[scale]) || 0), 0, config.zoomWidths.length - 1);
            nextIndexes[scale] = zoomIndex;
            const unitWidth = config.zoomWidths[zoomIndex];
            const dayWidth = unitWidth / config.unitDays;
            target.scale = scale;
            target.zoomIndex = nextIndexes;
            target.dayWidth = dayWidth;
            return {
                scale,
                label: config.label,
                zoomIndex,
                zoomCount: config.zoomWidths.length,
                unitWidth,
                dayWidth,
                snapDays: config.snapDays,
                windowDays: config.windowDays,
                canZoomOut: zoomIndex > 0,
                canZoomIn: zoomIndex < config.zoomWidths.length - 1,
            };
        }

        function setTimelineScale(viewState, nextScale) {
            if (!(viewState && typeof viewState === 'object')) return resolveTimelineScaleState({});
            viewState.scale = normalizeTimelineScale(nextScale);
            viewState.rangeScale = '';
            viewState.rangeStartTs = 0;
            viewState.rangeEndTs = 0;
            return resolveTimelineScaleState(viewState);
        }

        function stepTimelineZoom(viewState, direction) {
            const current = resolveTimelineScaleState(viewState);
            const config = TIMELINE_SCALE_CONFIG[current.scale];
            const delta = Number(direction) > 0 ? 1 : -1;
            viewState.zoomIndex[current.scale] = clamp(current.zoomIndex + delta, 0, config.zoomWidths.length - 1);
            return resolveTimelineScaleState(viewState);
        }

        function fitTimelineScale(viewState, dayCount, usableWidth) {
            const days = Math.max(1, Number(dayCount) || 1);
            const width = Math.max(1, Number(usableWidth) || 1);
            let selectedScale = 'month';
            let selectedIndex = 0;
            for (const scale of TIMELINE_SCALE_ORDER) {
                const config = TIMELINE_SCALE_CONFIG[scale];
                const fittingIndexes = config.zoomWidths
                    .map((unitWidth, index) => ({ index, totalWidth: days * (unitWidth / config.unitDays) }))
                    .filter((item) => item.totalWidth <= width);
                if (!fittingIndexes.length) continue;
                selectedScale = scale;
                selectedIndex = fittingIndexes[fittingIndexes.length - 1].index;
                break;
            }
            viewState.scale = selectedScale;
            if (!(viewState.zoomIndex && typeof viewState.zoomIndex === 'object')) {
                viewState.zoomIndex = { day: 2, week: 2, month: 2 };
            }
            viewState.zoomIndex[selectedScale] = selectedIndex;
            viewState.rangeScale = '';
            viewState.rangeStartTs = 0;
            viewState.rangeEndTs = 0;
            return resolveTimelineScaleState(viewState);
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
        // The DOM renders one bounded, movable window. Edge scrolling shifts this
        // window, so navigation is effectively unbounded without an ever-growing DOM.
        const TIMELINE_MAX_DAY_COUNT = 3653;

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

        function collectTimelineRangeItems(rowModel, getTaskById) {
            const items = [];
            for (const row of (Array.isArray(rowModel) ? rowModel : [])) {
                if (row?.type === 'task') {
                    const task = typeof getTaskById === 'function' ? getTaskById(row.id) : null;
                    if (task) items.push(task);
                    continue;
                }
                const entity = __tmGetTimelineGroupEntity(row);
                const timeline = entity?.timelineRange;
                if (!timeline || timeline.state === 'invalid') continue;
                const startDate = String(timeline.startDate || '').trim();
                const completionTime = String(timeline.deadline || '').trim();
                if (!startDate && !completionTime) continue;
                items.push({
                    entityKind: entity.entityKind,
                    entityId: entity.entityId,
                    startDate,
                    completionTime,
                });
            }
            return items;
        }

        function setTimelineRange(viewState, startTs, endTs, options = {}) {
            if (!(viewState && typeof viewState === 'object')) return null;
            const scale = normalizeTimelineScale(options?.scale || viewState.scale);
            let start = startOfDayTs(startTs);
            let end = startOfDayTs(endTs);
            if (!start || !end) return null;
            if (end < start) [start, end] = [end, start];
            const requestedDays = Math.max(1, Math.round((end - start) / DAY_MS) + 1);
            const dayCount = Math.min(TIMELINE_MAX_DAY_COUNT, requestedDays);
            if (requestedDays > dayCount) {
                const centerTs = start + ((end - start) / 2);
                start = startOfDayTs(centerTs - Math.floor(dayCount / 2) * DAY_MS);
                end = start + (dayCount - 1) * DAY_MS;
            }
            viewState.rangeScale = scale;
            viewState.rangeStartTs = start;
            viewState.rangeEndTs = end;
            return { startTs: start, endTs: end, dayCount };
        }

        function centerTimelineRangeOnDate(viewState, dateTs, ratio = 0.5) {
            if (!(viewState && typeof viewState === 'object')) return null;
            const scaleState = resolveTimelineScaleState(viewState);
            const config = TIMELINE_SCALE_CONFIG[scaleState.scale];
            const dayCount = clamp(Math.round(config.windowDays), 1, TIMELINE_MAX_DAY_COUNT);
            const safeRatio = clamp(Number(ratio) || 0, 0, 1);
            const anchorTs = startOfDayTs(dateTs) || startOfDayTs(Date.now());
            const startTs = startOfDayTs(anchorTs - Math.floor((dayCount - 1) * safeRatio) * DAY_MS);
            return setTimelineRange(viewState, startTs, startTs + (dayCount - 1) * DAY_MS, { scale: scaleState.scale });
        }

        function resolveTimelineRenderRange(taskItems, paddingDays, scaleState, viewState) {
            const scale = normalizeTimelineScale(scaleState?.scale || viewState?.scale);
            const storedStart = startOfDayTs(viewState?.rangeStartTs);
            const storedEnd = startOfDayTs(viewState?.rangeEndTs);
            if (viewState?.rangeScale === scale && storedStart && storedEnd >= storedStart) {
                return setTimelineRange(viewState, storedStart, storedEnd, { scale });
            }

            const taskRange = computeAutoRangeTs(taskItems, paddingDays, { extraFutureMonths: 0 });
            const taskStart = startOfDayTs(taskRange?.startTs);
            const taskEnd = startOfDayTs(taskRange?.endTs);
            const datedTaskCount = (Array.isArray(taskItems) ? taskItems : []).reduce((count, task) => (
                count + (parseDateOnlyToTs(task?.startDate) || parseDateOnlyToTs(task?.completionTime) ? 1 : 0)
            ), 0);
            const pendingAnchorTs = startOfDayTs(viewState?.pendingAnchor?.dateTs);
            const anchorTs = pendingAnchorTs
                || (datedTaskCount > 0 && taskStart && taskEnd ? taskStart + ((taskEnd - taskStart) / 2) : startOfDayTs(Date.now()));
            const config = TIMELINE_SCALE_CONFIG[scale];
            const dayCount = clamp(Math.round(config.windowDays), 1, TIMELINE_MAX_DAY_COUNT);
            let startTs = startOfDayTs(anchorTs - Math.floor(dayCount / 2) * DAY_MS);
            let endTs = startTs + (dayCount - 1) * DAY_MS;

            // Keep the complete task range visible when it already fits in the
            // bounded window; larger ranges remain reachable by edge scrolling.
            const taskDayCount = taskStart && taskEnd ? Math.round((taskEnd - taskStart) / DAY_MS) + 1 : 0;
            if (!pendingAnchorTs && taskDayCount > 0 && taskDayCount <= dayCount) {
                if (taskStart < startTs) {
                    startTs = taskStart;
                    endTs = startTs + (dayCount - 1) * DAY_MS;
                }
                if (taskEnd > endTs) {
                    endTs = taskEnd;
                    startTs = endTs - (dayCount - 1) * DAY_MS;
                }
            }
            return setTimelineRange(viewState, startTs, endTs, { scale });
        }

        function shiftTimelineRange(viewState, direction) {
            if (!(viewState && typeof viewState === 'object')) return null;
            const scaleState = resolveTimelineScaleState(viewState);
            const startTs = startOfDayTs(viewState.rangeStartTs);
            const endTs = startOfDayTs(viewState.rangeEndTs);
            if (!startTs || !endTs || endTs < startTs || viewState.rangeScale !== scaleState.scale) {
                return centerTimelineRangeOnDate(viewState, Date.now(), 0.5);
            }
            const dayCount = Math.max(1, Math.round((endTs - startTs) / DAY_MS) + 1);
            const shiftDays = Math.max(28, Math.round(dayCount * 0.3));
            const delta = (Number(direction) < 0 ? -1 : 1) * shiftDays * DAY_MS;
            return setTimelineRange(viewState, startTs + delta, endTs + delta, { scale: scaleState.scale });
        }

        function isSameCalendarDay(aTs, bTs) {
            const a = new Date(aTs);
            const b = new Date(bTs);
            return a.getFullYear() === b.getFullYear()
                && a.getMonth() === b.getMonth()
                && a.getDate() === b.getDate();
        }

        function getIsoWeekNumber(ts) {
            const d = new Date(ts);
            const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            const day = utc.getUTCDay() || 7;
            utc.setUTCDate(utc.getUTCDate() + 4 - day);
            const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
            return Math.ceil((((utc - yearStart) / DAY_MS) + 1) / 7);
        }

        function buildDayCellsHtml(startTs, dayCount, dayWidth) {
            const cells = [];
            const todayTs = startOfDayTs(Date.now());
            for (let i = 0; i < dayCount; i++) {
                const ts = startTs + i * DAY_MS;
                const d = new Date(ts);
                const day = d.getDate();
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const isMonthStart = d.getDate() === 1;
                const isToday = isSameCalendarDay(ts, todayTs);
                const cls = `tm-gantt-day tm-gantt-period-cell tm-gantt-period-cell--day${isWeekend ? ' tm-gantt-day--weekend' : ''}${isMonthStart ? ' tm-gantt-day--month-start' : ''}${isToday ? ' tm-gantt-period-cell--current' : ''}`;
                cells.push(`<div class="${cls}" style="left:${i * dayWidth}px;width:${dayWidth}px" aria-label="${d.getFullYear()}年${d.getMonth() + 1}月${day}日"><span class="tm-gantt-date-marker">${day}</span></div>`);
            }
            return cells.join('');
        }

        function buildTimelinePeriodSegments(startTs, dayCount, period) {
            const segments = [];
            let segmentStart = 0;
            const shouldStartNextSegment = (index) => {
                const current = new Date(startTs + index * DAY_MS);
                if (period === 'week') return current.getDay() === 1;
                const previous = new Date(startTs + (index - 1) * DAY_MS);
                if (period === 'year') return current.getFullYear() !== previous.getFullYear();
                return current.getFullYear() !== previous.getFullYear() || current.getMonth() !== previous.getMonth();
            };
            for (let i = 1; i <= dayCount; i++) {
                if (i < dayCount && !shouldStartNextSegment(i)) continue;
                const startDate = new Date(startTs + segmentStart * DAY_MS);
                const endDate = new Date(startTs + (i - 1) * DAY_MS);
                segments.push({ startIndex: segmentStart, spanDays: i - segmentStart, startDate, endDate });
                segmentStart = i;
            }
            return segments;
        }

        function buildWeekAlignedMonthSegments(startTs, dayCount) {
            const segments = [];
            buildTimelinePeriodSegments(startTs, dayCount, 'week').forEach((week) => {
                const labelTs = week.startDate.getTime() + Math.floor((week.spanDays - 1) / 2) * DAY_MS;
                const labelDate = new Date(labelTs);
                const key = `${labelDate.getFullYear()}-${labelDate.getMonth()}`;
                const previous = segments[segments.length - 1];
                if (previous?.key === key) {
                    previous.spanDays += week.spanDays;
                    previous.endDate = week.endDate;
                    return;
                }
                segments.push({ ...week, key, labelDate });
            });
            return segments;
        }

        function buildMonthHeaderHtml(startTs, dayCount, dayWidth, alignToWeeks = false) {
            const today = new Date();
            const segments = alignToWeeks
                ? buildWeekAlignedMonthSegments(startTs, dayCount)
                : buildTimelinePeriodSegments(startTs, dayCount, 'month');
            return segments.map((segment) => {
                const d = segment.labelDate || segment.startDate;
                const y = d.getFullYear();
                const m = d.getMonth();
                const label = `${y}年${m + 1}月`;
                const isCurrent = today.getFullYear() === y && today.getMonth() === m;
                return `<div class="tm-gantt-month tm-gantt-period-cell tm-gantt-period-cell--upper${isCurrent ? ' tm-gantt-period-cell--current-period' : ''}" style="left:${segment.startIndex * dayWidth}px;width:${segment.spanDays * dayWidth}px">${label}</div>`;
            }).join('');
        }

        function buildWeekCellsHtml(startTs, dayCount, dayWidth) {
            const todayTs = startOfDayTs(Date.now());
            return buildTimelinePeriodSegments(startTs, dayCount, 'week').map((segment) => {
                const start = segment.startDate;
                const end = segment.endDate;
                const label = `${start.getMonth() + 1}.${start.getDate()}–${end.getMonth() + 1}.${end.getDate()}`;
                const weekLabel = `W${getIsoWeekNumber(start.getTime())}`;
                const isCurrent = todayTs >= startOfDayTs(start.getTime()) && todayTs <= startOfDayTs(end.getTime());
                const cls = `tm-gantt-day tm-gantt-period-cell tm-gantt-period-cell--week${start.getDay() === 1 ? ' tm-gantt-period-cell--boundary' : ''}${isCurrent ? ' tm-gantt-period-cell--current' : ''}`;
                return `<div class="${cls}" style="left:${segment.startIndex * dayWidth}px;width:${segment.spanDays * dayWidth}px" title="${weekLabel}" aria-label="${label}，${weekLabel}" data-tm-floating-tooltip-label="${weekLabel}" data-tm-tooltip-side="bottom"><span class="tm-gantt-date-marker tm-gantt-date-marker--period">${label}</span></div>`;
            }).join('');
        }

        function buildYearHeaderHtml(startTs, dayCount, dayWidth) {
            const todayYear = new Date().getFullYear();
            return buildTimelinePeriodSegments(startTs, dayCount, 'year').map((segment) => {
                const d = segment.startDate;
                const year = d.getFullYear();
                return `<div class="tm-gantt-month tm-gantt-period-cell tm-gantt-period-cell--upper${todayYear === year ? ' tm-gantt-period-cell--current-period' : ''}" style="left:${segment.startIndex * dayWidth}px;width:${segment.spanDays * dayWidth}px">${year}年</div>`;
            }).join('');
        }

        function buildMonthCellsHtml(startTs, dayCount, dayWidth) {
            const today = new Date();
            return buildTimelinePeriodSegments(startTs, dayCount, 'month').map((segment) => {
                const d = segment.startDate;
                const year = d.getFullYear();
                const month = d.getMonth();
                const isCurrent = today.getFullYear() === year && today.getMonth() === month;
                const isQuarterStart = month % 3 === 0;
                const cls = `tm-gantt-day tm-gantt-period-cell tm-gantt-period-cell--month${isQuarterStart ? ' tm-gantt-period-cell--strong-boundary' : ''}${isCurrent ? ' tm-gantt-period-cell--current' : ''}`;
                return `<div class="${cls}" style="left:${segment.startIndex * dayWidth}px;width:${segment.spanDays * dayWidth}px"><span class="tm-gantt-date-marker tm-gantt-date-marker--period">${month + 1}月</span></div>`;
            }).join('');
        }

        function buildTimelineHeaderHtml(scale, startTs, dayCount, dayWidth) {
            const upperHtml = scale === 'month'
                ? buildYearHeaderHtml(startTs, dayCount, dayWidth)
                : buildMonthHeaderHtml(startTs, dayCount, dayWidth, scale === 'week');
            const lowerHtml = scale === 'week'
                ? buildWeekCellsHtml(startTs, dayCount, dayWidth)
                : (scale === 'month'
                    ? buildMonthCellsHtml(startTs, dayCount, dayWidth)
                    : buildDayCellsHtml(startTs, dayCount, dayWidth));
            return `
                <div class="tm-gantt-month-row tm-gantt-period-row tm-gantt-period-row--upper">${upperHtml}</div>
                <div class="tm-gantt-day-row tm-gantt-period-row tm-gantt-period-row--lower">${lowerHtml}</div>
            `;
        }

        function getDayIndexByTs(startTs, ts) {
            return Math.round((startOfDayTs(ts) - startTs) / DAY_MS);
        }

        function formatTimelineHintDate(ts) {
            const d = new Date(ts);
            if (Number.isNaN(d.getTime())) return '';
            return `${d.getMonth() + 1}月${d.getDate()}日`;
        }

        function resolveTimelineScaleDateRange(pointTs, scaleInput = 'day') {
            const point = new Date(startOfDayTs(pointTs));
            if (Number.isNaN(point.getTime())) return null;
            const scale = normalizeTimelineScale(scaleInput);
            if (scale === 'week') {
                const weekday = point.getDay() || 7;
                const startTs = startOfDayTs(new Date(point.getFullYear(), point.getMonth(), point.getDate() - weekday + 1).getTime());
                return { startTs, endTs: startOfDayTs(new Date(point.getFullYear(), point.getMonth(), point.getDate() - weekday + 7).getTime()) };
            }
            if (scale === 'month') {
                return {
                    startTs: startOfDayTs(new Date(point.getFullYear(), point.getMonth(), 1).getTime()),
                    endTs: startOfDayTs(new Date(point.getFullYear(), point.getMonth() + 1, 0).getTime()),
                };
            }
            const dayTs = startOfDayTs(point.getTime());
            return { startTs: dayTs, endTs: dayTs };
        }

        function buildTimelineDayBgHtml(startTs, dayCount, dayWidth, scale = 'day') {
            const cells = [];
            const normalizedScale = normalizeTimelineScale(scale);
            const today = new Date();
            const todayTs = startOfDayTs(today.getTime());
            for (let i = 0; i < dayCount; i++) {
                const ts = startTs + i * DAY_MS;
                const d = new Date(ts);
                const isWeekend = normalizedScale === 'day' && (d.getDay() === 0 || d.getDay() === 6);
                const isCurrent = isSameCalendarDay(ts, todayTs);
                const cls = `tm-gantt-day-bg tm-gantt-grid-cell tm-gantt-grid-cell--${normalizedScale}${isWeekend ? ' tm-gantt-day-bg--weekend' : ''}${isCurrent ? ' tm-gantt-grid-cell--current' : ''}`;
                cells.push(`<div class="${cls}" style="left:${i * dayWidth}px;width:${dayWidth}px"></div>`);
            }
            return cells.join('');
        }

        function resolveTimelineTaskCompleteAtText(task) {
            if (!(task && typeof task === 'object')) return '';
            const done = typeof __tmIsTaskDoneEffective === 'function'
                ? __tmIsTaskDoneEffective(task)
                : task.done === true;
            if (!done) return '';
            const raw = typeof __tmResolveTaskCompletedAtRaw === 'function'
                ? __tmResolveTaskCompletedAtRaw(task, { completedOnly: false })
                : String(task?.taskCompleteAt || task?.task_complete_at || task?.completedAt || '').trim();
            if (!raw) return '';
            return String(
                typeof __tmFormatTaskCompletedAtTime === 'function'
                    ? __tmFormatTaskCompletedAtTime(raw)
                    : raw
            ).trim();
        }

        function getTimelineTaskVisualMeta(task, isDark) {
            const docId = String(task?.docId || task?.root_id || '').trim();
            const baseColor = __tmGetDocColorHex(docId, isDark);
            const done = !!task?.done;
            const milestoneRaw = task?.milestone;
            const isMilestone = typeof milestoneRaw === 'boolean'
                ? milestoneRaw
                : ['1', 'true'].includes(String(milestoneRaw || '').trim().toLowerCase());
            const timelineCardFieldSet = state.timelineCardFieldsHidden === true
                ? new Set()
                : new Set(__tmNormalizeTimelineCardFields(SettingsStore?.data?.timelineCardFields));
            const barColor = done
                ? __tmDesaturateHex(__tmDarkenHex(baseColor, isDark ? 0.48 : 0.36), isDark ? 0.36 : 0.26)
                : baseColor;
            const statusOptions = __tmGetStatusOptions(SettingsStore?.data?.customStatusOptions);
            const statusOption = __tmResolveTaskStatusDisplayOption(task, statusOptions, { fallbackColor: '#9ca3af', fallbackName: done ? '完成' : '待办' });
            const rawStatusLabel = String(statusOption?.name || '').trim();
            const showTitle = timelineCardFieldSet.has('title');
            const showStatus = timelineCardFieldSet.has('status');
            const showTaskCompleteAt = timelineCardFieldSet.has('taskCompleteAt');
            const statusLabel = showStatus ? rawStatusLabel : '';
            const statusChipStyle = statusLabel ? __tmBuildStatusChipStyle(statusOption?.color || '#9ca3af') : '';
            const taskCompleteAtText = showTaskCompleteAt ? resolveTimelineTaskCompleteAtText(task) : '';
            const taskTitle = String(task?.content || '').trim() || '(无内容)';
            const taskLevel = Number(task?.level);
            const parentTaskId = String(task?.parentTaskId || task?.parent_task_id || '').trim();
            const isParentTaskTitle = !!task && (Number.isFinite(taskLevel) ? taskLevel === 0 : !parentTaskId);
            return {
                barColor,
                statusLabel,
                statusChipStyle,
                taskCompleteAtText,
                taskTitle,
                docId,
                done,
                isMilestone,
                isParentTaskTitle,
                showTitle,
            };
        }

        function resolveTimelineDurationMeta(startTs, endTs) {
            const start = Number(startTs);
            const end = Number(endTs);
            const spanMs = Number.isFinite(start) && Number.isFinite(end)
                ? Math.max(0, end - start)
                : 0;
            const days = Math.max(1, Math.round(spanMs / DAY_MS) + 1);
            let label = String(days);
            if (days > 30) {
                const months = Math.floor(days / 30);
                const remainingDays = days % 30;
                label = `${months}个月${remainingDays ? `${remainingDays}天` : ''}`;
            }
            return {
                days,
                label,
                accessibleLabel: `共${days}天`,
            };
        }

        function buildTimelineDurationBadgeHtml(startTs, endTs) {
            const duration = resolveTimelineDurationMeta(startTs, endTs);
            return `<span class="tm-gantt-duration-badge" data-tm-duration-badge title="${esc(duration.accessibleLabel)}" aria-label="${esc(duration.accessibleLabel)}">${esc(duration.label)}</span>`;
        }

        function estimateTimelineBarContentWidth(visualMeta, durationLabel = '') {
            const visual = (visualMeta && typeof visualMeta === 'object') ? visualMeta : {};
            const titleLen = Array.from(String(visual.taskTitle || '').trim() || '(无内容)').length;
            const statusLen = Array.from(String(visual.statusLabel || '').trim()).length;
            const completeAtLen = Array.from(String(visual.taskCompleteAtText || '').trim()).length;
            const durationLen = Array.from(String(durationLabel || '').trim()).length;
            const titleWidth = Math.min(260, Math.max(64, titleLen * 14));
            const statusWidth = statusLen ? Math.min(104, Math.max(54, statusLen * 12 + 26)) : 0;
            const completeAtWidth = completeAtLen ? Math.min(150, Math.max(78, completeAtLen * 8 + 24)) : 0;
            const leadingIconWidth = visual.isMilestone || visual.hasLeadingIcon ? 24 : 0;
            const durationWidth = durationLen ? Math.max(24, durationLen * 12 + 12) + 8 : 0;
            return 20 + leadingIconWidth + durationWidth + titleWidth + (statusWidth ? (statusWidth + 10) : 0) + (completeAtWidth ? (completeAtWidth + 10) : 0);
        }

        function resolveTimelineBarLayout(width, dayWidth, visualMeta = null, durationLabel = '') {
            const safeWidth = Math.max(0, Number(width) || 0);
            const safeDayWidth = Math.max(1, Number(dayWidth) || 1);
            const estimatedContentWidth = estimateTimelineBarContentWidth(visualMeta, durationLabel);
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
            const showMilestoneLead = visual.isMilestone && (visual.showTitle || !!visual.statusLabel || !!visual.taskCompleteAtText);
            const leadHtml = visual.isMilestone
                ? (showMilestoneLead ? `<span class="tm-gantt-bar__lead tm-gantt-bar__lead--milestone">${__tmRenderLucideIcon('flag', '', { size: 14 })}</span>` : '')
                : buildTimelineDurationBadgeHtml(layout?.startTs, layout?.endTs);
            const titleHtml = visual.showTitle
                ? `<span class="tm-gantt-bar__title${visual.isParentTaskTitle ? ' tm-parent-task-title' : ''}">${esc(visual.taskTitle)}</span>`
                : '';
            const statusHtml = visual.statusLabel
                ? `<span class="tm-gantt-bar__status"><span class="tm-status-tag" style="${visual.statusChipStyle}">${esc(visual.statusLabel)}</span></span>`
                : '';
            const completeAtHtml = visual.taskCompleteAtText
                ? `<span class="tm-gantt-bar__complete-time" title="完成时间"><span class="tm-gantt-bar__complete-time-value">${esc(visual.taskCompleteAtText)}</span></span>`
                : '';
            const menuBtnHtml = `<button class="tm-gantt-bar__menu-btn" type="button" aria-label="时间轴菜单" title="时间轴菜单"><span class="tm-gantt-bar__menu-btn-text">···</span></button>`;
            if (visual.isMilestone) {
                return `
                    <div class="tm-gantt-bar__surface">
                        ${leadHtml}
                        <div class="tm-gantt-bar__drag-label" hidden></div>
                    </div>
                    <span class="tm-gantt-bar__label-layer tm-gantt-bar__label-layer--milestone">${titleHtml}${statusHtml}${completeAtHtml}${menuBtnHtml}</span>
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
                <span class="tm-gantt-bar__label-layer">${leadHtml}${titleHtml}${statusHtml}${completeAtHtml}${menuBtnHtml}</span>
                <div class="tm-gantt-bar__date-hint tm-gantt-bar__date-hint--start" data-role="start-date-hint" hidden></div>
                <div class="tm-gantt-bar__date-hint tm-gantt-bar__date-hint--end" data-role="end-date-hint" hidden></div>
                <div class="tm-gantt-bar-handle tm-gantt-bar-handle--start" data-handle="start"></div>
                <div class="tm-gantt-bar-handle tm-gantt-bar-handle--end" data-handle="end"></div>
            `;
        }

        function buildTimelineTaskBarTitle(layout, visualMeta = null) {
            const visual = visualMeta || getTimelineTaskVisualMeta(null, !!layout?.isDark);
            const completeAtLine = visual.taskCompleteAtText ? `\n完成时间：${visual.taskCompleteAtText}` : '';
            if (visual.isMilestone) {
                return `${visual.taskTitle}\n里程碑：${formatDateOnlyFromTs(layout?.endTs || layout?.startTs)}${completeAtLine}`;
            }
            return `${visual.taskTitle}\n${formatDateOnlyFromTs(layout?.startTs)} ~ ${formatDateOnlyFromTs(layout?.endTs)}${completeAtLine}`;
        }

        function buildTimelineTaskBarHtml(task, layout) {
            const visual = getTimelineTaskVisualMeta(task, !!layout?.isDark);
            const durationLabel = visual.isMilestone ? '' : resolveTimelineDurationMeta(layout?.startTs, layout?.endTs).label;
            const resolved = resolveTimelineBarLayout(layout?.width, layout?.dayWidth, visual, durationLabel);
            const mode = String(layout?.mode || resolved.mode || 'wide');
            const isOverflow = typeof layout?.overflow === 'boolean' ? layout.overflow : !!resolved.overflow;
            const barWidth = Math.max(1, Number(layout?.width) || 0);
            const fadeStart = barWidth;
            const title = buildTimelineTaskBarTitle(layout, visual);
            const milestoneClass = visual.isMilestone ? ' tm-gantt-bar--milestone' : '';
            return `<div class="tm-gantt-bar tm-gantt-bar--${mode}${isOverflow ? ' tm-gantt-bar--overflowing' : ''}${milestoneClass}" style="left:${Number(layout?.left) || 0}px;width:${barWidth}px;--tm-gantt-bar-fill:${visual.barColor};--tm-gantt-fade-start:${fadeStart}px;" title="${esc(title)}">${buildTimelineTaskBarInnerHtml(task, { ...layout, mode, overflow: isOverflow }, visual)}</div>`;
        }

        function getTimelineGroupVisualMeta(groupRow) {
            const entity = __tmGetTimelineGroupEntity(groupRow);
            if (!entity) return null;
            return {
                ...entity,
                title: entity.label,
                barColor: String(groupRow?.labelColor || '').trim() || 'var(--tm-group-doc-label-color)',
                state: String(entity.timelineRange?.state || 'empty').trim() || 'empty',
            };
        }

        function buildTimelineGroupBarHtml(groupRow, layout) {
            const visual = getTimelineGroupVisualMeta(groupRow);
            if (!visual) return '';
            const duration = resolveTimelineDurationMeta(layout?.startTs, layout?.endTs);
            const resolved = resolveTimelineBarLayout(layout?.width, layout?.dayWidth, {
                taskTitle: visual.title,
                showTitle: true,
                hasLeadingIcon: true,
            }, duration.label);
            const mode = String(layout?.mode || resolved.mode || 'wide');
            const isOverflow = typeof layout?.overflow === 'boolean' ? layout.overflow : !!resolved.overflow;
            const barWidth = Math.max(1, Number(layout?.width) || 0);
            const isMarker = visual.state === 'start' || visual.state === 'deadline';
            const markerClass = isMarker ? ` tm-gantt-group-marker tm-gantt-group-marker--${visual.state}` : '';
            const title = `${visual.title}\n${formatDateOnlyFromTs(layout?.startTs)}${layout?.endTs !== layout?.startTs ? ` ~ ${formatDateOnlyFromTs(layout?.endTs)}` : ''}`;
            const iconHtml = visual.entityKind === 'heading'
                ? __tmRenderHeadingLevelInlineIcon(visual.headingLevel, { size: 14 })
                : __tmRenderDocIcon(visual.entityId, {
                    size: 14,
                    fallbackHtml: __tmRenderLucideIcon('file-text', '', { size: 14 }),
                });
            const entityLabel = visual.entityKind === 'heading' ? '标题' : '文档';
            const durationHtml = buildTimelineDurationBadgeHtml(layout?.startTs, layout?.endTs);
            const handlesHtml = visual.state === 'range' && layout?.showHandles !== false
                ? '<div class="tm-gantt-bar-handle tm-gantt-bar-handle--start" data-handle="start"></div><div class="tm-gantt-bar-handle tm-gantt-bar-handle--end" data-handle="end"></div>'
                : '';
            return `<div class="tm-gantt-bar tm-gantt-bar--group-range tm-gantt-bar--${visual.entityKind} tm-gantt-bar--${mode}${isOverflow ? ' tm-gantt-bar--overflowing' : ''}${markerClass}" style="left:${Number(layout?.left) || 0}px;width:${barWidth}px;--tm-gantt-bar-fill:${visual.barColor};--tm-gantt-fade-start:${barWidth}px;" title="${esc(title)}">
                <div class="tm-gantt-bar__surface"><span class="tm-gantt-bar__edge tm-gantt-bar__edge--end"></span><div class="tm-gantt-bar__drag-label" hidden></div></div>
                <span class="tm-gantt-bar__label-layer tm-gantt-group-bar__label"><span class="tm-gantt-bar__lead">${iconHtml}</span><span class="tm-gantt-bar__title">${esc(visual.title)}</span>${durationHtml}<button class="tm-gantt-bar__menu-btn" type="button" data-tm-group-range-trigger aria-label="设置${entityLabel}日期" title="设置${entityLabel}日期">${__tmRenderLucideIcon('calendar-range', '', { size: 14 })}</button></span>
                <div class="tm-gantt-bar__date-hint tm-gantt-bar__date-hint--start" data-role="start-date-hint" hidden></div>
                <div class="tm-gantt-bar__date-hint tm-gantt-bar__date-hint--end" data-role="end-date-hint" hidden></div>
                ${handlesHtml}
            </div>`;
        }

        function applyTimelineGroupBarElement(barEl, groupRow, layout) {
            if (!(barEl instanceof HTMLElement)) return null;
            const visual = getTimelineGroupVisualMeta(groupRow);
            if (!visual) return null;
            const left = Number(layout?.left) || 0;
            const width = Math.max(1, Number(layout?.width) || 0);
            barEl.style.left = `${left}px`;
            barEl.style.width = `${width}px`;
            barEl.style.setProperty('--tm-gantt-fade-start', `${width}px`);
            barEl.title = `${visual.title}\n${formatDateOnlyFromTs(layout?.startTs)}${layout?.endTs !== layout?.startTs ? ` ~ ${formatDateOnlyFromTs(layout?.endTs)}` : ''}`;
            const duration = resolveTimelineDurationMeta(layout?.startTs, layout?.endTs);
            const durationEl = barEl.querySelector('[data-tm-duration-badge]');
            if (durationEl instanceof HTMLElement) {
                durationEl.textContent = duration.label;
                durationEl.title = duration.accessibleLabel;
                durationEl.setAttribute('aria-label', duration.accessibleLabel);
            }
            return barEl;
        }

        function buildTimelineOffscreenNavHtml(item, entityKind = 'task') {
            const isGroup = entityKind === 'doc' || entityKind === 'heading';
            const itemTitle = isGroup
                ? (String(item?.label || '').trim() || (entityKind === 'heading' ? '(空标题)' : '未命名文档'))
                : (getTimelineTaskVisualMeta(item).taskTitle || '(无内容)');
            const label = `定位到${entityKind === 'heading' ? '标题' : (entityKind === 'doc' ? '文档' : '任务')}：${itemTitle}`;
            return `
                <button class="tm-gantt-offscreen-nav${isGroup ? ' tm-gantt-offscreen-nav--group' : ''}" type="button" data-tm-gantt-offscreen-nav aria-label="${esc(label)}" title="${esc(label)}" aria-hidden="true" tabindex="-1">
                    <span class="tm-gantt-offscreen-nav__icon tm-gantt-offscreen-nav__icon--left">${__tmPhosphorBoldSvg('chevron-left', { size: 14, className: 'tm-gantt-offscreen-nav__svg' })}</span>
                    <span class="tm-gantt-offscreen-nav__icon tm-gantt-offscreen-nav__icon--right">${__tmPhosphorBoldSvg('chevron-right', { size: 14, className: 'tm-gantt-offscreen-nav__svg' })}</span>
                    ${isGroup ? `<span class="tm-gantt-offscreen-nav__label">${esc(itemTitle)}</span>` : ''}
                </button>
            `;
        }

        function resolveTimelineMilestoneLayout(layout) {
            const width = Math.max(TIMELINE_MIN_RESIZE_WIDTH_PX, Number(layout?.width) || Number(layout?.dayWidth) || 1);
            const pointTs = layout?.endTs || layout?.startTs;
            const centerLeft = Number(layout?.left) || 0;
            return {
                ...layout,
                left: centerLeft - (width * 0.5),
                width,
                dayWidth: Number(layout?.dayWidth) || width,
                startTs: pointTs,
                endTs: pointTs,
            };
        }

        function buildTimelineMilestoneHtml(task, layout) {
            return buildTimelineTaskBarHtml(task, resolveTimelineMilestoneLayout(layout));
        }

        function getTimelineBarLocalGeometry(barEl) {
            if (!(barEl instanceof HTMLElement)) return null;
            const rowEl = barEl.closest('.tm-gantt-row');
            if (!(rowEl instanceof HTMLElement)) return null;
            if (rowEl.hidden || rowEl.style.display === 'none' || rowEl.getClientRects().length === 0) return null;
            const styleLeft = Number.parseFloat(String(barEl.style.left || ''));
            const styleWidth = Number.parseFloat(String(barEl.style.width || ''));
            const left = Number.isFinite(styleLeft) ? styleLeft : Number(barEl.offsetLeft);
            const width = Number.isFinite(styleWidth) ? styleWidth : Number(barEl.offsetWidth);
            const top = Number(rowEl.offsetTop) + Number(barEl.offsetTop);
            const height = Number(barEl.offsetHeight);
            if (![left, width, top, height].every(Number.isFinite)) return null;
            return { rowEl, left, width, y: top + (height / 2) };
        }

        function syncTimelineTaskLinkDots(barEl) {
            const geometry = getTimelineBarLocalGeometry(barEl);
            if (!geometry) return false;
            const inDot = geometry.rowEl.querySelector('.tm-task-link-dot--timeline.tm-task-link-dot--in');
            const outDot = geometry.rowEl.querySelector('.tm-task-link-dot--timeline.tm-task-link-dot--out');
            if (inDot instanceof HTMLElement) inDot.style.left = `${geometry.left}px`;
            if (outDot instanceof HTMLElement) outDot.style.left = `${geometry.left + geometry.width}px`;
            return inDot instanceof HTMLElement || outDot instanceof HTMLElement;
        }

        function applyTimelineTaskBarElement(barEl, task, layout) {
            if (!(barEl instanceof HTMLElement)) return null;
            const visual = getTimelineTaskVisualMeta(task, !!layout?.isDark);
            const durationLabel = visual.isMilestone ? '' : resolveTimelineDurationMeta(layout?.startTs, layout?.endTs).label;
            const resolved = resolveTimelineBarLayout(layout?.width, layout?.dayWidth, visual, durationLabel);
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
            syncTimelineTaskLinkDots(barEl);
            return barEl;
        }

        function renderGantt(opts) {
            const headerEl = opts?.headerEl;
            const bodyEl = opts?.bodyEl;
            const rowModel = Array.isArray(opts?.rowModel) ? opts.rowModel : [];
            const rangeRowModel = Array.isArray(opts?.rangeRowModel) ? opts.rangeRowModel : rowModel;
            const appendOnly = opts?.appendOnly === true;
            const getTaskById = typeof opts?.getTaskById === 'function' ? opts.getTaskById : null;
            const onUpdateTaskDates = typeof opts?.onUpdateTaskDates === 'function' ? opts.onUpdateTaskDates : null;
            const onUpdateGroupDates = typeof opts?.onUpdateGroupDates === 'function' ? opts.onUpdateGroupDates : null;
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
            const isCompactTimelineGlobal = (() => {
                try {
                    const modal = bodyEl?.closest?.('.tm-modal');
                    return !!(modal instanceof Element && (modal.classList.contains('tm-modal--mobile') || modal.classList.contains('tm-modal--dock')));
                } catch (e) {
                    return isMobileTimelineGlobal;
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
                const scrollHost = modal.querySelector('.tm-timeline-scroll-host')
                    || modal.querySelector('.tm-body.tm-body--timeline');
                const lockedScrollLeft = scrollHost instanceof HTMLElement ? scrollHost.scrollLeft : 0;
                const lockedScrollTop = scrollHost instanceof HTMLElement ? scrollHost.scrollTop : 0;
                const restoreLockedScroll = () => {
                    if (!(scrollHost instanceof HTMLElement)) return;
                    if (scrollHost.scrollLeft === lockedScrollLeft && scrollHost.scrollTop === lockedScrollTop) return;
                    scrollHost.scrollLeft = lockedScrollLeft;
                    scrollHost.scrollTop = lockedScrollTop;
                };
                try { globalThis.__tmRuntimeEvents?.on?.(scrollHost, 'scroll', restoreLockedScroll, { passive: true }); } catch (e) {}
                try { modal.classList.add('tm-modal--timeline-touch-lock'); } catch (e) {}
                restoreLockedScroll();
                mobileTimelineTouchLockRelease = () => {
                    try { globalThis.__tmRuntimeEvents?.off?.(scrollHost, 'scroll', restoreLockedScroll, { passive: true }); } catch (e) {}
                    try { modal.classList.remove('tm-modal--timeline-touch-lock'); } catch (e) {}
                };
            };

            if (!appendOnly) {
                try { cleanupMap.get(bodyEl)?.(); } catch (e) {}
            }

            const viewState = (opts.viewState && typeof opts.viewState === 'object') ? opts.viewState : {};
            const paddingDays = Number.isFinite(Number(viewState.paddingDays)) ? Number(viewState.paddingDays) : 7;
            const scaleState = resolveTimelineScaleState(viewState);
            const scale = scaleState.scale;
            const dayWidth = scaleState.dayWidth;
            const snapDays = scaleState.snapDays;
            const escSq = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

            const rangeItems = collectTimelineRangeItems(rangeRowModel, getTaskById);
            const range = resolveTimelineRenderRange(rangeItems, paddingDays, scaleState, viewState);
            const startTs = range.startTs;
            const endTs = range.endTs;
            const dayCount = clamp(Math.round((endTs - startTs) / DAY_MS) + 1, 1, TIMELINE_MAX_DAY_COUNT);
            const totalWidth = dayCount * dayWidth;
            const showCollapsedGroupLabels = !!bodyEl.closest?.('.tm-timeline-split--sidebar-collapsed');
            const timelineMultiSelectedSet = new Set(
                (Array.isArray(state.timelineMultiSelectedTaskIds) ? state.timelineMultiSelectedTaskIds : [])
                    .map((x) => String(x || '').trim())
                    .filter(Boolean)
            );
            try { bodyEl.dataset.tmGanttStartTs = String(startTs); } catch (e) {}
            try { bodyEl.dataset.tmGanttDayWidth = String(dayWidth); } catch (e) {}
            try { bodyEl.dataset.tmGanttDayCount = String(dayCount); } catch (e) {}
            try { bodyEl.dataset.tmGanttTotalWidth = String(totalWidth); } catch (e) {}
            try { bodyEl.dataset.tmGanttScale = scale; } catch (e) {}
            try { bodyEl.dataset.tmGanttSnapDays = String(snapDays); } catch (e) {}
            try { headerEl.dataset.tmGanttScale = scale; } catch (e) {}

            if (!appendOnly) {
                headerEl.innerHTML = `
                    <div class="tm-gantt-header-inner tm-gantt-header-inner--${scale}" style="width:${totalWidth}px">
                        ${buildTimelineHeaderHtml(scale, startTs, dayCount, dayWidth)}
                    </div>
                `;
            }

            const nowTs = Date.now();
            const todayIsVisible = nowTs >= startTs && nowTs < endTs + DAY_MS;
            const todayLeft = ((nowTs - startTs) / DAY_MS) * dayWidth;
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
                            : (diffDays >= 16
                                ? { key: 'farther', sortValue: 16 }
                                : { key: `days_${diffDays}`, sortValue: diffDays }));
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
                const groupEntity = __tmGetTimelineGroupEntity(groupRow);
                const timelineState = String(groupEntity?.timelineRange?.state || 'empty');
                if (groupEntity && ['range', 'start', 'deadline'].includes(timelineState)) return '';
                const isCollapsed = !!groupRow?.collapsed;
                const toggle = `<span class="tm-group-toggle${isCollapsed ? ' tm-group-toggle--collapsed' : ''}" style="margin-right:0;display:inline-flex;align-items:center;justify-content:center;width:16px;min-width:16px;">${__tmRenderToggleIcon(16, isCollapsed ? 0 : 90, 'tm-group-toggle-icon')}</span>`;
                const countHtml = `<span class="tm-badge tm-badge--count">${Number(groupRow?.count) || 0}</span>`;
                const durationSum = String(groupRow?.durationSum || '').trim();
                const durationHtml = durationSum ? `<span class="tm-badge tm-badge--duration"><span class="tm-badge__icon">${__tmRenderBadgeIcon('chart-column')}</span>${esc(durationSum)}</span>` : '';
                if (groupRow.kind === 'pinned') {
                    return `<span class="tm-gantt-group-chip">${toggle}<span class="tm-checklist-group-pin-icon">${__tmRenderBadgeIcon('pin', 14)}</span><span class="tm-group-label" style="color:var(--tm-warning-color);">${esc(groupRow?.label || '')}</span>${countHtml}</span>`;
                }
                if (groupEntity) {
                    const invalid = timelineState === 'invalid';
                    const entityLabel = groupEntity.entityKind === 'heading' ? '标题' : '文档';
                    const labelHtml = groupEntity.entityKind === 'heading'
                        ? __tmRenderHeadingLevelIconLabel(groupEntity.label, groupEntity.headingLevel)
                        : __tmRenderDocGroupLabel(groupEntity.entityId, groupEntity.label);
                    const warningHtml = invalid ? `<span class="tm-doc-timeline-warning" title="开始日期晚于截止日期">${__tmRenderLucideIcon('triangle-alert', '', { size: 14 })}</span>` : '';
                    return `<span class="tm-gantt-group-chip${invalid ? ' tm-gantt-group-chip--warning' : ''}">${toggle}<span class="tm-group-label" style="color:${labelColor};" title="${esc(groupEntity.label)}">${labelHtml}</span><button class="tm-gantt-group-chip__date-trigger" type="button" data-tm-group-range-trigger data-tm-entity-kind="${groupEntity.entityKind}" data-entity-id="${esc(groupEntity.entityId)}" aria-label="设置${entityLabel}日期" title="${esc(`${groupEntity.label} · 设置${entityLabel}日期`)}">${__tmRenderLucideIcon('calendar-range', '', { size: 14 })}</button>${countHtml}${warningHtml}</span>`;
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
                    const groupEntity = __tmGetTimelineGroupEntity(r);
                    if (groupEntity) {
                        const timeline = groupEntity.timelineRange || {};
                        const timelineState = String(timeline.state || 'empty');
                        const hasGroupVisual = ['range', 'start', 'deadline'].includes(timelineState);
                        const startDateTs = parseDateOnlyToTs(timeline.startDate);
                        const deadlineTs = parseDateOnlyToTs(timeline.deadline);
                        const firstTs = Math.min(startDateTs || deadlineTs, deadlineTs || startDateTs);
                        const lastTs = Math.max(startDateTs || deadlineTs, deadlineTs || startDateTs);
                        const groupAttrs = `data-group-key="${esc(r?.key || '')}" data-tm-entity-kind="${groupEntity.entityKind}" data-entity-id="${esc(groupEntity.entityId)}" data-heading-level="${esc(groupEntity.headingLevel || '')}" data-timeline-state="${esc(timelineState)}" data-range-start-ts="${Number(firstTs) || 0}" data-range-end-ts="${Number(lastTs) || 0}"`;
                        const offscreenNavHtml = hasGroupVisual && firstTs && lastTs ? buildTimelineOffscreenNavHtml(r, groupEntity.entityKind) : '';
                        let groupBarHtml = '';
                        if (hasGroupVisual && firstTs && lastTs && !(lastTs < startTs || firstTs >= endTs + DAY_MS)) {
                            const startIdx = clamp(getDayIndexByTs(startTs, firstTs), 0, dayCount - 1);
                            const endIdx = clamp(getDayIndexByTs(startTs, lastTs), 0, dayCount - 1);
                            const left = Math.min(startIdx, endIdx) * dayWidth;
                            const width = (Math.abs(endIdx - startIdx) + 1) * dayWidth;
                            groupBarHtml = buildTimelineGroupBarHtml(r, {
                                left,
                                width,
                                dayWidth,
                                startTs: firstTs,
                                endTs: lastTs,
                                showHandles: !isCompactTimelineGlobal,
                            });
                        }
                        rowsHtml.push(`<div class="tm-gantt-row tm-gantt-row--group tm-gantt-row--group-range tm-gantt-row--${groupEntity.entityKind}" ${groupAttrs} style="width:${totalWidth}px;height:var(--tm-row-height);min-height:var(--tm-row-height);max-height:var(--tm-row-height);cursor:pointer">${buildGanttGroupChipHtml(r, labelColor)}${groupBarHtml}${offscreenNavHtml}</div>`);
                    } else {
                        rowsHtml.push(`<div class="tm-gantt-row tm-gantt-row--group" data-group-key="${String(r?.key || '')}" style="width:${totalWidth}px;height:var(--tm-row-height);min-height:var(--tm-row-height);max-height:var(--tm-row-height);cursor:pointer">${buildGanttGroupChipHtml(r, labelColor)}</div>`);
                    }
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
                const hoverTargetSide = String(state.whiteboardLinkFromSide || '').trim() === 'in' ? 'out' : 'in';
                const dotHoverCls = String(state.timelineLinkHoverTaskId || '').trim() === String(r.id)
                    ? ` tm-gantt-row--link-hover tm-gantt-row--link-hover-${hoverTargetSide}`
                    : '';
                const multiSelCls = timelineMultiSelectedSet.has(String(r.id)) ? ' tm-gantt-row--multi-selected' : '';
                const rowAttrs = `data-id="${String(r.id)}" data-doc-id="${docId}" data-task-start-ts="${Number(aTs) || 0}" data-task-end-ts="${Number(bTs) || 0}" style="width:${totalWidth}px;height:var(--tm-row-height);min-height:var(--tm-row-height);max-height:var(--tm-row-height);${rowBgStyle}" ondragenter="tmTimelineLinkRowDragOver(event, '${escSq(String(r.id))}', '${escSq(docId)}')" ondragover="tmTimelineLinkRowDragOver(event, '${escSq(String(r.id))}', '${escSq(docId)}')" ondragleave="tmTimelineLinkRowDragLeave(event, '${escSq(String(r.id))}')"`;
                const buildDotHtml = (kind, leftPx) => `<span class="tm-task-link-dot tm-task-link-dot--timeline tm-task-link-dot--${kind}${state.whiteboardLinkFromTaskId === String(r.id) ? ' tm-task-link-dot--active' : ''}" style="left:${leftPx}px;" draggable="true" onmousedown="tmTaskLinkDotPressStart(event, '${escSq(String(r.id))}', '${escSq(docId)}', '${kind}')" ondragstart="tmTaskLinkDotDragStart(event, '${escSq(String(r.id))}', '${escSq(docId)}', '${kind}')" ondragend="tmTaskLinkDotDragEnd(event)" ondragover="tmTaskLinkDotDragOver(event, '${escSq(String(r.id))}', '${escSq(docId)}')" ondrop="tmTaskLinkDotDrop(event, '${escSq(String(r.id))}', '${escSq(docId)}')" title="连接${kind === 'in' ? '输入' : '输出'}点"></span>`;
                const offscreenNavHtml = aTs && bTs ? buildTimelineOffscreenNavHtml(task) : '';
                if (!aTs && !bTs) {
                    rowsHtml.push(`<div class="tm-gantt-row${selectedCls}${dotHoverCls}${multiSelCls}" ${rowAttrs}></div>`);
                    continue;
                }
                const visibleStartTs = Math.min(aTs || bTs, bTs || aTs);
                const visibleEndTs = Math.max(aTs || bTs, bTs || aTs);
                if (visibleEndTs < startTs || visibleStartTs >= endTs + DAY_MS) {
                    rowsHtml.push(`<div class="tm-gantt-row${selectedCls}${dotHoverCls}${multiSelCls}" ${rowAttrs}>${offscreenNavHtml}</div>`);
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
                            ${offscreenNavHtml}
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
                        ${offscreenNavHtml}
                    </div>
                `);
            }

            if (appendOnly) {
                const inner = bodyEl.querySelector('.tm-gantt-body-inner');
                if (!(inner instanceof HTMLElement)) return;
                const existingKeys = new Set(Array.from(inner.querySelectorAll('.tm-gantt-row')).map((row) => {
                    const taskId = String(row.getAttribute('data-id') || '').trim();
                    if (taskId) return `task:${taskId}`;
                    const groupKey = String(row.getAttribute('data-group-key') || '').trim();
                    return groupKey ? `group:${groupKey}` : '';
                }).filter(Boolean));
                const staging = document.createElement('div');
                staging.innerHTML = rowsHtml.join('');
                Array.from(staging.children).forEach((row) => {
                    const taskId = String(row?.getAttribute?.('data-id') || '').trim();
                    const groupKey = String(row?.getAttribute?.('data-group-key') || '').trim();
                    const key = taskId ? `task:${taskId}` : (groupKey ? `group:${groupKey}` : '');
                    if (!key || existingKeys.has(key)) return;
                    existingKeys.add(key);
                    inner.appendChild(row);
                });
                try {
                    requestAnimationFrame(() => {
                        try { state.__tmTimelineRenderDeps?.(); } catch (e) {}
                        try { state.__tmTimelineRefreshOffscreenNav?.(); } catch (e) {}
                    });
                } catch (e) {
                    try { state.__tmTimelineRenderDeps?.(); } catch (e2) {}
                }
                return;
            }

            bodyEl.innerHTML = `
                <div class="tm-gantt-body-inner" style="width:${totalWidth}px">
                    <div class="tm-gantt-day-bg-layer" aria-hidden="true">${buildTimelineDayBgHtml(startTs, dayCount, dayWidth, scale)}</div>
                    ${todayIsVisible ? `<div class="tm-gantt-today" style="left:${todayLeft}px"></div>` : ''}
                    <svg class="tm-gantt-deps" aria-hidden="true"></svg>
                    ${rowsHtml.join('')}
                </div>
            `;

            const timelineScrollHost = bodyEl.closest('.tm-timeline-scroll-host') || bodyEl;
            let timelineOffscreenNavRaf = 0;
            let timelineOffscreenNavViewportWidth = -1;
            const hideTimelineOffscreenNav = (button) => {
                if (!(button instanceof HTMLButtonElement)) return;
                if (!button.classList.contains('tm-gantt-offscreen-nav--visible') && !button.hasAttribute('data-direction')) return;
                button.classList.remove('tm-gantt-offscreen-nav--visible');
                button.removeAttribute('data-direction');
                button.setAttribute('aria-hidden', 'true');
                button.tabIndex = -1;
            };
            const getTimelineRowInterval = (row) => {
                if (!(row instanceof HTMLElement)) return null;
                const bar = row.querySelector('.tm-gantt-bar');
                if (bar instanceof HTMLElement) {
                    const left = Number.parseFloat(String(bar.style.left || ''));
                    const width = Number.parseFloat(String(bar.style.width || ''));
                    if (Number.isFinite(left) && Number.isFinite(width) && width > 0) {
                        return { left, right: left + width };
                    }
                }
                const taskStartTs = Number(row.dataset.taskStartTs || row.dataset.rangeStartTs);
                const taskEndTs = Number(row.dataset.taskEndTs || row.dataset.rangeEndTs);
                if (!Number.isFinite(taskStartTs) || !Number.isFinite(taskEndTs) || !taskStartTs || !taskEndTs) return null;
                const firstTs = Math.min(taskStartTs, taskEndTs);
                const lastTs = Math.max(taskStartTs, taskEndTs);
                return {
                    left: ((firstTs - startTs) / DAY_MS) * dayWidth,
                    right: (((lastTs - startTs) / DAY_MS) + 1) * dayWidth,
                };
            };
            const refreshTimelineOffscreenNav = () => {
                if (!(timelineScrollHost instanceof HTMLElement)) return;
                const totalWidth0 = Math.max(0, Number(bodyEl.dataset?.tmGanttTotalWidth) || 0);
                // Compact timelines keep the task table in a separate overlay,
                // so the scroll host's own content coordinates are the stable
                // date coordinates during touch scrolling.
                const visibleLeft = Math.max(0, Number(timelineScrollHost.scrollLeft) || 0);
                const viewportWidth = Math.max(0, Number(timelineScrollHost.clientWidth) || 0);
                let visibleRight = visibleLeft + viewportWidth;
                visibleRight = Math.min(totalWidth0, visibleRight);
                if (!(visibleRight - visibleLeft > 32)) return;
                const roundedViewportWidth = Math.round(viewportWidth);
                if (roundedViewportWidth !== timelineOffscreenNavViewportWidth) {
                    timelineOffscreenNavViewportWidth = roundedViewportWidth;
                    bodyEl.style.setProperty('--tm-gantt-offscreen-nav-right', `${Math.max(8, roundedViewportWidth - 32)}px`);
                }

                bodyEl.querySelectorAll('.tm-gantt-row[data-id], .tm-gantt-row[data-entity-id]').forEach((row) => {
                    const button = row.querySelector('[data-tm-gantt-offscreen-nav]');
                    if (!(button instanceof HTMLButtonElement)) return;
                    if (!row.isConnected || row.hidden || row.style.display === 'none') {
                        hideTimelineOffscreenNav(button);
                        return;
                    }
                    const interval = getTimelineRowInterval(row);
                    const direction = interval?.right <= visibleLeft + 1
                        ? 'left'
                        : (interval?.left >= visibleRight - 1 ? 'right' : '');
                    if (!direction) {
                        hideTimelineOffscreenNav(button);
                        return;
                    }
                    if (button.dataset.direction === direction && button.classList.contains('tm-gantt-offscreen-nav--visible')) return;
                    button.dataset.direction = direction;
                    button.classList.add('tm-gantt-offscreen-nav--visible');
                    button.setAttribute('aria-hidden', 'false');
                    button.tabIndex = 0;
                });
            };
            const scheduleTimelineOffscreenNavRefresh = () => {
                if (timelineOffscreenNavRaf) return;
                timelineOffscreenNavRaf = requestAnimationFrame(() => {
                    timelineOffscreenNavRaf = 0;
                    refreshTimelineOffscreenNav();
                });
            };
            state.__tmTimelineRefreshOffscreenNav = scheduleTimelineOffscreenNavRefresh;
            globalThis.__tmRuntimeEvents?.on?.(timelineScrollHost, 'scroll', scheduleTimelineOffscreenNavRefresh, { passive: true });
            globalThis.__tmRuntimeEvents?.on?.(window, 'resize', scheduleTimelineOffscreenNavRefresh, { passive: true });
            scheduleTimelineOffscreenNavRefresh();

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
                    const geometry = getTimelineBarLocalGeometry(bar);
                    if (!geometry) return null;
                    return {
                        x: kind === 'from' ? geometry.left + geometry.width : geometry.left,
                        y: geometry.y,
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
                    const isSubtaskSource = __tmIsTaskLinkSourceSubtask(link.from);
                    const sourceDepthCls = isSubtaskSource
                        ? ' tm-gantt-dep--subtask-source'
                        : ' tm-gantt-dep--root-source';
                    const cls = link.manual
                        ? `tm-gantt-dep tm-gantt-dep--manual${sourceDepthCls}${isSelected ? ' tm-gantt-dep--selected' : ''}`
                        : `tm-gantt-dep tm-gantt-dep--auto${sourceDepthCls}`;
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
                    const fromSide = String(preview.side || state.whiteboardLinkFromSide || '').trim() === 'in' ? 'in' : 'out';
                    const targetTaskId = String(preview.targetTaskId || '').trim();
                    const cx = Number(preview.clientX);
                    const cy = Number(preview.clientY);
                    const pointerPt = Number.isFinite(cx) && Number.isFinite(cy)
                        ? { x: cx - rootRect.left, y: cy - rootRect.top }
                        : null;
                    const from = fromSide === 'in'
                        ? (targetTaskId ? getPt(targetTaskId, 'from') : pointerPt)
                        : getPt(fromTaskId, 'from');
                    const to = fromSide === 'in'
                        ? getPt(fromTaskId, 'to')
                        : (targetTaskId ? getPt(targetTaskId, 'to') : pointerPt);
                    if (from && to) {
                        const d = buildTimelineDep(from, to).d;
                        const previewSourceTaskId = fromSide === 'in' ? targetTaskId : fromTaskId;
                        const previewSourceIsSubtask = __tmIsTaskLinkSourceSubtask(previewSourceTaskId);
                        const previewSourceDepthCls = previewSourceIsSubtask
                            ? ' tm-gantt-dep--subtask-source'
                            : ' tm-gantt-dep--root-source';
                        previewPath = `<path class="tm-gantt-dep tm-gantt-dep--manual${previewSourceDepthCls}" d="${d}" marker-end="url(#${markerIdOut})"></path>`;
                    }
                }
                svg.innerHTML = defs + paths + previewPath;
            };
            renderDependencies();
            state.__tmTimelineRenderDeps = renderDependencies;
            let suppressCtrlClickSelectionToggle = null;
            let selectionToolbarPositionRaf = 0;
            const selectionToolbar = (() => {
                const toolbar = document.createElement('div');
                toolbar.className = 'tm-timeline-selection-toolbar';
                toolbar.setAttribute('role', 'toolbar');
                toolbar.setAttribute('aria-label', '时间轴任务操作');
                toolbar.hidden = true;
                toolbar.innerHTML = `
                    <button type="button" class="tm-timeline-selection-toolbar__btn" data-tm-gantt-selection-action="detail" aria-label="打开任务详情" title="打开任务详情" data-tm-floating-tooltip-label="打开任务详情" data-tm-tooltip-side="bottom">${__tmRenderLucideIcon('file-text')}</button>
                    <button type="button" class="tm-timeline-selection-toolbar__btn" data-tm-gantt-selection-action="milestone" aria-label="转为里程碑" title="转为里程碑" data-tm-floating-tooltip-label="转为里程碑" data-tm-tooltip-side="bottom">${__tmRenderLucideIcon('flag')}</button>
                    <button type="button" class="tm-timeline-selection-toolbar__btn tm-timeline-selection-toolbar__btn--danger" data-tm-gantt-selection-action="clear" aria-label="清除起止日期" title="清除起止日期" data-tm-floating-tooltip-label="清除起止日期" data-tm-tooltip-side="bottom">${__tmRenderLucideIcon('trash-2')}</button>
                `;
                document.body.appendChild(toolbar);
                return toolbar;
            })();

            const isTimelineTaskMilestone = (task, taskId = '') => {
                const id = String(taskId || task?.id || '').trim();
                const rowEl = id ? bodyEl.querySelector(`.tm-gantt-row[data-id="${CSS.escape(id)}"]`) : null;
                const barEl = rowEl?.querySelector?.('.tm-gantt-bar');
                if (barEl instanceof Element) return barEl.classList.contains('tm-gantt-bar--milestone');
                const raw = task?.milestone;
                return typeof raw === 'boolean'
                    ? raw
                    : ['1', 'true'].includes(String(raw || '').trim().toLowerCase());
            };

            const positionTimelineSelectionToolbar = () => {
                if (!(selectionToolbar instanceof HTMLElement) || selectionToolbar.hidden) return;
                const taskId = String(selectionToolbar.dataset.tmTaskId || '').trim();
                const rowEl = taskId ? bodyEl.querySelector(`.tm-gantt-row[data-id="${CSS.escape(taskId)}"]`) : null;
                const barEl = rowEl?.querySelector?.('.tm-gantt-bar, .tm-gantt-milestone');
                if (!(barEl instanceof HTMLElement) || !barEl.isConnected) {
                    selectionToolbar.style.visibility = 'hidden';
                    return;
                }
                const barRect = barEl.getBoundingClientRect();
                const scrollHost = bodyEl.closest('.tm-timeline-scroll-host, .tm-body.tm-body--timeline') || bodyEl;
                const hostRect = scrollHost.getBoundingClientRect();
                const viewportWidth = Math.max(0, Number(document.documentElement?.clientWidth || window.innerWidth || 0));
                const viewportHeight = Math.max(0, Number(document.documentElement?.clientHeight || window.innerHeight || 0));
                const visibleLeft = Math.max(0, hostRect.left);
                const visibleRight = Math.min(viewportWidth, hostRect.right);
                const visibleTop = Math.max(0, hostRect.top);
                const visibleBottom = Math.min(viewportHeight, hostRect.bottom);
                if (barRect.right < visibleLeft || barRect.left > visibleRight || barRect.bottom < visibleTop || barRect.top > visibleBottom) {
                    selectionToolbar.style.visibility = 'hidden';
                    return;
                }
                const toolbarRect = selectionToolbar.getBoundingClientRect();
                const margin = 8;
                const minLeft = Math.max(margin, visibleLeft + margin);
                const maxLeft = Math.max(minLeft, Math.min(viewportWidth - toolbarRect.width - margin, visibleRight - toolbarRect.width - margin));
                const centeredLeft = barRect.left + (barRect.width - toolbarRect.width) * 0.5;
                const left = clamp(centeredLeft, minLeft, maxLeft);
                let top = barRect.top - toolbarRect.height - margin;
                let placement = 'above';
                if (top < visibleTop + margin) {
                    top = barRect.bottom + margin;
                    placement = 'below';
                }
                if (top + toolbarRect.height > visibleBottom - margin) {
                    top = Math.max(visibleTop + margin, barRect.top - toolbarRect.height - margin);
                    placement = 'above';
                }
                selectionToolbar.style.left = `${Math.round(left)}px`;
                selectionToolbar.style.top = `${Math.round(top)}px`;
                selectionToolbar.style.visibility = 'visible';
                selectionToolbar.dataset.tmPlacement = placement;
            };

            const scheduleTimelineSelectionToolbarPosition = () => {
                if (selectionToolbarPositionRaf) cancelAnimationFrame(selectionToolbarPositionRaf);
                selectionToolbarPositionRaf = requestAnimationFrame(() => {
                    selectionToolbarPositionRaf = 0;
                    positionTimelineSelectionToolbar();
                });
            };

            const syncTimelineSelectionToolbar = (taskId = state.timelineDotPinnedTaskId, milestoneOverride = null) => {
                if (!(selectionToolbar instanceof HTMLElement)) return;
                const hasMultiSelection = Array.isArray(state.timelineMultiSelectedTaskIds) && state.timelineMultiSelectedTaskIds.length > 0;
                const id = hasMultiSelection ? '' : String(taskId || '').trim();
                const task = id ? getTaskById(id) : null;
                if (!id || !task) {
                    selectionToolbar.hidden = true;
                    selectionToolbar.style.visibility = 'hidden';
                    selectionToolbar.dataset.tmTaskId = '';
                    selectionToolbar.dataset.tmMilestone = '';
                    return;
                }
                selectionToolbar.dataset.tmTaskId = id;
                const detailButton = selectionToolbar.querySelector('[data-tm-gantt-selection-action="detail"]');
                if (detailButton instanceof HTMLButtonElement) detailButton.disabled = typeof window.tmOpenTaskDetail !== 'function';
                const milestoneButton = selectionToolbar.querySelector('[data-tm-gantt-selection-action="milestone"]');
                const isMilestone = typeof milestoneOverride === 'boolean'
                    ? milestoneOverride
                    : isTimelineTaskMilestone(task, id);
                selectionToolbar.dataset.tmMilestone = isMilestone ? '1' : '0';
                if (milestoneButton instanceof HTMLButtonElement) {
                    const label = isMilestone ? '还原普通时间轴' : '转为里程碑';
                    milestoneButton.classList.toggle('tm-timeline-selection-toolbar__btn--active', isMilestone);
                    milestoneButton.setAttribute('aria-pressed', isMilestone ? 'true' : 'false');
                    milestoneButton.setAttribute('aria-label', label);
                    milestoneButton.setAttribute('title', label);
                    milestoneButton.dataset.tmFloatingTooltipLabel = label;
                    milestoneButton.disabled = !onUpdateTaskMeta;
                }
                const clearButton = selectionToolbar.querySelector('[data-tm-gantt-selection-action="clear"]');
                if (clearButton instanceof HTMLButtonElement) clearButton.disabled = !onUpdateTaskDates;
                selectionToolbar.hidden = false;
                selectionToolbar.style.visibility = 'hidden';
                positionTimelineSelectionToolbar();
            };

            const clearTimelineTaskSelection = () => {
                state.timelineDotPinnedTaskId = '';
                try { bodyEl.querySelectorAll('.tm-gantt-row--dot-open,.tm-gantt-row--selected').forEach(el => { el.classList.remove('tm-gantt-row--dot-open'); el.classList.remove('tm-gantt-row--selected'); }); } catch (e2) {}
                syncTimelineSelectionToolbar('');
            };

            const findTimelineBarAtPointer = (event) => {
                const x = Number(event?.clientX);
                const y = Number(event?.clientY);
                if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
                try {
                    const elements = typeof document.elementsFromPoint === 'function'
                        ? document.elementsFromPoint(x, y)
                        : [];
                    for (const element of elements) {
                        const bar = element?.closest?.('.tm-gantt-bar');
                        if (bar instanceof HTMLElement && bodyEl.contains(bar)) return bar;
                    }
                } catch (e) {}
                const target = event?.target instanceof Element ? event.target : null;
                const row = target?.closest?.('.tm-gantt-row');
                if (!(row instanceof HTMLElement) || !bodyEl.contains(row)) return null;
                const containsPoint = (element) => {
                    if (!(element instanceof Element)) return false;
                    const rect = element.getBoundingClientRect();
                    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
                };
                for (const bar of row.querySelectorAll('.tm-gantt-bar')) {
                    const surface = bar.querySelector('.tm-gantt-bar__surface');
                    const label = bar.querySelector('.tm-gantt-bar__label-layer');
                    if (containsPoint(surface) || containsPoint(label)) return bar;
                }
                return null;
            };

            const onTimelineSelectionOutsidePointerDown = (e) => {
                const target = e?.target;
                if (!(target instanceof Element) || selectionToolbar.contains(target)) return;
                const timelineSurface = target.closest('.tm-gantt-bar, .tm-gantt-milestone, .tm-task-link-dot');
                if (timelineSurface instanceof Element && bodyEl.contains(timelineSurface)) return;
                if (!selectionToolbar.hidden || String(state.timelineDotPinnedTaskId || '').trim()) {
                    clearTimelineTaskSelection();
                }
            };

            const onTimelineSelectionToolbarClick = async (e) => {
                const button = e?.target?.closest?.('[data-tm-gantt-selection-action]');
                if (!(button instanceof HTMLButtonElement) || button.disabled || button.dataset.tmBusy === '1') return;
                const taskId = String(selectionToolbar?.dataset?.tmTaskId || '').trim();
                const task = taskId ? getTaskById(taskId) : null;
                if (!taskId || !task) return;
                try { e.preventDefault(); } catch (e2) {}
                try { e.stopPropagation(); } catch (e2) {}
                button.dataset.tmBusy = '1';
                button.disabled = true;
                const action = String(button.dataset.tmGanttSelectionAction || '').trim();
                try {
                    if (action === 'detail') {
                        clearTimelineTaskSelection();
                        await window.tmOpenTaskDetail?.(taskId, null, { source: 'timeline-selection-toolbar' });
                        return;
                    }
                    if (action === 'milestone' && onUpdateTaskMeta) {
                        const currentMilestone = selectionToolbar.dataset.tmMilestone === '1'
                            ? true
                            : selectionToolbar.dataset.tmMilestone === '0'
                                ? false
                                : isTimelineTaskMilestone(task, taskId);
                        const nextMilestone = !currentMilestone;
                        if (nextMilestone && !String(task?.completionTime || '').trim()) {
                            hint('⚠️ 请先设置截止日期后再设为里程碑', 'error');
                            return;
                        }
                        await onUpdateTaskMeta(taskId, { milestone: nextMilestone });
                        try { hint(nextMilestone ? '✅ 已设为里程碑' : '✅ 已还原普通时间轴', 'success'); } catch (e2) {}
                        syncTimelineSelectionToolbar(taskId, nextMilestone);
                        return;
                    }
                    if (action === 'clear' && onUpdateTaskDates) {
                        await onUpdateTaskDates(taskId, { startDate: '', completionTime: '' });
                        clearTimelineTaskSelection();
                        try { hint('✅ 已清除时间轴', 'success'); } catch (e2) {}
                    }
                } catch (error) {
                    if (!error?.__tmGanttUpdateHinted) {
                        try { hint(`❌ 操作失败: ${error?.message || String(error)}`, 'error'); } catch (e2) {}
                    }
                } finally {
                    button.dataset.tmBusy = '';
                    if (button.isConnected && !selectionToolbar.hidden) button.disabled = false;
                }
            };
            selectionToolbar.addEventListener('click', onTimelineSelectionToolbarClick);
            globalThis.__tmRuntimeEvents?.on?.(document, 'pointerdown', onTimelineSelectionOutsidePointerDown, true);
            const selectionToolbarScrollHost = bodyEl.closest('.tm-timeline-scroll-host, .tm-body.tm-body--timeline');
            globalThis.__tmRuntimeEvents?.on?.(bodyEl, 'scroll', scheduleTimelineSelectionToolbarPosition, { passive: true });
            if (selectionToolbarScrollHost && selectionToolbarScrollHost !== bodyEl) {
                globalThis.__tmRuntimeEvents?.on?.(selectionToolbarScrollHost, 'scroll', scheduleTimelineSelectionToolbarPosition, { passive: true });
            }
            globalThis.__tmRuntimeEvents?.on?.(window, 'resize', scheduleTimelineSelectionToolbarPosition, { passive: true });
            syncTimelineSelectionToolbar();

            const setTimelineDraggingX = (on) => {
                try { bodyEl.classList.toggle('tm-gantt-body--dragging-x', !!on); } catch (e) {}
                if (selectionToolbar instanceof HTMLElement) {
                    if (on) selectionToolbar.style.visibility = 'hidden';
                    else scheduleTimelineSelectionToolbarPosition();
                }
            };

            const openGanttTaskContextMenu = (taskId, anchor) => {
                if (!onUpdateTaskDates && !onUpdateTaskMeta) return;
                const taskIdText = String(taskId || '').trim();
                if (!taskIdText) return;
                const rowEl = bodyEl.querySelector(`.tm-gantt-row[data-id="${CSS.escape(taskIdText)}"]`);
                if (!(rowEl instanceof Element) || rowEl.classList.contains('tm-gantt-row--group')) return;
                const task = getTaskById(taskIdText);
                if (!task) return;
                const isMilestone = isTimelineTaskMilestone(task, taskIdText);
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
                    item.onclick = async (ev) => {
                        ev.stopPropagation();
                        if (item.dataset.tmBusy === '1') return;
                        item.dataset.tmBusy = '1';
                        item.style.pointerEvents = 'none';
                        menu.remove();
                        await onClick?.();
                    };
                    return item;
                };

                if (typeof window.tmOpenTaskDetail === 'function') {
                    menu.appendChild(createItem(__tmRenderContextMenuLabel('file-text', '打开任务详情'), async () => {
                        try {
                            await window.tmOpenTaskDetail(String(taskIdText), null, { source: 'timeline-context-menu' });
                        } catch (e2) {
                            try { hint(`❌ 打开失败: ${e2?.message || String(e2)}`, 'error'); } catch (e3) {}
                        }
                    }));
                }

                menu.appendChild(createItem(__tmRenderContextMenuLabel('trash-2', '清除时间轴（清空起止）'), async () => {
                    try {
                        await onUpdateTaskDates(String(taskIdText), { startDate: '', completionTime: '' });
                        try { hint('✅ 已清除时间轴', 'success'); } catch (e3) {}
                    } catch (e2) {
                        if (!e2?.__tmGanttUpdateHinted) {
                            try { hint(`❌ 清除失败: ${e2?.message || String(e2)}`, 'error'); } catch (e3) {}
                        }
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
                const target = e.target;
                if (!(target instanceof Element)) return;
                if (target.closest('.tm-task-link-dot')) return;
                if (target.closest('.tm-gantt-bar__menu-btn')) return;
                const handleEl = target.closest('.tm-gantt-bar-handle');
                const directBarEl = target.closest('.tm-gantt-bar');
                const barEl = directBarEl || findTimelineBarAtPointer(e);
                if (!barEl) return;
                const rowEl = barEl.closest('.tm-gantt-row');
                const entityKind = String(rowEl?.dataset?.tmEntityKind || '').trim();
                const isGroupEntity = entityKind === 'doc' || entityKind === 'heading';
                const entityId = String(isGroupEntity ? rowEl?.dataset?.entityId : rowEl?.getAttribute?.('data-id') || '').trim();
                const updateEntityDates = isGroupEntity
                    ? (onUpdateGroupDates ? (id, patch) => onUpdateGroupDates(entityKind, id, patch) : null)
                    : onUpdateTaskDates;
                if (!entityId || !updateEntityDates) return;
                const pointerType = String(e?.pointerType || '').trim().toLowerCase();
                const compactEntity = isGroupEntity ? isCompactTimelineGlobal : isMobileTimelineGlobal;
                const useMobileLongPressMove = !!(compactEntity && !handleEl && pointerType === 'touch');
                if (isMobileTimelineGlobal && !handleEl && !useMobileLongPressMove) return;
                const taskId = entityId;
                if (!isGroupEntity && isMobileTimelineGlobal && handleEl
                    && !rowEl.classList.contains('tm-gantt-row--selected')
                    && !rowEl.classList.contains('tm-gantt-row--dot-open')) return;

                const handleType = handleEl?.getAttribute?.('data-handle');
                const action = handleType === 'start' ? 'start' : handleType === 'end' ? 'end' : 'move';
                const withMultiModifier = !isGroupEntity && (action === 'move') && !!(e?.ctrlKey || e?.metaKey) && Number(e?.button) === 0;

                const startTsStr = String(bodyEl.dataset?.tmGanttStartTs || '');
                const dayWidthStr = String(bodyEl.dataset?.tmGanttDayWidth || '');
                const dayCountStr = String(bodyEl.dataset?.tmGanttDayCount || '');
                const snapDaysStr = String(bodyEl.dataset?.tmGanttSnapDays || '');
                const startTs0 = Number(startTsStr);
                const dayWidth0 = Number(dayWidthStr);
                const dayCount0 = Number(dayCountStr);
                const snapDays0 = Math.max(1, Math.round(Number(snapDaysStr) || 1));
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
                    syncTimelineSelectionToolbar('');
                    try { e.preventDefault(); } catch (e3) {}
                    try { e.stopPropagation(); } catch (e3) {}
                    return;
                }

                const activeTask = isGroupEntity
                    ? rowModel.find((row) => __tmGetTimelineGroupEntity(row)?.entityId === entityId)
                    : getTaskById(taskId);
                if (!activeTask) return;
                const groupTimelineState = isGroupEntity ? String(rowEl?.dataset?.timelineState || activeTask?.timelineRange?.state || '') : '';
                const startX = e.clientX;
                const startY = e.clientY;
                const pointerIdValue = Number(e?.pointerId);
                const activePointerId = Number.isFinite(pointerIdValue) ? pointerIdValue : null;
                const pendingScrollHost = useMobileLongPressMove
                    ? (mobileTimelineModalEl?.querySelector?.('.tm-timeline-scroll-host')
                        || mobileTimelineModalEl?.querySelector?.('.tm-body.tm-body--timeline'))
                    : null;
                const initialPendingScrollLeft = pendingScrollHost instanceof HTMLElement ? pendingScrollHost.scrollLeft : 0;
                const initialLeftPx = Number.parseFloat(String(barEl.style.left || '').replace('px', '')) || 0;
                const initialWidthPx = Number.parseFloat(String(barEl.style.width || '').replace('px', '')) || dayWidth0;
                const initialStartIdx = clamp(Math.round(initialLeftPx / dayWidth0), 0, dayCount0 - 1);
                const initialLen = Math.max(1, Math.round(initialWidthPx / dayWidth0));
                const initialEndIdx = clamp(initialStartIdx + initialLen - 1, 0, dayCount0 - 1);
                const initialVisibleLen = initialEndIdx - initialStartIdx + 1;
                const minimumResizeDays = Math.min(
                    initialVisibleLen,
                    Math.max(1, Math.ceil(TIMELINE_MIN_RESIZE_WIDTH_PX / dayWidth0))
                );

                let lastStartIdx = initialStartIdx;
                let lastEndIdx = initialEndIdx;
                let lastPointerX = startX;
                let lastPointerY = startY;
                let raf = 0;
                let dragging = true;
                let dragActive = false;
                let longPressReady = !useMobileLongPressMove;
                let longPressTimer = 0;
                let pendingHorizontalScroll = false;
                let renderedDependencyDeltaDays = null;
                const dragThreshold = action === 'move' ? 6 : 3;
                const samePointer = (ev) => {
                    if (activePointerId == null) return true;
                    const pointerId = Number(ev?.pointerId);
                    return !Number.isFinite(pointerId) || pointerId === activePointerId;
                };
                const clearLongPressTimer = () => {
                    if (!longPressTimer) return;
                    try { clearTimeout(longPressTimer); } catch (e2) {}
                    longPressTimer = 0;
                };
                const syncDraggedDependencies = (deltaDays) => {
                    if (isGroupEntity) return;
                    if (renderedDependencyDeltaDays === deltaDays) return;
                    renderedDependencyDeltaDays = deltaDays;
                    renderDependencies();
                };
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
                    const layout = {
                        left: leftPx,
                        width: widthPx,
                        dayWidth: dayWidth0,
                        startTs: startTs0 + sIdx * DAY_MS,
                        endTs: startTs0 + eIdx * DAY_MS,
                        isDark,
                    };
                    if (isGroupEntity) {
                        applyTimelineGroupBarElement(targetBar, taskObj, layout);
                    } else {
                        globalThis.__TaskHorizonGanttView?.applyTimelineTaskBarElement?.(targetBar, taskObj, layout);
                    }
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
                const groupMove = !isGroupEntity && (action === 'move') && selectedSet.size > 1 && selectedSet.has(taskId);
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
                    const deltaDays = Math.round((dx / dayWidth0) / snapDays0) * snapDays0;
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
                            syncTimelineTaskLinkDots(it.barEl);
                        });
                        syncDraggedDependencies(deltaDays);
                        scheduleTimelineOffscreenNavRefresh();
                        return;
                    }
                    if (action === 'start') {
                        const nextStart = Math.min(
                            initialStartIdx + deltaDays,
                            initialEndIdx - minimumResizeDays + 1
                        );
                        applyBar(nextStart, initialEndIdx);
                    } else if (action === 'end') {
                        const nextEnd = Math.max(
                            initialEndIdx + deltaDays,
                            initialStartIdx + minimumResizeDays - 1
                        );
                        applyBar(initialStartIdx, nextEnd);
                    } else {
                        const len = Math.max(1, initialEndIdx - initialStartIdx + 1);
                        let nextStart = initialStartIdx + deltaDays;
                        let nextEnd = nextStart + len - 1;
                        if (nextStart < 0) { nextStart = 0; nextEnd = len - 1; }
                        if (nextEnd > dayCount0 - 1) { nextEnd = dayCount0 - 1; nextStart = nextEnd - len + 1; }
                        applyBar(nextStart, nextEnd);
                    }
                    syncDraggedDependencies(deltaDays);
                    scheduleTimelineOffscreenNavRefresh();
                };

                const unbindWindowDragEvents = () => {
                    try { globalThis.__tmRuntimeEvents?.off?.(window, 'pointermove', onWinPointerMove, true); } catch (e) {}
                    try { globalThis.__tmRuntimeEvents?.off?.(window, 'pointerup', onUp, true); } catch (e) {}
                    try { globalThis.__tmRuntimeEvents?.off?.(window, 'pointercancel', onUp, true); } catch (e) {}
                    try { globalThis.__tmRuntimeEvents?.off?.(window, 'blur', onUp, true); } catch (e) {}
                };
                const releaseActivePointerCapture = () => {
                    if (activePointerId == null) return;
                    try {
                        if (barEl.hasPointerCapture?.(activePointerId)) barEl.releasePointerCapture?.(activePointerId);
                    } catch (e) {}
                };

                const onWinPointerMove = (ev) => {
                    if (!dragging) return;
                    if (!samePointer(ev)) return;
                    if (Number.isFinite(Number(ev?.clientX))) lastPointerX = Number(ev.clientX);
                    if (Number.isFinite(Number(ev?.clientY))) lastPointerY = Number(ev.clientY);
                    if (!longPressReady) {
                        const pendingDx = lastPointerX - startX;
                        const pendingDy = lastPointerY - startY;
                        if (pendingHorizontalScroll) {
                            try { ev.preventDefault(); } catch (e) {}
                            if (pendingScrollHost instanceof HTMLElement) {
                                pendingScrollHost.scrollLeft = initialPendingScrollLeft - pendingDx;
                            }
                            return;
                        }
                        if ((pendingDx * pendingDx + pendingDy * pendingDy) > 16) {
                            clearLongPressTimer();
                            if (pendingScrollHost instanceof HTMLElement && Math.abs(pendingDx) > Math.abs(pendingDy)) {
                                pendingHorizontalScroll = true;
                                try { ev.preventDefault(); } catch (e) {}
                                pendingScrollHost.scrollLeft = initialPendingScrollLeft - pendingDx;
                            } else {
                                dragging = false;
                                unbindWindowDragEvents();
                                releaseActivePointerCapture();
                            }
                        }
                        return;
                    }
                    if (raf) return;
                    try { ev.preventDefault(); } catch (e) {}
                    raf = requestAnimationFrame(() => {
                        raf = 0;
                        const dx = lastPointerX - startX;
                        if (!dragActive && Math.abs(dx) < dragThreshold) return;
                        activateDrag();
                        onMove({ clientX: lastPointerX });
                        updateBarDateHint();
                    });
                };

                const onUp = async (ev) => {
                    if (!dragging) return;
                    if (!samePointer(ev)) return;
                    const pointerCanceled = ev?.type === 'pointercancel';
                    if (!pointerCanceled && Number.isFinite(Number(ev?.clientX))) lastPointerX = Number(ev.clientX);
                    if (!pointerCanceled && Number.isFinite(Number(ev?.clientY))) lastPointerY = Number(ev.clientY);
                    clearLongPressTimer();
                    if (raf) {
                        cancelAnimationFrame(raf);
                        raf = 0;
                    }
                    const finalDx = lastPointerX - startX;
                    if (!pointerCanceled && longPressReady && !dragActive && Math.abs(finalDx) >= dragThreshold) activateDrag();
                    if (!pointerCanceled && dragActive) onMove({ clientX: lastPointerX });
                    dragging = false;
                    unbindWindowDragEvents();
                    releaseActivePointerCapture();
                    if (!dragActive) {
                        if (pendingHorizontalScroll) {
                            try { barEl.dataset.tmSuppressClickUntil = String(Date.now() + 700); } catch (e2) {}
                        }
                        return;
                    }
                    setTimelineDraggingX(false);
                    setMobileTimelineTouchLock(false);
                    setBarDragState(barEl, false);
                    clearBarDateHint();
                    groupItems.forEach((it) => setBarDragState(it.barEl, false));
                    if (useMobileLongPressMove || isGroupEntity) {
                        try { barEl.dataset.tmSuppressClickUntil = String(Date.now() + 700); } catch (e2) {}
                    }

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
                        if (isGroupEntity) {
                            const groupPatch = groupTimelineState === 'start'
                                ? { startDate }
                                : groupTimelineState === 'deadline'
                                    ? { deadline: completionTime }
                                    : action === 'start'
                                        ? { startDate }
                                        : action === 'end'
                                            ? { deadline: completionTime }
                                            : { startDate, deadline: completionTime };
                            await updateEntityDates(entityId, groupPatch);
                        } else {
                            await updateEntityDates(String(taskId), { startDate, completionTime });
                        }
                    } catch (e2) {}
                };

                if (useMobileLongPressMove) {
                    longPressTimer = setTimeout(() => {
                        longPressTimer = 0;
                        if (!dragging) return;
                        longPressReady = true;
                        if (activePointerId != null) {
                            try { barEl.setPointerCapture?.(activePointerId); } catch (e2) {}
                        }
                        activateDrag();
                        updateBarDateHint();
                    }, 500);
                } else {
                    try { barEl.setPointerCapture?.(e.pointerId); } catch (e2) {}
                }

                globalThis.__tmRuntimeEvents?.on?.(window, 'pointermove', onWinPointerMove, true);
                globalThis.__tmRuntimeEvents?.on?.(window, 'pointerup', onUp, true);
                globalThis.__tmRuntimeEvents?.on?.(window, 'pointercancel', onUp, true);
                globalThis.__tmRuntimeEvents?.on?.(window, 'blur', onUp, true);

                if (!useMobileLongPressMove) {
                    try { e.preventDefault(); } catch (e3) {}
                    try { e.stopPropagation(); } catch (e3) {}
                }
            };

            const onPanPointerDown = (e) => {
                const target = e.target;
                if (!(target instanceof Element)) return;
                if (e && typeof e.button === 'number' && e.button !== 0) return;
                if (target.closest('.tm-task-link-dot')) return;
                if (target.closest('.tm-gantt-bar__menu-btn')) return;
                if (target.closest('[data-tm-gantt-offscreen-nav]')) return;
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
                if (target.closest('[data-tm-gantt-offscreen-nav]')) return;
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
                const pointTs = startTs0 + dayIdx * DAY_MS;
                const scale = String(bodyEl.dataset?.tmGanttScale || 'day').trim();
                const range = resolveTimelineScaleDateRange(pointTs, scale);
                if (!range) return;
                const startDate = formatDateOnlyFromTs(range.startTs);
                const completionTime = formatDateOnlyFromTs(range.endTs);
                if (!startDate || !completionTime) return;

                try {
                    await onUpdateTaskDates(String(taskId), { startDate, completionTime });
                    const dateLabel = startDate === completionTime ? completionTime : `${startDate} - ${completionTime}`;
                    try { hint(`✅ 任务日期：${dateLabel}`, 'success'); } catch (e3) {}
                } catch (e2) {}
            };

            const onContextMenu = (e) => {
                const target = e.target;
                if (!(target instanceof Element)) return;
                if (target.closest('.tm-task-link-dot')) return;
                if (target.closest('[data-tm-gantt-offscreen-nav]')) return;
                if (isMobileTimelineGlobal) {
                    if (target.closest('.tm-gantt-row, .tm-gantt-bar, .tm-gantt-bar-handle, .tm-gantt-milestone')) {
                        try { e.preventDefault(); } catch (e2) {}
                        try { e.stopPropagation(); } catch (e2) {}
                    }
                    return;
                }
                const rowEl = target.closest('.tm-gantt-row');
                const groupKind = String(rowEl?.dataset?.tmEntityKind || '').trim();
                const groupId = String(rowEl?.dataset?.entityId || '').trim();
                if (groupKind === 'doc') {
                    if (!groupId) return;
                    try { e.preventDefault(); } catch (e2) {}
                    try { e.stopPropagation(); } catch (e2) {}
                    try { globalThis.tmShowDocTabContextMenu?.(e, groupId); } catch (e2) {}
                    return;
                }
                if (groupKind === 'heading' && groupId) {
                    try { e.preventDefault(); } catch (e2) {}
                    try { e.stopPropagation(); } catch (e2) {}
                    try { globalThis.tmOpenTimelineGroupRangeEditor?.(e, groupKind, groupId, rowEl?.dataset?.headingLevel || ''); } catch (e2) {}
                    return;
                }
                const taskId = rowEl?.getAttribute?.('data-id');
                if (!taskId) return;
                try { e.preventDefault(); } catch (e2) {}
                try { e.stopPropagation(); } catch (e2) {}
                openGanttTaskContextMenu(taskId, { x: e.clientX, y: e.clientY });
            };

            const onClick = (e) => {
                const target = e.target;
                if (!(target instanceof Element)) return;
                const offscreenNav = target.closest('[data-tm-gantt-offscreen-nav]');
                if (offscreenNav instanceof HTMLButtonElement) {
                    const rowEl0 = offscreenNav.closest('.tm-gantt-row');
                    const groupKind0 = String(rowEl0?.dataset?.tmEntityKind || '').trim();
                    const groupId0 = String(rowEl0?.dataset?.entityId || '').trim();
                    const taskId0 = String(rowEl0?.getAttribute?.('data-id') || '').trim();
                    if (groupId0 || taskId0) {
                        try { e.preventDefault(); } catch (e2) {}
                        try { e.stopPropagation(); } catch (e2) {}
                        try {
                            if (groupId0) globalThis.tmGanttFocusGroup?.(groupKind0, groupId0);
                            else globalThis.tmGanttFocusTask?.(taskId0);
                        } catch (e2) {}
                    }
                    return;
                }
                const suppressedBar = target.closest('.tm-gantt-bar[data-tm-suppress-click-until]');
                const suppressClickUntil = Number(suppressedBar?.dataset?.tmSuppressClickUntil || 0);
                if (suppressClickUntil > Date.now()) {
                    try { delete suppressedBar.dataset.tmSuppressClickUntil; } catch (e2) {}
                    try { e.preventDefault(); } catch (e2) {}
                    try { e.stopPropagation(); } catch (e2) {}
                    return;
                }
                const groupRangeTrigger = target.closest('[data-tm-group-range-trigger]');
                if (groupRangeTrigger instanceof Element) {
                    const rowEl0 = groupRangeTrigger.closest('.tm-gantt-row[data-entity-id]');
                    const groupKind0 = String(rowEl0?.dataset?.tmEntityKind || '').trim();
                    const groupId0 = String(rowEl0?.dataset?.entityId || '').trim();
                    if (groupId0) {
                        try { e.preventDefault(); } catch (e2) {}
                        try { e.stopPropagation(); } catch (e2) {}
                        try { globalThis.tmOpenTimelineGroupRangeEditor?.(e, groupKind0, groupId0, rowEl0?.dataset?.headingLevel || ''); } catch (e2) {}
                    }
                    return;
                }
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
                        clearTimelineTaskSelection();
                    }
                    return;
                }
                const taskId = String(rowEl.getAttribute('data-id') || '').trim();
                if (!taskId) return;
                if (target.closest('.tm-gantt-bar-handle')) return;
                const isBarClick = !!target.closest('.tm-gantt-bar, .tm-gantt-milestone');
                if (!isBarClick) {
                    if (String(state.timelineDotPinnedTaskId || '').trim()) {
                        clearTimelineTaskSelection();
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
                        syncTimelineSelectionToolbar('');
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
                    syncTimelineSelectionToolbar('');
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
                syncTimelineSelectionToolbar(next);
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
                try { globalThis.__tmRuntimeEvents?.off?.(document, 'pointerdown', onTimelineSelectionOutsidePointerDown, true); } catch (e) {}
                try { globalThis.__tmRuntimeEvents?.off?.(timelineScrollHost, 'scroll', scheduleTimelineOffscreenNavRefresh, { passive: true }); } catch (e) {}
                try { globalThis.__tmRuntimeEvents?.off?.(window, 'resize', scheduleTimelineOffscreenNavRefresh, { passive: true }); } catch (e) {}
                try { globalThis.__tmRuntimeEvents?.off?.(bodyEl, 'scroll', scheduleTimelineSelectionToolbarPosition, { passive: true }); } catch (e) {}
                try { globalThis.__tmRuntimeEvents?.off?.(selectionToolbarScrollHost, 'scroll', scheduleTimelineSelectionToolbarPosition, { passive: true }); } catch (e) {}
                try { globalThis.__tmRuntimeEvents?.off?.(window, 'resize', scheduleTimelineSelectionToolbarPosition, { passive: true }); } catch (e) {}
                try { selectionToolbar.removeEventListener('click', onTimelineSelectionToolbarClick); } catch (e) {}
                try { selectionToolbar.remove(); } catch (e) {}
                if (selectionToolbarPositionRaf) {
                    try { cancelAnimationFrame(selectionToolbarPositionRaf); } catch (e) {}
                    selectionToolbarPositionRaf = 0;
                }
                if (timelineOffscreenNavRaf) {
                    try { cancelAnimationFrame(timelineOffscreenNavRaf); } catch (e) {}
                    timelineOffscreenNavRaf = 0;
                }
                try { setMobileTimelineTouchLock(false); } catch (e) {}
                if (state.__tmTimelineRenderDeps === renderDependencies) state.__tmTimelineRenderDeps = null;
                if (state.__tmTimelineRefreshOffscreenNav === scheduleTimelineOffscreenNavRefresh) state.__tmTimelineRefreshOffscreenNav = null;
            });
        }

        globalThis.__TaskHorizonGanttView = {
            render: renderGantt,
            resolveScaleState: resolveTimelineScaleState,
            setScale: setTimelineScale,
            stepZoom: stepTimelineZoom,
            fitScale: fitTimelineScale,
            computeRangeTs: computeAutoRangeTs,
            collectRangeItems: collectTimelineRangeItems,
            setRange: setTimelineRange,
            centerRangeOnDate: centerTimelineRangeOnDate,
            shiftRange: shiftTimelineRange,
            parseDateOnlyToTs,
            formatDateOnlyFromTs,
            formatTimelineHintDate,
            startOfDayTs,
            extendTimelineEndTs,
            DAY_MS,
            TIMELINE_MAX_DAY_COUNT,
            resolveTimelineBarLayout,
            resolveTimelineMilestoneLayout,
            buildTimelineTaskBarHtml,
            buildTimelineGroupBarHtml,
            buildTimelineMilestoneHtml,
            applyTimelineTaskBarElement,
            applyTimelineGroupBarElement,
        };
    })();

    if (document.readyState === 'loading') {
        __tmDomReadyHandler = init;
        globalThis.__tmRuntimeEvents?.on?.(document, 'DOMContentLoaded', __tmDomReadyHandler);
    } else {
        init();
    }
})();
