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

assert.match(
    loadSource,
    /from:\s*'1970-01-01T00:00:00.000Z'/,
    'lifetime totals must include legacy container history predating the current task block',
);
assert.doesNotMatch(loadSource, /__tmTaskDetailCreatedAtIso/, 'block creation time must not truncate inherited focus history');

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
const disposeEnd = source.indexOf('function __tmFormatTaskDetailFocusDuration(', disposeStart);
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

assert.match(loadSource, /__tmTaskDetailCloseFocusRecordsPopover/,
    'rerendering focus statistics must close the records popover before its anchor disappears');
assert.match(source, /root\.__tmTaskDetailCloseFocusRecordsPopover = \(\) =>/,
    'the task detail must expose a bounded hook for closing the records popover');

assert.match(
    renderSource,
    /class="tm-task-detail-focus-stat tm-task-detail-focus-stat--records" data-tm-detail-focus-records="\$\{esc\(taskId\)\}" data-tm-detail-focus-records-target="\$\{Math\.round\(numericSeconds\)\}"/,
    'the self statistic must be a records trigger that carries the total used to detect older history',
);
assert.match(renderSource, /class="tm-task-detail-focus-stats"/,
    'focus statistics must use dedicated classes instead of inline grid styles');
assert.doesNotMatch(renderSource, /style="display:grid;grid-template-columns:repeat\(3/,
    'focus statistics layout must not regress to inline styles');

