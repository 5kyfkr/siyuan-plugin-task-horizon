'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/task-horizon/main/06a-duration-utils.js'), 'utf8');
const context = { console, localStorage: null };
vm.createContext(context);
vm.runInContext(source, context);

const duration = context.__tmDuration;
assert.ok(duration, 'duration utils must expose __tmDuration');

const parseCases = [
    ['2h30m', 'hours', 150],
    ['2h 30m', 'hours', 150],
    ['2小时30分钟', 'hours', 150],
    ['90分钟', 'hours', 90],
    ['1.5', 'hours', 90],
    ['2.5', 'hours', 150],
    ['90', 'hours', 5400],
    ['1d', 'hours', 1440],
    ['1天', 'hours', 1440],
    ['1:30', 'hours', 90],
    ['0', 'hours', 0],
    ['', 'hours', null],
    ['abc', 'hours', null],
    ['-1h', 'hours', null],
    ['90', 'minutes', 90],
    ['2.5', 'minutes', 2.5],
    ['1.5h', 'minutes', 90],
    ['2h30m', 'minutes', 150],
    ['90分钟', 'minutes', 90],
    ['1d', 'minutes', 1440],
];
for (const [input, unit, expected] of parseCases) {
    assert.equal(duration.parse(input, unit), expected, `parse(${JSON.stringify(input)}, ${unit})`);
}

const hoursRoundTrip = [];
for (let total = 1; total <= 99 * 60 + 59; total += 1) {
    const stored = duration.toStorage(total, 'hours');
    const parsed = duration.parse(stored, 'hours');
    if (Math.round(parsed) !== total) hoursRoundTrip.push([total, stored, parsed]);
}
assert.deepEqual(hoursRoundTrip, [], 'hours storage must round-trip every minute');

const minutesRoundTrip = [];
for (let total = 1; total <= 999; total += 1) {
    const stored = duration.toStorage(total, 'minutes');
    const parsed = duration.parse(stored, 'minutes');
    if (Math.round(parsed) !== total) minutesRoundTrip.push([total, stored, parsed]);
}
assert.deepEqual(minutesRoundTrip, [], 'minutes storage must round-trip every minute');

const split = duration.split(150);
assert.equal(split.hours, 2);
assert.equal(split.minutes, 30);
assert.equal(split.total, 150);
assert.equal(duration.join(2, 30), 150);
assert.equal(duration.formatPreview(2, 30), '2h30m');
assert.equal(duration.formatPreview(0, 45), '45m');
assert.equal(duration.formatPreview(1, 0), '1h');
assert.equal(duration.formatPreview(0, 0), '');

assert.equal(duration.toStorage(150, 'hours'), '2.5');
assert.equal(duration.toStorage(140, 'hours'), '2.33');
assert.equal(duration.toStorage(60, 'hours'), '1');
assert.equal(duration.toStorage(45, 'hours'), '0.75');
assert.equal(duration.toStorage(150, 'minutes'), '150');
assert.equal(duration.toStorage(0, 'hours'), '');

assert.equal(duration.formatPresetLabel('0.5', 'hours'), '0.5h');
assert.equal(duration.formatPresetLabel('1', 'hours'), '1h');
assert.equal(duration.formatPresetLabel('2', 'hours'), '2h');
assert.equal(duration.formatPresetLabel('30', 'hours'), '30h');
assert.equal(duration.formatPresetLabel('1h30m', 'hours'), '1.5h');
assert.equal(duration.formatPresetLabel('30', 'minutes'), '30m');
assert.equal(duration.formatPresetLabel('1h30m', 'minutes'), '90m');

assert.equal(duration.normalizeUnit('minutes'), 'minutes');
assert.equal(duration.normalizeUnit('hours'), 'hours');
assert.equal(duration.normalizeUnit(''), 'hours');

context.__taskHorizonSettingsStore = { data: { durationFormat: 'minutes' } };
assert.equal(duration.getUnit(), 'minutes', 'getUnit must read the live settings store');
context.__taskHorizonSettingsStore.data.durationFormat = 'hours';
assert.equal(duration.getUnit(), 'hours', 'getUnit must follow unit changes');
delete context.__taskHorizonSettingsStore;

const taskUtilsSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js'), 'utf8');
const parserStart = taskUtilsSource.indexOf('function __tmParseDurationMinutes');
const parserEnd = taskUtilsSource.indexOf('function __tmGetTaskDocIdById', parserStart);
assert.ok(parserStart >= 0 && parserEnd > parserStart, 'main duration parser must exist');
const mainContext = { SettingsStore: { data: { durationFormat: 'hours' } } };
vm.createContext(mainContext);
vm.runInContext(source, mainContext);
vm.runInContext(`${taskUtilsSource.slice(parserStart, parserEnd)}\nthis.parseDuration = __tmParseDurationMinutes;`, mainContext);
const mainParse = mainContext.parseDuration;

assert.equal(mainParse('2h30m'), 150, 'main parser must keep compound hours');
assert.equal(mainParse('90分钟'), 90, 'main parser must not treat Chinese minutes as hours');
assert.equal(mainParse('2.5'), 150, 'main parser must interpret bare numbers in hours mode');
assert.equal(mainParse('90'), 5400, 'main parser must interpret bare numbers in hours mode');
assert.equal(mainParse('1d'), 1440);
assert.equal(mainParse(''), null);
mainContext.SettingsStore.data.durationFormat = 'minutes';
assert.equal(mainParse('90'), 90, 'main parser must switch bare-number units with the setting');
assert.equal(mainParse('2.5'), 2.5);

console.log('duration utils tests passed');
