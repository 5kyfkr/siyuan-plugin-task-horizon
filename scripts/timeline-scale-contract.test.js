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
const localTaskTimeRefresh = read('src/task-horizon/main/render/46-render-local-task-time-refresh.js');
const resizeControls = read('src/task-horizon/main/render/45-render-shell-controls-and-resize.js');
const interactions = read('src/task-horizon/main/render/49-render-whiteboard-interactions.js');
const services = read('src/task-horizon/main/20-api-and-runtime-services.js');
const calendarSupport = read('src/task-horizon/main/render/48-render-calendar-support-runtime.js');
const taskRuntime = read('src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js');
const taskDetailLoader = read('src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js');
const icons = read('src/task-horizon/main/30-dialogs-and-ui-foundation.js');
const stores = read('src/task-horizon/main/10-stores-rules-and-cache.js');
const columnSettings = read('src/task-horizon/main/settings/62-settings-columns-and-rules.js');
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
assert.match(pointerDrag, /useMobileLongPressMove = !!\(isMobileTimelineGlobal && !handleEl && pointerType === 'touch'\)[\s\S]*isMobileTimelineGlobal && !handleEl && !useMobileLongPressMove/, 'mobile whole-card dragging must be limited to touch long press while resize handles remain direct');
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
assert.match(pointerDrag, /const onUp = async \(ev\) =>[\s\S]*!pointerCanceled && Number\.isFinite\(Number\(ev\?\.clientX\)\)[\s\S]*!pointerCanceled && dragActive\) onMove\(\{ clientX: lastPointerX \}\);[\s\S]*await onUpdateTaskDates/, 'normal pointer release must flush the final resize frame before persisting dates');
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
for (const iconName of ['sidebar', 'calendar-blank', 'ruler', 'caret-down', 'corners-out']) {
    assert.match(icons, new RegExp(`__tmPhosphorBoldPaths\\['${iconName}'\\] =`), `${iconName} must have a real Phosphor Bold path`);
}

