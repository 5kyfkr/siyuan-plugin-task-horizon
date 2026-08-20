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

const quickAddCommandStart = indexSource.indexOf('langKey: COMMAND_OPEN_QUICK_ADD_TASK_WINDOW');
assert.notEqual(quickAddCommandStart, -1, 'the quick-add command must be registered');
const quickAddCommandSource = indexSource.slice(quickAddCommandStart, indexSource.indexOf('this.addCommand(quickAddCommand)', quickAddCommandStart));
assert.match(quickAddCommandSource, /langText: "新建任务窗口"/, 'the quick-add command must have a visible SiYuan shortcut label');
assert.match(quickAddCommandSource, /hotkey: ""/, 'the quick-add command must leave its default shortcut unassigned');
assert.match(indexSource, /globalCallback[\s\S]*openQuickAddFromMainWindow/, 'desktop quick-add must use SiYuan global shortcuts');
assert.doesNotMatch(indexSource, /\[task-horizon:quick-add(?::renderer)?\]/, 'temporary quick-add diagnostics must not be emitted');
assert.match(quickAddCommandSource, /callback:[\s\S]*openQuickAddFromMainWindow/, 'the normal command path must use the same main-window behavior');
assert.match(indexSource, /async openQuickAddFromMainWindow\(\)[\s\S]*showMainElectronWindow\(\)[\s\S]*openQuickAddTaskWindow\(\)/, 'quick-add must restore the main window before opening the existing modal');
assert.match(indexSource, /getCurrentElectronWindow\(\)[\s\S]*nodeRequire\("@electron\/remote"\)/, 'desktop shortcut must resolve the current SiYuan Electron window');
assert.match(indexSource, /currentWindow\.isMinimized\?\.\(\)[\s\S]*currentWindow\.restore\?\.\(\)/, 'a minimized SiYuan window must be restored before opening quick-add');
assert.match(indexSource, /currentWindow\.show\?\.\(\)[\s\S]*currentWindow\.focus\?\.\(\)/, 'the main SiYuan window must be shown and focused');
assert.match(indexSource, /async openQuickAddTaskWindow\(\)[\s\S]*ensureTaskMainLoaded\(\)[\s\S]*globalThis\.tmQuickAddOpen/, 'the existing quick-add implementation must remain the only modal implementation');
assert.doesNotMatch(indexSource, /new runtime\.BrowserWindow|QUICK_ADD_WINDOW|ExternalQuickAdd|externalQuickAdd|transparent: true/, 'the shortcut must not create a second transparent window');

const quickAddRuntimeSource = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '53b-task-create-and-quick-add-runtime.js'), 'utf8');
assert.match(quickAddRuntimeSource, /window\.tmQuickAddOpen = async function\(\)[\s\S]*tmQuickAddOpenDatePicker/, 'the main-window shortcut must reuse the original quick-add implementation and date hub');
assert.match(quickAddRuntimeSource, /onclick="tmQuickAddOpenDatePicker\(\)"/, 'the original date control must remain unchanged');
assert.match(quickAddRuntimeSource, /window\.tmQuickAddOpen = async function\(\) \{[\s\S]*?await __tmEnsureSettingsLoaded\(\);/, 'quick-add must wait for settings when opened during background startup');
assert.match(quickAddRuntimeSource, /window\.tmQuickAddSubmit = async function\(\)[\s\S]*return \(async \(\) => \{/, 'quick-add submit must return the actual task creation promise');
assert.doesNotMatch(quickAddRuntimeSource, /__tmQuickAddDebug|runtime-submit:(?:start|background|create-success|create-error)/, 'quick-add timing diagnostics must be removed');
assert.match(quickAddRuntimeSource, /__tmRefreshQuickAddCustomFieldScope[\s\S]*tmQuickAddSelectDoc[\s\S]*await __tmRefreshQuickAddCustomFieldScope/, 'document changes must refresh scoped custom fields before rendering');
assert.doesNotMatch(quickAddRuntimeSource, /__tmBuildQuickAddWindowHtml|__tmGetQuickAddWindowInit|__tmSubmitQuickAddWindowPayload|__tmQuickAddSurfaceController|tm-quick-add-standalone|tm-quick-add-shared-styles/, 'the external window must not maintain a second quick-add implementation');

console.log('plugin command contract tests passed');
