'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, 'src/task-horizon/main', file), 'utf8');
const runtime = read('task-runtime/53b-task-create-and-quick-add-runtime.js');
const helper = read('task-runtime/51-whiteboard-and-link-runtime.js');
const services = read('20-api-and-runtime-services.js');
const dialogs = read('30-dialogs-and-ui-foundation.js');
function section(source, start, end) {
    const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
    assert.ok(a >= 0 && b > a, `Missing section: ${start}`);
    return source.slice(a, b);
}
const draftSource = section(helper, '    const __TM_QUICK_ADD_DRAFT_STORAGE_KEY', '    function __tmCaptureTaskDetailSubtaskDraftSnapshot');
const source = draftSource
    + section(dialogs, '    function __tmNormalizeTaskInputLine', '    function showConfirm')
    + section(services, '    function __tmBuildCreateTaskInDocAttrPatchFromPayload', '    function __tmMutationTempTaskExistsForOptimisticApply')
    + section(runtime, '    function __tmQueueCreateSubtask', '    function __tmApplyOptimisticSubtask')
    + section(runtime, '    function __tmQueueCreateSiblingTask', '    window.tmCreateSubtask =')
    + section(runtime, '    window.tmCreateSubtask =', '    let __tmQuickbarScheduledRefreshTimer')
    + section(runtime, '    window.tmQuickAddSubmit =', '    window.tmAdd =');
const plain = value => JSON.parse(JSON.stringify(value));

