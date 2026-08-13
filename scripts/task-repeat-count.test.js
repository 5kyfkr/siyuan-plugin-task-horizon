'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const modelSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '50-task-model-and-repeat-utils.js'),
    'utf8',
);
const runtimeSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '54-recurring-task-runtime.js'),
    'utf8',
);
const dialogSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', '30-dialogs-and-ui-foundation.js'),
    'utf8',
);
const detailSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '52-task-detail-runtime.js'),
    'utf8',
);

const start = modelSource.indexOf('function __tmParseTaskRepeatJson');
const end = modelSource.indexOf('function __tmGetTaskRepeatWeekdayLabel', start);
assert.ok(start >= 0 && end > start, 'task repeat pure helper block must remain extractable');

const normalizeDateOnly = (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const pad = (number) => String(number).padStart(2, '0');
        return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    }
    const match = String(value || '').match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : '';
};

const context = vm.createContext({ Date, Intl, Math, Number, String, JSON, __tmNormalizeDateOnly: normalizeDateOnly });
vm.runInContext(`${modelSource.slice(start, end)}\nthis.__test = { __tmNormalizeTaskRepeatRule, __tmNormalizeTaskRepeatState, __tmNormalizeTaskRepeatHistory, __tmBuildTaskRepeatAdvancePatch, __tmGetTaskRepeatSummary, __tmGetTaskRepeatCompletedCount, __tmGetTaskRepeatProgressText, __tmResolveTaskRepeatHistoryOccurrenceNumber };`, context);

const { __tmNormalizeTaskRepeatRule: normalizeRule, __tmNormalizeTaskRepeatState: normalizeState, __tmNormalizeTaskRepeatHistory: normalizeHistory, __tmBuildTaskRepeatAdvancePatch: buildPatch, __tmGetTaskRepeatSummary: getSummary, __tmGetTaskRepeatCompletedCount: getCompletedCount, __tmGetTaskRepeatProgressText: getProgressText, __tmResolveTaskRepeatHistoryOccurrenceNumber: getHistoryNumber } = context.__test;

const countRule = normalizeRule({ enabled: true, trigger: 'due', type: 'daily', every: 1, until: '2026-12-31', maxOccurrences: 500, anchorDate: '2026-07-18' });
assert.equal(countRule.maxOccurrences, 200, 'count limit must clamp to 200');
assert.equal(countRule.until, '', 'count mode must take precedence over a stale date limit');
assert.equal(normalizeRule({ enabled: true, type: 'daily', maxOccurrences: 0 }).maxOccurrences, 0, 'zero must mean unlimited');
assert.equal(normalizeState(null).occurrenceCount, 1, 'existing tasks must default to the first occurrence');

const rule = normalizeRule({ enabled: true, trigger: 'complete', type: 'daily', every: 1, maxOccurrences: 3, anchorDate: '2026-07-18' });
const firstTask = { startDate: '2026-07-18', completionTime: '2026-07-18', repeatState: { occurrenceCount: 1 } };
const second = buildPatch(firstTask, rule, { advancedAt: '2026-07-18T10:00:00.000Z' });
assert.equal(second.startDate, '2026-07-19');
assert.equal(second.repeatState.occurrenceCount, 2);
const third = buildPatch({ ...firstTask, ...second }, rule, { advancedAt: '2026-07-19T10:00:00.000Z' });
assert.equal(third.startDate, '2026-07-20');
assert.equal(third.repeatState.occurrenceCount, 3);
assert.equal(buildPatch({ ...firstTask, ...third }, rule), null, 'the series must not generate occurrence N+1');
assert.match(getSummary(rule), /共 3 次/, 'summary must expose the count limit');
assert.equal(getCompletedCount({ ...firstTask, repeatRule: rule, done: false }), 0);
assert.equal(getProgressText({ ...firstTask, repeatRule: rule, done: false }), '已完成 0/3');
assert.equal(getCompletedCount({ ...firstTask, repeatRule: rule, done: true }), 1);
assert.equal(getCompletedCount({ ...firstTask, ...second, repeatRule: rule, done: false }), 1);
const normalizedHistory = normalizeHistory([{ completedAt: '2026-07-18T10:00:00.000Z', occurrenceNumber: 1, totalOccurrences: 3 }]);
assert.equal(normalizedHistory[0].occurrenceNumber, 1);
assert.equal(normalizedHistory[0].totalOccurrences, 3);
assert.equal(getHistoryNumber({ ...firstTask, ...second, repeatRule: rule, done: false }, normalizedHistory[0], 0), 1);

