'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const store = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const remaining = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/64-export-runtime.js'), 'utf8');
const settings = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/60-settings-screen.js'), 'utf8');
const actions = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/70-doc-group-and-settings-actions.js'), 'utf8');
const taskModel = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js'), 'utf8');

assert.match(store, /remainingTimeUseWorkdays:\s*false/);
assert.match(store, /cloudData\.remainingTimeUseWorkdays/);
assert.match(store, /tm_remaining_time_use_workdays/);
assert.match(remaining, /const calcWorkdayDiff = \(targetDayStartTs\) =>/);
assert.match(remaining, /weekday !== 0 && weekday !== 6/);
assert.match(remaining, /SettingsStore\.data\.remainingTimeUseWorkdays/);
assert.match(settings, /updateRemainingTimeUseWorkdays\(this\.checked\)/);
assert.match(actions, /window\.updateRemainingTimeUseWorkdays = async function/);
assert.match(actions, /updateRemainingTimeUseWorkdays = async function[\s\S]*state\.listRenderSignature = ''[\s\S]*state\.listDomRenderSignature = ''/);
assert.match(actions, /__tmRerenderCurrentViewInPlace/);
assert.doesNotMatch(taskModel, /remainingTimeUseWorkdays/);

console.log('remaining time workday contract tests passed');
