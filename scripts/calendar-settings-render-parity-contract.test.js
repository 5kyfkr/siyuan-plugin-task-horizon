'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'calendar-view.css'), 'utf8');

function readFunction(sourceText, name, context = {}) {
    const start = sourceText.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `${name} must be defined`);
    const bodyStart = sourceText.indexOf('{', start);
    let depth = 0;
    for (let index = bodyStart; index < sourceText.length; index += 1) {
        if (sourceText[index] === '{') depth += 1;
        if (sourceText[index] === '}') depth -= 1;
        if (depth === 0) return vm.runInNewContext(`(${sourceText.slice(start, index + 1)})`, context);
    }
    assert.fail(`${name} must have a complete function body`);
}

let showOtherBlockCheckbox = false;
const checkboxContext = {
    getSettings: () => ({ showOtherBlockCheckbox }),
    resolveCalendarEventDoneState: (ext) => ext?.done === true,
};
checkboxContext.isOtherBlockCalendarEvent = readFunction(source, 'isOtherBlockCalendarEvent', checkboxContext);
checkboxContext.isCalendarBuiltinScheduleEvent = readFunction(source, 'isCalendarBuiltinScheduleEvent', checkboxContext);
const shouldShowCheckbox = readFunction(source, 'shouldShowCalendarEventCheckbox', checkboxContext);

assert.equal(shouldShowCheckbox({ __tmSource: 'schedule' }), false, 'built-in schedules must not expose a task checkbox');
assert.equal(shouldShowCheckbox({ __tmSource: 'cnHoliday' }), false, 'holiday events must not expose a task checkbox');
assert.equal(shouldShowCheckbox({ __tmTaskId: 'task', __tmBlockId: 'child' }), true, 'normal task events must retain their checkbox');
assert.equal(shouldShowCheckbox({ __tmTaskId: 'same', __tmBlockId: 'same' }), false, 'other blocks must follow the disabled setting');
showOtherBlockCheckbox = true;
assert.equal(shouldShowCheckbox({ __tmTaskId: 'same', __tmBlockId: 'same' }), true, 'other blocks must follow the enabled setting');
showOtherBlockCheckbox = false;
assert.equal(shouldShowCheckbox({ __tmTaskDateReadOnly: true, done: false }), false, 'unfinished read-only task dates must not expose a checkbox');
assert.equal(shouldShowCheckbox({ __tmTaskDateReadOnly: true, done: true }), true, 'completed read-only task dates must retain their completion indicator');

const renderKeyContext = {
    normalizeCalendarVisibleTime: (value, fallback) => String(value || fallback),
    normalizeCalendarHourSlotHeightMode: (value) => String(value || 'normal'),
    normalizeCalendarMonthMinVisibleEvents: (value) => Number(value) || 3,
};
const buildRenderSettingsKey = readFunction(source, 'buildPrototypeRenderSettingsKey', renderKeyContext);
const baseSettings = {
    firstDay: 1,
    visibleStartTime: '00:00',
    visibleEndTime: '24:00',
    hourSlotHeightMode: 'normal',
    showLunar: false,
    showCnHoliday: true,
    monthMinVisibleEvents: 3,
    showOtherBlockCheckbox: false,
    taskCheckboxCircleStyleEnabled: false,
};
const baseKey = buildRenderSettingsKey(baseSettings);
for (const [field, value] of [
    ['firstDay', 0],
    ['visibleStartTime', '06:00'],
    ['visibleEndTime', '22:00'],
    ['hourSlotHeightMode', 'higher'],
    ['showLunar', true],
    ['showCnHoliday', false],
    ['monthMinVisibleEvents', 5],
    ['showOtherBlockCheckbox', true],
    ['taskCheckboxCircleStyleEnabled', true],
]) {
    assert.notEqual(buildRenderSettingsKey({ ...baseSettings, [field]: value }), baseKey, `${field} must invalidate the prototype render cache`);
}
assert.equal(
    buildRenderSettingsKey({ ...baseSettings, monthAdaptiveRowHeight: false }),
    baseKey,
    'the removed adaptive-row setting must not invalidate the prototype render cache',
);
assert.doesNotMatch(
    source,
    /data-tm-cal-setting="calendarMonthAdaptiveRowHeight"/,
    'the removed adaptive-row setting must not be rendered in calendar settings',
);
assert.match(
    source,
    /data-tm-cal-setting="calendarMonthMinVisibleEvents"/,
    'the default month visible-event count setting must remain available',
);
assert.doesNotMatch(
    source,
    /calendarMonthAdaptiveRowHeight|tm_calendar_month_adaptive_row_height/,
    'the removed adaptive-row setting must not remain in calendar view settings or persistence',
);
assert.match(
    source,
    /const partialContextKey = \[[\s\S]*?buildPrototypeRenderSettingsKey\(settings\)/,
    'the prototype render cache must consume the settings dependency key',
);
assert.match(
    source,
    /const viewButtons = MAIN_CALENDAR_VIEW_OPTIONS\.map\(/,
    'the desktop prototype toolbar must expose every supported main calendar view',
);
assert.doesNotMatch(source, /protoMobileBarMarkup|tm-proto-mobilebar/, 'the mobile calendar must not render a bottom bar');
assert.doesNotMatch(styles, /tm-proto-mobilebar/, 'removed mobile bottom bar styles must not remain');

assert.match(
    styles,
    /--tm-cal-today-bg:\s*color-mix\(in\s+srgb,\s*var\(--tm-calendar-today-highlight-color,[\s\S]*var\(--tm-cal-panel\)\)/,
    'the main calendar must blend today highlighting with the calendar panel',
);
for (const selector of [
    '.tm-proto-month-cell.is-today',
    '.tm-proto-timeline-day.is-today',
    '.tm-proto-allday-cell.is-today',
    '.tm-proto-time-col.is-today',
]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(styles, new RegExp(`${escaped}[^\\{]*\\{[^}]*background:\\s*var\\(--tm-cal-today-bg\\)`), `${selector} must consume the shared today background`);
}
assert.match(styles, /\.tm-mini-cal-day--today\s*\{[\s\S]*?var\(--tm-calendar-today-highlight-color,/, 'the mini calendar must retain the appearance setting');

console.log('calendar settings render parity contract tests passed');
