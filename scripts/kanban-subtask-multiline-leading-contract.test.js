const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const styles = read('task-horizon.css').replace(/\r\n/g, '\n');
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

const firstLineRowSelector = '.tm-kanban-subtask-row-main:is(.tm-kanban-subtask-row-main--title-wrapped, :has(> .tm-kanban-subtask-text > .tm-kanban-subtask-meta))';
const firstLineCheckboxSelectors = ['.tm-kanban.tm-kanban--clean', '.tm-whiteboard.tm-kanban--clean']
    .map(surface => '.tm-modal.tm-modal--task-wrap ' + surface + ' ' + firstLineRowSelector + ' > .tm-task-checkbox-wrap')
    .join(',\n');
assert.ok(
    styles.includes('.tm-modal.tm-modal--task-wrap ' + firstLineRowSelector + ' {\n    align-items: flex-start;'),
    'only actually wrapped titles or rows with metadata must use first-line alignment',
);
assert.ok(
    styles.includes(firstLineCheckboxSelectors + ' {\n    margin-top: var(--tm-card-circle-checkbox-offset, max(0px, calc(((var(--tm-font-size) - 1px) * 1.35 - var(--tm-checkbox-size, 14px)) / 2)));'),
    'only first-line rows must use the actual circle or square checkbox offset',
);
assert.match(
    styles,
    /\.tm-kanban--clean \.tm-kanban-subtask-title\s*\{[^}]*font-size:\s*calc\(var\(--tm-font-size\) - 1px\);\s*line-height:\s*1\.35;/,
    'first-line checkbox alignment must use the same font size and line height as the title',
);
assert.match(
    styles,
    /\.tm-task-detail--task-checkbox-circle \.tm-whiteboard-card-head\s*\{[^}]*--tm-card-circle-checkbox-title-font-size:\s*calc\(var\(--tm-font-size\) - 1px\);[^}]*--tm-card-circle-checkbox-offset:\s*max\(0px,\s*calc\(\(var\(--tm-card-circle-checkbox-title-font-size\) \* var\(--tm-card-circle-checkbox-title-line-height\) - var\(--tm-circle-checkbox-size, 16px\)\) \/ 2\)\);/,
    'circle checkbox offsets must follow the actual circle size instead of the square checkbox size',
);
assert.match(
    styles,
    /\.tm-modal--task-checkbox-circle \.tm-kanban--clean \.tm-kanban-subtask-row-main,[^{]*\{\s*--tm-card-circle-checkbox-title-line-height:\s*1\.35;/,
    'clean kanban and whiteboard circle offsets must use the subtask title line height',
);
assert.doesNotMatch(
    styles,
    /\.tm-modal\.tm-modal--task-wrap \.tm-kanban-subtask-row-main\s*\{[^}]*align-items:\s*flex-start;/,
    'enabling title wrapping must not force single-line subtask contents to the top of the card',
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
