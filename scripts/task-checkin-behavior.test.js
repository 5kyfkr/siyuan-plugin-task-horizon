'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../src/task-horizon/main');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const model = read('task-runtime/50-task-model-and-repeat-utils.js');
const list = read('task-runtime/53-list-render-and-document-loader.js');
const native = read('shell/72-shell-entrances-and-native-doc-hooks.js');
const api = read('20-api-and-runtime-services.js');
const recurring = read('task-runtime/54-recurring-task-runtime.js');
const detail = read('task-runtime/52-task-detail-runtime.js');

function extract(source, name) {
    const start = source.search(new RegExp(`    (?:async )?function ${name}\\(`));
    assert.ok(start >= 0, name);
    const end = source.indexOf('\n    }', start);
    assert.ok(end > start, name);
    return source.slice(start, end + 6);
}

let now = new Date(2026, 8, 30, 12).getTime();
class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
}
const dateKey = value => value && typeof value.getFullYear === 'function'
    ? [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-')
    : String(value || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '';
const rule = patch => ({ enabled: true, trigger: 'checkin', type: 'daily', every: 1, anchorDate: '2026-09-28', ...patch });
const task = {
    id: 'task-1', root_id: 'doc-1', done: false, taskMarker: ' ', markdown: '- [ ] Habit',
    startDate: '2026-09-28', completionTime: '2026-09-28', repeatRule: rule(), repeatState: {},
};
function node(attrs = {}) {
    const classes = new Set();
    return {
        attrs, children: [],
        classList: { contains: name => classes.has(name), toggle: (name, value) => value ? classes.add(name) : classes.delete(name) },
        getAttribute: name => attrs[name] ?? null,
        setAttribute: (name, value) => { attrs[name] = value; },
        hasAttribute: name => Object.hasOwn(attrs, name),
    };
}
const item = node({ 'data-node-id': task.id, 'data-task': ' ' });
const mirror = node({ 'data-node-id': task.id, 'data-task': ' ' });
const child = node({ 'data-node-id': 'child-1', 'data-task': ' ' });
for (const parent of [item, mirror, child]) {
    parent.icon = node({ 'xlink:href': '#iconUncheck', href: '#iconUncheck' });
    parent.action = node();
    parent.action.owner = parent;
    parent.action.classList.toggle('protyle-action--task', true);
    parent.action.querySelector = () => parent.icon;
    parent.input = { checked: false, owner: parent };
    parent.children = [parent.action];
    parent.querySelectorAll = () => [parent.input];
}
item.children.push(child);
item.querySelectorAll = () => [item.input, child.input];
const calls = { writes: [], projections: [], events: [], refresh: [], hints: [], ordinary: [] };
let failWrite = false;
let pendingWrite = null;
let userInitiated = false;
const context = vm.createContext({
    Date: Clock, console: { ...console, info() {} }, Intl, setTimeout, clearTimeout, Element: class {},
    __tmNormalizeDateOnly: dateKey,
    __tmNormalizeTaskCompleteAtValue: value => String(value || ''),
    __tmTaskBoundary: { getTask: id => id === task.id ? task : null },
    __tmTaskStore: { upsertLocal: () => {}, applyMutation: mutation => calls.projections.push(mutation) },
    MetaStore: { set: () => {} },
    __tmEnsureTaskInStateById: async () => task,
    __tmPersistMetaAndAttrsKernel: async (id, patch) => {
        if (pendingWrite) await pendingWrite;
        if (failWrite) throw new Error('simulated save failure');
        calls.writes.push({ id, patch: JSON.parse(JSON.stringify(patch)) });
        return true;
    },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    dispatchEvent: event => calls.events.push(event),
    __tmScheduleViewRefresh: options => calls.refresh.push(options),
    document: { querySelectorAll: () => [item.action, mirror.action, child.action] },
    __tmFindNativeDocTaskListItemsByIds: ids => ids.includes(task.id) ? [item, mirror] : [],
    __tmFindNativeDocTaskListItem: input => input.owner,
    __tmResolveNativeDocTaskBlockId: action => action.owner.getAttribute('data-node-id'),
    __tmReadNativeDocTaskMarkerFromDom: () => item.getAttribute('data-task'),
    __tmReadNativeDocTaskDoneFromDom: () => item.getAttribute('data-task') === 'X',
    __tmMarkNativeDocCheckboxSyncedState: () => {},
    __tmBumpNativeDocCheckboxReconcileVersion: () => 1,
    __tmFlushSqlTransactionsSafe: async () => {},
    __tmWasNativeDocCheckboxRecentlySynced: () => false,
    __tmResolveTaskBindingFromAnyBlockId: async () => ({ taskId: task.id, task }),
    __tmConsumeNativeDocCheckboxPreviousState: () => ({ userInitiated }),
    __tmConsumeNativeDocCheckboxInsertedBlock: () => false,
    normalizeTaskFields: () => {},
    hint: message => calls.hints.push(message),
    __tmIsCollectedOtherBlockTask: () => false,
    esc: String, __tmBuildTaskCheckboxStyle: () => '',
    __tmShouldSyncCalendarDoneInPlace: () => false,
    __tmMutationGetTask: () => task,
    __tmQueueSetDoneTask: (...args) => { calls.ordinary.push(args); return Promise.resolve(true); },
    __tmBuildTaskTomatoBaselinePatch: () => ({ tomatoBaselineSet: true }),
    __tmGetStatusOptions: () => [],
    __tmFindStatusOptionById: id => ({ id, marker: id === 'done' ? 'X' : ' ' }),
    __tmGetDefaultUndoneStatusId: () => 'todo',
    __tmResolveTaskMarker: value => value.taskMarker || (value.done ? 'X' : ' '),
    __tmResolveTaskMarkdownMarker: value => value.taskMarker,
    __tmNormalizeTaskStatusMarker: value => value,
    __tmNormalizeCompatTaskStatusMarker: value => value,
    __tmGuessStatusOptionDefaultMarker: value => value.marker,
    __tmIsTaskMarkerDone: value => value === 'X',
    __tmIsTaskMarkerClosed: value => value === 'X' || value === '-',
});
context.window = context;
vm.runInContext(model.slice(model.indexOf('function __tmParseTaskRepeatJson'), model.indexOf('function __tmGetTaskRepeatWeekdayLabel')), context);
vm.runInContext(extract(model, '__tmRenderTaskCheckbox'), context);
vm.runInContext(extract(detail, '__tmToggleTaskTimeHubCheckin'), context);
vm.runInContext(list.slice(list.indexOf('const __tmTaskCheckinIngressByTask'), list.indexOf('async function __tmSetDoneFromUi')), context);
for (const name of ['__tmProjectNativeDocCheckinCheckbox', '__tmRefreshNativeDocCheckinCheckboxes', '__tmApplyNativeDocCheckboxDomProjection', '__tmSyncNativeDocCheckboxLinkedStatus']) {
    vm.runInContext(extract(native, name), context);
}
for (const name of ['__tmIsTaskNativeDone', '__tmIsTaskDoneEffective', '__tmMutationSetDone', '__tmApplyQueuedTaskStatusPatch']) {
    vm.runInContext(extract(api, name), context);
}
for (const name of ['__tmSetDoneKernel', '__tmBuildSetDoneQueuedDefinition', '__tmRunSetDonePostCommitEffects', '__tmRunCommittedSetDoneEffects']) {
    vm.runInContext(extract(list, name), context);
}
vm.runInContext(recurring.slice(recurring.indexOf('function __tmGetTaskRepeatScheduleSignature'), recurring.indexOf('async function __tmApplyTaskRepeatRule')), context);

function assertNote(checked) {
    for (const note of [item, mirror]) {
        assert.equal(note.getAttribute('data-task'), checked ? 'X' : ' ');
        assert.equal(note.classList.contains('protyle-task--done'), checked);
        assert.equal(note.icon.getAttribute('xlink:href'), checked ? '#iconCheck' : '#iconUncheck');
        assert.equal(note.icon.getAttribute('href'), checked ? '#iconCheck' : '#iconUncheck');
        assert.equal(note.input.checked, checked);
    }
    assert.equal(child.input.checked, false, 'projection must not toggle nested tasks');
}

async function run() {
    assert.equal(context.__tmGetTaskCheckinScheduledDate(task, '2026-09-30'), '2026-09-30');
    task.repeatRule = rule({ every: 2 });
    assert.equal(context.__tmGetTaskCheckinScheduledDate(task, '2026-09-29'), '');
    task.repeatRule = rule({ type: 'weekly', weekdays: [1, 3, 5] });
    assert.equal(context.__tmGetTaskCheckinScheduledDate(task, '2026-09-30'), '2026-09-30');
    assert.equal(context.__tmGetTaskCheckinScheduledDate(task, '2026-10-01'), '');
    task.repeatRule = rule({ type: 'weekly', weekdays: [3, 5], maxOccurrences: 1 });
    assert.equal(context.__tmGetTaskCheckinScheduledDate(task, '2026-09-28'), '', 'an off-schedule anchor is not a check-in');
    assert.equal(context.__tmGetTaskCheckinScheduledDate(task, '2026-09-30'), '2026-09-30');
    assert.equal(context.__tmGetTaskCheckinScheduledDate(task, '2026-10-02'), '');
    task.repeatRule = rule({ type: 'workday' });
    assert.equal(context.__tmGetTaskCheckinScheduledDate(task, '2026-10-03'), '');
    task.repeatRule = rule({ type: 'workday', anchorDate: '2026-09-26', every: 2 });
    assert.equal(context.__tmGetTaskCheckinScheduledDate(task, '2026-09-26'), '');
    assert.equal(context.__tmGetTaskCheckinScheduledDate(task, '2026-09-28'), '2026-09-28');
    assert.equal(context.__tmGetTaskCheckinScheduledDate(task, '2026-09-30'), '2026-09-30');
    task.repeatRule = rule({ type: 'monthly', monthDays: [28, 30] });
    assert.equal(context.__tmGetTaskCheckinScheduledDate(task, '2026-09-30'), '2026-09-30');
    task.repeatRule = rule({ maxOccurrences: 2 });
    assert.equal(context.__tmGetTaskCheckinScheduledDate(task, '2026-09-30'), '');
    assert.equal(context.__tmIsCheckinTask(task), true, 'ending the schedule does not enable permanent completion');
    task.repeatRule = rule({ until: '2026-09-29' });
    assert.equal(context.__tmGetTaskCheckinScheduledDate(task, '2026-09-30'), '');
    task.repeatRule = rule();

    await context.tmSetTaskCheckin(task.id, '2026-09-30', true);
    assertNote(true);
    assert.equal(task.done, false);
    assert.equal(task.taskMarker, ' ');
    assert.equal(task.markdown, '- [ ] Habit', 'DOM projection must not overwrite stored markdown');
    assert.equal(task.startDate, '2026-09-28');
    assert.equal(task.completionTime, '2026-09-28');
    assert.equal(context.__tmIsTaskDoneEffective({ ...task, done: true, taskMarker: 'X' }), false);
    assert.equal(context.__tmBuildTaskRepeatAdvancePatch(task, task.repeatRule), null);
    assert.equal(context.__tmApplyNativeDocCheckboxDomProjection(task.id, true), true);
    assert.ok(calls.projections.every(mutation => Object.keys(mutation.patch).join() === 'repeatState'), 'check-in mutations must not project permanent done');

    item.setAttribute('data-task', ' ');
    await context.__tmSyncNativeDocCheckboxLinkedStatus(task.id);
    assertNote(true);
    assert.equal(calls.writes.length, 1, 'reopening the note only restores its visual state');
    userInitiated = true;
    item.setAttribute('data-task', ' ');
    await context.__tmSyncNativeDocCheckboxLinkedStatus(task.id);
    assertNote(false);
    assert.equal(task.repeatState.checkinHistory.length, 0);
    item.setAttribute('data-task', 'X');
    await context.__tmSyncNativeDocCheckboxLinkedStatus(task.id);
    assertNote(true);
    assert.equal(task.repeatState.checkinHistory.length, 1);
    failWrite = true;
    item.setAttribute('data-task', ' ');
    assert.equal(await context.__tmSyncNativeDocCheckboxLinkedStatus(task.id), false);
    assertNote(true);
    failWrite = false;
    userInitiated = false;

    await context.tmSetTaskCheckin(task.id, '2026-09-29', true);
    assertNote(true);
    await context.tmSetTaskCheckin(task.id, '2026-09-29', false);
    assertNote(true);
    await assert.rejects(context.tmSetTaskCheckin(task.id, '2026-10-01', true), /未来/);
    task.repeatRule = rule({ every: 2 });
    const historyBeforeMakeup = JSON.stringify(task.repeatState.checkinHistory);
    const nextBeforeMakeup = context.__tmGetTaskCheckinNextDate(task);
    for (const date of ['2026-09-29', '2026-09-27']) {
        await context.__tmToggleTaskTimeHubCheckin(task, date);
        assert.equal(context.__tmIsTaskCheckinChecked(task, date), true, 'past non-plan days can be checked');
        assert.equal(context.__tmGetTaskCheckinNextDate(task), nextBeforeMakeup, 'makeup must not move the plan');
        assertNote(true, 'makeup must preserve today\'s note state');
        await context.__tmToggleTaskTimeHubCheckin(task, date);
        assert.equal(JSON.stringify(task.repeatState.checkinHistory), historyBeforeMakeup, 'undo preserves other dates');
    }
    await assert.rejects(context.tmSetTaskCheckin(task.id, '2026-10-01', false), /未来/);

    now = new Date(2026, 9, 1, 12).getTime();
    context.__tmRefreshNativeDocCheckinCheckboxes();
    assertNote(false);
    assert.equal(task.repeatState.checkinHistory[0].scheduledDate, '2026-09-30');
    userInitiated = true;
    item.setAttribute('data-task', 'X');
    await context.__tmSyncNativeDocCheckboxLinkedStatus(task.id);
    assertNote(true);
    assert.equal(context.__tmIsTaskCheckinChecked(task, '2026-10-01'), true, 'notes allow an extra check-in today');
    assert.equal(context.__tmGetTaskCheckinNextDate(task, '2026-10-01'), '2026-10-02');
    context.__tmRefreshNativeDocCheckinCheckboxes();
    assertNote(true);
    userInitiated = false;
    task.repeatRule = rule();
    await context.__tmMutationSetDone(task.id, true, { wait: true });
    assertNote(true);
    assert.equal(calls.ordinary.length, 0, 'public completion must use the check-in service');
    assert.equal(task.done, false);
    assert.equal(context.__tmBuildSetDoneQueuedDefinition(task.id, true, task), null);
    await assert.rejects(context.__tmSetDoneKernel(task.id, true), /切换循环/);
    await assert.rejects(context.__tmApplyQueuedTaskStatusPatch(task.id, { customStatus: 'done' }), /永久完成/);
    assert.equal(context.__tmRunSetDonePostCommitEffects(task.id, { done: true }), false);
    const effects = await context.__tmRunCommittedSetDoneEffects(task.id, { done: true, rewardPriorityScore: 50 });
    assert.equal(effects.rewardDispatched, false);
    assert.equal(effects.followUpOps.length, 0);
    assert.equal(context.__tmIsRecurringNativeDoneHeld({ ...task, taskMarker: 'X', repeatState: { pendingNativeDoneReset: true } }), false);

    await context.tmSetTaskCheckin(task.id, '2026-10-01', false);
    let release;
    pendingWrite = new Promise(resolve => { release = resolve; });
    userInitiated = true;
    item.setAttribute('data-task', 'X');
    const firstClick = context.__tmSyncNativeDocCheckboxLinkedStatus(task.id);
    await new Promise(setImmediate);
    item.setAttribute('data-task', ' ');
    release();
    await firstClick;
    assert.equal(item.getAttribute('data-task'), ' ', 'a save must not overwrite a newer native click');
    pendingWrite = null;
    await context.__tmSyncNativeDocCheckboxLinkedStatus(task.id);
    assertNote(false);
    assert.equal(context.__tmIsTaskCheckinChecked(task, '2026-10-01'), false);
    userInitiated = false;
    await context.tmSetTaskCheckin(task.id, '2026-10-01', true);

    const capture = vm.createContext({
        Date: Clock,
        __TM_NATIVE_DOC_CHECKBOX_PREVIOUS_STATE_TTL_MS: 5000,
        __tmNativeDocCheckboxPreviousStateMap: new Map(),
        __tmReadNativeDocTaskDoneFromDom: () => true,
        __tmReadNativeDocTaskMarkerFromDom: () => 'X',
        __tmReadNativeDocCheckboxTaskSnapshot: () => ({ taskId: task.id }),
    });
    vm.runInContext(extract(native, '__tmRememberNativeDocCheckboxPreviousState'), capture);
    capture.__tmRememberNativeDocCheckboxPreviousState(task.id, { previousDone: false, source: 'native-doc-checkbox-mutation-marker' });
    const click = capture.__tmRememberNativeDocCheckboxPreviousState(task.id, { source: 'native-doc-checkbox-click' });
    assert.equal(click.userInitiated, true, 'a projection observer must not swallow the next trusted click');
    assert.equal(click.previousDone, true, 'user snapshots start from the displayed check-in state');

    const changed = context.__tmBuildTaskRepeatRuleMetaPatch({ ...task, repeatState: { ...task.repeatState, pendingNativeDoneReset: true } }, task.repeatRule);
    assert.equal(changed.repeatState.pendingNativeDoneReset, false);
    assert.equal(changed.repeatState.checkinHistory.length, 2);
    for (const nextRule of [rule({ trigger: 'due' }), rule({ enabled: false, type: 'none' })]) {
        task.repeatRule = nextRule;
        assert.equal(context.__tmIsTaskDoneEffective({ ...task, done: true, taskMarker: 'X' }), true);
        await context.__tmMutationSetDone(task.id, true, { wait: true });
    }
    assert.equal(calls.ordinary.length, 2, 'other modes retain ordinary completion');

    now = new Date(2026, 8, 29, 12).getTime(); // Tuesday, outside the Monday/Wednesday/Friday plan.
    task.repeatRule = rule({ type: 'weekly', weekdays: [1, 3, 5], maxOccurrences: 3 });
    const ruleBeforeExtra = JSON.stringify(task.repeatRule);
    const historyBeforeExtra = JSON.stringify(task.repeatState.checkinHistory);
    assert.doesNotMatch(context.__tmRenderTaskCheckbox(task.id, task), / disabled| checked/);
    assert.match(context.__tmGetTaskCheckinTodayHint(task), /今日可额外打卡/);
    await context.__tmMutationSetDone(task.id, true, { wait: true });
    assertNote(true);
    assert.match(context.__tmRenderTaskCheckbox(task.id, task), / checked/);
    assert.equal(context.__tmGetTaskCheckinTodayHint(task), '今日已打卡');
    assert.equal(context.__tmIsTaskCheckinChecked(task, '2026-09-29'), true);
    assert.equal(context.__tmGetTaskCheckinNextDate(task, '2026-09-29'), '2026-09-30');
    assert.equal(context.__tmGetTaskCheckinScheduledDate(task, '2026-10-02'), '2026-10-02', 'extra check-ins must not consume planned occurrence counts');
    assert.equal(JSON.stringify(task.repeatRule), ruleBeforeExtra);
    assert.equal(task.done, false);
    assert.equal(task.startDate, '2026-09-28');
    assert.equal(task.completionTime, '2026-09-28');
    await context.__tmMutationSetDone(task.id, false, { wait: true });
    assertNote(false);
    assert.equal(JSON.stringify(task.repeatState.checkinHistory), historyBeforeExtra, 'undoing Tuesday preserves all other dates');

    now = new Date(2026, 9, 1, 23, 59, 30).getTime();
    context.__tmRefreshNativeDocCheckinCheckboxes();
    assertNote(true);
    let onMidnight;
    let refreshOptions;
    const rollover = vm.createContext({
        Date: Clock,
        setTimeout: callback => { onMidnight = callback; return 1; }, clearTimeout: () => {},
        __tmRefreshNativeDocCheckinCheckboxes: context.__tmRefreshNativeDocCheckinCheckboxes,
        __tmRunRecurringNativeDoneResetSweep: async () => 0,
        __tmRefreshViewsAfterTaskMutation: options => { refreshOptions = options; },
    });
    vm.runInContext('let __tmRecurringNativeDoneResetSweepTimer = null;\n' + extract(recurring, '__tmArmRecurringNativeDoneResetSweepTimer'), rollover);
    rollover.__tmArmRecurringNativeDoneResetSweepTimer();
    now = new Date(2026, 9, 2, 0, 0, 1).getTime();
    onMidnight();
    assertNote(false, 'the next day starts unchecked even after an extra check-in');
    assert.equal(context.__tmIsTaskCheckinChecked(task, '2026-10-01'), true, 'rollover preserves yesterday\'s check-in');
    assert.equal(refreshOptions.refresh, true);
    assert.equal(refreshOptions.refreshCalendar, true, 'rollover must reveal newly due calendar check-ins');
    // The date panel uses the same write service and the latest task state on every click.
    await context.__tmToggleTaskTimeHubCheckin({ ...task, repeatState: {} }, '2026-09-30');
    const checkedFromPanel = context.__tmIsTaskCheckinChecked(task, '2026-09-30');
    await context.__tmToggleTaskTimeHubCheckin({ ...task, repeatState: {} }, '2026-09-30');
    assert.equal(context.__tmIsTaskCheckinChecked(task, '2026-09-30'), !checkedFromPanel);
    task.repeatRule = rule({ type: 'weekly', weekdays: [1, 3, 5] });
    await assert.rejects(context.__tmToggleTaskTimeHubCheckin(task, '2026-10-05'), /未来/);
    assert.equal(task.startDate, '2026-09-28');
    assert.equal(task.completionTime, '2026-09-28');
    assert.ok(calls.writes.every(call => Object.keys(call.patch).join() === 'repeatState'));
    console.log('task check-in behavior tests passed');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
