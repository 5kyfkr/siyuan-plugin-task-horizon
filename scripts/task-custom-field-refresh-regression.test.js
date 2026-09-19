'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(
    __dirname,
    '../src/task-horizon/main/10-stores-rules-and-cache.js',
), 'utf8');

function extractFunction(input, name) {
    const start = input.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `${name} must exist`);
    const declarationStart = input.slice(Math.max(0, start - 6), start) === 'async '
        ? start - 6
        : start;
    const bodyStart = input.indexOf('{', input.indexOf(')', start));
    let depth = 0;
    for (let index = bodyStart; index < input.length; index += 1) {
        if (input[index] === '{') depth += 1;
        if (input[index] !== '}') continue;
        depth -= 1;
        if (depth === 0) return input.slice(declarationStart, index + 1);
    }
    throw new Error(`Unable to extract ${name}`);
}

const context = vm.createContext({
    Map,
    Set,
    API: {
        parseTaskStatus: () => ({ done: false, content: '' }),
        call: async () => ({ code: 0, data: [] }),
    },
    SettingsStore: { data: { customFieldDefsVersion: 1 } },
    __tmGetCustomFieldDefs: () => [{ id: 'summary' }],
    __tmBuildCustomFieldAttrStorageKey: (name) => `custom-${name}`,
    __tmParseVersionNumber: (value) => Number(value) || 0,
    __tmNormalizeTaskStatusMarker: (value) => String(value || ''),
    __tmApplyDoneOverrideToTaskIfPresent: () => {},
    __tmMergeVisibleDateFieldsFromPrevTask: () => {},
});
context.__tmCustomFieldAttrValueCache = new Map();
vm.runInContext(extractFunction(source, '__tmQueryCustomFieldAttrRowsByTaskIds'), context);
let queryCount = 0;
context.API.call = async () => {
    queryCount += 1;
    if (queryCount === 1) {
        return { code: 0, data: [{ block_id: '20260101000000-abcdef', name: 'custom-summary', value: '保留文本' }] };
    }
    if (queryCount === 2) return { code: 0, data: [] };
    return { code: 0, data: [{ block_id: '20260101000000-abcdef', name: 'custom-summary', value: '' }] };
};
const queryCustomFields = context.__tmQueryCustomFieldAttrRowsByTaskIds;
const queryRegression = (async () => {
    const taskId = '20260101000000-abcdef';
    const initialResult = await queryCustomFields([taskId]);
    assert.equal(initialResult.valueMapByTaskId.get(taskId).summary, '保留文本');
    const missingResult = await queryCustomFields([taskId], { forceFresh: true });
    assert.equal(missingResult.valueMapByTaskId.get(taskId).summary, '保留文本',
        'a successful empty query must not erase the last valid custom text snapshot');
    const clearedResult = await queryCustomFields([taskId], { forceFresh: true });
    assert.equal(clearedResult.valueMapByTaskId.get(taskId).summary, '',
        'an explicit empty attribute row must still clear a custom text field');
})();
vm.runInContext(extractFunction(source, '__tmBuildAuthoritativeTaskConfirmationCandidate'), context);
context.__tmQueryCustomFieldAttrRowsByTaskIds = async () => ({
    valueMapByTaskId: new Map([['task-a', {}]]),
    queryComplete: true,
    cacheHitCount: 0,
    cacheMissCount: 1,
    requestedFieldCount: 1,
});
vm.runInContext(extractFunction(source, '__tmAttachCustomFieldAttrsToTasks'), context);

const previousTask = {
    id: 'task-a',
    customFieldValues: { summary: '保留文本' },
    __customFieldRawValues: { summary: '保留文本' },
    __tmLoadedCustomFieldIds: ['summary'],
};

const missingSnapshot = context.__tmBuildAuthoritativeTaskConfirmationCandidate({
    id: 'task-a',
    __tmLoadedCustomFieldIds: ['summary'],
    __customFieldRawValues: {},
}, { previousTask });
assert.equal(missingSnapshot.customFieldValues.summary, '保留文本');
assert.equal(missingSnapshot.__customFieldRawValues.summary, '保留文本');

const explicitClear = context.__tmBuildAuthoritativeTaskConfirmationCandidate({
    id: 'task-a',
    __tmLoadedCustomFieldIds: ['summary'],
    __customFieldRawValues: { summary: '' },
}, { previousTask });
assert.equal(explicitClear.customFieldValues.summary, '');
assert.equal(explicitClear.__customFieldRawValues.summary, '');

const detailTask = { id: 'task-a', customFieldValues: { summary: '保留文本' } };
const attachRegression = context.__tmAttachCustomFieldAttrsToTasks([detailTask], { fieldIds: ['summary'] }).then(() => {
    assert.equal(detailTask.__customFieldRawValues.summary, '保留文本');

    const loaderSource = fs.readFileSync(path.join(
        __dirname,
        '../src/task-horizon/main/task-runtime/53c-document-loader-runtime.js',
    ), 'utf8');
    assert.match(loaderSource, /__tmBuildAuthoritativeTaskConfirmationCandidate\(task, \{ previousTask: prevTask \}\)/,
        'full document loads must preserve the previous custom-field snapshot when the fresh row omits it');

});
Promise.all([queryRegression, attachRegression]).then(() => {
    console.log('task custom-field refresh regression tests passed');
}).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
