const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const workbench = fs.readFileSync(path.join(root, 'src/ai/agent-workbench.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'src/ai/agent-workbench.css'), 'utf8');

assert.match(workbench, /schemaVersion: 2,[\s\S]*builtinPresetOverrides: \{\},[\s\S]*hiddenBuiltinPresetIDs: \[\]/, 'preset store must keep overrides and hidden built-ins separately');
assert.match(workbench, /function getPreset\(id\)[\s\S]*hiddenBuiltinPresetIDs\.includes\(key\)[\s\S]*builtinPresetOverrides\[key\]/, 'built-in presets must resolve user overrides and hidden state');
assert.match(workbench, /data-agent-action="new-preset"[\s\S]*phosphorBoldContextIcon\('plus'\)/, 'new preset must use the bundled Phosphor Bold plus icon');
assert.doesNotMatch(workbench, /data-agent-action="new-preset"[^\n]*#iconAdd/, 'new preset must not depend on the missing SiYuan icon sprite');
['edit-builtin-preset', 'delete-builtin-preset', 'restore-builtin-presets', 'reset-builtin-preset'].forEach((action) => {
    assert.match(workbench, new RegExp(`data-agent-action=["']${action}["']|action === ["']${action}["']`), `missing built-in preset action: ${action}`);
});
assert.match(workbench, /pinnedPresetIDs:[\s\S]*normalizePinnedPresetIDs/, 'preset store must persist pinned presets');
assert.match(workbench, /const pinned = runtime\.store\.pinnedPresetIDs[\s\S]*return pinned\.concat/, 'pinned presets must lead contextual suggestions');
assert.match(workbench, /data-agent-action="toggle-pin-preset"/, 'preset rows must expose a pin action');
assert.match(workbench, /tm-agent-suggestions[\s\S]*tm-agent-suggestions__settings[\s\S]*data-agent-action="open-presets"/, 'preset settings must sit at the end of the suggestion row');
assert.doesNotMatch(workbench, /tm-agent-composer__selections[^\n]*data-agent-action="open-presets"/, 'preset settings must not sit above the composer');
assert.doesNotMatch(workbench, /tm-agent-header__actions[\s\S]{0,1000}data-agent-action="open-presets"/, 'preset settings must not remain in the header actions');
assert.match(workbench, /is-unpin[\s\S]*取消置顶/, 'pinned presets must expose a distinct unpin icon and label');
assert.match(workbench, /tm-agent-preset-editor-backdrop[\s\S]*role="dialog"[\s\S]*aria-modal="true"/, 'preset editor must render as a modal dialog');
assert.match(workbench, /基于内置模板（可选）[\s\S]*data-agent-preset-template[\s\S]*空白预设/, 'new custom presets must offer an optional built-in template');
assert.match(workbench, /function fillPresetEditorFromBuiltin\(select\)[\s\S]*getPreset\(select\.value\)[\s\S]*preset\.prompt[\s\S]*preset\.starter/, 'template selection must copy the currently resolved built-in preset fields');
assert.match(workbench, /listen\('change'[\s\S]*data-agent-preset-template[\s\S]*fillPresetEditorFromBuiltin/, 'the template selector must populate the preset editor');
assert.match(workbench, /<span>对话附带指令<\/span>/, 'preset prompt field must use the user-facing attached-instruction label');
assert.match(workbench, /builtinPresetOverrides,[\s\S]*hiddenBuiltinPresetIDs,[\s\S]*pinnedPresetIDs,[\s\S]*policy/, 'preset customizations and pins must be included in settings export');
assert.match(workbench, /'task-create': \{[\s\S]*label: '创建任务'[\s\S]*starter: '我想创建一个任务'/, 'create task must be an independent built-in preset');
assert.match(workbench, /\{ label: '创建任务', preset: 'task-create' \}/, 'create-task suggestion must activate the create-task preset');
assert.doesNotMatch(workbench, /label: '创建任务', preset: 'task-capture'/, 'create-task suggestion must not activate the split-task preset');
assert.match(workbench, /getTaskCreationDestinations[\s\S]*插件默认新建位置 documentID[\s\S]*不要询问位置、不要预览、不要要求额外确认/, 'single-task creation must use the configured default destination directly');
assert.match(workbench, /当前没有可用的插件默认新建位置[\s\S]*创建到哪个文档[\s\S]*custom=true[\s\S]*解析真实文档 ID/, 'manual destination selection must remain the fallback when no default exists');
assert.match(workbench, /没有真实任务块时[\s\S]*configure_task_reminder[\s\S]*省略 taskID[\s\S]*taskTitle[\s\S]*默认 documentID/, 'unbound reminders must use the same default creation destination without a separate task call');
assert.match(styles, /\.tm-agent-preset-action\s*\{[\s\S]*width: 28px[\s\S]*color: var\(--b3-theme-on-surface\)/, 'preset icon buttons must have a visible stable size and color');
assert.match(styles, /\.tm-agent-preset-pin\.is-unpin::after[\s\S]*rotate\(-45deg\)/, 'unpin state must visibly slash the pin icon');
assert.match(styles, /\.tm-agent-preset-editor-backdrop\s*\{[\s\S]*position: absolute[\s\S]*place-items: center/, 'preset editor backdrop must center the modal');

console.log('agent preset contract tests passed');
