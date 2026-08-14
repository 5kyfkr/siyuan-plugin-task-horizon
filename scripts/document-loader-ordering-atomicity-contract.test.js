const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(
    __dirname,
    '../src/task-horizon/main/task-runtime/53c-document-loader-runtime.js',
), 'utf8');

function extractFunction(name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `${name} must exist`);
    const bodyStart = source.indexOf('{', source.indexOf(')', start));
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] !== '}') continue;
        depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`Unable to extract ${name}`);
}

const loadSelectedDocuments = extractFunction('loadSelectedDocuments');
const flowRequirement = loadSelectedDocuments.indexOf(
    'const needFlowRank = forceSyncFlowRank || enhanceLoadPlan0.needFlowRank;',
);
const initialEnhanceFetch = loadSelectedDocuments.indexOf('needFlow: needFlowRank,', flowRequirement);
const taskTreeCommit = loadSelectedDocuments.indexOf('state.taskTree = __tmSortDocEntriesByPinned(', initialEnhanceFetch);
const deferredEnhanceStart = loadSelectedDocuments.indexOf('if (deferH2Enhance && taskIds0.length > 0)', taskTreeCommit);
const deferredEnhanceEnd = loadSelectedDocuments.indexOf('if (forceFreshTasks && !loadBudget.enabled)', deferredEnhanceStart);

assert.ok(flowRequirement >= 0, 'the loader must derive whether document flow ordering is required');
assert.ok(initialEnhanceFetch > flowRequirement,
    'the initial enhancement request must fetch every required document flow rank');
assert.ok(taskTreeCommit > initialEnhanceFetch,
    'the shared task tree must not be committed before flow-dependent ordering is available');
assert.ok(deferredEnhanceStart > taskTreeCommit && deferredEnhanceEnd > deferredEnhanceStart,
    'only optional H2 metadata may be enhanced after the initial task tree commit');

const deferredEnhance = loadSelectedDocuments.slice(deferredEnhanceStart, deferredEnhanceEnd);
assert.match(deferredEnhance, /needH2:\s*deferH2Enhance,[\s\S]*needFlow:\s*false/,
    'deferred enhancement must be H2-only');
assert.doesNotMatch(deferredEnhance, /__tmApplyResolvedFlowRankIfNeeded|__tmReorderLoadedDocsByResolvedFlow/,
    'deferred enhancement must never mutate flow rank or reorder the shared task tree');
assert.doesNotMatch(loadSelectedDocuments, /deferFlowEnhance|syncFlowBeforeFirstRender/,
    'the loader must have one atomic flow-ordering path');

console.log('document loader ordering atomicity contract tests passed');
