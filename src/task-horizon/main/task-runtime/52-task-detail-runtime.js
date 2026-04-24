    function __tmBuildTaskDetailInnerHtml(task, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const embedded = !!opts.embedded;
        const floating = !!opts.floating;
        const closeable = !!opts.closeable;
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
        const curReminderTip = curHasReminder
            ? (curReminderText ? `${curReminderSnapshot?.isOverdue ? '最近一次提醒' : '提醒'}：${curReminderText}` : '已添加提醒')
            : '提醒';
        const curRepeatRule = __tmGetTaskRepeatRule(task);
        const curRepeatSummary = __tmGetTaskRepeatSummary(curRepeatRule, {
            startDate: task?.startDate,
            completionTime: task?.completionTime,
        });
        const startValue = __tmNormalizeDateOnly(String(task?.startDate || '').trim());
        const endValue = __tmNormalizeDateOnly(String(task?.completionTime || '').trim());
        const durationValue = String(task?.duration || '').trim();
        const spentValue = __tmGetTaskSpentDisplay(task);
        const remarkValue = __tmNormalizeRemarkMarkdown(task?.remark || '');
        const cleanDetailTitle = (value, fallback = '') => {
            const stripTaskSyntax = (input) => String(input || '')
                .replace(/^[\s>*-]*\[(?:[xX ]?)\]\s*/, '')
                .replace(/^[\s>*-]*\[\]\s*/, '')
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
        const docName = String(task?.docName || '').trim();
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
            const headingIconHtml = __tmRenderHeadingLevelInlineIcon(headingLevel, { size: 14 });
            locationItems.push(isOtherBlock
                ? `<span class="tm-checklist-meta-chip" title="来源位置">${headingIconHtml} ${esc(String(headingName || task?.otherBlockTypeLabel || '无'))}</span>`
                : `<button type="button" class="tm-checklist-meta-chip tm-task-detail-location-chip" data-tm-detail="location-heading"${detailTip('点击切换标题', { ariaLabel: false })}>${headingIconHtml} ${esc(String(headingName || '无'))}</button>`);
        }
        locationItems.push(`<button type="button" class="tm-checklist-meta-chip tm-task-detail-location-chip" data-tm-detail="jump"${detailTip('跳转到任务', { ariaLabel: false })}>${__tmRenderLucideIcon('map-pin')} 跳转</button>`);
        const locationHtml = `
                <div class="tm-task-detail-location">
                    ${locationItems.join('')}
                </div>
            `;
        const headerActionsHtml = `
                <div class="tm-task-detail-header-actions">
                    <button class="bc-btn bc-btn--sm tm-task-detail-icon-btn" type="button" data-tm-detail="more"${detailTip('更多操作', { ariaLabel: '更多任务操作' })}>${__tmRenderLucideIcon('dots-three')}</button>
                    ${useCompactHeaderActions ? '' : `<button class="bc-btn bc-btn--sm tm-task-detail-icon-btn" type="button" data-tm-detail="save"${detailTip('保存', { ariaLabel: '保存任务详情' })}>${__tmRenderLucideIcon('save')}</button>`}
                    ${useCompactHeaderActions ? '' : ((floating || closeable || !embedded) ? `<button class="bc-btn bc-btn--sm tm-task-detail-close-btn tm-task-detail-icon-btn" type="button" data-tm-detail="close"${detailTip('关闭', { ariaLabel: '关闭任务详情' })}>${__tmRenderLucideIcon('x')}</button>` : '')}
                </div>
            `;
        return `
            <div class="${embedded ? 'tm-checklist-detail-card' : 'tm-task-detail'} tm-task-detail-shell" data-tm-detail-mode="${embedded ? 'embedded' : 'standalone'}" role="dialog" aria-modal="${embedded ? 'false' : 'true'}">
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
                        <button type="button" class="bc-btn bc-btn--sm tm-task-detail-core-chip ${endValue ? 'has-value' : ''}" data-tm-detail-date-trigger="completionTime"${detailTip('截止日期', { ariaLabel: false })}>
                            <span class="tm-task-detail-core-chip__face" data-tm-detail-chip-face="completionTime">${__tmBuildTaskDetailCoreChipFace('completionTime', endValue)}</span>
                        </button>
                        <input type="hidden" data-tm-detail="duration" value="${esc(durationValue)}">
                        <button type="button" class="bc-btn bc-btn--sm tm-task-detail-core-chip ${durationValue ? 'has-value' : ''}" data-tm-detail-duration-trigger${detailTip('时长', { ariaLabel: false })}>
                            <span class="tm-task-detail-core-chip__face" data-tm-detail-chip-face="duration">${__tmBuildTaskDetailCoreChipFace('duration', durationValue)}</span>
                        </button>
                        ${spentValue ? `<div class="bc-btn bc-btn--sm tm-task-detail-core-chip tm-task-detail-core-chip--static has-value"${detailTip('耗时', { ariaLabel: false })}>
                            <span class="tm-task-detail-core-chip__face" data-tm-detail-chip-face="spent">${__tmBuildTaskDetailCoreChipFace('spent', spentValue)}</span>
                        </div>` : ''}
                        ${tomatoEnabled ? `<button type="button" class="bc-btn bc-btn--sm tm-task-detail-core-chip ${curReminderText ? 'has-value' : 'tm-task-detail-core-chip--icon'} ${curHasReminder ? 'is-active' : ''}" data-tm-detail-reminder-toggle${detailTip(curReminderTip, { ariaLabel: false })}>
                            <span class="tm-task-detail-core-chip__face" data-tm-detail-chip-face="reminder">${__tmBuildTaskDetailCoreChipFace('reminder', curReminderText)}</span>
                        </button>` : ''}
                        <input type="hidden" data-tm-detail="pinned" value="${curPinned ? '1' : ''}">
                    </div>
                    ${customFieldsHtml}
                </div>

                <section class="tm-task-detail-section tm-task-detail-section--subtasks">
                    <div class="tm-task-detail-section-head">
                        <div class="tm-task-detail-section-title">子任务</div>
                        <div class="tm-task-detail-section-tools">
                            ${children.length ? `<span class="tm-task-detail-section-count">${completedChildren}/${children.length}</span>` : ''}
                        </div>
                    </div>
                    <div class="tm-task-detail-subtasks" data-tm-detail-subtasks>
                        ${__tmBuildTaskDetailSubtasksHtml(task)}
                    </div>
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
            } catch (e) {}
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
        const close = async () => {
            try { __tmCloseTaskDetailMoreMenu(); } catch (e) {}
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
            const cached = tid ? (state.flatTasks?.[tid] || null) : null;
            if (cached) {
                try { root.__tmTaskDetailTask = cached; } catch (e) {}
                return cached;
            }
            const fallback = root.__tmTaskDetailTask || initialTask || null;
            if (fallback && typeof fallback === 'object') {
                const fallbackId = String(fallback.id || '').trim();
                if (!tid || !fallbackId || fallbackId === tid) {
                    const rebound = __tmCacheTaskInState(fallback, {
                        docNameFallback: fallback.doc_name || fallback.docName || '未命名文档'
                    }) || fallback;
                    try { root.__tmTaskDetailTask = rebound; } catch (e) {}
                    return rebound;
                }
            }
            return null;
        };
        const buildDetailTip = (label, tipOpts = {}) => __tmBuildTooltipAttrs(label, {
            side: 'bottom',
            ...((tipOpts && typeof tipOpts === 'object') ? tipOpts : {}),
        });
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
        };
        const refreshReminderButtonState = async (force = false) => {
            const reminderBtn = root.querySelector('[data-tm-detail-reminder-toggle]');
            if (!(reminderBtn instanceof HTMLElement)) return;
            syncReminderChipFace();
            const task = getBoundTask();
            const tid = String(task?.id || taskId || '').trim();
            if (!tid) return;
            try {
                const snapshot = await __tmGetTaskReminderSnapshotByAnyId(task || root.__tmTaskDetailTask || taskId, { force: !!force });
                const hasReminder = snapshot?.hasReminder === true;
                __tmSetTaskReminderMark(tid, hasReminder);
                const boundTask = getBoundTask();
                if (boundTask && String(boundTask.id || '').trim() === tid) {
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
            if (String(task.id || '').trim() === tid) return task;
            const children = Array.isArray(task.children) ? task.children : [];
            for (const child of children) {
                const found = findTaskInTreeById(child, tid);
                if (found) return found;
            }
            return null;
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
            let resolvedId = requestedId;
            let nextTask = state.flatTasks?.[resolvedId] || state.pendingInsertedTasks?.[resolvedId] || null;
            if (!nextTask) {
                nextTask = findTaskInTreeById(getBoundTask(), resolvedId);
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
        const refreshBoundDetail = async (nextTaskId = taskId) => {
            const requestedId = String(nextTaskId || '').trim();
            if (!requestedId) return;
            if (!isSessionActive()) return;
            try {
                const nextTask = await resolveDetailNavigationTask(requestedId);
                if (!nextTask || !isSessionActive()) {
                    try { hint('⚠️ 未找到子任务数据，无法打开详情', 'warning'); } catch (e) {}
                    return;
                }
                const nextId = String(nextTask.id || requestedId).trim() || requestedId;
                if (embedded && !root.isConnected) return;
                if (embedded && (String(state.viewMode || '').trim() === 'checklist' || String(state.viewMode || '').trim() === 'whiteboard')) {
                    const currentDetailId = String(state.detailTaskId || '').trim();
                    state.detailTaskId = nextId;
                    if (nextId !== currentDetailId) {
                        state.checklistDetailDismissed = false;
                        state.checklistDetailSheetOpen = true;
                    }
                    if (!__tmRefreshChecklistSelectionInPlace(state.modal, 'detail-open-child')) render();
                    return;
                }
                if (embedded && String(state.viewMode || '').trim() === 'kanban') {
                    state.kanbanDetailTaskId = nextId;
                    state.kanbanDetailAnchorTaskId = nextId;
                    if (!__tmRefreshKanbanDetailInPlace(state.modal, { source: `${bindSource}:open-child` })) render();
                    return;
                }
                try { root.__tmTaskDetailTask = nextTask; } catch (e) {}
                try { __tmCloseTaskDetailMoreMenu(); } catch (e) {}
                try {
                    __tmPushDetailDebug('detail-rebuild-html', {
                        taskId: String(nextId || '').trim(),
                        embedded: embedded === true,
                        source: `${bindSource}:open-child`,
                        rootTag: __tmDescribeDebugElement(root),
                        pendingSave: root.__tmTaskDetailPendingSave === true,
                        hasActivePopover: !!root.__tmTaskDetailActiveInlinePopover,
                        refreshHoldMsLeft: Math.max(0, Number(root.__tmTaskDetailRefreshHoldUntil || 0) - Date.now()),
                    });
                } catch (e) {}
                root.innerHTML = __tmBuildTaskDetailInnerHtml(nextTask, opts);
                __tmBindTaskDetailEditor(root, nextId, { ...options, source: `${bindSource}:open-child`, task: nextTask });
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
        const restoreEmbeddedDetailScroll = (snapshot) => {
            if (!snapshot || !embedded) return;
            const restore = () => {
                const modal = state.modal instanceof Element ? state.modal : null;
                if (!(modal instanceof Element)) return;
                const panel = __tmResolveChecklistDetailPanel(modal).panel;
                if (!(panel instanceof HTMLElement)) return;
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
            const pinned = readPinnedValue();

            const startFace = root.querySelector('[data-tm-detail-chip-face="startDate"]');
            if (startFace instanceof HTMLElement) startFace.innerHTML = __tmBuildTaskDetailCoreChipFace('startDate', startValue);
            const startBtn = root.querySelector('[data-tm-detail-date-trigger="startDate"]');
            if (startBtn instanceof HTMLElement) startBtn.classList.toggle('has-value', !!startValue);

            const endFace = root.querySelector('[data-tm-detail-chip-face="completionTime"]');
            if (endFace instanceof HTMLElement) endFace.innerHTML = __tmBuildTaskDetailCoreChipFace('completionTime', endValue);
            const endBtn = root.querySelector('[data-tm-detail-date-trigger="completionTime"]');
            if (endBtn instanceof HTMLElement) endBtn.classList.toggle('has-value', !!endValue);

            const durationFace = root.querySelector('[data-tm-detail-chip-face="duration"]');
            if (durationFace instanceof HTMLElement) durationFace.innerHTML = __tmBuildTaskDetailCoreChipFace('duration', durationValue);
            const durationBtn = root.querySelector('[data-tm-detail-duration-trigger]');
            if (durationBtn instanceof HTMLElement) durationBtn.classList.toggle('has-value', !!durationValue);

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
        };
        const serializeFormState = (formState = null) => {
            const s = (formState && typeof formState === 'object') ? formState : collectFormState();
            return JSON.stringify([s.nextContent, s.nextStatus, s.nextPriority, s.nextPinned, s.nextStart, s.nextEnd, s.nextDuration, s.nextRemark, s.nextCustomFieldTextValues]);
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
                return !!active.closest?.('[data-tm-detail="remark"]');
            } catch (e) {
                return false;
            }
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
                        const textarea = root.querySelector('textarea[data-tm-detail="remark"]');
                        if (textarea instanceof HTMLTextAreaElement) {
                            const isActiveRemarkEditor = document.activeElement === textarea || textarea.matches(':focus');
                            if (!isActiveRemarkEditor) {
                                textarea.value = normalizedRemarkValue;
                                syncAutoHeight(textarea, 34);
                            }
                        }
                    }
                    {
                        const preview = root.querySelector('[data-tm-detail-remark-preview]');
                        const remarkShell = root.querySelector('[data-tm-detail-remark-shell]');
                        const isEditingRemark = remarkShell instanceof HTMLElement && remarkShell.classList.contains('is-editing');
                        if (preview instanceof HTMLElement && !isEditingRemark) {
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
            const boundTaskId = String(getBoundTask()?.id || taskId || '').trim();
            if (!boundTaskId) return;
            __tmOpenTaskDetailMoreMenu(ev.currentTarget instanceof Element ? ev.currentTarget : root.querySelector('[data-tm-detail="more"]'), boundTaskId);
        });
        on(root.querySelector('[data-tm-detail="close"]'), 'click', close);
        on(root.querySelector('[data-tm-detail="cancel"]'), 'click', close);
        const jumpBtn = root.querySelector('[data-tm-detail="jump"]');
        on(jumpBtn, 'click', async (ev) => {
            try { ev.preventDefault(); } catch (e) {}
            try {
                const jumped = await tmJumpToTask(taskId, ev);
                if (jumped !== false) await close();
            } catch (e) {}
        });
        on(root.querySelector('[data-tm-detail="location-doc"]'), 'click', (ev) => {
            try { ev.preventDefault(); } catch (e) {}
            try { ev.stopPropagation(); } catch (e) {}
            try { tmPickTaskDocInline(taskId, ev.currentTarget, ev); } catch (e) {}
        });
        on(root.querySelector('[data-tm-detail="location-heading"]'), 'click', (ev) => {
            try { ev.preventDefault(); } catch (e) {}
            try { ev.stopPropagation(); } catch (e) {}
            try { tmPickHeadingInline(taskId, ev.currentTarget, ev); } catch (e) {}
        });
        on(root.querySelector('[data-tm-detail="editPrompt"]'), 'click', (ev) => {
            try { ev.preventDefault(); } catch (e) {}
            try { tmEdit(taskId); } catch (e) {}
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
            const nextStatus = String(root.querySelector('[data-tm-detail="status"]')?.value || '').trim() || 'todo';
            const nextPriority = String(root.querySelector('[data-tm-detail="priority"]')?.value || '').trim();
            const pinnedInput = root.querySelector('[data-tm-detail="pinned"]');
            const nextPinned = (pinnedInput instanceof HTMLInputElement)
                ? (pinnedInput.type === 'checkbox' ? !!pinnedInput.checked : !!String(pinnedInput.value || '').trim())
                : false;
            const nextStart = normalize(root.querySelector('[data-tm-detail="startDate"]')?.value);
            const nextEnd = normalize(root.querySelector('[data-tm-detail="completionTime"]')?.value);
            const nextDuration = String(root.querySelector('[data-tm-detail="duration"]')?.value || '').trim();
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
                nextRemark,
                nextCustomFieldTextValues
            };
        };
        const buildDetailDiff = (taskLike, formState) => {
            const task0 = (taskLike && typeof taskLike === 'object') ? taskLike : {};
            const currentContent = String(task0.content || '').trim();
            const currentStatus = __tmResolveTaskStatusId(task0);
            const currentPriority = String(task0.priority || '').trim();
            const currentPinned = !!task0.pinned;
            const currentStart = String(task0.startDate || '').trim();
            const currentEnd = String(task0.completionTime || '').trim();
            const currentDuration = String(task0.duration || '').trim();
            const currentRemark = __tmNormalizeRemarkMarkdown(task0.remark || '');

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
                && changedKeys.every((key) => key === 'startDate' || key === 'completionTime' || key === 'duration');

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
                nextRemark,
                nextCustomFieldTextValues
            } = formState;
            try {
                if (nextStart !== String(task?.startDate || '').trim() || nextEnd !== String(task?.completionTime || '').trim()) {
                    __tmPushRefreshDebug('detail-save-date-change', {
                        taskId: String(task?.id || taskId || '').trim(),
                        embedded: embedded === true,
                        viewMode: String(state.viewMode || '').trim(),
                        nextStart,
                        nextEnd,
                        showHint: !!opts.showHint,
                        closeAfterSave: !!opts.closeAfterSave,
                        skipRerender: !!opts.skipRerender,
                    });
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
                try {
                    __tmPushRefreshDebug('detail-save-diff', {
                        taskId: String(task.id || '').trim(),
                        changedKeys: diff.changedKeys.slice(),
                        contentChanged: diff.contentChanged,
                        statusChanged: diff.statusChanged,
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
                    await __tmUpdateTaskContentBlock(task, nextContent, { background: true });
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
                    await __tmMutationEngine.requestTaskPatch(task.id, fieldPatch, {
                        source: 'detail',
                        label: '任务字段',
                        withFilters: true,
                        reason: diff.pureTimeOnly ? 'detail-time-save' : 'detail-save',
                        forceProjectionRefresh: __tmDoesPatchAffectProjection(task.id, fieldPatch),
                        skipDetailPatch: true,
                        skipViewRefresh: true,
                        broadcast: false,
                    });
                    try {
                        __tmRefreshTaskFieldsAcrossViews(task.id, fieldPatch, {
                            withFilters: true,
                            reason: diff.pureTimeOnly ? 'detail-time-save' : 'detail-save',
                            forceProjectionRefresh: __tmDoesPatchAffectProjection(task.id, fieldPatch),
                            fallback: true,
                            skipDetailPatch: true,
                        });
                    } catch (e) {}
                }
                const latestTask = state.flatTasks?.[String(task.id || '').trim()] || task;
                if (diff.contentChanged) {
                    try { syncTaskContentInVisibleViews(latestTask); } catch (e) {}
                    if (state.currentRule || state.groupByTaskName) {
                        try {
                            __tmScheduleViewRefresh({
                                mode: 'current',
                                withFilters: true,
                                reason: 'detail-content-save',
                            });
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
        let activeInlinePopover = null;
        let activeInlinePopoverTrigger = null;
        let inlinePopoverCommitting = false;
        const subtaskSaveTimers = new Map();
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
            setTaskDetailActivePopover(null, 420);
            try { trigger?.classList?.remove?.('is-open'); } catch (e) {}
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
            const triggerRect = activeInlinePopoverTrigger.getBoundingClientRect();
            const popRect = activeInlinePopover.getBoundingClientRect();
            const viewportW = Math.max(320, window.innerWidth || 0);
            const viewportH = Math.max(240, window.innerHeight || 0);
            let left = Math.round(triggerRect.left);
            let top = Math.round(triggerRect.bottom + 8);
            if (left + popRect.width > viewportW - 8) left = Math.max(8, Math.round(viewportW - popRect.width - 8));
            if (top + popRect.height > viewportH - 8) top = Math.max(8, Math.round(triggerRect.top - popRect.height - 8));
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
            const durationPresets = mode === 'duration' ? __tmGetDurationPresetOptions() : [];
            const popover = document.createElement('div');
            popover.className = `tm-task-detail-inline-popover${mode === 'duration' && durationPresets.length ? ' tm-task-detail-inline-popover--duration' : ''}`;
            popover.innerHTML = `
                ${title ? `<div class="tm-task-detail-inline-popover__title">${esc(title)}</div>` : ''}
                ${mode === 'duration' && durationPresets.length ? `
                    <div class="tm-task-detail-inline-popover__section">
                        <div class="tm-duration-preset-list tm-duration-preset-list--compact">
                            ${__tmBuildDurationPresetOptionsHtml(value, durationPresets)}
                        </div>
                        <div class="tm-duration-preset-helper">可选预设，也可直接填写自定义时长</div>
                    </div>
                ` : ''}
                <input class="tm-input tm-task-detail-inline-popover__input${mode === 'duration' ? ' tm-duration-editor-input' : ''}" data-tm-detail-inline-popover-input type="${mode === 'date' ? 'date' : 'text'}" value="${esc(value)}" ${placeholder ? `placeholder="${esc(placeholder)}"` : ''}>
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
            const clearBtn = popover.querySelector('[data-tm-detail-inline-popover-clear]');
            const applyBtn = popover.querySelector('[data-tm-detail-inline-popover-apply]');
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
                const nextValue = typeof config.normalize === 'function'
                    ? config.normalize(inputValue)
                    : String(inputValue || '').trim();
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
            if (mode === 'duration' && input instanceof HTMLInputElement && durationPresets.length) {
                __tmBindDurationPresetSelection(popover, input, {
                    onSelect: async (nextValue) => {
                        if (config.commitPresetOnSelect === true) {
                            await commit(nextValue);
                        }
                    },
                    focusInputOnSelect: config.commitPresetOnSelect !== true,
                    selectInput: config.commitPresetOnSelect !== true,
                });
            }
            if (input instanceof HTMLInputElement) {
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
                try {
                    requestAnimationFrame(() => {
                        try { input.focus(); } catch (e) {}
                        if (mode === 'date') {
                            try {
                                if (typeof input.showPicker === 'function') input.showPicker();
                                else input.click();
                            } catch (e) {
                                try { input.click(); } catch (e2) {}
                            }
                        } else {
                            try { input.select(); } catch (e) {}
                        }
                    });
                } catch (e) {}
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
                    setHiddenInputValue(field, nextValue);
                    syncMetaChipFaces();
                    const commitResultPromise = Promise.resolve(flushAutoSaveNow({
                        showHint: false,
                        closeAfterSave: false,
                        preserveFocus: true,
                        skipRerender: true,
                    }));
                    closeInlinePopover(true, 'date-sheet-commit-start');
                    try { trigger.focus(); } catch (e) {}
                    const commitResult = await commitResultPromise;
                    if (commitResult === false) return;
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
                const result = await window.tmEditTaskRepeatRule?.(taskId, { task: getBoundTask() });
                if (!result) return;
                const refreshedTask = await __tmResolveTaskForRepeat(taskId);
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
                const result = await window.tmSetTaskRepeatRule?.(taskId, {
                    ...currentRule,
                    until: nextUntil || '',
                    anchorDate: currentTask?.completionTime || currentTask?.startDate || __tmNormalizeDateOnly(new Date()),
                }, { source: 'task-repeat-until-inline' });
                if (!result) return;
                const refreshedTask = await __tmResolveTaskForRepeat(taskId);
                if (refreshedTask) {
                    try { root.__tmTaskDetailTask = refreshedTask; } catch (e) {}
                }
                syncRepeatRows();
                syncMetaChipFaces();
                syncSerializedSnapshot();
                positionInlinePopover();
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
            positionInlinePopover();
        });
        on(window, 'scroll', () => {
            if (!activeInlinePopover) return;
            if (inlinePopoverCommitting) return;
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
            const html = API.renderTaskContentHtml(taskLike?.markdown, String(taskLike?.content || '').trim() || '(无内容)');
            const plainText = String(taskLike?.content || '').trim() || '(无内容)';
            const updateTitleNode = (el) => {
                if (!(el instanceof HTMLElement)) return;
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
        try {
            abortController.signal.addEventListener('abort', () => {
                subtaskSaveTimers.forEach((timer) => {
                    try { clearTimeout(timer); } catch (e) {}
                });
                subtaskSaveTimers.clear();
            }, { once: true });
        } catch (e) {}
        const saveSubtaskContent = async (textarea, subtaskId, options = {}) => {
            if (!(textarea instanceof HTMLTextAreaElement)) return false;
            const tid = String(subtaskId || '').trim();
            const task = globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid];
            if (!tid || !task) return false;
            const savedValue = String(textarea.dataset.savedValue || task.content || '').trim();
            const nextValue = String(textarea.value || '').trim();
            if (!nextValue) {
                textarea.value = savedValue;
                syncAutoHeight(textarea, 34);
                if (options.showHint !== false) hint('⚠️ 子任务内容不能为空', 'warning');
                return false;
            }
            if (nextValue === savedValue) {
                textarea.value = nextValue;
                textarea.dataset.savedValue = nextValue;
                syncAutoHeight(textarea, 34);
                return true;
            }
            if (textarea.dataset.saving === 'true') return false;
            textarea.dataset.saving = 'true';
            try {
                await __tmUpdateTaskContentBlock(task, nextValue, { background: true });
                try {
                    if (state.pendingInsertedTasks?.[tid]) {
                        state.pendingInsertedTasks[tid].content = nextValue;
                        state.pendingInsertedTasks[tid].markdown = (globalThis.__tmRuntimeState?.getFlatTaskById?.(tid) || state.flatTasks?.[tid])?.markdown || state.pendingInsertedTasks[tid].markdown;
                    }
                } catch (e) {}
                try { __tmInvalidateTasksQueryCacheByDocId(task.root_id || task.docId); } catch (e) {}
                textarea.dataset.savedValue = nextValue;
                textarea.value = nextValue;
                syncAutoHeight(textarea, 34);
                try { syncTaskContentInVisibleViews(task); } catch (e) {}
                return true;
            } catch (e) {
                textarea.value = savedValue;
                syncAutoHeight(textarea, 34);
                if (options.showHint !== false) hint(`❌ 子任务更新失败: ${e.message}`, 'error');
                return false;
            } finally {
                try { delete textarea.dataset.saving; } catch (e) {}
            }
        };
        const scheduleSubtaskSave = (textarea, subtaskId) => {
            const tid = String(subtaskId || '').trim();
            if (!tid) return;
            clearSubtaskSaveTimer(tid);
            const timer = setTimeout(() => {
                subtaskSaveTimers.delete(tid);
                saveSubtaskContent(textarea, tid, { showHint: false }).catch(() => null);
            }, 700);
            subtaskSaveTimers.set(tid, timer);
        };
        const restoreSubtaskEmptyState = () => {
            const list = root.querySelector('[data-tm-detail-subtasks]');
            if (!(list instanceof HTMLElement)) return;
            const hasRealRows = Array.from(list.children).some((el) => el instanceof HTMLElement && el.classList.contains('tm-task-detail-subtask'));
            if (hasRealRows) return;
            list.innerHTML = '';
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
            const submitDraft = () => {
                const nextText = String(input.value || '').trim();
                if (!nextText) {
                    hint('⚠️ 请输入子任务内容', 'warning');
                    try { input.focus(); } catch (e) {}
                    return;
                }
                if (draftRow.dataset.saving === 'true') return;
                draftRow.dataset.saving = 'true';
                try {
                    const detailScrollSnapshot = captureEmbeddedDetailScroll();
                    removeDraft();
                    __tmQueueCreateSubtask(taskId, nextText, {
                        onSuccess: () => {
                            refreshBoundDetail(taskId);
                            restoreEmbeddedDetailScroll(detailScrollSnapshot);
                        }
                    });
                    refreshBoundDetail(taskId);
                    restoreEmbeddedDetailScroll(detailScrollSnapshot);
                } catch (e) {
                    hint(`❌ 新建子任务失败: ${e.message}`, 'error');
                    try { delete draftRow.dataset.saving; } catch (e2) {}
                }
            };
            syncAutoHeight(input, 34);
            on(input, 'input', () => syncAutoHeight(input, 34));
            on(input, 'keydown', (ev) => {
                if (ev.key === 'Escape') {
                    try { ev.preventDefault(); } catch (e) {}
                    removeDraft();
                    return;
                }
                if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
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
        const openInlineSubtaskDraft = () => {
            const list = root.querySelector('[data-tm-detail-subtasks]');
            if (!(list instanceof HTMLElement)) return;
            const existing = list.querySelector('[data-tm-detail-subtask-draft]');
            if (existing instanceof HTMLElement) {
                try { existing.querySelector('[data-tm-detail-subtask-draft-input]')?.focus?.(); } catch (e) {}
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
                        <textarea class="tm-task-detail-subtask-title" data-tm-detail-subtask-draft-input rows="1" placeholder="输入子任务内容"></textarea>
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
            bindSubtaskDraftRow(draftRow);
            try { __tmBindFloatingTooltips(draftRow); } catch (e) {}
        };
        const bindSubtaskEditors = () => {
            root.querySelectorAll('[data-tm-detail-subtask-content]').forEach((el) => {
                if (!(el instanceof HTMLTextAreaElement)) return;
                const tid = String(el.getAttribute('data-tm-detail-subtask-content') || '').trim();
                if (!tid) return;
                if (!el.dataset.savedValue) el.dataset.savedValue = String(el.value || '').trim();
                syncAutoHeight(el, 34);
                on(el, 'input', () => {
                    syncAutoHeight(el, 34);
                    if (el.readOnly) return;
                    scheduleSubtaskSave(el, tid);
                });
                on(el, 'blur', () => {
                    clearSubtaskSaveTimer(tid);
                    if (el.readOnly) return;
                    saveSubtaskContent(el, tid, { showHint: false }).catch(() => null);
                });
                on(el, 'keydown', async (ev) => {
                    if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
                        try { ev.preventDefault(); } catch (e) {}
                        clearSubtaskSaveTimer(tid);
                        await saveSubtaskContent(el, tid, { showHint: true });
                        try { el.blur(); } catch (e) {}
                    }
                });
            });
        };
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
                    const ok = await flushAutoSaveNow({
                        showHint: false,
                        closeAfterSave: false,
                        preserveFocus: true,
                        skipRerender: !embedded,
                    });
                    if (ok === false) {
                        try { hint('❌ 状态更新失败', 'error'); } catch (e) {}
                    }
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
                    const ok = await flushAutoSaveNow({
                        showHint: false,
                        closeAfterSave: false,
                        preserveFocus: true,
                        skipRerender: !embedded,
                    });
                    if (ok === false) {
                        try { hint('❌ 重要性更新失败', 'error'); } catch (e) {}
                    }
                });
            });
            syncPriorityUi();
            closeMenu('init');
        };
        const bindCoreMetaControls = () => {
            root.querySelectorAll('[data-tm-detail-date-trigger]').forEach((btn) => {
                if (!(btn instanceof HTMLButtonElement)) return;
                on(btn, 'click', (ev) => {
                    try { ev.preventDefault(); } catch (e) {}
                    try { ev.stopPropagation(); } catch (e) {}
                    const field = String(btn.getAttribute('data-tm-detail-date-trigger') || '').trim();
                    if (!field) return;
                    if (field === 'completionTime') {
                        openTaskDateSheetPopover(btn, field);
                        return;
                    }
                    const title = field === 'startDate' ? '开始日期' : '截止日期';
                    openInlinePopover(btn, {
                        mode: 'date',
                        title,
                        value: readHiddenInputValue(field),
                        normalize: (raw) => {
                            const v = String(raw || '').trim();
                            return v ? __tmNormalizeDateOnly(v) : '';
                        },
                        onCommit: async (nextValue) => {
                            setHiddenInputValue(field, nextValue);
                            syncMetaChipFaces();
                            return await flushAutoSaveNow({
                                showHint: false,
                                closeAfterSave: false,
                                preserveFocus: true,
                                skipRerender: true,
                            });
                        }
                    });
                });
            });
            on(root.querySelector('[data-tm-detail-duration-trigger]'), 'click', (ev) => {
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                openInlinePopover(ev.currentTarget, {
                    mode: 'duration',
                    title: '时长',
                    value: readHiddenInputValue('duration'),
                    placeholder: '1h / 30min',
                    commitPresetOnSelect: true,
                    normalize: (raw) => String(raw || '').trim(),
                    onCommit: async (nextValue) => {
                        setHiddenInputValue('duration', nextValue);
                        syncMetaChipFaces();
                        return await flushAutoSaveNow({
                            showHint: false,
                            closeAfterSave: false,
                            preserveFocus: true,
                            skipRerender: true,
                        });
                    }
                });
            });
            on(root.querySelector('[data-tm-detail-reminder-toggle]'), 'click', async (ev) => {
                try { ev.preventDefault(); } catch (e) {}
                try { ev.stopPropagation(); } catch (e) {}
                try {
                    await tmReminder(taskId);
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
                const ok = await flushAutoSaveNow({
                    showHint: false,
                    closeAfterSave: false,
                    preserveFocus: true,
                    skipRerender: !embedded,
                });
                if (ok === false) {
                    setHiddenInputValue('pinned', prevValue);
                    syncMetaChipFaces();
                    try { hint('❌ 置顶状态更新失败', 'error'); } catch (e) {}
                }
            });
            root.querySelectorAll('[data-tm-detail-open-child]').forEach((btn) => {
                if (!(btn instanceof HTMLButtonElement)) return;
                on(btn, 'click', async (ev) => {
                    try { ev.preventDefault(); } catch (e) {}
                    try { ev.stopPropagation(); } catch (e) {}
                    const nextId = String(btn.getAttribute('data-tm-detail-open-child') || '').trim();
                    if (!nextId) return;
                    await refreshBoundDetail(nextId);
                });
            });
            root.querySelectorAll('[data-tm-detail-subtask-menu]').forEach((row) => {
                if (!(row instanceof HTMLElement)) return;
                on(row, 'contextmenu', (ev) => {
                    const subtaskId = String(row.getAttribute('data-tm-detail-subtask-menu') || '').trim();
                    if (!subtaskId) return;
                    try { tmShowTaskContextMenu(ev, subtaskId); } catch (e) {}
                });
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
                        await __tmDeleteTaskRepeatHistoryEntry(taskId, completedAt, { source: 'detail-repeat-history-delete' });
                        const refreshedTask = await __tmResolveTaskForRepeat(taskId);
                        if (refreshedTask) {
                            try { root.__tmTaskDetailTask = refreshedTask; } catch (e) {}
                        }
                        refreshBoundDetail(taskId);
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
            const captureDetailScrollSnapshot = () => {
                try {
                    const checklistSnapshot = __tmCaptureChecklistDetailScrollSnapshot(state.modal);
                    if (checklistSnapshot) return { kind: 'checklist', snapshot: checklistSnapshot };
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
                    if (pack.kind === 'standalone') {
                        __tmRestoreStandaloneTaskDetailScrollSnapshot(pack.snapshot);
                    }
                } catch (e) {}
            };
            const preserveDetailScroll = (fn) => {
                const snapshot = captureDetailScrollSnapshot();
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
                try { syncRemarkHeight(); } catch (e) {}
                preserveDetailScroll(() => {
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
                remarkShell.classList.add('is-editing');
                try { remarkShell.dataset.mode = 'edit'; } catch (e) {}
                armRemarkInteractionGuard(320);
                syncRemarkHeight();
                if (options.openToolbar) setRemarkToolbarOpen(true);
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
                run().catch(() => null);
            };

            syncRemarkPreview();
            syncRemarkHeight();
            setRemarkToolbarOpen(false);
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
            on(remarkTextarea, 'input', () => {
                preserveDetailScroll(() => {
                    syncRemarkHeight();
                    syncRemarkPreview(false);
                });
                scheduleEnsureRemarkVisibleOnMobile();
                scheduleAutoSave();
            });
            on(remarkTextarea, 'focus', syncRemarkHeight);
            on(remarkTextarea, 'focus', () => {
                scheduleEnsureRemarkVisibleOnMobile();
            });
            on(remarkTextarea, 'keydown', (ev) => {
                if (preserveDetailScroll(() => __tmHandleRemarkTextareaKeydown(remarkTextarea, ev))) {
                    syncRemarkHeight();
                    syncRemarkPreview(false);
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
                syncRemarkHeight();
                syncRemarkPreview(true);
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
                remarkToolbar.querySelectorAll('[data-tm-detail-remark-tool]').forEach((button) => {
                    if (!(button instanceof HTMLButtonElement)) return;
                    on(button, 'mousedown', (ev) => {
                        try { ev.preventDefault(); } catch (e) {}
                    });
                    on(button, 'click', (ev) => {
                        armRemarkInteractionGuard();
                        try { ev.preventDefault(); } catch (e) {}
                        try { ev.stopPropagation(); } catch (e) {}
                        const action = String(button.getAttribute('data-tm-detail-remark-tool') || '').trim();
                        if (!action) return;
                        preserveDetailScroll(() => {
                            if (action === 'indent') __tmAdjustRemarkIndent(remarkTextarea, false);
                            else if (action === 'outdent') __tmAdjustRemarkIndent(remarkTextarea, true);
                            else if (action === 'bold') __tmWrapRemarkSelection(remarkTextarea, '**');
                            else if (action === 'italic') __tmWrapRemarkSelection(remarkTextarea, '*');
                            else if (action === 'code') __tmWrapRemarkSelection(remarkTextarea, '`');
                            else if (action === 'link') __tmInsertRemarkLinkTemplate(remarkTextarea);
                            else if (action === 'quote') __tmToggleRemarkLinePrefix(remarkTextarea, '> ');
                            else if (action === 'bullet') __tmToggleRemarkLinePrefix(remarkTextarea, '- ');
                            else if (action === 'ordered') __tmToggleRemarkOrderedList(remarkTextarea);
                        });
                        syncRemarkHeight();
                        syncRemarkPreview(false);
                        scheduleAutoSave();
                        focusRemarkTextarea(false);
                    });
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
                flushAutoSaveNow({
                    showHint: false,
                    closeAfterSave: false,
                    preserveFocus: false,
                    skipRerender: true,
                }).catch(() => null);
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
        try { __tmBindFloatingTooltips(root); } catch (e) {}
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
            if (resolvedId !== currentId) return;
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
            done: !!taskLike?.done,
            customStatus: String(taskLike?.customStatus || taskLike?.custom_status || '').trim(),
            priority: String(taskLike?.priority || '').trim(),
            startDate: String(taskLike?.startDate || '').trim(),
            completionTime: String(taskLike?.completionTime || '').trim(),
            duration: String(taskLike?.duration || '').trim(),
            pinned: !!taskLike?.pinned,
            remark: String(taskLike?.remark || ''),
            customSig,
            sheetOpen: !!opts.sheetOpen,
            dismissed: !!opts.dismissed,
        });
    }

    function __tmRefreshChecklistSelectionInPlace(modalEl, source = '') {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return false;
        if (!__tmIsChecklistSelectionContext(modal)) return false;
        const selectedId = String(state.detailTaskId || '').trim();
        try { __tmPushRefreshDebug('checklist-selection-rebuild:start', { selectedId, source: String(source || '').trim() || 'unknown' }); } catch (e) {}
        const multiSelectedSet = __tmGetMultiSelectedTaskIdSet();
        const panelState = __tmResolveChecklistDetailPanel(modal, { preferSheetMode: __tmChecklistUseSheetMode(modal) });
        const sheetMode = !!panelState.sheetMode;
        const items = modal.querySelectorAll('.tm-checklist-item[data-id]');
        items.forEach((item) => {
            if (!(item instanceof HTMLElement)) return;
            const id = String(item.getAttribute('data-id') || '').trim();
            item.classList.toggle('tm-checklist-item--active', !!selectedId && id === selectedId);
            item.classList.toggle('tm-task-row--multi-selected', !!id && multiSelectedSet.has(id));
        });
        const panel = panelState.panel;
        if (!(panel instanceof HTMLElement)) return false;
        const prevTaskId = String(panel.dataset?.tmDetailTaskId || panel.__tmTaskDetailTaskId || panel.__tmTaskDetailTask?.id || '').trim();
        const detailScrollSnapshot = prevTaskId && prevTaskId === selectedId
            ? {
                top: Number(panel.scrollTop || 0),
                left: Number(panel.scrollLeft || 0),
                selectedId,
            }
            : null;
        const task = selectedId ? (state.flatTasks?.[selectedId] || null) : null;
        const nextSignature = __tmBuildChecklistSelectionSignature(task, {
            sheetOpen: state.checklistDetailSheetOpen,
            dismissed: state.checklistDetailDismissed,
        });
        const prevSignature = String(modal.__tmChecklistSelectionSignature || '').trim();
        const canSkipPanelWork = !!task
            && !!selectedId
            && prevTaskId === selectedId
            && panel.childElementCount > 0
            && prevSignature
            && prevSignature === nextSignature;
        const keepExistingDetail = !!task
            && !!selectedId
            && prevTaskId === selectedId
            && panel.childElementCount > 0;
        if (canSkipPanelWork) {
            const backdrop = modal.querySelector('#tmChecklistSheetBackdrop');
            const sheet = modal.querySelector('#tmChecklistSheet');
            if (backdrop instanceof HTMLElement) backdrop.classList.toggle('tm-checklist-sheet-backdrop--open', !!(sheetMode && state.checklistDetailSheetOpen && task));
            if (sheet instanceof HTMLElement) sheet.classList.toggle('tm-checklist-sheet--open', !!(sheetMode && state.checklistDetailSheetOpen && task));
            try { __tmPushRefreshDebug('checklist-selection-rebuild:skip', { selectedId, source: String(source || '').trim() || 'unknown' }); } catch (e) {}
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
                    duration: true,
                    pinned: true,
                    remark: true,
                    attachments: true,
                    customFieldValues: true,
                });
            } catch (e) {}
        } else {
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
            panel.innerHTML = task
                ? __tmBuildTaskDetailInnerHtml(task, { embedded: true, closeable: true })
                : `<div class="tm-checklist-empty-detail">选择左侧任务后，这里会显示可编辑的详情。</div>`;
            try { panel.__tmTaskDetailTask = task || null; } catch (e) {}
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
                    if (!__tmRefreshChecklistSelectionInPlace(state.modal, 'detail-close')) render();
                }
            });
        }
        const backdrop = modal.querySelector('#tmChecklistSheetBackdrop');
        const sheet = modal.querySelector('#tmChecklistSheet');
        if (backdrop instanceof HTMLElement) backdrop.classList.toggle('tm-checklist-sheet-backdrop--open', !!(sheetMode && state.checklistDetailSheetOpen && task));
        if (sheet instanceof HTMLElement) sheet.classList.toggle('tm-checklist-sheet--open', !!(sheetMode && state.checklistDetailSheetOpen && task));
        if (detailScrollSnapshot) {
            try { __tmRestoreChecklistDetailScrollSnapshot(detailScrollSnapshot, modal); } catch (e) {}
        }
        try { modal.__tmChecklistSelectionSignature = nextSignature; } catch (e) {}
        try { __tmPushRefreshDebug('checklist-selection-rebuild:end', { selectedId, hasTask: !!task, source: String(source || '').trim() || 'unknown', keepExistingDetail }); } catch (e) {}
        return true;
    }

    function __tmPatchTaskDetailPanelInPlace(panelEl, taskId, patch = {}) {
        const panel = panelEl instanceof Element ? panelEl : null;
        const tid = String(taskId || '').trim();
        const nextPatch = (patch && typeof patch === 'object') ? patch : {};
        const task = tid ? (__tmTaskStateKernel.getTask(tid) || null) : null;
        if (!(panel instanceof Element) || !tid || !task) return false;
        if (!__tmIsTaskDetailRootUsable(panel, { taskId: tid })) return false;
        const currentId = String(panel.dataset?.tmDetailTaskId || panel.__tmTaskDetailTaskId || panel.__tmTaskDetailTask?.id || '').trim();
        if (currentId && currentId !== tid) return false;
        let touched = false;

        try { panel.__tmTaskDetailTask = task; } catch (e) {}
        try { panel.dataset.tmDetailTaskId = tid; } catch (e) {}

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
            const btn = field === 'duration'
                ? panel.querySelector('[data-tm-detail-duration-trigger]')
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

        if (Object.prototype.hasOwnProperty.call(nextPatch, 'startDate')) syncChipField('startDate', String(task?.startDate || '').trim(), 'startDate');
        if (Object.prototype.hasOwnProperty.call(nextPatch, 'completionTime')) syncChipField('completionTime', String(task?.completionTime || '').trim(), 'completionTime');
        if (Object.prototype.hasOwnProperty.call(nextPatch, 'duration')) syncChipField('duration', String(task?.duration || '').trim(), 'duration');

        if (Object.prototype.hasOwnProperty.call(nextPatch, 'pinned')) {
            const pinnedValue = !!task?.pinned;
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
            const remarkValue = __tmNormalizeRemarkMarkdown(task?.remark || '');
            const textarea = panel.querySelector('textarea[data-tm-detail="remark"]');
            if (textarea instanceof HTMLTextAreaElement && textarea !== document.activeElement) textarea.value = remarkValue;
            const preview = panel.querySelector('[data-tm-detail-remark-preview]');
            if (preview instanceof HTMLElement) {
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

        return touched;
    }

    function __tmRefreshVisibleTaskDetailForTask(taskId) {
        const tid = String(taskId || '').trim();
        if (!tid) return false;
        try {
            __tmPushDetailDebug('detail-refresh-enter', {
                taskId: tid,
                viewMode: String(state.viewMode || '').trim(),
                checklistDetailTaskId: String(state.detailTaskId || '').trim(),
                kanbanDetailTaskId: String(state.kanbanDetailTaskId || '').trim(),
                hasOverlay: !!document.getElementById('tm-task-detail-overlay'),
            });
        } catch (e) {}
        let refreshed = false;
        if (__tmIsChecklistSelectionContext(state.modal) && String(state.detailTaskId || '').trim() === tid) {
            try {
                const panel = __tmResolveChecklistDetailPanel(state.modal).panel;
                const detailPatched = !!__tmPatchTaskDetailPanelInPlace(panel, tid, {
                    done: true,
                    customStatus: true,
                    priority: true,
                    startDate: true,
                    completionTime: true,
                    duration: true,
                    pinned: true,
                    remark: true,
                    attachments: true,
                    customFieldValues: true,
                });
                try { __tmPushRefreshDebug('checklist-detail-patch', { taskId: tid, patched: detailPatched }); } catch (e) {}
                refreshed = detailPatched || refreshed;
            } catch (e) {}
            if (!refreshed) {
                const panel = __tmResolveChecklistDetailPanel(state.modal).panel;
                if (!__tmIsTaskDetailRootUsable(panel, { taskId: tid })) {
                    try { __tmPushRefreshDebug('checklist-detail-patch:skip-unusable', { taskId: tid }); } catch (e) {}
                } else {
                    const shouldDeferFallback = __tmShouldDeferTaskDetailFallback(panel);
                    if (shouldDeferFallback) {
                        const task = __tmTaskStateKernel.getTask(tid);
                        try { if (panel instanceof HTMLElement && task) panel.__tmTaskDetailTask = task; } catch (e) {}
                        try { if (panel instanceof HTMLElement) panel.dataset.tmDetailTaskId = tid; } catch (e) {}
                        try {
                            __tmPushDetailDebug('detail-refresh-deferred-fallback', {
                                taskId: tid,
                                scope: 'checklist',
                                reasons: __tmCollectTaskDetailFallbackDeferReasons(panel),
                            });
                        } catch (e) {}
                        try { __tmPushRefreshDebug('checklist-detail-patch:deferred-fallback', { taskId: tid }); } catch (e) {}
                        refreshed = !!task || refreshed;
                    } else {
                        try {
                            __tmPushDetailDebug('detail-refresh-fallback-rebuild', {
                                taskId: tid,
                                scope: 'checklist',
                                reasons: [],
                            });
                        } catch (e) {}
                        try { __tmPushRefreshDebug('checklist-detail-patch:fallback-rebuild', { taskId: tid }); } catch (e) {}
                        refreshed = !!__tmRefreshChecklistSelectionInPlace(state.modal, 'visible-task-detail-fallback') || refreshed;
                    }
                }
            }
        }
        if (String(state.viewMode || '').trim() === 'kanban' && String(state.kanbanDetailTaskId || '').trim() === tid) {
            refreshed = !!__tmRefreshKanbanDetailInPlace(state.modal, { source: 'visible-task-detail-refresh' }) || refreshed;
        }
        const overlay = document.getElementById('tm-task-detail-overlay');
        const overlayTaskId = String(overlay?.__tmTaskDetailTask?.id || overlay?.dataset?.tmDetailTaskId || '').trim();
        if (overlay instanceof HTMLElement
            && document.body.contains(overlay)
            && __tmIsTaskDetailRootUsable(overlay, { taskId: tid })
            && overlayTaskId
            && overlayTaskId === tid) {
            try {
                const overlayScrollSnapshot = __tmCaptureStandaloneTaskDetailScrollSnapshot();
                const detailPatched = !!__tmPatchTaskDetailPanelInPlace(overlay, tid, {
                    done: true,
                    customStatus: true,
                    priority: true,
                    startDate: true,
                    completionTime: true,
                    duration: true,
                    pinned: true,
                    remark: true,
                    attachments: true,
                    customFieldValues: true,
                });
                if (!detailPatched) {
                    const task = __tmTaskStateKernel.getTask(tid);
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
                        overlay.innerHTML = __tmBuildTaskDetailInnerHtml(task, { embedded: false });
                        try { overlay.__tmTaskDetailTask = task; } catch (e) {}
                        try { overlay.dataset.tmDetailTaskId = tid; } catch (e) {}
                        __tmBindTaskDetailEditor(overlay, tid, {
                            embedded: false,
                            source: 'visible-task-detail-fallback:overlay',
                            onClose: typeof overlay.__tmTaskDetailOnClose === 'function' ? overlay.__tmTaskDetailOnClose : null,
                            task,
                        });
                        try { __tmBindFloatingTooltips(overlay); } catch (e) {}
                        refreshed = true;
                    }
                } else {
                    refreshed = true;
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
    let __tmKanbanDetailRepositionHandler = null;
    let __tmKanbanDetailRepositionModal = null;

    function __tmClearKanbanDetailFloatingHandlers() {
        try {
            if (__tmKanbanDetailOutsideClickHandler) {
                globalThis.__tmRuntimeEvents?.off?.(document, 'click', __tmKanbanDetailOutsideClickHandler, false);
                __tmKanbanDetailOutsideClickHandler = null;
            }
        } catch (e) {}
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

    function __tmCloseKanbanDetailFloating() {
        if (!String(state.kanbanDetailTaskId || '').trim()) return;
        try {
            const panel = state.modal?.querySelector?.('#tmKanbanDetailPanel');
            __tmMarkTaskDetailRootClosing(panel, { holdMs: 900 });
            __tmMarkTaskDetailRootClosed(panel);
        } catch (e) {}
        state.kanbanDetailTaskId = '';
        state.kanbanDetailAnchorTaskId = '';
        render();
    }

    function __tmCaptureKanbanDetailScrollSnapshot(modalEl) {
        try {
            const modal = modalEl instanceof Element ? modalEl : state.modal;
            if (!(modal instanceof Element)) return null;
            if (String(state.viewMode || '').trim() !== 'kanban') return null;
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
                if (String(state.kanbanDetailTaskId || '').trim() !== String(snapshot.selectedId || '').trim()) return;
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
        const panel = modal.querySelector('#tmKanbanDetailFloat');
        const selectedId = String(state.kanbanDetailTaskId || '').trim();
        const anchorId = String(state.kanbanDetailAnchorTaskId || selectedId).trim();
        const card = anchorId ? modal.querySelector(`.tm-kanban-card[data-id="${CSS.escape(anchorId)}"]`) : null;
        if (!(panel instanceof HTMLElement) || !(card instanceof HTMLElement)) return false;

        const prevVisibility = panel.style.visibility;
        const prevPointerEvents = panel.style.pointerEvents;
        panel.style.visibility = 'hidden';
        panel.style.pointerEvents = 'none';
        panel.style.left = '24px';
        panel.style.top = '24px';
        panel.style.maxHeight = 'calc(100vh - 48px)';

        const cardRect = card.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
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

        panel.style.left = `${Math.round(left)}px`;
        panel.style.top = `${Math.round(top)}px`;
        panel.style.maxHeight = `${Math.round(maxHeight)}px`;
        panel.style.visibility = prevVisibility || '';
        panel.style.pointerEvents = prevPointerEvents || '';
        return true;
    }

    function __tmRefreshKanbanDetailInPlace(modalEl, options = {}) {
        const modal = modalEl instanceof Element ? modalEl : state.modal;
        if (!(modal instanceof Element)) return false;
        if (String(state.viewMode || '').trim() !== 'kanban') return false;
        const panel = modal.querySelector('#tmKanbanDetailPanel');
        const selectedId = String(state.kanbanDetailTaskId || '').trim();
        const task = selectedId ? (state.flatTasks?.[selectedId] || null) : null;
        const opts = (options && typeof options === 'object') ? options : {};
        const refreshSource = String(opts.source || '').trim() || 'unknown';
        const detailScrollSnapshot = opts.scrollSnapshot || __tmCaptureKanbanDetailScrollSnapshot(modal);
        if (!(panel instanceof HTMLElement) || !task) {
            __tmClearKanbanDetailFloatingHandlers();
            return false;
        }
        if (!__tmIsTaskDetailRootUsable(panel, { taskId: selectedId })) return false;
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
        panel.innerHTML = __tmBuildTaskDetailInnerHtml(task, { embedded: true, floating: true });
        try { panel.dataset.tmDetailTaskId = selectedId; } catch (e) {}
        __tmBindTaskDetailEditor(panel, selectedId, {
            embedded: true,
            source: `kanban-detail-refresh:${refreshSource}`,
            onClose: () => {
                __tmCloseKanbanDetailFloating();
            }
        });
        __tmClearKanbanDetailFloatingHandlers();
        __tmKanbanDetailOutsideClickHandler = (ev) => {
            const floatPanel = modal.querySelector('#tmKanbanDetailFloat');
            if (!(floatPanel instanceof Element)) return;
            const target = ev?.target;
            if (!(target instanceof Element)) return;
            if (floatPanel.contains(target)) return;
            if (target.closest('.tm-kanban-more')) return;
            if (target.closest('.tm-task-detail-inline-popover,.tm-inline-editor')) return;
            __tmCloseKanbanDetailFloating();
        };
        try { globalThis.__tmRuntimeEvents?.on?.(document, 'click', __tmKanbanDetailOutsideClickHandler, false); } catch (e) {}
        __tmKanbanDetailRepositionHandler = () => {
            try { __tmPositionKanbanDetailFloat(modal); } catch (e) {}
        };
        __tmKanbanDetailRepositionModal = modal;
        try { globalThis.__tmRuntimeEvents?.on?.(modal, 'scroll', __tmKanbanDetailRepositionHandler, true); } catch (e) {}
        try { globalThis.__tmRuntimeEvents?.on?.(window, 'resize', __tmKanbanDetailRepositionHandler, true); } catch (e) {}
        try { __tmPositionKanbanDetailFloat(modal); } catch (e) {}
        try { requestAnimationFrame(() => { try { __tmPositionKanbanDetailFloat(modal); } catch (e) {} }); } catch (e) {}
        if (detailScrollSnapshot && String(detailScrollSnapshot.selectedId || '').trim() === selectedId) {
            __tmRestoreKanbanDetailScrollSnapshot(detailScrollSnapshot, modal);
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

// 渲染任务列表（支持跨文档全局排序）
