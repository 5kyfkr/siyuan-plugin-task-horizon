'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');

function readFunction(name, context = {}) {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `${name} must be defined`);
    const signatureEnd = source.indexOf(') {', start);
    assert.ok(signatureEnd >= 0, `${name} must have a complete signature`);
    const bodyStart = signatureEnd + 2;
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] === '}') depth -= 1;
        if (depth === 0) return vm.runInNewContext(`(${source.slice(start, index + 1)})`, context);
    }
    assert.fail(`${name} must have a complete function body`);
}

const checkboxContext = {
    getSettings: () => ({ showOtherBlockCheckbox: true }),
    resolveCalendarEventDoneState: (ext) => ext?.done === true,
};
checkboxContext.isOtherBlockCalendarEvent = readFunction('isOtherBlockCalendarEvent', checkboxContext);
checkboxContext.isCalendarBuiltinScheduleEvent = readFunction('isCalendarBuiltinScheduleEvent', checkboxContext);
const shouldShowCheckbox = readFunction('shouldShowCalendarEventCheckbox', checkboxContext);

assert.equal(shouldShowCheckbox({ __tmSource: 'tomato' }), false, 'tomato records must never expose a checkbox');
assert.equal(shouldShowCheckbox({ __tmTaskId: 'task', __tmBlockId: 'child' }), true, 'task events must retain their checkbox');

const normalizeRecord = readFunction('normalizeCalendarTomatoRecord', { Date });
const normalizeRecords = readFunction('normalizeCalendarTomatoRecords', {
    Date,
    Array,
    Number,
    normalizeCalendarTomatoRecord: normalizeRecord,
    toMs: (value) => {
        if (value instanceof Date) return value.getTime();
        const parsed = Date.parse(String(value || ''));
        return Number.isFinite(parsed) ? parsed : NaN;
    },
    overlap: (s1, e1, s2, e2) => s1 < e2 && e1 > s2,
});
const buildEvents = readFunction('buildEventsFromRecords', {
    normalizeCalendarTomatoRecords: normalizeRecords,
    normalizeCalendarTomatoRecord: normalizeRecord,
    shouldShowMode: (mode, settings) => String(mode || '').trim() !== 'break' || settings.showBreak === true,
    modeLabel: () => '专注',
    resolveModeColor: (mode, settings) => settings.colorFocus,
    formatDurationMinutes: (minutes) => `${minutes}m`,
    buildRecordKey: (record) => ({ start: record.start, end: record.end }),
    toMs: (value) => Date.parse(String(value || '')),
});

const events = buildEvents([{
    sessionId: 'orphan-session',
    timestamp: '2026-09-05T10:25:00.000Z',
    start: '2026-09-05T10:00:00.000Z',
    end: '2026-09-05T10:25:00.000Z',
    mode: 'countdown',
    durationMin: 25,
    taskBlockId: null,
    taskBlockName: null,
}], {
    monthAggregate: false,
    showFocus: true,
    showBreak: false,
    colorFocus: '#4f8cff',
}, 'timeGridDay');

assert.equal(events.length, 1, 'unassociated tomato records must remain calendar events');
assert.equal(events[0].extendedProps.__tmSource, 'tomato');
assert.equal(events[0].extendedProps.taskBlockId, '', 'unassociated events must not invent a task id');

const compactTimeRecord = normalizeRecord({
    start: 20260905100000,
    end: '20260905102500',
    durationMin: 25,
});
const compactStart = new Date(compactTimeRecord.start);
const compactEnd = new Date(compactTimeRecord.end);
assert.equal(compactStart.getFullYear(), 2026, 'compact legacy timestamps must preserve their calendar year');
assert.equal(compactStart.getMonth(), 8, 'compact legacy timestamps must preserve their calendar month');
assert.equal(compactStart.getDate(), 5, 'compact legacy timestamps must preserve their calendar day');
assert.equal(compactStart.getHours(), 10, 'compact legacy timestamps must preserve their local hour');
assert.equal(compactEnd.getMinutes(), 25, 'compact legacy timestamps must preserve their minute');

const startOnlyRecord = normalizeRecord({
    startTime: '2026-09-05T10:00:00.000Z',
    durationSec: 1500,
});
assert.equal(
    Date.parse(startOnlyRecord.end) - Date.parse(startOnlyRecord.start),
    25 * 60000,
    'records with only a start timestamp must derive their end from duration',
);

const epochSecondsRecord = normalizeRecord({
    timestamp: 1788584700,
    durationMin: 25,
});
assert.equal(
    Date.parse(epochSecondsRecord.end),
    1788584700 * 1000,
    'numeric epoch seconds must not be mistaken for milliseconds',
);
assert.equal(
    Date.parse(epochSecondsRecord.start),
    1788584700 * 1000 - 25 * 60000,
    'records with only an end timestamp must derive their start from duration',
);

console.log('calendar tomato record contract tests passed');
