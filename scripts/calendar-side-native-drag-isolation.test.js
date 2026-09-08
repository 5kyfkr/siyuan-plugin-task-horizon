'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'calendar-view.js'), 'utf8');
const start = source.indexOf('    function bindSideDayNativeDrop(');
const end = source.indexOf('    function bindSideDayExternalDraggable(', start);
assert.ok(start >= 0 && end > start, 'native side calendar drop binding must exist');
const bindingSource = source.slice(start, end);

class FakeElement {
    constructor() { this.listeners = new Map(); }
    addEventListener(type, handler, options = {}) {
        const entries = this.listeners.get(type) || [];
        entries.push({ handler, signal: options.signal });
        this.listeners.set(type, entries);
    }
    async emit(type, event) {
        for (const entry of this.listeners.get(type) || []) {
            if (!entry.signal?.aborted) await entry.handler(event);
        }
    }
    querySelectorAll() { return []; }
    getBoundingClientRect() { return { left: 600, right: 900, top: 0, bottom: 800 }; }
}

function createHarness() {
    const root = new FakeElement();
    const document = new FakeElement();
    const window = new FakeElement();
    const frames = new Map();
    const timers = new Map();
    const payload = { taskId: 'task-1', title: 'Task' };
    const state = { sideDay: { rootEl: root, previewKey: '' } };
    const counts = { globalClears: 0, payloadReads: 0, hitTests: 0, previews: 0 };
    const previews = [];
    const drops = [];
    let highlighted = true;
    let nextId = 0;
    const context = {
        state, document, window, AbortController,
        Element: FakeElement,
        HTMLElement: FakeElement,
        requestAnimationFrame(callback) { frames.set(++nextId, callback); return nextId; },
        cancelAnimationFrame(id) { frames.delete(id); },
        setInterval(callback) { timers.set(++nextId, callback); return nextId; },
        clearInterval(id) { timers.delete(id); },
        buildDraggingTaskPayload() { counts.payloadReads += 1; return payload; },
        parseTaskDropPayload() { counts.payloadReads += 1; return payload; },
        resolveCalendarExternalDragPointTarget() { return root; },
        resolveSideDayDropHitFromPoint(host, target, clientX, clientY) {
            counts.hitTests += 1;
            return { start: new Date(2026, 8, 8, 0, clientY), allDay: false, clientY };
        },
        renderSideDayDropPreview(host, task, hit) {
            counts.previews += 1;
            previews.push(hit.clientY);
            state.sideDay.previewKey = String(hit.clientY);
        },
        clearSideDayDropPreview() { state.sideDay.previewKey = ''; },
        updateSideDayCalendarDragPreview(options) {
            const hit = context.resolveSideDayDropHitFromPoint(root, root, options.clientX, options.clientY);
            context.renderSideDayDropPreview(root, options.payload, hit);
        },
        calendarExternalDragPreviewController: {
            clear() {
                counts.globalClears += 1;
                highlighted = false;
                context.clearSideDayDropPreview();
            },
            resolvePayload(options) { return options.payload; },
        },
        getCalendarView() { return { type: 'timeGridDay' }; },
        async addTaskScheduleFromCalendarDropPayload(task, hit) { drops.push({ task, hit }); },
    };
    const bind = vm.runInNewContext(`(${bindingSource.trim()})`, context);
    bind(root, () => payload);
    return {
        root, document, window, state, counts, previews, drops, frames, timers,
        bind: () => bind(root, () => payload),
        isHighlighted: () => highlighted,
        flushFrame() {
            const callbacks = Array.from(frames.values());
            frames.clear();
            callbacks.forEach((callback) => callback());
        },
    };
}

function dragEvent(clientX, clientY, types = ['application/x-tm-task']) {
    return {
        clientX, clientY, target: new FakeElement(),
        dataTransfer: { types },
        defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; },
    };
}

