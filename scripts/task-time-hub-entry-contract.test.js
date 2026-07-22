'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const detailSource = read('src', 'task-horizon', 'main', 'task-runtime', '52-task-detail-runtime.js');
const standaloneStart = detailSource.indexOf('async function __tmOpenStandaloneTaskTimeHub(');
const standaloneEnd = detailSource.indexOf('window.tmOpenTaskTimeHub = async function', standaloneStart);
assert.ok(standaloneStart >= 0 && standaloneEnd > standaloneStart, 'standalone task time hub must remain extractable');

const standaloneSource = detailSource.slice(standaloneStart, standaloneEnd);
assert.doesNotMatch(standaloneSource, /\bgetBoundTask(?:Id)?\b/, 'standalone time hub must not reference task-detail-only bindings');
assert.match(standaloneSource, /const repeatTask = task \|\| \{\};/, 'standalone repeat progress must use its refreshed task state');
assert.match(detailSource, /window\.tmOpenTaskTimeHub[\s\S]*__tmOpenStandaloneTaskTimeHub/, 'public time hub entry must delegate to the standalone implementation');

const entrySources = [
    ['table cells', read('src', 'task-horizon', 'main', 'task-runtime', '51-whiteboard-and-link-runtime.js'), /source:\s*'table-cell'/],
    ['Quickbar', read('quickbar.js'), /source:\s*'quickbar'/],
    ['kanban cards', read('src', 'task-horizon', 'main', '40-render-runtime.js'), /source:\s*'kanban-card'/],
    ['context menu', read('src', 'task-horizon', 'main', 'task-runtime', '53-list-render-and-document-loader.js'), /source:\s*'context-menu-completion-time'/],
    ['quick add', read('src', 'task-horizon', 'main', 'task-runtime', '53b-task-create-and-quick-add-runtime.js'), /tmOpenTaskTimeHub\('__tm_quick_add_draft__'/],
    ['points penalty editor', read('src', 'task-horizon', 'main', '20-api-and-runtime-services.js'), /tmOpenTaskTimeHub\(draftTaskId/],
];

for (const [label, source, marker] of entrySources) {
    assert.match(source, /tmOpenTaskTimeHub/, `${label} must use the shared task time hub`);
    assert.match(source, marker, `${label} task time hub call must remain identifiable`);
}

console.log('task time hub entry contract tests passed');
