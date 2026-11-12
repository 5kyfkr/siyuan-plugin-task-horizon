'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const model = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js'), 'utf8');
const between = (start, end) => {
    const from = model.indexOf(start);
    const to = model.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, `missing source boundaries: ${start}, ${end}`);
    return model.slice(from, to);
};
const context = vm.createContext({
    SettingsStore: { data: { durationFormat: 'minutes', tomatoSpentAttrMode: 'minutes' } },
    __tomatoTimer: { getDefaultDurationMinutes: () => 35 },
    __tmParseTaskRepeatJson: (value) => typeof value === 'string' ? JSON.parse(value || 'null') : value,
    __tmNormalizeFsrsCardState: (value) => value || null,
    __tmNormalizeDateOnly: (value) => String(value || '').slice(0, 10),
    __tmNormalizeTaskRepeatMaxOccurrences: (value) => Math.max(0, Number(value) || 0),
    __tmNormalizeTaskRepeatRule: (value) => value?.enabled ? value : { enabled: false, type: 'none' },
});
vm.runInContext(fs.readFileSync(path.join(root, 'src/task-horizon/main/06a-duration-utils.js'), 'utf8'), context);
vm.runInContext([
    between('function __tmParseDurationMinutes(', 'function __tmGetTaskDocIdById('),
    between('function __tmNormalizeTaskRepeatState(', 'function __tmGetTaskRepeatCompletedCount('),
    between('function __tmGetTaskTimerSliderOptions(', 'function __tmFormatSpentHours('),
].join('\n'), context);

const slider = (task) => ({ ...context.__tmGetTaskTimerSliderOptions(task) });
const expected = (value) => ({ min: 1, max: Math.max(180, value), step: 1, value });
const fallback = { min: 5, max: 180, step: 5, value: 35 };

for (const [durationUnit, spentUnit, duration, spent] of [
    ['minutes', 'minutes', '90', { tomatoMinutes: 30, tomatoHours: 99 }],
    ['hours', 'minutes', '1.5', { tomatoMinutes: 30, tomatoHours: 99 }],
    ['minutes', 'hours', '90', { tomatoHours: 0.5, tomatoMinutes: 999 }],
    ['hours', 'hours', '1.5', { tomatoHours: 0.5, tomatoMinutes: 999 }],
    ['hours', 'minutes', '90分钟', { tomatoMinutes: 30 }],
    ['minutes', 'hours', '1小时30分', { tomatoHours: 0.5 }],
]) {
    Object.assign(context.SettingsStore.data, { durationFormat: durationUnit, tomatoSpentAttrMode: spentUnit });
    assert.deepEqual(slider({ duration, ...spent }), expected(60), `${durationUnit} estimate / ${spentUnit} spent`);
}
Object.assign(context.SettingsStore.data, { durationFormat: 'minutes', tomatoSpentAttrMode: 'minutes' });
for (const [task, minutes] of [
    [{ duration: '45', tomatoMinutes: 32 }, 13],
    [{ duration: '45', tomatoMinutes: 43 }, 2],
    [{ duration: '45', tomatoMinutes: 44.8 }, 1],
    [{ duration: '45', tomatoMinutes: 31.6 }, 13],
    [{ duration: '4h' }, 240],
    [{ duration: '13' }, 13],
]) assert.deepEqual(slider(task), expected(minutes));

for (const task of [null, {}, { duration: '' }, { duration: 'abc' }, { duration: '0' },
    { duration: '-1h' }, { duration: '9'.repeat(309) + 'h' }, { duration: '30', tomatoMinutes: 30 },
    { duration: '30', tomatoMinutes: 31 }]) {
    assert.deepEqual(slider(task), fallback, 'missing, invalid, reached or exceeded estimates must retain default steps');
}

assert.deepEqual(slider({ duration: '45', repeatRule: { enabled: true, type: 'daily' },
    repeatState: { tomatoBaselineMinutes: 100 }, tomatoMinutes: 132 }), expected(13),
'recurring tasks must subtract only the current occurrence');
assert.deepEqual(slider({ duration: '45', isRecurringInstance: true,
    tomatoMinutes: 132, tomatoOccurrenceMinutes: 32 }), expected(13));

for (const [configured, value] of [[13, 15], [2, 5], [240, 180], [0, 30], [NaN, 30]]) {
    context.__tomatoTimer.getDefaultDurationMinutes = () => configured;
    assert.deepEqual(slider({}), { min: 5, max: 180, step: 5, value });
}
context.__tomatoTimer.getDefaultDurationMinutes = () => { throw new Error('unavailable'); };
assert.deepEqual(slider({}), { min: 5, max: 180, step: 5, value: 30 });

console.log('Tomato menu task duration tests passed');
