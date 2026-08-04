'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const gantt = read('src/task-horizon/main/shell/82-gantt-runtime.js');
const render = read('src/task-horizon/main/40-render-runtime.js');
const viewHostPolicies = read('src/task-horizon/main/31-view-host-policies.js');
const scene = read('src/task-horizon/main/render/41-render-scene-context.js');
const body = read('src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js');
const checklistBody = read('src/task-horizon/main/render/42-render-list-and-checklist-body.js');
const localTaskTimeRefresh = read('src/task-horizon/main/render/46-render-local-task-time-refresh.js');
const resizeControls = read('src/task-horizon/main/render/45-render-shell-controls-and-resize.js');
const interactions = read('src/task-horizon/main/render/49-render-whiteboard-interactions.js');
const services = read('src/task-horizon/main/20-api-and-runtime-services.js');
const refreshRuntime = read('src/task-horizon/main/render/39-render-doc-group-sync-and-refresh.js');
const calendarSupport = read('src/task-horizon/main/render/48-render-calendar-support-runtime.js');
const taskRuntime = read('src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js');
const taskDetailLoader = read('src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js');
const icons = read('src/task-horizon/main/30-dialogs-and-ui-foundation.js');
const stores = read('src/task-horizon/main/10-stores-rules-and-cache.js');
const columnSettings = read('src/task-horizon/main/settings/62-settings-columns-and-rules.js');
const calendarView = read('calendar-view.js');
const styles = read('task-horizon.css');

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

