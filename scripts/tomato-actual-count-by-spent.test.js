'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const storePath = path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js');
const source = fs.readFileSync(storePath, 'utf8');

function extractBetween(startNeedle, endNeedle) {
    const start = source.indexOf(startNeedle);
    const end = source.indexOf(endNeedle, start + startNeedle.length);
    assert.ok(start >= 0, `missing ${startNeedle}`);
    assert.ok(end > start, `missing boundary ${endNeedle}`);
    return source.slice(start, end).trim();
}

const calculationSource = extractBetween(
    'function __tmNormalizeTomatoCountValue(',
    'function __tmGetMeasureFontFromStyle(',
);
const context = vm.createContext({
    SettingsStore: {
        data: {
            tomatoActualCountBySpentEnabled: true,
            tomatoSpentAttrMode: 'minutes',
        },
    },
    __dockTomato: {
        getDefaultTomatoTimeMinutes: () => 30,
    },
    __tmGetTaskTomatoFocusValues: (task) => task?.focus || task || {},
});
vm.runInContext(
    `${calculationSource}\nthis.actual = __tmGetTaskTomatoCount; this.display = __tmGetTomatoCountDisplay;`,
    context,
);

assert.equal(
    context.actual({ tomatoMinutes: 90, tomatoHours: 99, tomatoCount: 1 }),
    '3',
    '30 minute countdown plus 60 minute stopwatch must evaluate to three tomatoes',
);
assert.equal(context.actual({ tomatoMinutes: 45 }), '1.5');
assert.equal(context.actual({ tomatoMinutes: 10 }), '0.3');
assert.equal(context.actual({ tomatoMinutes: 50 }), '1.7');
assert.equal(context.display('1.5'), '🍅 1.5', 'actual tomato display must preserve decimals');

context.SettingsStore.data.tomatoSpentAttrMode = 'hours';
assert.equal(
    context.actual({ tomatoMinutes: 999, tomatoHours: 1.5 }),
    '3',
    'hour mode must read hours and convert them to minutes',
);

context.SettingsStore.data.tomatoSpentAttrMode = 'minutes';
assert.equal(
    context.actual({ tomatoMinutes: 100, focus: { tomatoMinutes: 45, tomatoCount: 1 } }),
    '1.5',
    'recurring tasks must evaluate the current occurrence focus values',
);

context.SettingsStore.data.tomatoActualCountBySpentEnabled = false;
assert.equal(context.actual({ tomatoMinutes: 90, tomatoCount: 1 }), '1', 'disabled mode must use the persisted count');

context.SettingsStore.data.tomatoActualCountBySpentEnabled = true;
context.__dockTomato = null;
assert.equal(context.actual({ tomatoMinutes: 60 }), '2', 'missing Dock Tomato API must fall back to 30 minutes');
assert.equal(context.actual({ tomatoMinutes: 0, tomatoCount: 4 }), '', 'zero focus time must stay empty in evaluated mode');

assert.match(source, /tomatoActualCountBySpentEnabled:\s*true/, 'the feature must default to enabled');
assert.match(source, /tm_tomato_actual_count_by_spent_enabled/, 'the setting must be persisted');

console.log('tomato actual count by spent tests passed');