const dateRule = normalizeRule({ enabled: true, type: 'daily', every: 1, until: '2026-07-19', anchorDate: '2026-07-18' });
const datePatch = buildPatch(firstTask, dateRule);
assert.equal(datePatch.startDate, '2026-07-19', 'date-based ending must remain unchanged');
assert.equal(buildPatch({ ...firstTask, ...datePatch }, dateRule), null, 'date-based ending must still stop beyond the end date');

const legacyWeekly = normalizeRule({ enabled: true, type: 'weekly', every: 1, anchorDate: '2026-07-18' });
assert.deepEqual(Array.from(legacyWeekly.weekdays), [], 'weekly rules without selected weekdays must preserve the empty selection');
assert.equal(buildPatch({ startDate: '2026-07-18', completionTime: '2026-07-18' }, legacyWeekly).completionTime, '2026-07-25');
const emptyAlternateWeekly = normalizeRule({ enabled: true, type: 'weekly', every: 2, weekdays: [], anchorDate: '2026-07-18' });
assert.equal(buildPatch({ completionTime: '2026-07-18' }, emptyAlternateWeekly).completionTime, '2026-08-01', 'empty weekday selection must follow the due date every N weeks');

const multiWeekly = normalizeRule({
    enabled: true,
    type: 'weekly',
    every: 1,
    weekdays: [5, 1, 3, 3],
    anchorDate: '2026-07-20',
});
assert.deepEqual(Array.from(multiWeekly.weekdays), [1, 3, 5], 'weekly weekdays must be sorted and deduplicated');
const weeklyWednesday = buildPatch({ startDate: '2026-07-20', completionTime: '2026-07-20' }, multiWeekly);
assert.equal(weeklyWednesday.completionTime, '2026-07-22', 'the next selected day in the active week must be used');
const weeklyFriday = buildPatch({ ...weeklyWednesday }, multiWeekly);
assert.equal(weeklyFriday.completionTime, '2026-07-24');
const weeklyNextMonday = buildPatch({ ...weeklyFriday }, multiWeekly);
assert.equal(weeklyNextMonday.completionTime, '2026-07-27', 'the next active week must restart at its first selected day');
assert.match(getSummary(multiWeekly), /周一、周三、周五/, 'weekly summary must list selected weekdays');

const alternateWeeks = normalizeRule({
    enabled: true,
    type: 'weekly',
    every: 2,
    weekdays: [1, 3],
    anchorDate: '2026-07-20',
});
assert.equal(
    buildPatch({ startDate: '2026-07-22', completionTime: '2026-07-22' }, alternateWeeks).completionTime,
    '2026-08-03',
    'every-N-week rules must advance by Monday-based active week buckets',
);

const rangedWeekly = normalizeRule({
    enabled: true,
    type: 'weekly',
    every: 1,
    weekdays: [3, 5],
    anchorDate: '2026-07-22',
});
const rangedPatch = buildPatch({ startDate: '2026-07-20', completionTime: '2026-07-22' }, rangedWeekly);
assert.equal(rangedPatch.startDate, '2026-07-22');
assert.equal(rangedPatch.completionTime, '2026-07-24', 'task date ranges must move together without changing their span');

