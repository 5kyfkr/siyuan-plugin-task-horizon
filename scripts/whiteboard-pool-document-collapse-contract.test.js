'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const stateSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const renderSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/44-render-whiteboard-body.js'), 'utf8');
const interactionSource = fs.readFileSync(path.join(root, 'src/task-horizon/main/render/49-render-whiteboard-interactions.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');

assert.match(stateSource, /whiteboardPoolCollapsedSectionKeys:\s*\[\]/, 'pool section collapse state must be session-local runtime state');
assert.match(
    renderSource,
    /const poolSourceDocIds = \(isGlobalBoardMode && globalCollectionDocId\)[\s\S]*?\[globalCollectionDocId\]\.concat\(poolSourceDocIds0\.filter/,
    'the global collection document must be promoted only for the global whiteboard pool'
);
assert.match(renderSource, /aria-expanded="\$\{collapsed \? 'false' : 'true'\}"/, 'document headers must expose their expanded state');
assert.match(renderSource, /onclick="tmWhiteboardTogglePoolSection\('\$\{escSq\(key\)\}', event\)"/, 'all pool section headers must use the shared collapse interaction');
assert.match(renderSource, /class="tm-whiteboard-pool-list"\$\{collapsed \? ' hidden' : ''\}/, 'collapsed documents must hide their task list');
assert.match(renderSource, /const sectionKey = `\$\{kind\}:\$\{key\}`;[\s\S]*?renderWhiteboardPoolSectionHead/, 'non-document group modes must receive stable namespaced collapse keys');
assert.match(renderSource, /const renderWhiteboardPoolGroupedSection[\s\S]*?class="tm-whiteboard-pool-list"\$\{collapsed \? ' hidden' : ''\}/, 'all non-document pool groups must hide their task list when collapsed');
assert.match(
    interactionSource,
    /window\.tmWhiteboardTogglePoolSection = function[\s\S]*?state\.whiteboardPoolCollapsedSectionKeys = Array\.from\(collapsedSectionKeys\)[\s\S]*?list\.hidden = collapsed/,
    'shared collapse interactions must update both session state and the current pool section'
);
assert.match(cssSource, /\.tm-whiteboard-pool-doc-head--toggle:focus-visible/, 'document header buttons must retain a visible keyboard focus state');
assert.match(cssSource, /\.tm-whiteboard-pool-list\[hidden\]/, 'hidden document task lists must leave the layout');
assert.match(cssSource, /\.tm-whiteboard-pool-item-title \.tm-global-collect-task-icon\s*\{[\s\S]*?vertical-align:\s*-2px/, 'collection task icons must align optically with pool task text');

const toggleStart = interactionSource.indexOf('window.tmWhiteboardTogglePoolSection = function');
const toggleEnd = interactionSource.indexOf('\n\n    function __tmBuildWhiteboardPointerInfoFromBody', toggleStart);
assert.ok(toggleStart >= 0 && toggleEnd > toggleStart, 'pool document toggle handler must be extractable');

class FakeClassList {
    constructor() {
        this.values = new Set();
    }

    toggle(name, force) {
        if (force) this.values.add(name);
        else this.values.delete(name);
    }

    contains(name) {
        return this.values.has(name);
    }
}

class FakeElement {
    constructor() {
        this.classList = new FakeClassList();
        this.style = {};
        this.hidden = false;
        this.attributes = {};
        this.title = '';
    }

    setAttribute(name, value) {
        this.attributes[name] = String(value);
    }
}

const section = new FakeElement();
const head = new FakeElement();
const list = new FakeElement();
const icon = new FakeElement();
head.closest = () => section;
head.querySelector = (selector) => selector === '.tm-whiteboard-pool-doc-chevron-icon' ? icon : null;
head.getAttribute = (name) => name === 'data-pool-section-label' ? '今天' : '';
section.querySelector = (selector) => selector === '.tm-whiteboard-pool-list' ? list : null;

const context = {
    state: { whiteboardPoolCollapsedSectionKeys: ['doc:inbox'] },
    render: () => { throw new Error('valid pool DOM must not trigger a full whiteboard render'); },
    HTMLElement: FakeElement,
    SVGElement: FakeElement,
    window: {},
};
vm.runInNewContext(interactionSource.slice(toggleStart, toggleEnd), context, { filename: 'whiteboard-pool-doc-toggle.js' });

const event = { currentTarget: head, preventDefault() {}, stopPropagation() {} };
assert.equal(context.window.tmWhiteboardTogglePoolSection('time:today', event), true);
assert.deepEqual(Array.from(context.state.whiteboardPoolCollapsedSectionKeys), ['doc:inbox', 'time:today']);
assert.equal(list.hidden, true);
assert.equal(head.attributes['aria-expanded'], 'false');
assert.equal(section.classList.contains('tm-whiteboard-pool-doc--collapsed'), true);
assert.equal(icon.style.transform, 'rotate(0deg)');

assert.equal(context.window.tmWhiteboardTogglePoolSection('time:today', event), true);
assert.deepEqual(Array.from(context.state.whiteboardPoolCollapsedSectionKeys), ['doc:inbox']);
assert.equal(list.hidden, false);
assert.equal(head.attributes['aria-expanded'], 'true');
assert.equal(section.classList.contains('tm-whiteboard-pool-doc--collapsed'), false);
assert.equal(icon.style.transform, 'rotate(90deg)');

console.log('whiteboard pool document collapse contract tests passed');
