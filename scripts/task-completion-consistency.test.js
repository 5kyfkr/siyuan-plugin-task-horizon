'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const apiSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', '20-api-and-runtime-services.js'),
    'utf8',
);
const doneRuntimeSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '53b-task-create-and-quick-add-runtime.js'),
    'utf8',
);
const listRuntimeSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '53-list-render-and-document-loader.js'),
    'utf8',
);
const writerRuntimeSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '51-whiteboard-and-link-runtime.js'),
    'utf8',
);
const taskModelSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '50-task-model-and-repeat-utils.js'),
    'utf8',
);
const storesSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', '10-stores-rules-and-cache.js'),
    'utf8',
);
const documentLoaderSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '53c-document-loader-runtime.js'),
    'utf8',
);
const whiteboardInteractionSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', 'render', '49-render-whiteboard-interactions.js'),
    'utf8',
);
const taskDetailSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', 'task-runtime', '52-task-detail-runtime.js'),
    'utf8',
);
const renderRuntimeSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', '40-render-runtime.js'),
    'utf8',
);

function extractFunction(source, name) {
    const asyncNeedle = `async function ${name}(`;
    const syncNeedle = `function ${name}(`;
    const assignedNeedle = `${name} = function(`;
    let start = source.indexOf(asyncNeedle);
    if (start < 0) start = source.indexOf(syncNeedle);
    if (start < 0) start = source.indexOf(assignedNeedle);
    assert.ok(start >= 0, `missing function ${name}`);
    const paramsStart = source.indexOf('(', start);
    assert.ok(paramsStart >= 0, `missing parameters for ${name}`);
    let paramsDepth = 0;
    let paramsEnd = -1;
    for (let index = paramsStart; index < source.length; index += 1) {
        if (source[index] === '(') paramsDepth += 1;
        if (source[index] === ')') {
            paramsDepth -= 1;
            if (paramsDepth === 0) {
                paramsEnd = index;
                break;
            }
        }
    }
    assert.ok(paramsEnd >= 0, `unterminated parameters for ${name}`);
    const bodyStart = source.indexOf('{', paramsEnd);
    assert.ok(bodyStart >= 0, `missing body for ${name}`);
    let depth = 0;
    let quote = '';
    let escaped = false;
    let lineComment = false;
    let blockComment = false;
    let regex = false;
    let regexClass = false;
    let regexEscaped = false;
    for (let index = bodyStart; index < source.length; index += 1) {
        const char = source[index];
        const next = source[index + 1] || '';
        if (lineComment) {
            if (char === '\n') lineComment = false;
            continue;
        }
        if (blockComment) {
            if (char === '*' && next === '/') {
                blockComment = false;
                index += 1;
            }
            continue;
        }
        if (regex) {
            if (regexEscaped) {
                regexEscaped = false;
            } else if (char === '\\') {
                regexEscaped = true;
            } else if (char === '[') {
                regexClass = true;
            } else if (char === ']') {
                regexClass = false;
            } else if (char === '/' && !regexClass) {
                regex = false;
            }
            continue;
        }
        if (quote) {
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === quote) {
                quote = '';
            }
            continue;
        }
        if (char === '/' && next === '/') {
            lineComment = true;
            index += 1;
            continue;
        }
        if (char === '/' && next === '*') {
            blockComment = true;
            index += 1;
            continue;
        }
        if (char === '/') {
            const before = source.slice(Math.max(bodyStart, index - 16), index).trimEnd();
            const previous = before[before.length - 1] || '';
            if (/[=(:,![{;?]/.test(previous) || /\breturn$/.test(before)) {
                regex = true;
                regexClass = false;
                regexEscaped = false;
                continue;
            }
        }
        if (char === '\'' || char === '"' || char === '`') {
            quote = char;
            continue;
        }
        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) return source.slice(start, index + 1);
        }
    }
    assert.fail(`unterminated function ${name}`);
}

function parseMarker(markdown) {
    const match = String(markdown || '').match(/^\s*[*+-]\s+(?:(?:\{:\s*[^}]*\})\s*)*\[([^\]])\]/);
    return match ? match[1] : ' ';
}

