const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const kanban = read('src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js');
const whiteboard = read('src/task-horizon/main/render/44-render-whiteboard-body.js');
const cardRuntime = read('src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js');
const timeRefresh = read('src/task-horizon/main/render/46-render-local-task-time-refresh.js');
const css = read('task-horizon.css');

assert.ok(kanban.includes('const isTaskOverdue = __tmIsTaskCardDateOverdue(task, completedTodayKey);'));
assert.ok(kanban.includes("tm-kanban-card--overdue' : ''"));
assert.ok(whiteboard.includes('const isTaskOverdue = __tmIsTaskCardDateOverdue(task, todayKey);'));
assert.ok(whiteboard.includes("tm-kanban-card--overdue' : ''"));
assert.ok(cardRuntime.includes("root.classList.toggle('tm-kanban-card--overdue', __tmIsTaskCardDateOverdue(effectiveTask));"));
assert.ok(cardRuntime.includes("root.classList.toggle('tm-kanban-card--overdue', __tmIsTaskCardDateOverdue(taskLike));"));
assert.ok(timeRefresh.includes("card.classList.toggle('tm-kanban-card--overdue', __tmIsTaskCardDateOverdue(taskForRender));"));
assert.ok(timeRefresh.includes("node.classList.toggle('tm-kanban-card--overdue', __tmIsTaskCardDateOverdue(task));"));
assert.match(
    css,
    /\.tm-kanban--clean \.tm-kanban-card\.tm-kanban-card--overdue:where\([^}]+\),[\s\S]*\.tm-whiteboard\.tm-kanban--clean \.tm-whiteboard-node\.tm-kanban-card\.tm-kanban-card--overdue:where\([^}]+\)\s*\{\s*border:\s*1px solid var\(--tm-time-group-overdue-color, var\(--tm-danger-color\)\);/,
);

console.log('card overdue border contract passed');
