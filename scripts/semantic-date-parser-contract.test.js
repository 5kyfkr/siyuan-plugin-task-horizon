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

function parse(content, remark = '') {
    return parser.parse({
        id: 'task-1',
        content,
        remark,
        startDate: '',
        completionTime: '',
    }, baseDate);
}

assert.equal(parse('晚上8点')?.completionValue, '2026-07-23 20:00');
assert.equal(parse('开会 下午3点')?.completionValue, '2026-07-23 15:00');
assert.equal(parse('傍晚 6:30')?.completionValue, '2026-07-23 18:30');
assert.equal(parse('记得8.21下午5点钟')?.completionValue, '2026-07-23 17:00');
assert.equal(parse('记得8.21下午5:30')?.completionValue, '2026-07-23 17:30');
assert.equal(parse('明晚8点')?.completionValue, '2026-07-24 20:00');
assert.equal(parse('明天晚上8点')?.completionValue, '2026-07-24 20:00');
assert.equal(parse('明天十点半')?.completionValue, '2026-07-24 10:30');
assert.equal(parse('晚上十点半')?.completionValue, '2026-07-23 22:30');
assert.equal(parse('昨天晚上8点'), null, 'an unsupported past-day expression must not be rewritten as today');
assert.equal(parse('8点')?.completionValue, '2026-07-23 08:00', 'a bare clock now defaults to today');
assert.equal(parse('8点吃饭')?.completionValue, '2026-07-23 08:00');
assert.equal(parse('十点半')?.completionValue, '2026-07-23 10:30');
assert.equal(parse('昨天8点吃饭'), null, 'past-day qualifiers must not become today');

for (const [content, remark] of [
    ['整理资料', '明天交付报告'],
    ['整理资料', '2026年8月21日下午3点开会'],
    ['整理资料', '明天开始，后天截止'],
    ['整理资料', '明天晚上8点提醒我寄快递'],
    ['', '明天交付报告'],
    [' \n\t ', '明天交付报告'],
    ['昨天晚上8点', '明天晚上8点'],
]) {
    assert.equal(parse(content, remark), null, 'dates and reminders in remarks must not produce a suggestion');
}

const conflictingRemark = '后天晚上8点提醒我，明天开始，三天后截止';
for (const content of ['明天交付报告', '明天晚上8点开会', '明天开始，后天截止']) {
    const suggestion = parse(content);
    assert.ok(suggestion, 'dates in task content must still produce suggestions');
    assert.equal(suggestion.sourceKey, 'content');
    assert.deepEqual(parse(content, conflictingRemark), { ...suggestion, remark: conflictingRemark },
        'remarks must not change the dates, reminder intent, or recognition signature from task content');
}

console.log('semantic date parser contract tests passed');
