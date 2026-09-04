'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const calendar = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');

function segment(source, startNeedle, endNeedle) {
    const start = source.indexOf(startNeedle);
    const end = source.indexOf(endNeedle, start + startNeedle.length);
    assert.ok(start >= 0, `missing ${startNeedle}`);
    assert.ok(end > start, `missing boundary ${endNeedle}`);
    return source.slice(start, end);
}

function createDeferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
}

const prioritySource = segment(
    calendar,
    'async function applyFloatingMiniTaskPriority',
    'function clearFloatingMiniAutoFlipTimer',
);
const floatingDateSource = segment(
    calendar,
    'async function applyFloatingMiniCalendarDate',
    'async function finalizeFloatingMiniCalendarTouchDrop',
);
const allDayDateSource = segment(
    calendar,
    'async function maybeUpdateEmptyTaskDueDateFromAllDayDrop',
    'function parseTaskDropPayload',
);

function createContext() {
    const events = [];
    const context = {
        Date,
        Promise,
        window: {},
        state: {
            floatingMini: {
                dragTaskId: 'task-1',
                dragPayload: {},
                dragPriorityKey: '',
                priorityHoverKey: '',
            },
        },
        toast: (message, type) => events.push({ message, type }),
        normalizeFloatingMiniPriorityKey: (value) => String(value || '').trim() || 'none',
        getFloatingMiniPriorityLabel: (value) => value,
        hideFloatingMiniPriorityTooltip() {},
        hideFloatingMiniCalendar() {},
        formatDateKey: () => '2026-08-20',
        resolveTaskDropDateFields: () => ({ known: true, startDate: '', completionTime: '' }),
    };
    context.globalThis = context;
    return { context: vm.createContext(context), events };
}

async function verifyPrioritySettlement() {
    const { context, events } = createContext();
    const deferred = createDeferred();
    let projectedPriority = '';
    let options = null;
    context.window.tmSetTaskPriority = (_taskId, value, nextOptions) => {
        projectedPriority = value;
        options = nextOptions;
        return deferred.promise;
    };
    vm.runInContext(`${prioritySource}\nthis.applyPriority = applyFloatingMiniTaskPriority;`, context);
    const pending = context.applyPriority('task-1', 'high');
    assert.equal(projectedPriority, 'high', 'priority projection must start before kernel settlement');
    assert.equal(options.wait, true);
    assert.deepEqual(events, [], 'enqueue must not be announced as success');
    deferred.resolve(true);
    assert.equal(await pending, true);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'success');

    events.length = 0;
    const failed = createDeferred();
    context.window.tmSetTaskPriority = () => failed.promise;
    const failedPending = context.applyPriority('task-1', 'low');
    failed.reject(new Error('priority failed'));
    assert.equal(await failedPending, false);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'error');
}

async function verifyFloatingDateSettlement() {
    const { context, events } = createContext();
    const deferred = createDeferred();
    let projectedDate = '';
    let options = null;
    context.window.tmUpdateTaskDates = (_taskId, patch, nextOptions) => {
        projectedDate = patch.completionTime;
        options = nextOptions;
        return deferred.promise;
    };
    vm.runInContext(`${floatingDateSource}\nthis.applyDate = applyFloatingMiniCalendarDate;`, context);
    const pending = context.applyDate('task-1', '2026-08-20');
    assert.equal(projectedDate, '2026-08-20', 'date projection must start before kernel settlement');
    assert.equal(options.wait, true);
    assert.equal(options.renderOptimistic, true);
    assert.equal(options.showErrorHint, false);
    assert.deepEqual(events, []);
    deferred.resolve({ id: 'task-1' });
    assert.equal(await pending, true);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'success');

    events.length = 0;
    const failed = createDeferred();
    context.window.tmUpdateTaskDates = () => failed.promise;
    const failedPending = context.applyDate('task-1', '2026-08-21');
    failed.reject(new Error('date failed'));
    assert.equal(await failedPending, false);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'error');
}

