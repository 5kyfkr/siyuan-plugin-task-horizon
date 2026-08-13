'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const runtimeSource = read('src', 'task-horizon', 'main', 'task-runtime', '51-whiteboard-and-link-runtime.js');
const bodySource = read('src', 'task-horizon', 'main', 'render', '44-render-whiteboard-body.js');
const interactionSource = read('src', 'task-horizon', 'main', 'render', '49-render-whiteboard-interactions.js');
const cssSource = read('task-horizon.css');

const proxyStart = runtimeSource.indexOf('function __tmFindWhiteboardCollapsedProxyTaskId');
const proxyEnd = runtimeSource.indexOf('function __tmGetWhiteboardAllTabsLayoutMode', proxyStart);
assert.ok(proxyStart >= 0 && proxyEnd > proxyStart, 'collapsed proxy resolver must be extractable');

const tasks = new Map([
    ['child', { id: 'child', parentTaskId: 'parent', docId: 'doc-a' }],
    ['parent', { id: 'parent', parentTaskId: '', docId: 'doc-a' }],
]);
const proxyContext = {
    __tmKanbanGetCollapsedSet: () => new Set(['parent']),
    __tmIsWhiteboardChildDetached: () => false,
    __tmGetTaskDocIdById: (id) => tasks.get(id)?.docId || '',
    __tmGetWhiteboardCardSnapshot: () => null,
    globalThis: {
        __tmTaskBoundary: { getTask: (id) => tasks.get(id) || null },
    },
};
vm.runInNewContext(
    `${runtimeSource.slice(proxyStart, proxyEnd)}\nthis.resolveProxy = __tmFindWhiteboardCollapsedProxyTaskId;`,
    proxyContext,
    { filename: 'whiteboard-collapsed-proxy.js' },
);
assert.equal(
    proxyContext.resolveProxy('child', 'doc-a'),
    'parent',
    'collapsed children must resolve to their parent without consulting the local-board placed map',
);

assert.match(
    interactionSource,
    /const hasRenderedEndpoint[\s\S]*resolveCollapsedProxyTaskId\(id, endpointDocId\)[\s\S]*visibleTaskIds\.has\(proxyTaskId\)/,
    'global edge filtering must retain hidden endpoints that have a visible collapsed proxy',
);
assert.match(
    interactionSource,
    /const fromProxyDocId = resolveEndpointDocId\(link, 'from'\);[\s\S]*const from = getPt\(link\.from, 'from', fromProxy, link\.fromAnchor\)/,
    'edge endpoints must resolve the real document and collapsed proxy before reading coordinates',
);
assert.match(
    interactionSource,
    /taskId0 && proxyId && taskId0 !== proxyId && rectByTaskId\.has\(proxyId\)[\s\S]*return \(laneIndex \+ 1\) \* 12/,
    'links projected through the bottom aggregation point must claim a distinct outer routing lane',
);
assert.match(
    bodySource,
    /linkedDescendantParentInIdSet[\s\S]*linkedDescendantParentOutIdSet[\s\S]*tm-whiteboard-collapse-proxy-dot--in[\s\S]*tm-whiteboard-collapse-proxy-dot--out/,
    'collapsed cards must expose separate incoming and outgoing descendant aggregation points',
);
assert.match(
    interactionSource,
    /kind === 'from'[\s\S]*tm-whiteboard-collapse-proxy-dot--out[\s\S]*tm-whiteboard-collapse-proxy-dot--in/,
    'collapsed endpoints must resolve to the direction-specific aggregation point',
);
assert.match(
    bodySource,
    /const verticalLinkDots = depth === 0[\s\S]*tm-task-link-dot--top[\s\S]*tm-task-link-dot--bottom/,
    'only root-level parent and standalone cards may render the new vertical link points',
);
assert.match(
    interactionSource,
    /fromAnchor,[\s\S]*toAnchor,/,
    'new links must persist their physical endpoint anchors',
);
assert.match(
    cssSource,
    /\.tm-whiteboard-collapse-proxy-dot \{[\s\S]*top:\s*calc\(50% \+ 20px\)[\s\S]*\.tm-whiteboard-node > \.tm-whiteboard-collapse-proxy-dot--in \{[\s\S]*left:\s*-1px[\s\S]*\.tm-whiteboard-node > \.tm-whiteboard-collapse-proxy-dot--out \{[\s\S]*left:\s*calc\(100% \+ 1px\)/,
    'collapsed aggregation points must sit below the standard points on the left and right vertical edges',
);
assert.match(
    cssSource,
    /\.tm-whiteboard-node > \.tm-whiteboard-collapse-proxy-dot\.tm-whiteboard-collapse-proxy-dot--has-links \{[\s\S]*opacity:\s*1/,
    'an aggregation point with projected child links must remain visible',
);
assert.doesNotMatch(
    cssSource,
    /\.tm-whiteboard-node\.tm-whiteboard-node--has-links > \.tm-task-link-dot/,
    'an unrelated anchor must not stay visible merely because the card owns another link',
);
assert.match(
    bodySource,
    /linkedTaskAnchorMap[\s\S]*linkDotActiveClass[\s\S]*tm-task-link-dot--linked/,
    'only the physical anchors used by a link may stay visible',
);

console.log('whiteboard collapsed subtask link proxy contract tests passed');
