'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const calendar = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', 'shell', '80-shell-lifecycle.js'), 'utf8');

assert.doesNotMatch(calendar, /\[task-horizon\]\[month-scroll\]/, 'month scrolling must not emit the removed diagnostic schedule log');
assert.match(
    calendar,
    /const monthBoundaryDate = turnColumn >= 0 \? weekDays\[turnColumn\] : null;[\s\S]*const monthBoundaryLabel = monthBoundaryDate[\s\S]*cells\.join\(''\)\}\$\{monthBoundaryLabel\}/,
    'desktop month boundary labels must be row-level elements anchored to the row start',
);
assert.match(styles, /\.tm-proto-month-boundary-label\{[\s\S]*left:\s*0;[\s\S]*pointer-events:\s*none;/, 'month boundary labels must align to the left divider without intercepting clicks');
assert.match(calendar, /turnColumn > 0 \? ' tm-proto-month-boundary-label--lower'/, 'month boundary labels must follow the lower horizontal segment when the month turns mid-week');
assert.match(styles, /\.tm-proto-month-boundary-label--lower\{[\s\S]*top:\s*calc\(100% - 20px\)/, 'lower month boundary labels must sit on the left-side horizontal divider');
assert.match(
    calendar,
    /if \(prototypeShowDayPanel && clickedKey === panelKey\) \{[\s\S]*prototypeShowDayPanel = false;[\s\S]*\} else \{[\s\S]*prototypePanelDate = new Date\(day\.getTime\(\)\)/,
    'clicking the same month day must close the panel while another day switches it',
);
assert.match(calendar, /data-tm-proto-panel-date="\$\{dateKey\}"/, 'day panels must expose their date for targeted focus');
assert.match(
    calendar,
    /const schedulePrototypeDayPanelCurrentTimeAutoCenter = \(settings\) => \{[\s\S]*centerCurrentTimeInPrototypeTimeline\(panel, settings \|\| getSettings\(\), new Date\(\), guard\)/,
    'opening today from month view must schedule current-time centering on the panel timeline',
);
assert.match(calendar, /schedulePrototypeDayPanelCurrentTimeAutoCenter\(settings\)/, 'prototype rendering must run the day-panel focus scheduler');
assert.match(
    calendar,
    /if \(options\?\.preserveCurrentView === true\)[\s\S]*MAIN_CALENDAR_ALLOWED_VIEWS\.has\(currentView\)[\s\S]*state\.mainCalendarHostSignature = nextSignature;[\s\S]*state\._lastViewType = currentView;[\s\S]*return false;/,
    'host reattach must preserve the current calendar view/date',
);
assert.match(shell, /open-manager-reuse-host', \{ preserveCurrentView: true \}/, 'window restore reuse must opt into calendar preservation');
assert.match(shell, /task-horizon-mount-reattach', \{ preserveCurrentView: true \}/, 'mount reattach must opt into calendar preservation');

console.log('calendar month/panel/host contract tests passed');
