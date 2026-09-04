'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');

assert.match(source, /if \(isTaskDateEditor && !dateKey\) \{[\s\S]*setHubDateInput\(timeHubEndpoint, '', '00:00'\)/,
    'task-date time hub must support clearing the active date');
assert.match(source, /const clearButton = timeHubMode === 'date' && isTaskDateEditor[\s\S]*data-tm-proto-hub-clear-date/,
    'clear-date clicks must be handled only by the task-date time hub');
assert.match(source, /const clear = isTaskDateEditor[\s\S]*data-tm-proto-hub-clear-date="\$\{field\}"/,
    'task-date endpoints must render clear controls');
assert.match(css, /\.tm-proto-inline-hub-clear\{/, 'task-date clear control must have dedicated styling');

console.log('calendar task-date clear contract tests passed');
