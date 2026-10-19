'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const file = process.env.TM_RESIZE_TEST_SOURCE
    || path.join(__dirname, '../src/task-horizon/main/20-api-and-runtime-services.js');
const source = fs.readFileSync(file, 'utf8');
const from = source.indexOf('    function __tmBindResponsiveTableResize(');
const to = source.indexOf('    function __tmOnFloatingTooltipWindowResize(', from);
assert.ok(from >= 0 && to > from);

function harness(options = {}) {
    class Element {
        constructor(width = 1000) { this.clientWidth = width; this.isConnected = true; }
        querySelector() { return this.body; }
    }
    const frames = new Map(), observers = [];
    let seq = 0, renders = 0;
    const modal = new Element(); modal.body = new Element();
    const state = { modal, viewMode: 'list', homepageOpen: false, attachmentLibraryOpen: false, ...options };
    const settings = { kanbanFillColumns: true };
    const context = vm.createContext({
        state, Element, HTMLElement: Element, SettingsStore: { data: settings },
        document: { body: { contains: el => el.isConnected } },
        __tmIsWhiteboardAllTabsStreamMode: () => options.stream !== false,
        ResizeObserver: class {
            constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
            observe(body) { this.body = body; }
            disconnect() { this.disconnected = true; }
        },
        requestAnimationFrame: callback => { frames.set(++seq, callback); return seq; },
        cancelAnimationFrame: id => frames.delete(id),
        render: () => { renders += 1; },
    });
    vm.runInContext(source.slice(from, to), context);
    return {
        state, modal, observers, frames, settings,
        bind: () => context.__tmBindResponsiveTableResize(state.modal),
        resize(width) { modal.body.clientWidth = width; observers.at(-1)?.callback(); },
        flush() { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); },
        renders: () => renders,
    };
}

for (const viewMode of ['list', 'calendar', 'whiteboard']) {
    for (const flag of ['homepageOpen', 'attachmentLibraryOpen']) {
        const h = harness({ viewMode, [flag]: true }); h.bind();
        assert.equal(h.observers.length, 0, `${flag} must not inherit the ${viewMode} table resize observer`);
    }
    const h = harness({ viewMode }); h.bind();
    assert.equal(h.observers.length, 1, `${viewMode} tables still observe their width`);
    h.resize(1001); h.flush(); assert.equal(h.renders(), 0, 'ignore sub-threshold changes');
    h.resize(980); h.resize(960); h.flush();
    assert.equal(h.renders(), 1, 'coalesce real width changes into one responsive render');
}

for (const flag of ['homepageOpen', 'attachmentLibraryOpen']) {
    const h = harness(); h.bind(); const old = h.observers[0];
    h.resize(980); assert.equal(h.frames.size, 1);
    h.state[flag] = true; h.flush();
    assert.equal(h.renders(), 0, 'an already queued resize cannot replace an overlay page');
    h.bind(); assert.equal(old.disconnected, true, 'switching to the overlay disconnects the table observer');
    h.resize(940); h.flush(); assert.equal(h.renders(), 0, 'ignore a late observer delivery');
}

{
    const h = harness(); h.bind(); const old = h.observers[0];
    h.bind(); h.modal.body.clientWidth = 970; old.callback(); h.flush();
    assert.equal(h.renders(), 0, 'a superseded observer cannot render the current shell');
    h.resize(960); h.modal.isConnected = false; h.flush();
    assert.equal(h.renders(), 0, 'a detached shell cannot trigger a responsive render');
}
{
    const h = harness(); h.bind(); h.resize(970);
    h.state.modal = {}; h.flush();
    assert.equal(h.renders(), 0, 'queued work belongs to its original shell');
}
{
    const h = harness(); h.bind(); h.resize(970);
    h.state.viewMode = 'calendar'; h.flush();
    assert.equal(h.renders(), 0, 'queued work belongs to its original view');
}
{
    const h = harness(); h.settings.kanbanFillColumns = false; h.bind();
    assert.equal(h.observers.length, 0, 'fixed column tables do not need width rerenders');
}
{
    const h = harness({ viewMode: 'whiteboard', stream: false }); h.bind();
    assert.equal(h.observers.length, 0, 'canvas whiteboards do not use the table width observer');
}

console.log('table responsive resize behavior tests passed');
