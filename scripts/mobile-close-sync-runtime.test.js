'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname,
    '../src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');

function segment(start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, `runtime section exists: ${start}`);
    return source.slice(from, to);
}

const clientRuntime = segment('    const __tmGetRuntimeBackendType =',
    '    const __tmIsMobileDevice =');
const closeSyncRuntime = segment('    function __tmIsMobileCloseSyncRuntime()',
    '    function __tmNormalizeQueueTaskValue(');

function createRuntime({ frontend, container = 'windows', kind, syncEnabled = true, nativeBridge = {} }) {
    const calls = [];
    const context = vm.createContext({
        ...nativeBridge,
        __taskHorizonRuntimeClientKind: kind,
        __taskHorizonHostBridge: { getFrontend: () => frontend },
        // Mobile UI alone must never authorize a server-side cloud sync.
        __tmHost: {
            isMobileRuntime: () => true,
            postKernel: async (url, data) => {
                calls.push({ url, data });
                return { code: 0 };
            },
        },
        navigator: { userAgent: 'Android Mobile', maxTouchPoints: 5 },
        document: { documentElement: { dataset: {} } },
        siyuan: { config: { system: { container }, sync: { enabled: syncEnabled } } },
        state: { __tmMobileCloseSyncArmed: true, __tmMobileCloseSyncDirty: false },
        SettingsStore: {},
        MetaStore: {},
        WhiteboardStore: {},
    });
    context.window = context;
    vm.runInContext(clientRuntime + '\n' + closeSyncRuntime, context);
    return { context, calls };
}

for (const container of ['windows', 'android', 'ios', 'harmony']) {
    for (const frontend of ['browser-mobile', 'browser-desktop']) {
        test(`${frontend} served by ${container} never syncs on manager close`, async () => {
            const { context, calls } = createRuntime({ frontend, container });
            assert.equal(context.__tmMarkMobileCloseSyncDirty('task-setDone'), false);
            assert.equal(context.state.__tmMobileCloseSyncDirty, false);
            // Even a dirty flag retained from an earlier session cannot trigger sync.
            context.state.__tmMobileCloseSyncDirty = true;
            assert.equal(context.__tmSyncOnMobileCloseIfDirty('topbar-close'), false);
            await new Promise(setImmediate);
            assert.equal(calls.length, 0);
            assert.notEqual(context.state.__tmMobileCloseSyncInFlight, true);
        });
    }
}

for (const options of [
    { container: 'android', nativeBridge: { JSAndroid: {} } },
    { container: 'ios', nativeBridge: { webkit: { messageHandlers: {} } } },
    { container: 'harmony', nativeBridge: { JSHarmony: {} } },
    { container: 'unknown' },
]) {
    test(`native mobile ${options.container} retains close sync after changes`, async () => {
        const { context, calls } = createRuntime({ frontend: 'mobile', ...options });
        assert.equal(context.__tmMarkMobileCloseSyncDirty('task-setDone'), true);
        assert.equal(context.__tmSyncOnMobileCloseIfDirty('topbar-close'), true);
        await new Promise(setImmediate);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].url, '/api/sync/performSync');
        assert.equal(context.state.__tmMobileCloseSyncDirty, false);
        assert.equal(context.state.__tmMobileCloseSyncInFlight, false);
    });
}

test('explicit mobile-browser classification overrides mobile UI signals', () => {
    const { context } = createRuntime({ frontend: 'mobile', kind: 'mobile-browser' });
    assert.equal(context.__tmIsMobileCloseSyncRuntime(), false);
});

test('native mobile respects disabled SiYuan sync', async () => {
    const { context, calls } = createRuntime({ frontend: 'mobile', syncEnabled: false });
    context.__tmMarkMobileCloseSyncDirty('task-setDone');
    assert.equal(context.__tmSyncOnMobileCloseIfDirty('topbar-close'), false);
    await new Promise(setImmediate);
    assert.equal(calls.length, 0);
});

test('native mobile without changes does not request sync', async () => {
    const { context, calls } = createRuntime({ frontend: 'mobile' });
    context.__tmSyncOnMobileCloseIfDirty('topbar-close');
    await new Promise(setImmediate);
    assert.equal(calls.length, 0);
});
