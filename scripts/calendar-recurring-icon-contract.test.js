'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');

assert.match(
    source,
    /function isCalendarTaskRecurringSnapshot\(task\)/,
    'calendar rendering needs a recurring-task snapshot predicate',
);
assert.match(
    source,
    /function buildCalendarRecurringTaskIconMarkup\(ext\)/,
    'calendar rendering needs a shared recurring-task icon builder',
);

const sharedMarkupStart = source.indexOf('    function buildSharedPrototypeEventMarkup');
const sharedMarkupEnd = source.indexOf('\n    function resolveSharedPrototypeEventEnd', sharedMarkupStart);
assert.ok(sharedMarkupStart >= 0 && sharedMarkupEnd > sharedMarkupStart, 'shared event markup must remain inspectable');
const sharedMarkup = source.slice(sharedMarkupStart, sharedMarkupEnd);
assert.match(sharedMarkup, /const recurringIcon = \(mode === 'allday' \|\| mode === 'inner' \|\| isMonthCard\)/, 'all-day and month cards should resolve the recurring icon');
assert.match(sharedMarkup, /\$\{recurringIcon\}/, 'shared event markup should render the recurring icon');
assert.match(
    source,
    /protoEventMarkup\(eventApi, 'chip', eventApi\?\.allDay !== true, eventApi\?\.allDay === true \? 'tm-proto-month-event' : '', 'dayGridMonth'\)/,
    'month cells should route both all-day cards and timed events through the month-aware markup',
);

const sharedSpanStart = source.indexOf('    function buildSharedPrototypeSpanMarkup');
const sharedSpanEnd = source.indexOf('\n    function buildSharedPrototypeTimelineMarkup', sharedSpanStart);
assert.ok(sharedSpanStart >= 0 && sharedSpanEnd > sharedSpanStart, 'shared span markup must remain inspectable');
assert.match(source.slice(sharedSpanStart, sharedSpanEnd), /const recurringIcon = segmentStart \? buildCalendarRecurringTaskIconMarkup\(ext\) : '';/, 'shared cross-day spans should mark the first segment');

const monthSpanStart = source.indexOf('        const protoSpanMarkup = (eventApi');
const monthSpanEnd = source.indexOf('\n        const protoEventMarkup = (eventApi', monthSpanStart);
assert.ok(monthSpanStart >= 0 && monthSpanEnd > monthSpanStart, 'month span markup must remain inspectable');
assert.match(source.slice(monthSpanStart, monthSpanEnd), /const recurringIcon = isSegmentStart \? buildCalendarRecurringTaskIconMarkup\(ext\) : '';/, 'month cross-day spans should mark the first segment');

assert.match(styles, /\.tm-proto-recurring-task-icon\s*\{/, 'recurring icon needs a dedicated calendar style');
assert.match(styles, /flex:\s*0\s*0\s*13px/, 'recurring icon should reserve a fixed inline slot');
assert.match(styles, /\.tm-proto-event--allday\s*>\s*\.tm-proto-event-copy[\s\S]*?flex-direction:\s*row\s*!important[\s\S]*?text-align:\s*left/, 'all-day event names should stay in a left-aligned title row');
assert.match(styles, /\.tm-proto-event--chip\.tm-proto-month-event[\s\S]*?justify-content:\s*flex-start/, 'month event names should remain left aligned');
assert.match(styles, /\.tm-proto-event--chip:not\(\.tm-proto-month-event\)\s*>\s*\.tm-proto-recurring-task-icon[\s\S]*?display:\s*none\s*!important/, 'compact dot-only markers should hide the icon while month cards retain it');

console.log('calendar recurring icon contract tests passed');
