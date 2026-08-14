'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const lifecycleSource = read('src/task-horizon/main/task-runtime/56-task-lifecycle-runtime.js');
const apiSource = read('src/task-horizon/main/20-api-and-runtime-services.js');
const kernelSource = read('kernel.js');
const runtimeStateSource = read('src/task-horizon/main/32-runtime-state-and-events.js');
const listSource = read('src/task-horizon/main/task-runtime/53-list-render-and-document-loader.js');
const nativeSource = read('src/task-horizon/main/shell/72-shell-entrances-and-native-doc-hooks.js');
const dialogsSource = read('src/task-horizon/main/30-dialogs-and-ui-foundation.js');
const storeSource = read('src/task-horizon/main/10-stores-rules-and-cache.js');
const settingsSource = read('src/task-horizon/main/settings/60-settings-screen.js');
const exportsSource = read('src/task-horizon/main/settings/64-export-runtime.js');
const manifest = JSON.parse(read('src/task-horizon/manifest.main.json'));

const plain = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

function createHarness(options = {}) {
    const opts = (options && typeof options === 'object') ? options : {};
    const attrs = new Map();
    const tasks = new Map();
    const persistedTasks = new Map();
    const moves = [];
    const queued = [];
    let documentKramdown = '';
    let appendedHeadingCount = 0;
    let flushedHeadingCount = 0;
    let taskReadCount = 0;
    let moveFailureCount = opts.moveFailsOnce === true ? 1 : 0;
    const reminderTaskIds = new Set();
    const removedReminderIds = [];
    const cleanupSteps = [];
    const cleanupWarnings = [];
    const testConsole = {
        log: console.log,
        error: console.error,
        warn: (...args) => { cleanupWarnings.push(args.map((value) => String(value?.message || value || '')).join(' ')); },
    };
    const context = vm.createContext({
        console: testConsole,
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
        __tmDeleteWhiteboardSnapshotTasks: () => {
            cleanupSteps.push('whiteboard');
            if (opts.whiteboardCleanupFails === true) throw new Error('whiteboard cleanup failed');
        },
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
        __tmAppendBlockOnce: async (_docId, markdown) => {
            appendedHeadingCount += 1;
            documentKramdown = `${markdown} {id="heading-created"}`;
            return 'heading-created';
        },
        __tmMoveTaskToPlacement: async (taskId, targetDocId, placement, options) => {
            if (moveFailureCount > 0) {
                moveFailureCount -= 1;
                throw new Error('move failed once');
            }
            moves.push({ taskId, targetDocId, placement: plain(placement), options: plain(options) });
            const task = tasks.get(taskId);
            if (task) {
                task.root_id = targetDocId;
                task.docId = targetDocId;
                task.parentTaskId = String(options?.parentTaskId || '');
                task.parent_task_id = task.parentTaskId;
            }
            return {
                listID: `archive-list-${taskId}`,
                placement: { parentListId: `archive-list-${taskId}` },
                changeSet: { affectedDocumentIds: [targetDocId] },
            };
        },
        hint: () => {},
        __tomatoReminder: {
            get: async (id) => {
                cleanupSteps.push('reminder');
                if (opts.reminderCleanupFails === true) throw new Error('reminder cleanup failed');
                return { ok: true, hasReminder: reminderTaskIds.has(String(id || '')) };
            },
            remove: async (id) => {
                const tid = String(id || '');
                reminderTaskIds.delete(tid);
                removedReminderIds.push(tid);
                return { ok: true };
            },
        },
        __tmCalendar: {
            deleteTaskSchedulesByTaskIds: async () => {
                cleanupSteps.push('schedule');
                if (opts.scheduleCleanupFails === true) throw new Error('schedule cleanup failed');
                return true;
            },
        },
    });
    context.API = {
        call: async (_route, payload) => ({ code: 0, data: plain(attrs.get(payload.id) || {}) }),
        getTaskById: async (id) => {
            taskReadCount += 1;
            return plain(persistedTasks.has(id) ? persistedTasks.get(id) : (tasks.get(id) || null));
        },
        getBlockKramdown: async () => documentKramdown,
        getFirstDirectChildIdOfDoc: async () => '',
    };
    context.__tmBackendAdapter = {
        setAttrs: async (id, patch) => {
            attrs.set(id, { ...(attrs.get(id) || {}), ...plain(patch) });
            return true;
        },
        flushTransaction: async () => {
            flushedHeadingCount += 1;
            return { code: 0, data: null };
        },
    };
    context.__tmRuntimeState = {
        getTaskById: (id) => tasks.get(id) || null,
        getFlatTaskById: (id) => tasks.get(id) || null,
    };
    context.__tmTaskBoundary = {
        getTask: (id) => tasks.get(id) || null,
    };
    context.__tmRequireTaskMutation = (method) => {
        assert.equal(method, 'enqueue');
        return (definition, options) => {
            queued.push(plain(definition));
            const result = Promise.resolve(opts.mutationResult || { ok: true });
            options?.onPending?.(result, definition);
            return options?.wait ? result : Promise.resolve(definition.id || 'queued');
        };
    };
    vm.runInContext(`${lifecycleSource}\nthis.lifecycleTest = {
        normalize: __tmNormalizeTaskLifecycleMeta,
        eligible: __tmCanArchiveCompletedTask,
        resolveHeading: __tmResolveCompletedHeadingPlacement,
        enqueue: __tmEnqueueTaskLifecycle,
        cleanup: __tmCleanupDeletedTaskRelations,
    };`, context);
    return {
        context,
        attrs,
        tasks,
        persistedTasks,
        moves,
        queued,
        reminderTaskIds,
        removedReminderIds,
        cleanupSteps,
        cleanupWarnings,
        setKramdown: (value) => { documentKramdown = value; },
        getAppendedHeadingCount: () => appendedHeadingCount,
        getFlushedHeadingCount: () => flushedHeadingCount,
        getTaskReadCount: () => taskReadCount,
    };
}

