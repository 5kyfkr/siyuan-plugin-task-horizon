'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const main = path.join(__dirname, '../src/task-horizon/main');
const read = (file) => fs.readFileSync(path.join(main, file), 'utf8');
const stateSource = read('32-runtime-state-and-events.js');
const serviceSource = read('20-api-and-runtime-services.js');
const storeSource = read('10-stores-rules-and-cache.js');
const viewSource = read('task-runtime/51-whiteboard-and-link-runtime.js');
const detailSource = read('task-runtime/52-task-detail-runtime.js');
const renderSource = read('40-render-runtime.js');
const clone = (value) => JSON.parse(JSON.stringify(value));
const extract = (source, name) => {
    const start = source.search(new RegExp(`    (?:async )?function ${name}\\(`));
    const end = source.indexOf('\n    }', start);
    assert.ok(start >= 0 && end > start, `missing function: ${name}`);
    return source.slice(start, end + 6);
};
const parse = (value, fallback) => {
    if (value && typeof value === 'object') return value;
    try { return JSON.parse(value) || fallback; } catch (error) { return fallback; }
};

function createHarness(initial) {
    const task = { id: 'task-a', root_id: 'doc-a', children: [], ...clone(initial) };
    const mirrors = [task, clone(task), clone(task)];
    const context = vm.createContext({
        console, Map, Set, queueMicrotask() {},
        state: {
            flatTasks: { 'task-a': task }, taskTree: [{ id: 'doc-a', tasks: [mirrors[1]] }],
            filteredTasks: [mirrors[2]], otherBlocks: [],
        },
        SettingsStore: { data: { enableTomatoIntegration: true } }, MetaStore: { get: () => ({}), set() {} },
        __TM_TASK_REPEAT_RULE_ATTR: 'custom-repeat-rule', __TM_TASK_REPEAT_STATE_ATTR: 'custom-repeat-state',
        __TM_TASK_REPEAT_HISTORY_ATTR: 'custom-repeat-history',
        __tmGetDocDisplayNameMode: () => 'name', __tmGetDocDisplayName: (_doc, fallback) => fallback,
        __tmHasPendingVisibleDatePersistence: () => false, __tmHasPendingTaskFieldPersistence: () => false,
        __tmNormalizeTaskPriorityValue: (value) => String(value || ''),
        __tmParseTaskLooseBoolean: (value) => value === true || value === '1' || value === 1,
        __tmNormalizeTaskRepeatRule: (value) => parse(value, { enabled: false }),
        __tmNormalizeTaskRepeatState: (value) => parse(value, {}),
        __tmNormalizeTaskRepeatHistory: (value) => parse(value, []),
        __tmNormalizeTomatoCountValue: (value) => String(value || ''),
        __tmNormalizeRemarkMarkdown: (value) => String(value || ''),
        __tmNormalizeTaskCompleteAtValue: (value) => String(value || ''),
        __tmNormalizeTaskStatusMarker: (value) => value || '', __tmResolveTaskMarkdownMarker: () => '',
        __tmNormalizeTaskContentField() {}, __tmApplyTaskAttachmentPathsToTask() {},
        __tmGetTaskAttachmentPaths: () => [], __tmGetTaskAttachmentMetaMap: () => new Map(),
        __tmHasTaskAttachmentAttrSnapshot: () => true,
        __tmGetTaskCustomFieldRawValues: () => ({}), __tmNormalizeTaskCustomFieldValues: () => ({}),
        __tmResolveTaskMetaFieldByAttrKey: () => '', __tmParseCustomFieldColumnKey: () => '',
        __tmApplyDoneOverrideToTaskIfPresent() {},
    });
    vm.runInContext(read('09-task-field-schema.js'), context);
    vm.runInContext('const __TM_LOCAL_TASK_PATCH_WATERMARK_TTL_MS = 20000; const __TM_LOCAL_TASK_PATCH_WATERMARK_MAX = 256; let __tmLocalTaskPatchWatermarkRevision = 0;', context);
    for (const name of ['__tmNormalizeQueueTaskValue', '__tmApplyQueuedTaskFieldPatchToTask']) {
        vm.runInContext(extract(serviceSource, name), context);
    }
    for (const name of ['__tmNormalizeLocalPatchFieldKey', '__tmGetPatchFieldKeysForTaskPatch', '__tmPruneLocalTaskPatchWatermarks', '__tmMarkLocalTaskPatchWatermark', '__tmClearLocalTaskPatchWatermarkFields', '__tmGetLocalTaskPatchWatermark', '__tmGetLocalTaskPatchWatermarkValue', '__tmBuildLocalTaskPatchWatermarkPatch', '__tmMergeLocalTaskPatchIntoTask']) {
        vm.runInContext(extract(storeSource, name), context);
    }
    vm.runInContext(extract(renderSource, 'normalizeTaskFields'), context);
    vm.runInContext(stateSource, context);
    const store = context.__tmTaskStore;
    store.replaceFlat(context.state.flatTasks, { authoritative: true, mergeOtherBlocks: false });
    const mutate = (phase, patch, extra = {}) => store.applyMutation({
        type: 'taskPatch', taskId: task.id, opId: 'edit-field', phase, patch, ...extra,
    });
    const normalize = (value) => {
        const next = clone(value);
        context.normalizeTaskFields(next, 'Test');
        return next;
    };
    return { context, store, mirrors, mutate, normalize };
}

