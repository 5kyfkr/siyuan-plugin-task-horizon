# -*- coding: utf-8 -*-
"""Port live field previews into settings: real plugin classes, sample data.

1. renderSettingsChipSetting gains opt.preview -> appends [data-tm-field-preview] host.
2. Adds __tmRenderSettingsFieldPreview + refresh/binding helpers after it.
3. Passes preview types at 8 chip-setting call sites.
4. Binds a delegated change listener after settingsModal innerHTML render.
"""
import io

PATH = "src/task-horizon/main/settings/60-settings-screen.js"

with io.open(PATH, "r", encoding="utf-8", newline="") as f:
    src = f.read()
src = src.replace("\r\n", "\n")

reps = []

# --- 1. renderSettingsChipSetting: opt.preview ------------------------------
old_chip_setting = """        const renderSettingsChipSetting = (title, desc, groups, opt = {}) => {
            const extraClass = String(opt?.className || '').trim();
            const extraStyle = String(opt?.style || '').trim();
            const groupsList = Array.isArray(groups) ? groups : [];
            const heading = String(title || '').trim();
            const description = String(desc || '').trim();
            const descHtml = String(desc || '').trim()
                ? `<div class="tm-settings-chip-setting-desc">${desc}</div>`
                : '';
            if (!heading && !description) {
                return `
                    <div class="tm-settings-chip-stack${groupsList.length > 1 ? ' tm-settings-chip-stack--multi' : ''}${extraClass ? ` ${extraClass}` : ''}"${extraStyle ? ` style="${extraStyle}"` : ''}>
                        ${groupsList.map((group) => renderSettingsChipGroup(group)).join('')}
                    </div>
                `;
            }
            return `
                <div class="tm-settings-chip-setting${extraClass ? ` ${extraClass}` : ''}"${extraStyle ? ` style="${extraStyle}"` : ''}>
                    <div class="tm-settings-chip-setting-copy">
                        <div class="tm-settings-chip-setting-title">${esc(heading)}</div>
                        ${description ? `<div class="tm-settings-chip-setting-desc">${esc(description)}</div>` : ''}
                    </div>
                    <div class="tm-settings-chip-stack${groupsList.length > 1 ? ' tm-settings-chip-stack--multi' : ''}">
                        ${groupsList.map((group) => renderSettingsChipGroup(group)).join('')}
                    </div>
                </div>
            `;
        };"""
