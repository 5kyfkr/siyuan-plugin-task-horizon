'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const model = read('src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js');
const services = read('src/task-horizon/main/20-api-and-runtime-services.js');
const calendar = read('calendar-view.js');
const extract = (source, name) => {
    const start = source.indexOf(`    function ${name}(`);
    assert.ok(start >= 0, `missing ${name}`);
    return source.slice(start, source.indexOf('\n    }', start) + 6);
};

let schedules = null;
const context = vm.createContext({
    __tmCalendar: { getCachedTaskSchedules: () => schedules },
    __TM_CHECKLIST_COMPACT_META_FIELD_DEFAULTS: ['completionTime', 'scheduleTime', 'status'],
});
const indexStart = model.indexOf('    let __tmTaskScheduleTimeSource =');
vm.runInContext(model.slice(indexStart, model.indexOf('    function __tmGetTaskCardAlwaysShowFieldList', indexStart)), context);
vm.runInContext(extract(services, '__tmMigrateScheduleTimeFieldDefaults'), context);
const time = (task, now = '2026-10-14T07:00:00') => context.__tmGetTaskScheduleTime(task, new Date(now).getTime());
const task = { id: 'task-a' };
assert.equal(time(task), '', 'unloaded schedules must not show a placeholder');
schedules = [
    { taskId: 'task-a', start: '2026-10-15T09:05:00', end: '2026-10-15T10:00:00' },
    { taskId: 'task-a', start: '2026-10-14T06:00:00', end: '2026-10-14T06:30:00' },
    { taskId: 'task-a', start: '2026-10-14', end: '2026-10-15', allDay: true },
    { taskId: 'task-a', start: 'invalid' },
    { taskId: 'task-b', start: '2026-10-14T07:30:00', end: '2026-10-14T08:00:00' },
    { taskId: 'task-a', start: '2026-10-14T08:00:00', end: '2026-10-14T09:00:00' },
];
assert.equal(time(task), '8:00', 'choose the nearest timed schedule regardless of storage order');
assert.equal(context.__tmGetTaskScheduleTimeInfo(task, new Date('2026-10-14T07:00:00').getTime()).isToday, true, 'today styling follows the displayed schedule date');
assert.equal(time(task, '2026-10-14T08:30:00'), '8:00', 'a running schedule still shows its start time');
assert.equal(time(task, '2026-10-14T09:01:00'), '9:05', 'an ended schedule gives way to the next schedule');
assert.equal(context.__tmGetTaskScheduleTimeInfo(task, new Date('2026-10-14T09:01:00').getTime()).isToday, false, 'a future schedule stays plain even if the task had a schedule today');
assert.equal(time(task, '2026-10-15T10:01:00'), '', 'ended schedules stay hidden');
assert.equal(time({ blockId: 'task-b' }), '7:30', 'support task block identities');
assert.equal(time({ id: 'missing' }), '', 'do not borrow another task schedule');
schedules = [{ taskId: 'task-a', start: '2026-10-13T23:00:00', end: '2026-10-14T08:00:00' }];
assert.equal(context.__tmGetTaskScheduleTimeInfo(task, new Date('2026-10-14T07:00:00').getTime()).isToday, false, 'an overnight schedule keeps its actual start date');
schedules = [{ linked_task_id: 'task-a', start: '2026-10-14T00:05:00', end: '2026-10-14T08:00:00' }];
assert.equal(time(task), '0:05', 'cache replacement and midnight formatting must work');
schedules = [{ task_id: 'task-a', start: '2026-10-14T18:09:00' }];
assert.equal(time(task), '18:09', 'missing end time uses the start as expiry');
schedules = [{ taskId: 'task-a', start: '2026-10-14', allDay: true }];
assert.equal(time(task), '', 'all-day schedules do not invent an hour');
schedules = [];
assert.equal(time(task), '', 'deleted schedules clear the value');

const migrate = context.__tmMigrateScheduleTimeFieldDefaults;
const legacy = {
    desktopChecklistCompactMetaFields: ['completionTime', 'status'],
    dockChecklistCompactMetaFields: ['startDate', 'completionTime', 'customField:team'],
    mobileChecklistCompactMetaFields: [],
    kanbanCardFields: ['date', 'priority'],
    whiteboardCardFields: ['remark'],
};
assert.equal(migrate(legacy), true);
assert.deepEqual(Array.from(legacy.desktopChecklistCompactMetaFields), ['completionTime', 'scheduleTime', 'status']);
assert.deepEqual(Array.from(legacy.dockChecklistCompactMetaFields), ['startDate', 'completionTime', 'scheduleTime', 'customField:team']);
assert.deepEqual(Array.from(legacy.mobileChecklistCompactMetaFields), ['scheduleTime']);
assert.deepEqual(Array.from(legacy.kanbanCardFields), ['date', 'scheduleTime', 'priority']);
assert.deepEqual(Array.from(legacy.whiteboardCardFields), ['remark', 'scheduleTime']);
const disabled = JSON.parse(JSON.stringify(legacy));
for (const key of Object.keys(disabled).filter(key => Array.isArray(disabled[key]))) {
    disabled[key] = disabled[key].filter(field => field !== 'scheduleTime');
}
assert.equal(migrate(disabled), false, 'a persisted opt-out must survive subsequent loads');
assert.equal(disabled.kanbanCardFields.includes('scheduleTime'), false);

const events = [];
let reads = 0;
const cacheContext = vm.createContext({
    state: { scheduleCache: { list: null, inflight: null }, scheduleRangeCache: new Map() },
    cloneScheduleList: items => items.map(item => ({ ...item })),
    loadScheduleAll: () => { reads++; cacheContext.state.scheduleCache.inflight = Promise.resolve([]); return cacheContext.state.scheduleCache.inflight; },
    window: { dispatchEvent: event => events.push(event.type) },
    CustomEvent: class { constructor(type) { this.type = type; } },
});
vm.runInContext(extract(calendar, 'setScheduleCache') + extract(calendar, 'getCachedTaskSchedules'), cacheContext);
cacheContext.getCachedTaskSchedules();
cacheContext.getCachedTaskSchedules();
assert.equal(reads, 1, 'all visible tasks share one initial schedule read');
cacheContext.setScheduleCache([{ taskId: 'task-a' }], 'v1');
assert.equal(cacheContext.getCachedTaskSchedules(), cacheContext.state.scheduleCache.list);
assert.equal(reads, 1, 'cached rendering must not start another read');
Promise.resolve().then(() => {
    assert.deepEqual(events, ['tm:calendar-schedule-cache-updated'], 'cache hydration must notify visible fields');
    console.log('task schedule-time selection, migration, cache and refresh tests passed');
});
