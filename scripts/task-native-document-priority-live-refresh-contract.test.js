'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const nativeHooks = fs.readFileSync(path.join(root, 'src/task-horizon/main/shell/72-shell-entrances-and-native-doc-hooks.js'), 'utf8');
const lifecycle = fs.readFileSync(path.join(root, 'src/task-horizon/main/shell/80-shell-lifecycle.js'), 'utf8');

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

const mirrorSource = segment(
    nativeHooks,
    'function __tmMirrorNativeDocTaskPriorityAttr',
    'function __tmReadNativeDocCheckboxTaskSnapshot',
);
const attrHandler = segment(
    lifecycle,
    '__tmQuickbarTaskUpdateHandler = (e) => {',
    "globalThis.__tmRuntimeEvents?.on?.(window, 'tm-task-attr-updated'",
);
assert.match(attrHandler, /__tmMirrorNativeDocTaskPriorityAttr\(e\.detail\)/,
    'the shared task attribute event must immediately mirror priority into the open document');
assert.ok(
    attrHandler.indexOf('__tmMirrorNativeDocTaskPriorityAttr(e.detail)') < attrHandler.indexOf('if (localMutationEvent)'),
    'local plugin mutations and quickbar relays must both update the native document before branching');

class FakeElement {
    constructor(id, kind = 'list') {
        this.attrs = new Map([['data-node-id', id]]);
        this.kind = kind;
    }

    getAttribute(key) {
        return this.attrs.has(key) ? this.attrs.get(key) : null;
    }

    setAttribute(key, value) {
        this.attrs.set(key, String(value));
    }

    removeAttribute(key) {
        this.attrs.delete(key);
    }

    matches() {
        return this.kind === 'task';
    }
}

const hostA = new FakeElement('host-1');
const hostB = new FakeElement('host-1');
const taskA = new FakeElement('task-1', 'task');
const taskB = new FakeElement('task-1', 'task');
const byId = new Map([
    ['host-1', [hostA, hostB]],
    ['task-1', [taskA, taskB]],
]);
const findElements = (ids) => Array.from(new Set((ids || []).flatMap((id) => byId.get(String(id || '')) || [])));
const mirrorPriority = new Function(
    'Element',
    '__tmResolveTaskMetaFieldByAttrKey',
    '__tmGetTaskMetaAttrReadKeys',
    '__tmGetTaskMetaAttrKey',
    '__tmFindNativeDocBlockElementsByIds',
    `${mirrorSource}; return __tmMirrorNativeDocTaskPriorityAttr;`,
)(
    FakeElement,
    (key) => ['custom-importance', 'custom-priority'].includes(key) ? 'priority' : '',
    () => ['custom-importance', 'custom-priority'],
    () => 'custom-importance',
    findElements,
);

hostA.setAttribute('custom-priority', 'low');
hostB.setAttribute('custom-priority', 'low');
assert.equal(mirrorPriority({
    taskId: 'task-1',
    attrHostId: 'host-1',
    attrKey: 'custom-importance',
    value: 'high',
}), true);
[hostA, hostB].forEach((host) => {
    assert.equal(host.getAttribute('custom-importance'), 'high', 'every visible split-pane attribute host must receive the new priority');
    assert.equal(host.getAttribute('custom-priority'), null, 'a stale priority alias must not override the new CSS rule');
});
assert.equal(taskA.getAttribute('custom-importance'), null, 'a visible attribute host must take precedence over the task fallback');

taskA.setAttribute('custom-importance', 'high');
taskB.setAttribute('custom-importance', 'high');
assert.equal(mirrorPriority({
    taskId: 'task-1',
    attrHostId: 'missing-host',
    attrKey: 'custom-priority',
    value: 'none',
}), true);
[taskA, taskB].forEach((task) => {
    assert.equal(task.getAttribute('custom-priority'), 'none', 'the unset priority must immediately use the neutral checkbox color');
    assert.equal(task.getAttribute('custom-importance'), null);
});

assert.equal(mirrorPriority({
    taskId: 'task-1',
    attrKey: 'custom-priority',
    value: '',
}), true);
[taskA, taskB].forEach((task) => {
    assert.equal(task.getAttribute('custom-priority'), null, 'an empty priority must remove the live color attribute');
});

console.log('task native document priority live refresh contract: ok');
