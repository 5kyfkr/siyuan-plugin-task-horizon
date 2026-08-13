'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', 'render', '44-render-whiteboard-body.js'),
    'utf8',
);

const start = source.indexOf('const renderWhiteboardPoolDocSection = (docData, options = {}) => {');
const end = source.indexOf('const poolDocDataList = poolSourceDocIds', start);
assert.notEqual(start, -1, 'whiteboard task-pool document renderer must exist');
assert.notEqual(end, -1, 'whiteboard task-pool document renderer boundary must exist');

const renderer = source.slice(start, end);
assert.match(
    renderer,
    /__tmRenderHeadingLevelIconLabel\(groupLabel, SettingsStore\.data\.taskHeadingLevel \|\| 'h2'/,
    'whiteboard task-pool heading groups must use the shared rich-content label renderer',
);
assert.doesNotMatch(
    renderer,
    /tm-whiteboard-pool-h2-text">\$\{esc\(groupLabel\)\}/,
    'whiteboard task-pool heading groups must not escape block references into raw IDs',
);

console.log('whiteboard pool heading block-ref contract tests passed');
