'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'),
    'utf8',
);
const servicesSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'),
    'utf8',
);
const stateSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/32-runtime-state-and-events.js'),
    'utf8',
);
const projectionEngineSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/34-task-projection-engine.js'),
    'utf8',
);
const foundationSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'),
    'utf8',
);
const listRuntimeSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js'),
    'utf8',
);

const scheduleChecklist = source.slice(
    source.indexOf('function __tmScheduleChecklistDeferredProjectionRefresh'),
    source.indexOf('function __tmShouldFallbackTaskFieldPatch'),
);
const scheduleProjection = source.slice(
    source.indexOf('function __tmScheduleTaskProjectionRefresh'),
    source.indexOf('function __tmRefreshKanbanProjectionPatchNow'),
);

assert.match(scheduleChecklist, /immediateProjection = opts\.fastProjectionApplied !== true[\s\S]*__tmGetPatchFieldKeys\(patch\)\.includes\('pinned'\)[\s\S]*Number\(delayMs\) <= 0/);
assert.match(scheduleChecklist, /const waitMs = 0/,
    'checklist projections must not retain a fixed mobile or desktop delay');
assert.doesNotMatch(scheduleChecklist, /360|180|140/,
    'the projection scheduler must not reintroduce device-specific interaction delays');
assert.match(scheduleChecklist, /bypassTaskFieldDefer:\s*immediateProjection[\s\S]*bypassScrollDefer:\s*immediateProjection[\s\S]*bypassInteractionDefer:\s*immediateProjection/,
    'optimistic checklist projection must not wait for background, scroll, or interaction quiet windows');
assert.match(scheduleProjection, /immediateProjection[\s\S]*immediateProjectionRefresh\s*===\s*true[\s\S]*includes\('pinned'\)/);
assert.match(scheduleProjection, /immediateProjectionRefresh === true[\s\S]*includes\('pinned'\)/,
    'local optimistic projection refreshes must bypass deferred list scheduling');
assert.match(scheduleProjection, /fastProjectionApplied !== true[\s\S]*immediateProjectionRefresh === true/,
    'a completed fast projection must defer only the heavier corrective render');
assert.match(scheduleProjection, /immediateProjection\s*\?[\s\S]*immediate:\s*true[\s\S]*delayMs:\s*0/,
    'list pinned changes must enter the next-frame view refresh');
assert.match(scheduleProjection, /immediateProjection\s*\?\s*0\s*:\s*__tmGetChecklistProjectionRefreshDelayMs\(\)/,
    'local optimistic checklist projection refreshes must bypass the mobile delay');
assert.match(scheduleProjection, /bypassTaskFieldDefer:\s*immediateProjection[\s\S]*bypassScrollDefer:\s*immediateProjection[\s\S]*bypassInteractionDefer:\s*immediateProjection/,
    'immediate local projections must reach the next frame without scheduler quiet-window deferral');
assert.match(stateSource, /function flushTaskChangeSets|const flushTaskChangeSets/);
assert.match(stateSource, /__tmTaskProjectionEngine\?\.flush\?\.\(entries\)/,
    'all optimistic field mutations must delegate one ChangeSet batch to ProjectionEngine');
assert.doesNotMatch(stateSource.slice(stateSource.indexOf('const flushTaskChangeSets = () =>'), stateSource.indexOf('const scheduleTaskChangeSet')),
    /__tmRefreshTaskFieldsAcrossViews|withFilters/,
    'TaskStore must not decide view refresh policy');
assert.match(projectionEngineSource, /changedFields\.has\('pinned'\)/,
    'pinned ordering must be declared once in ProjectionEngine');
assert.match(stateSource, /normalized\.phase === 'optimistic'[\s\S]*scheduleTaskChangeSet\(normalized, changeSet\)/,
    'the unified projection manager must render field changes during the optimistic phase');
