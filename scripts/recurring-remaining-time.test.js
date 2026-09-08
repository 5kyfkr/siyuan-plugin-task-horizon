'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', 'src', 'task-horizon', 'main');
const model = fs.readFileSync(path.join(root, 'task-runtime/50-task-model-and-repeat-utils.js'), 'utf8');
const api = fs.readFileSync(path.join(root, '20-api-and-runtime-services.js'), 'utf8');
const remaining = fs.readFileSync(path.join(root, 'settings/64-export-runtime.js'), 'utf8');
const extractBetween = (source, startNeedle, endNeedle) => {
    const start = source.indexOf(startNeedle);
    const end = source.indexOf(endNeedle, start + startNeedle.length);
    assert.ok(start >= 0 && end > start, startNeedle);
    return source.slice(start, end);
};
const context = vm.createContext({
    Date,
    SettingsStore: { data: {} },
    __tmNormalizeDateOnly: (value) => String(value || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '',
    __tmParseTimeToTs: (value) => Date.parse(value),
    __tmNormalizeTaskCompleteAtValue: (value) => String(value || '').trim(),
    __tmNormalizeFsrsCardState: () => null,
    __tmNormalizeTaskTomatoAmount: (value) => Math.max(0, Number(value) || 0),
    __tmNormalizeTaskTomatoCount: (value) => Math.max(0, Math.floor(Number(value) || 0)),
    __tmIsTaskNativeDone: (task) => task.done === true,
    __tmIsDarkMode: () => false,
    __tmNormalizeHexColor: (value, fallback) => value || fallback,
    normalizeTaskFields: (task) => task,
});
vm.runInContext([
    extractBetween(model, 'function __tmParseTaskRepeatJson(', 'function __tmGetTaskRepeatWeekdayLabel('),
    extractBetween(model, 'function __tmIsRecurringInstanceTask(', 'function __tmRenderRecurringInstanceBadge('),
    extractBetween(model, 'function __tmResolveTaskCompletedAtRaw(', 'function __tmFormatTaskCompletedAtTime('),
    extractBetween(api, 'function __tmIsTaskDoneEffective(', 'function __tmNormalizeCheckboxStatusBindingValue('),
    extractBetween(remaining, 'function __tmGetTaskRemainingTimeInfo(', 'function __tmRenderTaskRemainingTimeInfoHtml('),
].join('\n'), context);

const nowTs = new Date(2026, 8, 8, 12, 0, 0).getTime();
const label = (task) => context.__tmGetTaskRemainingTimeInfo(task, { nowTs }).label;
const source = {
    id: 'daily', done: false, completionTime: '2026-09-12',
    repeatRule: { enabled: true, type: 'daily', anchorDate: '2026-08-01' },
    repeatState: { occurrenceCount: 5 },
};
for (const [completedAt, expected] of [
    ['2026-09-08T10:00:00+08:00', '提前3天'],
    ['2026-09-11T10:00:00+08:00', '完成'],
    ['2026-09-13T10:00:00+08:00', '延期2天'],
]) {
    const history = { completedAt, sourceStart: '2026-09-09', sourceDue: '2026-09-11' };
    const instance = context.__tmBuildRecurringInstanceTask(source, history);
    assert.equal(instance.completionTime, completedAt,
        'completed occurrence grouping must retain its actual completion date');
    assert.equal(label(instance), expected,
        'completed recurrence must compare against this occurrence due date, not its completion or series date');
    assert.equal(label({ done: true, taskCompleteAt: completedAt, completionTime: history.sourceDue }), expected,
        'ordinary completed tasks must retain their existing deadline comparison');
}
const noDeadline = context.__tmBuildRecurringInstanceTask(source, {
    completedAt: '2026-09-08T10:00:00+08:00', sourceStart: '2026-09-01', sourceDue: '',
});
assert.equal(label(noDeadline), '完成', 'missing historical deadlines must not borrow another occurrence date');

const completedAt = '2026-09-08T10:00:00+08:00';
const nextOccurrence = {
    ...source, done: true, taskCompleteAt: completedAt,
    repeatState: { occurrenceCount: 5, pendingNativeDoneReset: true, lastCompletedAt: completedAt },
};
assert.equal(label(nextOccurrence), '余4天', 'held native checkboxes must display the next unfinished countdown');
assert.equal(label({ ...nextOccurrence, done: false }), '余4天', 'native checkbox policy must not change the countdown');
assert.equal(label({ ...nextOccurrence, startDate: '2026-09-10' }), '后天→');
assert.equal(label({ ...nextOccurrence, completionTime: '2026-09-08' }), '今天');
assert.equal(label({ ...nextOccurrence, completionTime: '2026-09-07' }), '过期');
assert.equal(label({ ...nextOccurrence, completionTime: '' }), '待定');
assert.equal(label({ ...nextOccurrence, taskCompleteAt: '2026-09-09T10:00:00+08:00' }), '提前3天',
    'a different completion timestamp must not be mistaken for the held previous occurrence');
assert.equal(label(source), '余4天');
assert.equal(label({ done: false }), '待定');

console.log('recurring remaining time tests passed');