const cases = [
    ['priority', 'custom_priority', 'high', 'low'],
    ['priority', 'custom_priority', 'high', ''],
    ['customStatus', 'custom_status', 'doing', ''],
    ['startDate', 'start_date', '2026-09-24', ''],
    ['completionTime', 'completion_time', '2026-09-25', ''],
    ['taskCompleteAt', 'task_complete_at', '2026-09-25 10:00', ''],
    ['taskDateColor', 'custom_task_date_color', '#ff0000', ''],
    ['duration', 'custom_duration', '90', ''],
    ['remark', 'custom_remark', '旧备注', ''],
    ['customTime', 'custom_time', '2026-09-25', ''],
    ['milestone', 'custom_milestone', false, true],
    ['milestone', 'custom_milestone', true, false],
    ['pinned', 'custom_pinned', true, false],
    ['allDayBottom', 'custom_all_day_bottom', false, true],
    ['allDayBottom', 'custom_all_day_bottom', true, false],
    ['tomatoEstimateCount', 'tomato_estimate_count', '3', ''],
    ['tomatoCount', 'tomato_count', '3', ''],
    ['tomatoMinutes', 'tomato_minutes', '45', ''],
    ['tomatoHours', 'tomato_hours', '0.75', ''],
    ['repeatRule', 'repeat_rule', { enabled: true }, { enabled: false }],
    ['repeatState', 'repeat_state', { occurrenceCount: 2 }, { occurrenceCount: 3 }],
    ['repeatHistory', 'repeat_history', [{ date: '2026-09-24' }], []],
];

