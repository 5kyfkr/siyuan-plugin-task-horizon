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
for (const [label, source] of [['timer stop/reset hooks', timerHook], ['tomato association and focus events', tomatoListeners]]) {
    assert.match(source, /__tmSyncTomatoFocusInPlace\(/, `${label} must use the in-place focus sync`);
    assert.doesNotMatch(source, forbiddenRefresh, `${label} must not redraw the view or calendar`);
}

const clearFocusClasses = segment(services, 'function __tmClearTomatoFocusRowClasses()', 'function __tmSyncTomatoFocusInPlace');
assert.match(clearFocusClasses, /tm-timer-focus-ancestor/, 'focus cleanup must remove ancestor styling as well');

const startSources = [uiFoundation, renderRuntime, taskRuntime].join('\n');
assert.match(uiFoundation, /function __tmStartTaskDetailQuickTimer[\s\S]*__tmSyncTomatoFocusInPlace\(timerTaskId\)/, 'task detail timer start must sync focus without rendering');
assert.match(renderRuntime, /const runTaskTimer = async \(minutes, mode = 'countdown'\)[\s\S]*__tmSyncTomatoFocusInPlace\(timerTaskId\)/, 'other-block timer start must sync focus without rendering');
assert.match(taskRuntime, /window\.tmStartPomodoro[\s\S]*__tmSyncTomatoFocusInPlace\(resolvedId\)/, 'task timer start must sync focus without rendering');
assert.match(taskRuntime, /const runTaskTimer = async \(minutes, mode = 'countdown'\)[\s\S]*__tmSyncTomatoFocusInPlace\(timerTaskId\)/, 'task context timer start must sync focus without rendering');
assert.doesNotMatch(startSources, /timerFocusTaskId\s*=\s*[^;]+;\s*(?:try\s*\{\s*)?render\s*\(/, 'timer entry points must not restore direct render-based focus updates');

console.log('tomato focus refresh isolation contract tests passed');
