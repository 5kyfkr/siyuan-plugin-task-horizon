'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '../src/task-horizon/main', file), 'utf8');
const model = read('task-runtime/50-task-model-and-repeat-utils.js');
const list = read('task-runtime/53-list-render-and-document-loader.js');
const services = read('20-api-and-runtime-services.js');
const stores = read('10-stores-rules-and-cache.js');
const extract = (source, name) => {
    const start = source.search(new RegExp(`    (?:async )?function ${name}\\(`));
    assert.ok(start >= 0, name);
    return source.slice(start, source.indexOf('\n    }', start) + 6);
};
const dateKey = value => value instanceof Date
    ? [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-')
    : String(value || '').slice(0, 10);
const today = dateKey(new Date());
const state = {
    flatTasks: {}, pendingInsertedTasks: {}, pendingDeletedTasks: {}, doneOverrides: {},
    taskTree: [], filteredTasks: [], otherBlocks: [], collapsedTaskIds: new Set(), viewMode: 'checklist',
};
let failWrite = false;
let pendingWrite = null;
const context = vm.createContext({
    state, Date, Map, Set, Promise, Symbol, setTimeout, clearTimeout, queueMicrotask,
    console: { info() {}, log() {}, warn() {}, error() {} },
    Element: class {},
    SettingsStore: { data: {} }, MetaStore: { set() {}, remapId() {} },
    __tmNormalizeDateOnly: dateKey,
    __tmIsCollectedOtherBlockTask: () => false,
    __tmIsRecurringInstanceTask: () => false,
    __tmIsMobileDevice: () => false, __tmHostUsesMobileUI: () => false,
    __tmBuildTaskCheckboxStyle: () => '', esc: String, hint() {},
    __tmScheduleViewRefresh() {},
    __tmPersistMetaAndAttrsKernel: async () => {
        if (pendingWrite) await pendingWrite;
        if (failWrite) throw new Error('simulated check-in failure');
        return true;
    },
    __tmResolveTaskMetaFieldByAttrKey: () => '',
});
context.window = context;
vm.runInContext(read('32-runtime-state-and-events.js'), context);
const store = context.__tmTaskStore;
context.__tmTaskBoundary = { getTask: id => store.get(id) };
vm.runInContext(model.slice(model.indexOf('function __tmParseTaskRepeatJson'), model.indexOf('function __tmGetTaskRepeatWeekdayLabel')), context);
vm.runInContext([
    extract(stores, '__tmStableSettingsJsonValue'),
    extract(stores, '__tmGetSettingsFieldFingerprint'),
    extract(services, '__tmNormalizeQueueTaskValue'),
    extract(services, '__tmReadQueuedVerificationField'),
    extract(services, '__tmQueuedVerificationValuesMatch'),
    stores.slice(stores.indexOf('    const __TM_LOCAL_TASK_PATCH_WATERMARK_TTL_MS'), stores.indexOf('    function __tmMergeLocalTaskPatchIntoTask(')),
].join('\n'), context);
vm.runInContext(extract(model, '__tmRenderTaskCheckbox'), context);
vm.runInContext(list.slice(list.indexOf('const __tmSetDoneIngressByTask'), list.indexOf('    // 保存所有任务到MetaStore')), context);

const initialTask = {
    id: 'checkin-projection', root_id: 'doc-1', done: false, taskMarker: ' ', content: 'Check-in',
    repeatRule: { enabled: true, type: 'daily', trigger: 'checkin', every: 1, anchorDate: today },
    repeatState: { checkinHistory: [] },
};
store.replaceFlat({ [initialTask.id]: { ...initialTask } }, { authoritative: true, mergeOtherBlocks: false });
const isChecked = task => context.__tmIsTaskCheckinChecked(task, today);
const input = { type: 'checkbox', checked: false, closest: () => null };
const event = { target: input, stopPropagation() {} };
function assertViewChecked(expected) {
    assert.equal(isChecked(store.get(initialTask.id)), expected, 'local task must match the saved check-in');
    assert.equal(isChecked(store.getConfirmed(initialTask.id)), expected, 'confirmed base must be updated after the first click');
    assert.equal(isChecked(store.getProjected(initialTask.id)), expected, 'mounted views must not restore the old base');
    assert.equal(/ checked/.test(context.__tmRenderTaskCheckbox(initialTask.id, store.get(initialTask.id))), expected);
    assert.equal(input.checked, expected);
    assert.equal(store.getProjected(initialTask.id).done, false, 'check-ins never permanently complete the task');
}

async function run() {
    const matches = context.__tmQueuedVerificationValuesMatch;
    assert.equal(matches('repeatRule', initialTask.repeatRule, { ...initialTask.repeatRule, trigger: 'due' }), false);
    assert.equal(matches('repeatState', { occurrenceCount: 1 }, { occurrenceCount: 2 }), false);
    assert.equal(matches('repeatHistory', [], [{ completedAt: new Date().toISOString() }]), false);
    assert.equal(matches('customFieldValues', { tags: ['a'] }, { tags: ['b'] }), false);
    assert.equal(matches('object', { a: 1, b: [2] }, { b: [2], a: 1 }), true, 'object key order is irrelevant');
    assert.equal(matches('repeatState', '{"checkinHistory":[]}', { checkinHistory: [] }), true, 'serialized and normalized states compare equally');
    for (const view of ['checklist', 'kanban']) {
        state.viewMode = view;
        const oldRead = store.captureRead(['doc-1']);
        input.checked = true;
        await context.tmSetDone(initialTask.id, true, event);
        assertViewChecked(true);
        assert.equal(store.isReadCurrent(oldRead), false, 'reads started before check-in must be invalidated');
        const staleUnchecked = { ...initialTask, repeatState: { checkinHistory: [] } };
        context.__tmConfirmLocalTaskPatchWatermarkFromTask(initialTask.id, staleUnchecked);
        assert.ok(context.__tmGetLocalTaskPatchWatermark(initialTask.id), 'a stale unchecked read must not clear the check-in watermark');
        store.acceptAuthoritative([staleUnchecked]);
        assertViewChecked(true);
        const staleChecked = JSON.parse(JSON.stringify(store.getConfirmed(initialTask.id)));
        assert.deepEqual(Array.from(context.__tmConfirmLocalTaskPatchWatermarkFromTask(initialTask.id, staleChecked)), ['repeatState'], 'a matching read may confirm the write');
        input.checked = false;
        await context.tmSetDone(initialTask.id, false, event);
        assertViewChecked(false);
        context.__tmConfirmLocalTaskPatchWatermarkFromTask(initialTask.id, staleChecked);
        assert.ok(context.__tmGetLocalTaskPatchWatermark(initialTask.id), 'a stale checked read must not clear the undo watermark');
        store.acceptAuthoritative([staleChecked]);
        assertViewChecked(false);
        const currentUnchecked = store.getConfirmed(initialTask.id);
        assert.deepEqual(Array.from(context.__tmConfirmLocalTaskPatchWatermarkFromTask(initialTask.id, currentUnchecked)), ['repeatState']);
    }
    failWrite = true;
    input.checked = true;
    assert.equal(await context.tmSetDone(initialTask.id, true, event), false);
    assertViewChecked(false);
    failWrite = false;

    let release;
    pendingWrite = new Promise(resolve => { release = resolve; });
    input.checked = true;
    const check = context.tmSetDone(initialTask.id, true, event);
    await new Promise(setImmediate);
    input.checked = false;
    const uncheck = context.tmSetDone(initialTask.id, false, event);
    release();
    await Promise.all([check, uncheck]);
    assertViewChecked(false);
    console.log('check-in checkbox projection tests passed');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