new_chip_setting = """        const renderSettingsChipSetting = (title, desc, groups, opt = {}) => {
            const extraClass = String(opt?.className || '').trim();
            const extraStyle = String(opt?.style || '').trim();
            const groupsList = Array.isArray(groups) ? groups : [];
            const heading = String(title || '').trim();
            const description = String(desc || '').trim();
            const previewType = String(opt?.preview || '').trim();
            const previewHtml = previewType
                ? `<div class="tm-field-preview" data-tm-field-preview="${esc(previewType)}">${__tmRenderSettingsFieldPreview(previewType)}</div>`
                : '';
            const descHtml = String(desc || '').trim()
                ? `<div class="tm-settings-chip-setting-desc">${desc}</div>`
                : '';
            if (!heading && !description) {
                return `
                    <div class="tm-settings-chip-stack${groupsList.length > 1 ? ' tm-settings-chip-stack--multi' : ''}${extraClass ? ` ${extraClass}` : ''}"${extraStyle ? ` style="${extraStyle}"` : ''}>
                        ${groupsList.map((group) => renderSettingsChipGroup(group)).join('')}
                        ${previewHtml}
                    </div>
                `;
            }
            return `
                <div class="tm-settings-chip-setting${extraClass ? ` ${extraClass}` : ''}"${extraStyle ? ` style="${extraStyle}"` : ''}>
                    <div class="tm-settings-chip-setting-copy">
                        <div class="tm-settings-chip-setting-title">${esc(heading)}</div>
                        ${description ? `<div class="tm-settings-chip-setting-desc">${esc(description)}</div>` : ''}
                    </div>
                    <div class="tm-settings-chip-stack${groupsList.length > 1 ? ' tm-settings-chip-stack--multi' : ''}">
                        ${groupsList.map((group) => renderSettingsChipGroup(group)).join('')}
                        ${previewHtml}
                    </div>
                </div>
            `;
        };

        // ---------- 字段设置实时效果预览（复用真实视图类名，示例数据） ----------
        const __tmFieldPreviewStatusTag = (name, color) => {
            try { return `<span class="tm-status-tag" style="${__tmBuildStatusChipStyle(color || '#2f9e77')}">${esc(name)}</span>`; }
            catch (e) { return `<span class="tm-status-tag">${esc(name)}</span>`; }
        };
        const __tmFieldPreviewPriorityChip = () => {
            try { return `<span class="tm-kanban-priority-chip" style="${__tmBuildPriorityChipStyle('high')}">${__tmRenderPriorityJira('high', false)}</span>`; }
            catch (e) { return `<span class="tm-kanban-priority-chip">高</span>`; }
        };
        const __tmFieldPreviewCheckbox = () => {
            try {
                const html = __tmRenderTaskCheckbox('tm-field-preview', {}, { checked: false });
                if (html) return html;
            } catch (e) {}
            return '<span class="tm-field-preview__checkbox" aria-hidden="true"></span>';
        };
        const __tmFieldPreviewCustomFieldName = (key) => {
            const fieldId = String(key || '').replace(/^customField:/, '').trim();
            if (!fieldId) return '';
            try {
                const field = (__tmGetCustomFieldDefs() || []).find((item) => String(item?.id || '').trim() === fieldId);
                return String(field?.name || fieldId).trim() || fieldId;
            } catch (e) { return fieldId; }
        };
        const __tmFieldPreviewListMetaChip = (key) => {
            switch (key) {
                case 'docName': return `<span class="tm-checklist-meta-compact-doc">周报</span>`;
                case 'h2': return `<span class="tm-checklist-meta-compact-h2" title="本周">本周</span>`;
                case 'startDate': return `<span class="tm-checklist-meta-compact-start tm-checklist-meta-compact-date tm-checklist-meta-compact-date--start">9月20日 09:00</span>`;
                case 'completionTime': return `<span class="tm-checklist-meta-compact-time tm-checklist-meta-compact-date tm-checklist-meta-compact-date--completion">9月25日</span>`;
                case 'remainingTime': return `<span class="tm-checklist-meta-compact-remaining" title="还剩 2 天">还剩 2 天</span>`;
                case 'duration': return `<span class="tm-checklist-meta-compact-duration">1.5h</span>`;
                case 'tomatoSummary': return `<span class="tm-checklist-meta-compact-duration">45 分钟</span>`;
                case 'tomatoEstimateCount': return `<span class="tm-checklist-meta-compact-duration">预计 3</span>`;
                case 'tomatoCount': return `<span class="tm-checklist-meta-compact-duration">实际 2</span>`;
                case 'status': return '';
                default: {
                    const name = __tmFieldPreviewCustomFieldName(key);
                    return name ? `<span class="tm-checklist-meta-compact-custom-field" title="${esc(name)}">${esc(name)}·示例</span>` : '';
                }
            }
        };
        const __tmFieldPreviewListRow = (keys, narrow) => {
            const metaParts = (Array.isArray(keys) ? keys : []).map((key) => __tmFieldPreviewListMetaChip(key)).filter(Boolean);
            const statusTag = (Array.isArray(keys) && keys.includes('status')) ? __tmFieldPreviewStatusTag('进行中', '#2f9e77') : '';
            const metaHtml = metaParts.length ? `<div class="tm-checklist-meta-compact">${metaParts.join('')}</div>` : '';
            const emptyHint = (!metaHtml && !statusTag) ? '<span class="tm-field-preview__empty">右侧不显示字段</span>' : '';
            return `
                <div class="tm-checklist-item tm-field-preview__row${narrow ? ' tm-field-preview__row--narrow' : ''}" style="--tm-checklist-compact-indent:0px;">
                    <div class="tm-checklist-leading"><span class="tm-tree-toggle tm-tree-toggle--placeholder" aria-hidden="true"></span>${__tmFieldPreviewCheckbox()}</div>
                    <div class="tm-checklist-item-main">
                        <div class="tm-checklist-title-row${metaHtml || statusTag ? ' tm-checklist-title-row--has-compact-meta' : ''}">
                            <div class="tm-checklist-title-main"><div class="tm-checklist-title"><span class="tm-checklist-title-button"><span>写周报</span></span></div></div>
                            ${metaHtml}${statusTag}${emptyHint}
                        </div>
                    </div>
                </div>`;
        };
        const __tmFieldPreviewCardChip = (key) => {
            switch (key) {
                case 'priority': return __tmFieldPreviewPriorityChip();
                case 'status': return __tmFieldPreviewStatusTag('进行中', '#2f9e77');
                case 'date': return `<span class="tm-kanban-chip tm-kanban-chip--muted tm-kanban-chip--date tm-kanban-chip--date-has-value">9月25日</span>`;
                case 'remainingTime': return `<span class="tm-kanban-chip tm-kanban-chip--muted" title="还剩 2 天">还剩 2 天</span>`;
                case 'tomatoSummary': return `<span class="tm-kanban-chip tm-kanban-chip--muted">45 分钟</span>`;
                case 'tomatoEstimateCount': return `<span class="tm-kanban-chip tm-kanban-chip--muted">预计 3</span>`;
                case 'tomatoCount': return `<span class="tm-kanban-chip tm-kanban-chip--muted">实际 2</span>`;
                case 'remark': return '';
                default: {
                    const name = __tmFieldPreviewCustomFieldName(key);
                    return name ? `<span class="tm-kanban-chip tm-kanban-chip--muted" title="${esc(name)}">${esc(name)}·示例</span>` : '';
                }
            }
        };
        const __tmFieldPreviewCardFrame = (metaHtml, remarkHtml = '') => `
            <div class="tm-kanban-card tm-field-preview__card${remarkHtml ? ' tm-kanban-card--has-remark' : ''}">
                <div class="tm-kanban-card-top tm-kanban-card-main">
                    <div class="tm-kanban-card-head">
                        ${__tmFieldPreviewCheckbox()}
                        <div class="tm-kanban-card-text"><span class="tm-kanban-card-title-inline tm-task-content-clickable">写周报</span></div>
                    </div>
                </div>
                ${metaHtml ? `<div class="tm-kanban-card-meta">${metaHtml}</div>` : ''}
                ${remarkHtml}
            </div>`;
        const __tmFieldPreviewCard = (keys) => {
            const list = Array.isArray(keys) ? keys : [];
            const metaHtml = list.map((key) => __tmFieldPreviewCardChip(key)).filter(Boolean).join('');
            const remarkHtml = list.includes('remark') ? '<div class="tm-task-card-remark">等对方回复</div>' : '';
            const emptyHint = (!metaHtml && !remarkHtml) ? '<span class="tm-field-preview__empty">卡片上只显示标题</span>' : '';
            return __tmFieldPreviewCardFrame(metaHtml, remarkHtml) + emptyHint;
        };
        const __tmFieldPreviewStickyCard = (keys) => {
            const labels = { priority: '重要性', status: '状态', date: '日期' };
            const chips = (Array.isArray(keys) ? keys : [])
                .map((key) => labels[key] ? `<span class="tm-kanban-chip tm-kanban-chip--muted tm-field-preview__chip--empty">${labels[key]} —</span>` : '')
                .filter(Boolean).join('');
            return __tmFieldPreviewCardFrame(chips);
        };
        const __tmFieldPreviewTimelineBar = (keys) => {
            const list = Array.isArray(keys) ? keys : [];
            const titleHtml = list.includes('title') ? '<span class="tm-gantt-bar__title">写周报</span>' : '';
            const statusHtml = list.includes('status') ? `<span class="tm-gantt-bar__status">${__tmFieldPreviewStatusTag('进行中', '#2f9e77')}</span>` : '';
            const completeAtHtml = list.includes('taskCompleteAt') ? '<span class="tm-gantt-bar__complete-time" title="完成时间"><span class="tm-gantt-bar__complete-time-value">09-22 18:30</span></span>' : '';
            const emptyHint = (!titleHtml && !statusHtml && !completeAtHtml) ? '<span class="tm-field-preview__empty">甘特条上不显示内容</span>' : '';
            return `
                <div class="tm-field-preview__gantt-host">
                    <div class="tm-gantt-bar tm-field-preview__gantt" style="--tm-gantt-bar-fill: var(--tm-primary-color);">
                        <div class="tm-gantt-bar__surface"><span class="tm-gantt-bar__edge tm-gantt-bar__edge--end"></span></div>
                        <span class="tm-gantt-bar__label-layer">${titleHtml}${statusHtml}${completeAtHtml}</span>
                    </div>
                    ${emptyHint}
                </div>`;
        };
        const __tmFieldPreviewQuickbarProp = (attrKey, value, extraStyle = '') =>
            `<span class="sy-custom-props-floatbar__prop sy-custom-props-floatbar__prop--core" data-attr="${esc(attrKey)}"${extraStyle ? ` style="${extraStyle}"` : ''}><span class="sy-custom-props-floatbar__prop-value">${esc(value)}</span></span>`;
        const __tmFieldPreviewQuickbarItem = (key) => {
            switch (key) {
                case 'custom-status': return `<span class="sy-custom-props-floatbar__prop" data-attr="custom-status" style="background:#2f9e7720;border-color:#2f9e77;color:#2f9e77;"><span class="sy-custom-props-floatbar__prop-value">进行中</span></span>`;
                case 'custom-priority': return __tmFieldPreviewQuickbarProp('custom-priority', '高');
                case 'custom-start-date': return __tmFieldPreviewQuickbarProp('custom-start-date', '9月20日');
                case 'custom-completion-time': return __tmFieldPreviewQuickbarProp('custom-completion-time', '9月25日');
                case 'taskCompleteAt': return __tmFieldPreviewQuickbarProp('taskCompleteAt', '09-22 18:30');
                case 'custom-focus-summary': return __tmFieldPreviewQuickbarProp('custom-focus-summary', '45 分钟');
                case 'custom-remark': return __tmFieldPreviewQuickbarProp('custom-remark', '等对方回复');
                case 'action-ai-title': return '<span class="sy-custom-props-floatbar__action" data-action="ai-title">AI 优化</span>';
                case 'action-reminder': return '<span class="sy-custom-props-floatbar__action" data-action="reminder">提醒</span>';
                case 'action-more': return '<span class="sy-custom-props-floatbar__action" data-action="more">更多</span>';
                default: {
                    const name = __tmFieldPreviewCustomFieldName(key);
                    return name ? __tmFieldPreviewQuickbarProp(key, `${name}·示例`) : '';
                }
            }
        };
        const __tmFieldPreviewQuickbar = (keys) => {
            const items = (Array.isArray(keys) ? keys : []).map((key) => __tmFieldPreviewQuickbarItem(key)).filter(Boolean).join('');
            return `<div class="sy-custom-props-floatbar tm-field-preview__floatbar">${items || '<span class="tm-field-preview__empty">悬浮条不显示字段</span>'}</div>`;
        };
        const __tmFieldPreviewInlineChip = (key) => {
            const chip = (cls, label, value) => `<span class="sy-custom-props-inline-chip${cls ? ` ${cls}` : ''}"><span class="sy-custom-props-inline-chip-label">${esc(label)}</span><span class="sy-custom-props-inline-chip-value">${esc(value)}</span></span>`;
            switch (key) {
                case 'subtask-count': return chip('', '子任务', '2/5');
                case 'custom-status': return chip('sy-custom-props-inline-chip--status', '状态', '进行中');
                case 'custom-priority': return chip('', '重要性', '高');
                case 'custom-start-date': return chip('sy-custom-props-inline-chip--time', '开始', '9月20日');
                case 'custom-completion-time': return chip('sy-custom-props-inline-chip--time', '截止', '9月25日');
                case 'remainingTime': return chip('', '剩余', '还剩 2 天');
                case 'taskCompleteAt': return chip('sy-custom-props-inline-chip--time', '完成', '09-22 18:30');
                case 'custom-focus-summary': return chip('', '专注', '45 分钟');
                case 'custom-remark': return chip('', '备注', '等对方回复');
                default: {
                    const name = __tmFieldPreviewCustomFieldName(key);
                    return name ? chip('', name, '示例') : '';
                }
            }
        };
        const __tmFieldPreviewInlineRow = (keys) => {
            const chips = (Array.isArray(keys) ? keys : []).map((key) => __tmFieldPreviewInlineChip(key)).filter(Boolean).join('');
            return `<div class="tm-field-preview__docline"><span class="tm-field-preview__docline-text">☐ 写周报</span>${chips || '<span class="tm-field-preview__empty">行末不显示字段</span>'}</div>`;
        };
        const __tmRenderSettingsFieldPreview = (type) => {
            let caption = '效果预览';
            let stage = '';
            let note = '';
            try {
                const data = SettingsStore.data || {};
                switch (String(type || '').trim()) {
                    case 'list-desktop':
                        caption = '清单 · 桌面端紧凑模式：任务右侧字段排列';
                        stage = __tmFieldPreviewListRow(__tmNormalizeCompactChecklistMetaFields(data.desktopChecklistCompactMetaFields), false);
                        break;
                    case 'list-dock':
                        caption = '清单 · Dock / 移动端：窄屏右侧字段';
                        stage = __tmFieldPreviewListRow(__tmNormalizeCompactChecklistMetaFields(data.dockChecklistCompactMetaFields), true);
                        break;
                    case 'timeline':
                        caption = '时间轴 · 甘特条卡片';
                        stage = __tmFieldPreviewTimelineBar(__tmNormalizeTimelineCardFields(data.timelineCardFields));
                        break;
                    case 'kanban':
                        caption = '看板卡片';
                        stage = __tmFieldPreviewCard(__tmGetTaskCardFieldList('kanban'));
                        break;
                    case 'whiteboard':
                        caption = '白板卡片';
                        stage = __tmFieldPreviewCard(__tmGetTaskCardFieldList('whiteboard'));
                        break;
                    case 'sticky':
                        caption = '看板 / 白板卡片：空值字段留位';
                        stage = __tmFieldPreviewStickyCard(__tmGetTaskCardAlwaysShowFieldList());
                        note = '<div class="tm-field-preview__note">选中的字段没有值时也保留位置（虚线示意），卡片高度更整齐。</div>';
                        break;
                    case 'quickbar':
                        caption = '任务悬浮条：直接显示的字段与动作';
                        stage = __tmFieldPreviewQuickbar((Array.isArray(data.quickbarVisibleItems) ? data.quickbarVisibleItems : []).map((value) => String(value || '').trim()).filter(Boolean));
                        break;
                    case 'quickbar-inline':
                        caption = '文档任务行末尾：常驻字段';
                        stage = __tmFieldPreviewInlineRow((Array.isArray(data.quickbarInlineFields) ? data.quickbarInlineFields : []).map((value) => String(value || '').trim()).filter(Boolean));
                        break;
                    default:
                        break;
                }
            } catch (e) {}
            return `<span class="tm-field-preview__cap">${caption}</span><div class="tm-field-preview__stage">${stage || '<span class="tm-field-preview__empty">未选择字段</span>'}</div>${note}`;
        };
        const __tmRefreshSettingsFieldPreviews = (root) => {
            const modal = root || state.settingsModal;
            if (!modal || typeof modal.querySelectorAll !== 'function') return;
            modal.querySelectorAll('[data-tm-field-preview]').forEach((host) => {
                try { host.innerHTML = __tmRenderSettingsFieldPreview(host.dataset.tmFieldPreview); } catch (e) {}
            });
        };
        const __tmBindSettingsFieldPreviewRefresh = (modal) => {
            if (!modal || modal.__tmFieldPreviewRefreshBound) return;
            modal.__tmFieldPreviewRefreshBound = true;
            modal.addEventListener('change', () => {
                setTimeout(() => { try { __tmRefreshSettingsFieldPreviews(modal); } catch (e) {} }, 0);
            });
        };"""
