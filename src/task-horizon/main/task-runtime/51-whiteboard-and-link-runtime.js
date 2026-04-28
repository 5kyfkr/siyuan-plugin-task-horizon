    function __tmGetWhiteboardCardSnapshotMap() {
        const now = Date.now();
        // 使用缓存避免频繁归一化
        if (__tmWhiteboardCardSnapshotCache && (now - __tmWhiteboardCardSnapshotCacheTime) < __tmWhiteboardCardSnapshotCacheTTL) {
            return __tmWhiteboardCardSnapshotCache;
        }
        try { WhiteboardStore.normalize(); } catch (e) {}
        const raw = WhiteboardStore.data?.cards;
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            __tmWhiteboardCardSnapshotCache = {};
        } else {
            __tmWhiteboardCardSnapshotCache = raw;
        }
        __tmWhiteboardCardSnapshotCacheTime = now;
        return __tmWhiteboardCardSnapshotCache;
    }

    // 清除白板快照缓存（当数据更新时调用）
    function __tmClearWhiteboardCardSnapshotCache() {
        __tmWhiteboardCardSnapshotCache = null;
        __tmWhiteboardCardSnapshotCacheTime = 0;
    }

    function __tmGetWhiteboardCardSnapshot(taskId) {
        const id = String(taskId || '').trim();
        if (!id) return null;
        const map = __tmGetWhiteboardCardSnapshotMap();
        const item = map[id];
        return (item && typeof item === 'object') ? item : null;
    }

    function __tmUpsertWhiteboardTaskSnapshot(task, opts = {}) {
        WhiteboardStore.upsertTask(task, opts);
    }

    function __tmUpsertWhiteboardTaskSnapshots(tasks, opts = {}) {
        WhiteboardStore.upsertTasks(tasks, opts);
    }

    function __tmDeleteWhiteboardSnapshotTasks(taskIds) {
        const list = Array.isArray(taskIds) ? taskIds : [];
        const ids = list.map((x) => String(x || '').trim()).filter(Boolean);
        if (!ids.length) return;
        const idSet = new Set(ids);
        try { WhiteboardStore.normalize(); } catch (e) {}
        try {
            const cards = (WhiteboardStore.data && WhiteboardStore.data.cards && typeof WhiteboardStore.data.cards === 'object')
                ? WhiteboardStore.data.cards
                : {};
            let changed = false;
            ids.forEach((id) => {
                if (cards[id]) {
                    delete cards[id];
                    changed = true;
                }
            });
            if (changed) {
                const links0 = Array.isArray(WhiteboardStore.data.links) ? WhiteboardStore.data.links : [];
                WhiteboardStore.data.links = links0.filter((ln) => {
                    const from = String(ln?.from || '').trim();
                    const to = String(ln?.to || '').trim();
                    return !idSet.has(from) && !idSet.has(to);
                });
                WhiteboardStore.scheduleSave();
            }
        } catch (e) {}
        try {
            const pos0 = __tmGetWhiteboardNodePosMap();
            const pos = { ...pos0 };
            let dirty = false;
            ids.forEach((id) => {
                if (id in pos) {
                    delete pos[id];
                    dirty = true;
                }
            });
            if (dirty) SettingsStore.data.whiteboardNodePos = pos;
        } catch (e) {}
        try {
            const placed0 = __tmGetWhiteboardPlacedTaskMap();
            const placed = { ...placed0 };
            let dirty = false;
            ids.forEach((id) => {
                if (id in placed) {
                    delete placed[id];
                    dirty = true;
                }
            });
            if (dirty) SettingsStore.data.whiteboardPlacedTaskIds = placed;
        } catch (e) {}
        try { SettingsStore.syncToLocal(); } catch (e) {}
    }

    async function __tmSyncWhiteboardFrozenTasksWithLiveTasks() {
        if (!WhiteboardStore.loaded) return 0;
        const flat = (state.flatTasks && typeof state.flatTasks === 'object') ? state.flatTasks : {};
        const liveIdSet = new Set(Object.keys(flat).map((x) => String(x || '').trim()).filter(Boolean));
        const snapMap = __tmGetWhiteboardCardSnapshotMap();
        const scopeDocSet = new Set(
            (Array.isArray(state.taskTree) ? state.taskTree : [])
                .map((d) => String(d?.id || '').trim())
                .filter(Boolean)
        );
        if (!scopeDocSet.size) return 0;
        const staleCandidates = Object.keys(snapMap || {})
            .map((x) => String(x || '').trim())
            .filter((id) => {
                if (!id || liveIdSet.has(id)) return false;
                const snap = snapMap?.[id];
                const docId = String(snap?.docId || __tmGetTaskDocIdById(id) || '').trim();
                if (!docId) return false;
                if (snap?.done !== true) return false;
                // 仅清理“当前加载文档范围”内的冻结任务，避免跨分组误删
                return scopeDocSet.has(docId);
            });
        if (!staleCandidates.length) return 0;
        const realBlockIdRe = /^[0-9]+-[a-zA-Z0-9]+$/;
        const staleIds = [];
        try {
            const realIds = staleCandidates.filter((id) => realBlockIdRe.test(id));
            if (!realIds.length) return 0;
            const rows = await API.getBlocksByIds(realIds);
            const existingIdSet = new Set();
            (Array.isArray(rows) ? rows : []).forEach((row) => {
                const id = String(row?.id || '').trim();
                if (!id) return;
                if (String(row?.type || '').trim() !== 'i') return;
                if (String(row?.subtype || '').trim() !== 't') return;
                existingIdSet.add(id);
            });
            realIds.forEach((id) => {
                if (!existingIdSet.has(id)) staleIds.push(id);
            });
        } catch (e) {
            return 0;
        }
        if (!staleIds.length) return 0;
        const staleSet = new Set(staleIds);
        __tmDeleteWhiteboardSnapshotTasks(staleIds);
        try {
            const links = __tmGetManualTaskLinks();
            const nextLinks = links.filter((ln) => !staleSet.has(String(ln?.from || '').trim()) && !staleSet.has(String(ln?.to || '').trim()));
            __tmSetManualTaskLinks(nextLinks);
        } catch (e) {}
        try {
            const detached0 = __tmGetDetachedChildrenMap();
            const detached = { ...detached0 };
            let dirty = false;
            staleIds.forEach((id) => {
                if (id in detached) {
                    delete detached[id];
                    dirty = true;
                }
            });
            if (dirty) SettingsStore.data.whiteboardDetachedChildren = detached;
        } catch (e) {}
        try {
            if (staleSet.has(String(state.whiteboardSelectedTaskId || '').trim())) state.whiteboardSelectedTaskId = '';
            const multiTaskIds = Array.isArray(state.whiteboardMultiSelectedTaskIds) ? state.whiteboardMultiSelectedTaskIds : [];
            state.whiteboardMultiSelectedTaskIds = multiTaskIds.filter((id) => !staleSet.has(String(id || '').trim()));
        } catch (e) {}
        try { SettingsStore.syncToLocal(); } catch (e) {}
        return staleIds.length;
    }

    function __tmTaskCreatedOrderValue(task) {
        const raw = String(task?.created || '').trim();
        if (!raw) return Number.MAX_SAFE_INTEGER;
        if (/^\d{14}$/.test(raw)) return Number(raw);
        const ts = __tmParseTimeToTs(raw);
        return ts > 0 ? ts : Number.MAX_SAFE_INTEGER;
    }

    function __tmNormalizeTaskLinkEntry(link, index) {
        const item = (link && typeof link === 'object') ? link : {};
        const from = String(item.from || '').trim();
        const to = String(item.to || '').trim();
        if (!from || !to || from === to) return null;
        const docFrom = __tmGetTaskDocIdById(from);
        const docTo = __tmGetTaskDocIdById(to);
        const docId = String(item.docId || docFrom || docTo || '').trim();
        if (!docId) return null;
        if (docFrom && docTo && docFrom !== docTo) return null;
        if ((docFrom && docFrom !== docId) || (docTo && docTo !== docId)) return null;
        const createdAt = String(item.createdAt || '').trim() || String(Date.now());
        const idRaw = String(item.id || '').trim();
        const id = idRaw || `link_${docId}_${from}_${to}_${index}`;
        return { id, from, to, docId, createdAt, manual: true };
    }

    const __tmManualTaskLinksRuntimeCache = {
        settingsRef: null,
        settingsKey: '',
        whiteboardRef: null,
        whiteboardKey: '',
        loaded: false,
        links: [],
        byDoc: new Map(),
    };

    function __tmGetTaskLinkArrayCacheKey(list) {
        const source = Array.isArray(list) ? list : [];
        const len = source.length;
        if (!len) return '0';
        const first = source[0] || {};
        const last = source[len - 1] || {};
        return [
            len,
            String(first.id || first.from || '').trim(),
            String(first.to || '').trim(),
            String(last.id || last.from || '').trim(),
            String(last.to || '').trim(),
        ].join('|');
    }

    function __tmGetManualTaskLinksRuntime() {
        const whiteboardLoaded = !!WhiteboardStore.loaded;
        const srcA = Array.isArray(SettingsStore.data.whiteboardLinks) ? SettingsStore.data.whiteboardLinks : [];
        let srcB = Array.isArray(WhiteboardStore.data?.links) ? WhiteboardStore.data.links : [];
        if (whiteboardLoaded && srcA.length > 0 && srcB.length === 0) {
            try {
                WhiteboardStore.data.links = srcA.slice();
                WhiteboardStore.scheduleSave();
                srcB = Array.isArray(WhiteboardStore.data?.links) ? WhiteboardStore.data.links : srcB;
            } catch (e) {}
        }
        const settingsKey = __tmGetTaskLinkArrayCacheKey(srcA);
        const whiteboardKey = __tmGetTaskLinkArrayCacheKey(srcB);
        if (__tmManualTaskLinksRuntimeCache.settingsRef === srcA
            && __tmManualTaskLinksRuntimeCache.settingsKey === settingsKey
            && __tmManualTaskLinksRuntimeCache.whiteboardRef === srcB
            && __tmManualTaskLinksRuntimeCache.whiteboardKey === whiteboardKey
            && __tmManualTaskLinksRuntimeCache.loaded === whiteboardLoaded
            && Array.isArray(__tmManualTaskLinksRuntimeCache.links)
            && __tmManualTaskLinksRuntimeCache.byDoc instanceof Map) {
            return __tmManualTaskLinksRuntimeCache;
        }
        const src = [...srcA, ...srcB];
        const out = [];
        const seen = new Set();
        const byDoc = new Map();
        src.forEach((link, index) => {
            const normalized = __tmNormalizeTaskLinkEntry(link, index);
            if (!normalized) return;
            const key = `${normalized.docId}::${normalized.from}->${normalized.to}`;
            if (seen.has(key)) return;
            seen.add(key);
            out.push(normalized);
            if (!byDoc.has(normalized.docId)) byDoc.set(normalized.docId, []);
            byDoc.get(normalized.docId).push(normalized);
        });
        __tmManualTaskLinksRuntimeCache.settingsRef = srcA;
        __tmManualTaskLinksRuntimeCache.settingsKey = settingsKey;
        __tmManualTaskLinksRuntimeCache.whiteboardRef = srcB;
        __tmManualTaskLinksRuntimeCache.whiteboardKey = whiteboardKey;
        __tmManualTaskLinksRuntimeCache.loaded = whiteboardLoaded;
        __tmManualTaskLinksRuntimeCache.links = out;
        __tmManualTaskLinksRuntimeCache.byDoc = byDoc;
        return __tmManualTaskLinksRuntimeCache;
    }

    function __tmGetManualTaskLinks() {
        return __tmGetManualTaskLinksRuntime().links;
    }

    function __tmGetAutoTaskLinks() {
        return [];
    }

    function __tmGetAllTaskLinks(options = {}) {
        const opt = (options && typeof options === 'object') ? options : {};
        const includeAuto = opt.includeAuto !== false;
        const onlyDocId = String(opt.docId || '').trim();
        const links = [...__tmGetManualTaskLinks(), ...(includeAuto ? __tmGetAutoTaskLinks() : [])];
        const seen = new Set();
        return links.filter((link) => {
            if (!link || typeof link !== 'object') return false;
            const fromId = String(link.from || '').trim();
            const toId = String(link.to || '').trim();
            const docId = String(link.docId || '').trim();
            if (!fromId || !toId || !docId || fromId === toId) return false;
            if (onlyDocId && docId !== onlyDocId) return false;
            const fromDoc = __tmGetTaskDocIdById(fromId);
            const toDoc = __tmGetTaskDocIdById(toId);
            if (fromDoc && fromDoc !== docId) return false;
            if (toDoc && toDoc !== docId) return false;
            const key = `${docId}::${fromId}->${toId}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function __tmCanLinkTasks(fromTaskId, toTaskId) {
        const fromId = String(fromTaskId || '').trim();
        const toId = String(toTaskId || '').trim();
        if (!fromId || !toId || fromId === toId) return { ok: false, reason: '无效任务' };
        const fromDocId = __tmGetTaskDocIdById(fromId);
        const toDocId = __tmGetTaskDocIdById(toId);
        if (!fromDocId || !toDocId) return { ok: false, reason: '任务不存在' };
        if (fromDocId !== toDocId) return { ok: false, reason: '不支持跨文档连线' };
        return { ok: true, docId: fromDocId };
    }

    function __tmSetManualTaskLinks(nextLinks) {
        const list = Array.isArray(nextLinks) ? nextLinks : [];
        const normalized = list.map((it, i) => {
            const x = __tmNormalizeTaskLinkEntry(it, i);
            return x ? { id: x.id, from: x.from, to: x.to, docId: x.docId, createdAt: x.createdAt } : null;
        }).filter(Boolean);
        SettingsStore.data.whiteboardLinks = normalized;
        if (WhiteboardStore.loaded) {
            try {
                WhiteboardStore.data.links = normalized;
                WhiteboardStore.scheduleSave();
            } catch (e) {}
        }
        try { SettingsStore.syncToLocal(); } catch (e) {}
    }

    function __tmGetTaskLinkStats(taskId, options = {}) {
        const id = String(taskId || '').trim();
        if (!id) return { incoming: 0, outgoing: 0 };
        let incoming = 0;
        let outgoing = 0;
        __tmGetAllTaskLinks(options).forEach((link) => {
            if (String(link.from || '') === id) outgoing += 1;
            if (String(link.to || '') === id) incoming += 1;
        });
        return { incoming, outgoing };
    }

    function __tmGetDetachedChildrenMap() {
        const map0 = SettingsStore.data.whiteboardDetachedChildren;
        if (!map0 || typeof map0 !== 'object' || Array.isArray(map0)) return {};
        const next = {};
        let changed = false;
        Object.keys(map0).forEach((k) => {
            const id = String(k || '').trim();
            if (!id) {
                changed = true;
                return;
            }
            const v = map0[k];
            const taskPid = String(state.flatTasks?.[id]?.parentTaskId || '').trim();
            const snapPid = String(__tmGetWhiteboardCardSnapshot(id)?.parentTaskId || '').trim();
            if (v && typeof v === 'object' && v.detached === true) {
                const parentTaskId = String(v.parentTaskId || taskPid || snapPid || '').trim();
                const normalized = { ...v, detached: true, parentTaskId };
                next[id] = normalized;
                if (String(v.parentTaskId || '').trim() !== parentTaskId) changed = true;
                return;
            }
            if (v === true) {
                next[id] = { detached: true, manual: true, updatedAt: String(Date.now()), parentTaskId: String(taskPid || snapPid || '').trim() };
                changed = true;
                return;
            }
            changed = true;
        });
        if (changed) {
            SettingsStore.data.whiteboardDetachedChildren = next;
            try { SettingsStore.syncToLocal(); } catch (e) {}
        }
        return changed ? next : map0;
    }

    function __tmIsWhiteboardChildDetached(taskId) {
        const id = String(taskId || '').trim();
        if (!id) return false;
        const map = __tmGetDetachedChildrenMap();
        const item = map[id];
        return !!(item && typeof item === 'object' && item.detached === true);
    }

    function __tmResolveWhiteboardTaskParentId(taskId) {
        const id = String(taskId || '').trim();
        if (!id) return '';
        const task = state.flatTasks?.[id];
        const fromTask = String(task?.parentTaskId || '').trim();
        if (fromTask) return fromTask;
        const detachedMap = __tmGetDetachedChildrenMap();
        const detachedItem = detachedMap[id];
        const fromDetached = String(detachedItem?.parentTaskId || '').trim();
        if (fromDetached) return fromDetached;
        const snap = __tmGetWhiteboardCardSnapshot(id);
        return String(snap?.parentTaskId || '').trim();
    }

    function __tmSetWhiteboardChildDetached(taskId, detached, parentTaskId = '') {
        const id = String(taskId || '').trim();
        if (!id) return;
        const next = { ...__tmGetDetachedChildrenMap() };
        if (detached) {
            const pid = String(parentTaskId || __tmResolveWhiteboardTaskParentId(id) || '').trim();
            next[id] = { detached: true, manual: true, updatedAt: String(Date.now()), parentTaskId: pid };
        } else delete next[id];
        SettingsStore.data.whiteboardDetachedChildren = next;
        try { SettingsStore.syncToLocal(); } catch (e) {}
    }

    function __tmWhiteboardCollectTaskTreeIds(rootId, opts = {}) {
        const id0 = String(rootId || '').trim();
        if (!id0) return [];
        const o = (opts && typeof opts === 'object') ? opts : {};
        const includeRoot = o.includeRoot !== false;
        const includeDetached = o.includeDetached === true;
        const includeSnapshotTree = o.includeSnapshotTree !== false;
        const snapMap = includeSnapshotTree ? __tmGetWhiteboardCardSnapshotMap() : {};
        const snapChildrenMap = new Map();
        if (includeSnapshotTree && snapMap && typeof snapMap === 'object') {
            Object.keys(snapMap).forEach((idRaw) => {
                const sid = String(idRaw || '').trim();
                if (!sid) return;
                const s = snapMap[sid];
                if (!s || typeof s !== 'object') return;
                const pid = String(s.parentTaskId || '').trim();
                if (!pid) return;
                if (!snapChildrenMap.has(pid)) snapChildrenMap.set(pid, []);
                snapChildrenMap.get(pid).push(sid);
            });
        }
        const out = [];
        const seen = new Set();
        const stack = [id0];
        while (stack.length) {
            const cur = String(stack.pop() || '').trim();
            if (!cur || seen.has(cur)) continue;
            seen.add(cur);
            if (includeRoot || cur !== id0) out.push(cur);
            const task = state.flatTasks?.[cur];
            const kids = Array.isArray(task?.children) ? task.children : [];
            kids.forEach((k) => {
                const cid = String(k?.id || '').trim();
                if (!cid) return;
                if (!includeDetached && __tmIsWhiteboardChildDetached(cid)) return;
                stack.push(cid);
            });
            if (includeSnapshotTree) {
                const skids = snapChildrenMap.get(cur) || [];
                skids.forEach((sid) => {
                    const cid = String(sid || '').trim();
                    if (!cid) return;
                    if (!includeDetached && __tmIsWhiteboardChildDetached(cid)) return;
                    stack.push(cid);
                });
            }
        }
        return out;
    }

    function __tmFindWhiteboardCollapsedProxyTaskId(taskId, docId) {
        const id0 = String(taskId || '').trim();
        const did = String(docId || '').trim();
        if (!id0 || !did) return '';
        const collapsed = __tmKanbanGetCollapsedSet();
        const getParentId = (id) => {
            const tid = String(id || '').trim();
            if (!tid) return '';
            const t = state.flatTasks?.[tid];
            if (t) return String(t?.parentTaskId || '').trim();
            const snap = __tmGetWhiteboardCardSnapshot(tid);
            return String(snap?.parentTaskId || '').trim();
        };
        let cur = id0;
        const seen = new Set();
        while (cur && !seen.has(cur)) {
            seen.add(cur);
            const parentId = getParentId(cur);
            if (!parentId) return '';
            if (__tmIsWhiteboardChildDetached(cur)) return '';
            if (collapsed.has(parentId) && __tmIsWhiteboardTaskPlaced(parentId) && __tmGetTaskDocIdById(parentId) === did) {
                return parentId;
            }
            cur = parentId;
        }
        return '';
    }

    function __tmGetWhiteboardAllTabsLayoutMode() {
        return __tmNormalizeWhiteboardAllTabsLayoutMode(SettingsStore.data.whiteboardAllTabsLayoutMode);
    }

    function __tmIsWhiteboardAllTabsStreamMode() {
        const activeDocId = String(state.activeDocId || 'all').trim() || 'all';
        return state.viewMode === 'whiteboard'
            && activeDocId === 'all'
            && __tmGetWhiteboardAllTabsLayoutMode() === 'stream';
    }

    function __tmGetWhiteboardAllTabsDocOrderByGroupMap() {
        const raw = SettingsStore.data.whiteboardAllTabsDocOrderByGroup;
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
        return raw;
    }

    function __tmGetWhiteboardAllTabsOrderedDocIds(groupId, docIds) {
        const gid = String(groupId || 'all').trim() || 'all';
        const baseIds = Array.isArray(docIds)
            ? docIds.map((id) => String(id || '').trim()).filter(Boolean)
            : [];
        if (baseIds.length <= 1) return baseIds;
        const stored = Array.isArray(__tmGetWhiteboardAllTabsDocOrderByGroupMap()[gid])
            ? __tmGetWhiteboardAllTabsDocOrderByGroupMap()[gid]
            : [];
        const allow = new Set(baseIds);
        const seen = new Set();
        const out = [];
        stored.forEach((id0) => {
            const id = String(id0 || '').trim();
            if (!id || seen.has(id) || !allow.has(id)) return;
            seen.add(id);
            out.push(id);
        });
        baseIds.forEach((id0) => {
            const id = String(id0 || '').trim();
            if (!id || seen.has(id)) return;
            seen.add(id);
            out.push(id);
        });
        return out;
    }

    function __tmSetWhiteboardAllTabsDocOrder(groupId, docIds, opts = {}) {
        const gid = String(groupId || 'all').trim() || 'all';
        const ids = Array.from(new Set((Array.isArray(docIds) ? docIds : []).map((id) => String(id || '').trim()).filter(Boolean)));
        const o = (opts && typeof opts === 'object') ? opts : {};
        const next = { ...__tmGetWhiteboardAllTabsDocOrderByGroupMap() };
        if (ids.length > 0) next[gid] = ids;
        else delete next[gid];
        SettingsStore.data.whiteboardAllTabsDocOrderByGroup = next;
        try { SettingsStore.syncToLocal(); } catch (e) {}
        if (o.persist) {
            try { SettingsStore.save(); } catch (e) {}
        }
    }

    function __tmClearWhiteboardAllTabsDocDragMarkers() {
        try {
            state.modal?.querySelectorAll?.('.tm-whiteboard-stream-doc--drag-before,.tm-whiteboard-stream-doc--drag-after,.tm-whiteboard-stream-doc--dragging')?.forEach?.((el) => {
                try { el.classList.remove('tm-whiteboard-stream-doc--drag-before', 'tm-whiteboard-stream-doc--drag-after', 'tm-whiteboard-stream-doc--dragging'); } catch (e) {}
            });
        } catch (e) {}
    }

    function __tmGetWhiteboardView() {
        const raw = (SettingsStore.data.whiteboardView && typeof SettingsStore.data.whiteboardView === 'object')
            ? SettingsStore.data.whiteboardView
            : {};
        const x = Number(raw.x);
        const y = Number(raw.y);
        const zoom = Number(raw.zoom);
        return {
            x: Number.isFinite(x) ? x : 64,
            y: Number.isFinite(y) ? y : 40,
            zoom: Number.isFinite(zoom) ? Math.max(0.35, Math.min(2.5, zoom)) : 1,
        };
    }

    function __tmSetWhiteboardView(patch, opts = {}) {
        const p = (patch && typeof patch === 'object') ? patch : {};
        const o = (opts && typeof opts === 'object') ? opts : {};
        const prev = __tmGetWhiteboardView();
        const x = Number.isFinite(Number(p.x)) ? Number(p.x) : prev.x;
        const y = Number.isFinite(Number(p.y)) ? Number(p.y) : prev.y;
        const zoom0 = Number.isFinite(Number(p.zoom)) ? Number(p.zoom) : prev.zoom;
        const zoom = Math.max(0.35, Math.min(2.5, zoom0));
        SettingsStore.data.whiteboardView = { x, y, zoom };
        try { SettingsStore.syncToLocal(); } catch (e) {}
        if (o.persist) {
            try { SettingsStore.save(); } catch (e) {}
        }
    }

    function __tmGetWhiteboardNodePosMap() {
        const raw = SettingsStore.data.whiteboardNodePos;
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
        return raw;
    }

    function __tmGetWhiteboardNodePos(taskId, docId) {
        const id = String(taskId || '').trim();
        const did = String(docId || '').trim();
        if (!id || !did) return null;
        const map = __tmGetWhiteboardNodePosMap();
        const item = map[id];
        if (!item || typeof item !== 'object') return null;
        if (String(item.docId || '').trim() !== did) return null;
        const x = Number(item.x);
        const y = Number(item.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return { x, y, docId: did };
    }

    function __tmSetWhiteboardNodePos(taskId, docId, x, y, opts = {}) {
        const id = String(taskId || '').trim();
        const did = String(docId || '').trim();
        if (!id || !did) return;
        const xx = Number(x);
        const yy = Number(y);
        if (!Number.isFinite(xx) || !Number.isFinite(yy)) return;
        const o = (opts && typeof opts === 'object') ? opts : {};
        const next = { ...__tmGetWhiteboardNodePosMap() };
        const prev = next[id];
        const manual = (typeof o.manual === 'boolean')
            ? o.manual
            : !!(prev && typeof prev === 'object' && prev.manual === true);
        next[id] = { docId: did, x: Math.round(xx), y: Math.round(yy), manual, updatedAt: String(Date.now()) };
        SettingsStore.data.whiteboardNodePos = next;
        try { SettingsStore.syncToLocal(); } catch (e) {}
        if (o.persist) {
            try { SettingsStore.save(); } catch (e) {}
        }
    }

    function __tmGetWhiteboardPlacedTaskMap() {
        const raw = SettingsStore.data.whiteboardPlacedTaskIds;
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
        return raw;
    }

    function __tmIsWhiteboardTaskPlaced(taskId) {
        const id = String(taskId || '').trim();
        if (!id) return false;
        return !!__tmGetWhiteboardPlacedTaskMap()[id];
    }

    function __tmSetWhiteboardTaskPlaced(taskId, placed, opts = {}) {
        const id = String(taskId || '').trim();
        if (!id) return;
        const o = (opts && typeof opts === 'object') ? opts : {};
        const next = { ...__tmGetWhiteboardPlacedTaskMap() };
        if (placed) next[id] = true;
        else delete next[id];
        SettingsStore.data.whiteboardPlacedTaskIds = next;
        try { SettingsStore.syncToLocal(); } catch (e) {}
        if (o.persist) {
            try { SettingsStore.save(); } catch (e) {}
        }
    }

    function __tmGetWhiteboardDocFrameSizeMap() {
        const raw = SettingsStore.data.whiteboardDocFrameSize;
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
        return raw;
    }

    function __tmGetWhiteboardDocFrameSize(docId) {
        const id = String(docId || '').trim();
        if (!id) return null;
        const map = __tmGetWhiteboardDocFrameSizeMap();
        const item = map[id];
        if (!item || typeof item !== 'object') return null;
        const w = Number(item.w);
        const h = Number(item.h);
        if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
        return { w: Math.max(520, Math.round(w)), h: Math.max(220, Math.round(h)) };
    }

    function __tmSetWhiteboardDocFrameSize(docId, w, h, opts = {}) {
        const id = String(docId || '').trim();
        if (!id) return;
        const ww = Number(w);
        const hh = Number(h);
        if (!Number.isFinite(ww) || !Number.isFinite(hh)) return;
        const o = (opts && typeof opts === 'object') ? opts : {};
        const next = { ...__tmGetWhiteboardDocFrameSizeMap() };
        next[id] = { w: Math.max(520, Math.round(ww)), h: Math.max(220, Math.round(hh)), updatedAt: String(Date.now()) };
        SettingsStore.data.whiteboardDocFrameSize = next;
        try { SettingsStore.syncToLocal(); } catch (e) {}
        if (o.persist) {
            try { SettingsStore.save(); } catch (e) {}
        }
    }

    function __tmGetPriorityGroupDeltaMap(config = null) {
        const cfg = (config && typeof config === 'object')
            ? config
            : ((SettingsStore.data.priorityScoreConfig && typeof SettingsStore.data.priorityScoreConfig === 'object')
                ? SettingsStore.data.priorityScoreConfig
                : {});
        const raw = (cfg.groupDeltas && typeof cfg.groupDeltas === 'object') ? cfg.groupDeltas : {};
        const out = {};
        Object.entries(raw).forEach(([groupId, delta]) => {
            const gid = String(groupId || '').trim();
            if (!gid) return;
            const n = Number(delta);
            out[gid] = Number.isFinite(n) ? n : 0;
        });
        return out;
    }

    function __tmBuildPriorityGroupDeltaDocsMapCacheKey(config = null) {
        const groupDeltaMap = __tmGetPriorityGroupDeltaMap(config);
        const groupIds = Object.keys(groupDeltaMap).sort();
        if (!groupIds.length) return '';
        const groupMap = new Map(
            (Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [])
                .map((group) => [String(group?.id || '').trim(), group])
                .filter(([gid]) => !!gid)
        );
        return groupIds.map((gid) => {
            const group = groupMap.get(gid);
            if (!group) return `${gid}:missing`;
            const entries = __tmGetGroupSourceEntries(group).map((entry) => {
                const entryId = String(entry?.id || '').trim();
                if (!entryId) return '';
                return `${entryId}${String(entry?.kind || 'doc').trim() === 'notebook' ? '#nb' : (entry?.recursive ? '*' : '')}`;
            }).filter(Boolean);
            return `${gid}:${entries.join(',')}`;
        }).join('|');
    }

    async function __tmWarmPriorityGroupDeltaDocsMap(config = null) {
        const key = __tmBuildPriorityGroupDeltaDocsMapCacheKey(config);
        if (!key) {
            window.__tmPriorityGroupDeltaDocsMapCache = { key: '', map: new Map() };
            return window.__tmPriorityGroupDeltaDocsMapCache.map;
        }
        const cached = window.__tmPriorityGroupDeltaDocsMapCache;
        if (cached && cached.key === key && cached.map instanceof Map) return cached.map;

        const groupDeltaMap = __tmGetPriorityGroupDeltaMap(config);
        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        const groupsById = new Map(groups.map((group) => [String(group?.id || '').trim(), group]).filter(([gid]) => !!gid));
        const map = new Map();
        for (const gid of Object.keys(groupDeltaMap)) {
            const group = groupsById.get(String(gid || '').trim());
            if (!group) continue;
            const entries = __tmGetGroupSourceEntries(group);
            for (const entry of entries) {
                await __tmExpandSourceEntryDocIds(entry, (docId0) => {
                    const docId = String(docId0 || '').trim();
                    if (!docId) return;
                    const list = Array.isArray(map.get(docId)) ? map.get(docId) : [];
                    if (!list.includes(gid)) list.push(gid);
                    map.set(docId, list);
                });
            }
        }
        window.__tmPriorityGroupDeltaDocsMapCache = { key, map };
        return map;
    }

    function __tmSchedulePriorityGroupDeltaDocsMapWarm() {
        const key = __tmBuildPriorityGroupDeltaDocsMapCacheKey();
        if (!key) {
            window.__tmPriorityGroupDeltaDocsMapCache = { key: '', map: new Map() };
            return;
        }
        const cached = window.__tmPriorityGroupDeltaDocsMapCache;
        if (cached && cached.key === key && cached.map instanceof Map) return;
        if (String(window.__tmPriorityGroupDeltaDocsMapLoadingKey || '') === key) return;
        window.__tmPriorityGroupDeltaDocsMapLoadingKey = key;
        Promise.resolve().then(async () => {
            try {
                await __tmWarmPriorityGroupDeltaDocsMap();
            } catch (e) {
                window.__tmPriorityGroupDeltaDocsMapCache = { key, map: new Map() };
            } finally {
                window.__tmPriorityGroupDeltaDocsMapLoadingKey = '';
            }
            __tmScheduleRender({ withFilters: true });
        }).catch(() => {
            window.__tmPriorityGroupDeltaDocsMapLoadingKey = '';
        });
    }

    function __tmGetPriorityGroupDeltaForDoc(docId, config = null) {
        const did = String(docId || '').trim();
        if (!did) return 0;
        const groupDeltaMap = __tmGetPriorityGroupDeltaMap(config);
        const groupIds = Object.keys(groupDeltaMap);
        if (!groupIds.length) return 0;

        const key = __tmBuildPriorityGroupDeltaDocsMapCacheKey(config);
        const cached = window.__tmPriorityGroupDeltaDocsMapCache;
        if (!(cached && cached.key === key && cached.map instanceof Map)) {
            __tmSchedulePriorityGroupDeltaDocsMapWarm();
            let fallback = 0;
            const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
            const groupsById = new Map(groups.map((group) => [String(group?.id || '').trim(), group]).filter(([gid]) => !!gid));
            groupIds.forEach((gid) => {
                const group = groupsById.get(String(gid || '').trim());
                if (!group) return;
                const hit = __tmNormalizeGroupDocEntries(group).some((doc) => String(doc?.id || doc || '').trim() === did);
                if (hit) fallback += Number(groupDeltaMap[gid] || 0);
            });
            return fallback;
        }

        const matchedGroupIds = Array.isArray(cached.map.get(did)) ? cached.map.get(did) : [];
        return matchedGroupIds.reduce((sum, gid) => sum + (Number(groupDeltaMap[gid] || 0) || 0), 0);
    }

    function __tmGetPriorityScoreDueRanges(config = null) {
        const cfg = (config && typeof config === 'object')
            ? config
            : ((SettingsStore.data.priorityScoreConfig && typeof SettingsStore.data.priorityScoreConfig === 'object')
                ? SettingsStore.data.priorityScoreConfig
                : {});
        const ranges0 = Array.isArray(cfg.dueRanges) ? cfg.dueRanges : [];
        return ranges0
            .map((range) => ({
                days: Number(range?.days),
                delta: Number(range?.delta),
            }))
            .filter((range) => Number.isFinite(range.days) && Number.isFinite(range.delta))
            .sort((a, b) => a.days - b.days);
    }

    function __tmResolvePriorityScoreCacheUntil(taskLike, options = {}) {
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : null;
        if (!task) return 0;
        const opts = (options && typeof options === 'object') ? options : {};
        const cfg = (opts.config && typeof opts.config === 'object')
            ? opts.config
            : ((SettingsStore.data.priorityScoreConfig && typeof SettingsStore.data.priorityScoreConfig === 'object')
                ? SettingsStore.data.priorityScoreConfig
                : {});
        const dueWeight = Number((cfg.weights && typeof cfg.weights === 'object') ? cfg.weights.due : 1);
        if (Number.isFinite(dueWeight) && dueWeight === 0) return 0;
        const dueInfo = (opts.dueInfo && typeof opts.dueInfo === 'object')
            ? opts.dueInfo
            : __tmGetTaskEffectiveCompletionTimeInfo(task, {
                field: 'priorityScore',
                memo: opts.timeInfoMemo,
                useBestSubtaskTime: opts.useEffectiveDueTime === false ? false : undefined,
            });
        const dueTs = Number(dueInfo?.ts || 0);
        if (!(dueTs > 0)) return 0;
        const dueRanges = Array.isArray(opts.dueRanges) ? opts.dueRanges : __tmGetPriorityScoreDueRanges(cfg);
        if (!dueRanges.length) return 0;
        const nowTs = Number.isFinite(Number(opts.nowTs)) ? Number(opts.nowTs) : Date.now();
        let nextBoundaryTs = 0;
        for (const range of dueRanges) {
            const boundaryTs = dueTs - (Number(range.days) * 86400000);
            if (!(Number.isFinite(boundaryTs) && boundaryTs > nowTs)) continue;
            if (!nextBoundaryTs || boundaryTs < nextBoundaryTs) nextBoundaryTs = boundaryTs;
        }
        return nextBoundaryTs > 0 ? nextBoundaryTs : 0;
    }

    function __tmComputePriorityScore(task, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const cfg = (SettingsStore.data.priorityScoreConfig && typeof SettingsStore.data.priorityScoreConfig === 'object')
            ? SettingsStore.data.priorityScoreConfig
            : {};
        const base = Number.isFinite(Number(cfg.base)) ? Number(cfg.base) : 100;
        const weights = (cfg.weights && typeof cfg.weights === 'object') ? cfg.weights : {};
        const w = (k) => {
            const n = Number(weights[k]);
            return Number.isFinite(n) ? n : 1;
        };

        let score = base;

        const impDeltaMap = (cfg.importanceDelta && typeof cfg.importanceDelta === 'object') ? cfg.importanceDelta : {};
        const imp = String(task?.priority || 'none').trim() || 'none';
        const impDelta = Number(impDeltaMap[imp] ?? impDeltaMap.none ?? 0);
        if (Number.isFinite(impDelta)) score += w('importance') * impDelta;

        const statusDeltaMap = (cfg.statusDelta && typeof cfg.statusDelta === 'object') ? cfg.statusDelta : {};
        const st = __tmResolveTaskStatusId(task);
        const stDelta = Number(statusDeltaMap[st] ?? 0);
        if (Number.isFinite(stDelta)) score += w('status') * stDelta;

        const nowTs = Number.isFinite(Number(opts.nowTs)) ? Number(opts.nowTs) : Date.now();
        const dueInfo = (opts.dueInfo && typeof opts.dueInfo === 'object')
            ? opts.dueInfo
            : __tmGetTaskEffectiveCompletionTimeInfo(task, {
                field: 'priorityScore',
                memo: opts.timeInfoMemo,
                useBestSubtaskTime: opts.useEffectiveDueTime === false ? false : undefined,
            });
        const dueTs = Number(dueInfo?.ts || 0);
        if (dueTs > 0) {
            const daysUntil = (dueTs - nowTs) / 86400000;
            const ranges = __tmGetPriorityScoreDueRanges(cfg);
            let delta = 0;
            for (const r of ranges) {
                if (daysUntil <= r.days) { delta = r.delta; break; }
            }
            score += w('due') * delta;
        }

        const mins = __tmParseDurationMinutes(task?.duration);
        if (mins != null) {
            const buckets0 = Array.isArray(cfg.durationBuckets) ? cfg.durationBuckets : [];
            const buckets = buckets0
                .map(b => ({ maxMinutes: Number(b?.maxMinutes), delta: Number(b?.delta) }))
                .filter(b => Number.isFinite(b.maxMinutes) && Number.isFinite(b.delta))
                .sort((a, b) => a.maxMinutes - b.maxMinutes);
            let delta = 0;
            for (const b of buckets) {
                if (mins <= b.maxMinutes) { delta = b.delta; break; }
            }
            score += w('duration') * delta;
        }

        const docId = String(task?.docId || task?.root_id || '').trim();
        if (docId) {
            const docDeltas = (cfg.docDeltas && typeof cfg.docDeltas === 'object') ? cfg.docDeltas : {};
            const docDelta = Number(docDeltas[docId] ?? 0);
            const groupDelta = Number(__tmGetPriorityGroupDeltaForDoc(docId, cfg) || 0);
            const delta = (Number.isFinite(docDelta) ? docDelta : 0) + (Number.isFinite(groupDelta) ? groupDelta : 0);
            if (Number.isFinite(delta)) score += w('doc') * delta;
        }

        return Number.isFinite(score) ? score : base;
    }

    function __tmEnsureTaskPriorityScore(taskLike, options = {}) {
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : null;
        if (!task) return 0;
        const opts = (options && typeof options === 'object') ? options : {};
        const force = opts.force === true;
        const nowTs = Number.isFinite(Number(opts.nowTs)) ? Number(opts.nowTs) : Date.now();
        const cacheVersion = Number(SettingsStore?.data?.settingsUpdatedAt || 0);
        const raw = Number(task.priorityScore);
        const cacheUntil = Number(task.__tmPriorityScoreCacheUntil || 0);
        if (!force
            && Number.isFinite(raw)
            && Number(task.__tmPriorityScoreCacheVersion || 0) === cacheVersion
            && (!cacheUntil || nowTs < cacheUntil)) {
            return raw;
        }
        const memo = opts.timeInfoMemo instanceof Map ? opts.timeInfoMemo : undefined;
        let nextValue = 0;
        let nextCacheUntil = 0;
        try {
            const dueInfo = __tmGetTaskEffectiveCompletionTimeInfo(task, {
                field: 'priorityScore',
                memo,
                useBestSubtaskTime: opts.useEffectiveDueTime === false ? false : undefined,
            });
            const computed = Number(__tmComputePriorityScore(task, {
                timeInfoMemo: memo,
                dueInfo,
                nowTs,
                useEffectiveDueTime: opts.useEffectiveDueTime,
            }));
            nextValue = Number.isFinite(computed) ? computed : 0;
            nextCacheUntil = Number(__tmResolvePriorityScoreCacheUntil(task, {
                config: (SettingsStore.data.priorityScoreConfig && typeof SettingsStore.data.priorityScoreConfig === 'object')
                    ? SettingsStore.data.priorityScoreConfig
                    : {},
                dueInfo,
                dueRanges: __tmGetPriorityScoreDueRanges(),
                nowTs,
                timeInfoMemo: memo,
                useEffectiveDueTime: opts.useEffectiveDueTime,
            })) || 0;
        } catch (e) {
            nextValue = 0;
            nextCacheUntil = 0;
        }
        task.priorityScore = nextValue;
        try { task.__tmPriorityScoreCacheVersion = cacheVersion; } catch (e) {}
        try { task.__tmPriorityScoreCacheUntil = nextCacheUntil; } catch (e) {}
        return nextValue;
    }

    let __tmCellEditorState = null;

    function __tmNormalizeViewRefreshDetail(input = {}) {
        const raw = (input && typeof input === 'object') ? input : {};
        const mode0 = String(raw.mode || raw.scope || 'current').trim().toLowerCase();
        const mode = (mode0 === 'full' || mode0 === 'detail') ? mode0 : 'current';
        const taskIds = Array.isArray(raw.taskIds)
            ? raw.taskIds.map((id) => String(id || '').trim()).filter(Boolean)
            : [];
        return {
            mode,
            withFilters: raw.withFilters !== false,
            reason: String(raw.reason || '').trim() || 'view-refresh',
            taskIds,
        };
    }

    function __tmViewRefreshPriority(mode) {
        const key = String(mode || '').trim().toLowerCase();
        if (key === 'full') return 3;
        if (key === 'current') return 2;
        if (key === 'detail') return 1;
        return 0;
    }

    function __tmMergeViewRefreshDetail(prev, next) {
        const right = __tmNormalizeViewRefreshDetail(next);
        if (!prev) return right;
        const left = __tmNormalizeViewRefreshDetail(prev);
        const mode = __tmViewRefreshPriority(right.mode) >= __tmViewRefreshPriority(left.mode) ? right.mode : left.mode;
        const taskIds = Array.from(new Set([...(left.taskIds || []), ...(right.taskIds || [])]));
        return {
            mode,
            withFilters: left.withFilters !== false || right.withFilters !== false,
            reason: right.reason || left.reason || 'view-refresh',
            taskIds,
        };
    }

    function __tmCollectGlobalTaskDetailUiReasons() {
        const reasons = [];
        try {
            const popover = document.querySelector('.tm-task-detail-inline-popover');
            if (popover instanceof Element && document.body.contains(popover)) reasons.push('global-popover-open');
        } catch (e) {}
        try {
            const menuTrigger = document.querySelector('[data-tm-detail-status-trigger][aria-expanded="true"], [data-tm-detail-priority-trigger][aria-expanded="true"]');
            if (menuTrigger instanceof Element && document.body.contains(menuTrigger)) reasons.push('global-menu-open');
        } catch (e) {}
        try {
            const inlineAnchor = __tmInlineEditorState?.anchorEl;
            if (inlineAnchor instanceof Element && document.body.contains(inlineAnchor)) reasons.push('global-inline-editor-open');
        } catch (e) {}
        return Array.from(new Set(reasons));
    }

    let __tmTaskDetailSessionSeq = 0;

    function __tmResolveTaskDetailRootTaskId(rootEl) {
        const root = rootEl instanceof Element ? rootEl : null;
        if (!(root instanceof Element)) return '';
        return String(root.dataset?.tmDetailTaskId || root.__tmTaskDetailTaskId || root.__tmTaskDetailTask?.id || '').trim();
    }

    function __tmCreateTaskDetailSession(rootEl, taskId = '') {
        const root = rootEl instanceof Element ? rootEl : null;
        if (!(root instanceof Element)) return 0;
        const tid = String(taskId || __tmResolveTaskDetailRootTaskId(root)).trim();
        __tmTaskDetailSessionSeq = Math.max(0, Number(__tmTaskDetailSessionSeq) || 0) + 1;
        const sessionId = __tmTaskDetailSessionSeq;
        try { root.__tmTaskDetailSessionId = sessionId; } catch (e) {}
        try { root.__tmTaskDetailTaskId = tid; } catch (e) {}
        try { root.__tmTaskDetailClosing = false; } catch (e) {}
        try { root.__tmTaskDetailClosed = false; } catch (e) {}
        if (tid) {
            try { root.dataset.tmDetailTaskId = tid; } catch (e) {}
        }
        return sessionId;
    }

    function __tmIsTaskDetailRootUsable(rootEl, options = {}) {
        const root = rootEl instanceof Element ? rootEl : null;
        if (!(root instanceof Element)) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const expectedSessionId = Math.max(0, Number(opts.sessionId) || 0);
        const expectedTaskId = String(opts.taskId || '').trim();
        if (expectedSessionId && Number(root.__tmTaskDetailSessionId || 0) !== expectedSessionId) return false;
        if (root.__tmTaskDetailClosing === true || root.__tmTaskDetailClosed === true) return false;
        if (opts.requireConnected !== false && !root.isConnected) return false;
        const currentTaskId = __tmResolveTaskDetailRootTaskId(root);
        if (expectedTaskId && currentTaskId && currentTaskId !== expectedTaskId) return false;
        return true;
    }

    function __tmMarkTaskDetailRootClosing(rootEl, options = {}) {
        const root = rootEl instanceof Element ? rootEl : null;
        if (!(root instanceof Element)) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const expectedSessionId = Math.max(0, Number(opts.sessionId) || 0);
        if (expectedSessionId && Number(root.__tmTaskDetailSessionId || 0) !== expectedSessionId) return false;
        try { root.__tmTaskDetailClosing = true; } catch (e) {}
        const holdMs = Math.max(0, Number(opts.holdMs) || 0);
        if (holdMs > 0) {
            try {
                const prevUntil = Math.max(0, Number(root.__tmTaskDetailRefreshHoldUntil) || 0);
                root.__tmTaskDetailRefreshHoldUntil = Math.max(prevUntil, Date.now() + holdMs);
            } catch (e) {}
        }
        return true;
    }

    function __tmMarkTaskDetailRootClosed(rootEl, options = {}) {
        const root = rootEl instanceof Element ? rootEl : null;
        if (!(root instanceof Element)) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const expectedSessionId = Math.max(0, Number(opts.sessionId) || 0);
        if (expectedSessionId && Number(root.__tmTaskDetailSessionId || 0) !== expectedSessionId) return false;
        try { root.__tmTaskDetailClosed = true; } catch (e) {}
        try { root.__tmTaskDetailClosing = true; } catch (e) {}
        return true;
    }

    function __tmCollectBusyTaskDetailRoots() {
        const roots = [];
        try {
            const overlay = document.getElementById('tm-task-detail-overlay');
            const overlayTaskId = String(overlay?.__tmTaskDetailTask?.id || overlay?.dataset?.tmDetailTaskId || '').trim();
            if (overlay instanceof HTMLElement && document.body.contains(overlay) && overlayTaskId) {
                roots.push({ scope: 'overlay', root: overlay, taskId: overlayTaskId });
            }
        } catch (e) {}
        try {
            const modal = state.modal instanceof Element && document.body.contains(state.modal) ? state.modal : null;
            if (!(modal instanceof Element)) return roots;
            if (__tmIsChecklistSelectionContext(modal)) {
                const panel = __tmResolveChecklistDetailPanel(modal).panel;
                const taskId = String(panel?.__tmTaskDetailTask?.id || panel?.dataset?.tmDetailTaskId || state.detailTaskId || '').trim();
                if (panel instanceof HTMLElement && taskId) roots.push({ scope: 'checklist', root: panel, taskId });
            }
            if (String(state.viewMode || '').trim() === 'kanban') {
                const panel = modal.querySelector('#tmKanbanDetailPanel');
                const taskId = String(panel?.__tmTaskDetailTask?.id || panel?.dataset?.tmDetailTaskId || state.kanbanDetailTaskId || '').trim();
                if (panel instanceof HTMLElement && taskId) roots.push({ scope: 'kanban', root: panel, taskId });
            }
        } catch (e) {}
        return roots;
    }

    function __tmGetBusyTaskDetailBarrier() {
        const globalReasons = __tmCollectGlobalTaskDetailUiReasons();
        const entries = __tmCollectBusyTaskDetailRoots().map((meta) => {
            const reasons = Array.from(new Set([
                ...__tmCollectTaskDetailFallbackDeferReasons(meta.root),
                ...(Array.isArray(globalReasons) ? globalReasons : []),
            ]));
            if (!reasons.length) return null;
            const holdMsLeft = Math.max(0, Number(meta.root?.__tmTaskDetailRefreshHoldUntil || 0) - Date.now());
            let waitMs = holdMsLeft;
            if (reasons.some((reason) => reason === 'active-popover' || reason === 'menu-open' || reason === 'inline-editor-open')) waitMs = Math.max(waitMs, 220);
            if (reasons.some((reason) => reason === 'global-popover-open' || reason === 'global-inline-editor-open')) waitMs = Math.max(waitMs, 260);
            if (reasons.includes('global-menu-open')) waitMs = Math.max(waitMs, 220);
            if (reasons.includes('pending-save')) waitMs = Math.max(waitMs, 180);
            if (reasons.includes('closing')) waitMs = Math.max(waitMs, 120);
            return {
                ...meta,
                reasons,
                holdMsLeft,
                waitMs: Math.max(120, Math.min(480, waitMs || 180)),
            };
        }).filter(Boolean);
        if (!entries.length && Array.isArray(globalReasons) && globalReasons.length) {
            entries.push({
                scope: 'global-detail-ui',
                root: null,
                taskId: String(state.detailTaskId || state.kanbanDetailTaskId || '').trim(),
                reasons: globalReasons.slice(),
                holdMsLeft: 0,
                waitMs: 260,
            });
        }
        if (!entries.length) return null;
        return {
            entries,
            waitMs: Math.max(...entries.map((entry) => Math.max(120, Number(entry.waitMs) || 0))),
        };
    }

    function __tmScheduleBusyDetailViewRefresh(detail = {}) {
        const next = __tmNormalizeViewRefreshDetail(detail);
        state.busyDetailViewRefreshPending = __tmMergeViewRefreshDetail(state.busyDetailViewRefreshPending, next);
        const armTimer = () => {
            if (state.busyDetailViewRefreshTimer) return true;
            const barrier = __tmGetBusyTaskDetailBarrier();
            const waitMs = Math.max(80, Number(barrier?.waitMs || 120) || 120);
            state.busyDetailViewRefreshTimer = setTimeout(() => {
                state.busyDetailViewRefreshTimer = 0;
                const pending = state.busyDetailViewRefreshPending;
                if (!pending) return;
                const nextBarrier = __tmGetBusyTaskDetailBarrier();
                if (nextBarrier) {
                    try {
                        __tmPushDetailDebug('detail-host-defer-refresh-still-busy', {
                            mode: pending.mode,
                            reason: pending.reason,
                            withFilters: pending.withFilters !== false,
                            taskIds: Array.isArray(pending.taskIds) ? pending.taskIds.slice() : [],
                            barrier: nextBarrier.entries.map((entry) => ({
                                scope: entry.scope,
                                taskId: entry.taskId,
                                reasons: entry.reasons.slice(),
                                holdMsLeft: entry.holdMsLeft,
                            })),
                        });
                    } catch (e) {}
                    armTimer();
                    return;
                }
                state.busyDetailViewRefreshPending = null;
                try {
                    __tmPushDetailDebug('detail-host-defer-refresh-flush', {
                        mode: pending.mode,
                        reason: pending.reason,
                        withFilters: pending.withFilters !== false,
                        taskIds: Array.isArray(pending.taskIds) ? pending.taskIds.slice() : [],
                    });
                } catch (e) {}
                __tmPerformViewRefresh(pending);
            }, waitMs);
            return true;
        };
        try {
            const barrier = __tmGetBusyTaskDetailBarrier();
            __tmPushDetailDebug('detail-host-defer-refresh', {
                mode: next.mode,
                reason: next.reason,
                withFilters: next.withFilters !== false,
                taskIds: Array.isArray(next.taskIds) ? next.taskIds.slice() : [],
                barrier: Array.isArray(barrier?.entries) ? barrier.entries.map((entry) => ({
                    scope: entry.scope,
                    taskId: entry.taskId,
                    reasons: entry.reasons.slice(),
                    holdMsLeft: entry.holdMsLeft,
                })) : [],
            });
        } catch (e) {}
        return armTimer();
    }

    function __tmPerformViewRefresh(detail = {}) {
        const next = __tmNormalizeViewRefreshDetail(detail);
        try {
            const currentDetailId = String(state.detailTaskId || state.kanbanDetailTaskId || '').trim();
            if (currentDetailId) {
                __tmPushDetailDebug('detail-host-view-refresh', {
                    taskId: currentDetailId,
                    mode: next.mode,
                    reason: next.reason,
                    withFilters: next.withFilters !== false,
                    taskIds: Array.isArray(next.taskIds) ? next.taskIds.slice() : [],
                    viewMode: String(state.viewMode || '').trim(),
                });
            }
        } catch (e) {}
        if (next.mode !== 'detail') {
            const barrier = __tmGetBusyTaskDetailBarrier();
            if (barrier) {
                __tmScheduleBusyDetailViewRefresh(next);
                return true;
            }
        }
        if (!state.modal || !document.body.contains(state.modal)) {
            try { render(); } catch (e) {}
            return true;
        }
        if (next.mode === 'full') {
            if (next.withFilters !== false) {
                try { applyFilters(); } catch (e) {}
            }
            try { render(); } catch (e) {}
            return true;
        }
        if (next.mode === 'detail') {
            let refreshed = false;
            (Array.isArray(next.taskIds) ? next.taskIds : []).forEach((taskId) => {
                try { refreshed = !!__tmRefreshVisibleTaskDetailForTask(taskId) || refreshed; } catch (e) {}
            });
            if (!refreshed) {
                try { refreshed = !!__tmRerenderCurrentViewInPlace(state.modal); } catch (e) {}
            }
            if (!refreshed) {
                try { render(); } catch (e) {}
            }
            return true;
        }
        try {
            __tmRefreshMainViewInPlace({ withFilters: next.withFilters !== false });
        } catch (e) {
            try { render(); } catch (e2) {}
        }
        return true;
    }

    function __tmScheduleViewRefresh(detail = {}) {
        state.viewRefreshPending = __tmMergeViewRefreshDetail(state.viewRefreshPending, detail);
        try { __tmPushRefreshDebug('view-refresh-queued', state.viewRefreshPending); } catch (e) {}
        if (state.viewRefreshTimer) return true;
        state.viewRefreshSeq = (Number(state.viewRefreshSeq) || 0) + 1;
        state.viewRefreshTimer = setTimeout(() => {
            state.viewRefreshTimer = 0;
            const next = state.viewRefreshPending;
            state.viewRefreshPending = null;
            if (!next) return;
            const deferForTaskFieldWork = __tmShouldDeferTaskFieldRefreshWork();
            const deferForActiveScroll = __tmShouldDeferMainViewRefreshForActiveScroll(next);
            if (deferForTaskFieldWork || deferForActiveScroll) {
                state.viewRefreshPending = __tmMergeViewRefreshDetail(state.viewRefreshPending, next);
                try {
                    __tmPushRefreshDebug(deferForActiveScroll ? 'view-refresh-deferred-scroll' : 'view-refresh-deferred', {
                        reason: [
                            deferForTaskFieldWork && state.isRefreshing ? 'refresh-core' : '',
                            deferForTaskFieldWork && __tmTxTaskRefreshInFlight ? 'tx-refresh-in-flight' : '',
                            deferForTaskFieldWork && __tmTxTaskRefreshTimer ? 'tx-refresh-queued' : '',
                            deferForTaskFieldWork && __tmTabEnterAutoRefreshInFlight ? 'auto-refresh-in-flight' : '',
                            deferForActiveScroll ? 'scroll-active' : '',
                            deferForActiveScroll && state.listAutoLoadMoreInFlight ? 'list-auto-load-more' : '',
                        ].filter(Boolean).join(','),
                        deferDelayMs: deferForActiveScroll ? __tmGetDeferredMainViewRefreshDelay(next) : 96,
                        pending: state.viewRefreshPending,
                    });
                } catch (e) {}
                if (deferForActiveScroll) {
                    try { __tmScheduleDeferredRefreshAfterScroll('view-refresh'); } catch (e) {}
                    return;
                }
                try { __tmFlushDeferredViewRefreshAfterTaskFieldWork('view-refresh'); } catch (e) {}
                return;
            }
            try { __tmPushRefreshDebug('view-refresh-perform', next); } catch (e) {}
            __tmPerformViewRefresh(next);
        }, 24);
        return true;
    }

    function __tmScheduleListProjectionRefresh(detail = {}, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const next = __tmNormalizeViewRefreshDetail({
            ...(detail && typeof detail === 'object' ? detail : {}),
            mode: 'current',
            withFilters: true,
        });
        state.listProjectionRefreshPending = __tmMergeViewRefreshDetail(state.listProjectionRefreshPending, next);
        try { __tmPushRefreshDebug('list-projection-refresh-queued', state.listProjectionRefreshPending); } catch (e) {}
        const immediate = opts.immediate === true || Number(opts.delayMs) <= 0;
        if (immediate) {
            if (state.listProjectionRefreshTimer) {
                try { clearTimeout(state.listProjectionRefreshTimer); } catch (e) {}
                state.listProjectionRefreshTimer = 0;
            }
            const pending = state.listProjectionRefreshPending;
            state.listProjectionRefreshPending = null;
            if (!pending) return true;
            try { __tmPushRefreshDebug('list-projection-refresh-flush-immediate', pending); } catch (e) {}
            __tmScheduleViewRefresh(pending);
            return true;
        }
        const waitMs = Math.max(120, Number(opts.delayMs) || 1000);
        if (state.listProjectionRefreshTimer) {
            try { clearTimeout(state.listProjectionRefreshTimer); } catch (e) {}
            state.listProjectionRefreshTimer = 0;
            try {
                __tmPushRefreshDebug('list-projection-refresh-rearm', {
                    reason: next.reason,
                    waitMs,
                    taskIds: Array.isArray(state.listProjectionRefreshPending?.taskIds)
                        ? state.listProjectionRefreshPending.taskIds.slice()
                        : [],
                });
            } catch (e) {}
        }
        state.listProjectionRefreshTimer = setTimeout(() => {
            state.listProjectionRefreshTimer = 0;
            const pending = state.listProjectionRefreshPending;
            state.listProjectionRefreshPending = null;
            if (!pending) return;
            if (String(state.viewMode || '').trim() !== 'list') {
                try {
                    __tmPushRefreshDebug('list-projection-refresh-drop', {
                        reason: pending.reason,
                        viewMode: String(state.viewMode || '').trim(),
                        taskIds: Array.isArray(pending.taskIds) ? pending.taskIds.slice() : [],
                    });
                } catch (e) {}
                return;
            }
            try { __tmPushRefreshDebug('list-projection-refresh-flush', pending); } catch (e) {}
            __tmScheduleViewRefresh(pending);
        }, waitMs);
        return true;
    }

    function __tmRefreshMainViewInPlace(options = {}) {
        const withFilters = !(options && options.withFilters === false);
        const reason = String(options?.reason || '').trim() || 'main-view-refresh';
        try { __tmPushRefreshDebug('main-view-refresh', { withFilters, viewMode: String(state.viewMode || '').trim() || '' }); } catch (e) {}
        try {
            const currentDetailId = String(state.detailTaskId || state.kanbanDetailTaskId || '').trim();
            if (currentDetailId) {
                __tmPushDetailDebug('detail-host-main-view-refresh', {
                    taskId: currentDetailId,
                    viewMode: String(state.viewMode || '').trim(),
                    withFilters,
                    reason,
                });
            }
        } catch (e) {}
        if (options?.deferIfDetailBusy !== false) {
            const barrier = __tmGetBusyTaskDetailBarrier();
            if (barrier) {
                __tmScheduleBusyDetailViewRefresh({
                    mode: 'current',
                    withFilters,
                    reason,
                });
                return;
            }
        }
        if (withFilters) applyFilters();
        if (!state.modal || !document.body.contains(state.modal)) {
            render();
            return;
        }
        if (state.viewMode === 'calendar') {
            if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
            return;
        }
        if (state.viewMode === 'timeline') {
            if (!__tmRerenderTimelineInPlace(state.modal)) render();
            return;
        }
        if (state.viewMode === 'checklist') {
            __tmRenderChecklistPreserveScroll();
            return;
        }
        if (state.viewMode === 'kanban' || state.viewMode === 'whiteboard') {
            if (!__tmRerenderCurrentViewInPlace(state.modal)) render();
            return;
        }
        if (state.viewMode !== 'calendar' && state.viewMode !== 'checklist') {
            if (!__tmRerenderListInPlace(state.modal)) render();
            return;
        }
        render();
    }

    const __tmFieldSpecs = {
        done: {
            key: 'done',
            storageKind: 'marker+attr',
            requiresBlockUpdate: true,
            requiresAttrWrite: false,
            affectsProjection: true,
            supportsLocalPatch: true,
            coalesceKey: 'done',
        },
        customStatus: {
            key: 'customStatus',
            storageKind: 'marker+attr',
            requiresBlockUpdate: true,
            requiresAttrWrite: true,
            affectsProjection: true,
            supportsLocalPatch: true,
            coalesceKey: 'status',
        },
        priority: {
            key: 'priority',
            storageKind: 'attr-only',
            requiresBlockUpdate: false,
            requiresAttrWrite: true,
            affectsProjection: true,
            supportsLocalPatch: true,
            coalesceKey: 'priority',
        },
        startDate: {
            key: 'startDate',
            storageKind: 'attr-only',
            requiresBlockUpdate: false,
            requiresAttrWrite: true,
            affectsProjection: true,
            supportsLocalPatch: true,
            coalesceKey: 'time',
        },
        completionTime: {
            key: 'completionTime',
            storageKind: 'attr-only',
            requiresBlockUpdate: false,
            requiresAttrWrite: true,
            affectsProjection: true,
            supportsLocalPatch: true,
            coalesceKey: 'time',
        },
        duration: {
            key: 'duration',
            storageKind: 'attr-only',
            requiresBlockUpdate: false,
            requiresAttrWrite: true,
            affectsProjection: false,
            supportsLocalPatch: true,
            coalesceKey: 'time',
        },
        remark: {
            key: 'remark',
            storageKind: 'attr-only',
            requiresBlockUpdate: false,
            requiresAttrWrite: true,
            affectsProjection: false,
            supportsLocalPatch: true,
            coalesceKey: 'remark',
        },
        attachments: {
            key: 'attachments',
            storageKind: 'attr-only',
            requiresBlockUpdate: false,
            requiresAttrWrite: true,
            affectsProjection: false,
            supportsLocalPatch: true,
            coalesceKey: 'attachments',
        },
        customFieldValues: {
            key: 'customFieldValues',
            storageKind: 'attr-only',
            requiresBlockUpdate: false,
            requiresAttrWrite: true,
            affectsProjection: true,
            supportsLocalPatch: true,
            coalesceKey: 'customFieldValues',
        },
    };

    const __tmTaskStateKernel = {
        getTask(taskId) {
            const tid = String(taskId || '').trim();
            if (!tid) return null;
            return state.flatTasks?.[tid] || state.pendingInsertedTasks?.[tid] || null;
        },
        snapshotTask(taskId) {
            const task = this.getTask(taskId);
            if (!task || typeof task !== 'object') return null;
            try {
                return JSON.parse(JSON.stringify(task));
            } catch (e) {
                return { ...task };
            }
        },
        patchTaskLocal(taskId, patch, options = {}) {
            const tid = String(taskId || '').trim();
            const nextPatch = (patch && typeof patch === 'object') ? patch : {};
            if (!tid || !Object.keys(nextPatch).length) return false;
            if (Object.prototype.hasOwnProperty.call(nextPatch, 'done')) {
                const doneValue = !!nextPatch.done;
                const statusPatch = Object.prototype.hasOwnProperty.call(nextPatch, 'customStatus')
                    ? { customStatus: String(nextPatch.customStatus || '').trim() }
                    : null;
                __tmApplyDoneOptimisticLocal(tid, doneValue, statusPatch, String(options.source || '').trim());
                const restPatch = { ...nextPatch };
                delete restPatch.done;
                if (Object.keys(restPatch).length > 0) {
                    __tmApplyAttrPatchLocally(tid, restPatch, { render: false, withFilters: false });
                }
                return true;
            }
            if (Object.prototype.hasOwnProperty.call(nextPatch, 'customStatus')) {
                const statusId = String(nextPatch.customStatus || '').trim();
                if (statusId) {
                    const statusOption = __tmFindStatusOptionById(statusId);
                    const marker = __tmNormalizeTaskStatusMarker(statusOption?.marker, __tmGuessStatusOptionDefaultMarker(statusOption));
                    __tmApplyTaskStatusLocalState(tid, statusId, marker);
                }
                const restPatch = { ...nextPatch };
                delete restPatch.customStatus;
                if (Object.keys(restPatch).length > 0) {
                    __tmApplyAttrPatchLocally(tid, restPatch, { render: false, withFilters: false });
                }
                return true;
            }
            __tmApplyAttrPatchLocally(tid, nextPatch, { render: false, withFilters: false });
            return true;
        },
        rollbackTaskLocal(taskId, inversePatch, options = {}) {
            const tid = String(taskId || '').trim();
            const prevPatch = (inversePatch && typeof inversePatch === 'object') ? inversePatch : {};
            if (!tid || !Object.keys(prevPatch).length) return false;
            if (Object.prototype.hasOwnProperty.call(prevPatch, 'done')) {
                __tmRollbackDoneOptimisticLocal(tid, prevPatch, String(options.source || '').trim());
                const restPatch = { ...prevPatch };
                delete restPatch.done;
                if (Object.keys(restPatch).length > 0) {
                    __tmRollbackAttrPatchLocally(tid, restPatch, { render: false, withFilters: false });
                }
                return true;
            }
            if (Object.prototype.hasOwnProperty.call(prevPatch, 'customStatus')) {
                const statusId = String(prevPatch.customStatus || '').trim();
                if (statusId) {
                    const statusOption = __tmFindStatusOptionById(statusId);
                    const marker = __tmNormalizeTaskStatusMarker(statusOption?.marker, __tmGuessStatusOptionDefaultMarker(statusOption));
                    __tmApplyTaskStatusLocalState(tid, statusId, marker);
                }
                const restPatch = { ...prevPatch };
                delete restPatch.customStatus;
                if (Object.keys(restPatch).length > 0) {
                    __tmRollbackAttrPatchLocally(tid, restPatch, { render: false, withFilters: false });
                }
                return true;
            }
            __tmRollbackAttrPatchLocally(tid, prevPatch, { render: false, withFilters: false });
            return true;
        },
    };

    function __tmGetPatchFieldKeys(patch = {}) {
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        return Object.keys(nextPatch).filter((key) => Object.prototype.hasOwnProperty.call(nextPatch, key));
    }

    function __tmGetFieldSpec(key) {
        const normalized = String(key || '').trim();
        if (!normalized) return null;
        return __tmFieldSpecs[normalized] || null;
    }

    function __tmIsSimpleProjectionContext() {
        if (state.currentRule) return false;
        if (state.groupByTime || state.groupByTaskName || state.quadrantEnabled) return false;
        return true;
    }

    function __tmShouldSuppressChecklistDetailSaveRefresh(taskId, patch = {}, options = {}) {
        const tid = String(taskId || '').trim();
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        const opts = (options && typeof options === 'object') ? options : {};
        const reason = String(opts.reason || '').trim();
        if (!tid || !Object.keys(nextPatch).length) return false;
        if (String(state.viewMode || '').trim() !== 'checklist') return false;
        if (reason !== 'detail-save' && reason !== 'detail-time-save') return false;
        if (String(state.detailTaskId || '').trim() !== tid) return false;
        if (!(state.modal instanceof Element) || !document.body.contains(state.modal)) return false;
        if (!__tmIsChecklistSelectionContext(state.modal)) return false;
        return true;
    }

    function __tmDoesPatchAffectProjection(taskId, patch = {}) {
        const keys = __tmGetPatchFieldKeys(patch);
        if (!keys.length) return false;
        if (!__tmIsSimpleProjectionContext()) {
            return keys.some((key) => __tmGetFieldSpec(key)?.affectsProjection === true);
        }
        return false;
    }

    function __tmDoesPatchAffectCurrentSort(taskId, patch = {}) {
        const keys = __tmGetPatchFieldKeys(patch);
        if (!keys.length) return false;
        if (state.currentRule) return true;
        return !!(state.groupByTime || state.groupByTaskName || state.quadrantEnabled);
    }

    function __tmDoesPatchAffectCurrentGroup(taskId, patch = {}) {
        return __tmDoesPatchAffectCurrentSort(taskId, patch);
    }

    function __tmDoesPatchAffectCurrentFilter(taskId, patch = {}) {
        return __tmDoesPatchAffectProjection(taskId, patch);
    }

    function __tmShouldDeferTaskFieldRefreshWork() {
        return !!(
            state.isRefreshing
            || __tmTxTaskRefreshInFlight
            || __tmTabEnterAutoRefreshInFlight
        );
    }

    function __tmDoesPatchNeedImmediateListProjectionRefresh(patch = {}) {
        const keys = __tmGetPatchFieldKeys(patch);
        if (!keys.length) return false;
        return keys.some((key) => key === 'startDate' || key === 'completionTime' || key === 'customTime' || key === 'taskCompleteAt');
    }

    function __tmBuildListProjectionRefreshScheduleOptions(patch = {}, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const reason = String(opts.reason || '').trim();
        const immediate = __tmDoesPatchNeedImmediateListProjectionRefresh(patch) && !__tmShouldDeferTaskFieldRefreshWork();
        if (immediate) return { immediate: true };
        let delayMs = 1000;
        if (__tmShouldDeferTaskFieldRefreshWork()) delayMs = 180;
        if (reason === 'tx-attr-update' || reason === 'change-feed-attr' || reason === 'native-doc-checkbox-sync') delayMs = 180;
        return {
            immediate: false,
            delayMs,
        };
    }

    function __tmDoesPatchNeedProjectionRefresh(taskId, patch = {}, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (opts.forceProjectionRefresh === true) return true;
        if (__tmDoesPatchAffectProjection(taskId, patch)) return true;
        if (__tmDoesPatchAffectCurrentSort(taskId, patch)) return true;
        if (__tmDoesPatchAffectCurrentGroup(taskId, patch)) return true;
        if (__tmDoesPatchAffectCurrentFilter(taskId, patch)) return true;
        return false;
    }

    function __tmShouldRefreshWithFiltersForPatch(taskId, patch = {}, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (opts.withFilters !== false) return true;
        return __tmDoesPatchNeedProjectionRefresh(taskId, patch, opts);
    }

    function __tmPatchAffectsCalendar(patch = {}) {
        const keys = __tmGetPatchFieldKeys(patch);
        if (!keys.length) return false;
        const calendarKeys = new Set([
            'done',
            'customStatus',
            'startDate',
            'completionTime',
            'taskCompleteAt',
            'customTime',
            'repeatRule',
            'repeatState',
            'repeatHistory',
        ]);
        return keys.some((key) => calendarKeys.has(String(key || '').trim()));
    }

    function __tmArmChecklistRenderGuard(reason = '', ttlMs = 420) {
        const mode = String(state.viewMode || '').trim();
        if (mode !== 'checklist') return false;
        if (!(state.modal instanceof Element) || !document.body.contains(state.modal)) return false;
        state.__tmChecklistRenderGuardUntil = Date.now() + Math.max(120, Number(ttlMs) || 420);
        state.__tmChecklistRenderGuardReason = String(reason || '').trim() || 'unknown';
        try {
            __tmPushRefreshDebug('checklist-render-guard-arm', {
                until: Number(state.__tmChecklistRenderGuardUntil || 0),
                reason: String(state.__tmChecklistRenderGuardReason || '').trim(),
            });
        } catch (e) {}
        return true;
    }

    function __tmShouldFallbackTaskFieldPatch(taskId, patch = {}, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const patchKeys = __tmGetPatchFieldKeys(patch);
        const viewMode = String(state.viewMode || '').trim();
        if (__tmShouldSuppressChecklistDetailSaveRefresh(taskId, patch, opts)) {
            try {
                __tmPushRefreshDebug('task-field-fallback-bypass-checklist-detail-save', {
                    taskId: String(taskId || '').trim(),
                    patchKeys,
                    viewMode,
                    reason: String(opts.reason || '').trim(),
                    currentRule: String(state.currentRule || '').trim(),
                    groupByTime: !!state.groupByTime,
                    groupByTaskName: !!state.groupByTaskName,
                    quadrantEnabled: !!state.quadrantEnabled,
                    forceProjectionRefresh: opts.forceProjectionRefresh === true,
                });
            } catch (e) {}
            return false;
        }
        const checklistOrListSimpleDonePatch = (viewMode === 'checklist' || viewMode === 'list')
            && patchKeys.length > 0
            && patchKeys.every((key) => key === 'done' || key === 'customStatus' || key === 'taskCompleteAt')
            && !state.groupByTime
            && !state.groupByTaskName
            && !state.quadrantEnabled;
        if (checklistOrListSimpleDonePatch) {
            try {
                __tmPushRefreshDebug('task-field-fallback-bypass', {
                    taskId: String(taskId || '').trim(),
                    patchKeys,
                    viewMode,
                    currentRule: String(state.currentRule || '').trim(),
                });
            } catch (e) {}
            return false;
        }
        if (opts.forceProjectionRefresh === true) return true;
        if (__tmDoesPatchAffectProjection(taskId, patch)) return true;
        return false;
    }

    function __tmBuildMergedAttrPatch(taskId, patch = {}, options = {}) {
        const task = __tmTaskStateKernel.getTask(taskId);
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        const merged = { ...nextPatch };
        if (Object.prototype.hasOwnProperty.call(nextPatch, 'done') && !Object.prototype.hasOwnProperty.call(nextPatch, 'customStatus')) {
            const statusPatch = __tmBuildCheckboxStatusPatch(task, !!nextPatch.done, options?.statusPatch);
            if (statusPatch && Object.keys(statusPatch).length > 0) Object.assign(merged, statusPatch);
        }
        return merged;
    }

    const __tmWritePlanner = {
        normalizePatch(taskId, patch = {}, options = {}) {
            const merged = __tmBuildMergedAttrPatch(taskId, patch, options);
            const normalized = {};
            Object.entries(merged || {}).forEach(([key, value]) => {
                normalized[key] = __tmNormalizeQueueTaskValue(key, value);
            });
            return normalized;
        },
        splitPatchByStorage(taskId, patch = {}, options = {}) {
            const normalized = this.normalizePatch(taskId, patch, options);
            const statusPatch = {};
            const timePatch = {};
            const attrPatch = {};
            let doneValue = null;
            Object.entries(normalized).forEach(([key, value]) => {
                if (key === 'done') {
                    doneValue = !!value;
                    return;
                }
                if (key === 'customStatus') {
                    statusPatch.customStatus = String(value || '').trim();
                    return;
                }
                if (key === 'startDate' || key === 'completionTime' || key === 'duration' || key === 'customTime') {
                    timePatch[key] = value;
                    return;
                }
                attrPatch[key] = value;
            });
            return { normalized, doneValue, statusPatch, timePatch, attrPatch };
        },
        mergeTaskPatches(prev = {}, next = {}, options = {}) {
            const left = (prev && typeof prev === 'object') ? prev : {};
            const right = (next && typeof next === 'object') ? next : {};
            const opts = (options && typeof options === 'object') ? options : {};
            const preferExisting = opts.preferExisting === true;
            const merged = preferExisting
                ? { ...right, ...left }
                : { ...left, ...right };
            if (left.customFieldValues || right.customFieldValues) {
                merged.customFieldValues = {
                    ...(preferExisting
                        ? ((right.customFieldValues && typeof right.customFieldValues === 'object') ? right.customFieldValues : {})
                        : ((left.customFieldValues && typeof left.customFieldValues === 'object') ? left.customFieldValues : {})),
                    ...(preferExisting
                        ? ((left.customFieldValues && typeof left.customFieldValues === 'object') ? left.customFieldValues : {})
                        : ((right.customFieldValues && typeof right.customFieldValues === 'object') ? right.customFieldValues : {})),
                };
            }
            return merged;
        },
        buildWritePlan(taskId, patch = {}, options = {}) {
            const parts = this.splitPatchByStorage(taskId, patch, options);
            const fieldKeys = __tmGetPatchFieldKeys(parts.normalized);
            const task = __tmTaskStateKernel.getTask(taskId);
            const previousDone = !!task?.done;
            const statusBeforeMarker = Object.keys(parts.statusPatch || {}).length > 0
                ? (__tmResolveTaskMarkdownMarker(task) || __tmResolveTaskMarker(task))
                : '';
            const rewardPriorityScore = !!SettingsStore?.data?.enablePointsRewardIntegration
                && parts.doneValue === true
                && !previousDone
                && !__tmUndoState?.applying
                ? Math.max(0, Math.round(Number(__tmEnsureTaskPriorityScore(task, { force: true })) || 0))
                : 0;
            return {
                taskId: String(taskId || '').trim(),
                originalPatch: { ...(patch && typeof patch === 'object' ? patch : {}) },
                normalizedPatch: parts.normalized,
                fieldKeys,
                doneValue: parts.doneValue,
                previousDone,
                rewardPriorityScore,
                statusPatch: parts.statusPatch,
                statusBefore: Object.keys(parts.statusPatch || {}).length > 0
                    ? {
                        statusId: __tmResolveTaskStatusId(task),
                        marker: statusBeforeMarker,
                        done: __tmIsTaskMarkerDone(statusBeforeMarker),
                    }
                    : null,
                timePatch: parts.timePatch,
                attrPatch: parts.attrPatch,
                affectsProjection: __tmDoesPatchAffectProjection(taskId, parts.normalized),
                supportsLocalPatch: fieldKeys.every((key) => __tmGetFieldSpec(key)?.supportsLocalPatch !== false),
            };
        },
    };

    const __tmWriteExecutor = {
        lanes: new Map(),
        runInTaskLane(taskId, runner) {
            const tid = String(taskId || '').trim();
            const job = typeof runner === 'function' ? runner : async () => null;
            const prev = this.lanes.get(tid) || Promise.resolve();
            const next = prev.catch(() => null).then(job);
            this.lanes.set(tid, next.finally(() => {
                if (this.lanes.get(tid) === next) this.lanes.delete(tid);
            }));
            return next;
        },
        async executePlan(plan, options = {}) {
            const taskId = String(plan?.taskId || '').trim();
            if (!taskId) throw new Error('缺少任务 ID');
            const opts = (options && typeof options === 'object') ? options : {};
            return await this.runInTaskLane(taskId, async () => {
                if (plan.doneValue !== null) {
                    await __tmSetDoneKernel(taskId, !!plan.doneValue, null, {
                        force: true,
                        suppressHint: opts.suppressHint === true,
                        source: String(opts.source || '').trim(),
                        statusPatch: plan.statusPatch,
                        refreshMode: 'local',
                        scheduleId: String(opts.scheduleId || '').trim(),
                        previousDone: plan.previousDone === true,
                        previousStatusId: String(plan?.statusBefore?.statusId || '').trim(),
                        rewardPriorityScore: Number(plan.rewardPriorityScore) || 0,
                    });
                } else if (plan.statusPatch && Object.keys(plan.statusPatch).length > 0) {
                    await __tmApplyTaskStatus(taskId, String(plan.statusPatch.customStatus || '').trim(), {
                        source: String(opts.source || 'task-status').trim() || 'task-status',
                        label: String(opts.label || '状态').trim() || '状态',
                        refresh: false,
                        refreshCalendar: false,
                        withFilters: false,
                        broadcast: opts.broadcast !== false,
                        queued: opts.queued === true,
                        background: opts.background === true,
                        skipFlush: opts.skipFlush,
                        previousStatusId: String(plan?.statusBefore?.statusId || '').trim(),
                        previousMarker: String(plan?.statusBefore?.marker ?? ''),
                        previousDone: plan?.statusBefore?.done === true,
                    });
                }
                if (plan.timePatch && Object.keys(plan.timePatch).length > 0) {
                    await __tmCommitTaskTimeFields(taskId, plan.timePatch, {
                        source: String(opts.source || 'task-fields').trim() || 'task-fields',
                        label: String(opts.label || '任务字段').trim() || '任务字段',
                        skipNoopCheck: true,
                        broadcast: opts.broadcast !== false,
                        queued: opts.queued === true,
                        background: opts.background === true,
                        skipFlush: opts.skipFlush,
                        renderOptimistic: opts.queued !== true && opts.background !== true,
                    });
                }
                if (plan.attrPatch && Object.keys(plan.attrPatch).length > 0) {
                    await __tmApplyTaskMetaPatchWithUndo(taskId, plan.attrPatch, {
                        source: String(opts.source || 'task-fields').trim() || 'task-fields',
                        label: String(opts.label || '任务字段').trim() || '任务字段',
                        refresh: false,
                        refreshCalendar: false,
                        withFilters: false,
                        skipNoopCheck: true,
                        broadcast: opts.broadcast !== false,
                        queued: opts.queued === true,
                        background: opts.background === true,
                        skipFlush: opts.skipFlush,
                        renderOptimistic: opts.queued !== true && opts.background !== true,
                    });
                }
                return __tmTaskStateKernel.getTask(taskId);
            });
        },
    };

    function __tmUpdateTaskStatusTagInDOM(container, task) {
        const root = container instanceof Element ? container : null;
        const taskLike = (task && typeof task === 'object') ? task : null;
        if (!(root instanceof Element) || !taskLike) return false;
        const statusOption = __tmResolveTaskStatusDisplayOption(taskLike, __tmGetStatusOptions(SettingsStore.data.customStatusOptions || []), { fallbackColor: '#757575' });
        const chipStyle = __tmBuildStatusChipStyle(statusOption.color);
        const chipText = String(statusOption.name || statusOption.id || '').trim();
        const tag = root.querySelector('.tm-status-tag[data-tm-field="status"], [data-tm-field="status"] .tm-status-tag');
        if (tag instanceof HTMLElement) {
            tag.setAttribute('style', chipStyle);
            tag.textContent = chipText;
            return true;
        }
        const statusField = root.querySelector('[data-tm-field="status"]');
        if (!(statusField instanceof HTMLElement)) return false;
        if (statusField.classList.contains('tm-status-tag')) {
            statusField.setAttribute('style', chipStyle);
            statusField.textContent = chipText;
            return true;
        }
        let inner = statusField.querySelector('.tm-status-cell-inner');
        if (!(inner instanceof HTMLElement)) {
            inner = document.createElement('span');
            inner.className = 'tm-status-cell-inner';
            statusField.replaceChildren(inner);
        } else {
            inner.replaceChildren();
        }
        const chip = document.createElement('span');
        chip.className = 'tm-status-tag';
        chip.setAttribute('style', chipStyle);
        chip.textContent = chipText;
        inner.appendChild(chip);
        return true;
    }

    function __tmUpdateTaskCheckboxPriorityInDOM(container, task) {
        const root = container instanceof Element ? container : null;
        const taskLike = (task && typeof task === 'object') ? task : null;
        if (!(root instanceof Element) || !taskLike) return false;
        const color = __tmGetPriorityAccentColor(__tmResolveTaskPriorityValue(taskLike)) || '#a9afb8';
        const checkboxes = Array.from(root.querySelectorAll('.tm-task-checkbox'))
            .filter((node) => node instanceof HTMLInputElement);
        if (!checkboxes.length) return true;
        checkboxes.forEach((checkbox) => {
            checkbox.style.setProperty('--tm-checklist-checkbox-color', color);
            checkbox.style.borderColor = color;
        });
        return true;
    }

    function __tmUpdateTaskPriorityInDOM(container, task) {
        const root = container instanceof Element ? container : null;
        const taskLike = (task && typeof task === 'object') ? task : null;
        if (!(root instanceof Element) || !taskLike) return false;
        let touched = !!__tmUpdateTaskCheckboxPriorityInDOM(root, taskLike);
        const cell = root.querySelector('[data-tm-field="priority"]');
        if (!(cell instanceof HTMLElement)) return touched;
        cell.innerHTML = __tmRenderPriorityJira(String(taskLike.priority || '').trim(), false);
        return true;
    }

    function __tmUpdateTaskScoreInDOM(container, task) {
        const root = container instanceof Element ? container : null;
        const taskLike = (task && typeof task === 'object') ? task : null;
        if (!(root instanceof Element) || !taskLike) return false;
        const cell = root.querySelector('[data-tm-field="score"]');
        if (!(cell instanceof HTMLElement)) return true;
        const nextValue = Math.round(__tmEnsureTaskPriorityScore(taskLike));
        cell.textContent = String(nextValue);
        return true;
    }

    function __tmUpdateTaskRemarkInDOM(container, task) {
        const root = container instanceof Element ? container : null;
        const taskLike = (task && typeof task === 'object') ? task : null;
        if (!(root instanceof Element) || !taskLike) return false;
        let touched = false;
        const remarkCell = root.querySelector('[data-tm-field="remark"]');
        if (remarkCell instanceof HTMLElement) {
            const text = String(taskLike.remark || '');
            remarkCell.setAttribute('title', text);
            const textEl = remarkCell.querySelector('.tm-task-remark-text');
            if (textEl instanceof HTMLElement) textEl.textContent = text;
            else remarkCell.innerHTML = `<span class="tm-task-remark-text">${esc(text)}</span>`;
            touched = true;
        }
        const remarkIconSlot = root.querySelector('[data-tm-field="remarkIcon"]');
        if (remarkIconSlot instanceof HTMLElement) {
            remarkIconSlot.innerHTML = __tmRenderRemarkIcon(taskLike.remark);
            touched = true;
        }
        return touched || (!(remarkCell instanceof HTMLElement) && !(remarkIconSlot instanceof HTMLElement));
    }

    function __tmResolveTaskAttachmentHref(path) {
        const normalizedPath = __tmNormalizeTaskAttachmentPath(path);
        if (!normalizedPath) return '';
        if (__tmIsTaskAttachmentBlockRef(normalizedPath)) return '';
        if (/^(?:https?:|file:|data:|blob:)/i.test(normalizedPath)) return normalizedPath;
        try {
            const baseHref = String(document.getElementById('baseURL')?.getAttribute('href') || '').trim().replace(/\/+$/, '');
            if (baseHref) return `${baseHref}/${normalizedPath.replace(/^\/+/, '')}`;
        } catch (e) {}
        return `/${normalizedPath.replace(/^\/+/, '')}`;
    }

    let __tmTaskAttachmentViewerScriptPromise = null;

    function __tmGetTaskAttachmentFiles(source) {
        if (!source) return [];
        const rawList = Array.isArray(source)
            ? source
            : ((typeof FileList !== 'undefined' && source instanceof FileList)
                ? Array.from(source)
                : ((source && typeof source === 'object' && 'files' in source)
                    ? Array.from(source.files || [])
                    : []));
        return rawList.filter((file) => file instanceof File && String(file?.name || '').trim());
    }

    function __tmTaskAttachmentDataTransferHasFiles(dataTransfer) {
        const data = (dataTransfer && typeof dataTransfer === 'object') ? dataTransfer : null;
        if (!data) return false;
        if (__tmGetTaskAttachmentFiles(data).length) return true;
        const items = Array.from(data.items || []);
        if (items.some((item) => String(item?.kind || '').trim() === 'file')) return true;
        const types = Array.from(data.types || []).map((item) => String(item || '').trim());
        return types.includes('Files') || types.includes('application/x-moz-file');
    }

    function __tmBuildTaskAttachmentPasteTimestamp() {
        const now = new Date();
        const pad = (value) => String(value).padStart(2, '0');
        return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    }

    function __tmBuildTaskAttachmentClipboardFiles(clipboardData) {
        const items = Array.from(clipboardData?.items || []);
        if (!items.length) return [];
        const extByMime = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/webp': 'webp',
            'image/gif': 'gif',
            'image/svg+xml': 'svg',
            'image/avif': 'avif',
            'image/bmp': 'bmp',
            'application/pdf': 'pdf',
            'text/plain': 'txt',
            'text/markdown': 'md',
            'text/csv': 'csv',
            'application/zip': 'zip',
            'application/json': 'json',
        };
        const timestamp = __tmBuildTaskAttachmentPasteTimestamp();
        return items.map((item, index) => {
            if (String(item?.kind || '').trim() !== 'file') return null;
            const mime = String(item?.type || '').trim().toLowerCase();
            const rawFile = item?.getAsFile?.();
            if (!(rawFile instanceof Blob)) return null;
            const ext = extByMime[mime] || (mime.startsWith('image/') ? 'png' : 'bin');
            let nextName = rawFile instanceof File ? String(rawFile.name || '').trim() : '';
            if (!nextName) nextName = `clipboard-file-${timestamp}-${String(index + 1).padStart(2, '0')}.${ext}`;
            if (!/\.[A-Za-z0-9]+$/.test(nextName)) nextName = `${nextName}.${ext}`;
            try {
                return new File([rawFile], nextName, { type: mime || rawFile.type || 'application/octet-stream' });
            } catch (e) {
                return null;
            }
        }).filter((file) => file instanceof File);
    }

    function __tmBuildTaskAttachmentClipboardImageFiles(clipboardData) {
        return __tmBuildTaskAttachmentClipboardFiles(clipboardData).filter((file) => String(file?.type || '').toLowerCase().startsWith('image/'));
    }

    function __tmParseTaskAttachmentAssetPathsFromText(text) {
        const source = String(text || '');
        if (!source.trim()) return [];
        const out = [];
        const seen = new Set();
        const pushPath = (rawValue) => {
            const normalized = __tmNormalizeTaskAttachmentPath(rawValue);
            if (!normalized || !/^assets\//i.test(normalized) || seen.has(normalized)) return;
            seen.add(normalized);
            out.push(normalized);
        };
        let match;
        const markdownPattern = /!\[[^\]]*]\((assets\/[^)\s"'<>]+)\)/gi;
        while ((match = markdownPattern.exec(source))) pushPath(match[1]);
        const plainPattern = /\bassets\/[^\s)"'<>]+/gi;
        while ((match = plainPattern.exec(source))) pushPath(match[0]);
        return out;
    }

    function __tmParseTaskAttachmentBlockIdsFromText(text) {
        const source = String(text || '').trim();
        if (!source) return [];
        const out = [];
        const seen = new Set();
        const pushId = (rawValue) => {
            const id = __tmNormalizeTaskAttachmentBlockId(rawValue, { loose: true });
            if (!id || seen.has(id)) return;
            seen.add(id);
            out.push(id);
        };
        pushId(source);
        let match;
        const blockUrlPattern = /siyuan:\/\/blocks\/([0-9]{14}-[A-Za-z0-9]+)/gi;
        while ((match = blockUrlPattern.exec(source))) pushId(match[1]);
        const blockRefPattern = /\(\(\s*([0-9]{14}-[A-Za-z0-9]+)/g;
        while ((match = blockRefPattern.exec(source))) pushId(match[1]);
        return out;
    }

    async function __tmResolveTaskAttachmentTextItems(rawText) {
        const text = String(rawText || '').trim();
        if (!text) return [];
        const assetPaths = __tmParseTaskAttachmentAssetPathsFromText(text);
        if (assetPaths.length) return assetPaths;
        const blockIds = __tmParseTaskAttachmentBlockIdsFromText(text);
        if (!blockIds.length) return [];
        let rows = [];
        try { rows = await API.getOtherBlocksByIds(blockIds); } catch (e) { rows = []; }
        const rowMap = new Map();
        (Array.isArray(rows) ? rows : []).forEach((row) => {
            const id = __tmNormalizeTaskAttachmentBlockId(row?.id || '');
            if (!id) return;
            rowMap.set(id, row);
        });
        const nextItems = [];
        blockIds.forEach((id) => {
            const row = rowMap.get(id);
            if (!row || !__tmIsTaskAttachmentSupportedBlockType(row?.type, row?.subtype)) return;
            try { __tmPrimeTaskAttachmentBlockMeta(row); } catch (e) {}
            nextItems.push(__tmBuildTaskAttachmentBlockToken(id));
        });
        return __tmNormalizeTaskAttachmentPaths(nextItems);
    }

    async function __tmUploadTaskAttachmentFiles(files, options = {}) {
        const list = __tmGetTaskAttachmentFiles(files);
        if (!list.length) return [];
        const opts = (options && typeof options === 'object') ? options : {};
        const uploadedPaths = await API.uploadAssets(list, {
            assetsDirPath: String(opts.assetsDirPath || '/assets/').trim() || '/assets/',
        });
        return __tmNormalizeTaskAttachmentPaths(uploadedPaths);
    }

    function __tmEnsureTaskAttachmentViewerLoaded() {
        const viewerCtor = globalThis.Viewer || window.Viewer;
        if (typeof viewerCtor === 'function') return Promise.resolve(viewerCtor);
        if (__tmTaskAttachmentViewerScriptPromise) return __tmTaskAttachmentViewerScriptPromise;
        __tmTaskAttachmentViewerScriptPromise = new Promise((resolve, reject) => {
            const finish = () => {
                const nextViewerCtor = globalThis.Viewer || window.Viewer;
                if (typeof nextViewerCtor === 'function') resolve(nextViewerCtor);
                else reject(new Error('思源图片查看器不可用'));
            };
            const fail = () => reject(new Error('加载思源图片查看器失败'));
            const existing = document.getElementById('protyleViewerScript') || document.getElementById('tmTaskAttachmentViewerScript');
            if (existing instanceof HTMLScriptElement) {
                if (typeof (globalThis.Viewer || window.Viewer) === 'function') {
                    finish();
                    return;
                }
                existing.addEventListener('load', finish, { once: true });
                existing.addEventListener('error', fail, { once: true });
                return;
            }
            const script = document.createElement('script');
            script.id = 'tmTaskAttachmentViewerScript';
            script.async = true;
            script.src = '/stage/protyle/js/viewerjs/viewer.js?v=1.11.7';
            script.onload = finish;
            script.onerror = fail;
            (document.head || document.documentElement || document.body)?.appendChild?.(script);
        }).catch((error) => {
            __tmTaskAttachmentViewerScriptPromise = null;
            throw error;
        });
        return __tmTaskAttachmentViewerScriptPromise;
    }

    async function __tmOpenTaskAttachmentImageViewer(path, options = {}) {
        const normalizedPath = __tmNormalizeTaskAttachmentPath(path);
        if (!normalizedPath || __tmGetTaskAttachmentKind(normalizedPath) !== 'image') return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const galleryPaths = __tmNormalizeTaskAttachmentPaths(Array.isArray(opts.galleryPaths) ? opts.galleryPaths : [normalizedPath]);
        const galleryItems = galleryPaths
            .filter((item) => !__tmIsTaskAttachmentBlockRef(item) && __tmGetTaskAttachmentKind(item) === 'image')
            .map((item) => ({
                path: item,
                name: __tmGetTaskAttachmentDisplayName(item),
                href: __tmResolveTaskAttachmentHref(item) || item,
            }))
            .filter((item) => !!item.href);
        const currentItem = galleryItems.find((item) => item.path === normalizedPath) || {
            path: normalizedPath,
            name: __tmGetTaskAttachmentDisplayName(normalizedPath),
            href: __tmResolveTaskAttachmentHref(normalizedPath) || normalizedPath,
        };
        const resolvedItems = galleryItems.length ? galleryItems : [currentItem];
        if (!resolvedItems.length || !currentItem.href) return false;
        const ViewerCtor = await __tmEnsureTaskAttachmentViewerLoaded();
        const imagesElement = document.createElement('ul');
        let initialViewIndex = 0;
        resolvedItems.forEach((item, index) => {
            if (!item?.href) return;
            const li = document.createElement('li');
            const img = document.createElement('img');
            img.src = item.href;
            img.alt = item.name || '附件图片';
            li.appendChild(img);
            imagesElement.appendChild(li);
            if (currentItem.href.endsWith(encodeURI(item.href)) || currentItem.href.endsWith(item.href)) {
                initialViewIndex = index;
            }
        });
        if (!imagesElement.children.length) return false;
        const viewerState = (globalThis.siyuan && typeof globalThis.siyuan === 'object')
            ? globalThis.siyuan
            : (globalThis.siyuan = {});
        try {
            if (viewerState.viewer && !viewerState.viewer.destroyed) viewerState.viewer.destroy();
        } catch (e) {}
        viewerState.viewer = new ViewerCtor(imagesElement, {
            initialViewIndex,
            title: [1, (image, imageData) => {
                let name = String(image?.alt || '').trim();
                if (!name) {
                    name = String(image?.src || '').trim();
                    name = name.substring(name.lastIndexOf('/') + 1);
                }
                if (name.includes('.')) name = name.substring(0, name.lastIndexOf('.'));
                name = name.replace(/-\d{14}-\w{7}$/, '');
                const width = Number(imageData?.naturalWidth) || 0;
                const height = Number(imageData?.naturalHeight) || 0;
                return width > 0 && height > 0 ? `${name} [${width} × ${height}]` : name;
            }],
            button: false,
            transition: false,
            hidden: function () {
                try { viewerState.viewer?.destroy?.(); } catch (e) {}
            },
            toolbar: {
                zoomIn: true,
                zoomOut: true,
                oneToOne: true,
                reset: true,
                prev: true,
                play: true,
                next: true,
                rotateLeft: true,
                rotateRight: true,
                flipHorizontal: true,
                flipVertical: true,
                close: function () {
                    try { viewerState.viewer?.destroy?.(); } catch (e) {}
                },
            },
        });
        viewerState.viewer.show();
        return true;
    }

    const __tmTaskAttachmentBlockMetaRequestMap = new Map();

    function __tmBuildTaskAttachmentTitle(entry) {
        const item = (entry && typeof entry === 'object') ? entry : null;
        if (!item) return '';
        return [String(item.name || '').trim(), String(item.displayPath || item.path || '').trim()]
            .filter((part, index, arr) => part && arr.indexOf(part) === index)
            .join('\n');
    }

    async function __tmEnsureTaskAttachmentBlockMeta(blockIds) {
        const ids = Array.from(new Set((Array.isArray(blockIds) ? blockIds : [blockIds])
            .map((item) => __tmExtractTaskAttachmentBlockId(item))
            .filter(Boolean)));
        const pendingIds = ids.filter((id) => !__tmGetTaskAttachmentBlockMeta(id));
        if (!pendingIds.length) return 0;
        const requestKey = pendingIds.slice().sort().join(',');
        const inFlight = __tmTaskAttachmentBlockMetaRequestMap.get(requestKey);
        if (inFlight) return await inFlight;
        const request = (async () => {
            let rows = [];
            let loadedCount = 0;
            try { rows = await API.getOtherBlocksByIds(pendingIds); } catch (e) { rows = []; }
            const foundIds = new Set();
            (Array.isArray(rows) ? rows : []).forEach((row) => {
                const id = __tmNormalizeTaskAttachmentBlockId(row?.id || '');
                if (!id) return;
                foundIds.add(id);
                __tmPrimeTaskAttachmentBlockMeta(row);
                loadedCount += 1;
            });
            pendingIds.forEach((id) => {
                if (foundIds.has(id) || __tmGetTaskAttachmentBlockMeta(id)) return;
                __tmPrimeTaskAttachmentBlockMeta({ id });
            });
            return loadedCount;
        })().finally(() => {
            __tmTaskAttachmentBlockMetaRequestMap.delete(requestKey);
        });
        __tmTaskAttachmentBlockMetaRequestMap.set(requestKey, request);
        return await request;
    }

    function __tmHydrateTaskAttachmentBlockMetaForTask(taskLike, entries) {
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : null;
        const missingIds = (Array.isArray(entries) ? entries : [])
            .filter((item) => item?.isBlockRef === true && item?.hasResolvedMeta !== true)
            .map((item) => item.blockId)
            .filter(Boolean);
        const taskId = String(task?.id || '').trim();
        if (!taskId || !missingIds.length) return;
        void __tmEnsureTaskAttachmentBlockMeta(missingIds).then((loadedCount) => {
            if (!loadedCount) return;
            try {
                __tmRefreshTaskFieldsAcrossViews(taskId, { attachments: true }, {
                    withFilters: false,
                    reason: 'attachment-block-meta',
                    forceProjectionRefresh: false,
                    fallback: false,
                });
            } catch (e) {
                try { __tmRefreshVisibleTaskDetailForTask(taskId); } catch (e2) {}
            }
        }).catch(() => null);
    }

    const __tmBuildNativeOpenAction = (options = {}) => (
        options?.focus ? ['cb-get-focus'] : ['cb-get-hl', 'cb-get-context']
    );

    async function __tmOpenSiyuanBlockNative(blockId, options = {}) {
        const id = String(blockId || '').trim();
        if (!id) return false;
        const nav = __tmGetNavigationRuntime();
        const app = nav.app;
        const action = __tmBuildNativeOpenAction(options);
        const openMobile = getOpenMobileFn();
        if ((nav.nativeMobileClient === true || nav.runtimeMobileClient === true) && typeof openMobile === 'function') {
            try {
                openMobile(app, id, action);
                __tmScheduleNativeOpenHighlight(id, options);
                nav.closeAfterMobileAction?.();
                return true;
            } catch (e) {}
        }
        const openTab = getOpenTabFn();
        if (typeof openTab === 'function') {
            try {
                await openTab({ app, doc: { id, action } });
                __tmScheduleNativeOpenHighlight(id, options);
                nav.closeAfterMobileAction?.();
                return true;
            } catch (e) {}
        }
        return false;
    }

    async function __tmOpenTaskAttachmentBlockRef(blockId, event) {
        const id = __tmNormalizeTaskAttachmentBlockId(blockId, { loose: true });
        if (!id) return false;
        try { event?.preventDefault?.(); } catch (e) {}
        try { event?.stopPropagation?.(); } catch (e) {}

        const nav = __tmGetNavigationRuntime();
        const topWin = nav.topWin || window;
        const topDoc = nav.topDoc || document;
        if (await __tmOpenSiyuanBlockNative(id)) return true;
        try {
            const tempSpan = topDoc.createElement('span');
            tempSpan.setAttribute('data-type', 'block-ref');
            tempSpan.setAttribute('data-id', id);
            tempSpan.style.position = 'fixed';
            tempSpan.style.top = '-9999px';
            tempSpan.style.left = '-9999px';
            tempSpan.style.opacity = '0';
            tempSpan.style.pointerEvents = 'none';
            topDoc.body.appendChild(tempSpan);
            const opts = {
                view: topWin,
                bubbles: true,
                cancelable: true,
                buttons: 1
            };
            tempSpan.dispatchEvent(new MouseEvent('mousedown', opts));
            tempSpan.dispatchEvent(new MouseEvent('mouseup', opts));
            tempSpan.dispatchEvent(new MouseEvent('click', opts));
            setTimeout(() => {
                try { tempSpan.remove(); } catch (e) {}
            }, 100);
            __tmScheduleNativeOpenHighlight(id);
            nav.closeAfterMobileAction?.();
            return true;
        } catch (e) {}
        try {
            topWin.open(`siyuan://blocks/${id}`);
            __tmScheduleNativeOpenHighlight(id);
            nav.closeAfterMobileAction?.();
            return true;
        } catch (e) {}
        return false;
    }

    function __tmBuildTaskAttachmentThumbHtml(entry, options = {}) {
        const item = (entry && typeof entry === 'object') ? entry : null;
        if (!item?.path) return '';
        const opts = (options && typeof options === 'object') ? options : {};
        const size = String(opts.size || 'summary').trim();
        const assetHref = __tmResolveTaskAttachmentHref(item.path);
        const className = [
            'tm-task-attachment-thumb',
            size === 'detail' ? 'tm-task-attachment-thumb--detail' : '',
            item.isImage ? 'is-image' : '',
            item.isBlockRef ? 'is-block-ref' : '',
        ].filter(Boolean).join(' ');
        if (item.isImage) {
            return `<span class="${className}"><img src="${esc(assetHref || item.path)}" alt="${esc(item.name || '附件')}" loading="lazy"></span>`;
        }
        return `<span class="${className}"><span class="tm-task-attachment-thumb__label">${esc(item.label || 'FILE')}</span></span>`;
    }

    function __tmBuildTaskAttachmentSummaryHtml(task, options = {}) {
        const entries = __tmBuildTaskAttachmentEntries(__tmGetTaskAttachmentPaths(task));
        if (!entries.length) return '<span class="tm-task-attachments-empty">-</span>';
        __tmHydrateTaskAttachmentBlockMetaForTask(task, entries);
        const opts = (options && typeof options === 'object') ? options : {};
        const limit = Math.max(1, Number(opts.maxItems) || __TM_TASK_ATTACHMENT_TABLE_PREVIEW_LIMIT || 2);
        const visible = entries.slice(0, limit);
        const title = entries.map((item) => __tmBuildTaskAttachmentTitle(item)).filter(Boolean).join('\n');
        const moreCount = Math.max(0, entries.length - visible.length);
        return `
            <div class="tm-task-attachments-summary" title="${esc(title)}">
                ${visible.map((item) => `<span class="tm-task-attachments-summary__item">${__tmBuildTaskAttachmentThumbHtml(item)}</span>`).join('')}
                ${moreCount > 0 ? `<span class="tm-task-attachments-summary__more">+${moreCount}</span>` : ''}
            </div>
        `;
    }

    function __tmUpdateTaskAttachmentsInDOM(container, task) {
        const root = container instanceof Element ? container : null;
        const taskLike = (task && typeof task === 'object') ? task : null;
        if (!(root instanceof Element) || !taskLike) return false;
        let touched = false;
        const cell = root.querySelector('[data-tm-field="attachments"]');
        const entries = __tmBuildTaskAttachmentEntries(__tmGetTaskAttachmentPaths(taskLike));
        __tmHydrateTaskAttachmentBlockMetaForTask(taskLike, entries);
        if (cell instanceof HTMLElement) {
            cell.innerHTML = __tmBuildTaskAttachmentSummaryHtml(taskLike);
            cell.classList.toggle('is-empty', entries.length === 0);
            cell.setAttribute('title', entries.map((item) => __tmBuildTaskAttachmentTitle(item)).filter(Boolean).join('\n'));
            touched = true;
        }
        const attachmentIconSlot = root.querySelector('[data-tm-field="attachmentIcon"]');
        if (attachmentIconSlot instanceof HTMLElement) {
            attachmentIconSlot.innerHTML = __tmRenderTaskAttachmentIcon(taskLike);
            touched = true;
        }
        return touched || (!(cell instanceof HTMLElement) && !(attachmentIconSlot instanceof HTMLElement));
    }

    function __tmOpenAssetPath(path, event, options = {}) {
        const normalizedPath = __tmNormalizeTaskAttachmentPath(path);
        if (!normalizedPath) return false;
        try { event?.preventDefault?.(); } catch (e) {}
        try { event?.stopPropagation?.(); } catch (e) {}
        if (__tmIsTaskAttachmentBlockRef(normalizedPath)) {
            void __tmOpenTaskAttachmentBlockRef(normalizedPath, event);
            return true;
        }
        const opts = (options && typeof options === 'object') ? options : {};
        const assetHref = __tmResolveTaskAttachmentHref(normalizedPath);
        const kind = __tmGetTaskAttachmentKind(normalizedPath);
        const openFallback = () => {
            try {
                const openTab = globalThis.__taskHorizonOpenTab;
                const app = globalThis.__taskHorizonPluginApp;
                if (typeof openTab === 'function' && app) {
                    openTab({
                        app,
                        keepCursor: opts.keepCursor === true,
                        ...(kind === 'pdf' ? { pdf: { path: normalizedPath } } : { asset: { path: normalizedPath } }),
                    });
                    return true;
                }
            } catch (e) {}
            try {
                window.open(assetHref || normalizedPath, '_blank', 'noopener,noreferrer');
                return true;
            } catch (e) {}
            return false;
        };
        const openWithSystem = () => {
            const opener = globalThis.__taskHorizonOpenAssetWithSystem;
            if (typeof opener !== 'function') return false;
            Promise.resolve(opener(normalizedPath)).then((opened) => {
                if (opened) return;
                openFallback();
            }).catch(() => {
                openFallback();
            });
            return true;
        };
        if (kind === 'image') {
            void __tmOpenTaskAttachmentImageViewer(normalizedPath, {
                galleryPaths: opts.galleryPaths,
            }).then((opened) => {
                if (opened) return;
                openFallback();
            }).catch(() => {
                openFallback();
            });
            return true;
        }
        if (kind !== 'pdf') return openWithSystem() || openFallback();
        return openFallback();
    }

    async function __tmUpdateTaskAttachmentsField(taskId, nextPaths, options = {}) {
        const tid = String(taskId || '').trim();
        if (!tid) return false;
        const normalizedPaths = __tmNormalizeTaskAttachmentPaths(nextPaths);
        return await __tmMutationEngine.requestTaskPatch(tid, { attachments: normalizedPaths }, {
            source: String(options?.source || 'task-attachments').trim() || 'task-attachments',
            label: '附件',
            withFilters: false,
            reason: String(options?.reason || options?.source || 'task-attachments').trim() || 'task-attachments',
            broadcast: options?.broadcast !== false,
        });
    }

    function __tmUpdateTaskPinnedInDOM(container, task) {
        const root = container instanceof Element ? container : null;
        const taskLike = (task && typeof task === 'object') ? task : null;
        if (!(root instanceof Element) || !taskLike) return false;
        const input = root.querySelector('input[type="checkbox"][title="置顶"]');
        if (!(input instanceof HTMLInputElement)) return true;
        input.checked = !!taskLike.pinned;
        return true;
    }

    function __tmEnsureChecklistMetaContainer(itemEl) {
        const item = itemEl instanceof Element ? itemEl : null;
        if (!(item instanceof Element)) return null;
        const main = item.querySelector('.tm-checklist-item-main');
        if (!(main instanceof HTMLElement)) return null;
        let meta = main.querySelector(':scope > .tm-checklist-meta');
        if (meta instanceof HTMLElement) return meta;
        meta = document.createElement('div');
        meta.className = 'tm-checklist-meta';
        meta.style.display = 'none';
        const titleRow = main.querySelector(':scope > .tm-checklist-title-row');
        if (titleRow instanceof HTMLElement && titleRow.parentElement === main) titleRow.insertAdjacentElement('afterend', meta);
        else main.appendChild(meta);
        return meta;
    }

    function __tmEnsureChecklistCompactMetaContainer(itemEl) {
        const item = itemEl instanceof Element ? itemEl : null;
        if (!(item instanceof Element)) return null;
        const pane = item.closest('.tm-checklist-pane--compact');
        if (!(pane instanceof Element)) return null;
        const titleRow = item.querySelector('.tm-checklist-title-row');
        if (!(titleRow instanceof HTMLElement)) return null;
        let meta = titleRow.querySelector(':scope > .tm-checklist-meta-compact');
        if (meta instanceof HTMLElement) return meta;
        meta = document.createElement('div');
        meta.className = 'tm-checklist-meta-compact';
        meta.style.display = 'none';
        const before = titleRow.querySelector(':scope > .tm-status-tag, :scope > [data-tm-field="pinned"], :scope > .tm-checklist-mobile-toggle');
        if (before instanceof HTMLElement) titleRow.insertBefore(meta, before);
        else titleRow.appendChild(meta);
        return meta;
    }

    function __tmSyncChecklistMetaContainerVisibility(itemEl) {
        const item = itemEl instanceof Element ? itemEl : null;
        if (!(item instanceof Element)) return false;
        let touched = false;
        const meta = item.querySelector('.tm-checklist-meta');
        if (meta instanceof HTMLElement) {
            const hasVisibleChild = Array.from(meta.children || []).some((child) => {
                if (!(child instanceof HTMLElement)) return false;
                return child.style.display !== 'none';
            });
            meta.style.display = hasVisibleChild ? '' : 'none';
            touched = true;
        }
        const compactMeta = item.querySelector('.tm-checklist-title-row > .tm-checklist-meta-compact');
        if (compactMeta instanceof HTMLElement) {
            const hasVisibleChild = Array.from(compactMeta.children || []).some((child) => {
                if (!(child instanceof HTMLElement)) return false;
                return child.style.display !== 'none';
            });
            compactMeta.style.display = hasVisibleChild ? '' : 'none';
            const titleRow = compactMeta.parentElement;
            if (titleRow instanceof HTMLElement) {
                titleRow.classList.toggle('tm-checklist-title-row--has-compact-meta', hasVisibleChild);
            }
            touched = true;
        }
        return touched;
    }

    function __tmEnsureChecklistTimeNode(itemEl, field) {
        const item = itemEl instanceof Element ? itemEl : null;
        const key = String(field || '').trim();
        if (!(item instanceof Element) || !key) return null;
        const metaFieldClassMap = {
            completionTime: 'tm-checklist-meta-chip',
            duration: 'tm-checklist-meta-chip',
            startDateCompact: 'tm-checklist-meta-compact-start',
            completionTimeCompact: 'tm-checklist-meta-compact-time',
            remainingTimeCompact: 'tm-checklist-meta-compact-remaining',
            durationCompact: 'tm-checklist-meta-compact-duration',
        };
        const className = metaFieldClassMap[key];
        if (!className) return null;
        const existing = item.querySelector(`[data-tm-task-time-field="${CSS.escape(key)}"]`);
        if (existing instanceof HTMLElement) return existing;
        const container = (key === 'completionTime' || key === 'duration')
            ? __tmEnsureChecklistMetaContainer(item)
            : __tmEnsureChecklistCompactMetaContainer(item);
        if (!(container instanceof HTMLElement)) return null;
        const node = document.createElement('span');
        node.className = className;
        node.setAttribute('data-tm-task-time-field', key);
        node.style.display = 'none';
        container.appendChild(node);
        return node;
    }

    function __tmUpdateChecklistTaskPriorityInDOM(taskId, itemEl = null, taskLike = null) {
        const tid = String(taskId || '').trim();
        const item = itemEl instanceof HTMLElement ? itemEl : (tid ? __tmViewControllers?.checklist?.findItem?.(tid) : null);
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : (tid ? (__tmTaskStateKernel.getTask(tid) || null) : null);
        if (!(item instanceof HTMLElement) || !task) return false;
        __tmUpdateTaskCheckboxPriorityInDOM(item, task);
        let chip = item.querySelector('[data-tm-field="priority"]');
        const priority = String(task.priority || '').trim();
        const visible = !!priority && priority !== 'none';
        if (!visible) {
            if (chip instanceof HTMLElement) {
                try { chip.remove(); } catch (e) {
                    chip.style.display = 'none';
                    chip.innerHTML = '';
                }
            }
            __tmSyncChecklistMetaContainerVisibility(item);
            return true;
        }
        if (!(chip instanceof HTMLElement)) {
            const meta = __tmEnsureChecklistMetaContainer(item);
            if (!(meta instanceof HTMLElement)) return false;
            chip = document.createElement('span');
            chip.className = 'tm-checklist-meta-chip';
            chip.setAttribute('data-tm-field', 'priority');
            meta.appendChild(chip);
        }
        chip.style.display = '';
        chip.innerHTML = __tmRenderPriorityJira(priority, false);
        __tmSyncChecklistMetaContainerVisibility(item);
        return true;
    }

    function __tmUpdateChecklistTaskPinnedInDOM(taskId, itemEl = null, taskLike = null) {
        const tid = String(taskId || '').trim();
        const item = itemEl instanceof HTMLElement ? itemEl : (tid ? __tmViewControllers?.checklist?.findItem?.(tid) : null);
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : (tid ? (__tmTaskStateKernel.getTask(tid) || null) : null);
        if (!(item instanceof HTMLElement) || !task) return false;
        const titleRow = item.querySelector('.tm-checklist-title-row');
        if (!(titleRow instanceof HTMLElement)) return false;
        let chip = titleRow.querySelector('[data-tm-field="pinned"]');
        const visible = !!task.pinned;
        if (!visible) {
            if (chip instanceof HTMLElement) {
                try { chip.remove(); } catch (e) {
                    chip.style.display = 'none';
                    chip.innerHTML = '';
                }
            }
            return true;
        }
        if (!(chip instanceof HTMLElement)) {
            chip = document.createElement('span');
            chip.className = 'tm-checklist-meta-chip';
            chip.setAttribute('data-tm-field', 'pinned');
            chip.setAttribute('title', '置顶');
            const before = titleRow.querySelector(':scope > .tm-checklist-mobile-toggle');
            if (before instanceof HTMLElement) titleRow.insertBefore(chip, before);
            else titleRow.appendChild(chip);
        }
        chip.style.display = '';
        chip.innerHTML = __tmRenderLucideIcon('pin');
        return true;
    }

    function __tmUpdateTaskCustomFieldsInDOM(container, task, patch = {}) {
        const root = container instanceof Element ? container : null;
        const taskLike = (task && typeof task === 'object') ? task : null;
        if (!(root instanceof Element) || !taskLike) return false;
        const patchFieldValues = (patch && typeof patch.customFieldValues === 'object' && patch.customFieldValues)
            ? patch.customFieldValues
            : null;
        const taskFieldValues = (taskLike.customFieldValues && typeof taskLike.customFieldValues === 'object')
            ? taskLike.customFieldValues
            : {};
        const domFieldIds = Array.from(root.querySelectorAll('[data-tm-custom-field-cell]'))
            .map((el) => String(el?.getAttribute?.('data-tm-custom-field-cell') || '').trim())
            .filter(Boolean);
        const fieldIds = Array.from(new Set(
            domFieldIds
                .concat(Object.keys(taskFieldValues || {}))
                .concat(Object.keys(patchFieldValues || {}))
        ));
        let touched = false;
        fieldIds.forEach((fieldId) => {
            const cell = root.querySelector(`[data-tm-custom-field-cell="${CSS.escape(String(fieldId || '').trim())}"] .tm-custom-field-cell`);
            if (!(cell instanceof HTMLElement)) return;
            const field = __tmGetCustomFieldDefMap().get(String(fieldId || '').trim());
            const value = __tmGetTaskCustomFieldValue(taskLike, fieldId);
            cell.innerHTML = __tmBuildCustomFieldDisplayHtml(field, value, {
                allowEmpty: false,
                maxTags: String(field?.type || '').trim() === 'multi' ? 2 : 1,
            });
            touched = true;
        });
        return touched || fieldIds.length === 0;
    }

    function __tmUpdateTaskDoneInDOM(container, task) {
        const root = container instanceof Element ? container : null;
        const taskLike = (task && typeof task === 'object') ? task : null;
        if (!(root instanceof Element) || !taskLike) return false;
        let touched = false;
        const checkbox = root.querySelector('.tm-task-checkbox');
        if (checkbox instanceof HTMLInputElement) {
            checkbox.checked = !!taskLike.done;
            touched = true;
        }
        root.classList?.toggle?.('tm-checklist-item--done', !!taskLike.done);
        const taskText = root.querySelector('.tm-task-text');
        if (taskText instanceof HTMLElement) {
            taskText.classList.toggle('tm-task-done', !!taskLike.done);
            touched = true;
        }
        return touched;
    }

    const __tmViewControllers = {
        list: {
            findRow(taskId) {
                const tid = String(taskId || '').trim();
                if (!tid || !(state.modal instanceof Element)) return null;
                return state.modal.querySelector(`#tmTaskTable tbody tr[data-id="${CSS.escape(tid)}"]`);
            },
            patchTask(taskId, patch = {}) {
                const row = this.findRow(taskId);
                const task = __tmTaskStateKernel.getTask(taskId);
                if (!(row instanceof HTMLElement) || !task) return false;
                let touched = false;
                if (Object.prototype.hasOwnProperty.call(patch, 'done')) {
                    touched = !!__tmUpdateTaskDoneInDOM(row, task) || touched;
                    touched = !!__tmUpdateTaskStatusTagInDOM(row, task) || touched;
                }
                if (Object.prototype.hasOwnProperty.call(patch, 'customStatus')) {
                    touched = !!__tmUpdateTaskStatusTagInDOM(row, task) || touched;
                    touched = !!__tmUpdateTaskDoneInDOM(row, task) || touched;
                }
                if (Object.prototype.hasOwnProperty.call(patch, 'priority')) touched = !!__tmUpdateTaskPriorityInDOM(row, task) || touched;
                if (__tmDoesPatchAffectPriorityScore(patch)) touched = !!__tmUpdateTaskScoreInDOM(row, task) || touched;
                if (Object.prototype.hasOwnProperty.call(patch, 'pinned')) touched = !!__tmUpdateTaskPinnedInDOM(row, task) || touched;
                if (Object.prototype.hasOwnProperty.call(patch, 'remark')) touched = !!__tmUpdateTaskRemarkInDOM(row, task) || touched;
                if (Object.prototype.hasOwnProperty.call(patch, 'attachments')) touched = !!__tmUpdateTaskAttachmentsInDOM(row, task) || touched;
                if (Object.prototype.hasOwnProperty.call(patch, 'customFieldValues')) touched = !!__tmUpdateTaskCustomFieldsInDOM(row, task, patch) || touched;
                if (Object.prototype.hasOwnProperty.call(patch, 'startDate')
                    || Object.prototype.hasOwnProperty.call(patch, 'completionTime')
                    || Object.prototype.hasOwnProperty.call(patch, 'taskCompleteAt')
                    || Object.prototype.hasOwnProperty.call(patch, 'duration')
                    || Object.prototype.hasOwnProperty.call(patch, 'customTime')
                    || Object.prototype.hasOwnProperty.call(patch, 'done')) {
                    touched = !!__tmUpdateListTaskTimeInDOM(taskId, row, task) || touched;
                }
                return touched;
            },
        },
        checklist: {
            findItem(taskId) {
                const tid = String(taskId || '').trim();
                if (!tid || !(state.modal instanceof Element)) return null;
                return state.modal.querySelector(`.tm-checklist-item[data-id="${CSS.escape(tid)}"]`);
            },
            patchTask(taskId, patch = {}) {
                const item = this.findItem(taskId);
                const task = __tmTaskStateKernel.getTask(taskId);
                if (!(item instanceof HTMLElement) || !task) return false;
                let touched = false;
                let handled = false;
                if (Object.prototype.hasOwnProperty.call(patch, 'done')) {
                    touched = !!__tmUpdateTaskDoneInDOM(item, task) || touched;
                    touched = !!__tmUpdateTaskStatusTagInDOM(item, task) || touched;
                    handled = true;
                }
                if (Object.prototype.hasOwnProperty.call(patch, 'customStatus')) {
                    touched = !!__tmUpdateTaskStatusTagInDOM(item, task) || touched;
                    touched = !!__tmUpdateTaskDoneInDOM(item, task) || touched;
                    handled = true;
                }
                if (Object.prototype.hasOwnProperty.call(patch, 'priority')) {
                    touched = !!__tmUpdateChecklistTaskPriorityInDOM(taskId, item, task) || touched;
                    handled = true;
                }
                if (Object.prototype.hasOwnProperty.call(patch, 'pinned')) {
                    touched = !!__tmUpdateChecklistTaskPinnedInDOM(taskId, item, task) || touched;
                    handled = true;
                }
                if (Object.prototype.hasOwnProperty.call(patch, 'remark')) {
                    touched = !!__tmUpdateTaskRemarkInDOM(item, task) || touched;
                    handled = true;
                }
                if (Object.prototype.hasOwnProperty.call(patch, 'attachments')) {
                    touched = !!__tmUpdateTaskAttachmentsInDOM(item, task) || touched;
                    handled = true;
                }
                if (Object.prototype.hasOwnProperty.call(patch, 'customFieldValues')) {
                    handled = true;
                }
                if (Object.prototype.hasOwnProperty.call(patch, 'startDate')
                    || Object.prototype.hasOwnProperty.call(patch, 'completionTime')
                    || Object.prototype.hasOwnProperty.call(patch, 'taskCompleteAt')
                    || Object.prototype.hasOwnProperty.call(patch, 'duration')
                    || Object.prototype.hasOwnProperty.call(patch, 'customTime')
                    || Object.prototype.hasOwnProperty.call(patch, 'done')) {
                    touched = !!__tmUpdateChecklistTaskTimeInDOM(taskId, item, task) || touched;
                    handled = true;
                }
                return touched || handled;
            },
        },
        detail: {
            patchTask(taskId) {
                return !!__tmRefreshVisibleTaskDetailForTask(taskId);
            },
        },
        timeline: {
            patchTask(taskId, patch = {}) {
                const tid = String(taskId || '').trim();
                const task = __tmTaskStateKernel.getTask(tid);
                if (!tid || !task || !(state.modal instanceof Element)) return false;
                if (String(state.viewMode || '').trim() !== 'timeline') return false;
                let touched = false;
                const row = state.modal.querySelector(`#tmTimelineLeftTable tbody tr[data-id="${CSS.escape(tid)}"]`);
                if (row instanceof HTMLElement) {
                    if (Object.prototype.hasOwnProperty.call(patch, 'done')) {
                        const checkbox = row.querySelector('.tm-task-checkbox');
                        if (checkbox instanceof HTMLInputElement) checkbox.checked = !!task.done;
                        const textEl = row.querySelector('.tm-task-text');
                        if (textEl instanceof HTMLElement) textEl.classList.toggle('tm-task-done', !!task.done);
                        touched = true;
                    }
                    if (Object.prototype.hasOwnProperty.call(patch, 'startDate') || Object.prototype.hasOwnProperty.call(patch, 'completionTime')) {
                        touched = !!__tmUpdateTimelineTaskInDOM(tid) || touched;
                    }
                }
                return touched;
            },
        },
        kanban: {
            findCard(taskId) {
                const tid = String(taskId || '').trim();
                if (!tid || !(state.modal instanceof Element)) return null;
                return state.modal.querySelector(`.tm-kanban-card[data-id="${CSS.escape(tid)}"]`);
            },
            patchTask(taskId, patch = {}) {
                const tid = String(taskId || '').trim();
                const task = __tmTaskStateKernel.getTask(tid);
                const card = this.findCard(tid);
                if (!(card instanceof HTMLElement) || !task) return false;
                let touched = false;
                if (Object.prototype.hasOwnProperty.call(patch, 'done')) {
                    card.classList.toggle('tm-kanban-card--done', !!task.done);
                    const checkbox = card.querySelector('.tm-task-checkbox');
                    if (checkbox instanceof HTMLInputElement) checkbox.checked = !!task.done;
                    const title = card.querySelector('.tm-task-content-clickable');
                    if (title instanceof HTMLElement) title.classList.toggle('tm-task-done', !!task.done);
                    touched = true;
                }
                if (Object.prototype.hasOwnProperty.call(patch, 'priority')) {
                    const chip = card.querySelector('.tm-kanban-priority-chip');
                    if (chip instanceof HTMLElement) {
                        chip.setAttribute('style', __tmBuildPriorityChipStyle(task?.priority));
                        chip.innerHTML = __tmRenderPriorityJira(task?.priority, false);
                        touched = true;
                    }
                }
                if (Object.prototype.hasOwnProperty.call(patch, 'customStatus')) {
                    const chip = card.querySelector('.tm-status-tag');
                    if (chip instanceof HTMLElement) {
                        const opt = __tmResolveTaskStatusDisplayOption(task, __tmGetStatusOptions(SettingsStore.data.customStatusOptions || []), {
                            fallbackColor: task?.done ? '#9e9e9e' : '#757575',
                            fallbackName: task?.done ? '完成' : '待办',
                        });
                        chip.setAttribute('style', __tmBuildStatusChipStyle(opt.color));
                        chip.textContent = String(opt.name || opt.id || '').trim();
                        touched = true;
                    }
                }
                if (Object.prototype.hasOwnProperty.call(patch, 'completionTime') || Object.prototype.hasOwnProperty.call(patch, 'startDate')) {
                    touched = !!__tmUpdateKanbanTaskTimeInDOM(tid) || touched;
                }
                if (Object.prototype.hasOwnProperty.call(patch, 'remark')) {
                    const nextRemark = __tmRenderTaskCardRemark(task);
                    let remarkEl = card.querySelector('.tm-task-card-remark');
                    card.classList.toggle('tm-kanban-card--has-remark', !!nextRemark);
                    if (nextRemark) {
                        if (remarkEl instanceof HTMLElement) remarkEl.outerHTML = nextRemark;
                        else card.insertAdjacentHTML('beforeend', nextRemark);
                        touched = true;
                    } else if (remarkEl instanceof HTMLElement) {
                        remarkEl.remove();
                        touched = true;
                    }
                }
                return touched;
            },
        },
        whiteboard: {
            patchTask(taskId, patch = {}) {
                const tid = String(taskId || '').trim();
                const task = __tmTaskStateKernel.getTask(tid);
                if (!tid || !task || !(state.modal instanceof Element)) return false;
                let touched = false;
                const nodes = state.modal.querySelectorAll(
                    `.tm-whiteboard-stream-task-head[data-task-id="${CSS.escape(tid)}"],` +
                    `.tm-whiteboard-stream-task-node[data-task-id="${CSS.escape(tid)}"],` +
                    `.tm-whiteboard-node[data-task-id="${CSS.escape(tid)}"]`
                );
                nodes.forEach((node) => {
                    if (!(node instanceof HTMLElement)) return;
                    if (Object.prototype.hasOwnProperty.call(patch, 'done')) {
                        const checkbox = node.querySelector('.tm-task-checkbox');
                        if (checkbox instanceof HTMLInputElement) checkbox.checked = !!task.done;
                        const title = node.querySelector('.tm-whiteboard-stream-task-title, .tm-task-content-clickable, .tm-task-text');
                        if (title instanceof HTMLElement) title.classList.toggle('tm-task-done', !!task.done);
                        touched = true;
                    }
                    if (Object.prototype.hasOwnProperty.call(patch, 'completionTime') || Object.prototype.hasOwnProperty.call(patch, 'startDate')) {
                        touched = !!__tmUpdateWhiteboardTaskTimeInDOM(tid) || touched;
                    }
                });
                return touched;
            },
        },
    };

    function __tmRefreshTaskFieldsAcrossViews(taskId, patch = {}, options = {}) {
        const tid = String(taskId || '').trim();
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        if (!tid || !Object.keys(nextPatch).length) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const suppressChecklistDetailSaveRefresh = __tmShouldSuppressChecklistDetailSaveRefresh(tid, nextPatch, opts);
        if (!__tmIsPluginVisibleNow()) {
            try {
                __tmPushRefreshDebug('task-fields-across-views-skipped-hidden', {
                    taskId: tid,
                    patchKeys: Object.keys(nextPatch),
                    reason: String(opts.reason || '').trim(),
                });
            } catch (e) {}
            return false;
        }
        if (state.homepageOpen) {
            try {
                __tmScheduleHomepageRefresh(String(opts.reason || 'homepage-field-patch').trim() || 'homepage-field-patch');
            } catch (e) {}
            return true;
        }
        if (__tmShouldFallbackTaskFieldPatch(tid, nextPatch, opts)) {
            const refreshWithFilters = __tmShouldRefreshWithFiltersForPatch(tid, nextPatch, opts);
            const needsProjectionRefresh = __tmDoesPatchNeedProjectionRefresh(tid, nextPatch, opts);
            try {
                __tmPushRefreshDebug('task-field-force-fallback', {
                    taskId: tid,
                    patchKeys: Object.keys(nextPatch),
                    viewMode: String(state.viewMode || '').trim(),
                    currentRule: String(state.currentRule || '').trim(),
                    groupByTime: !!state.groupByTime,
                    groupByTaskName: !!state.groupByTaskName,
                    quadrantEnabled: !!state.quadrantEnabled,
                    forceProjectionRefresh: opts.forceProjectionRefresh === true,
                    refreshWithFilters,
                    needsProjectionRefresh,
                });
            } catch (e) {}
            if (String(state.viewMode || '').trim() === 'list' && refreshWithFilters && needsProjectionRefresh) {
                __tmScheduleListProjectionRefresh({
                    mode: 'current',
                    withFilters: true,
                    reason: String(opts.reason || 'task-field-projection').trim() || 'task-field-projection',
                }, __tmBuildListProjectionRefreshScheduleOptions(nextPatch, opts));
            } else {
                __tmScheduleViewRefresh({
                    mode: 'current',
                    withFilters: refreshWithFilters,
                    reason: String(opts.reason || 'task-field-projection').trim() || 'task-field-projection',
                });
            }
            return false;
        }
        let refreshed = false;
        const viewMode = String(state.viewMode || '').trim();
        if (viewMode === 'list') refreshed = !!__tmViewControllers.list.patchTask(tid, nextPatch) || refreshed;
        if (viewMode === 'checklist') {
            const checklistPatched = !!__tmViewControllers.checklist.patchTask(tid, nextPatch);
            try {
                __tmPushRefreshDebug('checklist-item-patch', {
                    taskId: tid,
                    patchKeys: Object.keys(nextPatch),
                    patched: checklistPatched,
                    activeDetailTaskId: String(state.detailTaskId || '').trim(),
                });
            } catch (e) {}
            refreshed = checklistPatched || refreshed;
            if (checklistPatched) {
                try {
                    __tmArmChecklistRenderGuard(String(opts.reason || 'task-field-checklist-patch').trim() || 'task-field-checklist-patch');
                } catch (e) {}
            }
        }
        if (viewMode === 'timeline') refreshed = !!__tmViewControllers.timeline.patchTask(tid, nextPatch) || refreshed;
        if (viewMode === 'kanban') refreshed = !!__tmViewControllers.kanban.patchTask(tid, nextPatch) || refreshed;
        if (viewMode === 'whiteboard') refreshed = !!__tmViewControllers.whiteboard.patchTask(tid, nextPatch) || refreshed;
        if (opts.skipDetailPatch !== true) refreshed = !!__tmViewControllers.detail.patchTask(tid) || refreshed;
        try {
            __tmPushRefreshDebug('task-fields-across-views', {
                taskId: tid,
                patchKeys: Object.keys(nextPatch),
                refreshed,
                viewMode,
                fallbackAllowed: opts.fallback !== false,
                forceProjectionRefresh: opts.forceProjectionRefresh === true,
                skipDetailPatch: opts.skipDetailPatch === true,
            });
        } catch (e) {}
        if (viewMode === 'list' && refreshed && opts.withFilters === false) {
            const needsReorderRefresh = __tmDoesPatchNeedProjectionRefresh(tid, nextPatch, opts);
            if (needsReorderRefresh) {
                try {
                    __tmPushRefreshDebug('task-fields-across-views-list-reorder-refresh', {
                        taskId: tid,
                        patchKeys: Object.keys(nextPatch),
                        viewMode,
                        reason: String(opts.reason || '').trim(),
                        currentRule: String(state.currentRule || '').trim(),
                    });
                } catch (e) {}
                __tmScheduleListProjectionRefresh({
                    mode: 'current',
                    withFilters: true,
                    reason: String(opts.reason || 'task-field-list-reorder').trim() || 'task-field-list-reorder',
                }, __tmBuildListProjectionRefreshScheduleOptions(nextPatch, opts));
            }
        }
        if (!refreshed && opts.fallback !== false) {
            if (suppressChecklistDetailSaveRefresh) {
                try {
                    __tmPushRefreshDebug('task-fields-across-views-fallback-suppressed', {
                        taskId: tid,
                        patchKeys: Object.keys(nextPatch),
                        viewMode,
                        reason: String(opts.reason || '').trim(),
                        currentRule: String(state.currentRule || '').trim(),
                        forceProjectionRefresh: opts.forceProjectionRefresh === true,
                        skipDetailPatch: opts.skipDetailPatch === true,
                    });
                } catch (e) {}
                return false;
            }
            try {
                __tmPushRefreshDebug('task-fields-across-views-fallback', {
                    taskId: tid,
                    patchKeys: Object.keys(nextPatch),
                    viewMode,
                });
            } catch (e) {}
            const refreshWithFilters = __tmShouldRefreshWithFiltersForPatch(tid, nextPatch, opts);
            const needsProjectionRefresh = __tmDoesPatchNeedProjectionRefresh(tid, nextPatch, opts);
            if (viewMode === 'list' && refreshWithFilters && needsProjectionRefresh) {
                __tmScheduleListProjectionRefresh({
                    mode: 'current',
                    withFilters: true,
                    reason: String(opts.reason || 'task-field-patch-fallback').trim() || 'task-field-patch-fallback',
                }, __tmBuildListProjectionRefreshScheduleOptions(nextPatch, opts));
            } else {
                __tmScheduleViewRefresh({
                    mode: 'current',
                    withFilters: refreshWithFilters,
                    reason: String(opts.reason || 'task-field-patch-fallback').trim() || 'task-field-patch-fallback',
                });
            }
        }
        return refreshed;
    }

    function __tmGetTaskSuppressionIds(taskId, taskLike = null) {
        const tid = String(taskId || '').trim();
        const task = (taskLike && typeof taskLike === 'object')
            ? taskLike
            : (state.flatTasks?.[tid] || state.pendingInsertedTasks?.[tid] || null);
        return Array.from(new Set([
            tid,
            String(task?.attrHostId || '').trim(),
            String(task?.attr_host_id || '').trim(),
        ].filter(Boolean)));
    }

    const __tmMutationEngine = {
        __changeFeedSuspended: false,
        __suppressedTaskDepth: new Map(),
        isTaskSuppressed(taskId) {
            const tid = String(taskId || '').trim();
            return !!tid && Number(this.__suppressedTaskDepth.get(tid) || 0) > 0;
        },
        withSuppressedTasks(taskIds, handler) {
            const ids = Array.from(new Set((Array.isArray(taskIds) ? taskIds : []).map((id) => String(id || '').trim()).filter(Boolean)));
            ids.forEach((id) => {
                const count = Number(this.__suppressedTaskDepth.get(id) || 0);
                this.__suppressedTaskDepth.set(id, count + 1);
            });
            const done = () => {
                ids.forEach((id) => {
                    const count = Math.max(0, Number(this.__suppressedTaskDepth.get(id) || 0) - 1);
                    if (count > 0) this.__suppressedTaskDepth.set(id, count);
                    else this.__suppressedTaskDepth.delete(id);
                });
            };
            try {
                const result = handler?.();
                if (result && typeof result.then === 'function') {
                    return result.finally(done);
                }
                done();
                return result;
            } catch (e) {
                done();
                throw e;
            }
        },
        suspendChangeFeed(handler) {
            this.__changeFeedSuspended = true;
            const done = () => { this.__changeFeedSuspended = false; };
            try {
                const result = handler?.();
                if (result && typeof result.then === 'function') {
                    return result.finally(done);
                }
                done();
                return result;
            } catch (e) {
                done();
                throw e;
            }
        },
        requestTaskPatch(taskId, patch = {}, options = {}) {
            const tid = String(taskId || '').trim();
            const nextPatch = (patch && typeof patch === 'object') ? patch : {};
            const opts = (options && typeof options === 'object') ? options : {};
            const allowOptimisticPatch = opts.optimistic !== false;
            const skipViewRefresh = opts.skipViewRefresh === true;
            const skipSettledRefresh = opts.skipSettledRefresh === true;
            if (!tid || !Object.keys(nextPatch).length) return Promise.resolve(false);
            const plan = __tmWritePlanner.buildWritePlan(tid, nextPatch, opts);
            const inversePatch = __tmCaptureTaskPatchInverse(tid, plan.normalizedPatch);
            if (__tmIsPatchNoop(plan.normalizedPatch, inversePatch)) return Promise.resolve(false);
            const taskLike = __tmTaskStateKernel.getTask(tid);
            const suppressionIds = Array.from(new Set([
                tid,
                String(taskLike?.attrHostId || '').trim(),
                String(taskLike?.attr_host_id || '').trim(),
            ].filter(Boolean)));
            const optimisticSkipDetailPatch = opts.optimisticSkipDetailPatch === true
                || (((String(state.viewMode || '').trim() === 'checklist') || __tmHasCalendarSidebarChecklist(state.modal))
                    && String(state.detailTaskId || '').trim() === tid
                    && (Object.prototype.hasOwnProperty.call(plan.normalizedPatch, 'done')
                        || Object.prototype.hasOwnProperty.call(plan.normalizedPatch, 'customStatus')));
            if (allowOptimisticPatch) {
                __tmTaskStateKernel.patchTaskLocal(tid, plan.normalizedPatch, opts);
                if (!skipViewRefresh) {
                    __tmRefreshTaskFieldsAcrossViews(tid, plan.normalizedPatch, {
                        withFilters: false,
                        reason: String(opts.reason || opts.source || 'task-field-optimistic').trim() || 'task-field-optimistic',
                        forceProjectionRefresh: false,
                        fallback: false,
                        skipDetailPatch: opts.skipDetailPatch === true || optimisticSkipDetailPatch,
                    });
                }
            }
            return this.withSuppressedTasks(suppressionIds, () => __tmWriteExecutor.executePlan(plan, opts)).then((result) => {
                if (!skipViewRefresh && !skipSettledRefresh) {
                    __tmRefreshTaskFieldsAcrossViews(tid, plan.normalizedPatch, {
                        withFilters: true,
                        reason: String(opts.reason || opts.source || 'task-field-settled').trim() || 'task-field-settled',
                        forceProjectionRefresh: plan.affectsProjection,
                        fallback: true,
                        skipDetailPatch: opts.skipDetailPatch === true,
                    });
                }
                return result || true;
            }).catch((error) => {
                __tmTaskStateKernel.rollbackTaskLocal(tid, inversePatch, opts);
                if (!skipViewRefresh) {
                    __tmRefreshTaskFieldsAcrossViews(tid, inversePatch, {
                        withFilters: true,
                        reason: String(opts.reason || opts.source || 'task-field-rollback').trim() || 'task-field-rollback',
                        forceProjectionRefresh: plan.affectsProjection,
                        fallback: true,
                        skipDetailPatch: opts.skipDetailPatch === true,
                    });
                }
                throw error;
            });
        },
        async requestTaskPatchBatch(taskIds, patchFactory, options = {}) {
            const ids = Array.from(new Set((Array.isArray(taskIds) ? taskIds : []).map((id) => String(id || '').trim()).filter(Boolean)));
            const opts = (options && typeof options === 'object') ? options : {};
            const failures = [];
            let successCount = 0;
            let needProjectionRefresh = false;
            await this.suspendChangeFeed(async () => {
                for (const id of ids) {
                    const patch = typeof patchFactory === 'function' ? patchFactory(id) : patchFactory;
                    const nextPatch = (patch && typeof patch === 'object') ? patch : {};
                    if (!Object.keys(nextPatch).length) continue;
                    try {
                        await this.requestTaskPatch(id, nextPatch, {
                            ...opts,
                            withFilters: false,
                            fallback: false,
                        });
                        if (__tmDoesPatchAffectProjection(id, nextPatch)) needProjectionRefresh = true;
                        successCount += 1;
                    } catch (e) {
                        failures.push({
                            id,
                            error: e instanceof Error ? e : new Error(String(e || '批量更新失败')),
                        });
                    }
                }
            });
            try {
                if (needProjectionRefresh) {
                    __tmScheduleViewRefresh({
                        mode: 'current',
                        withFilters: true,
                        reason: String(opts.reason || 'batch-task-patch').trim() || 'batch-task-patch',
                    });
                } else {
                    try { __tmRefreshMultiSelectUiInPlace(state.modal, { renderFallback: false }); } catch (e) {}
                }
            } catch (e) {}
            return {
                successCount,
                failureCount: failures.length,
                failures,
            };
        },
    };

    function __tmRunAfterUiPaint(handler) {
        return new Promise((resolve, reject) => {
            const run = () => {
                try {
                    Promise.resolve(typeof handler === 'function' ? handler() : false).then(resolve, reject);
                } catch (e) {
                    reject(e);
                }
            };
            const schedule = () => {
                try {
                    setTimeout(run, 0);
                } catch (e) {
                    run();
                }
            };
            try {
                requestAnimationFrame(schedule);
            } catch (e) {
                schedule();
            }
        });
    }

    async function __tmRunUiFriendlyFieldCommit(handler, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const executor = typeof handler === 'function' ? handler : async () => false;
        try {
            const result = opts.defer === false
                ? await executor()
                : await __tmRunAfterUiPaint(executor);
            if (result !== false) {
                const successHint = typeof opts.successHint === 'function'
                    ? opts.successHint(result)
                    : opts.successHint;
                if (successHint) hint(String(successHint), 'success');
                if (typeof opts.onSuccess === 'function') {
                    try { opts.onSuccess(result); } catch (e) {}
                }
            }
            return result;
        } catch (e) {
            if (typeof opts.onError === 'function') {
                try { opts.onError(e); } catch (err) {}
            }
            if (opts.showErrorHint !== false) {
                const message = String(e?.message || e || '').trim() || '未知错误';
                const errorHint = typeof opts.errorHint === 'function'
                    ? opts.errorHint(message, e)
                    : (String(opts.errorHint || '').trim() || `❌ 更新失败: ${message}`);
                if (errorHint) hint(String(errorHint), 'error');
            }
            return false;
        }
    }

    function __tmIsChecklistUiFriendlyTaskPatchContext(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (opts.forceChecklistBehavior === true) return true;
        const viewMode = String(state.viewMode || '').trim();
        return viewMode === 'checklist' || __tmHasCalendarSidebarChecklist(state.modal);
    }

    function __tmShouldSkipSettledRefreshForUiPatch(taskId, patch = {}, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (opts.forceSettledRefresh === true) return false;
        if (opts.skipSettledRefresh === true) return true;
        if (state.homepageOpen) return false;
        if (__tmIsChecklistUiFriendlyTaskPatchContext(opts)) return false;
        if (!__tmIsSimpleProjectionContext()) return false;
        const viewMode = String(state.viewMode || '').trim();
        if (viewMode !== 'list' && viewMode !== 'checklist' && viewMode !== 'timeline' && viewMode !== 'kanban' && viewMode !== 'whiteboard') return false;
        const keys = __tmGetPatchFieldKeys(patch);
        if (!keys.length) return false;
        return keys.every((key) => __tmGetFieldSpec(key)?.supportsLocalPatch !== false);
    }

    function __tmResolveUiFriendlyTaskPatchDelay(taskId, patch = {}, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (Object.prototype.hasOwnProperty.call(opts, 'queueDelayMs')) {
            return Math.max(0, Number(opts.queueDelayMs) || 0);
        }
        const viewMode = String(state.viewMode || '').trim();
        if (viewMode === 'list') return 240;
        if (viewMode === 'timeline' || viewMode === 'kanban' || viewMode === 'whiteboard') return 160;
        return 80;
    }

    function __tmIsImmediateUiFriendlyTimePatch(patch = {}) {
        const keys = __tmGetPatchFieldKeys(patch);
        if (!keys.length) return false;
        return keys.every((key) => key === 'startDate' || key === 'completionTime' || key === 'customTime');
    }

    function __tmShouldUseQueuedUiFriendlyTaskPatch(taskId, patch = {}, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (opts.forceQueued === true) return true;
        if (opts.forceImmediate === true) return false;
        if (__tmIsChecklistUiFriendlyTaskPatchContext(opts)) return false;
        if (__tmIsImmediateUiFriendlyTimePatch(patch)) return false;
        return true;
    }

    function __tmQueueUiFriendlyTaskPatch(taskId, patch = {}, options = {}) {
        const tid = String(taskId || '').trim();
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        const opts = (options && typeof options === 'object') ? options : {};
        if (!tid || !Object.keys(nextPatch).length) return Promise.resolve(false);
        const plan = __tmWritePlanner.buildWritePlan(tid, nextPatch, opts);
        const inversePatch = __tmCaptureTaskPatchInverse(tid, plan.normalizedPatch);
        if (__tmIsPatchNoop(plan.normalizedPatch, inversePatch)) return Promise.resolve(false);
        const taskLike = __tmTaskStateKernel.getTask(tid);
        const optimisticSkipDetailPatch = opts.optimisticSkipDetailPatch === true
            || (((String(state.viewMode || '').trim() === 'checklist') || __tmHasCalendarSidebarChecklist(state.modal))
                && String(state.detailTaskId || '').trim() === tid
                && (Object.prototype.hasOwnProperty.call(plan.normalizedPatch, 'done')
                    || Object.prototype.hasOwnProperty.call(plan.normalizedPatch, 'customStatus')));
        return __tmEnqueueQueuedOp({
            type: 'taskPatch',
            docId: String(opts.docId || taskLike?.root_id || taskLike?.docId || '').trim(),
            laneKey: String(opts.laneKey || 'ui-task-patch').trim() || 'ui-task-patch',
            coalesceKey: `taskPatch:${tid}`,
            data: {
                taskId: tid,
                patch: { ...plan.normalizedPatch },
                statusBefore: plan.statusBefore && typeof plan.statusBefore === 'object'
                    ? { ...plan.statusBefore }
                    : null,
                source: String(opts.source || 'inline-field').trim() || 'inline-field',
                label: String(opts.label || '任务字段').trim() || '任务字段',
                reason: String(opts.reason || opts.source || 'inline-field').trim() || 'inline-field',
                withFilters: opts.withFilters !== false,
                skipDetailPatch: opts.skipDetailPatch === true,
                optimisticSkipDetailPatch,
                skipViewRefresh: opts.skipViewRefresh === true,
                skipSettledRefresh: __tmShouldSkipSettledRefreshForUiPatch(tid, plan.normalizedPatch, opts),
                broadcast: opts.broadcast !== false,
                optimistic: opts.optimistic !== false,
                affectsProjection: plan.affectsProjection === true,
                skipFlush: opts.skipFlush !== false,
            },
            inversePatch,
        }, {
            wait: opts.wait !== false,
            delayMs: __tmResolveUiFriendlyTaskPatchDelay(tid, plan.normalizedPatch, opts),
        });
    }

    function __tmCommitUiFriendlyTaskPatch(taskId, patch = {}, options = {}) {
        const tid = String(taskId || '').trim();
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        const opts = (options && typeof options === 'object') ? options : {};
        if (!tid || !Object.keys(nextPatch).length) return Promise.resolve(false);
        const useQueued = __tmShouldUseQueuedUiFriendlyTaskPatch(tid, nextPatch, opts);
        try {
            __tmPushRefreshDebug('ui-friendly-patch:start', {
                taskId: tid,
                patchKeys: Object.keys(nextPatch),
                source: String(opts.source || '').trim(),
                label: String(opts.label || '').trim(),
                queued: useQueued,
                defer: opts.defer === false ? false : true,
                skipViewRefresh: opts.skipViewRefresh === true,
                skipSettledRefresh: __tmShouldSkipSettledRefreshForUiPatch(tid, nextPatch, opts),
                viewMode: String(state.viewMode || '').trim(),
            });
        } catch (e) {}
        const handler = useQueued
            ? () => __tmQueueUiFriendlyTaskPatch(tid, nextPatch, {
                ...opts,
                wait: true,
            })
            : () => __tmMutationEngine.requestTaskPatch(tid, nextPatch, {
                source: String(opts.source || 'inline-field').trim() || 'inline-field',
                label: String(opts.label || '任务字段').trim() || '任务字段',
                withFilters: opts.withFilters !== false,
                skipDetailPatch: opts.skipDetailPatch === true,
                skipViewRefresh: opts.skipViewRefresh === true,
                skipSettledRefresh: __tmShouldSkipSettledRefreshForUiPatch(tid, nextPatch, opts),
                broadcast: opts.broadcast !== false,
                optimistic: opts.optimistic !== false,
                optimisticSkipDetailPatch: opts.optimisticSkipDetailPatch === true,
                reason: String(opts.reason || opts.source || 'inline-field').trim() || 'inline-field',
            });
        const runOpts = (__tmIsChecklistUiFriendlyTaskPatchContext(opts) && !Object.prototype.hasOwnProperty.call(opts, 'defer'))
            ? { ...opts, defer: false }
            : opts;
        return __tmRunUiFriendlyFieldCommit(handler, runOpts).then((result) => {
            try {
                __tmPushRefreshDebug('ui-friendly-patch:end', {
                    taskId: tid,
                    patchKeys: Object.keys(nextPatch),
                    source: String(opts.source || '').trim(),
                    label: String(opts.label || '').trim(),
                    queued: useQueued,
                    result: result !== false,
                    viewMode: String(state.viewMode || '').trim(),
                });
            } catch (e) {}
            return result;
        });
    }

    function __tmShouldUseChecklistLegacyFieldCommit(options = {}) {
        return __tmIsChecklistUiFriendlyTaskPatchContext(options);
    }

    function __tmRequestChecklistLegacyTaskPatch(taskId, patch = {}, options = {}) {
        const tid = String(taskId || '').trim();
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        const opts = (options && typeof options === 'object') ? options : {};
        if (!tid || !Object.keys(nextPatch).length) return Promise.resolve(false);
        const renderRestoreSnapshot = __tmCaptureChecklistRenderRestore();
        const detailScrollSnapshot = __tmCaptureChecklistDetailScrollSnapshot();
        if (renderRestoreSnapshot) {
            try { __tmStageChecklistRenderRestore(renderRestoreSnapshot); } catch (e) {}
        }
        try {
            __tmPushRefreshDebug('checklist-legacy-patch:start', {
                taskId: tid,
                patchKeys: Object.keys(nextPatch),
                source: String(opts.source || '').trim(),
                label: String(opts.label || '').trim(),
                renderRestoreSnapshot,
                detailScrollSnapshot,
                skipViewRefresh: opts.skipViewRefresh === true,
                skipSettledRefresh: opts.skipSettledRefresh === true,
                detailTaskId: String(state.detailTaskId || '').trim(),
            });
        } catch (e) {}
        const restoreChecklistUi = () => {
            try {
                if (renderRestoreSnapshot) __tmRestoreChecklistRenderRestore(renderRestoreSnapshot);
            } catch (e) {}
            try {
                if (detailScrollSnapshot) __tmRestoreChecklistDetailScrollSnapshot(detailScrollSnapshot);
            } catch (e) {}
        };
        return __tmMutationEngine.requestTaskPatch(tid, nextPatch, {
            source: String(opts.source || 'inline-field').trim() || 'inline-field',
            label: String(opts.label || '任务字段').trim() || '任务字段',
            withFilters: opts.withFilters !== false,
            skipDetailPatch: opts.skipDetailPatch === true,
            skipViewRefresh: opts.skipViewRefresh === true,
            skipSettledRefresh: opts.skipSettledRefresh === true,
            broadcast: opts.broadcast !== false,
            optimistic: opts.optimistic !== false,
            optimisticSkipDetailPatch: opts.optimisticSkipDetailPatch === true,
            reason: String(opts.reason || opts.source || 'inline-field').trim() || 'inline-field',
        }).then((result) => {
            restoreChecklistUi();
            try {
                __tmPushRefreshDebug('checklist-legacy-patch:end', {
                    taskId: tid,
                    patchKeys: Object.keys(nextPatch),
                    source: String(opts.source || '').trim(),
                    label: String(opts.label || '').trim(),
                    result: result !== false,
                    detailTaskId: String(state.detailTaskId || '').trim(),
                });
            } catch (e) {}
            return result;
        }).catch((error) => {
            restoreChecklistUi();
            try {
                __tmPushRefreshDebug('checklist-legacy-patch:error', {
                    taskId: tid,
                    patchKeys: Object.keys(nextPatch),
                    source: String(opts.source || '').trim(),
                    label: String(opts.label || '').trim(),
                    error: String(error?.message || error || '').trim(),
                    detailTaskId: String(state.detailTaskId || '').trim(),
                });
            } catch (e) {}
            throw error;
        });
    }

    const __tmChangeFeed = {
        buildPatchFromAttr(taskId, attrKey, attrValue) {
            const tid = String(taskId || '').trim();
            const task = globalThis.__tmRuntimeState?.getTaskById?.(tid) || state.flatTasks?.[tid] || state.pendingInsertedTasks?.[tid] || null;
            const meta = __tmBuildMetaPatchFromAttrUpdate(attrKey, attrValue, task);
            return meta?.patch && typeof meta.patch === 'object' ? meta.patch : null;
        },
        handleAttrUpdate(taskId, attrKey, attrValue, options = {}) {
            const tid = String(taskId || '').trim();
            const patch = this.buildPatchFromAttr(tid, attrKey, attrValue);
            const opts = (options && typeof options === 'object') ? options : {};
            if (!tid || !patch) return false;
            if (__tmMutationEngine.isTaskSuppressed(tid)) return true;
            const applied = __tmApplyQuickbarAttrUpdateInState(tid, attrKey, attrValue);
            try {
                __tmPushDetailDebug('change-feed-handle-attr', {
                    taskId: tid,
                    attrKey: String(attrKey || '').trim(),
                    attrValue: String(attrValue ?? ''),
                    patch: patch ? { ...patch } : null,
                    applied: !!applied,
                    reason: String(opts.reason || '').trim(),
                });
            } catch (e) {}
            if (!applied) return false;
            try {
                __tmRefreshTaskFieldsAcrossViews(tid, patch, {
                    withFilters: true,
                    reason: String(opts.reason || 'change-feed-attr').trim() || 'change-feed-attr',
                    forceProjectionRefresh: __tmDoesPatchAffectProjection(tid, patch),
                    fallback: true,
                });
            } catch (e) {}
            return true;
        },
        shouldDeferToAutoRefresh(taskId, attrKey, attrValue) {
            if (__tmMutationEngine.__changeFeedSuspended === true) return false;
            if (!__tmIsPluginVisibleNow()) return true;
            const patch = this.buildPatchFromAttr(attrKey, attrValue);
            if (!patch) return true;
            return __tmDoesPatchAffectProjection(taskId, patch);
        },
    };

    function __tmCloseCellEditor(shouldRerender) {
        const last = __tmCellEditorState;
        if (__tmCellEditorState?.cleanup) {
            try { __tmCellEditorState.cleanup(); } catch (e) {}
        }
        __tmCellEditorState = null;
        if (shouldRerender) {
            __tmRefreshMainViewInPlace({ withFilters: true });
        }
    }

    function __tmCommitCellEdit(id, field, value) {
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
        if (!task) return Promise.resolve(false);
        try {
            if (field === 'startDate' || field === 'completionTime') {
                __tmPushRefreshDebug('cell-edit-date-commit', {
                    taskId: String(id || '').trim(),
                    field,
                    value: String(value || '').trim(),
                    viewMode: String(state.viewMode || '').trim(),
                });
            }
        } catch (e) {}
        const customFieldId = __tmParseCustomFieldColumnKey(field);
        const customField = customFieldId ? __tmGetCustomFieldDefMap().get(customFieldId) : null;
        if (customField && String(customField.type || '').trim() === 'text') {
            const next = String(__tmNormalizeCustomFieldValue(customField, value) || '').trim();
            return __tmCommitUiFriendlyTaskPatch(id, {
                customFieldValues: { [customFieldId]: next }
            }, {
                source: 'cell-edit-custom-field',
                label: String(customField.name || '文本列').trim() || '文本列',
            });
        }
        if (field === 'priority') {
            const next = value === 'high' || value === 'medium' || value === 'low' ? value : '';
            return __tmCommitUiFriendlyTaskPatch(id, { priority: next }, {
                source: 'cell-edit-priority',
                label: '优先级',
            });
        }
        if (field === 'duration') {
            const next = String(value || '').trim();
            return __tmCommitUiFriendlyTaskPatch(id, { duration: next }, {
                source: 'cell-edit-time',
                label: '时长',
            });
        }
        if (field === 'remark') {
            const next = __tmNormalizeRemarkMarkdown(value);
            return __tmCommitUiFriendlyTaskPatch(id, { remark: next }, {
                source: 'cell-edit',
                label: '备注',
            });
        }
        if (field === 'completionTime') {
            const raw = String(value || '').trim();
            const next = raw ? __tmNormalizeDateOnly(raw) : '';
            return __tmCommitUiFriendlyTaskPatch(id, { completionTime: next }, {
                source: 'cell-edit-time',
                label: '截止日期',
            });
        }
        if (field === 'startDate') {
            const raw = String(value || '').trim();
            const next = raw ? __tmNormalizeDateOnly(raw) : '';
            return __tmCommitUiFriendlyTaskPatch(id, { startDate: next }, {
                source: 'cell-edit-time',
                label: '开始日期',
            });
        }
        if (field === 'customTime') {
            const raw = String(value || '').trim();
            return __tmCommitUiFriendlyTaskPatch(id, { customTime: raw }, {
                source: 'cell-edit-time',
                label: '任务时间',
            });
        }
        return Promise.resolve(false);
    }

    function __tmIsNativeDateInputValueReady(type, value) {
        const inputType = String(type || '').trim().toLowerCase();
        const nextValue = String(value || '').trim();
        if (!nextValue) return true;
        if (inputType === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(nextValue);
        if (inputType === 'datetime-local') {
            return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(nextValue)
                || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(nextValue);
        }
        return true;
    }

    function __tmPrimeCellTextEditorFocus(input, cleanupFns, options = {}) {
        const el = input instanceof HTMLElement ? input : null;
        if (!el) {
            return {
                focus: () => {},
                isReady: () => true,
            };
        }
        const opts = (options && typeof options === 'object') ? options : {};
        const selectionMode = String(opts.selection || '').trim().toLowerCase();
        let ready = false;
        let active = true;
        let rafId = 0;
        let timer30 = 0;
        let timer120 = 0;
        const stopPropagation = (e) => {
            try { e.stopPropagation(); } catch (err) {}
        };
        const focusEditor = () => {
            if (!active) return;
            try {
                el.focus({ preventScroll: true });
            } catch (e) {
                try { el.focus(); } catch (e2) {}
            }
            if (selectionMode === 'all') {
                try { el.select?.(); } catch (e) {}
                return;
            }
            if (selectionMode === 'end') {
                const valueLength = String(el.value || '').length;
                try { el.setSelectionRange?.(valueLength, valueLength); } catch (e) {}
            }
        };
        try { el.addEventListener('pointerdown', stopPropagation); } catch (e) {}
        try { el.addEventListener('mousedown', stopPropagation); } catch (e) {}
        try { el.addEventListener('click', stopPropagation); } catch (e) {}
        focusEditor();
        try {
            rafId = requestAnimationFrame(() => {
                focusEditor();
                ready = true;
            });
        } catch (e) {
            ready = true;
        }
        try {
            timer30 = setTimeout(() => {
                focusEditor();
                ready = true;
            }, 30);
        } catch (e) {}
        try {
            timer120 = setTimeout(() => {
                ready = true;
            }, 120);
        } catch (e) {}
        if (Array.isArray(cleanupFns)) {
            cleanupFns.push(() => {
                active = false;
                ready = true;
                try { el.removeEventListener('pointerdown', stopPropagation); } catch (e) {}
                try { el.removeEventListener('mousedown', stopPropagation); } catch (e) {}
                try { el.removeEventListener('click', stopPropagation); } catch (e) {}
                try { cancelAnimationFrame(rafId); } catch (e) {}
                try { clearTimeout(timer30); } catch (e) {}
                try { clearTimeout(timer120); } catch (e) {}
            });
        }
        return {
            focus: focusEditor,
            isReady: () => ready,
        };
    }

    function __tmScheduleDeferredCellEdit(id, field, td) {
        const cell = td instanceof HTMLElement ? td : null;
        if (!cell) return;
        try {
            if (cell.__tmDeferredCellEditTimer) {
                clearTimeout(cell.__tmDeferredCellEditTimer);
                cell.__tmDeferredCellEditTimer = null;
            }
        } catch (e) {}
        const token = `${String(id || '').trim()}::${String(field || '').trim()}::${Date.now()}`;
        try { cell.__tmDeferredCellEditToken = token; } catch (e) {}
        try {
            cell.__tmDeferredCellEditTimer = setTimeout(() => {
                try {
                    if (cell.__tmDeferredCellEditToken !== token) return;
                    cell.__tmDeferredCellEditToken = null;
                    cell.__tmDeferredCellEditTimer = null;
                    if (!cell.isConnected) return;
                    window.tmBeginCellEdit(id, field, cell, null);
                } catch (e) {}
            }, 0);
        } catch (e) {}
    }

    window.tmBeginCellEdit = function(id, field, td, ev) {
        try {
            if (ev) {
                if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
                if (typeof ev.preventDefault === 'function') ev.preventDefault();
            }
        } catch (e) {}

        const isTimelineDateField = field === 'startDate' || field === 'completionTime' || field === 'customTime';
        const isMobileTimelineCell = __tmIsMobileDevice()
            && state.viewMode === 'timeline'
            && td instanceof Element
            && !!td.closest('.tm-body.tm-body--timeline');
        if (isMobileTimelineCell && isTimelineDateField) return;

        if (!td) return;
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
        if (!task) return;
        const customFieldId = __tmParseCustomFieldColumnKey(field);
        const customField = customFieldId ? __tmGetCustomFieldDefMap().get(customFieldId) : null;
        const isDeferredTextField = field === 'remark'
            || field === 'duration'
            || (customField && String(customField.type || '').trim() === 'text');
        const existingInput = td.querySelector?.('input,select,textarea');
        if (existingInput) {
            try { existingInput.focus?.(); } catch (e) {}
            return;
        }
        if (ev && String(ev.type || '').trim() === 'click' && isDeferredTextField) {
            __tmScheduleDeferredCellEdit(id, field, td);
            return;
        }
        try {
            if (td.__tmDeferredCellEditTimer) {
                clearTimeout(td.__tmDeferredCellEditTimer);
                td.__tmDeferredCellEditTimer = null;
            }
            td.__tmDeferredCellEditToken = null;
        } catch (e) {}

        __tmCloseInlineEditor();
        __tmCloseCellEditor(false);

        const originalText = td.textContent;
        const cleanupFns = [];
        const cleanup = () => {
            while (cleanupFns.length) {
                const fn = cleanupFns.pop();
                try { fn(); } catch (e) {}
            }
        };
        __tmCellEditorState = { td, cleanup, taskId: id, field };

        const finish = (rerender) => __tmCloseCellEditor(rerender);
        const cancel = () => finish(true);

        // Table cells should exit edit mode immediately; persistence already uses optimistic patching.
        const commitAndClose = (val, rerender = false) => {
            const request = __tmCommitCellEdit(id, field, val);
            finish(rerender);
            return request;
        };

        if (field === 'duration' && __tmGetDurationPresetOptions().length) {
            let anchorRect = null;
            try {
                const rect = td.getBoundingClientRect();
                if (rect) {
                    anchorRect = {
                        left: Number(rect.left) || 0,
                        top: Number(rect.top) || 0,
                        right: Number(rect.right) || 0,
                        bottom: Number(rect.bottom) || 0,
                        width: Number(rect.width) || 0,
                        height: Number(rect.height) || 0,
                    };
                }
            } catch (e) {}
            finish(false);
            __tmOpenInlineEditor(td, ({ editor, close }) => {
                try { editor.classList.add('tm-inline-editor--duration'); } catch (e) {}
                const presets = __tmGetDurationPresetOptions();
                const saveDuration = (rawValue) => {
                    const request = __tmCommitCellEdit(id, 'duration', rawValue);
                    close();
                    return request;
                };
                const presetWrap = document.createElement('div');
                presetWrap.className = 'tm-duration-preset-list tm-duration-preset-list--compact';
                presetWrap.innerHTML = __tmBuildDurationPresetOptionsHtml(String(task.duration || ''), presets);
                editor.appendChild(presetWrap);

                const helper = document.createElement('div');
                helper.className = 'tm-duration-preset-helper';
                helper.textContent = '可选预设，也可继续直接填写自定义时长';
                editor.appendChild(helper);

                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'tm-duration-editor-input';
                input.placeholder = '例如：30 或 30m';
                input.value = String(task.duration || '');
                editor.appendChild(input);

                __tmBindDurationPresetSelection(editor, input, {
                    onSelect: async (nextValue) => {
                        await saveDuration(nextValue);
                    },
                    focusInputOnSelect: false,
                    selectInput: false,
                });

                const { wrap } = __tmBuildActions('保存', async () => {
                    await saveDuration(input.value);
                }, close);
                editor.appendChild(wrap);
                try {
                    input.focus();
                    input.select?.();
                } catch (e) {}
                input.onkeydown = (e) => {
                    if (e.key === 'Enter') wrap.querySelector('button.tm-btn-primary')?.click?.();
                };
            }, { anchorRect });
            return;
        }

        td.innerHTML = '';

        if (field === 'priority') {
            const select = document.createElement('select');
            select.className = 'tm-cell-editor-select';
            select.innerHTML = `
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
            `;
            select.value = task.priority || 'medium';
            td.appendChild(select);

            select.onchange = () => commitAndClose(select.value);
            select.onblur = () => cancel();
            select.onkeydown = (e) => {
                if (e.key === 'Escape') cancel();
                if (e.key === 'Enter') commitAndClose(select.value);
            };
            try {
                select.focus();
                setTimeout(() => {
                    try { select.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); } catch (e) {}
                    try { select.click(); } catch (e) {}
                }, 0);
            } catch (e) {}
            return;
        }

            if (field === 'completionTime') {
            const input = document.createElement('input');
            input.type = 'date';
            input.className = 'tm-cell-editor-input';
            const val = String(task.completionTime || '').trim();
            input.value = val ? val.slice(0, 10) : '';
            td.appendChild(input);

            const initial = input.value;
            let committed = false;
            if (__tmIsMobileDevice()) {
                const onDocPointerDown = (e) => {
                    const t = e?.target;
                    if (!t) return;
                    if (td.contains(t)) return;
                    if (committed) return;
                    committed = true;
                    cancel();
                };
                document.addEventListener('pointerdown', onDocPointerDown, true);
                cleanupFns.push(() => document.removeEventListener('pointerdown', onDocPointerDown, true));
            }
            const save = () => {
                if (committed) return;
                const next = String(input.value || '').trim();
                if (next === String(initial || '').trim()) {
                    committed = true;
                    finish(false);
                    return;
                }
                committed = true;
                commitAndClose(next, false);
            };
            input.onchange = () => save();
            input.oninput = () => {
                if (!__tmIsNativeDateInputValueReady(input.type, input.value)) return;
                save();
            };
            input.onblur = () => {
                if (__tmIsMobileDevice()) return;
                if (committed) return;
                committed = true;
                cancel();
            };
            input.onkeydown = (e) => {
                if (e.key === 'Escape') cancel();
                if (e.key === 'Enter') save();
            };
            input.onclick = () => {
                try { input.showPicker?.(); } catch (e) {}
            };
            try {
                input.focus();
                input.showPicker?.();
            } catch (e) {}
            return;
        }

            if (field === 'startDate') {
            const input = document.createElement('input');
            input.type = 'date';
            input.className = 'tm-cell-editor-input';
            const val = String(task.startDate || '').trim();
            input.value = val ? val.slice(0, 10) : '';
            td.appendChild(input);

            const initial = input.value;
            let committed = false;
            if (__tmIsMobileDevice()) {
                const onDocPointerDown = (e) => {
                    const t = e?.target;
                    if (!t) return;
                    if (td.contains(t)) return;
                    if (committed) return;
                    committed = true;
                    cancel();
                };
                document.addEventListener('pointerdown', onDocPointerDown, true);
                cleanupFns.push(() => document.removeEventListener('pointerdown', onDocPointerDown, true));
            }
            const save = () => {
                if (committed) return;
                const next = String(input.value || '').trim();
                if (next === String(initial || '').trim()) {
                    committed = true;
                    finish(false);
                    return;
                }
                committed = true;
                commitAndClose(next, false);
            };
            input.onchange = () => save();
            input.oninput = () => {
                if (!__tmIsNativeDateInputValueReady(input.type, input.value)) return;
                save();
            };
            input.onblur = () => {
                if (__tmIsMobileDevice()) return;
                if (committed) return;
                committed = true;
                cancel();
            };
            input.onkeydown = (e) => {
                if (e.key === 'Escape') cancel();
                if (e.key === 'Enter') save();
            };
            input.onclick = () => {
                try { input.showPicker?.(); } catch (e) {}
            };
            try {
                input.focus();
                input.showPicker?.();
            } catch (e) {}
            return;
        }

        if (field === 'customTime') {
            const input = document.createElement('input');
            input.type = 'datetime-local';
            input.className = 'tm-cell-editor-input';
            const current = String(task.customTime || '').trim();
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(current)) input.value = current.slice(0, 16);
            else input.value = __tmToDatetimeLocalValue(current);
            td.appendChild(input);

            const initial = input.value;
            let committed = false;
            if (__tmIsMobileDevice()) {
                const onDocPointerDown = (e) => {
                    const t = e?.target;
                    if (!t) return;
                    if (td.contains(t)) return;
                    if (committed) return;
                    committed = true;
                    cancel();
                };
                document.addEventListener('pointerdown', onDocPointerDown, true);
                cleanupFns.push(() => document.removeEventListener('pointerdown', onDocPointerDown, true));
            }
            const save = () => {
                if (committed) return;
                const next = String(input.value || '').trim();
                if (next === String(initial || '').trim()) {
                    committed = true;
                    finish(false);
                    return;
                }
                committed = true;
                commitAndClose(next, false);
            };
            input.onchange = () => save();
            input.oninput = () => {
                if (!__tmIsNativeDateInputValueReady(input.type, input.value)) return;
                save();
            };
            input.onblur = () => {
                if (__tmIsMobileDevice()) return;
                if (committed) return;
                committed = true;
                cancel();
            };
            input.onkeydown = (e) => {
                if (e.key === 'Escape') cancel();
                if (e.key === 'Enter') save();
            };
            input.onclick = () => {
                try { input.showPicker?.(); } catch (e) {}
            };
            try {
                input.focus();
                input.showPicker?.();
            } catch (e) {}
            return;
        }

        if (field === 'duration') {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'tm-cell-editor-input';
            input.value = String(task.duration || '');
            td.appendChild(input);
            const focusState = __tmPrimeCellTextEditorFocus(input, cleanupFns, { selection: 'all' });
            const save = () => commitAndClose(input.value, false);
            input.onblur = () => {
                if (!focusState.isReady()) {
                    focusState.focus();
                    return;
                }
                save();
            };
            input.onkeydown = (e) => {
                if (e.key === 'Escape') cancel();
                if (e.key === 'Enter') save();
            };
            return;
        }

        if (customField && String(customField.type || '').trim() === 'text') {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'tm-cell-editor-input';
            input.value = String(__tmNormalizeCustomFieldValue(customField, __tmGetTaskCustomFieldValue(task, customFieldId)) || '');
            td.appendChild(input);
            const focusState = __tmPrimeCellTextEditorFocus(input, cleanupFns, { selection: 'all' });
            const save = () => commitAndClose(input.value, false);
            input.onblur = () => {
                if (!focusState.isReady()) {
                    focusState.focus();
                    return;
                }
                save();
            };
            input.onkeydown = (e) => {
                if (e.key === 'Escape') cancel();
                if (e.key === 'Enter') save();
            };
            return;
        }

        if (field === 'remark') {
            const input = document.createElement('textarea');
            input.className = 'tm-cell-editor-textarea';
            input.rows = 4;
            input.value = String(task.remark || '');
            td.appendChild(input);
            const focusState = __tmPrimeCellTextEditorFocus(input, cleanupFns, { selection: 'end' });
            const save = () => commitAndClose(input.value, false);
            input.onblur = () => {
                if (!focusState.isReady()) {
                    focusState.focus();
                    return;
                }
                save();
            };
            input.onkeydown = (e) => {
                if (e.key === 'Escape') cancel();
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    try { e.preventDefault(); } catch (err) {}
                    save();
                    return;
                }
                __tmHandleRemarkTextareaKeydown(input, e);
            };
            return;
        }

        td.textContent = originalText;
        finish(false);
    };

    let __tmInlineEditorState = null;

    let __inlineEditorUnstack = null;

    function __tmCloseInlineEditor(reason = '') {
        const closeReason = String(reason || '').trim() || 'manual';
        try {
            __tmPushDetailDebug('inline-editor-close', {
                reason: closeReason,
                anchor: __tmDescribeDebugElement(__tmInlineEditorState?.anchorEl || null),
                editorOpen: !!__tmInlineEditorState?.el,
            });
        } catch (e) {}
        __inlineEditorUnstack?.();
        __inlineEditorUnstack = null;
        if (!__tmInlineEditorState) return;
        try { __tmInlineEditorState.cleanup?.(); } catch (e) {}
        try { __tmInlineEditorState.el?.remove?.(); } catch (e) {}
        __tmInlineEditorState = null;
    }

    function __tmResolveInlineEditorZIndex(anchorEl, fallback = 100003) {
        let maxZ = Number(fallback) || 100003;
        let node = anchorEl instanceof Element ? anchorEl : null;
        while (node && node !== document.body && node !== document.documentElement) {
            try {
                const raw = window.getComputedStyle(node).zIndex;
                const z = Number.parseInt(String(raw || '').trim(), 10);
                if (Number.isFinite(z)) maxZ = Math.max(maxZ, z + 1);
            } catch (e) {}
            node = node.parentElement;
        }
        return maxZ;
    }

    function __tmOpenInlineEditor(anchorEl, build, options = {}) {
        if (!anchorEl) return null;
        __tmCloseInlineEditor('replace-open');
        const opts = (options && typeof options === 'object') ? options : {};

        const editor = document.createElement('div');
        editor.className = 'tm-inline-editor';
        editor.tabIndex = -1;
        document.body.appendChild(editor);
        try {
            // Keep the inline editor above the plugin modal that owns the anchor
            // without globally raising SiYuan's protyle layers.
            editor.style.zIndex = String(__tmResolveInlineEditorZIndex(anchorEl));
        } catch (e) {}

        const cleanupFns = [];
        const cleanup = () => {
            while (cleanupFns.length) {
                const fn = cleanupFns.pop();
                try { fn(); } catch (e) {}
            }
        };

        const api = {
            editor,
            close: __tmCloseInlineEditor,
            onCleanup: (fn) => cleanupFns.push(fn),
        };

        build(api);
        try {
            __tmPushDetailDebug('inline-editor-open', {
                anchor: __tmDescribeDebugElement(anchorEl),
                inTaskDetail: !!anchorEl.closest?.('.tm-task-detail, #tm-task-detail-overlay, #tmChecklistDetailPanel, #tmChecklistSheetPanel, #tmKanbanDetailPanel'),
                editorChildCount: Number(editor.childElementCount || 0),
            });
        } catch (e) {}

        const customRect = opts.anchorRect && typeof opts.anchorRect === 'object' ? opts.anchorRect : null;
        const rect = customRect || anchorEl.getBoundingClientRect();
        const vw = window.innerWidth || document.documentElement.clientWidth || 0;
        const vh = window.innerHeight || document.documentElement.clientHeight || 0;

        const ew = editor.offsetWidth || 240;
        const eh = editor.offsetHeight || 120;
        const gap = 6;

        let left = rect.left;
        let top = rect.bottom + gap;
        if (left + ew + 8 > vw) left = Math.max(8, vw - ew - 8);
        if (top + eh + 8 > vh) {
            const up = rect.top - eh - gap;
            if (up >= 8) top = up;
            else top = Math.max(8, vh - eh - 8);
        }
        left = Math.max(8, left);

        editor.style.left = `${Math.round(left)}px`;
        editor.style.top = `${Math.round(top)}px`;

        const onDocPointerDown = (e) => {
            const t = e.target;
            if (editor.contains(t)) return;
            if (anchorEl.contains && anchorEl.contains(t)) return;
            __tmCloseInlineEditor('outside-pointerdown');
        };

        document.addEventListener('pointerdown', onDocPointerDown, true);

        cleanupFns.push(() => document.removeEventListener('pointerdown', onDocPointerDown, true));

        __tmInlineEditorState = { el: editor, cleanup, anchorEl };

        __inlineEditorUnstack = __tmModalStackBind(__tmCloseInlineEditor);

        try {
            const focusable = editor.querySelector('input,select,button,textarea');
            focusable?.focus?.();
            focusable?.select?.();
        } catch (e) {}

        return api;
    }

    function __tmCollectTaskDetailFallbackDeferReasons(rootEl) {
        const root = rootEl instanceof Element ? rootEl : null;
        if (!(root instanceof Element)) return [];
        const reasons = [];
        try {
            if (root.__tmTaskDetailClosing === true || root.__tmTaskDetailClosed === true) reasons.push('closing');
        } catch (e) {}
        try {
            if (root.__tmTaskDetailPendingSave === true) reasons.push('pending-save');
        } catch (e) {}
        try {
            const holdUntil = Math.max(0, Number(root.__tmTaskDetailRefreshHoldUntil) || 0);
            if (holdUntil > Date.now()) reasons.push(`refresh-hold:${holdUntil - Date.now()}`);
        } catch (e) {}
        try {
            const activePopover = root.__tmTaskDetailActiveInlinePopover;
            if (activePopover instanceof Element && document.body.contains(activePopover)) reasons.push('active-popover');
        } catch (e) {}
        try {
            if (root.querySelector?.('[data-tm-detail-status-trigger][aria-expanded="true"], [data-tm-detail-priority-trigger][aria-expanded="true"]')) {
                reasons.push('menu-open');
            }
        } catch (e) {}
        try {
            const inlineAnchor = __tmInlineEditorState?.anchorEl;
            if (inlineAnchor instanceof Element && root.contains(inlineAnchor)) reasons.push('inline-editor-open');
        } catch (e) {}
        try {
            const globalReasons = __tmCollectGlobalTaskDetailUiReasons();
            if (Array.isArray(globalReasons) && globalReasons.length) {
                globalReasons.forEach((reason) => reasons.push(reason));
            }
        } catch (e) {}
        return reasons;
    }

    function __tmShouldDeferTaskDetailFallback(rootEl) {
        return __tmCollectTaskDetailFallbackDeferReasons(rootEl).length > 0;
    }

    function __tmBuildActions(okLabel, onOk, onCancel, extraButtons) {
        const wrap = document.createElement('div');
        wrap.className = 'tm-inline-editor-actions';

        if (Array.isArray(extraButtons)) {
            extraButtons.forEach(btn => wrap.appendChild(btn));
        }

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'tm-btn tm-btn-secondary';
        cancelBtn.textContent = '取消';
        cancelBtn.onclick = () => onCancel?.();

        const okBtn = document.createElement('button');
        okBtn.className = 'tm-btn tm-btn-primary';
        okBtn.textContent = okLabel || '确定';
        okBtn.onclick = () => onOk?.();

        wrap.appendChild(cancelBtn);
        wrap.appendChild(okBtn);
        return { wrap, okBtn, cancelBtn };
    }

    window.tmEditPriorityInline = function(id, el) {
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
        if (!task) return;
        const useChecklistLegacy = __tmShouldUseChecklistLegacyFieldCommit();
        __tmOpenInlineEditor(el, ({ editor, close }) => {
            const select = document.createElement('select');
            const opts = [
                { value: '', label: '无' },
                { value: 'high', label: '高' },
                { value: 'medium', label: '中' },
                { value: 'low', label: '低' },
            ];
            select.innerHTML = opts.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
            select.value = task.priority || '';
            select.onchange = async () => {
                const next = String(select.value || '');
                if (useChecklistLegacy) {
                    try {
                        await __tmRequestChecklistLegacyTaskPatch(id, { priority: next }, {
                            source: 'inline-priority-editor',
                            label: '优先级',
                        });
                        close();
                        hint('✅ 优先级已更新', 'success');
                    } catch (e) {
                        hint(`❌ 更新失败: ${e.message}`, 'error');
                    }
                    return;
                }
                close();
                void __tmCommitUiFriendlyTaskPatch(id, { priority: next }, {
                    source: 'inline-priority-editor',
                    label: '优先级',
                });
            };
            editor.appendChild(select);
        });
    };

    window.tmEditDurationInline = function(id, el) {
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
        if (!task) return;
        const useChecklistLegacy = __tmShouldUseChecklistLegacyFieldCommit();
        __tmOpenInlineEditor(el, ({ editor, close }) => {
            try { editor.classList.add('tm-inline-editor--duration'); } catch (e) {}
            const saveDuration = async (rawValue) => {
                const next = String(rawValue || '').trim();
                if (useChecklistLegacy) {
                    try {
                        await __tmRequestChecklistLegacyTaskPatch(id, { duration: next }, {
                            source: 'inline-duration-editor',
                            label: '时长',
                        });
                        close();
                        hint('✅ 时长已更新', 'success');
                    } catch (e) {
                        hint(`❌ 更新失败: ${e.message}`, 'error');
                    }
                    return;
                }
                close();
                return __tmCommitUiFriendlyTaskPatch(id, { duration: next }, {
                    source: 'inline-duration-editor',
                    label: '时长',
                });
            };
            const presets = __tmGetDurationPresetOptions();
            if (presets.length) {
                const presetWrap = document.createElement('div');
                presetWrap.className = 'tm-duration-preset-list tm-duration-preset-list--compact';
                presetWrap.innerHTML = __tmBuildDurationPresetOptionsHtml(String(task.duration || ''), presets);
                editor.appendChild(presetWrap);

                const helper = document.createElement('div');
                helper.className = 'tm-duration-preset-helper';
                helper.textContent = '可选预设，也可继续直接填写自定义时长';
                editor.appendChild(helper);
            }
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'tm-duration-editor-input';
            input.placeholder = '例如：30 或 30m';
            input.value = String(task.duration || '');
            editor.appendChild(input);
            if (presets.length) {
                __tmBindDurationPresetSelection(editor, input, {
                    onSelect: async (nextValue) => {
                        await saveDuration(nextValue);
                    },
                    focusInputOnSelect: false,
                    selectInput: false,
                });
            }
            const { wrap } = __tmBuildActions('保存', async () => {
                await saveDuration(input.value);
            }, close);
            editor.appendChild(wrap);
            try {
                input.focus();
                input.select?.();
            } catch (e) {}
            input.onkeydown = (e) => {
                if (e.key === 'Enter') wrap.querySelector('button.tm-btn-primary')?.click?.();
            };
        });
    };

    window.tmEditRemarkInline = function(id, el) {
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
        if (!task) return;
        const useChecklistLegacy = __tmShouldUseChecklistLegacyFieldCommit();
        __tmOpenInlineEditor(el, ({ editor, close }) => {
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = '输入备注（可留空）';
            input.value = String(task.remark || '');
            editor.appendChild(input);
            const { wrap } = __tmBuildActions('保存', async () => {
                const next = __tmNormalizeRemarkMarkdown(input.value);
                if (useChecklistLegacy) {
                    try {
                        await __tmRequestChecklistLegacyTaskPatch(id, { remark: next }, {
                            source: 'inline-remark-editor',
                            label: '备注',
                        });
                        close();
                        hint('✅ 备注已更新', 'success');
                    } catch (e) {
                        hint(`❌ 更新失败: ${e.message}`, 'error');
                    }
                    return;
                }
                close();
                return __tmCommitUiFriendlyTaskPatch(id, { remark: next }, {
                    source: 'inline-remark-editor',
                    label: '备注',
                });
            }, close);
            editor.appendChild(wrap);
            input.onkeydown = (e) => {
                if (e.key === 'Enter') wrap.querySelector('button.tm-btn-primary')?.click?.();
            };
        });
    };

    window.tmEditCompletionTimeInline = function(id, el) {
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
        if (!task) return;
        const useChecklistLegacy = __tmShouldUseChecklistLegacyFieldCommit();
        __tmOpenInlineEditor(el, ({ editor, close }) => {
            const input = document.createElement('input');
            input.type = 'date';
            input.value = __tmNormalizeDateOnly(task.completionTime || '');
            editor.appendChild(input);

            const clearBtn = document.createElement('button');
            clearBtn.className = 'tm-btn tm-btn-secondary';
            clearBtn.textContent = '清空';
            clearBtn.onclick = async () => {
                if (useChecklistLegacy) {
                    try {
                        await __tmRequestChecklistLegacyTaskPatch(id, { completionTime: '' }, {
                            source: 'inline-completion-editor',
                            label: '截止日期',
                        });
                        close();
                        hint('✅ 截止日期已清空', 'success');
                    } catch (e) {
                        hint(`❌ 更新失败: ${e.message}`, 'error');
                    }
                    return;
                }
                close();
                void __tmCommitUiFriendlyTaskPatch(id, { completionTime: '' }, {
                    source: 'inline-completion-editor',
                    label: '截止日期',
                });
            };

            const save = async () => {
                const raw = String(input.value || '').trim();
                const next = raw ? __tmNormalizeDateOnly(raw) : '';
                if (useChecklistLegacy) {
                    try {
                        await __tmRequestChecklistLegacyTaskPatch(id, { completionTime: next }, {
                            source: 'inline-completion-editor',
                            label: '截止日期',
                        });
                        close();
                        hint('✅ 截止日期已更新', 'success');
                    } catch (e) {
                        hint(`❌ 更新失败: ${e.message}`, 'error');
                    }
                    return;
                }
                close();
                return __tmCommitUiFriendlyTaskPatch(id, { completionTime: next }, {
                    source: 'inline-completion-editor',
                    label: '截止日期',
                });
            };

            const actions = document.createElement('div');
            actions.className = 'tm-inline-editor-actions';
            actions.appendChild(clearBtn);
            editor.appendChild(actions);

            input.onchange = () => save();
            input.onkeydown = (e) => {
                if (e.key === 'Enter') save();
            };
        });
    };

    window.tmPickHeadingInline = async function(id, el, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        const tid = String(id || '').trim();
        if (!tid) return;
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid];
        if (!task) return;
        if (!__tmEnsureEditableTaskLike(task, '切换标题')) return;
        const docId = String(task.docId || task.root_id || '').trim();
        if (!docId) {
            hint('⚠ 未找到任务所在文档', 'warning');
            return;
        }
        try { await __tmWarmKanbanDocHeadings([docId], { force: true }); } catch (e) {}
        const headingLevel = __tmNormalizeHeadingLevel(SettingsStore.data.taskHeadingLevel || 'h2');
        const headingLabelMap = { h1: '一级标题', h2: '二级标题', h3: '三级标题', h4: '四级标题', h5: '五级标题', h6: '六级标题' };
        const headingLabel = headingLabelMap[headingLevel] || '标题';
        const headingsRaw = Array.isArray(state.kanbanDocHeadingsByDocId?.[docId]) ? state.kanbanDocHeadingsByDocId[docId] : [];
        const headings = headingsRaw
            .map((h) => ({
                id: String(h?.id || '').trim(),
                content: String(h?.content || '').trim() || '(空标题)',
                sort: Number(h?.sort) || Number(h?.rank) || 0
            }))
            .filter((h) => !!h.id);
        const currentHeadingId = String(task.h2Id || '').trim();
        const hasCurrentHeading = !!currentHeadingId || !!__tmNormalizeHeadingText(task?.h2 || task?.h2Name);
        if (!headings.length && !hasCurrentHeading) {
            hint(`⚠ 当前文档没有可切换的${headingLabel}`, 'warning');
            return;
        }
        const anchorEl = (el instanceof Element)
            ? el
            : (ev?.currentTarget instanceof Element ? ev.currentTarget : null);

        const saveHeading = async (nextHeadingId, close) => {
            const nextId = String(nextHeadingId || '').trim();
            if (nextId === currentHeadingId) {
                close?.();
                return;
            }
            try {
                if (nextId) {
                    await __tmQueueMoveTask(tid, { targetDocId: docId, headingId: nextId, mode: 'heading' });
                } else {
                    await __tmQueueMoveTask(tid, { targetDocId: docId, mode: 'docTop' });
                }
                close?.();
                applyFilters();
                render();
                hint(nextId ? '✅ 任务已移动到目标标题下' : '✅ 任务已移出标题分组', 'success');
            } catch (e) {
                hint(`❌ 切换失败: ${e.message}`, 'error');
            }
        };

        if (!(anchorEl instanceof Element)) {
            const options = [
                { value: '', label: `无${headingLabel}` },
                ...headings.map(h => ({
                    value: String(h?.id || '').trim(),
                    label: String(h?.content || '').trim() || '(空标题)'
                }))
            ];
            const next = await showSelectPrompt(`选择${headingLabel}`, options, currentHeadingId);
            if (next == null) return;
            await saveHeading(next, null);
            return;
        }

        __tmOpenInlineEditor(anchorEl, ({ editor, close }) => {
            const maxLen = headings.reduce((m, h) => Math.max(m, String(h?.content || '').trim().length), (`无${headingLabel}`).length);
            const w = Math.min(320, Math.max(140, maxLen * 12 + 36));
            editor.style.minWidth = '0';
            editor.style.width = `${w}px`;
            editor.style.padding = '8px';
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.gap = '4px';

            const makeBtn = (value, label, active) => {
                const b = document.createElement('button');
                b.className = 'tm-btn tm-btn-secondary';
                b.style.padding = '6px 8px';
                b.style.fontSize = '12px';
                b.style.textAlign = 'left';
                b.style.justifyContent = 'flex-start';
                b.style.display = 'block';
                b.style.width = '100%';
                if (active) {
                    b.style.borderColor = 'var(--tm-primary-color)';
                    b.style.background = 'var(--tm-selected-bg, rgba(64, 158, 255, 0.12))';
                }
                b.textContent = label;
                b.onclick = async () => {
                    await saveHeading(value, close);
                };
                return b;
            };

            wrap.appendChild(makeBtn('', `无${headingLabel}`, !currentHeadingId));
            headings.forEach((h) => {
                const hid = String(h?.id || '').trim();
                const text = String(h?.content || '').trim() || '(空标题)';
                wrap.appendChild(makeBtn(hid, text, hid === currentHeadingId));
            });
            editor.appendChild(wrap);
        });
    };

    window.tmPickTaskDocInline = async function(id, el, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        const tid = String(id || '').trim();
        if (!tid) return;
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid];
        if (!task) return;
        if (!__tmEnsureEditableTaskLike(task, '移动到文档')) return;
        const currentDocId = String(task.docId || task.root_id || '').trim();
        const docs = __tmGetVisibleDocTabsForCurrentGroup()
            .filter(doc => String(doc.id || '').trim() && String(doc.id || '').trim() !== currentDocId);
        const allDocs = await __tmResolveCurrentGroupAllDocEntries({ excludeDocId: currentDocId });
        if (!allDocs.length) {
            hint('⚠ 当前分组内没有可移动到的其他文档', 'warning');
            return;
        }

        const saveDoc = async (nextDocId, close) => {
            const nextId = String(nextDocId || '').trim();
            if (!nextId || nextId === currentDocId) {
                close?.();
                return;
            }
            try {
                hint('🔄 正在移动任务...', 'info');
                await __tmQueueMoveTask(tid, { targetDocId: nextId, mode: 'docTop' });
                close?.();
                await loadSelectedDocuments();
                hint('✅ 任务已移动到目标文档顶部', 'success');
            } catch (e) {
                hint(`❌ 移动失败: ${e.message}`, 'error');
            }
        };

        const openSearchDocPicker = async (close) => {
            close?.();
            const next = await __tmOpenDocSearchPrompt('搜索当前分组文档', allDocs, {
                placeholder: '搜索当前分组内文档名、别名或 ID',
                emptyText: '当前分组内没有匹配的文档',
            });
            if (!next) return;
            await saveDoc(next, null);
        };

        const anchorEl = (el instanceof Element)
            ? el
            : (ev?.currentTarget instanceof Element ? ev.currentTarget : null);

        if (!(anchorEl instanceof Element)) {
            const next = await showSelectPrompt('选择目标文档', [
                { value: '__tm_search__', label: `搜索文档（当前分组共 ${allDocs.length} 个）` },
                ...docs.map(doc => ({
                    value: doc.id,
                    label: __tmGetDocDisplayName(doc, String(doc?.name || '').trim() || '未命名文档'),
                }))
            ], '');
            if (next == null) return;
            if (next === '__tm_search__') {
                await openSearchDocPicker(null);
                return;
            }
            await saveDoc(next, null);
            return;
        }

        __tmOpenInlineEditor(anchorEl, ({ editor, close }) => {
            const maxLen = docs.reduce((m, doc) => Math.max(m, __tmGetDocDisplayName(doc, String(doc?.name || '').trim() || '未命名文档').length), 6);
            const w = Math.min(320, Math.max(160, maxLen * 12 + 36));
            editor.style.minWidth = '0';
            editor.style.width = `${w}px`;
            editor.style.padding = '8px';
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.gap = '4px';
            const searchBtn = document.createElement('button');
            searchBtn.className = 'tm-btn tm-btn-primary';
            searchBtn.style.padding = '7px 8px';
            searchBtn.style.fontSize = '12px';
            searchBtn.style.textAlign = 'left';
            searchBtn.style.justifyContent = 'flex-start';
            searchBtn.style.display = 'block';
            searchBtn.style.width = '100%';
            searchBtn.textContent = `搜索文档（当前分组共 ${allDocs.length} 个）`;
            searchBtn.onclick = async () => {
                await openSearchDocPicker(close);
            };
            wrap.appendChild(searchBtn);
            if (docs.length) {
                const tip = document.createElement('div');
                tip.style.cssText = 'padding:2px 2px 4px;font-size:11px;color:var(--tm-secondary-text);';
                tip.textContent = '或直接移动到当前分组内已有任务的文档';
                wrap.appendChild(tip);
            } else {
                const tip = document.createElement('div');
                tip.style.cssText = 'padding:2px 2px 4px;font-size:11px;color:var(--tm-secondary-text);';
                tip.textContent = '当前分组内暂无其他有任务的文档，可使用上方搜索全部文档';
                wrap.appendChild(tip);
            }
            docs.forEach((doc) => {
                const btn = document.createElement('button');
                btn.className = 'tm-btn tm-btn-secondary';
                btn.style.padding = '6px 8px';
                btn.style.fontSize = '12px';
                btn.style.textAlign = 'left';
                btn.style.justifyContent = 'flex-start';
                btn.style.display = 'block';
                btn.style.width = '100%';
                btn.textContent = __tmGetDocDisplayName(doc, String(doc?.name || '').trim() || '未命名文档');
                btn.onclick = async () => {
                    await saveDoc(String(doc?.id || '').trim(), close);
                };
                wrap.appendChild(btn);
            });
            editor.appendChild(wrap);
        });
    };

    window.tmEditPriority = async function(id) {
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
        if (!task) return;
        const useChecklistLegacy = __tmShouldUseChecklistLegacyFieldCommit();
        const next = await showSelectPrompt('设置优先级', [
            { value: '', label: '无' },
            { value: 'high', label: '高' },
            { value: 'medium', label: '中' },
            { value: 'low', label: '低' },
        ], task.priority || '');
        if (next == null) return;
        if (useChecklistLegacy) {
            try {
                await __tmRequestChecklistLegacyTaskPatch(id, { priority: next }, {
                    source: 'prompt-priority',
                    label: '优先级',
                });
                hint('✅ 优先级已更新', 'success');
            } catch (e) {
                hint(`❌ 更新失败: ${e.message}`, 'error');
            }
            return;
        }
        await __tmCommitUiFriendlyTaskPatch(id, { priority: next }, {
            source: 'prompt-priority',
            label: '优先级',
            successHint: '✅ 优先级已更新',
            defer: false,
        });
    };

    window.tmEditDuration = async function(id) {
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
        if (!task) return;
        const useChecklistLegacy = __tmShouldUseChecklistLegacyFieldCommit();
        const next = await showDurationPrompt('设置时长', String(task.duration || ''));
        if (next == null) return;
        if (useChecklistLegacy) {
            try {
                await __tmRequestChecklistLegacyTaskPatch(id, { duration: String(next || '').trim() }, {
                    source: 'prompt-duration',
                    label: '时长',
                });
                hint('✅ 时长已更新', 'success');
            } catch (e) {
                hint(`❌ 更新失败: ${e.message}`, 'error');
            }
            return;
        }
        await __tmCommitUiFriendlyTaskPatch(id, { duration: String(next || '').trim() }, {
            source: 'prompt-duration',
            label: '时长',
            successHint: '✅ 时长已更新',
            defer: false,
        });
    };

    window.tmEditRemark = async function(id) {
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
        if (!task) return;
        const useChecklistLegacy = __tmShouldUseChecklistLegacyFieldCommit();
        const next = await showPrompt('设置备注', '输入备注（可留空）', String(task.remark || ''));
        if (next == null) return;
        const remark = __tmNormalizeRemarkMarkdown(next);
        if (useChecklistLegacy) {
            try {
                await __tmRequestChecklistLegacyTaskPatch(id, { remark }, {
                    source: 'prompt-remark',
                    label: '备注',
                });
                hint('✅ 备注已更新', 'success');
            } catch (e) {
                hint(`❌ 更新失败: ${e.message}`, 'error');
            }
            return;
        }
        await __tmCommitUiFriendlyTaskPatch(id, { remark }, {
            source: 'prompt-remark',
            label: '备注',
            successHint: '✅ 备注已更新',
            defer: false,
        });
    };

    window.tmEditCompletionTime = async function(id) {
        const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
        if (!task) return;
        const useChecklistLegacy = __tmShouldUseChecklistLegacyFieldCommit();
        const next = await showDateTimePrompt('设置截止日期', task.completionTime || '');
        if (next == null) return;
        if (useChecklistLegacy) {
            try {
                await __tmRequestChecklistLegacyTaskPatch(id, { completionTime: String(next || '').trim() }, {
                    source: 'prompt-completion-time',
                    label: '截止日期',
                });
                hint('✅ 截止日期已更新', 'success');
            } catch (e) {
                hint(`❌ 更新失败: ${e.message}`, 'error');
            }
            return;
        }
        await __tmCommitUiFriendlyTaskPatch(id, { completionTime: String(next || '').trim() }, {
            source: 'prompt-completion-time',
            label: '截止日期',
            successHint: '✅ 截止日期已更新',
            defer: false,
        });
    };

    window.updateFontSize = async function(value) {
        const size = parseInt(value) || 14;
        await SettingsStore.updateFontSize(size);
        render();
    };

    window.updateFontSizeMobile = async function(value) {
        const size = parseInt(value) || 14;
        await SettingsStore.updateFontSizeMobile(size);
        render();
    };

    window.updateRowHeightMode = async function(value) {
        const mode = String(value || 'auto').trim() || 'auto';
        SettingsStore.data.rowHeightMode = mode;
        await SettingsStore.save();
        render();
    };

    window.updateRowHeightPx = async function(value) {
        const px = Math.max(0, Math.floor(Number(value) || 0));
        SettingsStore.data.rowHeightPx = px;
        await SettingsStore.save();
        render();
    };

    window.updateTaskAutoWrapEnabled = async function(enabled) {
        SettingsStore.data.taskAutoWrapEnabled = !!enabled;
        await SettingsStore.save();
        showSettings();
        render();
    };

    window.updateTaskContentWrapMaxLines = async function(value) {
        const n = Math.max(1, Math.min(10, Math.round(Number(value) || 3)));
        SettingsStore.data.taskContentWrapMaxLines = n;
        await SettingsStore.save();
        if (state.settingsModal) showSettings();
        render();
    };

    window.updateTaskRemarkWrapMaxLines = async function(value) {
        const n = Math.max(1, Math.min(10, Math.round(Number(value) || 2)));
        SettingsStore.data.taskRemarkWrapMaxLines = n;
        await SettingsStore.save();
        if (state.settingsModal) showSettings();
        render();
    };

    window.updateTaskHeadingLevel = async function(value) {
        const level = __tmNormalizeHeadingLevel(value || 'h2');
        SettingsStore.data.taskHeadingLevel = level;
        try { SettingsStore.syncToLocal(); } catch (e) {}
        await SettingsStore.save();
        await loadSelectedDocuments();
    };

    window.updateDocDisplayNameMode = async function(value) {
        SettingsStore.data.docDisplayNameMode = __tmNormalizeDocDisplayNameMode(value);
        __tmRefreshTaskDocDisplayNames();
        try { SettingsStore.syncToLocal(); } catch (e) {}
        await SettingsStore.save();
        if (state.settingsModal) showSettings();
        render();
    };

    // 导航功能
    const __getPluginApp = () => globalThis.__tmRuntimeHost?.getNavigationContext?.()?.app || globalThis.__tmHost?.getApp?.() || globalThis.__taskHorizonPluginApp || globalThis.__tomatoPluginApp || null;

    const __tmGetNavigationRuntime = () => {
        const fromService = globalThis.__tmRuntimeHost?.getNavigationContext?.();
        if (fromService && typeof fromService === 'object') return fromService;
        const isDockHost = __tmIsDockHost();
        const runtimeMobileClient = __tmIsRuntimeMobileClient();
        return {
            app: __getPluginApp(),
            isDockHost,
            runtimeMobileClient,
            nativeMobileClient: __tmIsNativeMobileRuntimeClient(),
            topWin: isDockHost ? (window.parent || window.top || window) : window,
            topDoc: (isDockHost ? (window.parent || window.top || window) : window)?.document || document,
            closeAfterMobileAction(delayMs = 120) {
                if (!runtimeMobileClient) return false;
                setTimeout(() => {
                    try { window.tmClose?.(); } catch (e) {}
                }, Math.max(0, Number(delayMs) || 0));
                return true;
            },
        };
    };

    // 尝试获取全局的 API 函数
    const getOpenTabFn = () => {
        return globalThis.__tmHost?.getOpenTabFn?.() ||
               window.openTab ||
               globalThis.__taskHorizonOpenTab ||
               globalThis.__tomatoOpenTab;
    };

    const getOpenMobileFn = () => {
        return globalThis.__tmHost?.getOpenMobileFileByIdFn?.() ||
               window.openMobileFileById ||
               globalThis.__taskHorizonOpenMobileFileById ||
               globalThis.__tomatoOpenMobileFileById;
    };

    let __tmLastFocusedProtyle = null;

    const __tmRememberFocusedProtyle = (target) => {
        try {
            const protyle = target?.closest?.('.protyle');
            if (!protyle || !protyle.isConnected) return;
            const docId = String(
                protyle.querySelector?.('.protyle-title')?.getAttribute?.('data-node-id')
                || protyle.querySelector?.('.protyle-title__input')?.getAttribute?.('data-node-id')
                || protyle.querySelector?.('.protyle-background')?.getAttribute?.('data-node-id')
                || ''
            ).trim();
            if (!docId) return;
            __tmLastFocusedProtyle = protyle;
        } catch (e) {}
    };
    const __tmRememberFocusedProtyleOnPointerDown = (e) => {
        __tmRememberFocusedProtyle(e?.target);
    };
    const __tmRememberFocusedProtyleOnFocusIn = (e) => {
        __tmRememberFocusedProtyle(e?.target);
    };
    try { document.addEventListener('pointerdown', __tmRememberFocusedProtyleOnPointerDown, true); } catch (e) {}
    try { document.addEventListener('focusin', __tmRememberFocusedProtyleOnFocusIn, true); } catch (e) {}

    const __tmFindActiveProtyle = () => {
        try {
            const adapted = globalThis.__tmCompat?.findActiveProtyle?.(__tmLastFocusedProtyle);
            if (adapted) return adapted;
        } catch (e) {}
        const isVisible = (el) => {
            try { return !!el && el.offsetParent !== null; } catch (e) { return false; }
        };
        return (
            (__tmLastFocusedProtyle && isVisible(__tmLastFocusedProtyle) ? __tmLastFocusedProtyle : null) ||
            document.querySelector('.layout__wnd--active .protyle') ||
            Array.from(document.querySelectorAll('.protyle')).find(isVisible) ||
            null
        );
    };

    const __tmEscapeDataNodeIdSelector = (id) => {
        const raw = String(id || '');
        try {
            if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(raw);
        } catch (e) {}
        return raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    };

    const __tmFindNativeOpenHighlightElement = (blockId) => {
        const id = String(blockId || '').trim();
        if (!id) return null;
        const escapedId = __tmEscapeDataNodeIdSelector(id);
        const selectors = [
            `.protyle-wysiwyg [data-node-id="${escapedId}"]`,
            `.protyle-title[data-node-id="${escapedId}"]`,
            `[data-node-id="${escapedId}"]`,
        ];
        const docs = [];
        const pushDoc = (doc) => {
            if (doc && typeof doc.querySelector === 'function' && !docs.includes(doc)) docs.push(doc);
        };
        try { pushDoc(__tmGetNavigationRuntime()?.topDoc); } catch (e) {}
        try { pushDoc(document); } catch (e) {}
        try {
            const active = __tmFindActiveProtyle();
            if (active instanceof HTMLElement) {
                for (const selector of selectors) {
                    const el = active.querySelector(selector);
                    if (el instanceof HTMLElement) return el;
                }
            }
        } catch (e) {}
        for (const doc of docs) {
            for (const selector of selectors) {
                try {
                    const el = doc.querySelector(selector);
                    if (el instanceof HTMLElement) return el;
                } catch (e) {}
            }
        }
        return null;
    };

    const __tmApplyNativeOpenHighlight = (blockId) => {
        const el = __tmFindNativeOpenHighlightElement(blockId);
        if (!(el instanceof HTMLElement)) return false;
        try { el.classList.remove('tm-block-highlight'); } catch (e) {}
        try { void el.offsetWidth; } catch (e) {}
        try { el.classList.add('tm-block-highlight'); } catch (e) {}
        setTimeout(() => {
            try { el.classList.remove('tm-block-highlight'); } catch (e) {}
        }, 1200);
        return true;
    };

    const __tmScheduleNativeOpenHighlight = (blockId, options = {}) => {
        if (options?.highlight === false) return;
        const id = String(blockId || '').trim();
        if (!id) return;
        let attempt = 0;
        const maxAttempts = Math.max(1, Math.min(18, Math.round(Number(options?.highlightAttempts) || 10)));
        const run = () => {
            attempt += 1;
            if (__tmApplyNativeOpenHighlight(id)) return;
            if (attempt < maxAttempts) setTimeout(run, attempt < 3 ? 180 : 320);
        };
        setTimeout(run, Math.max(0, Math.round(Number(options?.highlightDelayMs) || 260)));
    };

    window.tmOpenDocById = async function(docId) {
        const id = String(docId || '').trim();
        if (!id || id === 'all') return false;
        const nav = __tmGetNavigationRuntime();
        const topWin = nav.topWin || window;

        if (await __tmOpenSiyuanBlockNative(id)) return true;

        try {
            topWin.open(`siyuan://blocks/${id}`);
            nav.closeAfterMobileAction?.();
            return true;
        } catch (e) {}
        return false;
    };

    window.tmJumpToTask = async function(id, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        const taskId = String(id || '').trim();
        if (!taskId) return false;
        const jumpTask = state.flatTasks?.[taskId] || null;
        const targetTaskId = __tmResolveRecurringInstanceSourceTaskId(taskId, jumpTask) || taskId;
        if (__tmShouldOpenTaskDetailPageOnAnyTitleClick(event)) {
            try {
                await window.tmOpenTaskDetail?.(targetTaskId, event);
                return true;
            } catch (e) {}
        }
        if (__tmIsMultiSelectActive()) {
            const ownerRow = event?.target instanceof Element
                ? event.target.closest('.tm-checklist-item[data-id], #tmTimelineLeftTable tbody tr[data-id], #tmTaskTable tbody tr[data-id], .tm-kanban-card[data-id], .tm-whiteboard-stream-task-head[data-id], .tm-whiteboard-stream-task-node[data-id]')
                : null;
            const ownerId = String(ownerRow?.getAttribute?.('data-id') || '').trim();
            const targetId = targetTaskId;
            if (targetId && ownerId && ownerId === targetId) {
                __tmToggleTaskMultiSelection(targetId);
                return false;
            }
        }
        const nav = __tmGetNavigationRuntime();
        const topWin = nav.topWin || window;
        const topDoc = nav.topDoc || document;

        if (await __tmOpenSiyuanBlockNative(targetTaskId)) return true;

        try {
            const tempSpan = topDoc.createElement('span');
            tempSpan.setAttribute('data-type', 'block-ref');
            tempSpan.setAttribute('data-id', targetTaskId);
            tempSpan.style.position = 'fixed';
            tempSpan.style.top = '-9999px';
            tempSpan.style.left = '-9999px';
            tempSpan.style.opacity = '0';
            tempSpan.style.pointerEvents = 'none';
            topDoc.body.appendChild(tempSpan);

            const opts = {
                view: topWin,
                bubbles: true,
                cancelable: true,
                buttons: 1
            };
            tempSpan.dispatchEvent(new MouseEvent('mousedown', opts));
            tempSpan.dispatchEvent(new MouseEvent('mouseup', opts));
            tempSpan.dispatchEvent(new MouseEvent('click', opts));

            setTimeout(() => tempSpan.remove(), 100);
            __tmScheduleNativeOpenHighlight(targetTaskId);
            nav.closeAfterMobileAction?.();
            return true;
        } catch (e) {}

        try {
            topWin.open(`siyuan://blocks/${targetTaskId}`);
            __tmScheduleNativeOpenHighlight(targetTaskId);
            nav.closeAfterMobileAction?.();
            return true;
        } catch (e) {}
        return false;
    };

    function __tmInvalidateFilteredTaskDerivedStateCache() {
        try { state.__tmFilteredTaskDerivedStateCache = null; } catch (e) {}
    }

    function __tmBuildFilteredTaskDerivedState(currentGroupId) {
        const filteredTasks = Array.isArray(state.filteredTasks) ? state.filteredTasks : [];
        const filteredIdSet = new Set(filteredTasks.map(t => t.id));
        const baseOrderMap = new Map(filteredTasks.map((t, i) => [t.id, i]));
        const docEntriesInOrder = __tmSortDocEntriesForTabs(
            state.taskTree || [],
            currentGroupId
        );
        const docsInOrder = docEntriesInOrder.map((d) => String(d?.id || '').trim()).filter(Boolean);
        const docEntryById = new Map(
            docEntriesInOrder
                .map((doc) => [String(doc?.id || '').trim(), doc])
                .filter(([id]) => !!id)
        );
        const filteredTasksByDoc = new Map();
        filteredTasks.forEach((task) => {
            const docId = String(task?.root_id || task?.docId || '').trim();
            if (!docId) return;
            let list = filteredTasksByDoc.get(docId);
            if (!Array.isArray(list)) {
                list = [];
                filteredTasksByDoc.set(docId, list);
            }
            list.push(task);
        });
        const rootTasks = filteredTasks.filter(t => {
            if (!t.parentTaskId) return true;
            return !filteredIdSet.has(t.parentTaskId);
        });
        const docRootTasksByDoc = new Map();
        rootTasks.forEach((task) => {
            const docId = String(task?.root_id || task?.docId || '').trim();
            if (!docId) return;
            let list = docRootTasksByDoc.get(docId);
            if (!Array.isArray(list)) {
                list = [];
                docRootTasksByDoc.set(docId, list);
            }
            list.push(task);
        });
        const docRankForUngroup = new Map(docsInOrder.map((id, idx) => [id, idx]));
        return {
            filteredIdSet,
            baseOrderMap,
            docsInOrder,
            docEntryById,
            filteredTasksByDoc,
            rootTasks,
            docRootTasksByDoc,
            docRankForUngroup,
        };
    }

    function __tmGetFilteredTaskDerivedState() {
        const filteredTasksRef = Array.isArray(state.filteredTasks) ? state.filteredTasks : null;
        const taskTreeRef = Array.isArray(state.taskTree) ? state.taskTree : null;
        const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        const docTabSortMode = __tmGetDocTabSortMode();
        const pinnedDocIdsKey = __tmGetDocPinnedIdsForGroup(currentGroupId)
            .map((id) => String(id || '').trim())
            .filter(Boolean)
            .join(',');
        const cache = state.__tmFilteredTaskDerivedStateCache;
        if (cache
            && cache.filteredTasksRef === filteredTasksRef
            && cache.taskTreeRef === taskTreeRef
            && cache.currentGroupId === currentGroupId
            && cache.docTabSortMode === docTabSortMode
            && cache.pinnedDocIdsKey === pinnedDocIdsKey) {
            return cache.value;
        }
        const value = __tmBuildFilteredTaskDerivedState(currentGroupId);
        state.__tmFilteredTaskDerivedStateCache = {
            filteredTasksRef,
            taskTreeRef,
            currentGroupId,
            docTabSortMode,
            pinnedDocIdsKey,
            value,
        };
        return value;
    }

    function __tmBuildTaskRowModel() {
        if (!Array.isArray(state.filteredTasks) || state.filteredTasks.length === 0) return [];

        const isDark = __tmIsDarkMode();
        const timeBaseColor = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.timeGroupBaseColorDark, '#6ba5ff')
            : __tmNormalizeHexColor(SettingsStore.data.timeGroupBaseColorLight, '#1a73e8');
        const timeOverdueColor = isDark
            ? __tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorDark, '#ff6b6b')
            : __tmNormalizeHexColor(SettingsStore.data.timeGroupOverdueColorLight, '#d93025');
        const __tmGetTimeGroupLabelColor = (groupInfo) => {
            const key = String(groupInfo?.key || '');
            const sortValue = Number(groupInfo?.sortValue);
            if (key === 'pending' || !Number.isFinite(sortValue)) return 'var(--tm-secondary-text)';
            if (sortValue < 0) return timeOverdueColor || 'var(--tm-danger-color)';
            const minA = isDark ? 0.52 : 0.42;
            const step = isDark ? 0.085 : 0.11;
            const alpha = __tmClamp(1 - sortValue * step, minA, 1);
            return __tmWithAlpha(timeBaseColor || 'var(--tm-primary-color)', alpha);
        };

        const rows = [];

        const derived = __tmGetFilteredTaskDerivedState();
        const filteredIdSet = derived.filteredIdSet;
        let orderMap = new Map(derived.baseOrderMap);
        const docsInOrder = derived.docsInOrder;
        const docEntryById = derived.docEntryById;
        const filteredTasksByDoc = derived.filteredTasksByDoc;
        if (state.viewMode === 'timeline' && SettingsStore.data.timelineForceSortByCompletionNearToday) {
            const now = new Date();
            const todayTs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0).getTime();
            const docRankMap = new Map();
            docsInOrder.forEach((did, idx) => docRankMap.set(did, idx));

            const h2BucketRank = new Map();
            docsInOrder.forEach((did) => {
                const seen = new Set();
                let rank = 0;
                const pushByTask = (task) => {
                    const bucket = __tmGetDocHeadingBucket(task, '无标题');
                    const key = `${did}::${String(bucket?.key || 'label:__none__')}`;
                    if (seen.has(key)) return;
                    seen.add(key);
                    const rk = Number(task?.h2Rank);
                    if (Number.isFinite(rk)) {
                        h2BucketRank.set(key, rk);
                    } else {
                        h2BucketRank.set(key, rank++);
                    }
                };
                (filteredTasksByDoc.get(did) || [])
                    .slice()
                    .sort(__tmCompareTasksByDocFlow)
                    .forEach(pushByTask);
            });
            const timeInfoMemo = new Map();
            const items = state.filteredTasks.map((t, i) => {
                const docId = String(t?.root_id || t?.docId || '').trim();
                const bucket = __tmGetDocHeadingBucket(t, '无标题');
                const h2Key = `${docId}::${String(bucket?.key || 'label:__none__')}`;
                const preferChildTime = !!(SettingsStore.data.groupSortByBestSubtaskTimeInTimeQuadrant && (state.groupByTime || state.quadrantEnabled));
                const info = preferChildTime
                    ? __tmGetTaskTimePriorityInfo(t, { memo: timeInfoMemo })
                    : { ts: __tmParseTimeToTs(t?.completionTime), diffDays: Infinity, hasDate: false };
                const ts = Number(info?.ts || 0);
                // 计算任务日期距离今天的天数（正数表示未来，负数表示过去，0表示今天）
                const daysDiff = ts ? Math.round((ts - todayTs) / (1000 * 60 * 60 * 24)) : Infinity;
                // 排序：今天之前的按倒序（越早过期的越靠前），今天及之后的按正序（越晚完成的越靠后）
                const sortKey = Number.isFinite(daysDiff) ? daysDiff : (daysDiff < 0 ? -Infinity : Infinity);
                const docRank = Number(docRankMap.has(docId) ? docRankMap.get(docId) : 999999);
                const h2Rank = Number(h2BucketRank.get(h2Key) ?? 999999);
                return { id: String(t?.id || ''), docRank, h2Rank, daysDiff, sortKey, ts, i };
            }).filter(x => x.id);
            items.sort((a, b) => (a.docRank - b.docRank) || (a.h2Rank - b.h2Rank) || (a.sortKey - b.sortKey) || (a.ts - b.ts) || (a.i - b.i));
            orderMap = new Map(items.map((x, idx) => [x.id, idx]));
        }
        const getTaskOrder = (taskId) => orderMap.get(taskId) ?? Infinity;
        const timePriorityMemo = new Map();
        const getTimePriorityInfo = (task) => __tmGetTaskTimePriorityInfo(task, { memo: timePriorityMemo });
        const compareByTimePriority = (a, b) => {
            const ai = getTimePriorityInfo(a);
            const bi = getTimePriorityInfo(b);
            const ad = Number(ai?.diffDays);
            const bd = Number(bi?.diffDays);
            const aBucket = Number.isFinite(ad) ? (ad < 0 ? 0 : 1) : 2;
            const bBucket = Number.isFinite(bd) ? (bd < 0 ? 0 : 1) : 2;
            if (aBucket !== bBucket) return aBucket - bBucket;
            const aRank = Number.isFinite(ad) ? ad : Infinity;
            const bRank = Number.isFinite(bd) ? bd : Infinity;
            if (aRank !== bRank) return aRank - bRank;
            const ats = Number(ai?.ts || 0);
            const bts = Number(bi?.ts || 0);
            if (ats !== bts) return ats - bts;
            return getTaskOrder(String(a?.id || '')) - getTaskOrder(String(b?.id || ''));
        };

        const rootTasks = derived.rootTasks;
        const docRootTasksByDoc = derived.docRootTasksByDoc;
        const isUngroupForRowModel = !state.groupByDocName && !state.groupByTaskName && !state.groupByTime && !state.quadrantEnabled;
        const timelineKeepH2Order = (state.viewMode === 'timeline')
            && !!state.groupByDocName
            && (SettingsStore.data.docH2SubgroupEnabled !== false);
        const pinnedRoots = timelineKeepH2Order ? [] : rootTasks.filter(t => t.pinned);
        const normalRoots = timelineKeepH2Order ? rootTasks.slice() : rootTasks.filter(t => !t.pinned);

        const emitTask = (task, depth, hasChildren, collapsed) => {
            rows.push({
                type: 'task',
                id: String(task?.id || ''),
                depth: Math.max(0, Number(depth) || 0),
                hasChildren: !!hasChildren,
                collapsed: !!collapsed,
            });
        };

        const emitChildDropGap = (task, depth) => {
            const taskId = String(task?.id || '').trim();
            if (!taskId) return;
            rows.push({
                type: 'drop-gap',
                id: `drop-gap:${taskId}:child`,
                targetTaskId: taskId,
                depth: Math.max(0, Number(depth) || 0),
                kind: 'child',
            });
        };

        const walkTaskTree = (task, depth, inheritedHideCompleted = false) => {
            const hideCompletedDescendants = __tmResolveHideCompletedDescendantsFlag(task, inheritedHideCompleted);
            const childTasks = (task.children || []).filter((c) => filteredIdSet.has(c.id) && __tmShouldKeepChildTaskVisible(task, c, inheritedHideCompleted));
            childTasks.sort((a, b) => getTaskOrder(a.id) - getTaskOrder(b.id));
            const hasChildren = childTasks.length > 0;
            const collapsed = state.collapsedTaskIds.has(String(task.id));
            const showChildren = hasChildren;
            emitTask(task, depth, showChildren, collapsed);
            if (showChildren && !collapsed) {
                emitChildDropGap(task, depth + 1);
                childTasks.forEach(child => walkTaskTree(child, depth + 1, hideCompletedDescendants));
            }
        };

        if (pinnedRoots.length > 0) {
            const pinnedGroupKey = 'pinned_root_tasks';
            const pinnedCollapsed = state.collapsedGroups?.has(pinnedGroupKey);
            const pinnedDurationSum = __tmCalcGroupDurationText(pinnedRoots);
            rows.push({
                type: 'group',
                kind: 'pinned',
                key: pinnedGroupKey,
                label: '置顶',
                count: pinnedRoots.length,
                durationSum: pinnedDurationSum,
                collapsed: !!pinnedCollapsed,
            });
            if (!pinnedCollapsed) {
                pinnedRoots.forEach(task => walkTaskTree(task, 0));
            }
        }

        if (isUngroupForRowModel && pinnedRoots.length > 0 && normalRoots.length > 0) {
            const normalGroupKey = 'normal_root_tasks';
            const normalCollapsed = state.collapsedGroups?.has(normalGroupKey);
            rows.push({
                type: 'group',
                kind: 'normal',
                key: normalGroupKey,
                label: '普通',
                count: normalRoots.length,
                collapsed: !!normalCollapsed,
            });
            if (!normalCollapsed) {
                normalRoots.forEach(task => walkTaskTree(task, 0));
            }
            return rows;
        }

        if (state.quadrantEnabled && normalRoots.length > 0) {
            const quadrantRules = (SettingsStore.data.quadrantConfig && SettingsStore.data.quadrantConfig.rules) || [];
            const getImportanceLevel = (task) => {
                const priority = String(task.priority || '').toLowerCase();
                if (priority === 'a' || priority === '高' || priority === 'high') return 'high';
                if (priority === 'b' || priority === '中' || priority === 'medium') return 'medium';
                if (priority === 'c' || priority === '低' || priority === 'low') return 'low';
                return 'none';
            };
            const getTimeRange = (task) => {
                const info = getTimePriorityInfo(task);
                const diffDays = Number(info?.diffDays);
                if (!Number.isFinite(diffDays)) return 'nodate';
                if (diffDays < 0) return 'overdue';
                if (diffDays <= 7) return 'within7days';
                if (diffDays <= 15) return 'within15days';
                if (diffDays <= 30) return 'within30days';
                return 'beyond30days';
            };
            const getTaskDays = (task) => {
                const info = getTimePriorityInfo(task);
                const diffDays = Number(info?.diffDays);
                return Number.isFinite(diffDays) ? diffDays : Infinity;
            };

            const quadrantGroups = {};
            quadrantRules.forEach(rule => {
                quadrantGroups[rule.id] = { ...rule, items: [] };
            });
            const quadrantOrder = ['urgent-important', 'not-urgent-important', 'urgent-not-important', 'not-urgent-not-important'];

            normalRoots.forEach(task => {
                const importance = getImportanceLevel(task);
                const timeRange = getTimeRange(task);
                const taskDays = getTaskDays(task);
                let matchedRule = null;
                for (const rule of quadrantRules) {
                    const importanceMatch = rule.importance.includes(importance);
                    let timeRangeMatch = rule.timeRanges.includes(timeRange);
                    if (!timeRangeMatch) {
                        for (const range of rule.timeRanges) {
                            if (range.startsWith('beyond') && range !== 'beyond30days') {
                                const days = parseInt(range.replace('beyond', '').replace('days', ''));
                                if (!isNaN(days) && taskDays > days) { timeRangeMatch = true; break; }
                            }
                        }
                    }
                    if (importanceMatch && timeRangeMatch) { matchedRule = rule; break; }
                }
                if (matchedRule && quadrantGroups[matchedRule.id]) {
                    quadrantGroups[matchedRule.id].items.push(task);
                }
            });

            const calculateDuration = (items) => {
                return __tmCalcGroupDurationText(items);
            };

            quadrantOrder.forEach((quadrantId) => {
                const group = quadrantGroups[quadrantId];
                if (!group || !Array.isArray(group.items) || group.items.length === 0) return;
                const groupKey = `quadrant_${quadrantId}`;
                const isCollapsed = state.collapsedGroups?.has(groupKey);
                rows.push({
                    type: 'group',
                    kind: 'quadrant',
                    key: groupKey,
                    label: String(group.name || ''),
                    color: String(group.color || ''),
                    count: group.items.length,
                    durationSum: calculateDuration(group.items),
                    collapsed: !!isCollapsed,
                });
                if (!isCollapsed) {
                    const prefer = !!SettingsStore.data.groupSortByBestSubtaskTimeInTimeQuadrant;
                    if (prefer) group.items.sort(compareByTimePriority);
                    group.items.forEach(task => walkTaskTree(task, 0));
                }
            });
            return rows;
        }

        if (state.groupByDocName) {
            const enableDocH2Subgroup = SettingsStore.data.docH2SubgroupEnabled !== false;
            const headingLevel = String(SettingsStore.data.taskHeadingLevel || 'h2').trim() || 'h2';
            const headingLabelMap = { h1: '一级标题', h2: '二级标题', h3: '三级标题', h4: '四级标题', h5: '五级标题', h6: '六级标题' };
            const noHeadingLabel = `无${headingLabelMap[headingLevel] || '标题'}`;
            docsInOrder.forEach(docId => {
                const docEntry = docEntryById.get(String(docId || '').trim());
                if (!docEntry) return;
                const docTasks = filteredTasksByDoc.get(String(docId || '').trim()) || [];
                if (docTasks.length === 0) return;
                const docRootTasks = docRootTasksByDoc.get(String(docId || '').trim()) || [];
                const docNormal = timelineKeepH2Order ? docRootTasks.slice() : docRootTasks.filter(t => !t.pinned);
                const docName = docEntry.name || '未知文档';
                const groupKey = `doc_${docId}`;
                const isCollapsed = state.collapsedGroups?.has(groupKey);
                const labelColor = __tmGetDocColorHex(docId, isDark) || 'var(--tm-group-doc-label-color)';
                rows.push({
                    type: 'group',
                    kind: 'doc',
                    key: groupKey,
                    docId: String(docId || '').trim(),
                    label: String(docName),
                    count: docTasks.length,
                    labelColor,
                    collapsed: !!isCollapsed,
                });
                if (!isCollapsed) {
                    const useDocH2Subgroup = enableDocH2Subgroup && __tmDocHasAnyHeading(docId, docTasks);
                    if (!useDocH2Subgroup) {
                        docNormal.forEach(task => walkTaskTree(task, 0));
                        return;
                    }
                    const h2Groups = new Map();
                    const h2OrderSource = docTasks;
                    const h2Buckets = __tmBuildDocHeadingBuckets(h2OrderSource, noHeadingLabel);
                    docNormal.forEach(task => {
                        const b = __tmGetDocHeadingBucket(task, noHeadingLabel);
                        if (!h2Groups.has(b.key)) h2Groups.set(b.key, { label: b.label, id: String(b.id || '').trim(), items: [] });
                        h2Groups.get(b.key).items.push(task);
                    });
                    const orderedH2Buckets = h2Buckets
                        .filter((bucket) => (h2Groups.get(bucket.key)?.items || []).length > 0)
                        .concat(Array.from(h2Groups.keys())
                            .filter((k) => !h2Buckets.some((b) => b.key === k))
                            .map((k) => ({ key: k, label: String(h2Groups.get(k)?.label || ''), id: String(h2Groups.get(k)?.id || '').trim() })));
                    orderedH2Buckets.forEach((bucket) => {
                        const g = h2Groups.get(bucket.key) || { label: String(bucket.label || ''), id: String(bucket.id || '').trim(), items: [] };
                        const items = Array.isArray(g.items) ? g.items : [];
                        const h2Key = `doc_${docId}__h2_${encodeURIComponent(String(bucket.key || 'label:__none__'))}`;
                        const h2Collapsed = state.collapsedGroups?.has(h2Key);
                        rows.push({
                            type: 'group',
                            kind: 'h2',
                            key: h2Key,
                            label: String(g.label || ''),
                            docId: String(docId || '').trim(),
                            headingId: String(g.id || bucket.id || '').trim(),
                            labelColor: __tmGetHeadingSubgroupLabelColor(labelColor, isDark),
                            count: Array.isArray(items) ? items.length : 0,
                            collapsed: !!h2Collapsed,
                        });
                        if (!h2Collapsed) {
                            items.forEach(task => walkTaskTree(task, 0));
                        }
                    });
                }
            });
            return rows;
        }

        // 按任务名分组
        if (state.groupByTaskName && normalRoots.length > 0) {
            const tasksByContent = {};
            normalRoots.forEach(task => {
                const content = String(task.content || '').trim();
                if (!content) return;
                if (!tasksByContent[content]) {
                    tasksByContent[content] = [];
                }
                tasksByContent[content].push(task);
            });

            // 按任务名称升序排序
            const sortedGroups = Object.entries(tasksByContent)
                .sort((a, b) => String(a[0] || '').localeCompare(String(b[0] || ''), 'zh-CN'));

            sortedGroups.forEach(([content, tasks]) => {
                if (tasks.length === 0) return;

                const safeContent = String(content || '').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
                const groupKey = `task_${safeContent}`;
                const isCollapsed = state.collapsedGroups?.has(groupKey);
                const labelColor = 'var(--tm-primary-color)';

                // 计算该分组中所有任务的文档颜色
                const docIds = [...new Set(tasks.map(t => t.root_id).filter(Boolean))];
                let groupDocColor = '';
                if (docIds.length === 1) {
                    groupDocColor = __tmGetDocColorHex(docIds[0], isDark) || '';
                }

                rows.push({
                    type: 'group',
                    kind: 'task',
                    key: groupKey,
                    label: String(content),
                    count: tasks.length,
                    labelColor,
                    groupDocColor,
                    collapsed: !!isCollapsed,
                });

                if (!isCollapsed) {
                    tasks.forEach(task => walkTaskTree(task, 0));
                }
            });
            return rows;
        }

        if (state.groupByTime && normalRoots.length > 0) {
            const getTimeGroup = (task) => {
                const info = getTimePriorityInfo(task);
                const diffDays = Number(info?.diffDays);
                if (!Number.isFinite(diffDays)) return { key: 'pending', label: '待定', sortValue: Infinity };
                if (diffDays < 0) return { key: 'overdue', label: '已过期', sortValue: diffDays };
                if (diffDays === 0) return { key: 'today', label: '今天', sortValue: 0 };
                if (diffDays === 1) return { key: 'tomorrow', label: '明天', sortValue: 1 };
                if (diffDays === 2) return { key: 'after_tomorrow', label: '后天', sortValue: 2 };
                return { key: `days_${diffDays}`, label: `余${diffDays}天`, sortValue: diffDays };
            };

            const timeGroups = new Map();
            normalRoots.forEach(task => {
                const groupInfo = getTimeGroup(task);
                if (!timeGroups.has(groupInfo.key)) timeGroups.set(groupInfo.key, { ...groupInfo, items: [] });
                timeGroups.get(groupInfo.key).items.push(task);
            });

            const sortedGroups = [...timeGroups.values()].sort((a, b) => a.sortValue - b.sortValue);
            const calculateGroupDuration = (items) => {
                return __tmCalcGroupDurationText(items);
            };

            sortedGroups.forEach(group => {
                const isCollapsed = state.collapsedGroups?.has(group.key);
                rows.push({
                    type: 'group',
                    kind: 'time',
                    key: String(group.key),
                    label: String(group.label || ''),
                    count: Array.isArray(group.items) ? group.items.length : 0,
                    labelColor: __tmGetTimeGroupLabelColor(group),
                    durationSum: calculateGroupDuration(group.items || []),
                    collapsed: !!isCollapsed,
                });
                if (!isCollapsed) {
                    const prefer = !!SettingsStore.data.groupSortByBestSubtaskTimeInTimeQuadrant;
                    if (prefer) group.items.sort(compareByTimePriority);
                    group.items.forEach(task => walkTaskTree(task, 0));
                }
            });
            return rows;
        }

        normalRoots.forEach(task => walkTaskTree(task, 0));
        return rows;
    }

    function __tmResolveFirstVisibleTaskIdFromRowModel(rowModel) {
        const rows = Array.isArray(rowModel) ? rowModel : [];
        const firstTask = rows.find((row) => row?.type === 'task' && String(row?.id || '').trim());
        return String(firstTask?.id || '').trim();
    }

    function __tmNormalizeTaskDetailCompletedSubtasksVisibilityMap(raw) {
        const source = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
        const out = {};
        Object.keys(source).forEach((key) => {
            const tid = String(key || '').trim();
            if (!tid) return;
            out[tid] = source[key] !== false;
        });
        return out;
    }

    function __tmGetTaskDetailCompletedSubtasksVisibilityMap() {
        return __tmNormalizeTaskDetailCompletedSubtasksVisibilityMap(SettingsStore?.data?.taskDetailCompletedSubtasksVisibilityByTask);
    }

    function __tmShouldShowCompletedSubtasksForTask(taskId) {
        const tid = String(taskId || '').trim();
        if (!tid) return true;
        const map = __tmGetTaskDetailCompletedSubtasksVisibilityMap();
        return map[tid] !== false;
    }

    function __tmSetCompletedSubtasksVisibilityForTask(taskId, enabled) {
        const tid = String(taskId || '').trim();
        if (!tid) return true;
        const map = { ...__tmGetTaskDetailCompletedSubtasksVisibilityMap() };
        if (enabled === false) {
            map[tid] = false;
        } else {
            delete map[tid];
        }
        if (SettingsStore?.data) SettingsStore.data.taskDetailCompletedSubtasksVisibilityByTask = map;
        return enabled !== false;
    }

    function __tmResolveHideCompletedDescendantsFlag(taskOrId, inheritedHideCompleted = false) {
        if (inheritedHideCompleted) return true;
        const tid = typeof taskOrId === 'string'
            ? String(taskOrId || '').trim()
            : String(taskOrId?.id || '').trim();
        if (!tid) return false;
        return !__tmShouldShowCompletedSubtasksForTask(tid);
    }

    function __tmShouldKeepChildTaskVisible(parentTask, childTask, inheritedHideCompleted = false) {
        if (!childTask || typeof childTask !== 'object') return false;
        const hideCompleted = __tmResolveHideCompletedDescendantsFlag(parentTask, inheritedHideCompleted);
        if (hideCompleted && !!childTask.done) return false;
        return true;
    }

    function __tmBuildTaskDetailSubtaskTree(items, showCompletedSubtasks = true, visited = null) {
        const list = Array.isArray(items) ? items : [];
        const seen = visited instanceof Set ? visited : new Set();
        return list.reduce((acc, item) => {
            if (!item || typeof item !== 'object') return acc;
            const tid = String(item?.id || '').trim();
            if (tid) {
                if (seen.has(tid)) return acc;
                seen.add(tid);
            }
            const liveTask = tid ? state.flatTasks?.[tid] : null;
            const baseTask = (liveTask && typeof liveTask === 'object')
                ? { ...item, ...liveTask }
                : { ...item };
            const sourceChildren = Array.isArray(item?.children)
                ? item.children
                : (Array.isArray(liveTask?.children) ? liveTask.children : []);
            if (!showCompletedSubtasks && !!baseTask?.done) return acc;
            const nextChildren = __tmBuildTaskDetailSubtaskTree(sourceChildren, showCompletedSubtasks, seen);
            baseTask.children = nextChildren;
            acc.push(baseTask);
            return acc;
        }, []);
    }

    function __tmGetTaskDetailStatusOptions() {
        const statusOptionsRaw = Array.isArray(SettingsStore.data.customStatusOptions) ? SettingsStore.data.customStatusOptions : [];
        const statusOptions = __tmGetStatusOptions(statusOptionsRaw)
            .map((o) => ({
                id: String(o?.id || '').trim(),
                name: String(o?.name || o?.id || '').trim(),
                color: String(o?.color || '#757575').trim() || '#757575',
            }))
            .filter((o) => o.id);
        if (!statusOptions.some((o) => o.id === 'todo')) statusOptions.unshift({ id: 'todo', name: '待办', color: '#757575' });
        return statusOptions;
    }

    function __tmBuildTaskDetailCoreChipFace(kind, rawValue) {
        const value = String(rawValue || '').trim();
        if (kind === 'reminder') {
            const icon = __tmRenderLucideIcon('alarm-clock', 'tm-task-detail-core-chip__icon');
            return value ? `${icon}<span class="tm-task-detail-core-chip__text">${esc(value)}</span>` : icon;
        }
        if (kind === 'repeat') {
            const icon = __tmRenderLucideIcon('repeat', 'tm-task-detail-core-chip__icon');
            return value ? `${icon}<span class="tm-task-detail-core-chip__text">${esc(value)}</span>` : icon;
        }
        if (kind === 'pinned') {
            return __tmRenderLucideIcon('pin', 'tm-task-detail-core-chip__icon');
        }
        if (kind === 'spent') {
            const icon = __tmRenderLucideIcon('clock-countdown', 'tm-task-detail-core-chip__icon');
            return value ? `${icon}<span class="tm-task-detail-core-chip__text">${esc(value)}</span>` : icon;
        }
        if (kind === 'duration') {
            const icon = __tmRenderLucideIcon('timer', 'tm-task-detail-core-chip__icon');
            return value ? `${icon}<span class="tm-task-detail-core-chip__text">${esc(value)}</span>` : icon;
        }
        if (kind === 'completionTime') {
            const icon = __tmRenderLucideIcon('calendar-check', 'tm-task-detail-core-chip__icon');
            const text = __tmFormatTaskTimeCompact(value);
            return text ? `${icon}<span class="tm-task-detail-core-chip__text">${esc(text)}</span>` : icon;
        }
        const icon = __tmRenderLucideIcon('calendar-plus-2', 'tm-task-detail-core-chip__icon');
        const text = __tmFormatTaskTimeCompact(value);
        return text ? `${icon}<span class="tm-task-detail-core-chip__text">${esc(text)}</span>` : icon;
    }

    function __tmBuildTaskDetailSubtasksHtml(task) {
        const allChildren = Array.isArray(task?.children)
            ? task.children.slice()
            : [];
        if (!allChildren.length) {
            return '';
        }
        const showCompletedSubtasks = __tmShouldShowCompletedSubtasksForTask(task?.id);
        const children = __tmBuildTaskDetailSubtaskTree(allChildren, showCompletedSubtasks);
        if (!children.length) {
            return `<div class="tm-task-detail-empty tm-checklist-empty-detail">已隐藏当前父任务下已完成的子任务</div>`;
        }
        const renderNode = (item, depth = 0) => {
            const tid = String(item?.id || '').trim();
            if (!tid) return '';
            const viewTask = item;
            const canonicalPriority = viewTask?.priority ?? viewTask?.custom_priority ?? viewTask?.customPriority ?? '';
            const readOnly = __tmIsCollectedOtherBlockTask(viewTask);
            const kids = Array.isArray(viewTask?.children)
                ? viewTask.children.slice()
                : [];
            const totalKids = kids.length;
            const doneKids = kids.filter((child) => child?.done).length;
            const childStatsHtml = totalKids > 0
                ? `<span class="tm-task-detail-subtask-count">${doneKids}/${totalKids}</span>`
                : '';
            const childrenHtml = kids.map((child) => renderNode(child, depth + 1)).join('');
            return `
                <div class="tm-task-detail-subtask" style="--tm-task-detail-depth:${depth};">
                    <div class="tm-task-detail-subtask-row" data-tm-detail-subtask-menu="${esc(tid)}">
                        <div class="tm-task-detail-subtask-main">
                            ${__tmRenderTaskCheckbox(tid, viewTask, { checked: viewTask?.done, extraClass: GlobalLock.isLocked() ? 'tm-operating' : '', stopMouseDown: true, stopClick: true, priority: canonicalPriority })}
                            <textarea class="tm-task-detail-subtask-title${viewTask?.done ? ' is-done' : ''}" data-tm-detail-subtask-content="${esc(tid)}" rows="1" ${readOnly ? 'readonly' : ''} title="${readOnly ? '其他块内容请回原文档编辑' : '直接编辑子任务内容'}">${esc(String(viewTask?.content || '').trim() || '')}</textarea>
                        </div>
                        <div class="tm-task-detail-subtask-trailing">
                            ${childStatsHtml}
                            <div class="tm-task-detail-subtask-actions">
                                <button type="button" class="bc-btn bc-btn--sm tm-task-detail-subtask-action" data-tm-detail-open-child="${esc(tid)}"${__tmBuildTooltipAttrs('打开子任务详情', { side: 'bottom' })}>${__tmRenderLucideIcon('chevron-right')}</button>
                            </div>
                        </div>
                    </div>
                    ${childrenHtml ? `<div class="tm-task-detail-subtask-children">${childrenHtml}</div>` : ''}
                </div>
            `;
        };
        return children.map((child) => renderNode(child, 0)).join('');
    }

    function __tmOpenTaskAttachmentPicker(options = {}) {
        return new Promise((resolve) => {
            const opts = (options && typeof options === 'object') ? options : {};
            const existing = document.querySelector('.tm-task-attachment-picker-modal');
            if (existing instanceof HTMLElement) existing.remove();
            const modal = document.createElement('div');
            modal.className = 'tm-prompt-modal tm-task-attachment-picker-modal';
            modal.innerHTML = `
                <div class="tm-prompt-box tm-task-attachment-picker-box">
                    <div class="tm-prompt-title">添加附件</div>
                    <label class="tm-task-attachment-picker-switch">
                        <span class="tm-task-attachment-picker-switch__text">搜索思源文档</span>
                        <input class="b3-switch" type="checkbox" data-tm-attachment-picker-doc-toggle>
                    </label>
                    <div class="tm-task-attachment-picker-toolbar">
                        <input class="tm-prompt-input tm-task-attachment-picker-input" type="text" placeholder="搜索附件名，拖拽/上传文件，或粘贴 assets/… / 块链接">
                        <button type="button" class="tm-prompt-btn tm-prompt-btn-secondary" data-tm-attachment-picker-upload>上传本地</button>
                        <input class="tm-task-attachment-picker-file-input" type="file" multiple data-tm-attachment-picker-file>
                    </div>
                    <div class="tm-task-attachment-picker-helper" data-tm-attachment-picker-helper>支持搜索思源附件，也支持拖拽/上传本地文件、Ctrl+V 粘贴图片、assets 路径、Markdown 附件链接或文档/块链接。</div>
                    <div class="tm-task-attachment-picker-list" data-tm-attachment-picker-list></div>
                    <div class="tm-prompt-buttons">
                        <button type="button" class="tm-prompt-btn tm-prompt-btn-secondary" data-tm-attachment-picker-cancel>取消</button>
                        <button type="button" class="tm-prompt-btn tm-prompt-btn-primary" data-tm-attachment-picker-add disabled>添加选中</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            __tmApplyPopupOpenAnimation(modal, modal.querySelector('.tm-task-attachment-picker-box'));

            const input = modal.querySelector('.tm-task-attachment-picker-input');
            const helper = modal.querySelector('[data-tm-attachment-picker-helper]');
            const list = modal.querySelector('[data-tm-attachment-picker-list]');
            const pickerBox = modal.querySelector('.tm-task-attachment-picker-box');
            const docToggle = modal.querySelector('[data-tm-attachment-picker-doc-toggle]');
            const uploadBtn = modal.querySelector('[data-tm-attachment-picker-upload]');
            const uploadInput = modal.querySelector('[data-tm-attachment-picker-file]');
            const cancelBtn = modal.querySelector('[data-tm-attachment-picker-cancel]');
            const addBtn = modal.querySelector('[data-tm-attachment-picker-add]');
            const existingSet = new Set(__tmNormalizeTaskAttachmentPaths(opts.existingPaths || []));
            const selectedPaths = new Set();
            let results = [];
            let searchTimer = 0;
            let searchSeq = 0;
            let pickerDragDepth = 0;
            let dragRestoreHelperText = '';
            const getSearchMode = () => ((docToggle instanceof HTMLInputElement) && docToggle.checked ? 'doc' : 'asset');
            const getModeEmptyText = () => (
                getSearchMode() === 'doc'
                    ? '输入文档名开始搜索，或粘贴块链接'
                    : '输入文件名开始搜索，或拖拽/粘贴图片、附件链接'
            );
            const getModeZeroText = () => (getSearchMode() === 'doc' ? '没有找到匹配文档' : '没有找到匹配附件');
            const getModeSearchText = () => (getSearchMode() === 'doc' ? '文档搜索中...' : '搜索中...');
            const getDefaultHelperText = () => (
                getSearchMode() === 'doc'
                    ? '已切换到文档搜索，可直接搜索思源文档并作为附件添加，也支持粘贴块链接。'
                    : '支持搜索思源附件，也支持拖拽/上传本地文件、Ctrl+V 粘贴图片、assets 路径、Markdown 附件链接或文档/块链接。'
            );
            const getInputPlaceholder = () => (
                getSearchMode() === 'doc'
                    ? '搜索文档名，或粘贴块链接'
                    : '搜索附件名，拖拽/上传文件，或粘贴 assets/… / 块链接'
            );
            const getInputText = () => String(input instanceof HTMLInputElement ? input.value : '').trim();
            const setHelperText = (text) => {
                if (helper instanceof HTMLElement) helper.textContent = String(text || '').trim() || getDefaultHelperText();
            };
            const setPickerDragActive = (active, fileCount = 0) => {
                if (pickerBox instanceof HTMLElement) pickerBox.classList.toggle('tm-task-attachment-picker-box--dragover', !!active);
                if (!active) {
                    setHelperText(dragRestoreHelperText || getDefaultHelperText());
                    return;
                }
                setHelperText(fileCount > 1 ? `松手后上传 ${fileCount} 个文件到思源附件` : '松手后上传文件到思源附件');
            };
            const removeFromStack = __tmModalStackBind(() => {
                try { cancelBtn?.click?.(); } catch (e) {}
            });

            const close = (value = null) => {
                try {
                    if (searchTimer) clearTimeout(searchTimer);
                } catch (e) {}
                removeFromStack();
                try { modal.remove(); } catch (e) {}
                resolve(value);
            };

            const setUploadButtonBusy = (busy, label = '') => {
                if (!(uploadBtn instanceof HTMLButtonElement)) return;
                uploadBtn.disabled = !!busy;
                uploadBtn.textContent = busy ? (label || '上传中...') : '上传本地';
            };

            const syncAddButton = () => {
                if (!(addBtn instanceof HTMLButtonElement)) return;
                const count = selectedPaths.size;
                addBtn.disabled = count === 0;
                addBtn.textContent = count > 0 ? `添加 ${count} 个` : '添加选中';
            };

            const finalizeResolvedAttachments = (items, options = {}) => {
                const nextItems = __tmNormalizeTaskAttachmentPaths(items).filter((item) => !existingSet.has(item));
                if (nextItems.length) {
                    close(nextItems);
                    return true;
                }
                if (options.hintOnDuplicate === true && Array.isArray(items) && items.length) {
                    try { hint('⚠ 剪贴板里的内容已经在当前任务附件中', 'warning'); } catch (e) {}
                }
                return false;
            };

            const importTextAttachments = async (rawText, options = {}) => {
                const resolvedItems = await __tmResolveTaskAttachmentTextItems(rawText);
                if (resolvedItems.length) return finalizeResolvedAttachments(resolvedItems, {
                    hintOnDuplicate: options.hintOnDuplicate === true,
                });
                if (options.hintOnMiss === true) {
                    try { hint('⚠ 未识别到附件路径或块链接，可粘贴 assets/...、Markdown 附件链接或 siyuan://blocks/...', 'warning'); } catch (e) {}
                }
                return false;
            };

            const uploadPickedFiles = async (files, busyText = '上传中...') => {
                const list = __tmGetTaskAttachmentFiles(files);
                if (!list.length) return false;
                try {
                    setUploadButtonBusy(true, busyText);
                    const paths = await __tmUploadTaskAttachmentFiles(list, { assetsDirPath: '/assets/' });
                    return finalizeResolvedAttachments(paths);
                } catch (e) {
                    try { hint(`❌ 上传失败: ${String(e?.message || e || '')}`, 'error'); } catch (e2) {}
                    return false;
                } finally {
                    setUploadButtonBusy(false);
                }
            };

            const handlePasteImport = async (ev) => {
                const clipboardData = ev?.clipboardData || null;
                if (!clipboardData) return false;
                const clipboardFiles = __tmBuildTaskAttachmentClipboardFiles(clipboardData);
                if (clipboardFiles.length) {
                    try { ev.preventDefault(); } catch (e) {}
                    const imageOnly = clipboardFiles.every((file) => String(file?.type || '').toLowerCase().startsWith('image/'));
                    return await uploadPickedFiles(clipboardFiles, imageOnly ? '导入图片...' : '导入文件...');
                }
                const text = String(clipboardData.getData?.('text/plain') || '').trim();
                const directAssets = __tmParseTaskAttachmentAssetPathsFromText(text);
                const directBlocks = __tmParseTaskAttachmentBlockIdsFromText(text);
                if (!directAssets.length && !directBlocks.length) return false;
                try { ev.preventDefault(); } catch (e) {}
                return await importTextAttachments(text, { hintOnDuplicate: true, hintOnMiss: false });
            };

            const renderList = (emptyText = '') => {
                if (!(list instanceof HTMLElement)) return;
                if (!results.length) {
                    list.innerHTML = `<div class="tm-task-attachment-picker-empty">${esc(emptyText || '未找到匹配附件')}</div>`;
                    return;
                }
                list.innerHTML = results.map((item) => {
                    const disabled = existingSet.has(item.path);
                    const selected = selectedPaths.has(item.path);
                    return `
                        <button type="button"
                            class="tm-task-attachment-picker-item ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}"
                            data-tm-attachment-picker-path="${esc(item.path)}"
                            ${disabled ? 'disabled' : ''}>
                            ${__tmBuildTaskAttachmentThumbHtml(item)}
                            <span class="tm-task-attachment-picker-item__body">
                                <span class="tm-task-attachment-picker-item__name">${esc(item.name || item.path)}</span>
                                <span class="tm-task-attachment-picker-item__path">${esc(item.displayPath || item.path)}</span>
                            </span>
                            <span class="tm-task-attachment-picker-item__state">${disabled ? '已添加' : (selected ? '已选择' : '')}</span>
                        </button>
                    `;
                }).join('');
            };

            const runSearch = async () => {
                const query = getInputText();
                const currentSeq = ++searchSeq;
                if (!query) {
                    results = [];
                    setHelperText(getDefaultHelperText());
                    renderList(getModeEmptyText());
                    syncAddButton();
                    return;
                }
                const directAssetPaths = __tmParseTaskAttachmentAssetPathsFromText(query);
                const directBlockIds = __tmParseTaskAttachmentBlockIdsFromText(query);
                if (directAssetPaths.length || directBlockIds.length) {
                    results = [];
                    setHelperText('检测到可直接导入的附件路径或块链接，按回车即可添加。');
                    renderList('检测到可直接导入的内容，按回车添加');
                    syncAddButton();
                    return;
                }
                setHelperText(getModeSearchText());
                renderList(getModeSearchText());
                try {
                    const found = getSearchMode() === 'doc'
                        ? await API.searchDocs(query, { limit: 60 })
                        : await API.searchAssets(query, { limit: 60 });
                    if (currentSeq !== searchSeq) return;
                    results = found.map((item) => ({
                        ...item,
                        ...(__tmBuildTaskAttachmentEntries([item.path])[0] || {}),
                    }));
                    setHelperText(results.length ? `找到 ${results.length} 个${getSearchMode() === 'doc' ? '文档' : '附件'}` : getModeZeroText());
                    renderList(results.length ? '' : getModeZeroText());
                } catch (e) {
                    if (currentSeq !== searchSeq) return;
                    results = [];
                    const message = `${getSearchMode() === 'doc' ? '文档' : '附件'}搜索失败：${String(e?.message || e || '')}`;
                    setHelperText(message);
                    renderList(message);
                }
                syncAddButton();
            };

            if (input instanceof HTMLInputElement) {
                input.oninput = () => {
                    try {
                        if (searchTimer) clearTimeout(searchTimer);
                    } catch (e) {}
                    searchTimer = setTimeout(() => {
                        searchTimer = 0;
                        runSearch().catch(() => null);
                    }, 220);
                };
                input.onkeydown = async (ev) => {
                    if (ev.key === 'Escape') {
                        try { ev.preventDefault(); } catch (e) {}
                        close(null);
                    }
                    if (ev.key === 'Enter' && selectedPaths.size > 0) {
                        try { ev.preventDefault(); } catch (e) {}
                        close(Array.from(selectedPaths));
                        return;
                    }
                    if (ev.key === 'Enter') {
                        const query = getInputText();
                        if (!query) return;
                        const directAssetPaths = __tmParseTaskAttachmentAssetPathsFromText(query);
                        const directBlockIds = __tmParseTaskAttachmentBlockIdsFromText(query);
                        if (!directAssetPaths.length && !directBlockIds.length) return;
                        try { ev.preventDefault(); } catch (e) {}
                        await importTextAttachments(query, { hintOnDuplicate: true, hintOnMiss: false });
                    }
                };
                try { input.focus(); } catch (e) {}
            }

            modal.onpaste = (ev) => {
                void handlePasteImport(ev);
            };
            modal.ondragenter = (ev) => {
                if (!__tmTaskAttachmentDataTransferHasFiles(ev?.dataTransfer)) return;
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                if (pickerDragDepth === 0) dragRestoreHelperText = String(helper?.textContent || getDefaultHelperText()).trim() || getDefaultHelperText();
                pickerDragDepth += 1;
                setPickerDragActive(true, __tmGetTaskAttachmentFiles(ev?.dataTransfer).length);
            };
            modal.ondragover = (ev) => {
                if (!__tmTaskAttachmentDataTransferHasFiles(ev?.dataTransfer)) return;
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                try { if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy'; } catch (e) {}
                setPickerDragActive(true, __tmGetTaskAttachmentFiles(ev?.dataTransfer).length);
            };
            modal.ondragleave = (ev) => {
                if (!__tmTaskAttachmentDataTransferHasFiles(ev?.dataTransfer)) return;
                try { ev.preventDefault(); } catch (e) {}
                pickerDragDepth = Math.max(0, pickerDragDepth - 1);
                if (!pickerDragDepth) setPickerDragActive(false);
            };
            modal.ondragend = () => {
                pickerDragDepth = 0;
                setPickerDragActive(false);
            };
            modal.ondrop = (ev) => {
                if (!__tmTaskAttachmentDataTransferHasFiles(ev?.dataTransfer)) return;
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                pickerDragDepth = 0;
                setPickerDragActive(false);
                void uploadPickedFiles(ev?.dataTransfer, '上传中...');
            };

            if (list instanceof HTMLElement) {
                list.onclick = (ev) => {
                    const button = ev.target instanceof Element ? ev.target.closest('[data-tm-attachment-picker-path]') : null;
                    if (!(button instanceof HTMLButtonElement)) return;
                    const path = String(button.getAttribute('data-tm-attachment-picker-path') || '').trim();
                    if (!path || existingSet.has(path)) return;
                    if (selectedPaths.has(path)) selectedPaths.delete(path);
                    else selectedPaths.add(path);
                    renderList(getModeZeroText());
                    syncAddButton();
                };
            }

            if (uploadBtn instanceof HTMLButtonElement && uploadInput instanceof HTMLInputElement) {
                uploadBtn.onclick = async () => {
                    try { uploadInput.click(); } catch (e) {}
                };
                uploadInput.onchange = async () => {
                    const files = Array.from(uploadInput.files || []);
                    if (!files.length) return;
                    try {
                        await uploadPickedFiles(files, '上传中...');
                    } finally {
                        try { uploadInput.value = ''; } catch (e) {}
                    }
                };
            }

            if (docToggle instanceof HTMLInputElement) {
                docToggle.onchange = () => {
                    selectedPaths.clear();
                    results = [];
                    dragRestoreHelperText = '';
                    if (input instanceof HTMLInputElement) input.placeholder = getInputPlaceholder();
                    if (getInputText()) {
                        void runSearch();
                    } else {
                        setHelperText(getDefaultHelperText());
                        renderList(getModeEmptyText());
                    }
                    syncAddButton();
                };
            }

            if (cancelBtn instanceof HTMLButtonElement) cancelBtn.onclick = () => close(null);
            if (addBtn instanceof HTMLButtonElement) addBtn.onclick = () => close(Array.from(selectedPaths));
            modal.onclick = (ev) => {
                if (ev.target === modal) close(null);
            };

            if (input instanceof HTMLInputElement) input.placeholder = getInputPlaceholder();
            setHelperText(getDefaultHelperText());
            renderList(getModeEmptyText());
            syncAddButton();
        });
    }

    function __tmBuildTaskDetailAttachmentSectionHtml(task, detailTip, options = {}) {
        const tip = typeof detailTip === 'function'
            ? detailTip
            : (label, tipOpts = {}) => __tmBuildTooltipAttrs(label, {
                side: 'bottom',
                ...((tipOpts && typeof tipOpts === 'object') ? tipOpts : {}),
            });
        const entries = __tmBuildTaskAttachmentEntries(__tmGetTaskAttachmentPaths(task));
        __tmHydrateTaskAttachmentBlockMetaForTask(task, entries);
        const opts = (options && typeof options === 'object') ? options : {};
        const collapseLimit = Math.max(1, Number(__TM_TASK_ATTACHMENT_DETAIL_COLLAPSE_COUNT) || 6);
        const canCollapse = entries.length > collapseLimit;
        const expanded = canCollapse ? opts.expanded === true : true;
        const hiddenCount = Math.max(0, entries.length - collapseLimit);
        const cardsHtml = entries.length
            ? entries.map((entry, index) => `
                <article class="tm-task-attachment-card" ${index >= collapseLimit ? 'data-tm-attachment-extra="true"' : ''}>
                    <button type="button" class="tm-task-attachment-card__preview" data-tm-detail-attachment-open="${esc(entry.path)}"${tip('打开附件', { ariaLabel: false })}>
                        ${__tmBuildTaskAttachmentThumbHtml(entry, { size: 'detail' })}
                    </button>
                    <div class="tm-task-attachment-card__body">
                        <button type="button" class="tm-task-attachment-card__name" data-tm-detail-attachment-open="${esc(entry.path)}"${tip(entry.name || entry.displayPath || entry.path, { ariaLabel: false })}>${esc(entry.name || entry.path)}</button>
                        <div class="tm-task-attachment-card__path">${esc(entry.displayPath || entry.path)}</div>
                    </div>
                    <div class="tm-task-attachment-card__actions">
                        <button type="button" class="bc-btn bc-btn--sm tm-task-attachment-card__action" data-tm-detail-attachment-move="-1" data-index="${index}" ${index === 0 ? 'disabled' : ''}${tip('上移', { ariaLabel: false })}>${__tmRenderLucideIcon('arrow-up')}</button>
                        <button type="button" class="bc-btn bc-btn--sm tm-task-attachment-card__action" data-tm-detail-attachment-move="1" data-index="${index}" ${index === entries.length - 1 ? 'disabled' : ''}${tip('下移', { ariaLabel: false })}>${__tmRenderLucideIcon('arrow-down')}</button>
                        <button type="button" class="bc-btn bc-btn--sm tm-task-attachment-card__action" data-tm-detail-attachment-remove data-index="${index}"${tip('移除', { ariaLabel: false })}>${__tmRenderLucideIcon('trash-2')}</button>
                    </div>
                </article>
            `).join('')
            : `<div class="tm-task-attachment-empty">可拖拽至此处添加附件，也可Ctrl+V粘贴。</div>`;
        return `
            <section class="tm-task-detail-section" data-tm-detail-attachment-section data-tm-expanded="${expanded ? 'true' : 'false'}" data-tm-attachment-count="${entries.length}">
                <div class="tm-task-detail-section-head">
                    <div class="tm-task-detail-section-title">附件</div>
                    <div class="tm-task-detail-section-tools">
                        ${entries.length ? `<span class="tm-task-detail-section-count">${entries.length}</span>` : ''}
                        ${canCollapse ? `<button type="button" class="bc-btn bc-btn--sm tm-task-detail-attachment-toggle" data-tm-detail-attachment-toggle>${expanded ? '收起' : `展开 ${hiddenCount} 个`}</button>` : ''}
                        <button type="button" class="bc-btn bc-btn--sm tm-task-detail-attachment-add" data-tm-detail-attachment-add>${__tmRenderLucideIcon('plus')}<span>添加附件</span></button>
                    </div>
                </div>
                <div class="tm-task-detail-attachments-grid" data-tm-detail-attachments-grid>${cardsHtml}</div>
            </section>
        `;
    }

    function __tmGetWhiteboardStickyThemes() {
        return [
            { value: 'yellow', label: '黄色' },
            { value: 'green', label: '绿色' },
            { value: 'red', label: '红色' },
            { value: 'blue', label: '蓝色' },
            { value: 'purple', label: '紫色' },
        ];
    }

    function __tmNormalizeWhiteboardStickyTheme(value) {
        const raw = String(value || '').trim().toLowerCase();
        return __tmGetWhiteboardStickyThemes().some((item) => item.value === raw) ? raw : 'yellow';
    }

    function __tmIsWhiteboardStickyNote(note) {
        return !!(note && typeof note === 'object' && String(note.type || '').trim() === 'sticky');
    }

    function __tmBuildRemarkMarkdownToolbarHtml(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const toolAttr = String(opts.toolAttribute || 'data-tm-detail-remark-tool').trim() || 'data-tm-detail-remark-tool';
        const buttonClass = String(opts.buttonClass || 'bc-btn bc-btn--sm tm-task-detail-remark-toolbar-btn').trim() || 'bc-btn bc-btn--sm tm-task-detail-remark-toolbar-btn';
        const tooltipSide = String(opts.tooltipSide || 'top').trim() || 'top';
        const tools = [
            { action: 'outdent', title: '取消缩进', content: __tmRenderLucideIcon('text-outdent') },
            { action: 'indent', title: '缩进', content: __tmRenderLucideIcon('text-indent') },
            { action: 'bullet', title: '无序列表', content: __tmRenderLucideIcon('list-bullets', '', { size: 16, style: 'width:16px;height:16px;' }) },
            { action: 'ordered', title: '有序列表', content: __tmRenderLucideIcon('list-numbers', '', { size: 16, style: 'width:16px;height:16px;' }) },
            { action: 'bold', label: 'B', title: '粗体' },
            { action: 'italic', content: '<span style="font-style:italic;">I</span>', title: '斜体' },
            { action: 'code', label: 'Code', title: '行内代码' },
            { action: 'link', title: '链接', content: __tmRenderLucideIcon('link-simple', '', { size: 18, style: 'width:18px;height:18px;' }) },
            { action: 'quote', label: '❝', title: '引用' },
        ];
        return tools.map((tool) => `
            <button type="button"
                class="${esc(buttonClass)}"
                ${toolAttr}="${esc(tool.action)}"
                ${__tmBuildTooltipAttrs(tool.title, { side: tooltipSide, ariaLabel: false })}>${tool.content || tool.label || ''}</button>
        `).join('');
    }

    function __tmBuildTaskDetailRemarkToolbarHtml() {
        return __tmBuildRemarkMarkdownToolbarHtml();
    }

    function __tmApplyRemarkMarkdownTool(textarea, action) {
        if (!(textarea instanceof HTMLTextAreaElement)) return false;
        const key = String(action || '').trim();
        if (!key) return false;
        if (key === 'indent') return __tmAdjustRemarkIndent(textarea, false);
        if (key === 'outdent') return __tmAdjustRemarkIndent(textarea, true);
        if (key === 'bold') return __tmWrapRemarkSelection(textarea, '**');
        if (key === 'italic') return __tmWrapRemarkSelection(textarea, '*');
        if (key === 'code') return __tmWrapRemarkSelection(textarea, '`');
        if (key === 'link') return __tmInsertRemarkLinkTemplate(textarea);
        if (key === 'quote') return __tmToggleRemarkLinePrefix(textarea, '> ');
        if (key === 'bullet') return __tmToggleRemarkLinePrefix(textarea, '- ');
        if (key === 'ordered') return __tmToggleRemarkOrderedList(textarea);
        return false;
    }

    function __tmBindRemarkMarkdownToolbar(toolbar, textarea, options = {}) {
        if (!(toolbar instanceof HTMLElement) || !(textarea instanceof HTMLTextAreaElement)) return;
        const opts = (options && typeof options === 'object') ? options : {};
        const toolAttr = String(opts.toolAttribute || 'data-tm-detail-remark-tool').trim() || 'data-tm-detail-remark-tool';
        const bind = typeof opts.on === 'function'
            ? opts.on
            : (target, type, handler, listenerOptions) => {
                try { target.addEventListener(type, handler, listenerOptions); } catch (e) {}
            };
        const runApply = typeof opts.apply === 'function' ? opts.apply : (fn) => fn();
        toolbar.querySelectorAll(`[${toolAttr}]`).forEach((button) => {
            if (!(button instanceof HTMLButtonElement)) return;
            bind(button, 'mousedown', (ev) => {
                try { ev.preventDefault(); } catch (e) {}
                if (typeof opts.onMouseDown === 'function') {
                    try { opts.onMouseDown(ev, button); } catch (e) {}
                }
            });
            bind(button, 'click', (ev) => {
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                const action = String(button.getAttribute(toolAttr) || '').trim();
                if (!action) return;
                if (typeof opts.onBeforeApply === 'function') {
                    try { opts.onBeforeApply(action, ev, button); } catch (e) {}
                }
                const changed = runApply(() => __tmApplyRemarkMarkdownTool(textarea, action), action, ev, button);
                if (typeof opts.onAfterApply === 'function') {
                    try { opts.onAfterApply(action, changed !== false, ev, button); } catch (e) {}
                }
            });
        });
    }

    function __tmBuildTaskDetailRemarkSectionHtml(remarkValue, detailTip) {
        const source = __tmNormalizeRemarkMarkdown(remarkValue);
        const previewHtml = __tmRenderRemarkMarkdown(source);
        return `
            <section class="tm-task-detail-section">
                <div class="tm-task-detail-section-head tm-task-detail-remark-head">
                    <div class="tm-task-detail-remark-head-main">
                        <div class="tm-task-detail-section-title">备注</div>
                        <button type="button" class="bc-btn bc-btn--sm tm-task-detail-remark-toolbar-toggle" data-tm-detail-remark-toolbar-toggle${detailTip('格式工具', { ariaLabel: false })}>A</button>
                    </div>
                    <div class="tm-task-detail-remark-toolbar" data-tm-detail-remark-toolbar>${__tmBuildTaskDetailRemarkToolbarHtml()}</div>
                </div>
                <div class="tm-task-detail-remark-shell" data-tm-detail-remark-shell>
                    <div class="tm-task-detail-remark-preview" data-tm-detail-remark-preview>${previewHtml}</div>
                    <button type="button" class="tm-task-detail-remark-activator" data-tm-detail-remark-activator aria-label="编辑备注"></button>
                    <textarea class="bc-textarea tm-task-detail-remark tm-task-detail-remark-editor" data-tm-detail="remark" rows="1">${esc(source)}</textarea>
                </div>
            </section>
        `;
    }

    function __tmBuildTaskRepeatHistorySectionHtml(task) {
        const history = __tmNormalizeTaskRepeatHistory(task?.repeatHistory || task?.repeat_history || '');
        if (!history.length) return '';
        const itemsHtml = history.map((item, index) => {
            const completedAt = String(item?.completedAt || '').trim();
            const sourceStart = __tmNormalizeDateOnly(item?.sourceStart || '');
            const sourceDue = __tmNormalizeDateOnly(item?.sourceDue || '');
            const nextStart = __tmNormalizeDateOnly(item?.nextStart || '');
            const nextDue = __tmNormalizeDateOnly(item?.nextDue || '');
            const sourceText = sourceStart && sourceDue
                ? `${__tmFormatTaskTimeCompact(sourceStart)} - ${__tmFormatTaskTimeCompact(sourceDue)}`
                : (sourceDue ? `截止 ${__tmFormatTaskTimeCompact(sourceDue)}` : (sourceStart ? `开始 ${__tmFormatTaskTimeCompact(sourceStart)}` : '当前实例'));
            const nextText = nextStart && nextDue
                ? `${__tmFormatTaskTimeCompact(nextStart)} - ${__tmFormatTaskTimeCompact(nextDue)}`
                : (nextDue ? `截止 ${__tmFormatTaskTimeCompact(nextDue)}` : (nextStart ? `开始 ${__tmFormatTaskTimeCompact(nextStart)}` : '未推进'));
            return `
                <div class="tm-task-detail-history-item">
                    <div class="tm-task-detail-history-head">
                        <div class="tm-task-detail-history-main">${esc(completedAt ? `完成于 ${__tmFormatTaskTime(completedAt)}` : '已完成')}</div>
                        <button type="button" class="tm-task-detail-history-delete" data-tm-detail-repeat-history-delete="${esc(completedAt || String(index))}">删除</button>
                    </div>
                    <div class="tm-task-detail-history-sub">本次：${esc(sourceText)}</div>
                    <div class="tm-task-detail-history-sub">已推进到：${esc(nextText)}</div>
                </div>
            `;
        }).join('');
        return `
            <section class="tm-task-detail-section">
                <div class="tm-task-detail-section-head">
                    <div class="tm-task-detail-section-title">循环完成记录</div>
                    <div class="tm-task-detail-section-tools">
                        <span class="tm-task-detail-section-count">${history.length}</span>
                    </div>
                </div>
                <div class="tm-task-detail-history-list">${itemsHtml}</div>
            </section>
        `;
    }

