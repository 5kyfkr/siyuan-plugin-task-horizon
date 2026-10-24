'use strict';

const assert = require('node:assert/strict');
const { createHarness, IDS } = require('./kernel-contract.test.js');
const clone = value => JSON.parse(JSON.stringify(value));

async function run() {
    // Cover every native repeat-dialog mode with isolated in-memory tasks.
    const rules = [];
    for (const trigger of ['due', 'complete', 'checkin']) {
        for (const type of ['daily', 'workday', 'weekly', 'monthly', 'yearly']) {
            rules.push({ trigger, type, every: 2, anchorDate: '2026-10-25', maxOccurrences: 4 });
        }
    }
    for (const trigger of ['due', 'checkin']) {
        rules.push({ trigger, type: 'weekly', weekdays: [1, 3, 5], anchorDate: '2026-10-26', until: '2027-10-26' });
        rules.push({ trigger, type: 'monthly', monthlyMode: 'date', monthDays: [1, 15, -1], anchorDate: '2026-10-25' });
        for (const ordinal of [1, 5, -1]) rules.push({ trigger, type: 'monthly', monthlyMode: 'weekday', monthWeek: { ordinal, weekday: 5 }, anchorDate: '2026-10-25' });
        for (const type of ['monthly', 'yearly']) rules.push({ trigger, type, calendarMode: 'lunar', anchorDate: '2026-10-25' });
    }
    rules.push({ type: 'fsrs', anchorDate: '2026-10-25' });
    for (const input of rules) {
        const host = createHarness(); await host.start();
        const update = async patch => clone(await host.call('taskHorizonUpdateTask', IDS.firstTask, patch, { agentWrite: true }));
        const result = await update({ repeatRule: { enabled: true, ...input }, completionTime: '2026-10-25' });
        assert.equal(result.ok, true, JSON.stringify({ input, error: result.error }));
        const task = result.data.task;
        assert.equal(task.repeatRule.type, input.type);
        assert.equal(task.repeatRule.trigger, input.type === 'fsrs' ? 'complete' : input.trigger);
        assert.equal(task.hasReminder, false, 'a custom repeat mode must never imply a reminder');
        assert.equal(task.startDate, '');
        if (input.trigger === 'checkin') {
            assert.equal(task.completionTime, '', 'check-in plans own their dates through anchorDate');
            assert.equal(task.repeatState.lastInstanceDue, '');
            assert.equal(task.repeatRule.anchorDate, input.anchorDate);
        }
        if (input.type === 'fsrs') {
            assert.equal(task.repeatState.version, 2);
            assert.equal(task.repeatState.fsrsCard.reps, 0);
            assert.equal(task.repeatState.fsrsCard.state, 0);
            assert.match(task.repeatState.fsrsCard.due, /^2026-10-25T/);
        }
        if (input.weekdays) assert.deepEqual(task.repeatRule.weekdays, input.weekdays);
        if (input.monthDays) assert.deepEqual(task.repeatRule.monthDays, input.monthDays);
        if (input.monthWeek) assert.deepEqual(task.repeatRule.monthWeek, input.monthWeek);
        if (input.calendarMode) assert.equal(task.repeatRule.calendarMode, input.calendarMode);
        const repeated = await update({ repeatRule: task.repeatRule });
        assert.equal(repeated.ok, true, 'the canonical rule returned by get_task must be writable again');
        assert.equal(repeated.data.task.repeatState.occurrenceId, task.repeatState.occurrenceId);
        if (input.type === 'fsrs') assert.deepEqual(repeated.data.task.repeatState.fsrsCard, task.repeatState.fsrsCard);
    }

    const host = createHarness(); await host.start();
    const update = async patch => clone(await host.call('taskHorizonUpdateTask', IDS.firstTask, patch, { agentWrite: true }));
    let result = await update({
        repeatRule: { type: 'weekly', trigger: 'checkin', weekdays: [1, 3, 5], anchorDate: '2026-10-26', maxOccurrences: 12 },
        followReminder: { times: ['09:00'], intentText: '每周一三五打卡，9点提醒我' },
    });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.data.task.completionTime, '');
    assert.equal(result.data.task.reminder.taskCompletionTime, '');
    assert.equal(result.data.task.reminder.startDate, '2026-10-26');
    assert.equal(result.data.task.reminder.taskRepeatRule.trigger, 'checkin');
    const state = { ...result.data.task.repeatState, checkinHistory: [{ scheduledDate: '2026-10-26', checkedAt: '2026-10-26T10:00:00+08:00' }] };
    await host.call('taskHorizonUpdateTask', IDS.firstTask, { repeatState: state });
    result = await update({ repeatRule: { ...result.data.task.repeatRule, maxOccurrences: 20 } });
    assert.equal(result.ok, true);
    assert.equal(result.data.task.repeatState.checkinHistory.length, 1, 'changing a plan preserves existing check-in records');
    assert.equal(result.data.task.reminder.taskCompletionTime, '');
    assert.equal(result.data.task.reminder.startDate, '2026-10-26');
    result = clone(await host.call('taskHorizonConfigureTaskReminder', {
        action: 'apply', operation: 'set', taskID: IDS.firstTask, mode: 'follow_task', follow: { times: ['10:00'] },
    }));
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.data.task.completionTime, '');
    assert.equal(result.data.reminder.startDate, '2026-10-26');
    const restarted = createHarness({ initialAttrs: new Map(host.attrs) }); await restarted.start();
    const restored = (await restarted.call('taskHorizonGetTask', IDS.firstTask)).data;
    assert.equal(restored.repeatRule.trigger, 'checkin');
    assert.equal(restored.completionTime, '');
    assert.equal(restored.repeatState.checkinHistory.length, 1);
    const invalidEnd = await update({ repeatRule: { type: 'daily', trigger: 'checkin', anchorDate: '2026-10-26', until: '2026-10-25' } });
    assert.equal(invalidEnd.ok, false);
    for (const repeatRule of [{ type: 'daily', trigger: 'checkin', anchorDate: '2026-10-25' }, { type: 'fsrs' }]) {
        const created = await host.call('taskHorizonCreateTask', {
            title: 'synthetic custom recurrence', documentID: IDS.doc, options: { agentWrite: true }, patch: { repeatRule, done: false },
        });
        assert.equal(created.ok, true, JSON.stringify(created));
        assert.equal(created.data.task.done, false);
        assert.equal(created.data.task.repeatRule.trigger, repeatRule.type === 'fsrs' ? 'complete' : 'checkin');
    }
    console.log(`AI custom repeat setting coverage passed (${rules.length} native rule combinations, check-in reminders and restart)`);
}
run().catch(error => { console.error(error); process.exitCode = 1; });
