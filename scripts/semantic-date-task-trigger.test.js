'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const main = path.join(__dirname, '..', 'src/task-horizon/main');
const read = file => fs.readFileSync(path.join(main, file), 'utf8');
const api = read('20-api-and-runtime-services.js');
const native = read('shell/72-shell-entrances-and-native-doc-hooks.js');
const segment = (source, from, to) => {
    const start = source.indexOf(from), end = source.indexOf(to, start + from.length);
    assert.ok(start >= 0 && end > start, from);
    return source.slice(start, end);
};

function harness() {
    const tasks = new Map(), recognized = {}, shown = [], reads = [], timers = new Map(), errors = [], detailRoots = [], focusHandlers = new Map();
    class DetailElement {
        constructor(id) { this.id = id; this.connected = true; this.__tmTaskDetailSessionId = 1; }
    }
    let timerSeq = 0, loadBarrier = null;
    const state = { openToken: 1, semanticDateConfirmModal: null, semanticDateAutoApplying: false };
    const context = vm.createContext({
        Date, Intl, Map, Set, state, Element: DetailElement,
        SettingsStore: { data: { semanticDateAutoPromptEnabled: true, semanticDateDefaultReminderTime: '08:00' } },
        Storage: { get: (key, fallback) => fallback },
        SemanticDateRecognizedStore: {
            load: async () => { if (loadBarrier) await loadBarrier; }, snapshot: () => recognized,
            upsertMany: items => items.forEach(item => { recognized[item.taskId] = { signature: item.signature }; }),
        },
        MetaStore: { applyToTask() {} }, normalizeTaskFields() {},
        __tmNormalizeDateOnly: value => value instanceof Date
            ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
            : String(value || '').slice(0, 10),
        API: { parseTaskStatus: markdown => ({ content: markdown.replace(/^- \[[ x]\] /, ''), done: markdown.startsWith('- [x]') }) },
        document: {
            activeElement: null, body: { contains: element => !!element?.connected },
            addEventListener: (type, handler) => focusHandlers.set(type, handler),
            removeEventListener: (type, handler) => { if (focusHandlers.get(type) === handler) focusHandlers.delete(type); },
        },
        hint() {}, __tmCollectBusyTaskDetailRoots: () => detailRoots,
        __TM_SEMANTIC_DATE_AUTO_SCAN_BATCH_SIZE: 120,
        __tmSemanticDatePendingTasks: new Map(), __tmSemanticDatePromptTimer: null, __tmSemanticDatePromptRunning: false,
        __tmMutationSettleListeners: new Map(),
        __tmGetMutationTaskIdForSettle: op => op?.data?.taskId || op?.data?.sourceTaskId || '',
        __tmTaskBoundary: { getTask: id => { reads.push(id); return tasks.get(id); } },
        __tmIsPluginVisibleNow: () => true,
        __tmShowSemanticDateConfirmModal: items => {
            shown.push(items);
            state.semanticDateConfirmModal = { connected: true, remove() { this.connected = false; } };
        },
        setTimeout: callback => { const id = ++timerSeq; timers.set(id, callback); return id; },
        clearTimeout: id => timers.delete(id),
    });
    vm.runInContext([
        segment(read('task-runtime/50-task-model-and-repeat-utils.js'), '    function __tmParseTaskRepeatJson', '    function __tmGetTaskRepeatWeekdayLabel'),
        segment(api, '    function __tmSemanticPad2', '    function __tmGetSemanticSuggestionWrites'),
        segment(api, '    function __tmNotifyMutationSettle', '    function __tmOnMutationSettle'),
        segment(api, '    function __tmScheduleSemanticDatePrompt', '    function __tmHasTaskScheduledToday'),
        segment(read('task-runtime/51-whiteboard-and-link-runtime.js'), '    function __tmMarkTaskDetailRootClosing', '    function __tmCollectBusyTaskDetailRoots'),
    ].join('\n'), context);
    const runPrompt = context.__tmMaybeAutoPromptSemanticDates;
    context.__tmMaybeAutoPromptSemanticDates = async () => {
        try { return await runPrompt(); } catch (error) { errors.push(error); }
    };
    const task = (id, content, extra = {}) => {
        const value = { id, root_id: 'doc', content, markdown: '- [ ] ' + content, ...extra };
        tasks.set(id, value); return value;
    };
    const settle = (type, data, status = 'done', result = {}, inversePatch = {}) =>
        context.__tmNotifyMutationSettle({ type, data, inversePatch }, status, { result });
    const flush = async () => {
        while (timers.size) {
            const callbacks = Array.from(timers.values()); timers.clear();
            callbacks.forEach(callback => callback());
            await context.__tmMaybeAutoPromptSemanticDates();
            for (let index = 0; index < 8; index++) await Promise.resolve();
        }
        assert.deepEqual(errors, [], String(errors[0]?.stack || 'prompt execution'));
    };
    const focus = editing => {
        context.document.activeElement = editing ? { closest: () => ({}) } : null;
        focusHandlers.get('focusout')?.();
    };
    return { context, tasks, state, shown, reads, task, settle, flush, focus, detailRoots, DetailElement, focusHandlers,
        setLoadBarrier: value => { loadBarrier = value; } };
}

