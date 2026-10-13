'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, 'src/task-horizon/main', file), 'utf8');
const runtime = read('task-runtime/53b-task-create-and-quick-add-runtime.js');
function section(source, start, end) {
    const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
    assert.ok(a >= 0 && b > a, `Missing production section: ${start}`);
    return source.slice(a, b);
}
const production = [
    section(read('30-dialogs-and-ui-foundation.js'), '    function __tmNormalizeTaskInputLine(', '    function showConfirm('),
    section(runtime, '    function __tmBuildHeadingPatchFromPlacement(', '    function __tmRestoreTaskSubtreeIntoFlatMap('),
    section(runtime, '    window.tmCreateTaskForHeadingGroup =', '    async function __tmAppendBlockOnce('),
    section(runtime, '    window.tmQuickAddOpenForDoc =', '    window.tmQuickAddOpenForPreset ='),
    section(runtime, '    window.tmQuickAddSelectDoc =', '    function __tmGetDailyNoteTargetHeadingText('),
    section(runtime, '    async function __tmResolveDefaultNewTaskInsertOptions(', '    const __tmWaitForQuickAddRealTaskId ='),
    section(runtime, '    window.tmQuickAddSubmit =', '    window.tmAdd ='),
].join('\n');

async function runCase({ sectionEnd = false, next = 'heading-next', headingId = 'heading-a', count = 3, missing = false, delay = false, fail = false } = {}) {
    const writes = [], patches = [], notices = [];
    const inputs = {
        tmQuickAddInput: { value: ['第一条', '第二条', '第三条'].slice(0, count).join('\n') },
        tmQuickAddRemark: { value: '备注' },
    };
    let defaultReads = 0, releasePlacement, stopped = 0, prevented = 0;
    const context = vm.createContext({
        window: {}, state: {}, HTMLInputElement: class {},
        document: { getElementById: id => inputs[id] || null },
        SettingsStore: { data: { headingGroupCreateAtSectionEnd: sectionEnd, taskHeadingLevel: 'h3' } },
        API: { getFirstDirectChildIdOfDoc: async () => 'first-block' },
        __tmGetDocDefaultTaskHeadingConfig: () => { defaultReads++; return { headingId: 'default-heading', headingLevel: 'h2' }; },
        __tmNormalizeHeadingText: value => value,
        __tmNormalizeDateOnly: value => value,
        __tmNormalizeQuickAddCustomFieldValues: value => value,
        __tmSaveQuickAddDraft: () => {}, __tmGetQuickAddDraft: () => ({ value: inputs.tmQuickAddInput.value }),
        __tmClearQuickAddDraft: () => {},
        __tmRefreshQuickAddCustomFieldScope: async () => {},
        __tmRememberQuickAddLocation: () => {},
        __tmResolveQuickAddInitialLocation: async () => ({ mode: 'doc', docId: 'default-doc' }),
        __tmTaskStore: { patchLocal: (id, patch) => { patches.push({ id, patch }); return true; } },
        hint: (message, kind) => notices.push({ message, kind }),
        setTimeout: () => { throw new Error('Explicit headings must wait for placement instead of falling back on a timer'); },
        __tmRequireTaskMutation: name => {
            assert.equal(name, 'createTaskInDoc');
            return async payload => {
                writes.push(payload);
                if (fail && payload.content === '第二条') throw new Error('模拟写入失败');
                return `task-${writes.length}`;
            };
        },
        __tmResolveHeadingGroupInsertPlacement: async (docId, id, level) => {
            assert.equal(docId, 'doc-a');
            assert.equal(level, id === 'default-heading' ? 'h2' : 'h3');
            if (delay) await new Promise(resolve => { releasePlacement = resolve; });
            return { matched: !missing, checked: true, parentID: 'super-block', insertAfterID: id,
                nextID: next, appendToBottom: !next, heading: { id, content: '目标标题', rank: 2 } };
        },
    });
    context.window.tmQuickAddOpen = async options => {
        context.state.quickAdd = { ...options, docMode: 'doc', priority: 'high', customStatus: 'doing',
            customFieldValues: { category: 'work' }, completionTime: '2026-10-14' };
        return context.state.quickAdd;
    };
    context.window.tmQuickAddClose = () => { context.state.quickAdd = null; };
    vm.runInContext(production, context);
    await context.window.tmCreateTaskForHeadingGroup(' doc-a ', headingId, {
        stopPropagation: () => stopped++, preventDefault: () => prevented++,
    });
    assert.equal(stopped, 1); assert.equal(prevented, 1);
    assert.equal(context.state.quickAdd.docId, 'doc-a');
    assert.equal(context.state.quickAdd.headingId, headingId || '__none__');
    assert.equal(writes.length, 0, 'opening the composer creates no tasks');
    const submission = context.window.tmQuickAddSubmit();
    if (delay) {
        assert.equal(writes.length, 0, 'no task is written before heading placement resolves');
        releasePlacement();
    }
    assert.equal(await submission, missing ? false : fail ? undefined : true);
    assert.equal(defaultReads, 0, 'explicit groups override the document default heading');
    if (missing) {
        assert.equal(writes.length, 0, 'a removed target heading must not create tasks elsewhere');
        assert.match(notices.at(-1).message, /目标标题已不存在/);
        return;
    }
    const reverse = headingId && headingId !== '__none__' && !sectionEnd;
    const expected = inputs.tmQuickAddInput.value.split('\n');
    assert.deepEqual(writes.map(payload => payload.content), reverse ? expected.reverse() : expected);
    writes.forEach(payload => {
        assert.equal(payload.docId, 'doc-a');
        assert.equal(payload.priority, 'high'); assert.equal(payload.customStatus, 'doing');
        assert.equal(payload.completionTime, '2026-10-14'); assert.equal(payload.customFieldValues.category, 'work');
        assert.equal(payload.wait, true); assert.equal(payload.showErrorHint, false);
        assert.equal(payload.remark, payload.content === '第一条' ? '备注' : '');
        if (!headingId || headingId === '__none__') {
            assert.equal(payload.targetHeadingId, '');
            assert.equal(payload.insertBeforeId, count > 1 ? 'first-block' : '');
            assert.equal(payload.atTop, count === 1);
        } else {
            assert.equal(payload.targetHeadingId, headingId); assert.equal(payload.targetHeading, '目标标题');
            assert.equal(payload.insertParentId, 'super-block');
            assert.equal(payload.insertAfterId, sectionEnd ? '' : headingId);
            assert.equal(payload.insertBeforeId, sectionEnd ? next : '');
            assert.equal(payload.appendToBottom, sectionEnd && !next);
        }
    });
    assert.equal(patches.length, headingId && headingId !== '__none__' ? writes.length - Number(fail) : 0);
    assert.equal(notices.at(-1).kind, fail ? 'warning' : 'success');
    delay = false;
    const defaults = await context.__tmResolveDefaultNewTaskInsertOptions('doc-a');
    assert.equal(defaults.targetHeadingId, 'default-heading', 'ordinary document capture retains the configured heading');
    assert.equal(defaultReads, 1);
    for (const changeLocation of [() => context.window.tmQuickAddSelectDoc('doc-b'),
        () => context.window.tmQuickAddUseTodayDiary(), () => context.window.tmQuickAddUseDefaultDoc()]) {
        await context.window.tmCreateTaskForHeadingGroup('doc-a', 'heading-a');
        await changeLocation();
        assert.equal(context.state.quickAdd.headingId, '', 'changing location clears the original heading');
    }
}

(async () => {
    await runCase();
    await runCase({ sectionEnd: true });
    await runCase({ sectionEnd: true, next: '' });
    await runCase({ headingId: '__none__' });
    await runCase({ headingId: '', count: 1 });
    await runCase({ missing: true });
    await runCase({ delay: true });
    await runCase({ fail: true });
    console.log('heading group composer placement, batch fields, failure and location-change tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
