'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const coordinatorSource = read('src', 'task-horizon', 'main', 'task-runtime', '51-whiteboard-and-link-runtime.js');
const detailSource = read('src', 'task-horizon', 'main', 'task-runtime', '52-task-detail-runtime.js');
const loaderSource = read('src', 'task-horizon', 'main', 'task-runtime', '53-list-render-and-document-loader.js');
const timeRefreshSource = read('src', 'task-horizon', 'main', 'render', '46-render-local-task-time-refresh.js');

const detailControllerStart = coordinatorSource.indexOf('        detail: {', coordinatorSource.indexOf('const __tmViewControllers = {'));
const detailControllerEnd = coordinatorSource.indexOf('        timeline: {', detailControllerStart);
assert.ok(detailControllerStart >= 0 && detailControllerEnd > detailControllerStart, 'detail view controller must remain extractable');
const detailController = coordinatorSource.slice(detailControllerStart, detailControllerEnd);
assert.match(
    detailController,
    /__tmRefreshVisibleTaskDetailForTask\(taskId, \{\s*patch: nextPatch,\s*\}\)/,
    'detail field refreshes must preserve the originating patch scope',
);

const visibleRefreshStart = detailSource.indexOf('function __tmRefreshVisibleTaskDetailForTask(');
const visibleRefreshEnd = detailSource.indexOf('\n\n    let __tmKanbanDetailOutsideClickHandler', visibleRefreshStart);
assert.ok(visibleRefreshStart >= 0 && visibleRefreshEnd > visibleRefreshStart, 'visible detail refresh must remain extractable');
const visibleRefresh = detailSource.slice(visibleRefreshStart, visibleRefreshEnd);
assert.match(
    detailSource,
    /const __TM_TASK_DETAIL_NON_VISUAL_PATCH_KEYS = new Set\(\[[\s\S]*'priorityScore'[\s\S]*'allDayBottom'[\s\S]*'milestone'[\s\S]*'taskDateColor'[\s\S]*'customTime'[\s\S]*\]\);/,
    'fields that are not rendered by task detail must share one explicit refresh exclusion set',
);
assert.match(
    visibleRefresh,
    /targetedPatch[\s\S]*patchKeys\.every\(\(key\) => __TM_TASK_DETAIL_NON_VISUAL_PATCH_KEYS\.has\(key\)\)[\s\S]*return false/,
    'non-visual patches must not redraw unrelated parent detail fields',
);
assert.match(
    visibleRefresh,
    /const detailPatch = targetedPatch \|\| defaultDetailPatch;[\s\S]*__tmPatchTaskDetailPanelInPlace\(panel, tid, detailPatch\)/,
    'visible detail panels must patch only the fields named by the originating mutation',
);
assert.match(
    visibleRefresh,
    /const detailPatched = !!patchVisibleDetailPanel\(overlay\)/,
    'standalone details must use the same field-scoped patch path as embedded drawers',
);

assert.match(
    timeRefreshSource,
    /__tmRefreshVisibleTaskDetailForTask\(tid, \{\s*patch,\s*\}\)/,
    'time-field refreshes must preserve their patch scope when updating a visible detail',
);
assert.match(
    detailSource,
    /case 'custom-tomato-count':[\s\S]*__tmRefreshVisibleTaskDetailForTask\([\s\S]*?patch: \{ tomatoCount: true \},[\s\S]*?\}\);/,
    'tomato-count attribute refreshes must not redraw unrelated detail fields',
);
assert.match(
    coordinatorSource,
    /catch \(e\) \{\s*try \{ __tmRefreshVisibleTaskDetailForTask\(taskId, \{ patch: \{ attachments: true \} \}\); \} catch \(e2\) \{\}\s*\}/,
    'attachment fallback refreshes must remain field-scoped',
);

const mainControllers = coordinatorSource.slice(
    coordinatorSource.indexOf('const __tmViewControllers = {'),
    coordinatorSource.indexOf('function __tmSyncVisibleCalendarTaskPatch', coordinatorSource.indexOf('const __tmViewControllers = {')),
);
for (const view of ['list', 'checklist', 'timeline', 'kanban', 'whiteboard']) {
    const start = mainControllers.indexOf(`        ${view}: {`);
    const end = mainControllers.indexOf('\n        },', start);
    assert.ok(start >= 0 && end > start, `${view} view controller must remain extractable`);
    const controller = mainControllers.slice(start, end);
    assert.match(controller, /hasOwnProperty\.call\(patch,|__tmDoesPatchAffect/, `${view} must keep field-aware in-place refresh behavior`);
    assert.doesNotMatch(controller, /__tmRefreshVisibleTaskDetailForTask|\brender\s*\(/, `${view} must not enter an unrelated full detail or shell refresh`);
}

console.log('task detail field refresh isolation contract tests passed');
