'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const start = source.indexOf('    async function __tmFlushTaskIncrementalRefreshFromTx(');
const end = source.indexOf('\n    function __tmRequestCalendarRefresh(', start);
assert.ok(start >= 0 && end > start);
const flushSource = source.slice(start, end);
const flushMicrotasks = async () => {
    for (let index = 0; index < 20; index += 1) await Promise.resolve();
};

function createHarness(successAt) {
    const state = { externalTaskTxDirty: true, viewMode: 'checklist' };
    const targets = {
        docIds: ['doc'],
        blockIds: ['task'],
        meta: { committed: true, wholeScopeDirty: false },
        generation: 1,
    };
    const timers = [];
    let refreshCalls = 0;
    const context = vm.createContext({
        state,
        __tmTxTaskRefreshInFlight: false,
        __tmTxTaskRefreshTimer: null,
        __tmTxTaskRefreshAttemptCount: 0,
        __TM_TASK_TX_MAX_REFRESH_ATTEMPTS: 3,
        __tmTaskMutations: {
            hasPending: () => false,
            hasPendingForTask: () => false,
        },
        __tmSnapshotPendingTxRefreshTargets: () => targets,
        __tmGetTxRefreshRetryMeta: () => ({ allowRun: true }),
        __tmClassifyPendingTaskTxRefresh: async () => ({
            relevant: true,
            docIds: targets.docIds,
            blockIds: targets.blockIds,
            resolvedTaskIds: [],
            forceDocRefresh: true,
            committed: true,
        }),
        __tmScheduleCalendarRefetchFromTx: () => {},
        __tmRunAutoRefreshIfNeeded: async (options) => {
            refreshCalls += 1;
            options.onDeferred?.('task-store-changed');
            if (refreshCalls < successAt) return false;
            state.externalTaskTxDirty = false;
            return true;
        },
        __tmFlushDeferredViewRefreshAfterTaskFieldWork: () => {},
        setTimeout(callback, delay) {
            timers.push({ callback, delay });
            return timers.length;
        },
        clearTimeout(timer) {
            const entry = timers[timer - 1];
            if (entry) entry.cancelled = true;
        },
    });
    vm.runInContext(`${flushSource}
this.flush = __tmFlushTaskIncrementalRefreshFromTx;`, context);
    return {
        context,
        state,
        targets,
        timers,
        refreshCalls: () => refreshCalls,
        nextTimer: async () => {
            while (timers.length && timers[0].cancelled) timers.shift();
            assert.ok(timers.length, 'a retry timer must be scheduled');
            const timer = timers.shift();
            timer.callback();
            await flushMicrotasks();
            return timer.delay;
        },
    };
}

test('stale task-store reads get bounded retries and one final quiet retry before converging', async () => {
    const harness = createHarness(4);
    assert.equal(await harness.context.flush({ commitView: false }), false);
    assert.equal(await harness.nextTimer(), 400);
    assert.equal(await harness.nextTimer(), 400);
    assert.equal(await harness.nextTimer(), 1200);
    assert.equal(harness.state.externalTaskTxDirty, false);
    assert.equal(harness.refreshCalls(), 4);
    assert.equal(harness.timers.length, 0);
});

test('the final retry is still bounded and reports exhaustion without polling forever', async () => {
    const harness = createHarness(99);
    assert.equal(await harness.context.flush({ commitView: false }), false);
    assert.equal(await harness.nextTimer(), 400);
    assert.equal(await harness.nextTimer(), 400);
    assert.equal(await harness.nextTimer(), 1200);
    assert.equal(harness.state.externalTaskTxDirty, true);
    assert.equal(harness.refreshCalls(), 4);
    assert.equal(harness.timers.length, 0);
});

console.log('task refresh convergence behavioral tests passed');
