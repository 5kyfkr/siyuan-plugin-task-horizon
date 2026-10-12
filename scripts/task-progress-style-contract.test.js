'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const progressRenderers = [
    'src/task-horizon/main/20-api-and-runtime-services.js',
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

const checklist = read('src/task-horizon/main/render/42-render-list-and-checklist-body.js');
const taskModel = read('src/task-horizon/main/task-runtime/50-task-model-and-repeat-utils.js');
const styles = read('task-horizon.css');
assert.match(checklist, /__tmRenderChecklistSubtaskProgress\(String\(task\.id \|\| ''\), completedChildren, totalChildren\)/, 'checklist tasks must render inline subtask progress');
assert.match(taskModel, /data-tm-subtask-progress-kind="inline" style="width:\$\{percent\}%"/, 'inline progress must reflect the completed child percentage');
assert.match(taskModel, /role="progressbar"[^\n]*aria-valuemax="\$\{total\}" aria-valuenow="\$\{completed\}"/, 'inline progress must expose completed and total child counts');
assert.match(styles, /\.tm-checklist-progress-track\s*\{[^}]*height:\s*3px;/, 'checklist inline progress must retain a 3px track');
assert.match(styles, /\.tm-checklist-progress-track i\s*\{[^}]*background:\s*var\(--tm-checklist-progress-color, var\(--tm-primary-color\)\);/, 'checklist inline progress must follow its configured color');

console.log('task progress style contract tests passed');
