'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const kanban = read('src/task-horizon/main/render/43-render-timeline-kanban-calendar-body.js');
const listRuntime = read('src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js');
const rowModelRuntime = read('src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js');

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

const kanbanColumnRender = segment(
    kanban,
    'const colsHtml = cols.map(c => {',
    'const kanbanBoardNavHtml = renderKanbanBoardNavHtml',
);
assert.match(
    kanbanColumnRender,
    /const count = roots\.length \+ completedRoots\.length;/,
    'kanban column badges must count rendered root cards only',
);
assert.doesNotMatch(
    kanbanColumnRender,
    /const count = list0\.length;/,
    'kanban column badges must not count nested task nodes',
);

const listGrouping = segment(
    listRuntime,
    '// 识别全局根任务',
    'window.tmListLoadMoreRows = async function',
);
assert.match(listGrouping, /const rootTasks = derived\.rootTasks;/, 'table groups must start from filtered root tasks');
assert.match(listGrouping, /const docRootTasks = docRootTasksByDoc\.get/, 'table document groups must use document root tasks');
assert.match(listGrouping, /normalRoots\.forEach\(task =>/, 'table time, quadrant, and task-name groups must use root tasks');

const rowModelGrouping = segment(
    rowModelRuntime,
    'function __tmBuildTaskRowModel()',
    'function __tmResolveFirstVisibleTaskIdFromRowModel',
);
assert.match(rowModelGrouping, /const rootTasks = derived\.rootTasks;/, 'checklist and timeline groups must start from filtered root tasks');
assert.match(rowModelGrouping, /const docRootTasks = docRootTasksByDoc\.get/, 'checklist and timeline document groups must use document root tasks');
assert.match(rowModelGrouping, /count: completedRoots\.length/, 'completed groups must count completed roots only');

console.log('task group root count contract tests passed');
