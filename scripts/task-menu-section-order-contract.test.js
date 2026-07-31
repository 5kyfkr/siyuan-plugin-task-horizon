'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const segment = (source, start, end) => {
    const startIndex = source.indexOf(start);
    const endIndex = source.indexOf(end, startIndex + start.length);
    assert.ok(startIndex >= 0 && endIndex > startIndex, `missing source segment: ${start}`);
    return source.slice(startIndex, endIndex);
};
const assertOrdered = (source, markers, label) => {
    let previousIndex = -1;
    markers.forEach((marker) => {
        const index = source.indexOf(marker, previousIndex + 1);
        assert.ok(index > previousIndex, `${label}: ${marker} is missing or out of order`);
        previousIndex = index;
    });
};

const contextMenu = segment(
    read('src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js'),
    'window.tmShowTaskContextMenu = function',
    'document.body.appendChild(menu);'
);
const detailMoreActions = segment(
    read('src/task-horizon/main/30-dialogs-and-ui-foundation.js'),
    'function __tmBuildTaskDetailMoreActions',
    'function __tmOpenTaskDetailMoreMenu'
);

assertOrdered(contextMenu, [
    "__tmRenderContextMenuLabel('pin'",
    "__tmRenderContextMenuLabel('alarm-clock', '提醒')",
    "__tmRenderContextMenuLabel('clipboard-list', '复制')",
    'appendSectionSeparator();',
    "__tmRenderContextMenuLabel('text-indent', '新建子任务')",
    "__tmRenderContextMenuLabel('list-bullets', '新建同级任务')",
    "__tmRenderContextMenuLabel('text-outdent', '移出子任务'",
    "__tmRenderContextMenuLabel('calendar-days', '编辑日程')",
    'appendSectionSeparator();',
    "__tmRenderContextMenuLabel('bot', 'AI')",
    "__tmRenderContextMenuLabel('file-text', '任务详情')",
    "__tmRenderContextMenuLabel('map-pin', '跳转到原块')",
    "__tmRenderContextMenuLabel('square-pen', '修改内容')",
    'appendSectionSeparator();',
    "__tmRenderContextMenuLabel('trash-2'",
], 'task context menu sections');

const aiAndDirectTaskActions = segment(
    contextMenu,
    "__tmRenderContextMenuLabel('bot', 'AI')",
    "__tmRenderContextMenuLabel('square-pen', '修改内容')"
);
assert.doesNotMatch(aiAndDirectTaskActions, /appendSectionSeparator\(\)/, 'detail, jump, and edit must stay directly below AI without a separate section');

assertOrdered(detailMoreActions, [
    "label: task?.pinned ? '取消置顶' : '置顶'",
    "label: '提醒'",
    "label: '开始专注'",
    "label: '复制'",
    'actions.push({ separator: true });',
    "label: '新建子任务'",
    "label: '新建同级任务'",
    "label: '移出子任务'",
    "label: '编辑日程'",
    'actions.push({ separator: true });',
    "label: '发送到 AI'",
    'actions.push({ separator: true });',
    "label: '删除任务'",
], 'task detail more menu sections');

console.log('task menu section order contract tests passed');