function createStatusContext() {
    const SettingsStore = {
        data: {
            legacyWin7CompatMode: false,
            checkboxDoneStatusId: 'done',
            checkboxUndoneStatusId: 'todo',
        },
    };
    const normalizeCompat = (value, fallback = ' ') => {
        let marker = String(value == null ? fallback : value);
        if (marker === '__space__') marker = ' ';
        marker = Array.from(marker)[0] || String(fallback || ' ');
        if (!SettingsStore.data.legacyWin7CompatMode) return marker;
        return marker.trim().toUpperCase() === 'X' ? 'X' : ' ';
    };
    const normalizeMarker = (value, fallback = ' ') => {
        let marker = String(value == null ? fallback : value);
        if (marker === '__space__') marker = ' ';
        return Array.from(marker)[0] || String(fallback || ' ');
    };
    const context = vm.createContext({
        Map,
        SettingsStore,
        TextEncoder,
        API: {
            parseTaskStatus(markdown) {
                const marker = parseMarker(markdown);
                return { marker, done: normalizeCompat(marker) !== ' ' };
            },
        },
        __tmGuessStatusOptionDefaultMarker: (item) => String(item?.marker ?? ' '),
        __tmGetStatusOptionsRuntimeArtifacts(input) {
            const options = Array.isArray(input) ? input : [];
            const idMap = new Map();
            const markerMap = new Map();
            options.forEach((item) => {
                idMap.set(String(item.id), item);
                const marker = normalizeMarker(item.marker, ' ');
                if (!markerMap.has(marker)) markerMap.set(marker, item);
            });
            return { options, idMap, markerMap };
        },
        __tmResolveCheckboxLinkedStatusId: (done) => done ? 'done' : 'todo',
        __tmGetDefaultUndoneStatusId: () => 'todo',
        __tmDoesStatusIdResolveToDone(statusId, input) {
            const matched = (Array.isArray(input) ? input : []).find((item) => item.id === statusId);
            return !!matched && (SettingsStore.data.legacyWin7CompatMode
                ? String(matched.marker || '').trim().toUpperCase() === 'X'
                : String(matched.marker ?? ' ') !== ' ');
        },
    });
    [
        '__tmNormalizeTaskStatusMarker',
        '__tmIsLegacyWin7CompatMode',
        '__tmNormalizeCompatTaskStatusMarker',
        '__tmIsTaskMarkerDone',
        '__tmResolveTaskMarkdownMarker',
        '__tmIsTaskDoneEffective',
        '__tmResolveTaskStatusDisplayOption',
    ].forEach((name) => vm.runInContext(extractFunction(apiSource, name), context, { filename: `${name}.js` }));
    return context;
}

async function testMarkerRulesAndStatusResolution() {
    const context = createStatusContext();
    for (const marker of ['x', 'X', '-', '?', '>', '*']) {
        assert.equal(context.__tmIsTaskMarkerDone(marker), true, `${marker} must be done outside Win7 compatibility mode`);
    }
    assert.equal(context.__tmIsTaskMarkerDone(' '), false);

    const options = [
        { id: 'todo', name: '待办', color: '#777777', marker: ' ' },
        { id: 'done', name: '已完成', color: '#00aa00', marker: 'X' },
        { id: 'cancelled', name: '已取消', color: '#999999', marker: '-' },
        { id: 'waiting', name: '等待', color: '#ffaa00', marker: '?' },
    ];
    assert.equal(context.__tmIsTaskDoneEffective({ taskMarker: ' ', customStatus: 'done' }, options), false);
    assert.equal(context.__tmIsTaskDoneEffective({ markdown: '* [?] Task', customStatus: 'todo' }, options), true);
    assert.equal(context.__tmResolveTaskStatusDisplayOption({ taskMarker: '?', customStatus: 'done' }, options).id, 'waiting');
    assert.equal(context.__tmResolveTaskStatusDisplayOption({ taskMarker: '-', customStatus: 'done' }, options).id, 'cancelled');
    assert.equal(context.__tmResolveTaskStatusDisplayOption({ taskMarker: ' ', customStatus: 'done' }, options).id, 'todo');
    assert.equal(context.__tmResolveTaskStatusDisplayOption({ taskMarker: 'X', customStatus: 'done' }, options).id, 'done');

    context.SettingsStore.data.legacyWin7CompatMode = true;
    assert.equal(context.__tmIsTaskMarkerDone('x'), true);
    assert.equal(context.__tmIsTaskMarkerDone('X'), true);
    for (const marker of [' ', '-', '?', '>', '*']) {
        assert.equal(context.__tmIsTaskMarkerDone(marker), false, `${marker} must not be done in Win7 compatibility mode`);
    }
    assert.equal(context.__tmResolveTaskStatusDisplayOption({ taskMarker: '?', customStatus: 'done' }, options).id, 'waiting');
    assert.equal(context.__tmResolveTaskStatusDisplayOption({ taskMarker: '-', customStatus: 'waiting' }, options).id, 'cancelled');
}

