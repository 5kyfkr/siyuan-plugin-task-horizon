'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'calendar-view.js'), 'utf8');
const styles = fs.readFileSync(path.resolve(__dirname, '..', 'calendar-view.css'), 'utf8');

assert.match(
    source,
    /const getPrototypeMonthRangeKey = \(view\) =>[\s\S]*prototypeMonthCapacityRangeKey \|\| ''\) === monthRangeKey/,
    'compact month capacity must be scoped to the active calendar range',
);
assert.match(
    source,
    /useStableCapacity \? Array\.from\(prototypeMonthCapacityByDay\.entries\(\)\) : \[\]/,
    'a new month must not seed its day capacities from the previous range',
);
assert.match(
    source,
    /if \(isMobileDevice \|\| isCompactDockLayout\(\)\) \{[\s\S]*invalidatePrototypeMonthMeasurement\(\{ resetBudget: true, resetRenderKey: false \}\)[\s\S]*callCalendarAdapter\(activeCalendar, 'gotoDate', target\)/,
    'mobile and Dock month paging must invalidate the old fold budget before navigation',
);
assert.match(
    source,
    /if \(viewType === 'dayGridMonth' && !monthVirtualActive\) \{\s*try \{ schedulePrototypeMonthAdaptiveMeasure\(\); \}/,
    'every compact month render must schedule a fresh painted-cell measurement',
);
assert.match(
    source,
    /adaptive geometry has[\s\S]*remained stable for two frames[\s\S]*schedulePrototypeMonthOverflowRepair\(\)/,
    'overflow repair must run only after the adaptive month geometry stabilizes',
);
assert.match(
    source,
    /if \(sourceOnlyRefresh\) \{[\s\S]*if \(hadViewSwitchingMarker\) \{[\s\S]*wrap\.classList\.remove\('tm-calendar-wrap--view-switching'\)[\s\S]*host\.classList\.remove\('tm-cal-view-switching'\)/,
    'a source-only load must clear a stale view-switching marker before compact month measurement',
);
assert.match(
    styles,
    /\.tm-proto-surface--compact-month \.tm-proto-month-cell,[\s\S]*padding-inline: 2px !important;/,
    'mobile and Dock compact month cells must share the same horizontal padding',
);
assert.match(
    styles,
    /\.tm-proto-surface--compact-month \.tm-proto-month-events > \.tm-proto-span-bar,[\s\S]*--tm-proto-span-cell-padding: 5px !important;[\s\S]*width: calc\(var\(--tm-proto-span-days, 1\) \* 100% \+ var\(--tm-proto-span-days, 1\) \* var\(--tm-proto-span-cell-padding\) - var\(--tm-proto-span-month-inset-end, 0px\)\) !important;/,
    'compact month spans must correct each crossed track while preserving the rounded tail inset',
);
assert.doesNotMatch(
    styles,
    /\.tm-proto-surface--compact-month \.tm-proto-month-events > \.tm-proto-span-bar,[\s\S]*--tm-proto-span-month-inset-end: 0px !important;/,
    'compact month spans must not discard the rendered segment end inset',
);
assert.doesNotMatch(
    styles,
    /\.tm-proto-surface--compact-month \.tm-proto-month-events > \.tm-proto-span-bar\.tm-proto-span-row-end,[\s\S]*\+ 7px\) !important;/,
    'compact month row-end spans must not use the old overflow-prone extra width',
);
assert.match(
    source,
    /const shiftPrototypeMonthScroll = \(amount, options = \{\}\)[\s\S]*const animateSwipe = options\?\.animate === true/,
    'only touch swipes may opt into the compact month entrance animation; toolbar jumps stay immediate',
);
assert.match(source, /shiftPrototypeMonthScroll\(direction, \{ animate: true \}\)/, 'touch month swipes may opt into the entrance animation');
assert.match(source, /shiftPrototypeMonthScroll\(direction\) === true/, 'toolbar month jumps use the immediate path');
assert.match(
    styles,
    /\.tm-proto-surface--month\[data-tm-month-swipe="next"\],\s*\.tm-proto-surface--month\[data-tm-month-swipe="previous"\][\s\S]*will-change: opacity;/,
    'compact month swipe animation must stay on the stable surface layer',
);
assert.doesNotMatch(
    styles,
    /\.tm-proto-surface--month\[data-tm-month-swipe="next"\] \.tm-proto-month[\s\S]*transform: translateX/,
    'compact month swipe must not transform the rebuilt month node',
);
assert.match(
    source,
    /The render pass applies the attribute after replacing[\s\S]*prototypeSurface\?\.removeAttribute\?\.\('data-tm-month-swipe'\)/,
    'swipe animation must start after the target month DOM is committed',
);
assert.doesNotMatch(
    source,
    /logPrototypeMonth|__TM_CALENDAR_MONTH_DEBUG|\[task-horizon\]\[calendar-month\]/,
    'compact month diagnostics must be removed so console logging cannot block swipes',
);

console.log('calendar compact month navigation contract tests passed');
