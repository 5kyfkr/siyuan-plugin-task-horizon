'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('./i18n-vm-fixture');

const root = path.resolve(__dirname, '..');
const foundation = fs.readFileSync(path.join(root, 'src/task-horizon/main/30-dialogs-and-ui-foundation.js'), 'utf8');
const coordinator = fs.readFileSync(path.join(root, 'src/task-horizon/main/task-runtime/51-whiteboard-and-link-runtime.js'), 'utf8');

function extractFunction(source, name) {
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

function segment(source, startText, endText) {
    const start = source.indexOf(startText);
    const end = source.indexOf(endText, start + startText.length);
    assert.ok(start >= 0 && end > start, `missing segment: ${startText}`);
    return source.slice(start, end);
}

const scopeHelper = extractFunction(foundation, '__tmIsTaskIdInCurrentDocumentScope');
const clearHelper = extractFunction(foundation, '__tmClearChecklistDetailOutsideCurrentDocumentScope');
const context = vm.createContext({
    state: {
        activeDocId: 'doc-2',
        viewMode: 'checklist',
        checklistContext: true,
        taskTree: [{ id: 'doc-1' }, { id: 'doc-2' }],
        otherBlocks: [],
        detailTaskId: 'task-1',
        checklistDetailDismissed: false,
        checklistDetailSheetOpen: true,
        checklistDetailSheetFullscreen: true,
    },
    SettingsStore: { data: { currentGroupId: 'group-1' } },
    tasks: {
        'task-1': { id: 'task-1', root_id: 'doc-1' },
        'task-2': { id: 'task-2', root_id: 'doc-2' },
        'task-3': { id: 'task-3', root_id: 'doc-3' },
        'block-4': { id: 'block-4', root_id: 'doc-4' },
    },
    groupDocIds: new Set(),
    __tmGetChecklistDetailTaskById(taskId) { return this.tasks[taskId] || null; },
    __tmTaskBoundary: { getTask(taskId) { return context.tasks[taskId] || null; } },
    __tmIsOtherBlockTabId(activeDocId) { return String(activeDocId).startsWith('other:'); },
    __tmIsChecklistSelectionContext() { return context.state.checklistContext === true; },
    __tmGetActiveDocTabCustomGroupDocIdSet(activeDocId) {
        return activeDocId === 'tabgroup:ops' ? context.groupDocIds : null;
    },
});
vm.runInContext(`${scopeHelper}\n${clearHelper}\nthis.isInScope = __tmIsTaskIdInCurrentDocumentScope; this.clearOutOfScope = __tmClearChecklistDetailOutsideCurrentDocumentScope;`, context);

assert.equal(context.isInScope('task-2'), true, 'the selected task remains valid in its document');
assert.equal(context.isInScope('task-1'), false, 'a task from another document is outside a single-document view');
assert.equal(context.isInScope('missing-task'), true, 'unknown task ownership must fail open');

context.state.activeDocId = 'all';
assert.equal(context.isInScope('task-1'), true, 'all tabs must retain a task from a loaded document');
context.tasks['block-4'].root_id = 'doc-not-loaded';
context.state.otherBlocks = [{ id: 'block-4' }];
assert.equal(context.isInScope('block-4'), true, 'all tabs must retain a loaded other-block task');

context.state.activeDocId = 'tabgroup:ops';
vm.runInContext("groupDocIds = new Set(['doc-1', 'doc-2'])", context);
assert.equal(context.isInScope('task-1'), true, 'a page-group aggregate must retain included documents');
assert.equal(context.isInScope('task-3'), false, 'a page-group aggregate must reject documents outside the group');

context.state.activeDocId = 'doc-2';
assert.equal(context.clearOutOfScope(), true, 'switching to another document must clear its stale detail selection');
assert.equal(context.state.detailTaskId, '');
assert.equal(context.state.checklistDetailDismissed, true);
assert.equal(context.state.checklistDetailSheetOpen, false);
assert.equal(context.state.checklistDetailSheetFullscreen, false);

context.state.activeDocId = 'all';
context.state.detailTaskId = 'task-1';
context.state.checklistDetailDismissed = false;
context.state.checklistDetailSheetOpen = true;
context.state.checklistDetailSheetFullscreen = true;
assert.equal(context.clearOutOfScope(), false, 'switching to an aggregate must keep an in-scope detail selection');
assert.equal(context.state.detailTaskId, 'task-1');

const switchDoc = segment(foundation, 'window.tmSwitchDoc = async function', 'window.tmSwitchDocTabCustomGroup');
const switchTabGroup = segment(foundation, 'window.tmSwitchDocTabCustomGroup = async function', 'window.tmHandleDocTabCustomGroupClick');
assert.match(switchDoc, /state\.activeDocId = resolvedDocId;[\s\S]*__tmClearChecklistDetailOutsideCurrentDocumentScope\(\)/,
    'document switches must clear stale detail selection before rendering');
assert.match(switchTabGroup, /state\.activeDocId = activeId \|\| 'all';[\s\S]*__tmClearChecklistDetailOutsideCurrentDocumentScope\(\)/,
    'page-group switches must clear detail selection only when it leaves the new scope');

const busyBarrier = extractFunction(coordinator, '__tmGetBusyTaskDetailBarrier');
assert.match(busyBarrier,
    /__tmCollectBusyTaskDetailRoots\(\)\.filter\([\s\S]*meta\.scope !== 'checklist'[\s\S]*meta\.scope !== 'task-sheet'[\s\S]*isInCurrentScope\(meta\.taskId\)/,
    'out-of-scope checklist detail editors must not block the current document render');

console.log('task detail document scope contract tests passed');
