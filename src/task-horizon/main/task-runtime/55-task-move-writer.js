    function __tmGetMoveWriterDocName(docId) {
        const did = String(docId || '').trim();
        if (!did) return '';
        try {
            return String((Array.isArray(state.allDocuments) ? state.allDocuments : []).find(d => String(d?.id || '').trim() === did)?.name || '').trim();
        } catch (e) {
            return '';
        }
    }

    function __tmPatchMovedTaskLocal(taskOrId, patch, source = 'move-task') {
        const id = String((taskOrId && typeof taskOrId === 'object') ? (taskOrId.id || taskOrId.blockId) : taskOrId || '').trim();
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        if (!id || !Object.keys(nextPatch).length) return false;
        try {
            if (globalThis.__tmTaskStore?.patchLocal?.(id, nextPatch, { source })) return true;
        } catch (e) {}
        return false;
    }

    function __tmPatchMovedTaskChildrenLocal(parentTask, patch, source = 'move-task-children') {
        const children = Array.isArray(parentTask?.children) ? parentTask.children : [];
        children.forEach((child) => {
            if (!child || !child.id) return;
            const childTask = globalThis.__tmRuntimeState?.getFlatTaskById?.(child.id) || state.flatTasks?.[child.id] || child;
            __tmPatchMovedTaskLocal(childTask, patch, source);
            __tmPatchMovedTaskChildrenLocal(childTask, patch, source);
        });
    }

    async function __tmMoveTaskToDoc(taskId, targetDocId, opts = {}) {
        const id = String(taskId || '').trim();
        const did = String(targetDocId || '').trim();
        if (!id || !did) return false;
        const o = (opts && typeof opts === 'object') ? opts : {};
        const t = state.flatTasks?.[id];
        const fromDocId = String(t?.docId || t?.root_id || '').trim();
        if (fromDocId && fromDocId === did) return false;
        const topListId = await API.getFirstDirectChildListIdOfDoc(did);
        if (topListId) {
            await __tmMoveBlockViaBackendAdapter(id, { parentID: topListId });
        } else {
            await __tmMoveBlockViaBackendAdapter(id, { parentID: did });
        }
        try { await __tmFlushBackendAdapterTransaction(); } catch (e) {}
        try {
            [fromDocId, did].filter(Boolean).forEach((docId) => __tmInvalidateTasksQueryCacheByDocId(docId));
        } catch (e) {}
        try {
            if (t) {
                const name = __tmGetMoveWriterDocName(did);
                const patch = { root_id: did, docId: did };
                if (name) {
                    patch.doc_name = name;
                    patch.docName = name;
                }
                __tmPatchMovedTaskLocal(id, patch, 'move-task-to-doc');
                __tmPatchMovedTaskChildrenLocal(t, patch, 'move-task-to-doc-child');
            }
        } catch (e) {}
        if (!o.silentHint) {
            try { hint('✅ 任务已移动', 'success'); } catch (e) {}
        }
        return true;
    }

    async function __tmMoveTaskToDocTop(taskId, targetDocId, opts = {}) {
        const id = String(taskId || '').trim();
        const did = String(targetDocId || '').trim();
        if (!id || !did) return false;
        const o = (opts && typeof opts === 'object') ? opts : {};
        const t = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
        const fromDocId = String(t?.docId || t?.root_id || '').trim();

        try {
            let firstChildId = '';
            try { firstChildId = String(await API.getFirstDirectChildIdOfDoc(did) || '').trim(); } catch (e) { firstChildId = ''; }

            if (firstChildId) {
                await __tmMoveBlockViaBackendAdapter(id, { previousID: '', nextID: firstChildId, parentID: did });
            } else {
                await __tmMoveBlockViaBackendAdapter(id, { parentID: did });
            }
        } catch (e) {
            console.error('移动任务到文档顶部失败:', e);
            try {
                await __tmMoveBlockViaBackendAdapter(id, { parentID: did });
            } catch (e2) {
                console.error('备用方案也失败:', e2);
                return false;
            }
        }

        try { await __tmFlushBackendAdapterTransaction(); } catch (e) {}
        try {
            [fromDocId, did].filter(Boolean).forEach((docId) => __tmInvalidateTasksQueryCacheByDocId(docId));
        } catch (e) {}
        try {
            if (t) {
                const name = __tmGetMoveWriterDocName(did);
                const basePatch = { root_id: did, docId: did };
                if (name) {
                    basePatch.doc_name = name;
                    basePatch.docName = name;
                }
                if (o.clearHeading === true || (fromDocId && fromDocId !== did)) {
                    Object.assign(basePatch, {
                        h2: '',
                        h2Id: '',
                        h2Path: '',
                        h2Sort: Number.NaN,
                        h2Created: '',
                        h2Rank: Number.NaN,
                    });
                }
                __tmPatchMovedTaskLocal(id, basePatch, 'move-task-to-doc-top');
                __tmPatchMovedTaskChildrenLocal(t, basePatch, 'move-task-to-doc-top-child');
            }
        } catch (e) {}
        if (!o.silentHint) {
            try { hint('✅ 任务已移动', 'success'); } catch (e) {}
        }
        return true;
    }

    async function __tmMoveTaskToHeading(taskId, targetDocId, headingId, opts = {}) {
        const id = String(taskId || '').trim();
        const did = String(targetDocId || '').trim();
        const hid = String(headingId || '').trim();
        if (!id || !did || !hid) return false;
        const o = (opts && typeof opts === 'object') ? opts : {};
        const t = globalThis.__tmRuntimeState?.getFlatTaskById?.(id) || state.flatTasks?.[id];
        const fromDocId = String(t?.docId || t?.root_id || '').trim();

        try {
            await __tmMoveBlockViaBackendAdapter(id, { previousID: hid, parentID: did });
        } catch (e) {
            console.error('移动任务到标题后面失败:', e);
            return false;
        }

        try { await __tmFlushBackendAdapterTransaction(); } catch (e) {}
        try {
            [fromDocId, did].filter(Boolean).forEach((docId) => __tmInvalidateTasksQueryCacheByDocId(docId));
        } catch (e) {}
        try {
            if (t) {
                const name = __tmGetMoveWriterDocName(did);
                const headings = state.kanbanDocHeadingsByDocId?.[did];
                const h = Array.isArray(headings) ? headings.find((x) => String(x?.id || '').trim() === hid) : null;
                const headingText = __tmNormalizeHeadingText(h?.content);
                const headingRank = Number(h?.rank);
                const patch = {
                    root_id: did,
                    docId: did,
                    h2: headingText,
                    h2Id: hid,
                    h2Rank: headingRank,
                    h2Path: '',
                    h2Sort: Number.NaN,
                    h2Created: '',
                };
                if (name) {
                    patch.doc_name = name;
                    patch.docName = name;
                }
                if (fromDocId && fromDocId !== did) {
                    patch.parentTaskId = '';
                }
                __tmPatchMovedTaskLocal(id, patch, 'move-task-to-heading');
                __tmPatchMovedTaskChildrenLocal(t, {
                    h2Id: hid,
                    h2: headingText,
                    h2Rank: headingRank,
                }, 'move-task-to-heading-child');
                if (state.pendingInsertedTasks?.[id]) {
                    globalThis.__tmTaskStore?.patchPending?.(id, patch, { source: 'move-task-to-heading' });
                }
            }
        } catch (e) {}
        if (!o.silentHint) {
            try { hint('✅ 任务已移动到标题后面', 'success'); } catch (e) {}
        }
        return true;
    }
