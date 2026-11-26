'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const kernel = fs.readFileSync(path.join(root, 'kernel.js'), 'utf8');
const taskModel = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js'), 'utf8');

function sliceFunction(source, startNeedle, endNeedle) {
    const start = source.indexOf(startNeedle);
    const end = source.indexOf(endNeedle, start + startNeedle.length);
    assert.ok(start >= 0 && end > start, `missing source range: ${startNeedle}`);
    return source.slice(start, end);
}

const scheduleContext = vm.createContext({ text: (value) => String(value == null ? '' : value).trim() });
vm.runInContext(sliceFunction(kernel, 'function getScheduleDurationTaskID(', 'function formatScheduleDurationValue('), scheduleContext);
vm.runInContext(`this.collect = collectScheduleDurationIntervals;`, scheduleContext);

const schedules = [
    { id: 'safe-a', taskId: 'task-1', start: '2026-01-01T09:00:00Z', end: '2026-01-01T10:00:00Z', durationExplicit: true },
    { id: 'safe-b', taskId: 'task-1', start: '2026-01-01T09:30:00Z', end: '2026-01-01T10:30:00Z', durationExplicit: true },
    { id: 'ambiguous', taskId: 'task-1', start: '2026-01-01T10:00:00Z', end: '2026-01-01T11:00:00Z' },
    { id: 'ambiguous-overlap', taskId: 'task-1', start: '2026-01-01T09:00:00Z', end: '2026-01-01T10:00:00Z' },
    { id: 'placeholder', taskId: 'task-1', start: '2026-01-01T11:00:00Z', end: '2026-01-01T12:00:00Z', durationExplicit: false },
    { id: 'all-day', taskId: 'task-1', start: '2026-01-02T00:00:00Z', end: '2026-01-03T00:00:00Z', allDay: true, durationExplicit: true },
    { id: 'series', taskId: 'task-1', start: '2026-01-03T09:00:00Z', end: '2026-01-03T10:00:00Z', repeatRule: { enabled: true, type: 'weekly' }, durationExplicit: true },
    { id: 'detached', taskId: 'task-1', start: '2026-01-04T09:00:00Z', end: '2026-01-04T10:00:00Z', taskDateRecurringException: true, durationExplicit: true },
    { id: 'virtual', taskId: 'repeatinst:task-1', start: '2026-01-05T09:00:00Z', end: '2026-01-05T10:00:00Z', durationExplicit: true },
    { id: 'unlinked', blockId: 'task-1', start: '2026-01-06T09:00:00Z', end: '2026-01-06T10:00:00Z', durationExplicit: true },
];
const totals = scheduleContext.collect(schedules);
assert.equal(totals.get('task-1'), 180, 'all linked timed one-off schedules count, including placeholder and legacy durations; overlaps count once');

