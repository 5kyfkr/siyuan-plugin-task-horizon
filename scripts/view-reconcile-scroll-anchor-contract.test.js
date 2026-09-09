'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const services = read('src/task-horizon/main/20-api-and-runtime-services.js');
const projection = read('src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js');
const renderRuntime = read('src/task-horizon/main/40-render-runtime.js');

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

assert.match(services, /function __tmCaptureViewScrollAnchor\(hostEl, itemSelector = '\[data-id\]'\)/);
assert.match(services, /function __tmRestoreViewScrollAnchor\(hostEl, snapshot\)/);

const listRerender = segment(services, 'function __tmRerenderListInPlace', 'function __tmShouldUseGlobalTimelineScroll');
assert.match(listRerender, /const scrollAnchor = __tmCaptureViewScrollAnchor\(body, 'tr\[data-id\]'\)/);
assert.match(listRerender, /__tmRestoreViewScrollAnchor\(body, scrollAnchor\)/);
assert.doesNotMatch(listRerender, /else if \(body\) body\.scrollTop/);

const listAppend = segment(services, 'function __tmReconcileListRowsForAppend', 'function __tmRerenderListInPlace');
assert.match(listAppend, /currentByKey = new Map/);
assert.match(listAppend, /before the next already-mounted stable row/);
assert.match(listAppend, /tbody\.insertBefore\(entry\.row, anchor\)/);
assert.match(listAppend, /liveLoadMoreRow/, 'append reconciliation must keep the live tail control mounted while loading');
assert.match(listAppend, /tmLastIncrementalAppendTailOnly/, 'append reconciliation must record whether insertion stayed at the tail');
assert.doesNotMatch(listAppend, /currentRows\.forEach\(\(row\) => \{[\\s\\S]*?row\.remove\(\)/, 'append reconciliation must not remove the tail control before inserting new rows');

const checklistRerender = segment(services, 'function __tmRerenderChecklistInPlace', 'function __tmGetKanbanColScrollKey');
assert.match(checklistRerender, /const scrollAnchor = __tmCaptureViewScrollAnchor\(pane, '\.tm-checklist-item\[data-id\]'\)/);
assert.match(checklistRerender, /__tmRestoreViewScrollAnchor\(pane, scrollAnchor\)/);
assert.match(checklistRerender, /__tmRestoreViewScrollAnchor\(nextPane, scrollAnchor\)/);

const parentReconcile = segment(services, 'function __tmTryReconcileKanbanParentCards', 'function __tmRerenderKanbanInPlace');
assert.match(parentReconcile, /currentCard\.replaceChildren\([\s\S]*nextCard\.childNodes/);
assert.match(parentReconcile, /globalThis\.__tmTryReconcileKanbanParentCards = __tmTryReconcileKanbanParentCards/);
assert.doesNotMatch(parentReconcile, /body\.replaceWith\(nextBody\)/);
assert.match(parentReconcile, /state\.\__tmProgressiveViewRender = null/);
assert.match(parentReconcile, /state\.\__tmProgressiveViewRender = progressiveJob/);

const optimisticFrame = segment(projection, 'const __tmOptimisticProjectionFramePending', 'function __tmCollectChecklistProjectionDomBlock');
assert.match(optimisticFrame, /entry\.mode === 'kanban'[\s\S]*__tmTryReconcileKanbanParentCards/);

const batch = segment(projection, 'function __tmRunTaskProjectionBatch', 'const __tmPendingProjectionEntries');
assert.match(batch, /batch\.structural === true[\s\S]*createSubtask[\s\S]*__tmTryReconcileKanbanParentCards/);

assert.match(renderRuntime, /savedChecklistScrollAnchor = __tmCaptureViewScrollAnchor\(pane, '\.tm-checklist-item\[data-id\]'\)/);
assert.match(renderRuntime, /savedListScrollAnchor = __tmCaptureViewScrollAnchor\(body, 'tr\[data-id\]'\)/);
assert.match(renderRuntime, /__tmRestoreViewScrollAnchor\(pane, desiredListAnchor\)/);
assert.match(renderRuntime, /__tmRestoreViewScrollAnchor\(body, desiredListAnchor\)/);

console.log('view reconcile and scroll anchor contract tests passed');
