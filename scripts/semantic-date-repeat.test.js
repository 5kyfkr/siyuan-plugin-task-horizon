'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const main = path.join(__dirname, '..', 'src/task-horizon/main');
const api = fs.readFileSync(path.join(main, '20-api-and-runtime-services.js'), 'utf8');
const model = fs.readFileSync(path.join(main, 'task-runtime/50-task-model-and-repeat-utils.js'), 'utf8');
const repeat = fs.readFileSync(path.join(main, 'task-runtime/54-recurring-task-runtime.js'), 'utf8');
const between = (source, from, to) => {
    const start = source.indexOf(from), end = source.indexOf(to, start);
    assert.ok(start >= 0 && end > start, from);
    return source.slice(start, end);
};
const tasks = new Map(), writes = [], reminders = [], order = [];
let failWrite = false, recognized = {};
const context = vm.createContext({
    Date, Intl, SettingsStore: { data: { semanticDateDefaultReminderTime: '08:00' } },
    Storage: { get: (key, fallback) => fallback },
    SemanticDateRecognizedStore: { load: async () => {}, snapshot: () => recognized },
    __TM_SEMANTIC_DATE_AUTO_SCAN_BATCH_SIZE: 100,
    __TM_REMINDER_REPEAT_MODE_FOLLOW_TASK: 'followTaskRepeat',
    __tmNormalizeDateOnly: value => value instanceof Date ? `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}` : String(value || '').slice(0,10),
    __tmNormalizeTaskCompleteAtValue: value => String(value || ''),
    __tmBuildTaskTomatoBaselinePatch: () => ({}),
    __tmCreateMutationOperationId: () => 'semantic-test-operation',
    __tmGetTaskRepeatSummary: rule => rule.type,
    __tmTaskBoundary: { getTask: id => tasks.get(id) },
    __tmResolveTaskForRepeat: async id => ({ ...tasks.get(id) }),
    __tmResolveTaskBindingFromAnyBlockId: async id => ({ taskId: id, attrHostId: 'host-' + id, task: { ...tasks.get(id) } }),
    __tmGetTaskAttrHostId: task => 'host-' + task.id,
    __tmApplyTaskMetaPatchWithUndo: async (id, patch) => {
        if (failWrite) throw new Error('simulated task write failure');
        writes.push({ id, patch }); order.push('task'); Object.assign(tasks.get(id), patch); return {};
    },
    __tmInvalidateTasksQueryCacheByDocId: () => {},
    __tomatoReminder: {
        version: 1, get: async () => ({ hasReminder: false }),
        upsert: async (id, reminder) => { reminders.push(reminder); order.push('reminder'); return { ok: true, reminder }; },
    },
});
vm.runInContext([
    between(model, '    function __tmParseTaskRepeatJson', '    function __tmGetTaskRepeatWeekdayLabel'),
    between(api, '    function __tmSemanticPad2', '    function __tmCloseSemanticDateConfirmModal'),
    between(api, '    function __tmGetSemanticSuggestionWrites', '    function __tmShowSemanticDateConfirmModal'),
    between(api, '    function __tmReminderToDateSafe', '    function __tmReminderOccurrenceKey'),
    between(api, '    function __tmGetTomatoReminderBridgeV1', '    function __tmInvalidateTaskReminderMark'),
    between(repeat, '    function __tmGetTaskRepeatScheduleSignature', '    async function __tmDeleteTaskRepeatHistoryEntry'),
    between(repeat, '    async function __tmApplyFollowReminderDraft', '    async function __tmClearFollowReminderDraft'),
    'function __tmGetTaskRepeatRule(task) { return __tmNormalizeTaskRepeatRule(task.repeatRule); }',
].join('\n'), context);
const base = new Date(2026, 9, 24, 16);
function parse(content, overrides = {}, date = base) {
    return context.__tmExtractSemanticTaskDateSuggestion({ id: 'task', root_id: 'doc', content, ...overrides }, date);
}
const cases = [
    ['每天8点吃饭', 'daily', 1, '2026-10-24', '08:00'],
    ['每天晚上八点备份', 'daily', 1, '2026-10-24', '20:00'],
    ['每日十点半开会', 'daily', 1, '2026-10-24', '10:30'],
    ['每三天提醒我备份', 'daily', 3, '2026-10-24', '08:00'],
    ['隔天8点整理资料', 'daily', 2, '2026-10-24', '08:00'],
    ['每个工作日9点提交日报', 'workday', 1, '2026-10-26', '09:00'],
    ['每周五下午三点开会', 'weekly', 1, '2026-10-30', '15:00'],
    ['每周五6点吃饭', 'weekly', 1, '2026-10-30', '06:00'],
    ['每周五13:00吃饭', 'weekly', 1, '2026-10-30', '13:00'],
    ['每周五三点吃饭', 'weekly', 1, '2026-10-30', '03:00'],
    ['每两周周五9点开会', 'weekly', 2, '2026-10-30', '09:00'],
    ['每周一三五九点检查', 'weekly', 1, '2026-10-26', '09:00'],
    ['每周一到周五8点检查', 'weekly', 1, '2026-10-26', '08:00'],
    ['每周末8点整理', 'weekly', 1, '2026-10-24', '08:00'],
    ['每月15号提醒我还款', 'monthly', 1, '2026-11-15', '08:00'],
    ['每月1、15号9点检查', 'monthly', 1, '2026-11-01', '09:00'],
    ['每月最后一天18点结账', 'monthly', 1, '2026-10-31', '18:00'],
    ['每月最后一个周五18点结账', 'monthly', 1, '2026-10-30', '18:00'],
    ['每月第一个星期五9点检查', 'monthly', 1, '2026-11-06', '09:00'],
    ['每年5月1日9点续费', 'yearly', 1, '2027-05-01', '09:00'],
    ['每年五月一日九点续费', 'yearly', 1, '2027-05-01', '09:00'],
    ['每年2月29日检查', 'yearly', 1, '2028-02-29', '08:00'],
];
for (const [content, type, every, first, time] of cases) {
    const item = parse(content);
    assert.ok(item, content);
    assert.equal(item.repeatRule.type, type, content);
    assert.equal(item.repeatRule.every, every, content);
    assert.equal(item.repeatCompletionValue, first, content);
    assert.equal(item.reminderAt, first + ' ' + time, content);
    const options = context.__tmSemanticBuildSuggestionWrites(item);
    assert.equal(options[0].id, 'repeatRule');
    assert.equal(options.find(write => write.id === 'reminder').checked, false, 'recurring reminders are opt-in');
    assert.equal(options.some(write => write.id === 'calendarSchedule'), false);
}
assert.equal(parse('8点吃饭').completionValue, '2026-10-24 08:00');
assert.equal(parse('明天8点吃饭').completionValue, '2026-10-25 08:00');
assert.equal(parse('每天8点吃饭').signature, parse('每天8点吃饭', {}, new Date(2026, 9, 25)).signature);
assert.notEqual(parse('每天8点吃饭').signature, parse('每2天8点吃饭').signature);
assert.deepEqual(Array.from(parse('每周一三五九点检查').repeatRule.weekdays), [1, 3, 5]);
assert.deepEqual(Array.from(parse('每周一到周五8点检查').repeatRule.weekdays), [1, 2, 3, 4, 5]);
for (const content of ['每小时8点检查', '每0天8点检查', '每天25点检查', '每月32号检查', '每年2月30日检查', '每年一一月1日检查', '每天农历8点提醒', '每天8点共五次']) assert.equal(parse(content), null, content);
assert.equal(parse('每天8点吃饭', { repeatRule: { enabled: true, type: 'weekly' } }), null, 'do not overwrite existing recurrence');
assert.equal(context.__tmExtractSemanticTaskDateSuggestion({ id: 'task', content: '整理资料', remark: '每天8点检查' }, base), null);