for (const [field, alias, before, after] of cases) {
    test(`${field} = ${JSON.stringify(after)} stays current across local mirrors, projections and view normalization`, () => {
        const aliasValue = typeof before === 'boolean' ? (before ? '1' : '') : before;
        const patch = { [field]: after };
        for (const phase of ['optimistic', 'commit', 'local']) {
            const h = createHarness({ [field]: before, [alias]: aliasValue });
            h.mutate(phase, patch);
            const tasks = [...h.mirrors, h.store.getProjected('task-a')];
            for (const task of tasks) {
                assert.deepEqual(h.normalize(task)[field], after, `${phase}: normalization must retain the new ${field}`);
                const expectedAlias = typeof after === 'boolean' ? (after ? '1' : '') : after;
                assert.deepEqual(clone(task[alias]), expectedAlias, `${phase}: alias readers must see the new ${field}`);
            }
        }
    });
    test(`${field}: a delayed create receipt and stale snapshot cannot undo a committed edit`, () => {
        const aliasValue = typeof before === 'boolean' ? (before ? '1' : '') : before;
        const h = createHarness({ [field]: before, [alias]: aliasValue });
        h.store.createPendingTask(h.store.getFlat('task-a'));
        h.mutate('optimistic', { [field]: after });
        h.context.__tmMarkLocalTaskPatchWatermark('task-a', { [field]: after });
        h.mutate('commit', { [field]: after }, { task: { id: 'task-a', [field]: after } });
        h.store.applyMutation({
            type: 'createTaskInDoc', phase: 'commit', opId: 'delayed-create', taskId: 'task-a',
            task: { id: 'task-a', [field]: before, [alias]: aliasValue },
        }, { applyLocal: false });
        for (const task of [...h.mirrors, h.store.getProjected('task-a'), h.store.getPending('task-a')]) {
            assert.deepEqual(h.normalize(task)[field], after, 'late receipt must keep the newer edit and aliases');
        }
        h.context.__tmApplyQueuedTaskFieldPatchToTask(h.store.getFlat('task-a'), { [field]: before });
        const stale = { id: 'task-a', [field]: before, [alias]: aliasValue };
        h.context.__tmMergeLocalTaskPatchIntoTask(stale);
        assert.deepEqual(h.normalize(stale)[field], after, 'snapshot must use stored intent rather than the stale flat mirror');
    });
    test(`${field}: a receipt canonical value overrides its older alias`, () => {
        const aliasValue = typeof before === 'boolean' ? (before ? '1' : '') : before;
        const h = createHarness({ [field]: before, [alias]: aliasValue });
        h.mutate('commit', { [field]: after }, { task: { id: 'task-a', [field]: after, [alias]: aliasValue } });
        assert.deepEqual(h.normalize(h.store.getProjected('task-a'))[field], after);
    });
}

test('custom-field removal survives an unrelated receipt, stale mirrors and sparse custom-field receipts', () => {
    const h = createHarness({ customFieldValues: { stage: 'old', labels: ['a'], notes: 'old' }, __customFieldRawValues: { stage: 'old', labels: 'a', notes: 'old' } });
    const defs = new Map([['stage', { type: 'select' }], ['labels', { type: 'multi' }], ['notes', { type: 'text' }]]);
    Object.assign(h.context, {
        __tmGetCustomFieldDefMap: () => defs,
        __tmNormalizeCustomFieldValue: (_field, value) => value,
        __tmSerializeCustomFieldValue: (_field, value) => Array.isArray(value) ? value.join(',') : value,
    });
    const patch = { customFieldValues: { stage: '', labels: [], notes: 'new' } };
    h.mutate('optimistic', patch);
    h.context.__tmMarkLocalTaskPatchWatermark('task-a', patch);
    h.mutate('commit', patch, { task: { id: 'task-a', customFieldValues: { notes: 'new' } } });
    h.store.applyMutation({
        type: 'taskPatch', phase: 'commit', opId: 'unrelated-priority', taskId: 'task-a', patch: { priority: 'high' },
        task: { id: 'task-a', priority: 'high', customFieldValues: { stage: 'old', labels: ['a'], notes: 'old' } },
    }, { applyLocal: false });
    assert.deepEqual(clone(h.store.getProjected('task-a').customFieldValues), { notes: 'new' });
    const stale = { id: 'task-a', customFieldValues: { stage: 'old', labels: ['a'], notes: 'old' }, __customFieldRawValues: { stage: 'old', labels: 'a', notes: 'old' } };
    h.store.getFlat('task-a').customFieldValues = clone(stale.customFieldValues);
    h.context.__tmMergeLocalTaskPatchIntoTask(stale);
    assert.deepEqual(clone(stale.customFieldValues), { notes: 'new' });
    assert.deepEqual(clone(stale.__customFieldRawValues), { notes: 'new' });
    h.store.applyMutation({
        type: 'taskPatch', phase: 'commit', opId: 'one-custom-field', taskId: 'task-a', patch: { customFieldValues: { notes: 'corrected' } },
        task: { id: 'task-a', customFieldValues: { stage: 'old', labels: ['a'], notes: 'kernel-correction' } },
    }, { applyLocal: false });
    assert.deepEqual(clone(h.store.getProjected('task-a').customFieldValues), { notes: 'kernel-correction' }, 'own-field corrections must win while other custom-field clears stay protected');
    h.context.__tmMarkLocalTaskPatchWatermark('task-a', { customFieldValues: { notes: 'next' } });
    const protectedPatch = h.context.__tmBuildLocalTaskPatchWatermarkPatch('task-a');
    assert.deepEqual(clone(protectedPatch.customFieldValues), { stage: '', labels: [], notes: 'next' }, 'successive custom edits must retain earlier clears until each is confirmed');
    h.context.__tmClearLocalTaskPatchWatermarkFields('task-a', ['customField:stage']);
    assert.deepEqual(clone(h.context.__tmBuildLocalTaskPatchWatermarkPatch('task-a').customFieldValues), { labels: [], notes: 'next' }, 'confirmed custom fields must be released independently');
});