const recordsLoadStart = source.indexOf('const loadFocusRecords = async (popover, tid, targetSec)');
const recordsOpenStart = source.indexOf('const openFocusRecordsPopover = ', recordsLoadStart);
assert.ok(recordsLoadStart >= 0 && recordsOpenStart > recordsLoadStart, 'focus records loader must remain extractable');
const recordsLoadSource = source.slice(recordsLoadStart, recordsOpenStart);
assert.match(
    recordsLoadSource,
    /__tmCallTaskHorizonKernelRpc\('taskHorizonQueryFocusStatistics', \{[\s\S]*bucket: 'day'[\s\S]*groupBy: 'task'[\s\S]*taskIDs: \[tid\][\s\S]*dropEmptyBuckets: true/,
    'focus records must ask the kernel for sparse day buckets scoped to the task itself',
);
assert.doesNotMatch(recordsLoadSource, /service\.queryFocus|rootTaskID|from: '1970/,
    'focus records must not reuse the lifetime query or build dense buckets from 1970',
);
assert.match(source, /FOCUS_RECORDS_MAX_LOOKBACK_DAYS = 3650/,
    'focus records lookback must stay below DockTomato\'s dense bucket cap');
assert.match(recordsLoadSource, /totalSec \+ 5 >= targetSec[\s\S]*lookbackDays \* FOCUS_RECORDS_EXTEND_FACTOR/,
    'focus records must extend the lookback until the displayed total matches the card total');
assert.match(source, /tm-task-detail-inline-popover--focus-records/,
    'focus records must reuse the task-detail inline popover shell');
assert.match(source, /data-tm-focus-records-close/,
    'focus records popover must expose a close control');
assert.match(source, /data-tm-focus-records-retry/,
    'focus records popover must expose a retry action for kernel failures');
assert.match(source, /tm-focus-records-head-main[\s\S]*tm-focus-records-title[\s\S]*data-tm-focus-records-summary/,
    'the record summary must sit to the right of the popover title');
assert.match(styleSource, /\.tm-focus-records-head-main\s*\{[^}]*display:\s*flex/,
    'title and summary must share the popover header row');
assert.match(styleSource, /\.tm-task-detail-inline-popover--focus-records\s*\{[^}]*width:\s*min\(340px/,
    'focus records popover needs a wider list layout');
assert.match(styleSource, /\.tm-focus-records-row\s*\{[^}]*display:\s*flex/,
    'focus record rows must stay on a single line');

const rowsStart = source.indexOf('function __tmBuildTaskDetailFocusRecordRows(');
const rowsEnd = source.indexOf('function __tmRenderTaskDetailFocusRecordRows(', rowsStart);
assert.ok(rowsStart >= 0 && rowsEnd > rowsStart, 'focus record row builder must remain extractable');
const rowsContext = vm.createContext({ Array, Math, Number, String });
vm.runInContext(`${source.slice(rowsStart, rowsEnd)}
this.rows = __tmBuildTaskDetailFocusRecordRows([
    { key: '2026-07-15', focusSec: 600, countdownSessionCount: 1 },
    { key: '2026-07-16', focusSec: 0, countdownSessionCount: 0 },
    { key: '2026-07-14', focusSec: 120, stopwatchSessionCount: 2 },
    { key: 'bad-key', focusSec: 60 },
]);
`, rowsContext);
assert.equal(rowsContext.rows.length, 2, 'empty days and invalid date keys must be dropped from the records list');
assert.deepEqual(Array.from(rowsContext.rows, (row) => row.key), ['2026-07-15', '2026-07-14'],
    'focus records must be sorted newest first');
assert.equal(rowsContext.rows[1].stopwatchCount, 2);
const rowsRenderStart = source.indexOf('function __tmRenderTaskDetailFocusRecordRows(');
const rowsRenderEnd = source.indexOf('\n\n    function __tmIsTaskDetailFocusStatisticsAvailable', rowsRenderStart);
assert.ok(rowsRenderStart >= 0 && rowsRenderEnd > rowsRenderStart, 'focus record row renderer must remain extractable');
const rowsRenderSource = source.slice(rowsRenderStart, rowsRenderEnd);
assert.doesNotMatch(rowsRenderSource, /最后专注/, 'focus record rows must not repeat the last focus clock');
assert.match(rowsRenderSource, /tm-focus-records-day[\s\S]*tm-focus-records-date[\s\S]*tm-focus-records-meta[\s\S]*tm-focus-records-duration/,
    'focus record rows must merge the tomato/stopwatch counts after the date in one line');

const loaderStart = source.indexOf('const loadFocusRecords = async');
const loaderEnd = source.indexOf('const openFocusRecordsPopover =', loaderStart);
assert.ok(loaderStart >= 0 && loaderEnd > loaderStart, 'focus records extension loop must remain extractable');
const loaderBlock = source.slice(loaderStart, loaderEnd);
const createLoaderContext = (sequence) => {
    const popover = { __tmFocusRecordsToken: null };
    const calls = [];
    const renders = [];
    const errors = [];
    const context = vm.createContext({
        Array,
        Date,
        Math,
        Number,
        String,
        FOCUS_RECORDS_INITIAL_LOOKBACK_DAYS: 365,
        FOCUS_RECORDS_MAX_LOOKBACK_DAYS: 3650,
        FOCUS_RECORDS_EXTEND_FACTOR: 4,
        activeInlinePopover: popover,
        __tmCallTaskHorizonKernelRpc: async (name, options) => {
            calls.push({ name, options });
            const focusSec = sequence.length > 1 ? sequence.shift() : sequence[0];
            return { available: true, data: { totals: { focusSec, buckets: [] } } };
        },
        setFocusRecordsLoading() {},
        setFocusRecordsError(_popover, message) { errors.push(message); },
        renderFocusRecords(_popover, data, rows, targetSec) { renders.push({ data, rows, targetSec }); },
        __tmBuildTaskDetailFocusRecordRows() { return []; },
    });
    vm.runInContext(`${loaderBlock}\nthis.runLoader = loadFocusRecords;`, context);
    return { context, popover, calls, renders, errors };
};

(async () => {
    const extended = createLoaderContext([0, 300, 660]);
    await extended.context.runLoader(extended.popover, 'task-a', 660);
    assert.equal(extended.calls.length, 3, 'records must extend the lookback until the card total is covered');
    assert.deepEqual(
        extended.calls.map(({ options }) => Math.round((Date.now() - Date.parse(options.from)) / 86400000)),
        [365, 1460, 3650],
        'records lookback must extend in bounded steps and stop at the safe cap',
    );
    assert.equal(extended.renders.length, 1, 'records must render once after the lookback converges');
    assert.equal(extended.renders[0].targetSec, 660);
    assert.equal(extended.errors.length, 0);

    const immediate = createLoaderContext([660]);
    await immediate.context.runLoader(immediate.popover, 'task-a', 660);
    assert.equal(immediate.calls.length, 1, 'records inside the first window must render without extra queries');

    const unavailable = createLoaderContext([0]);
    unavailable.context.__tmCallTaskHorizonKernelRpc = async () => ({ available: false, data: null });
    await unavailable.context.runLoader(unavailable.popover, 'task-a', 660);
    assert.equal(unavailable.errors.length, 1, 'an unavailable kernel must surface a retryable records error');
})().then(() => {
    console.log('task detail focus statistics contract tests passed');
}).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
