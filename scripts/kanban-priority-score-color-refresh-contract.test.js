'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const runtime = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'),
    'utf8',
);
const renderer = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js'),
    'utf8',
);

const kanbanController = runtime.slice(
    runtime.indexOf('kanban: {'),
    runtime.indexOf('whiteboard: {', runtime.indexOf('kanban: {')),
);

assert.match(
    kanbanController,
    /__tmDoesPatchAffectPriorityScore\(patch\)[\s\S]*?tm-kanban-card-head \.tm-kanban-card-title-inline[\s\S]*?__tmApplyTaskTitleOpacityToElement\(title, task\)/,
    'kanban priority-score patches must update the mounted top-level card title color',
);
assert.doesNotMatch(
    kanbanController,
    /tm-kanban-card-head > \.tm-kanban-card-title-inline/,
    'the title selector must account for the card-text wrapper around top-level titles',
);
assert.match(
    renderer,
    /const titleAttrs = [\s\S]*__tmBuildTaskTitleOpacityStyle\(task\)/,
    'kanban rendering must apply the same priority-score title style that in-place updates refresh',
);

console.log('kanban priority-score color refresh contract tests passed');
