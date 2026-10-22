'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'calendar-view.js'), 'utf8').replace(/\r\n/g, '\n');

function readFunction(name) {
    const plainStart = source.indexOf(`    function ${name}(`);
    const start = plainStart >= 0 ? plainStart : source.indexOf(`    async function ${name}(`);
    assert.ok(start >= 0, name);
    return source.slice(start, source.indexOf('\n    }', start) + 6);
}

function readCallback(name, side) {
    let start = source.indexOf(`            ${name}: async (arg) => {`);
    if (!side) start = source.indexOf(`            ${name}: async (arg) => {`, start + 1);
    assert.ok(start >= 0, name);
    return `({${source.slice(start, source.indexOf('\n            },', start) + 15)}}).${name}`;
}

function readPointerHandler(type, side) {
    const target = side ? 'surface' : 'prototypeSurface';
    const marker = `bindPrototypeSurfacePointerHandler(${target}, '${type}', (event) => {`;
    const start = source.indexOf(marker) + marker.indexOf('(event) =>');
    const end = source.indexOf(side ? '\n                }, true);' : '\n            }, true);', start);
    assert.ok(start >= marker.length && end > start, marker);
    return source.slice(start, end) + '\n}';
}

class FakeElement {
    constructor(rect = { left: 0, right: 400, top: 100, bottom: 1000, height: 900 }) { this.rect = rect; }
    getBoundingClientRect() { return this.rect; }
    closest() { return null; }
}

async function verifySidebarPersistence() {
    for (const name of ['eventDrop', 'eventResize']) {
        const owner = {};
        const saved = [];
        const notices = [];
        let reverted = 0;
        const context = {
            cal: owner, state: { sideDay: { calendar: owner } },
            shouldCreateScheduleFromTaskDateDrop: () => false,
            persistTaskDateEventChange: async (arg, options) => { saved.push(options.calendar); return {}; },
            forgetPendingTaskDateEventPatch() {},
            toast: (message, level) => notices.push({ message, level }),
        };
        const handler = vm.runInNewContext(readCallback(name, true), context);
        await handler({ event: { allDay: true, extendedProps: { __tmSource: 'taskdate', __tmTaskId: 'task' } }, revert: () => reverted++ });
        assert.deepEqual(saved, [owner], `sidebar ${name} must save with its owning calendar`);
        assert.equal(reverted, 0);
        assert.equal(notices.some(notice => notice.level === 'error'), false);
    }
}

function verifyUnchangedDrop(side, sourceType, allDay, staleTimedPreview, dayDelta = 0, resize = false) {
    const start = new Date(2026, 9, 22, allDay ? 0 : 9);
    const end = new Date(2026, 9, 23, allDay ? 0 : 10);
    const eventApi = { id: 'event', start, end, allDay, extendedProps: { __tmSource: sourceType } };
    const canvas = new FakeElement();
    const eventEl = Object.assign(new FakeElement(), { closest: () => null });
    const surface = Object.assign(new FakeElement(), { querySelector: () => canvas });
    const drag = {
        id: 'event', pointerId: 1, started: true, moved: true, eventEl,
        originStart: start, originEnd: end,
        edge: resize ? 'end' : '', resizeEdge: resize ? 'end' : '',
        previewMode: staleTimedPreview ? 'timed' : '',
        previewStart: staleTimedPreview ? new Date(2026, 9, 22, 12) : null,
        previewEnd: staleTimedPreview ? new Date(2026, 9, 22, 13) : null,
    };
    const calls = { dispatch: [], pending: 0, restored: 0, finished: 0 };
    const context = {
        Date, HTMLElement: FakeElement, clearTimeout() {},
        state: { calendar: {}, sideDay: { calendar: {} } }, calendar: {}, cal: {},
        prototypeEventDrag: side ? null : drag,
        sidePrototypeEventDrag: side ? drag : null,
        surface, prototypeSurface: surface,
        getCalendarEventById: () => eventApi, getSidePrototypeEvent: () => eventApi,
        getCalendarView: () => ({ type: 'timeGridWeek' }),
        isRollupTaskDateDrag: vm.runInNewContext(`(${readFunction('isRollupTaskDateDrag')})`),
        getSettings: () => ({}),
        protoSafeDate: value => new Date(value), protoEventEnd: event => event.end,
        protoDayStart: value => { const date = new Date(value); date.setHours(0, 0, 0, 0); return date; },
        protoAddDays: (value, days) => { const date = new Date(value); date.setDate(date.getDate() + days); return date; },
        sidePrototypeDate: () => new Date(2026, 9, 22),
        resolveSharedPrototypeEventEnd: event => event.end,
        resolvePrototypeAllDayCellAtPoint: () => null,
        resolvePrototypeTimedDropAtPoint: () => null,
        resolveSidePrototypeTimedDropAtPoint: () => null,
        resolvePrototypeDayAtPoint: () => new Date(2026, 9, 22 + dayDelta),
        getPrototypeAllDayDragDates: () => ({ start, end }),
        prototypeTimelineMinutesAtPoint: () => 0,
        rememberPendingTaskDateEventPatch: () => { calls.pending++; },
        buildTaskDatePatchFromEvent: () => ({ taskId: 'task' }),
        restorePrototypeDragPreview: () => { calls.restored++; },
        restoreSidePrototypeDragPreview: () => { calls.restored++; },
        finishSidePrototypeDragScroll: () => { calls.finished++; },
        renderPrototypeSurface() {}, queuePrototypeSurfaceRender() {}, renderSidePrototype() {},
        clearPrototypeDragLayer() {},
        callCalendarAdapter: (...args) => { calls.dispatch.push(args); return true; },
        beginSidePrototypeCommittedDrag: () => null,
    };
    const handler = vm.runInNewContext(`(${readPointerHandler('pointerup', side)})`, context);
    handler({ pointerId: 1, pointerType: 'mouse', button: 0, clientX: 100, clientY: 40, preventDefault() {}, stopPropagation() {} });
    if (dayDelta) {
        assert.equal(calls.dispatch.length, 1, 'moving to another all-day date must still commit');
        assert.equal(calls.dispatch[0][3].getDate(), 23);
    } else {
        assert.equal(calls.dispatch.length, 0, `${side ? 'sidebar' : 'main'} ${sourceType} return to origin must not dispatch a mutation`);
        assert.equal(calls.pending, 0, 'unchanged drops must not create pending task patches');
        assert.equal(calls.restored, 1, 'unchanged drops must remove their preview');
        if (side) assert.equal(calls.finished, 1, 'unchanged sidebar drops must release their scroll snapshot');
    }
}

