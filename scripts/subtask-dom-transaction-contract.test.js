const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const kernel = fs.readFileSync(path.join(root, 'kernel.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const create = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53b-task-create-and-quick-add-runtime.js'), 'utf8');
const detail = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/52-task-detail-runtime.js'), 'utf8');

assert.match(kernel, /if \(action === 'createSubtask'\)/, 'kernel must expose one subtask creation operation');
const createStart = kernel.indexOf("if (action === 'createSubtask')");
const createEnd = kernel.indexOf("if (action === 'moveBlock')", createStart);
assert.ok(createStart >= 0 && createEnd > createStart);
const createKernel = kernel.slice(createStart, createEnd);
assert.match(createKernel, /transactions:\s*\[\{[\s\S]*doOperations:\s*\[\{[\s\S]*action:\s*'insert'/, 'subtask creation must use a transaction insert');
assert.doesNotMatch(createKernel, /\/api\/block\/appendBlock/, 'subtask DOM must not pass through appendBlock parsing');
assert.match(createKernel, /listData/);
assert.match(createKernel, /itemData/);
assert.match(createKernel, /resolveLastChildID/);
assert.match(createKernel, /\.\.\.\(previousID \? \{ previousID \} : \{\}\)/, 'existing subtask lists must append after their last direct child');
assert.match(createKernel, /const parentPreviousID = await resolveLastChildID\(parentTaskID\);[\s\S]*id: listID,[\s\S]*parentID: parentTaskID,[\s\S]*\.\.\.\(parentPreviousID \? \{ previousID: parentPreviousID \} : \{\}\)/,
    'a new child list must be inserted after the parent content instead of before the parent title');
assert.match(createKernel, /预生成子任务 ID 已被其他块占用/);

assert.match(api, /createSubtask:\s*__tmGuardBackendWrite\('createSubtask'/, 'subtask creation must use the guarded kernel adapter');
assert.match(create, /const requestedContainerId = __tmNewTaskBlockId\(\);/, 'queued subtask creation must reserve a list ID');
assert.match(create, /const itemData = API\.generateTaskDOM\(stableTaskId, text, false, \{[\s\S]*itemOnly: true/);
assert.match(create, /createSubtask\(\s*pid,\s*stableTaskId,\s*childListId \|\| requestedListId,\s*listData,\s*itemData/);
assert.doesNotMatch(create, /stableTaskId \? API\.generateTaskDOM\(stableTaskId, text, false, \{[\s\S]*requestedID: stableTaskId/);

assert.match(detail, /createSubtask\(parentForCreate, line,[\s\S]*wait: false/,
    'detail creation must use the shared non-blocking mutation command');
assert.doesNotMatch(detail, /__tmScheduleChecklistOptimisticSubtaskRefresh|detail-create-subtask-optimistic/,
    'detail creation must not own a second subtask projection path');

console.log('subtask DOM transaction contract tests passed');