async function testMarkerReadbackAndFallback() {
    const context = vm.createContext({
        SettingsStore: { data: { legacyWin7CompatMode: false } },
        TextEncoder,
        setTimeout: (handler) => { handler(); return 0; },
        state: { flatTasks: {}, pendingInsertedTasks: {} },
        globalThis: null,
        __tmPushStatusDebug: () => {},
        __tmProtectMarkdownMutationTaskFields: () => {},
        __tmIsTaskListItemMarkerApiError: () => false,
        __tmHandleStaleTaskBlockForRefresh: async () => {},
        __tmBuildStaleTaskBlockError: () => new Error('stale task'),
        __tmCallTaskHorizonKernelRpc: async () => ({ available: false, data: null }),
    });
    context.globalThis = context;
    vm.runInContext(extractFunction(apiSource, '__tmNormalizeTaskStatusMarker'), context);
    vm.runInContext(extractFunction(apiSource, '__tmIsLegacyWin7CompatMode'), context);
    vm.runInContext(extractFunction(apiSource, '__tmNormalizeCompatTaskStatusMarker'), context);
    vm.runInContext(extractFunction(apiSource, '__tmGetTaskListItemMarkerPrefixMatch'), context);
    vm.runInContext(extractFunction(apiSource, '__tmNormalizeTaskListItemMarkdownMarker'), context);
    vm.runInContext(extractFunction(apiSource, '__tmReplaceTaskListItemMarkerInMarkdown'), context);
    vm.runInContext(extractFunction(apiSource, '__tmIsTaskListItemMarkdown'), context);
    vm.runInContext(extractFunction(apiSource, '__tmVerifyTaskListItemMarkerPersisted'), context);
    vm.runInContext(extractFunction(apiSource, '__tmUpdateTaskListItemMarkerWithFallback'), context);

    let markdown = '- {: id="task-1"}[X] Task';
    let markerApiCalls = 0;
    let blockFallbackCalls = 0;
    context.API = {
        async getBlockKramdown() { return markdown; },
        parseTaskStatus(value) { return { marker: parseMarker(value) }; },
        async updateTaskListItemMarker() { markerApiCalls += 1; },
    };
    context.__tmBackendAdapter = {
        async updateBlock(id, nextMarkdown) {
            blockFallbackCalls += 1;
            markdown = nextMarkdown;
            return { id };
        },
    };
    const result = await context.__tmUpdateTaskListItemMarkerWithFallback('task-1', '?');
    assert.equal(markerApiCalls, 1);
    assert.equal(blockFallbackCalls, 1, 'false-positive marker API success must use the block fallback');
    assert.equal(result.usedFallback, true);
    assert.equal(parseMarker(markdown), '?');
    assert.match(markdown, /^- \{: id="task-1"\}\[\?\] Task$/, 'marker fallback must preserve block IAL');

    const fallbackCallsBeforeCanonicalX = blockFallbackCalls;
    context.API.updateTaskListItemMarker = async () => {
        markerApiCalls += 1;
        markdown = '* [x] Task';
    };
    const canonicalXResult = await context.__tmUpdateTaskListItemMarkerWithFallback('task-1', 'X');
    assert.equal(canonicalXResult.usedFallback, false);
    assert.equal(blockFallbackCalls, fallbackCallsBeforeCanonicalX, 'kernel X-to-x normalization must not trigger fallback');
    assert.equal(canonicalXResult.marker, 'X');
    assert.equal(parseMarker(canonicalXResult.markdown), 'x');

    let attempts = 0;
    context.API.getBlockKramdown = async () => {
        attempts += 1;
        return attempts < 3 ? '* [X] Task' : '* [?] Task';
    };
    const verified = await context.__tmVerifyTaskListItemMarkerPersisted('task-1', '?');
    assert.equal(attempts, 3, 'markers with the same done value but different characters must not compare equal');
    assert.equal(verified.marker, '?');

    context.SettingsStore.data.legacyWin7CompatMode = true;
    markdown = '* [ ] Task';
    const compatResult = await context.__tmUpdateTaskListItemMarkerWithFallback('task-1', '?');
    assert.equal(compatResult.usedFallback, true);
    assert.equal(parseMarker(markdown), '?', 'Win7 compatibility changes done semantics, not marker identity');
}

