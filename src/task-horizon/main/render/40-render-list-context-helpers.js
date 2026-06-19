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
