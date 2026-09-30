'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../src/task-horizon/main/task-runtime/52-task-detail-runtime.js'), 'utf8');
function between(start, end, from = 0) {
    const a = source.indexOf(start, from);
    const b = source.indexOf(end, a + start.length);
    assert.ok(a >= 0 && b > a, start);
    return source.slice(a, b);
}
class Element {
    constructor(kind = '') {
        this.kind = kind;
        this.isConnected = true;
        const classes = new Set(kind ? [kind] : []);
        this.classList = { contains: value => classes.has(value), add: value => classes.add(value), remove: value => classes.delete(value), toggle: (value, on) => on ? classes.add(value) : classes.delete(value) };
    }
    contains(node) { return node === this; }
    closest(selector) { return this.kind === 'day' && selector === '[data-tm-checkin-date]' ? this : null; }
    getAttribute() { return '2026-09-28'; }
    querySelector() { return null; }
}
function harness(inline = true, fail = false) {
    const popover = new Element('tm-task-time-hub-popover');
    const handlers = new Map();
    let finish;
    const pending = new Promise(resolve => { finish = resolve; });
    let closes = 0;
    let renders = 0;
    let positions = 0;
    const task = { id: 'habit', repeatState: {} };
    const context = vm.createContext({
        Element, HTMLElement: Element, Node: Element,
        popover, activeInlinePopover: popover, root: new Element(), task, taskId: task.id,
        busy: false, checkinBusy: false, draftMode: false, inlinePopoverCommitting: false,
        window: {}, document: { activeElement: null, body: { contains: el => el.isConnected } },
        on: (_target, type, callback) => handlers.set(type, callback),
        __tmToggleTaskTimeHubCheckin: async () => { await pending; if (fail) throw new Error('save failed'); return task; },
        getBoundTask: () => task, isSessionActive: () => true,
        setBusy(value) { context.busy = value; },
        setInlinePopoverBusyState(value) { context.inlinePopoverCommitting = value; },
        syncMetaChipFaces() {}, syncSerializedSnapshot() {}, notifyChange: async () => {}, hint() {},
        render: () => { renders += 1; },
        positionInlinePopover: () => { positions += 1; }, positionEditorPanel() {},
        closeInlinePopover: () => { closes += 1; context.activeInlinePopover = null; },
        __tmAreTaskDetailIdsEquivalent: (a, b) => a === b,
    });
    const from = source.indexOf(inline ? 'const openTaskTimeHubPopover =' : 'async function __tmOpenStandaloneTaskTimeHub(');
    const click = between("on(popover, 'click', async (ev) => {", '            const monthOpenBtn =', from);
    vm.runInContext(`${click}\n});`, context);
    vm.runInContext(between("        on(window, 'scroll', (ev) => {", '        const clearSubtaskSaveTimer =', source.indexOf('const openTaskTimeHubPopover =')), context);
    return { context, handlers, popover, finish, stats: () => ({ closes, renders, positions }) };
}

for (const inline of [false, true]) {
    test(`${inline ? 'detail' : 'standalone'} check-in click stays inside and releases busy state`, async () => {
        const h = harness(inline);
        let stopped = false;
        const save = h.handlers.get('click')({ target: new Element('day'), preventDefault() {}, stopPropagation() { stopped = true; } });
        assert.equal(stopped, true, 'a check-in click must not reach outside-dismiss handlers');
        if (inline) {
            assert.equal(h.context.inlinePopoverCommitting, true, 'saving must use the shared close guard');
            h.handlers.get('scroll')({ target: new Element('host-view') });
            assert.equal(h.stats().closes, 0, 'host refresh while saving must not dismiss the calendar');
        }
        h.finish();
        await save;
        assert.equal(inline ? h.context.inlinePopoverCommitting : h.context.busy, false);
        assert.equal(h.stats().renders, 1, 'saved records update in the existing calendar');
    });
}
test('host layout scroll after saving repositions the time hub, but other popovers retain dismissal', () => {
    const h = harness();
    h.handlers.get('scroll')({ target: new Element('host-view') });
    assert.equal(h.stats().closes, 0);
    assert.equal(h.stats().positions, 1);
    h.handlers.get('scroll')({ target: h.popover });
    assert.equal(h.stats().positions, 1, 'internal scrolling does not move the popover');
    h.context.activeInlinePopover = new Element('other-popover');
    h.handlers.get('scroll')({ target: new Element('host-view') });
    assert.equal(h.stats().closes, 1);
});
test('failed check-in leaves the calendar open and releases the save guard', async () => {
    const h = harness(true, true);
    const save = h.handlers.get('click')({ target: new Element('day'), preventDefault() {}, stopPropagation() {} });
    h.finish();
    await save;
    assert.equal(h.context.inlinePopoverCommitting, false);
    assert.equal(h.context.activeInlinePopover, h.popover);
    assert.equal(h.stats().renders, 1);
});
test('detail refresh preserves the active time hub only for its current task', () => {
    const h = harness();
    const helper = between('    function __tmShouldPreserveTaskDetailEditorDuringRefresh(', '    function __tmRefreshChecklistSelectionInPlace(');
    vm.runInContext(helper, h.context);
    const panel = h.context.root;
    panel.dataset = { tmDetailTaskId: 'habit' };
    panel.__tmTaskDetailActiveInlinePopover = h.popover;
    assert.equal(h.context.__tmShouldPreserveTaskDetailEditorDuringRefresh(panel, 'habit'), true);
    assert.equal(h.context.__tmShouldPreserveTaskDetailEditorDuringRefresh(panel, 'another-task'), false);
    h.popover.isConnected = false;
    assert.equal(h.context.__tmShouldPreserveTaskDetailEditorDuringRefresh(panel, 'habit'), false);
});
