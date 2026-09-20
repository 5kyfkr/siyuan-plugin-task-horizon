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
const nativeDocHooksSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', 'shell', '72-shell-entrances-and-native-doc-hooks.js'),
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
const stateRuntimeSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', '32-runtime-state-and-events.js'),
    'utf8',
);
const kanbanRenderSource = fs.readFileSync(
    path.join(root, 'src', 'task-horizon', 'main', 'render', '43-render-timeline-kanban-calendar-body.js'),
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

const statusRules = vm.runInNewContext('(' + extractFunction(apiSource, '__tmCreateTaskStatusRules') + ')()');

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
        __tmTaskStatusRules: statusRules,
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
        __tmIsRecurringNativeDoneHeld: (task) => task?.pendingNativeDoneReset === true,
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
        '__tmResolveTaskMarker',
        '__tmIsTaskNativeDone',
        '__tmIsTaskDoneEffective',
        '__tmIsTaskCanceled',
        '__tmIsTaskClosedForDisplay',
        '__tmResolveTaskStatusDisplayOption',
    ].forEach((name) => vm.runInContext(extractFunction(apiSource, name), context, { filename: `${name}.js` }));
    return context;
}

async function testMarkerRulesAndStatusResolution() {
    const context = createStatusContext();
    for (const marker of ['x', 'X', '?', '>', '*']) {
        assert.equal(context.__tmIsTaskMarkerDone(marker), true, `${marker} must be done outside Win7 compatibility mode`);
    }
    for (const marker of [' ', '/', '-']) assert.equal(context.__tmIsTaskMarkerDone(marker), false);

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
    const heldTask = { taskMarker: 'X', customStatus: 'done', pendingNativeDoneReset: true };
    assert.equal(context.__tmIsTaskNativeDone(heldTask, options), true);
    assert.equal(context.__tmIsTaskDoneEffective(heldTask, options), false);
    assert.equal(context.__tmIsTaskClosedForDisplay(heldTask), false);
    for (const marker of [' ', '/', '-', 'X', '?']) {
        assert.equal(context.__tmIsTaskClosedForDisplay({ taskMarker: marker, done: false }), ![' ', '/'].includes(marker));
    }
    assert.equal(context.__tmIsTaskDoneEffective({ taskMarker: '-', done: false }), false);
    assert.equal(context.__tmResolveTaskStatusDisplayOption(heldTask, options).id, 'todo');

    context.SettingsStore.data.legacyWin7CompatMode = true;
    assert.equal(context.__tmIsTaskMarkerDone('x'), true);
    assert.equal(context.__tmIsTaskMarkerDone('X'), true);
    for (const marker of [' ', '-', '?', '>', '*']) {
        assert.equal(context.__tmIsTaskMarkerDone(marker), false, `${marker} must not be done in Win7 compatibility mode`);
    }
    assert.equal(context.__tmResolveTaskStatusDisplayOption({ taskMarker: '?', customStatus: 'done' }, options).id, 'waiting');
    assert.equal(context.__tmResolveTaskStatusDisplayOption({ taskMarker: '-', customStatus: 'waiting' }, options).id, 'cancelled');
}

function testTaskDetailPreservesConfiguredStatusMarkers() {
    const context = createStatusContext();
    const options = [
        { id: 'todo', name: '进行', color: '#3487d5', marker: ' ' },
        { id: 'needs_resource', name: '需资源', color: '#777777', marker: ' ' },
        { id: 'in_progress', name: '处理中', color: '#2196f3', marker: '/' },
        { id: 'quit', name: '放弃', color: '#383838', marker: '-' },
        { id: 'finish', name: '已完成', color: '#737373', marker: 'X' },
        { id: 'custom', name: '归档', color: '#999999', marker: '?' },
    ];
    context.SettingsStore.data.customStatusOptions = options;
    context.__tmGetStatusOptions = (input = options) => statusRules.normalizeOptions(input, false, false);
    vm.runInContext(extractFunction(writerRuntimeSource, '__tmGetTaskDetailStatusOptions'), context);
    vm.runInContext(extractFunction(apiSource, '__tmResolveTaskStatusId'), context);
    const detailOptions = context.__tmGetTaskDetailStatusOptions();
    for (const option of options) {
        const task = { customStatus: option.id, taskMarker: option.marker, done: statusRules.isDone(option.marker) };
        assert.equal(context.__tmResolveTaskStatusId(task, detailOptions), option.id,
            `opening task detail must retain ${option.id} (${JSON.stringify(option.marker)}) instead of selecting the default unfinished status`);
    }
    assert.equal(context.__tmResolveTaskStatusId({ taskMarker: '/', customStatus: 'todo' }, detailOptions), 'in_progress');
    assert.equal(context.__tmResolveTaskStatusId({ taskMarker: '-', customStatus: 'todo' }, detailOptions), 'quit');
    assert.equal(context.__tmResolveTaskStatusId({ taskMarker: 'X', customStatus: 'finish', pendingNativeDoneReset: true }, detailOptions), 'todo',
        'preserving status markers must not change held recurring completion presentation');
}

function testCanceledTasksUseCompletedGroups() {
    const context = createStatusContext();
    context.__tmGetArchivedDocIdsForAllTabCompletedTailGroup = () => new Set();
    for (const name of ['__tmIsTaskCanceled']) {
        vm.runInContext(extractFunction(apiSource, name), context);
    }
    for (const name of ['__tmIsTaskDoneForTailGroup', '__tmShouldSeparateCompletedRootGroup', '__tmShouldShowTaskInCompletedRootGroup', '__tmSplitTasksByDoneState']) {
        vm.runInContext(extractFunction(writerRuntimeSource, name), context);
    }
    const tasks = [
        Object.freeze({ id: 'todo', taskMarker: ' ', done: false }),
        Object.freeze({ id: 'doing', taskMarker: '/', done: false }),
        Object.freeze({ id: 'quit', taskMarker: '-', done: false }),
        Object.freeze({ id: 'done', taskMarker: 'X', done: true }),
        Object.freeze({ id: 'custom-done', taskMarker: '?', done: false }),
        Object.freeze({ id: 'held', taskMarker: 'X', done: true, pendingNativeDoneReset: true }),
    ];
    const split = context.__tmSplitTasksByDoneState(tasks);
    assert.deepEqual(Array.from(split.active, (task) => task.id), ['todo', 'doing', 'held']);
    assert.deepEqual(Array.from(split.done, (task) => task.id), ['quit', 'done', 'custom-done'],
        'canceled tasks must enter the completed group, keeping in-progress and held recurring tasks active');
    for (let code = 32; code <= 126; code += 1) {
        const marker = String.fromCharCode(code);
        if (marker === '[' || marker === ']') continue;
        assert.equal(context.__tmIsTaskDoneForTailGroup({ taskMarker: marker, done: false }), marker !== ' ' && marker !== '/',
            `all valid markers except space and slash must enter completed groups: ${JSON.stringify(marker)}`);
    }
    assert.equal(context.__tmIsTaskDoneEffective(tasks[2]), false, 'grouping must not count cancellation as successful completion');
    context.SettingsStore.data.completedTasksInlineInGroups = true;
    assert.equal(context.__tmSplitTasksByDoneState(tasks).done.length, 0, 'the existing inline grouping setting must still apply');
    assert.deepEqual(Array.from(context.__tmSplitTasksByDoneState(tasks, { forceSeparateCompletedRootGroup: true }).done, (task) => task.id), ['quit', 'done', 'custom-done']);
    context.SettingsStore.data.legacyWin7CompatMode = true;
    assert.equal(context.__tmIsTaskDoneForTailGroup(tasks[2]), false, 'legacy mode must retain its marker semantics');
    assert.match(kanbanRenderSource, /const columnTaskDone = __tmIsTaskDoneForTailGroup\(columnTask\)/,
        'the standalone kanban completed column must use the same grouping predicate as tail groups');
}

