'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'),
    'utf8',
);

const segment = (start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

const lock = segment('function __tmWithTaskSnapshotWriteLock', 'function __tmBuildTaskParentListHostShape');
const sharedLock = segment('function __tmWithDerivedCacheWriteLock', 'async function __tmReadDerivedCacheFile');
const persist = segment('function __tmSchedulePersistTaskSnapshot', 'function __tmResolveCreatedTaskDocId');
const createdDocApply = segment('async function __tmApplyCreatedTaskDocSnapshotRefresh', 'async function __tmFlushPendingCreatedTaskSnapshotRefreshesAfterGroupSwitch');
const createdDocSchedule = segment('function __tmScheduleCreatedTaskSnapshotRefresh', 'function __tmScheduleBatchedTaskIncrementalRefreshFromTx');

assert.match(sharedLock, /__tmDerivedCacheWriteTails\.get\(name\)[\s\S]*\.then\(run, run\)/,
    'snapshot writes in one window must run through one promise tail');
assert.match(lock, /__tmWithDerivedCacheWriteLock\('task-horizon:task-snapshot-write'/,
    'snapshot writes across windows must use the browser exclusive lock');
assert.match(sharedLock, /navigator\?\.locks[\s\S]*locks\.request\(name, \{ mode: 'exclusive' \}, callback\)/);
assert.match(persist, /__tmWithTaskSnapshotWriteLock\(async \(\) =>[\s\S]*__tmReadDerivedCacheFile\(TASK_SNAPSHOT_FILE_PATH\)[\s\S]*__tmWriteJsonFile\(TASK_SNAPSHOT_FILE_PATH, nextStore\)/,
    'scheduled snapshot persistence must keep read, merge and write in one lock');
assert.match(persist, /const saved = await __tmWriteJsonFile\(TASK_SNAPSHOT_FILE_PATH, nextStore\)[\s\S]*if \(saved\) \{[\s\S]*__tmTaskSnapshotStoreCache = nextStore/,
    'scheduled persistence must update its memory cache only after a successful disk write');
assert.match(persist, /const pending = \{ firstDirtyAt: previousPending\?\.firstDirtyAt \?\? now,/,
    'repeated edits must retain their first dirty timestamp');
assert.match(persist, /__tmTaskSnapshotLastCheckpointAt \+ 30000 - now[\s\S]*pending\.firstDirtyAt \+ 45000 - now/,
    'runtime checkpoints must use a quiet period, a soft deadline and a minimum write interval');
assert.match(createdDocApply, /__tmRememberDocSessionTaskEntry\(doc,[\s\S]*__tmMergeTaskIndexEntries\(\[indexEntry\], \{ readToken \}\)/,
    'created-task discovery must update the session and task index');
assert.doesNotMatch(createdDocApply, /__tmReadDerivedCacheFile|__tmWriteJsonFile/,
    'created-task discovery must not read or overwrite the full snapshot');
assert.match(createdDocSchedule, /changedDocIds: \[docId\][\s\S]*source: String\(opts\.source/,
    'the active task document must be queued for the shared coalesced snapshot checkpoint');

console.log('task snapshot write consistency contract tests passed');
