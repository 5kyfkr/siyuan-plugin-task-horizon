const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const styles = read('task-horizon.css');
const services = read('src/task-horizon/main/20-api-and-runtime-services.js');
const renderRuntime = read('src/task-horizon/main/40-render-runtime.js');
const contentRuntime = read('src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js');
const kanbanRuntime = read('src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js');

assert.match(services, /function __tmSyncKanbanSubtaskWrappedTitleClasses\(rootEl\)/);
assert.match(services, /tm-kanban-subtask-row-main--title-wrapped/);
assert.match(services, /title\.offsetHeight \|\| title\.getBoundingClientRect\?\.\(\)\.height/);

// The wrapped-title sync must be a shell-level automatic pass, not a call every
// renderer has to remember: any DOM rebuild (progressive batches, projections,
// deletes, detail panels) must be measured once on the frame it appears.
assert.match(services, /function __tmEnsureKanbanSubtaskWrapAutoSync\(host\)/);
assert.match(services, /new MutationObserver/);
assert.match(services, /attributes: true/);
assert.match(services, /attributeFilter: \['hidden', 'aria-hidden', 'class', 'style'\]/, 'reveal paths are attribute-only and must be watched');
assert.match(services, /observer\.observe\(root, \{[\s\S]*?childList: true,[\s\S]*?subtree: true,[\s\S]*?attributes: true/);
assert.match(services, /node\.closest\?\.\('\.tm-kanban-subtask-row-main'\)/, 'rebuilds inside an existing row must remeasure that row');
assert.match(services, /globalThis\.__tmEnsureKanbanSubtaskWrapAutoSync = __tmEnsureKanbanSubtaskWrapAutoSync/);
assert.match(
    services,
    /if \(measuredHeight <= 0\) \{[\s\S]*?measurable = false;/,
    'hidden or mid-rebuild rows must keep their last known alignment instead of snapping back later',
);
assert.match(
    renderRuntime,
    /renderMode === 'kanban' \|\| renderMode === 'whiteboard'[\s\S]*?__tmSyncKanbanSubtaskWrappedTitleClasses\?\.\(state\.modal\)[\s\S]*?__tmEnsureKanbanSubtaskWrapAutoSync\?\.\(state\.modal\)/,
    'kanban and whiteboard shells must install the automatic wrapped-title watcher',
);
assert.doesNotMatch(
    kanbanRuntime,
    /__tmSyncKanbanSubtaskWrappedTitleClasses/,
    'progressive batches must rely on the shell watcher instead of per-path sync calls',
);
assert.match(contentRuntime, /__tmSyncKanbanSubtaskWrappedTitleClasses\?\.\(root\)/);

assert.match(
    styles,
    /\.tm-modal\.tm-modal--task-wrap \.tm-kanban-subtask-row-main\.tm-kanban-subtask-row-main--title-wrapped\s*\{[\s\S]*?align-items:\s*flex-start;/,
    'wrapped kanban subtasks must follow the parent card top-aligned layout',
);
assert.match(
    styles,
    /\.tm-modal\.tm-modal--task-wrap \.tm-kanban\.tm-kanban--clean \.tm-kanban-subtask-row-main\.tm-kanban-subtask-row-main--title-wrapped > \.tm-task-checkbox-wrap,\s*\.tm-modal\.tm-modal--task-wrap \.tm-whiteboard\.tm-kanban--clean \.tm-kanban-subtask-row-main\.tm-kanban-subtask-row-main--title-wrapped > \.tm-task-checkbox-wrap\s*\{[\s\S]*?margin-top:\s*max\(0px,\s*calc\(0\.675em - 8px\)\);/,
    'wrapped clean kanban and whiteboard subtasks must share the parent checkbox offset',
);
assert.match(
    styles,
    /\.tm-kanban\.tm-kanban--clean \.tm-kanban-subtask-row-main,\s*\.tm-whiteboard\.tm-kanban--clean \.tm-kanban-subtask-row-main\s*\{[\s\S]*?align-items:\s*center;/,
    'single-line kanban and whiteboard subtasks must share the centered row layout',
);
assert.match(
    styles,
    /\.tm-whiteboard\.tm-kanban--clean \.tm-kanban-subtask-row-main > \.tm-task-checkbox-wrap \.tm-task-checkbox\s*\{[\s\S]*?margin-top:\s*0;/,
    'single-line whiteboard subtasks must drop the first-line checkbox offset like kanban',
);

console.log('kanban subtask multiline leading contract tests passed');
