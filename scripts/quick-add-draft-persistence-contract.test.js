'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const helperSource = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '51-whiteboard-and-link-runtime.js'), 'utf8');
const quickAddSource = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '53b-task-create-and-quick-add-runtime.js'), 'utf8');

assert.match(helperSource, /tm_quick_add_draft_v1/, 'quick-add drafts must have a dedicated storage key');
assert.match(helperSource, /function __tmSaveQuickAddDraft[\s\S]*__tmPersistQuickAddDraftStorage/, 'quick-add drafts must persist to local storage');
assert.match(helperSource, /function __tmGetQuickAddDraft[\s\S]*__TM_QUICK_ADD_DRAFT_MAX_AGE_MS/, 'quick-add drafts must expire after the configured age');
assert.match(helperSource, /function __tmClearQuickAddDraft[\s\S]*__tmPersistQuickAddDraftStorage\(null\)/, 'quick-add draft cleanup must remove the stored entry');

const openStart = quickAddSource.indexOf('window.tmQuickAddOpen = async function()');
const openEnd = quickAddSource.indexOf('window.tmQuickAddOpenForDoc =', openStart);
assert.ok(openStart >= 0 && openEnd > openStart, 'quick-add open flow must remain extractable');
const openSource = quickAddSource.slice(openStart, openEnd);
assert.match(openSource, /const persistedDraft = typeof __tmGetQuickAddDraft[\s\S]*input\.value = String\(persistedDraft\.value/, 'opening quick-add must restore the local draft');
assert.match(openSource, /input\.addEventListener\('input',[\s\S]*__tmSaveQuickAddDraft\(input\.value/, 'quick-add input must persist in real time');

const submitStart = quickAddSource.indexOf('window.tmQuickAddSubmit = async function()');
const submitSource = quickAddSource.slice(submitStart);
assert.match(submitSource, /createFailures\.length > 0[\s\S]*__tmClearQuickAddDraft/, 'successful task creation must clear the quick-add draft after failure handling');

console.log('quick-add draft persistence contract tests passed');
