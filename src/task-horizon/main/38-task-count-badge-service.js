    // One count per window, shared by the native topbar and Dock. No task mirror
    // or persistent count cache: SiYuan reads and the existing TaskStore own data.
    function __tmNormalizeTaskCountBadge(input) {
        const src = input && typeof input === 'object' ? input : {};
        return {
            enabled: src.enabled === true,
            topbar: src.topbar !== false,
            dock: src.dock !== false,
            ruleId: String(src.ruleId || 'default_today').trim(),
            unfinishedOnly: src.unfinishedOnly !== false,
            scope: src.scope === 'group' ? 'group' : 'all',
            groupId: String(src.groupId || '').trim(),
            hideZero: src.hideZero !== false,
        };
    }

    const __tmTaskCountBadge = (() => {
        let active = false;
        let signature = '';
        let config = __tmNormalizeTaskCountBadge();
        let rule = null;
        let scopeIds = new Set();
        // Retain only identities and membership, never a second copy of tasks.
        let members = new Map();
        let count = 0;
        let result = { status: 'disabled', count: 0, label: '', message: '' };
        let generation = 0;
        let running = false;
        let pendingFull = false;
        let refreshTimer = null;
        let midnightTimer = null;
        let mountTimer = null;
        let mountAttempts = 0;
        let unsubscribe = null;
        let lastVerifiedAt = 0;
        const dirtyDocs = new Set();
        const incompleteDocs = new Set();
        const disposers = [];

        const listen = (target, name, handler) => {
            target.addEventListener(name, handler);
            disposers.push(() => target.removeEventListener(name, handler));
        };
        const ruleFor = (cfg) => (SettingsStore.data.filterRules || []).find((item) => item?.id === cfg.ruleId);
        const isEnabled = (cfg) => cfg.enabled && (cfg.topbar || cfg.dock);
        const labelFor = () => String(rule?.name || '任务数量');
        const yieldWork = () => new Promise((resolve) => setTimeout(resolve, 0));
        const eligible = (task) => {
            if (!task || !scopeIds.has(String(task.root_id || task.docId || ''))) return false;
            if (globalThis.__tmProjectVisibility?.isTaskHidden(task)) return false;
            if (config.unfinishedOnly && (__tmIsTaskCanceled(task)
                || globalThis.__tmTaskProjectionEngine.isTaskCompleted(task))) return false;
            return true;
        };
        const matches = (task) => eligible(task) && RuleManager.applyRuleFilter([task], rule).length > 0;
        const normalize = (row) => {
            // Snapshot rows may contain whole subtrees. Project scalar fields
            // once, retaining children only for rules that derive parent scores.
            const { children, ...task } = row;
            if (task.markdown) {
                const parsed = API.parseTaskStatus(task.markdown);
                task.done = parsed.done;
                task.content = parsed.content;
            }
            MetaStore.applyToTask(task);
            normalizeTaskFields(task, String(task.docName || task.doc_name || '未命名文档'));
            const projected = globalThis.__tmTaskStore?.projectRead?.(task) || task;
            if (Array.isArray(children)) projected.children = children;
            return projected;
        };
        const flatten = (tree) => {
            const out = [];
            const visit = (tasks) => (tasks || []).forEach((task) => {
                out.push(task);
                visit(task.children);
            });
            (tree || []).forEach((doc) => visit(doc.tasks));
            return out;
        };

        function render() {
            const plugin = globalThis.__taskHorizonPluginInstance;
            const mobile = __tmIsRuntimeMobileClient();
            const topbars = mobile ? Array.from(document.querySelectorAll('[data-task-horizon-topbar="1"]')) : [plugin?._taskWindowTopBarElement].filter(Boolean);
            const dockIcons = document.querySelectorAll('.dock__item[data-type="::task-horizon-dock"], .dock__item[data-type="siyuan-plugin-task-horizon::task-horizon-dock"], [data-mobile-plugin-dock-tab="siyuan-plugin-task-horizon::task-horizon-dock"], [data-type="sidebar-siyuan-plugin-task-horizon::task-horizon-dock-tab"]');
            const targets = [...topbars, ...dockIcons].filter((el) => el?.isConnected);
            for (const el of targets) {
                const showHere = active && (topbars.includes(el) ? config.topbar : config.dock);
                const usable = result.status === 'ready' || result.status === 'partial';
                const visible = showHere && usable && (result.count > 0 || !config.hideZero);
                let badge = el.querySelector('.tm-task-count-badge');
                if (!showHere) {
                    badge?.remove();
                    el.classList.remove('tm-task-count-badge-host');
                    if (el.dataset.tmTaskCountOriginalLabel !== undefined) {
                        el.setAttribute('aria-label', el.dataset.tmTaskCountOriginalLabel);
                        delete el.dataset.tmTaskCountOriginalLabel;
                    }
                    if (el.dataset.tmTaskCountOriginalTitle !== undefined) {
                        el.setAttribute('title', el.dataset.tmTaskCountOriginalTitle);
                        delete el.dataset.tmTaskCountOriginalTitle;
                    }
                    continue;
                }
                if (!badge && visible) {
                    badge = document.createElement('span');
                    badge.className = 'tm-task-count-badge';
                    badge.setAttribute('aria-hidden', 'true');
                    el.appendChild(badge);
                    el.classList.add('tm-task-count-badge-host');
                }
                const text = result.count > 99 ? '99+' : String(result.count);
                const tooltip = `${result.label}：${usable ? result.count + ' 项' : result.message}${result.status === 'partial' ? '（统计不完整）' : ''}`;
                if (badge) {
                    if (badge.textContent !== text) badge.textContent = text;
                    badge.hidden = !visible;
                    badge.title = tooltip;
                }
                if (el.dataset.tmTaskCountOriginalLabel === undefined) {
                    el.dataset.tmTaskCountOriginalLabel = el.getAttribute('aria-label') || el.getAttribute('title') || '任务管理器';
                }
                el.setAttribute('aria-label', `${el.dataset.tmTaskCountOriginalLabel}，${tooltip}`);
                if (el.dataset.tmTaskCountOriginalTitle === undefined) el.dataset.tmTaskCountOriginalTitle = el.getAttribute('title') || '任务管理器';
                el.setAttribute('title', `${el.dataset.tmTaskCountOriginalTitle}，${tooltip}`);
            }
            document.querySelectorAll('[data-tm-task-count-status]').forEach((el) => {
                el.textContent = result.status === 'disabled' ? '角标已关闭'
                    : result.status === 'ready' ? `${result.label}：${result.count} 项`
                    : result.status === 'partial' ? `${result.label}：至少 ${result.count} 项，统计不完整`
                    : result.message;
            });
            if (active && mountAttempts < 5 && ((config.topbar && !topbars.some((el) => el.isConnected)) || (config.dock && !dockIcons.length))) {
                if (!mountTimer) mountTimer = setTimeout(() => {
                    mountTimer = null;
                    mountAttempts += 1;
                    render();
                }, 500);
            }
        }

        const publish = (status, message = '') => {
            result = { status, count, label: labelFor(), message };
            render();
        };
        const resolveScope = async () => {
            if (config.scope === 'group' && !(SettingsStore.data.docGroups || []).some((group) => group.id === config.groupId)) {
                throw new Error('所选文档分组已失效，请重新选择');
            }
            return resolveDocIdsFromGroups({ groupId: config.scope === 'group' ? config.groupId : 'all', includeQuickAddDoc: false });
        };

        async function refresh() {
            refreshTimer = null;
            if (!active || running) return;
            if (globalThis.__taskHorizonPluginInstance?._taskCountBadgeStartupReady === false) return;
            running = true;
            const currentGeneration = generation;
            const full = pendingFull;
            const docs = Array.from(dirtyDocs);
            pendingFull = false;
            dirtyDocs.clear();
            const current = () => active && generation === currentGeneration;
            try {
                if (!rule || rule.enabled === false) throw new Error('所选统计规则已失效，请重新选择');
                const docIds = full ? await resolveScope() : docs.filter((id) => scopeIds.has(id));
                if (!current()) return;
                if (full) scopeIds = new Set(docIds);
                const refreshReadToken = globalThis.__tmTaskStore.captureRead(docIds);
                const next = full ? new Map() : new Map(members);
                if (!full) next.forEach((entry, id) => { if (docs.includes(entry.docId)) next.delete(id); });
                const nextIncomplete = full ? new Set() : new Set(incompleteDocs);
                docIds.forEach((id) => nextIncomplete.delete(id));
                for (let offset = 0; offset < docIds.length; offset += 12) {
                    if (!current()) return;
                    const chunk = docIds.slice(offset, offset + 12);
                    const readToken = globalThis.__tmTaskStore.captureRead(chunk);
                    let tasks = [];
                    let missing = chunk;
                    // Validate cached coverage before using the existing index. The
                    // check runs after startup, never in the first-paint await chain.
                    if (full) {
                        const freshness = await API.getTaskFreshnessByDocuments(chunk);
                        if (freshness.readFailure || freshness.unavailable) throw new Error('任务统计暂时不可用，请重试');
                        const updated = new Map(Array.from(freshness.map, ([id, meta]) => [id, meta.docUpdated]));
                        const expected = new Map(Array.from(freshness.map, ([id, meta]) => [id, meta.taskCount]));
                        const cached = await globalThis.__tmTaskSnapshotService.readTaskIndex({
                            docIds: chunk, cachedOnly: true, allowPartial: true, maxPartialMisses: chunk.length,
                            queryLimit: __TM_TASK_INDEX_QUERY_LIMIT, docUpdatedMap: updated, strictDocUpdated: true,
                            expectedTaskCountMap: expected,
                        });
                        if (cached) {
                            tasks = flatten(cached.taskTree);
                            missing = Array.from(new Set([...(cached.missingDocIds || []), ...(cached.staleDocIds || [])]));
                        }
                    }
                    if (missing.length) {
                        const read = await API.getTasksByDocuments(missing, __TM_TASK_INDEX_QUERY_LIMIT, { ignoreExcludeCompleted: true });
                        if (read?.readFailure || !Array.isArray(read?.tasks)) throw new Error('任务统计暂时不可用，请重试');
                        (read.limitReachedDocIds || []).forEach((id) => nextIncomplete.add(id));
                        if (read.limitReached && !read.limitReachedDocIds?.length) missing.forEach((id) => nextIncomplete.add(id));
                        tasks.push(...read.tasks);
                    }
                    if (!current()) return;
                    if (!globalThis.__tmTaskStore.isReadCurrent(readToken)) {
                        if (full) schedule(150, true);
                        else dirtyDocsFor(docIds);
                        return;
                    }
                    const now = new Date();
                    for (let i = 0; i < tasks.length; i += 200) {
                        if (!current()) return;
                        const batch = tasks.slice(i, i + 200).map(normalize);
                        const matched = new Set(RuleManager.applyRuleFilter(batch.filter(eligible), rule, { nowDate: now }).map((task) => task.id));
                        batch.forEach((task) => {
                            const docId = String(task.root_id || task.docId || '');
                            if (task.id && scopeIds.has(docId)) next.set(task.id, { docId, matches: matched.has(task.id) });
                        });
                        if (i + 200 < tasks.length) await yieldWork();
                    }
                    await yieldWork();
                }
                if (!current()) return;
                if (!globalThis.__tmTaskStore.isReadCurrent(refreshReadToken)) {
                    if (full) schedule(150, true);
                    else dirtyDocsFor(docIds);
                    return;
                }
                members = next;
                incompleteDocs.clear();
                nextIncomplete.forEach((id) => incompleteDocs.add(id));
                count = Array.from(members.values()).reduce((sum, entry) => sum + Number(entry.matches), 0);
                lastVerifiedAt = Date.now();
                publish(incompleteDocs.size ? 'partial' : 'ready');
            } catch (error) {
                if (current()) publish('error', String(error?.message || '任务统计暂时不可用，请重试'));
            } finally {
                running = false;
                if (active && (pendingFull || dirtyDocs.size)) schedule(150);
            }
        }

        function schedule(delay = 150, full = false) {
            if (!active) return;
            if (full) pendingFull = true;
            if (refreshTimer) clearTimeout(refreshTimer);
            refreshTimer = setTimeout(refresh, delay);
        }
        function dirtyDocsFor(ids) {
            (ids || []).forEach((id) => { if (scopeIds.has(id)) dirtyDocs.add(id); });
            if (dirtyDocs.size) schedule();
        }
        function onMutation(mutation) {
            if (!active) return;
            const ids = mutation.taskIds?.length ? mutation.taskIds : [mutation.taskId];
            let changed = false;
            const unresolvedDocs = new Set();
            const seen = new Set();
            for (const rawId of ids) {
                if (!rawId) continue;
                const task = globalThis.__tmTaskStore.getProjected(rawId) || mutation.task;
                const id = String(task?.id || globalThis.__tmTaskStore.resolveId(rawId) || rawId);
                if (rawId !== id && members.has(rawId)) {
                    count -= Number(members.get(rawId).matches);
                    members.delete(rawId);
                    changed = true;
                }
                if (seen.has(id)) continue;
                seen.add(id);
                const previous = members.get(id);
                if (/delete/i.test(mutation.type || '') && mutation.phase !== 'rollback') {
                    count -= Number(previous?.matches || false);
                    members.delete(id);
                    if (previous) unresolvedDocs.add(previous.docId);
                    changed = !!previous || changed;
                } else if (task && (task.root_id || task.docId)) {
                    const nextMatches = matches(task);
                    const docId = String(task.root_id || task.docId || '');
                    count += Number(nextMatches) - Number(previous?.matches || false);
                    if (scopeIds.has(docId)) members.set(id, { docId, matches: nextMatches });
                    else members.delete(id);
                    changed = true;
                } else {
                    if (previous?.matches && config.unfinishedOnly && mutation.phase !== 'rollback' && mutation.patch?.done === true) {
                        previous.matches = false;
                        count -= 1;
                        changed = true;
                    }
                    const docId = previous?.docId || mutation.docId;
                    if (scopeIds.has(docId)) unresolvedDocs.add(docId);
                }
            }
            if (changed && ['ready', 'partial'].includes(result.status)) publish(incompleteDocs.size ? 'partial' : 'ready');
            // Structural and unknown-task changes need one affected-document read.
            if (/create|delete|move|commitTaskId/i.test(mutation.type || '') || mutation.phase === 'rollback') {
                [mutation.docId, mutation.previousDocId, mutation.nextDocId].forEach((id) => { if (scopeIds.has(id)) unresolvedDocs.add(id); });
            }
            dirtyDocsFor(Array.from(unresolvedDocs));
        }
        function armMidnight() {
            if (midnightTimer) clearTimeout(midnightTimer);
            const now = new Date();
            const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            midnightTimer = setTimeout(() => {
                midnightTimer = null;
                schedule(0, true);
                armMidnight();
            }, next.getTime() - now.getTime() + 50);
        }
        function stop() {
            active = false;
            generation += 1;
            [refreshTimer, midnightTimer, mountTimer].forEach((timer) => { if (timer) clearTimeout(timer); });
            refreshTimer = midnightTimer = mountTimer = null;
            unsubscribe?.();
            unsubscribe = null;
            disposers.splice(0).forEach((dispose) => dispose());
            pendingFull = false;
            dirtyDocs.clear();
            incompleteDocs.clear();
            scopeIds.clear();
            members.clear();
            count = 0;
            publish('disabled');
        }
        function configure() {
            const next = __tmNormalizeTaskCountBadge(SettingsStore.data.taskCountBadge);
            if (!isEnabled(next)) {
                if (active) stop();
                config = next;
                signature = '';
                return;
            }
            const nextRule = ruleFor(next);
            const nextSignature = JSON.stringify([{ ruleId: next.ruleId, unfinishedOnly: next.unfinishedOnly, scope: next.scope, groupId: next.groupId }, nextRule, SettingsStore.data.docGroups, SettingsStore.data.selectedDocIds,
                SettingsStore.data.allDocsExcludedDocIds, SettingsStore.data.customStatusOptions, SettingsStore.data.taskMetaAttrKeys,
                SettingsStore.data.taskMetaAttrKeyAliases, SettingsStore.data.customFieldDefs, SettingsStore.data.priorityScoreConfig,
                SettingsStore.data.recursiveDocLimit, SettingsStore.data.legacyWin7CompatMode]);
            if (signature === nextSignature) { config = next; render(); return; }
            signature = nextSignature;
            stop();
            config = next;
            rule = nextRule;
            if (!isEnabled(config)) return;
            active = true;
            mountAttempts = 0;
            publish('loading', '正在统计任务…');
            unsubscribe = globalThis.__tmTaskMutationBus.subscribe(onMutation);
            const wake = () => {
                if (document.visibilityState === 'hidden') return;
                render();
                if (Date.now() - lastVerifiedAt > 30000) schedule(150, true);
            };
            listen(window, 'focus', wake);
            listen(document, 'visibilitychange', wake);
            listen(window, 'tm:task-horizon-host-lifecycle', render);
            listen(window, 'tm:task-horizon-data-changed', () => {
                configure();
                schedule(300, true);
            });
            listen(window, 'tm:sql-cache-invalidate', (event) => {
                const docId = event.detail?.docId;
                if (docId) dirtyDocsFor([docId]);
                else schedule(300, true);
            });
            listen(window, 'tm-task-attr-updated', (event) => {
                if (event.detail?.localMutation === true) return;
                const id = event.detail?.resolvedTaskId || event.detail?.taskId;
                dirtyDocsFor([members.get(id)?.docId || event.detail?.docId]);
            });
            // Reuse the transaction summary, with a single listener only when enabled.
            for (const bus of globalThis.__tmHost?.getEventBuses?.() || []) {
                const handler = (event) => {
                    if (__tmShouldIgnoreWsMainTaskRefreshMessage(event)) return;
                    const targets = __tmSummarizeWsMainTaskTx(event);
                    dirtyDocsFor([...targets.docIds, ...(targets.blockIds || []).map((id) => members.get(id)?.docId)]);
                };
                bus.on('ws-main', handler);
                disposers.push(() => bus.off('ws-main', handler));
            }
            armMidnight();
            // Explicit delay: requestIdleCallback's timeout is not a startup delay.
            startAfterLoad();
        }
        function startAfterLoad() {
            if (active && globalThis.__taskHorizonPluginInstance?._taskCountBadgeStartupReady !== false
                && !refreshTimer && !running) schedule(__tmIsRuntimeMobileClient() ? 2400 : 1200, true);
        }
        return { configure, render, refresh: () => schedule(0, true), onMutation,
            startAfterLoad, getResult: () => ({ ...result }), dispose: () => { signature = ''; stop(); } };
    })();
    globalThis.__tmTaskCountBadge = __tmTaskCountBadge;
