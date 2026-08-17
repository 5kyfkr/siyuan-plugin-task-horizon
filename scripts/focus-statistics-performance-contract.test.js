'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'src/task-horizon/main/36-focus-statistics-service.js'), 'utf8');
const tasks = new Map(Array.from({ length: 50000 }, (_, index) => {
    const id = `20260101000000-${String(index).padStart(7, '0')}`;
    return [id, { id, content: `Task ${index}`, docId: `doc-${index % 100}` }];
}));
const associatedIDs = Array.from(tasks.keys()).slice(100, 110);
let flatReads = 0;
let projectedSnapshot = null;

const context = vm.createContext({
    console,
    Error,
    Map,
    Number,
    Object,
    Promise,
    Set,
    String,
    clearTimeout,
    setTimeout,
    globalThis: null,
    __tmCallTaskHorizonKernelRpc: async (_name, raw, _options, snapshot) => {
        projectedSnapshot = snapshot;
        return { available: true, data: { contractVersion: 2, totals: raw.totals, tasks: snapshot.tasks } };
    },
});
context.globalThis = context;
context.__tmTaskStore = {
    captureRead: () => ({ revision: 1 }),
    isReadCurrent: () => true,
    revision: () => 1,
    listFlat: () => {
        flatReads += 1;
        return Array.from(tasks.values());
    },
    listPending: () => [],
    getProjected: (id) => tasks.get(id),
    get: (id) => tasks.get(id),
    getAliases: (id) => [id, `alias-${id}`],
    resolveId: (id) => id,
};
context.__dockTomato = {
    stats: {
        contractVersion: 2,
        queryFocus: async () => ({
            contractVersion: 2,
            totals: { focusSec: 6000 },
            associations: associatedIDs.map((id, index) => ({ candidateIds: [id], focusSec: 600 + index, buckets: [] })),
        }),
    },
};
vm.runInContext(source, context);

(async () => {
    const started = Date.now();
    const result = await context.__tmFocusStatisticsService.queryFocus({
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-02T00:00:00.000Z',
        bucket: 'none',
    });
    const elapsedMs = Date.now() - started;
    assert.equal(result.contractVersion, 2);
    assert.equal(flatReads, 0, 'focus projection must not enumerate the complete TaskStore');
    assert.equal(projectedSnapshot.tasks.length, associatedIDs.length);
    assert.ok(Buffer.byteLength(JSON.stringify(projectedSnapshot)) < 64 * 1024);
    assert.ok(elapsedMs < 1000, `selective focus snapshot is unexpectedly slow: ${elapsedMs}ms`);
    console.log(`focus statistics performance contract tests passed (${elapsedMs}ms)`);
})().catch((error) => {
    process.nextTick(() => { throw error; });
});