async function verifyAllDayDateSettlement() {
    const { context, events } = createContext();
    const deferred = createDeferred();
    let options = null;
    context.window.tmUpdateTaskDates = (_taskId, _patch, nextOptions) => {
        options = nextOptions;
        return deferred.promise;
    };
    vm.runInContext(`${allDayDateSource}\nthis.applyAllDayDate = maybeUpdateEmptyTaskDueDateFromAllDayDrop;`, context);
    const pending = context.applyAllDayDate(
        { taskId: 'task-1' },
        new Date('2026-08-20T00:00:00+08:00'),
        true,
    );
    await flushMicrotasks();
    assert.equal(options.wait, true);
    assert.equal(options.renderOptimistic, true);
    assert.equal(options.showErrorHint, false);
    assert.deepEqual(events, []);
    deferred.resolve({ id: 'task-1' });
    assert.equal(await pending, true);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'success');

    events.length = 0;
    let existingDatePatch = null;
    context.window.tmUpdateTaskDates = (_taskId, patch) => {
        existingDatePatch = patch;
        return Promise.resolve({ id: 'task-1' });
    };
    const existingDateHandled = await context.applyAllDayDate(
        { taskId: 'task-1', dateFieldsKnown: true, startDate: '2026-08-01', completionTime: '2026-08-20' },
        new Date('2026-08-22T00:00:00+08:00'),
        true,
    );
    assert.equal(existingDateHandled, true, 'all-day drops must update deadlines for tasks that already have dates');
    assert.equal(existingDatePatch?.completionTime, '2026-08-20');
    assert.equal(Object.keys(existingDatePatch || {}).length, 1, 'all-day drops must not write a start date');

    events.length = 0;
    const failed = createDeferred();
    context.window.tmUpdateTaskDates = () => failed.promise;
    const failedPending = context.applyAllDayDate(
        { taskId: 'task-1' },
        new Date('2026-08-21T00:00:00+08:00'),
        true,
    );
    failed.reject(new Error('all-day failed'));
    assert.equal(await failedPending, true);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'error');
}

async function verifyMonthDropAlwaysUpdatesDeadline() {
    const { context, events } = createContext();
    let receivedPatch = null;
    let receivedOptions = null;
    context.formatDateKey = () => '2026-08-25';
    context.resolveTaskDropDateFields = () => ({
        known: true,
        startDate: '2026-08-01',
        completionTime: '2026-08-20',
    });
    context.window.tmUpdateTaskDates = (_taskId, patch, nextOptions) => {
        receivedPatch = patch;
        receivedOptions = nextOptions;
        return Promise.resolve({ id: 'task-1', completionTime: '2026-08-25' });
    };
    vm.runInContext(`${allDayDateSource}\nthis.applyMonthDate = maybeUpdateEmptyTaskDueDateFromAllDayDrop;`, context);
    const handled = await context.applyMonthDate(
        { taskId: 'task-1', dateFieldsKnown: true, startDate: '2026-08-01', completionTime: '2026-08-20' },
        new Date('2026-08-25T00:00:00+08:00'),
        false,
        { viewType: 'dayGridMonth' },
    );
    assert.equal(handled, true, 'month-cell drops must be handled as deadline updates');
    assert.equal(receivedPatch?.completionTime, '2026-08-25');
    assert.equal(Object.keys(receivedPatch || {}).length, 1, 'month-cell drops must not write a start date');
    assert.equal(receivedOptions.wait, true);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'success');
}

Promise.resolve()
    .then(verifyPrioritySettlement)
    .then(verifyFloatingDateSettlement)
    .then(verifyAllDayDateSettlement)
    .then(verifyMonthDropAlwaysUpdatesDeadline)
    .then(() => console.log('calendar mutation success acknowledgement contract tests passed'))
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
