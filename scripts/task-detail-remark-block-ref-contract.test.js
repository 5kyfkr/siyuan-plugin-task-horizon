'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const serviceSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'),
    'utf8',
).replace(/\r\n/g, '\n');
const detailSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/task-runtime/52-task-detail-runtime.js'),
    'utf8',
).replace(/\r\n/g, '\n');

const start = serviceSource.indexOf('const __tmRemarkRenderCache = new Map();');
const end = serviceSource.indexOf('\n\n    function __tmStripRemarkMarkdown(', start);
assert.ok(start >= 0 && end > start, 'remark block reference renderer must remain extractable');

const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const doc = (children) => ({ Type: 'NodeDocument', Children: children });
const paragraph = (children) => ({ Type: 'NodeParagraph', Children: children });
const text = (Data) => ({ Type: 'NodeText', Data });
const codeSpan = (Data) => ({
    Type: 'NodeCodeSpan',
    Children: [{ Type: 'NodeOpenBacktick' }, { Type: 'NodeCodeSpanContent', Data }, { Type: 'NodeCloseBacktick' }],
});
const blockRef = (id, label = '', dynamic = false) => ({
    Type: 'NodeBlockRef',
    Children: [
        { Type: 'NodeOpenParen' },
        { Type: 'NodeOpenParen' },
        { Type: 'NodeBlockRefID', Data: id },
        ...(label
            ? [{ Type: 'NodeBlockRefSpace' }, { Type: dynamic ? 'NodeBlockRefDynamicText' : 'NodeBlockRefText', Data: label }]
            : []),
        { Type: 'NodeCloseParen' },
        { Type: 'NodeCloseParen' },
    ],
});
const link = (label, dest) => ({
    Type: 'NodeLink',
    Children: [
        { Type: 'NodeOpenBracket' },
        { Type: 'NodeLinkText', Data: label },
        { Type: 'NodeCloseBracket' },
        { Type: 'NodeOpenParen' },
        { Type: 'NodeLinkDest', Data: dest },
        { Type: 'NodeCloseParen' },
    ],
});

const BLOCK_ID = '20240101120000-abcdefg';
const trees = new Map([
    [`((${BLOCK_ID} "引用文字"))`, doc([paragraph([blockRef(BLOCK_ID, '引用文字')])])],
    [`((${BLOCK_ID}))`, doc([paragraph([blockRef(BLOCK_ID)])])],
    [`[块标题](siyuan://blocks/${BLOCK_ID})`, doc([paragraph([text('tm-inline '), link('块标题', `siyuan://blocks/${BLOCK_ID}`)])])],
    ['[官网](https://example.com/docs)', doc([paragraph([text('tm-inline '), link('官网', 'https://example.com/docs')])])],
    ['[坏链接](javascript:alert(1))', doc([paragraph([text('tm-inline '), link('坏链接', 'javascript:alert(1)')])])],
    [`见 ${BLOCK_ID} 结束`, doc([paragraph([text(`tm-inline 见 ${BLOCK_ID} 结束`)])])],
    [`siyuan://blocks/${BLOCK_ID}`, doc([paragraph([text(`tm-inline siyuan://blocks/${BLOCK_ID}`)])])],
    [`\`${BLOCK_ID}\``, doc([paragraph([text('tm-inline '), codeSpan(BLOCK_ID)])])],
    [`[看${BLOCK_ID}](https://example.com)`, doc([paragraph([text('tm-inline '), link(`看${BLOCK_ID}`, 'https://example.com')])])],
]);

const Lute = {
    New: () => ({
        RenderJSON: (source) => {
            const input = source.startsWith('tm-inline ') ? source.slice('tm-inline '.length) : source;
            return JSON.stringify(trees.get(input) || doc([paragraph([text(input)])]));
        },
    }),
};
const context = {
    esc,
    JSON,
    RegExp,
    String,
    Lute,
};
context.globalThis = context;
vm.runInNewContext(serviceSource.slice(start, end), context);

const renderInline = context.__tmRenderRemarkInlineHtml;
const sanitizeHref = context.__tmSanitizeRemarkHref;

const hasBlockRef = (html, blockId) => html.includes(`data-tm-remark-block-id="${blockId}"`);

assert.equal(
    sanitizeHref(`siyuan://blocks/${BLOCK_ID}`),
    `siyuan://blocks/${BLOCK_ID}`,
    'block links must survive remark href sanitizing',
);
assert.equal(sanitizeHref('https://example.com/a'), 'https://example.com/a');
assert.equal(sanitizeHref('javascript:alert(1)'), '', 'script urls must stay blocked');
assert.equal(sanitizeHref('siyuan://plugins/siyuan-plugin-task-horizon'), '', 'only block links are allowed to jump');

