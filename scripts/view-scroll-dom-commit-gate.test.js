'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const stateRuntime = read('src/task-horizon/main/21-view-render-state.js');
const services = read('src/task-horizon/main/20-api-and-runtime-services.js');
const dialogs = read('src/task-horizon/main/30-dialogs-and-ui-foundation.js');
const kanban = read('src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js');

const gateStart = stateRuntime.indexOf('    function __tmGetViewScrollGate(');
const gateEnd = stateRuntime.indexOf('    function __tmRegisterViewWindowAdapter(', gateStart);
assert.ok(gateStart >= 0 && gateEnd > gateStart);

class FakeElement {}
const timers = [];
const context = vm.createContext({
    state: { viewMode: 'checklist' },
    HTMLElement: FakeElement,
    setTimeout: (callback) => { timers.push(callback); return timers.length; },
    clearTimeout: () => {},
    Array,
    String,
    Number,
    Set,
    Math,
});
vm.runInContext(stateRuntime.slice(gateStart, gateEnd), context);

let commits = 0;
const gate = context.__tmGetViewScrollGate('checklist');
gate.scrolling = true;
assert.equal(context.__tmQueueViewDomCommit('checklist', () => { commits += 1; }), true);
assert.equal(commits, 0, 'scrolling must defer DOM commits');
gate.scrolling = false;
assert.equal(context.__tmFlushViewDomCommit('checklist'), true);
assert.equal(commits, 1, 'deferred commit must flush after scrolling');

context.state.draggingTaskId = 'dragging-task';
assert.equal(context.__tmQueueViewDomCommit('checklist', () => { commits += 1; }), true);
assert.equal(commits, 1, 'dragging must defer DOM commits');
context.state.draggingTaskId = '';
while (timers.length) timers.shift()();
assert.equal(commits, 2, 'deferred commit must flush after drag ends');

context.state.__tmKanbanDragId = 'external-kanban-drag';
assert.equal(context.__tmQueueViewDomCommit('checklist', () => { commits += 1; }), true);
assert.equal(commits, 2, 'external kanban drag must defer DOM commits');
context.state.__tmKanbanDragId = '';
while (timers.length) timers.shift()();
assert.equal(commits, 3, 'external drag commit must flush after drag ends');

const priorityGate = context.__tmGetViewScrollGate('priority-check');
priorityGate.scrolling = true;
context.__tmQueueViewDomCommit('priority-check', () => { commits += 1; }, { priority: 100 });
context.__tmQueueViewDomCommit('priority-check', () => { commits += 100; }, { priority: 10 });
priorityGate.scrolling = false;
assert.equal(context.__tmFlushViewDomCommit('priority-check'), true);
assert.equal(commits, 4, 'low-priority commits must not replace a pending full-render fallback');

const preparedGate = context.__tmGetViewScrollGate('prepared-list');
preparedGate.scrolling = true;
assert.equal(context.__tmQueueViewDomCommit('prepared-list', () => { commits += 1; }, {
    allowDuringScroll: true,
    appendOnly: true,
    preparedOnly: true,
}), true);
assert.equal(commits, 5, 'prepared append-only commits may extend the tail during scrolling');
preparedGate.scrolling = true;
assert.equal(context.__tmQueueViewDomCommit('prepared-list', () => { commits += 10; }, {
    allowDuringScroll: true,
    appendOnly: true,
}), true);
assert.equal(commits, 5, 'unprepared commits must remain deferred during scrolling');

const rerenderList = services.slice(services.indexOf('    function __tmRerenderListInPlace('), services.indexOf('    function __tmShouldUseGlobalTimelineScroll', services.indexOf('    function __tmRerenderListInPlace(')));
const rerenderChecklist = services.slice(services.indexOf('    function __tmRerenderChecklistInPlace('), services.indexOf('    function __tmGetKanbanColScrollKey', services.indexOf('    function __tmRerenderChecklistInPlace(')));
const rerenderKanban = services.slice(services.indexOf('    function __tmRerenderKanbanInPlace('), services.indexOf('    function __tmRerenderWhiteboardInPlace', services.indexOf('    function __tmRerenderKanbanInPlace(')));
assert.match(rerenderList, /__tmIsViewDomCommitBlocked/);
assert.match(rerenderList, /__tmQueueViewDomCommit/);
assert.match(rerenderChecklist, /__tmIsViewDomCommitBlocked/);
assert.match(rerenderChecklist, /__tmQueueViewDomCommit/);
assert.match(rerenderKanban, /__tmIsViewDomCommitBlocked/);
assert.match(rerenderKanban, /__tmQueueViewDomCommit/);
assert.match(rerenderList, /preparedOnly/);
assert.match(rerenderList, /allowDuringScroll/);
assert.match(services, /tailOnlyRequired/);
assert.match(dialogs, /const onScroll = \(\) => \{[\s\S]*?__tmTrackViewScroll/);
assert.match(kanban, /loadNextBatch: \(modalEl, loadOptions = \{\}\) => \{[\s\S]*?__tmQueueViewDomCommit/);

console.log('view scroll DOM commit gate tests passed');
