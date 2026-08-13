'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const renderSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/44-render-whiteboard-body.js'), 'utf8');
const menuSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js'), 'utf8');

const poolMenuBindings = renderSource.match(/class="tm-whiteboard-pool-item[^\n]*oncontextmenu="tmShowTaskContextMenu\(event, '\$\{escSq\(tid\)\}'\)"/g) || [];
assert.equal(poolMenuBindings.length, 3, 'grouped, document, and search pool task rows must all expose the shared context menu');
assert.match(
    menuSource,
    /window\.tmShowTaskContextMenu = function\(event, taskId, extra\)[\s\S]*?event\.preventDefault\(\);[\s\S]*?event\.stopPropagation\(\);/,
    'the shared task context menu must suppress the browser menu and row click propagation'
);

console.log('whiteboard pool context menu contract tests passed');
