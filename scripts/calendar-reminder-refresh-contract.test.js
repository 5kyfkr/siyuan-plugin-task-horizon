'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');

function sourceBetween(startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.ok(start >= 0 && end > start, `${startMarker} must remain inspectable`);
    return source.slice(start, end);
}

const suppressionRuntime = sourceBetween(
    '    function suppressReminderCalendarRefetchAfterScheduleMutation',
    '    function __tmNormalizeCalendarRefreshDetail',
);
const refreshRuntime = sourceBetween(
    '    function scheduleTomatoRefetch',
    '    function stabilizeCalendarLayout',
);
const reminderLoader = sourceBetween(
    '    async function loadReminderBlocks',
    '    function buildEventsFromReminders',
);

assert.match(
    reminderLoader,
    /const cacheEpoch = Number\(state\.reminderCacheEpoch\) \|\| 0;[\s\S]*if \(\(Number\(state\.reminderCacheEpoch\) \|\| 0\) !== cacheEpoch\)[\s\S]*return await loadReminderBlocks\(\);/,
    'an invalidated in-flight reminder read must retry instead of restoring stale cache data',
);
assert.match(
    refreshRuntime,
    /function clearReminderCalendarCache\(\)[\s\S]*state\.reminderCacheEpoch = \(Number\(state\.reminderCacheEpoch\) \|\| 0\) \+ 1;[\s\S]*state\.reminderCache = \{ list: \[\], loadedAt: 0, inflight: null \};/,
    'reminder cache invalidation must advance the read epoch',
);
assert.match(
    refreshRuntime,
    /function scheduleReminderCalendarRefetch\(\) \{\s*clearReminderCalendarCache\(\);\s*scheduleTomatoRefetch\(\);\s*\}/,
    'reminder updates must invalidate cache even while calendar refetching is suppressed',
);

const timers = [];
const refetches = [];
const context = vm.createContext({
    Date,
    Math,
    Number,
    String,
    EVENT_SOURCE_IDS: { mainAux: 'main-aux', sideAux: 'side-aux' },
    state: {
        calendar: { id: 'main' },
        sideDay: { calendar: { id: 'side' } },
        tomatoRefetchTimer: null,
        reminderCache: { list: [{ stale: true }], loadedAt: Date.now(), inflight: null },
        reminderCacheEpoch: 0,
        reminderCalendarRefetchSuppressedUntil: Date.now() + 500,
        reminderCalendarRefetchSuppressedReason: 'schedule-mutation',
    },
    setTimeout(callback, delay) {
        const timer = { callback, delay, cleared: false };
        timers.push(timer);
        return timer;
    },
    clearTimeout(timer) {
        if (timer) timer.cleared = true;
    },
    __tmRefetchCalendarSource(calendar, sourceId) {
        refetches.push([calendar?.id, sourceId]);
        return true;
    },
});

vm.runInContext(
    `${suppressionRuntime}\n${refreshRuntime}\nthis.refreshReminders = scheduleReminderCalendarRefetch;`,
    context,
);

context.refreshReminders();
assert.equal(context.state.reminderCacheEpoch, 1);
assert.equal(context.state.reminderCache.list.length, 0);
assert.equal(refetches.length, 0, 'suppressed reminder updates must wait before refetching');
assert.equal(timers.length, 1, 'suppressed reminder updates must retain one deferred refresh');
assert.ok(timers[0].delay >= 16);

context.state.reminderCalendarRefetchSuppressedUntil = 0;
timers[0].callback();
assert.equal(timers.length, 2, 'the deferred refresh must enter the normal debounce');
assert.equal(timers[1].delay, 120);
timers[1].callback();
assert.deepEqual(refetches, [
    ['main', 'main-aux'],
    ['side', 'side-aux'],
]);

console.log('calendar reminder refresh contract tests passed');
