'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const settingsStore = read('src/task-horizon/main/10-stores-rules-and-cache.js');
const settingsScreen = read('src/task-horizon/main/settings/60-settings-screen.js');
const settingsActions = read('src/task-horizon/main/settings/71-ai-settings-and-save.js');
const bridge = read('src/task-horizon/main/shell/81-ai-bridge-runtime.js');
const workbench = read('src/ai/agent-workbench.js');
const styles = read('src/ai/agent-workbench.css');
const legacy = read('ai.js');

assert.match(settingsStore, /aiConversationFontSize: 14/, 'AI conversation font size must have a stable default');
assert.match(settingsStore, /tm_ai_conversation_font_size/, 'AI conversation font size must persist locally');
assert.match(settingsScreen, /对话字体大小[\s\S]*type="number" min="12" max="22"/, 'AI settings must expose a bounded font size stepper');
assert.match(settingsActions, /tmUpdateAiConversationFontSize[\s\S]*Math\.max\(12, Math\.min\(22,[\s\S]*setConversationFontSize/, 'font size changes must be clamped and applied to the mounted AI runtime');
assert.match(bridge, /aiConversationFontSize:[\s\S]*Math\.max\(12, Math\.min\(22/, 'the AI bridge must expose a normalized font size');
assert.match(workbench, /--tm-agent-conversation-font-size:\$\{conversationFontSizeRem\(conversationFontSize\)\}/, 'the Agent workbench must render with the configured font size');
assert.match(styles, /\.tm-agent-message__body \{[\s\S]*font-size: var\(--tm-agent-conversation-font-size, 0\.875rem\)/, 'Agent message text must consume the configured font size');
assert.match(styles, /\.tm-agent-markdown pre \{[\s\S]*font-size: 0\.875em/, 'Agent code blocks must scale with conversation text');
assert.match(legacy, /\.tm-ai-sidebar__message-body\{[^}]*font-size:var\(--tm-ai-conversation-font-size,0\.875rem\)/, 'legacy conversation text must consume the configured font size');
assert.match(legacy, /runtimeKind: 'legacy',[\s\S]*setConversationFontSize/, 'legacy AI must support applying font size changes immediately');

console.log('AI conversation font size contract tests passed');
