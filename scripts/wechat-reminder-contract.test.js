'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const storesSource = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', '10-stores-rules-and-cache.js'), 'utf8');

function loadHelpers(overrides = {}) {
    const start = source.indexOf('function stableWechatReminderHash(');
    const end = source.indexOf('async function refreshSchedulesFromSharedFile(', start);
    assert.ok(start >= 0 && end > start, 'wechat helper block must remain extractable');
    const context = {
        Array,
        Date,
        Map,
        Math,
        Number,
        Object,
        String,
        SCHEDULE_MOBILE_WINDOW_DAYS: 30,
        collectAllDayScheduleSummaryTargets: () => [],
        collectScheduleMobileNotificationTargets: (_item, _settings, options) => [{
            atMs: Date.now() + 60 * 60 * 1000,
            startMs: Date.now() + 2 * 60 * 60 * 1000,
            offsetMin: 60,
            windowDays: options?.windowDays,
        }],
        pad2: (value) => String(value).padStart(2, '0'),
        state: {
            scheduleCache: { lastLoadError: false },
            scheduleReminder: {
                wechatRunning: false,
                wechatQueued: false,
                wechatPendingReason: '',
                wechatRegistryLoaded: false,
                wechatRegistrySnapshotFound: false,
                wechatRegistry: {},
                wechatLifecycleToken: 0,
            },
        },
        getSettings: () => ({ scheduleReminderEnabled: true, scheduleReminderWechatEnabled: true }),
        loadScheduleAll: async () => [],
        toast() {},
        console: { warn() {} },
        ...overrides,
    };
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(`${source.slice(start, end)}\nthis.__test = {
        stableWechatReminderHash,
        buildWechatReminderTarget,
        isWechatReminderTargetDue,
        limitWechatReminderContent,
        collectWechatTargets,
        diffWechatReminderTargets,
        mergeWechatReminderTargetsIntoRegistry,
        shouldDeferWechatReconcileUntilRegistryLoaded,
        shouldDeferWechatReminderRemovals,
        withWechatReminderReconcileLock,
        reconcileWechatReminders,
        configureRuntime: (runtime = {}) => {
            const sr = state.scheduleReminder;
            sr.wechatRunning = false;
            sr.wechatQueued = false;
            sr.wechatPendingReason = '';
            sr.wechatRegistryLoaded = false;
            sr.wechatRegistrySnapshotFound = runtime.snapshotFound !== false;
            sr.wechatLifecycleToken = 0;
            state.scheduleCache.lastLoadError = runtime.loadError === true;
            getSettings = () => ({
                scheduleReminderEnabled: runtime.enabled !== false,
                scheduleReminderWechatEnabled: runtime.wechatEnabled !== false,
            });
            loadWechatReminderRegistry = async () => {
                if (runtime.invalidateDuringLoad === true) sr.wechatLifecycleToken += 1;
                sr.wechatRegistrySnapshotFound = runtime.snapshotFound !== false;
                return { ...(runtime.registry || {}) };
            };
            loadScheduleAll = runtime.loadSchedules || (async () => runtime.list || []);
            getWechatReminderEligibility = runtime.getEligibility || (async () => ({ ok: true, reason: '' }));
            setCloudWechatReminder = runtime.setCloud || (async () => true);
            saveWechatReminderRegistryLocal = runtime.saveLocal || (() => {});
            saveWechatReminderRegistry = runtime.saveRegistry || (async (registry) => registry);
        },
    };`, context);
    return context.__test;
}

