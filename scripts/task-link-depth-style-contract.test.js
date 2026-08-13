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
    /function __tmIsTaskLinkEndpointSubtask[\s\S]*?Number\.isFinite\(level\)[\s\S]*?__tmResolveWhiteboardTaskParentId/,
    'whiteboard and timeline must share one endpoint-depth classifier',
);
assert.match(
    whiteboard,
    /const fromIsSubtask = isSubtaskEndpoint\(link\.from, fromProxy\)[\s\S]*?const toIsSubtask = isSubtaskEndpoint\(link\.to, toProxy\)[\s\S]*?const isSubtaskEdge = fromIsSubtask \|\| toIsSubtask[\s\S]*?tm-whiteboard-edge--subtask-endpoint/,
    'whiteboard paths must mark links whose source or target is a subtask',
);
assert.match(
    whiteboard,
    /const routeFromIsSubtask = isSubtaskEndpoint\(routeFromTaskId, routeFromProxy\)[\s\S]*?const routeToIsSubtask = isSubtaskEndpoint\(routeToTaskId, routeToProxy\)[\s\S]*?const isSubtaskPreview = routeFromIsSubtask \|\| routeToIsSubtask[\s\S]*?tm-whiteboard-edge--subtask-endpoint/,
    'whiteboard link previews must use the same endpoint-depth style',
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
    /const hasSubtaskEndpoint = __tmIsTaskLinkEndpointSubtask\(link\.from\)[\s\S]*?\|\| __tmIsTaskLinkEndpointSubtask\(link\.to\)[\s\S]*?tm-gantt-dep--subtask-endpoint/,
    'timeline paths must mark links whose source or target is a subtask',
);
assert.match(
    timeline,
    /const previewFromTaskId = fromSide === 'in' \? targetTaskId : fromTaskId[\s\S]*?const previewToTaskId = fromSide === 'in' \? fromTaskId : targetTaskId[\s\S]*?__tmIsTaskLinkEndpointSubtask[\s\S]*?tm-gantt-dep--subtask-endpoint/,
    'timeline previews must classify both endpoints after input-side direction reversal',
);
assert.match(
    styles,
    /\.tm-whiteboard-edge\.tm-whiteboard-edge--subtask-endpoint\s*\{[\s\S]*?stroke-dasharray:\s*6 4;/,
    'whiteboard links with any subtask endpoint must be dashed',
);
assert.doesNotMatch(whiteboard, /tm-whiteboard-edge--root-source/, 'whiteboard root links must use the solid base style without a redundant class');
assert.doesNotMatch(styles, /\.tm-whiteboard-edge\.tm-whiteboard-edge--root-source/, 'whiteboard must not keep a redundant root-link override');
assert.match(
    styles,
    /\.tm-whiteboard\.tm-kanban--clean \.tm-whiteboard-subcard\.tm-whiteboard-card--selected,\s*\.tm-whiteboard\.tm-kanban--clean \.tm-whiteboard-node--sub\.tm-whiteboard-node--has-links\s*\{[\s\S]*?border-color:\s*var\(--tm-primary-color\);[\s\S]*?box-shadow:\s*inset 0 0 0 2px color-mix\(in srgb, var\(--tm-primary-color\) 18%, transparent\);/,
    'linked and selected whiteboard subtasks must share a contained outline style',
);
assert.match(
    styles,
    /\.tm-gantt-dep\.tm-gantt-dep--subtask-endpoint\s*\{[\s\S]*?stroke-dasharray:\s*6 4;/,
    'timeline links with any subtask endpoint must be dashed',
);
assert.doesNotMatch(timeline, /tm-gantt-dep--root-source/, 'timeline root links must use the solid base style without a redundant class');
assert.doesNotMatch(styles, /\.tm-gantt-dep\.tm-gantt-dep--root-source/, 'timeline must not keep a redundant root-link override');
assert.doesNotMatch(styles, /\.tm-whiteboard-edge\.tm-whiteboard-edge--auto\s*\{[^}]*stroke-dasharray:/, 'whiteboard auto links must inherit endpoint dash styling');
assert.doesNotMatch(styles, /\.tm-whiteboard-edge\.tm-whiteboard-edge--preview\s*\{[^}]*stroke-dasharray:/, 'whiteboard previews must inherit endpoint dash styling');
assert.doesNotMatch(styles, /\.tm-gantt-dep\.tm-gantt-dep--auto\s*\{[^}]*stroke-dasharray:/, 'timeline auto links must inherit endpoint dash styling');
assert.doesNotMatch(whiteboard, /markerIdIn|subtaskMarkerIdIn|marker-start=/, 'whiteboard must not define unused input markers');
assert.doesNotMatch(timeline, /markerIdIn|marker-start=/, 'timeline must not define unused input markers');

console.log('task link depth style contract tests passed');
