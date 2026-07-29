const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.js'), 'utf8');

assert.match(
    indexSource,
    /const COMMAND_OPEN_TASK_HORIZON = "openTaskHorizon";/,
    'the task manager command must have a stable key for SiYuan shortcut settings',
);
const commandStart = indexSource.indexOf('langKey: COMMAND_OPEN_TASK_HORIZON');
const commandEnd = indexSource.indexOf('});', commandStart);
assert.notEqual(commandStart, -1, 'the task manager command must be registered');
const commandSource = indexSource.slice(commandStart, commandEnd + 3);
assert.match(commandSource, /langText: "打开任务管理器"/, 'the command must have a visible SiYuan shortcut label');
assert.match(commandSource, /hotkey: ""/, 'the command must leave its default shortcut unassigned');
assert.match(commandSource, /this\.openTaskHorizonTab\(\)/, 'the command must reuse the existing tab opener');

console.log('plugin command contract tests passed');