function testLocalMirrorPatch() {
    const flat = { id: 'task-1', done: false, taskMarker: ' ', task_marker: ' ', markdown: '* [ ] Task' };
    const pending = { ...flat };
    const treeTask = { ...flat, children: [] };
    const filteredClone = { ...flat, children: [] };
    const context = vm.createContext({
        state: {
            flatTasks: { 'task-1': flat },
            pendingInsertedTasks: { 'task-1': pending },
            taskTree: [{ id: 'doc-1', tasks: [treeTask] }],
            filteredTasks: [filteredClone],
        },
        __tmNormalizeQueueTaskValue: (key, value) => value,
        __tmNormalizeTaskStatusMarker: (value, fallback = ' ') => Array.from(String(value ?? fallback))[0] || fallback,
        __tmNormalizeCompatTaskStatusMarker: (value, fallback = ' ') => Array.from(String(value ?? fallback))[0] || fallback,
    });
    vm.runInContext(extractFunction(apiSource, '__tmApplyQueuedTaskFieldPatchToTask'), context);
    vm.runInContext(extractFunction(apiSource, '__tmApplyTaskFieldPatchToLocalMirrors'), context);
    context.__tmApplyTaskFieldPatchToLocalMirrors('task-1', {
        done: true,
        taskMarker: '?',
        task_marker: '?',
        markdown: '* [?] Task',
        customStatus: 'waiting',
    });
    for (const task of [flat, pending, treeTask, filteredClone]) {
        assert.equal(task.done, true);
        assert.equal(task.taskMarker, '?');
        assert.equal(task.task_marker, '?');
        assert.equal(task.markdown, '* [?] Task');
        assert.equal(task.customStatus, 'waiting');
        assert.equal(task.custom_status, 'waiting');
    }
}

function testSetDoneQueueMergePreservesRollbackState() {
    const context = vm.createContext({ __tmWritePlanner: {} });
    vm.runInContext(extractFunction(apiSource, '__tmMergeQueuedOp'), context);
    const target = {
        type: 'setDone',
        data: {
            done: false,
            previousDone: true,
            previousMarker: '?',
            previousMarkdown: '* [?] Task',
            previousStatusId: 'waiting',
        },
        inversePatch: { done: true },
    };
    const next = {
        type: 'setDone',
        data: {
            done: true,
            previousDone: false,
            previousMarker: ' ',
            previousMarkdown: '* [ ] Task',
            previousStatusId: 'todo',
        },
        inversePatch: { done: false },
    };
    assert.equal(context.__tmMergeQueuedOp(target, next), true);
    assert.equal(target.data.done, true);
    assert.equal(target.data.previousDone, true);
    assert.equal(target.data.previousMarker, '?');
    assert.equal(target.data.previousMarkdown, '* [?] Task');
    assert.equal(target.data.previousStatusId, 'waiting');
    assert.equal(target.inversePatch.done, true);
    assert.equal(Object.keys(target.inversePatch).length, 1);
}

async function testSetDoneIngressSerialization() {
    const context = vm.createContext({
        Map,
        Promise,
        __tmSetDoneIngressByTask: new Map(),
    });
    vm.runInContext(extractFunction(listRuntimeSource, '__tmRunSetDoneIngress'), context);
    const order = [];
    let releaseFirst = null;
    const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
    const first = context.__tmRunSetDoneIngress('task-1', async () => {
        order.push('first:marker');
        await firstGate;
        order.push('first:status');
    });
    assert.deepEqual(order, ['first:marker']);
    const second = context.__tmRunSetDoneIngress('task-1', async () => {
        order.push('second:marker');
        order.push('second:status');
    });
    await Promise.resolve();
    assert.deepEqual(order, ['first:marker']);
    releaseFirst();
    await Promise.all([first, second]);
    assert.deepEqual(order, ['first:marker', 'first:status', 'second:marker', 'second:status']);
}

