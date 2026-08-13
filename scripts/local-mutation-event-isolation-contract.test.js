'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const services = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', '20-api-and-runtime-services.js'), 'utf8');
const lifecycle = fs.readFileSync(path.join(root, 'src', 'task-horizon', 'main', 'shell', '80-shell-lifecycle.js'), 'utf8');

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

const dispatch = segment(
    services,
    'function __tmDispatchQueuedTaskAttrPatch',
    'function __tmApplyQueuedOpOptimistic',
);
assert.match(dispatch, /localMutation: true/,
    'MutationService notifications must identify already projected local writes');

const handler = segment(
    lifecycle,
    '__tmQuickbarTaskUpdateHandler = (e) =>',
    "globalThis.__tmRuntimeEvents?.on?.(window, 'tm-task-attr-updated'",
);
assert.match(handler, /const localMutationEvent = e\.detail\.localMutation === true/);
assert.match(handler, /if \(localMutationEvent\)[\s\S]*handledInline = true;[\s\S]*else if \(attrKey\)/,
    'local MutationService notifications must not be consumed as an external change feed');
assert.match(handler, /const shouldMarkDirty = !localMutationEvent && \(!handledInline \|\| shouldDeferToAutoRefresh\)/,
    'local field writes must not schedule a later authoritative group reload');
assert.match(handler, /if \(attrKey === 'bookmark'\)/,
    'local notifications must still reach reminder consumers');

console.log('local mutation event isolation contract tests passed');
