'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const workbench = fs.readFileSync(path.join(root, 'src/ai/agent-workbench.js'), 'utf8');
const panels = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/47-render-side-panels-and-view-switching.js'), 'utf8');

assert.match(workbench, /const WORKBENCH_BINDING_TOKEN = `agent-\$\{Date\.now\(\)\}-\$\{Math\.random\(\)/, 'each Agent runtime must own a unique DOM binding token');
assert.match(workbench, /const listenerActive = runtime\.hostListenerController && runtime\.hostListenerController\.signal\.aborted !== true;[\s\S]*!listenerActive \|\| host\.dataset\.tmAgentWorkbenchBound !== WORKBENCH_BINDING_TOKEN/, 'an aborted or stale Agent listener binding must be replaced');
assert.match(workbench, /if \(!host\.isConnected \|\| runtime\.host !== host\) return false;/, 'an async mount must not finish against a detached or superseded Agent host');
assert.match(workbench, /runtime\.host\?\.dataset\?\.tmAgentWorkbenchBound === WORKBENCH_BINDING_TOKEN[\s\S]*delete runtime\.host\.dataset\.tmAgentWorkbenchBound/, 'cleanup must only remove the binding marker owned by its runtime');
assert.match(panels, /const selector = useOverlayPanel[\s\S]*await __tmEnsureAiRuntimeLoaded\(\)[\s\S]*host = state\.modal\?\.querySelector\?\.\(selector\)[\s\S]*!host\.isConnected/, 'the task panel must resolve the current visible Agent host again after asynchronous runtime loading');

console.log('agent reload rebind contract tests passed');
