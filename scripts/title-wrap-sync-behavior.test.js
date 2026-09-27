'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const start = source.indexOf('    function __tmCreateTitleWrapSyncQueue(');
const end = source.indexOf('    function __tmCleanupTitleWrapObservers(', start);
assert.ok(start >= 0 && end > start);

function harness(useRaf = true) {
    const frames = new Map();
    let next = 0;
    const schedule = (fn) => { frames.set(++next, fn); return next; };
    const context = vm.createContext({
        requestAnimationFrame: useRaf ? schedule : undefined,
        cancelAnimationFrame: (id) => frames.delete(id),
        setTimeout: schedule,
        clearTimeout: (id) => frames.delete(id),
    });
    vm.runInContext(source.slice(start, end), context);
    const root = { isConnected: true, contains: (row) => row.owner === root };
    const rows = Array.from({ length: 200 }, (_, id) => ({ id, owner: root, isConnected: true }));
    const batches = [];
    let disposed = 0;
    const queue = context.__tmCreateTitleWrapSyncQueue(root, (batch) => batches.push(Array.from(batch)), () => disposed++);
    const tick = () => {
        const scheduled = Array.from(frames.entries());
        for (const [id, fn] of scheduled) {
            if (frames.delete(id)) fn();
        }
    };
    const drain = () => {
        for (let i = 0; frames.size && i < 20; i++) tick();
        assert.equal(frames.size, 0, 'finite dirty rows must eventually settle');
    };
    return { root, rows, queue, frames, batches, tick, drain, disposed: () => disposed };
}

test('successive mutation microtasks cannot exhaust a large queue before paint', () => {
    const h = harness();
    h.queue.add(h.rows, true);
    assert.equal(h.batches.flat().length, 16);
    for (let i = 0; i < 20; i++) h.queue.add(h.rows.slice(16), true);
    assert.equal(h.batches.flat().length, 16, 'the immediate budget is shared for the frame');
    assert.equal(h.frames.size, 1);
    h.tick();
    assert.equal(h.batches.at(-1).length, 48);
    h.drain();
    assert.deepEqual(h.batches.flat().map((row) => row.id), h.rows.map((row) => row.id));
});

test('resize notifications deduplicate rows and wait for a frame', () => {
    const h = harness();
    h.queue.add([h.rows[4], h.rows[4]]);
    h.queue.add([h.rows[4], h.rows[7]]);
    assert.equal(h.batches.length, 0);
    h.drain();
    assert.deepEqual(h.batches.flat().map((row) => row.id), [4, 7]);
});

test('removed or transferred rows are discarded while live rows still settle', () => {
    const h = harness();
    h.queue.add(h.rows);
    h.rows[0].isConnected = false;
    h.rows[1].owner = {};
    h.drain();
    assert.equal(h.batches.flat().length, 198);
    assert.equal(h.batches.flat()[0].id, 2);
});

test('disposing a view cancels work and releases observers exactly once', () => {
    const h = harness();
    h.queue.add(h.rows);
    h.queue.dispose();
    h.queue.dispose();
    h.queue.add(h.rows, true);
    h.drain();
    assert.equal(h.batches.length, 0);
    assert.equal(h.disposed(), 1);
});

test('detaching a view before its next frame releases pending work', () => {
    const h = harness();
    h.queue.add(h.rows);
    h.root.isConnected = false;
    h.drain();
    assert.equal(h.batches.length, 0);
    assert.equal(h.disposed(), 1);
});

test('timer fallback keeps the same bounds without animation-frame support', () => {
    const h = harness(false);
    h.queue.add(h.rows, true);
    h.drain();
    assert.equal(h.batches.flat().length, 200);
    assert.ok(h.batches.every((batch) => batch.length <= 48));
});

function wrapMemoryHarness() {
    const context = vm.createContext({});
    const from = source.indexOf('    const __tmTaskTitleWrapCache =');
    assert.ok(from >= 0 && from < start);
    vm.runInContext(source.slice(from, start), context);
    const presentation = (surface, id, html) => context.__tmGetTaskTitleWrapPresentation(surface, id, html);
    const remember = (surface, id, html, wrapped) => {
        const key = presentation(surface, id, html).key;
        const owner = { getAttribute: () => id };
        context.__tmRememberTaskTitleWrap(surface, {
            closest: () => owner, getAttribute: () => key,
        }, wrapped);
    };
    return { presentation, remember };
}

test('replacement rows inherit measured wrapping through repeated status and drag renders', () => {
    const h = wrapMemoryHarness();
    const title = 'A long task <strong>title</strong> that wraps';
    for (const surface of ['checklist', 'kanban']) {
        assert.equal(h.presentation(surface, 'task-1', title).className, '');
        h.remember(surface, 'task-1', title, true);
        for (let render = 0; render < 20; render++) {
            assert.match(h.presentation(surface, 'task-1', title).className, /--title-wrapped$/);
        }
        assert.equal(h.presentation(surface, 'task-1', 'Renamed').className, '', 'a different title must be measured');
        h.remember(surface, 'task-1', title, false);
        assert.equal(h.presentation(surface, 'task-1', title).className, '', 'a real width change can remove wrapping');
    }
});

test('wrap memory is isolated by surface and bounded across document switches', () => {
    const h = wrapMemoryHarness();
    h.remember('kanban', 'first', 'Same title', true);
    assert.equal(h.presentation('checklist', 'first', 'Same title').className, '');
    for (let i = 0; i < 2048; i++) h.remember('kanban', `task-${i}`, 'Same title', true);
    assert.equal(h.presentation('kanban', 'first', 'Same title').className, '');
    assert.match(h.presentation('kanban', 'task-2047', 'Same title').className, /--title-wrapped$/);
});
