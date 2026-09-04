'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const renderSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/40-render-runtime.js'), 'utf8');
const uiSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');
const settingsSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'), 'utf8');

assert.match(renderSource, /const docTabsPinned = !docTabsAutoHide;/,
    'the pin state must remain the inverse of the existing auto-hide setting');
assert.match(renderSource, /class="tm-doc-tabs-pin-toggle bc-btn bc-btn--sm bc-btn--ghost"[\s\S]*?aria-pressed="\$\{docTabsPinned \? 'true' : 'false'\}"/,
    'the persistent pin control must expose its pressed state');
assert.doesNotMatch(renderSource, /\.tm-doc-tabs-pin-toggle\.is-active/,
    'the pin state must be communicated by its icon instead of a highlight color');
assert.match(renderSource, /const docTabsPinIcon = docTabsPinned \? 'push-pin-slash' : 'push-pin';/,
    'the pinned state must use the unpin action icon and the auto-hide state must use the pin action icon');
assert.match(renderSource, /__tmPhosphorBoldSvg\(docTabsPinIcon, \{ size: 14, className: 'tm-doc-tabs-pin-icon' \}\)/,
    'the pin control must use the requested Phosphor Bold icon');
assert.match(renderSource, /\.tm-doc-tabs-actions \{[\s\S]*?display: flex;/,
    'the desktop tab action area must remain visible without tab overflow');
assert.match(renderSource, /\.tm-doc-tabs-toggle \{[\s\S]*?display: none;[\s\S]*?\.tm-doc-tabs--overflowing \.tm-doc-tabs-toggle \{[\s\S]*?display: inline-flex;/,
    'only the multi-row control may depend on tab overflow');
assert.match(renderSource, /@media \(max-width: 768px\) \{[\s\S]*?\.tm-doc-tabs-pin-toggle \{[\s\S]*?display: none;/,
    'the pin control must be hidden on narrow viewports');
assert.match(renderSource, /@container tm-modal \(max-width: 768px\) \{[\s\S]*?\.tm-doc-tabs-pin-toggle \{[\s\S]*?display: none;/,
    'the pin control must be hidden in narrow desktop containers');
assert.match(renderSource, /@container tm-modal \(max-width: 768px\) \{[\s\S]*?\.tm-doc-tabs-actions \{[\s\S]*?display: none;[\s\S]*?\.tm-doc-tabs--overflowing \.tm-doc-tabs-actions \{[\s\S]*?display: flex;/,
    'narrow containers must restore overflow-gated action visibility');
assert.match(uiSource, /window\.tmToggleDocTabsPinned = function\(ev\)[\s\S]*?update\(!__tmDocTabsAutoHideEnabled\(\)\);/,
    'the pin control must toggle the existing auto-hide setting');
assert.match(uiSource, /'push-pin': 'M238\.15,78\.54[\s\S]*?'push-pin-slash': 'M56\.88,31\.93/,
    'the Phosphor Bold push-pin paths must remain bundled');
assert.match(settingsSource, /window\.updateDocTabsAutoHideEnabled = async function\(enabled\)[\s\S]*?SettingsStore\.data\.docTabsAutoHideEnabled = !!enabled;[\s\S]*?await SettingsStore\.save\(\);[\s\S]*?render\(\);/,
    'the shared setting handler must persist and render the new pin state');

console.log('doc tabs pin toggle contract tests passed');
