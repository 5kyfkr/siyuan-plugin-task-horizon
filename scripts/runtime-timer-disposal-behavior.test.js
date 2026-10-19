'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const between = (source, start, end) => {
    const begin = source.indexOf(start), finish = source.indexOf(end, begin + start.length);
    assert.ok(begin >= 0 && finish > begin, start);
    return source.slice(begin, finish);
};
function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}
function timers() {
    const pending = new Set();
    const api = {
        pending,
        setTimeout(fn, delay) { const timer = { fn, delay }; pending.add(timer); return timer; },
        clearTimeout(timer) { pending.delete(timer); },
        setInterval(fn, delay) { return api.setTimeout(fn, delay); },
        clearInterval(timer) { pending.delete(timer); },
        fire(timer) { pending.delete(timer); return timer.fn(); },
    };
    return api;
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

async function calendarChecks() {
    const source = read('calendar-view.js'), clock = timers();
    let mobile = false, reads = null, shared = null, refreshes = 0;
    const sr = { timers: new Map(), refreshGeneration: 0, sharedFileWatchGeneration: 0 };
    const settings = { scheduleReminderEnabled: true };
    const context = vm.createContext({ ...clock, Date, console,
        state: { scheduleReminder: sr, settingsStore: { data: {} } },
        document: { visibilityState: 'visible', removeEventListener() {} }, window: { removeEventListener() {} },
        getSettings: () => settings,
        scheduleWechatReminderReconcile() {}, scheduleScheduleMobileSync() {},
        shouldPreferDeviceNotificationBackend: () => mobile,
        reconcileScheduleNotificationRecordLedger: async () => {},
        loadScheduleMobileRegistry: () => ({}),
        loadScheduleAll: () => reads ? reads.promise : Promise.resolve([]),
        refreshScheduleCacheFromSharedFile: () => shared.promise,
        scheduleCalendarRefresh() { refreshes++; },
        formatDateKey: () => '2026-10-18', parseReminderTime: () => null,
    });
    vm.runInContext(between(source, '    function clearScheduleReminderTimers()', '    function bindScheduleReminderBackgroundRefresh()')
        + between(source, '    function unbindScheduleReminderEngine()', '    function buildCalendarExternalDropCommitKey('), context);
    context.unbindScheduleReminderBackgroundRefresh = () => context.stopSharedScheduleFileWatch();

    await context.refreshScheduleReminderTimers('live');
    assert.deepEqual(Array.from(clock.pending, timer => timer.delay), [600000], 'live reminders retain the periodic refresh');
    const stalePeriodic = sr.periodicTimer;
    context.clearScheduleReminderTimers();
    reads = deferred();
    const old = context.refreshScheduleReminderTimers('old');
    await flush();
    context.scheduleScheduleReminderRefresh('queued');
    context.clearScheduleReminderTimers();
    const oldRead = reads;
    reads = deferred();
    const current = context.refreshScheduleReminderTimers('new');
    await flush();
    oldRead.resolve([]);
    await old;
    assert.equal(sr.refreshRunning, true, 'old finally must not unlock the current refresh');
    assert.equal(clock.pending.size, 0, 'cleared refresh must not re-arm a timer or queued work');
    reads.resolve([]);
    await current;
    assert.equal(clock.pending.size, 1);
    context.unbindScheduleReminderEngine();
    await stalePeriodic.fn();
    context.scheduleScheduleReminderRefresh('stale-listener');
    assert.equal(clock.pending.size, 0, 'unbound engine must not restart');

    sr.disposed = false;
    mobile = true;
    shared = deferred();
    context.ensureSharedScheduleFileWatch();
    const watch = sr.sharedFileWatchTimer;
    const watching = clock.fire(watch);
    await flush();
    context.stopSharedScheduleFileWatch();
    shared.resolve({ changed: true });
    await watching;
    assert.equal(refreshes, 0);
    assert.equal(clock.pending.size, 0, 'a stopped in-flight watcher must not restart');
    shared = deferred();
    context.ensureSharedScheduleFileWatch();
    const previousWatch = clock.fire(sr.sharedFileWatchTimer);
    const previousRead = shared;
    context.stopSharedScheduleFileWatch();
    shared = deferred();
    context.ensureSharedScheduleFileWatch();
    const liveWatch = clock.fire(sr.sharedFileWatchTimer);
    previousRead.resolve({ changed: true });
    await previousWatch;
    assert.equal(sr.sharedFileWatchRunning, true, 'old watcher completion must not unlock a restarted watcher');
    assert.equal(clock.pending.size, 0);
    shared.resolve({ changed: true });
    await liveWatch;
    assert.equal(refreshes, 1, 'active watchers must still discover shared changes');
    context.unbindScheduleReminderEngine();
    assert.equal(clock.pending.size, 0);
}

async function pointsChecks() {
    const source = read('src/task-horizon/main/20-api-and-runtime-services.js'), clock = timers();
    let settingsRead = deferred(), ledger = deferred(), effects = 0;
    const settings = { integrationEnabled: true, scheduleEnabled: true, checkTimes: [], confirmModalEnabled: true };
    const context = vm.createContext({ ...clock, Date, console, __TM_POINTS_PENALTY_TICK_MS: 30000,
        __tmEnsureSettingsLoaded: () => settingsRead.promise,
        __tmGetPointsPenaltyRuntimeSettings: () => settings,
        __tmClosePointsPenaltyConfirmModal() {},
        __tmSyncPointsPenaltyLedger: () => ledger.promise,
        __tmCollectPointsPenaltyCandidates: async () => { effects++; return [{ id: 'penalty' }]; },
        __tmShowPointsPenaltyConfirmModal: () => { effects++; },
    });
    vm.runInContext(between(source, '    let __tmPointsPenaltyCheckTimer =', '    function __tmParsePointsPenaltyCheckTimeEntry(')
        + between(source, '    async function __tmRunPointsPenaltyCheck(', '    globalThis.__tmPointsPenaltyRuntimeRefresh ='), context);
    const old = context.__tmRefreshPointsPenaltyRuntime();
    context.__tmDisposePointsPenaltyRuntime();
    settingsRead.resolve();
    assert.equal(await old, false);
    assert.equal(clock.pending.size, 0, 'late settings read must not recreate the interval');
    context.__tmInitPointsPenaltyRuntime();
    await flush();
    assert.equal(clock.pending.size, 1, 're-initialization creates exactly one interval');
    const staleInterval = Array.from(clock.pending)[0];
    const check = context.__tmRunPointsPenaltyCheck();
    context.__tmDisposePointsPenaltyRuntime();
    ledger.resolve();
    await check;
    staleInterval.fn();
    assert.equal(effects, 0, 'disposed checks must not start candidate effects');
    assert.equal(clock.pending.size, 0);
}

async function scheduledChecks() {
    const clock = timers();
    const context = vm.createContext({ ...clock, Date, console,
        SettingsStore: { data: { scheduledEvents: [], scheduledEventsSchemaVersion: 2 }, syncToLocal() {} },
        window: { addEventListener() {}, removeEventListener() {} },
        document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
    });
    vm.runInContext(read('src/task-horizon/main/settings/65-scheduled-events-runtime.js') + '\nthis.runtime = __tmScheduledRuntime;', context);
    const api = context['siyuan-plugin-task-horizon'].scheduledEvents;
    context.__tmScheduledIsDesktopRuntime = () => true;
    context.__tmScheduledCoreSupported = () => true;
    let remote = deferred(), merges = 0;
    context.__tmScheduledReadRemoteEvents = () => remote.promise;
    context.__tmScheduledMergeRemoteEvents = () => { merges++; };
    const old = api.refresh();
    api.dispose();
    // Simulate a newly active generation before the old read finishes.
    context.runtime.disposed = false;
    context.runtime.generation++;
    context.__tmScheduledArmTimer();
    const currentTimer = context.runtime.timer;
    remote.resolve([]);
    await old;
    assert.equal(merges, 0, 'stale remote reads must not publish into the next generation');
    assert.equal(context.runtime.timer, currentTimer, 'stale finally must not replace the current timer');
    assert.equal(clock.pending.size, 1);

    const gate = deferred();
    context.runtime.queue = gate.promise;
    let runs = 0;
    const queued = context.__tmScheduledEnqueue(() => { runs++; });
    api.dispose();
    gate.resolve();
    await queued;
    assert.equal(runs, 0, 'queued events must be checked again when execution begins');
    assert.equal(clock.pending.size, 0);

    const snapshot = deferred();
    context.__tmScheduledReadKernelSnapshot = () => snapshot.promise;
    api.init();
    api.dispose();
    snapshot.resolve({ status: 'valid', events: [] });
    await flush();
    assert.equal(clock.pending.size, 0, 'late initialization must not restart the runner');
}

(async () => {
    await calendarChecks();
    await pointsChecks();
    await scheduledChecks();
    console.log('runtime timer disposal: live scheduling, in-flight stop/dispose, queued callbacks, and reinitialization checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
