'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'task-horizon', 'main', '10-stores-rules-and-cache.js'),
    'utf8',
);
const start = source.indexOf('const __TM_TASK_QUERY_CACHE_MAX_ENTRIES');
const end = source.indexOf('    const __tmDocExpandCache', start);
assert.ok(start >= 0 && end > start, 'task query cache helpers must remain extractable');

const context = vm.createContext({ console, Date, Map, Set });
vm.runInContext(`${source.slice(start, end)}
globalThis.cache = __tmTasksQueryCache;
globalThis.getCache = __tmGetTaskQueryCache;
globalThis.rememberCache = __tmRememberTaskQueryCache;`, context);

const createEntry = (taskCount, options = {}) => ({
    t: options.t || Date.now(),
    ttl: options.ttl || 60000,
    v: { tasks: Array.from({ length: taskCount }, () => ({})) },
    docIdSet: new Set(options.docIds || []),
});

for (let index = 0; index < 18; index += 1) {
    context.rememberCache(`lru-${index}`, createEntry(1));
}
assert.equal(context.cache.size, 18);
assert.ok(context.getCache('lru-0', 60000));
context.rememberCache('lru-18', createEntry(1));
assert.equal(context.cache.size, 18, 'cache entry count must stay bounded');
assert.equal(context.cache.has('lru-1'), false, 'least recently used entry must be evicted');
assert.equal(context.cache.has('lru-0'), true, 'cache reads must refresh LRU order');

context.cache.clear();
for (let index = 0; index < 4; index += 1) {
    context.rememberCache(`weight-${index}`, createEntry(9000));
}
const totalWeight = Array.from(context.cache.values())
    .reduce((sum, entry) => sum + Number(entry.weight || 0), 0);
assert.ok(totalWeight <= 30000, 'task query cache total result weight must stay within budget');
assert.equal(context.cache.size, 3);

context.rememberCache('oversized', createEntry(30001));
assert.equal(context.cache.has('oversized'), false, 'an oversized result must not enter the cache');

context.rememberCache('expired', createEntry(1, { t: Date.now() - 1000, ttl: 10 }));
assert.equal(context.getCache('expired', 10), null);
assert.equal(context.cache.has('expired'), false, 'expired entries must be removed on read');

console.log('task query cache budget contract tests passed');
