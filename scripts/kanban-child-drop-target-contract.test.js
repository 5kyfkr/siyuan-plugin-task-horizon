'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const runtime = fs.readFileSync(path.join(root, 'src/task-horizon/main/40-render-runtime.js'), 'utf8');

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

const resolver = segment(
    runtime,
    'function __tmResolveKanbanChildDropCard',
    'function __tmClearKanbanChildDropCandidate',
);
assert.match(resolver, /targetOrEvent\?\.target instanceof Element/);
assert.match(resolver, /directTarget\?\.closest\?\.\('\.tm-kanban-card\[data-id\]'\)/);
assert.match(resolver, /document\.elementFromPoint\(x, y\)/);

const candidateUpdate = segment(
    runtime,
    'function __tmUpdateKanbanChildDropCandidate',
    'function __tmTakeReadyKanbanChildDropTarget',
);
assert.match(candidateUpdate, /const targetElement = __tmResolveKanbanChildDropCard\(targetOrEvent\)/);
assert.match(
    candidateUpdate,
    /if \(current\?\.sourceKey === sourceKey[\s\S]*?current\?\.targetElement === targetElement\) \{\s*return;/,
    'an unchanged card target must not rewrite its highlight class on every dragover',
);

const touchDrop = segment(runtime, 'const finishDrag = async () => {', 'const cleanup = () => {');
assert.match(touchDrop, /currentTarget: dropHost,\s*target: pointTarget,\s*clientX: lastX,\s*clientY: lastY,/);

const drop = segment(runtime, 'window.tmKanbanDrop = async function(ev) {', 'const doneBoardEnabled =');
assert.match(drop, /const eventChildDropCard = __tmResolveKanbanChildDropCard\(ev\)/);
assert.match(drop, /const directChildDropTargetId = String\(eventChildDropCard\?\.getAttribute/);
assert.match(drop, /const childDropTargetId = eventChildDropCard\s*\? directChildDropTargetId\s*:\s*candidateChildDropTargetId/);
assert.match(drop, /__tmHandleTaskRowDropCore\(ev, targetId, 'child'\)/);

console.log('kanban child drop target contract tests passed');
