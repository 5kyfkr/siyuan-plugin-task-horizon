const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const runtime = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const create = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53b-task-create-and-quick-add-runtime.js'), 'utf8');
const fields = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53a-list-field-edit-runtime.js'), 'utf8');
const timeRefresh = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/46-render-local-task-time-refresh.js'), 'utf8');

assert.match(
    runtime,
    /const pin = Object\.prototype\.hasOwnProperty\.call\(data, 'pinned'\)[\s\S]*?: !!SettingsStore\?\.data\?\.pinNewTasksByDefault;[\s\S]*?if \(pin\) patch\.pinned = true;/,
    'task creation must derive pinned from the default setting when the caller does not override it'
);
assert.match(
    runtime,
    /__tmCreateTaskInDocKernel\(\{[\s\S]*?initialAttrs: __tmBuildAtomicCreateAttrs\([\s\S]*?__tmBuildCreateTaskInDocAttrPatchFromPayload\(payload\)/,
    'one-shot task creation must place initial fields in the insert transaction'
);
assert.match(
    runtime,
    /__tmCreateSubtaskForTaskKernel\([\s\S]*?initialAttrs: __tmBuildAtomicCreateAttrs\(requestedTaskId, inheritedPatch\)/,
    'one-shot subtask creation must place inherited fields in the insert transaction'
);
assert.match(
    create,
    /API\.generateTaskDOM\(stableTaskId, text, __tmIsTaskMarkerDone\(initialMarker\), \{ attrs: initialAttrs \}\)/,
    'new task content and initial fields must use one pre-generated DOM block write'
);
assert.doesNotMatch(runtime, /__tmQueueCreateOpPostInsertAttrs|__tmRecoverQueuedCreateOpRealId/);

const headingCreateStart = create.indexOf('window.tmCreateTaskForHeadingGroup = async function');
const headingCreateEnd = create.indexOf('async function __tmAppendBlockOnce', headingCreateStart);
assert.notEqual(headingCreateStart, -1, 'heading task creation entry point must exist');
assert.notEqual(headingCreateEnd, -1, 'heading task creation block must be extractable');
assert.doesNotMatch(
    create.slice(headingCreateStart, headingCreateEnd),
    /pinned:\s*false/,
    'heading task creation must not override the global default pin setting'
);

const completionSetterStart = fields.indexOf('window.tmSetTaskCompletionTime = async function');
const completionSetterEnd = fields.indexOf('function __tmOpenPriorityInlinePicker', completionSetterStart);
assert.notEqual(completionSetterStart, -1, 'completion-time setter must exist');
assert.notEqual(completionSetterEnd, -1, 'completion-time setter must be extractable');
assert.match(
    fields.slice(completionSetterStart, completionSetterEnd),
    /skipNoopCheck: options\.skipNoopCheck === true \|\| !next/,
    'clearing a completion date must issue one authoritative empty-value write even when local aliases disagree'
);
assert.match(
    fields.slice(completionSetterStart, completionSetterEnd),
    /const updateTaskDates = window\.tmUpdateTaskDates;[\s\S]*?updateTaskDates\(tid, \{ completionTime: next \}, \{/,
    'setting and clearing a completion date must share the specialized optimistic date mutation path'
);
assert.doesNotMatch(
    fields.slice(completionSetterStart, completionSetterEnd),
    /__tmRequireTaskMutation\?\.\('patchTask'\)|\bpatchTask\(|__tmRequestChecklistLegacyTaskPatch/,
    'completion date changes must not use a generic task patch writer in any view'
);
assert.match(
    timeRefresh,
    /const taskForRefresh = hasCalendarDatePatch[\s\S]*?next\.completionTime = completionTime;[\s\S]*?next\.completion_time = completionTime;/,
    'date clear rendering must override stale snake-case date aliases before updating derived fields'
);
assert.match(
    timeRefresh,
    /__tmUpdateChecklistTaskTimeInDOM\(tid, null, taskForRefresh\)/,
    'compact checklist dates and remaining-time fields must refresh from the current optimistic patch'
);

console.log('task create default pin and date clear contract tests passed');
