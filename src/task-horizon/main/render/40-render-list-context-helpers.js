// Responsibility: shared list/table render context helpers used by split render/runtime files.
// Main entries: __tmBuildTableHeaderCellHtml, __tmBuildListRenderContext
// Search keywords: list render context, table header, column order, custom field columns

function __tmBuildTableHeaderCellHtml(colKey, tableLayout) {
    const key = String(colKey || '').trim();
    if (!key) return '';
    const label = __tmResolveColumnLabel(key);
    const escapedKey = key.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const align = (key === 'pinned' || key === 'score' || key === 'priority' || key === 'status' || key === 'remainingTime' || key === 'tomatoSummary')
        ? 'text-align: center;'
        : '';
    const labelHtml = key === 'pinned'
        ? __tmRenderInlineIcon('pin')
        : esc(label || key);
    const resizeHtml = __tmIsFixedDateColumn(key)
        ? ''
        : `<span class="tm-col-resize" onmousedown="startColResize(event, '${escapedKey}')"></span>`;
    return `<th data-col="${esc(key)}" title="${esc(label || key)}" oncontextmenu="tmShowColumnHeaderContextMenu(event, '${escapedKey}'); return false;" style="${tableLayout.cellStyle(key, `${align} white-space: nowrap; overflow: hidden;`)}">${labelHtml}${resizeHtml}</th>`;
}

function __tmResolveTimeGroupQuickAddDate(groupLike = null) {
    const group = (groupLike && typeof groupLike === 'object') ? groupLike : {};
    const sortValue = Number(group.sortValue);
    let days = null;
    if (Number.isInteger(sortValue) && sortValue >= 0 && sortValue <= 15) {
        days = sortValue;
    } else {
        const key = String(group.key || '').trim();
        if (key === 'today') days = 0;
        else if (key === 'tomorrow') days = 1;
        else if (key === 'after_tomorrow') days = 2;
        else {
            const match = key.match(/^days_(\d+)$/);
            const parsed = match ? Number(match[1]) : NaN;
            if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 15) days = parsed;
        }
    }
    if (!Number.isInteger(days)) return '';
    const target = new Date();
    target.setHours(12, 0, 0, 0);
    target.setDate(target.getDate() + days);
    return __tmNormalizeDateOnly(target);
}

function __tmBuildTimeGroupQuickAddBtnHtml(docId, groupLike = null, title = '') {
    try {
        if (typeof __tmIsOtherBlockTabId === 'function' && __tmIsOtherBlockTabId(state?.activeDocId)) return '';
    } catch (e) {}
    const completionTime = __tmResolveTimeGroupQuickAddDate(groupLike);
    if (!completionTime) return '';
    const rawDocId = String(docId || '').trim();
    const did = rawDocId && rawDocId !== 'all' ? rawDocId : '';
    const safeTitle = String(title || '').trim() || String.fromCharCode(26032, 24314, 20219, 21153);
    return `
        <span class="tm-group-actions" onclick="event.stopPropagation()">
            <button class="tm-group-create-btn"
                    type="button"
                    title="${esc(safeTitle)}"
                    aria-label="${esc(safeTitle)}"
                    onpointerdown="event.stopPropagation()"
                    onclick="event.preventDefault();event.stopPropagation();tmQuickAddOpenForPreset(&quot;${esc(did)}&quot;,&quot;&quot;,&quot;${esc(completionTime)}&quot;);">
                ${__tmRenderLucideIcon('plus')}
            </button>
        </span>
    `;
}

