'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
    path.resolve(__dirname, '..', 'src', 'task-horizon', 'main', 'task-runtime', '52-task-detail-runtime.js'),
    'utf8',
);

const renderStart = source.indexOf('function __tmRenderTaskDetailFocusStats(');
const renderEnd = source.indexOf('\n\n    async function __tmLoadTaskDetailFocusStats', renderStart);
assert.ok(renderStart >= 0 && renderEnd > renderStart, 'focus statistics renderer must remain extractable');
const renderSource = source.slice(renderStart, renderEnd);

assert.match(renderSource, /combinedFocusSec\s*<=\s*0[\s\S]*section\.hidden\s*=\s*true[\s\S]*section\.innerHTML\s*=\s*''/, 'empty focus statistics must hide and clear the whole section');
assert.match(renderSource, /data-tm-detail-section-toggle[\s\S]*tm-task-detail-section-chevron[\s\S]*__tmPhosphorBoldSvg\('caret-down'/, 'focus statistics must reuse the shared task-detail folding control');
assert.match(renderSource, /section\.hidden\s*=\s*false[\s\S]*classList\.toggle\('is-collapsed',[\s\S]*child\.hidden\s*=/, 'valid focus statistics must restore the section and synchronize its folding state');
assert.doesNotMatch(renderSource, /任务生命周期/, 'focus statistics must not show a redundant lifetime label');
assert.match(renderSource, /\['子任务',\s*descendants\.focusSec\]/,
    'focus statistics must describe descendant totals using the product term 子任务');
assert.doesNotMatch(renderSource, /\['后代',/, 'focus statistics must not expose an internal tree term');

const loadStart = source.indexOf('async function __tmLoadTaskDetailFocusStats(');
const loadEnd = source.indexOf('\n\n    function __tmBuildTaskDetailInnerHtml', loadStart);
assert.ok(loadStart >= 0 && loadEnd > loadStart, 'focus statistics loader must remain extractable');
const loadSource = source.slice(loadStart, loadEnd);
assert.equal(
    (loadSource.match(/__tmRenderTaskDetailFocusStats\(section, null\)/g) || []).length,
    2,
    'missing services and query failures must both use the shared empty-state hiding path',
);
assert.doesNotMatch(loadSource, /暂不可用|正在读取/, 'focus statistics must not leave an error or loading shell in task details');
assert.match(loadSource, /bucket:\s*'none'/, 'task details must request totals without generating empty time buckets');
assert.doesNotMatch(loadSource, /bucket:\s*'day'/, 'task details must not build one bucket per day across the task lifetime');
assert.match(loadSource, /!__tmIsTaskDetailFocusStatisticsAvailable\(\)[\s\S]*__tmRenderTaskDetailFocusStats\(section, null\)/,
    'task details must skip focus queries when DockTomato is unavailable');
assert.match(loadSource, /const options = \{[\s\S]*service\.queryFocus\(options, \{[\s\S]*channel:\s*`task-detail:\$\{taskId\}`[\s\S]*isCurrent:\s*\(\) => section\.dataset\.tmFocusStatsRequest === requestId/,
    'task details must supersede stale work through the shared statistics service');
assert.match(loadSource, /__tmTaskDetailFocusAbortController\?\.abort[\s\S]*new AbortController\(\)[\s\S]*signal:\s*queryController\.signal/,
    'each task-detail statistics load must cancel the previous query and pass its own AbortSignal');
assert.match(loadSource, /rootTaskID:\s*taskId/, 'task details must delegate descendant aggregation to the task statistics kernel');
assert.doesNotMatch(loadSource, /taskIDs:/, 'task details must not send a recursively expanded descendant ID payload');
assert.doesNotMatch(source, /function __tmCollectTaskDetailFocusTaskIds/, 'task details must not retain a second recursive task-tree walker');

const createdAtStart = source.indexOf('function __tmTaskDetailCreatedAtIso(');
const createdAtEnd = source.indexOf('\n\n    function __tmFormatTaskDetailFocusDuration', createdAtStart);
assert.ok(createdAtStart >= 0 && createdAtEnd > createdAtStart, 'task detail creation-time resolver must remain extractable');
const createdAtSource = source.slice(createdAtStart, createdAtEnd);
assert.match(
    createdAtSource,
    /task\?\.created\s*\|\|\s*task\?\.id\s*\|\|\s*task\?\.blockId/,
    'task details must derive creation time from the SiYuan block ID when the projected task omits created',
);

assert.match(
    source,
    /<section class="tm-task-detail-section" data-tm-detail-focus-stats data-tm-detail-collapsible-section[^>]*hidden><\/section>/,
    'the focus statistics section must start hidden and participate in delegated folding',
);
assert.match(source, /const focusStatisticsEnabled = tomatoEnabled && __tmIsTaskDetailFocusStatisticsAvailable\(\)/,
    'task details must not create a statistics section when DockTomato is unavailable');
assert.match(source, /if \(root\.querySelector\('\[data-tm-detail-focus-stats\]'\)\)[\s\S]*__tmLoadTaskDetailFocusStats/,
    'task details must not start statistics loading when the section is unavailable');
assert.match(source, /function __tmRefreshOpenTaskDetailFocusStats[\s\S]*__tmTaskDetailFocusRoots[\s\S]*__tmLoadTaskDetailFocusStats[\s\S]*availabilityChanged[\s\S]*__tmRefreshVisibleTaskDetailForTask/,
    'open task details must refresh focus values and rebuild only when statistics availability changes');
const disposeStart = source.indexOf('const __tmTaskDetailFocusRoots = new Set()');
const disposeEnd = source.indexOf('function __tmTaskDetailCreatedAtIso(', disposeStart);
assert.ok(disposeStart >= 0 && disposeEnd > disposeStart, 'task detail focus ownership must expose a bounded disposal block');
class FakeElement {
    constructor() {
        this.children = new Set();
        this.dataset = {};
    }
    contains(value) { return this.children.has(value); }
    querySelector() { return this.section || null; }
}
const disposeContext = vm.createContext({
    Array,
    Date,
    Element: FakeElement,
    HTMLElement: FakeElement,
    Set,
    globalThis: null,
});
disposeContext.globalThis = disposeContext;
vm.runInContext(`${source.slice(disposeStart, disposeEnd)}\nthis.focusRoots = __tmTaskDetailFocusRoots;`, disposeContext);
const createDisposableRoot = () => {
    const root = new FakeElement();
    root.section = new FakeElement();
    root.__tmTaskDetailTask = { id: 'task' };
    root.__tmTaskDetailTaskId = 'task';
    root.aborted = 0;
    root.focusAborted = 0;
    root.__tmTaskDetailAbortController = { abort: () => { root.aborted += 1; } };
    root.__tmTaskDetailFocusAbortController = { abort: () => { root.focusAborted += 1; } };
    return root;
};
const firstRoot = createDisposableRoot();
disposeContext.focusRoots.add(firstRoot);
assert.equal(disposeContext.__tmDisposeTaskDetailRoot(firstRoot), true);
assert.equal(firstRoot.aborted, 1, 'disposing a task detail must abort its editor listeners');
assert.equal(firstRoot.focusAborted, 1, 'disposing a task detail must abort its in-flight history query');
assert.equal(Object.hasOwn(firstRoot, '__tmTaskDetailFocusAbortController'), false,
    'disposing a task detail must release its focus-query controller');
assert.equal(disposeContext.focusRoots.has(firstRoot), false, 'disposing a task detail must remove its strong root reference');
assert.equal(Object.hasOwn(firstRoot, '__tmTaskDetailTask'), false, 'disposing a task detail must release its task object');
assert.match(firstRoot.section.dataset.tmFocusStatsRequest, /^disposed:/,
    'disposing a task detail must supersede its in-flight focus query');
const container = new FakeElement();
const containedRoot = createDisposableRoot();
const otherRoot = createDisposableRoot();
container.children.add(containedRoot);
disposeContext.focusRoots.add(containedRoot);
disposeContext.focusRoots.add(otherRoot);
assert.equal(disposeContext.__tmDisposeTaskDetailRuntime(container), 1,
    'container disposal must release only task details owned by that modal');
assert.equal(disposeContext.focusRoots.has(otherRoot), true);
assert.equal(disposeContext.__tmDisposeTaskDetailRuntime(), 1,
    'plugin disposal must release every remaining task detail root');
assert.equal(disposeContext.focusRoots.size, 0);
const runtimeSource = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'task-horizon', 'main', '20-api-and-runtime-services.js'), 'utf8');
assert.match(runtimeSource, /__tmTomatoHistoryUpdatedHandler = \(\) =>[\s\S]*__tmRefreshOpenTaskDetailFocusStats\?\.\(\{ availabilityChanged: false \}\)/,
    'Tomato history updates must invalidate already-open task detail statistics');
assert.match(runtimeSource, /__tmTomatoStatsAvailabilityHandler = \(\) =>[\s\S]*__tmRefreshOpenTaskDetailFocusStats\?\.\(\{ availabilityChanged: true \}\)/,
    'Tomato statistics availability changes must rebuild already-open detail sections when needed');
const mobileCloseSource = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'task-horizon', 'main', 'render', '45-render-shell-controls-and-resize.js'), 'utf8');
assert.match(mobileCloseSource, /modals\.forEach\(el => \{[\s\S]*__tmDisposeTaskDetailRuntime\?\.\(el\)[\s\S]*el\.remove\(\)/,
    'mobile manager close must dispose task detail resources before removing modal DOM');
const shellSource = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'task-horizon', 'main', 'shell', '80-shell-lifecycle.js'), 'utf8');
assert.match(shellSource, /function __tmCleanup\(\)[\s\S]*__tmDisposeTaskDetailRuntime\?\.\(\)/,
    'plugin unload must dispose the complete task detail focus runtime');
assert.match(shellSource, /__tmFocusStatisticsService\?\.dispose\?\.\(\)[\s\S]*delete globalThis\.__tmFocusStatisticsService/,
    'plugin unload must dispose and release the shared focus statistics scheduler');

const checklistRefreshStart = source.indexOf('function __tmRefreshChecklistSelectionInPlace(');
const checklistRefreshEnd = source.indexOf('\n\n    function __tmResolveTaskDetailSheetPanel', checklistRefreshStart);
assert.ok(checklistRefreshStart >= 0 && checklistRefreshEnd > checklistRefreshStart, 'checklist detail refresh must remain extractable');
const checklistRefreshSource = source.slice(checklistRefreshStart, checklistRefreshEnd);
assert.match(
    checklistRefreshSource,
    /__tmBindTaskDetailEditor\(panel, selectedId, \{[\s\S]*?source:[\s\S]*?task,[\s\S]*?onClose:/,
    'checklist detail rebuilds must pass the selected task so focus statistics load after a view switch',
);

const styleSource = fs.readFileSync(path.resolve(__dirname, '..', 'task-horizon.css'), 'utf8');
assert.match(
    styleSource,
    /\.tm-task-detail-section\[data-tm-detail-focus-stats\]\[hidden\]\s*\{[^}]*display:\s*none\s*!important/,
    'hidden focus statistics must occupy no task-detail layout space',
);

console.log('task detail focus statistics contract tests passed');
