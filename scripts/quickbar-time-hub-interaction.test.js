'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const quickbarSource = fs.readFileSync(path.join(root, 'quickbar.js'), 'utf8');
const detailSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/52-task-detail-runtime.js'), 'utf8');
function segment(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.ok(start >= 0 && end > start, `${startMarker} must remain extractable`);
    return source.slice(start, end);
}

class Element {
    constructor(selector = '', parent = null) {
        this.selector = selector;
        this.parentElement = parent;
        this.dataset = {};
        this.isConnected = true;
        this.classList = { remove() {} };
        this.rect = { left: 120, right: 200, top: 20, bottom: 44, width: 80, height: 24 };
    }

    closest(selector) {
        return this.selector === selector ? this : this.parentElement?.closest(selector);
    }

    contains(target) {
        return target === this || !!target?.parentElement && this.contains(target.parentElement);
    }

    querySelectorAll() { return this.chips || []; }
    getBoundingClientRect() { return this.rect; }
}

const parent = new Element('.sy-custom-props-inline-parent');
const editor = new Element('[contenteditable="true"]', parent);
const host = new Element('.sy-custom-props-inline-host', parent);
const chip = new Element('.sy-custom-props-inline-chip', host);
const icon = new Element('svg', chip);
const otherChip = new Element('.sy-custom-props-inline-chip', host);
otherChip.rect = { left: 210, right: 290, top: 20, bottom: 44, width: 80, height: 24 };
parent.chips = [chip, otherChip];
host.dataset = { blockId: 'task-1', taskId: 'task-1', attrHostId: 'task-1' };
host.__tmQuickbarInlineBlockEl = parent;
const popover = new Element();
const calendarDay = new Element('button', popover);
const outside = new Element();
const openCalls = [];
const closeReasons = [];
const context = vm.createContext({
    Element, HTMLElement: Element, Node: Element,
    window: {
        tmOpenTaskTimeHub(taskId, trigger, options) {
            openCalls.push({ taskId, trigger, options });
        },
    },
    inputEditor: new Element(),
    currentBlockId: '', currentProps: {}, activePropConfig: null,
    inlineMetaHostPointerDownHandler: null, inlineMetaInteractUntil: 0,
    updateCurrentTaskContext(block, id) { context.currentBlockId = id; },
    getTaskCustomProps: async () => ({}),
    getInlineFieldConfig: (attrKey) => ({ attrKey, type: 'date' }),
    __tmCloseStandaloneTaskTimeHub: (reason) => closeReasons.push(reason),
});
vm.runInContext([
    segment(quickbarSource, 'const __tmQBResolveInlineMetaPointerTarget =', 'const __tmQBOnInlineMetaPointerdownCapture ='),
    segment(quickbarSource, 'function showDateEditor(', 'function showFocusSummaryEditor('),
    segment(quickbarSource, 'async function handleInlineHostPointerDown(', 'function bindInlineHostPointerHandler('),
].join('\n'), context);
const outsideHandlersSource = segment(detailSource, 'const isTimeHubInside = (ev) => {', "on(document, 'keydown'");

function event(type, target, clientX = 150, clientY = 30) {
    return {
        type, target, clientX, clientY, detail: type === 'click' ? 1 : 0,
        composedPath() {
            const nodes = [];
            for (let node = target; node; node = node.parentElement) nodes.push(node);
            return nodes;
        },
        preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {},
    };
}

