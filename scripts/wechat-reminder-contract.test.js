'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
const storesSource = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', '10-stores-rules-and-cache.js'), 'utf8');

function loadHelpers() {
    const start = source.indexOf('function stableWechatReminderHash(');
    const end = source.indexOf('async function reconcileWechatReminders(', start);
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
    };
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(`${source.slice(start, end)}\nthis.__test = { stableWechatReminderHash, buildWechatReminderTarget, limitWechatReminderContent, collectWechatTargets, diffWechatReminderTargets, mergeWechatReminderTargetsIntoRegistry, shouldDeferWechatReconcileUntilRegistryLoaded };`, context);
    return context.__test;
}

function run() {
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

    assert.match(source, /\/api\/cloud\/setCloudReminder/);
    assert.match(source, /async function saveScheduleAll[\s\S]*scheduleWechatReminderReconcile\(`schedule-save:/);
    assert.doesNotMatch(source, /微信提醒预约已更新/);
    assert.match(source, /collectAllDayScheduleSummaryTargets\(list, settings\)/);
    assert.match(storesSource, /calendarScheduleReminderWechatEnabled:\s*false/);
}

run();
