    function __tmExcelSanitizeFileName(name) {
        const raw = String(name || '').trim();
        const safe = raw.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim();
        return safe || '任务管理器_表格导出';
    }

    function __tmExcelDateStamp() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    }

    function __tmExcelGetNoHeadingLabel() {
        const headingLevel = String(SettingsStore.data.taskHeadingLevel || 'h2').trim() || 'h2';
        const headingLabelMap = { h1: '一级标题', h2: '二级标题', h3: '三级标题', h4: '四级标题', h5: '五级标题', h6: '六级标题' };
        return `无${headingLabelMap[headingLevel] || '标题'}`;
    }

    function __tmResolveXlsxRuntime() {
        const candidates = [
            globalThis.XLSX,
            (typeof window !== 'undefined' ? window.XLSX : null),
            globalThis.exports,
            globalThis.module?.exports,
            (typeof window !== 'undefined' ? window.exports : null),
            (typeof window !== 'undefined' ? window.module?.exports : null),
        ];
        for (const candidate of candidates) {
            if (candidate && candidate.utils && (typeof candidate.writeFile === 'function' || typeof candidate.writeFileXLSX === 'function')) {
                try {
                    if (!globalThis.XLSX) globalThis.XLSX = candidate;
                    if (typeof window !== 'undefined' && !window.XLSX) window.XLSX = candidate;
                } catch (e) {}
                return candidate;
            }
        }
        return null;
    }

    async function __tmEnsureXlsxRuntimeLoaded() {
        let runtime = __tmResolveXlsxRuntime();
        if (runtime) return runtime;
        const loader = globalThis.__taskHorizonEnsureXlsxModuleLoaded;
        if (typeof loader === 'function') {
            try { await loader(); } catch (e) {}
        }
        runtime = __tmResolveXlsxRuntime();
        return runtime || null;
    }

    function __tmExcelResolveStatusName(task) {
        const currentStatus = __tmResolveTaskStatusId(task);
        const statusOptions = __tmGetStatusOptions(SettingsStore.data.customStatusOptions || []);
        const statusOption = statusOptions.find((item) => String(item?.id || '').trim() === currentStatus);
        return String(statusOption?.name || currentStatus || '').trim();
    }

    function __tmExcelParseDateCell(value) {
        const normalized = __tmFormatTaskTime(value);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
        const parts = normalized.split('-').map((item) => Number(item));
        const year = Number(parts[0]);
        const month = Number(parts[1]);
        const day = Number(parts[2]);
        if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
        const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function __tmExcelGetVisibleRootTask(task, taskMap) {
        let current = task;
        const seen = new Set();
        while (current) {
            const currentId = String(current?.id || '').trim();
            const parentId = String(current?.parentTaskId || '').trim();
            if (!parentId || seen.has(parentId)) return current;
            seen.add(parentId);
            const parent = taskMap.get(parentId);
            if (!parent) return current;
            current = parent;
            if (!currentId) return current;
        }
        return task;
    }

    function __tmGetTaskRemainingTimeInfo(task, options = {}) {
        const DAY_MS = 24 * 60 * 60 * 1000;
        const parseToLocalDayBoundaryTs = (value, boundary = 'start') => {
            const normalized = __tmNormalizeDateOnly(value);
            if (normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
                const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
                if (match) {
                    const dt = boundary === 'end'
                        ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 0, 0)
                        : new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
                    const ts = dt.getTime();
                    return Number.isFinite(ts) ? ts : 0;
                }
            }
            const parsedTs = __tmParseTimeToTs(value);
            if (!Number.isFinite(parsedTs) || parsedTs <= 0) return 0;
            const parsed = new Date(parsedTs);
            const dt = boundary === 'end'
                ? new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 23, 59, 0, 0)
                : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
            const ts = dt.getTime();
            return Number.isFinite(ts) ? ts : 0;
        };
        const nowTs = Number.isFinite(Number(options?.nowTs)) ? Number(options.nowTs) : Date.now();
        const nowDate = new Date(nowTs);
        const todayStartTs = Number.isFinite(Number(options?.todayStartTs))
            ? Number(options.todayStartTs)
            : new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), 0, 0, 0, 0).getTime();
        const calcDayDiff = (targetDayStartTs) => {
            if (!Number.isFinite(targetDayStartTs) || targetDayStartTs <= 0) return Infinity;
            return Math.round((targetDayStartTs - todayStartTs) / DAY_MS);
        };
        const makeInfo = (label, color, sortPrefix, emphasis = false) => ({
            label: String(label || '').trim() || '待定',
            color: String(color || 'var(--tm-secondary-text)').trim() || 'var(--tm-secondary-text)',
            sortPrefix: String(sortPrefix || '8').trim() || '8',
            emphasis: !!emphasis,
        });
        const colors = {
            overdue: __tmIsDarkMode()
                ? (__tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorDark, '#ff6b6b') || '#ff6b6b')
                : (__tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorLight, '#d93025') || '#d93025'),
            active: '#5fc25f',
            activeStrong: '#05ba05',
            waiting: '#999999',
            pending: '#8e69c9',
        };

        const startStartTs = parseToLocalDayBoundaryTs(task?.startDate, 'start');
        const startEndTs = parseToLocalDayBoundaryTs(task?.startDate, 'end');
        const endStartTs = parseToLocalDayBoundaryTs(task?.completionTime, 'start');
        const endEndTs = parseToLocalDayBoundaryTs(task?.completionTime, 'end');
        const hasStart = Number.isFinite(startStartTs) && startStartTs > 0;
        const hasEnd = Number.isFinite(endEndTs) && endEndTs > 0;

        if (hasEnd) {
            if (hasStart && nowTs < startStartTs) {
                const daysUntilStart = calcDayDiff(startStartTs);
                if (daysUntilStart <= 0) return makeInfo('开始', colors.active, '2', true);
                if (daysUntilStart === 1) return makeInfo('明天→', colors.waiting, '4');
                if (daysUntilStart === 2) return makeInfo('后天→', colors.waiting, '5');
                if (daysUntilStart <= 7) return makeInfo(`${daysUntilStart}天后→`, colors.waiting, '6');
                return makeInfo(`${daysUntilStart}天后→`, colors.waiting, '7');
            }
            const remainingDays = calcDayDiff(endStartTs);
            if (remainingDays < 0 || nowTs > endEndTs) return makeInfo('过期', colors.overdue, '1', true);
            if (remainingDays === 0) return makeInfo('今天', colors.activeStrong, '1', true);
            if (remainingDays <= 7) return makeInfo(`余${remainingDays}天`, colors.active, '1', true);
            return makeInfo(`余${remainingDays}天`, colors.active, '1');
        }

        if (hasStart) {
            if (nowTs > startEndTs) return makeInfo('开始', colors.active, '2', true);
            const daysUntilStart = calcDayDiff(startStartTs);
            if (daysUntilStart <= 0) return makeInfo('今天', colors.activeStrong, '1', true);
            if (daysUntilStart === 1) return makeInfo('明天→', colors.waiting, '4');
            if (daysUntilStart === 2) return makeInfo('后天→', colors.waiting, '5');
            if (daysUntilStart <= 7) return makeInfo(`${daysUntilStart}天后→`, colors.waiting, '6');
            return makeInfo(`${daysUntilStart}天后→`, colors.waiting, '7');
        }

        return makeInfo('待定', colors.pending, '8');
    }

    function __tmRenderTaskRemainingTimeInfoHtml(info) {
        const item = (info && typeof info === 'object') ? info : null;
        const label = String(item?.label || '待定').trim() || '待定';
        const color = String(item?.color || 'var(--tm-secondary-text)').trim() || 'var(--tm-secondary-text)';
        const sortPrefix = String(item?.sortPrefix || '8').trim() || '8';
        const weight = item?.emphasis ? '700' : '500';
        return `<span style="display:none;">${esc(sortPrefix)}</span><span style="color:${esc(color)};font-weight:${weight};">${esc(label)}</span>`;
    }

    function __tmRenderTaskRemainingTimeHtml(task, options = {}) {
        return __tmRenderTaskRemainingTimeInfoHtml(__tmGetTaskRemainingTimeInfo(task, options));
    }

    function __tmGetTaskRemainingTimeLabel(task, options = {}) {
        return __tmGetTaskRemainingTimeInfo(task, options).label;
    }

    function __tmExcelGetTimeGroupLabel(task) {
        const info = __tmGetTaskTimePriorityInfo(task);
        const diffDays = Number(info?.diffDays);
        if (!Number.isFinite(diffDays)) return '待定';
        if (diffDays < 0) return '已过期';
        if (diffDays === 0) return '今天';
        if (diffDays === 1) return '明天';
        if (diffDays === 2) return '后天';
        return `余${diffDays}天`;
    }

    function __tmExcelGetQuadrantGroupLabel(task) {
        const quadrantRules = (SettingsStore.data.quadrantConfig && SettingsStore.data.quadrantConfig.rules) || [];
        const priority = String(task?.priority || '').toLowerCase();
        const importance = (priority === 'a' || priority === '高' || priority === 'high')
            ? 'high'
            : ((priority === 'b' || priority === '中' || priority === 'medium')
                ? 'medium'
                : ((priority === 'c' || priority === '低' || priority === 'low') ? 'low' : 'none'));
        const diffDays = Number(__tmGetTaskTimePriorityInfo(task)?.diffDays);
        const timeRange = !Number.isFinite(diffDays)
            ? 'nodate'
            : (diffDays < 0 ? 'overdue' : (diffDays <= 7 ? 'within7days' : (diffDays <= 15 ? 'within15days' : (diffDays <= 30 ? 'within30days' : 'beyond30days'))));
        for (const rule of quadrantRules) {
            const importanceMatch = Array.isArray(rule?.importance) && rule.importance.includes(importance);
            let timeRangeMatch = Array.isArray(rule?.timeRanges) && rule.timeRanges.includes(timeRange);
            if (!timeRangeMatch && Array.isArray(rule?.timeRanges)) {
                for (const range of rule.timeRanges) {
                    if (!String(range || '').startsWith('beyond') || range === 'beyond30days') continue;
                    const days = parseInt(String(range).replace('beyond', '').replace('days', ''), 10);
                    if (!Number.isNaN(days) && diffDays > days) {
                        timeRangeMatch = true;
                        break;
                    }
                }
            }
            if (importanceMatch && timeRangeMatch) return String(rule?.name || '').trim();
        }
        return '';
    }

    function __tmExcelGetGroupLabel(task, rootTask) {
        const root = rootTask || task;
        if (!root) return '';
        if (state.groupByDocName) {
            const labels = [String(root.docName || root.rawDocName || '').trim() || '未命名文档'];
            if (SettingsStore.data.docH2SubgroupEnabled !== false) {
                const bucket = __tmGetDocHeadingBucket(root, __tmExcelGetNoHeadingLabel());
                const headingLabel = String(bucket?.label || '').trim();
                if (headingLabel) labels.push(headingLabel);
            }
            return labels.filter(Boolean).join(' / ');
        }
        if (state.groupByTime) return __tmExcelGetTimeGroupLabel(root);
        if (state.quadrantEnabled) return __tmExcelGetQuadrantGroupLabel(root);
        if (state.groupByTaskName) return String(root.content || '').trim();
        return root?.pinned ? '置顶' : '';
    }

    function __tmExcelGetExportColumnDefs() {
        const headingLevel = String(SettingsStore.data.taskHeadingLevel || 'h2').trim() || 'h2';
        const headingLabels = { h1: '一级标题', h2: '二级标题', h3: '三级标题', h4: '四级标题', h5: '五级标题', h6: '六级标题' };
        const seenColumnKeys = new Set();
        const columnOrder = [];
        const appendColumnKeys = (keys) => {
            (Array.isArray(keys) ? keys : []).forEach((key) => {
                const colKey = String(key || '').trim();
                if (!colKey || seenColumnKeys.has(colKey)) return;
                seenColumnKeys.add(colKey);
                columnOrder.push(colKey);
            });
        };
        appendColumnKeys(Array.isArray(SettingsStore.data.columnOrder) ? SettingsStore.data.columnOrder : []);
        appendColumnKeys(__tmGetDefaultColumnOrder());
        const widthMap = (SettingsStore.data.columnWidths && typeof SettingsStore.data.columnWidths === 'object') ? SettingsStore.data.columnWidths : {};
        const pxToWch = (px, fallback) => {
            const n = Number(px);
            if (!Number.isFinite(n) || n <= 0) return fallback;
            return Math.max(8, Math.min(80, Math.round(n / 8)));
        };
        const defs = {
            pinned: {
                key: 'pinned',
                label: '置顶',
                wch: 6,
                value: (task) => task?.pinned ? '是' : ''
            },
            content: {
                key: 'content',
                label: '任务内容',
                wch: pxToWch(widthMap.content, 36),
                value: (task) => String(task?.content || '').trim()
            },
            status: {
                key: 'status',
                label: '状态',
                wch: pxToWch(widthMap.status, 12),
                value: (task) => __tmExcelResolveStatusName(task)
            },
            score: {
                key: 'score',
                label: '优先级分',
                wch: pxToWch(widthMap.score, 12),
                value: (task) => Math.round(__tmEnsureTaskPriorityScore(task))
            },
            doc: {
                key: 'doc',
                label: '文档',
                wch: pxToWch(widthMap.doc, 22),
                value: (task) => String(task?.docName || task?.rawDocName || '').trim()
            },
            h2: {
                key: 'h2',
                label: headingLabels[headingLevel] || '标题',
                wch: pxToWch(widthMap.h2, 22),
                value: (task) => __tmNormalizeHeadingText(task?.h2)
            },
            priority: {
                key: 'priority',
                label: '重要性',
                wch: pxToWch(widthMap.priority, 10),
                value: (task) => String(__tmGetPriorityJiraInfo(task?.priority)?.label || '').trim()
            },
            startDate: {
                key: 'startDate',
                label: '开始日期',
                kind: 'date',
                wch: pxToWch(widthMap.startDate, 14),
                value: (task) => String(task?.startDate || '').trim()
            },
            completionTime: {
                key: 'completionTime',
                label: '截止日期',
                kind: 'date',
                wch: pxToWch(widthMap.completionTime, 14),
                value: (task) => String(task?.completionTime || '').trim()
            },
            remainingTime: {
                key: 'remainingTime',
                label: '剩余时间',
                wch: pxToWch(widthMap.remainingTime, 14),
                value: (task) => __tmGetTaskRemainingTimeLabel(task)
            },
            duration: {
                key: 'duration',
                label: '时长',
                wch: pxToWch(widthMap.duration, 12),
                value: (task) => String(task?.duration || '').trim()
            },
            spent: {
                key: 'spent',
                label: '耗时',
                wch: pxToWch(widthMap.spent, 12),
                value: (task) => {
                    const mode = String(SettingsStore.data.tomatoSpentAttrMode || 'minutes').trim() || 'minutes';
                    return (SettingsStore.data.enableTomatoIntegration && mode === 'hours')
                        ? String(__tmFormatSpentHours(__tmParseNumber(task?.tomatoHours)) || '').trim()
                        : String(__tmFormatSpentMinutes(__tmGetTaskSpentMinutes(task)) || '').trim();
                }
            },
            remark: {
                key: 'remark',
                label: '备注',
                wch: pxToWch(widthMap.remark, 30),
                value: (task) => String(task?.remark || '').trim()
            }
        };
        __tmGetCustomFieldDefs().forEach((field) => {
            const fieldId = String(field?.id || '').trim();
            const colKey = __tmBuildCustomFieldColumnKey(fieldId);
            if (!fieldId || !colKey) return;
            const fieldType = String(field?.type || '').trim();
            defs[colKey] = {
                key: colKey,
                label: String(field?.name || fieldId).trim() || fieldId,
                wch: pxToWch(widthMap[colKey], fieldType === 'multi' ? 24 : (fieldType === 'text' ? 28 : 18)),
                value: (task) => fieldType === 'text'
                    ? String(__tmNormalizeCustomFieldValue(field, __tmGetTaskCustomFieldValue(task, fieldId)) || '').trim()
                    : __tmResolveCustomFieldSelectedOptions(field, __tmGetTaskCustomFieldValue(task, fieldId))
                        .map((option) => String(option?.name || option?.id || '').trim())
                        .filter(Boolean)
                        .join(', ')
            };
        });
        return columnOrder.map((key) => defs[key]).filter(Boolean);
    }

    function __tmBuildCurrentTableExcelExportModel() {
        const filtered = Array.isArray(state.filteredTasks) ? state.filteredTasks.slice() : [];
        if (filtered.length === 0) return { columns: [], rows: [] };
        const taskMap = new Map(filtered.map((task) => [String(task?.id || '').trim(), task]).filter(([id]) => !!id));
        const depthMemo = new Map();
        const getDepth = (task) => {
            const id = String(task?.id || '').trim();
            if (!id) return 0;
            if (depthMemo.has(id)) return depthMemo.get(id);
            const parentId = String(task?.parentTaskId || '').trim();
            if (!parentId || !taskMap.has(parentId)) {
                depthMemo.set(id, 0);
                return 0;
            }
            const depth = Math.max(0, Math.min(32, getDepth(taskMap.get(parentId)) + 1));
            depthMemo.set(id, depth);
            return depth;
        };
        const prevCollapsedTaskIds = state.collapsedTaskIds instanceof Set ? new Set(state.collapsedTaskIds) : new Set();
        const prevCollapsedGroups = state.collapsedGroups instanceof Set ? new Set(state.collapsedGroups) : new Set();
        let orderedTaskRows = [];
        try {
            state.collapsedTaskIds = new Set();
            state.collapsedGroups = new Set();
            orderedTaskRows = (__tmBuildTaskRowModel() || []).filter((row) => row && row.type === 'task' && row.id);
        } catch (e) {
            orderedTaskRows = filtered.map((task) => ({
                type: 'task',
                id: String(task?.id || '').trim(),
                depth: getDepth(task),
            }));
        } finally {
            state.collapsedTaskIds = prevCollapsedTaskIds;
            state.collapsedGroups = prevCollapsedGroups;
        }
        const exportedTaskIdSet = new Set();
        orderedTaskRows = orderedTaskRows.filter((row) => {
            const id = String(row?.id || '').trim();
            if (!id || exportedTaskIdSet.has(id)) return false;
            exportedTaskIdSet.add(id);
            return true;
        });
        const fixedColumns = [
            { key: '__group', label: '当前分组', wch: 10, value: (_, ctx) => ctx.groupLabel || '' },
            { key: '__depth', label: '层级', wch: 6, value: (_, ctx) => ctx.depth },
            { key: '__done', label: '完成状态', wch: 10, value: (task) => task?.done ? '已完成' : '未完成' },
        ];
        const visibleColumns = __tmExcelGetExportColumnDefs();
        const rows = orderedTaskRows.map((row) => {
            const id = String(row?.id || '').trim();
            const task = taskMap.get(id) || state.flatTasks?.[id] || null;
            if (!task) return null;
            const parentTaskId = String(task?.parentTaskId || '').trim();
            const rootTask = __tmExcelGetVisibleRootTask(task, taskMap) || task;
            return {
                id,
                task,
                depth: Math.max(0, Number(row?.depth) || getDepth(task)),
                groupLabel: __tmExcelGetGroupLabel(task, rootTask),
                parentTaskId,
            };
        }).filter(Boolean);
        return {
            columns: fixedColumns.concat(visibleColumns),
            rows,
        };
    }

    window.tmExportCurrentTableExcel = async function() {
        if (String(state.viewMode || '').trim() !== 'list') {
            hint('⚠️ 仅表格视图支持导出 Excel', 'warning');
            return;
        }
        const cachedXlsx = __tmResolveXlsxRuntime();
        if (!cachedXlsx) hint('⏳ 正在准备 Excel 导出组件...', 'info');
        const XLSX = cachedXlsx || await __tmEnsureXlsxRuntimeLoaded();
        if (!XLSX || !XLSX.utils) {
            hint('❌ Excel 导出组件未加载', 'error');
            return;
        }
        const model = __tmBuildCurrentTableExcelExportModel();
        if (!Array.isArray(model.rows) || model.rows.length === 0) {
            hint('⚠️ 当前没有可导出的任务', 'warning');
            return;
        }
        const columns = Array.isArray(model.columns) ? model.columns : [];
        if (!columns.length) {
            hint('❌ 导出列配置为空', 'error');
            return;
        }
        const aoa = [columns.map((col) => String(col?.label || '').trim())];
        model.rows.forEach((row) => {
            aoa.push(columns.map((col) => {
                const raw = typeof col?.value === 'function' ? col.value(row.task, row) : '';
                if (col?.kind === 'date') {
                    const dt = __tmExcelParseDateCell(raw);
                    return dt || (raw ? String(raw) : '');
                }
                return raw == null ? '' : raw;
            }));
        });
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = columns.map((col) => ({ wch: Math.max(8, Number(col?.wch) || 12) }));
        ws['!rows'] = aoa.map((_, idx) => {
            if (idx === 0) return { level: 0 };
            const depth = Number(model.rows[idx - 1]?.depth) || 0;
            return { level: Math.max(0, Math.min(7, depth)) };
        });
        ws['!outline'] = { above: true };
        if (ws['!ref']) ws['!autofilter'] = { ref: ws['!ref'] };
        columns.forEach((col, colIndex) => {
            if (col?.kind !== 'date') return;
            for (let rowIndex = 1; rowIndex < aoa.length; rowIndex += 1) {
                const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
                const cell = ws[cellRef];
                if (!cell || (cell.t !== 'd' && cell.t !== 'n')) continue;
                cell.z = 'yyyy-mm-dd';
            }
        });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '任务导出');
        const filename = __tmExcelSanitizeFileName(`任务管理器_表格导出_${__tmExcelDateStamp()}.xlsx`);
        if (typeof XLSX.writeFileXLSX === 'function') XLSX.writeFileXLSX(wb, filename, { compression: true, cellStyles: true });
        else XLSX.writeFile(wb, filename, { bookType: 'xlsx', compression: true, cellStyles: true });
        hint(`✅ 已导出 Excel（${model.rows.length} 条任务）`, 'success');
    };

    // 新增：导出当前分组任务
    window.exportCurrentGroup = async function() {
        // 从当前DOM中获取当前选中的分组ID
        const groupSelect = document.getElementById('groupSelector');
        const currentId = groupSelect ? groupSelect.value : (SettingsStore.data.currentGroupId || 'all');

        if (currentId === 'all') {
            hint('⚠️ 请先选择一个分组进行导出', 'error');
            return;
        }

        // 直接从 taskTree 获取当前页签显示的所有文档和任务
        // taskTree 包含了分组开启"包含子文档"后解析的所有子文档
        const docNames = {};
        const flatTasks = state.flatTasks || {};

        if (!Array.isArray(state.taskTree) || state.taskTree.length === 0) {
            hint('⚠️ 当前没有显示的文档', 'error');
            return;
        }

        // 遍历 taskTree 中当前显示的所有文档，获取文档名称
        state.taskTree.forEach(doc => {
            const docId = String(doc?.id || '').trim();
            if (!docId) return;
            docNames[docId] = doc.name || '未命名文档';
        });

        // 直接从 flatTasks 获取所有任务（包括子任务）
        const tasksByDoc = {};

        // 首先获取所有顶级任务（没有 parentTaskId 的）
        Object.values(flatTasks).forEach(task => {
            if (!task || !task.id) return;
            if (task.parentTaskId) return; // 先跳过子任务，稍后处理

            const docId = String(task.docId || task.root_id || '').trim();
            if (!docId || !docNames[docId]) return; // 只处理在当前分组的文档

            if (!tasksByDoc[docId]) {
                tasksByDoc[docId] = [];
            }

            // 添加顶级任务，设置二级标题信息
            const h2Id = task.h2Id || '';
            let h2Name = task.h2 || '';
            if (!h2Name && h2Id) {
                const h2Task = flatTasks[h2Id];
                if (h2Task) h2Name = h2Task.content || '';
            }

            tasksByDoc[docId].push({
                ...task,
                h2Id: h2Id,
                h2Name: h2Name,
                level: 0
            });

            // 递归收集所有子任务
            const collectChildren = (parentTask, parentH2Id, parentH2Name) => {
                const children = parentTask.children || [];
                children.forEach(child => {
                    if (child && child.id) {
                        // 子任务的h2Id使用父级的
                        tasksByDoc[docId].push({
                            ...child,
                            h2Id: parentH2Id,
                            h2Name: parentH2Name,
                            level: 1
                        });
                        // 递归收集更深层的子任务
                        if (child.children && child.children.length > 0) {
                            collectChildren(child, parentH2Id, parentH2Name);
                        }
                    }
                });
            };

            if (task.children && task.children.length > 0) {
                collectChildren(task, h2Id, h2Name);
            }
        });

        // 检查是否有任务
        let totalTasks = 0;
        Object.values(tasksByDoc).forEach(tasks => {
            totalTasks += tasks.length;
        });

        if (totalTasks === 0) {
            hint('⚠️ 当前分组没有任务可导出', 'error');
            return;
        }

        // 获取当前分组名称
        const groups = SettingsStore.data.docGroups || [];
        const group = groups.find(g => g.id === currentId);
        const groupName = group ? __tmResolveDocGroupName(group) : '当前分组';

        // 显示导出设置对话框
        __tmShowExportDialog(groupName, tasksByDoc, docNames);
    };

    // 导出对话框函数
    function __tmShowExportDialog(groupName, tasksByDoc, docNames) {
        // 关闭现有的导出对话框
        if (state.exportModal) {
            try { state.exportModal.remove(); } catch (e) {}
            state.exportModal = null;
        }

        state.exportModal = document.createElement('div');
        state.exportModal.className = 'tm-modal';
        state.exportModal.style.cssText = 'z-index: 200000;';

        const dialog = document.createElement('div');
        dialog.className = 'tm-box';
        dialog.style.cssText = 'width: 480px; max-width: 90vw; height: auto; flex: none;';

        dialog.innerHTML = `
            <div class="tm-header" style="padding: 16px 20px; border-bottom: 1px solid var(--tm-border-color); flex-shrink: 0;">
                <div style="font-size: 16px; font-weight: 600;">导出任务 - ${esc(groupName)}</div>
                <button class="tm-btn tm-btn-gray" data-tm-action="closeExportDialog" style="padding: 4px 8px; font-size: 12px;">✕</button>
            </div>
            <div class="tm-body" style="padding: 20px; flex: 1; overflow-y: auto;">
                <div style="margin-bottom: 16px;">
                    <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">导出格式</div>
                    <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;">
                        <input type="radio" name="exportFormat" value="markdown" checked>
                        <span style="font-size: 13px;">Markdown (推荐 AI 阅读)</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;">
                        <input type="radio" name="exportFormat" value="json">
                        <span style="font-size: 13px;">JSON (结构化数据)</span>
                    </label>
                </div>
                <div style="margin-bottom: 16px;">
                    <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">文件名</div>
                    <input type="text" id="exportFilename" value="${esc(groupName)}_任务导出"
                           style="width: 100%; padding: 8px 12px; border: 1px solid var(--tm-input-border); border-radius: 6px; background: var(--tm-input-bg); color: var(--tm-text-color); font-size: 13px; box-sizing: border-box;">
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" id="exportIncludeDone" checked>
                        <span style="font-size: 13px;">包含已完成任务</span>
                    </label>
                </div>
                <div style="font-size: 12px; color: var(--tm-secondary-text);">
                    共 ${Object.keys(tasksByDoc).length} 个文档，${Object.values(tasksByDoc).reduce((sum, tasks) => sum + tasks.length, 0)} 个任务
                </div>
            </div>
            <div class="tm-header" style="padding: 16px 20px; border-top: 1px solid var(--tm-border-color); justify-content: flex-end; gap: 10px; flex-shrink: 0;">
                <button class="tm-btn tm-btn-secondary" data-tm-action="closeExportDialog" style="padding: 8px 16px;">取消</button>
                <button class="tm-btn tm-btn-primary" data-tm-action="confirmExport" style="padding: 8px 16px;">导出</button>
            </div>
        `;

        state.exportModal.appendChild(dialog);
        document.body.appendChild(state.exportModal);

        // 绑定事件
        const root = state.exportModal;
        root.addEventListener('click', async (e) => {
            const target = e.target?.closest?.('[data-tm-action]');
            if (!target) return;

            const action = String(target.dataset.tmAction || '');
            if (action === 'closeExportDialog') {
                try { state.exportModal.remove(); } catch (e) {}
                state.exportModal = null;
            } else if (action === 'confirmExport') {
                const format = document.querySelector('input[name="exportFormat"]:checked')?.value || 'markdown';
                const filename = document.getElementById('exportFilename')?.value || groupName;
                const includeDone = document.getElementById('exportIncludeDone')?.checked !== false;

                // 执行导出
                __tmDoExport(groupName, tasksByDoc, docNames, format, filename, includeDone);

                try { state.exportModal.remove(); } catch (e) {}
                state.exportModal = null;
            }
        });
    }

    // 执行导出
    function __tmDoExport(groupName, tasksByDoc, docNames, format, filename, includeDone) {
        let content = '';
        let mimeType = 'text/plain';
        let extension = 'txt';

        if (format === 'markdown') {
            content = __tmGenerateMarkdownExport(groupName, tasksByDoc, docNames, includeDone);
            mimeType = 'text/markdown';
            extension = 'md';
        } else {
            content = __tmGenerateJSONExport(tasksByDoc, docNames, includeDone);
            mimeType = 'application/json';
            extension = 'json';
        }

        // 下载文件
        const blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        hint('✅ 任务导出成功', 'success');
    }

    // 生成 Markdown 格式导出
    function __tmGenerateMarkdownExport(groupName, tasksByDoc, docNames, includeDone) {
        const lines = [];
        const now = new Date().toISOString().split('T')[0];

        lines.push(`# ${groupName} - 任务导出`);
        lines.push('');
        lines.push(`> 导出时间：${now}`);
        lines.push('');

        // 按文档分组
        Object.entries(tasksByDoc).forEach(([docId, tasks]) => {
            // 过滤任务
            let filteredTasks = tasks;
            if (!includeDone) {
                filteredTasks = tasks.filter(t => !t.done);
            }

            if (filteredTasks.length === 0) return;

            const docName = docNames[docId] || '未命名文档';
            lines.push(`## 📄 ${docName}`);
            lines.push('');

            // 按二级文档分组
            const tasksByH2 = {};
            filteredTasks.forEach(task => {
                const h2Key = task.h2Id || '__no_h2__';
                const h2Name = task.h2Name || '无二级标题';
                if (!tasksByH2[h2Key]) {
                    tasksByH2[h2Key] = {
                        name: h2Name,
                        tasks: []
                    };
                }
                tasksByH2[h2Key].tasks.push(task);
            });

            // 输出任务
            Object.values(tasksByH2).forEach(h2Group => {
                if (h2Group.name !== '无二级标题') {
                    lines.push(`### ${h2Group.name}`);
                    lines.push('');
                }

                h2Group.tasks.forEach(task => {
                    const checkbox = task.done ? '[x]' : '[ ]';

                    // 根据层级计算缩进
                    const level = task.level || 0;
                    const indent = '  '.repeat(level + 1); // 顶级任务2空格，子任务4空格

                    // 任务内容行
                    let line = `${indent}- ${checkbox} ${task.content || '无内容'}`;

                    // 添加标签信息
                    const tags = [];
                    if (task.priority) {
                        const priorityText = task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : task.priority === 'low' ? '低' : task.priority;
                        tags.push(`**优先级：${priorityText}**`);
                    }
                    if (task.startDate) {
                        tags.push(`📅 开始：${task.startDate}`);
                    }
                    if (task.completionTime) {
                        tags.push(`🎯 截止：${task.completionTime}`);
                    }
                    if (task.done && task.completionTime) {
                        tags.push(`✨ 已完成：${task.completionTime}`);
                    }
                    if (task.status) {
                        tags.push(`📌 状态：${task.status}`);
                    }

                    if (tags.length > 0) {
                        line += ` ${tags.join(' | ')}`;
                    }

                    lines.push(line);

                    // 添加备注（如果存在）
                    if (task.remark) {
                        lines.push(`${indent}  > 备注：${task.remark}`);
                    }
                });

                lines.push('');
            });
        });

        // 添加汇总信息
        const totalTasks = Object.values(tasksByDoc).reduce((sum, tasks) => sum + tasks.length, 0);
        const doneTasks = Object.values(tasksByDoc).reduce((sum, tasks) => sum + tasks.filter(t => t.done).length, 0);
        const pendingTasks = totalTasks - doneTasks;

        lines.push('---');
        lines.push('');
        lines.push('## 📊 汇总统计');
        lines.push('');
        lines.push(`- 总任务数：${totalTasks}`);
        lines.push(`- 已完成：${doneTasks}`);
        lines.push(`- 待完成：${pendingTasks}`);
        lines.push(`- 完成率：${totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0}%`);
        lines.push('');

        return lines.join('\n');
    }

    // 生成 JSON 格式导出
    function __tmGenerateJSONExport(tasksByDoc, docNames, includeDone) {
        const exportData = {
            exportTime: new Date().toISOString(),
            documents: []
        };

        Object.entries(tasksByDoc).forEach(([docId, tasks]) => {
            let filteredTasks = tasks;
            if (!includeDone) {
                filteredTasks = tasks.filter(t => !t.done);
            }

            if (filteredTasks.length === 0) return;

            const docData = {
                docId: docId,
                docName: docNames[docId] || '未命名文档',
                tasks: filteredTasks.map(task => ({
                    content: task.content || '',
                    done: !!task.done,
                    priority: task.priority || null,
                    status: task.status || null,
                    startDate: task.startDate || null,
                    completionTime: task.completionTime || null,
                    duration: task.duration || null,
                    remark: task.remark || null,
                    h2Id: task.h2Id || null,
                    h2Name: task.h2Name || null,
                    id: task.id || null
                }))
            };

            exportData.documents.push(docData);
        });

        // 添加统计信息
        const totalTasks = exportData.documents.reduce((sum, doc) => sum + doc.tasks.length, 0);
        const doneTasks = exportData.documents.reduce((sum, doc) => sum + doc.tasks.filter(t => t.done).length, 0);
        exportData.stats = {
            total: totalTasks,
            done: doneTasks,
            pending: totalTasks - doneTasks,
            completionRate: totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0
        };

        return JSON.stringify(exportData, null, 2);
    };

    // 新增：清空当前分组文档
