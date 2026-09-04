const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const calendarCss = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');
const calendarModules = [
    'calendar-date.js',
    'calendar-store.js',
    'calendar-layout.js',
    'calendar-renderer.js',
    'calendar-interaction.js',
    'calendar-engine.js',
];

calendarModules.forEach((file) => {
    const modulePath = path.join(root, 'src', 'calendar', file);
    assert.ok(fs.existsSync(modulePath), `calendar module must exist: ${file}`);
    assert.ok(fs.readFileSync(modulePath, 'utf8').length > 200, `calendar module must contain implementation: ${file}`);
});

const stateIndex = source.indexOf('    const state = {');
assert.ok(stateIndex > 0, 'calendar state boundary must remain discoverable');
const businessSource = source.slice(stateIndex);
const rawCalendarApiPattern = /\b(?:calendar|cal|targetCalendar|mainCalendar|sideCalendar|calendarForRoot|state\.calendar|state\.sideDay\.calendar)\??\.(?:view|changeView|gotoDate|refetchEvents|setOption|rerenderEvents|getDate|getOption|getEvents|getEventById|getEventSourceById|addEvent|batchRendering|updateSize|destroy)\b/g;
assert.deepEqual(businessSource.match(rawCalendarApiPattern) || [], [], 'business code must use adapter helpers');
assert.match(source, /function createCalendarEngineAdapter\(/, 'calendar engine adapter must exist');
assert.match(source, /function getCalendarView\(/, 'calendar view reads must have an adapter helper');
assert.match(source, /function callCalendarAdapter\(/, 'calendar commands must have an adapter helper');
assert.doesNotMatch(source, /globalThis\.FullCalendar|window\.FullCalendar/, 'calendar runtime must not resolve FullCalendar');
assert.doesNotMatch(index, /FULLCALENDAR_SCRIPT_PATH|fullcalendar\.global\.js/, 'runtime loader must not load FullCalendar');
assert.match(index, /CALENDAR_ENGINE_SCRIPT_PATHS\s*=\s*\[/, 'runtime loader must list plugin calendar modules');
assert.match(index, /calendar-engine\.js/, 'runtime loader must load the plugin calendar engine');
assert.match(index, /async loadTaskHorizonCalendarAssets\(\)/, 'calendar assets must have a dedicated loader');
assert.match(index, /__taskHorizonEnsureCalendarAssets\s*=\s*\(\)\s*=>\s*this\.loadTaskHorizonCalendarAssets\(\)/, 'runtime must expose one shared calendar asset loader');
assert.match(calendarCss, /\.tm-calendar-surface\s*\{[\s\S]*z-index:\s*2/, 'the prototype surface must own the visible layer');
assert.doesNotMatch(calendarCss, /\.fc(?:[-.{ :]|$)|--fc-/, 'calendar CSS must not contain FullCalendar visual rules');
assert.match(source, /function markCalendarEngineEvent\(arg, options = \{\}\)/, 'calendar events must expose stable association markers');
assert.equal((source.match(/getFullCalendarCompatClassOptions/g) || []).length, 0, 'legacy visual class options must be removed');
assert.doesNotMatch(source, /applyFullCalendarV7LegacyDomClasses|scheduleFullCalendarV7LegacyDomClasses|addFullCalendarLegacyClassesByProtectedClass/, 'calendar views must not rescan legacy calendar DOM');
assert.equal((source.match(/moreLinkClick:\s*'popover'/g) || []).length, 0, 'calendar surface must not expose native popovers');
assert.match(source, /drag\.visualEl\.style\.setProperty\('transform', `translateY\(/, 'side day event drag must update its visual position during pointermove');
assert.match(source, /const minuteDelta = Math\.round\([\s\S]*drag\.canvasRect\.height[\s\S]*\/ 15\) \* 15/, 'side day event drag preview must snap to the shared 15-minute timeline');
assert.match(source, /sidePrototypeSuppressClickEventId = drag\.id/, 'side day event drag must suppress the follow-up click on the moved card');
assert.match(source, /drag\.edge === 'start' && pointerDate[\s\S]*nextStart = pointerDate[\s\S]*nextEnd = new Date\(oldEnd/, 'side start-edge resize must preserve the opposite edge');
assert.match(source, /drag\.edge === 'end' && pointerDate[\s\S]*nextStart = new Date\(oldStart[\s\S]*nextEnd = pointerDate/, 'side end-edge resize must preserve the opposite edge');
assert.match(source, /const nowMarkup = Number\.isFinite\(nowTop\)[\s\S]*tm-proto-now-indicator/, 'shared day panel must render the current-time indicator');
assert.match(source, /tm-proto-time-col[^`]*\$\{nowMarkup\}/, 'current-time indicator must live in the shared timed-events column');
assert.match(source, /const visualEl = eventEl;/, 'side day drag must transform the shared event card itself');

console.log('calendar renderer boundary contract tests passed');