function verifyTimedHitGeometry() {
    const scroll = new FakeElement({ left: 0, right: 400, top: 100, bottom: 500 });
    const canvas = new FakeElement();
    const columns = ['2026-10-22', '2026-10-23'].map((key, index) => Object.assign(
        new FakeElement({ left: index * 200, right: (index + 1) * 200, top: -200, bottom: 1200, height: 1400 }), {
            getAttribute: () => key,
            closest: selector => selector === '.tm-proto-time-scroll' ? scroll : canvas,
        },
    ));
    const surface = Object.assign(new FakeElement(), { querySelectorAll: () => columns });
    const hitTest = vm.runInNewContext(`${readFunction('parseDateOnly')}\n(${readFunction('resolvePrototypeTimedDropHit')})`, {
        Date, HTMLElement: FakeElement,
        getSettings: () => ({}),
        prototypeTimelineMinutesAtPoint: () => 547,
    });
    const hit = hitTest(surface, 100, 300);
    assert.ok(hit, 'time geometry must work without elementFromPoint, including over preview layers');
    assert.equal(hit.start.getDate(), 22);
    assert.equal(hit.start.getHours(), 9);
    assert.equal(hit.start.getMinutes(), 0);
    assert.equal(hit.allDay, false);
    assert.equal(hitTest(surface, 200, 300).start.getDate(), 23, 'column boundaries belong to the next day');
    for (const point of [[100, 40], [100, 600], [500, 300], [NaN, 300]]) {
        assert.equal(hitTest(surface, ...point), null, 'clipped or out-of-grid coordinates must not become timed drops');
    }
}

async function verifyRollupScheduling() {
    const isRollup = vm.runInNewContext(`(${readFunction('isRollupTaskDateDrag')})`);
    const event = { id: 'parent', title: '在线监控铭牌ECN', editable: false, allDay: true,
        start: new Date(2026, 9, 20), end: new Date(2026, 9, 25),
        extendedProps: { __tmSource: 'taskdate', __tmTaskId: 'parent', __tmTaskDateRollup: true } };
    assert.equal(isRollup(event), true);
    for (const patch of [{ __tmSource: 'schedule' }, { __tmTaskDateRollup: false },
        { __tmTaskDateReadOnly: true }, { __tmCheckin: true }, { __tmTaskId: '' }]) {
        assert.equal(isRollup({ ...event, extendedProps: { ...event.extendedProps, ...patch } }), false,
            'the scheduling exception must not enable other protected event kinds');
    }
    const notices = [], scheduled = [];
    const context = vm.createContext({ Date, window: {},
        getSettings: () => ({}), clampNewScheduleDurationMin: () => 60,
        pickDefaultCalendarId: () => 'default', getCalendarDefs: () => [],
        getCalendarEventColor: () => '#5586a5',
        addTaskSchedule: async item => { scheduled.push(item); return item; },
        toast: (message, level) => notices.push(level),
    });
    vm.runInContext([readFunction('createScheduleFromTaskDateDrop'), readFunction('createScheduleFromRollupTaskDateDrop')].join('\n'), context);
    await context.createScheduleFromRollupTaskDateDrop(event, new Date(2026, 9, 22, 9), new Date(2026, 9, 22, 10));
    assert.equal(scheduled.length, 1);
    assert.equal(scheduled[0].taskId, 'parent');
    assert.equal(scheduled[0].allDay, false);
    assert.equal(scheduled[0].start.getHours(), 9);
    assert.equal(event.allDay, true);
    assert.equal(event.editable, false);
    assert.equal(event.start.getDate(), 20);
    assert.equal(event.end.getDate(), 25);
    assert.deepEqual(notices, ['success']);
}

async function main() {
    await verifySidebarPersistence();
    await verifyRollupScheduling();
    for (const side of [false, true]) {
        for (const sourceType of ['taskdate', 'schedule']) {
            for (const allDay of [true, false]) {
                verifyUnchangedDrop(side, sourceType, allDay, false);
            }
            verifyUnchangedDrop(side, sourceType, true, true);
            verifyUnchangedDrop(side, sourceType, true, false, 0, true);
        }
    }
    verifyUnchangedDrop(false, 'taskdate', true, false, 1);
    verifyTimedHitGeometry();
    console.log('calendar all-day drag: owning calendar, unchanged drops, stale previews and clipped time hit geometry passed');
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { readFunction, readCallback, readPointerHandler };
