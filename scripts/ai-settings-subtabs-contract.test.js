const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const navRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js'), 'utf8');
const settingsScreen = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/60-settings-screen.js'), 'utf8');
const scheduledSettings = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/66-scheduled-events-settings.js'), 'utf8');
const policySettings = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/67-agent-policy-settings.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');

assert.match(navRuntime, /function __tmGetSettingsSections\(tab = state\.settingsActiveTab \|\| ''\)/, 'settings sections must be shared by the main and AI tabs');
assert.match(navRuntime, /\{ id: 'ai-mode', label: '工作方式' \}/, 'AI settings must expose a mode section');
assert.match(navRuntime, /\{ id: 'ai-agent', label: '智能体' \}/, 'agent mode must expose an agent section');
assert.match(navRuntime, /\{ id: 'ai-connection', label: '模型设置' \}/, 'legacy mode must expose a model section');
assert.match(navRuntime, /\{ id: 'ai-scheduled', label: '定时事件' \}/, 'both AI modes must expose scheduled events');
assert.match(navRuntime, /__tmGetSettingsSections\(state\.settingsActiveTab \|\| ''\)\.length/, 'scroll sync must support AI settings sections');
assert.match(settingsScreen, /const renderSettingsSubtabs = \(\) =>/, 'AI and main settings must share the subtab renderer');
assert.match(settingsScreen, /activeTab === 'ai' \? `\$\{renderSettingsSubtabs\(\)\}\$\{renderAiSettingsPanel\(\)\}`/, 'AI settings must render the subtabs above its panels');
assert.match(settingsScreen, /data-tm-settings-section="ai-mode"/, 'AI mode panel must be a navigable section');
assert.match(settingsScreen, /data-tm-settings-section="ai-agent"/, 'agent panel must be a navigable section');
assert.match(settingsScreen, /data-tm-settings-section="ai-connection"/, 'legacy model panel must be a navigable section');
assert.match(scheduledSettings, /data-tm-settings-section="ai-scheduled"/, 'scheduled events panel must be a navigable section');
assert.match(policySettings, /data-tm-settings-section="ai-policy"/, 'arrangement policy panel must be a navigable section');
assert.match(styles, /\.tm-settings-subtabs\s*\{[\s\S]*position:\s*sticky/, 'AI navigation must reuse the existing sticky subtab styling');

console.log('AI settings subtabs contract tests passed');
