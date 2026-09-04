'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'calendar-view.js'), 'utf8');
const styles = fs.readFileSync(path.resolve(__dirname, '..', 'calendar-view.css'), 'utf8');

assert.match(
    source,
    /function getCalendarUpdateSizeSignature\(calendar, rootEl, scope\)[\s\S]*activeStart[\s\S]*dayMaxEventRows/,
    'calendar layout must derive updateSize invalidation from dimensions and view/options',
);
assert.match(source, /state\.sideDay\?\.prototypeRender\?\.\(\)/, 'sidebar layout must repaint the prototype surface');
assert.match(source, /function scheduleSyncTimeGridAllDayCollapseUi\(rootEl, calendar\)[\s\S]*state\.queuePrototypeSurfaceRender/, 'all-day layout sync must repaint the prototype surface');
assert.match(
    source,
    /function scheduleMainCalendarMonthLayoutPass\(host, calendar\)[\s\S]*__tmMonthLayoutPassToken[\s\S]*String\(getCalendarView\(targetCalendar\)\?\.type \|\| ''\)\.trim\(\) !== 'dayGridMonth'/,
    'stale month layout frames must be discarded after switching away from month view',
);
assert.doesNotMatch(
    source,
    /requestAnimationFrame\(\(\) => \{[\s\S]*requestAnimationFrame\(\(\) => \{[\s\S]*month-day-max-changed/,
    'month dayMax changes must not enqueue a second nested layout frame',
);
assert.match(
    source,
    /progressiveEventRendering: false[\s\S]*dayMaxEvents: preferredInitialView/,
    'main calendar view switches must avoid progressive partial source paints',
);
assert.match(
    source,
    /const viewSwitching = wrap\.classList\.contains\('tm-calendar-wrap--view-switching'\)[\s\S]*if \(!viewSwitching\)[\s\S]*scheduleMainCalendarLayoutRefresh/,
    'main eventsSet must not schedule layout work for every partial source during a view switch',
);
assert.match(
    source,
    /const isMainCalendarEventSourceRequestCurrent = \(sourceId, viewType, info\)[\s\S]*mainCalendarEventSourceRequestSignatures\.get\(sourceKey\)[\s\S]*const dropStaleMainCalendarEventSourceResult/,
    'main source callbacks must drop results that belong to a previous view or range',
);
assert.match(
    source,
    /function deferMainCalendarViewDataLoad\(calendar, nextView\)[\s\S]*requestAnimationFrame\(queueRefetch\)[\s\S]*refetchEvents/,
    'view buttons must let the new view paint before refetching its event sources',
);
assert.match(
    source,
    /view-switch-deferred[\s\S]*success\(\[\]\)[\s\S]*deferred: true/,
    'event sources must return an empty shell while a view switch is being committed',
);
assert.match(
    source,
    /const onMainViewButtonClickCapture = \(e\) => \{[\s\S]*deferMainCalendarViewDataLoad\(activeCalendar, nextView\)[\s\S]*callCalendarAdapter\(activeCalendar, 'changeView', nextView, targetDate\)/,
    'view button capture must commit the requested view directly while data refresh remains deferred',
);
assert.match(
    source,
    /e\.preventDefault\?\.\(\); e\.stopPropagation\?\.\(\);[\s\S]*callCalendarAdapter\(activeCalendar, 'changeView', nextView, targetDate\)/,
    'built-in view button handling must synchronously enter the calendar adapter after stopping the native handler',
);
assert.match(
    source,
    /const available = Number\(metric\.eventsHeight \|\| 0\) > 0[\s\S]*available \+ gap[\s\S]*Math\.max\(1, pitch\)/,
    'month capacity must measure one shared row budget before reserving the +N row',
);
assert.match(
    source,
    /const getRepresentativeCapacity = \(capacities\) =>[\s\S]*upper median[\s\S]*const getEventCapacity = getRepresentativeCapacity;/,
    'month adaptive capacity must ignore one transient low-capacity cell instead of using a global minimum',
);
assert.match(
    source,
    /const nextVisible = adaptiveRows[\s\S]*Math\.min\(configuredVisible, Math\.max\(1, eventCapacity\)\)/,
    'month adaptive capacity must respect the configured default visible-event count',
);
assert.match(
    source,
    /const getPrototypeMonthRowHeight = \(\) => Math\.max\([\s\S]*normalizeCalendarMonthMinVisibleEvents\(getSettings\(\)\?\.monthMinVisibleEvents\)[\s\S]*PROTO_MONTH_EVENT_PITCH/,
    'fixed month rows must derive their height from the configured visible-event count',
);
assert.match(
    source,
    /canvas\.style\.height = `\$\{geometry\.totalWeeks \* geometry\.rowHeight\}px`[\s\S]*canvas\.style\.setProperty\('--tm-proto-month-min-row-height', `\$\{geometry\.rowHeight\}px`\)/,
    'month canvas and cells must share the recalculated row height',
);
assert.match(
    source,
    /const protoBuildMonthCompactedLayout = \(days, events, options = \{\}\) =>[\s\S]*requiredRows = spanRowsForDay\(segments\)[\s\S]*\+ \(hasHidden \? 1 : 0\)/,
    'month rendering must reserve one shared +N row for span or regular overflow',
);
assert.match(
    source,
    /const protoBuildMonthCompactedLayout = \(days, events, options = \{\}\) =>[\s\S]*const hiddenSegments = new Set\(\)[\s\S]*markSpanHidden = \(segment\)/,
    'month overflow must fold a colliding span segment before markup is emitted',
);
assert.doesNotMatch(
    source,
    /if \(spanLanes > 0 && regularCount > 0 && totalRows <= spanLanes\) return false;/,
    'month span budgeting must not globally fold unrelated weeks because one cell is compact',
);
assert.match(
    source,
    /const maxMeasuredCapacity = measuredCapacities\.length[\s\S]*spanLimit: Math\.max\(spanLaneLimit, maxMeasuredCapacity, configuredVisible\)/,
    'month span compaction must use the full measured row budget instead of hiding a whole weekly row',
);
assert.match(
    source,
    /const schedulePrototypeMonthOverflowRepair = \(\) => \{[\s\S]*eventsHeight - 2[\s\S]*const capacity = Math\.floor\(Math\.max\(0, available \+ gap\) \/ Math\.max\(1, pitch\)\)[\s\S]*prototypeMonthCapacityByDay = nextCapacityByDay/,
    'month overflow must re-read painted cell heights and lower over-budget days so tail events fold into +N',
);
assert.match(
    source,
    /if \(eventApi\?\.allDay === true\)[\s\S]*const startDay = new Date\(start\.getTime\(\)\)[\s\S]*configuredDay\?\.setHours\(0, 0, 0, 0\)[\s\S]*return fallback;/,
    'all-day event end resolution must normalize date-only boundaries to local midnight',
);
assert.match(
    source,
    /const eventStart = eventApi\?\.allDay === true[\s\S]*\? protoDayStart\(eventApi\?\.start\)[\s\S]*: protoSafeDate\(eventApi\?\.start\)/,
    'all-day range matching must normalize the event start before day overlap checks',
);
assert.match(
    source,
    /const protoEventEnd = \(eventApi\) =>[\s\S]*if \(eventApi\?\.allDay === true\) return resolveSharedPrototypeEventEnd\(eventApi\)/,
    'month and timeline renderers must share the normalized all-day end boundary',
);
assert.match(
    source,
    /const protoEventEnd = \(eventApi\) =>[\s\S]*if \(end && end\.getTime\(\) > start\.getTime\(\)\) return end;[\s\S]*return configuredDate/,
    'main prototype timeline must prefer the live timed end over an all-day date boundary',
);
assert.match(
    source,
    /const wasTimedPreview = !isMonthCell && \([\s\S]*drag\.previewMode === 'timed'[\s\S]*drag\.previewStart = null;[\s\S]*drag\.previewEnd = null;[\s\S]*drag\.previewKey = '';[\s\S]*renderPrototypeSurface\(\)/,
    'main all-day drags must clear and repaint the timed preview when returning to the all-day lane',
);
assert.match(
    source,
    /const rect = col\.getBoundingClientRect\?\.\(\);[\s\S]*x >= rect\.left[\s\S]*x <= rect\.right[\s\S]*y >= rect\.top[\s\S]*y <= rect\.bottom/,
    'timed-drop hit testing must require the pointer to be vertically inside the time column',
);
assert.match(
    source,
    /if \(eventApi\.allDay === true && !drag\.resizeEdge && !timedDrop && drag\.previewMode === 'timed'\)[\s\S]*drag\.previewStart = null;[\s\S]*drag\.previewEnd = null;[\s\S]*drag\.previewKey = '';/,
    'pointerup outside the time axis must discard any stale timed projection before committing an all-day drop',
);
assert.match(
    source,
    /const timedTarget = resolvePrototypeTimedDropAtPoint\(event\.clientX, event\.clientY\)[\s\S]*const targetDay = timedTarget\?\.start \? protoDayStart\(timedTarget\.start\) : null[\s\S]*drag\.previewMode = 'timed'[\s\S]*renderPrototypeSurface\(\)/,
    'timed event drags must project the live candidate into the pointer target column',
);
assert.match(
    source,
    /const resizeTarget = timedTarget\?\.start instanceof Date[\s\S]*if \(drag\.resizeEdge === 'start'\)[\s\S]*const latestStart = new Date\(previewEndBase\.getTime\(\) - 30 \* 60000\)[\s\S]*else if \(drag\.resizeEdge === 'end'\)[\s\S]*const earliestEnd = new Date\(previewStartBase\.getTime\(\) \+ 30 \* 60000\)/,
    'timed resize handles must use the absolute pointer date so cross-day edge adjustments work',
);
assert.match(
    source,
    /: \(resolvePrototypeDayAtPoint\(drag, event\.clientX, event\.clientY\) \|\| protoDayStart\(sourceStart\)\);/,
    'timed event pointerup must resolve the target day from calendar geometry instead of elementFromPoint alone',
);
assert.match(
    source,
    /if \(viewType === 'dayGridMonth'\)[\s\S]*const affectedWeekIndexes = new Set\(\)[\s\S]*prototypeMonthVirtualEvents = events[\s\S]*buildPrototypeMonthWeekRowMarkup[\s\S]*existing\.replaceWith\(nextRow\)/,
    'month snapshot changes must rebuild only affected virtual week rows',
);
assert.match(
    source,
    /const forEachPrototypeSnapshotDay = \(snapshot, callback\)[\s\S]*const lastDay = protoDayStart\(new Date\(endMs - 1\)\)/,
    'partial-refresh day ranges must include same-day timed events and exclude midnight end boundaries',
);
assert.doesNotMatch(
    source,
    /calendar-trace|__tmCalendarTraceLog/,
    'calendar trace diagnostics must not generate production console output',
);
assert.match(
    source,
    /const partialContextKey = \[/,
    'drag rendering must build a stable partial-render context',
);
assert.match(source, /prototypePendingPartialRefresh\.partialContextKey === partialContextKey/, 'drag commit must reuse the stable partial-render context');
assert.match(source, /const renderContextKey = \[[\s\S]*activeDragPreview\?\.previewKey/, 'the full render key must still distinguish live drag previews');
assert.match(
    source,
    /capturePrototypeMonthLoadingScroll[\s\S]*restorePrototypeMonthLoadingScroll[\s\S]*prototypeMonthLoadingScrollSnapshot/,
    'month loading must preserve the virtual scroller position',
);
assert.match(
    source,
    /const remapPrototypeMonthScrollTop = \(scrollTop, anchorDate, geometry, previousGeometryKey, fallbackRowHeight\)[\s\S]*relativeTop \* \(nextRowHeight \/ previousRowHeight\)[\s\S]*rawTop \* \(nextRowHeight \/ previousRowHeight\)/,
    'month geometry changes must convert the old pixel scroll position to the new row-height coordinate system',
);
assert.match(
    source,
    /const previousGeometryKey = String\(prototypeMonthVirtualGeometryKey \|\| ''\)\.trim\(\)[\s\S]*remapPrototypeMonthScrollTop\([\s\S]*savedTop/,
    'month canvas rebuilds must remap saved scroll state instead of reusing stale pixels',
);
assert.match(
    source,
    /scrollTop: trace\.scrollTop,[\s\S]*rowHeight: Number\(getPrototypeMonthRowHeight\(\)\)[\s\S]*state\.__tmMonthScrollTop = Number\(scroller\.scrollTop \|\| 0\);[\s\S]*state\.__tmMonthScrollRowHeight = Number\(getPrototypeMonthRowHeight\(\)\)/,
    'month scroll persistence must retain the row height used to record the pixel anchor',
);
assert.match(
    source,
    /if \(isMonth\) \{[\s\S]*prototypeMonthLoadingScrollSnapshot = null;[\s\S]*scrollPrototypeMonthToDate\(today, 'auto', 'today-button'\)/,
    'today navigation must invalidate stale month load restores before repositioning the virtual strip',
);
assert.match(
    source,
    /if \(monthVirtualInPlace && previousMonthScroller instanceof HTMLElement[\s\S]*currentMonthScroller\.scrollTop = previousMonthScrollTop/,
    'in-place month renders must restore scrollTop when a data repaint changes it',
);
assert.match(
    source,
    /wrap\.classList\.remove\('tm-calendar-wrap--view-switching'\)[\s\S]*host\.classList\.remove\('tm-cal-view-switching'\)[\s\S]*requestAnimationFrame\(\(\) => \{[\s\S]*schedulePrototypeMonthAdaptiveMeasure\(\)/,
    'month capacity must be remeasured after view-switching styles are removed',
);
assert.match(
    source,
    /const viewSwitching = prototypeSurface\?\.classList\?\.contains\?\.\('tm-cal-view-switching'\)[\s\S]*prototypeMonthMeasureAgain = true;/,
    'month adaptive measurement must defer while the view-switching state is active',
);
assert.match(
    source,
    /const eventsHeight = Number\(cell\.querySelector\('\.tm-proto-month-events'\)\?\.getBoundingClientRect\?\.\(\)\.height \|\| 0\)[\s\S]*const available = eventsHeight > 0[\s\S]*available \+ gap/,
    'month span-lane capacity must use the actual event-container height shared with regular events',
);
assert.doesNotMatch(
    source,
    /const available = cellHeight - headHeight - padding - reserve - moreReserve - 2;/,
    'month capacity must not collapse fitting events because of a phantom +N reserve',
);
assert.match(
    source,
    /const regularCapacity = Math\.max\(0, allDayCapacity - spanLaneCount\);/,
    'timeline all-day capacity must keep raw regular capacity separate from the shared +N row',
);
assert.match(
    source,
    /const hasAllDayOverflow = hiddenSpanCount > 0 \|\| regularEvents\.length > regularCapacity;/,
    'timeline all-day overflow must share one +N row across hidden spans and regular events',
);
assert.match(
    source,
    /const nextSpanLanes = candidateSpanLanes;/,
    'month span lanes must use the same measured row budget as the regular-event stack',
);
assert.match(
    source,
    /const regularStack = `<div class="tm-proto-month-regular-stack">/,
    'month regular events and +N must render inside a bounded stack',
);
assert.match(
    source,
    /Span lanes and regular chips use the same measured budget[\s\S]*final row for \+N only when needed/,
    'month overflow must use one shared budget instead of independently compacting spans and regular events',
);
assert.match(
    source,
    /const spanLaneLimit = prototypeMonthMeasurementReady && Number\.isFinite\(configuredSpanLanes\)[\s\S]*prototypeMonthLastCommittedSpanLanes[\s\S]*adaptiveRows \? 1 : configuredVisible/,
    'month rendering must reuse the last stable lane budget during switching and keep a finite configured fallback lane',
);
assert.match(
    source,
    /const requestedSpanLanes = adaptiveRows && spanCapacity > 0[\s\S]*Math\.min\(6, configuredVisible, spanCapacity\)[\s\S]*const candidateSpanLanes = Math\.max\(0, Math\.floor\(Number\(requestedSpanLanes\)/,
    'month mode must keep a finite configured cross-week lane budget for per-week compaction',
);
assert.match(
    source,
    /const measuredCapacities = days[\s\S]*renderCapacityByDay\.get\(protoDateKey\(date\)\)[\s\S]*capacityByDay: renderCapacityByDay/,
    'measured per-cell capacity must constrain the unified month compactor in adaptive and fixed-row modes',
);
assert.match(
    source,
    /if \(lane >= laneLimit\) \{[\s\S]*const segmentEnd = rowEnd[\s\S]*dayIndex < segmentEnd[\s\S]*cursor = segmentEnd/,
    'month span overflow must fold the entire overflowing week segment into that day\'s +N summary',
);
assert.match(
    source,
    /const monthScheduleOverlap = new Set\(\)[\s\S]*__tmScheduledTaskDayKeys: Array\.from\(monthScheduleOverlap\)/,
    'month task-date dedupe must retain the event and record only concrete schedule days',
);
assert.match(
    source,
    /const scheduledDayKeys = new Set\([\s\S]*while \(segmentStart < rowEnd && isScheduledDay\(segmentStart\)\)[\s\S]*while \(runEnd < rowEnd && !isScheduledDay\(runEnd\)\)/,
    'month task-date spans must split around scheduled days while retaining unscheduled runs',
);
assert.match(
    source,
    /const isScheduleSplit = monthScheduleOverlap\.size > 0[\s\S]*editable: !isReadOnlyInstance && !isScheduleSplit[\s\S]*__tmTaskDateScheduleSplit: isScheduleSplit/,
    'schedule-split task-date spans must be non-editable',
);
assert.match(
    source,
    /const isScheduleSplit = ext\.__tmTaskDateScheduleSplit === true[\s\S]*!isScheduleSplit && !continuation[\s\S]*!isScheduleSplit && isEventEnd/,
    'schedule-split task-date spans must not render date resize handles',
);
assert.match(
    source,
    /const isMonthPopover = viewType === 'dayGridMonth'[\s\S]*!isMonthPopover \|\| String\(ext\.__tmSource \|\| ''\)\.trim\(\) !== 'taskdate'/,
    'only the month +N popover may hide task-date entries covered by concrete schedules',
);
assert.doesNotMatch(
    source,
    /const hiddenEvents = new Set\(\)[\s\S]*Folding is event-wide/,
    'month span overflow must not hide every segment of a logical cross-day event',
);
assert.match(
    source,
    /const hasUsableCellGeometry = cells\.every\(\(cell\) =>[\s\S]*if \(!hasUsableCellGeometry\) \{\s*retryMonthMeasureForPendingGeometry\(\);[\s\S]*prototypeMonthPendingGeometryRetries = 0;/,
    'month adaptive measurement must keep remeasuring zero-height transient geometry instead of committing or giving up',
);
assert.match(
    source,
    /const geometryKey = cells\.map\(\(cell\) =>[\s\S]*two consecutive frames report the same cell\/event heights[\s\S]*geometryKey !== prototypeMonthMeasurementGeometryKey/,
    'month adaptive measurement must wait for a stable real cell height before committing capacity',
);
assert.match(
    source,
    /prototypeMonthCapacityRangeKey !== monthRangeKey[\s\S]*prototypeMonthCapacityByDay = new Map\(\)[\s\S]*prototypeMonthMeasurementReady = false/,
    'month capacity must reset when the visible range or adaptive mode changes',
);
assert.match(
    source,
    /prototypeMonthLastViewType !== viewType[\s\S]*prototypeMonthCapacityRangeKey !== monthRangeKey/,
    'returning to month view must not reuse a stale budget from another view',
);
assert.match(
    source,
    /prototypeMonthLastCommittedSpanLanes = nextSpanLanes[\s\S]*prototypeMonthMeasurementReady = true/,
    'month measurement must publish the lane budget only after the full geometry pass commits',
);
assert.match(
    source,
    /invalidatePrototypeMonthMeasurement\(\{ resetRenderKey: false, resetBudget: false \}\)[\s\S]*schedulePrototypeMonthAdaptiveMeasure\(\)/,
    'event-source updates must preserve the committed month budget until the refreshed geometry is measured',
);
assert.doesNotMatch(
    source,
    /if \(isMonthView && viewSwitching\) prototypeSurface\.style\.removeProperty\('--tm-proto-span-lanes'\)/,
    'month layout sync must not clear the committed span budget during a loading/view-switch frame',
);
assert.doesNotMatch(
    styles,
    /\.tm-proto-time-col > \.tm-proto-event--block:hover\s*\{[^}]*transform:\s*translateY\(-1px\)/,
    'prototype timeline event hover must not lift the event card',
);
assert.doesNotMatch(
    styles,
    /\.tm-proto-time-col > \.tm-proto-event--block\s*\{[^}]*transition:[^;]*transform/,
    'prototype timeline event hover must not animate geometric lifting',
);
assert.match(
    styles,
    /\.tm-proto-time-col > \.tm-proto-event--block:hover\s*\{[^}]*box-shadow:/,
    'prototype timeline event hover must retain a shadow-only emphasis',
);
assert.match(
    styles,
    /\.tm-proto-month-regular-stack\s*\{[^}]*max-height:\s*100%;[^}]*overflow:\s*hidden;/,
    'month regular-event stack must clip at the cell boundary in compact heights',
);
assert.match(
    styles,
    /\.tm-proto-month-regular-stack > \.tm-proto-more\s*\{[^}]*height:\s*22px;[^}]*min-height:\s*22px;/,
    'month +N must stay on the same compact row rhythm as the event chips',
);
assert.match(
    styles,
    /\.tm-proto-month-events > \.tm-proto-span-bar\.is-continuation-start\s*\{[^}]*box-shadow:\s*none\s*!important;/,
    'cross-month continuation bars must not show a false leading stripe',
);
assert.match(
    styles,
    /\.tm-proto-event--chip \.tm-proto-event-check,[\s\S]*?\.tm-proto-span-bar \.tm-proto-event-check,[\s\S]*?\{[^}]*width:\s*14px\s*!important;[^}]*border:\s*1\.5px solid var\(--tm-proto-event-color\)\s*!important;[^}]*background:\s*#fff\s*!important;/,
    'calendar event checkboxes must use the prototype-sized white-centered circular treatment',
);
assert.match(
    styles,
    /\.tm-proto-event--chip \.tm-proto-event-check,[\s\S]*?\.tm-proto-span-bar \.tm-proto-event-check,[\s\S]*?\{[^}]*mask:\s*none\s*!important;[^}]*animation:\s*none\s*!important;[^}]*transform:\s*none\s*!important;/,
    'calendar event checkboxes must neutralize theme masks and entrance animation',
);
assert.match(
    styles,
    /\.tm-proto-event-checkmark\s*\{[\s\S]*?width:\s*3\.5px;[\s\S]*?height:\s*7px;[\s\S]*?border-right:\s*2px solid #fff;[\s\S]*?border-bottom:\s*2px solid #fff;[\s\S]*?rotate\(45deg\)[\s\S]*?\.tm-proto-event-check:checked \+ \.tm-proto-event-checkmark\s*\{[\s\S]*?display:\s*block;/,
    'completed calendar checkboxes must reuse the checklist view check geometry instead of a text glyph',
);
assert.match(
    source,
    /function isCalendarBuiltinScheduleEvent\(ext\)[\s\S]*?if \(isCalendarBuiltinScheduleEvent\(ext\)\) return false;/,
    'calendar built-in schedules must be the only event source excluded from checkboxes',
);
assert.match(
    source,
    /const monthAnchor = protoDayStart\(options\.monthAnchor \|\| view\?\.currentStart \|\| getCalendarDate\(calendar\)\)/,
    'compact month cells must share one normalized calendar-date anchor for grid and dimming',
);
assert.match(
    source,
    /const monthIndex = raw\.lastIndexOf\('月'\)/,
    'prototype lunar labels must omit the lunar month prefix',
);
assert.match(
    styles,
    /--tm-cal-surface: var\(--tm-calendar-surface-bg, var\(--tm-bg-color, var\(--b3-theme-background/,
    'calendar surfaces must derive from the active plugin or host theme',
);
assert.match(
    styles,
    /--tm-cal-panel-other: color-mix\(in srgb, var\(--tm-cal-panel\) 96%, var\(--tm-cal-text\) 4%\)/,
    'non-current month cells must use a distinct theme-derived surface',
);
assert.match(
    source,
    /const checkbox = target\.closest\('\.tm-proto-event-check'\)[\s\S]*?handleCalendarEventCheckboxToggle\(checkbox,/,
    'prototype checkbox clicks must enter the shared calendar completion mutation path',
);
assert.match(
    styles,
    /\.tm-proto-event--checkbox-rect \.tm-proto-event-check\s*\{[^}]*border-radius:\s*4px\s*!important;/,
    'calendar appearance setting must provide the rounded-rectangle checkbox variant',
);
assert.match(
    styles,
    /\.tm-proto-timeline \.tm-proto-allday-cell > \.tm-proto-event--allday:not\(\.is-span\)[\s\S]*?padding:\s*3px 6px 3px 7px\s*!important;/,
    'single-day all-day cards must align their checkbox with cross-day bars',
);
assert.match(
    styles,
    /\.tm-proto-toolbar\{[\s\S]*position:\s*relative;[\s\S]*z-index:\s*320;[\s\S]*overflow:\s*visible;/,
    'prototype toolbar must establish a stacking context above the month grid',
);
assert.match(
    styles,
    /\.tm-proto-opacity-pop > label\{[\s\S]*grid-template-columns:\s*max-content minmax\(0, 1fr\) max-content;/,
    'opacity controls must use a shrinkable label-slider-percentage grid',
);
assert.match(
    styles,
    /\.tm-proto-opacity-pop b\{[\s\S]*white-space:\s*nowrap;/,
    'opacity percentage must stay on one line inside the popup',
);

console.log('calendar layout performance contract tests passed');
