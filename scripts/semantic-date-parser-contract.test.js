'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', '20-api-and-runtime-services.js'), 'utf8');

function loadSemanticParser() {
    const start = source.indexOf('    function __tmSemanticPad2');
    const end = source.indexOf('    async function __tmCollectSemanticDateSuggestions', start);
    assert.ok(start >= 0 && end > start, 'semantic date parser block must remain extractable');
    return new Function('SettingsStore', 'Storage', `${source.slice(start, end)}
        return { parse: __tmExtractSemanticTaskDateSuggestion };
    `)(
        { data: { semanticDateDefaultReminderTime: '08:00' } },
        { get: () => true }
    );
}

const parser = loadSemanticParser();
const baseDate = new Date(2026, 6, 23, 10, 0, 0, 0);

function parse(content) {
    return parser.parse({
        id: 'task-1',
        content,
        remark: '',
        startDate: '',
        completionTime: '',
    }, baseDate);
}

assert.equal(parse('晚上8点')?.completionValue, '2026-07-23 20:00');
assert.equal(parse('开会 下午3点')?.completionValue, '2026-07-23 15:00');
assert.equal(parse('傍晚 6:30')?.completionValue, '2026-07-23 18:30');
assert.equal(parse('明晚8点')?.completionValue, '2026-07-24 20:00');
assert.equal(parse('明天晚上8点')?.completionValue, '2026-07-24 20:00');
assert.equal(parse('明天十点半')?.completionValue, '2026-07-24 10:30');
assert.equal(parse('晚上十点半')?.completionValue, '2026-07-23 22:30');
assert.equal(parse('昨天晚上8点'), null, 'an unsupported past-day expression must not be rewritten as today');
assert.equal(parse('8点'), null, 'a bare clock time must not silently assume today');
assert.equal(parse('十点半'), null, 'a bare Chinese-numeral clock time must not silently assume today');

console.log('semantic date parser contract tests passed');
