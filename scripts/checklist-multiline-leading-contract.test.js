const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const styles = read('task-horizon.css');
const services = read('src/task-horizon/main/20-api-and-runtime-services.js');
const renderRuntime = read('src/task-horizon/main/40-render-runtime.js');
const dialogs = read('src/task-horizon/main/30-dialogs-and-ui-foundation.js');
const contentRuntime = read('src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js');

assert.doesNotMatch(styles, /--tm-checklist-compact-leading-height|tm-checklist-compact-single-line-padding/);
assert.match(
    styles,
    /\.tm-checklist-pane--compact \.tm-checklist-title\s*\{[^}]*position:\s*relative;[^}]*top:\s*1px;/,
    'compact checklist titles must receive a small optical correction without moving checkboxes or changing row geometry',
);
assert.match(
    styles,
    /\.tm-checklist-pane--compact \.tm-checklist-item\s*\{[\s\S]*?--tm-checklist-compact-single-line-row-height:\s*max\(0px,\s*calc\(var\(--tm-checklist-compact-row-height, 34px\) - 4px\)\);[\s\S]*?min-height:\s*var\(--tm-checklist-compact-single-line-row-height\);/,
    'single-line checklist rows must use the uniformly reduced vertical spacing',
);
assert.match(
    styles,
    /\.tm-checklist-pane--compact \.tm-checklist-item\.tm-checklist-item--title-wrapped\s*\{[\s\S]*?--tm-checklist-compact-title-line-height:\s*calc\(var\(--tm-font-size\) \* 0\.96 \* 1\.32\);/,
    'wrapped checklist items must define the title first-line height',
);
assert.match(
    styles,
    /\.tm-checklist-pane--compact \.tm-checklist-item\.tm-checklist-item--title-wrapped > \.tm-checklist-leading\s*\{[\s\S]*?align-self:\s*stretch;/,
    'wrapped checklist leading must preserve the full row geometry',
);
assert.doesNotMatch(
    styles,
    /\.tm-checklist-pane--compact \.tm-checklist-item\.tm-checklist-item--title-wrapped > \.tm-checklist-leading\s*\{[\s\S]*?(?:height|min-height):\s*var\(--tm-checklist-compact-title-line-height\)/,
    'wrapped checklist layout must not shrink the leading container to one line',
);
assert.match(
    styles,
    /\.tm-checklist-pane--compact \.tm-checklist-item\.tm-checklist-item--title-wrapped\s*\{[\s\S]*?--tm-checklist-compact-title-vertical-padding:\s*max\(0px,\s*calc\(\(var\(--tm-checklist-compact-single-line-row-height\) - var\(--tm-checklist-compact-title-line-height\)\) \/ 2\)\);/,
    'wrapped checklist titles must use the same reduced vertical margin as single-line titles',
);
assert.match(
    styles,
    /\.tm-checklist-pane--compact \.tm-checklist-item\.tm-checklist-item--title-wrapped \.tm-checklist-title\s*\{[\s\S]*?padding-top:\s*var\(--tm-checklist-compact-title-vertical-padding\);[\s\S]*?padding-bottom:\s*var\(--tm-checklist-compact-title-vertical-padding\);/,
    'wrapped checklist titles must keep symmetric vertical padding',
);
assert.match(
    styles,
    /\.tm-checklist-pane--compact \.tm-checklist-item\.tm-checklist-item--title-wrapped > \.tm-checklist-leading input\.tm-task-checkbox\[type="checkbox"\]:not\(\.tm-task-checkbox--delight\)\s*\{[\s\S]*?top:\s*calc\(var\(--tm-checklist-compact-title-line-height\) \/ 2 \+ var\(--tm-checklist-compact-title-vertical-padding\)\)\s*!important;/,
    'only wrapped checklist checkboxes must be anchored to the first line',
);
assert.match(services, /function __tmSyncChecklistWrappedTitleClasses\(rootEl\)/);
assert.match(services, /title\.getBoundingClientRect\?\.\(\)\.height/);
assert.match(services, /tm-checklist-item--title-wrapped/);
assert.match(renderRuntime, /__tmSyncChecklistWrappedTitleClasses\?\.\(state\.modal\)/);
assert.match(dialogs, /__tmSyncChecklistWrappedTitleClasses\?\.\(modal\)/);
assert.match(contentRuntime, /__tmSyncChecklistWrappedTitleClasses\?\.\(root\)/);

console.log('checklist multiline leading contract tests passed');
