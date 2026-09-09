'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'calendar-view.js'), 'utf8');
const styles = fs.readFileSync(path.resolve(__dirname, '..', 'calendar-view.css'), 'utf8');
const start = source.indexOf('function formatCnLunarDateKey(');
const bodyStart = source.indexOf('{', start);
assert.ok(start >= 0 && bodyStart > start, 'calendar lunar formatter must remain extractable');
let depth = 0;
let end = -1;
for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) {
        end = index + 1;
        break;
    }
}
assert.ok(end > bodyStart, 'calendar lunar formatter must have a complete body');

const context = {
    Date,
    Intl,
    Number,
    String,
    parseDateOnly: (value) => {
        const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12) : null;
    },
    TM_CN_LUNAR_DAY_NAMES: [
        '', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
        '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
        '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
    ],
    __tmCnLunarDateFormatter: null,
    __tmCnLunarDateFormatterUnsupported: false,
};
context.globalThis = {
    __tmGetChineseLunarDateInfo: () => ({ relatedYear: 2027, month: 1, day: 1, isLeap: false }),
};
vm.createContext(context);
const formatCnLunarDateKey = vm.runInContext(`(${source.slice(start, end)})`, context);

assert.equal(formatCnLunarDateKey('2027-02-06'), '正月初一', 'calendar labels must use the shared authoritative lunar conversion');

const sharedStart = source.indexOf('function buildSharedPrototypeLunarText(');
const sharedBodyStart = source.indexOf('{', sharedStart);
let sharedDepth = 0;
let sharedEnd = -1;
for (let index = sharedBodyStart; index < source.length; index += 1) {
    if (source[index] === '{') sharedDepth += 1;
    if (source[index] === '}') sharedDepth -= 1;
    if (sharedDepth === 0) {
        sharedEnd = index + 1;
        break;
    }
}
assert.ok(sharedStart >= 0 && sharedEnd > sharedBodyStart, 'shared lunar formatter must have a complete body');
context.formatCnLunarDateKey = formatCnLunarDateKey;
const buildSharedPrototypeLunarText = vm.runInContext(`(${source.slice(sharedStart, sharedEnd)})`, context);
assert.equal(
    buildSharedPrototypeLunarText('2027-02-06', { showLunar: true }, new Map([['2027-02-06', { lunar: '正月初二' }]])),
    '初一',
    'cached holiday lunar text must not override the authoritative conversion',
);
context.formatCnLunarDateKey = () => '八月十五';
assert.equal(
    buildSharedPrototypeLunarText('2027-09-25', { showLunar: true }, new Map([['2027-09-25', { lunar: '八月十五' }]])),
    '十五',
    'month view lunar labels must omit the lunar month',
);
context.formatCnLunarDateKey = () => '正月廿九';
assert.equal(
    buildSharedPrototypeLunarText('2027-02-05', { showLunar: true }, new Map([['2027-02-05', { lunar: '正月廿九' }]])),
    '廿九',
    'month view lunar labels must keep only the lunar day name',
);

assert.match(
    source,
    /return `<span class="tm-proto-day-number-wrap"><span class="tm-proto-day-number /,
    'month date badges must share a non-overlapping layout wrapper',
);
assert.match(styles, /\.tm-proto-date-meta\{[\s\S]*position:\s*absolute;[\s\S]*top:\s*50%;[\s\S]*right:\s*4px;[\s\S]*transform:\s*translateY\(-50%\);[\s\S]*text-align:\s*right;/, 'month date metadata must sit at the right side of the date header');
assert.match(styles, /\.tm-proto-month-cell--month-start \.tm-proto-date-meta\{[\s\S]*max-width:\s*calc\(100% - 64px\);/, 'month-start metadata must reserve the wide date pill');

console.log('calendar lunar date tests passed');
