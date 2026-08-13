'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'task-horizon', 'main', '20-api-and-runtime-services.js'), 'utf8');
const start = source.indexOf('    const __tmTaskWriteSignature =');
const end = source.indexOf('\n    function __tmGetMutationStatus()', start);
assert.ok(start >= 0 && end > start, 'task write barrier must remain extractable');
const block = source.slice(start, end);

const normalizeRule = (input) => {
    const raw = input && typeof input === 'object' ? input : {};
    const enabled = raw.enabled === true && String(raw.type || 'none') !== 'none';
    return {
        enabled,
        type: enabled ? String(raw.type || 'daily') : 'none',
        every: Math.max(1, Number(raw.every) || 1),
        weekdays: Array.isArray(raw.weekdays) ? raw.weekdays : [],
        monthlyMode: String(raw.monthlyMode || 'date'),
        calendarMode: String(raw.calendarMode || 'solar'),
        until: String(raw.until || ''),
        maxOccurrences: Math.max(0, Number(raw.maxOccurrences) || 0),
        anchorDate: String(raw.anchorDate || ''),
    };
};

const buildContext = (taskRef) => {
    const context = vm.createContext({
        Date,
        setTimeout,
        clearTimeout,
        __tmActiveMutations: new Map(),
        __tmEnsureQueuedOpPromise: (op) => op.promise,
        __tmMutationGetTask: () => context.task,
        __tmGetTaskRepeatRule: (task) => normalizeRule(task?.repeatRule || task),
        __tmRuntimeState: { getTaskIdAliases: () => [] },
        state: { flatTasks: {} },
    });
    context.task = {
        id: taskRef,
        startDate: '2026-08-01',
        completionTime: '2026-08-03',
        repeatRule: {
            enabled: true,
            type: 'daily',
            every: 1,
            anchorDate: '2026-08-03',
        },
    };
    vm.runInContext(`${block}\nthis.waitForTaskWrites = __tmWaitForTaskWrites;`, context);
    return context;
};

(async () => {
    const context = buildContext('task-1');
    let settleWrite;
    const activeWrite = {
        id: 'write-1',
        type: 'taskPatch',
        status: 'running',
        data: { taskId: 'task-1' },
        promise: new Promise((resolve) => { settleWrite = resolve; }),
    };
    context.__tmActiveMutations.set(activeWrite.id, activeWrite);
    setTimeout(() => {
        context.__tmActiveMutations.delete(activeWrite.id);
        settleWrite(true);
    }, 120);
    const waitStartedAt = Date.now();
    const waited = await context.waitForTaskWrites('task-1', {
        expected: {
            startDate: '2026-08-01',
            completionTime: '2026-08-03',
            repeatRule: context.task.repeatRule,
        },
        timeoutMs: 1000,
    });
    assert.equal(waited.ok, true, 'barrier must wait for the matching task write and validate fields');
    assert.ok(Date.now() - waitStartedAt >= 100, 'barrier must not ignore the unified taskPatch writer');

    const unrelated = buildContext('task-2');
    unrelated.__tmActiveMutations.set('other-write', {
        id: 'other-write',
        type: 'taskPatch',
        status: 'running',
        data: { taskId: 'other-task' },
        promise: new Promise(() => {}),
    });
    const unrelatedResult = await unrelated.waitForTaskWrites('task-2', {
        expected: { completionTime: '2026-08-03' },
        timeoutMs: 300,
    });
    assert.equal(unrelatedResult.ok, true, 'barrier must ignore unrelated task writes');

    const mismatch = buildContext('task-3');
    mismatch.task.completionTime = '2026-08-04';
    const mismatchResult = await mismatch.waitForTaskWrites('task-3', {
        expected: { completionTime: '2026-08-03' },
        timeoutMs: 220,
    });
    assert.equal(mismatchResult.ok, false, 'barrier must fail closed when expected fields never settle');
    assert.equal(mismatchResult.code, 'TASK_WRITE_MISMATCH');

    console.log('task write barrier contract tests passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
