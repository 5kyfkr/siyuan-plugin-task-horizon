'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const renderSource = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', '40-render-runtime.js'), 'utf8');

assert.match(source, /if \(!force && seededUntil > Date\.now\(\)/, 'forced current-time focus must not be skipped after a scrollTime seed');
assert.match(source, /function scheduleMainCalendarInitialTimeAutoCenter\([\s\S]*requestAnimationFrame\(\(\) => requestAnimationFrame\(runInitialAutoCenter\)\)[\s\S]*\[160, 420\]/, 'main calendar initial focus must retry after FullCalendar layout settles');
assert.match(source, /scheduleMainCalendarInitialTimeAutoCenter\(host, calendar, getSettings\(\), 'main-calendar-initial-mount'\)/, 'main calendar mount must schedule current-time focus');
assert.match(source, /scheduleCurrentTimeAutoCenter\(rootEl, calendar, settings[\s\S]*scope: 'main'[\s\S]*force: true[\s\S]*once: true/, 'main calendar initial retries must reuse the shared centering implementation');
assert.match(renderSource, /const shouldRestoreCalendarScroll = prevWasCalendar;/, 'calendar scroll restoration must only apply to an existing calendar render');
const guardedRestores = renderSource.match(/if \(!shouldRestoreCalendarScroll\) return;/g) || [];
assert.equal(guardedRestores.length, 2, 'both post-mount calendar scroll restoration paths must skip first entry from another view');

console.log('calendar current-time focus contract tests passed');
