'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('./i18n-vm-fixture');

const source = fs.readFileSync(
    path.resolve(__dirname, '..', 'src', 'task-horizon', 'main', 'task-runtime', '54-recurring-task-runtime.js'),
    'utf8',
);
const start = source.indexOf('function __tmPlanFutureRepeatDates');
const end = source.indexOf('\n    try {\n        const previousBridge', start);
assert.ok(start >= 0 && end > start, 'follow draft bridge helper must remain extractable');

let task = {
    id: 'task-1',
    content: 'Canonical task',
    startDate: '2026-07-01',
    completionTime: '2026-07-18',
    repeatRule: { enabled: true, type: 'daily', every: 1 },
    repeatState: { occurrenceCount: 2 },
};
const writes = [];
const context = vm.createContext({
    JSON,
    Object,
    String,
    __tmResolveTaskForRepeat: async () => ({ ...task }),
    __tmNormalizeDateOnly: (value) => String(value || '').slice(0, 10),
    __tmBuildTaskRepeatRuleMetaPatch: (candidate, repeatRule) => {
        const enabled = !!repeatRule?.enabled && repeatRule?.type !== 'none';
        return {
            repeatRule: enabled ? repeatRule : { enabled: false, type: 'none' },
            repeatState: enabled
                ? candidate.repeatState
                : { ...candidate.repeatState, occurrenceCount: 1, lastInstanceDue: '' },
        };
    },
    __tmNormalizeTaskRepeatRule: (value) => value,
    __tmNormalizeTaskRepeatState: (value) => value,
    __tmBuildUndoLabelFromMetaPatch: () => '',
    __tmApplyTaskMetaPatchWithUndo: async (taskId, patch, options) => {
        writes.push({ taskId, patch, options });
        return true;
    },
    __tmGetTaskAttrHostId: () => 'host-1',
    window: {},
});
vm.runInContext(`${source.slice(0, source.indexOf('    async function __tmResolveTaskForRepeat'))}
${source.slice(start, end)}
this.applyFollowDraft = __tmApplyFollowReminderDraft;
this.clearFollowDraft = __tmClearFollowReminderDraft;
this.preview = __tmPreviewFollowReminderDateChange;`, context);

