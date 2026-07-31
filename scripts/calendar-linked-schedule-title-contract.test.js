'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');

const buildStart = source.indexOf('    function buildEventsFromSchedule');
const buildEnd = source.indexOf('\n    function isMonthScheduleEventRange', buildStart);
assert.ok(buildStart >= 0 && buildEnd > buildStart, 'schedule event builder must remain inspectable');
const buildEventsBlock = source.slice(buildStart, buildEnd);

assert.match(
    buildEventsBlock,
    /const titleBase = normalizeCalendarScheduleTitleText\(it\?\.title \|\| linkedTitle, '日程'\);/,
    'a linked schedule card must prefer its own saved title and use the task title only as a fallback',
);
assert.match(buildEventsBlock, /title: titleBase,/, 'the calendar event must render the resolved schedule title');
assert.match(buildEventsBlock, /__tmScheduleTitle: titleBase,/, 'custom calendar content must receive the same schedule title');

const modalStart = source.indexOf('    function openScheduleModal');
const modalEnd = source.indexOf('\n    function scheduleTomatoRefetch', modalStart);
assert.ok(modalStart >= 0 && modalEnd > modalStart, 'schedule editor save flow must remain inspectable');
const modalBlock = source.slice(modalStart, modalEnd);

assert.match(
    modalBlock,
    /const item = \{[\s\S]*?title: title \|\| '日程',[\s\S]*?taskId: taskIdKeep,/,
    'editing a linked schedule must save its title while preserving the task link',
);
assert.doesNotMatch(
    modalBlock,
    /(?:patchTask|patchContent)\([^)]*(?:title|content)/,
    'editing a schedule title must not patch the linked task title',
);

console.log('calendar linked schedule title contract tests passed');
