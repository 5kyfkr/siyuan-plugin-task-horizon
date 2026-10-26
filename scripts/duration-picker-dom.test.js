'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const utilsSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/06a-duration-utils.js'), 'utf8');
const pickerSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/20a-duration-picker.js'), 'utf8');

class StubClassList {
    constructor() { this.set = new Set(); }
    add(...names) { names.forEach((name) => this.set.add(String(name))); }
    remove(...names) { names.forEach((name) => this.set.delete(String(name))); }
    contains(name) { return this.set.has(String(name)); }
    toggle(name, force) {
        const shouldAdd = force === undefined ? !this.contains(name) : !!force;
        if (shouldAdd) this.add(name); else this.remove(name);
        return shouldAdd;
    }
    get value() { return Array.from(this.set).join(' '); }
}

class StubElement {
    constructor(tagName = 'div') {
        this.tagName = String(tagName).toUpperCase();
        this.children = [];
        this.parentNode = null;
        this.attributes = new Map();
        this.listeners = new Map();
        this.classList = new StubClassList();
        this.className = '';
        this.textContent = '';
        this.value = '';
    }
    appendChild(child) {
        if (!child) return child;
        child.parentNode = this;
        this.children.push(child);
        return child;
    }
    remove() {
        if (!this.parentNode) return;
        const index = this.parentNode.children.indexOf(this);
        if (index >= 0) this.parentNode.children.splice(index, 1);
        this.parentNode = null;
    }
    setAttribute(name, value) {
        this.attributes.set(String(name), String(value));
        if (name === 'class') String(value).split(/\s+/).filter(Boolean).forEach((token) => this.classList.add(token));
    }
    getAttribute(name) {
        const key = String(name);
        return this.attributes.has(key) ? this.attributes.get(key) : null;
    }
    addEventListener(type, handler) {
        const key = String(type);
        if (!this.listeners.has(key)) this.listeners.set(key, []);
        this.listeners.get(key).push(handler);
    }
    removeEventListener(type, handler) {
        const list = this.listeners.get(String(type));
        if (!list) return;
        const index = list.indexOf(handler);
        if (index >= 0) list.splice(index, 1);
    }
    dispatchEvent(event) {
        event.target = this;
        event.currentTarget = this;
        const list = this.listeners.get(event.type) || [];
        list.slice().forEach((handler) => handler.call(this, event));
        const inline = this[`on${event.type}`];
        if (typeof inline === 'function') inline.call(this, event);
        return !event.defaultPrevented;
    }
    focus() { document.activeElement = this; }
    select() {}
}

class StubInputElement extends StubElement {
    constructor(tagName = 'input') {
        super(tagName);
        this.type = 'text';
        this.min = '';
        this.max = '';
        this.step = '';
        this.inputMode = '';
    }
}

class StubEvent {
    constructor(type, init = {}) {
        this.type = String(type);
        this.bubbles = !!init.bubbles;
        this.cancelable = !!init.cancelable;
        this.defaultPrevented = false;
        this.target = null;
        this.currentTarget = null;
    }
    preventDefault() { this.defaultPrevented = true; }
    stopPropagation() {}
}

class StubKeyboardEvent extends StubEvent {
    constructor(type, init = {}) {
        super(type, init);
        this.key = String(init.key || '');
        this.isComposing = !!init.isComposing;
    }
}

const document = {
    activeElement: null,
    createElement(tagName) {
        const tag = String(tagName || 'div').toLowerCase();
        return tag === 'input' ? new StubInputElement('input') : new StubElement(tag);
    },
};

const context = {
    console,
    document,
    Element: StubElement,
    HTMLInputElement: StubInputElement,
    Event: StubEvent,
    KeyboardEvent: StubKeyboardEvent,
};
vm.createContext(context);
vm.runInContext(utilsSource, context);
vm.runInContext(pickerSource, context);
assert.equal(typeof context.__tmCreateDurationPicker, 'function', 'picker factory must load');

const picker = context.__tmCreateDurationPicker({ value: '2.5' });
assert.equal(picker.unit, 'hours');
assert.equal(picker.hourInput.value, '2');
assert.equal(picker.minuteInput.value, '30');
assert.equal(picker.preview.textContent, '= 2h30m');
assert.equal(picker.input.value, '2.5');

picker.hourInput.value = '3';
picker.hourInput.dispatchEvent(new StubEvent('input'));
assert.equal(picker.input.value, '3.5', '3h30m must write 3.5 hours');
assert.equal(picker.preview.textContent, '= 3h30m');

picker.minuteInput.value = '0';
picker.minuteInput.dispatchEvent(new StubEvent('input'));
assert.equal(picker.input.value, '3', '3h must write 3 hours');
assert.equal(picker.preview.textContent, '= 3h');

picker.input.value = '0.5';
picker.input.dispatchEvent(new StubEvent('input'));
assert.equal(picker.hourInput.value, '0');
assert.equal(picker.minuteInput.value, '30');
assert.equal(picker.preview.textContent, '= 30m');

let entered = 0;
picker.input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') entered += 1;
});
picker.hourInput.dispatchEvent(new StubKeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
assert.equal(entered, 1, 'Enter on the visible field must reach the storage input');

const existing = new StubInputElement('input');
existing.value = '90';
const minutesPicker = context.__tmCreateDurationPicker({ storageInput: existing, unit: 'minutes' });
assert.equal(minutesPicker.input, existing);
assert.equal(existing.classList.contains('tm-duration-picker__storage'), true);
assert.equal(minutesPicker.hourInput.value, '1');
assert.equal(minutesPicker.minuteInput.value, '30');
assert.equal(minutesPicker.preview.textContent, '= 1h30m');
minutesPicker.destroy();
assert.equal(existing.classList.contains('tm-duration-picker__storage'), false);
assert.equal(existing.__tmDurationPicker, undefined);

const emptyPicker = context.__tmCreateDurationPicker({ value: '' });
assert.equal(emptyPicker.hourInput.value, '0');
assert.equal(emptyPicker.minuteInput.value, '0');
assert.equal(emptyPicker.preview.textContent, '');
emptyPicker.hourInput.value = '0';
emptyPicker.minuteInput.value = '0';
emptyPicker.minuteInput.dispatchEvent(new StubEvent('input'));
assert.equal(emptyPicker.input.value, '', '0h0m must clear the stored value');

console.log('duration picker DOM tests passed');