(async () => {
    const unchanged = await context.applyFollowDraft({
        taskId: 'task-1',
        completionTime: '2026-07-18',
        repeatRule: task.repeatRule,
    });
    assert.equal(unchanged.changed, false, 'saving notification-only edits must not rewrite task fields');
    assert.equal(writes.length, 0);

    const moved = await context.applyFollowDraft({
        taskId: 'task-1',
        completionTime: '2026-07-19',
        repeatRule: task.repeatRule,
    });
    assert.equal(moved.changed, true);
    assert.equal(writes.length, 1, 'the current task due date must be written once');
    assert.equal(writes[0].patch.completionTime, '2026-07-19');
    assert.equal(Object.hasOwn(writes[0].patch, 'repeatRule'), false, 'a reminder must not own the task repeat rule');
    assert.equal(Object.hasOwn(writes[0].patch, 'repeatState'), false, 'a reminder must not own the task repeat state');
    assert.equal(moved.attrHostId, 'host-1');
    const dateWrites = [];
    context.window.tmUpdateTaskDates = async (taskId, patch, options) => {
        dateWrites.push({ taskId, patch: { ...patch }, options: { ...options } });
        Object.assign(task, patch);
        return { ...patch };
    };
    for (const [repeatScope, completionTime] of [['one', '2026-07-20'], ['future', '2026-07-21']]) {
        const shifted = await context.applyFollowDraft({ taskId: 'task-1', completionTime, repeatScope });
        assert.equal(shifted.changed, true);
        assert.deepEqual(dateWrites.at(-1).patch, { completionTime });
        assert.equal(dateWrites.at(-1).options.repeatScope, repeatScope);
        assert.equal(shifted.startDate, '2026-07-01');
        assert.equal(shifted.completionTime, completionTime);
    }
    await assert.rejects(
        () => context.applyFollowDraft({ taskId: 'task-1', completionTime: '2026-06-30', repeatScope: 'one' }),
        /不能早于开始日期/,
    );
    assert.equal(dateWrites.length, 2, 'an invalid date must not move the start date');
    assert.equal(moved.taskTitle, 'Canonical task');

    await assert.rejects(
        () => context.applyFollowDraft({ taskId: 'task-1', completionTime: '', repeatRule: null }),
        /截止日不能为空/,
    );

    task.startDate = '2026-07-01';
    task.completionTime = '2026-07-18';
    const cleared = await context.clearFollowDraft({ taskId: 'task-1' });
    assert.equal(cleared.changed, false);
    assert.equal(cleared.completionTime, '2026-07-18');
    assert.equal(cleared.repeatRule.type, 'daily');
    assert.equal(writes.length, 1, 'deleting a reminder must not clear task-owned fields');

    const clearedAgain = await context.clearFollowDraft({ taskId: 'task-1' });
    assert.equal(clearedAgain.changed, false, 'repeated cleanup must be idempotent');
    assert.equal(writes.length, 1);

    const root = path.resolve(__dirname, '../src/task-horizon/main');
    const model = fs.readFileSync(path.join(root, 'task-runtime/50-task-model-and-repeat-utils.js'), 'utf8');
    const calendar = fs.readFileSync(path.join(root, 'render/48-render-calendar-support-runtime.js'), 'utf8');
    vm.runInContext(model.slice(model.indexOf('    function __tmNormalizeDateOnly('), model.indexOf('    function __tmIsRecurringInstanceTask(')), context);
    vm.runInContext(calendar.slice(calendar.indexOf('    window.tmUpdateTaskDates = async function'), calendar.indexOf('    const __tmUpdateTaskDatesCore')), context);
    context.__tmGetCalendarFlatTaskByIdSync = () => task;
    const changes = [];
    context.__tmApplyTaskMetaPatchWithUndo = async (_id, patch) => {
        changes.push(patch);
        Object.assign(task, patch);
        return true;
    };
    const clone = value => JSON.parse(JSON.stringify(value));
    const setup = (due, rule, override) => {
        task = { ...task, startDate: '2026-11-28', completionTime: due,
            repeatRule: { enabled: true, trigger: 'due', every: 1, ...rule },
            repeatState: { occurrenceCount: 3, occurrenceId: 'round-3', ...(override ? { planOverride: { completionTime: override } } : {}) } };
    };
    const weekly = { type: 'weekly', anchorDate: '2026-11-30', weekdays: [1, 3, 5] };
    const monthly = { type: 'monthly', anchorDate: '2026-12-05', monthDays: [5, 15, 25] };
    const previewDates = completionTime => context.preview({ taskId: task.id, completionTime, nextDates: true });
    async function reschedule(target, expectedDays, key, nextDue) {
        const baselineCount = changes.length;
        const preview = await previewDates(target);
        assert.equal(preview?.nextFuture?.kind, 'date', 'preview the next date for the edited rule');
        assert.equal(preview.nextFuture.date, nextDue);
        assert.equal(changes.length, baselineCount, 'preview is read only');
        const result = await context.applyFollowDraft({ taskId: task.id, completionTime: target,
            repeatScope: 'future', repeatDateBaseline: preview.baseline });
        assert.equal(changes.length, baselineCount + 1, 'save the due date, repeat state and rule together');
        assert.equal(Object.hasOwn(changes.at(-1), 'startDate'), false);
        assert.equal(result.startDate, '2026-11-28');
        assert.equal(result.completionTime, target);
        assert.deepEqual(clone(result.repeatRule[key]), expectedDays);
        assert.equal(result.repeatState.planOverride, undefined);
        assert.equal(result.repeatState.occurrenceCount, 3);
        if (nextDue) assert.equal(context.__tmBuildTaskRepeatAdvancePatch(task, result.repeatRule).completionTime, nextDue);
    }
    setup('2026-11-30', weekly);
    const legacyPreview = await context.preview({ taskId: task.id, completionTime: '2026-12-01' });
    assert.equal(legacyPreview.before, context.__tmGetTaskRepeatSummary(task.repeatRule));
    assert.equal(legacyPreview.baseline, (await previewDates('2026-12-01')).baseline);
    await reschedule('2026-12-01', [2, 3, 5], 'weekdays', '2026-12-02');
    setup('2026-12-02', weekly);
    await reschedule('2026-12-04', [1, 5], 'weekdays', '2026-12-07');
    setup('2026-12-01', weekly, '2026-11-30');
    await reschedule('2026-12-03', [3, 4, 5], 'weekdays', '2026-12-04');
    setup('2026-11-30', { ...weekly, every: 2 });
    await reschedule('2026-12-08', [2, 3, 5], 'weekdays', '2026-12-15');
    assert.equal(task.repeatRule.anchorDate, weekly.anchorDate);
    setup('2026-12-15', monthly);
    await reschedule('2026-12-18', [5, 18, 25], 'monthDays', '2026-12-25');
    setup('2026-12-15', monthly);
    await reschedule('2026-12-25', [5, 25], 'monthDays', '2027-01-05');
    setup('2026-12-15', { ...monthly, every: 2 });
    await reschedule('2027-01-18', [5, 18, 25], 'monthDays', '2027-02-05');
    assert.equal(task.repeatRule.anchorDate, monthly.anchorDate);
    setup('2026-12-15', { ...monthly, monthDays: [15, -1] });
    await reschedule('2026-12-31', [-1], 'monthDays', '2027-01-31');
    setup('2026-11-30', { type: 'daily', every: 7, anchorDate: '2026-11-30' });
    const datePreview = await previewDates('2026-12-02');
    assert.deepEqual(clone(datePreview.nextOne), { kind: 'date', date: '2026-12-07' });
    assert.deepEqual(clone(datePreview.nextFuture), { kind: 'date', date: '2026-12-09' });
    await context.applyFollowDraft({ taskId: task.id, completionTime: '2026-12-02', repeatScope: 'one' });
    assert.equal(context.__tmBuildTaskRepeatAdvancePatch(task, task.repeatRule).completionTime, datePreview.nextOne.date);
    setup('2026-11-30', { type: 'daily', every: 7, maxOccurrences: 3, anchorDate: '2026-11-30' });
    const endPreview = await previewDates('2026-12-02');
    assert.deepEqual(clone(endPreview.nextOne), { kind: 'none' });
    assert.deepEqual(clone(endPreview.nextFuture), { kind: 'none' });
    setup('2026-11-30', { type: 'daily', trigger: 'complete', anchorDate: '2026-11-30' });
    const completionPreview = await previewDates('2026-12-20');
    assert.deepEqual(clone(completionPreview.nextOne), { kind: 'completion' });
    assert.deepEqual(clone(completionPreview.nextFuture), { kind: 'completion' });
    setup('2026-11-30', { type: 'fsrs', trigger: 'complete', anchorDate: '2026-11-30' });
    const reviewPreview = await previewDates('2026-12-20');
    assert.deepEqual(clone(reviewPreview.nextOne), { kind: 'review' });
    assert.deepEqual(clone(reviewPreview.nextFuture), { kind: 'review' });
    setup('2026-11-30', { ...monthly, anchorDate: '2026-11-05', monthDays: [30, -1] });
    const ambiguousPreview = await previewDates('2026-12-02');
    assert.equal(ambiguousPreview.nextFuture, null, 'a date matching both the 30th and last day is ambiguous');
    assert.deepEqual(clone(ambiguousPreview.nextOne), { kind: 'date', date: '2026-12-30' });
    setup('2026-11-30', weekly);
    const completionTime = '2026-12-01';
    const preview = await previewDates(completionTime);
    task.completionTime = completionTime;
    task.repeatState.planOverride = { completionTime: '2026-11-30' };
    const count = changes.length;
    await assert.rejects(context.applyFollowDraft({ taskId: task.id, completionTime, repeatScope: 'future', repeatDateBaseline: preview.baseline }), /任务已变化/);
    assert.equal(changes.length, count, 'a stale preview must not replace a different occurrence');

    console.log('reminder follow draft tests passed');
})().catch((error) => {
    process.nextTick(() => { throw error; });
});
