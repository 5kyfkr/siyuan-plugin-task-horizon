'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');

assert.match(
    source,
    /function syncTimeGridAllDayCollapseUi\(rootEl, calendar\)[\s\S]*const supported = isTimeGridAllDayCollapseSupported\(calendar\);[\s\S]*if \(!supported\)[\s\S]*clearTimeGridAllDayCollapseArtifacts\(rootEl\);/,
    'non-time-grid views must clear synthetic all-day collapse controls before returning',
);
assert.match(
    source,
    /function clearTimeGridAllDayCollapseArtifacts\(rootEl\)[\s\S]*rootEl\.querySelectorAll\('\.tm-cal-allday-summary, \.tm-cal-allday-toggle'\)/,
    'all-day collapse cleanup must remove both the summary overlay and axis toggle',
);
assert.match(
    styles,
    /\.tm-calendar-host--month-view :is\(\.tm-cal-allday-summary, \.tm-cal-allday-toggle\)[\s\S]*display: none !important/,
    'month view must hide stale all-day collapse controls as a CSS fallback',
);
assert.match(
    source,
    /function scheduleMainCalendarTimeGridLayoutSettle\(wrap, host, calendar\)[\s\S]*applyTimeAxisColumnLayout\(targetHost, 40, \{ force: true \}\)[\s\S]*syncTimeGridAllDayCollapseUi\(targetHost, targetCalendar\)[\s\S]*requestAnimationFrame\(/,
    'time-grid view switches must reapply axis and all-day layout after FullCalendar replaces the view DOM',
);
assert.match(
    source,
    /datesSet:\s*\(\) => \{[\s\S]*scheduleMainCalendarTimeGridLayoutSettle\(wrap, host, calendar\)/,
    'main calendar date changes must schedule the post-switch time-grid settle pass',
);
assert.match(
    source,
    /querySelectorAll\('\.fc-timegrid \.tm-cal-slot-header-divider'\)[\s\S]*previousElementSibling[\s\S]*v7AxisHosts\.push\(axisHost\)[\s\S]*flex-basis', width, 'important'/,
    'FullCalendar v7 axis wrappers must share the same fixed width as the all-day axis',
);
assert.match(
    styles,
    /\.fc-timegrid \[role="row"\] > :has\(\+ \.tm-cal-slot-header-divider\)[\s\S]*flex: 0 0 var\(--tm-calendar-axis-width, 40px\) !important/,
    'time-grid axis wrappers must be aligned before the JavaScript settle pass runs',
);

console.log('calendar all-day collapse contract tests passed');
