'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const styles = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');
const renderSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js'),
    'utf8',
);
const runtimeSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'),
    'utf8',
);

assert.match(
    renderSource,
    /\$\{isPinnedCard \? ' tm-kanban-card--pinned' : ''\}/,
    'rendered pinned kanban cards must expose a semantic pinned class',
);
assert.match(
    styles,
    /\.tm-kanban--clean \.tm-kanban-subtask-row\.tm-kanban-card:not\(\.tm-kanban-card--pinned\)\s*\{\s*border:\s*0;/,
    'clean kanban styling must remove the card border only from unpinned subtasks',
);
assert.doesNotMatch(
    styles,
    /\.tm-kanban--clean \.tm-kanban-subtask-row\.tm-kanban-card\s*\{[^}]*border:\s*0;/,
    'pinned subtasks must retain the base kanban card border',
);
assert.equal(
    (runtimeSource.match(/card\.classList\.toggle\('tm-kanban-card--pinned', pinned\)/g) || []).length,
    2,
    'both optimistic projection paths must synchronize the pinned class',
);

console.log('pinned kanban subtask border contract tests passed');
