'use strict';

const assert = require('node:assert/strict');
const { createHarness, IDS } = require('./kernel-contract.test.js');

async function run() {
    // Isolated in-memory tasks only; no requests are sent to a SiYuan workspace.
    const host = createHarness();
    await host.start();
    const update = async patch => {
        if (patch.done === true && !patch.expectedOccurrenceId) patch = { ...patch, expectedOccurrenceId: (await read()).occurrenceId };
        return JSON.parse(JSON.stringify(await host.call('taskHorizonUpdateTask', IDS.firstTask, patch, { agentWrite: true })));
    };
    const attrs = () => ({ ...host.attrs.get(IDS.firstTask) });
    const read = async () => (await host.call('taskHorizonGetTask', IDS.firstTask)).data;
    const daily = { enabled: true, type: 'daily', trigger: 'due', every: 1, anchorDate: '2026-10-25', maxOccurrences: 2 };

    for (const repeatRule of ['bad', { ...daily, every: 0 }, { ...daily, until: 'not-a-date' }, { ...daily, maxOccurrences: -1 }]) {
        assert.equal((await update({ repeatRule })).ok, false, 'invalid recurrence must be rejected');
    }
    assert.equal((await update({ repeatState: { occurrenceCount: 9 } })).ok, false, 'AI must not author runtime state');
    let result = await update({ repeatRule: daily, completionTime: '2026-10-25' });
    assert.equal(result.ok, true);
    assert.equal(result.data.task.repeatState.occurrenceCount, 1);
    assert.equal(result.data.task.hasReminder, false, 'a recurrence never implies a reminder');

    const snapshot = attrs();
    result = await update({ repeatRule: { ...daily, every: 2 }, followReminder: { times: ['25:00'], intentText: '每天提醒我整理文件' } });
    assert.equal(result.ok, false);
    assert.deepEqual(attrs(), snapshot, 'invalid reminder must not leave a changed rule');
    for (const intentText of ['每天9点整理文件', '每天整理文件，不要提醒']) {
        assert.equal((await update({ followReminder: { times: ['09:00'], intentText } })).ok, false);
    }

    result = await update({ repeatRule: daily, followReminder: { times: ['18:00', '09:00'], intentText: '每天提醒我整理文件，共两轮' } });
    assert.equal(result.ok, true);
    assert.equal(result.data.task.reminder.repeatMode, 'followTaskRepeat');
    assert.deepEqual(result.data.task.reminder.times, ['09:00', '18:00']);
    assert.equal(result.data.task.reminder.taskRepeatState.occurrenceId, result.data.task.repeatState.occurrenceId);
    assert.match(result.data.repeatSummary, /每天/);

    const completedOccurrenceId = (await read()).occurrenceId;
    result = await update({ done: true });
    assert.equal(result.ok, true);
    assert.equal(result.data.task.done, false, 'completing the current round must leave the next round open');
    assert.equal(result.data.task.completionTime, '2026-10-26');
    assert.equal(result.data.task.repeatHistory.length, 1);
    assert.equal(result.data.task.repeatHistory[0].before.done, false);
    assert.equal(result.data.task.reminder.taskCompletionTime, '2026-10-26');
    assert.equal(result.data.task.reminder.taskRepeatState.occurrenceId, result.data.task.repeatState.occurrenceId);
    assert.equal(result.data.completion.advanced, true);
    const duplicate = await update({ done: true, expectedOccurrenceId: completedOccurrenceId });
    assert.equal(duplicate.data.completion.outcome, 'alreadyApplied');
    assert.equal(duplicate.data.task.repeatHistory.length, 1);

    // Tomato's real completion bridge enriches the reminder after the task
    // transaction. Its derived receipt must not make the task undo conflict.
    const enriched = JSON.parse(host.attrs.get(IDS.firstTask)['custom-tomato-reminder']);
    enriched.updatedAt = '2026-10-25T12:00:00+08:00';
    enriched.taskCompletionOwner = { completionId: result.data.completion.completionId };
    enriched.completedOccurrences = [{ date: '2026-10-25', time: '09:00', completionId: result.data.completion.completionId }];
    host.attrs.get(IDS.firstTask)['custom-tomato-reminder'] = JSON.stringify(enriched);

    const undo = await host.call('taskHorizonUndoLastMutation', { undoID: result.data.undoID });
    assert.equal(undo.ok, true);
    let task = await read();
    assert.equal(task.completionTime, '2026-10-25');
    assert.equal((task.repeatHistory || []).length, 0);
    assert.equal(task.reminder.taskCompletionTime, '2026-10-25');

    await update({ done: true });
    result = await update({ done: true });
    assert.equal(result.data.task.done, true, 'the last round must remain complete');
    assert.equal(result.data.task.repeatHistory.length, 2);
    assert.equal(result.data.task.reminder.completed, true, 'the last round must stop future reminders');

    result = await update({ repeatRule: { ...daily, type: 'weekly', weekdays: [1, 3, 5], maxOccurrences: 4 }, done: false });
    assert.equal(result.ok, true);
    assert.equal(result.data.task.repeatState.occurrenceCount, 1);
    assert.deepEqual(result.data.task.reminder.times, ['09:00', '18:00'], 'changing the recurrence preserves existing reminder times');
    assert.equal(result.data.task.reminder.taskRepeatRule.type, 'weekly');
    assert.equal(result.data.task.reminder.completed, false);

    const beforeFailure = attrs();
    host.failTransactionOnce();
    result = await update({ repeatRule: { ...daily, type: 'monthly' }, followReminder: { times: ['10:00'], intentText: '每月提醒我' } });
    assert.equal(result.ok, false);
    assert.deepEqual(attrs(), beforeFailure, 'the rule and reminder must fail together');

    const restarted = createHarness({ initialAttrs: new Map(host.attrs) });
    for (const [id, block] of host.blocks) restarted.blocks.set(id, { ...block });
    await restarted.start();
    const restored = (await restarted.call('taskHorizonGetTask', IDS.firstTask)).data;
    assert.equal(restored.repeatRule.type, 'weekly');
    assert.equal(restored.reminder.taskCompletionTime, restored.completionTime);
    assert.deepEqual(Array.from(restored.reminder.times), ['09:00', '18:00'], 'restart must retain the configured follow reminder');

    result = await update({ repeatRule: { enabled: false, type: 'none' } });
    assert.equal(result.ok, true);
    assert.equal(result.data.task.reminder.taskRepeatRule, null);
    assert.deepEqual(result.data.task.reminder.times, ['09:00', '18:00']);

    const count = host.blocks.size;
    const failedCreate = await host.call('taskHorizonCreateTask', {
        title: 'synthetic invalid date', documentID: IDS.doc, options: { agentWrite: true },
        patch: { repeatRule: daily, completionTime: 'invalid-date' },
    });
    assert.equal(failedCreate.ok, false);
    assert.equal(host.blocks.size, count, 'a failed compound create must remove the inserted block');
    const created = await host.call('taskHorizonCreateTask', {
        title: 'synthetic recurring reminder', documentID: IDS.doc, options: { agentWrite: true },
        patch: { repeatRule: daily, completionTime: '2026-10-25', followReminder: { times: ['09:00'], intentText: '每天9点提醒我整理文件' } },
    });
    assert.equal(created.ok, true);
    assert.equal(created.data.task.reminder.taskRepeatRule.type, 'daily');
    const cleared = await host.call('taskHorizonConfigureTaskReminder', { action: 'apply', operation: 'clear', taskID: created.data.task.id });
    assert.equal(cleared.ok, true);
    assert.equal(cleared.data.task.completionTime, '2026-10-25');
    assert.equal(cleared.data.task.repeatRule.type, 'daily');

    for (const [rule, date, expected] of [
        [{ type: 'weekly', weekdays: [1, 3, 5] }, '2026-10-26', '2026-10-28'],
        [{ type: 'monthly', monthDays: [15, -1] }, '2026-10-31', '2026-11-15'],
        [{ type: 'yearly' }, '2024-02-29', '2025-02-28'],
        [{ type: 'workday' }, '2026-10-30', '2026-11-02'],
    ]) {
        const fixture = createHarness(); await fixture.start();
        const setup = await fixture.call('taskHorizonUpdateTask', IDS.firstTask, {
            repeatRule: { enabled: true, trigger: 'due', anchorDate: date, ...rule }, completionTime: date,
        }, { agentWrite: true });
        assert.equal(setup.ok, true, JSON.stringify(setup));
        const finished = await fixture.call('taskHorizonUpdateTask', IDS.firstTask, { done: true, expectedOccurrenceId: setup.data.task.occurrenceId }, { agentWrite: true });
        assert.equal(finished.ok, true, JSON.stringify(finished));
        assert.equal(finished.data.task.completionTime, expected);
    }
    const completionBased = await update({ repeatRule: { type: 'daily', trigger: 'complete', every: 3, anchorDate: '2026-10-25' }, completionTime: '2026-10-25' });
    assert.equal(completionBased.ok, true);
    const completeAfter = await update({ done: true });
    const completedDate = completeAfter.data.task.repeatHistory[0].completedAt.slice(0, 10);
    const plusThreeDays = new Date(`${completedDate}T12:00:00`); plusThreeDays.setDate(plusThreeDays.getDate() + 3);
    assert.equal(completeAfter.data.task.completionTime, `${plusThreeDays.getFullYear()}-${String(plusThreeDays.getMonth() + 1).padStart(2, '0')}-${String(plusThreeDays.getDate()).padStart(2, '0')}`);
    const reminderEdit = await update({ followReminder: { times: ['09:00'], intentText: '每天9点提醒我' } });
    const changedByUser = JSON.parse(host.attrs.get(IDS.firstTask)['custom-tomato-reminder']);
    changedByUser.times = ['10:00'];
    host.attrs.get(IDS.firstTask)['custom-tomato-reminder'] = JSON.stringify(changedByUser);
    const unsafeUndo = await host.call('taskHorizonUndoLastMutation', { undoID: reminderEdit.data.undoID });
    assert.equal(unsafeUndo.ok, false, 'undo must still protect a later user edit to reminder times');
    assert.equal(unsafeUndo.error.code, 'CONFLICT');
    console.log('agent recurrence, explicit reminder intent, atomic writes, completion and undo passed');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
