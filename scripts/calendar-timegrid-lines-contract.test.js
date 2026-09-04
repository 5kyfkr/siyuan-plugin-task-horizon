'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');

assert.match(source, /const CALENDAR_TIMEGRID_SLOT_MINUTES = 15;/);
assert.match(source, /function getPrototypeHourHeight\(settings, mobile = false\)/);
assert.match(source, /hourHeight = getPrototypeHourHeight\(liveSettings/);
assert.match(source, /tm-proto-time-canvas/);
assert.match(source, /tm-proto-time-lines/);
assert.doesNotMatch(source, /--tm-proto-axis-width:54px/, 'shared timeline markup must not hard-code the oversized axis width');
assert.match(source, /const timePercent = \(minute\) =>[^\n]*prototypeTimelineYForMinute\(minute, timeMetrics\)/, 'time labels must use the collapsed timeline projection');
assert.match(source, /for \(let minute = 0; minute <= 1440; minute \+= 60\)/, 'hour labels must retain whole-day anchors around collapsed ranges');
assert.match(source, /if \(isMinuteCollapsed\(minute\)\) continue;/, 'hour labels inside a collapsed range must be omitted');
assert.match(source, /const labelsMarkup = labels\.join\('\'\);/);
assert.match(source, /isHour \? 'is-hour' : 'is-half-hour'/);
assert.match(source, /tm-proto-allday/);
assert.match(source, /tm-proto-span-bar/);
assert.match(styles, /\.tm-proto-time-canvas\s*\{[\s\S]*min-height:\s*960px/);
assert.match(styles, /\.tm-proto-time-columns\s*\{[\s\S]*grid-template-columns:\s*var\(--tm-proto-axis-width\) repeat/);
assert.match(styles, /\.tm-proto-timeline\s*\{[\s\S]*--tm-proto-axis-width:\s*44px;/, 'main timelines must use the compact shared time axis');
assert.match(styles, /\.tm-proto-day-panel\s*\{[\s\S]*--tm-proto-axis-width:\s*44px;/, 'the side calendar must use the same compact time axis');
assert.doesNotMatch(styles, /\.fc(?:[-.{ :]|$)|--fc-/);
assert.match(styles, /\.tm-proto-time-line\.is-half-hour[^}]*border-top-style:\s*dashed/);
assert.match(styles, /\.tm-proto-time-line\.is-hour[^}]*border-top-style:\s*solid/);
assert.match(styles, /\.tm-proto-time-lines\s*\{[^}]*z-index:\s*2/);
assert.match(styles, /\.tm-proto-time-col\s*>\s*\.tm-proto-event--block\s*\{[\s\S]*z-index:\s*3/);
assert.match(styles, /--tm-cal-today-bg:\s*color-mix\(in\s+srgb,[\s\S]*var\(--tm-cal-panel\)\)/);
assert.equal((source.match(/getFullCalendarCompatClassOptions/g) || []).length, 0);
assert.equal((source.match(/eventClass:\s*\(/g) || []).length, 0);
assert.equal((source.match(/dayCellDidMount:\s*/g) || []).length, 0);

console.log('calendar prototype time-grid contract tests passed');
