const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
    path.join(root, 'src/task-horizon/main/task-runtime/53b-task-create-and-quick-add-runtime.js'),
    'utf8'
);

function extractFunction(name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `${name} must exist`);
    const bodyStart = source.indexOf('{', start);
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        else if (source[index] === '}') depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`Unable to extract ${name}`);
}

const scopeHelper = extractFunction('__tmIsDocInCurrentTaskScope');
const runScopeCheck = (state, docId) => vm.runInNewContext(
    `${scopeHelper}; __tmIsDocInCurrentTaskScope(docId);`,
    { state, docId }
);

assert.equal(runScopeCheck({ __tmLoadedDocIdsForTasks: ['doc-a'], taskTree: [] }, 'doc-a'), true);
assert.equal(runScopeCheck({ __tmLoadedDocIdsForTasks: ['doc-a'], taskTree: [{ id: 'doc-b' }] }, 'doc-b'), false);
assert.equal(runScopeCheck({ __tmLoadedDocIdsForTasks: [], taskTree: [{ id: 'doc-b' }] }, 'doc-b'), true);

assert.match(
    source,
    /function __tmCanUseLightweightCreateProjection\(task\)[\s\S]*?if \(!__tmIsDocInCurrentTaskScope\(docId\)\) return false;/,
    'lightweight creation projection must reject documents outside the loaded group scope'
);
assert.match(
    source,
    /const projectIntoCurrentScope = __tmIsDocInCurrentTaskScope\(docId\);[\s\S]*?if \(projectIntoCurrentScope\) \{[\s\S]*?__tmInsertTaskIntoDocLocal\(nextTask/,
    'optimistic creation must only inject the task and document tab into the current group scope'
);

console.log('task create document-group scope contract tests passed');
