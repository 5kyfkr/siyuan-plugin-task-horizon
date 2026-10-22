'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'calendar-view.js'), 'utf8');
function extract(startMarker, endMarker, from = 0) {
    const start = source.indexOf(startMarker, from);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.ok(start >= 0 && end > start, `missing ${startMarker}`);
    return source.slice(start, end);
}
const persistence = extract('    function refreshScheduleAfterMutationResult(', '    function parseTaskDurationMinutes(');
const sideDropStart = source.indexOf('            eventDrop: async (arg) =>');
const mainDropStart = source.indexOf('            eventDrop: async (arg) =>', sideDropStart + 1);
const handlers = [
    extract('            eventDrop: async (arg) =>', '            eventResize:', sideDropStart),
    extract('            eventResize: async (arg) =>', '            dateClick:', sideDropStart),
    extract('            eventDrop: async (arg) =>', '            eventResize:', mainDropStart),
    extract('            eventResize: async (arg) =>', '            select:', mainDropStart),
];

async function verify(handler, originDay, allDay, mode, dateMode = 'manual', scheduleDay = 13) {
    const date = (day, hour = 0) => new Date(2026, 8, day, hour);
    const dateKey = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    const start = date(originDay, allDay ? 0 : 9);
    const end = allDay ? date(originDay + 2) : date(originDay, 10);
    const original = { id: 'original-schedule', taskId: 'linked-task', start: start.toISOString(), end: end.toISOString(), allDay };
    let stored = [original];
    let saves = 0;
    let reverts = 0;
    let updates = 0;
    let refreshed = 0;
    let updateOptions = null;
    const notices = [];
    const pending = new Map();
    const context = vm.createContext({
        Date, Map, Set, console: { warn() {} },
        window: {
            tmUpdateTaskDates: async (_id, patch, options) => {
                updates += 1;
                updateOptions = options;
                if (mode === 'follow-fails') {
                    if (options.showErrorHint !== false) notices.push(['error', '日期失败: 任务不在合法的列表容器中']);
                    throw new Error('任务不在合法的列表容器中');
                }
                return { id: 'linked-task', ...patch };
            },
            dispatchEvent() {},
        },
        CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
        state: { flatTasks: { 'linked-task': { id: 'linked-task', startDate: '2026-09-09', completionTime: '2026-09-11',
            ...(dateMode === 'alias' ? { date_mode: 'rollup' }
                : dateMode === 'legacy' ? { 'custom-task-date-mode': 'rollup' } : { dateMode }) } } }, calendar: {},
        getSettings: () => ({ scheduleDatesFollowSchedule: true }),
        getScheduleLinkedBlockId: (item) => item?.blockId || '',
        isTaskDateRecurringExceptionScheduleItem: () => false,
        isLinkedTaskRecurringTask: async () => false,
        buildCalendarTaskMetaLegacyReadKeys: (_field, keys) => keys,
        parseDateOnly: (value) => new Date(`${value}T00:00:00`),
        formatDateKey: dateKey,
        toMs: (value) => new Date(value).getTime(),
        isAllDayRange: (a, b) => a.getHours() === 0 && b.getHours() === 0,
        cloneScheduleList: (list) => structuredClone(list),
        loadScheduleAll: async () => structuredClone(stored),
        saveScheduleAll: async (list) => {
            if (mode === 'save-fails') throw new Error('schedule save failed');
            stored = structuredClone(list);
            saves += 1;
        },
        getScheduleIdFromCalendarEvent: (event) => event.extendedProps.__tmScheduleId,
        safeISO: (value) => value.toISOString(),
        getScheduleRepeatType: () => 'none',
        normalizeScheduleRepeatType: (value) => value,
        rememberPendingTaskDateEventPatch: (id, patch) => pending.set(id, patch),
        forgetPendingTaskDateEventPatch: (id) => pending.delete(id),
        syncTaskDateEventFromDateFollowPatch: () => ({}),
        __tmRefetchTaskDateSources: () => ({}),
        __tmSchedulePostMutationRefresh: () => { refreshed += 1; },
        settleSidePrototypeCommittedDrag() {},
        clearSidePrototypeCommittedDrag() {},
        toast: (message, type) => notices.push([type, message]),
    });
    vm.runInContext(`${persistence}\nglobalThis.handler = Object.values({${handler}})[0];`, context);
    const event = {
        id: original.id, allDay,
        start: date(scheduleDay, allDay ? 0 : 9),
        end: allDay ? date(scheduleDay + 2) : date(scheduleDay, 10),
        extendedProps: { __tmSource: 'schedule', __tmScheduleId: original.id, __tmTaskId: original.taskId },
    };
    await context.handler({
        event, oldEvent: { start, end, allDay }, view: { type: 'dayGridMonth' },
        revert() { reverts += 1; event.start = start; event.end = end; },
    });
    assert.equal(stored.length, 1, 'moving an existing schedule must never append another schedule');
    assert.equal(stored[0].id, original.id, 'the schedule ID must survive a move');
    if (mode === 'save-fails') {
        assert.deepEqual(stored[0], original);
        assert.equal(saves, 0);
        assert.equal(updates, 0, 'a failed schedule save must not update task dates');
        assert.equal(reverts, 1);
        assert.equal(refreshed, 0);
        assert.deepEqual(notices.map(([type]) => type), ['error']);
    } else {
        assert.equal(saves, 1);
        assert.equal(updates, dateMode === 'manual' ? 1 : 0, 'rollup task dates must never follow schedule bounds');
        assert.equal(stored[0].start, event.start.toISOString());
        assert.equal(dateKey(new Date(stored[0].start)), dateKey(date(scheduleDay)));
        assert.equal(stored[0].allDay, allDay);
        assert.equal(reverts, 0, 'a failed task sync must not revert the already saved schedule');
        assert.equal(refreshed, 1);
        if (dateMode !== 'manual') {
            assert.equal(pending.size, 0, 'rollup tasks must not receive optimistic date patches');
            assert.deepEqual(notices, [['success', '✅ 已更新日程']], 'saving the schedule must not report a blocked date write');
        } else if (mode === 'follow-fails') {
            assert.equal(updateOptions.showErrorHint, false, 'the follow-up owner must suppress duplicate task errors');
            assert.equal(pending.size, 0, 'failed task dates must not remain in the optimistic overlay');
            assert.deepEqual(notices, [['warning', '⚠ 日程已保存，但任务日期同步失败']]);
        } else {
            assert.deepEqual(notices, [['success', '✅ 已更新日程']]);
        }
    }
}

