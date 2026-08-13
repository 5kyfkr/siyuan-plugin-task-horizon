    const __TM_VIEW_RENDER_WINDOW_POLICY = Object.freeze({
        list: Object.freeze({ desktopInitial: 80, mobileInitial: 64, desktopGrow: 40, mobileGrow: 32 }),
        checklist: Object.freeze({ desktopInitial: 120, mobileInitial: 20, desktopGrow: 60, mobileGrow: 20 }),
        timeline: Object.freeze({ desktopInitial: 80, mobileInitial: 64, desktopGrow: 40, mobileGrow: 32 }),
    });
    const __TM_KANBAN_PROGRESSIVE_BATCH_SIZE = 10;

    function __tmUnbindKanbanProgressiveViewport(job) {
        if (!job || typeof job !== 'object') return false;
        try {
            if (job.viewportTimer && typeof clearTimeout === 'function') clearTimeout(job.viewportTimer);
        } catch (e) {}
        job.viewportTimer = 0;
        try {
            if (job.viewportObserver?.disconnect) job.viewportObserver.disconnect();
        } catch (e) {}
        try {
            if (Array.isArray(job.viewportListeners)) {
                job.viewportListeners.forEach(({ target, type, handler }) => {
                    try { target?.removeEventListener?.(type, handler); } catch (e) {}
                });
            }
        } catch (e) {}
        job.viewportObserver = null;
        job.viewportListeners = [];
        job.viewportBound = false;
        job.boundBody = null;
        return true;
    }

    function __tmCancelProgressiveViewRender() {
        const job = state?.__tmProgressiveViewRender;
        try {
            if (job?.viewportTimer && typeof clearTimeout === 'function') clearTimeout(job.viewportTimer);
        } catch (e) {}
        try { __tmUnbindKanbanProgressiveViewport(job); } catch (e) {}
        try { state.__tmProgressiveViewRender = null; } catch (e) {}
        return true;
    }

    function __tmStartProgressiveViewRender(mode = '') {
        __tmCancelProgressiveViewRender();
        const value = String(mode || state?.viewMode || '').trim();
        const tasks = Array.isArray(state?.filteredTasks) ? state.filteredTasks : [];
        if (value !== 'kanban' || tasks.length <= __TM_KANBAN_PROGRESSIVE_BATCH_SIZE) return null;
        const batchSize = __TM_KANBAN_PROGRESSIVE_BATCH_SIZE;
        const sequence = Math.max(0, Math.round(Number(state.__tmProgressiveViewRenderSeq) || 0)) + 1;
        const job = {
            sequence,
            mode: value,
            tasksRef: tasks,
            batchSize,
            // Keep the first render small; later cards stay viewport driven in the same batch size.
            initialBatchSize: __TM_KANBAN_PROGRESSIVE_BATCH_SIZE,
            columns: [],
            viewportTimer: 0,
            viewportObserver: null,
            viewportListeners: [],
            viewportCursor: 0,
            viewportBound: false,
            boundBody: null,
            viewportProbeAttempts: 0,
        };
        state.__tmProgressiveViewRenderSeq = sequence;
        state.__tmProgressiveViewRender = job;
        return job;
    }

    function __tmRegisterKanbanProgressiveColumn(job, column) {
        if (!__tmIsProgressiveViewRenderCurrent(job, 'kanban')) return false;
        if (!column || typeof column.loadNextBatch !== 'function') return false;
        const key = String(column.key || '').trim();
        if (!key) return false;
        if (!Array.isArray(job.columns)) job.columns = [];
        const entry = {
            key,
            loadNextBatch: column.loadNextBatch,
            done: false,
            loading: false,
            loaded: false,
            retryCount: 0,
            retryAt: 0,
        };
        const existingIndex = job.columns.findIndex((item) => String(item?.key || '').trim() === key);
        if (existingIndex >= 0) job.columns[existingIndex] = entry;
        else job.columns.push(entry);
        return true;
    }

    function __tmGetKanbanProgressiveNodeKey(node) {
        if (!(node instanceof Element)) return '';
        if (node.classList.contains('tm-kanban-card')) {
            const taskId = String(node.getAttribute('data-id') || '').trim();
            return taskId ? `task:${taskId}` : '';
        }
        if (node.classList.contains('tm-kanban-group')) {
            const title = Array.from(node.children || [])
                .find((child) => child?.classList?.contains('tm-kanban-group-title'));
            const groupKey = String(title?.getAttribute?.('data-group-key') || '').trim();
            return groupKey ? `group:${groupKey}` : '';
        }
        return '';
    }

    function __tmGetKanbanProgressiveChildContainer(node, kind) {
        if (!(node instanceof Element)) return null;
        if (kind === 'group') {
            return Array.from(node.children || [])
                .find((child) => child?.hasAttribute?.('data-tm-kanban-group-items')) || null;
        }
        if (kind === 'task') {
            return Array.from(node.querySelectorAll?.('[data-tm-kanban-subtasks-list]') || [])
                .find((child) => child?.closest?.('.tm-kanban-card') === node) || null;
        }
        return null;
    }

    function __tmMergeKanbanProgressiveChildren(liveParent, desiredParent, addedNodes) {
        if (!(liveParent instanceof Element) || !(desiredParent instanceof Element)) return false;
        let liveCursor = liveParent.firstElementChild;
        const desiredChildren = Array.from(desiredParent.children || []);
        for (const desiredChild of desiredChildren) {
            const desiredKey = __tmGetKanbanProgressiveNodeKey(desiredChild);
            if (!desiredKey) return false;
            const liveKey = __tmGetKanbanProgressiveNodeKey(liveCursor);
            let liveChild = liveKey === desiredKey ? liveCursor : null;
            if (!liveChild) {
                let laterMatch = null;
                for (let probe = liveCursor; probe; probe = probe.nextElementSibling) {
                    if (__tmGetKanbanProgressiveNodeKey(probe) === desiredKey) {
                        laterMatch = probe;
                        break;
                    }
                }
                if (laterMatch) return false;
                liveChild = desiredChild.cloneNode(true);
                liveParent.insertBefore(liveChild, liveCursor);
                addedNodes.push(liveChild);
            } else {
                const kind = desiredKey.startsWith('group:') ? 'group' : 'task';
                const desiredNested = __tmGetKanbanProgressiveChildContainer(desiredChild, kind);
                const liveNested = __tmGetKanbanProgressiveChildContainer(liveChild, kind);
                if (desiredNested && liveNested) {
                    if (!__tmMergeKanbanProgressiveChildren(liveNested, desiredNested, addedNodes)) return false;
                } else if (!!desiredNested !== !!liveNested) {
                    return false;
                }
            }
            liveCursor = liveChild.nextElementSibling;
        }
        return !liveCursor;
    }

    function __tmCaptureKanbanProgressiveScrollAnchor(body) {
        if (!(body instanceof HTMLElement)) return null;
        const scrollTop = Math.max(0, Number(body.scrollTop) || 0);
        if (scrollTop <= 0) return { scrollTop, anchor: null, anchorTop: 0 };
        let bodyRect = null;
        try { bodyRect = body.getBoundingClientRect(); } catch (e) {}
        if (!bodyRect || !(bodyRect.width > 0 && bodyRect.height > 0)) {
            return { scrollTop, anchor: null, anchorTop: 0 };
        }
        const pointX = bodyRect.left + Math.min(Math.max(12, bodyRect.width * 0.5), Math.max(12, bodyRect.width - 12));
        const pointOffsets = [8, Math.min(48, bodyRect.height * 0.18), bodyRect.height * 0.5];
        let anchor = null;
        for (const offset of pointOffsets) {
            const pointY = Math.min(bodyRect.bottom - 2, bodyRect.top + Math.max(2, offset));
            let stack = [];
            try {
                stack = typeof document.elementsFromPoint === 'function'
                    ? document.elementsFromPoint(pointX, pointY)
                    : [document.elementFromPoint?.(pointX, pointY)].filter(Boolean);
            } catch (e) {}
            for (const item of stack) {
                const candidate = item?.closest?.('.tm-kanban-card[data-id], .tm-kanban-group-title[data-group-key]');
                if (candidate instanceof HTMLElement && body.contains(candidate)) {
                    anchor = candidate;
                    break;
                }
            }
            if (anchor) break;
        }
        let anchorTop = 0;
        if (anchor) {
            try { anchorTop = Number(anchor.getBoundingClientRect().top) || 0; } catch (e) { anchor = null; }
        }
        return { scrollTop, anchor, anchorTop };
    }

    function __tmRestoreKanbanProgressiveScrollAnchor(body, snapshot) {
        if (!(body instanceof HTMLElement) || !snapshot) return false;
        let anchor = snapshot.anchor instanceof HTMLElement ? snapshot.anchor : null;
        if (!(anchor && anchor.isConnected && body.contains(anchor))) anchor = null;
        if (anchor) {
            let nextAnchorTop = Number(snapshot.anchorTop) || 0;
            try { nextAnchorTop = Number(anchor.getBoundingClientRect().top) || 0; } catch (e) {}
            const delta = nextAnchorTop - (Number(snapshot.anchorTop) || 0);
            if (Math.abs(delta) <= 0.5) return true;
            const currentTop = Math.max(0, Number(body.scrollTop) || 0);
            const maxTop = Math.max(0, (Number(body.scrollHeight) || 0) - (Number(body.clientHeight) || 0));
            try { body.scrollTop = Math.min(maxTop, Math.max(0, currentTop + delta)); } catch (e) {}
            return true;
        }
        if ((Number(snapshot.scrollTop) || 0) <= 0) return true;
        const maxTop = Math.max(0, (Number(body.scrollHeight) || 0) - (Number(body.clientHeight) || 0));
        try { body.scrollTop = Math.min(maxTop, Math.max(0, Number(snapshot.scrollTop) || 0)); } catch (e) {}
        return true;
    }

    function __tmPatchKanbanProgressiveColumn(body, desiredHtml) {
        if (!(body instanceof HTMLElement)) return { ok: false, addedNodes: [] };
        const template = document.createElement('template');
        try { template.innerHTML = String(desiredHtml || '').trim(); } catch (e) {
            return { ok: false, addedNodes: [] };
        }
        const desiredRoot = document.createElement('div');
        desiredRoot.appendChild(template.content.cloneNode(true));
        const scrollAnchor = __tmCaptureKanbanProgressiveScrollAnchor(body);
        const placeholders = Array.from(body.children || []).filter((child) => (
            child?.classList?.contains('tm-kanban-deferred')
            || child?.classList?.contains('tm-kanban-empty')
        ));
        placeholders.forEach((placeholder) => placeholder.remove());
        const addedNodes = [];
        if (__tmMergeKanbanProgressiveChildren(body, desiredRoot, addedNodes)) {
            __tmRestoreKanbanProgressiveScrollAnchor(body, scrollAnchor);
            return { ok: true, addedNodes, replaced: false };
        }

        // A concurrent structural projection can invalidate the monotonic prefix. Replacing once
        // from the current render snapshot is safer than guessing an order and is not the normal path.
        const fallback = document.createDocumentFragment();
        Array.from(desiredRoot.children || []).forEach((child) => fallback.appendChild(child));
        try { body.replaceChildren(fallback); } catch (e) {
            return { ok: false, addedNodes: [] };
        }
        __tmRestoreKanbanProgressiveScrollAnchor(body, scrollAnchor);
        return { ok: true, addedNodes: [body], replaced: true };
    }

    try { globalThis.__tmPatchKanbanProgressiveColumn = __tmPatchKanbanProgressiveColumn; } catch (e) {}

    function __tmGetKanbanProgressiveColumnElement(modal, key) {
        const wanted = String(key || '').trim();
        if (!wanted || !(modal instanceof Element)) return null;
        try {
            return Array.from(modal.querySelectorAll('.tm-kanban-col[data-col-key]'))
                .find((column) => String(column?.getAttribute?.('data-col-key') || '').trim() === wanted) || null;
        } catch (e) {
            return null;
        }
    }

    function __tmIsKanbanProgressiveColumnVisible(body, column) {
        if (!(body instanceof HTMLElement) || !(column instanceof HTMLElement)) return false;
        try {
            const bodyRect = body.getBoundingClientRect();
            const columnRect = column.getBoundingClientRect();
            if (!(bodyRect.width > 0 && bodyRect.height > 0 && columnRect.width > 0 && columnRect.height > 0)) return false;
            const margin = Math.max(24, Math.min(columnRect.width, bodyRect.width * 0.35));
            return columnRect.right >= bodyRect.left - margin && columnRect.left <= bodyRect.right + margin;
        } catch (e) {
            return false;
        }
    }

    function __tmIsKanbanProgressiveColumnNearBottom(columnBody) {
        if (!(columnBody instanceof HTMLElement)) return false;
        const viewport = Math.max(0, Number(columnBody.clientHeight) || 0);
        if (!viewport) return true;
        const remaining = Math.max(0, (Number(columnBody.scrollHeight) || 0) - (Number(columnBody.scrollTop) || 0) - viewport);
        return remaining <= Math.max(96, Math.min(280, Math.round(viewport * 0.35)));
    }

    function __tmScheduleKanbanProgressiveViewportCheck(job, delay = 0) {
        if (!__tmIsProgressiveViewRenderCurrent(job, 'kanban')) return false;
        if (job.viewportTimer) return true;
        const run = () => {
            job.viewportTimer = 0;
            if (!__tmIsProgressiveViewRenderCurrent(job, 'kanban')) return;
            const modal = state?.modal instanceof Element ? state.modal : null;
            const body = modal?.querySelector?.('.tm-body.tm-body--kanban');
            if (!(body instanceof HTMLElement)) return;
            const columns = Array.isArray(job.columns) ? job.columns : [];
            if (!columns.length) return;
            if (columns.every((entry) => entry?.done === true)) {
                __tmFinishProgressiveViewRender(job, 'kanban');
                return;
            }
            const candidates = [];
            columns.forEach((entry, index) => {
                if (!entry || entry.done || entry.loading) return;
                if (Number(entry.retryAt || 0) > Date.now()) return;
                const column = __tmGetKanbanProgressiveColumnElement(modal, entry.key);
                const columnBody = column?.querySelector?.(':scope > .tm-kanban-col-body');
                if (!(column instanceof HTMLElement) || !(columnBody instanceof HTMLElement)) return;
                if (column.classList.contains('tm-kanban-col--collapsed') || columnBody.hidden) return;
                if (!__tmIsKanbanProgressiveColumnVisible(body, column)) return;
                const initialLoad = entry.loaded !== true;
                if (!initialLoad && !__tmIsKanbanProgressiveColumnNearBottom(columnBody)) return;
                candidates.push({ entry, columnBody, index, initialLoad });
            });
            if (!candidates.length) {
                // A view switch can run before the new shell has measurable geometry. Retry a
                // bounded number of times so the first visible column is not left as a placeholder.
                // Once the shell is measurable, IntersectionObserver/scroll events take over.
                const pendingInitial = columns.some((entry) => entry && !entry.done && entry.loaded !== true);
                if (pendingInitial) {
                    const attempts = Math.max(0, Math.round(Number(job.viewportProbeAttempts) || 0)) + 1;
                    job.viewportProbeAttempts = attempts;
                    if (attempts <= 24) {
                        __tmScheduleKanbanProgressiveViewportCheck(job, Math.min(120, 24 + attempts * 4));
                    }
                }
                return;
            }
            job.viewportProbeAttempts = 0;
            candidates.sort((a, b) => {
                const ac = (a.index - (Number(job.viewportCursor) || 0) + columns.length) % columns.length;
                const bc = (b.index - (Number(job.viewportCursor) || 0) + columns.length) % columns.length;
                return ac - bc;
            });
            const target = candidates[0];
            job.viewportCursor = (target.index + 1) % columns.length;
            const waitMs = typeof __tmGetHighPriorityInteractionWaitMs === 'function'
                ? __tmGetHighPriorityInteractionWaitMs(24)
                : 0;
            if (waitMs > 0) {
                __tmScheduleKanbanProgressiveViewportCheck(job, Math.min(160, Math.max(32, waitMs)));
                return;
            }
            target.entry.loading = true;
            let result = null;
            try { result = target.entry.loadNextBatch(modal); } catch (e) { result = { done: false, retry: true }; }
            target.entry.loading = false;
            const retry = result?.retry === true;
            let nextDelay = 32;
            if (retry) {
                target.entry.loaded = false;
                target.entry.retryCount = Math.max(0, Math.round(Number(target.entry.retryCount) || 0)) + 1;
                const backoffMs = Math.min(1000, 32 * (2 ** Math.min(5, target.entry.retryCount - 1)));
                target.entry.retryAt = Date.now() + backoffMs;
                nextDelay = Math.max(32, backoffMs);
            } else {
                target.entry.loaded = true;
                target.entry.retryCount = 0;
                target.entry.retryAt = 0;
                if (!result || result.done === true) target.entry.done = true;
            }
            if (!__tmIsProgressiveViewRenderCurrent(job, 'kanban')) return;
            // Give the browser a frame between column patches. This prevents a large completed board
            // from monopolizing the input frame budget while still filling a visible, short column.
            __tmScheduleKanbanProgressiveViewportCheck(job, nextDelay);
        };
        try { job.viewportTimer = setTimeout(run, Math.max(0, Math.round(Number(delay) || 0))); } catch (e) { run(); }
        return true;
    }

    function __tmBindKanbanProgressiveViewport(job) {
        if (!__tmIsProgressiveViewRenderCurrent(job, 'kanban')) return false;
        const modal = state?.modal instanceof Element ? state.modal : null;
        const nextBody = modal?.querySelector?.('.tm-body.tm-body--kanban');
        if (!(modal instanceof Element) || !(nextBody instanceof HTMLElement)) return false;
        if (job.viewportBound === true && job.boundBody === nextBody) {
            __tmScheduleKanbanProgressiveViewportCheck(job, 0);
            return true;
        }
        if (job.viewportBound === true) {
            try { __tmUnbindKanbanProgressiveViewport(job); } catch (e) {}
        }
        job.viewportBound = true;
        job.boundBody = nextBody;
        try {
            if (job.viewportObserver?.disconnect) job.viewportObserver.disconnect();
            if (typeof IntersectionObserver === 'function') {
                const observer = new IntersectionObserver(() => __tmScheduleKanbanProgressiveViewportCheck(job, 0), {
                    root: nextBody,
                    rootMargin: '0px 35% 0px 35%',
                    threshold: 0,
                });
                modal.querySelectorAll('.tm-kanban-col[data-col-key]').forEach((column) => observer.observe(column));
                job.viewportObserver = observer;
            }
        } catch (e) { job.viewportObserver = null; }
        const onHorizontalScroll = () => __tmScheduleKanbanProgressiveViewportCheck(job, 96);
        const onResize = () => __tmScheduleKanbanProgressiveViewportCheck(job, 96);
        try { nextBody.addEventListener('scroll', onHorizontalScroll, { passive: true }); job.viewportListeners.push({ target: nextBody, type: 'scroll', handler: onHorizontalScroll }); } catch (e) {}
        try { window.addEventListener('resize', onResize, { passive: true }); job.viewportListeners.push({ target: window, type: 'resize', handler: onResize }); } catch (e) {}
        Array.isArray(job.columns) && job.columns.forEach((entry) => {
            const column = __tmGetKanbanProgressiveColumnElement(modal, entry.key);
            const columnBody = column?.querySelector?.(':scope > .tm-kanban-col-body');
            if (!(columnBody instanceof HTMLElement)) return;
            const onColumnScroll = () => __tmScheduleKanbanProgressiveViewportCheck(job, 96);
            try { columnBody.addEventListener('scroll', onColumnScroll, { passive: true }); job.viewportListeners.push({ target: columnBody, type: 'scroll', handler: onColumnScroll }); } catch (e) {}
        });
        __tmScheduleKanbanProgressiveViewportCheck(job, 0);
        return true;
    }

    function __tmRequestKanbanProgressiveColumnLoad(columnKey) {
        const job = state?.__tmProgressiveViewRender;
        if (!__tmIsProgressiveViewRenderCurrent(job, 'kanban')) return false;
        const key = String(columnKey || '').trim();
        const entry = Array.isArray(job.columns)
            ? job.columns.find((item) => String(item?.key || '').trim() === key)
            : null;
        if (!entry) return false;
        entry.loaded = false;
        __tmScheduleKanbanProgressiveViewportCheck(job, 0);
        return true;
    }

    try { globalThis.__tmRequestKanbanProgressiveColumnLoad = __tmRequestKanbanProgressiveColumnLoad; } catch (e) {}

    function __tmIsProgressiveViewRenderCurrent(job, mode = '') {
        const current = state?.__tmProgressiveViewRender;
        const value = String(mode || state?.viewMode || '').trim();
        return !!job
            && current === job
            && String(job.mode || '').trim() === value
            && Array.isArray(state?.filteredTasks)
            && state.filteredTasks === job.tasksRef;
    }

    function __tmFinishProgressiveViewRender(job, mode = '') {
        if (!__tmIsProgressiveViewRenderCurrent(job, mode)) return false;
        __tmCancelProgressiveViewRender();
        const modal = state?.modal;
        try { __tmApplyReminderTaskNameMarks(modal); } catch (e) {}
        try { __tmScheduleReminderTaskNameMarksRefresh(modal); } catch (e) {}
        try { __tmApplyTodayScheduledTaskNameMarks(modal); } catch (e) {}
        try { __tmScheduleTodayScheduledTaskNameMarksRefresh(modal); } catch (e) {}
        try { __tmBindFloatingTooltipsAfterLocalRerender(modal); } catch (e) {}
        return true;
    }

    function __tmScheduleProgressiveViewRender(mode = '', job = null) {
        if (!__tmIsProgressiveViewRenderCurrent(job, mode)) return false;
        if (String(mode || '').trim() !== 'kanban') return false;
        // Table, checklist, and timeline already share the near-bottom append-only loader.
        // Kanban needs a column-aware equivalent because each visible column scrolls independently.
        __tmBindKanbanProgressiveViewport(job);
        return true;
    }

    function __tmIsListLikeViewMode(mode) {
        const value = String(mode || state?.viewMode || '').trim();
        return value === 'list' || value === 'checklist' || value === 'timeline';
    }

    function __tmGetViewRenderWindowPolicy(mode = '') {
        const value = String(mode || state?.viewMode || 'list').trim() || 'list';
        const source = __TM_VIEW_RENDER_WINDOW_POLICY[value] || __TM_VIEW_RENDER_WINDOW_POLICY.list;
        let mobileLike = false;
        try {
            mobileLike = !!(__tmIsMobileDevice() || __tmIsRuntimeMobileClient() || __tmHostUsesMobileUI());
        } catch (e) {}
        return {
            mode: value,
            initial: mobileLike ? source.mobileInitial : source.desktopInitial,
            grow: mobileLike ? source.mobileGrow : source.desktopGrow,
        };
    }

    function __tmResetViewRenderWindow(mode = '', totalInput = null) {
        const value = String(mode || state?.viewMode || '').trim();
        if (!__tmIsListLikeViewMode(value)) return null;
        const policy = __tmGetViewRenderWindowPolicy(value);
        const total = Number.isFinite(Number(totalInput))
            ? Math.max(0, Math.round(Number(totalInput)))
            : Math.max(0, Array.isArray(state?.filteredTasks) ? state.filteredTasks.length : 0);
        state.listRenderStep = policy.initial;
        state.listRenderLimit = total > 0 ? Math.min(total, policy.initial) : policy.initial;
        return {
            ...policy,
            total,
            limit: state.listRenderLimit,
        };
    }

    function __tmGetViewRenderWindow(mode = '', totalInput = null) {
        const value = String(mode || state?.viewMode || '').trim();
        if (!__tmIsListLikeViewMode(value)) return null;
        const policy = __tmGetViewRenderWindowPolicy(value);
        const total = Number.isFinite(Number(totalInput))
            ? Math.max(0, Math.round(Number(totalInput)))
            : Math.max(0, Array.isArray(state?.filteredTasks) ? state.filteredTasks.length : 0);
        const currentLimit = Math.max(
            Math.min(total || policy.initial, policy.initial),
            Math.min(total || policy.initial, Number(state?.listRenderLimit) || policy.initial)
        );
        return {
            ...policy,
            total,
            limit: currentLimit,
            remaining: Math.max(0, total - currentLimit),
        };
    }

    function __tmGetViewRenderWindowContextKey(mode = '') {
        const value = String(mode || state?.viewMode || '').trim();
        const groupId = typeof SettingsStore !== 'undefined'
            ? String(SettingsStore?.data?.currentGroupId || 'all').trim() || 'all'
            : 'all';
        return [
            value,
            groupId,
            String(state?.activeDocId || 'all').trim() || 'all',
            String(state?.currentRule || '').trim(),
            String(state?.searchKeyword || '').trim(),
        ].join('|');
    }

    function __tmCaptureViewRenderWindow(mode = '') {
        const value = String(mode || state?.viewMode || '').trim();
        if (!__tmIsListLikeViewMode(value)) return null;
        const total = Math.max(0, Array.isArray(state?.filteredTasks) ? state.filteredTasks.length : 0);
        const current = __tmGetViewRenderWindow(value, total);
        if (!current) return null;
        return {
            mode: value,
            contextKey: __tmGetViewRenderWindowContextKey(value),
            limit: current.limit,
            step: Math.max(1, Math.round(Number(state?.listRenderStep) || current.initial)),
        };
    }

    function __tmRestoreViewRenderWindow(snapshot, totalInput = null) {
        const saved = (snapshot && typeof snapshot === 'object') ? snapshot : null;
        const mode = String(saved?.mode || '').trim();
        if (!saved || !__tmIsListLikeViewMode(mode)) return false;
        if (String(state?.viewMode || '').trim() !== mode) return false;
        if (String(saved.contextKey || '') !== __tmGetViewRenderWindowContextKey(mode)) return false;
        const policy = __tmGetViewRenderWindowPolicy(mode);
        const total = Number.isFinite(Number(totalInput))
            ? Math.max(0, Math.round(Number(totalInput)))
            : Math.max(0, Array.isArray(state?.filteredTasks) ? state.filteredTasks.length : 0);
        const savedLimit = Math.max(policy.initial, Math.round(Number(saved.limit) || policy.initial));
        state.listRenderStep = Math.max(1, Math.round(Number(saved.step) || policy.initial));
        state.listRenderLimit = total > 0 ? Math.min(total, savedLimit) : policy.initial;
        return true;
    }

    function __tmSliceTaskRowModelByTaskWindow(rowModelInput, startInput = 0, endInput = Number.POSITIVE_INFINITY) {
        const rowModel = Array.isArray(rowModelInput) ? rowModelInput : [];
        const start = Math.max(0, Math.round(Number(startInput) || 0));
        const endNumber = Number(endInput);
        const end = Number.isFinite(endNumber) ? Math.max(start, Math.round(endNumber)) : Number.POSITIVE_INFINITY;
        const rows = [];
        let pendingGroups = [];
        let taskIndex = 0;
        let stoppedAtWindowEnd = false;
        for (const row of rowModel) {
            if (row?.type === 'group') {
                pendingGroups.push(row);
                continue;
            }
            if (row?.type !== 'task') continue;
            if (taskIndex >= end) {
                stoppedAtWindowEnd = true;
                break;
            }
            if (taskIndex >= start) {
                if (pendingGroups.length) rows.push(...pendingGroups);
                rows.push(row);
            }
            pendingGroups = [];
            taskIndex += 1;
        }
        const ownsTrailingGroups = taskIndex === 0
            ? start === 0 && end > start
            : taskIndex > start && taskIndex <= end;
        if (!stoppedAtWindowEnd && pendingGroups.length && ownsTrailingGroups) {
            rows.push(...pendingGroups);
        }
        return {
            rows,
            start,
            end,
            visitedTaskCount: taskIndex,
            selectedTaskCount: rows.reduce((count, row) => count + (row?.type === 'task' ? 1 : 0), 0),
        };
    }

    function __tmGrowViewRenderWindow(mode = '', totalInput = null) {
        const current = __tmGetViewRenderWindow(mode, totalInput);
        if (!current) return null;
        const nextLimit = Math.min(current.total, current.limit + current.grow);
        state.listRenderStep = current.initial;
        state.listRenderLimit = nextLimit;
        return {
            ...current,
            previousLimit: current.limit,
            limit: nextLimit,
            remaining: Math.max(0, current.total - nextLimit),
        };
    }
