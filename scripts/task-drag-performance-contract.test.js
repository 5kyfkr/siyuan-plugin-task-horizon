'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
    path.resolve(__dirname, '..', 'src', 'task-horizon', 'main', '30-dialogs-and-ui-foundation.js'),
    'utf8',
);
const externalRouting = fs.readFileSync(
    path.resolve(__dirname, '..', 'src', 'task-horizon', 'main', '41-external-task-drag-routing.js'),
    'utf8',
);
const start = source.indexOf('function __tmBindDockPointerTaskDrag');
const end = source.indexOf('window.tmRowClick', start);
assert.ok(start >= 0 && end > start, 'desktop task drag handler must be present');
const dragHandler = source.slice(start, end);

assert.match(dragHandler, /requestAnimationFrame\(/, 'desktop hover work must be frame scheduled');
assert.match(
    dragHandler,
    /__tmPlaceDockPointerTaskGhost\(ghostMeta, lastX, lastY\);\s*queueHoverSync\(\);/,
    'ghost position must update immediately before hover work is queued',
);
assert.doesNotMatch(
    dragHandler,
    /__tmPlaceDockPointerTaskGhost\(ghostMeta, lastX, lastY\);\s*syncHover\(\);/,
    'pointermove must not run the full hover synchronously',
);
assert.match(dragHandler, /flushHoverSync\(\);\s*await finishDrop\(\);/, 'drop must flush the latest hover target');
assert.match(dragHandler, /taskRowHoverKey\s*=\s*''/, 'task-row hover state must be cached');
assert.match(dragHandler, /kanbanHoverTarget\s*=\s*null/, 'kanban hover state must be cached and reset');
assert.doesNotMatch(source, /__tmTaskDragDebug|tmTaskHorizonTaskDragDebugEnable/, 'task drag debug runtime must be removed');
assert.doesNotMatch(externalRouting, /\[task-horizon\]\[task-drag\]/, 'external drag logging must be removed');

console.log('task drag performance contract tests passed');
