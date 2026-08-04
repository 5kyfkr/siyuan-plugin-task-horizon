'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const detailSource = read('src', 'task-horizon', 'main', 'task-runtime', '52-task-detail-runtime.js');
const helperSource = read('src', 'task-horizon', 'main', 'task-runtime', '51-whiteboard-and-link-runtime.js');
const foundationSource = read('src', 'task-horizon', 'main', '30-dialogs-and-ui-foundation.js');
const styleSource = read('task-horizon.css');

const planeStyleStart = styleSource.indexOf('/* Task detail folding: preserve existing layout');
const planeStyleEnd = styleSource.indexOf('\n.tm-task-detail-header .bc-btn,', planeStyleStart);
assert.ok(planeStyleStart >= 0 && planeStyleEnd > planeStyleStart, 'task detail fold styles must remain extractable');
const planeStyles = styleSource.slice(planeStyleStart, planeStyleEnd);

const detailBuilderStart = detailSource.indexOf('function __tmBuildTaskDetailInnerHtml(');
const detailBuilderEnd = detailSource.indexOf('\n\n    function __tmBuildTaskDetailNoteViewInnerHtml', detailBuilderStart);
assert.ok(detailBuilderStart >= 0 && detailBuilderEnd > detailBuilderStart, 'task detail builder must remain extractable');
const detailBuilder = detailSource.slice(detailBuilderStart, detailBuilderEnd);

for (const marker of [
    'data-tm-detail="location-doc"',
    'data-tm-detail="location-heading"',
    'data-tm-detail="jump"',
    'data-tm-detail="note-view"',
    'data-tm-detail="more"',
    'data-tm-detail="save"',
    'data-tm-detail="close"',
    'data-tm-detail-fsrs-review',
    '__tmBuildTaskCompleteAtDetailChipHtml(task, detailTip)',
    '__tmBuildTaskDetailWhiteboardOutlineChipHtml',
    '__tmBuildTaskDetailSubtasksHtml(task)',
    '__tmBuildTaskDetailAttachmentSectionHtml(task, detailTip)',
    '__tmBuildTaskRepeatHistorySectionHtml(task)',
]) {
    assert.ok(detailBuilder.includes(marker), `task detail must preserve ${marker}`);
}

assert.match(
    detailBuilder,
    /<div class="tm-task-detail-core">[\s\S]*\$\{customFieldsHtml\}[\s\S]*<\/div>/,
    'the always-visible property core and configured option fields must remain intact',
);
assert.doesNotMatch(
    detailBuilder,
    /tm-task-detail-core[^>]*data-tm-detail-collapsible-section/,
    'the top property core must never become collapsible',
);
assert.match(
    detailBuilder,
    /tm-task-detail-section--subtasks[\s\S]*data-tm-detail-section-toggle[\s\S]*completedChildren[\s\S]*__tmBuildTaskDetailSubtasksHtml/,
    'subtasks must keep their count and gain only a section-level toggle',
);
assert.match(
    detailBuilder,
    /data-tm-detail-custom-field="\$\{esc\(fieldId\)\}"[\s\S]*data-tm-detail-section-toggle[\s\S]*data-tm-detail-custom-text-field/,
    'text custom fields must remain editable inside collapsible sections',
);
const visibilitySyncStart = detailSource.indexOf('const syncSubtaskVisibilityToggle = () => {');
const visibilitySyncEnd = detailSource.indexOf('\n        let activeInlinePopover', visibilitySyncStart);
assert.ok(visibilitySyncStart >= 0 && visibilitySyncEnd > visibilitySyncStart, 'completed-subtasks visibility sync must remain extractable');
const visibilitySyncSource = detailSource.slice(visibilitySyncStart, visibilitySyncEnd);
assert.ok(visibilitySyncSource.includes('tools.insertBefore(btn, count);'), 'the completed-subtasks toggle must precede the child count');
assert.doesNotMatch(visibilitySyncSource, /tools\.appendChild\(btn\)/, 'the completed-subtasks toggle must not follow the child count');

