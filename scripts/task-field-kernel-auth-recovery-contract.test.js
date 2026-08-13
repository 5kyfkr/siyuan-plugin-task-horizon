'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const services = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const workbench = fs.readFileSync(path.join(root, 'src/ai/agent-workbench.js'), 'utf8');
const rpcStart = services.indexOf('async function __tmCallTaskHorizonKernelRpc');
const rpcEnd = services.indexOf('\n    const __TM_TASK_REPEAT_RULE_ATTR', rpcStart);
const rpcSource = services.slice(rpcStart, rpcEnd);
const persistStart = services.indexOf('async function __tmPersistMetaAndAttrsKernel');
const persistEnd = services.indexOf('\n    function __tmEnqueueTimelineMutation', persistStart);
const persistSource = services.slice(persistStart, persistEnd);
const gatewayStart = services.indexOf('async function __tmExecuteTaskCommandGateway');
const gatewayEnd = services.indexOf('\n    const __TM_TASK_REPEAT_RULE_ATTR', gatewayStart);
const gatewaySource = services.slice(gatewayStart, gatewayEnd);

assert.match(services, /__TM_KERNEL_SESSION_AUTH_ERROR = 'Auth failed \[session\]'/, 'task fields must recognize the exact stale Kernel JWT error');
assert.doesNotMatch(rpcSource, /__TM_KERNEL_RECOVERY_REPLAYABLE_RPCS/,
    'task writes must never be replayed automatically after session recovery');
assert.equal((rpcSource.match(/return await invoke\(\)/g) || []).length, 1,
    'the Kernel RPC wrapper must invoke a write only once');
assert.match(services, /fetch\('\/api\/petal\/setPetalEnabled'[\s\S]*packageName: 'siyuan-plugin-task-horizon'[\s\S]*enabled: true[\s\S]*app: appID/, 'field recovery must restart only the current Task Horizon Kernel session');
assert.match(services, /async function __tmThrowAfterKernelSessionRecovery\(callName\)[\s\S]*await __tmRecoverTaskHorizonKernelSession\(\)[\s\S]*KERNEL_SESSION_RECOVERED/,
    'field recovery must require a new user write after restarting the stale Kernel session');
assert.match(services, /async function __tmCallTaskHorizonKernelRpc\(name, \.\.\.args\)[\s\S]*__tmIsKernelSessionAuthError\(error\)[\s\S]*__tmThrowAfterKernelSessionRecovery\(methodName\)/,
    'field RPC may recover the session but must require a new user write');
assert.match(gatewaySource, /__tmIsKernelSessionAuthError\(error\)[\s\S]*__tmThrowAfterKernelSessionRecovery\('taskHorizonMutateTask'\)/,
    'a stale Kernel JWT wrapped in a failed mutation receipt must use the same recovery coordinator');
assert.equal((gatewaySource.match(/__tmCallTaskHorizonKernelRpc\('taskHorizonMutateTask', command\)/g) || []).length, 1,
    'receipt recovery must not replay a task mutation');
assert.match(persistSource, /__tmExecuteTaskCommandGateway\(\{[\s\S]*action: 'attrs'[\s\S]*taskID: taskId[\s\S]*attrs/,
    'task date and metadata persistence must use the sole Kernel task-command gateway');
assert.doesNotMatch(persistSource, /taskHorizonPersistUiTaskAttrs|\/api\/attr\/setBlockAttrs/,
    'field persistence must not bypass or retain a second task writer');
assert.doesNotMatch(persistSource, /retryDelayMs|for \(let i = 0; i < 3/,
    'direct attribute persistence must not retry a failed write');
assert.match(workbench, /typeof globalThis\.__tmRecoverTaskHorizonKernelSession === 'function'[\s\S]*return await globalThis\.__tmRecoverTaskHorizonKernelSession\(\)/, 'AI and task fields must share one Kernel recovery coordinator');

async function verifyReceiptRecoveryDoesNotReplayMutation() {
    let rpcCalls = 0;
    let recoveryCalls = 0;
    let receipt = {
        outcome: 'unknown',
        error: { code: 'STORAGE_ERROR', message: 'Auth failed [session]' },
    };
    const context = {
        __tmCallTaskHorizonKernelRpc: async () => {
            rpcCalls += 1;
            return {
                available: true,
                data: receipt,
            };
        },
        __tmRequireKernelGatewayForTaskMutation: () => {},
        __tmIsKernelSessionAuthError: (error) => error?.message === 'Auth failed [session]',
        __tmThrowAfterKernelSessionRecovery: async () => {
            recoveryCalls += 1;
            const error = new Error('任务工具会话已恢复，请重试刚才的操作');
            error.code = 'KERNEL_SESSION_RECOVERED';
            throw error;
        },
    };
    vm.runInNewContext(gatewaySource + '\nthis.executeGateway = __tmExecuteTaskCommandGateway;', context);
    await assert.rejects(
        context.executeGateway({ action: 'move', taskID: 'task-a' }, '任务移动'),
        (error) => error?.code === 'KERNEL_SESSION_RECOVERED',
    );
    assert.equal(rpcCalls, 1, 'a failed move receipt must not replay the mutation');
    assert.equal(recoveryCalls, 1, 'a failed move receipt must trigger one recovery');

    receipt = {
        outcome: 'conflict',
        error: { code: 'CONFLICT', message: '目标位置已经变化' },
    };
    await assert.rejects(
        context.executeGateway({ action: 'move', taskID: 'task-a' }, '任务移动'),
        /目标位置已经变化/,
    );
    assert.equal(rpcCalls, 2, 'an ordinary failed receipt must still execute only once');
    assert.equal(recoveryCalls, 1, 'an ordinary failed receipt must not recover the Kernel session');
}

verifyReceiptRecoveryDoesNotReplayMutation().then(() => {
    console.log('task field Kernel auth recovery contract tests passed');
}).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
