const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const renderer = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/42-render-list-and-checklist-body.js'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');

assert.match(
    renderer,
    /const compactRemarkHtml = checklistCompact \? __tmRenderTaskCardRemark\(task\) : '';[\s\S]*?<div class="\$\{titleRowClass\}">[\s\S]*?<\/div>\s*\$\{compactRemarkHtml\}\s*\$\{meta\.length/,
    'compact checklist remarks must render below the complete title and right-fields row',
);
assert.match(
    renderer,
    /const remarkSearchSnippetHtml = !compactRemarkHtml && typeof __tmBuildTaskRemarkSearchSnippet/,
    'a visible compact remark must replace the search-only remark snippet',
);
assert.match(
    renderer,
    /const remarkIconHtml = compactRemarkHtml \? '' : __tmRenderRemarkIcon\(task\.remark\);/,
    'a visible compact remark must replace the redundant remark icon',
);
assert.match(
    runtime,
    /function __tmUpdateTaskRemarkInDOM[\s\S]*?tm-checklist-item--has-remark[\s\S]*?insertAdjacentHTML\('afterend', compactRemarkHtml\)[\s\S]*?remarkIconSlot\.innerHTML = compactRemarkHtml \? '' : __tmRenderRemarkIcon\(taskLike\.remark\)/,
    'remark patches must add, update, and remove the compact checklist remark without a full render',
);
assert.match(
    styles,
    /\.tm-checklist-pane--compact \.tm-checklist-item-main > \.tm-task-card-remark\s*\{[\s\S]*?-webkit-line-clamp:\s*var\(--tm-task-remark-wrap-lines, 2\);/,
    'compact checklist remarks must use the shared configurable remark line limit with a two-line fallback',
);
assert.match(
    styles,
    /\.tm-checklist-pane--compact \.tm-checklist-item\.tm-checklist-item--has-remark\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*auto minmax\(0, 1fr\);[\s\S]*?grid-template-rows:\s*auto auto;[\s\S]*?padding-top:\s*5px;[\s\S]*?padding-bottom:\s*5px;/,
    'remark rows must keep balanced outer spacing while growing below the title row',
);
assert.match(
    styles,
    /\.tm-checklist-pane--compact \.tm-checklist-item\.tm-checklist-item--has-remark > \.tm-checklist-leading\s*\{[\s\S]*?grid-row:\s*1;[\s\S]*?align-self:\s*stretch;[\s\S]*?min-height:\s*var\(--tm-checklist-compact-primary-row-height\);/,
    'the checkbox and tree control must stretch with the full single-line or multi-line title row',
);
assert.match(
    styles,
    /\.tm-checklist-pane--compact \.tm-checklist-item\.tm-checklist-item--has-remark > \.tm-checklist-item-main\s*\{\s*display:\s*contents;[\s\S]*?\.tm-checklist-title-row\s*\{[\s\S]*?grid-row:\s*1;[\s\S]*?\.tm-checklist-item-main > \.tm-task-card-remark\s*\{[\s\S]*?grid-row:\s*2;/,
    'the title and remark must occupy separate grid rows so only the title controls checkbox centering',
);

console.log('checklist compact remark contract tests passed');
