'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const quickbarSource = fs.readFileSync(path.join(root, 'quickbar.js'), 'utf8');

function sliceSource(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    assert.ok(start >= 0, `missing source marker: ${startMarker}`);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.ok(end > start, `missing source marker: ${endMarker}`);
    return source.slice(start, end);
}

class FakeElement {
    constructor(options = {}) {
        this.dataset = options.dataset || {};
        this.queryEmbed = options.queryEmbed || null;
        this.protyle = options.protyle || null;
        this.sourceTaskId = options.sourceTaskId || '';
    }

    closest(selector) {
        if (selector === '[data-type="NodeBlockQueryEmbed"]') return this.queryEmbed;
        if (selector === '.protyle') return this.protyle;
        return null;
    }

    getAttribute(name) {
        return name === 'data-node-id' ? this.dataset.nodeId || '' : '';
    }
}

const renderKeySource = sliceSource(
    quickbarSource,
    'function getInlineMetaQueryEmbedEl',
    'function hasInlineMetaPropsCacheForBlock'
);
const renderKeyRuntime = new Function('Element', 'resolveTaskBindingFromBlockEl', `
    const inlineMetaProtyleTokens = new WeakMap();
    const inlineMetaQueryEmbedTokens = new WeakMap();
    let inlineMetaInstanceTokenSeq = 0;
    ${renderKeySource}
    return { getInlineMetaRenderKey, isInlineMetaEmbedRenderKey };
`)(FakeElement, (blockEl) => ({ taskId: blockEl.sourceTaskId }));

const normalBlock = new FakeElement();
assert.equal(renderKeyRuntime.getInlineMetaRenderKey(normalBlock, 'task-a'), 'task-a', 'ordinary task keys must stay unchanged');

const protyleA = new FakeElement();
const protyleB = new FakeElement();
const queryA = new FakeElement({ dataset: { nodeId: 'query-a' } });
const queryB = new FakeElement({ dataset: { nodeId: 'query-b' } });
const embedA1 = new FakeElement({ queryEmbed: queryA, protyle: protyleA, sourceTaskId: 'task-a' });
const embedA2 = new FakeElement({ queryEmbed: queryA, protyle: protyleA, sourceTaskId: 'task-a' });
const embedB = new FakeElement({ queryEmbed: queryB, protyle: protyleA, sourceTaskId: 'task-a' });
const embedOtherTab = new FakeElement({ queryEmbed: queryA, protyle: protyleB, sourceTaskId: 'task-a' });

const keyA1 = renderKeyRuntime.getInlineMetaRenderKey(embedA1, 'legacy-host');
assert.equal(renderKeyRuntime.getInlineMetaRenderKey(embedA2, 'legacy-host'), keyA1, 'the same query instance must have a stable key');
assert.notEqual(renderKeyRuntime.getInlineMetaRenderKey(embedB, 'legacy-host'), keyA1, 'two query blocks must not share visual state');
assert.notEqual(renderKeyRuntime.getInlineMetaRenderKey(embedOtherTab, 'legacy-host'), keyA1, 'two protyle instances must not share visual state');
assert.equal(renderKeyRuntime.isInlineMetaEmbedRenderKey(keyA1), true);

const queryWithoutId = new FakeElement();
const embedWithoutQueryId = new FakeElement({ queryEmbed: queryWithoutId, protyle: protyleA, sourceTaskId: 'task-a' });
assert.equal(
    renderKeyRuntime.getInlineMetaRenderKey(embedWithoutQueryId, 'legacy-host'),
    renderKeyRuntime.getInlineMetaRenderKey(embedWithoutQueryId, 'legacy-host'),
    'a query element without an ID must keep a stable WeakMap token'
);

