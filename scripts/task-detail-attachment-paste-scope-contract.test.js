'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const detailSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/task-runtime/52-task-detail-runtime.js'),
    'utf8',
).replace(/\r\n/g, '\n');

const start = detailSource.indexOf('const __TM_TASK_DETAIL_TEXT_PASTE_TARGET_SELECTOR');
const end = detailSource.indexOf('\n\n    function __tmReadTaskDetailAttachmentPathsFromSection', start);
assert.ok(start >= 0 && end > start, 'the text paste target guard must remain extractable');

class Element {
    constructor(matches = false) {
        this.matches = matches;
        this.seenSelector = '';
    }

    closest(selector) {
        this.seenSelector = selector;
        return this.matches ? this : null;
    }
}

const context = { Element };
context.globalThis = context;
vm.runInNewContext(detailSource.slice(start, end), context);

const isTextPasteTarget = context.__tmIsTaskDetailTextPasteTarget;
assert.equal(typeof isTextPasteTarget, 'function', 'the paste guard must exist');

assert.equal(isTextPasteTarget(null), false, 'a missing paste target is not a text input');
assert.equal(isTextPasteTarget(undefined), false);
assert.equal(isTextPasteTarget({}), false, 'non-element paste targets are ignored');

const textarea = new Element(true);
assert.equal(isTextPasteTarget(textarea), true, 'pasting inside a text input is owned by the input');
assert.match(textarea.seenSelector, /\btextarea\b/, 'the guard must recognize textareas');
assert.match(textarea.seenSelector, /\[data-tm-detail="remark"\]/, 'the guard must recognize the task detail remark editor');
assert.match(textarea.seenSelector, /\[contenteditable="true"\]/, 'the guard must recognize contenteditable editors');
assert.match(textarea.seenSelector, /input:not\(\[type="checkbox"\]\)/, 'checkbox and button inputs must not own text pastes');

const plainTarget = new Element(false);
assert.equal(isTextPasteTarget(plainTarget), false, 'non-editable detail targets keep the attachment paste handler');

const pasteHandlerStart = detailSource.indexOf('const handleDetailAttachmentPaste = async (ev) => {');
assert.ok(pasteHandlerStart > 0, 'the detail attachment paste handler must remain present');
const pasteHandlerSource = detailSource.slice(pasteHandlerStart, pasteHandlerStart + 600);
const guardIndex = pasteHandlerSource.indexOf('__tmIsTaskDetailTextPasteTarget(ev?.target)');
const contextIndex = pasteHandlerSource.indexOf('isAttachmentPasteContextActive(ev)');
assert.ok(guardIndex > 0, 'the paste handler must bail out for text editing targets');
assert.ok(
    guardIndex < contextIndex,
    'the text editing guard must run before the attachment paste context check',
);

assert.match(
    detailSource,
    /on\(root, 'paste', handleDetailAttachmentPaste\)/,
    'the detail root paste listener must stay registered',
);
assert.match(
    detailSource,
    /on\(document, 'paste', handleDetailAttachmentPaste, \{ capture: true \}\)/,
    'the document capture paste listener must stay registered',
);

console.log('task detail attachment paste scope contract tests passed');
