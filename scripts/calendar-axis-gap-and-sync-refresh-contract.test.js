'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const calendarCss = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');
const calendarView = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const refreshRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/39-render-doc-group-sync-and-refresh.js'), 'utf8');

const eventColumn = calendarCss.slice(
    calendarCss.indexOf('.tm-proto-time-col .tm-proto-event--block{'),
    calendarCss.indexOf('\n}', calendarCss.indexOf('.tm-proto-time-col .tm-proto-event--block{')),
);
assert.match(eventColumn, /left:\s*3px;/, 'shared main and dock time-grid event cards must use a 3px left inset');
assert.match(eventColumn, /right:\s*3px;/, 'shared main and dock time-grid event cards must use a 3px right inset');
const eventGeometry = calendarView.slice(calendarView.indexOf('const laneLeftInset'), calendarView.indexOf('return eventMarkup(item.eventApi', calendarView.indexOf('const laneLeftInset')));
assert.match(eventGeometry, /const laneLeftInset = item\.lane === 0 \? 3 : 1\.5/);
assert.match(eventGeometry, /const laneRightInset = item\.lane === item\.laneCount - 1[\s\S]*?railEvents\.length \? 0 : 3[\s\S]*?: 1\.5/,
    'the tomato rail reserve must provide the rightmost 3px gap without adding a second right inset');
assert.match(eventGeometry, /left:calc\(\$\{left\}% \+ \$\{laneLeftInset\}px\);width:calc\(\$\{width\}% - \$\{laneLeftInset \+ laneRightInset\}px\)/, 'without tomato rails, adjacent lanes must have a 3px gap and outer cards a 3px inset');
assert.match(eventGeometry, /width:calc\(\$\{width\}% - \$\{laneLeftInset \+ laneRightInset \+ width \/ 100 \* 10\}px\)/, 'tomato-rail geometry must preserve the same lane gap while reserving the rail');

const refreshCore = refreshRuntime.slice(
    refreshRuntime.indexOf('async function __tmRefreshCore'),
    refreshRuntime.indexOf('window.tmRefreshCalendarInPlace', refreshRuntime.indexOf('async function __tmRefreshCore')),
);
assert.match(refreshCore, /mode !== 'calendar'[\s\S]*?__tmHasMountedCalendarSideDock\(\)[\s\S]*?__tmRequestCalendarRefresh\(\{[\s\S]*?main:\s*false,[\s\S]*?side:\s*true,[\s\S]*?flushTaskPanel:\s*false/,
    'sync refreshes outside calendar view must refetch a mounted calendar side dock without refetching the main calendar');

console.log('calendar axis gap and synced side-dock refresh contract tests passed');