const removeByRenderKeySource = sliceSource(
    quickbarSource,
    'function removeInlineMetaHostByRenderKey',
    'function removeInlineMetaHostByTaskId'
);
const hosts = [
    { dataset: { inlineRenderKey: keyA1, inlinePlacement: 'in-block' } },
    { dataset: { inlineRenderKey: 'embed|other', inlinePlacement: 'in-block' } },
    { dataset: { inlineRenderKey: keyA1, inlinePlacement: 'overlay' } },
];
const removedHosts = [];
const removeByRenderKey = new Function('document', 'removeInlineMetaHostNode', 'invalidateInlineMetaActiveTargetsCache', `
    const inlineMetaMissingHostSeenAt = new Map();
    const inlineMetaLayoutCache = new Map();
    ${removeByRenderKeySource}
    return removeInlineMetaHostByRenderKey;
`)(
    { querySelectorAll: () => hosts },
    (host) => { removedHosts.push(host); return true; },
    () => {},
);
assert.equal(removeByRenderKey(keyA1, 'in-block'), 1, 'instance cleanup must honor placement');
assert.deepEqual(removedHosts, [hosts[0]], 'instance cleanup must not remove another embed or placement');

const renderSource = sliceSource(quickbarSource, 'async function renderInlineMetaForBlock', 'function scheduleInlineMetaRender');
assert.match(renderSource, /if \(isEmbedded\)[\s\S]*ensureInlineMetaEmbedContext\([\s\S]*attrHostId: String\(attrContext\.primaryHostId[\s\S]*attrHostState: String\(attrContext\.state[\s\S]*attrHostMigrationSourceId: String\(attrContext\.mirrorHostIds\?\.\[0\]/, 'embedded rendering must use the authoritative attr context');
assert.match(renderSource, /const docId = isEmbedded \? String\(embedContext\?\.sourceDocId[\s\S]*isInlineMetaScopeAllowedForDocCached\(docId\)/, 'embedded rendering must use source document scope');
assert.match(renderSource, /ensureInlineHost\(blockEl, \{ preferOverlay: useOverlayHost, blockId: taskId, renderKey \}\)[\s\S]*host\.__tmQuickbarInlineBinding = isEmbedded \? binding : null[\s\S]*layoutInlineMetaHost\(blockEl, host, renderKey/, 'embedded host creation, interaction, and layout must retain the instance binding and key');
assert.match(renderSource, /removeInlineMetaHostsBySourceTaskId\(sourceTaskIdForRender, attrHostIdForRender, '', isEmbedded \? renderKey : ''\)/, 'source-host dedupe must be instance-scoped only for embeds');

const queueSource = sliceSource(quickbarSource, 'function queueInlineMetaRenderBlock', 'function getInlineDirectionalTaskBlocks');
assert.match(queueSource, /const renderKey = getInlineMetaRenderKey\(blockEl, taskId\)[\s\S]*inlineMetaRenderQueueIds\.add\(renderKey\)[\s\S]*inlineMetaRenderActiveIds\.add\(item\.renderKey\)/, 'render queue and active state must use render keys');
const syncSource = sliceSource(quickbarSource, 'function ensureInlineMetaBlockObserver', 'function cleanupInlineMetaTaskBlocks');
assert.match(syncSource, /inlineMetaVisibleTaskBlocks\.set\(renderKey, blockEl\)[\s\S]*nextBlocks\.set\(renderKey, blockEl\)[\s\S]*removeInlineMetaHostByRenderKey\(renderKey\)/, 'observation and unload cleanup must be instance-scoped');
assert.match(syncSource, /nextBlocks\.forEach\(\(nextEl, renderKey\) => \{[\s\S]*const blockId = String\(nextEl\?\.dataset\?\.nodeId \|\| ''\)\.trim\(\);[\s\S]*let renderTaskId = blockId;/, 'pre-render sync must recover the block ID from the element instead of treating the render key as a block ID');

const contextSource = sliceSource(quickbarSource, 'async function ensureInlineMetaEmbedContext', 'function resolveQuickbarAttrBindingFromBlockId');
assert.match(contextSource, /inlineMetaEmbedContextInflight\.get\(id\)[\s\S]*includeContext: true[\s\S]*inlineMetaEmbedContextInflight\.set\(id, request\)/, 'embedded source context requests must be cached and coalesced');
assert.doesNotMatch(quickbarSource, /__tmResolveTaskBindingFromAnyBlockId/, 'quickbar must not broaden the global binding resolver');

process.stdout.write('quickbar embed instance contract tests passed\n');
