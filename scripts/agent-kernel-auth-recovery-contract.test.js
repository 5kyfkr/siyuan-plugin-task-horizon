'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const workbench = fs.readFileSync(path.join(root, 'src/ai/agent-workbench.js'), 'utf8');
const kernel = fs.readFileSync(path.join(root, 'kernel.js'), 'utf8');

assert.match(workbench, /KERNEL_SESSION_AUTH_ERROR = 'Auth failed \[session\]'/, 'session recovery must match the exact SiYuan Kernel error');
assert.match(workbench, /KERNEL_AUTH_RETRYABLE_READ_CALLS = new Set\(\[[\s\S]*taskHorizonQueryTasks[\s\S]*taskHorizonSearchDocuments[\s\S]*\]\)/, 'context picker reads must be explicitly retryable');
assert.match(workbench, /fetch\('\/api\/petal\/setPetalEnabled'[\s\S]*packageName: KERNEL_PLUGIN_PACKAGE_NAME[\s\S]*enabled: true[\s\S]*app: appID/, 'recovery must restart the Kernel plugin without reloading the current app');
assert.match(workbench, /kernelAuthRecoveryPromise[\s\S]*KERNEL_AUTH_RECOVERY_STORAGE_KEY[\s\S]*KERNEL_AUTH_RECOVERY_COOLDOWN_MS/, 'recovery must be single-flight and coordinated across windows');
assert.match(workbench, /KERNEL_AUTH_RETRYABLE_READ_CALLS\.has\(name\)[\s\S]*return await callKernelMethod\(name, args\)/, 'only allowlisted reads may be replayed after recovery');
assert.match(kernel, /async function getVerifiedCapabilities\(\)[\s\S]*SELECT 1 AS task_horizon_session_probe[\s\S]*return getCapabilities\(\)/, 'capability checks must probe the Kernel plugin JWT before AI tools run');
assert.match(kernel, /taskHorizonGetCapabilities'[\s\S]*getVerifiedCapabilities\(\)/, 'the public capability RPC must use the authenticated probe');
assert.match(workbench, /async function ensureTaskToolsReadyForSend\(\)[\s\S]*await getCapabilities\(\)[\s\S]*setAgentMcpEnabled\(true\)[\s\S]*任务工具正在恢复，请稍后重试/, 'sending must verify and re-authorize task tools after automatic Kernel recovery');
assert.match(workbench, /async function sendMessage\(textOverride\)[\s\S]*if \(!await ensureTaskToolsReadyForSend\(\)\) return;[\s\S]*createSession\(\)/, 'AI requests must not start before task-tool session verification');

const constantsStart = workbench.indexOf("const KERNEL_PLUGIN_PACKAGE_NAME =");
const constantsEnd = workbench.indexOf('\n    const TASK_CONTEXT_DRAG_TYPES', constantsStart);
const functionsStart = workbench.indexOf('function kernelRecoveryAppID()');
const functionsEnd = workbench.indexOf('\n    function normalizeStore', functionsStart);
assert.ok(constantsStart >= 0 && constantsEnd > constantsStart, 'recovery constants must remain extractable');
assert.ok(functionsStart >= 0 && functionsEnd > functionsStart, 'recovery helpers must remain extractable');

const recoverySource = `${workbench.slice(constantsStart, constantsEnd)}\n${workbench.slice(functionsStart, functionsEnd)}`;

function createHarness(options = {}) {
    const storage = options.storage || new Map();
    const calls = [];
    const fetches = [];
    const methodResults = new Map(Object.entries(options.methodResults || {}));
    let pendingFetchResolve = null;
    const rpcCall = new Proxy({}, {
        get(_target, name) {
            if (typeof name !== 'string') return undefined;
            return async (...args) => {
                calls.push({ name, args });
                const queue = methodResults.get(name) || [];
                const next = queue.length ? queue.shift() : { ok: true, data: `${name}:ok` };
                if (next instanceof Error) throw next;
                return next;
            };
        },
    });
    const localStorage = {
        getItem: (key) => storage.has(key) ? storage.get(key) : null,
        setItem: (key, value) => storage.set(key, String(value)),
        removeItem: (key) => storage.delete(key),
    };
    const context = vm.createContext({
        bridge: () => ({ app: options.withoutApp ? {} : { appId: 'app-contract' }, kernel: { rpc: { call: rpcCall } } }),
        text: (value) => String(value == null ? '' : value).trim(),
        agentHeaders: () => ({ 'Content-Type': 'application/json', 'X-SiYuan-App-ID': 'app-contract' }),
        localStorage,
        fetch: async (url, init) => {
            fetches.push({ url, init });
            if (options.deferFetch) await new Promise((resolve) => { pendingFetchResolve = resolve; });
            return { ok: options.fetchOK !== false, status: options.fetchOK === false ? 500 : 200, json: async () => options.fetchPayload || { code: 0 } };
        },
        setTimeout: (callback) => { callback(); return 1; },
        clearTimeout: () => {},
        Date,
        Promise,
        Set,
        JSON,
        Number,
        Error,
    });
    vm.runInContext(`${recoverySource}\nthis.kernelCall = kernelCall;`, context);
    return {
        call: (...args) => context.kernelCall(...args),
        calls,
        fetches,
        storage,
        resolveFetch: () => pendingFetchResolve?.(),
    };
}

const authFailure = () => ({ ok: false, error: { message: 'Auth failed [session]', code: 'STORAGE_ERROR' } });

(async () => {
    const capabilityProbe = createHarness({
        methodResults: { taskHorizonGetCapabilities: [authFailure(), { ok: true, data: { mcpEnabled: true } }] },
    });
    assert.deepEqual(await capabilityProbe.call('taskHorizonGetCapabilities'), { mcpEnabled: true });
    assert.equal(capabilityProbe.calls.length, 2, 'the authenticated capability probe must retry after restarting a stale Kernel plugin');
    assert.equal(capabilityProbe.fetches.length, 1, 'capability recovery must restart the Kernel plugin exactly once');

    const read = createHarness({
        methodResults: { taskHorizonQueryTasks: [authFailure(), { ok: true, data: { items: ['recovered'] } }] },
    });
    assert.deepEqual(await read.call('taskHorizonQueryTasks', { limit: 20 }), { items: ['recovered'] });
    assert.equal(read.calls.length, 2, 'a read must retry exactly once');
    assert.equal(read.fetches.length, 1, 'a failed session must restart the plugin once');
    assert.equal(read.fetches[0].url, '/api/petal/setPetalEnabled');
    assert.deepEqual(JSON.parse(read.fetches[0].init.body), {
        packageName: 'siyuan-plugin-task-horizon',
        enabled: true,
        app: 'app-contract',
    });

    const mutation = createHarness({
        methodResults: { taskHorizonApplyPolicyPatch: [authFailure(), { ok: true, data: 'must-not-run' }] },
    });
    await assert.rejects(
        mutation.call('taskHorizonApplyPolicyPatch', { previewToken: 'token' }),
        (error) => error?.code === 'KERNEL_SESSION_RECOVERED' && /请重试/.test(error.message),
    );
    assert.equal(mutation.calls.length, 1, 'a mutation must never be replayed automatically');
    assert.equal(mutation.fetches.length, 1, 'a mutation auth failure must still repair the session');

    const exact = createHarness({
        methodResults: { taskHorizonQueryTasks: [{ ok: false, error: { message: 'Auth failed [other]' } }] },
    });
    await assert.rejects(exact.call('taskHorizonQueryTasks'), /Auth failed \[other\]/);
    assert.equal(exact.fetches.length, 0, 'non-session auth errors must not trigger recovery');

    const oneRetry = createHarness({
        methodResults: { taskHorizonQueryTasks: [authFailure(), authFailure(), { ok: true, data: 'must-not-run' }] },
    });
    await assert.rejects(oneRetry.call('taskHorizonQueryTasks'), /Auth failed \[session\]/);
    assert.equal(oneRetry.calls.length, 2, 'a persistently failing read must stop after one retry');

    const withoutApp = createHarness({
        withoutApp: true,
        methodResults: { taskHorizonQueryTasks: [authFailure()] },
    });
    await assert.rejects(
        withoutApp.call('taskHorizonQueryTasks'),
        (error) => error?.code === 'KERNEL_SESSION_RECOVERY_FAILED' && /当前窗口标识/.test(error.message),
    );
    assert.equal(withoutApp.fetches.length, 0, 'recovery without an app ID must not reload every window');

    const failedRestart = createHarness({
        fetchOK: false,
        methodResults: { taskHorizonQueryTasks: [authFailure()] },
    });
    await assert.rejects(failedRestart.call('taskHorizonQueryTasks'), (error) => error?.code === 'KERNEL_SESSION_RECOVERY_FAILED');
    assert.equal(failedRestart.storage.size, 0, 'a failed restart must release the cross-window cooldown');

    const sharedStorage = new Map();
    const firstWindow = createHarness({
        storage: sharedStorage,
        methodResults: { taskHorizonSearchDocuments: [authFailure(), { ok: true, data: [] }] },
    });
    await firstWindow.call('taskHorizonSearchDocuments', { keyword: 'a' });
    const secondWindow = createHarness({
        storage: sharedStorage,
        methodResults: { taskHorizonSearchDocuments: [authFailure(), { ok: true, data: [] }] },
    });
    await secondWindow.call('taskHorizonSearchDocuments', { keyword: 'b' });
    assert.equal(secondWindow.fetches.length, 0, 'a recent recovery in another window must honor the local cooldown');

    const concurrent = createHarness({
        deferFetch: true,
        methodResults: {
            taskHorizonQueryTasks: [authFailure(), authFailure(), { ok: true, data: 1 }, { ok: true, data: 2 }],
        },
    });
    const pending = [concurrent.call('taskHorizonQueryTasks'), concurrent.call('taskHorizonQueryTasks')];
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(concurrent.fetches.length, 1, 'concurrent failures in one window must share one recovery request');
    concurrent.resolveFetch();
    assert.deepEqual(await Promise.all(pending), [1, 2]);

    console.log('agent kernel auth recovery contract tests passed');
})().catch((error) => {
    process.nextTick(() => { throw error; });
});
