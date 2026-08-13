'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'src/task-horizon/main/20-api-and-runtime-services.js'), 'utf8');
const createRuntime = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/53b-task-create-and-quick-add-runtime.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/task-horizon/manifest.main.json'), 'utf8'));
const runtime = manifest.scripts.map((relativePath) => (
    fs.readFileSync(path.join(root, 'src/task-horizon', relativePath), 'utf8')
)).join('\n');

function extractFunction(source, name) {
    const asyncStart = source.indexOf(`async function ${name}(`);
    const start = asyncStart >= 0 ? asyncStart : source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `${name} must exist`);
    const signatureEnd = source.indexOf(')', start);
    const bodyStart = source.indexOf('{', signatureEnd);
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] !== '}') continue;
        depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`Unable to extract ${name}`);
}

const enqueue = extractFunction(api, '__tmEnqueueQueuedOp');
const simpleRunner = extractFunction(api, '__tmRunSimpleMutation');

assert.equal(manifest.scripts.includes('main/19-legacy-outbox-compat.js'), false,
    'the old durable outbox compatibility module must stay removed');
assert.doesNotMatch(api, /globalThis\.indexedDB|localStorage\.setItem\(__TM_OP_QUEUE_STORAGE_KEY/,
    'task writes must not open or synchronously persist a durable browser queue');
assert.doesNotMatch(api, /__tmHydrateOpQueue|__tmScheduleOpQueueDrain|__tmDrainOpQueue|__tmRunQueuedOp|__tmVerifyQueuedOpCommit/,
    'legacy durable hydration, replay, verification, and drain code must be deleted');
assert.doesNotMatch(api, /__tmPersistQueuedOp|__tmMarkQueuedOpPersistenceDirty|navigator\.locks/,
    'one-shot mutations must not retain persistence or cross-window lock shims');
assert.match(api, /const __TM_SIMPLE_MUTATION_TYPES = new Set\([\s\S]*'taskLifecycle'/,
    'lifecycle writes must use the same one-shot mutation service');
assert.match(api, /const __tmActiveMutations = new Map\(\)/,
    'pending projections and barriers must use the live mutation registry');
assert.match(enqueue, /__tmShouldUseSimpleMutationService\(op\)[\s\S]*return __tmEnqueueSimpleMutation\(op, options\)/);
assert.match(enqueue, /未支持的一次性任务操作/);
assert.doesNotMatch(simpleRunner, /OutboxStorage|__tmScheduleOpQueueDrain|__tmHydrateOpQueue/);
assert.doesNotMatch(createRuntime, /__tmPersistNewTaskAttrsWithRetry|for\s*\([^)]*;[^)]*<\s*5[^)]*\)[\s\S]{0,500}patchTask\(/,
    'task creation compatibility paths must not retry a failed attribute write');
assert.match(createRuntime, /async function __tmPersistNewTaskAttrsOnce\(/,
    'non-atomic compatibility imports must still use the one-shot mutation service');
assert.match(simpleRunner, /__tmRunInTaskWriterContext/);
assert.match(simpleRunner, /__tmRollbackQueuedOp\(op\)/);
assert.match(api, /globalThis\.__tmTaskMutations = mutationService/,
    'runtime writes must expose exactly one live mutation service');
assert.doesNotMatch(runtime, /__tmTaskOutbox|__tmTaskHorizonOutbox|__tmRequireTaskOutbox|__tmReportTaskOutboxFailure/,
    'runtime modules must not retain old outbox globals or compatibility fallbacks');
assert.doesNotMatch(runtime, /\bOutbox\b|\boutbox\b/,
    'runtime naming must describe live mutations rather than the removed durable outbox');
assert.doesNotMatch(runtime, /__tmOpQueue|__tmReplayQueuedOpOptimisticState/,
    'reads must not depend on a deleted queue or replay hook');

console.log('one-shot mutation service contract tests passed');