const subtaskBuilderStart = helperSource.indexOf('function __tmBuildTaskDetailSubtasksHtml(');
const subtaskBuilderEnd = helperSource.indexOf('\n\n    function __tmOpenTaskAttachmentPicker', subtaskBuilderStart);
assert.ok(subtaskBuilderStart >= 0 && subtaskBuilderEnd > subtaskBuilderStart, 'subtask builder must remain extractable');
const subtaskBuilder = helperSource.slice(subtaskBuilderStart, subtaskBuilderEnd);
assert.match(subtaskBuilder, /childStatsHtml[\s\S]*tm-task-detail-subtask-count/, 'per-row child counts must remain visible');
assert.match(subtaskBuilder, /__tmRenderTaskCheckbox\([\s\S]*data-tm-detail-subtask-content[\s\S]*data-tm-detail-open-child/, 'subtask checkbox, inline editing, and child navigation must remain intact');
assert.match(subtaskBuilder, /renderNode\(child, depth \+ 1\)/, 'recursive subtask hierarchy must remain intact');

const attachmentBuilderStart = helperSource.indexOf('function __tmBuildTaskDetailAttachmentSectionHtml(');
const attachmentBuilderEnd = helperSource.indexOf('\n\n    function __tmGetWhiteboardStickyThemes', attachmentBuilderStart);
const attachmentBuilder = helperSource.slice(attachmentBuilderStart, attachmentBuilderEnd);
for (const marker of [
    'data-tm-detail-section-toggle',
    '__tmBuildTaskAttachmentThumbHtml',
    'data-tm-detail-attachment-open',
    'data-tm-detail-attachment-move',
    'data-tm-detail-attachment-remove',
    'data-tm-detail-attachment-toggle',
    'data-tm-detail-attachment-add',
    '添加附件',
    '可拖拽至此处添加附件，也可Ctrl+V粘贴。',
]) {
    assert.ok(attachmentBuilder.includes(marker), `attachment detail must preserve ${marker}`);
}

const remarkBuilderStart = helperSource.indexOf('function __tmBuildTaskDetailRemarkSectionHtml(');
const remarkBuilderEnd = helperSource.indexOf('\n\n    function __tmBuildTaskRepeatHistorySectionHtml', remarkBuilderStart);
const remarkBuilder = helperSource.slice(remarkBuilderStart, remarkBuilderEnd);
assert.match(remarkBuilder, /data-tm-detail-section-toggle[\s\S]*data-tm-detail-remark-toolbar[\s\S]*data-tm-detail-remark-preview[\s\S]*data-tm-detail="remark"/, 'remark folding must preserve toolbar, Markdown preview, and editor');
for (const tool of ['outdent', 'indent', 'bullet', 'ordered', 'bold', 'italic', 'code', 'link', 'quote']) {
    assert.ok(helperSource.includes(`{ action: '${tool}'`), `remark toolbar must preserve ${tool}`);
}

const historyBuilderStart = helperSource.indexOf('function __tmBuildTaskRepeatHistorySectionHtml(');
const historyBuilder = helperSource.slice(historyBuilderStart);
assert.match(historyBuilder, /data-tm-detail-section-toggle[\s\S]*循环完成记录[\s\S]*tm-task-detail-section-count/, 'repeat history must preserve its folding title and count');
assert.ok(historyBuilder.includes('data-tm-detail-repeat-history-delete'), 'repeat history must preserve its delete action');

const foldButtons = [detailBuilder, attachmentBuilder, remarkBuilder, historyBuilder]
    .flatMap((source) => Array.from(source.matchAll(/<button\b[^>]*data-tm-detail-section-toggle[^>]*>([\s\S]*?)<\/button>/g), (match) => match[1]));
assert.equal(foldButtons.length, 5, 'all five collapsible section templates must use the shared folding button');
foldButtons.forEach((buttonBody) => {
    assert.ok(
        buttonBody.indexOf('tm-task-detail-section-title') < buttonBody.indexOf('tm-task-detail-section-chevron'),
        'the fold icon must appear immediately after the section name',
    );
    assert.ok(buttonBody.includes("__tmPhosphorBoldSvg('caret-down'"), 'fold buttons must render the Phosphor Bold caret-down icon');
});
assert.ok(foundationSource.includes("__tmPhosphorBoldPaths['caret-down'] ="), 'the Phosphor Bold caret-down path must be registered');

assert.match(detailSource, /data-tm-detail-section-toggle[\s\S]*aria-expanded[\s\S]*\.hidden\s*=/, 'one delegated section toggle must synchronize accessibility and visibility');
assert.doesNotMatch(detailSource, /localStorage[\s\S]{0,200}tm-task-detail-section/, 'section folding must not persist state across tasks');
assert.match(styleSource, /\.tm-task-detail-section-toggle[\s\S]*\.tm-task-detail-section-chevron[\s\S]*\.is-collapsed/, 'task detail CSS must style the shared section toggle and collapsed state');
const originalDetailRule = styleSource.match(/\.tm-task-detail\s*\{[\s\S]*?\n\}/)?.[0] || '';
const originalShellRule = styleSource.match(/\.tm-task-detail-shell\s*\{[\s\S]*?\n\}/)?.[0] || '';
assert.ok(originalDetailRule.includes('padding: 16px'), 'original detail side padding must remain the source of truth');
assert.ok(originalShellRule.includes('gap: 14px'), 'original shell gap must remain the source of truth');
assert.match(styleSource, /\.tm-task-detail-title-input\s*\{[^}]*padding:\s*6px 0\s*;/, 'desktop task title text must align with the detail content edges');
assert.match(styleSource, /@media \(max-width: 640px\)[\s\S]*?\.tm-task-detail-title-input\s*\{[^}]*padding:\s*5px 0\s*;/, 'mobile task title text must align with the detail content edges');
assert.doesNotMatch(planeStyles, /\.tm-task-detail\s*\{/, 'fold styles must not redefine detail width or side padding');
assert.doesNotMatch(planeStyles, /(?:padding|margin)-(?:left|right|inline)(?:-start|-end)?\s*:/, 'fold styles must not add horizontal content indentation');
assert.doesNotMatch(planeStyles, /border-top\s*:/, 'fold styles must not add divider lines');
assert.doesNotMatch(
    planeStyles,
    /\.tm-task-detail-shell\b|\.tm-task-detail-(?:header|location|title-input|core|custom-fields|remark-shell|custom-textarea|remark-head|attachments-grid|attachment-card)\b/,
    'fold styles must not target existing task detail content',
);
assert.doesNotMatch(
    planeStyles,
    /\.tm-task-detail-(?:subtasks|subtask-row|subtask-main|subtask-title|subtask-trailing|subtask-footer|subtask-add-btn)\b/,
    'the redesign must not override the existing subtask layout or spacing',
);

console.log('task detail plane layout contract tests passed');
