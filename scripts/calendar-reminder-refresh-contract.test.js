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
const reminderDedupe = sourceBetween(
    '    async function dedupeReminderBlocks',
    '    async function loadReminderBlocks',
);

assert.match(
    reminderLoader,
    /const cacheEpoch = Number\(state\.reminderCacheEpoch\) \|\| 0;[\s\S]*if \(\(Number\(state\.reminderCacheEpoch\) \|\| 0\) !== cacheEpoch\)[\s\S]*return await loadReminderBlocks\(\);/,
    'an invalidated in-flight reminder read must retry instead of restoring stale cache data',
);
assert.doesNotMatch(
    reminderDedupe,
    /perfTrace|uniq\.length|out\.size/,
    'reminder dedupe must not reference unrelated query metrics that reject the TOMATO read',
);
assert.match(
    refreshRuntime,
    /function clearReminderCalendarCache\(\)[\s\S]*state\.reminderCacheEpoch = \(Number\(state\.reminderCacheEpoch\) \|\| 0\) \+ 1;[\s\S]*state\.reminderCache = \{ list: null, loadedAt: 0, inflight: null \};/,
    'reminder cache invalidation must advance the read epoch and mark the snapshot as unloaded',
);
assert.match(
    refreshRuntime,
    /function scheduleReminderCalendarRefetch\(\) \{\s*clearReminderCalendarCache\(\);[\s\S]*loadReminderBlocks\(\)[\s\S]*scheduleTomatoRefetch\(\);/,
    'reminder updates must invalidate and materialize the new snapshot before refetching',
);

const timers = [];
const refetches = [];
const reminderReads = [];
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
    loadReminderBlocks() {
        return new Promise((resolve) => reminderReads.push(resolve));
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

async function run() {
    const refresh = context.refreshReminders();
    assert.equal(context.state.reminderCacheEpoch, 1);
    assert.equal(context.state.reminderCache.list, null);
    assert.equal(timers.length, 0, 'Do not repaint stale reminder dates while the new snapshot is loading');
    reminderReads.shift()([]);
    await refresh;
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

    const stale = context.refreshReminders();
    const latest = context.refreshReminders();
    const before = timers.length;
    reminderReads.shift()([]);
    await stale;
    assert.equal(timers.length, before, 'An older reminder read cannot schedule a stale repaint');
    reminderReads.shift()([]);
    await latest;
    assert.equal(timers.length, before + 1, 'The latest reminder update owns the refresh');

    console.log('calendar reminder refresh contract tests passed');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
