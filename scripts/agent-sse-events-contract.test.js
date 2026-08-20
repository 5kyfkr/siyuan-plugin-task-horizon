'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const workbench = fs.readFileSync(path.join(root, 'src/ai/agent-workbench.js'), 'utf8');

assert.match(workbench, /event\.type === 'permission'[\s\S]*runtime\.live\.permissionMode[\s\S]*runtime\.session\.permissionMode/, 'permission SSE events must update both live UI state and the native session permission mode');
assert.match(workbench, /event\.type === 'usage'[\s\S]*runtime\.live\.usage = normalizeAgentUsage\(event\)/, 'usage SSE events must be retained instead of being dropped');
assert.match(workbench, /event\.type === 'retry'[\s\S]*runtime\.live\.retry =/, 'retry SSE events must expose a visible retry state');
assert.match(workbench, /live\.permissionMode \? \{ permissionMode: live\.permissionMode \}/, 'permission mode must survive final assistant entry persistence');
assert.match(workbench, /live\.usage \? \{ usage: clone\(live\.usage\) \}/, 'usage must survive final assistant entry persistence');
assert.match(workbench, /renderAgentUsage\(entry\.usage\)/, 'persisted usage must remain visible in conversation history');
assert.match(workbench, /data-tm-agent-usage/, 'live and persisted usage must have a stable render hook');

const helperStart = workbench.indexOf('function normalizeAgentUsage(event = {})');
const helperEnd = workbench.indexOf('\n    function renderConfirmEffects', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'Agent SSE usage helpers must remain extractable');
const context = vm.createContext({
    Object,
    Number,
    String,
    Math,
    esc: (value) => String(value == null ? '' : value).replace(/&/g, '&amp;'),
    text: (value) => String(value == null ? '' : value).trim(),
});
vm.runInContext(`${workbench.slice(helperStart, helperEnd)}\nthis.normalizeAgentUsage = normalizeAgentUsage; this.renderAgentUsage = renderAgentUsage;`, context);
const usage = context.normalizeAgentUsage({
    promptTokens: 1200,
    completionTokens: 340,
    lastPromptTokens: 980,
    cachedTokens: 100,
    contextLimit: 4096,
    tokenBreakdown: { system: 200, tools: 500, empty: 0 },
});
assert.deepEqual(JSON.parse(JSON.stringify(usage)), {
    promptTokens: 1200,
    completionTokens: 340,
    lastPromptTokens: 980,
    tokenBreakdown: { system: 200, tools: 500 },
    cachedTokens: 100,
    contextLimit: 4096,
});
assert.match(context.renderAgentUsage(usage), /上下文 980 \/ 4,096/);
assert.match(context.renderAgentUsage(usage), /输入 1,200 · 输出 340/);
assert.equal(context.renderAgentUsage(null), '');

console.log('agent SSE event contract tests passed');
