'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const file = process.env.TM_THEME_TEST_SOURCE
    || path.join(__dirname, '../src/task-horizon/main/shell/80-shell-lifecycle.js');
const source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('        try {\n            if (__tmThemeModeObserver) {');
const end = source.indexOf('\n        try { __tmApplyAppearanceThemeVars(); } catch (e) {}', start);
assert.ok(start >= 0 && end > start, 'extract the production theme observer registration');

function harness() {
    const attrs = { class: 'neo-enabled neo-mode-light', 'data-theme-mode': 'light' };
    const frames = new Map(), listeners = new Map();
    let frameId = 0, renders = 0, applies = 0, clears = 0;
    const context = vm.createContext({
        state: { homepageOpen: true, modal: {} },
        document: {
            documentElement: { getAttribute: name => attrs[name] || '' },
            addEventListener: (type, callback) => listeners.set(type, callback),
            removeEventListener: () => {},
        },
        __tmThemeModeObserver: null, __tmThemeHeadObserver: null, __tmThemeModeRefreshRaf: null, __tmThemeStylesheetLoadHandler: null,
        __tmThemeAppearanceRefreshTimers: new Set(),
        MutationObserver: class {
            constructor(callback) { this.callback = callback; }
            observe() {}
            disconnect() {}
        },
        requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
        cancelAnimationFrame: id => frames.delete(id),
        __tmClearThemeColorRuntimeCaches: () => { clears += 1; },
        __tmApplyAppearanceThemeVars: () => { applies += 1; },
        render: () => {
            renders += 1;
            // Model a theme reacting to plugin rendering by rewriting its current HTML class value.
            context.__tmThemeModeObserver.callback([{ attributeName: 'class' }]);
        },
    });
    vm.runInContext(source.slice(start, end), context);
    return {
        attrs, frames,
        mutate: () => context.__tmThemeModeObserver.callback([{ attributeName: 'class' }]),
        load: target => listeners.get('load')({ target }),
        flush() {
            for (let pass = 0; frames.size && pass < 10; pass += 1) {
                const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback());
            }
            assert.equal(frames.size, 0, 'theme refresh must settle instead of rebuilding on every frame');
        },
        counts: () => ({ renders, applies, clears }),
    };
}

{
    const h = harness();
    for (let i = 0; i < 100; i += 1) { h.mutate(); h.flush(); }
    assert.deepEqual(h.counts(), { renders: 0, applies: 0, clears: 0 }, 'identical class writes do not rebuild');
    h.attrs.class = 'neo-mode-light  neo-enabled'; h.mutate(); h.flush();
    assert.equal(h.counts().renders, 0, 'class order and whitespace do not change the theme');
    h.attrs.class = 'neo-mode-light neo-enabled neo-palette-voyage'; h.mutate(); h.flush();
    assert.deepEqual(h.counts(), { renders: 1, applies: 1, clears: 1 }, 'a real palette change refreshes once');
    h.attrs['data-theme-mode'] = 'dark'; h.mutate(); h.mutate(); h.flush();
    assert.equal(h.counts().renders, 2, 'a real mode change refreshes once, including a same-class feedback write');
}
{
    const h = harness();
    h.attrs.class += ' transient'; h.mutate();
    h.attrs.class = 'neo-enabled neo-mode-light'; h.mutate(); h.flush();
    assert.equal(h.counts().renders, 0, 'a reverted change before the frame does not refresh');
    h.load({ tagName: 'LINK', id: 'themeStyle', href: '/appearance/themes/neo/theme.css' }); h.flush();
    assert.equal(h.counts().renders, 1, 'stylesheet reload refreshes even with identical attributes');
    h.attrs['data-dark-theme'] = 'new-theme'; h.mutate();
    h.load({ tagName: 'LINK', id: 'themeDefaultStyle' }); h.flush();
    assert.equal(h.counts().renders, 2, 'stylesheet and attribute notifications coalesce');
    h.load({ tagName: 'LINK', id: 'pluginStyle', href: '/plugins/test/style.css' }); h.flush();
    assert.equal(h.counts().renders, 2, 'unrelated stylesheet loads do not refresh');
}

console.log('theme appearance refresh behavior tests passed');
