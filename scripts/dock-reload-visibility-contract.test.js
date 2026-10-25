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

const layoutReady = segment('    onLayoutReady() {', '    registerCommands() {');

// SiYuan runs onLayoutReady before mounting plugin docks. This hook must not
// rewrite the persisted show state, otherwise every startup clears the dock
// that the user left open in the previous session.
assert.doesNotMatch(source, /resetTaskDockReloadVisibility/);
assert.doesNotMatch(layoutReady, /local-plugin-docks|setStorageVal|\.show\s*=/);
assert.doesNotMatch(source, /\[task-horizon\]\[dock-debug\]/);

const dockKey = 'siyuan-plugin-task-horizon::task-horizon-dock';
const savedDocks = {
    'siyuan-plugin-task-horizon': {
        [dockKey]: {position: 'RightTop', index: 7, show: true},
    },
};
const {onLayoutReady} = vm.runInNewContext(`({${layoutReady}})`, {
    savedDocks,
    readMobileSidebarEnabled: () => false,
});

const calls = [];
const plugin = {
    _taskWindowTopBarLayoutReady: false,
    _taskDockAdded: true,
    isRuntimeMobileClient: () => false,
    syncWindowTopBar: () => calls.push('topbar'),
    syncCalendarSubscriptionTopBar: () => calls.push('calendar'),
    scheduleMobileStartupAutoOpen: () => calls.push('mobileAutoOpen'),
    ensureMobileTaskDockRegistered: (reason) => calls.push(`mobileRegister:${reason}`),
    scheduleMobileTaskDockRecovery: (reason) => calls.push(`mobileRecover:${reason}`),
};
onLayoutReady.call(plugin);
assert.equal(plugin._taskWindowTopBarLayoutReady, true);
assert.deepEqual(calls, ['topbar', 'calendar', 'mobileAutoOpen']);
assert.equal(savedDocks['siyuan-plugin-task-horizon'][dockKey].show, true,
    'an open Dock must survive the startup layout hook');

savedDocks['siyuan-plugin-task-horizon'][dockKey].show = false;
onLayoutReady.call(plugin);
assert.equal(savedDocks['siyuan-plugin-task-horizon'][dockKey].show, false,
    'a closed Dock must stay closed');

console.log('Dock reload visibility contract tests passed');
