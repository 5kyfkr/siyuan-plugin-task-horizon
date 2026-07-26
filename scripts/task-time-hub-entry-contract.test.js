'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const detailSource = read('src', 'task-horizon', 'main', 'task-runtime', '52-task-detail-runtime.js');
const detailCss = read('task-horizon.css');
const repeatSource = read('src', 'task-horizon', 'main', 'task-runtime', '50-task-model-and-repeat-utils.js');
const detailRefreshCoordinatorSource = read('src', 'task-horizon', 'main', 'task-runtime', '51-whiteboard-and-link-runtime.js');
const timeRefreshSource = read('src', 'task-horizon', 'main', 'render', '46-render-local-task-time-refresh.js');
const dateUpdateSource = read('src', 'task-horizon', 'main', 'render', '48-render-calendar-support-runtime.js');
const standaloneStart = detailSource.indexOf('async function __tmOpenStandaloneTaskTimeHub(');
const standaloneEnd = detailSource.indexOf('window.tmOpenTaskTimeHub = async function', standaloneStart);
assert.ok(standaloneStart >= 0 && standaloneEnd > standaloneStart, 'standalone task time hub must remain extractable');

const standaloneSource = detailSource.slice(standaloneStart, standaloneEnd);
assert.doesNotMatch(standaloneSource, /\bgetBoundTask(?:Id)?\b/, 'standalone time hub must not reference task-detail-only bindings');
assert.match(standaloneSource, /const repeatTask = task \|\| \{\};/, 'standalone repeat progress must use its refreshed task state');
assert.match(detailSource, /window\.tmOpenTaskTimeHub[\s\S]*__tmOpenStandaloneTaskTimeHub/, 'public time hub entry must delegate to the standalone implementation');
assert.match(detailSource, /function __tmGetTaskTimeHubRepeatDates[\s\S]*__tmCollectTaskRepeatPreviewDates\(task, \{ limit, until \}\)/, 'calendar repeat preview must reuse the authoritative recurring preview resolver through the visible grid end');
assert.equal((detailSource.match(/nextRepeatValues\.includes\(key\) && key !== activeValue \? 'is-next-repeat'/g) || []).length, 2, 'both time hub calendars must mark every visible recurring date without overriding the active date');
assert.equal((detailSource.match(/currentChoice === 'custom' \? 'is-selected'/g) || []).length, 2, 'both repeat menus must select the custom choice for custom rule shapes');
assert.equal((detailSource.match(/listTaskSchedulesByTaskId\([^\n]+\{ futureOnly: false \}\)/g) || []).length, 2, 'both time hub schedule lists must keep historical schedules available');
assert.equal((detailSource.match(/__tmGetTaskTimeHubUnexpiredSchedule\(/g) || []).length, 4, 'all task-detail schedule summaries must exclude expired schedules');
assert.match(detailCss, /\.tm-task-time-hub__day\.is-next-repeat::after[\s\S]*color-mix\(in srgb, var\(--tm-primary-color\) 11%, var\(--tm-card-bg\) 89%\)/, 'next recurring date must use a subtle theme-aware highlight');

const detailHubStart = detailSource.indexOf('const openTaskTimeHubPopover = (trigger, options = {}) => {');
const detailHubEnd = detailSource.indexOf("on(document, 'pointerdown'", detailHubStart);
assert.ok(detailHubStart >= 0 && detailHubEnd > detailHubStart, 'detail task time hub must remain extractable');
const detailHubSource = detailSource.slice(detailHubStart, detailHubEnd);
assert.equal((detailHubSource.match(/skipDetailPatch:\s*true/g) || []).length, 2, 'detail date and range commits must preserve the active detail editor');
assert.doesNotMatch(standaloneSource, /skipDetailPatch:\s*true/, 'standalone context-menu time editing must keep its normal refresh behavior');
assert.equal((dateUpdateSource.match(/skipDetailPatch:\s*opts\.skipDetailPatch === true/g) || []).length, 2, 'date updates must preserve skipDetailPatch before and after persistence');
assert.match(detailSource, /const patchActiveDetail = \(panel\) => \{[\s\S]*__tmTaskDetailActiveInlinePopover[\s\S]*__tmPatchTaskDetailPanelInPlace/, 'detail attribute hydration must patch an active editor without rebuilding it');

const hydrationGuardStart = detailSource.indexOf('const patchActiveDetail = (panel) => {');
const hydrationGuardEnd = detailSource.indexOf("if (mode === 'checklist')", hydrationGuardStart);
assert.ok(hydrationGuardStart >= 0 && hydrationGuardEnd > hydrationGuardStart, 'detail hydration popover guard must remain extractable');
class MockElement {}
class MockHTMLElement extends MockElement {}
const hydrationContext = {
    Element: MockElement,
    HTMLElement: MockHTMLElement,
    tid: 'task-1',
    patchCount: 0,
    document: {
        body: {
            contains(element) {
                return element?.connected === true;
            },
        },
    },
    __tmPatchTaskDetailPanelInPlace(panel, taskId) {
        assert.ok(panel instanceof MockHTMLElement);
        assert.equal(taskId, 'task-1');
        hydrationContext.patchCount += 1;
        return true;
    },
};
vm.createContext(hydrationContext);
vm.runInContext(`${detailSource.slice(hydrationGuardStart, hydrationGuardEnd)}\nthis.patchActiveDetail = patchActiveDetail;`, hydrationContext);
const activeHydrationPanel = new MockHTMLElement();
activeHydrationPanel.__tmTaskDetailActiveInlinePopover = Object.assign(new MockElement(), { connected: true });
assert.equal(hydrationContext.patchActiveDetail(activeHydrationPanel), true, 'hydration must consume refresh while a detail popover is active');
assert.equal(hydrationContext.patchCount, 1, 'hydration must patch the active detail exactly once');
assert.equal(hydrationContext.patchActiveDetail(new MockHTMLElement()), false, 'hydration must retain normal refresh behavior without an active popover');

const busyRefreshStart = detailRefreshCoordinatorSource.indexOf("if (next.mode !== 'detail') {", detailRefreshCoordinatorSource.indexOf('function __tmPerformViewRefresh('));
const busyRefreshEnd = detailRefreshCoordinatorSource.indexOf("if (next.mode !== 'detail' && typeof __tmIsPluginVisibleNow", busyRefreshStart);
assert.ok(busyRefreshStart >= 0 && busyRefreshEnd > busyRefreshStart, 'busy-detail refresh branch must remain extractable');
const busyRefreshSource = detailRefreshCoordinatorSource.slice(busyRefreshStart, busyRefreshEnd);
assert.doesNotMatch(busyRefreshSource, /__tmRefreshVisibleDetailsFromViewRefresh/, 'a busy detail must never be force-refreshed before its deferred view refresh');
assert.match(busyRefreshSource, /__tmScheduleBusyDetailViewRefresh\(next\)/, 'busy detail refreshes must remain queued until the editor is idle');

const forceRetryStart = detailSource.indexOf('function __tmScheduleTaskDetailForceRebuildRetry(');
const forceRetryEnd = detailSource.indexOf('function __tmRefreshVisibleTaskDetailForTask(', forceRetryStart);
assert.ok(forceRetryStart >= 0 && forceRetryEnd > forceRetryStart, 'detail force-rebuild retry must remain extractable');
const forceRetryContext = {
    HTMLElement: MockHTMLElement,
    stillBusy: true,
    timer: null,
    refreshOptions: null,
    __tmCollectTaskDetailFallbackDeferReasons() {
        return forceRetryContext.stillBusy ? ['active-popover'] : [];
    },
    __tmShouldDeferTaskDetailFallback() {
        return forceRetryContext.stillBusy;
    },
    __tmPushDetailDebug() {},
    __tmRefreshVisibleTaskDetailForTask(taskId, options) {
        assert.equal(taskId, 'task-1');
        forceRetryContext.refreshOptions = options;
        return true;
    },
    setTimeout(callback) {
        forceRetryContext.timer = callback;
        return 1;
    },
};
vm.createContext(forceRetryContext);
vm.runInContext(`${detailSource.slice(forceRetryStart, forceRetryEnd)}\nthis.scheduleForceRetry = __tmScheduleTaskDetailForceRebuildRetry;`, forceRetryContext);
const forceRetryRoot = Object.assign(new MockHTMLElement(), { isConnected: true });
assert.equal(forceRetryContext.scheduleForceRetry(forceRetryRoot, 'task-1', 'test'), true);
forceRetryContext.timer();
assert.equal(forceRetryContext.refreshOptions.retry, false, 'force-rebuild retry must keep deferring while the popover remains active');
forceRetryContext.stillBusy = false;
forceRetryContext.refreshOptions = null;
assert.equal(forceRetryContext.scheduleForceRetry(forceRetryRoot, 'task-1', 'test'), true);
forceRetryContext.timer();
assert.equal(forceRetryContext.refreshOptions.retry, true, 'force-rebuild retry may proceed once the detail editor is idle');

const timeRefreshStart = timeRefreshSource.indexOf('function __tmRefreshTaskTimeAcrossViews(');
const timeRefreshEnd = timeRefreshSource.indexOf('const __TM_TASK_PRIORITY_NORMALIZE_MAP', timeRefreshStart);
assert.ok(timeRefreshStart >= 0 && timeRefreshEnd > timeRefreshStart, 'task time refresh coordinator must remain extractable');
const refreshContext = {
    state: { viewMode: 'calendar', flatTasks: {}, pendingInsertedTasks: {} },
    detailRefreshCount: 0,
    fallbackRefreshCount: 0,
    __tmRuntimeState: {
        getTaskById(taskId) {
            return taskId === 'task-1' ? { id: taskId } : null;
        },
    },
    __tmRefreshVisibleTaskDetailForTask() {
        refreshContext.detailRefreshCount += 1;
        return true;
    },
    __tmScheduleViewRefresh() {
        refreshContext.fallbackRefreshCount += 1;
    },
};
vm.createContext(refreshContext);
vm.runInContext(`${timeRefreshSource.slice(timeRefreshStart, timeRefreshEnd)}\nthis.refreshTaskTime = __tmRefreshTaskTimeAcrossViews;`, refreshContext);
assert.equal(refreshContext.refreshTaskTime('task-1', { patch: { duration: '30m' }, skipDetailPatch: true }), true, 'skipping the detail patch must count as an intentionally handled refresh');
assert.equal(refreshContext.detailRefreshCount, 0, 'an active detail editor must not be refreshed');
assert.equal(refreshContext.fallbackRefreshCount, 0, 'skipping detail refresh must not schedule a full-view fallback');
assert.equal(refreshContext.refreshTaskTime('task-1', { patch: { duration: '45m' } }), true, 'normal callers must retain detail refresh behavior');
assert.equal(refreshContext.detailRefreshCount, 1, 'normal task time refresh must still update visible detail');

const helperStart = detailSource.indexOf('function __tmGetTaskTimeHubRepeatDates(');
const helperEnd = detailSource.indexOf('function __tmRenderTaskTimeHubUntilControlHtml(', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'time hub repeat display helpers must remain extractable');
const helperContext = {
    __tmNormalizeDateOnly(value) {
        return String(value || '').slice(0, 10);
    },
    __tmCollectTaskRepeatPreviewDates(task, options) {
        helperContext.previewCall = { task, options };
        return helperContext.previewDates || [];
    },
    __tmNormalizeTaskRepeatRule(rule) {
        return rule;
    },
    __tmGetTaskRepeatRule() {
        return { anchorDate: '2026-07-29' };
    },
    __tmGetTaskRepeatLocalDayOrdinal(value) {
        const date = helperContext.__tmBuildLocalNoonDateFromKey(value);
        return date ? Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000) : Number.NaN;
    },
    __tmBuildLocalNoonDateFromKey(value) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
        return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12) : null;
    },
};
vm.createContext(helperContext);
vm.runInContext(`${detailSource.slice(helperStart, helperEnd)}\nthis.helpers = { __tmGetTaskTimeHubRepeatDates, __tmGetTaskTimeHubRepeatChoice, __tmGetTaskTimeHubUnexpiredSchedule };`, helperContext);
const {
    __tmGetTaskTimeHubRepeatDates: getRepeatDates,
    __tmGetTaskTimeHubRepeatChoice: getRepeatChoice,
    __tmGetTaskTimeHubUnexpiredSchedule: getUnexpiredSchedule,
} = helperContext.helpers;