const fastChecklistProjection = source.slice(
    source.indexOf('function __tmTryApplyChecklistOptimisticProjectionInPlace'),
    source.indexOf('function __tmRefreshKanbanProjectionPatchNow'),
);
const projectionFrame = source.slice(
    source.indexOf('function __tmScheduleOptimisticProjectionFrame'),
    source.indexOf('function __tmTryApplyChecklistOptimisticProjectionInPlace'),
);
assert.match(projectionFrame, /__tmRecomputeTaskProjection\([\s\S]*entries\.forEach[\s\S]*requestAnimationFrame\(run\)/,
    'optimistic projections must batch filtering once per animation frame');
assert.match(projectionFrame, /withFilters: !filtersApplied[\s\S]*projection-frame-fallback/,
    'a failed local projection must retain an authoritative render fallback');
assert.match(fastChecklistProjection, /filtersApplied !== true[\s\S]*__tmScheduleOptimisticProjectionFrame\('checklist'[\s\S]*__tmBuildTaskRowModel\(\)[\s\S]*createDocumentFragment\(\)[\s\S]*targetContainer\.insertBefore/,
    'checklist optimistic projection must reuse the current task subtree after the shared filter frame');
assert.match(fastChecklistProjection, /sourceGroupCard[\s\S]*!sourceGroupCard\.querySelector\('\.tm-checklist-item\[data-id\]'\)[\s\S]*sourceGroupCard\.remove\(\)/,
    'fast checklist projection must remove a compact source group after its last task moves away');
assert.match(fastChecklistProjection, /compactChecklist[\s\S]*target\.groupKey[\s\S]*!\(targetContainer instanceof HTMLElement\)\) return false;/,
    'compact checklist projection must fall back before moving a task when its target group card does not exist');
const fastKanbanProjection = source.slice(
    source.indexOf('function __tmTryApplyKanbanOptimisticProjectionInPlace'),
    source.indexOf('function __tmRefreshKanbanProjectionPatchNow'),
);
assert.match(fastKanbanProjection, /filtersApplied !== true[\s\S]*__tmScheduleOptimisticProjectionFrame\('kanban'[\s\S]*rankById[\s\S]*targetContainer\.insertBefore\(card/,
    'kanban field projection must reuse and move the mounted card after the shared filter frame');
assert.match(source, /function __tmFindKanbanNormalProjectionContainer[\s\S]*__tmGetKanbanExpectedProjectionGroupKeys[\s\S]*targetSignature/,
    'kanban projection must require an exact target group instead of guessing across groups');
const kanbanProjectionFallback = source.slice(
    source.indexOf('function __tmRefreshKanbanProjectionPatchNow'),
    source.indexOf('function __tmBuildMergedAttrPatch'),
);
assert.match(kanbanProjectionFallback, /opts\.fastProjectionApplied === true[\s\S]*__tmTryApplyKanbanOptimisticProjectionInPlace[\s\S]*return __tmScheduleViewRefresh/,
    'a successful kanban fast projection must skip the full-board refresh while retaining a safe fallback');
const localAttrPatch = servicesSource.slice(
    servicesSource.indexOf('function __tmApplyAttrPatchLocally'),
    servicesSource.indexOf('function __tmRollbackAttrPatchLocally'),
);
assert.match(localAttrPatch, /__tmDoesPatchAffectProjection[\s\S]*listDomRenderSignature\s*=\s*''[\s\S]*__tmInvalidateFilteredTaskDerivedStateCache/,
    'local projection field patches must invalidate derived render state');
const visibleWindowSignature = foundationSource.slice(
    foundationSource.indexOf('function __tmBuildVisibleTaskWindowContentSignature'),
    foundationSource.indexOf('function __tmGetVisibleTaskFingerprint'),
);
assert.match(visibleWindowSignature, /push\(task\.pinned\s*\?\s*'1'\s*:\s*'0'\)/,
    'visible render signatures must change when pinned state changes without changing task order');
assert.doesNotMatch(servicesSource + listRuntimeSource, /__tmLogPinnedDirect|\[Task Horizon\]\[Pinned\]\[Direct\]/,
    'temporary pinned diagnostics must not remain in production writes');
const checklistGroupProjection = servicesSource.slice(
    servicesSource.indexOf('function __tmReconcileChecklistProjectionCard'),
    servicesSource.indexOf('function __tmRerenderChecklistInPlace'),
);
assert.match(checklistGroupProjection, /currentTaskNodes[\s\S]*currentBody\.insertBefore\(node, cursor\)/,
    'compact checklist projection must move existing task nodes by id');
assert.doesNotMatch(checklistGroupProjection, /currentCard\.replaceWith\(nextCard\.cloneNode\(true\)\)/,
    'compact checklist projection must not replace the full affected group card');
assert.match(checklistGroupProjection, /!currentCards\.length && !nextCards\.length[\s\S]*!currentCards\.length \|\| !nextCards\.length\) return false;/,
    'compact checklist projection must use the authoritative body swap when card topology changes');
const pinnedEntry = listRuntimeSource.slice(
    listRuntimeSource.indexOf('window.tmSetPinned'),
    listRuntimeSource.indexOf('\n    window.', listRuntimeSource.indexOf('window.tmSetPinned') + 1),
);
assert.match(pinnedEntry, /__tmRequireTaskMutation\?\.\('patchTask'\)[\s\S]*background: true,[\s\S]*wait: false/,
    'pinned changes must use the same optimistic task field command as every view');
assert.doesNotMatch(pinnedEntry, /withFilters|forceProjectionRefresh|optimisticProjectionRefresh|skipSettledRefresh/,
    'field entry points must not own projection refresh policy');

console.log('pinned task projection contract tests passed');
