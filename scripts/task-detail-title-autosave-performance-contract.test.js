'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '52-task-detail-runtime.js'), 'utf8');
const sliceBetween = (startToken, endToken, label) => {
    const start = source.indexOf(startToken);
    const end = source.indexOf(endToken, start + startToken.length);
    assert.ok(start >= 0 && end > start, `${label} must remain extractable`);
    return source.slice(start, end);
};

const titleBinding = sliceBetween("const titleTextarea =", 'const fsrsReviewButtons =', 'task detail title binding');
assert.match(titleBinding, /on\(titleTextarea, 'input',[\s\S]*scheduleAutoSave\(500\)/, 'title input must schedule a short debounced save');
assert.match(titleBinding, /compositionstart[\s\S]*dataset\.composing = 'true'/, 'title input must mark IME composition');
assert.match(titleBinding, /compositionend[\s\S]*delete titleTextarea\.dataset\.composing[\s\S]*scheduleAutoSave\(500\)/, 'title input must save after IME composition ends');
assert.match(titleBinding, /on\(titleTextarea, 'blur',[\s\S]*flushAutoSaveNow\(/, 'title blur must still flush immediately');

const autoHeight = sliceBetween('const supportsNativeTextareaAutoHeight =', 'const setInlinePopoverBusyState =', 'textarea auto height implementation');
assert.match(autoHeight, /CSS\?\.supports\?\.\('field-sizing', 'content'\)/, 'modern runtimes must use native textarea content sizing');
assert.match(autoHeight, /pendingAutoHeightTextareas = new Map\(\)/, 'fallback height reads must be batched');
assert.match(autoHeight, /requestAnimationFrame\(flushPendingAutoHeights\)/, 'fallback height measurement must run at most once per frame');
assert.ok(autoHeight.indexOf("textarea.style.height = 'auto'") < autoHeight.indexOf('textarea.scrollHeight'), 'fallback writes must happen before layout reads');
assert.ok(autoHeight.indexOf('textarea.scrollHeight') < autoHeight.indexOf('heights[index]'), 'fallback layout reads must happen before final writes');

const contentSave = sliceBetween("__tmPushDetailDebug('detail-save-content-patch'", 'const fieldPatch =', 'detail content save path');
assert.match(contentSave, /onPending:\s*\(pendingPromise, op\)[\s\S]*trackDetailCommit\(pendingPromise, \['content'\], opId\)/, 'content saves must track the real queued operation');
assert.doesNotMatch(source, /\[Task Horizon\]\[Detail\]\[ContentSave\]|logDetailContentSave|titleAutoSaveRequestedAt/, 'retired title-save diagnostics must stay deleted');

const panelPatch = sliceBetween('function __tmPatchTaskDetailPanelInPlace(', 'function __tmScheduleTaskDetailForceRebuildRetry(', 'task detail in-place patch');
assert.match(panelPatch, /hasOwnProperty\.call\(nextPatch, 'content'\)[\s\S]*isEditing[\s\S]*if \(!isEditing\) titleTextarea\.value = titleText/, 'focused title edits must keep their local value during an optimistic content patch');

const visibleRefresh = sliceBetween('function __tmRefreshVisibleTaskDetailForTask(', 'let __tmKanbanDetailOutsideClickHandler', 'visible task detail refresh');
const kanbanRefreshStart = visibleRefresh.indexOf("if (String(state.viewMode || '').trim() === 'kanban'");
const kanbanRefreshEnd = visibleRefresh.indexOf('const overlay =', kanbanRefreshStart);
assert.ok(kanbanRefreshStart >= 0 && kanbanRefreshEnd > kanbanRefreshStart, 'kanban detail refresh must remain extractable');
const kanbanRefresh = visibleRefresh.slice(kanbanRefreshStart, kanbanRefreshEnd);
assert.match(kanbanRefresh, /const detailPatched = !!patchVisibleDetailPanel\(panel\);[\s\S]*if \(!detailPatched\)/, 'kanban detail mutations must patch the mounted panel before considering a rebuild');
assert.match(kanbanRefresh, /__tmShouldDeferTaskDetailFallback\(panel\)[\s\S]*__tmRefreshKanbanDetailInPlace/, 'kanban detail rebuilds must remain a guarded fallback');

console.log('task detail title autosave performance contract tests passed');
