'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const runtimeSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '51-whiteboard-and-link-runtime.js'),
    'utf8',
);
const interactionSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', 'render', '49-render-whiteboard-interactions.js'),
    'utf8',
);

function sliceSource(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.ok(start >= 0 && end > start, `missing source range: ${startMarker}`);
    return source.slice(start, end);
}

const localSyncs = [];
let whiteboardSaveCount = 0;
let settingsSaveCount = 0;
const SettingsStore = {
    data: {
        whiteboardDetachedChildren: {},
        whiteboardNodePos: {},
        whiteboardPlacedTaskIds: {},
    },
    syncLocalFields: (fields) => localSyncs.push(Array.from(fields)),
    save: () => { settingsSaveCount += 1; },
};
const WhiteboardStore = {
    loaded: true,
    data: {},
    scheduleSave: () => { whiteboardSaveCount += 1; },
};
const context = vm.createContext({
    console,
    Date,
    Map,
    Set,
    SettingsStore,
    WhiteboardStore,
    __tmGetDetachedChildrenMap: () => SettingsStore.data.whiteboardDetachedChildren,
    __tmResolveWhiteboardTaskParentId: () => '',
    __tmGetWhiteboardNodePosMap: () => SettingsStore.data.whiteboardNodePos,
    __tmGetWhiteboardPlacedTaskMap: () => SettingsStore.data.whiteboardPlacedTaskIds,
});

vm.runInContext(`${sliceSource(
    runtimeSource,
    'function __tmCommitWhiteboardDetachedChildren',
    '    function __tmWhiteboardCollectTaskTreeIds',
)}\n${sliceSource(
    runtimeSource,
    'function __tmCommitWhiteboardPlacements',
    '    function __tmSetWhiteboardNodePos',
)}\nglobalThis.commitDetached = __tmCommitWhiteboardDetachedChildren;\nglobalThis.commitPlacements = __tmCommitWhiteboardPlacements;`, context);

const placements = Array.from({ length: 100 }, (_, index) => ({
    taskId: `task-${index}`,
    docId: 'doc-1',
    x: index * 10,
    y: index * 5,
    manual: true,
    placed: true,
}));
assert.equal(context.commitPlacements(placements, { persist: false }), 100);
assert.equal(whiteboardSaveCount, 1, '100 placements must schedule one whiteboard file save');
assert.deepEqual(localSyncs, [['whiteboardNodePos', 'whiteboardPlacedTaskIds']],
    '100 placements must sync only the two affected localStorage keys once');
assert.equal(settingsSaveCount, 0, 'persist false must keep the outer SettingsStore save boundary');
assert.equal(Object.keys(SettingsStore.data.whiteboardNodePos).length, 100);
assert.equal(Object.keys(SettingsStore.data.whiteboardPlacedTaskIds).length, 100);

assert.equal(context.commitPlacements(placements, { persist: false }), 0, 'identical placement batches must be no-ops');
assert.equal(whiteboardSaveCount, 1);
assert.equal(localSyncs.length, 1);

const detachedChanges = Array.from({ length: 100 }, (_, index) => ({
    taskId: `child-${index}`,
    detached: true,
    parentTaskId: `parent-${index}`,
}));
assert.equal(context.commitDetached(detachedChanges, { persist: false }), 100);
assert.equal(whiteboardSaveCount, 2, '100 detached updates must schedule one additional whiteboard save');
assert.deepEqual(localSyncs.at(-1), ['whiteboardDetachedChildren']);
assert.equal(context.commitDetached(detachedChanges, { persist: false }), 0, 'identical detached batches must be no-ops');
assert.equal(whiteboardSaveCount, 2);

const poolStart = interactionSource.indexOf('window.tmWhiteboardBoardDrop = async function');
const poolEnd = interactionSource.indexOf('window.tmWhiteboardDocResizeMouseDown', poolStart);
assert.ok(poolStart >= 0 && poolEnd > poolStart, 'whiteboard pool drop handler must remain extractable');
const poolHandler = interactionSource.slice(poolStart, poolEnd);
const poolLoopStart = poolHandler.indexOf('for (let i = 0; i < taskIdsSorted.length; i++)');
const poolCommitStart = poolHandler.indexOf('if (docDetachedChanges.length)');
const poolLoop = poolHandler.slice(poolLoopStart, poolCommitStart);
assert.doesNotMatch(poolLoop, /__tmSetWhiteboard(?:NodePos|TaskPlaced|ChildDetached)\(/,
    'task pool placement must not persist per task inside the loop');
assert.match(poolHandler, /__tmCommitWhiteboardDetachedChildren\(docDetachedChanges/);
assert.match(poolHandler, /__tmCommitWhiteboardPlacements\(docPlacementChanges/);
assert.match(poolHandler, /__tmUpsertWhiteboardTaskSnapshots\(snapshotTasks/);

const narrowSyncContracts = [
    ['function __tmSetManualTaskLinks', 'function __tmGetTaskLinkStats', 'whiteboardLinks'],
    ['function __tmSetWhiteboardAllTabsDocOrder', 'function __tmGetWhiteboardGlobalBoardGroupId', 'whiteboardAllTabsDocOrderByGroup'],
    ['function __tmSaveWhiteboardFramesToStorage', 'function __tmGetWhiteboardFrameById', 'whiteboardFrames'],
    ['function __tmSetWhiteboardDocFrameSize', 'function __tmGetPriorityGroupDeltaMap', 'whiteboardDocFrameSize'],
];
narrowSyncContracts.forEach(([startMarker, endMarker, field]) => {
    const block = sliceSource(runtimeSource, startMarker, endMarker);
    assert.match(block, new RegExp(`syncLocalFields\\?\\.\\(\\['${field}'\\]`), `${field} must use field-level local sync`);
    assert.doesNotMatch(block, /syncToLocal\(\)/, `${field} must not trigger the full SettingsStore localStorage write set`);
});

console.log('whiteboard batch persistence contract tests passed');
