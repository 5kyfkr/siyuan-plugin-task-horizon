'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/task-horizon/main/task-runtime/54-recurring-task-runtime.js'), 'utf8');
const start = source.indexOf('    let __tmRecurringDueReconcilePromise = null;');
const end = source.indexOf('    window.tmGetTaskRepeatRule =', start);
assert.ok(start > 0 && end > start);
const reads = [], advanced = [];
let release;
const blocked = new Promise(resolve => { release = resolve; });
const tasks = {
    a: { id: 'a', done: false, repeatState: {} },
    b: { id: 'b', done: false, repeatState: {} },
    terminal: { id: 'terminal', done: true, repeatState: { lastCompletionId: 'last' }, repeatHistory: [{ id: 'last', sourceDue: '2026-10-21', nextDue: '', nextStart: '' }] },
    held: { id: 'held', done: true, repeatState: { pendingNativeDoneReset: true, lastCompletionId: 'held-done' }, repeatHistory: [{ id: 'held-done', nextDue: '2026-10-22' }] },
};
const links = [];
const context = vm.createContext({ Map, Set, Date, Promise,
    __tmNormalizeDateOnly: () => '2026-10-21',
    __tmResolveTaskForRepeat: async id => { reads.push(id); if (id === 'a') await blocked; return tasks[id]; },
    __tmNormalizeTaskRepeatState: value => value || {},
    __tmGetTaskRepeatRule: () => ({ enabled: true, type: 'daily', trigger: 'due' }),
    __tmIsCheckinTask: () => false,
    __tmIsTaskNativeDone: task => task.done,
    __tmAdvanceRecurringTaskAfterCompletion: id => { advanced.push(id); return true; },
    __tmBuildTaskCompletionPlan: (task, _intent, options) => ({ receipt: { completionId: options.operationId } }),
    __tmSynchronizeCompletionLinks: async (task, receipt) => { links.push([task.id, receipt.completionId]); },
    __tmGetRecurringNativeDoneResetDateKey: () => '2026-10-22',
    __tmIsRecurringNativeDoneHeld: () => true,
    __tmResetRecurringNativeDoneIfDue: async () => false,
});
vm.runInContext(source.slice(start, end) + '\nthis.reconcile = __tmReconcileRecurringTasksOnLoad;', context);
async function run() {
    const first = context.reconcile(['a']);
    const second = context.reconcile(['b']);
    release();
    await Promise.all([first, second]);
    assert.deepEqual(reads, ['a', 'b'], 'a concurrent scope must join the pending IDs, not disappear');
    assert.deepEqual(advanced, [], 'loading overdue unfinished tasks cannot consume rounds');
    reads.length = 0;
    await context.reconcile(['b', 'b']);
    assert.deepEqual(reads, ['b'], 'one scope deduplicates its tasks');
    await context.reconcile(['terminal', 'held']);
    assert.deepEqual(links, [['terminal', 'last'], ['held', 'held-done']], 'link repair must run even before a held checkbox is due to reset');
    assert.deepEqual(advanced, [], 'loading a completed terminal occurrence cannot undo or advance it');
    console.log('recurrence reconciliation merges scopes without advancing unfinished tasks');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
