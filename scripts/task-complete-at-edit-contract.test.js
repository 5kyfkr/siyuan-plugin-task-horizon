'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const listRender = read('src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js');
const timelineRender = read('src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js');
const inlineRuntime = read('src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js');
const detailRuntime = read('src/task-horizon/main/task-runtime/52-task-detail-runtime.js');
const timeRefresh = read('src/task-horizon/main/render/46-render-local-task-time-refresh.js');
const quickbar = read('quickbar.js');
const css = read('task-horizon.css');

function segment(source, start, end, label) {
    const from = source.indexOf(start);
    assert.notEqual(from, -1, `${label}: missing start marker: ${start}`);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(to, -1, `${label}: missing end marker: ${end}`);
    return source.slice(from, to);
}

// Table view: only closed tasks get the editable cell affordance.
const listCell = segment(listRender, "case 'taskCompleteAt':", "case 'remainingTime':", 'list completion cell');
assert.match(listCell, /data-tm-task-time-field="taskCompleteAt"/);
assert.match(listCell, /done \? ' tm-cell-editable' : ''/, 'list cell must only be editable for closed tasks');
assert.match(
    listCell,
    /tmBeginCellEdit\('\$\{taskId\}','taskCompleteAt',this,event\)/,
    'list completion cell must route through the shared cell-edit entry',
);

// Timeline table follows the same rule.
assert.match(
    timelineRender,
    /const taskCompleteAtEditable = columnOrder\.includes\('taskCompleteAt'\)[\s\S]*__tmIsTaskClosedForDisplay\(task\)/,
    'timeline completion cell must use the closed-task rule',
);
const timelineCell = segment(timelineRender, "case 'taskCompleteAt':", "case 'remainingTime':", 'timeline completion cell');
assert.match(timelineCell, /taskCompleteAtEditable \? ' tm-cell-editable' : ''/);
assert.match(
    timelineCell,
    /tmBeginCellEdit\('\$\{task\.id\}','taskCompleteAt',this,event\)/,
    'timeline completion cell must route through the shared cell-edit entry',
);

// In-place refresh must keep the editable affordance in sync when done/canceled changes.
assert.match(
    timeRefresh,
    /const completeAtCell = row\.querySelector\('\[data-tm-task-time-field="taskCompleteAt"\]'\)[\s\S]*classList\.toggle\('tm-cell-editable', completeAtEditable\)[\s\S]*setAttribute\('onclick', `tmBeginCellEdit\('\$\{id\}','taskCompleteAt',this,event\)`\)/,
    'in-place time refresh must add or remove the completion-time edit affordance',
);

// Shared editor.
assert.match(inlineRuntime, /window\.tmEditTaskCompleteAt = function/, 'shared completion-time editor must be exposed');
const editor = segment(
    inlineRuntime,
    'window.tmEditTaskCompleteAt = function',
    'window.tmBeginCellEdit = function',
    'shared completion-time editor',
);
assert.match(editor, /__tmOpenInlineEditor/, 'editor must reuse the inline popover primitive');
assert.match(editor, /pickerInput\?\.showPicker\?\.\(\)/, 'clicking must invoke the native picker directly');
assert.match(editor, /tm-inline-editor--task-complete-at/, 'editor must use the compact completion-time popover style');
assert.match(editor, /__tmEnsureEditableTaskLike/, 'editor must reuse the read-only task guard');
assert.match(editor, /__tmIsCheckinTask/, 'editor must reject check-in tasks');
assert.match(editor, /__tmGetTaskRepeatRule/, 'editor must reject recurring tasks');
assert.match(editor, /__tmIsTaskClosedForDisplay/, 'editor must require a closed task');
assert.match(editor, /taskCompleteAt:\s*nextValue/, 'editor must write taskCompleteAt');
assert.match(editor, /globalThis\.__tmRequireTaskMutation\?\.\('patchTask'\)/, 'editor must use the shared task writer');
assert.doesNotMatch(editor, /\/api\/attr\/setBlockAttrs|setBlockCustomAttrs/, 'editor must not write attributes directly');

