'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('./i18n-vm-fixture');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, 'src/task-horizon/main', file), 'utf8');
const apiSource = read('20-api-and-runtime-services.js');
const dialog = read('30-dialogs-and-ui-foundation.js');
const loader = read('task-runtime/53c-document-loader-runtime.js');
const lifecycle = read('shell/80-shell-lifecycle.js');
const docId = '20261016000000-aaaaaaa';
const childId = '20261016000000-bbbbbbb';
function extract(source, declaration) {
    const start = source.indexOf(declaration);
    const end = source.indexOf('\n    }', start);
    assert.ok(start >= 0 && end > start, declaration);
    return source.slice(start, end + 6);
}

function fixture(entries = [{ id: 'notebook-a', kind: 'notebook' }]) {
    const expanded = new Map(), resolved = new Map(), persisted = [];
    const calls = [];
    let respond = async () => ({ code: -1, msg: 'temporarily unavailable', readFailure: true });
    const scope = { groupId: 'work', memoryKey: 'work', scopeKey: 'work', group: null,
        entries, otherBlockRefs: [], excludedDocIdSet: new Set(), skipPersistedScope: true };
    const context = vm.createContext({
        console, Map, Set, Date, SettingsStore: { data: { recursiveDocLimit: 2000 } }, state: {},
        __TM_DOC_EXPAND_CACHE_TTL_MS: 600000, __TM_RESOLVED_DOC_IDS_CACHE_TTL_MS: 600000,
        __tmDocExpandCache: expanded, __tmResolvedDocIdsCacheMap: resolved,
        __tmResolvedDocIdsCache: null, __tmResolvedDocIdsPromise: null,
        __tmNormalizeCalendarSearchOptimization: () => ({ enabled: false, days: 90 }),
        __tmNormalizeDocGroupExcludedDocIds: value => Array.isArray(value) ? value : [],
        __tmRememberTimedCache: (map, key, value) => map.set(key, value),
        __tmRememberSmallCache: (map, key, value) => map.set(key, value),
        __tmRememberDocScope: (key, ids) => persisted.push({ key, ids: Array.from(ids) }),
        __tmBuildDocGroupLoaderContext: options => ({ ...scope, ...options }),
    });
    const apiStart = apiSource.indexOf('        async getSubDocIds(');
    const apiEnd = apiSource.indexOf('        async getBlockKramdown(', apiStart);
    assert.ok(apiStart >= 0 && apiEnd > apiStart);
    vm.runInContext(`globalThis.API = {${apiSource.slice(apiStart, apiEnd)}};`, context);
    context.API.call = async (url, body) => { calls.push({ url, body }); return respond(url, body); };
    vm.runInContext([
        extract(dialog, '    async function __tmExpandSourceEntryDocIds('),
        ...['__tmNormalizeDocGroupLoaderIds', '__tmRememberDocGroupResolvedScope',
            '__tmGetDocGroupResolvedMemoryCache', '__tmFilterDocGroupExcludedIds']
            .map(name => extract(loader, `    function ${name}(`)),
        extract(loader, '    async function __tmResolveOtherBlockSourceDocIdsForDocGroup('),
        extract(loader, '    async function __tmResolveDocGroupFreshIds('),
        extract(loader, '    async function resolveDocIdsFromGroups('),
    ].join('\n'), context);
    return { context, calls, expanded, resolved, persisted, respond: fn => { respond = fn; },
        resolve: options => context.resolveDocIdsFromGroups(options) };
}

async function managerLoadOptions(hasTasks) {
    class Element {}
    const state = { openToken: 0, taskTree: hasTasks ? [{ id: docId }] : [], flatTasks: {}, viewMode: 'kanban' };
    const loads = [];
    const context = vm.createContext({
        console, Element, HTMLElement: Element, state,
        document: { body: { contains: () => false } },
        SettingsStore: { data: { selectedDocIds: [docId] } },
        __tmMountEl: {}, __tmMarkContextInteractionQuiet: () => {}, __tmListenPinnedChanged: () => {},
        __tmIsRuntimeMobileClient: () => false, __tmEnsureMount: () => {}, __tmEnsureSettingsLoaded: async () => {},
        __tmHasQuickbarModificationsSync: () => false, __tmRefreshNotebookCache: async () => {},
        checkAnyGroupHasDocs: async () => true, render: () => { state.modal = new Element(); },
        loadSelectedDocuments: async options => { loads.push(options); return true; },
        setTimeout: () => 1, requestAnimationFrame: fn => fn(),
    });
    vm.runInContext(extract(lifecycle, '    async function openManager('), context);
    await context.openManager({ skipEnsureTabOpened: true, awaitInitialLoad: true });
    assert.equal(loads.length, 1);
    return loads[0];
}

async function retryScope(readScope, options = {}, isCurrent = () => true) {
    const start = loader.indexOf('        const resolveScopeOptions =', loader.indexOf('async function loadSelectedDocuments('));
    const end = loader.indexOf('        const editorOrderSnapshots =', start);
    assert.ok(start >= 0 && end > start);
    const context = vm.createContext({
        options, state: {}, currentGroupId: 'work', isSwitchDocGroupLoad: false, preferFastFirstPaint: true, forceFreshTasks: false,
        retryEmptyDocScope: options.retryEmptyDocScope === true, waitForDocScopeResolve: false,
        resolveDocIdsFromGroups: readScope, __tmBuildDocGroupLoaderContext: () => ({ entries: [{ id: 'notebook-a', kind: 'notebook' }] }),
        __tmRefreshNotebookCache: async () => {}, isTokenCurrent: isCurrent, setTimeout: fn => { fn(); return 1; },
    });
    vm.runInContext(`globalThis.loadScope = async () => {${loader.slice(start, end)}return allDocIds;};`, context);
    return context.loadScope();
}