(async () => {
    const h = harness();
    h.task('unrelated', '明天9点开会');
    h.task('edited', '8点吃饭');
    h.settle('contentPatch', { taskId: 'edited', nextContent: '8点吃饭' }, 'done', {}, { content: '吃饭' });
    await h.flush();
    assert.deepEqual(h.shown.map(items => Array.from(items, item => item.taskId)), [['edited']]);
    assert.equal(h.reads.includes('unrelated'), false, 'recognition must never read another task');
    assert.match(h.shown[0][0].completionValue, / 08:00$/);
    h.context.__tmCloseSemanticDateConfirmModal();
    h.settle('contentPatch', { taskId: 'edited', nextContent: '8点吃饭' });
    await h.flush();
    assert.equal(h.shown.length, 1, 'ignoring a suggestion must preserve deduplication');

    for (const type of ['createTaskInDoc', 'createSubtask', 'createSibling']) {
        const created = h.task(type, '每天8点吃饭');
        h.settle(type, { sourceTaskId: 'unrelated', parentTaskId: 'unrelated', tempId: 'temp-' + type }, 'done', { realId: type, task: created });
        await h.flush();
        const items = h.shown.at(-1);
        assert.equal(items.length, 1);
        assert.equal(items[0].taskId, type, 'create must scan its real task ID, not the parent or sibling');
        assert.equal(items[0].writes.find(write => write.id === 'reminder').checked, false);
        h.context.__tmCloseSemanticDateConfirmModal();
    }
    assert.equal(h.reads.includes('unrelated'), false);

    const before = h.shown.length;
    h.task('failed', '明天10点开会');
    h.settle('contentPatch', { taskId: 'failed', nextContent: '明天10点开会' }, 'failed');
    h.settle('createTaskInDoc', { requestedTaskId: 'failed' }, 'done', { skipped: true });
    h.settle('taskPatch', { taskId: 'failed', patch: { priority: 'high' } });
    h.settle('contentPatch', { taskId: 'failed', nextContent: '明天10点开会' }, 'done', {}, { content: '明天10点开会' });
    await h.flush();
    assert.equal(h.shown.length, before, 'failed saves, skipped creates, metadata and unchanged titles must not prompt');

    h.task('field-title', '明天11点复盘');
    h.settle('taskPatch', { taskId: 'field-title', patch: { content: '明天11点复盘' } });
    await h.flush();
    assert.equal(h.shown.at(-1)[0].taskId, 'field-title');
    h.context.__tmCloseSemanticDateConfirmModal();

    h.task('queued-a', '明天12点吃饭'); h.task('queued-b', '明天13点吃饭');
    for (const taskId of ['queued-a', 'queued-a', 'queued-b']) h.context.__tmQueueSemanticDateTask(taskId);
    await h.flush();
    assert.equal(h.shown.at(-1)[0].taskId, 'queued-a');
    assert.equal(h.context.__tmSemanticDatePendingTasks.size, 1, 'duplicate events for one task must coalesce');
    h.context.__tmCloseSemanticDateConfirmModal(); await h.flush();
    assert.equal(h.shown.at(-1)[0].taskId, 'queued-b', 'an open confirmation must not lose subsequent task edits');
    h.context.__tmCloseSemanticDateConfirmModal();

    h.context.SettingsStore.data.semanticDateAutoPromptEnabled = false;
    h.context.__tmQueueSemanticDateTask('unrelated'); await h.flush();
    assert.equal(h.context.__tmSemanticDatePendingTasks.size, 0);
    h.context.SettingsStore.data.semanticDateAutoPromptEnabled = true;

    h.task('stale', '明天14点开会');
    let release;
    h.setLoadBarrier(new Promise(resolve => { release = resolve; }));
    h.context.__tmQueueSemanticDateTask('stale');
    const pending = h.context.__tmMaybeAutoPromptSemanticDates();
    h.task('stale', '明天15点开会'); h.context.__tmQueueSemanticDateTask('stale');
    release(); await pending; h.setLoadBarrier(null); await h.flush();
    assert.match(h.shown.at(-1)[0].completionValue, / 15:00$/, 'a late scan must never show an older title');
    h.context.__tmCloseSemanticDateConfirmModal();

    h.context.__tmIsPluginVisibleNow = () => false;
    h.task('standalone-create', '明天18点吃饭');
    h.settle('createTaskInDoc', { requestedTaskId: 'standalone-create' }, 'done', { realId: 'standalone-create' });
    await h.flush();
    assert.equal(h.shown.at(-1)[0].taskId, 'standalone-create', 'standalone quick-add must not depend on a visible task manager');
    h.context.__tmCloseSemanticDateConfirmModal();
    h.context.__tmIsPluginVisibleNow = () => true;

    h.task('closed', '明天16点开会');
    h.context.__tmQueueSemanticDateTask('closed'); h.state.openToken++;
    const shownBeforeClose = h.shown.length; await h.flush();
    assert.equal(h.shown.length, shownBeforeClose, 'an obsolete host session must not reopen a prompt');

    const d = harness();
    for (const [scope, id] of [['overlay', 'tm-task-detail-overlay'], ['kanban', 'tmKanbanDetailPanel'], ['task-sheet', 'tmTaskDetailSheetPanel'], ['checklist', 'tmChecklistSheetPanel']]) {
        const root = new d.DetailElement(id);
        d.detailRoots.push({ scope, root });
        d.task(id, '每天8点吃饭');
        const count = d.shown.length;
        d.settle('contentPatch', { taskId: id, nextContent: '每天8点吃饭' }); await d.flush();
        assert.equal(d.shown.length, count, scope + ': successful autosave must wait for the detail to close');
        assert.equal(d.context.__tmSemanticDatePendingTasks.size, 1);
        root.__tmTaskDetailFlushSave = async () => false;
        assert.equal(await d.context.__tmRunTaskDetailClose(root, async () => {}), false);
        d.focus(false); await d.flush();
        assert.equal(d.shown.length, count, scope + ': a failed close must retain the pending suggestion');
        root.__tmTaskDetailFlushSave = async () => true;
        assert.equal(await d.context.__tmRunTaskDetailClose(root, async () => {}), true);
        await d.flush();
        assert.equal(d.shown.at(-1)[0].taskId, id, scope + ': successful close must wake recognition');
        d.context.__tmCloseSemanticDateConfirmModal(); d.detailRoots.length = 0;
    }
    const sidebar = new d.DetailElement('tmChecklistDetailPanel');
    d.detailRoots.push({ scope: 'checklist', root: sidebar });
    d.task('sidebar', '明天9点开会'); d.focus(true);
    const sidebarCount = d.shown.length;
    d.settle('contentPatch', { taskId: 'sidebar', nextContent: '明天9点开会' }); await d.flush();
    assert.equal(d.shown.length, sidebarCount, 'a persistent sidebar must not interrupt typing');
    d.focus(true); await d.flush();
    assert.equal(d.shown.length, sidebarCount, 'moving between input areas must keep the suggestion pending');
    d.focus(false); await d.flush();
    assert.equal(d.shown.at(-1)[0].taskId, 'sidebar', 'a persistent sidebar can remain open after focus leaves input');
    assert.equal(sidebar.__tmTaskDetailClosed, undefined, 'recognition must never close the persistent sidebar');
    assert.equal(d.focusHandlers.has('focusout'), false, 'an empty queue must release its focus listener');
    d.context.__tmCloseSemanticDateConfirmModal(); d.detailRoots.length = 0;

    d.task('late-focus', '明天10点开会');
    let releaseFocusScan;
    d.setLoadBarrier(new Promise(resolve => { releaseFocusScan = resolve; }));
    d.context.__tmQueueSemanticDateTask('late-focus');
    const focusScan = d.context.__tmMaybeAutoPromptSemanticDates(); d.focus(true);
    releaseFocusScan(); await focusScan; d.setLoadBarrier(null); await d.flush();
    assert.equal(d.context.__tmSemanticDatePendingTasks.size, 1, 'focus entering input during a scan must not lose the task');
    d.focus(false); await d.flush();
    assert.equal(d.shown.at(-1)[0].taskId, 'late-focus');
    d.context.__tmCloseSemanticDateConfirmModal();
    d.task('latest-save', '明天11点开会');
    let releaseSave;
    d.context.__tmWaitForTaskWrites = () => new Promise(resolve => { releaseSave = resolve; });
    const saveCount = d.shown.length;
    d.context.__tmQueueSemanticDateTask('latest-save');
    const saveScan = d.context.__tmMaybeAutoPromptSemanticDates();
    for (let index = 0; index < 8; index++) await Promise.resolve();
    assert.equal(d.shown.length, saveCount, 'recognition waits for the latest blur save');
    d.task('latest-save', '明天12点开会'); releaseSave({ ok: true }); await saveScan;
    assert.match(d.shown.at(-1)[0].completionValue, / 12:00$/, 'recognition uses the final committed title');
    d.context.__tmCloseSemanticDateConfirmModal();
    d.context.__tmWaitForTaskWrites = async () => ({ ok: false });
    d.task('failed-final-save', '明天13点开会');
    const failureCount = d.shown.length;
    d.context.__tmQueueSemanticDateTask('failed-final-save'); await d.flush();
    assert.equal(d.shown.length, failureCount, 'a failed final blur save must not show an earlier suggestion');

    // Exercise the existing native editor bridge with its real scheduling and event binding.
    const nativeHandlers = new Map();
    Object.assign(h.context, {
        __tmNativeDocTaskContentSyncTimers: new Map(), __tmNativeDocTaskContentInputHandler: null,
        __TM_NATIVE_DOC_TASK_CONTENT_SYNC_DELAY_MS: 200,
        __tmRuntimeEvents: { on: (target, type, handler) => nativeHandlers.set(type, handler), off: () => {} },
        __tmResolveNativeDocTaskContentInput: () => ({ taskId: 'native', taskItem: { isConnected: true } }),
        __tmApplyLiveDocumentTaskContentPatch: () => h.task('native', '明天17点开会'),
    });
    h.task('native', '开会');
    vm.runInContext(segment(native, '    function __tmScheduleNativeDocTaskContentSync', '    function __tmMatchesNativeTaskShortcut'), h.context);
    h.context.__tmBindNativeDocTaskContentSync();
    nativeHandlers.get('input')({ type: 'input', isTrusted: true }); await h.flush();
    assert.equal(h.shown.length, shownBeforeClose, 'typing alone must not interrupt native editing');
    nativeHandlers.get('focusout')({ type: 'focusout', isTrusted: true }); await h.flush();
    assert.equal(h.shown.at(-1)[0].taskId, 'native');

    assert.doesNotMatch(read('task-runtime/53c-document-loader-runtime.js'), /__tmMaybeAutoPromptSemanticDates/, 'loading or refreshing the list must not trigger a global scan');
    console.log('semantic task-specific create, edit, native-editor trigger and race tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
