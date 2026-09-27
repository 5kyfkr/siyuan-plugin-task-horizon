'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'), 'utf8');
const start = source.indexOf('function __tmRunTaskProjectionBatch(');
const end = source.indexOf('const __tmPendingProjectionEntries =', start);
assert.ok(start >= 0 && end > start);

for (const change of ['priority', 'customStatus', 'createTask', 'deleteTask']) {
    test(`${change} preserves the loaded checklist window before fallback rendering`, () => {
        class Element { querySelector() { return null; } }
        const state = { viewMode: 'checklist', modal: new Element(), listRenderLimit: 144,
            filteredTasks: Array.from({ length: 200 }, (_, i) => ({ id: `task-${i}` })) };
        let renderedLimit = null;
        let captures = 0;
        const context = vm.createContext({
            Element, HTMLElement: Element, state,
            document: { body: { contains: () => true } },
            __tmAnalyzeTaskProjectionPatch: () => ({ projection: true, requiresClosure: change === 'customStatus', changedFields: [change] }),
            __tmCollectTaskProjectionClosure: (ids) => ids,
            __tmGetTaskProjectionPlacementIds: () => [],
            __tmCaptureViewRenderWindow: () => { captures++; return { limit: state.listRenderLimit }; },
            __tmCaptureViewScrollAnchor: () => null,
            __tmRecomputeTaskProjection: () => { state.listRenderLimit = 48; return { applied: true }; },
            __tmRestoreViewRenderWindow: (snapshot) => { state.listRenderLimit = snapshot.limit; },
            __tmMarkChecklistProjectionGroupRefresh: () => {},
            __tmScheduleViewRefresh: (options) => { if (options.mode === 'current') renderedLimit = state.listRenderLimit; },
        });
        vm.runInContext(source.slice(start, end), context);
        const structural = change.endsWith('Task');
        context.__tmRunTaskProjectionBatch({
            reason: change, structural, taskIds: ['task-90'],
            fieldChanges: structural ? [] : [{ taskId: 'task-90', patch: { [change]: 'changed' }, completionChanged: false }],
        }, { patchFields: false });
        assert.equal(captures, 1, 'capture before filtering even without a completion closure');
        assert.equal(renderedLimit, 144, 'fallback must not shorten the list and clamp a deep scroll');
    });
}