const saveBlock = segment(editor, 'const save = () => {', 'input.onchange = save;', 'completion-time save');
assert.match(
    saveBlock,
    /if \(!local \|\| local === initial\) \{[\s\S]*close\(\);[\s\S]*return;/,
    'empty or unchanged values must close without writing (no clearing)',
);
assert.match(
    saveBlock,
    /__tmNormalizeTaskCompleteAtValue\(__tmParseDatetimeLocalToISO\(local\)\)/,
    'picked local time must be normalized back to the canonical completion-time value',
);

const beginEdit = segment(
    inlineRuntime,
    'window.tmBeginCellEdit = function',
    'const originalText = td.textContent;',
    'cell edit dispatcher',
);
assert.match(
    beginEdit,
    /if \(field === 'taskCompleteAt'\) \{[\s\S]*window\.tmEditTaskCompleteAt\(id, td\);[\s\S]*return;/,
    'table cells must dispatch taskCompleteAt to the shared editor',
);

// Task detail chip.
const chipBuilder = segment(
    detailRuntime,
    'function __tmBuildTaskCompleteAtDetailChipHtml',
    'function __tmTaskDetailTimeHubIcon',
    'detail completion chip',
);
assert.match(
    chipBuilder,
    /const editable = typeof __tmIsTaskClosedForDisplay === 'function'[\s\S]*__tmIsTaskClosedForDisplay\(task\)/,
    'detail chip must follow the closed-task rule',
);
assert.match(chipBuilder, /const tag = editable \? 'button' : 'div';/, 'editable chip must be a button');
assert.match(chipBuilder, /data-tm-detail-complete-at-trigger/, 'editable chip must expose a stable trigger attribute');

const detailHandlers = segment(
    detailRuntime,
    'const bindCoreMetaControls = () => {',
    "on(root.querySelector('[data-tm-detail-focus-summary-trigger]')",
    'detail core meta handlers',
);
assert.match(
    detailHandlers,
    /on\(root, 'click', \(ev\) => \{[\s\S]*closest\('\[data-tm-detail-complete-at-trigger\]'\)[\s\S]*window\.tmEditTaskCompleteAt/,
    'detail chip clicks must be delegated so re-created chips keep working',
);

// Quickbar definitions and click routing.
const inlineDefStart = quickbar.indexOf("{ attrKey: 'taskCompleteAt', name: '完成时间'");
assert.notEqual(inlineDefStart, -1, 'quickbar inline completion-time definition must exist');
const inlineDef = quickbar.slice(inlineDefStart, quickbar.indexOf('\n', inlineDefStart));
assert.doesNotMatch(inlineDef, /readonly:\s*true/, 'quickbar inline completion-time chip must be editable');

const floatbarDef = segment(
    quickbar,
    'name: __tmT("kernel.completionTime")',
    'name: __tmT("quickbar.focusTimeSpent")',
    'quickbar floatbar completion-time definition',
);
assert.doesNotMatch(floatbarDef, /readonly:\s*true/, 'quickbar floatbar completion-time chip must be editable');

assert.match(
    quickbar,
    /function shouldShowQuickbarTaskCompleteAt\(props\)[\s\S]*isClosed\(marker\)/,
    'quickbar must treat canceled tasks as closed for the completion-time chip',
);

const floatbarClick = segment(quickbar, 'function bindPropClickEvents()', '// 显示选择菜单', 'quickbar floatbar click');
assert.match(
    floatbarClick,
    /if \(activePropConfig\.readonly\) return;[\s\S]*attrKey === 'taskCompleteAt'[\s\S]*window\.tmEditTaskCompleteAt/,
    'quickbar floatbar click must route taskCompleteAt to the shared editor',
);

const inlineClick = segment(
    quickbar,
    'async function handleInlineHostPointerDown',
    'function bindInlineHostPointerHandler',
    'quickbar inline click',
);
assert.match(
    inlineClick,
    /if \(config\.readonly\) \{[\s\S]*attrKey === 'taskCompleteAt'[\s\S]*window\.tmEditTaskCompleteAt/,
    'quickbar inline chip click must route taskCompleteAt to the shared editor',
);

// i18n keys.
for (const locale of ['zh-CN', 'en']) {
    const dictionary = JSON.parse(read(`i18n/${locale}.json`));
    for (const key of [
        'task.completeTimeRequiresClosedTask',
        'task.completeTimeUnsupportedRecurring',
        'task.completeTimeUnsupportedCheckin',
    ]) {
        assert.equal(typeof dictionary[key], 'string', `${locale}: missing ${key}`);
        assert.ok(dictionary[key].trim(), `${locale}: empty ${key}`);
    }
}

// Timestamp stays on one line even though .tm-cell-editable allows wrapping.
assert.match(
    css,
    /td\.tm-cell-editable\[data-tm-task-time-field="taskCompleteAt"\][^{}]*\{[^}]*white-space:\s*nowrap;/,
    'completion-time cells must not wrap the timestamp',
);
assert.match(
    css,
    /\.tm-inline-editor\.tm-inline-editor--task-complete-at\s*\{[^}]*padding:\s*4px;/,
    'completion-time popover must tighten its outer padding',
);
assert.match(
    css,
    /\.tm-inline-editor--task-complete-at input\s*\{[^}]*padding:\s*6px 8px;/,
    'completion-time picker input must tighten its padding',
);

console.log('task complete-at edit contract tests passed');
