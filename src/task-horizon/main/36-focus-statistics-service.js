    const __TM_FOCUS_STATS_CONTRACT_VERSION = 2;
    const __TM_FOCUS_STATS_TIMEOUT_MS = 10000;
    const __TM_FOCUS_QUERY_TASK_ID_LIMIT = 10000;
    const __TM_FOCUS_CANDIDATE_ID_LIMIT = 20000;
    const __TM_FOCUS_SNAPSHOT_TASK_LIMIT = 20000;
    const __TM_FOCUS_SNAPSHOT_BYTE_LIMIT = 8 * 1024 * 1024;
    const __tmFocusDockQueryInflight = new Map();
    const __tmFocusDockQuerySlots = new Map();

    function __tmResolveFocusStatsTimeoutMs() {
        const configured = Number(globalThis.__tmFocusStatsTimeoutMs);
        return Number.isFinite(configured) && configured > 0
            ? Math.max(1, Math.floor(configured))
            : __TM_FOCUS_STATS_TIMEOUT_MS;
    }

    function __tmWithFocusStatsTimeout(stage, operation, control = {}) {
        const timeoutMs = __tmResolveFocusStatsTimeoutMs();
        const sourceSignal = control?.signal || null;
        if (sourceSignal?.aborted) return Promise.reject(__tmFocusStatsSupersededError(stage || 'aborted'));
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const operationSignal = controller?.signal || sourceSignal;
        let timer = null;
        let abortHandler = null;
        const pending = Promise.resolve().then(() => operation(operationSignal));
        const timeout = new Promise((resolve, reject) => {
            timer = setTimeout(() => {
                const error = new Error('番茄统计服务响应超时');
                error.code = 'FOCUS_STATS_TIMEOUT';
                error.details = { stage: String(stage || '').trim(), timeoutMs };
                reject(error);
                try { controller?.abort?.(); } catch (e) {}
            }, timeoutMs);
        });
        const aborted = sourceSignal ? new Promise((resolve, reject) => {
            abortHandler = () => {
                reject(__tmFocusStatsSupersededError(stage || 'aborted'));
                try { controller?.abort?.(); } catch (e) {}
            };
            sourceSignal.addEventListener?.('abort', abortHandler, { once: true });
        }) : new Promise(() => {});
        return Promise.race([pending, timeout, aborted]).finally(() => {
            if (timer !== null) clearTimeout(timer);
            if (abortHandler) sourceSignal?.removeEventListener?.('abort', abortHandler);
        });
    }

    function __tmFocusStatsSupersededError(stage) {
        const error = new Error('专注统计请求已被更新的页面状态替代');
        error.code = 'FOCUS_STATS_SUPERSEDED';
        error.details = { stage: String(stage || '').trim() };
        return error;
    }

    function __tmNormalizeFocusQueryOptions(options = {}) {
        const normalized = { ...(options && typeof options === 'object' ? options : {}) };
        const roundTime = (value, direction) => {
            const parsed = Date.parse(String(value || ''));
            if (!Number.isFinite(parsed)) return String(value || '');
            const rounded = direction === 'up'
                ? Math.ceil(parsed / 60000) * 60000
                : Math.floor(parsed / 60000) * 60000;
            return new Date(rounded).toISOString();
        };
        if (Object.prototype.hasOwnProperty.call(normalized, 'from')) normalized.from = roundTime(normalized.from, 'down');
        if (Object.prototype.hasOwnProperty.call(normalized, 'to')) normalized.to = roundTime(normalized.to, 'up');
        return normalized;
    }

    function __tmFocusQueryChannel(control = {}) {
        return String(control?.channel || 'focus').trim() || 'focus';
    }

    function __tmCleanupFocusDockQuerySlot(job) {
        const slot = __tmFocusDockQuerySlots.get(job.channel);
        if (!slot || slot.latest !== job || slot.active || slot.queued || job.consumerCount > 0) return;
        __tmFocusDockQuerySlots.delete(job.channel);
    }

    function __tmStartFocusDockQueryJob(slot, job) {
        slot.active = job;
        job.state = 'active';
        Promise.resolve()
            .then(() => {
                if (job.controller?.signal?.aborted) throw __tmFocusStatsSupersededError('dock-query-abandoned');
                return job.operation(job.controller?.signal || null);
            })
            .then(job.resolve, job.reject)
            .finally(() => {
                job.operation = null;
                job.state = 'settled';
                if (slot.active !== job) return;
                slot.active = null;
                const next = slot.queued;
                slot.queued = null;
                if (next) __tmStartFocusDockQueryJob(slot, next);
                else __tmCleanupFocusDockQuerySlot(job);
            });
    }

    function __tmScheduleFocusDockQuery(channel, key, operation) {
        let slot = __tmFocusDockQuerySlots.get(channel);
        if (!slot) {
            slot = { active: null, queued: null, latest: null };
            __tmFocusDockQuerySlots.set(channel, slot);
        }
        if (slot.latest?.key === key && slot.latest.current === true
            && slot.latest.state !== 'superseded' && slot.latest.state !== 'disposed') return slot.latest;

        if (slot.latest) slot.latest.current = false;
        if (slot.queued) {
            const replaced = slot.queued;
            slot.queued = null;
            replaced.current = false;
            replaced.state = 'superseded';
            try { replaced.controller?.abort?.(); } catch (e) {}
            replaced.reject(__tmFocusStatsSupersededError('dock-query-queued'));
        }

        let resolveJob;
        let rejectJob;
        const job = {
            channel,
            key,
            operation,
            controller: typeof AbortController === 'function' ? new AbortController() : null,
            current: true,
            state: 'queued',
            consumerCount: 0,
            promise: new Promise((resolve, reject) => {
                resolveJob = resolve;
                rejectJob = reject;
            }),
            resolve: (value) => resolveJob(value),
            reject: (error) => rejectJob(error),
        };
        slot.latest = job;
        if (slot.active) slot.queued = job;
        else __tmStartFocusDockQueryJob(slot, job);
        return job;
    }

    function __tmReleaseFocusDockQueryJob(job) {
        job.consumerCount = Math.max(0, job.consumerCount - 1);
        if (job.consumerCount === 0 && job.state === 'queued') {
            const slot = __tmFocusDockQuerySlots.get(job.channel);
            if (slot?.queued === job) {
                slot.queued = null;
                job.current = false;
                job.state = 'superseded';
                try { job.controller?.abort?.(); } catch (e) {}
                job.reject(__tmFocusStatsSupersededError('dock-query-abandoned'));
            }
        }
        if (job.consumerCount === 0 && job.state === 'active') {
            job.current = false;
            job.state = 'aborting';
            try { job.controller?.abort?.(); } catch (e) {}
        }
        __tmCleanupFocusDockQuerySlot(job);
    }

    async function __tmBuildFocusCandidateIDs(options = {}, control = {}) {
        const taskIDs = Array.isArray(options?.taskIDs)
            ? options.taskIDs
            : (Array.isArray(options?.taskIds) ? options.taskIds : null);
        const rootTaskID = String(options?.rootTaskID || options?.rootTaskId || '').trim();
        if (!taskIDs && !rootTaskID) return null;
        if (taskIDs && taskIDs.length > __TM_FOCUS_QUERY_TASK_ID_LIMIT) {
            const error = new Error('专注统计任务范围过大');
            error.code = 'FOCUS_SCOPE_TOO_LARGE';
            error.details = { taskCount: taskIDs.length, maxTaskCount: __TM_FOCUS_QUERY_TASK_ID_LIMIT };
            throw error;
        }
        let authoritativeIDs = taskIDs || [];
        if (rootTaskID) {
            const gateway = await __tmWithFocusStatsTimeout('task-resolve-focus-scope', () => (
                __tmCallTaskHorizonKernelRpc('taskHorizonResolveFocusCandidateIDs', options || {})
            ), control);
            if (!gateway?.available) {
                const error = new Error('任务统计内核暂不可用');
                error.code = 'TASK_STATS_UNAVAILABLE';
                throw error;
            }
            const resolvedIDs = Array.isArray(gateway?.data?.candidateIDs) ? gateway.data.candidateIDs : null;
            if (!resolvedIDs) {
                const error = new Error('任务统计范围响应格式不兼容');
                error.code = 'STATS_CONTRACT_MISMATCH';
                throw error;
            }
            authoritativeIDs = resolvedIDs;
        }

        const store = globalThis.__tmTaskStore;
        const out = new Set();
        const append = (value) => {
            const id = String(value || '').trim();
            if (!id) return;
            out.add(id);
            if (out.size > __TM_FOCUS_CANDIDATE_ID_LIMIT) {
                const error = new Error('专注统计候选任务范围过大');
                error.code = 'FOCUS_SCOPE_TOO_LARGE';
                error.details = { candidateCount: out.size, maxCandidateCount: __TM_FOCUS_CANDIDATE_ID_LIMIT };
                throw error;
            }
        };
        for (const value of authoritativeIDs) {
            const id = String(value || '').trim();
            if (!id) continue;
            append(id);
            let aliases = [];
            try {
                const values = store?.getAliases?.(id);
                aliases = Array.isArray(values) ? values : [];
            } catch (e) {}
            for (const alias of aliases) append(alias);
            try {
                const resolved = String(store?.resolveId?.(id) || '').trim();
                if (resolved) append(resolved);
            } catch (e) {}
        }
        return Array.from(out).sort();
    }

    function __tmBuildFocusTaskSnapshot(rawStats = null, options = {}) {
        const store = globalThis.__tmTaskStore;
        if (!store) throw new Error('任务状态仓储尚未就绪');
        const token = store.captureRead?.() || null;
        const byId = new Map();
        const taskByteLengths = new Map();
        let snapshotByteLength = 2;
        const customFieldID = String(options?.groupBy || '').trim() === 'customField'
            ? String(options?.customFieldID || options?.customFieldId || '').trim()
            : '';
        const utf8ByteLength = (value) => {
            const source = String(value == null ? '' : value);
            let bytes = 0;
            for (let index = 0; index < source.length; index += 1) {
                const code = source.charCodeAt(index);
                if (code < 0x80) bytes += 1;
                else if (code < 0x800) bytes += 2;
                else if (code >= 0xD800 && code <= 0xDBFF && index + 1 < source.length
                    && source.charCodeAt(index + 1) >= 0xDC00 && source.charCodeAt(index + 1) <= 0xDFFF) {
                    bytes += 4;
                    index += 1;
                } else bytes += 3;
            }
            return bytes;
        };
        const snapshotTooLarge = (details = {}) => {
            const error = new Error('专注统计任务快照过大');
            error.code = 'FOCUS_SCOPE_TOO_LARGE';
            error.details = {
                maxTaskCount: __TM_FOCUS_SNAPSHOT_TASK_LIMIT,
                maxSnapshotBytes: __TM_FOCUS_SNAPSHOT_BYTE_LIMIT,
                ...details,
            };
            return error;
        };
        const pendingIDs = [];
        const queuedIDs = new Set();
        const queueID = (value) => {
            const id = String(value || '').trim();
            if (!id || queuedIDs.has(id)) return;
            if (queuedIDs.size >= __TM_FOCUS_SNAPSHOT_TASK_LIMIT) {
                const error = new Error('专注统计任务快照过大');
                error.code = 'FOCUS_SCOPE_TOO_LARGE';
                error.details = { maxTaskCount: __TM_FOCUS_SNAPSHOT_TASK_LIMIT };
                throw error;
            }
            queuedIDs.add(id);
            pendingIDs.push(id);
        };
        const append = (task, rawId = '') => {
            if (!(task && typeof task === 'object')) return;
            const sourceId = String(rawId || task.id || task.blockId || '').trim();
            if (!sourceId) return;
            let projected = task;
            try { projected = store.getProjected?.(sourceId) || store.projectRead?.(task) || task; } catch (e) {}
            if (!(projected && typeof projected === 'object')) return;
            const id = String(projected.id || sourceId).trim();
            if (!id) return;
            let aliasIDs = [id, sourceId];
            try { aliasIDs = aliasIDs.concat(store.getAliases?.(id) || []); } catch (e) {}
            const snapshotTask = {
                id,
                aliasIDs: Array.from(new Set(aliasIDs.map((value) => String(value || '').trim()).filter(Boolean))),
                parentTaskID: String(projected.parentTaskId || projected.parent_task_id || '').trim(),
                documentID: String(projected.docId || projected.documentID || projected.root_id || '').trim(),
                documentName: String(projected.docName || projected.documentName || projected.doc || '').trim(),
                title: String(projected.title || projected.content || '').trim(),
                done: projected.done === true,
                customStatus: String(projected.customStatus || projected.custom_status || '').trim(),
                customStatusName: String(projected.customStatusName || '').trim(),
                priority: String(projected.priority || '').trim(),
                priorityName: String(projected.priorityName || '').trim(),
                customFieldValues: customFieldID && projected.customFieldValues && typeof projected.customFieldValues === 'object'
                    ? { [customFieldID]: projected.customFieldValues[customFieldID] }
                    : {},
                duration: projected.duration ?? projected.custom_duration,
                tomatoEstimateCount: projected.tomatoEstimateCount ?? projected.tomato_estimate_count,
                created: String(projected.created || '').trim(),
            };
            let serialized = '';
            try { serialized = JSON.stringify(snapshotTask); } catch (e) { throw snapshotTooLarge({ reason: 'not-serializable' }); }
            const taskBytes = utf8ByteLength(serialized) + 1;
            const previousBytes = taskByteLengths.get(id) || 0;
            const nextSnapshotBytes = snapshotByteLength - previousBytes + taskBytes;
            if (nextSnapshotBytes > __TM_FOCUS_SNAPSHOT_BYTE_LIMIT) {
                throw snapshotTooLarge({ taskCount: byId.size + (byId.has(id) ? 0 : 1), snapshotBytes: nextSnapshotBytes });
            }
            snapshotByteLength = nextSnapshotBytes;
            taskByteLengths.set(id, taskBytes);
            byId.set(id, snapshotTask);
            queueID(projected.parentTaskId || projected.parent_task_id);
        };
        const hasSelection = !!(rawStats && typeof rawStats === 'object')
            || Array.isArray(options?.taskIDs)
            || Array.isArray(options?.taskIds);
        if (hasSelection) {
            (Array.isArray(rawStats?.associations) ? rawStats.associations : []).forEach((association) => {
                (Array.isArray(association?.candidateIds) ? association.candidateIds : []).forEach(queueID);
            });
            (Array.isArray(options?.taskIDs) ? options.taskIDs : (Array.isArray(options?.taskIds) ? options.taskIds : [])).forEach(queueID);
            queueID(options?.rootTaskID || options?.rootTaskId);
            for (let index = 0; index < pendingIDs.length; index += 1) {
                const sourceId = pendingIDs[index];
                let resolvedId = sourceId;
                try { resolvedId = String(store.resolveId?.(sourceId) || sourceId).trim() || sourceId; } catch (e) {}
                let task = null;
                try { task = store.getProjected?.(sourceId) || store.getProjected?.(resolvedId) || store.get?.(resolvedId); } catch (e) {}
                if (task) append(task, sourceId);
            }
        } else {
            let flatTasks = [];
            let pendingTasks = [];
            try { flatTasks = store.listFlat?.() || []; } catch (e) {}
            try { pendingTasks = store.listPending?.() || []; } catch (e) {}
            flatTasks.forEach((task) => append(task));
            pendingTasks.forEach((task) => append(task));
        }
        return {
            token,
            snapshot: {
                revision: Math.max(0, Number(store.revision?.()) || 0),
                byteLength: snapshotByteLength,
                tasks: Array.from(byId.values()),
            },
        };
    }

    function __tmRequireFocusStatsContract(value) {
        if (!value || Number(value.contractVersion) !== __TM_FOCUS_STATS_CONTRACT_VERSION) {
            const error = new Error('番茄统计契约版本不兼容');
            error.code = 'STATS_CONTRACT_MISMATCH';
            throw error;
        }
        return value;
    }

    function __tmIsFocusStatisticsAvailable() {
        const dockStats = globalThis.__dockTomato?.stats;
        return Number(dockStats?.contractVersion) === __TM_FOCUS_STATS_CONTRACT_VERSION
            && typeof dockStats?.queryFocus === 'function';
    }

    function __tmRequireCompatibleDockStats(method) {
        const dockStats = globalThis.__dockTomato?.stats;
        if (!dockStats || typeof dockStats[method] !== 'function') {
            const error = new Error('底栏番茄钟统计服务未加载');
            error.code = 'DOCK_TOMATO_STATS_UNAVAILABLE';
            throw error;
        }
        if (Number(dockStats.contractVersion) !== __TM_FOCUS_STATS_CONTRACT_VERSION) {
            const error = new Error('番茄统计契约版本不兼容');
            error.code = 'STATS_CONTRACT_MISMATCH';
            throw error;
        }
        return dockStats;
    }

    function __tmLeaseFocusDockQuery(key, entry) {
        let released = false;
        entry.consumerCount += 1;
        entry.job.consumerCount += 1;
        return {
            promise: entry.promise,
            isCurrent: () => entry.job.current === true,
            release: () => {
                if (released) return;
                released = true;
                entry.consumerCount = Math.max(0, entry.consumerCount - 1);
                __tmReleaseFocusDockQueryJob(entry.job);
                if (entry.consumerCount === 0 && __tmFocusDockQueryInflight.get(key) === entry) {
                    __tmFocusDockQueryInflight.delete(key);
                }
            },
        };
    }

    async function __tmQueryDockFocusStatistics(dockStats, options, control) {
        const generatedDeadlineAt = Date.now() + Math.max(1, __tmResolveFocusStatsTimeoutMs() - 250);
        const requestedDeadlineAt = Math.max(0, Number(options?.deadlineAt) || 0);
        const rawOptions = {
            from: String(options?.from || ''),
            to: String(options?.to || ''),
            bucket: String(options?.bucket || 'none'),
            deadlineAt: requestedDeadlineAt > 0 ? Math.min(requestedDeadlineAt, generatedDeadlineAt) : generatedDeadlineAt,
        };
        const candidateIDs = await __tmBuildFocusCandidateIDs(
            { ...options, deadlineAt: rawOptions.deadlineAt },
            { signal: control?.signal },
        );
        if (candidateIDs !== null) {
            rawOptions.candidateIDs = candidateIDs;
            rawOptions.candidateIDsConstrainTotals = true;
        }
        const channel = __tmFocusQueryChannel(control);
        const projectionKey = [
            String(options?.groupBy || 'task'),
            String(options?.rootTaskID || options?.rootTaskId || ''),
            String(options?.customFieldID || options?.customFieldId || ''),
        ].join('\n');
        const candidateKey = candidateIDs === null ? '*' : candidateIDs.join(',');
        const key = `${channel}\n${rawOptions.from}\n${rawOptions.to}\n${rawOptions.bucket}\n${candidateKey}\n${rawOptions.candidateIDsConstrainTotals === true ? 1 : 0}\n${projectionKey}`;
        const existing = __tmFocusDockQueryInflight.get(key);
        if (existing) return __tmLeaseFocusDockQuery(key, existing);
        const job = __tmScheduleFocusDockQuery(channel, key, (signal) => __tmWithFocusStatsTimeout(
            'dock-query-focus',
            (operationSignal) => dockStats.queryFocus(rawOptions, { signal: operationSignal }),
            { signal },
        ));
        const entry = {
            promise: job.promise,
            consumerCount: 0,
            job,
        };
        __tmFocusDockQueryInflight.set(key, entry);
        return __tmLeaseFocusDockQuery(key, entry);
    }

    async function __tmProjectFocusStatsThroughKernel(rawStats, options, snapshot, control = {}) {
        const gateway = await __tmWithFocusStatsTimeout('task-project-focus', () => (
            __tmCallTaskHorizonKernelRpc('taskHorizonProjectFocusStatistics', rawStats, options || {}, snapshot || {})
        ), control);
        if (!gateway?.available) {
            const error = new Error('任务统计内核暂不可用');
            error.code = 'TASK_STATS_UNAVAILABLE';
            throw error;
        }
        return __tmRequireFocusStatsContract(gateway.data);
    }

    async function __tmQueryFocusStatistics(options = {}, control = {}) {
        const normalizedOptions = __tmNormalizeFocusQueryOptions(options);
        const generatedDeadlineAt = Date.now() + Math.max(1, __tmResolveFocusStatsTimeoutMs() - 250);
        const requestedDeadlineAt = Math.max(0, Number(normalizedOptions.deadlineAt) || 0);
        normalizedOptions.deadlineAt = requestedDeadlineAt > 0
            ? Math.min(requestedDeadlineAt, generatedDeadlineAt)
            : generatedDeadlineAt;
        const dockStats = __tmRequireCompatibleDockStats('queryFocus');
        const signal = control?.signal || null;
        const throwIfSuperseded = (stage) => {
            if (signal?.aborted) throw __tmFocusStatsSupersededError(stage);
            const viewCurrent = typeof control?.isCurrent !== 'function' || control.isCurrent() !== false;
            const queryCurrent = !dockQueryLease || dockQueryLease.isCurrent();
            if (viewCurrent && queryCurrent) return;
            throw __tmFocusStatsSupersededError(stage);
        };
        let rawStats = null;
        let dockQueryLease = null;
        let abortHandler = null;
        try {
            if (signal) {
                abortHandler = () => dockQueryLease?.release();
                signal.addEventListener?.('abort', abortHandler, { once: true });
            }
            for (let attempt = 0; attempt < 2; attempt += 1) {
                throwIfSuperseded('before-dock-query');
                if (!rawStats) {
                    const query = await __tmQueryDockFocusStatistics(dockStats, normalizedOptions, control);
                    dockQueryLease = query;
                    rawStats = __tmRequireFocusStatsContract(await __tmWithFocusStatsTimeout(
                        'dock-query-consumer',
                        () => query.promise,
                        { signal },
                    ));
                }
                throwIfSuperseded('before-task-projection');
                const { token, snapshot } = __tmBuildFocusTaskSnapshot(rawStats, normalizedOptions);
                throwIfSuperseded('before-task-projection');
                const projected = await __tmProjectFocusStatsThroughKernel(
                    rawStats,
                    normalizedOptions,
                    snapshot,
                    { signal },
                );
                throwIfSuperseded('after-task-projection');
                if (!token || globalThis.__tmTaskStore?.isReadCurrent?.(token) === true) {
                    return projected;
                }
            }
            const error = new Error('任务结构在统计期间发生变化');
            error.code = 'STALE_TASK_SNAPSHOT';
            throw error;
        } finally {
            if (abortHandler) signal?.removeEventListener?.('abort', abortHandler);
            dockQueryLease?.release();
        }
    }

    async function __tmQueryRoutineStatistics(options = {}) {
        const dockStats = __tmRequireCompatibleDockStats('queryRoutine');
        return __tmRequireFocusStatsContract(await __tmWithFocusStatsTimeout(
            'dock-query-routine',
            () => dockStats.queryRoutine(options),
        ));
    }

    async function __tmListFocusSessions(options = {}) {
        const dockStats = __tmRequireCompatibleDockStats('listSessions');
        return __tmRequireFocusStatsContract(await __tmWithFocusStatsTimeout(
            'dock-list-sessions',
            () => dockStats.listSessions(options),
        ));
    }

    function __tmDisposeFocusStatisticsService() {
        const jobs = new Set();
        __tmFocusDockQuerySlots.forEach((slot) => {
            if (slot?.active) jobs.add(slot.active);
            if (slot?.queued) jobs.add(slot.queued);
            if (slot?.latest) jobs.add(slot.latest);
            if (slot) {
                slot.active = null;
                slot.queued = null;
                slot.latest = null;
            }
        });
        jobs.forEach((job) => {
            if (!job || job.state === 'settled' || job.state === 'disposed') return;
            job.current = false;
            job.state = 'disposed';
            try { job.controller?.abort?.(); } catch (e) {}
            try { job.reject(__tmFocusStatsSupersededError('service-dispose')); } catch (e) {}
        });
        __tmFocusDockQuerySlots.clear();
        __tmFocusDockQueryInflight.clear();
        return jobs.size;
    }

    globalThis.__tmFocusStatisticsService = {
        contractVersion: __TM_FOCUS_STATS_CONTRACT_VERSION,
        isAvailable: __tmIsFocusStatisticsAvailable,
        buildTaskSnapshot: __tmBuildFocusTaskSnapshot,
        queryFocus: __tmQueryFocusStatistics,
        queryRoutine: __tmQueryRoutineStatistics,
        listSessions: __tmListFocusSessions,
        project: __tmProjectFocusStatsThroughKernel,
        dispose: __tmDisposeFocusStatisticsService,
    };
