'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js'), 'utf8');

function extractBetween(startNeedle, endNeedle) {
    const start = source.indexOf(startNeedle);
    const end = source.indexOf(endNeedle, start + startNeedle.length);
    assert.ok(start >= 0, `missing ${startNeedle}`);
    assert.ok(end > start, `missing boundary ${endNeedle}`);
    return source.slice(start, end).trim();
}

const focusModel = extractBetween(
    'function __tmNormalizeTaskRepeatState(',
    'function __tmGetTaskRepeatCompletedCount(',
);
const context = vm.createContext({
    __tmParseTaskRepeatJson: (value) => {
        if (!value) return null;
        if (typeof value === 'string') {
            try { return JSON.parse(value); } catch (e) { return null; }
        }
        return typeof value === 'object' && !Array.isArray(value) ? value : null;
    },
    __tmNormalizeFsrsCardState: (value) => value || null,
    __tmNormalizeDateOnly: (value) => String(value || '').slice(0, 10),
    __tmNormalizeTaskRepeatMaxOccurrences: (value) => Math.max(0, Number(value) || 0),
    __tmNormalizeTaskRepeatRule: (value) => value && value.enabled && value.type !== 'none'
        ? value
        : { enabled: false, type: 'none' },
});
vm.runInContext(`${focusModel}\nthis.normalizeState = __tmNormalizeTaskRepeatState; this.normalizeHistory = __tmNormalizeTaskRepeatHistory; this.focus = __tmGetTaskTomatoFocusValues;`, context);

const state = context.normalizeState({
    occurrenceCount: 2,
    tomatoBaselineMinutes: '40.5',
    tomatoBaselineHours: '0.68',
    tomatoBaselineCount: '2',
});
assert.equal(state.tomatoBaselineMinutes, 40.5);
assert.equal(state.tomatoBaselineHours, 0.68);
assert.equal(state.tomatoBaselineCount, 2);
assert.equal(context.normalizeState(context.normalizeState({ occurrenceCount: 3 })).tomatoBaselineSet, false,
    'normalizing legacy state twice must not manufacture a zero baseline');

const current = context.focus({
    repeatRule: { enabled: true, type: 'daily' },
    repeatState: state,
    tomatoMinutes: '66.25',
    tomatoHours: '1.1',
    tomatoCount: '3',
});
assert.deepEqual({ ...current }, { tomatoMinutes: 25.75, tomatoHours: 0.42, tomatoCount: 1 });

const reset = context.focus({
    repeatRule: { enabled: true, type: 'daily' },
    repeatState: state,
    tomatoMinutes: '12',
    tomatoHours: '0.2',
    tomatoCount: '1',
});
assert.deepEqual({ ...reset }, { tomatoMinutes: 12, tomatoHours: 0.2, tomatoCount: 1 },
    'an externally reduced cumulative value must not produce a negative occurrence');

const legacy = context.normalizeHistory([
    { completedAt: '2026-08-03T10:00:00+08:00', tomatoMinutes: '80', tomatoHours: '1.33', tomatoCount: '4' },
    { completedAt: '2026-08-02T10:00:00+08:00', tomatoMinutes: '55', tomatoHours: '0.92', tomatoCount: '3' },
    { completedAt: '2026-08-01T10:00:00+08:00', tomatoMinutes: '30', tomatoHours: '0.5', tomatoCount: '1' },
]);
assert.equal(legacy[0].tomatoOccurrenceMinutes, '25');
assert.equal(legacy[0].tomatoOccurrenceCount, '1');
assert.equal(legacy[1].tomatoOccurrenceMinutes, '25');
assert.equal(legacy[1].tomatoOccurrenceCount, '2');
assert.equal(legacy[2].tomatoOccurrenceMinutes, '30', 'the oldest legacy item must retain its cumulative value');

const virtual = context.focus({
    id: 'repeatinst:task-1:20260803100000',
    isRecurringInstance: true,
    tomatoMinutes: legacy[0].tomatoMinutes,
    tomatoHours: legacy[0].tomatoHours,
    tomatoCount: legacy[0].tomatoCount,
    tomatoOccurrenceMinutes: legacy[0].tomatoOccurrenceMinutes,
    tomatoOccurrenceHours: legacy[0].tomatoOccurrenceHours,
    tomatoOccurrenceCount: legacy[0].tomatoOccurrenceCount,
});
assert.deepEqual({ ...virtual }, { tomatoMinutes: 25, tomatoHours: 0.41, tomatoCount: 1 });

const unlimited = context.normalizeHistory(Array.from({ length: 35 }, (_, index) => ({
    completedAt: `2026-07-${String((index % 28) + 1).padStart(2, '0')}T10:00:${String(index).padStart(2, '0')}+08:00`,
    tomatoMinutes: String(35 - index),
})));
assert.equal(unlimited.length, 35, 'recurring history must not be capped at 30 entries');

console.log('task recurring focus value tests passed');
