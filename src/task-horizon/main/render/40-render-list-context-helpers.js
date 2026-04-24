// Responsibility: shared list/table render context helpers used by split render/runtime files.
// Main entries: __tmBuildTableHeaderCellHtml, __tmBuildListRenderContext
// Search keywords: list render context, table header, column order, custom field columns

function __tmBuildTableHeaderCellHtml(colKey, tableLayout) {
    const key = String(colKey || '').trim();
    if (!key) return '';
    const label = __tmResolveColumnLabel(key);
    const escapedKey = key.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const align = (key === 'pinned' || key === 'score' || key === 'priority' || key === 'status' || key === 'remainingTime')
        ? 'text-align: center;'
        : '';
    const labelHtml = key === 'pinned'
        ? __tmRenderInlineIcon('pin')
        : esc(label || key);
    return `<th data-col="${esc(key)}" title="${esc(label || key)}" oncontextmenu="tmShowColumnHeaderContextMenu(event, '${escapedKey}'); return false;" style="${tableLayout.cellStyle(key, `${align} white-space: nowrap; overflow: hidden;`)}">${labelHtml}<span class="tm-col-resize" onmousedown="startColResize(event, '${escapedKey}')"></span></th>`;
}

function __tmBuildListRenderContext(options = {}) {
    const opts = (options && typeof options === 'object') ? options : {};
    const colOrder = (Array.isArray(opts.colOrder) && opts.colOrder.length)
        ? opts.colOrder
        : ((Array.isArray(SettingsStore.data.columnOrder) && SettingsStore.data.columnOrder.length)
            ? SettingsStore.data.columnOrder
            : __tmGetDefaultColumnOrder());
    const columnWidths = (opts.columnWidths && typeof opts.columnWidths === 'object')
        ? opts.columnWidths
        : (SettingsStore.data.columnWidths || {});
    const tableAvailableWidth = Number.isFinite(Number(opts.tableAvailableWidth))
        ? Number(opts.tableAvailableWidth)
        : (Number(state.tableAvailableWidth) || 0);
    const tableLayout = opts.tableLayout || __tmGetTableWidthLayout(colOrder, columnWidths, tableAvailableWidth);
    const statusOptions = Array.isArray(opts.statusOptions)
        ? opts.statusOptions
        : __tmGetStatusOptions(SettingsStore.data.customStatusOptions || []);
    const customFieldDefMap = __tmGetCustomFieldDefMap();
    const customFieldColumns = colOrder.map((col) => {
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
        colOrder,
        colCount: colOrder.length || 7,
        tableLayout,
        statusOptions,
        customFieldColumns,
    };
}
