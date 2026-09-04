'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const detailSource = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '52-task-detail-runtime.js'), 'utf8');
const helperSource = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '51-whiteboard-and-link-runtime.js'), 'utf8');

assert.match(helperSource, /tm_task_detail_subtask_drafts_v1/, 'subtask drafts must have a dedicated storage key');
assert.match(helperSource, /__tmPersistTaskDetailSubtaskDraftStorage[\s\S]*localStorage/, 'subtask draft persistence must write through localStorage');
assert.match(helperSource, /__tmClearTaskDetailSubtaskDraft[\s\S]*__tmPersistTaskDetailSubtaskDraftStorage\(null\)/, 'subtask draft cleanup must remove the stored entry');
assert.match(helperSource, /__TM_TASK_DETAIL_SUBTASK_DRAFT_MAX_AGE_MS/, 'subtask drafts must expire instead of accumulating indefinitely');

const draftBindingStart = detailSource.indexOf('const bindSubtaskDraftRow =');
const draftBindingEnd = detailSource.indexOf('const openInlineSubtaskDraft =', draftBindingStart);
assert.ok(draftBindingStart >= 0 && draftBindingEnd > draftBindingStart, 'subtask draft binding must remain extractable');
const draftBinding = detailSource.slice(draftBindingStart, draftBindingEnd);
assert.match(draftBinding, /on\(input, 'input',[\s\S]*persistDraft\(\)/, 'draft input must persist on every input event');
assert.match(draftBinding, /const removeDraft = \(reason = 'manual'\)[\s\S]*__tmClearTaskDetailSubtaskDraft/, 'draft removal must clear the persisted entry for intentional exits');
assert.match(draftBinding, /removeDraft\('submitted'\)/, 'successful submission must clear the persisted draft');
assert.match(draftBinding, /removeDraft\('cancel'\)/, 'cancel must clear the persisted draft');

assert.match(detailSource, /const persistedDraft = typeof __tmGetTaskDetailSubtaskDraft[\s\S]*__tmRestoreTaskDetailSubtaskDraftSnapshot/, 'rebinding a detail panel must restore a persisted draft');

console.log('task detail subtask draft persistence contract tests passed');
