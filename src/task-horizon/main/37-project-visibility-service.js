    // Own the existing homepage settings document so layout saves and project
    // completion changes cannot overwrite each other. Task data stays untouched.
    const __tmProjectVisibility = (() => {
        const storageKey = 'homepage-settings.json';
        let settings = null;
        let loading = null;
        let writes = Promise.resolve();
        let revision = 0;
        let hasCompletions = false;
        let headingCompletions = false;
        let calendarTasks = null;
        let calendarTaskCount = 0;
        let calendarTaskMap = new Map();

        const normalize = (value) => {
            let source = value;
            if (typeof source === 'string') {
                try { source = JSON.parse(source); } catch (e) { source = null; }
            }
            source = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
            const completedProjects = {};
            Object.entries(source.completedProjects || {}).forEach(([key, completed]) => {
                if (/^(doc|heading):.+/.test(key) && key.length <= 320 && completed === true) completedProjects[key] = true;
            });
            return { ...source, completedProjects };
        };
        const snapshot = () => JSON.parse(JSON.stringify(settings || { completedProjects: {} }));
        const accept = (value) => {
            const next = normalize(value);
            const before = Object.keys(settings?.completedProjects || {}).sort().join('\n');
            const after = Object.keys(next.completedProjects).sort().join('\n');
            settings = next;
            hasCompletions = Object.keys(next.completedProjects).length > 0;
            headingCompletions = Object.keys(next.completedProjects).some((key) => key.startsWith('heading:'));
            if (before !== after) revision += 1;
        };
        const load = (force = false) => {
            if (loading) return loading;
            if (!force && settings) return Promise.resolve(snapshot());
            loading = writes.then(async () => {
                const host = globalThis.__tmHost;
                if (typeof host?.loadData !== 'function') throw new Error('项目状态存储不可用');
                accept(await host.loadData(storageKey, {}));
                return snapshot();
            }).finally(() => { loading = null; });
            return loading;
        };
        const write = async (update) => {
            await load();
            const pending = writes.then(async () => {
                const next = normalize(update(snapshot()));
                const host = globalThis.__tmHost;
                if (typeof host?.saveData !== 'function' || await host.saveData(storageKey, next) === false) {
                    throw new Error('项目状态保存失败，请重试');
                }
                accept(next);
                return snapshot();
            });
            writes = pending.catch(() => {});
            return pending;
        };
        const isCompleted = (kind, id) => settings?.completedProjects?.[`${kind}:${String(id || '').trim()}`] === true;
        const hasHeadingCompletions = () => headingCompletions;
        const resolveTask = (id, taskMap) => {
            if (!id) return null;
            const live = globalThis.__tmTaskStore?.getProjected?.(id)
                || (taskMap instanceof Map ? taskMap.get(id) : taskMap?.[id])
                || (typeof state !== 'undefined' ? state.flatTasks?.[id] : null);
            if (live) return live;
            const cached = globalThis.__tmCalendarAllTasksCache?.tasks;
            if (Array.isArray(cached) && (cached !== calendarTasks || cached.length !== calendarTaskCount)) {
                calendarTasks = cached;
                calendarTaskCount = cached.length;
                calendarTaskMap = new Map(cached.map((task) => [String(task?.id || '').trim(), task]));
            }
            return Array.isArray(cached) ? calendarTaskMap.get(id) || null : null;
        };
        const isTaskHidden = (task, taskMap = null) => {
            if (!task || !hasCompletions) return false;
            const initial = typeof task === 'string' ? resolveTask(task, taskMap) : task;
            if (!initial) return false;
            const stack = [initial];
            const seen = new Set();
            while (stack.length) {
                const current = stack.pop();
                if (!current || seen.has(current)) continue;
                seen.add(current);
                const id = String(current.id || '').trim();
                if (id && seen.has(id)) continue;
                if (id) seen.add(id);
                const live = resolveTask(id, taskMap);
                const item = live || current;
                const docId = String(item.root_id || item.docId || item.documentID || '').trim();
                const headingId = String(item.h2Id || '').trim();
                if (isCompleted('doc', docId) || (headingId && isCompleted('heading', headingId))) return true;
                if (docId && !headingId && !String(item.h2 || '').trim() && isCompleted('heading', `no-h2:${docId}`)) return true;
                const parentId = String(item.parentTaskId || item.parent_task_id || '').trim();
                const sourceId = String(item.recurringSourceTaskId || item.sourceTaskId || '').trim();
                if (parentId) stack.push(resolveTask(parentId, taskMap));
                if (sourceId && sourceId !== id) stack.push(resolveTask(sourceId, taskMap));
            }
            return false;
        };
        const filterTasks = (tasks) => {
            const list = Array.isArray(tasks) ? tasks : [];
            if (!hasCompletions) return list;
            const taskMap = new Map(list.map((task) => [String(task?.id || '').trim(), task]));
            return list.filter((task) => !isTaskHidden(task, taskMap));
        };

        return {
            load,
            getSettings: snapshot,
            getRevision: () => revision,
            isCompleted,
            hasHeadingCompletions,
            isTaskHidden,
            filterTasks,
            async prepareTaskHeadings(tasks) {
                if (!headingCompletions || !Array.isArray(tasks) || !tasks.length) return;
                const { taskIds, taskDocMap } = __tmCollectTaskEnhanceTargets(tasks);
                const bundle = await API.fetchTaskEnhanceBundle(taskIds, { taskDocMap, needH2: true, needFlow: false });
                tasks.forEach((task) => {
                    const id = String(task?.recurringSourceTaskId || task?.sourceTaskId || task?.id || '').trim();
                    const context = bundle?.h2ContextMap?.get(id);
                    if (context !== undefined) __tmApplyTaskHeadingContext(task, context);
                });
            },
            saveSettings(patch) {
                // Homepage layout updates cannot replace the authoritative flags.
                const { completedProjects, ...layout } = normalize(patch);
                return write((current) => ({ ...current, ...layout }));
            },
            async setCompleted(kind, id, completed) {
                const entityId = String(id || '').trim();
                if (!entityId || !['doc', 'heading'].includes(kind)) throw new Error('无效的项目卡片');
                await write((current) => {
                    const next = { ...current.completedProjects };
                    const key = `${kind}:${entityId}`;
                    if (completed === true) next[key] = true;
                    else delete next[key];
                    return { ...current, completedProjects: next };
                });
                globalThis.__tmRecomputeTaskProjection?.({ reason: 'project-completion' });
                try { globalThis.__tmCalendar?.requestRefresh?.({ reason: 'project-completion', main: true, side: true, flushTaskPanel: true }); } catch (e) {}
                return isCompleted(kind, entityId);
            },
        };
    })();
    globalThis.__tmProjectVisibility = __tmProjectVisibility;
