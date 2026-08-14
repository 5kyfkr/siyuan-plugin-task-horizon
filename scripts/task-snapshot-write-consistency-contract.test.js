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
const persist = segment('function __tmSchedulePersistTaskSnapshot', 'function __tmResolveCreatedTaskDocId');
const createdDocUpdate = segment('async function __tmUpdateSnapshotsContainingCreatedTaskDoc', 'function __tmScheduleCreatedTaskSnapshotRefresh');

assert.match(lock, /__tmTaskSnapshotWriteTail\.then\(run, run\)/,
    'snapshot writes in one window must run through one promise tail');
assert.match(lock, /navigator\?\.locks[\s\S]*locks\.request\('task-horizon:task-snapshot-write'/,
    'snapshot writes across windows must use the browser exclusive lock');
assert.match(persist, /__tmWithTaskSnapshotWriteLock\(async \(\) =>[\s\S]*__tmReadJsonFile\(TASK_SNAPSHOT_FILE_PATH\)[\s\S]*__tmWriteJsonFile\(TASK_SNAPSHOT_FILE_PATH, nextStore\)/,
    'scheduled snapshot persistence must keep read, merge and write in one lock');
assert.match(createdDocUpdate, /__tmWithTaskSnapshotWriteLock\(async \(\) =>[\s\S]*__tmReadJsonFile\(TASK_SNAPSHOT_FILE_PATH\)[\s\S]*__tmWriteJsonFile\(TASK_SNAPSHOT_FILE_PATH, nextStore\)/,
    'created-task snapshot updates must share the same read-modify-write lock');
assert.match(persist, /const saved = await __tmWriteJsonFile\(TASK_SNAPSHOT_FILE_PATH, nextStore\)[\s\S]*if \(saved\) \{[\s\S]*__tmTaskSnapshotStoreCache = nextStore/,
    'scheduled persistence must update its memory cache only after a successful disk write');
assert.match(createdDocUpdate, /if \(!saved\)[\s\S]*return false;[\s\S]*__tmTaskSnapshotStoreCache = nextStore/,
    'created-task persistence must preserve the prior cache when disk writing fails');

console.log('task snapshot write consistency contract tests passed');
