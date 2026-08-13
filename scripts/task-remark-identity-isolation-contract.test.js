'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const sliceBetween = (source, startToken, endToken, label) => {
    const start = source.indexOf(startToken);
    const end = source.indexOf(endToken, start + startToken.length);
    assert.ok(start >= 0 && end > start, `${label} must remain extractable`);
    return source.slice(start, end);
};

const detailSource = read('src', 'task-horizon', 'main', 'task-runtime', '52-task-detail-runtime.js');
const loaderSource = read('src', 'task-horizon', 'main', 'task-runtime', '53-list-render-and-document-loader.js');

const saveOnce = sliceBetween(detailSource, 'const runSaveOnce = async', 'const doSave = async', 'detail save execution');
assert.match(saveOnce, /capturedFormState[\s\S]*captureFormStateSnapshot\(\)/, 'detail saves must consume a captured form snapshot');
assert.doesNotMatch(saveOnce, /collectFormState\(\)/, 'save execution must never reread the shared detail DOM');
assert.ok(
    saveOnce.indexOf("reason: 'task-id-mismatch'") < saveOnce.indexOf('patchTask(task.id, fieldPatch'),
    'snapshot task identity must be checked before persistence',
);

const saveQueue = sliceBetween(detailSource, 'const resetQueuedSaveRequest =', 'const shouldDeferAutoSaveWhileFocused =', 'detail save queue');
assert.match(saveQueue, /queuedSaveFormState = formState/, 'queued saves must retain their own form snapshot');
assert.match(detailSource, /queueSaveRequest\(requestOptions, requestFormState\)/, 'in-flight follow-up saves must queue the captured snapshot');
assert.match(detailSource, /await savePromise;[\s\S]*queuedSaveRequested && !savePromise[\s\S]*doSave\(nextOptions, nextFormState\)/, 'a request queued as the active save settles must be drained');

const autoSave = sliceBetween(detailSource, 'const firePendingAutoSave =', 'const isNoteViewCandidate =', 'detail autosave lifecycle');
assert.match(autoSave, /formState: captureFormStateSnapshot\(\)/, 'autosave scheduling must capture form state before the timer fires');
assert.match(autoSave, /clearTimeout\(autoSaveTimer\)[\s\S]*doSave\(request\.options, request\.formState\)/, 'aborting a detail session must clear its timer and flush only its captured request');
assert.match(detailSource, /on\(remarkTextarea, 'blur',[\s\S]*?flushAutoSaveNow\(/, 'remark blur must flush the captured draft before task switching');

for (const forbidden of [
    'findTaskByContent',
    'contentToMeta',
    'oldIdToNewId',
    'newIdToOldId',
    'restoreCollapsedState',
]) {
    assert.equal(loaderSource.includes(forbidden), false, `${forbidden} must not participate in task identity recovery`);
}
assert.doesNotMatch(loaderSource, /textContent\?\.trim\(\) === task\.content/, 'DOM fallback must not locate tasks by title');

const treeProtector = sliceBetween(loaderSource, 'const TreeProtector =', '// 保存任务完整状态到 MetaStore', 'DOM fallback tree protector');
assert.match(treeProtector, /snapshot\.set\(taskId,/, 'fallback snapshots must be keyed by exact task ID');
assert.doesNotMatch(treeProtector, /task\.content|MetaStore|remapId|collapsed/i, 'fallback snapshots must not infer identity or migrate metadata');

const reload = sliceBetween(loaderSource, 'async function reloadDocTasksProtected', 'const __tmFreshTaskDetailDocReloads', 'protected document reload');
assert.match(reload, /const meta = MetaStore\.get\(taskId\) \|\| \{\};/, 'document reload must read metadata by exact task ID');
assert.doesNotMatch(reload, /MetaStore\.set\(taskId|TreeProtector\./, 'generic reload must not migrate metadata or consume fallback snapshots');

const setDone = sliceBetween(loaderSource, 'async function __tmSetDoneKernel', 'function __tmAutoCompleteGetTaskById', 'set-done fallback');
assert.match(setDone, /findTaskListItemById\?\.\(id\)/, 'set-done DOM fallback must locate the exact block ID');
assert.doesNotMatch(setDone, /querySelectorAll\([^\n]*NodeListItem/, 'set-done fallback must not scan unrelated list items');
assert.ok(setDone.indexOf('TreeProtector.restore(doc.tasks, fallbackTreeSnapshot)') > setDone.indexOf('} catch (err) {'), 'tree state may only be restored on the current operation failure');
assert.ok(setDone.indexOf('TreeProtector.clear(fallbackTreeSnapshot)') > setDone.indexOf('} finally {'), 'fallback state must always be cleared');

assert.equal((loaderSource.match(/MetaStore\.remapId\(/g) || []).length, 1, 'only the explicit optimistic ID remap may migrate MetaStore data');
assert.match(loaderSource, /remapLocalId\?\.\(oldId, newId,[\s\S]*if \(!remapped\) return;[\s\S]*MetaStore\.remapId\(oldId, newId\)/, 'MetaStore remap must remain gated by a successful explicit task-store remap');

console.log('task remark identity isolation contract tests passed');
