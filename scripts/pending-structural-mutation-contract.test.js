const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const store = fs.readFileSync(path.join(root, 'src/task-horizon/main/32-runtime-state-and-events.js'), 'utf8');
const cache = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const loader = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53c-document-loader-runtime.js'), 'utf8');

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

assert.match(store, /const pendingStructuralMutations = new Map\(\)/);
assert.match(store, /const rememberPendingStructuralMutation = \(mutation = \{\}\) =>/);
assert.match(store, /phase === 'rollback' \|\| phase === 'failed'/);
assert.match(store, /type === 'commitTaskId'/);
assert.match(store, /createTaskInDoc' \|\| type === 'createSubtask' \|\| type === 'createSibling'/);
assert.match(store, /const mergePendingStructuralRows = \(rows, options = \{\}\) =>/);
assert.match(store, /const getExpectedMoveNeighbors = \(data = \{\}\) =>/);
assert.match(store, /expectedPreviousSiblingId: neighbors\.previous/);
assert.match(store, /expectedNextSiblingId: neighbors\.next/);
assert.match(store, /if \(row && docMatches && parentMatches && previousMatches && nextMatches\)[\s\S]*pendingStructuralMutations\.delete\(taskId\)/);
assert.match(store, /__tmPendingStructural: true/);
assert.match(store, /entry\.type !== 'moveTask' && !docMatches/);
assert.match(store, /entry\.type !== 'moveTask' && !parentMatches/);
assert.match(store, /try \{ rememberPendingStructuralMutation\(normalized\); \} catch \(e\) \{\}/);
assert.match(store, /mergePendingStructuralRows,/);

const deletedBlockExtractorSource = segment(
    cache,
    'function __tmExtractDeletedBlockIdsFromTx',
    'function __tmShouldIgnoreWsMainTaskRefreshMessage',
);
const extractDeletedBlockIds = new Function('__tmIsLikelyBlockId', '__tmGetWsMainTaskTxDetail', `
    ${deletedBlockExtractorSource}
    return __tmExtractDeletedBlockIdsFromTx;
`)(
    (id) => /^[0-9]+-[a-zA-Z0-9]+$/.test(String(id || '').trim()),
    (msg) => msg?.detail || msg || {},
);
const deletedIds = extractDeletedBlockIds({
    detail: {
        data: [{
            doOperations: [
                { action: 'delete', id: '20260810102523-task002' },
                { action: 'deleteBlock', blockID: '20260810102523-task003' },
                { action: 'remove', srcIDs: ['20260810102523-task004'] },
            ],
            undoOperations: [{ action: 'delete', id: '20260810102523-inverse' }],
        }],
    },
});
assert.deepEqual(Array.from(deletedIds), [
    '20260810102523-task002',
    '20260810102523-task003',
    '20260810102523-task004',
], 'only executed document delete operations should cancel pending create protection');
assert.match(cache, /txTargets\.deletedBlockIds[\s\S]*clearPendingStructural[\s\S]*removePending/);

assert.match(cache, /rows = globalThis\.__tmTaskStore\?\.mergePendingStructuralRows\?\.\(rows, \{/);
assert.match(cache, /docIds,[\s\S]*incremental-doc-refresh/);
assert.doesNotMatch(store, /phase === 'commit' \? 12000/, 'committed moves must not retain a timed structural overlay');
const loaderReadCurrent = loader.indexOf('taskStoreReadToken && globalThis.__tmTaskStore?.isReadCurrent?.(taskStoreReadToken) !== true');
const loaderMergePending = loader.indexOf('mergePendingStructuralRows?.(res.tasks');
const loaderReplaceFlat = loader.indexOf('replaceFlat?.(nextFlatTasks');
assert.ok(loaderReadCurrent >= 0 && loaderMergePending > loaderReadCurrent,
    'full document reads must reject stale revisions before merging pending structural rows');
assert.ok(loaderReplaceFlat > loaderMergePending,
    'full document reads must preserve pending creates and moves before authoritative TaskStore replacement');

console.log('pending structural mutation contract tests passed');
