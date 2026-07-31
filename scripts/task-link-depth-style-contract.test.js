'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const linkRuntime = read('src', 'task-horizon', 'main', 'task-runtime', '51-whiteboard-and-link-runtime.js');
const whiteboardBody = read('src', 'task-horizon', 'main', 'render', '44-render-whiteboard-body.js');
const whiteboard = read('src', 'task-horizon', 'main', 'render', '49-render-whiteboard-interactions.js');
const timeline = read('src', 'task-horizon', 'main', 'shell', '82-gantt-runtime.js');
const styles = read('task-horizon.css');

assert.match(
    linkRuntime,
    /function __tmIsTaskLinkSourceSubtask[\s\S]*?Number\.isFinite\(level\)[\s\S]*?__tmResolveWhiteboardTaskParentId/,
    'whiteboard and timeline must share one source-depth classifier',
);
assert.match(
    whiteboard,
    /const isSubtaskSource = __tmIsTaskLinkSourceSubtask\(link\.from\)[\s\S]*?tm-whiteboard-edge--subtask-source/,
    'whiteboard paths must mark links whose real source is a subtask',
);
assert.match(
    whiteboard,
    /previewSourceIsSubtask[\s\S]*?tm-whiteboard-edge--subtask-source/,
    'whiteboard link previews must use the same source-depth style',
);
assert.match(
    whiteboardBody,
    /const manualNodeLinks = isGlobalCanvasDoc[\s\S]*?__tmGetWhiteboardGlobalTaskLinks\(\)[\s\S]*?__tmGetAllTaskLinks\(\{ docId, includeAuto: false \}\);[\s\S]*?const linkedTaskIdSet = new Set\(\);/,
    'whiteboard linked state must include global-board and document links',
);
assert.match(
    whiteboardBody,
    /const hasTaskLinks = linkedTaskIdSet\.has\(tid\);[\s\S]*?const linkCls = hasTaskLinks \? ' tm-whiteboard-node--has-links'/,
    'whiteboard task nodes with manual links must expose a persistent linked state',
);
assert.match(
    timeline,
    /const isSubtaskSource = __tmIsTaskLinkSourceSubtask\(link\.from\)[\s\S]*?tm-gantt-dep--subtask-source/,
    'timeline paths must mark links whose real source is a subtask',
);
assert.match(
    timeline,
    /const previewSourceTaskId = fromSide === 'in' \? targetTaskId : fromTaskId[\s\S]*?tm-gantt-dep--subtask-source/,
    'timeline previews must classify the source after input-side direction reversal',
);
assert.match(
    styles,
    /\.tm-whiteboard-edge\.tm-whiteboard-edge--subtask-source\s*\{[\s\S]*?stroke-dasharray:\s*6 4;/,
    'whiteboard subtask-source links must be dashed',
);
assert.match(
    styles,
    /\.tm-whiteboard-edge\.tm-whiteboard-edge--root-source\s*\{[\s\S]*?stroke-dasharray:\s*none;/,
    'whiteboard root-source links must stay solid even when they are automatic',
);
assert.match(
    styles,
    /\.tm-whiteboard\.tm-kanban--clean \.tm-whiteboard-subcard\.tm-whiteboard-card--selected,\s*\.tm-whiteboard\.tm-kanban--clean \.tm-whiteboard-node--sub\.tm-whiteboard-node--has-links\s*\{[\s\S]*?border-color:\s*var\(--tm-primary-color\);[\s\S]*?box-shadow:\s*inset 0 0 0 2px color-mix\(in srgb, var\(--tm-primary-color\) 18%, transparent\);/,
    'linked and selected whiteboard subtasks must share a contained outline style',
);
assert.match(
    styles,
    /\.tm-gantt-dep\.tm-gantt-dep--subtask-source\s*\{[\s\S]*?stroke-dasharray:\s*6 4;/,
    'timeline subtask-source links must be dashed',
);
assert.match(
    styles,
    /\.tm-gantt-dep\.tm-gantt-dep--root-source\s*\{[\s\S]*?stroke-dasharray:\s*none;/,
    'timeline root-source links must stay solid even when they are automatic',
);

console.log('task link depth style contract tests passed');
