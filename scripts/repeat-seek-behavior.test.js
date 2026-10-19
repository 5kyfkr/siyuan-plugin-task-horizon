'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');

const source = fs.readFileSync(path.join(__dirname, '../src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js'), 'utf8');
const normalizeDate = value => value instanceof Date
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
    : String(value || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '';
const context = vm.createContext({ Date, Intl, console, __tmNormalizeDateOnly: normalizeDate });
vm.runInContext(source.slice(source.indexOf('function __tmParseTaskRepeatJson'), source.indexOf('function __tmGetTaskRepeatWeekdayLabel')), context);
const core = context.tmRepeatCore;
const plain = value => JSON.parse(JSON.stringify(value));
const addDays = (key, days) => {
    const date = new Date(`${key}T12:00:00`);
    date.setDate(date.getDate() + days);
    return normalizeDate(date);
};

// Oracle walks the public next() API from the original seed, independently of
// seek arithmetic. Compare ordinals as well as dates (count endings use them).
function sequential(input, options) {
    const rule = core.normalizeRule(input);
    let cursor = { dateKey: options.anchorDate || rule.anchorDate, ordinal: 1 };
    if (rule.trigger === 'checkin') {
        const first = new Date(`${cursor.dateKey}T12:00:00`);
        if (rule.type === 'weekly' && !rule.weekdays.includes(first.getDay())) cursor.dateKey = core.nextDateKey(cursor.dateKey, rule);
        if (rule.type === 'workday') {
            while ([0, 6].includes(first.getDay())) first.setDate(first.getDate() + 1);
            cursor.dateKey = normalizeDate(first);
        }
    }
    const out = [];
    for (let guard = 0; cursor && guard < 200000 && out.length < (options.limit || 2400); guard++) {
        if (rule.maxOccurrences && cursor.ordinal > rule.maxOccurrences) break;
        if (rule.until && cursor.dateKey > rule.until) break;
        if (cursor.dateKey >= options.fromDateKey && cursor.dateKey <= options.toDateKey) out.push(plain(cursor));
        if (cursor.dateKey >= options.toDateKey) break;
        cursor = core.next(rule, cursor);
    }
    return out;
}

let cases = 0;
const previousTZ = process.env.TZ;
try {
    for (const timezone of ['Asia/Shanghai', 'America/New_York', 'Europe/Berlin']) {
        process.env.TZ = timezone;
        // Includes weekends, leap day, and both sides of DST transitions.
        for (const anchorDate of ['2020-02-29', '2024-03-08', '2024-03-09', '2024-03-10', '2024-03-11', '2024-11-01', '2024-11-03']) {
            for (const type of ['daily', 'workday', 'weekly']) {
                for (const trigger of ['due', 'checkin']) {
                    for (const every of [1, 2, 5, 13]) {
                        for (const weekdays of type === 'weekly' ? [[0], [1, 3, 5], [2, 4, 6, 0]] : [[]]) {
                            for (const offset of [0, 1, 6, 11, 400, 2500]) {
                                const input = { enabled: true, anchorDate, type, trigger, every, weekdays };
                                const options = { fromDateKey: addDays(anchorDate, offset), toDateKey: addDays(anchorDate, offset + 18), limit: 9 };
                                for (const ending of [{}, { maxOccurrences: 5 }, { until: addDays(anchorDate, 410) }]) {
                                    const rule = { ...input, ...ending };
                                    assert.deepEqual(plain(core.iterate(rule, options)), sequential(rule, options), JSON.stringify({ timezone, rule, options }));
                                    cases++;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    const rule = { enabled: true, type: 'daily', every: 1, anchorDate: '2000-01-01' };
    const options = { fromDateKey: '2026-10-18', toDateKey: '2026-10-24', limit: 1 };
    // The old history guard could stop before the requested day for limit=1.
    assert.deepEqual(plain(core.iterate(rule, options)), sequential(rule, options));
    let nextCalls = 0;
    vm.runInContext('const originalNextForSeekTest = __tmRepeatCoreNext; __tmRepeatCoreNext = (...args) => { countNext(); return originalNextForSeekTest(...args); };', Object.assign(context, { countNext: () => nextCalls++ }));
    const start = performance.now();
    for (let i = 0; i < 50; i++) core.iterate(rule, { ...options, limit: 50 });
    assert.ok(nextCalls <= 350, `historical dates must not be walked again (${nextCalls} next calls)`);
    console.log(`repeat seek: ${cases} parity cases passed; 50 historical weekly-window reads ${(performance.now() - start).toFixed(1)}ms`);
} finally {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
}
