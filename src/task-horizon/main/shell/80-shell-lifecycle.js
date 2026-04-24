    async function init() {
        const bindShellEntrances = !(globalThis.__tmRuntimeHost?.getInfo?.()?.isDockHost ?? __tmIsDockHost());
        try { __tmBindUndoShortcut(); } catch (e) {}
        if (bindShellEntrances) {
            try { __tmBindWakeReload(); } catch (e) {}
            try { __tmBindTabEnterAutoRefresh(); } catch (e) {}
            try { __tmBindNativeDocCheckboxStatusSync(); } catch (e) {}
        }
        try { __tmBindCalendarScheduleUpdated(); } catch (e) {}
        if (bindShellEntrances) {
            try { __tmBindDocGroupMenuEntry(); } catch (e) {}
        }

        // 监听悬浮条修改任务事件
        try {
            if (__tmQuickbarTaskUpdateHandler) {
                try { globalThis.__tmRuntimeEvents?.off?.(window, 'tm-task-attr-updated', __tmQuickbarTaskUpdateHandler); } catch (e) {}
            }
            if (__tmQuickbarRelayStorageHandler) {
                try { globalThis.__tmRuntimeEvents?.off?.(window, 'storage', __tmQuickbarRelayStorageHandler); } catch (e) {}
            }
            if (__tmQuickbarRelayPollTimer) {
                try { clearInterval(__tmQuickbarRelayPollTimer); } catch (e) {}
                __tmQuickbarRelayPollTimer = null;
            }
            __tmQuickbarTaskUpdateHandler = (e) => {
                if (!e || !e.detail || !e.detail.taskId) return;
                const taskId = String(e.detail.taskId || '').trim();
                if (!taskId) return;
                const requestedTaskId = String(e.detail.requestedTaskId || '').trim();
                const attrKey = String(e.detail.attrKey || '').trim();
                const attrValue = String(e.detail.value ?? '');
                const attrHostId = String(e.detail.attrHostId || '').trim();
                const relayTransport = String(e.detail.__relayTransport || '').trim();
                const relaySource = String(e.detail.__relaySource || '').trim();
                const relaySeq = Number(e.detail.__relaySeq || 0) || 0;
                const relayTime = String(e.detail.__relayTime || '').trim();
                const source = String(e.detail.source || relaySource || '').trim();
                const pluginVisible = __tmIsPluginVisibleNow();
                try {
                    __tmPushDetailDebug('global-attr-updated', {
                        taskId,
                        requestedTaskId,
                        attrKey,
                        attrValue,
                        source,
                        relayTransport,
                        relaySeq,
                    });
                } catch (e2) {}
                try {
                    __tmPushRefreshDebug('quickbar-auto-update:received', {
                        taskId,
                        requestedTaskId,
                        attrHostId,
                        attrKey,
                        attrValue,
                        source,
                        pluginVisible,
                        relayTransport,
                        relaySource,
                        relaySeq,
                        relayTime,
                        viewMode: globalThis.__tmRuntimeState?.getViewMode?.('') || String(state.viewMode || '').trim() || '',
                    });
                } catch (e2) {}
                if (__tmIsVisibleDateAttrKey(attrKey)) {
                    __tmMarkVisibleDateFallbackTask(taskId);
                }
                let handledInline = false;
                let resolveRetryScheduled = false;
                if (attrKey) {
                    handledInline = __tmChangeFeed.handleAttrUpdate(taskId, attrKey, attrValue, {
                        reason: 'quickbar-attr-update',
                    });
                    if (!handledInline) {
                        resolveRetryScheduled = true;
                        Promise.resolve(__tmResolveTaskIdFromAnyBlockId(taskId))
                            .then((resolvedTaskId) => {
                                const nextTaskId = String(resolvedTaskId || '').trim();
                                if (!nextTaskId || nextTaskId === taskId) {
                                    try {
                                        __tmPushRefreshDebug('quickbar-auto-update:resolve-skip', {
                                            taskId,
                                            resolvedTaskId: nextTaskId,
                                            attrKey,
                                            source,
                                        });
                                    } catch (e) {}
                                    return;
                                }
                                const resolvedHandledInline = !!__tmChangeFeed.handleAttrUpdate(nextTaskId, attrKey, attrValue, {
                                    reason: 'quickbar-attr-update',
                                });
                                handledInline = resolvedHandledInline || handledInline;
                                try {
                                    __tmPushRefreshDebug('quickbar-auto-update:resolve-result', {
                                        taskId,
                                        resolvedTaskId: nextTaskId,
                                        attrKey,
                                        attrValue,
                                        source,
                                        handledInline: resolvedHandledInline,
                                    });
                                } catch (e) {}
                            })
                            .catch((error) => {
                                try {
                                    __tmPushRefreshDebug('quickbar-auto-update:resolve-error', {
                                        taskId,
                                        attrKey,
                                        source,
                                        error: String(error?.message || error || '').trim(),
                                    });
                                } catch (e) {}
                                return null;
                            });
                    }
                }
                const shouldDeferToAutoRefresh = __tmChangeFeed.shouldDeferToAutoRefresh(taskId, attrKey, attrValue);
                const shouldMarkDirty = !handledInline || shouldDeferToAutoRefresh;
                try {
                    __tmPushRefreshDebug('quickbar-auto-update:decision', {
                        taskId,
                        requestedTaskId,
                        attrHostId,
                        attrKey,
                        source,
                        handledInline,
                        shouldDeferToAutoRefresh,
                        shouldMarkDirty,
                        relayTransport,
                        relaySeq,
                        resolveRetryScheduled,
                    });
                } catch (e2) {}
                if (shouldMarkDirty) {
                    __tmMarkQuickbarModifiedTask(taskId);
                    try {
                        __tmPushRefreshDebug('quickbar-auto-update:mark-dirty', {
                            taskId,
                            requestedTaskId,
                            attrHostId,
                            attrKey,
                            source,
                            reason: !handledInline ? 'inline-not-applied' : 'projection-refresh-needed',
                            relayTransport,
                            relaySeq,
                            resolveRetryScheduled,
                        });
                    } catch (e2) {}
                }
                if (attrKey === 'bookmark') {
                    try { __tmClearReminderSnapshotCache(taskId); } catch (ex) {}
                    try { __tmSetTaskReminderMark(taskId, attrValue.includes('⏰')); } catch (ex) {}
                    try {
                        const liveModal = globalThis.__tmRuntimeState?.getModal?.() || state.modal;
                        if (globalThis.__tmRuntimeState?.hasLiveModal?.(liveModal) ?? (state.modal && document.body.contains(state.modal))) {
                            __tmApplyReminderTaskNameMarks(liveModal);
                        }
                    } catch (ex) {}
                    try { __tmRefreshReminderMarkForTask(taskId, 240); } catch (ex) {}
                } else if (
                    attrKey === 'custom-reminder'
                    || attrKey === 'custom-start-date'
                    || attrKey === 'custom-completion-time'
                    || attrKey === __TM_TASK_REPEAT_RULE_ATTR
                    || attrKey === __TM_TASK_REPEAT_STATE_ATTR
                    || !attrKey
                ) {
                    try { __tmClearReminderSnapshotCache(taskId); } catch (ex) {}
                    try { __tmRefreshReminderMarkForTask(taskId, 240); } catch (ex) {}
                }
            };
            globalThis.__tmRuntimeEvents?.on?.(window, 'tm-task-attr-updated', __tmQuickbarTaskUpdateHandler);
            __tmQuickbarRelayStorageHandler = (e) => {
                const storageKey = String(e?.key || '').trim();
                if (!storageKey || !String(e?.newValue || '').trim()) return;
                try {
                    __tmConsumeQuickbarRelayStorageEntry(storageKey, e.newValue, 'storage');
                } catch (e2) {}
            };
            globalThis.__tmRuntimeEvents?.on?.(window, 'storage', __tmQuickbarRelayStorageHandler);
            __tmQuickbarRelayPollTimer = setInterval(() => {
                try { __tmPollQuickbarRelayStorage(); } catch (e) {}
            }, 180);
            try { __tmPollQuickbarRelayStorage(); } catch (e) {}
        } catch (e) {}

        // 检查是否有悬浮条修改的任务需要刷新（从 localStorage 恢复）
        try {
            __tmLoadQuickbarModifiedTasksFromStorage(true);
        } catch (ex) {}

        // 1. 先加载设置（包括文档ID）
        try {
            await __tmEnsureSettingsLoaded();
            try {
                if (globalThis.__tmCalendar && typeof globalThis.__tmCalendar.setSettingsStore === 'function') {
                    globalThis.__tmCalendar.setSettingsStore(SettingsStore);
                }
            } catch (e) {}
            await WhiteboardStore.load();

            // 初始化状态
            state.selectedDocIds = SettingsStore.data.selectedDocIds;
            state.queryLimit = SettingsStore.data.queryLimit;
            state.recursiveDocLimit = SettingsStore.data.recursiveDocLimit;
            const gm0 = String(SettingsStore.data.groupMode || '').trim();
            const validModes = new Set(['none', 'doc', 'time', 'quadrant', 'task']);
            if (!validModes.has(gm0)) {
                // groupMode 无效时，使用已加载的标志位
                state.groupByDocName = SettingsStore.data.groupByDocName;
                state.groupByTaskName = SettingsStore.data.groupByTaskName;
                state.groupByTime = SettingsStore.data.groupByTime;
                state.quadrantEnabled = SettingsStore.data.quadrantConfig?.enabled || false;
            }
            // 根据 groupMode 设置标志位，但 groupByTaskName 只在 groupMode === 'task' 时才设置为 true
            if (gm0 === 'doc') {
                state.groupByDocName = true;
                state.groupByTime = false;
                state.quadrantEnabled = false;
            } else if (gm0 === 'time') {
                state.groupByDocName = false;
                state.groupByTime = true;
                state.quadrantEnabled = false;
            } else if (gm0 === 'task') {
                state.groupByDocName = false;
                state.groupByTaskName = true;
                state.groupByTime = false;
                state.quadrantEnabled = false;
            } else if (gm0 === 'quadrant') {
                state.groupByDocName = false;
                state.groupByTime = false;
                state.quadrantEnabled = true;
            } else {
                // 当 groupMode 为 'none' 时（用户选择了"不分组"），将 state.groupByTaskName 设置为 false
                // 这样可以正确显示"不分组"选项为选中状态
                // 注意：这里不检查 SettingsStore.data.groupByTaskName，因为它只控制开关显示，不影响当前分组模式
                state.groupByDocName = false;
                state.groupByTaskName = false;
                state.groupByTime = false;
                state.quadrantEnabled = false;
            }
            state.collapsedTaskIds = new Set(SettingsStore.data.collapsedTaskIds || []);
            state.collapsedGroups = new Set(SettingsStore.data.collapsedGroups || []);
            state.currentRule = SettingsStore.data.currentRule;
            state.columnWidths = SettingsStore.data.columnWidths;
            state.docTabsHidden = !!Storage.get('tm_doc_tabs_hidden', false);

            // 加载筛选规则
            state.filterRules = await __tmEnsureFilterRulesLoaded();
        } catch (e) {
            console.error('[初始化] 加载设置失败:', e);
        }

        try {
            if (__tmThemeModeObserver) {
                __tmThemeModeObserver.disconnect();
                __tmThemeModeObserver = null;
            }
            __tmThemeModeObserver = new MutationObserver(() => {
                try { __tmApplyAppearanceThemeVars(); } catch (e) {}
                try { if (state.modal) render(); } catch (e) {}
            });
            __tmThemeModeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme-mode'] });
        } catch (e) {}
        try { __tmApplyAppearanceThemeVars(); } catch (e) {}

        // 2. 获取所有文档列表
        try {
            state.allDocuments = await __tmEnsureAllDocumentsLoaded(false);
        } catch (e) {
            console.error('[初始化] 加载文档列表失败:', e);
        }

        // 3. 创建浮动按钮 (已禁用)
        /*
        const fab = document.createElement('button');
        fab.className = 'tm-fab';
        fab.innerHTML = '📋 任务管理';
        fab.onclick = openManager;
        document.body.appendChild(fab);

        // 显示已选文档数量
        if (state.selectedDocIds.length > 0) {
            fab.title = `任务管理 (已选 ${state.selectedDocIds.length} 个文档)`;
        }
        */

        // 启动面包屑按钮观察者
        if (bindShellEntrances) {
            observeBreadcrumb();
        }
        try { __tmBootstrapCalendarBackgroundRefresh(0); } catch (e) {}
    }

    async function __tmEnsureTabOpened(maxWaitMs = 1500) {
        if (typeof globalThis.__taskHorizonOpenTabView !== 'function') return;
        try {
            if (globalThis.__tmHost?.isMobileRuntime?.()) return;
        } catch (e) {}
        if (__tmIsRuntimeMobileClient()) return;
        __tmEnsureMount();
        // Removed aggressive openTabView call if mount exists, relying on findExistingModel logic instead

        try {
            const custom = __tmFindExistingTaskHorizonCustomModel();
            if (custom) {
                try {
                    const tab = custom.tab || custom;
                    if (tab && globalThis.__tmCompat?.switchTabLegacy?.(tab)) {
                    } else if (tab?.headElement?.click) {
                        tab.headElement.click();
                    }
                } catch (e2) {}
                try {
                    const el = await __tmWaitForTaskHorizonTabRoot(900) || custom.element;
                    if (el && document.body.contains(el)) {
                        try { globalThis.__taskHorizonTabElement = el; } catch (e3) {}
                        __tmSetMount(el);
                    }
                } catch (e2) {}
                return;
            }
        } catch (e) {}
        try {
            const existingTab = __tmFindExistingTaskManagerTab?.();
            if (existingTab) {
                try { __tmSwitchToTab(existingTab); } catch (e) {}
                try {
                    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                } catch (e) {}
                const best = await __tmWaitForTaskHorizonTabRoot(900);
                if (best && document.body.contains(best)) {
                    try { globalThis.__taskHorizonTabElement = best; } catch (e) {}
                    __tmSetMount(best);
                }
                return;
            }
        } catch (e) {}

        // 尝试查找并点击标签页标题 (Fallback)
        try {
            const headers = document.querySelectorAll('.layout-tab-bar__item');
            for (const h of headers) {
                if (__tmIsTaskHorizonTabHeaderEl(h)) {
                    h.click();

                    const resolved = await __tmWaitForTaskHorizonTabRoot(2000);
                    if (resolved && document.body.contains(resolved)) {
                        try { globalThis.__taskHorizonTabElement = resolved; } catch (e) {}
                        __tmSetMount(resolved);
                        return;
                    }
                    // 即使超时，只要找到了 header，我们也认为不需要新建，避免重复
                    return;
                }
            }
        } catch(e) {}

        if (__tmEnsureTabPromise) return __tmEnsureTabPromise;
        __tmEnsureTabPromise = (async () => {
            try {
                try { globalThis.__taskHorizonOpenTabView(); } catch (e) {}
                const resolved = await __tmWaitForTaskHorizonTabRoot(maxWaitMs);
                if (resolved && document.body.contains(resolved)) {
                    try { globalThis.__taskHorizonTabElement = resolved; } catch (e) {}
                    __tmSetMount(resolved);
                }
            } finally {
                __tmEnsureTabPromise = null;
            }
        })();
        return __tmEnsureTabPromise;
    }

    // 检查是否有任何分组包含文档（支持全部文档和自定义分组）
    async function checkAnyGroupHasDocs() {
        // 检查全部文档分组
        if (SettingsStore.data.selectedDocIds && SettingsStore.data.selectedDocIds.length > 0) {
            return true;
        }

        // 检查自定义分组
        const groups = SettingsStore.data.docGroups || [];
        for (const group of groups) {
            if ((group.docs && group.docs.length > 0) || String(group?.notebookId || '').trim()) {
                return true;
            }
        }

        return false;
    }

    // 查找已打开的任务管理器标签页
    function __tmFindExistingTaskManagerTab() {
        try {
            const custom = __tmFindExistingTaskHorizonCustomModel?.();
            if (custom?.tab) return custom.tab;
            if (custom?.headElement instanceof Element) return custom.headElement;
            if (custom) return custom;
        } catch (e) {}
        try {
            const tabId = String(globalThis.__taskHorizonCustomTabId || '').trim();
            if (!tabId) return null;
            return document.querySelector(`.layout-tab-bar [data-id="${tabId}"], .layout-tab-bar [data-key="${tabId}"]`);
        } catch (e) {}
        return null;
    }

    // 切换到指定标签页
    function __tmSwitchToTab(tab) {
        try {
            if (!(tab instanceof Element) && globalThis.__tmCompat?.switchTabLegacy?.(tab)) {
                return true;
            }
        } catch (e) {
        }
        try {
            const header = tab instanceof Element ? tab : (tab?.headElement instanceof Element ? tab.headElement : null);
            if (header) {
                try {
                    header.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                } catch (e) {
                    try { header.click(); } catch (e2) {}
                }
                return true;
            }
        } catch (e) {}
        try {
            if (typeof globalThis.__taskHorizonOpenTabView === 'function') {
                globalThis.__taskHorizonOpenTabView();
                return true;
            }
        } catch (e) {}
        return false;
    }

    async function openManager(options) {
        const token = globalThis.__tmRuntimeState?.nextOpenToken?.() ?? (() => {
            state.openToken = (Number(state.openToken) || 0) + 1;
            return Number(state.openToken) || 0;
        })();
        __tmMarkContextInteractionQuiet('open-manager', 2200);
        const runtimeMobile = globalThis.__tmRuntimeHost?.getInfo?.()?.runtimeMobileClient ?? __tmIsRuntimeMobileClient();
        const perfTrace = __tmCreatePerfTrace('openManager', {
            token,
            runtimeMobile: runtimeMobile ? 1 : 0,
            forceOpenTab: options?.forceOpenTab ? 1 : 0,
            skipEnsureTabOpened: options?.skipEnsureTabOpened ? 1 : 0,
        });
        __tmPerfTraceMark(perfTrace, 'open:start', { token });
        try { __tmListenPinnedChanged(); } catch (e) {}
        let reusedExistingModal = false;
        const shouldEnsureDesktopTab = !!(options && options.forceOpenTab)
            || !runtimeMobile;

        if (shouldEnsureDesktopTab) {
            if (!options || !options.skipEnsureTabOpened) {
                await __tmEnsureTabOpened();
            } else {
                __tmEnsureMount();
            }
            try {
                setTimeout(() => { try { __tmPatchTaskHorizonTabIcon(); } catch (e) {} }, 0);
                setTimeout(() => { try { __tmPatchTaskHorizonTabIcon(); } catch (e) {} }, 250);
                setTimeout(() => { try { __tmPatchTaskHorizonTabIcon(); } catch (e) {} }, 900);
            } catch (e) {}
        }
        __tmPerfTraceMark(perfTrace, 'open:mount-ready', {
            ensureDesktopTab: shouldEnsureDesktopTab ? 1 : 0,
        });

        // 仅在必要时重渲染，避免页签切换返回时闪烁和滚动位置丢失
        try {
            try { __tmTryReattachExistingModalToMount(__tmMountEl || document.body); } catch (e) {}
            const modalEl = state.modal;
            const currentMount = __tmMountEl || document.body;
            try { __tmPruneMountedManagerShells(currentMount, modalEl instanceof HTMLElement ? modalEl : null); } catch (e) {}
            const mounted = !!(modalEl && modalEl instanceof HTMLElement && document.body.contains(modalEl));
            const inCurrentMount = !!(currentMount && modalEl && modalEl.parentElement === currentMount);
            reusedExistingModal = mounted && inCurrentMount;
            if (!reusedExistingModal) {
                try { render(); } catch (e) {
                    console.error('[OpenManager] Render failed:', e);
                }
            }
        } catch (e) {
            try { render(); } catch (e2) {
                console.error('[OpenManager] Render failed:', e2);
            }
        }
        __tmPerfTraceMark(perfTrace, 'open:shell-render', {
            reusedExistingModal: reusedExistingModal ? 1 : 0,
        });
        __tmPerfTraceMark(perfTrace, 'open:shell-first-paint', {
            reusedExistingModal: reusedExistingModal ? 1 : 0,
        });

        let hasDataReadyForSoftReuse0 = false;
        try {
            const treeReady = Array.isArray(state.taskTree) && state.taskTree.length > 0;
            const flatReady = state.flatTasks && Object.keys(state.flatTasks).length > 0;
            hasDataReadyForSoftReuse0 = !!(treeReady || flatReady);
        } catch (e) {
            hasDataReadyForSoftReuse0 = false;
        }
        const quickbarDirty0 = __tmHasQuickbarModificationsSync();
        const hasPendingInsertedTasks0 = (() => {
            try {
                return Object.keys(state.pendingInsertedTasks || {}).some((id) => !!String(id || '').trim());
            } catch (e) {
                return false;
            }
        })();
        const forceShellRenderOnOpen = !!state.__tmForceShellRenderOnOpen;
        state.__tmForceShellRenderOnOpen = false;
        const shouldShowInlineLoading = !state.wasHidden
            && !(options && options.skipLoadingHint)
            && !(options && options.skipEnsureTabOpened)
            && !(reusedExistingModal && hasDataReadyForSoftReuse0 && !quickbarDirty0 && !hasPendingInsertedTasks0 && !forceShellRenderOnOpen);
        state.wasHidden = false;

        await __tmEnsureSettingsLoaded();
        try { await __tmRefreshNotebookCache(); } catch (e) {}
        try {
            if (globalThis.__tmCalendar && typeof globalThis.__tmCalendar.setSettingsStore === 'function') {
                globalThis.__tmCalendar.setSettingsStore(SettingsStore);
            }
        } catch (e) {}
        try {
            const allow = new Set(['list', 'checklist', 'timeline', 'kanban', 'calendar', 'whiteboard']);
            const isMobileDevice = __tmIsMobileDevice();
            const preserve = !!(options && options.preserveViewMode);
            const current = globalThis.__tmRuntimeState?.getViewMode?.('') || String(state.viewMode || '').trim();
            if (preserve && state.viewModeInitialized === true && allow.has(current)) {
                state.viewMode = __tmGetSafeViewMode(current);
            } else {
                state.viewMode = __tmGetConfiguredDefaultViewMode(isMobileDevice);
            }
            state.viewModeInitialized = true;
        } catch (e) {
            state.viewMode = 'list';
            state.viewModeInitialized = true;
        }
        try {
            const ids = Array.isArray(SettingsStore.data.kanbanCollapsedTaskIds) ? SettingsStore.data.kanbanCollapsedTaskIds : [];
            state.__tmKanbanCollapsedIds = new Set(ids.map(x => String(x || '').trim()).filter(Boolean));
        } catch (e) {
            state.__tmKanbanCollapsedIds = new Set();
        }
        if (SettingsStore.data.enableTomatoIntegration) {
            try { __tmHookTomatoTimer(); } catch (e) {}
            try { __tmListenTomatoAssociationCleared(); } catch (e) {}
        }
        state.selectedDocIds = SettingsStore.data.selectedDocIds;

        // 检查是否至少有一个分组包含文档
        const hasDocs = await checkAnyGroupHasDocs();
        if (!hasDocs) {
            hint('⚠ 请先在设置中添加要显示的文档', 'warning');
            const activeModal = globalThis.__tmRuntimeState?.getModal?.() || state.modal;
            if (activeModal && (globalThis.__tmRuntimeState?.isCurrentOpenToken?.(token) ?? token === (Number(state.openToken) || 0))) showSettings();
            __tmPerfTraceFinish(perfTrace, {
                reason: 'no-doc-groups',
                reusedExistingModal: reusedExistingModal ? 1 : 0,
            });
            return;
        }

        if (!(globalThis.__tmRuntimeState?.getModal?.() || state.modal)
            || !(globalThis.__tmRuntimeState?.isCurrentOpenToken?.(token) ?? token === (Number(state.openToken) || 0))) {
            __tmPerfTraceFinish(perfTrace, {
                cancelled: 1,
                reason: 'modal-stale',
            });
            return;
        }
        try {
            await new Promise(resolve => {
                requestAnimationFrame(() => requestAnimationFrame(resolve));
            });
        } catch (e) {}
        const hasDataReadyForSoftReuse = (() => {
            try {
                const treeReady = Array.isArray(state.taskTree) && state.taskTree.length > 0;
                const flatReady = state.flatTasks && Object.keys(state.flatTasks).length > 0;
                return !!(treeReady || flatReady);
            } catch (e) {
                return false;
            }
        })();
        const quickbarDirty = __tmHasQuickbarModificationsSync();
        const hasPendingInsertedTasks = (() => {
            try {
                return Object.keys(state.pendingInsertedTasks || {}).some((id) => !!String(id || '').trim());
            } catch (e) {
                return false;
            }
        })();
        const canSkipRenderOnReuse = reusedExistingModal
            && hasDataReadyForSoftReuse
            && !quickbarDirty
            && !hasPendingInsertedTasks
            && !forceShellRenderOnOpen;
        if (canSkipRenderOnReuse) {
            try { __tmScheduleReminderTaskNameMarksRefresh(state.modal, true); } catch (e) {}
            try {
                __tmGetValueDebugWatchTaskIds().forEach((taskId) => {
                    const currentTask = (state.flatTasks && typeof state.flatTasks === 'object')
                        ? (globalThis.__tmRuntimeState?.getFlatTaskById?.(taskId) || state.flatTasks[taskId] || null)
                        : null;
                    __tmPushValueDebug('open:soft-reuse-visible-state', {
                        taskId,
                        token,
                        reusedExistingModal: true,
                        task: __tmSnapshotTaskValueDebugFields(currentTask),
                    }, [taskId]);
                });
            } catch (e) {}
            try {
                if ((globalThis.__tmRuntimeState?.isViewMode?.('calendar') ?? String(state.viewMode || '').trim() === 'calendar')
                    && (globalThis.__tmCalendar?.requestRefresh || globalThis.__tmCalendar?.refreshInPlace)) {
                    __tmRequestCalendarRefresh({
                        reason: 'open-manager-soft-reuse-layout',
                        main: true,
                        side: true,
                        flushTaskPanel: true,
                        layoutOnly: true,
                        hard: false,
                    }, { layoutOnly: true, hard: false });
                }
            } catch (e) {}
            loadSelectedDocuments({
                skipRender: true,
                preferFastFirstPaint: false,
                forceFreshTasks: true,
                showInlineLoading: false,
                perfTrace,
                source: 'openManager-soft-reuse'
            }).then(() => {
                if (!(globalThis.__tmRuntimeState?.isCurrentOpenToken?.(token) ?? token === (Number(state.openToken) || 0))) return;
                try {
                    __tmRefreshMainViewInPlace({
                        withFilters: false,
                        reason: 'open-manager-soft-reuse-after-load',
                    });
                } catch (e) {
                    try { render(); } catch (e2) {}
                }
                try {
                    if ((globalThis.__tmRuntimeState?.isViewMode?.('calendar') ?? String(state.viewMode || '').trim() === 'calendar')
                        && (globalThis.__tmCalendar?.requestRefresh || globalThis.__tmCalendar?.refreshInPlace)) {
                        __tmRequestCalendarRefresh({
                            reason: 'open-manager-soft-reuse-after-load',
                            main: true,
                            side: true,
                            flushTaskPanel: true,
                            hard: false,
                        }, { hard: false });
                    }
                } catch (e) {}
            }).catch((e) => {
                __tmPerfTraceFinish(perfTrace, {
                    error: String(e?.message || e || '').trim() || 'open-soft-reuse-load-failed',
                    viewMode: globalThis.__tmRuntimeState?.getViewMode?.('list') || String(state.viewMode || '').trim() || 'list',
                });
            });
            return;
        }
        if (quickbarDirty) {
            __tmClearQuickbarModifications();
            try { await new Promise(resolve => setTimeout(resolve, 200)); } catch (e) {}
            try { window.__tmCalendarAllTasksCache = null; } catch (e) {}
        }
        try {
            state.activeDocId = String(state.activeDocId || 'all').trim() || 'all';
            await __tmApplyCurrentContextViewProfile();
        } catch (e) {}
        try {
            if (!canSkipRenderOnReuse) {
                await __tmWaitForQueuedOpsIdle(900);
            }
        } catch (e) {}
        const runtimeMobileFastPath = globalThis.__tmRuntimeHost?.getInfo?.()?.runtimeMobileClient ?? __tmIsRuntimeMobileClient();
        __tmPerfTraceMark(perfTrace, 'open:load-dispatched', {
            viewMode: globalThis.__tmRuntimeState?.getViewMode?.('list') || String(state.viewMode || '').trim() || 'list',
            preferFastFirstPaint: runtimeMobileFastPath ? 1 : 0,
        });
        loadSelectedDocuments({
            skipRender: canSkipRenderOnReuse,
            preferFastFirstPaint: !canSkipRenderOnReuse && runtimeMobileFastPath,
            showInlineLoading: shouldShowInlineLoading,
            loadingStyleKind: canSkipRenderOnReuse ? 'topbar' : 'skeleton',
            loadingDelayMs: canSkipRenderOnReuse ? undefined : 0,
            perfTrace,
            source: 'openManager'
        }).then(() => {
            if (!canSkipRenderOnReuse) return;
            try {
                if ((globalThis.__tmRuntimeState?.isViewMode?.('calendar') ?? String(state.viewMode || '').trim() === 'calendar')
                    && (globalThis.__tmCalendar?.requestRefresh || globalThis.__tmCalendar?.refreshInPlace)) {
                    __tmRequestCalendarRefresh({
                        reason: 'open-manager-soft-reuse-after-load',
                        main: true,
                        side: true,
                        flushTaskPanel: true,
                        layoutOnly: true,
                        hard: false,
                    }, { layoutOnly: true, hard: false });
                }
            } catch (e) {}
        }).catch(e => {
            __tmPerfTraceFinish(perfTrace, {
                error: String(e?.message || e || '').trim() || 'open-load-failed',
                viewMode: globalThis.__tmRuntimeState?.getViewMode?.('list') || String(state.viewMode || '').trim() || 'list',
            });
            hint(`❌ 加载失败: ${e.message}`, 'error');
        });
    }

    // ... 保留原有的 loadSelectedDocuments 和其他函数 ...

    // 插件卸载清理
    function __tmCleanup() {
        try { globalThis.__tmHomepage?.unmount?.(); } catch (e) {}
        try { __tmStopStartupLagProbe('cleanup'); } catch (e) {}
        try {
            if (__tmModalStackEscHandler) {
                globalThis.__tmRuntimeEvents?.off?.(document, 'keydown', __tmModalStackEscHandler, true);
                __tmModalStackEscHandler = null;
            }
        } catch (e) {}
        try {
            if (__tmVisibilityHandler) {
                globalThis.__tmRuntimeEvents?.off?.(document, 'visibilitychange', __tmVisibilityHandler);
                __tmVisibilityHandler = null;
            }
        } catch (e) {}
        try {
            if (__tmFocusHandler) {
                globalThis.__tmRuntimeEvents?.off?.(window, 'focus', __tmFocusHandler);
                __tmFocusHandler = null;
            }
        } catch (e) {}
        try {
            if (__tmGlobalClickHandler) {
                globalThis.__tmRuntimeEvents?.off?.(window, 'click', __tmGlobalClickHandler);
                __tmGlobalClickHandler = null;
            }
        } catch (e) {}
        try {
            state.__settingsUnstack?.();
            state.__settingsUnstack = null;
        } catch (e) {}
        try {
            globalThis.__tmRuntimeEvents?.off?.(document, 'pointerdown', __tmRememberFocusedProtyleOnPointerDown, true);
            globalThis.__tmRuntimeEvents?.off?.(document, 'focusin', __tmRememberFocusedProtyleOnFocusIn, true);
            __tmLastFocusedProtyle = null;
        } catch (e) {}
        try {
            if (__tmQuickbarTaskUpdateHandler) {
                globalThis.__tmRuntimeEvents?.off?.(window, 'tm-task-attr-updated', __tmQuickbarTaskUpdateHandler);
                __tmQuickbarTaskUpdateHandler = null;
            }
            if (__tmQuickbarRelayStorageHandler) {
                globalThis.__tmRuntimeEvents?.off?.(window, 'storage', __tmQuickbarRelayStorageHandler);
                __tmQuickbarRelayStorageHandler = null;
            }
            if (__tmQuickbarRelayPollTimer) {
                clearInterval(__tmQuickbarRelayPollTimer);
                __tmQuickbarRelayPollTimer = null;
            }
            __tmQuickbarRelayLastTokenByKey.clear();
        } catch (e) {}
        try {
            if (__tmNativeDocCheckboxSyncClickHandler) {
                globalThis.__tmRuntimeEvents?.off?.(document, 'click', __tmNativeDocCheckboxSyncClickHandler, true);
                globalThis.__tmRuntimeEvents?.off?.(document, 'pointerup', __tmNativeDocCheckboxSyncClickHandler, true);
                __tmNativeDocCheckboxSyncClickHandler = null;
            }
            if (__tmNativeDocCheckboxSyncObserver) {
                __tmNativeDocCheckboxSyncObserver.disconnect();
                __tmNativeDocCheckboxSyncObserver = null;
            }
            if (__tmNativeDocCheckboxBatchTimer) {
                try { clearTimeout(__tmNativeDocCheckboxBatchTimer); } catch (e2) {}
                __tmNativeDocCheckboxBatchTimer = null;
            }
            __tmNativeDocCheckboxPendingBatch.clear();
            __tmNativeDocCheckboxReconcileTimers.forEach((timers) => {
                try {
                    (Array.isArray(timers) ? timers : []).forEach((timer) => clearTimeout(timer));
                } catch (e2) {}
            });
            __tmNativeDocCheckboxReconcileTimers.clear();
            __tmNativeDocCheckboxReconcileVersions.clear();
            __tmNativeDocCheckboxSyncQueue.length = 0;
            __tmNativeDocCheckboxSyncQueueRunning = false;
            __tmNativeDocCheckboxBatchSeq = 0;
        } catch (e) {}
        try {
            if (__tmSqlCacheInvalidationHandler) {
                globalThis.__tmRuntimeEvents?.off?.(window, 'tm:sql-cache-invalidate', __tmSqlCacheInvalidationHandler);
                __tmSqlCacheInvalidationHandler = null;
            }
            if (__tmSqlCacheEventBusHandler) {
                const seen = new Set();
                const buses = Array.isArray(__tmSqlCacheEventBuses) && __tmSqlCacheEventBuses.length
                    ? __tmSqlCacheEventBuses
                    : (globalThis.__tmHost?.getEventBuses?.() || []);
                buses.forEach((eb) => {
                    if (!eb || seen.has(eb) || typeof eb.off !== 'function') return;
                    seen.add(eb);
                    try { globalThis.__tmRuntimeEvents?.offEventBus?.('ws-main', __tmSqlCacheEventBusHandler, eb); } catch (e2) {}
                });
                __tmSqlCacheEventBusHandler = null;
            }
            __tmSqlCacheEventBuses = [];
            __tmSqlCacheInvalidationBound = false;
        } catch (e) {}
        try {
            globalThis.__tmCompat?.restoreSwitchTabObserver?.(__tmOriginalCenterSwitchTab, '__tmTaskHorizonWrapped');
            __tmOriginalCenterSwitchTab = null;
            __tmTabEnterAutoRefreshBound = false;
            if (__tmTabEnterAutoRefreshTimer) {
                clearTimeout(__tmTabEnterAutoRefreshTimer);
                __tmTabEnterAutoRefreshTimer = null;
            }
            __tmTabEnterAutoRefreshTryCount = 0;
            if (__tmTabHeaderAutoRefreshHandler) {
                globalThis.__tmRuntimeEvents?.off?.(document, 'click', __tmTabHeaderAutoRefreshHandler, true);
                __tmTabHeaderAutoRefreshHandler = null;
            }
            if (__tmTabActivationObserver) {
                __tmTabActivationObserver.disconnect();
                __tmTabActivationObserver = null;
            }
            if (__tmTabActivationObserverTimer) {
                clearTimeout(__tmTabActivationObserverTimer);
                __tmTabActivationObserverTimer = 0;
            }
            __tmTaskHorizonTabWasActive = false;
        } catch (e) {}
        try {
            if (__tmTopBarClickCaptureHandler) {
                try { __tmTopBarEl?.removeEventListener?.('click', __tmTopBarClickCaptureHandler, true); } catch (e2) {}
                __tmTopBarClickCaptureHandler = null;
            }
            try { __tmRemoveTopBarIcon(); } catch (e2) {}
            try { delete globalThis[__TM_MOBILE_TOPBAR_REGISTERED_KEY]; } catch (e2) {}
            __tmTopBarEl = null;
            __tmTopBarClickInFlight = false;
        } catch (e) {}
        try {
            if (__tmQuickAddGlobalClickHandler) {
                globalThis.__tmRuntimeEvents?.off?.(document, 'click', __tmQuickAddGlobalClickHandler);
                __tmQuickAddGlobalClickHandler = null;
            }
            try { if (window.tmQuickAddEventsBound) window.tmQuickAddEventsBound = false; } catch (e2) {}
        } catch (e) {}
        try {
            if (__tmWakeReloadTimer) {
                clearTimeout(__tmWakeReloadTimer);
                __tmWakeReloadTimer = null;
            }
            __tmWakeReloadInFlight = false;
            __tmWakeReloadBound = false;
            __tmWasHiddenAt = 0;
        } catch (e) {}
        try {
            if (__tmCalendarScheduleUpdatedHandler) {
                globalThis.__tmRuntimeEvents?.off?.(window, 'tm:calendar-schedule-updated', __tmCalendarScheduleUpdatedHandler);
                __tmCalendarScheduleUpdatedHandler = null;
            }
            if (__tmCalendarTxRefreshTimer) {
                clearTimeout(__tmCalendarTxRefreshTimer);
                __tmCalendarTxRefreshTimer = null;
            }
            __tmCalendarTxRefreshPending = false;
            if (__tmTodayScheduleRefreshTimer) {
                clearTimeout(__tmTodayScheduleRefreshTimer);
                __tmTodayScheduleRefreshTimer = null;
            }
            if (__tmCalendarBootstrapRetryTimer) {
                clearTimeout(__tmCalendarBootstrapRetryTimer);
                __tmCalendarBootstrapRetryTimer = null;
            }
        } catch (e) {}
        try {
            if (__tmTxTaskRefreshTimer) {
                clearTimeout(__tmTxTaskRefreshTimer);
                __tmTxTaskRefreshTimer = null;
            }
            if (state.listAutoLoadMoreHydrateTimer) {
                clearTimeout(state.listAutoLoadMoreHydrateTimer);
                state.listAutoLoadMoreHydrateTimer = 0;
            }
            state.listAutoLoadMoreHydrateToken = 0;
            if (state.scrollDeferredRefreshTimer) {
                clearTimeout(state.scrollDeferredRefreshTimer);
                state.scrollDeferredRefreshTimer = 0;
            }
            __tmTxTaskRefreshInFlight = false;
            __tmTxTaskRefreshDocIds.clear();
            __tmTxTaskRefreshBlockIds.clear();
            __tmRecentVisibleDateFallbackTasks.clear();
            __tmClearExternalTaskTxDirty();
        } catch (e) {}
        try { __tmClearTimelineTodayIndicatorTimer(); } catch (e) {}
        try { __tmSetInlineLoading(false); } catch (e) {}
        try {
            if (__tmTomatoAssociationHandler) {
                globalThis.__tmRuntimeEvents?.off?.(window, 'tomato:association-cleared', __tmTomatoAssociationHandler);
                __tmTomatoAssociationHandler = null;
            }
            if (__tmTomatoFocusModeChangedHandler) {
                globalThis.__tmRuntimeEvents?.off?.(window, 'tomato:focus-mode-changed', __tmTomatoFocusModeChangedHandler);
                __tmTomatoFocusModeChangedHandler = null;
            }
        } catch (e) {}
        try {
            const timer = globalThis.__tomatoTimer;
            if (timer && typeof timer === 'object' && __tmTomatoOriginalTimerFns) {
                Object.entries(__tmTomatoOriginalTimerFns).forEach(([k, fn]) => {
                    if (typeof fn === 'function') {
                        try { timer[k] = fn; } catch (e) {}
                    }
                });
            }
            __tmTomatoOriginalTimerFns = null;
            __tmTomatoTimerHooked = false;
        } catch (e) {}
        try {
            if (globalThis.__taskHorizonOnTomatoAssociationCleared) delete globalThis.__taskHorizonOnTomatoAssociationCleared;
            __tmTomatoAssociationListenerAdded = false;
        } catch (e) {}
        try {
            if (globalThis.__taskHorizonOnPinnedChanged) delete globalThis.__taskHorizonOnPinnedChanged;
            __tmPinnedListenerAdded = false;
        } catch (e) {}
        try { delete globalThis.__taskHorizonBuildTaskLikeFromBlockId; } catch (e) {}

        try {
            if (__tmDomReadyHandler) {
                globalThis.__tmRuntimeEvents?.off?.(document, 'DOMContentLoaded', __tmDomReadyHandler);
                __tmDomReadyHandler = null;
            }
        } catch (e) {}
        try {
            globalThis.__tmRuntimeEvents?.off?.(window, 'resize', __tmOnTopbarOverflowTooltipWindowResize);
            try { delete window.__tmTopbarOverflowTooltipWindowBound; } catch (e2) { window.__tmTopbarOverflowTooltipWindowBound = false; }
        } catch (e) {}
        try {
            globalThis.__tmRuntimeEvents?.off?.(window, 'resize', __tmOnFloatingTooltipWindowResize);
            globalThis.__tmRuntimeEvents?.off?.(window, 'scroll', __tmOnFloatingTooltipWindowScroll, true);
            try { delete window.__tmFloatingTooltipWindowBound; } catch (e2) { window.__tmFloatingTooltipWindowBound = false; }
        } catch (e) {}
        try {
            globalThis.__tmRuntimeEvents?.off?.(document, 'click', __tmOnTopbarSelectOutsideClick, true);
            try { delete window.__tmTopbarSelectOutsideBound; } catch (e2) { window.__tmTopbarSelectOutsideBound = false; }
        } catch (e) {}
        try {
            const eb = __tmDocMenuEventBus || globalThis.__tmHost?.getEventBus?.() || null;
            if (eb && typeof eb.off === 'function') {
                if (__tmEditorTitleIconMenuHandler) {
                    globalThis.__tmRuntimeEvents?.offEventBus?.('click-editortitleicon', __tmEditorTitleIconMenuHandler, eb);
                    __tmEditorTitleIconMenuHandler = null;
                }
                if (__tmDocTreeMenuHandler) {
                    globalThis.__tmRuntimeEvents?.offEventBus?.('open-menu-doctree', __tmDocTreeMenuHandler, eb);
                    __tmDocTreeMenuHandler = null;
                }
                if (__tmContentMenuHandler) {
                    globalThis.__tmRuntimeEvents?.offEventBus?.('open-menu-content', __tmContentMenuHandler, eb);
                    __tmContentMenuHandler = null;
                }
                if (__tmBlockIconMenuHandler) {
                    globalThis.__tmRuntimeEvents?.offEventBus?.('click-blockicon', __tmBlockIconMenuHandler, eb);
                    __tmBlockIconMenuHandler = null;
                }
            }
            __tmDocMenuEventBus = null;
        } catch (e) {}
        try {
            if (__tmNativeDocMenuCaptureHandler) {
                globalThis.__tmRuntimeEvents?.off?.(document, 'contextmenu', __tmNativeDocMenuCaptureHandler, true);
                globalThis.__tmRuntimeEvents?.off?.(document, 'mousedown', __tmNativeDocMenuCaptureHandler, true);
                globalThis.__tmRuntimeEvents?.off?.(document, 'click', __tmNativeDocMenuCaptureHandler, true);
                __tmNativeDocMenuCaptureHandler = null;
            }
            __tmLastRightClickedTitleProtyle = null;
            __tmLastRightClickedTitleAtMs = 0;
            __tmLastRightClickedBlockEl = null;
            __tmLastRightClickedBlockId = '';
            __tmLastRightClickedBlockAtMs = 0;
        } catch (e) {}
        try {
            if (__tmDocMenuObserver) {
                __tmDocMenuObserver.disconnect();
                __tmDocMenuObserver = null;
            }
        } catch (e) {}

        try {
            if (breadcrumbTimer != null) {
                clearTimeout(breadcrumbTimer);
                breadcrumbTimer = null;
            }
        } catch (e) {}

        try {
            if (__tmTopBarTimer != null) {
                clearTimeout(__tmTopBarTimer);
                __tmTopBarTimer = null;
            }
        } catch (e) {}
        try {
            if (__tmShellEntrancesRefreshRaf != null) {
                cancelAnimationFrame(__tmShellEntrancesRefreshRaf);
                __tmShellEntrancesRefreshRaf = null;
            }
        } catch (e) {}
        try {
            if (__tmMountRetryTimer != null) {
                clearTimeout(__tmMountRetryTimer);
                __tmMountRetryTimer = null;
            }
        } catch (e) {}

        try {
            if (__tmBreadcrumbObserver) {
                __tmBreadcrumbObserver.disconnect();
                __tmBreadcrumbObserver = null;
            }
        } catch (e) {}
        try { delete window.__tmTaskHorizonBreadcrumbObserver; } catch (e) {
            try { window.__tmTaskHorizonBreadcrumbObserver = undefined; } catch (e2) {}
        }

        try {
            if (__tmThemeModeObserver) {
                __tmThemeModeObserver.disconnect();
                __tmThemeModeObserver = null;
            }
        } catch (e) {}

        try {
            if (__tmResizeState) {
                document.removeEventListener('mousemove', __tmOnResize);
                document.removeEventListener('mouseup', __tmStopResize);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                __tmResizeState = null;
            }
        } catch (e) {}
        try {
            if (__tmTimelineSplitResizeOnMove) document.removeEventListener('mousemove', __tmTimelineSplitResizeOnMove);
            if (__tmTimelineSplitResizeOnUp) document.removeEventListener('mouseup', __tmTimelineSplitResizeOnUp);
            __tmTimelineSplitResizeOnMove = null;
            __tmTimelineSplitResizeOnUp = null;
            __tmTimelineSplitResizeState = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        } catch (e) {}
        try {
            if (__tmTimelineContentResizeOnMove) document.removeEventListener('mousemove', __tmTimelineContentResizeOnMove);
            if (__tmTimelineContentResizeOnUp) document.removeEventListener('mouseup', __tmTimelineContentResizeOnUp);
            __tmTimelineContentResizeOnMove = null;
            __tmTimelineContentResizeOnUp = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        } catch (e) {}
        try {
            if (__tmWhiteboardSidebarResizeOnMove) document.removeEventListener('mousemove', __tmWhiteboardSidebarResizeOnMove);
            if (__tmWhiteboardSidebarResizeOnUp) document.removeEventListener('mouseup', __tmWhiteboardSidebarResizeOnUp);
            __tmWhiteboardSidebarResizeOnMove = null;
            __tmWhiteboardSidebarResizeOnUp = null;
            __tmWhiteboardSidebarResizeState = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        } catch (e) {}

        try { __tmHideMobileMenu?.(); } catch (e) {}
        try {
            if (state.desktopMenuCloseTimer) {
                clearTimeout(state.desktopMenuCloseTimer);
                state.desktopMenuCloseTimer = null;
            }
            if (state.desktopMenuCloseHandler) {
                document.removeEventListener('click', state.desktopMenuCloseHandler);
                state.desktopMenuCloseHandler = null;
            }
        } catch (e) {}
        try {
            if (state.taskContextMenuCloseHandler) {
                __tmClearOutsideCloseHandler(state.taskContextMenuCloseHandler);
                state.taskContextMenuCloseHandler = null;
            }
        } catch (e) {}
        try {
            if (state.ganttContextMenuCloseBindTimer) {
                clearTimeout(state.ganttContextMenuCloseBindTimer);
                state.ganttContextMenuCloseBindTimer = null;
            }
            if (state.ganttContextMenuCloseHandler) {
                __tmClearOutsideCloseHandler(state.ganttContextMenuCloseHandler);
                state.ganttContextMenuCloseHandler = null;
            }
        } catch (e) {}
        try { __tmCloseInlineEditor(); } catch (e) {}
        try { __tmCloseCellEditor(false); } catch (e) {}
        try { globalThis.__tmCalendar?.cleanup?.(); } catch (e) {}
        try { delete globalThis.__tmCalendar; } catch (e) {}
        try { __tmUnbindMobileViewportAutoRefresh(); } catch (e) {}
        try { state.dockTaskPointerGestureCleanup?.(); } catch (e) {}
        try { state.dockTaskPointerDragAbort?.abort?.(); } catch (e) {}
        try { state.multiSelectPointerGestureCleanup?.(); } catch (e) {}
        try { state.multiSelectPointerSweepAbort?.abort?.(); } catch (e) {}
        try { __tmCloseMultiSelectMoreMenu(); } catch (e) {}
        state.dockTaskPointerGestureCleanup = null;
        state.dockTaskPointerDragAbort = null;
        state.dockTaskPointerSuppressClickUntil = 0;
        state.multiSelectPointerGestureCleanup = null;
        state.multiSelectPointerSweepAbort = null;

        try {
            if (state.modal) {
                state.modal.remove();
                state.modal = null;
            }
            if (state.settingsModal) {
                state.settingsModal.remove();
                state.settingsModal = null;
            }
            if (state.rulesModal) {
                state.rulesModal.remove();
                state.rulesModal = null;
            }
            if (state.priorityModal) {
                state.priorityModal.remove();
                state.priorityModal = null;
            }
            if (state.semanticDateConfirmModal) {
                state.semanticDateConfirmModal.remove();
                state.semanticDateConfirmModal = null;
            }
        } catch (e) {}

        try {
            const promptModal = document.querySelector('.tm-prompt-modal');
            if (promptModal) promptModal.remove();
        } catch (e) {}

        try {
            const ctxMenu = document.getElementById('tm-task-context-menu');
            if (ctxMenu) ctxMenu.remove();
        } catch (e) {}
        try {
            const desktopMenu = document.getElementById('tmDesktopMenu');
            if (desktopMenu) __tmAnimatePopupOutAndRemove(desktopMenu);
        } catch (e) {}
        try { __tmHideDocTabMenu?.(); } catch (e) {}
        try {
            const h = state.docTabTouchDelegationHandlers;
            if (h) {
                try { document.removeEventListener('touchstart', h.start); } catch (e2) {}
                try { document.removeEventListener('touchmove', h.move); } catch (e2) {}
                try { document.removeEventListener('touchend', h.end); } catch (e2) {}
                try { document.removeEventListener('touchcancel', h.end); } catch (e2) {}
            }
            state.docTabTouchDelegationHandlers = null;
            state.docTabTouchDelegationBound = false;
            state.docTabTouchActive = false;
            state.docTabTouchActiveDocId = null;
            if (state.docTabLongPressTimer) {
                clearTimeout(state.docTabLongPressTimer);
                state.docTabLongPressTimer = null;
            }
            state.docTabTouchMoved = false;
        } catch (e) {}

        try {
            const h = state.allDocTabTouchDelegationHandlers;
            if (h) {
                try { document.removeEventListener('touchstart', h.start); } catch (e2) {}
                try { document.removeEventListener('touchmove', h.move); } catch (e2) {}
                try { document.removeEventListener('touchend', h.end); } catch (e2) {}
                try { document.removeEventListener('touchcancel', h.end); } catch (e2) {}
            }
            state.allDocTabTouchDelegationHandlers = null;
            state.allDocTabTouchDelegationBound = false;
        } catch (e) {}

        try {
            __tmClearAllDocTabLongPressTimer();
            state.allDocTabLongPressFired = false;
            state.allDocTabLongPressMoved = false;
            state.allDocTabLongPressTrigger = null;
            state.allDocTabLongPressStartX = 0;
            state.allDocTabLongPressStartY = 0;
            state.allDocTabSuppressClickUntil = 0;
            state.allDocTabIgnoreContextMenuUntil = 0;
        } catch (e) {}

        try {
            const h = state.topbarManagerIconTouchDelegationHandlers;
            if (h) {
                try { document.removeEventListener('touchstart', h.start); } catch (e2) {}
                try { document.removeEventListener('touchmove', h.move); } catch (e2) {}
                try { document.removeEventListener('touchend', h.end); } catch (e2) {}
                try { document.removeEventListener('touchcancel', h.end); } catch (e2) {}
            }
            state.topbarManagerIconTouchDelegationHandlers = null;
            state.topbarManagerIconTouchDelegationBound = false;
        } catch (e) {}

        try {
            __tmClearTopbarManagerIconLongPressTimer();
            state.topbarManagerIconLongPressFired = false;
            state.topbarManagerIconLongPressMoved = false;
            state.topbarManagerIconTrigger = null;
            state.topbarManagerIconLongPressStartX = 0;
            state.topbarManagerIconLongPressStartY = 0;
            state.topbarManagerIconSuppressClickUntil = 0;
            state.topbarManagerIconIgnoreContextMenuUntil = 0;
            state.__tmPluginIconLongPressing = false;
        } catch (e) {}

        try { __tmRemoveBreadcrumbButton({ destroy: true }); } catch (e) {}

        try {
            const shouldFlushMetaStore = !!MetaStore.saveTimer;
            if (MetaStore.saveTimer) {
                clearTimeout(MetaStore.saveTimer);
                MetaStore.saveTimer = null;
            }
            try {
                if (shouldFlushMetaStore) {
                    void MetaStore.saveNow?.();
                }
            } catch (e2) {}
        } catch (e) {}
        try {
            if (SemanticDateRecognizedStore?.saveTimer) {
                clearTimeout(SemanticDateRecognizedStore.saveTimer);
                SemanticDateRecognizedStore.saveTimer = null;
            }
            try {
                if (SemanticDateRecognizedStore?.saveDirty) {
                    void SemanticDateRecognizedStore.saveNow?.();
                }
            } catch (e2) {}
        } catch (e) {}
        try {
            if (__tmWhiteboardViewSaveTimer) {
                clearTimeout(__tmWhiteboardViewSaveTimer);
                __tmWhiteboardViewSaveTimer = null;
            }
        } catch (e) {}
        try {
            if (WhiteboardStore?.saveTimer) {
                clearTimeout(WhiteboardStore.saveTimer);
                WhiteboardStore.saveTimer = null;
            }
            try {
                if (WhiteboardStore?.saveDirty) {
                    void WhiteboardStore.saveNow?.();
                }
            } catch (e2) {}
        } catch (e) {}
        try {
            if (SettingsStore?.saveTimer) {
                clearTimeout(SettingsStore.saveTimer);
                SettingsStore.saveTimer = null;
            }
            try {
                if (SettingsStore?.saveDirty && typeof SettingsStore.syncToLocal === 'function') {
                    SettingsStore.syncToLocal();
                }
            } catch (e2) {}
            try {
                if (SettingsStore?.saveDirty) {
                    void SettingsStore.flushSave?.();
                }
            } catch (e2) {}
        } catch (e) {}

        try {
            if (__tmUndoState.keydownHandler) {
                globalThis.__tmRuntimeEvents?.off?.(document, 'keydown', __tmUndoState.keydownHandler, true);
                __tmUndoState.keydownHandler = null;
            }
            __tmUndoState.undoStack = [];
            __tmUndoState.redoStack = [];
            __tmUndoState.applying = false;
        } catch (e) {}

        try { __tmStyleEl?.remove?.(); } catch (e) {}
        try { document.getElementById('sy-custom-props-floatbar-style')?.remove?.(); } catch (e) {}
        try { document.querySelectorAll('.sy-custom-props-floatbar, .sy-custom-props-floatbar__select, .sy-custom-props-floatbar__input-editor').forEach(el => el.remove()); } catch (e) {}

        try { delete globalThis.__taskHorizonMount; } catch (e) {}
        try {
            const keys = Array.isArray(__tmExplicitWindowExportKeys) ? __tmExplicitWindowExportKeys : [];
            keys.forEach((k) => {
                if (!k) return;
                const snapshot = __tmExplicitWindowExportSnapshot instanceof Map
                    ? (__tmExplicitWindowExportSnapshot.get(k) || null)
                    : null;
                if (snapshot?.hasOwn && snapshot.descriptor) {
                    try {
                        Object.defineProperty(window, k, snapshot.descriptor);
                        return;
                    } catch (e) {}
                    try {
                        if (Object.prototype.hasOwnProperty.call(snapshot.descriptor, 'value')) {
                            window[k] = snapshot.descriptor.value;
                            return;
                        }
                    } catch (e) {}
                }
                try { delete window[k]; } catch (e) {
                    try { window[k] = undefined; } catch (e2) {}
                }
            });
        } catch (e) {}
        try { delete window[__tmNsKey]; } catch (e) {
            try { window[__tmNsKey] = undefined; } catch (e2) {}
        }
        try { delete globalThis.__TaskHorizonLoaded; } catch (e) {}
        try { delete globalThis.__TaskManagerCleanup; } catch (e) {}
    }

    // 暴露清理函数给插件卸载调用
    globalThis.__TaskManagerCleanup = __tmCleanup;
    // 暴露挂载函数供自定义 Tab 使用
    globalThis.__taskHorizonMount = (el) => {
        try {
            if (el instanceof Element) __tmClearKeepaliveSnapshots(el);
        } catch (e) {}
        __tmSetMount(el);
        const reusedModal = (() => {
            try { return __tmTryReattachExistingModalToMount(el); } catch (e) { return false; }
        })();
        if (reusedModal) {
            try {
                const liveModal = globalThis.__tmRuntimeState?.getModal?.() || state.modal;
                if (globalThis.__tmRuntimeState?.hasLiveModal?.(liveModal) ?? (state.modal && document.body.contains(state.modal))) {
                    try { __tmScheduleReminderTaskNameMarksRefresh(liveModal, true); } catch (e) {}
                    try { __tmScheduleTodayScheduledTaskNameMarksRefresh(liveModal, true); } catch (e) {}
                }
            } catch (e) {}
            return;
        }
        openManager({ skipEnsureTabOpened: true, preserveViewMode: true }).catch((e) => {
            try { console.error('[task-horizon] openManager failed:', e); } catch (e2) {}
            try { hint(`❌ 加载失败: ${e?.message || String(e)}`, 'error'); } catch (e3) {}
            try {
                try { if (__tmMountRetryTimer) { clearTimeout(__tmMountRetryTimer); __tmMountRetryTimer = null; } } catch (e4) {}
                __tmMountRetryTimer = setTimeout(() => {
                    if (document.visibilityState === 'hidden') return;
                    __tmSafeOpenManager('mount-retry');
                }, 900);
            } catch (e4) {}
        });
    };

