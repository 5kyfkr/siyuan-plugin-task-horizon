'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'calendar-view.js'), 'utf8');
function extract(startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.ok(start >= 0 && end > start, `missing ${startMarker}`);
    return source.slice(start, end);
}

function harness() {
    const settings = { showSchedule: true, calendarsConfig: {}, scheduleColor: '#556677', scheduleFollowDocColor: false };
    const store = { data: { docGroups: [{ id: 'work', name: '工作' }, { id: 'other', name: '其他' }] }, save: async () => {} };
    Object.defineProperty(settings, 'calendarsConfig', {
        get: () => store.data.calendarCalendarsConfig || {},
        set: (value) => { store.data.calendarCalendarsConfig = value; },
    });
    const items = [];
    const refreshes = [];
    let preview = null;
    const context = vm.createContext({
        Date, Map, Set,
        Element: class {}, HTMLElement: class {},
        state: { settingsStore: store },
        wrap: {},
        getSettings: () => settings,
        renderSidebar: () => {},
        scheduleTaskPageRender: () => {},
        scheduleCalendarRefresh: (detail) => refreshes.push(detail),
        pickDefaultCalendarId: () => 'group:work',
        resolveCalendarDocColor: () => '#228844',
        getScheduleLinkedDocId: (item) => item?.docId || '',
        getScheduleLinkedBlockId: (item) => item?.blockId || '',
        getScheduleLinkedTaskId: (item) => item?.taskId || '',
        getCalendarTaskSnapshotById: () => null,
        isCalendarDocVisibleForEvent: () => true,
        shouldPreferDeviceNotificationBackend: () => false,
        isVirtualRecurringTaskScheduleItem: () => false,
        isCalendarTaskRecurringSnapshot: () => false,
        isTaskDateRecurringExceptionScheduleItem: () => false,
        isDetachedScheduleOccurrenceItem: () => false,
        isTaskDateRecurringExceptionDone: () => false,
        shouldHideCompletedAllDayCalendarEvent: () => false,
        getScheduleRepeatType: (item) => item.repeatType || 'none',
        getScheduleRepeatEvery: () => 1,
        getScheduleRepeatUntil: () => '',
        getScheduleRepeatMonthlyMode: () => 'date',
        getScheduleRepeatCalendarMode: () => 'solar',
        getScheduleRepeatRule: () => ({}),
        getScheduleCompletedOccurrenceSet: () => new Set(),
        isScheduleAllDayBottom: () => false,
        buildScheduleNotificationSchedulesView: () => ({}),
        collectScheduleOccurrencesInRange: (item) => [{ start: new Date(item.start), end: new Date(item.end) }],
        normalizeCalendarScheduleTitleText: (value, fallback) => value || fallback,
        joinCalendarClassName: (names) => names.join(' '),
        toMs: (value) => new Date(value).getTime(),
        safeISO: (value) => value.toISOString(),
        isAllDayRange: () => false,
        uuid: () => `schedule-${items.length}`,
        loadScheduleAll: async () => items,
        saveScheduleAll: async () => {},
        syncTaskDatesAfterScheduleMutation: async () => {},
        __tmSchedulePostMutationRefresh: () => {},
        closeModal: () => {},
        closePrototypeEventPopover: () => {},
        showPrototypeScheduleEditorCard: (event) => { preview = event; return true; },
    });
    vm.runInContext([
        extract('    function getCalendarTaskCompletionMode(', '    async function setCalendarTaskCompletionMode('),
        extract('    function hashColor(', '    function isCalendarDocEnabled('),
        extract('    async function addTaskScheduleCore(', '    async function upsertTaskScheduleTime('),
        extract('    function buildEventsFromSchedule(', '    function isMonthScheduleEventRange('),
        extract('    function refetchAllCalendars(', '    function scheduleReminderFiredStorageKey('),
        extract('        const applySidebarColor =', '        const getSidebarColorPickerTitle ='),
        extract('        const openPrototypeNewScheduleCard =', '        state.openPrototypeNewScheduleCard ='),
        'globalThis.openNew = openPrototypeNewScheduleCard;',
        'globalThis.applyColor = applySidebarColor; globalThis.resetColor = resetSidebarColor;',
    ].join('\n'), context);
    const render = (item) => context.buildEventsFromSchedule([item], new Date('2026-09-23'), new Date('2026-09-24'), settings)[0];
    const setGroupColor = (color) => { settings.calendarsConfig = color ? { 'group:work': { color } } : {}; };
    return { context, settings, items, render, setGroupColor, refreshes, preview: () => preview };
}