function testStatusTransitionCompletionTime() {
    const context = createStatusContext();
    const options = statusRules.normalizeOptions([
        { id: 'todo', marker: ' ' }, { id: 'doing', marker: '/' },
        { id: 'quit', marker: '-' }, { id: 'done', marker: 'X' }, { id: 'custom', marker: '?' },
    ], false, false);
    let task;
    const oldTime = '2026-09-01T10:00:00+08:00';
    const nextTime = '2026-09-20T10:00:00+08:00';
    Object.assign(context, {
        __tmTaskStateKernel: { getTask: () => task },
        __tmBuildMergedAttrPatch: (_id, patch) => ({ ...patch }),
        __tmNormalizeQueueTaskValue: (_key, value) => value,
        __tmFindStatusOptionById: (id) => options.find(option => option.id === id),
        __tmResolveTaskStatusId: (value) => value.customStatus,
        __tmNormalizeTaskRepeatState: (value) => value || {},
        __tmBuildTaskCompleteAtPatch: () => ({ taskCompleteAt: nextTime }),
        __tmBuildTaskMarkdownWithMarker: (_task, marker) => `- [${marker}] Task`,
    });
    vm.runInContext(extractFunction(apiSource, '__tmIsTaskMarkerClosed'), context);
    vm.runInContext(extractFunction(apiSource, '__tmIsTaskCanceled'), context);
    vm.runInContext(extractFunction(writerRuntimeSource, '__tmBuildTaskCommandPlan'), context);
    for (const before of options) {
        for (const after of options) {
            task = Object.freeze({ id: 'task-1', customStatus: before.id, taskMarker: before.marker,
                done: statusRules.isDone(before.marker), taskCompleteAt: oldTime });
            const plan = context.__tmBuildTaskCommandPlan(task.id, { customStatus: after.id });
            const result = { ...task, ...plan.projectionPatch };
            assert.equal(result.taskCompleteAt, statusRules.isClosed(after.marker)
                ? (before.marker === after.marker ? oldTime : nextTime) : '', `${before.marker} -> ${after.marker} timestamp`);
            assert.equal(result.done, statusRules.isDone(after.marker), 'time tracking must not change success semantics');
        }
    }
    task = { id: 'task-1', taskMarker: '-', customStatus: 'quit', done: false };
    assert.equal(context.__tmBuildTaskCommandPlan(task.id, { customStatus: 'quit' }).normalizedPatch.taskCompleteAt, nextTime,
        'explicitly applying an old cancellation without a timestamp must fill it');
    assert.equal(context.__tmBuildTaskCommandPlan(task.id, { customStatus: 'quit', taskCompleteAt: oldTime }).normalizedPatch.taskCompleteAt, oldTime,
        'an explicit timestamp from undo or native synchronization must remain authoritative');
    Object.assign(context, {
        __tmReadTaskMetaAttrValue: () => '',
        __tmParseTimeToTs: (value) => Date.parse(value),
        __tmNormalizeDateOnly: (value) => String(value).slice(0, 10),
    });
    for (const name of ['__tmResolveTaskCompletedAtRaw', '__tmGetTaskCompletedAtDateKey', '__tmIsTaskCompletedToday']) {
        vm.runInContext(extractFunction(taskModelSource, name), context);
    }
    for (const name of ['__tmGetTaskDoneSortTs', '__tmCompareCompletedTasksRecentFirst']) {
        vm.runInContext(extractFunction(writerRuntimeSource, name), context);
    }
    const canceled = { id: 'quit', done: false, taskMarker: '-', taskCompleteAt: nextTime };
    const completed = { id: 'done', done: true, taskMarker: 'X', taskCompleteAt: oldTime };
    assert.equal(context.__tmResolveTaskCompletedAtRaw(canceled), nextTime, 'cancellation time must be readable in details and table cells');
    assert.deepEqual([completed, canceled].sort(context.__tmCompareCompletedTasksRecentFirst).map(item => item.id), ['quit', 'done'],
        'newly canceled tasks must sort ahead of older completions in every completed group');
    assert.equal(context.__tmIsTaskCompletedToday(canceled, '2026-09-20'), true, 'the completed-group today filter must include today\'s cancellation');
    assert.equal(context.__tmIsTaskDoneEffective(canceled), false, 'sorting and date filtering must not complete cancellation');
    assert.equal(context.__tmResolveTaskCompletedAtRaw({ done: false, taskMarker: '/', taskCompleteAt: oldTime }), '',
        'in-progress tasks must not display stale completion time');
}

