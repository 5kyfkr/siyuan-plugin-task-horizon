'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (...segments) => fs.readFileSync(path.join(root, ...segments), 'utf8');
const store = read('src', 'task-horizon', 'main', '10-stores-rules-and-cache.js');
const runtime = read('src', 'task-horizon', 'main', 'task-runtime', '53b-task-create-and-quick-add-runtime.js');
const settings = read('src', 'task-horizon', 'main', 'settings', '60-settings-screen.js');
const actions = read('src', 'task-horizon', 'main', 'settings', '70-doc-group-and-settings-actions.js');
const exportsRuntime = read('src', 'task-horizon', 'main', 'settings', '64-export-runtime.js');
const whiteboard = read('src', 'task-horizon', 'main', 'render', '49-render-whiteboard-interactions.js');
const aiBridge = read('src', 'task-horizon', 'main', 'shell', '81-ai-bridge-runtime.js');
const plain = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

function extractFunction(source, marker) {
    const start = source.indexOf(marker);
    assert.notEqual(start, -1, `${marker} must exist`);
    const bodyStart = source.indexOf('{', start);
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        else if (source[index] === '}') depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`Unable to extract ${marker}`);
}

const normalizeSource = extractFunction(store, 'function __tmNormalizeQuickAddLastLocation');
const normalizeDefaultModeSource = extractFunction(store, 'function __tmNormalizeNewTaskDefaultLocationMode');
const normalize = (input) => vm.runInNewContext(
    `${normalizeSource}; __tmNormalizeQuickAddLastLocation(input);`,
    { input }
);
const normalizeDefaultMode = (value) => vm.runInNewContext(
    `${normalizeDefaultModeSource}; __tmNormalizeNewTaskDefaultLocationMode(value);`,
    { value }
);

assert.deepEqual(plain(normalize({ mode: 'doc', docId: ' doc-a ' })), { mode: 'doc', docId: 'doc-a' });
assert.deepEqual(plain(normalize({ mode: 'dailyNote', docId: 'ignored' })), { mode: 'dailyNote' });
assert.equal(normalize({ mode: 'doc', docId: '' }), null);
assert.equal(normalize({ mode: 'unknown', docId: 'doc-a' }), null);
assert.equal(normalizeDefaultMode('lastSelected'), 'lastSelected');
assert.equal(normalizeDefaultMode('unknown'), 'configured');

const resolveSource = extractFunction(runtime, 'async function __tmResolveQuickAddInitialLocation');
const resolveInitial = (data, lastLocation, fallbackDocId) => vm.runInNewContext(
    `(${resolveSource})()`,
    {
        SettingsStore: { data },
        __tmNormalizeNewTaskDefaultLocationMode: normalizeDefaultMode,
        __tmGetQuickAddLastLocation: () => lastLocation,
        __tmResolveDefaultDocIdAsync: async () => fallbackDocId,
    }
);

const updateNewTaskDocIdSource = extractFunction(actions, 'window.updateNewTaskDocId = async function');
async function runUpdateNewTaskDocId(data, value, mounted = true) {
    const loadCalls = [];
    const modal = {};
    const context = {
        window: {},
        SettingsStore: {
            data: { ...data },
            save: async () => {},
        },
        state: { modal },
        document: {
            body: {
                contains: (element) => mounted && element === modal,
            },
        },
        loadSelectedDocuments: async (options) => loadCalls.push(plain(options)),
    };
    vm.runInNewContext(`${updateNewTaskDocIdSource};`, context);
    await context.window.updateNewTaskDocId(value, {
        refreshQuickAdd: false,
        refreshPicker: false,
    });
    return {
        data: plain(context.SettingsStore.data),
        loadCalls,
    };
}

