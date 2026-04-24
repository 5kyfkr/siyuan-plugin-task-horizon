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
                try {
                    requestAnimationFrame(() => {
                        __tmNormalizeWhiteboardAllViewFrames();
                        __tmRenderWhiteboardEdges();
                    });
                } catch (e) {}
            });
        } catch (e) {
            __tmNormalizeWhiteboardAllViewFrames();
            __tmRenderWhiteboardEdges();
        }
    }

    function __tmScheduleWhiteboardViewSave() {
        try { if (__tmWhiteboardViewSaveTimer) clearTimeout(__tmWhiteboardViewSaveTimer); } catch (e) {}
        __tmWhiteboardViewSaveTimer = setTimeout(() => {
            __tmWhiteboardViewSaveTimer = null;
            try { SettingsStore.save(); } catch (e) {}
        }, 180);
    }

    function __tmApplyWhiteboardTransform() {
        if (state.viewMode !== 'whiteboard') return;
        const world = state.modal?.querySelector?.('#tmWhiteboardWorld');
        if (!(world instanceof HTMLElement)) return;
        const view = __tmGetWhiteboardView();
        world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
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
        };
        const onDocDrop = () => {
            __tmStopWhiteboardPoolGlobalTracking();
        };
        const onDocDragEnd = () => {
            __tmStopWhiteboardPoolGlobalTracking();
        };
        state.whiteboardPoolGlobalTracker = { onDocDragOver, onDocDrop, onDocDragEnd };
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

    window.tmWhiteboardResetView = function() {
        if (__tmFitWhiteboardToVisibleCards()) return;
        __tmSetWhiteboardView({ x: 64, y: 40, zoom: 1 }, { persist: false });
        __tmApplyWhiteboardTransform();
        __tmScheduleWhiteboardViewSave();
    };

    function __tmRemoveWhiteboardMultiTools() {
        const viewport = state.modal?.querySelector?.('#tmWhiteboardViewport');
        if (!(viewport instanceof HTMLElement)) return;
        try { viewport.querySelectorAll('#tmWhiteboardMultiTools').forEach((el) => el.remove()); } catch (e) {}
    }

    function __tmApplyWhiteboardMultiSelectionDom() {
        const body = state.modal?.querySelector?.('#tmWhiteboardBody');
        if (!(body instanceof Element)) return;
        const taskSet = new Set((Array.isArray(state.whiteboardMultiSelectedTaskIds) ? state.whiteboardMultiSelectedTaskIds : []).map((x) => String(x || '').trim()).filter(Boolean));
        const noteSet = new Set((Array.isArray(state.whiteboardMultiSelectedNoteIds) ? state.whiteboardMultiSelectedNoteIds : []).map((x) => String(x || '').trim()).filter(Boolean));
        const linkSet = new Set((Array.isArray(state.whiteboardMultiSelectedLinkKeys) ? state.whiteboardMultiSelectedLinkKeys : []).map((x) => String(x || '').trim()).filter(Boolean));
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
    }

    function __tmComputeWhiteboardMultiSelectionRect() {
        const viewport = state.modal?.querySelector?.('#tmWhiteboardViewport');
        const body = state.modal?.querySelector?.('#tmWhiteboardBody');
        if (!(viewport instanceof HTMLElement) || !(body instanceof Element)) return null;
        const vr = viewport.getBoundingClientRect();
        const idsTask = Array.isArray(state.whiteboardMultiSelectedTaskIds) ? state.whiteboardMultiSelectedTaskIds : [];
        const idsNote = Array.isArray(state.whiteboardMultiSelectedNoteIds) ? state.whiteboardMultiSelectedNoteIds : [];
        const idsLink = Array.isArray(state.whiteboardMultiSelectedLinkKeys) ? state.whiteboardMultiSelectedLinkKeys : [];
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
        const total = taskCount + noteCount + linkCount;
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

    function __tmBuildWhiteboardTouchPanSession(viewport, touchLike) {
        const t = touchLike || {};
        const v = __tmGetWhiteboardView();
        return {
            mode: 'pan',
            viewport,
            startClientX: Number(t.clientX) || 0,
            startClientY: Number(t.clientY) || 0,
            startX: Number(v.x) || 0,
            startY: Number(v.y) || 0,
        };
    }

    function __tmBuildWhiteboardTouchPinchSession(viewport, touchA, touchB) {
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
        };
    }

    window.tmWhiteboardViewportTouchStart = function(ev) {
        if (state.viewMode !== 'whiteboard') return;
        const tool = String(SettingsStore.data.whiteboardTool || 'pan').trim();
        if (tool !== 'pan') return;
        const viewport = state.modal?.querySelector?.('#tmWhiteboardViewport');
        if (!(viewport instanceof HTMLElement)) return;
        const target = ev?.target;
        if (target && target.closest && target.closest('.tm-whiteboard-sidebar,.tm-whiteboard-bottom-toolbar,.tm-btn,input,button,select,textarea,label,a,.tm-whiteboard-doc-resize,.tm-task-link-dot,.tm-task-content-clickable,.tm-task-checkbox,.tm-kanban-chip,.tm-status-tag,.tm-priority-jira,.tm-kanban-priority-chip,.tm-whiteboard-card-tools,.tm-whiteboard-note-tools,.tm-whiteboard-link-tools,.tm-whiteboard-edge')) return;
        const touches = ev?.touches;
        const n = Number(touches?.length) || 0;
        if (n <= 0) return;
        if (n >= 2) {
            state.whiteboardTouchSession = __tmBuildWhiteboardTouchPinchSession(viewport, touches[0], touches[1]);
        } else {
            state.whiteboardTouchSession = __tmBuildWhiteboardTouchPanSession(viewport, touches[0]);
        }
        try { viewport.classList.add('tm-whiteboard-viewport--panning'); } catch (e) {}
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
                state.whiteboardTouchSession = __tmBuildWhiteboardTouchPinchSession(viewport, touches[0], touches[1]);
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
            __tmSetWhiteboardView({ x: nextX, y: nextY, zoom: nextZoom }, { persist: false });
            __tmApplyWhiteboardTransform();
            return;
        }
        const t = touches[0];
        if (s.mode !== 'pan') {
            state.whiteboardTouchSession = __tmBuildWhiteboardTouchPanSession(viewport, t);
            return;
        }
        const dx = (Number(t?.clientX) || 0) - (Number(s.startClientX) || 0);
        const dy = (Number(t?.clientY) || 0) - (Number(s.startClientY) || 0);
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
            try { viewport?.classList?.remove?.('tm-whiteboard-viewport--panning'); } catch (e) {}
            __tmScheduleWhiteboardViewSave();
            return;
        }
        if (!(viewport instanceof HTMLElement)) {
            state.whiteboardTouchSession = null;
            __tmScheduleWhiteboardViewSave();
            return;
        }
        if (n >= 2) {
            state.whiteboardTouchSession = __tmBuildWhiteboardTouchPinchSession(viewport, touches[0], touches[1]);
            return;
        }
        state.whiteboardTouchSession = __tmBuildWhiteboardTouchPanSession(viewport, touches[0]);
    };

    window.tmWhiteboardViewportMouseDown = function(ev) {
        if (state.viewMode !== 'whiteboard') return;
        const pType = String(ev?.pointerType || '').toLowerCase();
        if (pType === 'touch') return;
        if (Number(ev?.button) !== 0) return;
        const tool = String(SettingsStore.data.whiteboardTool || 'pan').trim();
        const panMode = tool === 'pan';
        const selectMode = tool === 'select';
        const target = ev?.target;
        const viewport = state.modal?.querySelector?.('#tmWhiteboardViewport');
        if (!(viewport instanceof HTMLElement)) return;
        if (target && target.closest) {
            if (panMode) {
                if (target.closest('.tm-whiteboard-sidebar,.tm-whiteboard-bottom-toolbar,.tm-btn,input,button,select,textarea,label,a,.tm-whiteboard-doc-resize,.tm-task-link-dot,.tm-task-content-clickable,.tm-task-checkbox,.tm-kanban-chip,.tm-status-tag,.tm-priority-jira,.tm-kanban-priority-chip,.tm-whiteboard-card-tools,.tm-whiteboard-note-tools,.tm-whiteboard-link-tools,.tm-whiteboard-edge,.tm-whiteboard-node,.tm-whiteboard-note,.tm-whiteboard-note-editor,.tm-whiteboard-doc-head')) return;
            } else if (selectMode) {
                if (target.closest('.tm-whiteboard-node,.tm-task-link-dot,.tm-task-checkbox,.tm-btn,.tm-task-content-clickable,.tm-whiteboard-note,.tm-whiteboard-note-editor,.tm-whiteboard-edge,.tm-whiteboard-link-tools,.tm-whiteboard-pool-item,.tm-whiteboard-doc-resize,.tm-whiteboard-doc-head,input,button,select,textarea,label,a')) return;
            } else {
                return;
            }
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
                }
                state.whiteboardMultiSelectedTaskIds = Array.from(new Set(taskIds));
                state.whiteboardMultiSelectedNoteIds = Array.from(new Set(noteIds));
                state.whiteboardMultiSelectedLinkKeys = Array.from(new Set(linkKeys));
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
                        || (Array.isArray(state.whiteboardMultiSelectedLinkKeys) && state.whiteboardMultiSelectedLinkKeys.length)) {
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

        if (!panMode) return;
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
        };
        try { viewport.classList.add('tm-whiteboard-viewport--panning'); } catch (e) {}
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
            try { viewport.classList.remove('tm-whiteboard-viewport--panning'); } catch (e) {}
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

    window.tmWhiteboardCardMouseDown = function(ev, taskId, docId) {
        if (state.viewMode !== 'whiteboard') return;
        const tool = String(SettingsStore.data.whiteboardTool || 'pan').trim();
        if (tool !== 'pan' && tool !== 'select') return;
        if (Number(ev?.button) !== 0) return;
        const id = String(taskId || '').trim();
        const did = String(docId || '').trim();
        if (!id || !did) return;
        const target = ev?.target;
        const multiTaskIds0 = Array.isArray(state.whiteboardMultiSelectedTaskIds)
            ? state.whiteboardMultiSelectedTaskIds.map((x) => String(x || '').trim()).filter(Boolean)
            : [];
        const multiNoteIds0 = Array.isArray(state.whiteboardMultiSelectedNoteIds)
            ? state.whiteboardMultiSelectedNoteIds.map((x) => String(x || '').trim()).filter(Boolean)
            : [];
        const inMulti = multiTaskIds0.includes(id);
        const multiCount = multiTaskIds0.length + multiNoteIds0.length;
        const hitContent = !!(target && target.closest && target.closest('.tm-task-content-clickable,.tm-kanban-chip,.tm-status-tag,.tm-priority-jira,.tm-kanban-priority-chip'));
        if (target && target.closest && target.closest('.tm-task-link-dot,.tm-task-checkbox,.tm-btn,input,button,select,textarea,label,a')) return;
        if (hitContent && !(multiCount > 1 && inMulti)) return;
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
                return { kind: 'task', id: tid, did: tdid, el: cardEl, x0, y0 };
            }).filter(Boolean);
            const noteItems = uniqNoteIds.map((nid) => {
                const noteEl = state.modal?.querySelector?.(`.tm-whiteboard-note[data-note-id="${CSS.escape(nid)}"]`);
                if (!(noteEl instanceof HTMLElement)) return null;
                const x0 = Number((noteEl.style.left || '').replace('px', '')) || 0;
                const y0 = Number((noteEl.style.top || '').replace('px', '')) || 0;
                const ndid = String(noteEl.getAttribute('data-doc-id') || '').trim();
                if (!ndid) return null;
                return { kind: 'note', id: nid, did: ndid, el: noteEl, x0, y0 };
            }).filter(Boolean);
            groupDragItems = taskItems.concat(noteItems);
        }
        const useGroupDrag = groupDragItems.length > 1;
        if (!useGroupDrag) {
            __tmClearWhiteboardMultiSelection();
            state.whiteboardSelectedTaskId = id;
            state.whiteboardSelectedNoteId = '';
            __tmApplyWhiteboardCardSelectionDom(id);
        } else {
            state.whiteboardSelectedTaskId = '';
            state.whiteboardSelectedNoteId = '';
            __tmApplyWhiteboardCardSelectionDom('');
            __tmApplyWhiteboardMultiSelectionDom();
        }
        const card = ev?.currentTarget instanceof HTMLElement ? ev.currentTarget : (target?.closest?.('.tm-whiteboard-node') || null);
        if (!(card instanceof HTMLElement)) return;
        const isSubNode = card.classList.contains('tm-whiteboard-node--sub');
        const startX = Number(card.dataset?.x);
        const startY = Number(card.dataset?.y);
        const x0 = isSubNode ? 0 : (Number.isFinite(startX) ? startX : Number(card.style.left.replace('px', '')) || 0);
        const y0 = isSubNode ? 0 : (Number.isFinite(startY) ? startY : Number(card.style.top.replace('px', '')) || 0);
        const zoom = __tmGetWhiteboardView().zoom || 1;
        const sx = Number(ev?.clientX) || 0;
        const sy = Number(ev?.clientY) || 0;
        state.whiteboardNodeDrag = { id, did, x0, y0, sx, sy, card, isSubNode, detached: false, group: useGroupDrag ? groupDragItems : null };
        const onMove = (e2) => {
            const d = state.whiteboardNodeDrag;
            if (!d) return;
            if (Array.isArray(d.group) && d.group.length > 1) {
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
                        __tmSetWhiteboardNodePos(g.id, g.did, nx, ny, { persist: false, manual: true });
                        __tmSetWhiteboardTaskPlaced(g.id, true, { persist: false });
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
                __tmSetWhiteboardChildDetached(d.id, true, dParentId);
                __tmSetWhiteboardTaskPlaced(d.id, true, { persist: false });
                __tmSetWhiteboardNodePos(d.id, d.did, nx0, ny0, { persist: false, manual: true });
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
                    };
                }
                return;
            }
            const dx = ((Number(e2?.clientX) || 0) - d.sx) / (zoom || 1);
            const dy = ((Number(e2?.clientY) || 0) - d.sy) / (zoom || 1);
            const nx = Math.round(d.x0 + dx);
            const ny = Math.round(d.y0 + dy);
            d.card.style.left = `${nx}px`;
            d.card.style.top = `${ny}px`;
            d.card.dataset.x = String(nx);
            d.card.dataset.y = String(ny);
            __tmSetWhiteboardNodePos(d.id, d.did, nx, ny, { persist: false, manual: true });
            __tmSetWhiteboardTaskPlaced(d.id, true, { persist: false });
            __tmScheduleWhiteboardEdgeRedraw();
        };
        const onUp = (eUp) => {
            try { document.removeEventListener('mousemove', onMove, true); } catch (e) {}
            try { document.removeEventListener('mouseup', onUp, true); } catch (e) {}
            const d = state.whiteboardNodeDrag;
            state.whiteboardNodeDrag = null;
            if (d && Array.isArray(d.group) && d.group.length > 1) {
                const notes = Array.isArray(SettingsStore.data.whiteboardNotes) ? [...SettingsStore.data.whiteboardNotes] : [];
                const allView = !(state.activeDocId && state.activeDocId !== 'all');
                d.group.forEach((g) => {
                    if (!g || g.kind !== 'note' || !(g.el instanceof HTMLElement)) return;
                    const nx = Number((g.el.style.left || '').replace('px', '')) || Number(g.x0 || 0);
                    const ny = Number((g.el.style.top || '').replace('px', '')) || Number(g.y0 || 0);
                    const idx = notes.findIndex((n) => String(n?.id || '').trim() === String(g.id || '').trim());
                    if (idx < 0) return;
                    const offX = allView ? (Number(g.el.parentElement?.dataset?.frameOffsetX) || 0) : 0;
                    const offY = allView ? (Number(g.el.parentElement?.dataset?.frameOffsetY) || 0) : 0;
                    notes[idx] = { ...(notes[idx] || {}), docId: g.did, x: Math.round(nx - offX), y: Math.round(ny - offY) };
                });
                SettingsStore.data.whiteboardNotes = notes;
                try { SettingsStore.syncToLocal(); } catch (e) {}
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
                        __tmSetWhiteboardChildDetached(d.id, false);
                        __tmSetWhiteboardTaskPlaced(d.id, true, { persist: false });
                        try { SettingsStore.save(); } catch (e) {}
                        render();
                        return;
                    }
                }
            }
            try { SettingsStore.save(); } catch (e) {}
        };
        try { document.addEventListener('mousemove', onMove, true); } catch (e) {}
        try { document.addEventListener('mouseup', onUp, true); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
    };

    window.tmWhiteboardSelectTask = function(taskId, ev) {
        if (state.viewMode !== 'whiteboard') return;
        const tool = String(SettingsStore.data.whiteboardTool || 'pan').trim();
        if (tool !== 'pan' && tool !== 'select') return;
        const id = String(taskId || '').trim();
        if (!id) return;
        try { ev?.stopPropagation?.(); } catch (e) {}
        if (tool === 'select') {
            state.whiteboardSelectedTaskId = '';
            state.whiteboardSelectedNoteId = '';
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
        const ids = __tmWhiteboardCollectTaskTreeIds(id, { includeRoot: true, includeDetached: false, includeSnapshotTree: true });
        ids.forEach((tid) => __tmSetWhiteboardTaskPlaced(tid, false, { persist: false }));
        const snapshotIds = ids.filter((tid) => {
            const k = String(tid || '').trim();
            if (!k) return false;
            if (state.flatTasks?.[k]) return false;
            return !!__tmGetWhiteboardCardSnapshot(k);
        });
        __tmDeleteWhiteboardSnapshotTasks(snapshotIds);
        const idSet = new Set(ids.map((x) => String(x || '').trim()).filter(Boolean));
        const links = __tmGetManualTaskLinks().filter((x) => {
            const from = String(x?.from || '').trim();
            const to = String(x?.to || '').trim();
            return !idSet.has(from) && !idSet.has(to);
        });
        __tmSetManualTaskLinks(links);
        if (idSet.has(String(state.whiteboardSelectedTaskId || '').trim())) state.whiteboardSelectedTaskId = '';
        try { await SettingsStore.save(); } catch (e) {}
        render();
    };

    window.tmWhiteboardSelectNote = function(noteId, ev) {
        if (state.viewMode !== 'whiteboard') return;
        const tool = String(SettingsStore.data.whiteboardTool || 'pan');
        if (tool !== 'pan' && tool !== 'text' && tool !== 'select') return;
        if (state.whiteboardNoteEditor) return;
        try { ev?.stopPropagation?.(); } catch (e) {}
        const id = String(noteId || '').trim();
        if (!id) return;
        if (String(state.whiteboardSelectedNoteId || '').trim() === id) return;
        __tmClearWhiteboardMultiSelection();
        state.whiteboardSelectedNoteId = id;
        state.whiteboardSelectedTaskId = '';
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

    function __tmNormalizeWhiteboardNoteBold(v) {
        return !!v;
    }

    async function __tmUpdateWhiteboardNoteStyle(noteId, patch = {}) {
        const id = String(noteId || '').trim();
        if (!id) return false;
        const notes = Array.isArray(SettingsStore.data.whiteboardNotes) ? [...SettingsStore.data.whiteboardNotes] : [];
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
        if (Object.prototype.hasOwnProperty.call(patch, 'bold')) {
            next.bold = __tmNormalizeWhiteboardNoteBold(patch.bold);
        }
        notes[idx] = next;
        SettingsStore.data.whiteboardNotes = notes;
        try { SettingsStore.syncToLocal(); } catch (e) {}
        try { await SettingsStore.save(); } catch (e) {}
        return true;
    }

    window.tmWhiteboardAdjustNoteFontSize = async function(noteId, delta, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const id = String(noteId || '').trim();
        if (!id) return;
        const notes = Array.isArray(SettingsStore.data.whiteboardNotes) ? SettingsStore.data.whiteboardNotes : [];
        const note = notes.find((n) => String(n?.id || '').trim() === id);
        const cur = __tmNormalizeWhiteboardNoteFontSize(note?.fontSize);
        const d = Number(delta);
        const next = __tmNormalizeWhiteboardNoteFontSize(cur + (Number.isFinite(d) ? d : 0));
        const ok = await __tmUpdateWhiteboardNoteStyle(id, { fontSize: next });
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
        const notes = Array.isArray(SettingsStore.data.whiteboardNotes) ? SettingsStore.data.whiteboardNotes : [];
        const note = notes.find((n) => String(n?.id || '').trim() === id);
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
        const notes = Array.isArray(SettingsStore.data.whiteboardNotes) ? SettingsStore.data.whiteboardNotes : [];
        SettingsStore.data.whiteboardNotes = notes.filter((n) => String(n?.id || '').trim() !== id);
        if (String(state.whiteboardSelectedNoteId || '').trim() === id) state.whiteboardSelectedNoteId = '';
        try { SettingsStore.syncToLocal(); } catch (e) {}
        try { await SettingsStore.save(); } catch (e) {}
        render();
    };

    window.tmWhiteboardDeleteMultiSelected = async function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const taskIds = Array.from(new Set((Array.isArray(state.whiteboardMultiSelectedTaskIds) ? state.whiteboardMultiSelectedTaskIds : []).map((x) => String(x || '').trim()).filter(Boolean)));
        const noteIds = Array.from(new Set((Array.isArray(state.whiteboardMultiSelectedNoteIds) ? state.whiteboardMultiSelectedNoteIds : []).map((x) => String(x || '').trim()).filter(Boolean)));
        const linkKeys = Array.from(new Set((Array.isArray(state.whiteboardMultiSelectedLinkKeys) ? state.whiteboardMultiSelectedLinkKeys : []).map((x) => String(x || '').trim()).filter(Boolean)));
        if (!taskIds.length && !noteIds.length && !linkKeys.length) return;
        const allTaskIds = new Set();
        taskIds.forEach((id) => {
            __tmWhiteboardCollectTaskTreeIds(id, { includeRoot: true, includeDetached: false, includeSnapshotTree: true })
                .forEach((tid) => allTaskIds.add(String(tid || '').trim()));
        });
        allTaskIds.forEach((tid) => {
            if (!tid) return;
            __tmSetWhiteboardTaskPlaced(tid, false, { persist: false });
        });
        const snapshotIds = Array.from(allTaskIds).filter((tid) => {
            const k = String(tid || '').trim();
            if (!k) return false;
            if (state.flatTasks?.[k]) return false;
            return !!__tmGetWhiteboardCardSnapshot(k);
        });
        __tmDeleteWhiteboardSnapshotTasks(snapshotIds);
        if (allTaskIds.size) {
            const links = __tmGetManualTaskLinks().filter((x) => {
                const from = String(x?.from || '').trim();
                const to = String(x?.to || '').trim();
                return !allTaskIds.has(from) && !allTaskIds.has(to);
            });
            __tmSetManualTaskLinks(links);
        }
        if (linkKeys.length) {
            const selectedSet = new Set(linkKeys);
            const links = __tmGetManualTaskLinks().filter((x) => {
                const key = `${String(x?.docId || '').trim()}::${String(x?.id || '').trim()}`;
                return !selectedSet.has(key);
            });
            __tmSetManualTaskLinks(links);
        }
        if (noteIds.length) {
            const noteSet = new Set(noteIds);
            const notes = Array.isArray(SettingsStore.data.whiteboardNotes) ? SettingsStore.data.whiteboardNotes : [];
            SettingsStore.data.whiteboardNotes = notes.filter((n) => !noteSet.has(String(n?.id || '').trim()));
        }
        state.whiteboardSelectedTaskId = '';
        state.whiteboardSelectedNoteId = '';
        state.whiteboardSelectedLinkId = '';
        state.whiteboardSelectedLinkDocId = '';
        state.whiteboardMultiSelectedLinkKeys = [];
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
        if (String(SettingsStore.data.whiteboardTool || 'pan') !== 'pan') return;
        const id = String(noteId || '').trim();
        const did = String(docId || '').trim();
        if (!id || !did) return;
        const notes = Array.isArray(SettingsStore.data.whiteboardNotes) ? SettingsStore.data.whiteboardNotes : [];
        const note = notes.find((n) => String(n?.id || '').trim() === id);
        if (!note) return;
        const noteEl = (ev?.currentTarget instanceof HTMLElement)
            ? ev.currentTarget
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
        const offX = allView ? (Number(docBody.dataset?.frameOffsetX) || 0) : 0;
        const offY = allView ? (Number(docBody.dataset?.frameOffsetY) || 0) : 0;
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
        if (tool !== 'pan' && tool !== 'text' && tool !== 'select') return;
        if (Number(ev?.button) !== 0) return;
        if (state.whiteboardNoteEditor) return;
        // 双击用于编辑，不应进入拖拽流程，否则 mouseup-render 会把编辑框顶掉
        if (Number(ev?.detail) >= 2) return;
        const target = ev?.target;
        if (target && target.closest && target.closest('.tm-whiteboard-note-resize,.tm-whiteboard-note-width-resize')) return;
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
                return { kind: 'task', id: tid, did: tdid, el: cardEl, x0: tx0, y0: ty0 };
            }).filter(Boolean);
            const noteItems = uniqNoteIds.map((nid) => {
                const nEl = state.modal?.querySelector?.(`.tm-whiteboard-note[data-note-id="${CSS.escape(nid)}"]`);
                if (!(nEl instanceof HTMLElement)) return null;
                const nx0 = Number((nEl.style.left || '').replace('px', '')) || 0;
                const ny0 = Number((nEl.style.top || '').replace('px', '')) || 0;
                const ndid = String(nEl.getAttribute('data-doc-id') || '').trim();
                if (!ndid) return null;
                return { kind: 'note', id: nid, did: ndid, el: nEl, x0: nx0, y0: ny0 };
            }).filter(Boolean);
            groupDragItems = taskItems.concat(noteItems);
        }
        const useGroupDrag = groupDragItems.length > 1;
        if (!useGroupDrag) {
            __tmClearWhiteboardMultiSelection();
            state.whiteboardSelectedNoteId = id;
            state.whiteboardSelectedTaskId = '';
            __tmApplyWhiteboardCardSelectionDom('');
            state.whiteboardSelectedLinkId = '';
            state.whiteboardSelectedLinkDocId = '';
        } else {
            state.whiteboardSelectedTaskId = '';
            state.whiteboardSelectedNoteId = '';
            state.whiteboardSelectedLinkId = '';
            state.whiteboardSelectedLinkDocId = '';
            __tmApplyWhiteboardCardSelectionDom('');
            __tmApplyWhiteboardMultiSelectionDom();
            __tmRenderWhiteboardMultiTools(__tmComputeWhiteboardMultiSelectionRect());
        }
        state.whiteboardNoteDrag = { id, did, x0, y0, sx, sy, noteEl, moved: false, group: useGroupDrag ? groupDragItems : null };
        const onMove = (e2) => {
            const d = state.whiteboardNoteDrag;
            if (!d) return;
            const dx = ((Number(e2?.clientX) || 0) - d.sx) / (zoom || 1);
            const dy = ((Number(e2?.clientY) || 0) - d.sy) / (zoom || 1);
            if (!d.moved) {
                if (Math.abs(dx) + Math.abs(dy) < 3) return;
                d.moved = true;
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
                        __tmSetWhiteboardNodePos(g.id, g.did, nx, ny, { persist: false, manual: true });
                        __tmSetWhiteboardTaskPlaced(g.id, true, { persist: false });
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
                const notes = Array.isArray(SettingsStore.data.whiteboardNotes) ? [...SettingsStore.data.whiteboardNotes] : [];
                const allView = !(state.activeDocId && state.activeDocId !== 'all');
                d.group.forEach((g) => {
                    if (!g || g.kind !== 'note' || !(g.el instanceof HTMLElement)) return;
                    const nx = Number((g.el.style.left || '').replace('px', '')) || Number(g.x0 || 0);
                    const ny = Number((g.el.style.top || '').replace('px', '')) || Number(g.y0 || 0);
                    const idx = notes.findIndex((n) => String(n?.id || '').trim() === String(g.id || '').trim());
                    if (idx < 0) return;
                    const offX = allView ? (Number(g.el.parentElement?.dataset?.frameOffsetX) || 0) : 0;
                    const offY = allView ? (Number(g.el.parentElement?.dataset?.frameOffsetY) || 0) : 0;
                    notes[idx] = { ...(notes[idx] || {}), docId: g.did, x: Math.round(nx - offX), y: Math.round(ny - offY) };
                });
                SettingsStore.data.whiteboardNotes = notes;
                try { SettingsStore.syncToLocal(); } catch (e) {}
                try { await SettingsStore.save(); } catch (e) {}
                render();
                return;
            }
            const nx = Number(d.noteEl.style.left.replace('px', '')) || d.x0;
            const ny = Number(d.noteEl.style.top.replace('px', '')) || d.y0;
            const notes = Array.isArray(SettingsStore.data.whiteboardNotes) ? [...SettingsStore.data.whiteboardNotes] : [];
            const idx = notes.findIndex((n) => String(n?.id || '').trim() === d.id);
            if (idx >= 0) {
                const allView = !(state.activeDocId && state.activeDocId !== 'all');
                const offX = allView ? (Number(d.noteEl.parentElement?.dataset?.frameOffsetX) || 0) : 0;
                const offY = allView ? (Number(d.noteEl.parentElement?.dataset?.frameOffsetY) || 0) : 0;
                notes[idx] = { ...(notes[idx] || {}), docId: d.did, x: Math.round(nx - offX), y: Math.round(ny - offY) };
                SettingsStore.data.whiteboardNotes = notes;
                try { SettingsStore.syncToLocal(); } catch (e) {}
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
        const notes = Array.isArray(SettingsStore.data.whiteboardNotes) ? SettingsStore.data.whiteboardNotes : [];
        const note = notes.find((n) => String(n?.id || '').trim() === id);
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
        noteEl.style.whiteSpace = 'pre-wrap';
        noteEl.style.overflowWrap = 'anywhere';
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

    async function __tmCloseWhiteboardNoteEditor(opts = {}) {
        const o = (opts && typeof opts === 'object') ? opts : {};
        const st = state.whiteboardNoteEditor;
        state.whiteboardNoteEditor = null;
        if (!st || typeof st !== 'object') return;
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
        const sx = Math.round(x - (allView ? ox : 0));
        const sy = Math.round(y - (allView ? oy : 0));
        const notes0 = Array.isArray(SettingsStore.data.whiteboardNotes) ? [...SettingsStore.data.whiteboardNotes] : [];
        if (noteId) {
            const idx = notes0.findIndex((n) => String(n?.id || '').trim() === noteId);
            if (idx < 0 || !value) return;
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
            SettingsStore.data.whiteboardNotes = notes0;
            try { SettingsStore.syncToLocal(); } catch (e) {}
            try { await SettingsStore.save(); } catch (e) {}
            render();
            return;
        }
        if (!value) return;
        const notes = Array.isArray(SettingsStore.data.whiteboardNotes) ? [...SettingsStore.data.whiteboardNotes] : [];
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
        SettingsStore.data.whiteboardNotes = notes;
        try { SettingsStore.syncToLocal(); } catch (e) {}
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
        input.style.fontSize = `${fs0}px`;
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
        };
    }

    window.tmWhiteboardDocClick = async function(ev, docId) {
        const allView = !(state.activeDocId && state.activeDocId !== 'all');
        if (allView) return;
        if (String(SettingsStore.data.whiteboardTool || 'pan') !== 'text') return;
        const target = ev?.target;
        if (target && target.closest && target.closest('.tm-whiteboard-node,.tm-task-link-dot,.tm-task-checkbox,.tm-btn,.tm-task-content-clickable,.tm-whiteboard-note,.tm-whiteboard-note-editor')) return;
        const did = String(docId || '').trim();
        if (!did) return;
        const docBody = target?.closest?.('.tm-whiteboard-doc-body[data-doc-id]')
            || state.modal?.querySelector?.(`.tm-whiteboard-doc-body[data-doc-id="${CSS.escape(did)}"]`);
        if (!(docBody instanceof HTMLElement)) return;
        const p = __tmResolveWhiteboardPointerInfo(ev, did);
        const localX = Number.isFinite(Number(p?.localX)) ? Number(p.localX) : 24;
        const localY = Number.isFinite(Number(p?.localY)) ? Number(p.localY) : 24;
        __tmOpenWhiteboardNoteEditor(docBody, did, localX, localY);
    };

    window.tmWhiteboardBoardClick = async function(ev) {
        if (Number(state.whiteboardSuppressClickUntil || 0) > Date.now()) return;
        const target = ev?.target;
        if (target && target.closest && target.closest('.tm-whiteboard-node,.tm-task-link-dot,.tm-task-checkbox,.tm-btn,.tm-task-content-clickable,.tm-whiteboard-note,.tm-whiteboard-note-editor,.tm-whiteboard-edge,.tm-whiteboard-doc-resize,.tm-whiteboard-link-tools,.tm-whiteboard-multi-tools')) return;
        if (state.whiteboardNoteEditor && String(SettingsStore.data.whiteboardTool || 'pan') === 'text') {
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
        if ((Array.isArray(state.whiteboardMultiSelectedTaskIds) && state.whiteboardMultiSelectedTaskIds.length)
            || (Array.isArray(state.whiteboardMultiSelectedNoteIds) && state.whiteboardMultiSelectedNoteIds.length)) {
            __tmClearWhiteboardMultiSelection();
            changed = true;
        }
        if (String(state.whiteboardSelectedTaskId || '').trim()) {
            state.whiteboardSelectedTaskId = '';
            __tmApplyWhiteboardCardSelectionDom('');
            changed = true;
            if (String(SettingsStore.data.whiteboardTool || 'pan') !== 'text') {
                render();
                return;
            }
        } else if (String(SettingsStore.data.whiteboardTool || 'pan') !== 'text') {
            if (changed) render();
            return;
        }
        const docBody = target?.closest?.('.tm-whiteboard-doc-body[data-doc-id]');
        if (docBody instanceof Element) {
            const docId = String(docBody.getAttribute('data-doc-id') || '').trim();
            if (docId) return window.tmWhiteboardDocClick(ev, docId);
        }
        const selectedDoc = (state.activeDocId && state.activeDocId !== 'all') ? String(state.activeDocId) : '';
        const firstDoc = selectedDoc || String((SettingsStore.data.selectedDocIds || [])[0] || '').trim();
        if (!firstDoc) return;
        return window.tmWhiteboardDocClick(ev, firstDoc);
    };

    window.tmWhiteboardBoardDblClick = async function(ev) {
        const allView = !(state.activeDocId && state.activeDocId !== 'all');
        if (allView) return;
        const target = ev?.target;
        if (target && target.closest && target.closest('.tm-whiteboard-node,.tm-task-link-dot,.tm-task-checkbox,.tm-btn,.tm-task-content-clickable,.tm-whiteboard-note,.tm-whiteboard-note-editor,.tm-whiteboard-edge,.tm-whiteboard-doc-resize,.tm-whiteboard-link-tools,.tm-whiteboard-multi-tools,input,button,select,textarea,label,a')) return;
        const did = String(state.activeDocId || '').trim();
        if (!did || did === 'all') return;
        const point = __tmResolveWhiteboardPointerInfo(ev, did);
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
            const createdTaskId = await __tmCreateTaskInDoc({
                docId: did,
                content: newContent,
                atTop: true,
            });
            if (!createdTaskId) throw new Error('任务创建失败');
            __tmSetWhiteboardTaskPlaced(createdTaskId, true, { persist: false });
            __tmSetWhiteboardNodePos(createdTaskId, did, localX, localY, { manual: true, persist: false });
            try { SettingsStore.syncToLocal(); } catch (e) {}
            try { await SettingsStore.save(); } catch (e) {}
            state.whiteboardSelectedTaskId = createdTaskId;
            __tmApplyWhiteboardCardSelectionDom(createdTaskId);
            applyFilters();
            render();
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
        const node = useSelf ? item : (item.parentElement instanceof HTMLElement ? item.parentElement : item);
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
                const src = pool?.querySelector?.(`.tm-whiteboard-pool-item[data-task-id="${CSS.escape(tid)}"]`);
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
                const src = pool?.querySelector?.(`.tm-whiteboard-pool-item[data-task-id="${CSS.escape(tid)}"]`);
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

    window.tmWhiteboardPoolItemMouseDown = function(ev, taskId, docId, locked) {
        if (Number(ev?.button) !== 0) return;
        const target = ev?.target;
        if (target && target.closest && target.closest('.tm-task-checkbox,.tm-task-content-clickable,.tm-whiteboard-pool-toggle,.tm-btn,input,button,select,textarea,label,a')) return;
        const id = String(taskId || '').trim();
        if (!id) return;
        const isLocked = !!locked;
        if (isLocked) return;
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
        render();
    };

    window.tmWhiteboardPoolH2DragStart = function(ev, docId, h2Label) {
        const did = String(docId || '').trim();
        const h2 = String(h2Label || '').trim();
        const el = ev?.currentTarget instanceof HTMLElement ? ev.currentTarget : null;
        if (!did || !h2 || !(el instanceof HTMLElement)) return;
        const rawIds = String(el.getAttribute('data-task-ids') || '').trim();
        let taskIds = rawIds ? rawIds.split(',').map((x) => String(x || '').trim()).filter(Boolean) : [];
        if (!taskIds.length) return;
        const canDrag = (tid) => {
            const node = state.modal?.querySelector?.(`.tm-whiteboard-pool-item[data-task-id="${CSS.escape(String(tid || '').trim())}"]`);
            if (!(node instanceof HTMLElement)) return false;
            return String(node.getAttribute('draggable') || '').toLowerCase() !== 'false';
        };
        taskIds = taskIds.filter((tid) => canDrag(tid));
        if (!taskIds.length) return;
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
            ev.dataTransfer.setData('application/x-tm-task-id', taskIds[0]);
            ev.dataTransfer.setData('application/x-tm-whiteboard-pool', payload);
            ev.dataTransfer.setData('text/plain', payload);
            __tmCleanupWhiteboardPoolDragGhost();
            const dragGhost = __tmBuildWhiteboardPoolH2DragGhost(el, taskIds) || __tmBuildWhiteboardPoolDragGhostFromDom(el, { useSelf: true });
            if (dragGhost instanceof HTMLElement) {
                try { ev.dataTransfer.setDragImage(dragGhost, 12, 12); } catch (e) {}
            }
        } catch (e) {}
        try {
            const meta = (typeof window.tmCalendarGetTaskDragMeta === 'function')
                ? window.tmCalendarGetTaskDragMeta(taskIds[0])
                : null;
            __tmCalendarFloatingDragStart(taskIds[0], meta, ev);
        } catch (e) {}
        __tmStartWhiteboardPoolGlobalTracking(String(state.activeDocId && state.activeDocId !== 'all' ? state.activeDocId : ''));
    };

    window.tmWhiteboardPoolDragStart = function(ev, taskId, docId) {
        const id = String(taskId || '').trim();
        const did = String(docId || '').trim();
        if (!id || !did) return;
        const selected0 = Array.isArray(state.whiteboardPoolSelectedTaskIds) ? state.whiteboardPoolSelectedTaskIds : [];
        const selectedSet = new Set(selected0.map((x) => String(x || '').trim()).filter(Boolean));
        let dragTaskIds = selectedSet.has(id) ? Array.from(selectedSet) : [id];
        if (!dragTaskIds.length) dragTaskIds = [id];
        const canDrag = (tid) => {
            const el = state.modal?.querySelector?.(`.tm-whiteboard-pool-item[data-task-id="${CSS.escape(String(tid || '').trim())}"]`);
            if (!(el instanceof HTMLElement)) return false;
            return String(el.getAttribute('draggable') || '').toLowerCase() !== 'false';
        };
        dragTaskIds = dragTaskIds.filter((tid) => canDrag(tid));
        if (!dragTaskIds.includes(id)) dragTaskIds.unshift(id);
        dragTaskIds = Array.from(new Set(dragTaskIds));
        if (!dragTaskIds.length) dragTaskIds = [id];
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
            ev.dataTransfer.setData('application/x-tm-task-id', dragTaskIds[0] || id);
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
        try {
            const meta = (typeof window.tmCalendarGetTaskDragMeta === 'function')
                ? window.tmCalendarGetTaskDragMeta(dragTaskIds[0] || id)
                : null;
            __tmCalendarFloatingDragStart(dragTaskIds[0] || id, meta, ev);
        } catch (e) {}
        __tmStartWhiteboardPoolGlobalTracking(String(state.activeDocId && state.activeDocId !== 'all' ? state.activeDocId : ''));
    };

    window.tmWhiteboardPoolDrag = function(ev, docIdHint) {
        __tmTrackWhiteboardPointerFromClient(ev?.clientX, ev?.clientY, String(docIdHint || state.activeDocId || ''));
    };

    window.tmWhiteboardPoolDragEnd = function() {
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
        const info = __tmResolveWhiteboardPointerInfo(ev, String(state.activeDocId && state.activeDocId !== 'all' ? state.activeDocId : ''))
            || __tmTrackWhiteboardPointerFromClient(ev?.clientX, ev?.clientY, String(state.activeDocId && state.activeDocId !== 'all' ? state.activeDocId : ''));
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
        try {
            const raw = ev?.dataTransfer?.getData?.('application/x-tm-whiteboard-pool') || ev?.dataTransfer?.getData?.('text/plain');
            if (raw) payload = JSON.parse(raw);
        } catch (e) {}
        const payloadType = String(payload?.type || '').trim();
        if (payloadType !== 'tm-whiteboard-pool' && payloadType !== 'tm-whiteboard-pool-h2') return;
        const taskIds = Array.isArray(payload?.taskIds)
            ? payload.taskIds.map((x) => String(x || '').trim()).filter(Boolean)
            : [String(payload?.taskId || '').trim()].filter(Boolean);
        if (!taskIds.length) return;
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
        if (!docId) return;
        const globalCollectDocId = String(SettingsStore.data.newTaskDocId || '').trim();
        const viewport = state.modal?.querySelector?.('#tmWhiteboardViewport');
        const docBody = state.modal?.querySelector?.(`.tm-whiteboard-doc-body[data-doc-id="${CSS.escape(docId)}"]`);
        if (!(viewport instanceof HTMLElement) || !(docBody instanceof HTMLElement)) return;
        // 使用固定锚点，避免卡片尺寸变化（父子结构展开）影响落点体感。
        const anchorX = 18;
        const anchorY = 16;
        const local = __tmResolveWhiteboardDropLocalPoint(ev, docId);
        const docRect = docBody.getBoundingClientRect();
        const zoom = Math.max(0.01, Number(__tmGetWhiteboardView()?.zoom) || 1);
        const fallbackX = (docRect.width > 0 ? (docRect.width * 0.5) : 220) / zoom;
        const fallbackY = (docRect.height > 0 ? (docRect.height * 0.5) : 140) / zoom;
        const nx0 = Math.round((Number(local?.x) || fallbackX) - anchorX);
        const ny = Math.round((Number(local?.y) || fallbackY) - anchorY);
        const stepX = 320;
        let movedAcrossDoc = false;
        const placed = [];
        for (let i = 0; i < taskIdsSorted.length; i++) {
            const taskId = String(taskIdsSorted[i] || '').trim();
            if (!taskId) continue;
            const taskDocFromPayload = String(payload?.taskDocIds?.[taskId] || '').trim();
            const payloadDocId = String(payload?.docId || '').trim();
            const cardDoc = taskDocFromPayload || String(__tmGetTaskDocIdById(taskId) || '').trim() || payloadDocId;
            if (!cardDoc) continue;
            const cardDocName = String((state.allDocuments || []).find(d => String(d?.id || '').trim() === cardDoc)?.name || '').trim();
            const sourceIsInbox = /inbox/i.test(cardDocName) || /收件箱|收集箱|收件/.test(cardDocName);
            const sourceIsGlobalCollect = !!globalCollectDocId && cardDoc === globalCollectDocId;
            if (cardDoc !== docId && !sourceIsInbox && !sourceIsGlobalCollect) continue;
            if (cardDoc !== docId) {
                try {
                    movedAcrossDoc = await __tmMoveTaskToDoc(taskId, docId, { silentHint: true }) || movedAcrossDoc;
                } catch (e) {
                    continue;
                }
            }
            try {
                __tmWhiteboardCollectTaskTreeIds(taskId, { includeRoot: false, includeDetached: true, includeSnapshotTree: true })
                    .forEach((cid) => {
                        __tmSetWhiteboardChildDetached(cid, false);
                        __tmSetWhiteboardTaskPlaced(cid, false, { persist: false });
                    });
            } catch (e) {}
            const nx = nx0 + (i * stepX);
            __tmSetWhiteboardNodePos(taskId, docId, nx, ny, { persist: false, manual: true });
            __tmSetWhiteboardTaskPlaced(taskId, true, { persist: false });
            try {
                const t = state.flatTasks?.[taskId];
                if (t) __tmUpsertWhiteboardTaskSnapshot(t, { persist: true });
            } catch (e) {}
            placed.push(taskId);
        }
        if (!placed.length) return;
        if (h2Title) {
            const notes = Array.isArray(SettingsStore.data.whiteboardNotes) ? [...SettingsStore.data.whiteboardNotes] : [];
            notes.push({
                id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                docId,
                text: h2Title,
                x: nx0,
                y: Math.max(0, ny - 75),
                fontSize: 30,
                bold: true,
                color: '',
                createdAt: String(Date.now()),
            });
            SettingsStore.data.whiteboardNotes = notes;
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
        if (movedAcrossDoc) {
            try { await loadSelectedDocuments(); } catch (e) { render(); }
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
            const svg = docBody.querySelector('.tm-whiteboard-edges');
            if (!(svg instanceof SVGElement)) return;
            const width = Math.max(Math.ceil(docBody.scrollWidth), Math.ceil(docBody.clientWidth), 1);
            const height = Math.max(Math.ceil(docBody.scrollHeight), Math.ceil(docBody.clientHeight), 1);
            try { svg.setAttribute('width', String(width)); } catch (e) {}
            try { svg.setAttribute('height', String(height)); } catch (e) {}
            try { svg.setAttribute('viewBox', `0 0 ${width} ${height}`); } catch (e) {}

            const links = __tmGetAllTaskLinks({ docId, includeAuto: false });
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
                const from = getPt(link.from, 'from');
                const to = getPt(link.to, 'to');
                if (!from || !to) return '';
                const fromProxy = __tmFindWhiteboardCollapsedProxyTaskId(link.from, docId);
                const toProxy = __tmFindWhiteboardCollapsedProxyTaskId(link.to, docId);
                const routed = buildAvoidPath(
                    from,
                    to,
                    [link.from, link.to, fromProxy, toProxy],
                    { fromTaskId: link.from, toTaskId: link.to, fromProxyTaskId: fromProxy, toProxyTaskId: toProxy }
                );
                const d = routed.d;
                const isSelected = link.manual
                    && selectedLinkId
                    && selectedLinkDocId === docId
                    && String(link.id || '').trim() === selectedLinkId;
                const linkKey = `${docId}::${String(link.id || '').trim()}`;
                const cls = link.manual
                    ? `tm-whiteboard-edge tm-whiteboard-edge--manual${isSelected ? ' tm-whiteboard-edge--selected' : ''}${multiSelectedLinkSet.has(linkKey) ? ' tm-whiteboard-multi-selected' : ''}`
                    : 'tm-whiteboard-edge tm-whiteboard-edge--auto';
                const idEsc = String(link.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                const docEsc = String(docId || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                const click = link.manual ? `onclick="tmWhiteboardSelectLink('${idEsc}', '${docEsc}', event)"` : '';
                if (isSelected) {
                    const pts = Array.isArray(routed.pts) && routed.pts.length >= 2 ? routed.pts : [from, to];
                    const mp = pathMidPoint(pts) || { x: (from.x + to.x) * 0.5, y: (from.y + to.y) * 0.5 };
                    const mx = mp.x;
                    const my = mp.y;
                    selectedToolPos = { x: mx, y: my };
                }
                const dataAttrs = link.manual ? ` data-link-id="${esc(String(link.id || ''))}" data-doc-id="${esc(String(docId || ''))}"` : '';
                return `<path class="${cls}" d="${d}" marker-end="url(#${esc(markerIdOut)})"${dataAttrs} ${click}></path>`;
            }).join('');
            let previewPath = '';
            const fromTaskId = String(state.whiteboardLinkFromTaskId || '').trim();
            const fromDocId = String(state.whiteboardLinkFromDocId || '').trim();
            const preview = state.whiteboardLinkPreview && typeof state.whiteboardLinkPreview === 'object' ? state.whiteboardLinkPreview : null;
            if (fromTaskId && fromDocId === docId && preview) {
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
                        const fromProxy = __tmFindWhiteboardCollapsedProxyTaskId(fromTaskId, docId);
                        const targetTaskId = String(preview.targetTaskId || '').trim();
                        const toProxy = targetTaskId ? __tmFindWhiteboardCollapsedProxyTaskId(targetTaskId, docId) : '';
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
            if (selectedToolPos && selectedLinkId && selectedLinkDocId === docId) {
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

    function __tmResetLinkDragState() {
        state.whiteboardLinkFromTaskId = '';
        state.whiteboardLinkFromDocId = '';
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
            clientX: Number(ev?.clientX) || 0,
            clientY: Number(ev?.clientY) || 0,
            targetTaskId: tId,
            targetDocId: tDocId || fromDocId,
        };
    }

    function __tmUpdateTimelineLinkHover(taskId) {
        const id = String(taskId || '').trim();
        state.timelineLinkHoverTaskId = id;
        const body = state.modal?.querySelector?.('#tmGanttBody');
        if (!(body instanceof HTMLElement)) return;
        try {
            body.querySelectorAll('.tm-gantt-row--link-hover').forEach((el) => el.classList.remove('tm-gantt-row--link-hover'));
        } catch (e) {}
        if (!id) return;
        try {
            const row = body.querySelector(`.tm-gantt-row[data-id="${CSS.escape(id)}"]`);
            if (row instanceof HTMLElement) row.classList.add('tm-gantt-row--link-hover');
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

    function __tmStartTaskLinkPointerFallback(ev, taskId, docId) {
        __tmClearTaskLinkPointerFallback();
        const fromTaskId = String(taskId || '').trim();
        const fromDocId = String(docId || '').trim();
        if (!fromTaskId || !fromDocId) return;
        const pointerIdRaw = Number(ev?.pointerId);
        const pointerId = Number.isFinite(pointerIdRaw) ? pointerIdRaw : null;
        const sx = Number(ev?.clientX) || 0;
        const sy = Number(ev?.clientY) || 0;
        const session = {
            pointerId,
            fromTaskId,
            fromDocId,
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
            if (!Number.isFinite(Number(session.pointerId))) return true;
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

    window.tmTaskLinkDotPressStart = function(ev, taskId, docId) {
        state.whiteboardLinkPress = {
            taskId: String(taskId || '').trim(),
            docId: String(docId || '').trim(),
            at: Date.now(),
        };
        const id = String(taskId || '').trim();
        const did = String(docId || '').trim();
        if (!id || !did) return;
        state.whiteboardLinkFromTaskId = id;
        state.whiteboardLinkFromDocId = did;
        __tmUpdateWhiteboardLinkHover('', '');
        __tmUpdateWhiteboardLinkPreviewFromEvent(ev, '', did);
        __tmScheduleWhiteboardEdgeRedraw();
        __tmStartTaskLinkPointerFallback(ev, id, did);
    };

    window.tmTaskLinkDotDragStart = function(ev, taskId, docId) {
        try { ev?.stopPropagation?.(); } catch (e) {}
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
        __tmUpdateWhiteboardLinkHover('', '');
        __tmUpdateWhiteboardLinkPreviewFromEvent(ev, '', did);
        try {
            ev.dataTransfer.effectAllowed = 'link';
            const payload = JSON.stringify({ type: 'tm-task-link', taskId: id, docId: did });
            ev.dataTransfer.setData('application/x-tm-task-link', payload);
            ev.dataTransfer.setData('text/plain', payload);
        } catch (e) {}
        __tmScheduleWhiteboardEdgeRedraw();
    };

    window.tmTaskLinkDotDragOver = function(ev) {
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
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
        __tmClearTaskLinkPointerFallback();
        __tmResetLinkDragState();
        __tmScheduleWhiteboardEdgeRedraw();
    };

    window.tmTaskLinkDotDrop = async function(ev, targetTaskId, targetDocId) {
        try { ev?.preventDefault?.(); } catch (e) {}
        try { ev?.stopPropagation?.(); } catch (e) {}
        const toId = String(targetTaskId || '').trim();
        let fromId = '';
        let fromDocId = '';
        try {
            const raw = ev?.dataTransfer?.getData?.('application/x-tm-task-link') || ev?.dataTransfer?.getData?.('text/plain');
            if (raw) {
                const obj = JSON.parse(raw);
                if (String(obj?.type || '').trim() === 'tm-task-link') {
                    fromId = String(obj?.taskId || '').trim();
                    fromDocId = String(obj?.docId || '').trim();
                }
            }
        } catch (e) {}
        if (!fromId) fromId = String(state.whiteboardLinkFromTaskId || '').trim();
        if (!fromDocId) fromDocId = String(state.whiteboardLinkFromDocId || '').trim();
        const toDocId = String(targetDocId || '').trim() || __tmGetTaskDocIdById(toId);
        if (!fromId || !toId || !fromDocId || !toDocId || fromId === toId) {
            __tmResetLinkDragState();
            __tmScheduleWhiteboardEdgeRedraw();
            return;
        }
        const check = __tmCanLinkTasks(fromId, toId);
        if (!check.ok) {
            hint(`⚠ ${check.reason}`, 'warning');
            __tmResetLinkDragState();
            __tmScheduleWhiteboardEdgeRedraw();
            return;
        }
        const docId = String(check.docId || '').trim();
        const manual = __tmGetManualTaskLinks();
        const exists = manual.some(x => String(x?.from || '') === fromId && String(x?.to || '') === toId && String(x?.docId || '') === docId);
        if (exists) {
            hint('ℹ 该连线已存在', 'info');
            __tmResetLinkDragState();
            __tmScheduleWhiteboardEdgeRedraw();
            return;
        }
        manual.push({
            id: `link_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            from: fromId,
            to: toId,
            docId,
            createdAt: String(Date.now()),
        });
        __tmSetManualTaskLinks(manual);
        try { await SettingsStore.save(); } catch (e) {}
        __tmResetLinkDragState();
        render();
    };

    window.tmWhiteboardRemoveLink = async function(linkId, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const id = String(linkId || '').trim();
        if (!id) return;
        const manual = __tmGetManualTaskLinks().filter(x => String(x?.id || '').trim() !== id);
        __tmSetManualTaskLinks(manual);
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
        const manual = __tmGetManualTaskLinks().filter((x) => String(x?.id || '').trim() !== id);
        __tmSetManualTaskLinks(manual);
        if (String(state.timelineSelectedLinkId || '').trim() === id) state.timelineSelectedLinkId = '';
        try { await SettingsStore.save(); } catch (e) {}
        try { state.__tmTimelineRenderDeps?.(); } catch (e) {}
        render();
    };

    window.tmWhiteboardToggleSidebar = async function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const next = !SettingsStore.data.whiteboardSidebarCollapsed;
        SettingsStore.data.whiteboardSidebarCollapsed = next;
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
        try { await SettingsStore.save(); } catch (e) {}
    };

    window.tmTimelineToggleSidebar = async function(ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const next = !SettingsStore.data.timelineSidebarCollapsed;
        SettingsStore.data.timelineSidebarCollapsed = next;
        render();
        try { await SettingsStore.save(); } catch (e) {}
    };

    window.tmWhiteboardSetTool = async function(tool) {
        const t = String(tool || 'pan').trim();
        const next = (t === 'select' || t === 'text' || t === 'pan') ? t : 'pan';
        if (next !== 'text') {
            try { await __tmCloseWhiteboardNoteEditor({ save: true }); } catch (e) {}
        }
        __tmClearWhiteboardMultiSelection();
        SettingsStore.data.whiteboardTool = next;
        try { await SettingsStore.save(); } catch (e) {}
        render();
    };

    window.tmWhiteboardToggleShowDone = async function(enabled) {
        SettingsStore.data.whiteboardShowDone = !!enabled;
        try { await SettingsStore.save(); } catch (e) {}
        render();
    };

    window.tmWhiteboardMoveBackToParent = async function(taskId, docId, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const id = String(taskId || '').trim();
        if (!id) return;
        const pid = __tmResolveWhiteboardTaskParentId(id);
        if (!pid) return;
        __tmSetWhiteboardChildDetached(id, false);
        __tmSetWhiteboardTaskPlaced(id, false, { persist: false });
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

    window.tmWhiteboardClearLinks = async function() {
        const ok = confirm('确认清空所有手动连线？');
        if (!ok) return;
        __tmSetManualTaskLinks([]);
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
        __tmSetWhiteboardChildDetached(id, true, pid);
        try { await SettingsStore.save(); } catch (e) {}
        render();
    };

    window.tmWhiteboardReattachChild = async function(taskId, ev) {
        try { ev?.stopPropagation?.(); } catch (e) {}
        const id = String(taskId || '').trim();
        if (!id) return;
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


