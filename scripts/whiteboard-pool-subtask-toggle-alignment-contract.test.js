'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const renderSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/44-render-whiteboard-body.js'), 'utf8');
const checklistSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/42-render-list-and-checklist-body.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');

assert.doesNotMatch(renderSource, /tm-whiteboard-pool-toggle-spacer/, 'leaf pool tasks must not reserve a leading toggle slot');
const trailingToggleBindings = renderSource.match(/tm-whiteboard-pool-item-title[^\n]*[\s\S]{0,120}\$\{toggleHtml\}/g) || [];
assert.equal(trailingToggleBindings.length, 2, 'both pool tree renderers must place the subtask toggle after the task title');
assert.match(
    renderSource,
    /<button type="button" class="tm-whiteboard-pool-toggle[\s\S]*?aria-expanded="\$\{collapsed \? 'false' : 'true'\}"/,
    'pool subtask toggles must expose their expanded state'
);
assert.match(cssSource, /\.tm-whiteboard-pool-toggle\s*\{[\s\S]*?margin-left:\s*auto;/, 'pool subtask toggles must anchor to the row end');
assert.doesNotMatch(cssSource, /\.tm-whiteboard-pool-toggle-spacer/, 'obsolete leading spacer styles must be removed');

assert.match(checklistSource, /--tm-checklist-compact-indent:calc\(\$\{depth\} \* var\(--tm-checklist-indent-step\)\)/, 'checklist indentation must use its shared CSS token');
const poolIndentStep = renderSource.match(/const whiteboardPoolSubtaskIndent = (\d+);/);
assert.ok(poolIndentStep, 'task pool must define one shared subtask indentation step');
assert.equal(poolIndentStep[1], '14', 'the task pool must retain its 14px indentation after the checklist layout refactor');
const poolIndentBindings = renderSource.match(/const indent = depth > 0 \? whiteboardPoolSubtaskIndent : 0;/g) || [];
assert.equal(poolIndentBindings.length, 2, 'both pool tree renderers must add exactly one indentation step per nested level');
assert.doesNotMatch(renderSource, /Math\.max\(0, Math\.min\(10, Number\(depth\) \|\| 0\)\) \* 16/, 'nested pool nodes must not multiply absolute depth inside an already nested tree');

console.log('whiteboard pool subtask toggle alignment contract tests passed');
