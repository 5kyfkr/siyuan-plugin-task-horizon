'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const kanbanRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/40-render-runtime.js'), 'utf8');
const mutationRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'), 'utf8');
const mutationEvents = fs.readFileSync(path.join(root, 'src/task-horizon/main/32-runtime-state-and-events.js'), 'utf8');
const calendarRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/48-render-calendar-support-runtime.js'), 'utf8');
const apiRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

const kanbanStatusMove = segment(
    kanbanRuntime,
    'async function __tmKanbanMoveIdsToStatus',
    'window.tmKanbanDrop = async function(ev)',
);
assert.match(kanbanStatusMove, /persistSnapshot: true/,
    'status and done kanban drops must request snapshot persistence');

const kanbanDrop = segment(
    kanbanRuntime,
    'window.tmKanbanDrop = async function(ev)',
    'window.tmKanbanPickDate = async function(id, ev)',
);
assert.match(kanbanDrop, /kind === 'time'[\s\S]*?persistSnapshot: true/,
    'time kanban drops must request snapshot persistence');

assert.match(mutationRuntime, /persistSnapshot: opts\.persistSnapshot === true/,
    'queued task patches must carry the snapshot persistence intent');
assert.match(mutationEvents, /snapshotIdleDelayMs: 80,[\s\S]*persistSnapshot: m\.data\?\.persistSnapshot === true/,
    'committed task patches must forward the snapshot persistence intent');

const updateTaskDates = segment(
    calendarRuntime,
    'window.tmUpdateTaskDates = async function(taskId, patch = {}, options = {})',
    'const __tmUpdateTaskDatesCore = window.tmUpdateTaskDates',
);
assert.match(updateTaskDates, /persistSnapshot: opts\.persistSnapshot === true/,
    'timeline date updates must preserve the snapshot persistence intent');
assert.match(apiRuntime, /skipSnapshotPersist: opts\.skipSnapshotPersist === true,[\s\S]*persistSnapshot: opts\.persistSnapshot === true/,
    'metadata patch writes must pass snapshot persistence to the mutation queue');

console.log('kanban drag snapshot persistence contract tests passed');
