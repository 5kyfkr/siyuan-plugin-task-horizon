    function __tmFormatDate(value) {
        if (!value) return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        return d.toLocaleDateString();
    }

    const __tmTaskTimeFormatCache = new Map();

    function __tmFormatTaskTime(value) {
        const s = String(value || '').trim();
        if (!s) return '';
        if (__tmTaskTimeFormatCache.has(s)) return __tmTaskTimeFormatCache.get(s) || '';
        let out = s;
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) out = s;
        else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) out = s.slice(0, 10);
        else if (/^\d{14}$/.test(s)) out = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
        else if (/^\d{8}$/.test(s)) out = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
        else if (/^\d+$/.test(s)) {
            const n = Number(s);
            if (Number.isFinite(n) && n > 0) {
                const ts = n < 1e12 ? n * 1000 : n;
                const d0 = new Date(ts);
                if (!Number.isNaN(d0.getTime())) {
                    const pad = (n) => String(n).padStart(2, '0');
                    out = `${d0.getFullYear()}-${pad(d0.getMonth() + 1)}-${pad(d0.getDate())}`;
                }
            }
        } else {
            const d = new Date(s);
            if (!Number.isNaN(d.getTime())) {
                const pad = (n) => String(n).padStart(2, '0');
                out = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            }
        }
        return __tmRememberSmallCache(__tmTaskTimeFormatCache, s, out, 1600);
    }

    function __tmFormatTaskTimeCompact(value) {
        const full = __tmFormatTaskTime(value);
        if (/^\d{4}-\d{2}-\d{2}$/.test(full)) return full.slice(5);
        return full;
    }

    const __TM_TASK_CARD_FIELD_OPTIONS = [
        { key: 'priority', label: '重要性' },
        { key: 'status', label: '状态' },
        { key: 'date', label: '截止日期' },
        { key: 'remark', label: '备注' },
    ];

    function __tmNormalizeTaskCardFieldList(input, fallback = ['priority', 'status', 'date']) {
        const allow = new Set(__TM_TASK_CARD_FIELD_OPTIONS.map((item) => item.key));
        const source = Array.isArray(input) ? input : fallback;
        const seen = new Set();
        const out = [];
        source.forEach((item) => {
            const key = String(item || '').trim();
            if (!allow.has(key) || seen.has(key)) return;
            seen.add(key);
            out.push(key);
        });
        return out;
    }

    function __tmGetTaskCardFieldList(view) {
        const key = String(view || '').trim() === 'whiteboard' ? 'whiteboardCardFields' : 'kanbanCardFields';
        return __tmNormalizeTaskCardFieldList(SettingsStore.data?.[key], ['priority', 'status', 'date']);
    }

    function __tmTaskCardFieldEnabled(view, field) {
        return __tmGetTaskCardFieldList(view).includes(String(field || '').trim());
    }

    function __tmGetTaskCardDateValue(task) {
        return String(task?.completionTime || '').trim() || String(task?.startDate || '').trim();
    }

    function __tmShouldRenderTaskCardDate(task) {
        if (SettingsStore.data?.taskCardDateOnlyWithValue !== true) return true;
        return !!String(task?.completionTime || '').trim();
    }

    function __tmRenderTaskCardRemark(task) {
        const text = String(task?.remark || '').trim();
        if (!text) return '';
        return `<div class="tm-task-card-remark" title="${esc(text)}">${esc(text)}</div>`;
    }

    function __tmGetTableWidthLayout(columnOrder, widthMap, availableWidth = 0) {
        const defaultOrder = __tmGetDefaultColumnOrder();
        const defaultWidths = __tmGetColumnWidthDefaults();
        const order = Array.isArray(columnOrder) ? columnOrder.filter((col) => Object.prototype.hasOwnProperty.call(defaultWidths, col)) : defaultOrder;
        const baseWidths = {};
        let total = 0;
        order.forEach((col) => {
            const raw = Number(widthMap?.[col]);
            const width = Number.isFinite(raw) ? Math.max(10, Math.min(800, Math.round(raw))) : (defaultWidths[col] || 120);
            baseWidths[col] = width;
            total += width;
        });
        const safeTotal = Math.max(1, total);
        const usableWidthRaw = Number(availableWidth);
        const usableWidth = Number.isFinite(usableWidthRaw) ? Math.max(0, Math.round(usableWidthRaw)) : 0;
        const shouldStretch = usableWidth > safeTotal;
        const scale = shouldStretch ? (usableWidth / safeTotal) : 1;
        const widths = {};
        let resolvedTotal = 0;
        order.forEach((col, index) => {
            const base = baseWidths[col] || defaultWidths[col] || 120;
            let width = shouldStretch ? Math.max(base, Math.round(base * scale)) : base;
            if (shouldStretch && index === order.length - 1) {
                width = Math.max(base, usableWidth - resolvedTotal);
            }
            widths[col] = width;
            resolvedTotal += width;
        });
        const finalTableWidth = shouldStretch ? Math.max(usableWidth, resolvedTotal) : safeTotal;
        return {
            order,
            baseWidths,
            widths,
            total: safeTotal,
            resolvedTotal: finalTableWidth,
            shouldStretch,
            tableStyle: `width:${finalTableWidth}px;min-width:${finalTableWidth}px;`,
            cellStyle: (col, extra = '') => {
                const width = widths[col] || defaultWidths[col] || 120;
                return `width:${width}px; min-width:${width}px; max-width:${width}px;${extra ? ` ${extra}` : ''}`;
            },
        };
    }

    function __tmGetTaskSpentMinutes(task) {
        if (!SettingsStore.data.enableTomatoIntegration) return null;
        const mode = String(SettingsStore.data.tomatoSpentAttrMode || 'minutes').trim() || 'minutes';
        if (mode === 'hours') return null;
        const m = __tmParseNumber(task?.tomatoMinutes);
        if (!Number.isFinite(m) || m <= 0) return null;
        return Math.round(m);
    }

    function __tmFormatSpentHours(hours) {
        const n = Number(hours);
        if (!Number.isFinite(n) || n <= 0) return '';
        const rounded = Math.round(n * 100) / 100;
        return String(rounded);
    }

    function __tmFormatSpentMinutes(minutes) {
        const n = Number(minutes);
        if (!Number.isFinite(n) || n <= 0) return '';
        const total = Math.round(n);
        const h = Math.floor(total / 60);
        const m = total % 60;
        if (h > 0 && m > 0) return `${h}h${m}m`;
        if (h > 0) return `${h}h`;
        return `${m}m`;
    }

    function __tmGetTaskSpentDisplay(task) {
        try {
            if (!SettingsStore.data.enableTomatoIntegration) return '';
            const useHours = String(SettingsStore.data.tomatoSpentAttrMode || 'minutes').trim() === 'hours';
            if (useHours) return String(__tmFormatSpentHours(__tmParseNumber(task?.tomatoHours)) || '').trim();
            return String(__tmFormatSpentMinutes(__tmGetTaskSpentMinutes(task)) || '').trim();
        } catch (e) {
            return '';
        }
    }

    function __tmNormalizeDateOnly(value) {
        const s = String(value || '').trim();
        if (!s) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}\s/.test(s)) return s.slice(0, 10);
        const d = new Date(s);
        if (Number.isNaN(d.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    function __tmParseTaskRepeatJson(value) {
        if (!value) return null;
        if (typeof value === 'string') {
            const raw = String(value || '').trim();
            if (!raw) return null;
            try { return JSON.parse(raw); } catch (e) { return null; }
        }
        return (typeof value === 'object' && !Array.isArray(value)) ? value : null;
    }

    function __tmNormalizeTaskRepeatTrigger(value) {
        return String(value || '').trim().toLowerCase() === 'complete' ? 'complete' : 'due';
    }

    function __tmNormalizeTaskRepeatType(value) {
        const raw = String(value || '').trim().toLowerCase();
        if (!raw || raw === 'none' || raw === 'once') return 'none';
        if (raw === 'weekday' || raw === 'weekdays') return 'workday';
        if (raw === 'everyday') return 'daily';
        if (raw === 'daily' || raw === 'workday' || raw === 'weekly' || raw === 'monthly' || raw === 'yearly') return raw;
        return 'none';
    }

    function __tmNormalizeTaskRepeatEvery(value, repeatType) {
        if (__tmNormalizeTaskRepeatType(repeatType) === 'none') return 1;
        const n = parseInt(value, 10);
        if (!Number.isFinite(n) || n <= 0) return 1;
        return Math.min(3650, Math.max(1, n));
    }

    function __tmNormalizeTaskRepeatMonthlyMode(value, repeatType) {
        if (__tmNormalizeTaskRepeatType(repeatType) !== 'monthly') return 'date';
        return String(value || '').trim().toLowerCase() === 'weekday' ? 'weekday' : 'date';
    }

    function __tmNormalizeTaskRepeatUntil(value) {
        return __tmNormalizeDateOnly(value);
    }

    function __tmNormalizeTaskRepeatState(value) {
        const raw = __tmParseTaskRepeatJson(value) || {};
        return {
            version: 1,
            lastCompletedAt: String(raw.lastCompletedAt || '').trim(),
            lastAdvancedAt: String(raw.lastAdvancedAt || '').trim(),
            lastInstanceStart: __tmNormalizeDateOnly(raw.lastInstanceStart || ''),
            lastInstanceDue: __tmNormalizeDateOnly(raw.lastInstanceDue || ''),
        };
    }

    function __tmNormalizeTaskRepeatHistory(value) {
        const raw = (() => {
            if (Array.isArray(value)) return value;
            if (typeof value === 'string') {
                const text = String(value || '').trim();
                if (!text) return [];
                try {
                    const parsed = JSON.parse(text);
                    return Array.isArray(parsed) ? parsed : [];
                } catch (e) {
                    return [];
                }
            }
            return [];
        })();
        return raw.map((item) => {
            const entry = (item && typeof item === 'object' && !Array.isArray(item)) ? item : {};
            return {
                completedAt: String(entry.completedAt || '').trim(),
                sourceStart: __tmNormalizeDateOnly(entry.sourceStart || ''),
                sourceDue: __tmNormalizeDateOnly(entry.sourceDue || ''),
                nextStart: __tmNormalizeDateOnly(entry.nextStart || ''),
                nextDue: __tmNormalizeDateOnly(entry.nextDue || ''),
                content: String(entry.content || '').trim(),
                docId: String(entry.docId || '').trim(),
                docName: String(entry.docName || '').trim(),
                h2: String(entry.h2 || '').trim(),
                h2Id: String(entry.h2Id || '').trim(),
                h2Path: String(entry.h2Path || '').trim(),
                priority: String(entry.priority || '').trim(),
                customStatus: String(entry.customStatus || '').trim(),
                duration: String(entry.duration || '').trim(),
                remark: String(entry.remark || '').trim(),
                docSeq: Number.isFinite(Number(entry.docSeq)) ? Number(entry.docSeq) : Number.NaN,
            };
        }).filter((item) => item.completedAt || item.sourceStart || item.sourceDue || item.nextStart || item.nextDue)
            .slice(0, 30);
    }

    function __tmNormalizeTaskRepeatRule(value, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const valueText = typeof value === 'string' ? String(value || '').trim() : '';
        if (!value || (typeof value === 'string' && !valueText)) {
            return {
                version: 1,
                enabled: false,
                trigger: __tmNormalizeTaskRepeatTrigger(opts.trigger || ''),
                type: 'none',
                every: 1,
                monthlyMode: 'date',
                until: '',
                anchorDate: __tmNormalizeDateOnly(
                    opts.anchorDate
                    || opts.startDate
                    || opts.completionTime
                    || new Date()
                ),
            };
        }
        const raw = __tmParseTaskRepeatJson(value) || {};
        const type = __tmNormalizeTaskRepeatType(raw.type || raw.repeatType || raw.interval || '');
        const enabledRaw = raw.enabled;
        const enabled = enabledRaw === undefined
            ? (type !== 'none')
            : !!enabledRaw;
        const fallbackAnchor = __tmNormalizeDateOnly(
            opts.anchorDate
            || raw.anchorDate
            || opts.startDate
            || opts.completionTime
            || new Date()
        );
        return {
            version: 1,
            enabled: enabled && type !== 'none',
            trigger: __tmNormalizeTaskRepeatTrigger(raw.trigger || opts.trigger || ''),
            type: enabled ? type : 'none',
            every: __tmNormalizeTaskRepeatEvery(raw.every, type),
            monthlyMode: __tmNormalizeTaskRepeatMonthlyMode(raw.monthlyMode, type),
            until: enabled ? __tmNormalizeTaskRepeatUntil(raw.until || raw.repeatUntil || '') : '',
            anchorDate: fallbackAnchor,
        };
    }

    function __tmFormatDateKeyFromDate(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    function __tmBuildLocalNoonDateFromKey(value) {
        const key = __tmNormalizeDateOnly(value);
        if (!key) return null;
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
        if (!m) return null;
        const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
        return Number.isNaN(dt.getTime()) ? null : dt;
    }

    function __tmGetTaskRepeatMonthWeekOrdinal(dateLike) {
        const dt = (dateLike instanceof Date) ? dateLike : __tmBuildLocalNoonDateFromKey(dateLike);
        if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return 1;
        return Math.max(1, Math.min(5, Math.floor((dt.getDate() - 1) / 7) + 1));
    }

    function __tmBuildTaskRepeatMonthlyWeekdayDate(baseDate, deltaMonths) {
        const base = (baseDate instanceof Date) ? new Date(baseDate.getTime()) : __tmBuildLocalNoonDateFromKey(baseDate);
        if (!(base instanceof Date) || Number.isNaN(base.getTime())) return null;
        const months = Number(deltaMonths) || 0;
        const total = base.getFullYear() * 12 + base.getMonth() + months;
        const year = Math.floor(total / 12);
        const month = ((total % 12) + 12) % 12;
        const weekday = base.getDay();
        const ordinal = __tmGetTaskRepeatMonthWeekOrdinal(base);
        const firstDay = new Date(year, month, 1, 12, 0, 0, 0);
        const firstWeekday = firstDay.getDay();
        const offset = (weekday - firstWeekday + 7) % 7;
        const day = 1 + offset + (ordinal - 1) * 7;
        const lastDay = new Date(year, month + 1, 0, 12, 0, 0, 0).getDate();
        if (day > lastDay) return null;
        return new Date(year, month, day, 12, 0, 0, 0);
    }

    function __tmBuildTaskRepeatMonthlyDate(baseDate, deltaMonths) {
        const base = (baseDate instanceof Date) ? new Date(baseDate.getTime()) : __tmBuildLocalNoonDateFromKey(baseDate);
        if (!(base instanceof Date) || Number.isNaN(base.getTime())) return null;
        const months = Number(deltaMonths) || 0;
        const total = base.getFullYear() * 12 + base.getMonth() + months;
        const year = Math.floor(total / 12);
        const month = ((total % 12) + 12) % 12;
        const lastDay = new Date(year, month + 1, 0, 12, 0, 0, 0).getDate();
        const day = Math.min(base.getDate(), lastDay);
        return new Date(year, month, day, 12, 0, 0, 0);
    }

    function __tmBuildTaskRepeatYearlyDate(baseDate, deltaYears) {
        const base = (baseDate instanceof Date) ? new Date(baseDate.getTime()) : __tmBuildLocalNoonDateFromKey(baseDate);
        if (!(base instanceof Date) || Number.isNaN(base.getTime())) return null;
        const year = base.getFullYear() + (Number(deltaYears) || 0);
        const month = base.getMonth();
        const lastDay = new Date(year, month + 1, 0, 12, 0, 0, 0).getDate();
        const day = Math.min(base.getDate(), lastDay);
        return new Date(year, month, day, 12, 0, 0, 0);
    }

    function __tmAdvanceTaskRepeatDateKey(dateKey, ruleInput) {
        const key = __tmNormalizeDateOnly(dateKey);
        if (!key) return '';
        const rule = __tmNormalizeTaskRepeatRule(ruleInput, { anchorDate: key });
        if (!rule.enabled || rule.type === 'none') return key;
        const base = __tmBuildLocalNoonDateFromKey(key);
        if (!(base instanceof Date) || Number.isNaN(base.getTime())) return key;
        let next = null;
        if (rule.type === 'daily') {
            next = new Date(base.getTime());
            next.setDate(next.getDate() + rule.every);
        } else if (rule.type === 'workday') {
            next = new Date(base.getTime());
            let remaining = rule.every;
            while (remaining > 0) {
                next.setDate(next.getDate() + 1);
                const weekday = next.getDay();
                if (weekday !== 0 && weekday !== 6) remaining -= 1;
            }
        } else if (rule.type === 'weekly') {
            next = new Date(base.getTime());
            next.setDate(next.getDate() + rule.every * 7);
        } else if (rule.type === 'monthly') {
            next = rule.monthlyMode === 'weekday'
                ? __tmBuildTaskRepeatMonthlyWeekdayDate(base, rule.every)
                : __tmBuildTaskRepeatMonthlyDate(base, rule.every);
        } else if (rule.type === 'yearly') {
            next = __tmBuildTaskRepeatYearlyDate(base, rule.every);
        }
        const nextKey = __tmFormatDateKeyFromDate(next);
        if (!nextKey) return key;
        if (rule.until && nextKey > rule.until) return '';
        return nextKey;
    }

    function __tmBuildTaskRepeatAdvancePatch(taskLike, ruleInput, options = {}) {
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : {};
        const rule = __tmNormalizeTaskRepeatRule(ruleInput, {
            anchorDate: task?.completionTime || task?.startDate || new Date(),
            startDate: task?.startDate,
            completionTime: task?.completionTime,
        });
        if (!rule.enabled || rule.type === 'none') return null;
        const prevStart = __tmNormalizeDateOnly(task?.startDate || '');
        const prevDue = __tmNormalizeDateOnly(task?.completionTime || '');
        const fallbackBase = prevDue || prevStart || rule.anchorDate || __tmNormalizeDateOnly(new Date());
        const nextStart = prevStart ? __tmAdvanceTaskRepeatDateKey(prevStart, rule) : '';
        let nextDue = prevDue ? __tmAdvanceTaskRepeatDateKey(prevDue, rule) : '';
        if (!nextDue && !prevStart && !prevDue && fallbackBase) {
            nextDue = __tmAdvanceTaskRepeatDateKey(fallbackBase, rule);
        }
        if (prevStart && !nextStart) return null;
        if (prevDue && !nextDue) return null;
        const nowIso = String(options.advancedAt || new Date().toISOString()).trim();
        const repeatState = __tmNormalizeTaskRepeatState({
            ...(task?.repeatState && typeof task.repeatState === 'object' ? task.repeatState : {}),
            lastCompletedAt: String(options.completedAt || '').trim() || String(task?.repeatState?.lastCompletedAt || '').trim(),
            lastAdvancedAt: nowIso,
            lastInstanceStart: nextStart,
            lastInstanceDue: nextDue,
        });
        return {
            startDate: nextStart,
            completionTime: nextDue,
            repeatState,
        };
    }

    function __tmGetTaskRepeatUnitLabel(type, every) {
        const repeatType = __tmNormalizeTaskRepeatType(type);
        const n = __tmNormalizeTaskRepeatEvery(every, repeatType);
        if (repeatType === 'daily') return n > 1 ? `每${n}天` : '每天';
        if (repeatType === 'workday') return n > 1 ? `每${n}个工作日` : '每个工作日';
        if (repeatType === 'weekly') return n > 1 ? `每${n}周` : '每周';
        if (repeatType === 'monthly') return n > 1 ? `每${n}个月` : '每月';
        if (repeatType === 'yearly') return n > 1 ? `每${n}年` : '每年';
        return '不循环';
    }

    function __tmGetTaskRepeatSummary(ruleInput, options = {}) {
        const rule = __tmNormalizeTaskRepeatRule(ruleInput, options);
        if (!rule.enabled || rule.type === 'none') return '';
        const triggerText = rule.trigger === 'complete' ? '完成后' : '到期后';
        const unitText = __tmGetTaskRepeatUnitLabel(rule.type, rule.every);
        const untilText = rule.until ? ` · 至 ${rule.until}` : '';
        return `${triggerText}${unitText}${untilText}`;
    }

    function __tmGetTaskRepeatWeekdayLabel(dateLike) {
        const dt = (dateLike instanceof Date) ? dateLike : __tmBuildLocalNoonDateFromKey(dateLike);
        if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return '周?';
        return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dt.getDay()] || '周?';
    }

    function __tmGetTaskRepeatMonthlyModeCaption(mode, anchorDateLike) {
        const anchorDate = __tmBuildLocalNoonDateFromKey(anchorDateLike);
        if (!(anchorDate instanceof Date) || Number.isNaN(anchorDate.getTime())) {
            return mode === 'weekday' ? '按星期' : '按日期';
        }
        if (String(mode || '').trim() === 'weekday') {
            return `按星期（第${__tmGetTaskRepeatMonthWeekOrdinal(anchorDate)}个${__tmGetTaskRepeatWeekdayLabel(anchorDate)}）`;
        }
        return `按日期（${anchorDate.getDate()}日）`;
    }

    function __tmIsRecurringInstanceTask(task) {
        return !!(task && typeof task === 'object' && task.isRecurringInstance === true);
    }

    function __tmResolveRecurringInstanceSourceTaskId(rawId, taskLike = null) {
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : null;
        const fromTask = String(task?.sourceTaskId || task?.recurringSourceTaskId || '').trim();
        if (fromTask) return fromTask;
        const value = String(rawId || '').trim();
        if (!value) return '';
        const match = value.match(/^repeatinst:([^:]+):/);
        return match ? String(match[1] || '').trim() : '';
    }

    function __tmBuildRecurringInstanceTask(sourceTask, historyItem, orderIndex = 0) {
        const source = (sourceTask && typeof sourceTask === 'object') ? sourceTask : null;
        const history = __tmNormalizeTaskRepeatHistory([historyItem])[0] || null;
        if (!source || !history) return null;
        const completedAt = String(history.completedAt || '').trim();
        const completedStamp = completedAt ? completedAt.replace(/[^0-9]/g, '').slice(0, 14) : `${Date.now()}_${orderIndex}`;
        const taskId = String(source.id || '').trim();
        if (!taskId) return null;
        const virtualId = `repeatinst:${taskId}:${completedStamp || orderIndex}`;
        const next = {
            ...source,
            id: virtualId,
            attrHostId: '',
            attr_host_id: '',
            sourceTaskId: taskId,
            recurringSourceTaskId: taskId,
            recurringCompletedAt: completedAt,
            isRecurringInstance: true,
            isRecurringInstanceReadOnly: true,
            done: true,
            content: String(history.content || source.content || '').trim() || String(source.content || '').trim() || '(无内容)',
            raw_content: String(history.content || source.content || '').trim() || String(source.content || '').trim() || '(无内容)',
            markdown: `- [x] ${String(history.content || source.content || '').trim() || '(无内容)'}`,
            root_id: String(history.docId || source.root_id || source.docId || '').trim(),
            docId: String(history.docId || source.root_id || source.docId || '').trim(),
            docName: String(history.docName || source.docName || '').trim() || '未命名文档',
            h2: String(history.h2 || source.h2 || '').trim(),
            h2Id: String(history.h2Id || source.h2Id || '').trim(),
            h2Path: String(history.h2Path || source.h2Path || '').trim(),
            priority: String(history.priority || source.priority || '').trim(),
            custom_priority: String(history.priority || source.priority || '').trim(),
            customStatus: String(history.customStatus || source.customStatus || '').trim(),
            custom_status: String(history.customStatus || source.customStatus || '').trim(),
            duration: String(history.duration || source.duration || '').trim(),
            custom_duration: String(history.duration || source.duration || '').trim(),
            remark: String(history.remark || source.remark || '').trim(),
            custom_remark: String(history.remark || source.remark || '').trim(),
            startDate: __tmNormalizeDateOnly(history.sourceStart || ''),
            start_date: __tmNormalizeDateOnly(history.sourceStart || ''),
            completionTime: completedAt || __tmNormalizeDateOnly(history.sourceDue || ''),
            completion_time: completedAt || __tmNormalizeDateOnly(history.sourceDue || ''),
            parentTaskId: '',
            parent_id: '',
            children: [],
            level: 0,
            created: completedAt || String(source.created || '').trim(),
            updated: completedAt || String(source.updated || '').trim(),
            docSeq: Number.isFinite(history.docSeq) ? (history.docSeq + ((orderIndex + 1) / 1000)) : (Number(source.docSeq) || Number.POSITIVE_INFINITY),
            repeatHistory: [],
            repeatRule: { enabled: false, type: 'none' },
            repeatState: __tmNormalizeTaskRepeatState(null),
        };
        try { normalizeTaskFields(next, next.docName || source.docName || '未命名文档'); } catch (e) {}
        return next;
    }

    function __tmRenderRecurringInstanceBadge(task, options = {}) {
        if (!__tmIsRecurringInstanceTask(task)) return '';
        const cls = String(options?.className || '').trim();
        const classes = ['tm-recurring-instance-badge'];
        if (cls) classes.push(cls);
        return `<span class="${classes.join(' ')}">循环记录</span>`;
    }

    function __tmRenderRecurringTaskInlineIcon(task, options = {}) {
        if (!task || typeof task !== 'object' || __tmIsRecurringInstanceTask(task)) return '';
        const rule = __tmGetTaskRepeatRule(task, {
            startDate: task?.startDate,
            completionTime: task?.completionTime,
        });
        if (!rule.enabled || rule.type === 'none') return '';
        const cls = String(options?.className || '').trim();
        const classes = ['tm-recurring-task-icon'];
        if (cls) classes.push(cls);
        const summary = __tmGetTaskRepeatSummary(rule, {
            startDate: task?.startDate,
            completionTime: task?.completionTime,
        });
        const tooltip = summary ? `循环任务：${summary}` : '循环任务';
        return `<span class="${classes.join(' ')}"${__tmBuildTooltipAttrs(tooltip, { side: String(options?.tooltipSide || 'bottom').trim() || 'bottom', ariaLabel: false })}>${__tmRenderLucideIcon('repeat')}</span>`;
    }

    function __tmPurgeRecurringInstanceTasks(sourceTaskId, completedAtList = []) {
        const sid = String(sourceTaskId || '').trim();
        if (!sid) return 0;
        const completedSet = new Set((Array.isArray(completedAtList) ? completedAtList : [completedAtList])
            .map((item) => String(item || '').trim())
            .filter(Boolean));
        const shouldRemove = (task) => {
            if (!__tmIsRecurringInstanceTask(task)) return false;
            const sourceId = String(task?.sourceTaskId || task?.recurringSourceTaskId || '').trim();
            if (sourceId !== sid) return false;
            if (!completedSet.size) return true;
            return completedSet.has(String(task?.recurringCompletedAt || '').trim());
        };
        let removed = 0;
        try {
            Object.keys(state.flatTasks || {}).forEach((taskId) => {
                const task = state.flatTasks?.[taskId];
                if (!shouldRemove(task)) return;
                delete state.flatTasks[taskId];
                removed += 1;
            });
        } catch (e) {}
        try {
            Object.keys(state.pendingInsertedTasks || {}).forEach((taskId) => {
                const task = state.pendingInsertedTasks?.[taskId];
                if (!shouldRemove(task)) return;
                delete state.pendingInsertedTasks[taskId];
            });
        } catch (e) {}
        const filterTree = (list) => (Array.isArray(list) ? list : []).reduce((acc, item) => {
            if (!item || shouldRemove(item)) return acc;
            const next = { ...item };
            if (Array.isArray(next.children) && next.children.length > 0) {
                next.children = filterTree(next.children);
            }
            acc.push(next);
            return acc;
        }, []);
        try {
            state.taskTree = (Array.isArray(state.taskTree) ? state.taskTree : []).map((doc) => ({
                ...doc,
                tasks: filterTree(doc.tasks),
            }));
        } catch (e) {}
        try {
            state.otherBlocks = filterTree(state.otherBlocks);
        } catch (e) {}
        try {
            state.filteredTasks = (Array.isArray(state.filteredTasks) ? state.filteredTasks : []).filter((task) => !shouldRemove(task));
        } catch (e) {}
        return removed;
    }

    function __tmCollectTaskRepeatPreviewDates(taskLike, options = {}) {
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : {};
        const rule = __tmGetTaskRepeatRule(task, {
            startDate: task?.startDate,
            completionTime: task?.completionTime,
        });
        if (!rule.enabled || rule.type === 'none') return [];
        const limit = Math.max(1, Math.min(8, Number(options.limit) || 5));
        const out = [];
        let cursorTask = {
            ...task,
            startDate: __tmNormalizeDateOnly(task?.startDate || ''),
            completionTime: __tmNormalizeDateOnly(task?.completionTime || ''),
            repeatState: __tmNormalizeTaskRepeatState(task?.repeatState),
        };
        for (let i = 0; i < limit; i += 1) {
            const patch = __tmBuildTaskRepeatAdvancePatch(cursorTask, rule, {
                advancedAt: String(options.advancedAt || new Date().toISOString()).trim() || new Date().toISOString(),
                completedAt: String(cursorTask?.repeatState?.lastCompletedAt || '').trim(),
            });
            if (!patch) break;
            const nextDate = __tmNormalizeDateOnly(patch.completionTime || patch.startDate || '');
            if (!nextDate) break;
            out.push(nextDate);
            cursorTask = {
                ...cursorTask,
                startDate: __tmNormalizeDateOnly(patch.startDate || ''),
                completionTime: __tmNormalizeDateOnly(patch.completionTime || ''),
                repeatState: __tmNormalizeTaskRepeatState(patch.repeatState),
            };
        }
        return out;
    }

    function __tmGetPriorityJiraInfo(value) {
        const p = String(value || '').trim().toLowerCase();
        if (p === 'a') return { key: 'high', label: '高', iconType: 'high' };
        if (p === 'b') return { key: 'medium', label: '中', iconType: 'medium' };
        if (p === 'c') return { key: 'low', label: '低', iconType: 'low' };
        if (p === 'high') return { key: 'high', label: '高', iconType: 'high' };
        if (p === 'medium') return { key: 'medium', label: '中', iconType: 'medium' };
        if (p === 'low') return { key: 'low', label: '低', iconType: 'low' };
        return { key: 'none', label: '无', iconType: 'none' };
    }

    function __tmNormalizePriorityIconStyle(value) {
        return String(value || '').trim().toLowerCase() === 'flag' ? 'flag' : 'jira';
    }

    function __tmRenderPriorityJiraIcon(iconType) {
        const t = String(iconType || '').trim();
        const iconStyle = __tmNormalizePriorityIconStyle(SettingsStore.data?.priorityIconStyle);
        if (iconStyle === 'flag') {
            return __tmPhosphorBoldSvg('flag', { size: 16, className: 'tm-priority-jira__icon-svg' });
        }
        if (t === 'high') {
            return `<svg viewBox="0 0 18 18" aria-hidden="true"><polyline points="2.5,10.1 9,6.1 15.5,10.1" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        }
        if (t === 'medium') {
            return `<svg viewBox="0 0 18 18" aria-hidden="true"><line x1="2.5" y1="5.6" x2="15.5" y2="5.6" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><line x1="2.5" y1="10.6" x2="15.5" y2="10.6" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>`;
        }
        if (t === 'low') {
            return `<svg viewBox="0 0 18 18" aria-hidden="true"><polyline points="2.5,7.1 9,11.1 15.5,7.1" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        }
        return `<svg viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="5.2" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>`;
    }

    function __tmRenderPriorityJira(value, withLabel = true) {
        const info = __tmGetPriorityJiraInfo(value);
        const label = withLabel ? `<span class="tm-priority-jira__label">${esc(info.label)}</span>` : '';
        return `<span class="tm-priority-jira tm-priority-jira--${info.key}"><span class="tm-priority-jira__icon">${__tmRenderPriorityJiraIcon(info.iconType)}</span>${label}</span>`;
    }

    function __tmGetPriorityAccentColor(value) {
        const key = String(__tmGetPriorityJiraInfo(value)?.key || 'none').trim();
        if (key === 'high') return '#de350b';
        if (key === 'medium') return '#ff991f';
        if (key === 'low') return '#1d7afc';
        return '';
    }

    function __tmResolveTaskPriorityValue(taskOrPriority) {
        if (taskOrPriority && typeof taskOrPriority === 'object') {
            const candidates = [
                taskOrPriority.priority,
                taskOrPriority.custom_priority,
                taskOrPriority.customPriority,
            ];
            for (const candidate of candidates) {
                const s = String(candidate ?? '').trim();
                if (s) return s;
            }
            return '';
        }
        return String(taskOrPriority ?? '').trim();
    }

    function __tmBuildTaskCheckboxStyle(taskOrPriority) {
        const accent = __tmGetPriorityAccentColor(__tmResolveTaskPriorityValue(taskOrPriority));
        const neutral = '#a9afb8';
        const color = accent || neutral;
        return ` style="--tm-checklist-checkbox-color:${color};border-color:${color};"`;
    }

    function __tmRenderTaskCheckbox(taskId, task, options = {}) {
        const tid = String(taskId || task?.id || '').trim();
        if (!tid) return '';
        const readOnly = __tmIsCollectedOtherBlockTask(task);
        const jsTid = tid.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const extraClass = String(options?.extraClass || '').trim();
        const checkedAttr = options?.checked ? ' checked' : '';
        const disabledAttr = options?.disabled ? ' disabled' : '';
        const title = String(options?.title || (readOnly ? '完成状态仅在插件内生效，不会修改原块内容' : '')).trim();
        const titleAttr = title ? ` title="${esc(title)}"` : '';
        const mouseDownAttr = options?.stopMouseDown ? ' onmousedown="event.stopPropagation()"' : '';
        const pointerDownAttr = options?.stopPointerDown ? ' onpointerdown="event.stopPropagation()"' : '';
        const clickAttr = options?.stopClick ? ' onclick="event.stopPropagation()"' : '';
        const changeAttr = String(options?.onchange || '').trim()
            ? ` onchange="${String(options.onchange).trim()}"`
            : ` onchange="tmSetDone('${jsTid}', this.checked, event)"`;
        const baseStyle = __tmBuildTaskCheckboxStyle(options?.priority ?? task).replace(/^ style="|"$|^$/g, '');
        const extraStyle = String(options?.style || '').trim().replace(/;+\s*$/, '');
        const mergedStyle = [baseStyle, extraStyle].filter(Boolean).join(';');
        const styleAttr = mergedStyle ? ` style="${mergedStyle};"` : '';
        return `<input class="tm-task-checkbox${extraClass ? ` ${extraClass}` : ''}" type="checkbox"${checkedAttr}${disabledAttr}${titleAttr}${mouseDownAttr}${pointerDownAttr}${clickAttr}${changeAttr}${styleAttr}>`;
    }

    function __tmRenderTaskCheckboxWrap(taskId, task, options = {}) {
        const collapsed = !!options?.collapsed;
        return `<span class="tm-task-checkbox-wrap${collapsed ? ' tm-task-checkbox-wrap--collapsed' : ''}">${collapsed ? '<span class="tm-task-leading-ring" aria-hidden="true"></span>' : ''}${__tmRenderTaskCheckbox(taskId, task, options)}</span>`;
    }

    function __tmParseTimeToTs(value) {
        const s = String(value || '').trim();
        if (!s) return 0;
        if (/^\d{14}$/.test(s)) {
            const y = Number(s.slice(0, 4));
            const mon = Number(s.slice(4, 6)) - 1;
            const d = Number(s.slice(6, 8));
            const hh = Number(s.slice(8, 10));
            const mm = Number(s.slice(10, 12));
            const ss = Number(s.slice(12, 14));
            const dt = new Date(y, mon, d, hh, mm, ss, 0);
            return Number.isNaN(dt.getTime()) ? 0 : dt.getTime();
        }
        if (/^\d{8}$/.test(s)) {
            const y = Number(s.slice(0, 4));
            const mon = Number(s.slice(4, 6)) - 1;
            const d = Number(s.slice(6, 8));
            const dt = new Date(y, mon, d, 12, 0, 0, 0);
            return Number.isNaN(dt.getTime()) ? 0 : dt.getTime();
        }
        if (/^\d+$/.test(s)) {
            const n = Number(s);
            if (!Number.isFinite(n) || n <= 0) return 0;
            const ts = n < 1e12 ? n * 1000 : n;
            return ts;
        }
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

    function __tmShouldUseBestSubtaskTimeForSort(field) {
        const key = String(field || '').trim();
        if (!SettingsStore.data.groupSortByBestSubtaskTimeInTimeQuadrant) return false;
        return key === 'completionTime' || key === 'priorityScore';
    }

    function __tmGetTaskTimePriorityInfo(task, options = {}) {
        const t = task || {};
        const memo = (options && options.memo instanceof Map) ? options.memo : null;
        const taskId = String(t?.id || '').trim();
        if (memo && taskId && memo.has(taskId)) return memo.get(taskId);

        const now = new Date();
        const todayStartTs = Number.isFinite(Number(options?.todayStartTs))
            ? Number(options.todayStartTs)
            : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
        const preferChild = options?.useBestSubtaskTime === true
            ? true
            : (options?.useBestSubtaskTime === false
                ? false
                : !!SettingsStore.data.groupSortByBestSubtaskTimeInTimeQuadrant);

        const parseToLocalDayStartTs = (value) => {
            const s0 = __tmNormalizeDateOnly(value);
            if (s0 && /^\d{4}-\d{2}-\d{2}$/.test(s0)) {
                const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s0);
                const y = Number(m[1]);
                const mon = Number(m[2]) - 1;
                const d = Number(m[3]);
                const dt = new Date(y, mon, d, 0, 0, 0, 0);
                const ts = dt.getTime();
                return Number.isFinite(ts) ? ts : 0;
            }
            const ts0 = __tmParseTimeToTs(value);
            if (!Number.isFinite(ts0) || ts0 <= 0) return 0;
            const dt0 = new Date(ts0);
            const dt = new Date(dt0.getFullYear(), dt0.getMonth(), dt0.getDate(), 0, 0, 0, 0);
            return Number.isFinite(dt.getTime()) ? dt.getTime() : 0;
        };
        const calcLocalDayDiff = (targetDayStartTs) => {
            if (!Number.isFinite(targetDayStartTs) || targetDayStartTs <= 0) return Infinity;
            // 使用 round 抵消夏令时 23/25 小时带来的日差抖动
            return Math.round((targetDayStartTs - todayStartTs) / (1000 * 60 * 60 * 24));
        };

        const toInfo = (srcTask, sourceTaskId, fromChild) => {
            const rawTs = __tmParseTimeToTs(srcTask?.completionTime);
            const dayTs = parseToLocalDayStartTs(srcTask?.completionTime);
            const out = {
                ts: Number.isFinite(rawTs) && rawTs > 0 ? rawTs : 0,
                dayTs: Number.isFinite(dayTs) && dayTs > 0 ? dayTs : 0,
                diffDays: Infinity,
                hasDate: false,
                sourceTaskId: String(sourceTaskId || '').trim(),
                fromChild: !!fromChild,
            };
            if (out.dayTs > 0) {
                out.hasDate = true;
                out.diffDays = calcLocalDayDiff(out.dayTs);
                if (!(out.ts > 0)) out.ts = out.dayTs;
            }
            return out;
        };

        const toRank = (info) => {
            const diff = Number(info?.diffDays);
            if (!Number.isFinite(diff)) return { bucket: 2, rank: Infinity };
            if (diff < 0) return { bucket: 0, rank: diff }; // 已过期越久优先
            return { bucket: 1, rank: diff }; // 未过期越近优先
        };

        const isBetter = (a, b) => {
            if (!a) return false;
            if (!b) return true;
            const ar = toRank(a);
            const br = toRank(b);
            if (ar.bucket !== br.bucket) return ar.bucket < br.bucket;
            if (ar.rank !== br.rank) return ar.rank < br.rank;
            return Number(a.ts || 0) < Number(b.ts || 0);
        };

        let best = toInfo(t, taskId || String(t?.id || ''), false);
        if (preferChild) {
            const stack = Array.isArray(t?.children) ? [...t.children] : [];
            const visited = new Set();
            let bestChild = null;
            while (stack.length > 0) {
                const cur = stack.pop();
                if (!cur) continue;
                const cid = String(cur?.id || '').trim();
                if (cid) {
                    if (visited.has(cid)) continue;
                    visited.add(cid);
                }
                const kids = Array.isArray(cur?.children) ? cur.children : [];
                for (let i = 0; i < kids.length; i++) stack.push(kids[i]);
                if (cur?.done) continue;
                const info = toInfo(cur, cid, true);
                if (info.hasDate && isBetter(info, bestChild)) bestChild = info;
            }
            if (bestChild) best = bestChild;
        }

        if (memo && taskId) memo.set(taskId, best);
        return best;
    }

    function __tmGetTaskEffectiveCompletionTimeInfo(task, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const field = String(opts.field || '').trim();
        const useBestSubtaskTime = opts.useBestSubtaskTime === true
            ? true
            : (opts.useBestSubtaskTime === false
                ? false
                : __tmShouldUseBestSubtaskTimeForSort(field));
        return __tmGetTaskTimePriorityInfo(task, {
            memo: opts.memo,
            todayStartTs: opts.todayStartTs,
            useBestSubtaskTime,
        });
    }

    function __tmGetTaskEffectiveCompletionTimeSortValue(task, options = {}) {
        const info = __tmGetTaskEffectiveCompletionTimeInfo(task, options);
        const ts = Number(info?.ts || 0);
        return ts > 0 ? ts : '';
    }

    function __tmParseDurationMinutes(value) {
        const s = String(value || '').trim();
        if (!s) return null;
        const fmt = String(SettingsStore?.data?.durationFormat || 'hours').trim();
        const numberToMinutes = (n) => {
            if (!Number.isFinite(n) || n < 0) return null;
            if (fmt === 'hours') return n * 60;
            return n;
        };
        if (/^\d+(\.\d+)?$/.test(s)) {
            const n = Number(s);
            return numberToMinutes(n);
        }
        let total = 0;
        let matched = false;
        const re = /(\d+(?:\.\d+)?)\s*([dhm])/ig;
        let m;
        while ((m = re.exec(s))) {
            matched = true;
            const n = Number(m[1]);
            const unit = String(m[2] || '').toLowerCase();
            if (!Number.isFinite(n)) continue;
            if (unit === 'd') total += n * 1440;
            else if (unit === 'h') total += n * 60;
            else total += n;
        }
        if (matched) return total;
        const n0 = Number.parseFloat(s);
        return numberToMinutes(n0);
    }

    function __tmGetTaskDocIdById(taskId) {
        const id = String(taskId || '').trim();
        if (!id) return '';
        const t = state.flatTasks?.[id];
        if (t) return String(t?.root_id || t?.docId || '').trim();
        const snap = WhiteboardStore.getTask(id);
        if (!snap) return '';
        return String(snap?.docId || '').trim();
    }

    // 白板快照缓存（避免每次调用都进行归一化处理）
    let __tmWhiteboardCardSnapshotCache = null;
    let __tmWhiteboardCardSnapshotCacheTime = 0;
    const __tmWhiteboardCardSnapshotCacheTTL = 5000; // 缓存5秒