async function testMetadataAndRestoreComposition() {
    const harness = createHarness();
    const { context, attrs, tasks, moves, reminderTaskIds, removedReminderIds } = harness;
    const completed = { originDocId: 'doc-original', mode: 'document', archivedAt: 'earlier' };
    const normalized = context.lifecycleTest.normalize({
        v: 99,
        completed,
        recycle: {
            originDocId: 'doc-a',
            originParentTaskId: 'parent-a',
            archiveDocId: 'doc-recycle',
            archiveListId: 'list-recycle',
        },
    });
    assert.deepEqual(plain(normalized), {
        v: 1,
        completed,
        recycle: {
            originDocId: 'doc-a',
            originParentTaskId: 'parent-a',
            archivedAt: '',
            archiveDocId: 'doc-recycle',
            archiveListId: 'list-recycle',
        },
    });

    tasks.set('task-delete', { id: 'task-delete', root_id: 'doc-source', done: true, parent_task_id: '' });
    attrs.set('task-delete', {
        'custom-task-horizon-lifecycle': JSON.stringify({ v: 1, completed }),
    });
    reminderTaskIds.add('task-delete');
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
    assert.equal(stored.recycle.archiveDocId, 'doc-recycle');
    assert.equal(stored.recycle.archiveListId, 'archive-list-task-delete');
    assert.equal(moves.at(-1).targetDocId, 'doc-recycle');
    assert.equal(moves.at(-1).options.moveToRecycleDocument, true,
        'recycle must use the independent-list document move path');
    assert.deepEqual(removedReminderIds, ['task-delete'], 'recycling a task must clear its linked reminder');

    await context.__tmTaskLifecycle.execute({ action: 'restoreDeleted', taskId: 'task-delete' });
    stored = JSON.parse(attrs.get('task-delete')['custom-task-horizon-lifecycle']);
    assert.deepEqual(stored.completed, completed, 'restore delete must clear only the recycle branch');
    assert.equal(stored.recycle, undefined);
    assert.equal(moves.at(-1).targetDocId, 'doc-source');
    assert.equal(moves.at(-1).options.moveIndependentList, true,
        'restoring a recycled root task must move its saved outer list');
    assert.equal(moves.at(-1).options.sourceListId, 'archive-list-task-delete');

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
    assert.equal(archived.completed.archiveDocId, 'doc-source');
    assert.equal(moves.at(-1).options.heading.id, 'heading-existing');
    assert.equal(moves.at(-1).placement.parentID, 'doc-source');

    tasks.get('task-done').done = false;
    await context.__tmTaskLifecycle.execute({ action: 'restoreCompleted', taskId: 'task-done' });
    assert.equal(attrs.get('task-done')['custom-task-horizon-lifecycle'], '');
    assert.equal(moves.at(-1).targetDocId, 'doc-source');
    assert.equal(moves.at(-1).options.moveIndependentList, true,
        'restoring to the default document position must move the archived outer list');
    assert.equal(moves.at(-1).options.sourceDocumentId, 'doc-source');
}