test('existing raw metadata aliases advance and clear with canonical edits', () => {
    const h = createHarness({
        priority: 'high', customPriority: 'high', 'custom-priority': 'high',
        pinned: true, customPinned: true, 'custom-pinned': '1',
        startDate: '2026-10-10', custom_start_date: '2026-10-10', 'custom-start-date': '2026-10-10',
        completionTime: '2026-10-11', custom_completion_time: '2026-10-11', 'custom-completion-time': '2026-10-11',
        taskDateColor: 'red', 'custom-task-date-color': 'red',
    });
    h.mutate('optimistic', { priority: '', pinned: false, startDate: '', completionTime: '', taskDateColor: '' });
    for (const task of h.mirrors) {
        for (const key of ['customPriority', 'custom-priority', 'customPinned', 'custom-pinned', 'custom_start_date', 'custom-start-date', 'custom_completion_time', 'custom-completion-time', 'custom-task-date-color']) {
            assert.equal(task[key], '', 'clear must update ' + key);
        }
    }
});

test('rollback restores changed field aliases while preserving unrelated structural values', () => {
    const h = createHarness({ milestone: false, custom_milestone: '', parentTaskId: 'parent-a', priorityScore: 42 });
    h.mutate('optimistic', { milestone: true });
    h.mutate('rollback', { milestone: true }, { inversePatch: { milestone: false } });
    for (const task of [...h.mirrors, h.store.getProjected('task-a')]) {
        assert.equal(h.normalize(task).milestone, false);
        assert.equal(task.parentTaskId, 'parent-a');
        assert.equal(task.priorityScore, 42);
    }
});

test('shared field application retains structural fields and their aliases', () => {
    const h = createHarness({ parentTaskId: 'parent-a', docId: 'doc-a', priorityScore: 42 });
    h.mutate('local', { parentTaskId: 'parent-b', docId: 'doc-b', priorityScore: 55, h2: '新标题' });
    for (const task of [...h.mirrors, h.store.getProjected('task-a')]) {
        assert.equal(task.parentTaskId, 'parent-b');
        assert.equal(task.parent_task_id, 'parent-b');
        assert.equal(task.docId, 'doc-b');
        assert.equal(task.root_id, 'doc-b');
        assert.equal(task.priorityScore, 55);
        assert.equal(task.h2, '新标题');
    }
});

