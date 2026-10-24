'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, 'src/task-horizon/main', file), 'utf8');
const runtime = read('task-runtime/51-whiteboard-and-link-runtime.js');
const interactions = read('render/49-render-whiteboard-interactions.js');
const context = vm.createContext({});
vm.runInContext(runtime.slice(runtime.indexOf('    function __tmCollectWhiteboardOutlineReachable('), runtime.indexOf('    function __tmCollectWhiteboardOutlineConnectedComponent('))
    + interactions.slice(0, interactions.indexOf('    let __tmWhiteboardTraversalCache')), context);
const run = (start, pairs, allowed) => {
    context.start = start;
    context.pairs = pairs;
    context.allowed = allowed || [...new Set(pairs.flat().concat(start))];
    return vm.runInContext(`(() => {
        const model = __tmBuildWhiteboardTraversalModel(start, pairs.map(([from, to]) => ({from, to})), new Set(allowed));
        return { tasks: [...model.taskIds].sort(), edges: [...model.linkKeys].sort() };
    })()`, context);
};
const plain = value => JSON.parse(JSON.stringify(value));

const branches = [['A','B'],['B','C'],['C','E'],['D','B'],['G','B'],['A','F'],['X','C'],['H','D'],['C','I']];
assert.deepEqual(plain(run('B', branches)), {
    tasks: ['A','B','C','D','E','G','H','I'],
    edges: ['A->B','B->C','C->E','C->I','D->B','G->B','H->D'],
}, 'all predecessor and successor branches must be included without changing direction at a neighbor');

assert.deepEqual(plain(run('B', [['A','B'],['B','C'],['C','B'],['C','E'],['A','F'],['X','C'],['Y','Z'],['Z','Y']])), {
    tasks: ['A','B','C','E','X'],
    edges: ['A->B','B->C','C->B','C->E','X->C'],
}, 'cycles must terminate, retain reachable predecessors, and leave disconnected cycles out');

assert.deepEqual(plain(run('B', [['B','hidden'],['hidden','C'],['D','B']], ['B','C','D'])), {
    tasks: ['B','D'], edges: ['D->B'],
}, 'tasks outside the current board must not bridge separate visible branches');
assert.deepEqual(plain(run('B', [['A','B'],['A','B'],['B','B'],['X','Y']])), {
    tasks: ['A','B'], edges: ['A->B'],
}, 'duplicate and self links must not add duplicate results');
assert.deepEqual(plain(run('B', [])), {tasks:['B'],edges:[]}, 'an isolated card has no traversable links');

const chain = Array.from({length:199}, (_,i) => [String(i),String(i+1)]);
const large = run('100', chain);
assert.equal(large.tasks.length, 200, 'whiteboard traversal must not inherit the outline helper default of 48 nodes');
assert.equal(large.edges.length, 199);
console.log('whiteboard directional traversal behavior tests passed');
