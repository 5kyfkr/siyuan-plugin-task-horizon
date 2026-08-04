'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const calendar = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const dialogRuntime = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'),
    'utf8',
);

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

const calendarDefs = segment(calendar, 'function getCalendarDefs(', '\n    function isCalendarEnabled');
const nameRefresh = segment(calendar, 'function refreshDocGroupNames(', '\n    function renderTaskPage');
const notebookRefresh = segment(dialogRuntime, 'function __tmRefreshCalendarDocGroupNames(', '\n    function __tmGetNotebookDisplayName');

assert.match(
    calendarDefs,
    /state\.docGroupNameResolver\(g\)[\s\S]*?resolvedName \|\| g\?\.name/,
    'calendar document groups must use the shared notebook-aware name resolver with the stored name as fallback',
);
assert.match(nameRefresh, /state\.docGroupNameResolver = resolveName[\s\S]*?renderSidebar\(wrap, getSettings\(\)\)/, 'name refresh must redraw the mounted sidebar in place');
assert.doesNotMatch(nameRefresh, /refetchEvents|requestRefresh|scheduleCalendarRefresh|mount\(|unmount\(/, 'name refresh must not reload calendar events or rebuild the calendar');
assert.match(notebookRefresh, /refreshDocGroupNames\?\.\(__tmResolveDocGroupName\)/, 'notebook cache refresh must provide the shared group-name resolver to the calendar');
assert.equal((notebookRefresh.match(/__tmRefreshCalendarDocGroupNames\(\);/g) || []).length, 2, 'cached and freshly loaded notebook names must both refresh the calendar sidebar');
assert.match(calendar, /setSettingsStore,[\s\S]*?refreshDocGroupNames,/, 'the calendar API must expose the in-place document-group name refresh');

console.log('calendar notebook group name sync contract tests passed');