for (const enabled of [true, false]) {
    test(`detail repeat rule (${enabled}) refreshes alongside content without replacing the active draft`, () => {
        const h = createHarness({ repeatRule: { enabled: !enabled }, content: '原始标题' });
        class Element {}
        class TextArea extends Element {}
        const face = Object.assign(new Element(), { innerHTML: '旧重复设置' });
        const textarea = Object.assign(new TextArea(), { value: '正在编辑的草稿' });
        const panel = Object.assign(new Element(), {
            id: 'tmChecklistDetailPanel', dataset: { tmDetailTaskId: 'task-a' },
            querySelector: (selector) => ({
                '[data-tm-detail="content"]': textarea,
                '[data-tm-detail-chip-face="timeHub"]': face,
            })[selector] || null,
        });
        Object.assign(h.context, {
            Element, HTMLElement: Element, HTMLTextAreaElement: TextArea,
            document: { activeElement: textarea },
            SettingsStore: { data: { enableTomatoIntegration: false } },
            __tmGetChecklistDetailTaskById: () => h.store.getProjected('task-a'),
            __tmIsTaskDetailRootUsable: () => true, __tmAreTaskDetailIdsEquivalent: (a, b) => a === b,
            __tmNormalizeDateOnly: (value) => value,
            __tmGetTaskRepeatRule: (task) => task.repeatRule,
            __tmGetTaskRepeatSummary: (rule) => rule.enabled ? '每天重复' : '',
            __tmTaskDetailTimeHubHasValue: (_task, options) => !!options.repeatSummary,
            __tmGetTaskDetailTimeHubLabel: (_task, options) => options.repeatSummary || '设置时间',
            __tmBuildTaskDetailTimeHubFace: (_task, options) => options.repeatSummary || '设置时间',
        });
        vm.runInContext(extract(detailSource, '__tmPatchTaskDetailPanelInPlace'), h.context);
        const patch = { repeatRule: { enabled }, content: '其他视图的新标题' };
        h.mutate('local', patch);
        assert.equal(h.context.__tmPatchTaskDetailPanelInPlace(panel, 'task-a', patch), true);
        assert.equal(face.innerHTML, enabled ? '每天重复' : '设置时间');
        assert.equal(textarea.value, '正在编辑的草稿');
    });
}

function prepareDetailHydration(h) {
    Object.assign(h.context, {
        __tmIsTaskDetailWhiteboardSnapshotTask: () => false,
        __tmGetTaskDetailRemarkRaw: task => task.remark || '',
        __tmBuildQueuedTaskFieldPatchMap: () => new Map(),
        __tmTaskHasOwnHeadingContextFields: () => true,
    });
    vm.runInContext(extract(read('task-runtime/53-list-render-and-document-loader.js'), '__tmCacheTaskInState'), h.context);
    vm.runInContext(extract(detailSource, '__tmEnsureTaskDetailFieldAttrs'), h.context);
}

for (const phase of ['optimistic', 'commit']) {
    test(`opening detail preserves the ${phase} check-in plan when weekly attributes arrive late`, async () => {
        const oldRule = { enabled: true, type: 'weekly', trigger: 'due', every: 1, anchorDate: '2026-10-22' };
        const latest = {
            repeatRule: { enabled: true, type: 'daily', trigger: 'checkin', every: 2, anchorDate: '2026-10-22' },
            repeatState: { checkinHistory: [], occurrenceCount: 1 }, startDate: '', completionTime: '',
        };
        const h = createHarness({ repeatRule: oldRule });
        h.mutate('optimistic', latest);
        if (phase === 'commit') h.mutate('commit', latest);
        h.context.__tmMarkLocalTaskPatchWatermark('task-a', latest);
        prepareDetailHydration(h);
        h.context.__tmApplyTaskAttrHostOverrides = async tasks => {
            tasks[0].repeatRule = clone(oldRule);
            tasks[0].repeat_rule = tasks[0].repeatRule;
        };
        await h.context.__tmEnsureTaskDetailFieldAttrs(h.store.get('task-a'), { force: true });
        for (const task of [...h.mirrors, h.store.get('task-a'), h.store.getProjected('task-a')]) {
            assert.deepEqual(clone(task.repeatRule), latest.repeatRule, 'opening detail must retain the current plan in every view');
            assert.equal(task.startDate, '');
            assert.equal(task.completionTime, '');
        }
    });
}

test('view switches never observe partial detail reads and late reads cannot undo a newer task receipt', async () => {
    const h = createHarness({ completionTime: '2026-10-22', remark: 'current' });
    prepareDetailHydration(h);
    let release;
    const blocked = new Promise(resolve => { release = resolve; });
    h.context.__tmApplyTaskAttrHostOverrides = async tasks => {
        tasks[0].completionTime = tasks[0].completion_time = '';
        tasks[0].remark = 'stale';
        await blocked;
    };
    const hydration = h.context.__tmEnsureTaskDetailFieldAttrs(h.store.get('task-a'), { force: true });
    for (const view of ['list', 'checklist', 'kanban', 'timeline', 'whiteboard']) {
        h.context.state.viewMode = view;
        assert.equal(h.store.get('task-a').completionTime, '2026-10-22', `${view}: the in-flight read must stay detached`);
    }
    const latest = { ...clone(h.store.get('task-a')), completionTime: '2026-10-23', completion_time: '2026-10-23', remark: 'new receipt' };
    h.store.acceptAuthoritative([latest]);
    h.store.upsertLocal(latest);
    release();
    const result = await hydration;
    assert.equal(result.completionTime, '2026-10-23');
    for (const task of [...h.mirrors, h.store.getProjected('task-a')]) {
        assert.equal(task.completionTime, '2026-10-23', 'an outdated detail read must not be cached after a newer receipt');
        assert.equal(task.remark, 'new receipt');
    }
});

