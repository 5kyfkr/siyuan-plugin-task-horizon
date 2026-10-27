    (function () {
        const ns = globalThis.__tmTaskBoundary || {};

        const callLocal = (name, args) => {
            try {
                if (name === 'loadSnapshotForScope' && typeof __tmLoadTaskSnapshotForScope === 'function') {
                    return __tmLoadTaskSnapshotForScope(...args);
                }
                if (name === 'readTaskIndexForScope' && typeof __tmReadTaskIndexForScope === 'function') {
                    return __tmReadTaskIndexForScope(...args);
                }
                if (name === 'loadLatestSnapshotForGroup' && typeof __tmLoadLatestTaskSnapshotForGroup === 'function') {
                    return __tmLoadLatestTaskSnapshotForGroup(...args);
                }
                if (name === 'refreshSnapshotCacheIfChanged' && typeof __tmRefreshTaskSnapshotStoreCacheIfChanged === 'function') {
                    return __tmRefreshTaskSnapshotStoreCacheIfChanged(...args);
                }
                if (name === 'warmSnapshotStore' && typeof __tmScheduleWarmTaskSnapshotStore === 'function') {
                    return __tmScheduleWarmTaskSnapshotStore(...args);
                }
                if (name === 'restoreSnapshotIntoState' && typeof __tmRestoreTaskSnapshotIntoState === 'function') {
                    return __tmRestoreTaskSnapshotIntoState(...args);
                }
                if (name === 'restoreSnapshotViewState' && typeof __tmRestoreTaskSnapshotViewState === 'function') {
                    return __tmRestoreTaskSnapshotViewState(...args);
                }
                if (name === 'schedulePersistSnapshot' && typeof __tmSchedulePersistTaskSnapshot === 'function') {
                    return __tmSchedulePersistTaskSnapshot(...args);
                }
                if (name === 'scheduleSnapshotAfterLocalPatch' && typeof __tmScheduleTaskSnapshotAfterLocalPatch === 'function') {
                    return __tmScheduleTaskSnapshotAfterLocalPatch(...args);
                }
                if (name === 'scheduleSnapshotAfterLocalStructurePatch' && typeof __tmScheduleTaskSnapshotAfterLocalStructurePatch === 'function') {
                    return __tmScheduleTaskSnapshotAfterLocalStructurePatch(...args);
                }
            } catch (e) {}
            return undefined;
        };

        const snapshot = {
            load: (...args) => callLocal('loadSnapshotForScope', args),
            readTaskIndex: (...args) => callLocal('readTaskIndexForScope', args),
            loadLatestForGroup: (...args) => callLocal('loadLatestSnapshotForGroup', args),
            refreshCache: (...args) => callLocal('refreshSnapshotCacheIfChanged', args),
            warm: (...args) => callLocal('warmSnapshotStore', args),
            restore: (...args) => callLocal('restoreSnapshotIntoState', args),
            restoreViewState: (...args) => callLocal('restoreSnapshotViewState', args),
            schedulePersist: (...args) => callLocal('schedulePersistSnapshot', args),
            scheduleAfterLocalPatch: (...args) => callLocal('scheduleSnapshotAfterLocalPatch', args),
            scheduleAfterLocalStructurePatch: (...args) => callLocal('scheduleSnapshotAfterLocalStructurePatch', args),
        };

        const getTask = (taskId, options = {}) => {
            const id = String(taskId || '').trim();
            if (!id) return null;
            return globalThis.__tmTaskStore?.get?.(id, {
                includePending: options?.includePending !== false,
                preferPending: options?.preferPending !== false,
            }) || null;
        };

        const isTaskCompleted = (task) => {
            if (!(task && typeof task === 'object')) return false;
            try {
                if (typeof __tmIsTaskDoneEffective === 'function') {
                    return __tmIsTaskDoneEffective(task) === true;
                }
            } catch (e) {}
            return task.done === true;
        };

        globalThis.__tmTaskSnapshotService = snapshot;
        globalThis.__tmTaskBoundary = {
            ...ns,
            snapshot,
            get taskStore() { return globalThis.__tmTaskStore || null; },
            get mutationBus() { return globalThis.__tmTaskMutationBus || null; },
            get mutation() { return globalThis.__tmTaskMutations || null; },
            getTaskStore: () => globalThis.__tmTaskStore || null,
            getMutationBus: () => globalThis.__tmTaskMutationBus || null,
            getMutation: () => globalThis.__tmTaskMutations || null,
            getSnapshotService: () => globalThis.__tmTaskSnapshotService || snapshot,
            getTask,
            isTaskCompleted,
        };
    })();

    // Public plugin contract. Keep external DTOs and lifecycle separate from task storage.
    const __tmPublicApiRuntime = (() => {
        let owner = null;
        let facade = null;
        let widgetHost = null;
        let unregisterWidget = null;
        let discoveryTimer = null;
        const completionKeys = new Set();
        const reads = new Map();
        const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
        const ready = async () => {
            const current = facade;
            if (!owner) fail('UNAVAILABLE', 'Task Horizon 已卸载');
            await __tmEnsureSettingsLoaded();
            if (!owner || current !== facade) fail('UNAVAILABLE', 'Task Horizon 已卸载');
        };
        const tagsFor = (task) => Array.from(new Set([
            ...(Array.isArray(task.tags) ? task.tags.filter((tag) => typeof tag === 'string') : []),
            ...Array.from(String(task.markdown ? __tmExtractTaskOwnContentLine(task.markdown) : task.content || task.raw_content || '')
                .matchAll(/(?:^|[\s(])#([\p{L}\p{N}_/-]+)#?/gu), (match) => match[1]),
        ].map((tag) => tag.replace(/^#|#$/g, '').trim()).filter(Boolean))).slice(0, 50);
        const completed = (task, date) => __tmIsCheckinTask(task)
            ? __tmIsTaskCheckinChecked(task, date)
            : globalThis.__tmTaskProjectionEngine.isTaskCompleted(task);
        const project = (task, date) => ({
            id: String(task.id), blockId: String(task.id),
            title: String(task.content || task.raw_content || ''),
            docId: String(task.root_id || task.docId || ''),
            status: __tmResolveTaskStatusId(task),
            done: completed(task, date),
            priority: String(task.priority || 'none'),
            startDate: String(task.startDate || ''), completionTime: String(task.completionTime || ''),
            tags: tagsFor(task),
        });

        async function queryTasks(options = {}) {
            const current = facade;
            await ready();
            if (current !== facade) fail('UNAVAILABLE', 'Task Horizon 已卸载');
            if (!options || typeof options !== 'object' || Array.isArray(options)) fail('INVALID_ARGUMENT', '查询参数必须是对象');
            const { date, scope = 'current', limit = 50, includeCompleted = false } = options;
            if (!['current', 'all'].includes(scope) || !Number.isInteger(limit) || limit < 1 || limit > 100
                || typeof includeCompleted !== 'boolean') fail('INVALID_ARGUMENT', '任务范围或数量无效（limit: 1–100）');
            let now = new Date();
            if (date !== undefined && date !== 'today') {
                if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('INVALID_ARGUMENT', '日期格式应为 YYYY-MM-DD');
                const [year, month, day] = date.split('-').map(Number);
                now = new Date(year, month - 1, day);
                if (now.getFullYear() !== year || now.getMonth() !== month - 1 || now.getDate() !== day) fail('INVALID_ARGUMENT', '日期无效');
            }
            const groupId = scope === 'all' ? 'all' : String(SettingsStore.data.currentGroupId || 'all');
            const key = JSON.stringify([groupId, date ?? '', now.toDateString(), limit, includeCompleted]);
            if (reads.has(key)) return reads.get(key).then((result) => structuredClone(result));
            const request = (async () => {
                const docIds = await resolveDocIdsFromGroups({ groupId });
                if (!owner || current !== facade) fail('UNAVAILABLE', 'Task Horizon 已卸载');
                const tasks = new Map();
                let partial = false;
                for (let offset = 0; offset < docIds.length; offset += 12) {
                    const result = await API.getTasksByDocuments(docIds.slice(offset, offset + 12), __TM_TASK_INDEX_QUERY_LIMIT, {
                        ignoreExcludeCompleted: true, customFieldIds: [],
                    });
                    if (!owner || current !== facade) fail('UNAVAILABLE', 'Task Horizon 已卸载');
                    if (result?.readFailure || !Array.isArray(result?.tasks)) fail('READ_FAILED', '任务读取失败');
                    partial ||= result.limitReached === true;
                    for (const row of result.tasks) {
                        const task = { ...row };
                        if (task.markdown) Object.assign(task, API.parseTaskStatus(task.markdown));
                        MetaStore.applyToTask(task);
                        normalizeTaskFields(task, String(task.doc_name || task.docName || ''));
                        const projected = globalThis.__tmTaskStore.projectRead(task);
                        if (projected && !globalThis.__tmProjectVisibility?.isTaskHidden(projected)) tasks.set(projected.id, projected);
                    }
                }
                if (!owner || current !== facade) fail('UNAVAILABLE', 'Task Horizon 已卸载');
                const rule = {
                    conditions: date === undefined ? [] : [{ field: 'taskDate', operator: 'range_overlap_today', value: '' }],
                    sort: [{ field: 'priority', order: 'desc' }, { field: 'completionTime', order: 'asc' }],
                };
                const eligible = Array.from(tasks.values()).filter((task) => includeCompleted
                    || (!__tmIsTaskCanceled(task) && !completed(task, now)));
                const matched = RuleManager.applyRuleSort(RuleManager.applyRuleFilter(eligible, rule, { nowDate: now }), rule);
                return { tasks: matched.slice(0, limit).map((task) => project(task, now)), total: matched.length,
                    partial, truncated: partial || matched.length > limit };
            })();
            reads.set(key, request);
            try { return structuredClone(await request); }
            finally { if (reads.get(key) === request) reads.delete(key); }
        }

        async function setTaskStatus(blockId, status) {
            const current = facade;
            await ready();
            if (current !== facade) fail('UNAVAILABLE', 'Task Horizon 已卸载');
            if (typeof blockId !== 'string' || !/^\d{14}-[a-z0-9]{7}$/i.test(blockId)) fail('INVALID_ARGUMENT', '任务块 ID 无效');
            const option = typeof status === 'string' ? __tmFindStatusOptionById(status) : null;
            if (!option) fail('INVALID_ARGUMENT', '未知的任务状态');
            const task = await __tmEnsureTaskInStateById(blockId);
            if (!owner || current !== facade) fail('UNAVAILABLE', 'Task Horizon 已卸载');
            if (!task) fail('NOT_FOUND', '未找到任务');
            const opts = { wait: true, source: 'public-api', fsrsRating: 3, statusPatch: { customStatus: option.id } };
            const done = __tmDoesStatusIdResolveToDone(option.id);
            const checkboxState = done || option.marker === ' ';
            const mutation = globalThis.__tmRequireTaskMutation(checkboxState ? 'setDone' : 'setStatus');
            const result = await mutation(blockId, checkboxState ? done : option.id, opts);
            if (!result) fail('WRITE_FAILED', '任务状态未保存');
            return true;
        }

        async function openView(viewType = 'list') {
            const current = facade;
            await ready();
            if (current !== facade) fail('UNAVAILABLE', 'Task Horizon 已卸载');
            if (!['list', 'checklist', 'timeline', 'kanban', 'calendar', 'whiteboard'].includes(viewType)) fail('INVALID_ARGUMENT', '未知的任务视图');
            if (!__tmIsViewEnabled(viewType)) fail('INVALID_ARGUMENT', '该任务视图已停用');
            if (await globalThis.__taskHorizonOpenManagerFromTopbarEntry({ awaitInitialLoad: true, source: 'public-api' }) === false) {
                fail('UNAVAILABLE', '任务视界暂时无法打开');
            }
            if (!owner || current !== facade) fail('UNAVAILABLE', 'Task Horizon 已卸载');
            await window.tmSwitchViewMode(viewType);
            return true;
        }

        function syncWidget() {
            if (!owner || !facade) return;
            const plugins = owner.app?.plugins;
            const host = (Array.isArray(plugins) ? plugins : Object.values(plugins || {}))
                .find((plugin) => plugin?.name === 'siyuan-speed-switch' && typeof plugin.registerHomeModule === 'function');
            if (host === widgetHost) return;
            try { unregisterWidget?.(); } catch (e) {}
            widgetHost = null;
            unregisterWidget = null;
            if (!host) return;
            const api = facade;
            try {
                const unregister = host.registerHomeModule({
                    moduleId: 'task-horizon-today', title: 'Task Horizon 今日任务', icon: 'iconTaskHorizon',
                    description: '当前任务分组中覆盖今天的待办，点击打开原生任务块',
                    supportedDevices: ['desktop', 'sidebar', 'mobile'], sizes: ['small', 'medium', 'tall'],
                    source: { pluginId: 'siyuan-plugin-task-horizon', name: 'Task Horizon' },
                    timeoutMs: 5000, cacheTtlMs: 1000,
                    read: async () => {
                        const result = await api.queryTasks({ date: 'today', limit: 5 });
                        return {
                            title: '今日任务', stat: { value: `${result.partial ? '≥' : ''}${result.total}`, label: '待办' },
                            items: result.tasks.map((task) => ({ label: task.title, value: task.id, secondary: task.completionTime })),
                            updatedAt: Date.now(),
                        };
                    },
                    open: () => api.openView('list'),
                });
                if (typeof unregister === 'function') { widgetHost = host; unregisterWidget = unregister; }
            } catch (error) { console.warn('[task-horizon] widget registration failed', error); }
        }

        function cleanup(plugin) {
            if (plugin && owner !== plugin) return;
            owner = null;
            clearTimeout(discoveryTimer);
            discoveryTimer = null;
            window.removeEventListener('focus', syncWidget);
            window.removeEventListener('tm:task-horizon-host-lifecycle', syncWidget);
            try { unregisterWidget?.(); } catch (e) {}
            unregisterWidget = null;
            widgetHost = null;
            if (window.TaskHorizon === facade) delete window.TaskHorizon;
            facade = null;
            completionKeys.clear();
            reads.clear();
        }

        function install(plugin) {
            if (owner === plugin && facade && window.TaskHorizon === facade) { syncWidget(); return true; }
            if (owner) cleanup(owner);
            if (window.TaskHorizon) return false;
            owner = plugin;
            const current = () => owner === plugin && window.TaskHorizon === api;
            const call = (fn, ...args) => current() ? fn(...args) : Promise.reject(Object.assign(new Error('Task Horizon 已卸载'), { code: 'UNAVAILABLE' }));
            const api = Object.freeze({
                protocol: 'task-horizon', apiVersion: 1,
                get version() { return String(globalThis.__taskHorizonPluginManifest?.version || plugin.manifest?.version || ''); },
                capabilities: Object.freeze(['tasks.query', 'tasks.status.write', 'views.open', 'events.completed']),
                isReady: () => current() && SettingsStore.loaded === true,
                whenReady: async () => { if (!current()) return false; await __tmEnsureSettingsLoaded(); return current(); },
                queryTasks: (options) => call(queryTasks, options),
                getTodayTasks: () => call(queryTasks, { date: 'today', limit: 10 }).then((result) => result.tasks),
                getStatusOptions: () => current() ? __tmGetStatusOptions().map(({ id, name, marker }) => ({ id, name, marker })) : [],
                setTaskStatus: (id, status) => call(setTaskStatus, id, status),
                openView: (viewType) => call(openView, viewType),
            });
            Object.defineProperty(window, 'TaskHorizon', { value: api, writable: false, configurable: true });
            facade = api;
            window.addEventListener('focus', syncWidget);
            window.addEventListener('tm:task-horizon-host-lifecycle', syncWidget);
            syncWidget();
            // Only inspect plugin identities, never poll task data. This also
            // handles enabling/reloading Raikiri later in the same window.
            const discover = () => {
                if (!current()) return;
                syncWidget();
                discoveryTimer = setTimeout(discover, 3000);
            };
            discoveryTimer = setTimeout(discover, 3000);
            return true;
        }

        function notifyCompleted(task, receipt, source = '') {
            if (!owner || !receipt?.completedOccurrence || receipt.outcome === 'alreadyApplied') return false;
            // Reconciliation and undo repair history; they are not a new user completion.
            if (/reconcile|^auto-|^undo|^redo|^task-repeat-native-reset$|^native-doc-checkbox-status-sync$/.test(String(source))
                || (typeof __tmUndoState !== 'undefined' && __tmUndoState.applying === true)) return false;
            const id = String(receipt.taskId || task?.id || '');
            const completedAt = Date.parse(receipt.completedAt);
            if (!id || !Number.isFinite(completedAt)) return false;
            const operationId = String(receipt.operationId || receipt.completionId || `${id}:${receipt.completedAt}`);
            const key = `${id}:${operationId}`;
            if (completionKeys.has(key)) return false;
            completionKeys.add(key);
            if (completionKeys.size > 1024) completionKeys.delete(completionKeys.values().next().value);
            try {
                window.dispatchEvent(new CustomEvent('tm:task-completed', { detail: Object.freeze({
                    id, blockId: id, title: String(task?.content || task?.raw_content || ''),
                    docId: String(task?.root_id || task?.docId || ''), completedAt,
                    tags: Object.freeze(tagsFor(task || {})), operationId,
                    occurrenceId: String(receipt.occurrenceId || ''), source: String(source || ''),
                }) }));
                return true;
            } catch (e) { return false; }
        }
        return Object.freeze({ install, cleanup, syncWidget, notifyCompleted });
    })();
    globalThis.__tmPublicApiRuntime = __tmPublicApiRuntime;
