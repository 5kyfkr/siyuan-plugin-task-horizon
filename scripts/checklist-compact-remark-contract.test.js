const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const renderer = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/42-render-list-and-checklist-body.js'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');

assert.match(
    renderer,
    /const compactRemarkHtml = __tmRenderChecklistTaskRemark\(task\);[\s\S]*?<div class="\$\{titleRowClass\}">[\s\S]*?<\/div>\s*\$\{compactRemarkHtml\}\s*\$\{remarkSearchSnippetHtml\}/,
    'checklist remarks must render below the complete title and fields row in either layout',
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
    /\.tm-checklist-remark-text\s*\{[\s\S]*?-webkit-line-clamp:\s*var\(--tm-task-remark-wrap-lines, 2\);/,
    'compact checklist remarks must use the shared configurable remark line limit with a two-line fallback',
);
assert.match(
    styles,
    /\.tm-checklist-pane--compact \.tm-checklist-item\s*\{[\s\S]*?box-sizing:\s*border-box;[\s\S]*?padding:\s*var\(--tm-checklist-row-padding\) var\(--tm-checklist-pad-x\);/,
    'remark rows must keep balanced outer spacing while growing below the title row',
);
assert.match(
    styles,
    /\.tm-checklist-pane--compact \.tm-checklist-leading\s*\{[^}]*min-height:\s*var\(--tm-checklist-title-line-height\);[^}]*align-self:\s*stretch;/,
    'the checkbox and tree control must stretch with the full single-line or multi-line title row',
);
assert.match(
    styles,
    /\.tm-checklist-pane--compact \.tm-checklist-item-main > \.tm-task-card-remark\s*\{[^}]*display:\s*block;/,
    'remarks remain below the title row in the same main container used by local patches',
);

console.log('checklist compact remark contract tests passed');
