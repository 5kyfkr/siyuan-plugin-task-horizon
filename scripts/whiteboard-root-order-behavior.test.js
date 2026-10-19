'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const source = fs.readFileSync(path.join(__dirname, '../src/task-horizon/main/render/44-render-whiteboard-body.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(source.slice(0, source.indexOf('    function __tmBuildWhiteboardStreamGroupCards')), context);

// Original stable array algorithm is the behavioral oracle, including cycles,
// duplicate edges, and equal-order roots that become ready at different times.
function reference(roots, links, order) {
    const set = new Set(roots), indeg = new Map(roots.map(id => [id, 0])), adj = new Map(roots.map(id => [id, []])), edges = new Set();
    for (const link of links) {
        const from = String(link.from || '').trim(), to = String(link.to || '').trim(), key = `${from}->${to}`;
        if (!set.has(from) || !set.has(to) || from === to || edges.has(key)) continue;
        edges.add(key); adj.get(from).push(to); indeg.set(to, indeg.get(to) + 1);
    }
    const queue = roots.filter(id => !indeg.get(id)).sort((a, b) => order(a) - order(b)), out = [];
    while (queue.length) {
        const id = queue.shift();
        if (!id || out.includes(id)) continue;
        out.push(id);
        for (const to of adj.get(id)) {
            indeg.set(to, indeg.get(to) - 1);
            if (!indeg.get(to)) { queue.push(to); queue.sort((a, b) => order(a) - order(b)); }
        }
    }
    return out.concat(roots.filter(id => !out.includes(id)).sort((a, b) => order(a) - order(b)));
}
let seed = 42;
const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
for (let test = 0; test < 250; test++) {
    const roots = Array.from({ length: 10 + random(80) }, (_, i) => `task-${i}`);
    const rank = new Map(roots.map(id => [id, random(6)]));
    const order = id => rank.get(id);
    roots.sort((a, b) => order(a) - order(b));
    const links = Array.from({ length: random(160) }, () => ({ from: roots[random(roots.length)], to: roots[random(roots.length)] }));
    links.push({ from: 'outside', to: roots[0] }, ...links.slice(0, 4));
    assert.deepEqual(Array.from(context.__tmOrderWhiteboardRoots(roots, links, order)), reference(roots, links, order));
}
const roots = Array.from({ length: 10000 }, (_, i) => String(i));
const links = roots.slice(1).map(id => ({ from: '0', to: id }));
let reads = 0;
const start = performance.now();
const ordered = context.__tmOrderWhiteboardRoots(roots, links, id => { reads++; return Number(id); });
assert.deepEqual(Array.from(ordered), roots);
assert.ok(reads < roots.length * 3, `ordering keys must be read a bounded number of times (${reads})`);
console.log(`whiteboard root order: 250 parity cases passed; 10k roots/edges ${(performance.now() - start).toFixed(1)}ms`);
