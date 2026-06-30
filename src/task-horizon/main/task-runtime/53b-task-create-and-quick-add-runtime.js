    function __tmResolveConfiguredQuickAddDocId() {
        const configured = String(SettingsStore.data.newTaskDocId || '').trim();
        if (!configured || configured === '__dailyNote__') return null;
        const exists = state.taskTree.some(d => d.id === configured) || state.allDocuments.some(d => d.id === configured);
        return exists ? configured : null;
    }

    function __tmResolveQuickAddRecentDocMeta(docId, fallback = null) {
        const id = String(docId || '').trim();
        if (!id || id === '__dailyNote__') return null;
        const fromAll = (Array.isArray(state.allDocuments) ? state.allDocuments : [])
            .find((doc) => String(doc?.id || '').trim() === id);
        const fromTree = (Array.isArray(state.taskTree) ? state.taskTree : [])
            .find((doc) => String(doc?.id || '').trim() === id);
        const fb = (fallback && typeof fallback === 'object') ? fallback : null;
        const name = String(fromAll?.name || fromTree?.name || fb?.name || '').trim() || '未命名文档';
        const path = String(fromAll?.path || fromTree?.path || fb?.path || '').trim();
        return { id, name, path };
    }

    function __tmGetQuickAddRecentDocs() {
        const fromSettings = SettingsStore?.data?.quickAddRecentDocs;
        const raw = Array.isArray(fromSettings) ? fromSettings : Storage.get(__TM_QUICK_ADD_RECENT_DOCS_KEY, []);
        const list = __tmNormalizeQuickAddRecentDocs(raw);
        const seen = new Set();
        const out = [];
        list.forEach((entry) => {
            const id = String((typeof entry === 'object' ? entry?.id : entry) || '').trim();
            if (!id || id === '__dailyNote__' || seen.has(id)) return;
            const meta = __tmResolveQuickAddRecentDocMeta(id, entry);
            if (!meta) return;
            seen.add(id);
            out.push({
                ...meta,
                ts: Number(typeof entry === 'object' ? entry?.ts : 0) || 0,
            });
        });
        return out.slice(0, __TM_QUICK_ADD_RECENT_DOCS_LIMIT);
    }

    function __tmRememberQuickAddRecentDoc(docId, fallback = null) {
        const meta = __tmResolveQuickAddRecentDocMeta(docId, fallback);
        if (!meta) return;
        const existing = __tmGetQuickAddRecentDocs()
            .filter((entry) => String(entry?.id || '').trim() !== meta.id);
        const next = [{ ...meta, ts: Date.now() }, ...existing]
            .slice(0, __TM_QUICK_ADD_RECENT_DOCS_LIMIT);
        SettingsStore.data.quickAddRecentDocs = __tmNormalizeQuickAddRecentDocs(next);
        Storage.set(__TM_QUICK_ADD_RECENT_DOCS_KEY, SettingsStore.data.quickAddRecentDocs);
        try { SettingsStore.save()?.catch?.(() => {}); } catch (e) {}
    }

    function __tmResolveDefaultDocId() {
        const configuredDocId = __tmResolveConfiguredQuickAddDocId();
        if (configuredDocId) return configuredDocId;
        if (state.activeDocId && state.activeDocId !== 'all' && !(typeof __tmIsDocTabCustomGroupActiveId === 'function' && __tmIsDocTabCustomGroupActiveId(state.activeDocId))) return state.activeDocId;
        if (state.taskTree && state.taskTree.length > 0) return state.taskTree[0].id;
        if (state.selectedDocIds && state.selectedDocIds.length > 0) return state.selectedDocIds[0];
        const cacheEnt = __tmQuickbarResolveConfiguredDocIds?.__cache;
        if (cacheEnt && Array.isArray(cacheEnt.ids) && (Date.now() - Number(cacheEnt.t || 0)) < 30000) {
            const cachedId = String(cacheEnt.ids.find((id) => String(id || '').trim()) || '').trim();
            if (cachedId) return cachedId;
        }
        return null;
    }

    async function __tmResolveDefaultDocIdAsync() {
        const directId = __tmResolveDefaultDocId();
        if (directId) return directId;
        try {
            const ids = await __tmQuickbarResolveConfiguredDocIds();
            const fallbackId = String((Array.isArray(ids) ? ids : []).find((id) => String(id || '').trim()) || '').trim();
            return fallbackId || null;
        } catch (e) {
            return null;
        }
    }

    function __tmResolveQuickAddDocId() {
        const configured = String(SettingsStore.data.newTaskDocId || '').trim();
        if (configured === '__dailyNote__') return __tmResolveDefaultDocId();
        const configuredDocId = __tmResolveConfiguredQuickAddDocId();
        if (configuredDocId) return configuredDocId;
        return __tmResolveDefaultDocId();
    }

    function __tmResolveConfiguredDailyNoteNotebookId() {
        const configured = String(SettingsStore.data.newTaskDailyNoteNotebookId || '').trim();
        if (!configured) return '';
        const notebooks = Array.isArray(state.notebooks) ? state.notebooks : [];
        const exists = notebooks.some((item) => String(item?.id || item?.box || '').trim() === configured);
        return exists ? configured : '';
    }

    async function __tmResolveInsertedTaskBlockId(insertedId, options = {}) {
        const seedId = String(insertedId || '').trim();
        if (!seedId) return '';
        const opts = (options && typeof options === 'object') ? options : {};
        const defaultRetryDelays = [60, 160, 320, 640, 1000];
        const retryDelays = Array.isArray(opts.retryDelays)
            ? opts.retryDelays.map((value) => Math.max(0, Number(value) || 0))
            : defaultRetryDelays;
        const defaultMaxAttempts = retryDelays.length + 1;
        const maxAttempts = Math.max(1, Math.floor(Number(opts.maxAttempts ?? opts.attempts ?? defaultMaxAttempts) || defaultMaxAttempts));
        const fallbackToSeed = opts.fallbackToSeed !== false;
        const isTaskBlock = async (id) => {
            try {
                const rows = await API.getBlocksByIds([id]);
                const row = Array.isArray(rows) ? rows[0] : null;
                const ok = String(row?.id || '').trim() === id
                    && String(row?.type || '').trim() === 'i'
                    && String(row?.subtype || '').trim() === 't';
                return ok;
            } catch (e) {
                return false;
            }
        };
        if (await isTaskBlock(seedId)) {
            return seedId;
        }
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const resolvedId = String(await API.getFirstTaskDescendantId(seedId, 6) || '').trim();
                if (resolvedId && await isTaskBlock(resolvedId)) {
                    return resolvedId;
                }
                const directTaskId = String(await API.getFirstTaskIdUnderBlock(seedId) || '').trim();
                if (directTaskId && await isTaskBlock(directTaskId)) {
                    return directTaskId;
                }
            } catch (e) {
            }
            if (i < maxAttempts - 1 && i < retryDelays.length && retryDelays[i] > 0) {
                await new Promise((resolve) => setTimeout(resolve, retryDelays[i]));
            }
        }
        if (!fallbackToSeed) {
            return '';
        }
        return seedId;
    }

    async function __tmPersistNewTaskAttrsWithRetry(taskId, patch, resolveId, options = {}) {
        const payload = (patch && typeof patch === 'object') ? patch : {};
        const opts = (options && typeof options === 'object') ? options : {};
        if (!Object.keys(payload).length) return String(taskId || '').trim();
        let currentId = String(taskId || '').trim();
        let lastErr = null;
        if (opts.background === true) {
            const enqueueAttrs = (targetId) => {
                const tid = String(targetId || '').trim();
                if (!tid) return false;
                try {
                    const patchTask = globalThis.__tmRequireTaskOutbox?.('patchTask');
                    if (typeof patchTask !== 'function') throw new Error('任务写入队列未就绪: patchTask');
                    patchTask(tid, payload, {
                        ...opts,
                        source: String(opts.source || 'create-task-attrs').trim() || 'create-task-attrs',
                        background: true,
                        wait: false,
                        docId: String(opts.docId || '').trim(),
                        skipFlush: opts.skipFlush === true,
                        mirrorTaskAttrs: opts.mirrorTaskAttrs !== false,
                    });
                    return true;
                } catch (e) {
                    lastErr = e;
                    return false;
                }
            };
            if (enqueueAttrs(currentId)) return currentId;
            if (resolveId) {
                try {
                    const nextId = String(await resolveId() || '').trim();
                    if (nextId) currentId = nextId;
                    if (enqueueAttrs(currentId)) return currentId;
                } catch (e) {
                    lastErr = e;
                }
            }
            throw lastErr || new Error('保存属性失败');
        }
        for (let i = 0; i < 5; i += 1) {
            try {
                if (resolveId && i > 0) {
                    const nextId = String(await resolveId() || '').trim();
                    if (nextId) currentId = nextId;
                }
                if (!currentId) throw new Error('未找到任务块');
                const patchTask = globalThis.__tmRequireTaskOutbox?.('patchTask');
                if (typeof patchTask !== 'function') throw new Error('任务写入队列未就绪: patchTask');
                await patchTask(currentId, payload, {
                    ...opts,
                    source: String(opts.source || 'create-task-attrs').trim() || 'create-task-attrs',
                    wait: opts.wait !== false,
                });
                return currentId;
            } catch (e) {
                lastErr = e;
                await new Promise((resolve) => setTimeout(resolve, 180 + i * 220));
            }
        }
        throw lastErr || new Error('保存属性失败');
    }

    function __tmUpsertLocalTask(task) {
        const nextTask = (task && typeof task === 'object') ? task : null;
        const taskId = String(nextTask?.id || '').trim();
        const docId = String(nextTask?.docId || nextTask?.root_id || '').trim();
        if (!taskId || !docId || !nextTask) return;
        let upserted = false;
        try {
            upserted = !!globalThis.__tmTaskStore?.upsertLocal?.(nextTask, {
                status: 'local-upsert',
            });
        } catch (e) {}
        if (!upserted) return;
        const doc = (Array.isArray(state.taskTree) ? state.taskTree : []).find(d => String(d?.id || '').trim() === docId);
        if (!doc) return;
        if (!Array.isArray(doc.tasks)) doc.tasks = [];
        if (!doc.tasks.some((item) => String(item?.id || '').trim() === taskId)) {
            doc.tasks.push(nextTask);
        }
    }

    function __tmGenerateTempTaskId(prefix = 'task') {
        return `tm_tmp_${String(prefix || 'task').trim() || 'task'}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function __tmIsOptimisticTempTaskId(taskId) {
        return String(taskId || '').trim().startsWith('tm_tmp_');
    }

    function __tmGetOptimisticTaskIdRemapStore() {
        try {
            if (!state.__tmOptimisticTaskIdRemaps || typeof state.__tmOptimisticTaskIdRemaps !== 'object') {
                state.__tmOptimisticTaskIdRemaps = {};
            }
            return state.__tmOptimisticTaskIdRemaps;
        } catch (e) {
            return {};
        }
    }

    function __tmRememberOptimisticTaskIdRemap(tempId, realId) {
        const tmp = String(tempId || '').trim();
        const rid = String(realId || '').trim();
        if (!tmp || !rid || tmp === rid) return false;
        try {
            const store = __tmGetOptimisticTaskIdRemapStore();
            store[tmp] = {
                realId: rid,
                expiresAt: Date.now() + 120000,
            };
            Object.keys(store).forEach((key) => {
                const item = store[key];
                const expiresAt = Number(item?.expiresAt) || 0;
                if (expiresAt > 0 && expiresAt < Date.now()) delete store[key];
            });
        } catch (e) {}
        try { globalThis.__tmTaskIdentity?.commit?.(tmp, rid); } catch (e) {}
        return true;
    }

    function __tmResolveOptimisticTaskId(taskId) {
        let current = String(taskId || '').trim();
        if (!current) return '';
        const seen = new Set();
        try {
            const identityResolved = String(globalThis.__tmTaskIdentity?.resolve?.(current) || '').trim();
            if (identityResolved && identityResolved !== current) return identityResolved;
        } catch (e) {}
        try {
            const store = __tmGetOptimisticTaskIdRemapStore();
            for (let i = 0; i < 8; i += 1) {
                if (!current || seen.has(current)) break;
                seen.add(current);
                const item = store[current];
                const next = String((item && typeof item === 'object') ? item.realId : item || '').trim();
                if (!next || next === current) break;
                current = next;
            }
        } catch (e) {}
        return current;
    }

    function __tmResolveOptimisticTaskForLocalUse(taskId) {
        const rawId = String(taskId || '').trim();
        const resolvedId = __tmResolveOptimisticTaskId(rawId);
        const aliases = new Set([rawId, resolvedId].map((id) => String(id || '').trim()).filter(Boolean));
        try {
            const runtimeAliases = globalThis.__tmRuntimeState?.getTaskIdAliases?.(rawId);
            (Array.isArray(runtimeAliases) ? runtimeAliases : []).forEach((id) => {
                const nextId = String(id || '').trim();
                if (nextId) aliases.add(nextId);
            });
        } catch (e) {}
        let task = null;
        aliases.forEach((id) => {
            if (task) return;
            task = state.flatTasks?.[id] || null;
        });
        aliases.forEach((id) => {
            if (task) return;
            task = state.pendingInsertedTasks?.[id] || null;
        });
        aliases.forEach((id) => {
            if (task) return;
            task = (Array.isArray(state.filteredTasks) ? state.filteredTasks : [])
                .find((item) => String(item?.id || '').trim() === id) || null;
        });
        if (!task) {
            try {
                task = globalThis.__tmRuntimeState?.getTaskById?.(rawId, { includePending: true, preferPending: true }) || null;
            } catch (e) {}
        }
        const id = String((resolvedId && resolvedId !== rawId) ? resolvedId : (task?.id || resolvedId || rawId || '')).trim();
        return { id, task, rawId, resolvedId, aliases: Array.from(aliases) };
    }

    function __tmAttachOptimisticChildToParentCandidates(parentTask, parentTaskId, childTask, options = {}) {
        const child = (childTask && typeof childTask === 'object') ? childTask : null;
        const childId = String(child?.id || '').trim();
        if (!child || !childId) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const parentIds = new Set();
        [parentTaskId, parentTask?.id, __tmResolveOptimisticTaskId(parentTaskId), __tmResolveOptimisticTaskId(parentTask?.id)]
            .map((id) => String(id || '').trim())
            .filter(Boolean)
            .forEach((id) => parentIds.add(id));
        try {
            Array.from(parentIds).forEach((id) => {
                const aliases = globalThis.__tmRuntimeState?.getTaskIdAliases?.(id);
                (Array.isArray(aliases) ? aliases : []).forEach((aliasId) => {
                    const nextId = String(aliasId || '').trim();
                    if (nextId) parentIds.add(nextId);
                });
            });
        } catch (e) {}
        if (!parentIds.size) return false;
        const childIds = new Set([childId, __tmResolveOptimisticTaskId(childId)]
            .map((id) => String(id || '').trim())
            .filter(Boolean));
        try {
            const childAliases = globalThis.__tmRuntimeState?.getTaskIdAliases?.(childId);
            (Array.isArray(childAliases) ? childAliases : []).forEach((id) => {
                const nextId = String(id || '').trim();
                if (nextId) childIds.add(nextId);
            });
        } catch (e) {}
        let changed = false;
        const attachOne = (task) => {
            if (!(task && typeof task === 'object')) return;
            const tid = String(task.id || '').trim();
            if (tid && !parentIds.has(tid)) return;
            if (!Array.isArray(task.children)) task.children = [];
            const idx = task.children.findIndex((item) => childIds.has(String(item?.id || '').trim()));
            if (idx >= 0) {
                if (task.children[idx] !== child) {
                    task.children[idx] = { ...task.children[idx], ...child };
                    changed = true;
                }
                for (let i = task.children.length - 1; i >= 0; i -= 1) {
                    if (i === idx) continue;
                    if (childIds.has(String(task.children[i]?.id || '').trim())) {
                        task.children.splice(i, 1);
                        changed = true;
                    }
                }
                if (opts.atTop === true && idx > 0) {
                    const nextIdx = task.children.findIndex((item) => childIds.has(String(item?.id || '').trim()));
                    const [item] = task.children.splice(Math.max(0, nextIdx), 1);
                    task.children.unshift(item);
                    changed = true;
                }
                return;
            }
            if (opts.atTop === true) task.children.unshift(child);
            else task.children.push(child);
            changed = true;
        };
        attachOne(parentTask);
        parentIds.forEach((id) => {
            attachOne(state.flatTasks?.[id]);
            attachOne(state.pendingInsertedTasks?.[id]);
        });
        try {
            (Array.isArray(state.filteredTasks) ? state.filteredTasks : []).forEach((task) => {
                if (parentIds.has(String(task?.id || '').trim())) attachOne(task);
            });
        } catch (e) {}
        if (changed) {
            try { __tmInvalidateFilteredTaskDerivedStateCache(); } catch (e) {}
            try { state.listDomRenderSignature = ''; } catch (e) {}
        }
        return changed;
    }

    function __tmInsertTaskIntoDocLocal(task, options = {}) {
        const nextTask = (task && typeof task === 'object') ? task : null;
        const opts = (options && typeof options === 'object') ? options : {};
        const taskId = String(nextTask?.id || '').trim();
        const docId = String(nextTask?.docId || nextTask?.root_id || '').trim();
        if (!nextTask || !taskId || !docId) return false;
        try {
            globalThis.__tmTaskStore?.upsertLocal?.(nextTask, { status: 'local-insert' });
        } catch (e) {}
        const doc = __tmEnsureLocalTaskDocEntry(docId, nextTask);
        if (!doc) return false;
        if (!Array.isArray(doc.tasks)) doc.tasks = [];
        if (doc.tasks.some((item) => String(item?.id || '').trim() === taskId)) return true;
        const insertBeforeId = String(opts.insertBeforeId || '').trim();
        if (insertBeforeId) {
            const idx = doc.tasks.findIndex((item) => String(item?.id || '').trim() === insertBeforeId);
            if (idx >= 0) {
                doc.tasks.splice(idx, 0, nextTask);
                return true;
            }
        }
        const insertAfterId = String(opts.insertAfterId || '').trim();
        if (insertAfterId) {
            const idx = doc.tasks.findIndex((item) => String(item?.id || '').trim() === insertAfterId);
            if (idx >= 0) {
                doc.tasks.splice(idx + 1, 0, nextTask);
                return true;
            }
        }
        if (opts.atTop === true) {
            doc.tasks.unshift(nextTask);
            return true;
        }
        doc.tasks.push(nextTask);
        return true;
    }

    function __tmEnsureLocalTaskDocEntry(docId, task = null) {
        const did = String(docId || '').trim();
        if (!did) return null;
        if (!Array.isArray(state.taskTree)) state.taskTree = [];
        const existing = state.taskTree.find((item) => String(item?.id || '').trim() === did);
        if (existing) return existing;
        const sourceTask = (task && typeof task === 'object') ? task : {};
        const docMeta = (Array.isArray(state.allDocuments) ? state.allDocuments : [])
            .find((doc) => String(doc?.id || '').trim() === did) || null;
        const normalizeAlias = (value) => {
            try {
                return typeof __tmNormalizeDocAliasValue === 'function'
                    ? __tmNormalizeDocAliasValue(value)
                    : String(value || '').trim();
            } catch (e) {
                return String(value || '').trim();
            }
        };
        const normalizeIcon = (value) => {
            try {
                return typeof __tmNormalizeDocIconValue === 'function'
                    ? __tmNormalizeDocIconValue(value)
                    : String(value || '').trim();
            } catch (e) {
                return String(value || '').trim();
            }
        };
        const docName = String(
            docMeta?.name
            || sourceTask.rawDocName
            || sourceTask.raw_doc_name
            || sourceTask.docName
            || sourceTask.doc_name
            || ''
        ).trim() || '未命名文档';
        const doc = {
            id: did,
            name: docName,
            alias: normalizeAlias(docMeta?.alias),
            icon: normalizeIcon(docMeta?.icon),
            created: String(docMeta?.created || '').trim(),
            tasks: [],
        };
        state.taskTree.push(doc);
        try {
            if (typeof __tmSortDocEntriesByPinned === 'function') {
                state.taskTree = __tmSortDocEntriesByPinned(
                    state.taskTree,
                    String(SettingsStore?.data?.currentGroupId || 'all').trim() || 'all'
                );
            }
        } catch (e) {}
        try { __tmInvalidateFilteredTaskDerivedStateCache(); } catch (e) {}
        return state.taskTree.find((item) => String(item?.id || '').trim() === did) || doc;
    }

    function __tmBuildHeadingPatchFromPlacement(placement) {
        const heading = placement?.heading;
        const headingId = String(heading?.id || '').trim();
        if (!headingId) return null;
        const headingText = __tmNormalizeHeadingText(heading?.content || '');
        const rank = Number(heading?.rank);
        return {
            h2: headingText,
            h2Id: headingId,
            h2Rank: Number.isFinite(rank) ? rank : Number.NaN,
            h2Path: '',
            h2Sort: Number.NaN,
            h2Created: '',
        };
    }

    function __tmApplyHeadingPatchToTaskLocal(taskId, patch, source = 'create-task-heading-local') {
        const tid = String(taskId || '').trim();
        const nextPatch = (patch && typeof patch === 'object') ? patch : null;
        if (!tid || !nextPatch) return false;
        let changed = false;
        const apply = (task) => {
            if (!task || typeof task !== 'object') return;
            Object.assign(task, nextPatch);
            changed = true;
        };
        try { apply(globalThis.__tmRuntimeState?.getTaskById?.(tid, { includePending: true, preferPending: true })); } catch (e) {}
        try { apply(state.flatTasks?.[tid]); } catch (e) {}
        try { apply(state.pendingInsertedTasks?.[tid]); } catch (e) {}
        try {
            globalThis.__tmTaskStore?.patchPending?.(tid, nextPatch, { source });
            globalThis.__tmTaskStore?.patchLocal?.(tid, nextPatch, { source });
        } catch (e) {}
        return changed;
    }

    function __tmRestoreTaskSubtreeIntoFlatMap(task) {
        const nextTask = (task && typeof task === 'object') ? task : null;
        if (!nextTask) return false;
        __tmRestoreTaskFlatMap(nextTask);
        return true;
    }

    function __tmCollectLocalDocTasks(docTasks, target = []) {
        const out = Array.isArray(target) ? target : [];
        (Array.isArray(docTasks) ? docTasks : []).forEach((task) => {
            if (!task || typeof task !== 'object') return;
            out.push(task);
            if (Array.isArray(task.children) && task.children.length) {
                __tmCollectLocalDocTasks(task.children, out);
            }
        });
        return out;
    }

    function __tmRebuildLocalDocTree(docId) {
        const did = String(docId || '').trim();
        if (!did) return false;
        const doc = (Array.isArray(state.taskTree) ? state.taskTree : []).find((item) => String(item?.id || '').trim() === did);
        if (!doc || !Array.isArray(doc.tasks)) return false;
        const allTasks = __tmCollectLocalDocTasks(doc.tasks, []);
        if (!allTasks.length) return false;
        const idMap = new Map();
        allTasks.forEach((task) => {
            const tid = String(task?.id || '').trim();
            if (!tid) return;
            task.children = [];
            idMap.set(tid, task);
        });
        const rootTasks = [];
        allTasks.forEach((task) => {
            const tid = String(task?.id || '').trim();
            if (!tid) return;
            const parentTaskId = String(task?.parentTaskId || '').trim();
            if (parentTaskId && idMap.has(parentTaskId)) {
                idMap.get(parentTaskId).children.push(task);
            } else {
                rootTasks.push(task);
            }
        });
        const calcLevel = (tasks, level) => {
            (Array.isArray(tasks) ? tasks : []).forEach((task) => {
                if (!task || typeof task !== 'object') return;
                task.level = level;
                if (Array.isArray(task.children) && task.children.length) calcLevel(task.children, level + 1);
            });
        };
        // Keep the in-memory drag/drop insertion order here.
        // During optimistic moves, block_sort still reflects the old document layout
        // and would scramble the just-updated sibling order.
        calcLevel(rootTasks, 0);
        __tmAssignDocSeqByTree(rootTasks, 0);
        doc.tasks = rootTasks;
        try { globalThis.__tmTaskStore?.removeFlatByDoc?.(did); } catch (e) {}
        rootTasks.forEach((task) => __tmRestoreTaskFlatMap(task));
        return true;
    }

    function __tmAssignDocSeqByTree(tasks, startIndex = 0, options = null) {
        const opts = (options && typeof options === 'object') ? options : {};
        const preserveExistingFinite = opts.preserveExistingFinite === true;
        let nextIndex = Number.isFinite(Number(startIndex)) ? Math.max(0, Math.floor(Number(startIndex))) : 0;
        const walk = (list) => {
            (Array.isArray(list) ? list : []).forEach((task) => {
                if (!task || typeof task !== 'object') return;
                const existingDocSeq = Number(task?.docSeq ?? task?.doc_seq);
                if (preserveExistingFinite && Number.isFinite(existingDocSeq)) {
                    task.docSeq = existingDocSeq;
                    task.doc_seq = existingDocSeq;
                    nextIndex = Math.max(nextIndex, Math.floor(existingDocSeq) + 1);
                } else {
                    task.docSeq = nextIndex;
                    task.doc_seq = nextIndex;
                    nextIndex += 1;
                }
                if (Array.isArray(task.children) && task.children.length) walk(task.children);
            });
        };
        walk(tasks);
        return nextIndex;
    }

    function __tmSortTaskTreeByDocFlow(tasks) {
        const list = Array.isArray(tasks) ? tasks : [];
        list.sort(__tmCompareTasksByDocFlow);
        list.forEach((task) => {
            if (Array.isArray(task?.children) && task.children.length > 0) {
                __tmSortTaskTreeByDocFlow(task.children);
            }
        });
        return list;
    }

    function __tmReorderLoadedDocsByResolvedFlow(docIds) {
        const ids = docIds instanceof Set
            ? Array.from(docIds)
            : (Array.isArray(docIds) ? docIds : [docIds]);
        const wanted = new Set(ids.map((id) => String(id || '').trim()).filter(Boolean));
        if (wanted.size <= 0) return false;
        const hasFlowRank = (tasks) => {
            return (Array.isArray(tasks) ? tasks : []).some((task) => {
                const rank = Number(task?.resolvedFlowRank ?? task?.resolved_flow_rank ?? task?.__tmResolvedFlowRank);
                return Number.isFinite(rank) || hasFlowRank(task?.children);
            });
        };
        const calcLevel = (tasks, level) => {
            (Array.isArray(tasks) ? tasks : []).forEach((task) => {
                if (!task || typeof task !== 'object') return;
                task.level = level;
                if (Array.isArray(task.children) && task.children.length > 0) calcLevel(task.children, level + 1);
            });
        };
        let changed = false;
        (Array.isArray(state.taskTree) ? state.taskTree : []).forEach((doc) => {
            const docId = String(doc?.id || '').trim();
            if (!docId || !wanted.has(docId) || !Array.isArray(doc?.tasks) || doc.tasks.length <= 0) return;
            if (!__tmShouldUseResolvedFlowRankForDoc(docId) || !hasFlowRank(doc.tasks)) return;
            __tmSortTaskTreeByDocFlow(doc.tasks);
            calcLevel(doc.tasks, 0);
            __tmAssignDocSeqByTree(doc.tasks, 0);
            changed = true;
        });
        if (changed) __tmInvalidateFilteredTaskDerivedStateCache();
        return changed;
    }

    function __tmCompareSiblingTasksByBlockOrder(a, b) {
        // A parent task can own multiple child NodeList blocks. When their per-list
        // sibling ranks collide, we must fall back to full document flow instead of
        // local block_sort only, otherwise reload/reconcile can scramble the merged
        // child array even though the document DOM order is already correct.
        return __tmCompareTasksByDocFlow(a, b);
    }

    function __tmSortTaskTreeBySiblingOrder(tasks) {
        const list = Array.isArray(tasks) ? tasks : [];
        list.sort(__tmCompareSiblingTasksByBlockOrder);
        list.forEach((task) => {
            if (Array.isArray(task?.children) && task.children.length > 0) {
                __tmSortTaskTreeBySiblingOrder(task.children);
            }
        });
        return list;
    }

    async function __tmResolveTaskSiblingOrderRanks(tasksByDoc) {
        const source = tasksByDoc instanceof Map ? tasksByDoc : new Map();
        const rankMap = new Map();
        const directListIds = new Set();
        const parentTaskIds = new Set();
        const listDocIdMap = new Map();
        const parentTaskDocIdMap = new Map();
        let preferDomDirectListCount = 0;
        let preferDomParentTaskCount = 0;
        let refreshedDirectListCount = 0;
        let refreshedParentTaskCount = 0;

        const applyRanks = (taskIds, kind = 'local', options = {}) => {
            const rankKey = kind === 'parent' ? 'parentRank' : 'localRank';
            const force = options && typeof options === 'object' && options.force === true;
            (Array.isArray(taskIds) ? taskIds : []).forEach((taskId, index) => {
                const tid = String(taskId || '').trim();
                if (!tid) return;
                const prev = __tmGetTaskSiblingRankEntry(rankMap, tid) || {};
                const next = { ...prev };
                if (force || !Number.isFinite(Number(next?.[rankKey]))) {
                    next[rankKey] = index;
                }
                rankMap.set(tid, next);
            });
        };

        source.forEach((rawTasks) => {
            const localCounters = new Map();
            const parentCounters = new Map();
            (Array.isArray(rawTasks) ? rawTasks : []).forEach((task) => {
                if (!task || __tmIsRecurringInstanceTask(task)) return;
                const taskId = String(task?.id || '').trim();
                if (!taskId) return;
                const docId = String(task?.root_id || task?.docId || '').trim();
                const parentId = String(task?.parent_id || task?.parentId || '').trim();
                const parentTaskId = String(task?.parentTaskId || task?.parent_task_id || '').trim();
                const prev = __tmGetTaskSiblingRankEntry(rankMap, taskId) || {};
                const next = { ...prev };
                if (parentId) {
                    directListIds.add(parentId);
                    if (docId && !listDocIdMap.has(parentId)) listDocIdMap.set(parentId, docId);
                    const localRank = Number(localCounters.get(parentId) || 0);
                    if (!Number.isFinite(Number(next.localRank))) next.localRank = localRank;
                    localCounters.set(parentId, localRank + 1);
                }
                if (parentTaskId) {
                    parentTaskIds.add(parentTaskId);
                    if (docId && !parentTaskDocIdMap.has(parentTaskId)) parentTaskDocIdMap.set(parentTaskId, docId);
                    const parentRank = Number(parentCounters.get(parentTaskId) || 0);
                    if (!Number.isFinite(Number(next.parentRank))) next.parentRank = parentRank;
                    parentCounters.set(parentTaskId, parentRank + 1);
                }
                rankMap.set(taskId, next);
            });
        });

        await Promise.all(Array.from(parentTaskIds).map(async (parentTaskId) => {
            const pid = String(parentTaskId || '').trim();
            if (!pid) return;
            const preferDom = !__tmShouldUseResolvedFlowRankForDoc(parentTaskDocIdMap.get(pid));
            if (!preferDom) return;
            preferDomParentTaskCount += 1;
            try {
                const taskIds = await API.getDirectChildTaskIdsOfTask(pid, { preferDom: true });
                if (Array.isArray(taskIds) && taskIds.length > 0) {
                    applyRanks(taskIds, 'parent', { force: true });
                    refreshedParentTaskCount += 1;
                }
            } catch (e) {}
        }));

        await Promise.all(Array.from(directListIds).map(async (parentId) => {
            const listId = String(parentId || '').trim();
            if (!listId) return;
            const preferDom = !__tmShouldUseResolvedFlowRankForDoc(listDocIdMap.get(listId));
            if (!preferDom) return;
            preferDomDirectListCount += 1;
            try {
                const taskIds = await API.getTaskIdsInList(listId, { preferDom: true });
                if (Array.isArray(taskIds) && taskIds.length > 0) {
                    applyRanks(taskIds, 'local', { force: true });
                    refreshedDirectListCount += 1;
                }
            } catch (e) {}
        }));

        return rankMap;
    }

    function __tmSortTaskTreeBySiblingRankMap(tasks, rankMap = null) {
        const ranks = rankMap instanceof Map ? rankMap : null;
        const list = Array.isArray(tasks) ? tasks : [];
        const compare = (a, b) => {
            const parentRankA = __tmGetTaskParentScopedRank(ranks, a);
            const parentRankB = __tmGetTaskParentScopedRank(ranks, b);
            const localRankA = __tmGetTaskLocalSiblingRank(ranks, a);
            const localRankB = __tmGetTaskLocalSiblingRank(ranks, b);
            const parentA = String(a?.parentTaskId || a?.parent_task_id || '').trim();
            const parentB = String(b?.parentTaskId || b?.parent_task_id || '').trim();
            const listA = String(a?.parent_id || a?.parentId || '').trim();
            const listB = String(b?.parent_id || b?.parentId || '').trim();
            const canCompareByParentRank = !!parentA && parentA === parentB;
            if (canCompareByParentRank) {
                if (Number.isFinite(parentRankA) && Number.isFinite(parentRankB) && parentRankA !== parentRankB) return parentRankA - parentRankB;
                if (Number.isFinite(parentRankA) && !Number.isFinite(parentRankB)) return -1;
                if (!Number.isFinite(parentRankA) && Number.isFinite(parentRankB)) return 1;
            }
            // When parent-level merged order is unavailable, same-list local ranks are
            // still safe within a single child NodeList.
            const canCompareByLocalSiblingRank = !!listA && listA === listB;
            if (canCompareByLocalSiblingRank) {
                if (Number.isFinite(localRankA) && Number.isFinite(localRankB) && localRankA !== localRankB) return localRankA - localRankB;
                if (Number.isFinite(localRankA) && !Number.isFinite(localRankB)) return -1;
                if (!Number.isFinite(localRankA) && Number.isFinite(localRankB)) return 1;
            }
            return __tmCompareSiblingTasksByBlockOrder(a, b);
        };
        list.sort(compare);
        list.forEach((task) => {
            if (Array.isArray(task?.children) && task.children.length > 0) {
                __tmSortTaskTreeBySiblingRankMap(task.children, ranks);
            }
        });
        return list;
    }

    function __tmResolveLocalTaskSiblings(targetTaskId) {
        const targetId = String(targetTaskId || '').trim();
        const targetInfo = __tmResolveOptimisticTaskForLocalUse(targetId);
        const targetTask = targetInfo.task || null;
        if (!targetId || !targetTask) return null;
        const parentTaskId = String(targetTask.parentTaskId || '').trim();
        if (parentTaskId) {
            const parentInfo = __tmResolveOptimisticTaskForLocalUse(parentTaskId);
            const parentTask = parentInfo.task || null;
            const parentId = String(parentInfo.id || parentTaskId).trim();
            if (!parentTask) return null;
            if (!Array.isArray(parentTask.children)) parentTask.children = [];
            return {
                list: parentTask.children,
                parentTaskId: parentId,
                parentTask,
                docId: String(parentTask.docId || parentTask.root_id || targetTask.docId || targetTask.root_id || '').trim(),
            };
        }
        const docId = String(targetTask.docId || targetTask.root_id || '').trim();
        const doc = (Array.isArray(state.taskTree) ? state.taskTree : []).find((item) => String(item?.id || '').trim() === docId);
        if (!doc) return null;
        if (!Array.isArray(doc.tasks)) doc.tasks = [];
        return {
            list: doc.tasks,
            parentTaskId: '',
            parentTask: null,
            docId,
            doc,
        };
    }

    function __tmInsertTaskBeforeLocal(task, targetTaskId) {
        const nextTask = (task && typeof task === 'object') ? task : null;
        const targetId = String(targetTaskId || '').trim();
        const siblings = __tmResolveLocalTaskSiblings(targetId);
        if (!nextTask || !targetId || !siblings?.list) return false;
        const idx = siblings.list.findIndex((item) => String(item?.id || '').trim() === targetId);
        if (idx < 0) return false;
        __tmRestoreTaskSubtreeIntoFlatMap(nextTask);
        siblings.list.splice(idx, 0, nextTask);
        return true;
    }

    function __tmInsertTaskAfterLocal(task, targetTaskId) {
        const nextTask = (task && typeof task === 'object') ? task : null;
        const targetId = String(targetTaskId || '').trim();
        const siblings = __tmResolveLocalTaskSiblings(targetId);
        if (!nextTask || !targetId || !siblings?.list) return false;
        const idx = siblings.list.findIndex((item) => String(item?.id || '').trim() === targetId);
        if (idx < 0) return false;
        __tmRestoreTaskSubtreeIntoFlatMap(nextTask);
        siblings.list.splice(idx + 1, 0, nextTask);
        return true;
    }

    function __tmInsertTaskAsChildLocal(task, parentTaskId, options = {}) {
        const nextTask = (task && typeof task === 'object') ? task : null;
        const pid = String(parentTaskId || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        const parentInfo = __tmResolveOptimisticTaskForLocalUse(pid);
        const parentTask = parentInfo.task || null;
        const resolvedPid = String(parentInfo.id || pid).trim();
        if (!nextTask || !pid || !parentTask) return false;
        const parentLinkId = String(parentTask.id || resolvedPid || pid).trim();
        nextTask.parentTaskId = parentLinkId;
        nextTask.parent_task_id = parentLinkId;
        const nextId = String(nextTask.id || '').trim();
        const nextIds = new Set([nextId, __tmResolveOptimisticTaskId(nextId)]
            .map((id) => String(id || '').trim())
            .filter(Boolean));
        try {
            const aliases = globalThis.__tmRuntimeState?.getTaskIdAliases?.(nextId);
            (Array.isArray(aliases) ? aliases : []).forEach((id) => {
                const aliasId = String(id || '').trim();
                if (aliasId) nextIds.add(aliasId);
            });
        } catch (e) {}
        if (!Array.isArray(parentTask.children)) parentTask.children = [];
        __tmRestoreTaskSubtreeIntoFlatMap(nextTask);
        const existingIndex = parentTask.children.findIndex((item) => nextIds.has(String(item?.id || '').trim()));
        if (existingIndex >= 0) {
            parentTask.children[existingIndex] = { ...parentTask.children[existingIndex], ...nextTask };
            for (let i = parentTask.children.length - 1; i >= 0; i -= 1) {
                if (i !== existingIndex && nextIds.has(String(parentTask.children[i]?.id || '').trim())) {
                    parentTask.children.splice(i, 1);
                }
            }
            if (opts.atTop === true && existingIndex > 0) {
                const nextIndex = parentTask.children.findIndex((item) => nextIds.has(String(item?.id || '').trim()));
                const [item] = parentTask.children.splice(Math.max(0, nextIndex), 1);
                parentTask.children.unshift(item);
            }
        } else if (opts.atTop === true) {
            parentTask.children.unshift(nextTask);
        } else {
            parentTask.children.push(nextTask);
        }
        try { __tmAttachOptimisticChildToParentCandidates(parentTask, resolvedPid || pid, nextTask, { atTop: opts.atTop === true }); } catch (e) {}
        try {
            if (state.pendingInsertedTasks?.[nextId] || opts.preservePending === true) {
                const pendingTask = {
                    ...(state.pendingInsertedTasks?.[nextId] || {}),
                    ...nextTask,
                    parentTaskId: parentLinkId,
                    parent_task_id: parentLinkId,
                    expiresAt: state.pendingInsertedTasks?.[nextId]?.expiresAt || Date.now() + __TM_PENDING_INSERTED_TASK_KEEPALIVE_MS,
                };
                globalThis.__tmTaskStore?.upsertLocal?.(pendingTask, {
                    pending: true,
                    expiresAt: pendingTask.expiresAt,
                    status: 'insert-task-as-child-local',
                });
            }
        } catch (e) {}
        try { state.collapsedTaskIds?.delete?.(pid); } catch (e) {}
        try { state.collapsedTaskIds?.delete?.(resolvedPid); } catch (e) {}
        return true;
    }

    function __tmCanUseLightweightCreateProjection(task) {
        const nextTask = (task && typeof task === 'object') ? task : null;
        if (!nextTask) return false;
        const docId = String(nextTask.root_id || nextTask.docId || '').trim();
        if (!docId) return false;
        if (String(state.searchKeyword || '').trim()) return false;
        if (state.docTabsArchiveMode === true) return false;
        if (__tmIsOtherBlockTabId(state.activeDocId)) return false;
        const currentRule = typeof __tmGetCurrentRule === 'function' ? __tmGetCurrentRule() : null;
        if (currentRule && !__tmIsAllRuleLike(currentRule)) return false;
        const activeDocId = String(state.activeDocId || 'all').trim() || 'all';
        const customGroupDocIds = (typeof __tmGetActiveDocTabCustomGroupDocIdSet === 'function')
            ? __tmGetActiveDocTabCustomGroupDocIdSet(activeDocId, {
                currentGroupId: SettingsStore?.data?.currentGroupId || 'all',
                docs: state.taskTree || []
            })
            : null;
        if (customGroupDocIds instanceof Set && customGroupDocIds.size) {
            if (!customGroupDocIds.has(docId)) return false;
        } else if (activeDocId !== 'all' && activeDocId !== docId) return false;
        if (nextTask.done === true && state.showCompletedTasks !== true) return false;
        return true;
    }

    function __tmCanUseLightweightMoveProjection(taskOrId, payload = {}) {
        const data = (payload && typeof payload === 'object') ? payload : {};
        const tid = String((taskOrId && typeof taskOrId === 'object') ? taskOrId.id : taskOrId || '').trim();
        const task = (taskOrId && typeof taskOrId === 'object')
            ? taskOrId
            : (
                globalThis.__tmRuntimeState?.getTaskById?.(tid, { includePending: true, preferPending: true })
                || state.flatTasks?.[tid]
                || state.pendingInsertedTasks?.[tid]
                || null
            );
        const sourceDocId = String(data?.snapshot?.docId || data.sourceDocId || data.docId || task?.root_id || task?.docId || '').trim();
        const targetDocId = String(data.targetDocId || '').trim();
        if (!tid || !task || !targetDocId) return false;
        if (String(state.searchKeyword || '').trim()) return false;
        if (state.docTabsArchiveMode === true) return false;
        if (__tmIsOtherBlockTabId(state.activeDocId)) return false;
        const currentRule = typeof __tmGetCurrentRule === 'function' ? __tmGetCurrentRule() : null;
        if (currentRule && !__tmIsAllRuleLike(currentRule)) return false;
        if (task.done === true && state.showCompletedTasks !== true) return false;
        const activeDocId = String(state.activeDocId || 'all').trim() || 'all';
        const customGroupDocIds = (typeof __tmGetActiveDocTabCustomGroupDocIdSet === 'function')
            ? __tmGetActiveDocTabCustomGroupDocIdSet(activeDocId, {
                currentGroupId: SettingsStore?.data?.currentGroupId || 'all',
                docs: state.taskTree || []
            })
            : null;
        if (customGroupDocIds instanceof Set && customGroupDocIds.size) {
            return customGroupDocIds.has(sourceDocId) || customGroupDocIds.has(targetDocId);
        }
        return activeDocId === 'all' || activeDocId === sourceDocId || activeDocId === targetDocId;
    }

    function __tmSyncMoveAffectedDocTabs(sourceDocId, targetDocId) {
        const ids = Array.from(new Set([sourceDocId, targetDocId]
            .map((id) => String(id || '').trim())
            .filter(Boolean)));
        if (!ids.length) return false;
        const nextIds = new Set((Array.isArray(state.filteredDocIdsForTabs) ? state.filteredDocIdsForTabs : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean));
        const docMap = new Map((Array.isArray(state.taskTree) ? state.taskTree : [])
            .map((doc) => [String(doc?.id || '').trim(), doc])
            .filter(([id]) => !!id));
        const currentRule = typeof __tmGetCurrentRule === 'function' ? __tmGetCurrentRule() : null;
        let changed = false;
        ids.forEach((docId) => {
            const doc = docMap.get(docId) || null;
            let shouldShow = false;
            try {
                shouldShow = typeof __tmDocShouldShowInDocTabs === 'function'
                    ? __tmDocShouldShowInDocTabs(doc, {
                        rule: currentRule,
                        archiveMode: state.docTabsArchiveMode === true,
                    })
                    : !!(doc && Array.isArray(doc.tasks) && doc.tasks.length > 0);
            } catch (e) {
                shouldShow = !!(doc && Array.isArray(doc.tasks) && doc.tasks.length > 0);
            }
            if (shouldShow && !nextIds.has(docId)) {
                nextIds.add(docId);
                changed = true;
            } else if (!shouldShow && nextIds.delete(docId)) {
                changed = true;
            }
        });
        if (!changed) return false;
        state.filteredDocIdsForTabs = Array.from(nextIds);
        try { __tmInvalidateFilteredTaskDerivedStateCache(); } catch (e) {}
        try { state.listDomRenderSignature = ''; } catch (e) {}
        return true;
    }

    function __tmApplyMoveOptimisticFilteredProjection(task, payload = {}) {
        const nextTask = (task && typeof task === 'object') ? task : null;
        const data = (payload && typeof payload === 'object') ? payload : {};
        const tid = String(nextTask?.id || data.taskId || '').trim();
        if (!tid || !nextTask || !Array.isArray(state.filteredTasks)) return false;
        if (!__tmCanUseLightweightMoveProjection(nextTask, data)) return false;
        const targetDocId = String(nextTask.root_id || nextTask.docId || data.targetDocId || '').trim();
        const sourceDocId = String(data?.snapshot?.docId || data.sourceDocId || data.docId || '').trim();
        const activeDocId = String(state.activeDocId || 'all').trim() || 'all';
        const customGroupDocIds = (typeof __tmGetActiveDocTabCustomGroupDocIdSet === 'function')
            ? __tmGetActiveDocTabCustomGroupDocIdSet(activeDocId, {
                currentGroupId: SettingsStore?.data?.currentGroupId || 'all',
                docs: state.taskTree || []
            })
            : null;
        const shouldVisible = (customGroupDocIds instanceof Set && customGroupDocIds.size)
            ? customGroupDocIds.has(targetDocId)
            : (activeDocId === 'all' || activeDocId === targetDocId);
        try { __tmRemoveTaskFromFilteredLocalState(tid); } catch (e) {}
        if (shouldVisible) {
            const existing = new Set((Array.isArray(state.filteredTasks) ? state.filteredTasks : [])
                .map((item) => String(item?.id || '').trim())
                .filter(Boolean));
            const addOne = (item) => {
                const id = String(item?.id || '').trim();
                if (!id || existing.has(id)) return;
                existing.add(id);
                state.filteredTasks.push(item);
            };
            const walk = (item) => {
                if (!item || typeof item !== 'object') return;
                addOne(item);
                (Array.isArray(item.children) ? item.children : []).forEach(walk);
            };
            walk(nextTask);
            const mode = String(data.mode || '').trim();
            if (mode === 'child' || mode === 'child-top') {
                const parentId = String(data.targetTaskId || nextTask.parentTaskId || nextTask.parent_task_id || '').trim();
                if (parentId) {
                    const parentInfo = __tmResolveOptimisticTaskForLocalUse(parentId);
                    const parentTask = parentInfo.task
                        || state.filteredTasks.find((item) => {
                            const itemId = String(item?.id || '').trim();
                            return itemId && (itemId === parentId || itemId === parentInfo.id || (Array.isArray(parentInfo.aliases) && parentInfo.aliases.includes(itemId)));
                        })
                        || null;
                    if (parentTask) {
                        try {
                            nextTask.parentTaskId = String(parentTask.id || parentInfo.id || parentId).trim();
                            nextTask.parent_task_id = nextTask.parentTaskId;
                        } catch (e) {}
                        try { __tmAttachOptimisticChildToParentCandidates(parentTask, parentId, nextTask, { atTop: mode === 'child-top' }); } catch (e) {}
                    }
                }
            }
        }
        try { __tmSyncMoveAffectedDocTabs(sourceDocId, targetDocId); } catch (e) {}
        try { __tmInvalidateFilteredTaskDerivedStateCache(); } catch (e) {}
        try { state.listDomRenderSignature = ''; } catch (e) {}
        return true;
    }

    function __tmEnsureOptimisticTaskInFilteredTasks(task) {
        const nextTask = (task && typeof task === 'object') ? task : null;
        const tid = String(nextTask?.id || '').trim();
        if (!tid || !Array.isArray(state.filteredTasks)) return false;
        if (!__tmCanUseLightweightCreateProjection(nextTask)) return false;
        if (state.filteredTasks.some((item) => String(item?.id || '').trim() === tid)) {
            try { state.listDomRenderSignature = ''; } catch (e) {}
            return true;
        }
        state.filteredTasks.push(nextTask);
        try { __tmInvalidateFilteredTaskDerivedStateCache(); } catch (e) {}
        try { state.listDomRenderSignature = ''; } catch (e) {}
        return true;
    }

    function __tmRefreshAfterOptimisticTaskCreate(taskId, reason = 'task-create-optimistic') {
        const tid = String(taskId || '').trim();
        try {
            __tmScheduleViewRefresh({
                mode: 'current',
                withFilters: false,
                reason: String(reason || 'task-create-optimistic').trim() || 'task-create-optimistic',
                taskIds: tid ? [tid] : [],
            });
            return true;
        } catch (e) {}
        try { __tmScheduleRender({ withFilters: false, reason }); } catch (e) {}
        return false;
    }

    function __tmEnsureOptimisticSubtaskInFilteredTasks(parentTask, subtask) {
        const parentInfo = __tmResolveOptimisticTaskForLocalUse(parentTask?.id || subtask?.parentTaskId || subtask?.parent_task_id || '');
        const parentForProjection = parentInfo.task || parentTask;
        const parentId = String(parentForProjection?.id || parentInfo.id || '').trim();
        const tid = String(subtask?.id || '').trim();
        const filtered = Array.isArray(state.filteredTasks) ? state.filteredTasks : null;
        if (!parentId || !tid || !filtered) return false;
        try {
            subtask.parentTaskId = parentId;
            subtask.parent_task_id = parentId;
        } catch (e) {}
        try { __tmAttachOptimisticChildToParentCandidates(parentForProjection, parentId, subtask); } catch (e) {}
        const parentAliases = (() => {
            try {
                const aliases = globalThis.__tmRuntimeState?.getTaskIdAliases?.(parentId);
                if (Array.isArray(aliases) && aliases.length) return aliases.map((id) => String(id || '').trim()).filter(Boolean);
            } catch (e) {}
            const rawParentId = String(parentTask?.id || subtask?.parentTaskId || subtask?.parent_task_id || '').trim();
            const resolvedParentId = __tmResolveOptimisticTaskId(rawParentId) || rawParentId;
            return Array.from(new Set([parentId, rawParentId, resolvedParentId].map((id) => String(id || '').trim()).filter(Boolean)));
        })();
        const parentVisible = filtered.some((task) => parentAliases.includes(String(task?.id || '').trim()))
            || parentAliases.some((id) => !!state.pendingInsertedTasks?.[id] || !!state.flatTasks?.[id]);
        if (!parentVisible) return false;
        if (!filtered.some((task) => parentAliases.includes(String(task?.id || '').trim()))) {
            if (parentForProjection && typeof parentForProjection === 'object') filtered.push(parentForProjection);
        }
        if (!filtered.some((task) => String(task?.id || '').trim() === tid)) {
            filtered.push(subtask);
            try { __tmInvalidateFilteredTaskDerivedStateCache(); } catch (e) {}
            try { state.listDomRenderSignature = ''; } catch (e) {}
            return true;
        }
        try { __tmInvalidateFilteredTaskDerivedStateCache(); } catch (e) {}
        try { state.listDomRenderSignature = ''; } catch (e) {}
        return true;
    }

    function __tmIsChecklistDetailPanelOpenForRefreshDefer() {
        try {
            if (state.checklistDetailSheetOpen === true) return true;
            const tid = String(state.detailTaskId || '').trim();
            if (!tid) return false;
            const modal = state.modal;
            return !!(modal instanceof Element && modal.querySelector?.('#tmChecklistDetailPanel, #tmChecklistSheetPanel, #tmTaskDetailSheetPanel'));
        } catch (e) {
            return false;
        }
    }

    function __tmFlushDeferredChecklistOptimisticSubtaskRefresh(reason = '') {
        const pending = state.__tmChecklistOptimisticSubtaskRefreshPending;
        if (!(pending && typeof pending === 'object')) return false;
        const parentIds = Array.isArray(pending.parentIds) ? pending.parentIds : [];
        const subtaskIds = Array.isArray(pending.subtaskIds) ? pending.subtaskIds : [];
        state.__tmChecklistOptimisticSubtaskRefreshPending = null;
        const ids = Array.from(new Set([...parentIds, ...subtaskIds].map((id) => String(id || '').trim()).filter(Boolean)));
        if (!ids.length) return false;
        return __tmScheduleChecklistOptimisticSubtaskRefresh(parentIds[0] || ids[0], subtaskIds[0] || '', { force: true });
    }

    function __tmScheduleDeferredChecklistOptimisticSubtaskRefreshFlush(reason = '') {
        if (!(state.__tmChecklistOptimisticSubtaskRefreshPending && typeof state.__tmChecklistOptimisticSubtaskRefreshPending === 'object')) return false;
        if (state.__tmChecklistOptimisticSubtaskFlushTimer) return true;
        const run = () => {
            state.__tmChecklistOptimisticSubtaskFlushTimer = 0;
            if (!(state.__tmChecklistOptimisticSubtaskRefreshPending && typeof state.__tmChecklistOptimisticSubtaskRefreshPending === 'object')) return;
            if (__tmIsChecklistDetailPanelOpenForRefreshDefer()) {
                __tmScheduleDeferredChecklistOptimisticSubtaskRefreshFlush(reason || 'detail-still-open');
                return;
            }
            try {
                const interactionWait = (typeof __tmGetHighPriorityInteractionWaitMs === 'function')
                    ? __tmGetHighPriorityInteractionWaitMs(80)
                    : 0;
                if (interactionWait > 0) {
                    state.__tmChecklistOptimisticSubtaskFlushTimer = setTimeout(run, Math.max(180, Math.min(1200, interactionWait)));
                    return;
                }
            } catch (e) {}
            try {
                if (typeof __tmShouldDeferMainViewRefreshForActiveScroll === 'function'
                    && __tmShouldDeferMainViewRefreshForActiveScroll({ mode: 'current', reason: String(reason || 'checklist-subtask-deferred-flush').trim() || 'checklist-subtask-deferred-flush' })) {
                    state.__tmChecklistOptimisticSubtaskFlushTimer = setTimeout(run, 520);
                    return;
                }
            } catch (e) {}
            __tmFlushDeferredChecklistOptimisticSubtaskRefresh(reason || 'deferred-flush');
        };
        state.__tmChecklistOptimisticSubtaskFlushTimer = setTimeout(() => {
            try {
                if (typeof __tmScheduleIdleTask === 'function') {
                    __tmScheduleIdleTask(run, 180);
                } else {
                    run();
                }
            } catch (e) {
                run();
            }
        }, 420);
        return true;
    }

    function __tmScheduleChecklistOptimisticSubtaskRefresh(parentTaskId, subtaskId, options = {}) {
        if (String(state.viewMode || '').trim() !== 'checklist') return false;
        if (!(state.modal instanceof Element) || !document.body.contains(state.modal)) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const ids = [];
        [parentTaskId, subtaskId].forEach((rawId) => {
            const id = String(rawId || '').trim();
            if (!id) return;
            ids.push(id);
            try {
                const aliases = globalThis.__tmRuntimeState?.getTaskIdAliases?.(id);
                if (Array.isArray(aliases)) {
                    aliases.forEach((aliasId) => {
                        const nextId = String(aliasId || '').trim();
                        if (nextId) ids.push(nextId);
                    });
                }
            } catch (e) {}
            try {
                const resolvedId = String(__tmResolveOptimisticTaskId?.(id) || '').trim();
                if (resolvedId) ids.push(resolvedId);
            } catch (e) {}
        });
        const refreshIds = Array.from(new Set(ids.filter(Boolean)));
        if (!refreshIds.length) return false;
        if (opts.force !== true && __tmIsChecklistDetailPanelOpenForRefreshDefer()) {
            try {
                const pending = (state.__tmChecklistOptimisticSubtaskRefreshPending && typeof state.__tmChecklistOptimisticSubtaskRefreshPending === 'object')
                    ? state.__tmChecklistOptimisticSubtaskRefreshPending
                    : { parentIds: [], subtaskIds: [], taskIds: [] };
                const add = (key, values) => {
                    const current = Array.isArray(pending[key]) ? pending[key] : [];
                    pending[key] = Array.from(new Set(current.concat(values).map((id) => String(id || '').trim()).filter(Boolean)));
                };
                add('parentIds', [parentTaskId]);
                add('subtaskIds', [subtaskId]);
                add('taskIds', refreshIds);
                pending.updatedAt = Date.now();
                state.__tmChecklistOptimisticSubtaskRefreshPending = pending;
                state.__tmChecklistProjectionGroupRefreshTaskIds = Array.from(new Set(((state.__tmChecklistProjectionGroupRefreshTaskIds || []).concat(refreshIds)).map((id) => String(id || '').trim()).filter(Boolean)));
                state.__tmChecklistProjectionGroupRefreshUntil = Date.now() + 30000;
                state.listDomRenderSignature = '';
            } catch (e) {}
            return true;
        }
        try {
            const current = Array.isArray(state.__tmChecklistProjectionGroupRefreshTaskIds)
                ? state.__tmChecklistProjectionGroupRefreshTaskIds
                : [];
            const merged = new Set(current.map((id) => String(id || '').trim()).filter(Boolean));
            refreshIds.forEach((id) => merged.add(id));
            state.__tmChecklistProjectionGroupRefreshTaskIds = Array.from(merged);
            state.__tmChecklistProjectionGroupRefreshUntil = Date.now() + 1500;
            state.listDomRenderSignature = '';
        } catch (e) {}
        if (state.__tmChecklistOptimisticSubtaskRefreshQueued === true) return true;
        state.__tmChecklistOptimisticSubtaskRefreshQueued = true;
        const run = () => {
            state.__tmChecklistOptimisticSubtaskRefreshQueued = false;
            if (String(state.viewMode || '').trim() !== 'checklist') return;
            if (!(state.modal instanceof Element) || !document.body.contains(state.modal)) return;
            try { state.listDomRenderSignature = ''; } catch (e) {}
            try { __tmRerenderChecklistInPlace(state.modal); } catch (e) {}
        };
        try {
            if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
            else setTimeout(run, 0);
        } catch (e) {
            try { setTimeout(run, 0); } catch (e2) {}
        }
        return true;
    }

    globalThis.__tmFlushDeferredChecklistOptimisticSubtaskRefresh = __tmFlushDeferredChecklistOptimisticSubtaskRefresh;
    globalThis.__tmScheduleDeferredChecklistOptimisticSubtaskRefreshFlush = __tmScheduleDeferredChecklistOptimisticSubtaskRefreshFlush;

    function __tmGetMoveTargetHeadingMeta(payload = {}) {
        const targetTask = state.flatTasks?.[String(payload.targetTaskId || '').trim()] || null;
        const rank0 = Number(payload.targetHeadingRank);
        return {
            h2Id: String(payload.targetHeadingId || targetTask?.h2Id || '').trim(),
            h2: String(payload.targetHeading || targetTask?.h2 || '').trim(),
            h2Rank: Number.isFinite(rank0) ? rank0 : Number(targetTask?.h2Rank),
        };
    }

    function __tmApplyOptimisticDocTask(payload = {}) {
        const docId = String(payload.docId || '').trim();
        const tempId = String(payload.tempId || '').trim();
        const clientId = String(payload.clientId || '').trim();
        const content = String(payload.content || '').trim();
        if (!docId || !tempId || !content) return null;
        try {
            globalThis.__tmTaskIdentity?.remember?.({
                clientId,
                tempId,
                kind: 'task',
                status: 'optimistic',
            });
        } catch (e) {}
        const docName = state.allDocuments.find((d) => String(d?.id || '').trim() === docId)?.name || '未知文档';
        const pr0 = String(payload.priority ?? '').trim();
        const prMap = { '高': 'high', '中': 'medium', '低': 'low', '无': '', 'none': '' };
        const priority = Object.prototype.hasOwnProperty.call(prMap, pr0) ? prMap[pr0] : pr0;
        const statusOptions = __tmGetStatusOptions(SettingsStore.data.customStatusOptions || []);
        const requestedStatusId = String(payload.customStatus || '').trim();
        const requestedStatusOption = requestedStatusId ? __tmFindStatusOptionById(requestedStatusId, statusOptions) : null;
        const initialMarker = requestedStatusOption
            ? __tmNormalizeTaskStatusMarker(requestedStatusOption.marker, __tmGuessStatusOptionDefaultMarker(requestedStatusOption))
            : ' ';
        const nextTask = {
            id: tempId,
            clientId,
            __tmClientId: clientId,
            done: __tmIsTaskMarkerDone(initialMarker),
            pinned: payload.pinned !== undefined ? !!payload.pinned : !!SettingsStore.data.pinNewTasksByDefault,
            content,
            markdown: `- [${initialMarker}] ${content}`,
            priority: priority || '',
            duration: '',
            remark: '',
            startDate: String(payload.startDate || '').trim(),
            start_date: String(payload.startDate || '').trim(),
            completionTime: String(payload.completionTime || '').trim(),
            customTime: '',
            customStatus: String(payload.customStatus || '').trim(),
            taskMarker: initialMarker,
            task_marker: initialMarker,
            docName,
            root_id: docId,
            docId,
            parent_id: '',
            parentTaskId: '',
            parent_task_id: '',
            h2: __tmNormalizeHeadingText(payload.targetHeading || payload.h2 || ''),
            h2Id: String(payload.targetHeadingId || payload.h2Id || '').trim(),
            h2Rank: Number.isFinite(Number(payload.targetHeadingRank ?? payload.h2Rank)) ? Number(payload.targetHeadingRank ?? payload.h2Rank) : Number.NaN,
            h2Path: '',
            h2Sort: Number.NaN,
            h2Created: '',
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            children: [],
            level: 0,
        };
        try { normalizeTaskFields(nextTask, docName); } catch (e) {}
        if (String(nextTask.completionTime || '').trim() || String(nextTask.startDate || '').trim() || String(nextTask.customTime || '').trim()) {
            try { __tmMarkVisibleDateFallbackTask(tempId); } catch (e) {}
        }
        let insertedPending = false;
        try {
            insertedPending = !!globalThis.__tmTaskStore?.createPendingTask?.(nextTask, {
                clientId,
                tempId,
                kind: 'task',
                status: 'optimistic',
                expiresAt: Date.now() + __TM_PENDING_INSERTED_TASK_KEEPALIVE_MS,
            });
        } catch (e) {}
        if (!insertedPending) return null;
        __tmInsertTaskIntoDocLocal(nextTask, {
            atTop: payload.atTop === true,
            insertBeforeId: String(payload.insertBeforeId || '').trim(),
            insertAfterId: String(payload.insertAfterId || '').trim(),
        });
        if (payload.skipOptimisticFilterWork !== true) {
            try { recalcStats(); } catch (e) {}
            try { applyFilters(); } catch (e) {}
        } else {
            let projected = false;
            try { projected = __tmEnsureOptimisticTaskInFilteredTasks(nextTask) === true; } catch (e) {}
            if (!projected && payload.skipOptimisticFilterFallback !== true) {
                try {
                    __tmScheduleViewRefresh({
                        mode: 'current',
                        withFilters: true,
                        reason: 'create-task-optimistic-filter-fallback',
                        taskIds: [tempId],
                    });
                } catch (e) {}
            }
        }
        if (payload.skipOptimisticMainRefresh !== true) {
            __tmRefreshAfterOptimisticTaskCreate(tempId, 'create-task-optimistic');
        }
        return nextTask;
    }

    function __tmRemoveTaskFromLocalState(taskId, options = {}) {
        const tid = String(taskId || '').trim();
        if (!tid) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const aliases = new Set([tid]);
        try {
            const runtimeAliases = globalThis.__tmRuntimeState?.getTaskIdAliases?.(tid);
            (Array.isArray(runtimeAliases) ? runtimeAliases : []).forEach((id) => {
                const nextId = String(id || '').trim();
                if (nextId) aliases.add(nextId);
            });
        } catch (e) {}
        try {
            const resolvedId = String(__tmResolveOptimisticTaskId?.(tid) || '').trim();
            if (resolvedId) aliases.add(resolvedId);
        } catch (e) {}
        let removed = false;
        try {
            aliases.forEach((aliasId) => {
                if (globalThis.__tmTaskStore?.removeLocal?.(aliasId, {
                    source: String(opts.source || 'remove-task-local-state').trim() || 'remove-task-local-state',
                })) {
                    removed = true;
                }
            });
        } catch (e) {}
        const removeRecursive = (list) => {
            if (!Array.isArray(list)) return false;
            let changed = false;
            for (let i = list.length - 1; i >= 0; i -= 1) {
                const item = list[i];
                if (aliases.has(String(item?.id || '').trim())) {
                    list.splice(i, 1);
                    changed = true;
                    continue;
                }
                if (removeRecursive(item?.children)) changed = true;
            }
            return changed;
        };
        try {
            state.taskTree.forEach((doc) => {
                if (removeRecursive(doc?.tasks)) removed = true;
            });
        } catch (e) {}
        if (opts.recalc !== false) {
            try { recalcStats(); } catch (e) {}
        }
        if (opts.filter !== false) {
            try { applyFilters(); } catch (e) {}
        }
        return removed;
    }

    function __tmCommitOptimisticTaskId(tempId, realId, options = {}) {
        const tmp = String(tempId || '').trim();
        const rid = String(realId || '').trim();
        if (!tmp || !rid || tmp === rid) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        let pendingDoneRequest = null;
        try { __tmRememberOptimisticTaskIdRemap(tmp, rid); } catch (e) {}
        try { __tmTransferVisibleDateFallbackTaskId(tmp, rid); } catch (e) {}
        const wasDeletedBeforeCommit = __tmIsPendingDeletedTaskId(tmp) || __tmIsPendingDeletedTaskId(rid);
        try {
            if (state.pendingInsertedTasks?.[tmp]?.__tmPendingDoneRequest) {
                pendingDoneRequest = { ...state.pendingInsertedTasks[tmp].__tmPendingDoneRequest };
            }
        } catch (e) {}
        let remappedLocal = false;
        try {
            remappedLocal = !!globalThis.__tmTaskStore?.commitTaskId?.(tmp, rid, {
                clientId: String(opts.clientId || '').trim(),
                blockId: rid,
                keepPending: true,
            });
        } catch (e) {}
        if (!remappedLocal) {
            try { __tmRemapTaskId(tmp, rid); } catch (e) { return false; }
        }
        try { __tmRemapDoneStateTaskId(tmp, rid); } catch (e) {}
        try { globalThis.__tmTaskStore?.deletePendingProps?.(rid, '__tmPendingDoneRequest'); } catch (e) {}
        if (wasDeletedBeforeCommit) {
            try { __tmRememberPendingDeletedTaskIds([tmp, rid], { source: 'create-commit-after-delete' }); } catch (e) {}
            try { __tmRemoveTaskFromLocalState(tmp, { recalc: false, filter: false }); } catch (e) {}
            try { __tmRemoveTaskFromLocalState(rid, { recalc: false, filter: false }); } catch (e) {}
            try { __tmRemoveTaskFromFilteredLocalState(tmp); } catch (e) {}
            try { __tmRemoveTaskFromFilteredLocalState(rid); } catch (e) {}
            try { __tmRemoveTaskDomNodes(tmp); } catch (e) {}
            try { __tmRemoveTaskDomNodes(rid); } catch (e) {}
            return true;
        }
        try { __tmRemapOptimisticTaskDomId(tmp, rid); } catch (e) {}
        try { __tmRemapWhiteboardTaskId?.(tmp, rid, { persist: false }); } catch (e) {}
        try {
            ['detailTaskId', 'kanbanDetailTaskId', 'kanbanDetailAnchorTaskId', 'timerFocusTaskId'].forEach((key) => {
                if (String(state[key] || '').trim() === tmp) state[key] = rid;
            });
        } catch (e) {}
        try {
            const task = state.flatTasks?.[rid] || state.pendingInsertedTasks?.[rid] || null;
            const identity = globalThis.__tmTaskIdentity?.get?.(rid)
                || globalThis.__tmTaskIdentity?.get?.(tmp)
                || null;
            globalThis.__tmTaskStore?.applyMutation?.({
                type: 'commitTaskId',
                phase: 'commit',
                taskId: rid,
                tempId: tmp,
                realId: rid,
                clientId: String(opts.clientId || identity?.clientId || task?.clientId || task?.__tmClientId || '').trim(),
                parentTaskId: String(opts.parentTaskId || task?.parentTaskId || task?.parent_task_id || '').trim(),
                docId: String(task?.docId || task?.root_id || '').trim(),
                source: String(opts.source || 'commit-optimistic-task-id').trim() || 'commit-optimistic-task-id',
                data: {
                    ...((opts.data && typeof opts.data === 'object') ? opts.data : {}),
                    refreshPolicy: {
                        current: opts.refreshCurrentView !== false,
                        detail: opts.refreshCurrentView !== false,
                        checklistGroup: !!String(opts.parentTaskId || task?.parentTaskId || task?.parent_task_id || '').trim(),
                        snapshot: opts.scheduleSnapshotRefresh !== false && opts.skipSnapshotViewStateFilterRefresh !== true,
                        ...((opts.data?.refreshPolicy && typeof opts.data.refreshPolicy === 'object') ? opts.data.refreshPolicy : {}),
                    },
                    refreshCurrentView: opts.refreshCurrentView !== false,
                    scheduleSnapshotRefresh: opts.scheduleSnapshotRefresh !== false,
                    skipSnapshotViewStateFilterRefresh: opts.skipSnapshotViewStateFilterRefresh === true,
                },
            }, {
                applyLocal: false,
            });
        } catch (e) {}
        try {
            const task = state.flatTasks?.[rid] || state.pendingInsertedTasks?.[rid] || null;
            __tmRefreshCommittedOptimisticTaskScore(rid, { parentTaskId: task?.parentTaskId || '' }).catch(() => null);
        } catch (e) {}
        if (pendingDoneRequest && pendingDoneRequest.done === true) {
            try {
                const task = state.flatTasks?.[rid] || state.pendingInsertedTasks?.[rid] || null;
                if (task && typeof task === 'object') task.done = false;
                setTimeout(async () => {
                    try {
                        await __tmRefreshCommittedOptimisticTaskScore(rid, { parentTaskId: task?.parentTaskId || '' });
                        window.tmSetDone?.(rid, true, null, {
                            ...pendingDoneRequest.options,
                            source: String(pendingDoneRequest.options?.source || 'pending-create-set-done').trim() || 'pending-create-set-done',
                        });
                    } catch (e) {}
                }, 0);
            } catch (e) {}
        }
        return true;
    }

    async function __tmRefreshCommittedOptimisticTaskScore(taskId, options = {}) {
        const tid = String(taskId || '').trim();
        if (!tid) return null;
        if (__tmIsPendingDeletedTaskId(tid)) return null;
        const opts = (options && typeof options === 'object') ? options : {};
        let latest = null;
        try { latest = await __tmBuildTaskLikeFromBlockId(tid); } catch (e) { latest = null; }
        const local = state.flatTasks?.[tid] || state.pendingInsertedTasks?.[tid] || null;
        const task = (latest && typeof latest === 'object')
            ? latest
            : ((local && typeof local === 'object') ? local : null);
        if (!task) return null;
        const parentTaskId = String(opts.parentTaskId || local?.parentTaskId || task.parentTaskId || '').trim();
        if (parentTaskId) {
            task.parentTaskId = parentTaskId;
            task.parent_task_id = parentTaskId;
        }
        if (local && typeof local === 'object') {
            ['docId', 'root_id', 'docName', 'h2', 'h2Id', 'h2Rank', 'level', 'docSeq', 'doc_seq'].forEach((key) => {
                if (task[key] == null || String(task[key] || '').trim() === '') task[key] = local[key];
            });
        }
        try { normalizeTaskFields(task, task.docName || local?.docName || '未命名文档'); } catch (e) {}
        try { task.priorityScore = __tmEnsureTaskPriorityScore(task, { force: true }); } catch (e) {}
        let upserted = false;
        try {
            upserted = !!globalThis.__tmTaskStore?.upsertLocal?.(task, {
                pending: !!state.pendingInsertedTasks?.[tid],
                expiresAt: state.pendingInsertedTasks?.[tid]?.expiresAt || Date.now() + __TM_PENDING_INSERTED_TASK_KEEPALIVE_MS,
                status: 'committed-score-refresh',
            });
        } catch (e) {}
        if (!upserted) {
            try { globalThis.__tmTaskStore?.upsertLocal?.(task, { status: 'keep-pending-attrs' }); } catch (e) {}
            try {
                const syncTreeTask = (list) => {
                    if (!Array.isArray(list)) return false;
                    for (let i = 0; i < list.length; i += 1) {
                        const item = list[i];
                        if (!item || typeof item !== 'object') continue;
                        if (String(item.id || '').trim() === tid) {
                            list[i] = {
                                ...item,
                                ...task,
                                children: Array.isArray(task.children) && task.children.length
                                    ? task.children
                                    : (Array.isArray(item.children) ? item.children : []),
                            };
                            return true;
                        }
                        if (syncTreeTask(item.children)) return true;
                    }
                    return false;
                };
                (Array.isArray(state.taskTree) ? state.taskTree : []).some((doc) => syncTreeTask(doc?.tasks));
            } catch (e) {}
            try {
                if (state.pendingInsertedTasks?.[tid]) {
                    globalThis.__tmTaskStore?.upsertLocal?.({
                        ...state.pendingInsertedTasks[tid],
                        ...task,
                        expiresAt: state.pendingInsertedTasks[tid].expiresAt || Date.now() + __TM_PENDING_INSERTED_TASK_KEEPALIVE_MS,
                    }, {
                        pending: true,
                        expiresAt: state.pendingInsertedTasks[tid].expiresAt || Date.now() + __TM_PENDING_INSERTED_TASK_KEEPALIVE_MS,
                        status: 'keep-pending-attrs',
                    });
                }
            } catch (e) {}
        }
        try {
            const parent = parentTaskId ? (state.flatTasks?.[parentTaskId] || null) : null;
            if (parent && Array.isArray(parent.children)) {
                const idx = parent.children.findIndex((child) => String(child?.id || '').trim() === tid);
                if (idx >= 0) parent.children[idx] = { ...parent.children[idx], ...task };
            }
        } catch (e) {}
        return task;
    }

    function __tmRemapOptimisticTaskDomId(tempId, realId) {
        const tmp = String(tempId || '').trim();
        const rid = String(realId || '').trim();
        if (!tmp || !rid || tmp === rid) return false;
        const escTmp = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
            ? CSS.escape(tmp)
            : tmp.replace(/["\\]/g, '\\$&');
        const replaceAttrValue = (el, attrName) => {
            try {
                if (!(el instanceof Element) || !el.hasAttribute(attrName)) return;
                const value = String(el.getAttribute(attrName) || '');
                if (value === tmp) {
                    el.setAttribute(attrName, rid);
                    return;
                }
                if (value.includes(tmp)) {
                    el.setAttribute(attrName, value.split(tmp).join(rid));
                }
            } catch (e) {}
        };
        const replaceElementTaskRefs = (el) => {
            replaceAttrValue(el, 'data-id');
            replaceAttrValue(el, 'data-task-id');
            replaceAttrValue(el, 'data-tm-detail-task-id');
            replaceAttrValue(el, 'data-tm-detail-id');
            replaceAttrValue(el, 'data-tm-detail-subtask-content');
            replaceAttrValue(el, 'data-tm-detail-open-child');
            replaceAttrValue(el, 'data-tm-detail-subtask-menu');
            replaceAttrValue(el, 'data-tm-task-id');
            replaceAttrValue(el, 'data-parent-task-id');
            replaceAttrValue(el, 'data-tm-parent-task-id');
            replaceAttrValue(el, 'aria-controls');
            replaceAttrValue(el, 'href');
            replaceAttrValue(el, 'value');
            try {
                if (el.__tmTaskDetailTaskId === tmp) el.__tmTaskDetailTaskId = rid;
                if (el.__tmTaskDetailTask && String(el.__tmTaskDetailTask.id || '').trim() === tmp) {
                    el.__tmTaskDetailTask = { ...el.__tmTaskDetailTask, id: rid };
                }
            } catch (e) {}
        };
        try {
            document.querySelectorAll(
                `[data-id="${escTmp}"], [data-task-id="${escTmp}"], [data-tm-detail-task-id="${escTmp}"], [data-tm-detail-id="${escTmp}"], [data-tm-detail-subtask-content="${escTmp}"], [data-tm-detail-open-child="${escTmp}"], [data-tm-detail-subtask-menu="${escTmp}"], [data-tm-task-id="${escTmp}"], [data-parent-task-id="${escTmp}"], [data-tm-parent-task-id="${escTmp}"]`
            ).forEach((el) => {
                replaceElementTaskRefs(el);
            });
        } catch (e) {}
        try {
            document.querySelectorAll('[data-tm-detail-task-id], [data-tm-detail-id], [aria-controls], input[value], button[value]').forEach((el) => {
                replaceElementTaskRefs(el);
            });
        } catch (e) {}
        try {
            document.querySelectorAll('.tm-task-checkbox[onchange]').forEach((el) => {
                replaceAttrValue(el, 'onchange');
            });
        } catch (e) {}
        try {
            document.querySelectorAll('[onclick],[oncontextmenu],[ondragstart],[ondragenter],[ondragover],[ondrop]').forEach((el) => {
                replaceAttrValue(el, 'onclick');
                replaceAttrValue(el, 'oncontextmenu');
                replaceAttrValue(el, 'ondragstart');
                replaceAttrValue(el, 'ondragenter');
                replaceAttrValue(el, 'ondragover');
                replaceAttrValue(el, 'ondrop');
            });
        } catch (e) {}
        return true;
    }

    function __tmCaptureTaskLocalSnapshot(taskId) {
        const tid = String(taskId || '').trim();
        if (!tid) return null;
        let foundTask = null;
        let parentTaskId = '';
        let docId = '';
        let index = -1;
        const walk = (list, ownerDocId, ownerParentId) => {
            if (!Array.isArray(list)) return false;
            const idx = list.findIndex((item) => String(item?.id || '').trim() === tid);
            if (idx >= 0) {
                foundTask = list[idx];
                parentTaskId = String(ownerParentId || '').trim();
                docId = String(ownerDocId || foundTask?.docId || foundTask?.root_id || '').trim();
                index = idx;
                return true;
            }
            return list.some((item) => walk(item?.children, ownerDocId, item?.id));
        };
        (Array.isArray(state.taskTree) ? state.taskTree : []).some((doc) => walk(doc?.tasks, doc?.id, ''));
        if (!foundTask) {
            foundTask = globalThis.__tmRuntimeState?.getTaskById?.(tid, { includePending: true, preferPending: true })
                || state.flatTasks?.[tid]
                || state.pendingInsertedTasks?.[tid]
                || null;
            if (foundTask && typeof foundTask === 'object') {
                parentTaskId = String(foundTask.parentTaskId || foundTask.parent_task_id || '').trim();
                docId = String(foundTask.docId || foundTask.root_id || '').trim();
                if (parentTaskId) {
                    const parent = globalThis.__tmRuntimeState?.getTaskById?.(parentTaskId, { includePending: true, preferPending: true })
                        || state.flatTasks?.[parentTaskId]
                        || state.pendingInsertedTasks?.[parentTaskId]
                        || null;
                    if (Array.isArray(parent?.children)) {
                        index = parent.children.findIndex((item) => String(item?.id || '').trim() === tid);
                    }
                }
            }
        }
        if (!foundTask) return null;
        let cloned = null;
        try {
            cloned = JSON.parse(JSON.stringify(foundTask));
        } catch (e) {
            cloned = { ...foundTask };
        }
        return {
            task: cloned,
            taskId: tid,
            parentTaskId,
            docId,
            index,
            detailSelected: String(state.detailTaskId || '').trim() === tid
                || (globalThis.__tmRuntimeState?.resolveOptimisticTaskId?.(state.detailTaskId) === globalThis.__tmRuntimeState?.resolveOptimisticTaskId?.(tid)),
        };
    }

    function __tmRestoreTaskFlatMap(task) {
        const nextTask = (task && typeof task === 'object') ? task : null;
        if (!nextTask) return;
        const taskId = String(nextTask.id || '').trim();
        if (!taskId) return;
        let upserted = false;
        try {
            upserted = !!globalThis.__tmTaskStore?.upsertLocal?.(nextTask, {
                status: 'restore-flat-map',
            });
        } catch (e) {}
        if (!upserted) return;
        const children = Array.isArray(nextTask.children) ? nextTask.children : [];
        children.forEach((child) => __tmRestoreTaskFlatMap(child));
    }

    function __tmCollectTaskTreeIdsForScheduleCleanup(taskLike, fallbackIds = []) {
        const out = [];
        const seen = new Set();
        const pushId = (value) => {
            const id = String(value || '').trim();
            if (!id || seen.has(id)) return;
            seen.add(id);
            out.push(id);
        };
        const walk = (task) => {
            if (!task || typeof task !== 'object') return;
            pushId(task.id);
            const children = Array.isArray(task.children) ? task.children : [];
            children.forEach(walk);
        };
        walk(taskLike);
        (Array.isArray(fallbackIds) ? fallbackIds : [fallbackIds]).forEach(pushId);
        return out;
    }

    function __tmRemoveTaskFromFilteredLocalState(taskId) {
        const tid = String(taskId || '').trim();
        if (!tid) return false;
        const aliases = new Set([tid]);
        try {
            const runtimeAliases = globalThis.__tmRuntimeState?.getTaskIdAliases?.(tid);
            (Array.isArray(runtimeAliases) ? runtimeAliases : []).forEach((id) => {
                const nextId = String(id || '').trim();
                if (nextId) aliases.add(nextId);
            });
        } catch (e) {}
        try {
            const resolvedId = String(__tmResolveOptimisticTaskId?.(tid) || '').trim();
            if (resolvedId) aliases.add(resolvedId);
        } catch (e) {}
        const removeRecursive = (list) => {
            if (!Array.isArray(list)) return false;
            let removed = false;
            for (let i = list.length - 1; i >= 0; i -= 1) {
                const item = list[i];
                if (aliases.has(String(item?.id || '').trim())) {
                    list.splice(i, 1);
                    removed = true;
                    continue;
                }
                if (removeRecursive(item?.children)) removed = true;
            }
            return removed;
        };
        let removed = false;
        try { if (removeRecursive(state.filteredTasks)) removed = true; } catch (e) {}
        if (removed) {
            try { __tmInvalidateFilteredTaskDerivedStateCache(); } catch (e) {}
        }
        return removed;
    }

    function __tmEnsurePendingDeletedTaskStore() {
        try { return globalThis.__tmTaskStore?.getPendingDeletedMap?.() || {}; } catch (e) { return {}; }
    }

    function __tmRememberPendingDeletedTaskIds(taskIds, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const expiresAt = Math.max(Date.now() + 45000, Number(opts.expiresAt) || 0);
        const store = __tmEnsurePendingDeletedTaskStore();
        const ids = Array.isArray(taskIds) ? taskIds : [taskIds];
        ids.forEach((id) => {
            const tid = String(id || '').trim();
            if (!tid) return;
            store[tid] = {
                taskId: tid,
                expiresAt,
                source: String(opts.source || 'delete-optimistic').trim() || 'delete-optimistic',
            };
        });
        try {
            Object.keys(store).forEach((key) => {
                const expires = Number(store[key]?.expiresAt) || 0;
                if (expires > 0 && expires < Date.now()) delete store[key];
            });
        } catch (e) {}
        return true;
    }

    function __tmForgetPendingDeletedTaskIds(taskIds) {
        const store = __tmEnsurePendingDeletedTaskStore();
        const ids = Array.isArray(taskIds) ? taskIds : [taskIds];
        ids.forEach((id) => {
            const tid = String(id || '').trim();
            if (!tid) return;
            try { delete store[tid]; } catch (e) {}
        });
        return true;
    }

    function __tmIsPendingDeletedTaskId(taskId) {
        const tid = String(taskId || '').trim();
        if (!tid) return false;
        try {
            if (globalThis.__tmRuntimeState?.isPendingDeletedTaskId?.(tid)) return true;
        } catch (e) {}
        const store = __tmEnsurePendingDeletedTaskStore();
        const item = store[tid];
        if (!item) return false;
        const expiresAt = Number(item?.expiresAt) || 0;
        if (expiresAt > 0 && expiresAt < Date.now()) {
            try { delete store[tid]; } catch (e) {}
            return false;
        }
        return true;
    }

    function __tmRemoveTaskDomNodes(taskId) {
        const tid = String(taskId || '').trim();
        if (!tid || !(state.modal instanceof Element)) return false;
        const escId = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
            ? CSS.escape(tid)
            : tid.replace(/["\\]/g, '\\$&');
        const selectors = [
            `.tm-checklist-item[data-id="${escId}"]`,
            `#tmTimelineLeftTable tbody tr[data-id="${escId}"]`,
            `#tmTaskTable tbody tr[data-id="${escId}"]`,
            `.tm-kanban-card[data-id="${escId}"]`,
            `.tm-whiteboard-stream-task-node[data-task-id="${escId}"]`,
            `.tm-whiteboard-stream-task-head[data-task-id="${escId}"]`,
            `.tm-whiteboard-node[data-task-id="${escId}"]`,
            `.tm-whiteboard-pool-item[data-task-id="${escId}"]`,
            `.tm-calendar-task-list [data-id="${escId}"]`,
            `.tm-calendar-task-list [data-task-id="${escId}"]`,
        ];
        const nodes = Array.from(state.modal.querySelectorAll(selectors.join(',')))
            .filter((node) => node instanceof HTMLElement);
        const removeTargets = new Set();
        nodes.forEach((node) => {
            const target = node.closest(
                '.tm-checklist-item,.tm-kanban-card,.tm-whiteboard-stream-task-node,.tm-whiteboard-node,.tm-whiteboard-pool-item,tr,[data-id],[data-task-id]'
            );
            if (target instanceof HTMLElement) removeTargets.add(target);
        });
        removeTargets.forEach((node) => {
            try { node.remove(); } catch (e) {}
        });
        return removeTargets.size > 0;
    }

    function __tmApplyDeleteOptimisticLocal(snapshot, fallbackData = {}) {
        const snap = (snapshot && typeof snapshot === 'object') ? snapshot : null;
        const fallback = (fallbackData && typeof fallbackData === 'object') ? fallbackData : {};
        const tid = String(snap?.taskId || fallback.taskId || '').trim();
        if (!tid) return false;
        let deletedIds = [];
        try {
            const ids = __tmCollectTaskTreeIdsForScheduleCleanup(snap?.task || fallback.task, [
                tid,
                ...(Array.isArray(fallback.scheduleCleanupTaskIds) ? fallback.scheduleCleanupTaskIds : []),
            ]);
            deletedIds = ids;
            __tmRememberPendingDeletedTaskIds(ids, { source: 'task-delete-optimistic' });
            const calendarApi = globalThis.__tmCalendar;
            if (calendarApi && typeof calendarApi.removeTaskDateEventsByTaskIds === 'function') {
                calendarApi.removeTaskDateEventsByTaskIds(ids, {
                    main: true,
                    side: true,
                    source: 'task-delete-optimistic',
                });
            }
        } catch (e) {}
        if (!deletedIds.length) __tmRememberPendingDeletedTaskIds(tid, { source: 'task-delete-optimistic' });
        __tmRemoveTaskFromLocalState(tid, { recalc: false, filter: false });
        try { __tmRemoveTaskFromFilteredLocalState(tid); } catch (e) {}
        try { __tmRemoveTaskDomNodes(tid); } catch (e) {}
        if (snap?.detailSelected) {
            state.detailTaskId = '';
            state.checklistDetailDismissed = true;
            state.checklistDetailSheetOpen = false;
            state.checklistDetailSheetFullscreen = false;
        }
        try {
            __tmScheduleIdleTask(() => {
                try { recalcStats(); } catch (e) {}
            }, 500);
        } catch (e) {
            try { setTimeout(() => { try { recalcStats(); } catch (e2) {} }, 500); } catch (e2) {}
        }
        return true;
    }

    function __tmRollbackDeleteOptimisticLocal(snapshot, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const snap = (snapshot && typeof snapshot === 'object') ? snapshot : null;
        const task = snap?.task;
        const taskId = String(task?.id || '').trim();
        if (!task || !taskId) return false;
        try {
            __tmForgetPendingDeletedTaskIds(__tmCollectTaskTreeIdsForScheduleCleanup(task, taskId));
        } catch (e) {
            try { __tmForgetPendingDeletedTaskIds(taskId); } catch (e2) {}
        }
        if (snap.parentTaskId) {
            const parent = state.flatTasks?.[String(snap.parentTaskId || '').trim()] || null;
            if (parent) {
                if (!Array.isArray(parent.children)) parent.children = [];
                const idx = Math.max(0, Math.min(parent.children.length, Number(snap.index) || 0));
                if (!parent.children.some((item) => String(item?.id || '').trim() === taskId)) {
                    parent.children.splice(idx, 0, task);
                }
            }
        } else {
            const doc = state.taskTree.find((item) => String(item?.id || '').trim() === String(snap.docId || '').trim());
            if (doc) {
                if (!Array.isArray(doc.tasks)) doc.tasks = [];
                const idx = Math.max(0, Math.min(doc.tasks.length, Number(snap.index) || 0));
                if (!doc.tasks.some((item) => String(item?.id || '').trim() === taskId)) {
                    doc.tasks.splice(idx, 0, task);
                }
            }
        }
        __tmRestoreTaskFlatMap(task);
        if (snap?.detailSelected) {
            state.detailTaskId = taskId;
            state.checklistDetailDismissed = false;
        }
        if (opts.mutationDriven !== true) {
            try { recalcStats(); } catch (e) {}
            try { applyFilters(); } catch (e) {}
            try { __tmScheduleRender({ withFilters: true }); } catch (e) {}
        }
        try {
            const calendarApi = globalThis.__tmCalendar;
            if (calendarApi && typeof calendarApi.syncTaskDateInPlace === 'function') {
                Promise.resolve(calendarApi.syncTaskDateInPlace(taskId, { main: true, side: true }))
                    .then((summary) => {
                        if ((summary?.needsMainRefresh || summary?.needsSideRefresh) && typeof calendarApi.requestRefresh === 'function') {
                            calendarApi.requestRefresh({
                                reason: 'task-delete-rollback',
                                main: summary.needsMainRefresh,
                                side: summary.needsSideRefresh,
                                flushTaskPanel: false,
                            });
                        }
                    })
                    .catch(() => null);
            }
        } catch (e) {}
        return true;
    }

    function __tmShouldSyncCalendarDoneInPlace(source) {
        return String(source || '').trim() === 'calendar'
            && (globalThis.__tmRuntimeState?.isViewMode?.('calendar') ?? (String(state.viewMode || '').trim() === 'calendar'))
            && !!globalThis.__tmCalendar?.syncTaskDoneInPlace;
    }

    function __tmSyncTaskDetailSubtaskDoneInDOM(taskId, done) {
        const tid = String(taskId || '').trim();
        if (!tid || typeof document === 'undefined') return false;
        const ids = new Set([tid]);
        try {
            const aliases = globalThis.__tmRuntimeState?.getTaskIdAliases?.(tid);
            (Array.isArray(aliases) ? aliases : []).forEach((id) => {
                const nextId = String(id || '').trim();
                if (nextId) ids.add(nextId);
            });
        } catch (e) {}
        try {
            const resolvedId = String(__tmResolveOptimisticTaskId?.(tid) || '').trim();
            if (resolvedId) ids.add(resolvedId);
        } catch (e) {}
        const escapeAttr = (value) => (
            typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
                ? CSS.escape(value)
                : String(value || '').replace(/["\\]/g, '\\$&')
        );
        const root = state.modal instanceof Element ? state.modal : document;
        let touched = false;
        ids.forEach((id) => {
            try {
                root.querySelectorAll(`[data-tm-detail-subtask-content="${escapeAttr(id)}"]`).forEach((title) => {
                    if (!(title instanceof HTMLElement)) return;
                    title.classList.toggle('is-done', !!done);
                    const row = title.closest('.tm-task-detail-subtask-row');
                    const checkbox = row?.querySelector?.('.tm-task-checkbox');
                    if (checkbox instanceof HTMLInputElement) checkbox.checked = !!done;
                    touched = true;
                });
            } catch (e) {}
        });
        return touched;
    }

    function __tmApplyDoneOptimisticLocal(taskId, done, statusPatch = null, source = '', options = {}) {
        const tid = String(taskId || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        const task = globalThis.__tmRuntimeState?.getTaskById?.(tid, { includePending: true, preferPending: true })
            || state.pendingInsertedTasks?.[tid]
            || state.flatTasks?.[tid]
            || null;
        if (!task) return false;
        const nextStatusPatch = (statusPatch && typeof statusPatch === 'object' && !Array.isArray(statusPatch)) ? statusPatch : null;
        const retentionPatch = typeof __tmProtectMarkdownMutationTaskFields === 'function'
            ? __tmProtectMarkdownMutationTaskFields(tid, task, { source: String(source || 'done-local').trim() || 'done-local' })
            : {};
        if (nextStatusPatch && Object.keys(nextStatusPatch).length > 0) {
            __tmApplyAttrPatchLocally(tid, nextStatusPatch, {
                ...opts,
                render: false,
                withFilters: true,
                source: String(source || 'done-local').trim() || 'done-local',
            });
        }
        const applyOne = (target) => {
            if (!(target && typeof target === 'object')) return;
            target.done = !!done;
            const marker = target.done ? 'X' : ' ';
            target.taskMarker = marker;
            target.task_marker = marker;
            try { target.markdown = __tmBuildTaskMarkdownWithMarker(target, marker); } catch (e) {}
        };
        applyOne(task);
        try { applyOne(state.flatTasks?.[tid]); } catch (e) {}
        try { applyOne(state.pendingInsertedTasks?.[tid]); } catch (e) {}
        const nextMarker = task.done ? 'X' : ' ';
        try {
            if (!state.doneOverrides || typeof state.doneOverrides !== 'object') state.doneOverrides = {};
            state.doneOverrides[tid] = !!done;
        } catch (e) {}
        try { MetaStore.set(tid, { done: !!done, content: task.content, taskMarker: nextMarker, markdown: task.markdown }); } catch (e) {}
        try { __tmSyncTaskDetailSubtaskDoneInDOM(tid, !!done); } catch (e) {}
        try {
            __tmScheduleTaskSnapshotAfterLocalPatch?.(tid, {
                ...((retentionPatch && typeof retentionPatch === 'object') ? retentionPatch : {}),
                done: !!done,
                taskMarker: nextMarker,
                markdown: task.markdown,
                ...((nextStatusPatch && typeof nextStatusPatch === 'object') ? nextStatusPatch : {}),
            }, {
                source: String(source || 'done-local').trim() || 'done-local',
            });
        } catch (e) {}
        try {
            __tmSyncTaskPriorityScoreLocal(tid, {
                includeAncestors: true,
                refreshAncestorViews: opts.refreshAncestorViews !== false,
                reason: 'done-local-priority-sync',
            });
        } catch (e) {}
        try { recalcStats(); } catch (e) {}
        if (__tmShouldSyncCalendarDoneInPlace(source)) {
            try { globalThis.__tmCalendar.syncTaskDoneInPlace(tid, !!done, { allowRefetch: true }); } catch (e) {}
        }
        return true;
    }

    function __tmRollbackDoneOptimisticLocal(taskId, inversePatch, source = '', options = {}) {
        const tid = String(taskId || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        const task = globalThis.__tmRuntimeState?.getTaskById?.(tid, { includePending: true, preferPending: true })
            || state.pendingInsertedTasks?.[tid]
            || state.flatTasks?.[tid]
            || null;
        if (!task) return false;
        const prevPatch = (inversePatch && typeof inversePatch === 'object' && !Array.isArray(inversePatch)) ? inversePatch : {};
        const prevDone = !!(Object.prototype.hasOwnProperty.call(prevPatch, 'done') ? prevPatch.done : task.done);
        const prevStatusPatch = { ...prevPatch };
        delete prevStatusPatch.done;
        if (Object.keys(prevStatusPatch).length > 0) {
            __tmRollbackAttrPatchLocally(tid, prevStatusPatch, { render: false, withFilters: true });
        }
        const applyOne = (target) => {
            if (!(target && typeof target === 'object')) return;
            target.done = prevDone;
            const marker = target.done ? 'X' : ' ';
            target.taskMarker = marker;
            target.task_marker = marker;
            try { target.markdown = __tmBuildTaskMarkdownWithMarker(target, marker); } catch (e) {}
        };
        applyOne(task);
        try { applyOne(state.flatTasks?.[tid]); } catch (e) {}
        try { applyOne(state.pendingInsertedTasks?.[tid]); } catch (e) {}
        try {
            if (!state.doneOverrides || typeof state.doneOverrides !== 'object') state.doneOverrides = {};
            state.doneOverrides[tid] = prevDone;
        } catch (e) {}
        try { MetaStore.set(tid, { done: prevDone, content: task.content }); } catch (e) {}
        try { __tmSyncTaskDetailSubtaskDoneInDOM(tid, prevDone); } catch (e) {}
        try {
            __tmSyncTaskPriorityScoreLocal(tid, {
                includeAncestors: true,
                refreshAncestorViews: opts.refreshAncestorViews !== false,
                reason: 'done-rollback-priority-sync',
            });
        } catch (e) {}
        try { recalcStats(); } catch (e) {}
        if (__tmShouldSyncCalendarDoneInPlace(source)) {
            try { globalThis.__tmCalendar.syncTaskDoneInPlace(tid, prevDone, { allowRefetch: true }); } catch (e) {}
            return true;
        }
        try {
            __tmScheduleViewRefresh({
                mode: 'current',
                withFilters: true,
                reason: 'rollback-done-optimistic',
            });
        } catch (e) {
            try { __tmScheduleRender({ withFilters: true, reason: 'rollback-done-optimistic-fallback' }); } catch (e2) {
                try { render(); } catch (e3) {}
            }
        }
        return true;
    }

    function __tmResolveMoveTargetListId(payload = {}) {
        const data = (payload && typeof payload === 'object') ? payload : {};
        const rawMode = String(data.mode || '').trim();
        const mode = String(globalThis.__tmTaskStore?.normalizeMoveMode?.(rawMode) || (rawMode === 'doc' ? 'docTop' : rawMode)).trim();
        if (mode === 'child' || mode === 'child-top') {
            return String(data.targetChildListId || data.targetTaskId || '').trim();
        }
        if (mode === 'before' || mode === 'after') {
            return String(data.targetListId || data.targetParentTaskId || '').trim();
        }
        if (mode === 'heading' || mode === 'docTop' || mode === 'docBottom') {
            return String(data.targetListId || '').trim();
        }
        return String(data.targetListId || '').trim();
    }

    function __tmApplyMovePayloadToTaskRecursive(task, payload = {}, isRoot = true) {
        const nextTask = (task && typeof task === 'object') ? task : null;
        if (!nextTask) return;
        const rawMode = String(payload.mode || '').trim();
        const mode = String(globalThis.__tmTaskStore?.normalizeMoveMode?.(rawMode) || (rawMode === 'doc' ? 'docTop' : rawMode)).trim();
        const targetDocId = String(payload.targetDocId || '').trim();
        const headingId = String(payload.headingId || '').trim();
        const docName = state.allDocuments.find((item) => String(item?.id || '').trim() === targetDocId)?.name || nextTask.docName || nextTask.doc_name || '';
        const targetParentTaskId = String(payload.targetParentTaskId || '').trim();
        const targetTaskId = String(payload.targetTaskId || '').trim();
        const targetListId = __tmResolveMoveTargetListId(payload);
        const headingMeta = __tmGetMoveTargetHeadingMeta(payload);
        nextTask.root_id = targetDocId;
        nextTask.docId = targetDocId;
        if (docName) {
            nextTask.docName = docName;
            nextTask.doc_name = docName;
        }
        if (mode === 'heading' && headingId) {
            const headings = state.kanbanDocHeadingsByDocId?.[targetDocId];
            const heading = Array.isArray(headings) ? headings.find((item) => String(item?.id || '').trim() === headingId) : null;
            const headingRank = Number(heading?.rank);
            const payloadHeadingRank = Number(payload.targetHeadingRank);
            nextTask.h2Id = headingId;
            nextTask.h2 = __tmNormalizeHeadingText(heading?.content || payload.targetHeading || '');
            nextTask.h2Rank = Number.isFinite(headingRank) ? headingRank : payloadHeadingRank;
        } else if (mode === 'before' || mode === 'after' || mode === 'child' || mode === 'child-top') {
            nextTask.h2Id = headingMeta.h2Id;
            nextTask.h2 = headingMeta.h2;
            nextTask.h2Rank = headingMeta.h2Rank;
            nextTask.h2Path = '';
            nextTask.h2Sort = Number.NaN;
            nextTask.h2Created = '';
        } else {
            nextTask.h2Id = '';
            nextTask.h2 = '';
            nextTask.h2Rank = Number.NaN;
            nextTask.h2Path = '';
            nextTask.h2Sort = Number.NaN;
            nextTask.h2Created = '';
        }
        if (isRoot) {
            if (mode === 'child' || mode === 'child-top') nextTask.parentTaskId = targetTaskId;
            else if (mode === 'before' || mode === 'after') nextTask.parentTaskId = targetParentTaskId;
            else if (mode !== 'heading' || String(payload.crossDoc || '').trim() === '1') nextTask.parentTaskId = '';
            nextTask.parent_task_id = String(nextTask.parentTaskId || '').trim();
            if (targetListId || mode === 'heading' || mode === 'docTop' || mode === 'docBottom') {
                nextTask.parent_id = String(targetListId || '').trim();
                nextTask.parentId = nextTask.parent_id;
            }
        }
        (Array.isArray(nextTask.children) ? nextTask.children : []).forEach((child) => __tmApplyMovePayloadToTaskRecursive(child, payload, false));
    }

    function __tmApplyQueuedTaskMovePatchToTask(task, movePatch = {}) {
        const nextTask = (task && typeof task === 'object') ? task : null;
        const patch = (movePatch && typeof movePatch === 'object') ? movePatch : {};
        if (!nextTask) return false;
        const targetDocId = String(patch.targetDocId || '').trim();
        if (!targetDocId) return false;
        const docName = state.allDocuments.find((item) => String(item?.id || '').trim() === targetDocId)?.name
            || String(patch.targetDocName || '').trim()
            || nextTask.docName
            || nextTask.doc_name
            || '';
        nextTask.root_id = targetDocId;
        nextTask.docId = targetDocId;
        if (docName) {
            nextTask.doc_name = docName;
            nextTask.docName = docName;
        }
        const rawMode = String(patch.mode || '').trim();
        const mode = String(globalThis.__tmTaskStore?.normalizeMoveMode?.(rawMode) || (rawMode === 'doc' ? 'docTop' : rawMode)).trim();
        if (mode === 'heading') {
            const headingId = String(patch.headingId || patch.targetHeadingId || '').trim();
            nextTask.h2Id = headingId;
            nextTask.h2 = String(patch.targetHeading || nextTask.h2 || '').trim();
            if (Number.isFinite(Number(patch.targetHeadingRank))) nextTask.h2Rank = Number(patch.targetHeadingRank);
            return true;
        }
        if (mode === 'docTop' || mode === 'docBottom') {
            nextTask.h2Id = '';
            nextTask.h2 = '';
            nextTask.h2Rank = Number.NaN;
            nextTask.parentTaskId = '';
            nextTask.parent_task_id = '';
            return true;
        }
        const targetParentTaskId = String(patch.targetParentTaskId || '').trim();
        if (mode === 'before' || mode === 'after') {
            nextTask.parentTaskId = targetParentTaskId;
            nextTask.parent_task_id = targetParentTaskId;
        } else if (mode === 'child' || mode === 'child-top') {
            const targetTaskId = String(patch.targetTaskId || '').trim();
            if (targetTaskId) {
                nextTask.parentTaskId = targetTaskId;
                nextTask.parent_task_id = targetTaskId;
            }
        }
        return true;
    }

    function __tmApplyMoveOptimisticLocal(payload = {}) {
        const snap = payload?.snapshot;
        const task = snap?.task;
        const taskId = String(task?.id || payload?.taskId || '').trim();
        const targetDocId = String(payload?.targetDocId || '').trim();
        if (!task || !taskId || !targetDocId) return false;
        const taskAliases = new Set([taskId, task?.id, payload?.taskId, __tmResolveOptimisticTaskId(taskId)]
            .map((id) => String(id || '').trim())
            .filter(Boolean));
        try {
            const aliases = globalThis.__tmRuntimeState?.getTaskIdAliases?.(taskId);
            (Array.isArray(aliases) ? aliases : []).forEach((id) => {
                const aliasId = String(id || '').trim();
                if (aliasId) taskAliases.add(aliasId);
            });
        } catch (e) {}
        let preservePending = false;
        try {
            preservePending = Array.from(taskAliases).some((id) => !!state.pendingInsertedTasks?.[id]);
        } catch (e) {}
        __tmRemoveTaskFromLocalState(taskId, { recalc: false, filter: false });
        const nextTask = JSON.parse(JSON.stringify(task));
        __tmApplyMovePayloadToTaskRecursive(nextTask, payload, true);
        const rawMode = String(payload?.mode || '').trim();
        const mode = String(globalThis.__tmTaskStore?.normalizeMoveMode?.(rawMode) || (rawMode === 'doc' ? 'docTop' : rawMode)).trim();
        let inserted = false;
        if (mode === 'heading') {
            __tmInsertTaskIntoDocLocal(nextTask, { atTop: false });
            inserted = true;
        } else if (mode === 'before') {
            inserted = __tmInsertTaskBeforeLocal(nextTask, payload?.targetTaskId);
        } else if (mode === 'after') {
            inserted = __tmInsertTaskAfterLocal(nextTask, payload?.targetTaskId);
        } else if (mode === 'child-top') {
            inserted = __tmInsertTaskAsChildLocal(nextTask, payload?.targetTaskId, {
                atTop: true,
                preservePending,
            });
        } else if (mode === 'child') {
            inserted = __tmInsertTaskAsChildLocal(nextTask, payload?.targetTaskId, {
                atTop: String(payload?.targetLastDirectChildId || '').trim() ? false : true,
                preservePending,
            });
        }
        if (!inserted) {
            if (mode === 'heading') {
                __tmInsertTaskIntoDocLocal(nextTask, { atTop: false });
            } else if (mode === 'docBottom') {
                __tmInsertTaskIntoDocLocal(nextTask, { atTop: false });
            } else {
                __tmInsertTaskIntoDocLocal(nextTask, { atTop: true });
            }
        }
        try {
            const affectedDocIds = new Set([
                String(snap?.docId || '').trim(),
                String(targetDocId || '').trim(),
            ].filter(Boolean));
            affectedDocIds.forEach((docId) => {
                try { __tmRebuildLocalDocTree(docId); } catch (e) {}
            });
        } catch (e) {}
        let projectedFilterState = false;
        if (payload.skipOptimisticFilterWork !== true) {
            try { recalcStats(); } catch (e) {}
            try { applyFilters(); } catch (e) {}
        } else {
            try { projectedFilterState = __tmApplyMoveOptimisticFilteredProjection(nextTask, payload) === true; } catch (e) {}
        }
        if (payload.mutationDriven !== true) {
            try {
                __tmScheduleTaskSnapshotAfterLocalStructurePatch?.({
                    docIds: state.__tmLoadedDocIdsForTasks,
                    groupId: SettingsStore?.data?.currentGroupId || 'all',
                    activeDocId: state?.activeDocId || 'all',
                    queryLimit: __TM_TASK_INDEX_QUERY_LIMIT,
                    source: 'move-task-optimistic',
                    delayMs: 360,
                    idleDelayMs: 120,
                    protectMs: 30000,
                });
            } catch (e) {}
        }
        if (mode === 'child' || mode === 'child-top') {
            try { __tmScheduleChecklistOptimisticSubtaskRefresh(payload?.targetTaskId, taskId); } catch (e) {}
            try {
                const previousParentId = String(snap?.parentTaskId || '').trim();
                if (previousParentId) __tmScheduleChecklistOptimisticSubtaskRefresh(previousParentId, taskId);
            } catch (e) {}
        }
        if (payload.deferOptimisticRender !== true) {
            try { __tmScheduleRender({ withFilters: payload.skipOptimisticFilterWork !== true && !projectedFilterState }); } catch (e) {}
        }
        return true;
    }

    function __tmRollbackMoveOptimisticLocal(snapshot, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const snap = (snapshot && typeof snapshot === 'object') ? snapshot : null;
        const tid = String(snap?.taskId || snap?.task?.id || '').trim();
        if (!tid) return false;
        __tmRemoveTaskFromLocalState(tid, { recalc: false, filter: false });
        const rolledBack = __tmRollbackDeleteOptimisticLocal(snapshot, { mutationDriven: opts.mutationDriven === true });
        if (opts.mutationDriven !== true) {
            try {
                __tmScheduleTaskSnapshotAfterLocalStructurePatch?.({
                    docIds: state.__tmLoadedDocIdsForTasks,
                    groupId: SettingsStore?.data?.currentGroupId || 'all',
                    activeDocId: state?.activeDocId || 'all',
                    queryLimit: __TM_TASK_INDEX_QUERY_LIMIT,
                    source: 'move-task-rollback',
                    delayMs: 360,
                    idleDelayMs: 120,
                    protectMs: 30000,
                });
            } catch (e) {}
        }
        return rolledBack;
    }

    async function __tmCreateTaskInDocKernel({ docId, content, priority, startDate, completionTime, pinned, customStatus, atTop, appendToBottom, insertBeforeId, insertAfterId, targetHeadingId = '', targetHeading = '', targetHeadingRank, h2Id = '', h2 = '', h2Rank, localInsert = true, scheduleSnapshotRefresh = true, backgroundCreateAttrs = false, deferCreateAttrs = false, deferResolveInsertedTaskId = false, onInserted = null, onBlockInserted = null } = {}) {
        const parentDocId = String(docId || '').trim();
        const text = String(content || '').trim();
        if (!parentDocId) throw new Error('未设置文档');
        if (!text) throw new Error('请输入任务内容');
        const statusOptions = __tmGetStatusOptions(SettingsStore.data.customStatusOptions || []);
        const requestedStatusId = String(customStatus || '').trim();
        const requestedStatusOption = requestedStatusId ? __tmFindStatusOptionById(requestedStatusId, statusOptions) : null;
        const initialMarker = requestedStatusOption
            ? __tmNormalizeTaskStatusMarker(requestedStatusOption.marker, __tmGuessStatusOptionDefaultMarker(requestedStatusOption))
            : ' ';
        const md = `- [${initialMarker}] ${text}`;

        let nextID = String(insertBeforeId || '').trim();
        const previousID = String(insertAfterId || '').trim();
        if (!nextID && atTop) {
            try { nextID = String(await API.getFirstDirectChildIdOfDoc(parentDocId) || '').trim(); } catch (e) { nextID = ''; }
        }
        try { __tmMarkLocalCreateTxSuppressionIds([parentDocId, nextID, previousID].filter(Boolean), [parentDocId], 2600); } catch (e) {}
        const placement = nextID || (previousID ? { previousID, parentID: parentDocId } : undefined);
        const insertedId = appendToBottom && !atTop && !nextID && !previousID
            ? await __tmAppendBlockWithRetry(parentDocId, md)
            : await __tmInsertBlockWithRetry(parentDocId, md, placement);
        try {
            if (typeof onBlockInserted === 'function') {
                await Promise.resolve(onBlockInserted({ insertedId, docId: parentDocId, insertBeforeId: nextID || '', insertAfterId: previousID || '' }));
            }
        } catch (e) {}
        // 某些端会返回外层列表块 ID；outbox 场景会把真实任务 ID 解析交给后台短探测，避免卡住 UI。
        let taskId = insertedId;
        if (deferResolveInsertedTaskId !== true) {
            taskId = await __tmResolveInsertedTaskBlockId(insertedId);
        }
        try { __tmMarkLocalCreateTxSuppressionIds([parentDocId, insertedId, taskId, nextID, previousID].filter(Boolean), [parentDocId], 2600); } catch (e) {}
        try {
            if (deferResolveInsertedTaskId !== true && typeof onInserted === 'function') {
                await Promise.resolve(onInserted({ taskId, insertedId, docId: parentDocId }));
            }
        } catch (e) {}

        const patch = {};
        const pin = pinned !== undefined ? !!pinned : !!SettingsStore.data.pinNewTasksByDefault;
        if (pin) patch.pinned = true;
        const pr0 = String(priority ?? '').trim();
        const prMap = {
            '高': 'high',
            '中': 'medium',
            '低': 'low',
            '无': '',
            'none': '',
        };
        const pr = prMap.hasOwnProperty(pr0) ? prMap[pr0] : pr0;
        if (pr === 'high' || pr === 'medium' || pr === 'low') patch.priority = pr;
        const sd = String(startDate || '').trim();
        if (sd) patch.startDate = sd;
        const ct = String(completionTime || '').trim();
        if (ct) patch.completionTime = ct;
        const st0 = String(customStatus || '').trim();
        if (st0) {
            const ok = statusOptions.some(o => String(o?.id || '').trim() === st0);
            if (ok) patch.customStatus = st0;
        }
        const headingPatch = {
            h2: __tmNormalizeHeadingText(targetHeading || h2 || ''),
            h2Id: String(targetHeadingId || h2Id || '').trim(),
            h2Rank: Number.isFinite(Number(targetHeadingRank)) ? Number(targetHeadingRank) : (Number.isFinite(Number(h2Rank)) ? Number(h2Rank) : Number.NaN),
            h2Path: '',
            h2Sort: Number.NaN,
            h2Created: '',
        };
        if (Object.keys(patch).length > 0 && deferCreateAttrs !== true) {
            taskId = await __tmPersistNewTaskAttrsWithRetry(taskId, patch, async () => await __tmResolveInsertedTaskBlockId(insertedId), {
                background: true,
                docId: parentDocId,
                source: 'create-task-attrs',
                skipFlush: true,
                mirrorTaskAttrs: false,
                ...(backgroundCreateAttrs === true ? { skipInteractionGate: true } : {}),
            });
        }
        try { __tmInvalidateTasksQueryCacheByDocId(parentDocId); } catch (e) {}

        const docName = state.allDocuments.find(d => d.id === parentDocId)?.name || '未知文档';
        const newTask = {
            id: taskId,
            done: __tmIsTaskMarkerDone(initialMarker),
            pinned: !!pin,
            content: text,
            markdown: md,
            priority: patch.priority || '',
            duration: '',
            remark: '',
            startDate: patch.startDate || '',
            start_date: patch.startDate || '',
            completionTime: patch.completionTime || '',
            customTime: '',
            customStatus: patch.customStatus || '',
            taskMarker: initialMarker,
            task_marker: initialMarker,
            docName,
            root_id: parentDocId,
            docId: parentDocId,
            parent_id: '',
            parentTaskId: '',
            parent_task_id: '',
            ...headingPatch,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            children: [],
            level: 0,
        };
        try { normalizeTaskFields(newTask, docName); } catch (e) {}
        if (localInsert !== false) try {
            const existingFlat = globalThis.__tmTaskStore?.getFlat?.(taskId) || null;
            const existingPending = globalThis.__tmTaskStore?.getPending?.(taskId) || null;
            const pendingTask = {
                ...newTask,
                ...(existingFlat || {}),
                ...(existingPending || {}),
                id: taskId,
                expiresAt: Date.now() + __TM_PENDING_INSERTED_TASK_KEEPALIVE_MS,
            };
                globalThis.__tmTaskStore?.upsertLocal?.(pendingTask, {
                    pending: true,
                    expiresAt: pendingTask.expiresAt,
                    status: 'create-task-in-doc-local',
                });
        } catch (e) {}

        if (localInsert !== false) {
            __tmUpsertLocalTask(newTask);
            try { recalcStats(); } catch (e) {}
            try { applyFilters(); } catch (e) {}
            if (state.modal) render();
        }
        if (scheduleSnapshotRefresh !== false) {
            try {
                __tmScheduleCreatedTaskSnapshotRefresh(taskId, {
                    docId: parentDocId,
                    taskId,
                    source: 'create-task-in-doc',
                });
            } catch (e) {}
        }
        return taskId;
    }

    function __tmBuildHeadingGroupCreateBtnHtml(docId, headingId, title = '新建任务') {
        const did = String(docId || '').trim();
        if (!did) return '';
        const hid = String(headingId || '').trim();
        return `
            <span class="tm-group-actions" onclick="event.stopPropagation()">
                <button class="tm-group-create-btn"
                        type="button"
                        title="${esc(title)}"
                        aria-label="${esc(title)}"
                        onpointerdown="event.stopPropagation()"
                        onclick="tmCreateTaskForHeadingGroup('${escSq(did)}','${escSq(hid)}', event)">
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M8 3.25v9.5M3.25 8h9.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                </button>
            </span>
        `;
    }

    function __tmBuildDocGroupQuickAddBtnHtml(docId, title = '新建任务') {
        const did = String(docId || '').trim();
        if (!did || did === '__unknown__') return '';
        return `
            <span class="tm-group-actions" onclick="event.stopPropagation()">
                <button class="tm-group-create-btn"
                        type="button"
                        title="${esc(title)}"
                        aria-label="${esc(title)}"
                        onpointerdown="event.stopPropagation()"
                        onclick="event.preventDefault();event.stopPropagation();tmQuickAddOpenForDoc('${escSq(did)}');">
                    ${__tmRenderLucideIcon('plus')}
                </button>
            </span>
        `;
    }

    window.tmCreateTaskForHeadingGroup = async function(docId, headingId, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}

        const did = String(docId || '').trim();
        const hid = String(headingId || '').trim();
        if (!did) {
            hint('❌ 未找到文档', 'error');
            return;
        }
        const text = await showPrompt('新建任务', '每行一个任务；回车换行，Ctrl + 回车提交', '', {
            multiline: true,
            rows: 4,
            minHeight: 96,
        });
        if (text == null) return;
        const taskLines = __tmSplitTaskInputLines(text);
        if (taskLines.length === 0) {
            hint('⚠ 请输入任务内容', 'warning');
            return;
        }
        try {
            const useSectionEnd = !!SettingsStore.data.headingGroupCreateAtSectionEnd;
            const createdTaskIds = [];
            const createTaskInDoc = globalThis.__tmRequireTaskOutbox?.('createTaskInDoc');
            if (typeof createTaskInDoc !== 'function') throw new Error('任务写入队列未就绪: createTaskInDoc');
            if (hid && hid !== '__none__') {
                const placement = await __tmResolveHeadingGroupInsertPlacement(did, hid, SettingsStore.data.taskHeadingLevel || 'h2');
                if (placement.matched) {
                    const headingPatch = __tmBuildHeadingPatchFromPlacement(placement);
                    const insertBeforeId = useSectionEnd ? String(placement.nextID || '').trim() : '';
                    const insertAfterId = useSectionEnd ? '' : String(placement.insertAfterID || hid || '').trim();
                    const appendToBottom = useSectionEnd && placement.appendToBottom === true;
                    const orderedLines = insertAfterId ? taskLines.slice().reverse() : taskLines;
                    await Promise.all(orderedLines.map((line) => createTaskInDoc({
                            docId: did,
                            content: line,
                            insertBeforeId,
                            insertAfterId,
                            appendToBottom,
                            targetHeadingId: headingPatch?.h2Id || '',
                            targetHeading: headingPatch?.h2 || '',
                            targetHeadingRank: Number(headingPatch?.h2Rank),
                            pinned: false,
                            wait: false,
                            skipOptimisticMainRefresh: true,
                            skipOptimisticFilterWork: true,
                            onError: (err) => {
                                hint(`❌ 新建任务失败: ${err?.message || err || '未知错误'}`, 'error');
                            },
                        }).then((taskId) => {
                        createdTaskIds.push(taskId);
                        if (headingPatch) __tmApplyHeadingPatchToTaskLocal(taskId, headingPatch, 'heading-create-task-local');
                        })));
                }
            }
            if (createdTaskIds.length === 0) {
                await Promise.all(taskLines.slice().reverse().map((line) => createTaskInDoc({
                        docId: did,
                        content: line,
                        atTop: true,
                        pinned: false,
                        wait: false,
                        skipOptimisticMainRefresh: true,
                        skipOptimisticFilterWork: true,
                        onError: (err) => {
                            hint(`❌ 新建任务失败: ${err?.message || err || '未知错误'}`, 'error');
                        },
                    }).then((taskId) => {
                    createdTaskIds.push(taskId);
                    if (!hid || hid === '__none__') {
                        const task = state.pendingInsertedTasks?.[String(taskId || '').trim()];
                        if (task) {
                            task.h2 = '';
                            task.h2Id = '';
                            globalThis.__tmTaskStore?.patchPending?.(taskId, { h2: '', h2Id: '' }, { source: 'heading-create-clear-pending-heading' });
                        }
                    }
                    })));
            }
            createdTaskIds.forEach((taskId) => {
                const pendingTask = state.pendingInsertedTasks?.[String(taskId || '').trim()];
                if (pendingTask) __tmUpsertLocalTask(pendingTask);
            });
            try {
                __tmScheduleViewRefresh({
                    mode: 'current',
                    withFilters: false,
                    reason: 'heading-create-task-optimistic',
                    taskIds: createdTaskIds,
                });
            } catch (e) {
                try { __tmScheduleRender({ withFilters: false, reason: 'heading-create-task-optimistic' }); } catch (e2) {}
            }
            hint(taskLines.length > 1 ? `✅ 已创建 ${taskLines.length} 个任务` : '✅ 任务已创建', 'success');
        } catch (e) {
            hint(`❌ 新建任务失败: ${e.message}`, 'error');
        }
    };

    function __tmShouldRetryBlockMutationError(error) {
        const msg = String(error?.message || error || '').toLowerCase();
        return msg.includes('tree not found')
            || msg.includes('invalid id argument')
            || msg.includes('invalid id')
            || msg.includes('id argument')
            || msg.includes('not found')
            || msg.includes('找不到');
    }

    async function __tmAppendBlockWithRetry(parentId, md, options = {}) {
        const targetParentId = String(parentId || '').trim();
        const markdown = String(md || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        if (!targetParentId) throw new Error('未找到目标块');
        if (!markdown) throw new Error('内容为空');
        let lastErr = null;
        const retryDelays = Array.isArray(opts.retryDelays) && opts.retryDelays.length
            ? opts.retryDelays
            : [120, 300, 520, 860, 1280];
        for (let i = 0; i <= retryDelays.length; i += 1) {
            try {
                return await __tmBackendAdapter.appendBlock(targetParentId, markdown);
            } catch (e) {
                lastErr = e;
                const retryable = __tmShouldRetryBlockMutationError(e);
                if (!retryable || i >= retryDelays.length) break;
                try { await __tmBackendAdapter.flushTransaction(); } catch (e2) {}
                await new Promise((resolve) => setTimeout(resolve, retryDelays[i]));
            }
        }
        throw lastErr || new Error('追加块失败');
    }

    async function __tmInsertBlockWithRetry(parentId, md, placement, options = {}) {
        const targetParentId = String(parentId || '').trim();
        const markdown = String(md || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        if (!targetParentId) throw new Error('未找到目标块');
        if (!markdown) throw new Error('内容为空');
        let lastErr = null;
        const retryDelays = Array.isArray(opts.retryDelays) && opts.retryDelays.length
            ? opts.retryDelays
            : [120, 300, 520, 860, 1280];
        for (let i = 0; i <= retryDelays.length; i += 1) {
            try {
                return await __tmBackendAdapter.insertBlock(targetParentId, markdown, placement);
            } catch (e) {
                lastErr = e;
                const retryable = __tmShouldRetryBlockMutationError(e);
                if (!retryable || i >= retryDelays.length) break;
                try { await __tmBackendAdapter.flushTransaction(); } catch (e2) {}
                await new Promise((resolve) => setTimeout(resolve, retryDelays[i]));
            }
        }
        throw lastErr || new Error('插入块失败');
    }

    async function __tmCreateSubtaskForTaskKernel(parentTaskId, content, options = {}) {
        const parentInfo = __tmResolveOptimisticTaskForLocalUse(parentTaskId);
        const pid = String(parentInfo.id || parentInfo.resolvedId || parentInfo.rawId || '').trim();
        const parentTask = parentInfo.task;
        if (!pid || !parentTask) throw new Error('未找到父任务');
        const text = String(content || '').trim();
        if (!text) throw new Error('请输入子任务内容');
        const opts = (options && typeof options === 'object') ? options : {};
        const inheritedPatch = Object.prototype.hasOwnProperty.call(opts, 'inheritedPatch')
            ? __tmNormalizeSubtaskInheritedPatch(opts.inheritedPatch)
            : __tmBuildSubtaskInheritedPatch(parentTask);

        const parentDocId = String(parentTask.docId || parentTask.root_id || '').trim();
        try { __tmMarkLocalCreateTxSuppressionIds([pid], [parentDocId].filter(Boolean), 2600); } catch (e) {}
        const insertedId = await __tmAppendBlockWithRetry(pid, `- [ ] ${text}`);
        try {
            if (typeof opts.onBlockInserted === 'function') {
                await Promise.resolve(opts.onBlockInserted({ insertedId, docId: parentDocId, parentTaskId: pid }));
            }
        } catch (e) {}
        let taskId = insertedId;
        if (opts.deferResolveInsertedTaskId !== true) {
            taskId = await __tmResolveInsertedTaskBlockId(insertedId);
        }
        try { __tmMarkLocalCreateTxSuppressionIds([pid, insertedId, taskId].filter(Boolean), [parentDocId].filter(Boolean), 2600); } catch (e) {}
        try {
            if (opts.deferResolveInsertedTaskId !== true && typeof opts.onInserted === 'function') {
                await Promise.resolve(opts.onInserted({ taskId, insertedId, docId: parentDocId, parentTaskId: pid }));
            }
        } catch (e) {}
        const attrPatch = (inheritedPatch && typeof inheritedPatch === 'object') ? { ...inheritedPatch } : {};
        if (Object.keys(attrPatch).length > 0 && opts.deferInheritedAttrs !== true) {
            const persistOptions = opts.backgroundAttrs === true
                ? {
                    background: true,
                    wait: false,
                    docId: parentDocId,
                    source: 'create-subtask-attrs',
                    skipInteractionGate: true,
                    mirrorTaskAttrs: false,
                }
                : {};
            const patchTask = globalThis.__tmRequireTaskOutbox?.('patchTask');
            if (typeof patchTask !== 'function') throw new Error('任务写入队列未就绪: patchTask');
            const persistPromise = patchTask(taskId, attrPatch, {
                ...persistOptions,
                source: 'create-subtask-attrs',
                label: '子任务属性',
                wait: opts.backgroundAttrs === true ? false : true,
            });
            if (opts.backgroundAttrs === true) {
                try { Promise.resolve(persistPromise).catch(() => null); } catch (e) {}
            } else {
                try { await persistPromise; } catch (e) {}
            }
        }
        try {
            if (parentDocId) __tmInvalidateTasksQueryCacheByDocId(parentDocId);
        } catch (e) {}
        if (opts.scheduleSnapshotRefresh !== false) {
            try {
                __tmScheduleCreatedTaskSnapshotRefresh(taskId, {
                    docId: parentDocId,
                    parentTaskId: pid,
                    taskId,
                    source: 'create-subtask-direct',
                    refreshCurrentView: opts.refreshCurrentView !== false,
                    skipSnapshotViewStateFilterRefresh: opts.skipSnapshotViewStateFilterRefresh === true,
                });
            } catch (e) {}
        }
        return taskId;
    }

    async function __tmResolveTaskListBlockId(taskId) {
        const tid = String(taskId || '').trim();
        if (!tid) return '';
        const resolveAlias = (id) => {
            const raw = String(id || '').trim();
            if (!raw) return '';
            try {
                if (typeof __tmResolveOptimisticTaskId === 'function') {
                    const resolved = String(__tmResolveOptimisticTaskId(raw) || raw).trim();
                    if (resolved) return resolved;
                }
            } catch (e) {}
            return raw;
        };
        const resolvedTid = resolveAlias(tid);
        try {
            const rows = await API.getBlocksByIds([resolvedTid]);
            const row = Array.isArray(rows) ? rows[0] : null;
            const parentId = String(row?.parent_id || '').trim();
            if (parentId) return parentId;
        } catch (e) {}
        const cachedListId = String(
            globalThis.__tmRuntimeState?.getFlatTaskById?.(resolvedTid)?.parent_id
            || state.flatTasks?.[resolvedTid]?.parent_id
            || globalThis.__tmRuntimeState?.getTaskById?.(tid, { includePending: true, preferPending: true })?.parent_id
            || ''
        ).trim();
        if (cachedListId) {
            try {
                const rows = await API.getBlocksByIds([cachedListId]);
                const row = Array.isArray(rows) ? rows[0] : null;
                if (String(row?.id || '').trim() === cachedListId && String(row?.type || '').trim() === 'l') {
                    return cachedListId;
                }
            } catch (e) {}
        }
        return '';
    }

    async function __tmCreateSiblingTaskForTaskKernel(taskId, content, options = {}) {
        const sourceInfo = __tmResolveOptimisticTaskForLocalUse(taskId);
        const sourceTaskId = String(sourceInfo.id || sourceInfo.resolvedId || sourceInfo.rawId || taskId || '').trim();
        const currentTask = sourceInfo.task
            || globalThis.__tmRuntimeState?.getTaskById?.(sourceTaskId, { includePending: true, preferPending: true })
            || state.flatTasks?.[sourceTaskId]
            || state.pendingInsertedTasks?.[sourceTaskId]
            || null;
        if (!sourceTaskId || !currentTask) throw new Error('未找到当前任务');
        const text = String(content || '').trim();
        if (!text) throw new Error('请输入任务内容');
        const opts = (options && typeof options === 'object') ? options : {};

        const listId = await __tmResolveTaskListBlockId(sourceTaskId);
        if (!listId) throw new Error('未找到当前任务所在的任务列表');

        const currentDocId = String(currentTask.docId || currentTask.root_id || '').trim();
        try { __tmMarkLocalCreateTxSuppressionIds([sourceTaskId, listId], [currentDocId].filter(Boolean), 2600); } catch (e) {}
        const insertedId = await __tmInsertBlockWithRetry(listId, `- [ ] ${text}`, { previousID: sourceTaskId });
        try {
            if (typeof opts.onBlockInserted === 'function') {
                await Promise.resolve(opts.onBlockInserted({ insertedId, docId: currentDocId, sourceTaskId, listId }));
            }
        } catch (e) {}
        let nextTaskId = insertedId;
        if (opts.deferResolveInsertedTaskId !== true) {
            nextTaskId = await __tmResolveInsertedTaskBlockId(insertedId);
        }
        try { __tmMarkLocalCreateTxSuppressionIds([sourceTaskId, listId, insertedId, nextTaskId].filter(Boolean), [currentDocId].filter(Boolean), 2600); } catch (e) {}
        try {
            if (opts.deferResolveInsertedTaskId !== true && typeof opts.onInserted === 'function') {
                await Promise.resolve(opts.onInserted({ taskId: nextTaskId, insertedId, docId: currentDocId, sourceTaskId }));
            }
        } catch (e) {}
        try {
            if (currentDocId) __tmInvalidateTasksQueryCacheByDocId(currentDocId);
        } catch (e) {}
        if (opts.scheduleSnapshotRefresh !== false) {
            try {
                __tmScheduleCreatedTaskSnapshotRefresh(nextTaskId, {
                    docId: currentDocId,
                    sourceTaskId,
                    taskId: nextTaskId,
                    source: 'create-sibling-direct',
                });
            } catch (e) {}
        }
        return nextTaskId;
    }

    async function __tmCreateTaskInDoc(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (opts.directKernel === true) return await __tmCreateTaskInDocKernel(opts);
        return await __tmQueueCreateTaskInDoc(opts);
    }

    async function __tmCreateSubtaskForTask(parentTaskId, content, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (opts.directKernel === true) return await __tmCreateSubtaskForTaskKernel(parentTaskId, content, opts);
        return await __tmQueueCreateSubtask(parentTaskId, content, opts);
    }

    async function __tmCreateSiblingTaskForTask(taskId, content, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (opts.directKernel === true) return await __tmCreateSiblingTaskForTaskKernel(taskId, content, opts);
        return await __tmQueueCreateSiblingTask(taskId, content, opts);
    }

    function __tmQueueCreateSubtask(parentTaskId, content, options = {}) {
        const rawPid = String(parentTaskId || '').trim();
        const parentInfo = __tmResolveOptimisticTaskForLocalUse(rawPid);
        const pid = String(parentInfo.id || parentInfo.resolvedId || rawPid).trim();
        const text = String(content || '').trim();
        if (!rawPid || !pid) throw new Error('未找到父任务');
        if (!text) throw new Error('请输入子任务内容');
        if (typeof __tmIsOutboxTaskPendingDeleted === 'function' && (__tmIsOutboxTaskPendingDeleted(rawPid) || __tmIsOutboxTaskPendingDeleted(pid))) {
            throw new Error('父任务正在删除，无法新建子任务');
        }
        const hooks = (options && typeof options === 'object') ? options : {};
        const tempId = __tmGenerateTempTaskId('subtask');
        const clientId = String(globalThis.__tmTaskIdentity?.createClientId?.('subtask') || __tmGenerateTempTaskId('client')).trim();
        try {
            globalThis.__tmTaskIdentity?.remember?.({
                clientId,
                tempId,
                kind: 'subtask',
                status: 'queued',
            });
        } catch (e) {}
        const task = parentInfo.task;
        const docId = String(task?.docId || task?.root_id || '').trim();
        const inheritedPatch = __tmBuildSubtaskInheritedPatch(task);
        const shouldWait = hooks.wait !== false;
        let pendingPromise = null;
        const opPromise = __tmEnqueueQueuedOp({
            type: 'createSubtask',
            docId,
            laneKey: docId ? `doc:${docId}` : `task:${pid}`,
            data: {
                parentTaskId: pid,
                clientId,
                tempId,
                content: text,
                docId,
                inheritedPatch,
                skipInteractionGate: hooks.skipInteractionGate !== false,
                skipOptimisticMainRefresh: hooks.skipOptimisticMainRefresh === true,
                skipOptimisticFilterWork: hooks.skipOptimisticFilterWork !== false,
                skipSettledRefresh: hooks.skipSettledRefresh === true,
                refreshCurrentView: hooks.refreshCurrentView !== false,
                scheduleSnapshotRefresh: hooks.scheduleSnapshotRefresh === false ? false : true,
                refreshPolicy: (hooks.refreshPolicy && typeof hooks.refreshPolicy === 'object')
                    ? hooks.refreshPolicy
                    : undefined,
                skipSnapshotViewStateFilterRefresh: hooks.skipSnapshotViewStateFilterRefresh === true
                    || hooks.skipOptimisticFilterWork !== false,
            },
        }, {
            wait: shouldWait,
            onPending: (promise) => {
                pendingPromise = promise;
            },
        });
        try { hooks.onQueued?.(tempId, { clientId }); } catch (e) {}
        const settlePromise = pendingPromise || opPromise;
        settlePromise.then((result) => {
            try { state.collapsedTaskIds?.delete?.(pid); } catch (e) {}
            try { if (rawPid !== pid) state.collapsedTaskIds?.delete?.(rawPid); } catch (e) {}
            const realId = String(result?.realId || tempId).trim() || tempId;
            try { globalThis.__tmTaskIdentity?.commit?.({ clientId, tempId, blockId: realId }); } catch (e) {}
            try {
                hooks.onSuccess?.(realId, {
                    clientId,
                    tempId,
                    parentTaskId: pid,
                    rawParentTaskId: rawPid,
                    result,
                });
            } catch (e) {}
            if (hooks.silent !== true) hint('✅ 已新增', 'success');
        }).catch((e) => {
            try { hooks.onError?.(e); } catch (e2) {}
            if (hooks.silent !== true) hint(`❌ 新建子任务失败: ${e.message}`, 'error');
        }).finally(() => {
            try { hooks.onFinally?.(); } catch (e) {}
        });
        return shouldWait
            ? opPromise.then((result) => String(result?.realId || tempId).trim() || tempId)
            : Promise.resolve(tempId);
    }

    function __tmApplyOptimisticSubtask(parentTaskId, subtaskId, content, inheritedPatchInput = null, options = {}) {
        const rawPid = String(parentTaskId || '').trim();
        const parentInfo = __tmResolveOptimisticTaskForLocalUse(rawPid);
        const pid = String(parentInfo.id || parentInfo.resolvedId || rawPid).trim();
        const tid = String(subtaskId || '').trim();
        const text = String(content || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        const clientId = String(opts.clientId || '').trim();
        const parentTask = parentInfo.task;
        if (!rawPid || !pid || !tid || !text || !parentTask) {
            return false;
        }
        if (typeof __tmIsOutboxTaskPendingDeleted === 'function' && (__tmIsOutboxTaskPendingDeleted(rawPid) || __tmIsOutboxTaskPendingDeleted(pid))) {
            return false;
        }
        try {
            globalThis.__tmTaskIdentity?.remember?.({
                clientId,
                tempId: tid,
                kind: 'subtask',
                status: 'optimistic',
            });
        } catch (e) {}
        const inheritedPatch = inheritedPatchInput && typeof inheritedPatchInput === 'object'
            ? __tmNormalizeSubtaskInheritedPatch(inheritedPatchInput)
            : __tmBuildSubtaskInheritedPatch(parentTask);

        const nextTask = {
            id: tid,
            clientId,
            __tmClientId: clientId,
            done: false,
            pinned: inheritedPatch.pinned === true,
            content: text,
            markdown: `- [ ] ${text}`,
            priority: inheritedPatch.priority || '',
            custom_priority: inheritedPatch.priority || '',
            duration: inheritedPatch.duration || '',
            custom_duration: inheritedPatch.duration || '',
            remark: inheritedPatch.remark || '',
            custom_remark: inheritedPatch.remark || '',
            startDate: inheritedPatch.startDate || '',
            start_date: inheritedPatch.startDate || '',
            completionTime: inheritedPatch.completionTime || '',
            completion_time: inheritedPatch.completionTime || '',
            customTime: '',
            customStatus: inheritedPatch.customStatus || '',
            custom_status: inheritedPatch.customStatus || '',
            customFieldValues: (inheritedPatch.customFieldValues && typeof inheritedPatch.customFieldValues === 'object')
                ? { ...inheritedPatch.customFieldValues }
                : {},
            docName: parentTask.docName || '',
            root_id: parentTask.root_id || parentTask.docId || '',
            docId: parentTask.docId || parentTask.root_id || '',
            parentTaskId: pid,
            parent_task_id: pid,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            children: [],
            level: Math.max(0, Number(parentTask.level) || 0) + 1,
            h2: parentTask.h2 || '',
            h2Id: parentTask.h2Id || '',
        };
        try { normalizeTaskFields(nextTask, nextTask.docName || '未知文档'); } catch (e) {}

        try { __tmAttachOptimisticChildToParentCandidates(parentTask, rawPid || pid, nextTask); } catch (e) {}
        try { __tmAttachOptimisticChildToParentCandidates(parentTask, pid, nextTask); } catch (e) {}
        try { state.collapsedTaskIds?.delete?.(pid); } catch (e) {}
        try { if (rawPid !== pid) state.collapsedTaskIds?.delete?.(rawPid); } catch (e) {}
        try { __tmKanbanGetCollapsedSet?.()?.delete?.(pid); } catch (e) {}
        try { if (rawPid !== pid) __tmKanbanGetCollapsedSet?.()?.delete?.(rawPid); } catch (e) {}
        let insertedPending = false;
        try {
            insertedPending = !!globalThis.__tmTaskStore?.createPendingTask?.(nextTask, {
                clientId,
                tempId: tid,
                kind: 'subtask',
                status: 'optimistic',
                expiresAt: Date.now() + __TM_PENDING_INSERTED_TASK_KEEPALIVE_MS,
            });
        } catch (e) {}
        if (!insertedPending) return null;
        let projected = false;
        if (opts.skipFilterWork !== true) {
            try { recalcStats(); } catch (e) {}
            try { applyFilters(); } catch (e) {}
        } else {
            try { projected = __tmEnsureOptimisticSubtaskInFilteredTasks(parentTask, nextTask) === true; } catch (e) {}
            if (!projected && opts.skipFilterFallback !== true) {
                try {
                    __tmScheduleViewRefresh({
                        mode: 'current',
                        withFilters: true,
                        reason: 'create-subtask-optimistic-filter-fallback',
                        taskIds: [pid, tid].filter(Boolean),
                    });
                } catch (e) {}
            }
        }
        try { __tmKanbanColsHtmlCache = null; } catch (e) {}
        if (opts.skipMainRefresh !== true) {
            __tmRefreshAfterOptimisticTaskCreate(tid, 'create-subtask-optimistic');
        } else {
            __tmScheduleChecklistOptimisticSubtaskRefresh(pid, tid);
        }
        return nextTask;
    }

    function __tmApplyOptimisticSiblingTask(sourceTaskId, siblingTaskId, content, options = {}) {
        const sid = String(sourceTaskId || '').trim();
        const tid = String(siblingTaskId || '').trim();
        const text = String(content || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        const clientId = String(opts.clientId || '').trim();
        const sourceTask = globalThis.__tmRuntimeState?.getTaskById?.(sid, { includePending: true, preferPending: true })
            || state.flatTasks?.[sid]
            || state.pendingInsertedTasks?.[sid]
            || null;
        if (!sid || !tid || !text || !sourceTask) return false;
        if (typeof __tmIsOutboxTaskPendingDeleted === 'function' && __tmIsOutboxTaskPendingDeleted(sid)) return false;

        const parentTaskId = String(sourceTask.parentTaskId || '').trim();
        if (parentTaskId && typeof __tmIsOutboxTaskPendingDeleted === 'function' && __tmIsOutboxTaskPendingDeleted(parentTaskId)) return false;
        try {
            globalThis.__tmTaskIdentity?.remember?.({
                clientId,
                tempId: tid,
                kind: 'sibling',
                status: 'optimistic',
            });
        } catch (e) {}
        const parentTask = parentTaskId
            ? (
                globalThis.__tmRuntimeState?.getTaskById?.(parentTaskId, { includePending: true, preferPending: true })
                || state.flatTasks?.[parentTaskId]
                || state.pendingInsertedTasks?.[parentTaskId]
                || null
            )
            : null;
        const nextTask = {
            id: tid,
            clientId,
            __tmClientId: clientId,
            done: false,
            pinned: false,
            content: text,
            markdown: `- [ ] ${text}`,
            priority: '',
            duration: '',
            remark: '',
            completionTime: '',
            customTime: '',
            customStatus: '',
            docName: sourceTask.docName || '',
            root_id: sourceTask.root_id || sourceTask.docId || '',
            docId: sourceTask.docId || sourceTask.root_id || '',
            parent_id: sourceTask.parent_id || '',
            parentTaskId: parentTaskId || null,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            children: [],
            level: Math.max(0, Number(sourceTask.level) || 0),
            h2: sourceTask.h2 || '',
            h2Id: sourceTask.h2Id || '',
        };
        try { normalizeTaskFields(nextTask, nextTask.docName || '未知文档'); } catch (e) {}
        try {
            const sourceDocSeq = Number(sourceTask?.docSeq);
            if (Number.isFinite(sourceDocSeq)) nextTask.docSeq = sourceDocSeq + 0.5;
        } catch (e) {}

        let insertedPending = false;
        try {
            insertedPending = !!globalThis.__tmTaskStore?.createPendingTask?.(nextTask, {
                clientId,
                tempId: tid,
                kind: 'sibling',
                status: 'optimistic',
                expiresAt: Date.now() + __TM_PENDING_INSERTED_TASK_KEEPALIVE_MS,
            });
        } catch (e) {}
        if (!insertedPending) return false;
        if (parentTask) {
            if (!Array.isArray(parentTask.children)) parentTask.children = [];
            if (!parentTask.children.some((child) => String(child?.id || '').trim() === tid)) {
                const sourceIndex = parentTask.children.findIndex((child) => String(child?.id || '').trim() === sid);
                if (sourceIndex >= 0) parentTask.children.splice(sourceIndex + 1, 0, nextTask);
                else parentTask.children.push(nextTask);
            }
        } else {
            const docId = String(nextTask.docId || nextTask.root_id || '').trim();
            const doc = state.taskTree.find((item) => String(item?.id || '').trim() === docId);
            if (doc) {
                if (!Array.isArray(doc.tasks)) doc.tasks = [];
                if (!doc.tasks.some((item) => String(item?.id || '').trim() === tid)) {
                    const sourceIndex = doc.tasks.findIndex((item) => String(item?.id || '').trim() === sid);
                    if (sourceIndex >= 0) doc.tasks.splice(sourceIndex + 1, 0, nextTask);
                    else doc.tasks.push(nextTask);
                }
            } else {
                __tmUpsertLocalTask(nextTask);
            }
        }
        try {
            const projected = __tmEnsureOptimisticTaskInFilteredTasks(nextTask) === true;
            if (!projected) {
                __tmScheduleViewRefresh({
                    mode: 'current',
                    withFilters: true,
                    reason: 'create-sibling-optimistic-filter-fallback',
                    taskIds: [tid],
                });
            }
        } catch (e) {}
        return nextTask;
    }

    function __tmQueueCreateTaskInDoc(options = {}, queueOptions = {}) {
        const opts0 = (options && typeof options === 'object') ? options : {};
        const {
            wait: optsWait,
            onQueued: optsOnQueued,
            onPending: optsOnPending,
            onSuccess: optsOnSuccess,
            onError: optsOnError,
            onFinally: optsOnFinally,
            ...opts
        } = opts0;
        const hooks = (queueOptions && typeof queueOptions === 'object') ? queueOptions : {};
        const docId = String(opts.docId || '').trim();
        const content = String(opts.content || '').trim();
        if (!docId) throw new Error('未设置文档');
        if (!content) throw new Error('请输入任务内容');
        const tempId = __tmGenerateTempTaskId('task');
        const clientId = String(globalThis.__tmTaskIdentity?.createClientId?.('task') || __tmGenerateTempTaskId('client')).trim();
        try {
            globalThis.__tmTaskIdentity?.remember?.({
                clientId,
                tempId,
                kind: 'task',
                status: 'queued',
            });
        } catch (e) {}
        const shouldWait = hooks.wait !== false && optsWait !== false;
        let pendingPromise = null;
        const opPromise = __tmEnqueueQueuedOp({
            type: 'createTaskInDoc',
            docId,
            laneKey: `doc:${docId}`,
            data: {
                ...opts,
                docId,
                content,
                clientId,
                tempId,
                skipOptimisticFilterWork: opts.skipOptimisticFilterWork !== false,
                skipSnapshotViewStateFilterRefresh: opts.skipSnapshotViewStateFilterRefresh === true
                    || opts.skipOptimisticFilterWork !== false,
            },
        }, {
            wait: shouldWait,
            onPending: (promise, op) => {
                pendingPromise = promise;
                try { hooks.onPending?.(promise, op); } catch (e) {}
                try { optsOnPending?.(promise, op); } catch (e) {}
            },
        });
        try { hooks.onQueued?.(tempId, { clientId }); } catch (e) {}
        try { optsOnQueued?.(tempId, { clientId }); } catch (e) {}
        const settlePromise = pendingPromise || opPromise;
        settlePromise.then((result) => {
            const realId = String(result?.realId || tempId).trim() || tempId;
            try { globalThis.__tmTaskIdentity?.commit?.({ clientId, tempId, blockId: realId }); } catch (e) {}
            try { hooks.onSuccess?.(realId, result); } catch (e) {}
            try { optsOnSuccess?.(realId, result); } catch (e) {}
        }).catch((e) => {
            try { hooks.onError?.(e); } catch (e2) {}
            try { optsOnError?.(e); } catch (e2) {}
        }).finally(() => {
            try { hooks.onFinally?.(); } catch (e) {}
            try { optsOnFinally?.(); } catch (e) {}
        });
        return shouldWait
            ? opPromise.then((result) => String(result?.realId || tempId).trim() || tempId)
            : Promise.resolve(tempId);
    }

    function __tmQueueCreateSiblingTask(taskId, content, options = {}) {
        const tid = String(taskId || '').trim();
        const text = String(content || '').trim();
        const hooks = (options && typeof options === 'object') ? options : {};
        const currentTask = globalThis.__tmRuntimeState?.getTaskById?.(tid, { includePending: true, preferPending: true })
            || state.flatTasks?.[tid]
            || state.pendingInsertedTasks?.[tid]
            || null;
        if (!tid || !currentTask) throw new Error('未找到当前任务');
        if (!text) throw new Error('请输入任务内容');
        if (typeof __tmIsOutboxTaskPendingDeleted === 'function' && __tmIsOutboxTaskPendingDeleted(tid)) {
            throw new Error('当前任务正在删除，无法新建同级任务');
        }
        const parentTaskId = String(currentTask.parentTaskId || '').trim();
        if (parentTaskId && typeof __tmIsOutboxTaskPendingDeleted === 'function' && __tmIsOutboxTaskPendingDeleted(parentTaskId)) {
            throw new Error('父任务正在删除，无法新建同级任务');
        }
        const tempId = __tmGenerateTempTaskId('sibling');
        const clientId = String(globalThis.__tmTaskIdentity?.createClientId?.('sibling') || __tmGenerateTempTaskId('client')).trim();
        try {
            globalThis.__tmTaskIdentity?.remember?.({
                clientId,
                tempId,
                kind: 'sibling',
                status: 'queued',
            });
        } catch (e) {}
        const docId = String(currentTask.docId || currentTask.root_id || '').trim();
        const shouldWait = hooks.wait !== false;
        let pendingPromise = null;
        const opPromise = __tmEnqueueQueuedOp({
            type: 'createSibling',
            docId,
            laneKey: docId ? `doc:${docId}` : `task:${tid}`,
            data: {
                sourceTaskId: tid,
                clientId,
                tempId,
                content: text,
                docId,
                skipSnapshotViewStateFilterRefresh: hooks.skipSnapshotViewStateFilterRefresh !== false,
            },
        }, {
            wait: shouldWait,
            onPending: (promise) => {
                pendingPromise = promise;
            },
        });
        try { hooks.onQueued?.(tempId, { clientId }); } catch (e) {}
        const settlePromise = pendingPromise || opPromise;
        settlePromise.then((result) => {
            const realId = String(result?.realId || tempId).trim() || tempId;
            try { globalThis.__tmTaskIdentity?.commit?.({ clientId, tempId, blockId: realId }); } catch (e) {}
            try { hooks.onSuccess?.(realId); } catch (e) {}
            if (hooks.silent !== true) hint('✅ 同级任务已创建', 'success');
        }).catch((e) => {
            try { hooks.onError?.(e); } catch (e2) {}
            if (hooks.silent !== true) hint(`❌ 新建同级任务失败: ${e.message}`, 'error');
        }).finally(() => {
            try { hooks.onFinally?.(); } catch (e) {}
        });
        return shouldWait
            ? opPromise.then((result) => String(result?.realId || tempId).trim() || tempId)
            : Promise.resolve(tempId);
    }

    window.tmCreateSubtask = async function(parentTaskId, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}

        const pid = String(parentTaskId || '').trim();
        const parentTask = globalThis.__tmRuntimeState?.getTaskById?.(pid, { includePending: true, preferPending: true })
            || state.flatTasks?.[pid]
            || state.pendingInsertedTasks?.[pid]
            || null;
        if (!pid || !parentTask) {
            hint('❌ 未找到父任务', 'error');
            return;
        }
        if (!__tmEnsureEditableTaskLike(parentTask, '新建子任务')) return;

        const text = await showPrompt('新建子任务', '每行一个子任务；回车换行，Ctrl + 回车提交', '', {
            multiline: true,
            rows: 4,
            minHeight: 96,
        });
        if (text == null) return;
        const taskLines = __tmSplitTaskInputLines(text);
        if (taskLines.length === 0) {
            hint('⚠ 请输入子任务内容', 'warning');
            return;
        }

        try {
            const tempIds = [];
            const createSubtask = globalThis.__tmRequireTaskOutbox?.('createSubtask');
            if (typeof createSubtask !== 'function') throw new Error('任务写入队列未就绪: createSubtask');
            taskLines.forEach((line) => {
                createSubtask(pid, line, {
                    silent: true,
                    wait: false,
                    skipInteractionGate: true,
                    skipOptimisticMainRefresh: true,
                    skipOptimisticFilterWork: true,
                    skipSettledRefresh: true,
                    refreshCurrentView: false,
                    scheduleSnapshotRefresh: false,
                    skipSnapshotViewStateFilterRefresh: true,
                    refreshPolicy: {
                        current: false,
                        detail: false,
                        checklistGroup: true,
                        snapshot: false,
                        withFilters: false,
                    },
                    onQueued: (tempId) => {
                        const tid = String(tempId || '').trim();
                        if (tid) tempIds.push(tid);
                        try {
                            if (typeof __tmScheduleChecklistOptimisticSubtaskRefresh === 'function') {
                                __tmScheduleChecklistOptimisticSubtaskRefresh(pid, tid);
                            }
                        } catch (e) {}
                    },
                    onError: (err) => {
                        hint(`❌ 新建子任务失败: ${err?.message || err || '未知错误'}`, 'error');
                    },
                });
            });
            const refreshIds = [pid].concat(tempIds).filter(Boolean);
            try {
                __tmScheduleViewRefresh({
                    mode: 'detail',
                    withFilters: false,
                    reason: 'create-subtask-detail-optimistic',
                    taskIds: refreshIds,
                });
            } catch (e) {}
            hint(taskLines.length > 1 ? `✅ 已新增 ${taskLines.length} 个子任务` : '✅ 已新增', 'success');
        } catch (e) {
            hint(`❌ 新建子任务失败: ${e.message}`, 'error');
        }
    };

    window.tmCreateSiblingTask = async function(taskId, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}

        const tid = String(taskId || '').trim();
        const currentTask = globalThis.__tmRuntimeState?.getTaskById?.(tid, { includePending: true, preferPending: true })
            || state.flatTasks?.[tid]
            || state.pendingInsertedTasks?.[tid]
            || null;
        if (!tid || !currentTask) {
            hint('❌ 未找到当前任务', 'error');
            return;
        }
        if (!__tmEnsureEditableTaskLike(currentTask, '新建同级任务')) return;

        const text = await showPrompt('新建同级任务', '请输入任务内容', '');
        if (text == null) return;
        const nextText = String(text || '').trim();
        if (!nextText) {
            hint('⚠ 请输入任务内容', 'warning');
            return;
        }

        try {
            let tempId = '';
            __tmQueueCreateSiblingTask(tid, nextText, {
                silent: true,
                wait: false,
                onQueued: (queuedId) => {
                    tempId = String(queuedId || '').trim();
                },
                onError: (err) => {
                    hint(`❌ 新建同级任务失败: ${err?.message || err || '未知错误'}`, 'error');
                },
            });
            try {
                __tmScheduleViewRefresh({
                    mode: 'current',
                    withFilters: false,
                    reason: 'create-sibling-optimistic',
                    taskIds: [tid, tempId].filter(Boolean),
                });
            } catch (e) {
                try { __tmScheduleRender({ withFilters: false }); } catch (e2) {}
            }
            hint('✅ 同级任务已创建', 'success');
        } catch (e) {
            hint(`❌ 新建同级任务失败: ${e.message}`, 'error');
        }
    };

    let __tmQuickbarScheduledRefreshTimer = 0;

    globalThis.__taskHorizonScheduleQuickbarRefresh = (options = {}) => {
        const opts = (options && typeof options === 'object') ? options : {};
        const waitMs = Math.max(40, Math.min(180, Number(opts.delayMs) || 80));
        if (__tmQuickbarScheduledRefreshTimer) {
            try { clearTimeout(__tmQuickbarScheduledRefreshTimer); } catch (e) {}
            __tmQuickbarScheduledRefreshTimer = 0;
        }
        __tmQuickbarScheduledRefreshTimer = setTimeout(() => {
            __tmQuickbarScheduledRefreshTimer = 0;
            try { globalThis.__taskHorizonRefresh?.(); } catch (e) {}
        }, waitMs);
        return true;
    };

    // 注册全局刷新回调，供悬浮条调用
    globalThis.__taskHorizonRefresh = () => {
        try {
            const modifiedIds = Array.from(__tmModifiedTaskIds || []).map((id) => String(id || '').trim()).filter(Boolean);
            const pluginVisible = __tmIsPluginVisibleNow();
            if (pluginVisible) {
                if (modifiedIds.length > 0) {
                    modifiedIds.forEach((taskId) => {
                        try { __tmViewControllers.detail.patchTask(taskId); } catch (e) {}
                    });
                }
                let rerenderedInPlace = false;
                try {
                    const liveModal = globalThis.__tmRuntimeState?.getModal?.() || state.modal;
                    if (globalThis.__tmRuntimeState?.hasLiveModal?.(liveModal) ?? (state.modal && document.body.contains(state.modal))) {
                        rerenderedInPlace = !!__tmRerenderCurrentViewInPlace(liveModal);
                        if (!rerenderedInPlace) {
                            __tmScheduleViewRefresh({
                                mode: 'current',
                                withFilters: true,
                                reason: 'quickbar-refresh-visible',
                            });
                        }
                    }
                } catch (e) {}
                try { __tmModifiedTaskIds.clear(); } catch (e) {}
                return;
            }
            const runtimeMobile = globalThis.__tmRuntimeHost?.getInfo?.()?.runtimeMobileClient ?? __tmIsRuntimeMobileClient();
            if (runtimeMobile) {
                try {
                    modifiedIds.forEach((taskId) => {
                        try { __tmMarkQuickbarModifiedTask(taskId); } catch (e) {}
                    });
                } catch (e) {}
                try { __tmModifiedTaskIds.clear(); } catch (e) {}
                try {
                    if (typeof __tmScheduleMaybeAutoRefreshOnEnter === 'function') {
                        __tmScheduleMaybeAutoRefreshOnEnter('quickbar-refresh-hidden-mobile');
                    }
                } catch (e) {}
                return;
            }
            // 不可见时再退回静默就地刷新，避免切回页面后数据过旧。
            if (state.isRefreshing) {
                try {
                    if (typeof __tmScheduleMaybeAutoRefreshOnEnter === 'function') {
                        __tmScheduleMaybeAutoRefreshOnEnter('quickbar-refresh-busy');
                    }
                } catch (e) {}
                setTimeout(() => { try { __tmSilentRefreshAfterQuickbarUpdate(); } catch (e) {} }, 500);
                return;
            }
            __tmSilentRefreshAfterQuickbarUpdate();
            try {
                if (typeof __tmScheduleMaybeAutoRefreshOnEnter === 'function') {
                    __tmScheduleMaybeAutoRefreshOnEnter('quickbar-refresh-hidden');
                }
            } catch (e) {}
        } catch (e) {
            console.error('__taskHorizonRefresh error:', e);
        }
    };

    // 标记任务被修改，供悬浮条调用
    globalThis.__taskHorizonMarkModified = (taskId) => {
        if (taskId) {
            __tmModifiedTaskIds.add(String(taskId));
        }
    };

    // 清除修改标记，供刷新后调用
    globalThis.__taskHorizonClearModified = () => {
        __tmModifiedTaskIds.clear();
    };

    globalThis.__taskHorizonBuildTaskLikeFromBlockId = async (blockId) => {
        try {
            return await __tmBuildTaskLikeFromBlockId(blockId);
        } catch (e) {
            return null;
        }
    };

    window.tmQuickAddClose = function() {
        state.__quickAddDocPickerUnstack?.();
        state.__quickAddDocPickerUnstack = null;
        state.__quickAddUnstack?.();
        state.__quickAddUnstack = null;
        if (state.quickAddModal) {
            try { state.quickAddModal.remove(); } catch (e) {}
            state.quickAddModal = null;
        }
        if (state.quickAddDocPicker) {
            try { state.quickAddDocPicker.remove(); } catch (e) {}
            state.quickAddDocPicker = null;
        }
        state.quickAdd = null;
    };

    window.tmQuickAddOpen = async function() {
        if (state.quickAddModal) {
            state.__quickAddUnstack?.();
            state.__quickAddUnstack = null;
            try { state.quickAddModal.remove(); } catch (e) {}
            state.quickAddModal = null;
        }
        if (state.quickAddDocPicker) {
            state.__quickAddDocPickerUnstack?.();
            state.__quickAddDocPickerUnstack = null;
            try { state.quickAddDocPicker.remove(); } catch (e) {}
            state.quickAddDocPicker = null;
        }

        const configuredNewTaskDoc = String(SettingsStore.data.newTaskDocId || '').trim();
        const docId = await __tmResolveDefaultDocIdAsync();
        if (!docId && configuredNewTaskDoc !== '__dailyNote__') {
            hint('⚠ 请先在设置中选择文档', 'warning');
            showSettings();
            return;
        }

        const initialMode = configuredNewTaskDoc === '__dailyNote__' ? 'dailyNote' : 'doc';
        const initialDocId = configuredNewTaskDoc === '__dailyNote__' ? (docId || '') : docId;

        const stOptions = SettingsStore.data.customStatusOptions || [];
        const defaultStatusId = __tmGetDefaultUndoneStatusId(stOptions);
        state.quickAdd = {
            docId: initialDocId,
            docMode: initialMode,
            customStatus: defaultStatusId,
            priority: 'none',
            startDate: '',
            completionTime: '',
            openReminderAfterCreate: false,
        };

        const modal = document.createElement('div');
        modal.className = 'tm-quick-add-modal';
        modal.style.zIndex = '100010';

        // 优先级配置
        const prConfig = {
            'high': { label: '高', color: 'var(--tm-danger-color)', bg: 'color-mix(in srgb, var(--tm-danger-color) 10%, transparent)' },
            'medium': { label: '中', color: 'var(--tm-warning-color, #f9ab00)', bg: 'color-mix(in srgb, var(--tm-warning-color, #f9ab00) 10%, transparent)' },
            'low': { label: '低', color: 'var(--tm-primary-color)', bg: 'color-mix(in srgb, var(--tm-primary-color) 10%, transparent)' },
            'none': { label: '无', color: 'var(--tm-text-color)', bg: 'transparent' }
        };

        modal.innerHTML = `
            <div class="tm-prompt-box" style="width: min(92vw, 520px);">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                    <div class="tm-prompt-title" style="margin:0;">添加待办</div>
                    <button class="tm-btn tm-btn-gray" id="tmQuickAddCloseBtn" onclick="tmQuickAddClose()" style="padding: 6px 12px; font-size: 13px;">关闭</button>
                </div>

                <textarea id="tmQuickAddInput" class="tm-prompt-input" placeholder="输入事项…每行一个任务；回车换行，Ctrl + 回车提交" enterkeyhint="enter" rows="3" style="margin-top:16px; font-size: 16px; padding: 12px; min-height: 86px; line-height: 1.45; resize: vertical;"></textarea>

                <div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-top:16px;">
                    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;flex:1 1 280px;min-width:0;">
                        <button class="tm-btn tm-btn-secondary" onclick="tmQuickAddOpenDocPicker()" style="padding: 6px 12px; font-size: 13px; display:flex; align-items:center; gap:4px; max-width:100%;">
                            📁 <span id="tmQuickAddDocName">文档</span>
                        </button>

                        <button id="tmQuickAddPriorityBtn" class="tm-btn tm-btn-secondary" onclick="tmQuickAddOpenPriorityPicker(event)" aria-haspopup="listbox" style="padding: 6px 12px; font-size: 13px; display:flex; align-items:center; gap:4px;">
                            ${__tmRenderPriorityJira('none', false)}
                        </button>

                        <div style="display:flex;align-items:center;gap:6px;">
                            <button id="tmQuickAddStatusBtn" class="tm-btn tm-btn-secondary" onclick="tmQuickAddOpenStatusPicker()" style="padding: 6px 10px; font-size: 13px; height: 32px; display:flex; align-items:center; gap:6px;">
                                状态
                            </button>
                        </div>

                        <div style="position:relative; display:inline-block; max-width:100%;">
                            <!-- 桌面端/移动端通用的日期选择器 -->
                            <div style="position:relative; display:inline-block; max-width:100%;">
                                <button class="tm-btn tm-btn-secondary" onclick="tmQuickAddOpenDatePicker()" style="padding: 6px 12px; font-size: 13px; display:flex; align-items:center; gap:4px; max-width:100%;">
                                    🗓 <span id="tmQuickAddDateLabel" style="display:inline-block; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">日期</span>
                                </button>
                                <input type="date" id="tmQuickAddDateInput" oninput="tmQuickAddDateChanged(this.value)" onchange="tmQuickAddDateChanged(this.value)"
                                       style="position:absolute; opacity:0; width:1px; height:1px; left:0; bottom:0; pointer-events:none; border:0; padding:0; margin:0; overflow:hidden; z-index:-1;">
                            </div>
                        </div>

                        <button id="tmQuickAddReminderBtn" class="tm-btn tm-btn-secondary" onclick="tmQuickAddToggleReminder()" style="padding: 6px 12px; font-size: 13px; display:flex; align-items:center; gap:4px;">
                            ⏰ <span>提醒</span>
                        </button>
                    </div>

                    <div style="display:flex; justify-content:flex-end; flex:0 0 auto; margin-left:auto; min-width:max-content;">
                        <button class="tm-btn tm-btn-primary" id="tmQuickAddSubmitBtn" onclick="tmQuickAddSubmit()" style="padding: 6px 14px; font-size: 13px; min-width: 96px; text-align:center; white-space:nowrap;">提交</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        state.quickAddModal = modal;
        __tmApplyPopupOpenAnimation(modal, modal.querySelector('.tm-prompt-box'), {
            mode: window.matchMedia?.('(max-width: 640px)')?.matches ? 'sheet' : 'center'
        });

        // 自动聚焦 (兼容移动端)
        const input = document.getElementById('tmQuickAddInput');
        if (input) {
            input.enterKeyHint = 'enter';
            input.setAttribute('enterkeyhint', 'enter');
            setTimeout(() => {
                input.focus();
                try { input.click(); } catch(e) {}
            }, 300);
            input.onkeydown = (e) => {
                if (e.key !== 'Enter') return;
                if (!e.ctrlKey && !e.metaKey) return;
                try { e.preventDefault(); } catch (e2) {}
                try { e.stopPropagation(); } catch (e2) {}
                window.tmQuickAddSubmit?.();
            };
        }

        state.__quickAddUnstack = __tmModalStackBind(() => window.tmQuickAddClose?.());

        modal.onclick = (e) => {
            if (e.target === modal) window.tmQuickAddClose?.();
        };

        window.tmQuickAddRenderMeta?.();
    };

    window.tmQuickAddOpenForDoc = async function(docId) {
        const id = String(docId || '').trim();
        await window.tmQuickAddOpen?.();
        if (!id) return;
        if (!state.quickAdd) return;
        state.quickAdd.docMode = 'doc';
        state.quickAdd.docId = id;
        try { window.tmQuickAddRenderMeta?.(); } catch (e) {}
        try {
            const input = document.getElementById('tmQuickAddInput');
            input?.focus?.();
        } catch (e) {}
    };

    window.tmQuickAddOpenForPreset = async function(docId, statusId, completionTime) {
        const did = String(docId || '').trim();
        const sid = String(statusId || '').trim();
        const date = __tmNormalizeDateOnly(String(completionTime || '').trim());
        await window.tmQuickAddOpen?.();
        const qa = state.quickAdd;
        if (!qa) return;
        if (did) {
            qa.docMode = 'doc';
            qa.docId = did;
        }
        if (sid) {
            const statusOptions = __tmGetStatusOptions(SettingsStore.data.customStatusOptions || []);
            if (__tmFindStatusOptionById(sid, statusOptions)) {
                qa.customStatus = sid;
            }
        }
        if (date) {
            qa.completionTime = date;
        }
        try { window.tmQuickAddRenderMeta?.(); } catch (e) {}
        try {
            const input = document.getElementById('tmQuickAddInput');
            input?.focus?.();
        } catch (e) {}
    };

    // 绑定全局点击事件，用于处理日期选择和关闭按钮（防止事件未被正确绑定）
    if (!window.tmQuickAddEventsBound) {
        window.tmQuickAddEventsBound = true;
        __tmQuickAddGlobalClickHandler = (e) => {
            const target = e.target;
            // 检查是否点击了文档选择器的关闭按钮（只关闭选择器，不关闭整个弹窗）
            if (target.id === 'tmQuickAddDocPickerCloseBtn' || (target.matches('.tm-btn-gray') && target.textContent.trim() === '关闭' && target.closest('#tmQuickAddDocList'))) {
                if (state.quickAddDocPicker) {
                    tmQuickAddCloseDocPicker();
                }
                e.stopPropagation();
                return;
            }
            // 检查是否点击了主弹窗的关闭按钮（关闭整个弹窗）
            if (target.id === 'tmQuickAddCloseBtn' || (target.matches('.tm-btn-gray') && target.textContent.trim() === '关闭' && !target.closest('#tmQuickAddDocList'))) {
                if (state.quickAddModal) {
                    tmQuickAddClose();
                }
            }
        };
        globalThis.__tmRuntimeEvents?.on?.(document, 'click', __tmQuickAddGlobalClickHandler);
    }

    window.tmQuickAddRenderMeta = function() {
        try {
            const qa = state.quickAdd || {};

            // 更新文档按钮文字
            const docName = qa.docMode === 'dailyNote'
                ? '今天日记'
                : (state.allDocuments.find(d => d.id === qa.docId)?.name || '未知文档');
            const docBtn = document.getElementById('tmQuickAddDocName');
            if (docBtn) docBtn.textContent = docName;

            // 更新优先级按钮样式（Jira 风格）
            const prBtn = document.getElementById('tmQuickAddPriorityBtn');
            if (prBtn) {
                const pr = qa.priority || 'none';
                prBtn.innerHTML = __tmRenderPriorityJira(pr, false);
                prBtn.style.color = '';
                prBtn.style.borderColor = '';
                prBtn.style.background = '';
            }

            window.tmQuickAddRefreshStatusSelect?.();
            const stBtn = document.getElementById('tmQuickAddStatusBtn');
            if (stBtn) {
                const options = SettingsStore.data.customStatusOptions || [];
                const id = __tmResolveUndoneStatusValue(qa.customStatus, options);
                const opt = options.find(o => o && o.id === id) || { id, name: id || '待办', color: '#757575' };
                const chipStyle = __tmBuildStatusChipStyle(opt.color);
                const name = String(opt?.name || opt?.id || '待办');
                stBtn.innerHTML = `<span class="tm-status-tag" style="${chipStyle};cursor:default;">${esc(name)}</span>`;
            }

            // 更新日期显示
            const dateLabel = document.getElementById('tmQuickAddDateLabel');
            const dateInput = document.getElementById('tmQuickAddDateInput');
            if (dateLabel && dateInput) {
                const sd = String(qa.startDate || '').trim();
                const ctValue = String(qa.completionTime || '').trim();
                const ct = ctValue
                    ? (sd && sd !== ctValue ? `${__tmFormatTaskTimeCompact(sd)}-${__tmFormatTaskTimeCompact(ctValue)}` : __tmFormatTaskTime(ctValue))
                    : (sd ? `开始 ${__tmFormatTaskTimeCompact(sd)}` : '日期');
                dateLabel.textContent = ct;
                dateInput.value = qa.completionTime ? __tmNormalizeDateOnly(qa.completionTime) : '';

                const btn = document.getElementById('tmQuickAddDateLabel')?.parentElement;
                if (btn) {
                    if (qa.startDate || qa.completionTime) {
                        btn.style.color = 'var(--tm-primary-color)';
                        btn.style.borderColor = 'var(--tm-primary-color)';
                    } else {
                        btn.style.color = '';
                        btn.style.borderColor = '';
                    }
                }
            }

            const reminderBtn = document.getElementById('tmQuickAddReminderBtn');
            if (reminderBtn) {
                const enabled = !!SettingsStore.data.enableTomatoIntegration;
                const active = !!qa.openReminderAfterCreate;
                reminderBtn.style.opacity = enabled ? '1' : '0.55';
                reminderBtn.style.cursor = enabled ? 'pointer' : 'not-allowed';
                reminderBtn.style.color = active ? 'var(--tm-primary-color)' : '';
                reminderBtn.style.borderColor = active ? 'var(--tm-primary-color)' : '';
                reminderBtn.style.background = active ? 'color-mix(in srgb, var(--tm-bg-color) 82%, var(--tm-primary-color) 18%)' : '';
                reminderBtn.title = enabled ? (active ? '提交后打开提醒设置' : '点击后提交时会打开提醒设置') : '番茄钟联动未启用';
                reminderBtn.innerHTML = `⏰ <span>${active ? '提醒: 开' : '提醒'}</span>`;
                reminderBtn.disabled = !enabled;
            }
        } catch (e) {}
    };

    window.tmQuickAddToggleReminder = function() {
        const qa = state.quickAdd;
        if (!qa) return;
        if (!SettingsStore.data.enableTomatoIntegration) {
            hint('⚠ 番茄钟联动已关闭', 'warning');
            return;
        }
        qa.openReminderAfterCreate = !qa.openReminderAfterCreate;
        window.tmQuickAddRenderMeta?.();
    };

    window.tmQuickAddStatusChanged = function(value) {
        const qa = state.quickAdd;
        if (!qa) return;
        qa.customStatus = String(value || '').trim();
        window.tmQuickAddRenderMeta?.();
    };

    window.tmQuickAddOpenStatusPicker = function() {
        const qa = state.quickAdd;
        const btn = document.getElementById('tmQuickAddStatusBtn');
        if (!qa || !btn) return;
        const options = SettingsStore.data.customStatusOptions || [];
        if (!Array.isArray(options) || options.length === 0) return;
        __tmOpenInlineEditor(btn, ({ editor, close }) => {
            const maxLen = options.reduce((m, o) => Math.max(m, String(o?.name || o?.id || '').length), 0);
            const w = Math.min(220, Math.max(98, maxLen * 12 + 24));
            // 快速添加弹窗 z-index 为 100010，内联编辑器需要更高层级避免被遮挡
            editor.style.zIndex = '100020';
            editor.style.minWidth = '0';
            editor.style.width = `${w}px`;
            editor.style.padding = '8px';
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.gap = '4px';
            options.forEach((opt) => {
                const id = String(opt?.id || '').trim();
                if (!id) return;
                const b = document.createElement('button');
                b.className = 'tm-status-option-btn';
                b.style.fontSize = '12px';
                b.style.textAlign = 'left';
                const chip = document.createElement('span');
                chip.className = 'tm-status-tag';
                chip.style.cssText = __tmBuildStatusChipStyle(opt?.color);
                chip.textContent = String(opt?.name || id);
                b.appendChild(chip);
                b.onclick = () => {
                    window.tmQuickAddStatusChanged(id);
                    close();
                };
                wrap.appendChild(b);
            });
            editor.appendChild(wrap);
        });
    };

    window.tmQuickAddRefreshStatusSelect = function() {
        const options = SettingsStore.data.customStatusOptions || [];
        if (!Array.isArray(options) || options.length === 0) {
            return;
        }
        const qa = state.quickAdd;
        let current = String(qa?.customStatus || '').trim();
        if (!options.some(o => String(o?.id || '').trim() === current)) {
            current = __tmGetDefaultUndoneStatusId(options);
            if (qa) qa.customStatus = current;
        }
    };

    window.tmQuickAddDateChanged = function(val) {
        const qa = state.quickAdd;
        if (!qa) return;
        const normalized = String(val || '').trim();
        qa.completionTime = normalized ? __tmNormalizeDateOnly(normalized) : '';
        window.tmQuickAddRenderMeta?.();
    };
    // 确保该函数在全局可见
    window.tmQuickAddDateChanged = window.tmQuickAddDateChanged;

    window.tmQuickAddOpenDatePicker = async function() {
        const qa = state.quickAdd;
        if (!qa) return;
        const btn = document.getElementById('tmQuickAddDateLabel')?.parentElement;
        if (btn instanceof HTMLElement && typeof window.tmOpenTaskTimeHub === 'function') {
            await window.tmOpenTaskTimeHub('__tm_quick_add_draft__', btn, {
                draft: true,
                activeField: 'completionTime',
                hideReminder: true,
                hideSchedule: true,
                hideRepeat: true,
                task: {
                    id: '__tm_quick_add_draft__',
                    content: __tmSplitTaskInputLines(document.getElementById('tmQuickAddInput')?.value || '')[0] || '新建任务',
                    startDate: String(qa.startDate || '').trim(),
                    start_date: String(qa.startDate || '').trim(),
                    completionTime: String(qa.completionTime || '').trim(),
                    completion_time: String(qa.completionTime || '').trim(),
                },
                onChange: async (payload = {}) => {
                    const patch = (payload?.patch && typeof payload.patch === 'object') ? payload.patch : {};
                    if (Object.prototype.hasOwnProperty.call(patch, 'startDate')) {
                        qa.startDate = String(patch.startDate || '').trim();
                    }
                    if (Object.prototype.hasOwnProperty.call(patch, 'completionTime')) {
                        qa.completionTime = String(patch.completionTime || '').trim();
                    }
                    window.tmQuickAddRenderMeta?.();
                },
            });
            return;
        }
        const input = document.getElementById('tmQuickAddDateInput');
        if (!(input instanceof HTMLInputElement)) return;
        try {
            if (typeof input.showPicker === 'function') input.showPicker();
            else input.click();
        } catch (e) {
            try { input.click(); } catch (e2) {}
        }
    };

    window.tmQuickAddOpenPriorityPicker = function(ev) {
        const qa = state.quickAdd;
        const btn = ev?.currentTarget instanceof HTMLElement
            ? ev.currentTarget
            : document.getElementById('tmQuickAddPriorityBtn');
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        if (!qa || !(btn instanceof HTMLElement)) return;
        __tmOpenPriorityInlinePicker(btn, {
            currentValue: qa.priority,
            zIndex: 100020,
            onPick: async (value) => {
                qa.priority = value || 'none';
                window.tmQuickAddRenderMeta?.();
            },
        });
    };

    window.tmQuickAddPickCompletion = async function() {
        const qa = state.quickAdd;
        if (!qa) return;
        const v = await showPrompt('截止日期', '输入日期，如 2026-02-07（留空清除）', String(qa.completionTime || ''));
        if (v === null) return;
        qa.completionTime = String(v || '').trim();
        window.tmQuickAddRenderMeta?.();
    };

    window.tmQuickAddOpenDocPicker = async function() {
        const qa = state.quickAdd;
        if (!qa) return;
        if (state.quickAddDocPicker) {
            state.__quickAddDocPickerUnstack?.();
            state.__quickAddDocPickerUnstack = null;
            try { state.quickAddDocPicker.remove(); } catch (e) {}
            state.quickAddDocPicker = null;
        }
        const groups = SettingsStore.data.docGroups || [];
        // 移除未分组逻辑

        const resolveDocName = (docId) => {
            if (!docId) return '未知文档';
            const found = state.allDocuments.find(d => d.id === docId);
            if (found) return found.name || '未命名文档';
            const entry = state.taskTree.find(d => d.id === docId);
            return entry?.name || '未命名文档';
        };
        const configuredNewTaskDoc = String(SettingsStore.data.newTaskDocId || '').trim();
        const defaultDocIsDailyNote = configuredNewTaskDoc === '__dailyNote__';
        const defaultDocId = defaultDocIsDailyNote
            ? ''
            : (__tmResolveConfiguredQuickAddDocId() || __tmResolveDefaultDocId());
        const defaultDocName = defaultDocIsDailyNote
            ? '今天日记'
            : (defaultDocId ? resolveDocName(defaultDocId) : '未设置');
        const defaultDocReady = defaultDocIsDailyNote || !!defaultDocId;
        const recentDocs = __tmGetQuickAddRecentDocs();
        const recentSectionHtml = recentDocs.length > 0 ? `
                <div style="border:1px solid var(--tm-border-color);border-radius:8px;margin-bottom:8px;overflow:hidden;">
                    <div style="padding:8px 10px;background:var(--tm-header-bg);font-weight:600;">最近选择</div>
                    <div style="padding:6px 10px;">
                        ${recentDocs.map((doc) => {
                            const id = String(doc?.id || '').trim();
                            const checked = qa.docMode !== 'dailyNote' && qa.docId === id;
                            const name = esc(String(doc?.name || resolveDocName(id) || '未命名文档'));
                            const path = String(doc?.path || '').trim();
                            return `
                                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;cursor:pointer;" onclick="tmQuickAddSelectDoc('${escSq(id)}')">
                                    <div style="min-width:0;flex:1;">
                                        <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</div>
                                        ${path ? `<div style="margin-top:2px;font-size:12px;color:var(--tm-secondary-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(path)}</div>` : ''}
                                    </div>
                                    <div style="margin-left:10px;">${checked ? '✅' : '◻️'}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
        ` : '';

        const picker = document.createElement('div');
        picker.className = 'tm-quick-add-modal';
        picker.style.zIndex = '100011';
        picker.innerHTML = `
            <div class="tm-prompt-box" style="width:min(92vw,520px);max-height:70vh;overflow:auto;">
                <div class="tm-prompt-title" style="margin:0 0 10px 0;">选择文档</div>
                <div style="border:1px solid var(--tm-border-color);border-radius:8px;margin-bottom:8px;overflow:hidden;">
                    <div style="padding:8px 10px;background:var(--tm-header-bg);font-weight:600;">快捷</div>
                    <div style="padding:6px 10px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;cursor:pointer;" onclick="tmQuickAddUseTodayDiary();tmQuickAddCloseDocPicker();">
                            <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">今天日记</div>
                            <div style="margin-left:10px;">${qa.docMode === 'dailyNote' ? '✅' : '◻️'}</div>
                        </div>
                        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;cursor:${defaultDocReady ? 'pointer' : 'not-allowed'};opacity:${defaultDocReady ? 1 : 0.6};" onclick="${defaultDocReady ? `tmQuickAddUseDefaultDoc();tmQuickAddCloseDocPicker();` : ''}">
                            <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">默认任务文档：${esc(defaultDocName)}</div>
                            <div style="margin-left:10px;">${defaultDocIsDailyNote ? (qa.docMode === 'dailyNote' ? '✅' : '◻️') : (qa.docMode !== 'dailyNote' && qa.docId === defaultDocId ? '✅' : '◻️')}</div>
                        </div>
                    </div>
                </div>
                ${recentSectionHtml}
                <div id="tmQuickAddDocList"></div>
                <div style="display:flex;gap:8px;margin-top:10px;">
                    <button class="tm-btn tm-btn-gray" id="tmQuickAddDocPickerCloseBtn" onclick="tmQuickAddCloseDocPicker()" style="padding: 6px 10px; font-size: 12px;">关闭</button>
                </div>
            </div>
        `;
        document.body.appendChild(picker);
        state.quickAddDocPicker = picker;
        __tmApplyPopupOpenAnimation(picker, picker.querySelector('.tm-prompt-box'), {
            mode: window.matchMedia?.('(max-width: 640px)')?.matches ? 'sheet' : 'center'
        });

        state.__quickAddDocPickerUnstack = __tmModalStackBind(() => window.tmQuickAddCloseDocPicker?.());

        picker.onclick = (e) => {
            if (e.target === picker) window.tmQuickAddCloseDocPicker?.();
        };

        const listEl = picker.querySelector('#tmQuickAddDocList');
        const renderGroup = (label, docs, groupKey, initialOpen = false) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'border:1px solid var(--tm-border-color);border-radius:8px;margin-bottom:8px;overflow:hidden;';
            const head = document.createElement('div');
            head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--tm-header-bg);cursor:pointer;';
            head.innerHTML = `<div style="font-weight:600;">${esc(label)}</div><div style="opacity:0.75;">${initialOpen ? '▾' : '▸'}</div>`;
            const body = document.createElement('div');
            body.style.cssText = `padding:6px 10px;display:${initialOpen ? 'block' : 'none'};`;

            // 渲染文档列表的辅助函数
            const renderDocs = (docList) => {
                body.innerHTML = '';
                if (docList.length === 0) {
                    body.innerHTML = '<div style="color:var(--tm-secondary-text);padding:8px 0;font-size:13px;">暂无文档</div>';
                    return;
                }
                docList.forEach(d => {
                    const id = String(d?.id || d || '').trim();
                    if (!id) return;
                    const row = document.createElement('div');
                    const checked = id === qa.docId;
                    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 0;cursor:pointer;';
                    row.innerHTML = `<div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(resolveDocName(id))}</div><div style="margin-left:10px;">${checked ? '✅' : '◻️'}</div>`;
                    row.onclick = () => window.tmQuickAddSelectDoc?.(id);
                    body.appendChild(row);
                });
            };

            // 初始状态下不渲染文档列表，或者渲染配置的文档（视需求而定）
            // 用户要求：点击后展示全部以查询到有任务的文档名，而不只是设置中的文档
            // 所以初始状态可以是空的或者只显示配置文档，展开时再动态加载
            if (initialOpen) {
                renderDocs(docs); // 初始展开时先显示配置的
            }

            // 点击分组标题展开/折叠
            head.onclick = async () => {
                const open = body.style.display !== 'none';
                if (!open) {
                    // 展开时
                    body.style.display = 'block';
                    head.lastElementChild.textContent = '▾';

                    // 动态查询该分组下所有包含任务的文档
                    if (groupKey) {
                        // 显示加载中状态
                        body.innerHTML = '<div style="color:var(--tm-secondary-text);padding:8px 0;font-size:13px;">🔄 加载文档中...</div>';
                        try {
                            // 使用 SQL 查询：假设 docGroups 配置的是根文档或目录
                            // 但 docGroups 配置的是文档列表。
                            // 如果用户意图是：通过 SQL 查询该分组下（假设分组 ID 是目录 ID？）的文档
                            // 但 docGroups 的 ID 是随机生成的 UUID，不对应真实目录。
                            // 唯一关联真实目录的是 g.docs 里的文档 ID。

                            // 另一种理解：用户希望在点击分组时，列出当前 state.taskTree 中加载的所有属于该分组的文档
                            // 即使它们不在 SettingsStore 的 g.docs 配置里（可能是递归加载进来的）

                            // 1. 获取该分组配置的所有根文档 ID
                            const rootDocIds = new Set(docs.map(d => String(d?.id || d || '')));

                            // 2. 遍历 state.taskTree，找到所有属于这些根文档（或其子文档）的文档
                            // state.taskTree 是扁平的文档列表（包含递归加载的子文档）
                            // 我们需要一种方法判断 taskTree 中的文档是否属于当前分组
                            // 这里的逻辑假设：如果 taskTree 中的文档是 g.docs 中某个文档的子孙，则属于该分组。
                            // 但 taskTree 结构中没有直接保留层级关系，只有 doc.id
                            // 幸好 resolveDocIdsFromGroups 会解析递归，加载到 taskTree

                            // 所以，我们可以认为 state.taskTree 中目前加载的所有文档，
                            // 如果它是 g.docs 中某个文档的后代（或者就是它自己），那么它就属于该分组。
                            // 但我们如何判断“后代”关系？API.getSubDocIds 是异步的。
                            // state.allDocuments 包含了所有文档路径信息（如果有 path 字段）
                            // 但 state.allDocuments 只包含 ID 和 Name。

                            // 简便方案：既然 resolveDocIdsFromGroups 已经处理了递归逻辑并将结果存入 state.taskTree
                            // 我们可以尝试重新运行一次 resolveDocIdsFromGroups 的逻辑（针对特定分组），
                            // 获取该分组应该包含的所有文档 ID（包括递归的）。

                            // 获取该分组的所有目标文档（含递归标记）
                            const targetDocs = docs;
                            const alwaysVisibleDocIds = new Set(
                                (Array.isArray(targetDocs) ? targetDocs : [])
                                    .filter((doc) => {
                                        const kind = String(doc?.kind || 'doc').trim() || 'doc';
                                        return kind === 'doc' && !doc?.recursive;
                                    })
                                    .map((doc) => String(doc?.id || '').trim())
                                    .filter(Boolean)
                            );
                            const finalIds = new Set();

                            const promises = targetDocs.map((doc) => __tmExpandSourceEntryDocIds(doc, (sid) => {
                                const id = String(sid || '').trim();
                                if (id) finalIds.add(id);
                            }));
                            await Promise.all(promises);

                            // 动态查询文档的任务状态（即使不在 taskTree 中）
                            const allIds = Array.from(finalIds);
                            // 1. 先从 taskTree 中检查
                            const tasksMap = new Map();
                            const taskTreeDocMap = new Map((Array.isArray(state.taskTree) ? state.taskTree : []).map((doc) => [String(doc?.id || '').trim(), doc]));
                            allIds.forEach(id => {
                                const treeDoc = taskTreeDocMap.get(String(id || '').trim());
                                if (treeDoc && treeDoc.tasks && treeDoc.tasks.length > 0) {
                                    tasksMap.set(id, true);
                                }
                            });

                            await __tmFillDocHasTasksMap(allIds, tasksMap);

                            // 手动添加的单个文档始终显示；笔记本/递归子文档仍按“有任务”显示
                            const docList = allIds.map(id => {
                                const docId = String(id || '').trim();
                                return {
                                    id: docId,
                                    hasTasks: tasksMap.has(docId),
                                    alwaysVisible: alwaysVisibleDocIds.has(docId),
                                };
                            }).filter(item => item.alwaysVisible || item.hasTasks);

                            // 排序：按名称
                            docList.sort((a, b) => {
                                return resolveDocName(a.id).localeCompare(resolveDocName(b.id));
                            });

                            // 渲染
                            renderDocs(docList);

                        } catch (e) {
                            console.error('[QuickAdd] 加载分组文档失败', e);
                            renderDocs(docs); // 回退
                        }
                    } else {
                        renderDocs(docs);
                    }
                } else {
                    body.style.display = 'none';
                    head.lastElementChild.textContent = '▸';
                }
            };

            wrap.appendChild(head);
            wrap.appendChild(body);
            return wrap;
        };

        groups.forEach(g => {
            const docs = __tmGetGroupSourceEntries(g);
            if (docs.length === 0) return;
            // 传递 group.id 以便进行动态查询
            listEl.appendChild(renderGroup(__tmResolveDocGroupName(g), docs, String(g?.id || '')));
        });
    };

    window.tmQuickAddCloseDocPicker = function() {
        state.__quickAddDocPickerUnstack?.();
        state.__quickAddDocPickerUnstack = null;
        if (state.quickAddDocPicker) {
            try { state.quickAddDocPicker.remove(); } catch (e) {}
            state.quickAddDocPicker = null;
        }
    };

    window.tmQuickAddSelectDoc = async function(docId) {
        const qa = state.quickAdd;
        if (!qa) return;
        const id = String(docId || '').trim();
        if (!id) return;
        // 仅更新本地状态，不修改全局设置
        qa.docId = id;
        qa.docMode = 'doc';
        __tmRememberQuickAddRecentDoc(id);
        // 移除对 updateNewTaskDocId 的调用，避免修改全局新建文档设置
        window.tmQuickAddRenderMeta?.();
        window.tmQuickAddCloseDocPicker?.();
    };

    window.tmQuickAddUseTodayDiary = function() {
        const qa = state.quickAdd;
        if (!qa) return;
        qa.docMode = 'dailyNote';
        try { window.tmQuickAddCloseDocPicker?.(); } catch (e) {}
        window.tmQuickAddRenderMeta?.();
    };

    window.tmQuickAddUseDefaultDoc = async function() {
        const qa = state.quickAdd;
        if (!qa) return;
        const configured = String(SettingsStore.data.newTaskDocId || '').trim();
        if (configured === '__dailyNote__') {
            qa.docMode = 'dailyNote';
            window.tmQuickAddRenderMeta?.();
            return;
        }
        const id = __tmResolveConfiguredQuickAddDocId() || await __tmResolveDefaultDocIdAsync();
        if (!id) {
            hint('⚠ 未设置默认任务文档', 'warning');
            return;
        }
        qa.docId = id;
        qa.docMode = 'doc';
        __tmRememberQuickAddRecentDoc(id);
        window.tmQuickAddRenderMeta?.();
    };

    window.tmQuickAddSubmit = async function() {
        const qa = state.quickAdd;
        if (!qa) return;
        if (state.quickAddSubmitting) return;
        const input = document.getElementById('tmQuickAddInput');
        const dateInput = document.getElementById('tmQuickAddDateInput');
        const taskLines = __tmSplitTaskInputLines(input?.value || '');
        if (taskLines.length === 0) return;
        const startDate = String(qa.startDate || '').trim() ? __tmNormalizeDateOnly(qa.startDate) : '';
        const completionTime = (() => {
            const raw = dateInput instanceof HTMLInputElement
                ? String(dateInput.value || '').trim()
                : String(qa.completionTime || '').trim();
            return raw ? __tmNormalizeDateOnly(raw) : '';
        })();
        qa.startDate = startDate;
        qa.completionTime = completionTime;
        state.quickAddSubmitting = true;
        const payload = {
            docId: qa.docId,
            docMode: qa.docMode,
            priority: qa.priority,
            customStatus: qa.customStatus,
            startDate,
            completionTime,
            openReminderAfterCreate: !!qa.openReminderAfterCreate,
            contents: taskLines,
        };
        window.tmQuickAddClose?.();
        state.quickAddSubmitting = false;
        (async () => {
            try {
                let targetDocId = payload.docId;
                if (payload.docMode === 'dailyNote') {
                    let notebook = __tmResolveConfiguredDailyNoteNotebookId();
                    if (!notebook) {
                        try { await __tmRefreshNotebookCache(); } catch (e) {}
                        notebook = __tmResolveConfiguredDailyNoteNotebookId();
                    }
                    if (!notebook) notebook = await API.getDocNotebook(payload.docId);
                    if (!notebook) throw new Error('无法确定日记所属笔记本');
                    targetDocId = await API.createDailyNote(notebook);
                    if (!String(targetDocId || '').trim()) throw new Error('获取日记文档失败');
                }
                const createdTaskIds = [];
                const appendToBottom = payload.docMode === 'dailyNote' && SettingsStore.data.newTaskDailyNoteAppendToBottom === true;
                const createTaskInDoc = globalThis.__tmRequireTaskOutbox?.('createTaskInDoc');
                if (typeof createTaskInDoc !== 'function') throw new Error('任务写入队列未就绪: createTaskInDoc');
                let insertBeforeId = '';
                let insertAfterId = '';
                let topAnchorResolved = false;
                let headingPatch = null;
                let headingAppendToBottom = false;
                let staleConfiguredHeading = false;
                const configuredHeading = payload.docMode === 'doc' && typeof __tmGetDocDefaultTaskHeadingConfig === 'function'
                    ? __tmGetDocDefaultTaskHeadingConfig(targetDocId)
                    : null;
                if (!appendToBottom && configuredHeading?.headingId && typeof __tmResolveHeadingGroupInsertPlacement === 'function') {
                    try {
                        const useSectionEnd = !!SettingsStore.data.headingGroupCreateAtSectionEnd;
                        const placement = await __tmResolveHeadingGroupInsertPlacement(targetDocId, configuredHeading.headingId, configuredHeading.headingLevel || SettingsStore.data.taskHeadingLevel || 'h2');
                        if (placement?.matched) {
                            headingPatch = __tmBuildHeadingPatchFromPlacement(placement);
                            if (useSectionEnd) {
                                insertBeforeId = String(placement.nextID || '').trim();
                                headingAppendToBottom = placement.appendToBottom === true;
                                if (!insertBeforeId && placement.appendToBottom === true) {
                                    topAnchorResolved = true;
                                }
                            } else {
                                insertAfterId = String(placement.insertAfterID || configuredHeading.headingId || '').trim();
                            }
                        } else if (placement?.checked === true) {
                            staleConfiguredHeading = true;
                        }
                    } catch (e) {
                        headingPatch = null;
                        insertAfterId = '';
                    }
                }
                if (staleConfiguredHeading && configuredHeading?.headingId) {
                    try {
                        if (typeof __tmSaveDocDefaultTaskHeadingConfig === 'function') {
                            await __tmSaveDocDefaultTaskHeadingConfig(targetDocId, null);
                        } else if (SettingsStore?.data?.docDefaultTaskHeadingByDocId) {
                            delete SettingsStore.data.docDefaultTaskHeadingByDocId[targetDocId];
                            await SettingsStore.save();
                        }
                    } catch (e) {}
                    try { hint('⚠ 默认新建标题已不存在，已改用默认新建位置', 'warning'); } catch (e) {}
                    headingPatch = null;
                    insertAfterId = '';
                    headingAppendToBottom = false;
                }
                if (!appendToBottom && !headingPatch && payload.contents.length > 1) {
                    try {
                        insertBeforeId = String(await API.getFirstDirectChildIdOfDoc(targetDocId) || '').trim();
                        topAnchorResolved = true;
                    } catch (e) {}
                }
                const appendEmptyBatchToKeepOrder = !appendToBottom && topAnchorResolved && !insertBeforeId && payload.contents.length > 1;
                const createContents = insertAfterId ? payload.contents.slice().reverse() : payload.contents;
                await Promise.all(createContents.map((content) => createTaskInDoc({
                        docId: targetDocId,
                        content,
                        priority: payload.priority,
                        customStatus: payload.customStatus,
                        startDate: payload.startDate,
                        completionTime: payload.completionTime,
                        atTop: false,
                        appendToBottom: appendToBottom || headingAppendToBottom || appendEmptyBatchToKeepOrder,
                        insertBeforeId,
                        insertAfterId,
                        targetHeadingId: headingPatch?.h2Id || '',
                        targetHeading: headingPatch?.h2 || '',
                        targetHeadingRank: Number(headingPatch?.h2Rank),
                        wait: false,
                        skipOptimisticMainRefresh: true,
                        skipOptimisticFilterWork: true,
                        onError: (err) => {
                            hint(`❌ 创建失败: ${err?.message || err || '未知错误'}`, 'error');
                        },
                    }).then((createdTaskId) => {
                    if (createdTaskId) {
                        createdTaskIds.push(createdTaskId);
                        if (headingPatch) __tmApplyHeadingPatchToTaskLocal(createdTaskId, headingPatch, 'quick-add-default-heading');
                    }
                    })));
                try {
                    __tmScheduleViewRefresh({
                        mode: 'current',
                        withFilters: false,
                        reason: 'quick-add-batch-create',
                        taskIds: createdTaskIds,
                    });
                } catch (e) {
                    try { __tmScheduleRender({ withFilters: false, reason: 'quick-add-batch-create' }); } catch (e2) {}
                }
                hint(payload.contents.length > 1 ? `✅ 已创建 ${payload.contents.length} 个任务` : '✅ 任务已创建', 'success');
                const createdTaskId = createdTaskIds[0] || '';
                if (payload.openReminderAfterCreate && createdTaskId) {
                    setTimeout(() => {
                        try { window.tmReminder?.(createdTaskId); } catch (e) {}
                    }, 80);
                }
            } catch (e) {
                hint(`❌ 创建失败: ${e.message}`, 'error');
            }
        })();
    };

    window.tmAdd = async function() {
        window.tmQuickAddOpen?.();
    };
