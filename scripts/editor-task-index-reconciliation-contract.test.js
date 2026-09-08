'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const loader = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53c-document-loader-runtime.js'), 'utf8');

function extractFunction(name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `${name} must remain defined`);
    const bodyStart = source.indexOf('{', source.indexOf(')', start));
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] !== '}') continue;
        depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`Unable to extract ${name}`);
}

const requiredHelpers = [
    '__tmGetDocumentTaskDomSelector',
    '__tmReadTaskIdsFromEditorRoot',
    '__tmCaptureEditorDocumentTaskOrder',
    '__tmApplyEditorDocumentTaskOrderToFlowRankMap',
    '__tmBuildEditorDocumentTaskIdMap',
    '__tmCollectMissingEditorTaskIds',
    '__tmBuildLoadedDocumentTaskIdMap',
    '__tmBuildDocumentTaskIdMapFromRows',
    '__tmDiffDocumentTaskIdMaps',
    '__tmFilterDeletedTaskRowsForDocumentRefresh',
];
requiredHelpers.forEach(extractFunction);

assert.match(loader, /__tmCollectMissingEditorTaskIds\(res\?\.tasks, editorTaskIdsByDoc\)/);
assert.match(loader, /__tmApplyEditorDocumentTaskOrderToFlowRankMap\(taskFlowRankMap, editorOrderSnapshots/);

const context = vm.createContext({ Map, Set, Array, String });
vm.runInContext([
    extractFunction('__tmBuildEditorDocumentTaskIdMap'),
    extractFunction('__tmCollectMissingEditorTaskIds'),
    extractFunction('__tmApplyEditorDocumentTaskOrderToFlowRankMap'),
    extractFunction('__tmFilterDeletedTaskRowsForDocumentRefresh'),
].join('\n'), context);

const snapshots = [
    { docId: 'doc-a', matched: true, taskIds: ['task-1', 'task-2', 'task-2'] },
    { docId: 'doc-b', matched: false, taskIds: ['task-3'] },
];
const editorTaskIdsByDoc = context.__tmBuildEditorDocumentTaskIdMap(snapshots);
assert.deepEqual(Array.from(editorTaskIdsByDoc.keys()), ['doc-a']);
assert.deepEqual(Array.from(editorTaskIdsByDoc.get('doc-a')), ['task-1', 'task-2']);

const missing = context.__tmCollectMissingEditorTaskIds([
    { id: 'task-1', root_id: 'doc-a' },
    { id: 'task-3', root_id: 'doc-b' },
], editorTaskIdsByDoc);
assert.deepEqual(Array.from(missing), ['task-2']);

const flowRanks = new Map([['unrelated', 9]]);
const orderSnapshots = [{ docId: 'doc-a', matched: true, taskIds: ['task-1', 'task-2'] }];
assert.equal(context.__tmApplyEditorDocumentTaskOrderToFlowRankMap(flowRanks, orderSnapshots, new Set(['task-2'])), 1);
assert.equal(flowRanks.get('task-2'), 2);
assert.equal(flowRanks.has('task-1'), false);
assert.equal(flowRanks.get('unrelated'), 9);

const filtered = context.__tmFilterDeletedTaskRowsForDocumentRefresh([
    { id: 'task-1' },
    { id: 'task-2' },
], new Set(['task-2']));
assert.deepEqual(Array.from(filtered, (row) => row.id), ['task-1']);

console.log('editor task index reconciliation contract tests passed');