const base = {
    taskId: '20260923090000-task001', docId: '20260923090000-doc0001', calendarId: 'group:work',
    title: '任务日程', start: '2026-09-23T09:00:00Z', end: '2026-09-23T10:00:00Z',
};

(async () => {
    const h = harness();
    h.setGroupColor('#336699');
    const created = await h.context.addTaskScheduleCore({ ...base, preferCalendarColor: true });
    assert.equal(h.render(created).color, '#336699');
    h.setGroupColor('#aa6633');
    assert.equal(h.render(created).color, '#aa6633', 'an existing task schedule must follow a changed group color');
    h.setGroupColor('#663399');
    assert.equal(h.render(created).color, '#663399', 'successive changes must remain inherited');
    h.setGroupColor('');
    assert.equal(h.render(created).color, h.context.hashColor('work'), 'reset must return to the group default');
    assert.ok(!created.color, 'quick creation must not persist the inherited display color');
    await h.context.applyColor('calendar', 'group:work', '#778899');
    assert.equal(h.render(JSON.parse(JSON.stringify(created))).color, '#778899', 'saved schedules must inherit after reload');
    await h.context.resetColor('calendar', 'group:work');
    assert.equal(h.render(created).color, h.context.hashColor('work'));
    assert.deepEqual(h.refreshes.map(({ main, side, flushTaskPanel }) => ({ main, side, flushTaskPanel })), [
        { main: true, side: true, flushTaskPanel: false },
        { main: true, side: true, flushTaskPanel: false },
    ], 'sidebar apply/reset must refresh both calendar surfaces');

    const legacy = { ...base, id: 'legacy', color: '#336699', plannedMinutes: 60 };
    h.setGroupColor('#aa6633');
    for (const extra of [{}, { allDay: true }, { repeatType: 'weekly' }, { taskId: '', blockId: base.taskId }]) {
        const item = { ...legacy, ...extra };
        assert.equal(h.render(item).color, '#aa6633', 'legacy quick-created schedules must follow the current group');
        assert.equal(item.color, '#336699', 'rendering must not mutate stored schedules');
    }
    assert.equal(h.render({ ...legacy, calendarId: 'group:other' }).color, h.context.hashColor('other'));
    assert.equal(h.render({ ...base, id: 'manual', color: '#ee3344' }).color, '#ee3344', 'unmarked manual colors must retain compatibility');
    for (const marker of [{ colorMode: 'custom' }, { colorSource: 'custom' }, { colorExplicit: true }]) {
        assert.equal(h.render({ ...legacy, ...marker }).color, '#336699', 'explicit custom colors must survive group changes');
    }
    const manual = await h.context.addTaskScheduleCore({ ...base, color: '#aa6633', colorExplicit: true });
    h.setGroupColor('#112233');
    assert.equal(h.render(manual).color, '#aa6633', 'a manually chosen color equal to the former group color must stay custom');
    const custom = await h.context.addTaskScheduleCore({ ...base, color: '#ee3344' });
    assert.equal(h.render(custom).color, '#ee3344');

    h.settings.scheduleFollowDocColor = true;
    assert.equal(h.render(legacy).color, '#228844', 'legacy task schedules must follow the document when enabled');
    const docSchedule = await h.context.addTaskScheduleCore({ ...base, color: '#228844' });
    assert.ok(!docSchedule.color);
    h.context.resolveCalendarDocColor = () => '#7755aa';
    assert.equal(h.render(docSchedule).color, '#7755aa');
    assert.equal(h.render(manual).color, '#aa6633');

    const anchor = new h.context.Element();
    const open = (input) => {
        h.context.openNew({ ...base, start: new Date(base.start), end: new Date(base.end), ...input }, anchor);
        return h.preview();
    };
    assert.equal(open({ color: '#228844', colorExplicit: false }).extendedProps.__tmScheduleColorExplicit, false, 'new editor must preserve inherited color metadata');
    assert.equal(h.preview().color, '#7755aa', 'an inherited editor preview must resolve the current color');
    assert.equal(open({ color: '#7755aa', colorExplicit: true }).extendedProps.__tmScheduleCustomColor, '#7755aa');
    assert.equal(h.preview().extendedProps.__tmScheduleColorExplicit, true);
    console.log('calendar schedule color follow tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
