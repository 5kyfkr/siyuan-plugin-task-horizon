'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const progressRenderers = [
    'src/task-horizon/main/20-api-and-runtime-services.js',
    'src/task-horizon/main/render/42-render-list-and-checklist-body.js',
    'src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js',
    'src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js',
];

for (const relativePath of progressRenderers) {
    const source = read(relativePath);
    const progressStyle = source.match(/background-image:\s*linear-gradient\(90deg, \$\{progressBarColor\} \$\{progressPercent\}%, transparent \$\{progressPercent\}%\);background-repeat:no-repeat(?:;background-size:100% 3px;background-position:left bottom;)?/g) || [];
    assert.ok(progressStyle.length > 0, `${relativePath} must render task progress`);
    for (const style of progressStyle) {
        assert.match(style, /background-size:100% 3px;background-position:left bottom;/, `${relativePath} task progress must use the bottom bar style`);
    }
}

console.log('task progress style contract tests passed');
