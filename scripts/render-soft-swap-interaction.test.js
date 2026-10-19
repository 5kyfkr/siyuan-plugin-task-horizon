'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/task-horizon/main/40-render-runtime.js'), 'utf8');
const wrapperEnd = source.indexOf('    function __tmRenderNow(');
assert.ok(wrapperEnd > 0);

function modal(inlineStyle = null, connected = true) {
    return {
        inlineStyle, isConnected: connected, style: { pointerEvents: '', opacity: '' },
        getAttribute() { return this.inlineStyle; },
        setAttribute(name, value) { this.inlineStyle = value; this.style = { pointerEvents: '', opacity: '' }; },
        removeAttribute() { this.inlineStyle = null; this.style = { pointerEvents: '', opacity: '' }; },
        remove() { this.isConnected = false; },
    };
}

function harness(run, previous = modal('height:100%;position:relative')) {
    const state = { modal: previous };
    const frames = [], timers = [];
    const context = vm.createContext({
        state,
        requestAnimationFrame(fn) { frames.push(fn); },
        setTimeout(fn) { timers.push(fn); },
        __tmRenderNow(cleanup) { return run(cleanup, state, context); },
    });
    vm.runInContext(source.slice(0, wrapperEnd), context);
    return { context, state, previous, frames, timers };
}

// Use production registration so the wrapper and the render handoff stay linked.
const registrationStart = source.indexOf('                renderCleanup.softSwap = {');
const registrationEnd = source.indexOf('                if (useOverlaySoftSwap)', registrationStart);
assert.ok(registrationStart >= 0 && registrationEnd > registrationStart);
const register = new vm.Script(`((renderCleanup, prevModalSnapshot) => {
    ${source.slice(registrationStart, registrationEnd)}
    prevModalSnapshot.setAttribute('style', 'position:absolute;inset:0;pointer-events:none');
})`);
function begin(cleanup, state, context) {
    register.runInContext(context)(cleanup, state.modal);
}
function attach(cleanup, state, connected = true) {
    const next = modal(null, connected);
    state.modal = next;
    cleanup.softSwap.nextModal = next;
    next.style.pointerEvents = 'none';
    return next;
}

{
    const h = harness((cleanup, state, context) => {
        begin(cleanup, state, context);
        return attach(cleanup, state);
    });
    const next = h.context.render();
    assert.equal(next.style.pointerEvents, '', 'the committed shell must accept input before any animation frame');
    assert.equal(next.style.opacity, '1');
    assert.equal(h.previous.isConnected, true, 'retain the outgoing shell during its visual transition');
    h.timers.forEach(fn => fn());
    assert.equal(h.previous.isConnected, false);
    assert.equal(next.isConnected, true);
}

for (const phase of ['before-create', 'before-mount', 'after-mount']) {
    const failure = new Error(phase);
    const h = harness((cleanup, state, context) => {
        begin(cleanup, state, context);
        if (phase !== 'before-create') attach(cleanup, state, phase === 'after-mount');
        throw failure;
    });
    assert.throws(() => h.context.render(), error => error === failure, 'preserve the original render error');
    assert.equal(h.state.__tmRenderInFlight, false);
    if (phase === 'after-mount') {
        assert.notEqual(h.state.modal, h.previous);
        assert.equal(h.state.modal.style.pointerEvents, '', 'a mounted shell must recover input on a later render failure');
        h.timers.forEach(fn => fn());
        assert.equal(h.previous.isConnected, false);
    } else {
        assert.equal(h.state.modal, h.previous, 'an uncommitted replacement must not become the active shell');
        assert.equal(h.previous.inlineStyle, 'height:100%;position:relative', 'rollback must remove the temporary overlay geometry');
        assert.equal(h.previous.style.pointerEvents, '');
        assert.equal(h.previous.isConnected, true);
    }
}

{
    const h = harness((cleanup, state, context) => {
        begin(cleanup, state, context);
        throw new Error('before-create');
    }, modal());
    assert.throws(() => h.context.render());
    assert.equal(h.previous.inlineStyle, null, 'a shell without inline styles must not retain temporary styles');
}

{
    let firstSwap;
    const h = harness((cleanup, state, context) => {
        begin(cleanup, state, context);
        firstSwap = cleanup.softSwap;
        attach(cleanup, state);
    });
    h.context.render();
    const later = modal();
    later.style.pointerEvents = 'none';
    h.state.modal = later;
    h.context.__tmFinishRenderSoftSwap(firstSwap);
    assert.equal(later.style.pointerEvents, 'none', 'an obsolete render must not unlock a later shell');
    h.state.modal = h.previous;
    h.timers.forEach(fn => fn());
    assert.equal(h.previous.isConnected, true, 'delayed retirement must not remove a shell restored as active');
}

{
    const h = harness((cleanup, state) => { state.modal.style.pointerEvents = 'none'; });
    h.context.render();
    assert.equal(h.state.modal.style.pointerEvents, 'none', 'ordinary renders must not override unrelated input restrictions');
}

{
    let renders = 0;
    const h = harness((cleanup, state, context) => {
        renders++;
        begin(cleanup, state, context);
        attach(cleanup, state);
        if (renders === 1) context.render();
    });
    h.context.render();
    assert.equal(renders, 1, 'nested render requests must remain queued');
    assert.equal(h.state.modal.style.pointerEvents, '', 'recover input before running the queued render');
    h.frames.shift()();
    assert.equal(renders, 2);
    assert.equal(h.state.modal.style.pointerEvents, '');
}

console.log('render soft-swap interaction tests passed');