async function runCase(relation, { fail = false, partial = false, newDraft = false, reminder = false } = {}) {
    const scope = `${relation}:source`;
    const storage = new Map();
    const ops = [], notices = [], reminders = [];
    let sequence = 0;
    const parent = { id: 'parent', docId: 'related-doc' };
    const task = { id: 'source', docId: 'related-doc', parentTaskId: 'parent', children: [] };
    const inputs = {
        tmQuickAddInput: { value: reminder ? '首个任务' : '首个任务\n第二个任务\n第三个任务' },
        tmQuickAddRemark: { value: '第一行备注\n第二行备注' },
    };
    const context = vm.createContext({
        window: {}, HTMLInputElement: class {},
        localStorage: {
            getItem: key => storage.get(key) || null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: key => storage.delete(key),
        },
        document: { getElementById: id => inputs[id] || null },
        state: { quickAdd: {
            relation, sourceTaskId: 'source', draftScope: scope,
            docId: 'related-doc', docMode: 'doc',
            priority: 'high', customStatus: 'doing', startDate: '2026-09-27', completionTime: '2026-09-30',
            customFieldValues: { tag: ['a'] }, repeatRule: { enabled: true, type: 'daily' },
            repeatState: {}, reminderDraft: reminder ? { repeatMode: 'standalone' } : null,
        } },
        SettingsStore: { data: {
            customStatusOptions: [{ id: 'doing' }], pinNewTasksByDefault: true, enableTomatoIntegration: true,
        } },
        hint: (text, kind) => notices.push({ text, kind }),
        __tmResolveOptimisticTaskForLocalUse: id => ({ id, task: id === 'parent' ? parent : task }),
        __tmEnsureEditableTaskLike: () => true,
        __tmNewTaskBlockId: () => `new-${++sequence}`,
        __tmGenerateTempTaskId: () => `client-${sequence}`,
        __tmBuildSubtaskInheritedPatch: () => ({ priority: 'low', duration: '25', completionTime: '2026-10-10' }),
        __tmNormalizeDateOnly: value => value,
        __tmNormalizeQuickAddCustomFieldValues: value => value,
        __tmNormalizeCreateTaskCustomFieldValues: value => value || {},
        __tmGetStatusOptions: value => value,
        __tmBuildTaskRepeatRuleMetaPatch: (task, repeatRule) => ({ repeatRule, repeatState: {} }),
        __tmBuildAttrPayloadFromPatch: patch => Object.fromEntries(Object.entries(patch).map(([key, value]) => [`custom-${key}`, value])),
        __tmResolveDefaultNewTaskInsertOptions: () => { throw new Error('Related tasks must not use the default document position'); },
        __tmWaitForQuickAddRealTaskId: async id => id,
        __tomatoReminder: { capabilities: { upsertDraft: true }, upsertDraft: async (id, draft) => { reminders.push({ id, draft }); return { ok: true }; } },
    });
    context.__tmEnqueueQueuedOp = async op => {
        ops.push(plain(op));
        if (newDraft) context.__tmSaveQuickAddDraft('下一条草稿', { scope, remark: '新的备注' });
        if (fail || (partial && op.data.content === '第二个任务')) throw new Error('模拟写入失败');
        return { realId: op.data.requestedTaskId };
    };
    context.__tmRequireTaskMutation = name => {
        assert.equal(name, relation === 'subtask' ? 'createSubtask' : 'createSibling');
        return name === 'createSubtask' ? context.__tmQueueCreateSubtask : context.__tmQueueCreateSiblingTask;
    };
    context.window.tmQuickAddClose = () => { context.state.quickAdd = null; };
    vm.runInContext(source, context);
    context.__tmSaveQuickAddDraft('顶栏草稿', { remark: '顶栏备注' });
    context.__tmSaveQuickAddDraft('其他任务草稿', { scope: `${relation}:other` });
    let openOptions;
    context.window.tmQuickAddOpen = async options => { openOptions = options; };
    await (relation === 'subtask' ? context.window.tmCreateSubtask : context.window.tmCreateSiblingTask)('source');
    assert.deepEqual(plain(openOptions), { relation, sourceTaskId: 'source', docId: 'related-doc' });
    await context.window.tmQuickAddSubmit();
    const expected = reminder ? ['首个任务'] : ['首个任务', '第二个任务', '第三个任务'];
    assert.deepEqual(ops.map(op => op.data.content), relation === 'sibling' ? expected.slice().reverse() : expected);
    assert.ok(ops.every(op => op.docId === 'related-doc' && op.laneKey === 'doc:related-doc'));
    for (const op of ops) {
        assert.equal(op.data[relation === 'subtask' ? 'parentTaskId' : 'sourceTaskId'], 'source');
        const patch = relation === 'subtask' ? op.data.inheritedPatch : op.data.initialPatch;
        assert.equal(patch.priority, 'high');
        assert.equal(patch.customStatus, 'doing');
        assert.equal(patch.startDate, '2026-09-27');
        assert.equal(patch.completionTime, '2026-09-30');
        assert.equal(patch.pinned, true);
        assert.equal(patch.repeatRule.type, 'daily');
        assert.deepEqual(patch.customFieldValues, { tag: ['a'] });
        assert.equal(patch.remark, op.data.content === '首个任务' ? inputs.tmQuickAddRemark.value : '');
        if (relation === 'subtask') assert.equal(patch.duration, '25', 'non-composer inherited fields survive');
        const attrs = context.__tmBuildAtomicCreateAttrs(op.data.requestedTaskId, patch);
        assert.equal(attrs['custom-remark'], patch.remark);
        assert.equal(attrs['custom-completionTime'], '2026-09-30');
    }
    const draft = context.__tmGetQuickAddDraft(scope);
    assert.equal(context.__tmGetQuickAddDraft().value, '顶栏草稿');
    assert.equal(context.__tmGetQuickAddDraft(`${relation}:other`).value, '其他任务草稿');
    if (newDraft) assert.equal(draft.value, '下一条草稿', 'settled submission preserves newer scoped drafts');
    else if (fail || partial) assert.equal(draft.value, inputs.tmQuickAddInput.value, 'failed submission preserves its draft');
    else assert.equal(draft, null, 'success clears only the submitted draft');
    assert.equal(notices.at(-1).kind, fail ? 'error' : partial ? 'warning' : 'success');
    if (reminder) {
        assert.equal(reminders.length, 1);
        assert.equal(reminders[0].id, ops[0].data.requestedTaskId);
    }
    const restarted = vm.createContext({ localStorage: context.localStorage });
    vm.runInContext(draftSource, restarted);
    assert.equal(restarted.__tmGetQuickAddDraft().value, '顶栏草稿');
    assert.equal(restarted.__tmGetQuickAddDraft(`${relation}:other`).value, '其他任务草稿');

    // Execute the production queue and kernel adapters, capturing the actual insert boundary.
    const inserts = [];
    context.API = {
        getBlocksByIds: async () => [task],
        getChildBlocks: async () => [],
        getChildListIdOfTask: async () => '',
        generateTaskDOM: (id, content, done, options = {}) => ({ id, content, done, ...options }),
    };
    context.__tmIsMutationTaskPendingDeleted = () => false;
    context.__tmIsTaskListItemBlockId = async () => false;
    context.__tmNormalizeSubtaskInheritedPatch = patch => patch;
    context.__tmResolveTaskListBlockId = async () => 'source-list';
    context.__tmResolveQueuedCreateTaskSnapshot = () => null;
    context.__tmBackendAdapter = {
        createSubtask: async (parentId, id, listId, listData, itemData) => {
            inserts.push({ parentId, id, listId, listData, itemData });
            return { listID: listId };
        },
    };
    context.__tmInsertBlockOnce = async (listId, data, placement) => {
        inserts.push({ listId, data, placement });
        return data.id;
    };
    vm.runInContext(
        section(services, '    async function __tmExecuteQueuedOp', '    function __tmGetQueuedTaskPatchForVerification')
        + section(runtime, '    async function __tmCreateSubtaskForTaskKernel', '    async function __tmResolveTaskListBlockId')
        + section(runtime, '    async function __tmCreateSiblingTaskForTaskKernel', '    async function __tmCreateTaskInDoc('),
        context,
    );
    for (const op of ops) {
        await context.__tmExecuteQueuedOp(op);
        const inserted = inserts.at(-1);
        const patch = relation === 'subtask' ? op.data.inheritedPatch : op.data.initialPatch;
        const attrs = (relation === 'subtask' ? inserted.itemData : inserted.data).attrs;
        assert.equal(attrs['custom-remark'], patch.remark, 'note is part of the atomic insert');
        assert.equal(attrs['custom-completionTime'], patch.completionTime, 'date is part of the atomic insert');
        assert.equal(attrs['custom-repeatRule'].type, 'daily', 'repeat rule reaches storage');
        assert.deepEqual(plain(attrs['custom-customFieldValues']), { tag: ['a'] });
        if (relation === 'subtask') {
            assert.equal(inserted.parentId, 'source');
            assert.deepEqual(plain(inserted.listData.attrs), plain(attrs));
        } else {
            assert.equal(inserted.listId, 'source-list');
            assert.equal(inserted.placement.previousID, 'source');
        }
    }
}

(async () => {
    for (const relation of ['subtask', 'sibling']) {
        await runCase(relation);
        await runCase(relation, { fail: true });
        await runCase(relation, { partial: true });
        await runCase(relation, { newDraft: true });
        await runCase(relation, { reminder: true });
    }
    console.log('related task composer behavior tests passed (10 cases)');
})().catch(error => { console.error(error); process.exitCode = 1; });