reps.append((old_chip_setting, new_chip_setting, "chip-setting + preview renderer"))

# --- 2. call sites -----------------------------------------------------------
reps.append((
    """                                return renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup('字段', options, {
                                        selectedSet: selected,
                                        onToggle: (item) => `updateChecklistCompactMetaFieldVisibility('dock', '${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ]);""",
    """                                return renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup('字段', options, {
                                        selectedSet: selected,
                                        onToggle: (item) => `updateChecklistCompactMetaFieldVisibility('dock', '${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ], { preview: 'list-dock' });""",
    "dock call site"))

reps.append((
    """                                return renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup('字段', options, {
                                        selectedSet: selected,
                                        onToggle: (item) => `updateChecklistCompactMetaFieldVisibility('desktop', '${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ]);""",
    """                                return renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup('字段', options, {
                                        selectedSet: selected,
                                        onToggle: (item) => `updateChecklistCompactMetaFieldVisibility('desktop', '${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ], { preview: 'list-desktop' });""",
    "desktop call site"))

reps.append((
    """                                return renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup('字段', __TM_TIMELINE_CARD_FIELD_OPTIONS, {
                                        selectedSet: selected,
                                        onToggle: (item) => `updateTimelineCardFieldVisibility('${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ]);""",
    """                                return renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup('字段', __TM_TIMELINE_CARD_FIELD_OPTIONS, {
                                        selectedSet: selected,
                                        onToggle: (item) => `updateTimelineCardFieldVisibility('${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ], { preview: 'timeline' });""",
    "timeline call site"))

