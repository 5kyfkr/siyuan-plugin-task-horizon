'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('./i18n-vm-fixture');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('src/task-horizon/manifest.main.json'));
const utils = read('src/task-horizon/main/06a-duration-utils.js');
const picker = read('src/task-horizon/main/20a-duration-picker.js');
const detail = read('src/task-horizon/main/task-runtime/52-task-detail-runtime.js');
const inline = read('src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js');
const quickbar = read('quickbar.js');
const dialogs = read('src/task-horizon/main/30-dialogs-and-ui-foundation.js');
const api = read('src/task-horizon/main/20-api-and-runtime-services.js');
const css = read('task-horizon.css');

assert.ok(manifest.scripts.includes('main/06a-duration-utils.js'), 'duration utils must be in the dev manifest');
assert.ok(manifest.scripts.includes('main/20a-duration-picker.js'), 'duration picker must be in the dev manifest');

assert.match(utils, /globalThis\.__tmDuration = Object\.freeze/, 'duration utils must expose a shared global');
assert.match(utils, /function parse\(value, unit\)/, 'duration utils must expose a unit-aware parser');
assert.match(utils, /function toStorage\(minutes, unit\)/, 'duration utils must write unitless numbers');
assert.match(utils, /function formatPresetLabel\(value, unit\)/, 'duration utils must format preset labels');

assert.match(picker, /data-tm-duration-picker/, 'picker must expose a stable root marker');
assert.match(picker, /storageInput/, 'picker must support an existing storage input');
assert.match(picker, /forwardKey[\s\S]*KeyboardEvent/, 'picker must forward Enter/Escape to the storage input');
assert.match(picker, /__tmDurationPicker = api/, 'picker must attach itself to the storage input for focus handling');

