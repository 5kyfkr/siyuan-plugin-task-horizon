'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const lifecycleSource = read('src/task-horizon/main/task-runtime/56-task-lifecycle-runtime.js');
const apiSource = read('src/task-horizon/main/20-api-and-runtime-services.js');
const listSource = read('src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js');
const nativeSource = read('src/task-horizon/main/shell/72-shell-entrances-and-native-doc-hooks.js');
const dialogsSource = read('src/task-horizon/main/30-dialogs-and-ui-foundation.js');
const storeSource = read('src/task-horizon/main/10-stores-rules-and-cache.js');
const settingsSource = read('src/task-horizon/main/settings/60-settings-screen.js');
const exportsSource = read('src/task-horizon/main/settings/64-export-runtime.js');
const manifest = JSON.parse(read('src/task-horizon/manifest.main.json'));

const plain = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

function createHarness() {
    const attrs = new Map();
    const tasks = new Map();
    const moves = [];
    const queued = [];
    let documentKramdown = '';
    let appendedHeadingCount = 0;
    const context = vm.createContext({
        console,
        Date,
        JSON,
        Map,
        Promise,
        setTimeout,
        clearTimeout,
        state: { flatTasks: {}, pendingInsertedTasks: {} },
        SettingsStore: {
            data: {
                taskHeadingLevel: 'h3',
                taskRecycleDocId: 'doc-recycle',
                taskCompletionArchiveMode: 'heading',
                taskCompletionArchiveDocId: 'doc-archive',
                deleteTaskRemovesWhiteboardCards: true,
            },
        },
        normalizeTaskFields: (task) => task,
        __tmNormalizeHeadingText: (value) => String(value || '').replace(/^#{1,6}\s+/, '').trim(),
        __tmNormalizeTaskCompletionArchiveMode: (value) => ['document', 'heading'].includes(String(value)) ? String(value) : 'none',
        __tmIsTaskDoneEffective: (task) => task?.done === true,
        __tmIsRecurringInstanceTask: (task) => task?.isRecurringInstance === true,
        __tmGetTaskRepeatRule: (task) => task?.repeatRule || { enabled: false, type: 'none' },
        __tmCollectTaskTreeIdsForScheduleCleanup: (_task, fallback) => Array.isArray(fallback) ? fallback : [fallback],
        __tmDeleteWhiteboardSnapshotTasks: () => {},
        __tmResolveDefaultNewTaskInsertOptions: async (docId) => ({ insertParentId: docId }),
        __tmResolveTaskMovePlacementMeta: async () => { throw new Error('no parent'); },
        __tmParseHeadingBlocksFromKramdown: (value) => {
            const match = String(value || '').match(/^(#{1,6})\s+已完成\s+\{id="([^"]+)"\}$/m);
            return match ? [{ id: match[2], content: '已完成', level: match[1].length }] : [];
        },
        __tmResolveHeadingGroupInsertPlacement: async (_docId, headingId) => ({
            matched: true,
            parentID: 'doc-source',
            heading: { id: headingId, content: '已完成', rank: 4 },
        }),
        __tmAppendBlockWithRetry: async (_docId, markdown) => {
            appendedHeadingCount += 1;
            documentKramdown = `${markdown} {id="heading-created"}`;
            return 'heading-created';
        },
        __tmMoveTaskToPlacement: async (taskId, targetDocId, placement, options) => {
            moves.push({ taskId, targetDocId, placement: plain(placement), options: plain(options) });
            const task = tasks.get(taskId);
            if (task) {
                task.root_id = targetDocId;
                task.docId = targetDocId;
                task.parentTaskId = String(options?.parentTaskId || '');
                task.parent_task_id = task.parentTaskId;
            }
            return true;
        },
        hint: () => {},
    });
    context.API = {
        call: async (_route, payload) => ({ code: 0, data: plain(attrs.get(payload.id) || {}) }),
        getTaskById: async (id) => plain(tasks.get(id) || null),
        getBlockKramdown: async () => documentKramdown,
        getFirstDirectChildIdOfDoc: async () => '',
    };
    context.__tmBackendAdapter = {
        setAttrs: async (id, patch) => {
            attrs.set(id, { ...(attrs.get(id) || {}), ...plain(patch) });
            return true;
        },
    };
    context.__tmRuntimeState = {
        getTaskById: (id) => tasks.get(id) || null,
        getFlatTaskById: (id) => tasks.get(id) || null,
    };
    context.__tmRequireTaskOutbox = (method) => {
        assert.equal(method, 'enqueue');
        return (definition, options) => {
            queued.push(plain(definition));
            const result = Promise.resolve({ ok: true });
            options?.onPending?.(result, definition);
            return options?.wait ? result : Promise.resolve(definition.id || 'queued');
        };
    };
    vm.runInContext(`${lifecycleSource}\nthis.lifecycleTest = {
        normalize: __tmNormalizeTaskLifecycleMeta,
        eligible: __tmCanArchiveCompletedTask,
        resolveHeading: __tmResolveCompletedHeadingPlacement,
        enqueue: __tmEnqueueTaskLifecycle,
    };`, context);
    return {
        context,
        attrs,
        tasks,
        moves,
        queued,
        setKramdown: (value) => { documentKramdown = value; },
        getAppendedHeadingCount: () => appendedHeadingCount,
    };
}

async function testMetadataAndRestoreComposition() {
    const harness = createHarness();
    const { context, attrs, tasks, moves } = harness;
    const completed = { originDocId: 'doc-original', mode: 'document', archivedAt: 'earlier' };
    const normalized = context.lifecycleTest.normalize({ v: 99, completed, recycle: { originDocId: 'doc-a', originParentTaskId: 'parent-a' } });
    assert.deepEqual(plain(normalized), {
        v: 1,
        completed,
        recycle: { originDocId: 'doc-a', originParentTaskId: 'parent-a', archivedAt: '' },
    });

    tasks.set('task-delete', { id: 'task-delete', root_id: 'doc-source', done: true, parent_task_id: '' });
    attrs.set('task-delete', {
        'custom-task-horizon-lifecycle': JSON.stringify({ v: 1, completed }),
    });
    await context.__tmTaskLifecycle.execute({
        action: 'archiveDeleted',
        taskId: 'task-delete',
        originDocId: 'doc-source',
        targetDocId: 'doc-recycle',
        scheduleCleanupTaskIds: ['task-delete'],
    });
    let stored = JSON.parse(attrs.get('task-delete')['custom-task-horizon-lifecycle']);
    assert.deepEqual(stored.completed, completed, 'recycle metadata must preserve completion metadata');
    assert.equal(stored.recycle.originDocId, 'doc-source');
    assert.equal(moves.at(-1).targetDocId, 'doc-recycle');

    await context.__tmTaskLifecycle.execute({ action: 'restoreDeleted', taskId: 'task-delete' });
    stored = JSON.parse(attrs.get('task-delete')['custom-task-horizon-lifecycle']);
    assert.deepEqual(stored.completed, completed, 'restore delete must clear only the recycle branch');
    assert.equal(stored.recycle, undefined);
    assert.equal(moves.at(-1).targetDocId, 'doc-source');

    tasks.set('task-composed', { id: 'task-composed', root_id: 'doc-recycle', done: false, parent_task_id: '' });
    attrs.set('task-composed', {
        'custom-task-horizon-lifecycle': JSON.stringify({
            v: 1,
            completed,
            recycle: { originDocId: 'doc-archive', originParentTaskId: '', archivedAt: 'later' },
        }),
    });
    await context.__tmTaskLifecycle.execute({ action: 'restoreDeleted', taskId: 'task-composed' });
    assert.equal(moves.at(-1).targetDocId, 'doc-original', 'an undone recycled completion must restore directly to its original document');
    assert.equal(attrs.get('task-composed')['custom-task-horizon-lifecycle'], '');
}

async function testCompletionEligibilityAndRaceValidation() {
    const harness = createHarness();
    const { context, attrs, tasks, moves } = harness;
    assert.equal(context.lifecycleTest.eligible({ parent_task_id: 'parent-1' }, true), false);
    assert.equal(context.lifecycleTest.eligible({ repeatRule: { enabled: true, type: 'daily' } }, true), false);
    assert.equal(context.lifecycleTest.eligible({ parent_task_id: '', repeatRule: { enabled: false, type: 'none' } }, true), true);

    tasks.set('task-race', { id: 'task-race', root_id: 'doc-source', parent_task_id: '', done: false });
    await context.__tmTaskLifecycle.execute({
        action: 'archiveCompleted',
        taskId: 'task-race',
        mode: 'heading',
        originDocId: 'doc-source',
    });
    assert.equal(moves.length, 0, 'execution-time undone state must cancel a queued completion archive');
    assert.equal(attrs.has('task-race'), false);

    tasks.set('task-done', { id: 'task-done', root_id: 'doc-source', parent_task_id: '', done: true });
    harness.setKramdown('#### 已完成 {id="heading-existing"}');
    await context.__tmTaskLifecycle.execute({
        action: 'archiveCompleted',
        taskId: 'task-done',
        mode: 'heading',
        originDocId: 'doc-source',
    });
    const archived = JSON.parse(attrs.get('task-done')['custom-task-horizon-lifecycle']);
    assert.equal(archived.completed.mode, 'heading');
    assert.equal(moves.at(-1).options.heading.id, 'heading-existing');

    tasks.get('task-done').done = false;
    await context.__tmTaskLifecycle.execute({ action: 'restoreCompleted', taskId: 'task-done' });
    assert.equal(attrs.get('task-done')['custom-task-horizon-lifecycle'], '');
    assert.equal(moves.at(-1).targetDocId, 'doc-source');
}

async function testHeadingLockAndQueueLane() {
    const harness = createHarness();
    const { context, queued } = harness;
    harness.setKramdown('');
    const [first, second] = await Promise.all([
        context.lifecycleTest.resolveHeading('doc-source'),
        context.lifecycleTest.resolveHeading('doc-source'),
    ]);
    assert.equal(harness.getAppendedHeadingCount(), 1, 'concurrent completion archives must create one heading');
    assert.equal(first.level, 3);
    assert.equal(second.level, 3);
    assert.equal(first.placement.previousID, 'heading-created');

    await context.lifecycleTest.enqueue('archiveCompleted', 'task-lane', { originDocId: 'doc-source', mode: 'heading' }, { wait: true });
    assert.equal(queued[0].type, 'taskLifecycle');
    assert.equal(queued[0].laneKey, 'task:task-lane');
    assert.equal(queued[0].data.action, 'archiveCompleted');
}

function testStaticContracts() {
    assert.match(storeSource, /deleteTaskRemovesWhiteboardCards:\s*true/, 'whiteboard card cleanup must default to enabled');
    assert.match(storeSource, /tm_delete_task_removes_whiteboard_cards'[\s\S]*!== false/, 'missing persisted cleanup setting must remain enabled');
    assert.match(settingsSource, /deleteTaskRemovesWhiteboardCards !== false \? 'checked' : ''/, 'settings switch must render checked by default');
    for (const key of ['taskDeleteMode', 'taskRecycleDocId', 'taskCompletionArchiveMode', 'taskCompletionArchiveDocId']) {
        assert.match(storeSource, new RegExp(key), `${key} must be persisted`);
        assert.match(settingsSource, new RegExp(key), `${key} must be configurable`);
        assert.match(exportsSource, new RegExp(`'${key}'`), `${key} must be exported`);
    }
    assert.match(apiSource, /__TM_OP_OUTBOX_PERSISTABLE_TYPES[\s\S]*'taskLifecycle'/);
    assert.match(apiSource, /if \(type === 'taskLifecycle'\)[\s\S]*lifecycle\.execute/);
    assert.match(apiSource, /if \(key === 'taskLifecycle'\) return '任务归档'/);
    assert.match(listSource, /__tmRunSetDonePostCommitEffects[\s\S]*__tmTaskLifecycle\?\.notifyCompletion/);
    assert.match(apiSource, /async function __tmApplyTaskStatus[\s\S]*__tmTaskLifecycle\?\.notifyCompletion/);
    assert.match(nativeSource, /async function __tmSyncNativeDocCheckboxLinkedStatus[\s\S]*__tmTaskLifecycle\?\.notifyCompletion/);
    assert.match(listSource, /const useRecycle[\s\S]*lifecycle\.archiveDeleted[\s\S]*__tmShowActionHint/);
    assert.match(dialogsSource, /multi-select-batch-recycle[\s\S]*撤销回收/);
    assert.match(listSource, /\{ id: 'new-task', label: '新建\/归档' \}/);
    assert.doesNotMatch(listSource, /\{ id: 'lifecycle', label:/);
    assert.match(settingsSource, /data-tm-settings-section="new-task"[\s\S]*tm-settings-section-title" style="margin-top:20px;">任务归档/);
    assert.doesNotMatch(settingsSource, /data-tm-settings-section="lifecycle"/);
    assert.match(settingsSource, /回收站文档 ID[\s\S]*b3-text-field[\s\S]*updateTaskRecycleDocId/);
    assert.match(settingsSource, /完成归档文档 ID[\s\S]*b3-text-field[\s\S]*updateTaskCompletionArchiveDocId/);
    assert.doesNotMatch(settingsSource, /renderTaskLifecycleDocOptions/);
    assert.equal((lifecycleSource.match(/custom-task-horizon-lifecycle/g) || []).length, 1, 'lifecycle must use one raw metadata attribute');
    const moveIndex = manifest.scripts.indexOf('main/task-runtime/55-task-move-writer.js');
    assert.equal(manifest.scripts[moveIndex + 1], 'main/task-runtime/56-task-lifecycle-runtime.js');
}

(async () => {
    await testMetadataAndRestoreComposition();
    await testCompletionEligibilityAndRaceValidation();
    await testHeadingLockAndQueueLane();
    testStaticContracts();
    console.log('task lifecycle contract tests passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
