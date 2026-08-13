const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src/task-horizon/main/settings/71-ai-settings-and-save.js'), 'utf8');
const start = source.indexOf('let __tmAgentMcpEntitlementSyncPromise');
const end = source.indexOf('\n    async function __tmLoadAgentMcpCapabilities', start);
assert.ok(start >= 0 && end > start, 'capability policy helpers must remain extractable');

function createHarness(ai) {
    const requests = [];
    const context = {
        Promise,
        JSON,
        Set,
        CustomEvent: class CustomEvent { constructor(type) { this.type = type; } },
        window: {
            siyuan: { config: { ai: JSON.parse(JSON.stringify(ai)) } },
            dispatchEvent() {},
            tmLicenseHasFeature: () => true,
        },
        fetch: async (url, options = {}) => {
            const body = JSON.parse(options.body || '{}');
            requests.push({ url, body });
            return { ok: true, status: 200, async json() { return { code: 0, data: body }; } };
        },
    };
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(`${source.slice(start, end)}\nthis.setPolicy = __tmSetAgentCapabilityPolicy;`, context);
    return { context, requests };
}

(async () => {
    const base = {
        model: { provider: 'kept' },
        agent: {
            approvalPolicy: { default: 'risk', overrides: { 'plugin/backend/other/tool': 'allow' } },
            capabilityPolicy: { default: 'allow', overrides: { 'plugin/backend/other/tool': 'deny' } },
        },
        mcp: { exposurePolicy: { default: 'deny', overrides: { 'native/backend/query': 'allow' } } },
    };
    const deny = createHarness(base);
    await deny.context.setPolicy(['query_tasks'], false);
    const deniedAI = deny.requests[0].body;
    assert.equal(deny.requests[0].url, '/api/setting/setAI');
    assert.equal(deniedAI.agent.capabilityPolicy.overrides['plugin/backend/siyuan-plugin-task-horizon/query_tasks'], 'deny');
    assert.equal(deniedAI.agent.capabilityPolicy.overrides['plugin/backend/other/tool'], 'deny');
    assert.deepEqual(deniedAI.mcp.exposurePolicy, base.mcp.exposurePolicy, 'external MCP exposure policy must remain unchanged');
    assert.deepEqual(deniedAI.agent.approvalPolicy, base.agent.approvalPolicy, 'approval policy must remain unchanged');
    assert.deepEqual(deniedAI.model, base.model, 'unrelated AI settings must remain unchanged');

    await deny.context.setPolicy(['query_tasks'], true);
    const enabledAI = deny.requests[1].body;
    assert.equal(Object.prototype.hasOwnProperty.call(enabledAI.agent.capabilityPolicy.overrides, 'plugin/backend/siyuan-plugin-task-horizon/query_tasks'), false, 'allow under an allow default should remove only the Task Horizon override');
    assert.equal(enabledAI.agent.capabilityPolicy.overrides['plugin/backend/other/tool'], 'deny');

    const defaultDeny = createHarness({
        ...base,
        agent: { ...base.agent, capabilityPolicy: { default: 'deny', overrides: { 'plugin/backend/other/tool': 'allow' } } },
    });
    await defaultDeny.context.setPolicy(['aggregate_task_stats'], true);
    assert.equal(defaultDeny.requests[0].body.agent.capabilityPolicy.overrides['plugin/backend/siyuan-plugin-task-horizon/aggregate_task_stats'], 'allow', 'allow must be explicit when the SiYuan default is deny');
    assert.equal(defaultDeny.requests[0].body.agent.capabilityPolicy.overrides['plugin/backend/other/tool'], 'allow');

    console.log('Agent capability policy merge tests passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