async function testCompletionArchivesWhileSqlIndexLags() {
    const harness = createHarness();
    const { context, attrs, tasks, persistedTasks, moves } = harness;
    tasks.set('task-index-lag', {
        id: 'task-index-lag',
        root_id: 'doc-source',
        parent_id: 'list-source',
        parent_task_id: '',
        done: true,
    });
    persistedTasks.set('task-index-lag', {
        id: 'task-index-lag',
        root_id: 'doc-source',
        parent_id: 'list-source',
        parent_task_id: '',
        done: false,
    });
    harness.setKramdown('');

    await context.__tmTaskLifecycle.execute({
        action: 'archiveCompleted',
        taskId: 'task-index-lag',
        mode: 'heading',
        committedDone: true,
        originDocId: 'doc-source',
    });

    assert.equal(harness.getAppendedHeadingCount(), 1,
        'a committed local completion must create the missing heading while SQL still exposes the old marker');
    assert.equal(moves.at(-1).options.heading.id, 'heading-created');
    assert.equal(JSON.parse(attrs.get('task-index-lag')['custom-task-horizon-lifecycle']).completed.mode, 'heading');
}

async function testCompletionArchiveIdempotency() {
    const harness = createHarness();
    const { context, tasks, moves } = harness;
    tasks.set('task-dedupe', { id: 'task-dedupe', root_id: 'doc-source', parent_task_id: '', done: true });
    harness.setKramdown('### 已完成 {id="heading-existing"}');

    const first = await context.__tmTaskLifecycle.execute({
        action: 'archiveCompleted',
        taskId: 'task-dedupe',
        mode: 'heading',
        originDocId: 'doc-source',
    });
    const readsAfterFirst = harness.getTaskReadCount();
    tasks.delete('task-dedupe');
    const duplicate = await context.__tmTaskLifecycle.execute({
        action: 'archiveCompleted',
        taskId: 'task-dedupe',
        mode: 'heading',
        originDocId: 'doc-source',
    });

    assert.deepEqual(plain(duplicate), plain(first), 'a delayed duplicate completion must reuse the first archive result');
    assert.equal(moves.length, 1, 'a duplicate completion must move the task only once');
    assert.equal(harness.getTaskReadCount(), readsAfterFirst, 'a duplicate completion must not read a just-moved task again');

    const retryHarness = createHarness({ moveFailsOnce: true });
    retryHarness.tasks.set('task-retry', { id: 'task-retry', root_id: 'doc-source', parent_task_id: '', done: true });
    retryHarness.setKramdown('### 已完成 {id="heading-existing"}');
    await assert.rejects(
        retryHarness.context.__tmTaskLifecycle.execute({ action: 'archiveCompleted', taskId: 'task-retry', mode: 'heading' }),
        /move failed once/,
    );
    const retried = await retryHarness.context.__tmTaskLifecycle.execute({ action: 'archiveCompleted', taskId: 'task-retry', mode: 'heading' });
    assert.equal(retried.ok, true, 'a real first-attempt failure must remain retryable');
    assert.equal(retryHarness.moves.length, 1);
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

    const recycleSnapshot = { taskId: 'task-delete', task: { id: 'task-delete' }, docId: 'doc-source', index: 0 };
    await context.lifecycleTest.enqueue('archiveDeleted', 'task-delete', { originDocId: 'doc-source', snapshot: recycleSnapshot }, { wait: true });
    assert.deepEqual(queued[1].data.snapshot, recycleSnapshot, 'recycle mutations must retain the local snapshot used for optimistic rollback');
}

async function testRestoreResultContract() {
    const successHarness = createHarness();
    const restored = await successHarness.context.__tmTaskLifecycle.restoreDeleted('task-restore', { wait: true });
    assert.equal(restored.ok, true, 'a confirmed restore must resolve to the caller');

    const skippedHarness = createHarness({ mutationResult: { skipped: true, reason: 'pending-delete' } });
    await assert.rejects(
        skippedHarness.context.__tmTaskLifecycle.restoreDeleted('task-skipped', { wait: true }),
        /任务未恢复: pending-delete/,
        'a skipped restore must not be reported as a successful undo',
    );
}

