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
const listRuntimeSource = read('src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js');
const uiFoundationSource = read('src/task-horizon/main/30-dialogs-and-ui-foundation.js');
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

const contextCopyMenu = segment(
    contextMenu,
    "menu.appendChild(createSubmenu(__tmRenderContextMenuLabel('clipboard-list', '复制')",
    'appendSectionSeparator();'
);
assertOrdered(contextCopyMenu, [
    "__tmRenderContextMenuLabel('cursor-text', '复制纯文本')",
    "__tmRenderContextMenuLabel('link-simple', '复制块引用')",
    "__tmRenderContextMenuLabel('stack-simple', '复制嵌入块')",
    "__tmRenderContextMenuLabel('file-text', '复制块 ID')",
], 'task context copy submenu');

const detailCopyMenu = segment(detailMoreActions, 'const copyTaskValue = (type)', 'actions.push({ separator: true });');
assertOrdered(detailCopyMenu, [
    "label: '复制纯文本'",
    "label: '复制块引用'",
    "label: '复制嵌入块'",
    "label: '复制块 ID'",
], 'task detail copy submenu');
assert.match(detailCopyMenu, /label: '复制嵌入块'[\s\S]*icon: 'stack-simple'[\s\S]*copyTaskValue\('blockEmbed'\)/, 'task detail embed copy must use the stack-simple icon and shared copy mode');

const copyRuntime = segment(listRuntimeSource, 'async function __tmCopyTaskContextValue', 'window.tmStartPomodoro');
assert.match(copyRuntime, /mode === 'blockEmbed'[\s\S]*__tmResolveRecurringInstanceSourceTaskId\(tid, taskLike\)[\s\S]*text = `\{\{select \* from blocks where id='\$\{embedId\}'\}\}`/, 'embed copy must resolve recurring instances and emit the exact SiYuan query syntax');
assert.ok(
    uiFoundationSource.includes("__tmPhosphorBoldPaths['stack-simple'] = 'M10.05,110.42l112,64a12,12,0,0,0,11.9,0l112-64"),
    'stack-simple must register the original Phosphor Bold path'
);

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
