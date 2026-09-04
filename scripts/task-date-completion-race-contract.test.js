'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const apiSource = read('src/task-horizon/main/20-api-and-runtime-services.js');
const calendarSource = read('src/task-horizon/main/render/48-render-calendar-support-runtime.js');
const tableSource = read('src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js');
const listSource = read('src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js');

const tableEntryStart = tableSource.indexOf('window.tmBeginCellEdit = function');
const tableEntryEnd = tableSource.indexOf("if (field === 'tomatoSummary'", tableEntryStart);
assert.ok(tableEntryStart >= 0 && tableEntryEnd > tableEntryStart, 'table cell entry must remain extractable');
const tableEntry = tableSource.slice(tableEntryStart, tableEntryEnd);
assert.match(tableEntry, /tmOpenTaskTimeHub\(id, td,[\s\S]*activeField: field/,
    'table date edits must use the shared task time hub');
assert.doesNotMatch(tableEntry, /wait:\s*true|background:\s*false/,
    'table date edits must rely on the shared pending-write barrier rather than a table-only mode');

assert.match(apiSource, /function __tmApplyTaskMetaPatchWithUndo\(taskId, patch, options = \{\}\) \{[\s\S]*__tmApplyTaskMetaPatchWithUndoCore\(taskId, patch, options\)[\s\S]*__tmTrackPendingTaskWrite\(taskId, request\)/,
    'all metadata field commits must reserve the task write ingress before identity resolution');
assert.match(calendarSource, /finishAfterPersist\(\)\.then\(/,
    'background date commits must retain their asynchronous confirmation path');

const completionStart = listSource.indexOf('async function __tmSetDoneFromUi');
const completionQueueStart = listSource.indexOf("const setDone = globalThis.__tmRequireTaskMutation?.('setDone')", completionStart);
assert.ok(completionStart >= 0 && completionQueueStart > completionStart, 'completion flow must remain extractable');
const statelessCompletion = listSource.slice(completionStart, listSource.indexOf('return await __tmSetDoneKernel', completionStart));
assert.match(statelessCompletion, /__tmWaitForPendingTaskWrites/,
    'stateless completion must wait for task writes that are still resolving identity');
assert.match(apiSource, /function __tmMutationSetDone\(taskId, done, options = \{\}\)[\s\S]*__tmWaitForPendingTaskWrites[\s\S]*return enqueue\(\);/,
    'the public setDone mutation must apply the same pending-write barrier');

const helperStart = apiSource.indexOf('const __tmPendingTaskWriteIntents = new Map();');
const helperEnd = apiSource.indexOf('const __tmTaskWriteSnapshotMatches =', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'pending task write helper must remain extractable');
const helper = apiSource.slice(helperStart, helperEnd);
const context = vm.createContext({
    Promise,
    Map,
    Set,
    Date,
    setTimeout,
    clearTimeout,
    __tmTaskWriteIds: (taskId) => new Set([String(taskId || '').trim()]),
});
vm.runInContext(`${helper}\nthis.track = __tmTrackPendingTaskWrite;\nthis.wait = __tmWaitForPendingTaskWrites;`, context);

(async () => {
    const events = [];
    let releaseDateWrite;
    const pendingDateWrite = new Promise((resolve) => { releaseDateWrite = resolve; });
    context.track('task-1', pendingDateWrite);
    const waiting = context.wait('task-1', { timeoutMs: 1000 }).then((result) => {
        events.push('completion-admitted');
        return result;
    });
    setTimeout(() => {
        events.push('date-write-admitted');
        releaseDateWrite(true);
    }, 40);
    const result = await waiting;
    assert.equal(result.ok, true, 'completion barrier must resolve after the pending date write');
    assert.deepEqual(events, ['date-write-admitted', 'completion-admitted']);

    let rejectDateWrite;
    context.track('task-2', new Promise((_, reject) => { rejectDateWrite = reject; }));
    const failed = context.wait('task-2', { timeoutMs: 1000 });
    setTimeout(() => rejectDateWrite(new Error('date write failed')), 10);
    const failedResult = await failed;
    assert.equal(failedResult.ok, false);
    assert.equal(failedResult.code, 'TASK_WRITE_FAILED');

    console.log('task date completion race contract tests passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