async function testMarkerReadbackAndFallback() {
    const context = vm.createContext({
        __tmTaskStatusRules: statusRules,
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
        __tmGetActiveTaskMutationLaneId: (id) => String(id || ''),
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
    let gatewayCalls = 0;
    let blockFallbackCalls = 0;
    context.API = {
        async getBlockKramdown() { return markdown; },
        parseTaskStatus(value) { return { marker: parseMarker(value) }; },
    };
    context.__tmBackendAdapter = {
        async updateBlock(id, nextMarkdown) {
            blockFallbackCalls += 1;
            markdown = nextMarkdown;
            return { id };
        },
    };
    context.__tmExecuteTaskCommandGateway = async () => { gatewayCalls += 1; };
    await assert.rejects(
        () => context.__tmUpdateTaskListItemMarkerWithFallback('task-1', '?'),
        /回读确认|TASK_MARKER_VERIFY_FAILED|marker/,
    );
    assert.equal(gatewayCalls, 1, 'a false-positive success must not trigger a second write');
    assert.equal(blockFallbackCalls, 0, 'normal mode must not overwrite the whole block after verification fails');

    const fallbackCallsBeforeCanonicalX = blockFallbackCalls;
    context.__tmExecuteTaskCommandGateway = async () => {
        gatewayCalls += 1;
        markdown = '* [x] Task';
    };
    const canonicalXResult = await context.__tmUpdateTaskListItemMarkerWithFallback('task-1', 'X');
    assert.equal(canonicalXResult.usedFallback, false);
    assert.equal(blockFallbackCalls, fallbackCallsBeforeCanonicalX, 'kernel X-to-x normalization must not trigger fallback');
    assert.equal(canonicalXResult.marker, 'X');
    assert.equal(parseMarker(canonicalXResult.markdown), 'x');

    let authoritativeReadbackCalls = 0;
    context.API.getBlockKramdown = async () => {
        authoritativeReadbackCalls += 1;
        return '* [ ] Task';
    };
    context.__tmExecuteTaskCommandGateway = async () => ({
        value: { id: 'task-1', marker: 'X', verified: true },
    });
    const authoritativeResult = await context.__tmUpdateTaskListItemMarkerWithFallback('task-1', 'X');
    assert.equal(authoritativeResult.authoritative, true);
    assert.equal(authoritativeReadbackCalls, 0,
        'an authoritative kernel marker receipt must avoid a race-prone UI kramdown readback');

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
    const flat = { id: 'task-1', done: false, taskMarker: ' ', task_marker: ' ', markdown: '* [ ] Task', customFieldValues: {}, __customFieldRawValues: {} };
    const pending = { ...flat };
    const treeTask = { ...flat, children: [] };
    const filteredClone = { ...flat, children: [] };
    const state = {
            flatTasks: { 'task-1': flat },
            pendingInsertedTasks: { 'task-1': pending },
            taskTree: [{ id: 'doc-1', tasks: [treeTask] }],
            filteredTasks: [filteredClone],
    };
    const context = vm.createContext({
        __tmTaskStatusRules: statusRules,
        state,
        __tmNormalizeQueueTaskValue: (key, value) => value,
        __tmNormalizeTaskStatusMarker: (value, fallback = ' ') => Array.from(String(value ?? fallback))[0] || fallback,
        __tmNormalizeCompatTaskStatusMarker: (value, fallback = ' ') => Array.from(String(value ?? fallback))[0] || fallback,
        __tmGetCustomFieldDefMap: () => new Map([['effort', { id: 'effort', type: 'number' }]]),
        __tmNormalizeCustomFieldValue: (_field, value) => Number(value),
        __tmSerializeCustomFieldValue: (_field, value) => String(value),
        __tmTaskStore: {
            mutateLocal(taskId, mutate) {
                const visit = (task) => {
                    if (!task || typeof task !== 'object') return;
                    if (task.id === taskId) mutate(task);
                    (Array.isArray(task.children) ? task.children : []).forEach(visit);
                };
                visit(state.flatTasks[taskId]);
                visit(state.pendingInsertedTasks[taskId]);
                state.taskTree.forEach((doc) => (doc.tasks || []).forEach(visit));
                state.filteredTasks.forEach(visit);
                return true;
            },
        },
    });
    vm.runInContext(extractFunction(apiSource, '__tmApplyQueuedTaskFieldPatchToTask'), context);
    vm.runInContext(extractFunction(apiSource, '__tmApplyTaskFieldPatchToLocalMirrors'), context);
    context.__tmApplyTaskFieldPatchToLocalMirrors('task-1', {
        done: true,
        taskMarker: '?',
        task_marker: '?',
        markdown: '* [?] Task',
        customStatus: 'waiting',
        customFieldValues: { effort: 3 },
        tomatoMinutes: '25',
        tomatoHours: '1',
    });
    for (const task of [flat, pending, treeTask, filteredClone]) {
        assert.equal(task.done, true);
        assert.equal(task.taskMarker, '?');
        assert.equal(task.task_marker, '?');
        assert.equal(task.markdown, '* [?] Task');
        assert.equal(task.customStatus, 'waiting');
        assert.equal(task.custom_status, 'waiting');
        assert.equal(task.customFieldValues.effort, 3);
        assert.equal(task.__customFieldRawValues.effort, '3');
        assert.equal(task.tomatoMinutes, '25');
        assert.equal(task.tomato_minutes, '25');
        assert.equal(task.tomatoHours, '1');
        assert.equal(task.tomato_hours, '1');
    }
}

function testSetDoneQueueMergePreservesRollbackState() {
    const coalesceSource = extractFunction(apiSource, '__tmTryCoalesceQueuedSetDone');
    assert.match(coalesceSource, /String\(op\.status \|\| ''\)\.trim\(\) !== 'queued'/,
        'only the one not-yet-running completion writer may absorb a newer intent');
    assert.match(coalesceSource, /def\.inversePatch[\s\S]*op\.inversePatch/,
        'coalescing must preserve the rollback baseline captured before the first optimistic patch');
    assert.match(coalesceSource, /op\.optimisticApplied = false;[\s\S]*__tmApplySimpleOptimisticPresentation\(op\)/,
        'the final completion intent must replace the existing optimistic overlay immediately');
}

async function testHeldNativeCompletionUsesLogicalBaselineForNextAdvance() {
    const prepareSource = extractFunction(apiSource, '__tmPrepareSetDoneMutationData');
    const completedAt = '2026-09-07T15:38:20.238+08:00';
    const nextCompletedAt = '2026-09-07T15:39:00.000+08:00';
    const task = {
        id: 'task-held',
        done: true,
        taskMarker: 'X',
        taskCompleteAt: completedAt,
        repeatState: { lastCompletedAt: completedAt, pendingNativeDoneReset: true },
    };
    const op = {
        type: 'setDone',
        data: {
            taskId: task.id,
            done: true,
            patch: { done: true, taskCompleteAt: nextCompletedAt },
            taskCompleteAtDerived: true,
        },
        inversePatch: {},
    };
    const localTask = { ...task, ...op.data.patch };
    const context = vm.createContext({
        __tmTaskStatusRules: statusRules,
        Promise,
        SettingsStore: { data: { enablePointsRewardIntegration: false } },
        __tmReadTaskMutationBaseline: async () => ({ ...task }),
        __tmTaskBoundary: { getTask: () => localTask },
        __tmIsRecurringNativeDoneHeld: (value) => value?.repeatState?.pendingNativeDoneReset === true
            && value?.taskCompleteAt === value?.repeatState?.lastCompletedAt,
        __tmIsTaskDoneEffective: (value) => !(value?.repeatState?.pendingNativeDoneReset === true
            && value?.taskCompleteAt === value?.repeatState?.lastCompletedAt) && value?.done === true,
        __tmResolveTaskMarker: (value) => value?.taskMarker || ' ',
        __tmIsTaskCanceled: (value) => value?.taskMarker === '-',
        __tmReadQueuedVerificationField: (value, key) => value?.[key],
        __tmApplyTaskFieldPatchToLocalMirrors: () => true,
        __tmLogRecurringAdvance: () => {},
        __tmUndoState: { applying: false },
    });
    vm.runInContext(`${prepareSource}\nthis.prepare = __tmPrepareSetDoneMutationData;`, context);

    await context.prepare(op);
    assert.equal(op.data.previousDone, false,
        'an optimistic completion timestamp must not hide the held native baseline and skip the next advance');
    assert.equal(op.data.previousStatePrepared, true);
    assert.equal(op.data.patch.taskCompleteAt, nextCompletedAt);
    vm.runInContext(extractFunction(apiSource, '__tmBuildSetDoneEffectsOp'), context);
    assert.equal(context.__tmBuildSetDoneEffectsOp(op).data.completedAt, nextCompletedAt,
        'completing a held occurrence must enqueue its advance without waiting for a reload');

    task.taskCompleteAt = nextCompletedAt;
    Object.assign(localTask, { taskCompleteAt: completedAt });
    const duplicate = {
        type: 'setDone',
        data: {
            taskId: task.id, done: true, taskCompleteAtDerived: true,
            patch: { done: true, taskCompleteAt: '2026-09-07T15:40:00.000+08:00' },
        },
        inversePatch: {},
    };
    await context.prepare(duplicate);
    assert.equal(duplicate.data.previousDone, true,
        'a stale held local snapshot must not override a newer completion from another window');
    assert.equal(Object.hasOwn(duplicate.data.patch, 'taskCompleteAt'), false);
    assert.equal(context.__tmBuildSetDoneEffectsOp(duplicate), null,
        'an already completed occurrence must not advance twice');

    Object.assign(task, { done: false, taskMarker: '-', repeatState: {} });
    const reopen = {
        type: 'setDone',
        data: { taskId: task.id, done: false, patch: { taskCompleteAt: '' }, taskCompleteAtDerived: true },
        inversePatch: {},
    };
    await context.prepare(reopen);
    assert.equal(reopen.data.patch.taskCompleteAt, '', 'reopening cancellation must retain the timestamp clear');
    assert.equal(reopen.inversePatch.taskCompleteAt, nextCompletedAt, 'undo must retain the canceled timestamp');
    assert.equal(context.__tmBuildSetDoneEffectsOp(reopen), null, 'reopening cancellation must not advance or roll back recurrence');
}

async function testCanceledCheckboxReopensWithoutCompletionEffects() {
    const context = createStatusContext();
    const task = Object.freeze({ id: 'quit', taskMarker: '-', done: false, customStatus: 'quit',
        markdown: '- [-] Task', taskCompleteAt: '2026-09-20T10:00:00+08:00' });
    Object.assign(context, {
        __tmBuildCheckboxStatusPatch: () => ({ customStatus: 'todo' }),
        __tmFindStatusOptionById: () => ({ id: 'todo', marker: ' ' }),
        __tmBuildTaskMarkdownWithMarker: (_task, marker) => `- [${marker}] Task`,
        __tmCaptureTaskPatchInverse: () => ({ ...task }),
        __tmReadTaskMutationBaseline: async () => task,
        __tmReadQueuedVerificationField: (value, key) => value[key],
    });
    vm.runInContext(extractFunction(listRuntimeSource, '__tmBuildSetDoneQueuedDefinition'), context);
    vm.runInContext(extractFunction(apiSource, '__tmPrepareSetDoneMutationData'), context);
    vm.runInContext(extractFunction(apiSource, '__tmBuildSetDoneEffectsOp'), context);
    const { definition } = context.__tmBuildSetDoneQueuedDefinition(task.id, false, task);
    assert.equal(definition.data.projectionPatch.taskMarker, ' ');
    assert.equal(definition.data.projectionPatch.customStatus, 'todo');
    assert.equal(definition.data.projectionPatch.taskCompleteAt, '');
    assert.equal(definition.data.projectionPatch.done, false);
    await context.__tmPrepareSetDoneMutationData(definition);
    assert.equal(definition.data.patch.taskCompleteAt, '');
    assert.equal(definition.inversePatch.taskMarker, '-');
    assert.equal(definition.inversePatch.taskCompleteAt, task.taskCompleteAt);
    assert.equal(definition.data.rewardPriorityScore, 0);
    assert.equal(context.__tmBuildSetDoneEffectsOp(definition), null);
}

async function testSetDoneIngressSerialization() {
    const context = vm.createContext({
        __tmTaskStatusRules: statusRules,
        Map,
        Promise,
        Object,
        String,
        window: {},
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

    const requestedStates = [];
    context.__tmSetDoneFromUi = async (_taskId, targetDone) => {
        requestedStates.push(targetDone);
        return true;
    };
    vm.runInContext(extractFunction(listRuntimeSource, 'window.tmSetDone'), context);
    const makeEvent = (checked) => ({
        target: { type: 'checkbox', checked },
        stopPropagation() {},
    });
    await Promise.all([
        context.window.tmSetDone('task-1', true, makeEvent(true)),
        context.window.tmSetDone('task-1', false, makeEvent(false)),
        context.window.tmSetDone('task-1', true, makeEvent(true)),
    ]);
    assert.deepEqual(requestedStates, [true, false, true],
        'serialized completion ingress must preserve every captured checkbox intent in order');
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
        __tmTaskStatusRules: statusRules,
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
        __tmTaskStatusRules: statusRules,
        state,
        __tmIsCollectedOtherBlockTask: () => false,
        __tmIsTaskDoneEffective: (task) => !!task?.done,
        __tmRuntimeState: {
            getTaskById: () => ({ id: 'task-1', done: true }),
        },
        __tmTaskBoundary: {
            getTask: () => ({ id: 'task-1', done: true }),
        },
        __tmTaskStore: {
            getProjected: () => ({ id: 'task-1', done: true }),
        },
        __tmBuildTaskCheckboxStyle: () => '',
        esc: (value) => String(value ?? ''),
    });
    vm.runInContext(extractFunction(taskModelSource, '__tmRenderTaskCheckbox'), context);
    const statusContext = createStatusContext();
    context.__tmIsTaskClosedForDisplay = statusContext.__tmIsTaskClosedForDisplay;

    const staleTask = { id: 'task-1', done: false };
    const liveHtml = context.__tmRenderTaskCheckbox('task-1', staleTask, { checked: false });
    assert.match(liveHtml, /data-task-id="task-1"/);
    assert.match(liveHtml, / checked/);

    state.doneOverrides['task-1'] = false;
    const overrideHtml = context.__tmRenderTaskCheckbox('task-1', staleTask, { checked: true });
    assert.match(overrideHtml, / checked/,
        'checkbox rendering must use the TaskStore projection instead of a stale compatibility override');
    for (const marker of [' ', '/', '-', 'X', '?']) {
        context.__tmTaskStore.getProjected = () => ({ id: 'task-1', taskMarker: marker, done: false });
        assert.equal(/ checked/.test(context.__tmRenderTaskCheckbox('task-1', staleTask)), ![' ', '/'].includes(marker));
    }
    context.__tmTaskStore.getProjected = () => ({ id: 'task-1', taskMarker: 'X', done: true, pendingNativeDoneReset: true });
    assert.doesNotMatch(context.__tmRenderTaskCheckbox('task-1', staleTask), / checked/);
}

function testNativeDocCheckboxUsesTaskStoreProjection() {
    const mutations = [];
    const task = {
        id: 'task-1',
        root_id: 'doc-1',
        done: false,
        taskMarker: ' ',
        task_marker: ' ',
        markdown: '- [ ] Task',
    };
    const context = vm.createContext({
        __tmTaskStatusRules: statusRules,
        globalThis: null,
        state: { doneOverrides: {} },
        __tmTaskBoundary: { getTask: () => task },
        __tmTaskStore: {
            applyMutation(mutation) { mutations.push(mutation); },
        },
        __tmBuildTaskMarkdownWithMarker: (_task, marker) => `- [${marker}] Task`,
        __tmMarkLocalTaskPatchWatermark: () => true,
        __tmReadNativeDocTaskMarkerFromDom: () => '',
        __tmIsTaskMarkerDone: statusRules.isDone,
    });
    context.globalThis = context;
    vm.runInContext(extractFunction(nativeDocHooksSource, '__tmApplyNativeDocCheckboxTaskStorePatch'), context);
    vm.runInContext(extractFunction(nativeDocHooksSource, '__tmApplyNativeDocCheckboxDomProjection'), context);

    assert.equal(context.__tmApplyNativeDocCheckboxDomProjection('task-1', true), true);
    assert.equal(context.__tmApplyNativeDocCheckboxDomProjection('task-1', false), true);
    assert.deepEqual(mutations.map((mutation) => mutation.patch.done), [true, false],
        'native document checkbox transitions must enter TaskStore in DOM order');
    assert.deepEqual(mutations.map((mutation) => mutation.patch.taskMarker), ['X', ' ']);
    for (const marker of ['/', '-']) {
        context.__tmReadNativeDocTaskMarkerFromDom = () => marker;
        context.__tmApplyNativeDocCheckboxDomProjection('task-1', true);
        assert.equal(mutations.at(-1).patch.taskMarker, marker);
        assert.equal(mutations.at(-1).patch.done, false, 'native checked CSS must not complete / or -');
    }
    assert.ok(mutations.every((mutation) => mutation.phase === 'local'),
        'native document checkbox transitions must be local authoritative projections');
    assert.equal(Object.prototype.hasOwnProperty.call(context.state.doneOverrides, 'task-1'), false,
        'native document transitions must not create legacy completion overrides');
}

function testDoneDomPatchTargetsOwnProjectedCheckbox() {
    class FakeElement {
        constructor(classes = []) {
            const values = new Set(classes);
            this.classList = {
                contains: (name) => values.has(name),
                toggle: (name, enabled) => enabled ? values.add(name) : values.delete(name),
            };
            this.attrs = new Map();
            this.innerHTML = '';
        }

        getAttribute(name) { return this.attrs.get(name) || ''; }
        setAttribute(name, value) { this.attrs.set(name, String(value)); }
    }
    class FakeInput extends FakeElement {
        constructor(checked) {
            super(['tm-task-checkbox']);
            this.checked = checked;
        }
    }

    const ownCheckbox = new FakeInput(true);
    const descendantCheckbox = new FakeInput(true);
    const title = new FakeElement(['tm-task-content-clickable', 'tm-task-done', 'is-done']);
    title.innerHTML = '<span class="tm-task-reminder-emoji">badge</span>';
    const titleButton = new FakeElement(['tm-checklist-title-button', 'tm-task-done']);
    const titleWrap = new FakeElement(['tm-checklist-title', 'tm-task-done']);
    const root = new FakeElement(['tm-checklist-item', 'tm-checklist-item--done']);
    root.attrs.set('data-id', 'task-1');
    root.querySelector = (selector) => {
        if (selector.includes('data-task-id="task-1"')) return ownCheckbox;
        if (selector === '.tm-task-checkbox') return descendantCheckbox;
        return null;
    };
    root.querySelectorAll = (selector) => selector.includes('.tm-checklist-title')
        ? [titleWrap, titleButton, title]
        : [];
    const context = vm.createContext({
        __tmTaskStatusRules: statusRules,
        Element: FakeElement,
        HTMLElement: FakeElement,
        HTMLInputElement: FakeInput,
        CSS: { escape: (value) => String(value) },
        globalThis: null,
        __tmTaskProjectionEngine: {
            isTaskCompleted: (task) => String(task?.taskMarker || '') === 'X',
        },
        __tmTaskStore: {
            getProjected: (taskId) => taskId === 'task-1'
                ? { id: 'task-1', content: 'Task', markdown: '- [ ] Task', done: false, taskMarker: ' ', task_marker: ' ' }
                : null,
        },
        __tmDoesTaskDomTargetBelongToTask: () => true,
    });
    context.globalThis = context;
    vm.runInContext(extractFunction(writerRuntimeSource, '__tmIsTaskCompletedForProjection'), context);
    context.__tmIsTaskClosedForDisplay = createStatusContext().__tmIsTaskClosedForDisplay;
    vm.runInContext(extractFunction(writerRuntimeSource, '__tmUpdateTaskDoneInDOM'), context);

    assert.equal(context.__tmUpdateTaskDoneInDOM(root, { id: 'task-1', done: true, taskMarker: 'X' }), true);
    assert.equal(ownCheckbox.checked, false,
        'a stale completed receipt must not replace the latest canceled completion projection');
    assert.equal(descendantCheckbox.checked, true,
        'a parent or duplicated card patch must not overwrite a descendant task checkbox');
    assert.equal(title.classList.contains('tm-task-done'), false,
        'canceling completion must clear the title completion class');
    assert.equal(title.classList.contains('is-done'), false,
        'canceling completion must clear legacy title completion classes');
    assert.equal(root.classList.contains('tm-checklist-item--done'), false,
        'canceling completion must clear the checklist row completion style');
    assert.equal(titleWrap.classList.contains('tm-task-done'), false);
    assert.equal(titleButton.classList.contains('tm-task-done'), false);
    assert.equal(title.innerHTML, '<span class="tm-task-reminder-emoji">badge</span>',
        'completion patches must preserve view-specific inline badges while clearing stale title styling');
    for (const marker of ['-', '/']) {
        context.__tmTaskStore.getProjected = () => ({ id: 'task-1', taskMarker: marker, done: false });
        context.__tmUpdateTaskDoneInDOM(root, { id: 'task-1', done: false });
        assert.equal(ownCheckbox.checked, marker === '-');
        assert.equal(root.classList.contains('tm-checklist-item--done'), marker === '-');
        assert.equal(descendantCheckbox.checked, true);
    }
}

function testTaskDetailCompletionReadsUseLatestProjection() {
    const projectedChild = {
        id: 'task-child',
        done: false,
        taskMarker: ' ',
        task_marker: ' ',
        markdown: '- [ ] Child',
        children: [],
    };
    const staleChild = {
        id: 'task-child',
        done: true,
        taskMarker: 'X',
        task_marker: 'X',
        markdown: '- [X] Child',
        children: [],
    };
    const projectedParent = {
        id: 'task-parent',
        done: false,
        taskMarker: ' ',
        task_marker: ' ',
    };
    const structuralParent = {
        id: 'task-parent',
        done: true,
        taskMarker: 'X',
        task_marker: 'X',
        children: [staleChild],
    };
    const context = vm.createContext({
        __tmTaskStatusRules: statusRules,
        globalThis: null,
        __tmTaskProjectionEngine: {
            isTaskCompleted: (task) => String(task?.taskMarker || '') === 'X',
        },
        __tmTaskStore: {
            getProjected: (taskId) => taskId === 'task-child'
                ? projectedChild
                : (taskId === 'task-parent' ? projectedParent : null),
        },
        __tmTaskBoundary: {
            getTask: (taskId) => taskId === 'task-child'
                ? staleChild
                : (taskId === 'task-parent' ? structuralParent : null),
        },
        __tmResolveTaskDetailEffectiveId: (taskId) => taskId,
        __tmCountTaskDetailRawSubtasks: (task) => Array.isArray(task?.children) ? task.children.length : 0,
        __tmPreferWhiteboardSnapshotForPlaceholderTask: (task) => task,
        __tmTaskStateKernel: { getTask: () => null },
    });
    context.globalThis = context;
    vm.runInContext(extractFunction(writerRuntimeSource, '__tmIsTaskCompletedForProjection'), context);
    vm.runInContext(extractFunction(writerRuntimeSource, '__tmBuildTaskDetailSubtaskTree'), context);
    vm.runInContext(extractFunction(taskDetailSource, '__tmGetTaskDetailTaskById'), context);

    const tree = context.__tmBuildTaskDetailSubtaskTree([staleChild], true);
    assert.equal(tree[0]?.taskMarker, ' ',
        'detail subtask rebuilding must prefer the latest child projection over a stale completed snapshot');
    assert.equal(context.__tmGetTaskDetailTaskById('task-child')?.taskMarker, ' ',
        'detail task reads must prefer the latest projection over the raw task boundary');
    const parent = context.__tmGetTaskDetailTaskById('task-parent');
    assert.equal(parent?.taskMarker, ' ',
        'detail root fields must still come from the latest projection');
    assert.deepEqual(Array.from(parent?.children || [], (child) => child.id), ['task-child'],
        'a shallow field projection must preserve the richer raw detail subtree');
}


function testNativeStatusCompatibility() {
    const kernelSource = fs.readFileSync(path.join(__dirname, '..', 'kernel.js'), 'utf8');
    assert.equal(extractFunction(kernelSource, 'createTaskStatusRules').replace('createTaskStatusRules', '__tmCreateTaskStatusRules').replace(/\r\n/g, '\n'),
        extractFunction(apiSource, '__tmCreateTaskStatusRules').replace(/\r\n/g, '\n'), 'isolated frontend/kernel runtimes must use identical rules');
    const existing = [
        { id: 'todo', name: '待办', marker: ' ' },
        { id: 'waiting', name: '等待', marker: ' ' },
        { id: 'my_progress', name: '进行', color: '#123456', marker: '/' },
        { id: 'my_cancel', name: '放弃', marker: '-' },
        { id: 'done', name: '完成', marker: 'x' },
    ];
    const options = statusRules.normalizeOptions(existing);
    assert.equal(options.length, existing.length);
    assert.deepEqual(JSON.parse(JSON.stringify(options[2])), existing[2], 'reuse the user’s / ID, name and color');
    assert.equal(options.at(-1).marker, 'X');
    assert.equal(statusRules.resolveOption('/', 'done', options).id, 'my_progress');
    assert.equal(statusRules.resolveOption(' ', 'waiting', options, 'todo').id, 'waiting');
    assert.equal(statusRules.resolveOption(' ', 'done', options, 'waiting').id, 'waiting');
    const duplicates = statusRules.normalizeOptions([...existing, { id: 'other_progress', name: '另一进行', marker: '/' }]);
    assert.equal(duplicates.length, existing.length + 1, 'legacy duplicate IDs must survive');
    assert.equal(statusRules.resolveOption('/', 'other_progress', duplicates).id, 'other_progress');
    assert.equal(statusRules.resolveOption('/', 'todo', duplicates).id, 'my_progress');
    assert.equal(statusRules.conflicts(duplicates).length, 1, 'spaces may repeat');
    assert.equal(statusRules.conflicts([...existing, { id: 'other_done', marker: 'X' }]).length, 1, 'x and X conflict');
    const occupied = [{ id: 'in_progress', name: '旧进行', marker: ' ' }, { id: 'cancelled', name: '旧取消', marker: '?' }];
    const filled = statusRules.normalizeOptions(occupied);
    assert.equal(filled.find((item) => item.marker === '/').id, 'in_progress_native');
    assert.equal(filled.find((item) => item.marker === '-').id, 'cancelled_native');
    assert.equal(filled.find((item) => item.marker === '-').name, '放弃');
    assert.equal(JSON.stringify(statusRules.normalizeOptions(filled)), JSON.stringify(filled), 'normalization is idempotent');
    assert.equal(statusRules.normalizeOptions(occupied, true).length, occupied.length, 'legacy mode does not fill native statuses');
    const untouchedLegacyDefaults = [
        { id: 'todo', name: '待办', color: '#757575', marker: ' ' },
        { id: 'done', name: '已完成', color: '#4CAF50', marker: 'X' },
        { id: 'cancelled', name: '已取消', color: '#9E9E9E', marker: '-' },
        { id: 'blocked', name: '阻塞', color: '#F44336', marker: ' ' },
        { id: 'review', name: '待审核', color: '#FF9800', marker: ' ' },
    ];
    const upgradedLegacyDefaults = statusRules.normalizeOptions(untouchedLegacyDefaults);
    assert.equal(upgradedLegacyDefaults.length, untouchedLegacyDefaults.length + 1);
    assert.equal(upgradedLegacyDefaults.find((item) => item.id === 'cancelled').name, '放弃');
    assert.deepEqual(JSON.parse(JSON.stringify(upgradedLegacyDefaults.find((item) => item.id === 'in_progress'))), {
        id: 'in_progress', name: '进行中', color: '#2196F3', marker: '/',
    });
    const markerlessLegacyDefaults = untouchedLegacyDefaults.map(({ marker, ...item }) => item);
    assert.equal(JSON.stringify(statusRules.normalizeOptions(markerlessLegacyDefaults)), JSON.stringify(upgradedLegacyDefaults),
        'untouched defaults from before the marker field must also upgrade');
    assert.equal(JSON.stringify(statusRules.normalizeOptions(upgradedLegacyDefaults)), JSON.stringify(upgradedLegacyDefaults));
    assert.equal(statusRules.normalizeOptions(untouchedLegacyDefaults, true).length, untouchedLegacyDefaults.length);
    assert.equal(statusRules.normalizeOptions(untouchedLegacyDefaults, false, false).length, untouchedLegacyDefaults.length,
        'editing and saving must not trigger startup migration');
    for (const edit of [
        (items) => { items[0].name = '稍后处理'; },
        (items) => { items[0].id = 'my_todo'; },
        (items) => { items[0].color = '#123456'; },
        (items) => { items[0].marker = '?'; },
        (items) => { [items[0], items[1]] = [items[1], items[0]]; },
    ]) {
        const customized = untouchedLegacyDefaults.map((item) => ({ ...item }));
        edit(customized);
        const normalized = statusRules.normalizeOptions(customized);
        assert.equal(JSON.stringify(normalized.slice(0, customized.length)), JSON.stringify(customized),
            'edited presets must retain existing IDs, names, colors, markers and order');
        assert.equal(normalized.find((item) => item.id === 'cancelled').name, '已取消',
            'only the complete untouched legacy defaults may be replaced');
    }
    const namedNative = statusRules.normalizeOptions([
        { id: 'progress_named', name: '进行中' },
        { id: 'cancel_named', name: '放弃' },
    ]);
    assert.equal(namedNative.find((item) => item.id === 'progress_named').marker, ' ', '名称不能伪造 / 标记');
    assert.equal(namedNative.find((item) => item.id === 'cancel_named').marker, ' ', '名称不能伪造 - 标记');
    assert.equal(namedNative.filter((item) => item.marker === '/').length, 1, '只根据 / 标记判断是否需要补状态');
    assert.equal(namedNative.filter((item) => item.marker === '-').length, 1, '只根据 - 标记判断是否需要补状态');
    const arbitraryNames = [
        { id: 'working', name: '处理中', marker: '/' },
        { id: 'closed', name: '不做了', marker: '-' },
    ];
    assert.equal(statusRules.normalizeOptions(arbitraryNames).length, 2, '已有 / 和 - 时，无论名称是什么都不补状态');
    const guessContext = vm.createContext({
        text: (value) => String(value ?? '').trim(),
        __tmNormalizeTaskStatusMarker: statusRules.normalizeMarker,
    });
    vm.runInContext(extractFunction(apiSource, '__tmGuessStatusOptionDefaultMarker'), guessContext);
    vm.runInContext(extractFunction(kernelSource, 'guessStatusMarker'), guessContext);
    for (const option of [
        { id: 'in_progress', name: '进行中' },
        { id: 'cancelled', name: '放弃' },
        { id: 'canceled', name: '取消' },
        { id: 'cancel', name: '已放弃' },
    ]) {
        assert.equal(statusRules.guessMarker(option), ' ');
        assert.equal(guessContext.__tmGuessStatusOptionDefaultMarker(option), ' ');
        assert.equal(guessContext.guessStatusMarker(option), ' ');
        for (const marker of [' ', '?']) {
            assert.equal(statusRules.normalizeOptions([{ ...option, marker }])[0].marker, marker,
                '既有状态标记不因名称或 ID 改写');
        }
    }

    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE tasks(markdown TEXT)');
    const insert = db.prepare('INSERT INTO tasks VALUES (?)');
    for (const marker of [' ', '/', '-', 'x', 'X', '?', '>']) {
        for (const prefix of ['- ', '* ', '1. ', '- {: id="task"}']) {
            const markdown = `${prefix}[${marker}] Title with [x]\n\n  - [x] Completed child`;
            insert.run(markdown);
            const result = db.prepare(`SELECT ${statusRules.sqlMarker('markdown')} AS marker, ${statusRules.sqlDone('markdown')} AS done FROM tasks ORDER BY rowid DESC LIMIT 1`).get();
            assert.equal(result.marker, statusRules.fromMarkdown(markdown));
            assert.equal(Boolean(result.done), statusRules.isDone(marker));
        }
    }
    db.close();

    const importSource = fs.readFileSync(path.join(__dirname, '..', 'src/task-horizon/main/settings/64-export-runtime.js'), 'utf8');
    const context = vm.createContext({ __tmTaskStatusRules: statusRules, SettingsStore: { data: { customStatusOptions: existing, theme: 'old' } } });
    vm.runInContext(extractFunction(importSource, '__tmCloneMigrationValue'), context);
    vm.runInContext(extractFunction(importSource, '__tmMergeArrayById'), context);
    vm.runInContext(extractFunction(importSource, '__tmApplyMigrationSettingsPatch'), context);
    assert.throws(() => context.__tmApplyMigrationSettingsPatch({ theme: 'new', customStatusOptions: [{ id: 'conflict', marker: '/' }] }, 'settings'), /语法标记重复/);
    assert.equal(context.SettingsStore.data.theme, 'old', 'conflicting import must not partly mutate settings');
}


async function testDuplicateMarkerSettingsWarning() {
    const settingsSource = fs.readFileSync(path.join(__dirname, '..', 'src/task-horizon/main/settings/62-settings-columns-and-rules.js'), 'utf8');
    const hints = [];
    let saves = 0;
    const options = statusRules.normalizeOptions([{ id: 'todo', marker: ' ' }, { id: 'done', marker: 'X' }, { id: 'doing', name: '进行', marker: '/' }]);
    const context = vm.createContext({
        __tmTaskStatusRules: statusRules,
        window: {}, state: {}, SettingsStore: { data: { customStatusOptions: options }, save: async () => { saves++; } },
        hint: (...args) => hints.push(args), showSettings: () => {}, render: () => {},
        __tmIsLegacyWin7CompatMode: () => false,
        __tmNormalizeTaskStatusMarker: statusRules.normalizeMarker,
        __tmGuessStatusOptionDefaultMarker: statusRules.guessMarker,
        __tmGetStatusOptionDraft: () => ({ id: 'another', name: '新增状态', marker: '/' }),
        __tmFocusStatusOptionDraftField: () => {},
        showConfirm: async () => true,
        __tmNormalizeCustomStatusOptions: (options, fillNative = true) => statusRules.normalizeOptions(options, false, fillNative),
        __tmGetStatusOptions: (options) => statusRules.normalizeOptions(options),
        __tmNormalizeCompatTaskStatusMarker: statusRules.normalizeMarker,
        __tmNormalizeHexColor: (color, fallback) => color || fallback,
        __tmGetStatusPresetColor: () => '#757575',
        __tmFormatStatusMarkerText: (marker) => marker === ' ' ? '空格' : marker,
        esc: (value) => String(value ?? ''),
    });
    for (const name of ['__tmNormalizeCheckboxStatusBindingValue', '__tmGetCheckboxStatusBindingFallbackId', '__tmNormalizeCheckboxStatusBindingConfig']) {
        vm.runInContext(extractFunction(apiSource, name), context);
    }
    vm.runInContext(extractFunction(settingsSource, '__tmGetCompatStatusOptionMarker'), context);
    for (const name of ['renderStatusOptionsList', 'saveStatusOptionDraft', 'updateStatusOption', 'deleteStatusOption']) {
        const start = settingsSource.indexOf(`    window.${name} = `);
        const end = settingsSource.indexOf('\n    };', start) + '\n    };'.length;
        vm.runInContext(settingsSource.slice(start, end), context);
    }
    context.__tmGetStatusOptionDraft = () => ({ id: 'another', name: '新增状态', marker: ' ' });
    const html = context.window.renderStatusOptionsList();
    assert.match(html, /value="" onchange="updateStatusOption\(0, 'marker'/,
        'blank status input must not contain an invisible space that typing appends to');
    assert.match(html, /data-tm-status-option-draft-marker type="text" value=""/);
    for (const marker of ['/', ' /', '/ ', ' / ', ' - ', ' x ']) {
        context.__tmGetStatusOptionDraft = () => ({ id: 'another', name: '新增状态', marker });
        await context.window.saveStatusOptionDraft();
        assert.equal(saves, 0);
        assert.match(hints.at(-1)[0], /标记已被其他状态使用.*只有空格可以重复/);
        assert.equal(hints.at(-1)[1], 'warning');
    }
    for (const marker of ['/', '-', 'x', 'X', ' /', '/ ', ' - ', ' x ']) {
        await context.window.updateStatusOption(0, 'marker', marker);
        assert.equal(options[0].marker, ' ', 'duplicate edit must keep the previous value');
        assert.equal(saves, 0);
        assert.match(hints.at(-1)[0], /标记已被其他状态使用.*只有空格可以重复/);
        assert.equal(hints.at(-1)[1], 'warning');
    }
    for (const marker of ['//', '/ -', '[', ']', '／']) {
        context.__tmGetStatusOptionDraft = () => ({ id: 'another', name: '新增状态', marker });
        await context.window.saveStatusOptionDraft();
        assert.match(hints.at(-1)[0], /状态标记必须是单个字节字符/);
        await context.window.updateStatusOption(0, 'marker', marker);
        assert.match(hints.at(-1)[0], /状态标记必须是单个字节字符/);
        assert.equal(options[0].marker, ' ');
        assert.equal(saves, 0, 'invalid nonblank input must still be rejected');
    }
    await context.window.updateStatusOption(2, 'marker', '   ');
    assert.equal(options[2].marker, ' ', 'multiple blank statuses are allowed');
    assert.equal(saves, 1);
    await context.window.deleteStatusOption(options.findIndex((item) => item.marker === '-'));
    context.__tmNormalizeCheckboxStatusBindingConfig(context.SettingsStore.data); // saving must not recreate it
    assert.equal(context.SettingsStore.data.customStatusOptions.some((item) => item.marker === '-'), false);
    await context.window.updateStatusOption(0, 'marker', ' - ');
    assert.equal(context.SettingsStore.data.customStatusOptions[0].marker, '-');
    assert.equal(context.SettingsStore.data.customStatusOptions[0].id, 'todo', 'reassignment preserves the existing ID');
    context.__tmNormalizeCheckboxStatusBindingConfig(context.SettingsStore.data, true); // next startup
    assert.equal(context.SettingsStore.data.customStatusOptions.filter((item) => item.marker === '-').length, 1);
    assert.equal(context.SettingsStore.data.customStatusOptions.find((item) => item.marker === '-').id, 'todo');
    assert.equal(context.SettingsStore.data.customStatusOptions.filter((item) => item.marker === '/').length, 1);
    const progressIndex = context.SettingsStore.data.customStatusOptions.findIndex((item) => item.marker === '/');
    await context.window.deleteStatusOption(progressIndex);
    context.__tmNormalizeCheckboxStatusBindingConfig(context.SettingsStore.data);
    assert.equal(context.SettingsStore.data.customStatusOptions.some((item) => item.marker === '/'), false);
    await context.window.updateStatusOption(2, 'marker', ' / ');
    context.__tmNormalizeCheckboxStatusBindingConfig(context.SettingsStore.data, true);
    assert.equal(context.SettingsStore.data.customStatusOptions.filter((item) => item.marker === '/').length, 1);
    assert.equal(context.SettingsStore.data.customStatusOptions.find((item) => item.marker === '/').id, 'doing');
    await context.window.deleteStatusOption(context.SettingsStore.data.customStatusOptions.findIndex((item) => item.marker === '/'));
    context.__tmGetStatusOptionDraft = () => ({ id: 'another', name: '进行', marker: ' / ' });
    const hintsBeforeSave = hints.length;
    await context.window.saveStatusOptionDraft();
    assert.equal(hints.length, hintsBeforeSave, 'surrounding spaces must not block a valid new status');
    assert.equal(context.SettingsStore.data.customStatusOptions.find((item) => item.id === 'another').marker, '/');
}

async function run() {
    await testDuplicateMarkerSettingsWarning();
    testNativeStatusCompatibility();
    await testMarkerRulesAndStatusResolution();
    testTaskDetailPreservesConfiguredStatusMarkers();
    testStatusTransitionCompletionTime();
    testCanceledTasksUseCompletedGroups();
    await testMarkerReadbackAndFallback();
    testLocalMirrorPatch();
    testSetDoneQueueMergePreservesRollbackState();
    await testHeldNativeCompletionUsesLogicalBaselineForNextAdvance();
    await testCanceledCheckboxReopensWithoutCompletionEffects();
    await testSetDoneIngressSerialization();
    testDoneOverrideSurvivesStaleReload();
    testTaskCheckboxRenderUsesLiveDoneState();
    testNativeDocCheckboxUsesTaskStoreProjection();
    testDoneDomPatchTargetsOwnProjectedCheckbox();
    testTaskDetailCompletionReadsUseLatestProjection();
    assert.match(doneRuntimeSource, /function __tmApplyDoneStateToLocalMirrors[\s\S]*__tmApplyTaskFieldPatchToLocalMirrors/);
    assert.match(listRuntimeSource, /previousMarker:[\s\S]*previousMarkdown:/);
    const setDoneKernelSource = extractFunction(listRuntimeSource, '__tmSetDoneKernel');
    assert.match(setDoneKernelSource, /await __tmPersistMetaAndAttrsKernel\(id, touchPatch[\s\S]*set-done-status-link/);
    assert.doesNotMatch(setDoneKernelSource, /__tmRequireTaskMutation\?\.\('patchTask'\)/);
    assert.match(setDoneKernelSource, /await __tmPersistMetaAndAttrsKernel\(id, touchPatch[\s\S]*catch \(statusErr\)[\s\S]*__tmUpdateTaskListItemMarkerWithFallback\(id, originalMarker\)[\s\S]*throw statusErr/);
    assert.doesNotMatch(setDoneKernelSource, /ev\.preventDefault\(\)/);
    assert.match(setDoneKernelSource, /if \(taskWasDone === targetDone && !__tmIsTaskCanceled\(task\) && opts\.force !== true\) return/);
    assert.match(setDoneKernelSource, /type: 'setDone'[\s\S]*patch: undoPatch[\s\S]*inversePatch/);
    assert.match(writerRuntimeSource, /__tmBuildTaskCommandPlan\(tid, nextPatch, opts\)[\s\S]*statusBefore:[\s\S]*skipNoopCheck: opts\.skipNoopCheck === true,[\s\S]*attrTargetId:/,
        'the unified mutation definition must carry status baseline and attribute routing options together');
    assert.match(writerRuntimeSource, /type: 'taskPatch'[\s\S]*data: \{[\s\S]*statusBefore:[\s\S]*\},[\s\S]*inversePatch/,
        'a task field write and its rollback baseline must remain one queued operation');
    assert.match(apiSource, /function __tmPrepareSetDoneMutationData[\s\S]*data\.previousStatusId = previousStatusId/,
        'the set-done command must capture its kernel baseline before execution');
    assert.match(writerRuntimeSource, /statusPatch\.customStatus[\s\S]*targetStatus[\s\S]*normalizedPatch\.done = __tmIsTaskMarkerDone\(targetMarker\)/,
        'custom status changes must derive done from the target marker before choosing the mutation path');
    assert.match(apiSource, /__tmRollbackDoneOptimisticLocal\([\s\S]*previousMarker:[\s\S]*previousMarkdown:/);
    assert.doesNotMatch(apiSource, /function __tmApplyTaskStatus\(/,
        'the removed marker-then-attrs status writer must not return');
    const committedEffectsSource = extractFunction(listRuntimeSource, '__tmRunCommittedSetDoneEffects');
    assert.match(committedEffectsSource, /!targetDone[\s\S]*__tmClearRecurringTaskAdvanceTimer\(tid\)/,
        'changing a status marker back to empty must cancel pending recurring-task advancement');
    assert.match(committedEffectsSource, /previousDone === true[\s\S]*rewardPriorityScore[\s\S]*repeatRule/,
        'status completion effects must remain behind the committed set-done transition');
    const nativeCheckboxSyncSource = extractFunction(nativeDocHooksSource, '__tmSyncNativeDocCheckboxLinkedStatus');
    const nativeCheckboxLocalStateSource = extractFunction(nativeDocHooksSource, '__tmApplyNativeDocCheckboxLocalState');
    assert.doesNotMatch(nativeDocHooksSource, /__tmNativeDocCheckboxSyncIgnoreMap|__tmConsumeNativeDocCheckboxStatusSyncIgnore/,
        'the unreachable plugin-origin checkbox ignore queue must not return');
    assert.match(nativeCheckboxSyncSource, /const persistedAttrsBefore = await __tmReadDocCheckboxBlockAttrs/,
        'native checkbox synchronization must still reconcile against persisted task attributes');
    assert.match(nativeCheckboxSyncSource, /domMarker === ' ' && userInitiatedCheckboxChange[\s\S]*__tmIsRecurringNativeDoneHeld\([\s\S]*previousMarker[\s\S]*__tmDeleteTaskRepeatHistoryEntry/,
        'only a user-originated native uncheck may roll back a held recurring completion');
    const setDoneFromUiSource = extractFunction(listRuntimeSource, '__tmSetDoneFromUi');
    assert.match(setDoneFromUiSource, /!targetDone[\s\S]*__tmIsRecurringNativeDoneHeld\(task\)[\s\S]*__tmDeleteTaskRepeatHistoryEntry[\s\S]*resetNativeDone: true/,
        'unchecking a held recurring task inside the plugin must use the history rollback transaction');
    assert.match(apiSource, /kernelPreviousDone[\s\S]*nativeDoneHeld[\s\S]*effectivePreviousDone[\s\S]*const previousDone = kernelPreviousDone[\s\S]*effectivePreviousDone === false/,
        'a held native completion must use the plugin effective state as the next occurrence baseline');
    assert.match(listRuntimeSource, /__tmDeleteTaskRepeatHistoryEntry\(recurringSourceTaskId, recurringCompletedAt, \{[\s\S]*resetNativeDone: true/,
        'deleting the latest visible recurring record must not leave its native completion marker behind');
    assert.match(listRuntimeSource, /__tmIsRecurringNativeDoneHeld\(task\)[\s\S]*循环完成记录已丢失/,
        'a held task without a matching history record must fail visibly instead of becoming a no-op');
    assert.doesNotMatch(nativeCheckboxLocalStateSource, /doneOverrides/,
        'native document checkbox state must not create a compatibility override');
    assert.match(nativeDocHooksSource, /globalThis\.__tmTaskStore\?\.applyMutation\?\./,
        'native document checkbox state must use the shared TaskStore mutation path');
    assert.doesNotMatch(nativeDocHooksSource, /__tmPushNativeDocCheckboxTrace|__tmPushDiagnosticLog/,
        'temporary native checkbox diagnostics must not ship in production runtime');
    assert.doesNotMatch(taskModelSource, /pendingDoneWrite[\s\S]*disabledAttr/);
    assert.doesNotMatch(extractFunction(taskModelSource, '__tmRenderTaskCheckbox'), /doneOverrides/);
    assert.match(taskModelSource, /__tmTaskStore\?\.getProjected\?\.[\s\S]*__tmTaskBoundary\?\.getTask\?\.[\s\S]*__tmIsTaskClosedForDisplay[\s\S]*checkedAttr/);
    assert.match(taskModelSource, /data-task-id=/);
    assert.doesNotMatch(writerRuntimeSource, /checkbox\.checked\s*=\s*!!task\.done/,
        'mounted view checkboxes must use the shared effective completion projection');
    const viewControllersSource = writerRuntimeSource.slice(
        writerRuntimeSource.indexOf('const __tmViewControllers ='),
        writerRuntimeSource.indexOf('function __tmSyncVisibleCalendarTaskPatch(', writerRuntimeSource.indexOf('const __tmViewControllers =')),
    );
    assert.doesNotMatch(viewControllersSource, /const task = __tmTaskStateKernel\.getTask\(/,
        'view field controllers must not render status, completion time, or styling from the raw task mirror');
    assert.ok((viewControllersSource.match(/__tmTaskStore\?\.getProjected\?\./g) || []).length >= 5,
        'list, checklist, timeline, kanban, and whiteboard controllers must prefer the shared task projection');
    const kanbanProjectionSource = extractFunction(writerRuntimeSource, '__tmTryApplyKanbanOptimisticProjectionInPlace');
    assert.match(kanbanProjectionSource, /storedProjection[\s\S]*taskMarker[\s\S]*projectedTask\[field\] = storedProjection\[field\]/,
        'kanban visibility must preserve the latest projected completion fields over an older refresh patch');
    assert.doesNotMatch(listRuntimeSource, /ignored while pending/);
    assert.doesNotMatch(listRuntimeSource, /hasPendingDoneWrite/);
    assert.doesNotMatch(listRuntimeSource, /ignored stale checkbox state/);
    assert.match(listRuntimeSource, /const targetDone = !!done[\s\S]*input\.checked = targetDone[\s\S]*__tmSetDoneFromUi\(tid, targetDone/);
    assert.doesNotMatch(extractFunction(listRuntimeSource, 'window.tmSetDone'), /!liveDone/);
    assert.match(listRuntimeSource, /const setDoneOptions = input[\s\S]*wait: false[\s\S]*__tmSetDoneFromUi\(tid, targetDone, ev, setDoneOptions\)/,
        'checkbox input must release after optimistic enqueue while the task lane preserves kernel order');
    assert.match(doneRuntimeSource, /targetStatusId[\s\S]*targetMarker = __tmNormalizeCompatTaskStatusMarker[\s\S]*__tmApplyDoneStateToLocalMirrors\(tid, task, done, targetMarker\)/,
        'optimistic completion must use the configured status marker instead of a generic marker');
    const buildSetDoneSource = extractFunction(listRuntimeSource, '__tmBuildSetDoneQueuedDefinition');
    assert.match(buildSetDoneSource, /const projectionPatch = \{[\s\S]*taskMarker: targetMarker,[\s\S]*task_marker: targetMarker,[\s\S]*markdown: __tmBuildTaskMarkdownWithMarker\(taskLike, targetMarker\)/,
        'the completion overlay must atomically override marker and markdown with done/status');
    assert.match(buildSetDoneSource, /patch: optimisticPatch,[\s\S]*projectionPatch,/,
        'completion persistence and presentation fields must remain in one command but separate patches');
    assert.match(listRuntimeSource, /effectiveTaskDone[\s\S]*originalDone[\s\S]*inversePatch\.done = originalDone/);
    assert.match(listRuntimeSource, /const currentDone = typeof __tmIsTaskDoneEffective[\s\S]*const explicitCheckboxIntent[\s\S]*if \(currentDone === targetDone && !__tmIsTaskCanceled\(task\) && !explicitCheckboxIntent && opts\.force !== true\) return/,
        'an explicit checkbox intent must enter the mutation queue even when a local projection already matches it');
    assert.ok((storesSource.match(/__tmApplyDoneOverrideToTaskIfPresent\((?:task|target)\)/g) || []).length >= 4);
    assert.match(storesSource, /function __tmMergeLocalTaskPatchIntoTask\(task\)[\s\S]*__tmApplyDoneOverrideToTaskIfPresent\(target\)/);
    const globalLockSource = listRuntimeSource.slice(
        listRuntimeSource.indexOf('const GlobalLock ='),
        listRuntimeSource.indexOf('// ============ DOM 回退树状态保护器'),
    );
    assert.doesNotMatch(globalLockSource, /querySelectorAll|\.disabled\s*=|classList\.(?:add|remove)\('tm-operating'/,
        'the legacy fallback lock must not disable task checkboxes globally');
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
    for (const source of [stateRuntimeSource, taskDetailSource, kanbanRenderSource]) {
        assert.doesNotMatch(source, /CompletionRestore|__tmCompletionRestoreDirectTrace/,
            'temporary completion-restore console tracing must not ship in production runtime');
    }
    assert.doesNotMatch(writerRuntimeSource, /KanbanCompletion|__tmLogKanbanCompletionDirect/,
        'temporary kanban completion console tracing must not ship in production runtime');
    assert.doesNotMatch(stateRuntimeSource, /pushTaskTrace\('mutation'/,
        'the mutation bus must not duplicate every mutation into two in-memory logs');
    console.log('task completion consistency tests passed');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
