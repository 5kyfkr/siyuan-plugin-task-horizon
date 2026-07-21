'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const workbench = fs.readFileSync(path.join(root, 'src/ai/agent-workbench.js'), 'utf8');

assert.match(workbench, /typeof method !== 'function'[\s\S]*unavailableReason: 'kernel-rpc-missing'/, 'missing Kernel RPC must have a distinct capability reason');
assert.match(workbench, /catch \(error\)[\s\S]*unavailableReason: 'kernel-rpc-error'[\s\S]*unavailableDetail/, 'failed Kernel RPC must preserve its error detail');
assert.match(workbench, /任务工具内核未加载[\s\S]*未找到 Task Horizon 的 Kernel RPC/, 'missing Kernel RPC must explain the Kernel plugin dependency');
assert.match(workbench, /当前思源内核未提供 MCP[\s\S]*siyuan\.mcp/, 'loaded Kernel without MCP must have a distinct message');
assert.match(workbench, /function taskToolStatusText[\s\S]*任务工具内核连接失败[\s\S]*当前思源内核未提供 MCP[\s\S]*任务工具未启用/, 'composer status must distinguish all capability states');
assert.match(workbench, /data-agent-action="refresh-capabilities"[\s\S]*action === 'refresh-capabilities'[\s\S]*getCapabilities\(\)/, 'unavailable capability notices must support rechecking');
assert.match(workbench, /CAPABILITY_RETRY_INTERVAL_MS = 1000/, 'startup capability retries must wait one second between attempts');
assert.match(workbench, /CAPABILITY_RETRY_LIMIT = 5/, 'startup capability retries must stop after five attempts');
assert.match(workbench, /function shouldRetryCapabilities\(\)[\s\S]*settings\.agentMcpEnabled === true[\s\S]*runtime\.capabilities\?\.mcpEnabled !== true/, 'startup retries must run only when the saved task-tool switch is enabled but the runtime is not ready');
assert.match(workbench, /function startCapabilityRetry\(\)[\s\S]*attempts \+= 1[\s\S]*await getCapabilities\(\)[\s\S]*attempts < CAPABILITY_RETRY_LIMIT[\s\S]*setTimeout\(retry, CAPABILITY_RETRY_INTERVAL_MS\)/, 'startup capability detection must retry once per interval until ready or exhausted');
assert.match(workbench, /await Promise\.all\(\[getCapabilities\(\), listSessions\(\)\]\)[\s\S]*if \(runtime\.capabilities\?\.mcpEnabled\) await syncBuiltinSkills\(\);[\s\S]*else startCapabilityRetry\(\)/, 'sidebar reload must start retries after an unsuccessful initial capability check');
assert.match(workbench, /function cleanup\(\)[\s\S]*stopCapabilityRetry\(\)/, 'cleanup must cancel pending capability retries');

const retryStart = workbench.indexOf('function stopCapabilityRetry()');
const retryEnd = workbench.indexOf('\n    function taskToolStatusText', retryStart);
assert.ok(retryStart >= 0 && retryEnd > retryStart, 'capability retry helpers must remain extractable');

let timerSequence = 0;
let timers = [];
let settingsEnabled = true;
let capabilityResponses = [];
let capabilityCalls = 0;
let skillSyncCalls = 0;
const runtime = {
    mounted: true,
    capabilities: { mcpEnabled: false },
    capabilityRetryTimer: 0,
    capabilityRetrySeq: 0,
};
const context = vm.createContext({
    runtime,
    aiBridge: () => ({ getSettings: () => ({ agentMcpEnabled: settingsEnabled }) }),
    getCapabilities: async () => {
        capabilityCalls += 1;
        runtime.capabilities = { mcpEnabled: capabilityResponses.shift() === true };
        return runtime.capabilities;
    },
    render: () => {},
    syncBuiltinSkills: async () => { skillSyncCalls += 1; },
    setTimeout: (callback, delay) => {
        const id = ++timerSequence;
        timers.push({ id, callback, delay });
        return id;
    },
    clearTimeout: (id) => { timers = timers.filter((item) => item.id !== id); },
});
vm.runInContext(`
    const CAPABILITY_RETRY_INTERVAL_MS = 1000;
    const CAPABILITY_RETRY_LIMIT = 5;
    ${workbench.slice(retryStart, retryEnd)}
    this.startCapabilityRetry = startCapabilityRetry;
    this.stopCapabilityRetry = stopCapabilityRetry;
`, context);

async function runNextTimer() {
    const timer = timers.shift();
    assert.ok(timer, 'a capability retry timer must be scheduled');
    assert.equal(timer.delay, 1000, 'each capability retry must wait one second');
    await timer.callback();
}

(async () => {
    capabilityResponses = [false, false, true];
    assert.equal(context.startCapabilityRetry(), true);
    while (timers.length) await runNextTimer();
    assert.equal(capabilityCalls, 3, 'capability retries must stop immediately after the tools become ready');
    assert.equal(skillSyncCalls, 1, 'skills must sync once after a retry observes ready tools');

    capabilityCalls = 0;
    skillSyncCalls = 0;
    runtime.capabilities = { mcpEnabled: false };
    capabilityResponses = [false, false, false, false, false, true];
    assert.equal(context.startCapabilityRetry(), true);
    while (timers.length) await runNextTimer();
    assert.equal(capabilityCalls, 5, 'capability retries must stop after exactly five failed attempts');
    assert.equal(skillSyncCalls, 0);

    settingsEnabled = false;
    runtime.capabilities = { mcpEnabled: false };
    assert.equal(context.startCapabilityRetry(), false, 'disabled task tools must not start capability retries');
    assert.equal(timers.length, 0);

    console.log('agent capability status contract tests passed');
})().catch((error) => {
    process.nextTick(() => { throw error; });
});
