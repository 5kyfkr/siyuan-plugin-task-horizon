const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'quickbar.js'), 'utf8');

function sliceSource(startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.notEqual(start, -1, `${startMarker} must exist`);
    assert.notEqual(end, -1, `${endMarker} must exist`);
    return source.slice(start, end);
}

const updateSource = sliceSource(
    'function updateInlineMetaSelectionVisibility()',
    'function shouldHandleInlineMetaViewportEvent',
);
const createHarness = new Function('window', 'document', 'Node', `
    let inlineMetaSelectionActive = false;
    ${updateSource}
    return {
        update: updateInlineMetaSelectionVisibility,
        active: () => inlineMetaSelectionActive,
    };
`);

let selectedText = '';
let queryCount = 0;
let classWriteCount = 0;
const editorElement = { closest: () => ({}) };
const windowMock = {
    getSelection() {
        return {
            toString: () => selectedText,
            anchorNode: { nodeType: 3, parentElement: editorElement },
            focusNode: { nodeType: 3, parentElement: editorElement },
        };
    },
};
const documentMock = {
    querySelectorAll() {
        queryCount += 1;
        return [{
            classList: {
                add() { classWriteCount += 1; },
                remove() { classWriteCount += 1; },
            },
        }];
    },
};
const harness = createHarness(windowMock, documentMock, { ELEMENT_NODE: 1 });

harness.update();
assert.equal(queryCount, 0, 'ordinary mouseup without a selection must not scan inline metadata layers');

selectedText = 'selected';
harness.update();
assert.equal(harness.active(), true);
assert.equal(queryCount, 1);
assert.equal(classWriteCount, 1);

harness.update();
assert.equal(queryCount, 1, 'selectionchange and the delayed mouseup callback must not repeat identical DOM writes');

selectedText = '';
harness.update();
assert.equal(harness.active(), false);
assert.equal(queryCount, 2);
assert.equal(classWriteCount, 2);

const selectionHandlerSource = sliceSource(
    'const checkAndHideForTextSelection = () =>',
    '// 监听多种事件',
);
assert.doesNotMatch(selectionHandlerSource, /offsetParent/, 'text-selection handling must not force layout');

process.stdout.write('quickbar selection performance contract tests passed\n');