async function main() {
    const outside = createHarness();
    for (let index = 0; index < 60; index += 1) {
        const event = dragEvent(200, 200 + index);
        await outside.document.emit('dragover', event);
        await outside.document.emit('drag', event);
        assert.equal(event.defaultPrevented, false, 'the sidebar must not claim list drags');
    }
    console.log('Outside-sidebar drag counts:', outside.counts);
    assert.equal(outside.counts.globalClears, 0, 'sidebar listeners must not clear task-row or main-calendar indicators');
    assert.equal(outside.isHighlighted(), true, 'hovered task highlight must remain stable');
    assert.equal(outside.counts.payloadReads, 0, 'outside drags must not resolve task metadata');
    assert.equal(outside.counts.hitTests, 0, 'outside drags must not hit-test calendar slots');

    for (const types of [[], ['application/x-tm-task-link']]) {
        const event = dragEvent(200, 250, types);
        await outside.document.emit('dragover', event);
        assert.equal(event.defaultPrevented, false, 'protected transfers and whiteboard links outside the sidebar must stay untouched');
    }
    assert.equal(outside.counts.payloadReads, 0);
    assert.equal(outside.frames.size, 0);
    assert.equal(outside.timers.size, 0);

    const inside = createHarness();
    for (let index = 0; index < 60; index += 1) {
        const event = dragEvent(700, 200 + index);
        await inside.document.emit('dragover', event);
        await inside.root.emit('dragover', event);
        assert.equal(event.defaultPrevented, true, 'valid sidebar drops must be accepted synchronously');
    }
    assert.equal(inside.frames.size, 1, 'all native drag events in a frame must share one preview update');
    assert.equal(inside.counts.hitTests, 0, 'slot geometry must wait for the preview frame');
    inside.flushFrame();
    assert.deepEqual(inside.previews, [259], 'only the latest position must be rendered');
    assert.equal(inside.counts.hitTests, 1, 'the preview must not repeat hit-testing through the shared controller');
    console.log('Inside-sidebar drag counts after one frame:', inside.counts);

    await inside.root.emit('scroll', {});
    await inside.root.emit('scroll', {});
    assert.equal(inside.frames.size, 1, 'scroll updates must coalesce');
    inside.flushFrame();
    assert.deepEqual(inside.previews, [259, 259], 'scroll must refresh the stationary drag preview');
    await inside.document.emit('dragover', dragEvent(200, 270));
    assert.equal(inside.state.sideDay.previewKey, '', 'leaving the sidebar must remove its preview');
    assert.equal(inside.isHighlighted(), true, 'leaving the sidebar must preserve task-row highlights');
    assert.equal(inside.frames.size, 0);
    assert.equal(inside.timers.size, 0);

    const drop = createHarness();
    await drop.document.emit('dragover', dragEvent(700, 300, []));
    const released = dragEvent(700, 345);
    await drop.document.emit('drop', released);
    await drop.root.emit('drop', released);
    assert.equal(drop.drops.length, 1, 'one native drop must commit exactly once');
    assert.equal(drop.drops[0].hit.clientY, 345, 'drop must resolve final coordinates, not a queued preview');
    assert.equal(drop.frames.size, 0, 'drop must cancel stale preview frames');
    assert.equal(drop.timers.size, 0, 'drop must stop preview refresh timers');
    assert.equal(drop.counts.globalClears, 0, 'drop cleanup must remain scoped to the side calendar');

    const lifecycle = createHarness();
    await lifecycle.document.emit('dragover', dragEvent(700, 400));
    lifecycle.bind();
    assert.equal(lifecycle.frames.size, 0, 'rebinding must cancel the old drag frame');
    assert.equal(lifecycle.timers.size, 0, 'rebinding must cancel the old drag timer');
    const readsBefore = lifecycle.counts.payloadReads;
    await lifecycle.document.emit('dragover', dragEvent(700, 410));
    assert.equal(lifecycle.counts.payloadReads - readsBefore, 1, 'rebinding must leave only one active document listener');
    await lifecycle.window.emit('dragend', {});
    assert.equal(lifecycle.frames.size, 0, 'drag cancellation must cancel the preview frame');
    assert.equal(lifecycle.timers.size, 0, 'drag cancellation must cancel the preview timer');
    assert.equal(lifecycle.isHighlighted(), true);

    console.log('calendar side native drag isolation tests passed');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