const timelinePaneLayoutSource = segment(body, 'function __tmResolveTimelinePaneLayout', 'function __tmBuildRenderSceneTimelineBodyHtml');
const resolveTimelinePaneLayout = new Function(`${timelinePaneLayoutSource}; return __tmResolveTimelinePaneLayout;`)();
assert.deepEqual(resolveTimelinePaneLayout(900, 540, 1440), { width: 540, minWidth: 320, maxWidth: 540, tableWidth: 540 }, 'timeline panes must never grow beyond their rendered table');
assert.deepEqual(resolveTimelinePaneLayout(900, 980, 1024), { width: 598, minWidth: 320, maxWidth: 598, tableWidth: 980 }, 'desktop panes must reserve 420px plus the splitter for the timeline');
assert.deepEqual(resolveTimelinePaneLayout(100, 280, 0), { width: 280, minWidth: 280, maxWidth: 280, tableWidth: 280 }, 'narrow future column sets must not create a fixed-width blank pane');
assert.match(body, /data-tm-table-width="\$\{leftTableWidth\}"/, 'rendered timeline tables must publish their computed multi-column width');
assert.match(resizeControls, /__tmResolveTimelinePaneLayout\([\s\S]*tableWidth[\s\S]*containerWidth/, 'splitter dragging must reuse the shared pane constraints');
assert.doesNotMatch(resizeControls, /startWidth \+ dx\)\)\);[\s\S]{0,160}Math\.min\(900/, 'splitter dragging must not retain the obsolete fixed 900px cap');
assert.match(body, /role="separator"[\s\S]*tabindex="0"[\s\S]*tmTimelineSplitResizeKeydown/, 'the desktop splitter must expose keyboard interaction');
assert.match(resizeControls, /window\.tmTimelineSplitResizeKeydown[\s\S]*ArrowLeft[\s\S]*ArrowRight[\s\S]*__tmApplyTimelinePaneLayout/, 'keyboard resizing must use the same constrained pane layout');
assert.match(resizeControls, /function __tmGetTimelinePaneConstraintWidth[\s\S]*tm-modal--dock[\s\S]*tm-modal--mobile[\s\S]*return 0;/, 'Dock and mobile timelines must not inherit the desktop chart-width constraint');
assert.match(styles, /\.tm-timeline-splitter:focus-visible::before \{[\s\S]*background: var\(--tm-primary-color\);/, 'the keyboard-focusable splitter must use the existing SiYuan focus color');
assert.match(body, /tm-timeline-scrollbar[\s\S]*tm-timeline-scrollbar-thumb/, 'timeline views must render the floating vertical scrollbar shell');
assert.match(icons, /function __tmBindTimelineScrollVisibility[\s\S]*__tmGetTimelineGlobalScrollHost\(modal\) \|\| ganttBody[\s\S]*__tmBindVerticalScrollVisibility/, 'timeline scrolling must reuse the existing floating scrollbar binder');
assert.match(services, /__tmBindTimelineScrollVisibility\(modal\)/, 'timeline stage setup must bind its floating vertical scrollbar');
const timelineStageInteractions = segment(services, 'function __tmBindTimelineStageInteractions', 'function __tmRerenderTimelineInPlace');
assert.match(timelineStageInteractions, /syncTimelineTaskHover[\s\S]*#tmTimelineLeftTable tbody tr\[data-id=[\s\S]*#tmGanttBody \.tm-gantt-row\[data-id=[\s\S]*tm-timeline-task-row--hovered/, 'timeline task hover must synchronize the matching table and gantt rows');
assert.match(timelineStageInteractions, /onTimelinePointerOver[\s\S]*pointerType[\s\S]*touch[\s\S]*onTimelinePointerOut[\s\S]*pointerType[\s\S]*touch/, 'timeline hover synchronization must not create touch hover state');
assert.match(timelineStageInteractions, /\[leftBody, ganttBody\]\.forEach[\s\S]*bind\(pane, 'pointerover'[\s\S]*bind\(pane, 'pointerout'/, 'timeline hover synchronization must use one delegated pointer binding per pane');
assert.match(styles, /#tmTimelineLeftTable tbody tr\.tm-timeline-task-row--hovered[\s\S]*background-color: var\(--tm-table-row-hover-bg\)[\s\S]*\.tm-gantt-row\.tm-timeline-task-row--hovered[\s\S]*background: var\(--tm-table-row-hover-bg\)/, 'timeline table and gantt rows must reuse the table-view hover color');
assert.match(checklistBody, /class="tm-table-scrollbar"><div class="tm-table-scrollbar-thumb"/, 'table view must retain its floating vertical scrollbar shell');
assert.match(styles, /\.tm-list-pane > \.tm-body\.tm-body--list \{[^}]*scrollbar-gutter: auto;/, 'table view must not reserve a native vertical scrollbar gutter');
assert.match(styles, /\.tm-body\.tm-body--list::\-webkit-scrollbar \{[^}]*width: 0;[^}]*height: 6px;/, 'table view must hide its native vertical scrollbar while preserving horizontal scrolling');
assert.match(styles, /\.tm-timeline-right-body \{[^}]*scrollbar-gutter: auto;/, 'desktop timeline view must not reserve a native vertical scrollbar gutter');
assert.match(styles, /\.tm-timeline-right-body::\-webkit-scrollbar \{[^}]*width: 0;/, 'desktop timeline native vertical scrollbar must not consume horizontal space');
assert.match(styles, /\.tm-body--timeline-compact \.tm-timeline-scroll-host \{[^}]*scrollbar-gutter: auto;/, 'compact timeline view must not reserve a native vertical scrollbar gutter');
assert.match(styles, /\.tm-modal\.tm-modal--mobile \.tm-body\.tm-body--timeline-compact,[\s\S]*overflow-y: hidden;[\s\S]*\.tm-modal\.tm-modal--mobile \.tm-body\.tm-body--timeline-compact::\-webkit-scrollbar,[\s\S]*display: none;/, 'compact timeline shells must not become a second visible vertical scroll surface');

assert.match(stores, /__TM_TIMELINE_DEFAULT_COLUMN_ORDER = Object\.freeze\(\['content', 'startDate', 'completionTime'\]\)/, 'timeline columns must retain the current three-column default');
assert.match(stores, /function __tmNormalizeTimelineColumnOrder[\s\S]*__tmGetKnownColumnKeys\(\)[\s\S]*if \(out\.length\) return out;[\s\S]*__TM_TIMELINE_DEFAULT_COLUMN_ORDER\.filter/, 'timeline column order must deduplicate known columns and recover from an empty configuration');
assert.match(stores, /timelineColumnOrder: __TM_TIMELINE_DEFAULT_COLUMN_ORDER\.slice\(\)/, 'timeline columns must have their own settings state');
assert.match(stores, /cloudData\.timelineColumnOrder[\s\S]*tm_timeline_column_order[\s\S]*Storage\.set\('tm_timeline_column_order'/, 'timeline column order must round-trip through cloud and local settings');
const customFieldLoadPlan = segment(stores, 'function __tmCollectCustomFieldLoadPlan', 'function __tmNormalizeCustomFieldIdList');
assert.match(customFieldLoadPlan, /viewMode === 'timeline'[\s\S]*__tmGetTimelineColumnOrder\(\)/, 'timeline-only custom columns must participate in custom-field loading');
const timelineColumnShell = segment(body, 'function __tmBuildTimelineColumnShellHtml', 'function __tmResolveTimelinePaneLayout');
assert.match(timelineColumnShell, /scope: 'timeline'/, 'timeline headers must retain timeline-scoped column actions');
const timelineColumnActions = segment(columnSettings, 'async function __tmApplyTimelineColumnOrder', 'window.tmShowColumnHeaderContextMenu');
assert.match(timelineColumnActions, /SettingsStore\.data\.timelineColumnOrder = normalizedOrder/, 'timeline column actions must write the timeline-specific order');
assert.doesNotMatch(timelineColumnActions, /SettingsStore\.data\.columnOrder\s*=/, 'timeline column actions must not mutate normal table order');
assert.match(timelineColumnActions, /if \(order\.length <= 1\)[\s\S]*至少需要保留一列/, 'timeline column actions must preserve at least one visible column');
const timelineColumnMenu = segment(columnSettings, 'window.tmShowColumnHeaderContextMenu', '// 更新列宽度');
assert.match(timelineColumnMenu, /scope === 'timeline'[\s\S]*向左移动[\s\S]*向右移动[\s\S]*显示列[\s\S]*__tmGetAllColumnDefs\(\)[\s\S]*管理自定义列/, 'timeline headers must expose ordered column selection in their right-click menu');
assert.match(body, /const timelineColumnOrder = __tmGetEffectiveCustomFieldColumnOrder\(__tmGetTimelineColumnOrder\(\), state\.filteredTasks\)[\s\S]*__tmGetTableWidthLayout\(timelineColumnOrder, timelineWidthMap, 0\)/, 'timeline table width must derive from its effective scoped columns');
const timelineTaskCells = segment(body, 'function __tmRenderTimelineTaskCellsHtml', 'function __tmResolveTimelinePaneLayout');
assert.match(timelineTaskCells, /columnOrder\.forEach\(\(columnKey\) => \{[\s\S]*case 'content':[\s\S]*case 'startDate':[\s\S]*customColumnsByKey\.get\(columnKey\)/, 'the shared timeline row renderer must support built-in and custom cells from the independent order');
const renderTimelineTaskCells = new Function(`
    const __tmResolveTaskStatusDisplayOption = () => ({ name: '进行中', color: '#757575' });
    const __tmBuildStatusChipStyle = () => '';
    const __tmGetTaskRemainingTimeInfo = () => null;
    const __tmFormatTaskCompletedAtTime = (value) => String(value || '');
    const __tmResolveTaskCompletedAtRaw = (task) => task.taskCompleteAt;
    const __tmRenderPriorityJira = (value) => String(value || '');
    const __tmFormatTaskTime = (value) => String(value || '');
    const esc = (value) => String(value ?? '');
    ${timelineTaskCells}
    return __tmRenderTimelineTaskCellsHtml;
`)();
const sixColumnTimelineRow = renderTimelineTaskCells({
    id: 'task-1',
    startDate: '2026-07-29',
    completionTime: '2026-07-30',
    taskCompleteAt: '2026-07-30 12:00',
    priority: 'A',
}, {
    columnOrder: ['content', 'startDate', 'completionTime', 'taskCompleteAt', 'status', 'priority'],
    customColumnsByKey: new Map(),
    getCellStyle: () => '',
    statusOptions: [],
    contentHtml: '<div>任务</div>',
});
assert.equal((sixColumnTimelineRow.match(/<td\b/g) || []).length, 6, 'a six-column timeline refresh must render six task cells');
assert.match(sixColumnTimelineRow, /data-tm-task-time-field="taskCompleteAt"[\s\S]*data-tm-field="status"[\s\S]*data-tm-field="priority"/, 'completion, status, and priority cells must survive a dynamic-row refresh');
assert.match(body, /__tmRenderTimelineTaskCellsHtml\(task, \{[\s\S]*columnOrder: timelineColumnOrder,[\s\S]*customColumnsByKey: timelineCustomColumnsByKey/, 'initial timeline rows must use the shared dynamic-column renderer');
assert.match(body, /timelineHeaderHtml[\s\S]*colspan="\$\{timelineColumnCount\}"/, 'timeline headers and spanning rows must use the dynamic column count');
const timelineLocalRerender = segment(services, 'function __tmRerenderTimelineInPlace', 'window.tmTimelineLoadMoreRows');
assert.match(timelineLocalRerender, /const timelineColumnOrder = __tmGetEffectiveCustomFieldColumnOrder\(__tmGetTimelineColumnOrder\(\), state\.filteredTasks\)[\s\S]*__tmGetTableWidthLayout\(timelineColumnOrder,[\s\S]*__tmRenderTimelineTaskCellsHtml\(task, \{[\s\S]*columnOrder: timelineColumnOrder/, 'in-place timeline refreshes must rebuild task rows from the effective scoped columns');
assert.match(timelineLocalRerender, /renderedTimelineColumnOrder[\s\S]*timelineColumnStructureChanged[\s\S]*appendOnly = requestedAppendOnly && !timelineColumnStructureChanged[\s\S]*reuseLeftRows = requestedReuseLeftRows && !timelineColumnStructureChanged/, 'timeline row reuse and append paths must fall back to rebuilding when the effective column structure changes');
assert.match(timelineLocalRerender, /const rowModel = timelineColumnStructureChanged && requestedAppendOnly \? rangeRowModel : requestedRowModel/, 'a column change during append must rebuild from the full timeline row model');
assert.match(timelineLocalRerender, /colspan="\$\{timelineColumnCount\}"/, 'in-place timeline group and empty rows must span the active column count');
assert.doesNotMatch(timelineLocalRerender, /colspan="3"/, 'in-place timeline refreshes must not retain the obsolete three-column span');
const timelineWidthSync = segment(services, 'function __tmSyncTimelineDateColumnWidths', 'function __tmBindTimelineLeftCollapseInteractions');
assert.match(timelineWidthSync, /const columnOrder = __tmGetTimelineColumnOrder\(\)[\s\S]*__tmGetTableWidthLayout\(columnOrder,[\s\S]*columnOrder\.forEach\(\(columnKey, index\)/, 'timeline width refreshes must reuse the table-view layout for every selected column');
assert.match(timelineWidthSync, /tableLayout\.resolvedTotal \+ 2[\s\S]*colgroup col[\s\S]*thead th[\s\S]*tbody tr\[data-id\]/, 'timeline width refreshes must keep the table, colgroup, headers, and task cells aligned');
assert.doesNotMatch(timelineWidthSync, /contentW \+ startW \+ endW|nth-child\([123]\)|cells\[[012]\]/, 'timeline width refreshes must not squeeze additional columns into the obsolete three-column width');
assert.match(resizeControls, /const initialTableWidth[\s\S]*initialTableWidth - startW \+ next/, 'timeline content resizing must preserve the widths of every other selected column');
assert.match(resizeControls, /timelineTable = th\.closest\('#tmTimelineLeftTable'\)[\s\S]*timelineTableWidth[\s\S]*__tmApplyTimelinePaneLayout[\s\S]*if \(isTimeline\) render\(\)/, 'resizing any additional timeline column must update the table and pane constraints immediately');

const scaleConfig = segment(gantt, 'const TIMELINE_SCALE_ORDER', 'function parseDateOnlyToTs');
assert.match(scaleConfig, /TIMELINE_SCALE_ORDER = \['day', 'week', 'month'\]/, 'timeline must expose only day, week, and month scales');
assert.doesNotMatch(scaleConfig, /year:\s*Object\.freeze/, 'year must not become a selectable scale');
assert.match(scaleConfig, /zoomWidths: Object\.freeze\(\[28, 32, 36, 40, 44\]\), snapDays: 1/, 'day scale must keep the approved zoom levels');
assert.match(scaleConfig, /zoomWidths: Object\.freeze\(\[84, 98, 112, 126\]\), snapDays: 1/, 'week scale must use weekly zoom levels while retaining daily edits');
assert.match(scaleConfig, /zoomWidths: Object\.freeze\(\[80, 92, 104, 116, 128\]\), snapDays: 7/, 'month scale must use the approved zoom levels and seven-day drag snapping');
assert.match(scaleConfig, /const dayWidth = unitWidth \/ config\.unitDays;/, 'all scales must share the existing linear daily coordinate');
assert.match(scaleConfig, /TIMELINE_MIN_RESIZE_WIDTH_PX = 22;/, 'timeline resizing must share the card pointer target minimum width');
assert.match(scaleConfig, /windowDays: 397[\s\S]*windowDays: 1095[\s\S]*windowDays: 2192/, 'each scale must use a bounded rolling render window');
assert.match(scaleConfig, /snapDays: config\.snapDays,[\s\S]*windowDays: config\.windowDays,/, 'resolved scale state must expose its rolling window size');

const milestoneLayout = segment(gantt, 'function resolveTimelineMilestoneLayout', 'function buildTimelineMilestoneHtml');
assert.match(milestoneLayout, /Math\.max\(TIMELINE_MIN_RESIZE_WIDTH_PX,[\s\S]*left: centerLeft - \(width \* 0\.5\)/, 'milestones must stay centered on their date and retain the shared card minimum width');
const resolveTimelineMilestoneLayout = new Function(`const TIMELINE_MIN_RESIZE_WIDTH_PX = 22; ${milestoneLayout}; return resolveTimelineMilestoneLayout;`)();
assert.deepEqual(resolveTimelineMilestoneLayout({ left: 100, width: 2.6, dayWidth: 2.6, startTs: 10, endTs: 20 }), { left: 89, width: 22, dayWidth: 2.6, startTs: 20, endTs: 20 }, 'low-zoom milestones must preserve their date center while expanding to the card minimum width');
assert.match(gantt, /function buildTimelineMilestoneHtml\(task, layout\) \{[\s\S]*buildTimelineTaskBarHtml\(task, resolveTimelineMilestoneLayout\(layout\)\)/, 'full milestone renders must use the shared minimum-width layout');
assert.match(gantt, /resolveTimelineMilestoneLayout,[\s\S]*buildTimelineMilestoneHtml,/, 'local timeline updates must be able to reuse milestone geometry');
const localTimelineUpdate = segment(localTaskTimeRefresh, 'function __tmUpdateTimelineTaskInDOM', 'function __tmCanUpdateTaskTimeInListLike');
assert.match(localTimelineUpdate, /view\.resolveTimelineMilestoneLayout\?\.\(\{[\s\S]*left: milestoneLeft,[\s\S]*width: dayWidth0,[\s\S]*if \(!milestoneBarLayout\) return false;/, 'in-place milestone conversion must use the same centered minimum-width layout as a full render');
assert.doesNotMatch(localTimelineUpdate, /left: milestoneLeft - \(dayWidth0 \* 0\.5\)/, 'in-place milestone conversion must not pre-offset the date center before shared layout resolution');

const rangeHelpers = segment(gantt, 'function setTimelineRange', 'function isSameCalendarDay');
assert.match(rangeHelpers, /requestedDays > dayCount[\s\S]*TIMELINE_MAX_DAY_COUNT/, 'rolling ranges must keep a hard DOM-size ceiling');
assert.match(rangeHelpers, /shiftDays = Math\.max\(28, Math\.round\(dayCount \* 0\.3\)\)/, 'edge navigation must move the existing window instead of growing it');
assert.match(rangeHelpers, /viewState\.rangeScale = scale[\s\S]*viewState\.rangeStartTs = start[\s\S]*viewState\.rangeEndTs = end/, 'the render window must remain runtime view state');

const collectRangeItemsSource = segment(gantt, 'function collectTimelineRangeItems', 'function setTimelineRange');
const timelineGroupEntitySource = segment(services, 'function __tmGetTimelineGroupEntity', 'function __tmRenderTimelineRangeGroupRowHtml');
const getTimelineGroupEntity = new Function('__tmIsOtherBlockTabId', '__tmNormalizeHeadingLevel', 'SettingsStore', `
    ${timelineGroupEntitySource}
    return __tmGetTimelineGroupEntity;
`)(() => false, (value) => String(value || 'h2'), { data: { taskHeadingLevel: 'h2' } });
const collectRangeItems = new Function('__tmGetTimelineGroupEntity', `${collectRangeItemsSource}; return collectTimelineRangeItems;`)(getTimelineGroupEntity);
assert.deepEqual(collectRangeItems([
    { type: 'task', id: 'task-1' },
    { type: 'group', kind: 'doc', docId: 'doc-range', label: '文档', timelineRange: { state: 'range', startDate: '2026-08-01', deadline: '2026-08-03' } },
    { type: 'group', kind: 'doc', docId: 'doc-start', label: '文档', timelineRange: { state: 'start', startDate: '2026-08-04', deadline: '' } },
    { type: 'group', kind: 'heading', headingId: 'ignored-kind', timelineRange: { state: 'range', startDate: '2026-08-01', deadline: '2026-08-02' } },
    { type: 'group', kind: 'h2', headingId: 'heading-deadline', headingLevel: 'h3', label: '三级标题', timelineRange: { state: 'deadline', startDate: '', deadline: '2026-08-05' } },
    { type: 'group', kind: 'h2', headingId: '__none__', headingLevel: 'h3', label: '无三级标题', timelineRange: { state: 'range', startDate: '2026-08-01', deadline: '2026-08-05' } },
    { type: 'group', kind: 'doc', docId: 'doc-invalid', label: '文档', timelineRange: { state: 'invalid', startDate: '2026-08-09', deadline: '2026-08-01' } },
], (id) => id === 'task-1' ? { id, startDate: '2026-07-31', completionTime: '2026-08-01' } : null), [
    { id: 'task-1', startDate: '2026-07-31', completionTime: '2026-08-01' },
    { entityKind: 'doc', entityId: 'doc-range', startDate: '2026-08-01', completionTime: '2026-08-03' },
    { entityKind: 'doc', entityId: 'doc-start', startDate: '2026-08-04', completionTime: '' },
    { entityKind: 'heading', entityId: 'heading-deadline', startDate: '', completionTime: '2026-08-05' },
], 'range collection must include document and real heading dates while ignoring synthetic and invalid groups');
assert.equal(getTimelineGroupEntity({ type: 'group', kind: 'h2', headingId: '__none__' }), null, 'synthetic no-heading groups must never become persistent timeline entities');
assert.equal(getTimelineGroupEntity({ type: 'group', kind: 'h2', headingId: 'heading-1', headingLevel: 'h4', label: '标题', timelineRange: {} }).headingLevel, 'h4', 'heading entities must carry the configured heading level');

const timelineRangeMetaSource = segment(services, 'function __tmBuildTimelineRangeMeta', 'function __tmGetTimelineGroupEntity');
const buildTimelineRangeMeta = new Function('meta', `
    const __tmGetCachedDocExpectedMeta = () => meta;
    const __tmNormalizeDocExpectedMeta = (value) => ({ startDate: String(value?.startDate || ''), deadline: String(value?.deadline || '') });
    const __tmIsDocExpectedRangeInvalid = (value) => !!(value.startDate && value.deadline && value.startDate > value.deadline);
    ${timelineRangeMetaSource}
    return __tmBuildTimelineRangeMeta('block');
`);
assert.equal(buildTimelineRangeMeta({ startDate: '2026-08-01', deadline: '2026-08-03' }).state, 'range', 'complete group dates must map to a range card');
assert.equal(buildTimelineRangeMeta({ startDate: '2026-08-01', deadline: '' }).state, 'start', 'a start-only group must map to a start marker');
assert.equal(buildTimelineRangeMeta({ startDate: '', deadline: '2026-08-03' }).state, 'deadline', 'a deadline-only group must map to a deadline marker');
assert.equal(buildTimelineRangeMeta({ startDate: '2026-08-03', deadline: '2026-08-01' }).state, 'invalid', 'historical inverted ranges must remain warning-only');
assert.equal(buildTimelineRangeMeta(null).state, 'empty', 'groups without cached dates must retain the independent group label');

const groupDatePatch = segment(services, 'async function __tmSaveTimelineBlockDatePatch', 'async function __tmSaveDocExpectedMetaPatch');
assert.match(groupDatePatch, /await __tmLoadDocExpectedMeta\(id\)[\s\S]*__tmIsDocExpectedRangeInvalid\(next\)[\s\S]*TM_INVALID_DOC_DATE_RANGE[\s\S]*setAttrs\(id, attrs\)[\s\S]*__tmRememberDocExpectedMeta\(id, next\)/, 'group date patches must validate the merged range and update both attributes and cache atomically');
assert.match(services, /function __tmSaveDocExpectedMetaField[\s\S]*__tmSaveTimelineBlockDatePatch\(docId, \{ \[key\]: value \}\)/, 'legacy document context-menu actions must delegate to the atomic block patch');
assert.match(services, /function __tmScheduleTimelineGroupRangeMetaWarmup[\s\S]*__tmGetTimelineGroupEntity\(row\)[\s\S]*__tmLoadDocExpectedMetaBatch\(ids, force\)[\s\S]*rangeScale = ''[\s\S]*reuseLeftRows: false/, 'missing document and heading metadata must batch once and redraw while preserving the viewport anchor');
assert.match(services, /const hasExplicitRowModel = Array\.isArray\(opts\.rowModel\);[\s\S]*const requestedRowModel = hasExplicitRowModel \? opts\.rowModel : __tmBuildTaskRowModel\(\);[\s\S]*if \(!hasExplicitRowModel\) state\.__tmTimelineFullRowModel = requestedRowModel;[\s\S]*__tmScheduleTimelineGroupRangeMetaWarmup\(requestedRowModel\)/, 'expanding a document in place must warm newly visible heading metadata while full redraws refresh the cached row model');
assert.match(refreshRuntime, /!silent && mode === 'timeline' && state\.groupByDocName[\s\S]*__tmGetTimelineGroupEntity\(row\)[\s\S]*__tmLoadDocExpectedMetaBatch\(groupEntityIds, true\)/, 'explicit timeline refresh must force group metadata refresh');
assert.match(taskRuntime, /kind: 'doc'[\s\S]*timelineRange: __tmBuildTimelineRangeMeta\(docId\)[\s\S]*kind: 'h2'[\s\S]*headingLevel,[\s\S]*timelineRange: __tmBuildTimelineRangeMeta\(headingId\)/, 'document and heading rows must expose the same compact range adapter and configured heading level');
assert.match(scene, /__tmScheduleTimelineGroupRangeMetaWarmup\(__tmTimelineFullRowModel\)/, 'timeline entry must preheat missing group dates from the full row model');
assert.match(gantt, /rangeItems = collectTimelineRangeItems\(rangeRowModel, getTaskById\)[\s\S]*resolveTimelineRenderRange\(rangeItems/, 'initial timeline range must use the shared task and group collector');
assert.match(render, /view\.collectRangeItems\(rowModel,[\s\S]*computeRangeTs\(tasks, paddingDays/, 'fit-range must use the same task and group collector');
assert.match(gantt, /groupEntity && \['range', 'start', 'deadline'\]\.includes\(timelineState\)\) return ''/, 'a visible group range must replace the collapsed sticky group name');
assert.match(gantt, /markerClass = isMarker \? ` tm-gantt-group-marker tm-gantt-group-marker--\$\{visual\.state\}`[\s\S]*tm-gantt-bar tm-gantt-bar--group-range/, 'document and heading ranges must share the existing card coordinate geometry');
const timelineDurationMetaSource = segment(gantt, 'function resolveTimelineDurationMeta', 'function buildTimelineDurationBadgeHtml');
const resolveTimelineDurationMeta = new Function(`const DAY_MS = 86400000; ${timelineDurationMetaSource}; return resolveTimelineDurationMeta;`)();
assert.deepEqual(resolveTimelineDurationMeta(0, 0), { days: 1, label: '1', accessibleLabel: '共1天' }, 'same-day cards must display one inclusive day');
assert.equal(resolveTimelineDurationMeta(0, 86400000).label, '2', 'two occupied date cells must display two days');
assert.equal(resolveTimelineDurationMeta(0, 29 * 86400000).label, '30', 'thirty days must remain a unitless day count');
assert.equal(resolveTimelineDurationMeta(0, 30 * 86400000).label, '1个月1天', 'thirty-one days must cross the fixed thirty-day month boundary');
assert.equal(resolveTimelineDurationMeta(0, 59 * 86400000).label, '2个月', 'exact fixed-month durations must omit a zero-day remainder');
assert.equal(resolveTimelineDurationMeta(0, 109 * 86400000).label, '3个月20天', 'month labels must retain their remaining days');
const timelineTaskBarInnerHtml = segment(gantt, 'function buildTimelineTaskBarInnerHtml', 'function buildTimelineTaskBarTitle');
assert.match(timelineTaskBarInnerHtml, /visual\.isMilestone[\s\S]*__tmRenderLucideIcon\('flag'[\s\S]*buildTimelineDurationBadgeHtml\(layout\?\.startTs, layout\?\.endTs\)/, 'ordinary task cards must replace their leading icon with the always-visible duration badge while milestones retain the flag');
assert.doesNotMatch(timelineTaskBarInnerHtml, /circle-check-big|blocks/, 'ordinary timeline cards must not retain the obsolete circular lead icons');
assert.match(gantt, /durationWidth = durationLen[\s\S]*resolveTimelineBarLayout\(layout\?\.width, layout\?\.dayWidth, visual, durationLabel\)/, 'task card layout estimates must include the rendered duration label width');
const timelineGroupBarHtml = segment(gantt, 'function buildTimelineGroupBarHtml', 'function applyTimelineGroupBarElement');
assert.doesNotMatch(timelineGroupBarHtml, /<div class="tm-gantt-bar[^>]*tm-gantt-bar--group-range[^>]*data-tm-group-range-trigger/, 'clicking the group timeline card body must not open the date editor');
assert.match(timelineGroupBarHtml, /<button class="tm-gantt-bar__menu-btn"[^>]*data-tm-group-range-trigger/, 'the group timeline date editor must remain available from the card icon');
assert.match(timelineGroupBarHtml, /tm-gantt-bar__title[^>]*>\$\{esc\(visual\.title\)\}<\/span>\$\{durationHtml\}<button class="tm-gantt-bar__menu-btn"/, 'document and heading cards must place the shared duration badge after the title and before the date button');
const applyTimelineGroupBar = segment(gantt, 'function applyTimelineGroupBarElement', 'function buildTimelineOffscreenNavHtml');
assert.match(applyTimelineGroupBar, /querySelector\('\[data-tm-duration-badge\]'\)[\s\S]*textContent = duration\.label[\s\S]*setAttribute\('aria-label', duration\.accessibleLabel\)/, 'group drag and resize frames must update the existing duration badge without rebuilding the card');
assert.match(gantt, /const groupRangeTrigger = target\.closest\('\[data-tm-group-range-trigger\]'\)/, 'only explicit group date controls may open the date editor');
assert.match(gantt, /visual\.state === 'range' && layout\?\.showHandles !== false[\s\S]*showHandles: !isCompactTimelineGlobal/, 'only desktop complete group ranges may render endpoint resize handles');
assert.match(icons, /window\.tmOpenTimelineGroupRangeEditor[\s\S]*tmOpenTaskTimeHub\(id, target[\s\S]*hideSchedule: true[\s\S]*hideRepeat: true[\s\S]*hideReminder: true[\s\S]*onUpdateDates[\s\S]*groupPatch\.deadline = patch\.completionTime[\s\S]*__tmSaveTimelineBlockDatePatch/, 'document and heading ranges must reuse the shared date calendar without schedule, repeat, reminder, or repeat-end controls');
assert.doesNotMatch(icons, /tm-doc-date-field|tm-doc-date-action/, 'the group date editor must not retain a second native-input implementation');
const timelineGroupRow = segment(services, 'function __tmRenderTimelineRangeGroupRowHtml', 'async function __tmSaveTimelineBlockDatePatch');
assert.match(timelineGroupRow, /<span class="tm-group-label tm-doc-timeline-label"[\s\S]*calendarBtn/, 'document and heading names must remain plain collapsible labels while the calendar button owns date editing');
assert.doesNotMatch(timelineGroupRow, /<button class="tm-group-label tm-doc-timeline-label[\s\S]*data-tm-group-range-trigger/, 'group names must not open the date editor');
assert.match(timelineGroupRow, /tm-doc-timeline-warning[\s\S]*tm-timeline-group-range-trigger/, 'initial and local timeline table renders must share the warning and calendar controls');
assert.match(icons, /__tmPhosphorBoldPaths\['calendar-range'\] = __tmPhosphorBoldPaths\['calendar-dots'\]/, 'timeline group date controls must use the bundled Phosphor Bold calendar icon instead of the fallback circle');
assert.match(icons, /function __tmOpenTimelineGroupRangeEditorFromTrigger[\s\S]*\.tm-gantt-bar__menu-btn\[data-tm-group-range-trigger\][\s\S]*function __tmBindTimelineGroupRangeTouchOpen[\s\S]*addEventListener\('touchend', onTouchEnd, \{ capture: true, passive: false \}\)/, 'mobile timeline group date controls must open from touchend before card gesture handlers can consume the tap');
const touchTaskDrag = segment(icons, 'function __tmResolveTouchTaskDragSource', 'window.tmTaskTouchDragStart');
assert.match(touchTaskDrag, /#tmTimelineLeftTable tbody tr\[data-id\]/, 'mobile timeline sidebar rows must use the shared touch drag source adapter');
assert.match(touchTaskDrag, /const longPressMs = 500/, 'mobile table drags must use a 500ms long press');
assert.match(calendarView, /CALENDAR_EXTERNAL_DRAG_CUSTOM_TOUCH_SOURCE_SELECTOR[^;]*#tmTimelineLeftTable tbody tr\[data-id\]/, 'mobile timeline sidebar rows must bypass FullCalendar and use the shared 500ms touch drag');
const calendarMobileDragSelector = segment(calendarView, 'const CALENDAR_EXTERNAL_DRAG_MOBILE_ITEM_SELECTOR', 'const CALENDAR_EXTERNAL_DRAG_MIRROR_SOURCE_CLASS');
assert.doesNotMatch(calendarMobileDragSelector, /#tmTimelineLeftTable/, 'FullCalendar mobile dragging must not capture timeline sidebar rows before native panning or the 500ms hold');
assert.match(render, /window\.tmKanbanCardPointerDown[\s\S]*const longPressMs = 500/, 'kanban cards and table rows must share the 500ms touch hold');
assert.doesNotMatch(touchTaskDrag.slice(0, touchTaskDrag.indexOf('const id = source.taskId')), /preventDefault\(\)/, 'pending table presses must not prevent native scrolling');
assert.match(touchTaskDrag, /rememberTouchDragStyle\(sourceEl\)[\s\S]*rememberTouchDragStyle\(activeEl\)/, 'touch-action must be disabled only after the long press activates dragging');
assert.match(taskDetailLoader, /const rowDragAttrs = useDesktopTaskDragLogic[\s\S]*draggable="false"/, 'mobile table rows must disable native HTML5 dragging');
assert.match(checklistBody, /const itemDragAttrs = useDesktopTaskDragLogic[\s\S]*draggable="false"/, 'mobile checklist rows must disable native HTML5 dragging');
assert.match(body, /tmTaskTouchDragStart\(event, '\$\{taskId\}'\)[\s\S]*draggable="false"/, 'timeline sidebar rows must use long-press touch drag and disable native dragging');
const ganttGroupClick = segment(services, 'const onGroupClick = (ev) =>', 'const onGanttWheel');
assert.match(ganttGroupClick, /data-tm-gantt-offscreen-nav[\s\S]*data-tm-group-range-trigger[\s\S]*button[\s\S]*return;/, 'date controls and offscreen locators must remain independent from group collapse');
assert.doesNotMatch(ganttGroupClick, /\.tm-gantt-bar\s*,/, 'clicking a timeline group row or its card body must use the same collapse interaction as the sidebar row');
assert.match(styles, /\.tm-gantt-bar--group-range \.tm-gantt-group-bar__label \{[\s\S]*position: sticky;[\s\S]*left: 8px;/, 'group names must stay inside their range cards and stick within the visible card span');
const timelineDurationBadgeStyles = segment(styles, '.tm-gantt-duration-badge {', '}');
for (const declaration of ['flex: 0 0 auto;', 'min-width: 20px;', 'height: 18px;', 'border: 1px solid color-mix(in srgb, var(--tm-gantt-bar-fg) 18%, transparent);', 'border-radius: 5px;', 'background: color-mix(in srgb, var(--tm-gantt-bar-fg) 6%, transparent);', 'color: color-mix(in srgb, var(--tm-gantt-bar-fg) 78%, var(--tm-gantt-bar-fill) 22%);', 'font-weight: 500;', 'font-variant-numeric: tabular-nums;']) {
    assert.match(timelineDurationBadgeStyles, new RegExp(declaration.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `duration badge must include ${declaration}`);
}
assert.match(styles, /\.tm-gantt-bar--group-range \.tm-gantt-group-bar__label \.tm-gantt-bar__title \{[\s\S]*flex: 1 1 auto;[\s\S]*min-width: 0;/, 'group titles must truncate before the duration badge or date button shrinks');
assert.match(gantt, /tm-gantt-group-chip__date-trigger[\s\S]*data-tm-group-range-trigger[\s\S]*calendar-range/, 'collapsed timeline group names must expose a separate date icon trigger');
assert.match(styles, /\.tm-gantt-group-chip__date-trigger \{[\s\S]*width: 24px[\s\S]*height: 24px/, 'collapsed timeline group date icons must keep a stable compact hit target');
assert.match(styles, /\.tm-task-time-hub-popover--date-only \.tm-task-time-hub__tabs \{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/, 'date-only time hubs must use a full-width single date tab');
assert.match(styles, /\.tm-task-time-hub-popover--group-range \{[\s\S]*z-index: 200050;/, 'the shared group date calendar must render above the mobile modal and compact timeline sidebar');
assert.doesNotMatch(styles, /\.tm-doc-timeline-range-popover/, 'obsolete group-specific date popover styles must be removed');

const headerBuilders = segment(gantt, 'function buildDayCellsHtml', 'function getDayIndexByTs');
assert.match(headerBuilders, /tm-gantt-date-marker/, 'day headers must render only the compact date marker');
assert.match(headerBuilders, /function buildTimelinePeriodSegments[\s\S]*startIndex: segmentStart, spanDays: i - segmentStart/, 'grouped headers must share one day-index period segmenter');
assert.match(headerBuilders, /function buildWeekAlignedMonthSegments[\s\S]*buildTimelinePeriodSegments\(startTs, dayCount, 'week'\)[\s\S]*previous\.spanDays \+= week\.spanDays/, 'week-scale month headers must aggregate complete week columns');
assert.match(headerBuilders, /buildTimelinePeriodSegments\(startTs, dayCount, 'week'\)/, 'week labels must use the shared period segments');
assert.match(headerBuilders, /buildTimelinePeriodSegments\(startTs, dayCount, 'month'\)/, 'month labels must use the shared period segments');
assert.match(headerBuilders, /buildMonthHeaderHtml\(startTs, dayCount, dayWidth, scale === 'week'\)/, 'week-scale upper headers must align month boundaries to week columns');
assert.match(headerBuilders, /style="left:\$\{segment\.startIndex \* dayWidth\}px;width:/, 'grouped header cells must use absolute day-index coordinates');
assert.match(headerBuilders, /title="\$\{weekLabel\}"[\s\S]*data-tm-floating-tooltip-label="\$\{weekLabel\}"/, 'week numbers must live in the date-range tooltip');
assert.doesNotMatch(headerBuilders, />W\$\{/, 'week numbers must not be visible header text');
assert.match(headerBuilders, /scale === 'month'[\s\S]*buildYearHeaderHtml/, 'month scale must use a year upper header');
assert.match(headerBuilders, /tm-gantt-date-marker tm-gantt-date-marker--period[\s\S]*\$\{label\}/, 'week and month current periods must use the same marker component as day');

const backgroundBuilder = segment(gantt, 'function buildTimelineDayBgHtml', 'function resolveTimelineTaskCompleteAtText');
assert.match(backgroundBuilder, /normalizedScale === 'day' && \(d\.getDay\(\) === 0 \|\| d\.getDay\(\) === 6\)/, 'weekend columns must be limited to day scale');
assert.match(backgroundBuilder, /tm-gantt-day-bg--weekend/, 'day weekends must remain in the full-height background layer');
assert.match(backgroundBuilder, /style="left:\$\{i \* dayWidth\}px;width:\$\{dayWidth\}px"/, 'background columns must use absolute day-index coordinates');
assert.match(backgroundBuilder, /const isCurrent = isSameCalendarDay\(ts, todayTs\);/, 'all scales must use the same current-day grid highlight');
assert.doesNotMatch(backgroundBuilder, /tm-gantt-grid-cell--boundary|tm-gantt-day-bg--month-start/, 'timeline task areas must not render vertical period separators at any scale');
assert.match(gantt, /const taskLevel = Number\(task\?\.level\);[\s\S]*const parentTaskId = String\(task\?\.parentTaskId \|\| task\?\.parent_task_id \|\| ''\)\.trim\(\);[\s\S]*isParentTaskTitle/, 'timeline cards must derive the same top-level parent-title role used by other task views');
assert.match(gantt, /tm-gantt-bar__title\$\{visual\.isParentTaskTitle \? ' tm-parent-task-title' : ''\}/, 'normal timeline cards and milestones must expose the shared parent-task title class');
assert.match(styles, /\.tm-gantt-bar__title \{[\s\S]*font-weight: 400;[\s\S]*\.tm-gantt-bar__title\.tm-parent-task-title \{[\s\S]*font-weight: 600;/, 'timeline child titles must stay regular while parent titles use the configured bold weight');
assert.match(styles, /\.tm-box--parent-task-name-normal[\s\S]*\.tm-parent-task-title \{[\s\S]*font-weight: 400;/, 'disabling parent-task bold text must also normalize timeline parent titles');
assert.match(gantt, /bodyEl\.dataset\.tmGanttScale = scale[\s\S]*bodyEl\.dataset\.tmGanttSnapDays = String\(snapDays\)/, 'rendered timelines must publish the resolved scale and snap interval');
assert.match(gantt, /function resolveTimelineScaleDateRange[\s\S]*scale === 'week'[\s\S]*point\.getDate\(\) - weekday \+ 1[\s\S]*point\.getDate\(\) - weekday \+ 7[\s\S]*scale === 'month'[\s\S]*point\.getMonth\(\), 1[\s\S]*point\.getMonth\(\) \+ 1, 0/, 'double-click date ranges must resolve to a day, natural week, or natural month');
assert.match(gantt, /function getTimelineBarLocalGeometry[\s\S]*rowEl\.hidden \|\| rowEl\.style\.display === 'none' \|\| rowEl\.getClientRects\(\)\.length === 0[\s\S]*return null;/, 'dependency endpoints must disappear when a parent task or group collapse hides either timeline row');

const mobileTouchLock = segment(gantt, 'const setMobileTimelineTouchLock = (enabled) =>', 'if (!appendOnly) {');
assert.match(mobileTouchLock, /scrollHost = modal\.querySelector\('\.tm-timeline-scroll-host'\)[\s\S]*modal\.querySelector\('\.tm-body\.tm-body--timeline'\)[\s\S]*lockedScrollLeft[\s\S]*lockedScrollTop/, 'mobile card dragging must lock the dedicated compact timeline scroll host with a legacy fallback');
assert.match(mobileTouchLock, /restoreLockedScroll[\s\S]*scrollHost\.scrollLeft = lockedScrollLeft;[\s\S]*scrollHost\.scrollTop = lockedScrollTop;/, 'mobile card dragging must hold both timeline scroll axes fixed');
assert.match(mobileTouchLock, /on\?\.\(scrollHost, 'scroll', restoreLockedScroll[\s\S]*off\?\.\(scrollHost, 'scroll', restoreLockedScroll/, 'the timeline scroll lock listener must be released with the drag session');
assert.doesNotMatch(mobileTouchLock, /on\?\.\(window, '(?:touchmove|pointermove)'|preventMoveDefault/, 'mobile drag locking must not leave global move blockers that delay the next scroll gesture');
assert.doesNotMatch(styles, /tm-modal--timeline-touch-lock \.tm-body\.tm-body--timeline \{[\s\S]{0,120}overflow: hidden/, 'activating a mobile card drag must not reflow the timeline scroll host');
const mobileTimelineTouchLockStyles = segment(styles, '.tm-modal.tm-modal--mobile.tm-modal--timeline-touch-lock .tm-body.tm-body--timeline,', '.tm-timeline-toolbar-icon {');
assert.doesNotMatch(mobileTimelineTouchLockStyles, /touch-action:|-ms-touch-action:/, 'ending a mobile drag must not be followed by a stale touch-action lock on the scroll host');

const pointerDrag = segment(gantt, 'const onPointerDown = (e) =>', 'const onPanPointerDown = (e) =>');
assert.match(pointerDrag, /compactEntity = isGroupEntity \? isCompactTimelineGlobal : isMobileTimelineGlobal[\s\S]*useMobileLongPressMove = !!\(compactEntity && !handleEl && pointerType === 'touch'\)[\s\S]*isMobileTimelineGlobal && !handleEl && !useMobileLongPressMove/, 'mobile tasks and compact document or heading cards must use the existing touch long-press move path');
assert.match(pointerDrag, /isMobileTimelineGlobal && handleEl[\s\S]*tm-gantt-row--selected[\s\S]*tm-gantt-row--dot-open[\s\S]*return;/, 'mobile resize handles must reject interaction until the task card is selected');
assert.match(pointerDrag, /longPressTimer = setTimeout\(\(\) => \{[\s\S]*longPressReady = true;[\s\S]*activateDrag\(\);[\s\S]*\}, 500\);/, 'mobile timeline cards must enter move mode after a 500ms hold');
assert.match(pointerDrag, /if \(!longPressReady\)[\s\S]*pendingHorizontalScroll[\s\S]*pendingScrollHost\.scrollLeft = initialPendingScrollLeft - pendingDx[\s\S]*pendingDx \* pendingDx \+ pendingDy \* pendingDy\) > 16[\s\S]*Math\.abs\(pendingDx\) > Math\.abs\(pendingDy\)[\s\S]*pendingHorizontalScroll = true[\s\S]*unbindWindowDragEvents\(\);/, 'moving before the hold threshold must route horizontal gestures to timeline scrolling and vertical gestures to native scrolling');
assert.match(pointerDrag, /if \(!useMobileLongPressMove\) \{[\s\S]*e\.preventDefault\(\)[\s\S]*e\.stopPropagation\(\)/, 'pending mobile long press must not block the native scroll gesture');
assert.match(pointerDrag, /if \(!dragActive\) \{[\s\S]*pendingHorizontalScroll[\s\S]*tmSuppressClickUntil/, 'a pre-hold horizontal pan must not emit a synthetic card click');
assert.match(pointerDrag, /pointerCanceled = ev\?\.type === 'pointercancel'[\s\S]*!pointerCanceled && Number\.isFinite\(Number\(ev\?\.clientX\)\)[\s\S]*!pointerCanceled && dragActive\) onMove/, 'pointer cancellation must preserve the last valid card position instead of applying zeroed coordinates');
assert.match(pointerDrag, /releaseActivePointerCapture[\s\S]*releasePointerCapture[\s\S]*unbindWindowDragEvents\(\);[\s\S]*releaseActivePointerCapture\(\);[\s\S]*if \(!dragActive\)/, 'all card move and resize paths must release pointer capture before the interaction completes');
assert.match(pointerDrag, /Math\.round\(\(dx \/ dayWidth0\) \/ snapDays0\) \* snapDays0/, 'dragging must quantize only the existing date delta');
assert.match(pointerDrag, /const initialVisibleLen = initialEndIdx - initialStartIdx \+ 1;[\s\S]*minimumResizeDays = Math\.min\([\s\S]*initialVisibleLen,[\s\S]*Math\.ceil\(TIMELINE_MIN_RESIZE_WIDTH_PX \/ dayWidth0\)/, 'resize minimum days must derive from the current pixel scale without expanding an already shorter task');
assert.match(pointerDrag, /action === 'start'[\s\S]*nextStart = Math\.min\([\s\S]*initialEndIdx - minimumResizeDays \+ 1[\s\S]*applyBar\(nextStart, initialEndIdx\)[\s\S]*action === 'end'[\s\S]*nextEnd = Math\.max\([\s\S]*initialStartIdx \+ minimumResizeDays - 1[\s\S]*applyBar\(initialStartIdx, nextEnd\)/, 'both resize handles must stop before the task becomes narrower than the card minimum or crosses the opposite edge');
assert.match(pointerDrag, /setMobileTimelineTouchLock\(true\)/, 'the existing mobile touch lock must remain intact');
assert.match(pointerDrag, /syncDraggedDependencies[\s\S]*renderDependencies\(\);[\s\S]*groupMove[\s\S]*groupItems\.forEach[\s\S]*syncDraggedDependencies\(deltaDays\);[\s\S]*return;[\s\S]*applyBar[\s\S]*syncDraggedDependencies\(deltaDays\);/, 'task dependencies must follow single and multi-card drag frames without duplicate redraws');
assert.match(gantt, /function getTimelineBarLocalGeometry[\s\S]*barEl\.style\.left[\s\S]*rowEl\.offsetTop[\s\S]*barEl\.offsetTop/, 'timeline dependency endpoints must use scroll-independent local card geometry');
assert.match(gantt, /function syncTimelineTaskLinkDots[\s\S]*tm-task-link-dot--in[\s\S]*tm-task-link-dot--out[\s\S]*inDot\.style\.left = `\$\{geometry\.left\}px`[\s\S]*outDot\.style\.left = `\$\{geometry\.left \+ geometry\.width\}px`/, 'timeline link dots must share the card geometry used by dependency endpoints');
assert.match(gantt, /const getPt = \(taskId, kind\) => \{[\s\S]*getTimelineBarLocalGeometry\(bar\)[\s\S]*geometry\.left \+ geometry\.width[\s\S]*geometry\.y/, 'dependency paths must consume the same local geometry as their visible endpoints');
assert.doesNotMatch(gantt, /const getPt = \(taskId, kind\) => \{[\s\S]{0,900}bar\.getBoundingClientRect/, 'dependency paths must not mix viewport coordinates into the scrollable timeline canvas');
assert.match(gantt, /applyTimelineTaskBarElement[\s\S]*syncTimelineTaskLinkDots\(barEl\);[\s\S]*groupItems\.forEach[\s\S]*it\.barEl\.style\.left[\s\S]*syncTimelineTaskLinkDots\(it\.barEl\);/, 'single and multi-card moves must keep visible mobile link dots attached to their cards');
assert.match(pointerDrag, /const onUp = async \(ev\) =>[\s\S]*!pointerCanceled && Number\.isFinite\(Number\(ev\?\.clientX\)\)[\s\S]*!pointerCanceled && dragActive\) onMove\(\{ clientX: lastPointerX \}\);[\s\S]*await updateEntityDates/, 'normal pointer release must flush the final resize frame before persisting task or group dates');
assert.match(pointerDrag, /const updateEntityDates = isGroupEntity[\s\S]*onUpdateGroupDates \? \(id, patch\) => onUpdateGroupDates\(entityKind, id, patch\)[\s\S]*if \(isGroupEntity\) return;[\s\S]*groupMove = !isGroupEntity/, 'document and heading cards must share task drag geometry while remaining outside task multi-select and dependency updates');
assert.match(pointerDrag, /groupTimelineState === 'start'[\s\S]*groupTimelineState === 'deadline'[\s\S]*\{ deadline: completionTime \}/, 'single-ended group markers must persist only their own endpoint');
assert.match(gantt, /data-tm-suppress-click-until[\s\S]*suppressClickUntil > Date\.now\(\)[\s\S]*e\.preventDefault\(\)/, 'releasing a long-pressed timeline card must suppress the synthetic click');
const doubleClick = segment(gantt, 'const onDblClick = async (e) =>', 'const onContextMenu = (e) =>');
assert.match(doubleClick, /bodyEl\.dataset\?\.tmGanttScale[\s\S]*resolveTimelineScaleDateRange\(pointTs, scale\)[\s\S]*\{ startDate, completionTime \}/, 'double-click must create the scale-specific date card on the task row');
const contextMenu = segment(gantt, 'const openGanttTaskContextMenu = (taskId, anchor) =>', 'const onPointerDown = (e) =>');
assert.match(contextMenu, /item\.onclick = async \(ev\) =>[\s\S]*await onClick\?\.\(\)/, 'timeline context menu commands must await their writes');
assert.match(contextMenu, /__tmRenderContextMenuLabel\('file-text', '打开任务详情'\)[\s\S]*await window\.tmOpenTaskDetail\(String\(taskIdText\), null, \{ source: 'timeline-context-menu' \}\)/, 'timeline right-click and compact card menus must expose the shared task-detail opener');
assert.match(contextMenu, /__tmRenderContextMenuLabel\('trash-2', '清除时间轴（清空起止）'\)[\s\S]*, true\)\)/, 'timeline clear must use the shared red trash action in the context menu');
assert.match(contextMenu, /onUpdateTaskDates\(String\(taskIdText\), \{ startDate: '', completionTime: '' \}\)/, 'clear timeline must explicitly persist both empty date fields');
assert.match(contextMenu, /if \(onUpdateTaskMeta && isMilestone\)[\s\S]*await onUpdateTaskMeta\(String\(taskIdText\), \{ milestone: false \}\)/, 'milestones must retain an awaited path back to a normal timeline task');
const selectionToolbar = segment(gantt, 'let selectionToolbarPositionRaf = 0;', 'const setTimelineDraggingX = (on) =>');
assert.match(selectionToolbar, /role', 'toolbar'[\s\S]*data-tm-gantt-selection-action="detail"[\s\S]*data-tm-gantt-selection-action="milestone"[\s\S]*data-tm-gantt-selection-action="clear"/, 'selecting one timeline card must expose detail, milestone, and clear-date actions');
assert.match(selectionToolbar, /tm-timeline-selection-toolbar__btn--danger[\s\S]*__tmRenderLucideIcon\('trash-2'\)/, 'the selected-card clear action must use a red trash icon');
assert.match(selectionToolbar, /rowEl\?\.querySelector\?\.\('\.tm-gantt-bar'\)[\s\S]*classList\.contains\('tm-gantt-bar--milestone'\)/, 'milestone state must prefer the current rendered card over a potentially stale task cache');
assert.match(selectionToolbar, /barRect\.top - toolbarRect\.height - margin[\s\S]*barRect\.bottom \+ margin[\s\S]*dataset\.tmPlacement = placement/, 'the selected-card toolbar must prefer the card top and flip below when the visible viewport would clip it');
assert.match(selectionToolbar, /window\.tmOpenTaskDetail\?\.\(taskId, null, \{ source: 'timeline-selection-toolbar' \}\)[\s\S]*onUpdateTaskMeta\(taskId, \{ milestone: nextMilestone \}\)[\s\S]*onUpdateTaskDates\(taskId, \{ startDate: '', completionTime: '' \}\)/, 'the selected-card toolbar must reuse the existing detail and timeline mutation callbacks');
assert.match(selectionToolbar, /dataset\.tmMilestone = isMilestone \? '1' : '0'[\s\S]*const currentMilestone = selectionToolbar\.dataset\.tmMilestone === '1'[\s\S]*syncTimelineSelectionToolbar\(taskId, nextMilestone\)/, 'milestone toggles must retain their submitted state so the next click can restore a normal timeline even before task caches settle');
assert.match(selectionToolbar, /onTimelineSelectionOutsidePointerDown[\s\S]*selectionToolbar\.contains\(target\)[\s\S]*const timelineSurface = target\.closest\('\.tm-gantt-bar, \.tm-gantt-milestone, \.tm-task-link-dot'\)[\s\S]*bodyEl\.contains\(timelineSurface\)[\s\S]*clearTimelineTaskSelection\(\)/, 'pointerdown outside timeline cards and their toolbar must clear the timeline selection while preserving the first card gesture');
assert.match(gantt, /on\?\.\(document, 'pointerdown', onTimelineSelectionOutsidePointerDown, true\)[\s\S]*off\?\.\(document, 'pointerdown', onTimelineSelectionOutsidePointerDown, true\)/, 'the outside-pointer listener must be removed with the gantt render lifecycle');
assert.doesNotMatch(selectionToolbar, /\brender\s*\(/, 'selected-card actions must not rerender the timeline to show or position the toolbar');
assert.match(gantt, /withMultiModifier && !selectedSet\.has\(taskId\)[\s\S]*syncTimelineSelectionToolbar\(''\)[\s\S]*if \(withMultiModifier\)[\s\S]*syncTimelineSelectionToolbar\(''\)/, 'entering timeline multi-select must hide the single-card action toolbar');
assert.match(styles, /\.tm-timeline-selection-toolbar \{[\s\S]*position: fixed;[\s\S]*\.tm-timeline-selection-toolbar__btn \{[\s\S]*width: 34px;[\s\S]*@media \(pointer: coarse\), \(max-width: 768px\) \{[\s\S]*width: 44px;/, 'the selected-card toolbar must stay overlay-only and provide touch-sized controls on mobile and Dock hosts');
assert.match(styles, /\.tm-timeline-selection-toolbar__btn--danger \{[\s\S]*color: var\(--tm-danger-color\);[\s\S]*\.tm-timeline-selection-toolbar__btn--danger:not\(:disabled\):hover \{[\s\S]*color: var\(--tm-danger-color\);/, 'the selected-card clear action must remain visibly destructive at rest and on hover');
const timelineDateCallback = segment(render, 'onUpdateTaskDates: async (taskId, patch) =>', 'onUpdateTaskMeta: async (taskId, patch) =>');
assert.match(timelineDateCallback, /const result = await window\.tmUpdateTaskDates[\s\S]*timelineMutation: true,[\s\S]*return result;/, 'timeline date callbacks must enter the shared serial mutation queue and propagate completion');
assert.match(timelineDateCallback, /error\.__tmGanttUpdateHinted = true;[\s\S]*throw error;/, 'timeline date callbacks must preserve existing error feedback while propagating failures');
assert.doesNotMatch(timelineDateCallback, /task\.startDate = task\.start_date|task\.completionTime = task\.completion_time|__tmRefreshTaskTimeAcrossViews/, 'timeline callbacks must not repeat the outbox optimistic date patch');
const timelineMetaCallback = segment(render, 'onUpdateTaskMeta: async (taskId, patch) =>', '});\n                    const anchoredLeft');
assert.match(timelineMetaCallback, /const metaPatch = \{ milestone: val \? '1' : '' \};[\s\S]*__tmEnqueueTimelineMutation\(async \(\) =>[\s\S]*return await patchTask[\s\S]*wait: false,[\s\S]*background: true,/, 'milestone callbacks must enqueue in serial order but release timeline interactions after the optimistic task patch is queued');
assert.doesNotMatch(timelineMetaCallback, /wait: true,[\s\S]*background: false,/, 'milestone persistence must not hold the shared timeline queue until the background outbox settles');
const legacyTimelineMetaCallback = segment(services, 'onUpdateTaskMeta: async (taskId, patch) =>', '});\n            } catch (e) {}');
assert.match(legacyTimelineMetaCallback, /__tmEnqueueTimelineMutation\(async \(\) =>[\s\S]*return await patchTask[\s\S]*background: true,[\s\S]*wait: false,/, 'the fallback timeline renderer must also release interactions after optimistic milestone enqueue');
const timelinePatchTask = segment(taskRuntime, 'timeline: {', 'kanban: {');
assert.match(timelinePatchTask, /hasOwnProperty\.call\(patch, 'milestone'\)[\s\S]*__tmUpdateTimelineTaskInDOM\(tid\)/, 'milestone changes must update the existing timeline task DOM immediately');
assert.doesNotMatch(timelinePatchTask, /__tmScheduleViewRefresh|__tmRerenderCurrentViewInPlace|\brender\s*\(/, 'milestone changes must not reload or rerender the full timeline view');

const taskDetailSheetPolicy = segment(viewHostPolicies, 'const taskDetailSheetViewModes', 'const shouldUseDockPointerTaskDrag');
assert.match(taskDetailSheetPolicy, /new Set\(\['list', 'kanban', 'whiteboard', 'calendar', 'timeline'\]\)/, 'timeline must remain eligible for the shared compact task-detail sheet');
assert.match(taskDetailSheetPolicy, /const desktopDock[\s\S]*if \(desktopDock\) return true;[\s\S]*mobileLike[\s\S]*width < 768/, 'desktop Dock and narrow mobile hosts must select task-detail sheet mode');
const openTaskDetail = segment(taskDetailLoader, 'window.tmOpenTaskDetail = async function', 'window.tmToggleTaskDetailCompletedSubtasks');
assert.match(openTaskDetail, /shouldUseTaskDetailSheetMode\?\.\(activeRenderMode, state\.modal\)[\s\S]*await __tmOpenTaskDetailSheetInPlace\(tid,/, 'the shared task-detail opener must route timeline requests to the existing mobile and Dock drawer');

assert.match(render, /function __tmCaptureTimelineDateAnchor[\s\S]*function __tmResolveAndConsumeTimelineDateAnchor/, 'scale changes must use one shared date-anchor lifecycle');
assert.match(render, /function __tmResolveAndConsumeTimelineDateAnchor[\s\S]*viewportWidth <= 0\) return null;[\s\S]*state\.ganttView\.pendingAnchor = null[\s\S]*state\.viewScroll\.timeline = \{[\s\S]*left: resolvedLeft/, 'date anchors must wait for layout and replace stale timeline scroll state when applied');
assert.match(render, /__tmSyncTimelineDateColumnWidths\(state\.modal\)[\s\S]*deferredAnchoredLeft = __tmResolveAndConsumeTimelineDateAnchor\(state\.modal\)/, 'full renders must retry an unconsumed date anchor after layout');
assert.doesNotMatch(render, /__forceScrollLeft/, 'legacy force-scroll patches must not compete with date anchoring');
assert.match(render, /window\.tmGanttSetScale[\s\S]*__tmPrepareTimelineDateAnchor\(0\.5\)[\s\S]*view\.setScale/, 'scale switches must preserve the viewport center date');
assert.match(render, /view\.fitScale\(state\.ganttView, dayCount, usableW\)[\s\S]*pendingAnchor = \{[\s\S]*dateTs:/, 'fit must select a scale and anchor the task range');
assert.match(render, /useGlobalScroll[\s\S]*Number\(globalScrollHost\?\.clientWidth \|\| 0\)[\s\S]*viewportDayCount[\s\S]*Math\.ceil\(w \/ fittedDayWidth\)[\s\S]*rollingWindowDayCount[\s\S]*Math\.max\(rollingWindowDayCount, dayCount \+ viewportDayCount \* 2\)/, 'fit must retain the long rolling window and at least one viewport of overscan on both sides');
assert.match(render, /window\.tmGanttExtendRange[\s\S]*__tmPrepareTimelineDateAnchor\(0\.5\)[\s\S]*view\.shiftRange/, 'edge expansion must preserve the center date while shifting the rolling window');
assert.match(render, /centerRangeOnDate\(state\.ganttView, Date\.now\(\), 0\.35\)/, 'today must recenter the rolling range when today is outside it');
assert.match(services, /pendingAnchor:\s*\{\s*dateTs:\s*Date\.now\(\),\s*ratio:\s*0\.35\s*\}/, 'the first timeline open must anchor today at 35% of the viewport');
assert.match(services, /requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => \{[\s\S]*deferredAnchoredLeft[\s\S]*deferredRestoredLeft/, 'in-place renders must retry an unconsumed date anchor after layout');

assert.match(scene, /\['day', '日'\][\s\S]*\['week', '周'\][\s\S]*\['month', '月'\]/, 'desktop and mobile controls must offer the same three scales');
assert.match(scene, /__tmRenderTimelineScaleSegments[\s\S]*tm-view-segmented bc-tabs-list[\s\S]*tm-view-seg-item bc-tabs-trigger[\s\S]*tm-view-seg-item--active[\s\S]*data-state=[\s\S]*aria-selected=/, 'desktop timeline scales must reuse the plugin view switcher component contract');
assert.doesNotMatch(styles, /tm-timeline-scale-segmented/, 'timeline scales must not maintain a parallel segmented-control style');
assert.match(scene, /__tmPhosphorBoldSvg\(iconName/, 'timeline toolbar icons must use the Phosphor renderer');
assert.match(scene, /showDesktopTimelineFloatingToolbar[\s\S]*tm-timeline-floating-toolbar--desktop/, 'desktop timelines must render the shared floating action toolbar');
assert.match(scene, /const mainStageBottomInset = showMobileBottomViewBar[\s\S]*\+ 52px[\s\S]*: '0px'/, 'floating timeline tools must not reserve layout height beyond the existing mobile view bar');
assert.match(scene, /const inner = `\$\{includeSidebarToggle \? timelineSidebarToggleButtonHtml : ''\}\$\{__tmRenderTimelineScaleSegments\(\)\}`;/, 'desktop topbar must contain only sidebar visibility and scale controls');
assert.match(scene, /const showFloatingTimelineSidebarToggle = !!\(isMobile && !showMobileLandscapeTimelineTopbar\)/, 'only mobile floating controls may repeat the sidebar toggle');
assert.match(scene, /showFloatingTimelineSidebarToggle \? __tmRenderTimelineSidebarToggleButton[\s\S]*showDesktopTimelineFloatingToolbar \? '' : __tmRenderTimelineScaleMenu/, 'narrow floating toolbars must keep the sidebar toggle first and visible');
assert.match(scene, /__tmRenderTimelineCardFieldsToggleButton[\s\S]*data-tm-timeline-card-fields-toggle[\s\S]*aria-pressed=[\s\S]*timelineCardFieldsHidden \? 'eye-slash' : 'eye'/, 'timeline card-field visibility must use one shared accessible eye toggle');
assert.match(scene, /__tmRenderTimelineScaleMenu = \(\{ interactionAttrs = '', showRulerIcon = true \}[\s\S]*showRulerIcon \? __tmRenderTimelineToolbarIcon\('ruler'\) : ''/, 'the shared scale menu must support hiding only its ruler icon');
assert.match(scene, /const timelineCompactToolbarButtonsHtml = `\$\{__tmRenderTimelineScaleMenu\(\{ showRulerIcon: !isMobile \}\)\}[\s\S]*\$\{__tmRenderTimelineToolbarButtons\([\s\S]*\$\{__tmRenderTimelineCardFieldsToggleButton\(/, 'compact controls must remove the mobile ruler and keep the card-field toggle at the right edge');
assert.match(scene, /timelineFloatingToolbarHtml[\s\S]*showDesktopTimelineFloatingToolbar \? '' : __tmRenderTimelineScaleMenu\(\{[\s\S]*showRulerIcon: !isMobile[\s\S]*__tmRenderTimelineToolbarButtons\([\s\S]*__tmRenderTimelineCardFieldsToggleButton\(/, 'desktop, Dock, and mobile bottom toolbars must keep the card-field toggle at the right edge while retaining the Dock ruler');
for (const iconName of ['sidebar', 'calendar-blank', 'ruler', 'caret-down', 'corners-out', 'eye', 'eye-slash']) {
    assert.match(icons, new RegExp(`__tmPhosphorBoldPaths\\['${iconName}'\\] =`), `${iconName} must have a real Phosphor Bold path`);
}
assert.match(services, /timelineMobileSidebarExpanded: false,\s*timelineCardFieldsHidden: false,/, 'timeline card fields must start visible without adding a persisted setting');
assert.match(gantt, /const timelineCardFieldSet = state\.timelineCardFieldsHidden === true[\s\S]*\? new Set\(\)[\s\S]*SettingsStore\?\.data\?\.timelineCardFields/, 'hiding timeline card fields must preserve the configured field set');
const timelineCardFieldsToggle = segment(render, 'window.tmTimelineToggleCardFields = function', 'window.tmGanttZoomIn = function');
assert.match(timelineCardFieldsToggle, /timelineCardFieldsHidden = state\.timelineCardFieldsHidden !== true[\s\S]*__tmRerenderTimelineInPlace\(state\.modal, \{ reuseLeftRows: true \}\)[\s\S]*__tmSyncTimelineToolbarStateInPlace/, 'the card-field toggle must rerender in place while preserving the timeline scroll state');
assert.doesNotMatch(timelineCardFieldsToggle, /SettingsStore|timelineCardFields\s*=|\.save\(/, 'the runtime visibility toggle must not overwrite or persist the configured timeline fields');

assert.match(body, /useCompactTimelineSidebarState[\s\S]*opts\.isMobile === true \|\| opts\.isDockHost === true[\s\S]*state\.timelineMobileSidebarExpanded !== true/, 'mobile and dock timelines must start with an effective collapsed sidebar');
assert.match(interactions, /useCompactRuntimeState[\s\S]*tm-modal--mobile[\s\S]*tm-modal--dock[\s\S]*const expanding = state\.timelineMobileSidebarExpanded !== true;[\s\S]*timelineMobileSidebarExpanded = expanding/, 'mobile and dock sidebar toggles must stay runtime-only');
assert.match(interactions, /window\.tmTimelineToggleSidebar = async function[\s\S]*__tmPrepareTimelineDateAnchor\(0\.5\);[\s\S]*timelineMobileSidebarExpanded[\s\S]*render\(\);[\s\S]*timelineSidebarCollapsed[\s\S]*render\(\);/, 'timeline sidebar toggles must preserve the center date in mobile, dock, and desktop hosts');
assert.doesNotMatch(interactions, /RevealTimelineSidebarAfterRender|IsTimelineSidebarVisibleInViewport|viewScroll\.timeline\.left = 0|scrollHost\.scrollLeft = 0/, 'compact sidebar toggles must not reset the timeline to the rendered range start');
assert.doesNotMatch(interactions, /timelineSidebarDebugSequence|__tmLogTimelineSidebarState|__tmScheduleTimelineSidebarStateLogs|\[Task Horizon\]\[TimelineSidebar\]/, 'temporary timeline sidebar diagnostics must be removed');
assert.match(services, /closest\?\.\('\.tm-timeline-split--sidebar-collapsed'\)\) return 0;/, 'collapsed mobile sidebars must not affect global-scroll date math');
assert.match(services, /querySelector\?\.\('\.tm-timeline-scroll-host'\)\) return 0;/, 'compact overlay sidebars must not contribute width to the timeline date coordinate system');
assert.match(services, /\.tm-gantt-row--group\[data-group-key=[\s\S]*querySelectorAll[\s\S]*forEach\?\.\(syncGroupToggle\)/, 'group collapse glyph updates must include the visible gantt group row when the left table is hidden');
assert.match(body, /useCompactTimelineOverlay[\s\S]*tm-timeline-scroll-host[\s\S]*tm-timeline-sidebar-overlay[\s\S]*timelineLeftHtml/, 'compact timelines must render the task table outside the timeline scroll coordinate system');
assert.match(body, /tm-timeline-split tm-timeline-split--compact-canvas\$\{splitClass\}/, 'compact timelines must expose the shared sidebar-collapsed state to visible gantt group labels');
assert.match(services, /querySelector\?\.\('\.tm-timeline-scroll-host'\)[\s\S]*return compactHost/, 'compact timeline date restoration must target the dedicated timeline scroll host');
assert.match(styles, /\.tm-body\.tm-body--timeline-compact \{[\s\S]*overflow: hidden;[\s\S]*isolation: isolate;/, 'the compact timeline shell must provide a non-scrolling overlay containing block in mobile and dock hosts');
assert.doesNotMatch(styles, /\.tm-body\.tm-body--timeline \{[\s\S]{0,220}padding-bottom:/, 'timeline bottom insets must not move the whole timeline shell');
assert.match(styles, /\.tm-body--timeline-compact \.tm-timeline-sidebar-overlay \{[\s\S]*position: absolute;[\s\S]*inset: 0;[\s\S]*z-index: 30;[\s\S]*background: var\(--tm-bg-color\);/, 'the compact task table must be a viewport-bound opaque layer above the timeline');
assert.match(styles, /\.tm-body--timeline-compact \.tm-timeline-sidebar-overlay \.tm-timeline-left-body \{[\s\S]*overflow: auto;[\s\S]*overscroll-behavior: contain;/, 'wide custom timeline columns and rows must remain independently scrollable inside the overlay');
assert.match(styles, /\.tm-body--timeline-compact \.tm-timeline-sidebar-overlay \.tm-timeline-left-body \{[\s\S]*--tm-timeline-sidebar-bottom-inset: max\(0px, calc\(var\(--tm-view-bottom-inset, 0px\) \+ 45px\)\);[\s\S]*padding-bottom: var\(--tm-timeline-sidebar-bottom-inset\);[\s\S]*scroll-padding-bottom: var\(--tm-view-bottom-inset, 0px\);/, 'compact timeline sidebars must reserve the full bottom toolbar inset plus the requested 45px lift');
assert.match(styles, /\.tm-modal\.tm-modal--mobile \.tm-body\.tm-body--timeline-compact \.tm-timeline-sidebar-overlay \.tm-timeline-left,[\s\S]*width: 100% !important;[\s\S]*max-width: 100% !important;[\s\S]*align-self: stretch;/, 'compact timeline sidebars must override max-content mobile sizing so the table can overflow inside them');
assert.match(styles, /\.tm-modal\.tm-modal--mobile \.tm-body\.tm-body--timeline-compact \.tm-timeline-sidebar-overlay \.tm-timeline-left-body,[\s\S]*width: 100%;[\s\S]*overflow-x: auto;[\s\S]*overflow-y: auto;[\s\S]*touch-action: pan-x pan-y;/, 'mobile and Dock compact timeline sidebars must remain drag-scrollable on both axes');
assert.match(styles, /\.tm-body--timeline-compact \.tm-timeline-scroll-host \{[\s\S]*--tm-timeline-canvas-bottom-inset: max\(0px, calc\(var\(--tm-view-bottom-inset, 0px\) \+ 45px\)\);[\s\S]*padding-bottom: var\(--tm-timeline-canvas-bottom-inset\);/, 'compact timeline canvas scrolling must reserve the full bottom toolbar inset plus the requested 45px lift without moving the whole timeline shell');
assert.match(render, /timelineSidebarOverlay[\s\S]*timelineSidebarVisible[\s\S]*timelineSidebarTop[\s\S]*savedTimelineScrollTop = \(timelineSidebarVisible && Number\.isFinite\(timelineSidebarTop\)\)/, 'compact timeline sidebar toggles must capture the visible table scroll position before full rerender');
assert.match(render, /if \(useGlobalScroll\) \{[\s\S]*leftBody\) leftBody\.scrollTop = desiredTop;[\s\S]*timelineScrollHost\.scrollTop = desiredTop;[\s\S]*leftBody\) leftBody\.scrollTop = desiredTop;/, 'compact timeline sidebar toggles must restore the table and timeline to the same vertical position after full rerender');
assert.match(services, /compactSidebarOverlay[\s\S]*compactSidebarVisible[\s\S]*const savedTop = useGlobalScroll[\s\S]*compactSidebarTop[\s\S]*leftBody\.scrollTop = savedTop;[\s\S]*globalScrollHost\.scrollTop = savedTop;/, 'compact timeline row refreshes must preserve the visible table scroll position');
assert.match(services, /const syncCompactVerticalScroll = \(source, target\) => \{[\s\S]*target\.scrollTop = nextTop;[\s\S]*if \(useGlobalScroll\) \{[\s\S]*syncCompactVerticalScroll\(globalScrollHost, leftBody\);[\s\S]*syncCompactVerticalScroll\(leftBody, globalScrollHost\)/, 'compact timeline and sidebar scroll surfaces must stay vertically linked in both directions');
assert.doesNotMatch(services, /onCompactSidebarWheel|bind\(leftBody, 'wheel'/, 'compact timeline scroll linkage must preserve native wheel and touch behavior');
assert.match(services, /scheduleInfiniteRangeShift[\s\S]*tmGanttExtendRange\?\.\(direction\)/, 'timeline scrolling must request a range shift near either edge');
assert.match(services, /const scrollableWidth = Math\.max\(0, totalWidth - viewportWidth\);[\s\S]*Math\.min\(viewportWidth, Math\.max\(96, scrollableWidth \/ 3\)\)/, 'rolling ranges must rebase before the viewport reaches a rendered edge');
assert.match(services, /const globalScrollLeft = useGlobalScroll[\s\S]*leftPaneWidth > 0 && globalScrollLeft < leftPaneWidth\) return;/, 'showing the mobile or dock table pane must not trigger an infinite timeline range shift');
assert.doesNotMatch(services, /__tmSyncTimelineMobileGroupStickyOffset|__tmMobileTimelineGroupShift/, 'mobile timeline group labels must not use frame-delayed scroll compensation');
assert.match(services, /tm-gantt-body--dragging-x[\s\S]*tm-modal--timeline-touch-lock/, 'range shifts must wait until existing mouse and touch drags finish');
assert.match(gantt, /findTimelineBarAtPointer[\s\S]*elementsFromPoint[\s\S]*querySelectorAll\('.tm-gantt-bar'\)[\s\S]*tm-gantt-bar__surface[\s\S]*tm-gantt-bar__label-layer[\s\S]*const directBarEl = target\.closest\('.tm-gantt-bar'\);[\s\S]*directBarEl \|\| findTimelineBarAtPointer\(e\)/, 'timeline card pointerdown must recover visible bar surfaces and overflow labels when an overlay owns the hit target');
assert.match(services, /requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => \{[\s\S]*syncTimelineHeaderPosition\(\)/, 'in-place range shifts must resync the header and sticky period label after layout settles');

assert.match(gantt, /data-task-start-ts="\$\{Number\(aTs\) \|\| 0\}"[\s\S]*data-task-end-ts="\$\{Number\(bTs\) \|\| 0\}"/, 'task rows must retain date coordinates even when their cards fall outside the bounded render window');
assert.match(gantt, /function buildTimelineOffscreenNavHtml[\s\S]*data-tm-gantt-offscreen-nav[\s\S]*__tmPhosphorBoldSvg\('chevron-left'[\s\S]*__tmPhosphorBoldSvg\('chevron-right'/, 'offscreen task navigation must use compact Phosphor Bold edge controls');
assert.match(gantt, /tm-gantt-offscreen-nav--group[\s\S]*tm-gantt-offscreen-nav__label[\s\S]*itemTitle/, 'fully offscreen document and heading ranges must expose their names next to the direction arrow');
assert.match(gantt, /getTimelineRowInterval[\s\S]*bar\.style\.left[\s\S]*bar\.style\.width[\s\S]*taskStartTs[\s\S]*taskEndTs/, 'offscreen detection must prefer live card geometry and fall back to task dates beyond the rendered range');
assert.match(gantt, /interval\?\.right <= visibleLeft \+ 1[\s\S]*interval\?\.left >= visibleRight - 1[\s\S]*hideTimelineOffscreenNav/, 'only fully offscreen cards may expose a left or right location control');
assert.match(gantt, /row\.hidden \|\| row\.style\.display === 'none'[\s\S]*hideTimelineOffscreenNav/, 'collapsed parent-task and group rows must not expose offscreen controls');
assert.match(gantt, /timelineScrollHost, 'scroll', scheduleTimelineOffscreenNavRefresh[\s\S]*window, 'resize', scheduleTimelineOffscreenNavRefresh/, 'scrolling and viewport changes must refresh offscreen controls through one scheduled path');
assert.match(gantt, /const visibleLeft = Math\.max\(0, Number\(timelineScrollHost\.scrollLeft\) \|\| 0\)[\s\S]*timelineScrollHost\.clientWidth/, 'compact offscreen controls must use stable scroll-host coordinates instead of two moving client rectangles');
assert.doesNotMatch(gantt, /button\.style\.left\s*=/, 'offscreen controls must not chase touch scrolling by rewriting their horizontal position each frame');
assert.match(gantt, /roundedViewportWidth !== timelineOffscreenNavViewportWidth[\s\S]*button\.dataset\.direction === direction[\s\S]*return;/, 'offscreen control refreshes must avoid repeated CSS-variable and button-state writes while scrolling');
assert.match(gantt, /scheduleTimelineOffscreenNavRefresh\(\);[\s\S]*syncDraggedDependencies/, 'live card movement must keep offscreen visibility in sync with the dragged geometry');
assert.match(gantt, /const offscreenNav = target\.closest\('\[data-tm-gantt-offscreen-nav\]'\)[\s\S]*preventDefault[\s\S]*stopPropagation[\s\S]*tmGanttFocusTask/, 'offscreen controls must center tasks without triggering row selection or drag actions');
assert.match(gantt, /if \(groupId0\) globalThis\.tmGanttFocusGroup\?\.\(groupKind0, groupId0\)[\s\S]*else globalThis\.tmGanttFocusTask/, 'offscreen controls must route group and task entities through the shared focusing interaction');
assert.match(render, /function __tmFocusGanttRange[\s\S]*outsideRenderRange \|\| nearRenderedEdge[\s\S]*centerRangeOnDate[\s\S]*pendingAnchor[\s\S]*__tmRerenderTimelineInPlace/, 'entities beyond the rolling DOM window must rebase around their date and rerender in place');
assert.match(render, /function __tmFocusGanttRange[\s\S]*scrollHost\.scrollTo\(\{ left: targetLeft, behavior: 'smooth' \}\)[\s\S]*window\.tmGanttFocusTask[\s\S]*window\.tmGanttFocusGroup[\s\S]*window\.tmGanttFocusHeading/, 'nearby task, document, and heading ranges must share the same centered scroll helper');
const timelineGestureReset = segment(render, 'function __tmResetTimelineGestureState', 'function __tmRerenderTimelineScaleInPlace');
assert.match(timelineGestureReset, /tm-modal--timeline-touch-lock[\s\S]*tm-gantt-body--dragging-x[\s\S]*host\.focus[\s\S]*host\.blur/, 'scale rerenders must clear stale touch locks and prime the scroll host for the next horizontal gesture');
assert.doesNotMatch(timelineGestureReset, /dispatchEvent|style\.touchAction|requestAnimationFrame/, 'scale gesture reset must not synthesize scroll work or duplicate the host touch-action CSS');
assert.match(services, /__tmTimelineRenderDeps\?\.\(\);[\s\S]*__tmTimelineRefreshOffscreenNav\?\.\(\);/, 'collapse updates must refresh dependency paths and offscreen controls together');
assert.match(styles, /\.tm-gantt-offscreen-nav \{[\s\S]*z-index: 18;[\s\S]*width: 24px;[\s\S]*height: 24px;[\s\S]*pointer-events: none;/, 'offscreen controls must remain compact, row-local, and inert while hidden');
assert.match(styles, /\.tm-gantt-offscreen-nav \{[\s\S]*position: sticky;[\s\S]*left: 8px;[\s\S]*\.tm-gantt-offscreen-nav\[data-direction="right"\] \{[\s\S]*--tm-gantt-offscreen-nav-right/, 'left and right controls must use compositor-stable sticky edge positions during touch scrolling');
assert.match(styles, /\.tm-gantt-offscreen-nav\.tm-gantt-offscreen-nav--visible \{[\s\S]*opacity: 1;[\s\S]*pointer-events: auto;/, 'visible offscreen controls must become operable without reserving row space');

assert.match(styles, /--tm-timeline-month-row-height: 20px;[\s\S]*--tm-timeline-day-row-height: 28px;/, 'timeline headers must use the approved 48px two-level structure');
const headerUpperLabelSource = segment(gantt, 'function formatTimelineHeaderUpperLabel', 'function buildDayCellsHtml');
const formatTimelineHeaderUpperLabel = new Function('normalizeTimelineScale', `${headerUpperLabelSource}; return formatTimelineHeaderUpperLabel;`)(
    (value) => ['day', 'week', 'month'].includes(String(value || '')) ? String(value) : 'day'
);
const august2026 = new Date(2026, 7, 5, 12, 0, 0, 0).getTime();
assert.equal(formatTimelineHeaderUpperLabel('day', august2026), '2026年8月', 'day headers must expose the visible year and month');
assert.equal(formatTimelineHeaderUpperLabel('week', august2026), '2026年8月', 'week headers must expose the visible year and month');
assert.equal(formatTimelineHeaderUpperLabel('month', august2026), '2026年', 'month headers must expose the visible year above month cells');
assert.match(gantt, /data-tm-gantt-header-period-sticky/, 'timeline headers must render a dedicated pinned upper-period label');
assert.match(gantt, /const syncStickyHeaderPeriod[\s\S]*stickyLabelWidth[\s\S]*segmentStartPx[\s\S]*segmentEndPx - stickyLabelWidth[\s\S]*labelLeft = clamp\(scrollLeft, segmentStartPx, maxLabelLeft\)[\s\S]*translate3d\(\$\{labelLeft\}px, 0, 0\)[\s\S]*__tmSyncGanttStickyPeriod = syncStickyHeaderPeriod/, 'the upper period text must stay visible until its own width reaches the period boundary');
assert.doesNotMatch(gantt, /sticky\.style\.width/, 'the upper period text must not be progressively clipped by a shrinking overlay width');
assert.match(timelineStageInteractions, /useGlobalScroll[\s\S]*globalScrollHost\?\.scrollLeft[\s\S]*__tmSyncGanttStickyPeriod\?\.\(scrollLeft\)[\s\S]*bind\(globalScrollHost, 'scroll',[\s\S]*syncHeaderX\(\)/, 'desktop and compact scroll hosts must update the same sticky period label');
assert.match(styles, /\.tm-gantt-month-row::after \{[\s\S]*height: 1px;[\s\S]*background: color-mix/, 'the upper timeline header row must draw a separator above the day, week, or month row');
assert.match(styles, /\.tm-gantt-header-period-sticky \{[\s\S]*position: absolute;[\s\S]*width: max-content;[\s\S]*background: transparent;[\s\S]*overflow: visible;[\s\S]*will-change: transform;/, 'the pinned period label must remain plain unclipped text rather than a header-colored region');
assert.match(styles, /\.tm-gantt-period-cell--upper\.tm-gantt-period-cell--sticky-source \{[\s\S]*color: transparent;/, 'the source period label must hide while its sticky text copy is active');
assert.match(styles, /\.tm-gantt-period-cell \{[\s\S]*box-sizing: border-box;/, 'grouped header widths must include their padding and separator borders');
assert.match(styles, /\.tm-gantt-period-cell \{[\s\S]*position: absolute;[\s\S]*top: 0;/, 'header cells must avoid cumulative fractional flex rounding');
assert.match(styles, /\.tm-gantt-day-bg-layer \{[\s\S]*z-index: 1;[\s\S]*pointer-events: none;/, 'calendar background columns must stay separate from task row content');
assert.match(styles, /\.tm-gantt-day-bg \{[\s\S]*position: absolute;[\s\S]*box-sizing: border-box;/, 'grid cells must share the header day-index coordinate system');
assert.doesNotMatch(styles, /\.tm-gantt-grid-cell[^,{]*--boundary\s*\{|\.tm-gantt-day-bg--month-start\s*\{/, 'vertical period separators must remain header-only');
assert.match(styles, /\.tm-gantt-bar \{[\s\S]*min-width: 0;/, 'short month-scale tasks must keep their exact visual duration');
assert.match(styles, /\.tm-gantt-bar__surface \{[\s\S]*min-width: 0;[\s\S]*padding: 0;/, 'the visible task surface must not expand beyond a narrow week or month date span and make edge handles appear offset');
assert.match(styles, /\.tm-gantt-bar::before \{[\s\S]*width: max\(100%, 22px\);/, 'short bars must retain a separate pointer hit area');
assert.match(styles, /--tm-gantt-card-radius: 8px;/, 'timeline task cards must retain the compact corner radius');
const mobileLongPressBarStyles = segment(styles, '.tm-modal.tm-modal--mobile .tm-gantt-bar {', '.tm-gantt-bar:active {');
assert.match(mobileLongPressBarStyles, /-webkit-user-select: none;[\s\S]*user-select: none;[\s\S]*-webkit-touch-callout: none;/, 'mobile timeline long press must suppress selection and callout');
assert.match(mobileLongPressBarStyles, /touch-action: pan-y;[\s\S]*-ms-touch-action: pan-y;/, 'mobile timeline cards must reserve horizontal gestures for dragging while preserving vertical scrolling');
assert.match(styles, /\.tm-modal\.tm-modal--mobile \.tm-gantt-bar::before \{[\s\S]*touch-action: pan-y;/, 'the expanded mobile card hit target must use the same horizontal gesture ownership');
const ganttGroupChipStyles = segment(styles, '.tm-gantt-group-chip {', '.tm-timeline-split.tm-timeline-split--sidebar-collapsed .tm-gantt-group-chip {');
assert.match(ganttGroupChipStyles, /position: sticky;[\s\S]*left: 8px;[\s\S]*transform: none;/, 'timeline group labels must use native sticky positioning while horizontally scrolling');
assert.doesNotMatch(gantt, /syncGroupChipOffset|scheduleGroupChipOffsetSync|tm-gantt-group-chip-offset/, 'timeline group labels must not lag behind scrolling through frame-delayed transform compensation');
const mobileTableGroupStickyStyles = segment(styles, '.tm-modal.tm-modal--mobile .tm-body.tm-body--timeline .tm-group-row .tm-group-sticky {', '.tm-modal.tm-modal--mobile.tm-modal--timeline-touch-lock');
assert.match(mobileTableGroupStickyStyles, /position: sticky;[\s\S]*left: 0;[\s\S]*transform: none;/, 'expanded mobile timeline table group labels must use the same native sticky behavior');
assert.doesNotMatch(styles, /tm-mobile-timeline-group-shift/, 'obsolete mobile group transform variables must be removed');
const timelineDotZ = Number(styles.match(/\.tm-task-link-dot--timeline \{[\s\S]*?z-index:\s*(\d+);/)?.[1]);
const hoveredTaskZ = Number(styles.match(/\.tm-gantt-bar:hover \{[\s\S]*?z-index:\s*(\d+);/)?.[1]);
assert.ok(Number.isFinite(timelineDotZ) && Number.isFinite(hoveredTaskZ) && timelineDotZ > hoveredTaskZ, 'timeline link dots must stay above hovered task bars');
const todayLineZ = Number(styles.match(/\.tm-gantt-today \{[\s\S]*?z-index:\s*(\d+);/)?.[1]);
assert.ok(Number.isFinite(todayLineZ) && todayLineZ > hoveredTaskZ && todayLineZ < timelineDotZ, 'the current-time line must stay above task cards without covering timeline link dots');
assert.match(styles, /\.tm-gantt-today \{[\s\S]*pointer-events: none;/, 'the elevated current-time line must not intercept timeline interactions');
const dependencyLayerZ = Number(styles.match(/\.tm-gantt-deps \{[\s\S]*?z-index:\s*(\d+);/)?.[1]);
assert.ok(Number.isFinite(dependencyLayerZ) && timelineDotZ > dependencyLayerZ, 'timeline link dots must stay above every dependency path');
const timelineRowStyles = segment(styles, '.tm-gantt-row {', '.tm-gantt-row.tm-gantt-row--multi-selected {');
assert.match(timelineRowStyles, /contain: style;/, 'task rows must not trap link dots below the dependency SVG stacking context');
assert.doesNotMatch(timelineRowStyles, /contain:\s*(?:layout|paint|strict|content)/, 'task rows must not create a stacking context around timeline link dots');
assert.match(styles, /\.tm-gantt-row\.tm-gantt-row--selected \.tm-task-link-dot--timeline,[\s\S]*?\.tm-gantt-row\.tm-gantt-row--dot-open \.tm-task-link-dot--timeline,[\s\S]*?opacity: 1;/, 'selected timeline tasks must show both link dots and their connector lines');
assert.match(styles, /\.tm-gantt-body--dragging-x \.tm-task-link-dot--timeline \{[\s\S]*?opacity: 0 !important;[\s\S]*?pointer-events: none !important;/, 'timeline link dots must stay hidden while dragging or resizing');
assert.match(interactions, /const samePointer = \(e2\) => \{[\s\S]*?session\.pointerId === null\) return true;/, 'mouse-started link drags without a pointer id must accept later pointer events');
assert.match(gantt, /tmTaskLinkDotPressStart\(event,[\s\S]*?'\$\{kind\}'\)[\s\S]*tmTaskLinkDotDragStart\(event,[\s\S]*?'\$\{kind\}'\)/, 'timeline link dots must pass their input or output side into both drag paths');
assert.match(interactions, /function __tmNormalizeTaskLinkSide[\s\S]*return String\(side \|\| ''\)[\s\S]*=== 'in' \? 'in' : 'out'/, 'shared link handlers must default omitted sides to output for whiteboard compatibility');
assert.match(interactions, /const fromId = originSide === 'in' \? targetId : originId;[\s\S]*const toId = originSide === 'in' \? originId : targetId;/, 'dragging from a timeline input dot must persist target-to-origin direction');
assert.match(gantt, /const from = fromSide === 'in'[\s\S]*getPt\(targetTaskId, 'from'\)[\s\S]*const to = fromSide === 'in'[\s\S]*getPt\(fromTaskId, 'to'\)/, 'input-dot previews must run from the target output to the origin input');
assert.match(services, /function __tmEnqueueTimelineMutation[\s\S]*previous\.catch\(\(\) => null\)\.then[\s\S]*const settled = current\.then\(\(\) => null, \(\) => null\)/, 'timeline mutations must run FIFO and a rejected operation must not poison the queue');
assert.match(calendarSupport, /opts\.timelineMutation !== true[\s\S]*__tmEnqueueTimelineMutation\([\s\S]*__tmUpdateTaskDatesCore/, 'timeline date persistence must opt into the shared serial queue at the common date service');
const timelineLinkDrop = segment(interactions, 'window.tmTaskLinkDotDrop = async function', 'window.tmWhiteboardRemoveLink = async function');
assert.match(timelineLinkDrop, /isTimelineDrop[\s\S]*__tmEnqueueTimelineMutation\(commitDrop/, 'timeline link creation must use the shared serial queue');
assert.match(timelineLinkDrop, /if \(!isTimelineDrop\) render\(\)/, 'timeline link creation must avoid a full plugin render');
const timelineLinkRemove = segment(interactions, 'window.tmTimelineRemoveLink = async function', 'function __tmIsWhiteboardCompactSidebarHost');
assert.match(timelineLinkRemove, /__tmEnqueueTimelineMutation\(async \(\) =>[\s\S]*__tmTimelineRenderDeps/, 'timeline link removal must serialize persistence and redraw only dependency lines');
assert.doesNotMatch(timelineLinkRemove, /\brender\s*\(/, 'timeline link removal must not trigger a full plugin render');
assert.match(styles, /\.tm-gantt-row\.tm-gantt-row--link-hover-in \.tm-task-link-dot--in[\s\S]*\.tm-gantt-row\.tm-gantt-row--link-hover-out \.tm-task-link-dot--out/, 'timeline hover feedback must expose the endpoint matching the final link direction');
assert.doesNotMatch(gantt, /tm-gantt-bar--short|const shortClass/, 'timeline bars must not use a synthetic short-task boundary class');
assert.match(styles, /\.tm-modal:not\(\.tm-modal--mobile\) \.tm-gantt-bar-handle \{[\s\S]*top: 4px;[\s\S]*width: 3px;[\s\S]*height: calc\(100% - 8px\);[\s\S]*transform: translateX\(-50%\);/, 'desktop resize markers must use the long narrow edge-centered pattern used by established Gantt implementations');
assert.match(styles, /\.tm-modal:not\(\.tm-modal--mobile\) \.tm-gantt-bar-handle--start \{[\s\S]*left: 0;[\s\S]*\.tm-modal:not\(\.tm-modal--mobile\) \.tm-gantt-bar-handle--end \{[\s\S]*left: 100%;/, 'desktop resize markers must stay on the true start and end boundaries at every zoom level');
assert.match(styles, /\.tm-modal:not\(\.tm-modal--mobile\) \.tm-gantt-bar-handle::before \{[\s\S]*width: 14px;[\s\S]*height: calc\(100% \+ 14px\);[\s\S]*background: transparent;[\s\S]*pointer-events: auto;/, 'desktop resize markers must expose a full-card transparent hit target');
assert.match(styles, /\.tm-modal:not\(\.tm-modal--mobile\) \.tm-gantt-bar-handle--start::before \{[\s\S]*right: 50%;[\s\S]*\.tm-modal:not\(\.tm-modal--mobile\) \.tm-gantt-bar-handle--end::before \{[\s\S]*left: 50%;/, 'short task resize hit targets must extend outward without overlapping or moving the visible markers');
assert.match(styles, /\.tm-task-link-dot--timeline::before \{[\s\S]*pointer-events: none;[\s\S]*\.tm-task-link-dot--timeline::after \{[\s\S]*pointer-events: none;/, 'timeline link-dot decorations must not intercept edge resize handles');
assert.match(styles, /@media \(hover: hover\) and \(pointer: fine\) \{[\s\S]*\.tm-task-link-dot--timeline:hover::before[\s\S]*\.tm-task-link-dot--timeline:hover::after[\s\S]*scale\(1\.18\)/, 'timeline link dots must provide a pointer-only hover highlight without changing layout');
assert.match(styles, /\.tm-modal:not\(\.tm-modal--mobile\) \.tm-gantt-bar-handle:hover \{[\s\S]*background: var\(--tm-primary-color\);[\s\S]*box-shadow:/, 'desktop resize handles must visibly highlight when the pointer reaches their hit target');
const mobileHandleDefaultStyles = segment(styles, '.tm-modal.tm-modal--mobile .tm-gantt-bar-handle {', '.tm-modal.tm-modal--mobile .tm-gantt-row.tm-gantt-row--selected .tm-gantt-bar-handle,');
assert.match(mobileHandleDefaultStyles, /opacity: 0;[\s\S]*pointer-events: none;/, 'unselected mobile resize handles must be invisible and excluded from hit testing');
const mobileHandleSelectedStyles = segment(styles, '.tm-modal.tm-modal--mobile .tm-gantt-row.tm-gantt-row--selected .tm-gantt-bar-handle,', '.tm-modal.tm-modal--mobile .tm-gantt-bar-handle::before {');
assert.match(mobileHandleSelectedStyles, /tm-gantt-row--dot-open[\s\S]*opacity: 1;[\s\S]*pointer-events: auto;/, 'selected mobile cards must expose both resize handles');
assert.doesNotMatch(mobileHandleSelectedStyles, /:hover|tm-gantt-bar--dragging/, 'mobile handle availability must not depend on desktop hover or whole-card dragging');
const mobileHandleGeometryStyles = segment(styles, '.tm-modal.tm-modal--mobile .tm-gantt-bar-handle {', '.tm-modal.tm-modal--mobile .tm-gantt-row.tm-gantt-row--selected .tm-gantt-bar__menu-btn,');
assert.match(mobileHandleGeometryStyles, /width: 4px;[\s\S]*transform: translateX\(-50%\);/, 'mobile resize markers must use narrow boundary-centered anchors even when week or month cards are only a few pixels wide');
assert.match(mobileHandleGeometryStyles, /tm-gantt-bar-handle::before[\s\S]*width: 24px;[\s\S]*background: transparent;[\s\S]*pointer-events: auto;/, 'mobile resize markers must retain a large transparent touch target');
assert.match(mobileHandleGeometryStyles, /tm-gantt-bar-handle--start \{[\s\S]*left: 0;[\s\S]*tm-gantt-bar-handle--end \{[\s\S]*left: 100%;/, 'mobile resize markers must stay on the true start and end boundaries');
assert.match(mobileHandleGeometryStyles, /tm-gantt-bar-handle--start::before[\s\S]*right: 50%;[\s\S]*tm-gantt-bar-handle--end::before[\s\S]*left: 50%;/, 'mobile touch targets must extend outward so narrow week and month handles never overlap');
assert.match(styles, /\.tm-timeline-floating-toolbar__btn \{[\s\S]*width: 36px;[\s\S]*height: 36px;[\s\S]*border-radius: 14px;/, 'timeline floating controls must match the whiteboard toolbar button dimensions');
assert.match(styles, /\.tm-timeline-floating-toolbar \.tm-timeline-toolbar-icon__svg \{[\s\S]*width: 20px;[\s\S]*height: 20px;/, 'timeline floating icons must match the whiteboard toolbar icon size');
assert.match(styles, /\.tm-timeline-floating-toolbar \.tm-timeline-scale-menu__trigger \{[\s\S]*height: 36px;[\s\S]*border-radius: 14px;/, 'the floating scale trigger must share the whiteboard toolbar control height and radius');
assert.doesNotMatch(styles, /\.tm-timeline-floating-toolbar--desktop \.tm-timeline-floating-toolbar__btn \{/, 'desktop and compact timeline toolbars must use one shared button size rule');
assert.doesNotMatch(styles, /tm-main-stage--timeline-floating-toolbar[\s\S]{0,160}112px/, 'the floating timeline toolbar must overlay the canvas instead of padding it');
const mobileToolbarStyles = segment(styles, '.tm-timeline-floating-toolbar__inner {', '.tm-timeline-floating-toolbar__btn {');
assert.doesNotMatch(mobileToolbarStyles, /backdrop-filter/, 'the timeline toolbar must use a solid SiYuan surface instead of glass blur');

console.log('timeline scale contract tests passed');
