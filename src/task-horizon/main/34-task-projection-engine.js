    (function () {
        const normalizeId = (value) => String(value || '').trim();
        const schema = globalThis.__tmTaskFieldSchema;
        const getFieldGroup = (name) => Object.freeze(schema?.getGroup?.(name) || []);
        const SCORE_SOURCE_FIELDS = getFieldGroup('scoreSource');
        const COMPLETION_FIELDS = getFieldGroup('completion');
        const TIME_FIELDS = getFieldGroup('time');
        const DOCUMENT_FIELDS = getFieldGroup('document');
        const SEARCH_FIELDS = getFieldGroup('search');
        const CALENDAR_FIELDS = getFieldGroup('calendar');
        let runtimeHandler = null;

        const normalizeField = (value) => {
            const raw = normalizeId(value);
            if (!raw) return '';
            return schema?.normalizeField?.(raw) || raw;
        };

        const collectPatchFields = (patch = {}, explicitFields = []) => {
            const out = new Set();
            const source = patch && typeof patch === 'object' ? patch : {};
            const add = (value) => {
                const field = normalizeField(value);
                if (field) out.add(field);
            };
            (Array.isArray(explicitFields) ? explicitFields : []).forEach(add);
            Object.keys(source).forEach((key) => {
                add(key);
                if (normalizeField(key) !== 'customFieldValues') return;
                const values = source[key];
                if (!(values && typeof values === 'object' && !Array.isArray(values))) return;
                Object.keys(values).forEach((fieldId) => {
                    const id = normalizeId(fieldId);
                    if (id) out.add(`customField:${id}`);
                });
            });
            return out;
        };

        const addRuleDependency = (set, fieldInput) => {
            const field = normalizeField(fieldInput);
            if (!field) return;
            set.add(field);
            if (field === 'priorityScore') SCORE_SOURCE_FIELDS.forEach((item) => set.add(item));
        };

        const compileRuleDependencies = (rule = null) => {
            const filterFields = new Set();
            const sortFields = new Set();
            if (rule && typeof rule === 'object') {
                (Array.isArray(rule.conditions) ? rule.conditions : []).forEach((condition) => {
                    addRuleDependency(filterFields, condition?.field);
                });
                (Array.isArray(rule.sort) ? rule.sort : []).forEach((sortRule) => {
                    addRuleDependency(sortFields, sortRule?.field);
                });
            }
            return { filterFields, sortFields };
        };

        const fieldsIntersect = (changedFields, dependencies) => {
            for (const field of changedFields) {
                if (dependencies.has(field)) return true;
            }
            return false;
        };

        const isTaskCompleted = (task) => {
            if (!(task && typeof task === 'object')) return false;
            try {
                const resolver = globalThis.__tmTaskBoundary?.isTaskCompleted;
                if (typeof resolver === 'function') return resolver(task) === true;
            } catch (e) {}
            return task.done === true;
        };

        const isKanbanTaskVisibleByCompletion = (task, showCompletedTasks = false) => {
            if (!(task && typeof task === 'object')) return false;
            return showCompletedTasks === true || !isTaskCompleted(task);
        };

        const analyzePatch = (patch = {}, contextInput = {}, explicitFields = []) => {
            const context = contextInput && typeof contextInput === 'object' ? contextInput : {};
            const changedFields = collectPatchFields(patch, explicitFields);
            const ruleDependencies = compileRuleDependencies(context.rule);
            const groupMode = normalizeId(context.groupMode) || 'none';
            const viewMode = normalizeId(context.viewMode);
            const kanbanMode = normalizeId(context.kanbanMode);
            const kanbanCardFields = new Set((Array.isArray(context.kanbanCardFields) ? context.kanbanCardFields : [])
                .map(normalizeField)
                .filter(Boolean));
            const has = (fields) => fields.some((field) => changedFields.has(field));
            const filter = fieldsIntersect(changedFields, ruleDependencies.filterFields)
                || (context.searchActive === true && has(SEARCH_FIELDS))
                || has(COMPLETION_FIELDS);
            const sort = fieldsIntersect(changedFields, ruleDependencies.sortFields)
                || changedFields.has('pinned')
                || (groupMode === 'none' && has(['priority', 'priorityScore']));
            let group = false;
            if (groupMode === 'time' && has(TIME_FIELDS)) group = true;
            else if (groupMode === 'task' && changedFields.has('content')) group = true;
            else if (groupMode === 'doc' && has(DOCUMENT_FIELDS)) group = true;
            else if (groupMode === 'quadrant' && (has(TIME_FIELDS) || has(['priority', 'priorityScore']))) group = true;
            if (viewMode === 'kanban') {
                if (has(['root_id', 'docId'])) group = true;
                if (kanbanMode === 'time' && has(TIME_FIELDS)) group = true;
                if (kanbanMode === 'heading' && has(DOCUMENT_FIELDS)) group = true;
                if (kanbanCardFields.has('h2') && has(DOCUMENT_FIELDS)) group = true;
            }
            const projection = filter || sort || group;
            return {
                changedFields: Array.from(changedFields),
                filter,
                sort,
                group,
                projection,
                calendar: has(CALENDAR_FIELDS),
                requiresClosure: has(COMPLETION_FIELDS) || changedFields.has('parentTaskId'),
            };
        };

        const resolveCompletionChanged = (mutation = {}, patch = {}) => {
            const nextPatch = patch && typeof patch === 'object' ? patch : {};
            const hasDone = Object.prototype.hasOwnProperty.call(nextPatch, 'done');
            const hasStatus = Object.prototype.hasOwnProperty.call(nextPatch, 'customStatus');
            const hasCompletedAt = Object.prototype.hasOwnProperty.call(nextPatch, 'taskCompleteAt');
            if (!hasDone && !hasStatus && !hasCompletedAt) return null;
            if (!hasDone) return hasCompletedAt && !hasStatus ? false : undefined;

            const data = mutation?.data && typeof mutation.data === 'object' ? mutation.data : {};
            const statusBefore = data.statusBefore && typeof data.statusBefore === 'object' ? data.statusBefore : null;
            if (statusBefore && Object.prototype.hasOwnProperty.call(statusBefore, 'done')) {
                return !!statusBefore.done !== !!nextPatch.done;
            }
            if (Object.prototype.hasOwnProperty.call(data, 'previousDone')) {
                return !!data.previousDone !== !!nextPatch.done;
            }
            const inversePatch = mutation?.inversePatch && typeof mutation.inversePatch === 'object' ? mutation.inversePatch : null;
            if (inversePatch && Object.prototype.hasOwnProperty.call(inversePatch, 'done')) {
                return !!inversePatch.done !== !!nextPatch.done;
            }
            return undefined;
        };

        const mergeChangeSets = (entries = []) => {
            const fieldPatchByTask = new Map();
            const taskIds = new Set();
            const upsertedTaskIds = new Set();
            const deletedTaskIds = new Set();
            const affectedGroupIds = new Set();
            const affectedDocumentIds = new Set();
            const placementChanges = [];
            let structural = false;
            let reason = '';
            const addIds = (target, values) => {
                (Array.isArray(values) ? values : []).forEach((value) => {
                    const id = normalizeId(value?.taskID || value?.taskId || value);
                    if (id) target.add(id);
                });
            };
            (Array.isArray(entries) ? entries : []).forEach((entry) => {
                const mutation = entry?.mutation && typeof entry.mutation === 'object' ? entry.mutation : {};
                const changeSet = entry?.changeSet && typeof entry.changeSet === 'object' ? entry.changeSet : {};
                reason = normalizeId(mutation.source) || reason;
                addIds(upsertedTaskIds, changeSet.upsertedTaskIds);
                addIds(deletedTaskIds, changeSet.deletedTaskIds);
                addIds(affectedGroupIds, changeSet.affectedGroupIds);
                addIds(affectedDocumentIds, changeSet.affectedDocumentIds);
                addIds(taskIds, changeSet.upsertedTaskIds);
                addIds(taskIds, changeSet.deletedTaskIds);
                if (changeSet.structural === true) structural = true;
                (Array.isArray(changeSet.placementChanges) ? changeSet.placementChanges : []).forEach((item) => {
                    placementChanges.push(item);
                    const id = normalizeId(item?.taskId || item?.taskID);
                    if (id) taskIds.add(id);
                });
                (Array.isArray(changeSet.fieldChanges) ? changeSet.fieldChanges : []).forEach((item) => {
                    const taskId = normalizeId(item?.taskId || item?.taskID);
                    if (!taskId) return;
                    taskIds.add(taskId);
                    const previous = fieldPatchByTask.get(taskId) || {
                        taskId,
                        patch: {},
                        fields: new Set(),
                        completionChanged: undefined,
                        completionChangeUnknown: false,
                    };
                    const patch = item?.patch && typeof item.patch === 'object' ? item.patch : {};
                    const completionChanged = resolveCompletionChanged(mutation, patch);
                    if (completionChanged === true) previous.completionChanged = true;
                    else if (completionChanged === false && previous.completionChanged !== true) previous.completionChanged = false;
                    else if (completionChanged === undefined) previous.completionChangeUnknown = true;
                    const previousCustomFieldValues = (previous.patch.customFieldValues
                        && typeof previous.patch.customFieldValues === 'object'
                        && !Array.isArray(previous.patch.customFieldValues))
                        ? previous.patch.customFieldValues
                        : {};
                    previous.patch = { ...previous.patch, ...patch };
                    if (Object.prototype.hasOwnProperty.call(patch, 'customFieldValues')) {
                        previous.patch.customFieldValues = {
                            ...previousCustomFieldValues,
                            ...((patch.customFieldValues && typeof patch.customFieldValues === 'object')
                                ? patch.customFieldValues
                                : {}),
                        };
                    }
                    collectPatchFields(patch, item?.fields).forEach((field) => previous.fields.add(field));
                    fieldPatchByTask.set(taskId, previous);
                });
            });
            return {
                fieldChanges: Array.from(fieldPatchByTask.values()).map((item) => ({
                    taskId: item.taskId,
                    patch: item.patch,
                    fields: Array.from(item.fields),
                    ...((item.completionChanged === true || (item.completionChanged === false && item.completionChangeUnknown !== true))
                        ? { completionChanged: item.completionChanged }
                        : {}),
                })),
                taskIds: Array.from(taskIds),
                upsertedTaskIds: Array.from(upsertedTaskIds),
                deletedTaskIds: Array.from(deletedTaskIds),
                affectedGroupIds: Array.from(affectedGroupIds),
                affectedDocumentIds: Array.from(affectedDocumentIds),
                placementChanges,
                structural: structural || placementChanges.length > 0 || deletedTaskIds.size > 0,
                reason: reason || 'change-set',
            };
        };

        const engine = {
            normalizeField,
            collectPatchFields: (patch, fields) => Array.from(collectPatchFields(patch, fields)),
            compileRuleDependencies,
            analyzePatch,
            mergeChangeSets,
            isTaskCompleted,
            isKanbanTaskVisibleByCompletion,
            setRuntimeHandler(handler) {
                runtimeHandler = typeof handler === 'function' ? handler : null;
                return !!runtimeHandler;
            },
            flush(entries = []) {
                const batch = mergeChangeSets(entries);
                if (typeof runtimeHandler !== 'function') return false;
                return runtimeHandler(batch, entries);
            },
        };

        globalThis.__tmTaskProjectionEngine = engine;
        globalThis.__tmTaskBoundary = {
            ...(globalThis.__tmTaskBoundary || {}),
            projection: engine,
            getProjectionEngine: () => engine,
        };
    })();