reps.append((
    """                                return renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup('字段', __TM_TASK_CARD_FIELD_OPTIONS.concat(__tmBuildSettingsCustomFieldChipItems()), {
                                        selectedSet: selected,
                                        onToggle: (item) => `updateTaskCardFieldVisibility('kanban', '${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ]);""",
    """                                return renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup('字段', __TM_TASK_CARD_FIELD_OPTIONS.concat(__tmBuildSettingsCustomFieldChipItems()), {
                                        selectedSet: selected,
                                        onToggle: (item) => `updateTaskCardFieldVisibility('kanban', '${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ], { preview: 'kanban' });""",
    "kanban call site"))

reps.append((
    """                                return renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup('字段', __TM_TASK_CARD_FIELD_OPTIONS.concat(__tmBuildSettingsCustomFieldChipItems()), {
                                        selectedSet: selected,
                                        onToggle: (item) => `updateTaskCardFieldVisibility('whiteboard', '${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ]);""",
    """                                return renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup('字段', __TM_TASK_CARD_FIELD_OPTIONS.concat(__tmBuildSettingsCustomFieldChipItems()), {
                                        selectedSet: selected,
                                        onToggle: (item) => `updateTaskCardFieldVisibility('whiteboard', '${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ], { preview: 'whiteboard' });""",
    "whiteboard call site"))

