const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const quickbar = fs.readFileSync(path.join(root, 'quickbar.js'), 'utf8');
const settings = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/60-settings-screen.js'), 'utf8');
const actions = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/70-doc-group-and-settings-actions.js'), 'utf8');
const stores = fs.readFileSync(path.join(root, 'src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const bridge = fs.readFileSync(path.join(root, 'src/task-horizon/main/shell/81-ai-bridge-runtime.js'), 'utf8');
const remainingRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/64-export-runtime.js'), 'utf8');

const defStart = quickbar.indexOf("{ attrKey: 'custom-start-date'");
const defEnd = quickbar.indexOf("{ attrKey: 'taskCompleteAt'", defStart);
assert.ok(defStart >= 0 && defEnd > defStart, 'quickbar definitions must place date fields before completion time');
const defs = quickbar.slice(defStart, defEnd);
assert.match(defs, /custom-start-date/);
assert.match(defs, /custom-completion-time/);
assert.match(defs, /remainingTime/);
assert.ok(defs.indexOf('custom-start-date') < defs.indexOf('custom-completion-time'));
assert.ok(defs.indexOf('custom-completion-time') < defs.indexOf('remainingTime'));

const renderStart = quickbar.indexOf("if (attrKey === 'remainingTime')");
const renderEnd = quickbar.indexOf("if (attrKey === 'taskCompleteAt')", renderStart);
assert.ok(renderStart >= 0 && renderEnd > renderStart, 'remaining time render branch must exist');
const renderBranch = quickbar.slice(renderStart, renderEnd);
assert.match(renderBranch, /getTaskRemainingTimeInfo/);
assert.match(renderBranch, /renderTaskRemainingTimeInfoHtml/);
assert.match(renderBranch, /custom-start-date/);
assert.match(renderBranch, /custom-completion-time/);

assert.match(settings, /\{ key: 'custom-start-date', label: '开始日期' \}[\s\S]*\{ key: 'custom-completion-time', label: '截止日期' \}[\s\S]*\{ key: 'remainingTime', label: '剩余时间' \}/);
assert.match(actions, /const allow = new Set\(\[[^\]]*remainingTime/);
assert.match(stores, /const allowInlineFields = new Set\(\[[^\]]*remainingTime/);
assert.match(bridge, /getTaskRemainingTimeInfo\(task, options = \{\}\)/);
assert.match(bridge, /renderTaskRemainingTimeInfoHtml\(info\)/);
assert.match(remainingRuntime, /const taskDone = typeof __tmIsTaskDoneEffective[\s\S]*if \(taskDone\) \{[\s\S]*__tmResolveTaskCompletedAtRaw[\s\S]*recurringSourceDue[\s\S]*completedDeltaDays[\s\S]*提前\$\{completedDeltaDays\}天[\s\S]*延期\$\{Math\.abs\(completedDeltaDays\)\}天/);

console.log('quickbar inline remaining time contract tests passed');
