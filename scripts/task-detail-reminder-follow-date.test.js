'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../src/task-horizon/main');
const api = fs.readFileSync(path.join(root, '20-api-and-runtime-services.js'), 'utf8');
const detail = fs.readFileSync(path.join(root, 'task-runtime/52-task-detail-runtime.js'), 'utf8');
const slice = (source, from, to) => {
    const start = source.indexOf(from);
    const end = source.indexOf(to, start + from.length);
    assert.ok(start >= 0 && end > start, from);
    return source.slice(start, end);
};
const date = '2026-11-25';
class TestDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-11-21T12:00:00'])); }
    static now() { return new TestDate().getTime(); }
}
const context = vm.createContext({
    Date: TestDate,
    __tmT: (key, args) => args ? `${args.value1}/${args.value2}` : key,
    __tmNormalizeDateOnly: value => context.__tmNormalizeReminderDateKey(value),
    __tmResolveTaskBindingFromAnyBlockId: async () => ({ taskId: 'task', attrHostId: 'host' }),
    HTMLInputElement: class Input { constructor(value) { this.value = value; } },
    HTMLElement: class Element {
        classList = { toggle() {} };
        setAttribute() {}
        removeAttribute() {}
    },
    __tmFormatTaskDetailShortDate: value => value,
    __tmRenderLucideIcon: () => '',
    esc: value => value,
});
vm.runInContext(slice(api, '    const __tmReminderMarkCache', '    function __tmHasReminderMark'), context);
vm.runInContext(slice(detail, '    function __tmFormatTaskDetailReminderText', '    let __tmStandaloneTaskTimeHub'), context);
const mountedTask = { id: 'task', attrHostId: 'host', completionTime: date };
let hiddenDue = date;
const data = {
    enabled: true,
    blockId: 'host',
    repeatMode: 'followTaskRepeat',
    interval: 'once',
    startDate: date,
    taskCompletionTime: date,
    times: ['09:00', '18:30'],
};
context.__tomatoReminder = { getBlocks: async () => [data] };
context.getBoundTask = () => mountedTask;
context.taskId = mountedTask.id;
const face = new context.HTMLElement();
context.root = { querySelector: selector => {
    if (selector.includes('completionTime')) return new context.HTMLInputElement(hiddenDue);
    if (selector.includes('timeHub')) return face;
    return null;
} };
context.readTimeHubScheduleText = context.readRepeatSummaryValue = () => '';
vm.runInContext(
    slice(detail, '        const readHiddenInputValue =', '        const readRepeatSummaryValue =')
    + slice(detail, '        const syncTimeHubTriggerFace =', '        const syncRepeatChipFace =')
    + '\nthis.readReminderDisplayValue = readReminderDisplayValue; this.readReminderTooltipValue = readReminderTooltipValue; this.syncTimeHubTriggerFace = syncTimeHubTriggerFace;',
    context
);

async function run() {
    const { __tmGetTaskReminderSnapshotByAnyId: load, __tmPeekTaskReminderSnapshotByAnyId: peek } = context;
    const initial = await load(mountedTask);
    assert.equal(initial.displayAt.getDate(), 25);
    assert.equal(context.readReminderDisplayValue(), '09:00');

    hiddenDue = '2026-11-26';
    assert.equal(context.readReminderTooltipValue(), 'ai.warnings：11/26 09:00', 'the open detail uses the edited date immediately');
    context.syncTimeHubTriggerFace();
    assert.match(face.innerHTML, /2026-11-26 \u00b7 09:00/, 'the mounted detail shows the updated date with the reminder time');
    assert.ok(!face.innerHTML.includes(date));
    assert.equal(peek({ ...mountedTask, completionTime: hiddenDue }).displayAt.getDate(), 26);
    assert.equal((await load({ ...mountedTask, completionTime: hiddenDue }, { force: true })).displayAt.getDate(), 26,
        'a fresh load can still return reminder data with the old date');
    hiddenDue = '2026-11-24';
    assert.equal(context.readReminderTooltipValue(), 'ai.warnings：11/24 09:00', 'moving earlier ignores the old reminder start date');
    hiddenDue = '';
    assert.equal(context.readReminderDisplayValue(), '', 'clearing the deadline leaves no reminder date in the detail');
    hiddenDue = date;
    assert.equal(context.readReminderDisplayValue(), '09:00', 'restoring the deadline restores the displayed reminder');
    assert.equal(data.startDate, date);
    assert.equal(peek('host').displayAt.getDate(), 25, 'optimistic projections must not overwrite the underlying cached reminder');

    const earlier = await load({ id: 'task', completion_time: '2026-11-20' });
    assert.equal(earlier.displayAt.getDate(), 20);
    assert.equal(earlier.kind, 'last');
    assert.equal(earlier.displayAt.getHours(), 18);

    data.excludedOccurrences = [{ date: '2026-11-26', time: '09:00' }];
    hiddenDue = '2026-11-26';
    await load(mountedTask, { force: true });
    assert.equal(context.readReminderDisplayValue(), '18:30', 'excluded occurrences still apply on the new date');

    data.taskCompletionTime = '2026-11-27';
    assert.equal((await load('host', { force: true })).displayAt.getDate(), 27, 'bridge callers also use the latest task date in the record');
    data.repeatMode = 'manual';
    const independent = await load(mountedTask, { force: true });
    assert.equal(peek({ ...mountedTask, completionTime: hiddenDue }), independent);
    assert.equal(context.readReminderDisplayValue(), independent.displayText, 'independent reminders retain their own date');

    data.repeatMode = 'followTaskRepeat';
    data.taskRepeatRule = { enabled: true, type: 'daily', anchorDate: date };
    assert.equal((await load({ ...mountedTask, completionTime: '2026-11-24' }, { force: true })).displayAt.getDate(), 24,
        'recurring reminders also follow an earlier deadline');

    data.taskRepeatRule = { ...data.taskRepeatRule, trigger: 'checkin' };
    context.__tmNormalizeTaskRepeatState = () => ({ checkinHistory: [] });
    const checkin = await load(mountedTask, { force: true });
    assert.equal(checkin.displayAt.getDate(), 25);
    assert.equal(peek({ ...mountedTask, completionTime: '' }), checkin, 'check-in reminders keep their recurrence anchor');

    context.__tomatoReminder = { getBlocks: async () => [] };
    const legacy = { ...data, taskCompletionTime: undefined, taskRepeatRule: null };
    context.API = { call: async () => ({ code: 0, data: { 'custom-tomato-reminder': JSON.stringify(legacy) } }) };
    assert.equal((await load('host', { force: true })).displayAt.getDate(), 25, 'older reminders use the saved date when the task is unavailable');
    assert.equal((await load('host', { force: true })).hasReminder, true);
    assert.equal((await load({ ...mountedTask, completionTime: '' })).displayAt, null, 'an explicit clear takes precedence over a legacy saved date');
    console.log('task detail follow reminder date tests passed');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
