'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
execFileSync(process.execPath, [path.join(__dirname, 'sync-kernel-recurrence.js'), '--check']);
const source = fs.readFileSync(path.join(root, 'src/ai/agent-workbench.js'), 'utf8');
const extract = name => {
    const match = source.match(new RegExp(`    (?:async )?function ${name}\\(`));
    assert.ok(match, name);
    return source.slice(match.index, source.indexOf('\n    }', match.index) + 6);
};
const events = [], completions = [];
const context = vm.createContext({
    JSON, Object, Array, String, Number, Set,
    text: value => String(value || '').trim(),
    esc: value => String(value || ''),
    parseDomainResult: value => JSON.parse(value).data || JSON.parse(value),
    normalizeToolName: value => value,
    renderResultRows: rows => rows.map(row => `${row.label}=${row.value}`).join(';'),
    aiBridge: () => ({ refreshTaskMutation() {}, applyTaskCompletionReceipt: (_task, receipt) => completions.push(receipt) }),
    collectTaskMutationRefresh: value => value.refresh,
    containsScheduleMutation: () => false,
    SCHEDULE_MUTATION_TOOLS: new Set(),
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    window: { dispatchEvent: event => events.push(event) },
});
vm.runInContext([
    'isScheduledEventListIntent', 'isScheduledEventHelpIntent', 'isScheduledEventCreateIntent',
    'isReminderModeChoiceIntent', 'reminderIntentInstruction', 'renderDomainResult', 'applyDomainResultEffects',
].map(extract).join('\n'), context);

assert.equal(context.reminderIntentInstruction('每天9点整理文件'), '');
assert.equal(context.reminderIntentInstruction('设置每天循环，不要提醒'), '');
assert.match(context.reminderIntentInstruction('每天9点提醒我整理文件'), /patch\.followReminder\.times/);
assert.doesNotMatch(context.reminderIntentInstruction('每周五通知我提交周报'), /必须先调用思源 question/);

async function run() {
    const data = {
        task: { id: 'synthetic-task', title: '整理文件', done: false, completionTime: '2026-10-26', hasReminder: true,
            reminder: { repeatMode: 'followTaskRepeat', times: ['09:00'], taskCompletionTime: '2026-10-26' } },
        repeatSummary: '到期后每天',
        changes: { reminder: {} },
        completion: { advanced: true, completionId: 'synthetic-completion' },
        refresh: { kind: 'task-mutation' },
    };
    const result = JSON.stringify({ ok: true, data });
    const rendered = context.renderDomainResult('update_task', result);
    assert.match(rendered, /本轮已完成，已进入下一轮/);
    assert.match(rendered, /到期后每天/);
    assert.match(rendered, /09:00 · 跟随每轮任务日期/);
    const checkinRendered = context.renderDomainResult('update_task', JSON.stringify({ ok: true, data: {
        ...data, completion: null, repeatSummary: '打卡每周', task: { ...data.task, done: true, completionTime: '', repeatRule: { trigger: 'checkin', anchorDate: '2026-10-26' } },
    } }));
    assert.match(checkinRendered, /打卡计划已设置/);
    assert.match(checkinRendered, /计划起始=2026-10-26/);
    assert.match(checkinRendered, /跟随打卡计划/);
    await context.applyDomainResultEffects('update_task', result);
    assert.equal(completions.length, 1);
    assert.equal(events.find(event => event.type === 'tomato-reminder-updated').detail.reminder.taskCompletionTime, '2026-10-26');
    const batch = JSON.stringify({ ok: true, data: { items: [{ ok: true, kind: 'task:update', changes: data }] } });
    await context.applyDomainResultEffects('batch_tasks', batch);
    assert.equal(completions.length, 2, 'batch receipts must also synchronize completed reminder occurrences');
    console.log('workbench explicit reminder intent, recurrence receipt and Tomato notifications passed');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
