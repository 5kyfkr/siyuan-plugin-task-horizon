'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js'),
    'utf8',
);
const whiteboardSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/render/44-render-whiteboard-body.js'),
    'utf8',
);
const projectionRuntimeSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'),
    'utf8',
);

const renderCardStart = source.indexOf('const renderCard = (task, depthInCol');
const renderCardEnd = source.indexOf('\n            const kanbanBoardNavItems = [];', renderCardStart);
assert.ok(renderCardStart >= 0 && renderCardEnd > renderCardStart, 'kanban card renderer must exist');
const renderCard = source.slice(renderCardStart, renderCardEnd);

assert.match(
    renderCard,
    /if \(!taskDone\) \{\s*statusChip = `<span class="tm-status-tag"/,
    'incomplete kanban cards must keep their status tag',
);
assert.match(
    renderCard,
    /else if \(keepCompletedStatusChip\) \{\s*statusChip = `<span class="tm-status-tag"/,
    'completed kanban cards must only render the status tag when status is configured as always visible',
);
assert.match(
    renderCard,
    /tm-status-tag"[^`]*onclick="tmKanbanOpenStatusSelect\('\$\{id\}', this, event\)"/,
    'incomplete kanban cards must keep the status menu control',
);
assert.match(
    renderCard,
    /if \(kanbanCardFields\.has\('status'\) && __tmShouldRenderTaskCardStatus\(task\) && statusChip\) metaParts\.push\(statusChip\);/,
    'kanban status field visibility must avoid an empty metadata row',
);
assert.match(
    source,
    /<span class="tm-status-tag" style="\$\{statusChipStyle\}"\>\$\{esc\(statusOption\?\.name \|\| ''\)\}<\/span>/,
    'timeline status rendering must remain unchanged',
);
assert.match(
    source,
    /const keepCompletedStatusChip = __tmTaskCardAlwaysShowFieldEnabled\('status'\);/,
    'kanban completed status visibility must honor the shared always-visible card field setting',
);

const whiteboardCardStart = whiteboardSource.indexOf('const renderTaskNode = (id, depth = 0');
const whiteboardCardEnd = whiteboardSource.indexOf('\n                const cardsHtml = ', whiteboardCardStart);
assert.ok(whiteboardCardStart >= 0 && whiteboardCardEnd > whiteboardCardStart, 'whiteboard card renderer must exist');
const whiteboardCard = whiteboardSource.slice(whiteboardCardStart, whiteboardCardEnd);
assert.match(
    whiteboardCard,
    /const taskDone = isWhiteboardTaskDone\(task\);/,
    'whiteboard cards must use the canonical effective completion resolver',
);
assert.match(
    whiteboardCard,
    /if \(!taskDone\) \{\s*statusChip = `<span class="tm-status-tag"/,
    'incomplete whiteboard cards must keep their status tag',
);
assert.match(
    whiteboardCard,
    /else if \(keepCompletedStatusChip\) \{\s*statusChip = `<span class="tm-status-tag"/,
    'completed whiteboard cards must only render the status tag when status is configured as always visible',
);
assert.match(
    whiteboardCard,
    /if \(whiteboardCardFields\.has\('status'\) && __tmShouldRenderTaskCardStatus\(task\) && statusChip\) metaParts\.push\(statusChip\);/,
    'whiteboard status field visibility must avoid an empty metadata row',
);
assert.match(
    whiteboardSource,
    /const keepCompletedStatusChip = __tmTaskCardAlwaysShowFieldEnabled\('status'\);/,
    'whiteboard completed status visibility must honor the shared always-visible card field setting',
);

const liveMetaStart = projectionRuntimeSource.indexOf('function __tmBuildTaskCardManagedMetaChipsHtml');
const liveMetaEnd = projectionRuntimeSource.indexOf('\n    function __tmSyncTaskCardMetaChipsInDOM', liveMetaStart);
assert.ok(liveMetaStart >= 0 && liveMetaEnd > liveMetaStart, 'live card metadata patcher must exist');
const liveMeta = projectionRuntimeSource.slice(liveMetaStart, liveMetaEnd);
assert.match(
    liveMeta,
    /const taskDone = __tmIsTaskCompletedForProjection\(taskLike\);/,
    'live checkbox patches must resolve effective completion through the canonical projection state',
);
assert.match(
    liveMeta,
    /&& \(!taskDone \|\| keepCompletedStatusChip\)\) \{/,
    'live checkbox patches must omit completed status tags unless status is configured as always visible',
);
assert.doesNotMatch(
    liveMeta,
    /if \(taskLike\?\.done\)|fallbackColor: taskLike\?\.done|fallbackName: taskLike\?\.done/,
    'live card metadata must not use stale raw done values for completed status visibility',
);
const fastProjectionStart = projectionRuntimeSource.indexOf('function __tmTryApplyKanbanOptimisticProjectionInPlace');
const fastProjectionEnd = projectionRuntimeSource.indexOf('\n    function __tmRefreshKanbanProjectionPatchNow', fastProjectionStart);
assert.ok(fastProjectionStart >= 0 && fastProjectionEnd > fastProjectionStart, 'kanban fast projection path must exist');
const fastProjection = projectionRuntimeSource.slice(fastProjectionStart, fastProjectionEnd);
assert.match(
    fastProjection,
    /__tmUpdateTaskDoneInDOM\(node, projectedTask\);\s*__tmSyncTaskCardMetaChipsInDOM\(node, projectedTask, 'kanban'\);/,
    'kanban fast completion projection must update completion styling and status visibility in one synchronous pass',
);
assert.match(
    fastProjection,
    /targetContainer\.insertBefore\([\s\S]*__tmSyncKanbanCompletedTodayBadgeInDOM\(node, projectedTask\)/,
    'kanban fast projection must synchronize the today badge after the card reaches its target column',
);
const badgeSyncStart = projectionRuntimeSource.indexOf('function __tmSyncKanbanCompletedTodayBadgeInDOM');
const badgeSyncEnd = projectionRuntimeSource.indexOf('\n    function __tmFindKanbanNormalProjectionContainer', badgeSyncStart);
assert.ok(badgeSyncStart >= 0 && badgeSyncEnd > badgeSyncStart, 'kanban completed-today badge sync helper must exist');
const badgeSync = projectionRuntimeSource.slice(badgeSyncStart, badgeSyncEnd);
assert.match(badgeSync, /getAttribute\?\.\('data-status'\)[\s\S]*=== '__done__'/,
    'the standalone completed column must be treated as a completed badge context');
assert.match(badgeSync, /__tmIsCompletedRootGroupKey\(groupKey\)/,
    'kanban completed tail groups must keep the same completed badge context');
assert.match(badgeSync, /__tmRenderCompletedTodayBadge\(taskLike, \{/,
    'live kanban badges must use the shared completed-today renderer');

console.log('kanban and whiteboard completed status tag contract tests passed');
