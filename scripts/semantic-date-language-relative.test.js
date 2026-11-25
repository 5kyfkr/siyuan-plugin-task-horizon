'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('./i18n-vm-fixture');
const { createI18n } = require('../src/i18n/runtime');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const api = read('src/task-horizon/main/20-api-and-runtime-services.js');
const model = read('src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js');
const segment = (text, from, to) => {
    const start = text.indexOf(from), end = text.indexOf(to, start + from.length);
    assert.ok(start >= 0 && end > start, from);
    return text.slice(start, end);
};
function harness(locale) {
    const i18n = createI18n(require('../i18n/' + locale + '.json'), { locale });
    const context = vm.createContext({
        Date, Intl, SettingsStore: { data: { semanticDateDefaultReminderTime: '08:00' } },
        Storage: { get: (_, fallback) => fallback },
        __taskHorizonHostBridge: { i18n }, __tmT: i18n.t,
        SemanticDateRecognizedStore: { load: async () => {}, snapshot: () => ({}) },
        __TM_SEMANTIC_DATE_AUTO_SCAN_BATCH_SIZE: 120,
    });
    vm.runInContext(read('src/task-horizon/main/06a-duration-utils.js'), context);
    vm.runInContext(segment(model, '    function __tmNormalizeDateOnly', '    function __tmGetTaskRepeatWeekdayLabel'), context);
    vm.runInContext(segment(api, '    function __tmSemanticPad2', '    function __tmCloseSemanticDateConfirmModal'), context);
    const base = new Date(2026, 10, 25, 10, 20, 0);
    const parse = (content, options = {}) => context.__tmExtractSemanticTaskDateSuggestion({ id: 'task', content, ...options.task }, options.base || base);
    return { context, parse, base };
}
const zh = harness('zh-CN'), en = harness('en');
for (const h of [zh, en]) {
    for (const [text, expected] of [
        ['1day提醒吃饭', '2026-11-26 10:20'],
        ['1day提醒我吃饭', '2026-11-26 10:20'],
        ['10min通知喝水', '2026-11-25 10:30'],
        ['10 MIN 以后 提醒 我 喝水', '2026-11-25 10:30'],
        ['2h后通知我开会', '2026-11-25 12:20'],
        ['1.5小时之后提醒休息', '2026-11-25 11:50'],
        ['0.5day提醒复查', '2026-11-25 22:20'],
        ['1天后提醒复查', '2026-11-26 10:20'],
        ['10min提醒参加15:00会议', '2026-11-25 10:30'],
    ]) {
        const item = h.parse(text);
        assert.equal(item?.reminderAt, expected, text);
        assert.equal(item.relativeReminder, true);
        assert.equal(item.reminderIntent, true);
        assert.equal(item.content, text, 'parsing never rewrites the task title');
        const writes = h.context.__tmSemanticBuildSuggestionWrites(item);
        assert.equal(writes.find(w => w.id === 'reminder').checked, true);
        assert.equal(writes.some(w => w.id === 'calendarSchedule'), false);
    }
    assert.equal(h.parse('10min提醒喝水', { base: new Date(2026, 10, 25, 23, 55, 30) }).reminderAt, '2026-11-26 00:06', 'round up to avoid firing before the requested duration');
    const a = h.parse('10min提醒喝水'), b = h.parse('10min提醒喝水', { base: new Date(2026, 10, 26, 8) });
    assert.equal(a.signature, b.signature, 'relative signatures must not drift with the clock');
    assert.notEqual(a.signature, h.parse('20min提醒喝水').signature);
    assert.notEqual(a.signature, h.parse('10min提醒开会').signature);
    for (const text of ['0min提醒喝水', '-10min提醒喝水', '- 10min提醒喝水', '1h30min提醒喝水', '1h 30min提醒喝水', '10min提醒我', '10min提醒', '1day吃饭', '0小时提醒参加15:00会议']) {
        assert.equal(h.parse(text), null, text);
    }
    assert.equal(h.parse('每3天提醒我备份').repeatRule.every, 3);
    assert.equal(h.parse('每三天提醒我备份').repeatRule.every, 3);
}
for (const [text, expected] of [
    ['remind me in 10 minutes to drink water', '2026-11-25 10:30'],
    ['Remind me to rest in 1.5 HOURS', '2026-11-25 11:50'],
    ['notify me in 1 day to review', '2026-11-26 10:20'],
]) {
    assert.equal(en.parse(text)?.reminderAt, expected, text);
    assert.equal(zh.parse(text), null, 'English reminder syntax is disabled in Chinese UI');
}
for (const [text, due, reminder = ''] of [
    ['tomorrow at 9:00', '2026-11-26 09:00'],
    ['tomorrow at 3:30 PM', '2026-11-26 15:30'],
    ['today at 12am', '2026-11-25 00:00'],
    ['today at 12pm', '2026-11-25 12:00'],
    ['tonight at 8', '2026-11-25 20:00'],
    ['the day after tomorrow at 9am', '2026-11-27 09:00'],
    ['in 3 days', '2026-11-28', '2026-11-28 08:00'],
    ['in 2 weeks at 9am', '2026-12-09 09:00'],
    ['this Friday at 9am', '2026-11-27 09:00'],
    ['next Friday at 9am', '2026-12-04 09:00'],
    ['Mon at 9am', '2026-11-30 09:00'],
    ['May 30, 2027 at 3pm', '2027-05-30 15:00'],
    ['30 Nov at 9am', '2026-11-30 09:00'],
    ['remind me tomorrow at 9am to call Alice', '2026-11-26', '2026-11-26 09:00'],
    ['notify me November 26 at 3pm', '2026-11-26', '2026-11-26 15:00'],
]) {
    const item = en.parse(text);
    assert.equal(item?.completionValue, due, text);
    assert.equal(item.reminderAt, reminder, text);
    assert.equal(item.content, text);
    assert.equal(zh.parse(text), null, text + ': must not partially match a clock in Chinese UI');
}
assert.equal(en.parse('next Friday', { base: new Date(2026, 10, 28, 10) }).completionValue, '2026-12-04', 'next week is anchored to Monday, including from weekends');
const start = en.parse('start tomorrow');
assert.equal(start.startDateValue, '2026-11-26');
assert.equal(start.completionValue, '');
const range = en.parse('from tomorrow to next Friday');
assert.equal(range.startDateValue, '2026-11-26');
assert.equal(range.completionValue, '2026-12-04');
assert.equal(en.parse('due Friday').completionValue, '2026-11-27');
assert.equal(en.parse('deadline 2026-11-27').completionValue, '2026-11-27');
for (const [text, type, every, first, time] of [
    ['daily at 9am', 'daily', 1, '2026-11-25', '09:00'],
    ['every 2 days at 3pm', 'daily', 2, '2026-11-25', '15:00'],
    ['every weekday at 9am', 'workday', 1, '2026-11-25', '09:00'],
    ['every weekend at 9am', 'weekly', 1, '2026-11-28', '09:00'],
    ['every Monday at 9am', 'weekly', 1, '2026-11-30', '09:00'],
    ['every other Friday at 3pm', 'weekly', 2, '2026-11-27', '15:00'],
    ['every 2 weeks on Monday and Friday at 9am', 'weekly', 2, '2026-11-27', '09:00'],
    ['every Monday to Friday at 9am', 'weekly', 1, '2026-11-25', '09:00'],
    ['weekly on Friday at 9am', 'weekly', 1, '2026-11-27', '09:00'],
    ['every month on the 15th at 9am', 'monthly', 1, '2026-12-15', '09:00'],
    ['every month on the 1st and 15th at 9am', 'monthly', 1, '2026-12-01', '09:00'],
    ['every month on the last day at 9am', 'monthly', 1, '2026-11-30', '09:00'],
    ['every month on the last Friday at 9am', 'monthly', 1, '2026-11-27', '09:00'],
    ['the first Friday of every month at 9am', 'monthly', 1, '2026-12-04', '09:00'],
    ['every year on May 1 at 9am', 'yearly', 1, '2027-05-01', '09:00'],
    ['yearly on February 29 at 9am', 'yearly', 1, '2028-02-29', '09:00'],
]) {
    const item = en.parse(text);
    assert.ok(item?.repeatRule, text);
    assert.equal(item.repeatRule.type, type, text);
    assert.equal(item.repeatRule.every, every, text);
    assert.equal(item.repeatCompletionValue, first, text);
    assert.equal(item.reminderAt, first + ' ' + time, text);
    assert.equal(en.context.__tmSemanticBuildSuggestionWrites(item).find(w => w.id === 'reminder').checked, false);
    assert.equal(zh.parse(text), null, text);
}
for (const text of ['yesterday at 9:00', 'tomorrow at 13pm', 'tomorrow at 25:00', 'remind me in 1h 30min to eat', 'remind me in 10min to', 'tomorrow at 3:99 PM', 'February 30 at 9:00', 'every 10 minutes at 9:00', 'every sundial inspection at 9:00', 'remind me in half an hour to attend a 15:00 meeting', 'tomorrow at 9:00 UTC+8', 'every day until Friday at 9am', 'in 1.5 days at 9:00', 'next week at 9:00', 'in two days at 9:00', 'in 2h at 9:00']) {
    assert.equal(en.parse(text), null, 'unsupported temporal expressions must not fall back to a partial clock: ' + text);
}
assert.deepEqual(Array.from(en.parse('every Monday and Friday at 9am').repeatRule.weekdays), [1, 5]);
assert.deepEqual(Array.from(en.parse('every Monday to Friday at 9am').repeatRule.weekdays), [1, 2, 3, 4, 5]);
assert.deepEqual(Array.from(en.parse('every month on the 1st and 15th at 9am').repeatRule.monthDays), [1, 15]);
assert.equal(en.parse('every month on the last Friday at 9am').repeatRule.monthWeek.ordinal, -1);
assert.equal(en.parse('every month on the last Friday at 9am').repeatRule.monthWeek.weekday, 5);
assert.equal(en.parse('daily at 9am').signature, en.parse('daily at 9am', { base: new Date(2026, 10, 26) }).signature);
for (const h of [zh, en]) {
    assert.equal(h.parse('2026-11-26 15:30').completionValue, '2026-11-26 15:30');
    assert.equal(h.parse('明天9点提醒寄快递').reminderAt, '2026-11-26 09:00');
    assert.equal(h.parse('整理资料', { task: { remark: '1day提醒吃饭' } }), null);
}
(async () => {
    const task = { id: 'dated', content: '10min提醒喝水', startDate: '2026-11-20', completionTime: '2026-11-30' };
    const result = await zh.context.__tmCollectSemanticDateSuggestions([task], { referenceTimes: new Map([['dated', new Date(2026, 10, 25, 23, 55).getTime()]]) });
    assert.equal(result.items.length, 1, 'filled task dates must not block relative reminders');
    assert.equal(result.items[0].reminderAt, '2026-11-26 00:05', 'use the queued save time rather than the later scan time');
    console.log('semantic language, recurrence and relative reminder behavior tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