test('detail hydration replays the current queue instead of a patch captured before awaiting', async () => {
    const h = createHarness({ completionTime: '2026-10-22' });
    prepareDetailHydration(h);
    let queued = { completionTime: '2026-10-23' };
    h.context.__tmBuildQueuedTaskFieldPatchMap = () => new Map([['task-a', queued]]);
    h.context.__tmApplyTaskAttrHostOverrides = async () => {
        queued = { completionTime: '2026-10-24' };
    };
    const result = await h.context.__tmEnsureTaskDetailFieldAttrs(h.store.get('task-a'), { force: true });
    assert.equal(result.completionTime, '2026-10-24');
    assert.equal(h.store.get('task-a').completionTime, '2026-10-24');
});

const timelineCases = [
    ['priority', 'low', 'priority'], ['priority', 'low', 'score'],
    ['customStatus', 'doing', 'status'], ['done', true, 'status'],
    ['remark', '新备注', 'remark'], ['attachments', ['assets/new.png'], 'attachments'],
    ['pinned', true, 'pinned'], ['duration', '60', 'time'],
    ['tomatoCount', '2', 'time'], ['tomatoEstimateCount', '3', 'time'],
    ['tomatoMinutes', '45', 'time'], ['tomatoHours', '0.75', 'time'],
    ['taskCompleteAt', '2026-09-25 10:00', 'time'],
    ['startDate', '2026-09-25', 'time'], ['completionTime', '2026-09-26', 'time'],
    ['customTime', '2026-09-25', 'time'], ['done', true, 'time'],
];

for (const [field, value, expected] of timelineCases) {
    test(`timeline ${field} updates its ${expected} cell without reloading the view`, () => {
        class Element {}
        const row = new Element();
        const modal = Object.assign(new Element(), { querySelector: () => row });
        const calls = [];
        const context = vm.createContext({
            Element, HTMLElement: Element, CSS: { escape: (value) => value },
            state: { modal, viewMode: 'timeline' },
            __tmTaskStore: { getProjected: () => ({ id: 'task-a', [field]: value }) },
            __tmDoesPatchAffectPriorityScore: () => field === 'priority',
        });
        for (const [name, label] of Object.entries({
            __tmUpdateTaskPriorityInDOM: 'priority', __tmUpdateTaskCheckboxPriorityInDOM: 'checkbox',
            __tmUpdateTaskScoreInDOM: 'score', __tmUpdateTaskStatusTagInDOM: 'status',
            __tmUpdateTaskDoneInDOM: 'done', __tmUpdateTaskRemarkInDOM: 'remark',
            __tmUpdateTaskAttachmentsInDOM: 'attachments', __tmUpdateTaskPinnedInDOM: 'pinned',
            __tmUpdateListTaskTimeInDOM: 'time', __tmUpdateTimelineTaskInDOM: 'bar',
            __tmApplyTaskTitleOpacityInContainer: 'opacity',
        })) context[name] = () => { calls.push(label); return true; };
        const start = viewSource.indexOf('    const __tmViewControllers = {');
        const end = viewSource.indexOf('\n    };', start);
        vm.runInContext(viewSource.slice(start, end + 7) + '\nthis.controllers = __tmViewControllers;', context);
        context.controllers.timeline.patchTask('task-a', { [field]: value });
        assert.ok(calls.includes(expected), `expected ${expected}, received ${calls.join(', ') || 'no cell updates'}`);
    });
}