helperContext.previewDates = ['2026-08-04', '2026-08-05', '2026-08-06', '2026-08-11'];
assert.deepEqual(Array.from(getRepeatDates({ start_date: '2026-07-25', completion_time: '2026-07-26' }, { completionTime: '2026-07-29' }, '2026-09-05')), helperContext.previewDates);
assert.ok(helperContext.previewCall.options.limit >= 42, 'calendar must request enough occurrences to cover its 42 visible cells');
assert.equal(helperContext.previewCall.options.until, '2026-09-05', 'calendar recurrence collection must stop at the visible grid end');
assert.equal(helperContext.previewCall.task.completionTime, '2026-07-29', 'calendar preview must use the currently displayed due date');
helperContext.previewDates = [];
assert.deepEqual(Array.from(getRepeatDates({ completionTime: '2026-07-26' }, {}, '2026-09-05')), [], 'ended recurring series must not expose calendar previews');

const baseRule = { enabled: true, type: 'daily', every: 1, trigger: 'due', anchorDate: '2026-07-27', weekdays: [], monthlyMode: 'date', calendarMode: 'solar' };
assert.equal(getRepeatChoice(baseRule), 'daily');
assert.equal(getRepeatChoice({ ...baseRule, type: 'weekly', weekdays: [] }), 'weekly');
assert.equal(getRepeatChoice({ ...baseRule, type: 'weekly', weekdays: [1] }), 'weekly');
assert.equal(getRepeatChoice({ ...baseRule, type: 'weekly', weekdays: [1, 3] }), 'custom');
assert.equal(getRepeatChoice({ ...baseRule, every: 2 }), 'custom');
assert.equal(getRepeatChoice({ ...baseRule, trigger: 'complete' }), 'custom');
assert.equal(getRepeatChoice({ ...baseRule, type: 'monthly', monthlyMode: 'weekday' }), 'custom');
assert.equal(getRepeatChoice({ ...baseRule, type: 'monthly', monthlyMode: 'weekday', calendarMode: 'lunar' }), 'lunar-monthly');

