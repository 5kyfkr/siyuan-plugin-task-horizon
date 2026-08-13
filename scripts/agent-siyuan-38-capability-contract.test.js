const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const workbench = fs.readFileSync(path.join(root, 'src/ai/agent-workbench.js'), 'utf8');
const settings = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/71-ai-settings-and-save.js'), 'utf8');
const screen = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/60-settings-screen.js'), 'utf8');
const scheduledSettings = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/66-scheduled-events-settings.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');

assert.match(index, /typeof this\.addAgentCapability === "function"/, 'SiYuan 3.8 frontend capability API must be detected');
assert.match(index, /this\.addAgentCapability\(\{ name, title, description, inputSchema, effects, handler \}\)/, '3.8 capabilities must declare schemas and effects');
assert.match(index, /typeof this\.addAgentAction !== "function"/, 'legacy SiYuan frontend actions must remain supported');
assert.match(index, /__taskHorizonFrontendCapabilityDescriptors = frontendDescriptors/, 'the workbench must receive current frontend manifests');

assert.match(workbench, /frontendCapabilities: Array\.isArray\(globalThis\.__taskHorizonFrontendCapabilityDescriptors\)/, 'ordinary chats must send SiYuan 3.8 frontend capability manifests');
assert.match(workbench, /event\.type === 'browser_capability_call'[\s\S]*invokeBrowserCapability\(event\)/, 'ordinary chats must dispatch SiYuan 3.8 browser capability calls');
assert.match(workbench, /postAgentInteraction\('\/browserCapabilityResult'/, '3.8 browser results must use the current endpoint');
assert.match(workbench, /event\.type === 'frontend_tool_call'[\s\S]*invokeFrontendTool\(event\)/, 'legacy frontend calls must remain supported');
assert.match(workbench, /postAgentInteraction\('\/frontendToolResult'/, 'legacy frontend results must keep their endpoint');
assert.match(workbench, /prepareConversationTurn\(runtime\.activeSessionID, prompt,[\s\S]*displayPrompt: userText[\s\S]*references: refs[\s\S]*editorContext/, 'ordinary chats must checkpoint the exact model prompt before starting SiYuan 3.8 Agent');
assert.match(workbench, /userEntryID: prepared\.userEntryID,[\s\S]*contentRevision: prepared\.revision/, 'ordinary chats must anchor the request to the saved user entry revision');
assert.match(workbench, /event\.type === 'turn'[\s\S]*turnID = text\(event\.turnID\)[\s\S]*saveSession\(turnID\)/, 'ordinary chats must commit the SiYuan runtime turn explicitly');
assert.match(workbench, /saved\?\.session[\s\S]*runtime\.session = next/, 'ordinary chats must adopt the canonical session returned by SiYuan');
assert.match(workbench, /const agentPrompt = `\$\{prompt\}\$\{automationSafetyInstruction\(\)\}`[\s\S]*prepareConversationTurn\(sessionID, agentPrompt[\s\S]*message: agentPrompt/, 'scheduled chats must persist and send the same read-only model prompt');

assert.match(settings, /__TM_AGENT_BACKEND_CAPABILITY_PREFIX = 'plugin\/backend\/siyuan-plugin-task-horizon\/'/, 'Task Horizon must target only its stable backend capability IDs');
assert.match(settings, /nextAI = JSON\.parse\(JSON\.stringify\(currentAI\)\)/, 'policy updates must clone the full current AI config');
assert.match(settings, /overrides = \{ \.\.\.\(currentPolicy\.overrides/, 'policy updates must preserve unrelated capability overrides');
assert.match(settings, /fetch\('\/api\/setting\/setAI'/, 'policy updates must use SiYuan 3.8 settings API');
assert.doesNotMatch(settings, /exposurePolicy\s*=/, 'Task Horizon must never rewrite MCP exposure policy directly');
assert.match(settings, /effectiveAvailable: tool\?\.registered === true && agentAllowed|effectiveAvailable = tool\?\.registered === true && agentAllowed/, 'tool state must include SiYuan policy availability');
assert.match(screen, /思源关闭/, 'settings must distinguish plugin enabled from SiYuan denied');
assert.match(scheduledSettings, /tm-scheduled-events-status-detail/, 'scheduled errors must be visible beside the status');
assert.match(styles, /\.tm-scheduled-events-status-detail/, 'scheduled status errors must remain readable');

const registered = [];
class PluginStub {
    constructor() {
        this.name = 'siyuan-plugin-task-horizon';
        this.displayName = 'Task Horizon';
        this.app = {};
        this.agentCapabilities = [];
    }

    addAgentCapability(options) {
        const id = `plugin/frontend/${this.name}/${options.name}`;
        const generation = this.agentCapabilities.length + 1;
        this.agentCapabilities.push({ id, generation });
        registered.push({ ...options, id, generation });
        return id;
    }
}
const context = {
    console,
    module: { exports: {} },
    exports: {},
    require(name) {
        if (name !== 'siyuan') throw new Error(`unexpected module: ${name}`);
        return {
            Plugin: PluginStub,
            Protyle: class Protyle {},
            openTab() {},
            openMobileFileById() {},
            platformUtils: null,
        };
    },
    window: {},
    document: {},
    localStorage: { getItem: () => null, setItem() {} },
    navigator: { userAgent: '' },
    setTimeout,
    clearTimeout,
    Promise,
    Map,
    Set,
    JSON,
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(index, context, { filename: 'index.js' });
const plugin = new context.module.exports();
assert.equal(plugin.registerTaskHorizonAgentActions(), true);
assert.deepEqual(registered.map((item) => item.name), ['open_task_manager', 'focus_task', 'get_task_view_context']);
assert.equal(registered.every((item) => item.id.startsWith('plugin/frontend/siyuan-plugin-task-horizon/')), true);
assert.equal(registered.every((item) => item.generation > 0 && item.inputSchema?.type === 'object' && item.effects), true);
assert.equal(context.__taskHorizonFrontendCapabilityDescriptors.length, 3);
assert.equal(context.__taskHorizonAgentActionDescriptors.length, 0, '3.8 must not send legacy action descriptors');

console.log('SiYuan 3.8 capability compatibility contract tests passed');