const quotedRef = renderInline(`((${BLOCK_ID} "引用文字"))`);
assert.ok(hasBlockRef(quotedRef, BLOCK_ID), '((块 ID "文本")) must render a clickable block reference');
assert.match(quotedRef, />引用文字<\/a>/, 'the quoted anchor text must stay visible');
assert.doesNotMatch(quotedRef, /href="siyuan:/, 'block references must not navigate through the raw siyuan url');

const plainRef = renderInline(`((${BLOCK_ID}))`);
assert.ok(hasBlockRef(plainRef, BLOCK_ID), 'a block reference without anchor text must still be clickable');
assert.ok(plainRef.includes(`>${BLOCK_ID}</a>`), 'a block reference without anchor text falls back to the block id');

const markdownBlockLink = renderInline(`[块标题](siyuan://blocks/${BLOCK_ID})`);
assert.ok(hasBlockRef(markdownBlockLink, BLOCK_ID), 'markdown links to a block must render as block references');
assert.match(markdownBlockLink, />块标题<\/a>/);

const externalLink = renderInline('[官网](https://example.com/docs)');
assert.match(externalLink, /href="https:\/\/example\.com\/docs"/, 'normal links keep their href');
assert.doesNotMatch(externalLink, /data-tm-remark-block-id/, 'normal links must not become block references');

const unsafeLink = renderInline('[坏链接](javascript:alert(1))');
assert.ok(unsafeLink.includes('坏链接'), 'unsafe links keep their label text');
assert.doesNotMatch(unsafeLink, /javascript:/, 'unsafe link destinations must be dropped');

const bareId = renderInline(`见 ${BLOCK_ID} 结束`);
assert.ok(hasBlockRef(bareId, BLOCK_ID), 'bare block ids must become clickable block references');
assert.match(bareId, /^见 <a /, 'text before a bare block id must be preserved');
assert.match(bareId, /结束$/, 'text after a bare block id must be preserved');

const bareBlockUrl = renderInline(`siyuan://blocks/${BLOCK_ID}`);
assert.ok(hasBlockRef(bareBlockUrl, BLOCK_ID), 'a plain block url must become a clickable block reference');
assert.ok(!bareBlockUrl.includes('siyuan://blocks/'), 'the raw block url must not be left next to the reference');

const inlineCode = renderInline(`\`${BLOCK_ID}\``);
assert.doesNotMatch(inlineCode, /data-tm-remark-block-id/, 'block ids inside code spans must stay plain text');
assert.match(inlineCode, new RegExp(`<code>${BLOCK_ID}</code>`));

const linkLabelWithId = renderInline(`[看${BLOCK_ID}](https://example.com)`);
assert.doesNotMatch(linkLabelWithId, /data-tm-remark-block-id/, 'link labels must not nest block references');
assert.match(linkLabelWithId, new RegExp(`看${BLOCK_ID}`));

const plainText = renderInline(`((${BLOCK_ID} "引用文字"))`, true);
assert.equal(plainText, '引用文字', 'plain text mode must strip block reference markup');
assert.equal(renderInline(`见 ${BLOCK_ID}`, true), `见 ${BLOCK_ID}`, 'plain text mode must keep bare ids readable');

const renderMarkdown = context.__tmRenderRemarkMarkdown;
assert.equal(
    renderMarkdown(''),
    '<div class="tm-task-detail-remark-empty">点击添加备注</div>',
    'an empty remark keeps the existing placeholder',
);

const refSource = `参考 ((${BLOCK_ID} "引用文字")) 和 ${BLOCK_ID}`;
const plainMarkdown = renderMarkdown(refSource);
assert.doesNotMatch(
    plainMarkdown,
    /data-tm-remark-block-id/,
    'remark rendering outside the task detail must stay plain text, for example whiteboard stickies',
);
assert.match(plainMarkdown, /引用文字/, 'plain rendering keeps the block reference anchor text');

const interactiveMarkdown = renderMarkdown(refSource, { blockRefs: true });
assert.equal(
    (interactiveMarkdown.match(/data-tm-remark-block-id/g) || []).length,
    2,
    'task detail remarks render both the reference and the bare id as clickable blocks',
);

// 缓存必须按渲染模式区分，否则先渲染纯文本后详情会失去块引用。
assert.equal(renderMarkdown(refSource), plainMarkdown, 'the plain rendering is cached per mode');
assert.equal(
    (renderMarkdown(refSource, { blockRefs: true }).match(/data-tm-remark-block-id/g) || []).length,
    2,
    'the interactive rendering must not be served from the plain cache entry',
);

assert.match(
    serviceSource,
    /\['SetBlockRef', true\]/,
    'remark parsing must enable block references so ((id)) is not plain text',
);
assert.match(
    detailSource,
    /data-tm-remark-block-id/,
    'the task detail must resolve remark block references on click',
);
assert.match(
    detailSource,
    /const jumpToRemarkBlockRef = async \(blockRef, ev\) => \{/,
    'remark block references must resolve the target block through a dedicated jump helper',
);
assert.match(
    detailSource,
    /await __tmOpenTaskAttachmentBlockRef\(blockId, ev\)/,
    'remark block references must reuse the native block jump helper',
);
assert.match(
    detailSource,
    /__tmRenderRemarkMarkdown\([^)]*\{ blockRefs: true \}\)/,
    'task detail remark previews must opt into interactive block references',
);
const whiteboardSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/render/44-render-whiteboard-body.js'),
    'utf8',
).replace(/\r\n/g, '\n');
assert.doesNotMatch(
    whiteboardSource,
    /blockRefs/,
    'whiteboard sticky notes must keep the plain remark rendering',
);

console.log('task detail remark block reference contract tests passed');