async function runReconcileTests() {
    const reconcileContext = vm.createContext({
        text: (value) => String(value == null ? '' : value).trim(),
        stableJson: (value) => JSON.stringify(value),
        normalizeDurationUnit: (unit) => String(unit || '').toLowerCase() === 'minutes' ? 'minutes' : 'hours',
        parseDurationMinutes: (value, unit) => {
            const raw = String(value || '').trim();
            if (!raw) return null;
            if (/^\d+(?:\.\d+)?$/.test(raw)) return Number(raw) * (unit === 'minutes' ? 1 : 60);
            return null;
        },
        getSettings: async () => ({ durationFormat: 'hours' }),
        tasks: new Map(),
        taskDTO: async (id) => {
            const task = reconcileContext.tasks.get(id);
            if (!task) throw new Error('missing task');
            return { ...task };
        },
        applyTaskPatch: async (id, patch) => Object.assign(reconcileContext.tasks.get(id), patch),
    });
    const reconcileHelpers = [
        sliceFunction(kernel, 'function getScheduleDurationTaskID(', 'function collectScheduleDurationIntervals('),
        sliceFunction(kernel, 'function collectScheduleDurationIntervals(', 'function formatScheduleDurationValue('),
        sliceFunction(kernel, 'function formatScheduleDurationValue(', 'function indexScheduleDurationInputs('),
        sliceFunction(kernel, 'function indexScheduleDurationInputs(', 'async function reconcileScheduleTaskDurations('),
        sliceFunction(kernel, 'async function reconcileScheduleTaskDurations(', 'async function saveSchedules('),
    ].join('\n');
    vm.runInContext(reconcileHelpers + '\nthis.reconcile = reconcileScheduleTaskDurations;', reconcileContext);
    reconcileContext.tasks.set('placeholder-task', { id: 'placeholder-task', duration: '', durationSource: '', tomatoEstimateCount: 0, done: false });
    const placeholderCreate = await reconcileContext.reconcile([], [
        { id: 'placeholder-create', taskId: 'placeholder-task', start: '2026-01-01T09:00:00Z', end: '2026-01-01T09:30:00Z', durationExplicit: false },
    ]);
    assert.equal(placeholderCreate.updated, 1, 'a scheduled default placeholder seeds the expected duration');
    assert.equal(reconcileContext.tasks.get('placeholder-task').duration, '0.5');

    reconcileContext.tasks.set('tomato-task', { id: 'tomato-task', duration: '', durationSource: '', tomatoEstimateCount: 2, done: false });
    const tomatoCreate = await reconcileContext.reconcile([], [
        { id: 'tomato-create', taskId: 'tomato-task', start: '2026-01-01T09:00:00Z', end: '2026-01-01T10:00:00Z', durationExplicit: false },
    ]);
    assert.equal(tomatoCreate.updated, 0, 'schedule estimates never mix with existing pomodoro estimates');
    assert.equal(reconcileContext.tasks.get('tomato-task').duration, '');

    const previousSchedule = [{ id: 'resize-1', taskId: 'resize-task', start: '2026-01-01T09:00:00Z', end: '2026-01-01T10:00:00Z', durationExplicit: false }];
    const resizedSchedule = [{ ...previousSchedule[0], end: '2026-01-01T10:30:00Z', durationExplicit: true }];
    reconcileContext.tasks.set('resize-task', { id: 'resize-task', duration: '', durationSource: '', tomatoEstimateCount: 0, done: false });
    const firstResize = await reconcileContext.reconcile(previousSchedule, resizedSchedule);
    assert.equal(firstResize.updated, 1, 'resizing a legacy placeholder marks the new duration explicit and seeds an estimate');
    assert.equal(reconcileContext.tasks.get('resize-task').duration, '1.5');
    assert.equal(reconcileContext.tasks.get('resize-task').durationSource, 'schedule');
    const secondResize = await reconcileContext.reconcile(resizedSchedule, [{ ...resizedSchedule[0], end: '2026-01-01T11:00:00Z' }]);
    assert.equal(secondResize.updated, 1, 'resizing a schedule-derived estimate recalculates the expected duration');
    assert.equal(reconcileContext.tasks.get('resize-task').duration, '2');
    reconcileContext.tasks.set('manual-task', { id: 'manual-task', duration: '1', durationSource: '', tomatoEstimateCount: 0, done: false });
    const manualResize = await reconcileContext.reconcile(
        [{ id: 'manual-schedule', taskId: 'manual-task', start: '2026-01-01T09:00:00Z', end: '2026-01-01T10:00:00Z', durationExplicit: true }],
        [{ id: 'manual-schedule', taskId: 'manual-task', start: '2026-01-01T09:00:00Z', end: '2026-01-01T11:00:00Z', durationExplicit: true }],
    );
    assert.equal(manualResize.updated, 0, 'schedule resizing never overwrites a manually set estimate');
}
runReconcileTests().catch((error) => { console.error(error); process.exitCode = 1; });

