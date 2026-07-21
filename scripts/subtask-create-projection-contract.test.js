const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const runtime = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const taskCreate = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53b-task-create-and-quick-add-runtime.js'), 'utf8');
const taskList = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js'), 'utf8');
const taskDetail = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/52-task-detail-runtime.js'), 'utf8');
const viewRefresh = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'), 'utf8');

assert.match(
    taskCreate,
    /window\.tmCreateSubtask[\s\S]*skipSettledRefresh: true/,
    'context-menu subtask creation must disable settled board refreshes'
);
assert.match(
    taskCreate,
    /window\.tmCreateSubtask[\s\S]*refreshCurrentView: false/,
    'context-menu subtask creation must avoid an authoritative settled board refresh'
);
assert.match(
    taskCreate,
    /const refreshIds = \[pid\]\.concat\(tempIds\)\.filter\(Boolean\);[\s\S]*mode: 'current',[\s\S]*withFilters: false,[\s\S]*reason: 'create-subtask-current-optimistic',[\s\S]*taskIds: refreshIds/,
    'context-menu subtask creation must rerender the current view from optimistic local state'
);
assert.match(
    taskList,
    /function __tmRefreshDetachSubtaskViews[\s\S]*__tmInvalidateFilteredTaskDerivedStateCache\(\);[\s\S]*state\.listDomRenderSignature = '';[\s\S]*mode: 'current',[\s\S]*withFilters: true/,
    'detaching a subtask must invalidate derived list state before rerendering the current view'
);
assert.match(
    taskDetail,
    /const refreshIds = \[parentForCreate\]\.concat\(tempIds\)\.filter\(Boolean\);[\s\S]*__tmInvalidateFilteredTaskDerivedStateCache\?\.\(\);[\s\S]*state\.listDomRenderSignature = '';[\s\S]*mode: 'current',[\s\S]*reason: 'detail-create-subtask-current-optimistic',[\s\S]*taskIds: refreshIds,[\s\S]*bypassDefer: true/,
    'detail subtask creation must rerender the current view from optimistic local state'
);
assert.match(
    viewRefresh,
    /function __tmNormalizeViewRefreshDetail[\s\S]*bypassDefer: raw\.bypassDefer === true,[\s\S]*bypassTaskFieldDefer: raw\.bypassTaskFieldDefer === true,[\s\S]*bypassScrollDefer: raw\.bypassScrollDefer === true,[\s\S]*bypassInteractionDefer: raw\.bypassInteractionDefer === true/,
    'view refresh normalization must preserve defer bypass flags'
);
assert.match(
    viewRefresh,
    /function __tmMergeViewRefreshDetail[\s\S]*bypassDefer: left\.bypassDefer === true \|\| right\.bypassDefer === true,[\s\S]*bypassTaskFieldDefer: left\.bypassTaskFieldDefer === true \|\| right\.bypassTaskFieldDefer === true,[\s\S]*bypassScrollDefer: left\.bypassScrollDefer === true \|\| right\.bypassScrollDefer === true,[\s\S]*bypassInteractionDefer: left\.bypassInteractionDefer === true \|\| right\.bypassInteractionDefer === true/,
    'coalesced view refreshes must retain defer bypass flags'
);
assert.match(
    runtime,
    /if \(realId && op\?\.data\?\.refreshCurrentView !== false && op\?\.data\?\.skipSettledRefresh !== true\) \{[\s\S]*__tmRefreshQueuedStructuralProjection\(op/,
    'create commit must not reload a board before a real task ID exists or when settled refresh is disabled'
);
assert.match(
    runtime,
    /if \(data\.refreshCurrentView !== false && data\.skipSettledRefresh !== true\) \{[\s\S]*__tmRefreshQueuedStructuralProjection\(op, \{[\s\S]*taskId: realId,/,
    'deferred task-ID resolution must refresh authoritative data only for callers that requested it'
);

console.log('subtask create projection contract tests passed');
