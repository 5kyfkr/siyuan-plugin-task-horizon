'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(process.env.CALENDAR_TEST_SOURCE || path.resolve(__dirname, '../calendar-view.js'), 'utf8');
class Clock extends Date { constructor(...args) { super(...(args.length ? args : ['2026-09-30T12:00:00'])); } }
const key = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
const calls = [];
const context = vm.createContext({ Date: Clock, Map, Set, state: {}, formatDateKey: key,
    parseDateOnly: value => new Clock(value + 'T00:00:00'), pad2: value => String(value).padStart(2, '0'),
    __tomatoReminder: { isCheckinDate: (_reminder, date) => { calls.push(date); return ['2026-09-28', '2026-09-30', '2026-10-02'].includes(date); } },
});
const start = source.indexOf('    function reminderOccurrenceKey(');
const end = source.indexOf('    function normalizeCalendarCustomHolidayOverrides(', start);
assert.ok(start >= 0 && end > start);
vm.runInContext(source.slice(start, end), context);
const record = { enabled: true, blockId: 'habit', repeatMode: 'followTaskRepeat', times: ['09:00', '18:00'],
    startDate: '2026-01-01', taskCompletionTime: '', taskRepeatRule: { enabled: true, trigger: 'checkin' },
    completedOccurrences: [{ date: '2026-09-28', time: '09:00' }, { date: '2026-09-28', time: '18:00' }] };
const events = context.buildEventsFromReminders([record], new Clock('2026-09-28'), new Clock('2026-10-05'), { linkDockTomato: true, showTaskReminders: true });
assert.deepEqual(Array.from(events, event => event.start), ['2026-09-28', '2026-09-30'], 'calendar keeps elapsed check-in dates and hides future dates');
assert.equal(events[0].extendedProps.__tmReminderDone, true);
assert.equal(events[1].extendedProps.__tmReminderDone, false);
assert.equal(calls.includes('2026-10-02'), false, 'future calendar dates must not become visible early');
console.log('calendar check-in reminders use shared schedule, retain history and hide future dates');
