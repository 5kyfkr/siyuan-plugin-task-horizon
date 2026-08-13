'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (...segments) => fs.readFileSync(path.join(root, ...segments), 'utf8');
const store = read('src', 'task-horizon', 'main', '10-stores-rules-and-cache.js');
const settings = read('src', 'task-horizon', 'main', 'settings', '60-settings-screen.js');
const actions = read('src', 'task-horizon', 'main', 'settings', '70-doc-group-and-settings-actions.js');
const runtime = read('src', 'task-horizon', 'main', 'task-runtime', '53b-task-create-and-quick-add-runtime.js');

function extractFunction(source, marker) {
    const start = source.indexOf(marker);
    assert.notEqual(start, -1, `${marker} must exist`);
    const bodyStart = source.indexOf('{', start);
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        else if (source[index] === '}') depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`Unable to extract ${marker}`);
}

const resolverSource = extractFunction(runtime, 'function __tmResolveQuickAddDefaultCompletionTime');
const resolveDefault = (enabled, referenceDate) => vm.runInNewContext(
    `${resolverSource}; __tmResolveQuickAddDefaultCompletionTime(referenceDate);`,
    {
        SettingsStore: { data: { quickAddDefaultCompletionToday: enabled } },
        referenceDate,
        __tmNormalizeDateOnly: (date) => {
            const pad = (value) => String(value).padStart(2, '0');
            return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        },
    }
);

assert.match(store, /quickAddDefaultCompletionToday:\s*false/);
assert.match(store, /typeof cloudData\.quickAddDefaultCompletionToday === 'boolean'/);
assert.match(store, /Storage\.get\('tm_quick_add_default_completion_today'/);
assert.match(store, /Storage\.set\('tm_quick_add_default_completion_today'/);
assert.match(settings, /快速新建默认截止日期为今天[\s\S]*updateQuickAddDefaultCompletionToday\(this\.checked\)/);
assert.match(actions, /window\.updateQuickAddDefaultCompletionToday = async function\(enabled\)[\s\S]*SettingsStore\.data\.quickAddDefaultCompletionToday = !!enabled;[\s\S]*await SettingsStore\.save\(\)/);

const localDate = new Date(2026, 7, 12, 23, 45, 0);
assert.equal(resolveDefault(false, localDate), '');
assert.equal(resolveDefault(true, localDate), '2026-08-12');
assert.match(runtime, /state\.quickAdd = \{[\s\S]*completionTime: __tmResolveQuickAddDefaultCompletionTime\(\)/);
assert.match(runtime, /window\.tmQuickAddOpenForPreset = async function[\s\S]*if \(date\) \{[\s\S]*qa\.completionTime = date;/);
assert.equal(
    (runtime.match(/\bquickAddDefaultCompletionToday\b/g) || []).length,
    1,
    'the setting must only affect the quick-add draft initializer'
);

console.log('quick add default today contract tests passed');