async function testDeleteRelationCleanupIsolation() {
    const harness = createHarness({
        reminderCleanupFails: true,
        scheduleCleanupFails: true,
        whiteboardCleanupFails: true,
    });
    const { context, attrs, tasks, moves, cleanupSteps, cleanupWarnings } = harness;
    await context.lifecycleTest.cleanup(['task-isolated'], { source: 'contract-test' });
    assert.deepEqual(cleanupSteps, ['reminder', 'schedule', 'whiteboard'],
        'reminder, schedule, and whiteboard cleanup must run independently');
    assert.equal(cleanupWarnings.some((message) => message.includes('linked reminders')), true);
    assert.equal(cleanupWarnings.some((message) => message.includes('linked schedules')), true);
    assert.equal(cleanupWarnings.some((message) => message.includes('linked whiteboard')), true);

    cleanupSteps.length = 0;
    tasks.set('task-recycle-failures', { id: 'task-recycle-failures', root_id: 'doc-source', done: false, parent_task_id: '' });
    const result = await context.__tmTaskLifecycle.execute({
        action: 'archiveDeleted',
        taskId: 'task-recycle-failures',
        originDocId: 'doc-source',
        targetDocId: 'doc-recycle',
        scheduleCleanupTaskIds: ['task-recycle-failures'],
    });
    assert.equal(result.ok, true, 'relation cleanup failures must not roll back a committed recycle move');
    assert.equal(moves.at(-1).targetDocId, 'doc-recycle');
    assert.equal(JSON.parse(attrs.get('task-recycle-failures')['custom-task-horizon-lifecycle']).recycle.originDocId, 'doc-source');
    assert.deepEqual(cleanupSteps, ['reminder', 'schedule', 'whiteboard']);
}

async function testRecycleMoveFailureDoesNotCommitMetadata() {
    const harness = createHarness({ moveFailsOnce: true });
    const { context, attrs, tasks, cleanupSteps } = harness;
    tasks.set('task-recycle-move-failure', {
        id: 'task-recycle-move-failure',
        root_id: 'doc-source',
        done: false,
        parent_task_id: '',
    });
    await assert.rejects(
        context.__tmTaskLifecycle.execute({
            action: 'archiveDeleted',
            taskId: 'task-recycle-move-failure',
            originDocId: 'doc-source',
            targetDocId: 'doc-recycle',
            scheduleCleanupTaskIds: ['task-recycle-move-failure'],
        }),
        /move failed once/,
    );
    assert.equal(attrs.has('task-recycle-move-failure'), false,
        'a failed recycle move must not write lifecycle metadata');
    assert.deepEqual(cleanupSteps, [],
        'a failed recycle move must not run post-commit relation cleanup');
}

