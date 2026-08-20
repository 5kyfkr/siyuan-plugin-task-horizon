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

    function __tmResolveQuickAddDocName(docId) {
        const id = String(docId || '').trim();
        if (!id) return '未知文档';
        const loaded = (Array.isArray(state.allDocuments) ? state.allDocuments : [])
            .find((doc) => String(doc?.id || '').trim() === id)
            || (Array.isArray(state.taskTree) ? state.taskTree : [])
                .find((doc) => String(doc?.id || '').trim() === id);
        const loadedName = String(loaded?.name || '').trim();
        if (loadedName) return loadedName;
        const recent = __tmGetQuickAddRecentDocs()
            .find((doc) => String(doc?.id || '').trim() === id);
        return String(recent?.name || '').trim() || '未知文档';
    }

    function __tmGetQuickAddLastLocation() {
        return __tmNormalizeQuickAddLastLocation(SettingsStore?.data?.quickAddLastLocation);
    }

    function __tmRememberQuickAddLocation(mode, docId = '') {
        const location = __tmNormalizeQuickAddLastLocation({ mode, docId });
        if (!location) return;
        SettingsStore.data.quickAddLastLocation = location;
        Storage.set(__TM_QUICK_ADD_LAST_LOCATION_KEY, location);
        if (location.mode === 'doc') {
            const meta = __tmResolveQuickAddRecentDocMeta(location.docId);
            if (meta) {
                const existing = __tmGetQuickAddRecentDocs()
                    .filter((entry) => String(entry?.id || '').trim() !== meta.id);
                const next = [{ ...meta, ts: Date.now() }, ...existing]
                    .slice(0, __TM_QUICK_ADD_RECENT_DOCS_LIMIT);
                SettingsStore.data.quickAddRecentDocs = __tmNormalizeQuickAddRecentDocs(next);
                Storage.set(__TM_QUICK_ADD_RECENT_DOCS_KEY, SettingsStore.data.quickAddRecentDocs);
            }
        }
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

    async function __tmResolveQuickAddInitialLocation() {
        const configured = String(SettingsStore.data.newTaskDocId || '').trim();
        const fallbackDocId = String(await __tmResolveDefaultDocIdAsync() || '').trim();
        if (__tmNormalizeNewTaskDefaultLocationMode(SettingsStore.data.newTaskDefaultLocationMode) !== 'lastSelected') {
            return configured === '__dailyNote__'
                ? { mode: 'dailyNote', docId: fallbackDocId }
                : { mode: 'doc', docId: fallbackDocId };
        }
        const lastLocation = __tmGetQuickAddLastLocation();
        if (lastLocation?.mode === 'dailyNote') return { mode: 'dailyNote', docId: fallbackDocId };
        if (lastLocation?.mode === 'doc' && lastLocation.docId) return lastLocation;
        return configured === '__dailyNote__'
            ? { mode: 'dailyNote', docId: fallbackDocId }
            : { mode: 'doc', docId: fallbackDocId };
    }

    function __tmResolveQuickAddDocId() {
        const configured = String(SettingsStore.data.newTaskDocId || '').trim();
        if (configured === '__dailyNote__') return __tmResolveDefaultDocId();
        const configuredDocId = __tmResolveConfiguredQuickAddDocId();
        if (configuredDocId) return configuredDocId;
        return __tmResolveDefaultDocId();
    }

    function __tmResolveQuickAddDefaultCompletionTime(referenceDate = new Date()) {
        if (SettingsStore.data.quickAddDefaultCompletionToday !== true) return '';
        return __tmNormalizeDateOnly(referenceDate);
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

    async function __tmPersistNewTaskAttrsOnce(taskId, patch, resolveId, options = {}) {
        const payload = (patch && typeof patch === 'object') ? patch : {};
        const opts = (options && typeof options === 'object') ? options : {};
        if (!Object.keys(payload).length) return String(taskId || '').trim();
        let currentId = String(taskId || '').trim();
        if (!currentId && resolveId) {
            currentId = String(await resolveId() || '').trim();
        }
        if (!currentId) throw new Error('未找到任务块');
        const patchTask = globalThis.__tmRequireTaskMutation?.('patchTask');
        if (typeof patchTask !== 'function') throw new Error('任务写入服务未就绪: patchTask');
        const write = patchTask(currentId, payload, {
            ...opts,
            source: String(opts.source || 'create-task-attrs').trim() || 'create-task-attrs',
            background: opts.background === true,
            wait: opts.background === true ? false : opts.wait !== false,
            docId: String(opts.docId || '').trim(),
            skipFlush: opts.skipFlush === true,
            mirrorTaskAttrs: opts.mirrorTaskAttrs === true,
        });
        if (opts.background !== true) {
            await write;
        }
        return currentId;
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
        const tid = String(taskId || '').trim();
        if (!tid) return false;
        if (tid.startsWith('tm_tmp_')) return true;
        try {
            const identity = globalThis.__tmTaskIdentity?.get?.(tid);
            return !!state.pendingInsertedTasks?.[tid]
                && !!identity
                && String(identity.status || '').trim() !== 'committed';
        } catch (e) {
            return false;
        }
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
            task = globalThis.__tmTaskBoundary?.getTask?.(id) || null;
        });
        aliases.forEach((id) => {
            if (task) return;
            task = (Array.isArray(state.filteredTasks) ? state.filteredTasks : [])
                .find((item) => String(item?.id || '').trim() === id) || null;
        });
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
            const walkTaskTree = (tasks) => {
                for (const task of (Array.isArray(tasks) ? tasks : [])) {
                    if (parentIds.has(String(task?.id || '').trim())) {
                        attachOne(task);
                        return true;
                    }
                    if (walkTaskTree(task?.children)) return true;
                }
                return false;
            };
            for (const doc of (Array.isArray(state.taskTree) ? state.taskTree : [])) {
                if (walkTaskTree(doc?.tasks)) break;
            }
        } catch (e) {}
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
        try {
            return globalThis.__tmTaskStore?.patchLocal?.(tid, nextPatch, { source }) === true;
        } catch (e) {
            return false;
        }
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

    function __tmCompareTasksBySiblingRankMap(a, b, rankMap = null) {
        const ranks = rankMap instanceof Map ? rankMap : null;
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
    }

    function __tmSortTaskTreeBySiblingRankMap(tasks, rankMap = null) {
        const ranks = rankMap instanceof Map ? rankMap : null;
        const list = Array.isArray(tasks) ? tasks : [];
        list.sort((a, b) => __tmCompareTasksBySiblingRankMap(a, b, ranks));
        list.forEach((task) => {
            if (Array.isArray(task?.children) && task.children.length > 0) {
                __tmSortTaskTreeBySiblingRankMap(task.children, ranks);
            }
        });
        return list;
    }

    function __tmSortTaskTreeByExistingOrder(tasks, previousTasks, rankMap = null) {
        const list = Array.isArray(tasks) ? tasks : [];
        const previousList = Array.isArray(previousTasks) ? previousTasks : [];
        const ranks = rankMap instanceof Map ? rankMap : null;
        const previousById = new Map();
        const previousRankById = new Map();
        previousList.forEach((task, index) => {
            const taskId = String(task?.id || '').trim();
            if (!taskId || previousRankById.has(taskId)) return;
            previousRankById.set(taskId, index);
            previousById.set(taskId, task);
        });
        const currentIds = new Set(list.map((task) => String(task?.id || '').trim()).filter(Boolean));
        const hasSameSiblingIds = list.length === previousList.length
            && currentIds.size === list.length
            && previousRankById.size === previousList.length
            && Array.from(currentIds).every((taskId) => previousRankById.has(taskId));
        if (hasSameSiblingIds) {
            list.sort((a, b) => {
                const rankA = previousRankById.get(String(a?.id || '').trim());
                const rankB = previousRankById.get(String(b?.id || '').trim());
                return rankA - rankB;
            });
        } else {
            list.sort((a, b) => __tmCompareTasksBySiblingRankMap(a, b, ranks));
        }
        list.forEach((task) => {
            const taskId = String(task?.id || '').trim();
            const previousTask = taskId ? previousById.get(taskId) : null;
            if (Array.isArray(task?.children) && task.children.length > 0) {
                __tmSortTaskTreeByExistingOrder(task.children, previousTask?.children, ranks);
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
        if (opts.preserveCollapsed !== true) {
            try { state.collapsedTaskIds?.delete?.(pid); } catch (e) {}
            try { state.collapsedTaskIds?.delete?.(resolvedPid); } catch (e) {}
        }
        return true;
    }

    function __tmIsDocInCurrentTaskScope(docId) {
        const did = String(docId || '').trim();
        if (!did) return false;
        const loadedDocIds = Array.isArray(state.__tmLoadedDocIdsForTasks)
            ? state.__tmLoadedDocIdsForTasks
            : [];
        if (loadedDocIds.length > 0) {
            return loadedDocIds.some((id) => String(id || '').trim() === did);
        }
        return (Array.isArray(state.taskTree) ? state.taskTree : [])
            .some((doc) => String(doc?.id || '').trim() === did);
    }

    function __tmShouldIsolateCalendarTaskCreateRefresh() {
        if (String(state.viewMode || '').trim() === 'calendar') return true;
        try {
            return typeof __tmHasMountedCalendarSideDock === 'function' && __tmHasMountedCalendarSideDock();
        } catch (e) {
            return false;
        }
    }

    function __tmSyncCommittedCreatedTaskDateInCalendar(taskId) {
        const tid = String(taskId || '').trim();
        const isolateCalendarRefresh = __tmShouldIsolateCalendarTaskCreateRefresh();
        const mainCalendarActive = String(state.viewMode || '').trim() === 'calendar';
        const calendarSideDockVisible = !mainCalendarActive
            && typeof __tmHasMountedCalendarSideDock === 'function'
            && __tmHasMountedCalendarSideDock();
        if (!tid || !isolateCalendarRefresh) return false;
        const task = globalThis.__tmTaskBoundary?.getTask?.(tid);
        if (!task) return false;
        try { window.__tmCalendarAllTasksCache = null; } catch (e) {}
        try {
            const calendarApi = globalThis.__tmCalendar;
            if (typeof calendarApi?.syncTaskDatePatchInPlace !== 'function') return false;
            calendarApi.syncTaskDatePatchInPlace(tid, {
                startDate: String(task.startDate || task.start_date || '').trim(),
                completionTime: String(task.completionTime || task.completion_time || '').trim(),
                taskDateColor: String(task.taskDateColor || task.task_date_color || '').trim(),
            }, {
                main: mainCalendarActive,
                side: calendarSideDockVisible,
                allowAdd: true,
                sideSourceRefresh: false,
                reason: 'task-create-commit-date-patch',
            });
            return true;
        } catch (e) {
            return false;
        }
    }

    function __tmGetMoveTargetHeadingMeta(payload = {}) {
        const targetTask = globalThis.__tmTaskBoundary?.getTask?.(String(payload.targetTaskId || '').trim()) || null;
        const rank0 = Number(payload.targetHeadingRank);
        return {
            h2Id: String(payload.targetHeadingId || targetTask?.h2Id || '').trim(),
            h2: String(payload.targetHeading || targetTask?.h2 || '').trim(),
            h2Rank: Number.isFinite(rank0) ? rank0 : Number(targetTask?.h2Rank),
        };
    }

    function __tmGetQuickAddVisibleOptionCustomFieldDefs(docId = state?.quickAdd?.docId) {
        const targetDocId = String(docId || '').trim();
        const defs = __tmGetCustomFieldDefs().filter((field) => {
            const type = String(field?.type || '').trim();
            return field?.enabled !== false
                && __tmIsCustomFieldApplicableToDoc(field, targetDocId)
                && type !== 'text'
                && Array.isArray(field?.options)
                && field.options.some((option) => String(option?.id || '').trim());
        });
        if (!defs.length) return [];
        const order = Array.isArray(SettingsStore?.data?.columnOrder)
            ? SettingsStore.data.columnOrder
            : __tmGetDefaultColumnOrder();
        const visibleKeys = new Set(
            (Array.isArray(order) ? order : [])
                .map((key) => String(key || '').trim())
                .filter(Boolean)
        );
        if (!visibleKeys.size) return [];
        return defs.filter((field) => visibleKeys.has(__tmBuildCustomFieldColumnKey(field?.id)));
    }

    async function __tmRefreshQuickAddCustomFieldScope(docId = '') {
        try {
            if (typeof __tmRefreshCustomFieldScopeMembership === 'function') {
                await __tmRefreshCustomFieldScopeMembership();
            }
        } catch (e) {}
        return __tmGetQuickAddVisibleOptionCustomFieldDefs(docId);
    }

    function __tmNormalizeQuickAddCustomFieldValues(input) {
        const fields = __tmGetQuickAddVisibleOptionCustomFieldDefs();
        if (typeof __tmNormalizeCreateTaskCustomFieldValues === 'function') {
            return __tmNormalizeCreateTaskCustomFieldValues(input, { customFieldDefs: fields });
        }
        return {};
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
        const customFieldValues = typeof __tmNormalizeCreateTaskCustomFieldValues === 'function'
            ? __tmNormalizeCreateTaskCustomFieldValues(payload.customFieldValues)
            : {};
        let repeatPatch = null;
        if (payload.repeatRule && typeof payload.repeatRule === 'object' && typeof __tmBuildTaskRepeatRuleMetaPatch === 'function') {
            try {
                repeatPatch = __tmBuildTaskRepeatRuleMetaPatch({
                    startDate: String(payload.startDate || '').trim(),
                    completionTime: String(payload.completionTime || '').trim(),
                    repeatRule: '',
                    repeatState: payload.repeatState,
                }, payload.repeatRule);
            } catch (e) {}
        }
        const optimisticStartDate = String(repeatPatch?.startDate || payload.startDate || '').trim();
        const optimisticCompletionTime = String(repeatPatch?.completionTime || payload.completionTime || '').trim();
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
            startDate: optimisticStartDate,
            start_date: optimisticStartDate,
            completionTime: optimisticCompletionTime,
            completion_time: optimisticCompletionTime,
            customTime: '',
            customStatus: String(payload.customStatus || '').trim(),
            customFieldValues,
            repeatRule: repeatPatch?.repeatRule || __tmNormalizeTaskRepeatRule(''),
            repeat_rule: repeatPatch?.repeatRule || __tmNormalizeTaskRepeatRule(''),
            repeatState: repeatPatch?.repeatState || __tmNormalizeTaskRepeatState(payload.repeatState),
            repeat_state: repeatPatch?.repeatState || __tmNormalizeTaskRepeatState(payload.repeatState),
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
        const projectIntoCurrentScope = __tmIsDocInCurrentTaskScope(docId);
        if (projectIntoCurrentScope) {
            __tmInsertTaskIntoDocLocal(nextTask, {
                atTop: payload.atTop === true,
                insertBeforeId: String(payload.insertBeforeId || '').trim(),
                insertAfterId: String(payload.insertAfterId || '').trim(),
            });
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
            try { __tmRecomputeTaskProjection({ reason: 'local-task-remove' }); } catch (e) {}
        }
        return removed;
    }

    function __tmCommitOptimisticTaskId(tempId, realId, options = {}) {
        const tmp = String(tempId || '').trim();
        const rid = String(realId || '').trim();
        if (!tmp || !rid || tmp === rid) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        try { __tmRememberOptimisticTaskIdRemap(tmp, rid); } catch (e) {}
        try { __tmTransferVisibleDateFallbackTaskId(tmp, rid); } catch (e) {}
        const wasDeletedBeforeCommit = __tmIsPendingDeletedTaskId(tmp) || __tmIsPendingDeletedTaskId(rid);
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
        try { __tmSyncCommittedCreatedTaskDateInCalendar(rid); } catch (e) {}
        try {
            ['detailTaskId', 'kanbanDetailTaskId', 'kanbanDetailAnchorTaskId', 'timerFocusTaskId'].forEach((key) => {
                if (String(state[key] || '').trim() === tmp) state[key] = rid;
            });
        } catch (e) {}
        try {
            const task = globalThis.__tmTaskBoundary?.getTask?.(rid) || null;
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
            }, {
                applyLocal: false,
            });
        } catch (e) {}
        try {
            const task = globalThis.__tmTaskBoundary?.getTask?.(rid) || null;
            __tmRefreshCommittedOptimisticTaskScore(rid, { parentTaskId: task?.parentTaskId || '' }).catch(() => null);
        } catch (e) {}
        return true;
    }

    async function __tmRefreshCommittedOptimisticTaskScore(taskId, options = {}) {
        const tid = String(taskId || '').trim();
        if (!tid) return null;
        if (__tmIsPendingDeletedTaskId(tid)) return null;
        const opts = (options && typeof options === 'object') ? options : {};
        let latest = null;
        try { latest = await __tmBuildTaskLikeFromBlockId(tid); } catch (e) { latest = null; }
        const local = globalThis.__tmTaskBoundary?.getTask?.(tid) || null;
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
            const parent = parentTaskId ? (globalThis.__tmTaskBoundary?.getTask?.(parentTaskId) || null) : null;
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
            foundTask = globalThis.__tmTaskBoundary?.getTask?.(tid) || null;
            if (foundTask && typeof foundTask === 'object') {
                parentTaskId = String(foundTask.parentTaskId || foundTask.parent_task_id || '').trim();
                docId = String(foundTask.docId || foundTask.root_id || '').trim();
                if (parentTaskId) {
                    const parent = globalThis.__tmTaskBoundary?.getTask?.(parentTaskId) || null;
                    if (Array.isArray(parent?.children)) {
                        index = parent.children.findIndex((item) => String(item?.id || '').trim() === tid);
                    }
                }
            }
        }
        if (!foundTask) return null;
        return {
            task: foundTask,
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
        const rootTaskId = String(opts.rootTaskId || '').trim();
        const store = __tmEnsurePendingDeletedTaskStore();
        const ids = Array.isArray(taskIds) ? taskIds : [taskIds];
        ids.forEach((id) => {
            const tid = String(id || '').trim();
            if (!tid) return;
            store[tid] = {
                taskId: tid,
                rootTaskId: rootTaskId || tid,
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
        const ids = new Set((Array.isArray(taskIds) ? taskIds : [taskIds])
            .map((id) => String(id || '').trim())
            .filter(Boolean));
        Object.keys(store).forEach((key) => {
            const taskId = String(key || '').trim();
            const rootTaskId = String(store[key]?.rootTaskId || '').trim();
            if (!ids.has(taskId) && !ids.has(rootTaskId)) return;
            try { delete store[key]; } catch (e) {}
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
            `.tm-task-detail-subtask-row[data-tm-detail-subtask-menu="${escId}"]`,
            `.tm-task-detail-subtask [data-tm-detail-subtask-content="${escId}"]`,
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
                '.tm-task-detail-subtask,.tm-checklist-item,.tm-kanban-card,.tm-whiteboard-stream-task-node,.tm-whiteboard-node,.tm-whiteboard-pool-item,tr,[data-id],[data-task-id]'
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
            __tmRememberPendingDeletedTaskIds(ids, {
                source: 'task-delete-optimistic',
                rootTaskId: tid,
            });
            const calendarApi = globalThis.__tmCalendar;
            if (calendarApi && typeof calendarApi.removeTaskDateEventsByTaskIds === 'function') {
                calendarApi.removeTaskDateEventsByTaskIds(ids, {
                    main: true,
                    side: true,
                    source: 'task-delete-optimistic',
                });
            }
        } catch (e) {}
        if (!deletedIds.length) {
            __tmRememberPendingDeletedTaskIds(tid, {
                source: 'task-delete-optimistic',
                rootTaskId: tid,
            });
        }
        if (SettingsStore.data.deleteTaskRemovesWhiteboardCards !== false) {
            try {
                __tmDeleteWhiteboardSnapshotTasks(deletedIds.length ? deletedIds : [tid]);
            } catch (e) {}
        }
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
            const parent = globalThis.__tmTaskBoundary?.getTask?.(String(snap.parentTaskId || '').trim()) || null;
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
            try { __tmRecomputeTaskProjection({ reason: 'local-task-upsert' }); } catch (e) {}
            try { __tmScheduleRender({ withFilters: true }); } catch (e) {}
        }
        try {
            const calendarApi = globalThis.__tmCalendar;
            if (calendarApi && typeof calendarApi.syncTaskDateInPlace === 'function') {
                const main = String(state.viewMode || '').trim() === 'calendar';
                const side = typeof __tmShouldShowCalendarSideDock === 'function'
                    ? __tmShouldShowCalendarSideDock()
                    : !main;
                Promise.resolve(calendarApi.syncTaskDateInPlace(taskId, {
                    main,
                    side,
                    allowRefetch: false,
                }))
                    .then((summary) => {
                        if ((summary?.needsMainRefresh || summary?.needsSideRefresh) && typeof calendarApi.requestRefresh === 'function') {
                            calendarApi.requestRefresh({
                                reason: 'task-delete-rollback',
                                main: main && summary.needsMainRefresh,
                                side: side && summary.needsSideRefresh,
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

    function __tmApplyDoneStateToLocalMirrors(taskId, task, done, markerInput = null, markdownInput = null) {
        const tid = String(taskId || '').trim();
        const target = (task && typeof task === 'object') ? task : null;
        const marker = markerInput == null
            ? (done ? 'X' : ' ')
            : __tmNormalizeTaskStatusMarker(markerInput, done ? 'X' : ' ');
        const markdown = typeof markdownInput === 'string'
            ? markdownInput
            : __tmBuildTaskMarkdownWithMarker(target, marker);
        const patch = {
            done: !!done,
            taskMarker: marker,
            task_marker: marker,
            markdown,
        };
        try { __tmApplyQueuedTaskFieldPatchToTask(target, patch); } catch (e) {}
        try { __tmApplyTaskFieldPatchToLocalMirrors(tid, patch); } catch (e) {}
        return patch;
    }

    function __tmApplyDoneOptimisticLocal(taskId, done, statusPatch = null, source = '', options = {}) {
        const tid = String(taskId || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        const task = globalThis.__tmTaskBoundary?.getTask?.(tid);
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
        let targetMarker = null;
        const targetStatusId = String(nextStatusPatch?.customStatus || '').trim();
        if (targetStatusId) {
            const targetStatus = __tmFindStatusOptionById(targetStatusId);
            if (targetStatus) {
                targetMarker = __tmNormalizeCompatTaskStatusMarker(
                    targetStatus.marker,
                    __tmGuessStatusOptionDefaultMarker(targetStatus),
                );
            }
        }
        const doneStatePatch = __tmApplyDoneStateToLocalMirrors(tid, task, done, targetMarker);
        try {
            if (!state.doneOverrides || typeof state.doneOverrides !== 'object') state.doneOverrides = {};
            state.doneOverrides[tid] = !!done;
        } catch (e) {}
        try { MetaStore.set(tid, { ...doneStatePatch, content: task.content }); } catch (e) {}
        try { __tmSyncTaskDetailSubtaskDoneInDOM(tid, !!done); } catch (e) {}
        try {
            __tmScheduleTaskSnapshotAfterLocalPatch?.(tid, {
                ...((retentionPatch && typeof retentionPatch === 'object') ? retentionPatch : {}),
                ...doneStatePatch,
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
        const task = globalThis.__tmTaskBoundary?.getTask?.(tid);
        if (!task) return false;
        const prevPatch = (inversePatch && typeof inversePatch === 'object' && !Array.isArray(inversePatch)) ? inversePatch : {};
        const prevDone = !!(Object.prototype.hasOwnProperty.call(prevPatch, 'done') ? prevPatch.done : task.done);
        const prevStatusPatch = { ...prevPatch };
        delete prevStatusPatch.done;
        if (Object.keys(prevStatusPatch).length > 0) {
            __tmRollbackAttrPatchLocally(tid, prevStatusPatch, { render: false, withFilters: true });
        }
        const doneStatePatch = __tmApplyDoneStateToLocalMirrors(
            tid,
            task,
            prevDone,
            opts.previousMarker,
            typeof opts.previousMarkdown === 'string' ? opts.previousMarkdown : null,
        );
        try {
            if (!state.doneOverrides || typeof state.doneOverrides !== 'object') state.doneOverrides = {};
            state.doneOverrides[tid] = prevDone;
        } catch (e) {}
        try { MetaStore.set(tid, { ...doneStatePatch, content: task.content }); } catch (e) {}
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

    function __tmResetMovedTaskAttrHostProjection(task, parentType = '') {
        const nextTask = (task && typeof task === 'object') ? task : null;
        if (!nextTask) return;
        const taskId = String(nextTask.id || nextTask.blockId || '').trim();
        try { delete nextTask.__tmTaskAttrContext; } catch (e) {}
        try { delete nextTask.__tmPreferSelfAttrHostValues; } catch (e) {}
        try { delete nextTask.__tmPreferSelfAttrHostId; } catch (e) {}
        nextTask.attrHostId = taskId;
        nextTask.attr_host_id = taskId;
        nextTask.parentListType = String(parentType || '').trim().toLowerCase();
        nextTask.parent_list_type = nextTask.parentListType;
        nextTask.parentListTaskCount = Number.NaN;
        nextTask.parent_list_task_count = Number.NaN;
        nextTask.parentTaskCount = Number.NaN;
        nextTask.parent_task_count = Number.NaN;
        nextTask.siblingTaskCount = Number.NaN;
        nextTask.firstTaskId = '';
        nextTask.first_task_id = '';
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
            const projectedParentType = (mode === 'child' || mode === 'child-top')
                ? (String(payload.targetChildListId || '').trim() ? 'l' : 'i')
                : '';
            __tmResetMovedTaskAttrHostProjection(nextTask, projectedParentType);
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
            const targetListId = String(patch.targetListId || '').trim();
            if (targetListId) nextTask.parent_id = nextTask.parentId = targetListId;
            __tmResetMovedTaskAttrHostProjection(nextTask);
            return true;
        }
        if (mode === 'docTop' || mode === 'docBottom') {
            nextTask.h2Id = '';
            nextTask.h2 = '';
            nextTask.h2Rank = Number.NaN;
            nextTask.parentTaskId = '';
            nextTask.parent_task_id = '';
            const targetListId = String(patch.targetListId || '').trim();
            if (targetListId) nextTask.parent_id = nextTask.parentId = targetListId;
            __tmResetMovedTaskAttrHostProjection(nextTask);
            return true;
        }
        const targetParentTaskId = String(patch.targetParentTaskId || '').trim();
        if (mode === 'before' || mode === 'after') {
            nextTask.parentTaskId = targetParentTaskId;
            nextTask.parent_task_id = targetParentTaskId;
            const targetListId = String(patch.targetListId || '').trim();
            if (targetListId) nextTask.parent_id = nextTask.parentId = targetListId;
            __tmResetMovedTaskAttrHostProjection(nextTask);
        } else if (mode === 'child' || mode === 'child-top') {
            const targetTaskId = String(patch.targetTaskId || '').trim();
            if (targetTaskId) {
                nextTask.parentTaskId = targetTaskId;
                nextTask.parent_task_id = targetTaskId;
                const targetChildListId = String(patch.targetChildListId || '').trim();
                nextTask.parent_id = nextTask.parentId = targetChildListId || targetTaskId;
                __tmResetMovedTaskAttrHostProjection(nextTask, targetChildListId ? 'l' : 'i');
            }
        }
        return true;
    }

    function __tmCloneTaskTreeForMove(task) {
        if (!task || typeof task !== 'object') return task;
        const clone = { ...task };
        if (Array.isArray(task.children)) {
            clone.children = task.children.map((child) => __tmCloneTaskTreeForMove(child));
        }
        return clone;
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
        const nextTask = __tmCloneTaskTreeForMove(task);
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
                preserveCollapsed: payload?.preserveTargetCollapse === true,
            });
        } else if (mode === 'child') {
            inserted = __tmInsertTaskAsChildLocal(nextTask, payload?.targetTaskId, {
                atTop: String(payload?.targetLastDirectChildId || '').trim() ? false : true,
                preservePending,
                preserveCollapsed: payload?.preserveTargetCollapse === true,
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

    async function __tmCreateTaskInDocKernel({ docId, content, priority, startDate, completionTime, pinned, customStatus, customFieldValues, atTop, appendToBottom, insertParentId, insertBeforeId, insertAfterId, targetHeadingId = '', targetHeading = '', targetHeadingRank, h2Id = '', h2 = '', h2Rank, requestedTaskId = '', requestedContainerId = '', initialAttrs = null, localInsert = true, scheduleSnapshotRefresh = true, backgroundCreateAttrs = false, deferCreateAttrs = false, deferResolveInsertedTaskId = false, onInserted = null, onBlockInserted = null } = {}) {
        const parentDocId = String(docId || '').trim();
        let targetParentId = String(insertParentId || parentDocId).trim() || parentDocId;
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
        const stableTaskId = String(requestedTaskId || '').trim();
        const stableContainerId = String(requestedContainerId || '').trim();

        let nextID = String(insertBeforeId || '').trim();
        let previousID = String(insertAfterId || '').trim();
        let appendAtBottom = appendToBottom === true;
        let columnHeadingId = '';
        const headingAnchorId = String(targetHeadingId || h2Id || '').trim();
        if (headingAnchorId) {
            try {
                const structure = await __tmResolveLiveHeadingInsertStructure(headingAnchorId, targetParentId);
                if (structure.parentID && structure.parentID !== targetParentId) {
                    targetParentId = structure.parentID;
                    nextID = '';
                    previousID = '';
                    appendAtBottom = true;
                }
                if (structure.layout === 'col') {
                    targetParentId = structure.parentID || targetParentId;
                    columnHeadingId = headingAnchorId;
                    nextID = '';
                    previousID = '';
                    appendAtBottom = false;
                }
            } catch (e) {}
        }
        if (!nextID && atTop) {
            try { nextID = String(await API.getFirstDirectChildIdOfDoc(parentDocId) || '').trim(); } catch (e) { nextID = ''; }
        }
        const placement = nextID || (previousID ? { previousID, parentID: targetParentId } : undefined);
        const alreadyInserted = !columnHeadingId && stableTaskId && await __tmIsTaskListItemBlockId(stableTaskId);
        const useStableDom = !!stableTaskId;
        const blockData = useStableDom
            ? API.generateTaskDOM(stableTaskId, text, __tmIsTaskMarkerDone(initialMarker), { attrs: initialAttrs })
            : md;
        const blockOptions = useStableDom ? { dataType: 'dom', requestedID: stableTaskId } : {};
        const insertedId = alreadyInserted
            ? stableTaskId
            : (columnHeadingId
                ? await __tmInsertTaskBelowColumnHeading(targetParentId, columnHeadingId, md, {
                    requestedTaskId: stableTaskId,
                    requestedContainerId: stableContainerId,
                    content: text,
                    done: __tmIsTaskMarkerDone(initialMarker),
                    attrs: initialAttrs,
                })
                : (appendAtBottom && !atTop && !nextID && !previousID
                    ? await __tmAppendBlockOnce(targetParentId, blockData, blockOptions)
                    : await __tmInsertBlockOnce(targetParentId, blockData, placement, blockOptions)));
        try {
            if (typeof onBlockInserted === 'function') {
                await Promise.resolve(onBlockInserted({ insertedId, docId: parentDocId, insertParentId: targetParentId, insertBeforeId: nextID || '', insertAfterId: previousID || '' }));
            }
        } catch (e) {}
        // Stable DOM creation already knows the task block ID. Legacy Markdown
        // callers resolve an outer list ID before continuing.
        let taskId = useStableDom ? stableTaskId : insertedId;
        if (!useStableDom && deferResolveInsertedTaskId !== true) {
            taskId = await __tmResolveInsertedTaskBlockId(insertedId);
        }
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
        const normalizedCustomFieldValues = typeof __tmNormalizeCreateTaskCustomFieldValues === 'function'
            ? __tmNormalizeCreateTaskCustomFieldValues(customFieldValues)
            : {};
        if (Object.keys(normalizedCustomFieldValues).length) patch.customFieldValues = normalizedCustomFieldValues;
        const headingPatch = {
            h2: __tmNormalizeHeadingText(targetHeading || h2 || ''),
            h2Id: String(targetHeadingId || h2Id || '').trim(),
            h2Rank: Number.isFinite(Number(targetHeadingRank)) ? Number(targetHeadingRank) : (Number.isFinite(Number(h2Rank)) ? Number(h2Rank) : Number.NaN),
            h2Path: '',
            h2Sort: Number.NaN,
            h2Created: '',
        };
        if (Object.keys(patch).length > 0 && deferCreateAttrs !== true) {
            taskId = await __tmPersistNewTaskAttrsOnce(taskId, patch, async () => await __tmResolveInsertedTaskBlockId(insertedId), {
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
            customFieldValues: patch.customFieldValues ? { ...patch.customFieldValues } : {},
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
            try { __tmRecomputeTaskProjection({ reason: 'quick-add-local-insert' }); } catch (e) {}
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
            let createSettled = [];
            const createTaskInDoc = globalThis.__tmRequireTaskMutation?.('createTaskInDoc');
            if (typeof createTaskInDoc !== 'function') throw new Error('任务写入队列未就绪: createTaskInDoc');
            if (hid && hid !== '__none__') {
                const placement = await __tmResolveHeadingGroupInsertPlacement(did, hid, SettingsStore.data.taskHeadingLevel || 'h2');
                if (placement.matched) {
                    const headingPatch = __tmBuildHeadingPatchFromPlacement(placement);
                    const insertBeforeId = useSectionEnd ? String(placement.nextID || '').trim() : '';
                    const insertAfterId = useSectionEnd ? '' : String(placement.insertAfterID || hid || '').trim();
                    const appendToBottom = useSectionEnd && placement.appendToBottom === true;
                    const orderedLines = insertAfterId ? taskLines.slice().reverse() : taskLines;
                    createSettled = await Promise.allSettled(orderedLines.map((line) => createTaskInDoc({
                            docId: did,
                            content: line,
                            insertParentId: String(placement.parentID || did).trim(),
                            insertBeforeId,
                            insertAfterId,
                            appendToBottom,
                            targetHeadingId: headingPatch?.h2Id || '',
                            targetHeading: headingPatch?.h2 || '',
                            targetHeadingRank: Number(headingPatch?.h2Rank),
                            wait: true,
                            showErrorHint: false,
                        }).then((taskId) => {
                            createdTaskIds.push(taskId);
                            try {
                                if (headingPatch) __tmApplyHeadingPatchToTaskLocal(taskId, headingPatch, 'heading-create-task-local');
                            } catch (e) {}
                            return taskId;
                        })));
                }
            }
            if (createSettled.length === 0) {
                createSettled = await Promise.allSettled(taskLines.slice().reverse().map((line) => createTaskInDoc({
                        docId: did,
                        content: line,
                        atTop: true,
                        wait: true,
                        showErrorHint: false,
                    }).then((taskId) => {
                        createdTaskIds.push(taskId);
                        try {
                            if (!hid || hid === '__none__') {
                                const task = state.pendingInsertedTasks?.[String(taskId || '').trim()];
                                if (task) {
                                    task.h2 = '';
                                    task.h2Id = '';
                                    globalThis.__tmTaskStore?.patchPending?.(taskId, { h2: '', h2Id: '' }, { source: 'heading-create-clear-pending-heading' });
                                }
                            }
                        } catch (e) {}
                        return taskId;
                    })));
            }
            createdTaskIds.forEach((taskId) => {
                try {
                    const pendingTask = state.pendingInsertedTasks?.[String(taskId || '').trim()];
                    if (pendingTask) __tmUpsertLocalTask(pendingTask);
                } catch (e) {}
            });
            const createFailures = createSettled.filter((item) => item.status === 'rejected');
            if (createFailures.length > 0) {
                const firstError = createFailures[0]?.reason;
                if (createdTaskIds.length === 0) {
                    throw firstError instanceof Error ? firstError : new Error(String(firstError || '任务创建失败'));
                }
                const message = String(firstError?.message || firstError || '').trim();
                hint(`⚠ 已创建 ${createdTaskIds.length} 个任务，${createFailures.length} 个失败${message ? `: ${message}` : ''}`, 'warning');
                return;
            }
            hint(taskLines.length > 1 ? `✅ 已创建 ${taskLines.length} 个任务` : '✅ 任务已创建', 'success');
        } catch (e) {
            hint(`❌ 新建任务失败: ${e.message}`, 'error');
        }
    };

    async function __tmAppendBlockOnce(parentId, data, options = {}) {
        const targetParentId = String(parentId || '').trim();
        const blockData = String(data || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        if (!targetParentId) throw new Error('未找到目标块');
        if (!blockData) throw new Error('内容为空');
        return await __tmBackendAdapter.appendBlock(targetParentId, blockData, {
            dataType: opts.dataType,
            requestedID: opts.requestedID,
        });
    }

    async function __tmInsertBlockOnce(parentId, data, placement, options = {}) {
        const targetParentId = String(parentId || '').trim();
        const blockData = String(data || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        if (!targetParentId) throw new Error('未找到目标块');
        if (!blockData) throw new Error('内容为空');
        return await __tmBackendAdapter.insertBlock(targetParentId, blockData, placement, {
            dataType: opts.dataType,
            requestedID: opts.requestedID,
        });
    }

    async function __tmResolveLiveHeadingInsertStructure(headingId, fallbackParentId) {
        const hid = String(headingId || '').trim();
        const fallback = String(fallbackParentId || '').trim();
        if (!hid) return { parentID: fallback, layout: '' };
        let parentID = fallback;
        try {
            const rows = await API.getBlocksByIds([hid]);
            const headingRow = (Array.isArray(rows) ? rows : []).find((row) => String(row?.id || '').trim() === hid);
            parentID = String(headingRow?.parent_id || fallback).trim() || fallback;
        } catch (e) {}
        if (!parentID) return { parentID: '', layout: '' };
        let layout = '';
        try {
            const parentRows = await API.getBlocksByIds([parentID]);
            const parentRow = (Array.isArray(parentRows) ? parentRows : []).find((row) => String(row?.id || '').trim() === parentID);
            if (String(parentRow?.type || '').trim() !== 's') return { parentID, layout };
            const km = String(await API.getBlockKramdown(parentID) || '');
            if (/^\s*\{\{\{\s*col(?:\s|$)/i.test(km)) layout = 'col';
            else if (/^\s*\{\{\{\s*row(?:\s|$)/i.test(km)) layout = 'row';
        } catch (e) {}
        return { parentID, layout };
    }

    async function __tmInsertTaskBelowColumnHeading(columnParentId, headingId, md, options = {}) {
        const parentID = String(columnParentId || '').trim();
        const hid = String(headingId || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        const requestedTaskId = String(opts.requestedTaskId || '').trim();
        const requestedContainerId = String(opts.requestedContainerId || '').trim();
        let wrapperID = '';
        if (!parentID || !hid) throw new Error('未找到超级块目标标题');
        try {
            if (requestedContainerId) {
                try {
                    const rows = await API.getBlocksByIds([requestedContainerId]);
                    const row = (Array.isArray(rows) ? rows : []).find((item) => String(item?.id || '').trim() === requestedContainerId);
                    if (String(row?.type || '').trim() === 's') wrapperID = requestedContainerId;
                } catch (e) {}
            }
            if (!wrapperID) {
                const wrapperData = requestedTaskId && requestedContainerId
                    ? `<div data-node-id="${requestedContainerId}" data-type="NodeSuperBlock" class="sb" data-sb-layout="row">
${API.generateTaskDOM(requestedTaskId, opts.content, opts.done === true, { attrs: opts.attrs })}
<div class="protyle-attr" contenteditable="false"></div>
</div>`
                    : `{{{row\n${md}\n}}}`;
                const insertedID = String(await __tmInsertBlockOnce(
                    parentID,
                    wrapperData,
                    hid,
                    {
                        ...(requestedContainerId ? { dataType: 'dom', requestedID: requestedContainerId } : {}),
                    }
                ) || '').trim();
                if (!insertedID) throw new Error('创建超级块列容器失败');
                wrapperID = requestedContainerId || insertedID;
            }
            try {
                const rows = await API.getBlocksByIds([wrapperID]);
                const insertedRow = (Array.isArray(rows) ? rows : []).find((row) => String(row?.id || '').trim() === wrapperID);
                if (String(insertedRow?.type || '').trim() !== 's') {
                    wrapperID = String(insertedRow?.parent_id || wrapperID).trim() || wrapperID;
                }
            } catch (e) {}
            let firstChildID = '';
            for (const delay of [0, 80, 180, 360]) {
                if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
                const children = await API.getChildBlocks(wrapperID).catch(() => []);
                firstChildID = String((Array.isArray(children) ? children : []).find((child) => String(child?.id || '').trim())?.id || '').trim();
                if (firstChildID) break;
            }
            if (!firstChildID) throw new Error('未找到超级块列内的新任务');
            let headingMoved = false;
            try {
                const rows = await API.getBlocksByIds([hid]);
                headingMoved = String(rows?.[0]?.parent_id || '').trim() === wrapperID;
            } catch (e) {}
            if (!headingMoved) {
                await __tmBackendAdapter.moveBlock(hid, { nextID: firstChildID, parentID: wrapperID });
            }
            return wrapperID;
        } catch (e) {
            if (wrapperID) {
                let headingMoved = false;
                try {
                    const rows = await API.getBlocksByIds([hid]);
                    headingMoved = String(rows?.[0]?.parent_id || '').trim() === wrapperID;
                } catch (e2) {}
                if (headingMoved) return wrapperID;
                try { await __tmBackendAdapter.deleteBlock(wrapperID); } catch (e2) {}
            }
            throw e;
        }
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
        const stableTaskId = String(opts.requestedTaskId || '').trim();
        let childListId = String(opts.requestedContainerId || '').trim();
        if (!childListId) {
            try {
                const directChildren = await API.getChildBlocks(pid);
                const childLists = (Array.isArray(directChildren) ? directChildren : []).filter((block) => (
                    String(block?.id || '').trim()
                    && String(block?.type || '').trim().toLowerCase() === 'l'
                ));
                childListId = String(childLists[childLists.length - 1]?.id || '').trim();
            } catch (e) {}
        }
        if (!childListId) {
            try { childListId = String(await API.getChildListIdOfTask(pid) || '').trim(); } catch (e) { childListId = ''; }
        }
        const alreadyInserted = stableTaskId && await __tmIsTaskListItemBlockId(stableTaskId);
        let insertedId = stableTaskId || '';
        if (!alreadyInserted && stableTaskId) {
            const requestedListId = String(opts.requestedContainerId || '').trim() || __tmNewTaskBlockId();
            const itemData = API.generateTaskDOM(stableTaskId, text, false, {
                itemOnly: true,
                attrs: opts.initialAttrs,
            });
            const listData = API.generateTaskDOM(stableTaskId, text, false, {
                listId: childListId || requestedListId,
                attrs: opts.initialAttrs,
            });
            const createSubtask = __tmBackendAdapter?.createSubtask;
            if (typeof createSubtask !== 'function') throw new Error('内核子任务写入服务未就绪');
            const result = await createSubtask(
                pid,
                stableTaskId,
                childListId || requestedListId,
                listData,
                itemData,
                { previousTaskID: String(opts.insertAfterTaskId || '').trim() },
            );
            childListId = String(result?.listID || childListId || requestedListId).trim();
            insertedId = stableTaskId;
        } else if (!alreadyInserted && !stableTaskId) {
            insertedId = await __tmAppendBlockOnce(pid, `- [ ] ${text}`);
        }
        try {
            if (typeof opts.onBlockInserted === 'function') {
                await Promise.resolve(opts.onBlockInserted({ insertedId, docId: parentDocId, parentTaskId: pid, listId: childListId }));
            }
        } catch (e) {}
        let taskId = stableTaskId || insertedId;
        if (!stableTaskId && opts.deferResolveInsertedTaskId !== true) {
            taskId = await __tmResolveInsertedTaskBlockId(insertedId);
        }
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
            const patchTask = globalThis.__tmRequireTaskMutation?.('patchTask');
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
            globalThis.__tmTaskBoundary?.getTask?.(resolvedTid)?.parent_id
            || globalThis.__tmTaskBoundary?.getTask?.(tid)?.parent_id
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
        const rawSourceTaskId = String(taskId || '').trim();
        let authoritativeSourceTask = null;
        if (rawSourceTaskId) {
            try {
                const rows = await API.getBlocksByIds([rawSourceTaskId]);
                const row = Array.isArray(rows) ? rows[0] : null;
                if (String(row?.id || '').trim() === rawSourceTaskId
                    && String(row?.type || '').trim().toLowerCase() === 'i'
                    && String(row?.subtype || '').trim().toLowerCase() === 't') {
                    authoritativeSourceTask = row;
                }
            } catch (e) {}
        }
        const sourceInfo = authoritativeSourceTask
            ? { id: rawSourceTaskId, resolvedId: rawSourceTaskId, rawId: rawSourceTaskId, task: null }
            : __tmResolveOptimisticTaskForLocalUse(rawSourceTaskId);
        const sourceTaskId = String(sourceInfo.id || sourceInfo.resolvedId || sourceInfo.rawId || rawSourceTaskId).trim();
        const currentTask = sourceInfo.task
            || globalThis.__tmTaskBoundary?.getTask?.(sourceTaskId)
            || authoritativeSourceTask
            || null;
        if (!sourceTaskId || !currentTask) throw new Error('未找到当前任务');
        const text = String(content || '').trim();
        if (!text) throw new Error('请输入任务内容');
        const opts = (options && typeof options === 'object') ? options : {};
        const stableTaskId = String(opts.requestedTaskId || '').trim();

        const listId = await __tmResolveTaskListBlockId(sourceTaskId);
        if (!listId) throw new Error('未找到当前任务所在的任务列表');

        const currentDocId = String(currentTask.docId || currentTask.root_id || '').trim();
        const alreadyInserted = stableTaskId && await __tmIsTaskListItemBlockId(stableTaskId);
        const insertedId = alreadyInserted
            ? stableTaskId
            : await __tmInsertBlockOnce(
                listId,
                stableTaskId ? API.generateTaskDOM(stableTaskId, text, false) : `- [ ] ${text}`,
                { previousID: sourceTaskId },
                {
                    ...(stableTaskId ? { dataType: 'dom', requestedID: stableTaskId } : {}),
                }
            );
        try {
            if (typeof opts.onBlockInserted === 'function') {
                await Promise.resolve(opts.onBlockInserted({ insertedId, docId: currentDocId, sourceTaskId, listId }));
            }
        } catch (e) {}
        let nextTaskId = stableTaskId || insertedId;
        if (!stableTaskId && opts.deferResolveInsertedTaskId !== true) {
            nextTaskId = await __tmResolveInsertedTaskBlockId(insertedId);
        }
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

    function __tmNewTaskBlockId() {
        const createId = globalThis.Lute?.NewNodeID || globalThis.window?.Lute?.NewNodeID;
        if (typeof createId !== 'function') {
            throw new Error('当前思源版本不支持预生成块 ID，任务创建已暂停');
        }
        const id = String(createId.call(globalThis.Lute || globalThis.window?.Lute) || '').trim();
        if (!/^\d{14}-[a-z0-9]{7}$/i.test(id)) throw new Error('思源返回的预生成块 ID 无效');
        return id;
    }

    function __tmQueueCreateSubtask(parentTaskId, content, options = {}) {
        const rawPid = String(parentTaskId || '').trim();
        const parentInfo = __tmResolveOptimisticTaskForLocalUse(rawPid);
        const pid = String(parentInfo.id || parentInfo.resolvedId || rawPid).trim();
        const text = String(content || '').trim();
        if (!rawPid || !pid) throw new Error('未找到父任务');
        if (!text) throw new Error('请输入子任务内容');
        if (typeof __tmIsMutationTaskPendingDeleted === 'function' && (__tmIsMutationTaskPendingDeleted(rawPid) || __tmIsMutationTaskPendingDeleted(pid))) {
            throw new Error('父任务正在删除，无法新建子任务');
        }
        const hooks = (options && typeof options === 'object') ? options : {};
        const parentTask = parentInfo.task;
        const currentChildren = Array.isArray(parentTask?.children) ? parentTask.children : [];
        const previousChild = currentChildren.length > 0 ? currentChildren[currentChildren.length - 1] : null;
        const insertAfterTaskId = String(previousChild?.id || '').trim();
        const requestedContainerId = String(previousChild?.parent_id || previousChild?.parentId || '').trim()
            || __tmNewTaskBlockId();
        const requestedTaskId = __tmNewTaskBlockId();
        const tempId = requestedTaskId;
        const clientId = String(globalThis.__tmTaskIdentity?.createClientId?.('subtask') || __tmGenerateTempTaskId('client')).trim();
        try {
            globalThis.__tmTaskIdentity?.remember?.({
                clientId,
                tempId,
                kind: 'subtask',
                status: 'queued',
            });
        } catch (e) {}
        const docId = String(parentTask?.docId || parentTask?.root_id || '').trim();
        const inheritedPatch = __tmBuildSubtaskInheritedPatch(parentTask);
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
                requestedTaskId,
                requestedContainerId,
                insertAfterTaskId,
                content: text,
                docId,
                inheritedPatch,
                skipInteractionGate: hooks.skipInteractionGate !== false,
                suppressHint: true,
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
        if (typeof __tmIsMutationTaskPendingDeleted === 'function' && (__tmIsMutationTaskPendingDeleted(rawPid) || __tmIsMutationTaskPendingDeleted(pid))) {
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
            parent_id: String(opts.parentListId || '').trim(),
            parentId: String(opts.parentListId || '').trim(),
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
        return nextTask;
    }

    function __tmApplyOptimisticSiblingTask(sourceTaskId, siblingTaskId, content, options = {}) {
        const sid = String(sourceTaskId || '').trim();
        const tid = String(siblingTaskId || '').trim();
        const text = String(content || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        const clientId = String(opts.clientId || '').trim();
        const sourceTask = globalThis.__tmTaskBoundary?.getTask?.(sid);
        if (!sid || !tid || !text || !sourceTask) return false;
        if (typeof __tmIsMutationTaskPendingDeleted === 'function' && __tmIsMutationTaskPendingDeleted(sid)) return false;

        const parentTaskId = String(sourceTask.parentTaskId || '').trim();
        if (parentTaskId && typeof __tmIsMutationTaskPendingDeleted === 'function' && __tmIsMutationTaskPendingDeleted(parentTaskId)) return false;
        try {
            globalThis.__tmTaskIdentity?.remember?.({
                clientId,
                tempId: tid,
                kind: 'sibling',
                status: 'optimistic',
            });
        } catch (e) {}
        const parentTask = parentTaskId
            ? globalThis.__tmTaskBoundary?.getTask?.(parentTaskId)
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
        const requestedTaskId = __tmNewTaskBlockId();
        const tempId = requestedTaskId;
        const requestedContainerId = __tmNewTaskBlockId();
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
                requestedTaskId,
                requestedContainerId,
                showErrorHint: opts.showErrorHint !== false
                    && typeof hooks.onError !== 'function'
                    && typeof optsOnError !== 'function',
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
        const currentTask = globalThis.__tmTaskBoundary?.getTask?.(tid);
        if (!tid || !currentTask) throw new Error('未找到当前任务');
        if (!text) throw new Error('请输入任务内容');
        if (typeof __tmIsMutationTaskPendingDeleted === 'function' && __tmIsMutationTaskPendingDeleted(tid)) {
            throw new Error('当前任务正在删除，无法新建同级任务');
        }
        const parentTaskId = String(currentTask.parentTaskId || '').trim();
        if (parentTaskId && typeof __tmIsMutationTaskPendingDeleted === 'function' && __tmIsMutationTaskPendingDeleted(parentTaskId)) {
            throw new Error('父任务正在删除，无法新建同级任务');
        }
        const requestedTaskId = __tmNewTaskBlockId();
        const tempId = requestedTaskId;
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
                requestedTaskId,
                content: text,
                docId,
                suppressHint: true,
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
        const parentTask = globalThis.__tmTaskBoundary?.getTask?.(pid);
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
            const createSubtask = globalThis.__tmRequireTaskMutation?.('createSubtask');
            if (typeof createSubtask !== 'function') throw new Error('任务写入队列未就绪: createSubtask');
            const createSettled = await Promise.allSettled(taskLines.map((line) => createSubtask(pid, line, {
                    silent: true,
                    wait: true,
                    skipInteractionGate: true,
                })));
            const createFailures = createSettled.filter((item) => item.status === 'rejected');
            const successCount = createSettled.length - createFailures.length;
            if (createFailures.length > 0) {
                const firstError = createFailures[0]?.reason;
                if (successCount === 0) {
                    throw firstError instanceof Error ? firstError : new Error(String(firstError || '子任务创建失败'));
                }
                const message = String(firstError?.message || firstError || '').trim();
                hint(`⚠ 已新增 ${successCount} 个子任务，${createFailures.length} 个失败${message ? `: ${message}` : ''}`, 'warning');
                return;
            }
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
        const currentTask = globalThis.__tmTaskBoundary?.getTask?.(tid);
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
            await __tmQueueCreateSiblingTask(tid, nextText, {
                silent: true,
                wait: true,
                showErrorHint: false,
            });
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
                __tmScheduleSilentRefreshAfterQuickbarUpdate(500);
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

    function __tmBuildQuickAddCustomFieldButtonHtml(field, value) {
        const fieldId = String(field?.id || '').trim();
        if (!fieldId) return '';
        const fieldName = String(field?.name || fieldId).trim() || fieldId;
        const isMulti = String(field?.type || '').trim() === 'multi';
        const displayHtml = __tmBuildCustomFieldDisplayHtml(field, value, {
            emptyText: '未设置',
            maxTags: isMulti ? 2 : 1,
        });
        return `
            <button class="tm-btn tm-btn-secondary"
                    type="button"
                    data-tm-quick-add-custom-field="${esc(fieldId)}"
                    onclick="tmQuickAddOpenCustomFieldPicker('${escSq(fieldId)}', event)"
                    style="padding:6px 10px;font-size:13px;display:flex;align-items:center;gap:6px;max-width:180px;min-width:0;">
                <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(fieldName)}</span>
                <span style="display:inline-flex;align-items:center;gap:3px;min-width:0;overflow:hidden;">${displayHtml}</span>
            </button>
        `;
    }

    function __tmRenderQuickAddCustomFields() {
        const wrap = document.getElementById('tmQuickAddCustomFields');
        if (!wrap) return;
        const qa = state.quickAdd;
        const fields = __tmGetQuickAddVisibleOptionCustomFieldDefs();
        if (!qa || !fields.length) {
            wrap.innerHTML = '';
            wrap.style.display = 'none';
            return;
        }
        qa.customFieldValues = __tmNormalizeQuickAddCustomFieldValues(qa.customFieldValues || {});
        wrap.innerHTML = fields.map((field) => {
            const fieldId = String(field?.id || '').trim();
            return __tmBuildQuickAddCustomFieldButtonHtml(field, qa.customFieldValues?.[fieldId]);
        }).join('');
        wrap.style.display = wrap.innerHTML.trim() ? 'flex' : 'none';
    }

    window.tmQuickAddOpenCustomFieldPicker = function(fieldId, ev) {
        const qa = state.quickAdd;
        const fid = String(fieldId || '').trim();
        const field = __tmGetQuickAddVisibleOptionCustomFieldDefs()
            .find((item) => String(item?.id || '').trim() === fid);
        const escapedFieldId = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
            ? CSS.escape(fid)
            : fid.replace(/["\\]/g, '\\$&');
        const btn = ev?.currentTarget instanceof HTMLElement
            ? ev.currentTarget
            : document.querySelector(`[data-tm-quick-add-custom-field="${escapedFieldId}"]`);
        try {
            ev?.preventDefault?.();
            ev?.stopPropagation?.();
        } catch (e) {}
        if (!qa || !field || !(btn instanceof HTMLElement)) return;
        const isMulti = String(field?.type || '').trim() === 'multi';
        const current = __tmNormalizeCustomFieldValue(field, qa.customFieldValues?.[fid]);
        const draft = new Set(Array.isArray(current) ? current : (String(current || '').trim() ? [String(current || '').trim()] : []));
        const expandedIds = __tmGetDefaultExpandedCustomFieldOptionIds(field);
        const syncQuickAddValue = () => {
            if (!qa.customFieldValues || typeof qa.customFieldValues !== 'object' || Array.isArray(qa.customFieldValues)) {
                qa.customFieldValues = {};
            }
            if (isMulti) {
                const values = Array.from(draft).filter(Boolean);
                if (values.length) qa.customFieldValues[fid] = values;
                else delete qa.customFieldValues[fid];
            } else {
                const value = Array.from(draft)[0] || '';
                if (value) qa.customFieldValues[fid] = value;
                else delete qa.customFieldValues[fid];
            }
            qa.customFieldValues = __tmNormalizeQuickAddCustomFieldValues(qa.customFieldValues);
            window.tmQuickAddRenderMeta?.();
        };
        __tmOpenInlineEditor(btn, ({ editor, close }) => {
            try { editor.classList.add('tm-custom-field-inline-editor'); } catch (e) {}
            editor.style.zIndex = '100020';
            editor.style.minWidth = '0';
            editor.style.width = 'auto';
            editor.style.maxWidth = `${Math.max(180, Math.min(300, (window.innerWidth || 320) - 24))}px`;
            editor.style.padding = '6px';
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.gap = '4px';
            wrap.style.width = '100%';
            const title = document.createElement('div');
            title.style.cssText = 'font-size:12px;color:var(--tm-secondary-text);padding:0 2px 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
            title.textContent = String(field?.name || fid || '自定义列').trim() || '自定义列';
            wrap.appendChild(title);
            const list = document.createElement('div');
            list.style.display = 'flex';
            list.style.flexDirection = 'column';
            list.style.gap = '3px';
            list.style.width = '100%';
            wrap.appendChild(list);
            const renderOptions = () => {
                __tmRenderCustomFieldOptionTreePicker(list, field, draft, {
                    expandedIds,
                    onToggle: (optionId) => {
                        if (isMulti) {
                            if (draft.has(optionId)) draft.delete(optionId);
                            else draft.add(optionId);
                            syncQuickAddValue();
                            renderOptions();
                            return;
                        }
                        draft.clear();
                        draft.add(optionId);
                        syncQuickAddValue();
                        close();
                    },
                });
            };
            renderOptions();
            const actions = document.createElement('div');
            actions.style.cssText = 'display:flex;gap:4px;justify-content:flex-end;padding-top:2px;';
            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.className = 'tm-btn tm-btn-gray';
            clearBtn.style.cssText = 'padding:3px 8px;font-size:12px;';
            clearBtn.textContent = '清空';
            clearBtn.onclick = () => {
                draft.clear();
                syncQuickAddValue();
                if (isMulti) renderOptions();
                else close();
            };
            actions.appendChild(clearBtn);
            if (isMulti) {
                const doneBtn = document.createElement('button');
                doneBtn.type = 'button';
                doneBtn.className = 'tm-btn tm-btn-primary';
                doneBtn.style.cssText = 'padding:3px 8px;font-size:12px;';
                doneBtn.textContent = '完成';
                doneBtn.onclick = () => close();
                actions.appendChild(doneBtn);
            }
            wrap.appendChild(actions);
            editor.appendChild(wrap);
        });
    };

    window.tmQuickAddOpen = async function() {
        await __tmEnsureSettingsLoaded();
        try { __tmApplyAppearanceThemeVars(); } catch (e) {}
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

        const initialLocation = await __tmResolveQuickAddInitialLocation();
        const docId = String(initialLocation?.docId || '').trim();
        if (!docId && initialLocation?.mode !== 'dailyNote') {
            hint('⚠ 请先在设置中选择文档', 'warning');
            showSettings();
            return;
        }
        const visibleQuickAddFields = await __tmRefreshQuickAddCustomFieldScope(docId);

        const initialMode = initialLocation?.mode === 'dailyNote' ? 'dailyNote' : 'doc';
        const initialDocId = docId;

        const stOptions = SettingsStore.data.customStatusOptions || [];
        const defaultStatusId = __tmGetDefaultUndoneStatusId(stOptions);
        state.quickAdd = {
            docId: initialDocId,
            docMode: initialMode,
            customStatus: defaultStatusId,
            priority: 'none',
            startDate: '',
            completionTime: __tmResolveQuickAddDefaultCompletionTime(),
            repeatRule: __tmNormalizeTaskRepeatRule(''),
            repeatState: __tmNormalizeTaskRepeatState(null),
            reminderDraft: null,
            reminderDraftOpening: false,
            customFieldValues: {},
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

                        <div id="tmQuickAddCustomFields" style="display:none;gap:8px;align-items:center;flex-wrap:wrap;min-width:0;"></div>
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
            input.addEventListener('input', () => {
                const lines = __tmSplitTaskInputLines(input.value || '');
                if (lines.length > 1 && state.quickAdd?.reminderDraft) {
                    state.quickAdd.reminderDraft = null;
                    hint('⚠ 多条任务不会保留前置提醒设置', 'warning');
                    window.tmQuickAddRenderMeta?.();
                }
            });
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
        await __tmRefreshQuickAddCustomFieldScope(id);
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
        if (did) await __tmRefreshQuickAddCustomFieldScope(did);
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
            if (target.id === 'tmQuickAddDocPickerCloseBtn') {
                if (state.quickAddDocPicker) {
                    tmQuickAddCloseDocPicker();
                }
                e.stopPropagation();
                return;
            }
            // 检查是否点击了主弹窗的关闭按钮（关闭整个弹窗）
            if (target.id === 'tmQuickAddCloseBtn') {
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
                : __tmResolveQuickAddDocName(qa.docId);
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
                const meta = [ct];
                try {
                    const rule = __tmGetTaskRepeatRule({ repeatRule: qa.repeatRule, repeatState: qa.repeatState, startDate: sd, completionTime: ctValue });
                    if (rule?.enabled && rule.type !== 'none') meta.push(`循环: ${__tmGetTaskRepeatSummary(rule, { startDate: sd, completionTime: ctValue }) || '已设置'}`);
                } catch (e) {}
                if (qa.reminderDraft) meta.push('提醒已设置');
                dateLabel.textContent = meta.join(' · ');
                dateInput.value = qa.completionTime ? __tmNormalizeDateOnly(qa.completionTime) : '';

                const btn = document.getElementById('tmQuickAddDateLabel')?.parentElement;
                if (btn) {
                    if (qa.startDate || qa.completionTime || qa.reminderDraft || qa.repeatRule?.enabled) {
                        btn.style.color = 'var(--tm-primary-color)';
                        btn.style.borderColor = 'var(--tm-primary-color)';
                    } else {
                        btn.style.color = '';
                        btn.style.borderColor = '';
                    }
                }
            }

            __tmRenderQuickAddCustomFields();
        } catch (e) {}
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
                hideSchedule: true,
                task: {
                    id: '__tm_quick_add_draft__',
                    content: __tmSplitTaskInputLines(document.getElementById('tmQuickAddInput')?.value || '')[0] || '新建任务',
                    startDate: String(qa.startDate || '').trim(),
                    start_date: String(qa.startDate || '').trim(),
                    completionTime: String(qa.completionTime || '').trim(),
                    completion_time: String(qa.completionTime || '').trim(),
                    repeatRule: qa.repeatRule,
                    repeatState: qa.repeatState,
                },
                onChange: async (payload = {}) => {
                    const patch = (payload?.patch && typeof payload.patch === 'object') ? payload.patch : {};
                    if (Object.prototype.hasOwnProperty.call(patch, 'startDate')) {
                        qa.startDate = String(patch.startDate || '').trim();
                    }
                    if (Object.prototype.hasOwnProperty.call(patch, 'completionTime')) {
                        qa.completionTime = String(patch.completionTime || '').trim();
                    }
                    if (Object.prototype.hasOwnProperty.call(patch, 'repeatRule')) {
                        qa.repeatRule = __tmNormalizeTaskRepeatRule(patch.repeatRule, {
                            startDate: qa.startDate,
                            completionTime: qa.completionTime,
                        });
                    }
                    if (Object.prototype.hasOwnProperty.call(patch, 'repeatState')) {
                        qa.repeatState = __tmNormalizeTaskRepeatState(patch.repeatState);
                    }
                    window.tmQuickAddRenderMeta?.();
                },
                getReminderDraft: () => !!qa.reminderDraft,
                reminderDraftLabel: '已设置',
                isReminderDisabled: () => !SettingsStore.data.enableTomatoIntegration
                    || __tmSplitTaskInputLines(document.getElementById('tmQuickAddInput')?.value || '').length > 1
                    || globalThis.__tomatoReminder?.capabilities?.draftDialog !== true
                    || globalThis.__tomatoReminder?.capabilities?.upsertDraft !== true
                    || typeof globalThis.__tomatoReminder?.showDialog !== 'function'
                    || typeof globalThis.__tomatoReminder?.upsertDraft !== 'function',
                getReminderDisabledReason: () => !SettingsStore.data.enableTomatoIntegration
                    ? '番茄钟联动未启用'
                    : (__tmSplitTaskInputLines(document.getElementById('tmQuickAddInput')?.value || '').length > 1
                        ? '多条任务请创建后分别设置提醒'
                        : '提醒桥接未就绪，请稍后重试'),
                onReminderDraftToggle: async ({ enabled } = {}) => {
                    if (!SettingsStore.data.enableTomatoIntegration) {
                        hint('⚠ 番茄钟联动已关闭', 'warning');
                        return;
                    }
                    const bridge = globalThis.__tomatoReminder;
                    if (bridge?.capabilities?.draftDialog !== true
                        || bridge?.capabilities?.upsertDraft !== true
                        || typeof bridge?.showDialog !== 'function'
                        || typeof bridge?.upsertDraft !== 'function') {
                        hint('⚠ 番茄钟提醒桥接未就绪', 'warning');
                        return;
                    }
                    const lines = __tmSplitTaskInputLines(document.getElementById('tmQuickAddInput')?.value || '');
                    if (lines.length > 1) {
                        hint('⚠ 多条任务请创建后分别设置提醒', 'warning');
                        return;
                    }
                    if (qa.reminderDraftOpening) return;
                    qa.reminderDraftOpening = true;
                    window.tmQuickAddRenderMeta?.();
                    try {
                        const result = await bridge.showDialog('', lines[0] || '新建任务', {
                            draft: true,
                            draftReminder: qa.reminderDraft,
                            taskOwned: true,
                            defaultSyncTaskDone: true,
                            taskContext: {
                                taskStartDate: String(qa.startDate || '').trim(),
                                taskCompletionTime: String(qa.completionTime || '').trim(),
                                taskRepeatRule: qa.repeatRule,
                                taskRepeatState: qa.repeatState,
                            },
                        });
                        if (result?.action === 'save' && result.draft && typeof result.draft === 'object') {
                            qa.reminderDraft = { ...result.draft };
                        } else if (result?.action === 'clear') {
                            qa.reminderDraft = null;
                        }
                    } catch (e) {
                        hint(`⚠ 提醒设置未保存: ${e?.message || e || '未知错误'}`, 'warning');
                    } finally {
                        qa.reminderDraftOpening = false;
                        window.tmQuickAddRenderMeta?.();
                    }
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

        const resolveDocName = (docId) => __tmResolveQuickAddDocName(docId);
        const defaultUsesLastSelection = __tmNormalizeNewTaskDefaultLocationMode(SettingsStore.data.newTaskDefaultLocationMode) === 'lastSelected';
        const defaultLocation = await __tmResolveQuickAddInitialLocation();
        const defaultDocIsDailyNote = defaultLocation?.mode === 'dailyNote';
        const defaultDocId = String(defaultLocation?.docId || '').trim();
        const defaultDocName = defaultDocIsDailyNote
            ? '今天日记'
            : (defaultDocId ? resolveDocName(defaultDocId) : '未设置');
        const defaultDocReady = defaultDocIsDailyNote || !!defaultDocId;
        const defaultLocationLabel = defaultUsesLastSelection
            ? `上次选择：${defaultDocName}`
            : `默认任务文档：${defaultDocName}`;
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
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">
                    <div class="tm-prompt-title" style="margin:0;">选择文档</div>
                    <button class="tm-btn tm-btn-gray" id="tmQuickAddDocPickerCloseBtn" onclick="tmQuickAddCloseDocPicker()" style="padding: 6px 12px; font-size: 13px;">关闭</button>
                </div>
                <div style="border:1px solid var(--tm-border-color);border-radius:8px;margin-bottom:8px;overflow:hidden;">
                    <div style="padding:8px 10px;background:var(--tm-header-bg);font-weight:600;">快捷</div>
                    <div style="padding:6px 10px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;cursor:pointer;" onclick="tmQuickAddUseTodayDiary();tmQuickAddCloseDocPicker();">
                            <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">今天日记</div>
                            <div style="margin-left:10px;">${qa.docMode === 'dailyNote' ? '✅' : '◻️'}</div>
                        </div>
                        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;cursor:${defaultDocReady ? 'pointer' : 'not-allowed'};opacity:${defaultDocReady ? 1 : 0.6};" onclick="${defaultDocReady ? `tmQuickAddUseDefaultDoc();tmQuickAddCloseDocPicker();` : ''}">
                            <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(defaultLocationLabel)}</div>
                            <div style="margin-left:10px;">${defaultDocIsDailyNote ? (qa.docMode === 'dailyNote' ? '✅' : '◻️') : (qa.docMode !== 'dailyNote' && qa.docId === defaultDocId ? '✅' : '◻️')}</div>
                        </div>
                    </div>
                </div>
                ${recentSectionHtml}
                <div id="tmQuickAddDocList"></div>
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
        __tmRememberQuickAddLocation('doc', id);
        // 移除对 updateNewTaskDocId 的调用，避免修改全局新建文档设置
        window.tmQuickAddCloseDocPicker?.();
        await __tmRefreshQuickAddCustomFieldScope(id);
        window.tmQuickAddRenderMeta?.();
    };

    window.tmQuickAddUseTodayDiary = function() {
        const qa = state.quickAdd;
        if (!qa) return;
        qa.docMode = 'dailyNote';
        __tmRememberQuickAddLocation('dailyNote');
        try { window.tmQuickAddCloseDocPicker?.(); } catch (e) {}
        window.tmQuickAddRenderMeta?.();
    };

    window.tmQuickAddUseDefaultDoc = async function() {
        const qa = state.quickAdd;
        if (!qa) return;
        const location = await __tmResolveQuickAddInitialLocation();
        if (location?.mode === 'dailyNote') {
            qa.docMode = 'dailyNote';
            __tmRememberQuickAddLocation('dailyNote');
            await __tmRefreshQuickAddCustomFieldScope(qa.docId);
            window.tmQuickAddRenderMeta?.();
            return;
        }
        const id = String(location?.docId || '').trim();
        if (!id) {
            hint('⚠ 未设置默认任务文档', 'warning');
            return;
        }
        qa.docId = id;
        qa.docMode = 'doc';
        __tmRememberQuickAddLocation('doc', id);
        await __tmRefreshQuickAddCustomFieldScope(id);
        window.tmQuickAddRenderMeta?.();
    };

    function __tmGetDailyNoteTargetHeadingText() {
        return __tmNormalizeHeadingText(SettingsStore?.data?.newTaskDailyNoteTargetHeadingText || '');
    }

    function __tmNormalizeDailyNoteCreateHeadingLevel() {
        const level = String(SettingsStore?.data?.taskHeadingLevel || 'h2').trim().toLowerCase();
        return /^h[1-6]$/.test(level) ? level : 'h2';
    }

    function __tmNormalizeParsedHeadingLevelName(level) {
        const n = Number(level);
        return Number.isInteger(n) && n >= 1 && n <= 6 ? `h${n}` : __tmNormalizeDailyNoteCreateHeadingLevel();
    }

    async function __tmResolveDailyNoteTargetHeadingInsertOptions(docId) {
        const did = String(docId || '').trim();
        const targetText = __tmGetDailyNoteTargetHeadingText();
        if (!did || !targetText) return null;
        if (typeof __tmParseHeadingBlocksFromKramdown !== 'function') throw new Error('标题解析器未就绪');
        const km = await API.getBlockKramdown(did);
        const parsedHeadings = __tmParseHeadingBlocksFromKramdown(km);
        const headingList = Array.isArray(parsedHeadings) ? parsedHeadings : [];
        const matchedIndex = headingList.findIndex((heading) => {
            const hid = String(heading?.id || '').trim();
            if (!hid) return false;
            return __tmNormalizeHeadingText(heading?.content || '') === targetText;
        });
        const matched = matchedIndex >= 0 ? headingList[matchedIndex] : null;
        if (matched?.id) {
            const headingLevel = __tmNormalizeParsedHeadingLevelName(matched.level);
            try {
                const placement = await __tmResolveHeadingGroupInsertPlacement(did, String(matched.id || '').trim(), headingLevel);
                if (placement?.matched) {
                    const headingPatch = __tmBuildHeadingPatchFromPlacement(placement);
                    const insertBeforeId = String(placement.nextID || '').trim();
                    return {
                        atTop: false,
                        appendToBottom: !insertBeforeId && placement.appendToBottom === true,
                        insertParentId: String(placement.parentID || did).trim(),
                        insertBeforeId,
                        insertAfterId: '',
                        headingPatch,
                    };
                }
            } catch (e) {}
            const nextHeading = headingList.slice(matchedIndex + 1).find((heading) => String(heading?.id || '').trim()) || null;
            const insertBeforeId = String(nextHeading?.id || '').trim();
            const headingPatch = __tmBuildHeadingPatchFromPlacement({
                heading: {
                    id: String(matched.id || '').trim(),
                    content: matched.content || targetText,
                    rank: Number.NaN,
                },
            });
            return {
                atTop: false,
                appendToBottom: !insertBeforeId,
                insertParentId: did,
                insertBeforeId,
                insertAfterId: '',
                headingPatch,
            };
        }
        const headingLevel = __tmNormalizeDailyNoteCreateHeadingLevel();
        const levelNum = Number((headingLevel.match(/^h([1-6])$/) || [])[1]) || 2;
        const headingId = String(await __tmAppendBlockOnce(did, `${'#'.repeat(levelNum)} ${targetText}`) || '').trim();
        if (!headingId) throw new Error('创建日记目标标题失败');
        const headingPatch = __tmBuildHeadingPatchFromPlacement({
            heading: {
                id: headingId,
                content: targetText,
                rank: Number.NaN,
            },
        });
        return {
            atTop: false,
            appendToBottom: false,
            insertParentId: did,
            insertBeforeId: '',
            insertAfterId: headingId,
            headingPatch,
        };
    }

    async function __tmResolveDefaultNewTaskInsertOptions(targetDocId, docMode = 'doc', options = {}) {
        const did = String(targetDocId || '').trim();
        const mode = String(docMode || 'doc').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        const contentCount = Math.max(1, Number(opts.contentCount || opts.count || 1) || 1);
        const result = {
            atTop: false,
            appendToBottom: false,
            insertParentId: '',
            insertBeforeId: '',
            insertAfterId: '',
            targetHeadingId: '',
            targetHeading: '',
            targetHeadingRank: Number.NaN,
            headingPatch: null,
        };
        if (!did) return result;
        if (mode === 'dailyNote') {
            try {
                const dailyHeadingOptions = await __tmResolveDailyNoteTargetHeadingInsertOptions(did);
                if (dailyHeadingOptions) {
                    Object.assign(result, dailyHeadingOptions);
                    result.targetHeadingId = result.headingPatch?.h2Id || '';
                    result.targetHeading = result.headingPatch?.h2 || '';
                    result.targetHeadingRank = Number(result.headingPatch?.h2Rank);
                    return result;
                }
            } catch (e) {
                try { hint('⚠ 今天日记目标标题定位失败，已改用默认新建位置', 'warning'); } catch (e2) {}
            }
        }
        const appendToBottom = mode === 'dailyNote' && SettingsStore.data.newTaskDailyNoteAppendToBottom === true;
        result.appendToBottom = appendToBottom;
        let topAnchorResolved = false;
        let headingAppendToBottom = false;
        let staleConfiguredHeading = false;
        const configuredHeading = mode === 'doc' && typeof __tmGetDocDefaultTaskHeadingConfig === 'function'
            ? __tmGetDocDefaultTaskHeadingConfig(did)
            : null;
        if (!appendToBottom && configuredHeading?.headingId && typeof __tmResolveHeadingGroupInsertPlacement === 'function') {
            try {
                const useSectionEnd = !!SettingsStore.data.headingGroupCreateAtSectionEnd;
                const placement = await __tmResolveHeadingGroupInsertPlacement(did, configuredHeading.headingId, configuredHeading.headingLevel || SettingsStore.data.taskHeadingLevel || 'h2');
                if (placement?.matched) {
                    result.headingPatch = __tmBuildHeadingPatchFromPlacement(placement);
                    result.insertParentId = String(placement.parentID || did).trim();
                    if (useSectionEnd) {
                        result.insertBeforeId = String(placement.nextID || '').trim();
                        headingAppendToBottom = placement.appendToBottom === true;
                        if (!result.insertBeforeId && placement.appendToBottom === true) {
                            topAnchorResolved = true;
                        }
                    } else {
                        result.insertAfterId = String(placement.insertAfterID || configuredHeading.headingId || '').trim();
                    }
                } else if (placement?.checked === true) {
                    staleConfiguredHeading = true;
                }
            } catch (e) {
                result.headingPatch = null;
                result.insertParentId = '';
                result.insertBeforeId = '';
                result.insertAfterId = '';
            }
        }
        if (staleConfiguredHeading && configuredHeading?.headingId) {
            try {
                if (typeof __tmSaveDocDefaultTaskHeadingConfig === 'function') {
                    await __tmSaveDocDefaultTaskHeadingConfig(did, null);
                } else if (SettingsStore?.data?.docDefaultTaskHeadingByDocId) {
                    delete SettingsStore.data.docDefaultTaskHeadingByDocId[did];
                    await SettingsStore.save();
                }
            } catch (e) {}
            try { hint('⚠ 默认新建标题已不存在，已改用默认新建位置', 'warning'); } catch (e) {}
            result.headingPatch = null;
            result.insertParentId = '';
            result.insertBeforeId = '';
            result.insertAfterId = '';
            headingAppendToBottom = false;
        }
        if (!appendToBottom && !result.headingPatch && contentCount > 1) {
            try {
                result.insertBeforeId = String(await API.getFirstDirectChildIdOfDoc(did) || '').trim();
                topAnchorResolved = true;
            } catch (e) {}
        }
        const appendEmptyBatchToKeepOrder = !appendToBottom && topAnchorResolved && !result.insertBeforeId && contentCount > 1;
        result.appendToBottom = appendToBottom || headingAppendToBottom || appendEmptyBatchToKeepOrder;
        result.targetHeadingId = result.headingPatch?.h2Id || '';
        result.targetHeading = result.headingPatch?.h2 || '';
        result.targetHeadingRank = Number(result.headingPatch?.h2Rank);
        return result;
    }

    const __tmWaitForQuickAddRealTaskId = async (taskId) => {
        const rawId = String(taskId || '').trim();
        if (!rawId || !rawId.startsWith('tm_tmp_')) return rawId;
        for (let attempt = 0; attempt < 20; attempt += 1) {
            try {
                const resolved = typeof __tmResolveMutationTempTaskId === 'function'
                    ? String(__tmResolveMutationTempTaskId(rawId) || '').trim()
                    : (typeof __tmResolveOptimisticTaskId === 'function' ? String(__tmResolveOptimisticTaskId(rawId) || '').trim() : '');
                if (resolved && resolved !== rawId && !resolved.startsWith('tm_tmp_')) return resolved;
            } catch (e) {}
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
        return '';
    };

    window.tmQuickAddSubmit = async function() {
        const qa = state.quickAdd;
        if (!qa) return;
        if (state.quickAddSubmitting) return;
        if (qa.reminderDraftOpening) {
            hint('⚠ 请先完成提醒设置', 'warning');
            return;
        }
        const input = document.getElementById('tmQuickAddInput');
        const dateInput = document.getElementById('tmQuickAddDateInput');
        const taskLines = __tmSplitTaskInputLines(input?.value || '');
        if (taskLines.length === 0) return;
        const hasReminderDraft = !!qa.reminderDraft && taskLines.length === 1;
        const reminderBridge = globalThis.__tomatoReminder;
        const canPersistReminder = hasReminderDraft
            && !!SettingsStore.data.enableTomatoIntegration
            && reminderBridge?.capabilities?.upsertDraft === true
            && typeof reminderBridge?.upsertDraft === 'function';
        if (taskLines.length > 1) qa.reminderDraft = null;
        const startDate = String(qa.startDate || '').trim() ? __tmNormalizeDateOnly(qa.startDate) : '';
        const completionTime = (() => {
            const raw = dateInput instanceof HTMLInputElement
                ? String(dateInput.value || '').trim()
                : String(qa.completionTime || '').trim();
            return raw ? __tmNormalizeDateOnly(raw) : '';
        })();
        qa.startDate = startDate;
        qa.completionTime = completionTime;
        const customFieldValues = __tmNormalizeQuickAddCustomFieldValues(qa.customFieldValues || {});
        qa.customFieldValues = customFieldValues;
        state.quickAddSubmitting = true;
        const payload = {
            docId: qa.docId,
            docMode: qa.docMode,
            priority: qa.priority,
            customStatus: qa.customStatus,
            customFieldValues,
            startDate,
            completionTime,
            repeatRule: qa.repeatRule,
            repeatState: qa.repeatState,
            reminderDraft: canPersistReminder ? { ...qa.reminderDraft } : null,
            contents: taskLines,
        };
        if (hasReminderDraft && !canPersistReminder) {
            hint('⚠ 番茄钟提醒桥接未就绪，任务将创建但提醒不会写入', 'warning');
        }
        window.tmQuickAddClose?.();
        state.quickAddSubmitting = false;
        return (async () => {
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
                let reminderTaskId = '';
                const createTaskInDoc = globalThis.__tmRequireTaskMutation?.('createTaskInDoc');
                if (typeof createTaskInDoc !== 'function') throw new Error('任务写入队列未就绪: createTaskInDoc');
                const insertOptionsTimeoutMs = 1800;
                const insertOptions = await Promise.race([
                    Promise.resolve()
                        .then(() => __tmResolveDefaultNewTaskInsertOptions(targetDocId, payload.docMode, { contentCount: payload.contents.length }))
                        .catch(() => null),
                    new Promise((resolve) => setTimeout(() => resolve(null), insertOptionsTimeoutMs)),
                ]);
                const normalizedInsertOptions = (insertOptions && typeof insertOptions === 'object') ? insertOptions : {};
                const { headingPatch, ...createInsertOptions } = normalizedInsertOptions;
                const insertAfterId = String(createInsertOptions.insertAfterId || '').trim();
                const createContents = insertAfterId ? payload.contents.slice().reverse() : payload.contents;
                const createSettled = await Promise.allSettled(createContents.map((content) => createTaskInDoc({
                        docId: targetDocId,
                        content,
                        priority: payload.priority,
                        customStatus: payload.customStatus,
                        customFieldValues: payload.customFieldValues,
                        startDate: payload.startDate,
                        completionTime: payload.completionTime,
                        repeatRule: payload.repeatRule,
                        repeatState: payload.repeatState,
                        ...createInsertOptions,
                        wait: true,
                        showErrorHint: false,
                    }).then(async (createdTaskId) => {
                        if (createdTaskId) {
                            createdTaskIds.push(createdTaskId);
                            if (payload.reminderDraft) {
                                reminderTaskId = await __tmWaitForQuickAddRealTaskId(createdTaskId);
                            }
                            try {
                                if (headingPatch) __tmApplyHeadingPatchToTaskLocal(createdTaskId, headingPatch, 'quick-add-default-heading');
                            } catch (e) {}
                        }
                        return createdTaskId;
                    })));
                const createFailures = createSettled.filter((item) => item.status === 'rejected');
                if (createFailures.length > 0) {
                    const firstError = createFailures[0]?.reason;
                    if (createdTaskIds.length === 0) {
                        throw firstError instanceof Error ? firstError : new Error(String(firstError || '任务创建失败'));
                    }
                    const message = String(firstError?.message || firstError || '').trim();
                    hint(`⚠ 已创建 ${createdTaskIds.length} 个任务，${createFailures.length} 个失败${message ? `: ${message}` : ''}`, 'warning');
                    return;
                }
                hint(payload.contents.length > 1 ? `✅ 已创建 ${payload.contents.length} 个任务` : '✅ 任务已创建', 'success');
                const createdTaskId = reminderTaskId || '';
                if (payload.reminderDraft && createdTaskId) {
                    const draft = {
                        ...payload.reminderDraft,
                        blockName: payload.contents[0],
                    };
                    let followsTask = false;
                    try {
                        followsTask = typeof __tmGetReminderRepeatMode === 'function'
                            ? __tmGetReminderRepeatMode(draft) === __TM_REMINDER_REPEAT_MODE_FOLLOW_TASK
                            : (draft.repeatMode === 'followTaskRepeat' || draft.repeatMode === 'follow-task');
                    } catch (e) {
                        followsTask = draft.repeatMode === 'followTaskRepeat' || draft.repeatMode === 'follow-task';
                    }
                    if (followsTask && !payload.completionTime) {
                        hint('⚠ 任务已创建，但跟随任务提醒需要先设置截止日期', 'warning');
                        return;
                    }
                    if (followsTask) {
                        const mutation = globalThis.__tmTaskMutations;
                        if (typeof mutation?.waitForTaskWrites !== 'function') {
                            hint('⚠ 任务已创建，但任务字段写入屏障未就绪，提醒未写入', 'warning');
                            return;
                        }
                        const writeBarrier = await mutation.waitForTaskWrites(createdTaskId, {
                            types: ['taskPatch'],
                            expected: {
                                startDate: payload.startDate,
                                completionTime: payload.completionTime,
                                repeatRule: payload.repeatRule,
                            },
                            timeoutMs: 4000,
                        });
                        if (!writeBarrier?.ok) {
                            hint('⚠ 任务已创建，但任务日期/循环字段仍未确认，提醒未写入', 'warning');
                            return;
                        }
                    }
                    try {
                        const result = await reminderBridge.upsertDraft(createdTaskId, {
                            ...draft,
                            completionTime: followsTask ? payload.completionTime : draft.completionTime,
                        }, {
                            overwrite: true,
                            source: 'task-horizon-quick-add-draft',
                        });
                        if (!result?.ok) {
                            hint(`⚠ 任务已创建，但提醒写入失败: ${result?.message || '请稍后补设'}`, 'warning');
                        }
                    } catch (e) {
                        hint(`⚠ 任务已创建，但提醒写入失败: ${e?.message || e || '请稍后补设'}`, 'warning');
                    }
                } else if (hasReminderDraft) {
                    hint('⚠ 任务已创建，但等待真实任务 ID 超时，提醒未写入', 'warning');
                }
                return true;
            } catch (e) {
                hint(`❌ 创建失败: ${e.message}`, 'error');
                return false;
            }
        })();
    };

    window.tmAdd = async function() {
        window.tmQuickAddOpen?.();
    };