function testDoneOverrideSurvivesStaleReload() {
    const state = {
        doneOverrides: {
            staleDone: true,
            staleUndone: false,
            caughtUp: true,
        },
    };
    const context = vm.createContext({
        state,
        __tmIsTaskMarkerDone: (marker) => String(marker ?? '').trim() !== '',
    });
    vm.runInContext(extractFunction(storesSource, '__tmApplyDoneOverrideToTaskIfPresent'), context);

    const staleDone = { id: 'staleDone', done: false, taskMarker: ' ', task_marker: ' ' };
    assert.equal(context.__tmApplyDoneOverrideToTaskIfPresent(staleDone), true);
    assert.equal(staleDone.done, true);
    assert.equal(staleDone.taskMarker, 'X');
    assert.equal(state.doneOverrides.staleDone, true);

    const staleUndone = { id: 'staleUndone', done: true, taskMarker: 'X', task_marker: 'X' };
    assert.equal(context.__tmApplyDoneOverrideToTaskIfPresent(staleUndone), true);
    assert.equal(staleUndone.done, false);
    assert.equal(staleUndone.taskMarker, ' ');
    assert.equal(state.doneOverrides.staleUndone, false);

    const caughtUp = { id: 'caughtUp', done: true, taskMarker: 'X', task_marker: 'X' };
    assert.equal(context.__tmApplyDoneOverrideToTaskIfPresent(caughtUp), false);
    assert.equal(state.doneOverrides.caughtUp, true);
}

function testTaskCheckboxRenderUsesLiveDoneState() {
    const state = { doneOverrides: {} };
    const context = vm.createContext({
        state,
        __tmIsCollectedOtherBlockTask: () => false,
        __tmIsTaskDoneEffective: (task) => !!task?.done,
        __tmRuntimeState: {
            getTaskById: () => ({ id: 'task-1', done: true }),
        },
        __tmBuildTaskCheckboxStyle: () => '',
        esc: (value) => String(value ?? ''),
    });
    vm.runInContext(extractFunction(taskModelSource, '__tmRenderTaskCheckbox'), context);

    const staleTask = { id: 'task-1', done: false };
    const liveHtml = context.__tmRenderTaskCheckbox('task-1', staleTask, { checked: false });
    assert.match(liveHtml, /data-task-id="task-1"/);
    assert.match(liveHtml, / checked/);

    state.doneOverrides['task-1'] = false;
    const overrideHtml = context.__tmRenderTaskCheckbox('task-1', staleTask, { checked: true });
    assert.doesNotMatch(overrideHtml, / checked/);
}