assert.match(body, /useMobileTimelineSidebar[\s\S]*state\.timelineMobileSidebarExpanded !== true/, 'mobile timelines must start with an effective collapsed sidebar');
assert.match(interactions, /useMobileRuntimeState[\s\S]*const expanding = state\.timelineMobileSidebarExpanded !== true;[\s\S]*timelineMobileSidebarExpanded = expanding/, 'mobile sidebar toggles must stay runtime-only');
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
assert.match(styles, /\.tm-body--timeline-compact \.tm-timeline-sidebar-overlay \{[\s\S]*position: absolute;[\s\S]*inset: 0;[\s\S]*z-index: 30;[\s\S]*background: var\(--tm-bg-color\);/, 'the compact task table must be a viewport-bound opaque layer above the timeline');
assert.match(styles, /\.tm-body--timeline-compact \.tm-timeline-sidebar-overlay \.tm-timeline-left-body \{[\s\S]*overflow: auto;[\s\S]*overscroll-behavior: contain;/, 'wide custom timeline columns and rows must remain independently scrollable inside the overlay');
assert.match(services, /scheduleInfiniteRangeShift[\s\S]*tmGanttExtendRange\?\.\(direction\)/, 'timeline scrolling must request a range shift near either edge');
assert.match(services, /const scrollableWidth = Math\.max\(0, totalWidth - viewportWidth\);[\s\S]*Math\.min\(viewportWidth, Math\.max\(96, scrollableWidth \/ 3\)\)/, 'rolling ranges must rebase before the viewport reaches a rendered edge');
assert.match(services, /const globalScrollLeft = useGlobalScroll[\s\S]*leftPaneWidth > 0 && globalScrollLeft < leftPaneWidth\) return;/, 'showing the mobile or dock table pane must not trigger an infinite timeline range shift');
assert.doesNotMatch(services, /__tmSyncTimelineMobileGroupStickyOffset|__tmMobileTimelineGroupShift/, 'mobile timeline group labels must not use frame-delayed scroll compensation');
assert.match(services, /tm-gantt-body--dragging-x[\s\S]*tm-modal--timeline-touch-lock/, 'range shifts must wait until existing mouse and touch drags finish');
assert.match(services, /requestAnimationFrame\(\(\) => requestAnimationFrame\(\(\) => \{[\s\S]*inner\.style\.transform = `translateX\(\$\{-ganttBody\.scrollLeft\}px\)`/, 'in-place range shifts must resync the header after layout settles');

assert.match(gantt, /data-task-start-ts="\$\{Number\(aTs\) \|\| 0\}"[\s\S]*data-task-end-ts="\$\{Number\(bTs\) \|\| 0\}"/, 'task rows must retain date coordinates even when their cards fall outside the bounded render window');
assert.match(gantt, /function buildTimelineOffscreenNavHtml[\s\S]*data-tm-gantt-offscreen-nav[\s\S]*__tmPhosphorBoldSvg\('chevron-left'[\s\S]*__tmPhosphorBoldSvg\('chevron-right'/, 'offscreen task navigation must use compact Phosphor Bold edge controls');
assert.match(gantt, /getTimelineRowInterval[\s\S]*bar\.style\.left[\s\S]*bar\.style\.width[\s\S]*taskStartTs[\s\S]*taskEndTs/, 'offscreen detection must prefer live card geometry and fall back to task dates beyond the rendered range');
assert.match(gantt, /interval\?\.right <= visibleLeft \+ 1[\s\S]*interval\?\.left >= visibleRight - 1[\s\S]*hideTimelineOffscreenNav/, 'only fully offscreen cards may expose a left or right location control');
assert.match(gantt, /row\.hidden \|\| row\.style\.display === 'none'[\s\S]*hideTimelineOffscreenNav/, 'collapsed parent-task and group rows must not expose offscreen controls');
assert.match(gantt, /timelineScrollHost, 'scroll', scheduleTimelineOffscreenNavRefresh[\s\S]*window, 'resize', scheduleTimelineOffscreenNavRefresh/, 'scrolling and viewport changes must refresh offscreen controls through one scheduled path');
assert.match(gantt, /const visibleLeft = Math\.max\(0, Number\(timelineScrollHost\.scrollLeft\) \|\| 0\)[\s\S]*timelineScrollHost\.clientWidth/, 'compact offscreen controls must use stable scroll-host coordinates instead of two moving client rectangles');
assert.doesNotMatch(gantt, /button\.style\.left\s*=/, 'offscreen controls must not chase touch scrolling by rewriting their horizontal position each frame');
assert.match(gantt, /roundedViewportWidth !== timelineOffscreenNavViewportWidth[\s\S]*button\.dataset\.direction === direction[\s\S]*return;/, 'offscreen control refreshes must avoid repeated CSS-variable and button-state writes while scrolling');
assert.match(gantt, /scheduleTimelineOffscreenNavRefresh\(\);[\s\S]*syncDraggedDependencies/, 'live card movement must keep offscreen visibility in sync with the dragged geometry');
assert.match(gantt, /const offscreenNav = target\.closest\('\[data-tm-gantt-offscreen-nav\]'\)[\s\S]*preventDefault[\s\S]*stopPropagation[\s\S]*tmGanttFocusTask/, 'offscreen controls must center tasks without triggering row selection or drag actions');
assert.match(render, /window\.tmGanttFocusTask = function[\s\S]*outsideRenderRange \|\| nearRenderedEdge[\s\S]*centerRangeOnDate[\s\S]*pendingAnchor[\s\S]*__tmRerenderTimelineInPlace/, 'tasks beyond the rolling DOM window must rebase around their date and rerender in place');
assert.match(render, /tmGanttFocusTask[\s\S]*scrollHost\.scrollTo\(\{ left: targetLeft, behavior: 'smooth' \}\)/, 'nearby offscreen tasks must scroll to the viewport center');
const timelineGestureReset = segment(render, 'function __tmResetTimelineGestureState', 'function __tmRerenderTimelineScaleInPlace');
assert.match(timelineGestureReset, /tm-modal--timeline-touch-lock[\s\S]*tm-gantt-body--dragging-x[\s\S]*host\.focus[\s\S]*host\.blur/, 'scale rerenders must clear stale touch locks and prime the scroll host for the next horizontal gesture');
assert.doesNotMatch(timelineGestureReset, /dispatchEvent|style\.touchAction|requestAnimationFrame/, 'scale gesture reset must not synthesize scroll work or duplicate the host touch-action CSS');
assert.match(services, /__tmTimelineRenderDeps\?\.\(\);[\s\S]*__tmTimelineRefreshOffscreenNav\?\.\(\);/, 'collapse updates must refresh dependency paths and offscreen controls together');
assert.match(styles, /\.tm-gantt-offscreen-nav \{[\s\S]*z-index: 18;[\s\S]*width: 24px;[\s\S]*height: 24px;[\s\S]*pointer-events: none;/, 'offscreen controls must remain compact, row-local, and inert while hidden');
assert.match(styles, /\.tm-gantt-offscreen-nav \{[\s\S]*position: sticky;[\s\S]*left: 8px;[\s\S]*\.tm-gantt-offscreen-nav\[data-direction="right"\] \{[\s\S]*--tm-gantt-offscreen-nav-right/, 'left and right controls must use compositor-stable sticky edge positions during touch scrolling');
assert.match(styles, /\.tm-gantt-offscreen-nav\.tm-gantt-offscreen-nav--visible \{[\s\S]*opacity: 1;[\s\S]*pointer-events: auto;/, 'visible offscreen controls must become operable without reserving row space');

assert.match(styles, /--tm-timeline-month-row-height: 20px;[\s\S]*--tm-timeline-day-row-height: 28px;/, 'timeline headers must use the approved 48px two-level structure');
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