(async () => {
    assert.deepEqual(
        plain(await resolveInitial({ newTaskDocId: '__dailyNote__', newTaskDefaultLocationMode: 'configured' }, null, 'doc-fallback')),
        { mode: 'dailyNote', docId: 'doc-fallback' }
    );
    assert.deepEqual(
        plain(await resolveInitial({ newTaskDocId: 'doc-fixed', newTaskDefaultLocationMode: 'lastSelected' }, { mode: 'doc', docId: 'doc-last' }, 'doc-fixed')),
        { mode: 'doc', docId: 'doc-last' }
    );
    assert.deepEqual(
        plain(await resolveInitial({ newTaskDocId: 'doc-fixed', newTaskDefaultLocationMode: 'lastSelected' }, { mode: 'dailyNote' }, 'doc-fixed')),
        { mode: 'dailyNote', docId: 'doc-fixed' }
    );
    assert.deepEqual(
        plain(await resolveInitial({ newTaskDocId: 'doc-fixed', newTaskDefaultLocationMode: 'lastSelected' }, null, 'doc-fixed')),
        { mode: 'doc', docId: 'doc-fixed' }
    );

    const changedDoc = await runUpdateNewTaskDocId({ newTaskDocId: 'doc-old' }, 'doc-new');
    assert.equal(changedDoc.data.newTaskDocId, 'doc-new');
    assert.deepEqual(changedDoc.loadCalls, [{
        forceRefreshScope: true,
        showInlineLoading: false,
        source: 'new-task-doc-change',
    }]);

    const unchangedDoc = await runUpdateNewTaskDocId({ newTaskDocId: 'doc-fixed' }, ' doc-fixed ');
    assert.equal(unchangedDoc.loadCalls.length, 0);

    const lastSelected = await runUpdateNewTaskDocId({ newTaskDocId: 'doc-fixed' }, '__lastSelected__');
    assert.equal(lastSelected.data.newTaskDocId, 'doc-fixed');
    assert.equal(lastSelected.data.newTaskDefaultLocationMode, 'lastSelected');
    assert.equal(lastSelected.loadCalls.length, 0);

    const dailyNote = await runUpdateNewTaskDocId({ newTaskDocId: 'doc-old' }, '__dailyNote__');
    assert.equal(dailyNote.data.newTaskDocId, '__dailyNote__');
    assert.equal(dailyNote.data.newTaskDefaultLocationMode, 'configured');
    assert.deepEqual(dailyNote.loadCalls, [{
        forceRefreshScope: true,
        showInlineLoading: false,
        source: 'new-task-doc-change',
    }]);

    const closedManager = await runUpdateNewTaskDocId({ newTaskDocId: 'doc-old' }, 'doc-new', false);
    assert.equal(closedManager.data.newTaskDocId, 'doc-new');
    assert.equal(closedManager.loadCalls.length, 0);

    assert.match(settings, /<option value="__dailyNote__" style="font-weight:700;"[^>]*>今天日记<\/option>/);
    assert.match(settings, /<option value="__lastSelected__" style="font-weight:700;"[^>]*>上次选择<\/option>/);
    assert.match(actions, /const useLastSelection = v === '__lastSelected__';[\s\S]*if \(!useLastSelection\) SettingsStore\.data\.newTaskDocId = v;/);
    assert.doesNotMatch(whiteboard, /__lastSelected__/);
    assert.doesNotMatch(aiBridge, /__lastSelected__/);

    const rememberSource = extractFunction(runtime, 'function __tmRememberQuickAddLocation');
    assert.equal((rememberSource.match(/SettingsStore\.save/g) || []).length, 1, 'one selection should trigger one settings save');
    assert.match(runtime, /window\.tmQuickAddSelectDoc[\s\S]*__tmRememberQuickAddLocation\('doc', id\)/);
    assert.match(runtime, /window\.tmQuickAddUseTodayDiary[\s\S]*__tmRememberQuickAddLocation\('dailyNote'\)/);
    assert.match(store, /tm_new_task_default_location_mode/);
    assert.match(store, /__TM_QUICK_ADD_LAST_LOCATION_KEY/);
    assert.match(exportsRuntime, /'newTaskDefaultLocationMode'/);
    assert.match(exportsRuntime, /'quickAddLastLocation'/);

    console.log('quick add last location contract tests passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
