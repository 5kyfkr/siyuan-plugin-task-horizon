(function () {
    const __TM_RUNTIME_STATE_DEFAULT_MODAL = Symbol('tm-runtime-state-default-modal');

    // Runtime facade: view/session state only. Task data changes belong to taskStore below.
    const normalizeId = (value) => String(value || '').trim();
    const pendingStructuralMutations = new Map();
    const confirmedTaskBase = new Map();
    const pendingTaskOverlays = new Map();
    const pendingOverlayKeysByTask = new Map();
    const taskStoreDocRevisions = new Map();
    let taskStoreRevision = 0;
    let taskStoreUnscopedRevision = 0;
    const TASK_STORE_STRUCTURAL_COMMIT_TYPES = new Set([
        'createTaskInDoc',
        'createSubtask',
        'createSibling',
        'deleteTask',
        'moveTask',
        'commitTaskId',
        'taskLifecycle',
    ]);
    const TASK_STORE_FIELD_MUTATION_TYPES = new Set([
        'contentPatch',
        'taskPatch',
        'setDone',
    ]);

    const taskOverlayKey = (mutation = {}) => normalizeId(
        mutation.opId
        || mutation.commandID
        || mutation.commandId
        || mutation.mutationId
        || mutation.id
    );

    const isTaskStoreDeleteMutation = (mutation = {}) => {
        const type = normalizeId(mutation?.type);
        return type === 'deleteTask'
            || (type === 'taskLifecycle' && normalizeId(mutation?.data?.action) === 'archiveDeleted');
    };

    const collectDeletedTaskIds = (mutation = {}) => {
        if (!isTaskStoreDeleteMutation(mutation)) return [];
        const m = mutation && typeof mutation === 'object' ? mutation : {};
        const data = m.data && typeof m.data === 'object' ? m.data : {};
        const affected = m.affected && typeof m.affected === 'object' ? m.affected : {};
        return Array.from(new Set([
            m.taskId,
            m.tempId,
            m.realId,
            data.taskId,
            ...(Array.isArray(affected.subtreeIds) ? affected.subtreeIds : []),
            ...(Array.isArray(data.scheduleCleanupTaskIds) ? data.scheduleCleanupTaskIds : []),
        ].map(normalizeId).filter(Boolean)));
    };

    const collectOverlayTaskIds = (mutation = {}) => {
        const m = mutation && typeof mutation === 'object' ? mutation : {};
        const data = m.data && typeof m.data === 'object' ? m.data : {};
        const affected = m.affected && typeof m.affected === 'object' ? m.affected : {};
        const fieldOnly = TASK_STORE_FIELD_MUTATION_TYPES.has(normalizeId(m.type));
        return Array.from(new Set([
            m.taskId,
            m.tempId,
            m.realId,
            data.taskId,
            data.tempId,
            data.realId,
            data.sourceTaskId,
            m.task?.id,
            ...(!fieldOnly && Array.isArray(m.taskIds) ? m.taskIds : []),
            ...(!fieldOnly && Array.isArray(affected.taskIds) ? affected.taskIds : []),
            ...(Array.isArray(affected.aliases) ? affected.aliases : []),
        ].map(normalizeId).filter(Boolean)));
    };

    const collectMutationDocIds = (mutation = {}, taskIds = []) => {
        const m = mutation && typeof mutation === 'object' ? mutation : {};
        const data = m.data && typeof m.data === 'object' ? m.data : {};
        const affected = m.affected && typeof m.affected === 'object' ? m.affected : {};
        const out = new Set([
            m.docId,
            m.previousDocId,
            m.nextDocId,
            data.docId,
            data.targetDocId,
            data.sourceDocId,
            data.previousDocId,
            data.nextDocId,
            m.task?.root_id,
            m.task?.docId,
            m.snapshot?.docId,
            m.snapshot?.task?.root_id,
            m.snapshot?.task?.docId,
            ...(Array.isArray(affected.docIds) ? affected.docIds : []),
        ].map(normalizeId).filter(Boolean));
        (Array.isArray(taskIds) ? taskIds : []).forEach((taskId) => {
            const tid = normalizeId(taskId);
            if (!tid) return;
            const task = confirmedTaskBase.get(tid)
                || state?.flatTasks?.[tid]
                || state?.pendingInsertedTasks?.[tid]
                || null;
            const docId = normalizeId(task?.root_id || task?.docId);
            if (docId) out.add(docId);
        });
        return Array.from(out);
    };

    const bumpTaskStoreRevision = (docIds = []) => {
        taskStoreRevision += 1;
        const normalizedDocIds = Array.from(new Set((Array.isArray(docIds) ? docIds : [docIds])
            .map(normalizeId)
            .filter(Boolean)));
        if (normalizedDocIds.length) {
            normalizedDocIds.forEach((docId) => taskStoreDocRevisions.set(docId, taskStoreRevision));
        } else {
            taskStoreUnscopedRevision = taskStoreRevision;
        }
        return taskStoreRevision;
    };

    const captureTaskStoreRead = (docIds = []) => {
        const normalizedDocIds = Array.from(new Set((Array.isArray(docIds) ? docIds : [docIds]).map(normalizeId).filter(Boolean)));
        return {
            revision: taskStoreRevision,
            unscopedRevision: taskStoreUnscopedRevision,
            docIds: normalizedDocIds,
            docRevisions: Object.fromEntries(normalizedDocIds.map((docId) => [docId, Number(taskStoreDocRevisions.get(docId)) || 0])),
        };
    };

    const isTaskStoreReadCurrent = (token) => {
        if (!token || typeof token !== 'object') return false;
        const docIds = Array.isArray(token.docIds) ? token.docIds.map(normalizeId).filter(Boolean) : [];
        if (!docIds.length) return Math.max(0, Number(token.revision) || 0) === taskStoreRevision;
        if (Math.max(0, Number(token.unscopedRevision) || 0) !== taskStoreUnscopedRevision) return false;
        const revisions = token.docRevisions && typeof token.docRevisions === 'object' ? token.docRevisions : {};
        return docIds.every((docId) => (
            (Math.max(0, Number(revisions[docId]) || 0)) === (Number(taskStoreDocRevisions.get(docId)) || 0)
        ));
    };

    const cloneTaskRecord = (task) => {
        if (!(task && typeof task === 'object')) return null;
        return {
            ...task,
            ...(task.customFieldValues && typeof task.customFieldValues === 'object'
                ? { customFieldValues: { ...task.customFieldValues } }
                : {}),
            ...(Array.isArray(task.children) ? { children: task.children.slice() } : {}),
        };
    };

    const applyTaskStoreAttachmentPatch = (task, value) => {
        if (!(task && typeof task === 'object')) return false;
        try {
            if (typeof __tmApplyTaskAttachmentPathsToTask === 'function') {
                __tmApplyTaskAttachmentPathsToTask(task, value, { attrsLoaded: true });
                return true;
            }
        } catch (e) {}
        const paths = Array.from(new Set((Array.isArray(value) ? value : [])
            .map((item) => String((item && typeof item === 'object') ? (item.path || item.url || item.href || '') : (item || '')).trim())
            .filter(Boolean)));
        task.__attachmentPaths = paths;
        task.attachments = paths.slice();
        task.attachmentCount = paths.length;
        task.__attachmentAttrSlotCount = paths.length;
        task.__attachmentAttrsLoaded = true;
        task.attachmentAttrsLoaded = true;
        task.attachment_attrs_loaded = true;
        return true;
    };

    const mergeConfirmedTaskReceipt = (current, receipt, committedPatch = {}, options = {}) => {
        const base = cloneTaskRecord(current);
        const incoming = cloneTaskRecord(receipt);
        if (!incoming) return base ? applyOverlayPatch(base, committedPatch) : null;
        const patchedBase = applyOverlayPatch(base || {}, committedPatch);
        const merged = { ...patchedBase, ...incoming };
        if (patchedBase.customFieldValues || incoming.customFieldValues) {
            merged.customFieldValues = {
                ...(patchedBase.customFieldValues || {}),
                ...(incoming.customFieldValues || {}),
            };
        }
        if (options?.preserveStructure !== false && Array.isArray(base?.children)) {
            merged.children = base.children.slice();
        }
        return cloneTaskRecord(merged);
    };

    const applyOverlayPatch = (task, patch = {}) => {
        if (!(task && typeof task === 'object')) return task;
        const nextPatch = patch && typeof patch === 'object' ? patch : {};
        Object.entries(nextPatch).forEach(([key, value]) => {
            if (key === 'customFieldValues' && value && typeof value === 'object') {
                task.customFieldValues = { ...(task.customFieldValues || {}), ...value };
                return;
            }
            if (key === 'attachments') {
                applyTaskStoreAttachmentPatch(task, value);
                return;
            }
            task[key] = value;
            if (key === 'content' || key === 'title') {
                const title = String(value == null ? '' : value).trim();
                task.content = title;
                task.title = title;
                task.raw_content = title;
                task.rawContent = title;
            } else if (key === 'priority') task.custom_priority = value;
            else if (key === 'customStatus') task.custom_status = value;
            else if (key === 'startDate') task.start_date = value;
            else if (key === 'completionTime') task.completion_time = value;
            else if (key === 'duration') task.custom_duration = value;
            else if (key === 'remark') task.custom_remark = value;
            else if (key === 'taskDateColor') task.task_date_color = value;
            else if (key === 'customTime') task.custom_time = value;
            else if (key === 'taskCompleteAt') task.task_complete_at = value;
            else if (key === 'pinned') task.custom_pinned = value ? '1' : '';
            else if (key === 'allDayBottom') task.custom_all_day_bottom = value ? '1' : '';
        });
        return task;
    };

    const taskStorePatchAffectsPriorityScore = (patch = {}) => {
        try {
            return typeof __tmDoesPatchAffectPriorityScore === 'function'
                && __tmDoesPatchAffectPriorityScore(patch) === true;
        } catch (e) {
            return false;
        }
    };

    const syncTaskStorePriorityScore = (task, shouldSync = false) => {
        if (!(task && typeof task === 'object') || shouldSync !== true) return task;
        try {
            if (typeof __tmEnsureTaskPriorityScore === 'function') {
                const score = Number(__tmEnsureTaskPriorityScore(task, { force: true }));
                if (Number.isFinite(score)) task.priorityScore = score;
            }
        } catch (e) {}
        return task;
    };

    const projectTaskFromBase = (taskId, fallback = null) => {
        const tid = normalizeId(taskId || fallback?.id);
        if (!tid) return null;
        try {
            if (isPendingDeletedTaskId(tid)) return null;
        } catch (e) {}
        let projected = cloneTaskRecord(confirmedTaskBase.get(tid) || fallback);
        let priorityScoreDirty = false;
        const overlayKeys = pendingOverlayKeysByTask.get(tid);
        for (const overlayKey of (overlayKeys instanceof Set ? overlayKeys : [])) {
            const overlay = pendingTaskOverlays.get(overlayKey);
            if (!overlay) continue;
            if (isTaskStoreDeleteMutation(overlay)
                && (Array.isArray(overlay.deletedTaskIds) ? overlay.deletedTaskIds : []).includes(tid)) {
                projected = null;
                continue;
            }
            if (!projected && overlay.task && typeof overlay.task === 'object') projected = cloneTaskRecord(overlay.task);
            if (!projected) continue;
            applyOverlayPatch(projected, overlay.patch);
            priorityScoreDirty = taskStorePatchAffectsPriorityScore(overlay.patch) || priorityScoreDirty;
        }
        return syncTaskStorePriorityScore(projected, priorityScoreDirty);
    };

    const projectTaskRead = (task) => {
        const source = cloneTaskRecord(task);
        const tid = normalizeId(source?.id);
        if (!source || !tid) return source;
        try {
            if (isPendingDeletedTaskId(tid)) return null;
        } catch (e) {}
        let projected = source;
        let priorityScoreDirty = false;
        const overlayKeys = pendingOverlayKeysByTask.get(tid);
        for (const overlayKey of (overlayKeys instanceof Set ? overlayKeys : [])) {
            const overlay = pendingTaskOverlays.get(overlayKey);
            if (!overlay) continue;
            if (isTaskStoreDeleteMutation(overlay)
                && (Array.isArray(overlay.deletedTaskIds) ? overlay.deletedTaskIds : []).includes(tid)) return null;
            applyOverlayPatch(projected, overlay.patch);
            priorityScoreDirty = taskStorePatchAffectsPriorityScore(overlay.patch) || priorityScoreDirty;
        }
        return syncTaskStorePriorityScore(projected, priorityScoreDirty);
    };

    const beginTaskOverlay = (mutation = {}) => {
        const key = taskOverlayKey(mutation);
        if (!key) return false;
        const taskIds = collectOverlayTaskIds(mutation);
        pendingTaskOverlays.set(key, {
            key,
            type: normalizeId(mutation.type),
            taskIds,
            deletedTaskIds: collectDeletedTaskIds(mutation),
            patch: mutation.patch && typeof mutation.patch === 'object' ? { ...mutation.patch } : {},
            task: cloneTaskRecord(mutation.task),
            data: mutation.data && typeof mutation.data === 'object' ? { ...mutation.data } : {},
        });
        taskIds.forEach((taskId) => {
            const tid = normalizeId(taskId);
            if (!tid) return;
            const keys = pendingOverlayKeysByTask.get(tid) || new Set();
            keys.add(key);
            pendingOverlayKeysByTask.set(tid, keys);
        });
        bumpTaskStoreRevision(collectMutationDocIds(mutation, taskIds));
        return true;
    };

    const hasPendingCompletionOverlay = (taskId) => {
        const tid = normalizeId(taskId);
        if (!tid) return false;
        const overlayKeys = pendingOverlayKeysByTask.get(tid);
        for (const overlayKey of (overlayKeys instanceof Set ? overlayKeys : [])) {
            const patch = pendingTaskOverlays.get(overlayKey)?.patch;
            if (!(patch && typeof patch === 'object')) continue;
            if (['done', 'taskMarker', 'task_marker', 'customStatus', 'taskCompleteAt']
                .some((key) => Object.prototype.hasOwnProperty.call(patch, key))) return true;
        }
        return false;
    };

    const isNativeDocumentCompletionWatermark = (watermark) => {
        const source = normalizeId(watermark?.source).toLowerCase();
        return source === 'native-document'
            || source.startsWith('native-document-')
            || source === 'native-doc-checkbox'
            || source.startsWith('native-doc-checkbox-');
    };

    const reconcileLegacyDoneOverride = (taskId, projectedTask) => {
        const tid = normalizeId(taskId);
        const overrides = state?.doneOverrides;
        if (!tid || !(overrides && typeof overrides === 'object')
            || !Object.prototype.hasOwnProperty.call(overrides, tid)) return false;
        if (hasPendingCompletionOverlay(tid) && projectedTask && typeof projectedTask === 'object') {
            overrides[tid] = projectedTask.done === true;
        } else {
            delete overrides[tid];
        }
        return true;
    };

    const settleTaskOverlay = (mutation = {}, committed = false) => {
        const key = taskOverlayKey(mutation);
        const overlay = key ? pendingTaskOverlays.get(key) : null;
        const taskIds = Array.from(new Set([
            ...(Array.isArray(overlay?.taskIds) ? overlay.taskIds : []),
            ...collectOverlayTaskIds(mutation),
        ].map(normalizeId).filter(Boolean)));
        const deletedTaskIds = new Set([
            ...(Array.isArray(overlay?.deletedTaskIds) ? overlay.deletedTaskIds : []),
            ...collectDeletedTaskIds(mutation),
        ].map(normalizeId).filter(Boolean));
        const structuralCommit = TASK_STORE_STRUCTURAL_COMMIT_TYPES.has(normalizeId(mutation.type));
        const committedPatch = overlay?.patch || mutation.patch || {};
        const priorityScoreDirty = taskStorePatchAffectsPriorityScore(committedPatch);
        const pruneDeletedReferences = (items) => {
            if (!Array.isArray(items) || deletedTaskIds.size === 0) return false;
            let changed = false;
            for (let index = items.length - 1; index >= 0; index -= 1) {
                const item = items[index];
                const itemId = normalizeId(item?.id || item?.blockId);
                if (itemId && deletedTaskIds.has(itemId)) {
                    items.splice(index, 1);
                    changed = true;
                    continue;
                }
                if (pruneDeletedReferences(item?.children)) changed = true;
            }
            return changed;
        };
        if (committed) {
            const authoritative = mutation.task && typeof mutation.task === 'object' ? mutation.task : null;
            if (authoritative?.id) {
                const authoritativeId = normalizeId(authoritative.id);
                const current = confirmedTaskBase.get(authoritativeId)
                    || state?.flatTasks?.[authoritativeId]
                    || state?.pendingInsertedTasks?.[authoritativeId]
                    || overlay?.task
                    || null;
                const mergedReceipt = mergeConfirmedTaskReceipt(
                    current,
                    authoritative,
                    committedPatch,
                    { preserveStructure: !structuralCommit },
                );
                const confirmed = normalizeId(mutation.type) === 'setDone'
                    ? applyOverlayPatch(mergedReceipt, committedPatch)
                    : mergedReceipt;
                confirmedTaskBase.set(authoritativeId, syncTaskStorePriorityScore(confirmed, priorityScoreDirty));
            }
            taskIds.forEach((taskId) => {
                const tid = normalizeId(taskId);
                if (!tid) return;
                if (deletedTaskIds.has(tid)) confirmedTaskBase.delete(tid);
                else if (!authoritative || normalizeId(authoritative.id) !== tid) {
                    const current = cloneTaskRecord(
                        (structuralCommit ? state?.flatTasks?.[tid] : confirmedTaskBase.get(tid))
                        || (structuralCommit ? state?.pendingInsertedTasks?.[tid] : state?.flatTasks?.[tid])
                        || confirmedTaskBase.get(tid)
                        || state?.pendingInsertedTasks?.[tid]
                        || null
                    );
                    if (current) {
                        const confirmed = applyOverlayPatch(current, committedPatch);
                        confirmedTaskBase.set(tid, syncTaskStorePriorityScore(confirmed, priorityScoreDirty));
                    }
                }
            });
            // Structural promotion above may read a stale mounted parent. Apply
            // the deletion once more so its children cannot be reintroduced.
            if (deletedTaskIds.size > 0) {
                confirmedTaskBase.forEach((task, taskId) => {
                    if (deletedTaskIds.has(normalizeId(taskId))) {
                        confirmedTaskBase.delete(taskId);
                        return;
                    }
                    pruneDeletedReferences(task?.children);
                });
            }
        }
        if (key) {
            pendingTaskOverlays.delete(key);
            (Array.isArray(overlay?.taskIds) ? overlay.taskIds : []).forEach((taskId) => {
                const tid = normalizeId(taskId);
                const keys = pendingOverlayKeysByTask.get(tid);
                if (!(keys instanceof Set)) return;
                keys.delete(key);
                if (!keys.size) pendingOverlayKeysByTask.delete(tid);
            });
        }
        taskIds.forEach((taskId) => {
            const tid = normalizeId(taskId);
            if (!tid) return;
            const fallback = state?.flatTasks?.[tid] || state?.pendingInsertedTasks?.[tid] || null;
            const projected = projectTaskFromBase(tid, fallback);
            if (projected) {
                upsertTaskLocal(projected, {
                    pending: !!state?.pendingInsertedTasks?.[tid],
                    status: committed ? 'committed' : 'rolled-back',
                    replaceStructure: structuralCommit,
                });
            } else if (committed && deletedTaskIds.has(tid)) {
                removeTaskLocal(tid, { recalc: false, filter: false });
            }
            reconcileLegacyDoneOverride(tid, projected);
        });
        bumpTaskStoreRevision(collectMutationDocIds(mutation, taskIds));
        return true;
    };

    const prunePendingStructuralMutations = () => {
        const now = Date.now();
        pendingStructuralMutations.forEach((entry, taskId) => {
            if (!entry || Number(entry.expiresAt || 0) <= now) pendingStructuralMutations.delete(taskId);
        });
        return pendingStructuralMutations;
    };

    const getExpectedMoveParentTaskId = (data = {}) => {
        const mode = normalizeId(data.mode);
        if (mode === 'child' || mode === 'child-top') return normalizeId(data.targetTaskId);
        if (mode === 'before' || mode === 'after') {
            const explicit = normalizeId(data.targetParentTaskId);
            if (explicit) return explicit;
            const targetId = normalizeId(data.targetTaskId);
            try {
                const target = targetId ? getTaskById(targetId, { includePending: true, preferPending: true }) : null;
                return normalizeId(target?.parentTaskId || target?.parent_task_id);
            } catch (e) {}
        }
        return '';
    };

    const getExpectedMoveNeighbors = (data = {}) => {
        const mode = normalizeId(data.mode);
        const targetId = normalizeId(data.targetTaskId);
        const previous = mode === 'before'
            ? normalizeId(data.prevSiblingTaskId)
            : (mode === 'after'
                ? targetId
                : (mode === 'child' ? normalizeId(data.targetLastDirectChildId) : ''));
        const next = mode === 'before'
            ? targetId
            : (mode === 'child-top' ? normalizeId(data.targetFirstDirectChildId) : '');
        return { previous, next };
    };

    const rememberPendingStructuralMutation = (mutation = {}) => {
        const m = (mutation && typeof mutation === 'object') ? mutation : {};
        const data = (m.data && typeof m.data === 'object') ? m.data : {};
        const type = normalizeId(m.type);
        const phase = normalizeId(m.phase);
        const createType = type === 'createTaskInDoc' || type === 'createSubtask' || type === 'createSibling';

        // A create is still structurally pending after the kernel transaction
        // succeeds: the SQL task index/WS refresh can observe the old tree for
        // a short period. Keep the local row in incremental reads until the
        // real block is visible at the expected document/parent.
        if (type === 'commitTaskId') {
            const fromId = normalizeId(m.tempId || data.tempId);
            const toId = normalizeId(m.realId || m.blockId || data.realId || m.taskId || data.taskId);
            const existing = pendingStructuralMutations.get(fromId) || pendingStructuralMutations.get(toId);
            if (!existing) return null;
            if (phase === 'rollback' || phase === 'failed') {
                pendingStructuralMutations.delete(fromId);
                pendingStructuralMutations.delete(toId);
                return null;
            }
            if (toId && fromId && fromId !== toId) pendingStructuralMutations.delete(fromId);
            const now = Date.now();
            const entry = {
                ...existing,
                taskId: toId || existing.taskId,
                aliases: Array.from(new Set((Array.isArray(existing.aliases) ? existing.aliases : [])
                    .concat([fromId, toId].filter(Boolean)))),
                opId: normalizeId(m.opId || data.opId || existing.opId),
                phase: phase || 'commit',
                updatedAt: now,
                expiresAt: now + 45000,
            };
            pendingStructuralMutations.set(entry.taskId, entry);
            return entry;
        }

        const taskId = normalizeId(m.taskId || data.taskId || m.tempId || data.tempId || m.realId || data.realId);
        if (!taskId || (!createType && type !== 'moveTask')) return null;
        if (phase === 'rollback' || phase === 'failed') {
            const aliases = new Set([taskId, ...(pendingStructuralMutations.get(taskId)?.aliases || [])]);
            aliases.forEach((id) => pendingStructuralMutations.delete(id));
            return null;
        }
        if (phase !== 'optimistic' && phase !== 'commit') return pendingStructuralMutations.get(taskId) || null;

        const snapshot = (m.snapshot && typeof m.snapshot === 'object')
            ? m.snapshot
            : ((data.snapshot && typeof data.snapshot === 'object') ? data.snapshot : {});
        const previous = pendingStructuralMutations.get(taskId) || {};
        const localTask = (m.task && typeof m.task === 'object') ? m.task : {};
        const expectedDocId = normalizeId(
            m.nextDocId || m.docId || data.targetDocId || data.docId
            || localTask.docId || localTask.root_id || previous.expectedDocId
        );
        const previousDocId = normalizeId(m.previousDocId || snapshot.docId || previous.previousDocId);
        const moveParent = getExpectedMoveParentTaskId(data);
        const expectedParentTaskId = normalizeId(
            createType
                ? (m.parentTaskId || data.parentTaskId || localTask.parentTaskId || localTask.parent_task_id || previous.expectedParentTaskId)
                : moveParent
        );
        const hasExpectedParent = createType
            ? type !== 'createTaskInDoc' && !!expectedParentTaskId
            : ['child', 'child-top', 'before', 'after'].includes(normalizeId(data.mode));
        const neighbors = getExpectedMoveNeighbors(data);
        const now = Date.now();
        const entry = {
            ...previous,
            taskId,
            aliases: Array.from(new Set((Array.isArray(previous.aliases) ? previous.aliases : []).concat(taskId))),
            opId: normalizeId(m.opId || data.opId || previous.opId),
            type,
            phase,
            mode: normalizeId(data.mode),
            expectedDocId,
            previousDocId,
            expectedParentTaskId,
            hasExpectedParent,
            expectedPreviousSiblingId: neighbors.previous,
            expectedNextSiblingId: neighbors.next,
            targetTaskId: normalizeId(data.targetTaskId),
            updatedAt: now,
            expiresAt: now + (createType ? 45000 : 20000),
        };
        pendingStructuralMutations.set(taskId, entry);
        return entry;
    };

    const mergePendingStructuralRows = (rows, options = {}) => {
        const sourceRows = Array.isArray(rows) ? rows.slice() : [];
        const opts = (options && typeof options === 'object') ? options : {};
        const docIds = new Set((Array.isArray(opts.docIds) ? opts.docIds : [])
            .map((id) => normalizeId(id))
            .filter(Boolean));
        const pending = prunePendingStructuralMutations();
        if (!pending.size) return sourceRows;
        const byId = new Map(sourceRows.map((row, index) => [normalizeId(row?.id), { row, index }]).filter(([id]) => !!id));
        const getRowOrder = (row) => {
            const seq = Number(row?.doc_seq ?? row?.docSeq);
            if (Number.isFinite(seq)) return seq;
            const path = normalizeId(row?.block_path || row?.blockPath);
            const sort = Number(row?.block_sort ?? row?.blockSort);
            return `${path}|${Number.isFinite(sort) ? sort : ''}|${normalizeId(row?.created)}`;
        };
        const siblingNeighbors = new Map();
        const siblingGroups = new Map();
        sourceRows.forEach((row) => {
            const parent = normalizeId(row?.parent_task_id || row?.parentTaskId);
            const doc = normalizeId(row?.root_id || row?.docId);
            const key = `${doc}|${parent}`;
            if (!siblingGroups.has(key)) siblingGroups.set(key, []);
            siblingGroups.get(key).push(row);
        });
        siblingGroups.forEach((group) => {
            group.sort((a, b) => {
                const av = getRowOrder(a);
                const bv = getRowOrder(b);
                if (typeof av === 'number' && typeof bv === 'number') return av - bv;
                return String(av).localeCompare(String(bv));
            });
            group.forEach((row, index) => siblingNeighbors.set(normalizeId(row?.id), {
                previous: normalizeId(group[index - 1]?.id),
                next: normalizeId(group[index + 1]?.id),
            }));
        });
        const removedIndexes = new Set();
        pending.forEach((entry, taskId) => {
            if (!entry || !['moveTask', 'createTaskInDoc', 'createSubtask', 'createSibling'].includes(entry.type)) return;
            if (docIds.size && !docIds.has(entry.expectedDocId) && !docIds.has(entry.previousDocId)) return;
            const found = byId.get(taskId) || null;
            const row = found?.row || null;
            const actualDocId = normalizeId(row?.root_id || row?.docId);
            const actualParentTaskId = normalizeId(row?.parent_task_id || row?.parentTaskId);
            const docMatches = !entry.expectedDocId || actualDocId === entry.expectedDocId;
            const parentMatches = !entry.hasExpectedParent || actualParentTaskId === entry.expectedParentTaskId;
            const neighbors = siblingNeighbors.get(taskId) || {};
            const previousMatches = !entry.expectedPreviousSiblingId
                || neighbors.previous === entry.expectedPreviousSiblingId;
            const nextMatches = !entry.expectedNextSiblingId
                || neighbors.next === entry.expectedNextSiblingId;
            if (row && docMatches && parentMatches && previousMatches && nextMatches) {
                pendingStructuralMutations.delete(taskId);
                return;
            }
            if (row && entry.previousDocId && entry.expectedDocId
                && entry.previousDocId !== entry.expectedDocId
                && actualDocId === entry.previousDocId) {
                removedIndexes.add(found.index);
            }
            if (row && entry.type !== 'moveTask' && !docMatches) removedIndexes.add(found.index);
            if (row && entry.type !== 'moveTask' && !parentMatches) removedIndexes.add(found.index);
            if (entry.expectedDocId && (!docIds.size || docIds.has(entry.expectedDocId))) {
                const local = getTaskById(taskId, { includePending: true, preferPending: true });
                if (!local || typeof local !== 'object') return;
                const projected = {
                    ...(row && typeof row === 'object' ? row : {}),
                    ...local,
                    id: taskId,
                    root_id: entry.expectedDocId || normalizeId(local.root_id || local.docId),
                    docId: entry.expectedDocId || normalizeId(local.docId || local.root_id),
                    parent_task_id: entry.hasExpectedParent ? entry.expectedParentTaskId : normalizeId(local.parent_task_id || local.parentTaskId),
                    parentTaskId: entry.hasExpectedParent ? entry.expectedParentTaskId : normalizeId(local.parentTaskId || local.parent_task_id),
                    __tmPendingStructural: true,
                };
                if (found && !removedIndexes.has(found.index)) sourceRows[found.index] = projected;
                else sourceRows.push(projected);
            }
        });
        return sourceRows.filter((_, index) => !removedIndexes.has(index));
    };

    const getModal = () => {
        try {
            return state?.modal || null;
        } catch (e) {
            return null;
        }
    };

    const hasLiveModal = (modalEl = __TM_RUNTIME_STATE_DEFAULT_MODAL) => {
        const modal = modalEl === __TM_RUNTIME_STATE_DEFAULT_MODAL ? getModal() : modalEl;
        if (!(modal instanceof Element)) return false;
        try {
            return !!document.body?.contains?.(modal);
        } catch (e) {
            return false;
        }
    };

    const getOpenToken = () => {
        try {
            return Number(state?.openToken) || 0;
        } catch (e) {
            return 0;
        }
    };

    const nextOpenToken = () => {
        try {
            state.openToken = getOpenToken() + 1;
            return getOpenToken();
        } catch (e) {
            return getOpenToken();
        }
    };

    const isCurrentOpenToken = (token) => (Number(token) || 0) === getOpenToken();

    const getViewMode = (fallback = '') => {
        try {
            const current = String(state?.viewMode || '').trim();
            if (current) return current;
        } catch (e) {}
        return String(fallback || '').trim();
    };

    const isViewMode = (mode) => getViewMode() === normalizeId(mode);

    const isAnyViewMode = (modes) => {
        const current = getViewMode();
        if (!current || !Array.isArray(modes)) return false;
        return modes.some((mode) => normalizeId(mode) === current);
    };

    const getTaskClientStore = () => {
        try {
            if (!state.__tmTaskClientIdMap || typeof state.__tmTaskClientIdMap !== 'object') {
                state.__tmTaskClientIdMap = {};
            }
            return state.__tmTaskClientIdMap;
        } catch (e) {
            return {};
        }
    };

    const createTaskClientId = (prefix = 'task') => {
        const label = normalizeId(prefix) || 'task';
        return `tm_client_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    };

    const pruneTaskClientStore = () => {
        const store = getTaskClientStore();
        const now = Date.now();
        try {
            Object.keys(store).forEach((key) => {
                const item = store[key];
                const expiresAt = Number(item?.expiresAt) || 0;
                if (expiresAt > 0 && expiresAt < now) delete store[key];
            });
        } catch (e) {}
        return store;
    };

    const rememberTaskIdentity = (entry = {}) => {
        const input = (entry && typeof entry === 'object') ? entry : {};
        const tempId = normalizeId(input.tempId);
        const blockId = normalizeId(input.blockId || input.realId);
        let clientId = normalizeId(input.clientId);
        const store = pruneTaskClientStore();
        if (!clientId) {
            try {
                const found = Object.entries(store).find(([, item]) => {
                    return normalizeId(item?.tempId) === tempId
                        || normalizeId(item?.blockId) === blockId
                        || normalizeId(item?.realId) === blockId;
                });
                if (found) clientId = normalizeId(found[0]);
            } catch (e) {}
        }
        if (!clientId) clientId = createTaskClientId(input.kind || 'task');
        const prev = (store[clientId] && typeof store[clientId] === 'object') ? store[clientId] : {};
        const status = normalizeId(input.status) || (blockId ? 'committed' : (tempId ? 'pending' : normalizeId(prev.status) || 'unknown'));
        const expiresAt = Math.max(
            Number(prev.expiresAt) || 0,
            Number(input.expiresAt) || 0,
            Date.now() + (blockId ? 180000 : 300000)
        );
        store[clientId] = {
            ...prev,
            ...input,
            clientId,
            tempId: tempId || normalizeId(prev.tempId),
            blockId: blockId || normalizeId(prev.blockId || prev.realId),
            realId: blockId || normalizeId(prev.realId || prev.blockId),
            status,
            updatedAt: Date.now(),
            expiresAt,
        };
        return store[clientId];
    };

    const findTaskIdentity = (id) => {
        const raw = normalizeId(id);
        if (!raw) return null;
        const store = pruneTaskClientStore();
        if (store[raw]) return store[raw];
        try {
            const matched = Object.values(store).find((item) => {
                if (!item || typeof item !== 'object') return false;
                return normalizeId(item.clientId) === raw
                    || normalizeId(item.tempId) === raw
                    || normalizeId(item.blockId) === raw
                    || normalizeId(item.realId) === raw;
            });
            return matched || null;
        } catch (e) {
            return null;
        }
    };

    const resolveTaskIdentityId = (id, options = {}) => {
        const raw = normalizeId(id);
        if (!raw) return '';
        const opts = (options && typeof options === 'object') ? options : {};
        const identity = findTaskIdentity(raw);
        if (!identity) return raw;
        const blockId = normalizeId(identity.blockId || identity.realId);
        const tempId = normalizeId(identity.tempId);
        if (opts.preferTemp === true && tempId) return tempId;
        return blockId || tempId || raw;
    };

    const commitTaskIdentity = (tempIdOrEntry, blockIdInput = '') => {
        const entry = (tempIdOrEntry && typeof tempIdOrEntry === 'object')
            ? tempIdOrEntry
            : { tempId: tempIdOrEntry, blockId: blockIdInput };
        const tempId = normalizeId(entry.tempId);
        const blockId = normalizeId(entry.blockId || entry.realId);
        if (!blockId && !tempId) return null;
        return rememberTaskIdentity({
            ...entry,
            tempId,
            blockId,
            realId: blockId,
            status: blockId ? 'committed' : normalizeId(entry.status) || 'pending',
        });
    };

    const getActiveRenderMode = (fallback = '') => {
        try {
            if (state?.attachmentLibraryOpen) return 'attachments';
            if (state?.homepageOpen) return 'home';
        } catch (e) {}
        return getViewMode(fallback);
    };

    // Task store: the only local mirror boundary for taskTree/flatTasks/pending task state.
    const resolveOptimisticTaskId = (id) => {
        const tid = normalizeId(id);
        if (!tid) return '';
        const identityResolved = resolveTaskIdentityId(tid);
        if (identityResolved && identityResolved !== tid) return identityResolved;
        try {
            if (typeof __tmResolveOptimisticTaskId === 'function') {
                return normalizeId(__tmResolveOptimisticTaskId(tid) || tid) || tid;
            }
        } catch (e) {}
        return tid;
    };

    const getTaskIdAliases = (id) => {
        const tid = normalizeId(id);
        if (!tid) return [];
        const out = [tid];
        try {
            const identity = findTaskIdentity(tid);
            if (identity && typeof identity === 'object') {
                [identity.clientId, identity.tempId, identity.blockId, identity.realId].forEach((value) => {
                    const nextId = normalizeId(value);
                    if (nextId && !out.includes(nextId)) out.push(nextId);
                });
            }
        } catch (e) {}
        const resolvedId = resolveOptimisticTaskId(tid);
        if (resolvedId && resolvedId !== tid) out.push(resolvedId);
        return Array.from(new Set(out.filter(Boolean)));
    };

    const isPendingDeletedTaskId = (id) => {
        const tid = normalizeId(id);
        if (!tid) return false;
        try {
            const store = state?.pendingDeletedTasks || {};
            const checkOne = (taskId) => {
                const key = normalizeId(taskId);
                if (!key || !store[key]) return false;
                const expiresAt = Number(store[key]?.expiresAt) || 0;
                if (expiresAt > 0 && expiresAt < Date.now()) {
                    try { delete store[key]; } catch (e) {}
                    return false;
                }
                return true;
            };
            if (checkOne(tid)) return true;
            const resolvedId = resolveOptimisticTaskId(tid);
            return !!(resolvedId && resolvedId !== tid && checkOne(resolvedId));
        } catch (e) {
            return false;
        }
    };

    const getFlatTaskById = (id) => {
        const aliases = getTaskIdAliases(id);
        if (!aliases.length) return null;
        if (aliases.some(isPendingDeletedTaskId)) return null;
        try {
            for (const tid of aliases) {
                const task = state?.flatTasks?.[tid] || null;
                if (task) return task;
            }
        } catch (e) {
            return null;
        }
        return null;
    };

    const getPendingTaskById = (id) => {
        const aliases = getTaskIdAliases(id);
        if (!aliases.length) return null;
        if (aliases.some(isPendingDeletedTaskId)) return null;
        try {
            for (const tid of aliases) {
                const task = state?.pendingInsertedTasks?.[tid] || null;
                if (task) return task;
            }
        } catch (e) {
            return null;
        }
        return null;
    };

    const getTaskById = (id, options = {}) => {
        const tid = normalizeId(id);
        if (!tid) return null;
        const includePending = options?.includePending !== false;
        const preferPending = options?.preferPending === true;
        if (preferPending) {
            const pendingFirst = getPendingTaskById(tid);
            if (pendingFirst) return pendingFirst;
        }
        const liveTask = getFlatTaskById(tid);
        if (liveTask) return liveTask;
        return includePending ? getPendingTaskById(tid) : null;
    };

    const listProjectedDirectChildren = (parentId, options = {}) => {
        const pid = normalizeId(parentId);
        if (!pid) return [];
        const opts = options && typeof options === 'object' ? options : {};
        const parentAliases = new Set(getTaskIdAliases(pid));
        parentAliases.add(pid);
        const children = new Map();
        const addChild = (child, nestedUnderParent = false) => {
            if (!(child && typeof child === 'object')) return;
            const childId = normalizeId(child.id || child.blockId);
            if (!childId || parentAliases.has(childId)) return;
            if (!nestedUnderParent) {
                const rawParentId = normalizeId(child.parentTaskId || child.parent_task_id);
                if (!rawParentId) return;
                const rawParentAliases = new Set(getTaskIdAliases(rawParentId));
                rawParentAliases.add(rawParentId);
                if (!Array.from(rawParentAliases).some((id) => parentAliases.has(id))) return;
            }
            const projected = projectTaskFromBase(childId, child);
            if (!(projected && typeof projected === 'object')) return;
            const projectedParentId = normalizeId(projected.parentTaskId || projected.parent_task_id);
            if (projectedParentId) {
                const projectedParentAliases = new Set(getTaskIdAliases(projectedParentId));
                projectedParentAliases.add(projectedParentId);
                if (!Array.from(projectedParentAliases).some((id) => parentAliases.has(id))) return;
            } else if (!nestedUnderParent) {
                return;
            }
            children.set(childId, projected);
        };
        const structuralParent = getTaskById(pid, { includePending: true, preferPending: true });
        const parent = projectTaskFromBase(pid, structuralParent);
        (Array.isArray(parent?.children) ? parent.children : []).forEach((child) => addChild(child, true));
        if (structuralParent !== parent) {
            (Array.isArray(structuralParent?.children) ? structuralParent.children : []).forEach((child) => addChild(child, true));
        }
        if (opts.scanFlat !== false) {
            [state?.flatTasks, state?.pendingInsertedTasks].forEach((taskMap) => {
                Object.values((taskMap && typeof taskMap === 'object') ? taskMap : {}).forEach((child) => addChild(child, false));
            });
        }
        return Array.from(children.values());
    };

    const ensureFlatTaskMap = () => {
        try {
            if (!state.flatTasks || typeof state.flatTasks !== 'object' || Array.isArray(state.flatTasks)) state.flatTasks = {};
            return state.flatTasks;
        } catch (e) {
            return {};
        }
    };

    const ensurePendingInsertedTaskMap = () => {
        try {
            if (!state.pendingInsertedTasks || typeof state.pendingInsertedTasks !== 'object' || Array.isArray(state.pendingInsertedTasks)) state.pendingInsertedTasks = {};
            return state.pendingInsertedTasks;
        } catch (e) {
            return {};
        }
    };

    const ensurePendingDeletedTaskMap = () => {
        try {
            if (!state.pendingDeletedTasks || typeof state.pendingDeletedTasks !== 'object' || Array.isArray(state.pendingDeletedTasks)) state.pendingDeletedTasks = {};
            return state.pendingDeletedTasks;
        } catch (e) {
            return {};
        }
    };

    const markTaskStoreDirty = () => {
        try { state.listDomRenderSignature = ''; } catch (e) {}
        try { state.listRenderSignature = ''; } catch (e) {}
        try { if (typeof __tmInvalidateFilteredTaskDerivedStateCache === 'function') __tmInvalidateFilteredTaskDerivedStateCache(); } catch (e) {}
    };

    const mergeOtherBlocksIntoTaskStoreFlatMap = (flatMap) => {
        const nextMap = (flatMap && typeof flatMap === 'object' && !Array.isArray(flatMap)) ? flatMap : {};
        try {
            if (typeof __tmMergeOtherBlocksIntoFlatTasks === 'function') {
                return __tmMergeOtherBlocksIntoFlatTasks(nextMap) || nextMap;
            }
        } catch (e) {}
        return nextMap;
    };

    const replaceFlatTasksLocal = (flatMap = {}, options = {}) => {
        const opts = (options && typeof options === 'object') ? options : {};
        let nextMap = (flatMap && typeof flatMap === 'object' && !Array.isArray(flatMap)) ? flatMap : {};
        if (opts.normalizeKeys === true) {
            const normalized = {};
            Object.entries(nextMap).forEach(([key, task]) => {
                if (!(task && typeof task === 'object')) return;
                const tid = normalizeId(task.id || key);
                if (!tid) return;
                normalized[tid] = task;
            });
            nextMap = normalized;
        }
        if (opts.authoritative === true || confirmedTaskBase.size === 0) {
            confirmedTaskBase.clear();
            Object.entries(nextMap).forEach(([key, task]) => {
                const tid = normalizeId(task?.id || key);
                const cloned = cloneTaskRecord(task);
                if (tid && cloned) confirmedTaskBase.set(tid, cloned);
            });
            if (opts.authoritative === true) {
                const authoritativeDocIds = Array.from(new Set([
                    ...(Array.isArray(opts.docIds) ? opts.docIds : []),
                    ...Object.values(nextMap).map((task) => task?.root_id || task?.docId),
                ].map(normalizeId).filter(Boolean)));
                bumpTaskStoreRevision(authoritativeDocIds);
            }
        }
        if (pendingTaskOverlays.size) {
            const projected = { ...nextMap };
            const ids = new Set();
            pendingTaskOverlays.forEach((overlay) => {
                (Array.isArray(overlay?.taskIds) ? overlay.taskIds : []).forEach((id) => {
                    const tid = normalizeId(id);
                    if (tid) ids.add(tid);
                });
            });
            ids.forEach((tid) => {
                const task = projectTaskFromBase(tid, projected[tid]);
                if (task) projected[tid] = task;
                else delete projected[tid];
            });
            nextMap = projected;
        }
        if (opts.mergeOtherBlocks !== false) nextMap = mergeOtherBlocksIntoTaskStoreFlatMap(nextMap);
        try { state.flatTasks = nextMap; } catch (e) {}
        markTaskStoreDirty();
        return state.flatTasks || nextMap;
    };

    const clearFlatTasksLocal = (options = {}) => {
        return replaceFlatTasksLocal({}, options);
    };

    const acceptAuthoritativeTasksLocal = (tasks = [], options = {}) => {
        const opts = (options && typeof options === 'object') ? options : {};
        const list = (Array.isArray(tasks) ? tasks : [])
            .filter((task) => task && typeof task === 'object' && normalizeId(task.id));
        const docIds = Array.from(new Set([
            ...(Array.isArray(opts.docIds) ? opts.docIds : []),
            ...list.map((task) => task.root_id || task.docId),
        ].map(normalizeId).filter(Boolean)));
        const previousConfirmedById = new Map();
        if (opts.replaceDocuments === true && docIds.length) {
            const docSet = new Set(docIds);
            confirmedTaskBase.forEach((task, taskId) => {
                const docId = normalizeId(task?.root_id || task?.docId);
                if (!docSet.has(docId)) return;
                const previous = cloneTaskRecord(task);
                if (previous) previousConfirmedById.set(taskId, previous);
                confirmedTaskBase.delete(taskId);
            });
        }
        list.forEach((task) => {
            const taskId = normalizeId(task.id);
            if (!taskId) return;
            const current = previousConfirmedById.get(taskId)
                || confirmedTaskBase.get(taskId)
                || state?.flatTasks?.[taskId]
                || state?.pendingInsertedTasks?.[taskId]
                || null;
            const confirmed = opts.replaceDocuments === true
                ? cloneTaskRecord(task)
                : mergeConfirmedTaskReceipt(current, task, {}, {
                    preserveStructure: opts.replaceStructure !== true,
                });
            try {
                const watermark = typeof __tmGetLocalTaskPatchWatermark === 'function'
                    ? __tmGetLocalTaskPatchWatermark(taskId)
                    : null;
                const protectedFields = new Set(Array.isArray(watermark?.fields) ? watermark.fields : []);
                const protectsCompletion = protectedFields.has('done')
                    || protectedFields.has('taskMarker')
                    || protectedFields.has('task_marker');
                const protectsPluginCompletion = protectsCompletion
                    && !isNativeDocumentCompletionWatermark(watermark);
                const overlayKeys = pendingOverlayKeysByTask.get(taskId);
                const hasPendingCompletion = hasPendingCompletionOverlay(taskId);
                if (confirmed && hasPendingCompletion && current) {
                    const previousCompletionPatch = {};
                    ['done', 'taskMarker', 'task_marker', 'markdown', 'customStatus', 'taskCompleteAt'].forEach((key) => {
                        if (Object.prototype.hasOwnProperty.call(current, key)) previousCompletionPatch[key] = current[key];
                    });
                    applyOverlayPatch(confirmed, previousCompletionPatch);
                } else if (confirmed && protectsPluginCompletion
                    && typeof __tmGetLocalTaskPatchWatermarkValue === 'function') {
                    const completionPatch = {};
                    ['done', 'taskMarker', 'task_marker', 'markdown', 'customStatus', 'taskCompleteAt'].forEach((key) => {
                        const value = __tmGetLocalTaskPatchWatermarkValue(taskId, key);
                        if (value?.has) completionPatch[key] = value.value;
                    });
                    applyOverlayPatch(confirmed, completionPatch);
                }
                if (!hasPendingCompletion && !protectsPluginCompletion) {
                    reconcileLegacyDoneOverride(taskId, confirmed);
                }
                const hasPendingAttachments = Array.from(overlayKeys instanceof Set ? overlayKeys : []).some((overlayKey) => {
                    const patch = pendingTaskOverlays.get(overlayKey)?.patch;
                    return patch && typeof patch === 'object'
                        && Object.prototype.hasOwnProperty.call(patch, 'attachments');
                });
                if (confirmed && hasPendingAttachments && current) {
                    applyTaskStoreAttachmentPatch(confirmed, current.__attachmentPaths || current.attachments || []);
                } else if (confirmed && protectedFields.has('attachments')
                    && typeof __tmGetLocalTaskPatchWatermarkValue === 'function') {
                    const attachments = __tmGetLocalTaskPatchWatermarkValue(taskId, 'attachments');
                    if (attachments?.has) applyTaskStoreAttachmentPatch(confirmed, attachments.value);
                }
            } catch (e) {}
            if (confirmed) confirmedTaskBase.set(taskId, confirmed);
        });
        bumpTaskStoreRevision(docIds);
        return list.length;
    };

    const removeFlatTasksByDocLocal = (docId, options = {}) => {
        const did = normalizeId(docId);
        if (!did) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const flat = ensureFlatTaskMap();
        let removed = false;
        Object.keys(flat).forEach((taskId) => {
            const task = flat[taskId];
            const rootId = normalizeId(task?.root_id || task?.docId);
            if (rootId !== did) return;
            try {
                delete flat[taskId];
                removed = true;
            } catch (e) {}
        });
        if (removed && opts.mergeOtherBlocks === true) {
            replaceFlatTasksLocal(flat, { ...opts, mergeOtherBlocks: true });
        } else if (removed) {
            markTaskStoreDirty();
        }
        return removed;
    };

    const removePendingInsertedTaskLocal = (id, options = {}) => {
        const tid = normalizeId(id);
        if (!tid) return false;
        const aliases = new Set(getTaskIdAliases(tid));
        const customOrderRemoveIds = new Set(aliases);
        const collectCustomOrderRemoveIds = (list) => {
            if (!Array.isArray(list)) return;
            list.forEach((item) => {
                const itemId = normalizeId(item?.id);
                if (itemId && aliases.has(itemId)) {
                    const walk = (task) => {
                        const taskId = normalizeId(task?.id);
                        if (taskId) customOrderRemoveIds.add(taskId);
                        (Array.isArray(task?.children) ? task.children : []).forEach(walk);
                    };
                    walk(item);
                    return;
                }
                collectCustomOrderRemoveIds(item?.children);
            });
        };
        try {
            (Array.isArray(state.taskTree) ? state.taskTree : []).forEach((doc) => collectCustomOrderRemoveIds(doc?.tasks));
            collectCustomOrderRemoveIds(state.filteredTasks);
            collectCustomOrderRemoveIds(state.otherBlocks);
            __tmRemoveCustomTaskOrderTasks(Array.from(customOrderRemoveIds));
        } catch (e) {}
        let removed = false;
        const pending = ensurePendingInsertedTaskMap();
        aliases.forEach((alias) => {
            try {
                if (!pending[alias]) return;
                delete pending[alias];
                removed = true;
            } catch (e) {}
        });
        if (removed) markTaskStoreDirty();
        return removed;
    };

    const mutateLocalTask = (id, updater, options = {}) => {
        const tid = normalizeId(id);
        const run = typeof updater === 'function' ? updater : null;
        if (!tid || !run) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const aliases = getTaskIdAliases(tid);
        const touched = new Set();
        let changed = false;
        const runOne = (task) => {
            if (!(task && typeof task === 'object')) return;
            const key = normalizeId(task.id || task.blockId) || tid;
            if (touched.has(task)) return;
            touched.add(task);
            const result = run(task, key);
            if (result !== false) changed = true;
        };
        if (opts.includeFlat !== false) {
            aliases.forEach((alias) => runOne(state?.flatTasks?.[alias]));
        }
        if (opts.includePending !== false) {
            aliases.forEach((alias) => runOne(state?.pendingInsertedTasks?.[alias]));
        }
        if (opts.includeLists === true) {
            visitTaskStoreListsById(aliases, (taskLike) => {
                runOne(taskLike);
                return true;
            });
        }
        if (changed) markTaskStoreDirty();
        return changed;
    };

    const patchPendingInsertedTaskLocal = (id, patch = {}, options = {}) => {
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        if (!Object.keys(nextPatch).length) return false;
        return mutateLocalTask(id, (task) => applyTaskStorePatch(task, nextPatch), {
            includeFlat: false,
            includePending: true,
            includeLists: false,
            ...(options && typeof options === 'object' ? options : {}),
        });
    };

    const deletePendingInsertedTaskPropsLocal = (id, keys = []) => {
        const props = (Array.isArray(keys) ? keys : [keys]).map((key) => String(key || '').trim()).filter(Boolean);
        if (!props.length) return false;
        return mutateLocalTask(id, (task) => {
            props.forEach((key) => {
                try { delete task[key]; } catch (e) {}
            });
            return true;
        }, {
            includeFlat: false,
            includePending: true,
            includeLists: false,
        });
    };

    const markPendingDeletedTaskLocal = (taskIds, options = {}) => {
        const ids = Array.isArray(taskIds) ? taskIds : [taskIds];
        const opts = (options && typeof options === 'object') ? options : {};
        const expiresAt = Math.max(Date.now() + 45000, Number(opts.expiresAt) || 0);
        const deleted = ensurePendingDeletedTaskMap();
        let changed = false;
        ids.forEach((id) => {
            const tid = normalizeId(id);
            if (!tid) return;
            deleted[tid] = {
                taskId: tid,
                expiresAt,
                source: normalizeId(opts.source) || 'task-store-pending-delete',
            };
            changed = true;
        });
        try {
            Object.keys(deleted).forEach((key) => {
                const expires = Number(deleted[key]?.expiresAt) || 0;
                if (expires > 0 && expires < Date.now()) delete deleted[key];
            });
        } catch (e) {}
        if (changed) markTaskStoreDirty();
        return changed;
    };

    const forgetPendingDeletedTaskLocal = (taskIds) => {
        const ids = Array.isArray(taskIds) ? taskIds : [taskIds];
        const deleted = ensurePendingDeletedTaskMap();
        let changed = false;
        ids.forEach((id) => {
            const tid = normalizeId(id);
            if (!tid || !deleted[tid]) return;
            try {
                delete deleted[tid];
                changed = true;
            } catch (e) {}
        });
        if (changed) markTaskStoreDirty();
        return changed;
    };

    const applyTaskStorePatch = (task, patch) => {
        if (!(task && typeof task === 'object')) return false;
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        Object.entries(nextPatch).forEach(([key, value]) => {
            if (key === 'attachments') {
                applyTaskStoreAttachmentPatch(task, value);
                return;
            }
            task[key] = value;
            if (key === 'title' || key === 'content') {
                const title = String(value == null ? '' : value).trim();
                task.title = title;
                task.content = title;
                task.raw_content = title;
                task.rawContent = title;
            }
            if (key === 'startDate') task.start_date = value;
            if (key === 'completionTime') task.completion_time = value;
            if (key === 'customStatus') task.custom_status = value;
            if (key === 'taskDateColor') task.task_date_color = value;
            if (key === 'taskCompleteAt') task.task_complete_at = value;
            if (key === 'parentTaskId') task.parent_task_id = value;
            if (key === 'docId') task.root_id = value;
            if (key === 'pinned') task.custom_pinned = value ? '1' : '';
            if (key === 'repeatState') task.repeat_state = value;
            if (key === 'repeatHistory') task.repeat_history = value;
            if (key === 'taskMarker') task.task_marker = value;
        });
        try { task.updated = new Date().toISOString(); } catch (e) {}
        return true;
    };

    const visitTaskStoreListsById = (ids, visitor) => {
        const idSet = ids instanceof Set
            ? ids
            : new Set((Array.isArray(ids) ? ids : [ids]).map((id) => normalizeId(id)).filter(Boolean));
        const run = typeof visitor === 'function' ? visitor : null;
        if (!idSet.size || !run) return false;
        let touched = false;
        const walk = (list) => {
            if (!Array.isArray(list)) return false;
            let changed = false;
            list.forEach((task) => {
                if (!(task && typeof task === 'object')) return;
                if (idSet.has(normalizeId(task.id || task.blockId))) {
                    if (run(task) !== false) {
                        touched = true;
                        changed = true;
                    }
                }
                if (walk(task.children)) changed = true;
            });
            return changed;
        };
        try {
            (Array.isArray(state.taskTree) ? state.taskTree : []).forEach((doc) => {
                if (walk(doc?.tasks)) touched = true;
            });
        } catch (e) {}
        try { if (walk(state.filteredTasks)) touched = true; } catch (e) {}
        try { if (walk(state.otherBlocks)) touched = true; } catch (e) {}
        return touched;
    };

    const mergeTaskStoreTask = (target, source, options = {}) => {
        if (!(target && typeof target === 'object') || !(source && typeof source === 'object')) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const prevChildren = Array.isArray(target.children) ? target.children : null;
        Object.assign(target, source);
        if (opts.replaceStructure !== true && prevChildren) {
            target.children = prevChildren;
        }
        return true;
    };

    const patchTaskLocal = (id, patch = {}, options = {}) => {
        const tid = normalizeId(id);
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        if (!tid || !Object.keys(nextPatch).length) return false;
        const aliases = getTaskIdAliases(tid);
        let touched = false;
        try {
            aliases.forEach((alias) => {
                touched = applyTaskStorePatch(state?.flatTasks?.[alias], nextPatch) || touched;
                touched = applyTaskStorePatch(state?.pendingInsertedTasks?.[alias], nextPatch) || touched;
            });
        } catch (e) {}
        const task = getTaskById(tid, { includePending: true, preferPending: true });
        touched = applyTaskStorePatch(task, nextPatch) || touched;
        touched = visitTaskStoreListsById(aliases, (taskLike) => applyTaskStorePatch(taskLike, nextPatch)) || touched;
        if (touched) {
            const affectsPriorityScore = typeof __tmDoesPatchAffectPriorityScore === 'function'
                && __tmDoesPatchAffectPriorityScore(nextPatch);
            try {
                if (affectsPriorityScore && typeof __tmSyncTaskPriorityScoreLocal === 'function') {
                    __tmSyncTaskPriorityScoreLocal(tid, {
                        includeAncestors: typeof __tmDoesPatchAffectAncestorPriorityScore === 'function'
                            && __tmDoesPatchAffectAncestorPriorityScore(nextPatch),
                        refreshAncestorViews: false,
                        reason: String(options?.source || 'mutation-local-priority-sync').trim() || 'mutation-local-priority-sync',
                    });
                }
            } catch (e) {}
            try { MetaStore?.set?.(resolveOptimisticTaskId(tid) || tid, nextPatch); } catch (e) {}
            try { state.listDomRenderSignature = ''; } catch (e) {}
        }
        return touched;
    };

    const upsertTaskLocal = (task, options = {}) => {
        const nextTask = (task && typeof task === 'object') ? task : null;
        const tid = normalizeId(nextTask?.id);
        if (!nextTask || !tid) return null;
        const opts = (options && typeof options === 'object') ? options : {};
        try {
            if (!state.flatTasks || typeof state.flatTasks !== 'object') state.flatTasks = {};
            if (state.flatTasks[tid] && state.flatTasks[tid] !== nextTask) mergeTaskStoreTask(state.flatTasks[tid], nextTask, opts);
            else state.flatTasks[tid] = nextTask;
        } catch (e) {}
        if (opts.pending === true) {
            try {
                if (!state.pendingInsertedTasks || typeof state.pendingInsertedTasks !== 'object') state.pendingInsertedTasks = {};
                const pendingTask = {
                    ...nextTask,
                    expiresAt: opts.expiresAt || Date.now() + 120000,
                };
                if (state.pendingInsertedTasks[tid] && state.pendingInsertedTasks[tid] !== nextTask) {
                    mergeTaskStoreTask(state.pendingInsertedTasks[tid], pendingTask, opts);
                } else {
                    state.pendingInsertedTasks[tid] = pendingTask;
                }
            } catch (e) {}
        }
        try {
            visitTaskStoreListsById([tid], (taskLike) => {
                mergeTaskStoreTask(taskLike, nextTask, opts);
                return true;
            });
        } catch (e) {}
        const clientId = normalizeId(opts.clientId || nextTask.clientId || nextTask.__tmClientId);
        if (clientId || opts.tempId || opts.blockId) {
            rememberTaskIdentity({
                clientId,
                tempId: opts.tempId || tid,
                blockId: opts.blockId,
                kind: opts.kind || 'task',
                status: opts.status || (opts.pending === true ? 'pending' : 'local'),
            });
        }
        return nextTask;
    };

    const removeTaskLocal = (id, options = {}) => {
        const tid = normalizeId(id);
        if (!tid) return false;
        const aliases = new Set(getTaskIdAliases(tid));
        let removed = false;
        aliases.forEach((alias) => {
            try {
                if (state.flatTasks?.[alias]) {
                    delete state.flatTasks[alias];
                    removed = true;
                }
            } catch (e) {}
            try {
                if (state.pendingInsertedTasks?.[alias]) {
                    delete state.pendingInsertedTasks[alias];
                    removed = true;
                }
            } catch (e) {}
        });
        const pruneList = (list) => {
            if (!Array.isArray(list)) return false;
            let changed = false;
            for (let i = list.length - 1; i >= 0; i -= 1) {
                const item = list[i];
                const itemId = normalizeId(item?.id);
                if (itemId && aliases.has(itemId)) {
                    list.splice(i, 1);
                    changed = true;
                    continue;
                }
                if (pruneList(item?.children)) changed = true;
            }
            return changed;
        };
        try {
            (Array.isArray(state.taskTree) ? state.taskTree : []).forEach((doc) => {
                if (pruneList(doc?.tasks)) removed = true;
            });
        } catch (e) {}
        try {
            if (pruneList(state.filteredTasks)) removed = true;
        } catch (e) {}
        try {
            if (pruneList(state.otherBlocks)) removed = true;
        } catch (e) {}
        if (removed) {
            try { state.listDomRenderSignature = ''; } catch (e) {}
            try { state.listRenderSignature = ''; } catch (e) {}
            try { if (typeof __tmInvalidateFilteredTaskDerivedStateCache === 'function') __tmInvalidateFilteredTaskDerivedStateCache(); } catch (e) {}
        }
        return removed;
    };

    const remapTaskLocalId = (oldId, newId, options = {}) => {
        const from = normalizeId(oldId);
        const to = normalizeId(newId);
        if (!from || !to || from === to) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const aliases = new Set(getTaskIdAliases(from));
        aliases.add(from);
        try { __tmRemapCustomTaskOrderId(from, to, { aliases: Array.from(aliases) }); } catch (e) {}
        let changed = false;
        const remapOneTask = (task) => {
            if (!(task && typeof task === 'object')) return false;
            let touched = false;
            if (aliases.has(normalizeId(task.id))) {
                task.id = to;
                touched = true;
            }
            if (aliases.has(normalizeId(task.parentTaskId))) {
                task.parentTaskId = to;
                task.parent_task_id = to;
                touched = true;
            }
            if (aliases.has(normalizeId(task.parent_task_id))) {
                task.parent_task_id = to;
                task.parentTaskId = to;
                touched = true;
            }
            if (touched && opts.blockId) {
                task.blockId = opts.blockId;
                task.realId = opts.blockId;
            }
            return touched;
        };
        const remapList = (list) => {
            if (!Array.isArray(list)) return false;
            let touched = false;
            list.forEach((task) => {
                if (remapOneTask(task)) touched = true;
                if (remapList(task?.children)) touched = true;
            });
            return touched;
        };
        let mergedTask = null;
        const relatedParentIds = new Set();
        const directChildIds = new Set();
        const collectKnownRelations = (task) => {
            if (!(task && typeof task === 'object')) return;
            const parentTaskId = normalizeId(task.parentTaskId || task.parent_task_id);
            if (parentTaskId) relatedParentIds.add(parentTaskId);
            (Array.isArray(task.children) ? task.children : []).forEach((child) => {
                const childId = normalizeId(child?.id);
                if (childId) directChildIds.add(childId);
            });
        };
        try {
            aliases.forEach((alias) => {
                const task = state.flatTasks?.[alias] || state.pendingInsertedTasks?.[alias];
                if (task && typeof task === 'object') {
                    collectKnownRelations(task);
                    mergedTask = { ...(mergedTask || {}), ...task };
                }
            });
            if (state.flatTasks?.[to]) {
                collectKnownRelations(state.flatTasks[to]);
                mergedTask = { ...(mergedTask || {}), ...state.flatTasks[to] };
            }
            if (state.pendingInsertedTasks?.[to]) {
                collectKnownRelations(state.pendingInsertedTasks[to]);
                mergedTask = { ...(mergedTask || {}), ...state.pendingInsertedTasks[to] };
            }
            if (mergedTask) {
                mergedTask.id = to;
                if (remapList(mergedTask.children)) changed = true;
                if (opts.clientId) {
                    mergedTask.clientId = opts.clientId;
                    mergedTask.__tmClientId = opts.clientId;
                }
                aliases.forEach((alias) => {
                    try { delete state.flatTasks[alias]; } catch (e) {}
                    try { delete state.pendingInsertedTasks[alias]; } catch (e) {}
                });
                if (!state.flatTasks || typeof state.flatTasks !== 'object') state.flatTasks = {};
                state.flatTasks[to] = mergedTask;
                if (opts.keepPending !== false) {
                    if (!state.pendingInsertedTasks || typeof state.pendingInsertedTasks !== 'object') state.pendingInsertedTasks = {};
                    state.pendingInsertedTasks[to] = {
                        ...mergedTask,
                        expiresAt: Math.max(Number(state.pendingInsertedTasks?.[to]?.expiresAt) || 0, Date.now() + 45000),
                    };
                }
                changed = true;
            }
        } catch (e) {}
        try {
            let confirmedTask = null;
            aliases.forEach((alias) => {
                const task = confirmedTaskBase.get(alias);
                if (task && typeof task === 'object') {
                    collectKnownRelations(task);
                    confirmedTask = { ...(confirmedTask || {}), ...task };
                }
                confirmedTaskBase.delete(alias);
            });
            if (confirmedTask) {
                confirmedTask.id = to;
                if (remapList(confirmedTask.children)) changed = true;
                if (opts.clientId) {
                    confirmedTask.clientId = opts.clientId;
                    confirmedTask.__tmClientId = opts.clientId;
                }
                confirmedTaskBase.set(to, confirmedTask);
                changed = true;
            }
            relatedParentIds.forEach((parentTaskId) => {
                if (remapList(confirmedTaskBase.get(parentTaskId)?.children)) changed = true;
            });
            directChildIds.forEach((childTaskId) => {
                if (remapOneTask(confirmedTaskBase.get(childTaskId))) changed = true;
            });
        } catch (e) {}
        try {
            [state.flatTasks, state.pendingInsertedTasks].forEach((taskMap) => {
                relatedParentIds.forEach((parentTaskId) => {
                    if (remapList(taskMap?.[parentTaskId]?.children)) changed = true;
                });
                directChildIds.forEach((childTaskId) => {
                    if (remapOneTask(taskMap?.[childTaskId])) changed = true;
                });
            });
        } catch (e) {}
        try { if (remapList(state.filteredTasks)) changed = true; } catch (e) {}
        try {
            (Array.isArray(state.taskTree) ? state.taskTree : []).forEach((doc) => {
                if (remapList(doc?.tasks)) changed = true;
            });
        } catch (e) {}
        try {
            ['detailTaskId', 'kanbanDetailTaskId', 'kanbanDetailAnchorTaskId', 'timerFocusTaskId', 'draggingTaskId', '__tmKanbanDragId', 'whiteboardSelectedTaskId', 'whiteboardLinkFromTaskId', 'whiteboardLinkHoverTaskId'].forEach((key) => {
                if (aliases.has(normalizeId(state?.[key]))) {
                    state[key] = to;
                    changed = true;
                }
            });
        } catch (e) {}
        const remapIdSet = (value) => {
            if (!(value instanceof Set)) return false;
            let touched = false;
            const next = new Set();
            value.forEach((item) => {
                const id = normalizeId(item);
                if (id && aliases.has(id)) {
                    next.add(to);
                    touched = true;
                } else {
                    next.add(item);
                }
            });
            if (touched) {
                value.clear();
                next.forEach((item) => value.add(item));
            }
            return touched;
        };
        const remapIdArrayProp = (obj, key) => {
            if (!(obj && Array.isArray(obj[key]))) return false;
            let touched = false;
            const next = obj[key].map((item) => {
                const id = normalizeId(item);
                if (id && aliases.has(id)) {
                    touched = true;
                    return to;
                }
                return item;
            });
            if (touched) obj[key] = Array.from(new Set(next));
            return touched;
        };
        try {
            if (remapIdSet(state.collapsedTaskIds)) changed = true;
            if (Array.isArray(SettingsStore?.data?.collapsedTaskIds)) {
                const holder = { collapsedTaskIds: SettingsStore.data.collapsedTaskIds };
                if (remapIdArrayProp(holder, 'collapsedTaskIds')) {
                    SettingsStore.data.collapsedTaskIds = holder.collapsedTaskIds;
                    changed = true;
                }
            }
        } catch (e) {}
        try {
            ['draggingTaskIds', 'whiteboardMultiSelectedTaskIds', 'whiteboardPoolSelectedTaskIds', '__tmChecklistItemsOnlyRefreshTaskIds', '__tmChecklistProjectionGroupRefreshTaskIds'].forEach((key) => {
                if (remapIdArrayProp(state, key)) changed = true;
            });
        } catch (e) {}
        try {
            const deletedStore = (state.pendingDeletedTasks && typeof state.pendingDeletedTasks === 'object') ? state.pendingDeletedTasks : null;
            if (deletedStore) {
                aliases.forEach((alias) => {
                    if (!deletedStore[alias]) return;
                    deletedStore[to] = {
                        ...deletedStore[alias],
                        taskId: to,
                        expiresAt: Math.max(Number(deletedStore[alias]?.expiresAt) || 0, Date.now() + 45000),
                    };
                    delete deletedStore[alias];
                    changed = true;
                });
            }
        } catch (e) {}
        if (changed) {
            try { state.listDomRenderSignature = ''; } catch (e) {}
            try { state.listRenderSignature = ''; } catch (e) {}
            try { MetaStore?.remapId?.(from, to); } catch (e) {}
            try { if (typeof __tmInvalidateFilteredTaskDerivedStateCache === 'function') __tmInvalidateFilteredTaskDerivedStateCache(); } catch (e) {}
        }
        return changed;
    };

    const normalizeTaskMoveMode = (mode) => {
        const raw = normalizeId(mode) || 'docTop';
        if (raw === 'doc') return 'docTop';
        if (raw === 'docTop' || raw === 'docBottom' || raw === 'heading' || raw === 'before' || raw === 'after' || raw === 'child' || raw === 'child-top') return raw;
        return raw;
    };

    const createPendingTaskLocal = (task, options = {}) => {
        const nextTask = (task && typeof task === 'object') ? task : null;
        if (!nextTask) return null;
        const opts = (options && typeof options === 'object') ? options : {};
        return upsertTaskLocal(nextTask, {
            ...opts,
            pending: opts.pending !== false,
            status: opts.status || 'optimistic',
        });
    };

    const commitTaskIdLocal = (tempId, realId, options = {}) => {
        const from = normalizeId(tempId);
        const to = normalizeId(realId);
        if (!from || !to || from === to) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        try {
            commitTaskIdentity({
                clientId: normalizeId(opts.clientId),
                tempId: from,
                blockId: to,
                realId: to,
                kind: opts.kind || 'commitTaskId',
            });
        } catch (e) {}
        return remapTaskLocalId(from, to, {
            clientId: normalizeId(opts.clientId),
            blockId: to,
            keepPending: opts.keepPending !== false,
        });
    };

    const moveTaskLocal = (payload = {}, options = {}) => {
        const data = (payload && typeof payload === 'object') ? { ...payload } : {};
        data.mode = normalizeTaskMoveMode(data.mode);
        try {
            if (typeof __tmApplyMoveOptimisticLocal === 'function') {
                return __tmApplyMoveOptimisticLocal(data) !== false;
            }
        } catch (e) {}
        return false;
    };

    const deleteTaskLocal = (snapshotOrTaskId, options = {}) => {
        const opts = (options && typeof options === 'object') ? options : {};
        const snapshot = (snapshotOrTaskId && typeof snapshotOrTaskId === 'object')
            ? snapshotOrTaskId
            : { taskId: normalizeId(snapshotOrTaskId || opts.taskId) };
        try {
            if (typeof __tmApplyDeleteOptimisticLocal === 'function') {
                return __tmApplyDeleteOptimisticLocal(snapshot, opts) !== false;
            }
        } catch (e) {}
        const tid = normalizeId(snapshot?.taskId || opts.taskId);
        return tid ? removeTaskLocal(tid, opts) : false;
    };

    const rollbackMutationLocal = (mutation = {}) => {
        const m = normalizeTaskMutation(mutation);
        const type = m.type;
        if (type === 'createTaskInDoc' || type === 'createSubtask' || type === 'createSibling') {
            const ids = [m.tempId, m.realId, m.taskId]
                .map((id) => normalizeId(id))
                .filter(Boolean);
            let removed = false;
            ids.forEach((id) => {
                removed = removeTaskLocal(id, { recalc: false, filter: false }) || removed;
            });
            return removed;
        }
        if (type === 'deleteTask') {
            try {
                if (typeof __tmRollbackDeleteOptimisticLocal === 'function') {
                    return __tmRollbackDeleteOptimisticLocal(m.snapshot, { mutationDriven: true }) !== false;
                }
            } catch (e) {}
            return false;
        }
        if (type === 'taskLifecycle' && normalizeId(m.data?.action) === 'archiveDeleted') {
            try {
                if (typeof __tmRollbackDeleteOptimisticLocal === 'function') {
                    return __tmRollbackDeleteOptimisticLocal(m.snapshot, { mutationDriven: true }) !== false;
                }
            } catch (e) {}
            return false;
        }
        if (type === 'taskLifecycle' && normalizeId(m.data?.action) === 'restoreDeleted') {
            return deleteTaskLocal(m.snapshot || m.taskId, {
                taskId: m.taskId,
                source: m.source,
            });
        }
        if (type === 'moveTask') {
            try {
                if (typeof __tmRollbackMoveOptimisticLocal === 'function') {
                    return __tmRollbackMoveOptimisticLocal(m.snapshot, { mutationDriven: true }) !== false;
                }
            } catch (e) {}
            return false;
        }
        if (type === 'commitTaskId' && m.tempId && m.realId) {
            return commitTaskIdLocal(m.realId, m.tempId, { keepPending: true, clientId: m.clientId });
        }
        return false;
    };

    const __tmTaskMutationState = {
        seq: 0,
        listeners: new Set(),
    };

    // Mutation bus and projections: normalize local mutations and schedule derived UI/cache work.
    const cloneTaskMutationValue = (value, depth = 0) => {
        if (depth > 5 || value == null) return value;
        if (Array.isArray(value)) return value.map((item) => cloneTaskMutationValue(item, depth + 1));
        if (value && typeof value === 'object') {
            const out = {};
            Object.entries(value).forEach(([key, item]) => {
                if (typeof item === 'function') return;
                out[key] = cloneTaskMutationValue(item, depth + 1);
            });
            return out;
        }
        return value;
    };

    const normalizeTaskMutationPatch = (mutation) => {
        const src = (mutation && typeof mutation === 'object') ? mutation : {};
        const normalizePresentationPatch = (patch) => {
            const normalized = { ...patch };
            if (Object.prototype.hasOwnProperty.call(normalized, 'title')
                && !Object.prototype.hasOwnProperty.call(normalized, 'content')) {
                normalized.content = String(normalized.title || '').trim();
            }
            return normalized;
        };
        if (src.patch && typeof src.patch === 'object' && !Array.isArray(src.patch)) return normalizePresentationPatch(src.patch);
        const data = (src.data && typeof src.data === 'object') ? src.data : {};
        if (data.patch && typeof data.patch === 'object' && !Array.isArray(data.patch)) return normalizePresentationPatch(data.patch);
        if (data.statusPatch && typeof data.statusPatch === 'object' && !Array.isArray(data.statusPatch)) {
            return {
                ...data.statusPatch,
                ...(Object.prototype.hasOwnProperty.call(data, 'done') ? { done: !!data.done } : {}),
            };
        }
        if (String(src.type || src.opType || '').trim() === 'contentPatch') {
            const nextContent = Object.prototype.hasOwnProperty.call(src, 'nextContent') ? src.nextContent : data.nextContent;
            if (Object.prototype.hasOwnProperty.call(src, 'nextContent') || Object.prototype.hasOwnProperty.call(data, 'nextContent')) {
                return { content: String(nextContent || '').trim() };
            }
        }
        if (String(src.type || src.opType || '').trim() === 'setDone') {
            return {
                ...(data.statusPatch && typeof data.statusPatch === 'object' ? data.statusPatch : {}),
                done: !!data.done,
            };
        }
        return {};
    };

    const normalizeTaskMutationAffected = (mutation = {}, base = {}) => {
        const src = (mutation && typeof mutation === 'object') ? mutation : {};
        const data = (src.data && typeof src.data === 'object') ? src.data : {};
        const raw = (src.affected && typeof src.affected === 'object') ? src.affected : {};
        const snapshot = (src.snapshot && typeof src.snapshot === 'object') ? src.snapshot : ((data.snapshot && typeof data.snapshot === 'object') ? data.snapshot : null);
        const taskIds = new Set();
        const subtreeIds = new Set();
        const parentTaskIds = new Set();
        const docIds = new Set();
        const aliases = new Set();
        const add = (set, value) => {
            const id = normalizeId(value);
            if (id) set.add(id);
        };
        const addAll = (set, values) => {
            (Array.isArray(values) ? values : []).forEach((value) => add(set, value));
        };
        const walkTask = (task) => {
            if (!(task && typeof task === 'object')) return;
            const id = normalizeId(task.id || task.blockId);
            if (id) {
                taskIds.add(id);
                subtreeIds.add(id);
            }
            (Array.isArray(task.children) ? task.children : []).forEach(walkTask);
        };
        const mode = normalizeId(data.mode);
        const previousParentTaskId = normalizeId(
            raw.previousParentTaskId
            || src.previousParentTaskId
            || data.previousParentTaskId
            || snapshot?.parentTaskId
        );
        const nextParentTaskId = normalizeId(
            raw.nextParentTaskId
            || src.nextParentTaskId
            || data.nextParentTaskId
            || data.parentTaskId
            || data.targetParentTaskId
            || ((mode === 'child' || mode === 'child-top') ? data.targetTaskId : '')
        );

        [
            base.taskId,
            base.tempId,
            base.realId,
            base.parentTaskId,
            base.targetTaskId,
            src.taskId,
            src.tempId,
            src.realId,
            data.taskId,
            data.tempId,
            data.realId,
            data.insertedTaskId,
            data.sourceTaskId,
            data.parentTaskId,
            data.targetTaskId,
            data.targetParentTaskId,
            snapshot?.taskId,
            snapshot?.task?.id,
        ].forEach((id) => add(taskIds, id));
        addAll(taskIds, src.taskIds);
        addAll(taskIds, raw.taskIds);
        addAll(taskIds, raw.parentTaskIds);
        addAll(taskIds, raw.subtreeIds);
        addAll(taskIds, data.scheduleCleanupTaskIds);
        addAll(subtreeIds, raw.subtreeIds);
        addAll(subtreeIds, data.scheduleCleanupTaskIds);
        walkTask(snapshot?.task);
        walkTask(src.task);
        walkTask(raw.task);

        [
            base.parentTaskId,
            previousParentTaskId,
            nextParentTaskId,
            data.parentTaskId,
            data.targetParentTaskId,
            (mode === 'child' || mode === 'child-top') ? data.targetTaskId : '',
            snapshot?.parentTaskId,
            snapshot?.task?.parentTaskId,
            snapshot?.task?.parent_task_id,
        ].forEach((id) => add(parentTaskIds, id));
        addAll(parentTaskIds, raw.parentTaskIds);

        [
            base.docId,
            src.docId,
            data.docId,
            data.targetDocId,
            snapshot?.docId,
            snapshot?.task?.docId,
            snapshot?.task?.root_id,
        ].forEach((id) => add(docIds, id));
        addAll(docIds, raw.docIds);

        [
            base.tempId,
            base.realId,
            src.tempId,
            src.realId,
            data.tempId,
            data.realId,
            data.originalTempId,
            data.insertedTaskId,
        ].forEach((id) => add(aliases, id));
        addAll(aliases, raw.aliases);

        return {
            taskIds: Array.from(taskIds),
            subtreeIds: Array.from(subtreeIds),
            parentTaskIds: Array.from(parentTaskIds),
            docIds: Array.from(docIds),
            aliases: Array.from(aliases),
            previousParentTaskId,
            nextParentTaskId,
            primaryTaskId: normalizeId(raw.primaryTaskId || base.taskId || src.taskId || data.taskId || data.sourceTaskId),
            type: normalizeId(raw.type || src.type || src.opType || src.kind),
        };
    };

    const normalizeTaskMutation = (mutation = {}) => {
        const src = (mutation && typeof mutation === 'object') ? mutation : {};
        const data = (src.data && typeof src.data === 'object') ? src.data : {};
        const type = normalizeId(src.type || src.opType || src.kind) || 'unknown';
        const phase = normalizeId(src.phase) || 'local';
        const tempId = normalizeId(src.tempId || data.tempId || data.originalTempId);
        const realId = normalizeId(src.realId || src.blockId || data.realId || data.insertedTaskId || data.taskId);
        const taskId = normalizeId(src.taskId || data.taskId || data.sourceTaskId || realId || tempId);
        const parentTaskId = normalizeId(src.parentTaskId || data.parentTaskId || data.targetParentTaskId);
        const targetTaskId = normalizeId(src.targetTaskId || data.targetTaskId);
        const clientId = normalizeId(src.clientId || data.clientId);
        const docId = normalizeId(src.docId || data.docId || data.targetDocId);
        const previousDocId = normalizeId(src.previousDocId || data.previousDocId || data.sourceDocId || src.fromDocId || data.fromDocId || src.snapshot?.docId || data.snapshot?.docId);
        const nextDocId = normalizeId(src.nextDocId || data.nextDocId || data.targetDocId || src.toDocId || data.toDocId || docId);
        const affected = normalizeTaskMutationAffected(src, { taskId, tempId, realId, parentTaskId, targetTaskId, docId });
        const ids = new Set();
        [taskId, tempId, realId, parentTaskId, targetTaskId].forEach((id) => {
            const tid = normalizeId(id);
            if (tid) ids.add(tid);
        });
        (Array.isArray(src.taskIds) ? src.taskIds : []).forEach((id) => {
            const tid = normalizeId(id);
            if (tid) ids.add(tid);
        });
        [
            ...(Array.isArray(affected.taskIds) ? affected.taskIds : []),
            ...(Array.isArray(affected.parentTaskIds) ? affected.parentTaskIds : []),
            ...(Array.isArray(affected.subtreeIds) ? affected.subtreeIds : []),
            ...(Array.isArray(affected.aliases) ? affected.aliases : []),
        ].forEach((id) => {
            const tid = normalizeId(id);
            if (tid) ids.add(tid);
        });
        const passthrough = {};
        Object.entries(src).forEach(([key, value]) => {
            if (key === 'data' || key === 'task' || key === 'snapshot') return;
            if (typeof value === 'function') return;
            passthrough[key] = cloneTaskMutationValue(value);
        });
        return {
            ...passthrough,
            mutationId: normalizeId(src.mutationId || src.id) || `tmmut_${Date.now()}_${++__tmTaskMutationState.seq}`,
            type,
            phase,
            taskId,
            tempId,
            realId,
            clientId,
            parentTaskId,
            targetTaskId,
            docId,
            previousDocId,
            nextDocId,
            opId: normalizeId(src.opId || data.opId),
            source: normalizeId(src.source || data.source || src.reason || data.reason || `${type}-${phase}`),
            patch: normalizeTaskMutationPatch(src),
            affected,
            taskIds: Array.from(ids),
            data,
            task: src.task,
            snapshot: src.snapshot,
            createdAt: Math.max(0, Number(src.createdAt) || Date.now()),
};
    };

    const notifyTaskMutation = (mutation = {}) => {
        const normalized = normalizeTaskMutation(mutation);
        try { __tmMarkMobileCloseSyncDirtyForTaskMutation(normalized); } catch (e) {}
        Array.from(__tmTaskMutationState.listeners).forEach((handler) => {
            try { handler(normalized); } catch (e) {}
        });
        return normalized;
    };

    const subscribeTaskMutation = (handler) => {
        if (typeof handler !== 'function') return () => false;
        __tmTaskMutationState.listeners.add(handler);
        return () => {
            try { return __tmTaskMutationState.listeners.delete(handler); } catch (e) { return false; }
        };
    };

    const applyTaskMutation = (mutation = {}, options = {}) => {
        const normalized = normalizeTaskMutation(mutation);
        const opts = (options && typeof options === 'object') ? options : {};
        if (normalized.phase === 'optimistic') beginTaskOverlay(normalized);
        else if (normalized.phase === 'local') settleTaskOverlay(normalized, true);
        else if (normalized.phase === 'commit') settleTaskOverlay(normalized, true);
        else if (normalized.phase === 'rollback') settleTaskOverlay(normalized, false);
        try { rememberPendingStructuralMutation(normalized); } catch (e) {}
        if (opts.applyLocal !== false) {
            if (normalized.phase === 'rollback') {
                rollbackMutationLocal(normalized);
                return notifyTaskMutation(normalized);
            }
            if (normalized.tempId || normalized.realId || normalized.clientId) {
                try {
                    rememberTaskIdentity({
                        clientId: normalized.clientId,
                        tempId: normalized.tempId,
                        blockId: normalized.realId,
                        kind: normalized.type,
                        status: normalized.phase === 'commit' && normalized.realId ? 'committed' : normalized.phase,
                    });
                } catch (e) {}
            }
            if (normalized.type !== 'commitTaskId' && normalized.phase === 'commit' && normalized.tempId && normalized.realId) {
                commitTaskIdLocal(normalized.tempId, normalized.realId, {
                    clientId: normalized.clientId,
                    keepPending: true,
                });
            }
            if (normalized.type === 'commitTaskId' && normalized.tempId && normalized.realId) {
                commitTaskIdLocal(normalized.tempId, normalized.realId, {
                    clientId: normalized.clientId,
                    keepPending: true,
                });
            }
            if ((normalized.type === 'taskPatch' || normalized.type === 'contentPatch' || normalized.type === 'setDone')
                && normalized.taskId && Object.keys(normalized.patch || {}).length) {
                patchTaskLocal(normalized.taskId, normalized.patch, {
                    source: normalized.source,
                });
            } else if (normalized.type === 'deleteTask' && normalized.taskId) {
                deleteTaskLocal(normalized.snapshot || normalized.taskId, {
                    taskId: normalized.taskId,
                    source: normalized.source,
                });
            } else if (normalized.type === 'taskLifecycle'
                && normalizeId(normalized.data?.action) === 'archiveDeleted'
                && normalized.taskId) {
                deleteTaskLocal(normalized.snapshot || normalized.taskId, {
                    taskId: normalized.taskId,
                    source: normalized.source,
                });
            } else if (normalized.type === 'taskLifecycle'
                && normalizeId(normalized.data?.action) === 'restoreDeleted'
                && normalized.taskId) {
                try {
                    if (typeof __tmRollbackDeleteOptimisticLocal === 'function') {
                        __tmRollbackDeleteOptimisticLocal(normalized.snapshot, { mutationDriven: true });
                    }
                } catch (e) {}
            } else if (normalized.type === 'moveTask') {
                const placement = normalized.placement && typeof normalized.placement === 'object'
                    ? normalized.placement
                    : null;
                const authoritativeMove = placement ? (() => {
                    const previousSiblingId = normalizeId(placement.previousSiblingID || placement.previousSiblingId);
                    const nextSiblingId = normalizeId(placement.nextSiblingID || placement.nextSiblingId);
                    const parentTaskId = normalizeId(placement.parentTaskID || placement.parentTaskId);
                    const targetDocId = normalizeId(placement.documentID || placement.documentId || normalized.nextDocId || normalized.docId);
                    if (previousSiblingId) return { mode: 'after', targetTaskId: previousSiblingId, targetDocId, targetParentTaskId: parentTaskId };
                    if (nextSiblingId) return { mode: 'before', targetTaskId: nextSiblingId, targetDocId, targetParentTaskId: parentTaskId };
                    if (parentTaskId) return { mode: 'child-top', targetTaskId: parentTaskId, targetDocId, targetParentTaskId: parentTaskId };
                    return { mode: 'docTop', targetDocId };
                })() : null;
                moveTaskLocal({
                    ...normalized.data,
                    ...(authoritativeMove || {}),
                    taskId: normalized.taskId,
                    targetTaskId: normalized.targetTaskId || normalized.data?.targetTaskId,
                    targetDocId: normalized.nextDocId || normalized.docId || normalized.data?.targetDocId,
                    mode: normalized.data?.mode,
                    snapshot: normalized.snapshot || normalized.data?.snapshot,
                }, {
                    mutationDriven: true,
                    source: normalized.source,
                });
                try {
                    const previousParentTaskId = String(normalized.affected?.previousParentTaskId || '').trim();
                    const nextParentTaskId = String(normalized.affected?.nextParentTaskId || '').trim();
                    const previousDocId = String(normalized.previousDocId || '').trim();
                    const nextDocId = String(normalized.nextDocId || normalized.docId || '').trim();
                    const docChanged = !!previousDocId && !!nextDocId && previousDocId !== nextDocId;
                    const parentChanged = previousParentTaskId !== nextParentTaskId && !!(previousParentTaskId || nextParentTaskId);
                    if (docChanged || parentChanged) {
                        __tmHandleCustomTaskOrderPhysicalMove(normalized.taskId, previousDocId, nextDocId, {
                            nextParentTaskId,
                            preservePlacement: normalized.data?.customOrderPlacement === true,
                        });
                    }
                } catch (e) {}
            } else if ((normalized.type === 'createTaskInDoc' || normalized.type === 'createSubtask' || normalized.type === 'createSibling')
                && normalized.task && typeof normalized.task === 'object') {
                createPendingTaskLocal(normalized.task, {
                    clientId: normalized.clientId,
                    tempId: normalized.tempId || normalized.taskId,
                    blockId: normalized.realId,
                    pending: normalized.phase !== 'commit',
                    kind: normalized.type,
                    status: normalized.phase,
                });
            }
            if ((normalized.phase === 'optimistic' || normalized.phase === 'local')
                && (normalized.type === 'createTaskInDoc' || normalized.type === 'createSubtask' || normalized.type === 'createSibling')) {
                try {
                    __tmRegisterCustomTaskOrderCreatedTask({
                        taskId: normalized.tempId || normalized.realId || normalized.taskId,
                        docId: normalized.docId,
                        parentTaskId: normalized.type === 'createSubtask' ? normalized.parentTaskId : '',
                        sourceTaskId: normalized.type === 'createSibling' ? String(normalized.data?.sourceTaskId || normalized.taskId || '').trim() : '',
                        mode: normalized.type === 'createSubtask'
                            ? 'child'
                            : (normalized.type === 'createSibling' ? 'sibling' : 'root'),
                    });
                } catch (e) {}
            }
        }
        return notifyTaskMutation(normalized);
    };

    const scheduleMutationSnapshotRefresh = (mutation = {}, context = {}, policy = {}) => {
        const m = (mutation && typeof mutation === 'object') ? mutation : {};
        const patch = (context.patch && typeof context.patch === 'object') ? context.patch : {};
        const taskId = normalizeId(context.taskId || m.realId || m.taskId || m.tempId);
        try {
            if (context.structural === true && policy.snapshot === true && typeof __tmScheduleTaskSnapshotAfterLocalStructurePatch === 'function') {
                __tmScheduleTaskSnapshotAfterLocalStructurePatch({
                    docIds: state.__tmLoadedDocIdsForTasks,
                    groupId: SettingsStore?.data?.currentGroupId || 'all',
                    activeDocId: state?.activeDocId || 'all',
                    queryLimit: typeof __TM_TASK_INDEX_QUERY_LIMIT !== 'undefined' ? __TM_TASK_INDEX_QUERY_LIMIT : undefined,
                    source: policy.reason || m.source || `mutation-${normalizeId(m.type) || 'unknown'}`,
                    delayMs: 180,
                    idleDelayMs: 80,
                    protectMs: 30000,
                });
                return true;
            }
            if (context.structural !== true && taskId && Object.keys(patch).length && policy.snapshot !== false && typeof __tmScheduleTaskSnapshotAfterLocalPatch === 'function') {
                __tmScheduleTaskSnapshotAfterLocalPatch(taskId, patch, {
                    source: policy.reason || m.source || `mutation-${normalizeId(m.type) || 'unknown'}`,
                    snapshotDelayMs: 360,
                    snapshotIdleDelayMs: 80,
                });
                return true;
            }
        } catch (e) {}
        return false;
    };

    const normalizeTaskChangeSet = (mutation = {}) => {
        const m = mutation && typeof mutation === 'object' ? mutation : {};
        const raw = m.changeSet && typeof m.changeSet === 'object' ? m.changeSet : {};
        const type = normalizeId(m.type);
        const taskId = normalizeId(m.realId || m.taskId || m.tempId);
        const affected = m.affected && typeof m.affected === 'object' ? m.affected : {};
        const normalizeIds = (values) => Array.from(new Set((Array.isArray(values) ? values : [])
            .map((value) => normalizeId(value?.taskID || value?.taskId || value))
            .filter(Boolean)));
        const structural = type === 'createTaskInDoc' || type === 'createSubtask' || type === 'createSibling'
            || type === 'moveTask' || type === 'deleteTask' || type === 'taskLifecycle' || type === 'commitTaskId';
        const deletedByMutation = isTaskStoreDeleteMutation(m);
        const fieldChanges = Array.isArray(raw.fieldChanges) ? raw.fieldChanges.slice() : [];
        if (!fieldChanges.length && taskId && m.patch && Object.keys(m.patch).length) {
            fieldChanges.push({ taskId, patch: { ...m.patch }, fields: Object.keys(m.patch) });
        }
        return {
            upsertedTaskIds: normalizeIds(raw.upsertedTaskIds?.length
                ? raw.upsertedTaskIds
                : (structural && !deletedByMutation ? [taskId] : [])),
            deletedTaskIds: normalizeIds(raw.deletedTaskIds?.length
                ? raw.deletedTaskIds
                : collectDeletedTaskIds(m)),
            fieldChanges: fieldChanges.map((item) => ({
                taskId: normalizeId(item?.taskId || item?.taskID || taskId),
                patch: item?.patch && typeof item.patch === 'object' ? { ...item.patch } : { ...(m.patch || {}) },
                fields: Array.isArray(item?.fields) ? item.fields.slice() : Object.keys(item?.patch || m.patch || {}),
            })).filter((item) => item.taskId),
            placementChanges: Array.isArray(raw.placementChanges)
                ? raw.placementChanges.slice()
                : (type === 'moveTask' && taskId ? [{ taskId, placement: m.placement || m.data || null }] : []),
            affectedGroupIds: normalizeIds([
                ...(Array.isArray(raw.affectedGroupIds) ? raw.affectedGroupIds : []),
                ...(Array.isArray(affected.parentTaskIds) ? affected.parentTaskIds : []),
                affected.previousParentTaskId,
                affected.nextParentTaskId,
                m.parentTaskId,
                m.targetTaskId,
            ]),
            affectedDocumentIds: normalizeIds([
                ...(Array.isArray(raw.affectedDocumentIds) ? raw.affectedDocumentIds : []),
                ...(Array.isArray(affected.docIds) ? affected.docIds : []),
                m.docId,
                m.previousDocId,
                m.nextDocId,
            ]),
            structural,
        };
    };

    let pendingChangeSetFrame = 0;
    const pendingChangeSets = [];

    const flushTaskChangeSets = () => {
        pendingChangeSetFrame = 0;
        const entries = pendingChangeSets.splice(0, pendingChangeSets.length);
        if (!entries.length) return;
        try { globalThis.__tmTaskProjectionEngine?.flush?.(entries); } catch (e) {}
    };

    const scheduleTaskChangeSet = (mutation, changeSet) => {
        pendingChangeSets.push({ mutation, changeSet });
        if (pendingChangeSetFrame) return true;
        pendingChangeSetFrame = 1;
        try { queueMicrotask(flushTaskChangeSets); }
        catch (e) { Promise.resolve().then(flushTaskChangeSets); }
        return true;
    };

    const __tmProjectionManager = {
        handle(mutation) {
            const normalized = normalizeTaskMutation(mutation);
            const changeSet = normalizeTaskChangeSet(normalized);
            normalized.changeSet = changeSet;
            if (normalized.data?.deferProjection === true) return changeSet;
            if (normalized.phase === 'commit') {
                try {
                    scheduleMutationSnapshotRefresh(normalized, {
                        structural: changeSet.structural,
                        taskId: normalizeId(normalized.realId || normalized.taskId || normalized.tempId),
                        patch: normalized.patch || {},
                    }, {
                        snapshot: true,
                        reason: normalizeId(normalized.source) || 'change-set-commit',
                    });
                } catch (e) {}
            }
            if (normalized.phase === 'optimistic'
                || normalized.phase === 'local'
                || normalized.phase === 'rollback'
                || (normalized.phase === 'commit' && changeSet.structural)) {
                scheduleTaskChangeSet(normalized, changeSet);
            }
            return changeSet;
        },
        subscribe(handler) {
            return subscribeTaskMutation(handler);
        },
    };

    subscribeTaskMutation((mutation) => {
        try { __tmProjectionManager.handle(mutation); } catch (e) {}
    });

    const checkTaskConsistency = () => {
        const flatIds = new Set(Object.keys((state.flatTasks && typeof state.flatTasks === 'object') ? state.flatTasks : {}));
        const pendingIds = new Set(Object.keys((state.pendingInsertedTasks && typeof state.pendingInsertedTasks === 'object') ? state.pendingInsertedTasks : {}));
        const identityStore = pruneTaskClientStore();
        const treeIds = new Set();
        const duplicateTreeIds = [];
        const parentMismatches = [];
        const flatTreeMismatches = [];
        const seenTreeIds = new Map();
        const parentByTreeId = new Map();
        const docByTreeId = new Map();
        const walk = (tasks, parentId = '', docId = '') => {
            (Array.isArray(tasks) ? tasks : []).forEach((task) => {
                const tid = normalizeId(task?.id);
                if (tid) {
                    if (seenTreeIds.has(tid)) {
                        duplicateTreeIds.push({
                            taskId: tid,
                            firstParentTaskId: seenTreeIds.get(tid)?.parentTaskId || '',
                            parentTaskId,
                            docId,
                        });
                    }
                    seenTreeIds.set(tid, { parentTaskId: parentId, docId });
                    treeIds.add(tid);
                    parentByTreeId.set(tid, parentId);
                    docByTreeId.set(tid, docId);
                    const explicitParentId = normalizeId(task?.parentTaskId || task?.parent_task_id);
                    if (explicitParentId !== parentId) {
                        parentMismatches.push({
                            taskId: tid,
                            expectedParentTaskId: parentId,
                            actualParentTaskId: explicitParentId,
                            source: 'taskTree',
                        });
                    }
                }
                walk(task?.children, tid, docId);
            });
        };
        try {
            (Array.isArray(state.taskTree) ? state.taskTree : []).forEach((doc) => {
                walk(doc?.tasks, '', normalizeId(doc?.id));
            });
        } catch (e) {}
        try {
            flatIds.forEach((id) => {
                const task = state.flatTasks?.[id];
                if (!(task && typeof task === 'object')) return;
                const treeParentId = parentByTreeId.get(id);
                const flatParentId = normalizeId(task.parentTaskId || task.parent_task_id);
                if (treeParentId !== undefined && treeParentId !== flatParentId) {
                    parentMismatches.push({
                        taskId: id,
                        expectedParentTaskId: treeParentId,
                        actualParentTaskId: flatParentId,
                        source: 'flatTasks',
                    });
                }
                const treeDocId = docByTreeId.get(id);
                const flatDocId = normalizeId(task.docId || task.root_id);
                if (treeDocId && flatDocId && treeDocId !== flatDocId) {
                    flatTreeMismatches.push({
                        taskId: id,
                        field: 'docId',
                        treeValue: treeDocId,
                        flatValue: flatDocId,
                    });
                }
            });
        } catch (e) {}
        const missingFlat = Array.from(treeIds).filter((id) => !flatIds.has(id) && !pendingIds.has(id));
        const missingTree = Array.from(flatIds).filter((id) => !treeIds.has(id) && !pendingIds.has(id));
        const pendingDeletedFlat = Array.from(flatIds).filter((id) => isPendingDeletedTaskId(id));
        const pendingDeletedTree = Array.from(treeIds).filter((id) => isPendingDeletedTaskId(id));
        const pendingDeletedPending = Array.from(pendingIds).filter((id) => isPendingDeletedTaskId(id));
        const danglingSelectionIds = [];
        try {
            [
                ['detailTaskId', state.detailTaskId],
                ['kanbanDetailTaskId', state.kanbanDetailTaskId],
                ['kanbanDetailAnchorTaskId', state.kanbanDetailAnchorTaskId],
                ['timerFocusTaskId', state.timerFocusTaskId],
                ['draggingTaskId', state.draggingTaskId],
                ['whiteboardSelectedTaskId', state.whiteboardSelectedTaskId],
            ].forEach(([key, value]) => {
                const id = normalizeId(value);
                if (!id) return;
                const aliases = getTaskIdAliases(id);
                const exists = aliases.some((alias) => flatIds.has(alias) || pendingIds.has(alias) || treeIds.has(alias));
                if (!exists) danglingSelectionIds.push({ key, taskId: id });
            });
        } catch (e) {}
        const identityGaps = [];
        try {
            Object.values(identityStore).forEach((item) => {
                const clientId = normalizeId(item?.clientId);
                const tempId = normalizeId(item?.tempId);
                const blockId = normalizeId(item?.blockId || item?.realId);
                if (!clientId || (!tempId && !blockId)) return;
                const hasTemp = tempId && (flatIds.has(tempId) || pendingIds.has(tempId) || treeIds.has(tempId));
                const hasBlock = blockId && (flatIds.has(blockId) || pendingIds.has(blockId) || treeIds.has(blockId));
                if (blockId && tempId && hasTemp && !hasBlock) {
                    identityGaps.push({ clientId, tempId, blockId, reason: 'committed-id-missing' });
                }
                if (!blockId && tempId && !hasTemp) {
                    identityGaps.push({ clientId, tempId, blockId, reason: 'pending-temp-missing' });
                }
            });
        } catch (e) {}
        let mutation = null;
        try { mutation = globalThis.__tmTaskMutations?.status?.() || null; } catch (e) {}
        let mutationRefs = [];
        try { mutationRefs = globalThis.__tmTaskMutations?.pendingRefs?.({ limit: 80 }) || []; } catch (e) {}
        const staleDeletedCount = pendingDeletedFlat.length + pendingDeletedTree.length + pendingDeletedPending.length;
        const structuralIssueCount = duplicateTreeIds.length + parentMismatches.length + flatTreeMismatches.length + danglingSelectionIds.length;
        return {
            ok: missingFlat.length === 0 && staleDeletedCount === 0 && identityGaps.length === 0 && structuralIssueCount === 0,
            flatCount: flatIds.size,
            pendingCount: pendingIds.size,
            treeCount: treeIds.size,
            identityCount: Object.keys(identityStore || {}).length,
            missingFlat: missingFlat.slice(0, 80),
            missingTree: missingTree.slice(0, 80),
            duplicateTreeIds: duplicateTreeIds.slice(0, 80),
            parentMismatches: parentMismatches.slice(0, 80),
            flatTreeMismatches: flatTreeMismatches.slice(0, 80),
            danglingSelectionIds: danglingSelectionIds.slice(0, 80),
            pendingDeletedFlat: pendingDeletedFlat.slice(0, 80),
            pendingDeletedTree: pendingDeletedTree.slice(0, 80),
            pendingDeletedPending: pendingDeletedPending.slice(0, 80),
            identityGaps: identityGaps.slice(0, 80),
            mutation,
            mutationRefs,
        };
    };

    const taskStore = {
        normalizeId,
        createClientId: createTaskClientId,
        rememberIdentity: rememberTaskIdentity,
        commitIdentity: commitTaskIdentity,
        getIdentity: findTaskIdentity,
        resolveId: resolveOptimisticTaskId,
        getAliases: getTaskIdAliases,
        get: getTaskById,
        getFlat: getFlatTaskById,
        getPending: getPendingTaskById,
        getFlatMap: () => ensureFlatTaskMap(),
        getPendingMap: () => ensurePendingInsertedTaskMap(),
        getPendingDeletedMap: () => ensurePendingDeletedTaskMap(),
        listFlat: () => Object.values(ensureFlatTaskMap()).filter((task) => task && typeof task === 'object'),
        listPending: () => Object.values(ensurePendingInsertedTaskMap()).filter((task) => task && typeof task === 'object'),
        patchLocal: patchTaskLocal,
        patchPending: patchPendingInsertedTaskLocal,
        mutateLocal: mutateLocalTask,
        upsertLocal: upsertTaskLocal,
        replaceFlat: replaceFlatTasksLocal,
        acceptAuthoritative: acceptAuthoritativeTasksLocal,
        captureRead: captureTaskStoreRead,
        isReadCurrent: isTaskStoreReadCurrent,
        revision: () => taskStoreRevision,
        getConfirmed: (taskId) => cloneTaskRecord(confirmedTaskBase.get(normalizeId(taskId))),
        getProjected: (taskId) => projectTaskFromBase(taskId, getTaskById(taskId, { includePending: true, preferPending: true })),
        listProjectedDirectChildren,
        projectRead: projectTaskRead,
        listPendingOverlays: () => Array.from(pendingTaskOverlays.values()).map((entry) => ({
            ...entry,
            taskIds: Array.isArray(entry.taskIds) ? entry.taskIds.slice() : [],
            patch: { ...(entry.patch || {}) },
        })),
        hasPendingCompletionOverlay,
        clearFlat: clearFlatTasksLocal,
        removeFlatByDoc: removeFlatTasksByDocLocal,
        createPendingTask: createPendingTaskLocal,
        removePending: removePendingInsertedTaskLocal,
        deletePendingProps: deletePendingInsertedTaskPropsLocal,
        markPendingDeleted: markPendingDeletedTaskLocal,
        forgetPendingDeleted: forgetPendingDeletedTaskLocal,
        commitTaskId: commitTaskIdLocal,
        moveTaskLocal,
        deleteTaskLocal,
        rollbackMutation: rollbackMutationLocal,
        normalizeMoveMode: normalizeTaskMoveMode,
        rememberPendingStructural: rememberPendingStructuralMutation,
        mergePendingStructuralRows,
        getPendingStructural: (taskId) => {
            prunePendingStructuralMutations();
            return pendingStructuralMutations.get(normalizeId(taskId)) || null;
        },
        listPendingStructural: () => Array.from(prunePendingStructuralMutations().values()).map((entry) => ({ ...entry })),
        clearPendingStructural: (taskId) => pendingStructuralMutations.delete(normalizeId(taskId)),
        insertPending(task, options = {}) {
            return upsertTaskLocal(task, { ...(options && typeof options === 'object' ? options : {}), pending: true });
        },
        removeLocal: removeTaskLocal,
        remapLocalId: remapTaskLocalId,
        applyMutation: applyTaskMutation,
        publishMutation: notifyTaskMutation,
        subscribe: subscribeTaskMutation,
        checkConsistency: checkTaskConsistency,
    };

    globalThis.__tmTaskIdentity = {
        createClientId: createTaskClientId,
        remember: rememberTaskIdentity,
        register: rememberTaskIdentity,
        commit: commitTaskIdentity,
        get: findTaskIdentity,
        resolve: resolveTaskIdentityId,
        status: () => ({ size: Object.keys(pruneTaskClientStore()).length }),
    };

    globalThis.__tmTaskStore = taskStore;
    globalThis.__tmTaskMutationBus = {
        publish: notifyTaskMutation,
        apply: applyTaskMutation,
        subscribe: subscribeTaskMutation,
        normalize: normalizeTaskMutation,
    };
    globalThis.__tmTaskProjectionManager = __tmProjectionManager;
    globalThis.__tmTaskHorizonConsistency = {
        check: checkTaskConsistency,
    };

    const runtimeStateFacade = {
        normalizeId,
        getModal,
        hasLiveModal,
        getOpenToken,
        nextOpenToken,
        isCurrentOpenToken,
        resolveOptimisticTaskId,
        getTaskIdAliases,
        isPendingDeletedTaskId,
        getViewMode,
        isViewMode,
        isAnyViewMode,
        getActiveRenderMode,
        getFlatTasks: () => taskStore.getFlatMap(),
        getFlatTaskById,
        getPendingTaskById,
        getTaskById,
        taskStore,
    };
    globalThis.__tmRuntimeState = runtimeStateFacade;
    globalThis.__tmRuntimeReadFacade = runtimeStateFacade;

    const on = (target, name, handler, options) => {
        if (!target || typeof target.addEventListener !== 'function') return false;
        if (!String(name || '').trim() || typeof handler !== 'function') return false;
        try {
            target.addEventListener(name, handler, options);
            return true;
        } catch (e) {
            return false;
        }
    };

    const off = (target, name, handler, options) => {
        if (!target || typeof target.removeEventListener !== 'function') return false;
        if (!String(name || '').trim() || typeof handler !== 'function') return false;
        try {
            target.removeEventListener(name, handler, options);
            return true;
        } catch (e) {
            return false;
        }
    };

    const listen = (target, name, handler, options) => {
        if (!on(target, name, handler, options)) return () => false;
        return () => off(target, name, handler, options);
    };

    const getEventBus = () => {
        try {
            return globalThis.__tmHost?.getEventBus?.() || null;
        } catch (e) {
            return null;
        }
    };

    const onEventBus = (name, handler, eventBus = null) => {
        const bus = eventBus || getEventBus();
        if (!bus || typeof bus.on !== 'function') return false;
        if (!String(name || '').trim() || typeof handler !== 'function') return false;
        try {
            bus.on(name, handler);
            return true;
        } catch (e) {
            return false;
        }
    };

    const offEventBus = (name, handler, eventBus = null) => {
        const bus = eventBus || getEventBus();
        if (!bus || typeof bus.off !== 'function') return false;
        if (!String(name || '').trim() || typeof handler !== 'function') return false;
        try {
            bus.off(name, handler);
            return true;
        } catch (e) {
            return false;
        }
    };

    globalThis.__tmRuntimeEvents = {
        on,
        off,
        listen,
        getEventBus,
        onEventBus,
        offEventBus,
    };
})();
