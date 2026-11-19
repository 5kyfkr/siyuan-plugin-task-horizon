'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const calendar = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const settings = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const exportRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/64-export-runtime.js'), 'utf8');

const toggle = calendar.slice(calendar.indexOf('function setAllDayCollapsed'), calendar.indexOf('function isTimeGridViewType'));
assert.match(toggle, /store\.data\[settingKey\]\s*=\s*value/);
assert.match(toggle, /store\.save\?\.\(\)/);
assert.doesNotMatch(toggle, /localStorage/);
assert.match(calendar, /state\.allDayCollapsed\s*=\s*state\.settingsStore\.data\.calendarAllDayCollapsed\s*===\s*true/);
assert.match(calendar, /state\.sideDay\.allDayCollapsed\s*=\s*state\.settingsStore\.data\.calendarSideDockAllDayCollapsed\s*===\s*true/);
assert.match(settings, /calendarAllDayCollapsed:\s*false/);
assert.match(settings, /calendarSideDockAllDayCollapsed:\s*false/);
assert.match(settings, /cloudData\.calendarAllDayCollapsed === 'boolean'[\s\S]*?this\.data\.calendarAllDayCollapsed\s*=\s*cloudData\.calendarAllDayCollapsed/);
assert.match(settings, /cloudData\.calendarSideDockAllDayCollapsed === 'boolean'[\s\S]*?this\.data\.calendarSideDockAllDayCollapsed\s*=\s*cloudData\.calendarSideDockAllDayCollapsed/);
assert.match(exportRuntime, /'calendarAllDayCollapsed'/);
assert.match(exportRuntime, /'calendarSideDockAllDayCollapsed'/);

console.log('calendar all-day collapse sync contract tests passed');
