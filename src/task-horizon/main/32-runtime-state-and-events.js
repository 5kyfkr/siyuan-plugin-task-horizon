(function () {
    const __TM_RUNTIME_STATE_DEFAULT_MODAL = Symbol('tm-runtime-state-default-modal');

    // Runtime facade: view/session state only. Task data changes belong to taskStore below.
    const normalizeId = (value) => String(value || '').trim();

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
        if (opts.mergeOtherBlocks !== false) nextMap = mergeOtherBlocksIntoTaskStoreFlatMap(nextMap);
        try { state.flatTasks = nextMap; } catch (e) {}
        markTaskStoreDirty();
        return state.flatTasks || nextMap;
    };

    const clearFlatTasksLocal = (options = {}) => {
        return replaceFlatTasksLocal({}, options);
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
            task[key] = value;
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

    const mergeTaskStoreTask = (target, source) => {
        if (!(target && typeof target === 'object') || !(source && typeof source === 'object')) return false;
        const prevChildren = Array.isArray(target.children) ? target.children : null;
        Object.assign(target, source);
        if ((!Array.isArray(source.children) || source.children.length === 0) && prevChildren) {
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
            if (state.flatTasks[tid] && state.flatTasks[tid] !== nextTask) mergeTaskStoreTask(state.flatTasks[tid], nextTask);
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
                    mergeTaskStoreTask(state.pendingInsertedTasks[tid], pendingTask);
                } else {
                    state.pendingInsertedTasks[tid] = pendingTask;
                }
            } catch (e) {}
        }
        try {
            visitTaskStoreListsById([tid], (taskLike) => {
                mergeTaskStoreTask(taskLike, nextTask);
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
        try {
            aliases.forEach((alias) => {
                const task = state.flatTasks?.[alias] || state.pendingInsertedTasks?.[alias];
                if (task && typeof task === 'object') mergedTask = { ...(mergedTask || {}), ...task };
            });
            if (state.flatTasks?.[to]) mergedTask = { ...(mergedTask || {}), ...state.flatTasks[to] };
            if (state.pendingInsertedTasks?.[to]) mergedTask = { ...(mergedTask || {}), ...state.pendingInsertedTasks[to] };
            if (mergedTask) {
                mergedTask.id = to;
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
            ['whiteboardMultiSelectedTaskIds', 'whiteboardPoolSelectedTaskIds', '__tmChecklistItemsOnlyRefreshTaskIds', '__tmChecklistProjectionGroupRefreshTaskIds'].forEach((key) => {
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
        const opts = (options && typeof options === 'object') ? options : {};
        try {
            if (typeof __tmApplyMoveOptimisticLocal === 'function') {
                return __tmApplyMoveOptimisticLocal({
                    ...data,
                    deferOptimisticRender: opts.mutationDriven === true ? true : data.deferOptimisticRender === true,
                    skipOptimisticFilterWork: opts.mutationDriven === true ? true : data.skipOptimisticFilterWork === true,
                    mutationDriven: opts.mutationDriven === true,
                }) !== false;
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
        log: [],
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
        if (src.patch && typeof src.patch === 'object' && !Array.isArray(src.patch)) return { ...src.patch };
        const data = (src.data && typeof src.data === 'object') ? src.data : {};
        if (data.patch && typeof data.patch === 'object' && !Array.isArray(data.patch)) return { ...data.patch };
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
            if (key === 'data' || key === 'task' || key === 'snapshot' || key === 'perfTrace') return;
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
        try {
            __tmTaskMutationState.log.push({
                ...cloneTaskMutationValue({
                    ...normalized,
                    data: undefined,
                    task: undefined,
                    snapshot: undefined,
}),
                task: undefined,
                snapshot: undefined,
});
            if (__tmTaskMutationState.log.length > 120) __tmTaskMutationState.log.splice(0, __tmTaskMutationState.log.length - 120);
        } catch (e) {}
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
            if ((normalized.type === 'taskPatch' || normalized.type === 'attrPatch' || normalized.type === 'contentPatch' || normalized.type === 'setDone')
                && normalized.taskId && Object.keys(normalized.patch || {}).length) {
                patchTaskLocal(normalized.taskId, normalized.patch, {
                    source: normalized.source,
                });
            } else if (normalized.type === 'deleteTask' && normalized.taskId) {
                deleteTaskLocal(normalized.snapshot || normalized.taskId, {
                    taskId: normalized.taskId,
                    source: normalized.source,
                });
            } else if (normalized.type === 'moveTask') {
                moveTaskLocal({
                    ...normalized.data,
                    taskId: normalized.taskId,
                    targetTaskId: normalized.targetTaskId || normalized.data?.targetTaskId,
                    targetDocId: normalized.nextDocId || normalized.docId || normalized.data?.targetDocId,
                    mode: normalized.data?.mode,
                    snapshot: normalized.snapshot || normalized.data?.snapshot,
                }, {
                    mutationDriven: true,
                    source: normalized.source,
                });
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
        }
        return notifyTaskMutation(normalized);
    };

    const addTaskProjectionId = (ids, value) => {
        if (!(ids instanceof Set)) return;
        const raw = normalizeId(value);
        if (!raw) return;
        ids.add(raw);
        try {
            const aliases = globalThis.__tmRuntimeState?.getTaskIdAliases?.(raw);
            (Array.isArray(aliases) ? aliases : []).forEach((id) => {
                const nextId = normalizeId(id);
                if (nextId) ids.add(nextId);
            });
        } catch (e) {}
        try {
            const aliases = globalThis.__tmTaskStore?.getAliases?.(raw);
            (Array.isArray(aliases) ? aliases : []).forEach((id) => {
                const nextId = normalizeId(id);
                if (nextId) ids.add(nextId);
            });
        } catch (e) {}
    };

    const collectProjectionMutationTaskIds = (mutation = {}, affectedTaskIds = []) => {
        const m = (mutation && typeof mutation === 'object') ? mutation : {};
        const data = (m.data && typeof m.data === 'object') ? m.data : {};
        const affected = (m.affected && typeof m.affected === 'object') ? m.affected : {};
        const snapshot = (m.snapshot && typeof m.snapshot === 'object') ? m.snapshot : ((data.snapshot && typeof data.snapshot === 'object') ? data.snapshot : null);
        const ids = new Set();
        [
            m.taskId,
            m.tempId,
            m.realId,
            m.parentTaskId,
            m.targetTaskId,
            data.taskId,
            data.tempId,
            data.realId,
            data.insertedTaskId,
            data.parentTaskId,
            data.sourceTaskId,
            data.targetTaskId,
            data.targetParentTaskId,
            snapshot?.taskId,
            snapshot?.parentTaskId,
            snapshot?.task?.id,
            snapshot?.task?.parentTaskId,
            snapshot?.task?.parent_task_id,
        ].forEach((id) => addTaskProjectionId(ids, id));
        (Array.isArray(m.taskIds) ? m.taskIds : []).forEach((id) => addTaskProjectionId(ids, id));
        (Array.isArray(affectedTaskIds) ? affectedTaskIds : []).forEach((id) => addTaskProjectionId(ids, id));
        (Array.isArray(affected.taskIds) ? affected.taskIds : []).forEach((id) => addTaskProjectionId(ids, id));
        (Array.isArray(affected.parentTaskIds) ? affected.parentTaskIds : []).forEach((id) => addTaskProjectionId(ids, id));
        (Array.isArray(affected.subtreeIds) ? affected.subtreeIds : []).forEach((id) => addTaskProjectionId(ids, id));
        (Array.isArray(affected.aliases) ? affected.aliases : []).forEach((id) => addTaskProjectionId(ids, id));
        [
            affected.previousParentTaskId,
            affected.nextParentTaskId,
            affected.primaryTaskId,
        ].forEach((id) => addTaskProjectionId(ids, id));
        (Array.isArray(data.scheduleCleanupTaskIds) ? data.scheduleCleanupTaskIds : []).forEach((id) => addTaskProjectionId(ids, id));
        return Array.from(ids).filter(Boolean);
    };

    const scheduleVisibleDetailProjectionRefresh = (mutation = {}, affectedTaskIds = [], options = {}) => {
        if (typeof __tmScheduleViewRefresh !== 'function') return false;
        if (typeof __tmCollectVisibleTaskDetailTargetIds !== 'function') return false;
        const ids = collectProjectionMutationTaskIds(mutation, affectedTaskIds);
        if (!ids.length) return false;
        const targets = (() => {
            try { return __tmCollectVisibleTaskDetailTargetIds(); } catch (e) { return []; }
        })();
        if (!Array.isArray(targets) || !targets.length) return false;
        const detailIds = new Set();
        targets.forEach((targetId) => {
            const tid = normalizeId(targetId);
            if (!tid) return;
            const hit = ids.some((id) => {
                try {
                    if (typeof __tmAreTaskDetailIdsEquivalent === 'function') return __tmAreTaskDetailIdsEquivalent(id, tid);
                } catch (e) {}
                return normalizeId(id) === tid;
            });
            if (hit) detailIds.add(tid);
        });
        if (!detailIds.size) return false;
        __tmScheduleViewRefresh({
            mode: 'detail',
            withFilters: false,
            reason: normalizeId(options.reason) || normalizeId(mutation?.source) || `mutation-${normalizeId(mutation?.type) || 'detail'}`,
            taskIds: Array.from(detailIds),
            forceRebuild: options.forceRebuild === true,
        });
        return true;
    };

    const __tmProjectionManager = {
        handle(mutation) {
            const m = normalizeTaskMutation(mutation);
            const type = m.type;
            const patch = (m.patch && typeof m.patch === 'object') ? m.patch : {};
            const taskId = normalizeId(m.realId || m.taskId || m.tempId);
            const affected = (m.affected && typeof m.affected === 'object') ? m.affected : {};
            const affectedTaskIds = Array.from(new Set([
                ...((Array.isArray(affected.taskIds) ? affected.taskIds : [])),
                ...((Array.isArray(affected.parentTaskIds) ? affected.parentTaskIds : [])),
                ...((Array.isArray(affected.subtreeIds) ? affected.subtreeIds : [])),
                ...((Array.isArray(affected.aliases) ? affected.aliases : [])),
                ...((Array.isArray(m.taskIds) ? m.taskIds : [])),
            ].map((id) => normalizeId(id)).filter(Boolean)));
            const parentTaskId = normalizeId(m.parentTaskId || affected.nextParentTaskId || affected.previousParentTaskId);
            const structural = type === 'createTaskInDoc'
                || type === 'createSubtask'
                || type === 'createSibling'
                || type === 'deleteTask'
                || type === 'moveTask'
                || type === 'commitTaskId';

            try {
                if (structural && typeof __tmScheduleTaskSnapshotAfterLocalStructurePatch === 'function') {
                    __tmScheduleTaskSnapshotAfterLocalStructurePatch({
                        docIds: state.__tmLoadedDocIdsForTasks,
                        groupId: SettingsStore?.data?.currentGroupId || 'all',
                        activeDocId: state?.activeDocId || 'all',
                        queryLimit: typeof __TM_TASK_INDEX_QUERY_LIMIT !== 'undefined' ? __TM_TASK_INDEX_QUERY_LIMIT : undefined,
                        source: m.source || `mutation-${type}`,
                        delayMs: 180,
                        idleDelayMs: 80,
                        protectMs: 30000,
                    });
                } else if (taskId && Object.keys(patch).length && typeof __tmScheduleTaskSnapshotAfterLocalPatch === 'function') {
                    __tmScheduleTaskSnapshotAfterLocalPatch(taskId, patch, {
                        source: m.source || `mutation-${type}`,
                        snapshotDelayMs: 360,
                        snapshotIdleDelayMs: 80,
                    });
                }
            } catch (e) {}

            try {
                if (type === 'createSubtask') {
                    const detailScheduled = scheduleVisibleDetailProjectionRefresh(m, affectedTaskIds, {
                        reason: m.source || 'mutation-create-subtask-detail',
                    });
                    const checklistScheduled = typeof __tmScheduleChecklistOptimisticSubtaskRefresh === 'function'
                        ? __tmScheduleChecklistOptimisticSubtaskRefresh(parentTaskId, taskId) === true
                        : false;
                    if (typeof __tmScheduleViewRefresh === 'function') {
                        __tmScheduleViewRefresh({
                            mode: 'current',
                            withFilters: false,
                            reason: m.source || 'mutation-create-subtask',
                            taskIds: affectedTaskIds.length
                                ? affectedTaskIds
                                : Array.from(new Set([parentTaskId, taskId].filter(Boolean))),
                        });
                    }
                    return;
                }
                if (type === 'commitTaskId') {
                    const ids = Array.from(new Set([m.tempId, m.realId, m.taskId, ...affectedTaskIds].map((id) => normalizeId(id)).filter(Boolean)));
                    const detailScheduled = parentTaskId
                        ? false
                        : scheduleVisibleDetailProjectionRefresh(m, affectedTaskIds, {
                            reason: m.source || 'mutation-commit-task-id-detail',
                        });
                    let checklistScheduled = false;
                    if (parentTaskId && typeof __tmScheduleChecklistOptimisticSubtaskRefresh === 'function') {
                        checklistScheduled = __tmScheduleChecklistOptimisticSubtaskRefresh(parentTaskId, taskId) === true;
                    }
                    if (parentTaskId && typeof __tmScheduleViewRefresh === 'function') {
                        __tmScheduleViewRefresh({
                            mode: 'detail',
                            withFilters: false,
                            reason: m.source || 'mutation-commit-task-id',
                            taskIds: Array.from(new Set([parentTaskId, ...ids].filter(Boolean))),
                        });
                        if (!checklistScheduled) {
                            __tmScheduleViewRefresh({
                                mode: 'current',
                                withFilters: false,
                                reason: m.source || 'mutation-commit-task-id-current-fallback',
                                taskIds: ids,
                            });
                        }
                        return;
                    }
                    if (taskId && typeof __tmScheduleViewRefresh === 'function') {
                        __tmScheduleViewRefresh({
                            mode: 'current',
                            withFilters: false,
                            reason: m.source || 'mutation-commit-task-id',
                            taskIds: ids,
                        });
                    }
                    return;
                }
                if (type === 'moveTask' || type === 'deleteTask') {
                    const detailScheduled = scheduleVisibleDetailProjectionRefresh(m, affectedTaskIds, {
                        reason: m.source || `mutation-${type}-detail`,
                        forceRebuild: true,
                    });
                    if (m.phase !== 'commit' && typeof __tmScheduleViewRefresh === 'function') {
                        __tmScheduleViewRefresh({
                            mode: 'current',
                            withFilters: m.phase === 'rollback',
                            reason: m.source || `mutation-${type}`,
                            taskIds: affectedTaskIds.length ? affectedTaskIds : m.taskIds,
                        });
                    }
                    return;
                }
                if ((type === 'createTaskInDoc' || type === 'createSibling') && taskId && typeof __tmScheduleViewRefresh === 'function') {
                    __tmScheduleViewRefresh({
                        mode: 'current',
                        withFilters: false,
                        reason: m.source || `mutation-${type}`,
                        taskIds: affectedTaskIds.length ? affectedTaskIds : [taskId],
                    });
                    return;
                }
                if (type === 'deleteTask' && typeof __tmScheduleViewRefresh === 'function') {
                    __tmScheduleViewRefresh({
                        mode: 'current',
                        withFilters: false,
                        reason: m.source || 'mutation-delete',
                        taskIds: affectedTaskIds.length ? affectedTaskIds : m.taskIds,
                    });
                    return;
                }
                if (structural && taskId && Object.keys(patch).length && typeof __tmScheduleTaskProjectionRefresh === 'function') {
                    __tmScheduleTaskProjectionRefresh(taskId, patch, {
                        withFilters: false,
                        reason: m.source || `mutation-${type}`,
                        forceProjectionRefresh: false,
                    });
                }
            } catch (e) {}
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
        let outbox = null;
        try { outbox = globalThis.__tmTaskHorizonOutbox?.status?.() || null; } catch (e) {}
        let outboxRefs = [];
        try { outboxRefs = globalThis.__tmTaskHorizonOutbox?.pendingRefs?.({ limit: 80 }) || []; } catch (e) {}
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
            mutationLogSize: __tmTaskMutationState.log.length,
            outbox,
            outboxRefs,
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
        log: () => __tmTaskMutationState.log.slice(),
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
