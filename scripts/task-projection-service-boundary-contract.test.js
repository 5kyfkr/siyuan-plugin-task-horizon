'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const manifest = JSON.parse(read('src/task-horizon/manifest.main.json'));
const serviceSource = read('src/task-horizon/main/35-task-projection-service.js');
const projectionRuntimeSource = read('src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js');
const sourceFiles = fs.readdirSync(path.join(root, 'src/task-horizon/main'), { recursive: true })
    .filter((relativePath) => String(relativePath).endsWith('.js'))
    .map((relativePath) => path.join('src/task-horizon/main', relativePath).replace(/\\/g, '/'));

assert.ok(manifest.scripts.includes('main/35-task-projection-service.js'),
    'ProjectionService must be loaded with the main runtime');
assert.ok(
    manifest.scripts.indexOf('main/35-task-projection-service.js')
        > manifest.scripts.indexOf('main/34-task-projection-engine.js'),
    'ProjectionService must load after ProjectionEngine');
assert.ok(
    manifest.scripts.indexOf('main/35-task-projection-service.js')
        < manifest.scripts.indexOf('main/task-runtime/51-whiteboard-and-link-runtime.js'),
    'view refresh runtime must see the ProjectionService');

const directCallFiles = sourceFiles.filter((relativePath) => {
    const source = read(relativePath);
    return /\bapplyFilters\(\)/.test(source);
});
assert.deepEqual(directCallFiles.sort(), [
    'src/task-horizon/main/30-dialogs-and-ui-foundation.js',
    'src/task-horizon/main/35-task-projection-service.js',
], 'only the calculator definition and ProjectionService may reference applyFilters directly');

let filtersApplied = 0;
const context = {
    performance: { now: () => 1 },
    applyFilters: () => { filtersApplied += 1; },
    state: {},
};
context.globalThis = context;
vm.runInNewContext(serviceSource, context, { filename: '35-task-projection-service.js' });
const service = context.__tmProjectionService;
assert.ok(service, 'ProjectionService must be exported');

const immediate = service.recomputeNow({ reason: 'required-before-render' });
assert.equal(immediate.applied, true, 'synchronous projection must report successful calculation');
assert.equal(filtersApplied, 1, 'synchronous projection must calculate immediately');
assert.equal(service.getGeneration(), immediate.generation, 'each completed calculation must advance the projection generation');

const projectionError = new Error('projection failed');
const warnings = [];
const failureContext = {
    applyFilters: () => { throw projectionError; },
    console: { warn: (...args) => warnings.push(args) },
    state: {},
};
failureContext.globalThis = failureContext;
vm.runInNewContext(serviceSource, failureContext, { filename: '35-task-projection-service.js' });
const failed = failureContext.__tmProjectionService.recomputeNow({ reason: 'contract-failure' });
assert.equal(failed.applied, false, 'a failed projection must remain distinguishable from an applied generation');
assert.equal(failed.error, projectionError, 'the projection result must expose the caught error to its caller');
assert.equal(warnings[0]?.[0], '[task-horizon] task-projection-failed', 'projection failures must remain observable');
assert.match(
    projectionRuntimeSource,
    /const projectionResult = __tmRecomputeTaskProjection\([\s\S]*filtersApplied = projectionResult\?\.applied === true;/,
    'projection batches must treat a caught calculation failure as unapplied so fallback refresh reruns filters',
);

console.log('task projection service boundary contract tests passed');
