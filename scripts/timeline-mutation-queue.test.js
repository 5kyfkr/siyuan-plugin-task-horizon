'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const services = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const start = services.indexOf('function __tmEnqueueTimelineMutation');
const end = services.indexOf('\n    let state = {', start);
assert.notEqual(start, -1, 'missing timeline mutation queue');
assert.notEqual(end, -1, 'missing timeline mutation queue boundary');

const context = {
    state: {
        timelineMutationTail: null,
        timelineMutationPending: 0,
        timelineMutationActive: false,
        timelineMutationActiveLabel: '',
    },
};
vm.createContext(context);
vm.runInContext(`${services.slice(start, end)}\nglobalThis.enqueueTimelineMutation = __tmEnqueueTimelineMutation;`, context);

(async () => {
    const order = [];
    let releaseFirst;
    const firstGate = new Promise((resolve) => { releaseFirst = resolve; });

    const first = context.enqueueTimelineMutation(async () => {
        order.push('first:start');
        await firstGate;
        order.push('first:end');
        return 'first';
    }, { label: 'first' });
    const failed = context.enqueueTimelineMutation(async () => {
        order.push('failed:start');
        throw new Error('expected failure');
    }, { label: 'failed' });
    const last = context.enqueueTimelineMutation(async () => {
        order.push('last:start');
        await Promise.resolve();
        order.push('last:end');
        return 'last';
    }, { label: 'last' });

    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(order, ['first:start'], 'later timeline writes must wait for the active write');
    assert.equal(context.state.timelineMutationPending, 3);
    assert.equal(context.state.timelineMutationActive, true);

    releaseFirst();
    const results = await Promise.allSettled([first, failed, last]);
    assert.deepEqual(order, ['first:start', 'first:end', 'failed:start', 'last:start', 'last:end']);
    assert.equal(results[0].status, 'fulfilled');
    assert.equal(results[1].status, 'rejected');
    assert.equal(results[2].status, 'fulfilled', 'a failed timeline write must not block the next write');

    await Promise.resolve();
    assert.equal(context.state.timelineMutationPending, 0);
    assert.equal(context.state.timelineMutationActive, false);
    assert.equal(context.state.timelineMutationTail, null);
    assert.equal(context.state.timelineMutationActiveLabel, '');
    console.log('timeline mutation queue tests passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
