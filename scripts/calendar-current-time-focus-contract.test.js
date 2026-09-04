'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const renderSource = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', '40-render-runtime.js'), 'utf8');

assert.match(source, /if \(!force && seededUntil > Date\.now\(\)/, 'forced current-time focus must not be skipped after a scrollTime seed');
const sourceSlice = (startText, endText) => {
    const start = source.indexOf(startText);
    const end = source.indexOf(endText, start + startText.length);
    return start >= 0 && end > start ? source.slice(start, end) : '';
};
const centerSource = sourceSlice('function centerCurrentTimeInTimeGrid(', 'function scheduleCurrentTimeAutoCenter(');
const mainInitialSource = sourceSlice('function scheduleMainCalendarInitialTimeAutoCenter(', 'function formatMonthDayZh(');
const sideLayoutSource = sourceSlice('function scheduleSideDayLayout(', 'function refreshAllDayCollapseLayout(');
const mainRenderSource = sourceSlice('renderPrototypeSurface = () => {', 'let mainCalendarEventsPerfTrace = null;');
const sideRenderSource = sourceSlice('const renderSidePrototype = () => {', 'const queueSidePrototypeRender = () => {');
assert.match(source, /function centerCurrentTimeInPrototypeTimeline\([\s\S]*\.tm-proto-time-scroll[\s\S]*getPrototypeTimelineMetricsFromCanvas[\s\S]*prototypeTimelineYForMinute[\s\S]*const canvasOffset = canvasRect\.top - scrollerRect\.top \+ Number\(scroller\.scrollTop/, 'prototype timeline focus must use the rendered timeline geometry and folded coordinate mapping');
assert.match(source, /const desiredTop = targetContentY - clientHeight \* 0\.35/, 'prototype timeline focus must place the current time in the upper-middle viewport');
assert.match(centerSource, /centerCurrentTimeInPrototypeTimeline\([\s\S]*getTimeGridBodyScroller\(/, 'shared focus must prefer the prototype timeline before legacy scrollers');
assert.match(mainInitialSource, /requestAnimationFrame\(\(\) => requestAnimationFrame\(runInitialAutoCenter\)\)[\s\S]*\[160, 420, 700\]/, 'main calendar initial focus must retry after the prototype layout settles');
assert.match(source, /scheduleMainCalendarInitialTimeAutoCenter\(host, calendar, getSettings\(\), 'main-calendar-initial-mount'\)/, 'main calendar mount must schedule current-time focus');
assert.match(mainInitialSource, /scheduleCurrentTimeAutoCenter\(rootEl, calendar, settings[\s\S]*scope: 'main'[\s\S]*force: true[\s\S]*once: true/, 'main calendar initial retries must reuse the shared centering implementation');
assert.match(source, /if \(formatDateKey\(currentDate\) !== formatDateKey\(today\)\) return null;/, 'side-day focus must stay disabled when the selected day is not today');
assert.match(source, /if \(today\.getTime\(\) < start\.getTime\(\) \|\| today\.getTime\(\) > end\.getTime\(\)\) return null;/, 'main focus must stay disabled when the visible range does not include today');
assert.match(sideLayoutSource, /state\.sideDay\?\.prototypeRender\?\.\(\)[\s\S]*scheduleCurrentTimeAutoCenter\(rootEl, calendar[\s\S]*scope: 'sideDay'/, 'side-day layout must schedule current-time focus after prototype rendering');
assert.doesNotMatch(sideLayoutSource, /state\.sideDay\?\.prototypeRender\?\.\(\)[\s\S]*return true;\s*const sideDay/, 'side-day layout must not return before its centering path');
assert.match(mainRenderSource, /previousTimeScroller[\s\S]*nextTimeScroller\.scrollTop = previousTimeScrollTop[\s\S]*scheduleCurrentTimeAutoCenter\(prototypeSurface, calendar/, 'main prototype redraw must restore scroll position and recheck current-time focus');
assert.match(sideRenderSource, /previousTimeScroller[\s\S]*nextTimeScroller\.scrollTop = previousTimeScrollTop[\s\S]*scheduleCurrentTimeAutoCenter\(surface, active/, 'side prototype redraw must restore scroll position and recheck current-time focus');
assert.match(renderSource, /const shouldRestoreCalendarScroll = prevWasCalendar;/, 'calendar scroll restoration must only apply to an existing calendar render');
const guardedRestores = renderSource.match(/if \(!shouldRestoreCalendarScroll\) return;/g) || [];
assert.equal(guardedRestores.length, 2, 'both post-mount calendar scroll restoration paths must skip first entry from another view');

console.log('calendar current-time focus contract tests passed');
