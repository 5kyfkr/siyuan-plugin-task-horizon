'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', 'render', '42-render-list-and-checklist-body.js'),
    'utf8',
);

const start = source.indexOf('const compactMetaParts = [];');
const end = source.indexOf('compactCustomFieldDefs.forEach', start);
assert.notEqual(start, -1, 'compact checklist metadata renderer must exist');
assert.notEqual(end, -1, 'compact checklist metadata renderer boundary must exist');

const renderer = source.slice(start, end);
assert.match(
    renderer,
    /tm-checklist-meta-compact-h2[\s\S]*API\.renderTaskContentHtml\(compactHeadingText, compactHeadingText\)/,
    'compact checklist heading fields must render block references as rich content',
);
assert.doesNotMatch(
    renderer,
    /tm-checklist-meta-compact-h2[^\n]*>\$\{esc\(compactHeadingText\)\}/,
    'compact checklist heading fields must not expose raw block-reference IDs',
);

console.log('checklist compact heading block-ref contract tests passed');
