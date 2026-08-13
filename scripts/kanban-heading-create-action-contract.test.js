const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const kanban = read('src', 'task-horizon', 'main', 'render', '43-render-timeline-kanban-calendar-body.js');
const css = read('task-horizon.css');

assert.match(
    kanban,
    /const renderHeadingGroupCreateAction = \(docId, headingId\) => \{[\s\S]*class="tm-group-create-btn tm-kanban-create-btn tm-kanban-group-add"[\s\S]*tmCreateTaskForHeadingGroup\('\$\{escSq\(did\)\}','\$\{escSq\(hid\)\}', event\)[\s\S]*__tmRenderLucideIcon\('plus'\)/,
    'kanban heading groups must expose the shared heading create action and plus icon',
);
assert.doesNotMatch(
    kanban,
    /tm-kanban-col-add tm-whiteboard-stream-doc-add-btn/,
    'kanban create actions must not depend on a whiteboard styling class',
);
assert.match(
    kanban,
    /const actionHtml = String\(opt\?\.actionHtml \|\| ''\)\.trim\(\);[\s\S]*<span class="tm-badge tm-badge--count">[\s\S]*\$\{actionHtml\}/,
    'the shared group title must render an optional trailing action',
);
assert.match(
    kanban,
    /headingMode && state\.groupByDocName && isAllTabsView[\s\S]*renderGroupedByDoc\(\{[^}]*showHeadingCreate: true[^}]*\}\)/,
    'all-tabs document kanban must enable create actions for its nested heading groups',
);
assert.match(
    kanban,
    /const actionHtml = o\.showHeadingCreate[\s\S]*renderHeadingGroupCreateAction\(docId, String\(bucket\?\.id \|\| ''\)\.trim\(\)\)[\s\S]*renderGroupTitle\(h2Key,[\s\S]*actionHtml \}\)/,
    'each nested heading group must target its own document and heading',
);
assert.match(
    css,
    /\.tm-kanban--clean \.tm-kanban-create-btn \{[\s\S]*padding: 0;[\s\S]*background: transparent;[\s\S]*border-color: transparent;/,
    'all kanban create actions must stay compact and transparent at rest',
);
assert.match(
    css,
    /\.tm-kanban--clean \.tm-kanban-create-btn:hover,[\s\S]*\.tm-kanban-create-btn:focus-visible \{[\s\S]*background: color-mix/,
    'all kanban create actions must show their background on hover or keyboard focus',
);
assert.match(
    kanban,
    /const colStyle = `\$\{colStyleBase\}--tm-kanban-create-color:\$\{colTitleColor\};/,
    'each kanban column must expose one shared create-action color',
);
assert.match(
    css,
    /\.tm-kanban--clean \.tm-kanban-create-btn:hover,[\s\S]*background: color-mix\(in srgb, var\(--tm-kanban-create-color, currentColor\) 14%[\s\S]*border-color: color-mix\(in srgb, var\(--tm-kanban-create-color, currentColor\) 30%/,
    'column and nested heading create actions must derive hover colors from the same column token',
);

console.log('kanban heading create action contract tests passed');
