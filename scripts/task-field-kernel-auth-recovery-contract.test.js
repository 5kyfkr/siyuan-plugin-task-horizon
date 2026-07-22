'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const services = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const workbench = fs.readFileSync(path.join(root, 'src/ai/agent-workbench.js'), 'utf8');

assert.match(services, /__TM_KERNEL_SESSION_AUTH_ERROR = 'Auth failed \[session\]'/, 'task fields must recognize the exact stale Kernel JWT error');
assert.match(services, /__TM_KERNEL_RECOVERY_REPLAYABLE_RPCS = new Set\(\['taskHorizonPersistUiTaskAttrs'\]\)/, 'only the idempotent task-attribute RPC may be replayed automatically');
assert.doesNotMatch(services, /__TM_KERNEL_RECOVERY_REPLAYABLE_RPCS = new Set\([^\n]*(?:PersistUiBlockOperation|CreateTask|MoveTask|DeleteTask)/, 'non-idempotent writes must never enter the automatic replay allowlist');
assert.match(services, /fetch\('\/api\/petal\/setPetalEnabled'[\s\S]*packageName: 'siyuan-plugin-task-horizon'[\s\S]*enabled: true[\s\S]*app: appID/, 'field recovery must restart only the current Task Horizon Kernel session');
assert.match(services, /async function __tmCallTaskHorizonKernelRpc\(name, \.\.\.args\)[\s\S]*__tmIsKernelSessionAuthError\(error\)[\s\S]*await __tmRecoverTaskHorizonKernelSession\(\)[\s\S]*__TM_KERNEL_RECOVERY_REPLAYABLE_RPCS\.has\(methodName\)[\s\S]*return await invoke\(\)/, 'field RPC must recover and retry its idempotent attribute write once');
assert.match(services, /taskHorizonPersistUiTaskAttrs[\s\S]*if \(kernelWrite\.available\) return true/, 'task date and metadata persistence must use the recoverable Kernel attribute gateway first');
assert.match(workbench, /typeof globalThis\.__tmRecoverTaskHorizonKernelSession === 'function'[\s\S]*return await globalThis\.__tmRecoverTaskHorizonKernelSession\(\)/, 'AI and task fields must share one Kernel recovery coordinator');

console.log('task field Kernel auth recovery contract tests passed');