async function openFromPointer(attrKey, target = editor) {
    chip.dataset.inlineAttr = attrKey;
    context.openingEvent = event('pointerdown', target);
    const resolved = vm.runInContext('__tmQBResolveInlineMetaPointerTarget(openingEvent)', context);
    assert.equal(resolved?.chip, chip, 'the visible chip must resolve even when the editor receives pointerdown');
    await context.handleInlineHostPointerDown(resolved.host, resolved.chip, context.openingEvent);
    const opened = openCalls.at(-1);
    assert.equal(opened.taskId, 'task-1');
    assert.equal(opened.trigger, chip);
    assert.equal(opened.options.activeField, attrKey === 'custom-start-date' ? 'startDate' : 'completionTime');
    const handlers = new Map();
    const dismissalContext = vm.createContext({
        Node: Element, Element, popover, trigger: opened.trigger, opts: opened.options, busy: false,
        window: {}, on: (target, type, handler) => handlers.set(type, handler),
        __tmCloseStandaloneTaskTimeHub: (reason) => closeReasons.push(reason),
    });
    vm.runInContext(outsideHandlersSource, dismissalContext);
    return handlers;
}

async function main() {
    for (const attrKey of ['custom-start-date', 'custom-completion-time']) {
        for (const target of [editor, icon]) {
            const handlers = await openFromPointer(attrKey, target);
            closeReasons.length = 0;
            handlers.get('click')(event('click', target));
            assert.deepEqual(closeReasons, [], `${attrKey}: the opening click must not immediately close the time hub`);
            handlers.get('pointerdown')(event('pointerdown', calendarDay));
            handlers.get('click')(event('click', calendarDay));
            assert.deepEqual(closeReasons, [], 'calendar controls must remain interactive');
        }

        const handlers = await openFromPointer(attrKey);
        for (const [target, x] of [[editor, 80], [editor, 240], [otherChip, 240], [outside, 150]]) {
            closeReasons.length = 0;
            handlers.get('pointerdown')(event('pointerdown', target, x));
            assert.deepEqual(closeReasons, ['outside'], 'a new pointerdown outside this chip must still dismiss immediately');
            closeReasons.length = 0;
            handlers.get('click')(event('click', target, x));
            assert.deepEqual(closeReasons, ['outside-click'], 'an outside click must still dismiss');
        }

        closeReasons.length = 0;
        handlers.get('click')({ type: 'click', target: editor, clientX: 150, clientY: 30 });
        assert.deepEqual(closeReasons, [], 'retargeted clicks without composedPath must also preserve the time hub');

        for (const target of [editor, host, parent, outside]) {
            const redrawHandlers = await openFromPointer(attrKey);
            const replacement = new Element('.sy-custom-props-inline-chip', host);
            replacement.dataset.inlineAttr = attrKey;
            parent.chips = [replacement, otherChip];
            chip.isConnected = false;
            closeReasons.length = 0;
            redrawHandlers.get('click')(event('click', target));
            assert.deepEqual(closeReasons, [], 'the opening gesture must survive chip replacement and click retargeting');
            parent.chips = [chip, otherChip];
            chip.isConnected = true;
            redrawHandlers.get('pointerdown')(event('pointerdown', outside));
            assert.deepEqual(closeReasons, ['outside'], 'the next outside pointerdown must close without any grace period');
        }

        const releaseHandlers = await openFromPointer(attrKey);
        closeReasons.length = 0;
        releaseHandlers.get('click')(event('click', editor, 118));
        assert.deepEqual(closeReasons, [], 'a slight movement on release must not turn the opening gesture into an outside click');
        releaseHandlers.get('pointerdown')(event('pointerdown', calendarDay));
        releaseHandlers.get('click')(event('click', outside));
        assert.deepEqual(closeReasons, [], 'calendar gestures must retain their origin when their target is replaced before click');
        releaseHandlers.get('click')({ ...event('click', outside), detail: 0 });
        assert.deepEqual(closeReasons, ['outside-click'], 'keyboard and programmatic outside clicks must still close');

        const delayedHandlers = await openFromPointer(attrKey);
        closeReasons.length = 0;
        delayedHandlers.get('pointerdown')(event('pointerdown', outside));
        assert.deepEqual(closeReasons, ['outside'], 'opening after the initial click must not swallow the next outside gesture');
    }

    console.log('quickbar time hub interaction tests passed');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
