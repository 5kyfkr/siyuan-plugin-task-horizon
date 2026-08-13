'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const detailSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/task-runtime/52-task-detail-runtime.js'),
    'utf8',
);
const attachmentSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'),
    'utf8',
);

const extractFunction = (name, nextName) => {
    const start = detailSource.indexOf(`function ${name}(`);
    const end = detailSource.indexOf(`\n\n    function ${nextName}(`, start);
    assert.ok(start >= 0 && end > start, `${name} must remain extractable`);
    return detailSource.slice(start, end);
};

const readPathsSource = extractFunction(
    '__tmReadTaskDetailAttachmentPathsFromSection',
    '__tmResolveTaskDetailAttachmentActionIndex',
);
const resolveIndexSource = extractFunction(
    '__tmResolveTaskDetailAttachmentActionIndex',
    '__tmBindTaskDetailEditor',
);

class Element {
    constructor(attributes = {}, parent = null) {
        this.attributes = { ...attributes };
        this.parent = parent;
    }

    getAttribute(name) {
        return Object.prototype.hasOwnProperty.call(this.attributes, name)
            ? this.attributes[name]
            : null;
    }

    closest(selector) {
        assert.equal(selector, '[data-tm-detail-attachment-context]');
        if (this.getAttribute('data-tm-detail-attachment-context')) return this;
        return this.parent?.closest(selector) || null;
    }
}

class SectionElement extends Element {
    constructor(paths) {
        super();
        this.items = paths.map((attachmentPath) => new Element({
            'data-tm-detail-attachment-context': attachmentPath,
        }));
    }

    querySelectorAll(selector) {
        assert.equal(selector, '[data-tm-detail-attachment-context]');
        return this.items;
    }
}

const normalizePath = (value) => String(value || '').trim();
const normalizePaths = (values) => Array.from(new Set(
    (Array.isArray(values) ? values : []).map(normalizePath).filter(Boolean),
));
const context = {
    Element,
    Array,
    Number,
    Set,
    __tmNormalizeTaskAttachmentPath: normalizePath,
    __tmNormalizeTaskAttachmentPaths: normalizePaths,
};
context.globalThis = context;
vm.runInNewContext(`${readPathsSource}\n${resolveIndexSource}`, context);

const readPaths = context.__tmReadTaskDetailAttachmentPathsFromSection;
const resolveIndex = context.__tmResolveTaskDetailAttachmentActionIndex;
const attachmentAction = (attachmentPath, indexValue) => {
    const card = new Element({ 'data-tm-detail-attachment-context': attachmentPath });
    return new Element({ 'data-index': String(indexValue) }, card);
};
assert.deepEqual(
    Array.from(readPaths(new SectionElement(['assets/a.png', 'assets/b.pdf', 'assets/c.txt']))),
    ['assets/a.png', 'assets/b.pdf', 'assets/c.txt'],
    'attachment actions must read the complete currently displayed order',
);

let displayedPaths = ['assets/a.png', 'assets/b.pdf', 'assets/c.txt'];
let index = resolveIndex(attachmentAction('assets/a.png', 0), displayedPaths);
assert.equal(index, 0);
displayedPaths.splice(index, 1);
index = resolveIndex(attachmentAction('assets/c.txt', 0), displayedPaths);
assert.equal(index, 1, 'the stable path must win over a stale index after the first removal');
displayedPaths.splice(index, 1);
assert.deepEqual(displayedPaths, ['assets/b.pdf'], 'successive removals must target the requested attachments');

assert.equal(resolveIndex(new Element({ 'data-index': '0' }), displayedPaths), 0, 'legacy index-only actions must still work');
assert.equal(resolveIndex(new Element(), displayedPaths), -1, 'missing attachment identity must never fall back to the first item');
assert.equal(
    resolveIndex(attachmentAction('assets/stale.pdf', 0), displayedPaths),
    -1,
    'a stale card path must never fall back to an index that could remove another attachment',
);

const attachmentBuilderStart = attachmentSource.indexOf('function __tmBuildTaskDetailAttachmentSectionHtml(');
const attachmentBuilderEnd = attachmentSource.indexOf('\n\n    function __tmGetWhiteboardStickyThemes', attachmentBuilderStart);
const attachmentBuilder = attachmentSource.slice(attachmentBuilderStart, attachmentBuilderEnd);
assert.match(
    attachmentBuilder,
    /data-tm-detail-attachment-context="\$\{esc\(entry\.path\)\}"/,
    'each attachment card must carry the stable attachment path',
);
assert.doesNotMatch(
    attachmentBuilder,
    /data-tm-detail-attachment-path=/,
    'attachment action buttons must not duplicate the card path',
);
assert.ok(
    detailSource.includes('const currentPaths = getCurrentAttachmentPaths(task);')
        && detailSource.includes('__tmResolveTaskDetailAttachmentActionIndex(target, currentPaths)'),
    'detail actions must calculate from the displayed snapshot and resolve identity by card path',
);
assert.equal(
    (detailSource.match(/const latestPaths = getCurrentAttachmentPaths\(task\);/g) || []).length,
    2,
    'paste and drop must use the same displayed attachment snapshot as click actions',
);
assert.match(
    detailSource,
    /galleryPaths: getCurrentAttachmentPaths\(task\)/,
    'the attachment viewer must use the same displayed order as the detail section',
);

console.log('task detail attachment action contract tests passed');
