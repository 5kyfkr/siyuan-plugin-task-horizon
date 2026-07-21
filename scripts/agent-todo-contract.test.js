'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const workbench = fs.readFileSync(path.join(root, 'src/ai/agent-workbench.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'src/ai/agent-workbench.css'), 'utf8');

assert.match(workbench, /function parseTodoItems\(call\)[\s\S]*\[xX\/\\- \][\s\S]*todoArguments\(call\)[\s\S]*args\.todos/, 'todo_write must support SiYuan markdown results and streaming arguments');
assert.match(workbench, /function todoResultText\(result\)[\s\S]*JSON\.parse[\s\S]*value\.content/, 'todo_write must unwrap JSON and MCP content results');
assert.match(workbench, /agent-chat__tool-card agent-chat__tool-card--todo[\s\S]*agent-chat__todo-header[\s\S]*agent-chat__todo-items/, 'todo must reuse SiYuan Agent native todo classes');
assert.match(workbench, /xlink:href="#iconList"/, 'todo rendering must use SiYuan Agent\'s list icon');
['iconCheck', 'iconRefresh', 'iconCloseRound', 'iconUncheck'].forEach((icon) => {
    assert.match(workbench, new RegExp(`['"]${icon}['"]`), `todo rendering must use SiYuan Agent's ${icon} status icon`);
});
assert.match(workbench, /<details class="tm-agent-todo agent-chat__tool-card agent-chat__tool-card--todo" \$\{completedResponse \? '' : 'open'\}/, 'todo must stay expanded while running and collapse after the response completes');
assert.match(workbench, /function renderConversation\(entries, live\)[\s\S]*renderEntry\(entry, index\)[\s\S]*renderLiveMessage\(live\)/, 'todo output must remain part of the persisted and live conversation flow');
assert.match(workbench, /event\.type === 'done'[\s\S]*runtime\.live\.done = true/, 'the completed response must trigger todo collapse');
assert.match(styles, /\.tm-agent-todo\s*\{[\s\S]*border: 1px solid var\(--b3-border-color\)[\s\S]*font-size: 13px/, 'todo card must follow SiYuan Agent surface styling');
assert.match(styles, /\.tm-agent-todo__item\s*\{[\s\S]*padding: 6px 12px[\s\S]*line-height: 1\.5/, 'todo rows must match SiYuan Agent density');

console.log('agent todo contract tests passed');
