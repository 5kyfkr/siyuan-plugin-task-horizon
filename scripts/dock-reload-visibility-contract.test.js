'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.js'), 'utf8');

const segment = (start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

const resetReloadVisibility = segment('const resetTaskDockReloadVisibility =', 'const fetchText =');
const persisted = [];
const sandbox = {
    siyuan: {
        storage: {
            'local-plugin-docks': {
                'siyuan-plugin-task-horizon': {
                    'siyuan-plugin-task-horizon::task-horizon-dock': { position: 'RightTop', index: 7, show: true },
                },
            },
        },
    },
    platformUtils: {
        setStorageVal: (key, value) => persisted.push({ key, value }),
    },
};

vm.runInNewContext(`
const PLUGIN_ID = "siyuan-plugin-task-horizon";
const TASK_DOCK_TYPE = "::task-horizon-dock";
${resetReloadVisibility}
this.resetTaskDockReloadVisibility = resetTaskDockReloadVisibility;
`, sandbox);

sandbox.resetTaskDockReloadVisibility({ name: 'siyuan-plugin-task-horizon' });
assert.equal(sandbox.siyuan.storage['local-plugin-docks']['siyuan-plugin-task-horizon']['siyuan-plugin-task-horizon::task-horizon-dock'].show, false);
assert.equal(persisted.length, 1);
assert.equal(persisted[0].key, 'local-plugin-docks');
sandbox.resetTaskDockReloadVisibility({ name: 'siyuan-plugin-task-horizon' });
assert.equal(persisted.length, 1, 'an already closed Dock must not be persisted again');

const layoutReady = segment('    onLayoutReady() {', '    registerCommands() {');
assert.match(layoutReady, /resetTaskDockReloadVisibility\(this\)/);
assert.doesNotMatch(source, /\[task-horizon\]\[dock-debug\]/);

console.log('Dock reload visibility contract tests passed');