async function run() {
    for (const transportFailure of [false, true]) {
        const f = fixture();
        if (transportFailure) f.respond(async () => { throw new Error('network unavailable'); });
        await assert.rejects(f.resolve(), /unavailable|读取|获取|查询/,
            'failed notebook reads must not become a successful empty scope');
        assert.equal(f.expanded.size, 0, 'a failed expansion is not cached');
        assert.equal(f.resolved.size, 0, 'a failed group scope is not cached');
        assert.equal(f.persisted.length, 0, 'a failed group scope is not persisted');
        f.respond(async () => ({ code: 0, data: [{ id: docId, content: 'Recovered' }] }));
        assert.deepEqual(Array.from(await f.resolve()), [docId], 'ordinary loading retries after backend recovery');
        const reads = f.calls.length;
        assert.deepEqual(Array.from(await f.resolve()), [docId]);
        assert.equal(f.calls.length, reads, 'successful scopes keep their cache');
    }

    const fallback = fixture();
    fallback.respond(async (url, body) => {
        if (url === '/api/file/readDir') return { code: 0, data: [{ name: docId + '.sy', isDir: false }] };
        if (body.stmt?.includes('id IN')) return { code: 0, data: [{ id: docId, content: 'From file tree' }] };
        return { code: -1, msg: 'SQL temporarily unavailable', readFailure: true };
    });
    assert.deepEqual(Array.from(await fallback.resolve()), [docId], 'file-tree fallback still recovers from a failed SQL read');

    const partial = fixture();
    partial.respond(async (url, body) => {
        if (url === '/api/file/readDir' && body.path === '/data/notebook-a') {
            return { code: 0, data: [{ name: docId + '.sy', isDir: false }, { name: docId, isDir: true }] };
        }
        return { code: -1, msg: 'subdirectory unavailable', readFailure: true };
    });
    await assert.rejects(partial.resolve(), /unavailable|读取|获取/,
        'an incomplete file-tree fallback must not be cached as a complete scope');
    assert.equal(partial.expanded.size, 0);
    assert.equal(partial.resolved.size, 0);
    assert.equal(partial.persisted.length, 0);

    const mixed = fixture([{ id: docId, kind: 'doc' }, { id: 'notebook-a', kind: 'notebook' }]);
    await assert.rejects(mixed.resolve(), /unavailable|读取|获取|查询/);
    assert.equal(mixed.resolved.size, 0, 'a successful source cannot hide another failed source');
    assert.equal(mixed.persisted.length, 0);

    const empty = fixture();
    empty.respond(async () => ({ code: 0, data: [] }));
    assert.deepEqual(Array.from(await empty.resolve()), [], 'a confirmed empty notebook remains a valid empty scope');
    const emptyReads = empty.calls.length;
    assert.deepEqual(Array.from(await empty.resolve()), []);
    assert.equal(empty.calls.length, emptyReads, 'confirmed empty scopes can still be cached');

    const recursive = fixture([{ id: docId, kind: 'doc', recursive: true }]);
    let childrenAvailable = false;
    recursive.respond(async (url, body) => {
        if (body.stmt?.startsWith('SELECT path, box')) return { code: 0, data: [{ path: '/' + docId + '.sy', box: 'notebook-a' }] };
        return childrenAvailable ? { code: 0, data: [{ id: childId }] }
            : { code: -1, msg: 'children unavailable', readFailure: true };
    });
    await assert.rejects(recursive.resolve(), /unavailable|读取|获取|查询/);
    assert.equal(recursive.expanded.size, 0, 'a failed recursive read must not cache only the parent');
    assert.equal(recursive.resolved.size, 0);
    childrenAvailable = true;
    assert.deepEqual(Array.from(await recursive.resolve()), [docId, childId]);

    const coldOptions = await managerLoadOptions(false);
    assert.equal(coldOptions.retryEmptyDocScope, true, 'a desktop first load also recovers from temporarily unavailable scope reads');
    const warmOptions = await managerLoadOptions(true);
    assert.equal(warmOptions.retryEmptyDocScope, false, 'an ordinary warm open does not add startup retries');
    const attempts = [];
    const recovered = await retryScope(async options => {
        attempts.push(options);
        if (attempts.length === 1) throw new Error('startup unavailable');
        return [docId];
    }, coldOptions);
    assert.deepEqual(Array.from(recovered), [docId]);
    assert.equal(attempts.length, 2);
    assert.equal(attempts[1].forceRefreshScope, true);
    assert.equal(attempts[1].skipPersistedScope, true);
    assert.equal(attempts[1].skipResolvedDocIdsCache, true);
    let failures = 0;
    await assert.rejects(retryScope(async () => { failures++; throw new Error('still unavailable'); }, coldOptions), /still unavailable/);
    assert.equal(failures, 4, 'startup retries are bounded to three retries');
    let cancelledReads = 0;
    await retryScope(async () => { cancelledReads++; throw new Error('old load'); }, coldOptions, () => false);
    assert.equal(cancelledReads, 1, 'a superseded startup must not start another scope read');
    console.log('Document scope read failures: retry, complete fallback, partial failures and valid empty caching passed.');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
