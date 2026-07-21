'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
    path.resolve(__dirname, '..', 'src', 'task-horizon', 'main', '20-api-and-runtime-services.js'),
    'utf8'
);
const start = source.indexOf('function __tmReminderToDateSafe');
const end = source.indexOf('function __tmGetLastDueReminderDateTime', start);
assert.ok(start >= 0 && end > start, 'Task Horizon reminder projection block must remain extractable');

const context = {
    Date,
    Intl,
    JSON,
    Math,
    Number,
    Set,
    String,
    __TM_REMINDER_REPEAT_MODE_FOLLOW_TASK: 'followTaskRepeat',
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}\nthis.__test = { __tmNormalizeReminderRecord, __tmGetNextReminderDateTime };`, context);

const rawReminder = {
    enabled: true,
    repeatMode: 'followTaskRepeat',
    interval: 'once',
    times: ['09:00'],
    startDate: '2026-07-18',
    taskCompletionTime: '2026-07-18',
    taskRepeatRule: {
        enabled: true,
        type: 'daily',
        every: 1,
        monthlyMode: 'date',
        calendarMode: 'solar',
        until: '',
        maxOccurrences: 0,
        anchorDate: '2026-07-18',
    },
    taskRepeatState: { occurrenceCount: 1 },
    excludedOccurrences: [{ date: '2026-07-18', time: '09:00' }],
};

const normalized = context.__test.__tmNormalizeReminderRecord(rawReminder, 'task-id');
assert.equal(normalized.excludedOccurrences.length, 1, 'normalization must preserve deleted occurrence exceptions');
const next = context.__test.__tmGetNextReminderDateTime(normalized, new Date('2026-07-18T08:00:00'));
assert.ok(next instanceof Date && !Number.isNaN(next.getTime()));
assert.equal(next.getFullYear(), 2026);
assert.equal(next.getMonth(), 6);
assert.equal(next.getDate(), 19, 'Task Horizon must display the next follow recurrence after deleting the current reminder');
assert.equal(next.getHours(), 9);
assert.equal(next.getMinutes(), 0);

const severalDeleted = context.__test.__tmNormalizeReminderRecord({
    ...rawReminder,
    excludedOccurrences: Array.from({ length: 10 }, (_, offset) => ({
        date: `2026-07-${String(18 + offset).padStart(2, '0')}`,
        time: '09:00',
    })),
}, 'task-id');
const nextAfterSeveralDeletes = context.__test.__tmGetNextReminderDateTime(severalDeleted, new Date('2026-07-18T08:00:00'));
assert.ok(nextAfterSeveralDeletes instanceof Date && !Number.isNaN(nextAfterSeveralDeletes.getTime()));
assert.equal(nextAfterSeveralDeletes.getDate(), 28, 'Task Horizon must skip every consecutively deleted reminder occurrence');

const finalOccurrence = context.__test.__tmNormalizeReminderRecord({
    ...rawReminder,
    taskRepeatRule: { ...rawReminder.taskRepeatRule, maxOccurrences: 1 },
}, 'task-id');
assert.equal(
    context.__test.__tmGetNextReminderDateTime(finalOccurrence, new Date('2026-07-18T08:00:00')),
    null,
    'deleting the final count-limited occurrence must not invent another reminder'
);