async function apply(ids, failure = false) {
    writes.length = reminders.length = order.length = 0; failWrite = failure;
    const task = { id: 'task', root_id: 'doc', content: '每天8点吃饭', completionTime: '', startDate: '', repeatRule: '', repeatState: {} };
    tasks.set(task.id, task);
    const item = parse(task.content);
    item.selectedWriteIds = ids;
    return context.__tmApplySemanticDateSuggestions([item]);
}
(async () => {
    let result = await apply(['repeatRule', 'reminder']);
    assert.deepEqual(Array.from(result.failures), []);
    assert.equal(result.repeatApplied, 1);
    assert.equal(writes.length, 1, 'first date and recurrence are one mutation');
    assert.equal(writes[0].patch.completionTime, '2026-10-24');
    assert.equal(writes[0].patch.repeatRule.type, 'daily');
    assert.deepEqual(order, ['task', 'reminder']);
    assert.equal(reminders[0].repeatMode, 'followTaskRepeat');
    assert.equal(reminders[0].taskRepeatRule.type, 'daily');
    assert.equal(reminders[0].times[0], '08:00');
    result = await apply(['repeatRule']); assert.equal(reminders.length, 0); assert.equal(result.repeatApplied, 1);
    result = await apply(['reminder']); assert.equal(writes.length, 0); assert.equal(reminders.length, 0); assert.equal(result.failures.length, 1);
    result = await apply(['repeatRule', 'reminder'], true); assert.equal(reminders.length, 0); assert.equal(result.repeatApplied, 0);
    failWrite = false;
    recognized = {};
    const existingDates = { id: 'both', content: '每天8点吃饭', startDate: '2026-10-24', completionTime: '2026-10-24' };
    const suggestions = await context.__tmCollectSemanticDateSuggestions([existingDates]);
    assert.equal(suggestions.items.length, 1, 'filled dates must not block adding recurrence');
    recognized = { both: { signature: suggestions.items[0].signature } };
    assert.equal((await context.__tmCollectSemanticDateSuggestions([existingDates])).items.length, 0, 'unchanged recurrence is deduplicated');
    assert.equal((await context.__tmCollectSemanticDateSuggestions([{ ...existingDates, content: '每2天8点吃饭' }])).items.length, 1);
    console.log('semantic recurrence parser, write ordering and deduplication tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
