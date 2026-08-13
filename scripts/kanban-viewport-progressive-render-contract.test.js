'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const stateRuntime = read('src/task-horizon/main/21-view-render-state.js');
const kanbanRuntime = read('src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js');
const renderRuntime = read('src/task-horizon/main/40-render-runtime.js');
const dialogs = read('src/task-horizon/main/30-dialogs-and-ui-foundation.js');
const styles = read('task-horizon.css');

assert.match(stateRuntime, /initialBatchSize: __TM_KANBAN_PROGRESSIVE_BATCH_SIZE/, 'kanban must render ten visible cards in its first column batch');
assert.match(stateRuntime, /new IntersectionObserver[\s\S]*rootMargin: '0px 35% 0px 35%'/, 'horizontal column loading must be viewport driven');
assert.match(stateRuntime, /__tmIsKanbanProgressiveColumnNearBottom[\s\S]*remaining <=/, 'a visible column must request another batch only near its tail');
assert.match(stateRuntime, /__tmGetHighPriorityInteractionWaitMs/, 'card loading must yield while touch or drag interaction is active');
assert.match(stateRuntime, /viewportProbeAttempts/, 'a view switch must retry after a not-yet-measurable first layout');
assert.match(stateRuntime, /boundBody/, 'replaced kanban shells must rebind the viewport loader to the new body');
assert.match(stateRuntime, /const retry = result\?\.retry === true/, 'transient column patch failures must remain retryable');
assert.doesNotMatch(stateRuntime, /runKanbanBatch|requestAnimationFrame\(runKanbanBatch\)/, 'kanban must not drain all columns through animation frames');

assert.match(stateRuntime, /function __tmPatchKanbanProgressiveColumn[\s\S]*document\.createElement\('template'\)/, 'later batches must be staged outside the live column');
assert.match(stateRuntime, /__tmMergeKanbanProgressiveChildren[\s\S]*liveParent\.insertBefore\(liveChild, liveCursor\)/, 'later batches must preserve mounted cards and insert only missing nodes');
assert.match(stateRuntime, /__tmCaptureKanbanProgressiveScrollAnchor[\s\S]*document\.elementsFromPoint/, 'later batches must capture the visible card instead of relying on an absolute scroll offset');
assert.match(stateRuntime, /__tmRestoreKanbanProgressiveScrollAnchor[\s\S]*currentTop \+ delta/, 'cards inserted above the viewport must preserve the visible anchor');
assert.match(stateRuntime, /A concurrent structural projection can invalidate the monotonic prefix/, 'the append path must retain an explicit consistency fallback');
assert.doesNotMatch(kanbanRuntime, /body\.innerHTML = nextColumnRender\.html/, 'progressive loading must not rebuild an existing column prefix');
assert.match(kanbanRuntime, /__tmPatchKanbanProgressiveColumn/, 'the kanban renderer must use the shared incremental column patcher');
assert.doesNotMatch(kanbanRuntime, /const scrollTop = Number\(body\.scrollTop[\s\S]*body\.scrollTop = scrollTop/, 'progressive batches must not cancel mobile momentum with an unconditional absolute scroll write');
assert.match(kanbanRuntime, /insideCollapsedTask \|\| collapsed/, 'hidden descendants of a collapsed parent must stay mounted without consuming the visible-card batch');
assert.match(kanbanRuntime, /done: false, retry: true/, 'a replaced shell must not permanently finish a pending column');
assert.match(renderRuntime, /__tmRequestKanbanProgressiveColumnLoad\?\.\(colKey\)/, 'expanding a deferred column must request its first batch');
assert.match(renderRuntime, /__tmScheduleProgressiveViewRender\('kanban', progressiveJob\)/, 'full renders must resume the current kanban progressive job');

assert.match(dialogs, /mode !== 'list' && mode !== 'checklist' && mode !== 'timeline'/, 'table, checklist, and timeline must share one near-bottom loader');
assert.match(dialogs, /remainingPx > thresholdPx/, 'list-like views must wait until the shared scrollport is near its tail');
assert.match(dialogs, /appendOnly: true/, 'list-like continuation must preserve mounted rows');
assert.match(renderRuntime, /return Math\.max\(0, Math\.ceil\(\(Number\(colBody\.scrollHeight\)/, 'mobile bottom-nav measurement must avoid per-card layout reads');
assert.match(styles, /\.tm-kanban-deferred\s*\{[\s\S]*min-height: 48px;/, 'deferred columns must reserve a stable visible loading area');

console.log('kanban viewport progressive render contract tests passed');