reps.append((
    """                                return renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup('常驻字段', __TM_TASK_CARD_ALWAYS_SHOW_FIELD_OPTIONS, {
                                        selectedSet: selected,
                                        onToggle: (item) => `updateTaskCardAlwaysShowField('${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ]);""",
    """                                return renderSettingsChipSetting('', '', [
                                    __tmBuildSettingsChipGroup('常驻字段', __TM_TASK_CARD_ALWAYS_SHOW_FIELD_OPTIONS, {
                                        selectedSet: selected,
                                        onToggle: (item) => `updateTaskCardAlwaysShowField('${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ], { preview: 'sticky' });""",
    "sticky call site"))

reps.append((
    """                                        selectedSet: new Set((SettingsStore.data.quickbarVisibleItems || []).map((value) => String(value || '').trim()).filter(Boolean)),
                                        disabled: !SettingsStore.data.enableQuickbar,
                                        onToggle: (item) => `updateQuickbarVisibleItem('${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ]),""",
    """                                        selectedSet: new Set((SettingsStore.data.quickbarVisibleItems || []).map((value) => String(value || '').trim()).filter(Boolean)),
                                        disabled: !SettingsStore.data.enableQuickbar,
                                        onToggle: (item) => `updateQuickbarVisibleItem('${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ], { preview: 'quickbar' }),""",
    "quickbar call site"))

