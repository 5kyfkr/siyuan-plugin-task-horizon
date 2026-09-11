'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/task-horizon/main/10-stores-rules-and-cache.js'), 'utf8');
const extract = (name) => {
    const start = source.search(new RegExp(`    (?:async )?function ${name}\\(`));
    assert.ok(start >= 0, `missing function ${name}`);
    const end = source.indexOf('\n    }', start);
    assert.ok(end > start, `missing end of ${name}`);
    return source.slice(start, end + 6);
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const context = vm.createContext({
    console, Date, Map, Set, WeakMap, WeakSet, TextEncoder, Uint8Array,
    __TM_TASK_SNAPSHOT_VERSION: 4, __TM_TASK_SNAPSHOT_MAX_AGE_MS: 3 * 86400000,
    __TM_TASK_SNAPSHOT_MAX_ENTRIES: 20, __TM_TASK_SNAPSHOT_MAX_BYTES: 20 * 1024 * 1024,
    __TM_TASK_SNAPSHOT_MAX_SINGLE_BYTES: 20 * 1024 * 1024,
    __TM_TASK_REPEAT_RULE_ATTR: 'custom-repeat-rule', __TM_TASK_REPEAT_STATE_ATTR: 'custom-repeat-state',
    __TM_TASK_REPEAT_HISTORY_ATTR: 'custom-repeat-history',
    __tmIsLikelyBlockId: (value) => /^\d{14}-[a-z0-9]{7}$/.test(value),
    __tmGetTaskMetaAttrReadKeys: () => [],
    __tmNormalizeTaskRepeatRule: (value) => value || { enabled: false, type: 'none' },
    __tmNormalizeTaskRepeatState: (value) => value || {}, __tmNormalizeTaskRepeatHistory: (value) => value || [],
    __tmNormalizeTaskCustomFieldValues: (definition, values) => values,
});
const helperStart = source.indexOf('    function __tmCloneTaskSnapshotValue(');
const helperEnd = source.indexOf('    function __tmRememberSmallCache(', helperStart);
const helpers = source.slice(helperStart, helperEnd);
const functions = ['__tmEstimateJsonByteSize', '__tmParseUpdatedAtNumber', '__tmNormalizeTaskSnapshotDocIds',
    '__tmBuildTaskSnapshotScopeKey', '__tmIsUsableTaskSnapshot', '__tmIsPreservedTaskSnapshot',
    '__tmGetPreservedTaskSnapshotBucket', '__tmSelectPreservedTaskSnapshotCandidates',
    '__tmCreateEmptyTaskSnapshotStore', '__tmGetTaskSnapshotStoreUpdatedAt', '__tmBuildTaskSnapshotStore',
    '__tmValidateTaskSnapshotForScope', '__tmLoadTaskSnapshotForScope', '__tmBuildTaskSnapshotPersistSignature',
    '__tmTaskSnapshotStoreNeedsCompaction', '__tmWithDerivedCacheWriteLock',
    '__tmWithTaskSnapshotWriteLock', '__tmSchedulePersistTaskSnapshot', '__tmLoadTaskSnapshotStore',
    '__tmFetchTaskSnapshotDocEntryForCreatedTask'];
vm.runInContext(helpers + functions.map(extract).join('\n'), context);

async function main() {
    const fieldValues = {
        content: '任务正文', markdown: '* [X] 任务正文', done: true, priority: 'high', customStatus: 'doing',
        startDate: '2026-09-11', completionTime: '2026-09-12', customTime: '2026-09-13',
        taskCompleteAt: '2026-09-11 10:00:00', taskDateColor: '#00ff00', duration: '45', remark: '备注',
        pinned: true, milestone: true, allDayBottom: true,
        tomatoMinutes: '30', tomatoHours: '0.5', tomatoCount: '2', tomatoEstimateCount: '4',
        repeatRule: { enabled: true, type: 'daily' }, repeatState: { nextDate: '2026-09-12' },
        repeatHistory: [{ completedAt: '2026-09-11' }], customFieldValues: { project: 'alpha' },
        attachments: ['assets/test.png'], attachmentMeta: [{ path: 'assets/test.png', name: 'Test' }],
        parentTaskId: '20260905000000-0000099', taskMarker: 'X', root_id: '20260905000000-0000001',
        docId: '20260905000000-0000001', h2: 'Heading', h2Id: 'heading-1', h2Path: 'Heading',
        h2Sort: '1', h2Created: '20260911090000', h2Rank: 1, docSeq: 2, blockPath: '0001', blockSort: '001',
    };
    const fieldTask = { id: '20260905000000-0000002', ...fieldValues };
    const fieldTaskBefore = clone(fieldTask);
    const fieldRoundTrip = context.__tmHydrateTaskSnapshotTaskForRuntime(
        context.__tmCompactTaskSnapshotTaskForStore(fieldTask));
    for (const [field, value] of Object.entries(fieldValues)) {
        assert.deepEqual(clone(fieldRoundTrip[field]), value, 'snapshot round-trip must preserve ' + field);
    }
    assert.deepEqual(fieldTask, fieldTaskBefore, 'snapshot packing must not mutate live fields');
    const now = Date.now();
    const document = {
        id: '20260905000000-0000001', name: '任务文档', tasks: [{
            id: '20260905000000-0000002', content: '检查任务', custom_priority: 'high',
            start_date: '2026-09-05', children: [],
        }],
    };
    const legacy = {
        version: 4, createdAt: now, updatedAt: now, groupId: 'group-0', docIds: [document.id],
        scopeKey: context.__tmBuildTaskSnapshotScopeKey([document.id], 'group-0'),
        taskTree: [document], otherBlocks: [{ id: '20260905000000-0000003', content: '辅助块' }],
    };
    const legacyBefore = clone(legacy);
    const packed = context.__tmBuildTaskSnapshotStore(legacy);
    assert.equal(packed.order.length, 1);
    assert.equal(packed.snapshots[legacy.scopeKey].taskTree, undefined);
    assert.deepEqual(clone(legacy), legacyBefore, 'packing must not mutate runtime data');
    const docKey = packed.snapshots[legacy.scopeKey].docDataKeys[0];
    const pooledDoc = packed.docs[docKey];
    for (let index = 1; index < 20; index += 1) {
        const groupId = `group-${index}`;
        const scopeKey = context.__tmBuildTaskSnapshotScopeKey([document.id], groupId);
        packed.snapshots[scopeKey] = { ...packed.snapshots[legacy.scopeKey], groupId, scopeKey };
    }
    const packedBefore = clone(packed);
    let clonedValues = 0;
    let compactedTasks = 0;
    let pooledDocEstimates = 0;
    const originalClone = context.__tmCloneTaskSnapshotValue;
    const originalCompact = context.__tmCompactTaskSnapshotTaskForStore;
    const originalEstimate = context.__tmEstimateJsonByteSize;
    context.__tmCloneTaskSnapshotValue = (...args) => { clonedValues += 1; return originalClone(...args); };
    context.__tmCompactTaskSnapshotTaskForStore = (...args) => { compactedTasks += 1; return originalCompact(...args); };
    context.__tmEstimateJsonByteSize = (value) => {
        if (value === pooledDoc) pooledDocEstimates += 1;
        return originalEstimate(value);
    };
    const restored = context.__tmBuildTaskSnapshotStore(packed);
    assert.equal(restored.order.length, 20);
    assert.equal(clonedValues, 0, 'startup must not hydrate or clone every scope');
    assert.equal(compactedTasks, 0, 'current-format pools must not be repacked on startup');
    assert.equal(pooledDocEstimates, 1, 'shared document bytes must only be measured once per store build');
    assert.equal(restored.docs[docKey], pooledDoc);
    assert.equal(Object.keys(restored.docs).length, 1);
    assert.deepEqual(clone(packed), packedBefore);

    context.__tmTaskSnapshotStoreCache = restored;
    const scope = await context.__tmLoadTaskSnapshotForScope({ cachedOnly: true, docIds: [document.id], groupId: 'group-0' });
    assert.ok(scope);
    assert.equal(scope.taskTree[0].tasks[0].priority, 'high');
    assert.equal(scope.taskTree[0].tasks[0].start_date, '2026-09-05');
    scope.taskTree[0].tasks[0].content = 'local edit';
    scope.otherBlocks[0].content = 'local auxiliary edit';
    assert.deepEqual(clone(restored.docs[docKey]), packedBefore.docs[docKey], 'materialized tasks must not alias the packed cache');
    assert.deepEqual(clone(restored.otherBlockSets), packedBefore.otherBlockSets);
    assert.equal(compactedTasks, 0);

    const corrupt = clone(packed);
    corrupt.snapshots[legacy.scopeKey].docDataKeys.push('missing');
    const rejected = context.__tmBuildTaskSnapshotStore(corrupt);
    assert.equal(rejected.snapshots[legacy.scopeKey], undefined, 'a missing pooled doc must reject the whole scope, not restore a partial tree');
    const missingOther = clone(packed);
    missingOther.snapshots[legacy.scopeKey].otherBlockDataKey = 'missing';
    assert.equal(context.__tmBuildTaskSnapshotStore(missingOther).snapshots[legacy.scopeKey], undefined);
    const preserved = clone(packed);
    preserved.snapshots[legacy.scopeKey].preserve = true;
    preserved.snapshots.newer = {
        ...preserved.snapshots[legacy.scopeKey], scopeKey: 'newer', updatedAt: now + 1, docDataKeys: ['missing'],
    };
    assert.ok(context.__tmBuildTaskSnapshotStore(preserved).snapshots[legacy.scopeKey],
        'an invalid newer record must not displace the last valid preserved scope in the group');

    context.__TM_TASK_SNAPSHOT_MAX_BYTES = originalEstimate(restored) + 512;
    assert.equal(context.__tmBuildTaskSnapshotStore(packed).order.length, 20, 'shared payloads must not be charged repeatedly to the total budget');
    context.__TM_TASK_SNAPSHOT_MAX_BYTES = 1400;
    const bounded = context.__tmBuildTaskSnapshotStore(packed);
    assert.ok(originalEstimate(bounded) <= 1400, 'UTF-8 encoded store size must respect the total byte budget');
    assert.ok(bounded.order.length > 0 && bounded.order.length < 20);
    context.__TM_TASK_SNAPSHOT_MAX_BYTES = 20 * 1024 * 1024;
    context.__TM_TASK_SNAPSHOT_MAX_SINGLE_BYTES = 700;
    const oversized = clone(legacy);
    oversized.taskTree[0].tasks[0].content = '大'.repeat(2000);
    const rejectedLarge = context.__tmBuildTaskSnapshotStore(oversized);
    assert.equal(rejectedLarge.order.length, 0, 'single-scope limits must include pooled document bytes');
    assert.equal(Object.keys(rejectedLarge.docs).length, 0, 'rejected scopes must not leave orphaned pool payloads');
    context.__TM_TASK_SNAPSHOT_MAX_SINGLE_BYTES = 20 * 1024 * 1024;

    const expired = clone(legacy);
    expired.createdAt = now - 4 * 86400000;
    assert.equal(context.__tmBuildTaskSnapshotStore(expired).order.length, 0);
    expired.preserve = true;
    assert.equal(context.__tmBuildTaskSnapshotStore(expired).order.length, 1, 'preserved groups retain existing lifetime semantics');
    expired.version = 3;
    assert.equal(context.__tmBuildTaskSnapshotStore(expired).order.length, 0);
    const persistedSignature = context.__tmBuildTaskSnapshotPersistSignature(packed.snapshots[legacy.scopeKey], packed);
    const changedPool = clone(packed);
    changedPool.docs[docKey].tasks[0].taskDateColor = 'red';
    assert.notEqual(context.__tmBuildTaskSnapshotPersistSignature(changedPool.snapshots[legacy.scopeKey], changedPool), persistedSignature,
        'a field or pool change must affect the signature even if the timestamp and pool key do not change');
    await exerciseDocumentPatches(legacy);
    await exercisePersistence(legacy, packed);
    await exerciseDocumentReadFailures(legacy.taskTree[0].id);
    await exerciseLoadCost(legacy);
    console.log('task snapshot pool behavioral tests passed');
}

async function exerciseDocumentReadFailures(docId) {
    let result = { tasks: [] };
    let rejectRead = true;
    let revision = 0;
    let built = 0;
    let changeDuringBuild = false;
    Object.assign(context, {
        API: { getTasksByDocument: async () => { if (rejectRead) throw new Error('read failed'); return result; } },
        __tmTaskStore: { captureRead: () => ({ revision }), isReadCurrent: (token) => token.revision === revision },
        __tmBuildTaskIndexEntriesFromRows: async () => {
            built += 1;
            if (changeDuringBuild) revision += 1;
            return [{ id: docId }];
        },
        __tmBuildTaskTreeFromTaskIndexBlocks: () => [],
        __tmNormalizeDocAliasValue: (value) => value || '', __tmNormalizeDocIconValue: (value) => value || '',
    });
    assert.equal(await context.__tmFetchTaskSnapshotDocEntryForCreatedTask(docId), null);
    assert.equal(built, 0, 'failed reads must not create an empty authoritative document');
    rejectRead = false;
    result = { tasks: [], limitReached: 1 };
    assert.equal(await context.__tmFetchTaskSnapshotDocEntryForCreatedTask(docId), null);
    assert.equal(built, 0, 'truncated reads must not replace complete pooled documents');
    result = { tasks: [] };
    changeDuringBuild = true;
    assert.equal(await context.__tmFetchTaskSnapshotDocEntryForCreatedTask(docId), null, 'document enrichment must retain the original read token');
    changeDuringBuild = false;
    assert.equal((await context.__tmFetchTaskSnapshotDocEntryForCreatedTask(docId)).id, docId, 'confirmed empty documents remain valid');
}

async function exerciseDocumentPatches(legacy) {
    const firstDoc = clone(legacy.taskTree[0]);
    const secondDoc = { id: '20260905000000-0000010', name: 'unaffected', tasks: [] };
    const docIds = [firstDoc.id, secondDoc.id];
    const current = { ...clone(legacy), docIds, queryLimit: 20000, taskTree: [firstDoc, secondDoc],
        scopeKey: context.__tmBuildTaskSnapshotScopeKey(docIds, legacy.groupId),
        viewState: { ready: true }, viewStates: { list: {} }, customTaskOrderView: { ids: [] } };
    const packed = context.__tmBuildTaskSnapshotStore(current);
    for (let index = 1; index < 20; index += 1) {
        const groupId = `group-${index}`;
        const scopeKey = context.__tmBuildTaskSnapshotScopeKey(docIds, groupId);
        packed.snapshots[scopeKey] = { ...packed.snapshots[current.scopeKey], groupId, scopeKey };
    }
    const before = clone(packed);
    const untouchedKey = packed.snapshots[current.scopeKey].docDataKeys[1];
    const originalPack = context.__tmBuildTaskSnapshotRecordForStore;
    let packedDocs = 0;
    context.__tmBuildTaskSnapshotRecordForStore = (record, ...args) => {
        packedDocs += record.taskTree?.length || 0;
        return originalPack(record, ...args);
    };
    firstDoc.tasks[0].done = true;
    const options = { scopeKey: current.scopeKey, queryLimit: 20000 };
    const result = context.__tmPatchTaskSnapshotDocuments(packed, [firstDoc], options);
    assert.equal(result.affectedScopes.length, 20);
    assert.equal(packedDocs, 1, 'a changed document shared by twenty scopes is packed once');
    assert.equal(result.store.docs[untouchedKey], packed.docs[untouchedKey], 'untouched pool objects must retain identity');
    for (const record of Object.values(result.store.snapshots)) {
        assert.equal(record.docDataKeys[1], untouchedKey);
        assert.equal(record.createdAt, current.createdAt, 'a partial update must not renew the whole scope freshness');
        assert.equal(record.viewState, undefined);
        assert.equal(record.viewStates, undefined);
        assert.equal(record.customTaskOrderView, undefined);
    }
    assert.deepEqual(clone(packed), before, 'patching must not mutate the disk or memory source');
    const unchanged = context.__tmPatchTaskSnapshotDocuments(result.store, [firstDoc], options);
    assert.equal(unchanged.affectedScopes.length, 0);
    assert.equal(context.__tmPatchTaskSnapshotDocuments(packed, [firstDoc], { ...options, queryLimit: 500 }), null);
    const broken = clone(packed);
    delete broken.docs[untouchedKey];
    assert.equal(context.__tmPatchTaskSnapshotDocuments(broken, [firstDoc], options), null, 'missing pool references require full-scope recovery');
    const newer = clone(packed);
    newer.docs[newer.snapshots[current.scopeKey].docDataKeys[0]].docUpdated = '20260906000000';
    assert.equal(context.__tmPatchTaskSnapshotDocuments(newer, [firstDoc], options).stale, true, 'older documents must not overwrite newer disk data');
    const mismatch = clone(packed);
    const differentScope = Object.keys(mismatch.snapshots).find((key) => key !== current.scopeKey);
    mismatch.snapshots[differentScope].queryLimit = 500;
    const partial = context.__tmPatchTaskSnapshotDocuments(mismatch, [firstDoc], options);
    assert.equal(partial.store.snapshots[differentScope], mismatch.snapshots[differentScope], 'different query coverage must remain isolated');
    context.__tmBuildTaskSnapshotRecordForStore = originalPack;

    let disk = packed;
    let writes = 0;
    let failWrite = false;
    let onWrite = null;
    const timers = [];
    const idle = [];
    Object.assign(context, {
        SettingsStore: { data: { currentGroupId: current.groupId } },
        state: { taskTree: [firstDoc, secondDoc], activeDocId: 'all', __tmLoadedDocIdsForTasks: docIds },
        __TM_TASK_INDEX_QUERY_LIMIT: 20000, TASK_SNAPSHOT_FILE_PATH: 'snapshot.json',
        __tmDerivedCacheWriteTails: new Map(), __tmTaskSnapshotSaveGeneration: 0,
        __tmTaskSnapshotSaveTimer: null, __tmTaskSnapshotSaveInFlight: false,
        __tmTaskSnapshotPendingDocSaves: new Map(), __tmTaskSnapshotStoreCache: packed,
        setTimeout: (callback) => { timers.push(callback); return timers.length; }, clearTimeout: () => {},
        __tmScheduleIdleTask: (callback) => idle.push(callback),
        __tmGetHighPriorityInteractionWaitMs: () => 0, __tmGetExternalTaskTxQuietWaitMs: () => 0,
        __tmCanPersistTaskSnapshotProjection: () => true,
        __tmTaskStore: { captureRead: () => ({}), isReadCurrent: () => true },
        __tmBuildTaskSnapshotPayload: () => assert.fail('incremental save must not clone the full scope'),
        __tmReadDerivedCacheFile: async () => clone(disk),
        __tmWriteJsonFile: async (file, store) => {
            writes += 1;
            if (onWrite) { const callback = onWrite; onWrite = null; callback(); }
            if (failWrite) return false;
            disk = clone(store);
            return true;
        },
    });
    const schedule = (ids) => context.__tmSchedulePersistTaskSnapshot({ changedDocIds: ids, mergeLocalPatchesBeforeSave: false });
    const flush = async () => {
        while (timers.length) timers.shift()();
        while (idle.length) idle.shift()();
        const deadline = Date.now() + 5000;
        while (context.__tmTaskSnapshotSaveInFlight) {
            assert.ok(Date.now() < deadline);
            await new Promise((resolve) => setImmediate(resolve));
        }
    };
    secondDoc.name = 'also changed';
    schedule([firstDoc.id]);
    schedule([secondDoc.id]);
    await flush();
    assert.equal(writes, 1, 'rapid changes to two documents must share one save');
    const saved = context.__tmMaterializeTaskSnapshotRecord(disk.snapshots[current.scopeKey], disk);
    assert.equal(saved.taskTree[0].tasks[0].done, true);
    assert.equal(saved.taskTree[1].name, 'also changed');
    assert.equal(context.__tmTaskSnapshotPendingDocSaves.size, 0);
    firstDoc.tasks[0].done = false;
    failWrite = true;
    const lastDisk = clone(disk);
    const lastCache = context.__tmTaskSnapshotStoreCache;
    schedule([firstDoc.id]);
    await flush();
    assert.deepEqual(disk, lastDisk);
    assert.equal(context.__tmTaskSnapshotStoreCache, lastCache);
    assert.equal(context.__tmTaskSnapshotPendingDocSaves.size, 1, 'failed saves retain dirty document IDs');
    failWrite = false;
    secondDoc.name = 'retry together';
    schedule([secondDoc.id]);
    await flush();
    const recovered = context.__tmMaterializeTaskSnapshotRecord(disk.snapshots[current.scopeKey], disk);
    assert.equal(recovered.taskTree[0].tasks[0].done, false);
    assert.equal(recovered.taskTree[1].name, 'retry together');
    assert.equal(context.__tmTaskSnapshotPendingDocSaves.size, 0);
    firstDoc.tasks[0].done = true;
    onWrite = () => { secondDoc.name = 'arrived during write'; schedule([secondDoc.id]); };
    schedule([firstDoc.id]);
    await flush();
    assert.equal(context.__tmTaskSnapshotPendingDocSaves.size, 1, 'successful old saves cannot clear newer pending versions');
    await flush();
    const latest = context.__tmMaterializeTaskSnapshotRecord(disk.snapshots[current.scopeKey], disk);
    assert.equal(latest.taskTree[0].tasks[0].done, true);
    assert.equal(latest.taskTree[1].name, 'arrived during write');
    assert.equal(context.__tmTaskSnapshotPendingDocSaves.size, 0);
    console.log('incremental snapshot: 20 scopes, changed document packs=1, merged multi-document save=1');
}

async function exercisePersistence(legacy, packed) {
    let disk = clone(packed);
    let writes = 0;
    let failWrite = false;
    let failRead = false;
    let onRead = null;
    let revision = 0;
    let builds = 0;
    const buildStore = context.__tmBuildTaskSnapshotStore;
    context.__tmBuildTaskSnapshotStore = (...args) => { builds += 1; return buildStore(...args); };
    const timers = [];
    const idle = [];
    Object.assign(context, {
        SettingsStore: { data: { currentGroupId: legacy.groupId } },
        state: { taskTree: clone(legacy.taskTree), activeDocId: 'all', __tmLoadedDocIdsForTasks: legacy.docIds },
        __TM_TASK_INDEX_QUERY_LIMIT: 20000, TASK_SNAPSHOT_FILE_PATH: 'snapshot.json',
        __tmDerivedCacheWriteTails: new Map(), __tmTaskSnapshotSaveGeneration: 0,
        __tmTaskSnapshotSaveTimer: null, __tmTaskSnapshotSaveInFlight: false,
        __tmTaskSnapshotPendingDocSaves: new Map(),
        __tmTaskSnapshotStoreCache: null, __tmTaskSnapshotStoreLoadPromise: null, __tmTaskSnapshotStoreLoadedAt: 0,
        setTimeout: (callback) => { timers.push(callback); return timers.length; }, clearTimeout: () => {},
        __tmScheduleIdleTask: (callback) => idle.push(callback),
        __tmGetHighPriorityInteractionWaitMs: () => 0, __tmGetExternalTaskTxQuietWaitMs: () => 0,
        __tmCanPersistTaskSnapshotProjection: () => true,
        __tmTaskStore: { captureRead: () => ({ revision }), isReadCurrent: (token) => token.revision === revision },
        __tmBuildTaskSnapshotPayload: () => ({ ...clone(legacy), taskTree: clone(context.state.taskTree) }),
        __tmAttachTaskSnapshotViewState: (payload) => payload,
        __tmReadDerivedCacheFile: async () => {
            if (failRead) throw new Error('read failed');
            if (onRead) onRead();
            return clone(disk);
        },
        __tmWriteJsonFile: async (file, store) => {
            writes += 1;
            if (failWrite) return false;
            disk = clone(store);
            return true;
        },
        __tmPeekTaskSnapshotFileMeta: async () => null, __tmRememberTaskSnapshotFileMeta: () => {},
    });
    const persist = async () => {
        assert.equal(context.__tmSchedulePersistTaskSnapshot({ mergeLocalPatchesBeforeSave: false }), true);
        timers.shift()();
        idle.shift()();
        const deadline = Date.now() + 5000;
        while (context.__tmTaskSnapshotSaveInFlight) {
            assert.ok(Date.now() < deadline, 'snapshot persistence did not settle');
            await new Promise((resolve) => setImmediate(resolve));
        }
    };
    await persist();
    assert.equal(writes, 0, 'an unchanged disk scope must also deduplicate after restart without a window-local signature cache');
    assert.equal(builds, 0, 'unchanged scope persistence must skip whole-store validation and packing');
    context.state.taskTree[0].tasks[0].taskDateColor = 'red';
    await persist();
    assert.equal(writes, 1);
    assert.equal(builds, 1, 'changed scope persistence must build the store only once');
    await persist();
    assert.equal(writes, 1, 'unchanged payload and unchanged disk record should skip a duplicate write');
    context.state.taskTree[0].tasks[0].taskDateColor = 'blue';
    await persist();
    assert.equal(writes, 2, 'changing only task date color must be persisted');
    delete disk.snapshots[legacy.scopeKey];
    await persist();
    assert.equal(writes, 3, 'deduplication must not suppress recreation of a missing disk scope');
    assert.ok(disk.snapshots[legacy.scopeKey]);
    disk.snapshots[legacy.scopeKey].viewState = { externalChange: true };
    await persist();
    assert.equal(writes, 4, 'changed disk records must prevent deduplication');
    const changedKey = disk.snapshots[legacy.scopeKey].docDataKeys[0];
    disk.docs[changedKey].tasks[0].taskDateColor = 'external';
    await persist();
    assert.equal(writes, 5, 'deduplication must compare actual pooled data, not just its key');

    const beforeRevisionChange = writes;
    context.state.taskTree[0].tasks[0].taskDateColor = 'stale';
    onRead = () => {
        revision += 1;
        context.state.taskTree[0].tasks[0].taskDateColor = 'blue';
    };
    await persist();
    onRead = null;
    assert.equal(writes, beforeRevisionChange, 'a projection captured before an intervening task change must not be persisted');

    const cached = context.__tmTaskSnapshotStoreCache;
    const cachedBefore = clone(cached);
    const diskBefore = clone(disk);
    context.state.taskTree[0].tasks[0].content = 'new content';
    failWrite = true;
    await persist();
    assert.equal(context.__tmTaskSnapshotStoreCache, cached);
    assert.deepEqual(clone(cached), cachedBefore, 'failed snapshot writes must preserve the existing cache including pooled docs');
    assert.deepEqual(disk, diskBefore);
    failWrite = false;
    failRead = true;
    const beforeReadFailure = writes;
    await persist();
    assert.equal(writes, beforeReadFailure);
    assert.equal(await context.__tmLoadTaskSnapshotStore({ force: true }), cached);
    assert.deepEqual(clone(cached), cachedBefore);
    failRead = false;
    context.__TM_TASK_SNAPSHOT_MAX_SINGLE_BYTES = 100;
    await persist();
    assert.equal(writes, beforeReadFailure, 'an oversized replacement must not remove the last usable disk snapshot');
    assert.deepEqual(disk, diskBefore);
    context.__TM_TASK_SNAPSHOT_MAX_SINGLE_BYTES = 20 * 1024 * 1024;

    disk.docs.unused = { id: legacy.docIds[0], tasks: [], padding: 'x'.repeat(4096) };
    await context.__tmLoadTaskSnapshotStore({ force: true });
    assert.equal(idle.length, 1);
    disk.snapshots[legacy.scopeKey].viewState = { externalChangeWithoutTimestamp: true };
    await idle.shift()();
    assert.equal(disk.snapshots[legacy.scopeKey].viewState.externalChangeWithoutTimestamp, true,
        'delayed snapshot compaction must preserve changes even when updatedAt is unchanged');
    assert.equal(disk.docs.unused, undefined);
    context.__tmTaskSnapshotStoreCache = null;
    onRead = () => { context.__tmTaskSnapshotSaveGeneration += 1; };
    await context.__tmLoadTaskSnapshotStore({ force: true });
    onRead = null;
    assert.equal(context.__tmTaskSnapshotStoreCache, null, 'superseded loads must not publish old cache state');
    assert.equal(context.__tmTaskSnapshotStoreLoadPromise, null, 'superseded loads must release their in-flight promise');
    context.__tmBuildTaskSnapshotStore = buildStore;
}

async function exerciseLoadCost(legacy) {
    const heavy = clone(legacy);
    heavy.taskTree[0].tasks = Array.from({ length: 500 }, (_, index) => ({
        id: `20260905000000-${String(index + 100).padStart(7, '0')}`, content: '测试任务'.repeat(20), children: [],
    }));
    const disk = context.__tmBuildTaskSnapshotStore(heavy);
    for (let index = 1; index < 20; index += 1) {
        const groupId = `group-${index}`;
        const scopeKey = context.__tmBuildTaskSnapshotScopeKey(heavy.docIds, groupId);
        disk.snapshots[scopeKey] = { ...disk.snapshots[heavy.scopeKey], groupId, scopeKey };
    }
    let wholeStoreMeasurements = 0;
    let docMeasurements = 0;
    const estimate = context.__tmEstimateJsonByteSize;
    context.__tmEstimateJsonByteSize = (value) => {
        if (value?.snapshots && Object.keys(value.snapshots).length) wholeStoreMeasurements += 1;
        if (value?.id === heavy.docIds[0] && Array.isArray(value.tasks)) docMeasurements += 1;
        return estimate(value);
    };
    context.__tmReadDerivedCacheFile = async () => clone(disk);
    const restored = await context.__tmLoadTaskSnapshotStore({ force: true });
    assert.equal(restored.order.length, 20);
    assert.equal(wholeStoreMeasurements, 0, 'loading must not stringify the full store just to decide whether to compact');
    assert.equal(docMeasurements, 1, '20 scopes sharing 500 tasks must measure the shared document once');
    context.__tmEstimateJsonByteSize = estimate;
    console.log('snapshot load cost: 20 scopes / 500 tasks, whole-store measurements=0, shared-doc measurements=1');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
