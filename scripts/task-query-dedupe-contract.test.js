'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const storesRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const apiRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');

const helperMatch = storesRuntime.match(/function __tmDedupeTaskQueryRowsById\(rows\) \{[\s\S]*?\n    \}/);
assert.ok(helperMatch, 'task query row dedupe helper must exist');
const dedupeRows = vm.runInNewContext(`(${helperMatch[0]})`);

const rows = [
    { id: 'task-a', content: 'same', updated: '20260101000000' },
    { id: 'task-b', content: 'same', updated: '20260101000001' },
    { id: 'task-a', content: 'same', updated: '20260102000000' },
    { id: 'task-a', content: 'same', updated: '20251231000000' },
];
const deduped = dedupeRows(rows);
assert.deepEqual(Array.from(deduped, (row) => row.id), ['task-a', 'task-b'], 'same IDs must collapse while same-title different IDs remain');
assert.equal(deduped[0].updated, '20260102000000', 'the newest duplicate task row must win');

assert.match(apiRuntime, /async getTasksByDocument\(docId,[\s\S]*?const tasks = __tmDedupeTaskQueryRowsById\(Array\.isArray\(res\.data\) \? res\.data : \[\]\);/, 'single-document task queries must dedupe before returning rows');
assert.match(apiRuntime, /async getTasksByDocuments\(docIds,[\s\S]*?let tasks = __tmDedupeTaskQueryRowsById\(Array\.isArray\(res\.data\) \? res\.data : \[\]\);/, 'multi-document task queries must dedupe before returning rows');
assert.match(apiRuntime, /SELECT root_id, COUNT\(DISTINCT id\) AS task_count/, 'task count probes must count logical IDs');
assert.match(apiRuntime, /COUNT\(DISTINCT task\.id\) AS parent_list_task_count/, 'parent-list shape queries must count logical IDs');
assert.match(storesRuntime, /const __TM_TASK_SNAPSHOT_VERSION = 4;/, 'task snapshots must invalidate duplicate-bearing v3 data');
assert.match(storesRuntime, /const __TM_TASK_INDEX_VERSION = 5;/, 'task indexes must invalidate duplicate-bearing v4 data');

console.log('task query dedupe contract tests passed');