async function verifyRollupUpdaterGuard() {
    const root = path.resolve(__dirname, '..');
    const support = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/48-render-calendar-support-runtime.js'), 'utf8');
    const schema = fs.readFileSync(path.join(root, 'src/task-horizon/main/09-task-field-schema.js'), 'utf8');
    const core = support.slice(support.indexOf('    window.tmUpdateTaskDates = async function('), support.indexOf('    const __tmUpdateTaskDatesCore'));
    assert.ok(core.includes('日期由子任务汇总'));
    const task = { id: 'parent', dateMode: 'rollup', startDate: '2026-10-20', completionTime: '2026-10-25' };
    const context = vm.createContext({ window: {}, __tmGetCalendarFlatTaskByIdSync: () => task,
        __tmResolveTaskIdFromAnyBlockId: async () => task.id });
    vm.runInContext(schema.match(/globalThis\.__tmIsTaskDateRollup =[^;]+;/)[0] + '\n' + core, context);
    for (const completionTime of ['2026-10-01', '2026-10-22', '2026-11-01']) {
        const result = await context.window.tmUpdateTaskDates('parent', { completionTime }, {
            source: 'calendar-schedule-dates-follow', requireTaskIdentity: true,
        });
        assert.equal(result.skipped, true, 'automatic follow must skip rollup dates even when caches missed the mode');
        assert.equal(result.reason, 'date-rollup');
        assert.equal(task.startDate, '2026-10-20');
        assert.equal(task.completionTime, '2026-10-25');
    }
    await assert.rejects(context.window.tmUpdateTaskDates('parent', { completionTime: '2026-11-01' }, {
        source: 'calendar-taskdate-event-change',
    }), /日期由子任务汇总/, 'direct edits must retain the protected-date error');
}

(async () => {
    for (const handler of handlers) {
        for (const originDay of [9, 10]) {
            for (const allDay of [false, true]) {
                for (const mode of ['success', 'follow-fails', 'save-fails']) await verify(handler, originDay, allDay, mode);
            }
        }
    }
    for (const handler of handlers) {
        for (const allDay of [false, true]) {
            for (const dateMode of ['rollup', 'alias', 'legacy']) {
                for (const scheduleDay of [7, 10, 13]) await verify(handler, 9, allDay, 'follow-fails', dateMode, scheduleDay);
            }
        }
    }
    await verifyRollupUpdaterGuard();
    console.log('calendar schedule drag/date-follow tests passed (120 cases and protected updater checks)');
})().catch((error) => { console.error(error); process.exitCode = 1; });