reps.append((
    """                                        selectedSet: new Set((SettingsStore.data.quickbarInlineFields || []).map((value) => String(value || '').trim()).filter(Boolean)),
                                        disabled: !SettingsStore.data.enableQuickbarInlineMeta,
                                        onToggle: (item) => `updateQuickbarInlineField('${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ]),""",
    """                                        selectedSet: new Set((SettingsStore.data.quickbarInlineFields || []).map((value) => String(value || '').trim()).filter(Boolean)),
                                        disabled: !SettingsStore.data.enableQuickbarInlineMeta,
                                        onToggle: (item) => `updateQuickbarInlineField('${escSq(String(item?.key || '').trim())}', this.checked)`
                                    })
                                ], { preview: 'quickbar-inline' }),""",
    "quickbar-inline call site"))

# --- 3. bind refresh after render -------------------------------------------
reps.append((
    """        state.settingsModal.innerHTML = renderSettingsModalMarkup();""",
    """        state.settingsModal.innerHTML = renderSettingsModalMarkup();
        try { __tmBindSettingsFieldPreviewRefresh(state.settingsModal); } catch (e) {}""",
    "bind preview refresh"))

for old, new, name in reps:
    count = src.count(old)
    assert count == 1, f"{name}: expected 1 occurrence, got {count}"
    src = src.replace(old, new)

with io.open(PATH, "w", encoding="utf-8", newline="") as f:
    f.write(src.replace("\n", "\r\n"))

print("field preview port applied OK")
