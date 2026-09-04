'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');

assert.match(
    source,
    /function ensurePrototypePopoverFactory\(\)/,
    'the side dock must be able to initialize the shared inline editor without the main calendar view',
);
assert.match(
    source,
    /state\.prototypePopoverFactory\s*=\s*\{\s*openNew:\s*openPrototypeNewScheduleCard/,
    'the inline editor factory must be retained for dock-only mounts',
);

const sideStart = source.indexOf('function mountSideDayTimeline');
assert.ok(sideStart >= 0, 'side calendar adapter must remain inspectable');
const sideEnd = source.indexOf('cal = sideCalendarAdapter.mount', sideStart);
assert.ok(sideEnd > sideStart, 'side calendar adapter block must have a bounded body');
const side = source.slice(sideStart, sideEnd);

assert.match(side, /ensurePrototypePopoverFactory\(\)/, 'side mount must initialize the shared editor factory');
const selectStart = side.indexOf('select: (info) =>');
assert.ok(selectStart >= 0, 'side calendar must expose a selection callback');
const selectEnd = side.indexOf('datesSet:', selectStart);
assert.ok(selectEnd > selectStart, 'side selection callback must be bounded');
const select = side.slice(selectStart, selectEnd);
assert.match(select, /state\.openPrototypeNewScheduleCard/);
assert.match(select, /newCard\(\{\s*start,\s*end/);
assert.doesNotMatch(select, /openScheduleModal\(/, 'side selection must not fall back to the legacy modal');

console.log('calendar side inline editor contract tests passed');
