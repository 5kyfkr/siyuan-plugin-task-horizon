    function __tmBuildExternalTaskDragPayload(taskId, payload = null) {
        const id = String(taskId || payload?.taskId || payload?.id || '').trim();
        if (!id) return null;
        if (payload && typeof payload === 'object') {
            return {
                ...payload,
                taskId: id,
                id,
            };
        }
        try { return __tmBuildDockPointerTaskDragPayload(id, null); } catch (e) {}
        return {
            taskId: id,
            id,
            title: id,
            durationMin: 60,
            calendarId: 'default',
            startDate: '',
            completionTime: '',
        };
    }

    function __tmBuildExternalTaskDragTransfer(payload) {
        try {
            const transfer = __tmBuildDockPointerTaskSyntheticTransfer(payload);
            if (transfer) return transfer;
        } catch (e) {}
        const safePayload = (payload && typeof payload === 'object') ? payload : {};
        const taskId = String(safePayload.taskId || safePayload.id || '').trim();
        return {
            dropEffect: 'move',
            effectAllowed: 'move',
            getData(type) {
                const key = String(type || '').trim();
                if (key === 'application/x-tm-task-id' || key === 'text/plain') return taskId;
                return '';
            },
            setData() {},
            setDragImage() {},
        };
    }

    function __tmNormalizeExternalTaskDragContext(options = {}) {
        const opt = (options && typeof options === 'object') ? options : {};
        const payload = __tmBuildExternalTaskDragPayload(opt.taskId, opt.payload);
        const taskId = String(payload?.taskId || payload?.id || opt.taskId || '').trim();
        if (!taskId) return null;
        let target = opt.target instanceof Element ? opt.target : null;
        const clientX = Number(opt.clientX);
        const clientY = Number(opt.clientY);
        if (!target && Number.isFinite(clientX) && Number.isFinite(clientY)) {
            try {
                const hit = document.elementFromPoint(clientX, clientY);
                target = hit instanceof Element ? hit : null;
            } catch (e) {
                target = null;
            }
        }
        if (!(target instanceof Element)) return null;
        return {
            taskId,
            payload,
            target,
            clientX,
            clientY,
            dataTransfer: opt.dataTransfer || __tmBuildExternalTaskDragTransfer(payload),
        };
    }

    function __tmMakeExternalTaskDragEvent(ctx, currentTarget) {
        return {
            preventDefault() {},
            stopPropagation() {},
            clientX: ctx.clientX,
            clientY: ctx.clientY,
            dataTransfer: ctx.dataTransfer,
            target: ctx.target,
            currentTarget,
        };
    }

    function __tmResolveExternalTaskRowDropElement(target) {
        const el = target instanceof Element ? target : null;
        if (!(el instanceof Element)) return null;
        const row = el.closest([
            '.tm-checklist-item[data-id]',
            '.tm-cal-task[data-task-id]',
            '.tm-cal-task[data-id]',
            '#tmTaskTable tbody tr[data-id]',
            '#tmTimelineLeftTable tbody tr[data-id]',
            '.tm-task-drop-gap[data-target-task-id]',
        ].join(','));
        return row instanceof HTMLElement ? row : null;
    }

    function __tmReadExternalTaskRowDrop(row, target) {
        const el = row instanceof HTMLElement ? row : null;
        if (!(el instanceof HTMLElement)) return { targetId: '', overrideKind: '' };
        return {
            targetId: String(
                el.getAttribute('data-id')
                || el.getAttribute('data-task-id')
                || el.getAttribute('data-target-task-id')
                || ''
            ).trim(),
            overrideKind: String(
                el.getAttribute('data-drop-kind')
                || target?.closest?.('[data-drop-kind]')?.getAttribute?.('data-drop-kind')
                || ''
            ).trim(),
        };
    }

    function __tmResolveExternalTaskDropTarget(target) {
        const el = target instanceof Element ? target : null;
        if (!(el instanceof Element)) return null;

        const docTabEl = el.closest('.tm-doc-tab') || null;
        if (docTabEl instanceof Element) {
            return {
                type: 'doc-tab',
                el: docTabEl,
                docId: String(docTabEl.getAttribute('data-tm-doc-id') || '').trim(),
            };
        }

        const docHeadingGroupEl = __tmResolveDocHeadingGroupDropElementFromTarget(el);
        if (docHeadingGroupEl instanceof HTMLElement) {
            return { type: 'doc-heading-group', el: docHeadingGroupEl };
        }

        const timeGroupEl = __tmResolveTimeGroupDropElementFromTarget(el);
        if (timeGroupEl instanceof HTMLElement) {
            return {
                type: 'time-group',
                el: timeGroupEl,
                groupKey: String(timeGroupEl.getAttribute('data-group-key') || '').trim(),
            };
        }

        const taskRowEl = __tmResolveExternalTaskRowDropElement(el);
        if (taskRowEl instanceof HTMLElement) {
            const rowTarget = __tmReadExternalTaskRowDrop(taskRowEl, el);
            return {
                type: 'task-row',
                el: taskRowEl,
                targetId: rowTarget.targetId,
                overrideKind: rowTarget.overrideKind,
            };
        }

        const kanbanGroupEl = el.closest('.tm-kanban-group-title, .tm-kanban-group') || null;
        if (kanbanGroupEl instanceof Element) {
            return { type: 'kanban-group', el: kanbanGroupEl };
        }

        const kanbanDropEl = el.closest('[data-tm-kb-drop-kind], .tm-kanban-col') || null;
        if (kanbanDropEl instanceof Element) {
            return { type: 'kanban', el: kanbanDropEl };
        }

        return null;
    }

    function __tmBuildExternalTaskDropDedupeKey(ctx, hit) {
        const type = String(hit?.type || '').trim();
        const el = hit?.el instanceof Element ? hit.el : null;
        const targetKey = [
            hit?.targetId,
            hit?.docId,
            hit?.groupKey,
            el?.getAttribute?.('data-tm-kb-drop-kind'),
            el?.getAttribute?.('data-tm-kb-drop-doc'),
            el?.getAttribute?.('data-tm-kb-drop-heading'),
            el?.getAttribute?.('data-status'),
            el?.getAttribute?.('data-time'),
            el?.getAttribute?.('data-col-key'),
        ].map((item) => String(item || '').trim()).filter(Boolean).join(':');
        return `${ctx.taskId}|${type}|${targetKey}|${String(hit?.overrideKind || '').trim()}`;
    }

    window.__tmClearExternalTaskDragIndicators = function(root = null) {
        try { __tmClearDocTabDropTarget(); } catch (e) {}
        try { __tmClearTaskRowDropIndicators(root); } catch (e) {}
        try { __tmKanbanClearDragOver(root); } catch (e) {}
        try {
            document.querySelectorAll?.('.tm-doc-tab.is-drop-target')?.forEach?.((el) => {
                try { el.classList.remove('is-drop-target'); } catch (e) {}
            });
        } catch (e) {}
    };

    window.__tmHandleExternalTaskDragOver = function(options = {}) {
        const ctx = __tmNormalizeExternalTaskDragContext(options);
        if (!ctx) {
            window.__tmClearExternalTaskDragIndicators?.();
            return false;
        }
        const hit = __tmResolveExternalTaskDropTarget(ctx.target);
        if (!hit?.el) {
            window.__tmClearExternalTaskDragIndicators?.();
            return false;
        }
        window.__tmClearExternalTaskDragIndicators?.();
        const ev = __tmMakeExternalTaskDragEvent(ctx, hit.el);
        try {
            if (hit.type === 'doc-tab') {
                window.tmDocTabDragOver?.(ev);
                return true;
            }
            if (hit.type === 'doc-heading-group') {
                window.tmDocHeadingGroupDragOver?.(ev);
                return true;
            }
            if (hit.type === 'time-group') {
                window.tmTimeGroupDragOver?.(ev, hit.groupKey);
                return true;
            }
            if (hit.type === 'task-row') {
                window.tmTaskRowDragOver?.(ev, hit.targetId, hit.overrideKind);
                return true;
            }
            if (hit.type === 'kanban-group') {
                window.tmKanbanGroupDragOver?.(ev);
                return true;
            }
            if (hit.type === 'kanban') {
                window.tmKanbanDragOver?.(ev);
                try { window.__tmKanbanAutoScrollByPoint?.(ctx.clientX, ctx.clientY, ctx.target); } catch (e) {}
                return true;
            }
        } catch (e) {}
        return false;
    };

    window.__tmHandleExternalTaskDrop = async function(options = {}) {
        const ctx = __tmNormalizeExternalTaskDragContext(options);
        if (!ctx) return false;
        const hit = __tmResolveExternalTaskDropTarget(ctx.target);
        if (!hit?.el) return false;
        const dedupeMs = Math.max(0, Number(options?.dedupeMs) || 0) || 700;
        const dedupeKey = __tmBuildExternalTaskDropDedupeKey(ctx, hit);
        const lastDrop = state.__tmExternalTaskDragLastDrop || null;
        const now = Date.now();
        if (lastDrop?.key === dedupeKey && (now - Number(lastDrop.at || 0)) < dedupeMs) {
            return false;
        }
        state.__tmExternalTaskDragLastDrop = { key: dedupeKey, at: now };

        const ev = __tmMakeExternalTaskDragEvent(ctx, hit.el);
        if (hit.type === 'doc-tab') {
            await window.tmDocTabDrop?.(ev, hit.docId);
            return true;
        }
        if (hit.type === 'doc-heading-group') {
            await window.tmDocHeadingGroupDrop?.(ev);
            return true;
        }
        if (hit.type === 'time-group') {
            await window.tmTimeGroupDrop?.(ev, hit.groupKey);
            return true;
        }
        if (hit.type === 'task-row') {
            await window.tmTaskRowDrop?.(ev, hit.targetId, hit.overrideKind);
            return true;
        }
        if (hit.type === 'kanban-group') {
            const result = window.tmKanbanGroupDrop?.(ev);
            if (result && typeof result.then === 'function') await result;
            return true;
        }
        if (hit.type === 'kanban') {
            const result = window.tmKanbanDrop?.(ev);
            if (result && typeof result.then === 'function') await result;
            return true;
        }
        return false;
    };
