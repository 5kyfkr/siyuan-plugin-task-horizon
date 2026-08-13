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

async function testSetDoneIngressSerialization() {
    const context = vm.createContext({
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

    const staleTask = { id: 'task-1', done: false };
    const liveHtml = context.__tmRenderTaskCheckbox('task-1', staleTask, { checked: false });
    assert.match(liveHtml, /data-task-id="task-1"/);
    assert.match(liveHtml, / checked/);

    state.doneOverrides['task-1'] = false;
    const overrideHtml = context.__tmRenderTaskCheckbox('task-1', staleTask, { checked: true });
    assert.match(overrideHtml, / checked/,
        'checkbox rendering must use the TaskStore projection instead of a stale compatibility override');
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
        globalThis: null,
        state: { doneOverrides: {} },
        __tmTaskBoundary: { getTask: () => task },
        __tmTaskStore: {
            applyMutation(mutation) { mutations.push(mutation); },
        },
        __tmBuildTaskMarkdownWithMarker: (_task, marker) => `- [${marker}] Task`,
        __tmMarkLocalTaskPatchWatermark: () => true,
    });
    context.globalThis = context;
    vm.runInContext(extractFunction(nativeDocHooksSource, '__tmApplyNativeDocCheckboxTaskStorePatch'), context);
    vm.runInContext(extractFunction(nativeDocHooksSource, '__tmApplyNativeDocCheckboxDomProjection'), context);

    assert.equal(context.__tmApplyNativeDocCheckboxDomProjection('task-1', true), true);
    assert.equal(context.__tmApplyNativeDocCheckboxDomProjection('task-1', false), true);
    assert.deepEqual(mutations.map((mutation) => mutation.patch.done), [true, false],
        'native document checkbox transitions must enter TaskStore in DOM order');
    assert.deepEqual(mutations.map((mutation) => mutation.patch.taskMarker), ['X', ' ']);
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

async function run() {
    await testMarkerRulesAndStatusResolution();
    await testMarkerReadbackAndFallback();
    testLocalMirrorPatch();
    testSetDoneQueueMergePreservesRollbackState();
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
    assert.match(setDoneKernelSource, /if \(taskWasDone === targetDone && opts\.force !== true\) return/);
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
    assert.doesNotMatch(nativeCheckboxLocalStateSource, /doneOverrides/,
        'native document checkbox state must not create a compatibility override');
    assert.match(nativeDocHooksSource, /globalThis\.__tmTaskStore\?\.applyMutation\?\./,
        'native document checkbox state must use the shared TaskStore mutation path');
    assert.doesNotMatch(nativeDocHooksSource, /__tmPushNativeDocCheckboxTrace|__tmPushDiagnosticLog/,
        'temporary native checkbox diagnostics must not ship in production runtime');
    assert.doesNotMatch(taskModelSource, /pendingDoneWrite[\s\S]*disabledAttr/);
    assert.doesNotMatch(extractFunction(taskModelSource, '__tmRenderTaskCheckbox'), /doneOverrides/);
    assert.match(taskModelSource, /__tmTaskStore\?\.getProjected\?\.[\s\S]*__tmTaskBoundary\?\.getTask\?\.[\s\S]*__tmIsTaskDoneEffective[\s\S]*checkedAttr/);
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
    assert.match(listRuntimeSource, /const currentDone = typeof __tmIsTaskDoneEffective[\s\S]*const explicitCheckboxIntent[\s\S]*if \(currentDone === targetDone && !explicitCheckboxIntent\) return/,
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