assert.match(detail, /data-tm-duration-picker-slot/, 'detail focus-summary must contain a picker slot');
assert.match(detail, /__tmCreateDurationPicker\(\{[\s\S]*data-tm-detail-inline-popover-input/, 'detail popover must build the shared picker');
assert.match(detail, /const picker = target\.__tmDurationPicker;/, 'detail focus must prefer the picker API');
assert.match(inline, /data-tm-duration-picker-slot/, 'inline focus-summary must contain a picker slot');
assert.doesNotMatch(detail, /<span>\$\{__tmT\(\"quickbar\.estimatedDuration\"\)\}<\/span><small class=\"tm-focus-estimate-source\"/, 'detail duration field must not repeat its tab title above the source hint');
assert.doesNotMatch(detail, /<span>\$\{__tmT\(\"quickbar\.estimatedPomodoros\"\)\}<\/span><small class=\"tm-focus-estimate-source\"/, 'detail pomodoro field must not repeat its tab title above the source hint');
assert.doesNotMatch(inline, /<span>\$\{__tmT\(\"quickbar\.estimatedDuration\"\)\}<\/span><small class=\"tm-focus-estimate-source\"/, 'inline duration field must not repeat its tab title above the source hint');
assert.doesNotMatch(inline, /<span>\$\{__tmT\(\"quickbar\.estimatedPomodoros\"\)\}<\/span><small class=\"tm-focus-estimate-source\"/, 'inline pomodoro field must not repeat its tab title above the source hint');
assert.doesNotMatch(quickbar, /estimateField\.innerHTML = `\<span>\$\{__tmT\(\"quickbar\.estimatedPomodoros\"\)\}\<\/span>/, 'quickbar pomodoro field must not repeat its tab title above the source hint');
assert.match(detail, /data-tm-focus-estimate aria-label=/, 'detail pomodoro estimate input must retain an accessible name');
assert.match(inline, /aria-label=.*quickbar\.estimatedPomodoros/, 'inline pomodoro estimate input must retain an accessible name');
assert.match(quickbar, /estimateInput\.setAttribute\('aria-label'/, 'quickbar pomodoro estimate input must retain an accessible name');

assert.match(inline, /__tmCreateDurationPicker\(\{[\s\S]*data-tm-focus-duration/, 'inline editor must build the shared picker');
assert.match(inline, /const picker = target\.__tmDurationPicker;/, 'inline focus must prefer the picker API');
assert.match(quickbar, /__tmCreateDurationPicker\(\{[\s\S]*storageInput: input/, 'quickbar must reuse its main input as the storage value');
assert.match(quickbar, /__tmDurationPicker\.destroy\(\)/, 'quickbar cleanup must destroy the picker');
assert.match(quickbar, /formatPresetLabel/, 'quickbar preset rows must render formatted labels');

assert.match(dialogs, /function __tmNormalizeDurationInputValue[\s\S]*__tmDuration\.parse[\s\S]*__tmDuration\.toStorage/, 'duration prompt must normalize compound input through the shared parser');
assert.doesNotMatch(dialogs, /resolve\(__tmNormalizeDurationPresetValue\(value\)\)/, 'duration prompt must not truncate compound input to its first number');
assert.match(dialogs, /const duration = String\(next \|\| ''\)\.trim\(\)/, 'batch duration must use the normalized prompt value');

assert.match(api, /formatPresetLabel/, 'preset chips must render formatted labels');
assert.match(api, /data-tm-duration-preset-value="\$\{esc\(value\)\}"/, 'preset chips must keep the raw numeric value');
assert.match(css, /\.tm-duration-picker__input/, 'picker styles must exist');
assert.match(css, /width: min\(252px, calc\(100vw - 20px\)\)/, 'focus-summary panels must widen to 252px');
assert.match(css, /\.tm-focus-summary-editor__field \{[^}]*gap: 8px;/, 'estimate source hint and input must have clearer separation');
assert.match(css, /\.tm-focus-estimate-source \{[^}]*margin-top: 8px;/, 'estimate source hint must have breathing room above');
assert.match(css, /\.tm-focus-summary-editor__panel\[data-tm-focus-summary-panel="tomato"\] \.tm-focus-estimate-source \{[^}]*margin-top: 0;/, 'pomodoro source hint must stay close to its tab');
assert.match(css, /\.tm-focus-summary-editor__readonly \{[^}]*margin-top: 0;/, 'actual focus values must sit closer to the estimate input');
assert.match(css, /\.tm-focus-summary-editor__readonly span \{[^}]*padding: 3px 6px;/, 'actual focus values must use compact vertical padding');

const actions = read('src/task-horizon/main/settings/70-doc-group-and-settings-actions.js');
const settingsScreen = read('src/task-horizon/main/settings/60-settings-screen.js');
const presetSettings = read('src/task-horizon/main/settings/62-settings-columns-and-rules.js');
assert.match(actions, /updateDurationFormat[\s\S]*showConfirm\(__tmT\("settings.switchDurationUnit"\)[\s\S]*settings.afterSwitchingNumbersInExistingTasksAndPresetsAre/, 'unit switching must warn without converting');
assert.match(settingsScreen, /__tmT\("settings.durationUnit"\)/, 'settings must label the unit explicitly');
assert.match(settingsScreen, /settings.controlsWhetherTaskDurationsAndPresetNumbersAreInterpreted/, 'settings must explain the no-conversion behaviour');
assert.match(presetSettings, /formatPresetLabel/, 'preset editor must show a formatted preview');
assert.match(presetSettings, /i18n\.html\("settings.durationValueCurrentUnitAcceptsMH30mWithAutomatic", \{ unitName: unitName \}\)/, 'preset editor title must safely include the current unit');
assert.match(presetSettings, /updateDurationOption[\s\S]*__tmNormalizeDurationInputValue/, 'preset editing must accept formatted duration input');
assert.match(presetSettings, /addDurationOption[\s\S]*__tmNormalizeDurationInputValue/, 'adding a preset must accept formatted duration input');

const promptStart = dialogs.indexOf('function __tmNormalizeDurationInputValue');
const promptEnd = dialogs.indexOf('function showDurationPrompt', promptStart);
assert.ok(promptStart >= 0 && promptEnd > promptStart, 'duration prompt normalizer must exist');
const context = { SettingsStore: { data: { durationFormat: 'hours' } } };
vm.createContext(context);
vm.runInContext(utils, context);
vm.runInContext(`${dialogs.slice(promptStart, promptEnd)}\nthis.normalizeInput = __tmNormalizeDurationInputValue;`, context);
assert.equal(context.normalizeInput('2h30m'), '2.5', 'hours mode must store 2h30m as 2.5');
assert.equal(context.normalizeInput('90分钟'), '1.5', 'hours mode must convert Chinese minutes');
assert.equal(context.normalizeInput('2.5'), '2.5');
assert.equal(context.normalizeInput(''), '');
assert.equal(context.normalizeInput('abc'), '');
context.SettingsStore.data.durationFormat = 'minutes';
assert.equal(context.normalizeInput('2h30m'), '150', 'minutes mode must store 2h30m as 150');
assert.equal(context.normalizeInput('2'), '2', 'minutes mode must keep whole numbers as minutes');

console.log('duration picker contract tests passed');
