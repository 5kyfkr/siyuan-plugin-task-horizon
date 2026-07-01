    function __tmBuildTaskCompleteAtDetailChipHtml(task, detailTip = null) {
        const rawValue = __tmResolveTaskCompletedAtRaw(task);
        const text = __tmFormatTaskCompletedAtTime(rawValue);
        if (!text) return '';
        const tipAttr = typeof detailTip === 'function'
            ? detailTip(`完成时间：${text}`, { ariaLabel: false })
            : ` title="完成时间：${esc(text)}" data-tm-floating-tooltip-label="完成时间：${esc(text)}"`;
        return `<div class="bc-btn bc-btn--sm tm-task-detail-core-chip tm-task-detail-core-chip--static has-value" data-tm-detail-complete-at-chip${tipAttr}>
                            <span class="tm-task-detail-core-chip__face" data-tm-detail-chip-face="taskCompleteAt">${__tmBuildTaskDetailCoreChipFace('taskCompleteAt', rawValue)}</span>
                        </div>`;
    }

    function __tmTaskDetailTimeHubIcon(iconName, className = 'tm-task-time-hub__icon-svg', size = 15) {
        const name = String(iconName || '').trim();
        if (!name) return '';
        try {
            if (typeof __tmPhosphorBoldSvg === 'function') {
                return __tmPhosphorBoldSvg(name, { size, className });
            }
        } catch (e) {}
        try { return __tmRenderLucideIcon(name, className, { size }); } catch (e) {}
        return '';
    }

    function __tmTaskTimeHubShortcutDate(kind, baseValue = '') {
        const key = String(kind || '').trim();
        const parsed = String(__tmNormalizeDateOnly(baseValue) || '').trim();
        const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(parsed);
        const base = matched
            ? new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]), 12, 0, 0, 0)
            : new Date();
        if (!matched) base.setHours(12, 0, 0, 0);
        if (key === 'tomorrow') base.setDate(base.getDate() + 1);
        else if (key === 'next-week') base.setDate(base.getDate() + 7);
        else if (key === 'next-month') {
            const target = new Date(base.getFullYear(), base.getMonth() + 1, 1, 12, 0, 0, 0);
            const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
            target.setDate(Math.min(base.getDate(), lastDay));
            return __tmNormalizeDateOnly(target);
        }
        return __tmNormalizeDateOnly(base);
    }

    function __tmRenderTaskTimeHubQuickDatesHtml(activeValue = '') {
        const current = __tmNormalizeDateOnly(activeValue);
        const shortcuts = [
            ['today', '今天', 'sun'],
            ['tomorrow', '明天', 'sun-horizon'],
            ['next-week', '下周', 'calendar-plus'],
            ['next-month', '下月', 'calendar-star'],
        ];
        return `<div class="tm-task-time-hub__quick-dates" role="toolbar" aria-label="快速设置日期">
            ${shortcuts.map(([key, label, icon]) => {
                const value = __tmTaskTimeHubShortcutDate(key, activeValue);
                const active = current && value === current;
                return `<button type="button" class="tm-task-time-hub__quick-date${active ? ' is-active' : ''}" data-tm-time-hub-quick-date="${esc(value)}" aria-label="${esc(label)}" aria-pressed="${active ? 'true' : 'false'}" title="${esc(label)} ${esc(value)}">
                    ${__tmTaskDetailTimeHubIcon(icon, 'tm-task-time-hub__quick-date-icon', 16)}
                </button>`;
            }).join('')}
        </div>`;
    }

    function __tmRenderTaskDetailPhosphorIcon(iconName, size = 18) {
        const name = String(iconName || '').trim();
        if (!name) return '';
        try {
            if (typeof __tmPhosphorBoldSvg === 'function') {
                return `<span class="tm-task-detail-phosphor-icon">${__tmPhosphorBoldSvg(name, { size, className: 'tm-task-detail-phosphor-icon__svg' })}</span>`;
            }
        } catch (e) {}
        try { return __tmRenderLucideIcon(name, '', { size }); } catch (e) {}
        return '';
    }

    function __tmGetTaskDetailBlockId(task) {
        const item = (task && typeof task === 'object') ? task : null;
        if (!item) return '';
        const explicitId = String(item.blockId || item.block_id || item.realId || item.real_id || '').trim();
        if (explicitId) return explicitId;
        try {
            if (typeof __tmIsCollectedOtherBlockTask === 'function' && __tmIsCollectedOtherBlockTask(item)) return '';
        } catch (e) {}
        if (item.isOtherBlock === true) return '';
        return String(item.id || '').trim();
    }

    function __tmGetTaskDetailRootId(task) {
        return String(task?.rootId || task?.root_id || task?.docId || '').trim();
    }

    function __tmGetTaskDetailRemarkRaw(task) {
        return String(task?.remark ?? task?.custom_remark ?? task?.customRemark ?? '');
    }

    function __tmGetTaskDetailDisplayTitle(task) {
        const stripTaskSyntax = (input) => String(input || '')
            .replace(/^[\s>*]*(?:(?:[-*+]|\d+[.)])\s*)?\[[^\]]?\]\s*/, '')
            .trim();
        const candidates = [];
        try {
            const parsed = API?.parseTaskStatus?.(String(task?.markdown || ''));
            if (parsed?.content) candidates.push(parsed.content);
        } catch (e) {}
        candidates.push(task?.content, task?.raw_content, task?.markdown, task?.otherBlockRawContent);
        for (const item of candidates) {
            const text = stripTaskSyntax(item);
            if (text) return text;
        }
        return '任务';
    }

    function __tmIsTaskDetailRecurringInstance(task, rawId = '') {
        if (!task || typeof task !== 'object') {
            return /^repeatinst:/.test(String(rawId || '').trim());
        }
        try {
            if (typeof __tmIsRecurringInstanceTask === 'function' && __tmIsRecurringInstanceTask(task)) return true;
        } catch (e) {}
        if (task.isRecurringInstance === true || task.isRecurringInstanceReadOnly === true) return true;
        const taskId = String(task.id || rawId || '').trim();
        return /^repeatinst:/.test(taskId);
    }

    function __tmGetTaskDetailRecurringSourceTaskId(task, rawId = '') {
        if (!__tmIsTaskDetailRecurringInstance(task, rawId)) return '';
        const fallbackId = String(task?.id || rawId || '').trim();
        try {
            if (typeof __tmResolveRecurringInstanceSourceTaskId === 'function') {
                const resolved = String(__tmResolveRecurringInstanceSourceTaskId(fallbackId, task) || '').trim();
                if (resolved) return resolved;
            }
        } catch (e) {}
        const fromTask = String(task?.sourceTaskId || task?.recurringSourceTaskId || '').trim();
        if (fromTask) return fromTask;
        const match = fallbackId.match(/^repeatinst:([^:]+):/);
        return match ? String(match[1] || '').trim() : '';
    }

    function __tmDestroyTaskDetailNoteViewForRoot(root, reason = 'manual') {
        if (!(root instanceof HTMLElement)) return false;
        let destroyed = false;
        try {
            const destroy = root.__tmTaskDetailDestroyNoteView;
            const flush = root.__tmTaskDetailFlushNoteView;
            if (typeof flush === 'function') {
                try { Promise.resolve(flush(reason)).catch(() => null); } catch (e) {}
            }
            if (typeof destroy === 'function') {
                destroy(reason);
                destroyed = true;
            }
        } catch (e) {}
        try { delete root.__tmTaskDetailDestroyNoteView; } catch (e) {}
        try { delete root.__tmTaskDetailNoteActive; } catch (e) {}
        try { delete root.__tmTaskDetailNoteBlockId; } catch (e) {}
        try { root.removeAttribute('data-tm-detail-view'); } catch (e) {}
        return destroyed;
    }

    function __tmIsTaskDetailNoteViewActive(root, expectedTaskId = '') {
        if (!(root instanceof HTMLElement)) return false;
        try {
            if (root.__tmTaskDetailNoteActive !== true && root.getAttribute('data-tm-detail-view') !== 'note') return false;
            if (!root.querySelector?.('[data-tm-detail-note-mount]')) return false;
            const currentId = String(root.__tmTaskDetailTaskId || root.dataset?.tmDetailTaskId || root.__tmTaskDetailTask?.id || '').trim();
            const expectedId = String(expectedTaskId || '').trim();
            if (expectedId && currentId && !__tmAreTaskDetailIdsEquivalent(currentId, expectedId)) return false;
            return true;
        } catch (e) {
            return false;
        }
    }

    function __tmKeepTaskDetailNoteViewDuringRefresh(root, task, taskId = '') {
        if (!__tmIsTaskDetailNoteViewActive(root, taskId)) return false;
        const nextTask = (task && typeof task === 'object') ? task : null;
        const prevLocationSignature = String(root.__tmTaskDetailLocationSignature || '').trim();
        const nextLocationSignature = __tmBuildTaskDetailLocationSignature(nextTask);
        if (nextLocationSignature && (!prevLocationSignature || prevLocationSignature !== nextLocationSignature)) return false;
        try {
            if (nextTask) root.__tmTaskDetailTask = nextTask;
        } catch (e) {}
        try { if (nextTask) __tmRememberTaskDetailLocationSignature(root, nextTask); } catch (e) {}
        const tid = String(taskId || nextTask?.id || root.__tmTaskDetailTaskId || root.dataset?.tmDetailTaskId || '').trim();
        if (tid) {
            try { root.__tmTaskDetailTaskId = tid; } catch (e) {}
            try { root.dataset.tmDetailTaskId = tid; } catch (e) {}
        }
        try {
            __tmPushDetailDebug('detail-note-view-refresh-keep', {
                taskId: tid,
                rootTag: __tmDescribeDebugElement(root),
            });
        } catch (e) {}
        return true;
    }

    function __tmGetTaskDetailNoteViewScope(scope = '') {
        const raw = String(scope || '').trim();
        if (raw === 'kanban' || raw === 'kanban-detail' || raw === 'kanban-detail-float') return 'kanban';
        return 'sheet';
    }

    function __tmGetTaskDetailNoteViewScopeForRoot(root, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (opts.floating === true) return 'kanban';
        try {
            if (root instanceof Element && String(root.id || '').trim() === 'tmKanbanDetailPanel') return 'kanban';
        } catch (e) {}
        return 'sheet';
    }

    function __tmGetTaskDetailNoteViewState(scope = '', taskId = '') {
        const noteState = (state?.taskDetailNoteView && typeof state.taskDetailNoteView === 'object')
            ? state.taskDetailNoteView
            : null;
        if (!noteState || String(noteState.mode || '').trim() !== 'note') return null;
        const expectedScope = scope ? __tmGetTaskDetailNoteViewScope(scope) : '';
        if (expectedScope && __tmGetTaskDetailNoteViewScope(noteState.scope) !== expectedScope) return null;
        const expectedId = String(taskId || '').trim();
        const storedId = String(noteState.taskId || '').trim();
        if (expectedId && storedId && !__tmAreTaskDetailIdsEquivalent(storedId, expectedId)) return null;
        return noteState;
    }

    function __tmSetTaskDetailNoteViewState(scope, task, blockId = '', options = {}) {
        const item = (task && typeof task === 'object') ? task : null;
        const tid = String(item?.id || options?.taskId || '').trim();
        const bid = String(blockId || __tmGetTaskDetailBlockId(item) || options?.blockId || '').trim();
        if (!tid || !bid) return false;
        state.taskDetailNoteView = {
            mode: 'note',
            scope: __tmGetTaskDetailNoteViewScope(scope),
            taskId: tid,
            blockId: bid,
            rootId: String(__tmGetTaskDetailRootId(item) || options?.rootId || '').trim(),
            updatedAt: Date.now(),
        };
        return true;
    }

    function __tmClearTaskDetailNoteViewState(scope = '', taskId = '', reason = '') {
        const noteState = __tmGetTaskDetailNoteViewState(scope, taskId);
        if (!noteState) return false;
        try {
            __tmPushDetailDebug('detail-note-view-state-clear', {
                scope: String(scope || noteState.scope || '').trim(),
                taskId: String(taskId || noteState.taskId || '').trim(),
                reason: String(reason || '').trim() || 'manual',
            });
        } catch (e) {}
        try { delete state.taskDetailNoteView; } catch (e) { state.taskDetailNoteView = null; }
        return true;
    }

    function __tmShouldRenderTaskDetailNoteView(scope, task) {
        const item = (task && typeof task === 'object') ? task : null;
        const tid = String(item?.id || '').trim();
        if (!item || !tid) return false;
        const noteState = __tmGetTaskDetailNoteViewState(scope, tid);
        if (!noteState) return false;
        const blockId = String(__tmGetTaskDetailBlockId(item) || noteState.blockId || '').trim();
        return !!blockId;
    }

    function __tmResolveTaskDetailEventElement(target) {
        if (target instanceof Element) return target;
        try {
            if (target?.parentElement instanceof Element) return target.parentElement;
        } catch (e) {}
        return null;
    }

    function __tmIsTaskDetailNoteViewLocalEventTarget(target) {
        const node = __tmResolveTaskDetailEventElement(target);
        if (!(node instanceof Element)) return false;
        try {
            return !!node.closest('[data-tm-detail-note-view],[data-tm-detail-note-mount],.tm-task-detail-note-view,.tm-task-detail-note-mount');
        } catch (e) {
            return false;
        }
    }

    function __tmIsTaskDetailNoteViewEventTarget(target) {
        const node = __tmResolveTaskDetailEventElement(target);
        if (!(node instanceof Element)) return false;
        try {
            if (__tmIsTaskDetailNoteViewLocalEventTarget(node)) return true;
            if (node.closest('.protyle,.protyle-content,.protyle-wysiwyg,.protyle-action,.protyle-attr,.protyle-gutter,.protyle-gutters,.protyle-toolbar,.protyle-util,.protyle-hint,.protyle-select,.protyle-menu,.protyle-icons,.protyle-scroll,.protyle-breadcrumb,.block__popover,.b3-menu,.b3-dialog')) return true;
        } catch (e) {}
        return false;
    }

    function __tmAreTaskDetailIdsEquivalent(left, right) {
        const a = String(left || '').trim();
        const b = String(right || '').trim();
        if (!a || !b) return false;
        if (a === b) return true;
        try {
            if (typeof __tmResolveOptimisticTaskId === 'function') {
                const ra = String(__tmResolveOptimisticTaskId(a) || a).trim();
                const rb = String(__tmResolveOptimisticTaskId(b) || b).trim();
                if (ra && rb && ra === rb) return true;
            }
        } catch (e) {}
        return false;
    }

    function __tmResolveTaskDetailEffectiveId(taskId) {
        const rawId = String(taskId || '').trim();
        if (!rawId) return '';
        try {
            if (typeof __tmResolveOptimisticTaskId === 'function') {
                const resolvedId = String(__tmResolveOptimisticTaskId(rawId) || rawId).trim();
                if (resolvedId) return resolvedId;
            }
        } catch (e) {}
        return rawId;
    }

    function __tmGetTaskDetailTaskById(taskId, options = {}) {
        const rawId = String(taskId || '').trim();
        if (!rawId) return null;
        const opts = (options && typeof options === 'object') ? options : {};
        const resolvedId = __tmResolveTaskDetailEffectiveId(rawId) || rawId;
        const aliases = Array.from(new Set([rawId, resolvedId].map((id) => String(id || '').trim()).filter(Boolean)));
        const mergeCalendarTask = (task, id) => {
            let calendarTask = null;
            try {
                const resolver = globalThis.__tmResolveCalendarCachedTaskForDetail;
                if (typeof resolver === 'function') calendarTask = resolver(id, { aliases });
            } catch (e) {
                calendarTask = null;
            }
            if (!(calendarTask && typeof calendarTask === 'object')) return task || null;
            if (!(task && typeof task === 'object')) return calendarTask;
            const currentChildren = Array.isArray(task.children) ? task.children : [];
            const calendarChildren = Array.isArray(calendarTask.children) ? calendarTask.children : [];
            if (__tmCountTaskDetailRawSubtasks(calendarTask) <= __tmCountTaskDetailRawSubtasks(task)) return task;
            return {
                ...calendarTask,
                ...task,
                children: calendarChildren,
            };
        };
        for (const id of aliases) {
            const task = globalThis.__tmRuntimeState?.getTaskById?.(id, {
                includePending: opts.includePending !== false,
                preferPending: opts.preferPending !== false,
            })
                || (opts.preferPending !== false ? state.pendingInsertedTasks?.[id] : null)
                || state.flatTasks?.[id]
                || state.pendingInsertedTasks?.[id]
                || null;
            if (task && typeof task === 'object') return mergeCalendarTask(task, id);
        }
        for (const id of aliases) {
            const task = mergeCalendarTask(null, id);
            if (task && typeof task === 'object') return task;
        }
        if (opts.includeWhiteboard === true) {
            for (const id of aliases) {
                try {
                    const task = __tmTaskStateKernel.getTask(id) || null;
                    if (task && typeof task === 'object') return mergeCalendarTask(task, id);
                } catch (e) {}
            }
        }
        return null;
    }

    async function __tmEnsureTaskDetailFieldAttrs(taskLike, options = {}) {
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : null;
        if (!task) return taskLike || null;
        const opts = (options && typeof options === 'object') ? options : {};
        const tid = String(opts.taskId || task.id || '').trim();
        const shouldForce = opts.force === true;
        const beforeRemark = __tmGetTaskDetailRemarkRaw(task);
        const queuedPatch = (() => {
            try {
                if (!tid || typeof __tmBuildQueuedTaskFieldPatchMap !== 'function') return null;
                const patchMap = __tmBuildQueuedTaskFieldPatchMap({ statuses: ['queued', 'running'] });
                const patch = patchMap instanceof Map ? patchMap.get(tid) : null;
                return (patch && typeof patch === 'object' && !Array.isArray(patch) && Object.keys(patch).length)
                    ? patch
                    : null;
            } catch (e) {
                return null;
            }
        })();
        const hasQueuedPatch = !!queuedPatch;
        try {
            if (!shouldForce
                && !hasQueuedPatch
                && typeof __tmHasTaskAttachmentAttrSnapshot === 'function'
                && __tmHasTaskAttachmentAttrSnapshot(task)) {
                return task;
            }
        } catch (e) {}
        try {
            if (typeof __tmApplyTaskAttrHostOverrides === 'function') {
                await __tmApplyTaskAttrHostOverrides([task], {
                    preferExistingSelf: shouldForce ? false : true,
                    applyBlankSelfAttrs: shouldForce,
                });
            }
        } catch (e) {}
        if (queuedPatch) {
            try {
                if (typeof __tmApplyQueuedTaskFieldPatchToTask === 'function') {
                    __tmApplyQueuedTaskFieldPatchToTask(task, queuedPatch);
                }
            } catch (e) {}
        }
        let resolvedTask = task;
        if (tid) {
            try {
                if (typeof __tmCacheTaskInState === 'function') {
                    resolvedTask = __tmCacheTaskInState(task, {
                        docNameFallback: task.doc_name || task.docName || '未命名文档',
                    }) || task;
                }
            } catch (e) {}
        }
        if (tid) {
            try {
                const afterRemark = __tmGetTaskDetailRemarkRaw(resolvedTask);
                if (beforeRemark !== afterRemark && typeof __tmRefreshTaskFieldsAcrossViews === 'function') {
                    __tmRefreshTaskFieldsAcrossViews(tid, { remark: true }, {
                        reason: `${String(opts.source || 'detail-field-attrs').trim() || 'detail-field-attrs'}:remark`,
                        fallback: false,
                        skipDetailPatch: true,
                    });
                }
            } catch (e) {}
        }
        return resolvedTask;
    }

    async function __tmEnsureTaskDetailAttachmentAttrs(taskLike, options = {}) {
        return await __tmEnsureTaskDetailFieldAttrs(taskLike, options);
    }

    const __tmTaskDetailFieldAttrHydrateMarks = new Map();

    function __tmBuildTaskDetailFieldAttrSignature(taskLike) {
        const task = (taskLike && typeof taskLike === 'object') ? taskLike : {};
        const read = (value) => String(value ?? '').trim();
        let attachments = [];
        try { attachments = __tmGetTaskAttachmentPaths(task); } catch (e) { attachments = []; }
        return JSON.stringify({
            customStatus: read(task.customStatus || task.custom_status),
            priority: read(task.priority || task.custom_priority),
            startDate: read(task.startDate || task.start_date),
            completionTime: read(task.completionTime || task.completion_time),
            taskCompleteAt: read(task.taskCompleteAt || task.task_complete_at),
            duration: read(task.duration || task.custom_duration),
            tomatoEstimateCount: read(task.tomatoEstimateCount || task.tomato_estimate_count),
            tomatoCount: read(task.tomatoCount || task.tomato_count),
            pinned: !!(task.pinned === true || task.pinned === 1 || task.pinned === '1' || read(task.custom_pinned) === '1'),
            remark: String(task.remark ?? task.custom_remark ?? ''),
            repeatRule: read(task.repeatRule || task.repeat_rule),
            repeatState: read(task.repeatState || task.repeat_state),
            attachments,
        });
    }

    function __tmScheduleTaskDetailFieldAttrHydration(taskId, taskLike, options = {}) {
        const tid = String(taskId || taskLike?.id || '').trim();
        if (!tid || typeof __tmEnsureTaskDetailFieldAttrs !== 'function') return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const source = String(opts.source || 'visible-detail-field-attrs').trim() || 'visible-detail-field-attrs';
        const mode = String(opts.mode || '').trim();
        const key = `${mode || 'detail'}:${tid}:${source}`;
        const now = Date.now();
        const last = Number(__tmTaskDetailFieldAttrHydrateMarks.get(key) || 0);
        if (opts.force !== true && now - last < 2500) return false;
        __tmTaskDetailFieldAttrHydrateMarks.set(key, now);
        if (__tmTaskDetailFieldAttrHydrateMarks.size > 160) {
            const oldestKey = __tmTaskDetailFieldAttrHydrateMarks.keys().next().value;
            if (oldestKey !== undefined) __tmTaskDetailFieldAttrHydrateMarks.delete(oldestKey);
        }
        Promise.resolve().then(async () => {
            const task = (taskLike && typeof taskLike === 'object')
                ? taskLike
                : (__tmGetTaskDetailTaskById(tid, { includePending: true, preferPending: true, includeWhiteboard: true }) || null);
            if (!task) return;
            const before = __tmBuildTaskDetailFieldAttrSignature(task);
            const hydrated = await __tmEnsureTaskDetailFieldAttrs(task, {
                taskId: tid,
                source,
                force: true,
            }) || task;
            const after = __tmBuildTaskDetailFieldAttrSignature(hydrated);
            if (before === after) return;
            try {
                const beforeState = JSON.parse(before || '{}');
                const afterState = JSON.parse(after || '{}');
                if (String(beforeState?.remark ?? '') !== String(afterState?.remark ?? '')
                    && typeof __tmRefreshTaskFieldsAcrossViews === 'function') {
                    __tmRefreshTaskFieldsAcrossViews(tid, { remark: true }, {
                        reason: `${source}:hydrated-remark`,
                        fallback: false,
                        skipDetailPatch: true,
                    });
                }
            } catch (e) {}
            const modal = opts.modal instanceof Element ? opts.modal : state.modal;
            if (mode === 'checklist') {
                if (!__tmAreTaskDetailIdsEquivalent(state.detailTaskId, tid)) return;
                try { __tmRefreshChecklistSelectionInPlace(modal, `${source}:hydrated`, { forceRebuild: true }); } catch (e) {}
                return;
            }
            if (mode === 'task-sheet') {
                if (!__tmAreTaskDetailIdsEquivalent(state.detailTaskId, tid)) return;
                try { __tmRefreshTaskDetailSheetInPlace(modal, `${source}:hydrated`, { forceRebuild: true }); } catch (e) {}
                return;
            }
            if (mode === 'kanban') {
                if (!__tmAreTaskDetailIdsEquivalent(state.kanbanDetailTaskId, tid)) return;
                try { __tmRefreshKanbanDetailInPlace(modal, { source: `${source}:hydrated`, schedulePosition: false }); } catch (e) {}
            }
        }).catch(() => null);
        return true;
    }

    function __tmShouldDismissTaskTimeHubEditor(popover, editorKey, target) {
        if (!(popover instanceof HTMLElement) || !(target instanceof Element)) return false;
        const activeEditor = String(editorKey || '').trim();
        if (!activeEditor || !popover.contains(target)) return false;
        const editorPanel = target.closest('[data-tm-time-hub-editor-panel]');
        if (editorPanel instanceof Element && popover.contains(editorPanel)) return false;
        const activeCard = target.closest('[data-tm-time-hub-card]');
        if (activeCard instanceof Element && popover.contains(activeCard)) {
            return String(activeCard.getAttribute('data-tm-time-hub-card') || '').trim() !== activeEditor;
        }
        return true;
    }

    function __tmGetStableTaskTimeHubAnchorRect(element, fallbackRect = null) {
        if (!(element instanceof HTMLElement)) return fallbackRect;
        let rect = null;
        try { rect = element.getBoundingClientRect(); } catch (e) { return fallbackRect; }
        const usable = element.isConnected && rect && (
            rect.width > 0 ||
            rect.height > 0 ||
            rect.left !== 0 ||
            rect.top !== 0 ||
            rect.right !== 0 ||
            rect.bottom !== 0
        );
        if (!usable) return fallbackRect;
        return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
        };
    }

    function __tmGetTaskTimeHubViewport() {
        const docEl = document.documentElement;
        const vv = window.visualViewport;
        const left = Number.isFinite(Number(vv?.offsetLeft)) ? Number(vv.offsetLeft) : 0;
        const top = Number.isFinite(Number(vv?.offsetTop)) ? Number(vv.offsetTop) : 0;
        const width = Math.max(240, Math.round(Number(vv?.width) || docEl?.clientWidth || window.innerWidth || 0));
        const height = Math.max(240, Math.round(Number(vv?.height) || docEl?.clientHeight || window.innerHeight || 0));
        return {
            left,
            top,
            width,
            height,
            right: left + width,
            bottom: top + height,
        };
    }

    function __tmPositionTaskTimeHubPopover(popover, anchorRect, options = {}) {
        if (!(popover instanceof HTMLElement) || !anchorRect) return;
        if (window.matchMedia && window.matchMedia('(max-width: 640px)').matches) {
            popover.style.width = '';
            popover.style.left = '';
            popover.style.top = '';
            popover.style.maxHeight = '';
            return;
        }
        const viewport = __tmGetTaskTimeHubViewport();
        const margin = Math.max(6, Number(options.margin) || 8);
        const gap = Math.max(4, Number(options.gap) || 8);
        const maxWidth = Math.max(220, Number(options.maxWidth) || 286);
        const minWidth = Math.max(180, Number(options.minWidth) || 260);
        const availableWidth = Math.max(180, Math.round(viewport.width - margin * 2));
        const targetWidth = Math.round(Math.min(maxWidth, Math.max(minWidth, availableWidth)));
        popover.style.width = `${targetWidth}px`;
        popover.style.maxHeight = '';

        const popRect = popover.getBoundingClientRect();
        const popWidth = Math.max(180, Math.round(popRect.width || targetWidth));
        const availableHeight = Math.max(180, Math.round(viewport.height - margin * 2));
        const heightForPlacement = Math.max(1, Math.round(popRect.height || Math.min(520, availableHeight)));
        const leftMin = Math.round(viewport.left + margin);
        const leftMax = Math.round(viewport.right - margin - popWidth);
        const placement = String(options.placement || '').trim();
        if (placement === 'right') {
            let left = Math.round(anchorRect.right + gap);
            if (left + popWidth > viewport.right - margin) {
                left = Math.round(anchorRect.left - popWidth - gap);
            }
            left = Math.max(leftMin, Math.min(left, Math.max(leftMin, leftMax)));
            const topMin = Math.round(viewport.top + margin);
            const topMax = Math.round(viewport.bottom - margin - Math.min(heightForPlacement, availableHeight));
            let top = Math.round(anchorRect.top);
            top = Math.max(topMin, Math.min(top, Math.max(topMin, topMax)));
            const maxHeight = Math.max(180, Math.round(viewport.bottom - margin - top));
            popover.style.left = `${left}px`;
            popover.style.top = `${top}px`;
            popover.style.maxHeight = `${Math.min(maxHeight, availableHeight)}px`;
            return;
        }
        let left = Math.round(anchorRect.left + (anchorRect.width || 0) / 2 - popWidth / 2);
        left = Math.max(leftMin, Math.min(left, Math.max(leftMin, leftMax)));

        const topMin = Math.round(viewport.top + margin);
        const topMax = Math.round(viewport.bottom - margin - Math.min(heightForPlacement, availableHeight));
        const belowTop = Math.round(anchorRect.bottom + gap);
        const aboveTop = Math.round(anchorRect.top - heightForPlacement - gap);
        const belowSpace = Math.round(viewport.bottom - margin - belowTop);
        const aboveSpace = Math.round(anchorRect.top - gap - topMin);
        let top;
        if (heightForPlacement <= belowSpace) {
            top = belowTop;
        } else if (heightForPlacement <= aboveSpace) {
            top = aboveTop;
        } else {
            top = Math.max(topMin, Math.min(belowTop, Math.max(topMin, topMax)));
        }

        const maxHeight = Math.max(180, Math.round(viewport.bottom - margin - top));
        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
        popover.style.maxHeight = `${Math.min(maxHeight, availableHeight)}px`;
    }

    function __tmFormatTaskDetailShortDate(value, emptyText = '未设置') {
        const key = __tmNormalizeDateOnly(value);
        if (!key) return emptyText;
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
        if (!m) return key;
        const year = Number(m[1]);
        const now = new Date();
        return year === now.getFullYear()
            ? `${Number(m[2])}月${Number(m[3])}日`
            : key;
    }

    function __tmGetTaskTimeHubCalendarFirstDay() {
        try {
            return Number(SettingsStore?.data?.calendarFirstDay) === 0 ? 0 : 1;
        } catch (e) {
            return 1;
        }
    }

    function __tmGetTaskTimeHubWeekdayLabels(firstDay = __tmGetTaskTimeHubCalendarFirstDay()) {
        const labels = ['日', '一', '二', '三', '四', '五', '六'];
        const start = Number(firstDay) === 0 ? 0 : 1;
        return labels.slice(start).concat(labels.slice(0, start));
    }

    function __tmGetTaskTimeHubMonthGridStart(month, firstDay = __tmGetTaskTimeHubCalendarFirstDay()) {
        const first = new Date(month.getFullYear(), month.getMonth(), 1, 12, 0, 0, 0);
        const gridStart = new Date(first.getTime());
        const offset = (first.getDay() - (Number(firstDay) === 0 ? 0 : 1) + 7) % 7;
        gridStart.setDate(first.getDate() - offset);
        return gridStart;
    }

    function __tmNormalizeTaskTimeHubTitle(value, fallback = '任务') {
        const backup = String(fallback || '').trim() || '任务';
        let text = String(value || '').trim() || backup;
        try {
            text = (typeof API?.extractTaskContentLine === 'function')
                ? String(API.extractTaskContentLine(text) || text).trim()
                : String(text.split(/\r?\n/)[0] || text).trim();
        } catch (e) {
            text = String(text.split(/\r?\n/)[0] || text).trim();
        }
        text = text
            .replace(/^[\s>*]*(?:(?:[-*+]|\d+[.)])\s*)?\[[^\]]?\]\s*/, '')
            .replace(/\{\:\s*[^}]*\}/g, '')
            .replace(/<span\b[^>]*>([\s\S]*?)<\/span>/gi, '$1')
            .replace(/<[^>]+>/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
        try {
            if (typeof API?.normalizeTaskContent === 'function') {
                text = String(API.normalizeTaskContent(text) || text).trim();
            }
        } catch (e) {}
        return text || backup;
    }

    function __tmGetTaskDetailTimeHubParts(task, options = {}) {
        const source = (task && typeof task === 'object') ? task : {};
        const opts = (options && typeof options === 'object') ? options : {};
        const endValue = __tmNormalizeDateOnly(opts.completionTime ?? source.completionTime ?? source.completion_time ?? '');
        const reminderText = String(opts.reminderText || '').trim();
        const hasReminder = opts.hasReminder === true || !!reminderText;
        const scheduleText = String(opts.scheduleText || '').trim();
        const parts = [];
        if (endValue) parts.push(__tmFormatTaskDetailShortDate(endValue));
        if (scheduleText) parts.push(scheduleText);
        if (hasReminder) parts.push(reminderText || '已提醒');
        return parts;
    }

    function __tmTaskDetailTimeHubHasRepeat(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        return opts.hasRepeat === true || !!String(opts.repeatSummary || '').trim();
    }

    function __tmTaskDetailTimeHubHasValue(task, options = {}) {
        return __tmGetTaskDetailTimeHubParts(task, options).length > 0 || __tmTaskDetailTimeHubHasRepeat(options);
    }

    function __tmGetTaskDetailTimeHubLabel(task, options = {}) {
        const text = __tmGetTaskDetailTimeHubParts(task, options).join(' · ');
        if (text) return text;
        return __tmTaskDetailTimeHubHasRepeat(options) ? '循环' : '截止日期';
    }

    function __tmBuildTaskDetailTimeHubFace(task, options = {}) {
        const text = __tmGetTaskDetailTimeHubParts(task, options).join(' · ');
        const icon = __tmRenderLucideIcon('calendar-check', 'tm-task-detail-core-chip__icon');
        const repeatIcon = __tmTaskDetailTimeHubHasRepeat(options)
            ? __tmRenderLucideIcon('repeat', 'tm-task-detail-core-chip__icon')
            : '';
        return `${icon}${text ? `<span class="tm-task-detail-core-chip__text">${esc(text)}</span>` : ''}${repeatIcon}`;
    }

    let __tmStandaloneTaskTimeHub = null;

    function __tmCloseStandaloneTaskTimeHub(reason = 'manual', options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const state0 = __tmStandaloneTaskTimeHub;
        if (!state0) return false;
        __tmStandaloneTaskTimeHub = null;
        try {
            if (typeof state0.onClose === 'function') {
                state0.onClose({
                    reason: String(reason || '').trim() || 'manual',
                    popover: state0.popover,
                    trigger: state0.trigger,
                });
            }
        } catch (e) {}
        try { state0.unstack?.(); } catch (e) {}
        try { state0.abort?.abort?.(); } catch (e) {}
        try { state0.trigger?.classList?.remove?.('is-open'); } catch (e) {}
        try { state0.trigger?.setAttribute?.('aria-expanded', 'false'); } catch (e) {}
        const popover = state0.popover;
        if (popover instanceof HTMLElement) {
            try { popover.style.pointerEvents = 'none'; } catch (e) {}
            try { popover.setAttribute('aria-hidden', 'true'); } catch (e) {}
            if (opts.immediate === true) {
                try { popover.remove(); } catch (e2) {}
            } else {
                try { __tmAnimatePopupOutAndRemove(popover, { duration: 110 }); } catch (e) {
                    try { popover.remove(); } catch (e2) {}
                }
            }
        }
        return true;
    }

    async function __tmResolveTaskForTimeHub(taskIdOrBlockId, taskLike = null) {
        const requestedId = String(taskIdOrBlockId || taskLike?.id || taskLike?.blockId || '').trim();
        let task = (taskLike && typeof taskLike === 'object') ? taskLike : null;
        let resolvedId = requestedId;
        try {
            const optimisticResolvedId = typeof __tmResolveOptimisticTaskId === 'function'
                ? String(__tmResolveOptimisticTaskId(requestedId) || '').trim()
                : '';
            if (optimisticResolvedId) resolvedId = optimisticResolvedId;
        } catch (e) {}
        if (!task && requestedId) {
            try {
                task = globalThis.__tmRuntimeState?.getTaskById?.(requestedId, { includePending: true, preferPending: true })
                    || state.flatTasks?.[requestedId]
                    || state.pendingInsertedTasks?.[requestedId]
                    || null;
            } catch (e) {}
        }
        if (!task && requestedId) {
            try {
                const nextId = await __tmResolveTaskIdFromAnyBlockId(requestedId);
                if (nextId && resolvedId === requestedId) resolvedId = String(nextId || '').trim() || requestedId;
            } catch (e) {}
        }
        if (!task && resolvedId) {
            try {
                task = __tmGetTaskDetailTaskById(resolvedId, { includeWhiteboard: true })
                    || globalThis.__tmRuntimeState?.getTaskById?.(resolvedId, { includePending: true, preferPending: true })
                    || state.flatTasks?.[resolvedId]
                    || state.pendingInsertedTasks?.[resolvedId]
                    || null;
            } catch (e) {}
        }
        if (!task && resolvedId) {
            try { task = await __tmEnsureTaskInStateById(resolvedId); } catch (e) { task = null; }
        }
        if (!task && resolvedId) {
            try { task = await __tmBuildTaskLikeFromBlockId(resolvedId); } catch (e) { task = null; }
        }
        if (!task && requestedId && requestedId !== resolvedId) {
            try { task = await __tmBuildTaskLikeFromBlockId(requestedId); } catch (e) { task = null; }
        }
        if (task && typeof task === 'object') {
            const tid = String(task.id || resolvedId || requestedId).trim();
            if (tid && !task.id) {
                try { task = { ...task, id: tid }; } catch (e) {}
            }
        }
        return task || null;
    }

    function __tmTaskTimeHubAnchorFromInput(anchorOrEvent, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (opts.anchorEl instanceof HTMLElement) return opts.anchorEl;
        if (anchorOrEvent instanceof HTMLElement) return anchorOrEvent;
        const ev = anchorOrEvent && typeof anchorOrEvent === 'object' ? anchorOrEvent : null;
        if (ev?.currentTarget instanceof HTMLElement) return ev.currentTarget;
        if (ev?.target instanceof Element) return ev.target.closest('button,[data-tm-task-time-field],.tm-cell-editable,.tm-kanban-chip,.sy-custom-props-inline-chip,.sy-custom-props-floatbar__prop') || ev.target;
        return null;
    }

    async function __tmOpenStandaloneTaskTimeHub(taskIdOrBlockId, anchorOrEvent = null, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const trigger = __tmTaskTimeHubAnchorFromInput(anchorOrEvent, opts);
        if (!(trigger instanceof HTMLElement)) {
            hint('⚠ 未找到时间设置入口', 'warning');
            return null;
        }
        if (__tmStandaloneTaskTimeHub?.trigger === trigger) {
            __tmCloseStandaloneTaskTimeHub('toggle');
            return null;
        }
        __tmCloseStandaloneTaskTimeHub('replace');

        let task = await __tmResolveTaskForTimeHub(taskIdOrBlockId, opts.task);
        const draftMode = opts.draft === true || opts.persist === false;
        if (!task && draftMode && opts.task && typeof opts.task === 'object') task = opts.task;
        const taskId = String(task?.id || taskIdOrBlockId || (draftMode ? '__tm_quick_add_draft__' : '')).trim();
        if (!taskId) {
            hint('⚠ 未找到任务', 'warning');
            return null;
        }
        const getEffectiveTaskId = () => {
            const rawId = String(task?.id || taskId || '').trim();
            if (!rawId) return '';
            try {
                if (typeof __tmResolveOptimisticTaskId === 'function') {
                    return String(__tmResolveOptimisticTaskId(rawId) || rawId).trim() || rawId;
                }
            } catch (e) {}
            return rawId;
        };
        const hideReminder = opts.hideReminder === true || draftMode;
        const hideSchedule = opts.hideSchedule === true || draftMode;
        const hideRepeat = opts.hideRepeat === true || draftMode;
        const scheduleTabLabel = String(opts.scheduleTabLabel || '日程').trim() || '日程';

        const todayKey = __tmNormalizeDateOnly(new Date());
        const pad2 = (n) => String(n).padStart(2, '0');
        const parseDateKey = (value) => {
            const key = __tmNormalizeDateOnly(value);
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
            if (!m) return null;
            const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
            return Number.isNaN(d.getTime()) ? null : d;
        };
        const toDateKey = (date) => {
            if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
            return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
        };
        const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
        const shiftMonth = (date, delta) => new Date(date.getFullYear(), date.getMonth() + (Number(delta) || 0), 1, 12, 0, 0, 0);
        const normalizeDate = (value) => value ? __tmNormalizeDateOnly(value) : '';
        const getTaskTitle = () => {
            const source = task && typeof task === 'object' ? task : {};
            return __tmNormalizeTaskTimeHubTitle(source.content || source.raw_content || source.markdown || '', '任务');
        };
        const readTaskDate = (field) => {
            const source = task && typeof task === 'object' ? task : {};
            return normalizeDate(field === 'startDate'
                ? (source.startDate || source.start_date || '')
                : (source.completionTime || source.completion_time || ''));
        };
        const writeTaskDatesLocal = (patch = {}) => {
            task = {
                ...(task || {}),
                ...(Object.prototype.hasOwnProperty.call(patch, 'startDate') ? { startDate: normalizeDate(patch.startDate), start_date: normalizeDate(patch.startDate) } : {}),
                ...(Object.prototype.hasOwnProperty.call(patch, 'completionTime') ? { completionTime: normalizeDate(patch.completionTime), completion_time: normalizeDate(patch.completionTime) } : {}),
            };
        };
        const refreshTask = async () => {
            const next = await __tmResolveTaskForTimeHub(getEffectiveTaskId() || taskId, null);
            if (next) task = next;
            return task;
        };
        const notifyChange = async (patch = {}, extra = {}) => {
            try {
                if (typeof opts.onChange === 'function') {
                    await opts.onChange({
                        taskId: getEffectiveTaskId() || taskId,
                        requestedTaskId: String(taskIdOrBlockId || taskId).trim(),
                        patch: { ...(patch || {}) },
                        task,
                        ...((extra && typeof extra === 'object') ? extra : {}),
                    });
                }
            } catch (e) {}
        };
        const makeDateTime = (dateKey, timeKey = '09:00') => {
            const d = parseDateKey(dateKey) || parseDateKey(todayKey) || new Date();
            const m = /^(\d{1,2}):(\d{2})$/.exec(String(timeKey || '').trim());
            const h = m ? Math.max(0, Math.min(23, Number(m[1]) || 0)) : 9;
            const min = m ? Math.max(0, Math.min(59, Number(m[2]) || 0)) : 0;
            return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, min, 0, 0);
        };
        const formatTime = (value) => {
            const d = value instanceof Date ? value : new Date(value);
            if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
            return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
        };
        const formatScheduleDate = (value) => __tmFormatTaskDetailShortDate(__tmNormalizeDateOnly(value), '');
        const getRepeatRule = () => {
            try { return __tmGetTaskRepeatRule(task || {}); } catch (e) { return { enabled: false, type: 'none' }; }
        };
        const getRepeatSummary = () => {
            try {
                return __tmGetTaskRepeatSummary(getRepeatRule(), {
                    startDate: readTaskDate('startDate'),
                    completionTime: readTaskDate('completionTime'),
                });
            } catch (e) {
                return '';
            }
        };
        const readReminderSnapshot = () => {
            try { return __tmPeekTaskReminderSnapshotByAnyId(task || { id: getEffectiveTaskId() || taskId }); } catch (e) { return null; }
        };
        const readReminderValue = () => {
            const snap = readReminderSnapshot();
            try { return !!(snap?.hasReminder === true || __tmHasReminderMark(task || { id: getEffectiveTaskId() || taskId })); } catch (e) {}
            return snap?.hasReminder === true;
        };
        const readReminderDisplayValue = () => String(readReminderSnapshot()?.displayText || '').trim();
        const sortDateRange = (left, right) => {
            const a = normalizeDate(left);
            const b = normalizeDate(right);
            if (!a && !b) return { start: '', end: '' };
            if (!a) return { start: b, end: b };
            if (!b) return { start: a, end: a };
            return a <= b ? { start: a, end: b } : { start: b, end: a };
        };
        const isKeyInDateRange = (key, start, end) => {
            const k = normalizeDate(key);
            return !!(k && start && end && k >= start && k <= end);
        };

        const requestedField = String(opts.activeField || '').trim();
        const initialActiveField = requestedField === 'startDate' ? 'startDate' : 'completionTime';
        const initialMonth = parseDateKey(readTaskDate(initialActiveField) || readTaskDate('completionTime') || readTaskDate('startDate') || todayKey) || new Date();
        const hubState = {
            tab: !hideSchedule && String(opts.tab || '').trim() === 'schedule' ? 'schedule' : 'date',
            activeField: initialActiveField,
            monthDate: startOfMonth(initialMonth),
            editor: '',
            schedules: [],
            schedulesLoaded: false,
            schedulesLoading: false,
            scheduleExpanded: false,
            rangeDrag: null,
        };
        const getHubMonthDate = () => {
            const current = hubState.monthDate instanceof Date ? hubState.monthDate : initialMonth;
            const normalized = startOfMonth(current instanceof Date ? current : initialMonth);
            if (!(normalized instanceof Date) || Number.isNaN(normalized.getTime())) {
                return startOfMonth(initialMonth);
            }
            return normalized;
        };
        const setHubMonthDate = (nextDate, options = {}) => {
            const date = nextDate instanceof Date ? nextDate : null;
            if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
            const normalized = startOfMonth(date);
            if (!(normalized instanceof Date) || Number.isNaN(normalized.getTime())) return false;
            hubState.monthDate = normalized;
            if ((options && typeof options === 'object' ? options.close : true) !== false) {
                hubState.editor = '';
            }
            render();
            return true;
        };
        const setHubMonthYear = (yearValue, options = {}) => {
            const year = Math.trunc(Number(yearValue));
            if (!Number.isFinite(year) || year < 1000 || year > 9999) return false;
            const current = getHubMonthDate();
            const next = new Date(year, current.getMonth(), 1, 12, 0, 0, 0);
            if (!(next instanceof Date) || Number.isNaN(next.getTime())) return false;
            return setHubMonthDate(next, options);
        };
        let scheduleText = '';
        let suppressNextDayClick = false;
        let busy = false;
        const popover = document.createElement('div');
        popover.className = `tm-task-detail-inline-popover tm-task-time-hub-popover${draftMode ? ' tm-task-time-hub-popover--draft' : ''}${opts.contextDate === true ? ' tm-task-time-hub-popover--context-date' : ''}`;
        popover.setAttribute('role', 'dialog');
        popover.setAttribute('aria-label', '任务时间中心');
        let lastTriggerRect = null;
        const abort = new AbortController();
        const on = (target, type, handler, opt = {}) => {
            try { target.addEventListener(type, handler, { ...(opt || {}), signal: abort.signal }); } catch (e) {}
        };
        const position = () => {
            if (!popover.isConnected || !(trigger instanceof HTMLElement)) return;
            lastTriggerRect = __tmGetStableTaskTimeHubAnchorRect(trigger, lastTriggerRect);
            const triggerRect = lastTriggerRect;
            if (!triggerRect) return;
            __tmPositionTaskTimeHubPopover(popover, triggerRect, {
                placement: opts.placement,
                minWidth: opts.minWidth,
                maxWidth: opts.maxWidth,
                margin: opts.margin,
                gap: opts.gap,
            });
        };
        const positionEditorPanel = () => {
            const panel = popover.querySelector('[data-tm-time-hub-editor-panel]');
            const card = hubState.editor === 'month'
                ? popover.querySelector('[data-tm-time-hub-month-open]')
                : (hubState.editor ? popover.querySelector(`[data-tm-time-hub-card="${hubState.editor}"]`) : null);
            if (!(panel instanceof HTMLElement) || !(card instanceof HTMLElement)) return;
            if (window.matchMedia && window.matchMedia('(max-width: 640px)').matches) {
                panel.style.left = '';
                panel.style.top = '';
                return;
            }
            const popRect = popover.getBoundingClientRect();
            const baseEl = panel.offsetParent instanceof HTMLElement ? panel.offsetParent : popover;
            const baseRect = baseEl.getBoundingClientRect();
            const cardRect = card.getBoundingClientRect();
            const panelRect = panel.getBoundingClientRect();
            const baseWidth = Math.round(baseRect.width || popRect.width || 0);
            const maxLeft = Math.max(8, baseWidth - panelRect.width - 8);
            const rawLeft = hubState.editor === 'month'
                ? cardRect.left - baseRect.left + (cardRect.width / 2) - (panelRect.width / 2)
                : cardRect.left - baseRect.left;
            const left = Math.max(8, Math.min(maxLeft, Math.round(rawLeft)));
            let top = hubState.editor === 'month'
                ? Math.round(cardRect.bottom - baseRect.top + 4)
                : Math.round(cardRect.top - baseRect.top - panelRect.height - 8);
            if (top < 8) top = Math.round(cardRect.bottom - baseRect.top + 8);
            panel.style.left = `${left}px`;
            panel.style.top = `${top}px`;
        };
        const setBusy = (nextBusy) => {
            busy = !!nextBusy;
            try { popover.classList.toggle('is-busy', busy); } catch (e) {}
        };
        const getTimeFromSchedules = () => {
            const item = Array.isArray(hubState.schedules) ? hubState.schedules.find((it) => it && it.allDay !== true) : null;
            return item ? formatTime(item.start) : '';
        };
        const renderPreviewHtml = () => {
            if (draftMode) return '';
            const dates = __tmCollectTaskRepeatPreviewDates(task || {}, { limit: 4 });
            if (!dates.length) return '';
            return `
                <div class="tm-task-time-hub__preview">
                    <span>下次循环</span>
                    <div>${dates.map((d) => `<span>${esc(__tmFormatTaskDetailShortDate(d, String(d || '')))}</span>`).join('')}</div>
                </div>
            `;
        };
        const renderDateCards = () => {
            const cards = [
                ['startDate', '开始', readTaskDate('startDate')],
                ['completionTime', '截止', readTaskDate('completionTime')],
            ];
            return cards.map(([field, label, value]) => `
                <div class="tm-task-time-hub__date-card ${hubState.activeField === field ? 'is-active' : ''}" role="button" tabindex="0" data-tm-time-hub-date-card="${field}">
                    <span>${esc(label)}</span>
                    <strong>${esc(__tmFormatTaskDetailShortDate(value))}</strong>
                    ${value ? `<button type="button" class="tm-task-time-hub__date-clear" data-tm-time-hub-clear-date="${field}" aria-label="清除${esc(label)}日期">${__tmTaskDetailTimeHubIcon('x', 'tm-task-time-hub__small-icon', 13)}</button>` : ''}
                </div>
            `).join('');
        };
        const renderCalendarHtml = () => {
            const month = getHubMonthDate();
            const firstDay = __tmGetTaskTimeHubCalendarFirstDay();
            const gridStart = __tmGetTaskTimeHubMonthGridStart(month, firstDay);
            const startValue = readTaskDate('startDate');
            const endValue = readTaskDate('completionTime');
            const activeValue = readTaskDate(hubState.activeField);
            const savedRange = startValue && endValue ? sortDateRange(startValue, endValue) : null;
            const dragRange = hubState.rangeDrag ? sortDateRange(hubState.rangeDrag.anchor, hubState.rangeDrag.current) : null;
            const days = [];
            for (let i = 0; i < 42; i += 1) {
                const d = new Date(gridStart.getTime());
                d.setDate(gridStart.getDate() + i);
                const key = toDateKey(d);
                const out = d.getMonth() !== month.getMonth();
                const classes = [
                    'tm-task-time-hub__day',
                    out ? 'is-outside' : '',
                    key === todayKey ? 'is-today' : '',
                    savedRange && isKeyInDateRange(key, savedRange.start, savedRange.end) ? 'is-range' : '',
                    savedRange && key === savedRange.start ? 'is-range-start' : '',
                    savedRange && key === savedRange.end ? 'is-range-end' : '',
                    key === activeValue ? 'is-active' : '',
                    key === startValue ? 'is-start' : '',
                    key === endValue ? 'is-due' : '',
                    dragRange && isKeyInDateRange(key, dragRange.start, dragRange.end) ? 'is-range-preview' : '',
                    dragRange && key === dragRange.start ? 'is-range-start-preview' : '',
                    dragRange && key === dragRange.end ? 'is-range-end-preview' : '',
                ].filter(Boolean).join(' ');
                days.push(`<button type="button" class="${classes}" data-tm-time-hub-date="${esc(key)}">${d.getDate()}</button>`);
            }
            return `
                <div class="tm-task-time-hub__calendar-head">
                    <button type="button" class="tm-task-time-hub__calendar-title${hubState.editor === 'month' ? ' is-active' : ''}" data-tm-time-hub-month-open aria-haspopup="dialog" aria-expanded="${hubState.editor === 'month' ? 'true' : 'false'}" title="选择年月">
                        <strong>${month.getFullYear()}年${month.getMonth() + 1}月</strong>
                    </button>
                    <div class="tm-task-time-hub__month-actions">
                        <button type="button" data-tm-time-hub-month="-1" aria-label="上个月">${__tmTaskDetailTimeHubIcon('chevron-left', 'tm-task-time-hub__small-icon', 14)}</button>
                        <button type="button" data-tm-time-hub-month="0" aria-label="回到本月">今</button>
                        <button type="button" data-tm-time-hub-month="1" aria-label="下个月">${__tmTaskDetailTimeHubIcon('chevron-right', 'tm-task-time-hub__small-icon', 14)}</button>
                    </div>
                </div>
                <div class="tm-task-time-hub__weekdays">
                    ${__tmGetTaskTimeHubWeekdayLabels(firstDay).map((d) => `<span>${d}</span>`).join('')}
                </div>
                <div class="tm-task-time-hub__calendar">${days.join('')}</div>
            `;
        };
        const renderMonthEditorHtml = () => {
            if (hubState.editor !== 'month') return '';
            const month = getHubMonthDate();
            const year = month.getFullYear();
            const currentMonthIndex = month.getMonth();
            const today = new Date();
            const monthLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
            return `<div class="tm-task-time-hub__subpanel tm-task-time-hub__subpanel--month" data-tm-time-hub-editor-panel>
                <div class="tm-task-time-hub__month-year-row">
                    <button type="button" class="tm-task-time-hub__month-step-btn" data-tm-time-hub-year-step="-1" aria-label="上一年">${__tmTaskDetailTimeHubIcon('chevron-left', 'tm-task-time-hub__small-icon', 14)}</button>
                    <input class="tm-input tm-task-time-hub__month-year-input" type="text" inputmode="numeric" autocomplete="off" maxlength="4" value="${esc(String(year))}" aria-label="年份" data-tm-time-hub-year-input>
                    <button type="button" class="tm-task-time-hub__month-step-btn" data-tm-time-hub-year-step="1" aria-label="下一年">${__tmTaskDetailTimeHubIcon('chevron-right', 'tm-task-time-hub__small-icon', 14)}</button>
                </div>
                <div class="tm-task-time-hub__month-grid">
                    ${monthLabels.map((label, index) => `
                        <button type="button" class="tm-task-time-hub__month-btn${index === currentMonthIndex ? ' is-active' : ''}${year === today.getFullYear() && index === today.getMonth() ? ' is-current' : ''}" data-tm-time-hub-month-pick="${index}" aria-label="跳转到${esc(label)}">${esc(label)}</button>
                    `).join('')}
                </div>
            </div>`;
        };
        const renderSettingCards = () => {
            const disabled = hubState.activeField === 'startDate';
            const reminderText = readReminderValue() ? (readReminderDisplayValue() || '已提醒') : '不提醒';
            const repeatText = getRepeatSummary() || '不循环';
            const rule = getRepeatRule();
            const endText = rule?.enabled ? (rule.until ? `至 ${__tmFormatTaskDetailShortDate(rule.until)}` : '永不结束') : '未设置';
            const cards = [];
            if (!hideRepeat) {
                cards.push(['repeat', 'repeat', '循环', repeatText]);
                cards.push(['end', 'calendar-check', '结束', endText]);
            }
            if (!hideReminder) cards.push(['reminder', 'alarm-clock', '提醒', reminderText]);
            if (!cards.length) return '';
            return cards.map(([key, icon, label, value]) => `
                <button type="button" class="tm-task-time-hub__setting ${hubState.editor === key ? 'is-active' : ''} ${disabled ? 'is-disabled' : ''}" data-tm-time-hub-card="${key}"${disabled ? ' disabled aria-disabled="true"' : ''}>
                    <span class="tm-task-time-hub__setting-icon">${__tmTaskDetailTimeHubIcon(icon, 'tm-task-time-hub__icon-svg', 16)}</span>
                    <span class="tm-task-time-hub__setting-text"><span>${esc(label)}</span><strong>${esc(value)}</strong></span>
                </button>
            `).join('');
        };
        const renderScheduleList = () => {
            if (hubState.schedulesLoading) return '<div class="tm-task-time-hub__empty">正在读取日程...</div>';
            const list = Array.isArray(hubState.schedules) ? hubState.schedules : [];
            if (!list.length) return '<div class="tm-task-time-hub__empty">暂无日程</div>';
            const visible = hubState.scheduleExpanded ? list : list.slice(0, 5);
            return visible.map((item) => {
                const id = String(item?.id || '').trim();
                const start = new Date(item?.start);
                const end = new Date(item?.end);
                const isAllDay = item?.allDay === true;
                const dateText = formatScheduleDate(item?.start) || '未定日期';
                const timeText = isAllDay ? '全天' : `${formatTime(start)}${formatTime(end) ? `-${formatTime(end)}` : ''}`;
                const calendarName = String(item?.calendarName || item?.calendarTitle || item?.calendarId || '日程').trim();
                const repeatText = String(item?.repeatText || item?.repeatType || item?.rrule || '').trim();
                const reminderText = item?.reminderMode === 'inherit' ? '跟随任务' : (item?.reminderEnabled === true ? '已提醒' : '不提醒');
                return `
                    <div class="tm-task-time-hub__schedule-item" data-tm-time-hub-schedule-id="${esc(id)}">
                        <div class="tm-task-time-hub__schedule-main">
                            <strong>${esc(dateText)} ${esc(timeText)}</strong>
                            <span>${esc(calendarName)} · ${esc(reminderText)}${repeatText ? ` · ${esc(repeatText)}` : ''}</span>
                        </div>
                        <div class="tm-task-time-hub__schedule-actions">
                            <button type="button" data-tm-time-hub-edit-schedule="${esc(id)}">编辑</button>
                            <button type="button" data-tm-time-hub-delete-schedule="${esc(id)}">删除</button>
                        </div>
                    </div>
                `;
            }).join('');
        };
        const renderEditorHtml = () => {
            const editor = String(hubState.editor || '').trim();
            if (!editor) return '';
            if (editor === 'reminder') {
                if (hideReminder) return '';
                return `<div class="tm-task-time-hub__subpanel" data-tm-time-hub-editor-panel>
                    <div class="tm-task-time-hub__subpanel-title">提醒</div>
                    <button type="button" class="tm-task-time-hub__choice ${!readReminderValue() ? 'is-selected' : ''}" data-tm-time-hub-reminder-open>不提醒</button>
                    <button type="button" class="tm-task-time-hub__choice ${readReminderValue() ? 'is-selected' : ''}" data-tm-time-hub-reminder-open>打开提醒设置</button>
                </div>`;
            }
            if (editor === 'repeat') {
                if (hideRepeat) return '';
                const rule = getRepeatRule();
                const currentType = rule?.enabled ? String(rule.type || 'none') : 'none';
                const currentCalendarMode = (currentType === 'monthly' || currentType === 'yearly')
                    ? (String(rule?.calendarMode || '').trim() === 'lunar' ? 'lunar' : 'solar')
                    : 'solar';
                const currentChoice = currentCalendarMode === 'lunar' && (currentType === 'monthly' || currentType === 'yearly')
                    ? `lunar-${currentType}`
                    : currentType;
                const choices = [['none', '不循环'], ['daily', '每天'], ['workday', '工作日'], ['weekly', '每周'], ['monthly', '每月'], ['yearly', '每年'], ['lunar-monthly', '农历每月'], ['lunar-yearly', '农历每年']];
                return `<div class="tm-task-time-hub__subpanel" data-tm-time-hub-editor-panel>
                    <div class="tm-task-time-hub__subpanel-title">循环</div>
                    ${choices.map(([type, label]) => `<button type="button" class="tm-task-time-hub__choice ${currentChoice === type ? 'is-selected' : ''}" data-tm-time-hub-repeat="${type}">${esc(label)}</button>`).join('')}
                    <button type="button" class="tm-task-time-hub__choice" data-tm-time-hub-repeat-custom>自定义循环</button>
                </div>`;
            }
            if (editor === 'end') {
                if (hideRepeat) return '';
                const rule = getRepeatRule();
                return `<div class="tm-task-time-hub__subpanel" data-tm-time-hub-editor-panel>
                    <div class="tm-task-time-hub__subpanel-title">结束</div>
                    <button type="button" class="tm-task-time-hub__choice ${!rule?.until ? 'is-selected' : ''}" data-tm-time-hub-repeat-until-clear>永不结束</button>
                    <div class="tm-task-time-hub__until-row">
                        <input class="tm-input" type="date" value="${esc(rule?.until || '')}" data-tm-time-hub-repeat-until-input>
                        <button type="button" class="tm-btn tm-btn-primary" data-tm-time-hub-repeat-until-apply>应用</button>
                    </div>
                </div>`;
            }
            return '';
        };
        const render = () => {
            popover.innerHTML = `
                ${draftMode ? '' : `<div class="tm-task-time-hub__top">
                    <div class="tm-task-time-hub__tabs" role="tablist" aria-label="时间中心">
                        <button type="button" class="${hubState.tab === 'date' ? 'is-active' : ''}" data-tm-time-hub-tab="date" role="tab" aria-selected="${hubState.tab === 'date' ? 'true' : 'false'}">日期</button>
                        ${hideSchedule ? '' : `<button type="button" class="${hubState.tab === 'schedule' ? 'is-active' : ''}" data-tm-time-hub-tab="schedule" role="tab" aria-selected="${hubState.tab === 'schedule' ? 'true' : 'false'}">${esc(scheduleTabLabel)}</button>`}
                    </div>
                    <button type="button" class="tm-task-time-hub__close" data-tm-time-hub-close aria-label="关闭">${__tmTaskDetailTimeHubIcon('x', 'tm-task-time-hub__small-icon', 16)}</button>
                </div>`}
                ${hubState.tab === 'date' ? `
                    <div class="tm-task-time-hub__panel tm-task-time-hub__panel--date">
                        <div class="tm-task-time-hub__date-cards">${renderDateCards()}</div>
                        ${__tmRenderTaskTimeHubQuickDatesHtml(readTaskDate(hubState.activeField))}
                        ${renderCalendarHtml()}
                        ${renderMonthEditorHtml()}
                        ${(() => {
                            const settingsHtml = renderSettingCards();
                            return settingsHtml ? `<div class="tm-task-time-hub__settings">${settingsHtml}</div>` : '';
                        })()}
                        ${renderPreviewHtml()}
                        ${renderEditorHtml()}
                    </div>
                ` : `
                    <div class="tm-task-time-hub__panel tm-task-time-hub__panel--schedule">
                        <div class="tm-task-time-hub__schedule-toolbar">
                            <button type="button" class="tm-btn tm-btn-primary" data-tm-time-hub-add-schedule>${__tmTaskDetailTimeHubIcon('plus', 'tm-task-time-hub__small-icon', 14)}新增日程</button>
                            <button type="button" class="tm-btn tm-btn-secondary" data-tm-time-hub-toggle-schedules>${hubState.scheduleExpanded ? '收起' : '展开全部'}</button>
                        </div>
                        <div class="tm-task-time-hub__schedule-list">${renderScheduleList()}</div>
                    </div>
                `}
            `;
            try { trigger.setAttribute('aria-expanded', 'true'); } catch (e) {}
            try { position(); } catch (e) {}
            try {
                requestAnimationFrame(() => {
                    position();
                    positionEditorPanel();
                    requestAnimationFrame(() => {
                        position();
                        positionEditorPanel();
                    });
                });
            } catch (e) {}
        };
        const loadHubSchedules = async (force = false) => {
            if (hideSchedule) return;
            if (hubState.schedulesLoading) return;
            if (hubState.schedulesLoaded && !force) return;
            hubState.schedulesLoading = true;
            if (popover.isConnected) render();
            try {
                let list = [];
                if (globalThis.__tmCalendar && typeof globalThis.__tmCalendar.listTaskSchedulesByTaskId === 'function') {
                    list = await globalThis.__tmCalendar.listTaskSchedulesByTaskId(getEffectiveTaskId() || taskId, { futureOnly: false });
                }
                hubState.schedules = (Array.isArray(list) ? list : []).sort((a, b) => {
                    const ta = new Date(a?.start).getTime();
                    const tb = new Date(b?.start).getTime();
                    return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
                });
                const first = hubState.schedules.find((it) => it?.allDay !== true) || hubState.schedules[0] || null;
                scheduleText = first ? (first.allDay === true ? '全天' : formatTime(first.start)) : '';
                hubState.schedulesLoaded = true;
            } catch (e) {
                hubState.schedules = [];
                scheduleText = '';
            } finally {
                hubState.schedulesLoading = false;
                if (popover.isConnected) render();
            }
        };
        const updateDatePatch = async (patch, source = 'task-time-hub') => {
            if (draftMode) {
                const nextPatch = {};
                if (Object.prototype.hasOwnProperty.call(patch, 'startDate')) nextPatch.startDate = normalizeDate(patch.startDate);
                if (Object.prototype.hasOwnProperty.call(patch, 'completionTime')) nextPatch.completionTime = normalizeDate(patch.completionTime);
                writeTaskDatesLocal(nextPatch);
                await notifyChange(nextPatch, { kind: 'date', draft: true, source });
                return nextPatch;
            }
            if (!window.tmUpdateTaskDates) throw new Error('日期更新接口未就绪');
            const backgroundDateCommit = opts.wait !== true && opts.background !== false;
            if (!backgroundDateCommit) setBusy(true);
            try {
                const result = await window.tmUpdateTaskDates(getEffectiveTaskId() || taskId, patch, {
                    source,
                    refresh: opts.refresh !== false,
                    broadcast: opts.broadcast !== false,
                    skipNoopCheck: opts.skipNoopCheck === true,
                    background: backgroundDateCommit,
                });
                const nextPatch = {
                    startDate: normalizeDate(result?.startDate ?? (Object.prototype.hasOwnProperty.call(patch, 'startDate') ? patch.startDate : readTaskDate('startDate'))),
                    completionTime: normalizeDate(result?.completionTime ?? (Object.prototype.hasOwnProperty.call(patch, 'completionTime') ? patch.completionTime : readTaskDate('completionTime'))),
                };
                writeTaskDatesLocal(nextPatch);
                await notifyChange(nextPatch, { kind: 'date' });
                return nextPatch;
            } finally {
                if (!backgroundDateCommit) setBusy(false);
            }
        };
        const updateDateField = async (field, value) => {
            const key = value ? normalizeDate(value) : '';
            await updateDatePatch({ [field]: key }, 'task-time-hub-date');
            render();
        };
        const updateDateRange = async (left, right) => {
            const range = sortDateRange(left, right);
            await updateDatePatch({ startDate: range.start, completionTime: range.end }, 'task-time-hub-range');
            hubState.activeField = 'completionTime';
            render();
        };
        const applyRepeatType = async (type) => {
            if (hideRepeat) return;
            const rawType = String(type || '').trim();
            const nextType = rawType === 'lunar-monthly' ? 'monthly' : (rawType === 'lunar-yearly' ? 'yearly' : rawType);
            const nextCalendarMode = (rawType === 'lunar-monthly' || rawType === 'lunar-yearly') ? 'lunar' : 'solar';
            try {
                setBusy(true);
                if (!nextType || nextType === 'none') {
                    await window.tmClearTaskRepeatRule?.(getEffectiveTaskId() || taskId, { source: 'task-time-hub' });
                } else {
                    const current = getRepeatRule();
                    const anchorDate = readTaskDate('completionTime') || readTaskDate('startDate') || todayKey;
                    await window.tmSetTaskRepeatRule?.(getEffectiveTaskId() || taskId, {
                        ...current,
                        enabled: true,
                        type: nextType,
                        calendarMode: nextCalendarMode,
                        every: current?.type === nextType && (String(current?.calendarMode || '').trim() || 'solar') === nextCalendarMode ? current.every : 1,
                        anchorDate,
                        trigger: current?.trigger || 'due',
                    }, { source: 'task-time-hub' });
                }
                await refreshTask();
                await notifyChange({}, { kind: 'repeat' });
                hubState.editor = '';
                render();
            } catch (e) {
                hint(`❌ 循环更新失败: ${e.message}`, 'error');
            } finally {
                setBusy(false);
            }
        };
        const applyRepeatUntil = async (untilValue) => {
            if (hideRepeat) return;
            const current = getRepeatRule();
            if (!current?.enabled || current.type === 'none') {
                hint('⚠ 请先设置循环规则', 'warning');
                return;
            }
            try {
                setBusy(true);
                await window.tmSetTaskRepeatRule?.(getEffectiveTaskId() || taskId, {
                    ...current,
                    until: untilValue ? normalizeDate(untilValue) : '',
                    anchorDate: readTaskDate('completionTime') || readTaskDate('startDate') || todayKey,
                }, { source: 'task-time-hub-until' });
                await refreshTask();
                await notifyChange({}, { kind: 'repeat' });
                hubState.editor = '';
                render();
            } catch (e) {
                hint(`❌ 结束规则更新失败: ${e.message}`, 'error');
            } finally {
                setBusy(false);
            }
        };
        const openScheduleEditorFromHub = async () => {
            if (hideSchedule) return;
            const dateKey = readTaskDate('completionTime') || readTaskDate('startDate') || todayKey;
            const timeKey = getTimeFromSchedules() || '09:00';
            const start = makeDateTime(dateKey, timeKey);
            const end = new Date(start.getTime() + 60 * 60000);
            if (globalThis.__tmCalendar && typeof globalThis.__tmCalendar.openScheduleEditor === 'function') {
                await globalThis.__tmCalendar.openScheduleEditor({
                    taskId: getEffectiveTaskId() || taskId,
                    title: getTaskTitle(),
                    start: start.toISOString(),
                    end: end.toISOString(),
                    startDate: readTaskDate('startDate'),
                    completionTime: readTaskDate('completionTime'),
                    forceNew: true,
                });
                await loadHubSchedules(true);
            } else {
                hint('⚠ 日历模块未就绪', 'warning');
            }
        };

        document.body.appendChild(popover);
        const unstack = typeof __tmModalStackBind === 'function'
            ? __tmModalStackBind(() => __tmCloseStandaloneTaskTimeHub('escape-stack'))
            : null;
        __tmStandaloneTaskTimeHub = { popover, trigger, abort, unstack, onClose: typeof opts.onClose === 'function' ? opts.onClose : null };
        try { trigger.classList.add('is-open'); } catch (e) {}
        render();
        try { __tmAnimatePopupIn(popover, { origin: 'top-left', duration: 150 }); } catch (e) {}
        void loadHubSchedules(false);

        on(popover, 'click', async (ev) => {
            const target = ev.target instanceof Element ? ev.target : null;
            if (!target || busy) return;
            const monthOpenBtn = target.closest('[data-tm-time-hub-month-open]');
            if (monthOpenBtn) {
                try { ev.preventDefault(); } catch (e) {}
                hubState.editor = hubState.editor === 'month' ? '' : 'month';
                render();
                return;
            }
            if (__tmShouldDismissTaskTimeHubEditor(popover, hubState.editor, target)) {
                hubState.editor = '';
                render();
            }
            const closeBtn = target.closest('[data-tm-time-hub-close]');
            if (closeBtn) {
                try { ev.preventDefault(); } catch (e) {}
                __tmCloseStandaloneTaskTimeHub('close-button');
                return;
            }
            const tabBtn = target.closest('[data-tm-time-hub-tab]');
            if (tabBtn) {
                try { ev.preventDefault(); } catch (e) {}
                hubState.tab = String(tabBtn.getAttribute('data-tm-time-hub-tab') || 'date').trim() === 'schedule' ? 'schedule' : 'date';
                hubState.editor = '';
                render();
                if (hubState.tab === 'schedule') void loadHubSchedules(false);
                return;
            }
            const clearBtn = target.closest('[data-tm-time-hub-clear-date]');
            if (clearBtn) {
                try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {}
                const field = String(clearBtn.getAttribute('data-tm-time-hub-clear-date') || '').trim();
                if (field === 'startDate' || field === 'completionTime') await updateDateField(field, '');
                return;
            }
            const quickDateBtn = target.closest('[data-tm-time-hub-quick-date]');
            if (quickDateBtn) {
                try { ev.preventDefault(); } catch (e) {}
                if (quickDateBtn.disabled || quickDateBtn.getAttribute('aria-disabled') === 'true') return;
                const key = normalizeDate(quickDateBtn.getAttribute('data-tm-time-hub-quick-date') || '');
                if (key) await updateDateField(hubState.activeField, key);
                return;
            }
            const monthStepBtn = target.closest('[data-tm-time-hub-year-step]');
            if (monthStepBtn) {
                try { ev.preventDefault(); } catch (e) {}
                const delta = Number(monthStepBtn.getAttribute('data-tm-time-hub-year-step') || 0);
                const current = getHubMonthDate();
                const nextYear = Math.max(1000, Math.min(9999, current.getFullYear() + (delta || 0)));
                setHubMonthYear(nextYear, { close: false });
                return;
            }
            const monthPickBtn = target.closest('[data-tm-time-hub-month-pick]');
            if (monthPickBtn) {
                try { ev.preventDefault(); } catch (e) {}
                const monthIndex = Number(monthPickBtn.getAttribute('data-tm-time-hub-month-pick') || 0);
                if (Number.isFinite(monthIndex) && monthIndex >= 0 && monthIndex <= 11) {
                    const current = getHubMonthDate();
                    setHubMonthDate(new Date(current.getFullYear(), monthIndex, 1, 12, 0, 0, 0));
                }
                return;
            }
            const dateCard = target.closest('[data-tm-time-hub-date-card]');
            if (dateCard) {
                try { ev.preventDefault(); } catch (e) {}
                const field = String(dateCard.getAttribute('data-tm-time-hub-date-card') || '').trim();
                if (field === 'startDate' || field === 'completionTime') {
                    hubState.activeField = field;
                    hubState.editor = '';
                    render();
                }
                return;
            }
            const monthBtn = target.closest('[data-tm-time-hub-month]');
            if (monthBtn) {
                try { ev.preventDefault(); } catch (e) {}
                const delta = Number(monthBtn.getAttribute('data-tm-time-hub-month') || 0);
                hubState.monthDate = delta === 0 ? startOfMonth(parseDateKey(todayKey) || new Date()) : shiftMonth(getHubMonthDate(), delta);
                render();
                return;
            }
            const dayBtn = target.closest('[data-tm-time-hub-date]');
            if (dayBtn) {
                try { ev.preventDefault(); } catch (e) {}
                if (suppressNextDayClick) {
                    suppressNextDayClick = false;
                    return;
                }
                const key = normalizeDate(dayBtn.getAttribute('data-tm-time-hub-date') || '');
                if (key) await updateDateField(hubState.activeField, key);
                return;
            }
            const cardBtn = target.closest('[data-tm-time-hub-card]');
            if (cardBtn) {
                try { ev.preventDefault(); } catch (e) {}
                if (cardBtn.disabled || cardBtn.getAttribute('aria-disabled') === 'true') return;
                const key = String(cardBtn.getAttribute('data-tm-time-hub-card') || '').trim();
                if (key === 'reminder') {
                    try { await window.tmReminder?.(getEffectiveTaskId() || taskId); } finally {
                        await refreshTask();
                        await notifyChange({}, { kind: 'reminder' });
                        render();
                    }
                    return;
                }
                hubState.editor = hubState.editor === key ? '' : key;
                render();
                return;
            }
            const reminderBtn = target.closest('[data-tm-time-hub-reminder-open]');
            if (reminderBtn) {
                try { ev.preventDefault(); } catch (e) {}
                try { await window.tmReminder?.(getEffectiveTaskId() || taskId); } finally {
                    await refreshTask();
                    await notifyChange({}, { kind: 'reminder' });
                    render();
                }
                return;
            }
            const repeatBtn = target.closest('[data-tm-time-hub-repeat]');
            if (repeatBtn) {
                try { ev.preventDefault(); } catch (e) {}
                await applyRepeatType(repeatBtn.getAttribute('data-tm-time-hub-repeat'));
                return;
            }
            const customRepeatBtn = target.closest('[data-tm-time-hub-repeat-custom]');
            if (customRepeatBtn) {
                try { ev.preventDefault(); } catch (e) {}
                const result = await window.tmEditTaskRepeatRule?.(getEffectiveTaskId() || taskId, { task, title: '循环设置' });
                if (result) {
                    await refreshTask();
                    await notifyChange({}, { kind: 'repeat' });
                    render();
                }
                return;
            }
            const untilClearBtn = target.closest('[data-tm-time-hub-repeat-until-clear]');
            if (untilClearBtn) {
                try { ev.preventDefault(); } catch (e) {}
                await applyRepeatUntil('');
                return;
            }
            const untilApplyBtn = target.closest('[data-tm-time-hub-repeat-until-apply]');
            if (untilApplyBtn) {
                try { ev.preventDefault(); } catch (e) {}
                const input = popover.querySelector('[data-tm-time-hub-repeat-until-input]');
                await applyRepeatUntil(input instanceof HTMLInputElement ? input.value : '');
                return;
            }
            const addScheduleBtn = target.closest('[data-tm-time-hub-add-schedule]');
            if (addScheduleBtn) {
                try { ev.preventDefault(); } catch (e) {}
                await openScheduleEditorFromHub();
                return;
            }
            const toggleSchedulesBtn = target.closest('[data-tm-time-hub-toggle-schedules]');
            if (toggleSchedulesBtn) {
                try { ev.preventDefault(); } catch (e) {}
                hubState.scheduleExpanded = !hubState.scheduleExpanded;
                render();
                return;
            }
            const editScheduleBtn = target.closest('[data-tm-time-hub-edit-schedule]');
            if (editScheduleBtn) {
                try { ev.preventDefault(); } catch (e) {}
                const sid = String(editScheduleBtn.getAttribute('data-tm-time-hub-edit-schedule') || '').trim();
                if (sid && globalThis.__tmCalendar?.openScheduleEditorById) await globalThis.__tmCalendar.openScheduleEditorById(sid);
                return;
            }
            const deleteScheduleBtn = target.closest('[data-tm-time-hub-delete-schedule]');
            if (deleteScheduleBtn) {
                try { ev.preventDefault(); } catch (e) {}
                const sid = String(deleteScheduleBtn.getAttribute('data-tm-time-hub-delete-schedule') || '').trim();
                if (sid && globalThis.__tmCalendar?.deleteScheduleById) {
                    await globalThis.__tmCalendar.deleteScheduleById(sid, { closeModal: false });
                    await loadHubSchedules(true);
                }
            }
        });
        on(popover, 'input', (ev) => {
            const target = ev.target instanceof Element ? ev.target : null;
            const input = target?.closest?.('[data-tm-time-hub-year-input]');
            if (!(input instanceof HTMLInputElement)) return;
            const raw = String(input.value || '').trim();
            if (/^\d{4}$/.test(raw)) {
                setHubMonthYear(raw, { close: false });
            }
        });
        on(popover, 'focusout', (ev) => {
            const target = ev.target instanceof Element ? ev.target : null;
            const input = target?.closest?.('[data-tm-time-hub-year-input]');
            if (!(input instanceof HTMLInputElement)) return;
            const raw = String(input.value || '').trim();
            if (/^\d{4}$/.test(raw)) return;
            input.value = String(getHubMonthDate().getFullYear());
        });
        on(popover, 'pointerdown', (ev) => {
            const target = ev.target instanceof Element ? ev.target : null;
            const dayBtn = target?.closest?.('[data-tm-time-hub-date]');
            if (!(dayBtn instanceof HTMLElement)) return;
            const key = normalizeDate(dayBtn.getAttribute('data-tm-time-hub-date') || '');
            if (!key) return;
            if (ev.button != null && ev.button !== 0) return;
            hubState.rangeDrag = { anchor: key, current: key, moved: false };
            suppressNextDayClick = false;
            try { dayBtn.setPointerCapture?.(ev.pointerId); } catch (e) {}
        });
        on(popover, 'pointermove', (ev) => {
            if (!hubState.rangeDrag) return;
            const hit = document.elementFromPoint(Number(ev.clientX) || 0, Number(ev.clientY) || 0);
            const dayBtn = hit instanceof Element ? hit.closest('[data-tm-time-hub-date]') : null;
            if (!(dayBtn instanceof HTMLElement)) return;
            const key = normalizeDate(dayBtn.getAttribute('data-tm-time-hub-date') || '');
            if (!key || key === hubState.rangeDrag.current) return;
            hubState.rangeDrag = { ...hubState.rangeDrag, current: key, moved: key !== hubState.rangeDrag.anchor };
            render();
        });
        on(window, 'pointerup', async () => {
            const drag = hubState.rangeDrag;
            if (!drag || busy) return;
            hubState.rangeDrag = null;
            suppressNextDayClick = true;
            try { setTimeout(() => { suppressNextDayClick = false; }, 250); } catch (e) {}
            if (!drag.moved) await updateDateField(hubState.activeField, drag.anchor);
            else await updateDateRange(drag.anchor, drag.current);
        });
        on(popover, 'keydown', async (ev) => {
            const target = ev.target instanceof Element ? ev.target : null;
            if (String(ev.key || '') !== 'Enter') return;
            const yearInput = target?.closest?.('[data-tm-time-hub-year-input]');
            if (yearInput instanceof HTMLInputElement) {
                try { ev.preventDefault(); } catch (e) {}
                const raw = String(yearInput.value || '').trim();
                if (/^\d{4}$/.test(raw)) {
                    setHubMonthYear(raw, { close: false });
                } else {
                    yearInput.value = String(getHubMonthDate().getFullYear());
                }
                return;
            }
            const card = target?.closest?.('[data-tm-time-hub-date-card]');
            if (card) {
                try { ev.preventDefault(); } catch (e) {}
                card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }
        });
        on(document, 'pointerdown', (ev) => {
            const target = ev.target;
            if (target instanceof Node) {
                if (popover.contains(target)) return;
                if (trigger.contains(target)) return;
            }
            if (busy) {
                try { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation(); } catch (e) {}
                return;
            }
            __tmCloseStandaloneTaskTimeHub('outside');
        }, { capture: true });
        on(document, 'keydown', (ev) => {
            if (ev.key === 'Escape') __tmCloseStandaloneTaskTimeHub('escape');
        });
        on(window, 'resize', () => {
            position();
            positionEditorPanel();
        }, { capture: true });
        on(window, 'scroll', (ev) => {
            const target = ev?.target;
            if (target instanceof Node && popover.contains(target)) return;
            position();
            positionEditorPanel();
        }, { capture: true });
        on(window, 'tm:calendar-schedule-updated', () => {
            void loadHubSchedules(true);
        });
        return popover;
    }

    window.tmOpenTaskTimeHub = async function(taskIdOrBlockId, anchorOrEvent = null, options = {}) {
        return await __tmOpenStandaloneTaskTimeHub(taskIdOrBlockId, anchorOrEvent, options);
    };

    function __tmBuildTaskDetailWhiteboardOutlineChipHtml(model, detailTip, options = {}) {
        const item = (model && typeof model === 'object') ? model : null;
        if (!item || !Array.isArray(item.nodes) || !item.nodes.length) return '';
        const tip = typeof detailTip === 'function'
            ? detailTip
            : (label, tipOpts = {}) => __tmBuildTooltipAttrs(label, {
                side: 'bottom',
                ...((tipOpts && typeof tipOpts === 'object') ? tipOpts : {}),
            });
        const total = Math.max(0, Number(item.stats?.total || item.nodes.length) || 0);
        const done = Math.max(0, Math.min(total, Number(item.stats?.done || 0) || 0));
        const outlineLabel = '\u767d\u677f\u8def\u5f84';
        const doneLabel = '\u5df2\u5b8c\u6210';
        const open = !!(options && typeof options === 'object' && options.open === true);
        const label = total ? `${done}/${total}` : '';
        return `
            <button type="button"
                class="bc-btn bc-btn--sm tm-task-detail-core-chip tm-task-detail-core-chip--whiteboard-outline ${open ? 'is-open' : ''}"
                data-tm-detail-whiteboard-outline-toggle
                aria-haspopup="dialog"
                aria-expanded="${open ? 'true' : 'false'}"
                ${tip(total ? `${outlineLabel}: ${doneLabel} ${done}/${total}` : outlineLabel, { ariaLabel: false })}>
                <span class="tm-task-detail-core-chip__face" data-tm-detail-whiteboard-outline-toggle-face>
                    ${__tmRenderTaskDetailPhosphorIcon('target', 16)}
                    ${label ? `<span class="tm-task-detail-core-chip__text">${esc(label)}</span>` : ''}
                </span>
            </button>
        `;
    }

    function __tmBuildTaskDetailWhiteboardOutlineNodeHtml(node, detailTip) {
        const item = (node && typeof node === 'object') ? node : null;
        if (!item) return '';
        const id = String(item.id || '').trim();
        const docId = String(item.docId || '').trim();
        if (!id || !docId) return '';
        const tip = typeof detailTip === 'function'
            ? detailTip
            : (label, tipOpts = {}) => __tmBuildTooltipAttrs(label, {
                side: 'bottom',
                ...((tipOpts && typeof tipOpts === 'object') ? tipOpts : {}),
            });
        const title = String(item.title || '\u4efb\u52a1').trim() || '\u4efb\u52a1';
        const x = Number(item.x) || 0;
        const y = Number(item.y) || 0;
        const w = Math.max(72, Number(item.w) || 156);
        const h = Math.max(24, Number(item.h) || 32);
        const classes = [
            'tm-task-detail-whiteboard-outline-node',
            item.done ? 'is-done' : '',
            item.current ? 'is-current' : '',
            item.next ? 'is-next' : '',
        ].filter(Boolean).join(' ');
        const checkboxHtml = __tmRenderTaskCheckbox(id, item, {
            checked: !!item.done,
            disabled: item.snapshot === true,
            stopMouseDown: true,
            stopPointerDown: true,
            stopClick: true,
            title: item.snapshot === true ? '\u5feb\u7167\u4efb\u52a1\uff0c\u5f53\u524d\u4e0d\u53ef\u76f4\u63a5\u52fe\u9009' : '\u5b8c\u6210\u72b6\u6001',
            onchange: "this.dispatchEvent(new CustomEvent('tm-outline-done-change', { bubbles: true, detail: { checked: this.checked } }))",
        });
        return `
            <div
                class="${esc(classes)}"
                role="button"
                tabindex="0"
                data-tm-detail-whiteboard-outline-node
                data-task-id="${esc(id)}"
                data-doc-id="${esc(docId)}"
                aria-label="${esc(`\u8df3\u8f6c\u81f3\u767d\u677f:${title}`)}"
                style="left:${x.toFixed(2)}px;top:${y.toFixed(2)}px;width:${w.toFixed(2)}px;height:${h.toFixed(2)}px;"
                ${tip(title, { ariaLabel: false })}>
                <span class="tm-task-detail-whiteboard-outline-node__check" data-tm-detail-whiteboard-outline-check onpointerdown="event.stopPropagation()" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()">${checkboxHtml}</span>
                <span class="tm-task-detail-whiteboard-outline-node__title">${esc(title)}</span>
            </div>
        `;
    }

    function __tmBuildTaskDetailWhiteboardOutlineBodyHtml(model, detailTip) {
        const item = (model && typeof model === 'object') ? model : null;
        if (!item || !Array.isArray(item.nodes) || !item.nodes.length) return '';
        const width = Math.max(160, Math.ceil(Number(item.width) || 0));
        const height = Math.max(80, Math.ceil(Number(item.height) || 0));
        const edgesHtml = (Array.isArray(item.edges) ? item.edges : []).map((edge) => {
            const d = String(edge?.d || '').trim();
            if (!d) return '';
            return `<path class="tm-task-detail-whiteboard-outline-edge" d="${esc(d)}" data-from="${esc(String(edge.from || '').trim())}" data-to="${esc(String(edge.to || '').trim())}"></path>`;
        }).join('');
        const nodesHtml = item.nodes.map((node) => __tmBuildTaskDetailWhiteboardOutlineNodeHtml(node, detailTip)).join('');
        return `
            <div class="tm-task-detail-whiteboard-outline-scroll" data-tm-detail-whiteboard-outline-scroll>
                <div class="tm-task-detail-whiteboard-outline-map" data-doc-id="${esc(String(item.docId || '').trim())}" style="width:${width}px;height:${height}px;">
                    <svg class="tm-task-detail-whiteboard-outline-edges" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">
                        ${edgesHtml}
                    </svg>
                    <div class="tm-task-detail-whiteboard-outline-nodes">${nodesHtml}</div>
                </div>
            </div>
        `;
    }

    function __tmBuildTaskDetailWhiteboardOutlineScopeSelectHtml(options, activeScope) {
        const items = Array.isArray(options) ? options : [];
        if (items.length <= 1) return '';
        const current = String(activeScope || '').trim();
        const currentItem = items.find((item) => String(item?.value || '').trim() === current) || items[0] || {};
        const currentLabel = String(currentItem?.label || currentItem?.value || current || '').trim();
        return `
            <div class="tm-task-detail-whiteboard-outline-scope-select" data-tm-detail-whiteboard-outline-scope-select data-value="${esc(current)}">
                <button type="button" class="bc-btn bc-btn--sm tm-task-detail-whiteboard-outline-scope-trigger" data-tm-detail-whiteboard-outline-scope-trigger aria-haspopup="listbox" aria-expanded="false" title="切换白板路径">
                    <span class="tm-task-detail-whiteboard-outline-scope-trigger__label" data-tm-detail-whiteboard-outline-scope-label>${esc(currentLabel)}</span>
                    <span class="tm-task-detail-whiteboard-outline-scope-trigger__chevron" aria-hidden="true">${__tmRenderLucideIcon('caret-down', '', { size: 12 })}</span>
                </button>
                <div class="bc-select-menu tm-task-detail-whiteboard-outline-scope-menu" data-tm-detail-whiteboard-outline-scope-menu role="listbox" aria-label="切换白板路径" hidden>
                    ${items.map((item) => {
                    const value = String(item?.value || '').trim();
                    const label = String(item?.label || value).trim();
                    if (!value) return '';
                    const selected = value === current;
                    return `<button class="bc-select-option tm-task-detail-whiteboard-outline-scope-option ${selected ? 'is-selected' : ''}" type="button" role="option" aria-selected="${selected ? 'true' : 'false'}" data-tm-detail-whiteboard-outline-scope-option data-value="${esc(value)}" data-label="${esc(label)}"><span>${esc(label)}</span><span class="bc-select-option__check" aria-hidden="true">✓</span></button>`;
                }).join('')}
                </div>
            </div>
        `;
    }

    function __tmBuildTaskDetailWhiteboardOutlineHtml(model, detailTip, options = {}) {
        const item = (model && typeof model === 'object') ? model : null;
        if (!item || !Array.isArray(item.nodes) || !item.nodes.length) return '';
        const opts = (options && typeof options === 'object') ? options : {};
        const total = Math.max(0, Number(item.stats?.total || item.nodes.length) || 0);
        const done = Math.max(0, Math.min(total, Number(item.stats?.done || 0) || 0));
        const outlineLabel = '\u767d\u677f\u8def\u5f84';
        const activeScope = String(item.scope || item.location?.scope || '').trim() || 'board';
        const scopeSelectHtml = __tmBuildTaskDetailWhiteboardOutlineScopeSelectHtml(opts.scopeOptions, activeScope);
        return `
            <div class="tm-task-detail-whiteboard-outline" data-tm-detail-whiteboard-outline-section>
                <div class="tm-task-detail-section-head">
                    <div class="tm-task-detail-section-title">${esc(outlineLabel)}</div>
                    <div class="tm-task-detail-section-tools">
                        ${scopeSelectHtml}
                        <span class="tm-task-detail-section-count" data-tm-detail-whiteboard-outline-count>${esc(`${done}/${total}`)}</span>
                    </div>
                </div>
                ${__tmBuildTaskDetailWhiteboardOutlineBodyHtml(item, detailTip)}
            </div>
        `;
    }

    function __tmSyncTaskDetailWhiteboardOutlineSection(root, task, detailTip, options = {}) {
        const panel = root instanceof HTMLElement ? root : null;
        const tid = String(task?.id || panel?.dataset?.tmDetailTaskId || panel?.__tmTaskDetailTaskId || '').trim();
        if (!panel || !tid) return false;
        const existingChip = panel.querySelector('[data-tm-detail-whiteboard-outline-toggle]');
        const open = !!(options && typeof options === 'object' && options.open === true);
        const model = (typeof __tmBuildWhiteboardTaskOutlineModel === 'function')
            ? __tmBuildWhiteboardTaskOutlineModel(tid)
            : null;
        if (!model) {
            try { existingChip?.remove?.(); } catch (e) {}
            return false;
        }
        const chipHtml = __tmBuildTaskDetailWhiteboardOutlineChipHtml(model, detailTip, { open });
        if (existingChip instanceof HTMLElement) {
            const wrap = document.createElement('div');
            wrap.innerHTML = chipHtml.trim();
            const nextChip = wrap.firstElementChild;
            if (nextChip instanceof HTMLElement) {
                try { Array.from(existingChip.attributes).forEach((attr) => existingChip.removeAttribute(attr.name)); } catch (e) {}
                try { Array.from(nextChip.attributes).forEach((attr) => existingChip.setAttribute(attr.name, attr.value)); } catch (e) {}
                existingChip.innerHTML = nextChip.innerHTML;
            } else existingChip.outerHTML = chipHtml;
        }
        else {
            const coreMeta = panel.querySelector('.tm-task-detail-core-meta');
            const focusSummaryBtn = panel.querySelector('[data-tm-detail-focus-summary-trigger]');
            if (focusSummaryBtn instanceof HTMLElement && chipHtml) focusSummaryBtn.insertAdjacentHTML('afterend', chipHtml);
            else if (coreMeta instanceof HTMLElement && chipHtml) coreMeta.insertAdjacentHTML('beforeend', chipHtml);
        }
        return true;
    }

    function __tmBuildTaskDetailInnerHtml(task, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const embedded = !!opts.embedded;
        const floating = !!opts.floating;
        const closeable = !!opts.closeable;
        const circleCheckboxClass = SettingsStore.data.taskCheckboxCircleStyleEnabled === true
            ? ' tm-task-detail--task-checkbox-circle'
            : '';
        const useCompactHeaderActions = embedded;
        const detailTip = (label, tipOpts = {}) => __tmBuildTooltipAttrs(label, {
            side: 'bottom',
            ...((tipOpts && typeof tipOpts === 'object') ? tipOpts : {})
        });
        const isOtherBlock = __tmIsCollectedOtherBlockTask(task);
        const statusOptions = __tmGetTaskDetailStatusOptions();
        const curStatus = __tmResolveTaskStatusId(task, statusOptions);
        const curStatusOption = statusOptions.find((o) => o.id === curStatus) || { id: curStatus, name: curStatus || '待办', color: '#757575' };
        const curPriority = String(task?.priority || '').trim().toLowerCase();
        const curPinned = !!task?.pinned;
        const tomatoEnabled = !!SettingsStore.data.enableTomatoIntegration;
        const curReminderSnapshot = tomatoEnabled ? __tmPeekTaskReminderSnapshotByAnyId(task) : null;
        const curHasReminder = tomatoEnabled && (curReminderSnapshot?.hasReminder === true || __tmHasReminderMark(task));
        const curReminderText = curHasReminder ? String(curReminderSnapshot?.displayText || '').trim() : '';
        const taskStartDateValue = String(task?.startDate || task?.start_date || '').trim();
        const taskCompletionTimeValue = String(task?.completionTime || task?.completion_time || '').trim();
        const curRepeatRule = __tmGetTaskRepeatRule(task);
        const curRepeatSummary = __tmGetTaskRepeatSummary(curRepeatRule, {
            startDate: taskStartDateValue,
            completionTime: taskCompletionTimeValue,
        });
        const timeHubOptions = {
            startDate: taskStartDateValue,
            completionTime: taskCompletionTimeValue,
            hasReminder: curHasReminder,
            reminderText: curReminderText,
            repeatSummary: curRepeatSummary,
        };
        const timeHubHasValue = __tmTaskDetailTimeHubHasValue(task, timeHubOptions);
        const timeHubTip = __tmGetTaskDetailTimeHubLabel(task, timeHubOptions);
        const startValue = __tmNormalizeDateOnly(taskStartDateValue);
        const endValue = __tmNormalizeDateOnly(taskCompletionTimeValue);
        const durationValue = String(task?.duration || '').trim();
        const tomatoEstimateValue = __tmGetTaskTomatoEstimateCount(task);
        const focusSummaryValue = __tmGetTaskTomatoSummaryText(task);
        const remarkValue = __tmNormalizeRemarkMarkdown(__tmGetTaskDetailRemarkRaw(task));
        const whiteboardOutlineTaskId = String(task?.id || '').trim();
        const whiteboardOutlineModel = (typeof __tmBuildWhiteboardTaskOutlineModel === 'function')
            ? __tmBuildWhiteboardTaskOutlineModel(whiteboardOutlineTaskId)
            : null;
        const whiteboardOutlineChipHtml = whiteboardOutlineModel
            ? __tmBuildTaskDetailWhiteboardOutlineChipHtml(whiteboardOutlineModel, detailTip, { open: false })
            : '';
        const cleanDetailTitle = (value, fallback = '') => {
            const stripTaskSyntax = (input) => String(input || '')
                .replace(/^[\s>*]*(?:(?:[-*+]|\d+[.)])\s*)?\[[^\]]?\]\s*/, '')
                .replace(/\r?\n+/g, ' ')
                .replace(/\s{2,}/g, ' ')
                .trim();
            let text = String(value || fallback || '').trim();
            if (!text) return '';
            try {
                if (typeof API?.extractTaskContentLine === 'function') {
                    text = String(API.extractTaskContentLine(text) || text).trim();
                } else {
                    text = String(text.split(/\r?\n/)[0] || text).trim();
                }
            } catch (e) {}
            try {
                if (typeof API?.normalizeTaskContent === 'function') {
                    text = String(API.normalizeTaskContent(text) || text).trim();
                }
            } catch (e) {}
            text = stripTaskSyntax(text);
            return text || stripTaskSyntax(fallback);
        };
        const titleValue = (() => {
            if (isOtherBlock) {
                const raw = String(task?.otherBlockRawContent || task?.content || '').trim();
                return cleanDetailTitle(raw, raw);
            }
            const parsedContent = String(API.parseTaskStatus(String(task?.markdown || '')).content || '').trim();
            if (parsedContent) return cleanDetailTitle(parsedContent, parsedContent);
            const fallback = String(task?.content || '').trim();
            return cleanDetailTitle(fallback, fallback);
        })();
        const docName = String(task?.docName || task?.doc_name || '').trim();
        const docId = String(task?.root_id || task?.docId || '').trim();
        const headingName = __tmNormalizeHeadingText(task?.h2 || task?.h2Name);
        const showHeadingLocation = !!isOtherBlock
            || __tmDocHasAnyHeading(docId);
        const children = Array.isArray(task?.children) ? task.children : [];
        const completedChildren = children.filter((child) => child?.done).length;
        const customFieldDefs = __tmGetCustomFieldDefs();
        const visibleColumnOrder = Array.isArray(SettingsStore?.data?.columnOrder)
            ? SettingsStore.data.columnOrder
            : __tmGetDefaultColumnOrder();
        const visibleColumnSet = new Set(
            (Array.isArray(visibleColumnOrder) ? visibleColumnOrder : [])
                .map((key) => String(key || '').trim())
                .filter(Boolean)
        );
        const visibleCustomFieldDefs = customFieldDefs.filter((field) => {
            const colKey = __tmBuildCustomFieldColumnKey(field?.id);
            return !!colKey && visibleColumnSet.has(colKey);
        });
        const visibleOptionCustomFieldDefs = visibleCustomFieldDefs.filter((field) => String(field?.type || '').trim() !== 'text');
        const visibleTextCustomFieldDefs = visibleCustomFieldDefs.filter((field) => String(field?.type || '').trim() === 'text');
        const priorityOptions = [
            { value: '', label: '无' },
            { value: 'low', label: '低' },
            { value: 'medium', label: '中' },
            { value: 'high', label: '高' },
        ];
        const customFieldsHtml = visibleOptionCustomFieldDefs.length
            ? `
                <div class="tm-task-detail-custom-fields">
                    ${visibleOptionCustomFieldDefs.map((field) => {
                        const fieldId = String(field?.id || '').trim();
                        if (!fieldId) return '';
                        return `
                            <div class="tm-task-detail-custom-field">
                                <span class="tm-task-detail-custom-field-label">${esc(String(field?.name || fieldId).trim() || fieldId)}</span>
                                <button type="button" class="tm-task-detail-custom-field-btn" data-tm-custom-field-anchor data-tm-detail-custom-field="${esc(fieldId)}">
                                    <span class="tm-task-detail-custom-field-value">${__tmBuildCustomFieldDisplayHtml(field, __tmGetTaskCustomFieldValue(task, fieldId), { emptyText: '未设置', maxTags: String(field?.type || '').trim() === 'multi' ? 3 : 1 })}</span>
                                </button>
                            </div>
                        `;
                    }).join('')}
                </div>
            `
            : '';
        const textCustomFieldsHtml = visibleTextCustomFieldDefs.map((field) => {
            const fieldId = String(field?.id || '').trim();
            if (!fieldId) return '';
            const fieldName = String(field?.name || fieldId).trim() || fieldId;
            const fieldValue = String(__tmNormalizeCustomFieldValue(field, __tmGetTaskCustomFieldValue(task, fieldId)) || '').trim();
            return `
                <section class="tm-task-detail-section">
                    <div class="tm-task-detail-section-head">
                        <div class="tm-task-detail-section-title">${esc(fieldName)}</div>
                    </div>
                    <textarea class="bc-textarea tm-task-detail-remark" data-tm-detail-custom-text-field="${esc(fieldId)}" rows="1">${esc(fieldValue)}</textarea>
                </section>
            `;
        }).join('');
        const locationItems = [];
        if (docName) {
            locationItems.push(isOtherBlock
                ? `<span class="tm-checklist-meta-chip" title="来源文档">${__tmRenderLucideIcon('file-text')} ${esc(docName)}</span>`
                : `<button type="button" class="tm-checklist-meta-chip tm-task-detail-location-chip" data-tm-detail="location-doc"${detailTip('点击切换文档', { ariaLabel: false })}>${__tmRenderLucideIcon('file-text')} ${esc(docName)}</button>`);
        }
        if (showHeadingLocation) {
            const headingLevel = String(task?.headingLevel || SettingsStore?.data?.taskHeadingLevel || 'h2').trim() || 'h2';
            const headingRawText = String(task?.h2 || task?.h2Name || '').trim();
            const headingLabelHtml = (text) => __tmRenderHeadingLevelIconLabel(text, headingLevel, { size: 14 });
            locationItems.push(isOtherBlock
                ? `<span class="tm-checklist-meta-chip" title="来源位置">${headingLabelHtml(headingRawText || headingName || task?.otherBlockTypeLabel || '无')}</span>`
                : `<button type="button" class="tm-checklist-meta-chip tm-task-detail-location-chip" data-tm-detail="location-heading"${detailTip('点击切换标题', { ariaLabel: false })}>${headingLabelHtml(headingRawText || headingName || '无')}</button>`);
        }
        locationItems.push(`<button type="button" class="tm-checklist-meta-chip tm-task-detail-location-chip" data-tm-detail="jump"${detailTip('跳转到任务', { ariaLabel: false })}>${__tmRenderLucideIcon('map-pin')} 跳转</button>`);
        const locationHtml = `
                <div class="tm-task-detail-location">
                    ${locationItems.join('')}
                </div>
            `;
        const headerActionsHtml = `
                <div class="tm-task-detail-header-actions">
                    <button class="bc-btn bc-btn--sm tm-task-detail-icon-btn tm-task-detail-note-view-btn" type="button" data-tm-detail="note-view"${detailTip('笔记内视图', { ariaLabel: '打开笔记内视图' })}>${__tmRenderTaskDetailPhosphorIcon('book-open-text')}</button>
                    <button class="bc-btn bc-btn--sm tm-task-detail-icon-btn" type="button" data-tm-detail="more"${detailTip('更多操作', { ariaLabel: '更多任务操作' })}>${__tmRenderLucideIcon('dots-three')}</button>
                    ${useCompactHeaderActions ? '' : `<button class="bc-btn bc-btn--sm tm-task-detail-icon-btn" type="button" data-tm-detail="save"${detailTip('保存', { ariaLabel: '保存任务详情' })}>${__tmRenderLucideIcon('save')}</button>`}
                    ${useCompactHeaderActions ? '' : ((floating || closeable || !embedded) ? `<button class="bc-btn bc-btn--sm tm-task-detail-close-btn tm-task-detail-icon-btn" type="button" data-tm-detail="close"${detailTip('关闭', { ariaLabel: '关闭任务详情' })}>${__tmRenderLucideIcon('x')}</button>` : '')}
                </div>
            `;
        return `
            <div class="${embedded ? 'tm-checklist-detail-card' : 'tm-task-detail'} tm-task-detail-shell${circleCheckboxClass}" data-tm-detail-mode="${embedded ? 'embedded' : 'standalone'}" role="dialog" aria-modal="${embedded ? 'false' : 'true'}">
                <div class="tm-task-detail-header">
                    <div class="tm-task-detail-header-top">
                        ${locationHtml}
                        ${headerActionsHtml}
                    </div>
                    <div class="tm-task-detail-header-main">
                        <textarea class="tm-task-detail-title-input" data-tm-detail="content" ${isOtherBlock ? 'readonly' : ''} title="${isOtherBlock ? '其他块内容请回原文档编辑' : ''}" rows="1">${esc(titleValue)}</textarea>
                    </div>
                </div>

                <div class="tm-task-detail-core">
                    <input type="hidden" data-tm-detail="priority" value="${esc(curPriority)}">
                    <div class="tm-task-detail-priority-select" data-tm-detail-priority-select>
                        <button type="button" class="bc-btn bc-btn--sm tm-task-detail-icon-btn tm-task-detail-priority-trigger" data-tm-detail-priority-trigger aria-haspopup="listbox" aria-expanded="false"${detailTip('重要性', { ariaLabel: false })} style="${__tmBuildPriorityChipStyle(curPriority || 'none')}">
                            <span class="tm-task-detail-priority-trigger__value">${__tmRenderPriorityJira(curPriority || 'none', false)}</span>
                        </button>
                        <div class="tm-task-detail-priority-menu" data-tm-detail-priority-menu role="listbox" aria-label="重要性" hidden>
                            ${priorityOptions.map((opt) => {
                                const optValue = String(opt.value || '').trim();
                                const selected = String(curPriority || '') === optValue;
                                const chipValue = optValue || 'none';
                                return `<button class="tm-task-detail-priority-menu-option ${selected ? 'is-selected' : ''}" type="button" role="option" aria-selected="${selected ? 'true' : 'false'}" data-tm-detail-priority-option data-value="${esc(opt.value)}"><span class="tm-task-detail-priority-menu-option__face" style="${__tmBuildPriorityChipStyle(chipValue)}">${__tmRenderPriorityJira(chipValue, true)}</span></button>`;
                            }).join('')}
                        </div>
                    </div>
                    <div class="tm-task-detail-status-select" data-tm-detail-status-select>
                        <input type="hidden" data-tm-detail="status" value="${esc(curStatusOption.id)}">
                        <button type="button" class="bc-btn bc-btn--sm tm-task-detail-status-trigger" data-tm-detail-status-trigger aria-haspopup="listbox" aria-expanded="false"${detailTip('状态', { ariaLabel: false })} style="${__tmBuildStatusChipStyle(curStatusOption.color)}">
                            <span class="tm-task-detail-status-trigger__value">${esc(curStatusOption.name || curStatusOption.id)}</span>
                        </button>
                        <div class="bc-select-menu tm-task-detail-status-menu" data-tm-detail-status-menu role="listbox" aria-label="状态" hidden>
                            ${statusOptions.map((o) => {
                                const selected = o.id === curStatusOption.id;
                                return `<button class="bc-select-option tm-task-detail-status-option ${selected ? 'is-selected' : ''}" type="button" role="option" aria-selected="${selected ? 'true' : 'false'}" data-tm-detail-status-option data-value="${esc(o.id)}" data-label="${esc(o.name || o.id)}" data-color="${esc(o.color)}"><span class="tm-status-tag" style="${__tmBuildStatusChipStyle(o.color)}">${esc(o.name || o.id)}</span><span class="bc-select-option__check" aria-hidden="true">✓</span></button>`;
                            }).join('')}
                        </div>
                    </div>
                    <div class="tm-task-detail-core-meta">
                        <input type="hidden" data-tm-detail="startDate" value="${esc(startValue)}">
                        <button type="button" class="bc-btn bc-btn--sm tm-task-detail-core-chip ${startValue ? 'has-value' : ''}" data-tm-detail-date-trigger="startDate"${detailTip('开始日期', { ariaLabel: false })}>
                            <span class="tm-task-detail-core-chip__face" data-tm-detail-chip-face="startDate">${__tmBuildTaskDetailCoreChipFace('startDate', startValue)}</span>
                        </button>
                        <input type="hidden" data-tm-detail="completionTime" value="${esc(endValue)}">
                        <button type="button" class="bc-btn bc-btn--sm tm-task-detail-core-chip tm-task-detail-time-hub-trigger ${timeHubHasValue ? 'has-value' : ''}" data-tm-detail-time-hub-trigger aria-haspopup="dialog" aria-expanded="false"${detailTip(timeHubTip, { ariaLabel: false })}>
                            <span class="tm-task-detail-core-chip__face" data-tm-detail-chip-face="timeHub">${__tmBuildTaskDetailTimeHubFace(task, timeHubOptions)}</span>
                        </button>
                        ${__tmBuildTaskCompleteAtDetailChipHtml(task, detailTip)}
                        <input type="hidden" data-tm-detail="duration" value="${esc(durationValue)}">
                        <input type="hidden" data-tm-detail="tomatoEstimateCount" value="${esc(tomatoEstimateValue)}">
                        <button type="button" class="bc-btn bc-btn--sm tm-task-detail-core-chip ${focusSummaryValue ? 'has-value' : ''}" data-tm-detail-focus-summary-trigger${detailTip('时长与番茄', { ariaLabel: false })}>
                            <span class="tm-task-detail-core-chip__face" data-tm-detail-chip-face="tomatoSummary">${__tmBuildTaskDetailCoreChipFace('tomatoSummary', task)}</span>
                        </button>
                        ${whiteboardOutlineChipHtml}
                        <input type="hidden" data-tm-detail="pinned" value="${curPinned ? '1' : ''}">
                    </div>
                    ${customFieldsHtml}
                </div>
                <section class="tm-task-detail-section tm-task-detail-section--subtasks ${children.length ? '' : 'tm-task-detail-section--subtasks-empty'}">
                    <div class="tm-task-detail-section-head">
                        <div class="tm-task-detail-section-title">子任务</div>
                        <div class="tm-task-detail-section-tools">
                            ${children.length ? `<span class="tm-task-detail-section-count">${completedChildren}/${children.length}</span>` : ''}
                        </div>
                    </div>
                    <div class="tm-task-detail-subtasks" data-tm-detail-subtasks>${__tmBuildTaskDetailSubtasksHtml(task)}</div>
                    <div class="tm-task-detail-subtask-footer">
                        <button type="button" class="bc-btn bc-btn--sm tm-task-detail-subtask-add-btn" data-tm-detail="create-subtask"${detailTip('添加子任务', { ariaLabel: false })}>${__tmRenderLucideIcon('plus')}<span>添加子任务</span></button>
                    </div>
                </section>

                ${__tmBuildTaskDetailRemarkSectionHtml(remarkValue, detailTip)}
                ${__tmBuildTaskDetailAttachmentSectionHtml(task, detailTip)}
                ${textCustomFieldsHtml}
                ${__tmBuildTaskRepeatHistorySectionHtml(task)}
            </div>
        `;
    }

    function __tmBuildTaskDetailNoteViewInnerHtml(task, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const embedded = !!opts.embedded;
        const floating = !!opts.floating;
        const closeable = !!opts.closeable;
        const circleCheckboxClass = SettingsStore.data.taskCheckboxCircleStyleEnabled === true
            ? ' tm-task-detail--task-checkbox-circle'
            : '';
        const useCompactHeaderActions = embedded;
        const detailTip = (label, tipOpts = {}) => __tmBuildTooltipAttrs(label, {
            side: 'bottom',
            ...((tipOpts && typeof tipOpts === 'object') ? tipOpts : {})
        });
        const docName = String(task?.docName || task?.doc_name || '').trim();
        const docId = String(task?.root_id || task?.docId || task?.rootId || '').trim();
        const headingName = __tmNormalizeHeadingText(task?.h2 || task?.h2Name);
        const showHeadingLocation = !!__tmDocHasAnyHeading(docId) || !!headingName;
        const locationItems = [];
        if (docName) {
            locationItems.push(`<span class="tm-checklist-meta-chip" title="来源文档">${__tmRenderLucideIcon('file-text')} ${esc(docName)}</span>`);
        }
        if (showHeadingLocation) {
            const headingLevel = String(task?.headingLevel || SettingsStore?.data?.taskHeadingLevel || 'h2').trim() || 'h2';
            const headingRawText = String(task?.h2 || task?.h2Name || '').trim();
            locationItems.push(`<span class="tm-checklist-meta-chip" title="来源位置">${__tmRenderHeadingLevelIconLabel(headingRawText || headingName || '无', headingLevel, { size: 14 })}</span>`);
        }
        const locationHtml = `
                <div class="tm-task-detail-location">
                    ${locationItems.join('')}
                </div>
            `;
        const headerActionsHtml = `
                <div class="tm-task-detail-header-actions">
                    <button class="bc-btn bc-btn--sm tm-task-detail-icon-btn tm-task-detail-note-back-btn" type="button" data-tm-detail="detail-view"${detailTip('返回详情页', { ariaLabel: '返回任务详情页' })}>${__tmRenderTaskDetailPhosphorIcon('arrow-left')}</button>
                    ${useCompactHeaderActions ? '' : ((floating || closeable || !embedded) ? `<button class="bc-btn bc-btn--sm tm-task-detail-close-btn tm-task-detail-icon-btn" type="button" data-tm-detail="close"${detailTip('关闭', { ariaLabel: '关闭任务详情' })}>${__tmRenderLucideIcon('x')}</button>` : '')}
                </div>
            `;
        return `
            <div class="${embedded ? 'tm-checklist-detail-card' : 'tm-task-detail'} tm-task-detail-shell tm-task-detail-shell--note${circleCheckboxClass}" data-tm-detail-mode="${embedded ? 'embedded-note' : 'standalone-note'}" role="dialog" aria-modal="${embedded ? 'false' : 'true'}">
                <div class="tm-task-detail-header tm-task-detail-header--note">
                    <div class="tm-task-detail-header-top">
                        ${locationHtml}
                        ${headerActionsHtml}
                    </div>
                </div>
                <div class="tm-task-detail-note-view" data-tm-detail-note-view>
                    <div class="tm-task-detail-note-mount" data-tm-detail-note-mount>
                        <div class="tm-task-detail-note-loading">正在载入...</div>
                    </div>
                </div>
            </div>
        `;
    }

    function __tmBindTaskDetailEditor(root, taskId, options = {}) {
        if (!(root instanceof Element)) return;
        const opts = (options && typeof options === 'object') ? options : {};
        const embedded = !!opts.embedded;
        const bindSource = String(opts.source || '').trim() || 'unknown';
        const initialTask = (opts.task && typeof opts.task === 'object') ? opts.task : null;
        if (initialTask?.id) {
            try {
                const cachedTask = __tmCacheTaskInState(initialTask, {
                    docNameFallback: initialTask.doc_name || initialTask.docName || '未命名文档'
                });
                try { root.__tmTaskDetailTask = cachedTask || initialTask; } catch (e) {}
                try { __tmRememberTaskDetailLocationSignature(root, cachedTask || initialTask); } catch (e) {}
            } catch (e) {}
        }
        const isPreRenderedNoteView = root.getAttribute?.('data-tm-detail-view') === 'note' || !!root.querySelector?.('[data-tm-detail-note-mount]');
        if (__tmIsTaskDetailNoteViewActive(root, taskId) || isPreRenderedNoteView) {
            try {
                if (initialTask) root.__tmTaskDetailTask = initialTask;
                if (initialTask) __tmRememberTaskDetailLocationSignature(root, initialTask);
                root.dataset.tmDetailTaskId = String(taskId || initialTask?.id || root.dataset?.tmDetailTaskId || '').trim();
                root.__tmTaskDetailTaskId = String(taskId || initialTask?.id || root.__tmTaskDetailTaskId || '').trim();
            } catch (e) {}
            if (root.__tmTaskDetailNoteActive === true && root.__tmTaskDetailDestroyNoteView) return;
        }
        if (!isPreRenderedNoteView) {
            try { __tmDestroyTaskDetailNoteViewForRoot(root, 'rebind'); } catch (e) {}
        }
        try { root.__tmTaskDetailAbortController?.abort?.(); } catch (e) {}
        const abortController = new AbortController();
        try { root.__tmTaskDetailAbortController = abortController; } catch (e) {}
        const sessionId = __tmCreateTaskDetailSession(root, taskId);
        const on = (target, type, handler, listenerOptions) => {
            if (!target?.addEventListener) return;
            const nextOptions = listenerOptions ? { ...listenerOptions } : {};
            try {
                target.addEventListener(type, handler, { ...nextOptions, signal: abortController.signal });
            } catch (e) {
                try { target.addEventListener(type, handler, nextOptions); } catch (e2) {}
            }
        };
        const onClose = typeof opts.onClose === 'function' ? opts.onClose : null;
        const isSessionActive = (expectedTaskId = taskId, extraOptions = {}) => {
            const expectedId = String(expectedTaskId || taskId || '').trim();
            return __tmIsTaskDetailRootUsable(root, {
                ...((extraOptions && typeof extraOptions === 'object') ? extraOptions : {}),
                sessionId,
                taskId: expectedId,
            });
        };
        let taskDetailNoteProtyle = null;
        let taskDetailNoteMount = null;
        let taskDetailNoteBlockId = '';
        let taskDetailNoteTxTimer = 0;
        const taskDetailNoteTxDocIds = new Set();
        const taskDetailNoteTxBlockIds = new Set();
        const taskDetailNoteTxBuses = [];
        let taskDetailNoteTxHandler = null;
        let taskDetailNoteTxIgnoreUntil = 0;
        let taskDetailNoteTxRefreshInFlight = false;
        let taskDetailNoteTxDirty = false;
        const taskDetailNoteScope = __tmGetTaskDetailNoteViewScopeForRoot(root, opts);
        const markTaskDetailNoteEditing = () => {
            taskDetailNoteTxIgnoreUntil = 0;
        };
        const addTaskDetailNoteTxId = (set, id) => {
            const value = String(id || '').trim();
            if (!value) return;
            try {
                if (typeof __tmIsLikelyBlockId === 'function' && !__tmIsLikelyBlockId(value)) return;
            } catch (e) {}
            set.add(value);
        };
        const getTaskDetailNoteTxTargets = (msg, fallbackDocId = '', fallbackBlockId = '') => {
            let targets = { docIds: new Set(), blockIds: new Set() };
            try {
                if (typeof __tmCollectTxRefreshTargets === 'function') {
                    targets = __tmCollectTxRefreshTargets(msg) || targets;
                }
            } catch (e) {}
            const docIds = targets?.docIds instanceof Set ? new Set(targets.docIds) : new Set(targets?.docIds || []);
            const blockIds = targets?.blockIds instanceof Set ? new Set(targets.blockIds) : new Set(targets?.blockIds || []);
            addTaskDetailNoteTxId(docIds, fallbackDocId);
            addTaskDetailNoteTxId(blockIds, fallbackBlockId);
            return { docIds, blockIds };
        };
        const taskDetailNoteTxTouchesSource = (targets, docId, blockId) => {
            const did = String(docId || '').trim();
            const bid = String(blockId || '').trim();
            const docIds = targets?.docIds instanceof Set ? targets.docIds : new Set(targets?.docIds || []);
            const blockIds = targets?.blockIds instanceof Set ? targets.blockIds : new Set(targets?.blockIds || []);
            if (did && docIds.has(did)) return true;
            if (did && blockIds.has(did)) return true;
            if (bid && blockIds.has(bid)) return true;
            // Some SiYuan transactions only expose newly-created block IDs. While a note
            // view is active, refresh its source doc when the operation has block targets
            // but no resolvable doc target yet.
            if (did && docIds.size === 0 && blockIds.size > 0) return true;
            return false;
        };
        const detachTaskDetailNoteTxBridge = () => {
            try {
                if (taskDetailNoteTxTimer) clearTimeout(taskDetailNoteTxTimer);
            } catch (e) {}
            taskDetailNoteTxTimer = 0;
            taskDetailNoteTxDocIds.clear();
            taskDetailNoteTxBlockIds.clear();
            taskDetailNoteTxIgnoreUntil = 0;
            taskDetailNoteTxRefreshInFlight = false;
            taskDetailNoteTxDirty = false;
            if (typeof taskDetailNoteTxHandler === 'function') {
                taskDetailNoteTxBuses.splice(0).forEach((bus) => {
                    try { globalThis.__tmRuntimeEvents?.offEventBus?.('ws-main', taskDetailNoteTxHandler, bus); } catch (e) {}
                });
            } else {
                taskDetailNoteTxBuses.length = 0;
            }
            taskDetailNoteTxHandler = null;
        };
        const refreshTaskDetailNoteFromNativeTx = async (taskForNote, blockId, reason = 'detail-note-view-native-tx') => {
            if (taskDetailNoteTxRefreshInFlight) return false;
            const bid = String(blockId || taskDetailNoteBlockId || __tmGetTaskDetailBlockId(taskForNote) || root.__tmTaskDetailNoteBlockId || '').trim();
            const sourceTask = (taskForNote && typeof taskForNote === 'object') ? taskForNote : (root.__tmTaskDetailTask || getBoundTask());
            const tid = String(sourceTask?.id || root.__tmTaskDetailTaskId || root.dataset?.tmDetailTaskId || taskId || '').trim();
            const rootId = String(__tmGetTaskDetailRootId(sourceTask) || root.__tmTaskDetailNoteRootId || '').trim();
            if (!root.isConnected || !__tmIsTaskDetailNoteViewActive(root, tid)) return false;
            taskDetailNoteTxRefreshInFlight = true;
            taskDetailNoteTxIgnoreUntil = Date.now() + 700;
            const docIds = Array.from(taskDetailNoteTxDocIds);
            const blockIds = Array.from(taskDetailNoteTxBlockIds);
            addTaskDetailNoteTxId(new Set(docIds), rootId);
            if (rootId && !docIds.includes(rootId)) docIds.push(rootId);
            if (bid && !blockIds.includes(bid)) blockIds.push(bid);
            if (tid && !blockIds.includes(tid)) blockIds.push(tid);
            taskDetailNoteTxDocIds.clear();
            taskDetailNoteTxBlockIds.clear();
            const refreshReason = String(reason || '').trim() || 'detail-note-view-native-tx';
            try {
                try { if (rootId) __tmInvalidateTasksQueryCacheByDocId(rootId); } catch (e) {}
                try { window.__tmCalendarAllTasksCache = null; } catch (e) {}
                try { await __tmFlushSqlTransactionsSafe?.(refreshReason); } catch (e) {}
                let refreshed = false;
                try {
                    if (typeof __tmRefreshAffectedDocsIncrementally === 'function') {
                        refreshed = await __tmRefreshAffectedDocsIncrementally({
                            docIds,
                            blockIds,
                            withFilters: false,
                            reason: refreshReason,
                            deferIfDetailBusy: false,
                            allowCalendar: true,
                            invalidateCalendarCache: true,
                            skipViewRefresh: true,
                        }) === true;
                    }
                } catch (e) {
                    refreshed = false;
                }
                try {
                    if (String(state.viewMode || '').trim() === 'calendar') {
                        globalThis.__tmCalendar?.requestRefresh?.({
                            reason: refreshReason,
                            main: true,
                            side: true,
                            flushTaskPanel: true,
                            hard: false,
                        });
                    }
                } catch (e) {}
                try {
                    let freshTask = tid ? __tmGetTaskDetailTaskById(tid, { includeWhiteboard: true }) : null;
                    if (!freshTask && bid && typeof __tmBuildTaskLikeFromBlockId === 'function') {
                        try { freshTask = await __tmBuildTaskLikeFromBlockId(bid); } catch (e) { freshTask = null; }
                    }
                    if (freshTask) {
                        root.__tmTaskDetailTask = freshTask;
                        __tmSetTaskDetailNoteViewState(taskDetailNoteScope, freshTask, bid || __tmGetTaskDetailBlockId(freshTask), {
                            taskId: tid,
                            rootId,
                        });
                    }
                } catch (e) {}
                if (refreshed && root.isConnected && __tmIsTaskDetailNoteViewActive(root, tid)) {
                    try { if (typeof applyFilters === 'function') applyFilters(); } catch (e) {}
                    try {
                        if (String(state.viewMode || '').trim() !== 'calendar'
                            && state.modal
                            && document.body.contains(state.modal)
                            && typeof __tmRerenderCurrentViewInPlace === 'function') {
                            __tmRerenderCurrentViewInPlace(state.modal);
                        }
                    } catch (e) {}
                }
                try { globalThis.__taskHorizonQuickbarRefreshInline?.(); } catch (e) {}
                try { globalThis.__taskHorizonQuickbarRefresh?.(); } catch (e) {}
                return refreshed;
            } finally {
                taskDetailNoteTxRefreshInFlight = false;
                taskDetailNoteTxIgnoreUntil = Date.now() + 700;
            }
        };
        const scheduleTaskDetailNoteTxRefresh = (targets, taskForNote, blockId, reason = 'detail-note-view-native-tx') => {
            if (Date.now() < taskDetailNoteTxIgnoreUntil) return false;
            const sourceTask = (taskForNote && typeof taskForNote === 'object') ? taskForNote : (root.__tmTaskDetailTask || getBoundTask());
            const rootId = String(__tmGetTaskDetailRootId(sourceTask) || root.__tmTaskDetailNoteRootId || '').trim();
            const bid = String(blockId || taskDetailNoteBlockId || __tmGetTaskDetailBlockId(sourceTask) || root.__tmTaskDetailNoteBlockId || '').trim();
            (targets?.docIds instanceof Set ? targets.docIds : new Set(targets?.docIds || [])).forEach((id) => addTaskDetailNoteTxId(taskDetailNoteTxDocIds, id));
            (targets?.blockIds instanceof Set ? targets.blockIds : new Set(targets?.blockIds || [])).forEach((id) => addTaskDetailNoteTxId(taskDetailNoteTxBlockIds, id));
            addTaskDetailNoteTxId(taskDetailNoteTxDocIds, rootId);
            addTaskDetailNoteTxId(taskDetailNoteTxBlockIds, bid);
            taskDetailNoteTxDirty = true;
            try { __tmClearExternalTaskTxDirty?.(); } catch (e) {}
            try { __tmClearPendingTxRefreshTargets?.({ docIds: Array.from(taskDetailNoteTxDocIds), blockIds: Array.from(taskDetailNoteTxBlockIds) }); } catch (e) {}
            return true;
        };
        const flushTaskDetailNoteTxRefresh = async (taskForNote, blockId, reason = 'detail-note-view-commit') => {
            if (!taskDetailNoteTxDirty) return false;
            taskDetailNoteTxDirty = false;
            try {
                if (taskDetailNoteTxTimer) clearTimeout(taskDetailNoteTxTimer);
            } catch (e) {}
            taskDetailNoteTxTimer = 0;
            return await refreshTaskDetailNoteFromNativeTx(taskForNote, blockId, reason);
        };
        const installTaskDetailNoteTxBridge = (taskForNote, blockId) => {
            detachTaskDetailNoteTxBridge();
            const sourceTask = (taskForNote && typeof taskForNote === 'object') ? taskForNote : null;
            const rootId = String(__tmGetTaskDetailRootId(sourceTask) || '').trim();
            const bid = String(blockId || __tmGetTaskDetailBlockId(sourceTask) || '').trim();
            taskDetailNoteTxIgnoreUntil = Date.now() + 900;
            taskDetailNoteTxHandler = (msg) => {
                if (Date.now() < taskDetailNoteTxIgnoreUntil) return;
                const cmd = String(msg?.detail?.cmd || msg?.cmd || '').trim().toLowerCase();
                if (cmd && cmd !== 'transactions' && cmd !== 'savedoc') return;
                const targets = getTaskDetailNoteTxTargets(msg, '', '');
                if (!taskDetailNoteTxTouchesSource(targets, rootId, bid)) return;
                scheduleTaskDetailNoteTxRefresh(targets, sourceTask, bid, 'detail-note-view-native-tx');
            };
            const buses = Array.from(new Set(globalThis.__tmHost?.getEventBuses?.() || []));
            buses.forEach((bus) => {
                if (!bus || typeof bus.on !== 'function') return;
                try {
                    if (globalThis.__tmRuntimeEvents?.onEventBus?.('ws-main', taskDetailNoteTxHandler, bus)) {
                        taskDetailNoteTxBuses.push(bus);
                    }
                } catch (e) {}
            });
            return taskDetailNoteTxBuses.length > 0;
        };
        const destroyTaskDetailNoteView = (reason = 'manual') => {
            detachTaskDetailNoteTxBridge();
            if (taskDetailNoteProtyle) {
                try { taskDetailNoteProtyle.destroy?.(); } catch (e) {}
            }
            taskDetailNoteProtyle = null;
            taskDetailNoteMount = null;
            taskDetailNoteBlockId = '';
            try { delete root.__tmTaskDetailDestroyNoteView; } catch (e) {}
            try { delete root.__tmTaskDetailFlushNoteView; } catch (e) {}
            try { delete root.__tmTaskDetailNoteActive; } catch (e) {}
            try { delete root.__tmTaskDetailNoteBlockId; } catch (e) {}
            try { delete root.__tmTaskDetailNoteRootId; } catch (e) {}
            try { root.removeAttribute('data-tm-detail-view'); } catch (e) {}
            try { __tmClearTaskDetailNoteViewState(taskDetailNoteScope, '', reason); } catch (e) {}
            try {
                __tmPushDetailDebug('detail-note-view-destroy', {
                    taskId: String(taskId || '').trim(),
                    reason: String(reason || '').trim() || 'manual',
                });
            } catch (e) {}
        };
        const close = async () => {
            try { __tmCloseTaskDetailMoreMenu(); } catch (e) {}
            try { await flushTaskDetailNoteTxRefresh(root.__tmTaskDetailTask || getBoundTask(), taskDetailNoteBlockId, 'close'); } catch (e) {}
            try { destroyTaskDetailNoteView('close'); } catch (e) {}
            __tmMarkTaskDetailRootClosing(root, { sessionId, holdMs: 900 });
            try {
                if (onClose) return await onClose();
                return undefined;
            } finally {
                __tmMarkTaskDetailRootClosed(root, { sessionId });
                try { abortController.abort(); } catch (e) {}
            }
        };
        let autoSaveTimer = null;
        let saving = false;
        let savePromise = null;
        let activeSaveSerialized = '';
        let queuedSaveRequested = false;
        let queuedSaveOptions = null;
        let lastSerialized = '';
        let refreshStatusSelectUi = () => {};
        let refreshPrioritySelectUi = () => {};
        const bumpDetailRefreshHold = (ms = 0) => {
            try {
                const ttl = Math.max(0, Number(ms) || 0);
                if (!ttl) return;
                const nextUntil = Date.now() + ttl;
                const prevUntil = Math.max(0, Number(root.__tmTaskDetailRefreshHoldUntil) || 0);
                root.__tmTaskDetailRefreshHoldUntil = Math.max(prevUntil, nextUntil);
            } catch (e) {}
        };
        const setTaskDetailPendingSave = (active, holdMs = null) => {
            try { root.__tmTaskDetailPendingSave = !!active; } catch (e) {}
            bumpDetailRefreshHold(active ? (holdMs ?? 1800) : (holdMs ?? 420));
            try {
                __tmPushDetailDebug('detail-pending-save', {
                    taskId: String(taskId || '').trim(),
                    active: !!active,
                    holdMs: active ? (holdMs ?? 1800) : (holdMs ?? 420),
                    embedded: embedded === true,
                });
            } catch (e) {}
        };
        const setTaskDetailActivePopover = (popover = null, holdMs = null) => {
            try { root.__tmTaskDetailActiveInlinePopover = popover instanceof Element ? popover : null; } catch (e) {}
            bumpDetailRefreshHold(holdMs ?? 900);
            try {
                __tmPushDetailDebug('detail-active-popover', {
                    taskId: String(taskId || '').trim(),
                    active: popover instanceof Element,
                    holdMs: holdMs ?? 900,
                    popoverClass: String(popover?.className || '').trim(),
                });
            } catch (e) {}
        };
        try {
            root.__tmTaskDetailPendingSave = false;
            root.__tmTaskDetailActiveInlinePopover = null;
        } catch (e) {}
        try {
            __tmPushDetailDebug('detail-bind-editor', {
                taskId: String(taskId || '').trim(),
                embedded: embedded === true,
                source: bindSource,
                sessionId,
                rootTag: __tmDescribeDebugElement(root),
                initialTaskId: String(initialTask?.id || '').trim(),
                currentTaskId: String(root.__tmTaskDetailTask?.id || root.dataset?.tmDetailTaskId || '').trim(),
                pendingSave: root.__tmTaskDetailPendingSave === true,
                hasActivePopover: !!root.__tmTaskDetailActiveInlinePopover,
                refreshHoldMsLeft: Math.max(0, Number(root.__tmTaskDetailRefreshHoldUntil || 0) - Date.now()),
            });
        } catch (e) {}
        const getBoundTask = () => {
            const tid = String(taskId || '').trim();
            const resolvedTid = tid && typeof __tmResolveOptimisticTaskId === 'function'
                ? String(__tmResolveOptimisticTaskId(tid) || tid).trim()
                : tid;
            const cached = resolvedTid
                ? (
                    globalThis.__tmRuntimeState?.getTaskById?.(resolvedTid, { includePending: true, preferPending: true })
                    || state.flatTasks?.[resolvedTid]
                    || state.pendingInsertedTasks?.[resolvedTid]
                    || null
                )
                : null;
            const rawCached = tid && resolvedTid !== tid
                ? (
                    globalThis.__tmRuntimeState?.getTaskById?.(tid, { includePending: true, preferPending: true })
                    || state.flatTasks?.[tid]
                    || state.pendingInsertedTasks?.[tid]
                    || null
                )
                : null;
            const taskCached = cached || rawCached;
            if (taskCached) {
                try { root.__tmTaskDetailTask = taskCached; } catch (e) {}
                return taskCached;
            }
            const fallback = root.__tmTaskDetailTask || initialTask || null;
            if (fallback && typeof fallback === 'object') {
                const fallbackId = String(fallback.id || '').trim();
                if (!tid || !fallbackId || __tmAreTaskDetailIdsEquivalent(fallbackId, tid) || __tmAreTaskDetailIdsEquivalent(fallbackId, resolvedTid)) {
                    const rebound = __tmCacheTaskInState(fallback, {
                        docNameFallback: fallback.doc_name || fallback.docName || '未命名文档'
                    }) || fallback;
                    try { root.__tmTaskDetailTask = rebound; } catch (e) {}
                    return rebound;
                }
            }
            return null;
        };
        const getBoundTaskId = () => {
            const task = getBoundTask();
            const rawId = String(task?.id || taskId || '').trim();
            return __tmResolveTaskDetailEffectiveId(rawId);
        };
        const buildDetailTip = (label, tipOpts = {}) => __tmBuildTooltipAttrs(label, {
            side: 'bottom',
            ...((tipOpts && typeof tipOpts === 'object') ? tipOpts : {}),
        });
        const syncSubtaskVisibilityToggle = () => {
            const task = getBoundTask();
            const children = Array.isArray(task?.children) ? task.children : [];
            const count = root.querySelector('.tm-task-detail-section--subtasks .tm-task-detail-section-count');
            const tools = count instanceof HTMLElement ? count.closest('.tm-task-detail-section-tools') : null;
            let btn = root.querySelector('[data-tm-detail-toggle-completed-subtasks]');
            if (!children.length || !(count instanceof HTMLElement) || !(tools instanceof HTMLElement)) {
                try { btn?.remove?.(); } catch (e) {}
                return false;
            }
            const showCompletedSubtasks = typeof __tmShouldShowCompletedSubtasksForTask === 'function'
                ? __tmShouldShowCompletedSubtasksForTask(getBoundTaskId() || taskId)
                : true;
            const action = showCompletedSubtasks ? '隐藏已完成任务' : '显示已完成任务';
            if (!(btn instanceof HTMLButtonElement)) {
                btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'bc-btn bc-btn--sm tm-task-detail-subtask-visibility-btn';
                btn.setAttribute('data-tm-detail-toggle-completed-subtasks', '');
                tools.insertBefore(btn, count);
            }
            btn.classList.remove('is-active');
            btn.setAttribute('aria-pressed', showCompletedSubtasks ? 'false' : 'true');
            btn.innerHTML = __tmRenderLucideIcon(showCompletedSubtasks ? 'check-circle-2' : 'circle');
            try { __tmApplyTooltipAttrsToElement(btn, action, { side: 'bottom' }); } catch (e) {}
            try { btn.setAttribute('aria-label', action); } catch (e) {}
            return true;
        };
        let activeInlinePopover = null;
        let activeInlinePopoverTrigger = null;
        let activeInlinePopoverTriggerRect = null;
        let inlinePopoverCommitting = false;
        const subtaskSaveTimers = new Map();
        const subtaskTextareaMinHeight = 30;
        let subtaskContentSaveDepth = 0;
        let refreshWhiteboardOutlinePopover = () => false;
        let openWhiteboardOutlinePopover = () => false;
        let whiteboardOutlinePanDrag = null;
        const isWhiteboardOutlineCheckboxTarget = (target) => {
            const el = target instanceof Element ? target : null;
            return !!el?.closest?.('[data-tm-detail-whiteboard-outline-check],.tm-task-checkbox,.tm-task-checkbox-wrap,input[type="checkbox"]');
        };
        const syncWhiteboardOutline = () => {
            try {
                const task = getBoundTask();
                if (!task) return false;
                const popoverOpen = activeInlinePopover instanceof HTMLElement
                    && activeInlinePopover.classList.contains('tm-task-detail-inline-popover--whiteboard-outline');
                const synced = __tmSyncTaskDetailWhiteboardOutlineSection(root, task, buildDetailTip, { open: popoverOpen });
                if (popoverOpen) refreshWhiteboardOutlinePopover(activeInlinePopover, { closeIfMissing: true });
                return synced;
            } catch (e) {
                return false;
            }
        };
        const getAttachmentSection = () => root.querySelector('[data-tm-detail-attachment-section]');
        const syncAttachmentSection = (taskLike = null) => {
            const task = (taskLike && typeof taskLike === 'object') ? taskLike : getBoundTask();
            const section = getAttachmentSection();
            if (!(task && typeof task === 'object') || !(section instanceof HTMLElement)) return false;
            const expanded = section.dataset.tmExpanded === 'true';
            section.outerHTML = __tmBuildTaskDetailAttachmentSectionHtml(task, buildDetailTip, { expanded });
            return true;
        };
        const setAttachmentSectionExpanded = (expanded) => {
            const section = getAttachmentSection();
            if (!(section instanceof HTMLElement)) return false;
            const attachmentCount = Math.max(0, Number(section.dataset.tmAttachmentCount || 0));
            const canCollapse = attachmentCount > __TM_TASK_ATTACHMENT_DETAIL_COLLAPSE_COUNT;
            const nextExpanded = canCollapse ? !!expanded : true;
            section.dataset.tmExpanded = nextExpanded ? 'true' : 'false';
            const toggleBtn = section.querySelector('[data-tm-detail-attachment-toggle]');
            if (toggleBtn instanceof HTMLButtonElement) {
                const hiddenCount = Math.max(0, attachmentCount - __TM_TASK_ATTACHMENT_DETAIL_COLLAPSE_COUNT);
                toggleBtn.textContent = nextExpanded ? '收起' : `展开 ${hiddenCount} 个`;
            }
            return true;
        };
        const readHiddenInputValue = (field) => {
            const input = root.querySelector(`input[type="hidden"][data-tm-detail="${field}"]`);
            return (input instanceof HTMLInputElement) ? String(input.value || '').trim() : '';
        };
        const setHiddenInputValue = (field, value) => {
            const input = root.querySelector(`input[type="hidden"][data-tm-detail="${field}"]`);
            if (input instanceof HTMLInputElement) input.value = String(value || '').trim();
        };
        const readPinnedValue = () => {
            const input = root.querySelector('[data-tm-detail="pinned"]');
            if (!(input instanceof HTMLInputElement)) return false;
            return input.type === 'checkbox'
                ? !!input.checked
                : !!String(input.value || '').trim();
        };
        const readReminderValue = () => {
            const cached = __tmPeekTaskReminderSnapshotByAnyId(getBoundTask() || taskId);
            if (cached && typeof cached === 'object') return cached.hasReminder === true;
            const task = getBoundTask();
            return !!(task && __tmHasReminderMark(task));
        };
        const readReminderDisplayValue = () => {
            const cached = __tmPeekTaskReminderSnapshotByAnyId(getBoundTask() || taskId);
            return String(cached?.displayText || '').trim();
        };
        const readReminderTooltipValue = () => {
            const cached = __tmPeekTaskReminderSnapshotByAnyId(getBoundTask() || taskId);
            if (cached && cached.hasReminder === true) return String(cached.tooltip || '').trim() || '已添加提醒';
            return readReminderValue() ? '已添加提醒' : '提醒';
        };
        const readRepeatSummaryValue = () => {
            const task = getBoundTask();
            if (!task) return '';
            return __tmGetTaskRepeatSummary(__tmGetTaskRepeatRule(task), {
                startDate: task?.startDate,
                completionTime: task?.completionTime,
            });
        };
        const readTimeHubScheduleText = () => String(root.__tmTaskDetailTimeHubScheduleText || '').trim();
        const formatTimeHubScheduleText = (item) => {
            if (!item || typeof item !== 'object') return '';
            const startMs = new Date(item.start).getTime();
            if (!Number.isFinite(startMs)) return '';
            const start = new Date(startMs);
            const pad = (n) => String(n).padStart(2, '0');
            const dateKey = __tmNormalizeDateOnly(start);
            const timeText = item.allDay === true ? '全天' : `${pad(start.getHours())}:${pad(start.getMinutes())}`;
            const taskDate = readHiddenInputValue('completionTime') || readHiddenInputValue('startDate');
            if (dateKey && taskDate && dateKey === taskDate) return timeText;
            const dateText = __tmFormatTaskDetailShortDate(dateKey, '');
            return dateText ? `${dateText} ${timeText}` : timeText;
        };
        const refreshTimeHubScheduleSummary = async () => {
            const tid = String(taskId || getBoundTask()?.id || '').trim();
            if (!tid || !globalThis.__tmCalendar || typeof globalThis.__tmCalendar.listTaskSchedulesByTaskId !== 'function') {
                try { root.__tmTaskDetailTimeHubScheduleText = ''; } catch (e) {}
                syncTimeHubTriggerFace();
                return;
            }
            try {
                const list = await globalThis.__tmCalendar.listTaskSchedulesByTaskId(tid, { futureOnly: true });
                const first = (Array.isArray(list) ? list : []).find((it) => it?.allDay !== true) || (Array.isArray(list) ? list[0] : null);
                try { root.__tmTaskDetailTimeHubScheduleText = formatTimeHubScheduleText(first); } catch (e) {}
            } catch (e) {
                try { root.__tmTaskDetailTimeHubScheduleText = ''; } catch (e2) {}
            }
            if (!root.isConnected) return;
            syncTimeHubTriggerFace();
        };
        const syncTimeHubTriggerFace = () => {
            const trigger = root.querySelector('[data-tm-detail-time-hub-trigger]');
            const face = root.querySelector('[data-tm-detail-chip-face="timeHub"]');
            if (!(trigger instanceof HTMLElement) && !(face instanceof HTMLElement)) return;
            const task = getBoundTask() || {};
            const startDate = readHiddenInputValue('startDate');
            const completionTime = readHiddenInputValue('completionTime');
            const options = {
                startDate,
                completionTime,
                hasReminder: readReminderValue(),
                reminderText: readReminderDisplayValue(),
                scheduleText: readTimeHubScheduleText(),
                repeatSummary: readRepeatSummaryValue(),
            };
            const taskLike = {
                ...task,
                startDate,
                start_date: startDate,
                completionTime,
                completion_time: completionTime,
            };
            const hasValue = __tmTaskDetailTimeHubHasValue(taskLike, options);
            const label = __tmGetTaskDetailTimeHubLabel(taskLike, options);
            if (face instanceof HTMLElement) {
                face.innerHTML = __tmBuildTaskDetailTimeHubFace(taskLike, options);
            }
            if (trigger instanceof HTMLElement) {
                trigger.classList.toggle('has-value', hasValue);
                try { __tmApplyTooltipAttrsToElement(trigger, label, { side: 'bottom' }); } catch (e) {}
                try { trigger.setAttribute('aria-label', label); } catch (e) {}
                try { trigger.removeAttribute('title'); } catch (e) {}
            }
        };
        const syncRepeatChipFace = () => {
            const summary = readRepeatSummaryValue();
            const repeatFace = root.querySelector('[data-tm-detail-chip-face="repeat"]');
            if (repeatFace instanceof HTMLElement) repeatFace.innerHTML = __tmBuildTaskDetailCoreChipFace('repeat', summary);
            const repeatBtn = root.querySelector('[data-tm-detail-repeat-trigger]');
            if (repeatBtn instanceof HTMLElement) {
                repeatBtn.classList.toggle('has-value', !!summary);
                const label = summary || '循环';
                try { __tmApplyTooltipAttrsToElement(repeatBtn, label, { side: 'bottom' }); } catch (e) {}
                try { repeatBtn.setAttribute('aria-label', label); } catch (e) {}
                try { repeatBtn.removeAttribute('title'); } catch (e) {}
            }
            syncTimeHubTriggerFace();
        };
        const syncReminderChipFace = () => {
            const reminder = readReminderValue();
            const reminderText = reminder ? readReminderDisplayValue() : '';
            const reminderFace = root.querySelector('[data-tm-detail-chip-face="reminder"]');
            if (reminderFace instanceof HTMLElement) reminderFace.innerHTML = __tmBuildTaskDetailCoreChipFace('reminder', reminderText);
            const reminderBtn = root.querySelector('[data-tm-detail-reminder-toggle]');
            if (reminderBtn instanceof HTMLElement) {
                const label = reminder ? readReminderTooltipValue() : '提醒';
                reminderBtn.classList.toggle('is-active', reminder);
                reminderBtn.classList.toggle('has-value', !!reminderText);
                reminderBtn.classList.toggle('tm-task-detail-core-chip--icon', !reminderText);
                try { __tmApplyTooltipAttrsToElement(reminderBtn, label, { side: 'bottom' }); } catch (e) {}
                try { reminderBtn.setAttribute('aria-label', label); } catch (e) {}
                try { reminderBtn.removeAttribute('title'); } catch (e) {}
            }
            syncTimeHubTriggerFace();
        };
        const refreshReminderButtonState = async (force = false) => {
            const reminderBtn = root.querySelector('[data-tm-detail-reminder-toggle], [data-tm-detail-time-hub-trigger]');
            if (!(reminderBtn instanceof HTMLElement)) {
                syncTimeHubTriggerFace();
                return;
            }
            syncReminderChipFace();
            const task = getBoundTask();
            const tid = String(task?.id || taskId || '').trim();
            if (!tid) return;
            try {
                const snapshot = await __tmGetTaskReminderSnapshotByAnyId(task || root.__tmTaskDetailTask || taskId, { force: !!force });
                const hasReminder = snapshot?.hasReminder === true;
                __tmSetTaskReminderMark(tid, hasReminder);
                const boundTask = getBoundTask();
                if (boundTask && __tmAreTaskDetailIdsEquivalent(boundTask.id, tid)) {
                    boundTask.bookmark = hasReminder ? '⏰' : '';
                    try { root.__tmTaskDetailTask = boundTask; } catch (e) {}
                }
            } catch (e) {
                if (!__tmReminderMarkCache.has(tid)) __tmReminderMarkCache.set(tid, false);
            }
            if (!root.isConnected) return;
            syncReminderChipFace();
        };
        const scheduleReminderButtonStateRefresh = () => {
            [180, 900, 2200, 4200].forEach((ms) => {
                try {
                    setTimeout(() => {
                        if (!root.isConnected) return;
                        void refreshReminderButtonState(true);
                    }, ms);
                } catch (e) {}
            });
        };
        const collectCustomTextFieldValues = () => {
            const values = {};
            root.querySelectorAll('textarea[data-tm-detail-custom-text-field]').forEach((el) => {
                if (!(el instanceof HTMLTextAreaElement)) return;
                const fieldId = String(el.getAttribute('data-tm-detail-custom-text-field') || '').trim();
                if (!fieldId) return;
                const field = __tmGetCustomFieldDefMap().get(fieldId);
                if (!field || String(field?.type || '').trim() !== 'text') return;
                values[fieldId] = String(__tmNormalizeCustomFieldValue(field, el.value) || '').trim();
            });
            return values;
        };
        const findTaskInTreeById = (taskLike, expectedId) => {
            const task = (taskLike && typeof taskLike === 'object') ? taskLike : null;
            const tid = String(expectedId || '').trim();
            if (!task || !tid) return null;
            if (__tmAreTaskDetailIdsEquivalent(task.id, tid)) return task;
            const children = Array.isArray(task.children) ? task.children : [];
            for (const child of children) {
                const found = findTaskInTreeById(child, tid);
                if (found) return found;
            }
            return null;
        };
        const findLoadedTaskTreeTaskById = (expectedId) => {
            const tid = String(expectedId || '').trim();
            if (!tid) return null;
            const docs = Array.isArray(state.taskTree) ? state.taskTree : [];
            for (const doc of docs) {
                const found = findTaskInTreeById({ children: Array.isArray(doc?.tasks) ? doc.tasks : [] }, tid);
                if (found) return found;
            }
            return null;
        };
        const preserveTaskDetailChildren = (nextTask, fallbackTask = null) => {
            const next = (nextTask && typeof nextTask === 'object') ? nextTask : null;
            if (!next) return nextTask;
            const rawId = String(next.id || fallbackTask?.id || getBoundTaskId() || taskId || '').trim();
            const resolvedId = __tmResolveTaskDetailEffectiveId(rawId) || rawId;
            const aliases = Array.from(new Set([rawId, resolvedId].map((id) => String(id || '').trim()).filter(Boolean)));
            if (Array.isArray(next.children) && next.children.length > 0) return next;
            for (const id of aliases) {
                const treeTask = findLoadedTaskTreeTaskById(id);
                if (treeTask && treeTask !== next && Array.isArray(treeTask.children)) {
                    next.children = treeTask.children;
                    return next;
                }
            }
            const candidates = [
                root.__tmTaskDetailTask,
                fallbackTask,
                getBoundTask(),
                ...aliases.map((id) => __tmGetTaskDetailTaskById(id, { includePending: true, preferPending: true, includeWhiteboard: true })),
                ...aliases.map((id) => state.flatTasks?.[id]),
                ...aliases.map((id) => state.pendingInsertedTasks?.[id]),
            ];
            for (const candidate of candidates) {
                if (candidate === next) continue;
                const children = Array.isArray(candidate?.children) ? candidate.children : [];
                if (children.length > 0) {
                    next.children = children;
                    return next;
                }
            }
            return next;
        };
        const patchLoadedTaskBlockForDetail = (nextTask) => {
            const next = (nextTask && typeof nextTask === 'object') ? nextTask : null;
            if (!next || typeof __tmPatchLoadedTaskBlockInPlace !== 'function') return null;
            const tid = String(next.id || '').trim();
            if (!tid) return null;
            let docId = '';
            try { docId = __tmPatchLoadedTaskBlockInPlace(tid, next); } catch (e) { docId = ''; }
            if (!docId) return null;
            return findLoadedTaskTreeTaskById(tid) || next;
        };
        const cacheTaskTreeForDetail = (taskLike) => {
            const task = (taskLike && typeof taskLike === 'object') ? taskLike : null;
            if (!task) return null;
            try { __tmRestoreTaskFlatMap(task); } catch (e) {}
            try {
                return __tmCacheTaskInState(task, {
                    docNameFallback: task.doc_name || task.docName || '未命名文档'
                }) || task;
            } catch (e) {
                return task;
            }
        };
        const resolveDetailNavigationTask = async (nextTaskId) => {
            const requestedId = String(nextTaskId || '').trim();
            if (!requestedId) return null;
            let resolvedId = __tmResolveTaskDetailEffectiveId(requestedId) || requestedId;
            let nextTask = state.flatTasks?.[resolvedId] || state.pendingInsertedTasks?.[resolvedId] || null;
            if (!nextTask && resolvedId !== requestedId) {
                nextTask = state.flatTasks?.[requestedId] || state.pendingInsertedTasks?.[requestedId] || null;
            }
            if (!nextTask) {
                nextTask = findTaskInTreeById(getBoundTask(), resolvedId);
                if (!nextTask && resolvedId !== requestedId) nextTask = findTaskInTreeById(getBoundTask(), requestedId);
                if (nextTask) nextTask = cacheTaskTreeForDetail(nextTask);
            }
            if (!nextTask) {
                try {
                    const normalizedId = await __tmResolveTaskIdFromAnyBlockId(resolvedId);
                    if (normalizedId) resolvedId = normalizedId;
                } catch (e) {}
                nextTask = state.flatTasks?.[resolvedId] || state.pendingInsertedTasks?.[resolvedId] || null;
            }
            if (!nextTask) {
                try { nextTask = await __tmEnsureTaskInStateById(resolvedId); } catch (e) { nextTask = null; }
            }
            if (!nextTask) {
                try { nextTask = await __tmBuildTaskLikeFromBlockId(resolvedId); } catch (e) { nextTask = null; }
                if (nextTask) nextTask = cacheTaskTreeForDetail(nextTask);
            }
            if (!nextTask && resolvedId !== requestedId) {
                nextTask = findTaskInTreeById(getBoundTask(), requestedId);
                if (nextTask) nextTask = cacheTaskTreeForDetail(nextTask);
            }
            return nextTask || null;
        };
        const captureInlineSubtaskDraftSnapshot = (nextTaskId = taskId) => {
            try { return __tmCaptureTaskDetailSubtaskDraftSnapshot(root, nextTaskId); } catch (e) { return null; }
        };
        const restoreInlineSubtaskDraftSnapshot = (snapshot) => {
            if (!snapshot || typeof snapshot !== 'object') return;
            try { __tmRestoreTaskDetailSubtaskDraftSnapshot(root, snapshot); } catch (e) {}
        };
        const captureRemarkDraftSnapshot = (nextTaskId = taskId) => {
            try { return __tmCaptureTaskDetailRemarkDraftSnapshot(root, nextTaskId); } catch (e) { return null; }
        };
        const restoreRemarkDraftSnapshot = (snapshot) => {
            if (!snapshot || typeof snapshot !== 'object') return;
            try { __tmRestoreTaskDetailRemarkDraftSnapshot(root, snapshot); } catch (e) {}
        };
        const refreshBoundDetail = async (nextTaskId = taskId) => {
            const requestedId = String(nextTaskId || '').trim();
            if (!requestedId) return;
            if (!isSessionActive()) return;
            try {
                const draftSnapshot = captureInlineSubtaskDraftSnapshot(requestedId);
                const remarkDraftSnapshot = captureRemarkDraftSnapshot(requestedId);
                const nextTask = await resolveDetailNavigationTask(requestedId);
                if (!nextTask || !isSessionActive()) {
                    try { hint('⚠️ 未找到子任务数据，无法打开详情', 'warning'); } catch (e) {}
                    return;
                }
                const nextId = String(nextTask.id || requestedId).trim() || requestedId;
                const effectiveNextId = __tmResolveTaskDetailEffectiveId(nextId) || nextId;
                if (embedded && !root.isConnected) return;
                if (embedded && (String(state.viewMode || '').trim() === 'checklist' || String(state.viewMode || '').trim() === 'whiteboard')) {
                    const currentDetailId = String(state.detailTaskId || '').trim();
                    state.detailTaskId = effectiveNextId;
                    if (!__tmAreTaskDetailIdsEquivalent(effectiveNextId, currentDetailId)) {
                        state.checklistDetailDismissed = false;
                        state.checklistDetailSheetOpen = true;
                    }
                    let refreshed = false;
                    try { refreshed = !!__tmRefreshTaskDetailSheetInPlace(state.modal, `${bindSource}:open-child`); } catch (e) {}
                    try { refreshed = !!__tmRefreshChecklistSelectionInPlace(state.modal, 'detail-open-child') || refreshed; } catch (e) {}
                    if (!refreshed) render();
                    return;
                }
                if (embedded && String(state.viewMode || '').trim() === 'kanban') {
                    state.kanbanDetailTaskId = effectiveNextId;
                    state.kanbanDetailAnchorTaskId = effectiveNextId;
                    if (!__tmRefreshKanbanDetailInPlace(state.modal, { source: `${bindSource}:open-child` })) render();
                    return;
                }
                try { root.__tmTaskDetailTask = nextTask; } catch (e) {}
                try { root.dataset.tmDetailTaskId = effectiveNextId; } catch (e) {}
                try { root.__tmTaskDetailTaskId = effectiveNextId; } catch (e) {}
                try { __tmCloseTaskDetailMoreMenu(); } catch (e) {}
                try {
                    __tmPushDetailDebug('detail-rebuild-html', {
                        taskId: String(effectiveNextId || '').trim(),
                        embedded: embedded === true,
                        source: `${bindSource}:open-child`,
                        rootTag: __tmDescribeDebugElement(root),
                        pendingSave: root.__tmTaskDetailPendingSave === true,
                        hasActivePopover: !!root.__tmTaskDetailActiveInlinePopover,
                        refreshHoldMsLeft: Math.max(0, Number(root.__tmTaskDetailRefreshHoldUntil || 0) - Date.now()),
                    });
                } catch (e) {}
                try { __tmDestroyTaskDetailNoteViewForRoot(root, `${bindSource}:open-child`); } catch (e) {}
                root.innerHTML = __tmBuildTaskDetailInnerHtml(nextTask, opts);
                __tmBindTaskDetailEditor(root, effectiveNextId, { ...options, source: `${bindSource}:open-child`, task: nextTask });
                restoreInlineSubtaskDraftSnapshot(draftSnapshot);
                restoreRemarkDraftSnapshot(remarkDraftSnapshot);
                try { __tmBindFloatingTooltips(root); } catch (e) {}
            } catch (e) {
                try { hint(`❌ 打开子任务详情失败: ${e.message}`, 'error'); } catch (err) {}
            }
        };
        const rerenderChecklistPreserveScroll = () => {
            const modal = state.modal instanceof Element ? state.modal : null;
            const scroller = modal?.querySelector?.('.tm-checklist-scroll');
            const top = Number(scroller?.scrollTop || 0);
            const left = Number(scroller?.scrollLeft || 0);
            if (!state.viewScroll || typeof state.viewScroll !== 'object') state.viewScroll = {};
            state.viewScroll.list = { top, left };
            try { render(); } catch (e) { return; }
            const restore = () => {
                try {
                    const nextScroller = state.modal?.querySelector?.('.tm-checklist-scroll');
                    if (nextScroller) {
                        nextScroller.scrollTop = top;
                        nextScroller.scrollLeft = left;
                    }
                } catch (e) {}
            };
            try { restore(); } catch (e) {}
            try { requestAnimationFrame(restore); } catch (e) {}
            try { setTimeout(restore, 30); } catch (e) {}
        };
        const captureEmbeddedDetailScroll = () => {
            const modal = state.modal instanceof Element ? state.modal : null;
            if (!(modal instanceof Element) || !embedded) return null;
            if (String(state.viewMode || '').trim() !== 'checklist' && String(state.viewMode || '').trim() !== 'whiteboard') return null;
            const panel = __tmResolveChecklistDetailPanel(modal).panel;
            if (!(panel instanceof HTMLElement)) return null;
            return {
                top: Number(panel.scrollTop || 0),
                left: Number(panel.scrollLeft || 0),
            };
        };
        const restoreEmbeddedDetailScroll = (snapshot, options = {}) => {
            if (!snapshot || !embedded) return;
            const opts = (options && typeof options === 'object') ? options : {};
            const restore = () => {
                const modal = state.modal instanceof Element ? state.modal : null;
                if (!(modal instanceof Element)) return;
                const panel = __tmResolveChecklistDetailPanel(modal).panel;
                if (!(panel instanceof HTMLElement)) return;
                if (opts.onlyIfNear === true) {
                    const threshold = Math.max(0, Number(opts.threshold ?? 80) || 80);
                    if (Math.abs(Number(panel.scrollTop || 0) - Number(snapshot.top || 0)) > threshold) return;
                    if (Math.abs(Number(panel.scrollLeft || 0) - Number(snapshot.left || 0)) > threshold) return;
                }
                try {
                    panel.scrollTop = Number(snapshot.top || 0);
                    panel.scrollLeft = Number(snapshot.left || 0);
                } catch (e) {}
            };
            try { restore(); } catch (e) {}
            try { requestAnimationFrame(restore); } catch (e) {}
            try { setTimeout(restore, 30); } catch (e) {}
        };
        const syncMetaChipFaces = () => {
            const startValue = readHiddenInputValue('startDate');
            const endValue = readHiddenInputValue('completionTime');
            const durationValue = readHiddenInputValue('duration');
            const tomatoEstimateValue = readHiddenInputValue('tomatoEstimateCount');
            const focusTaskLike = {
                ...(getBoundTask() || {}),
                duration: durationValue,
                tomatoEstimateCount: tomatoEstimateValue,
                tomato_estimate_count: tomatoEstimateValue,
            };
            const focusSummaryValue = __tmGetTaskTomatoSummaryText(focusTaskLike);
            const pinned = readPinnedValue();

            const startFace = root.querySelector('[data-tm-detail-chip-face="startDate"]');
            if (startFace instanceof HTMLElement) startFace.innerHTML = __tmBuildTaskDetailCoreChipFace('startDate', startValue);
            const startBtn = root.querySelector('[data-tm-detail-date-trigger="startDate"]');
            if (startBtn instanceof HTMLElement) startBtn.classList.toggle('has-value', !!startValue);

            const endFace = root.querySelector('[data-tm-detail-chip-face="completionTime"]');
            if (endFace instanceof HTMLElement) endFace.innerHTML = __tmBuildTaskDetailCoreChipFace('completionTime', endValue);
            const endBtn = root.querySelector('[data-tm-detail-date-trigger="completionTime"]');
            if (endBtn instanceof HTMLElement) endBtn.classList.toggle('has-value', !!endValue);

            const focusSummaryFace = root.querySelector('[data-tm-detail-chip-face="tomatoSummary"]');
            if (focusSummaryFace instanceof HTMLElement) focusSummaryFace.innerHTML = __tmBuildTaskDetailCoreChipFace('tomatoSummary', focusTaskLike);
            const focusSummaryBtn = root.querySelector('[data-tm-detail-focus-summary-trigger]');
            if (focusSummaryBtn instanceof HTMLElement) focusSummaryBtn.classList.toggle('has-value', !!focusSummaryValue);

            syncRepeatChipFace();
            syncReminderChipFace();

            const pinnedFace = root.querySelector('[data-tm-detail-chip-face="pinned"]');
            if (pinnedFace instanceof HTMLElement) pinnedFace.innerHTML = __tmBuildTaskDetailCoreChipFace('pinned', pinned ? '1' : '');
            const pinnedBtn = root.querySelector('[data-tm-detail-pinned-toggle]');
            if (pinnedBtn instanceof HTMLElement) {
                pinnedBtn.classList.toggle('is-active', pinned);
                try { __tmApplyTooltipAttrsToElement(pinnedBtn, pinned ? '取消置顶' : '置顶', { side: 'bottom' }); } catch (e) {}
                try { pinnedBtn.setAttribute('aria-label', pinned ? '取消置顶' : '置顶'); } catch (e) {}
                try { pinnedBtn.removeAttribute('title'); } catch (e) {}
            }
            syncWhiteboardOutline();
        };
        const serializeFormState = (formState = null) => {
            const s = (formState && typeof formState === 'object') ? formState : collectFormState();
            return JSON.stringify([s.nextContent, s.nextStatus, s.nextPriority, s.nextPinned, s.nextStart, s.nextEnd, s.nextDuration, s.nextTomatoEstimateCount, s.nextRemark, s.nextCustomFieldTextValues]);
        };
        const syncSerializedSnapshot = () => {
            try {
                const serialized = serializeFormState(collectFormState());
                if (saving && activeSaveSerialized && serialized !== activeSaveSerialized) return;
                lastSerialized = serialized;
            } catch (e) {}
        };
        const createSaveRequestOptions = (saveOptions = {}) => {
            const opts = (typeof saveOptions === 'object' && saveOptions !== null)
                ? saveOptions
                : { showHint: !!saveOptions };
            return {
                showHint: !!opts.showHint,
                closeAfterSave: !!opts.closeAfterSave,
                preserveFocus: opts.preserveFocus !== false,
                skipRerender: !!opts.skipRerender,
            };
        };
        const mergeSaveRequestOptions = (base = null, next = null) => {
            const left = base && typeof base === 'object' ? base : createSaveRequestOptions();
            const right = next && typeof next === 'object' ? next : createSaveRequestOptions();
            return {
                showHint: !!(left.showHint || right.showHint),
                closeAfterSave: !!(left.closeAfterSave || right.closeAfterSave),
                preserveFocus: left.preserveFocus !== false && right.preserveFocus !== false,
                skipRerender: left.skipRerender === true && right.skipRerender === true,
            };
        };
        const resetQueuedSaveRequest = () => {
            queuedSaveRequested = false;
            queuedSaveOptions = createSaveRequestOptions();
        };
        const queueSaveRequest = (saveOptions = {}) => {
            queuedSaveRequested = true;
            queuedSaveOptions = mergeSaveRequestOptions(queuedSaveOptions, createSaveRequestOptions(saveOptions));
        };
        resetQueuedSaveRequest();
        const shouldDeferAutoSaveWhileFocused = () => {
            try {
                const active = document.activeElement;
                if (!(active instanceof Element) || !root.contains(active)) return false;
                if (active.closest?.('[data-tm-detail=remark]')) return active.dataset?.composing === 'true';
                return false;
            } catch (e) {
                return false;
            }
        };
        const getRemarkTextarea = () => {
            const textarea = root.querySelector('textarea[data-tm-detail=remark]');
            return textarea instanceof HTMLTextAreaElement ? textarea : null;
        };
        const syncRemarkSavedState = (savedValue) => {
            const textarea = getRemarkTextarea();
            if (!textarea) return false;
            try { return __tmSyncTaskDetailRemarkTextareaSavedState(textarea, savedValue); } catch (e) { return false; }
        };
        const isDetailEditorFocused = () => {
            try {
                const active = document.activeElement;
                return !!(active instanceof Element && root.contains(active) && active.closest?.('[data-tm-detail="content"], [data-tm-detail="remark"], [data-tm-detail-custom-text-field], [data-tm-detail-subtask-content], [data-tm-detail-subtask-draft-input]'));
            } catch (e) {
                return false;
            }
        };
        const applyQuickbarAttrUpdateToDetail = (attrKey, attrValue) => {
            const key = String(attrKey || '').trim();
            if (!key) return false;
            const task = getBoundTask();
            if (!task) return false;
            const value = String(attrValue ?? '').trim();
            let nextTask = task;
            let handled = true;
            const taskMetaField = typeof __tmResolveTaskMetaFieldByAttrKey === 'function'
                ? __tmResolveTaskMetaFieldByAttrKey(key)
                : '';
            if (taskMetaField) {
                const meta = typeof __tmBuildMetaPatchFromAttrUpdate === 'function'
                    ? __tmBuildMetaPatchFromAttrUpdate(key, attrValue, nextTask)
                    : null;
                const patch = (meta?.patch && typeof meta.patch === 'object') ? meta.patch : {};
                Object.entries(patch).forEach(([field, nextValue]) => {
                    if (field === 'taskCompleteAt') {
                        const normalized = __tmNormalizeTaskCompleteAtValue(nextValue);
                        nextTask.taskCompleteAt = normalized;
                        nextTask.task_complete_at = normalized;
                    } else if (field === 'milestone') {
                        const milestone = nextValue === true || String(nextValue || '').trim() === '1';
                        nextTask.milestone = milestone;
                        nextTask.custom_milestone = milestone ? '1' : '';
                    } else if (field === 'pinned') {
                        const pin = String(nextValue || '').trim() === '1';
                        nextTask.pinned = pin ? '1' : '';
                        nextTask.custom_pinned = pin ? '1' : '';
                    } else if (field === 'allDayBottom') {
                        const bottom = String(nextValue || '').trim() === '1';
                        nextTask.allDayBottom = bottom ? '1' : '';
                        nextTask.custom_all_day_bottom = bottom ? '1' : '';
                    } else if (typeof __tmApplyTaskMetaAttrValueToTask === 'function') {
                        __tmApplyTaskMetaAttrValueToTask(nextTask, field, nextValue);
                    }
                });
                nextTask = __tmCacheTaskInState(nextTask, {
                    docNameFallback: nextTask.doc_name || nextTask.docName || '未命名文档'
                }) || nextTask;
                if (taskMetaField === 'customStatus') {
                    const input = root.querySelector('input[type="hidden"][data-tm-detail="status"]');
                    if (input instanceof HTMLInputElement) input.value = __tmResolveTaskStatusId(nextTask);
                    refreshStatusSelectUi();
                } else if (taskMetaField === 'priority') {
                    const input = root.querySelector('input[type="hidden"][data-tm-detail="priority"]');
                    if (input instanceof HTMLInputElement) input.value = String(nextTask.priority || '').trim();
                    refreshPrioritySelectUi();
                } else if (taskMetaField === 'startDate') {
                    setHiddenInputValue('startDate', String(nextTask.startDate || '').trim());
                    __tmClearReminderSnapshotCache(String(nextTask.id || taskId || '').trim());
                    syncMetaChipFaces();
                    scheduleReminderButtonStateRefresh();
                } else if (taskMetaField === 'completionTime') {
                    setHiddenInputValue('completionTime', String(nextTask.completionTime || '').trim());
                    __tmClearReminderSnapshotCache(String(nextTask.id || taskId || '').trim());
                    syncMetaChipFaces();
                    scheduleReminderButtonStateRefresh();
                } else if (taskMetaField === 'duration') {
                    setHiddenInputValue('duration', String(nextTask.duration || '').trim());
                    syncMetaChipFaces();
                } else if (taskMetaField === 'remark') {
                    const normalizedRemarkValue = __tmNormalizeRemarkMarkdown(nextTask.remark || '');
                    const textarea = getRemarkTextarea();
                    if (textarea instanceof HTMLTextAreaElement) {
                        const isActiveRemarkEditor = __tmIsTaskDetailRemarkDraftActive(root);
                        if (!isActiveRemarkEditor) {
                            textarea.value = normalizedRemarkValue;
                            syncAutoHeight(textarea, 34);
                        }
                        syncRemarkSavedState(normalizedRemarkValue);
                    }
                    const preview = root.querySelector('[data-tm-detail-remark-preview]');
                    const remarkShell = root.querySelector('[data-tm-detail-remark-shell]');
                    const isEditingRemark = remarkShell instanceof HTMLElement && remarkShell.classList.contains('is-editing');
                    const isDraftActive = __tmIsTaskDetailRemarkDraftActive(root);
                    if (preview instanceof HTMLElement && !isEditingRemark && !isDraftActive) preview.innerHTML = __tmRenderRemarkMarkdown(normalizedRemarkValue);
                } else if (taskMetaField === 'pinned') {
                    setHiddenInputValue('pinned', nextTask.pinned ? '1' : '');
                    syncMetaChipFaces();
                } else {
                    syncMetaChipFaces();
                }
                return true;
            }
            switch (key) {
                case 'custom-status':
                    nextTask.custom_status = value;
                    nextTask.customStatus = value;
                    nextTask = __tmCacheTaskInState(nextTask, {
                        docNameFallback: nextTask.doc_name || nextTask.docName || '未命名文档'
                    }) || nextTask;
                    {
                        const input = root.querySelector('input[type="hidden"][data-tm-detail="status"]');
                        if (input instanceof HTMLInputElement) {
                            input.value = __tmResolveTaskStatusId(nextTask);
                        }
                    }
                    refreshStatusSelectUi();
                    break;
                case 'custom-priority':
                    nextTask.custom_priority = value;
                    nextTask.priority = value;
                    nextTask = __tmCacheTaskInState(nextTask, {
                        docNameFallback: nextTask.doc_name || nextTask.docName || '未命名文档'
                    }) || nextTask;
                    {
                        const input = root.querySelector('input[type="hidden"][data-tm-detail="priority"]');
                        if (input instanceof HTMLInputElement) {
                            input.value = String(nextTask.priority || '').trim();
                        }
                    }
                    refreshPrioritySelectUi();
                    break;
                case 'custom-start-date':
                    nextTask.start_date = value;
                    nextTask.startDate = value;
                    nextTask = __tmCacheTaskInState(nextTask, {
                        docNameFallback: nextTask.doc_name || nextTask.docName || '未命名文档'
                    }) || nextTask;
                    setHiddenInputValue('startDate', String(nextTask.startDate || '').trim());
                    __tmClearReminderSnapshotCache(String(nextTask.id || taskId || '').trim());
                    syncMetaChipFaces();
                    scheduleReminderButtonStateRefresh();
                    break;
                case 'custom-completion-time':
                    nextTask.completion_time = value;
                    nextTask.completionTime = value;
                    nextTask = __tmCacheTaskInState(nextTask, {
                        docNameFallback: nextTask.doc_name || nextTask.docName || '未命名文档'
                    }) || nextTask;
                    setHiddenInputValue('completionTime', String(nextTask.completionTime || '').trim());
                    __tmClearReminderSnapshotCache(String(nextTask.id || taskId || '').trim());
                    syncMetaChipFaces();
                    scheduleReminderButtonStateRefresh();
                    break;
                case 'custom-duration':
                    nextTask.duration = value;
                    nextTask = __tmCacheTaskInState(nextTask, {
                        docNameFallback: nextTask.doc_name || nextTask.docName || '未命名文档'
                    }) || nextTask;
                    setHiddenInputValue('duration', String(nextTask.duration || '').trim());
                    syncMetaChipFaces();
                    break;
                case __tmGetTomatoEstimateAttrKey():
                case 'custom-tomato-estimate-count':
                    nextTask.tomatoEstimateCount = __tmNormalizeTomatoCountValue(value);
                    nextTask.tomato_estimate_count = nextTask.tomatoEstimateCount;
                    nextTask = __tmCacheTaskInState(nextTask, {
                        docNameFallback: nextTask.doc_name || nextTask.docName || '未命名文档'
                    }) || nextTask;
                    setHiddenInputValue('tomatoEstimateCount', nextTask.tomatoEstimateCount);
                    syncMetaChipFaces();
                    break;
                case __tmGetTomatoCountAttrKey():
                case 'custom-tomato-count':
                    nextTask.tomatoCount = __tmNormalizeTomatoCountValue(value);
                    nextTask.tomato_count = nextTask.tomatoCount;
                    nextTask = __tmCacheTaskInState(nextTask, {
                        docNameFallback: nextTask.doc_name || nextTask.docName || '未命名文档'
                    }) || nextTask;
                    syncMetaChipFaces();
                    try { __tmRefreshVisibleTaskDetailForTask(String(nextTask.id || taskId || '').trim()); } catch (e) {}
                    break;
                case __TM_TASK_REPEAT_RULE_ATTR:
                    nextTask.repeatRule = __tmNormalizeTaskRepeatRule(value, {
                        startDate: nextTask?.startDate,
                        completionTime: nextTask?.completionTime,
                    });
                    nextTask.repeat_rule = nextTask.repeatRule;
                    nextTask = __tmCacheTaskInState(nextTask, {
                        docNameFallback: nextTask.doc_name || nextTask.docName || '未命名文档'
                    }) || nextTask;
                    __tmClearReminderSnapshotCache(String(nextTask.id || taskId || '').trim());
                    syncMetaChipFaces();
                    scheduleReminderButtonStateRefresh();
                    break;
                case __TM_TASK_REPEAT_STATE_ATTR:
                    nextTask.repeatState = __tmNormalizeTaskRepeatState(value);
                    nextTask.repeat_state = nextTask.repeatState;
                    nextTask = __tmCacheTaskInState(nextTask, {
                        docNameFallback: nextTask.doc_name || nextTask.docName || '未命名文档'
                    }) || nextTask;
                    __tmClearReminderSnapshotCache(String(nextTask.id || taskId || '').trim());
                    syncMetaChipFaces();
                    scheduleReminderButtonStateRefresh();
                    break;
                case 'custom-remark':
                    nextTask.remark = __tmNormalizeRemarkMarkdown(value);
                    nextTask = __tmCacheTaskInState(nextTask, {
                        docNameFallback: nextTask.doc_name || nextTask.docName || '未命名文档'
                    }) || nextTask;
                    const normalizedRemarkValue = __tmNormalizeRemarkMarkdown(nextTask.remark || '');
                    {
                        const textarea = getRemarkTextarea();
                        if (textarea instanceof HTMLTextAreaElement) {
                            const isActiveRemarkEditor = __tmIsTaskDetailRemarkDraftActive(root);
                            if (!isActiveRemarkEditor) {
                                textarea.value = normalizedRemarkValue;
                                syncAutoHeight(textarea, 34);
                            }
                            syncRemarkSavedState(normalizedRemarkValue);
                        }
                    }
                    {
                        const preview = root.querySelector('[data-tm-detail-remark-preview]');
                        const remarkShell = root.querySelector('[data-tm-detail-remark-shell]');
                        const isEditingRemark = remarkShell instanceof HTMLElement && remarkShell.classList.contains('is-editing');
                        const isDraftActive = __tmIsTaskDetailRemarkDraftActive(root);
                        if (preview instanceof HTMLElement && !isEditingRemark && !isDraftActive) {
                            preview.innerHTML = __tmRenderRemarkMarkdown(normalizedRemarkValue);
                        }
                    }
                    break;
                case 'custom-pinned':
                    nextTask.custom_pinned = value;
                    nextTask.pinned = value;
                    nextTask = __tmCacheTaskInState(nextTask, {
                        docNameFallback: nextTask.doc_name || nextTask.docName || '未命名文档'
                    }) || nextTask;
                    setHiddenInputValue('pinned', nextTask.pinned ? '1' : '');
                    syncMetaChipFaces();
                    break;
                case 'bookmark':
                    nextTask.bookmark = value;
                    nextTask = __tmCacheTaskInState(nextTask, {
                        docNameFallback: nextTask.doc_name || nextTask.docName || '未命名文档'
                    }) || nextTask;
                    __tmClearReminderSnapshotCache(String(nextTask.id || taskId || '').trim());
                    syncReminderChipFace();
                    scheduleReminderButtonStateRefresh();
                    break;
                default:
                    {
                        const customField = __tmGetCustomFieldDefByAttrStorageKey(key);
                        const customFieldId = String(customField?.id || '').trim();
                        if (customField) {
                            __tmApplyTaskCustomFieldValueLocally(nextTask, customField, value);
                            nextTask = __tmCacheTaskInState(nextTask, {
                                docNameFallback: nextTask.doc_name || nextTask.docName || '未命名文档'
                            }) || nextTask;
                            if (String(customField?.type || '').trim() === 'text') {
                                const textarea = root.querySelector(`textarea[data-tm-detail-custom-text-field="${customFieldId}"]`);
                                if (textarea instanceof HTMLTextAreaElement) {
                                    const isActiveTextField = document.activeElement === textarea || textarea.matches(':focus');
                                    if (!isActiveTextField) {
                                        textarea.value = String(__tmNormalizeCustomFieldValue(customField, __tmGetTaskCustomFieldValue(nextTask, customFieldId)) || '').trim();
                                        syncAutoHeight(textarea, 34);
                                    }
                                }
                            } else {
                                const valueWrap = root.querySelector(`[data-tm-detail-custom-field="${customFieldId}"] .tm-task-detail-custom-field-value`);
                                if (valueWrap instanceof HTMLElement) {
                                    valueWrap.innerHTML = __tmBuildCustomFieldDisplayHtml(customField, __tmGetTaskCustomFieldValue(nextTask, customFieldId), {
                                        emptyText: '未设置',
                                        maxTags: String(customField?.type || '').trim() === 'multi' ? 3 : 1
                                    });
                                }
                            }
                            break;
                        }
                        handled = false;
                    }
                    break;
            }
            if (!handled) return false;
            try { root.__tmTaskDetailTask = nextTask; } catch (e) {}
            syncSerializedSnapshot();
            return true;
        };
        on(root.querySelector('[data-tm-detail="more"]'), 'click', (ev) => {
            try { ev.preventDefault(); } catch (e) {}
            try { ev.stopPropagation(); } catch (e) {}
            const boundTaskId = String(getBoundTaskId() || getBoundTask()?.id || taskId || '').trim();
            if (!boundTaskId) return;
            __tmOpenTaskDetailMoreMenu(ev.currentTarget instanceof Element ? ev.currentTarget : root.querySelector('[data-tm-detail="more"]'), boundTaskId);
        });
        on(root, 'click', async (ev) => {
            const target = ev.target instanceof Element ? ev.target : null;
            if (!target) return;
            const toggle = target.closest('[data-tm-detail-whiteboard-outline-toggle]');
            if (toggle instanceof HTMLElement && root.contains(toggle)) {
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                openWhiteboardOutlinePopover(toggle);
                return;
            }
            const node = target.closest('[data-tm-detail-whiteboard-outline-node]');
            if (!(node instanceof HTMLElement) || !root.contains(node)) return;
            if (isWhiteboardOutlineCheckboxTarget(target)) return;
            try { ev.preventDefault(); } catch (e) {}
            try { ev.stopPropagation(); } catch (e) {}
            const nodeTaskId = String(node.getAttribute('data-task-id') || '').trim();
            const jumped = await window.tmJumpToWhiteboardTask?.(nodeTaskId || getBoundTaskId() || taskId, ev);
            const keepChecklistSideDetailOpen = embedded && String(root.id || '').trim() === 'tmChecklistDetailPanel';
            if (jumped !== false && !keepChecklistSideDetailOpen) await close();
        });
        on(root.querySelector('[data-tm-detail="close"]'), 'click', close);
        on(root.querySelector('[data-tm-detail="cancel"]'), 'click', close);
        const jumpBtn = root.querySelector('[data-tm-detail="jump"]');
        on(jumpBtn, 'click', async (ev) => {
            try { ev.preventDefault(); } catch (e) {}
            try {
                const boundTaskId = String(getBoundTask()?.id || taskId || '').trim();
                if (typeof __tmIsOptimisticTempTaskId === 'function' && __tmIsOptimisticTempTaskId(boundTaskId)) {
                    try { hint('⏳ 任务正在写入，完成后可跳转到原文档', 'info'); } catch (e) {}
                    return;
                }
                const jumped = await tmJumpToTask(boundTaskId || taskId, ev);
                const keepChecklistSideDetailOpen = embedded && String(root.id || '').trim() === 'tmChecklistDetailPanel';
                if (jumped !== false && !keepChecklistSideDetailOpen) await close();
            } catch (e) {}
        });
        on(root.querySelector('[data-tm-detail="location-doc"]'), 'click', (ev) => {
            try { ev.preventDefault(); } catch (e) {}
            try { ev.stopPropagation(); } catch (e) {}
            try { tmPickTaskDocInline(getBoundTaskId() || taskId, ev.currentTarget, ev); } catch (e) {}
        });
        on(root.querySelector('[data-tm-detail="location-heading"]'), 'click', (ev) => {
            try { ev.preventDefault(); } catch (e) {}
            try { ev.stopPropagation(); } catch (e) {}
            try { tmPickHeadingInline(getBoundTaskId() || taskId, ev.currentTarget, ev); } catch (e) {}
        });
        on(root.querySelector('[data-tm-detail="editPrompt"]'), 'click', (ev) => {
            try { ev.preventDefault(); } catch (e) {}
            try { tmEdit(getBoundTaskId() || taskId); } catch (e) {}
        });
        const collectFormState = () => {
            const task = getBoundTask();
            const normalize = (s) => {
                const v = String(s || '').trim();
                if (!v) return '';
                try { if (typeof __tmNormalizeDateOnly === 'function') return __tmNormalizeDateOnly(v); } catch (e) {}
                return v;
            };
            const nextContent = String(root.querySelector('[data-tm-detail="content"]')?.value || '').trim();
            const nextStatus = String(root.querySelector('[data-tm-detail="status"]')?.value || '').trim()
                || __tmResolveTaskStatusId(task)
                || __tmGetDefaultUndoneStatusId(SettingsStore?.data?.customStatusOptions || []);
            const nextPriority = String(root.querySelector('[data-tm-detail="priority"]')?.value || '').trim();
            const pinnedInput = root.querySelector('[data-tm-detail="pinned"]');
            const nextPinned = (pinnedInput instanceof HTMLInputElement)
                ? (pinnedInput.type === 'checkbox' ? !!pinnedInput.checked : !!String(pinnedInput.value || '').trim())
                : false;
            const nextStart = normalize(root.querySelector('[data-tm-detail="startDate"]')?.value);
            const nextEnd = normalize(root.querySelector('[data-tm-detail="completionTime"]')?.value);
            const nextDuration = String(root.querySelector('[data-tm-detail="duration"]')?.value || '').trim();
            const nextTomatoEstimateCount = __tmNormalizeTomatoCountValue(root.querySelector('[data-tm-detail="tomatoEstimateCount"]')?.value || '');
            const nextRemark = __tmNormalizeRemarkMarkdown(root.querySelector('[data-tm-detail="remark"]')?.value || '');
            const nextCustomFieldTextValues = collectCustomTextFieldValues();
            return {
                task,
                nextContent,
                nextStatus,
                nextPriority,
                nextPinned,
                nextStart,
                nextEnd,
                nextDuration,
                nextTomatoEstimateCount,
                nextRemark,
                nextCustomFieldTextValues
            };
        };
        const buildDetailDiff = (taskLike, formState) => {
            const task0 = (taskLike && typeof taskLike === 'object') ? taskLike : {};
            const currentContent = String(task0.content || '').trim();
            const currentStatus = __tmResolveTaskStatusId(task0);
            const currentPriority = String(task0.priority || task0.custom_priority || '').trim();
            const currentPinned = !!(task0.pinned === true || task0.pinned === '1' || task0.pinned === 1 || String(task0.custom_pinned || '').trim() === '1');
            const currentStart = String(task0.startDate || task0.start_date || '').trim();
            const currentEnd = String(task0.completionTime || task0.completion_time || '').trim();
            const currentDuration = String(task0.duration || '').trim();
            const currentTomatoEstimateCount = __tmGetTaskTomatoEstimateCount(task0);
            const currentRemark = __tmNormalizeRemarkMarkdown(__tmGetTaskDetailRemarkRaw(task0));

            const metaPatch = {};
            const timePatch = {};
            const changedKeys = [];
            const changedCustomFieldTextValues = {};

            const contentChanged = formState.nextContent !== currentContent;
            const statusChanged = formState.nextStatus !== currentStatus;

            if (formState.nextPriority !== currentPriority) {
                metaPatch.priority = formState.nextPriority;
                changedKeys.push('priority');
            }
            if (formState.nextPinned !== currentPinned) {
                metaPatch.pinned = formState.nextPinned ? '1' : '';
                changedKeys.push('pinned');
            }
            if (formState.nextStart !== currentStart) {
                timePatch.startDate = formState.nextStart;
                changedKeys.push('startDate');
            }
            if (formState.nextEnd !== currentEnd) {
                timePatch.completionTime = formState.nextEnd;
                changedKeys.push('completionTime');
            }
            if (formState.nextDuration !== currentDuration) {
                timePatch.duration = formState.nextDuration;
                changedKeys.push('duration');
            }
            if (formState.nextTomatoEstimateCount !== currentTomatoEstimateCount) {
                metaPatch.tomatoEstimateCount = formState.nextTomatoEstimateCount;
                changedKeys.push('tomatoEstimateCount');
            }
            if (formState.nextRemark !== currentRemark) {
                metaPatch.remark = formState.nextRemark;
                changedKeys.push('remark');
            }

            Object.entries(formState.nextCustomFieldTextValues || {}).forEach(([fieldId, fieldValue]) => {
                const customFieldId = String(fieldId || '').trim();
                const field = __tmGetCustomFieldDefMap().get(customFieldId);
                if (!field || String(field?.type || '').trim() !== 'text') return;
                const normalizedNext = String(__tmNormalizeCustomFieldValue(field, fieldValue) || '').trim();
                const currentValue = String(__tmNormalizeCustomFieldValue(field, __tmGetTaskCustomFieldValue(task0, customFieldId)) || '').trim();
                if (normalizedNext === currentValue) return;
                changedCustomFieldTextValues[customFieldId] = normalizedNext;
                changedKeys.push(__tmBuildCustomFieldColumnKey(customFieldId));
            });
            if (Object.keys(changedCustomFieldTextValues).length > 0) {
                metaPatch.customFieldValues = changedCustomFieldTextValues;
            }

            const pureTimeOnly = !contentChanged
                && !statusChanged
                && changedKeys.length > 0
                && changedKeys.every((key) => key === 'startDate' || key === 'completionTime' || key === 'duration' || key === 'tomatoEstimateCount');

            return {
                contentChanged,
                statusChanged,
                metaPatch,
                timePatch,
                changedCustomFieldTextValues,
                changedKeys,
                pureTimeOnly,
            };
        };
        const runSaveOnce = async (saveOptions = true) => {
            const opts = createSaveRequestOptions(saveOptions);
            const showHint = !!opts.showHint;
            const closeAfterSave = !!opts.closeAfterSave;
            const preserveFocus = opts.preserveFocus !== false;
            const skipRerender = !!opts.skipRerender;
            const formState = collectFormState();
            const {
                task,
                nextContent,
                nextStatus,
                nextPriority,
                nextPinned,
                nextStart,
                nextEnd,
                nextDuration,
                nextTomatoEstimateCount,
                nextRemark,
                nextCustomFieldTextValues
            } = formState;
            try {
                if (nextStart !== String(task?.startDate || '').trim() || nextEnd !== String(task?.completionTime || '').trim()) {
                    
                }
            } catch (e) {}
            if (!task) {
                try {
                    __tmPushDetailDebug('detail-save-skip', {
                        taskId: String(taskId || '').trim(),
                        reason: 'task-missing',
                        showHint,
                    });
                } catch (e) {}
                if (showHint) hint('⚠️ 未找到任务数据，无法保存', 'warning');
                return false;
            }
            if (!nextContent) {
                try {
                    __tmPushDetailDebug('detail-save-skip', {
                        taskId: String(task?.id || taskId || '').trim(),
                        reason: 'content-empty',
                        showHint,
                    });
                } catch (e) {}
                if (showHint) hint('⚠️ 任务内容不能为空', 'warning');
                return false;
            }
            const serialized = serializeFormState(formState);
            if (serialized === lastSerialized && !showHint) {
                try {
                    __tmPushDetailDebug('detail-save-skip', {
                        taskId: String(task?.id || taskId || '').trim(),
                        reason: 'serialized-same',
                        showHint,
                    });
                } catch (e) {}
                return true;
            }
            if (saving) {
                try {
                    __tmPushDetailDebug('detail-save-skip', {
                        taskId: String(task?.id || taskId || '').trim(),
                        reason: 'already-saving',
                        activeSaveSerialized,
                    });
                } catch (e) {}
                return false;
            }
            setTaskDetailPendingSave(true);
            saving = true;
            activeSaveSerialized = serialized;
            const detailScrollSnapshotForSave = (() => {
                try {
                    if (embedded) return __tmCaptureChecklistDetailScrollSnapshot(state.modal);
                    return __tmCaptureStandaloneTaskDetailScrollSnapshot();
                } catch (e) {
                    return null;
                }
            })();

            try {
                const diff = buildDetailDiff(task, formState);
                try {
                    __tmPushDetailDebug('detail-save-start', {
                        taskId: String(task.id || '').trim(),
                        embedded: embedded === true,
                        showHint,
                        closeAfterSave,
                        preserveFocus,
                        skipRerender,
                        changedKeys: diff.changedKeys.slice(),
                        pureTimeOnly: diff.pureTimeOnly,
                    });
                } catch (e) {}
                if (!__tmIsCollectedOtherBlockTask(task) && diff.contentChanged) {
                    try {
                        __tmPushDetailDebug('detail-save-content-patch', {
                            taskId: String(task.id || '').trim(),
                            mode: 'background-queue',
                        });
                    } catch (e) {}
                    const patchContent = globalThis.__tmRequireTaskOutbox?.('patchContent');
                    if (typeof patchContent !== 'function') throw new Error('任务写入队列未就绪: patchContent');
                    const contentSavePromise = patchContent(task.id, nextContent, {
                        background: true,
                        skipInteractionGate: true,
                        defer: false,
                    });
                    Promise.resolve(contentSavePromise).catch((e) => {
                        try {
                            __tmPushDetailDebug('detail-save-content-patch-error', {
                                taskId: String(task.id || '').trim(),
                                error: String(e?.message || e || ''),
                            });
                        } catch (e2) {}
                        if (showHint) {
                            try { hint(`❌ 内容保存失败: ${e.message}`, 'error'); } catch (e2) {}
                        }
                    });
                }
                const fieldPatch = {
                    ...(diff.statusChanged ? { customStatus: nextStatus } : {}),
                    ...((diff.timePatch && typeof diff.timePatch === 'object') ? diff.timePatch : {}),
                    ...((diff.metaPatch && typeof diff.metaPatch === 'object') ? diff.metaPatch : {}),
                };
                if (Object.keys(fieldPatch).length > 0) {
                    try {
                        __tmPushDetailDebug('detail-save-field-patch', {
                            taskId: String(task.id || '').trim(),
                            fieldKeys: Object.keys(fieldPatch),
                            fieldPatch: { ...fieldPatch },
                        });
                    } catch (e) {}
                    const needsFieldProjectionRefresh = (() => {
                        try {
                            return typeof __tmDoesPatchNeedProjectionRefresh === 'function'
                                ? __tmDoesPatchNeedProjectionRefresh(task.id, fieldPatch, {})
                                : __tmDoesPatchAffectProjection(task.id, fieldPatch);
                        } catch (e) {
                            try { return __tmDoesPatchAffectProjection(task.id, fieldPatch); } catch (e2) {}
                            return false;
                        }
                    })();
                    const patchTask = globalThis.__tmRequireTaskOutbox?.('patchTask');
                    if (typeof patchTask !== 'function') throw new Error('任务写入队列未就绪: patchTask');
                    const fieldSavePromise = patchTask(task.id, fieldPatch, {
                        source: 'detail',
                        label: '任务字段',
                        background: true,
                        wait: false,
                        defer: false,
                        skipInteractionGate: true,
                        skipSettledRefresh: true,
                        forceChecklistBehavior: false,
                        withFilters: needsFieldProjectionRefresh,
                        reason: diff.pureTimeOnly ? 'detail-time-save' : 'detail-save',
                        forceProjectionRefresh: needsFieldProjectionRefresh,
                        skipDetailPatch: true,
                        skipViewRefresh: true,
                        broadcast: false,
                        showErrorHint: showHint,
                    });
                    Promise.resolve(fieldSavePromise).then((result) => {
                        if (result !== false) return;
                        try {
                            __tmPushDetailDebug('detail-save-field-patch-returned-false', {
                                taskId: String(task.id || '').trim(),
                                fieldKeys: Object.keys(fieldPatch),
                            });
                        } catch (e) {}
                    }).catch((e) => {
                        try {
                            __tmPushDetailDebug('detail-save-field-patch-error', {
                                taskId: String(task.id || '').trim(),
                                fieldKeys: Object.keys(fieldPatch),
                                error: String(e?.message || e || ''),
                            });
                        } catch (e2) {}
                        if (showHint) {
                            try { hint(`❌ 任务字段保存失败: ${e.message}`, 'error'); } catch (e2) {}
                        }
                    });
                    try {
                        __tmRefreshTaskFieldsAcrossViews(task.id, fieldPatch, {
                            withFilters: needsFieldProjectionRefresh,
                            reason: diff.pureTimeOnly ? 'detail-time-save' : 'detail-save',
                            forceProjectionRefresh: needsFieldProjectionRefresh,
                            fallback: needsFieldProjectionRefresh,
                            skipDetailPatch: true,
                        });
                    } catch (e) {}
                }
                const latestTask = state.flatTasks?.[String(task.id || '').trim()] || task;
                if (Object.prototype.hasOwnProperty.call(diff.timePatch || {}, 'startDate')
                    || Object.prototype.hasOwnProperty.call(diff.timePatch || {}, 'completionTime')) {
                    try {
                        const calApi = globalThis.__tmCalendar;
                        const calendarPatch = {
                            startDate: String(latestTask?.startDate ?? nextStart ?? '').trim(),
                            completionTime: String(latestTask?.completionTime ?? nextEnd ?? '').trim(),
                        };
                        if (typeof calApi?.syncTaskDatePatchInPlace === 'function') {
                            calApi.syncTaskDatePatchInPlace(task.id, calendarPatch, { reason: 'detail-time-save' });
                        } else if (typeof calApi?.syncTaskDateInPlace === 'function') {
                            Promise.resolve(calApi.syncTaskDateInPlace(task.id, { main: true, side: true })).then((summary) => {
                                if (summary?.needsMainRefresh || summary?.needsSideRefresh) {
                                    calApi.requestRefresh?.({
                                        reason: 'detail-time-save',
                                        main: summary.needsMainRefresh === true,
                                        side: summary.needsSideRefresh === true,
                                        flushTaskPanel: false,
                                    });
                                }
                            }).catch(() => null);
                        }
                    } catch (e) {}
                }
                if (diff.contentChanged) {
                    try { syncTaskContentInVisibleViews(latestTask); } catch (e) {}
                    if (shouldRefreshContentProjection(latestTask?.id || task.id, latestTask)) {
                        try {
                            const detail = {
                                mode: 'current',
                                withFilters: true,
                                reason: 'detail-content-save',
                                taskIds: [String(latestTask?.id || task.id || '').trim()].filter(Boolean),
                            };
                            const busy = typeof __tmGetBusyTaskDetailBarrier === 'function'
                                ? __tmGetBusyTaskDetailBarrier()
                                : null;
                            if (busy && typeof __tmScheduleBusyDetailViewRefresh === 'function') {
                                __tmScheduleBusyDetailViewRefresh(detail);
                            } else {
                                __tmScheduleViewRefresh(detail);
                            }
                        } catch (e) {}
                    }
                }
                if (!isSessionActive(task.id)) {
                    try { __tmInvalidateTasksQueryCacheByDocId(task.root_id || task.docId); } catch (e) {}
                    return true;
                }
                try { root.__tmTaskDetailTask = latestTask; } catch (e) {}
                refreshStatusSelectUi();
                refreshPrioritySelectUi();
                syncMetaChipFaces();
                try { __tmInvalidateTasksQueryCacheByDocId(task.root_id || task.docId); } catch (e) {}
                lastSerialized = serialized;
                if (Object.prototype.hasOwnProperty.call(fieldPatch || {}, 'remark')) {
                    syncRemarkSavedState(nextRemark);
                }
                const currentSerialized = (() => {
                    try {
                        return serializeFormState(collectFormState());
                    } catch (e) {
                        return serialized;
                    }
                })();
                if (currentSerialized !== serialized) {
                    try {
                        __tmPushDetailDebug('detail-save-queue-follow-up', {
                            taskId: String(task.id || '').trim(),
                            previousSerialized: serialized,
                            currentSerialized,
                        });
                    } catch (e) {}
                    queueSaveRequest({
                        showHint: false,
                        closeAfterSave: false,
                        preserveFocus: true,
                        skipRerender: true,
                    });
                }
                try {
                    __tmPushDetailDebug('detail-save-success', {
                        taskId: String(task.id || '').trim(),
                        changedKeys: diff.changedKeys.slice(),
                        closeAfterSave,
                        queuedSaveRequested: !!queuedSaveRequested,
                    });
                } catch (e) {}
                if (showHint) hint('✅ 已保存', 'success');
                if (!embedded && closeAfterSave) close();
                return true;
            } catch (e) {
                try {
                    __tmPushDetailDebug('detail-save-error', {
                        taskId: String(task?.id || taskId || '').trim(),
                        error: String(e?.message || e || ''),
                    });
                } catch (e2) {}
                if (showHint) hint(`❌ 保存失败: ${e.message}`, 'error');
                return false;
            } finally {
                try {
                    if (embedded) __tmRestoreChecklistDetailScrollSnapshot(detailScrollSnapshotForSave, state.modal);
                    else __tmRestoreStandaloneTaskDetailScrollSnapshot(detailScrollSnapshotForSave);
                } catch (e) {}
                activeSaveSerialized = '';
                saving = false;
                setTaskDetailPendingSave(false);
            }
        };
        const doSave = async (saveOptions = true) => {
            const requestOptions = createSaveRequestOptions(saveOptions);
            if (savePromise) {
                setTaskDetailPendingSave(true);
                const currentSerialized = (() => {
                    try {
                        return serializeFormState(collectFormState());
                    } catch (e) {
                        return '';
                    }
                })();
                const needsFollowUpSave = !!currentSerialized && currentSerialized !== activeSaveSerialized;
                try {
                    __tmPushDetailDebug('detail-save-join-existing', {
                        taskId: String(taskId || '').trim(),
                        needsFollowUpSave,
                        currentSerialized,
                        activeSaveSerialized,
                        requestOptions: { ...requestOptions },
                    });
                } catch (e) {}
                if (needsFollowUpSave) {
                    queueSaveRequest(requestOptions);
                }
                const result = await savePromise;
                if (!needsFollowUpSave) {
                    if (result && requestOptions.showHint) hint('✅ 已保存', 'success');
                    if (result && !embedded && requestOptions.closeAfterSave) {
                        try { await close(); } catch (e) {}
                    }
                }
                return result;
            }
            let initialOptions = requestOptions;
            if (queuedSaveRequested) {
                initialOptions = mergeSaveRequestOptions(queuedSaveOptions, initialOptions);
                resetQueuedSaveRequest();
            }
            setTaskDetailPendingSave(true);
            try {
                __tmPushDetailDebug('detail-save-create-promise', {
                    taskId: String(taskId || '').trim(),
                    initialOptions: { ...initialOptions },
                });
            } catch (e) {}
            savePromise = (async () => {
                let nextOptions = initialOptions;
                let result = true;
                while (nextOptions) {
                    try {
                        __tmPushDetailDebug('detail-save-loop', {
                            taskId: String(taskId || '').trim(),
                            loopOptions: { ...nextOptions },
                            queuedSaveRequested: !!queuedSaveRequested,
                        });
                    } catch (e) {}
                    result = await runSaveOnce(nextOptions);
                    if (result === false) return false;
                    if (!queuedSaveRequested) break;
                    nextOptions = queuedSaveOptions;
                    resetQueuedSaveRequest();
                }
                return result;
            })();
            try {
                return await savePromise;
            } finally {
                savePromise = null;
                setTaskDetailPendingSave(false);
            }
        };
        on(root.querySelector('[data-tm-detail="save"]'), 'click', async () => {
            if (autoSaveTimer) {
                try { clearTimeout(autoSaveTimer); } catch (e) {}
                autoSaveTimer = null;
            }
            await doSave({ showHint: true, closeAfterSave: true });
        });
        syncSerializedSnapshot();
        const scheduleAutoSave = () => {
            if (autoSaveTimer) {
                try { clearTimeout(autoSaveTimer); } catch (e) {}
            }
            autoSaveTimer = setTimeout(() => {
                if (shouldDeferAutoSaveWhileFocused()) {
                    scheduleAutoSave();
                    return;
                }
                autoSaveTimer = null;
                doSave({ showHint: false, closeAfterSave: false, preserveFocus: true, skipRerender: true }).catch(() => null);
            }, 1600);
        };
        const flushAutoSaveNow = async (saveOptions = {}) => {
            if (autoSaveTimer) {
                try { clearTimeout(autoSaveTimer); } catch (e) {}
                autoSaveTimer = null;
            }
            return await doSave(saveOptions);
        };
        try { root.__tmTaskDetailFlushSave = flushAutoSaveNow; } catch (e) {}
        const isNoteViewCandidate = (candidate, repeatSeriesId = '') => {
            const item = (candidate && typeof candidate === 'object') ? candidate : null;
            if (!item) return false;
            if (!__tmGetTaskDetailBlockId(item)) return false;
            if (String(item.isVirtual || '').trim() === 'true' || item.isVirtual === true) return false;
            try {
                if (typeof __tmIsCollectedOtherBlockTask === 'function' && __tmIsCollectedOtherBlockTask(item)) return false;
            } catch (e) {}
            if (item.isOtherBlock === true) return false;
            if (__tmIsTaskDetailRecurringInstance(item)) return false;
            if (repeatSeriesId) {
                const itemSeries = String(item.repeatSeriesId || item.repeat_series_id || '').trim();
                if (itemSeries && itemSeries !== repeatSeriesId) return false;
            }
            return true;
        };
        const findRepeatTemplateTaskForNoteView = async (task) => {
            const sourceTask = (task && typeof task === 'object') ? task : null;
            if (!sourceTask) return null;
            const recurringSourceTaskId = __tmGetTaskDetailRecurringSourceTaskId(sourceTask);
            if (recurringSourceTaskId) {
                const sourceCandidate = globalThis.__tmRuntimeState?.getTaskById?.(recurringSourceTaskId, { includePending: true, preferPending: true })
                    || state.flatTasks?.[recurringSourceTaskId]
                    || state.pendingInsertedTasks?.[recurringSourceTaskId]
                    || null;
                if (isNoteViewCandidate(sourceCandidate)) return sourceCandidate;
                try {
                    const ensured = await __tmEnsureTaskInStateById(recurringSourceTaskId);
                    if (isNoteViewCandidate(ensured)) return ensured;
                } catch (e) {}
                try {
                    const blockTask = await __tmBuildTaskLikeFromBlockId(recurringSourceTaskId);
                    if (isNoteViewCandidate(blockTask)) return blockTask;
                } catch (e) {}
            }
            const repeatSeriesId = String(sourceTask.repeatSeriesId || sourceTask.repeat_series_id || '').trim();
            if (repeatSeriesId) {
                const containers = [
                    globalThis.__tmRuntimeState?.getTasks?.(),
                    state.flatTasks,
                    state.pendingInsertedTasks,
                ];
                for (const container of containers) {
                    const list = Array.isArray(container)
                        ? container
                        : Object.values((container && typeof container === 'object') ? container : {});
                    for (const candidate of list) {
                        if (isNoteViewCandidate(candidate, repeatSeriesId)) return candidate;
                    }
                }
            }
            const templateBlockId = String(
                sourceTask.templateBlockId
                || sourceTask.repeatTemplateBlockId
                || sourceTask.repeat_template_block_id
                || sourceTask.repeatState?.templateBlockId
                || ''
            ).trim();
            if (templateBlockId) {
                try {
                    const templateTask = await __tmBuildTaskLikeFromBlockId(templateBlockId);
                    if (isNoteViewCandidate(templateTask)) return templateTask;
                } catch (e) {}
            }
            try {
                if (typeof __tmResolveTaskForRepeat === 'function') {
                    const resolved = await __tmResolveTaskForRepeat(sourceTask.id);
                    if (isNoteViewCandidate(resolved, repeatSeriesId)) return resolved;
                }
            } catch (e) {}
            return null;
        };
        const resolveTaskForNoteView = async () => {
            const boundTask = getBoundTask();
            let task = (boundTask && typeof boundTask === 'object') ? boundTask : null;
            const requestedId = String(getBoundTaskId() || task?.id || taskId || '').trim();
            if (!task && requestedId) {
                task = await resolveDetailNavigationTask(requestedId);
            }
            if (!task) return null;
            if (__tmIsTaskDetailRecurringInstance(task)) {
                return await findRepeatTemplateTaskForNoteView(task);
            }
            if (isNoteViewCandidate(task)) return task;
            const templateTask = await findRepeatTemplateTaskForNoteView(task);
            if (templateTask) return templateTask;
            if (requestedId) {
                try {
                    const fromBlock = await __tmBuildTaskLikeFromBlockId(requestedId);
                    if (isNoteViewCandidate(fromBlock)) return fromBlock;
                } catch (e) {}
            }
            return null;
        };
        const mountTaskDetailNoteView = async (noteTask, blockId, reason = 'note-view-open') => {
            const taskForNote = (noteTask && typeof noteTask === 'object') ? noteTask : null;
            const bid = String(blockId || __tmGetTaskDetailBlockId(taskForNote) || '').trim();
            if (!taskForNote || !bid || !root.isConnected) return false;
            const ProtyleCtor = globalThis.__tmHost?.getProtyleCtor?.();
            const app = globalThis.__tmHost?.getApp?.();
            if (typeof ProtyleCtor !== 'function' || !app) return false;
            const noteTaskId = String(taskForNote.id || taskId || '').trim();
            try { root.__tmTaskDetailTask = taskForNote; } catch (e) {}
            try { root.dataset.tmDetailTaskId = noteTaskId; } catch (e) {}
            try { root.__tmTaskDetailTaskId = noteTaskId; } catch (e) {}
            try { root.__tmTaskDetailNoteActive = true; } catch (e) {}
            try { root.__tmTaskDetailNoteBlockId = bid; } catch (e) {}
            try { root.__tmTaskDetailNoteRootId = __tmGetTaskDetailRootId(taskForNote); } catch (e) {}
            try { root.setAttribute('data-tm-detail-view', 'note'); } catch (e) {}
            try { root.__tmTaskDetailDestroyNoteView = destroyTaskDetailNoteView; } catch (e) {}
            try { root.__tmTaskDetailFlushNoteView = (flushReason = 'manual') => flushTaskDetailNoteTxRefresh(taskForNote, bid, flushReason); } catch (e) {}
            try { __tmSetTaskDetailNoteViewState(taskDetailNoteScope, taskForNote, bid); } catch (e) {}
            let noteReturnPending = false;
            const returnToDetailView = async (event, reason = 'note-return') => {
                try { event.preventDefault(); } catch (e) {}
                try { event.stopPropagation(); } catch (e) {}
                try { event.stopImmediatePropagation(); } catch (e) {}
                if (noteReturnPending) return;
                noteReturnPending = true;
                try {
                    await rebuildDetailFromNoteView(taskForNote, reason);
                } finally {
                    if (root.isConnected && __tmIsTaskDetailNoteViewActive(root, noteTaskId)) {
                        noteReturnPending = false;
                    }
                }
            };
            const detailViewBtn = root.querySelector('[data-tm-detail="detail-view"]');
            on(detailViewBtn, 'pointerdown', (event) => {
                if (event?.button != null && event.button !== 0) return;
                returnToDetailView(event, 'note-return').catch(() => null);
            }, { capture: true });
            on(detailViewBtn, 'click', (event) => {
                returnToDetailView(event, 'note-return').catch(() => null);
            });
            on(root.querySelector('[data-tm-detail="close"]'), 'click', close);
            const mount = root.querySelector('[data-tm-detail-note-mount]');
            if (!(mount instanceof HTMLElement)) {
                await rebuildDetailFromNoteView(taskForNote, 'note-mount-missing');
                return false;
            }
            taskDetailNoteMount = mount;
            taskDetailNoteBlockId = bid;
            on(mount, 'pointerdown', markTaskDetailNoteEditing, { capture: true });
            on(mount, 'keydown', markTaskDetailNoteEditing, { capture: true });
            on(mount, 'beforeinput', markTaskDetailNoteEditing, { capture: true });
            on(mount, 'input', markTaskDetailNoteEditing, { capture: true });
            on(mount, 'paste', markTaskDetailNoteEditing, { capture: true });
            on(mount, 'cut', markTaskDetailNoteEditing, { capture: true });
            on(mount, 'compositionstart', markTaskDetailNoteEditing, { capture: true });
            on(mount, 'compositionupdate', markTaskDetailNoteEditing, { capture: true });
            on(mount, 'compositionend', markTaskDetailNoteEditing, { capture: true });
            on(document, 'pointerdown', (event) => {
                const target = event?.target;
                if (!(target instanceof Element) || mount.contains(target)) return;
                if (target.closest?.('[data-tm-detail="detail-view"]')) return;
                flushTaskDetailNoteTxRefresh(taskForNote, bid, 'detail-note-view-outside-pointer').catch(() => null);
            }, { capture: true });
            const protyleOptions = {
                blockId: bid,
                action: [],
                mode: 'wysiwyg',
                render: {
                    title: false,
                    breadcrumb: false,
                    gutter: false,
                    scroll: false,
                },
            };
            const rootId = __tmGetTaskDetailRootId(taskForNote);
            if (rootId) protyleOptions.rootId = rootId;
            try {
                taskDetailNoteProtyle = new ProtyleCtor(app, mount, protyleOptions);
                try { installTaskDetailNoteTxBridge(taskForNote, bid); } catch (e) {}
                try { __tmBindFloatingTooltips(root); } catch (e) {}
                try {
                    __tmPushDetailDebug('detail-note-view-open', {
                        taskId: noteTaskId,
                        blockId: bid,
                        rootId,
                        reason: String(reason || '').trim() || 'note-view-open',
                    });
                } catch (e) {}
                return true;
            } catch (e) {
                try { await rebuildDetailFromNoteView(taskForNote, 'note-open-failed'); } catch (e2) {}
                return false;
            }
        };
        const refreshTaskAfterNoteView = async (noteTask, reason = 'detail-note-view-return') => {
            const sourceTask = (noteTask && typeof noteTask === 'object') ? noteTask : getBoundTask();
            const blockId = __tmGetTaskDetailBlockId(sourceTask);
            const rootId = __tmGetTaskDetailRootId(sourceTask);
            let refreshedTask = null;
            if (blockId) {
                try { refreshedTask = await __tmBuildTaskLikeFromBlockId(blockId); } catch (e) { refreshedTask = null; }
            }
            if (!refreshedTask) {
                const tid = String(sourceTask?.id || getBoundTaskId() || taskId || '').trim();
                if (tid) {
                    try { refreshedTask = await __tmEnsureTaskInStateById(tid); } catch (e) { refreshedTask = null; }
                }
            }
            if (refreshedTask) {
                try { refreshedTask = patchLoadedTaskBlockForDetail(refreshedTask) || refreshedTask; } catch (e) {}
                try { refreshedTask = preserveTaskDetailChildren(refreshedTask, sourceTask) || refreshedTask; } catch (e) {}
                try { refreshedTask = cacheTaskTreeForDetail(refreshedTask) || refreshedTask; } catch (e) {}
                try { root.__tmTaskDetailTask = refreshedTask; } catch (e) {}
            }
            try { if (rootId) __tmInvalidateTasksQueryCacheByDocId(rootId); } catch (e) {}
            return refreshedTask || sourceTask || null;
        };
        const rebuildDetailFromNoteView = async (noteTask, reason = 'detail-note-view-return') => {
            const sourceTask = (noteTask && typeof noteTask === 'object') ? noteTask : getBoundTask();
            try { await flushTaskDetailNoteTxRefresh(sourceTask, taskDetailNoteBlockId || __tmGetTaskDetailBlockId(sourceTask), reason); } catch (e) {}
            destroyTaskDetailNoteView(reason);
            const nextTask = await refreshTaskAfterNoteView(sourceTask, reason);
            const nextId = String(nextTask?.id || sourceTask?.id || getBoundTaskId() || taskId || '').trim();
            if (!nextTask || !nextId || !root.isConnected) return;
            try { root.__tmTaskDetailTask = nextTask; } catch (e) {}
            try { root.dataset.tmDetailTaskId = nextId; } catch (e) {}
            try { root.__tmTaskDetailTaskId = nextId; } catch (e) {}
            root.innerHTML = __tmBuildTaskDetailInnerHtml(nextTask, opts);
            __tmBindTaskDetailEditor(root, nextId, {
                ...opts,
                source: `${bindSource}:${String(reason || '').trim() || 'note-return'}`,
                task: nextTask,
            });
            try { __tmBindFloatingTooltips(root); } catch (e) {}
        };
        if (isPreRenderedNoteView) {
            const noteTask = initialTask || getBoundTask();
            const noteBlockId = __tmGetTaskDetailBlockId(noteTask);
            Promise.resolve(mountTaskDetailNoteView(noteTask, noteBlockId, `${bindSource}:rendered-note`)).then((ok) => {
                if (ok || !root.isConnected || !root.querySelector?.('[data-tm-detail-note-mount]')) return;
                try { __tmClearTaskDetailNoteViewState(taskDetailNoteScope, String(noteTask?.id || taskId || '').trim(), `${bindSource}:rendered-note-fallback`); } catch (e) {}
                if (!(noteTask && typeof noteTask === 'object')) return;
                const nextId = String(noteTask.id || taskId || '').trim();
                if (!nextId) return;
                root.innerHTML = __tmBuildTaskDetailInnerHtml(noteTask, opts);
                __tmBindTaskDetailEditor(root, nextId, {
                    ...opts,
                    source: `${bindSource}:rendered-note-fallback`,
                    task: noteTask,
                });
            }).catch(() => null);
            return;
        }
        const enterTaskDetailNoteView = async (ev) => {
            try { ev?.preventDefault?.(); } catch (e) {}
            try { ev?.stopPropagation?.(); } catch (e) {}
            const requestedId = String(getBoundTaskId() || getBoundTask()?.id || taskId || '').trim();
            if (typeof __tmIsOptimisticTempTaskId === 'function' && __tmIsOptimisticTempTaskId(requestedId)) {
                try { hint('⏳ 任务正在写入，完成后可打开笔记内视图', 'info'); } catch (e) {}
                return;
            }
            if (autoSaveTimer) {
                try { clearTimeout(autoSaveTimer); } catch (e) {}
                autoSaveTimer = null;
            }
            resetQueuedSaveRequest();
            if (!isSessionActive()) return;
            const currentTaskForNoteView = getBoundTask();
            const recurringSourceTaskId = __tmGetTaskDetailRecurringSourceTaskId(currentTaskForNoteView, requestedId);
            if (recurringSourceTaskId) {
                try { hint('循环记录将打开原任务所在文档', 'info'); } catch (e) {}
                try { await tmJumpToTask(recurringSourceTaskId, ev); } catch (e) {}
                return;
            }
            const noteTask = await resolveTaskForNoteView();
            const blockId = __tmGetTaskDetailBlockId(noteTask);
            if (!isNoteViewCandidate(noteTask) || !blockId) {
                const boundTask = currentTaskForNoteView || getBoundTask();
                const isRecurringInstance = __tmIsTaskDetailRecurringInstance(boundTask, requestedId);
                try { hint((isRecurringInstance || noteTask?.isVirtual) ? '⚠ 未找到循环任务原始块' : '⚠ 当前任务没有可嵌入的思源块', 'warning'); } catch (e) {}
                return;
            }
            const ProtyleCtor = globalThis.__tmHost?.getProtyleCtor?.();
            const app = globalThis.__tmHost?.getApp?.();
            if (typeof ProtyleCtor !== 'function' || !app) {
                try { hint('⚠ 笔记内视图不可用，已跳转到原文档', 'warning'); } catch (e) {}
                try { await tmJumpToTask(String(noteTask.id || requestedId || blockId).trim(), ev); } catch (e) {}
                return;
            }
            try { __tmCloseTaskDetailMoreMenu(); } catch (e) {}
            try { __tmCloseStandaloneTaskTimeHub?.('note-view-enter', { immediate: true }); } catch (e) {}
            try { await flushTaskDetailNoteTxRefresh(root.__tmTaskDetailTask || getBoundTask(), taskDetailNoteBlockId, 'enter'); } catch (e) {}
            try { destroyTaskDetailNoteView('enter'); } catch (e) {}
            root.innerHTML = __tmBuildTaskDetailNoteViewInnerHtml(noteTask, opts);
            if (!await mountTaskDetailNoteView(noteTask, blockId, 'note-view-enter')) {
                try { hint('⚠ 笔记内视图打开失败，已跳转到原文档', 'warning'); } catch (e2) {}
                try { await tmJumpToTask(String(noteTask.id || requestedId || blockId).trim(), ev); } catch (e2) {}
            }
        };
        on(root.querySelector('[data-tm-detail="note-view"]'), 'click', enterTaskDetailNoteView);
        const commitDetailFieldPatch = (patch = {}, options = {}) => {
            const nextPatch = (patch && typeof patch === 'object' && !Array.isArray(patch)) ? patch : {};
            const opts = (options && typeof options === 'object') ? options : {};
            const rawId = String(opts.taskId || getBoundTaskId() || taskId || '').trim();
            const tid = __tmResolveTaskDetailEffectiveId(rawId) || rawId;
            if (!tid || !Object.keys(nextPatch).length) return Promise.resolve(false);
            let needsProjectionRefresh = opts.forceProjectionRefresh === true;
            try {
                needsProjectionRefresh = needsProjectionRefresh
                    || (typeof __tmDoesPatchNeedProjectionRefresh === 'function'
                        && __tmDoesPatchNeedProjectionRefresh(tid, nextPatch, opts));
            } catch (e) {}
            try {
                __tmPushDetailDebug('detail-field-outbox-dispatch', {
                    taskId: tid,
                    fields: Object.keys(nextPatch),
                    source: String(opts.source || opts.reason || 'detail-field').trim(),
                    needsProjectionRefresh,
                });
            } catch (e) {}
            let patchTask = null;
            try {
                patchTask = globalThis.__tmRequireTaskOutbox?.('patchTask');
            } catch (error) {
                if (typeof opts.onFailure === 'function') {
                    try { opts.onFailure(error); } catch (e) {}
                }
                if (opts.showErrorHint !== false) {
                    try { globalThis.__tmReportTaskOutboxFailure?.(error, { action: '更新' }); } catch (e) {}
                }
                return Promise.reject(error);
            }
            if (typeof patchTask !== 'function') {
                const error = new Error('任务写入队列未就绪: patchTask');
                if (typeof opts.onFailure === 'function') {
                    try { opts.onFailure(error); } catch (e) {}
                }
                if (opts.showErrorHint !== false) {
                    try { globalThis.__tmReportTaskOutboxFailure?.(error, { action: '更新' }); } catch (e) {}
                }
                return Promise.reject(error);
            }
            const request = patchTask(tid, nextPatch, {
                ...opts,
                source: String(opts.source || 'detail-field').trim() || 'detail-field',
                label: String(opts.label || '任务字段').trim() || '任务字段',
                background: true,
                wait: false,
                defer: false,
                skipInteractionGate: true,
                skipSettledRefresh: true,
                forceChecklistBehavior: false,
                withFilters: opts.withFilters === true || needsProjectionRefresh,
                reason: String(opts.reason || opts.source || 'detail-field').trim() || 'detail-field',
                forceProjectionRefresh: needsProjectionRefresh,
                skipDetailPatch: opts.skipDetailPatch !== false,
                broadcast: opts.broadcast === true,
                showErrorHint: false,
            });
            try {
                const latestTask = globalThis.__tmRuntimeState?.getTaskById?.(tid, { includePending: true, preferPending: true })
                    || state.pendingInsertedTasks?.[tid]
                    || state.flatTasks?.[tid]
                    || null;
                if (latestTask) root.__tmTaskDetailTask = latestTask;
            } catch (e) {}
            Promise.resolve(request).then((result) => {
                if (result !== false) return;
                if (typeof opts.onFailure === 'function') {
                    try { opts.onFailure(new Error('任务字段未写入')); } catch (e) {}
                }
            }).catch((error) => {
                try {
                    __tmPushDetailDebug('detail-field-outbox-error', {
                        taskId: tid,
                        fields: Object.keys(nextPatch),
                        error: String(error?.message || error || ''),
                    });
                } catch (e) {}
                if (typeof opts.onFailure === 'function') {
                    try { opts.onFailure(error); } catch (e) {}
                }
                if (opts.showErrorHint !== false) {
                    try { hint(`❌ 更新失败: ${error?.message || String(error)}`, 'error'); } catch (e) {}
                }
            });
            return request;
        };
        const setSubtaskContentEditingHold = (textarea = null, holdMs = null) => {
            const ttl = Math.max(120, Number(holdMs ?? (__tmIsMobileDevice() ? 2400 : 900)) || 0);
            const until = Date.now() + ttl;
            try {
                const prevUntil = Math.max(0, Number(root.__tmTaskDetailSubtaskContentEditingUntil) || 0);
                root.__tmTaskDetailSubtaskContentEditingUntil = Math.max(prevUntil, until);
            } catch (e) {}
            if (textarea instanceof HTMLTextAreaElement) {
                try { textarea.dataset.editing = 'true'; } catch (e) {}
            }
            bumpDetailRefreshHold(ttl);
        };
        const clearSubtaskContentEditingHold = (textarea = null) => {
            if (textarea instanceof HTMLTextAreaElement) {
                try { delete textarea.dataset.editing; } catch (e) {}
            }
            try {
                root.__tmTaskDetailSubtaskContentEditingUntil = Math.max(
                    Math.max(0, Number(root.__tmTaskDetailSubtaskContentEditingUntil) || 0),
                    Date.now() + 240
                );
            } catch (e) {}
            bumpDetailRefreshHold(240);
        };
        const setSubtaskContentBusy = (active, holdMs = null) => {
            subtaskContentSaveDepth = active
                ? subtaskContentSaveDepth + 1
                : Math.max(0, subtaskContentSaveDepth - 1);
            try { root.__tmTaskDetailSubtaskContentSaving = subtaskContentSaveDepth > 0; } catch (e) {}
            bumpDetailRefreshHold(active ? (holdMs ?? 1800) : (holdMs ?? 420));
        };
        const syncAutoHeight = (textarea, minHeight = 34) => {
            if (!(textarea instanceof HTMLTextAreaElement)) return;
            const nextMinHeight = Math.max(0, Number(minHeight) || 0);
            try {
                textarea.style.height = 'auto';
                const nextHeight = Math.max(nextMinHeight, Math.ceil(Number(textarea.scrollHeight) || 0));
                textarea.style.height = `${nextHeight}px`;
            } catch (e) {}
        };
        const setInlinePopoverBusyState = (busy, popover = activeInlinePopover) => {
            inlinePopoverCommitting = !!busy;
            if (!(popover instanceof HTMLElement)) return;
            popover.classList.toggle('is-busy', !!busy);
            try { popover.setAttribute('aria-busy', busy ? 'true' : 'false'); } catch (e) {}
            const input = popover.querySelector('[data-tm-detail-inline-popover-input]');
            const clearBtn = popover.querySelector('[data-tm-detail-inline-popover-clear]');
            const applyBtn = popover.querySelector('[data-tm-detail-inline-popover-apply]');
            if (input instanceof HTMLInputElement) input.disabled = !!busy;
            if (clearBtn instanceof HTMLButtonElement) clearBtn.disabled = !!busy;
            if (applyBtn instanceof HTMLButtonElement) {
                applyBtn.disabled = !!busy;
                applyBtn.textContent = busy ? '保存中...' : '确定';
            }
        };
        const closeInlinePopover = (force = false, reason = '') => {
            if (inlinePopoverCommitting && !force) return false;
            const popover = activeInlinePopover;
            const trigger = activeInlinePopoverTrigger;
            try {
                __tmPushDetailDebug('detail-inline-popover-close', {
                    taskId: String(taskId || '').trim(),
                    reason: String(reason || '').trim() || 'manual',
                    force: !!force,
                    committing: !!inlinePopoverCommitting,
                    trigger: __tmDescribeDebugElement(trigger),
                    popoverClass: String(popover?.className || '').trim(),
                });
            } catch (e) {}
            setInlinePopoverBusyState(false, popover);
            activeInlinePopover = null;
            activeInlinePopoverTrigger = null;
            activeInlinePopoverTriggerRect = null;
            setTaskDetailActivePopover(null, 420);
            try { trigger?.classList?.remove?.('is-open'); } catch (e) {}
            try { trigger?.setAttribute?.('aria-expanded', 'false'); } catch (e) {}
            if (popover instanceof HTMLElement) {
                try { __tmAnimatePopupOutAndRemove(popover, { duration: 110 }); } catch (e) {
                    try { popover.remove(); } catch (e2) {}
                }
            }
            return true;
        };
        try { root.__tmTaskDetailCloseInlinePopover = closeInlinePopover; } catch (e) {}
        try { abortController.signal.addEventListener('abort', () => closeInlinePopover(true, 'abort-signal'), { once: true }); } catch (e) {}
        const positionInlinePopover = () => {
            if (!(activeInlinePopover instanceof HTMLElement) || !(activeInlinePopoverTrigger instanceof HTMLElement)) return;
            activeInlinePopoverTriggerRect = __tmGetStableTaskTimeHubAnchorRect(activeInlinePopoverTrigger, activeInlinePopoverTriggerRect);
            const triggerRect = activeInlinePopoverTriggerRect;
            if (!triggerRect) return;
            if (activeInlinePopover.classList.contains('tm-task-time-hub-popover')) {
                __tmPositionTaskTimeHubPopover(activeInlinePopover, triggerRect);
                return;
            }
            const visualViewportObj = (window.visualViewport && typeof window.visualViewport === 'object') ? window.visualViewport : null;
            const viewportLeft = Number.isFinite(Number(visualViewportObj?.offsetLeft)) ? Number(visualViewportObj.offsetLeft) : 0;
            const viewportTop = Number.isFinite(Number(visualViewportObj?.offsetTop)) ? Number(visualViewportObj.offsetTop) : 0;
            const viewportW = Math.max(1, Number(visualViewportObj?.width) || window.innerWidth || 0);
            const viewportH = Math.max(1, Number(visualViewportObj?.height) || window.innerHeight || 0);
            const viewportRight = viewportLeft + viewportW;
            const viewportBottom = viewportTop + viewportH;
            const isWhiteboardOutlinePopover = activeInlinePopover.classList.contains('tm-task-detail-inline-popover--whiteboard-outline');
            const margin = isWhiteboardOutlinePopover ? 6 : 8;
            if (isWhiteboardOutlinePopover) {
                const maxWidth = Math.max(180, Math.floor(viewportW - margin * 2));
                activeInlinePopover.style.maxWidth = `${maxWidth}px`;
            }
            const popRect = activeInlinePopover.getBoundingClientRect();
            let left = isWhiteboardOutlinePopover
                ? Math.round(triggerRect.left + (triggerRect.width / 2) - (popRect.width / 2))
                : Math.round(triggerRect.left);
            let top = Math.round(triggerRect.bottom + 8);
            if (left < viewportLeft + margin) left = viewportLeft + margin;
            if (left + popRect.width > viewportRight - margin) left = Math.max(viewportLeft + margin, Math.round(viewportRight - popRect.width - margin));
            if (top + popRect.height > viewportBottom - margin) {
                top = Math.max(viewportTop + margin, Math.round(triggerRect.top - popRect.height - 8));
            }
            activeInlinePopover.style.left = `${left}px`;
            activeInlinePopover.style.top = `${top}px`;
        };
        const openInlinePopover = (trigger, config = {}) => {
            if (!(trigger instanceof HTMLElement)) return;
            if (inlinePopoverCommitting) return;
            if (activeInlinePopover && activeInlinePopoverTrigger === trigger) {
                closeInlinePopover(false, 'toggle-same-trigger');
                return;
            }
            closeInlinePopover(false, 'replace-before-open');
            const mode = String(config.mode || 'text').trim() || 'text';
            const title = String(config.title || '').trim();
            const value = String(config.value || '').trim();
            const placeholder = String(config.placeholder || '').trim();
            const isFocusSummary = mode === 'focus-summary';
            const durationPresets = (mode === 'duration' || isFocusSummary) ? __tmGetDurationPresetOptions() : [];
            const tomatoEstimateValue = __tmNormalizeTomatoCountValue(config.tomatoEstimateValue || '');
            const actualTomatoValue = __tmNormalizeTomatoCountValue(config.actualTomatoValue || '');
            const spentValue = String(config.spentValue || '').trim();
            let focusSummaryMode = isFocusSummary
                ? (value ? 'duration' : (tomatoEstimateValue ? 'tomato' : 'duration'))
                : '';
            const shouldSkipFocusSummaryAutoFocus = () => (
                isFocusSummary
                && typeof __tmIsMobileDevice === 'function'
                && __tmIsMobileDevice()
            );
            const popover = document.createElement('div');
            popover.className = `tm-task-detail-inline-popover${mode === 'duration' && durationPresets.length ? ' tm-task-detail-inline-popover--duration' : ''}${isFocusSummary ? ' tm-task-detail-inline-popover--focus-summary' : ''}`;
            popover.innerHTML = `
                ${title ? `<div class="tm-task-detail-inline-popover__title">${esc(title)}</div>` : ''}
                ${mode === 'duration' && durationPresets.length ? `
                    <div class="tm-task-detail-inline-popover__section">
                        <div class="tm-duration-preset-list tm-duration-preset-list--compact">
                            ${__tmBuildDurationPresetOptionsHtml(value, durationPresets)}
                        </div>
                        <div class="tm-duration-preset-helper">选预设或直接输入</div>
                    </div>
                ` : ''}
                ${isFocusSummary ? `
                    <div class="tm-focus-summary-editor__tabs" role="tablist" aria-label="时长与番茄">
                        <button type="button" class="${focusSummaryMode === 'duration' ? 'is-active' : ''}" data-tm-focus-summary-tab="duration" role="tab" aria-selected="${focusSummaryMode === 'duration' ? 'true' : 'false'}">预计时长</button>
                        <button type="button" class="${focusSummaryMode === 'tomato' ? 'is-active' : ''}" data-tm-focus-summary-tab="tomato" role="tab" aria-selected="${focusSummaryMode === 'tomato' ? 'true' : 'false'}">预计番茄</button>
                    </div>
                    <div class="tm-focus-summary-editor__panel" data-tm-focus-summary-panel="duration" ${focusSummaryMode === 'duration' ? '' : 'hidden'}>
                        ${durationPresets.length ? `
                            <div class="tm-task-detail-inline-popover__section">
                                <div class="tm-duration-preset-list tm-duration-preset-list--compact">
                                    ${__tmBuildDurationPresetOptionsHtml(value, durationPresets)}
                                </div>
                            </div>
                        ` : ''}
                        <label class="tm-focus-summary-editor__field"><span>预计时长</span><input class="tm-input tm-task-detail-inline-popover__input tm-duration-editor-input" data-tm-detail-inline-popover-input data-tm-focus-duration type="text" value="${esc(value)}" placeholder="例如：30 或 30m"></label>
                    </div>
                    <div class="tm-focus-summary-editor__panel" data-tm-focus-summary-panel="tomato" ${focusSummaryMode === 'tomato' ? '' : 'hidden'}>
                        <label class="tm-focus-summary-editor__field"><span>预计番茄</span><input class="tm-input tm-task-detail-inline-popover__input" data-tm-focus-estimate type="number" min="0" step="1" inputmode="numeric" value="${esc(tomatoEstimateValue)}" placeholder="空或整数"></label>
                    </div>
                    <div class="tm-focus-summary-editor__readonly">
                        <span>实际番茄 <b class="tm-focus-summary-actual">${esc(actualTomatoValue || '0')}</b></span>
                        <span>实际耗时 <b>${esc(spentValue || '0m')}</b></span>
                    </div>
                ` : `<input class="tm-input tm-task-detail-inline-popover__input${mode === 'duration' ? ' tm-duration-editor-input' : ''}" data-tm-detail-inline-popover-input type="${mode === 'date' ? 'date' : 'text'}" value="${esc(value)}" ${placeholder ? `placeholder="${esc(placeholder)}"` : ''}>`}
                <div class="tm-task-detail-inline-popover__actions">
                    <button type="button" class="tm-btn tm-btn-secondary" data-tm-detail-inline-popover-clear>清空</button>
                    <button type="button" class="tm-btn tm-btn-primary" data-tm-detail-inline-popover-apply>确定</button>
                </div>
            `;
            document.body.appendChild(popover);
            activeInlinePopover = popover;
            activeInlinePopoverTrigger = trigger;
            setTaskDetailActivePopover(popover);
            try {
                __tmPushDetailDebug('detail-inline-popover-open', {
                    taskId: String(taskId || '').trim(),
                    mode,
                    title,
                    value,
                    trigger: __tmDescribeDebugElement(trigger),
                });
            } catch (e) {}
            try { trigger.classList.add('is-open'); } catch (e) {}
            positionInlinePopover();
            try { __tmAnimatePopupIn(popover, { origin: 'top-left', duration: 150 }); } catch (e) {}

            const input = popover.querySelector('[data-tm-detail-inline-popover-input]');
            const estimateInput = popover.querySelector('[data-tm-focus-estimate]');
            const clearBtn = popover.querySelector('[data-tm-detail-inline-popover-clear]');
            const applyBtn = popover.querySelector('[data-tm-detail-inline-popover-apply]');
            const durationPanel = popover.querySelector('[data-tm-focus-summary-panel="duration"]');
            const tomatoPanel = popover.querySelector('[data-tm-focus-summary-panel="tomato"]');
            let durationPresetBinding = null;
            const setFocusSummaryMode = (nextMode, options = {}) => {
                if (!isFocusSummary) return;
                focusSummaryMode = nextMode === 'tomato' ? 'tomato' : 'duration';
                popover.querySelectorAll('[data-tm-focus-summary-tab]').forEach((btn) => {
                    if (!(btn instanceof HTMLButtonElement)) return;
                    const selected = String(btn.dataset.tmFocusSummaryTab || '').trim() === focusSummaryMode;
                    btn.classList.toggle('is-active', selected);
                    btn.setAttribute('aria-selected', selected ? 'true' : 'false');
                });
                if (durationPanel instanceof HTMLElement) durationPanel.hidden = focusSummaryMode !== 'duration';
                if (tomatoPanel instanceof HTMLElement) tomatoPanel.hidden = focusSummaryMode !== 'tomato';
                positionInlinePopover();
                if (options?.focus === true && !shouldSkipFocusSummaryAutoFocus()) {
                    try {
                        requestAnimationFrame(() => {
                            const target = focusSummaryMode === 'tomato' ? estimateInput : input;
                            if (target instanceof HTMLInputElement) {
                                target.focus();
                                target.select?.();
                            }
                        });
                    } catch (e) {}
                }
            };
            if (isFocusSummary) {
                popover.querySelectorAll('[data-tm-focus-summary-tab]').forEach((btn) => {
                    if (!(btn instanceof HTMLButtonElement)) return;
                    on(btn, 'click', (ev) => {
                        try { ev.preventDefault(); } catch (e) {}
                        try { ev.stopPropagation(); } catch (e) {}
                        setFocusSummaryMode(String(btn.dataset.tmFocusSummaryTab || '').trim(), { focus: true });
                    });
                });
            }
            if (mode === 'date' && input instanceof HTMLInputElement) {
                try {
                    input.focus();
                    if (typeof input.showPicker === 'function') input.showPicker();
                } catch (e) {}
            }
            const commit = async (rawValue = null) => {
                if (inlinePopoverCommitting) return;
                const inputValue = rawValue == null && input instanceof HTMLInputElement
                    ? input.value
                    : String(rawValue ?? '');
                const nextValue = isFocusSummary
                    ? (() => {
                        const durationDraft = input instanceof HTMLInputElement
                            ? String(input.value || '').trim()
                            : String(inputValue || '').trim();
                        const tomatoDraft = estimateInput instanceof HTMLInputElement
                            ? __tmNormalizeTomatoCountValue(estimateInput.value)
                            : '';
                        if (focusSummaryMode === 'duration') {
                            return durationDraft
                                ? { duration: durationDraft, tomatoEstimateCount: '' }
                                : { duration: '', tomatoEstimateCount: tomatoDraft };
                        }
                        return tomatoDraft
                            ? { duration: '', tomatoEstimateCount: tomatoDraft }
                            : { duration: durationDraft, tomatoEstimateCount: '' };
                    })()
                    : (typeof config.normalize === 'function'
                        ? config.normalize(inputValue)
                        : String(inputValue || '').trim());
                try {
                    try {
                        __tmPushDetailDebug('detail-inline-popover-commit', {
                            taskId: String(taskId || '').trim(),
                            mode,
                            title,
                            nextValue,
                            trigger: __tmDescribeDebugElement(trigger),
                        });
                    } catch (e) {}
                    setInlinePopoverBusyState(true, popover);
                    const commitResultPromise = typeof config.onCommit === 'function'
                        ? Promise.resolve(config.onCommit(nextValue))
                        : Promise.resolve(true);
                    closeInlinePopover(true, 'commit-start');
                    try { trigger.focus(); } catch (e) {}
                    const commitResult = await commitResultPromise;
                    if (commitResult === false) return;
                } catch (e) {
                    hint(`❌ 更新失败: ${e.message}`, 'error');
                } finally {
                    setInlinePopoverBusyState(false, popover);
                }
            };
            if ((mode === 'duration' || isFocusSummary) && input instanceof HTMLInputElement && durationPresets.length) {
                durationPresetBinding = __tmBindDurationPresetSelection(popover, input, {
                    onSelect: async (nextValue) => {
                        if (isFocusSummary && estimateInput instanceof HTMLInputElement) estimateInput.value = '';
                        if (config.commitPresetOnSelect === true) {
                            await commit(nextValue);
                        }
                    },
                    focusInputOnSelect: config.commitPresetOnSelect !== true && !shouldSkipFocusSummaryAutoFocus(),
                    selectInput: config.commitPresetOnSelect !== true && !shouldSkipFocusSummaryAutoFocus(),
                });
            }
            if (input instanceof HTMLInputElement) {
                if (isFocusSummary) {
                    on(input, 'input', () => {
                        if (String(input.value || '').trim() && estimateInput instanceof HTMLInputElement) estimateInput.value = '';
                    });
                }
                on(input, 'keydown', async (ev) => {
                    if (ev.key === 'Escape') {
                        if (inlinePopoverCommitting) return;
                        try { ev.preventDefault(); } catch (e) {}
                        closeInlinePopover(false, 'input-escape');
                        try { trigger.focus(); } catch (e) {}
                        return;
                    }
                    if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
                        try { ev.preventDefault(); } catch (e) {}
                        await commit();
                    }
                });
                if (mode === 'date') {
                    on(input, 'change', async () => {
                        await commit();
                    });
                }
                if (!shouldSkipFocusSummaryAutoFocus()) {
                    try {
                        requestAnimationFrame(() => {
                            const focusTarget = isFocusSummary && focusSummaryMode === 'tomato' && estimateInput instanceof HTMLInputElement
                                ? estimateInput
                                : input;
                            try { focusTarget.focus(); } catch (e) {}
                            if (mode === 'date') {
                                try {
                                    if (typeof input.showPicker === 'function') input.showPicker();
                                    else input.click();
                                } catch (e) {
                                    try { input.click(); } catch (e2) {}
                                }
                            } else {
                                try { focusTarget.select(); } catch (e) {}
                            }
                        });
                    } catch (e) {}
                }
            }
            if (estimateInput instanceof HTMLInputElement) {
                on(estimateInput, 'input', () => {
                    if (!isFocusSummary || !__tmNormalizeTomatoCountValue(estimateInput.value)) return;
                    if (input instanceof HTMLInputElement) {
                        input.value = '';
                        try { durationPresetBinding?.sync?.(); } catch (e) {}
                    }
                });
                on(estimateInput, 'keydown', async (ev) => {
                    if (ev.key === 'Escape') {
                        if (inlinePopoverCommitting) return;
                        try { ev.preventDefault(); } catch (e) {}
                        closeInlinePopover(false, 'estimate-escape');
                        try { trigger.focus(); } catch (e) {}
                        return;
                    }
                    if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
                        try { ev.preventDefault(); } catch (e) {}
                        await commit();
                    }
                });
            }
            on(clearBtn, 'click', async (ev) => {
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                if (isFocusSummary && estimateInput instanceof HTMLInputElement) estimateInput.value = '';
                if (isFocusSummary && input instanceof HTMLInputElement) input.value = '';
                try { durationPresetBinding?.sync?.(); } catch (e) {}
                await commit('');
            });
            on(applyBtn, 'click', async (ev) => {
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                await commit();
            });
        };
        const getWhiteboardOutlineAvailableWidth = (popover = activeInlinePopover) => {
            const targetPopover = popover instanceof HTMLElement ? popover : null;
            if (!(targetPopover instanceof HTMLElement)) return 0;
            const scroll = targetPopover.querySelector('[data-tm-detail-whiteboard-outline-scroll]');
            const source = scroll instanceof HTMLElement ? scroll : targetPopover;
            const rect = source.getBoundingClientRect();
            const width = Math.round(Number(source.clientWidth || rect.width || 0));
            return Math.max(220, width);
        };
        const buildWhiteboardOutlineModelForPopover = (tid, popover = activeInlinePopover) => {
            const id = String(tid || '').trim();
            if (!id || typeof __tmBuildWhiteboardTaskOutlineModel !== 'function') return null;
            const scope = popover instanceof HTMLElement
                ? String(popover.getAttribute('data-tm-whiteboard-outline-scope') || '').trim()
                : '';
            return __tmBuildWhiteboardTaskOutlineModel(id, {
                availableWidth: getWhiteboardOutlineAvailableWidth(popover),
                scope,
            });
        };
        const buildWhiteboardOutlineScopeOptions = (tid, activeScope = '') => {
            const id = String(tid || '').trim();
            if (!id || typeof __tmBuildWhiteboardTaskOutlineModel !== 'function') return [];
            const out = [];
            const add = (scope, label) => {
                const model = __tmBuildWhiteboardTaskOutlineModel(id, { scope, maxNodes: 4 });
                if (model) out.push({ value: scope, label });
            };
            add('global', '全局白板');
            add('board', '文档框白板');
            const current = String(activeScope || '').trim();
            if (current && !out.some((item) => item.value === current)) {
                out.unshift({ value: current, label: current === 'global' ? '全局白板' : '文档框白板' });
            }
            return out;
        };
        const renderWhiteboardOutlineHtmlForPopover = (model, tid) => {
            const activeScope = String(model?.scope || model?.location?.scope || '').trim() || 'board';
            return __tmBuildTaskDetailWhiteboardOutlineHtml(model, buildDetailTip, {
                popover: true,
                scopeOptions: buildWhiteboardOutlineScopeOptions(tid, activeScope),
            });
        };
        const centerWhiteboardOutlineCurrentNode = (popover = activeInlinePopover) => {
            const targetPopover = popover instanceof HTMLElement ? popover : null;
            if (!(targetPopover instanceof HTMLElement)) return false;
            const scroll = targetPopover.querySelector('[data-tm-detail-whiteboard-outline-scroll]');
            const current = targetPopover.querySelector('.tm-task-detail-whiteboard-outline-node.is-current');
            if (!(scroll instanceof HTMLElement) || !(current instanceof HTMLElement)) return false;
            const maxLeft = Math.max(0, Number(scroll.scrollWidth || 0) - Number(scroll.clientWidth || 0));
            const maxTop = Math.max(0, Number(scroll.scrollHeight || 0) - Number(scroll.clientHeight || 0));
            const left = Math.max(0, Math.min(maxLeft, Number(current.offsetLeft || 0) + Number(current.offsetWidth || 0) / 2 - Number(scroll.clientWidth || 0) / 2));
            const top = Math.max(0, Math.min(maxTop, Number(current.offsetTop || 0) + Number(current.offsetHeight || 0) / 2 - Number(scroll.clientHeight || 0) * 0.68));
            try {
                scroll.scrollTo({ left, top, behavior: 'auto' });
            } catch (e) {
                scroll.scrollLeft = left;
                scroll.scrollTop = top;
            }
            return true;
        };
        const syncWhiteboardOutlinePopoverFloatingTooltips = (popover = activeInlinePopover) => {
            const targetPopover = popover instanceof HTMLElement ? popover : null;
            if (!(targetPopover instanceof HTMLElement)) return false;
            try { __tmBindFloatingTooltips(targetPopover); return true; } catch (e) { return false; }
        };
        const syncWhiteboardOutlinePanState = (popover = activeInlinePopover) => {
            const targetPopover = popover instanceof HTMLElement ? popover : null;
            if (!(targetPopover instanceof HTMLElement)) return false;
            const scroll = targetPopover.querySelector('[data-tm-detail-whiteboard-outline-scroll]');
            if (!(scroll instanceof HTMLElement)) return false;
            const canPan = Number(scroll.scrollWidth || 0) > Number(scroll.clientWidth || 0) + 1
                || Number(scroll.scrollHeight || 0) > Number(scroll.clientHeight || 0) + 1;
            scroll.classList.toggle('can-pan', canPan);
            return canPan;
        };
        const bindWhiteboardOutlinePanDrag = (popover = activeInlinePopover) => {
            const targetPopover = popover instanceof HTMLElement ? popover : null;
            if (!(targetPopover instanceof HTMLElement)) return false;
            const scroll = targetPopover.querySelector('[data-tm-detail-whiteboard-outline-scroll]');
            if (!(scroll instanceof HTMLElement) || scroll.__tmWhiteboardOutlinePanBound) return false;
            const beginDrag = (ev) => {
                if (!(targetPopover instanceof HTMLElement) || activeInlinePopover !== targetPopover) return;
                if (ev?.button != null && ev.button !== 0) return;
                const target = ev.target instanceof Element ? ev.target : null;
                if (target?.closest?.('button,input,select,textarea,a,[data-tm-detail-whiteboard-outline-check],.tm-task-checkbox,.tm-task-checkbox-wrap')) return;
                const startNode = target?.closest?.('[data-tm-detail-whiteboard-outline-node]');
                const canScrollX = Number(scroll.scrollWidth || 0) > Number(scroll.clientWidth || 0) + 1;
                const canScrollY = Number(scroll.scrollHeight || 0) > Number(scroll.clientHeight || 0) + 1;
                if (!canScrollX && !canScrollY) return;
                whiteboardOutlinePanDrag = {
                    popover: targetPopover,
                    scroll,
                    pointerId: ev.pointerId,
                    startX: Number(ev.clientX) || 0,
                    startY: Number(ev.clientY) || 0,
                    scrollLeft: Number(scroll.scrollLeft || 0),
                    scrollTop: Number(scroll.scrollTop || 0),
                    startNode: startNode instanceof HTMLElement ? startNode : null,
                    moved: false,
                };
                if (!(startNode instanceof HTMLElement)) {
                    try { scroll.setPointerCapture?.(ev.pointerId); } catch (e) {}
                }
                try {
                    if (typeof __tmHideFloatingTooltip === 'function') __tmHideFloatingTooltip();
                } catch (e) {}
            };
            on(scroll, 'pointerdown', beginDrag);
            try { scroll.__tmWhiteboardOutlinePanBound = true; } catch (e) {}
            return true;
        };
        refreshWhiteboardOutlinePopover = (popover = activeInlinePopover, options = {}) => {
            const targetPopover = popover instanceof HTMLElement ? popover : null;
            if (!(targetPopover instanceof HTMLElement) || !targetPopover.classList.contains('tm-task-detail-inline-popover--whiteboard-outline')) return false;
            const tid = String(getBoundTaskId() || getBoundTask()?.id || taskId || '').trim();
            const prevScroll = targetPopover.querySelector('[data-tm-detail-whiteboard-outline-scroll]');
            const prevScrollLeft = prevScroll instanceof HTMLElement ? Number(prevScroll.scrollLeft || 0) : 0;
            const prevScrollTop = prevScroll instanceof HTMLElement ? Number(prevScroll.scrollTop || 0) : 0;
            const model = buildWhiteboardOutlineModelForPopover(tid, targetPopover);
            if (!model) {
                if (options?.closeIfMissing !== false) closeInlinePopover(false, 'whiteboard-outline-missing');
                return false;
            }
            targetPopover.setAttribute('data-tm-whiteboard-outline-popover-for', tid);
            const modelScope = String(model?.scope || model?.location?.scope || '').trim() || 'board';
            targetPopover.setAttribute('data-tm-whiteboard-outline-scope', modelScope);
            targetPopover.innerHTML = renderWhiteboardOutlineHtmlForPopover(model, tid);
            positionInlinePopover();
            syncWhiteboardOutlinePopoverFloatingTooltips(targetPopover);
            syncWhiteboardOutlinePanState(targetPopover);
            bindWhiteboardOutlinePanDrag(targetPopover);
            if (options?.centerCurrent === true) {
                centerWhiteboardOutlineCurrentNode(targetPopover);
            } else {
                const nextScroll = targetPopover.querySelector('[data-tm-detail-whiteboard-outline-scroll]');
                if (nextScroll instanceof HTMLElement) {
                    nextScroll.scrollLeft = Math.max(0, prevScrollLeft);
                    nextScroll.scrollTop = Math.max(0, prevScrollTop);
                }
            }
            return true;
        };
        openWhiteboardOutlinePopover = (trigger) => {
            if (!(trigger instanceof HTMLElement)) return false;
            if (inlinePopoverCommitting) return false;
            if (activeInlinePopover && activeInlinePopoverTrigger === trigger) {
                closeInlinePopover(false, 'toggle-whiteboard-outline');
                return true;
            }
            const tid = String(getBoundTaskId() || getBoundTask()?.id || taskId || '').trim();
            let model = buildWhiteboardOutlineModelForPopover(tid, null);
            if (!model) {
                syncWhiteboardOutline();
                try { hint('\u26a0 \u8be5\u4efb\u52a1\u6ca1\u6709\u767d\u677f\u8def\u5f84', 'warning'); } catch (e) {}
                return false;
            }
            closeInlinePopover(false, 'replace-before-whiteboard-outline');
            const popover = document.createElement('div');
            popover.className = 'tm-task-detail-inline-popover tm-task-detail-inline-popover--whiteboard-outline';
            popover.setAttribute('role', 'dialog');
            popover.setAttribute('aria-label', '\u767d\u677f\u8def\u5f84');
            popover.setAttribute('data-tm-whiteboard-outline-popover-for', tid);
            popover.setAttribute('data-tm-whiteboard-outline-scope', String(model?.scope || model?.location?.scope || '').trim() || 'board');
            popover.innerHTML = renderWhiteboardOutlineHtmlForPopover(model, tid);
            document.body.appendChild(popover);
            activeInlinePopover = popover;
            activeInlinePopoverTrigger = trigger;
            setTaskDetailActivePopover(popover);
            const fittedModel = buildWhiteboardOutlineModelForPopover(tid, popover);
            if (fittedModel) {
                model = fittedModel;
                popover.setAttribute('data-tm-whiteboard-outline-scope', String(model?.scope || model?.location?.scope || '').trim() || 'board');
                popover.innerHTML = renderWhiteboardOutlineHtmlForPopover(model, tid);
            }
            try { trigger.classList.add('is-open'); } catch (e) {}
            try { trigger.setAttribute('aria-expanded', 'true'); } catch (e) {}
            try { __tmSyncTaskDetailWhiteboardOutlineSection(root, getBoundTask(), buildDetailTip, { open: true }); } catch (e) {}
            positionInlinePopover();
            centerWhiteboardOutlineCurrentNode(popover);
            syncWhiteboardOutlinePopoverFloatingTooltips(popover);
            syncWhiteboardOutlinePanState(popover);
            bindWhiteboardOutlinePanDrag(popover);
            try { __tmAnimatePopupIn(popover, { origin: 'top-left', duration: 150 }); } catch (e) {}
            on(popover, 'tm-outline-done-change', async (ev) => {
                const input = ev.target instanceof HTMLInputElement ? ev.target : null;
                const node = input?.closest?.('[data-tm-detail-whiteboard-outline-node]');
                if (!(input instanceof HTMLInputElement) || !(node instanceof HTMLElement) || !popover.contains(node)) return;
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                const nodeTaskId = String(node.getAttribute('data-task-id') || '').trim();
                if (!nodeTaskId) return;
                const nextDone = !!input.checked;
                try { node.classList.add('is-updating'); } catch (e) {}
                const result = await window.tmSetDone?.(nodeTaskId, nextDone, null, {
                    source: 'task-detail-whiteboard-outline',
                    wait: true,
                    skipInteractionGate: true,
                });
                if (result === false) input.checked = !nextDone;
                try { __tmSyncTaskDetailWhiteboardOutlineSection(root, getBoundTask(), buildDetailTip, { open: true }); } catch (e) {}
                refreshWhiteboardOutlinePopover(popover, { closeIfMissing: false });
                try { node.classList.remove('is-updating'); } catch (e) {}
            });
            on(popover, 'click', async (ev) => {
                const target = ev.target instanceof Element ? ev.target : null;
                if (isWhiteboardOutlineCheckboxTarget(target)) {
                    try { ev.stopPropagation(); } catch (e) {}
                    return;
                }
                const closeScopeMenus = (exceptRoot = null) => {
                    try {
                        popover.querySelectorAll('[data-tm-detail-whiteboard-outline-scope-select]').forEach((rootEl) => {
                            if (!(rootEl instanceof HTMLElement) || rootEl === exceptRoot) return;
                            const menuEl = rootEl.querySelector('[data-tm-detail-whiteboard-outline-scope-menu]');
                            const triggerEl = rootEl.querySelector('[data-tm-detail-whiteboard-outline-scope-trigger]');
                            if (menuEl instanceof HTMLElement) {
                                menuEl.hidden = true;
                                menuEl.style.display = 'none';
                            }
                            if (triggerEl instanceof HTMLElement) triggerEl.setAttribute('aria-expanded', 'false');
                        });
                    } catch (e) {}
                };
                const scopeRoot = target?.closest?.('[data-tm-detail-whiteboard-outline-scope-select]');
                if (scopeRoot instanceof HTMLElement && popover.contains(scopeRoot)) {
                    const menu = scopeRoot.querySelector('[data-tm-detail-whiteboard-outline-scope-menu]');
                    const trigger = scopeRoot.querySelector('[data-tm-detail-whiteboard-outline-scope-trigger]');
                    const option = target?.closest?.('[data-tm-detail-whiteboard-outline-scope-option]');
                    const triggerHit = target?.closest?.('[data-tm-detail-whiteboard-outline-scope-trigger]');
                    if (triggerHit instanceof HTMLElement && triggerHit === trigger && menu instanceof HTMLElement) {
                        try { ev.preventDefault(); } catch (e) {}
                        try { ev.stopPropagation(); } catch (e) {}
                        const nextOpen = !!menu.hidden;
                        closeScopeMenus(scopeRoot);
                        menu.hidden = !nextOpen;
                        menu.style.display = nextOpen ? 'flex' : 'none';
                        trigger.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
                        return;
                    }
                    if (option instanceof HTMLElement && menu instanceof HTMLElement && trigger instanceof HTMLElement) {
                        try { ev.preventDefault(); } catch (e) {}
                        try { ev.stopPropagation(); } catch (e) {}
                        const nextScope = String(option.getAttribute('data-value') || '').trim();
                        if (!nextScope) return;
                        menu.hidden = true;
                        menu.style.display = 'none';
                        trigger.setAttribute('aria-expanded', 'false');
                        popover.setAttribute('data-tm-whiteboard-outline-scope', nextScope);
                        refreshWhiteboardOutlinePopover(popover, { closeIfMissing: false, centerCurrent: true });
                        return;
                    }
                } else {
                    closeScopeMenus();
                }
                const node = target?.closest?.('[data-tm-detail-whiteboard-outline-node]');
                if (!(node instanceof HTMLElement) || !popover.contains(node)) return;
                if (node.dataset.tmSuppressNextClick === 'true') {
                    try { delete node.dataset.tmSuppressNextClick; } catch (e) {}
                    try { ev.preventDefault(); } catch (e) {}
                    try { ev.stopPropagation(); } catch (e) {}
                    return;
                }
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                const nodeTaskId = String(node.getAttribute('data-task-id') || '').trim();
                const scope = String(popover.getAttribute('data-tm-whiteboard-outline-scope') || '').trim();
                const jumped = await window.tmJumpToWhiteboardTask?.(nodeTaskId || getBoundTaskId() || taskId, ev, { scope });
                if (jumped === false) return;
                closeInlinePopover(false, 'whiteboard-outline-node-jump');
                const keepChecklistSideDetailOpen = embedded && String(root.id || '').trim() === 'tmChecklistDetailPanel';
                if (!keepChecklistSideDetailOpen) await close();
            });
            on(popover, 'keydown', async (ev) => {
                const key = String(ev.key || '');
                const target = ev.target instanceof Element ? ev.target : null;
                const scopeRoot = target?.closest?.('[data-tm-detail-whiteboard-outline-scope-select]');
                if (scopeRoot instanceof HTMLElement && popover.contains(scopeRoot) && key === 'Escape') {
                    const menu = scopeRoot.querySelector('[data-tm-detail-whiteboard-outline-scope-menu]');
                    const trigger = scopeRoot.querySelector('[data-tm-detail-whiteboard-outline-scope-trigger]');
                    if (menu instanceof HTMLElement) {
                        try { ev.preventDefault(); } catch (e) {}
                        menu.hidden = true;
                        menu.style.display = 'none';
                    }
                    if (trigger instanceof HTMLElement) {
                        trigger.setAttribute('aria-expanded', 'false');
                        try { trigger.focus(); } catch (e) {}
                    }
                    return;
                }
                if (String(ev.key || '') !== 'Enter' && String(ev.key || '') !== ' ') return;
                if (isWhiteboardOutlineCheckboxTarget(target)) return;
                const node = target?.closest?.('[data-tm-detail-whiteboard-outline-node]');
                if (!(node instanceof HTMLElement) || !popover.contains(node)) return;
                try { ev.preventDefault(); } catch (e) {}
                node.click();
            });
            return true;
        };
        const openTaskDateSheetPopover = (trigger, field) => {
            if (!(trigger instanceof HTMLElement)) return;
            if (inlinePopoverCommitting) return;
            if (activeInlinePopover && activeInlinePopoverTrigger === trigger) {
                closeInlinePopover(false, 'toggle-date-sheet');
                return;
            }
            closeInlinePopover(false, 'replace-before-date-sheet');
            const popover = document.createElement('div');
            popover.className = 'tm-task-detail-inline-popover tm-task-detail-inline-popover--date-sheet';
            const title = field === 'startDate' ? '开始日期' : '截止日期';
            const currentValue = readHiddenInputValue(field);
            const task = getBoundTask();
            const renderRepeatSummary = () => {
                const boundTask = getBoundTask() || task || {};
                const summary = __tmGetTaskRepeatSummary(__tmGetTaskRepeatRule(boundTask), {
                    startDate: boundTask?.startDate,
                    completionTime: boundTask?.completionTime,
                });
                return summary || '不重复';
            };
            const renderRepeatUntilSummary = () => {
                const boundTask = getBoundTask() || task || {};
                const rule = __tmGetTaskRepeatRule(boundTask);
                if (!rule.enabled || rule.type === 'none') return '未设置';
                return rule.until ? `结束于 ${rule.until}` : '永不结束';
            };
            const renderRepeatPreviewHtml = () => {
                const boundTask = getBoundTask() || task || {};
                const list = __tmCollectTaskRepeatPreviewDates(boundTask, { limit: 5 });
                if (!list.length) return '<span class="tm-task-detail-inline-popover__preview-chip">未设置循环</span>';
                return list.map((item) => `<span class="tm-task-detail-inline-popover__preview-chip">${esc(__tmFormatTaskTimeCompact(item))}</span>`).join('');
            };
            popover.innerHTML = `
                <div class="tm-task-detail-inline-popover__title">${esc(title)}</div>
                <div class="tm-task-detail-inline-popover__section">
                    <input class="tm-input tm-task-detail-inline-popover__input" data-tm-detail-inline-popover-input type="date" value="${esc(currentValue)}">
                </div>
                ${field === 'completionTime' ? `
                    <div class="tm-task-detail-inline-popover__section">
                        <button type="button" class="tm-task-detail-inline-popover__row-btn" data-tm-detail-date-repeat-open>
                            <span class="tm-task-detail-inline-popover__row-main">
                                <span class="tm-task-detail-inline-popover__row-icon">${__tmRenderLucideIcon('repeat')}</span>
                                <span class="tm-task-detail-inline-popover__row-text">
                                    <span class="tm-task-detail-inline-popover__row-title">循环</span>
                                    <span class="tm-task-detail-inline-popover__row-desc" data-tm-detail-date-repeat-summary>${esc(renderRepeatSummary())}</span>
                                </span>
                            </span>
                            <span class="tm-task-detail-inline-popover__row-trailing">${__tmRenderLucideIcon('chevron-right')}</span>
                        </button>
                        <button type="button" class="tm-task-detail-inline-popover__row-btn" data-tm-detail-date-repeat-until-open>
                            <span class="tm-task-detail-inline-popover__row-main">
                                <span class="tm-task-detail-inline-popover__row-icon">${__tmRenderLucideIcon('calendar-check')}</span>
                                <span class="tm-task-detail-inline-popover__row-text">
                                    <span class="tm-task-detail-inline-popover__row-title">结束方式</span>
                                    <span class="tm-task-detail-inline-popover__row-desc" data-tm-detail-date-repeat-until>${esc(renderRepeatUntilSummary())}</span>
                                </span>
                            </span>
                            <span class="tm-task-detail-inline-popover__row-trailing">${__tmRenderLucideIcon('chevron-right')}</span>
                        </button>
                        <div class="tm-task-detail-inline-popover__preview" data-tm-detail-date-repeat-preview>${renderRepeatPreviewHtml()}</div>
                    </div>
                ` : ''}
                <div class="tm-task-detail-inline-popover__actions">
                    <button type="button" class="tm-btn tm-btn-secondary" data-tm-detail-inline-popover-clear>清空</button>
                    <button type="button" class="tm-btn tm-btn-primary" data-tm-detail-inline-popover-apply>确定</button>
                </div>
            `;
            document.body.appendChild(popover);
            activeInlinePopover = popover;
            activeInlinePopoverTrigger = trigger;
            setTaskDetailActivePopover(popover);
            try {
                __tmPushDetailDebug('detail-date-sheet-open', {
                    taskId: String(taskId || '').trim(),
                    field,
                    currentValue,
                    trigger: __tmDescribeDebugElement(trigger),
                });
            } catch (e) {}
            try { trigger.classList.add('is-open'); } catch (e) {}
            positionInlinePopover();
            try { __tmAnimatePopupIn(popover, { origin: 'top-left', duration: 150 }); } catch (e) {}
            const input = popover.querySelector('[data-tm-detail-inline-popover-input]');
            const clearBtn = popover.querySelector('[data-tm-detail-inline-popover-clear]');
            const applyBtn = popover.querySelector('[data-tm-detail-inline-popover-apply]');
            const repeatOpenBtn = popover.querySelector('[data-tm-detail-date-repeat-open]');
            const repeatUntilBtn = popover.querySelector('[data-tm-detail-date-repeat-until-open]');
            const syncRepeatRows = () => {
                const summaryEl = popover.querySelector('[data-tm-detail-date-repeat-summary]');
                const untilEl = popover.querySelector('[data-tm-detail-date-repeat-until]');
                const previewEl = popover.querySelector('[data-tm-detail-date-repeat-preview]');
                if (summaryEl instanceof HTMLElement) summaryEl.textContent = renderRepeatSummary();
                if (untilEl instanceof HTMLElement) untilEl.textContent = renderRepeatUntilSummary();
                if (previewEl instanceof HTMLElement) previewEl.innerHTML = renderRepeatPreviewHtml();
            };
            const commit = async (rawValue = null) => {
                if (inlinePopoverCommitting) return;
                const inputValue = rawValue == null && input instanceof HTMLInputElement
                    ? input.value
                    : String(rawValue ?? '');
                const nextValue = inputValue ? __tmNormalizeDateOnly(inputValue) : '';
                try {
                    try {
                        __tmPushDetailDebug('detail-date-sheet-commit', {
                            taskId: String(taskId || '').trim(),
                            field,
                            nextValue,
                            trigger: __tmDescribeDebugElement(trigger),
                        });
                    } catch (e) {}
                    setInlinePopoverBusyState(true, popover);
                    const prevValue = readHiddenInputValue(field);
                    setHiddenInputValue(field, nextValue);
                    syncMetaChipFaces();
                    const patch = { [field]: nextValue };
                    const boundId = getBoundTaskId() || taskId;
                    if (boundId && typeof window.tmUpdateTaskDates === 'function') {
                        Promise.resolve(window.tmUpdateTaskDates(boundId, patch, {
                            source: 'detail-date-sheet',
                            background: true,
                            skipInteractionGate: true,
                            skipSnapshotPersist: true,
                            skipTaskIndexPersist: true,
                            renderOptimistic: true,
                        })).catch(() => {
                            setHiddenInputValue(field, prevValue);
                            syncMetaChipFaces();
                        });
                    } else {
                        commitDetailFieldPatch(patch, {
                            source: 'detail-date-sheet',
                            reason: 'detail-date-sheet',
                            label: '日期',
                            onFailure: () => {
                                setHiddenInputValue(field, prevValue);
                                syncMetaChipFaces();
                            },
                        });
                    }
                    closeInlinePopover(true, 'date-sheet-commit-start');
                    try { trigger.focus(); } catch (e) {}
                } catch (e) {
                    hint(`❌ 更新失败: ${e.message}`, 'error');
                } finally {
                    setInlinePopoverBusyState(false, popover);
                }
            };
            if (input instanceof HTMLInputElement) {
                try {
                    requestAnimationFrame(() => {
                        try { input.focus(); } catch (e) {}
                        try {
                            if (typeof input.showPicker === 'function') input.showPicker();
                        } catch (e) {}
                    });
                } catch (e) {}
                on(input, 'keydown', async (ev) => {
                    if (ev.key === 'Escape') {
                        try { ev.preventDefault(); } catch (e) {}
                        closeInlinePopover(false, 'date-sheet-escape');
                        try { trigger.focus(); } catch (e) {}
                        return;
                    }
                    if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
                        try { ev.preventDefault(); } catch (e) {}
                        await commit();
                    }
                });
                on(input, 'change', async () => {
                    await commit();
                });
            }
            on(clearBtn, 'click', async (ev) => {
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                await commit('');
            });
            on(applyBtn, 'click', async (ev) => {
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                await commit();
            });
            on(repeatOpenBtn, 'click', async (ev) => {
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                const result = await window.tmEditTaskRepeatRule?.(getBoundTaskId() || taskId, { task: getBoundTask() });
                if (!result) return;
                const refreshedTask = await __tmResolveTaskForRepeat(getBoundTaskId() || taskId);
                if (refreshedTask) {
                    try { root.__tmTaskDetailTask = refreshedTask; } catch (e) {}
                }
                syncRepeatRows();
                syncMetaChipFaces();
                syncSerializedSnapshot();
                positionInlinePopover();
            });
            on(repeatUntilBtn, 'click', async (ev) => {
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                const currentTask = getBoundTask();
                const currentRule = __tmGetTaskRepeatRule(currentTask);
                if (!currentRule.enabled || currentRule.type === 'none') {
                    hint('⚠ 请先设置循环规则', 'warning');
                    return;
                }
                const nextUntil = await showDatePrompt('循环截止日期（留空表示永不结束）', currentRule.until || '');
                if (nextUntil === null) return;
                const result = await window.tmSetTaskRepeatRule?.(getBoundTaskId() || taskId, {
                    ...currentRule,
                    until: nextUntil || '',
                    anchorDate: currentTask?.completionTime || currentTask?.startDate || __tmNormalizeDateOnly(new Date()),
                }, { source: 'task-repeat-until-inline' });
                if (!result) return;
                const refreshedTask = await __tmResolveTaskForRepeat(getBoundTaskId() || taskId);
                if (refreshedTask) {
                    try { root.__tmTaskDetailTask = refreshedTask; } catch (e) {}
                }
                syncRepeatRows();
                syncMetaChipFaces();
                syncSerializedSnapshot();
                positionInlinePopover();
            });
        };
        const openTaskTimeHubPopover = (trigger, options = {}) => {
            if (!(trigger instanceof HTMLElement)) return;
            if (inlinePopoverCommitting) return;
            if (activeInlinePopover && activeInlinePopoverTrigger === trigger) {
                closeInlinePopover(false, 'toggle-time-hub');
                return;
            }
            closeInlinePopover(false, 'replace-before-time-hub');

            const todayKey = __tmNormalizeDateOnly(new Date());
            const parseDateKey = (value) => {
                const key = __tmNormalizeDateOnly(value);
                const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
                if (!m) return null;
                const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
                return Number.isNaN(d.getTime()) ? null : d;
            };
            const pad2 = (n) => String(n).padStart(2, '0');
            const toDateKey = (date) => {
                if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
                return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
            };
            const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
            const shiftMonth = (date, delta) => new Date(date.getFullYear(), date.getMonth() + (Number(delta) || 0), 1, 12, 0, 0, 0);
            const makeDateTime = (dateKey, timeKey = '09:00') => {
                const d = parseDateKey(dateKey) || parseDateKey(todayKey) || new Date();
                const m = /^(\d{1,2}):(\d{2})$/.exec(String(timeKey || '').trim());
                const h = m ? Math.max(0, Math.min(23, Number(m[1]) || 0)) : 9;
                const min = m ? Math.max(0, Math.min(59, Number(m[2]) || 0)) : 0;
                return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, min, 0, 0);
            };
            const formatTime = (value) => {
                const d = value instanceof Date ? value : new Date(value);
                if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
                return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
            };
            const formatScheduleDate = (value) => __tmFormatTaskDetailShortDate(__tmNormalizeDateOnly(value), '');
            const getTaskTitle = () => {
                const task = getBoundTask() || {};
                return __tmNormalizeTaskTimeHubTitle(task.content || task.raw_content || task.markdown || '', '任务');
            };
            const getTimeFromSchedules = () => {
                const item = Array.isArray(hubState.schedules) ? hubState.schedules.find((it) => it && it.allDay !== true) : null;
                return item ? formatTime(item.start) : '';
            };
            const getRepeatRule = () => __tmGetTaskRepeatRule(getBoundTask() || {});
            const getRepeatSummary = () => __tmGetTaskRepeatSummary(getRepeatRule(), {
                startDate: readHiddenInputValue('startDate'),
                completionTime: readHiddenInputValue('completionTime'),
            });
            const popover = document.createElement('div');
            popover.className = 'tm-task-detail-inline-popover tm-task-time-hub-popover';
            popover.setAttribute('role', 'dialog');
            popover.setAttribute('aria-label', '任务时间中心');
            const hideReminder = options?.hideReminder === true;
            const hideSchedule = options?.hideSchedule === true;
            const hideRepeat = options?.hideRepeat === true;
            const requestedField = String(options?.activeField || '').trim();
            const initialActiveField = requestedField === 'startDate' ? 'startDate' : 'completionTime';
            const initialMonth = parseDateKey(readHiddenInputValue(initialActiveField) || readHiddenInputValue('completionTime') || readHiddenInputValue('startDate') || todayKey) || new Date();
            const hubState = {
                tab: 'date',
                activeField: initialActiveField,
                monthDate: startOfMonth(initialMonth),
                editor: '',
                schedules: [],
                schedulesLoaded: false,
            schedulesLoading: false,
            scheduleExpanded: false,
            rangeDrag: null,
        };
        const getHubMonthDate = () => {
            const current = hubState.monthDate instanceof Date ? hubState.monthDate : initialMonth;
            const normalized = startOfMonth(current instanceof Date ? current : initialMonth);
            if (!(normalized instanceof Date) || Number.isNaN(normalized.getTime())) {
                return startOfMonth(initialMonth);
            }
            return normalized;
        };
        const setHubMonthDate = (nextDate, options = {}) => {
            const date = nextDate instanceof Date ? nextDate : null;
            if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
            const normalized = startOfMonth(date);
            if (!(normalized instanceof Date) || Number.isNaN(normalized.getTime())) return false;
            hubState.monthDate = normalized;
            if ((options && typeof options === 'object' ? options.close : true) !== false) {
                hubState.editor = '';
            }
            render();
            return true;
        };
        const setHubMonthYear = (yearValue, options = {}) => {
            const year = Math.trunc(Number(yearValue));
            if (!Number.isFinite(year) || year < 1000 || year > 9999) return false;
            const current = getHubMonthDate();
            const next = new Date(year, current.getMonth(), 1, 12, 0, 0, 0);
            if (!(next instanceof Date) || Number.isNaN(next.getTime())) return false;
            return setHubMonthDate(next, options);
        };
        let suppressNextDayClick = false;
            const sortDateRange = (left, right) => {
                const a = __tmNormalizeDateOnly(left);
                const b = __tmNormalizeDateOnly(right);
                if (!a && !b) return { start: '', end: '' };
                if (!a) return { start: b, end: b };
                if (!b) return { start: a, end: a };
                return a <= b ? { start: a, end: b } : { start: b, end: a };
            };
            const isKeyInDateRange = (key, start, end) => {
                const k = __tmNormalizeDateOnly(key);
                if (!k || !start || !end) return false;
                return k >= start && k <= end;
            };

            const renderPreviewHtml = () => {
                const task = {
                    ...(getBoundTask() || {}),
                    startDate: readHiddenInputValue('startDate'),
                    completionTime: readHiddenInputValue('completionTime'),
                };
                const dates = __tmCollectTaskRepeatPreviewDates(task, { limit: 4 });
                if (!dates.length) return '';
                return `
                    <div class="tm-task-time-hub__preview">
                        <span>下次循环</span>
                        <div>${dates.map((d) => `<span>${esc(__tmFormatTaskDetailShortDate(d, String(d || '')))}</span>`).join('')}</div>
                    </div>
                `;
            };
            const renderDateCards = () => {
                const cards = [
                    ['startDate', '开始', readHiddenInputValue('startDate')],
                    ['completionTime', '截止', readHiddenInputValue('completionTime')],
                ];
                return cards.map(([field, label, value]) => `
                    <div class="tm-task-time-hub__date-card ${hubState.activeField === field ? 'is-active' : ''}" role="button" tabindex="0" data-tm-time-hub-date-card="${field}">
                        <span>${esc(label)}</span>
                        <strong>${esc(__tmFormatTaskDetailShortDate(value))}</strong>
                        ${value ? `<button type="button" class="tm-task-time-hub__date-clear" data-tm-time-hub-clear-date="${field}" aria-label="清除${esc(label)}日期">${__tmTaskDetailTimeHubIcon('x', 'tm-task-time-hub__small-icon', 13)}</button>` : ''}
                    </div>
                `).join('');
            };
            const renderCalendarHtml = () => {
                const month = getHubMonthDate();
                const firstDay = __tmGetTaskTimeHubCalendarFirstDay();
                const gridStart = __tmGetTaskTimeHubMonthGridStart(month, firstDay);
                const startValue = readHiddenInputValue('startDate');
                const endValue = readHiddenInputValue('completionTime');
                const activeValue = readHiddenInputValue(hubState.activeField);
                const savedRange = startValue && endValue ? sortDateRange(startValue, endValue) : null;
                const dragRange = hubState.rangeDrag
                    ? sortDateRange(hubState.rangeDrag.anchor, hubState.rangeDrag.current)
                    : null;
                const days = [];
                for (let i = 0; i < 42; i += 1) {
                    const d = new Date(gridStart.getTime());
                    d.setDate(gridStart.getDate() + i);
                    const key = toDateKey(d);
                    const out = d.getMonth() !== month.getMonth();
                    const classes = [
                        'tm-task-time-hub__day',
                        out ? 'is-outside' : '',
                        key === todayKey ? 'is-today' : '',
                        savedRange && isKeyInDateRange(key, savedRange.start, savedRange.end) ? 'is-range' : '',
                        savedRange && key === savedRange.start ? 'is-range-start' : '',
                        savedRange && key === savedRange.end ? 'is-range-end' : '',
                        key === activeValue ? 'is-active' : '',
                        key === startValue ? 'is-start' : '',
                        key === endValue ? 'is-due' : '',
                        dragRange && isKeyInDateRange(key, dragRange.start, dragRange.end) ? 'is-range-preview' : '',
                        dragRange && key === dragRange.start ? 'is-range-start-preview' : '',
                        dragRange && key === dragRange.end ? 'is-range-end-preview' : '',
                    ].filter(Boolean).join(' ');
                    days.push(`<button type="button" class="${classes}" data-tm-time-hub-date="${esc(key)}">${d.getDate()}</button>`);
                }
                return `
                    <div class="tm-task-time-hub__calendar-head">
                        <button type="button" class="tm-task-time-hub__calendar-title${hubState.editor === 'month' ? ' is-active' : ''}" data-tm-time-hub-month-open aria-haspopup="dialog" aria-expanded="${hubState.editor === 'month' ? 'true' : 'false'}" title="选择年月">
                            <strong>${month.getFullYear()}年${month.getMonth() + 1}月</strong>
                        </button>
                        <div class="tm-task-time-hub__month-actions">
                            <button type="button" data-tm-time-hub-month="-1" aria-label="上个月">${__tmTaskDetailTimeHubIcon('chevron-left', 'tm-task-time-hub__small-icon', 14)}</button>
                            <button type="button" data-tm-time-hub-month="0" aria-label="回到本月">今</button>
                            <button type="button" data-tm-time-hub-month="1" aria-label="下个月">${__tmTaskDetailTimeHubIcon('chevron-right', 'tm-task-time-hub__small-icon', 14)}</button>
                        </div>
                    </div>
                    <div class="tm-task-time-hub__weekdays">
                        ${__tmGetTaskTimeHubWeekdayLabels(firstDay).map((d) => `<span>${d}</span>`).join('')}
                    </div>
                    <div class="tm-task-time-hub__calendar">${days.join('')}</div>
                `;
            };
            const renderMonthEditorHtml = () => {
                if (hubState.editor !== 'month') return '';
                const month = getHubMonthDate();
                const year = month.getFullYear();
                const currentMonthIndex = month.getMonth();
                const today = new Date();
                const monthLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
                return `<div class="tm-task-time-hub__subpanel tm-task-time-hub__subpanel--month" data-tm-time-hub-editor-panel>
                    <div class="tm-task-time-hub__month-year-row">
                        <button type="button" class="tm-task-time-hub__month-step-btn" data-tm-time-hub-year-step="-1" aria-label="上一年">${__tmTaskDetailTimeHubIcon('chevron-left', 'tm-task-time-hub__small-icon', 14)}</button>
                        <input class="tm-input tm-task-time-hub__month-year-input" type="text" inputmode="numeric" autocomplete="off" maxlength="4" value="${esc(String(year))}" aria-label="年份" data-tm-time-hub-year-input>
                        <button type="button" class="tm-task-time-hub__month-step-btn" data-tm-time-hub-year-step="1" aria-label="下一年">${__tmTaskDetailTimeHubIcon('chevron-right', 'tm-task-time-hub__small-icon', 14)}</button>
                    </div>
                    <div class="tm-task-time-hub__month-grid">
                        ${monthLabels.map((label, index) => `
                            <button type="button" class="tm-task-time-hub__month-btn${index === currentMonthIndex ? ' is-active' : ''}${year === today.getFullYear() && index === today.getMonth() ? ' is-current' : ''}" data-tm-time-hub-month-pick="${index}" aria-label="跳转到${esc(label)}">${esc(label)}</button>
                        `).join('')}
                    </div>
                </div>`;
            };
            const renderSettingCards = () => {
                const disabled = hubState.activeField === 'startDate';
                const reminderText = readReminderValue() ? (readReminderDisplayValue() || '已提醒') : '不提醒';
                const repeatText = getRepeatSummary() || '不循环';
                const rule = getRepeatRule();
            const endText = rule?.enabled ? (rule.until ? `至 ${__tmFormatTaskDetailShortDate(rule.until)}` : '永不结束') : '未设置';
            const cards = [];
            if (!hideRepeat) {
                cards.push(['repeat', 'repeat', '循环', repeatText]);
                cards.push(['end', 'calendar-check', '结束', endText]);
            }
            if (!hideReminder) cards.push(['reminder', 'alarm-clock', '提醒', reminderText]);
            if (!cards.length) return '';
            return cards.map(([key, icon, label, value]) => `
                <button type="button" class="tm-task-time-hub__setting ${hubState.editor === key ? 'is-active' : ''} ${disabled ? 'is-disabled' : ''}" data-tm-time-hub-card="${key}"${disabled ? ' disabled aria-disabled="true"' : ''}>
                        <span class="tm-task-time-hub__setting-icon">${__tmTaskDetailTimeHubIcon(icon, 'tm-task-time-hub__icon-svg', 16)}</span>
                        <span class="tm-task-time-hub__setting-text">
                            <span>${esc(label)}</span>
                            <strong>${esc(value)}</strong>
                        </span>
                    </button>
                `).join('');
            };
            const renderScheduleList = () => {
                if (hubState.schedulesLoading) return '<div class="tm-task-time-hub__empty">正在读取日程...</div>';
                const list = Array.isArray(hubState.schedules) ? hubState.schedules : [];
                if (!list.length) return '<div class="tm-task-time-hub__empty">暂无日程</div>';
                const visible = hubState.scheduleExpanded ? list : list.slice(0, 5);
                return visible.map((item) => {
                    const id = String(item?.id || '').trim();
                    const start = new Date(item?.start);
                    const end = new Date(item?.end);
                    const isAllDay = item?.allDay === true;
                    const dateText = formatScheduleDate(item?.start) || '未定日期';
                    const timeText = isAllDay ? '全天' : `${formatTime(start)}${formatTime(end) ? `-${formatTime(end)}` : ''}`;
                    const calendarName = String(item?.calendarName || item?.calendarTitle || item?.calendarId || '日程').trim();
                    const repeatText = String(item?.repeatText || item?.repeatType || item?.rrule || '').trim();
                    const reminderText = item?.reminderMode === 'inherit'
                        ? '跟随任务'
                        : (item?.reminderEnabled === true ? '已提醒' : '不提醒');
                    return `
                        <div class="tm-task-time-hub__schedule-item" data-tm-time-hub-schedule-id="${esc(id)}">
                            <div class="tm-task-time-hub__schedule-main">
                                <strong>${esc(dateText)} ${esc(timeText)}</strong>
                                <span>${esc(calendarName)} · ${esc(reminderText)}${repeatText ? ` · ${esc(repeatText)}` : ''}</span>
                            </div>
                            <div class="tm-task-time-hub__schedule-actions">
                                <button type="button" data-tm-time-hub-edit-schedule="${esc(id)}">编辑</button>
                                <button type="button" data-tm-time-hub-delete-schedule="${esc(id)}">删除</button>
                            </div>
                        </div>
                    `;
                }).join('');
            };
            const renderEditorHtml = () => {
                const editor = String(hubState.editor || '').trim();
            if (!editor) return '';
            if (editor === 'reminder') {
                if (hideReminder) return '';
                return `<div class="tm-task-time-hub__subpanel" data-tm-time-hub-editor-panel>
                        <div class="tm-task-time-hub__subpanel-title">提醒</div>
                        <button type="button" class="tm-task-time-hub__choice ${!readReminderValue() ? 'is-selected' : ''}" data-tm-time-hub-reminder-open>不提醒</button>
                        <button type="button" class="tm-task-time-hub__choice ${readReminderValue() ? 'is-selected' : ''}" data-tm-time-hub-reminder-open>打开提醒设置</button>
                    </div>`;
            }
            if (editor === 'repeat') {
                if (hideRepeat) return '';
                const rule = getRepeatRule();
                    const currentType = rule?.enabled ? String(rule.type || 'none') : 'none';
                    const currentCalendarMode = (currentType === 'monthly' || currentType === 'yearly')
                        ? (String(rule?.calendarMode || '').trim() === 'lunar' ? 'lunar' : 'solar')
                        : 'solar';
                    const currentChoice = currentCalendarMode === 'lunar' && (currentType === 'monthly' || currentType === 'yearly')
                        ? `lunar-${currentType}`
                        : currentType;
                    const choices = [
                        ['none', '不循环'],
                        ['daily', '每天'],
                        ['workday', '工作日'],
                        ['weekly', '每周'],
                        ['monthly', '每月'],
                        ['yearly', '每年'],
                        ['lunar-monthly', '农历每月'],
                        ['lunar-yearly', '农历每年'],
                    ];
                    return `<div class="tm-task-time-hub__subpanel" data-tm-time-hub-editor-panel>
                        <div class="tm-task-time-hub__subpanel-title">循环</div>
                        ${choices.map(([type, label]) => `<button type="button" class="tm-task-time-hub__choice ${currentChoice === type ? 'is-selected' : ''}" data-tm-time-hub-repeat="${type}">${esc(label)}</button>`).join('')}
                        <button type="button" class="tm-task-time-hub__choice" data-tm-time-hub-repeat-custom>自定义循环</button>
                    </div>`;
            }
            if (editor === 'end') {
                if (hideRepeat) return '';
                const rule = getRepeatRule();
                    return `<div class="tm-task-time-hub__subpanel" data-tm-time-hub-editor-panel>
                        <div class="tm-task-time-hub__subpanel-title">结束</div>
                        <button type="button" class="tm-task-time-hub__choice ${!rule?.until ? 'is-selected' : ''}" data-tm-time-hub-repeat-until-clear>永不结束</button>
                        <div class="tm-task-time-hub__until-row">
                            <input class="tm-input" type="date" value="${esc(rule?.until || '')}" data-tm-time-hub-repeat-until-input>
                            <button type="button" class="tm-btn tm-btn-primary" data-tm-time-hub-repeat-until-apply>应用</button>
                        </div>
                    </div>`;
                }
                return '';
            };
            const render = () => {
                popover.innerHTML = `
                    <div class="tm-task-time-hub__top">
                    <div class="tm-task-time-hub__tabs" role="tablist" aria-label="时间中心">
                        <button type="button" class="${hubState.tab === 'date' ? 'is-active' : ''}" data-tm-time-hub-tab="date" role="tab" aria-selected="${hubState.tab === 'date' ? 'true' : 'false'}">日期</button>
                        ${hideSchedule ? '' : `<button type="button" class="${hubState.tab === 'schedule' ? 'is-active' : ''}" data-tm-time-hub-tab="schedule" role="tab" aria-selected="${hubState.tab === 'schedule' ? 'true' : 'false'}">日程</button>`}
                        </div>
                        <button type="button" class="tm-task-time-hub__close" data-tm-time-hub-close aria-label="关闭">${__tmTaskDetailTimeHubIcon('x', 'tm-task-time-hub__small-icon', 16)}</button>
                    </div>
                    ${hubState.tab === 'date' ? `
                        <div class="tm-task-time-hub__panel tm-task-time-hub__panel--date">
                        <div class="tm-task-time-hub__date-cards">${renderDateCards()}</div>
                        ${__tmRenderTaskTimeHubQuickDatesHtml(readHiddenInputValue(hubState.activeField))}
                        ${renderCalendarHtml()}
                        ${renderMonthEditorHtml()}
                        ${(() => {
                            const settingsHtml = renderSettingCards();
                            return settingsHtml ? `<div class="tm-task-time-hub__settings">${settingsHtml}</div>` : '';
                        })()}
                            ${renderPreviewHtml()}
                            ${renderEditorHtml()}
                        </div>
                    ` : `
                        <div class="tm-task-time-hub__panel tm-task-time-hub__panel--schedule">
                            <div class="tm-task-time-hub__schedule-toolbar">
                                <button type="button" class="tm-btn tm-btn-primary" data-tm-time-hub-add-schedule>${__tmTaskDetailTimeHubIcon('plus', 'tm-task-time-hub__small-icon', 14)}新增日程</button>
                                <button type="button" class="tm-btn tm-btn-secondary" data-tm-time-hub-toggle-schedules>${hubState.scheduleExpanded ? '收起' : '展开全部'}</button>
                            </div>
                            <div class="tm-task-time-hub__schedule-list">${renderScheduleList()}</div>
                        </div>
                    `}
                `;
                try { trigger.setAttribute('aria-expanded', 'true'); } catch (e) {}
                try { positionInlinePopover(); } catch (e) {}
                try {
                    requestAnimationFrame(() => {
                        try {
                            positionInlinePopover();
                            positionEditorPanel();
                            requestAnimationFrame(() => {
                                try {
                                    positionInlinePopover();
                                    positionEditorPanel();
                                } catch (e) {}
                            });
                        } catch (e) {}
                    });
                } catch (e) {}
            };
            const positionEditorPanel = () => {
                const panel = popover.querySelector('[data-tm-time-hub-editor-panel]');
                const card = hubState.editor === 'month'
                    ? popover.querySelector('[data-tm-time-hub-month-open]')
                    : (hubState.editor ? popover.querySelector(`[data-tm-time-hub-card="${hubState.editor}"]`) : null);
                if (!(panel instanceof HTMLElement) || !(card instanceof HTMLElement)) return;
                if (window.matchMedia && window.matchMedia('(max-width: 640px)').matches) {
                    panel.style.left = '';
                    panel.style.top = '';
                    return;
                }
                const popRect = popover.getBoundingClientRect();
                const baseEl = panel.offsetParent instanceof HTMLElement ? panel.offsetParent : popover;
                const baseRect = baseEl.getBoundingClientRect();
                const cardRect = card.getBoundingClientRect();
                const panelRect = panel.getBoundingClientRect();
                const baseWidth = Math.round(baseRect.width || popRect.width || 0);
                const maxLeft = Math.max(8, baseWidth - panelRect.width - 8);
                const rawLeft = hubState.editor === 'month'
                    ? cardRect.left - baseRect.left + (cardRect.width / 2) - (panelRect.width / 2)
                    : cardRect.left - baseRect.left;
                const left = Math.max(8, Math.min(maxLeft, Math.round(rawLeft)));
                let top = hubState.editor === 'month'
                    ? Math.round(cardRect.bottom - baseRect.top + 4)
                    : Math.round(cardRect.top - baseRect.top - panelRect.height - 8);
                if (top < 8) top = Math.round(cardRect.bottom - baseRect.top + 8);
                panel.style.left = `${left}px`;
                panel.style.top = `${top}px`;
            };
            const updateDateField = async (field, value) => {
                const key = value ? __tmNormalizeDateOnly(value) : '';
                setHiddenInputValue(field, key);
                syncMetaChipFaces();
                const boundId = String(getBoundTaskId() || taskId || '').trim();
                const patch = { [field]: key };
                try {
                    globalThis.__tmTaskStore?.patchLocal?.(boundId, patch, { source: 'task-detail-time-hub' });
                    const boundTask = getBoundTask();
                    if (boundTask && typeof boundTask === 'object') {
                        if (field === 'startDate') {
                            boundTask.startDate = key;
                            boundTask.start_date = key;
                        } else {
                            boundTask.completionTime = key;
                            boundTask.completion_time = key;
                        }
                        root.__tmTaskDetailTask = boundTask;
                    }
                    syncSerializedSnapshot();
                } catch (e) {}
                if (boundId && typeof window.tmUpdateTaskDates === 'function') {
                    const commitPromise = window.tmUpdateTaskDates(boundId, patch, {
                        source: 'task-detail-time-hub-date',
                        refresh: true,
                        broadcast: false,
                        background: true,
                        skipNoopCheck: true,
                        skipSnapshotPersist: true,
                        skipTaskIndexPersist: true,
                    });
                    Promise.resolve(commitPromise)
                        .then(() => { void refreshTimeHubScheduleSummary(); })
                        .catch((e) => { try { hint(`❌ 日期更新失败: ${e.message}`, 'error'); } catch (err) {} });
                } else {
                    flushAutoSaveNow({
                        showHint: false,
                        closeAfterSave: false,
                        preserveFocus: true,
                        skipRerender: true,
                    }).catch(() => null);
                }
                render();
            };
            const updateDateRange = async (left, right) => {
                const range = sortDateRange(left, right);
                setHiddenInputValue('startDate', range.start);
                setHiddenInputValue('completionTime', range.end);
                hubState.activeField = 'completionTime';
                syncMetaChipFaces();
                const boundId = String(getBoundTaskId() || taskId || '').trim();
                const patch = { startDate: range.start, completionTime: range.end };
                try {
                    globalThis.__tmTaskStore?.patchLocal?.(boundId, patch, { source: 'task-detail-time-hub-range' });
                    const boundTask = getBoundTask();
                    if (boundTask && typeof boundTask === 'object') {
                        boundTask.startDate = range.start;
                        boundTask.start_date = range.start;
                        boundTask.completionTime = range.end;
                        boundTask.completion_time = range.end;
                        root.__tmTaskDetailTask = boundTask;
                    }
                    syncSerializedSnapshot();
                } catch (e) {}
                if (boundId && typeof window.tmUpdateTaskDates === 'function') {
                    const commitPromise = window.tmUpdateTaskDates(boundId, patch, {
                        source: 'task-detail-time-hub-range',
                        refresh: true,
                        broadcast: false,
                        background: true,
                        skipNoopCheck: true,
                        skipSnapshotPersist: true,
                        skipTaskIndexPersist: true,
                    });
                    Promise.resolve(commitPromise)
                        .then(() => { void refreshTimeHubScheduleSummary(); })
                        .catch((e) => { try { hint(`❌ 日期范围更新失败: ${e.message}`, 'error'); } catch (err) {} });
                } else {
                    flushAutoSaveNow({
                        showHint: false,
                        closeAfterSave: false,
                        preserveFocus: true,
                        skipRerender: true,
                    }).catch(() => null);
                }
                render();
            };
            const loadHubSchedules = async (force = false) => {
                if (hubState.schedulesLoading) return;
                if (hubState.schedulesLoaded && !force) return;
                hubState.schedulesLoading = true;
                if (popover.isConnected) render();
                try {
                    let list = [];
                    if (globalThis.__tmCalendar && typeof globalThis.__tmCalendar.listTaskSchedulesByTaskId === 'function') {
                        list = await globalThis.__tmCalendar.listTaskSchedulesByTaskId(getBoundTaskId() || taskId, { futureOnly: false });
                    } else {
                        const raw = String(localStorage.getItem('tm-calendar-events') || '').trim();
                        const parsed = raw ? JSON.parse(raw) : [];
                        list = Array.isArray(parsed) ? parsed.filter((x) => {
                            const tid = String(x?.taskId || x?.task_id || x?.linkedTaskId || x?.linked_task_id || '').trim();
                            return tid === String(getBoundTaskId() || taskId || '').trim();
                        }) : [];
                    }
                    hubState.schedules = (Array.isArray(list) ? list : []).sort((a, b) => {
                        const ta = new Date(a?.start).getTime();
                        const tb = new Date(b?.start).getTime();
                        return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
                    });
                    try {
                        const first = hubState.schedules.find((it) => it?.allDay !== true) || hubState.schedules[0] || null;
                        root.__tmTaskDetailTimeHubScheduleText = formatTimeHubScheduleText(first);
                        syncTimeHubTriggerFace();
                    } catch (e) {}
                    hubState.schedulesLoaded = true;
                } catch (e) {
                    hubState.schedules = [];
                    try {
                        root.__tmTaskDetailTimeHubScheduleText = '';
                        syncTimeHubTriggerFace();
                    } catch (e2) {}
                } finally {
                    hubState.schedulesLoading = false;
                    if (popover.isConnected) render();
                }
            };
            const applyRepeatType = async (type) => {
                const rawType = String(type || '').trim();
                const nextType = rawType === 'lunar-monthly' ? 'monthly' : (rawType === 'lunar-yearly' ? 'yearly' : rawType);
                const nextCalendarMode = (rawType === 'lunar-monthly' || rawType === 'lunar-yearly') ? 'lunar' : 'solar';
                const task = getBoundTask() || {};
                try {
                    setInlinePopoverBusyState(true, popover);
                    if (!nextType || nextType === 'none') {
                        await window.tmClearTaskRepeatRule?.(getBoundTaskId() || taskId, { source: 'task-detail-time-hub' });
                    } else {
                        const current = getRepeatRule();
                        const anchorDate = readHiddenInputValue('completionTime') || readHiddenInputValue('startDate') || todayKey;
                        await window.tmSetTaskRepeatRule?.(getBoundTaskId() || taskId, {
                            ...current,
                            enabled: true,
                            type: nextType,
                            calendarMode: nextCalendarMode,
                            every: current?.type === nextType && (String(current?.calendarMode || '').trim() || 'solar') === nextCalendarMode ? current.every : 1,
                            anchorDate,
                            trigger: current?.trigger || 'due',
                        }, { source: 'task-detail-time-hub' });
                    }
                    const refreshed = await __tmResolveTaskForRepeat(getBoundTaskId() || taskId);
                    if (refreshed) {
                        try { root.__tmTaskDetailTask = refreshed; } catch (e) {}
                    } else {
                        try { root.__tmTaskDetailTask = task; } catch (e) {}
                    }
                    syncMetaChipFaces();
                    syncSerializedSnapshot();
                    hubState.editor = '';
                    render();
                } catch (e) {
                    hint(`❌ 循环更新失败: ${e.message}`, 'error');
                } finally {
                    setInlinePopoverBusyState(false, popover);
                }
            };
            const applyRepeatUntil = async (untilValue) => {
                const current = getRepeatRule();
                if (!current?.enabled || current.type === 'none') {
                    hint('⚠ 请先设置循环规则', 'warning');
                    return;
                }
                try {
                    setInlinePopoverBusyState(true, popover);
                    await window.tmSetTaskRepeatRule?.(getBoundTaskId() || taskId, {
                        ...current,
                        until: untilValue ? __tmNormalizeDateOnly(untilValue) : '',
                        anchorDate: readHiddenInputValue('completionTime') || readHiddenInputValue('startDate') || todayKey,
                    }, { source: 'task-detail-time-hub-until' });
                    const refreshed = await __tmResolveTaskForRepeat(getBoundTaskId() || taskId);
                    if (refreshed) {
                        try { root.__tmTaskDetailTask = refreshed; } catch (e) {}
                    }
                    syncMetaChipFaces();
                    syncSerializedSnapshot();
                    hubState.editor = '';
                    render();
                } catch (e) {
                    hint(`❌ 结束规则更新失败: ${e.message}`, 'error');
                } finally {
                    setInlinePopoverBusyState(false, popover);
                }
            };
            const openScheduleEditorFromHub = async () => {
                const dateKey = readHiddenInputValue('completionTime') || readHiddenInputValue('startDate') || todayKey;
                const timeKey = getTimeFromSchedules() || '09:00';
                const start = makeDateTime(dateKey, timeKey);
                const end = new Date(start.getTime() + 60 * 60000);
                if (globalThis.__tmCalendar && typeof globalThis.__tmCalendar.openScheduleEditor === 'function') {
                    await globalThis.__tmCalendar.openScheduleEditor({
                        taskId: getBoundTaskId() || taskId,
                        title: getTaskTitle(),
                        start: start.toISOString(),
                        end: end.toISOString(),
                        startDate: readHiddenInputValue('startDate'),
                        completionTime: readHiddenInputValue('completionTime'),
                        forceNew: true,
                    });
                    await loadHubSchedules(true);
                } else {
                    hint('⚠ 日历模块未就绪', 'warning');
                }
            };

            document.body.appendChild(popover);
            activeInlinePopover = popover;
            activeInlinePopoverTrigger = trigger;
            setTaskDetailActivePopover(popover);
            try { trigger.classList.add('is-open'); } catch (e) {}
            render();
            try { __tmAnimatePopupIn(popover, { origin: 'top-left', duration: 150 }); } catch (e) {}
            void loadHubSchedules(false);

            on(popover, 'click', async (ev) => {
                const target = ev.target instanceof Element ? ev.target : null;
                if (!target) return;
                const monthOpenBtn = target.closest('[data-tm-time-hub-month-open]');
                if (monthOpenBtn) {
                    try { ev.preventDefault(); } catch (e) {}
                    hubState.editor = hubState.editor === 'month' ? '' : 'month';
                    render();
                    return;
                }
                if (__tmShouldDismissTaskTimeHubEditor(popover, hubState.editor, target)) {
                    hubState.editor = '';
                    render();
                }
                const closeBtn = target.closest('[data-tm-time-hub-close]');
                if (closeBtn) {
                    try { ev.preventDefault(); } catch (e) {}
                    closeInlinePopover(false, 'time-hub-close');
                    return;
                }
                const tabBtn = target.closest('[data-tm-time-hub-tab]');
                if (tabBtn) {
                    try { ev.preventDefault(); } catch (e) {}
                    hubState.tab = String(tabBtn.getAttribute('data-tm-time-hub-tab') || 'date').trim() === 'schedule' ? 'schedule' : 'date';
                    hubState.editor = '';
                    render();
                    if (hubState.tab === 'schedule') void loadHubSchedules(false);
                    return;
                }
                const clearBtn = target.closest('[data-tm-time-hub-clear-date]');
                if (clearBtn) {
                    try { ev.preventDefault(); } catch (e) {}
                    try { ev.stopPropagation(); } catch (e) {}
                    const field = String(clearBtn.getAttribute('data-tm-time-hub-clear-date') || '').trim();
                    if (field === 'startDate' || field === 'completionTime') await updateDateField(field, '');
                    return;
                }
                const quickDateBtn = target.closest('[data-tm-time-hub-quick-date]');
                if (quickDateBtn) {
                    try { ev.preventDefault(); } catch (e) {}
                    if (quickDateBtn.disabled || quickDateBtn.getAttribute('aria-disabled') === 'true') return;
                    const key = __tmNormalizeDateOnly(quickDateBtn.getAttribute('data-tm-time-hub-quick-date') || '');
                    if (key) await updateDateField(hubState.activeField, key);
                    return;
                }
                const monthStepBtn = target.closest('[data-tm-time-hub-year-step]');
                if (monthStepBtn) {
                    try { ev.preventDefault(); } catch (e) {}
                    const delta = Number(monthStepBtn.getAttribute('data-tm-time-hub-year-step') || 0);
                    const current = getHubMonthDate();
                    const nextYear = Math.max(1000, Math.min(9999, current.getFullYear() + (delta || 0)));
                    setHubMonthYear(nextYear, { close: false });
                    return;
                }
                const monthPickBtn = target.closest('[data-tm-time-hub-month-pick]');
                if (monthPickBtn) {
                    try { ev.preventDefault(); } catch (e) {}
                    const monthIndex = Number(monthPickBtn.getAttribute('data-tm-time-hub-month-pick') || 0);
                    if (Number.isFinite(monthIndex) && monthIndex >= 0 && monthIndex <= 11) {
                        const current = getHubMonthDate();
                        setHubMonthDate(new Date(current.getFullYear(), monthIndex, 1, 12, 0, 0, 0));
                    }
                    return;
                }
                const dateCard = target.closest('[data-tm-time-hub-date-card]');
                if (dateCard) {
                    try { ev.preventDefault(); } catch (e) {}
                    const field = String(dateCard.getAttribute('data-tm-time-hub-date-card') || '').trim();
                    if (field === 'startDate' || field === 'completionTime') {
                        hubState.activeField = field;
                        hubState.editor = '';
                        render();
                    }
                    return;
                }
                const monthBtn = target.closest('[data-tm-time-hub-month]');
                if (monthBtn) {
                    try { ev.preventDefault(); } catch (e) {}
                    const delta = Number(monthBtn.getAttribute('data-tm-time-hub-month') || 0);
                    hubState.monthDate = delta === 0 ? startOfMonth(parseDateKey(todayKey) || new Date()) : shiftMonth(getHubMonthDate(), delta);
                    render();
                    return;
                }
                const dayBtn = target.closest('[data-tm-time-hub-date]');
                if (dayBtn) {
                    try { ev.preventDefault(); } catch (e) {}
                    if (suppressNextDayClick) {
                        suppressNextDayClick = false;
                        return;
                    }
                    const key = __tmNormalizeDateOnly(dayBtn.getAttribute('data-tm-time-hub-date') || '');
                    if (key) await updateDateField(hubState.activeField, key);
                    return;
                }
                const cardBtn = target.closest('[data-tm-time-hub-card]');
                if (cardBtn) {
                    try { ev.preventDefault(); } catch (e) {}
                    if (cardBtn.disabled || cardBtn.getAttribute('aria-disabled') === 'true') return;
                    const key = String(cardBtn.getAttribute('data-tm-time-hub-card') || '').trim();
                    if (key === 'reminder') {
                        try {
                            await tmReminder(getBoundTaskId() || taskId);
                        } finally {
                            scheduleReminderButtonStateRefresh();
                            render();
                        }
                        return;
                    }
                    hubState.editor = hubState.editor === key ? '' : key;
                    render();
                    return;
                }
                const reminderBtn = target.closest('[data-tm-time-hub-reminder-open]');
                if (reminderBtn) {
                    try { ev.preventDefault(); } catch (e) {}
                    try {
                        await tmReminder(getBoundTaskId() || taskId);
                    } finally {
                        scheduleReminderButtonStateRefresh();
                        render();
                    }
                    return;
                }
                const repeatBtn = target.closest('[data-tm-time-hub-repeat]');
                if (repeatBtn) {
                    try { ev.preventDefault(); } catch (e) {}
                    await applyRepeatType(repeatBtn.getAttribute('data-tm-time-hub-repeat'));
                    return;
                }
                const customRepeatBtn = target.closest('[data-tm-time-hub-repeat-custom]');
                if (customRepeatBtn) {
                    try { ev.preventDefault(); } catch (e) {}
                    const result = await window.tmEditTaskRepeatRule?.(getBoundTaskId() || taskId, { task: getBoundTask(), title: '循环设置' });
                    if (result) {
                        const refreshed = await __tmResolveTaskForRepeat(getBoundTaskId() || taskId);
                        if (refreshed) {
                            try { root.__tmTaskDetailTask = refreshed; } catch (e) {}
                        }
                        syncMetaChipFaces();
                        syncSerializedSnapshot();
                        render();
                    }
                    return;
                }
                const untilClearBtn = target.closest('[data-tm-time-hub-repeat-until-clear]');
                if (untilClearBtn) {
                    try { ev.preventDefault(); } catch (e) {}
                    await applyRepeatUntil('');
                    return;
                }
                const untilApplyBtn = target.closest('[data-tm-time-hub-repeat-until-apply]');
                if (untilApplyBtn) {
                    try { ev.preventDefault(); } catch (e) {}
                    const input = popover.querySelector('[data-tm-time-hub-repeat-until-input]');
                    await applyRepeatUntil(input instanceof HTMLInputElement ? input.value : '');
                    return;
                }
                const addScheduleBtn = target.closest('[data-tm-time-hub-add-schedule]');
                if (addScheduleBtn) {
                    try { ev.preventDefault(); } catch (e) {}
                    await openScheduleEditorFromHub();
                    return;
                }
                const toggleSchedulesBtn = target.closest('[data-tm-time-hub-toggle-schedules]');
                if (toggleSchedulesBtn) {
                    try { ev.preventDefault(); } catch (e) {}
                    hubState.scheduleExpanded = !hubState.scheduleExpanded;
                    render();
                    return;
                }
                const editScheduleBtn = target.closest('[data-tm-time-hub-edit-schedule]');
                if (editScheduleBtn) {
                    try { ev.preventDefault(); } catch (e) {}
                    const sid = String(editScheduleBtn.getAttribute('data-tm-time-hub-edit-schedule') || '').trim();
                    if (sid && globalThis.__tmCalendar?.openScheduleEditorById) await globalThis.__tmCalendar.openScheduleEditorById(sid);
                    return;
                }
                const deleteScheduleBtn = target.closest('[data-tm-time-hub-delete-schedule]');
                if (deleteScheduleBtn) {
                    try { ev.preventDefault(); } catch (e) {}
                    const sid = String(deleteScheduleBtn.getAttribute('data-tm-time-hub-delete-schedule') || '').trim();
                    if (sid && globalThis.__tmCalendar?.deleteScheduleById) {
                        await globalThis.__tmCalendar.deleteScheduleById(sid, { closeModal: false });
                        await loadHubSchedules(true);
                    }
                }
            });
            on(popover, 'input', (ev) => {
                const target = ev.target instanceof Element ? ev.target : null;
                const input = target?.closest?.('[data-tm-time-hub-year-input]');
                if (!(input instanceof HTMLInputElement)) return;
                const raw = String(input.value || '').trim();
                if (/^\d{4}$/.test(raw)) {
                    setHubMonthYear(raw, { close: false });
                }
            });
            on(popover, 'focusout', (ev) => {
                const target = ev.target instanceof Element ? ev.target : null;
                const input = target?.closest?.('[data-tm-time-hub-year-input]');
                if (!(input instanceof HTMLInputElement)) return;
                const raw = String(input.value || '').trim();
                if (/^\d{4}$/.test(raw)) return;
                input.value = String(getHubMonthDate().getFullYear());
            });
            on(popover, 'pointerdown', (ev) => {
                const target = ev.target instanceof Element ? ev.target : null;
                const dayBtn = target?.closest?.('[data-tm-time-hub-date]');
                if (!(dayBtn instanceof HTMLElement)) return;
                const key = __tmNormalizeDateOnly(dayBtn.getAttribute('data-tm-time-hub-date') || '');
                if (!key) return;
                if (ev.button != null && ev.button !== 0) return;
                hubState.rangeDrag = { anchor: key, current: key, moved: false };
                suppressNextDayClick = false;
                try { dayBtn.setPointerCapture?.(ev.pointerId); } catch (e) {}
            });
            on(popover, 'pointermove', (ev) => {
                if (!hubState.rangeDrag) return;
                const hit = document.elementFromPoint(Number(ev.clientX) || 0, Number(ev.clientY) || 0);
                const dayBtn = hit instanceof Element ? hit.closest('[data-tm-time-hub-date]') : null;
                if (!(dayBtn instanceof HTMLElement)) return;
                const key = __tmNormalizeDateOnly(dayBtn.getAttribute('data-tm-time-hub-date') || '');
                if (!key || key === hubState.rangeDrag.current) return;
                hubState.rangeDrag = {
                    ...hubState.rangeDrag,
                    current: key,
                    moved: key !== hubState.rangeDrag.anchor,
                };
                render();
            });
            on(window, 'pointerup', async () => {
                const drag = hubState.rangeDrag;
                if (!drag) return;
                hubState.rangeDrag = null;
                if (!drag.moved) {
                    suppressNextDayClick = true;
                    try { setTimeout(() => { suppressNextDayClick = false; }, 250); } catch (e) {}
                    await updateDateField(hubState.activeField, drag.anchor);
                    return;
                }
                suppressNextDayClick = true;
                try { setTimeout(() => { suppressNextDayClick = false; }, 250); } catch (e) {}
                await updateDateRange(drag.anchor, drag.current);
            });
            on(popover, 'keydown', async (ev) => {
                const target = ev.target instanceof Element ? ev.target : null;
                if (String(ev.key || '') === 'Enter') {
                    const yearInput = target?.closest?.('[data-tm-time-hub-year-input]');
                    if (yearInput instanceof HTMLInputElement) {
                        try { ev.preventDefault(); } catch (e) {}
                        const raw = String(yearInput.value || '').trim();
                        if (/^\d{4}$/.test(raw)) {
                            setHubMonthYear(raw, { close: false });
                        } else {
                            yearInput.value = String(getHubMonthDate().getFullYear());
                        }
                        return;
                    }
                    const card = target?.closest?.('[data-tm-time-hub-date-card]');
                    if (card) {
                        try { ev.preventDefault(); } catch (e) {}
                        card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    }
                }
            });
            on(window, 'tm:calendar-schedule-updated', () => {
                if (activeInlinePopover !== popover) return;
                void loadHubSchedules(true);
            });
        };
        on(document, 'pointerdown', (ev) => {
            if (!(activeInlinePopover instanceof HTMLElement)) return;
            const target = ev?.target;
            if (target instanceof Node) {
                if (activeInlinePopover.contains(target)) return;
                if (activeInlinePopoverTrigger instanceof HTMLElement && activeInlinePopoverTrigger.contains(target)) return;
            }
            if (inlinePopoverCommitting) {
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                try { ev.stopImmediatePropagation(); } catch (e) {}
                return;
            }
            closeInlinePopover(false, 'document-pointerdown');
        }, { capture: true });
        on(document, 'pointermove', (ev) => {
            const drag = whiteboardOutlinePanDrag;
            const popover = drag?.popover instanceof HTMLElement ? drag.popover : null;
            const scroll = drag?.scroll instanceof HTMLElement ? drag.scroll : null;
            if (!(popover instanceof HTMLElement) || !(scroll instanceof HTMLElement) || activeInlinePopover !== popover) return;
            if (drag.pointerId != null && ev.pointerId != null && drag.pointerId !== ev.pointerId) return;
            const dx = (Number(ev.clientX) || 0) - Number(drag.startX || 0);
            const dy = (Number(ev.clientY) || 0) - Number(drag.startY || 0);
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                drag.moved = true;
                scroll.classList.add('is-panning');
            }
            if (!drag.moved) return;
            try { ev.preventDefault(); } catch (e) {}
            try { ev.stopPropagation(); } catch (e) {}
            scroll.scrollLeft = Math.max(0, Number(drag.scrollLeft || 0) - dx);
            scroll.scrollTop = Math.max(0, Number(drag.scrollTop || 0) - dy);
        }, { capture: true });
        const finishWhiteboardOutlinePan = (ev) => {
            const drag = whiteboardOutlinePanDrag;
            const scroll = drag?.scroll instanceof HTMLElement ? drag.scroll : null;
            if (!(scroll instanceof HTMLElement)) return;
            if (drag.pointerId != null && ev?.pointerId != null && drag.pointerId !== ev.pointerId) return;
            whiteboardOutlinePanDrag = null;
            try { scroll.releasePointerCapture?.(drag.pointerId); } catch (e) {}
            scroll.classList.remove('is-panning');
            if (drag.moved && drag.startNode instanceof HTMLElement) {
                drag.startNode.dataset.tmSuppressNextClick = 'true';
                try { setTimeout(() => { try { delete drag.startNode.dataset.tmSuppressNextClick; } catch (e) {} }, 0); } catch (e) {}
            }
            if (drag.moved) {
                try { ev?.stopPropagation?.(); } catch (e) {}
            }
        };
        on(document, 'pointerup', finishWhiteboardOutlinePan, { capture: true });
        on(document, 'pointercancel', finishWhiteboardOutlinePan, { capture: true });
        on(document, 'keydown', (ev) => {
            if (String(ev?.key || '') !== 'Escape') return;
            if (!activeInlinePopover) return;
            if (inlinePopoverCommitting) {
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                return;
            }
            closeInlinePopover(false, 'document-escape');
        }, { capture: true });
        on(window, 'resize', () => {
            if (!activeInlinePopover) return;
            if (activeInlinePopover instanceof HTMLElement
                && activeInlinePopover.classList.contains('tm-task-detail-inline-popover--whiteboard-outline')) {
                refreshWhiteboardOutlinePopover(activeInlinePopover, { closeIfMissing: false, centerCurrent: true });
                return;
            }
            positionInlinePopover();
            positionEditorPanel();
        });
        on(window, 'scroll', (ev) => {
            if (!activeInlinePopover) return;
            if (inlinePopoverCommitting) return;
            const target = ev?.target;
            if (target instanceof Node && activeInlinePopover.contains(target)) return;
            closeInlinePopover(false, 'window-scroll');
        }, { capture: true, passive: true });
        const clearSubtaskSaveTimer = (subtaskId) => {
            const key = String(subtaskId || '').trim();
            const timer = subtaskSaveTimers.get(key);
            if (timer) {
                try { clearTimeout(timer); } catch (e) {}
                subtaskSaveTimers.delete(key);
            }
        };
        const syncTaskContentInVisibleViews = (taskLike) => {
            const tid = String(taskLike?.id || '').trim();
            if (!tid) return;
            const modal = state.modal instanceof Element ? state.modal : document;
            const html = `${API.renderTaskContentHtml(taskLike?.markdown, String(taskLike?.content || '').trim() || '(无内容)')}${__tmRenderGlobalCollectDocTaskInlineIcon(taskLike)}`;
            const plainText = String(taskLike?.content || '').trim() || '(无内容)';
            const updateTitleNode = (el) => {
                if (!(el instanceof HTMLElement)) return;
                if (!__tmDoesTaskDomTargetBelongToTask(el, tid, modal)) return;
                try { el.innerHTML = html; } catch (e) {}
                try { el.removeAttribute('title'); } catch (e) {}
                const tooltipTarget = el.matches('.tm-checklist-title-button > span')
                    ? el
                    : (el.closest('.tm-checklist-title-button') || el);
                try { __tmApplyTooltipAttrsToElement(tooltipTarget, plainText, { side: 'bottom' }); } catch (e) {}
            };
            const contentSelectors = [
                `#tmTaskTable tbody tr[data-id="${CSS.escape(tid)}"] .tm-task-content-clickable`,
                `#tmTimelineLeftTable tbody tr[data-id="${CSS.escape(tid)}"] .tm-task-content-clickable`,
                `.tm-body--kanban .tm-kanban-card[data-id="${CSS.escape(tid)}"] .tm-task-content-clickable`,
                `.tm-checklist-item[data-id="${CSS.escape(tid)}"] .tm-checklist-title-button > span`,
                `.tm-whiteboard-node[data-task-id="${CSS.escape(tid)}"] .tm-task-content-clickable`,
                `.tm-whiteboard-pool-item[data-task-id="${CSS.escape(tid)}"] .tm-task-content-clickable`,
                `.tm-whiteboard-stream-task-head[data-task-id="${CSS.escape(tid)}"] .tm-task-content-clickable`,
                `.tm-whiteboard-stream-task-node[data-task-id="${CSS.escape(tid)}"] .tm-task-content-clickable`,
            ];
            contentSelectors.forEach((selector) => {
                try {
                    modal.querySelectorAll(selector).forEach(updateTitleNode);
                } catch (e) {}
            });
        };
        const shouldRefreshContentProjection = (taskId, taskLike = null) => {
            const tid = String(taskId || taskLike?.id || '').trim();
            if (!tid) return false;
            const patch = {
                content: String(taskLike?.content || '').trim(),
                markdown: String(taskLike?.markdown || '').trim(),
            };
            try {
                if (typeof __tmDoesPatchNeedProjectionRefresh === 'function'
                    && __tmDoesPatchNeedProjectionRefresh(tid, patch, { withFilters: true })) {
                    return true;
                }
            } catch (e) {}
            return !!(state.groupByTaskName || String(state.searchKeyword || '').trim());
        };
        try {
            abortController.signal.addEventListener('abort', () => {
                subtaskSaveTimers.forEach((timer) => {
                    try { clearTimeout(timer); } catch (e) {}
                });
                subtaskSaveTimers.clear();
                subtaskContentSaveDepth = 0;
                try { root.__tmTaskDetailSubtaskContentSaving = false; } catch (e) {}
                try { root.__tmTaskDetailSubtaskContentEditingUntil = 0; } catch (e) {}
            }, { once: true });
        } catch (e) {}
        const saveSubtaskContent = async (textarea, subtaskId, options = {}) => {
            if (!(textarea instanceof HTMLTextAreaElement)) return false;
            const currentAttrTaskId = String(textarea.getAttribute('data-tm-detail-subtask-content') || '').trim();
            const tid = String(currentAttrTaskId || subtaskId || '').trim();
            const task = globalThis.__tmRuntimeState?.getTaskById?.(tid, { includePending: true, preferPending: true })
                || state.flatTasks?.[tid]
                || state.pendingInsertedTasks?.[tid]
                || null;
            if (!tid || !task) return false;
            const savedValue = String(textarea.dataset.savedValue || task.content || '').trim();
            const nextValue = String(textarea.value || '').trim();
            if (!nextValue) {
                textarea.value = savedValue;
                syncAutoHeight(textarea, subtaskTextareaMinHeight);
                if (options.showHint !== false) hint('⚠️ 子任务内容不能为空', 'warning');
                return false;
            }
            if (nextValue === savedValue) {
                textarea.value = nextValue;
                textarea.dataset.savedValue = nextValue;
                syncAutoHeight(textarea, subtaskTextareaMinHeight);
                return true;
            }
            if (textarea.dataset.saving === 'true') return false;
            textarea.dataset.saving = 'true';
            setSubtaskContentBusy(true, 1800);
            try {
                const taskPatchBeforeSave = {
                    content: nextValue,
                    markdown: (() => {
                        try {
                            const currentMarkdown = String(task.markdown || '').trim();
                            const checked = !!task.done;
                            const line = `- [${checked ? 'x' : ' '}] ${nextValue}`;
                            if (!currentMarkdown) return line;
                            const lines = currentMarkdown.split(/\r?\n/);
                            lines[0] = line;
                            return lines.join('\n');
                        } catch (e) {
                            return `- [${task.done ? 'x' : ' '}] ${nextValue}`;
                        }
                    })(),
                    raw_content: nextValue,
                    rawContent: nextValue,
                };
                const refreshProjectionAfterSave = shouldRefreshContentProjection(tid, taskPatchBeforeSave);
                const patchContent = globalThis.__tmRequireTaskOutbox?.('patchContent');
                if (typeof patchContent !== 'function') throw new Error('任务写入队列未就绪: patchContent');
                const savePromise = patchContent(tid, nextValue, {
                    background: true,
                    skipInteractionGate: true,
                    defer: false,
                    renderOptimistic: false,
                    skipSettledRefresh: true,
                    withFilters: refreshProjectionAfterSave,
                    forceProjectionRefresh: refreshProjectionAfterSave,
                    source: 'detail-subtask-content-save',
                    reason: 'detail-subtask-content-save',
                });
                Promise.resolve(savePromise).catch((e) => {
                    textarea.value = savedValue;
                    syncAutoHeight(textarea, subtaskTextareaMinHeight);
                    if (options.showHint !== false) hint(`❌ 子任务更新失败: ${e.message}`, 'error');
                });
                try {
                    if (state.pendingInsertedTasks?.[tid]) {
                        globalThis.__tmTaskStore?.patchPending?.(tid, {
                            content: nextValue,
                            markdown: (globalThis.__tmRuntimeState?.getTaskById?.(tid, { includePending: true, preferPending: true }) || state.flatTasks?.[tid] || state.pendingInsertedTasks?.[tid])?.markdown || state.pendingInsertedTasks[tid].markdown,
                        }, {
                            source: 'detail-subtask-content-save',
                        });
                    }
                } catch (e) {}
                try { __tmInvalidateTasksQueryCacheByDocId(task.root_id || task.docId); } catch (e) {}
                textarea.dataset.savedValue = nextValue;
                textarea.value = nextValue;
                syncAutoHeight(textarea, subtaskTextareaMinHeight);
                const syncedTask = { ...task, ...taskPatchBeforeSave };
                try {
                    Object.assign(task, taskPatchBeforeSave);
                    globalThis.__tmTaskStore?.patchLocal?.(tid, taskPatchBeforeSave, {
                        source: 'detail-subtask-content-save',
                    });
                } catch (e) {}
                try { syncTaskContentInVisibleViews(syncedTask); } catch (e) {}
                if (refreshProjectionAfterSave) {
                    try {
                        const active = document.activeElement;
                        const isStillEditing = active === textarea
                            || (active instanceof Element
                                && root.contains(active)
                                && !!active.closest?.('[data-tm-detail-subtask-content]'));
                        const detail = {
                            mode: 'current',
                            withFilters: true,
                            reason: 'detail-subtask-content-save',
                            taskIds: [tid],
                        };
                        if (isStillEditing && typeof __tmScheduleBusyDetailViewRefresh === 'function') {
                            __tmScheduleBusyDetailViewRefresh(detail);
                        } else {
                            __tmScheduleViewRefresh(detail);
                        }
                    } catch (e) {}
                }
                return true;
            } catch (e) {
                textarea.value = savedValue;
                syncAutoHeight(textarea, subtaskTextareaMinHeight);
                if (options.showHint !== false) hint(`❌ 子任务更新失败: ${e.message}`, 'error');
                return false;
            } finally {
                try { delete textarea.dataset.saving; } catch (e) {}
                setSubtaskContentBusy(false, 420);
            }
        };
        const scheduleSubtaskSave = (textarea, subtaskId) => {
            const tid = String(subtaskId || '').trim();
            if (!tid) return;
            clearSubtaskSaveTimer(tid);
            setSubtaskContentEditingHold(textarea);
            const timer = setTimeout(() => {
                subtaskSaveTimers.delete(tid);
                saveSubtaskContent(textarea, tid, { showHint: false }).catch(() => null);
            }, 700);
            subtaskSaveTimers.set(tid, timer);
        };
        const bindSubtaskContentEditor = (el, subtaskId) => {
            if (!(el instanceof HTMLTextAreaElement)) return;
            const tid = String(subtaskId || '').trim();
            if (!tid) return;
            if (!el.dataset.savedValue) el.dataset.savedValue = String(el.value || '').trim();
            syncAutoHeight(el, subtaskTextareaMinHeight);
            on(el, 'focus', () => {
                setSubtaskContentEditingHold(el);
            });
            on(el, 'compositionstart', () => {
                try { el.dataset.composing = 'true'; } catch (e) {}
                setSubtaskContentEditingHold(el, 2600);
            });
            on(el, 'compositionend', () => {
                try { delete el.dataset.composing; } catch (e) {}
                syncAutoHeight(el, subtaskTextareaMinHeight);
                setSubtaskContentEditingHold(el);
                if (el.readOnly) return;
                scheduleSubtaskSave(el, tid);
            });
            on(el, 'input', () => {
                syncAutoHeight(el, subtaskTextareaMinHeight);
                setSubtaskContentEditingHold(el);
                if (el.readOnly) return;
                scheduleSubtaskSave(el, tid);
            });
            on(el, 'blur', () => {
                try { delete el.dataset.composing; } catch (e) {}
                clearSubtaskContentEditingHold(el);
                clearSubtaskSaveTimer(tid);
                if (el.readOnly) return;
                saveSubtaskContent(el, tid, { showHint: false }).catch(() => null);
            });
            on(el, 'keydown', async (ev) => {
                if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing && el.dataset.composing !== 'true') {
                    try { ev.preventDefault(); } catch (e) {}
                    clearSubtaskSaveTimer(tid);
                    await saveSubtaskContent(el, tid, { showHint: true });
                    try { el.blur(); } catch (e) {}
                }
            });
        };
        const restoreSubtaskEmptyState = () => {
            const list = root.querySelector('[data-tm-detail-subtasks]');
            if (!(list instanceof HTMLElement)) return;
            const section = list.closest('.tm-task-detail-section--subtasks');
            const hasRealRows = Array.from(list.children).some((el) => el instanceof HTMLElement && el.classList.contains('tm-task-detail-subtask'));
            if (hasRealRows) {
                if (section instanceof HTMLElement) section.classList.remove('tm-task-detail-section--subtasks-empty');
                return;
            }
            list.innerHTML = '';
            if (section instanceof HTMLElement) section.classList.add('tm-task-detail-section--subtasks-empty');
        };
        const bindSubtaskDraftRow = (draftRow) => {
            if (!(draftRow instanceof HTMLElement)) return;
            const input = draftRow.querySelector('[data-tm-detail-subtask-draft-input]');
            const cancelBtn = draftRow.querySelector('[data-tm-detail-subtask-draft-cancel]');
            const saveBtn = draftRow.querySelector('[data-tm-detail-subtask-draft-save]');
            if (!(input instanceof HTMLTextAreaElement)) return;
            const removeDraft = () => {
                try { draftRow.remove(); } catch (e) {}
                restoreSubtaskEmptyState();
            };
            let queuedSubtaskAnchor = draftRow;
            const queuedSubtaskRows = [];
            const insertQueuedSubtaskRow = (createdId, text, index = 0) => {
                const tid = String(createdId || '').trim();
                if (!tid) return null;
                const effectiveTid = __tmResolveTaskDetailEffectiveId(tid) || tid;
                const queuedTask = globalThis.__tmRuntimeState?.getTaskById?.(tid, { includePending: true, preferPending: true })
                    || (effectiveTid !== tid ? globalThis.__tmRuntimeState?.getTaskById?.(effectiveTid, { includePending: true, preferPending: true }) : null)
                    || state.flatTasks?.[tid]
                    || (effectiveTid !== tid ? state.flatTasks?.[effectiveTid] : null)
                    || state.pendingInsertedTasks?.[tid]
                    || (effectiveTid !== tid ? state.pendingInsertedTasks?.[effectiveTid] : null)
                    || {
                        id: effectiveTid,
                        done: false,
                        content: String(text || '').trim(),
                        markdown: `- [ ] ${String(text || '').trim()}`,
                        children: [],
                    };
                const html = __tmBuildTaskDetailSubtasksHtml({ id: taskId, children: [queuedTask] });
                if (!html) return;
                const wrap = document.createElement('div');
                wrap.innerHTML = html.trim();
                const nextRow = wrap.firstElementChild;
                if (!(nextRow instanceof HTMLElement)) return null;
                const list = root.querySelector('[data-tm-detail-subtasks]');
                if (!(list instanceof HTMLElement)) return null;
                try {
                    const previousRow = queuedSubtaskRows.slice().reverse().find((row) => row instanceof HTMLElement && row.isConnected);
                    if (previousRow instanceof HTMLElement) previousRow.after(nextRow);
                    else if (queuedSubtaskAnchor instanceof HTMLElement && queuedSubtaskAnchor.isConnected) queuedSubtaskAnchor.replaceWith(nextRow);
                    else list.appendChild(nextRow);
                } catch (e) { return null; }
                queuedSubtaskAnchor = nextRow;
                queuedSubtaskRows[index] = nextRow;
                try {
                    nextRow.querySelectorAll('[data-tm-detail-subtask-content]').forEach((el) => {
                        if (!(el instanceof HTMLTextAreaElement)) return;
                        const subtaskId = String(el.getAttribute('data-tm-detail-subtask-content') || '').trim();
                        if (!subtaskId) return;
                        bindSubtaskContentEditor(el, subtaskId);
                    });
                } catch (e) {}
                try { __tmBindFloatingTooltips(nextRow); } catch (e) {}
                restoreSubtaskEmptyState();
                return nextRow;
            };
            const removeQueuedSubtaskRow = (index = 0) => {
                const row = queuedSubtaskRows[index];
                if (!(row instanceof HTMLElement)) {
                    if (queuedSubtaskRows.some((item) => item instanceof HTMLElement && item.isConnected)) return;
                    removeDraft();
                    return;
                }
                try { row.remove(); } catch (e) {}
                queuedSubtaskRows[index] = null;
                restoreSubtaskEmptyState();
            };
            const restoreDraftControlsIfConnected = () => {
                if (!draftRow.isConnected) return;
                try { delete draftRow.dataset.saving; } catch (e) {}
                try { input.readOnly = false; } catch (e) {}
                try { if (saveBtn instanceof HTMLButtonElement) saveBtn.disabled = false; } catch (e) {}
                try { if (cancelBtn instanceof HTMLButtonElement) cancelBtn.disabled = false; } catch (e) {}
                try { syncAutoHeight(input, subtaskTextareaMinHeight); } catch (e) {}
            };
            const refreshBoardAfterQueuedSubtask = (parentId, subtaskId) => {
                const mode = String(state.viewMode || '').trim();
                if (mode !== 'kanban' && mode !== 'whiteboard') return false;
                const ids = Array.from(new Set([parentId, subtaskId].map((id) => String(id || '').trim()).filter(Boolean)));
                if (!ids.length) return false;
                const parentTid = String(parentId || '').trim();
                try { if (parentTid) __tmKanbanGetCollapsedSet?.()?.delete?.(parentTid); } catch (e) {}
                try { __tmKanbanColsHtmlCache = null; } catch (e) {}
                try { __tmInvalidateFilteredTaskDerivedStateCache?.(); } catch (e) {}
                try { state.listDomRenderSignature = ''; } catch (e) {}
                const rerender = () => {
                    try { __tmKanbanColsHtmlCache = null; } catch (e) {}
                    try {
                        if (__tmRerenderCurrentViewInPlace(state.modal)) return true;
                    } catch (e) {}
                    try {
                        __tmScheduleViewRefresh({
                            mode: 'current',
                            withFilters: false,
                            reason: 'detail-create-subtask-board-refresh',
                            taskIds: ids,
                            bypassDefer: true,
                        });
                    } catch (e) {}
                    return false;
                };
                let refreshed = false;
                try { refreshed = !!rerender(); } catch (e) {}
                if (!refreshed) {
                    try { requestAnimationFrame(rerender); } catch (e) { try { setTimeout(rerender, 0); } catch (e2) {} }
                }
                return true;
            };
            const submitDraft = () => {
                const taskLines = __tmSplitTaskInputLines(input.value || '');
                if (taskLines.length === 0) {
                    hint('⚠️ 请输入子任务内容', 'warning');
                    try { input.focus(); } catch (e) {}
                    return;
                }
                if (draftRow.dataset.saving === 'true') return;
                draftRow.dataset.saving = 'true';
                try { input.readOnly = true; } catch (e) {}
                try { if (saveBtn instanceof HTMLButtonElement) saveBtn.disabled = true; } catch (e) {}
                try { if (cancelBtn instanceof HTMLButtonElement) cancelBtn.disabled = true; } catch (e) {}
                bumpDetailRefreshHold(180);
                try {
                    const detailScrollSnapshot = captureEmbeddedDetailScroll();
                    const parentForCreate = getBoundTaskId() || taskId;
                    const tempIds = [];
                    const restoreDetailAfterSubtaskCommit = () => {
                        try { restoreEmbeddedDetailScroll(detailScrollSnapshot, { onlyIfNear: true }); } catch (e) {}
                    };
                    const createSubtask = globalThis.__tmRequireTaskOutbox?.('createSubtask');
                    if (typeof createSubtask !== 'function') throw new Error('任务写入队列未就绪: createSubtask');
                    const createPromises = taskLines.map((line, index) => createSubtask(parentForCreate, line, {
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
                            checklistGroup: false,
                            snapshot: false,
                            withFilters: false,
                        },
                        onQueued: (tempId) => {
                            const tid = String(tempId || '').trim();
                            if (tid) tempIds.push(tid);
                            try { __tmScheduleChecklistOptimisticSubtaskRefresh?.(parentForCreate, tid, { force: true }); } catch (e) {}
                            insertQueuedSubtaskRow(tempId, line, index);
                            try { refreshBoardAfterQueuedSubtask(parentForCreate, tid); } catch (e) {}
                            restoreEmbeddedDetailScroll(detailScrollSnapshot, { onlyIfNear: true });
                        },
                        onError: (err) => {
                            removeQueuedSubtaskRow(index);
                            hint(`❌ 新建子任务失败: ${err?.message || err || '未知错误'}`, 'error');
                        },
                        onSuccess: (realId, meta) => {
                            restoreDetailAfterSubtaskCommit(realId, meta);
                        },
                        onFinally: () => {
                            try { delete draftRow.dataset.saving; } catch (e2) {}
                        }
                    }));
                    try {
                        __tmScheduleViewRefresh({
                            mode: 'detail',
                            withFilters: false,
                            reason: 'detail-create-subtask-optimistic',
                            taskIds: [parentForCreate].concat(tempIds).filter(Boolean),
                        });
                    } catch (e) {}
                    Promise.all(createPromises).then(() => {
                        restoreEmbeddedDetailScroll(detailScrollSnapshot, { onlyIfNear: true });
                        hint(taskLines.length > 1 ? `✅ 已新增 ${taskLines.length} 个子任务` : '✅ 已新增', 'success');
                        bumpDetailRefreshHold(120);
                    }).catch((e) => {
                        hint(`❌ 新建子任务失败: ${e.message}`, 'error');
                        bumpDetailRefreshHold(120);
                    }).finally(() => {
                        restoreDraftControlsIfConnected();
                    });
                    restoreEmbeddedDetailScroll(detailScrollSnapshot, { onlyIfNear: true });
                } catch (e) {
                    hint(`❌ 新建子任务失败: ${e.message}`, 'error');
                    removeDraft();
                    try { delete draftRow.dataset.saving; } catch (e2) {}
                    try { input.readOnly = false; } catch (e3) {}
                    try { if (saveBtn instanceof HTMLButtonElement) saveBtn.disabled = false; } catch (e4) {}
                    try { if (cancelBtn instanceof HTMLButtonElement) cancelBtn.disabled = false; } catch (e5) {}
                    bumpDetailRefreshHold(120);
                }
            };
            syncAutoHeight(input, subtaskTextareaMinHeight);
            on(input, 'input', () => syncAutoHeight(input, subtaskTextareaMinHeight));
            on(input, 'keydown', (ev) => {
                if (ev.key === 'Escape') {
                    try { ev.preventDefault(); } catch (e) {}
                    removeDraft();
                    return;
                }
                if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
                    if (!ev.ctrlKey && !ev.metaKey) return;
                    try { ev.preventDefault(); } catch (e) {}
                    submitDraft();
                }
            });
            on(cancelBtn, 'click', (ev) => {
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                removeDraft();
            });
            on(saveBtn, 'click', (ev) => {
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                submitDraft();
            });
            try {
                requestAnimationFrame(() => {
                    try { input.focus(); } catch (e) {}
                });
            } catch (e) {}
        };
        const openInlineSubtaskDraft = (draftOptions = {}) => {
            const draftOpts = (draftOptions && typeof draftOptions === 'object') ? draftOptions : {};
            const list = root.querySelector('[data-tm-detail-subtasks]');
            if (!(list instanceof HTMLElement)) return;
            const existing = list.querySelector('[data-tm-detail-subtask-draft]');
            if (existing instanceof HTMLElement) {
                try {
                    const existingInput = existing.querySelector('[data-tm-detail-subtask-draft-input]');
                    if (existingInput instanceof HTMLTextAreaElement) {
                        if (draftOpts.value != null) existingInput.value = String(draftOpts.value || '');
                        syncAutoHeight(existingInput, subtaskTextareaMinHeight);
                        existingInput.focus();
                        if (Number.isFinite(Number(draftOpts.selectionStart))) {
                            const start = Math.max(0, Number(draftOpts.selectionStart || 0));
                            const end = Math.max(start, Number(draftOpts.selectionEnd ?? start));
                            existingInput.setSelectionRange(start, end);
                        }
                    }
                } catch (e) {}
                return;
            }
            const empty = list.querySelector('.tm-task-detail-empty');
            if (empty) {
                try { empty.remove(); } catch (e) {}
            }
            const draftRow = document.createElement('div');
            draftRow.className = 'tm-task-detail-subtask tm-task-detail-subtask--draft';
            draftRow.setAttribute('data-tm-detail-subtask-draft', 'true');
            draftRow.innerHTML = `
                <div class="tm-task-detail-subtask-row">
                    <div class="tm-task-detail-subtask-main">
                        <span class="tm-task-detail-subtask-draft-marker" aria-hidden="true"></span>
                        <textarea class="tm-task-detail-subtask-title" data-tm-detail-subtask-draft-input rows="2" placeholder="每行一个子任务；回车换行，Ctrl + 回车提交" enterkeyhint="enter"></textarea>
                    </div>
                    <div class="tm-task-detail-subtask-trailing">
                        <div class="tm-task-detail-subtask-actions">
                            <button type="button" class="bc-btn bc-btn--sm tm-task-detail-subtask-action" data-tm-detail-subtask-draft-save${__tmBuildTooltipAttrs('创建子任务', { side: 'bottom' })}>${__tmRenderLucideIcon('check-circle-2')}</button>
                            <button type="button" class="bc-btn bc-btn--sm tm-task-detail-subtask-action" data-tm-detail-subtask-draft-cancel${__tmBuildTooltipAttrs('取消', { side: 'bottom' })}>${__tmRenderLucideIcon('x')}</button>
                        </div>
                    </div>
                </div>
            `;
            list.appendChild(draftRow);
            const section = list.closest('.tm-task-detail-section--subtasks');
            if (section instanceof HTMLElement) section.classList.remove('tm-task-detail-section--subtasks-empty');
            bindSubtaskDraftRow(draftRow);
            try {
                const input = draftRow.querySelector('[data-tm-detail-subtask-draft-input]');
                if (input instanceof HTMLTextAreaElement && draftOpts.value != null) {
                    input.value = String(draftOpts.value || '');
                    syncAutoHeight(input, subtaskTextareaMinHeight);
                }
                if (input instanceof HTMLTextAreaElement && draftOpts.focus !== false) {
                    requestAnimationFrame(() => {
                        try {
                            input.focus();
                            if (Number.isFinite(Number(draftOpts.selectionStart))) {
                                const start = Math.max(0, Number(draftOpts.selectionStart || 0));
                                const end = Math.max(start, Number(draftOpts.selectionEnd ?? start));
                                input.setSelectionRange(start, end);
                            }
                        } catch (e) {}
                    });
                }
            } catch (e) {}
            try { __tmBindFloatingTooltips(draftRow); } catch (e) {}
        };
        try { root.__tmTaskDetailOpenInlineSubtaskDraft = openInlineSubtaskDraft; } catch (e) {}
        try {
            const pendingDraftSnapshot = root.__tmPendingSubtaskDraftSnapshot;
            if (pendingDraftSnapshot && typeof pendingDraftSnapshot === 'object') {
                delete root.__tmPendingSubtaskDraftSnapshot;
                __tmRestoreTaskDetailSubtaskDraftSnapshot(root, pendingDraftSnapshot);
            }
        } catch (e) {}
        const bindSubtaskEditors = () => {
            root.querySelectorAll('[data-tm-detail-subtask-content]').forEach((el) => {
                if (!(el instanceof HTMLTextAreaElement)) return;
                const tid = String(el.getAttribute('data-tm-detail-subtask-content') || '').trim();
                if (!tid) return;
                bindSubtaskContentEditor(el, tid);
            });
        };
        const syncSubtaskEditorHeights = () => {
            root.querySelectorAll('[data-tm-detail-subtask-content], [data-tm-detail-subtask-draft-input]').forEach((el) => {
                if (el instanceof HTMLTextAreaElement) syncAutoHeight(el, subtaskTextareaMinHeight);
            });
        };
        try {
            if (typeof ResizeObserver === 'function') {
                let resizeRaf = 0;
                const resizeObserver = new ResizeObserver(() => {
                    try { if (resizeRaf) cancelAnimationFrame(resizeRaf); } catch (e) {}
                    resizeRaf = requestAnimationFrame(() => {
                        resizeRaf = 0;
                        syncSubtaskEditorHeights();
                    });
                });
                resizeObserver.observe(root);
                abortController.signal.addEventListener('abort', () => {
                    try { if (resizeRaf) cancelAnimationFrame(resizeRaf); } catch (e) {}
                    try { resizeObserver.disconnect(); } catch (e) {}
                }, { once: true });
            }
        } catch (e) {}
        const bindCustomFieldEditors = () => {
            root.querySelectorAll('[data-tm-detail-custom-field]').forEach((button) => {
                if (!(button instanceof HTMLButtonElement)) return;
                on(button, 'click', (ev) => {
                    try { ev.preventDefault(); } catch (e) {}
                    try { ev.stopPropagation(); } catch (e) {}
                    const fieldId = String(button.getAttribute('data-tm-detail-custom-field') || '').trim();
                    const currentTask = getBoundTask();
                    const currentTaskId = String(currentTask?.id || taskId || '').trim();
                    if (!fieldId || !currentTaskId) return;
                    window.tmOpenCustomFieldSelect(currentTaskId, fieldId, ev, button, {
                        refresh: false,
                        anchorEl: button,
                        skipDetailPatch: true,
                        broadcast: false,
                        onAfterSave: () => {}
                    });
                });
            });
        };
        const bindStatusSelect = () => {
            const selectRoot = root.querySelector('[data-tm-detail-status-select]');
            if (!(selectRoot instanceof HTMLElement)) return;
            const hiddenInput = selectRoot.querySelector('[data-tm-detail="status"]');
            const trigger = selectRoot.querySelector('[data-tm-detail-status-trigger]');
            const menu = selectRoot.querySelector('[data-tm-detail-status-menu]');
            const valueWrap = trigger?.querySelector('.tm-task-detail-status-trigger__value');
            if (!(hiddenInput instanceof HTMLInputElement) || !(trigger instanceof HTMLElement) || !(menu instanceof HTMLElement) || !(valueWrap instanceof HTMLElement)) return;
            const optionButtons = Array.from(menu.querySelectorAll('[data-tm-detail-status-option]')).filter((el) => el instanceof HTMLButtonElement);
            if (!optionButtons.length) return;

            const closeMenu = (reason = '') => {
                try {
                    __tmPushDetailDebug('detail-status-menu-close', {
                        taskId: String(taskId || '').trim(),
                        reason: String(reason || '').trim() || 'manual',
                        expanded: trigger.getAttribute('aria-expanded') === 'true',
                    });
                } catch (e) {}
                menu.hidden = true;
                menu.style.display = 'none';
                trigger.setAttribute('aria-expanded', 'false');
            };
            const openMenu = () => {
                try {
                    __tmPushDetailDebug('detail-status-menu-open', {
                        taskId: String(taskId || '').trim(),
                        currentValue: String(hiddenInput.value || '').trim(),
                    });
                } catch (e) {}
                menu.hidden = false;
                menu.style.display = 'flex';
                trigger.setAttribute('aria-expanded', 'true');
            };
            const syncStatusUi = () => {
                let current = String(hiddenInput.value || '').trim();
                let matched = optionButtons.find((btn) => String(btn.getAttribute('data-value') || '').trim() === current) || optionButtons[0];
                if (!matched) return;
                current = String(matched.getAttribute('data-value') || '').trim();
                hiddenInput.value = current;
                const label = String(matched.getAttribute('data-label') || current).trim() || current;
                const color = String(matched.getAttribute('data-color') || '').trim();
                valueWrap.textContent = label;
                try { trigger.setAttribute('style', __tmBuildStatusChipStyle(color)); } catch (e) {}
                optionButtons.forEach((btn) => {
                    const selected = btn === matched;
                    btn.classList.toggle('is-selected', selected);
                    btn.setAttribute('aria-selected', selected ? 'true' : 'false');
                });
            };
            refreshStatusSelectUi = syncStatusUi;

            on(trigger, 'click', (ev) => {
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                if (menu.hidden) openMenu();
                else closeMenu('toggle-trigger');
            });
            on(root, 'pointerdown', (ev) => {
                if (selectRoot.contains(ev.target)) return;
                closeMenu('root-pointerdown');
            });
            on(selectRoot, 'focusout', () => {
                try {
                    requestAnimationFrame(() => {
                        if (!selectRoot.contains(document.activeElement)) closeMenu('focusout');
                    });
                } catch (e) {}
            });
            on(selectRoot, 'keydown', (ev) => {
                if (ev.key !== 'Escape') return;
                try { ev.preventDefault(); } catch (e) {}
                closeMenu('escape');
                try { trigger.focus(); } catch (e) {}
            });
            optionButtons.forEach((btn) => {
                on(btn, 'click', async (ev) => {
                    try { ev.preventDefault(); } catch (e) {}
                    try { ev.stopPropagation(); } catch (e) {}
                    const nextValue = String(btn.getAttribute('data-value') || '').trim();
                    const prevValue = String(hiddenInput.value || '').trim();
                    hiddenInput.value = nextValue;
                    syncStatusUi();
                    closeMenu('select-option');
                    try { trigger.focus(); } catch (e) {}
                    if (nextValue === prevValue) return;
                    try {
                        __tmPushDetailDebug('detail-status-menu-commit', {
                            taskId: String(taskId || '').trim(),
                            prevValue,
                            nextValue,
                        });
                    } catch (e) {}
                    commitDetailFieldPatch({ customStatus: nextValue }, {
                        source: 'detail-status',
                        reason: 'detail-status',
                        label: '状态',
                        onFailure: () => {
                            hiddenInput.value = prevValue;
                            syncStatusUi();
                            try { hint('❌ 状态更新失败', 'error'); } catch (e) {}
                        },
                    });
                });
            });
            syncStatusUi();
            closeMenu('init');
        };
        const bindPrioritySelect = () => {
            const selectRoot = root.querySelector('[data-tm-detail-priority-select]');
            if (!(selectRoot instanceof HTMLElement)) return;
            const hiddenInput = selectRoot.querySelector('input[type="hidden"][data-tm-detail="priority"]') || root.querySelector('input[type="hidden"][data-tm-detail="priority"]');
            const trigger = selectRoot.querySelector('[data-tm-detail-priority-trigger]');
            const menu = selectRoot.querySelector('[data-tm-detail-priority-menu]');
            const valueWrap = trigger?.querySelector('.tm-task-detail-priority-trigger__value');
            if (!(hiddenInput instanceof HTMLInputElement) || !(trigger instanceof HTMLElement) || !(menu instanceof HTMLElement) || !(valueWrap instanceof HTMLElement)) return;
            const optionButtons = Array.from(menu.querySelectorAll('[data-tm-detail-priority-option]')).filter((el) => el instanceof HTMLButtonElement);
            if (!optionButtons.length) return;

            const closeMenu = (reason = '') => {
                try {
                    __tmPushDetailDebug('detail-priority-menu-close', {
                        taskId: String(taskId || '').trim(),
                        reason: String(reason || '').trim() || 'manual',
                        expanded: trigger.getAttribute('aria-expanded') === 'true',
                    });
                } catch (e) {}
                menu.hidden = true;
                menu.style.display = 'none';
                trigger.setAttribute('aria-expanded', 'false');
            };
            const openMenu = () => {
                try {
                    __tmPushDetailDebug('detail-priority-menu-open', {
                        taskId: String(taskId || '').trim(),
                        currentValue: String(hiddenInput.value || '').trim(),
                    });
                } catch (e) {}
                menu.hidden = false;
                menu.style.display = 'flex';
                trigger.setAttribute('aria-expanded', 'true');
            };
            const syncPriorityUi = () => {
                let current = String(hiddenInput.value || '').trim();
                let matched = optionButtons.find((btn) => String(btn.getAttribute('data-value') || '').trim() === current) || optionButtons[0];
                if (!matched) return;
                current = String(matched.getAttribute('data-value') || '').trim();
                hiddenInput.value = current;
                valueWrap.innerHTML = __tmRenderPriorityJira(current || 'none', false);
                try { trigger.setAttribute('style', __tmBuildPriorityChipStyle(current || 'none')); } catch (e) {}
                optionButtons.forEach((btn) => {
                    const selected = btn === matched;
                    btn.classList.toggle('is-selected', selected);
                    btn.setAttribute('aria-selected', selected ? 'true' : 'false');
                });
            };
            refreshPrioritySelectUi = syncPriorityUi;

            on(trigger, 'click', (ev) => {
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                if (menu.hidden) openMenu();
                else closeMenu('toggle-trigger');
            });
            on(root, 'pointerdown', (ev) => {
                if (selectRoot.contains(ev.target)) return;
                closeMenu('root-pointerdown');
            });
            on(selectRoot, 'focusout', () => {
                try {
                    requestAnimationFrame(() => {
                        if (!selectRoot.contains(document.activeElement)) closeMenu('focusout');
                    });
                } catch (e) {}
            });
            on(selectRoot, 'keydown', (ev) => {
                if (ev.key !== 'Escape') return;
                try { ev.preventDefault(); } catch (e) {}
                closeMenu('escape');
                try { trigger.focus(); } catch (e) {}
            });
            optionButtons.forEach((btn) => {
                on(btn, 'click', async (ev) => {
                    try { ev.preventDefault(); } catch (e) {}
                    try { ev.stopPropagation(); } catch (e) {}
                    const nextValue = String(btn.getAttribute('data-value') || '').trim();
                    const prevValue = String(hiddenInput.value || '').trim();
                    hiddenInput.value = nextValue;
                    syncPriorityUi();
                    closeMenu('select-option');
                    if (nextValue === prevValue) return;
                    try {
                        __tmPushDetailDebug('detail-priority-menu-commit', {
                            taskId: String(taskId || '').trim(),
                            prevValue,
                            nextValue,
                        });
                    } catch (e) {}
                    commitDetailFieldPatch({ priority: nextValue }, {
                        source: 'detail-priority',
                        reason: 'detail-priority',
                        label: '重要性',
                        onFailure: () => {
                            hiddenInput.value = prevValue;
                            syncPriorityUi();
                            try { hint('❌ 重要性更新失败', 'error'); } catch (e) {}
                        },
                    });
                });
            });
            syncPriorityUi();
            closeMenu('init');
        };
        const bindCoreMetaControls = () => {
            on(root.querySelector('[data-tm-detail-time-hub-trigger]'), 'click', (ev) => {
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                openTaskTimeHubPopover(ev.currentTarget, { activeField: 'completionTime' });
            });
            root.querySelectorAll('[data-tm-detail-date-trigger]').forEach((btn) => {
                if (!(btn instanceof HTMLButtonElement)) return;
                on(btn, 'click', (ev) => {
                    try { ev.preventDefault(); } catch (e) {}
                    try { ev.stopPropagation(); } catch (e) {}
                    const field = String(btn.getAttribute('data-tm-detail-date-trigger') || '').trim();
                    if (!field) return;
                    openTaskTimeHubPopover(btn, { activeField: field === 'startDate' ? 'startDate' : 'completionTime' });
                });
            });
            on(root.querySelector('[data-tm-detail-focus-summary-trigger]'), 'click', (ev) => {
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                openInlinePopover(ev.currentTarget, {
                    mode: 'focus-summary',
                    title: '时长与番茄',
                    value: readHiddenInputValue('duration'),
                    tomatoEstimateValue: readHiddenInputValue('tomatoEstimateCount'),
                    actualTomatoValue: __tmGetTaskTomatoCount(getBoundTask()),
                    spentValue: __tmGetTaskSpentDisplay(getBoundTask()),
                    onCommit: async (nextValue) => {
                        const nextPatch = (nextValue && typeof nextValue === 'object') ? nextValue : {};
                        const prevDuration = readHiddenInputValue('duration');
                        const prevTomatoEstimateCount = readHiddenInputValue('tomatoEstimateCount');
                        setHiddenInputValue('duration', String(nextPatch.duration || '').trim());
                        setHiddenInputValue('tomatoEstimateCount', __tmNormalizeTomatoCountValue(nextPatch.tomatoEstimateCount || ''));
                        syncMetaChipFaces();
                        commitDetailFieldPatch(nextPatch, {
                            source: 'detail-focus-summary',
                            reason: 'detail-focus-summary',
                            label: '时长与番茄',
                            onFailure: () => {
                                setHiddenInputValue('duration', prevDuration);
                                setHiddenInputValue('tomatoEstimateCount', prevTomatoEstimateCount);
                                syncMetaChipFaces();
                            },
                        });
                        return true;
                    }
                });
            });
            on(root.querySelector('[data-tm-detail-reminder-toggle]'), 'click', async (ev) => {
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                try {
                    await tmReminder(getBoundTaskId() || taskId);
                } finally {
                    scheduleReminderButtonStateRefresh();
                }
            });
            on(root.querySelector('[data-tm-detail-pinned-toggle]'), 'click', async (ev) => {
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                const prevValue = readPinnedValue() ? '1' : '';
                const nextValue = prevValue ? '' : '1';
                setHiddenInputValue('pinned', nextValue);
                syncMetaChipFaces();
                commitDetailFieldPatch({ pinned: nextValue }, {
                    source: 'detail-pinned',
                    reason: 'detail-pinned',
                    label: '置顶状态',
                    onFailure: () => {
                        setHiddenInputValue('pinned', prevValue);
                        syncMetaChipFaces();
                        try { hint('❌ 置顶状态更新失败', 'error'); } catch (e) {}
                    },
                });
            });
            on(root, 'click', async (ev) => {
                const target = ev.target instanceof Element
                    ? ev.target.closest('[data-tm-detail-toggle-completed-subtasks]')
                    : null;
                if (!(target instanceof HTMLElement) || !root.contains(target)) return;
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                const tid = getBoundTaskId() || taskId;
                const showCompletedSubtasks = typeof __tmShouldShowCompletedSubtasksForTask === 'function'
                    ? __tmShouldShowCompletedSubtasksForTask(tid)
                    : true;
                await window.tmToggleTaskDetailCompletedSubtasks?.(tid, !showCompletedSubtasks);
            });
            on(root, 'click', async (ev) => {
                const target = ev.target instanceof Element
                    ? ev.target.closest('[data-tm-detail-open-child]')
                    : null;
                if (!(target instanceof HTMLElement) || !root.contains(target)) return;
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                const attrId = String(target.getAttribute('data-tm-detail-open-child') || '').trim();
                const nextId = __tmResolveTaskDetailEffectiveId(attrId) || attrId;
                if (!nextId) return;
                await refreshBoundDetail(nextId);
            });
            on(root, 'contextmenu', (ev) => {
                const row = ev.target instanceof Element
                    ? ev.target.closest('[data-tm-detail-subtask-menu]')
                    : null;
                if (!(row instanceof HTMLElement) || !root.contains(row)) return;
                const attrId = String(row.getAttribute('data-tm-detail-subtask-menu') || '').trim();
                const subtaskId = __tmResolveTaskDetailEffectiveId(attrId) || attrId;
                if (!subtaskId) return;
                try { tmShowTaskContextMenu(ev, subtaskId); } catch (e) {}
            });
            root.querySelectorAll('[data-tm-detail-repeat-history-delete]').forEach((btn) => {
                if (!(btn instanceof HTMLButtonElement)) return;
                on(btn, 'click', async (ev) => {
                    try { ev.preventDefault(); } catch (e) {}
                    try { ev.stopPropagation(); } catch (e) {}
                    const completedAt = String(btn.getAttribute('data-tm-detail-repeat-history-delete') || '').trim();
                    if (!completedAt) return;
                    const ok = await showConfirm('删除循环记录', '删除后该条循环完成记录会从插件内移除。是否继续？');
                    if (!ok) return;
                    try {
                        await __tmDeleteTaskRepeatHistoryEntry(getBoundTaskId() || taskId, completedAt, { source: 'detail-repeat-history-delete' });
                        const refreshedTask = await __tmResolveTaskForRepeat(getBoundTaskId() || taskId);
                        if (refreshedTask) {
                            try { root.__tmTaskDetailTask = refreshedTask; } catch (e) {}
                        }
                        refreshBoundDetail(getBoundTaskId() || taskId);
                        try { hint('✅ 已删除循环记录', 'success'); } catch (e) {}
                    } catch (e) {
                        try { hint(`❌ 删除失败: ${String(e?.message || e || '')}`, 'error'); } catch (e2) {}
                    }
                });
            });
            on(root.querySelector('[data-tm-detail="create-subtask"]'), 'click', (ev) => {
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                openInlineSubtaskDraft();
            });
            let attachmentActionPending = false;
            let attachmentDragDepth = 0;
            const setAttachmentDropActive = (active) => {
                const section = getAttachmentSection();
                if (section instanceof HTMLElement) section.classList.toggle('tm-task-detail-attachment-dropzone--dragover', !!active);
            };
            const clearAttachmentDropActive = () => {
                attachmentDragDepth = 0;
                setAttachmentDropActive(false);
            };
            on(root, 'dragenter', (ev) => {
                const section = getAttachmentSection();
                const dropZone = ev.target instanceof Element ? ev.target.closest('[data-tm-detail-attachment-section]') : null;
                if (!(section instanceof HTMLElement) || dropZone !== section) return;
                if (!__tmTaskAttachmentDataTransferHasFiles(ev?.dataTransfer)) return;
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                attachmentDragDepth += 1;
                setAttachmentDropActive(true);
            });
            on(root, 'dragover', (ev) => {
                const section = getAttachmentSection();
                const dropZone = ev.target instanceof Element ? ev.target.closest('[data-tm-detail-attachment-section]') : null;
                if (!(section instanceof HTMLElement) || dropZone !== section) return;
                if (!__tmTaskAttachmentDataTransferHasFiles(ev?.dataTransfer)) return;
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                try { if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy'; } catch (e) {}
                setAttachmentDropActive(true);
            });
            on(root, 'dragleave', (ev) => {
                const section = getAttachmentSection();
                const dropZone = ev.target instanceof Element ? ev.target.closest('[data-tm-detail-attachment-section]') : null;
                if (!(section instanceof HTMLElement) || dropZone !== section) return;
                if (!__tmTaskAttachmentDataTransferHasFiles(ev?.dataTransfer)) return;
                attachmentDragDepth = Math.max(0, attachmentDragDepth - 1);
                if (!attachmentDragDepth) setAttachmentDropActive(false);
            });
            on(root, 'dragend', () => {
                clearAttachmentDropActive();
            });
            let attachmentPasteContextAt = 0;
            const markAttachmentPasteContext = () => {
                attachmentPasteContextAt = Date.now();
            };
            const isAttachmentPasteContextActive = (ev) => {
                if (ev?.__tmTaskDetailAttachmentPasteHandled === true) return false;
                if (!isSessionActive()) return false;
                const target = ev?.target instanceof Element ? ev.target : null;
                if (target && root.contains(target)) return true;
                const active = document.activeElement instanceof Element ? document.activeElement : null;
                if (active && root.contains(active)) return true;
                try {
                    if (root.matches?.(':hover')) return true;
                } catch (e) {}
                return Date.now() - attachmentPasteContextAt < 8000;
            };
            const handleDetailAttachmentPaste = async (ev) => {
                if (!isAttachmentPasteContextActive(ev)) return;
                const clipboardData = ev?.clipboardData || null;
                if (!clipboardData) return;
                const clipboardFiles = __tmBuildTaskAttachmentClipboardFiles(clipboardData);
                const text = clipboardFiles.length ? '' : String(clipboardData.getData?.('text/plain') || '').trim();
                const textLooksImportable = !clipboardFiles.length && (
                    __tmParseTaskAttachmentAssetPathsFromText(text).length > 0
                    || __tmParseTaskAttachmentLocalPathsFromText(text).length > 0
                    || __tmParseTaskAttachmentBlockIdsFromText(text).length > 0
                );
                if (!clipboardFiles.length && !textLooksImportable) return;
                try { ev.__tmTaskDetailAttachmentPasteHandled = true; } catch (e) {}
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                if (attachmentActionPending) return;
                const task = getBoundTask();
                if (!task?.id) return;
                try {
                    attachmentActionPending = true;
                    const resolvedPaths = clipboardFiles.length
                        ? await __tmUploadTaskAttachmentFiles(clipboardFiles, { assetsDirPath: '/assets/' })
                        : await __tmResolveTaskAttachmentTextItems(text);
                    if (!resolvedPaths.length) return;
                    const latestPaths = __tmGetTaskAttachmentPaths(getBoundTask() || task);
                    const nextPaths = __tmNormalizeTaskAttachmentPaths(latestPaths.concat(resolvedPaths));
                    if (JSON.stringify(nextPaths) === JSON.stringify(latestPaths)) {
                        try { hint('⚠ 剪贴板里的内容已经在当前任务附件中', 'warning'); } catch (e) {}
                        return;
                    }
                    await __tmUpdateTaskAttachmentsField(task.id, nextPaths, { source: 'detail-attachment-paste' });
                    syncAttachmentSection(getBoundTask());
                    try { hint(`✅ 已添加 ${nextPaths.length - latestPaths.length} 个附件`, 'success'); } catch (e) {}
                } catch (e) {
                    try { hint(`❌ 粘贴添加附件失败: ${String(e?.message || e || '')}`, 'error'); } catch (e2) {}
                } finally {
                    attachmentActionPending = false;
                }
            };
            on(document, 'pointerdown', (ev) => {
                const target = ev?.target instanceof Element ? ev.target : null;
                if (target && root.contains(target)) markAttachmentPasteContext();
                else attachmentPasteContextAt = 0;
            }, { capture: true });
            on(root, 'focusin', markAttachmentPasteContext);
            on(root, 'mouseenter', markAttachmentPasteContext);
            on(root, 'paste', handleDetailAttachmentPaste);
            on(document, 'paste', handleDetailAttachmentPaste, { capture: true });
            on(root, 'drop', async (ev) => {
                const section = getAttachmentSection();
                const dropZone = ev.target instanceof Element ? ev.target.closest('[data-tm-detail-attachment-section]') : null;
                if (!(section instanceof HTMLElement) || dropZone !== section) return;
                if (!__tmTaskAttachmentDataTransferHasFiles(ev?.dataTransfer)) return;
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                clearAttachmentDropActive();
                if (attachmentActionPending) return;
                const task = getBoundTask();
                if (!task?.id) return;
                try {
                    attachmentActionPending = true;
                    const uploadedPaths = await __tmUploadTaskAttachmentFiles(ev?.dataTransfer, { assetsDirPath: '/assets/' });
                    if (!uploadedPaths.length) return;
                    const latestPaths = __tmGetTaskAttachmentPaths(getBoundTask() || task);
                    const nextPaths = __tmNormalizeTaskAttachmentPaths(latestPaths.concat(uploadedPaths));
                    if (JSON.stringify(nextPaths) === JSON.stringify(latestPaths)) return;
                    await __tmUpdateTaskAttachmentsField(task.id, nextPaths, { source: 'detail-attachment-drop' });
                    syncAttachmentSection(getBoundTask());
                    try { hint(`✅ 已添加 ${nextPaths.length - latestPaths.length} 个附件`, 'success'); } catch (e) {}
                } catch (e) {
                    try { hint(`❌ 拖拽添加附件失败: ${String(e?.message || e || '')}`, 'error'); } catch (e2) {}
                } finally {
                    attachmentActionPending = false;
                }
            });
            on(root, 'contextmenu', (ev) => {
                const target = ev.target instanceof Element
                    ? ev.target.closest('[data-tm-detail-attachment-context]')
                    : null;
                if (!(target instanceof HTMLElement) || !root.contains(target)) return;
                const path = String(target.getAttribute('data-tm-detail-attachment-context') || '').trim();
                if (!path) return;
                try { __tmShowTaskAttachmentContextMenu(ev, path); } catch (e) {}
            });
            on(root, 'click', async (ev) => {
                const target = ev.target instanceof Element
                    ? ev.target.closest('[data-tm-detail-attachment-add], [data-tm-detail-attachment-open], [data-tm-detail-attachment-toggle], [data-tm-detail-attachment-remove], [data-tm-detail-attachment-move]')
                    : null;
                if (!(target instanceof HTMLElement) || !root.contains(target)) return;
                const task = getBoundTask();
                if (!task?.id) return;
                if (target.hasAttribute('data-tm-detail-attachment-open')) {
                    __tmOpenAssetPath(String(target.getAttribute('data-tm-detail-attachment-open') || '').trim(), ev, {
                        galleryPaths: __tmGetTaskAttachmentPaths(task),
                    });
                    return;
                }
                if (target.hasAttribute('data-tm-detail-attachment-toggle')) {
                    const section = getAttachmentSection();
                    const expanded = section?.dataset?.tmExpanded === 'true';
                    setAttachmentSectionExpanded(!expanded);
                    return;
                }
                if (attachmentActionPending) return;
                const currentPaths = __tmGetTaskAttachmentPaths(task);
                if (target.hasAttribute('data-tm-detail-attachment-add')) {
                    try {
                        attachmentActionPending = true;
                        const pickedPaths = await __tmOpenTaskAttachmentPicker({ existingPaths: currentPaths });
                        if (!Array.isArray(pickedPaths) || !pickedPaths.length) return;
                        const nextPaths = __tmNormalizeTaskAttachmentPaths(currentPaths.concat(pickedPaths));
                        if (JSON.stringify(nextPaths) === JSON.stringify(currentPaths)) return;
                        await __tmUpdateTaskAttachmentsField(task.id, nextPaths, { source: 'detail-attachment-add' });
                        syncAttachmentSection(getBoundTask());
                        try { hint(`✅ 已添加 ${nextPaths.length - currentPaths.length} 个附件`, 'success'); } catch (e) {}
                    } catch (e) {
                        try { hint(`❌ 添加附件失败: ${String(e?.message || e || '')}`, 'error'); } catch (e2) {}
                    } finally {
                        attachmentActionPending = false;
                    }
                    return;
                }
                const index = Math.max(0, Number(target.getAttribute('data-index') || 0));
                if (index >= currentPaths.length) return;
                if (target.hasAttribute('data-tm-detail-attachment-remove')) {
                    try {
                        attachmentActionPending = true;
                        const nextPaths = currentPaths.slice();
                        nextPaths.splice(index, 1);
                        await __tmUpdateTaskAttachmentsField(task.id, nextPaths, { source: 'detail-attachment-remove' });
                        syncAttachmentSection(getBoundTask());
                        try { hint('✅ 已移除附件', 'success'); } catch (e) {}
                    } catch (e) {
                        try { hint(`❌ 移除附件失败: ${String(e?.message || e || '')}`, 'error'); } catch (e2) {}
                    } finally {
                        attachmentActionPending = false;
                    }
                    return;
                }
                if (target.hasAttribute('data-tm-detail-attachment-move')) {
                    try {
                        attachmentActionPending = true;
                        const offset = Number(target.getAttribute('data-tm-detail-attachment-move') || 0);
                        const nextIndex = index + offset;
                        if (!Number.isInteger(offset) || nextIndex < 0 || nextIndex >= currentPaths.length) return;
                        const nextPaths = currentPaths.slice();
                        const [moved] = nextPaths.splice(index, 1);
                        nextPaths.splice(nextIndex, 0, moved);
                        await __tmUpdateTaskAttachmentsField(task.id, nextPaths, { source: 'detail-attachment-move' });
                        syncAttachmentSection(getBoundTask());
                    } catch (e) {
                        try { hint(`❌ 排序附件失败: ${String(e?.message || e || '')}`, 'error'); } catch (e2) {}
                    } finally {
                        attachmentActionPending = false;
                    }
                }
            });
        };
        syncMetaChipFaces();
        void refreshReminderButtonState();
        void refreshTimeHubScheduleSummary();
        const titleTextarea = root.querySelector('[data-tm-detail="content"]');
        if (titleTextarea instanceof HTMLTextAreaElement) {
            syncAutoHeight(titleTextarea, 36);
            on(titleTextarea, 'input', () => syncAutoHeight(titleTextarea, 36));
            on(titleTextarea, 'blur', () => {
                if (titleTextarea.readOnly) return;
                flushAutoSaveNow({
                    showHint: false,
                    closeAfterSave: false,
                    preserveFocus: true,
                    skipRerender: true,
                }).catch(() => null);
            });
            const blurTitleWhenPointerLeavesEditor = (ev) => {
                if (document.activeElement !== titleTextarea) return;
                const target = ev?.target instanceof Element ? ev.target : null;
                if (target && (target === titleTextarea || titleTextarea.contains(target))) return;
                try { titleTextarea.blur(); } catch (e) {}
            };
            on(document, 'pointerdown', blurTitleWhenPointerLeavesEditor, { capture: true });
            on(document, 'touchstart', blurTitleWhenPointerLeavesEditor, { capture: true, passive: true });
            try {
                requestAnimationFrame(() => syncAutoHeight(titleTextarea, 36));
            } catch (e) {}
        }
        const remarkShell = root.querySelector('[data-tm-detail-remark-shell]');
        const remarkPreview = root.querySelector('[data-tm-detail-remark-preview]');
        const remarkActivator = root.querySelector('[data-tm-detail-remark-activator]');
        const remarkTextarea = root.querySelector('[data-tm-detail="remark"]');
        const remarkToolbar = root.querySelector('[data-tm-detail-remark-toolbar]');
        const remarkToolbarToggle = root.querySelector('[data-tm-detail-remark-toolbar-toggle]');
        if (remarkShell instanceof HTMLElement && remarkPreview instanceof HTMLElement && remarkTextarea instanceof HTMLTextAreaElement) {
            const remarkFocusScope = remarkShell.closest('.tm-task-detail-section') || remarkShell.parentElement || remarkShell;
            const resolveRemarkTargetElement = (target) => {
                if (target instanceof Element) return target;
                if (target && typeof target === 'object' && target.parentElement instanceof Element) return target.parentElement;
                return null;
            };
            let remarkEnterGuardUntil = 0;
            let remarkExitInFlight = false;
            const armRemarkInteractionGuard = (duration = null) => {
                const fallback = __tmIsMobileDevice() ? 900 : 360;
                const ttl = Math.max(0, Number(duration) || fallback);
                remarkEnterGuardUntil = Date.now() + ttl;
            };
            const isRemarkEditorScopedTarget = (target) => {
                if (!(target instanceof Element)) return false;
                if (remarkShell.contains(target)) return true;
                if (remarkToolbar instanceof HTMLElement && remarkToolbar.contains(target)) return true;
                if (remarkToolbarToggle instanceof HTMLElement && remarkToolbarToggle.contains(target)) return true;
                if (remarkActivator instanceof HTMLElement && remarkActivator.contains(target)) return true;
                return false;
            };
            const bindRemarkInteractionGuard = (target) => {
                if (!target?.addEventListener) return;
                on(target, 'pointerdown', () => {
                    armRemarkInteractionGuard();
                });
                on(target, 'touchstart', () => {
                    armRemarkInteractionGuard();
                }, { passive: true });
            };
            let remarkPendingInputScrollSnapshot = null;
            const captureDetailScrollSnapshot = () => {
                try {
                    const checklistSnapshot = __tmCaptureChecklistDetailScrollSnapshot(state.modal);
                    if (checklistSnapshot) return { kind: 'checklist', snapshot: checklistSnapshot };
                } catch (e) {}
                try {
                    const kanbanSnapshot = __tmCaptureKanbanDetailScrollSnapshot(state.modal);
                    if (kanbanSnapshot) return { kind: 'kanban', snapshot: kanbanSnapshot };
                } catch (e) {}
                try {
                    const standaloneSnapshot = __tmCaptureStandaloneTaskDetailScrollSnapshot();
                    if (standaloneSnapshot) return { kind: 'standalone', snapshot: standaloneSnapshot };
                } catch (e) {}
                return null;
            };
            const restoreDetailScrollSnapshot = (pack) => {
                if (!pack || !pack.snapshot) return;
                try {
                    if (pack.kind === 'checklist') {
                        __tmRestoreChecklistDetailScrollSnapshot(pack.snapshot, state.modal);
                        return;
                    }
                    if (pack.kind === 'kanban') {
                        __tmRestoreKanbanDetailScrollSnapshot(pack.snapshot, state.modal);
                        return;
                    }
                    if (pack.kind === 'standalone') {
                        __tmRestoreStandaloneTaskDetailScrollSnapshot(pack.snapshot);
                    }
                } catch (e) {}
            };
            const preserveDetailScroll = (fn, snapshotOverride = null) => {
                const snapshot = snapshotOverride || captureDetailScrollSnapshot();
                const result = typeof fn === 'function' ? fn() : undefined;
                restoreDetailScrollSnapshot(snapshot);
                try { requestAnimationFrame(() => restoreDetailScrollSnapshot(snapshot)); } catch (e) {}
                try { setTimeout(() => restoreDetailScrollSnapshot(snapshot), 30); } catch (e) {}
                try { setTimeout(() => restoreDetailScrollSnapshot(snapshot), 90); } catch (e) {}
                return result;
            };
            const getDetailScrollContainer = () => {
                if (embedded) {
                    const modal = state.modal instanceof Element ? state.modal : null;
                    const panel = __tmResolveChecklistDetailPanel(modal).panel;
                    if (panel instanceof HTMLElement) return panel;
                }
                const standalone = root.closest?.('.tm-task-detail');
                if (standalone instanceof HTMLElement) return standalone;
                return root instanceof HTMLElement ? root : null;
            };
            const ensureRemarkVisibleOnMobile = () => {
                if (!__tmIsMobileDevice()) return;
                if (!remarkShell.classList.contains('is-editing')) return;
                const scroller = getDetailScrollContainer();
                if (!(scroller instanceof HTMLElement)) return;
                try {
                    const scrollerRect = scroller.getBoundingClientRect();
                    const shellRect = remarkShell.getBoundingClientRect();
                    const topPadding = 12;
                    const bottomPadding = 160;
                    const isAbove = shellRect.top < (scrollerRect.top + topPadding);
                    const isBelow = shellRect.bottom > (scrollerRect.bottom - bottomPadding);
                    if (!isAbove && !isBelow) return;
                    const targetTop = Math.max(0, Number(scroller.scrollTop || 0) + (shellRect.top - scrollerRect.top) - topPadding);
                    try { scroller.scrollTo({ top: targetTop, behavior: 'auto' }); } catch (e) { scroller.scrollTop = targetTop; }
                } catch (e) {}
            };
            const scheduleEnsureRemarkVisibleOnMobile = () => {
                if (!__tmIsMobileDevice()) return;
                try { ensureRemarkVisibleOnMobile(); } catch (e) {}
                try { requestAnimationFrame(() => ensureRemarkVisibleOnMobile()); } catch (e) {}
                try { setTimeout(() => ensureRemarkVisibleOnMobile(), 60); } catch (e) {}
                try { setTimeout(() => ensureRemarkVisibleOnMobile(), 180); } catch (e) {}
                try { setTimeout(() => ensureRemarkVisibleOnMobile(), 320); } catch (e) {}
            };
            const syncRemarkHeight = () => syncAutoHeight(remarkTextarea, 80);
            try { syncRemarkSavedState(__tmGetTaskDetailRemarkRaw(root.__tmTaskDetailTask)); } catch (e) {}
            const syncRemarkPreview = (force = false) => {
                if (!force && remarkShell.classList.contains('is-editing') && __tmIsMobileDevice()) return;
                remarkPreview.innerHTML = __tmRenderRemarkMarkdown(remarkTextarea.value || '');
            };
            const setRemarkToolbarOpen = (open) => {
                if (!(remarkToolbar instanceof HTMLElement)) return;
                remarkToolbar.classList.toggle('is-open', !!open);
                remarkToolbar.hidden = !open;
                try { remarkShell.dataset.toolbarOpen = open ? 'true' : 'false'; } catch (e) {}
            };
            const focusRemarkTextarea = (selectAll = false) => {
                armRemarkInteractionGuard(260);
                preserveDetailScroll(() => {
                    try { syncRemarkHeight(); } catch (e) {}
                    try { remarkTextarea.focus({ preventScroll: true }); } catch (e) { try { remarkTextarea.focus(); } catch (e2) {} }
                    try {
                        const caret = selectAll ? 0 : String(remarkTextarea.value || '').length;
                        const end = selectAll ? String(remarkTextarea.value || '').length : caret;
                        remarkTextarea.setSelectionRange(caret, end);
                    } catch (e) {}
                });
                scheduleEnsureRemarkVisibleOnMobile();
            };
            const enterRemarkEditMode = (options = {}) => {
                armRemarkInteractionGuard(320);
                remarkPendingInputScrollSnapshot = null;
                preserveDetailScroll(() => {
                    remarkShell.classList.add('is-editing');
                    try { remarkShell.dataset.mode = 'edit'; } catch (e) {}
                    syncRemarkHeight();
                    if (options.openToolbar) setRemarkToolbarOpen(true);
                });
                focusRemarkTextarea(!!options.selectAll);
                try {
                    requestAnimationFrame(() => {
                        focusRemarkTextarea(!!options.selectAll);
                    });
                } catch (e) {}
                try {
                    setTimeout(() => focusRemarkTextarea(!!options.selectAll), 30);
                } catch (e) {}
            };
            const exitRemarkEditMode = (save = true) => {
                if (remarkExitInFlight) return;
                if (!remarkShell.classList.contains('is-editing')) return;
                remarkExitInFlight = true;
                const run = async () => {
                    syncRemarkHeight();
                    syncRemarkPreview(true);
                    if (save) {
                        await flushAutoSaveNow({
                            showHint: false,
                            closeAfterSave: false,
                            preserveFocus: false,
                            skipRerender: true,
                        }).catch(() => null);
                    }
                    setRemarkToolbarOpen(false);
                    remarkShell.classList.remove('is-editing');
                    try { remarkShell.dataset.mode = 'preview'; } catch (e) {}
                };
                run().catch(() => null).finally(() => {
                    remarkExitInFlight = false;
                });
            };

            syncRemarkPreview();
            syncRemarkHeight();
            setRemarkToolbarOpen(false);
            try { __tmBindRemarkTextareaUndoHistory(remarkTextarea); } catch (e) {}
            try { remarkShell.dataset.mode = 'preview'; } catch (e) {}
            bindRemarkInteractionGuard(remarkShell);
            bindRemarkInteractionGuard(remarkToolbar);
            bindRemarkInteractionGuard(remarkToolbarToggle);
            bindRemarkInteractionGuard(remarkActivator);

            if (remarkActivator instanceof HTMLButtonElement) {
                on(remarkActivator, 'mousedown', (ev) => {
                    try { ev.preventDefault(); } catch (e) {}
                    try { ev.stopPropagation(); } catch (e) {}
                    enterRemarkEditMode();
                });
                on(remarkActivator, 'click', (ev) => {
                    try { ev.preventDefault(); } catch (e) {}
                    try { ev.stopPropagation(); } catch (e) {}
                    enterRemarkEditMode();
                });
            }
            on(remarkShell, 'mousedown', (ev) => {
                if (remarkShell.classList.contains('is-editing')) return;
                const target = resolveRemarkTargetElement(ev.target);
                if (!(target instanceof Element)) return;
                if (target.closest('[data-tm-detail-remark-toolbar-toggle], [data-tm-detail-remark-toolbar], [data-tm-detail-remark-activator], a')) return;
                if (!target.closest('[data-tm-detail-remark-preview], [data-tm-detail-remark-shell]')) return;
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                enterRemarkEditMode();
            });
            on(remarkPreview, 'mousedown', (ev) => {
                const target = resolveRemarkTargetElement(ev.target);
                if (target instanceof Element && target.closest('a')) return;
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                enterRemarkEditMode();
            });
            on(remarkPreview, 'click', (ev) => {
                const target = resolveRemarkTargetElement(ev.target);
                if (target instanceof Element && target.closest('a')) return;
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                enterRemarkEditMode();
            });
            on(remarkPreview, 'keydown', (ev) => {
                if (ev.key !== 'Enter' && ev.key !== ' ') return;
                try { ev.preventDefault(); } catch (e) {}
                enterRemarkEditMode();
            });
            on(remarkTextarea, 'beforeinput', () => {
                remarkPendingInputScrollSnapshot = captureDetailScrollSnapshot();
            });
            on(remarkTextarea, 'input', () => {
                try { remarkTextarea.dataset.dirty = 'true'; } catch (e) {}
                const inputScrollSnapshot = remarkPendingInputScrollSnapshot;
                remarkPendingInputScrollSnapshot = null;
                preserveDetailScroll(() => {
                    syncRemarkHeight();
                    syncRemarkPreview(false);
                }, inputScrollSnapshot);
                scheduleEnsureRemarkVisibleOnMobile();
                scheduleAutoSave();
            });
            on(remarkTextarea, 'compositionstart', () => {
                remarkPendingInputScrollSnapshot = captureDetailScrollSnapshot();
                try { remarkTextarea.dataset.composing = 'true'; } catch (e) {}
                try { remarkTextarea.dataset.dirty = 'true'; } catch (e) {}
            });
            on(remarkTextarea, 'compositionend', () => {
                try { delete remarkTextarea.dataset.composing; } catch (e) {}
                try { remarkTextarea.dataset.dirty = 'true'; } catch (e) {}
                scheduleAutoSave();
            });
            on(remarkTextarea, 'focus', () => {
                preserveDetailScroll(() => syncRemarkHeight());
            });
            on(remarkTextarea, 'focus', () => {
                scheduleEnsureRemarkVisibleOnMobile();
            });
            on(remarkTextarea, 'keydown', (ev) => {
                let handled = false;
                preserveDetailScroll(() => {
                    handled = __tmHandleRemarkTextareaKeydown(remarkTextarea, ev);
                    if (!handled) return;
                    syncRemarkHeight();
                    syncRemarkPreview(false);
                });
                if (handled) {
                    scheduleEnsureRemarkVisibleOnMobile();
                    scheduleAutoSave();
                    return;
                }
                if (ev.key === 'Escape') {
                    try { ev.preventDefault(); } catch (e) {}
                    if (remarkToolbar instanceof HTMLElement && remarkToolbar.classList.contains('is-open')) {
                        setRemarkToolbarOpen(false);
                    } else {
                        exitRemarkEditMode(true);
                    }
                }
            });
            on(remarkTextarea, 'blur', () => {
                remarkPendingInputScrollSnapshot = null;
                syncRemarkHeight();
                syncRemarkPreview(true);
                syncRemarkSavedState(__tmGetTaskDetailRemarkRaw(root.__tmTaskDetailTask));
            });
            if (remarkToolbarToggle instanceof HTMLButtonElement) {
                on(remarkToolbarToggle, 'mousedown', (ev) => {
                    try { ev.preventDefault(); } catch (e) {}
                });
                on(remarkToolbarToggle, 'click', (ev) => {
                    armRemarkInteractionGuard();
                    try { ev.preventDefault(); } catch (e) {}
                    try { ev.stopPropagation(); } catch (e) {}
                    if (!remarkShell.classList.contains('is-editing')) {
                        enterRemarkEditMode({ openToolbar: true });
                        return;
                    }
                    setRemarkToolbarOpen(!(remarkToolbar instanceof HTMLElement && remarkToolbar.classList.contains('is-open')));
                    focusRemarkTextarea(false);
                });
            }
            if (remarkToolbar instanceof HTMLElement) {
                try {
                    __tmBindHorizontalWheelScroll(remarkToolbar, {
                        boundKey: '__tmDetailRemarkToolbarWheelBound',
                        handlerKey: '__tmDetailRemarkToolbarWheelHandler',
                    });
                } catch (e) {}
                __tmBindRemarkMarkdownToolbar(remarkToolbar, remarkTextarea, {
                    on,
                    toolAttribute: 'data-tm-detail-remark-tool',
                    apply: (fn) => preserveDetailScroll(fn),
                    onBeforeApply: () => {
                        armRemarkInteractionGuard();
                    },
                    onAfterApply: () => {
                        preserveDetailScroll(() => {
                            syncRemarkHeight();
                            syncRemarkPreview(false);
                        });
                        scheduleAutoSave();
                        focusRemarkTextarea(false);
                    },
                });
            }
            on(remarkFocusScope, 'focusout', () => {
                try {
                    requestAnimationFrame(() => {
                        if (!remarkShell.classList.contains('is-editing')) return;
                        const active = document.activeElement;
                        if (Date.now() < remarkEnterGuardUntil) {
                            if (__tmIsMobileDevice() && isRemarkEditorScopedTarget(active) && active !== remarkTextarea) {
                                focusRemarkTextarea(false);
                            }
                            return;
                        }
                        if (isRemarkEditorScopedTarget(active)) return;
                        exitRemarkEditMode(true);
                    });
                } catch (e) {}
            });
            const exitRemarkWhenPointerLeavesEditor = (ev) => {
                if (!remarkShell.classList.contains('is-editing')) return;
                const target = resolveRemarkTargetElement(ev?.target);
                if (target instanceof Element && isRemarkEditorScopedTarget(target)) return;
                try {
                    if (document.activeElement === remarkTextarea) remarkTextarea.blur();
                } catch (e) {}
                exitRemarkEditMode(true);
            };
            on(document, 'pointerdown', exitRemarkWhenPointerLeavesEditor, { capture: true });
            on(document, 'touchstart', exitRemarkWhenPointerLeavesEditor, { capture: true, passive: true });
            if (window.visualViewport?.addEventListener) {
                on(window.visualViewport, 'resize', () => {
                    scheduleEnsureRemarkVisibleOnMobile();
                }, { passive: true });
                on(window.visualViewport, 'scroll', () => {
                    scheduleEnsureRemarkVisibleOnMobile();
                }, { passive: true });
            }
            try {
                requestAnimationFrame(() => {
                    syncRemarkHeight();
                    syncRemarkPreview();
                });
            } catch (e) {}
            try {
                const pendingRemarkDraftSnapshot = root.__tmPendingRemarkDraftSnapshot;
                if (pendingRemarkDraftSnapshot && typeof pendingRemarkDraftSnapshot === 'object') {
                    delete root.__tmPendingRemarkDraftSnapshot;
                    __tmRestoreTaskDetailRemarkDraftSnapshot(root, pendingRemarkDraftSnapshot);
                }
            } catch (e) {}
        }
        root.querySelectorAll('textarea[data-tm-detail-custom-text-field]').forEach((textarea) => {
            if (!(textarea instanceof HTMLTextAreaElement)) return;
            const syncTextHeight = () => syncAutoHeight(textarea, 34);
            syncTextHeight();
            on(textarea, 'input', () => {
                syncTextHeight();
                scheduleAutoSave();
            });
            on(textarea, 'focus', syncTextHeight);
            on(textarea, 'blur', () => {
                syncTextHeight();
                const fieldId = String(textarea.getAttribute('data-tm-detail-custom-text-field') || '').trim();
                const field = fieldId ? __tmGetCustomFieldDefMap().get(fieldId) : null;
                const currentTask = getBoundTask();
                if (!field || !currentTask) return;
                const prevValue = String(__tmNormalizeCustomFieldValue(field, __tmGetTaskCustomFieldValue(currentTask, fieldId)) || '').trim();
                const nextValue = String(__tmNormalizeCustomFieldValue(field, textarea.value) || '').trim();
                if (nextValue === prevValue) return;
                commitDetailFieldPatch({ customFieldValues: { [fieldId]: nextValue } }, {
                    source: 'detail-custom-text',
                    reason: 'detail-custom-text',
                    label: '自定义字段',
                    onFailure: () => {
                        textarea.value = prevValue;
                        syncTextHeight();
                    },
                });
            });
            try {
                requestAnimationFrame(syncTextHeight);
            } catch (e) {}
        });
        bindStatusSelect();
        bindPrioritySelect();
        bindCoreMetaControls();
        bindCustomFieldEditors();
        bindSubtaskEditors();
        syncSubtaskVisibilityToggle();
        try { syncWhiteboardOutline(); } catch (e) {}
        try { __tmBindFloatingTooltips(root); } catch (e) {}
        on(window, 'tm:calendar-schedule-updated', () => {
            void refreshTimeHubScheduleSummary();
        });
        on(window, 'tm-task-attr-updated', async (ev) => {
            const rawTaskId = String(ev?.detail?.taskId || '').trim();
            if (!rawTaskId) return;
            const boundTask = getBoundTask();
            const currentId = String(boundTask?.id || taskId || '').trim();
            if (!currentId) return;
            if (__tmMutationEngine.isTaskSuppressed(currentId)) {
                try {
                    __tmPushDetailDebug('detail-window-attr-updated:skip-suppressed', {
                        taskId: currentId,
                        rawTaskId,
                        attrKey: String(ev?.detail?.attrKey || '').trim(),
                        source: String(ev?.detail?.source || '').trim(),
                    });
                } catch (e) {}
                return;
            }
            let resolvedId = rawTaskId;
            if (resolvedId !== currentId) {
                try {
                    const nextId = await __tmResolveTaskIdFromAnyBlockId(rawTaskId);
                    if (nextId) resolvedId = nextId;
                } catch (e) {}
            }
            if (!__tmAreTaskDetailIdsEquivalent(resolvedId, currentId)) return;
            try {
                __tmPushDetailDebug('detail-window-attr-updated', {
                    taskId: currentId,
                    rawTaskId,
                    resolvedId,
                    attrKey: String(ev?.detail?.attrKey || '').trim(),
                    source: String(ev?.detail?.source || '').trim(),
                    value: String(ev?.detail?.value ?? ''),
                });
            } catch (e) {}
            applyQuickbarAttrUpdateToDetail(ev?.detail?.attrKey, ev?.detail?.value);
        });
        root.querySelectorAll('[data-tm-detail]').forEach((el) => {
            if (!(el instanceof HTMLElement)) return;
            const field = String(el.getAttribute('data-tm-detail') || '').trim();
            if (field === 'save') return;
            if (el.matches('textarea,input[type="text"],input[type="date"],select')) {
                if (field !== 'content' && field !== 'remark') {
                    on(el, 'input', scheduleAutoSave);
                }
                if (field !== 'remark') on(el, 'change', scheduleAutoSave);
                if (field !== 'content' && field !== 'remark') on(el, 'blur', scheduleAutoSave);
            } else if (el.matches('input[type="checkbox"]')) {
                on(el, 'change', scheduleAutoSave);
            }
        });
    }

    function __tmBuildTaskDetailLocationSignature(task) {
        const taskLike = (task && typeof task === 'object') ? task : null;
        if (!taskLike) return '';
        return JSON.stringify({
            docId: String(taskLike?.root_id || taskLike?.docId || '').trim(),
            docName: String(taskLike?.docName || taskLike?.doc_name || '').trim(),
            headingName: __tmNormalizeHeadingText(taskLike?.h2 || taskLike?.h2Name),
            headingLevel: String(taskLike?.headingLevel || '').trim(),
            otherBlockTypeLabel: String(taskLike?.otherBlockTypeLabel || '').trim(),
            isOtherBlock: !!(taskLike?.isOtherBlock || taskLike?.otherBlockId || taskLike?.sourceType === 'other-block'),
        });
    }

    function __tmRememberTaskDetailLocationSignature(rootEl, task) {
        const root = rootEl instanceof Element ? rootEl : null;
        if (!root) return '';
        const signature = __tmBuildTaskDetailLocationSignature(task);
        try {
            if (signature) root.__tmTaskDetailLocationSignature = signature;
            else delete root.__tmTaskDetailLocationSignature;
        } catch (e) {}
        return signature;
    }

    function __tmBuildChecklistSelectionSignature(task, options = {}) {
        const taskLike = (task && typeof task === 'object') ? task : null;
        const opts = (options && typeof options === 'object') ? options : {};
        const customValues = (taskLike?.customFieldValues && typeof taskLike.customFieldValues === 'object' && !Array.isArray(taskLike.customFieldValues))
            ? taskLike.customFieldValues
            : {};
        let customSig = '';
        try { customSig = JSON.stringify(customValues); } catch (e) { customSig = String(Object.keys(customValues).length || 0); }
        return JSON.stringify({
            selectedId: String(taskLike?.id || '').trim(),
            locationSignature: __tmBuildTaskDetailLocationSignature(taskLike),
            done: !!taskLike?.done,
            customStatus: String(taskLike?.customStatus || taskLike?.custom_status || '').trim(),
            priority: String(taskLike?.priority || '').trim(),
            startDate: String(taskLike?.startDate || taskLike?.start_date || '').trim(),
            completionTime: String(taskLike?.completionTime || taskLike?.completion_time || '').trim(),
            taskCompleteAt: __tmResolveTaskCompletedAtRaw(taskLike),
            duration: String(taskLike?.duration || '').trim(),
            pinned: !!(taskLike?.pinned === true || taskLike?.pinned === '1' || taskLike?.pinned === 1 || String(taskLike?.custom_pinned || '').trim() === '1'),
            remark: __tmGetTaskDetailRemarkRaw(taskLike),
            customSig,
            sheetOpen: !!opts.sheetOpen,
            dismissed: !!opts.dismissed,
        });
    }

    function __tmCountTaskDetailRawSubtasks(task) {
        const seen = new Set();
        let count = 0;
        const walk = (items) => {
            (Array.isArray(items) ? items : []).forEach((child) => {
                if (!child || typeof child !== 'object') return;
                const id = String(child.id || '').trim();
                if (id && seen.has(id)) return;
                if (id) seen.add(id);
                count += 1;
                walk(child.children);
            });
        };
        walk(task?.children);
        return count;
    }

    function __tmCountTaskDetailRenderedSubtasks(task) {
        const children = Array.isArray(task?.children) ? task.children.slice() : [];
        if (!children.length) return 0;
        try {
            const showCompletedSubtasks = typeof __tmShouldShowCompletedSubtasksForTask === 'function'
                ? __tmShouldShowCompletedSubtasksForTask(task?.id)
                : true;
            const visibleChildren = typeof __tmBuildTaskDetailSubtaskTree === 'function'
                ? __tmBuildTaskDetailSubtaskTree(children, showCompletedSubtasks)
                : children;
            return __tmCountTaskDetailRawSubtasks({ children: visibleChildren });
        } catch (e) {
            return __tmCountTaskDetailRawSubtasks(task);
        }
    }

    function __tmGetTaskDetailSubtaskDomCount(panelEl) {
        const list = panelEl instanceof Element ? panelEl.querySelector('[data-tm-detail-subtasks]') : null;
        if (!(list instanceof Element)) return 0;
        return list.querySelectorAll('.tm-task-detail-subtask:not(.tm-task-detail-subtask--draft)').length;
    }

    function __tmRefreshChecklistSelectionInPlace(modalEl, source = '', options = {}) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return false;
        if (!__tmIsChecklistSelectionContext(modal)) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const forceRebuild = opts.forceRebuild === true;
        const selectedId = String(state.detailTaskId || '').trim();
const multiSelectedSet = __tmGetMultiSelectedTaskIdSet();
        const panelState = __tmResolveChecklistDetailPanel(modal, { preferSheetMode: __tmChecklistUseSheetMode(modal) });
        const sheetMode = !!panelState.sheetMode;
        const items = modal.querySelectorAll('.tm-checklist-item[data-id]');
        items.forEach((item) => {
            if (!(item instanceof HTMLElement)) return;
            const id = String(item.getAttribute('data-id') || '').trim();
            item.classList.toggle('tm-checklist-item--active', !!selectedId && __tmAreTaskDetailIdsEquivalent(id, selectedId));
            item.classList.toggle('tm-task-row--multi-selected', !!id && multiSelectedSet.has(id));
        });
        const panel = panelState.panel;
        if (!(panel instanceof HTMLElement)) {
            return false;
        }
        const prevTaskId = String(panel.dataset?.tmDetailTaskId || panel.__tmTaskDetailTaskId || panel.__tmTaskDetailTask?.id || '').trim();
        const detailScrollSnapshot = prevTaskId && __tmAreTaskDetailIdsEquivalent(prevTaskId, selectedId)
            ? {
                top: Number(panel.scrollTop || 0),
                left: Number(panel.scrollLeft || 0),
                selectedId,
            }
            : null;
        const task = selectedId
            ? (__tmGetTaskDetailTaskById(selectedId, { includePending: true, preferPending: true, includeWhiteboard: true }) || null)
            : null;
        const nextSignature = __tmBuildChecklistSelectionSignature(task, {
            sheetOpen: state.checklistDetailSheetOpen,
            dismissed: state.checklistDetailDismissed,
        });
        if (task && selectedId && __tmKeepTaskDetailNoteViewDuringRefresh(panel, task, selectedId)) {
            const backdrop = modal.querySelector('#tmChecklistSheetBackdrop');
            const sheet = modal.querySelector('#tmChecklistSheet');
            if (backdrop instanceof HTMLElement) backdrop.classList.toggle('tm-checklist-sheet-backdrop--open', !!(sheetMode && state.checklistDetailSheetOpen && task));
            if (sheet instanceof HTMLElement) __tmSyncDetailSheetVisualState(sheet, !!(sheetMode && state.checklistDetailSheetOpen && task));
            try { modal.__tmChecklistSelectionSignature = nextSignature; } catch (e) {}
            return true;
        }
        const prevSignature = String(modal.__tmChecklistSelectionSignature || '').trim();
        const subtaskCountChanged = !!task
            && !!selectedId
            && __tmAreTaskDetailIdsEquivalent(prevTaskId, selectedId)
            && panel.childElementCount > 0
            && __tmGetTaskDetailSubtaskDomCount(panel) !== __tmCountTaskDetailRenderedSubtasks(task);
        const prevLocationSignature = String(panel.__tmTaskDetailLocationSignature || '').trim();
        const nextLocationSignature = __tmBuildTaskDetailLocationSignature(task);
        const locationChanged = !!task
            && !!selectedId
            && __tmAreTaskDetailIdsEquivalent(prevTaskId, selectedId)
            && panel.childElementCount > 0
            && nextLocationSignature
            && (!prevLocationSignature || prevLocationSignature !== nextLocationSignature);
        const canSkipPanelWork = !!task
            && !!selectedId
            && !forceRebuild
            && __tmAreTaskDetailIdsEquivalent(prevTaskId, selectedId)
            && panel.childElementCount > 0
            && prevSignature
            && prevSignature === nextSignature
            && !subtaskCountChanged
            && !locationChanged;
        const keepExistingDetail = !!task
            && !!selectedId
            && !forceRebuild
            && __tmAreTaskDetailIdsEquivalent(prevTaskId, selectedId)
            && panel.childElementCount > 0
            && !subtaskCountChanged
            && !locationChanged;
        if (canSkipPanelWork) {
            const backdrop = modal.querySelector('#tmChecklistSheetBackdrop');
            const sheet = modal.querySelector('#tmChecklistSheet');
            if (backdrop instanceof HTMLElement) backdrop.classList.toggle('tm-checklist-sheet-backdrop--open', !!(sheetMode && state.checklistDetailSheetOpen && task));
            if (sheet instanceof HTMLElement) __tmSyncDetailSheetVisualState(sheet, !!(sheetMode && state.checklistDetailSheetOpen && task));
            try { panel.__tmTaskDetailTask = task || null; } catch (e) {}
            try { __tmRememberTaskDetailLocationSignature(panel, task); } catch (e) {}
return true;
        }
        if (keepExistingDetail) {
            try {
                __tmPatchTaskDetailPanelInPlace(panel, selectedId, {
                    done: true,
                    customStatus: true,
                    priority: true,
                    startDate: true,
                    completionTime: true,
                    taskCompleteAt: true,
                    repeatHistory: true,
                    duration: true,
                    tomatoEstimateCount: true,
                    tomatoCount: true,
                    pinned: true,
                    remark: true,
                    attachments: true,
                    customFieldValues: true,
                    location: true,
                });
            } catch (e) {}
        } else {
            const detailDraftSnapshot = __tmCaptureTaskDetailSubtaskDraftSnapshot(panel, selectedId);
            const remarkDraftSnapshot = __tmCaptureTaskDetailRemarkDraftSnapshot(panel, selectedId);
            try {
                __tmPushDetailDebug('detail-rebuild-html', {
                    taskId: String(selectedId || '').trim(),
                    embedded: true,
                    source: `checklist-selection-rebuild:${String(source || '').trim() || 'unknown'}`,
                    rootTag: __tmDescribeDebugElement(panel),
                    pendingSave: panel.__tmTaskDetailPendingSave === true,
                    hasActivePopover: !!panel.__tmTaskDetailActiveInlinePopover,
                    refreshHoldMsLeft: Math.max(0, Number(panel.__tmTaskDetailRefreshHoldUntil || 0) - Date.now()),
                });
            } catch (e) {}
            const renderNoteView = !!(task && __tmShouldRenderTaskDetailNoteView('sheet', task));
            if (!renderNoteView) {
                try { __tmDestroyTaskDetailNoteViewForRoot(panel, `checklist-selection-rebuild:${String(source || '').trim() || 'unknown'}`); } catch (e) {}
            }
            panel.innerHTML = task
                ? (renderNoteView
                    ? __tmBuildTaskDetailNoteViewInnerHtml(task, { embedded: true, closeable: true })
                    : __tmBuildTaskDetailInnerHtml(task, { embedded: true, closeable: true }))
                : `<div class="tm-checklist-empty-detail">选择左侧任务后，这里会显示可编辑的详情。</div>`;
            try { panel.__tmTaskDetailTask = task || null; } catch (e) {}
            try { __tmRememberTaskDetailLocationSignature(panel, task); } catch (e) {}
            try {
                if (task) panel.dataset.tmDetailTaskId = selectedId;
                else delete panel.dataset.tmDetailTaskId;
            } catch (e) {}
            if (task) __tmBindTaskDetailEditor(panel, selectedId, {
                embedded: true,
                source: `checklist-selection-rebuild:${String(source || '').trim() || 'unknown'}`,
                onClose: () => {
                    state.detailTaskId = '';
                    state.checklistDetailDismissed = true;
                    state.checklistDetailSheetOpen = false;
                    state.checklistDetailSheetFullscreen = false;
                    if (!__tmRefreshChecklistSelectionInPlace(state.modal, 'detail-close')) render();
                }
            });
            try { __tmRestoreTaskDetailSubtaskDraftSnapshot(panel, detailDraftSnapshot); } catch (e) {}
            try { __tmRestoreTaskDetailRemarkDraftSnapshot(panel, remarkDraftSnapshot); } catch (e) {}
        }
        const backdrop = modal.querySelector('#tmChecklistSheetBackdrop');
        const sheet = modal.querySelector('#tmChecklistSheet');
        if (backdrop instanceof HTMLElement) backdrop.classList.toggle('tm-checklist-sheet-backdrop--open', !!(sheetMode && state.checklistDetailSheetOpen && task));
        if (sheet instanceof HTMLElement) __tmSyncDetailSheetVisualState(sheet, !!(sheetMode && state.checklistDetailSheetOpen && task));
        if (detailScrollSnapshot) {
            try { __tmRestoreChecklistDetailScrollSnapshot(detailScrollSnapshot, modal); } catch (e) {}
        }
        try { __tmRememberTaskDetailLocationSignature(panel, task); } catch (e) {}
        try { modal.__tmChecklistSelectionSignature = nextSignature; } catch (e) {}
return true;
    }

    function __tmResolveTaskDetailSheetPanel(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return null;
        const panel = modal.querySelector('#tmTaskDetailSheetPanel');
        return panel instanceof HTMLElement ? panel : null;
    }

    function __tmEnsureTaskDetailSheetMounted(modalEl, task, taskId, source = '') {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        const tid = String(taskId || task?.id || '').trim();
        const item = (task && typeof task === 'object') ? task : null;
        if (!(modal instanceof Element) || !tid || !item) return false;
        const existingPanel = __tmResolveTaskDetailSheetPanel(modal);
        if (existingPanel instanceof HTMLElement) return true;
        const stage = modal.querySelector('.tm-main-stage');
        if (!(stage instanceof HTMLElement)) return false;

        try { modal.querySelector('#tmTaskDetailSheetBackdrop')?.remove?.(); } catch (e) {}
        try { modal.querySelector('#tmTaskDetailSheet')?.remove?.(); } catch (e) {}

        const backdrop = document.createElement('div');
        backdrop.id = 'tmTaskDetailSheetBackdrop';
        backdrop.className = 'tm-checklist-sheet-backdrop';
        backdrop.setAttribute('onpointerdown', 'tmTaskDetailSheetClose(event)');
        backdrop.setAttribute('onclick', 'tmTaskDetailSheetClose(event)');

        const sheet = document.createElement('div');
        sheet.id = 'tmTaskDetailSheet';
        sheet.className = 'tm-checklist-sheet';
        sheet.setAttribute('onpointerdown', 'tmTaskDetailSheetDragStart(event)');

        const handle = document.createElement('div');
        handle.className = 'tm-checklist-sheet-handle';

        const panel = document.createElement('div');
        panel.id = 'tmTaskDetailSheetPanel';
        panel.className = 'tm-checklist-sheet-body';

        const renderNoteView = !!__tmShouldRenderTaskDetailNoteView('sheet', item);
        panel.innerHTML = renderNoteView
            ? __tmBuildTaskDetailNoteViewInnerHtml(item, { embedded: true, closeable: true })
            : __tmBuildTaskDetailInnerHtml(item, { embedded: true, closeable: true });
        try { panel.__tmTaskDetailTask = item; } catch (e) {}
        try { __tmRememberTaskDetailLocationSignature(panel, item); } catch (e) {}
        try { panel.__tmTaskDetailTaskId = tid; } catch (e) {}
        try { panel.dataset.tmDetailTaskId = tid; } catch (e) {}

        sheet.appendChild(handle);
        sheet.appendChild(panel);
        stage.appendChild(backdrop);
        stage.appendChild(sheet);
        try { globalThis.__tmBindChecklistSheetTouchFallback?.(modal); } catch (e) {}

        __tmBindTaskDetailEditor(panel, tid, {
            embedded: true,
            source: `task-detail-sheet-mount:${String(source || '').trim() || 'unknown'}`,
            task: item,
            onClose: () => {
                window.tmTaskDetailSheetClose?.();
            }
        });
        try { __tmBindFloatingTooltips(panel); } catch (e) {}
        __tmSyncTaskDetailSheetOpenState(modal, item);
        return true;
    }

    function __tmSyncTaskDetailSheetOpenState(modalEl, task = null) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return false;
        const open = !!(state.checklistDetailSheetOpen && task);
        const backdrop = modal.querySelector('#tmTaskDetailSheetBackdrop');
        const sheet = modal.querySelector('#tmTaskDetailSheet');
        if (backdrop instanceof HTMLElement) backdrop.classList.toggle('tm-checklist-sheet-backdrop--open', open);
        if (sheet instanceof HTMLElement) __tmSyncDetailSheetVisualState(sheet, open);
        return open;
    }

    function __tmClearKanbanDetailForTaskSheet(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        try { __tmClearTaskDetailNoteViewState('kanban', '', 'clear-kanban-for-task-sheet'); } catch (e) {}
        state.kanbanDetailTaskId = '';
        state.kanbanDetailAnchorTaskId = '';
        try { __tmClearKanbanDetailFloatingHandlers(); } catch (e) {}
        try {
            modal?.querySelectorAll?.('#tmKanbanDetailFloat')?.forEach?.((floatPanel) => {
                if (floatPanel instanceof HTMLElement) floatPanel.remove();
            });
        } catch (e) {}
    }

    function __tmRefreshTaskDetailSheetInPlace(modalEl, source = '', options = {}) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const forceRebuild = opts.forceRebuild === true;
        const panel = __tmResolveTaskDetailSheetPanel(modal);
        if (!(panel instanceof HTMLElement)) {
            return false;
        }
        const selectedId = String(state.detailTaskId || '').trim();
        const prevTaskId = String(panel.dataset?.tmDetailTaskId || panel.__tmTaskDetailTaskId || panel.__tmTaskDetailTask?.id || '').trim();
        const task = selectedId
            ? (__tmGetTaskDetailTaskById(selectedId, { includePending: true, preferPending: true, includeWhiteboard: true }) || null)
            : null;
        if (task && selectedId && __tmKeepTaskDetailNoteViewDuringRefresh(panel, task, selectedId)) {
            __tmSyncTaskDetailSheetOpenState(modal, task);
            return true;
        }
        const detailScrollSnapshot = prevTaskId && __tmAreTaskDetailIdsEquivalent(prevTaskId, selectedId)
            ? {
                top: Number(panel.scrollTop || 0),
                left: Number(panel.scrollLeft || 0),
                selectedId,
            }
            : null;
        const subtaskCountChanged = !!task
            && !!selectedId
            && __tmAreTaskDetailIdsEquivalent(prevTaskId, selectedId)
            && panel.childElementCount > 0
            && __tmGetTaskDetailSubtaskDomCount(panel) !== __tmCountTaskDetailRenderedSubtasks(task);
        const prevLocationSignature = String(panel.__tmTaskDetailLocationSignature || '').trim();
        const nextLocationSignature = __tmBuildTaskDetailLocationSignature(task);
        const locationChanged = !!task
            && !!selectedId
            && __tmAreTaskDetailIdsEquivalent(prevTaskId, selectedId)
            && panel.childElementCount > 0
            && nextLocationSignature
            && (!prevLocationSignature || prevLocationSignature !== nextLocationSignature);
        const keepExistingDetail = !!task
            && !!selectedId
            && !forceRebuild
            && __tmAreTaskDetailIdsEquivalent(prevTaskId, selectedId)
            && panel.childElementCount > 0
            && !subtaskCountChanged
            && !locationChanged;
        if (keepExistingDetail) {
            try {
                __tmPatchTaskDetailPanelInPlace(panel, selectedId, {
                    done: true,
                    customStatus: true,
                    priority: true,
                    startDate: true,
                    completionTime: true,
                    taskCompleteAt: true,
                    repeatHistory: true,
                    duration: true,
                    tomatoEstimateCount: true,
                    tomatoCount: true,
                    pinned: true,
                    remark: true,
                    attachments: true,
                    customFieldValues: true,
                    location: true,
                });
            } catch (e) {}
        } else {
            const detailDraftSnapshot = __tmCaptureTaskDetailSubtaskDraftSnapshot(panel, selectedId);
            const remarkDraftSnapshot = __tmCaptureTaskDetailRemarkDraftSnapshot(panel, selectedId);
            try {
                __tmPushDetailDebug('detail-rebuild-html', {
                    taskId: String(selectedId || '').trim(),
                    embedded: true,
                    source: `task-detail-sheet-rebuild:${String(source || '').trim() || 'unknown'}`,
                    rootTag: __tmDescribeDebugElement(panel),
                    pendingSave: panel.__tmTaskDetailPendingSave === true,
                    hasActivePopover: !!panel.__tmTaskDetailActiveInlinePopover,
                    refreshHoldMsLeft: Math.max(0, Number(panel.__tmTaskDetailRefreshHoldUntil || 0) - Date.now()),
                });
            } catch (e) {}
            const renderNoteView = !!(task && __tmShouldRenderTaskDetailNoteView('sheet', task));
            if (!renderNoteView) {
                try { __tmDestroyTaskDetailNoteViewForRoot(panel, `task-detail-sheet-rebuild:${String(source || '').trim() || 'unknown'}`); } catch (e) {}
            }
            panel.innerHTML = task
                ? (renderNoteView
                    ? __tmBuildTaskDetailNoteViewInnerHtml(task, { embedded: true, closeable: true })
                    : __tmBuildTaskDetailInnerHtml(task, { embedded: true, closeable: true }))
                : `<div class="tm-checklist-empty-detail">选择任务后，这里会显示可编辑的详情。</div>`;
            try { panel.__tmTaskDetailTask = task || null; } catch (e) {}
            try { __tmRememberTaskDetailLocationSignature(panel, task); } catch (e) {}
            try {
                if (task) panel.dataset.tmDetailTaskId = selectedId;
                else delete panel.dataset.tmDetailTaskId;
            } catch (e) {}
            if (task) __tmBindTaskDetailEditor(panel, selectedId, {
                embedded: true,
                source: `task-detail-sheet-rebuild:${String(source || '').trim() || 'unknown'}`,
                task,
                onClose: () => {
                    window.tmTaskDetailSheetClose?.();
                }
            });
            try { __tmRestoreTaskDetailSubtaskDraftSnapshot(panel, detailDraftSnapshot); } catch (e) {}
            try { __tmRestoreTaskDetailRemarkDraftSnapshot(panel, remarkDraftSnapshot); } catch (e) {}
        }
        try { panel.__tmTaskDetailTask = task || null; } catch (e) {}
        try { __tmRememberTaskDetailLocationSignature(panel, task); } catch (e) {}
        if (task && selectedId) {
            try { panel.dataset.tmDetailTaskId = selectedId; } catch (e) {}
        }
        __tmSyncTaskDetailSheetOpenState(modal, task);
        if (detailScrollSnapshot) {
            const restore = () => {
                try {
                    if (!__tmAreTaskDetailIdsEquivalent(state.detailTaskId, detailScrollSnapshot.selectedId)) return;
                    const livePanel = __tmResolveTaskDetailSheetPanel(modal);
                    if (!(livePanel instanceof HTMLElement)) return;
                    livePanel.scrollTop = Number(detailScrollSnapshot.top || 0);
                    livePanel.scrollLeft = Number(detailScrollSnapshot.left || 0);
                } catch (e) {}
            };
            try { restore(); } catch (e) {}
            try { requestAnimationFrame(restore); } catch (e) {}
            try { setTimeout(restore, 30); } catch (e) {}
        }
        return true;
    }

    async function __tmOpenTaskDetailSheetInPlace(taskId, options = {}) {
        const rawTid = String(taskId || '').trim();
        const tid = __tmResolveTaskDetailEffectiveId(rawTid) || rawTid;
        if (!tid) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const modal = state.modal instanceof Element ? state.modal : null;
        try {
            const currentNote = __tmGetTaskDetailNoteViewState('sheet');
            if (currentNote && !__tmAreTaskDetailIdsEquivalent(currentNote.taskId, tid)) {
                __tmClearTaskDetailNoteViewState('sheet', '', 'task-detail-sheet-open-other-task');
            }
        } catch (e) {}
        state.detailTaskId = tid;
        state.checklistDetailDismissed = false;
        state.checklistDetailSheetOpen = true;
        try { __tmRemoveElementsById('tm-task-detail-overlay'); } catch (e) {}
        try { __tmClearKanbanDetailForTaskSheet(modal); } catch (e) {}
        const source = String(opts.source || '').trim() || 'task-detail-sheet-open';
        let openingTask = __tmGetTaskDetailTaskById(tid, { includePending: true, preferPending: true, includeWhiteboard: true }) || null;
        if (openingTask) {
            try {
                openingTask = await __tmEnsureTaskDetailFieldAttrs(openingTask, {
                    taskId: tid,
                    source,
                    force: true,
                }) || openingTask;
            } catch (e) {}
        }
        let refreshed = __tmRefreshTaskDetailSheetInPlace(modal, source);
        if (!refreshed) {
            const task = openingTask || __tmGetTaskDetailTaskById(tid, { includePending: true, preferPending: true, includeWhiteboard: true }) || null;
            if (task && __tmEnsureTaskDetailSheetMounted(modal, task, tid, source)) {
                refreshed = __tmRefreshTaskDetailSheetInPlace(modal, `${source}:mounted`);
            }
        }
        if (!refreshed) {
            render();
        }
        return true;
    }


    function __tmPatchVisibleTaskDetailSubtaskPriorityInPlace(taskId) {
        const rawId = String(taskId || '').trim();
        if (!rawId) return false;
        const aliases = new Set();
        const addAlias = (value) => {
            const tid = String(value || '').trim();
            if (tid) aliases.add(tid);
        };
        addAlias(rawId);
        try { addAlias(__tmResolveTaskDetailEffectiveId(rawId)); } catch (e) {}
        try {
            const runtimeAliases = globalThis.__tmRuntimeState?.getTaskIdAliases?.(rawId);
            (Array.isArray(runtimeAliases) ? runtimeAliases : []).forEach(addAlias);
        } catch (e) {}
        try {
            const storeAliases = globalThis.__tmTaskStore?.getAliases?.(rawId);
            (Array.isArray(storeAliases) ? storeAliases : []).forEach(addAlias);
        } catch (e) {}
        const task = Array.from(aliases).map((id) => {
            try { return __tmGetTaskDetailTaskById(id, { includePending: true, preferPending: true, includeWhiteboard: true }); } catch (e) { return null; }
        }).find((item) => item && typeof item === 'object') || null;
        if (!task) return false;
        const color = __tmGetPriorityAccentColor(__tmResolveTaskPriorityValue(task)) || '#a9afb8';
        const matchesSubtaskId = (value) => {
            const tid = String(value || '').trim();
            if (!tid) return false;
            if (aliases.has(tid)) return true;
            try {
                const resolvedId = String(__tmResolveTaskDetailEffectiveId(tid) || tid).trim();
                return !!resolvedId && aliases.has(resolvedId);
            } catch (e) {
                return false;
            }
        };
        const panels = [];
        const addPanel = (panel) => {
            if (panel instanceof HTMLElement && !panels.includes(panel)) panels.push(panel);
        };
        try {
            const modal = state.modal instanceof Element ? state.modal : null;
            addPanel(modal ? __tmResolveChecklistDetailPanel(modal).panel : null);
            addPanel(modal ? __tmResolveTaskDetailSheetPanel(modal) : null);
            addPanel(modal?.querySelector?.('#tmKanbanDetailPanel'));
        } catch (e) {}
        try { addPanel(document.getElementById('tm-task-detail-overlay')); } catch (e) {}
        let touched = false;
        panels.forEach((panel) => {
            if (!__tmIsTaskDetailRootUsable(panel, { requireConnected: true })) return;
            panel.querySelectorAll('[data-tm-detail-subtask-menu]').forEach((row) => {
                if (!(row instanceof HTMLElement)) return;
                const subtaskId = String(row.getAttribute('data-tm-detail-subtask-menu') || '').trim();
                if (!matchesSubtaskId(subtaskId)) return;
                const checkbox = row.querySelector('.tm-task-checkbox');
                if (checkbox instanceof HTMLInputElement) {
                    checkbox.style.setProperty('--tm-checklist-checkbox-color', color);
                    checkbox.style.borderColor = color;
                    touched = true;
                }
            });
        });
        return touched;
    }

    function __tmPatchTaskDetailPanelInPlace(panelEl, taskId, patch = {}) {
        const panel = panelEl instanceof Element ? panelEl : null;
        const tid = String(taskId || '').trim();
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        const task = tid ? (__tmGetTaskDetailTaskById(tid, { includeWhiteboard: true }) || null) : null;
        if (!(panel instanceof Element) || !tid || !task) return false;
        if (!__tmIsTaskDetailRootUsable(panel, { taskId: tid })) return false;
        const currentId = String(panel.dataset?.tmDetailTaskId || panel.__tmTaskDetailTaskId || panel.__tmTaskDetailTask?.id || '').trim();
        if (currentId && !__tmAreTaskDetailIdsEquivalent(currentId, tid)) return false;
        if (Object.prototype.hasOwnProperty.call(nextPatch, 'location')) {
            const previousLocationSignature = String(panel.__tmTaskDetailLocationSignature || '').trim();
            const nextLocationSignature = __tmBuildTaskDetailLocationSignature(task);
            if (nextLocationSignature && (!previousLocationSignature || previousLocationSignature !== nextLocationSignature)) return false;
        }
        let touched = false;

        try { panel.__tmTaskDetailTask = task; } catch (e) {}
        try { panel.dataset.tmDetailTaskId = tid; } catch (e) {}

        if (Object.prototype.hasOwnProperty.call(nextPatch, 'repeatHistory')) {
            return false;
        }

        if (Object.prototype.hasOwnProperty.call(nextPatch, 'customStatus') || Object.prototype.hasOwnProperty.call(nextPatch, 'done')) {
            const statusOpt = __tmResolveTaskStatusDisplayOption(task, __tmGetStatusOptions(SettingsStore.data.customStatusOptions || []), {
                fallbackColor: task?.done ? '#9e9e9e' : '#757575',
                fallbackName: task?.done ? '完成' : '待办',
            });
            const statusInput = panel.querySelector('input[type="hidden"][data-tm-detail="status"]');
            if (statusInput instanceof HTMLInputElement) statusInput.value = String(statusOpt.id || '').trim();
            const trigger = panel.querySelector('[data-tm-detail-status-trigger]');
            if (trigger instanceof HTMLElement) {
                trigger.setAttribute('style', __tmBuildStatusChipStyle(statusOpt.color));
                const labelEl = trigger.querySelector('.tm-task-detail-status-trigger__value');
                if (labelEl instanceof HTMLElement) labelEl.textContent = String(statusOpt.name || statusOpt.id || '').trim();
                touched = true;
            }
        }

        if (Object.prototype.hasOwnProperty.call(nextPatch, 'priority')) {
            const priorityInput = panel.querySelector('input[type="hidden"][data-tm-detail="priority"]');
            if (priorityInput instanceof HTMLInputElement) priorityInput.value = String(task?.priority || '').trim();
            const trigger = panel.querySelector('[data-tm-detail-priority-trigger]');
            if (trigger instanceof HTMLElement) {
                trigger.setAttribute('style', __tmBuildPriorityChipStyle(String(task?.priority || '').trim() || 'none'));
                const valueEl = trigger.querySelector('.tm-task-detail-priority-trigger__value');
                if (valueEl instanceof HTMLElement) valueEl.innerHTML = __tmRenderPriorityJira(String(task?.priority || '').trim() || 'none', false);
                touched = true;
            }
        }

        const syncChipField = (field, value, kind = field) => {
            const input = panel.querySelector(`input[type="hidden"][data-tm-detail="${field}"]`);
            if (input instanceof HTMLInputElement) input.value = String(value || '').trim();
            const btn = (field === 'tomatoEstimateCount' || field === 'duration')
                ? panel.querySelector('[data-tm-detail-focus-summary-trigger]')
                : panel.querySelector(`[data-tm-detail-date-trigger="${field}"]`);
            if (btn instanceof HTMLElement) {
                btn.classList.toggle('has-value', !!String(value || '').trim());
            }
            const face = panel.querySelector(`[data-tm-detail-chip-face="${field}"]`);
            if (face instanceof HTMLElement) {
                face.innerHTML = __tmBuildTaskDetailCoreChipFace(kind, value);
                touched = true;
            }
        };
        const syncFocusSummaryChip = () => {
            const durationInput = panel.querySelector('input[type="hidden"][data-tm-detail="duration"]');
            const estimateInput = panel.querySelector('input[type="hidden"][data-tm-detail="tomatoEstimateCount"]');
            if (durationInput instanceof HTMLInputElement) durationInput.value = String(task?.duration || '').trim();
            const estimateValue = __tmGetTaskTomatoEstimateCount(task);
            if (estimateInput instanceof HTMLInputElement) estimateInput.value = estimateValue;
            const summaryText = __tmGetTaskTomatoSummaryText(task);
            const face = panel.querySelector('[data-tm-detail-chip-face="tomatoSummary"]');
            if (face instanceof HTMLElement) face.innerHTML = __tmBuildTaskDetailCoreChipFace('tomatoSummary', task);
            const trigger = panel.querySelector('[data-tm-detail-focus-summary-trigger]');
            if (trigger instanceof HTMLElement) trigger.classList.toggle('has-value', !!summaryText);
            touched = true;
        };
        const syncTaskCompleteAtChip = () => {
            const existing = panel.querySelector('[data-tm-detail-complete-at-chip]');
            const rawValue = __tmResolveTaskCompletedAtRaw(task);
            const text = __tmFormatTaskCompletedAtTime(rawValue);
            if (!text) {
                if (existing instanceof HTMLElement) {
                    existing.remove();
                    touched = true;
                }
                return;
            }
            if (existing instanceof HTMLElement) {
                const face = existing.querySelector('[data-tm-detail-chip-face="taskCompleteAt"]');
                if (face instanceof HTMLElement) face.innerHTML = __tmBuildTaskDetailCoreChipFace('taskCompleteAt', rawValue);
                existing.setAttribute('title', `完成时间：${text}`);
                existing.setAttribute('data-tm-floating-tooltip-label', `完成时间：${text}`);
                touched = true;
                return;
            }
            const coreMeta = panel.querySelector('.tm-task-detail-core-meta');
            if (!(coreMeta instanceof HTMLElement)) return;
            const template = document.createElement('template');
            template.innerHTML = __tmBuildTaskCompleteAtDetailChipHtml(task).trim();
            const chip = template.content.firstElementChild;
            if (!(chip instanceof HTMLElement)) return;
            const durationInput = coreMeta.querySelector('input[type="hidden"][data-tm-detail="duration"]');
            if (durationInput instanceof Element) coreMeta.insertBefore(chip, durationInput);
            else coreMeta.appendChild(chip);
            touched = true;
        };
        const syncTimeHubChip = () => {
            const trigger = panel.querySelector('[data-tm-detail-time-hub-trigger]');
            const face = panel.querySelector('[data-tm-detail-chip-face="timeHub"]');
            if (!(trigger instanceof HTMLElement) && !(face instanceof HTMLElement)) return;
            const startDate = __tmNormalizeDateOnly(String(task?.startDate || task?.start_date || '').trim());
            const completionTime = __tmNormalizeDateOnly(String(task?.completionTime || task?.completion_time || '').trim());
            const reminderSnapshot = SettingsStore.data.enableTomatoIntegration ? __tmPeekTaskReminderSnapshotByAnyId(task) : null;
            const hasReminder = SettingsStore.data.enableTomatoIntegration && (reminderSnapshot?.hasReminder === true || __tmHasReminderMark(task));
            const repeatSummary = __tmGetTaskRepeatSummary(__tmGetTaskRepeatRule(task), { startDate, completionTime });
            const options = {
                startDate,
                completionTime,
                hasReminder,
                reminderText: hasReminder ? String(reminderSnapshot?.displayText || '').trim() : '',
                scheduleText: String(panel.__tmTaskDetailTimeHubScheduleText || '').trim(),
                repeatSummary,
            };
            const hasValue = __tmTaskDetailTimeHubHasValue(task, options);
            const label = __tmGetTaskDetailTimeHubLabel(task, options);
            if (face instanceof HTMLElement) face.innerHTML = __tmBuildTaskDetailTimeHubFace(task, options);
            if (trigger instanceof HTMLElement) {
                trigger.classList.toggle('has-value', hasValue);
                try { __tmApplyTooltipAttrsToElement(trigger, label, { side: 'bottom' }); } catch (e) {}
                try { trigger.setAttribute('aria-label', label); } catch (e) {}
                try { trigger.removeAttribute('title'); } catch (e) {}
            }
            touched = true;
        };
        if (Object.prototype.hasOwnProperty.call(nextPatch, 'startDate')) syncChipField('startDate', String(task?.startDate || task?.start_date || '').trim(), 'startDate');
        if (Object.prototype.hasOwnProperty.call(nextPatch, 'completionTime')) syncChipField('completionTime', String(task?.completionTime || task?.completion_time || '').trim(), 'completionTime');
        if (Object.prototype.hasOwnProperty.call(nextPatch, 'done') || Object.prototype.hasOwnProperty.call(nextPatch, 'taskCompleteAt')) syncTaskCompleteAtChip();
        if (Object.prototype.hasOwnProperty.call(nextPatch, 'duration')
            || Object.prototype.hasOwnProperty.call(nextPatch, 'tomatoEstimateCount')
            || Object.prototype.hasOwnProperty.call(nextPatch, 'tomatoCount')
            || Object.prototype.hasOwnProperty.call(nextPatch, 'tomatoMinutes')
            || Object.prototype.hasOwnProperty.call(nextPatch, 'tomatoHours')) syncFocusSummaryChip();
        if (Object.prototype.hasOwnProperty.call(nextPatch, 'startDate') || Object.prototype.hasOwnProperty.call(nextPatch, 'completionTime')) syncTimeHubChip();

        if (Object.prototype.hasOwnProperty.call(nextPatch, 'pinned')) {
            const pinnedValue = !!(task?.pinned === true || task?.pinned === '1' || task?.pinned === 1 || String(task?.custom_pinned || '').trim() === '1');
            const pinnedInput = panel.querySelector('input[type="hidden"][data-tm-detail="pinned"]');
            if (pinnedInput instanceof HTMLInputElement) pinnedInput.value = pinnedValue ? '1' : '';
            const pinnedBtn = panel.querySelector('[data-tm-detail-pinned-toggle]');
            if (pinnedBtn instanceof HTMLElement) {
                pinnedBtn.classList.toggle('is-active', pinnedValue);
                const face = pinnedBtn.querySelector('[data-tm-detail-chip-face="pinned"]');
                if (face instanceof HTMLElement) face.innerHTML = __tmBuildTaskDetailCoreChipFace('pinned', pinnedValue ? '1' : '');
                touched = true;
            }
        }

        if (Object.prototype.hasOwnProperty.call(nextPatch, 'remark')) {
            const remarkValue = __tmNormalizeRemarkMarkdown(__tmGetTaskDetailRemarkRaw(task));
            const textarea = panel.querySelector('textarea[data-tm-detail="remark"]');
            const isDraftActive = typeof __tmIsTaskDetailRemarkDraftActive === 'function'
                ? __tmIsTaskDetailRemarkDraftActive(panel)
                : textarea instanceof HTMLTextAreaElement && textarea === document.activeElement;
            if (textarea instanceof HTMLTextAreaElement) {
                try { __tmSyncTaskDetailRemarkTextareaSavedState(textarea, remarkValue); } catch (e) {}
                if (!isDraftActive) textarea.value = remarkValue;
            }
            const preview = panel.querySelector('[data-tm-detail-remark-preview]');
            const remarkShell = panel.querySelector('[data-tm-detail-remark-shell]');
            const isEditingRemark = remarkShell instanceof HTMLElement && remarkShell.classList.contains('is-editing');
            if (preview instanceof HTMLElement && !isDraftActive && !isEditingRemark) {
                preview.innerHTML = __tmRenderRemarkMarkdown(remarkValue);
                touched = true;
            }
        }

        if (Object.prototype.hasOwnProperty.call(nextPatch, 'attachments')) {
            const section = panel.querySelector('[data-tm-detail-attachment-section]');
            if (section instanceof HTMLElement) {
                const expanded = section.dataset.tmExpanded === 'true';
                section.outerHTML = __tmBuildTaskDetailAttachmentSectionHtml(task, (label, tipOpts = {}) => __tmBuildTooltipAttrs(label, {
                    side: 'bottom',
                    ...((tipOpts && typeof tipOpts === 'object') ? tipOpts : {}),
                }), { expanded });
                touched = true;
            }
        }

        if (Object.prototype.hasOwnProperty.call(nextPatch, 'customFieldValues')) {
            const customValues = (nextPatch.customFieldValues && typeof nextPatch.customFieldValues === 'object') ? nextPatch.customFieldValues : {};
            Object.keys(customValues).forEach((fieldId) => {
                const fid = String(fieldId || '').trim();
                if (!fid) return;
                const field = __tmGetCustomFieldDefMap().get(fid);
                if (!field) return;
                const valueWrap = panel.querySelector(`[data-tm-detail-custom-field="${fid}"] .tm-task-detail-custom-field-value`);
                if (valueWrap instanceof HTMLElement) {
                    valueWrap.innerHTML = __tmBuildCustomFieldDisplayHtml(field, __tmGetTaskCustomFieldValue(task, fid), {
                        emptyText: '未设置',
                        maxTags: String(field?.type || '').trim() === 'multi' ? 2 : 1,
                    });
                    touched = true;
                }
                const textarea = panel.querySelector(`textarea[data-tm-detail-custom-text-field="${fid}"]`);
                if (textarea instanceof HTMLTextAreaElement && textarea !== document.activeElement) {
                    textarea.value = String(__tmNormalizeCustomFieldValue(field, __tmGetTaskCustomFieldValue(task, fid)) || '').trim();
                    touched = true;
                }
            });
        }

        try { __tmRememberTaskDetailLocationSignature(panel, task); } catch (e) {}
        return touched;
    }

    function __tmScheduleTaskDetailForceRebuildRetry(rootEl, taskId, source = '') {
        const root = rootEl instanceof HTMLElement ? rootEl : null;
        const tid = String(taskId || '').trim();
        if (!(root instanceof HTMLElement) || !tid) return false;
        try {
            if (root.__tmTaskDetailForceRebuildRetryQueued === true) return true;
        } catch (e) {}
        const reasons = (() => {
            try { return __tmCollectTaskDetailFallbackDeferReasons(root); } catch (e) { return []; }
        })();
        let waitMs = 240;
        reasons.forEach((reason) => {
            const match = /^refresh-hold:(\d+)/.exec(String(reason || '').trim());
            if (!match) return;
            waitMs = Math.max(waitMs, Math.min(1400, Math.max(120, Number(match[1]) || 0) + 40));
        });
        try { root.__tmTaskDetailForceRebuildRetryQueued = true; } catch (e) {}
        try {
            __tmPushDetailDebug('detail-force-rebuild-deferred', {
                taskId: tid,
                source: String(source || '').trim(),
                reasons,
                waitMs,
            });
        } catch (e) {}
        try {
            setTimeout(() => {
                try { root.__tmTaskDetailForceRebuildRetryQueued = false; } catch (e) {}
                if (!root.isConnected) return;
                try {
                    __tmRefreshVisibleTaskDetailForTask(tid, {
                        forceRebuild: true,
                        retry: true,
                        source: String(source || '').trim() || 'detail-force-rebuild-retry',
                    });
                } catch (e) {}
            }, waitMs);
            return true;
        } catch (e) {
            try { root.__tmTaskDetailForceRebuildRetryQueued = false; } catch (e2) {}
        }
        return false;
    }

    function __tmRefreshVisibleTaskDetailForTask(taskId, options = {}) {
        const tid = String(taskId || '').trim();
        if (!tid) return false;
        const opts = (options && typeof options === 'object') ? options : {};
        const forceRebuild = opts.forceRebuild === true;
        const refreshSource = String(opts.source || '').trim() || (forceRebuild ? 'visible-task-detail-force-rebuild' : 'visible-task-detail-refresh');
        try {
            __tmPushDetailDebug('detail-refresh-enter', {
                taskId: tid,
                forceRebuild,
                source: refreshSource,
                viewMode: String(state.viewMode || '').trim(),
                checklistDetailTaskId: String(state.detailTaskId || '').trim(),
                kanbanDetailTaskId: String(state.kanbanDetailTaskId || '').trim(),
                hasOverlay: !!document.getElementById('tm-task-detail-overlay'),
            });
        } catch (e) {}
        let refreshed = false;
        if (__tmIsChecklistSelectionContext(state.modal) && __tmAreTaskDetailIdsEquivalent(state.detailTaskId, tid)) {
            const notePanel = __tmResolveChecklistDetailPanel(state.modal).panel;
            const noteTask = __tmGetTaskDetailTaskById(tid, { includeWhiteboard: true });
            if (notePanel instanceof HTMLElement && __tmKeepTaskDetailNoteViewDuringRefresh(notePanel, noteTask, tid)) {
                refreshed = true;
            } else
            if (forceRebuild) {
                const panel = __tmResolveChecklistDetailPanel(state.modal).panel;
                if (panel instanceof HTMLElement
                    && __tmIsTaskDetailRootUsable(panel, { taskId: tid })
                    && opts.skipDefer !== true
                    && __tmShouldDeferTaskDetailFallback(panel)
                    && opts.retry !== true) {
                    const task = __tmGetTaskDetailTaskById(tid, { includeWhiteboard: true });
                    try { if (task) panel.__tmTaskDetailTask = task; } catch (e) {}
                    try { panel.dataset.tmDetailTaskId = tid; } catch (e) {}
                    refreshed = __tmScheduleTaskDetailForceRebuildRetry(panel, tid, `${refreshSource}:checklist`) || refreshed;
                } else {
                    refreshed = !!__tmRefreshChecklistSelectionInPlace(state.modal, `${refreshSource}:checklist`, { forceRebuild: true }) || refreshed;
                }
            } else {
                try {
                    const panel = __tmResolveChecklistDetailPanel(state.modal).panel;
                    const detailPatched = !!__tmPatchTaskDetailPanelInPlace(panel, tid, {
                        done: true,
                        customStatus: true,
                        priority: true,
                        startDate: true,
                        completionTime: true,
                        taskCompleteAt: true,
                        repeatHistory: true,
                        duration: true,
                        tomatoEstimateCount: true,
                        tomatoCount: true,
                        pinned: true,
                        remark: true,
                        attachments: true,
                        customFieldValues: true,
                        location: true,
                    });
refreshed = detailPatched || refreshed;
                } catch (e) {}
                if (!refreshed) {
                    const panel = __tmResolveChecklistDetailPanel(state.modal).panel;
                    if (!__tmIsTaskDetailRootUsable(panel, { taskId: tid })) {
} else {
                        const shouldDeferFallback = __tmShouldDeferTaskDetailFallback(panel);
                        if (shouldDeferFallback) {
                            const task = __tmGetTaskDetailTaskById(tid, { includeWhiteboard: true });
                            try { if (panel instanceof HTMLElement && task) panel.__tmTaskDetailTask = task; } catch (e) {}
                            try { if (panel instanceof HTMLElement) panel.dataset.tmDetailTaskId = tid; } catch (e) {}
                            try {
                                __tmPushDetailDebug('detail-refresh-deferred-fallback', {
                                    taskId: tid,
                                    scope: 'checklist',
                                    reasons: __tmCollectTaskDetailFallbackDeferReasons(panel),
                                });
                            } catch (e) {}
refreshed = !!task || refreshed;
                        } else {
                            try {
                                __tmPushDetailDebug('detail-refresh-fallback-rebuild', {
                                    taskId: tid,
                                    scope: 'checklist',
                                    reasons: [],
                                });
                            } catch (e) {}
refreshed = !!__tmRefreshChecklistSelectionInPlace(state.modal, 'visible-task-detail-fallback') || refreshed;
                        }
                    }
                }
            }
        }
        if (__tmAreTaskDetailIdsEquivalent(state.detailTaskId, tid)) {
            const notePanel = __tmResolveTaskDetailSheetPanel(state.modal);
            const noteTask = __tmGetTaskDetailTaskById(tid, { includeWhiteboard: true });
            if (notePanel instanceof HTMLElement && __tmKeepTaskDetailNoteViewDuringRefresh(notePanel, noteTask, tid)) {
                refreshed = true;
            } else
            if (forceRebuild) {
                const panel = __tmResolveTaskDetailSheetPanel(state.modal);
                if (panel instanceof HTMLElement
                    && __tmIsTaskDetailRootUsable(panel, { taskId: tid })
                    && opts.skipDefer !== true
                    && __tmShouldDeferTaskDetailFallback(panel)
                    && opts.retry !== true) {
                    const task = __tmGetTaskDetailTaskById(tid, { includeWhiteboard: true });
                    try { if (task) panel.__tmTaskDetailTask = task; } catch (e) {}
                    try { panel.dataset.tmDetailTaskId = tid; } catch (e) {}
                    refreshed = __tmScheduleTaskDetailForceRebuildRetry(panel, tid, `${refreshSource}:task-sheet`) || refreshed;
                } else {
                    refreshed = !!__tmRefreshTaskDetailSheetInPlace(state.modal, `${refreshSource}:task-sheet`, { forceRebuild: true }) || refreshed;
                }
            } else {
                try {
                    const panel = __tmResolveTaskDetailSheetPanel(state.modal);
                    if (panel instanceof HTMLElement) {
                        const detailPatched = !!__tmPatchTaskDetailPanelInPlace(panel, tid, {
                            done: true,
                            customStatus: true,
                            priority: true,
                            startDate: true,
                            completionTime: true,
                            taskCompleteAt: true,
                            repeatHistory: true,
                            duration: true,
                            tomatoEstimateCount: true,
                            tomatoCount: true,
                            pinned: true,
                            remark: true,
                            attachments: true,
                            customFieldValues: true,
                            location: true,
                        });
                        refreshed = detailPatched || refreshed;
                        if (!detailPatched) {
                            if (__tmIsTaskDetailRootUsable(panel, { taskId: tid }) && __tmShouldDeferTaskDetailFallback(panel)) {
                                const task = __tmGetTaskDetailTaskById(tid, { includeWhiteboard: true });
                                try { if (task) panel.__tmTaskDetailTask = task; } catch (e) {}
                                try { panel.dataset.tmDetailTaskId = tid; } catch (e) {}
                                try {
                                    __tmPushDetailDebug('detail-refresh-deferred-fallback', {
                                        taskId: tid,
                                        scope: 'task-sheet',
                                        reasons: __tmCollectTaskDetailFallbackDeferReasons(panel),
                                    });
                                } catch (e) {}
                                refreshed = !!task || refreshed;
                            } else {
                                refreshed = !!__tmRefreshTaskDetailSheetInPlace(state.modal, 'visible-task-detail-fallback') || refreshed;
                            }
                        }
                    }
                } catch (e) {}
            }
        }
        if (String(state.viewMode || '').trim() === 'kanban' && __tmAreTaskDetailIdsEquivalent(state.kanbanDetailTaskId, tid)) {
            if (forceRebuild) {
                const panel = state.modal?.querySelector?.('#tmKanbanDetailPanel');
                const task = __tmGetTaskDetailTaskById(tid, { includeWhiteboard: true });
                if (panel instanceof HTMLElement
                    && task
                    && __tmIsTaskDetailRootUsable(panel, { taskId: tid })
                    && opts.skipDefer !== true
                    && __tmShouldDeferTaskDetailFallback(panel)
                    && opts.retry !== true) {
                    try { panel.__tmTaskDetailTask = task; } catch (e) {}
                    try { panel.dataset.tmDetailTaskId = tid; } catch (e) {}
                    refreshed = __tmScheduleTaskDetailForceRebuildRetry(panel, tid, `${refreshSource}:kanban`) || refreshed;
                } else if (task) {
                    refreshed = !!__tmRefreshKanbanDetailInPlace(state.modal, { source: `${refreshSource}:kanban` }) || refreshed;
                } else {
                    try { __tmCloseKanbanDetailFloating(); refreshed = true; } catch (e) {}
                }
            } else {
                refreshed = !!__tmRefreshKanbanDetailInPlace(state.modal, { source: 'visible-task-detail-refresh' }) || refreshed;
            }
        }
        const overlay = document.getElementById('tm-task-detail-overlay');
        const overlayTaskId = String(overlay?.__tmTaskDetailTask?.id || overlay?.dataset?.tmDetailTaskId || '').trim();
        if (overlay instanceof HTMLElement
            && document.body.contains(overlay)
            && __tmIsTaskDetailRootUsable(overlay, { taskId: tid })
            && overlayTaskId
            && __tmAreTaskDetailIdsEquivalent(overlayTaskId, tid)) {
            try {
                const overlayScrollSnapshot = __tmCaptureStandaloneTaskDetailScrollSnapshot();
                if (forceRebuild) {
                    const task = __tmGetTaskDetailTaskById(tid, { includeWhiteboard: true });
                    if (task && opts.skipDefer !== true && __tmShouldDeferTaskDetailFallback(overlay) && opts.retry !== true) {
                        try { overlay.__tmTaskDetailTask = task; } catch (e) {}
                        try { overlay.dataset.tmDetailTaskId = tid; } catch (e) {}
                        refreshed = __tmScheduleTaskDetailForceRebuildRetry(overlay, tid, `${refreshSource}:overlay`) || refreshed;
                    } else if (task) {
                        try {
                            __tmPushDetailDebug('detail-refresh-fallback-rebuild', {
                                taskId: tid,
                                scope: 'overlay',
                                reasons: [],
                            });
                        } catch (e) {}
                        const overlayDraftSnapshot = __tmCaptureTaskDetailSubtaskDraftSnapshot(overlay, tid);
                        const overlayRemarkDraftSnapshot = __tmCaptureTaskDetailRemarkDraftSnapshot(overlay, tid);
                        try {
                            __tmPushDetailDebug('detail-rebuild-html', {
                                taskId: tid,
                                embedded: false,
                                source: `${refreshSource}:overlay`,
                                rootTag: __tmDescribeDebugElement(overlay),
                                pendingSave: overlay.__tmTaskDetailPendingSave === true,
                                hasActivePopover: !!overlay.__tmTaskDetailActiveInlinePopover,
                                refreshHoldMsLeft: Math.max(0, Number(overlay.__tmTaskDetailRefreshHoldUntil || 0) - Date.now()),
                            });
                        } catch (e) {}
                        try { __tmDestroyTaskDetailNoteViewForRoot(overlay, `${refreshSource}:overlay`); } catch (e) {}
                        overlay.innerHTML = __tmBuildTaskDetailInnerHtml(task, { embedded: false });
                        try { overlay.__tmTaskDetailTask = task; } catch (e) {}
                        try { overlay.dataset.tmDetailTaskId = tid; } catch (e) {}
                        __tmBindTaskDetailEditor(overlay, tid, {
                            embedded: false,
                            source: 'visible-task-detail-fallback:overlay',
                            onClose: typeof overlay.__tmTaskDetailOnClose === 'function' ? overlay.__tmTaskDetailOnClose : null,
                            task,
                        });
                        try { __tmRestoreTaskDetailSubtaskDraftSnapshot(overlay, overlayDraftSnapshot); } catch (e) {}
                        try { __tmRestoreTaskDetailRemarkDraftSnapshot(overlay, overlayRemarkDraftSnapshot); } catch (e) {}
                        try { __tmBindFloatingTooltips(overlay); } catch (e) {}
                        refreshed = true;
                    } else {
                        try {
                            const closeFn = typeof overlay.__tmTaskDetailOnClose === 'function' ? overlay.__tmTaskDetailOnClose : null;
                            if (closeFn) closeFn();
                            else overlay.remove();
                            refreshed = true;
                        } catch (e) {}
                    }
                } else {
                    const detailPatched = !!__tmPatchTaskDetailPanelInPlace(overlay, tid, {
                        done: true,
                        customStatus: true,
                        priority: true,
                        startDate: true,
                        completionTime: true,
                        taskCompleteAt: true,
                        duration: true,
                        tomatoEstimateCount: true,
                        tomatoCount: true,
                        pinned: true,
                        remark: true,
                        attachments: true,
                        customFieldValues: true,
                        location: true,
                    });
                    if (!detailPatched) {
                        const task = __tmGetTaskDetailTaskById(tid, { includeWhiteboard: true });
                        if (task && __tmShouldDeferTaskDetailFallback(overlay)) {
                            try { overlay.__tmTaskDetailTask = task; } catch (e) {}
                            try { overlay.dataset.tmDetailTaskId = tid; } catch (e) {}
                            try {
                                __tmPushDetailDebug('detail-refresh-deferred-fallback', {
                                    taskId: tid,
                                    scope: 'overlay',
                                    reasons: __tmCollectTaskDetailFallbackDeferReasons(overlay),
                                });
                            } catch (e) {}
                            refreshed = true;
                        } else if (task) {
                            try {
                                __tmPushDetailDebug('detail-refresh-fallback-rebuild', {
                                    taskId: tid,
                                    scope: 'overlay',
                                    reasons: [],
                                });
                            } catch (e) {}
                            const overlayDraftSnapshot = __tmCaptureTaskDetailSubtaskDraftSnapshot(overlay, tid);
                            const overlayRemarkDraftSnapshot = __tmCaptureTaskDetailRemarkDraftSnapshot(overlay, tid);
                            try {
                                __tmPushDetailDebug('detail-rebuild-html', {
                                    taskId: tid,
                                    embedded: false,
                                    source: 'visible-task-detail-fallback:overlay',
                                    rootTag: __tmDescribeDebugElement(overlay),
                                    pendingSave: overlay.__tmTaskDetailPendingSave === true,
                                    hasActivePopover: !!overlay.__tmTaskDetailActiveInlinePopover,
                                    refreshHoldMsLeft: Math.max(0, Number(overlay.__tmTaskDetailRefreshHoldUntil || 0) - Date.now()),
                                });
                            } catch (e) {}
                            try { __tmDestroyTaskDetailNoteViewForRoot(overlay, 'visible-task-detail-fallback:overlay'); } catch (e) {}
                            overlay.innerHTML = __tmBuildTaskDetailInnerHtml(task, { embedded: false });
                            try { overlay.__tmTaskDetailTask = task; } catch (e) {}
                            try { overlay.dataset.tmDetailTaskId = tid; } catch (e) {}
                            __tmBindTaskDetailEditor(overlay, tid, {
                                embedded: false,
                                source: 'visible-task-detail-fallback:overlay',
                                onClose: typeof overlay.__tmTaskDetailOnClose === 'function' ? overlay.__tmTaskDetailOnClose : null,
                                task,
                            });
                            try { __tmRestoreTaskDetailSubtaskDraftSnapshot(overlay, overlayDraftSnapshot); } catch (e) {}
                            try { __tmRestoreTaskDetailRemarkDraftSnapshot(overlay, overlayRemarkDraftSnapshot); } catch (e) {}
                            try { __tmBindFloatingTooltips(overlay); } catch (e) {}
                            refreshed = true;
                        }
                    } else {
                        refreshed = true;
                    }
                }
                try { __tmRestoreStandaloneTaskDetailScrollSnapshot(overlayScrollSnapshot); } catch (e2) {}
            } catch (e) {}
        }
        try {
            __tmPushDetailDebug('detail-refresh-exit', {
                taskId: tid,
                refreshed: !!refreshed,
            });
        } catch (e) {}
        return refreshed;
    }


    let __tmKanbanDetailOutsideClickHandler = null;
    let __tmKanbanDetailOutsidePointerDownHandler = null;
    let __tmKanbanDetailPointerStartedInside = false;
    let __tmKanbanDetailSyntheticClickSuppressCleanup = null;
    let __tmKanbanDetailRepositionHandler = null;
    let __tmKanbanDetailRepositionModal = null;

    function __tmClearKanbanDetailFloatingHandlers() {
        try { if (typeof __tmKanbanDetailSyntheticClickSuppressCleanup === 'function') __tmKanbanDetailSyntheticClickSuppressCleanup(); } catch (e) {}
        __tmKanbanDetailSyntheticClickSuppressCleanup = null;
        try {
            if (__tmKanbanDetailOutsideClickHandler) {
                globalThis.__tmRuntimeEvents?.off?.(document, 'click', __tmKanbanDetailOutsideClickHandler, false);
                __tmKanbanDetailOutsideClickHandler = null;
            }
            if (__tmKanbanDetailOutsidePointerDownHandler) {
                globalThis.__tmRuntimeEvents?.off?.(document, 'pointerdown', __tmKanbanDetailOutsidePointerDownHandler, true);
                __tmKanbanDetailOutsidePointerDownHandler = null;
            }
        } catch (e) {}
        __tmKanbanDetailPointerStartedInside = false;
        try {
            if (__tmKanbanDetailRepositionHandler && __tmKanbanDetailRepositionModal instanceof Element) {
                globalThis.__tmRuntimeEvents?.off?.(__tmKanbanDetailRepositionModal, 'scroll', __tmKanbanDetailRepositionHandler, true);
            }
        } catch (e) {}
        try {
            if (__tmKanbanDetailRepositionHandler) {
                globalThis.__tmRuntimeEvents?.off?.(window, 'resize', __tmKanbanDetailRepositionHandler, true);
            }
        } catch (e) {}
        __tmKanbanDetailRepositionHandler = null;
        __tmKanbanDetailRepositionModal = null;
    }

    function __tmNormalizeKanbanDetailFloatHost(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof HTMLElement)) return null;
        let floats = [];
        try {
            floats = Array.from(modal.querySelectorAll('#tmKanbanDetailFloat'))
                .filter((el) => el instanceof HTMLElement);
        } catch (e) {
            floats = [];
        }
        if (!floats.length) return null;
        const hasPanel = (el) => !!(el instanceof HTMLElement && el.querySelector('#tmKanbanDetailPanel') instanceof HTMLElement);
        const preferred = floats.find((el) => el.parentElement === modal && hasPanel(el))
            || floats.find(hasPanel)
            || floats.find((el) => el.parentElement === modal)
            || floats[0];
        if (!(preferred instanceof HTMLElement)) return null;
        if (preferred.parentElement !== modal) {
            try { modal.appendChild(preferred); } catch (e) {}
        }
        floats.forEach((el) => {
            if (el === preferred) return;
            try { el.remove(); } catch (e) {}
        });
        return preferred;
    }

    function __tmBindKanbanDetailSyntheticClickSuppress(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return null;
        let active = false;
        let movedOutside = false;
        let pointerId = NaN;
        let suppressClickUntil = 0;
        const suppressMs = 950;
        const getFloatPanel = () => {
            try { return modal.querySelector('#tmKanbanDetailFloat'); } catch (e) { return null; }
        };
        const isSamePointer = (ev) => {
            if (!Number.isFinite(pointerId)) return true;
            const cur = Number(ev?.pointerId);
            return !Number.isFinite(cur) || cur === pointerId;
        };
        const pointInsideFloat = (ev, floatPanel) => {
            const x = Number(ev?.clientX);
            const y = Number(ev?.clientY);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
            try {
                const pointEl = document.elementFromPoint(x, y);
                return !!(pointEl instanceof Element && floatPanel instanceof Element && floatPanel.contains(pointEl));
            } catch (e) {
                return false;
            }
        };
        const onPointerDown = (ev) => {
            if (ev && typeof ev.button === 'number' && ev.button !== 0) return;
            const floatPanel = getFloatPanel();
            const target = __tmResolveTaskDetailEventElement(ev?.target);
            if (!(floatPanel instanceof Element) || !(target instanceof Element) || !floatPanel.contains(target)) return;
            active = true;
            movedOutside = false;
            pointerId = Number.isFinite(Number(ev?.pointerId)) ? Number(ev.pointerId) : NaN;
            suppressClickUntil = 0;
        };
        const onPointerMove = (ev) => {
            if (!active || !isSamePointer(ev)) return;
            const floatPanel = getFloatPanel();
            const target = __tmResolveTaskDetailEventElement(ev?.target);
            const inside = !!(target instanceof Element && floatPanel instanceof Element && floatPanel.contains(target))
                || pointInsideFloat(ev, floatPanel);
            if (!inside) {
                movedOutside = true;
                suppressClickUntil = Date.now() + suppressMs;
            }
        };
        const finishPointer = (ev, forceSuppress = false) => {
            if (!active || !isSamePointer(ev)) return;
            const floatPanel = getFloatPanel();
            const target = __tmResolveTaskDetailEventElement(ev?.target);
            const finalOutside = !!(ev && floatPanel instanceof Element && target instanceof Element
                && !floatPanel.contains(target)
                && !pointInsideFloat(ev, floatPanel));
            if (forceSuppress || movedOutside || finalOutside) {
                suppressClickUntil = Math.max(suppressClickUntil, Date.now() + suppressMs);
            }
            active = false;
            pointerId = NaN;
        };
        const onClick = (ev) => {
            if (Date.now() > suppressClickUntil) return;
            suppressClickUntil = 0;
            __tmKanbanDetailPointerStartedInside = false;
            try { ev.preventDefault?.(); } catch (e) {}
            try { ev.stopPropagation?.(); } catch (e) {}
            try { ev.stopImmediatePropagation?.(); } catch (e) {}
        };
        const onPointerUp = (ev) => finishPointer(ev, false);
        const onPointerCancel = (ev) => finishPointer(ev, true);
        try { document.addEventListener('pointerdown', onPointerDown, true); } catch (e) {}
        try { document.addEventListener('pointermove', onPointerMove, true); } catch (e) {}
        try { document.addEventListener('pointerup', onPointerUp, true); } catch (e) {}
        try { document.addEventListener('pointercancel', onPointerCancel, true); } catch (e) {}
        try { document.addEventListener('click', onClick, true); } catch (e) {}
        try { window.addEventListener('pointerup', onPointerUp, true); } catch (e) {}
        try { window.addEventListener('pointercancel', onPointerCancel, true); } catch (e) {}
        return () => {
            try { document.removeEventListener('pointerdown', onPointerDown, true); } catch (e) {}
            try { document.removeEventListener('pointermove', onPointerMove, true); } catch (e) {}
            try { document.removeEventListener('pointerup', onPointerUp, true); } catch (e) {}
            try { document.removeEventListener('pointercancel', onPointerCancel, true); } catch (e) {}
            try { document.removeEventListener('click', onClick, true); } catch (e) {}
            try { window.removeEventListener('pointerup', onPointerUp, true); } catch (e) {}
            try { window.removeEventListener('pointercancel', onPointerCancel, true); } catch (e) {}
        };
    }
    function __tmCloseKanbanDetailFloating() {
        if (!String(state.kanbanDetailTaskId || '').trim()) return;
        const modal = state.modal instanceof Element ? state.modal : null;
        const floatPanel = modal ? __tmNormalizeKanbanDetailFloatHost(modal) : null;
        try { __tmClearTaskDetailNoteViewState('kanban', state.kanbanDetailTaskId, 'kanban-detail-close'); } catch (e) {}
        try {
            const panel = modal?.querySelector?.('#tmKanbanDetailPanel');
            __tmMarkTaskDetailRootClosing(panel, { holdMs: 900 });
            __tmMarkTaskDetailRootClosed(panel);
        } catch (e) {}
        state.kanbanDetailTaskId = '';
        state.kanbanDetailAnchorTaskId = '';
        try { __tmClearKanbanDetailFloatingHandlers(); } catch (e) {}
        if (floatPanel instanceof HTMLElement) {
            try { __tmAnimatePopupOutAndRemove(floatPanel, { duration: 110 }); } catch (e) {
                try { floatPanel.remove(); } catch (e2) {}
            }
            return;
        }
        render();
    }

    function __tmCaptureKanbanDetailScrollSnapshot(modalEl) {
        try {
            const modal = modalEl instanceof Element ? modalEl : state.modal;
            if (!(modal instanceof Element)) return null;
            if (String(state.viewMode || '').trim() !== 'kanban') return null;
            __tmNormalizeKanbanDetailFloatHost(modal);
            const panel = modal.querySelector('#tmKanbanDetailPanel');
            if (!(panel instanceof HTMLElement)) return null;
            const selectedId = String(panel.dataset.tmDetailTaskId || state.kanbanDetailTaskId || '').trim();
            if (!selectedId) return null;
            return {
                top: Number(panel.scrollTop || 0),
                left: Number(panel.scrollLeft || 0),
                selectedId,
            };
        } catch (e) {
            return null;
        }
    }

    function __tmRestoreKanbanDetailScrollSnapshot(snapshot, modalEl) {
        if (!snapshot || !String(snapshot.selectedId || '').trim()) return;
        const restore = () => {
            try {
                const modal = modalEl instanceof Element ? modalEl : state.modal;
                if (!(modal instanceof Element)) return;
                if (String(state.viewMode || '').trim() !== 'kanban') return;
                if (!__tmAreTaskDetailIdsEquivalent(state.kanbanDetailTaskId, snapshot.selectedId)) return;
                const panel = modal.querySelector('#tmKanbanDetailPanel');
                if (!(panel instanceof HTMLElement)) return;
                panel.scrollTop = Number(snapshot.top || 0);
                panel.scrollLeft = Number(snapshot.left || 0);
            } catch (e) {}
        };
        try { restore(); } catch (e) {}
        try { requestAnimationFrame(restore); } catch (e) {}
        try { setTimeout(restore, 30); } catch (e) {}
        try { setTimeout(restore, 90); } catch (e) {}
    }

    function __tmPositionKanbanDetailFloat(modalEl) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return false;
        const panel = __tmNormalizeKanbanDetailFloatHost(modal) || modal.querySelector('#tmKanbanDetailFloat');
        const selectedId = String(state.kanbanDetailTaskId || '').trim();
        const anchorId = String(state.kanbanDetailAnchorTaskId || selectedId).trim();
        const card = anchorId ? modal.querySelector(`.tm-kanban-card[data-id="${CSS.escape(anchorId)}"]`) : null;
        if (!(panel instanceof HTMLElement) || !(card instanceof HTMLElement)) return false;

        const prevVisibility = panel.style.visibility;
        const prevPointerEvents = panel.style.pointerEvents;
        const prevTransform = panel.style.transform;
        panel.style.visibility = 'hidden';
        panel.style.pointerEvents = 'none';
        panel.style.transform = 'none';
        panel.style.left = '24px';
        panel.style.top = '24px';
        panel.style.maxHeight = 'calc(100vh - 48px)';

        const cardRect = card.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const fixedOriginLeft = Math.round(panelRect.left - 24);
        const fixedOriginTop = Math.round(panelRect.top - 24);
        const viewportW = Number(window.innerWidth || document.documentElement.clientWidth || 0) || 0;
        const viewportH = Number(window.innerHeight || document.documentElement.clientHeight || 0) || 0;
        const gap = 12;
        const margin = 12;
        const panelW = Math.max(280, Math.min(420, Math.round(panelRect.width || 380)));
        const preferRight = (viewportW - cardRect.right - margin) >= Math.max(260, panelW * 0.72);
        let left = preferRight
            ? (cardRect.right + gap)
            : (cardRect.left - panelW - gap);
        left = Math.max(margin, Math.min(left, Math.max(margin, viewportW - panelW - margin)));

        let top = Math.round(cardRect.top);
        const minTop = 12;
        const panelH = Math.max(260, Math.round(panelRect.height || 480));
        const maxTop = Math.max(minTop, viewportH - Math.min(panelH, viewportH - 24) - margin);
        top = Math.max(minTop, Math.min(top, maxTop));
        const maxHeight = Math.max(240, viewportH - top - margin);

        panel.style.left = `${Math.round(left - fixedOriginLeft)}px`;
        panel.style.top = `${Math.round(top - fixedOriginTop)}px`;
        panel.style.maxHeight = `${Math.round(maxHeight)}px`;
        panel.style.visibility = prevVisibility || '';
        panel.style.pointerEvents = prevPointerEvents || '';
        panel.style.transform = prevTransform || '';
        return true;
    }

    function __tmScheduleKanbanDetailFloatSettledPosition(modalEl, options = {}) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return;
        const floatPanel = __tmNormalizeKanbanDetailFloatHost(modal) || modal.querySelector('#tmKanbanDetailFloat');
        if (!(floatPanel instanceof HTMLElement)) return;
        const opts = (options && typeof options === 'object') ? options : {};
        const hideDuringSettle = opts.hideDuringSettle === true;
        const onFinish = typeof opts.onFinish === 'function' ? opts.onFinish : null;
        const settleMs = Math.max(0, Number(opts.settleMs) || (hideDuringSettle ? 90 : 160));
        const settleToken = (Number(floatPanel.__tmKanbanDetailSettleToken || 0) || 0) + 1;
        let finished = false;
        try { floatPanel.__tmKanbanDetailSettleToken = settleToken; } catch (e) {}
        try { floatPanel.classList.add('tm-kanban-detail-float--settling'); } catch (e) {}
        if (hideDuringSettle) {
            try { floatPanel.classList.add('tm-kanban-detail-float--preopen'); } catch (e) {}
        }
        const run = (force = false) => {
            try {
                if (!force && finished) return;
                if (Number(floatPanel.__tmKanbanDetailSettleToken || 0) !== settleToken) return;
                if (String(state.viewMode || '').trim() !== 'kanban') return;
                if (!String(state.kanbanDetailTaskId || '').trim()) return;
                if (!(modal.querySelector('#tmKanbanDetailFloat') instanceof HTMLElement)) return;
                __tmPositionKanbanDetailFloat(modal);
            } catch (e) {}
        };
        const finish = () => {
            try {
                if (Number(floatPanel.__tmKanbanDetailSettleToken || 0) === settleToken) {
                    if (hideDuringSettle) run(true);
                    finished = true;
                    floatPanel.classList.remove('tm-kanban-detail-float--settling');
                    if (hideDuringSettle) floatPanel.classList.remove('tm-kanban-detail-float--preopen');
                    if (onFinish) onFinish();
                } else {
                    finished = true;
                }
            } catch (e) {}
        };
        try { run(); } catch (e) {}
        try { requestAnimationFrame(run); } catch (e) {}
        try { requestAnimationFrame(() => requestAnimationFrame(run)); } catch (e) {}
        try { setTimeout(finish, settleMs); } catch (e) {}
    }

    function __tmRefreshKanbanDetailInPlace(modalEl, options = {}) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return false;
        if (String(state.viewMode || '').trim() !== 'kanban') return false;
        __tmNormalizeKanbanDetailFloatHost(modal);
        const panel = modal.querySelector('#tmKanbanDetailPanel');
        const rawSelectedId = String(state.kanbanDetailTaskId || '').trim();
        const selectedId = __tmResolveTaskDetailEffectiveId(rawSelectedId) || rawSelectedId;
        if (selectedId && selectedId !== rawSelectedId) {
            try { state.kanbanDetailTaskId = selectedId; } catch (e) {}
            try { state.kanbanDetailAnchorTaskId = selectedId; } catch (e) {}
        }
        const task = selectedId
            ? (
                globalThis.__tmRuntimeState?.getTaskById?.(selectedId, { includePending: true, preferPending: true })
                || state.pendingInsertedTasks?.[selectedId]
                || state.flatTasks?.[selectedId]
                || (rawSelectedId && rawSelectedId !== selectedId
                    ? (
                        globalThis.__tmRuntimeState?.getTaskById?.(rawSelectedId, { includePending: true, preferPending: true })
                        || state.pendingInsertedTasks?.[rawSelectedId]
                        || state.flatTasks?.[rawSelectedId]
                        || null
                    )
                    : null)
                || null
            )
            : null;
        const opts = (options && typeof options === 'object') ? options : {};
        const refreshSource = String(opts.source || '').trim() || 'unknown';
        const shouldSchedulePosition = opts.schedulePosition !== false;
        const detailScrollSnapshot = opts.scrollSnapshot || __tmCaptureKanbanDetailScrollSnapshot(modal);
        if (!(panel instanceof HTMLElement) || !task) {
            __tmClearKanbanDetailFloatingHandlers();
            return false;
        }
        if (__tmKeepTaskDetailNoteViewDuringRefresh(panel, task, selectedId)) {
            if (shouldSchedulePosition) {
                try { __tmScheduleKanbanDetailFloatSettledPosition(modal); } catch (e) {}
            }
            return true;
        }
        if (!__tmIsTaskDetailRootUsable(panel, { taskId: selectedId })) return false;
        const detailDraftSnapshot = __tmCaptureTaskDetailSubtaskDraftSnapshot(panel, selectedId);
        const remarkDraftSnapshot = __tmCaptureTaskDetailRemarkDraftSnapshot(panel, selectedId);
        try {
            __tmPushDetailDebug('detail-rebuild-html', {
                taskId: String(selectedId || '').trim(),
                embedded: true,
                source: `kanban-detail-refresh:${refreshSource}`,
                rootTag: __tmDescribeDebugElement(panel),
                pendingSave: panel.__tmTaskDetailPendingSave === true,
                hasActivePopover: !!panel.__tmTaskDetailActiveInlinePopover,
                refreshHoldMsLeft: Math.max(0, Number(panel.__tmTaskDetailRefreshHoldUntil || 0) - Date.now()),
            });
        } catch (e) {}
        const renderNoteView = !!__tmShouldRenderTaskDetailNoteView('kanban', task);
        if (!renderNoteView) {
            try { __tmDestroyTaskDetailNoteViewForRoot(panel, `kanban-detail-refresh:${refreshSource}`); } catch (e) {}
        }
        panel.innerHTML = renderNoteView
            ? __tmBuildTaskDetailNoteViewInnerHtml(task, { embedded: true, floating: true })
            : __tmBuildTaskDetailInnerHtml(task, { embedded: true, floating: true });
        try { panel.__tmTaskDetailTask = task; } catch (e) {}
        try { __tmRememberTaskDetailLocationSignature(panel, task); } catch (e) {}
        try { panel.dataset.tmDetailTaskId = selectedId; } catch (e) {}
        __tmBindTaskDetailEditor(panel, selectedId, {
            embedded: true,
            source: `kanban-detail-refresh:${refreshSource}`,
            task,
            onClose: () => {
                __tmCloseKanbanDetailFloating();
            }
        });
        try { __tmRestoreTaskDetailSubtaskDraftSnapshot(panel, detailDraftSnapshot); } catch (e) {}
        try { __tmRestoreTaskDetailRemarkDraftSnapshot(panel, remarkDraftSnapshot); } catch (e) {}
        __tmClearKanbanDetailFloatingHandlers();
        __tmKanbanDetailSyntheticClickSuppressCleanup = __tmBindKanbanDetailSyntheticClickSuppress(modal);
        __tmKanbanDetailOutsidePointerDownHandler = (ev) => {
            const floatPanel = modal.querySelector('#tmKanbanDetailFloat');
            const target = ev?.target;
            __tmKanbanDetailPointerStartedInside = !!(target instanceof Element && (
                (floatPanel instanceof Element && floatPanel.contains(target))
                || __tmIsTaskDetailNoteViewEventTarget(target)
                || !!target.closest('.tm-task-detail-inline-popover,.tm-inline-editor')
            ));
        };
        __tmKanbanDetailOutsideClickHandler = (ev) => {
            const floatPanel = modal.querySelector('#tmKanbanDetailFloat');
            if (!(floatPanel instanceof Element)) return;
            const target = ev?.target;
            if (!(target instanceof Element)) return;
            if (__tmKanbanDetailPointerStartedInside) {
                __tmKanbanDetailPointerStartedInside = false;
                return;
            }
            if (floatPanel.contains(target)) return;
            if (target.closest('.tm-kanban-more')) return;
            if (__tmIsTaskDetailNoteViewEventTarget(target)) return;
            if (target.closest('.tm-task-detail-inline-popover,.tm-inline-editor')) return;
            __tmCloseKanbanDetailFloating();
        };
        try { globalThis.__tmRuntimeEvents?.on?.(document, 'pointerdown', __tmKanbanDetailOutsidePointerDownHandler, true); } catch (e) {}
        try { globalThis.__tmRuntimeEvents?.on?.(document, 'click', __tmKanbanDetailOutsideClickHandler, false); } catch (e) {}
        __tmKanbanDetailRepositionHandler = () => {
            try { __tmPositionKanbanDetailFloat(modal); } catch (e) {}
        };
        __tmKanbanDetailRepositionModal = modal;
        try { globalThis.__tmRuntimeEvents?.on?.(modal, 'scroll', __tmKanbanDetailRepositionHandler, true); } catch (e) {}
        try { globalThis.__tmRuntimeEvents?.on?.(window, 'resize', __tmKanbanDetailRepositionHandler, true); } catch (e) {}
        if (shouldSchedulePosition) {
            try { __tmScheduleKanbanDetailFloatSettledPosition(modal); } catch (e) {}
        }
        if (detailScrollSnapshot && __tmAreTaskDetailIdsEquivalent(detailScrollSnapshot.selectedId, selectedId)) {
            __tmRestoreKanbanDetailScrollSnapshot(detailScrollSnapshot, modal);
        }
        return true;
    }

    function __tmOpenKanbanDetailFloatingInPlace(taskId, modalEl = null) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        const rawTid = String(taskId || '').trim();
        const tid = __tmResolveTaskDetailEffectiveId(rawTid) || rawTid;
        if (!(modal instanceof Element) || !tid) return false;
        if (String(state.viewMode || '').trim() !== 'kanban') return false;
        const body = modal.querySelector('.tm-body.tm-body--kanban');
        if (!(body instanceof HTMLElement)) return false;
        __tmNormalizeKanbanDetailFloatHost(modal);
        const task = globalThis.__tmRuntimeState?.getTaskById?.(tid, { includePending: true, preferPending: true })
            || state.flatTasks?.[tid]
            || state.pendingInsertedTasks?.[tid]
            || (rawTid && rawTid !== tid
                ? (
                    globalThis.__tmRuntimeState?.getTaskById?.(rawTid, { includePending: true, preferPending: true })
                    || state.flatTasks?.[rawTid]
                    || state.pendingInsertedTasks?.[rawTid]
                    || null
                )
                : null)
            || null;
        if (!task) return false;

        try {
            const currentNote = __tmGetTaskDetailNoteViewState('kanban');
            if (currentNote && !__tmAreTaskDetailIdsEquivalent(currentNote.taskId, tid)) {
                __tmClearTaskDetailNoteViewState('kanban', '', 'kanban-detail-open-other-task');
            }
        } catch (e) {}
        state.kanbanDetailTaskId = tid;
        state.kanbanDetailAnchorTaskId = tid;

        let floatPanel = modal.querySelector('#tmKanbanDetailFloat');
        let panel = modal.querySelector('#tmKanbanDetailPanel');
        if (!(floatPanel instanceof HTMLElement)) {
            floatPanel = document.createElement('aside');
            floatPanel.className = 'tm-kanban-detail-float';
            floatPanel.id = 'tmKanbanDetailFloat';
        }
        if (!(panel instanceof HTMLElement)) {
            panel = document.createElement('div');
            panel.className = 'tm-kanban-detail-float__body';
            panel.id = 'tmKanbanDetailPanel';
            floatPanel.replaceChildren(panel);
        } else if (panel.parentElement !== floatPanel) {
            floatPanel.replaceChildren(panel);
        }
        const isNewFloatPanel = !floatPanel.isConnected;
        if (isNewFloatPanel) {
            try { floatPanel.classList.add('tm-kanban-detail-float--preopen'); } catch (e) {}
            modal.appendChild(floatPanel);
        }

        if (!isNewFloatPanel && __tmKeepTaskDetailNoteViewDuringRefresh(panel, task, tid)) {
            try { __tmRefreshKanbanDetailInPlace(modal, { source: 'kanban-detail-open-in-place-note-keep', schedulePosition: false }); } catch (e) {}
            try { __tmAnimatePopupIn(floatPanel, { origin: 'top-left', duration: 120 }); } catch (e) {}
            try { __tmScheduleKanbanDetailFloatSettledPosition(modal); } catch (e) {}
            return true;
        }

        try { __tmDestroyTaskDetailNoteViewForRoot(panel, 'kanban-detail-open-in-place'); } catch (e) {}
        panel.innerHTML = __tmBuildTaskDetailInnerHtml(task, { embedded: true, floating: true });
        try { panel.__tmTaskDetailTask = task; } catch (e) {}
        try { __tmRememberTaskDetailLocationSignature(panel, task); } catch (e) {}
        try { panel.dataset.tmDetailTaskId = tid; } catch (e) {}
        __tmBindTaskDetailEditor(panel, tid, {
            embedded: true,
            source: 'kanban-detail-open-in-place',
            task,
            onClose: () => {
                __tmCloseKanbanDetailFloating();
            }
        });
        try { __tmRefreshKanbanDetailInPlace(modal, { source: 'kanban-detail-open-in-place', schedulePosition: false }); } catch (e) {}
        if (isNewFloatPanel) {
            try {
                __tmScheduleKanbanDetailFloatSettledPosition(modal, {
                    hideDuringSettle: true,
                    settleMs: 90,
                    onFinish: () => {
                        try { __tmAnimatePopupIn(floatPanel, { origin: 'top-left', duration: 120 }); } catch (e) {}
                    },
                });
            } catch (e) {}
        } else {
            try { __tmAnimatePopupIn(floatPanel, { origin: 'top-left', duration: 120 }); } catch (e) {}
            try { __tmScheduleKanbanDetailFloatSettledPosition(modal); } catch (e) {}
        }
        return true;
    }

    function __tmChecklistUseSheetMode(modalEl) {
        return globalThis.__tmViewPolicy?.shouldUseChecklistSheetMode?.(modalEl)
            ?? (() => {
                if (state.__tmCalendarSidebarChecklistRender === true) return true;
                if (__tmHasCalendarSidebarChecklist(modalEl)) return true;
                if (String(state.viewMode || '').trim() === 'checklist' && __tmShouldShowCalendarSideDock()) {
                    return true;
                }
                const modal = modalEl instanceof Element ? modalEl : state.modal;
                const modalWidth = Number(modal?.clientWidth || 0);
                if (__tmIsMobileDevice()) return true;
                if (modalWidth > 0) return modalWidth <= 960;
                return (Number(window.innerWidth || 0) > 0) ? window.innerWidth <= 960 : false;
            })();
    }

    function __tmResolveChecklistDetailPanel(modalEl, options = {}) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) {
            return { panel: null, sheetMode: false, preferredSheetMode: false };
        }
        const preferredSheetMode = options && Object.prototype.hasOwnProperty.call(options, 'preferSheetMode')
            ? !!options.preferSheetMode
            : __tmChecklistUseSheetMode(modal);
        let panel = modal.querySelector(preferredSheetMode ? '#tmChecklistSheetPanel' : '#tmChecklistDetailPanel');
        let sheetMode = preferredSheetMode;
        if (!(panel instanceof HTMLElement)) {
            const fallback = modal.querySelector(preferredSheetMode ? '#tmChecklistDetailPanel' : '#tmChecklistSheetPanel');
            if (fallback instanceof HTMLElement) {
                panel = fallback;
                sheetMode = String(fallback.id || '').trim() === 'tmChecklistSheetPanel';
            }
        }
        return {
            panel: panel instanceof HTMLElement ? panel : null,
            sheetMode,
            preferredSheetMode,
        };
    }

    var __tmTaskDetailMutationBridgeState = globalThis.__tmTaskDetailMutationBridgeState || {
        unsubscribe: null,
        queued: false,
        ids: new Set(),
        seq: 0,
        source: '',
    };
    globalThis.__tmTaskDetailMutationBridgeState = __tmTaskDetailMutationBridgeState;

    function __tmAddTaskDetailMutationId(ids, value) {
        if (!(ids instanceof Set)) return;
        const addOne = (raw) => {
            const tid = String(raw || '').trim();
            if (tid) ids.add(tid);
        };
        const rawId = String(value || '').trim();
        if (!rawId) return;
        addOne(rawId);
        try { addOne(__tmResolveTaskDetailEffectiveId(rawId)); } catch (e) {}
        try {
            const aliases = globalThis.__tmRuntimeState?.getTaskIdAliases?.(rawId);
            (Array.isArray(aliases) ? aliases : []).forEach(addOne);
        } catch (e) {}
        try {
            const aliases = globalThis.__tmTaskStore?.getAliases?.(rawId);
            (Array.isArray(aliases) ? aliases : []).forEach(addOne);
        } catch (e) {}
    }

    function __tmCollectVisibleTaskDetailTargetIds() {
        const ids = new Set();
        const add = (id) => __tmAddTaskDetailMutationId(ids, id);
        try { add(state.detailTaskId); } catch (e) {}
        try { add(state.kanbanDetailTaskId); } catch (e) {}
        try {
            const modal = state.modal instanceof Element ? state.modal : null;
            const checklistPanel = modal ? __tmResolveChecklistDetailPanel(modal).panel : null;
            add(checklistPanel?.dataset?.tmDetailTaskId || checklistPanel?.__tmTaskDetailTaskId || checklistPanel?.__tmTaskDetailTask?.id);
            const sheetPanel = modal ? __tmResolveTaskDetailSheetPanel(modal) : null;
            add(sheetPanel?.dataset?.tmDetailTaskId || sheetPanel?.__tmTaskDetailTaskId || sheetPanel?.__tmTaskDetailTask?.id);
            const kanbanPanel = modal?.querySelector?.('#tmKanbanDetailPanel');
            add(kanbanPanel?.dataset?.tmDetailTaskId || kanbanPanel?.__tmTaskDetailTaskId || kanbanPanel?.__tmTaskDetailTask?.id);
        } catch (e) {}
        try {
            const overlay = document.getElementById('tm-task-detail-overlay');
            add(overlay?.dataset?.tmDetailTaskId || overlay?.__tmTaskDetailTaskId || overlay?.__tmTaskDetailTask?.id);
        } catch (e) {}
        return Array.from(ids).filter(Boolean);
    }

    function __tmInstallTaskDetailMutationBridge() {
        const bridge = __tmTaskDetailMutationBridgeState;
        try { bridge.unsubscribe?.(); } catch (e) {}
        bridge.unsubscribe = null;
        bridge.seq = Math.max(0, Number(bridge.seq) || 0) + 1;
        bridge.queued = false;
        bridge.ids = new Set();
        bridge.source = '';
        bridge.forceRebuild = false;
        return false;
    }

    try {
        // Detail mutation refresh is routed through ProjectionManager; keep this as a hot-reload cleanup hook.
        __tmInstallTaskDetailMutationBridge();
    } catch (e) {}
    globalThis.__tmInstallTaskDetailMutationBridge = __tmInstallTaskDetailMutationBridge;

// 渲染任务列表（支持跨文档全局排序）
