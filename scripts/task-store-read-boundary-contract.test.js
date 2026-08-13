'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const boundary = read('src', 'task-horizon', 'main', '33-task-boundary-facades.js');
assert.match(boundary, /const getTask = \(taskId, options = \{\}\) => \{[\s\S]*__tmTaskStore\?\.get\?\.\(id/,
    'the public task read boundary must delegate to TaskStore');
assert.doesNotMatch(boundary, /state\.(?:flatTasks|pendingInsertedTasks)|__tmRuntimeState/,
    'the public task read boundary must not grow a second fallback hierarchy');

const viewReaders = [
    ['checklist renderer', 'render', '42-render-list-and-checklist-body.js'],
    ['timeline and kanban renderer', 'render', '43-render-timeline-kanban-calendar-body.js'],
    ['local time projector', 'render', '46-render-local-task-time-refresh.js'],
    ['side panel renderer', 'render', '47-render-side-panels-and-view-switching.js'],
    ['calendar support', 'render', '48-render-calendar-support-runtime.js'],
];

for (const [label, folder, file] of viewReaders) {
    const source = read('src', 'task-horizon', 'main', folder, file);
    assert.match(source, /__tmTaskBoundary\?\.getTask\?\./, `${label} must read tasks through TaskBoundary`);
    assert.doesNotMatch(source, /__tmRuntimeState\?\.(?:getTaskById|getFlatTaskById|getPendingTaskById)/,
        `${label} must not retain the legacy runtime-state read chain`);
    assert.doesNotMatch(source, /state\.(?:flatTasks|pendingInsertedTasks)\?\.\[/,
        `${label} must not bypass pending-aware task reads`);
}

const serviceReaders = [
    ['query and reconcile service', '10-stores-rules-and-cache.js'],
    ['mutation and integration service', '20-api-and-runtime-services.js'],
    ['task action service', 'task-runtime', '53-list-render-and-document-loader.js'],
    ['native document bridge', 'shell', '72-shell-entrances-and-native-doc-hooks.js'],
];

for (const [label, ...parts] of serviceReaders) {
    const source = read('src', 'task-horizon', 'main', ...parts);
    assert.match(source, /__tmTaskBoundary\?\.getTask\?\./, `${label} must use TaskBoundary`);
    assert.doesNotMatch(source, /__tmRuntimeState\?\.getTaskById/,
        `${label} must not retain the legacy combined task reader`);
}

const queryService = read('src', 'task-horizon', 'main', '10-stores-rules-and-cache.js');
assert.match(queryService, /getTask\?\.\(taskId, \{ includePending: false, preferPending: false \}\)/,
    'authoritative SQL reconciliation must explicitly exclude optimistic pending rows');

console.log('task store read boundary contract: ok');