// Keep task-card grouping identical in kanban and the whiteboard card stream.
function __tmCreateTaskCardGroupingContext(isDark = false) {
    const timeBaseColor = isDark
        ? __tmNormalizeHexColor(SettingsStore.data.timeGroupBaseColorDark, '#6ba5ff')
        : __tmNormalizeHexColor(SettingsStore.data.timeGroupBaseColorLight, '#1a73e8');
    const timeOverdueColor = isDark
        ? __tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorDark, '#ff6b6b')
        : __tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorLight, '#d93025');
    const timePriorityMemo = new Map();
    const getTimeGroupLabelColor = (groupInfo) => {
        const sortValue = Number(groupInfo?.sortValue);
        if (groupInfo?.key === 'pending' || !Number.isFinite(sortValue)) return 'var(--tm-secondary-text)';
        if (sortValue < 0) return timeOverdueColor || 'var(--tm-danger-color)';
        const alpha = __tmClamp(1 - sortValue * (isDark ? 0.085 : 0.11), isDark ? 0.52 : 0.42, 1);
        return __tmWithAlpha(timeBaseColor || 'var(--tm-primary-color)', alpha);
    };
    const buildTimeGroupLabelHtml = (label, diffDays) => {
        const safeLabel = esc(String(label || '').trim());
        const days = Number(diffDays);
        if (!Number.isFinite(days) || days < 0 || days > 15) return safeLabel;
        const target = new Date();
        target.setHours(12, 0, 0, 0);
        target.setDate(target.getDate() + days);
        return `<span class="tm-time-group-label-wrap"><span class="tm-time-group-label-text">${safeLabel}</span><span class="tm-time-group-weekday-chip">${esc(__tmGetTaskRepeatWeekdayLabel(target))}</span></span>`;
    };
    const getTimeGroup = (task) => {
        const diffDays = Number(__tmGetTaskTimePriorityInfo(task, { memo: timePriorityMemo })?.diffDays);
        if (!Number.isFinite(diffDays)) return { key: 'pending', label: '待定', labelHtml: '待定', sortValue: Infinity };
        if (diffDays < 0) return { key: 'overdue', label: '已过期', labelHtml: '已过期', sortValue: diffDays };
        if (diffDays >= 16) return { key: 'farther', label: '更远', labelHtml: '更远', sortValue: 16 };
        const key = diffDays === 0 ? 'today' : diffDays === 1 ? 'tomorrow' : diffDays === 2 ? 'after_tomorrow' : `days_${diffDays}`;
        const label = diffDays === 0 ? '今天' : diffDays === 1 ? '明天' : diffDays === 2 ? '后天' : `余${diffDays}天`;
        return { key, label, labelHtml: buildTimeGroupLabelHtml(label, diffDays), sortValue: diffDays };
    };
    const quadrantRules = Array.isArray(SettingsStore.data.quadrantConfig?.rules) ? SettingsStore.data.quadrantConfig.rules : [];
    const quadrantOrder = ['urgent-important', 'not-urgent-important', 'urgent-not-important', 'not-urgent-not-important'];
    const quadrantColorMap = {
        red: 'var(--tm-quadrant-red)',
        yellow: 'var(--tm-quadrant-yellow)',
        blue: 'var(--tm-quadrant-blue)',
        green: 'var(--tm-quadrant-green)',
    };
    const resolveQuadrantRule = (task) => {
        const priority = String(task?.priority || '').toLowerCase();
        const importance = ['a', '高', 'high'].includes(priority) ? 'high'
            : ['b', '中', 'medium'].includes(priority) ? 'medium'
                : ['c', '低', 'low'].includes(priority) ? 'low' : 'none';
        const timeStr = __tmIsCheckinTask(task) ? __tmGetTaskCheckinCurrentDate(task) : String(task?.completionTime || '').trim();
        const taskDate = timeStr ? new Date(timeStr) : null;
        let taskDays = Infinity;
        let timeRange = 'nodate';
        if (taskDate && !isNaN(taskDate.getTime())) {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const target = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
            taskDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
            timeRange = taskDays < 0 ? 'overdue' : taskDays <= 7 ? 'within7days'
                : taskDays <= 15 ? 'within15days' : taskDays <= 30 ? 'within30days' : 'beyond30days';
        }
        for (const rule of quadrantRules) {
            if (!(Array.isArray(rule?.importance) ? rule.importance : []).includes(importance)) continue;
            const ranges = Array.isArray(rule?.timeRanges) ? rule.timeRanges : [];
            const matches = ranges.includes(timeRange) || ranges.some((range) => {
                const value = String(range || '');
                if (!value.startsWith('beyond') || value === 'beyond30days') return false;
                const days = parseInt(value.replace('beyond', '').replace('days', ''), 10);
                return !isNaN(days) && taskDays > days;
            });
            if (matches) return rule;
        }
        return null;
    };
    return { getTimeGroup, getTimeGroupLabelColor, quadrantRules, quadrantOrder, quadrantColorMap, resolveQuadrantRule };
}

function __tmBuildListRenderContext(options = {}) {
    const opts = (options && typeof options === 'object') ? options : {};
    const colOrder = (Array.isArray(opts.colOrder) && opts.colOrder.length)
        ? opts.colOrder
        : ((Array.isArray(SettingsStore.data.columnOrder) && SettingsStore.data.columnOrder.length)
            ? SettingsStore.data.columnOrder
            : __tmGetDefaultColumnOrder());
    const knownColumnKeys = typeof __tmGetKnownColumnKeys === 'function' ? __tmGetKnownColumnKeys() : null;
    let normalizedColOrder = colOrder
        .map((col) => String(col || '').trim())
        .filter((col, index, arr) => col && (!knownColumnKeys || knownColumnKeys.has(col)) && arr.indexOf(col) === index);
    if (!normalizedColOrder.length) {
        normalizedColOrder = __tmGetDefaultColumnOrder()
            .filter((col) => !knownColumnKeys || knownColumnKeys.has(col));
    }
    normalizedColOrder = __tmGetEffectiveCustomFieldColumnOrder(
        normalizedColOrder,
        Array.isArray(opts.tasks) ? opts.tasks : state?.filteredTasks
    );
    const columnWidths = (opts.columnWidths && typeof opts.columnWidths === 'object')
        ? opts.columnWidths
        : (SettingsStore.data.columnWidths || {});
    const tableAvailableWidth = Number.isFinite(Number(opts.tableAvailableWidth))
        ? Number(opts.tableAvailableWidth)
        : (Number(state.tableAvailableWidth) || 0);
    const tableLayout = opts.tableLayout || __tmGetTableWidthLayout(normalizedColOrder, columnWidths, tableAvailableWidth);
    const statusOptions = Array.isArray(opts.statusOptions)
        ? opts.statusOptions
        : __tmGetStatusOptions(SettingsStore.data.customStatusOptions || []);
    const customFieldDefMap = __tmGetCustomFieldDefMap();
    const customFieldColumns = normalizedColOrder.map((col) => {
        const colKey = String(col || '').trim();
        const fieldId = __tmParseCustomFieldColumnKey(colKey);
        if (!colKey || !fieldId) return null;
        const field = customFieldDefMap.get(fieldId);
        if (!field) return null;
        return {
            colKey,
            field,
            fieldId,
            fieldType: String(field?.type || '').trim(),
        };
    }).filter(Boolean);
    return {
        colOrder: normalizedColOrder,
        colCount: normalizedColOrder.length || 7,
        tableLayout,
        statusOptions,
        customFieldColumns,
    };
}
