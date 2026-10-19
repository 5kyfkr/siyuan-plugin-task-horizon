'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHarness, IDS } = require('./kernel-contract.test.js');
const plain = value => JSON.parse(JSON.stringify(value));

async function run() {
    // The real host silently limits unbounded SQL by search.limit. Put a
    // parent beyond that boundary, with a child on a later explicit page too.
    const limited = createHarness({ sqlDefaultLimit: 64 });
    const lateParent = '20261020000000-parent';
    const lateList = '20261020000001-list';
    const lateChild = '20261020000002-child';
    const lateChildEnd = '20261020000003-child';
    const hostAdd = (id, parent, type = 'i') => limited.blocks.set(id, { id, parent_id: parent, root_id: IDS.doc,
        type, subtype: type === 'i' ? 't' : '', markdown: '* [ ] Date test', content: 'Date test', sort: limited.blocks.size,
        created: '20261020000000', updated: '20261020000000' });
    for (let index = 0; index < 550; index++) hostAdd(`20261019${String(index).padStart(6, '0')}-filler`, IDS.singleList);
    hostAdd(lateParent, IDS.singleList);
    hostAdd(lateList, lateParent, 'l');
    hostAdd(lateChild, lateList);
    hostAdd(lateChildEnd, lateList);
    limited.attrs.set(lateChild, { 'custom-start-date': '2026-10-01', 'custom-completion-time': '2026-10-20' });
    limited.attrs.set(lateChildEnd, { 'custom-start-date': '2026-10-03', 'custom-completion-time': '2026-10-30' });
    await limited.start();
    const enableLate = await limited.call('taskHorizonMutateTask', { action: 'patch', taskID: lateParent, patch: { dateMode: 'rollup' } });
    assert.equal(enableLate.data.outcome, 'committed', JSON.stringify(enableLate));
    const readLate = async () => (await limited.call('taskHorizonGetTask', lateParent)).data;
    assert.equal((await readLate()).startDate, '2026-10-01');
    assert.equal((await readLate()).completionTime, '2026-10-30', 'all later-page children participate');
    limited.attrs.set(lateChildEnd, { 'custom-start-date': '2026-10-03', 'custom-completion-time': '2026-11-02' });
    const reconcileLate = await limited.call('taskHorizonMutateTask', { action: 'reconcileDates', documentIDs: [IDS.doc] });
    assert.equal(reconcileLate.data.outcome, 'committed', JSON.stringify(reconcileLate));
    assert.equal((await readLate()).completionTime, '2026-11-02', 'refresh also reads every page');
    hostAdd('20261021000000-child', IDS.childList);
    limited.attrs.set('20261021000000-child', { 'custom-start-date': '2026-01-01', 'custom-completion-time': '2026-12-31' });
    const enableEarly = await limited.call('taskHorizonMutateTask', { action: 'patch', taskID: IDS.singleTask, patch: { dateMode: 'rollup' } });
    assert.equal(enableEarly.data.outcome, 'committed', JSON.stringify(enableEarly));
    const early = (await limited.call('taskHorizonGetTask', IDS.singleTask)).data;
    assert.equal(early.startDate, '2026-01-01', 'a first-page parent still includes later-page children');
    assert.equal(early.completionTime, '2026-12-31');

    const h = createHarness();
    await h.start();
    const command = async input => {
        const result = await h.call('taskHorizonMutateTask', input);
        assert.equal(result.ok, true, JSON.stringify(result));
        assert.equal(result.data.outcome, 'committed', JSON.stringify(result.data));
        assert.equal(result.data.dateRollupError, '', 'derived writes must succeed');
        return result.data;
    };
    const patch = (id, value, extra = {}) => command({ action: 'patch', taskID: id, patch: value, ...extra });
    const get = async id => (await h.call('taskHorizonGetTask', id)).data;
    const dates = async id => {
        const task = await get(id);
        return [task.dateMode, task.startDate, task.completionTime];
    };
    const add = (id, parent, type = 'i') => h.blocks.set(id, { id, parent_id: parent,
        root_id: IDS.doc, type, subtype: type === 'i' ? 't' : '', markdown: type === 'i' ? '* [ ] Test' : '',
        content: 'Test', updated: '20261019000000', created: '20261019000000', sort: h.blocks.size });
    const sibling = '20261019000001-sibling';
    add(sibling, IDS.childList);
    await patch(IDS.singleTask, { startDate: '2026-10-01', completionTime: '2026-10-31' });
    await patch(IDS.childTask, { startDate: '2026-10-20', completionTime: '2026-10-23' });
    await patch(sibling, { startDate: '2026-10-18', completionTime: '2026-10-25', done: true });
    assert.deepEqual(await dates(IDS.singleTask), ['manual', '2026-10-01', '2026-10-31'], 'default mode leaves existing dates alone');
    const enabled = await patch(IDS.singleTask, { dateMode: 'rollup' });
    assert.deepEqual(await dates(IDS.singleTask), ['rollup', '2026-10-18', '2026-10-25'], 'completed children participate');
    assert.deepEqual(plain(enabled.value.changes), { dateMode: 'rollup', startDate: '2026-10-18', completionTime: '2026-10-25' });
    const undoMode = await h.call('taskHorizonUndoLastMutation', { undoID: enabled.value.undoID });
    assert.equal(undoMode.ok, true, JSON.stringify(undoMode));
    assert.deepEqual(await dates(IDS.singleTask), ['manual', '2026-10-01', '2026-10-31'], 'one undo restores the entire mode transition');
    await patch(IDS.singleTask, { dateMode: 'rollup' });
    const changed = await patch(sibling, { startDate: '2026-10-22', completionTime: '2026-10-24' });
    assert.deepEqual(await dates(IDS.singleTask), ['rollup', '2026-10-20', '2026-10-24'], 'range shrinks at either edge');
    assert.equal(changed.dateRollupUpdates.some(item => item.taskID === IDS.singleTask), true, 'receipt projects changed parent dates');
    const undone = await h.call('taskHorizonUndoLastMutation', { undoID: changed.value.undoID });
    assert.equal(undone.ok, true);
    assert.deepEqual(await dates(IDS.singleTask), ['rollup', '2026-10-18', '2026-10-25'], 'undoing a child edit recomputes its parent');

    // Direct date edits through all normal gateways cannot bypass auto mode.
    for (const input of [
        { action: 'patch', taskID: IDS.singleTask, patch: { startDate: '' } },
        { action: 'attrs', taskID: IDS.singleTask, attrs: { 'custom-start-date': '' } },
        { action: 'blockOperation', operation: { action: 'setAttrs', id: IDS.singleTask, attrs: { 'custom-completion-time': '' } } },
    ]) {
        const result = await h.call('taskHorizonMutateTask', input);
        assert.equal(result.data.outcome, 'rejected');
        assert.equal(result.data.error.code, 'INVALID_ARGUMENT');
    }
    await patch(IDS.singleTask, { title: 'Rename parent' });
    assert.deepEqual(await dates(IDS.singleTask), ['rollup', '2026-10-18', '2026-10-25'], 'unrelated edits keep calculated dates');

    // A manual intermediate parent is a boundary; enabling it aggregates bottom-up.
    const grandList = '20261019000002-glist', grandChild = '20261019000003-grand';
    add(grandList, IDS.childTask, 'l'); add(grandChild, grandList);
    await patch(grandChild, { startDate: '2026-10-10', completionTime: '2026-10-30' });
    assert.deepEqual(await dates(IDS.singleTask), ['rollup', '2026-10-18', '2026-10-25']);
    await patch(IDS.childTask, { dateMode: 'rollup' });
    assert.deepEqual(await dates(IDS.singleTask), ['rollup', '2026-10-10', '2026-10-30']);
    await patch(grandChild, { completionTime: '2026-10-21' });
    assert.deepEqual(await dates(IDS.childTask), ['rollup', '2026-10-10', '2026-10-21']);
    assert.deepEqual(await dates(IDS.singleTask), ['rollup', '2026-10-10', '2026-10-25']);
    await patch(IDS.childTask, { dateMode: 'manual' });
    assert.deepEqual(await dates(IDS.childTask), ['manual', '2026-10-10', '2026-10-21'], 'returning to manual retains effective dates');
    await patch(IDS.childTask, { startDate: '', completionTime: '' });
    assert.deepEqual(await dates(IDS.childTask), ['manual', '', ''], 'clearing does not silently enable rollup');
    await patch(sibling, { startDate: '', completionTime: '' });
    assert.deepEqual(await dates(IDS.singleTask), ['rollup', '', ''], 'empty fields aggregate independently');

    // Missing dates on any child must never block either independent endpoint.
    await patch(IDS.childTask, { startDate: '2026-10-19' });
    assert.deepEqual(await dates(IDS.singleTask), ['rollup', '2026-10-19', ''], 'start-only child updates the parent immediately');
    await patch(IDS.childTask, { startDate: '' });
    await patch(sibling, { completionTime: '2026-10-28' });
    assert.deepEqual(await dates(IDS.singleTask), ['rollup', '', '2026-10-28'], 'due-only child updates while another child has no dates');
    await patch(IDS.childTask, { startDate: '2026-10-17' });
    assert.deepEqual(await dates(IDS.singleTask), ['rollup', '2026-10-17', '2026-10-28'], 'separate children supply separate endpoints');
    await patch(IDS.childTask, { startDate: '' });
    await patch(sibling, { completionTime: '' });
    await patch(IDS.singleTask, { dateMode: 'manual' });
    await patch(IDS.childTask, { startDate: '2026-10-19' });
    await patch(IDS.singleTask, { dateMode: 'rollup' });
    assert.deepEqual(await dates(IDS.singleTask), ['rollup', '2026-10-19', ''], 'enabling rollup also supports only a start date');
    await patch(IDS.singleTask, { dateMode: 'manual' });
    await patch(IDS.childTask, { startDate: '' });
    await patch(sibling, { completionTime: '2026-10-28' });
    await patch(IDS.singleTask, { dateMode: 'rollup' });
    assert.deepEqual(await dates(IDS.singleTask), ['rollup', '', '2026-10-28'], 'enabling rollup also supports only a due date');
    await patch(sibling, { completionTime: '' });

    // Independent endpoints remain exact even when different children have only one date.
    await patch(IDS.childTask, { startDate: '2026-11-01' });
    await patch(sibling, { completionTime: '2026-10-01' });
    assert.deepEqual(await dates(IDS.singleTask), ['rollup', '2026-11-01', '2026-10-01']);

    // Complete document reads reconcile native/remote edits, regardless of any UI filter.
    h.attrs.set(sibling, { ...h.attrs.get(sibling), 'custom-completion-time': '2026-11-07' });
    await command({ action: 'reconcileDates', documentIDs: [IDS.doc] });
    assert.deepEqual(await dates(IDS.singleTask), ['rollup', '2026-11-01', '2026-11-07']);
    const noop = await command({ action: 'reconcileDates', documentIDs: [IDS.doc] });
    assert.deepEqual(plain(noop.dateRollupUpdates), [], 'unchanged reconciliation emits no writes');

    // A queued inheritance patch is checked against the parent's current mode.
    await patch(sibling, { completionTime: '2026-12-31', priority: 'high' }, { options: { inheritedDateFields: ['completionTime'] } });
    assert.equal((await get(sibling)).completionTime, '2026-11-07');
    assert.equal((await get(sibling)).priority, 'high');
    await patch(sibling, { completionTime: '2026-11-08' });
    assert.equal((await get(sibling)).completionTime, '2026-11-08', 'explicit child dates remain writable');

    // Old/new parents both refresh after moves; deletion can empty an auto parent.
    await patch(IDS.firstTask, { dateMode: 'rollup' });
    add('20261019000004-newlist', IDS.firstTask, 'l');
    const move = { action: 'move', taskID: sibling, mode: 'child', targetTaskID: IDS.firstTask, requestedListID: '20261019000004-newlist' };
    const moved = await command(move);
    assert.deepEqual(await dates(IDS.firstTask), ['rollup', '', '2026-11-08']);
    assert.deepEqual(await dates(IDS.singleTask), ['rollup', '2026-11-01', '']);
    const moveUndo = await h.call('taskHorizonUndoLastMutation', { undoID: moved.value.undoID });
    assert.equal(moveUndo.ok, true, JSON.stringify(moveUndo));
    assert.deepEqual(await dates(IDS.firstTask), ['rollup', '', '']);
    assert.deepEqual(await dates(IDS.singleTask), ['rollup', '2026-11-01', '2026-11-08'], 'move undo refreshes both parents');
    await command(move);
    await command({ action: 'delete', taskID: sibling });
    assert.deepEqual(await dates(IDS.firstTask), ['rollup', '', '']);
    await command({ action: 'delete', taskID: IDS.childTask });
    assert.deepEqual(await dates(IDS.singleTask), ['rollup', '', ''], 'last-child removal retains mode with empty dates');

    // Legacy date aliases cannot revive a cleared endpoint, even with renamed fields.
    const settings = JSON.parse(h.storage.get('task-settings.json'));
    settings.taskMetaAttrKeys = { startDate: 'custom-plan-start' };
    settings.taskMetaAttrKeyAliases = { startDate: ['custom-old-start'] };
    h.storage.set('task-settings.json', JSON.stringify(settings));
    h.attrs.set(IDS.firstTask, { ...h.attrs.get(IDS.firstTask), 'custom-old-start': '2020-01-01' });
    await command({ action: 'reconcileDates', documentIDs: [IDS.doc] });
    assert.deepEqual(await dates(IDS.firstTask), ['rollup', '', '']);
    assert.equal(h.attrs.get(IDS.firstTask)['custom-old-start'], '');

    // Recurring/check-in children are excluded; the feature cannot be enabled on them.
    await command({ action: 'move', taskID: IDS.secondTask, mode: 'child', targetTaskID: IDS.firstTask, requestedListID: '20261019000004-newlist' });
    await patch(IDS.secondTask, { startDate: '2026-01-01', completionTime: '2026-12-31', repeatRule: { enabled: true, type: 'daily', trigger: 'due', every: 1, anchorDate: '2026-01-01' } });
    assert.deepEqual(await dates(IDS.firstTask), ['rollup', '', '']);
    const recurringMode = await h.call('taskHorizonMutateTask', { action: 'patch', taskID: IDS.secondTask, patch: { dateMode: 'rollup' } });
    assert.equal(recurringMode.data.outcome, 'rejected');

    // Date inheritance shares one builder; other inherited fields are unaffected.
    const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const stores = read('src/task-horizon/main/10-stores-rules-and-cache.js');
    const start = stores.indexOf('    function __tmNormalizeSubtaskInheritedFields(');
    const end = stores.indexOf('    const __TM_CALENDAR_INITIAL_VIEW_VALUES', start);
    const context = vm.createContext({ SettingsStore: { data: { subtaskInheritedFields: ['startDate', 'completionTime', 'duration'] } },
        __TM_SUBTASK_INHERIT_DEFAULT_FIELDS: [], __TM_SUBTASK_INHERIT_FIELD_OPTIONS: ['startDate', 'completionTime', 'duration'].map(key => ({ key })),
        __tmParseCustomFieldColumnKey: () => '', __tmFindStatusOptionById: () => null });
    vm.runInContext(read('src/task-horizon/main/09-task-field-schema.js') + '\n' + stores.slice(start, end), context);
    const parent = { dateMode: 'rollup', startDate: '2026-10-01', completionTime: '2026-10-30', duration: '30' };
    assert.deepEqual(plain(context.__tmBuildSubtaskInheritedPatch(parent)), { duration: '30' });
    parent.dateMode = 'manual';
    assert.deepEqual(plain(context.__tmBuildSubtaskInheritedPatch(parent)), { startDate: '2026-10-01', completionTime: '2026-10-30', duration: '30' });

    // Exercise the real TaskStore's confirmed base too: repainting the local
    // mirrors alone loses derived dates on the next projected read or edit.
    const projection = vm.createContext({ console, window: {}, state: { flatTasks: {}, pendingInsertedTasks: {},
        pendingDeletedTasks: {}, doneOverrides: {}, taskTree: [], filteredTasks: [], otherBlocks: [], viewMode: 'list' },
        SettingsStore: { data: {} }, MetaStore: { set() {}, remapId() {} }, setTimeout, clearTimeout, queueMicrotask });
    vm.runInContext(read('src/task-horizon/main/09-task-field-schema.js')
        + '\n' + read('src/task-horizon/main/32-runtime-state-and-events.js'), projection);
    const store = projection.__tmTaskStore;
    store.replaceFlat({ parent: { id: 'parent', root_id: IDS.doc, dateMode: 'rollup', startDate: '', completionTime: '',
        start_date: '', completion_time: '', children: [] } }, { authoritative: true });
    projection.__tmApplyAttrPatchLocally = (id, value) => store.mutateLocal(id, task => { Object.assign(task, value); return true; }, { includeLists: true });
    projection.__tmDispatchTaskAttrPatchUpdated = () => {};
    vm.runInContext(read('src/task-horizon/main/task-runtime/50b-parent-date-rollup-runtime.js'), projection);
    for (const value of [
        { startDate: '2026-10-19', completionTime: '' },
        { startDate: '', completionTime: '2026-10-28' },
        { startDate: '2026-10-17', completionTime: '2026-10-28' },
        { startDate: '', completionTime: '' },
    ]) {
        const update = { ...value, dateMode: 'rollup' };
        projection.__tmApplyDateRollupReceipt({ dateRollupUpdates: [{ taskID: 'parent', documentID: IDS.doc, patch: update }] });
        assert.equal(store.getProjected('parent').startDate, value.startDate, 'start-only rollup must reach projected task reads');
        assert.equal(store.getConfirmed('parent').completionTime, value.completionTime, 'due-only rollup must reach the confirmed task base');
        assert.equal(store.getProjected('parent').start_date, value.startDate, 'start aliases update and clear with rollup');
        assert.equal(store.getProjected('parent').completion_time, value.completionTime, 'due aliases update and clear with rollup');
        store.applyMutation({ type: 'taskPatch', phase: 'commit', taskId: 'parent', patch: { priority: 'high' } });
        assert.equal(store.getProjected('parent').startDate, value.startDate, 'unrelated commits cannot restore the previous start');
        assert.equal(store.getProjected('parent').completionTime, value.completionTime, 'unrelated commits cannot restore the previous due date');
    }
    // Exercise the real websocket handler. Kernel setAttrs operations carry
    // JSON strings and may arrive before or after the command receipt.
    const functionSource = (source, name) => {
        const begin = source.indexOf(`    function ${name}(`);
        const end = source.indexOf('\n    }', begin);
        assert.ok(begin >= 0 && end > begin, name);
        return source.slice(begin, end + 6);
    };
    projection.state.viewMode = 'timeline';
    projection.__TM_TASK_REPEAT_RULE_ATTR = 'custom-task-repeat-rule';
    projection.__TM_TASK_REPEAT_STATE_ATTR = 'custom-task-repeat-state';
    projection.__TM_TASK_REPEAT_HISTORY_ATTR = 'custom-task-repeat-history';
    projection.__TM_TASK_ATTACHMENT_META_ATTR = 'custom-task-attachments';
    projection.__tmResolveTaskMetaFieldByAttrKey = key => ({ 'custom-start-date': 'startDate',
        'custom-completion-time': 'completionTime', 'custom-task-date-mode': 'dateMode' })[key] || '';
    projection.__tmIsTaskAttachmentAttrKey = () => false;
    projection.__tmGetCustomFieldDefByAttrStorageKey = () => null;
    const childID = '20261020100000-child';
    const parentID = '20261020100001-parent';
    store.upsertLocal({ ...store.getProjected('parent'), id: parentID });
    store.upsertLocal({ id: childID, root_id: IDS.doc, parentTaskId: parentID });
    let onTransaction;
    const reloads = [];
    const reconciles = [];
    Object.assign(projection, {
        __tmHost: { getEventBuses: () => [{ on: (_name, handler) => { onTransaction = handler; } }] },
        __tmShouldIgnoreWsMainTaskRefreshMessage: () => false,
        __tmSummarizeWsMainTaskTx: msg => ({ docIds: new Set([IDS.doc]),
            blockIds: new Set(msg.detail.data.flatMap(tx => tx.doOperations.map(op => op.id))) }),
        __tmInvalidateTasksQueryCacheByDocId() {}, __tmGetLoadedTaskScopeDocIds: () => new Set([IDS.doc]),
        __tmIsPluginVisibleNow: () => true,
        __tmShouldSuppressLocalTimeTx: () => false, __tmShouldSuppressLocalDoneTx: () => false,
        __tmMutationEngine: { isTaskSuppressed: () => false },
        __tmApplyQuickbarAttrUpdateInState: (id, attr, value) => {
            const task = store.getProjected(id), field = projection.__tmResolveTaskMetaFieldByAttrKey(attr);
            if (!task) return { ok: false, reason: 'task-missing' };
            if (task[field] === value) return { ok: false, reason: 'noop' };
            store.applyMutation({ type: 'taskPatch', phase: 'local', taskId: id, patch: { [field]: value } });
            return { ok: true };
        },
        __tmMergeTaskMutationPatches: (a, b) => ({ ...a, ...b }),
        __tmChangeFeed: { buildPatchFromAttr: (_id, key, value) => ({ [projection.__tmResolveTaskMetaFieldByAttrKey(key)]: value }) },
        __tmResolveLocalTaskBindingFromAnyBlockId: () => null, __tmResolveTaskIdFromAnyBlockId: async id => id,
        __tmShouldSkipCalendarTxRefreshForAppliedAttrPatch: () => true,
        __tmScheduleDateRollupReconcile: docs => reconciles.push([...docs]),
        __tmSchedulePersistTaskSnapshot() {}, __TM_TASK_INDEX_QUERY_LIMIT: 10000, __TM_TASK_TX_BLOCK_ID_LIMIT: 100,
        __tmAddBoundedTaskTxIds: (ids, values) => { values.forEach(id => ids.add(id)); return true; },
        __tmScheduleBatchedTaskIncrementalRefreshFromTx: (_msg, options) => reloads.push(options),
    });
    vm.runInContext('let __tmSqlCacheInvalidationBound = false, __tmSqlCacheInvalidationHandler, __tmSqlCacheEventBuses, __tmSqlCacheEventBusHandler;\n'
        + ['__tmIsLikelyBlockId', '__tmShouldSyncAttrKeyFromTx', '__tmExtractAttrUpdatesFromTx',
            '__tmHasOnlyAttrOperationsInTx', '__tmIsFastAttrOnlyRefreshEligible', '__tmApplyTxAttrUpdatesInState',
            '__tmBindSqlCacheInvalidation'].map(name => functionSource(stores, name)).join('\n'), projection);
    projection.__tmBindSqlCacheInvalidation();
    const echo = (id, value = '2026-10-30', action = 'setAttrs') => ({ detail: { cmd: 'transactions',
        data: [{ doOperations: [{ id, action, data: JSON.stringify({ 'custom-completion-time': value }) }] }] } });
    onTransaction(echo(childID));
    onTransaction(echo(parentID));
    assert.equal(store.getProjected(parentID).completionTime, '2026-10-30', 'an early ancestor notification updates dates locally');
    projection.__tmApplyDateRollupReceipt({ dateRollupUpdates: [{ taskID: parentID, documentID: IDS.doc,
        patch: { dateMode: 'rollup', startDate: '', completionTime: '2026-10-30' } }] });
    onTransaction(echo(parentID));
    onTransaction(echo(parentID, ''));
    assert.equal(store.getProjected(parentID).completionTime, '', 'a later edit on the same parent must not be suppressed');
    assert.equal(reloads.length, 0, 'child, ancestor and repeated echoes must never reload the timeline');
    assert.deepEqual(reconciles, [[IDS.doc], [IDS.doc], [IDS.doc]], 'native date edits still reconcile parent dates in their document');
    onTransaction(echo('20261020100002-remote'));
    onTransaction(echo(parentID, '', 'update'));
    assert.equal(reloads.length, 2, 'unknown tasks and content transactions must retain their normal refresh');
    console.log('parent task date rollup: modes, shrink/clear, undo, multilevel, native refresh, inheritance, move/delete passed');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
