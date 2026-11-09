'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const bodySource = read('src', 'task-horizon', 'main', 'render', '44-render-whiteboard-body.js');
const interactionSource = read('src', 'task-horizon', 'main', 'render', '49-render-whiteboard-interactions.js');
const runtimeStateSource = read('src', 'task-horizon', 'main', '20-api-and-runtime-services.js');
const iconSource = read('src', 'task-horizon', 'main', '30-dialogs-and-ui-foundation.js');
const viewSwitchSource = read('src', 'task-horizon', 'main', 'render', '47-render-side-panels-and-view-switching.js');
const layoutSource = read('src', 'task-horizon', 'main', 'settings', '70-doc-group-and-settings-actions.js');
const styles = read('task-horizon.css');
const zh = JSON.parse(read('i18n', 'zh-CN.json'));
const en = JSON.parse(read('i18n', 'en.json'));

assert.match(runtimeStateSource, /whiteboardClickLinkMode:\s*false/);
assert.match(
    bodySource,
    /task\.cardLinkMode[\s\S]*icon:\s*'flow-arrow'[\s\S]*tmWhiteboardToggleClickLinkMode\(event\)[\s\S]*renderWhiteboardToolbarSeparator\(\)[\s\S]*task\.textMode[\s\S]*task\.handwritingMode[\s\S]*tm-whiteboard-toolbar-btn--handwriting[\s\S]*renderWhiteboardToolbarSeparator\(\)/,
    'whiteboard toolbar must use the Phosphor Bold flow-arrow tool with separators after link and handwriting',
);
assert.match(
    bodySource,
    /compactWhiteboardToolbar = !!\(isMobile \|\| isDockHost\)[\s\S]*compactWhiteboardToolbar \? '' : `\$\{[^}]*tmWhiteboardZoomOut[\s\S]*tmWhiteboardZoomIn[\s\S]*tmWhiteboardTogglePluginFullscreen/,
    'zoom and fullscreen must stay inline on desktop and move to More only on mobile or Dock',
);
assert.match(iconSource, /__tmPhosphorBoldPaths\['flow-arrow'\] = 'M248\.49,71\.51/);
assert.match(
    bodySource,
    /clickLinkSourceCls[\s\S]*tm-whiteboard-node--click-link-source[\s\S]*titleAction = taskClickLinkMode[\s\S]*tmWhiteboardSelectTask/,
    'link mode must mark its source card and route card-title clicks through the card link handler',
);
assert.match(
    interactionSource,
    /if \(state\.whiteboardClickLinkMode === true\)[\s\S]*__tmResetLinkDragState\(\)[\s\S]*state\.whiteboardLinkFromTaskId = id[\s\S]*Promise\.resolve\(window\.tmTaskLinkDotDrop\?\.\(ev, id, docId, 'left'\)\)\.finally[\s\S]*state\.whiteboardLinkFromTaskId = id/,
    'card clicks must chain through the existing link-drop commit and make the successor the next source',
);
assert.match(
    interactionSource,
    /key !== 'escape'[\s\S]*__tmExitWhiteboardClickLinkMode\(\)/,
    'Escape must cancel card-link mode',
);
assert.match(viewSwitchSource, /whiteboardClickLinkMode === true[\s\S]*whiteboardClickLinkMode = false/);
assert.match(layoutSource, /tmSetWhiteboardAllTabsLayoutMode[\s\S]*whiteboardClickLinkMode = false/);
assert.match(styles, /\.tm-whiteboard-click-link-hint\s*\{/);
assert.match(styles, /\.tm-whiteboard-viewport--click-link \.tm-whiteboard-node--click-link-source\s*\{/);
assert.match(styles, /\.tm-whiteboard-toolbar-separator\s*\{/);
for (const locale of [zh, en]) {
    for (const key of ['task.cardLinkMode', 'task.choosePredecessorCard', 'task.chooseSuccessorCard', 'task.exitCardLinkMode']) {
        assert.equal(typeof locale[key], 'string', `${key} must be translated`);
        assert.ok(locale[key].trim(), `${key} must not be empty`);
    }
}

const selectStart = interactionSource.indexOf('window.tmWhiteboardSelectTask = function');
const selectEnd = interactionSource.indexOf('window.tmWhiteboardDeleteCard', selectStart);
assert.ok(selectStart >= 0 && selectEnd > selectStart, 'card selection handler must remain extractable');
const selectSource = interactionSource.slice(selectStart, selectEnd);

const state = {
    viewMode: 'whiteboard',
    whiteboardClickLinkMode: true,
    whiteboardClickLinkBusy: false,
    whiteboardClickLinkDeferRender: false,
    whiteboardLinkFromTaskId: '',
    whiteboardLinkFromDocId: '',
    whiteboardLinkFromSide: 'out',
    whiteboardLinkFromAnchor: 'right',
    whiteboardLinkPress: null,
    whiteboardSelectedTaskId: '',
    whiteboardSelectedNoteId: '',
    whiteboardSelectedFrameId: '',
    whiteboardSelectedLinkId: '',
    whiteboardSelectedLinkDocId: '',
    modal: { querySelector: () => true },
};
const dropCalls = [];
let renderCount = 0;
const context = vm.createContext({
    CSS: { escape: (value) => value },
    Date,
    SettingsStore: { data: { whiteboardTool: 'pan' } },
    state,
    window: {
        tmTaskLinkDotDrop: (...args) => {
            dropCalls.push(args);
            return Promise.resolve();
        },
    },
    __tmIsTaskDetailNoteViewEventTarget: () => false,
    __tmResolveWhiteboardTargetAnchor: () => 'left',
    __tmResetLinkDragState: () => {
        state.whiteboardLinkFromTaskId = '';
        state.whiteboardLinkFromDocId = '';
        state.whiteboardLinkFromSide = 'out';
        state.whiteboardLinkFromAnchor = 'right';
        state.whiteboardLinkPress = null;
    },
    __tmClearWhiteboardMultiSelection: () => {},
    __tmApplyWhiteboardCardSelectionDom: () => {},
    render: () => { renderCount += 1; },
});
vm.runInContext(`${selectSource}\nglobalThis.selectTask = window.tmWhiteboardSelectTask;`, context);

const card = (docId) => ({
    getAttribute: (name) => name === 'data-doc-id' ? docId : '',
    closest: () => null,
});
const click = (docId) => ({
    currentTarget: card(docId),
    target: {},
    stopPropagation() {},
});

(async () => {
    context.selectTask('task-before', click('doc-1'));
    assert.equal(state.whiteboardLinkFromTaskId, 'task-before');
    assert.equal(state.whiteboardLinkFromDocId, 'doc-1');
    assert.equal(state.whiteboardClickLinkMode, true);
    assert.equal(renderCount, 1);
    assert.equal(dropCalls.length, 0);

    context.selectTask('task-after', click('doc-1'));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(state.whiteboardClickLinkMode, true);
    assert.equal(state.whiteboardClickLinkBusy, false);
    assert.equal(state.whiteboardLinkFromTaskId, 'task-after');
    assert.equal(dropCalls.length, 1);
    assert.deepEqual(Array.from(dropCalls[0].slice(1)), ['task-after', 'doc-1', 'left']);

    context.selectTask('task-third', click('doc-1'));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(state.whiteboardClickLinkMode, true);
    assert.equal(state.whiteboardLinkFromTaskId, 'task-third');
    assert.equal(dropCalls.length, 2);
    assert.deepEqual(Array.from(dropCalls[1].slice(1)), ['task-third', 'doc-1', 'left']);

    console.log('whiteboard click-link contract tests passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
