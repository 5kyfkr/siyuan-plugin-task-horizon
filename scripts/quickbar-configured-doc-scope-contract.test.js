'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const bridgeSource = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/shell/81-ai-bridge-runtime.js'),
    'utf8',
);

const start = bridgeSource.indexOf('    function __tmQuickbarConfiguredDocScopeFingerprint');
const end = bridgeSource.indexOf('    try { globalThis.__taskHorizonQuickbarInvalidateDocScope', start);
assert.ok(start >= 0 && end > start, 'configured document scope runtime must remain extractable');
const runtimeSource = bridgeSource.slice(start, end);

let fingerprint = 'scope-v1';
let expansionCount = 0;
const settings = {
    docGroups: [{ id: 'group-a' }],
    selectedDocIds: ['selected-doc', 'excluded-all'],
    newTaskDocId: 'quick-doc',
};

const normalizeExcluded = (input) => Array.from(new Set(
    (Array.isArray(input) ? input : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean),
));

const context = vm.createContext({
    console,
    SettingsStore: { data: settings },
    __tmBuildDocGroupLoaderContext: () => ({ scopeKey: fingerprint }),
    __tmGetAllDocsExcludedDocIds: () => ['excluded-all'],
    __tmNormalizeDocGroupExcludedDocIds: normalizeExcluded,
    __tmGetGroupSourceEntries: () => [
        { id: 'group-doc', kind: 'doc', recursive: false, excludedDocIds: ['group-doc'] },
        { id: 'group-root', kind: 'doc', recursive: true, excludedDocIds: ['group-root-child'] },
    ],
    __tmExpandSourceEntryDocIds: async (entry, pushId) => {
        expansionCount += 1;
        const excluded = new Set(entry.excludedDocIds || []);
        const emit = (id) => {
            if (!excluded.has(id)) pushId(id);
        };
        emit(entry.id);
        if (entry.recursive) emit(`${entry.id}-child`);
    },
});

vm.runInContext(`${runtimeSource}
globalThis.resolveConfigured = __tmQuickbarResolveConfiguredDocIds;
globalThis.invalidateConfigured = __tmInvalidateQuickbarConfiguredDocIdsCache;`, context);

(async () => {
    const first = await context.resolveConfigured(true);
    assert.deepEqual(Array.from(first), ['quick-doc', 'selected-doc', 'group-root']);
    assert.equal(expansionCount, 4, 'excluded direct documents must still be expanded once and filtered at source');
    assert.deepEqual(Array.from(context.__tmQuickbarResolveConfiguredDocIds?.__cache?.ids || first), Array.from(first));

    const cached = await context.resolveConfigured(false);
    assert.deepEqual(Array.from(cached), Array.from(first));
    assert.equal(expansionCount, 4, 'unchanged scope must use the configured-document cache');

    settings.selectedDocIds.push('new-selected-doc');
    fingerprint = 'scope-v2';
    const changed = await context.resolveConfigured(false);
    assert.ok(changed.includes('new-selected-doc'), 'scope fingerprint must change when selected documents change');

    context.invalidateConfigured();
    const invalidated = await context.resolveConfigured(false);
    assert.deepEqual(Array.from(invalidated), Array.from(changed));
    assert.ok(expansionCount > 6, 'scope invalidation must force a new expansion pass');

    assert.match(bridgeSource, /allDocsExcludedDocIds/);
    assert.match(bridgeSource, /source\.excludedDocIds/);
    assert.match(bridgeSource, /allDocsExcludedSet\.has\(id\)/);
    assert.match(bridgeSource, /__taskHorizonQuickbarInvalidateDocScope/);
    process.stdout.write('quickbar configured document scope contract: ok\n');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
