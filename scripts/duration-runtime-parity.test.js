'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const kernel = fs.readFileSync(path.join(root, 'kernel.js'), 'utf8');
const homepage = fs.readFileSync(path.join(root, 'homepage.js'), 'utf8');
const calendar = fs.readFileSync(path.join(root, 'calendar-view.js'), 'utf8');

const start = kernel.indexOf('function normalizeDurationUnit');
const end = kernel.indexOf('async function aggregateTimeUsage');
assert.ok(start >= 0 && end > start, 'kernel duration helpers must exist');
const parserSource = kernel.slice(start, end);
const context = {
    text(value) {
        return String(value == null ? '' : value).trim();
    },
};
vm.createContext(context);
vm.runInContext(`${parserSource}\nthis.parseDuration = parseDurationMinutes; this.normalizeUnit = normalizeDurationUnit;`, context);

const cases = [
    ['2.5', 'hours', 150],
    ['90', 'hours', 5400],
    ['90', 'minutes', 90],
    ['2h30m', 'hours', 150],
    ['2h 30m', 'minutes', 150],
    ['90分钟', 'hours', 90],
    ['1.5小时', 'hours', 90],
    ['1d', 'hours', 1440],
    ['1:30', 'hours', 90],
    ['0', 'hours', 0],
    ['', 'hours', null],
    ['abc', 'hours', null],
];
for (const [input, unit, expected] of cases) {
    assert.equal(context.parseDuration(input, unit), expected, `kernel parseDurationMinutes(${JSON.stringify(input)}, ${unit})`);
}
assert.equal(context.normalizeUnit('minutes'), 'minutes');
assert.equal(context.normalizeUnit('hours'), 'hours');
assert.equal(context.normalizeUnit(''), 'hours');

assert.match(
    kernel,
    /const settings = await getSettings\(\);[\s\S]*const durationUnit = normalizeDurationUnit\(settings\.durationFormat\);[\s\S]*parseDurationMinutes\(row\.estimate, durationUnit\)/,
    'kernel aggregate_time_usage must parse estimates with the saved duration unit',
);
assert.match(
    homepage,
    /const shared = globalThis\.__tmDuration\?\.parse\?\.\(raw, fmt\);/,
    'homepage must reuse the shared duration parser',
);
assert.match(
    calendar,
    /function getCalendarDurationUnit\(\)[\s\S]*globalThis\.__tmDuration\?\.getUnit\?\.\(\)/,
    'calendar must read the shared duration unit',
);
assert.match(
    calendar,
    /const shared = globalThis\.__tmDuration\?\.parse\?\.\(s, unit\);/,
    'calendar must reuse the shared duration parser',
);

console.log('duration runtime parity tests passed');
