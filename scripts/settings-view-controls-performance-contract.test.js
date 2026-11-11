'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
const segment = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, `missing segment ${start}`);
    return source.slice(from, to);
};

const actions = read('src/task-horizon/main/settings/70-doc-group-and-settings-actions.js');
const settingsScreen = read('src/task-horizon/main/settings/60-settings-screen.js');
const appearance = read('src/task-horizon/main/settings/61-settings-appearance-and-import.js');
const runtime = read('src/task-horizon/main/20-api-and-runtime-services.js');

const enabledView = segment(actions, 'window.updateEnabledView = async function', 'window.tmMoveEnabledView = async function');
const moveView = segment(actions, 'window.tmMoveEnabledView = async function', 'window.updateViewSwitcherStyle = async function');
const switcherStyle = segment(actions, 'window.updateViewSwitcherStyle = async function', 'window.updateKanbanCompactMode = async function');

assert.match(actions, /function __tmPersistViewControlSettings\(\)[\s\S]*SettingsStore\.save\(\)[\s\S]*SettingsStore\.saveNow\?\.\(\)[\s\S]*Promise\.resolve\(immediate \|\| pending\)/,
    'view controls must start an immediate file flush without blocking the UI update');
assert.match(actions, /function __tmRefreshViewControlSettingsInPlace\(\)[\s\S]*__tmRefreshEnabledViewSettingsLight[\s\S]*__tmRefreshViewSwitcherControlsInPlace/,
    'view controls must refresh the settings block and mounted switcher in place');
assert.doesNotMatch(enabledView, /showSettings\(\)/, 'enabling or disabling a view must not rebuild the settings modal');
assert.doesNotMatch(moveView, /showSettings\(\)|\brender\(\)/, 'reordering views must not rebuild settings or the task view');
assert.doesNotMatch(switcherStyle, /showSettings\(\)|\brender\(\)/, 'switcher text/icon changes must not rebuild settings or the task view');
assert.match(enabledView, /previousView === state\.viewMode[\s\S]*refreshAfterViewChange/,
    'the task view may repaint only when the currently active view was disabled');

assert.match(settingsScreen, /state\.__tmRefreshEnabledViewSettingsLight = \(\)[\s\S]*data-tm-settings-chip-key[\s\S]*appendChild\(chip\)[\s\S]*tm-view-order__list/,
    'enabled-view settings must reorder existing chips and rows without a full render');
assert.match(settingsScreen, /state\.__tmRefreshViewSwitcherStyleSettingsLight = \(value\)[\s\S]*data-tm-view-switcher-style-option[\s\S]*aria-checked/,
    'switcher style controls must update their active state in place');
assert.match(appearance, /data-tm-view-switcher-style-option="icons"[\s\S]*data-tm-view-switcher-style-option="text"/,
    'both switcher style choices must be individually addressable');
assert.match(runtime, /const __tmRefreshViewSwitcherControlsInPlace =[\s\S]*tm-mobile-bottom-view-switcher[\s\S]*__tmRenderViewSwitcherButtons[\s\S]*__tmGetEnabledViews\(\)\.length/,
    'mounted desktop and mobile view switchers must refresh without a full shell render');

console.log('settings view controls performance contract tests passed');
