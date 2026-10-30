    // Date calculation and persistence belong to the kernel. This bridge only
    // projects committed results and reconciles authoritative document refreshes.
    function __tmApplyDateRollupReceipt(receipt) {
        const updates = receipt?.dateRollupUpdates || [];
        for (const update of updates) {
            const id = String(update.taskID || '').trim();
            if (!id || !update.patch) continue;
            __tmApplyAttrPatchLocally(id, update.patch, { render: false, source: 'date-rollup' });
            // Promote persisted dates into the confirmed base as well as the
            // mounted mirrors; a notification alone leaves projected reads stale.
            globalThis.__tmTaskMutationBus?.apply?.({
                type: 'taskPatch', phase: 'local', taskId: id,
                docId: update.documentID, source: 'date-rollup', patch: update.patch,
            });
            __tmDispatchTaskAttrPatchUpdated(id, update.patch, { source: 'date-rollup' });
        }
        if (receipt?.dateRollupError) hint(__tmT("task.parentTaskDateRollUpFailed", { dateRollupError: receipt.dateRollupError }), 'error');
    }
    globalThis.__tmApplyDateRollupReceipt = __tmApplyDateRollupReceipt;

    const __tmDateRollupDirtyDocuments = new Set();
    let __tmDateRollupRefreshRunning = false;
    function __tmScheduleDateRollupReconcile(docIds = []) {
        docIds.forEach(id => { if (id) __tmDateRollupDirtyDocuments.add(String(id)); });
        if (__tmDateRollupRefreshRunning || !__tmDateRollupDirtyDocuments.size) return;
        __tmDateRollupRefreshRunning = true;
        Promise.resolve().then(async () => {
            while (__tmDateRollupDirtyDocuments.size) {
                const documentIDs = Array.from(__tmDateRollupDirtyDocuments);
                __tmDateRollupDirtyDocuments.clear();
                await __tmExecuteTaskCommandGateway({ action: 'reconcileDates', documentIDs }, __tmT("task.parentTaskDateRollUp"));
            }
        }).catch(error => {
            console.warn('[task-horizon] date-rollup-refresh-failed', error);
        }).finally(() => { __tmDateRollupRefreshRunning = false; });
    }
    globalThis.__tmScheduleDateRollupReconcile = __tmScheduleDateRollupReconcile;

    window.tmSetTaskDateMode = async function(taskId, mode) {
        if (!['manual', 'rollup'].includes(mode)) throw new Error(__tmT("task.invalidDateMode"));
        // Capture the whole transition for one undo, including the dates replaced
        // by enabling rollup. Derived updates themselves never create undo items.
        const task = await __tmReadTaskMutationBaseline(taskId);
        if (!task) throw new Error(__tmT("kernel.noTaskFound"));
        const inversePatch = {
            dateMode: globalThis.__tmIsTaskDateRollup(task) ? 'rollup' : 'manual',
            startDate: String(task.startDate || task.start_date || ''),
            completionTime: String(task.completionTime || task.completion_time || ''),
        };
        const result = await __tmApplyTaskMetaPatchWithUndo(taskId, { dateMode: mode }, {
            source: 'task-date-mode', label: __tmT("kernel.dateMode"), wait: true,
            renderOptimistic: false, recordUndo: false, showErrorHint: false,
        });
        const current = await __tmReadTaskMutationBaseline(taskId);
        if (!current) throw new Error(__tmT("task.dateModeSavedButTheTaskCouldNotBe"));
        const patch = { dateMode: mode, startDate: String(current?.startDate || current?.start_date || ''),
            completionTime: String(current?.completionTime || current?.completion_time || '') };
        __tmApplyAttrPatchLocally(taskId, patch, { render: false, source: 'task-date-mode' });
        globalThis.__tmTaskMutationBus?.apply?.({ type: 'taskPatch', phase: 'local', taskId,
            docId: task.root_id || task.docId, source: 'task-date-mode', patch });
        __tmDispatchTaskAttrPatchUpdated(taskId, patch, { source: 'task-date-mode' });
        if (!__tmUndoState.applying && result?.changed !== false) {
            __tmPushUndoRecord({ type: 'taskPatch', taskId, patch, inversePatch, label: __tmT("kernel.dateMode"), source: 'task-date-mode' });
        }
        return { ...task, ...current, ...patch, date_mode: mode,
            start_date: patch.startDate, completion_time: patch.completionTime };
    };
