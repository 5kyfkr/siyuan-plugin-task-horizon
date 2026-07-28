    function __tmScheduleWhiteboardEdgeRedraw() {
        if (state.viewMode !== 'whiteboard') return;
        try {
            const id0 = Number(state.whiteboardEdgeRafId) || 0;
            if (id0) cancelAnimationFrame(id0);
        } catch (e) {}
        try {
            state.whiteboardEdgeRafId = requestAnimationFrame(() => {
                state.whiteboardEdgeRafId = 0;
                __tmNormalizeWhiteboardAllViewFrames();
                __tmRenderWhiteboardEdges();
                __tmScheduleWhiteboardNavigatorUpdate();
                try {
                    requestAnimationFrame(() => {
                        __tmNormalizeWhiteboardAllViewFrames();
                        __tmRenderWhiteboardEdges();
                        __tmScheduleWhiteboardNavigatorUpdate();
                    });
                } catch (e) {}
            });
        } catch (e) {
            __tmNormalizeWhiteboardAllViewFrames();
            __tmRenderWhiteboardEdges();
            __tmScheduleWhiteboardNavigatorUpdate();
        }
    }

    function __tmScheduleWhiteboardViewSave() {
        try { if (__tmWhiteboardViewSaveTimer) clearTimeout(__tmWhiteboardViewSaveTimer); } catch (e) {}
        __tmWhiteboardViewSaveTimer = setTimeout(() => {
            __tmWhiteboardViewSaveTimer = null;
            try { SettingsStore.save(); } catch (e) {}
        }, 180);
    }

    function __tmGetWhiteboardGlobalBodyFromElement(el) {
        const node = el instanceof Element ? el : null;
        const body = node?.closest?.('.tm-whiteboard-doc-body[data-tm-whiteboard-scope="global"]');
        return body instanceof HTMLElement ? body : null;
    }

    function __tmGetWhiteboardGlobalCanvasBody() {
        try {
            const body = state.modal?.querySelector?.('.tm-whiteboard-doc-body[data-tm-whiteboard-scope="global"]');
            return body instanceof HTMLElement ? body : null;
        } catch (e) {
            return null;
        }
    }

    function __tmIsWhiteboardGlobalElement(el) {
        return !!__tmGetWhiteboardGlobalBodyFromElement(el);
    }

    function __tmWhiteboardDebugElementLabel(el) {
        return '';
    }

    function __tmWhiteboardDebugEventInfo(ev) {
        return null;
    }

    function __tmWhiteboardDebugLog(name, detail = {}) {
    }

    function __tmWhiteboardDebugLogThrottled(key, delayMs, name, detail = {}) {
    }

    function __tmGetWhiteboardNoteStorage(noteId = '') {
        const id = String(noteId || '').trim();
        if (typeof __tmIsWhiteboardGlobalCanvasActive === 'function' && __tmIsWhiteboardGlobalCanvasActive()) {
            const groupId = __tmGetWhiteboardGlobalBoardGroupId();
            const board = __tmGetWhiteboardGlobalBoardState(groupId);
            const notes = Array.isArray(board?.notes) ? [...board.notes] : [];
            if (!id || notes.some((n) => String(n?.id || '').trim() === id)) {
                return { scope: 'global', groupId, board, notes };
            }
        }
        return {
            scope: 'doc',
            groupId: '',
            board: null,
            notes: Array.isArray(SettingsStore.data.whiteboardNotes) ? [...SettingsStore.data.whiteboardNotes] : [],
        };
    }

    function __tmSaveWhiteboardNotesToStorage(storage, notes, opts = {}) {
        const st = (storage && typeof storage === 'object') ? storage : {};
        const list = Array.isArray(notes) ? notes : [];
        const o = (opts && typeof opts === 'object') ? opts : {};
        if (String(st.scope || '').trim() === 'global') {
            __tmPatchWhiteboardGlobalBoardState(st.groupId || '', { notes: list }, { keepEmpty: true, persist: o.persist });
            return;
        }
        SettingsStore.data.whiteboardNotes = list;
        try { WhiteboardStore?.syncFromSettings?.(SettingsStore.data, 'whiteboard-notes'); } catch (e) {}
        try { SettingsStore.syncToLocal(); } catch (e) {}
        if (o.persist) {
            try { SettingsStore.save(); } catch (e) {}
        }
    }

    function __tmGetWhiteboardNoteById(noteId) {
        const storage = __tmGetWhiteboardNoteStorage(noteId);
        const id = String(noteId || '').trim();
        const note = storage.notes.find((n) => String(n?.id || '').trim() === id);
        return { storage, note };
    }

    function __tmNormalizeWhiteboardFrameNameLocal(value) {
        if (typeof __tmNormalizeWhiteboardFrameName === 'function') return __tmNormalizeWhiteboardFrameName(value);
        const s = String(value || '').trim();
        return (s || '分组').slice(0, 48);
    }

    function __tmNormalizeWhiteboardFrameBackgroundColorLocal(value) {
        if (typeof __tmNormalizeWhiteboardFrameBackgroundColor === 'function') return __tmNormalizeWhiteboardFrameBackgroundColor(value);
        const s = String(value || '').trim();
        return /^#[0-9a-fA-F]{6}$/.test(s) ? s : '';
    }

    function __tmNormalizeWhiteboardFrameArrayLocal(frames) {
        if (typeof __tmNormalizeWhiteboardFrameArray === 'function') return __tmNormalizeWhiteboardFrameArray(frames);
        return Array.isArray(frames) ? frames : [];
    }

    function __tmGetWhiteboardFrameStorage(frameId = '') {
        const id = String(frameId || '').trim();
        if (typeof __tmIsWhiteboardGlobalCanvasActive === 'function' && __tmIsWhiteboardGlobalCanvasActive()) {
            const groupId = __tmGetWhiteboardGlobalBoardGroupId();
            const board = __tmGetWhiteboardGlobalBoardState(groupId);
            const frames = __tmNormalizeWhiteboardFrameArrayLocal(board?.frames);
            if (!id || frames.some((frame) => String(frame?.id || '').trim() === id)) {
                return { scope: 'global', groupId, board, frames };
            }
        }
        return {
            scope: 'doc',
            groupId: '',
            board: null,
            frames: __tmNormalizeWhiteboardFrameArrayLocal(SettingsStore.data.whiteboardFrames),
        };
    }

    function __tmSaveWhiteboardFrameStorage(storage, frames, opts = {}) {
        const st = (storage && typeof storage === 'object') ? storage : {};
        const o = (opts && typeof opts === 'object') ? opts : {};
        const normalized = __tmNormalizeWhiteboardFrameArrayLocal(frames);
        if (String(st.scope || '').trim() === 'global') {
            __tmPatchWhiteboardGlobalBoardState(st.groupId || '', { frames: normalized }, { keepEmpty: true, persist: o.persist });
            return normalized;
        }
        SettingsStore.data.whiteboardFrames = normalized;
        try { WhiteboardStore?.syncFromSettings?.(SettingsStore.data, 'whiteboard-frames'); } catch (e) {}
        try { SettingsStore.syncToLocal(); } catch (e) {}
        if (o.persist) {
            try { SettingsStore.save(); } catch (e) {}
        }
        return normalized;
    }

    function __tmGetWhiteboardFrameByIdLocal(frameId) {
        const storage = __tmGetWhiteboardFrameStorage(frameId);
        const id = String(frameId || '').trim();
        const frame = storage.frames.find((item) => String(item?.id || '').trim() === id) || null;
        return { storage, frame };
    }

    function __tmGetWhiteboardDocBodyOffset(docBody) {
        const body = docBody instanceof HTMLElement ? docBody : null;
        if (!body || __tmIsWhiteboardGlobalElement(body)) return { x: 0, y: 0 };
        return {
            x: Number(body.dataset?.frameOffsetX) || 0,
            y: Number(body.dataset?.frameOffsetY) || 0,
        };
    }

    function __tmGetWhiteboardFrameDisplayRect(frame, docBody) {
        const offset = __tmGetWhiteboardDocBodyOffset(docBody);
        const x = Number(frame?.x);
        const y = Number(frame?.y);
        const w = Math.max(80, Number(frame?.w) || 80);
        const h = Math.max(60, Number(frame?.h) || 60);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return { x: x + offset.x, y: y + offset.y, w, h };
    }

    function __tmWhiteboardFrameDisplayRectToStored(rect, docBody) {
        const r = (rect && typeof rect === 'object') ? rect : {};
        const offset = __tmGetWhiteboardDocBodyOffset(docBody);
        return {
            x: Math.round((Number(r.x) || 0) - offset.x),
            y: Math.round((Number(r.y) || 0) - offset.y),
            w: Math.max(80, Math.round(Number(r.w) || 80)),
            h: Math.max(60, Math.round(Number(r.h) || 60)),
        };
    }

    function __tmGetWhiteboardElementLocalBounds(el, docBody) {
        if (!(el instanceof Element) || !(docBody instanceof HTMLElement)) return null;
        const zoom = Math.max(0.01, Number(__tmGetWhiteboardView()?.zoom) || 1);
        try {
            const r = el.getBoundingClientRect();
            const dr = docBody.getBoundingClientRect();
            const x = (r.left - dr.left) / zoom;
            const y = (r.top - dr.top) / zoom;
            const w = r.width / zoom;
            const h = r.height / zoom;
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return null;
            return { x, y, w: Math.max(0, w), h: Math.max(0, h) };
        } catch (e) {
            return null;
        }
    }

    function __tmWhiteboardRectContains(outer, inner) {
        if (!outer || !inner) return false;
        const ox = Number(outer.x);
        const oy = Number(outer.y);
        const ow = Number(outer.w);
        const oh = Number(outer.h);
        const ix = Number(inner.x);
        const iy = Number(inner.y);
        const iw = Number(inner.w);
        const ih = Number(inner.h);
        if (![ox, oy, ow, oh, ix, iy, iw, ih].every(Number.isFinite)) return false;
        return ix >= ox && iy >= oy && (ix + iw) <= (ox + ow) && (iy + ih) <= (oy + oh);
    }

    function __tmWhiteboardPointInRect(point, rect) {
        const x = Number(point?.x);
        const y = Number(point?.y);
        const rx = Number(rect?.x);
        const ry = Number(rect?.y);
        const rw = Number(rect?.w);
        const rh = Number(rect?.h);
        if (![x, y, rx, ry, rw, rh].every(Number.isFinite)) return false;
        return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
    }

    function __tmGetWhiteboardTaskFramePoint(cardEl, docBody) {
        if (!(cardEl instanceof HTMLElement) || !(docBody instanceof HTMLElement)) return null;
        if (!cardEl.classList.contains('tm-whiteboard-node--root')) return null;
        const bounds = __tmGetWhiteboardElementLocalBounds(cardEl, docBody);
        if (!bounds) return null;
        const baseW = Math.min(Math.max(1, bounds.w), 320);
        const baseH = Math.min(Math.max(1, bounds.h), 220);
        return { x: bounds.x + baseW / 2, y: bounds.y + baseH / 2 };
    }

    function __tmCollectWhiteboardFrameMembers(frame, docBody) {
        const body = docBody instanceof HTMLElement ? docBody : null;
        const displayRect = __tmGetWhiteboardFrameDisplayRect(frame, body);
        if (!body || !displayRect) return { memberTaskIds: [], memberNoteIds: [], memberStrokeIds: [] };
        const memberTaskIds = [];
        const memberNoteIds = [];
        const memberStrokeIds = [];
        try {
            body.querySelectorAll('.tm-whiteboard-card.tm-whiteboard-node--root[data-task-id]').forEach((el) => {
                if (!(el instanceof HTMLElement)) return;
                const id = String(el.getAttribute('data-task-id') || '').trim();
                if (!id) return;
                const point = __tmGetWhiteboardTaskFramePoint(el, body);
                if (point && __tmWhiteboardPointInRect(point, displayRect)) memberTaskIds.push(id);
            });
        } catch (e) {}
        try {
            body.querySelectorAll('.tm-whiteboard-note[data-note-id]').forEach((el) => {
                if (!(el instanceof HTMLElement)) return;
                const id = String(el.getAttribute('data-note-id') || '').trim();
                if (!id) return;
                const bounds = __tmGetWhiteboardElementLocalBounds(el, body);
                if (bounds && __tmWhiteboardRectContains(displayRect, bounds)) memberNoteIds.push(id);
            });
        } catch (e) {}
        try {
            const drawingStorage = __tmGetWhiteboardDrawingStorage();
            const bodyDocId = String(body.getAttribute('data-doc-id') || '').trim();
            const drawings = Array.isArray(drawingStorage.drawings) ? drawingStorage.drawings : [];
            drawings.forEach((stroke) => {
                const sid = String(stroke?.id || '').trim();
                const did = String(stroke?.docId || '').trim();
                const b = stroke?.bounds;
                if (!sid || !b || typeof b !== 'object') return;
                if (did && bodyDocId && did !== bodyDocId) return;
                const pathEl = body.querySelector(`.tm-whiteboard-drawing-stroke[data-stroke-id="${CSS.escape(sid)}"]`);
                if (!(pathEl instanceof SVGGraphicsElement)) return;
                const bounds = {
                    x: Number(b.x),
                    y: Number(b.y),
                    w: Number(b.w),
                    h: Number(b.h),
                };
                if (__tmWhiteboardRectContains(displayRect, bounds)) memberStrokeIds.push(sid);
            });
        } catch (e) {}
        return {
            memberTaskIds: Array.from(new Set(memberTaskIds)),
            memberNoteIds: Array.from(new Set(memberNoteIds)),
            memberStrokeIds: Array.from(new Set(memberStrokeIds)),
        };
    }

    function __tmApplyWhiteboardFrameOwnership(frames, targetFrameId, members, opts = {}) {
        const targetId = String(targetFrameId || '').trim();
        const m = (members && typeof members === 'object') ? members : {};
        const taskSet = new Set((Array.isArray(m.memberTaskIds) ? m.memberTaskIds : []).map((id) => String(id || '').trim()).filter(Boolean));
        const noteSet = new Set((Array.isArray(m.memberNoteIds) ? m.memberNoteIds : []).map((id) => String(id || '').trim()).filter(Boolean));
        const strokeSet = new Set((Array.isArray(m.memberStrokeIds) ? m.memberStrokeIds : []).map((id) => String(id || '').trim()).filter(Boolean));
        const now = String(Date.now());
        const clearTarget = opts.clearTarget === true;
        return __tmNormalizeWhiteboardFrameArrayLocal(frames).map((frame) => {
            const id = String(frame?.id || '').trim();
            const next = { ...frame };
            const filterIds = (ids, set) => (Array.isArray(ids) ? ids : []).map((item) => String(item || '').trim()).filter((item) => item && !set.has(item));
            if (id === targetId) {
                next.memberTaskIds = clearTarget ? Array.from(taskSet) : Array.from(new Set([...(next.memberTaskIds || []), ...taskSet]));
                next.memberNoteIds = clearTarget ? Array.from(noteSet) : Array.from(new Set([...(next.memberNoteIds || []), ...noteSet]));
                next.memberStrokeIds = clearTarget ? Array.from(strokeSet) : Array.from(new Set([...(next.memberStrokeIds || []), ...strokeSet]));
                next.updatedAt = now;
                return next;
            }
            next.memberTaskIds = filterIds(next.memberTaskIds, taskSet);
            next.memberNoteIds = filterIds(next.memberNoteIds, noteSet);
            next.memberStrokeIds = filterIds(next.memberStrokeIds, strokeSet);
            return next;
        });
    }

    function __tmRemoveWhiteboardFrameMemberIds(members, opts = {}) {
        const m = (members && typeof members === 'object') ? members : {};
        const taskSet = new Set((Array.isArray(m.taskIds) ? m.taskIds : []).map((id) => String(id || '').trim()).filter(Boolean));
        const noteSet = new Set((Array.isArray(m.noteIds) ? m.noteIds : []).map((id) => String(id || '').trim()).filter(Boolean));
        const strokeSet = new Set((Array.isArray(m.strokeIds) ? m.strokeIds : []).map((id) => String(id || '').trim()).filter(Boolean));
        if (!taskSet.size && !noteSet.size && !strokeSet.size) return false;
        const storage = __tmGetWhiteboardFrameStorage();
        let changed = false;
        const filterIds = (ids, set) => {
            const list = (Array.isArray(ids) ? ids : []).map((id) => String(id || '').trim()).filter(Boolean);
            const next = list.filter((id) => !set.has(id));
            if (next.length !== list.length) changed = true;
            return next;
        };
        const frames = __tmNormalizeWhiteboardFrameArrayLocal(storage.frames).map((frame) => ({
            ...frame,
            memberTaskIds: filterIds(frame.memberTaskIds, taskSet),
            memberNoteIds: filterIds(frame.memberNoteIds, noteSet),
            memberStrokeIds: filterIds(frame.memberStrokeIds, strokeSet),
        }));
        if (!changed) return false;
        __tmSaveWhiteboardFrameStorage(storage, frames, { persist: opts?.persist === true });
        return true;
    }

    function __tmFindContainingWhiteboardFrameForElement(kind, id, docBody) {
        const body = docBody instanceof HTMLElement ? docBody : null;
        const key = String(id || '').trim();
        if (!body || !key) return null;
        const storage = __tmGetWhiteboardFrameStorage();
        const bodyDocId = String(body.getAttribute('data-doc-id') || '').trim();
        const candidates = storage.frames.filter((frame) => String(frame?.docId || '').trim() === bodyDocId);
        let matched = null;
        candidates.forEach((frame) => {
            const rect = __tmGetWhiteboardFrameDisplayRect(frame, body);
            if (!rect) return;
            if (kind === 'task') {
                const el = body.querySelector(`.tm-whiteboard-card.tm-whiteboard-node--root[data-task-id="${CSS.escape(key)}"]`);
                const point = __tmGetWhiteboardTaskFramePoint(el, body);
                if (point && __tmWhiteboardPointInRect(point, rect)) matched = frame;
                return;
            }
            if (kind === 'note') {
                const el = body.querySelector(`.tm-whiteboard-note[data-note-id="${CSS.escape(key)}"]`);
                const bounds = __tmGetWhiteboardElementLocalBounds(el, body);
                if (bounds && __tmWhiteboardRectContains(rect, bounds)) matched = frame;
                return;
            }
            if (kind === 'stroke') {
                const drawingStorage = __tmGetWhiteboardDrawingStorage();
                const stroke = (Array.isArray(drawingStorage.drawings) ? drawingStorage.drawings : [])
                    .find((item) => String(item?.id || '').trim() === key);
                const boundsRaw = stroke?.bounds;
                if (!boundsRaw || typeof boundsRaw !== 'object') return;
                const bounds = {
                    x: Number(boundsRaw.x),
                    y: Number(boundsRaw.y),
                    w: Number(boundsRaw.w),
                    h: Number(boundsRaw.h),
                };
                if (bounds && __tmWhiteboardRectContains(rect, bounds)) matched = frame;
            }
        });
        return { storage, frame: matched };
    }

    function __tmRefreshWhiteboardFrameMembershipForElement(kind, id, docBody, opts = {}) {
        const result = __tmFindContainingWhiteboardFrameForElement(kind, id, docBody);
        if (!result) return false;
        const key = String(id || '').trim();
        if (!key) return false;
        const targetId = String(result.frame?.id || '').trim();
        let changed = false;
        const next = __tmNormalizeWhiteboardFrameArrayLocal(result.storage.frames).map((frame) => {
            const isTarget = String(frame?.id || '').trim() === targetId;
            const taskIds = Array.isArray(frame.memberTaskIds) ? frame.memberTaskIds.map((v) => String(v || '').trim()).filter(Boolean) : [];
            const noteIds = Array.isArray(frame.memberNoteIds) ? frame.memberNoteIds.map((v) => String(v || '').trim()).filter(Boolean) : [];
            const updateIds = (ids) => {
                const filtered = ids.filter((value) => value !== key);
                if (isTarget) filtered.push(key);
                const uniq = Array.from(new Set(filtered));
                if (uniq.length !== ids.length || uniq.some((value, index) => value !== ids[index])) changed = true;
                return uniq;
            };
            if (kind === 'task') return { ...frame, memberTaskIds: updateIds(taskIds), updatedAt: isTarget ? String(Date.now()) : frame.updatedAt };
            if (kind === 'note') return { ...frame, memberNoteIds: updateIds(noteIds), updatedAt: isTarget ? String(Date.now()) : frame.updatedAt };
            if (kind === 'stroke') {
                const strokeIds = Array.isArray(frame.memberStrokeIds) ? frame.memberStrokeIds.map((v) => String(v || '').trim()).filter(Boolean) : [];
                return { ...frame, memberStrokeIds: updateIds(strokeIds), updatedAt: isTarget ? String(Date.now()) : frame.updatedAt };
            }
            return frame;
        });
        if (!changed && !targetId) return false;
        __tmSaveWhiteboardFrameStorage(result.storage, next, { persist: opts?.persist === true });
        return true;
    }

    function __tmIsWhiteboardDrawingTool(tool) {
        const t = String(tool || SettingsStore.data.whiteboardTool || '').trim();
        return t === 'pen' || t === 'highlighter' || t === 'eraser';
    }

    function __tmRequireWhiteboardFrameFeature() {
        return typeof window.tmRequireFullFeature !== 'function'
            || window.tmRequireFullFeature('whiteboard-frame', '白板分组框');
    }

    function __tmRequireWhiteboardDrawingFeature() {
        return typeof window.tmRequireFullFeature !== 'function'
            || window.tmRequireFullFeature('whiteboard-drawing', '白板手写工具');
    }

    function __tmIsWhiteboardDrawingEnabled() {
        if (state.viewMode !== 'whiteboard') return false;
        const activeDocId = String(state.activeDocId || '').trim();
        if (activeDocId && activeDocId !== 'all') {
            try {
                const customGroupDocIds = typeof __tmGetActiveDocTabCustomGroupDocIdSet === 'function'
                    ? __tmGetActiveDocTabCustomGroupDocIdSet(activeDocId, {
                        currentGroupId: String(SettingsStore.data.currentGroupId || 'all').trim() || 'all',
                        docs: state.taskTree || [],
                    })
                    : null;
                if (customGroupDocIds instanceof Set && customGroupDocIds.size > 0) return false;
            } catch (e) {}
            return true;
        }
        return typeof __tmIsWhiteboardGlobalCanvasActive === 'function' && __tmIsWhiteboardGlobalCanvasActive();
    }

    function __tmGetWhiteboardDrawingConfig() {
        return typeof __tmNormalizeWhiteboardDrawingConfig === 'function'
            ? __tmNormalizeWhiteboardDrawingConfig(SettingsStore.data.whiteboardDrawingConfig)
            : (SettingsStore.data.whiteboardDrawingConfig || {});
    }

    function __tmIsWhiteboardDrawingLayerHidden() {
        return !!__tmGetWhiteboardDrawingConfig().hidden;
    }

    function __tmSetWhiteboardDrawingConfig(patch = {}, opts = {}) {
        const next = __tmGetWhiteboardDrawingConfig();
        Object.assign(next, (patch && typeof patch === 'object') ? patch : {});
        SettingsStore.data.whiteboardDrawingConfig = typeof __tmNormalizeWhiteboardDrawingConfig === 'function'
            ? __tmNormalizeWhiteboardDrawingConfig(next)
            : next;
        if (opts?.persist !== false) {
            try { SettingsStore.syncToLocal(); } catch (e) {}
            try { SettingsStore.save(); } catch (e) {}
        }
    }

    function __tmGetWhiteboardDrawingCanvasDocId() {
        if (typeof __tmIsWhiteboardGlobalCanvasActive === 'function' && __tmIsWhiteboardGlobalCanvasActive()) {
            return typeof __tmGetWhiteboardGlobalCanvasDocId === 'function'
                ? __tmGetWhiteboardGlobalCanvasDocId()
                : '__tm_global_whiteboard__';
        }
        return String(state.activeDocId || '').trim();
    }

    function __tmGetWhiteboardDrawingStorage() {
        const globalActive = typeof __tmIsWhiteboardGlobalCanvasActive === 'function' && __tmIsWhiteboardGlobalCanvasActive();
        if (globalActive && typeof __tmGetWhiteboardGlobalBoardState === 'function') {
            const groupId = typeof __tmGetWhiteboardGlobalBoardGroupId === 'function' ? __tmGetWhiteboardGlobalBoardGroupId() : '';
            const board = __tmGetWhiteboardGlobalBoardState(groupId);
            return {
                scope: 'global',
                groupId,
                docId: __tmGetWhiteboardDrawingCanvasDocId(),
                drawings: Array.isArray(board?.drawings) ? board.drawings : [],
            };
        }
        return {
            scope: 'doc',
            groupId: '',
            docId: __tmGetWhiteboardDrawingCanvasDocId(),
            drawings: Array.isArray(SettingsStore.data.whiteboardDrawings) ? SettingsStore.data.whiteboardDrawings : [],
        };
    }

    function __tmSetWhiteboardDrawingStorage(nextDrawings, opts = {}) {
        const o = (opts && typeof opts === 'object') ? opts : {};
        const storage = __tmGetWhiteboardDrawingStorage();
        const normalized = typeof __tmNormalizeWhiteboardDrawingArray === 'function'
            ? __tmNormalizeWhiteboardDrawingArray(nextDrawings)
            : (Array.isArray(nextDrawings) ? nextDrawings : []);
        if (storage.scope === 'global' && typeof __tmPatchWhiteboardGlobalBoardState === 'function') {
            __tmPatchWhiteboardGlobalBoardState(storage.groupId, { drawings: normalized }, { keepEmpty: true, persist: o.persist });
        } else {
            SettingsStore.data.whiteboardDrawings = normalized;
            try { WhiteboardStore?.syncFromSettings?.(SettingsStore.data, 'whiteboard-drawings'); } catch (e) {}
            try { SettingsStore.syncToLocal(); } catch (e) {}
            if (o.persist !== false) {
                try { SettingsStore.save(); } catch (e) {}
            }
        }
        return normalized;
    }

    const TM_WHITEBOARD_HISTORY_SETTINGS_KEYS = [
        'whiteboardLinks',
        'whiteboardDetachedChildren',
        'whiteboardNotes',
        'whiteboardDrawings',
        'whiteboardFrames',
        'whiteboardNodePos',
        'whiteboardPlacedTaskIds',
        'whiteboardDocFrameSize',
        'whiteboardAllTabsDocOrderByGroup',
        'whiteboardGlobalBoardsByGroup',
        'whiteboardStateVersion',
    ];

    function __tmCloneWhiteboardHistoryValue(value, fallback) {
        if (typeof __tmCloneJsonSafe === 'function') {
            try { return __tmCloneJsonSafe(value, fallback); } catch (e) {}
        }
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (e) {
            return fallback;
        }
    }

    function __tmBuildWhiteboardHistorySettingsSnapshot() {
        const data = (SettingsStore?.data && typeof SettingsStore.data === 'object') ? SettingsStore.data : {};
        const snapshot = {};
        TM_WHITEBOARD_HISTORY_SETTINGS_KEYS.forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                snapshot[key] = __tmCloneWhiteboardHistoryValue(data[key], data[key]);
            }
        });
        return snapshot;
    }

    function __tmBuildWhiteboardHistoryStoreSnapshot() {
        try {
            if (WhiteboardStore?.data && typeof WhiteboardStore.data === 'object') {
                return __tmCloneWhiteboardHistoryValue(WhiteboardStore.data, WhiteboardStore.data);
            }
        } catch (e) {}
        return null;
    }

    function __tmGetWhiteboardHistoryFingerprint(entry) {
        try {
            return JSON.stringify({
                settings: entry?.settings || {},
                store: entry?.store || null,
            });
        } catch (e) {
            return '';
        }
    }

    function __tmEnsureWhiteboardHistoryStack() {
        if (!Array.isArray(state.whiteboardHistoryUndoStack)) state.whiteboardHistoryUndoStack = [];
        return state.whiteboardHistoryUndoStack;
    }

    function __tmPushWhiteboardHistorySnapshot(label = '') {
        if (state.__tmWhiteboardHistoryRestoring) return false;
        const entry = {
            label: String(label || '').trim(),
            createdAt: String(Date.now()),
            settings: __tmBuildWhiteboardHistorySettingsSnapshot(),
            store: __tmBuildWhiteboardHistoryStoreSnapshot(),
        };
        const fingerprint = __tmGetWhiteboardHistoryFingerprint(entry);
        if (!fingerprint) return false;
        const stack = __tmEnsureWhiteboardHistoryStack();
        const last = stack[stack.length - 1];
        if (String(last?.fingerprint || '') === fingerprint) return false;
        entry.fingerprint = fingerprint;
        stack.push(entry);
        if (stack.length > 40) stack.splice(0, stack.length - 40);
        return true;
    }

    function __tmHasWhiteboardHistoryUndo() {
        return __tmEnsureWhiteboardHistoryStack().length > 0;
    }

    function __tmRestoreWhiteboardHistoryEntry(entry, opts = {}) {
        if (!entry || typeof entry !== 'object') return false;
        const settingsSnapshot = (entry.settings && typeof entry.settings === 'object') ? entry.settings : {};
        state.__tmWhiteboardHistoryRestoring = true;
        try {
            TM_WHITEBOARD_HISTORY_SETTINGS_KEYS.forEach((key) => {
                if (Object.prototype.hasOwnProperty.call(settingsSnapshot, key)) {
                    SettingsStore.data[key] = __tmCloneWhiteboardHistoryValue(settingsSnapshot[key], settingsSnapshot[key]);
                }
            });
            const storeSnapshot = (entry.store && typeof entry.store === 'object')
                ? __tmCloneWhiteboardHistoryValue(entry.store, entry.store)
                : null;
            if (storeSnapshot && WhiteboardStore) {
                try {
                    WhiteboardStore.data = (typeof __tmBuildWhiteboardStoreDataFromSettings === 'function')
                        ? __tmBuildWhiteboardStoreDataFromSettings(SettingsStore.data, storeSnapshot)
                        : storeSnapshot;
                    WhiteboardStore.normalize?.();
                    WhiteboardStore.scheduleSave?.();
                } catch (e) {}
            } else {
                try { WhiteboardStore?.syncFromSettings?.(SettingsStore.data, 'whiteboard-undo'); } catch (e) {}
            }
            try { SettingsStore.syncToLocal(); } catch (e) {}
            try { SettingsStore.save(); } catch (e) {}
            try { __tmClearWhiteboardCardSnapshotCache(); } catch (e) {}
            try { __tmClearWhiteboardMultiSelection(); } catch (e) {}
            try { __tmClearWhiteboardStrokeSelection(); } catch (e) {}
            state.whiteboardSelectedTaskId = '';
            state.whiteboardSelectedNoteId = '';
            state.whiteboardSelectedFrameId = '';
            state.whiteboardSelectedLinkId = '';
            state.whiteboardSelectedLinkDocId = '';
            state.whiteboardMultiSelectedLinkKeys = [];
            try { __tmApplyWhiteboardCardSelectionDom(''); } catch (e) {}
            if (opts?.render !== false) render();
            try { __tmScheduleWhiteboardEdgeRedraw(); } catch (e) {}
            try { __tmScheduleWhiteboardNavigatorUpdate(); } catch (e) {}
            return true;
        } finally {
            state.__tmWhiteboardHistoryRestoring = false;
        }
    }

    function __tmUndoWhiteboardHistoryChange(opts = {}) {
        const stack = __tmEnsureWhiteboardHistoryStack();
        if (!stack.length) return false;
        const entry = stack.pop();
        return __tmRestoreWhiteboardHistoryEntry(entry, opts);
    }

    window.__tmPushWhiteboardHistorySnapshot = __tmPushWhiteboardHistorySnapshot;
    window.__tmUndoWhiteboardHistoryChange = __tmUndoWhiteboardHistoryChange;

    function __tmGetWhiteboardDrawingHistoryKey(storageInput) {
        const storage = (storageInput && typeof storageInput === 'object') ? storageInput : __tmGetWhiteboardDrawingStorage();
        const scope = String(storage.scope || '').trim() === 'global' ? 'global' : 'doc';
        if (scope === 'global') return `global:${String(storage.groupId || '').trim() || 'all'}`;
        const docId = String(storage.docId || '').trim();
        return docId ? `doc:${docId}` : '';
    }

    function __tmEnsureWhiteboardDrawingUndoStack() {
        if (!Array.isArray(state.whiteboardDrawingUndoStack)) state.whiteboardDrawingUndoStack = [];
        return state.whiteboardDrawingUndoStack;
    }

    function __tmCloneWhiteboardStroke(stroke) {
        const raw = (stroke && typeof stroke === 'object') ? stroke : null;
        if (!raw) return null;
        try {
            return JSON.parse(JSON.stringify(raw));
        } catch (e) {
            return { ...raw };
        }
    }

    function __tmNormalizeWhiteboardUndoStrokeItems(items) {
        return (Array.isArray(items) ? items : [])
            .map((item, fallbackIndex) => {
                const hasStroke = item && typeof item === 'object' && Object.prototype.hasOwnProperty.call(item, 'stroke');
                const stroke = __tmCloneWhiteboardStroke(hasStroke ? item.stroke : item);
                if (!stroke || !String(stroke.id || '').trim()) return null;
                const index0 = hasStroke ? Number(item.index) : Number(fallbackIndex);
                const index = Number.isFinite(index0) ? Math.max(0, Math.round(index0)) : fallbackIndex;
                return { stroke, index };
            })
            .filter(Boolean);
    }

    function __tmPushWhiteboardDrawingUndoEntry(entry = {}) {
        const storage = (entry.storage && typeof entry.storage === 'object') ? entry.storage : __tmGetWhiteboardDrawingStorage();
        const key = __tmGetWhiteboardDrawingHistoryKey(storage);
        const type = String(entry.type || '').trim();
        const strokes = __tmNormalizeWhiteboardUndoStrokeItems(entry.strokes);
        if (!key || !strokes.length || (type !== 'add' && type !== 'delete' && type !== 'update')) return;
        const stack = __tmEnsureWhiteboardDrawingUndoStack();
        stack.push({
            key,
            type,
            scope: String(storage.scope || '').trim() === 'global' ? 'global' : 'doc',
            groupId: String(storage.groupId || '').trim(),
            docId: String(storage.docId || '').trim(),
            strokes,
            createdAt: String(Date.now()),
        });
        if (stack.length > 80) stack.splice(0, stack.length - 80);
    }

    function __tmFindWhiteboardDrawingUndoIndex(storageInput) {
        const key = __tmGetWhiteboardDrawingHistoryKey(storageInput);
        if (!key) return -1;
        const stack = __tmEnsureWhiteboardDrawingUndoStack();
        for (let i = stack.length - 1; i >= 0; i -= 1) {
            if (String(stack[i]?.key || '').trim() === key) return i;
        }
        return -1;
    }

    function __tmHasWhiteboardDrawingUndo(storageInput) {
        return __tmFindWhiteboardDrawingUndoIndex(storageInput) >= 0;
    }

    function __tmUndoWhiteboardDrawingChange(opts = {}) {
        if (!__tmIsWhiteboardDrawingEnabled()) return false;
        const storage = __tmGetWhiteboardDrawingStorage();
        const stack = __tmEnsureWhiteboardDrawingUndoStack();
        const index = __tmFindWhiteboardDrawingUndoIndex(storage);
        if (index < 0) return false;
        const entry = stack.splice(index, 1)[0];
        const current = Array.isArray(storage.drawings) ? storage.drawings : [];
        const strokeItems = __tmNormalizeWhiteboardUndoStrokeItems(entry?.strokes);
        if (!strokeItems.length) return false;
        let next = current.slice();
        let changed = false;
        if (String(entry?.type || '').trim() === 'add') {
            const ids = new Set(strokeItems.map((item) => String(item.stroke?.id || '').trim()).filter(Boolean));
            const filtered = next.filter((stroke) => !ids.has(String(stroke?.id || '').trim()));
            changed = filtered.length !== next.length;
            next = filtered;
        } else if (String(entry?.type || '').trim() === 'delete') {
            const existing = new Set(next.map((stroke) => String(stroke?.id || '').trim()).filter(Boolean));
            strokeItems
                .slice()
                .sort((a, b) => Number(a.index) - Number(b.index))
                .forEach((item) => {
                    const stroke = __tmCloneWhiteboardStroke(item.stroke);
                    const id = String(stroke?.id || '').trim();
                    if (!stroke || !id || existing.has(id)) return;
                    next.splice(Math.max(0, Math.min(next.length, Number(item.index) || 0)), 0, stroke);
                    existing.add(id);
                    changed = true;
                });
        } else if (String(entry?.type || '').trim() === 'update') {
            const replacements = new Map(strokeItems.map((item) => [String(item.stroke?.id || '').trim(), item.stroke]).filter(([id]) => !!id));
            next = next.map((stroke) => {
                const id = String(stroke?.id || '').trim();
                if (!id || !replacements.has(id)) return stroke;
                changed = true;
                return __tmCloneWhiteboardStroke(replacements.get(id)) || stroke;
            });
        }
        if (!changed) return false;
        __tmClearWhiteboardStrokeSelection();
        __tmSetWhiteboardDrawingStorage(next, { persist: opts?.persist !== false });
        if (opts?.render !== false) render();
        return true;
    }

    function __tmBuildWhiteboardStrokePath(points) {
        const pts = Array.isArray(points) ? points : [];
        if (!pts.length) return '';
        const xy = pts.map((p) => [Number(p?.[0]), Number(p?.[1])]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
        if (!xy.length) return '';
        if (xy.length === 1) {
            const [x, y] = xy[0];
            return `M ${x} ${y} L ${x + 0.1} ${y + 0.1}`;
        }
        const parts = [`M ${xy[0][0]} ${xy[0][1]}`];
        for (let i = 1; i < xy.length; i += 1) parts.push(`L ${xy[i][0]} ${xy[i][1]}`);
        return parts.join(' ');
    }

    function __tmGetWhiteboardStrokeBounds(points, width = 1) {
        const pts = Array.isArray(points) ? points : [];
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        pts.forEach((p) => {
            const x = Number(p?.[0]);
            const y = Number(p?.[1]);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        });
        if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
        const pad = Math.max(2, Number(width) || 1);
        return { x: minX - pad, y: minY - pad, w: Math.max(1, maxX - minX + pad * 2), h: Math.max(1, maxY - minY + pad * 2) };
    }

    function __tmAppendWhiteboardDrawingPoint(points, point, minDistance = 1.8) {
        const list = Array.isArray(points) ? points : [];
        const p = point || {};
        const x = Number(p.x);
        const y = Number(p.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return list;
        const prev = list[list.length - 1];
        if (prev) {
            const dx = x - Number(prev[0]);
            const dy = y - Number(prev[1]);
            if (Math.hypot(dx, dy) < minDistance) return list;
        }
        const pressure = Number(p.pressure);
        list.push(Number.isFinite(pressure) ? [Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.max(0, Math.min(1, pressure))] : [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
        return list;
    }

    function __tmPointToSegmentDistance(px, py, ax, ay, bx, by) {
        const vx = bx - ax;
        const vy = by - ay;
        const wx = px - ax;
        const wy = py - ay;
        const len2 = vx * vx + vy * vy;
        const t = len2 > 0 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2)) : 0;
        const cx = ax + vx * t;
        const cy = ay + vy * t;
        return Math.hypot(px - cx, py - cy);
    }

    function __tmWhiteboardStrokeHitTest(stroke, x, y, radius = 8) {
        const r = Math.max(2, Number(radius) || 8);
        const b = stroke?.bounds;
        if (b && typeof b === 'object') {
            const bx = Number(b.x);
            const by = Number(b.y);
            const bw = Number(b.w);
            const bh = Number(b.h);
            if (Number.isFinite(bx) && Number.isFinite(by) && Number.isFinite(bw) && Number.isFinite(bh)) {
                if (x < bx - r || x > bx + bw + r || y < by - r || y > by + bh + r) return false;
            }
        }
        const points = Array.isArray(stroke?.points) ? stroke.points : [];
        if (!points.length) return false;
        if (points.length === 1) return Math.hypot(x - Number(points[0][0]), y - Number(points[0][1])) <= r;
        for (let i = 1; i < points.length; i += 1) {
            const a = points[i - 1];
            const c = points[i];
            const d = __tmPointToSegmentDistance(x, y, Number(a[0]), Number(a[1]), Number(c[0]), Number(c[1]));
            if (d <= r + Math.max(1, Number(stroke?.width) || 1) / 2) return true;
        }
        return false;
    }

    function __tmClearWhiteboardStrokeSelection() {
        state.whiteboardSelectedStrokeId = '';
        state.whiteboardMultiSelectedStrokeIds = [];
        try { __tmRemoveWhiteboardStrokeTools(); } catch (e) {}
    }

    function __tmSetGlobalWhiteboardNodePlacement(taskId, docId, x, y, opts = {}) {
        const id = String(taskId || '').trim();
        const did = String(docId || '').trim();
        const xx = Number(x);
        const yy = Number(y);
        if (!id || !did || !Number.isFinite(xx) || !Number.isFinite(yy)) return;
        const o = (opts && typeof opts === 'object') ? opts : {};
        const groupId = __tmGetWhiteboardGlobalBoardGroupId();
        const board = __tmGetWhiteboardGlobalBoardState(groupId);
        const nodePos = (board?.nodePos && typeof board.nodePos === 'object') ? { ...board.nodePos } : {};
        const placedTaskIds = (board?.placedTaskIds && typeof board.placedTaskIds === 'object') ? { ...board.placedTaskIds } : {};
        const prev = nodePos[id];
        const manual = (typeof o.manual === 'boolean')
            ? o.manual
            : !!(prev && typeof prev === 'object' && prev.manual === true);
        nodePos[id] = { docId: did, x: Math.round(xx), y: Math.round(yy), manual, updatedAt: String(Date.now()) };
        placedTaskIds[id] = true;
        __tmPatchWhiteboardGlobalBoardState(groupId, { nodePos, placedTaskIds }, { keepEmpty: true, persist: o.persist });
    }

    function __tmSetGlobalWhiteboardChildDetached(taskId, detached, parentTaskId = '', opts = {}) {
        const id = String(taskId || '').trim();
        if (!id) return;
        const o = (opts && typeof opts === 'object') ? opts : {};
        const groupId = __tmGetWhiteboardGlobalBoardGroupId();
        const board = __tmGetWhiteboardGlobalBoardState(groupId);
        const detachedChildren = (board?.detachedChildren && typeof board.detachedChildren === 'object') ? { ...board.detachedChildren } : {};
        if (detached) {
            const pid = String(parentTaskId || __tmResolveWhiteboardTaskParentId(id) || '').trim();
            detachedChildren[id] = { detached: true, manual: true, updatedAt: String(Date.now()), parentTaskId: pid };
        } else {
            delete detachedChildren[id];
        }
        __tmPatchWhiteboardGlobalBoardState(groupId, { detachedChildren }, { keepEmpty: true, persist: o.persist });
    }

    async function __tmResolveWhiteboardGlobalCreateTarget() {
        const configured = String(SettingsStore.data.newTaskDocId || '').trim();
        if (!configured) {
            try { hint('⚠ 请前往常规设置配置默认新建文档', 'warning'); } catch (e) {}
            return null;
        }
        if (configured !== '__dailyNote__') return { mode: 'doc', docId: configured };
        let notebook = String(SettingsStore.data.newTaskDailyNoteNotebookId || '').trim();
        if (!notebook) {
            try { await __tmRefreshNotebookCache(); } catch (e) {}
            notebook = String(SettingsStore.data.newTaskDailyNoteNotebookId || '').trim();
        }
        if (!notebook) {
            try { hint('⚠ 请前往常规设置配置今天日记默认笔记本', 'warning'); } catch (e) {}
            return null;
        }
        return { mode: 'dailyNote', notebook };
    }

    window.tmWhiteboardSetDone = function(taskId, checked, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const tid = String(taskId || '').trim();
        const checkbox = ev?.target instanceof HTMLInputElement ? ev.target : null;
        if (!tid) return false;
        if (typeof window.tmSetDone !== 'function') {
            try { if (checkbox) checkbox.checked = !checked; } catch (e) {}
            try { hint('❌ 完成状态写入入口未就绪', 'error'); } catch (e) {}
            return false;
        }
        return Promise.resolve(window.tmSetDone(tid, !!checked, ev, {
            source: 'whiteboard-card-done',
            skipInteractionGate: true,
        })).catch((error) => {
            try { if (checkbox) checkbox.checked = !checked; } catch (e) {}
            try { hint(`❌ 操作失败: ${error?.message || String(error)}`, 'error'); } catch (e) {}
            return false;
        });
    };

    function __tmMeasureWhiteboardNavigatorWorldRect(el, viewportRect, view) {
        if (!(el instanceof HTMLElement)) return null;
        const zoom = Math.max(0.01, Number(view?.zoom) || 1);
        let r = null;
        try { r = el.getBoundingClientRect(); } catch (e) {}
        if (!r) return null;
        const w = Number(r.width) / zoom;
        const h = Number(r.height) / zoom;
        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
        const x = (Number(r.left) - Number(viewportRect.left) - Number(view.x || 0)) / zoom;
        const y = (Number(r.top) - Number(viewportRect.top) - Number(view.y || 0)) / zoom;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return { x, y, w, h };
    }

    function __tmExpandWhiteboardNavigatorBounds(bounds, rect) {
        if (!rect || typeof rect !== 'object') return bounds;
        const x = Number(rect.x);
        const y = Number(rect.y);
        const w = Number(rect.w);
        const h = Number(rect.h);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
            return bounds;
        }
        const maxX = x + w;
        const maxY = y + h;
        if (!bounds) return { minX: x, minY: y, maxX, maxY };
        bounds.minX = Math.min(bounds.minX, x);
        bounds.minY = Math.min(bounds.minY, y);
        bounds.maxX = Math.max(bounds.maxX, maxX);
        bounds.maxY = Math.max(bounds.maxY, maxY);
        return bounds;
    }

    function __tmWhiteboardNavigatorBoundsToRect(bounds) {
        if (!bounds || typeof bounds !== 'object') return null;
        const minX = Number(bounds.minX);
        const minY = Number(bounds.minY);
        const maxX = Number(bounds.maxX);
        const maxY = Number(bounds.maxY);
        if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
        return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
    }

    function __tmPlaceWhiteboardNavigatorRect(el, rect, model, opts = {}) {
        if (!(el instanceof HTMLElement) || !rect || !model) return;
        const o = (opts && typeof opts === 'object') ? opts : {};
        const minSize = Math.max(0, Number(o.minSize) || 0);
        const left = Number(model.left) + (Number(rect.x) - Number(model.minX)) * Number(model.scale);
        const top = Number(model.top) + (Number(rect.y) - Number(model.minY)) * Number(model.scale);
        const width = Math.max(minSize, Number(rect.w) * Number(model.scale));
        const height = Math.max(minSize, Number(rect.h) * Number(model.scale));
        if (![left, top, width, height].every(Number.isFinite)) return;
        el.style.left = `${left.toFixed(2)}px`;
        el.style.top = `${top.toFixed(2)}px`;
        el.style.width = `${width.toFixed(2)}px`;
        el.style.height = `${height.toFixed(2)}px`;
    }

    function __tmUpdateWhiteboardNavigator() {
        if (state.viewMode !== 'whiteboard') return;
        const viewport = state.modal?.querySelector?.('#tmWhiteboardViewport');
        const navigator = state.modal?.querySelector?.('#tmWhiteboardNavigator');
        if (!(viewport instanceof HTMLElement) || !(navigator instanceof HTMLElement)) return;
        const revealBtn = state.modal?.querySelector?.('#tmWhiteboardNavigatorReveal');
        if (!!SettingsStore.data.whiteboardNavigatorHidden) {
            try { navigator.classList.add('tm-whiteboard-navigator--hidden'); } catch (e) {}
            try { revealBtn?.classList?.add?.('tm-whiteboard-navigator-reveal--visible'); } catch (e) {}
            state.whiteboardNavigatorModel = null;
            return;
        }
        try { navigator.classList.remove('tm-whiteboard-navigator--hidden'); } catch (e) {}
        try { revealBtn?.classList?.remove?.('tm-whiteboard-navigator-reveal--visible'); } catch (e) {}
        const surface = navigator.querySelector('.tm-whiteboard-navigator__surface');
        const contentEl = navigator.querySelector('.tm-whiteboard-navigator__content');
        const viewportEl = navigator.querySelector('.tm-whiteboard-navigator__viewport');
        if (!(surface instanceof HTMLElement) || !(contentEl instanceof HTMLElement) || !(viewportEl instanceof HTMLElement)) return;
        const view = __tmGetWhiteboardView();
        const zoom = Math.max(0.01, Number(view.zoom) || 1);
        const viewportRect = viewport.getBoundingClientRect();
        const currentRect = {
            x: -(Number(view.x) || 0) / zoom,
            y: -(Number(view.y) || 0) / zoom,
            w: Math.max(1, Number(viewport.clientWidth || viewportRect.width || 1) / zoom),
            h: Math.max(1, Number(viewport.clientHeight || viewportRect.height || 1) / zoom),
        };
        let contentBounds = null;
        let fullBounds = null;
        const itemRects = [];
        const allView = !(state.activeDocId && state.activeDocId !== 'all');
        if (allView) {
            try {
                viewport.querySelectorAll('.tm-whiteboard-doc[data-doc-id]').forEach((el) => {
                    const isGlobalDoc = String(el.getAttribute('data-tm-whiteboard-scope') || '').trim() === 'global'
                        || !!el.classList?.contains?.('tm-whiteboard-doc--global');
                    if (isGlobalDoc) return;
                    const rect = __tmMeasureWhiteboardNavigatorWorldRect(el, viewportRect, view);
                    if (!rect) return;
                    const docId = String(el.getAttribute('data-doc-id') || '').trim();
                    itemRects.push({ rect, key: docId ? `doc:${docId}` : `doc:${itemRects.length}`, className: 'tm-whiteboard-navigator__item--doc', minSize: 2 });
                    contentBounds = __tmExpandWhiteboardNavigatorBounds(contentBounds, rect);
                    fullBounds = __tmExpandWhiteboardNavigatorBounds(fullBounds, rect);
                });
            } catch (e) {}
        }
        try {
            viewport.querySelectorAll('.tm-whiteboard-node--root[data-task-id],.tm-whiteboard-note[data-note-id]').forEach((el) => {
                const rect = __tmMeasureWhiteboardNavigatorWorldRect(el, viewportRect, view);
                if (!rect) return;
                const isNote = el.classList?.contains?.('tm-whiteboard-note');
                const itemKind = isNote ? 'note' : 'task';
                const itemId = String(el.getAttribute(isNote ? 'data-note-id' : 'data-task-id') || '').trim();
                itemRects.push({
                    rect,
                    key: itemId ? `${itemKind}:${itemId}` : `${itemKind}:${itemRects.length}`,
                    className: isNote ? 'tm-whiteboard-navigator__item--note' : 'tm-whiteboard-navigator__item--task',
                    minSize: isNote ? 3 : 2,
                });
                contentBounds = __tmExpandWhiteboardNavigatorBounds(contentBounds, rect);
                fullBounds = __tmExpandWhiteboardNavigatorBounds(fullBounds, rect);
            });
        } catch (e) {}
        fullBounds = __tmExpandWhiteboardNavigatorBounds(fullBounds, currentRect);
        const contentRect = __tmWhiteboardNavigatorBoundsToRect(contentBounds) || currentRect;
        const boundsRect = __tmWhiteboardNavigatorBoundsToRect(fullBounds);
        if (!boundsRect) return;
        const baseSpan = Math.max(boundsRect.w, boundsRect.h);
        const worldPad = Math.max(64, Math.min(800, baseSpan * 0.035));
        const minX = boundsRect.x - worldPad;
        const minY = boundsRect.y - worldPad;
        const spanW = Math.max(1, boundsRect.w + worldPad * 2);
        const spanH = Math.max(1, boundsRect.h + worldPad * 2);
        const surfaceRect = surface.getBoundingClientRect();
        const surfaceW = Math.max(1, Number(surface.clientWidth || surfaceRect.width || 1));
        const surfaceH = Math.max(1, Number(surface.clientHeight || surfaceRect.height || 1));
        const inset = 6;
        const scale = Math.max(0.0001, Math.min((surfaceW - inset * 2) / spanW, (surfaceH - inset * 2) / spanH));
        if (!Number.isFinite(scale) || scale <= 0) return;
        const computedModel = {
            minX,
            minY,
            scale,
            spanW,
            spanH,
            left: (surfaceW - spanW * scale) / 2,
            top: (surfaceH - spanH * scale) / 2,
            currentRect: { ...currentRect },
            zoom,
        };
        const dragModel = (state.whiteboardNavigatorDrag?.model && typeof state.whiteboardNavigatorDrag.model === 'object')
            ? state.whiteboardNavigatorDrag.model
            : null;
        const model = dragModel || computedModel;
        if (!dragModel) state.whiteboardNavigatorModel = computedModel;
        __tmPlaceWhiteboardNavigatorRect(contentEl, contentRect, model, { minSize: 4 });
        const visibleKeys = new Set();
        const existingItems = new Map();
        try {
            surface.querySelectorAll('.tm-whiteboard-navigator__item').forEach((el) => {
                if (!(el instanceof HTMLElement)) return;
                const key = String(el.getAttribute('data-tm-nav-key') || '').trim();
                if (key && !existingItems.has(key)) existingItems.set(key, el);
                else el.remove();
            });
        } catch (e) {}
        itemRects.slice(0, 220).forEach((itemInfo, index) => {
            const key = String(itemInfo?.key || `item:${index}`).trim() || `item:${index}`;
            visibleKeys.add(key);
            let item = existingItems.get(key);
            if (!(item instanceof HTMLElement)) {
                item = document.createElement('div');
                item.setAttribute('data-tm-nav-key', key);
                try { surface.insertBefore(item, viewportEl); } catch (e) {}
            }
            const className = `tm-whiteboard-navigator__item ${String(itemInfo?.className || '').trim()}`.trim();
            if (item.className !== className) item.className = className;
            __tmPlaceWhiteboardNavigatorRect(item, itemInfo?.rect, model, { minSize: Number(itemInfo?.minSize) || 2 });
        });
        try {
            existingItems.forEach((el, key) => {
                if (!visibleKeys.has(key)) el.remove();
            });
        } catch (e) {}
        __tmPlaceWhiteboardNavigatorRect(viewportEl, currentRect, model, { minSize: 5 });
        navigator.dataset.tmReady = '1';
    }

    function __tmClampWhiteboardNavigatorWorldTopLeft(value, min, span, size) {
        const v = Number(value);
        const lo = Number(min);
        const range = Math.max(0, Number(span) - Math.max(1, Number(size) || 1));
        const hi = lo + range;
        if (!Number.isFinite(v) || !Number.isFinite(lo) || !Number.isFinite(hi)) return lo;
        return Math.max(lo, Math.min(hi, v));
    }

    function __tmGetWhiteboardNavigatorClientPoint(ev) {
        const touches = ev?.touches;
        if (touches && Number(touches.length) > 0) {
            const t = touches[0];
            return { clientX: Number(t?.clientX) || 0, clientY: Number(t?.clientY) || 0 };
        }
        const changedTouches = ev?.changedTouches;
        if (changedTouches && Number(changedTouches.length) > 0) {
            const t = changedTouches[0];
            return { clientX: Number(t?.clientX) || 0, clientY: Number(t?.clientY) || 0 };
        }
        const clientX = Number(ev?.clientX);
        const clientY = Number(ev?.clientY);
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
        return { clientX, clientY };
    }

    function __tmGetWhiteboardNavigatorPointerWorld(point, surface, model) {
        if (!point || !(surface instanceof HTMLElement) || !model) return null;
        const scale = Math.max(0.0001, Number(model.scale) || 0);
        if (!Number.isFinite(scale) || scale <= 0) return null;
        let rect = null;
        try { rect = surface.getBoundingClientRect(); } catch (e) {}
        if (!rect) return null;
        const localX = Number(point.clientX) - Number(rect.left);
        const localY = Number(point.clientY) - Number(rect.top);
        const x = Number(model.minX) + (localX - Number(model.left)) / scale;
        const y = Number(model.minY) + (localY - Number(model.top)) / scale;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return { x, y };
    }

    function __tmStartWhiteboardNavigatorDrag(ev, opts = {}) {
        if (state.viewMode !== 'whiteboard') return;
        if (!!SettingsStore.data.whiteboardNavigatorHidden) return;
        const o = (opts && typeof opts === 'object') ? opts : {};
        const source = String(o.source || 'pointer').trim();
        const pType = String(ev?.pointerType || '').toLowerCase();
        if (source === 'pointer' && pType !== 'touch' && Number(ev?.button) !== 0) return;
        if (source === 'touch' && Number(ev?.touches?.length) !== 1) return;
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
        if (state.whiteboardNavigatorDrag) return;
        const target = ev?.target;
        if (target?.closest?.('.tm-whiteboard-navigator__hide,.tm-whiteboard-navigator-reveal')) return;
        const frame = state.modal?.querySelector?.('.tm-whiteboard-navigator__viewport');
        const navigator = state.modal?.querySelector?.('#tmWhiteboardNavigator');
        const viewport = state.modal?.querySelector?.('#tmWhiteboardViewport');
        const surface = state.modal?.querySelector?.('.tm-whiteboard-navigator__surface');
        const model = state.whiteboardNavigatorModel;
        const current = model?.currentRect;
        const scale = Number(model?.scale);
        const zoom = Math.max(0.01, Number(__tmGetWhiteboardView()?.zoom) || Number(model?.zoom) || 1);
        const point = __tmGetWhiteboardNavigatorClientPoint(ev);
        if (!(frame instanceof HTMLElement) || !(surface instanceof HTMLElement) || !model || !current || !Number.isFinite(scale) || scale <= 0 || !point) return;
        const viewW = Math.max(1, Number(current.w) || 1);
        const viewH = Math.max(1, Number(current.h) || 1);
        const startsOnFrame = !!target?.closest?.('.tm-whiteboard-navigator__viewport');
        const centerOnPointer = !!o.centerOnPointer && !startsOnFrame;
        let startWorldX = Number(current.x) || 0;
        let startWorldY = Number(current.y) || 0;
        if (centerOnPointer) {
            const pointerWorld = __tmGetWhiteboardNavigatorPointerWorld(point, surface, model);
            if (pointerWorld) {
                startWorldX = __tmClampWhiteboardNavigatorWorldTopLeft(Number(pointerWorld.x) - viewW / 2, Number(model.minX), Number(model.spanW), viewW);
                startWorldY = __tmClampWhiteboardNavigatorWorldTopLeft(Number(pointerWorld.y) - viewH / 2, Number(model.minY), Number(model.spanH), viewH);
            }
        }
        const pointerId = Number(ev?.pointerId);
        const hasPointerId = source === 'pointer' && Number.isFinite(pointerId);
        state.whiteboardNavigatorDrag = {
            pointerId: hasPointerId ? pointerId : null,
            source,
            startClientX: Number(point.clientX) || 0,
            startClientY: Number(point.clientY) || 0,
            startWorldX,
            startWorldY,
            viewW,
            viewH,
            model,
        };
        try { navigator?.classList?.add?.('tm-whiteboard-navigator--dragging'); } catch (e) {}
        try { viewport?.classList?.add?.('tm-whiteboard-viewport--moving'); } catch (e) {}
        const captureEl = ev?.currentTarget instanceof HTMLElement ? ev.currentTarget : frame;
        if (hasPointerId && typeof captureEl.setPointerCapture === 'function') {
            try { captureEl.setPointerCapture(pointerId); } catch (e) {}
        }
        if (centerOnPointer) {
            __tmSetWhiteboardView({ x: -startWorldX * zoom, y: -startWorldY * zoom }, { persist: false });
            __tmApplyWhiteboardTransform();
        }
        const samePointer = (e2) => {
            if (source !== 'pointer') return true;
            const pid = Number(state.whiteboardNavigatorDrag?.pointerId);
            if (!Number.isFinite(pid)) return true;
            const cur = Number(e2?.pointerId);
            return !Number.isFinite(cur) || cur === pid;
        };
        const onMove = (e2) => {
            if (!samePointer(e2)) return;
            try { e2?.stopPropagation?.(); } catch (e) {}
            try { e2?.preventDefault?.(); } catch (e) {}
            const s = state.whiteboardNavigatorDrag;
            if (!s || typeof s !== 'object') return;
            const movePoint = __tmGetWhiteboardNavigatorClientPoint(e2);
            if (!movePoint) return;
            const m = s.model || {};
            const cx = Number(movePoint.clientX);
            const cy = Number(movePoint.clientY);
            const sx = Number(s.startClientX) || 0;
            const sy = Number(s.startClientY) || 0;
            const nextWorldX0 = Number(s.startWorldX) + ((Number.isFinite(cx) ? cx : sx) - sx) / Math.max(0.0001, Number(m.scale) || 1);
            const nextWorldY0 = Number(s.startWorldY) + ((Number.isFinite(cy) ? cy : sy) - sy) / Math.max(0.0001, Number(m.scale) || 1);
            const nextWorldX = __tmClampWhiteboardNavigatorWorldTopLeft(nextWorldX0, Number(m.minX), Number(m.spanW), Number(s.viewW));
            const nextWorldY = __tmClampWhiteboardNavigatorWorldTopLeft(nextWorldY0, Number(m.minY), Number(m.spanH), Number(s.viewH));
            __tmSetWhiteboardView({ x: -nextWorldX * zoom, y: -nextWorldY * zoom }, { persist: false });
            __tmApplyWhiteboardTransform();
        };
        const onUp = (e2) => {
            if (!samePointer(e2)) return;
            try { document.removeEventListener('pointermove', onMove, true); } catch (e) {}
            try { document.removeEventListener('pointerup', onUp, true); } catch (e) {}
            try { document.removeEventListener('pointercancel', onUp, true); } catch (e) {}
            try { document.removeEventListener('touchmove', onMove, true); } catch (e) {}
            try { document.removeEventListener('touchend', onUp, true); } catch (e) {}
            try { document.removeEventListener('touchcancel', onUp, true); } catch (e) {}
            try { window.removeEventListener('blur', onUp, true); } catch (e) {}
            if (hasPointerId && typeof captureEl.releasePointerCapture === 'function') {
                try { captureEl.releasePointerCapture(pointerId); } catch (e) {}
            }
            try { navigator?.classList?.remove?.('tm-whiteboard-navigator--dragging'); } catch (e) {}
            try { viewport?.classList?.remove?.('tm-whiteboard-viewport--moving'); } catch (e) {}
            state.whiteboardNavigatorDrag = null;
            __tmScheduleWhiteboardNavigatorUpdate();
            __tmScheduleWhiteboardViewSave();
        };
        if (source === 'touch') {
            try { document.addEventListener('touchmove', onMove, { capture: true, passive: false }); } catch (e) { try { document.addEventListener('touchmove', onMove, true); } catch (e2) {} }
            try { document.addEventListener('touchend', onUp, true); } catch (e) {}
            try { document.addEventListener('touchcancel', onUp, true); } catch (e) {}
        } else {
            try { document.addEventListener('pointermove', onMove, true); } catch (e) {}
            try { document.addEventListener('pointerup', onUp, true); } catch (e) {}
            try { document.addEventListener('pointercancel', onUp, true); } catch (e) {}
        }
        try { window.addEventListener('blur', onUp, true); } catch (e) {}
    }

    window.tmWhiteboardNavigatorViewportPointerDown = function(ev) {
        __tmStartWhiteboardNavigatorDrag(ev, { source: 'pointer', centerOnPointer: false });
    };

    window.tmWhiteboardNavigatorSurfacePointerDown = function(ev) {
        __tmStartWhiteboardNavigatorDrag(ev, { source: 'pointer', centerOnPointer: true });
    };

    window.tmWhiteboardNavigatorSurfaceTouchStart = function(ev) {
        __tmStartWhiteboardNavigatorDrag(ev, { source: 'touch', centerOnPointer: true });
    };

    window.tmWhiteboardSetNavigatorHidden = async function(hidden, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
        const next = !!hidden;
        SettingsStore.data.whiteboardNavigatorHidden = next;
        try { SettingsStore.syncToLocal(); } catch (e) {}
        const navigator = state.modal?.querySelector?.('#tmWhiteboardNavigator');
        const revealBtn = state.modal?.querySelector?.('#tmWhiteboardNavigatorReveal');
        try { navigator?.classList?.toggle?.('tm-whiteboard-navigator--hidden', next); } catch (e) {}
        try { revealBtn?.classList?.toggle?.('tm-whiteboard-navigator-reveal--visible', next); } catch (e) {}
        if (!next) __tmScheduleWhiteboardNavigatorUpdate();
        try { await SettingsStore.save(); } catch (e) {}
    };

    function __tmScheduleWhiteboardNavigatorUpdate() {
        if (state.viewMode !== 'whiteboard') return;
        try {
            const id0 = Number(state.whiteboardNavigatorRafId) || 0;
            if (id0) cancelAnimationFrame(id0);
        } catch (e) {}
        try {
            state.whiteboardNavigatorRafId = requestAnimationFrame(() => {
                state.whiteboardNavigatorRafId = 0;
                __tmUpdateWhiteboardNavigator();
            });
        } catch (e) {
            __tmUpdateWhiteboardNavigator();
        }
    }

    function __tmApplyWhiteboardTransform() {
        if (state.viewMode !== 'whiteboard') return;
        const world = state.modal?.querySelector?.('#tmWhiteboardWorld');
        if (!(world instanceof HTMLElement)) return;
        const view = __tmGetWhiteboardView();
        world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
        __tmScheduleWhiteboardNavigatorUpdate();
        __tmScheduleWhiteboardEdgeRedraw();
    }

    function __tmNormalizeWhiteboardAllViewFrames() {
        if (state.viewMode !== 'whiteboard') return;
        if (state.activeDocId && state.activeDocId !== 'all') return;
        const body = state.modal?.querySelector?.('#tmWhiteboardBody');
        if (!(body instanceof Element)) return;
        const docBodies = body.querySelectorAll('.tm-whiteboard-doc-body[data-doc-id]');
        docBodies.forEach((docBody) => {
            if (!(docBody instanceof HTMLElement)) return;
            const styledHeight = Number.parseFloat(docBody.style.height) || 0;
            const styledMinHeight = Number.parseFloat(docBody.style.minHeight) || 0;
            const baseHeight = Math.max(220, styledHeight, styledMinHeight, docBody.clientHeight, 0);
            let maxBottom = 0;
            try {
                docBody.querySelectorAll('.tm-whiteboard-node,.tm-whiteboard-note').forEach((el) => {
                    if (!(el instanceof HTMLElement)) return;
                    const top = Number(el.offsetTop);
                    const h = Number(el.offsetHeight);
                    if (!Number.isFinite(top) || !Number.isFinite(h) || h <= 0) return;
                    const bottom = top + h;
                    if (Number.isFinite(bottom)) maxBottom = Math.max(maxBottom, bottom);
                });
            } catch (e) {}
            const targetHeight = Math.max(baseHeight, Math.ceil(maxBottom + 28));
            const currentHeight = Math.max(
                Number.parseFloat(docBody.style.height) || 0,
                docBody.clientHeight || 0,
                docBody.scrollHeight || 0,
            );
            if (targetHeight > currentHeight + 1) {
                docBody.style.height = `${targetHeight}px`;
                docBody.style.minHeight = `${targetHeight}px`;
            }
        });
    }

    function __tmApplyWhiteboardCardSelectionDom(taskId) {
        if (state.viewMode !== 'whiteboard') return;
        const body = state.modal?.querySelector?.('#tmWhiteboardBody');
        if (!(body instanceof Element)) return;
        const id = String(taskId || '').trim();
        try {
            body.querySelectorAll('.tm-whiteboard-node.tm-whiteboard-card--selected').forEach((el) => {
                try { el.classList.remove('tm-whiteboard-card--selected'); } catch (e) {}
            });
        } catch (e) {}
        try {
            body.querySelectorAll('.tm-whiteboard-card-tools[data-tm-wb-dyn="1"]').forEach((el) => {
                try { el.remove(); } catch (e) {}
            });
        } catch (e) {}
        if (!id) return;
        try {
            const card = body.querySelector(`.tm-whiteboard-node[data-task-id="${CSS.escape(id)}"]`);
            if (card instanceof HTMLElement) {
                card.classList.add('tm-whiteboard-card--selected');
                const allView = !(state.activeDocId && state.activeDocId !== 'all');
                if (!allView) {
                    const tid = String(card.getAttribute('data-task-id') || '').trim();
                    const did = String(card.getAttribute('data-doc-id') || '').trim();
                    if (tid && did) {
                        const isGhost = !state.flatTasks?.[tid] && !!__tmGetWhiteboardCardSnapshot(tid);
                        const deleteTitle = isGhost ? '移除快照卡片并彻底移除记录（不进入侧边栏）' : '移除卡片并回到侧栏';
                        const parentId = __tmResolveWhiteboardTaskParentId(tid);
                        const detachedOrDetachedLike = !!parentId && (
                            __tmIsWhiteboardChildDetached(tid)
                            || card.classList.contains('tm-whiteboard-node--root')
                        );
                        const canMoveBack = detachedOrDetachedLike;
                        const tools = document.createElement('div');
                        tools.className = 'tm-whiteboard-card-tools';
                        tools.setAttribute('data-tm-wb-dyn', '1');
                        tools.innerHTML = `
                            <button class="tm-btn tm-btn-danger" data-tm-wb-action="delete" style="padding:2px 8px;font-size:12px;" title="${esc(deleteTitle)}">移除</button>
                            ${canMoveBack ? `<button class="tm-btn tm-btn-info" data-tm-wb-action="moveBack" style="padding:2px 8px;font-size:12px;" title="移回父任务">移回父任务</button>` : ''}
                        `;
                        const deleteBtn = tools.querySelector('button[data-tm-wb-action="delete"]');
                        if (deleteBtn instanceof HTMLButtonElement) {
                            deleteBtn.addEventListener('click', (ev) => {
                                try { ev.stopPropagation(); } catch (e) {}
                                try { window.tmWhiteboardDeleteCard?.(tid, did, ev); } catch (e) {}
                            });
                        }
                        const moveBackBtn = tools.querySelector('button[data-tm-wb-action="moveBack"]');
                        if (moveBackBtn instanceof HTMLButtonElement) {
                            moveBackBtn.addEventListener('click', (ev) => {
                                try { ev.stopPropagation(); } catch (e) {}
                                try { window.tmWhiteboardMoveBackToParent?.(tid, did, ev); } catch (e) {}
                            });
                        }
                        try { card.prepend(tools); } catch (e) {}
                    }
                }
            }
        } catch (e) {}
    }

    function __tmFindWhiteboardTaskNode(taskId, docId) {
        const tid = String(taskId || '').trim();
        const did = String(docId || '').trim();
        if (!tid || !did) return null;
        try {
            const body = state.modal?.querySelector?.('#tmWhiteboardBody');
            if (!(body instanceof Element)) return null;
            const selector = `.tm-whiteboard-node[data-task-id="${CSS.escape(tid)}"][data-doc-id="${CSS.escape(did)}"]`;
            const node = body.querySelector(selector);
            return node instanceof HTMLElement ? node : null;
        } catch (e) {
            return null;
        }
    }

    function __tmCenterWhiteboardNodeInViewport(node, opts = {}) {
        if (!(node instanceof HTMLElement)) return false;
        const viewport = state.modal?.querySelector?.('#tmWhiteboardViewport');
        if (!(viewport instanceof HTMLElement)) return false;
        const nodeRect = node.getBoundingClientRect();
        const viewportRect = viewport.getBoundingClientRect();
        if (!Number.isFinite(nodeRect.left) || !Number.isFinite(nodeRect.top) || nodeRect.width <= 0 || nodeRect.height <= 0) return false;
        const view = __tmGetWhiteboardView();
        const currentZoom = Math.max(0.35, Math.min(2.5, Number(view?.zoom) || 1));
        const options = (opts && typeof opts === 'object') ? opts : {};
        const requestedMinZoom = Number(options.minZoom);
        const minZoom = Number.isFinite(requestedMinZoom) ? Math.max(0.35, Math.min(2.5, requestedMinZoom)) : currentZoom;
        const zoom = Math.max(currentZoom, minZoom);
        const worldX = (nodeRect.left - viewportRect.left - Number(view.x || 0)) / currentZoom;
        const worldY = (nodeRect.top - viewportRect.top - Number(view.y || 0)) / currentZoom;
        const worldCx = worldX + (nodeRect.width / currentZoom / 2);
        const worldCy = worldY + (nodeRect.height / currentZoom / 2);
        if (!Number.isFinite(worldCx) || !Number.isFinite(worldCy)) return false;
        const x = (Number(viewport.clientWidth || viewportRect.width || 0) / 2) - (worldCx * zoom);
        const y = (Number(viewport.clientHeight || viewportRect.height || 0) / 2) - (worldCy * zoom);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
        __tmSetWhiteboardView({ x, y, zoom }, { persist: false });
        __tmApplyWhiteboardTransform();
        __tmScheduleWhiteboardViewSave();
        return true;
    }

    window.tmJumpToWhiteboardTask = async function(taskId, ev, options = {}) {
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        const id = String(taskId || '').trim();
        if (!id) return false;
        if (typeof __tmIsOptimisticTempTaskId === 'function' && __tmIsOptimisticTempTaskId(id)) {
            try { hint('⏳ 任务正在写入，完成后可跳转到白板', 'info'); } catch (e) {}
            return false;
        }
        const opts = (options && typeof options === 'object') ? options : {};
        const location = __tmResolveWhiteboardTaskLocation(id, { scope: opts.scope });
        if (!location) {
            try { hint('⚠ 该任务不在白板上', 'warning'); } catch (e) {}
            return false;
        }
        const docId = String(location.docId || '').trim();
        const targetTaskId = String(location.targetTaskId || location.taskId || id).trim();
        const scope = String(location.scope || '').trim();
        if (!docId || !targetTaskId) return false;
        try {
            if (String(state.viewMode || '').trim() !== 'whiteboard') {
                window.tmSwitchViewMode?.('whiteboard');
            }
            if (scope === 'global') {
                if (typeof window.tmSetWhiteboardAllTabsLayoutMode === 'function'
                    && __tmGetWhiteboardAllTabsLayoutMode() !== 'global') {
                    await window.tmSetWhiteboardAllTabsLayoutMode('global', null, { silent: true });
                }
                if (String(state.activeDocId || 'all').trim() !== 'all') {
                    await window.tmSwitchDoc?.('all');
                }
            } else if (String(state.activeDocId || 'all').trim() !== docId) {
                await window.tmSwitchDoc?.(docId);
            }
        } catch (e) {}

        return await new Promise((resolve) => {
            const startedAt = Date.now();
            let tries = 0;
            const maxWaitMs = 4500;
            const isWhiteboardReady = () => {
                if (String(state.viewMode || '').trim() !== 'whiteboard') return false;
                if (scope === 'global') {
                    if (String(state.activeDocId || 'all').trim() !== 'all') return false;
                    if (__tmGetWhiteboardAllTabsLayoutMode() !== 'global') return false;
                } else if (String(state.activeDocId || 'all').trim() !== docId) return false;
                const modal = state.modal instanceof Element ? state.modal : null;
                const viewport = modal?.querySelector?.('#tmWhiteboardViewport');
                const body = modal?.querySelector?.('#tmWhiteboardBody');
                if (!(viewport instanceof HTMLElement) || !(body instanceof HTMLElement)) return false;
                try {
                    const docBody = scope === 'global'
                        ? body.querySelector('.tm-whiteboard-doc-body[data-tm-whiteboard-scope="global"]')
                        : body.querySelector(`.tm-whiteboard-doc-body[data-doc-id="${CSS.escape(docId)}"]`);
                    return docBody instanceof HTMLElement;
                } catch (e) {
                    return false;
                }
            };
            const scheduleLocate = (delayMs = 0) => {
                if (delayMs > 0) {
                    setTimeout(locate, delayMs);
                    return;
                }
                try {
                    requestAnimationFrame(locate);
                } catch (e) {
                    setTimeout(locate, 50);
                }
            };
            const locate = () => {
                tries += 1;
                const ready = isWhiteboardReady();
                const node = ready ? (__tmFindWhiteboardTaskNode(targetTaskId, docId) || __tmFindWhiteboardTaskNode(id, docId)) : null;
                if (node) {
                    try { __tmClearWhiteboardMultiSelection(); } catch (e) {}
                    state.whiteboardSelectedTaskId = String(node.getAttribute('data-task-id') || targetTaskId || id).trim();
                    state.whiteboardSelectedNoteId = '';
                    state.whiteboardSelectedFrameId = '';
                    state.whiteboardSelectedLinkId = '';
                    state.whiteboardSelectedLinkDocId = '';
                    try { __tmApplyWhiteboardCardSelectionDom(state.whiteboardSelectedTaskId); } catch (e) {}
                    const centered = __tmCenterWhiteboardNodeInViewport(node, { minZoom: 1 });
                    try { __tmScheduleWhiteboardEdgeRedraw(); } catch (e) {}
                    try { __tmScheduleWhiteboardNavigatorUpdate(); } catch (e) {}
                    if (centered) {
                        try { hint('✅ 已跳转到白板卡片', 'success'); } catch (e) {}
                        resolve(true);
                        return;
                    }
                }
                if ((Date.now() - startedAt) >= maxWaitMs || tries >= 90) {
                    try { hint('⚠ 未找到白板卡片位置', 'warning'); } catch (e) {}
                    resolve(false);
                    return;
                }
                scheduleLocate(tries < 12 ? 0 : 60);
            };
            try {
                requestAnimationFrame(() => requestAnimationFrame(() => scheduleLocate(0)));
            } catch (e) {
                setTimeout(locate, 60);
            }
        });
    };

    function __tmFindAnyWhiteboardTaskNode(taskId, docId = '') {
        const tid = String(taskId || '').trim();
        const did = String(docId || '').trim();
        if (!tid) return null;
        try {
            const body = state.modal?.querySelector?.('#tmWhiteboardBody');
            if (!(body instanceof Element)) return null;
            const taskSelector = `.tm-whiteboard-node[data-task-id="${CSS.escape(tid)}"]`;
            const selector = did ? `${taskSelector}[data-doc-id="${CSS.escape(did)}"]` : taskSelector;
            const node = body.querySelector(selector);
            return node instanceof HTMLElement ? node : null;
        } catch (e) {
            return null;
        }
    }

    function __tmFocusWhiteboardTaskNode(node, taskId) {
        if (!(node instanceof HTMLElement)) return false;
        const id = String(taskId || node.getAttribute('data-task-id') || '').trim();
        if (!id) return false;
        try { __tmClearWhiteboardMultiSelection(); } catch (e) {}
        state.whiteboardSelectedTaskId = id;
        state.whiteboardSelectedNoteId = '';
        state.whiteboardSelectedFrameId = '';
        state.whiteboardSelectedLinkId = '';
        state.whiteboardSelectedLinkDocId = '';
        try { __tmApplyWhiteboardCardSelectionDom(id); } catch (e) {}
        const centered = __tmCenterWhiteboardNodeInViewport(node, { minZoom: 1 });
        try { __tmScheduleWhiteboardEdgeRedraw(); } catch (e) {}
        try { __tmScheduleWhiteboardNavigatorUpdate(); } catch (e) {}
        return !!centered;
    }

    function __tmClearWhiteboardPoolSearchRenderTimer() {
        const timer = state.whiteboardPoolSearchRenderTimer;
        if (timer) {
            try { clearTimeout(timer); } catch (e) {}
        }
        state.whiteboardPoolSearchRenderTimer = 0;
    }

    function __tmReadWhiteboardPoolSearchInputValue(inputHint = null) {
        const input = inputHint instanceof HTMLInputElement
            ? inputHint
            : state.modal?.querySelector?.('#tmWhiteboardPoolSearchInput');
        return input instanceof HTMLInputElement ? String(input.value || '') : String(state.whiteboardPoolSearchKeyword || '');
    }

    function __tmRefreshWhiteboardPoolSearchResultsOnly() {
        const container = state.modal?.querySelector?.('#tmWhiteboardPoolContent');
        const renderResults = state.__tmRenderWhiteboardPoolSearchResultsHtml;
        if (!(container instanceof HTMLElement) || typeof renderResults !== 'function') {
            try { render(); } catch (e) {}
            return;
        }
        try {
            container.innerHTML = renderResults();
        } catch (e) {
            try { render(); } catch (e2) {}
        }
    }

    function __tmScheduleWhiteboardPoolSearchRender(delay = 140, options = {}) {
        __tmClearWhiteboardPoolSearchRenderTimer();
        state.whiteboardPoolSearchRenderTimer = setTimeout(() => {
            state.whiteboardPoolSearchRenderTimer = 0;
            if (!state.whiteboardPoolSearchOpen) return;
            const force = !!options.force;
            const elapsed = Date.now() - (Number(state.whiteboardPoolSearchLastInputAt) || 0);
            if (state.whiteboardPoolSearchComposing && !force && elapsed < 500) {
                __tmScheduleWhiteboardPoolSearchRender(120);
                return;
            }
            if (elapsed >= 500) state.whiteboardPoolSearchComposing = false;
            state.whiteboardPoolSearchKeyword = __tmReadWhiteboardPoolSearchInputValue(options.input);
            state.whiteboardPoolSearchFocusAfterRender = true;
            __tmRefreshWhiteboardPoolSearchResultsOnly();
        }, Math.max(0, Number(delay) || 0));
    }

    window.tmWhiteboardTogglePoolSearch = function(ev) {
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        const next = !state.whiteboardPoolSearchOpen;
        if (next && typeof window.tmRequireFullFeature === 'function' && !window.tmRequireFullFeature('whiteboard-pool-search', '白板任务池搜索')) return;
        state.whiteboardPoolSearchOpen = next;
        __tmClearWhiteboardPoolSearchRenderTimer();
        if (!next) {
            state.whiteboardPoolSearchKeyword = '';
            state.whiteboardPoolSearchFocusAfterRender = false;
            state.whiteboardPoolSearchComposing = false;
        } else {
            state.whiteboardPoolSearchFocusAfterRender = true;
        }
        try { render(); } catch (e) {}
    };

    window.tmWhiteboardPoolSearchInput = function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        if (typeof window.tmRequireFullFeature === 'function' && !window.tmRequireFullFeature('whiteboard-pool-search', '白板任务池搜索')) {
            try { if (ev?.target instanceof HTMLInputElement) ev.target.value = ''; } catch (e) {}
            return;
        }
        const input = ev?.target instanceof HTMLInputElement ? ev.target : null;
        state.whiteboardPoolSearchOpen = true;
        state.whiteboardPoolSearchLastInputAt = Date.now();
        const nextKeyword = String(input?.value || '');
        if (ev?.isComposing || state.whiteboardPoolSearchComposing) {
            __tmScheduleWhiteboardPoolSearchRender(220, { input });
            return;
        }
        if (String(state.whiteboardPoolSearchKeyword || '') === nextKeyword) {
            __tmScheduleWhiteboardPoolSearchRender(140, { input });
            return;
        }
        state.whiteboardPoolSearchKeyword = nextKeyword;
        __tmScheduleWhiteboardPoolSearchRender(140, { input });
    };

    window.tmWhiteboardPoolSearchCompositionStart = function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        if (typeof window.tmRequireFullFeature === 'function' && !window.tmRequireFullFeature('whiteboard-pool-search', '白板任务池搜索')) return;
        __tmClearWhiteboardPoolSearchRenderTimer();
        state.whiteboardPoolSearchComposing = true;
        state.whiteboardPoolSearchLastInputAt = Date.now();
    };

    window.tmWhiteboardPoolSearchCompositionEnd = function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        if (typeof window.tmRequireFullFeature === 'function' && !window.tmRequireFullFeature('whiteboard-pool-search', '白板任务池搜索')) {
            try { if (ev?.target instanceof HTMLInputElement) ev.target.value = ''; } catch (e) {}
            return;
        }
        const input = ev?.target instanceof HTMLInputElement ? ev.target : null;
        state.whiteboardPoolSearchComposing = false;
        state.whiteboardPoolSearchOpen = true;
        state.whiteboardPoolSearchLastInputAt = Date.now();
        setTimeout(() => {
            const nextKeyword = String(input?.value || '');
            if (String(state.whiteboardPoolSearchKeyword || '') !== nextKeyword) {
                state.whiteboardPoolSearchKeyword = nextKeyword;
            }
            __tmScheduleWhiteboardPoolSearchRender(40, { force: true, input });
        }, 0);
    };

    window.tmWhiteboardClearPoolSearch = function(ev) {
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        __tmClearWhiteboardPoolSearchRenderTimer();
        state.whiteboardPoolSearchOpen = true;
        state.whiteboardPoolSearchKeyword = '';
        state.whiteboardPoolSearchComposing = false;
        state.whiteboardPoolSearchFocusAfterRender = true;
        try {
            const input = state.modal?.querySelector?.('#tmWhiteboardPoolSearchInput');
            if (input instanceof HTMLInputElement) input.value = '';
        } catch (e) {}
        __tmRefreshWhiteboardPoolSearchResultsOnly();
    };

    window.tmWhiteboardSearchResultClick = async function(taskId, ev) {
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        if (ev?.ctrlKey || ev?.metaKey) return false;
        const id = String(taskId || '').trim();
        if (!id) return false;
        const targetEl = ev?.currentTarget instanceof HTMLElement ? ev.currentTarget : null;
        const docId = String(targetEl?.getAttribute?.('data-doc-id') || '').trim();
        const directNode = __tmFindAnyWhiteboardTaskNode(id, docId) || __tmFindAnyWhiteboardTaskNode(id);
        if (directNode) {
            const ok = __tmFocusWhiteboardTaskNode(directNode, id);
            if (ok) {
                try { hint('✅ 已跳转到白板卡片', 'success'); } catch (e) {}
                return true;
            }
        }
        let hasWhiteboardLocation = false;
        try {
            hasWhiteboardLocation = !!(typeof __tmResolveWhiteboardTaskLocation === 'function' && __tmResolveWhiteboardTaskLocation(id));
        } catch (e) {
            hasWhiteboardLocation = false;
        }
        if (hasWhiteboardLocation && typeof window.tmJumpToWhiteboardTask === 'function') {
            const jumped = await window.tmJumpToWhiteboardTask(id, ev);
            if (jumped) return true;
        }
        if (typeof window.tmJumpToTask === 'function') return await window.tmJumpToTask(id, ev);
        return false;
    };

    window.tmWhiteboardPoolTitleClick = async function(taskId, ev) {
        if (ev?.ctrlKey || ev?.metaKey) {
            try { ev?.preventDefault?.(); } catch (e) {}
            try { ev?.stopPropagation?.(); } catch (e) {}
            return false;
        }
        if (typeof window.tmJumpToTask === 'function') return await window.tmJumpToTask(taskId, ev);
        return false;
    };

    function __tmBuildWhiteboardPointerInfoFromBody(ev, docBody) {
        if (!(docBody instanceof HTMLElement)) return null;
        const cx = Number(ev?.clientX);
        const cy = Number(ev?.clientY);
        if (!Number.isFinite(cx) || !Number.isFinite(cy) || (Math.abs(cx) < 1 && Math.abs(cy) < 1)) return null;
        const docId = String(docBody.getAttribute('data-doc-id') || '').trim();
        if (!docId) return null;
        const zoom = Math.max(0.01, Number(__tmGetWhiteboardView()?.zoom) || 1);
        const docRect = docBody.getBoundingClientRect();
        const localX = (cx - docRect.left) / zoom;
        const localY = (cy - docRect.top) / zoom;
        if (!Number.isFinite(localX) || !Number.isFinite(localY)) return null;
        return { docId, body: docBody, clientX: cx, clientY: cy, localX, localY, at: Date.now() };
    }

    function __tmResolveWhiteboardCreatePointerInfo(ev, docIdHint = '') {
        const hint = String(docIdHint || '').trim();
        const allView = !(state.activeDocId && state.activeDocId !== 'all');
        const globalActive = allView
            && typeof __tmIsWhiteboardGlobalCanvasActive === 'function'
            && __tmIsWhiteboardGlobalCanvasActive();
        let docBody = null;
        if (globalActive) {
            docBody = __tmGetWhiteboardGlobalCanvasBody();
        }
        if (!(docBody instanceof HTMLElement)) {
            try {
                const hit = document.elementFromPoint(Number(ev?.clientX), Number(ev?.clientY))?.closest?.('.tm-whiteboard-doc-body[data-doc-id]');
                if (hit instanceof HTMLElement) docBody = hit;
            } catch (e) {}
        }
        if (!(docBody instanceof HTMLElement) && hint) {
            try {
                const fallback = state.modal?.querySelector?.(`.tm-whiteboard-doc-body[data-doc-id="${CSS.escape(hint)}"]`);
                if (fallback instanceof HTMLElement) docBody = fallback;
            } catch (e) {}
        }
        return __tmBuildWhiteboardPointerInfoFromBody(ev, docBody);
    }

    function __tmResolveWhiteboardPointerInfo(ev, docIdHint = '') {
        const hint = String(docIdHint || '').trim();
        let cx = Number(ev?.clientX);
        let cy = Number(ev?.clientY);
        if (!Number.isFinite(cx) || !Number.isFinite(cy) || (Math.abs(cx) < 1 && Math.abs(cy) < 1)) {
            return null;
        }
        let docBody = null;
        try {
            const hit = document.elementFromPoint(cx, cy)?.closest?.('.tm-whiteboard-doc-body[data-doc-id]');
            if (hit instanceof HTMLElement) docBody = hit;
        } catch (e) {}
        if (!(docBody instanceof HTMLElement) && hint) {
            try {
                const fallback = state.modal?.querySelector?.(`.tm-whiteboard-doc-body[data-doc-id="${CSS.escape(hint)}"]`);
                if (fallback instanceof HTMLElement) docBody = fallback;
            } catch (e) {}
        }
        if (!(docBody instanceof HTMLElement) && !hint
            && typeof __tmIsWhiteboardGlobalCanvasActive === 'function'
            && __tmIsWhiteboardGlobalCanvasActive()) {
            docBody = __tmGetWhiteboardGlobalCanvasBody();
        }
        if (!(docBody instanceof HTMLElement)) return null;
        const docId = String(docBody.getAttribute('data-doc-id') || '').trim();
        if (!docId) return null;
        const zoom = Math.max(0.01, Number(__tmGetWhiteboardView()?.zoom) || 1);
        const docRect = docBody.getBoundingClientRect();
        const localX = (cx - docRect.left) / zoom;
        const localY = (cy - docRect.top) / zoom;
        if (!Number.isFinite(localX) || !Number.isFinite(localY)) return null;
        return { docId, clientX: cx, clientY: cy, localX, localY, at: Date.now() };
    }

    function __tmTrackWhiteboardPointerFromClient(clientX, clientY, docIdHint = '') {
        const cx = Number(clientX);
        const cy = Number(clientY);
        if (!Number.isFinite(cx) || !Number.isFinite(cy) || (Math.abs(cx) < 1 && Math.abs(cy) < 1)) return null;
        const hint = String(docIdHint || '').trim();
        let docBody = null;
        try {
            const hit = document.elementFromPoint(cx, cy)?.closest?.('.tm-whiteboard-doc-body[data-doc-id]');
            if (hit instanceof HTMLElement) docBody = hit;
        } catch (e) {}
        if (!(docBody instanceof HTMLElement) && hint) {
            try {
                const fallback = state.modal?.querySelector?.(`.tm-whiteboard-doc-body[data-doc-id="${CSS.escape(hint)}"]`);
                if (fallback instanceof HTMLElement) docBody = fallback;
            } catch (e) {}
        }
        if (!(docBody instanceof HTMLElement) && !hint
            && typeof __tmIsWhiteboardGlobalCanvasActive === 'function'
            && __tmIsWhiteboardGlobalCanvasActive()) {
            docBody = __tmGetWhiteboardGlobalCanvasBody();
        }
        if (!(docBody instanceof HTMLElement)) return null;
        const docId = String(docBody.getAttribute('data-doc-id') || '').trim();
        if (!docId) return null;
        const zoom = Math.max(0.01, Number(__tmGetWhiteboardView()?.zoom) || 1);
        const rect = docBody.getBoundingClientRect();
        const localX = (cx - rect.left) / zoom;
        const localY = (cy - rect.top) / zoom;
        if (!Number.isFinite(localX) || !Number.isFinite(localY)) return null;
        const at = Date.now();
        state.whiteboardLastBoardPointer = { clientX: cx, clientY: cy, docId, at };
        state.whiteboardLastBoardLocal = { docId, x: localX, y: localY, at };
        return state.whiteboardLastBoardLocal;
    }

    function __tmStartWhiteboardPoolGlobalTracking(docIdHint = '') {
        __tmStopWhiteboardPoolGlobalTracking();
        const hint = String(docIdHint || '').trim();
        const onDocDragOver = (ev) => {
            __tmTrackWhiteboardPointerFromClient(ev?.clientX, ev?.clientY, hint);
            __tmWhiteboardDebugLogThrottled('pool-global-dragover', 800, 'pool:document-dragover', {
                docIdHint: hint,
                lastLocal: state.whiteboardLastBoardLocal,
                event: __tmWhiteboardDebugEventInfo(ev),
            });
        };
        const onDocDrop = () => {
            __tmWhiteboardDebugLog('pool:document-drop-tracker-end', { docIdHint: hint, lastLocal: state.whiteboardLastBoardLocal });
            __tmStopWhiteboardPoolGlobalTracking();
        };
        const onDocDragEnd = () => {
            __tmWhiteboardDebugLog('pool:document-dragend-tracker-end', { docIdHint: hint, lastLocal: state.whiteboardLastBoardLocal });
            __tmStopWhiteboardPoolGlobalTracking();
        };
        state.whiteboardPoolGlobalTracker = { onDocDragOver, onDocDrop, onDocDragEnd };
        __tmWhiteboardDebugLog('pool:global-tracker-start', { docIdHint: hint });
        try { document.addEventListener('dragover', onDocDragOver, true); } catch (e) {}
        try { document.addEventListener('drop', onDocDrop, true); } catch (e) {}
        try { document.addEventListener('dragend', onDocDragEnd, true); } catch (e) {}
    }

    function __tmStopWhiteboardPoolGlobalTracking() {
        const t = state.whiteboardPoolGlobalTracker;
        if (!t || typeof t !== 'object') return;
        try { document.removeEventListener('dragover', t.onDocDragOver, true); } catch (e) {}
        try { document.removeEventListener('drop', t.onDocDrop, true); } catch (e) {}
        try { document.removeEventListener('dragend', t.onDocDragEnd, true); } catch (e) {}
        state.whiteboardPoolGlobalTracker = null;
    }

    function __tmResolveWhiteboardDrawingPoint(ev) {
        if (!__tmIsWhiteboardDrawingEnabled()) return null;
        const target = ev?.target;
        if (target && target.closest && target.closest('.tm-whiteboard-sidebar,.tm-whiteboard-bottom-toolbar,.tm-whiteboard-drawing-toolbar,.tm-whiteboard-navigator,.tm-whiteboard-navigator-reveal,.tm-btn,input,button,select,textarea,label,a,.tm-whiteboard-doc-resize,.tm-task-link-dot,.tm-task-content-clickable,.tm-task-checkbox,.tm-whiteboard-note,.tm-whiteboard-note-editor,.tm-whiteboard-sticky-editor,.tm-whiteboard-link-tools,.tm-whiteboard-multi-tools')) return null;
        const expectedDocId = __tmGetWhiteboardDrawingCanvasDocId();
        const info = __tmResolveWhiteboardPointerInfo(ev, expectedDocId);
        if (!info) return null;
        if (String(info.docId || '').trim() !== expectedDocId) return null;
        return {
            docId: expectedDocId,
            x: Number(info.localX),
            y: Number(info.localY),
            pressure: Number.isFinite(Number(ev?.pressure)) ? Number(ev.pressure) : undefined,
        };
    }

    function __tmDeleteWhiteboardStrokesByIds(idsInput, opts = {}) {
        const ids = new Set((Array.isArray(idsInput) ? idsInput : [idsInput])
            .map((id) => String(id || '').trim())
            .filter(Boolean));
        if (!ids.size) return false;
        const storage = __tmGetWhiteboardDrawingStorage();
        const before = Array.isArray(storage.drawings) ? storage.drawings : [];
        const removed = before
            .map((stroke, index) => ids.has(String(stroke?.id || '').trim()) ? { stroke, index } : null)
            .filter(Boolean);
        const next = before.filter((stroke) => !ids.has(String(stroke?.id || '').trim()));
        if (next.length === before.length) return false;
        if (opts?.history !== false) {
            __tmPushWhiteboardDrawingUndoEntry({ type: 'delete', storage, strokes: removed });
        }
        __tmSetWhiteboardDrawingStorage(next, { persist: opts?.persist !== false });
        __tmRemoveWhiteboardFrameMemberIds({ strokeIds: Array.from(ids) }, { persist: opts?.persist !== false });
        const selectedId = String(state.whiteboardSelectedStrokeId || '').trim();
        if (selectedId && ids.has(selectedId)) {
            state.whiteboardSelectedStrokeId = '';
            __tmRemoveWhiteboardStrokeTools();
        }
        state.whiteboardMultiSelectedStrokeIds = (Array.isArray(state.whiteboardMultiSelectedStrokeIds) ? state.whiteboardMultiSelectedStrokeIds : [])
            .map((id) => String(id || '').trim())
            .filter((id) => id && !ids.has(id));
        if (opts?.render !== false) render();
        return true;
    }

    function __tmEraseWhiteboardStrokeAtPoint(point) {
        if (!point) return false;
        const cfg = __tmGetWhiteboardDrawingConfig();
        const storage = __tmGetWhiteboardDrawingStorage();
        const drawings = Array.isArray(storage.drawings) ? storage.drawings : [];
        const radius = Math.max(4, Number(cfg.eraserWidth) || 22) / 2;
        const hit = drawings.find((stroke) => String(stroke?.docId || '').trim() === String(point.docId || '').trim()
            && __tmWhiteboardStrokeHitTest(stroke, Number(point.x), Number(point.y), radius));
        if (!hit) return false;
        return __tmDeleteWhiteboardStrokesByIds(String(hit.id || '').trim(), { render: true, persist: true });
    }

    function __tmTranslateWhiteboardStroke(stroke, dx, dy) {
        const raw = __tmCloneWhiteboardStroke(stroke);
        if (!raw) return null;
        const ddx = Number(dx);
        const ddy = Number(dy);
        if (!Number.isFinite(ddx) || !Number.isFinite(ddy)) return raw;
        const points = (Array.isArray(raw.points) ? raw.points : [])
            .map((point) => {
                const x = Number(Array.isArray(point) ? point[0] : point?.x);
                const y = Number(Array.isArray(point) ? point[1] : point?.y);
                const p = Number(Array.isArray(point) ? point[2] : point?.p);
                if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
                const next = [Math.round((x + ddx) * 10) / 10, Math.round((y + ddy) * 10) / 10];
                if (Number.isFinite(p)) next.push(Math.max(0, Math.min(1, Math.round(p * 100) / 100)));
                return next;
            })
            .filter(Boolean);
        raw.points = points;
        raw.d = __tmBuildWhiteboardStrokePath(points) || raw.d || '';
        raw.bounds = __tmGetWhiteboardStrokeBounds(points, raw.width) || (raw.bounds && typeof raw.bounds === 'object'
            ? {
                x: Math.round((Number(raw.bounds.x) + ddx) * 10) / 10,
                y: Math.round((Number(raw.bounds.y) + ddy) * 10) / 10,
                w: Math.max(0, Number(raw.bounds.w) || 0),
                h: Math.max(0, Number(raw.bounds.h) || 0),
            }
            : null);
        raw.updatedAt = String(Date.now());
        return raw;
    }

    function __tmGetWhiteboardStrokeElementsByIds(ids, docId) {
        const body = state.modal?.querySelector?.('#tmWhiteboardBody');
        if (!(body instanceof Element)) return [];
        const did = String(docId || '').trim();
        return (Array.isArray(ids) ? ids : [])
            .map((id) => {
                const sid = String(id || '').trim();
                if (!sid) return null;
                try {
                    const docSelector = did ? `[data-doc-id="${CSS.escape(did)}"]` : '';
                    return body.querySelector(`.tm-whiteboard-drawing-stroke[data-stroke-id="${CSS.escape(sid)}"]${docSelector}`);
                } catch (e) {
                    return null;
                }
            })
            .filter((el) => el instanceof SVGGraphicsElement);
    }

    function __tmStartWhiteboardStrokeDrag(ev, strokeIds, docId) {
        const ids = Array.from(new Set((Array.isArray(strokeIds) ? strokeIds : [strokeIds])
            .map((id) => String(id || '').trim())
            .filter(Boolean)));
        if (!ids.length) return false;
        const button = Number(ev?.button);
        if (Number.isFinite(button) && button !== 0) return false;
        const start = __tmResolveWhiteboardPointerInfo(ev, docId);
        if (!start) return false;
        const storage = __tmGetWhiteboardDrawingStorage();
        const drawings = Array.isArray(storage.drawings) ? storage.drawings : [];
        const idSet = new Set(ids);
        const originals = drawings
            .map((stroke, index) => idSet.has(String(stroke?.id || '').trim()) ? { stroke: __tmCloneWhiteboardStroke(stroke), index } : null)
            .filter((item) => item && item.stroke);
        if (!originals.length) return false;
        const pointerId = Number.isFinite(Number(ev?.pointerId)) ? Number(ev.pointerId) : null;
        const viewport = state.modal?.querySelector?.('#tmWhiteboardViewport');
        const elements = __tmGetWhiteboardStrokeElementsByIds(ids, start.docId);
        let lastDx = 0;
        let lastDy = 0;
        let moved = false;
        const applyPreview = (dx, dy) => {
            elements.forEach((el) => {
                try { el.setAttribute('transform', `translate(${dx.toFixed(2)} ${dy.toFixed(2)})`); } catch (e) {}
            });
        };
        const cleanupPreview = () => {
            elements.forEach((el) => {
                try { el.removeAttribute('transform'); } catch (e) {}
            });
        };
        const move = (e2) => {
            if (pointerId !== null && Number(e2?.pointerId) !== pointerId) return;
            const point = __tmResolveWhiteboardPointerInfo(e2, start.docId);
            if (!point || String(point.docId || '').trim() !== String(start.docId || '').trim()) return;
            lastDx = Number(point.localX) - Number(start.localX);
            lastDy = Number(point.localY) - Number(start.localY);
            if (Math.hypot(lastDx, lastDy) >= 0.5) moved = true;
            applyPreview(lastDx, lastDy);
            try { e2?.preventDefault?.(); } catch (e) {}
        };
        const cleanup = (e2) => {
            if (pointerId !== null && Number(e2?.pointerId) !== pointerId) return;
            try { document.removeEventListener('pointermove', move, true); } catch (e) {}
            try { document.removeEventListener('pointerup', cleanup, true); } catch (e) {}
            try { document.removeEventListener('pointercancel', cleanup, true); } catch (e) {}
            try { viewport?.releasePointerCapture?.(pointerId); } catch (e) {}
            cleanupPreview();
            state.whiteboardDrawingSession = null;
            state.whiteboardSuppressClickUntil = Date.now() + 220;
            if (!moved) {
                if (Array.isArray(state.whiteboardMultiSelectedStrokeIds) && state.whiteboardMultiSelectedStrokeIds.length) {
                    __tmRenderWhiteboardMultiTools(__tmComputeWhiteboardMultiSelectionRect());
                } else {
                    __tmRenderWhiteboardStrokeTools(__tmComputeWhiteboardSelectedStrokeRect());
                }
                return;
            }
            const replacements = new Map(originals.map((item) => {
                const id = String(item.stroke?.id || '').trim();
                return [id, __tmTranslateWhiteboardStroke(item.stroke, lastDx, lastDy)];
            }).filter(([id, stroke]) => !!id && !!stroke));
            const latest = __tmGetWhiteboardDrawingStorage();
            const current = Array.isArray(latest.drawings) ? latest.drawings : [];
            const next = current.map((stroke) => {
                const id = String(stroke?.id || '').trim();
                return id && replacements.has(id) ? replacements.get(id) : stroke;
            });
            __tmPushWhiteboardDrawingUndoEntry({ type: 'update', storage, strokes: originals });
            __tmSetWhiteboardDrawingStorage(next, { persist: true });
            const docBody = state.modal?.querySelector?.(`.tm-whiteboard-doc-body[data-doc-id="${CSS.escape(String(start.docId || '').trim())}"]`);
            if (docBody instanceof HTMLElement) {
                ids.forEach((strokeId) => __tmRefreshWhiteboardFrameMembershipForElement('stroke', strokeId, docBody, { persist: false }));
                try { SettingsStore.save(); } catch (e) {}
            }
            render();
            if (Array.isArray(state.whiteboardMultiSelectedStrokeIds) && state.whiteboardMultiSelectedStrokeIds.length) {
                __tmRenderWhiteboardMultiTools(__tmComputeWhiteboardMultiSelectionRect());
            } else {
                __tmRenderWhiteboardStrokeTools(__tmComputeWhiteboardSelectedStrokeRect());
            }
        };
        state.whiteboardDrawingSession = { kind: 'stroke-move', pointerId, strokeIds: ids, docId: start.docId };
        __tmRemoveWhiteboardStrokeTools();
        __tmRemoveWhiteboardMultiTools();
        try { viewport?.setPointerCapture?.(pointerId); } catch (e) {}
        try { document.addEventListener('pointermove', move, true); } catch (e) {}
        try { document.addEventListener('pointerup', cleanup, true); } catch (e) {}
        try { document.addEventListener('pointercancel', cleanup, true); } catch (e) {}
        try { ev?.preventDefault?.(); ev?.stopPropagation?.(); } catch (e) {}
        return true;
    }

    function __tmStartWhiteboardEraser(ev) {
        const first = __tmResolveWhiteboardDrawingPoint(ev);
        if (!first) return false;
        const pointerId = Number.isFinite(Number(ev?.pointerId)) ? Number(ev.pointerId) : null;
        const viewport = state.modal?.querySelector?.('#tmWhiteboardViewport');
        const apply = (e2) => {
            if (pointerId !== null && Number(e2?.pointerId) !== pointerId) return;
            const point = __tmResolveWhiteboardDrawingPoint(e2);
            if (point) __tmEraseWhiteboardStrokeAtPoint(point);
        };
        const cleanup = (e2) => {
            if (pointerId !== null && Number(e2?.pointerId) !== pointerId) return;
            try { document.removeEventListener('pointermove', apply, true); } catch (e) {}
            try { document.removeEventListener('pointerup', cleanup, true); } catch (e) {}
            try { document.removeEventListener('pointercancel', cleanup, true); } catch (e) {}
            try { viewport?.releasePointerCapture?.(pointerId); } catch (e) {}
            state.whiteboardDrawingSession = null;
            state.whiteboardSuppressClickUntil = Date.now() + 220;
        };
        state.whiteboardDrawingSession = { kind: 'eraser', pointerId };
        try { viewport?.setPointerCapture?.(pointerId); } catch (e) {}
        apply(ev);
        try { document.addEventListener('pointermove', apply, true); } catch (e) {}
        try { document.addEventListener('pointerup', cleanup, true); } catch (e) {}
        try { document.addEventListener('pointercancel', cleanup, true); } catch (e) {}
        try { ev?.preventDefault?.(); ev?.stopPropagation?.(); } catch (e) {}
        return true;
    }

    function __tmStartWhiteboardStroke(ev) {
        const tool = String(SettingsStore.data.whiteboardTool || 'pan').trim();
        if (tool !== 'pen' && tool !== 'highlighter') return false;
        const first = __tmResolveWhiteboardDrawingPoint(ev);
        if (!first) return false;
        const cfg = __tmGetWhiteboardDrawingConfig();
        const color = tool === 'highlighter' ? cfg.highlighterColor : cfg.penColor;
        const displayColor = String(color || '').toLowerCase() === '#1f2937' ? 'var(--tm-text-color)' : color;
        const width = tool === 'highlighter' ? cfg.highlighterWidth : cfg.penWidth;
        const opacity = tool === 'highlighter' ? 0.42 : 1;
        const layer = state.modal?.querySelector?.(`.tm-whiteboard-drawing-layer[data-doc-id="${CSS.escape(first.docId)}"]`);
        if (!(layer instanceof SVGElement)) return false;
        const pointerId = Number.isFinite(Number(ev?.pointerId)) ? Number(ev.pointerId) : null;
        const points = [];
        __tmAppendWhiteboardDrawingPoint(points, first, 0);
        const draft = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        draft.setAttribute('class', `tm-whiteboard-drawing-stroke tm-whiteboard-drawing-stroke--draft${tool === 'highlighter' ? ' tm-whiteboard-drawing-stroke--highlighter' : ''}`);
        draft.setAttribute('stroke', displayColor);
        draft.setAttribute('stroke-width', String(width));
        draft.setAttribute('stroke-opacity', String(opacity));
        draft.setAttribute('fill', 'none');
        draft.setAttribute('stroke-linecap', 'round');
        draft.setAttribute('stroke-linejoin', 'round');
        draft.setAttribute('d', __tmBuildWhiteboardStrokePath(points));
        try { layer.appendChild(draft); } catch (e) {}
        const move = (e2) => {
            if (pointerId !== null && Number(e2?.pointerId) !== pointerId) return;
            const point = __tmResolveWhiteboardDrawingPoint(e2);
            if (!point) return;
            __tmAppendWhiteboardDrawingPoint(points, point, Math.max(1, Number(width) / 5));
            draft.setAttribute('d', __tmBuildWhiteboardStrokePath(points));
            try { e2?.preventDefault?.(); } catch (e) {}
        };
        const cleanup = (e2) => {
            if (pointerId !== null && Number(e2?.pointerId) !== pointerId) return;
            try { document.removeEventListener('pointermove', move, true); } catch (e) {}
            try { document.removeEventListener('pointerup', cleanup, true); } catch (e) {}
            try { document.removeEventListener('pointercancel', cleanup, true); } catch (e) {}
            try { layer.removeChild(draft); } catch (e) {}
            try { layer.releasePointerCapture?.(pointerId); } catch (e) {}
            const finalPath = __tmBuildWhiteboardStrokePath(points);
            const bounds = __tmGetWhiteboardStrokeBounds(points, width);
            state.whiteboardDrawingSession = null;
            state.whiteboardSuppressClickUntil = Date.now() + 220;
            if (points.length < 1 || !finalPath || !bounds) return;
            const now = String(Date.now());
            const stroke = {
                id: `stroke_${now}_${Math.random().toString(36).slice(2, 8)}`,
                docId: first.docId,
                type: tool === 'highlighter' ? 'highlighter' : 'stroke',
                color,
                width,
                opacity,
                points,
                d: finalPath,
                bounds,
                createdAt: now,
                updatedAt: now,
            };
            const storage = __tmGetWhiteboardDrawingStorage();
            const before = Array.isArray(storage.drawings) ? storage.drawings : [];
            __tmPushWhiteboardDrawingUndoEntry({ type: 'add', storage, strokes: [{ stroke, index: before.length }] });
            __tmSetWhiteboardDrawingStorage([...before, stroke], { persist: true });
            state.whiteboardSelectedStrokeId = stroke.id;
            state.whiteboardMultiSelectedStrokeIds = [];
            render();
        };
        state.whiteboardDrawingSession = { kind: 'stroke', pointerId, points, draft };
        try { layer.setPointerCapture?.(pointerId); } catch (e) {}
        try { document.addEventListener('pointermove', move, true); } catch (e) {}
        try { document.addEventListener('pointerup', cleanup, true); } catch (e) {}
        try { document.addEventListener('pointercancel', cleanup, true); } catch (e) {}
        try { ev?.preventDefault?.(); ev?.stopPropagation?.(); } catch (e) {}
        return true;
    }

    function __tmStartWhiteboardDrawingPointer(ev) {
        if (!__tmIsWhiteboardDrawingEnabled()) return false;
        if (__tmIsWhiteboardDrawingLayerHidden()) return false;
        if (!__tmRequireWhiteboardDrawingFeature()) return false;
        const button = Number(ev?.button);
        if (Number.isFinite(button) && button !== 0) return false;
        const tool = String(SettingsStore.data.whiteboardTool || '').trim();
        if (tool === 'eraser') return __tmStartWhiteboardEraser(ev);
        return __tmStartWhiteboardStroke(ev);
    }

    window.tmWhiteboardDrawingPointerDown = function(ev, strokeId, docId) {
        const tool = String(SettingsStore.data.whiteboardTool || 'pan').trim();
        if (tool === 'pen' || tool === 'highlighter') return;
        const id = String(strokeId || '').trim();
        if (!id) return;
        if (tool === 'eraser') {
            if (!__tmRequireWhiteboardDrawingFeature()) return;
            try { ev?.preventDefault?.(); ev?.stopPropagation?.(); } catch (e) {}
            __tmDeleteWhiteboardStrokesByIds(id, { render: true, persist: true });
            return;
        }
        if (tool !== 'select' && tool !== 'pan') return;
        const multiStrokeIds = Array.from(new Set((Array.isArray(state.whiteboardMultiSelectedStrokeIds) ? state.whiteboardMultiSelectedStrokeIds : [])
            .map((x) => String(x || '').trim())
            .filter(Boolean)));
        const moveIds = multiStrokeIds.includes(id) ? multiStrokeIds : [id];
        state.whiteboardSelectedStrokeId = multiStrokeIds.includes(id) ? '' : id;
        state.whiteboardMultiSelectedStrokeIds = multiStrokeIds.includes(id) ? multiStrokeIds : [];
        state.whiteboardSelectedTaskId = '';
        state.whiteboardSelectedNoteId = '';
        state.whiteboardSelectedFrameId = '';
        state.whiteboardSelectedLinkId = '';
        state.whiteboardSelectedLinkDocId = '';
        state.whiteboardSuppressClickUntil = Date.now() + 220;
        try { __tmApplyWhiteboardCardSelectionDom(''); } catch (e) {}
        render();
        if (!__tmStartWhiteboardStrokeDrag(ev, moveIds, docId)) {
            if (moveIds.length > 1) {
                try { __tmRenderWhiteboardMultiTools(__tmComputeWhiteboardMultiSelectionRect()); } catch (e) {}
            } else {
                try { __tmRenderWhiteboardStrokeTools(__tmComputeWhiteboardSelectedStrokeRect()); } catch (e) {}
            }
        }
        try { ev?.preventDefault?.(); ev?.stopPropagation?.(); } catch (e) {}
    };

    window.tmWhiteboardSetDrawingColor = function(color, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const c = String(color || '').trim();
        if (!/^#[0-9a-fA-F]{6}$/.test(c)) return;
        const tool = String(SettingsStore.data.whiteboardTool || 'pen').trim();
        if (tool === 'highlighter') __tmSetWhiteboardDrawingConfig({ highlighterColor: c });
        else __tmSetWhiteboardDrawingConfig({ penColor: c });
        state.whiteboardDrawingMoreColorsOpen = false;
        render();
    };

    function __tmUpdateWhiteboardWidthSliderTooltip(ev, width) {
        const target = ev?.target;
        if (!(target instanceof HTMLElement)) return;
        const n = Number(width);
        if (!Number.isFinite(n)) return;
        const value = String(Math.round(n * 10) / 10);
        const label = `${value}px`;
        try {
            if (typeof __tmApplyTooltipAttrsToElement === 'function') {
                __tmApplyTooltipAttrsToElement(target, label, { side: 'left' });
            } else {
                target.setAttribute('data-tm-floating-tooltip-label', label);
                target.setAttribute('data-tm-tooltip-side', 'left');
                target.setAttribute('data-tm-tooltip-align', 'center');
            }
        } catch (e) {}
        try {
            const wrap = target.closest('.tm-whiteboard-drawing-toolbar__widths');
            const valueEl = wrap?.querySelector?.('.tm-whiteboard-drawing-width-value');
            if (valueEl instanceof HTMLElement) valueEl.textContent = value;
        } catch (e) {}
        try {
            if (state.floatingTooltipTarget === target && typeof __tmShowFloatingTooltip === 'function') {
                __tmShowFloatingTooltip(target, label, { side: 'left' });
            }
        } catch (e) {}
    }

    window.tmWhiteboardSetDrawingWidth = function(width, ev, opts = {}) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const n = Number(width);
        if (!Number.isFinite(n)) return;
        __tmUpdateWhiteboardWidthSliderTooltip(ev, n);
        const o = (opts && typeof opts === 'object') ? opts : {};
        const tool = String(SettingsStore.data.whiteboardTool || 'pen').trim();
        if (tool === 'highlighter') __tmSetWhiteboardDrawingConfig({ highlighterWidth: n }, { persist: o.persist !== false });
        else if (tool === 'eraser') __tmSetWhiteboardDrawingConfig({ eraserWidth: n }, { persist: o.persist !== false });
        else __tmSetWhiteboardDrawingConfig({ penWidth: n }, { persist: o.persist !== false });
        if (o.render !== false) render();
    };

    window.tmWhiteboardToggleDrawingMoreColors = function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const next = !state.whiteboardDrawingMoreColorsOpen;
        state.whiteboardDrawingMoreColorsOpen = next;
        if (next) state.whiteboardDrawingActionsOpen = false;
        render();
    };

    window.tmWhiteboardToggleDrawingActions = function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const next = !state.whiteboardDrawingActionsOpen;
        state.whiteboardDrawingActionsOpen = next;
        if (next) state.whiteboardDrawingMoreColorsOpen = false;
        render();
    };

    window.tmWhiteboardToggleDrawingLayer = function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        state.whiteboardDrawingActionsOpen = false;
        state.whiteboardBottomMoreOpen = false;
        const cfg = __tmGetWhiteboardDrawingConfig();
        const nextHidden = !cfg.hidden;
        if (nextHidden && __tmIsWhiteboardDrawingTool()) {
            SettingsStore.data.whiteboardTool = 'pan';
        }
        __tmSetWhiteboardDrawingConfig({ hidden: nextHidden });
        render();
    };

    function __tmGetSelectedWhiteboardStrokeIds() {
        return Array.from(new Set([
            String(state.whiteboardSelectedStrokeId || '').trim(),
            ...(Array.isArray(state.whiteboardMultiSelectedStrokeIds) ? state.whiteboardMultiSelectedStrokeIds : []),
        ].map((id) => String(id || '').trim()).filter(Boolean)));
    }

    window.tmWhiteboardDeleteSelectedStrokes = function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        state.whiteboardDrawingActionsOpen = false;
        if (!__tmRequireWhiteboardDrawingFeature()) return;
        const ids = __tmGetSelectedWhiteboardStrokeIds();
        if (!ids.length) return;
        __tmDeleteWhiteboardStrokesByIds(ids, { render: true, persist: true });
    };

    window.tmWhiteboardClearDrawings = function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        state.whiteboardDrawingActionsOpen = false;
        if (!__tmIsWhiteboardDrawingEnabled()) return;
        if (!__tmRequireWhiteboardDrawingFeature()) return;
        const storage = __tmGetWhiteboardDrawingStorage();
        const docId = String(storage.docId || '').trim();
        if (!docId) return;
        const drawings = Array.isArray(storage.drawings) ? storage.drawings : [];
        const clearIds = drawings
            .filter((stroke) => storage.scope === 'global' || String(stroke?.docId || '').trim() === docId)
            .map((stroke) => String(stroke?.id || '').trim())
            .filter(Boolean);
        if (!clearIds.length) return;
        let ok = true;
        try { ok = window.confirm ? window.confirm('清空当前白板手写？') : true; } catch (e) { ok = true; }
        if (!ok) return;
        __tmClearWhiteboardStrokeSelection();
        __tmDeleteWhiteboardStrokesByIds(clearIds, { render: true, persist: true });
    };

    window.tmWhiteboardUndoDrawing = function(ev) {
        try { ev?.preventDefault?.(); ev?.stopPropagation?.(); } catch (e) {}
        if (!__tmRequireWhiteboardDrawingFeature()) return;
        __tmUndoWhiteboardDrawingChange({ render: true, persist: true });
    };

    window.tmWhiteboardZoomIn = function() {
        const v = __tmGetWhiteboardView();
        __tmSetWhiteboardView({ zoom: Math.min(2.5, v.zoom * 1.1) }, { persist: false });
        __tmApplyWhiteboardTransform();
        __tmScheduleWhiteboardViewSave();
    };

    window.tmWhiteboardZoomOut = function() {
        const v = __tmGetWhiteboardView();
        __tmSetWhiteboardView({ zoom: Math.max(0.35, v.zoom / 1.1) }, { persist: false });
        __tmApplyWhiteboardTransform();
        __tmScheduleWhiteboardViewSave();
    };

    function __tmFitWhiteboardToVisibleCards() {
        const viewport = state.modal?.querySelector?.('#tmWhiteboardViewport');
        const body = state.modal?.querySelector?.('#tmWhiteboardBody');
        if (!(viewport instanceof HTMLElement) || !(body instanceof HTMLElement)) return false;
        const nodes = Array.from(body.querySelectorAll('.tm-whiteboard-card[data-task-id],.tm-whiteboard-note'));
        if (!nodes.length) return false;
        const view = __tmGetWhiteboardView();
        const vr = viewport.getBoundingClientRect();
        const toWorldRect = (el) => {
            if (!(el instanceof HTMLElement)) return null;
            const r = el.getBoundingClientRect();
            if (!Number.isFinite(r.left) || !Number.isFinite(r.top) || r.width <= 0 || r.height <= 0) return null;
            const x = (r.left - vr.left - view.x) / view.zoom;
            const y = (r.top - vr.top - view.y) / view.zoom;
            const w = r.width / view.zoom;
            const h = r.height / view.zoom;
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return null;
            return { x, y, w, h };
        };
        const rects = nodes.map(toWorldRect).filter(Boolean);
        if (!rects.length) return false;
        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        rects.forEach((r) => {
            minX = Math.min(minX, r.x);
            minY = Math.min(minY, r.y);
            maxX = Math.max(maxX, r.x + r.w);
            maxY = Math.max(maxY, r.y + r.h);
        });
        if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return false;
        const pad = 48;
        const w = Math.max(1, maxX - minX);
        const h = Math.max(1, maxY - minY);
        const fitZoomW = (vr.width - pad * 2) / w;
        const fitZoomH = (vr.height - pad * 2) / h;
        const zoom = Math.max(0.35, Math.min(2.5, Math.min(fitZoomW, fitZoomH)));
        const cx = minX + w / 2;
        const cy = minY + h / 2;
        const x = (vr.width / 2) - (cx * zoom);
        const y = (vr.height / 2) - (cy * zoom);
        __tmSetWhiteboardView({ x, y, zoom }, { persist: false });
        __tmApplyWhiteboardTransform();
        __tmScheduleWhiteboardViewSave();
        return true;
    }

    window.tmWhiteboardResetView = function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        state.whiteboardBottomMoreOpen = false;
        if (!__tmFitWhiteboardToVisibleCards()) {
            __tmSetWhiteboardView({ x: 64, y: 40, zoom: 1 }, { persist: false });
            __tmApplyWhiteboardTransform();
            __tmScheduleWhiteboardViewSave();
        }
        try { render(); } catch (e) {}
    };

    window.tmWhiteboardToggleBottomMore = function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        state.whiteboardBottomMoreOpen = !state.whiteboardBottomMoreOpen;
        render();
    };

    function __tmRemoveWhiteboardMultiTools() {
        const viewport = state.modal?.querySelector?.('#tmWhiteboardViewport');
        if (!(viewport instanceof HTMLElement)) return;
        try { viewport.querySelectorAll('#tmWhiteboardMultiTools').forEach((el) => el.remove()); } catch (e) {}
    }

    function __tmRemoveWhiteboardStrokeTools() {
        const viewport = state.modal?.querySelector?.('#tmWhiteboardViewport');
        if (!(viewport instanceof HTMLElement)) return;
        try { viewport.querySelectorAll('#tmWhiteboardStrokeTools').forEach((el) => el.remove()); } catch (e) {}
    }

    function __tmApplyWhiteboardMultiSelectionDom() {
        const body = state.modal?.querySelector?.('#tmWhiteboardBody');
        if (!(body instanceof Element)) return;
        const taskSet = new Set((Array.isArray(state.whiteboardMultiSelectedTaskIds) ? state.whiteboardMultiSelectedTaskIds : []).map((x) => String(x || '').trim()).filter(Boolean));
        const noteSet = new Set((Array.isArray(state.whiteboardMultiSelectedNoteIds) ? state.whiteboardMultiSelectedNoteIds : []).map((x) => String(x || '').trim()).filter(Boolean));
        const linkSet = new Set((Array.isArray(state.whiteboardMultiSelectedLinkKeys) ? state.whiteboardMultiSelectedLinkKeys : []).map((x) => String(x || '').trim()).filter(Boolean));
        const strokeSet = new Set((Array.isArray(state.whiteboardMultiSelectedStrokeIds) ? state.whiteboardMultiSelectedStrokeIds : []).map((x) => String(x || '').trim()).filter(Boolean));
        try {
            body.querySelectorAll('.tm-whiteboard-multi-selected').forEach((el) => {
                try { el.classList.remove('tm-whiteboard-multi-selected'); } catch (e) {}
            });
        } catch (e) {}
        taskSet.forEach((id) => {
            try {
            const el = body.querySelector(`.tm-whiteboard-node[data-task-id="${CSS.escape(id)}"]`);
            if (el instanceof HTMLElement) el.classList.add('tm-whiteboard-multi-selected');
            } catch (e) {}
        });
        noteSet.forEach((id) => {
            try {
                const el = body.querySelector(`.tm-whiteboard-note[data-note-id="${CSS.escape(id)}"]`);
                if (el instanceof HTMLElement) el.classList.add('tm-whiteboard-multi-selected');
            } catch (e) {}
        });
        linkSet.forEach((key) => {
            const k = String(key || '').trim();
            if (!k) return;
            const idx = k.indexOf('::');
            if (idx <= 0) return;
            const did = k.slice(0, idx);
            const lid = k.slice(idx + 2);
            if (!did || !lid) return;
            try {
                const el = body.querySelector(`.tm-whiteboard-edge.tm-whiteboard-edge--manual[data-link-id="${CSS.escape(lid)}"][data-doc-id="${CSS.escape(did)}"]`);
                if (el instanceof Element) el.classList.add('tm-whiteboard-multi-selected');
            } catch (e) {}
        });
        strokeSet.forEach((id) => {
            try {
                const el = body.querySelector(`.tm-whiteboard-drawing-stroke[data-stroke-id="${CSS.escape(id)}"]`);
                if (el instanceof Element) el.classList.add('tm-whiteboard-multi-selected');
            } catch (e) {}
        });
    }

    function __tmComputeWhiteboardMultiSelectionRect() {
        const viewport = state.modal?.querySelector?.('#tmWhiteboardViewport');
        const body = state.modal?.querySelector?.('#tmWhiteboardBody');
        if (!(viewport instanceof HTMLElement) || !(body instanceof Element)) return null;
        const vr = viewport.getBoundingClientRect();
        const idsTask = Array.isArray(state.whiteboardMultiSelectedTaskIds) ? state.whiteboardMultiSelectedTaskIds : [];
        const idsNote = Array.isArray(state.whiteboardMultiSelectedNoteIds) ? state.whiteboardMultiSelectedNoteIds : [];
        const idsLink = Array.isArray(state.whiteboardMultiSelectedLinkKeys) ? state.whiteboardMultiSelectedLinkKeys : [];
        const idsStroke = Array.isArray(state.whiteboardMultiSelectedStrokeIds) ? state.whiteboardMultiSelectedStrokeIds : [];
        const targets = [];
        idsTask.forEach((id) => {
            const tid = String(id || '').trim();
            if (!tid) return;
            try {
                const el = body.querySelector(`.tm-whiteboard-node[data-task-id="${CSS.escape(tid)}"]`);
                if (el instanceof HTMLElement) targets.push(el);
            } catch (e) {}
        });
        idsNote.forEach((id) => {
            const nid = String(id || '').trim();
            if (!nid) return;
            try {
                const el = body.querySelector(`.tm-whiteboard-note[data-note-id="${CSS.escape(nid)}"]`);
                if (el instanceof HTMLElement) targets.push(el);
            } catch (e) {}
        });
        idsLink.forEach((key) => {
            const k = String(key || '').trim();
            if (!k) return;
            const idx = k.indexOf('::');
            if (idx <= 0) return;
            const did = k.slice(0, idx);
            const lid = k.slice(idx + 2);
            if (!did || !lid) return;
            try {
                const el = body.querySelector(`.tm-whiteboard-edge.tm-whiteboard-edge--manual[data-link-id="${CSS.escape(lid)}"][data-doc-id="${CSS.escape(did)}"]`);
                if (el instanceof Element) targets.push(el);
            } catch (e) {}
        });
        idsStroke.forEach((id) => {
            const sid = String(id || '').trim();
            if (!sid) return;
            try {
                const el = body.querySelector(`.tm-whiteboard-drawing-stroke[data-stroke-id="${CSS.escape(sid)}"]`);
                if (el instanceof SVGGraphicsElement) targets.push(el);
            } catch (e) {}
        });
        if (!targets.length) return null;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        targets.forEach((el) => {
            try {
                const r = el.getBoundingClientRect();
                minX = Math.min(minX, r.left - vr.left);
                minY = Math.min(minY, r.top - vr.top);
                maxX = Math.max(maxX, r.right - vr.left);
                maxY = Math.max(maxY, r.bottom - vr.top);
            } catch (e) {}
        });
        if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
        return { x: minX, y: minY, w: Math.max(0, maxX - minX), h: Math.max(0, maxY - minY) };
    }

    function __tmClearWhiteboardMultiSelection() {
        state.whiteboardMultiSelectedTaskIds = [];
        state.whiteboardMultiSelectedNoteIds = [];
        state.whiteboardMultiSelectedLinkKeys = [];
        state.whiteboardMultiSelectedStrokeIds = [];
        state.whiteboardSelectedStrokeId = '';
        __tmRemoveWhiteboardStrokeTools();
        __tmApplyWhiteboardMultiSelectionDom();
        __tmRemoveWhiteboardMultiTools();
    }

    function __tmRenderWhiteboardMultiTools(rect) {
        const viewport = state.modal?.querySelector?.('#tmWhiteboardViewport');
        if (!(viewport instanceof HTMLElement)) return;
        __tmRemoveWhiteboardMultiTools();
        const taskCount = Array.isArray(state.whiteboardMultiSelectedTaskIds) ? state.whiteboardMultiSelectedTaskIds.length : 0;
        const noteCount = Array.isArray(state.whiteboardMultiSelectedNoteIds) ? state.whiteboardMultiSelectedNoteIds.length : 0;
        const linkCount = Array.isArray(state.whiteboardMultiSelectedLinkKeys) ? state.whiteboardMultiSelectedLinkKeys.length : 0;
        const strokeCount = Array.isArray(state.whiteboardMultiSelectedStrokeIds) ? state.whiteboardMultiSelectedStrokeIds.length : 0;
        const total = taskCount + noteCount + linkCount + strokeCount;
        if (total <= 0) return;
        const fallbackRect = __tmComputeWhiteboardMultiSelectionRect();
        const rr = (rect && Number.isFinite(Number(rect.x)) && Number.isFinite(Number(rect.y)))
            ? rect
            : (fallbackRect || { x: 24, y: 40, w: 120, h: 40 });
        const x = Number(rr?.x);
        const y = Number(rr?.y);
        const w = Number(rr?.w);
        const top = Number.isFinite(y) ? Math.max(12, y - 8) : 20;
        const left = Number.isFinite(x) && Number.isFinite(w) ? (x + w / 2) : 120;
        const tools = document.createElement('div');
        tools.id = 'tmWhiteboardMultiTools';
        tools.className = 'tm-whiteboard-multi-tools';
        tools.style.left = `${left}px`;
        tools.style.top = `${top}px`;
        tools.innerHTML = `
            <button class="tm-btn tm-btn-info" style="padding:2px 8px;font-size:12px;" title="按行自动连线">自动连线</button>
            <button class="tm-btn tm-btn-danger" style="padding:2px 8px;font-size:12px;" title="移除框选对象">移除(${total})</button>
        `;
        const connectBtn = tools.querySelector('button.tm-btn-info');
        if (connectBtn instanceof HTMLButtonElement) {
            connectBtn.addEventListener('click', (ev) => {
                try { ev.stopPropagation(); } catch (e) {}
                try { window.tmWhiteboardAutoConnectMultiSelected?.(ev); } catch (e) {}
            });
        }
        const btn = tools.querySelector('button.tm-btn-danger');
        if (btn instanceof HTMLButtonElement) {
            btn.addEventListener('click', (ev) => {
                try { ev.stopPropagation(); } catch (e) {}
                try { window.tmWhiteboardDeleteMultiSelected?.(ev); } catch (e) {}
            });
        }
        try { viewport.appendChild(tools); } catch (e) {}
    }

    function __tmComputeWhiteboardSelectedStrokeRect() {
        const viewport = state.modal?.querySelector?.('#tmWhiteboardViewport');
        const body = state.modal?.querySelector?.('#tmWhiteboardBody');
        if (!(viewport instanceof HTMLElement) || !(body instanceof Element)) return null;
        const id = String(state.whiteboardSelectedStrokeId || '').trim();
        if (!id) return null;
        try {
            const el = body.querySelector(`.tm-whiteboard-drawing-stroke[data-stroke-id="${CSS.escape(id)}"]`);
            if (!(el instanceof SVGGraphicsElement)) return null;
            const vr = viewport.getBoundingClientRect();
            const r = el.getBoundingClientRect();
            return {
                x: r.left - vr.left,
                y: r.top - vr.top,
                w: Math.max(0, r.width),
                h: Math.max(0, r.height),
            };
        } catch (e) {
            return null;
        }
    }

    function __tmRenderWhiteboardStrokeTools(rect) {
        const viewport = state.modal?.querySelector?.('#tmWhiteboardViewport');
        if (!(viewport instanceof HTMLElement)) return;
        __tmRemoveWhiteboardStrokeTools();
        if (!String(state.whiteboardSelectedStrokeId || '').trim()) return;
        const rr = (rect && Number.isFinite(Number(rect.x)) && Number.isFinite(Number(rect.y)))
            ? rect
            : (__tmComputeWhiteboardSelectedStrokeRect() || null);
        if (!rr) return;
        const x = Number(rr.x);
        const y = Number(rr.y);
        const w = Number(rr.w);
        const top = Number.isFinite(y) ? Math.max(12, y - 8) : 20;
        const left = Number.isFinite(x) && Number.isFinite(w) ? (x + w / 2) : 120;
        const tools = document.createElement('div');
        tools.id = 'tmWhiteboardStrokeTools';
        tools.className = 'tm-whiteboard-multi-tools tm-whiteboard-stroke-tools';
        tools.style.left = `${left}px`;
        tools.style.top = `${top}px`;
        tools.innerHTML = `<button class="tm-btn tm-btn-danger" style="padding:2px 8px;font-size:12px;" title="移除选中笔画">移除</button>`;
        const btn = tools.querySelector('button');
        if (btn instanceof HTMLButtonElement) {
            btn.addEventListener('click', (ev) => {
                try { ev.stopPropagation(); } catch (e) {}
                try { window.tmWhiteboardDeleteSelectedStrokes?.(ev); } catch (e) {}
            });
        }
        tools.addEventListener('click', (ev) => {
            try { ev.stopPropagation(); } catch (e) {}
        });
        try { viewport.appendChild(tools); } catch (e) {}
    }

    window.tmWhiteboardViewportWheel = function(ev) {
        if (state.viewMode !== 'whiteboard') return;
        const viewport = state.modal?.querySelector?.('#tmWhiteboardViewport');
        if (!(viewport instanceof HTMLElement)) return;
        const rect = viewport.getBoundingClientRect();
        const px = Number(ev?.clientX) - rect.left;
        const py = Number(ev?.clientY) - rect.top;
        const v = __tmGetWhiteboardView();
        const factor = Number(ev?.deltaY) > 0 ? 0.92 : 1.08;
        const nextZoom = Math.max(0.35, Math.min(2.5, v.zoom * factor));
        const wx = (px - v.x) / v.zoom;
        const wy = (py - v.y) / v.zoom;
        const nextX = px - wx * nextZoom;
        const nextY = py - wy * nextZoom;
        __tmSetWhiteboardView({ x: nextX, y: nextY, zoom: nextZoom }, { persist: false });
        __tmApplyWhiteboardTransform();
        __tmScheduleWhiteboardViewSave();
    };

    function __tmBuildWhiteboardTouchPanSession(viewport, touchLike, options = {}) {
        const t = touchLike || {};
        const v = __tmGetWhiteboardView();
        return {
            mode: 'pan',
            viewport,
            startClientX: Number(t.clientX) || 0,
            startClientY: Number(t.clientY) || 0,
            startX: Number(v.x) || 0,
            startY: Number(v.y) || 0,
            card: options.card instanceof HTMLElement ? options.card : null,
            moved: options.moved === true,
        };
    }

    function __tmBuildWhiteboardTouchPinchSession(viewport, touchA, touchB, options = {}) {
        const t1 = touchA || {};
        const t2 = touchB || {};
        const rect = viewport.getBoundingClientRect();
        const cxClient = ((Number(t1.clientX) || 0) + (Number(t2.clientX) || 0)) / 2;
        const cyClient = ((Number(t1.clientY) || 0) + (Number(t2.clientY) || 0)) / 2;
        const dx = (Number(t2.clientX) || 0) - (Number(t1.clientX) || 0);
        const dy = (Number(t2.clientY) || 0) - (Number(t1.clientY) || 0);
        const dist = Math.max(1, Math.hypot(dx, dy));
        const v = __tmGetWhiteboardView();
        const startZoom = Math.max(0.01, Number(v.zoom) || 1);
        const cx = cxClient - rect.left;
        const cy = cyClient - rect.top;
        return {
            mode: 'pinch',
            viewport,
            startDist: dist,
            startZoom,
            anchorWx: (cx - (Number(v.x) || 0)) / startZoom,
            anchorWy: (cy - (Number(v.y) || 0)) / startZoom,
            card: options.card instanceof HTMLElement ? options.card : null,
            moved: options.moved === true,
        };
    }

    window.tmWhiteboardViewportTouchStart = function(ev) {
        if (state.viewMode !== 'whiteboard') return;
        const tool = String(SettingsStore.data.whiteboardTool || 'pan').trim();
        const viewport = state.modal?.querySelector?.('#tmWhiteboardViewport');
        if (!(viewport instanceof HTMLElement)) return;
        const target = ev?.target;
        const card = target && target.closest ? target.closest('.tm-whiteboard-node') : null;
        if (tool !== 'pan' && !(tool === 'select' && card instanceof HTMLElement)) return;
        if (target && target.closest && target.closest('.tm-task-link-dot')) return;
        if (!card && target && target.closest && target.closest('.tm-whiteboard-sidebar,.tm-whiteboard-bottom-toolbar,.tm-whiteboard-navigator,.tm-whiteboard-navigator-reveal,.tm-btn,input,button,select,textarea,label,a,.tm-whiteboard-doc-resize,.tm-task-link-dot,.tm-whiteboard-card-tools,.tm-whiteboard-note-tools,.tm-whiteboard-link-tools,.tm-whiteboard-note-editor,.tm-whiteboard-sticky-editor,.tm-whiteboard-pool-item')) return;
        const touches = ev?.touches;
        const n = Number(touches?.length) || 0;
        if (n <= 0) return;
        if (n >= 2) {
            state.whiteboardTouchSession = __tmBuildWhiteboardTouchPinchSession(viewport, touches[0], touches[1], { card });
        } else {
            state.whiteboardTouchSession = __tmBuildWhiteboardTouchPanSession(viewport, touches[0], { card });
        }
        try { viewport.classList.add('tm-whiteboard-viewport--panning', 'tm-whiteboard-viewport--moving'); } catch (e) {}
    };

    window.tmWhiteboardViewportTouchMove = function(ev) {
        if (state.viewMode !== 'whiteboard') return;
        const s = state.whiteboardTouchSession;
        if (!s || typeof s !== 'object') return;
        const viewport = state.modal?.querySelector?.('#tmWhiteboardViewport');
        if (!(viewport instanceof HTMLElement)) return;
        const touches = ev?.touches;
        const n = Number(touches?.length) || 0;
        if (n <= 0) return;
        if (n >= 2) {
            if (s.mode !== 'pinch') {
                state.whiteboardTouchSession = __tmBuildWhiteboardTouchPinchSession(viewport, touches[0], touches[1], { card: s.card, moved: s.moved });
                return;
            }
            const t1 = touches[0];
            const t2 = touches[1];
            const rect = viewport.getBoundingClientRect();
            const cxClient = ((Number(t1?.clientX) || 0) + (Number(t2?.clientX) || 0)) / 2;
            const cyClient = ((Number(t1?.clientY) || 0) + (Number(t2?.clientY) || 0)) / 2;
            const cx = cxClient - rect.left;
            const cy = cyClient - rect.top;
            const dx = (Number(t2?.clientX) || 0) - (Number(t1?.clientX) || 0);
            const dy = (Number(t2?.clientY) || 0) - (Number(t1?.clientY) || 0);
            const dist = Math.max(1, Math.hypot(dx, dy));
            const ratio = dist / Math.max(1, Number(s.startDist) || 1);
            const nextZoom = Math.max(0.35, Math.min(2.5, (Number(s.startZoom) || 1) * ratio));
            const nextX = cx - (Number(s.anchorWx) || 0) * nextZoom;
            const nextY = cy - (Number(s.anchorWy) || 0) * nextZoom;
            s.moved = true;
            __tmSetWhiteboardView({ x: nextX, y: nextY, zoom: nextZoom }, { persist: false });
            __tmApplyWhiteboardTransform();
            return;
        }
        const t = touches[0];
        if (s.mode !== 'pan') {
            state.whiteboardTouchSession = __tmBuildWhiteboardTouchPanSession(viewport, t, { card: s.card, moved: s.moved });
            return;
        }
        const dx = (Number(t?.clientX) || 0) - (Number(s.startClientX) || 0);
        const dy = (Number(t?.clientY) || 0) - (Number(s.startClientY) || 0);
        if (!s.moved && (dx * dx + dy * dy) > 16) s.moved = true;
        __tmSetWhiteboardView({ x: (Number(s.startX) || 0) + dx, y: (Number(s.startY) || 0) + dy }, { persist: false });
        __tmApplyWhiteboardTransform();
    };

    window.tmWhiteboardViewportTouchEnd = function(ev) {
        if (state.viewMode !== 'whiteboard') return;
        const s = state.whiteboardTouchSession;
        if (!s || typeof s !== 'object') return;
        const viewport = state.modal?.querySelector?.('#tmWhiteboardViewport');
        const touches = ev?.touches;
        const n = Number(touches?.length) || 0;
        if (n <= 0) {
            state.whiteboardTouchSession = null;
            try { viewport?.classList?.remove?.('tm-whiteboard-viewport--panning', 'tm-whiteboard-viewport--moving'); } catch (e) {}
            if (s.moved && s.card instanceof HTMLElement) {
                __tmSuppressNextWhiteboardCardClick(s.card, 700);
            }
            __tmScheduleWhiteboardViewSave();
            return;
        }
        if (!(viewport instanceof HTMLElement)) {
            state.whiteboardTouchSession = null;
            __tmScheduleWhiteboardViewSave();
            return;
        }
        if (n >= 2) {
            state.whiteboardTouchSession = __tmBuildWhiteboardTouchPinchSession(viewport, touches[0], touches[1], { card: s.card, moved: s.moved });
            return;
        }
        state.whiteboardTouchSession = __tmBuildWhiteboardTouchPanSession(viewport, touches[0], { card: s.card, moved: s.moved });
    };

    function __tmStartWhiteboardFrameCreate(ev, viewport) {
        if (!(viewport instanceof HTMLElement)) return false;
        const target = ev?.target;
        if (target && target.closest && target.closest('.tm-whiteboard-frame,.tm-whiteboard-frame-tools,.tm-btn,input,button,select,textarea,label,a')) return false;
        if (!__tmRequireWhiteboardFrameFeature()) return false;
        const activeDocId = String(state.activeDocId || '').trim();
        const singleDocCanvas = !!activeDocId && activeDocId !== 'all';
        const start = __tmResolveWhiteboardCreatePointerInfo(ev, singleDocCanvas ? activeDocId : '');
        if (!start) return false;
        let docBody = start.body;
        if (!(docBody instanceof HTMLElement)) return false;
        const pointerId = Number.isFinite(Number(ev?.pointerId)) ? Number(ev.pointerId) : null;
        const draft = document.createElement('div');
        draft.className = 'tm-whiteboard-frame tm-whiteboard-frame--draft';
        draft.style.left = `${Math.round(start.localX)}px`;
        draft.style.top = `${Math.round(start.localY)}px`;
        draft.style.width = '1px';
        draft.style.height = '1px';
        draft.style.setProperty('--tm-whiteboard-frame-bg', '#dbeafe');
        draft.innerHTML = '<div class="tm-whiteboard-frame-title">分组</div>';
        try { docBody.appendChild(draft); } catch (e) {}
        const allowNegativeRect = singleDocCanvas || __tmIsWhiteboardGlobalElement(docBody);
        const resolveRect = (clientX, clientY, opts = {}) => {
            const p = __tmResolveWhiteboardCreatePointerInfo({ clientX, clientY }, start.docId)
                || __tmResolveWhiteboardPointerInfo({ clientX, clientY }, start.docId)
                || __tmTrackWhiteboardPointerFromClient(clientX, clientY, start.docId)
                || start;
            const enforceMin = opts.enforceMin === true;
            const nextLocalX = Number.isFinite(Number(p?.localX)) ? Number(p.localX) : Number(p?.x);
            const nextLocalY = Number.isFinite(Number(p?.localY)) ? Number(p.localY) : Number(p?.y);
            const x2 = Number.isFinite(nextLocalX) ? nextLocalX : start.localX;
            const y2 = Number.isFinite(nextLocalY) ? nextLocalY : start.localY;
            let x = Math.min(start.localX, x2);
            let y = Math.min(start.localY, y2);
            let w = Math.abs(x2 - start.localX);
            let h = Math.abs(y2 - start.localY);
            if (!enforceMin) {
                w = Math.max(1, w);
                h = Math.max(1, h);
            }
            if (enforceMin && w < 80) {
                w = 80;
                x = x2 < start.localX ? start.localX - 80 : start.localX;
            }
            if (enforceMin && h < 60) {
                h = 60;
                y = y2 < start.localY ? start.localY - 60 : start.localY;
            }
            return {
                x: allowNegativeRect ? Math.round(x) : Math.max(0, Math.round(x)),
                y: allowNegativeRect ? Math.round(y) : Math.max(0, Math.round(y)),
                w: Math.round(w),
                h: Math.round(h),
            };
        };
        let rect = { x: start.localX, y: start.localY, w: 1, h: 1 };
        const applyDraft = (nextRect) => {
            rect = nextRect;
            draft.style.left = `${rect.x}px`;
            draft.style.top = `${rect.y}px`;
            draft.style.width = `${rect.w}px`;
            draft.style.height = `${rect.h}px`;
        };
        const cleanup = () => {
            try { document.removeEventListener('mousemove', onMove, true); } catch (e) {}
            try { document.removeEventListener('mouseup', onUp, true); } catch (e) {}
            try { document.removeEventListener('pointermove', onMove, true); } catch (e) {}
            try { document.removeEventListener('pointerup', onUp, true); } catch (e) {}
            try { document.removeEventListener('pointercancel', onUp, true); } catch (e) {}
            if (pointerId !== null && typeof viewport.releasePointerCapture === 'function') {
                try { viewport.releasePointerCapture(pointerId); } catch (e) {}
            }
            state.whiteboardFrameCreate = null;
        };
        const onMove = (e2) => {
            if (pointerId !== null && Number(e2?.pointerId) !== pointerId) return;
            try { e2?.preventDefault?.(); } catch (e) {}
            applyDraft(resolveRect(Number(e2?.clientX) || start.clientX, Number(e2?.clientY) || start.clientY));
            state.whiteboardFrameCreate = { docId: start.docId, rect };
        };
        const onUp = async (eUp) => {
            if (pointerId !== null && Number(eUp?.pointerId) !== pointerId) return;
            applyDraft(resolveRect(Number(eUp?.clientX) || start.clientX, Number(eUp?.clientY) || start.clientY, { enforceMin: true }));
            cleanup();
            const stored = __tmWhiteboardFrameDisplayRectToStored(rect, docBody);
            const now = String(Date.now());
            const frameId = `tm_frame_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
            const frame = {
                id: frameId,
                docId: start.docId,
                name: '分组',
                backgroundColor: '#dbeafe',
                x: stored.x,
                y: stored.y,
                w: stored.w,
                h: stored.h,
                memberTaskIds: [],
                memberNoteIds: [],
                memberStrokeIds: [],
                createdAt: now,
                updatedAt: now,
            };
            const members = __tmCollectWhiteboardFrameMembers(frame, docBody);
            try { draft.remove(); } catch (e) {}
            const storage = __tmGetWhiteboardFrameStorage();
            const frames = __tmApplyWhiteboardFrameOwnership([...storage.frames, frame], frameId, members, { clearTarget: true });
            __tmPushWhiteboardHistorySnapshot('add-frame');
            __tmSaveWhiteboardFrameStorage(storage, frames, { persist: true });
            __tmClearWhiteboardMultiSelection();
            __tmClearWhiteboardStrokeSelection();
            state.whiteboardSelectedTaskId = '';
            state.whiteboardSelectedNoteId = '';
            state.whiteboardSelectedFrameId = frameId;
            state.whiteboardSelectedLinkId = '';
            state.whiteboardSelectedLinkDocId = '';
            __tmApplyWhiteboardCardSelectionDom('');
            state.whiteboardSuppressClickUntil = Date.now() + 260;
            render();
        };
        state.whiteboardFrameCreate = { docId: start.docId, rect };
        if (pointerId !== null && typeof viewport.setPointerCapture === 'function') {
            try { viewport.setPointerCapture(pointerId); } catch (e) {}
        }
        try { document.addEventListener('mousemove', onMove, true); } catch (e) {}
        try { document.addEventListener('mouseup', onUp, true); } catch (e) {}
        try { document.addEventListener('pointermove', onMove, true); } catch (e) {}
        try { document.addEventListener('pointerup', onUp, true); } catch (e) {}
        try { document.addEventListener('pointercancel', onUp, true); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
        return true;
    }

    window.tmWhiteboardViewportMouseDown = function(ev) {
        if (state.viewMode !== 'whiteboard') {
            __tmWhiteboardDebugLog('viewport:pointerdown-skip', { reason: 'viewMode', event: __tmWhiteboardDebugEventInfo(ev) });
            return;
        }
        const activeTool = String(SettingsStore.data.whiteboardTool || 'pan').trim();
        if (__tmIsWhiteboardDrawingTool(activeTool) && __tmStartWhiteboardDrawingPointer(ev)) {
            return;
        }
        const pType = String(ev?.pointerType || '').toLowerCase();
        if (pType === 'touch') {
            __tmWhiteboardDebugLog('viewport:pointerdown-skip', { reason: 'touch-pointer', event: __tmWhiteboardDebugEventInfo(ev) });
            return;
        }
        const button = Number(ev?.button);
        const rightButtonPan = button === 2;
        if (button !== 0 && !rightButtonPan) {
            __tmWhiteboardDebugLog('viewport:pointerdown-skip', { reason: 'unsupported-button', event: __tmWhiteboardDebugEventInfo(ev) });
            return;
        }
        const tool = activeTool;
        const panMode = rightButtonPan || tool === 'pan';
        const selectMode = !rightButtonPan && tool === 'select';
        const frameMode = !rightButtonPan && tool === 'frame';
        const target = ev?.target;
        const viewport = state.modal?.querySelector?.('#tmWhiteboardViewport');
        if (!(viewport instanceof HTMLElement)) {
            __tmWhiteboardDebugLog('viewport:pointerdown-skip', { reason: 'missing-viewport', event: __tmWhiteboardDebugEventInfo(ev) });
            return;
        }
        __tmWhiteboardDebugLog('viewport:pointerdown', {
            panMode,
            selectMode,
            frameMode,
            rightButtonPan,
            global: typeof __tmIsWhiteboardGlobalCanvasActive === 'function' && __tmIsWhiteboardGlobalCanvasActive(),
            event: __tmWhiteboardDebugEventInfo(ev),
        });
        if (target && target.closest) {
            if (panMode) {
                const blocked = target.closest('.tm-whiteboard-sidebar,.tm-whiteboard-bottom-toolbar,.tm-whiteboard-navigator,.tm-whiteboard-navigator-reveal,.tm-btn,input,button,select,textarea,label,a,.tm-whiteboard-doc-resize,.tm-task-link-dot,.tm-task-content-clickable,.tm-task-checkbox,.tm-kanban-chip,.tm-status-tag,.tm-priority-jira,.tm-kanban-priority-chip,.tm-whiteboard-card-tools,.tm-whiteboard-note-tools,.tm-whiteboard-link-tools,.tm-whiteboard-edge,.tm-whiteboard-node,.tm-whiteboard-note,.tm-whiteboard-note-editor,.tm-whiteboard-sticky-editor,.tm-whiteboard-doc-head');
                if (blocked) {
                    __tmWhiteboardDebugLog('viewport:pointerdown-skip', {
                        reason: 'pan-blocked-target',
                        blockedBy: __tmWhiteboardDebugElementLabel(blocked),
                        event: __tmWhiteboardDebugEventInfo(ev),
                    });
                    return;
                }
            } else if (selectMode) {
                const blocked = target.closest('.tm-whiteboard-node,.tm-task-link-dot,.tm-task-checkbox,.tm-whiteboard-navigator,.tm-whiteboard-navigator-reveal,.tm-btn,.tm-task-content-clickable,.tm-whiteboard-note,.tm-whiteboard-note-editor,.tm-whiteboard-sticky-editor,.tm-whiteboard-edge,.tm-whiteboard-link-tools,.tm-whiteboard-pool-item,.tm-whiteboard-doc-resize,.tm-whiteboard-doc-head,input,button,select,textarea,label,a');
                if (blocked) {
                    __tmWhiteboardDebugLog('viewport:pointerdown-skip', {
                        reason: 'select-blocked-target',
                        blockedBy: __tmWhiteboardDebugElementLabel(blocked),
                        event: __tmWhiteboardDebugEventInfo(ev),
                    });
                    return;
                }
            } else if (frameMode) {
                const blocked = target.closest('.tm-whiteboard-node,.tm-task-link-dot,.tm-task-checkbox,.tm-whiteboard-navigator,.tm-whiteboard-navigator-reveal,.tm-btn,.tm-task-content-clickable,.tm-whiteboard-note,.tm-whiteboard-note-editor,.tm-whiteboard-sticky-editor,.tm-whiteboard-frame,.tm-whiteboard-edge,.tm-whiteboard-link-tools,.tm-whiteboard-pool-item,.tm-whiteboard-doc-resize,.tm-whiteboard-doc-head,input,button,select,textarea,label,a');
                if (blocked) {
                    __tmWhiteboardDebugLog('viewport:pointerdown-skip', {
                        reason: 'frame-blocked-target',
                        blockedBy: __tmWhiteboardDebugElementLabel(blocked),
                        event: __tmWhiteboardDebugEventInfo(ev),
                    });
                    return;
                }
            } else {
                __tmWhiteboardDebugLog('viewport:pointerdown-skip', { reason: 'tool-not-pan-select-or-frame', event: __tmWhiteboardDebugEventInfo(ev) });
                return;
            }
        }

        if (frameMode) {
            if (__tmStartWhiteboardFrameCreate(ev, viewport)) return;
            __tmWhiteboardDebugLog('viewport:frame-create-skip', { reason: 'no-doc-body', event: __tmWhiteboardDebugEventInfo(ev) });
            return;
        }

        if (selectMode) {
            const vr = viewport.getBoundingClientRect();
            const sx = Number(ev?.clientX) || 0;
            const sy = Number(ev?.clientY) || 0;
            let lastCx = sx;
            let lastCy = sy;
            let started = false;
            let rect = { x: 0, y: 0, w: 0, h: 0 };
            const pointerId = Number.isFinite(Number(ev?.pointerId)) ? Number(ev.pointerId) : null;
            const marquee = document.createElement('div');
            marquee.className = 'tm-whiteboard-marquee';
            marquee.style.left = `${sx - vr.left}px`;
            marquee.style.top = `${sy - vr.top}px`;
            marquee.style.width = '0px';
            marquee.style.height = '0px';
            try { viewport.appendChild(marquee); } catch (e) {}

            state.whiteboardSelectedTaskId = '';
            state.whiteboardSelectedNoteId = '';
            __tmApplyWhiteboardCardSelectionDom('');
            state.whiteboardSelectedLinkId = '';
            state.whiteboardSelectedLinkDocId = '';
            __tmScheduleWhiteboardEdgeRedraw();
            __tmClearWhiteboardMultiSelection();

            const computeRect = (cx, cy) => {
                const x1 = Math.min(sx, cx) - vr.left;
                const y1 = Math.min(sy, cy) - vr.top;
                const x2 = Math.max(sx, cx) - vr.left;
                const y2 = Math.max(sy, cy) - vr.top;
                return { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
            };
            const intersects = (a, b) => !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
            const centerIn = (r, rr) => {
                const cx = rr.left + rr.width / 2;
                const cy = rr.top + rr.height / 2;
                return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
            };
            const applySelection = (r) => {
                const sel = {
                    left: vr.left + r.x,
                    top: vr.top + r.y,
                    right: vr.left + r.x + r.w,
                    bottom: vr.top + r.y + r.h,
                };
                const body = state.modal?.querySelector?.('#tmWhiteboardBody');
                const taskIds = [];
                const noteIds = [];
                const linkKeys = [];
                const strokeIds = [];
                if (body instanceof Element) {
                    try {
                        body.querySelectorAll('.tm-whiteboard-node[data-task-id]').forEach((el) => {
                            if (!(el instanceof HTMLElement)) return;
                            const rr = el.getBoundingClientRect();
                            if (intersects(sel, rr) || centerIn(sel, rr)) {
                                const id = String(el.getAttribute('data-task-id') || '').trim();
                                if (id) taskIds.push(id);
                            }
                        });
                    } catch (e) {}
                    try {
                        body.querySelectorAll('.tm-whiteboard-note[data-note-id]').forEach((el) => {
                            if (!(el instanceof HTMLElement)) return;
                            const rr = el.getBoundingClientRect();
                            if (intersects(sel, rr) || centerIn(sel, rr)) {
                                const id = String(el.getAttribute('data-note-id') || '').trim();
                                if (id) noteIds.push(id);
                            }
                        });
                    } catch (e) {}
                    try {
                        body.querySelectorAll('.tm-whiteboard-edge.tm-whiteboard-edge--manual[data-link-id][data-doc-id]').forEach((el) => {
                            if (!(el instanceof Element)) return;
                            const rr = el.getBoundingClientRect();
                            if (intersects(sel, rr) || centerIn(sel, rr)) {
                                const lid = String(el.getAttribute('data-link-id') || '').trim();
                                const did = String(el.getAttribute('data-doc-id') || '').trim();
                                if (lid && did) linkKeys.push(`${did}::${lid}`);
                            }
                        });
                    } catch (e) {}
                    try {
                        body.querySelectorAll('.tm-whiteboard-drawing-stroke[data-stroke-id]').forEach((el) => {
                            if (!(el instanceof SVGGraphicsElement)) return;
                            const rr = el.getBoundingClientRect();
                            if (intersects(sel, rr) || centerIn(sel, rr)) {
                                const id = String(el.getAttribute('data-stroke-id') || '').trim();
                                if (id) strokeIds.push(id);
                            }
                        });
                    } catch (e) {}
                }
                state.whiteboardMultiSelectedTaskIds = Array.from(new Set(taskIds));
                state.whiteboardMultiSelectedNoteIds = Array.from(new Set(noteIds));
                state.whiteboardMultiSelectedLinkKeys = Array.from(new Set(linkKeys));
                state.whiteboardMultiSelectedStrokeIds = Array.from(new Set(strokeIds));
                state.whiteboardSelectedStrokeId = '';
                __tmApplyWhiteboardMultiSelectionDom();
            };

            const cleanup = () => {
                try { marquee.remove(); } catch (e) {}
                try { document.removeEventListener('pointermove', onMove, true); } catch (e) {}
                try { document.removeEventListener('pointerup', onUp, true); } catch (e) {}
                try { document.removeEventListener('pointercancel', onUp, true); } catch (e) {}
                if (pointerId !== null && typeof viewport.releasePointerCapture === 'function') {
                    try { viewport.releasePointerCapture(pointerId); } catch (e) {}
                }
                state.whiteboardMarqueeSession = null;
            };

            const onMove = (e2) => {
                if (pointerId !== null && Number(e2?.pointerId) !== pointerId) return;
                const cx = Number(e2?.clientX) || lastCx;
                const cy = Number(e2?.clientY) || lastCy;
                lastCx = cx;
                lastCy = cy;
                rect = computeRect(cx, cy);
                if (!started && (rect.w > 2 || rect.h > 2)) started = true;
                marquee.style.left = `${rect.x}px`;
                marquee.style.top = `${rect.y}px`;
                marquee.style.width = `${rect.w}px`;
                marquee.style.height = `${rect.h}px`;
                if (started) applySelection(rect);
                state.whiteboardMarqueeSession = { sx, sy, marquee, viewport, rect };
            };

            const onUp = (e2) => {
                if (pointerId !== null && Number(e2?.pointerId) !== pointerId) return;
                const cx = Number(e2?.clientX);
                const cy = Number(e2?.clientY);
                if (Number.isFinite(cx) && Number.isFinite(cy)) rect = computeRect(cx, cy);
                if (!started && (rect.w > 2 || rect.h > 2)) started = true;
                if (started) {
                    applySelection(rect);
                    __tmRenderWhiteboardMultiTools(__tmComputeWhiteboardMultiSelectionRect() || rect);
                    if ((rect.w > 3 || rect.h > 3)
                        || (Array.isArray(state.whiteboardMultiSelectedTaskIds) && state.whiteboardMultiSelectedTaskIds.length)
                        || (Array.isArray(state.whiteboardMultiSelectedNoteIds) && state.whiteboardMultiSelectedNoteIds.length)
                        || (Array.isArray(state.whiteboardMultiSelectedLinkKeys) && state.whiteboardMultiSelectedLinkKeys.length)
                        || (Array.isArray(state.whiteboardMultiSelectedStrokeIds) && state.whiteboardMultiSelectedStrokeIds.length)) {
                        state.whiteboardSuppressClickUntil = Date.now() + 260;
                    }
                }
                cleanup();
            };

            if (pointerId !== null && typeof viewport.setPointerCapture === 'function') {
                try { viewport.setPointerCapture(pointerId); } catch (e) {}
            }
            try { document.addEventListener('pointermove', onMove, true); } catch (e) {}
            try { document.addEventListener('pointerup', onUp, true); } catch (e) {}
            try { document.addEventListener('pointercancel', onUp, true); } catch (e) {}
            try { ev?.preventDefault?.(); } catch (e) {}
            return;
        }

        if (!panMode) {
            __tmWhiteboardDebugLog('viewport:pan-skip', { reason: 'not-pan-mode', event: __tmWhiteboardDebugEventInfo(ev) });
            return;
        }
        try {
            const old = state.whiteboardPanSession;
            if (old && typeof old.cleanup === 'function') old.cleanup();
        } catch (e) {}
        const v0 = __tmGetWhiteboardView();
        const pointerId = Number(ev?.pointerId);
        const hasPointerId = Number.isFinite(pointerId);
        state.whiteboardPanSession = {
            startClientX: Number(ev?.clientX) || 0,
            startClientY: Number(ev?.clientY) || 0,
            startX: v0.x,
            startY: v0.y,
            pointerId: hasPointerId ? pointerId : null,
            rightButtonPan,
            debugMoveCount: 0,
        };
        if (rightButtonPan) state.whiteboardSuppressViewportContextMenuUntil = Date.now() + 1200;
        __tmWhiteboardDebugLog('viewport:pan-start', {
            view: { x: Number(v0.x) || 0, y: Number(v0.y) || 0, zoom: Number(v0.zoom) || 1 },
            pointerId: hasPointerId ? pointerId : null,
            rightButtonPan,
            event: __tmWhiteboardDebugEventInfo(ev),
        });
        try { viewport.classList.add('tm-whiteboard-viewport--panning', 'tm-whiteboard-viewport--moving'); } catch (e) {}
        if (hasPointerId && typeof viewport.setPointerCapture === 'function') {
            try { viewport.setPointerCapture(pointerId); } catch (e) {}
        }
        const onMove = (e2) => {
            const s = state.whiteboardPanSession;
            if (!s) return;
            const pid = Number(s.pointerId);
            if (Number.isFinite(pid)) {
                const curPid = Number(e2?.pointerId);
                if (Number.isFinite(curPid) && curPid !== pid) return;
            }
            const dx = (Number(e2?.clientX) || 0) - s.startClientX;
            const dy = (Number(e2?.clientY) || 0) - s.startClientY;
            __tmSetWhiteboardView({ x: s.startX + dx, y: s.startY + dy }, { persist: false });
            __tmApplyWhiteboardTransform();
            s.debugMoveCount = (Number(s.debugMoveCount) || 0) + 1;
            if (s.debugMoveCount === 1 || s.debugMoveCount % 15 === 0) {
                __tmWhiteboardDebugLog('viewport:pan-move', {
                    moveCount: s.debugMoveCount,
                    dx: Math.round(dx),
                    dy: Math.round(dy),
                    nextView: { x: Math.round(s.startX + dx), y: Math.round(s.startY + dy) },
                    event: __tmWhiteboardDebugEventInfo(e2),
                });
            }
        };
        const onUp = (e2) => {
            const s = state.whiteboardPanSession;
            if (s && Number.isFinite(Number(s.pointerId))) {
                const curPid = Number(e2?.pointerId);
                if (Number.isFinite(curPid) && curPid !== Number(s.pointerId)) return;
            }
            try { document.removeEventListener('mousemove', onMove, true); } catch (e) {}
            try { document.removeEventListener('mouseup', onUp, true); } catch (e) {}
            try { document.removeEventListener('pointermove', onMove, true); } catch (e) {}
            try { document.removeEventListener('pointerup', onUp, true); } catch (e) {}
            try { document.removeEventListener('pointercancel', onUp, true); } catch (e) {}
            try { window.removeEventListener('blur', onUp, true); } catch (e) {}
            if (Number.isFinite(pointerId) && typeof viewport.releasePointerCapture === 'function') {
                try { viewport.releasePointerCapture(pointerId); } catch (e) {}
            }
            try { viewport.classList.remove('tm-whiteboard-viewport--panning', 'tm-whiteboard-viewport--moving'); } catch (e) {}
            __tmWhiteboardDebugLog('viewport:pan-end', {
                hadSession: !!s,
                moveCount: Number(s?.debugMoveCount) || 0,
                event: __tmWhiteboardDebugEventInfo(e2),
            });
            state.whiteboardPanSession = null;
            __tmScheduleWhiteboardViewSave();
        };
        state.whiteboardPanSession.cleanup = onUp;
        try { document.addEventListener('mousemove', onMove, true); } catch (e) {}
        try { document.addEventListener('mouseup', onUp, true); } catch (e) {}
        try { document.addEventListener('pointermove', onMove, true); } catch (e) {}
        try { document.addEventListener('pointerup', onUp, true); } catch (e) {}
        try { document.addEventListener('pointercancel', onUp, true); } catch (e) {}
        try { window.addEventListener('blur', onUp, true); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
    };

    window.tmWhiteboardViewportContextMenu = function(ev) {
        if (Date.now() > (Number(state.whiteboardSuppressViewportContextMenuUntil) || 0)) return true;
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        return false;
    };

    function __tmGetWhiteboardFrameColorPalette() {
        return ['#dbeafe', '#dcfce7', '#fef3c7', '#fee2e2', '#ede9fe', '#e0f2fe'];
    }

    function __tmGetWhiteboardFrameElement(frameId) {
        const id = String(frameId || '').trim();
        if (!id) return null;
        try {
            const el = state.modal?.querySelector?.(`.tm-whiteboard-frame[data-frame-id="${CSS.escape(id)}"]`);
            return el instanceof HTMLElement ? el : null;
        } catch (e) {
            return null;
        }
    }

    function __tmGetWhiteboardFrameDocBody(frameId, docId = '') {
        const frameEl = __tmGetWhiteboardFrameElement(frameId);
        const body = frameEl?.closest?.('.tm-whiteboard-doc-body[data-doc-id]');
        if (body instanceof HTMLElement) return body;
        const did = String(docId || '').trim();
        if (!did) return null;
        try {
            const el = state.modal?.querySelector?.(`.tm-whiteboard-doc-body[data-doc-id="${CSS.escape(did)}"]`);
            return el instanceof HTMLElement ? el : null;
        } catch (e) {
            return null;
        }
    }

    function __tmBuildWhiteboardFrameMoveItems(frame, docBody) {
        const body = docBody instanceof HTMLElement ? docBody : null;
        if (!body) return { tasks: [], notes: [], strokes: [] };
        const offset = __tmGetWhiteboardDocBodyOffset(body);
        const globalBody = __tmIsWhiteboardGlobalElement(body);
        const taskIds = Array.isArray(frame?.memberTaskIds) ? frame.memberTaskIds : [];
        const noteIds = Array.isArray(frame?.memberNoteIds) ? frame.memberNoteIds : [];
        const strokeIds = new Set((Array.isArray(frame?.memberStrokeIds) ? frame.memberStrokeIds : []).map((id) => String(id || '').trim()).filter(Boolean));
        const tasks = taskIds.map((taskId) => {
            const id = String(taskId || '').trim();
            if (!id) return null;
            const el = body.querySelector(`.tm-whiteboard-card.tm-whiteboard-node--root[data-task-id="${CSS.escape(id)}"]`);
            if (!(el instanceof HTMLElement)) return null;
            const x0 = Number(el.dataset?.x);
            const y0 = Number(el.dataset?.y);
            const displayX = Number.isFinite(x0) ? x0 : Number((el.style.left || '').replace('px', '')) || 0;
            const displayY = Number.isFinite(y0) ? y0 : Number((el.style.top || '').replace('px', '')) || 0;
            const did = String(el.getAttribute('data-doc-id') || '').trim();
            if (!did) return null;
            return { id, did, el, x0: displayX, y0: displayY, offsetX: offset.x, offsetY: offset.y, global: globalBody || __tmIsWhiteboardGlobalElement(el) };
        }).filter(Boolean);
        const notes = noteIds.map((noteId) => {
            const id = String(noteId || '').trim();
            if (!id) return null;
            const el = body.querySelector(`.tm-whiteboard-note[data-note-id="${CSS.escape(id)}"]`);
            if (!(el instanceof HTMLElement)) return null;
            const displayX = Number((el.style.left || '').replace('px', '')) || 0;
            const displayY = Number((el.style.top || '').replace('px', '')) || 0;
            const did = String(el.getAttribute('data-doc-id') || '').trim();
            if (!did) return null;
            return { id, did, el, x0: displayX, y0: displayY, offsetX: offset.x, offsetY: offset.y, global: globalBody || __tmIsWhiteboardGlobalElement(el) };
        }).filter(Boolean);
        const strokes = [];
        if (strokeIds.size) {
            try {
                const drawingStorage = __tmGetWhiteboardDrawingStorage();
                const drawings = Array.isArray(drawingStorage.drawings) ? drawingStorage.drawings : [];
                drawings.forEach((stroke) => {
                    const id = String(stroke?.id || '').trim();
                    if (!id || !strokeIds.has(id)) return;
                    const path = body.querySelector(`.tm-whiteboard-drawing-stroke[data-stroke-id="${CSS.escape(id)}"]`);
                    if (!(path instanceof SVGGraphicsElement)) return;
                    strokes.push({ id, path, stroke: __tmCloneWhiteboardStroke(stroke) || { ...stroke } });
                });
            } catch (e) {}
        }
        return { tasks, notes, strokes };
    }

    window.tmWhiteboardSelectFrame = function(frameId, ev) {
        if (state.viewMode !== 'whiteboard') return;
        const tool = String(SettingsStore.data.whiteboardTool || 'pan').trim();
        if (tool !== 'pan' && tool !== 'select' && tool !== 'frame') return;
        const id = String(frameId || '').trim();
        if (!id) return;
        try { ev?.stopPropagation?.(); } catch (e) {}
        __tmClearWhiteboardMultiSelection();
        __tmClearWhiteboardStrokeSelection();
        state.whiteboardSelectedFrameId = id;
        state.whiteboardSelectedTaskId = '';
        state.whiteboardSelectedNoteId = '';
        state.whiteboardSelectedLinkId = '';
        state.whiteboardSelectedLinkDocId = '';
        __tmApplyWhiteboardCardSelectionDom('');
        __tmScheduleWhiteboardEdgeRedraw();
        render();
    };

    window.tmWhiteboardFrameMouseDown = function(ev, frameId, docId) {
        if (state.viewMode !== 'whiteboard') return;
        if (!ev?.__tmFromLongPress && Date.now() < (Number(state.whiteboardSuppressSyntheticMouseUntil) || 0)) return;
        if (state.whiteboardFrameDrag) return;
        const tool = String(SettingsStore.data.whiteboardTool || 'pan').trim();
        if (tool !== 'pan' && tool !== 'select' && tool !== 'frame') return;
        if (Number(ev?.button) !== 0) return;
        const target = ev?.target;
        if (target && target.closest && target.closest('.tm-whiteboard-frame-tools,.tm-whiteboard-frame-resize,input,button,select,textarea,label,a')) return;
        const id = String(frameId || '').trim();
        if (!id) return;
        const frameEl = ev?.currentTarget instanceof HTMLElement ? ev.currentTarget : __tmGetWhiteboardFrameElement(id);
        if (!(frameEl instanceof HTMLElement)) return;
        const docBody = frameEl.closest('.tm-whiteboard-doc-body[data-doc-id]');
        if (!(docBody instanceof HTMLElement)) return;
        const found = __tmGetWhiteboardFrameByIdLocal(id);
        const frame = found.frame;
        if (!frame) return;
        try { ev?.stopPropagation?.(); } catch (e) {}
        __tmClearWhiteboardMultiSelection();
        __tmClearWhiteboardStrokeSelection();
        state.whiteboardSelectedFrameId = id;
        state.whiteboardSelectedTaskId = '';
        state.whiteboardSelectedNoteId = '';
        state.whiteboardSelectedLinkId = '';
        state.whiteboardSelectedLinkDocId = '';
        __tmApplyWhiteboardCardSelectionDom('');
        const zoom = Math.max(0.01, Number(__tmGetWhiteboardView()?.zoom) || 1);
        const sx = Number(ev?.clientX) || 0;
        const sy = Number(ev?.clientY) || 0;
        const pointerId = Number.isFinite(Number(ev?.pointerId)) ? Number(ev.pointerId) : null;
        const displayX0 = Number((frameEl.style.left || '').replace('px', '')) || Number(frameEl.dataset?.x) || 0;
        const displayY0 = Number((frameEl.style.top || '').replace('px', '')) || Number(frameEl.dataset?.y) || 0;
        const storedX0 = Number(frame.x) || 0;
        const storedY0 = Number(frame.y) || 0;
        const items = __tmBuildWhiteboardFrameMoveItems(frame, docBody);
        state.whiteboardFrameDrag = { id, docId: String(docId || frame.docId || '').trim(), sx, sy, displayX0, displayY0, storedX0, storedY0, frameEl, docBody, items, dx: 0, dy: 0, moved: false };
        const applyMove = (dx, dy) => {
            const d = state.whiteboardFrameDrag;
            if (!d) return;
            d.dx = dx;
            d.dy = dy;
            const nx = Math.round(d.displayX0 + dx);
            const ny = Math.round(d.displayY0 + dy);
            d.frameEl.style.left = `${nx}px`;
            d.frameEl.style.top = `${ny}px`;
            d.frameEl.dataset.x = String(nx);
            d.frameEl.dataset.y = String(ny);
            d.items.tasks.forEach((item) => {
                const tx = Math.round(item.x0 + dx);
                const ty = Math.round(item.y0 + dy);
                item.el.style.left = `${tx}px`;
                item.el.style.top = `${ty}px`;
                item.el.dataset.x = String(tx);
                item.el.dataset.y = String(ty);
            });
            d.items.notes.forEach((item) => {
                item.el.style.left = `${Math.round(item.x0 + dx)}px`;
                item.el.style.top = `${Math.round(item.y0 + dy)}px`;
            });
            d.items.strokes.forEach((item) => {
                const nextStroke = __tmTranslateWhiteboardStroke(item.stroke, dx, dy);
                try { item.path.setAttribute('d', String(nextStroke.d || '')); } catch (e) {}
            });
            __tmScheduleWhiteboardEdgeRedraw();
        };
        const onMove = (e2) => {
            if (pointerId !== null && Number.isFinite(Number(e2?.pointerId)) && Number(e2.pointerId) !== pointerId) return;
            try { e2?.preventDefault?.(); } catch (e) {}
            const dx = ((Number(e2?.clientX) || sx) - sx) / zoom;
            const dy = ((Number(e2?.clientY) || sy) - sy) / zoom;
            const d = state.whiteboardFrameDrag;
            if (d && !d.moved && (dx * dx + dy * dy) > 9) d.moved = true;
            applyMove(dx, dy);
        };
        const onUp = async (eUp) => {
            if (pointerId !== null && Number.isFinite(Number(eUp?.pointerId)) && Number(eUp.pointerId) !== pointerId) return;
            try { document.removeEventListener('mousemove', onMove, true); } catch (e) {}
            try { document.removeEventListener('mouseup', onUp, true); } catch (e) {}
            try { document.removeEventListener('pointermove', onMove, true); } catch (e) {}
            try { document.removeEventListener('pointerup', onUp, true); } catch (e) {}
            try { document.removeEventListener('pointercancel', onUp, true); } catch (e) {}
            const d = state.whiteboardFrameDrag;
            state.whiteboardFrameDrag = null;
            if (!d) return;
            if (!d.moved) {
                render();
                return;
            }
            const dx = Number(d.dx) || 0;
            const dy = Number(d.dy) || 0;
            const now = String(Date.now());
            __tmPushWhiteboardHistorySnapshot('move-frame');
            const frames = __tmNormalizeWhiteboardFrameArrayLocal(found.storage.frames).map((item) => {
                if (String(item?.id || '').trim() !== id) return item;
                return { ...item, x: Math.round(storedX0 + dx), y: Math.round(storedY0 + dy), updatedAt: now };
            });
            __tmSaveWhiteboardFrameStorage(found.storage, frames, { persist: false });
            d.items.tasks.forEach((item) => {
                const storedX = Math.round(item.x0 + dx - (item.global ? 0 : item.offsetX));
                const storedY = Math.round(item.y0 + dy - (item.global ? 0 : item.offsetY));
                if (item.global) {
                    __tmSetGlobalWhiteboardNodePlacement(item.id, item.did, storedX, storedY, { persist: false, manual: true });
                } else {
                    __tmSetWhiteboardNodePos(item.id, item.did, storedX, storedY, { persist: false, manual: true });
                    __tmSetWhiteboardTaskPlaced(item.id, true, { persist: false });
                }
            });
            if (d.items.notes.length) {
                const noteStorage = __tmIsWhiteboardGlobalElement(d.docBody)
                    ? __tmGetWhiteboardNoteStorage()
                    : { scope: 'doc', notes: Array.isArray(SettingsStore.data.whiteboardNotes) ? [...SettingsStore.data.whiteboardNotes] : [] };
                const notes = Array.isArray(noteStorage.notes) ? [...noteStorage.notes] : [];
                d.items.notes.forEach((item) => {
                    const idx = notes.findIndex((note) => String(note?.id || '').trim() === item.id);
                    if (idx < 0) return;
                    notes[idx] = {
                        ...(notes[idx] || {}),
                        docId: item.did,
                        x: Math.round(item.x0 + dx - (item.global ? 0 : item.offsetX)),
                        y: Math.round(item.y0 + dy - (item.global ? 0 : item.offsetY)),
                        updatedAt: now,
                    };
                });
                __tmSaveWhiteboardNotesToStorage(noteStorage, notes, { persist: false });
            }
            if (d.items.strokes.length) {
                const strokeIds = new Set(d.items.strokes.map((item) => item.id));
                const originalById = new Map(d.items.strokes.map((item) => [item.id, item.stroke]));
                const drawingStorage = __tmGetWhiteboardDrawingStorage();
                const drawings = (Array.isArray(drawingStorage.drawings) ? drawingStorage.drawings : []).map((stroke) => {
                    const sid = String(stroke?.id || '').trim();
                    if (!sid || !strokeIds.has(sid)) return stroke;
                    return __tmTranslateWhiteboardStroke(originalById.get(sid) || stroke, dx, dy);
                });
                __tmSetWhiteboardDrawingStorage(drawings, { persist: false });
            }
            try { await SettingsStore.save(); } catch (e) {}
            render();
        };
        try { document.addEventListener('mousemove', onMove, true); } catch (e) {}
        try { document.addEventListener('mouseup', onUp, true); } catch (e) {}
        try { document.addEventListener('pointermove', onMove, true); } catch (e) {}
        try { document.addEventListener('pointerup', onUp, true); } catch (e) {}
        try { document.addEventListener('pointercancel', onUp, true); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
    };

    window.tmWhiteboardFramePointerDown = function(ev, frameId, docId) {
        if (state.viewMode !== 'whiteboard') return;
        if (String(ev?.pointerType || '') !== 'touch') return;
        state.whiteboardSuppressSyntheticMouseUntil = Date.now() + 900;
        const tool = String(SettingsStore.data.whiteboardTool || 'pan').trim();
        if (tool !== 'pan' && tool !== 'select' && tool !== 'frame') return;
        const target = ev?.target;
        if (target && target.closest && target.closest('.tm-whiteboard-frame-tools,.tm-whiteboard-frame-resize,input,button,select,textarea,label,a')) return;
        const id = String(frameId || '').trim();
        if (!id) return;
        const pointerId = Number(ev?.pointerId);
        const sx = Number(ev?.clientX) || 0;
        const sy = Number(ev?.clientY) || 0;
        const frame = ev?.currentTarget instanceof HTMLElement ? ev.currentTarget : __tmGetWhiteboardFrameElement(id);
        if (!(frame instanceof HTMLElement)) return;
        const session = {
            pointerId: Number.isFinite(pointerId) ? pointerId : null,
            sx,
            sy,
            active: false,
            timer: 0,
        };
        const cleanup = () => {
            try { clearTimeout(session.timer); } catch (e) {}
            try { document.removeEventListener('pointermove', onMove, true); } catch (e) {}
            try { document.removeEventListener('pointerup', onUp, true); } catch (e) {}
            try { document.removeEventListener('pointercancel', onUp, true); } catch (e) {}
            try { frame.releasePointerCapture?.(session.pointerId); } catch (e) {}
        };
        const samePointer = (e2) => {
            if (session.pointerId == null) return true;
            const cur = Number(e2?.pointerId);
            return !Number.isFinite(cur) || cur === session.pointerId;
        };
        const onMove = (e2) => {
            if (!samePointer(e2)) return;
            if (session.active) return;
            const dx = (Number(e2?.clientX) || 0) - session.sx;
            const dy = (Number(e2?.clientY) || 0) - session.sy;
            if ((dx * dx + dy * dy) > 16) cleanup();
        };
        const onUp = (e2) => {
            if (!samePointer(e2)) return;
            cleanup();
        };
        session.timer = setTimeout(() => {
            session.active = true;
            __tmStopWhiteboardViewportMoveForCardGesture();
            try { frame.setPointerCapture?.(session.pointerId); } catch (e) {}
            __tmSuppressNextWhiteboardCardClick(frame, 900);
            const startEvent = {
                ...ev,
                __tmFromLongPress: true,
                button: 0,
                clientX: session.sx,
                clientY: session.sy,
                currentTarget: frame,
                target: frame,
                stopPropagation: () => {
                    try { ev?.stopPropagation?.(); } catch (e) {}
                },
                preventDefault: () => {
                    try { ev?.preventDefault?.(); } catch (e) {}
                },
            };
            cleanup();
            try { window.tmWhiteboardFrameMouseDown(startEvent, id, docId); } catch (e) {}
        }, 500);
        try { document.addEventListener('pointermove', onMove, true); } catch (e) {}
        try { document.addEventListener('pointerup', onUp, true); } catch (e) {}
        try { document.addEventListener('pointercancel', onUp, true); } catch (e) {}
    };

    window.tmWhiteboardFrameResizeStart = function(ev, frameId, docId, dir = 'se') {
        if (state.viewMode !== 'whiteboard') return;
        if (state.whiteboardFrameResize) return;
        if (Number(ev?.button) !== 0) return;
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
        const id = String(frameId || '').trim();
        if (!id) return;
        const frameEl = __tmGetWhiteboardFrameElement(id);
        const docBody = __tmGetWhiteboardFrameDocBody(id, docId);
        const found = __tmGetWhiteboardFrameByIdLocal(id);
        if (!(frameEl instanceof HTMLElement) || !(docBody instanceof HTMLElement) || !found.frame) return;
        const zoom = Math.max(0.01, Number(__tmGetWhiteboardView()?.zoom) || 1);
        const sx = Number(ev?.clientX) || 0;
        const sy = Number(ev?.clientY) || 0;
        const pointerId = Number.isFinite(Number(ev?.pointerId)) ? Number(ev.pointerId) : null;
        const direction = String(dir || 'se').trim() === 'nw' ? 'nw' : 'se';
        const displayX0 = Number((frameEl.style.left || '').replace('px', '')) || Number(frameEl.dataset?.x) || 0;
        const displayY0 = Number((frameEl.style.top || '').replace('px', '')) || Number(frameEl.dataset?.y) || 0;
        const storedX0 = Number(found.frame.x) || 0;
        const storedY0 = Number(found.frame.y) || 0;
        const w0 = Math.max(80, Number(found.frame.w) || Number(frameEl.offsetWidth) || 80);
        const h0 = Math.max(60, Number(found.frame.h) || Number(frameEl.offsetHeight) || 60);
        state.whiteboardFrameResize = { id, sx, sy, displayX0, displayY0, storedX0, storedY0, w0, h0, dir: direction };
        const onMove = (e2) => {
            if (pointerId !== null && Number.isFinite(Number(e2?.pointerId)) && Number(e2.pointerId) !== pointerId) return;
            const dx = ((Number(e2?.clientX) || sx) - sx) / zoom;
            const dy = ((Number(e2?.clientY) || sy) - sy) / zoom;
            let x = displayX0;
            let y = displayY0;
            let w = Math.max(80, Math.round(w0 + dx));
            let h = Math.max(60, Math.round(h0 + dy));
            if (direction === 'nw') {
                w = Math.max(80, Math.round(w0 - dx));
                h = Math.max(60, Math.round(h0 - dy));
                x = Math.round(displayX0 + (w0 - w));
                y = Math.round(displayY0 + (h0 - h));
                frameEl.style.left = `${x}px`;
                frameEl.style.top = `${y}px`;
                frameEl.dataset.x = String(x);
                frameEl.dataset.y = String(y);
            }
            frameEl.style.width = `${w}px`;
            frameEl.style.height = `${h}px`;
            frameEl.dataset.w = String(w);
            frameEl.dataset.h = String(h);
            state.whiteboardFrameResize = { id, sx, sy, displayX0, displayY0, storedX0, storedY0, w0, h0, x, y, w, h, dir: direction };
        };
        const onUp = async (eUp) => {
            if (pointerId !== null && Number.isFinite(Number(eUp?.pointerId)) && Number(eUp.pointerId) !== pointerId) return;
            try { document.removeEventListener('mousemove', onMove, true); } catch (e) {}
            try { document.removeEventListener('mouseup', onUp, true); } catch (e) {}
            try { document.removeEventListener('pointermove', onMove, true); } catch (e) {}
            try { document.removeEventListener('pointerup', onUp, true); } catch (e) {}
            try { document.removeEventListener('pointercancel', onUp, true); } catch (e) {}
            const r = state.whiteboardFrameResize;
            state.whiteboardFrameResize = null;
            const w = Math.max(80, Math.round(Number(r?.w) || w0));
            const h = Math.max(60, Math.round(Number(r?.h) || h0));
            const storedX = direction === 'nw' ? Math.round(storedX0 + (w0 - w)) : storedX0;
            const storedY = direction === 'nw' ? Math.round(storedY0 + (h0 - h)) : storedY0;
            const now = String(Date.now());
            if (storedX !== storedX0 || storedY !== storedY0 || w !== w0 || h !== h0) {
                __tmPushWhiteboardHistorySnapshot('resize-frame');
            }
            const baseFrames = __tmNormalizeWhiteboardFrameArrayLocal(found.storage.frames).map((item) => {
                if (String(item?.id || '').trim() !== id) return item;
                return { ...item, x: storedX, y: storedY, w, h, updatedAt: now };
            });
            const resizedFrame = baseFrames.find((item) => String(item?.id || '').trim() === id) || { ...found.frame, x: storedX, y: storedY, w, h };
            const members = __tmCollectWhiteboardFrameMembers(resizedFrame, docBody);
            const nextFrames = __tmApplyWhiteboardFrameOwnership(baseFrames, id, members, { clearTarget: true });
            __tmSaveWhiteboardFrameStorage(found.storage, nextFrames, { persist: true });
            state.whiteboardSelectedFrameId = id;
            render();
        };
        try { document.addEventListener('mousemove', onMove, true); } catch (e) {}
        try { document.addEventListener('mouseup', onUp, true); } catch (e) {}
        try { document.addEventListener('pointermove', onMove, true); } catch (e) {}
        try { document.addEventListener('pointerup', onUp, true); } catch (e) {}
        try { document.addEventListener('pointercancel', onUp, true); } catch (e) {}
    };

    window.tmWhiteboardFrameNameKeyDown = function(ev, frameId) {
        const key = String(ev?.key || '');
        if (key === 'Enter') {
            try { ev?.preventDefault?.(); } catch (e) {}
            try { ev?.currentTarget?.blur?.(); } catch (e) {}
            return;
        }
        if (key === 'Escape') {
            try { ev?.preventDefault?.(); } catch (e) {}
            const current = __tmGetWhiteboardFrameByIdLocal(frameId).frame;
            if (ev?.currentTarget instanceof HTMLInputElement) ev.currentTarget.value = __tmNormalizeWhiteboardFrameNameLocal(current?.name);
            try { ev?.currentTarget?.blur?.(); } catch (e) {}
        }
    };

    window.tmWhiteboardUpdateFrameName = async function(frameId, value, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const id = String(frameId || '').trim();
        if (!id) return;
        const found = __tmGetWhiteboardFrameByIdLocal(id);
        if (!found.frame) return;
        const name = __tmNormalizeWhiteboardFrameNameLocal(value);
        const frames = found.storage.frames.map((frame) => String(frame?.id || '').trim() === id
            ? { ...frame, name, updatedAt: String(Date.now()) }
            : frame);
        __tmSaveWhiteboardFrameStorage(found.storage, frames, { persist: true });
        state.whiteboardSelectedFrameId = id;
        render();
    };

    window.tmWhiteboardSetFrameBackground = async function(frameId, color, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const id = String(frameId || '').trim();
        if (!id) return;
        const c = __tmNormalizeWhiteboardFrameBackgroundColorLocal(color);
        if (c && !__tmGetWhiteboardFrameColorPalette().includes(c.toLowerCase())) return;
        const found = __tmGetWhiteboardFrameByIdLocal(id);
        if (!found.frame) return;
        const frames = found.storage.frames.map((frame) => String(frame?.id || '').trim() === id
            ? { ...frame, backgroundColor: c, updatedAt: String(Date.now()) }
            : frame);
        __tmSaveWhiteboardFrameStorage(found.storage, frames, { persist: true });
        state.whiteboardSelectedFrameId = id;
        render();
    };

    window.tmWhiteboardDeleteFrame = async function(frameId, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const id = String(frameId || '').trim();
        if (!id) return;
        const found = __tmGetWhiteboardFrameByIdLocal(id);
        if (!found.frame) return;
        __tmPushWhiteboardHistorySnapshot('delete-frame');
        const frames = found.storage.frames.filter((frame) => String(frame?.id || '').trim() !== id);
        __tmSaveWhiteboardFrameStorage(found.storage, frames, { persist: true });
        if (String(state.whiteboardSelectedFrameId || '').trim() === id) state.whiteboardSelectedFrameId = '';
        render();
    };

    window.tmWhiteboardCardMouseDown = function(ev, taskId, docId) {
        if (state.viewMode !== 'whiteboard') return;
        if (!ev?.__tmFromLongPress && Date.now() < (Number(state.whiteboardSuppressSyntheticMouseUntil) || 0)) return;
        const tool = String(SettingsStore.data.whiteboardTool || 'pan').trim();
        if (tool !== 'pan' && tool !== 'select') return;
        if (Number(ev?.button) !== 0) return;
        try { __tmCalendarFloatingDragEnd(); } catch (e) {}
        const id = String(taskId || '').trim();
        const did = String(docId || '').trim();
        if (!id || !did) return;
        const target = ev?.target;
        if (target && target.closest && target.closest('.tm-task-link-dot,input,select,textarea,[contenteditable="true"]')) return;
        const multiTaskIds = Array.isArray(state.whiteboardMultiSelectedTaskIds)
            ? state.whiteboardMultiSelectedTaskIds.map((x) => String(x || '').trim()).filter(Boolean)
            : [];
        const multiNoteIds = Array.isArray(state.whiteboardMultiSelectedNoteIds)
            ? state.whiteboardMultiSelectedNoteIds.map((x) => String(x || '').trim()).filter(Boolean)
            : [];
        let groupDragItems = [];
        const wantsGroupDrag = (multiTaskIds.length + multiNoteIds.length > 1) && multiTaskIds.includes(id);
        if (wantsGroupDrag) {
            const uniqTaskIds = Array.from(new Set(multiTaskIds));
            const uniqNoteIds = Array.from(new Set(multiNoteIds));
            const taskItems = uniqTaskIds.map((tid) => {
                const cardEl = state.modal?.querySelector?.(`.tm-whiteboard-card[data-task-id="${CSS.escape(tid)}"]`);
                if (!(cardEl instanceof HTMLElement)) return null;
                if (cardEl.classList.contains('tm-whiteboard-node--sub')) return null;
                const sx = Number(cardEl.dataset?.x);
                const sy = Number(cardEl.dataset?.y);
                const x0 = Number.isFinite(sx) ? sx : Number((cardEl.style.left || '').replace('px', '')) || 0;
                const y0 = Number.isFinite(sy) ? sy : Number((cardEl.style.top || '').replace('px', '')) || 0;
                const tdid = String(cardEl.getAttribute('data-doc-id') || '').trim();
                if (!tdid) return null;
                return { kind: 'task', id: tid, did: tdid, el: cardEl, x0, y0, global: __tmIsWhiteboardGlobalElement(cardEl) };
            }).filter(Boolean);
            const noteItems = uniqNoteIds.map((nid) => {
                const noteEl = state.modal?.querySelector?.(`.tm-whiteboard-note[data-note-id="${CSS.escape(nid)}"]`);
                if (!(noteEl instanceof HTMLElement)) return null;
                const x0 = Number((noteEl.style.left || '').replace('px', '')) || 0;
                const y0 = Number((noteEl.style.top || '').replace('px', '')) || 0;
                const ndid = String(noteEl.getAttribute('data-doc-id') || '').trim();
                if (!ndid) return null;
                return { kind: 'note', id: nid, did: ndid, el: noteEl, x0, y0, global: __tmIsWhiteboardGlobalElement(noteEl) };
            }).filter(Boolean);
            groupDragItems = taskItems.concat(noteItems);
        }
        const useGroupDrag = groupDragItems.length > 1;
        if (!useGroupDrag) {
            __tmClearWhiteboardMultiSelection();
            state.whiteboardSelectedTaskId = id;
            state.whiteboardSelectedNoteId = '';
            state.whiteboardSelectedFrameId = '';
            __tmApplyWhiteboardCardSelectionDom(id);
        } else {
            state.whiteboardSelectedTaskId = '';
            state.whiteboardSelectedNoteId = '';
            state.whiteboardSelectedFrameId = '';
            __tmApplyWhiteboardCardSelectionDom('');
            __tmApplyWhiteboardMultiSelectionDom();
        }
        const card = ev?.currentTarget instanceof HTMLElement ? ev.currentTarget : (target?.closest?.('.tm-whiteboard-node') || null);
        if (!(card instanceof HTMLElement)) return;
        const isGlobalCard = __tmIsWhiteboardGlobalElement(card);
        const isSubNode = card.classList.contains('tm-whiteboard-node--sub');
        const startX = Number(card.dataset?.x);
        const startY = Number(card.dataset?.y);
        const x0 = isSubNode ? 0 : (Number.isFinite(startX) ? startX : Number(card.style.left.replace('px', '')) || 0);
        const y0 = isSubNode ? 0 : (Number.isFinite(startY) ? startY : Number(card.style.top.replace('px', '')) || 0);
        const zoom = __tmGetWhiteboardView().zoom || 1;
        const sx = Number(ev?.clientX) || 0;
        const sy = Number(ev?.clientY) || 0;
        state.whiteboardNodeDrag = { id, did, x0, y0, sx, sy, card, isSubNode, detached: false, global: isGlobalCard, group: useGroupDrag ? groupDragItems : null, moved: false, historyPushed: false };
        const onMove = (e2) => {
            try { e2?.preventDefault?.(); } catch (e) {}
            const d = state.whiteboardNodeDrag;
            if (!d) return;
            const dxClient = (Number(e2?.clientX) || 0) - d.sx;
            const dyClient = (Number(e2?.clientY) || 0) - d.sy;
            if (!d.moved && (dxClient * dxClient + dyClient * dyClient) > 16) d.moved = true;
            if (Array.isArray(d.group) && d.group.length > 1) {
                if (!d.historyPushed) {
                    __tmPushWhiteboardHistorySnapshot('move-card');
                    d.historyPushed = true;
                }
                const dx = ((Number(e2?.clientX) || 0) - d.sx) / (zoom || 1);
                const dy = ((Number(e2?.clientY) || 0) - d.sy) / (zoom || 1);
                d.group.forEach((g) => {
                    if (!g || !(g.el instanceof HTMLElement)) return;
                    const nx = Math.round(Number(g.x0 || 0) + dx);
                    const ny = Math.round(Number(g.y0 || 0) + dy);
                    g.el.style.left = `${nx}px`;
                    g.el.style.top = `${ny}px`;
                    if (g.kind === 'task') {
                        g.el.dataset.x = String(nx);
                        g.el.dataset.y = String(ny);
                        if (g.global) {
                            __tmSetGlobalWhiteboardNodePlacement(g.id, g.did, nx, ny, { persist: false, manual: true });
                        } else {
                            __tmSetWhiteboardNodePos(g.id, g.did, nx, ny, { persist: false, manual: true });
                            __tmSetWhiteboardTaskPlaced(g.id, true, { persist: false });
                        }
                    }
                });
                __tmScheduleWhiteboardEdgeRedraw();
                __tmRenderWhiteboardMultiTools(__tmComputeWhiteboardMultiSelectionRect());
                return;
            }
            if (d.isSubNode && !d.detached) {
                const dx0 = (Number(e2?.clientX) || 0) - d.sx;
                const dy0 = (Number(e2?.clientY) || 0) - d.sy;
                if (Math.abs(dx0) + Math.abs(dy0) < 4) return;
                const p = __tmResolveWhiteboardPointerInfo(e2, d.did)
                    || __tmResolveWhiteboardPointerInfo(ev, d.did)
                    || __tmTrackWhiteboardPointerFromClient(e2?.clientX, e2?.clientY, d.did);
                const anchorX = 18;
                const anchorY = 16;
                const nx0 = Math.round((Number(p?.localX) || 24) - anchorX);
                const ny0 = Math.round((Number(p?.localY) || 24) - anchorY);
                const dTask = state.flatTasks?.[String(d.id || '').trim()];
                const dParentId = String(dTask?.parentTaskId || '').trim();
                if (!d.historyPushed) {
                    __tmPushWhiteboardHistorySnapshot('detach-card');
                    d.historyPushed = true;
                }
                if (d.global) {
                    __tmSetGlobalWhiteboardChildDetached(d.id, true, dParentId);
                    __tmSetGlobalWhiteboardNodePlacement(d.id, d.did, nx0, ny0, { persist: false, manual: true });
                } else {
                    __tmSetWhiteboardChildDetached(d.id, true, dParentId);
                    __tmSetWhiteboardTaskPlaced(d.id, true, { persist: false });
                    __tmSetWhiteboardNodePos(d.id, d.did, nx0, ny0, { persist: false, manual: true });
                }
                state.whiteboardSelectedTaskId = d.id;
                state.whiteboardNodeDrag = null;
                render();
                const nextCard = state.modal?.querySelector?.(`.tm-whiteboard-card[data-task-id="${CSS.escape(d.id)}"]`);
                if (nextCard instanceof HTMLElement) {
                    state.whiteboardNodeDrag = {
                        id: d.id,
                        did: d.did,
                        x0: nx0,
                        y0: ny0,
                        sx: Number(e2?.clientX) || 0,
                        sy: Number(e2?.clientY) || 0,
                        card: nextCard,
                        isSubNode: false,
                        detached: true,
                        global: d.global,
                        moved: true,
                        historyPushed: true,
                    };
                }
                return;
            }
            const dx = ((Number(e2?.clientX) || 0) - d.sx) / (zoom || 1);
            const dy = ((Number(e2?.clientY) || 0) - d.sy) / (zoom || 1);
            const nx = Math.round(d.x0 + dx);
            const ny = Math.round(d.y0 + dy);
            if (!d.historyPushed) {
                __tmPushWhiteboardHistorySnapshot('move-card');
                d.historyPushed = true;
            }
            d.card.style.left = `${nx}px`;
            d.card.style.top = `${ny}px`;
            d.card.dataset.x = String(nx);
            d.card.dataset.y = String(ny);
            if (d.global) {
                __tmSetGlobalWhiteboardNodePlacement(d.id, d.did, nx, ny, { persist: false, manual: true });
            } else {
                __tmSetWhiteboardNodePos(d.id, d.did, nx, ny, { persist: false, manual: true });
                __tmSetWhiteboardTaskPlaced(d.id, true, { persist: false });
            }
            __tmScheduleWhiteboardEdgeRedraw();
        };
        const onUp = (eUp) => {
            try { document.removeEventListener('mousemove', onMove, true); } catch (e) {}
            try { document.removeEventListener('mouseup', onUp, true); } catch (e) {}
            try { document.removeEventListener('pointermove', onMove, true); } catch (e) {}
            try { document.removeEventListener('pointerup', onUp, true); } catch (e) {}
            try { document.removeEventListener('pointercancel', onUp, true); } catch (e) {}
            const d = state.whiteboardNodeDrag;
            state.whiteboardNodeDrag = null;
            if (d?.moved) {
                __tmSuppressNextWhiteboardCardClick(d.card, 700);
            }
            if (d && Array.isArray(d.group) && d.group.length > 1) {
                const allView = !(state.activeDocId && state.activeDocId !== 'all');
                const now = String(Date.now());
                const globalStorage = (d.group || []).some((g) => g?.kind === 'note' && g.global)
                    ? __tmGetWhiteboardNoteStorage()
                    : null;
                const notes = globalStorage
                    ? [...globalStorage.notes]
                    : (Array.isArray(SettingsStore.data.whiteboardNotes) ? [...SettingsStore.data.whiteboardNotes] : []);
                d.group.forEach((g) => {
                    if (!g || g.kind !== 'note' || !(g.el instanceof HTMLElement)) return;
                    const nx = Number((g.el.style.left || '').replace('px', '')) || Number(g.x0 || 0);
                    const ny = Number((g.el.style.top || '').replace('px', '')) || Number(g.y0 || 0);
                    const idx = notes.findIndex((n) => String(n?.id || '').trim() === String(g.id || '').trim());
                    if (idx < 0) return;
                    const offX = (allView && !g.global) ? (Number(g.el.parentElement?.dataset?.frameOffsetX) || 0) : 0;
                    const offY = (allView && !g.global) ? (Number(g.el.parentElement?.dataset?.frameOffsetY) || 0) : 0;
                    notes[idx] = { ...(notes[idx] || {}), docId: g.did, x: Math.round(nx - offX), y: Math.round(ny - offY), updatedAt: now };
                });
                if (globalStorage) {
                    __tmSaveWhiteboardNotesToStorage(globalStorage, notes);
                } else {
                    SettingsStore.data.whiteboardNotes = notes;
                    try { WhiteboardStore?.syncFromSettings?.(SettingsStore.data, 'whiteboard-notes'); } catch (e) {}
                    try { SettingsStore.syncToLocal(); } catch (e) {}
                }
                d.group.forEach((g) => {
                    if (!g || !(g.el instanceof HTMLElement)) return;
                    const body = g.el.closest('.tm-whiteboard-doc-body[data-doc-id]');
                    if (!(body instanceof HTMLElement)) return;
                    if (g.kind === 'task') __tmRefreshWhiteboardFrameMembershipForElement('task', g.id, body, { persist: false });
                    if (g.kind === 'note') __tmRefreshWhiteboardFrameMembershipForElement('note', g.id, body, { persist: false });
                });
            }
            if (d && !d.isSubNode && !(Array.isArray(d.group) && d.group.length > 1)) {
                const task = state.flatTasks?.[String(d.id || '').trim()];
                const parentId = String(task?.parentTaskId || '').trim();
                const isDetached = parentId ? __tmIsWhiteboardChildDetached(d.id) : false;
                if (parentId && isDetached) {
                    let hit = null;
                    try { hit = document.elementFromPoint(Number(eUp?.clientX) || 0, Number(eUp?.clientY) || 0); } catch (e) {}
                    const parentNode = hit?.closest?.(`.tm-whiteboard-node[data-task-id="${CSS.escape(parentId)}"]`);
                    if (parentNode instanceof Element) {
                        if (d.global) {
                            __tmSetGlobalWhiteboardChildDetached(d.id, false);
                            __tmSetGlobalWhiteboardNodePlacement(d.id, d.did, d.x0, d.y0, { persist: false, manual: true });
                        } else {
                            __tmSetWhiteboardChildDetached(d.id, false);
                            __tmSetWhiteboardTaskPlaced(d.id, true, { persist: false });
                        }
                        __tmRemoveWhiteboardFrameMemberIds({ taskIds: [d.id] }, { persist: false });
                        try { SettingsStore.save(); } catch (e) {}
                        render();
                        return;
                    }
                }
            }
            if (d && d.moved && !d.isSubNode && !(Array.isArray(d.group) && d.group.length > 1) && d.card instanceof HTMLElement) {
                const body = d.card.closest('.tm-whiteboard-doc-body[data-doc-id]');
                if (body instanceof HTMLElement) __tmRefreshWhiteboardFrameMembershipForElement('task', d.id, body, { persist: false });
            }
            try { SettingsStore.save(); } catch (e) {}
        };
        try { document.addEventListener('mousemove', onMove, true); } catch (e) {}
        try { document.addEventListener('mouseup', onUp, true); } catch (e) {}
        try { document.addEventListener('pointermove', onMove, true); } catch (e) {}
        try { document.addEventListener('pointerup', onUp, true); } catch (e) {}
        try { document.addEventListener('pointercancel', onUp, true); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
    };

    function __tmStopWhiteboardViewportMoveForCardGesture() {
        const viewport = state.modal?.querySelector?.('#tmWhiteboardViewport');
        try {
            const old = state.whiteboardPanSession;
            if (old && typeof old.cleanup === 'function') old.cleanup();
        } catch (e) {}
        state.whiteboardPanSession = null;
        state.whiteboardTouchSession = null;
        try { viewport?.classList?.remove?.('tm-whiteboard-viewport--panning', 'tm-whiteboard-viewport--moving'); } catch (e) {}
    }

    function __tmSuppressNextWhiteboardCardClick(card, durationMs = 700) {
        const until = Date.now() + Math.max(120, Number(durationMs) || 700);
        state.whiteboardSuppressClickUntil = Math.max(Number(state.whiteboardSuppressClickUntil) || 0, until);
        state.whiteboardSuppressCardClickUntil = Math.max(Number(state.whiteboardSuppressCardClickUntil) || 0, until);
        if (state.whiteboardSuppressCardClickHandler) return;
        const cleanup = () => {
            try { document.removeEventListener('click', handler, true); } catch (e) {}
            try { if (timer) clearTimeout(timer); } catch (e) {}
            state.whiteboardSuppressCardClickHandler = null;
        };
        const handler = (clickEv) => {
            if (Date.now() > (Number(state.whiteboardSuppressCardClickUntil) || 0)) {
                cleanup();
                return;
            }
            const target = clickEv?.target instanceof Element ? clickEv.target : null;
            const hitCard = target?.closest?.('.tm-whiteboard-node[data-task-id]');
            if (card instanceof Element && hitCard !== card && !card.contains(target)) return;
            try { clickEv?.preventDefault?.(); } catch (e) {}
            try { clickEv?.stopPropagation?.(); } catch (e) {}
            try { clickEv?.stopImmediatePropagation?.(); } catch (e) {}
            cleanup();
        };
        let timer = null;
        state.whiteboardSuppressCardClickHandler = handler;
        try { document.addEventListener('click', handler, true); } catch (e) {}
        try { timer = setTimeout(cleanup, Math.max(160, Number(durationMs) || 700)); } catch (e) {}
    }

    window.tmWhiteboardCardContextMenu = function(ev, taskId) {
        const pointerType = String(ev?.pointerType || '').toLowerCase();
        const touchLike = pointerType === 'touch'
            || ev?.sourceCapabilities?.firesTouchEvents === true
            || Date.now() < (Number(state.whiteboardSuppressCardContextMenuUntil) || 0)
            || !!state.whiteboardNodeDrag;
        let mobile = false;
        try {
            mobile = (typeof __tmIsRuntimeMobileClient === 'function' && __tmIsRuntimeMobileClient())
                || (typeof __tmIsMobileDevice === 'function' && __tmIsMobileDevice());
        } catch (e) {
            mobile = false;
        }
        if (touchLike || mobile) {
            try { ev?.preventDefault?.(); } catch (e) {}
            try { ev?.stopPropagation?.(); } catch (e) {}
            return false;
        }
        try { window.tmShowTaskContextMenu?.(ev, taskId); } catch (e) {}
        return false;
    };

    window.tmWhiteboardCardPointerDown = function(ev, taskId, docId) {
        if (state.viewMode !== 'whiteboard') return;
        if (String(ev?.pointerType || '') !== 'touch') return;
        try { __tmCalendarFloatingDragEnd(); } catch (e) {}
        state.whiteboardSuppressSyntheticMouseUntil = Date.now() + 900;
        const tool = String(SettingsStore.data.whiteboardTool || 'pan').trim();
        if (tool !== 'pan' && tool !== 'select') return;
        const target = ev?.target;
        state.whiteboardSuppressCardContextMenuUntil = Date.now() + 1800;
        const id = String(taskId || '').trim();
        const did = String(docId || '').trim();
        if (!id || !did) return;
        const pointerId = Number(ev?.pointerId);
        const sx = Number(ev?.clientX) || 0;
        const sy = Number(ev?.clientY) || 0;
        const card = ev?.currentTarget instanceof HTMLElement ? ev.currentTarget : (target?.closest?.('.tm-whiteboard-node') || null);
        if (!(card instanceof HTMLElement)) return;
        const session = {
            pointerId: Number.isFinite(pointerId) ? pointerId : null,
            sx,
            sy,
            active: false,
            timer: 0,
        };
        const cleanup = () => {
            try { clearTimeout(session.timer); } catch (e) {}
            try { document.removeEventListener('pointermove', onMove, true); } catch (e) {}
            try { document.removeEventListener('pointerup', onUp, true); } catch (e) {}
            try { document.removeEventListener('pointercancel', onUp, true); } catch (e) {}
            try { card.releasePointerCapture?.(session.pointerId); } catch (e) {}
        };
        const samePointer = (e2) => {
            if (session.pointerId == null) return true;
            const cur = Number(e2?.pointerId);
            return !Number.isFinite(cur) || cur === session.pointerId;
        };
        const onMove = (e2) => {
            if (!samePointer(e2)) return;
            if (session.active) return;
            const dx = (Number(e2?.clientX) || 0) - session.sx;
            const dy = (Number(e2?.clientY) || 0) - session.sy;
            if ((dx * dx + dy * dy) > 16) cleanup();
        };
        const onUp = (e2) => {
            if (!samePointer(e2)) return;
            cleanup();
        };
        session.timer = setTimeout(() => {
            session.active = true;
            state.whiteboardSuppressCardContextMenuUntil = Date.now() + 1800;
            __tmStopWhiteboardViewportMoveForCardGesture();
            try { card.setPointerCapture?.(session.pointerId); } catch (e) {}
            __tmSuppressNextWhiteboardCardClick(card, 900);
            const startEvent = {
                ...ev,
                __tmFromLongPress: true,
                button: 0,
                clientX: session.sx,
                clientY: session.sy,
                currentTarget: card,
                target: card,
                stopPropagation: () => {
                    try { ev?.stopPropagation?.(); } catch (e) {}
                },
                preventDefault: () => {
                    try { ev?.preventDefault?.(); } catch (e) {}
                },
            };
            cleanup();
            try { window.tmWhiteboardCardMouseDown(startEvent, id, did); } catch (e) {}
        }, 500);
        try { document.addEventListener('pointermove', onMove, true); } catch (e) {}
        try { document.addEventListener('pointerup', onUp, true); } catch (e) {}
        try { document.addEventListener('pointercancel', onUp, true); } catch (e) {}
    };

    window.tmWhiteboardSelectTask = function(taskId, ev) {
        if (state.viewMode !== 'whiteboard') return;
        try {
            if (typeof __tmIsTaskDetailNoteViewEventTarget === 'function' && __tmIsTaskDetailNoteViewEventTarget(ev?.target)) return;
        } catch (e) {}
        const tool = String(SettingsStore.data.whiteboardTool || 'pan').trim();
        if (tool !== 'pan' && tool !== 'select') return;
        const id = String(taskId || '').trim();
        if (!id) return;
        try { ev?.stopPropagation?.(); } catch (e) {}
        if (tool === 'select') {
            state.whiteboardSelectedTaskId = '';
            state.whiteboardSelectedNoteId = '';
            state.whiteboardSelectedFrameId = '';
            state.whiteboardSelectedLinkId = '';
            state.whiteboardSelectedLinkDocId = '';
            __tmApplyWhiteboardCardSelectionDom('');
            const setTask = new Set((Array.isArray(state.whiteboardMultiSelectedTaskIds) ? state.whiteboardMultiSelectedTaskIds : []).map((x) => String(x || '').trim()).filter(Boolean));
            setTask.add(id);
            state.whiteboardMultiSelectedTaskIds = Array.from(setTask);
            state.whiteboardMultiSelectedNoteIds = Array.isArray(state.whiteboardMultiSelectedNoteIds)
                ? state.whiteboardMultiSelectedNoteIds.map((x) => String(x || '').trim()).filter(Boolean)
                : [];
            __tmApplyWhiteboardMultiSelectionDom();
            __tmRenderWhiteboardMultiTools(__tmComputeWhiteboardMultiSelectionRect());
            __tmScheduleWhiteboardEdgeRedraw();
            return;
        }
        __tmClearWhiteboardMultiSelection();
        state.whiteboardSelectedTaskId = id;
        state.whiteboardSelectedNoteId = '';
        state.whiteboardSelectedFrameId = '';
        state.whiteboardSelectedLinkId = '';
        state.whiteboardSelectedLinkDocId = '';
        __tmApplyWhiteboardCardSelectionDom(id);
        __tmScheduleWhiteboardEdgeRedraw();
        render();
    };

    window.tmWhiteboardDeleteCard = async function(taskId, docId, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const id = String(taskId || '').trim();
        if (!id) return;
        const eventEl = ev?.currentTarget instanceof HTMLElement ? ev.currentTarget : null;
        const cardEl = (eventEl?.closest?.('.tm-whiteboard-node') instanceof HTMLElement)
            ? eventEl.closest('.tm-whiteboard-node')
            : state.modal?.querySelector?.(`.tm-whiteboard-node[data-task-id="${CSS.escape(id)}"]`);
        const isGlobalCard = __tmIsWhiteboardGlobalElement(cardEl);
        const ids = __tmWhiteboardCollectTaskTreeIds(id, { includeRoot: true, includeDetached: false, includeSnapshotTree: true });
        __tmPushWhiteboardHistorySnapshot('delete-card');
        if (isGlobalCard) {
            const groupId = __tmGetWhiteboardGlobalBoardGroupId();
            const board = __tmGetWhiteboardGlobalBoardState(groupId);
            const nodePos = (board?.nodePos && typeof board.nodePos === 'object') ? { ...board.nodePos } : {};
            const placedTaskIds = (board?.placedTaskIds && typeof board.placedTaskIds === 'object') ? { ...board.placedTaskIds } : {};
            const detachedChildren = (board?.detachedChildren && typeof board.detachedChildren === 'object') ? { ...board.detachedChildren } : {};
            ids.forEach((tid) => {
                const key = String(tid || '').trim();
                if (!key) return;
                delete nodePos[key];
                delete placedTaskIds[key];
                delete detachedChildren[key];
            });
            __tmPatchWhiteboardGlobalBoardState(groupId, { nodePos, placedTaskIds, detachedChildren }, { keepEmpty: true });
        } else {
            ids.forEach((tid) => __tmSetWhiteboardTaskPlaced(tid, false, { persist: false }));
        }
        const snapshotIds = ids.filter((tid) => {
            const k = String(tid || '').trim();
            if (!k) return false;
            if (state.flatTasks?.[k]) return false;
            return !!__tmGetWhiteboardCardSnapshot(k);
        });
        __tmDeleteWhiteboardSnapshotTasks(snapshotIds);
        const idSet = new Set(ids.map((x) => String(x || '').trim()).filter(Boolean));
        __tmRemoveWhiteboardFrameMemberIds({ taskIds: Array.from(idSet) }, { persist: false });
        if (!isGlobalCard) {
            const links = __tmGetManualTaskLinks().filter((x) => {
                const from = String(x?.from || '').trim();
                const to = String(x?.to || '').trim();
                return !idSet.has(from) && !idSet.has(to);
            });
            __tmSetManualTaskLinks(links);
        }
        if (idSet.has(String(state.whiteboardSelectedTaskId || '').trim())) state.whiteboardSelectedTaskId = '';
        __tmRemoveWhiteboardPoolSelectionIds(Array.from(idSet));
        try { await SettingsStore.save(); } catch (e) {}
        render();
    };

    window.tmWhiteboardSelectNote = function(noteId, ev) {
        if (state.viewMode !== 'whiteboard') return;
        const tool = String(SettingsStore.data.whiteboardTool || 'pan');
        if (tool !== 'pan' && tool !== 'text' && tool !== 'sticky' && tool !== 'select') return;
        if (state.whiteboardNoteEditor) return;
        try { ev?.stopPropagation?.(); } catch (e) {}
        const id = String(noteId || '').trim();
        if (!id) return;
        if (String(state.whiteboardSelectedNoteId || '').trim() === id) return;
        __tmClearWhiteboardMultiSelection();
        state.whiteboardSelectedNoteId = id;
        state.whiteboardSelectedTaskId = '';
        state.whiteboardSelectedFrameId = '';
        __tmApplyWhiteboardCardSelectionDom('');
        state.whiteboardSelectedLinkId = '';
        state.whiteboardSelectedLinkDocId = '';
        __tmScheduleWhiteboardEdgeRedraw();
        render();
    };

    window.tmWhiteboardNoteClick = function(noteId, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const prev = Number(state.whiteboardNoteClickTimer) || 0;
        if (prev) {
            try { clearTimeout(prev); } catch (e) {}
            state.whiteboardNoteClickTimer = 0;
        }
        state.whiteboardNoteClickTimer = setTimeout(() => {
            state.whiteboardNoteClickTimer = 0;
            try { window.tmWhiteboardSelectNote?.(noteId, ev); } catch (e) {}
        }, 180);
    };

    function __tmNormalizeWhiteboardNoteColor(v) {
        const s = String(v || '').trim();
        if (!s) return '';
        if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
        return '';
    }

    function __tmNormalizeWhiteboardNoteFontSize(v) {
        const n = Number(v);
        if (!Number.isFinite(n)) return 12;
        return Math.max(10, Math.min(40, Math.round(n)));
    }

    function __tmNormalizeWhiteboardNoteWidth(v) {
        const n = Number(v);
        if (!Number.isFinite(n)) return 0;
        return Math.max(80, Math.min(2200, Math.round(n)));
    }

    function __tmNormalizeWhiteboardNoteHeight(v) {
        const n = Number(v);
        if (!Number.isFinite(n)) return 0;
        return Math.max(120, Math.min(2200, Math.round(n)));
    }

    function __tmNormalizeWhiteboardNoteBold(v) {
        return !!v;
    }

    async function __tmUpdateWhiteboardNoteStyle(noteId, patch = {}) {
        const id = String(noteId || '').trim();
        if (!id) return false;
        const storage = __tmGetWhiteboardNoteStorage(id);
        const notes = Array.isArray(storage.notes) ? [...storage.notes] : [];
        const idx = notes.findIndex((n) => String(n?.id || '').trim() === id);
        if (idx < 0) return false;
        const cur = notes[idx] && typeof notes[idx] === 'object' ? notes[idx] : {};
        const next = { ...cur };
        if (Object.prototype.hasOwnProperty.call(patch, 'color')) {
            const c = __tmNormalizeWhiteboardNoteColor(patch.color);
            if (c) next.color = c;
            else delete next.color;
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'fontSize')) {
            next.fontSize = __tmNormalizeWhiteboardNoteFontSize(patch.fontSize);
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'width')) {
            const w = __tmNormalizeWhiteboardNoteWidth(patch.width);
            if (w > 0) next.width = w;
            else delete next.width;
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'height')) {
            const h = __tmNormalizeWhiteboardNoteHeight(patch.height);
            if (h > 0) next.height = h;
            else delete next.height;
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'bold')) {
            next.bold = __tmNormalizeWhiteboardNoteBold(patch.bold);
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'theme')) {
            next.type = 'sticky';
            next.theme = __tmNormalizeWhiteboardStickyTheme(patch.theme);
        }
        next.updatedAt = String(Date.now());
        notes[idx] = next;
        __tmSaveWhiteboardNotesToStorage(storage, notes);
        try { await SettingsStore.save(); } catch (e) {}
        return true;
    }

    window.tmWhiteboardAdjustNoteFontSize = async function(noteId, delta, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const id = String(noteId || '').trim();
        if (!id) return;
        const note = __tmGetWhiteboardNoteById(id).note;
        const cur = __tmNormalizeWhiteboardNoteFontSize(note?.fontSize);
        const d = Number(delta);
        const next = __tmNormalizeWhiteboardNoteFontSize(cur + (Number.isFinite(d) ? d : 0));
        const ok = await __tmUpdateWhiteboardNoteStyle(id, { fontSize: next });
        if (!ok) return;
        state.whiteboardSelectedNoteId = id;
        render();
    };

    window.tmWhiteboardSetStickyTheme = async function(noteId, theme, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const id = String(noteId || '').trim();
        if (!id) return;
        const ok = await __tmUpdateWhiteboardNoteStyle(id, { theme });
        if (!ok) return;
        state.whiteboardSelectedNoteId = id;
        render();
    };

    window.tmWhiteboardSetNoteColor = async function(noteId, color, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const id = String(noteId || '').trim();
        if (!id) return;
        const ok = await __tmUpdateWhiteboardNoteStyle(id, { color: color });
        if (!ok) return;
        state.whiteboardSelectedNoteId = id;
        render();
    };

    window.tmWhiteboardToggleNoteBold = async function(noteId, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const id = String(noteId || '').trim();
        if (!id) return;
        const note = __tmGetWhiteboardNoteById(id).note;
        const next = !__tmNormalizeWhiteboardNoteBold(note?.bold);
        const ok = await __tmUpdateWhiteboardNoteStyle(id, { bold: next });
        if (!ok) return;
        state.whiteboardSelectedNoteId = id;
        render();
    };

    window.tmWhiteboardDeleteNote = async function(noteId, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const id = String(noteId || '').trim();
        if (!id) return;
        const storage = __tmGetWhiteboardNoteStorage(id);
        const notes = Array.isArray(storage.notes) ? storage.notes : [];
        if (!notes.some((n) => String(n?.id || '').trim() === id)) return;
        __tmPushWhiteboardHistorySnapshot('delete-note');
        __tmSaveWhiteboardNotesToStorage(storage, notes.filter((n) => String(n?.id || '').trim() !== id));
        __tmRemoveWhiteboardFrameMemberIds({ noteIds: [id] }, { persist: false });
        if (String(state.whiteboardSelectedNoteId || '').trim() === id) state.whiteboardSelectedNoteId = '';
        try { await SettingsStore.save(); } catch (e) {}
        render();
    };

    window.tmWhiteboardDeleteMultiSelected = async function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const taskIds = Array.from(new Set((Array.isArray(state.whiteboardMultiSelectedTaskIds) ? state.whiteboardMultiSelectedTaskIds : []).map((x) => String(x || '').trim()).filter(Boolean)));
        const noteIds = Array.from(new Set((Array.isArray(state.whiteboardMultiSelectedNoteIds) ? state.whiteboardMultiSelectedNoteIds : []).map((x) => String(x || '').trim()).filter(Boolean)));
        const linkKeys = Array.from(new Set((Array.isArray(state.whiteboardMultiSelectedLinkKeys) ? state.whiteboardMultiSelectedLinkKeys : []).map((x) => String(x || '').trim()).filter(Boolean)));
        const strokeIds = Array.from(new Set((Array.isArray(state.whiteboardMultiSelectedStrokeIds) ? state.whiteboardMultiSelectedStrokeIds : []).map((x) => String(x || '').trim()).filter(Boolean)));
        if (!taskIds.length && !noteIds.length && !linkKeys.length && !strokeIds.length) return;
        const isGlobalSelection = typeof __tmIsWhiteboardGlobalCanvasActive === 'function' && __tmIsWhiteboardGlobalCanvasActive();
        const allTaskIds = new Set();
        taskIds.forEach((id) => {
            __tmWhiteboardCollectTaskTreeIds(id, { includeRoot: true, includeDetached: false, includeSnapshotTree: true })
                .forEach((tid) => allTaskIds.add(String(tid || '').trim()));
        });
        __tmPushWhiteboardHistorySnapshot('delete-multi');
        if (isGlobalSelection) {
            const groupId = __tmGetWhiteboardGlobalBoardGroupId();
            const board = __tmGetWhiteboardGlobalBoardState(groupId);
            const nodePos = (board?.nodePos && typeof board.nodePos === 'object') ? { ...board.nodePos } : {};
            const placedTaskIds = (board?.placedTaskIds && typeof board.placedTaskIds === 'object') ? { ...board.placedTaskIds } : {};
            const detachedChildren = (board?.detachedChildren && typeof board.detachedChildren === 'object') ? { ...board.detachedChildren } : {};
            allTaskIds.forEach((tid) => {
                if (!tid) return;
                delete nodePos[tid];
                delete placedTaskIds[tid];
                delete detachedChildren[tid];
            });
            __tmPatchWhiteboardGlobalBoardState(groupId, { nodePos, placedTaskIds, detachedChildren }, { keepEmpty: true });
        } else {
            allTaskIds.forEach((tid) => {
                if (!tid) return;
                __tmSetWhiteboardTaskPlaced(tid, false, { persist: false });
            });
        }
        const snapshotIds = Array.from(allTaskIds).filter((tid) => {
            const k = String(tid || '').trim();
            if (!k) return false;
            if (state.flatTasks?.[k]) return false;
            return !!__tmGetWhiteboardCardSnapshot(k);
        });
        __tmDeleteWhiteboardSnapshotTasks(snapshotIds);
        if (allTaskIds.size && !isGlobalSelection) {
            const links = __tmGetManualTaskLinks().filter((x) => {
                const from = String(x?.from || '').trim();
                const to = String(x?.to || '').trim();
                return !allTaskIds.has(from) && !allTaskIds.has(to);
            });
            __tmSetManualTaskLinks(links);
        }
        if (linkKeys.length) {
            const selectedSet = new Set(linkKeys);
            const globalCanvasDocId = typeof __tmGetWhiteboardGlobalCanvasDocId === 'function'
                ? __tmGetWhiteboardGlobalCanvasDocId()
                : '__tm_global_whiteboard__';
            const hasGlobalSelectedLinks = linkKeys.some((key) => String(key || '').startsWith(`${globalCanvasDocId}::`));
            if (hasGlobalSelectedLinks && typeof __tmGetWhiteboardGlobalTaskLinks === 'function' && typeof __tmSetWhiteboardGlobalTaskLinks === 'function') {
                const globalLinks = __tmGetWhiteboardGlobalTaskLinks().filter((x) => {
                    const key = `${globalCanvasDocId}::${String(x?.id || '').trim()}`;
                    return !selectedSet.has(key);
                });
                __tmSetWhiteboardGlobalTaskLinks(globalLinks, '', { keepEmpty: true });
            }
            const links = __tmGetManualTaskLinks().filter((x) => {
                const key = `${String(x?.docId || '').trim()}::${String(x?.id || '').trim()}`;
                return !selectedSet.has(key);
            });
            __tmSetManualTaskLinks(links);
        }
        if (noteIds.length) {
            const noteSet = new Set(noteIds);
            const storage = isGlobalSelection ? __tmGetWhiteboardNoteStorage() : { scope: 'doc', notes: Array.isArray(SettingsStore.data.whiteboardNotes) ? SettingsStore.data.whiteboardNotes : [] };
            const notes = Array.isArray(storage.notes) ? storage.notes : [];
            __tmSaveWhiteboardNotesToStorage(storage, notes.filter((n) => !noteSet.has(String(n?.id || '').trim())));
        }
        if (strokeIds.length) {
            __tmDeleteWhiteboardStrokesByIds(strokeIds, { render: false, persist: false, history: false });
        }
        __tmRemoveWhiteboardFrameMemberIds({ taskIds, noteIds, strokeIds }, { persist: false });
        state.whiteboardSelectedTaskId = '';
        state.whiteboardSelectedNoteId = '';
        state.whiteboardSelectedFrameId = '';
        state.whiteboardSelectedLinkId = '';
        state.whiteboardSelectedLinkDocId = '';
        state.whiteboardMultiSelectedLinkKeys = [];
        __tmRemoveWhiteboardPoolSelectionIds(Array.from(allTaskIds));
        __tmApplyWhiteboardCardSelectionDom('');
        __tmClearWhiteboardMultiSelection();
        try { SettingsStore.syncToLocal(); } catch (e) {}
        try { await SettingsStore.save(); } catch (e) {}
        render();
    };

    window.tmWhiteboardAutoConnectMultiSelected = async function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const taskIds = Array.from(new Set((Array.isArray(state.whiteboardMultiSelectedTaskIds) ? state.whiteboardMultiSelectedTaskIds : []).map((x) => String(x || '').trim()).filter(Boolean)));
        if (taskIds.length < 2) return;
        const body = state.modal?.querySelector?.('#tmWhiteboardBody');
        if (!(body instanceof Element)) return;
        const pickNode = (taskId) => {
            try {
                return body.querySelector(`.tm-whiteboard-node[data-task-id="${CSS.escape(taskId)}"]`);
            } catch (e) {
                return null;
            }
        };
        const eligibleTaskIds = taskIds.filter((id) => {
            const el = pickNode(id);
            if (!(el instanceof HTMLElement)) return false;
            if (!el.classList.contains('tm-whiteboard-node--sub')) return true;
            return __tmIsWhiteboardChildDetached(id);
        });
        if (eligibleTaskIds.length < 2) {
            try { hint('ℹ 自动连线仅处理最高层卡片（已拖出的子任务除外）', 'info'); } catch (e) {}
            return;
        }
        const items = eligibleTaskIds.map((id) => {
            const el = pickNode(id);
            if (!(el instanceof HTMLElement)) return null;
            const rect = el.getBoundingClientRect();
            const docId = String(el.getAttribute('data-doc-id') || __tmGetTaskDocIdById(id) || '').trim();
            if (!docId) return null;
            return {
                id,
                docId,
                left: Number(rect.left) || 0,
                top: Number(rect.top) || 0,
                right: Number(rect.right) || 0,
                bottom: Number(rect.bottom) || 0,
            };
        }).filter(Boolean);
        if (items.length < 2) return;

        const byDoc = new Map();
        items.forEach((it) => {
            const did = String(it.docId || '').trim();
            if (!did) return;
            if (!byDoc.has(did)) byDoc.set(did, []);
            byDoc.get(did).push(it);
        });
        if (!byDoc.size) return;

        const buildRowsOrder = (arr) => {
            const remaining = arr.slice().sort((a, b) => (a.top - b.top) || (a.left - b.left));
            const rows = [];
            while (remaining.length) {
                const anchor = remaining.shift();
                const rowBottom = Number(anchor.bottom) || (Number(anchor.top) + 80);
                const row = [anchor];
                for (let i = remaining.length - 1; i >= 0; i--) {
                    const x = remaining[i];
                    if ((Number(x.top) || 0) < rowBottom) {
                        row.push(x);
                        remaining.splice(i, 1);
                    }
                }
                row.sort((a, b) => (a.left - b.left) || (a.top - b.top));
                rows.push(row);
            }
            rows.sort((a, b) => ((a[0]?.top || 0) - (b[0]?.top || 0)) || ((a[0]?.left || 0) - (b[0]?.left || 0)));
            return rows.flatMap((r) => r);
        };

        const isGlobalAutoConnect = typeof __tmIsWhiteboardGlobalCanvasActive === 'function'
            && __tmIsWhiteboardGlobalCanvasActive()
            && typeof __tmGetWhiteboardGlobalTaskLinks === 'function'
            && typeof __tmSetWhiteboardGlobalTaskLinks === 'function';
        if (isGlobalAutoConnect) {
            const ordered = buildRowsOrder(items);
            const manual = __tmGetWhiteboardGlobalTaskLinks();
            let added = 0;
            let skipped = 0;
            for (let i = 1; i < ordered.length; i++) {
                const prev = ordered[i - 1] || {};
                const cur = ordered[i] || {};
                const fromId = String(prev.id || '').trim();
                const toId = String(cur.id || '').trim();
                if (!fromId || !toId || fromId === toId) continue;
                const exists = manual.some((x) => String(x?.from || '') === fromId && String(x?.to || '') === toId);
                if (exists) {
                    skipped++;
                    continue;
                }
                manual.push({
                    id: `global_link_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    from: fromId,
                    to: toId,
                    fromDocId: String(prev.docId || '').trim(),
                    toDocId: String(cur.docId || '').trim(),
                    createdAt: String(Date.now()),
                });
                added++;
            }
            if (!added) {
                try { hint('ℹ 未新增连线（可能已存在）', 'info'); } catch (e) {}
                return;
            }
            __tmPushWhiteboardHistorySnapshot('auto-connect-links');
            __tmSetWhiteboardGlobalTaskLinks(manual, '', { keepEmpty: true });
            try { await SettingsStore.save(); } catch (e) {}
            try { hint(`✅ 已新增 ${added} 条连线${skipped ? `（跳过 ${skipped} 条）` : ''}`, 'success'); } catch (e) {}
            __tmScheduleWhiteboardEdgeRedraw();
            render();
            return;
        }

        const manual = __tmGetManualTaskLinks();
        let added = 0;
        let skipped = 0;
        byDoc.forEach((arr, docId) => {
            if (!Array.isArray(arr) || arr.length < 2) return;
            const ordered = buildRowsOrder(arr);
            for (let i = 1; i < ordered.length; i++) {
                const fromId = String(ordered[i - 1]?.id || '').trim();
                const toId = String(ordered[i]?.id || '').trim();
                if (!fromId || !toId || fromId === toId) continue;
                const check = __tmCanLinkTasks(fromId, toId);
                if (!check.ok) {
                    skipped++;
                    continue;
                }
                const did = String(check.docId || docId || '').trim();
                if (!did) {
                    skipped++;
                    continue;
                }
                const exists = manual.some((x) => String(x?.from || '') === fromId && String(x?.to || '') === toId && String(x?.docId || '') === did);
                if (exists) {
                    skipped++;
                    continue;
                }
                manual.push({
                    id: `link_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    from: fromId,
                    to: toId,
                    docId: did,
                    createdAt: String(Date.now()),
                });
                added++;
            }
        });
        if (!added) {
            try { hint('ℹ 未新增连线（可能已存在或跨文档）', 'info'); } catch (e) {}
            return;
        }
        __tmPushWhiteboardHistorySnapshot('auto-connect-links');
        __tmSetManualTaskLinks(manual);
        try { await SettingsStore.save(); } catch (e) {}
        try { hint(`✅ 已新增 ${added} 条连线${skipped ? `（跳过 ${skipped} 条）` : ''}`, 'success'); } catch (e) {}
        __tmScheduleWhiteboardEdgeRedraw();
        render();
    };

    window.tmWhiteboardEditNote = function(noteId, docId, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        const t = Number(state.whiteboardNoteClickTimer) || 0;
        if (t) {
            try { clearTimeout(t); } catch (e) {}
            state.whiteboardNoteClickTimer = 0;
        }
        const currentTool = String(SettingsStore.data.whiteboardTool || 'pan').trim();
        if (currentTool !== 'pan' && currentTool !== 'sticky') return;
        const id = String(noteId || '').trim();
        const did = String(docId || '').trim();
        if (!id || !did) return;
        const { note } = __tmGetWhiteboardNoteById(id);
        if (!note) return;
        const eventEl = ev?.currentTarget instanceof HTMLElement ? ev.currentTarget : null;
        const noteEl = (eventEl?.closest?.('.tm-whiteboard-note') instanceof HTMLElement)
            ? eventEl.closest('.tm-whiteboard-note')
            : state.modal?.querySelector?.(`.tm-whiteboard-note[data-note-id="${CSS.escape(id)}"][data-doc-id="${CSS.escape(did)}"]`);
        const docBody = (noteEl instanceof HTMLElement ? noteEl.closest('.tm-whiteboard-doc-body[data-doc-id]') : null)
            || state.modal?.querySelector?.(`.tm-whiteboard-doc-body[data-doc-id="${CSS.escape(did)}"]`);
        if (!(docBody instanceof HTMLElement)) return;
        __tmClearWhiteboardMultiSelection();
        state.whiteboardSelectedNoteId = id;
        state.whiteboardSelectedTaskId = '';
        __tmApplyWhiteboardCardSelectionDom('');
        state.whiteboardSelectedLinkId = '';
        state.whiteboardSelectedLinkDocId = '';
        __tmScheduleWhiteboardEdgeRedraw();
        const allView = !(state.activeDocId && state.activeDocId !== 'all');
        const isGlobalNote = __tmIsWhiteboardGlobalElement(docBody);
        const offX = (allView && !isGlobalNote) ? (Number(docBody.dataset?.frameOffsetX) || 0) : 0;
        const offY = (allView && !isGlobalNote) ? (Number(docBody.dataset?.frameOffsetY) || 0) : 0;
        let x = (Number.isFinite(Number(note?.x)) ? Number(note.x) : 24) + offX;
        let y = (Number.isFinite(Number(note?.y)) ? Number(note.y) : 24) + offY;
        try {
            if (noteEl instanceof HTMLElement) {
                const sx = Number((noteEl.style.left || '').replace('px', ''));
                const sy = Number((noteEl.style.top || '').replace('px', ''));
                if (Number.isFinite(sx)) x = sx;
                if (Number.isFinite(sy)) y = sy;
                // 兜底：当 style 坐标不可用时，再退回到基于实际渲染位置的换算
                if (!Number.isFinite(sx) || !Number.isFinite(sy)) {
                    const zoom = Math.max(0.01, Number(__tmGetWhiteboardView()?.zoom) || 1);
                    const nr = noteEl.getBoundingClientRect();
                    const dr = docBody.getBoundingClientRect();
                    const rx = (nr.left - dr.left) / zoom;
                    const ry = (nr.top - dr.top) / zoom;
                    if (!Number.isFinite(sx) && Number.isFinite(rx)) x = rx;
                    if (!Number.isFinite(sy) && Number.isFinite(ry)) y = ry;
                }
            }
        } catch (e) {}
        if (__tmIsWhiteboardStickyNote(note)) {
            const noteWidth = __tmNormalizeWhiteboardNoteWidth(note?.width) || Number(noteEl?.offsetWidth) || 260;
            __tmOpenWhiteboardStickyEditor(docBody, did, x, y, {
                noteId: id,
                title: String(note?.title || ''),
                text: String(note?.text || ''),
                theme: __tmNormalizeWhiteboardStickyTheme(note?.theme),
                width: noteWidth,
                editorWidth: Math.max(360, noteWidth),
                offsetX: offX,
                offsetY: offY,
            });
            return;
        }
        __tmOpenWhiteboardNoteEditor(docBody, did, x, y, {
            noteId: id,
            text: String(note?.text || ''),
            offsetX: offX,
            offsetY: offY,
            fontSize: __tmNormalizeWhiteboardNoteFontSize(note?.fontSize),
            color: __tmNormalizeWhiteboardNoteColor(note?.color) || '',
            bold: __tmNormalizeWhiteboardNoteBold(note?.bold),
        });
    };

    window.tmWhiteboardNoteMouseDown = function(ev, noteId, docId) {
        if (state.viewMode !== 'whiteboard') return;
        const tool = String(SettingsStore.data.whiteboardTool || 'pan');
        if (tool !== 'pan' && tool !== 'text' && tool !== 'sticky' && tool !== 'select') return;
        if (Number(ev?.button) !== 0) return;
        if (state.whiteboardNoteEditor) return;
        // 双击用于编辑，不应进入拖拽流程，否则 mouseup-render 会把编辑框顶掉
        if (Number(ev?.detail) >= 2) return;
        const target = ev?.target;
        if (target && target.closest && target.closest('.tm-whiteboard-note-resize,.tm-whiteboard-note-width-resize,.tm-whiteboard-note-height-resize')) return;
        if (target && target.closest && target.closest('.tm-btn,input,button,select,textarea,label,a')) return;
        const id = String(noteId || '').trim();
        const did = String(docId || '').trim();
        if (!id || !did) return;
        const noteEl = ev?.currentTarget instanceof HTMLElement ? ev.currentTarget : (target?.closest?.('.tm-whiteboard-note') || null);
        if (!(noteEl instanceof HTMLElement)) return;
        const x0 = Number(noteEl.style.left.replace('px', '')) || 0;
        const y0 = Number(noteEl.style.top.replace('px', '')) || 0;
        const zoom = __tmGetWhiteboardView().zoom || 1;
        const sx = Number(ev?.clientX) || 0;
        const sy = Number(ev?.clientY) || 0;
        const multiTaskIds = Array.isArray(state.whiteboardMultiSelectedTaskIds)
            ? state.whiteboardMultiSelectedTaskIds.map((x) => String(x || '').trim()).filter(Boolean)
            : [];
        const multiNoteIds = Array.isArray(state.whiteboardMultiSelectedNoteIds)
            ? state.whiteboardMultiSelectedNoteIds.map((x) => String(x || '').trim()).filter(Boolean)
            : [];
        let groupDragItems = [];
        const wantsGroupDrag = (multiTaskIds.length + multiNoteIds.length > 1) && multiNoteIds.includes(id);
        if (wantsGroupDrag) {
            const uniqTaskIds = Array.from(new Set(multiTaskIds));
            const uniqNoteIds = Array.from(new Set(multiNoteIds));
            const taskItems = uniqTaskIds.map((tid) => {
                const cardEl = state.modal?.querySelector?.(`.tm-whiteboard-card[data-task-id="${CSS.escape(tid)}"]`);
                if (!(cardEl instanceof HTMLElement)) return null;
                if (cardEl.classList.contains('tm-whiteboard-node--sub')) return null;
                const sx0 = Number(cardEl.dataset?.x);
                const sy0 = Number(cardEl.dataset?.y);
                const tx0 = Number.isFinite(sx0) ? sx0 : Number((cardEl.style.left || '').replace('px', '')) || 0;
                const ty0 = Number.isFinite(sy0) ? sy0 : Number((cardEl.style.top || '').replace('px', '')) || 0;
                const tdid = String(cardEl.getAttribute('data-doc-id') || '').trim();
                if (!tdid) return null;
                return { kind: 'task', id: tid, did: tdid, el: cardEl, x0: tx0, y0: ty0, global: __tmIsWhiteboardGlobalElement(cardEl) };
            }).filter(Boolean);
            const noteItems = uniqNoteIds.map((nid) => {
                const nEl = state.modal?.querySelector?.(`.tm-whiteboard-note[data-note-id="${CSS.escape(nid)}"]`);
                if (!(nEl instanceof HTMLElement)) return null;
                const nx0 = Number((nEl.style.left || '').replace('px', '')) || 0;
                const ny0 = Number((nEl.style.top || '').replace('px', '')) || 0;
                const ndid = String(nEl.getAttribute('data-doc-id') || '').trim();
                if (!ndid) return null;
                return { kind: 'note', id: nid, did: ndid, el: nEl, x0: nx0, y0: ny0, global: __tmIsWhiteboardGlobalElement(nEl) };
            }).filter(Boolean);
            groupDragItems = taskItems.concat(noteItems);
        }
        const useGroupDrag = groupDragItems.length > 1;
        if (!useGroupDrag) {
            __tmClearWhiteboardMultiSelection();
            state.whiteboardSelectedNoteId = id;
            state.whiteboardSelectedTaskId = '';
            state.whiteboardSelectedFrameId = '';
            __tmApplyWhiteboardCardSelectionDom('');
            state.whiteboardSelectedLinkId = '';
            state.whiteboardSelectedLinkDocId = '';
        } else {
            state.whiteboardSelectedTaskId = '';
            state.whiteboardSelectedNoteId = '';
            state.whiteboardSelectedFrameId = '';
            state.whiteboardSelectedLinkId = '';
            state.whiteboardSelectedLinkDocId = '';
            __tmApplyWhiteboardCardSelectionDom('');
            __tmApplyWhiteboardMultiSelectionDom();
            __tmRenderWhiteboardMultiTools(__tmComputeWhiteboardMultiSelectionRect());
        }
        state.whiteboardNoteDrag = { id, did, x0, y0, sx, sy, noteEl, moved: false, group: useGroupDrag ? groupDragItems : null, historyPushed: false };
        const onMove = (e2) => {
            const d = state.whiteboardNoteDrag;
            if (!d) return;
            const dx = ((Number(e2?.clientX) || 0) - d.sx) / (zoom || 1);
            const dy = ((Number(e2?.clientY) || 0) - d.sy) / (zoom || 1);
            if (!d.moved) {
                if (Math.abs(dx) + Math.abs(dy) < 3) return;
                d.moved = true;
            }
            if (!d.historyPushed) {
                __tmPushWhiteboardHistorySnapshot('move-note');
                d.historyPushed = true;
            }
            if (Array.isArray(d.group) && d.group.length > 1) {
                d.group.forEach((g) => {
                    if (!g || !(g.el instanceof HTMLElement)) return;
                    const nx = Math.round(Number(g.x0 || 0) + dx);
                    const ny = Math.round(Number(g.y0 || 0) + dy);
                    g.el.style.left = `${nx}px`;
                    g.el.style.top = `${ny}px`;
                    if (g.kind === 'task') {
                        g.el.dataset.x = String(nx);
                        g.el.dataset.y = String(ny);
                        if (g.global) {
                            __tmSetGlobalWhiteboardNodePlacement(g.id, g.did, nx, ny, { persist: false, manual: true });
                        } else {
                            __tmSetWhiteboardNodePos(g.id, g.did, nx, ny, { persist: false, manual: true });
                            __tmSetWhiteboardTaskPlaced(g.id, true, { persist: false });
                        }
                    }
                });
                __tmScheduleWhiteboardEdgeRedraw();
                __tmRenderWhiteboardMultiTools(__tmComputeWhiteboardMultiSelectionRect());
                return;
            }
            const nx = Math.round(d.x0 + dx);
            const ny = Math.round(d.y0 + dy);
            d.noteEl.style.left = `${nx}px`;
            d.noteEl.style.top = `${ny}px`;
        };
        const onUp = async () => {
            try { document.removeEventListener('mousemove', onMove, true); } catch (e) {}
            try { document.removeEventListener('mouseup', onUp, true); } catch (e) {}
            const d = state.whiteboardNoteDrag;
            state.whiteboardNoteDrag = null;
            if (!d) return;
            if (!d.moved) {
                __tmScheduleWhiteboardEdgeRedraw();
                render();
                return;
            }
            if (Array.isArray(d.group) && d.group.length > 1) {
                const allView = !(state.activeDocId && state.activeDocId !== 'all');
                const now = String(Date.now());
                const globalStorage = (d.group || []).some((g) => g?.kind === 'note' && g.global)
                    ? __tmGetWhiteboardNoteStorage()
                    : null;
                const notes = globalStorage
                    ? [...globalStorage.notes]
                    : (Array.isArray(SettingsStore.data.whiteboardNotes) ? [...SettingsStore.data.whiteboardNotes] : []);
                d.group.forEach((g) => {
                    if (!g || g.kind !== 'note' || !(g.el instanceof HTMLElement)) return;
                    const nx = Number((g.el.style.left || '').replace('px', '')) || Number(g.x0 || 0);
                    const ny = Number((g.el.style.top || '').replace('px', '')) || Number(g.y0 || 0);
                    const idx = notes.findIndex((n) => String(n?.id || '').trim() === String(g.id || '').trim());
                    if (idx < 0) return;
                    const offX = (allView && !g.global) ? (Number(g.el.parentElement?.dataset?.frameOffsetX) || 0) : 0;
                    const offY = (allView && !g.global) ? (Number(g.el.parentElement?.dataset?.frameOffsetY) || 0) : 0;
                    notes[idx] = { ...(notes[idx] || {}), docId: g.did, x: Math.round(nx - offX), y: Math.round(ny - offY), updatedAt: now };
                });
                if (globalStorage) {
                    __tmSaveWhiteboardNotesToStorage(globalStorage, notes);
                } else {
                    SettingsStore.data.whiteboardNotes = notes;
                    try { WhiteboardStore?.syncFromSettings?.(SettingsStore.data, 'whiteboard-notes'); } catch (e) {}
                    try { SettingsStore.syncToLocal(); } catch (e) {}
                }
                d.group.forEach((g) => {
                    if (!g || !(g.el instanceof HTMLElement)) return;
                    const body = g.el.closest('.tm-whiteboard-doc-body[data-doc-id]');
                    if (!(body instanceof HTMLElement)) return;
                    if (g.kind === 'task') __tmRefreshWhiteboardFrameMembershipForElement('task', g.id, body, { persist: false });
                    if (g.kind === 'note') __tmRefreshWhiteboardFrameMembershipForElement('note', g.id, body, { persist: false });
                });
                try { await SettingsStore.save(); } catch (e) {}
                render();
                return;
            }
            const nx = Number(d.noteEl.style.left.replace('px', '')) || d.x0;
            const ny = Number(d.noteEl.style.top.replace('px', '')) || d.y0;
            const allView = !(state.activeDocId && state.activeDocId !== 'all');
            const isGlobalNote = __tmIsWhiteboardGlobalElement(d.noteEl);
            const storage = isGlobalNote
                ? __tmGetWhiteboardNoteStorage(d.id)
                : { scope: 'doc', notes: Array.isArray(SettingsStore.data.whiteboardNotes) ? [...SettingsStore.data.whiteboardNotes] : [] };
            const targetNotes = Array.isArray(storage.notes) ? [...storage.notes] : [];
            const targetIdx = targetNotes.findIndex((n) => String(n?.id || '').trim() === d.id);
            if (targetIdx >= 0) {
                const offX = (allView && !isGlobalNote) ? (Number(d.noteEl.parentElement?.dataset?.frameOffsetX) || 0) : 0;
                const offY = (allView && !isGlobalNote) ? (Number(d.noteEl.parentElement?.dataset?.frameOffsetY) || 0) : 0;
                targetNotes[targetIdx] = { ...(targetNotes[targetIdx] || {}), docId: d.did, x: Math.round(nx - offX), y: Math.round(ny - offY), updatedAt: String(Date.now()) };
                __tmSaveWhiteboardNotesToStorage(storage, targetNotes);
                const body = d.noteEl.closest('.tm-whiteboard-doc-body[data-doc-id]');
                if (body instanceof HTMLElement) __tmRefreshWhiteboardFrameMembershipForElement('note', d.id, body, { persist: false });
                try { await SettingsStore.save(); } catch (e) {}
            }
            render();
        };
        try { document.addEventListener('mousemove', onMove, true); } catch (e) {}
        try { document.addEventListener('mouseup', onUp, true); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
    };

    window.tmWhiteboardNoteResizeStart = function(ev, noteId, docId) {
        if (state.viewMode !== 'whiteboard') return;
        if (Number(ev?.button) !== 0) return;
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
        const id = String(noteId || '').trim();
        const did = String(docId || '').trim();
        if (!id || !did) return;
        const handle = ev?.currentTarget instanceof HTMLElement ? ev.currentTarget : null;
        const noteEl = (handle && handle.closest('.tm-whiteboard-note')) || (ev?.target?.closest?.('.tm-whiteboard-note'));
        if (!(noteEl instanceof HTMLElement)) return;
        const note = __tmGetWhiteboardNoteById(id).note;
        const startFont = __tmNormalizeWhiteboardNoteFontSize(note?.fontSize);
        const sx = Number(ev?.clientX) || 0;
        const sy = Number(ev?.clientY) || 0;
        noteEl.style.fontSize = `${startFont}px`;
        const onMove = (e2) => {
            const dx = (Number(e2?.clientX) || 0) - sx;
            const dy = (Number(e2?.clientY) || 0) - sy;
            const next = __tmNormalizeWhiteboardNoteFontSize(startFont + Math.round((dx + dy) / 12));
            noteEl.style.fontSize = `${next}px`;
            state.whiteboardNoteResize = { noteId: id, docId: did, fontSize: next };
        };
        const onUp = async () => {
            try { document.removeEventListener('mousemove', onMove, true); } catch (e) {}
            try { document.removeEventListener('mouseup', onUp, true); } catch (e) {}
            const st = (state.whiteboardNoteResize && String(state.whiteboardNoteResize.noteId || '').trim() === id)
                ? state.whiteboardNoteResize
                : null;
            state.whiteboardNoteResize = null;
            const next = __tmNormalizeWhiteboardNoteFontSize(st?.fontSize ?? startFont);
            await __tmUpdateWhiteboardNoteStyle(id, { fontSize: next });
            state.whiteboardSelectedNoteId = id;
            render();
        };
        try { document.addEventListener('mousemove', onMove, true); } catch (e) {}
        try { document.addEventListener('mouseup', onUp, true); } catch (e) {}
    };

    window.tmWhiteboardNoteResizeWidthStart = function(ev, noteId, docId) {
        if (state.viewMode !== 'whiteboard') return;
        if (Number(ev?.button) !== 0) return;
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
        const id = String(noteId || '').trim();
        const did = String(docId || '').trim();
        if (!id || !did) return;
        const handle = ev?.currentTarget instanceof HTMLElement ? ev.currentTarget : null;
        const noteEl = (handle && handle.closest('.tm-whiteboard-note')) || (ev?.target?.closest?.('.tm-whiteboard-note'));
        if (!(noteEl instanceof HTMLElement)) return;
        const startW = __tmNormalizeWhiteboardNoteWidth(Number(noteEl.getBoundingClientRect()?.width) || Number(noteEl.offsetWidth) || 0);
        const sx = Number(ev?.clientX) || 0;
        noteEl.style.width = `${startW}px`;
        if (!noteEl.classList.contains('tm-whiteboard-sticky')) {
            noteEl.style.whiteSpace = 'pre-wrap';
            noteEl.style.overflowWrap = 'anywhere';
        }
        const onMove = (e2) => {
            const dx = (Number(e2?.clientX) || 0) - sx;
            const next = __tmNormalizeWhiteboardNoteWidth(startW + dx);
            noteEl.style.width = `${next}px`;
            state.whiteboardNoteWidthResize = { noteId: id, docId: did, width: next };
        };
        const onUp = async () => {
            try { document.removeEventListener('mousemove', onMove, true); } catch (e) {}
            try { document.removeEventListener('mouseup', onUp, true); } catch (e) {}
            const st = (state.whiteboardNoteWidthResize && String(state.whiteboardNoteWidthResize.noteId || '').trim() === id)
                ? state.whiteboardNoteWidthResize
                : null;
            state.whiteboardNoteWidthResize = null;
            const next = __tmNormalizeWhiteboardNoteWidth(st?.width ?? startW);
            await __tmUpdateWhiteboardNoteStyle(id, { width: next });
            state.whiteboardSelectedNoteId = id;
            render();
        };
        try { document.addEventListener('mousemove', onMove, true); } catch (e) {}
        try { document.addEventListener('mouseup', onUp, true); } catch (e) {}
    };

    window.tmWhiteboardNoteResizeHeightStart = function(ev, noteId, docId) {
        if (state.viewMode !== 'whiteboard') return;
        if (Number(ev?.button) !== 0) return;
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
        const id = String(noteId || '').trim();
        const did = String(docId || '').trim();
        if (!id || !did) return;
        const handle = ev?.currentTarget instanceof HTMLElement ? ev.currentTarget : null;
        const noteEl = (handle && handle.closest('.tm-whiteboard-note')) || (ev?.target?.closest?.('.tm-whiteboard-note'));
        if (!(noteEl instanceof HTMLElement)) return;
        const startH = __tmNormalizeWhiteboardNoteHeight(Number(noteEl.getBoundingClientRect()?.height) || Number(noteEl.offsetHeight) || 0);
        const sy = Number(ev?.clientY) || 0;
        noteEl.style.height = `${startH}px`;
        const onMove = (e2) => {
            const dy = (Number(e2?.clientY) || 0) - sy;
            const next = __tmNormalizeWhiteboardNoteHeight(startH + dy);
            noteEl.style.height = `${next}px`;
            state.whiteboardNoteHeightResize = { noteId: id, docId: did, height: next };
        };
        const onUp = async () => {
            try { document.removeEventListener('mousemove', onMove, true); } catch (e) {}
            try { document.removeEventListener('mouseup', onUp, true); } catch (e) {}
            const st = (state.whiteboardNoteHeightResize && String(state.whiteboardNoteHeightResize.noteId || '').trim() === id)
                ? state.whiteboardNoteHeightResize
                : null;
            state.whiteboardNoteHeightResize = null;
            const next = __tmNormalizeWhiteboardNoteHeight(st?.height ?? startH);
            await __tmUpdateWhiteboardNoteStyle(id, { height: next });
            state.whiteboardSelectedNoteId = id;
            render();
        };
        try { document.addEventListener('mousemove', onMove, true); } catch (e) {}
        try { document.addEventListener('mouseup', onUp, true); } catch (e) {}
    };

    async function __tmCloseWhiteboardStickyEditorState(st, opts = {}) {
        const o = (opts && typeof opts === 'object') ? opts : {};
        const shell = st?.el instanceof HTMLElement ? st.el : null;
        const titleEl = st?.titleEl instanceof HTMLInputElement ? st.titleEl : null;
        const textEl = st?.textEl instanceof HTMLTextAreaElement ? st.textEl : null;
        const did = String(st?.docId || '').trim();
        const noteId = String(st?.noteId || '').trim();
        const x = Number(st?.x);
        const y = Number(st?.y);
        const ox = Number(st?.offsetX) || 0;
        const oy = Number(st?.offsetY) || 0;
        const theme = __tmNormalizeWhiteboardStickyTheme(st?.theme);
        const width = __tmNormalizeWhiteboardNoteWidth(st?.width) || 260;
        const title = String(titleEl?.value || '').trim();
        const text = __tmNormalizeRemarkMarkdown(textEl?.value || '');
        try { shell?.remove?.(); } catch (e) {}
        if (!o.save) return;
        if (!did || !Number.isFinite(x) || !Number.isFinite(y)) return;
        if (!title && !text) return;
        const allView = !(state.activeDocId && state.activeDocId !== 'all');
        const isGlobalNote = !!st?.globalBoard;
        const sx = Math.round(x - ((allView && !isGlobalNote) ? ox : 0));
        const sy = Math.round(y - ((allView && !isGlobalNote) ? oy : 0));
        const storage = isGlobalNote
            ? __tmGetWhiteboardNoteStorage(noteId)
            : { scope: 'doc', notes: Array.isArray(SettingsStore.data.whiteboardNotes) ? [...SettingsStore.data.whiteboardNotes] : [] };
        const notes0 = Array.isArray(storage.notes) ? [...storage.notes] : [];
        const now = String(Date.now());
        if (noteId) {
            const idx = notes0.findIndex((n) => String(n?.id || '').trim() === noteId);
            if (idx < 0) return;
            __tmPushWhiteboardHistorySnapshot('update-sticky');
            notes0[idx] = {
                ...(notes0[idx] || {}),
                type: 'sticky',
                docId: did,
                title,
                text,
                theme,
                width,
                x: sx,
                y: sy,
                updatedAt: now,
            };
            __tmSaveWhiteboardNotesToStorage(storage, notes0);
            try { await SettingsStore.save(); } catch (e) {}
            render();
            return;
        }
        __tmPushWhiteboardHistorySnapshot('add-sticky');
        notes0.push({
            id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            type: 'sticky',
            docId: did,
            title,
            text,
            theme,
            width,
            x: sx,
            y: sy,
            createdAt: now,
            updatedAt: now,
        });
        __tmSaveWhiteboardNotesToStorage(storage, notes0);
        try { await SettingsStore.save(); } catch (e) {}
        render();
    }

    async function __tmCloseWhiteboardNoteEditor(opts = {}) {
        const o = (opts && typeof opts === 'object') ? opts : {};
        const st = state.whiteboardNoteEditor;
        state.whiteboardNoteEditor = null;
        if (!st || typeof st !== 'object') return;
        if (String(st.kind || '').trim() === 'sticky') {
            await __tmCloseWhiteboardStickyEditorState(st, o);
            return;
        }
        const el = st.el;
        const did = String(st.docId || '').trim();
        const noteId = String(st.noteId || '').trim();
        const x = Number(st.x);
        const y = Number(st.y);
        const ox = Number(st.offsetX) || 0;
        const oy = Number(st.offsetY) || 0;
        const fs = __tmNormalizeWhiteboardNoteFontSize(st.fontSize);
        const c = __tmNormalizeWhiteboardNoteColor(st.color) || '';
        const bd = __tmNormalizeWhiteboardNoteBold(st.bold);
        let value = '';
        try { value = String(el?.value || '').trim(); } catch (e) {}
        try { el?.remove?.(); } catch (e) {}
        if (!o.save) return;
        if (!did || !Number.isFinite(x) || !Number.isFinite(y)) return;
        const allView = !(state.activeDocId && state.activeDocId !== 'all');
        const isGlobalNote = !!st?.globalBoard;
        const sx = Math.round(x - ((allView && !isGlobalNote) ? ox : 0));
        const sy = Math.round(y - ((allView && !isGlobalNote) ? oy : 0));
        const storage = isGlobalNote
            ? __tmGetWhiteboardNoteStorage(noteId)
            : { scope: 'doc', notes: Array.isArray(SettingsStore.data.whiteboardNotes) ? [...SettingsStore.data.whiteboardNotes] : [] };
        const notes0 = Array.isArray(storage.notes) ? [...storage.notes] : [];
        if (noteId) {
            const idx = notes0.findIndex((n) => String(n?.id || '').trim() === noteId);
            if (idx < 0 || !value) return;
            __tmPushWhiteboardHistorySnapshot('update-note');
            notes0[idx] = {
                ...(notes0[idx] || {}),
                docId: did,
                text: value,
                x: sx,
                y: sy,
                fontSize: fs,
                color: c,
                bold: bd,
                updatedAt: String(Date.now()),
            };
            __tmSaveWhiteboardNotesToStorage(storage, notes0);
            try { await SettingsStore.save(); } catch (e) {}
            render();
            return;
        }
        if (!value) return;
        const notes = notes0;
        __tmPushWhiteboardHistorySnapshot('add-note');
        notes.push({
            id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            docId: did,
            text: value,
            x: sx,
            y: sy,
            fontSize: fs,
            color: c,
            bold: bd,
            createdAt: String(Date.now()),
        });
        __tmSaveWhiteboardNotesToStorage(storage, notes);
        try { await SettingsStore.save(); } catch (e) {}
        render();
    }

    function __tmOpenWhiteboardNoteEditor(docBody, docId, x, y, opts = {}) {
        const o = (opts && typeof opts === 'object') ? opts : {};
        const bodyEl = docBody instanceof HTMLElement ? docBody : null;
        const did = String(docId || '').trim();
        if (!bodyEl || !did) return;
        const noteId = String(o.noteId || '').trim();
        const baseX = Math.round(Number(x) || 24);
        const baseY = Math.round(Number(y) || 24);
        const nx = baseX;
        const ny = baseY;
        const initialText = String(o.text || '');
        __tmCloseWhiteboardNoteEditor({ save: false });
        const input = document.createElement('textarea');
        input.className = 'tm-whiteboard-note-editor';
        input.style.left = `${nx}px`;
        input.style.top = `${ny}px`;
        const c0 = __tmNormalizeWhiteboardNoteColor(o.color) || '';
        const fs0 = __tmNormalizeWhiteboardNoteFontSize(o.fontSize);
        const bd0 = __tmNormalizeWhiteboardNoteBold(o.bold);
        if (c0) input.style.color = c0;
        input.style.fontSize = '16px';
        input.style.fontWeight = bd0 ? '700' : '400';
        input.placeholder = '输入文字，Enter保存，Esc取消';
        input.value = initialText;
        input.addEventListener('mousedown', (e) => {
            try { e.stopPropagation(); } catch (err) {}
        });
        input.addEventListener('click', (e) => {
            try { e.stopPropagation(); } catch (err) {}
        });
        input.addEventListener('keydown', async (e) => {
            if (e.key === 'Escape') {
                try { e.preventDefault(); } catch (err) {}
                try { e.stopPropagation(); } catch (err) {}
                await __tmCloseWhiteboardNoteEditor({ save: false });
                return;
            }
            if (e.key === 'Enter' && !e.shiftKey) {
                try { e.preventDefault(); } catch (err) {}
                try { e.stopPropagation(); } catch (err) {}
                await __tmCloseWhiteboardNoteEditor({ save: true });
            }
        });
        input.addEventListener('blur', async () => {
            await __tmCloseWhiteboardNoteEditor({ save: true });
        });
        bodyEl.appendChild(input);
        try { input.focus(); } catch (e) {}
        try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {}
        state.whiteboardNoteEditor = {
            el: input,
            docId: did,
            noteId,
            x: nx,
            y: ny,
            offsetX: Number(o.offsetX) || 0,
            offsetY: Number(o.offsetY) || 0,
            fontSize: fs0,
            color: c0,
            bold: bd0,
            globalBoard: __tmIsWhiteboardGlobalElement(bodyEl),
        };
    }

    function __tmOpenWhiteboardStickyEditor(docBody, docId, x, y, opts = {}) {
        const o = (opts && typeof opts === 'object') ? opts : {};
        const bodyEl = docBody instanceof HTMLElement ? docBody : null;
        const did = String(docId || '').trim();
        if (!bodyEl || !did) return;
        const noteId = String(o.noteId || '').trim();
        const nx = Math.round(Number(x) || 24);
        const ny = Math.round(Number(y) || 24);
        const initialTitle = String(o.title || '');
        const initialText = __tmNormalizeRemarkMarkdown(o.text || '');
        const initialTheme = __tmNormalizeWhiteboardStickyTheme(o.theme);
        const initialWidth = __tmNormalizeWhiteboardNoteWidth(o.width) || 260;
        const editorWidth = __tmNormalizeWhiteboardNoteWidth(o.editorWidth) || Math.max(360, initialWidth);
        __tmCloseWhiteboardNoteEditor({ save: false });

        const editor = document.createElement('div');
        editor.className = `tm-whiteboard-sticky-editor tm-whiteboard-sticky-editor--${initialTheme}`;
        editor.style.left = `${nx}px`;
        editor.style.top = `${ny}px`;
        editor.style.width = `${editorWidth}px`;
        editor.innerHTML = `
            <div class="tm-whiteboard-sticky-editor-head">
                <input class="tm-whiteboard-sticky-title-input" data-tm-sticky-title type="text" placeholder="便利贴标题">
            </div>
            <div class="tm-whiteboard-sticky-editor-toolbar" data-tm-whiteboard-sticky-toolbar>${__tmBuildRemarkMarkdownToolbarHtml({
                toolAttribute: 'data-tm-whiteboard-sticky-tool',
                buttonClass: 'bc-btn bc-btn--sm tm-whiteboard-sticky-editor-toolbar-btn',
                tooltipSide: 'top',
            })}</div>
            <textarea class="tm-whiteboard-sticky-textarea" data-tm-sticky-text rows="4" placeholder="输入正文，支持 Markdown"></textarea>
        `;
        const titleInput = editor.querySelector('[data-tm-sticky-title]');
        const textArea = editor.querySelector('[data-tm-sticky-text]');
        const toolbar = editor.querySelector('[data-tm-whiteboard-sticky-toolbar]');
        if (titleInput instanceof HTMLInputElement) titleInput.value = initialTitle;
        if (textArea instanceof HTMLTextAreaElement) textArea.value = initialText;

        const syncTextHeight = () => {
            if (!(textArea instanceof HTMLTextAreaElement)) return;
            try {
                textArea.style.height = 'auto';
                textArea.style.height = `${Math.max(92, Math.ceil(Number(textArea.scrollHeight) || 0))}px`;
            } catch (e) {}
        };
        const save = async () => {
            await __tmCloseWhiteboardNoteEditor({ save: true });
        };
        const cancel = async () => {
            await __tmCloseWhiteboardNoteEditor({ save: false });
        };

        editor.addEventListener('mousedown', (e) => {
            try { e.stopPropagation(); } catch (err) {}
        });
        editor.addEventListener('click', (e) => {
            try { e.stopPropagation(); } catch (err) {}
        });
        if (titleInput instanceof HTMLInputElement && textArea instanceof HTMLTextAreaElement) {
            titleInput.addEventListener('keydown', async (e) => {
                if (e.key === 'Escape') {
                    try { e.preventDefault(); } catch (err) {}
                    await cancel();
                    return;
                }
                if (e.key === 'Enter') {
                    try { e.preventDefault(); } catch (err) {}
                    try { textArea.focus(); } catch (err) {}
                }
            });
            textArea.addEventListener('input', syncTextHeight);
            textArea.addEventListener('keydown', async (e) => {
                if (e.key === 'Escape') {
                    try { e.preventDefault(); } catch (err) {}
                    await cancel();
                    return;
                }
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    try { e.preventDefault(); } catch (err) {}
                    await save();
                    return;
                }
                if (__tmHandleRemarkTextareaKeydown(textArea, e)) {
                    syncTextHeight();
                }
            });
        }
        if (toolbar instanceof HTMLElement && textArea instanceof HTMLTextAreaElement) {
            __tmBindRemarkMarkdownToolbar(toolbar, textArea, {
                toolAttribute: 'data-tm-whiteboard-sticky-tool',
                onAfterApply: () => {
                    syncTextHeight();
                    try { textArea.focus({ preventScroll: true }); } catch (e) { try { textArea.focus(); } catch (e2) {} }
                },
            });
        }
        editor.addEventListener('focusout', () => {
            try {
                setTimeout(() => {
                    if (!state.whiteboardNoteEditor || state.whiteboardNoteEditor.el !== editor) return;
                    const active = document.activeElement;
                    if (active instanceof Node && editor.contains(active)) return;
                    save().catch(() => null);
                }, 0);
            } catch (e) {}
        });

        bodyEl.appendChild(editor);
        state.whiteboardNoteEditor = {
            kind: 'sticky',
            el: editor,
            titleEl: titleInput,
            textEl: textArea,
            docId: did,
            noteId,
            x: nx,
            y: ny,
            offsetX: Number(o.offsetX) || 0,
            offsetY: Number(o.offsetY) || 0,
            theme: initialTheme,
            width: initialWidth,
            globalBoard: __tmIsWhiteboardGlobalElement(bodyEl),
        };
        syncTextHeight();
        try { titleInput?.focus?.(); } catch (e) {}
        try { titleInput?.setSelectionRange?.(titleInput.value.length, titleInput.value.length); } catch (e) {}
    }

    window.tmWhiteboardDocClick = async function(ev, docId) {
        const allView = !(state.activeDocId && state.activeDocId !== 'all');
        const tool = String(SettingsStore.data.whiteboardTool || 'pan').trim();
        if (tool !== 'text' && tool !== 'sticky') return;
        const target = ev?.target;
        if (target && target.closest && target.closest('.tm-whiteboard-node,.tm-task-link-dot,.tm-task-checkbox,.tm-whiteboard-navigator,.tm-whiteboard-navigator-reveal,.tm-btn,.tm-task-content-clickable,.tm-whiteboard-note,.tm-whiteboard-note-editor,.tm-whiteboard-sticky-editor,.tm-whiteboard-frame')) return;
        const globalActive = allView
            && typeof __tmIsWhiteboardGlobalCanvasActive === 'function'
            && __tmIsWhiteboardGlobalCanvasActive();
        let did = String(docId || '').trim();
        const point = __tmResolveWhiteboardCreatePointerInfo(ev, globalActive ? '' : did)
            || (did ? __tmResolveWhiteboardCreatePointerInfo(ev, did) : null);
        const docBody = (point?.body instanceof HTMLElement ? point.body : null)
            || target?.closest?.('.tm-whiteboard-doc-body[data-doc-id]')
            || (did ? state.modal?.querySelector?.(`.tm-whiteboard-doc-body[data-doc-id="${CSS.escape(did)}"]`) : null);
        if (!(docBody instanceof HTMLElement)) return;
        did = String(point?.docId || docBody.getAttribute('data-doc-id') || did).trim();
        if (!did) return;
        const isGlobalBody = __tmIsWhiteboardGlobalElement(docBody);
        if (allView && !isGlobalBody) return;
        const localX = Number.isFinite(Number(point?.localX)) ? Number(point.localX) : 24;
        const localY = Number.isFinite(Number(point?.localY)) ? Number(point.localY) : 24;
        if (tool === 'sticky') {
            if (typeof window.tmRequireFullFeature === 'function' && !window.tmRequireFullFeature('whiteboard-sticky', '白板便签工具')) return;
            __tmOpenWhiteboardStickyEditor(docBody, did, localX, localY);
            return;
        }
        __tmOpenWhiteboardNoteEditor(docBody, did, localX, localY, {
            fontSize: SettingsStore.data.whiteboardNoteDefaultFontSize,
        });
    };

    window.tmWhiteboardBoardClick = async function(ev) {
        if (Number(state.whiteboardSuppressClickUntil || 0) > Date.now()) return;
        const target = ev?.target;
        if (target && target.closest && target.closest('.tm-whiteboard-node,.tm-task-link-dot,.tm-task-checkbox,.tm-whiteboard-navigator,.tm-whiteboard-navigator-reveal,.tm-btn,.tm-task-content-clickable,.tm-whiteboard-note,.tm-whiteboard-note-editor,.tm-whiteboard-sticky-editor,.tm-whiteboard-frame,.tm-whiteboard-edge,.tm-whiteboard-doc-resize,.tm-whiteboard-link-tools,.tm-whiteboard-multi-tools')) return;
        const tool = String(SettingsStore.data.whiteboardTool || 'pan').trim();
        const isNoteCreateTool = tool === 'text' || tool === 'sticky';
        if (state.whiteboardNoteEditor && isNoteCreateTool) {
            await __tmCloseWhiteboardNoteEditor({ save: true });
            return;
        }
        let changed = false;
        if (String(state.whiteboardSelectedLinkId || '').trim()) {
            state.whiteboardSelectedLinkId = '';
            state.whiteboardSelectedLinkDocId = '';
            __tmScheduleWhiteboardEdgeRedraw();
            changed = true;
        }
        if (String(state.whiteboardSelectedNoteId || '').trim()) {
            state.whiteboardSelectedNoteId = '';
            changed = true;
        }
        if (String(state.whiteboardSelectedFrameId || '').trim()) {
            state.whiteboardSelectedFrameId = '';
            changed = true;
        }
        if (String(state.whiteboardSelectedStrokeId || '').trim()
            || (Array.isArray(state.whiteboardMultiSelectedStrokeIds) && state.whiteboardMultiSelectedStrokeIds.length)) {
            __tmClearWhiteboardStrokeSelection();
            changed = true;
        }
        if ((Array.isArray(state.whiteboardMultiSelectedTaskIds) && state.whiteboardMultiSelectedTaskIds.length)
            || (Array.isArray(state.whiteboardMultiSelectedNoteIds) && state.whiteboardMultiSelectedNoteIds.length)) {
            __tmClearWhiteboardMultiSelection();
            changed = true;
        }
        if (String(state.whiteboardSelectedTaskId || '').trim()) {
            state.whiteboardSelectedTaskId = '';
            __tmApplyWhiteboardCardSelectionDom('');
            changed = true;
            if (!isNoteCreateTool) {
                render();
                return;
            }
        } else if (!isNoteCreateTool) {
            if (changed) render();
            return;
        }
        const docBody = target?.closest?.('.tm-whiteboard-doc-body[data-doc-id]');
        if (docBody instanceof Element) {
            const docId = String(docBody.getAttribute('data-doc-id') || '').trim();
            if (docId) return window.tmWhiteboardDocClick(ev, docId);
        }
        const globalActive = isNoteCreateTool
            && !(state.activeDocId && state.activeDocId !== 'all')
            && typeof __tmIsWhiteboardGlobalCanvasActive === 'function'
            && __tmIsWhiteboardGlobalCanvasActive();
        if (globalActive) {
            const globalBody = __tmGetWhiteboardGlobalCanvasBody();
            const globalDocId = String(globalBody?.getAttribute?.('data-doc-id') || '').trim();
            if (globalDocId) return window.tmWhiteboardDocClick(ev, globalDocId);
        }
        const selectedDoc = (state.activeDocId && state.activeDocId !== 'all') ? String(state.activeDocId) : '';
        const firstDoc = selectedDoc || String((SettingsStore.data.selectedDocIds || [])[0] || '').trim();
        if (!firstDoc) return;
        return window.tmWhiteboardDocClick(ev, firstDoc);
    };

    window.tmWhiteboardBoardDblClick = async function(ev) {
        const allView = !(state.activeDocId && state.activeDocId !== 'all');
        const isGlobalCanvas = allView
            && typeof __tmIsWhiteboardGlobalCanvasActive === 'function'
            && __tmIsWhiteboardGlobalCanvasActive();
        if (allView && !isGlobalCanvas) return;
        const tool = String(SettingsStore.data.whiteboardTool || 'pan').trim();
        if (tool === 'text' || tool === 'sticky') return;
        const target = ev?.target;
        if (target && target.closest && target.closest('.tm-whiteboard-node,.tm-task-link-dot,.tm-task-checkbox,.tm-btn,.tm-task-content-clickable,.tm-whiteboard-note,.tm-whiteboard-note-editor,.tm-whiteboard-sticky-editor,.tm-whiteboard-edge,.tm-whiteboard-doc-resize,.tm-whiteboard-link-tools,.tm-whiteboard-multi-tools,input,button,select,textarea,label,a')) return;
        let globalCreateTarget = null;
        let did = '';
        try {
            if (isGlobalCanvas) {
                globalCreateTarget = await __tmResolveWhiteboardGlobalCreateTarget();
                if (!globalCreateTarget) return;
            } else {
                did = String(state.activeDocId || '').trim();
            }
        } catch (e) {
            try { hint(`❌ 新建失败: ${e?.message || String(e)}`, 'error'); } catch (e2) {}
            return;
        }
        if (!isGlobalCanvas && (!did || did === 'all')) return;
        const point = __tmResolveWhiteboardPointerInfo(ev, isGlobalCanvas ? '' : did);
        const localX = Number.isFinite(Number(point?.localX)) ? Number(point.localX) : 24;
        const localY = Number.isFinite(Number(point?.localY)) ? Number(point.localY) : 56;
        const newContent = await (async () => {
            const cx = Number(ev?.clientX) || 0;
            const cy = Number(ev?.clientY) || 0;
            const anchor = document.createElement('div');
            anchor.style.position = 'fixed';
            anchor.style.left = `${Math.round(cx)}px`;
            anchor.style.top = `${Math.round(cy)}px`;
            anchor.style.width = '1px';
            anchor.style.height = '1px';
            anchor.style.pointerEvents = 'none';
            anchor.style.opacity = '0';
            document.body.appendChild(anchor);
            return await new Promise((resolve) => {
                let settled = false;
                const finish = (v, forceEmpty = false) => {
                    if (settled) return;
                    settled = true;
                    try { anchor.remove(); } catch (e) {}
                    resolve(forceEmpty ? '' : String(v || '').trim());
                };
                __tmOpenInlineEditor(anchor, ({ editor, close, onCleanup }) => {
                    editor.style.minWidth = '220px';
                    editor.style.padding = '8px';
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.placeholder = '输入任务名称（留空取消）';
                    input.value = '';
                    input.style.width = '100%';
                    editor.appendChild(input);
                    const commit = () => {
                        const v = String(input.value || '').trim();
                        finish(v, !v);
                        close();
                    };
                    const cancel = () => {
                        finish('', true);
                        close();
                    };
                    const { wrap } = __tmBuildActions('创建', commit, cancel);
                    editor.appendChild(wrap);
                    input.onkeydown = (e) => {
                        if (e.key === 'Enter') commit();
                        if (e.key === 'Escape') cancel();
                    };
                    onCleanup(() => {
                        if (!settled) finish('', true);
                    });
                });
            });
        })();
        if (!newContent) return;
        try {
            if (isGlobalCanvas) {
                if (globalCreateTarget?.mode === 'dailyNote') {
                    did = String(await API.createDailyNote(globalCreateTarget.notebook) || '').trim();
                    if (!did) throw new Error('获取日记文档失败');
                } else {
                    did = String(globalCreateTarget?.docId || '').trim();
                }
                if (!did || did === 'all') throw new Error('默认新建文档无效');
            }
            const createTaskInDoc = globalThis.__tmRequireTaskOutbox?.('createTaskInDoc');
            if (typeof createTaskInDoc !== 'function') throw new Error('任务写入队列未就绪: createTaskInDoc');
            const fallbackAppendToBottom = isGlobalCanvas
                && globalCreateTarget?.mode === 'dailyNote'
                && SettingsStore.data.newTaskDailyNoteAppendToBottom === true;
            const insertOptions = isGlobalCanvas && typeof __tmResolveDefaultNewTaskInsertOptions === 'function'
                ? await __tmResolveDefaultNewTaskInsertOptions(did, globalCreateTarget?.mode === 'dailyNote' ? 'dailyNote' : 'doc', { contentCount: 1 })
                : { atTop: !fallbackAppendToBottom, appendToBottom: fallbackAppendToBottom };
            const { headingPatch, ...createInsertOptions } = (insertOptions && typeof insertOptions === 'object') ? insertOptions : {};
            const createdTaskId = await createTaskInDoc({
                docId: did,
                content: newContent,
                ...createInsertOptions,
                wait: false,
                skipOptimisticMainRefresh: true,
                skipOptimisticFilterWork: true,
            }, { wait: false });
            if (!createdTaskId) throw new Error('任务创建失败');
            if (headingPatch && typeof __tmApplyHeadingPatchToTaskLocal === 'function') {
                try { __tmApplyHeadingPatchToTaskLocal(createdTaskId, headingPatch, 'whiteboard-default-heading'); } catch (e) {}
            }
            __tmPushWhiteboardHistorySnapshot('add-task');
            if (isGlobalCanvas) {
                try {
                    __tmUpsertWhiteboardTaskSnapshot({
                        id: createdTaskId,
                        root_id: did,
                        docId: did,
                        content: newContent,
                        done: false,
                    });
                } catch (e) {}
                __tmSetGlobalWhiteboardNodePlacement(createdTaskId, did, localX, localY, { manual: true, persist: false });
            } else {
                __tmSetWhiteboardTaskPlaced(createdTaskId, true, { persist: false });
                __tmSetWhiteboardNodePos(createdTaskId, did, localX, localY, { manual: true, persist: false });
            }
            try { SettingsStore.syncToLocal(); } catch (e) {}
            try { SettingsStore.save(); } catch (e) {}
            state.whiteboardSelectedTaskId = createdTaskId;
            __tmApplyWhiteboardCardSelectionDom(createdTaskId);
            if (isGlobalCanvas) {
                try { render(); } catch (e) {}
            }
            try {
                __tmScheduleViewRefresh({
                    mode: 'current',
                    withFilters: false,
                    reason: 'whiteboard-create-task',
                    taskIds: [createdTaskId],
                });
            } catch (e) {
                try { __tmScheduleRender({ withFilters: false, reason: 'whiteboard-create-task' }); } catch (e2) {}
            }
        } catch (e) {
            try { hint(`❌ 新建失败，已撤销: ${e?.message || String(e)}`, 'error'); } catch (e2) {}
        }
    };

    function __tmCleanupWhiteboardPoolDragGhost() {
        const el = state.whiteboardPoolDragGhostEl;
        state.whiteboardPoolDragGhostEl = null;
        if (!(el instanceof HTMLElement)) return;
        try { el.remove(); } catch (e) {}
    }

    function __tmBuildWhiteboardPoolDragGhostFromDom(dragItemEl, opts = {}) {
        const item = dragItemEl instanceof HTMLElement ? dragItemEl : null;
        if (!item) return null;
        const o = (opts && typeof opts === 'object') ? opts : {};
        const useSelf = !!o.useSelf;
        const poolItem = item.classList?.contains?.('tm-whiteboard-pool-item')
            ? item
            : (item.closest?.('.tm-whiteboard-pool-item') instanceof HTMLElement ? item.closest('.tm-whiteboard-pool-item') : null);
        const nodeWrap = poolItem?.parentElement instanceof HTMLElement && poolItem.parentElement.classList?.contains?.('tm-whiteboard-pool-node')
            ? poolItem.parentElement
            : poolItem;
        const node = useSelf ? item : (nodeWrap instanceof HTMLElement ? nodeWrap : (item.parentElement instanceof HTMLElement ? item.parentElement : item));
        let ghost = null;
        try { ghost = node.cloneNode(true); } catch (e) { ghost = null; }
        if (!(ghost instanceof HTMLElement)) return null;
        ghost.style.position = 'fixed';
        ghost.style.left = '-9999px';
        ghost.style.top = '-9999px';
        ghost.style.maxWidth = '420px';
        ghost.style.pointerEvents = 'none';
        ghost.style.zIndex = '-1';
        ghost.style.opacity = '0.95';
        try { document.body.appendChild(ghost); } catch (e) {}
        state.whiteboardPoolDragGhostEl = ghost;
        return ghost;
    }

    function __tmIsWhiteboardPoolItemDraggable(el) {
        if (!(el instanceof HTMLElement)) return false;
        const isSearchResult = String(el.getAttribute('data-tm-pool-search-result') || '').trim() === '1';
        if (isSearchResult) {
            return String(el.getAttribute('data-tm-pool-placed') || '').trim() !== '1';
        }
        if (el.classList?.contains?.('tm-whiteboard-pool-item--locked')) return false;
        if (String(el.getAttribute('draggable') || '').toLowerCase() === 'false') {
            return !!el.querySelector?.('[draggable="true"]');
        }
        return String(el.getAttribute('draggable') || '').toLowerCase() !== 'false';
    }

    function __tmIsWhiteboardPoolDragEventSourceAllowed(ev, sourceItem) {
        if (!(sourceItem instanceof HTMLElement)) return false;
        const isSearchResult = String(sourceItem.getAttribute('data-tm-pool-search-result') || '').trim() === '1';
        if (isSearchResult) return __tmIsWhiteboardPoolItemDraggable(sourceItem);
        if (__tmIsWhiteboardPoolItemDraggable(sourceItem)) return true;
        if (sourceItem.classList?.contains?.('tm-whiteboard-pool-item--locked')) return false;
        const candidates = [ev?.target, ev?.currentTarget].filter((el) => el instanceof HTMLElement);
        return candidates.some((el) => {
            const dragEl = el.matches?.('[draggable="true"]')
                ? el
                : el.closest?.('[draggable="true"]');
            if (!(dragEl instanceof HTMLElement)) return false;
            return sourceItem.contains(dragEl);
        });
    }

    function __tmFindWhiteboardPoolItemElement(taskId, opts = {}) {
        const id = String(taskId || '').trim();
        if (!id) return null;
        const o = (opts && typeof opts === 'object') ? opts : {};
        const requireDraggable = !!o.requireDraggable;
        const preferredEl = o.preferredEl instanceof HTMLElement ? o.preferredEl : null;
        const preferredItem = preferredEl?.classList?.contains?.('tm-whiteboard-pool-item')
            ? preferredEl
            : (preferredEl?.closest?.('.tm-whiteboard-pool-item[data-task-id]') instanceof HTMLElement ? preferredEl.closest('.tm-whiteboard-pool-item[data-task-id]') : null);
        if (preferredItem instanceof HTMLElement
            && String(preferredItem.getAttribute('data-task-id') || '').trim() === id
            && (!requireDraggable || __tmIsWhiteboardPoolItemDraggable(preferredItem))) {
            return preferredItem;
        }
        try {
            const nodes = state.modal?.querySelectorAll?.(`.tm-whiteboard-pool-item[data-task-id="${CSS.escape(id)}"]`) || [];
            for (const node of Array.from(nodes)) {
                if (node instanceof HTMLElement && (!requireDraggable || __tmIsWhiteboardPoolItemDraggable(node))) return node;
            }
        } catch (e) {}
        return null;
    }

    function __tmGetWhiteboardPoolEventItem(ev, taskId = '') {
        const id = String(taskId || '').trim();
        const fromCurrent = ev?.currentTarget instanceof HTMLElement ? ev.currentTarget : null;
        const fromTarget = ev?.target instanceof HTMLElement ? ev.target : null;
        const candidates = [fromCurrent, fromTarget]
            .map((el) => {
                if (!(el instanceof HTMLElement)) return null;
                if (el.classList?.contains?.('tm-whiteboard-pool-item')) return el;
                const item = el.closest?.('.tm-whiteboard-pool-item[data-task-id]');
                return item instanceof HTMLElement ? item : null;
            })
            .filter(Boolean);
        for (const item of candidates) {
            if (!id || String(item.getAttribute('data-task-id') || '').trim() === id) return item;
        }
        return null;
    }

    function __tmIsPlacedWhiteboardPoolSearchEvent(ev) {
        const target = ev?.target instanceof Element ? ev.target : null;
        const item = target?.closest?.('.tm-whiteboard-pool-search-item[data-tm-pool-search-result="1"]');
        return item instanceof HTMLElement && String(item.getAttribute('data-tm-pool-placed') || '').trim() === '1'
            ? item
            : null;
    }

    window.tmWhiteboardPoolSearchPressGuard = function(ev) {
        const item = __tmIsPlacedWhiteboardPoolSearchEvent(ev);
        if (!(item instanceof HTMLElement)) return;
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.stopImmediatePropagation?.(); } catch (e) {}
        __tmWhiteboardDebugLog('pool-search:press-guard', {
            taskId: String(item.getAttribute('data-task-id') || '').trim(),
            docId: String(item.getAttribute('data-doc-id') || '').trim(),
            item: __tmWhiteboardDebugElementLabel(item),
            event: __tmWhiteboardDebugEventInfo(ev),
        });
    };

    try {
        const prevSearchDragGuard = window.__tmWhiteboardPoolSearchDragGuard;
        if (typeof prevSearchDragGuard === 'function') {
            try { document.removeEventListener('dragstart', prevSearchDragGuard, true); } catch (e) {}
        }
        const whiteboardPoolSearchDragGuard = (ev) => {
            const target = ev?.target instanceof Element ? ev.target : null;
            const item = target?.closest?.('.tm-whiteboard-pool-search-item[data-tm-pool-search-result="1"]');
            if (!(item instanceof HTMLElement)) return;
            const taskId = String(item.getAttribute('data-task-id') || '').trim();
            const docId = String(item.getAttribute('data-doc-id') || '').trim();
            const placed = String(item.getAttribute('data-tm-pool-placed') || '').trim() === '1';
            __tmWhiteboardDebugLog('pool-search:dragstart-guard', {
                taskId,
                docId,
                placed,
                item: __tmWhiteboardDebugElementLabel(item),
                event: __tmWhiteboardDebugEventInfo(ev),
            });
            if (!placed) return;
            try { ev.preventDefault(); } catch (e) {}
            try { ev.stopPropagation(); } catch (e) {}
            try { ev.stopImmediatePropagation(); } catch (e) {}
            try { ev.dataTransfer.effectAllowed = 'none'; } catch (e) {}
            try { ev.dataTransfer.dropEffect = 'none'; } catch (e) {}
            try { ev.dataTransfer.clearData(); } catch (e) {}
            state.draggingTaskId = '';
            state.whiteboardPoolDragStart = null;
            __tmWhiteboardDebugLog('pool-search:dragstart-blocked', {
                reason: 'already-placed-search-result',
                taskId,
                docId,
                item: __tmWhiteboardDebugElementLabel(item),
                event: __tmWhiteboardDebugEventInfo(ev),
            });
            return false;
        };
        window.__tmWhiteboardPoolSearchDragGuard = whiteboardPoolSearchDragGuard;
        document.addEventListener('dragstart', whiteboardPoolSearchDragGuard, true);
    } catch (e) {}

    try {
        const prevSearchPressGuard = window.__tmWhiteboardPoolSearchPressCaptureGuard;
        if (typeof prevSearchPressGuard === 'function') {
            try { document.removeEventListener('pointerdown', prevSearchPressGuard, true); } catch (e) {}
            try { document.removeEventListener('mousedown', prevSearchPressGuard, true); } catch (e) {}
        }
        const whiteboardPoolSearchPressCaptureGuard = (ev) => {
            const item = __tmIsPlacedWhiteboardPoolSearchEvent(ev);
            if (!(item instanceof HTMLElement)) return;
            try { item.setAttribute('draggable', 'false'); } catch (e) {}
            try {
                item.querySelectorAll?.('[draggable="true"]').forEach((el) => {
                    try { el.setAttribute('draggable', 'false'); } catch (e2) {}
                });
            } catch (e) {}
            __tmWhiteboardDebugLog('pool-search:press-capture-guard', {
                taskId: String(item.getAttribute('data-task-id') || '').trim(),
                docId: String(item.getAttribute('data-doc-id') || '').trim(),
                item: __tmWhiteboardDebugElementLabel(item),
                event: __tmWhiteboardDebugEventInfo(ev),
            });
        };
        window.__tmWhiteboardPoolSearchPressCaptureGuard = whiteboardPoolSearchPressCaptureGuard;
        document.addEventListener('pointerdown', whiteboardPoolSearchPressCaptureGuard, true);
        document.addEventListener('mousedown', whiteboardPoolSearchPressCaptureGuard, true);
    } catch (e) {}

    function __tmBuildWhiteboardPoolH2DragGhost(h2El, taskIds) {
        const titleEl = h2El instanceof HTMLElement ? h2El : null;
        const ids = Array.isArray(taskIds) ? taskIds.map((x) => String(x || '').trim()).filter(Boolean) : [];
        if (!titleEl || !ids.length) return null;
        const wrap = document.createElement('div');
        wrap.style.position = 'fixed';
        wrap.style.left = '-9999px';
        wrap.style.top = '-9999px';
        wrap.style.maxWidth = '420px';
        wrap.style.maxHeight = '360px';
        wrap.style.overflow = 'hidden';
        wrap.style.pointerEvents = 'none';
        wrap.style.zIndex = '-1';
        wrap.style.opacity = '0.95';
        wrap.style.border = '1px solid var(--tm-border-color)';
        wrap.style.borderRadius = '8px';
        wrap.style.background = 'var(--tm-bg-color)';
        wrap.style.padding = '6px';
        try {
            const h2Clone = titleEl.cloneNode(true);
            if (h2Clone instanceof HTMLElement) {
                h2Clone.style.cursor = 'grabbing';
                h2Clone.style.marginBottom = '4px';
                wrap.appendChild(h2Clone);
            }
        } catch (e) {}
        const pool = state.modal?.querySelector?.('.tm-whiteboard-sidebar');
        ids.forEach((tid) => {
            try {
                const src = __tmFindWhiteboardPoolItemElement(tid, { requireDraggable: true }) || pool?.querySelector?.(`.tm-whiteboard-pool-item[data-task-id="${CSS.escape(tid)}"]`);
                if (!(src instanceof HTMLElement)) return;
                const clone = src.cloneNode(true);
                if (!(clone instanceof HTMLElement)) return;
                clone.style.marginTop = '4px';
                wrap.appendChild(clone);
            } catch (e) {}
        });
        try { document.body.appendChild(wrap); } catch (e) {}
        state.whiteboardPoolDragGhostEl = wrap;
        return wrap;
    }

    function __tmBuildWhiteboardPoolMultiDragGhost(taskIds, fallbackEl) {
        const ids = Array.isArray(taskIds) ? taskIds.map((x) => String(x || '').trim()).filter(Boolean) : [];
        if (!ids.length) return __tmBuildWhiteboardPoolDragGhostFromDom(fallbackEl);
        const wrap = document.createElement('div');
        wrap.style.position = 'fixed';
        wrap.style.left = '-9999px';
        wrap.style.top = '-9999px';
        wrap.style.maxWidth = '420px';
        wrap.style.maxHeight = '360px';
        wrap.style.overflow = 'hidden';
        wrap.style.pointerEvents = 'none';
        wrap.style.zIndex = '-1';
        wrap.style.opacity = '0.95';
        wrap.style.border = '1px solid var(--tm-border-color)';
        wrap.style.borderRadius = '8px';
        wrap.style.background = 'var(--tm-bg-color)';
        wrap.style.padding = '6px';
        const pool = state.modal?.querySelector?.('.tm-whiteboard-sidebar');
        const maxPreview = 10;
        const pickIds = ids.slice(0, maxPreview);
        pickIds.forEach((tid) => {
            try {
                const src = __tmFindWhiteboardPoolItemElement(tid, { requireDraggable: true }) || pool?.querySelector?.(`.tm-whiteboard-pool-item[data-task-id="${CSS.escape(tid)}"]`);
                if (!(src instanceof HTMLElement)) return;
                const clone = src.cloneNode(true);
                if (!(clone instanceof HTMLElement)) return;
                clone.style.marginTop = '4px';
                wrap.appendChild(clone);
            } catch (e) {}
        });
        if (!wrap.childElementCount) return __tmBuildWhiteboardPoolDragGhostFromDom(fallbackEl);
        if (ids.length > maxPreview) {
            const more = document.createElement('div');
            more.style.marginTop = '6px';
            more.style.fontSize = '12px';
            more.style.color = 'var(--tm-secondary-text)';
            more.textContent = `... 还有 ${ids.length - maxPreview} 项`;
            wrap.appendChild(more);
        }
        try { document.body.appendChild(wrap); } catch (e) {}
        state.whiteboardPoolDragGhostEl = wrap;
        return wrap;
    }

    function __tmApplyWhiteboardPoolSelectionDom() {
        const selected = new Set((Array.isArray(state.whiteboardPoolSelectedTaskIds) ? state.whiteboardPoolSelectedTaskIds : [])
            .map((x) => String(x || '').trim())
            .filter(Boolean));
        const root = state.modal?.querySelector?.('#tmWhiteboardPoolContent') || state.modal;
        try {
            root?.querySelectorAll?.('.tm-whiteboard-pool-item[data-task-id]').forEach((el) => {
                if (!(el instanceof HTMLElement)) return;
                const id = String(el.getAttribute('data-task-id') || '').trim();
                el.classList.toggle('tm-whiteboard-pool-item--selected', !!id && selected.has(id));
            });
        } catch (e) {}
    }

    function __tmRemoveWhiteboardPoolSelectionIds(idsInput) {
        const ids = new Set((Array.isArray(idsInput) ? idsInput : [idsInput])
            .map((x) => String(x || '').trim())
            .filter(Boolean));
        if (!ids.size) return false;
        const current = Array.isArray(state.whiteboardPoolSelectedTaskIds) ? state.whiteboardPoolSelectedTaskIds : [];
        const next = current.map((x) => String(x || '').trim()).filter((id) => id && !ids.has(id));
        if (next.length === current.length) return false;
        state.whiteboardPoolSelectedTaskIds = next;
        __tmApplyWhiteboardPoolSelectionDom();
        return true;
    }

    function __tmClearWhiteboardSelectedCardDom() {
        if (!String(state.whiteboardSelectedTaskId || '').trim()) return false;
        state.whiteboardSelectedTaskId = '';
        try { __tmApplyWhiteboardCardSelectionDom(''); } catch (e) {}
        try { __tmScheduleWhiteboardEdgeRedraw(); } catch (e) {}
        return true;
    }

    window.tmWhiteboardPoolItemMouseDown = function(ev, taskId, docId, locked) {
        if (Number(ev?.button) !== 0) {
            __tmWhiteboardDebugLog('pool:mousedown-skip', { reason: 'non-left-button', taskId: String(taskId || ''), docId: String(docId || ''), event: __tmWhiteboardDebugEventInfo(ev) });
            return;
        }
        try { __tmCalendarFloatingDragEnd(); } catch (e) {}
        __tmClearWhiteboardSelectedCardDom();
        const target = ev?.target;
        const inPoolTitle = !!(target && target.closest && target.closest('.tm-whiteboard-pool-item-title'));
        const interactiveSelector = inPoolTitle
            ? '.tm-task-checkbox,.tm-whiteboard-pool-toggle,.tm-btn,input,button,select,textarea,label,a'
            : '.tm-task-checkbox,.tm-task-content-clickable,.tm-whiteboard-pool-toggle,.tm-btn,input,button,select,textarea,label,a';
        if (target && target.closest && target.closest(interactiveSelector)) {
            __tmWhiteboardDebugLog('pool:mousedown-skip', { reason: 'interactive-target', taskId: String(taskId || ''), docId: String(docId || ''), event: __tmWhiteboardDebugEventInfo(ev) });
            return;
        }
        const id = String(taskId || '').trim();
        if (!id) {
            __tmWhiteboardDebugLog('pool:mousedown-skip', { reason: 'missing-task-id', docId: String(docId || ''), event: __tmWhiteboardDebugEventInfo(ev) });
            return;
        }
        const isLocked = !!locked;
        if (isLocked) {
            __tmWhiteboardDebugLog('pool:mousedown-skip', { reason: 'locked', taskId: id, docId: String(docId || ''), event: __tmWhiteboardDebugEventInfo(ev) });
            return;
        }
        try { ev?.stopPropagation?.(); } catch (e) {}
        const current = Array.isArray(state.whiteboardPoolSelectedTaskIds) ? state.whiteboardPoolSelectedTaskIds : [];
        const set = new Set(current.map((x) => String(x || '').trim()).filter(Boolean));
        const withModifier = !!(ev?.ctrlKey || ev?.metaKey);
        if (withModifier) {
            if (set.has(id)) set.delete(id);
            else set.add(id);
        } else {
            // 已多选且点中选中项时，保持多选，便于直接整体拖拽
            if (!(set.size > 1 && set.has(id))) {
                set.clear();
                set.add(id);
            }
        }
        state.whiteboardPoolSelectedTaskIds = Array.from(set);
        __tmApplyWhiteboardPoolSelectionDom();
        __tmWhiteboardDebugLog('pool:mousedown', {
            taskId: id,
            docId: String(docId || ''),
            selectedTaskIds: state.whiteboardPoolSelectedTaskIds,
            event: __tmWhiteboardDebugEventInfo(ev),
        });
    };

    window.tmWhiteboardPoolH2DragStart = function(ev, docId, h2Label) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { __tmCalendarFloatingDragEnd(); } catch (e) {}
        const did = String(docId || '').trim();
        const h2 = String(h2Label || '').trim();
        const el = ev?.currentTarget instanceof HTMLElement ? ev.currentTarget : null;
        __tmWhiteboardDebugLog('pool-h2:dragstart', {
            docId: did,
            h2,
            hasCurrentTarget: el instanceof HTMLElement,
            event: __tmWhiteboardDebugEventInfo(ev),
        });
        if (!did || !h2 || !(el instanceof HTMLElement)) {
            __tmWhiteboardDebugLog('pool-h2:dragstart-skip', { reason: 'missing-doc-h2-or-target', docId: did, h2, event: __tmWhiteboardDebugEventInfo(ev) });
            return;
        }
        const rawIds = String(el.getAttribute('data-task-ids') || '').trim();
        let taskIds = rawIds ? rawIds.split(',').map((x) => String(x || '').trim()).filter(Boolean) : [];
        if (!taskIds.length) {
            __tmWhiteboardDebugLog('pool-h2:dragstart-skip', { reason: 'empty-task-ids', docId: did, h2, rawIds, event: __tmWhiteboardDebugEventInfo(ev) });
            return;
        }
        const canDrag = (tid) => {
            return !!__tmFindWhiteboardPoolItemElement(tid, { requireDraggable: true });
        };
        taskIds = taskIds.filter((tid) => canDrag(tid));
        if (!taskIds.length) {
            __tmWhiteboardDebugLog('pool-h2:dragstart-skip', { reason: 'all-task-ids-not-draggable', docId: did, h2, rawIds, event: __tmWhiteboardDebugEventInfo(ev) });
            return;
        }
        state.whiteboardPoolSelectedTaskIds = taskIds.slice();
        state.draggingTaskId = taskIds[0];
        state.whiteboardPoolDragStart = {
            clientX: Number(ev?.clientX) || 0,
            clientY: Number(ev?.clientY) || 0,
            docId: did,
            taskIds: taskIds.slice(),
            h2,
            at: Date.now(),
        };
        try {
            const taskDocIds = {};
            taskIds.forEach((tid) => {
                const tdid = String(__tmGetTaskDocIdById(tid) || '').trim();
                if (tdid) taskDocIds[tid] = tdid;
            });
            const payload = JSON.stringify({ type: 'tm-whiteboard-pool-h2', taskIds: taskIds.slice(), docId: did, h2, taskDocIds });
            ev.dataTransfer.effectAllowed = 'move';
            ev.dataTransfer.setData('application/x-tm-whiteboard-pool', payload);
            ev.dataTransfer.setData('text/plain', payload);
            __tmCleanupWhiteboardPoolDragGhost();
            const dragGhost = __tmBuildWhiteboardPoolH2DragGhost(el, taskIds) || __tmBuildWhiteboardPoolDragGhostFromDom(el, { useSelf: true });
            if (dragGhost instanceof HTMLElement) {
                try { ev.dataTransfer.setDragImage(dragGhost, 12, 12); } catch (e) {}
            }
        } catch (e) {}
        __tmWhiteboardDebugLog('pool-h2:payload-set', {
            docId: did,
            h2,
            taskIds,
            event: __tmWhiteboardDebugEventInfo(ev),
        });
        __tmStartWhiteboardPoolGlobalTracking(String(state.activeDocId && state.activeDocId !== 'all' ? state.activeDocId : ''));
    };

    window.tmWhiteboardPoolDragStart = function(ev, taskId, docId) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { __tmCalendarFloatingDragEnd(); } catch (e) {}
        const id = String(taskId || '').trim();
        const did = String(docId || '').trim();
        __tmWhiteboardDebugLog('pool:dragstart', {
            taskId: id,
            docId: did,
            selectedTaskIds: Array.isArray(state.whiteboardPoolSelectedTaskIds) ? state.whiteboardPoolSelectedTaskIds : [],
            event: __tmWhiteboardDebugEventInfo(ev),
        });
        if (!id || !did) {
            __tmWhiteboardDebugLog('pool:dragstart-skip', { reason: 'missing-task-or-doc', taskId: id, docId: did, event: __tmWhiteboardDebugEventInfo(ev) });
            return;
        }
        const selected0 = Array.isArray(state.whiteboardPoolSelectedTaskIds) ? state.whiteboardPoolSelectedTaskIds : [];
        const selectedSet = new Set(selected0.map((x) => String(x || '').trim()).filter(Boolean));
        let dragTaskIds = selectedSet.has(id) ? Array.from(selectedSet) : [id];
        if (!dragTaskIds.length) dragTaskIds = [id];
        const sourceItem = __tmGetWhiteboardPoolEventItem(ev, id);
        __tmWhiteboardDebugLog('pool:dragstart-source', {
            taskId: id,
            docId: did,
            sourceItem: __tmWhiteboardDebugElementLabel(sourceItem),
            sourceIsSearchResult: sourceItem instanceof HTMLElement ? String(sourceItem.getAttribute('data-tm-pool-search-result') || '').trim() : '',
            sourcePlaced: sourceItem instanceof HTMLElement ? String(sourceItem.getAttribute('data-tm-pool-placed') || '').trim() : '',
            sourceDraggableAttr: sourceItem instanceof HTMLElement ? String(sourceItem.getAttribute('draggable') || '').trim() : '',
            sourceComputedDraggable: __tmIsWhiteboardPoolItemDraggable(sourceItem),
            sourceEventAllowed: __tmIsWhiteboardPoolDragEventSourceAllowed(ev, sourceItem),
            selectedTaskIds: Array.from(selectedSet),
            initialDragTaskIds: dragTaskIds.slice(),
            event: __tmWhiteboardDebugEventInfo(ev),
        });
        const sourceEventAllowed = __tmIsWhiteboardPoolDragEventSourceAllowed(ev, sourceItem);
        if (!(sourceItem instanceof HTMLElement) || !sourceEventAllowed) {
            try { ev?.preventDefault?.(); } catch (e) {}
            state.draggingTaskId = '';
            state.whiteboardPoolDragStart = null;
            __tmWhiteboardDebugLog('pool:dragstart-skip', { reason: 'source-not-draggable', taskId: id, docId: did, event: __tmWhiteboardDebugEventInfo(ev) });
            return;
        }
        const canDrag = (tid) => {
            if (String(tid || '').trim() === id) return sourceEventAllowed;
            return !!__tmFindWhiteboardPoolItemElement(tid, { requireDraggable: true });
        };
        dragTaskIds = dragTaskIds.filter((tid) => canDrag(tid));
        dragTaskIds = Array.from(new Set(dragTaskIds));
        if (!dragTaskIds.includes(id) || !dragTaskIds.length) {
            try { ev?.preventDefault?.(); } catch (e) {}
            state.draggingTaskId = '';
            state.whiteboardPoolDragStart = null;
            __tmWhiteboardDebugLog('pool:dragstart-skip', { reason: 'no-draggable-task-ids', taskId: id, docId: did, dragTaskIds, event: __tmWhiteboardDebugEventInfo(ev) });
            return;
        }
        __tmWhiteboardDebugLog('pool:dragstart-resolved', {
            taskId: id,
            docId: did,
            dragTaskIds,
            event: __tmWhiteboardDebugEventInfo(ev),
        });
        state.whiteboardPoolSelectedTaskIds = dragTaskIds.slice();
        state.draggingTaskId = dragTaskIds[0] || id;
        state.whiteboardPoolDragStart = {
            clientX: Number(ev?.clientX) || 0,
            clientY: Number(ev?.clientY) || 0,
            docId: did,
            taskIds: dragTaskIds.slice(),
            at: Date.now(),
        };
        try {
            const taskDocIds = {};
            dragTaskIds.forEach((tid) => {
                const tdid = String(__tmGetTaskDocIdById(tid) || '').trim();
                if (tdid) taskDocIds[tid] = tdid;
            });
            const payload = JSON.stringify({ type: 'tm-whiteboard-pool', taskId: id, taskIds: dragTaskIds, docId: did, taskDocIds });
            ev.dataTransfer.effectAllowed = 'move';
            ev.dataTransfer.setData('application/x-tm-whiteboard-pool', payload);
            ev.dataTransfer.setData('text/plain', payload);
            __tmCleanupWhiteboardPoolDragGhost();
            const dragGhost = dragTaskIds.length > 1
                ? __tmBuildWhiteboardPoolMultiDragGhost(dragTaskIds, ev?.currentTarget)
                : __tmBuildWhiteboardPoolDragGhostFromDom(ev?.currentTarget);
            if (dragGhost instanceof HTMLElement) {
                try { ev.dataTransfer.setDragImage(dragGhost, 12, 12); } catch (e) {}
            }
        } catch (e) {}
        __tmWhiteboardDebugLog('pool:payload-set', {
            taskId: id,
            docId: did,
            dragTaskIds,
            event: __tmWhiteboardDebugEventInfo(ev),
        });
        __tmStartWhiteboardPoolGlobalTracking(String(state.activeDocId && state.activeDocId !== 'all' ? state.activeDocId : ''));
    };

    window.tmWhiteboardPoolDrag = function(ev, docIdHint) {
        __tmTrackWhiteboardPointerFromClient(ev?.clientX, ev?.clientY, String(docIdHint || state.activeDocId || ''));
    };

    window.tmWhiteboardPoolDragEnd = function() {
        __tmWhiteboardDebugLog('pool:dragend', {
            draggingTaskId: String(state.draggingTaskId || ''),
            poolDragStart: state.whiteboardPoolDragStart,
        });
        state.draggingTaskId = '';
        try { __tmCalendarFloatingDragEnd(); } catch (e) {}
        __tmStopWhiteboardPoolGlobalTracking();
        __tmCleanupWhiteboardPoolDragGhost();
        state.whiteboardPoolDragStart = null;
        state.whiteboardLastBoardLocal = null;
        state.whiteboardLastBoardPointer = null;
    };

    window.tmWhiteboardBoardDragOver = function(ev) {
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        const info = __tmResolveWhiteboardPointerInfo(ev, String(state.activeDocId && state.activeDocId !== 'all' ? state.activeDocId : ''))
            || __tmTrackWhiteboardPointerFromClient(ev?.clientX, ev?.clientY, String(state.activeDocId && state.activeDocId !== 'all' ? state.activeDocId : ''));
        __tmWhiteboardDebugLogThrottled('board-dragover', 500, 'board:dragover', {
            docIdHint: String(state.activeDocId && state.activeDocId !== 'all' ? state.activeDocId : ''),
            pointerInfo: info,
            lastLocal: state.whiteboardLastBoardLocal,
            event: __tmWhiteboardDebugEventInfo(ev),
        });
        const docId = String(info?.docId || state.whiteboardLinkFromDocId || '').trim();
        if (info && 'clientX' in info) {
            state.whiteboardLastBoardPointer = {
                clientX: info.clientX,
                clientY: info.clientY,
                docId: info.docId,
                at: info.at,
            };
            state.whiteboardLastBoardLocal = {
                docId: info.docId,
                x: info.localX,
                y: info.localY,
                at: info.at,
            };
        }
        if (!String(state.whiteboardLinkFromTaskId || '').trim()) return;
        let hoverTaskId = '';
        let hoverDocId = '';
        try {
            const hit = document.elementFromPoint(Number(ev?.clientX) || 0, Number(ev?.clientY) || 0);
            const node = hit?.closest?.('.tm-whiteboard-node[data-task-id][data-doc-id]');
            if (node instanceof Element) {
                hoverTaskId = String(node.getAttribute('data-task-id') || '').trim();
                hoverDocId = String(node.getAttribute('data-doc-id') || '').trim();
            }
        } catch (e) {}
        if (hoverTaskId && hoverDocId) {
            __tmUpdateWhiteboardLinkHover(hoverTaskId, hoverDocId);
            __tmUpdateWhiteboardLinkPreviewFromEvent(ev, hoverTaskId, hoverDocId);
        } else {
            __tmUpdateWhiteboardLinkHover('', '');
            __tmUpdateWhiteboardLinkPreviewFromEvent(ev, '', docId);
        }
        if (state.viewMode === 'timeline') {
            try { state.__tmTimelineRenderDeps?.(); } catch (e) {}
        } else {
            __tmScheduleWhiteboardEdgeRedraw();
        }
    };

    function __tmResolveWhiteboardDropLocalPoint(ev, docId) {
        const did = String(docId || '').trim();
        if (!did) return null;
        const freshMs = 1800;
        const now = Date.now();
        const lastLocal = state.whiteboardLastBoardLocal;
        if (lastLocal && typeof lastLocal === 'object'
            && String(lastLocal.docId || '').trim() === did
            && Number.isFinite(Number(lastLocal.x))
            && Number.isFinite(Number(lastLocal.y))
            && (now - Number(lastLocal.at || 0)) < freshMs) {
            return { x: Number(lastLocal.x), y: Number(lastLocal.y) };
        }
        const info = __tmResolveWhiteboardPointerInfo(ev, did)
            || __tmTrackWhiteboardPointerFromClient(ev?.clientX, ev?.clientY, did);
        if (info && Number.isFinite(Number(info.localX)) && Number.isFinite(Number(info.localY))) {
            return { x: Number(info.localX), y: Number(info.localY) };
        }
        return null;
    }

    window.tmWhiteboardBoardDrop = async function(ev, docIdHint) {
        __tmWhiteboardDebugLog('board:drop-start', {
            docIdHint: String(docIdHint || ''),
            lastLocal: state.whiteboardLastBoardLocal,
            event: __tmWhiteboardDebugEventInfo(ev),
        });
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        try {
            const rawLink = ev?.dataTransfer?.getData?.('application/x-tm-task-link') || ev?.dataTransfer?.getData?.('text/plain');
            if (rawLink) {
                const obj = JSON.parse(rawLink);
                if (String(obj?.type || '').trim() === 'tm-task-link') {
                    let toId = '';
                    let toDocId = '';
                    try {
                        const hit = document.elementFromPoint(Number(ev?.clientX) || 0, Number(ev?.clientY) || 0);
                        const node = hit?.closest?.('.tm-whiteboard-node[data-task-id][data-doc-id]');
                        if (node instanceof Element) {
                            toId = String(node.getAttribute('data-task-id') || '').trim();
                            toDocId = String(node.getAttribute('data-doc-id') || '').trim();
                        }
                    } catch (e2) {}
                    if (toId) {
                        await window.tmTaskLinkDotDrop?.(ev, toId, toDocId);
                        return;
                    }
                }
            }
        } catch (e) {}
        let payload = null;
        let rawPayload = '';
        try {
            const raw = ev?.dataTransfer?.getData?.('application/x-tm-whiteboard-pool') || ev?.dataTransfer?.getData?.('text/plain');
            rawPayload = String(raw || '');
            if (raw) payload = JSON.parse(raw);
        } catch (e) {
            __tmWhiteboardDebugLog('board:drop-payload-parse-error', {
                message: e?.message || String(e),
                rawPayloadPreview: rawPayload.slice(0, 180),
                event: __tmWhiteboardDebugEventInfo(ev),
            });
        }
        const payloadType = String(payload?.type || '').trim();
        __tmWhiteboardDebugLog('board:drop-payload', {
            payloadType,
            rawPayloadPreview: rawPayload.slice(0, 180),
            payload,
            event: __tmWhiteboardDebugEventInfo(ev),
        });
        if (payloadType !== 'tm-whiteboard-pool' && payloadType !== 'tm-whiteboard-pool-h2') {
            __tmWhiteboardDebugLog('board:drop-skip', { reason: 'unsupported-payload', payloadType, event: __tmWhiteboardDebugEventInfo(ev) });
            return;
        }
        const taskIds = Array.isArray(payload?.taskIds)
            ? payload.taskIds.map((x) => String(x || '').trim()).filter(Boolean)
            : [String(payload?.taskId || '').trim()].filter(Boolean);
        if (!taskIds.length) {
            __tmWhiteboardDebugLog('board:drop-skip', { reason: 'empty-task-ids', payload, event: __tmWhiteboardDebugEventInfo(ev) });
            return;
        }
        const taskIdsSorted = (() => {
            const ids = taskIds.slice();
            try {
                const orderEls = state.modal?.querySelectorAll?.('.tm-whiteboard-pool-item[data-task-id]');
                const orderMap = new Map();
                let idx = 0;
                (orderEls ? Array.from(orderEls) : []).forEach((el) => {
                    const tid = String(el?.getAttribute?.('data-task-id') || '').trim();
                    if (!tid) return;
                    if (!orderMap.has(tid)) orderMap.set(tid, idx++);
                });
                if (orderMap.size <= 0) return ids;
                ids.sort((a, b) => {
                    const ia = orderMap.has(a) ? Number(orderMap.get(a)) : Number.MAX_SAFE_INTEGER;
                    const ib = orderMap.has(b) ? Number(orderMap.get(b)) : Number.MAX_SAFE_INTEGER;
                    if (ia !== ib) return ia - ib;
                    return 0;
                });
            } catch (e) {}
            return ids;
        })();
        const h2Title = (payloadType === 'tm-whiteboard-pool-h2') ? String(payload?.h2 || '').trim() : '';
        const pointDocId = String(docIdHint || '').trim();
        let docId = pointDocId;
        if (!docId) {
            const hitInfo = __tmResolveWhiteboardPointerInfo(ev, '')
                || __tmTrackWhiteboardPointerFromClient(ev?.clientX, ev?.clientY, '');
            docId = String(hitInfo?.docId || '').trim();
        }
        if (!docId) {
            const lastLocal = state.whiteboardLastBoardLocal;
            const freshMs = 1800;
            if (lastLocal && typeof lastLocal === 'object' && (Date.now() - Number(lastLocal.at || 0)) < freshMs) {
                docId = String(lastLocal.docId || '').trim();
            }
        }
        if (!docId) {
            docId = String(state.activeDocId && state.activeDocId !== 'all' ? state.activeDocId : '').trim();
        }
        if (!docId) {
            const globalBody = __tmGetWhiteboardGlobalCanvasBody();
            docId = String(globalBody?.getAttribute?.('data-doc-id') || '').trim();
        }
        if (!docId) {
            __tmWhiteboardDebugLog('board:drop-skip', { reason: 'missing-drop-doc-id', payload, lastLocal: state.whiteboardLastBoardLocal, event: __tmWhiteboardDebugEventInfo(ev) });
            return;
        }
        const activeDocIdForDrop = String(state.activeDocId || '').trim();
        let isAllTabsDrop = !(activeDocIdForDrop && activeDocIdForDrop !== 'all');
        try {
            const customGroupDocIds = (typeof __tmGetActiveDocTabCustomGroupDocIdSet === 'function')
                ? __tmGetActiveDocTabCustomGroupDocIdSet(activeDocIdForDrop, {
                    currentGroupId: SettingsStore?.data?.currentGroupId,
                    docs: state.taskTree || []
                })
                : null;
            if (customGroupDocIds instanceof Set && customGroupDocIds.size > 0) isAllTabsDrop = true;
        } catch (e) {}
        const globalCollectDocId = String(SettingsStore.data.newTaskDocId || '').trim();
        const viewport = state.modal?.querySelector?.('#tmWhiteboardViewport');
        let dropDocBody = state.modal?.querySelector?.(`.tm-whiteboard-doc-body[data-doc-id="${CSS.escape(docId)}"]`);
        if (!(dropDocBody instanceof HTMLElement)
            && typeof __tmIsWhiteboardGlobalCanvasActive === 'function'
            && __tmIsWhiteboardGlobalCanvasActive()) {
            dropDocBody = __tmGetWhiteboardGlobalCanvasBody();
        }
        if (!(viewport instanceof HTMLElement) || !(dropDocBody instanceof HTMLElement)) {
            __tmWhiteboardDebugLog('board:drop-skip', {
                reason: !(viewport instanceof HTMLElement) ? 'missing-viewport' : 'missing-drop-doc-body',
                docId,
                isGlobalCanvasActive: typeof __tmIsWhiteboardGlobalCanvasActive === 'function' && __tmIsWhiteboardGlobalCanvasActive(),
                event: __tmWhiteboardDebugEventInfo(ev),
            });
            return;
        }
        const isGlobalDrop = String(dropDocBody.getAttribute('data-tm-whiteboard-scope') || '').trim() === 'global';
        __tmWhiteboardDebugLog('board:drop-target', {
            docId,
            isGlobalDrop,
            dropDocBody: __tmWhiteboardDebugElementLabel(dropDocBody),
            activeDocIdForDrop,
            isAllTabsDrop,
            taskIdsSorted,
            event: __tmWhiteboardDebugEventInfo(ev),
        });
        const globalBoardGroupId = isGlobalDrop ? __tmGetWhiteboardGlobalBoardGroupId() : '';
        const globalBoardState = isGlobalDrop ? __tmGetWhiteboardGlobalBoardState(globalBoardGroupId) : null;
        const globalNodePos = isGlobalDrop
            ? { ...((globalBoardState?.nodePos && typeof globalBoardState.nodePos === 'object') ? globalBoardState.nodePos : {}) }
            : null;
        const globalPlacedTaskIds = isGlobalDrop
            ? { ...((globalBoardState?.placedTaskIds && typeof globalBoardState.placedTaskIds === 'object') ? globalBoardState.placedTaskIds : {}) }
            : null;
        // 使用固定锚点，避免卡片尺寸变化（父子结构展开）影响落点体感。
        const anchorX = 18;
        const anchorY = 16;
        const local = __tmResolveWhiteboardDropLocalPoint(ev, docId);
        const zoom = Math.max(0.01, Number(__tmGetWhiteboardView()?.zoom) || 1);
        const resolveDocBody = (targetDocId) => {
            const did = String(targetDocId || '').trim();
            if (!did) return null;
            try {
                const el = state.modal?.querySelector?.(`.tm-whiteboard-doc-body[data-doc-id="${CSS.escape(did)}"]`);
                return el instanceof HTMLElement ? el : null;
            } catch (e) {
                return null;
            }
        };
        const getOriginForDocBody = (targetBody) => {
            const body = targetBody instanceof HTMLElement ? targetBody : dropDocBody;
            const rect = body.getBoundingClientRect();
            const fallbackX = (rect.width > 0 ? (rect.width * 0.5) : 220) / zoom;
            const fallbackY = (rect.height > 0 ? (rect.height * 0.5) : 140) / zoom;
            const baseX = Number.isFinite(Number(local?.x)) ? Number(local.x) : fallbackX;
            const baseY = Number.isFinite(Number(local?.y)) ? Number(local.y) : fallbackY;
            return {
                x: Math.round(baseX - anchorX),
                y: Math.round(baseY - anchorY),
            };
        };
        const stepX = 320;
        let movedAcrossDoc = false;
        const placed = [];
        const placedDocs = [];
        const placedCountByDoc = new Map();
        let historyPushed = false;
        const pushDropHistory = () => {
            if (historyPushed) return;
            __tmPushWhiteboardHistorySnapshot('drop-task');
            historyPushed = true;
        };
        for (let i = 0; i < taskIdsSorted.length; i++) {
            const taskId = String(taskIdsSorted[i] || '').trim();
            if (!taskId) continue;
            const taskDocFromPayload = String(payload?.taskDocIds?.[taskId] || '').trim();
            const payloadDocId = String(payload?.docId || '').trim();
            const cardDoc = taskDocFromPayload || String(__tmGetTaskDocIdById(taskId) || '').trim() || payloadDocId;
            if (!cardDoc) continue;
            let placeDocId = isGlobalDrop ? cardDoc : (isAllTabsDrop ? cardDoc : docId);
            if (!placeDocId) continue;
            if (!isGlobalDrop && !isAllTabsDrop && cardDoc !== docId) {
                const cardDocName = String((state.allDocuments || []).find(d => String(d?.id || '').trim() === cardDoc)?.name || '').trim();
                const sourceIsInbox = /inbox/i.test(cardDocName) || /收件箱|收集箱|收件/.test(cardDocName);
                const sourceIsGlobalCollect = !!globalCollectDocId && cardDoc === globalCollectDocId;
                if (!sourceIsInbox && !sourceIsGlobalCollect) continue;
                try {
                    const moveTask = globalThis.__tmRequireTaskOutbox?.('moveTask');
                    if (typeof moveTask !== 'function') throw new Error('任务写入队列未就绪: moveTask');
                    moveTask(taskId, {
                        targetDocId: docId,
                        mode: 'docTop',
                        deferOptimisticRender: true,
                        skipOptimisticFilterWork: true,
                    }, {
                        wait: false,
                        skipOptimisticFilterWork: true,
                        onError: (e) => {
                            try { hint(`❌ 移动任务失败: ${e?.message || String(e)}`, 'error'); } catch (err) {}
                        },
                    });
                    movedAcrossDoc = true;
                } catch (e) {
                    try { hint(`❌ 移动任务失败: ${e?.message || String(e)}`, 'error'); } catch (err) {}
                    continue;
                }
            }
            const placeDocBody = isGlobalDrop ? dropDocBody : resolveDocBody(placeDocId);
            if (!(placeDocBody instanceof HTMLElement)) continue;
            pushDropHistory();
            if (!isGlobalDrop) {
                try {
                    __tmWhiteboardCollectTaskTreeIds(taskId, { includeRoot: false, includeDetached: true, includeSnapshotTree: true })
                        .forEach((cid) => {
                            __tmSetWhiteboardChildDetached(cid, false);
                            __tmSetWhiteboardTaskPlaced(cid, false, { persist: false });
                        });
                } catch (e) {}
            }
            const origin = getOriginForDocBody(placeDocBody);
            const countKey = isGlobalDrop ? '__global__' : placeDocId;
            const placedIndex = Number(placedCountByDoc.get(countKey)) || 0;
            placedCountByDoc.set(countKey, placedIndex + 1);
            const nx = origin.x + (placedIndex * stepX);
            const ny = origin.y;
            if (isGlobalDrop) {
                globalNodePos[taskId] = { docId: placeDocId, x: nx, y: ny, updatedAt: String(Date.now()), manual: true };
                globalPlacedTaskIds[taskId] = true;
            } else {
                __tmSetWhiteboardNodePos(taskId, placeDocId, nx, ny, { persist: false, manual: true });
                __tmSetWhiteboardTaskPlaced(taskId, true, { persist: false });
            }
            try {
                const t = state.flatTasks?.[taskId];
                if (t) __tmUpsertWhiteboardTaskSnapshot(t, { persist: true });
            } catch (e) {}
            placed.push(taskId);
            if (!placedDocs.includes(placeDocId)) placedDocs.push(placeDocId);
        }
        if (!placed.length) {
            __tmWhiteboardDebugLog('board:drop-skip', {
                reason: 'no-placed-tasks',
                taskIdsSorted,
                docId,
                isGlobalDrop,
                placedDocs,
                event: __tmWhiteboardDebugEventInfo(ev),
            });
            return;
        }
        if (h2Title) {
            const h2DocFromPayload = String(payload?.docId || '').trim();
            const h2DocId = isGlobalDrop
                ? (h2DocFromPayload || placedDocs[0] || '')
                : ((isAllTabsDrop && h2DocFromPayload && resolveDocBody(h2DocFromPayload))
                ? h2DocFromPayload
                : (placedDocs[0] || docId));
            const h2Body = isGlobalDrop ? dropDocBody : resolveDocBody(h2DocId);
            const h2Origin = getOriginForDocBody(h2Body || dropDocBody);
            const notes = isGlobalDrop
                ? (Array.isArray(globalBoardState?.notes) ? [...globalBoardState.notes] : [])
                : (Array.isArray(SettingsStore.data.whiteboardNotes) ? [...SettingsStore.data.whiteboardNotes] : []);
            notes.push({
                id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                docId: h2DocId,
                text: h2Title,
                x: h2Origin.x,
                y: Math.max(0, h2Origin.y - 75),
                fontSize: 30,
                bold: true,
                color: '',
                createdAt: String(Date.now()),
            });
            if (isGlobalDrop) {
                try { __tmPatchWhiteboardGlobalBoardState(globalBoardGroupId, { notes, nodePos: globalNodePos, placedTaskIds: globalPlacedTaskIds }, { keepEmpty: true }); } catch (e) {}
            } else {
                SettingsStore.data.whiteboardNotes = notes;
                try { WhiteboardStore?.syncFromSettings?.(SettingsStore.data, 'whiteboard-notes'); } catch (e) {}
            }
        } else if (isGlobalDrop) {
            try { __tmPatchWhiteboardGlobalBoardState(globalBoardGroupId, { nodePos: globalNodePos, placedTaskIds: globalPlacedTaskIds }, { keepEmpty: true }); } catch (e) {}
        }
        if (placed.length > 1) {
            state.whiteboardSelectedTaskId = '';
            state.whiteboardSelectedNoteId = '';
            state.whiteboardSelectedLinkId = '';
            state.whiteboardSelectedLinkDocId = '';
            state.whiteboardMultiSelectedTaskIds = placed.slice();
            state.whiteboardMultiSelectedNoteIds = [];
            state.whiteboardMultiSelectedLinkKeys = [];
            __tmApplyWhiteboardCardSelectionDom('');
            __tmApplyWhiteboardMultiSelectionDom();
            __tmRenderWhiteboardMultiTools(__tmComputeWhiteboardMultiSelectionRect());
        } else {
            __tmClearWhiteboardMultiSelection();
            state.whiteboardSelectedTaskId = placed[0];
        }
        __tmStopWhiteboardPoolGlobalTracking();
        state.whiteboardPoolDragStart = null;
        state.whiteboardLastBoardLocal = null;
        state.whiteboardLastBoardPointer = null;
        try { await SettingsStore.save(); } catch (e) {}
        __tmWhiteboardDebugLog('board:drop-placed', {
            placed,
            placedDocs,
            isGlobalDrop,
            movedAcrossDoc,
            h2Title,
        });
        if (movedAcrossDoc) {
            try { __tmScheduleViewRefresh({ mode: 'current', withFilters: false, reason: 'whiteboard-pool-drop-move' }); } catch (e) { render(); }
        } else {
            render();
        }
    };

    window.tmWhiteboardDocResizeMouseDown = function(ev, docId, dir) {
        if (state.viewMode !== 'whiteboard') return;
        const allView = !(state.activeDocId && state.activeDocId !== 'all');
        if (allView) return;
        if (Number(ev?.button) !== 0) return;
        const did = String(docId || '').trim();
        if (!did) return;
        const modeRaw = String(dir || 'bottom-right').trim().toLowerCase();
        const allowed = new Set(['left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'both']);
        const mode = allowed.has(modeRaw) ? modeRaw : 'bottom-right';
        const bodyEl = state.modal?.querySelector?.(`.tm-whiteboard-doc-body[data-doc-id="${CSS.escape(did)}"]`);
        if (!(bodyEl instanceof HTMLElement)) return;
        const zoom = Math.max(0.01, Number(__tmGetWhiteboardView()?.zoom) || 1);
        const startW = Number(bodyEl.clientWidth) || 1000;
        const startH = Number(bodyEl.clientHeight) || 520;
        const sx = Number(ev?.clientX) || 0;
        const sy = Number(ev?.clientY) || 0;
        state.whiteboardDocResize = { did, sx, sy, startW, startH, bodyEl, zoom, mode };
        try {
            document.body.style.userSelect = 'none';
            const cursorMap = {
                left: 'ew-resize',
                right: 'ew-resize',
                top: 'ns-resize',
                bottom: 'ns-resize',
                'top-left': 'nwse-resize',
                'bottom-right': 'nwse-resize',
                both: 'nwse-resize',
                'top-right': 'nesw-resize',
                'bottom-left': 'nesw-resize',
            };
            document.body.style.cursor = cursorMap[mode] || 'nwse-resize';
        } catch (e) {}
        const onMove = (e2) => {
            const s = state.whiteboardDocResize;
            if (!s) return;
            const dx = ((Number(e2?.clientX) || 0) - s.sx) / s.zoom;
            const dy = ((Number(e2?.clientY) || 0) - s.sy) / s.zoom;
            const hasLeft = (s.mode === 'left' || s.mode === 'top-left' || s.mode === 'bottom-left');
            const hasRight = (s.mode === 'right' || s.mode === 'top-right' || s.mode === 'bottom-right' || s.mode === 'both');
            const hasTop = (s.mode === 'top' || s.mode === 'top-left' || s.mode === 'top-right');
            const hasBottom = (s.mode === 'bottom' || s.mode === 'bottom-left' || s.mode === 'bottom-right' || s.mode === 'both');
            const wRaw = hasLeft ? (s.startW - dx) : (hasRight ? (s.startW + dx) : s.startW);
            const hRaw = hasTop ? (s.startH - dy) : (hasBottom ? (s.startH + dy) : s.startH);
            const w = Math.max(520, Math.round(wRaw));
            const h = Math.max(220, Math.round(hRaw));
            s.bodyEl.style.width = `${w}px`;
            s.bodyEl.style.height = `${h}px`;
            __tmSetWhiteboardDocFrameSize(s.did, w, h, { persist: false });
            __tmScheduleWhiteboardEdgeRedraw();
        };
        const onUp = async () => {
            try { document.removeEventListener('mousemove', onMove, true); } catch (e) {}
            try { document.removeEventListener('mouseup', onUp, true); } catch (e) {}
            state.whiteboardDocResize = null;
            try {
                document.body.style.userSelect = '';
                document.body.style.cursor = '';
            } catch (e) {}
            try { await SettingsStore.save(); } catch (e) {}
            __tmScheduleWhiteboardEdgeRedraw();
        };
        try { document.addEventListener('mousemove', onMove, true); } catch (e) {}
        try { document.addEventListener('mouseup', onUp, true); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
    };

    function __tmRenderWhiteboardEdges() {
        if (state.viewMode !== 'whiteboard') return;
        const body = state.modal?.querySelector?.('#tmWhiteboardBody');
        if (!body) return;
        const docBodies = body.querySelectorAll('.tm-whiteboard-doc-body[data-doc-id]');
        docBodies.forEach((docBody) => {
            if (!(docBody instanceof Element)) return;
            try {
                docBody.querySelectorAll('.tm-whiteboard-link-tools[data-tm-wb-dyn="1"]').forEach((el) => {
                    try { el.remove(); } catch (e) {}
                });
            } catch (e) {}
            const docId = String(docBody.getAttribute('data-doc-id') || '').trim();
            if (!docId) return;
            const isGlobalBody = String(docBody.getAttribute('data-tm-whiteboard-scope') || '').trim() === 'global';
            const globalCanvasDocId = typeof __tmGetWhiteboardGlobalCanvasDocId === 'function'
                ? __tmGetWhiteboardGlobalCanvasDocId()
                : '__tm_global_whiteboard__';
            const visibleTaskIds = new Set();
            if (isGlobalBody) {
                try {
                    docBody.querySelectorAll('.tm-whiteboard-node[data-task-id]').forEach((el) => {
                        const tid = String(el?.getAttribute?.('data-task-id') || '').trim();
                        if (tid) visibleTaskIds.add(tid);
                    });
                } catch (e) {}
            }
            const svg = docBody.querySelector('.tm-whiteboard-edges');
            if (!(svg instanceof SVGElement)) return;
            const width = Math.max(Math.ceil(docBody.scrollWidth), Math.ceil(docBody.clientWidth), 1);
            const height = Math.max(Math.ceil(docBody.scrollHeight), Math.ceil(docBody.clientHeight), 1);
            try { svg.setAttribute('width', String(width)); } catch (e) {}
            try { svg.setAttribute('height', String(height)); } catch (e) {}
            try { svg.setAttribute('viewBox', `0 0 ${width} ${height}`); } catch (e) {}

            const links = isGlobalBody && typeof __tmGetWhiteboardGlobalTaskLinks === 'function'
                ? __tmGetWhiteboardGlobalTaskLinks().filter((link) => {
                    const from = String(link?.from || '').trim();
                    const to = String(link?.to || '').trim();
                    return !!from && !!to && visibleTaskIds.has(from) && visibleTaskIds.has(to);
                })
                : __tmGetAllTaskLinks({ docId, includeAuto: false });
            const rootRect = docBody.getBoundingClientRect();
            const zoom = Math.max(0.01, Number(__tmGetWhiteboardView()?.zoom) || 1);
            const getLocalCenter = (el) => {
                if (!(el instanceof Element)) return null;
                try {
                    const rect = el.getBoundingClientRect();
                    return {
                        x: (rect.left - rootRect.left + (rect.width / 2) + docBody.scrollLeft) / zoom,
                        y: (rect.top - rootRect.top + (rect.height / 2) + docBody.scrollTop) / zoom,
                    };
                } catch (e) {
                    return null;
                }
            };
            const getPt = (taskId, kind) => {
                const id = String(taskId || '').trim();
                if (!id) return null;
                const node = docBody.querySelector(`.tm-whiteboard-node[data-task-id="${CSS.escape(id)}"]`);
                if (!(node instanceof Element)) {
                    const proxyTaskId = __tmFindWhiteboardCollapsedProxyTaskId(id, docId);
                    if (!proxyTaskId) return null;
                    const proxyNode = docBody.querySelector(`.tm-whiteboard-node[data-task-id="${CSS.escape(proxyTaskId)}"]`);
                    if (!(proxyNode instanceof Element)) return null;
                    const proxyDot = proxyNode.querySelector('.tm-whiteboard-collapse-proxy-dot');
                    if (!(proxyDot instanceof Element)) return null;
                    return getLocalCenter(proxyDot);
                }
                const dotSel = kind === 'from' ? '.tm-task-link-dot--out' : '.tm-task-link-dot--in';
                const anchor = node.querySelector(dotSel) || node;
                return getLocalCenter(anchor);
            };
            const getLocalRect = (el) => {
                if (!(el instanceof Element)) return null;
                try {
                    const rect = el.getBoundingClientRect();
                    const x = (rect.left - rootRect.left + docBody.scrollLeft) / zoom;
                    const y = (rect.top - rootRect.top + docBody.scrollTop) / zoom;
                    const w = rect.width / zoom;
                    const h = rect.height / zoom;
                    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return null;
                    return { x, y, w: Math.max(1, w), h: Math.max(1, h) };
                } catch (e) {
                    return null;
                }
            };
            const obstacleRects = [];
            const rectByTaskId = new Map();
            try {
                docBody.querySelectorAll('.tm-whiteboard-node[data-task-id]').forEach((el) => {
                    if (!(el instanceof Element)) return;
                    const rid = String(el.getAttribute('data-task-id') || '').trim();
                    const rr = getLocalRect(el);
                    if (!rid || !rr) return;
                    obstacleRects.push({ taskId: rid, ...rr });
                    rectByTaskId.set(rid, rr);
                });
            } catch (e) {}
            const segmentHitsRect = (a, b, rect, pad = 10) => {
                const l = rect.x - pad;
                const r = rect.x + rect.w + pad;
                const t = rect.y - pad;
                const bt = rect.y + rect.h + pad;
                const ax = Number(a?.x);
                const ay = Number(a?.y);
                const bx = Number(b?.x);
                const by = Number(b?.y);
                if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(bx) || !Number.isFinite(by)) return false;
                // 只处理正交线段
                if (Math.abs(ay - by) <= 0.001) {
                    const y = ay;
                    const x0 = Math.min(ax, bx);
                    const x1 = Math.max(ax, bx);
                    return y >= t && y <= bt && x1 >= l && x0 <= r;
                }
                if (Math.abs(ax - bx) <= 0.001) {
                    const x = ax;
                    const y0 = Math.min(ay, by);
                    const y1 = Math.max(ay, by);
                    return x >= l && x <= r && y1 >= t && y0 <= bt;
                }
                return false;
            };
            const orthPathHitsObstacle = (pts, excludeTaskIds) => {
                if (!Array.isArray(pts) || pts.length < 2) return true;
                const excluded = new Set((excludeTaskIds || []).map((x) => String(x || '').trim()).filter(Boolean));
                for (let i = 1; i < pts.length; i++) {
                    const a = pts[i - 1];
                    const b = pts[i];
                    for (const rect of obstacleRects) {
                        if (excluded.has(String(rect.taskId || '').trim())) continue;
                        if (segmentHitsRect(a, b, rect, 10)) return true;
                    }
                }
                return false;
            };
            const pointsToPathD = (pts) => {
                if (!Array.isArray(pts) || !pts.length) return '';
                const head = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
                if (pts.length === 1) return head;
                return `${head} ${pts.slice(1).map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')}`;
            };
            const pointsToSmoothPathD = (pts, radius = 10) => {
                if (!Array.isArray(pts) || pts.length < 2) return '';
                if (pts.length === 2) return pointsToPathD(pts);
                const r0 = Math.max(0, Number(radius) || 0);
                const fmt = (n) => Number(n).toFixed(2);
                let d = `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
                for (let i = 1; i < pts.length - 1; i++) {
                    const p0 = pts[i - 1];
                    const p1 = pts[i];
                    const p2 = pts[i + 1];
                    const v1x = p1.x - p0.x;
                    const v1y = p1.y - p0.y;
                    const v2x = p2.x - p1.x;
                    const v2y = p2.y - p1.y;
                    const l1 = Math.hypot(v1x, v1y);
                    const l2 = Math.hypot(v2x, v2y);
                    if (!(l1 > 0) || !(l2 > 0) || r0 <= 0) {
                        d += ` L ${fmt(p1.x)} ${fmt(p1.y)}`;
                        continue;
                    }
                    const r = Math.min(r0, l1 / 2, l2 / 2);
                    const inX = p1.x - (v1x / l1) * r;
                    const inY = p1.y - (v1y / l1) * r;
                    const outX = p1.x + (v2x / l2) * r;
                    const outY = p1.y + (v2y / l2) * r;
                    d += ` L ${fmt(inX)} ${fmt(inY)} Q ${fmt(p1.x)} ${fmt(p1.y)} ${fmt(outX)} ${fmt(outY)}`;
                }
                const last = pts[pts.length - 1];
                d += ` L ${fmt(last.x)} ${fmt(last.y)}`;
                return d;
            };
            const pathMidPoint = (pts) => {
                if (!Array.isArray(pts) || pts.length < 2) return null;
                const segLens = [];
                let total = 0;
                for (let i = 1; i < pts.length; i++) {
                    const dx = Number(pts[i].x) - Number(pts[i - 1].x);
                    const dy = Number(pts[i].y) - Number(pts[i - 1].y);
                    const len = Math.hypot(dx, dy);
                    segLens.push(len);
                    total += len;
                }
                if (!(total > 0)) return { x: pts[0].x, y: pts[0].y };
                let acc = 0;
                const half = total / 2;
                for (let i = 1; i < pts.length; i++) {
                    const seg = segLens[i - 1];
                    if (acc + seg >= half) {
                        const t = seg <= 0 ? 0 : ((half - acc) / seg);
                        return {
                            x: pts[i - 1].x + ((pts[i].x - pts[i - 1].x) * t),
                            y: pts[i - 1].y + ((pts[i].y - pts[i - 1].y) * t),
                        };
                    }
                    acc += seg;
                }
                return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y };
            };
            const buildAvoidPath = (from, to, excludeTaskIds = [], routeMeta = {}) => {
                if (!from || !to) return { d: '', pts: [] };
                const midY = (from.y + to.y) * 0.5;
                const gap = 28;
                const fromRect = (() => {
                    const id = String(routeMeta?.fromTaskId || routeMeta?.fromProxyTaskId || '').trim();
                    return id ? (rectByTaskId.get(id) || null) : null;
                })();
                const toRect = (() => {
                    const id = String(routeMeta?.toTaskId || routeMeta?.toProxyTaskId || '').trim();
                    return id ? (rectByTaskId.get(id) || null) : null;
                })();
                const needStartGap = !!(fromRect && toRect)
                    ? ((fromRect.x + fromRect.w) > toRect.x)
                    : ((to.x - from.x) < 80);
                if (!needStartGap) {
                    const x1 = from.x + ((to.x - from.x) * 0.5);
                    const x2 = x1;
                    const pts = [from, { x: x1, y: from.y }, { x: x2, y: to.y }, to];
                    return { d: `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} C ${x1.toFixed(2)} ${from.y.toFixed(2)} ${x2.toFixed(2)} ${to.y.toFixed(2)} ${to.x.toFixed(2)} ${to.y.toFixed(2)}`, pts };
                }
                const fx = from.x + gap;
                const tx = to.x - gap;
                const yCandidatesRaw = [from.y, to.y, midY];
                obstacleRects.forEach((r) => {
                    yCandidatesRaw.push(r.y - 14);
                    yCandidatesRaw.push(r.y + r.h + 14);
                });
                const seenY = new Set();
                const yCandidates = yCandidatesRaw
                    .map((y) => Math.round(Number(y) * 10) / 10)
                    .filter((y) => Number.isFinite(y))
                    .filter((y) => {
                        const k = String(y);
                        if (seenY.has(k)) return false;
                        seenY.add(k);
                        return true;
                    })
                    .sort((a, b) => Math.abs(a - midY) - Math.abs(b - midY));
                const candidates = [];
                yCandidates.forEach((ry) => {
                    candidates.push([
                        from,
                        { x: fx, y: from.y },
                        { x: fx, y: ry },
                        { x: tx, y: ry },
                        { x: tx, y: to.y },
                        to,
                    ]);
                });
                for (const pts of candidates) {
                    if (!orthPathHitsObstacle(pts, excludeTaskIds)) {
                        return { d: pointsToSmoothPathD(pts, 10), pts };
                    }
                }
                // 回退：保留原来的曲线，避免无路径时完全不显示
                const x1 = from.x + ((to.x - from.x) * 0.5);
                const x2 = x1;
                const pts = [from, { x: x1, y: from.y }, { x: x2, y: to.y }, to];
                return { d: `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} C ${x1.toFixed(2)} ${from.y.toFixed(2)} ${x2.toFixed(2)} ${to.y.toFixed(2)} ${to.x.toFixed(2)} ${to.y.toFixed(2)}`, pts };
            };
            const markerIdIn = `tmWbArrowIn_${docId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
            const markerIdOut = `tmWbArrowOut_${docId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
            const defs = `
                <defs>
                    <marker id="${esc(markerIdOut)}" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
                        <path d="M0,0 L8,3 L0,6 Z" fill="var(--tm-primary-color)"></path>
                    </marker>
                    <marker id="${esc(markerIdIn)}" markerWidth="8" markerHeight="6" refX="1" refY="3" orient="auto-start-reverse" markerUnits="strokeWidth">
                        <path d="M8,0 L0,3 L8,6 Z" fill="var(--tm-primary-color)"></path>
                    </marker>
                </defs>
            `;
            const selectedLinkId = String(state.whiteboardSelectedLinkId || '').trim();
            const selectedLinkDocId = String(state.whiteboardSelectedLinkDocId || '').trim();
            const multiSelectedLinkSet = new Set((Array.isArray(state.whiteboardMultiSelectedLinkKeys) ? state.whiteboardMultiSelectedLinkKeys : []).map((x) => String(x || '').trim()).filter(Boolean));
            let selectedToolPos = null;
            const paths = links.map((link) => {
                const linkDocId = isGlobalBody && link?.global
                    ? globalCanvasDocId
                    : (String(link?.docId || docId).trim() || docId);
                const from = getPt(link.from, 'from');
                const to = getPt(link.to, 'to');
                if (!from || !to) return '';
                const fromProxyDocId = isGlobalBody
                    ? (String(link?.fromDocId || __tmGetTaskDocIdById(link.from) || '').trim() || docId)
                    : docId;
                const toProxyDocId = isGlobalBody
                    ? (String(link?.toDocId || __tmGetTaskDocIdById(link.to) || '').trim() || docId)
                    : docId;
                const fromProxy = __tmFindWhiteboardCollapsedProxyTaskId(link.from, fromProxyDocId);
                const toProxy = __tmFindWhiteboardCollapsedProxyTaskId(link.to, toProxyDocId);
                const routed = buildAvoidPath(
                    from,
                    to,
                    [link.from, link.to, fromProxy, toProxy],
                    { fromTaskId: link.from, toTaskId: link.to, fromProxyTaskId: fromProxy, toProxyTaskId: toProxy }
                );
                const d = routed.d;
                const isSelected = link.manual
                    && selectedLinkId
                    && selectedLinkDocId === linkDocId
                    && String(link.id || '').trim() === selectedLinkId;
                const linkKey = `${linkDocId}::${String(link.id || '').trim()}`;
                const cls = link.manual
                    ? `tm-whiteboard-edge tm-whiteboard-edge--manual${isSelected ? ' tm-whiteboard-edge--selected' : ''}${multiSelectedLinkSet.has(linkKey) ? ' tm-whiteboard-multi-selected' : ''}`
                    : 'tm-whiteboard-edge tm-whiteboard-edge--auto';
                const idEsc = String(link.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                const docEsc = String(linkDocId || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                const click = link.manual ? `onclick="tmWhiteboardSelectLink('${idEsc}', '${docEsc}', event)"` : '';
                if (isSelected) {
                    const pts = Array.isArray(routed.pts) && routed.pts.length >= 2 ? routed.pts : [from, to];
                    const mp = pathMidPoint(pts) || { x: (from.x + to.x) * 0.5, y: (from.y + to.y) * 0.5 };
                    const mx = mp.x;
                    const my = mp.y;
                    selectedToolPos = { x: mx, y: my };
                }
                const dataAttrs = link.manual ? ` data-link-id="${esc(String(link.id || ''))}" data-doc-id="${esc(String(linkDocId || ''))}"` : '';
                const hitPath = link.manual
                    ? `<path class="tm-whiteboard-edge tm-whiteboard-edge--hit" d="${d}" ${click}></path>`
                    : '';
                return `${hitPath}<path class="${cls}" d="${d}" marker-end="url(#${esc(markerIdOut)})"${dataAttrs} ${click}></path>`;
            }).join('');
            let previewPath = '';
            const fromTaskId = String(state.whiteboardLinkFromTaskId || '').trim();
            const fromDocId = String(state.whiteboardLinkFromDocId || '').trim();
            const preview = state.whiteboardLinkPreview && typeof state.whiteboardLinkPreview === 'object' ? state.whiteboardLinkPreview : null;
            const shouldRenderPreview = isGlobalBody
                ? (fromTaskId && visibleTaskIds.has(fromTaskId))
                : (fromTaskId && fromDocId === docId);
            if (shouldRenderPreview && preview) {
                const from = getPt(fromTaskId, 'from');
                if (from) {
                    let tx = NaN;
                    let ty = NaN;
                    if (String(preview.targetTaskId || '').trim()) {
                        const toPt = getPt(String(preview.targetTaskId || '').trim(), 'to');
                        if (toPt) {
                            tx = toPt.x;
                            ty = toPt.y;
                        }
                    }
                    if (!Number.isFinite(tx) || !Number.isFinite(ty)) {
                        const cx = Number(preview.clientX);
                        const cy = Number(preview.clientY);
                        if (Number.isFinite(cx) && Number.isFinite(cy)) {
                            tx = (cx - rootRect.left + docBody.scrollLeft) / zoom;
                            ty = (cy - rootRect.top + docBody.scrollTop) / zoom;
                        }
                    }
                    if (Number.isFinite(tx) && Number.isFinite(ty)) {
                        const fromProxyDocId = isGlobalBody ? (fromDocId || docId) : docId;
                        const fromProxy = __tmFindWhiteboardCollapsedProxyTaskId(fromTaskId, fromProxyDocId);
                        const targetTaskId = String(preview.targetTaskId || '').trim();
                        const toProxyDocId = isGlobalBody
                            ? (String(preview.targetDocId || __tmGetTaskDocIdById(targetTaskId) || '').trim() || docId)
                            : docId;
                        const toProxy = targetTaskId ? __tmFindWhiteboardCollapsedProxyTaskId(targetTaskId, toProxyDocId) : '';
                        const d = buildAvoidPath(
                            from,
                            { x: tx, y: ty },
                            [fromTaskId, fromProxy, targetTaskId, toProxy],
                            { fromTaskId, toTaskId: targetTaskId, fromProxyTaskId: fromProxy, toProxyTaskId: toProxy }
                        ).d;
                        previewPath = `<path class="tm-whiteboard-edge tm-whiteboard-edge--preview" d="${d}" marker-end="url(#${esc(markerIdOut)})"></path>`;
                    }
                }
            }
            svg.innerHTML = defs + paths + previewPath;
            const selectedToolDocId = isGlobalBody ? globalCanvasDocId : docId;
            if (selectedToolPos && selectedLinkId && selectedLinkDocId === selectedToolDocId) {
                try {
                    const tools = document.createElement('div');
                    tools.className = 'tm-whiteboard-link-tools';
                    tools.setAttribute('data-tm-wb-dyn', '1');
                    tools.style.left = `${Math.round(selectedToolPos.x - 56)}px`;
                    tools.style.top = `${Math.round(selectedToolPos.y - 42)}px`;
                    tools.innerHTML = `<button class="tm-btn tm-btn-danger" style="padding:2px 8px;font-size:12px;" title="移除该连线">移除连线</button>`;
                    const btn = tools.querySelector('button');
                    if (btn) {
                        btn.addEventListener('click', (ev) => {
                            try { ev.stopPropagation(); } catch (e) {}
                            try { window.tmWhiteboardRemoveSelectedLink?.(ev); } catch (e) {}
                        });
                    }
                    tools.addEventListener('click', (ev) => {
                        try { ev.stopPropagation(); } catch (e) {}
                    });
                    docBody.appendChild(tools);
                } catch (e) {}
            }
        });
    }

    function __tmNormalizeTaskLinkSide(side) {
        return String(side || '').trim().toLowerCase() === 'in' ? 'in' : 'out';
    }

    function __tmResetLinkDragState() {
        state.whiteboardLinkFromTaskId = '';
        state.whiteboardLinkFromDocId = '';
        state.whiteboardLinkFromSide = 'out';
        state.whiteboardLinkPress = null;
        state.whiteboardLinkPreview = null;
        __tmUpdateWhiteboardLinkHover('', '');
        __tmUpdateTimelineLinkHover('');
        try { state.__tmTimelineRenderDeps?.(); } catch (e) {}
    }

    function __tmUpdateWhiteboardLinkPreviewFromEvent(ev, targetTaskId, targetDocId) {
        const fromTaskId = String(state.whiteboardLinkFromTaskId || '').trim();
        const fromDocId = String(state.whiteboardLinkFromDocId || '').trim();
        if (!fromTaskId || !fromDocId) return;
        const tId = String(targetTaskId || '').trim();
        const tDocId = String(targetDocId || '').trim();
        state.whiteboardLinkPreview = {
            mode: state.viewMode === 'timeline' ? 'timeline' : 'whiteboard',
            side: __tmNormalizeTaskLinkSide(state.whiteboardLinkFromSide),
            clientX: Number(ev?.clientX) || 0,
            clientY: Number(ev?.clientY) || 0,
            targetTaskId: tId,
            targetDocId: tDocId || fromDocId,
        };
    }

    function __tmUpdateTimelineLinkHover(taskId) {
        const id = String(taskId || '').trim();
        const targetSide = __tmNormalizeTaskLinkSide(state.whiteboardLinkFromSide) === 'in' ? 'out' : 'in';
        state.timelineLinkHoverTaskId = id;
        const body = state.modal?.querySelector?.('#tmGanttBody');
        if (!(body instanceof HTMLElement)) return;
        try {
            body.querySelectorAll('.tm-gantt-row--link-hover, .tm-gantt-row--link-hover-in, .tm-gantt-row--link-hover-out').forEach((el) => {
                el.classList.remove('tm-gantt-row--link-hover', 'tm-gantt-row--link-hover-in', 'tm-gantt-row--link-hover-out');
            });
        } catch (e) {}
        if (!id) return;
        try {
            const row = body.querySelector(`.tm-gantt-row[data-id="${CSS.escape(id)}"]`);
            if (row instanceof HTMLElement) row.classList.add('tm-gantt-row--link-hover', `tm-gantt-row--link-hover-${targetSide}`);
        } catch (e) {}
    }

    function __tmUpdateWhiteboardLinkHover(taskId, docId) {
        const tid = String(taskId || '').trim();
        const did = String(docId || '').trim();
        state.whiteboardLinkHoverTaskId = tid;
        state.whiteboardLinkHoverDocId = did;
        const body = state.modal?.querySelector?.('#tmWhiteboardBody');
        if (!(body instanceof HTMLElement)) return;
        try {
            body.querySelectorAll('.tm-whiteboard-node--link-hover').forEach((el) => el.classList.remove('tm-whiteboard-node--link-hover'));
        } catch (e) {}
        if (!tid || !did) return;
        try {
            const node = body.querySelector(`.tm-whiteboard-node[data-task-id="${CSS.escape(tid)}"][data-doc-id="${CSS.escape(did)}"]`);
            if (node instanceof HTMLElement) node.classList.add('tm-whiteboard-node--link-hover');
        } catch (e) {}
    }

    function __tmClearTaskLinkPointerFallback() {
        const s = state.whiteboardLinkPointerFallback;
        if (!s || typeof s !== 'object') return;
        try { s.detach?.(); } catch (e) {}
        state.whiteboardLinkPointerFallback = null;
    }

    function __tmStartTaskLinkPointerFallback(ev, taskId, docId, side) {
        __tmClearTaskLinkPointerFallback();
        const fromTaskId = String(taskId || '').trim();
        const fromDocId = String(docId || '').trim();
        const fromSide = __tmNormalizeTaskLinkSide(side);
        if (!fromTaskId || !fromDocId) return;
        const pointerIdRaw = Number(ev?.pointerId);
        const pointerId = Number.isFinite(pointerIdRaw) ? pointerIdRaw : null;
        const sx = Number(ev?.clientX) || 0;
        const sy = Number(ev?.clientY) || 0;
        const session = {
            pointerId,
            fromTaskId,
            fromDocId,
            fromSide,
            sx,
            sy,
            moved: false,
            dragStarted: false,
            hoverTaskId: '',
            hoverDocId: '',
            detach: null,
        };
        const samePointer = (e2) => {
            if (!session) return false;
            if (session.pointerId === null) return true;
            const cur = Number(e2?.pointerId);
            if (!Number.isFinite(cur)) return true;
            return cur === Number(session.pointerId);
        };
        const updateHoverFromPoint = (e2) => {
            const x = Number(e2?.clientX);
            const y = Number(e2?.clientY);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            let tid = '';
            let did = '';
            try {
                const hit = document.elementFromPoint(x, y);
                const wbNode = hit?.closest?.('.tm-whiteboard-node[data-task-id][data-doc-id]');
                if (wbNode instanceof Element) {
                    tid = String(wbNode.getAttribute('data-task-id') || '').trim();
                    did = String(wbNode.getAttribute('data-doc-id') || '').trim();
                } else {
                    const row = hit?.closest?.('.tm-gantt-row[data-id]');
                    if (row instanceof Element) {
                        tid = String(row.getAttribute('data-id') || '').trim();
                        did = String(row.getAttribute('data-doc-id') || '').trim();
                    }
                }
            } catch (e) {}
            session.hoverTaskId = tid;
            session.hoverDocId = did;
            if (state.viewMode === 'whiteboard') {
                __tmUpdateWhiteboardLinkHover(tid, did);
            } else {
                __tmUpdateTimelineLinkHover(tid);
            }
            __tmUpdateWhiteboardLinkPreviewFromEvent(e2, tid, did || fromDocId);
            if (state.viewMode === 'timeline') {
                try { state.__tmTimelineRenderDeps?.(); } catch (e) {}
            } else {
                __tmScheduleWhiteboardEdgeRedraw();
            }
        };
        const onMove = (e2) => {
            if (!samePointer(e2)) return;
            try { e2?.preventDefault?.(); } catch (e) {}
            try { e2?.stopPropagation?.(); } catch (e) {}
            const x = Number(e2?.clientX) || sx;
            const y = Number(e2?.clientY) || sy;
            if (!session.moved) {
                const dx = x - sx;
                const dy = y - sy;
                if ((dx * dx + dy * dy) >= 16) session.moved = true;
            }
            updateHoverFromPoint(e2);
        };
        const onUp = async (e2) => {
            if (!samePointer(e2)) return;
            try { e2?.preventDefault?.(); } catch (e) {}
            try { e2?.stopPropagation?.(); } catch (e) {}
            __tmClearTaskLinkPointerFallback();
            if (session.dragStarted) return;
            if (session.moved && session.hoverTaskId) {
                try {
                    await window.tmTaskLinkDotDrop?.(e2, session.hoverTaskId, session.hoverDocId || fromDocId);
                    return;
                } catch (e) {}
            }
            __tmResetLinkDragState();
            __tmScheduleWhiteboardEdgeRedraw();
        };
        const detach = () => {
            try { window.removeEventListener('pointermove', onMove, true); } catch (e) {}
            try { window.removeEventListener('pointerup', onUp, true); } catch (e) {}
            try { window.removeEventListener('pointercancel', onUp, true); } catch (e) {}
            try { window.removeEventListener('blur', onUp, true); } catch (e) {}
        };
        session.detach = detach;
        state.whiteboardLinkPointerFallback = session;
        try { window.addEventListener('pointermove', onMove, true); } catch (e) {}
        try { window.addEventListener('pointerup', onUp, true); } catch (e) {}
        try { window.addEventListener('pointercancel', onUp, true); } catch (e) {}
        try { window.addEventListener('blur', onUp, true); } catch (e) {}
    }

    window.tmTaskLinkDotPressStart = function(ev, taskId, docId, side) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.stopImmediatePropagation?.(); } catch (e) {}
        try { ev?.preventDefault?.(); } catch (e) {}
        state.whiteboardLinkPress = {
            taskId: String(taskId || '').trim(),
            docId: String(docId || '').trim(),
            side: __tmNormalizeTaskLinkSide(side),
            at: Date.now(),
        };
        const id = String(taskId || '').trim();
        const did = String(docId || '').trim();
        if (!id || !did) return;
        state.whiteboardLinkFromTaskId = id;
        state.whiteboardLinkFromDocId = did;
        state.whiteboardLinkFromSide = __tmNormalizeTaskLinkSide(side);
        __tmUpdateWhiteboardLinkHover('', '');
        __tmUpdateWhiteboardLinkPreviewFromEvent(ev, '', did);
        __tmScheduleWhiteboardEdgeRedraw();
        __tmStartTaskLinkPointerFallback(ev, id, did, state.whiteboardLinkFromSide);
    };

    window.tmTaskLinkDotDragStart = function(ev, taskId, docId, side) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.stopImmediatePropagation?.(); } catch (e) {}
        const fb = state.whiteboardLinkPointerFallback;
        if (fb && typeof fb === 'object') {
            fb.dragStarted = true;
            try { fb.detach?.(); } catch (e) {}
            state.whiteboardLinkPointerFallback = null;
        }
        const id = String(taskId || '').trim();
        const did = String(docId || '').trim();
        if (!id || !did) return;
        state.whiteboardLinkFromTaskId = id;
        state.whiteboardLinkFromDocId = did;
        state.whiteboardLinkFromSide = __tmNormalizeTaskLinkSide(side);
        __tmUpdateWhiteboardLinkHover('', '');
        __tmUpdateWhiteboardLinkPreviewFromEvent(ev, '', did);
        try {
            ev.dataTransfer.effectAllowed = 'link';
            const payload = JSON.stringify({ type: 'tm-task-link', taskId: id, docId: did, side: state.whiteboardLinkFromSide });
            ev.dataTransfer.setData('application/x-tm-task-link', payload);
            ev.dataTransfer.setData('text/plain', payload);
        } catch (e) {}
        __tmScheduleWhiteboardEdgeRedraw();
    };

    window.tmTaskLinkDotDragOver = function(ev) {
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.stopImmediatePropagation?.(); } catch (e) {}
        const target = ev?.currentTarget instanceof Element ? ev.currentTarget : (ev?.target?.closest?.('.tm-task-link-dot') || null);
        const taskId = String(target?.closest?.('.tm-whiteboard-node,[data-id]')?.getAttribute?.('data-task-id') || target?.closest?.('.tm-gantt-row')?.getAttribute?.('data-id') || '').trim();
        const docId = String(target?.closest?.('.tm-whiteboard-node')?.getAttribute?.('data-doc-id') || target?.closest?.('.tm-gantt-row')?.getAttribute?.('data-doc-id') || '').trim();
        if (state.viewMode === 'whiteboard') __tmUpdateWhiteboardLinkHover(taskId, docId);
        __tmUpdateWhiteboardLinkPreviewFromEvent(ev, taskId, docId);
        if (state.viewMode === 'timeline') {
            __tmUpdateTimelineLinkHover(taskId);
            try { state.__tmTimelineRenderDeps?.(); } catch (e) {}
        } else {
            __tmScheduleWhiteboardEdgeRedraw();
        }
    };

    window.tmTimelineLinkRowDragOver = function(ev, taskId, docId) {
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        const fromTaskId = String(state.whiteboardLinkFromTaskId || '').trim();
        if (!fromTaskId) return;
        const id = String(taskId || '').trim();
        __tmUpdateTimelineLinkHover(id);
        __tmUpdateWhiteboardLinkPreviewFromEvent(ev, id, String(docId || '').trim());
        try { state.__tmTimelineRenderDeps?.(); } catch (e) {}
    };

    window.tmTimelineLinkRowDragLeave = function(ev, taskId) {
        const related = ev?.relatedTarget;
        if (related && related instanceof Element) {
            const row = ev?.currentTarget instanceof Element ? ev.currentTarget : null;
            if (row && row.contains(related)) return;
        }
        const id = String(taskId || '').trim();
        if (!id || String(state.timelineLinkHoverTaskId || '').trim() !== id) return;
        __tmUpdateTimelineLinkHover('');
        try { state.__tmTimelineRenderDeps?.(); } catch (e) {}
    };

    window.tmTaskLinkDotDragEnd = function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.stopImmediatePropagation?.(); } catch (e) {}
        __tmClearTaskLinkPointerFallback();
        __tmResetLinkDragState();
        __tmScheduleWhiteboardEdgeRedraw();
    };

    window.tmTaskLinkDotDrop = async function(ev, targetTaskId, targetDocId) {
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        try { ev?.stopImmediatePropagation?.(); } catch (e) {}
        const targetId = String(targetTaskId || '').trim();
        let originId = '';
        let originDocId = '';
        let originSide = __tmNormalizeTaskLinkSide(state.whiteboardLinkFromSide);
        try {
            const raw = ev?.dataTransfer?.getData?.('application/x-tm-task-link') || ev?.dataTransfer?.getData?.('text/plain');
            if (raw) {
                const obj = JSON.parse(raw);
                if (String(obj?.type || '').trim() === 'tm-task-link') {
                    originId = String(obj?.taskId || '').trim();
                    originDocId = String(obj?.docId || '').trim();
                    if (String(obj?.side || '').trim()) originSide = __tmNormalizeTaskLinkSide(obj.side);
                }
            }
        } catch (e) {}
        if (!originId) originId = String(state.whiteboardLinkFromTaskId || '').trim();
        if (!originDocId) originDocId = String(state.whiteboardLinkFromDocId || '').trim();
        const targetDoc = String(targetDocId || '').trim() || __tmGetTaskDocIdById(targetId);
        if (!originId || !targetId || !originDocId || !targetDoc || originId === targetId) {
            __tmResetLinkDragState();
            __tmScheduleWhiteboardEdgeRedraw();
            return;
        }
        const fromId = originSide === 'in' ? targetId : originId;
        const fromDocId = originSide === 'in' ? targetDoc : originDocId;
        const toId = originSide === 'in' ? originId : targetId;
        const toDocId = originSide === 'in' ? originDocId : targetDoc;
        let globalBody = null;
        try {
            const eventNode = ev?.currentTarget instanceof Element
                ? ev.currentTarget
                : (ev?.target instanceof Element ? ev.target : null);
            globalBody = __tmGetWhiteboardGlobalBodyFromElement(eventNode);
        } catch (e) {}
        if (!globalBody && typeof __tmIsWhiteboardGlobalCanvasActive === 'function' && __tmIsWhiteboardGlobalCanvasActive()) {
            const body = __tmGetWhiteboardGlobalCanvasBody();
            try {
                if (body?.querySelector?.(`.tm-whiteboard-node[data-task-id="${CSS.escape(toId)}"]`)) {
                    globalBody = body;
                }
            } catch (e) {}
        }
        const isTimelineDrop = String(state.viewMode || '').trim() === 'timeline';
        if (isTimelineDrop) {
            __tmResetLinkDragState();
            __tmScheduleWhiteboardEdgeRedraw();
        }
        const resetAfterDrop = () => {
            if (!isTimelineDrop) __tmResetLinkDragState();
            if (isTimelineDrop) {
                try { state.__tmTimelineRenderDeps?.(); } catch (e) {}
            } else {
                __tmScheduleWhiteboardEdgeRedraw();
            }
        };
        const renderAfterDrop = () => {
            resetAfterDrop();
            if (!isTimelineDrop) render();
        };
        const commitDrop = async () => {
            if (globalBody && typeof __tmGetWhiteboardGlobalTaskLinks === 'function' && typeof __tmSetWhiteboardGlobalTaskLinks === 'function') {
                let fromDocIdForGlobal = fromDocId;
                let toDocIdForGlobal = toDocId;
                let hasFromNode = false;
                let hasToNode = false;
                try {
                    const fromNode = globalBody.querySelector(`.tm-whiteboard-node[data-task-id="${CSS.escape(fromId)}"]`);
                    const toNode = globalBody.querySelector(`.tm-whiteboard-node[data-task-id="${CSS.escape(toId)}"]`);
                    hasFromNode = fromNode instanceof Element;
                    hasToNode = toNode instanceof Element;
                    fromDocIdForGlobal = String(fromNode?.getAttribute?.('data-doc-id') || fromDocIdForGlobal || '').trim();
                    toDocIdForGlobal = String(toNode?.getAttribute?.('data-doc-id') || toDocIdForGlobal || '').trim();
                } catch (e) {}
                if (hasFromNode && hasToNode) {
                    const manual = __tmGetWhiteboardGlobalTaskLinks();
                    const exists = manual.some(x => String(x?.from || '') === fromId && String(x?.to || '') === toId);
                    if (exists) {
                        hint('ℹ 该连线已存在', 'info');
                        resetAfterDrop();
                        return;
                    }
                    __tmPushWhiteboardHistorySnapshot('add-link');
                    manual.push({
                        id: `global_link_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                        from: fromId,
                        to: toId,
                        fromDocId: fromDocIdForGlobal,
                        toDocId: toDocIdForGlobal,
                        createdAt: String(Date.now()),
                    });
                    __tmSetWhiteboardGlobalTaskLinks(manual, '', { keepEmpty: true });
                    try { await SettingsStore.save(); } catch (e) {}
                    renderAfterDrop();
                    return;
                }
            }
            const check = __tmCanLinkTasks(fromId, toId);
            if (!check.ok) {
                hint(`⚠ ${check.reason}`, 'warning');
                resetAfterDrop();
                return;
            }
            const docId = String(check.docId || '').trim();
            const manual = __tmGetManualTaskLinks();
            const exists = manual.some(x => String(x?.from || '') === fromId && String(x?.to || '') === toId && String(x?.docId || '') === docId);
            if (exists) {
                hint('ℹ 该连线已存在', 'info');
                resetAfterDrop();
                return;
            }
            __tmPushWhiteboardHistorySnapshot('add-link');
            manual.push({
                id: `link_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                from: fromId,
                to: toId,
                docId,
                createdAt: String(Date.now()),
            });
            __tmSetManualTaskLinks(manual);
            if (isTimelineDrop) {
                try { state.__tmTimelineRenderDeps?.(); } catch (e) {}
            }
            try { await SettingsStore.save(); } catch (e) {}
            if (!isTimelineDrop) renderAfterDrop();
        };
        if (isTimelineDrop) {
            return __tmEnqueueTimelineMutation(commitDrop, { label: 'timeline-link-create' });
        }
        return commitDrop();
    };

    window.tmWhiteboardRemoveLink = async function(linkId, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const id = String(linkId || '').trim();
        if (!id) return;
        const globalCanvasDocId = typeof __tmGetWhiteboardGlobalCanvasDocId === 'function'
            ? __tmGetWhiteboardGlobalCanvasDocId()
            : '__tm_global_whiteboard__';
        if (String(state.whiteboardSelectedLinkDocId || '').trim() === globalCanvasDocId
            && typeof __tmGetWhiteboardGlobalTaskLinks === 'function'
            && typeof __tmSetWhiteboardGlobalTaskLinks === 'function') {
            const beforeLinks = __tmGetWhiteboardGlobalTaskLinks();
            if (!beforeLinks.some(x => String(x?.id || '').trim() === id)) return;
            __tmPushWhiteboardHistorySnapshot('delete-link');
            const links = beforeLinks.filter(x => String(x?.id || '').trim() !== id);
            __tmSetWhiteboardGlobalTaskLinks(links, '', { keepEmpty: true });
        } else {
            const beforeLinks = __tmGetManualTaskLinks();
            if (!beforeLinks.some(x => String(x?.id || '').trim() === id)) return;
            __tmPushWhiteboardHistorySnapshot('delete-link');
            const manual = beforeLinks.filter(x => String(x?.id || '').trim() !== id);
            __tmSetManualTaskLinks(manual);
        }
        if (String(state.whiteboardSelectedLinkId || '').trim() === id) {
            state.whiteboardSelectedLinkId = '';
            state.whiteboardSelectedLinkDocId = '';
        }
        try { await SettingsStore.save(); } catch (e) {}
        if (state.viewMode === 'whiteboard') __tmScheduleWhiteboardEdgeRedraw();
        render();
    };

    window.tmWhiteboardSelectLink = function(linkId, docId, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const id = String(linkId || '').trim();
        const did = String(docId || '').trim();
        if (!id || !did) return;
        if (String(state.whiteboardSelectedLinkId || '').trim() === id && String(state.whiteboardSelectedLinkDocId || '').trim() === did) {
            state.whiteboardSelectedLinkId = '';
            state.whiteboardSelectedLinkDocId = '';
        } else {
            state.whiteboardSelectedLinkId = id;
            state.whiteboardSelectedLinkDocId = did;
            state.whiteboardSelectedFrameId = '';
        }
        __tmScheduleWhiteboardEdgeRedraw();
    };

    window.tmWhiteboardRemoveSelectedLink = async function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const id = String(state.whiteboardSelectedLinkId || '').trim();
        if (!id) return;
        return window.tmWhiteboardRemoveLink(id, ev);
    };

    window.tmTimelineSelectLink = function(linkId, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const id = String(linkId || '').trim();
        if (!id) return;
        state.timelineSelectedLinkId = String(state.timelineSelectedLinkId || '').trim() === id ? '' : id;
        try { state.__tmTimelineRenderDeps?.(); } catch (e) {}
    };

    window.tmTimelineRemoveLink = async function(linkId, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const id = String(linkId || '').trim();
        if (!id) return;
        return await __tmEnqueueTimelineMutation(async () => {
            const manual = __tmGetManualTaskLinks().filter((x) => String(x?.id || '').trim() !== id);
            __tmSetManualTaskLinks(manual);
            if (String(state.timelineSelectedLinkId || '').trim() === id) state.timelineSelectedLinkId = '';
            try { state.__tmTimelineRenderDeps?.(); } catch (e) {}
            try { await SettingsStore.save(); } catch (e) {}
        }, { label: 'timeline-link-remove' });
    };

    function __tmIsWhiteboardCompactSidebarHost() {
        const modal = state.modal instanceof HTMLElement ? state.modal : null;
        if (!modal) return false;
        return modal.classList.contains('tm-modal--mobile')
            || modal.classList.contains('tm-modal--runtime-mobile')
            || modal.classList.contains('tm-modal--host-mobile-ui')
            || modal.classList.contains('tm-modal--dock');
    }

    window.tmWhiteboardToggleSidebar = async function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const compactHost = __tmIsWhiteboardCompactSidebarHost();
        const current = compactHost
            ? state.whiteboardCompactSidebarCollapsed !== false
            : !!SettingsStore.data.whiteboardSidebarCollapsed;
        const next = !current;
        if (compactHost) {
            state.whiteboardCompactSidebarCollapsed = next;
        } else {
            SettingsStore.data.whiteboardSidebarCollapsed = next;
        }
        const body = state.modal?.querySelector?.('#tmWhiteboardBody');
        const layout = body?.querySelector?.('.tm-whiteboard-layout');
        const btn = body?.querySelector?.('.tm-whiteboard-sidebar-toggle');
        if (layout) {
            try { layout.classList.toggle('tm-whiteboard-layout--sidebar-collapsed', !!next); } catch (e) {}
        }
        if (btn) {
            try {
                btn.textContent = next ? '☰' : '⟨';
                btn.title = next ? '展开侧栏' : '折叠侧栏';
            } catch (e) {}
        }
        if (!layout || !btn) render();
        if (!compactHost) {
            try { await SettingsStore.save(); } catch (e) {}
        }
    };

    function __tmRefreshWhiteboardAfterFullscreenToggle() {
        const run = () => {
            try { __tmApplyWhiteboardTransform(); } catch (e) {}
            try { __tmScheduleWhiteboardEdgeRedraw(); } catch (e) {}
            try { __tmScheduleWhiteboardNavigatorUpdate(); } catch (e) {}
        };
        try { run(); } catch (e) {}
        try { requestAnimationFrame(() => requestAnimationFrame(run)); } catch (e) {}
        try { setTimeout(run, 120); } catch (e) {}
    }

    function __tmSyncWhiteboardFullscreenShell() {
        const modal = state.modal instanceof HTMLElement ? state.modal : null;
        if (modal) {
            try { modal.classList.toggle('tm-modal--whiteboard-fullscreen', !!state.whiteboardPluginFullscreen); } catch (e) {}
        }
        __tmRefreshWhiteboardAfterFullscreenToggle();
    }

    window.tmWhiteboardExitFullscreen = function(source) {
        state.whiteboardPluginFullscreen = false;
        __tmSyncWhiteboardFullscreenShell();
        if (String(state.viewMode || '').trim() === 'whiteboard') {
            try { render(); } catch (e) {}
        }
    };

    window.tmWhiteboardTogglePluginFullscreen = function(ev) {
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        if (String(state.viewMode || '').trim() !== 'whiteboard') return;
        if (__tmIsWhiteboardAllTabsStreamMode()) return;
        if (state.whiteboardPluginFullscreen) {
            window.tmWhiteboardExitFullscreen('plugin-toggle');
            return;
        }
        state.whiteboardPluginFullscreen = true;
        __tmSyncWhiteboardFullscreenShell();
        try { render(); } catch (e) {}
    };

    try {
        const prevKeydown = window.__tmWhiteboardFullscreenKeydownHandler;
        if (typeof prevKeydown === 'function') {
            try { globalThis.__tmRuntimeEvents?.off?.(document, 'keydown', prevKeydown, false); } catch (e) {}
            try { document.removeEventListener('keydown', prevKeydown, false); } catch (e) {}
        }
        const isEditableShortcutTarget = (target) => {
            if (!(target instanceof Element)) return false;
            if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
            if (target.isContentEditable) return true;
            try {
                return !!target.closest('[contenteditable="true"],[contenteditable=""],.ProseMirror,.tm-whiteboard-note-editor,.tm-whiteboard-sticky-editor');
            } catch (e) {
                return false;
            }
        };
        const hasWhiteboardMultiSelection = () => {
            return (Array.isArray(state.whiteboardMultiSelectedTaskIds) && state.whiteboardMultiSelectedTaskIds.length)
                || (Array.isArray(state.whiteboardMultiSelectedNoteIds) && state.whiteboardMultiSelectedNoteIds.length)
                || (Array.isArray(state.whiteboardMultiSelectedLinkKeys) && state.whiteboardMultiSelectedLinkKeys.length)
                || (Array.isArray(state.whiteboardMultiSelectedStrokeIds) && state.whiteboardMultiSelectedStrokeIds.length);
        };
        const resolveWhiteboardSelectedTaskDocId = (taskId) => {
            const id = String(taskId || '').trim();
            if (!id) return '';
            try {
                const el = state.modal?.querySelector?.(`#tmWhiteboardBody .tm-whiteboard-node[data-task-id="${CSS.escape(id)}"]`);
                const did = String(el?.getAttribute?.('data-doc-id') || el?.dataset?.docId || '').trim();
                if (did) return did;
            } catch (e) {}
            const task = state.flatTasks?.[id] || state.pendingInsertedTasks?.[id] || null;
            return String(task?.root_id || task?.docId || state.activeDocId || '').trim();
        };
        const handleWhiteboardDeleteShortcut = async (ev) => {
            if (String(state.viewMode || '').trim() !== 'whiteboard') return false;
            if (String(ev?.key || '').toLowerCase() !== 'delete') return false;
            if (state.whiteboardDrawingSession || state.whiteboardFrameDrag || state.whiteboardFrameResize || state.whiteboardFrameCreate) return false;
            if (state.whiteboardNodeDrag || state.whiteboardNoteDrag || state.whiteboardPanSession || state.whiteboardMarqueeSession) return false;
            if (state.whiteboardNoteEditor) return false;
            if (isEditableShortcutTarget(ev?.target)) return false;

            if (hasWhiteboardMultiSelection()) {
                try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {}
                await window.tmWhiteboardDeleteMultiSelected?.(ev);
                return true;
            }
            const strokeIds = __tmGetSelectedWhiteboardStrokeIds();
            if (strokeIds.length) {
                try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {}
                await window.tmWhiteboardDeleteSelectedStrokes?.(ev);
                return true;
            }
            const linkId = String(state.whiteboardSelectedLinkId || '').trim();
            if (linkId) {
                try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {}
                await window.tmWhiteboardRemoveSelectedLink?.(ev);
                return true;
            }
            const frameId = String(state.whiteboardSelectedFrameId || '').trim();
            if (frameId) {
                try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {}
                await window.tmWhiteboardDeleteFrame?.(frameId, ev);
                return true;
            }
            const noteId = String(state.whiteboardSelectedNoteId || '').trim();
            if (noteId) {
                try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {}
                await window.tmWhiteboardDeleteNote?.(noteId, ev);
                return true;
            }
            const taskId = String(state.whiteboardSelectedTaskId || '').trim();
            if (taskId) {
                const docId = resolveWhiteboardSelectedTaskDocId(taskId);
                try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {}
                await window.tmWhiteboardDeleteCard?.(taskId, docId, ev);
                return true;
            }
            return false;
        };
        const onWhiteboardFullscreenKeydown = async (ev) => {
            const key = String(ev?.key || '').toLowerCase();
            if (String(state.viewMode || '').trim() === 'whiteboard'
                && key === 'z'
                && !!(ev?.ctrlKey || ev?.metaKey)
                && !ev?.shiftKey
                && !state.whiteboardDrawingSession
                && !isEditableShortcutTarget(ev?.target)) {
                try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {}
                if (__tmUndoWhiteboardHistoryChange({ render: true, persist: true })) return;
                if (!__tmIsWhiteboardDrawingEnabled() || !__tmHasWhiteboardDrawingUndo()) return;
                if (!__tmRequireWhiteboardDrawingFeature()) return;
                __tmUndoWhiteboardDrawingChange({ render: true, persist: true });
                return;
            }
            if (key === 'delete') {
                if (await handleWhiteboardDeleteShortcut(ev)) return;
            }
            if (key !== 'escape') return;
            if (!state.whiteboardPluginFullscreen) return;
            if (String(state.viewMode || '').trim() !== 'whiteboard') return;
            try { ev.preventDefault(); } catch (e) {}
            window.tmWhiteboardExitFullscreen('escape');
        };
        window.__tmWhiteboardFullscreenKeydownHandler = onWhiteboardFullscreenKeydown;
        try { globalThis.__tmRuntimeEvents?.on?.(document, 'keydown', onWhiteboardFullscreenKeydown, false); } catch (e) { document.addEventListener('keydown', onWhiteboardFullscreenKeydown, false); }
    } catch (e) {}

    function __tmRevealTimelineSidebarAfterRender(modalEl = null) {
        const reveal = () => {
            const modal = modalEl instanceof Element
                ? modalEl
                : (state.modal instanceof Element ? state.modal : null);
            if (!modal?.classList?.contains?.('tm-modal--mobile')) return;
            const scrollHost = modal.querySelector('.tm-body.tm-body--timeline');
            if (!(scrollHost instanceof HTMLElement)) return;
            state.viewScroll = state.viewScroll && typeof state.viewScroll === 'object' ? state.viewScroll : {};
            state.viewScroll.timeline = state.viewScroll.timeline && typeof state.viewScroll.timeline === 'object'
                ? state.viewScroll.timeline
                : {};
            state.viewScroll.timeline.left = 0;
            scrollHost.scrollLeft = 0;
        };
        try {
            reveal();
            requestAnimationFrame(() => requestAnimationFrame(reveal));
        } catch (e) {
            reveal();
        }
    }

    function __tmIsTimelineSidebarVisibleInViewport(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : null;
        const split = modal?.querySelector?.('.tm-timeline-split');
        const left = modal?.querySelector?.('.tm-timeline-left');
        const body = modal?.querySelector?.('.tm-body.tm-body--timeline');
        if (!(split instanceof HTMLElement) || !(left instanceof HTMLElement) || !(body instanceof HTMLElement)) return false;
        if (split.classList.contains('tm-timeline-split--sidebar-collapsed')) return false;
        try {
            const hostRect = body.getBoundingClientRect();
            const leftRect = left.getBoundingClientRect();
            const visibleWidth = Math.max(0, Math.min(hostRect.right, leftRect.right) - Math.max(hostRect.left, leftRect.left));
            if (leftRect.width > 0 && visibleWidth >= Math.min(48, leftRect.width * 0.15)) return true;
        } catch (e) {}
        return Number(body.scrollLeft || 0) <= 4;
    }

    window.tmTimelineToggleSidebar = async function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const modal = state.modal instanceof Element ? state.modal : null;
        const useScrollableDockSidebar = !!(modal?.classList?.contains?.('tm-modal--dock') && modal?.classList?.contains?.('tm-modal--mobile'));
        if (useScrollableDockSidebar
            && SettingsStore.data.timelineSidebarCollapsed !== true
            && !__tmIsTimelineSidebarVisibleInViewport(modal)) {
            __tmRevealTimelineSidebarAfterRender(modal);
            return;
        }
        const useMobileRuntimeState = !!(modal?.classList?.contains?.('tm-modal--mobile') && !modal?.classList?.contains?.('tm-modal--dock'));
        if (useMobileRuntimeState) {
            const expanding = state.timelineMobileSidebarExpanded !== true;
            state.timelineMobileSidebarExpanded = expanding;
            render();
            if (expanding) __tmRevealTimelineSidebarAfterRender(state.modal);
            return;
        }
        const next = !SettingsStore.data.timelineSidebarCollapsed;
        SettingsStore.data.timelineSidebarCollapsed = next;
        render();
        if (!next) __tmRevealTimelineSidebarAfterRender(state.modal);
        try { await SettingsStore.save(); } catch (e) {}
    };

    window.tmWhiteboardSetTool = async function(tool) {
        const t = String(tool || 'pan').trim();
        const next = (t === 'select' || t === 'text' || t === 'sticky' || t === 'pen' || t === 'highlighter' || t === 'eraser' || t === 'frame' || t === 'pan') ? t : 'pan';
        if (__tmIsWhiteboardDrawingTool(next) && !__tmIsWhiteboardDrawingEnabled()) return;
        if (__tmIsWhiteboardDrawingTool(next) && __tmIsWhiteboardDrawingLayerHidden()) return;
        if (next === 'sticky' && typeof window.tmRequireFullFeature === 'function' && !window.tmRequireFullFeature('whiteboard-sticky', '白板便签工具')) return;
        if (next === 'frame' && !__tmRequireWhiteboardFrameFeature()) return;
        if (__tmIsWhiteboardDrawingTool(next) && !__tmRequireWhiteboardDrawingFeature()) return;
        const currentEditorKind = String(state.whiteboardNoteEditor?.kind || '').trim();
        if (next !== 'text' || currentEditorKind === 'sticky') {
            try { await __tmCloseWhiteboardNoteEditor({ save: true }); } catch (e) {}
        }
        __tmClearWhiteboardMultiSelection();
        if (next !== 'select' && next !== 'pan') __tmClearWhiteboardStrokeSelection();
        SettingsStore.data.whiteboardTool = next;
        try { await SettingsStore.save(); } catch (e) {}
        render();
    };

    window.tmWhiteboardToggleShowDone = async function(enabled) {
        if (typeof window.tmToggleShowCompletedTasks === 'function') {
            return window.tmToggleShowCompletedTasks(!!enabled);
        }
        try { __tmSetShowCompletedTasksInSettings(!!enabled, SettingsStore.data); } catch (e) {
            SettingsStore.data.showCompletedTasks = !!enabled;
            SettingsStore.data.excludeCompletedTasks = !SettingsStore.data.showCompletedTasks;
        }
        state.showCompletedTasks = !!SettingsStore.data.showCompletedTasks;
        state.excludeCompletedTasks = !state.showCompletedTasks;
        try { await SettingsStore.save(); } catch (e) {}
        try { applyFilters(); } catch (e) {}
        render();
    };

    window.tmWhiteboardMoveBackToParent = async function(taskId, docId, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const id = String(taskId || '').trim();
        if (!id) return;
        const pid = __tmResolveWhiteboardTaskParentId(id);
        if (!pid) return;
        const eventEl = ev?.currentTarget instanceof HTMLElement ? ev.currentTarget : null;
        const cardEl = (eventEl?.closest?.('.tm-whiteboard-node') instanceof HTMLElement)
            ? eventEl.closest('.tm-whiteboard-node')
            : state.modal?.querySelector?.(`.tm-whiteboard-node[data-task-id="${CSS.escape(id)}"]`);
        __tmPushWhiteboardHistorySnapshot('move-back-to-parent');
        if (__tmIsWhiteboardGlobalElement(cardEl)) {
            const groupId = __tmGetWhiteboardGlobalBoardGroupId();
            const board = __tmGetWhiteboardGlobalBoardState(groupId);
            const nodePos = (board?.nodePos && typeof board.nodePos === 'object') ? { ...board.nodePos } : {};
            const placedTaskIds = (board?.placedTaskIds && typeof board.placedTaskIds === 'object') ? { ...board.placedTaskIds } : {};
            const detachedChildren = (board?.detachedChildren && typeof board.detachedChildren === 'object') ? { ...board.detachedChildren } : {};
            delete nodePos[id];
            delete placedTaskIds[id];
            delete detachedChildren[id];
            __tmPatchWhiteboardGlobalBoardState(groupId, { nodePos, placedTaskIds, detachedChildren }, { keepEmpty: true });
        } else {
            __tmSetWhiteboardChildDetached(id, false);
            __tmSetWhiteboardTaskPlaced(id, false, { persist: false });
        }
        __tmRemoveWhiteboardFrameMemberIds({ taskIds: [id] }, { persist: false });
        try { await SettingsStore.save(); } catch (e) {}
        render();
    };

    function __tmEnsureWhiteboardTaskSelected(taskId) {
        const id = String(taskId || '').trim();
        if (!id) return;
        if (String(state.whiteboardSelectedTaskId || '').trim() === id) return;
        __tmClearWhiteboardMultiSelection();
        state.whiteboardSelectedTaskId = id;
        state.whiteboardSelectedNoteId = '';
        state.whiteboardSelectedLinkId = '';
        state.whiteboardSelectedLinkDocId = '';
        __tmApplyWhiteboardCardSelectionDom(id);
        __tmScheduleWhiteboardEdgeRedraw();
    }

    function __tmCanEditWhiteboardTaskField(taskId) {
        const id = String(taskId || '').trim();
        if (!id) return false;
        if (state.viewMode !== 'whiteboard') return false;
        if (String(state.whiteboardSelectedTaskId || '').trim() !== id) return false;
        const t = state.flatTasks?.[id];
        if (!t) return false;
        return true;
    }

    window.tmWhiteboardEditStatus = function(taskId, el, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        __tmEnsureWhiteboardTaskSelected(taskId);
        if (!__tmCanEditWhiteboardTaskField(taskId)) return;
        try { window.tmKanbanOpenStatusSelect?.(String(taskId || '').trim(), el, ev); } catch (e) {}
    };

    window.tmWhiteboardEditPriority = function(taskId, el, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        __tmEnsureWhiteboardTaskSelected(taskId);
        if (!__tmCanEditWhiteboardTaskField(taskId)) return;
        try { window.tmPickPriority?.(String(taskId || '').trim(), el, ev); } catch (e) {}
    };

    window.tmWhiteboardEditDate = function(taskId, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        __tmEnsureWhiteboardTaskSelected(taskId);
        if (!__tmCanEditWhiteboardTaskField(taskId)) return;
        try { window.tmKanbanPickDate?.(String(taskId || '').trim(), ev); } catch (e) {}
    };

    window.tmWhiteboardToggleAutoConnect = async function(enabled) {
        SettingsStore.data.whiteboardAutoConnectByCreated = false;
        try { await SettingsStore.save(); } catch (e) {}
        hint('ℹ 已移除默认时间连线功能', 'info');
    };

    window.tmWhiteboardToggleAutoLayout = async function(enabled) {
        SettingsStore.data.whiteboardAutoLayout = false;
        try { await SettingsStore.save(); } catch (e) {}
        hint('ℹ 已移除自动排布功能', 'info');
    };

    window.tmWhiteboardClearLinks = async function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        state.whiteboardBottomMoreOpen = false;
        const ok = confirm('确认清空所有手动连线？');
        if (!ok) {
            render();
            return;
        }
        if (typeof __tmIsWhiteboardGlobalCanvasActive === 'function'
            && __tmIsWhiteboardGlobalCanvasActive()
            && typeof __tmSetWhiteboardGlobalTaskLinks === 'function') {
            if (!__tmGetWhiteboardGlobalTaskLinks().length) {
                render();
                return;
            }
            __tmPushWhiteboardHistorySnapshot('clear-links');
            __tmSetWhiteboardGlobalTaskLinks([], '', { keepEmpty: true });
        } else {
            if (!__tmGetManualTaskLinks().length) {
                render();
                return;
            }
            __tmPushWhiteboardHistorySnapshot('clear-links');
            __tmSetManualTaskLinks([]);
        }
        state.whiteboardSelectedLinkId = '';
        state.whiteboardSelectedLinkDocId = '';
        state.whiteboardMultiSelectedLinkKeys = [];
        __tmApplyWhiteboardMultiSelectionDom();
        __tmRenderWhiteboardMultiTools(__tmComputeWhiteboardMultiSelectionRect());
        try { await SettingsStore.save(); } catch (e) {}
        render();
    };

    window.tmWhiteboardDetachChild = async function(taskId, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const id = String(taskId || '').trim();
        if (!id) return;
        const task = state.flatTasks?.[id];
        if (!task) return;
        const pid = String(task?.parentTaskId || '').trim();
        if (!pid) return;
        const docA = __tmGetTaskDocIdById(id);
        const docB = __tmGetTaskDocIdById(pid);
        if (!docA || !docB || docA !== docB) return;
        __tmPushWhiteboardHistorySnapshot('detach-card');
        __tmSetWhiteboardChildDetached(id, true, pid);
        try { await SettingsStore.save(); } catch (e) {}
        render();
    };

    window.tmWhiteboardReattachChild = async function(taskId, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const id = String(taskId || '').trim();
        if (!id) return;
        __tmPushWhiteboardHistorySnapshot('reattach-card');
        __tmSetWhiteboardChildDetached(id, false);
        try { await SettingsStore.save(); } catch (e) {}
        render();
    };

    window.tmWhiteboardCardDragStart = function(ev, taskId, docId) {
        const id = String(taskId || '').trim();
        const did = String(docId || '').trim();
        if (!id || !did) return;
        try {
            const payload = JSON.stringify({ type: 'tm-whiteboard-task', taskId: id, docId: did });
            ev.dataTransfer.effectAllowed = 'move';
            ev.dataTransfer.setData('application/x-tm-whiteboard-task', payload);
            ev.dataTransfer.setData('text/plain', payload);
        } catch (e) {}
    };

    window.tmWhiteboardLaneDragOver = function(ev) {
        try { ev?.preventDefault?.(); } catch (e) {}
    };

    window.tmWhiteboardLaneDrop = async function(ev, docId) {
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        let payload = null;
        try {
            const raw = ev?.dataTransfer?.getData?.('application/x-tm-whiteboard-task') || ev?.dataTransfer?.getData?.('text/plain');
            if (raw) payload = JSON.parse(raw);
        } catch (e) {}
        if (String(payload?.type || '').trim() !== 'tm-whiteboard-task') return;
        const taskId = String(payload?.taskId || '').trim();
        const fromDocId = String(payload?.docId || '').trim();
        const toDocId = String(docId || '').trim();
        if (!taskId || !fromDocId || !toDocId || fromDocId !== toDocId) return;
        const task = state.flatTasks?.[taskId];
        const pid = String(task?.parentTaskId || '').trim();
        if (!task || !pid) return;
        if (__tmGetTaskDocIdById(pid) !== toDocId) return;
        __tmPushWhiteboardHistorySnapshot('detach-card');
        __tmSetWhiteboardChildDetached(taskId, true, pid);
        try { await SettingsStore.save(); } catch (e) {}
        render();
    };

    window.tmWhiteboardLaneClick = async function(ev, docId) {
        return window.tmWhiteboardDocClick(ev, docId);
    };

    window.tmWhiteboardRemoveNote = async function(noteId, ev) {
        return window.tmWhiteboardDeleteNote(noteId, ev);
    };

    window.tmWhiteboardToggleTaskCollapse = function(taskId, ev) {
        try {
            ev?.stopPropagation?.();
            ev?.preventDefault?.();
        } catch (e) {}
        const id = String(taskId || '').trim();
        if (!id) return;
        const s = __tmKanbanGetCollapsedSet();
        if (s.has(id)) s.delete(id);
        else s.add(id);
        __tmKanbanPersistCollapsed();
        render();
    };