assert.match(runtimeSource, /occurrenceCount:\s*Math\.max\(1, currentState\.occurrenceCount - 1\)/, 'latest-history rollback must decrement the occurrence count');
assert.match(runtimeSource, /结束次数不能小于当前第/, 'lowering a live count below progress must be rejected');
assert.match(runtimeSource, /occurrenceNumber:\s*currentRepeatState\.occurrenceCount/, 'history records must persist their occurrence number');
assert.match(runtimeSource, /totalOccurrences:\s*repeatRule\.maxOccurrences/, 'history records must persist the configured total');
assert.match(runtimeSource, /const occurrenceReset =[\s\S]*__tmBuildTaskTomatoBaselinePatch\(task\)/, 'resetting a recurring series must reset its Tomato occurrence baseline');
assert.ok(runtimeSource.indexOf('__tmResolveTaskIdFromAnyBlockId(requestedTaskId)') < runtimeSource.indexOf('__tmRecurringAdvanceInFlightIds.has(advanceTaskId)'), 'recurring advancement must canonicalize aliases before taking its lock');
assert.match(modelSource, /循环记录\$\{progressText\}/, 'recurring record badges must show their occurrence number');
assert.match(dialogSource, /data-tm-repeat-field="maxOccurrences"[^>]*max="200"/, 'repeat dialog must cap the count input at 200');
assert.match(dialogSource, /const currentTriggerType = currentRule\.enabled && currentRule\.type !== 'none'[\s\S]*?: 'due';/, 'an unset repeat rule must default to due-triggered recurrence');
assert.match(dialogSource, /<option value="due"[\s\S]*?<option value="complete"[\s\S]*?<option value="none"/, 'the non-recurring option must remain last');
assert.match(dialogSource, /\[\[1, '一'\], \[2, '二'\], \[3, '三'\], \[4, '四'\], \[5, '五'\], \[6, '六'\], \[0, '日'\]\]/, 'repeat dialog must render Monday-first weekday controls');
assert.doesNotMatch(dialogSource, /weekdays\.length <= 1/, 'repeat dialog must allow clearing every weekday');
assert.match(detailSource, /data-tm-time-hub-repeat-end-mode="never"/, 'time hub must edit the never-ending mode directly');
assert.match(detailSource, /data-tm-time-hub-repeat-end-mode="date"/, 'time hub must edit the date-ending mode directly');
assert.match(detailSource, /data-tm-time-hub-repeat-end-mode="count"/, 'time hub must edit the count-ending mode directly');
assert.doesNotMatch(detailSource, /在循环设置中选择永不结束/, 'time hub must not show the redundant explanatory card');
assert.match(detailSource, /__tmGetTaskRepeatProgressText\(repeatTask, rule\)/, 'count-based ending cards must show completed/total progress');

(async () => {
    const wrapperStart = runtimeSource.indexOf('async function __tmAdvanceRecurringTaskAfterCompletion(');
    const wrapperEnd = runtimeSource.indexOf('\n    async function __tmAdvanceRecurringTaskAfterCompletionInternal', wrapperStart);
    assert.ok(wrapperStart >= 0 && wrapperEnd > wrapperStart, 'recurring advancement lock wrapper must remain extractable');
    let internalCalls = 0;
    let releaseInternal = null;
    const internalGate = new Promise((resolve) => { releaseInternal = resolve; });
    const lockContext = vm.createContext({
        String,
        Set,
        __tmRecurringAdvanceInFlightIds: new Set(),
        __tmResolveTaskIdFromAnyBlockId: async () => 'task-1',
        __tmResolveTaskForRepeat: async () => ({ id: 'task-1' }),
        __tmAdvanceRecurringTaskAfterCompletionInternal: async () => {
            internalCalls += 1;
            await internalGate;
            return true;
        },
    });
    vm.runInContext(`${runtimeSource.slice(wrapperStart, wrapperEnd)}\nthis.advance = __tmAdvanceRecurringTaskAfterCompletion;`, lockContext);
    const firstAdvance = lockContext.advance('alias-a');
    const secondAdvance = lockContext.advance('alias-b');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(internalCalls, 1, 'aliases for one task must not advance the same occurrence twice');
    releaseInternal();
    const results = await Promise.all([firstAdvance, secondAdvance]);
    assert.equal(results.filter(Boolean).length, 1);
    console.log('task repeat count tests passed');
})().catch((error) => {
    process.nextTick(() => { throw error; });
});
