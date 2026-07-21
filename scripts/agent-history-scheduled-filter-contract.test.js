'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const workbench = fs.readFileSync(path.join(root, 'src/ai/agent-workbench.js'), 'utf8');
const bridge = fs.readFileSync(path.join(root, 'src/task-horizon/main/shell/81-ai-bridge-runtime.js'), 'utf8');

assert.match(bridge, /listActiveScheduledConversationIDs\(\)[\s\S]*event\?\.enabled !== false[\s\S]*event\?\.conversationId/, 'the bridge must expose conversations belonging to currently enabled scheduled events');
assert.match(workbench, /historyScheduledOnly[\s\S]*listActiveScheduledConversationIDs[\s\S]*activeScheduledSessionIDs\.has\(text\(session\?\.id\)\)/, 'the history filter must match sessions by scheduled-event conversation ID');
assert.match(workbench, /data-agent-action="toggle-scheduled-history"[\s\S]*只显示已启用定时任务的会话/, 'the history panel must render an accessible scheduled-conversation switch');
assert.match(workbench, /action === 'toggle-scheduled-history'[\s\S]*target\.checked === true/, 'the scheduled-conversation switch must update the filter state');
assert.match(workbench, /当前没有已启用定时任务的会话/, 'the filtered history must provide a specific empty state');

console.log('agent scheduled history filter contract tests passed');