const summaryContext = vm.createContext({
    SettingsStore: { data: { enableTomatoIntegration: true, tomatoSpentAttrMode: 'minutes' } },
    __tmGetTaskTomatoCount: (task) => String(task.actualCount ?? ''),
    __tmGetTaskTomatoEstimateCount: (task) => String(task.tomatoEstimateCount ?? ''),
    __tmNormalizeTomatoCountValue: (value) => String(value ?? ''),
    __tmGetTaskSpentDisplay: (task) => task.spent || (task.focus?.tomatoHours ? `${Number(task.focus.tomatoHours) * 60}m` : (task.focus?.tomatoMinutes ? `${task.focus.tomatoMinutes}m` : '')),
    __tmFormatDurationDisplayValue: (value) => String(value || ''),
    __tmParseDurationMinutes: (value) => {
        const raw = String(value || '').trim();
        if (/^\d+(?:\.\d+)?$/.test(raw)) return Number(raw) * 60;
        const match = /^(\d+(?:\.\d+)?)h$/.exec(raw);
        return match ? Number(match[1]) * 60 : null;
    },
    __tmGetTaskTomatoFocusValues: (task) => task.focus || { tomatoMinutes: 0, tomatoHours: 0 },
    __tmT: (key, values) => key === 'quickbar.pomodoro2' ? `POMODORO ${values.actualForPlan}/${values.estimate}` : key,
});
vm.runInContext(sliceFunction(taskModel, 'function __tmGetTaskDurationSource(', '    // Keep the shape'), summaryContext);
vm.runInContext('this.summary = __tmGetTaskTomatoSummaryText;', summaryContext);
assert.equal(summaryContext.summary({ duration: '1h', spent: '45m', focus: { tomatoMinutes: 45 } }), '45m/1h 75%');
assert.equal(summaryContext.summary({ duration: '1h', focus: { tomatoMinutes: 0 } }), '0/1h 0%');
assert.equal(summaryContext.summary({ tomatoEstimateCount: '3', actualCount: '1.5', spent: '45m', duration: '1h', focus: { tomatoMinutes: 45 } }), '45m/1h 75%', 'legacy mixed values use one progress ratio, matching duration-editor priority');
assert.equal(summaryContext.summary({ spent: '12m' }), '12m', 'tasks without an estimate do not show a percentage');
summaryContext.SettingsStore.data.tomatoSpentAttrMode = 'hours';
assert.equal(summaryContext.summary({ duration: '1h', focus: { tomatoHours: 0.5 } }), '30m/1h 50%');
summaryContext.SettingsStore.data.enableTomatoIntegration = false;
assert.equal(summaryContext.summary({ tomatoEstimateCount: '3', actualCount: '1.5' }), 'POMODORO 1.5/3', 'disabled focus integration hides both modes of progress percentage');

const calendarSource = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');
assert.doesNotMatch(calendarSource, /scheduleEstimateBackfill|previewScheduleEstimates/, 'one-off historical estimate backfill controls must be removed');
assert.doesNotMatch(kernel, /taskHorizon(?:Preview|Apply)ScheduleDurationBackfill/, 'one-off backfill RPC methods must be removed');
const taskServices = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
assert.match(taskServices, /durationTaskChanges[\s\S]*__tmApplyTaskFieldPatchToLocalMirrors[\s\S]*__tmRefreshTaskFieldsAcrossViews/, 'schedule-derived duration changes must sync local task mirrors before rendering like date-follow changes');
const createFromDrop = sliceFunction(calendarSource, 'async function addTaskScheduleFromCalendarDropPayload(', 'async function finalizeMainCalendarTouchDrop(');
assert.match(createFromDrop, /durationExplicit:\s*true/, 'a user drag that creates a timed task schedule must be eligible to seed its estimate');
const createFromTaskDateDrop = sliceFunction(calendarSource, 'async function createScheduleFromTaskDateDrop(', 'function reminderOccurrenceKey(');
assert.match(createFromTaskDateDrop, /durationExplicit:\s*true/, 'dragging a task date into a timed schedule must be eligible to seed its estimate');
const resizeSchedule = sliceFunction(calendarSource, 'async function persistScheduleEventTimeChange(', 'function getCalendarDurationUnit(');
assert.match(resizeSchedule, /plannedMinutes:\s*nextDurationMin/, 'resizing a schedule must keep its stored planned duration in sync');
assert.match(resizeSchedule, /durationExplicit:\s*prevItem\.durationExplicit === true \|\| durationChanged/, 'a user resize upgrades a legacy placeholder length to an explicit estimate source');

for (const file of [
    'src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js',
    'src/task-horizon/main/render/42-render-list-and-checklist-body.js',
    'src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js',
    'src/task-horizon/main/render/44-render-whiteboard-body.js',
]) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(source, /__tmGetTaskTomatoSummaryHtml\(/, `${file} must consume the shared focus formatter`);
}

console.log('schedule duration estimate tests passed');