function testStaticContracts() {
    const headingMoveKernelSource = kernelSource.slice(
        kernelSource.indexOf('async function moveTaskIntoHeading'),
        kernelSource.indexOf('async function moveTaskIntoParent'),
    );
    assert.match(storeSource, /deleteTaskRemovesWhiteboardCards:\s*true/, 'whiteboard card cleanup must default to enabled');
    assert.match(storeSource, /tm_delete_task_removes_whiteboard_cards'[\s\S]*!== false/, 'missing persisted cleanup setting must remain enabled');
    assert.match(settingsSource, /deleteTaskRemovesWhiteboardCards !== false \? 'checked' : ''/, 'settings switch must render checked by default');
    for (const key of ['taskDeleteMode', 'taskRecycleDocId', 'taskCompletionArchiveMode', 'taskCompletionArchiveDocId']) {
        assert.match(storeSource, new RegExp(key), `${key} must be persisted`);
        assert.match(settingsSource, new RegExp(key), `${key} must be configurable`);
        assert.match(exportsSource, new RegExp(`'${key}'`), `${key} must be exported`);
    }
    assert.match(apiSource, /__TM_SIMPLE_MUTATION_TYPES[\s\S]*'taskLifecycle'/);
    assert.doesNotMatch(apiSource, /__TM_OP_OUTBOX_PERSISTABLE_TYPES|__tmPersistQueuedOp/);
    assert.match(apiSource, /if \(type === 'taskLifecycle'\)[\s\S]*lifecycle\.execute/);
    assert.match(apiSource, /function __tmCanMutationRunDuringPendingDelete[\s\S]*archiveDeleted'[\s\S]*restoreDeleted'/,
        'recycle and its inverse restore must be allowed through the pending-delete guard');
    assert.ok((apiSource.match(/__tmIsMutationTaskPendingDeleted\(primaryTaskId\)[\s\S]{0,120}!__tmCanMutationRunDuringPendingDelete\(op\)/g) || []).length >= 2,
        'ordinary task mutations must remain blocked while deletion is pending');
    assert.match(apiSource, /action === 'restoreDeleted'[\s\S]*result\?\.ok === true[\s\S]*__tmForgetPendingDeletedTaskIds/,
        'a confirmed restore must clear the optimistic delete watermark before publishing its commit');
    assert.match(apiSource, /if \(type === 'taskLifecycle'\)[\s\S]{0,240}action !== 'restoreDeleted'/,
        'only restore may optimistically project lifecycle state');
    assert.doesNotMatch(apiSource, /action !== 'archiveDeleted' && action !== 'restoreDeleted'/,
        'recycle must not delete its local projection before the kernel move commits');
    assert.match(apiSource, /type === 'taskLifecycle'[\s\S]*restoreDeleted'[\s\S]*data\.snapshot\.task/,
        'recycle undo must publish its saved snapshot through the shared optimistic mutation path');
    assert.match(runtimeStateSource, /normalized\.type === 'taskLifecycle'[\s\S]*restoreDeleted'[\s\S]*__tmRollbackDeleteOptimisticLocal/,
        'TaskStore must restore recycle snapshots through its existing local tree transaction');
    assert.match(lifecycleSource, /async function __tmClearDeletedTaskReminders[\s\S]*reminderApi\.remove[\s\S]*patch: \{ reminder: null \}/,
        'delete relation cleanup must clear reminders through Dock Tomato with a kernel fallback');
    assert.doesNotMatch(`${lifecycleSource}\n${listSource}`, /strictRelationCleanup|strict:\s*true/,
        'committed delete and recycle paths must not turn best-effort relation cleanup into a structural failure');
    assert.doesNotMatch(apiSource, /relationsCleaned/,
        'the permanent-delete queue must not claim that every relation cleanup succeeded');
    assert.match(listSource, /restoreDeleted\(tid,[\s\S]*snapshot,[\s\S]*scheduleCleanupTaskIds/,
        'single-task undo must retain the deleted subtree snapshot');
    assert.match(dialogsSource, /recycledJobs[\s\S]*restoreDeleted\(item\.id,[\s\S]*snapshot: item\.snapshot/,
        'batch undo must retain each deleted subtree snapshot');
    assert.match(runtimeStateSource, /normalized\.type === 'taskLifecycle'[\s\S]*archiveDeleted'[\s\S]*deleteTaskLocal/, 'TaskStore must reuse the normal local delete implementation for recycle');
    assert.match(apiSource, /type === 'taskLifecycle'[\s\S]*applyLocal: action === 'archiveDeleted'/,
        'recycle must remove its local projection only during commit');
    assert.match(runtimeStateSource, /normalized\.phase === 'commit'\) settleTaskOverlay\(normalized, true\)/,
        'lifecycle commit must settle its pending TaskStore overlay');
    assert.match(runtimeStateSource, /normalized\.phase === 'commit'[\s\S]*scheduleMutationSnapshotRefresh\(normalized,[\s\S]*structural: changeSet\.structural/,
        'lifecycle snapshot reconciliation must remain asynchronous until kernel commit');
    assert.match(apiSource, /if \(key === 'taskLifecycle'\) return '任务归档'/);
    assert.match(listSource, /__tmRunSetDonePostCommitEffects[\s\S]*__tmTaskLifecycle\?\.notifyCompletion/);
    assert.match(listSource, /__tmRunCommittedSetDoneEffects[\s\S]*type: 'taskLifecycle'[\s\S]*archiveCompleted/,
        'committed completion must enqueue lifecycle work through the shared mutation lane');
    assert.match(listSource, /action: 'archiveCompleted'[\s\S]*committedDone: true/,
        'the completion receipt must survive SQL marker indexing lag');
    assert.doesNotMatch(`${lifecycleSource}\n${listSource}`, /prepareMalformedCompletionPlacement/,
        'completion must not run a hidden malformed-placement self-healing move');
    assert.match(lifecycleSource, /__tmAppendBlockOnce[\s\S]*__tmBackendAdapter\.flushTransaction/,
        'a newly created completed heading must be flushed before it is used as a move target');
    assert.match(apiSource, /async function __tmMoveTaskToPlacement[\s\S]*mode: 'heading'[\s\S]*__tmExecuteQueuedMoveKernel\(null, moveData\)/,
        'completion archive must reuse the same heading move executor as the heading-group action');
    assert.match(lifecycleSource, /__tmRestoreCompletedTask[\s\S]*moveIndependentList: !destination\.heading/,
        'completion restore must select list-level movement outside configured heading groups');
    assert.match(apiSource, /moveIndependentList[\s\S]*mode: 'document-list'[\s\S]*__tmExecuteQueuedMoveKernel\(null, moveData\)/,
        'completion restore must reach the authoritative document-list kernel path');
    assert.match(kernelSource, /moveIndependentTaskListToDocument[\s\S]*movePayload = \{ id: sourceList\.id, parentID: targetDocumentID \}/,
        'document restore must move the independent outer list instead of its task item');
    assert.match(kernelSource, /moveTaskIntoIndependentDocument[\s\S]*await api\('\/api\/block\/moveBlock', \{ id: listID, parentID: targetDocumentID \}\)/,
        'recycle must move an independent outer list into the recycle document');
    assert.match(kernelSource, /moveTaskIntoIndependentDocument[\s\S]*documentChildIDs\[0\] !== listID[\s\S]*verifiedTaskIDs\.length !== 1/,
        'recycle must verify the live document tree before reporting success');
    assert.match(apiSource, /moveToRecycleDocument[\s\S]*mode: 'recycle-document'/,
        'the lifecycle bridge must reach the recycle-specific kernel move path');
    assert.match(lifecycleSource, /__tmArchiveDeletedTask[\s\S]*moveToRecycleDocument: true[\s\S]*__tmWriteTaskLifecycleMeta/,
        'recycle metadata must be written only after the independent-list move succeeds');
    assert.match(kernelSource, /normalizeTaskMoveMode\(source\.mode\) === 'document-list'[\s\S]*const before = await capturePlacement\(taskID\)/,
        'document-list restore must bypass SQL placement reads before moving the archived list');
    assert.match(headingMoveKernelSource, /canMoveSourceList[\s\S]*movePayload = \{ id: listID, previousID: hid, parentID: heading\.parentID \}/,
        'heading moves must move an independent source list rather than attach a list item to the document');
    assert.doesNotMatch(headingMoveKernelSource, /existingList|sectionRows|sectionBlocks/,
        'heading moves must not scan for or join an existing target task list');
    assert.match(headingMoveKernelSource, /documentChildren[\s\S]*documentChildIDs\[headingIndex \+ 1\] !== listID/,
        'heading moves must verify the actual document tree after SiYuan accepts the request');
    assert.match(lifecycleSource, /__tmTaskCompletionArchiveRequests[\s\S]*__TM_TASK_COMPLETION_ARCHIVE_DEDUPE_MS/,
        'completion archive must coalesce delayed duplicate lifecycle events');
    assert.doesNotMatch(apiSource, /async function __tmMoveTaskToPlacement[\s\S]{0,1800}requestedListID\s*=\s*__tmCreateQueuedMoveScaffoldId/,
        'completion archive must not pre-generate a separate heading list ID');
    assert.doesNotMatch(apiSource, /async function __tmApplyTaskStatus\(/,
        'status changes must not retain a second lifecycle-triggering writer');
    assert.match(nativeSource, /async function __tmSyncNativeDocCheckboxLinkedStatus[\s\S]*userInitiatedCheckboxChange && wasDoneBefore !== !!domDone[\s\S]*__tmTaskLifecycle\?\.notifyCompletion/,
        'only a user-initiated native document checkbox change may enqueue lifecycle work');
    assert.equal((nativeSource.match(/userInitiatedCheckboxChange && wasDoneBefore !== !!domDone/g) || []).length, 2,
        'both native checkbox persistence branches must suppress programmatic completion echoes');
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
    assert.equal(manifest.scripts.includes('main/task-runtime/55-task-move-writer.js'), false);
    assert.ok(manifest.scripts.indexOf('main/task-runtime/56-task-lifecycle-runtime.js') > manifest.scripts.indexOf('main/20-api-and-runtime-services.js'));
}

(async () => {
    await testMetadataAndRestoreComposition();
    await testCompletionEligibilityAndRaceValidation();
    await testCompletionArchivesWhileSqlIndexLags();
    await testCompletionArchiveIdempotency();
    await testHeadingLockAndQueueLane();
    await testRestoreResultContract();
    await testDeleteRelationCleanupIsolation();
    await testRecycleMoveFailureDoesNotCommitMetadata();
    testStaticContracts();
    console.log('task lifecycle contract tests passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