async function run() {
    const helpers = loadHelpers();
    const atMs = Date.now() + 60 * 60 * 1000;
    const first = helpers.buildWechatReminderTarget('task-horizon', 'schedule:a:1', atMs, '日程提醒：测试');
    const same = helpers.buildWechatReminderTarget('task-horizon', 'schedule:a:1', atMs, '日程提醒：测试');
    const other = helpers.buildWechatReminderTarget('dock-tomato', 'schedule:a:1', atMs, '日程提醒：测试');

    assert.match(first.dataId, /^\d{14}-[a-z0-9]{7}$/);
    assert.equal(first.dataId, same.dataId, 'same occurrence must keep a stable cloud id');
    assert.notEqual(first.dataId, other.dataId, 'plugin namespaces must not collide');
    assert.equal(Array.from(helpers.limitWechatReminderContent('测'.repeat(140))).length, 128);

    const current = { [first.dataId]: first };
    const unchanged = helpers.diffWechatReminderTargets(current, new Map([[first.dataId, first]]));
    assert.equal(unchanged.removals.length, 0);
    assert.equal(unchanged.upserts.length, 0);
    const changed = { ...first, content: '日程提醒：已修改', fingerprint: helpers.stableWechatReminderHash('changed') };
    assert.equal(helpers.diffWechatReminderTargets(current, new Map([[changed.dataId, changed]])).upserts.length, 1);
    assert.equal(helpers.diffWechatReminderTargets(current, new Map()).removals.length, 1);

    const moved = helpers.buildWechatReminderTarget('task-horizon', 'schedule:a:1', atMs + 60 * 60 * 1000, '日程提醒：测试');
    const movedDiff = helpers.diffWechatReminderTargets(current, new Map([[moved.dataId, moved]]));
    assert.equal(movedDiff.removals.length, 1, 'moving a schedule must cancel the old cloud reminder');
    assert.equal(movedDiff.upserts.length, 1, 'moving a schedule must register the new cloud reminder');

    const disabledSettings = { scheduleReminderEnabled: false, scheduleReminderWechatEnabled: false };
    const schedules = [{ id: 'schedule-a', title: '未绑定块日程', taskId: '', blockId: '' }];
    assert.equal(helpers.collectWechatTargets(schedules, disabledSettings).size, 0, 'disabled periodic collection must be empty');
    const forcedTargets = helpers.collectWechatTargets(schedules, disabledSettings, { force: true });
    assert.equal(forcedTargets.size, 1, 'unbound schedules must remain eligible for cloud reminders');
    const forcedRegistry = helpers.mergeWechatReminderTargetsIntoRegistry({}, forcedTargets);
    const disableDiff = helpers.diffWechatReminderTargets(forcedRegistry, new Map());
    assert.equal(disableDiff.removals.length, 1, 'explicit disable must cancel recovered current targets');
    assert.equal(disableDiff.upserts.length, 0);
    assert.equal(helpers.shouldDeferWechatReconcileUntilRegistryLoaded('bind', false), true, 'calendar startup must wait for the synced registry snapshot');
    assert.equal(helpers.shouldDeferWechatReconcileUntilRegistryLoaded('sync-end', false), true, 'calendar sync-end must not bulk-register without a snapshot');
    assert.equal(helpers.shouldDeferWechatReconcileUntilRegistryLoaded('settings-enable', false), false, 'explicit calendar enable may bootstrap the registry');
    assert.equal(helpers.shouldDeferWechatReconcileUntilRegistryLoaded('bind', true), false, 'calendar startup may diff once a durable snapshot exists');

    let lockRequests = 0;
    const lockedHelpers = loadHelpers({
        navigator: {
            locks: {
                async request(name, options, callback) {
                    lockRequests += 1;
                    assert.equal(name, 'task-horizon:calendar-wechat-reminder-reconcile');
                    assert.equal(options.mode, 'exclusive');
                    return await callback();
                },
            },
        },
    });
    assert.equal(await lockedHelpers.withWechatReminderReconcileLock(async () => 'done'), 'done');
    assert.equal(lockRequests, 1, 'Web Locks must serialize reconciliation across calendar contexts');
    assert.equal(await helpers.withWechatReminderReconcileLock(async () => 'done'), 'done');

    assert.equal(helpers.shouldDeferWechatReminderRemovals('bind'), true, 'calendar bind must not remove cloud reminders');
    assert.equal(helpers.shouldDeferWechatReminderRemovals('app-visibility'), true, 'calendar resume must not remove cloud reminders');
    assert.equal(helpers.shouldDeferWechatReminderRemovals('visibility'), true, 'mobile visibility refresh must not remove cloud reminders');
    assert.equal(helpers.shouldDeferWechatReminderRemovals('schedule-save:update'), false, 'schedule mutations may reconcile removals');

    const reminderAtMs = Date.now() + 60 * 60 * 1000;
    const schedule = { id: 'schedule-a', title: '测试日程' };
    const runtimeHelpers = loadHelpers({
        collectScheduleMobileNotificationTargets: () => [{
            atMs: reminderAtMs,
            startMs: reminderAtMs + 60 * 60 * 1000,
            offsetMin: 60,
        }],
    });
    const settings = { scheduleReminderEnabled: true, scheduleReminderWechatEnabled: true };
    const registered = Array.from(runtimeHelpers.collectWechatTargets([schedule], settings).values())[0];
    assert.ok(registered, 'test schedule target must be created');

    const unchangedCalls = [];
    runtimeHelpers.configureRuntime({
        registry: { [registered.dataId]: registered },
        list: [schedule],
        setCloud: async (entry, cancel) => unchangedCalls.push({ entry, cancel }),
    });
    await runtimeHelpers.reconcileWechatReminders('bind');
    assert.equal(unchangedCalls.length, 0, 're-entering with unchanged schedules must not call the cloud API');

    const emptyBindCalls = [];
    runtimeHelpers.configureRuntime({
        registry: { [registered.dataId]: registered },
        list: [],
        setCloud: async (entry, cancel) => emptyBindCalls.push({ entry, cancel }),
    });
    await runtimeHelpers.reconcileWechatReminders('bind');
    assert.equal(emptyBindCalls.length, 0, 'an incomplete bind snapshot must not remove cloud reminders');

    const periodicCalls = [];
    runtimeHelpers.configureRuntime({
        registry: { [registered.dataId]: registered },
        list: [],
        setCloud: async (entry, cancel) => periodicCalls.push({ entry, cancel }),
    });
    await runtimeHelpers.reconcileWechatReminders('periodic');
    assert.equal(periodicCalls.length, 1, 'an authoritative periodic reconcile must remove stale reminders');
    assert.equal(periodicCalls[0].cancel, true, 'stale schedule cleanup must cancel the cloud reminder');

    let disabledQueries = 0;
    const disabledCalls = [];
    runtimeHelpers.configureRuntime({
        enabled: false,
        registry: { [registered.dataId]: registered },
        loadSchedules: async () => { disabledQueries += 1; return []; },
        setCloud: async (entry, cancel) => disabledCalls.push({ entry, cancel }),
    });
    await runtimeHelpers.reconcileWechatReminders('bind');
    assert.equal(disabledQueries, 0, 'a disabled setting during bind must not query or clean up reminders');
    assert.equal(disabledCalls.length, 0, 'a disabled setting during bind must not cancel reminders');

    const explicitDisableCalls = [];
    runtimeHelpers.configureRuntime({
        enabled: false,
        registry: {},
        list: [schedule],
        setCloud: async (entry, cancel) => explicitDisableCalls.push({ entry, cancel }),
    });
    await runtimeHelpers.reconcileWechatReminders('settings-disable');
    assert.equal(explicitDisableCalls.length, 1, 'explicit disable must cancel current schedule targets');
    assert.equal(explicitDisableCalls[0].cancel, true, 'explicit disable must use the cloud cancel operation');

    const failedReadCalls = [];
    runtimeHelpers.configureRuntime({
        registry: { [registered.dataId]: registered },
        loadError: true,
        setCloud: async (entry, cancel) => failedReadCalls.push({ entry, cancel }),
    });
    await runtimeHelpers.reconcileWechatReminders('periodic');
    assert.equal(failedReadCalls.length, 0, 'a failed schedule read must not be treated as an empty authoritative list');

    const dueAtMs = Date.now() - 1000;
    const dueDate = new Date(dueAtMs);
    const formatLocalTimed = (date) => [
        date.getFullYear(), date.getMonth() + 1, date.getDate(),
        date.getHours(), date.getMinutes(), date.getSeconds(),
    ].map((value, index) => index === 0 ? String(value) : String(value).padStart(2, '0')).join('');
    const dueTarget = runtimeHelpers.buildWechatReminderTarget('task-horizon', 'schedule:due:1', Date.now() + 60 * 60 * 1000, '到点测试');
    dueTarget.timed = formatLocalTimed(new Date(dueAtMs + 60 * 60 * 1000));
    assert.equal(runtimeHelpers.isWechatReminderTargetDue(dueTarget), false, 'future cloud targets must not be treated as due');
    dueTarget.timed = formatLocalTimed(dueDate);
    assert.equal(runtimeHelpers.isWechatReminderTargetDue(dueTarget), true, 'past cloud targets must be recognized as due');

    const dueRemovalCalls = [];
    runtimeHelpers.configureRuntime({
        registry: { [dueTarget.dataId]: dueTarget },
        list: [],
        setCloud: async (entry, cancel) => dueRemovalCalls.push({ entry, cancel }),
    });
    await runtimeHelpers.reconcileWechatReminders('fire');
    assert.equal(dueRemovalCalls.length, 0, 'a due reminder must not be canceled from the cloud at fire time');

    const unloadedCalls = [];
    runtimeHelpers.configureRuntime({
        registry: { [registered.dataId]: registered },
        invalidateDuringLoad: true,
        setCloud: async (entry, cancel) => unloadedCalls.push({ entry, cancel }),
    });
    await runtimeHelpers.reconcileWechatReminders('bind');
    assert.equal(unloadedCalls.length, 0, 'an unloaded calendar view must not continue its old WeChat reconcile');

    assert.match(source, /\/api\/cloud\/setCloudReminder/);
    assert.match(source, /async function saveScheduleAll[\s\S]*scheduleWechatReminderReconcile\(`schedule-save:/);
    assert.doesNotMatch(source, /微信提醒预约已更新/);
    assert.match(source, /collectAllDayScheduleSummaryTargets\(list, settings\)/);
    assert.match(source, /await withWechatReminderReconcileLock\(async \(\) => \{[\s\S]*wechatRegistryLoaded = false[\s\S]*loadWechatReminderRegistry\(\)/, 'cross-view reconciliation must serialize and then reload the registry');
    assert.match(source, /await setCloudWechatReminder\(entry, false\);[\s\S]*saveWechatReminderRegistryLocal\(registry\)/, 'successful cloud writes must checkpoint locally before the batch finishes');
    assert.match(source, /state\.scheduleCache\.lastLoadError\s*=\s*!sourceLoaded/, 'schedule read failures must be distinguishable from an empty schedule list');
    assert.match(source, /wechatLifecycleToken/, 'calendar unmount must invalidate an in-flight WeChat reconcile');
    assert.match(storesSource, /calendarScheduleReminderWechatEnabled:\s*false/);
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
