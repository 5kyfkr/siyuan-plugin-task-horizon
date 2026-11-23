'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const services = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'),
    'utf8',
);
const start = services.indexOf('    function __tmIsMultiSelectSupportedView(mode) {');
const end = services.indexOf('    function __tmIsTaskMultiSelected(taskId)', start);
assert.ok(start >= 0 && end > start, 'multi-select view and ID normalization helpers must exist');

const context = vm.createContext({
    state: {
        viewMode: 'comboBoard',
        multiSelectModeEnabled: true,
        flatTasks: { taskA: {}, taskB: {} },
    },
    __tmIsWhiteboardAllTabsStreamMode: () => false,
});
vm.runInContext(services.slice(start, end), context, { filename: 'multi-select-view-helpers.js' });

assert.equal(vm.runInContext('__tmIsMultiSelectSupportedView()', context), true,
    'combination boards must be supported by the shared multi-select gate');
assert.equal(vm.runInContext('__tmIsMultiSelectActive()', context), true,
    'multi-select mode must be active on a combination board');
assert.deepEqual(
    JSON.parse(vm.runInContext('JSON.stringify(__tmNormalizeMultiSelectedTaskIds(["taskA", "taskA", "taskB", "missing"]))', context)),
    ['taskA', 'taskB'],
    'selection must deduplicate by task ID and discard tasks outside the loaded task map',
);

console.log('combination-board multi-select contract tests passed');
