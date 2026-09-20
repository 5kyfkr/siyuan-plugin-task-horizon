'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'src/task-horizon/main', name), 'utf8').replace(/\r\n/g, '\n');
const runtime = read('task-runtime/53b-task-create-and-quick-add-runtime.js');
const helper = read('task-runtime/51-whiteboard-and-link-runtime.js');
const services = read('20-api-and-runtime-services.js');
const dialogs = read('30-dialogs-and-ui-foundation.js');
function section(source, start, end) {
    const a = source.indexOf(start);
    const b = source.indexOf(end, a + start.length);
    assert.ok(a >= 0 && b > a, `Missing section ${start}`);
    return source.slice(a, b);
}
const draftSource = section(helper, '    const __TM_QUICK_ADD_DRAFT_STORAGE_KEY', '    function __tmCaptureTaskDetailSubtaskDraftSnapshot');
const parseSource = section(dialogs, '    function __tmNormalizeTaskInputLine', '    function showConfirm');
const attrSource = section(services, '    function __tmBuildCreateTaskInDocAttrPatchFromPayload', '    function __tmMutationTempTaskExistsForOptimisticApply');
const submitSource = section(runtime, '    window.tmQuickAddSubmit =', '    window.tmAdd =');
const optimisticSource = section(runtime, '    function __tmApplyOptimisticDocTask', '    function __tmRemoveTaskFromLocalState');
const storage = new Map();
function draftContext() {
    const context = vm.createContext({
        localStorage: {
            getItem: key => storage.get(key) || null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: key => storage.delete(key),
        },
    });
    vm.runInContext(draftSource, context);
    return context;
}

const draft = draftContext();
draft.__tmSaveQuickAddDraft('', { remark: '先记下背景\n保留第二行' });
assert.equal(draft.__tmGetQuickAddDraft().remark, '先记下背景\n保留第二行', 'remark-only draft survives');
const restarted = draftContext();
assert.equal(restarted.__tmGetQuickAddDraft().remark, '先记下背景\n保留第二行', 'remark survives a fresh runtime');
restarted.__tmSaveQuickAddDraft('旧任务', { remark: '旧备注' });
const submitted = restarted.__tmGetQuickAddDraft();
restarted.__tmSaveQuickAddDraft('下一条任务', { remark: '新的备注' });
assert.equal(restarted.__tmClearQuickAddDraft(submitted), false, 'settled creation must not erase a newer draft');
assert.equal(restarted.__tmGetQuickAddDraft().remark, '新的备注');
assert.equal(restarted.__tmClearQuickAddDraft(restarted.__tmGetQuickAddDraft()), true);
storage.set('tm_quick_add_draft_v1', JSON.stringify({ value: '旧版标题', updatedAt: Date.now() }));
assert.equal(draftContext().__tmGetQuickAddDraft().value, '旧版标题', 'existing title-only drafts stay readable');
const cleared = draftContext();
cleared.__tmSaveQuickAddDraft('', { remark: '' });
assert.equal(cleared.__tmGetQuickAddDraft(), null);

const common = {
    SettingsStore: { data: { customStatusOptions: [], pinNewTasksByDefault: false } },
    __tmGetStatusOptions: value => value,
    __tmFindStatusOptionById: () => null,
    __tmNormalizeCreateTaskCustomFieldValues: value => value || {},
    __tmBuildAttrPayloadFromPatch: patch => Object.fromEntries(Object.entries(patch).map(([key, value]) => [`custom-${key}`, value])),
};
const attrs = vm.createContext(common);
vm.runInContext(attrSource, attrs);
const note = '会议结论\n- 保留 Markdown\n<不是 HTML>';
const patch = attrs.__tmBuildCreateTaskInDocAttrPatchFromPayload({ remark: note });
assert.equal(patch.remark, note);
assert.equal(attrs.__tmBuildAtomicCreateAttrs('task-a', patch)['custom-remark'], note, 'creation carries the full note into atomic attributes');
assert.equal(Object.hasOwn(attrs.__tmBuildCreateTaskInDocAttrPatchFromPayload({}), 'remark'), false, 'other create callers remain unchanged');

let projected;
const optimistic = vm.createContext({
    ...common, state: { allDocuments: [{ id: 'doc-a', name: '收集箱' }] },
    __tmNormalizeTaskRepeatRule: () => ({}), __tmNormalizeTaskRepeatState: () => ({}),
    __tmNormalizeHeadingText: value => value, __tmIsTaskMarkerDone: () => false,
    __TM_PENDING_INSERTED_TASK_KEEPALIVE_MS: 1000,
    __tmIsDocInCurrentTaskScope: () => false,
    __tmTaskStore: { createPendingTask: task => { projected = task; return true; } },
});
vm.runInContext(optimisticSource, optimistic);
optimistic.__tmApplyOptimisticDocTask({ docId: 'doc-a', tempId: 'task-a', content: '任务', remark: note });
assert.equal(projected.remark, note, 'new task immediately exposes its note before reloading');

async function submitCase({ fail = false, newDraft = false, reverse = false, duplicate = false } = {}) {
    storage.clear();
    const context = draftContext();
    const inputs = {
        tmQuickAddInput: { value: duplicate ? '相同任务\n相同任务' : '- [ ] 整理会议记录\n\n2. 确认排期\n发送周报' },
        tmQuickAddRemark: { value: note },
    };
    const calls = [];
    Object.assign(context, {
        ...common, window: {},
        state: { quickAdd: { docId: 'doc-a', docMode: 'doc', priority: 'high', customStatus: '', customFieldValues: {} } },
        document: { getElementById: id => inputs[id] || null },
        HTMLInputElement: class {},
        __tmNormalizeDateOnly: value => value,
        __tmNormalizeQuickAddCustomFieldValues: value => value,
        __tmResolveDefaultNewTaskInsertOptions: async () => reverse ? { insertAfterId: 'heading-a' } : {},
        hint: () => {}, setTimeout,
        __tmRequireTaskMutation: () => async payload => {
            calls.push(payload);
            if (newDraft) context.__tmSaveQuickAddDraft('下一条', { remark: '新的草稿备注' });
            if (fail) throw new Error('写入失败');
            return `task-${calls.length}`;
        },
    });
    context.window.tmQuickAddClose = () => { context.state.quickAdd = null; };
    vm.runInContext(parseSource + submitSource, context);
    await context.window.tmQuickAddSubmit();
    const expected = duplicate ? ['相同任务', '相同任务'] : ['整理会议记录', '确认排期', '发送周报'];
    assert.deepEqual(calls.map(item => item.content), reverse ? expected.slice().reverse() : expected);
    assert.ok(calls.every((item, index) => item.remark === (index === (reverse ? calls.length - 1 : 0) ? note : '') && item.priority === 'high'), 'only the first input task receives the note, even when insertion order is reversed or titles repeat');
    const remaining = context.__tmGetQuickAddDraft();
    if (newDraft) assert.equal(remaining.remark, '新的草稿备注');
    else if (fail) assert.equal(remaining.remark, note, 'write failure preserves the title and note');
    else assert.equal(remaining, null, 'successful submission clears its own draft');
}

(async () => {
    await submitCase();
    await submitCase({ fail: true });
    await submitCase({ newDraft: true });
    await submitCase({ reverse: true });
    await submitCase({ duplicate: true });
    await submitCase({ reverse: true, duplicate: true });
    console.log('quick add remark behavior tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
