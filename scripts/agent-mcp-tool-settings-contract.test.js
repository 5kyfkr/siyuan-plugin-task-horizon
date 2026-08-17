const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const settingsScreen = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/60-settings-screen.js'), 'utf8');
const settingsActions = fs.readFileSync(path.join(root, 'src/task-horizon/main/settings/71-ai-settings-and-save.js'), 'utf8');
const pluginEntry = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'task-horizon.css'), 'utf8');

assert.match(settingsScreen, /tmGetAgentMcpToolGroups/, 'settings must render the tool catalog returned by the kernel');
assert.match(settingsScreen, /tmUpdateAgentMcpGroup/, 'settings must expose group switches');
assert.match(settingsScreen, /tmUpdateAgentMcpTool/, 'settings must expose individual tool switches');
assert.match(settingsScreen, /启用任务 MCP 工具/, 'advanced settings must name the registered capability precisely');
assert.match(settingsScreen, /思源智能体/, 'user-facing settings must use the SiYuan product name');
assert.doesNotMatch(settingsScreen, /思源 Agent/, 'user-facing settings must not mix English Agent terminology');
assert.doesNotMatch(settingsScreen, /全功能会员首次默认启用/, 'settings must not expose entitlement initialization details');
assert.match(settingsScreen, /关闭后会从下一次智能体对话中移除/, 'settings must explain when tool changes take effect');
assert.match(settingsScreen, /const __tmAgentMcpExpandedToolGroups = new Set\(\)[\s\S]*tmSetAgentMcpToolGroupExpanded/, 'expanded MCP tool groups must survive settings rerenders');
assert.match(settingsScreen, /<details class="tm-agent-tool-group[\s\S]*<summary class="tm-agent-tool-group__head"[\s\S]*tm-agent-tool-group__chevron/, 'each MCP tool group must expose collapsible child settings');
assert.match(settingsScreen, /onclick="event\.stopPropagation\(\)" onchange="tmUpdateAgentMcpGroup/, 'using a group switch must not accidentally toggle its collapsed state');
assert.match(settingsActions, /taskHorizonSetMcpToolConfig/, 'tool switches must use the kernel configuration RPC');
assert.match(settingsActions, /taskHorizonSyncMcpEntitlement/, 'the frontend must synchronize the verified entitlement before enabling kernel tools');
assert.match(settingsActions, /function __tmLoadAgentMcpCapabilities[\s\S]*taskHorizonGetCapabilities/, 'the settings mirror must read the authoritative kernel capability state');
assert.match(settingsActions, /任务 MCP 工具服务未启动，请重启思源笔记后再试/, 'missing kernel RPC must tell the user to restart SiYuan');
assert.match(settingsActions, /catch \(e\) \{[\s\S]*__tmLoadAgentMcpCapabilities\(\)[\s\S]*current\?\.mcpEnabled/, 'failed MCP updates must restore the settings mirror from the kernel');
assert.match(settingsActions, /const desired = allowed && \(initialized \? SettingsStore\.data\.agentMcpEnabled === true : true\)/, 'initialized MCP startup must restore the saved frontend switch instead of reading the reset runtime state');
assert.match(settingsActions, /__TM_AGENT_MCP_STARTUP_RETRY_DELAYS_MS = \[0, 500, 1000, 2000, 3000\][\s\S]*for \(let index = 0; index < __TM_AGENT_MCP_STARTUP_RETRY_DELAYS_MS\.length; index \+= 1\)[\s\S]*__tmSyncAgentMcpAuthorization\(allowed, desired\)/, 'startup entitlement sync must retry until the kernel RPC is ready and restore the desired enabled state atomically');
assert.match(settingsActions, /Number\(kernelState\?\.code\) !== 2[\s\S]*__tmRequestAgentMcpEntitlementSync\(\)[\s\S]*kernel-plugin-state-change/, 'the frontend must restore MCP entitlement whenever its Kernel plugin reaches running');
assert.match(settingsActions, /function __tmRequestAgentMcpEntitlementSync\(\)[\s\S]*if \(activeSync\) return activeSync;[\s\S]*__tmSyncAgentMcpEntitlementDefault/, 'duplicate startup triggers must share the active entitlement synchronization');
assert.match(settingsActions, /const settingsChanged =[\s\S]*if \(settingsChanged\) await SettingsStore\.save\(\)/, 'an unchanged startup entitlement state must not rewrite task settings');
const kernelSource = fs.readFileSync(path.join(root, 'kernel.js'), 'utf8');
assert.match(kernelSource, /mcpPersistedConfigSignature[\s\S]*persistedChanged = mcpPersistedConfigSignature\(\) !== previousPersistedSignature[\s\S]*if \(persistedChanged\) await persistMcpConfig\(\)/,
    'the Kernel must not rewrite MCP config or updatedAt when the effective persisted state is unchanged');
const activateStart = pluginEntry.indexOf('    async activateTaskMainRuntime(');
const activateEnd = pluginEntry.indexOf('\n    scheduleTaskMainRuntimeRecovery(', activateStart);
assert.ok(activateStart >= 0 && activateEnd > activateStart, 'main runtime activation must remain inspectable');
assert.doesNotMatch(pluginEntry.slice(activateStart, activateEnd), /__taskHorizonSyncAgentMcpEntitlement/,
    'main runtime activation must not duplicate the settings runtime startup synchronization');
assert.match(settingsActions, /function __tmCleanupAgentMcpStartupSync[\s\S]*clearTimeout\(waiter\.timer\)[\s\S]*offEventBus\?\.\([\s\S]*kernel-plugin-state-change[\s\S]*tm:task-horizon-license-changed/, 'unload must cancel startup waits and detach MCP recovery listeners');
assert.match(settingsActions, /tmGetLicenseState\?\.\(\)\?\.loaded !== true\)[\s\S]*tmLicenseLoad\?\.\(false\)/, 'MCP synchronization must not reload and rebroadcast an already loaded license');
assert.match(settingsActions, /tm:task-horizon-license-changed[\s\S]*__tmRequestAgentMcpEntitlementSync\(\)\.catch\(\(\) => null\)/, 'license changes must not leak a rejected entitlement sync promise');
assert.match(styles, /\.tm-agent-tool-group__items[\s\S]*grid-template-columns: repeat\(2/, 'desktop tool settings must remain compact');
assert.match(styles, /\.tm-agent-tool-group__head::-webkit-details-marker[\s\S]*display: none[\s\S]*\.tm-agent-tool-group\[open\] \.tm-agent-tool-group__chevron[\s\S]*rotate\(180deg\)/, 'collapsible groups must use a consistent native chevron instead of the browser marker');
assert.match(styles, /@media \(max-width: 768px\)[\s\S]*\.tm-agent-tool-group__items[\s\S]*grid-template-columns: minmax\(0, 1fr\)/, 'mobile tool settings must use one column');

console.log('agent MCP tool settings contract tests passed');