async function run() {
    await testMarkerRulesAndStatusResolution();
    await testMarkerReadbackAndFallback();
    testLocalMirrorPatch();
    testSetDoneQueueMergePreservesRollbackState();
    await testSetDoneIngressSerialization();
    testDoneOverrideSurvivesStaleReload();
    testTaskCheckboxRenderUsesLiveDoneState();
    assert.match(doneRuntimeSource, /function __tmApplyDoneStateToLocalMirrors[\s\S]*__tmApplyTaskFieldPatchToLocalMirrors/);
    assert.match(listRuntimeSource, /previousMarker:[\s\S]*previousMarkdown:/);
    const setDoneKernelSource = extractFunction(listRuntimeSource, '__tmSetDoneKernel');
    assert.match(setDoneKernelSource, /await __tmPersistMetaAndAttrsKernel\(id, touchPatch[\s\S]*set-done-status-link/);
    assert.doesNotMatch(setDoneKernelSource, /__tmRequireTaskOutbox\?\.\('patchTask'\)/);
    assert.match(setDoneKernelSource, /await __tmPersistMetaAndAttrsKernel\(id, touchPatch[\s\S]*catch \(statusErr\)[\s\S]*__tmUpdateTaskListItemMarkerWithFallback\(id, originalMarker\)[\s\S]*throw statusErr/);
    assert.doesNotMatch(setDoneKernelSource, /ev\.preventDefault\(\)/);
    assert.match(setDoneKernelSource, /if \(taskWasDone === targetDone && opts\.force !== true\) return/);
    assert.match(setDoneKernelSource, /type: 'setDone'[\s\S]*patch: undoPatch[\s\S]*inversePatch/);
    assert.match(writerRuntimeSource, /inlineQueuedPersist:[^\n]+[\s\S]*skipNoopCheck: opts\.skipNoopCheck === true[\s\S]*previousStatusId:/);
    assert.match(writerRuntimeSource, /skipFlush: opts\.skipFlush === true,[\s\S]*skipNoopCheck: opts\.skipNoopCheck === true,[\s\S]*attrTargetId:/);
    assert.match(apiSource, /skipNoopCheck: op\?\.data\?\.skipNoopCheck === true,[\s\S]*opts\.skipNoopCheck !== true && prevStatusId === nextStatusId/);
    assert.match(apiSource, /__tmRollbackDoneOptimisticLocal\([\s\S]*previousMarker:[\s\S]*previousMarkdown:/);
    const applyTaskStatusSource = extractFunction(apiSource, '__tmApplyTaskStatus');
    assert.match(applyTaskStatusSource, /!prevDone && nextDone[\s\S]*__tmScheduleRecurringTaskAdvanceAfterCompletion\(context\.persistId/,
        'changing a status marker from empty to non-empty must schedule recurring-task advancement');
    assert.ok(applyTaskStatusSource.indexOf('__tmApplyTaskStatusLocalState(') < applyTaskStatusSource.indexOf('__tmScheduleRecurringTaskAdvanceAfterCompletion('),
        'status completion must update local done state before recurring-task advancement is scheduled');
    assert.match(applyTaskStatusSource, /prevDone && !nextDone[\s\S]*__tmClearRecurringTaskAdvanceTimer\(context\.persistId\)/,
        'changing a status marker back to empty must cancel pending recurring-task advancement');
    assert.doesNotMatch(taskModelSource, /pendingDoneWrite[\s\S]*disabledAttr/);
    assert.match(taskModelSource, /state\.doneOverrides[\s\S]*preferPending: true[\s\S]*__tmIsTaskDoneEffective[\s\S]*checkedAttr/);
    assert.match(taskModelSource, /data-task-id=/);
    assert.doesNotMatch(listRuntimeSource, /ignored while pending/);
    assert.doesNotMatch(listRuntimeSource, /hasPendingDoneWrite/);
    assert.doesNotMatch(listRuntimeSource, /ignored stale checkbox state/);
    assert.match(listRuntimeSource, /const targetDone = input \? !liveDone : !!done[\s\S]*input\.checked = targetDone[\s\S]*__tmSetDoneFromUi\(tid, targetDone/);
    assert.match(listRuntimeSource, /const setDoneOptions = input[\s\S]*wait: true[\s\S]*__tmSetDoneFromUi\(tid, targetDone, ev, setDoneOptions\)/);
    assert.match(listRuntimeSource, /effectiveTaskDone[\s\S]*originalDone[\s\S]*inversePatch\.done = originalDone/);
    assert.match(listRuntimeSource, /const currentDone = typeof __tmIsTaskDoneEffective[\s\S]*if \(currentDone === targetDone\) return/);
    assert.ok((storesSource.match(/__tmApplyDoneOverrideToTaskIfPresent\((?:task|target)\)/g) || []).length >= 4);
    assert.match(storesSource, /function __tmMergeLocalTaskPatchIntoTask\(task, options = \{\}\)[\s\S]*__tmApplyDoneOverrideToTaskIfPresent\(target\)/);
    assert.doesNotMatch(documentLoaderSource, /state\.doneOverrides\s*=\s*\{\}/);
    const whiteboardSetDoneSource = extractFunction(whiteboardInteractionSource, 'window.tmWhiteboardSetDone');
    assert.match(whiteboardSetDoneSource, /window\.tmSetDone\(tid, !!checked, ev/);
    assert.doesNotMatch(whiteboardSetDoneSource, /__tmMutationEngine\.requestTaskPatch/);
    assert.match(taskDetailSource, /window\.tmSetDone\?\.\(nodeTaskId, nextDone, ev,/);
    assert.doesNotMatch(listRuntimeSource, /tmSetDone\(tid, !task\.done\)/);
    assert.doesNotMatch(renderRuntimeSource, /tmSetDone\(tid, !task\.done\)/);
    assert.doesNotMatch(storesSource, /\[Task Horizon\]\[setDone\]/);
    assert.doesNotMatch(listRuntimeSource, /\[Task Horizon\]\[setDone\]/);
    assert.doesNotMatch(doneRuntimeSource, /\[Task Horizon\]\[setDone\]/);
    console.log('task completion consistency tests passed');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