const scheduleNow = Date.parse('2026-04-15T11:00:00+08:00');
const pastSchedule = { id: 'past', start: '2026-04-10T11:00:00+08:00', end: '2026-04-10T12:00:00+08:00' };
const activeSchedule = { id: 'active', start: '2026-04-15T10:00:00+08:00', end: '2026-04-15T12:00:00+08:00' };
const futureSchedule = { id: 'future', start: '2026-06-05T11:00:00+08:00', end: '2026-06-05T12:00:00+08:00' };
assert.equal(getUnexpiredSchedule([pastSchedule, activeSchedule, futureSchedule], scheduleNow)?.id, 'active', 'an ongoing schedule must remain visible in the task time summary');
assert.equal(getUnexpiredSchedule([pastSchedule, futureSchedule], scheduleNow)?.id, 'future', 'an expired schedule must not occupy the task time summary');
assert.equal(getUnexpiredSchedule([pastSchedule], scheduleNow), null, 'the task time summary must be empty when every schedule is expired');

const collectorStart = repeatSource.indexOf('function __tmCollectTaskRepeatPreviewDates(');
const collectorEnd = repeatSource.indexOf('function __tmGetPriorityJiraInfo(', collectorStart);
assert.ok(collectorStart >= 0 && collectorEnd > collectorStart, 'recurring preview collector must remain extractable');
const collectorContext = {
    nextDates: ['2026-07-28', '2026-07-29', '2026-07-30', '2026-08-04'],
    __tmGetTaskRepeatRule() {
        return { enabled: true, type: 'weekly' };
    },
    __tmNormalizeDateOnly(value) {
        return String(value || '').slice(0, 10);
    },
    __tmNormalizeTaskRepeatState(value) {
        return value || {};
    },
    __tmBuildTaskRepeatAdvancePatch() {
        const completionTime = collectorContext.nextDates.shift();
        return completionTime ? { completionTime, repeatState: {} } : null;
    },
};
vm.createContext(collectorContext);
vm.runInContext(`${repeatSource.slice(collectorStart, collectorEnd)}\nthis.collect = __tmCollectTaskRepeatPreviewDates;`, collectorContext);
const visibleDates = collectorContext.collect({ completionTime: '2026-07-27', repeatState: {} }, { limit: 20, until: '2026-07-30' });
assert.deepEqual(Array.from(visibleDates), ['2026-07-28', '2026-07-29', '2026-07-30'], 'calendar collection must include all occurrences through the grid end and stop there');
assert.deepEqual(collectorContext.nextDates, ['2026-08-04'], 'collector must not advance beyond an exact visible-grid boundary');

const entrySources = [
    ['table cells', read('src', 'task-horizon', 'main', 'task-runtime', '51-whiteboard-and-link-runtime.js'), /source:\s*'table-cell'/],
    ['Quickbar', read('quickbar.js'), /source:\s*'quickbar'/],
    ['kanban cards', read('src', 'task-horizon', 'main', '40-render-runtime.js'), /source:\s*'kanban-card'/],
    ['context menu', read('src', 'task-horizon', 'main', 'task-runtime', '53-list-render-and-document-loader.js'), /source:\s*'context-menu-completion-time'/],
    ['quick add', read('src', 'task-horizon', 'main', 'task-runtime', '53b-task-create-and-quick-add-runtime.js'), /tmOpenTaskTimeHub\('__tm_quick_add_draft__'/],
    ['points penalty editor', read('src', 'task-horizon', 'main', '20-api-and-runtime-services.js'), /tmOpenTaskTimeHub\(draftTaskId/],
];

for (const [label, source, marker] of entrySources) {
    assert.match(source, /tmOpenTaskTimeHub/, `${label} must use the shared task time hub`);
    assert.match(source, marker, `${label} task time hub call must remain identifiable`);
}

console.log('task time hub entry contract tests passed');
