'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const checklist = read('src/task-horizon/main/render/42-render-list-and-checklist-body.js');
const timeline = read('src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js');
const whiteboard = read('src/task-horizon/main/render/44-render-whiteboard-body.js');
const legacyTimeline = read('src/task-horizon/main/20-api-and-runtime-services.js');

assert.match(checklist, /const taskDone = typeof __tmIsTaskDoneEffective === 'function'[\s\S]*?const doneCls = taskDone/,
    'checklist rows must use effective completion state for completed styling');
assert.match(checklist, /__tmRenderTaskCheckbox\([^\n]*checked: taskDone/,
    'checklist row checkboxes must use effective completion state');

for (const source of [timeline, legacyTimeline]) {
    assert.match(source, /const taskDone = typeof __tmIsTaskDoneEffective === 'function'[\s\S]*?const isDoneSubtask = taskDone/,
        'timeline rows must use effective completion state for done styling');
    assert.match(source, /__tmRenderTaskCheckbox\([^\n]*checked: taskDone/,
        'timeline row checkboxes must use effective completion state');
    assert.doesNotMatch(source, /<span class="tm-task-text \$\{task\.done \? 'tm-task-done'/,
        'timeline task text must not read raw done state');
}

assert.match(whiteboard, /__tmRenderTaskCheckboxWrap\(tid, task, \{ checked: isWhiteboardTaskDone\(task\)/,
    'whiteboard task checkboxes must use effective completion state');
assert.doesNotMatch(whiteboard, /tm-whiteboard-stream-task-title[^\n]*\$\{task\?\.done \? 'tm-task-done'/,
    'whiteboard task titles must not read raw done state');
assert.doesNotMatch(whiteboard, /const doneCls = task\?\.done \? ' tm-whiteboard-pool-item--done'/,
    'whiteboard task pool styling must not read raw done state');

console.log('recurring native done render contract passed');
