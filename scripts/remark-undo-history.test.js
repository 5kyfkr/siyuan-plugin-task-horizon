'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const start = source.indexOf('    function __tmGetTextareaSelectionRange(');
const end = source.indexOf('    function __tmWrapRemarkSelection(', start);
assert.ok(start >= 0 && end > start);
let now = 1000;
class Textarea extends EventTarget {
    constructor(value = '') {
        super();
        this.value = value;
        this.selectionStart = this.selectionEnd = value.length;
        this.scrollTop = this.scrollLeft = 0;
    }
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
    focus() {}
}
const context = vm.createContext({ HTMLTextAreaElement: Textarea, Event, WeakMap, Date: { now: () => now },
    __tmNormalizeRemarkMarkdown: value => String(value || '').trim() });
vm.runInContext(source.slice(start, end) + `
    this.api = {
        bind: __tmBindRemarkTextareaUndoHistory,
        reset: __tmResetRemarkTextareaUndoHistory,
        state: __tmGetRemarkTextareaHistoryState,
        undo: el => __tmRestoreRemarkTextareaHistory(el, 'undo'),
        redo: el => __tmRestoreRemarkTextareaHistory(el, 'redo'),
        set: __tmSetTextareaValueAndSelection,
        external: __tmSetRemarkTextareaExternalValue,
        key: __tmHandleRemarkTextareaUndoRedoKeydown,
    };
`, context);
const api = context.api;
function editor(value = '') { const el = new Textarea(value); api.bind(el); return el; }
function fire(el, type, inputType = '', extra = {}) {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { inputType, ...extra });
    el.dispatchEvent(event);
    return event;
}
function insert(el, text, inputType = 'insertText') {
    fire(el, 'beforeinput', inputType);
    const { selectionStart: start, selectionEnd: end } = el;
    el.value = el.value.slice(0, start) + text + el.value.slice(end);
    el.setSelectionRange(start + text.length, start + text.length);
    fire(el, 'input', inputType);
    now += 100;
}
function shortcut(el, key = 'z', modifiers = {}) {
    const event = new Event('keydown', { cancelable: true });
    Object.assign(event, { key, ctrlKey: true, ...modifiers });
    const handled = api.key(el, event);
    return { handled, prevented: event.defaultPrevented };
}
function state(el) { return JSON.parse(JSON.stringify(api.state(el))); }

{
    const el = editor();
    const changes = [];
    el.addEventListener('tm-remark-history-change', () => changes.push(state(el)));
    assert.deepEqual(state(el), { canUndo: false, canRedo: false });
    insert(el, 'a'); insert(el, 'b');
    assert.deepEqual(state(el), { canUndo: true, canRedo: false });
    assert.equal(api.undo(el), true);
    assert.equal(el.value, '', 'continuous typing is one undo step');
    assert.deepEqual(state(el), { canUndo: false, canRedo: true });
    assert.equal(api.redo(el), true);
    assert.equal(el.value, 'ab');
    assert.deepEqual(changes.at(-1), { canUndo: true, canRedo: false });
    now += 901;
    insert(el, 'c');
    api.undo(el);
    assert.equal(el.value, 'ab', 'a typing pause starts a new group');
}
{
    const el = editor();
    insert(el, 'ab'); el.setSelectionRange(0, 0); insert(el, 'X');
    api.undo(el);
    assert.equal(el.value, 'ab', 'moving the cursor starts a new group');
    api.undo(el);
    assert.equal(el.value, '');
    api.redo(el); insert(el, 'new');
    assert.equal(api.redo(el), false, 'a new edit clears redo');
}
{
    const el = editor('word');
    el.setSelectionRange(0, 4);
    api.set(el, '**word**', 2, 6);
    el.scrollTop = 80; el.scrollLeft = 12;
    assert.equal(api.undo(el), true);
    assert.equal(el.value, 'word');
    assert.deepEqual([el.selectionStart, el.selectionEnd], [0, 4]);
    assert.deepEqual([el.scrollTop, el.scrollLeft], [80, 12]);
    assert.equal(api.redo(el), true);
    assert.deepEqual([el.selectionStart, el.selectionEnd], [2, 6]);
}
{
    const el = editor('base');
    fire(el, 'compositionstart');
    el.value = 'base中文'; el.setSelectionRange(6, 6);
    fire(el, 'input', 'insertCompositionText', { isComposing: true });
    assert.deepEqual(state(el), { canUndo: false, canRedo: false });
    assert.equal(api.undo(el), false, 'composition must not be interrupted by buttons');
    assert.equal(shortcut(el, 'z', { isComposing: true }).handled, false);
    fire(el, 'compositionend');
    fire(el, 'input', 'insertText');
    api.undo(el);
    assert.equal(el.value, 'base', 'a committed Chinese composition is one undo step');
    api.redo(el);
    assert.equal(el.value, 'base中文');
}
{
    const el = editor();
    insert(el, 'a');
    assert.deepEqual(shortcut(el), { handled: true, prevented: true });
    assert.equal(el.value, '');
    assert.deepEqual(shortcut(el), { handled: true, prevented: true }, 'empty history must not fall through to native undo');
    assert.equal(shortcut(el, 'z', { shiftKey: true }).handled, true);
    assert.equal(el.value, 'a');
    shortcut(el, 'z', { ctrlKey: false, metaKey: true });
    shortcut(el, 'y');
    assert.equal(el.value, 'a', 'Cmd+Z and Ctrl+Y share the history');
    assert.equal(shortcut(el, 'z', { altKey: true }).handled, false);
    assert.equal(shortcut(new Textarea()).handled, false, 'unbound editors retain native history');
    el.readOnly = true;
    assert.equal(api.undo(el), false);
    assert.deepEqual(state(el), { canUndo: false, canRedo: false });
}
{
    const el = editor();
    insert(el, 'native menu');
    assert.equal(fire(el, 'beforeinput', 'historyUndo').defaultPrevented, true);
    assert.equal(el.value, '');
    assert.equal(fire(el, 'beforeinput', 'historyUndo').defaultPrevented, true);
    assert.equal(fire(el, 'beforeinput', 'historyRedo').defaultPrevented, true);
    assert.equal(el.value, 'native menu');
}
{
    const el = editor('saved');
    insert(el, '!');
    assert.equal(api.external(el, 'saved!'), false);
    assert.equal(state(el).canUndo, true, 'unchanged save echoes preserve undo');
    insert(el, '  ');
    assert.equal(api.external(el, 'saved!'), false);
    assert.equal(state(el).canUndo, true, 'normalized save echoes preserve undo and the raw draft');
    api.external(el, 'changed elsewhere');
    assert.deepEqual(state(el), { canUndo: false, canRedo: false }, 'external content replacement starts a new baseline');
    insert(el, '!'); api.reset(el);
    assert.equal(api.undo(el), false, 'reopening a session clears history');
    const other = editor('another task'); insert(other, '!');
    assert.equal(api.undo(el), false, 'task histories are isolated');
    assert.equal(api.undo(other), true);
}
{
    const el = editor();
    for (let i = 1; i <= 105; i++) api.set(el, String(i), String(i).length);
    let count = 0;
    while (api.undo(el)) count++;
    assert.equal(count, 100, 'history stays bounded');
    assert.equal(el.value, '5');
}
console.log('remark undo/redo typing, selection, IME, shortcuts, native menu, reset and isolation passed');
