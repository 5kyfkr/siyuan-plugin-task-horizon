'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const services = read('src/task-horizon/main/20-api-and-runtime-services.js');
const uiFoundation = read('src/task-horizon/main/30-dialogs-and-ui-foundation.js');
const renderRuntime = read('src/task-horizon/main/40-render-runtime.js');
const taskRuntime = read('src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js');
const shellLifecycle = read('src/task-horizon/main/shell/80-shell-lifecycle.js');
const styles = read('task-horizon.css');

const segment = (source, start, end) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.notEqual(from, -1, `missing segment start: ${start}`);
    assert.notEqual(to, -1, `missing segment end: ${end}`);
    return source.slice(from, to);
};

const forbiddenRefresh = /__tmScheduleViewRefresh|__tmScheduleRender|__tmRerenderCurrentViewInPlace|__tmRequestCalendarRefresh|\brender\s*\(/;
const focusSync = segment(services, 'function __tmSyncTomatoFocusInPlace', 'async function __tmSettleTomatoAfterTaskDone');
assert.match(focusSync, /state\.timerFocusTaskId = focusTaskId/, 'in-place focus sync must own the focus state update');
assert.match(focusSync, /\.tm-table tr\[data-id\][\s\S]*\.tm-timeline-row\[data-id\][\s\S]*\.tm-checklist-item\[data-id\][\s\S]*\.tm-kanban-card\[data-id\]/, 'focus sync must cover every mounted task view');
assert.match(focusSync, /tm-timer-dim[\s\S]*tm-timer-focus[\s\S]*tm-timer-focus-ancestor/, 'focus sync must update all focus visual states directly');
assert.match(focusSync, /parentTaskId \|\| cursor\?\.parent_task_id[\s\S]*ancestorIds\.add/, 'kanban focus sync must preserve focused-task ancestor styling');
assert.match(focusSync, /el\.closest\('\.tm-body--kanban'\)[\s\S]*ancestorIds\.has\(id\)/, 'ancestor focus styling must remain limited to the kanban view');
assert.doesNotMatch(focusSync, forbiddenRefresh, 'focus visual sync must not redraw the view or calendar');

const timerHook = segment(services, 'function __tmHookTomatoTimer()', 'function __tmListenTomatoAssociationCleared()');
const tomatoListeners = segment(services, 'function __tmListenTomatoAssociationCleared()', 'function __tmClearTomatoFocusRowClasses()');
// Focus changes only update row classes; changed duration settings may update derived counts.
const tomatoFocusListeners = segment(tomatoListeners, 'function __tmListenTomatoAssociationCleared()', '__tmTomatoHistoryUpdatedHandler =');
for (const [label, source] of [['timer stop/reset hooks', timerHook], ['tomato association and focus events', tomatoFocusListeners]]) {
    assert.match(source, /__tmSyncTomatoFocusInPlace\(/, `${label} must use the in-place focus sync`);
    assert.doesNotMatch(source, forbiddenRefresh, `${label} must not redraw the view or calendar`);
}
assert.match(tomatoListeners, /__tmTomatoAssociationListenerAdded = true;[\s\S]*__tmRestoreTomatoFocusAfterReload\(\)/, 'listener setup must restore the active tomato focus after a Task Horizon reload');

const reloadRestore = segment(services, 'function __tmReadActiveTomatoFocusSnapshot()', 'function __tmListenTomatoAssociationCleared()');
assert.match(reloadRestore, /getActiveFocusSnapshot/, 'reload recovery must prefer the live tomato focus snapshot');
assert.match(reloadRestore, /tomatoSync\?\.getState/, 'reload recovery must support older tomato runtimes through their sync state');
assert.match(reloadRestore, /__tmGetStoredTomatoFocusTaskId/, 'reload recovery must support task associations that are excluded from tomato sync');
assert.match(reloadRestore, /__tmIsKnownTomatoFocusTaskId/, 'untrusted legacy associations must match a Task Horizon task before focus is restored');
assert.match(reloadRestore, /attempt < 5[\s\S]*setTimeout/, 'reload recovery must retry while plugin state is still loading');
assert.doesNotMatch(reloadRestore, forbiddenRefresh, 'reload focus recovery must not redraw the view or calendar');
assert.match(shellLifecycle, /__tmTomatoFocusRestoreRetryTimer[\s\S]*clearTimeout/, 'plugin cleanup must cancel pending tomato focus retries');

const clearFocusClasses = segment(services, 'function __tmClearTomatoFocusRowClasses()', 'function __tmSyncTomatoFocusInPlace');
assert.match(clearFocusClasses, /tm-timer-focus-ancestor/, 'focus cleanup must remove ancestor styling as well');

const focusStateSync = segment(services, 'function __tmSyncTomatoFocusInPlace', 'async function __tmSettleTomatoAfterTaskDone');
assert.match(focusStateSync, /sessionStorage\?\.setItem[\s\S]*__TM_TOMATO_FOCUS_SESSION_KEY/, 'focus sync must preserve the linked task across a Task Horizon reload');
assert.match(focusStateSync, /sessionStorage\?\.removeItem[\s\S]*__TM_TOMATO_FOCUS_SESSION_KEY/, 'focus cleanup must remove the stored linked task');

const settleSource = segment(services, 'async function __tmSettleTomatoAfterTaskDone', 'function __tmIsTomatoFocusModeEnabled');
assert.match(settleSource, /__tomatoTimerV2[\s\S]*settleAssociatedTask/, 'task completion must prefer the v2 settle contract');
assert.match(settleSource, /result\?\.ok === true/, 'only a successful settle response may clear focus');
assert.match(settleSource, /const focusMatches[\s\S]*const clearMatchedFocus[\s\S]*const api =/, 'focus clearing must be deferred to the settle result path');
assert.match(settleSource, /'ok' in result[\s\S]*result\??\.ok === true/, 'a v2 failed settle response must not be treated as a legacy matched result');

const startSources = [uiFoundation, renderRuntime, taskRuntime].join('\n');
assert.match(uiFoundation, /function __tmStartTaskDetailQuickTimer[\s\S]*__tmSyncTomatoFocusInPlace\(timerTaskId\)/, 'task detail timer start must sync focus without rendering');
assert.match(renderRuntime, /const runTaskTimer = async \(minutes, mode = 'countdown'\)[\s\S]*__tmSyncTomatoFocusInPlace\(timerTaskId\)/, 'other-block timer start must sync focus without rendering');
assert.match(taskRuntime, /window\.tmStartPomodoro[\s\S]*__tmSyncTomatoFocusInPlace\(resolvedId\)/, 'task timer start must sync focus without rendering');
assert.match(taskRuntime, /const runTaskTimer = async \(minutes, mode = 'countdown'\)[\s\S]*__tmSyncTomatoFocusInPlace\(timerTaskId\)/, 'task context timer start must sync focus without rendering');
assert.doesNotMatch(startSources, /timerFocusTaskId\s*=\s*[^;]+;\s*(?:try\s*\{\s*)?render\s*\(/, 'timer entry points must not restore direct render-based focus updates');

assert.match(styles, /\.tm-kanban--clean \.tm-kanban-subtask-row\.tm-kanban-card\.tm-timer-focus\s*\{[\s\S]*?inset 0 0 0 1px var\(--tm-primary-color\)/, 'focused kanban subtasks must retain a full inset border');
assert.match(styles, /\.tm-kanban--clean \.tm-kanban-subtask-row\.tm-kanban-card\.tm-timer-focus:hover\s*\{[\s\S]*?0 0 0 2px color-mix\(in srgb, var\(--tm-primary-color\) 18%, transparent\)/, 'focused kanban subtasks must retain the hover focus ring');

const vm = require('node:vm');
const focusHandler = segment(services, '__tmTomatoAssociationChangedHandler = (event)', '__tmTomatoFocusModeChangedHandler =');
const context = vm.createContext({ state: { timerFocusTaskId: '' }, SettingsStore: { data: { enableTomatoIntegration: true } } });
vm.runInContext('var __tmTomatoAssociationChangedHandler, __tmTomatoAssociationHandler; function __tmSyncTomatoFocusInPlace(id) { state.timerFocusTaskId = id; }\n' + focusHandler, context);
const changed = (detail) => context.__tmTomatoAssociationChangedHandler({ detail });
changed({ taskBlockId: 'a', actionSource: 'timer-context-menu', activeTimer: true });
assert.equal(context.state.timerFocusTaskId, 'a');
changed({ taskBlockId: 'b', prevTaskBlockId: 'a', actionSource: 'timer-context-menu', activeTimer: true });
assert.equal(context.state.timerFocusTaskId, 'b');
context.__tmTomatoAssociationHandler({ detail: { prevTaskBlockId: 'a' } });
assert.equal(context.state.timerFocusTaskId, 'b', 'clearing an unrelated link retains the current focus');
context.__tmTomatoAssociationHandler({ detail: { prevTaskBlockId: 'b' } });
assert.equal(context.state.timerFocusTaskId, '');
changed({ taskBlockId: 'c', actionSource: 'timer-context-menu', activeTimer: false });
assert.equal(context.state.timerFocusTaskId, '', 'selecting the next task while idle does not enter focus mode');

const taskBridge = read('src/task-horizon/main/shell/81-ai-bridge-runtime.js');
const taskSearch = segment(taskBridge, '    function __tmAiSearchTaskAssociations(', '    function __tmIsAiFeatureEnabled(');
const blockId = segment(taskBridge, '    function __tmAiTaskBlockId(', '    function __tmAiTaskReadValues(');
const queryMethod = segment(taskBridge, '        async searchTasks(', '        async getDocumentSnapshot(');
const rows = [
    { id: '20260101000000-aaaaaaa', content: 'Write release notes', docName: 'Launch project', done: true },
    { id: '20260101000000-bbbbbbb', content: 'Review issue', docName: 'Inbox' },
    { id: '20260101000000-ccccccc', content: 'Repeat write', docName: 'Launch project', isRecurringInstanceReadOnly: true },
];
const queryContext = vm.createContext({
    API: { getTaskTitlePresentation: (text) => ({ text }) },
    window: { tmEnsureCalendarTaskCache: async (options) => {
        assert.equal(options.allowInactiveFullLoad, true);
        assert.equal(options.refresh, false);
        return rows;
    } },
});
vm.runInContext(taskSearch + blockId + 'this.bridge = {\n' + queryMethod + '};', queryContext);
(async () => {
    const byDoc = await queryContext.bridge.searchTasks('launch PROJECT');
    const byTitle = await queryContext.bridge.searchTasks('release NOTES');
    assert.equal(byDoc.length, 1);
    assert.equal(byTitle.length, 1);
    assert.equal(byDoc[0].id, rows[0].id);
    assert.equal(byTitle[0].id, rows[0].id, 'completed real tasks are selectable and recurring history rows are excluded');
    assert.equal((await queryContext.bridge.searchTasks('', { limit: 1 })).length, 1);
    console.log('tomato focus and association search contract tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
