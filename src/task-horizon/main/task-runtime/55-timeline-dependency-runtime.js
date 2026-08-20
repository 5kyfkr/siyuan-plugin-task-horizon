    const __TM_TIMELINE_DEPENDENCY_SCOPES = new Set(['local', 'global']);

    function __tmGetEffectiveTimelineDependencyScope(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const activeDocId = String(Object.prototype.hasOwnProperty.call(opts, 'activeDocId')
            ? opts.activeDocId
            : state?.activeDocId || 'all').trim() || 'all';
        if (activeDocId !== 'all') return 'local';
        const configured = __tmNormalizeTimelineDependencyScope(opts.scope ?? SettingsStore?.data?.timelineDependencyScope);
        return __TM_TIMELINE_DEPENDENCY_SCOPES.has(configured) ? configured : 'global';
    }

    function __tmGetTimelineDependencyLinks(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const scope = __tmGetEffectiveTimelineDependencyScope(opts);
        const activeDocId = String(Object.prototype.hasOwnProperty.call(opts, 'activeDocId')
            ? opts.activeDocId
            : state?.activeDocId || 'all').trim() || 'all';
        const source = scope === 'global'
            ? (typeof __tmGetWhiteboardGlobalTaskLinks === 'function'
                ? __tmGetWhiteboardGlobalTaskLinks(String(opts.groupId || SettingsStore?.data?.currentGroupId || 'all').trim() || 'all')
                : [])
            : (typeof __tmGetAllTaskLinks === 'function'
                ? __tmGetAllTaskLinks({
                    includeAuto: true,
                    ...(activeDocId !== 'all' ? { docId: activeDocId } : {}),
                })
                : []);
        const seen = new Set();
        return (Array.isArray(source) ? source : []).filter((link) => {
            const from = String(link?.from || '').trim();
            const to = String(link?.to || '').trim();
            if (!from || !to || from === to) return false;
            const key = `${from}->${to}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).map((link) => ({
            ...link,
            from: String(link.from || '').trim(),
            to: String(link.to || '').trim(),
            scope,
        }));
    }

    function __tmGetTimelineDependencyTask(taskId, getTaskById) {
        const id = String(taskId || '').trim();
        if (!id) return null;
        if (typeof getTaskById === 'function') {
            try {
                const task = getTaskById(id);
                if (task && typeof task === 'object') return task;
            } catch (e) {}
        }
        try {
            const task = globalThis.__tmTaskBoundary?.getTask?.(id);
            if (task && typeof task === 'object') return task;
        } catch (e) {}
        return null;
    }

    function __tmShiftTimelineDateOnly(value, deltaDays) {
        const raw = String(value || '').trim();
        const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
        const delta = Math.round(Number(deltaDays) || 0);
        if (!match || !delta) return raw || '';
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + delta, 12, 0, 0, 0);
        if (Number.isNaN(date.getTime())) return '';
        const pad = (value0) => String(value0).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    function __tmBuildTimelineDateInversePatch(task, patch = {}) {
        const source = (task && typeof task === 'object') ? task : {};
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        const inverse = {};
        if (Object.prototype.hasOwnProperty.call(nextPatch, 'startDate')) {
            inverse.startDate = String(source.startDate || source.start_date || '').trim();
        }
        if (Object.prototype.hasOwnProperty.call(nextPatch, 'completionTime')) {
            inverse.completionTime = String(source.completionTime || source.completion_time || '').trim();
        }
        return inverse;
    }

    function __tmBuildTimelineDependencyCascadePatches(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const sourceId = String(opts.sourceTaskId || '').trim();
        const deltaDays = Math.round(Number(opts.deltaDays) || 0);
        const links = Array.isArray(opts.links) ? opts.links : [];
        const getTaskById = opts.getTaskById;
        if (!sourceId || deltaDays <= 0) return { patches: [], skippedTaskIds: [], visitedTaskIds: [] };

        const outgoing = new Map();
        links.forEach((link) => {
            const from = String(link?.from || '').trim();
            const to = String(link?.to || '').trim();
            if (!from || !to || from === to) return;
            if (!outgoing.has(from)) outgoing.set(from, []);
            outgoing.get(from).push(to);
        });

        const queue = [sourceId];
        const visited = new Set([sourceId]);
        const patches = [];
        const skippedTaskIds = [];
        while (queue.length) {
            const current = queue.shift();
            const nextIds = outgoing.get(current) || [];
            nextIds.forEach((nextId) => {
                const id = String(nextId || '').trim();
                if (!id || visited.has(id)) return;
                visited.add(id);
                queue.push(id);
                const task = __tmGetTimelineDependencyTask(id, getTaskById);
                if (!task || task.__tmWhiteboardSnapshot === true) {
                    skippedTaskIds.push(id);
                    return;
                }
                const patch = {};
                const startDate = String(task.startDate || task.start_date || '').trim();
                const completionTime = String(task.completionTime || task.completion_time || '').trim();
                const shiftedStart = startDate ? __tmShiftTimelineDateOnly(startDate, deltaDays) : '';
                const shiftedEnd = completionTime ? __tmShiftTimelineDateOnly(completionTime, deltaDays) : '';
                if (shiftedStart) patch.startDate = shiftedStart;
                if (shiftedEnd) patch.completionTime = shiftedEnd;
                if (Object.keys(patch).length) patches.push({ taskId: id, patch, inversePatch: __tmBuildTimelineDateInversePatch(task, patch) });
            });
        }
        return {
            patches,
            skippedTaskIds: Array.from(new Set(skippedTaskIds)),
            visitedTaskIds: Array.from(visited),
        };
    }

    async function __tmCommitTimelineDependencyShift(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const sourceTaskId = String(opts.sourceTaskId || '').trim();
        const sourcePatch = (opts.sourcePatch && typeof opts.sourcePatch === 'object') ? opts.sourcePatch : {};
        const deltaDays = Math.round(Number(opts.deltaDays) || 0);
        if (!sourceTaskId || deltaDays <= 0 || !Object.keys(sourcePatch).length) return { changed: false, cascadeCount: 0, skippedCount: 0 };
        const sourceTask = __tmGetTimelineDependencyTask(sourceTaskId, opts.getTaskById);
        if (!sourceTask || sourceTask.__tmWhiteboardSnapshot === true) throw new Error('任务不存在或为只读快照');
        const sourceDatePatch = {};
        const sourceStart = String(sourceTask.startDate || sourceTask.start_date || '').trim();
        const sourceEnd = String(sourceTask.completionTime || sourceTask.completion_time || '').trim();
        if (sourceStart && Object.prototype.hasOwnProperty.call(sourcePatch, 'startDate')) sourceDatePatch.startDate = sourcePatch.startDate;
        if (sourceEnd && Object.prototype.hasOwnProperty.call(sourcePatch, 'completionTime')) sourceDatePatch.completionTime = sourcePatch.completionTime;
        if (!Object.keys(sourceDatePatch).length) return { changed: false, cascadeCount: 0, skippedCount: 0 };
        const links = __tmGetTimelineDependencyLinks({
            scope: opts.scope,
            activeDocId: opts.activeDocId,
            groupId: opts.groupId,
        });
        const cascade = __tmBuildTimelineDependencyCascadePatches({
            sourceTaskId,
            deltaDays,
            links,
            getTaskById: opts.getTaskById,
        });
        const items = [{
            taskId: sourceTaskId,
            patch: sourceDatePatch,
            inversePatch: __tmBuildTimelineDateInversePatch(sourceTask, sourceDatePatch),
        }, ...cascade.patches];

        return await __tmEnqueueTimelineMutation(async () => {
            const applied = [];
            try {
                for (const item of items) {
                    await window.tmUpdateTaskDates(item.taskId, item.patch, {
                        source: 'timeline-dependency-shift',
                        wait: true,
                        background: false,
                        recordUndo: false,
                        timelineMutation: false,
                        refresh: false,
                        refreshCalendar: true,
                        skipInteractionGate: true,
                        showErrorHint: false,
                    });
                    applied.push(item);
                }
            } catch (error) {
                for (let index = applied.length - 1; index >= 0; index -= 1) {
                    const item = applied[index];
                    try {
                        await window.tmUpdateTaskDates(item.taskId, item.inversePatch, {
                            source: 'timeline-dependency-rollback',
                            wait: true,
                            background: false,
                            recordUndo: false,
                            timelineMutation: false,
                            refresh: false,
                            refreshCalendar: true,
                            skipInteractionGate: true,
                            showErrorHint: false,
                        });
                    } catch (rollbackError) {
                        try { console.error('[task-horizon] timeline dependency rollback failed', rollbackError); } catch (e) {}
                    }
                }
                throw error;
            }
            if (typeof __tmPushUndoRecord === 'function') {
                __tmPushUndoRecord({
                    type: 'taskPatchBatch',
                    taskId: sourceTaskId,
                    items: items.map((item) => ({
                        taskId: item.taskId,
                        patch: item.patch,
                        inversePatch: item.inversePatch,
                    })),
                    label: `时间轴顺延 +${deltaDays} 天`,
                    source: 'timeline-dependency-shift',
                });
            }
            try {
                if (typeof __tmRerenderTimelineInPlace === 'function') {
                    __tmRerenderTimelineInPlace(state.modal, { reuseLeftRows: true });
                } else {
                    state.__tmTimelineRenderDeps?.();
                }
            } catch (e) {
                try { state.__tmTimelineRenderDeps?.(); } catch (e2) {}
            }
            return {
                changed: true,
                cascadeCount: Math.max(0, items.length - 1),
                skippedCount: cascade.skippedTaskIds.length,
                skippedTaskIds: cascade.skippedTaskIds,
                deltaDays,
            };
        }, { label: 'timeline-dependency-shift' });
    }
