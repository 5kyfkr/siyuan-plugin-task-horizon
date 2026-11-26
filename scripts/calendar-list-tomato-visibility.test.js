'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const calendarSource = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');

function readFunction(name, context = {}) {
    const start = calendarSource.indexOf('function ' + name + '(');
    assert.ok(start >= 0, name + ' must be defined');
    const signatureEnd = calendarSource.indexOf(') {', start);
    assert.ok(signatureEnd >= 0, name + ' must have a complete signature');
    const bodyStart = signatureEnd + 2;
    let depth = 0;
    for (let index = bodyStart; index < calendarSource.length; index += 1) {
        if (calendarSource[index] === '{') depth += 1;
        if (calendarSource[index] === '}') depth -= 1;
        if (depth === 0) return vm.runInNewContext('(' + calendarSource.slice(start, index + 1) + ')', context);
    }
    assert.fail(name + ' must have a complete function body');
}

const isCalendarListViewType = readFunction('isCalendarListViewType');
const shouldShowCalendarTomatoInView = readFunction('shouldShowCalendarTomatoInView', { isCalendarListViewType });
const normalizeRecord = readFunction('normalizeCalendarTomatoRecord', { Date });
const normalizeRecords = readFunction('normalizeCalendarTomatoRecords', {
    Date,
    Array,
    Number,
    normalizeCalendarTomatoRecord: normalizeRecord,
    toMs: (value) => value instanceof Date ? value.getTime() : Date.parse(String(value || '')),
    overlap: (start1, end1, start2, end2) => start1 < end2 && end1 > start2,
});
const buildEventsFromRecords = readFunction('buildEventsFromRecords', {
    normalizeCalendarTomatoRecords: normalizeRecords,
    normalizeCalendarTomatoRecord: normalizeRecord,
    shouldShowCalendarTomatoInView,
    shouldShowMode: () => true,
    modeLabel: () => 'Focus',
    resolveModeColor: () => '#4f8cff',
    formatDurationMinutes: (minutes) => minutes + 'm',
    buildRecordKey: (record) => ({ start: record.start, end: record.end }),
    toMs: (value) => Date.parse(String(value || '')),
});
const filterCalendarSourceSnapshotEvents = readFunction('filterCalendarSourceSnapshotEvents', {
    shouldShowCalendarTomatoInView,
    shouldShowMode: (mode, settings) => {
        const kind = String(mode || '').trim();
        if (kind === 'break' || kind === 'stopwatch-break') return settings.showBreak === true;
        if (kind === 'stopwatch') return settings.showStopwatch === true;
        if (kind === 'idle') return settings.showIdle === true;
        return settings.showFocus === true;
    },
});

const record = {
    sessionId: 'list-visibility-session',
    start: '2026-09-05T10:00:00.000Z',
    end: '2026-09-05T10:25:00.000Z',
    mode: 'countdown',
    durationMin: 25,
};
const baseSettings = {
    monthAggregate: false,
    showFocus: true,
    showBreak: true,
    colorFocus: '#4f8cff',
    showTomatoInList: false,
};

assert.equal(buildEventsFromRecords([record], baseSettings, 'listMonth').length, 0,
    'list view must hide Pomodoro records by default');
assert.equal(buildEventsFromRecords([record], { ...baseSettings, showTomatoInList: true }, 'listMonth').length, 1,
    'enabling the list setting must show Pomodoro records');
assert.equal(buildEventsFromRecords([record], baseSettings, 'timeGridDay').length, 1,
    'the list-only setting must not hide Pomodoro records from calendar grid views');
assert.equal(buildEventsFromRecords([record], { ...baseSettings, showTomatoInList: true, monthAggregate: true }, 'listMonth').length, 1,
    'month aggregation must not suppress Pomodoro records from listMonth');

const tomatoEvent = { id: 'tomato', extendedProps: { __tmSource: 'tomato', mode: 'countdown' } };
const breakEvent = { id: 'break', extendedProps: { __tmSource: 'tomato', mode: 'break' } };
const reminderEvent = { id: 'reminder', extendedProps: { __tmSource: 'reminder' } };
const scheduleEvent = { id: 'schedule', extendedProps: { __tmSource: 'schedule' } };
const snapshotSettings = {
    linkDockTomato: true,
    showTomatoMaster: true,
    showTaskReminders: true,
    showFocus: true,
    showBreak: true,
    showStopwatch: true,
    showIdle: true,
    monthAggregate: false,
    showTomatoInList: false,
};
const hiddenSnapshot = filterCalendarSourceSnapshotEvents(
    [tomatoEvent, reminderEvent, scheduleEvent], snapshotSettings, 'listMonth'
);
assert.equal(hiddenSnapshot.includes(tomatoEvent), false,
    'held snapshots must not restore Pomodoro records when list display is disabled');
assert.equal(filterCalendarSourceSnapshotEvents(
    [breakEvent], { ...snapshotSettings, showBreak: false, showTomatoInList: true }, 'listMonth'
).includes(breakEvent), false, 'record-type filters must also apply to held snapshots');
assert.equal(hiddenSnapshot.includes(reminderEvent), true,
    'the list Pomodoro setting must not hide reminder events');
assert.equal(hiddenSnapshot.includes(scheduleEvent), true,
    'the list Pomodoro setting must not hide schedule events');
assert.equal(filterCalendarSourceSnapshotEvents(
    [tomatoEvent], { ...snapshotSettings, showTomatoInList: true }, 'listMonth'
).includes(tomatoEvent), true, 'enabled list display must allow snapshot Pomodoro records');
assert.equal(filterCalendarSourceSnapshotEvents(
    [tomatoEvent], { ...snapshotSettings, showTomatoInList: true, showTomatoMaster: false }, 'listMonth'
).includes(tomatoEvent), false, 'the calendar Pomodoro master switch must still control list visibility');
assert.equal(filterCalendarSourceSnapshotEvents(
    [tomatoEvent], snapshotSettings, 'timeGridWeek'
).includes(tomatoEvent), true, 'other calendar views must retain their existing visibility');

const storeSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const exportSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/64-export-runtime.js'), 'utf8');
assert.match(storeSource, /calendarShowTomatoInList:\s*false/, 'the new setting must default off');
assert.match(storeSource, /Storage\.get\('tm_calendar_show_tomato_in_list', this\.data\.calendarShowTomatoInList\)/,
    'the setting must load from local storage');
assert.match(storeSource, /Storage\.set\('tm_calendar_show_tomato_in_list', !!this\.data\.calendarShowTomatoInList\)/,
    'the setting must save to local storage');
assert.match(storeSource, /cloudData\.calendarShowTomatoInList === 'boolean'/,
    'the setting must sync through the existing cloud settings path');
assert.match(exportSource, /'calendarShowTomatoInList'/,
    'the setting must be included in calendar settings export/import');
assert.match(calendarSource, /data-tm-cal-setting="calendarShowTomatoInList"/,
    'the calendar settings panel must expose the new switch');
for (const locale of ['en', 'zh-CN']) {
    const dictionary = JSON.parse(fs.readFileSync(path.join(root, 'i18n', locale + '.json'), 'utf8'));
    assert.ok(dictionary['calendar.showTomatoRecordsInListView'], locale + ' must define the setting label');
    assert.ok(dictionary['calendar.showTomatoRecordsInListViewDesc'], locale + ' must define the setting description');
}

console.log('calendar list tomato visibility tests passed');
