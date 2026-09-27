'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'),
    'utf8',
);
const start = source.indexOf('let __tmSqlTransactionFlushInFlight = null;');
const end = source.indexOf('async function __tmBuildInjectedTasksByDocFromBlockIds', start);
assert.notEqual(start, -1, 'flush single-flight state must exist');
assert.notEqual(end, -1, 'flush helper boundary must remain inspectable');

const gate = {};
gate.promise = new Promise((resolve) => { gate.resolve = resolve; });
let calls = 0;
const context = vm.createContext({
    API: {
        call(pathname) {
            calls += 1;
            assert.equal(pathname, '/api/sqlite/flushTransaction');
            return gate.promise;
        },
    },
    console,
    setTimeout(callback) {
        callback();
        return 1;
    },
    clearTimeout() {},
});
context.globalThis = context;
vm.runInContext(`${source.slice(start, end)}\nglobalThis.flushSqlTransactions = __tmFlushSqlTransactionsSafe;`, context);

const first = context.flushSqlTransactions('load-all-documents');
const second = context.flushSqlTransactions('detail-refresh');
assert.equal(calls, 1, 'concurrent callers must share one SQLite flush request');
gate.resolve({ code: 0 });

Promise.all([first, second]).then(async (results) => {
    assert.deepEqual(results, [true, true]);
    const third = context.flushSqlTransactions('after-previous-completed');
    assert.equal(calls, 2, 'a later flush must still run after the shared request completes');
    assert.equal(await third, true);
    console.log('task flush coalescing behavior tests passed');
}).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
