'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const storeSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', '10-stores-rules-and-cache.js'),
    'utf8',
);
const runtimeSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', '20-api-and-runtime-services.js'),
    'utf8',
);
const settingsSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', 'settings', '60-settings-screen.js'),
    'utf8',
);

assert.match(storeSource, /excludeCompletedTasks:\s*false,[\s\S]{0,80}showCompletedTasks:\s*true/,
    'new settings must show completed tasks by default');
assert.match(runtimeSource, /showCompletedTasks:\s*true,[\s\S]{0,50}excludeCompletedTasks:\s*false/,
    'runtime state must show completed tasks by default');
assert.match(storeSource, /const hasStoredShowCompletedTasks = Storage\.has\('tm_show_completed_tasks'\)/);
assert.match(storeSource, /if \(!hasStoredShowCompletedTasks\) this\.data\.showCompletedTasks = !this\.data\.excludeCompletedTasks/,
    'existing users must retain the legacy stored visibility choice');
assert.match(settingsSource, /默认开启，避免完成任务后从列表中消失/,
    'settings copy must explain the default visibility');

console.log('completed task visibility default contract tests passed');
