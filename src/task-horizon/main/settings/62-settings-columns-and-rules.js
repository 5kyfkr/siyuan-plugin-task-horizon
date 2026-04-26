    window.toggleColumn = async function(key, show) {
        const options = arguments.length >= 3 ? arguments[2] : {};
        const opts = (options && typeof options === 'object') ? options : {};
        const colKey = String(key || '').trim();
        const prevCustomFieldPlan = __tmBuildRuntimeCustomFieldLoadPlan();
        let order = Array.isArray(SettingsStore.data.columnOrder) ? [...SettingsStore.data.columnOrder] : [];
        let hiddenColumns = Array.isArray(SettingsStore.data.hiddenColumns) ? [...SettingsStore.data.hiddenColumns] : [];
        order = order.filter((item, index) => item && order.indexOf(item) === index);
        hiddenColumns = hiddenColumns.filter((item, index) => item && hiddenColumns.indexOf(item) === index);
        if (!colKey) return;
        if (show) {
            hiddenColumns = hiddenColumns.filter((item) => item !== colKey);
            if (!order.includes(colKey)) order.push(colKey);
        } else {
            if (order.length <= 1 && order.includes(colKey)) {
                hint('⚠️ 至少保留一列', 'warning');
                return;
            }
            order = order.filter((item) => item !== colKey);
            if (!hiddenColumns.includes(colKey)) hiddenColumns.push(colKey);
        }
        SettingsStore.data.columnOrder = order;
        SettingsStore.data.hiddenColumns = hiddenColumns;
        SettingsStore.normalizeColumns();
        try { SettingsStore.syncToLocal(); } catch (e) {}
        try { SettingsStore.save().catch(() => null); } catch (e) {}
        try { SettingsStore.flushSave().catch(() => null); } catch (e) {}
        const nextCustomFieldPlan = __tmBuildRuntimeCustomFieldLoadPlan({
            colOrder: Array.isArray(SettingsStore.data.columnOrder) ? SettingsStore.data.columnOrder : order,
        });
        if (opts.refreshSettings !== false && state.settingsModal instanceof Element && document.body.contains(state.settingsModal)) {
            showSettings();
        }
        if (__tmDoesCustomFieldPlanNeedReload(prevCustomFieldPlan, nextCustomFieldPlan)) {
            try {
                await loadSelectedDocuments({
                    showInlineLoading: false,
                    source: 'toggle-column',
                });
                return;
            } catch (e) {}
        } else {
            try {
                await __tmCommitCustomFieldLoadPlan(prevCustomFieldPlan, nextCustomFieldPlan, {
                    hydrateVisible: true,
                });
            } catch (e) {}
        }
        render();
    };

    window.moveColumn = function(key, direction) {
        let order = [...(SettingsStore.data.columnOrder || [])];
        const idx = order.indexOf(key);
        if (idx === -1) return;

        const newIdx = idx + direction;
        if (newIdx < 0 || newIdx >= order.length) return;

        [order[idx], order[newIdx]] = [order[newIdx], order[idx]];

        SettingsStore.data.columnOrder = order;
        SettingsStore.save();
        showSettings();
        render();
    };

    // ============ 状态选项管理 ============
    function __tmGetStatusOptionDraft() {
        const source = (state.statusOptionDraft && typeof state.statusOptionDraft === 'object') ? state.statusOptionDraft : null;
        if (!source) return null;
        const options = Array.isArray(SettingsStore?.data?.customStatusOptions) ? SettingsStore.data.customStatusOptions : [];
        const fallbackColor = __tmGetStatusPresetColor(options.length);
        return {
            name: source.name == null ? '' : String(source.name),
            id: source.id == null ? '' : String(source.id),
            color: __tmNormalizeHexColor(source.color, fallbackColor) || fallbackColor,
            marker: source.marker == null ? ' ' : String(source.marker),
        };
    }

    function __tmFocusStatusOptionDraftInput() {
        try {
            const input = state.settingsModal?.querySelector?.('[data-tm-status-option-draft-name]');
            if (input instanceof HTMLInputElement) {
                input.focus();
                input.select?.();
                return true;
            }
        } catch (e) {}
        return false;
    }

    function __tmFocusStatusOptionDraftField(selector) {
        try {
            const input = state.settingsModal?.querySelector?.(selector);
            if (input instanceof HTMLInputElement) {
                input.focus();
                input.select?.();
                return true;
            }
        } catch (e) {}
        return false;
    }

    window.renderStatusOptionsList = function() {
        const options = SettingsStore.data.customStatusOptions || [];
        const rows = options.map((opt, index) => `
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;">
                <button
                    type="button"
                    data-tm-status-color-btn="${index}"
                    onclick="tmPickStatusOptionColor(${index})"
                    style="width: 24px; height: 24px; border: 1px solid var(--tm-border-color); padding: 0; background: ${esc(__tmNormalizeHexColor(opt?.color, __tmGetStatusPresetColor(index)) || __tmGetStatusPresetColor(index))}; cursor: pointer; border-radius: 6px; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18);"
                    title="点击选择预置色系或自定义颜色"
                ></button>
                <input type="text" value="${esc(opt.name)}" onchange="updateStatusOption(${index}, 'name', this.value)" style="width: 100px; padding: 4px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px; font-size: 13px;" title="修改名称">
                <input type="text" value="${esc(opt.id)}" onchange="updateStatusOption(${index}, 'id', this.value)" style="width: 120px; padding: 4px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px; font-size: 12px; font-family: monospace;" title="修改ID（将同步更新任务状态）">
                <input type="text" value="${esc(__tmNormalizeTaskStatusMarker(opt?.marker, __tmGuessStatusOptionDefaultMarker(opt)))}" onchange="updateStatusOption(${index}, 'marker', this.value)" placeholder="空格" style="width: 56px; padding: 4px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px; font-size: 12px; font-family: monospace; text-align: center;" title="写入任务 - [ ] 方括号中的单字节字符；空格表示未完成，当前：${esc(__tmFormatStatusMarkerText(opt?.marker))}">
                <div style="display: flex; gap: 2px;">
                    <button class="tm-btn" onclick="moveStatusOption(${index}, -1)" ${index === 0 ? 'disabled' : ''} style="padding: 2px 6px; font-size: 11px;">↑</button>
                    <button class="tm-btn" onclick="moveStatusOption(${index}, 1)" ${index === options.length - 1 ? 'disabled' : ''} style="padding: 2px 6px; font-size: 11px;">↓</button>
                </div>
                <button class="tm-btn tm-btn-danger" onclick="deleteStatusOption(${index})" style="padding: 2px 6px; font-size: 11px;">删除</button>
            </div>
        `);
        const draft = __tmGetStatusOptionDraft();
        if (draft) {
            rows.push(`
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;">
                    <button
                        type="button"
                        data-tm-status-color-btn="__draft__"
                        onclick="tmPickStatusOptionDraftColor()"
                        style="width: 24px; height: 24px; border: 1px solid var(--tm-border-color); padding: 0; background: ${esc(draft.color)}; cursor: pointer; border-radius: 6px; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18);"
                        title="点击选择预置色系或自定义颜色"
                    ></button>
                    <input data-tm-status-option-draft-name type="text" value="${esc(draft.name)}" oninput="updateStatusOptionDraft('name', this.value)" placeholder="状态名称" style="width: 100px; padding: 4px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px; font-size: 13px;" title="请输入状态名称">
                    <input data-tm-status-option-draft-id type="text" value="${esc(draft.id)}" oninput="updateStatusOptionDraft('id', this.value)" placeholder="自定义属性名称" style="width: 120px; padding: 4px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px; font-size: 12px; font-family: monospace;" title="请输入自定义属性名称（唯一标识）">
                    <input data-tm-status-option-draft-marker type="text" value="${esc(__tmNormalizeTaskStatusMarker(draft.marker, ' '))}" oninput="updateStatusOptionDraft('marker', this.value)" placeholder="空格" style="width: 56px; padding: 4px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px; font-size: 12px; font-family: monospace; text-align: center;" title="写入任务 - [ ] 方括号中的单字节字符；默认空格表示未完成，当前：${esc(__tmFormatStatusMarkerText(draft.marker))}">
                    <button class="tm-btn tm-btn-success" onclick="saveStatusOptionDraft()" style="padding: 2px 8px; font-size: 11px;">保存</button>
                    <button class="tm-btn" onclick="cancelStatusOptionDraft()" style="padding: 2px 8px; font-size: 11px;">取消</button>
                </div>
            `);
        }
        return rows.join('');
    };

    window.renderDurationOptionsList = function() {
        const options = __tmGetDurationPresetOptions();
        if (!options.length) {
            return '<div style="color: var(--tm-secondary-text); font-size: 12px;">暂无时长预设，编辑时会继续使用自定义填写。</div>';
        }
        return options.map((value, index) => {
            const normalized = __tmNormalizeDurationPresetValue(value);
            return `
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
                    <input type="text" data-tm-duration-option-input="${index}" value="${esc(normalized)}" onchange="updateDurationOption(${index}, this.value)" placeholder="例如 0.5 / 1 / 30" style="width: 200px; padding: 4px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px; font-size: 12px; font-family: monospace;" title="时长值（只取数字部分）">
                    <div style="display:flex;gap:2px;">
                        <button class="tm-btn" onclick="moveDurationOption(${index}, -1)" ${index === 0 ? 'disabled' : ''} style="padding: 2px 6px; font-size: 11px;">↑</button>
                        <button class="tm-btn" onclick="moveDurationOption(${index}, 1)" ${index === options.length - 1 ? 'disabled' : ''} style="padding: 2px 6px; font-size: 11px;">↓</button>
                    </div>
                    <button class="tm-btn tm-btn-danger" onclick="deleteDurationOption(${index})" style="padding: 2px 6px; font-size: 11px;">删除</button>
                </div>
            `;
        }).join('');
    };

    window.tmPickStatusOptionColor = function(index) {
        const options = SettingsStore.data.customStatusOptions || [];
        const option = options[index];
        if (!option) return;
        const fallback = __tmGetStatusPresetColor(index);
        const current = __tmNormalizeHexColor(option?.color, fallback) || fallback;
        __tmOpenColorPickerDialog('状态颜色', current, async (next) => {
            await window.updateStatusOption?.(index, 'color', next);
        }, __tmBuildPresetColorPickerOptions(fallback));
    };

    window.tmPickStatusOptionDraftColor = function() {
        const draft = __tmGetStatusOptionDraft();
        if (!draft) return;
        const fallback = String(draft.color || '').trim() || __tmGetStatusPresetColor((SettingsStore.data.customStatusOptions || []).length);
        __tmOpenColorPickerDialog('状态颜色', fallback, async (next) => {
            window.updateStatusOptionDraft?.('color', next);
        }, __tmBuildPresetColorPickerOptions(fallback));
    };

    window.updateStatusOptionDraft = function(field, value) {
        const draft = __tmGetStatusOptionDraft();
        if (!draft) return;
        if (field === 'color') {
            const nextColor = __tmNormalizeHexColor(value, draft.color) || draft.color;
            state.statusOptionDraft = { ...draft, color: nextColor };
            try {
                document.querySelectorAll('[data-tm-status-color-btn="__draft__"]').forEach((btn) => {
                    btn.style.background = nextColor;
                    btn.title = `点击选择预置色系或自定义颜色（当前 ${__tmFormatColorDisplayValue(nextColor)}）`;
                });
            } catch (e) {}
            return;
        }
        state.statusOptionDraft = {
            ...draft,
            [field]: value == null ? '' : String(value),
        };
    };

    window.addStatusOption = function() {
        if (__tmGetStatusOptionDraft()) {
            if (!__tmFocusStatusOptionDraftInput()) {
                state.statusOptionDraftShouldFocus = true;
                showSettings();
            }
            return;
        }
        const options = Array.isArray(SettingsStore.data.customStatusOptions) ? SettingsStore.data.customStatusOptions : [];
        state.statusOptionDraft = {
            name: '',
            id: '',
            color: __tmGetStatusPresetColor(options.length),
            marker: ' ',
        };
        state.statusOptionDraftShouldFocus = true;
        showSettings();
    };

    window.cancelStatusOptionDraft = function() {
        state.statusOptionDraft = null;
        state.statusOptionDraftShouldFocus = false;
        showSettings();
    };

    window.saveStatusOptionDraft = async function() {
        const draft = __tmGetStatusOptionDraft();
        if (!draft) return;
        const name = String(draft.name || '').trim();
        const id = String(draft.id || '').trim();
        if (!name) {
            hint('状态名称不能为空', 'warning');
            __tmFocusStatusOptionDraftInput();
            return;
        }
        if (!id) {
            hint('自定义属性名称不能为空', 'warning');
            __tmFocusStatusOptionDraftField('[data-tm-status-option-draft-id]');
            return;
        }
        const options = Array.isArray(SettingsStore.data.customStatusOptions) ? SettingsStore.data.customStatusOptions : [];
        if (options.some((o) => String(o?.id || '').trim() === id)) {
            hint('自定义属性名称已存在，请使用其他名称', 'warning');
            __tmFocusStatusOptionDraftField('[data-tm-status-option-draft-id]');
            return;
        }
        const rawMarker = draft.marker == null ? '' : String(draft.marker);
        const directMarker = __tmNormalizeTaskStatusMarker(rawMarker, '');
        if (!directMarker && rawMarker !== '' && rawMarker !== ' ') {
            hint('状态标记必须是单个字节字符，且不能是 [ 或 ]', 'warning');
            __tmFocusStatusOptionDraftField('[data-tm-status-option-draft-marker]');
            return;
        }
        options.push({
            id,
            name,
            color: __tmNormalizeHexColor(draft.color, __tmGetStatusPresetColor(options.length)) || __tmGetStatusPresetColor(options.length),
            marker: directMarker || ' ',
        });
        SettingsStore.data.customStatusOptions = options;
        state.statusOptionDraft = null;
        state.statusOptionDraftShouldFocus = false;
        await SettingsStore.save();
        showSettings();
        render();
        try { window.tmQuickAddRefreshStatusSelect?.(); } catch (e) {}
        try { window.tmQuickAddRenderMeta?.(); } catch (e) {}
    };

    window.addDurationOption = async function() {
        const rawValue = await showPrompt('添加时长预设', '请输入时长值，例如 0.5 / 1 / 30；若写 1h / 30min 也只会取数字', '');
        if (rawValue == null) return;
        const value = __tmNormalizeDurationPresetValue(rawValue);
        if (!value) {
            hint('时长值不能为空', 'warning');
            return;
        }
        const options = __tmGetDurationPresetOptions();
        if (options.some((item) => __tmNormalizeDurationPresetValue(item).toLowerCase() === value.toLowerCase())) {
            hint('时长值已存在，请使用其他值', 'warning');
            return;
        }
        options.push(value);
        SettingsStore.data.customDurationOptions = options;
        await SettingsStore.save();
        showSettings();
    };

    // 绑定添加规则函数
    window.tmAddRule = function() {
        // 创建一个新规则模板
        state.editingRule = {
            id: 'r_' + Date.now(),
            name: '新规则',
            conditions: [{
                id: 'c_' + Date.now(),
                field: 'content',
                operator: 'contains',
                value: ''
            }]
        };
        state.settingsActiveTab = 'rule_editor';
        showSettings();
    };

    // 绑定编辑规则函数
    window.tmEditRule = function(ruleId) {
        const rule = state.filterRules.find(r => r.id === ruleId);
        if (!rule) return;

        // 克隆规则对象，避免直接修改
        state.editingRule = JSON.parse(JSON.stringify(rule));
        state.settingsActiveTab = 'rule_editor';
        showSettings();
    };

    // 绑定关闭规则编辑器函数
    window.tmCloseRuleEditor = function() {
        state.editingRule = null;
        state.settingsActiveTab = 'rules';
        showSettings();
    };

    // 绑定规则保存函数
    window.tmSaveRule = async function() {
        if (!state.editingRule) return;
        const nameInput = document.getElementById('tmRuleName');
        const name = nameInput ? nameInput.value.trim() : '';
        if (!name) {
            hint('请输入规则名称', 'warning');
            return;
        }

        // 获取所有条件
        const conditionRows = document.querySelectorAll('.tm-rule-condition-row');
        const conditions = [];
        conditionRows.forEach(row => {
            const field = row.querySelector('.tm-rule-field').value;
            const operator = row.querySelector('.tm-rule-operator').value;
            let value = '';

            // 根据字段类型获取值
            if (field === 'priority' || field === 'customStatus') {
                // 多选
                const checkboxes = row.querySelectorAll('input[type="checkbox"]:checked');
                const values = Array.from(checkboxes).map(cb => cb.value);
                if (values.length > 0) value = values;
            } else if (field === 'done') {
                value = row.querySelector('.tm-rule-value').value;
            } else {
                value = row.querySelector('.tm-rule-value').value;
            }

            // 简单校验
            if (value === '' || (Array.isArray(value) && value.length === 0)) return;

            conditions.push({
                id: 'c_' + Date.now() + Math.random().toString(36).slice(2),
                field,
                operator,
                value
            });
        });

        // 更新规则
        state.editingRule.name = name;
        state.editingRule.conditions = conditions;

        // 如果是新规则，添加到列表
        const existing = state.filterRules.find(r => r.id === state.editingRule.id);
        if (!existing) {
            state.filterRules.push(state.editingRule);
        } else {
            // 更新现有规则（对象引用已更新，只需确保在列表中）
            const idx = state.filterRules.findIndex(r => r.id === state.editingRule.id);
            if (idx !== -1) state.filterRules[idx] = state.editingRule;
        }

        // 保存到设置
        SettingsStore.data.filterRules = state.filterRules;
        await SettingsStore.save();

        // 关闭编辑器并刷新
        tmCloseRuleEditor();
        showSettings();
        render(); // 如果当前应用了该规则，需要刷新主界面
    };

    function __tmRemapStatusId(oldId, newId) {
        if (!oldId || !newId || oldId === newId) return;

        // 更新当前内存中的任务状态
        try {
            Object.values(state.flatTasks || {}).forEach(t => {
                if (t && t.customStatus === oldId) t.customStatus = newId;
            });
        } catch (e) {}

        // 更新 MetaStore 中的状态值
        try {
            if (MetaStore?.data && typeof MetaStore.data === 'object') {
                Object.keys(MetaStore.data).forEach(taskId => {
                    const meta = MetaStore.data[taskId];
                    if (meta && meta.customStatus === oldId) {
                        MetaStore.data[taskId] = { ...meta, customStatus: newId };
                    }
                });
                if (typeof MetaStore.scheduleSave === 'function') MetaStore.scheduleSave();
            }
        } catch (e) {}

        // 更新规则里引用的状态值
        const patchRules = (rules) => {
            if (!Array.isArray(rules)) return;
            rules.forEach(rule => {
                if (!Array.isArray(rule.conditions)) return;
                rule.conditions.forEach(c => {
                    if (c?.field !== 'customStatus') return;
                    if (Array.isArray(c.value)) {
                        c.value = c.value.map(v => (v === oldId ? newId : v));
                    } else if (c.value === oldId) {
                        c.value = newId;
                    }
                });
            });
        };
        try {
            patchRules(state.filterRules);
            patchRules(SettingsStore.data.filterRules);
        } catch (e) {}

        try {
            if (String(SettingsStore.data.checkboxDoneStatusId || '').trim() === oldId) SettingsStore.data.checkboxDoneStatusId = newId;
            if (String(SettingsStore.data.checkboxUndoneStatusId || '').trim() === oldId) SettingsStore.data.checkboxUndoneStatusId = newId;
        } catch (e) {}
    }

    window.updateCheckboxStatusBinding = async function(kind, value) {
        const mode = String(kind || '').trim();
        const key = mode === 'done'
            ? 'checkboxDoneStatusId'
            : (mode === 'undone' ? 'checkboxUndoneStatusId' : '');
        if (!key) return;
        const options = Array.isArray(SettingsStore.data.customStatusOptions) ? SettingsStore.data.customStatusOptions : [];
        let nextValue = __tmNormalizeCheckboxStatusBindingValue(value);
        if (mode === 'undone' && !nextValue) {
            nextValue = __tmGetDefaultUndoneStatusId(options);
        }
        if (nextValue && !options.some((item) => String(item?.id || '').trim() === nextValue)) {
            hint('状态不存在，请重新选择', 'warning');
            showSettings();
            return;
        }
        SettingsStore.data[key] = nextValue;
        __tmNormalizeCheckboxStatusBindingConfig(SettingsStore.data);
        await SettingsStore.save();
        render();
    };

    window.updateStatusOption = async function(index, field, value) {
        const options = SettingsStore.data.customStatusOptions || [];
        if (!options[index]) return;

        if (field === 'id') {
            const nextId = String(value || '').trim();
            if (!nextId) {
                hint('ID 不能为空', 'warning');
                showSettings();
                return;
            }
            if (options.some((o, i) => i !== index && o.id === nextId)) {
                hint('ID 已存在，请使用其他ID', 'warning');
                showSettings();
                return;
            }
            const prevId = options[index].id;
            options[index].id = nextId;
            SettingsStore.data.customStatusOptions = options;
            __tmRemapStatusId(prevId, nextId);
            await SettingsStore.save();
            showSettings();
            render();
            try { window.tmQuickAddRefreshStatusSelect?.(); } catch (e) {}
            try { window.tmQuickAddRenderMeta?.(); } catch (e) {}
            return;
        }

        if (field === 'color') {
            const nextColor = __tmNormalizeHexColor(value, __tmGetStatusPresetColor(index)) || __tmGetStatusPresetColor(index);
            options[index].color = nextColor;
        } else if (field === 'marker') {
            const rawMarker = value == null ? '' : String(value);
            const directMarker = __tmNormalizeTaskStatusMarker(rawMarker, '');
            if (!directMarker && rawMarker !== '') {
                hint('状态标记必须是单个字节字符，且不能是 [ 或 ]', 'warning');
                showSettings();
                return;
            }
            options[index].marker = directMarker || __tmGuessStatusOptionDefaultMarker(options[index], ' ');
        } else {
            options[index][field] = value;
        }
        SettingsStore.data.customStatusOptions = options;
        await SettingsStore.save();
        if (field === 'color') {
            try {
                const nextColor = String(options[index]?.color || '').trim();
                const title = `点击选择预置色系或自定义颜色（当前 ${__tmFormatColorDisplayValue(nextColor)}）`;
                document.querySelectorAll(`[data-tm-status-color-btn="${index}"]`).forEach((btn) => {
                    btn.style.background = nextColor;
                    btn.title = title;
                });
            } catch (e) {}
        }
        // 不刷新整个界面，以免输入焦点丢失
        render(); // 刷新主界面
        try { window.tmQuickAddRefreshStatusSelect?.(); } catch (e) {}
        try { window.tmQuickAddRenderMeta?.(); } catch (e) {}
    };

    window.updateDurationOption = async function(index, value) {
        const options = __tmGetDurationPresetOptions();
        if (!options[index]) return;
        const nextValue = __tmNormalizeDurationPresetValue(value);
        if (!nextValue) {
            hint('时长值不能为空', 'warning');
            showSettings();
            return;
        }
        if (options.some((item, itemIndex) => itemIndex !== index && __tmNormalizeDurationPresetValue(item).toLowerCase() === nextValue.toLowerCase())) {
            hint('时长值已存在，请使用其他值', 'warning');
            showSettings();
            return;
        }
        options[index] = nextValue;
        SettingsStore.data.customDurationOptions = options;
        await SettingsStore.save();
        try {
            document.querySelectorAll(`[data-tm-duration-option-input="${index}"]`).forEach((el) => {
                if (el instanceof HTMLInputElement) el.value = nextValue;
            });
        } catch (e) {}
    };

    window.moveStatusOption = async function(index, direction) {
        const options = [...(SettingsStore.data.customStatusOptions || [])];
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= options.length) return;
        [options[index], options[newIndex]] = [options[newIndex], options[index]];
        SettingsStore.data.customStatusOptions = options;
        await SettingsStore.save();
        showSettings();
        render();
        try { window.tmQuickAddRefreshStatusSelect?.(); } catch (e) {}
        try { window.tmQuickAddRenderMeta?.(); } catch (e) {}
    };

    window.moveDurationOption = async function(index, direction) {
        const options = __tmGetDurationPresetOptions();
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= options.length) return;
        [options[index], options[newIndex]] = [options[newIndex], options[index]];
        SettingsStore.data.customDurationOptions = options;
        await SettingsStore.save();
        showSettings();
    };

    window.deleteStatusOption = async function(index) {
        const ok = await showConfirm('删除状态', '确定删除此状态吗？');
        if (!ok) return;
        const options = SettingsStore.data.customStatusOptions || [];
        options.splice(index, 1);
        SettingsStore.data.customStatusOptions = options;
        __tmNormalizeCheckboxStatusBindingConfig(SettingsStore.data);
        await SettingsStore.save();
        showSettings(); // 刷新界面
        render(); // 刷新主界面
        try { window.tmQuickAddRefreshStatusSelect?.(); } catch (e) {}
        try { window.tmQuickAddRenderMeta?.(); } catch (e) {}
    };

    window.deleteDurationOption = async function(index) {
        const ok = await showConfirm('删除时长预设', '确定删除这个时长预设吗？');
        if (!ok) return;
        const options = __tmGetDurationPresetOptions();
        options.splice(index, 1);
        SettingsStore.data.customDurationOptions = options;
        await SettingsStore.save();
        showSettings();
    };

    window.tmDeleteCustomFieldById = async function(fieldId) {
        const currentFieldId = String(fieldId || '').trim();
        if (!currentFieldId) return false;
        const field = __tmGetCustomFieldDefs().find((item) => String(item?.id || '').trim() === currentFieldId) || null;
        if (!field) return false;
        const ok = await showConfirm('删除自定义列', `确定删除“${String(field?.name || currentFieldId).trim() || currentFieldId}”吗？已有任务上的历史值不会被立即清理，但会停止显示。`);
        if (!ok) return false;
        const nextDefs = __tmGetCustomFieldDefs().filter((item) => String(item?.id || '').trim() !== currentFieldId);
        const colKey = __tmBuildCustomFieldColumnKey(currentFieldId);
        SettingsStore.data.customFieldDefs = nextDefs;
        SettingsStore.data.columnOrder = (Array.isArray(SettingsStore.data.columnOrder) ? SettingsStore.data.columnOrder : []).filter((key) => key !== colKey);
        SettingsStore.data.hiddenColumns = (Array.isArray(SettingsStore.data.hiddenColumns) ? SettingsStore.data.hiddenColumns : []).filter((key) => key !== colKey);
        if (SettingsStore.data.columnWidths && typeof SettingsStore.data.columnWidths === 'object') {
            delete SettingsStore.data.columnWidths[colKey];
        }
        const patchRules = (rules) => {
            if (!Array.isArray(rules)) return;
            rules.forEach((rule) => {
                if (!rule || typeof rule !== 'object') return;
                if (Array.isArray(rule.conditions)) {
                    rule.conditions = rule.conditions.filter((condition) => String(condition?.field || '').trim() !== colKey);
                }
                if (Array.isArray(rule.sort)) {
                    rule.sort = rule.sort.filter((sortRule) => String(sortRule?.field || '').trim() !== colKey);
                }
            });
        };
        try {
            patchRules(state.filterRules);
            patchRules(SettingsStore.data.filterRules);
            if (state.editingRule && typeof state.editingRule === 'object') {
                patchRules([state.editingRule]);
            }
        } catch (e) {}
        SettingsStore.normalizeColumns();
        await SettingsStore.save();
        hint('✅ 自定义列已删除', 'success');
        if (state.settingsModal) showSettings();
        render();
        return true;
    };

    window.tmOpenCustomFieldDialog = function(fieldId = '', options = {}) {
        __tmRemoveElementsById('tm-custom-field-dialog-backdrop');
        const opts = (options && typeof options === 'object') ? options : {};
        const defs = __tmGetCustomFieldDefs();
        const resolveDraft = (sourceField = null, type = '') => {
            const source = sourceField && typeof sourceField === 'object' ? sourceField : null;
            const draftType = type === 'multi'
                ? 'multi'
                : (type === 'text' ? 'text' : 'single');
            const normalized = source
                ? __tmNormalizeCustomFieldDef(source, 0, new Set(), new Set())
                : __tmNormalizeCustomFieldDef({
                    id: '',
                    name: '',
                    attrKey: '',
                    type: draftType,
                    options: draftType === 'text'
                        ? []
                        : [
                            { name: '选项1', color: __tmGetCustomFieldPresetColor(0) },
                            { name: '选项2', color: __tmGetCustomFieldPresetColor(1) },
                        ],
                    enabled: true,
                }, 0, new Set(), new Set());
            if (!source) {
                normalized.id = '';
                normalized.attrKey = '';
            }
            return normalized;
        };
        let currentFieldId = String(fieldId || '').trim();
        const currentField = defs.find((field) => String(field?.id || '').trim() === currentFieldId) || null;
        let draft = resolveDraft(currentField, String(opts.type || '').trim());

        const backdrop = document.createElement('div');
        backdrop.id = 'tm-custom-field-dialog-backdrop';
        backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:200050;display:flex;align-items:center;justify-content:center;padding:24px;';

        const dialog = document.createElement('div');
        dialog.style.cssText = 'width:min(860px,96vw);max-height:min(88vh,860px);background:var(--tm-bg-color);color:var(--tm-text-color);border:1px solid var(--tm-border-color);border-radius:16px;box-shadow:0 18px 48px rgba(0,0,0,0.2);display:flex;flex-direction:column;overflow:hidden;';
        backdrop.appendChild(dialog);

        const close = () => {
            try { backdrop.remove(); } catch (e) {}
        };

        const renderDialog = () => {
            const prevScrollEl = dialog.querySelector('[data-tm-custom-field-dialog-scroll]');
            const prevScrollTop = prevScrollEl ? prevScrollEl.scrollTop : 0;
            const viewportWidth = Math.max(0, window.innerWidth || document.documentElement?.clientWidth || 0);
            const isCompact = viewportWidth > 0 ? viewportWidth <= 720 : __tmIsMobileDevice();
            const isPhone = viewportWidth > 0 ? viewportWidth <= 520 : isCompact;
            const backdropPadding = isPhone ? 8 : (isCompact ? 12 : 24);
            backdrop.style.padding = `${backdropPadding}px`;
            backdrop.style.alignItems = isPhone ? 'stretch' : 'center';
            dialog.style.cssText = [
                'background:var(--tm-bg-color)',
                'color:var(--tm-text-color)',
                'border:1px solid var(--tm-border-color)',
                `border-radius:${isPhone ? '12px' : '16px'}`,
                'box-shadow:0 18px 48px rgba(0,0,0,0.2)',
                'display:flex',
                'flex-direction:column',
                'overflow:hidden',
                `width:${isCompact ? '100%' : 'min(860px,96vw)'}`,
                `max-width:${isCompact ? '100%' : '96vw'}`,
                `max-height:${isCompact ? `calc(100vh - ${backdropPadding * 2}px)` : 'min(88vh,860px)'}`,
            ].join(';');
            const defsNow = __tmGetCustomFieldDefs();
            const draftType = String(draft.type || 'single').trim() === 'multi'
                ? 'multi'
                : (String(draft.type || '').trim() === 'text' ? 'text' : 'single');
            const supportsOptions = draftType !== 'text';
            const listHtml = defsNow.map((field) => {
                const id = String(field?.id || '').trim();
                const active = id && id === currentFieldId;
                const fieldType = String(field?.type || '').trim();
                const fieldTypeLabel = fieldType === 'multi'
                    ? '多选'
                    : (fieldType === 'text' ? '文本' : '单选');
                return `
                    <button type="button" data-tm-custom-field-open="${esc(id)}" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border:1px solid ${active ? 'var(--tm-primary-color)' : 'var(--tm-border-color)'};border-radius:10px;background:${active ? 'var(--tm-hover-bg)' : 'var(--tm-card-bg)'};color:var(--tm-text-color);cursor:pointer;text-align:left;">
                        <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(String(field?.name || id || '未命名自定义列').trim() || '未命名自定义列')}</span>
                        <span style="font-size:11px;color:var(--tm-secondary-text);flex:none;">${fieldTypeLabel}</span>
                    </button>
                `;
            }).join('');
            const optionRows = (Array.isArray(draft.options) ? draft.options : []).map((option, index) => `
                <div data-tm-custom-field-option-row="${index}" style="display:grid;grid-template-columns:${isCompact ? '36px minmax(0,1fr) auto' : '36px 1fr 86px auto'};gap:8px;align-items:center;padding:${isCompact ? '10px' : '8px'};border:1px solid var(--tm-border-color);border-radius:10px;background:var(--tm-card-bg);">
                    <input data-tm-custom-field-option-color="${index}" type="color" value="${esc(String(option?.color || __tmGetCustomFieldPresetColor(index)).trim() || __tmGetCustomFieldPresetColor(index))}" style="width:28px;height:28px;border:none;padding:0;background:none;cursor:pointer;">
                    <input data-tm-custom-field-option-name="${index}" type="text" value="${esc(String(option?.name || '').trim())}" placeholder="选项名称" style="width:100%;min-width:0;padding:6px 8px;border:1px solid var(--tm-input-border);border-radius:8px;background:var(--tm-input-bg);color:var(--tm-text-color);${isCompact ? 'grid-column:2 / span 2;' : ''}">
                    <div style="display:flex;gap:4px;justify-content:${isCompact ? 'flex-start' : 'flex-end'};${isCompact ? 'grid-column:2;' : ''}">
                        <button type="button" class="tm-btn tm-btn-secondary" data-tm-custom-field-option-move-up="${index}" ${index === 0 ? 'disabled' : ''} style="padding:${isCompact ? '6px 10px' : '4px 8px'};font-size:12px;min-height:${isCompact ? '36px' : 'auto'};">↑</button>
                        <button type="button" class="tm-btn tm-btn-secondary" data-tm-custom-field-option-move-down="${index}" ${index === draft.options.length - 1 ? 'disabled' : ''} style="padding:${isCompact ? '6px 10px' : '4px 8px'};font-size:12px;min-height:${isCompact ? '36px' : 'auto'};">↓</button>
                    </div>
                    <button type="button" class="tm-btn tm-btn-danger" data-tm-custom-field-option-delete="${index}" style="padding:${isCompact ? '6px 10px' : '4px 8px'};font-size:12px;min-height:${isCompact ? '36px' : 'auto'};${isCompact ? 'grid-column:3;justify-self:end;' : ''}">删除</button>
                </div>
            `).join('');
            dialog.innerHTML = `
                <div style="padding:${isCompact ? '14px 14px 12px' : '16px 18px'};border-bottom:1px solid var(--tm-border-color);display:flex;align-items:${isCompact ? 'flex-start' : 'center'};justify-content:space-between;gap:${isCompact ? '8px' : '12px'};flex-wrap:${isCompact ? 'wrap' : 'nowrap'};">
                    <div style="min-width:0;">
                        <div style="font-size:18px;font-weight:700;">自定义单选 / 多选 / 文本列</div>
                        <div style="font-size:12px;color:var(--tm-secondary-text);margin-top:4px;line-height:1.5;">右击表头即可再次打开这里。自定义列会同步进入列设置、表格视图和任务详情页。</div>
                    </div>
                    <button type="button" class="tm-btn tm-btn-gray" data-tm-custom-field-close style="padding:${isCompact ? '8px 12px' : '6px 10px'};min-height:${isCompact ? '40px' : 'auto'};${isCompact ? 'margin-left:auto;' : ''}">关闭</button>
                </div>
                <div data-tm-custom-field-dialog-scroll style="display:grid;grid-template-columns:${isCompact ? '1fr' : 'minmax(180px,220px) minmax(0,1fr)'};gap:${isCompact ? '12px' : '16px'};padding:${isCompact ? '14px' : '18px'};overflow:auto;">
                    <div style="display:flex;flex-direction:column;gap:10px;">
                        <div style="font-size:12px;font-weight:600;color:var(--tm-secondary-text);">已配置自定义列</div>
                        <div style="display:${isCompact ? 'grid' : 'flex'};${isCompact ? `grid-template-columns:${isPhone ? '1fr' : 'repeat(auto-fit,minmax(132px,1fr))'};` : 'flex-direction:column;'}gap:8px;">${listHtml || '<div style="font-size:12px;color:var(--tm-secondary-text);padding:10px;border:1px dashed var(--tm-border-color);border-radius:10px;">还没有自定义列</div>'}</div>
                        <div style="display:grid;grid-template-columns:${isPhone ? '1fr' : 'repeat(3,minmax(0,1fr))'};gap:8px;">
                            <button type="button" class="tm-btn tm-btn-primary" data-tm-custom-field-new="single" style="padding:${isCompact ? '8px 12px' : '6px 10px'};font-size:12px;min-height:${isCompact ? '40px' : 'auto'};">+ 单选列</button>
                            <button type="button" class="tm-btn tm-btn-secondary" data-tm-custom-field-new="multi" style="padding:${isCompact ? '8px 12px' : '6px 10px'};font-size:12px;min-height:${isCompact ? '40px' : 'auto'};">+ 多选列</button>
                            <button type="button" class="tm-btn tm-btn-secondary" data-tm-custom-field-new="text" style="padding:${isCompact ? '8px 12px' : '6px 10px'};font-size:12px;min-height:${isCompact ? '40px' : 'auto'};">+ 文本列</button>
                        </div>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:14px;">
                        <div style="display:grid;grid-template-columns:${isCompact ? '1fr' : 'minmax(0,1fr) 120px'};gap:12px;">
                            <label style="display:flex;flex-direction:column;gap:6px;">
                                <span style="font-size:12px;color:var(--tm-secondary-text);">自定义列名称</span>
                                <input type="text" data-tm-custom-field-name value="${esc(String(draft.name || '').trim())}" placeholder="例如：负责人 / 渠道 / 标签" style="width:100%;padding:8px 10px;border:1px solid var(--tm-input-border);border-radius:10px;background:var(--tm-input-bg);color:var(--tm-text-color);">
                            </label>
                            <label style="display:flex;flex-direction:column;gap:6px;">
                                <span style="font-size:12px;color:var(--tm-secondary-text);">自定义列类型</span>
                                <select data-tm-custom-field-type style="width:100%;padding:8px 10px;border:1px solid var(--tm-input-border);border-radius:10px;background:var(--tm-input-bg);color:var(--tm-text-color);">
                                    <option value="single" ${draftType === 'single' ? 'selected' : ''}>单选</option>
                                    <option value="multi" ${draftType === 'multi' ? 'selected' : ''}>多选</option>
                                    <option value="text" ${draftType === 'text' ? 'selected' : ''}>文本</option>
                                </select>
                            </label>
                        </div>
                        <label style="display:flex;flex-direction:column;gap:6px;">
                            <span style="font-size:12px;color:var(--tm-secondary-text);">属性键名</span>
                            <input type="text" data-tm-custom-field-attr-key value="${esc(String(draft.attrKey || '').trim())}" placeholder="例如 location / owner / channel" style="width:100%;padding:8px 10px;border:1px solid var(--tm-input-border);border-radius:10px;background:var(--tm-input-bg);color:var(--tm-text-color);">
                            <span style="font-size:12px;color:var(--tm-secondary-text);">会写入思源块属性 custom-tm-属性键名。仅支持字母、数字、-；留空时会自动使用稳定的字段 ID。</span>
                        </label>
                        ${supportsOptions ? `
                            <div style="display:flex;align-items:${isCompact ? 'stretch' : 'center'};justify-content:space-between;gap:12px;flex-direction:${isCompact ? 'column' : 'row'};">
                                <div style="min-width:0;">
                                    <div style="font-size:13px;font-weight:600;">选项配置</div>
                                    <div style="font-size:12px;color:var(--tm-secondary-text);margin-top:4px;">每个选项自带默认颜色，表格、详情页和导出会复用这些颜色与名称。</div>
                                </div>
                                <button type="button" class="tm-btn tm-btn-secondary" data-tm-custom-field-add-option style="padding:${isCompact ? '8px 12px' : '6px 10px'};font-size:12px;min-height:${isCompact ? '40px' : 'auto'};${isCompact ? 'width:100%;' : ''}">+ 添加选项</button>
                            </div>
                            <div style="display:flex;flex-direction:column;gap:8px;">${optionRows || '<div style="font-size:12px;color:var(--tm-secondary-text);padding:10px;border:1px dashed var(--tm-border-color);border-radius:10px;">请至少添加一个选项</div>'}</div>
                        ` : `
                            <div style="font-size:12px;color:var(--tm-secondary-text);padding:12px;border:1px dashed var(--tm-border-color);border-radius:10px;background:var(--tm-card-bg);line-height:1.6;">
                                文本列不需要预设选项。创建后会像备注一样直接输入文本，并支持在表格、任务详情和 Excel 导出中使用。
                            </div>
                        `}
                        <div style="display:flex;align-items:${isCompact ? 'stretch' : 'center'};justify-content:space-between;gap:10px;flex-wrap:wrap;flex-direction:${isCompact ? 'column' : 'row'};border-top:1px solid var(--tm-border-color);padding-top:14px;">
                            <div style="font-size:12px;color:var(--tm-secondary-text);width:${isCompact ? '100%' : 'auto'};line-height:1.5;">${currentFieldId ? `当前编辑自定义列：${esc(String(draft.name || currentFieldId).trim() || currentFieldId)}` : '新的自定义列会自动加入列设置，可继续在外观里排序或隐藏'}</div>
                            <div style="display:${isCompact ? 'grid' : 'flex'};gap:8px;flex-wrap:wrap;width:${isCompact ? '100%' : 'auto'};${isCompact ? `grid-template-columns:${isPhone ? '1fr' : `repeat(${currentFieldId ? 3 : 2}, minmax(0,1fr))`};` : ''}">
                                ${currentFieldId ? `<button type="button" class="tm-btn tm-btn-danger" data-tm-custom-field-delete style="padding:${isCompact ? '8px 12px' : '6px 10px'};min-height:${isCompact ? '40px' : 'auto'};">删除自定义列</button>` : ''}
                                <button type="button" class="tm-btn tm-btn-secondary" data-tm-custom-field-cancel style="padding:${isCompact ? '8px 12px' : '6px 10px'};min-height:${isCompact ? '40px' : 'auto'};">取消</button>
                                <button type="button" class="tm-btn tm-btn-primary" data-tm-custom-field-save style="padding:${isCompact ? '8px 12px' : '6px 12px'};min-height:${isCompact ? '40px' : 'auto'};">保存自定义列</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            const nextScrollEl = dialog.querySelector('[data-tm-custom-field-dialog-scroll]');
            if (nextScrollEl) nextScrollEl.scrollTop = prevScrollTop;

            const readDraftFromDom = () => {
                const nameInput = dialog.querySelector('[data-tm-custom-field-name]');
                const typeSelect = dialog.querySelector('[data-tm-custom-field-type]');
                const attrKeyInput = dialog.querySelector('[data-tm-custom-field-attr-key]');
                draft.name = String(nameInput?.value || '').trim();
                draft.attrKey = String(attrKeyInput?.value || '').trim();
                const nextType = String(typeSelect?.value || 'single').trim();
                draft.type = nextType === 'multi'
                    ? 'multi'
                    : (nextType === 'text' ? 'text' : 'single');
                draft.options = (Array.isArray(draft.options) ? draft.options : []).map((option, index) => {
                    const nameEl = dialog.querySelector(`[data-tm-custom-field-option-name="${index}"]`);
                    const colorEl = dialog.querySelector(`[data-tm-custom-field-option-color="${index}"]`);
                    return {
                        ...option,
                        name: String(nameEl?.value || option?.name || '').trim(),
                        color: __tmNormalizeHexColor(colorEl?.value || option?.color || '', __tmGetCustomFieldPresetColor(index)) || __tmGetCustomFieldPresetColor(index),
                    };
                });
            };
            const saveField = async () => {
                readDraftFromDom();
                const name = String(draft.name || '').trim();
                if (!name) {
                    hint('⚠️ 自定义列名称不能为空', 'warning');
                    return;
                }
                const currentDefs = __tmGetCustomFieldDefs();
                const others = currentDefs.filter((field) => String(field?.id || '').trim() !== currentFieldId);
                let nextId = String(currentFieldId || '').trim();
                if (!nextId) {
                    const fallbackId = `field-${Date.now().toString(36)}`;
                    nextId = __tmNormalizeCustomFieldId(name, fallbackId);
                    let dedupe = 2;
                    const existingIds = new Set(others.map((field) => String(field?.id || '').trim()).filter(Boolean));
                    while (existingIds.has(nextId)) {
                        nextId = `${__tmNormalizeCustomFieldId(name, fallbackId)}-${dedupe}`;
                        dedupe += 1;
                    }
                }
                const attrKey = __tmNormalizeCustomFieldAttrName(draft.attrKey || nextId, nextId);
                if (!attrKey) {
                    hint('⚠️ 属性键名不能为空', 'warning');
                    return;
                }
                const draftType = String(draft.type || 'single').trim() === 'multi'
                    ? 'multi'
                    : (String(draft.type || '').trim() === 'text' ? 'text' : 'single');
                const optionsList = draftType === 'text'
                    ? []
                    : (Array.isArray(draft.options) ? draft.options : []).map((option, index) => ({
                        id: String(option?.id || '').trim() || `option_${index + 1}`,
                        name: String(option?.name || '').trim(),
                        color: String(option?.color || __tmGetCustomFieldPresetColor(index)).trim() || __tmGetCustomFieldPresetColor(index),
                    })).filter((option) => option.name);
                if (draftType !== 'text' && !optionsList.length) {
                    hint('⚠️ 请至少保留一个选项', 'warning');
                    return;
                }
                const duplicateAttrField = others.find((field) => __tmNormalizeCustomFieldAttrName(field?.attrKey || field?.id || field?.name || 'field', field?.id || 'field') === attrKey);
                if (duplicateAttrField) {
                    hint('⚠️ 属性键名已存在，请换一个', 'warning');
                    return;
                }
                const prevField = currentDefs.find((field) => String(field?.id || '').trim() === currentFieldId) || null;
                const prevAttrKey = __tmNormalizeCustomFieldAttrName(prevField?.attrKey || prevField?.id || prevField?.name || 'field', prevField?.id || 'field');
                const nextDefs = currentDefs.map((field) => {
                    const id = String(field?.id || '').trim();
                    if (id !== currentFieldId) return field;
                    return {
                        ...field,
                        id: nextId,
                        name,
                        attrKey,
                        type: draftType,
                        options: optionsList,
                        enabled: true,
                    };
                });
                if (!currentFieldId) {
                    nextDefs.push({
                        id: nextId,
                        name,
                        attrKey,
                        type: draftType,
                        options: optionsList,
                        enabled: true,
                    });
                }
                if (currentFieldId && prevAttrKey && prevAttrKey !== attrKey) {
                    await __tmMigrateCustomFieldAttrStorageKey(prevAttrKey, attrKey);
                }
                SettingsStore.data.customFieldDefs = nextDefs;
                SettingsStore.normalizeColumns();
                await SettingsStore.save();
                currentFieldId = nextId;
                draft = resolveDraft(__tmGetCustomFieldDefs().find((field) => String(field?.id || '').trim() === nextId) || null);
                hint('✅ 自定义列已保存', 'success');
                if (state.settingsModal) showSettings();
                render();
                renderDialog();
            };
            const deleteField = async () => {
                if (!currentFieldId) return;
                const deleted = await window.tmDeleteCustomFieldById(currentFieldId);
                if (!deleted) return;
                currentFieldId = '';
                draft = resolveDraft(null, 'single');
                renderDialog();
            };

            dialog.querySelector('[data-tm-custom-field-close]')?.addEventListener('click', close);
            dialog.querySelector('[data-tm-custom-field-cancel]')?.addEventListener('click', close);
            dialog.querySelector('[data-tm-custom-field-save]')?.addEventListener('click', () => {
                saveField().catch((e) => {
                    hint(`❌ 保存自定义列失败: ${e?.message || '未知错误'}`, 'error');
                });
            });
            dialog.querySelector('[data-tm-custom-field-delete]')?.addEventListener('click', () => { deleteField().catch(() => null); });
            dialog.querySelector('[data-tm-custom-field-add-option]')?.addEventListener('click', () => {
                readDraftFromDom();
                draft.options = [...(Array.isArray(draft.options) ? draft.options : []), {
                    id: '',
                    name: '',
                    color: __tmGetCustomFieldPresetColor(draft.options.length),
                }];
                renderDialog();
            });
            dialog.querySelector('[data-tm-custom-field-type]')?.addEventListener('change', () => {
                readDraftFromDom();
                if (draft.type !== 'text' && (!Array.isArray(draft.options) || draft.options.length === 0)) {
                    draft.options = [
                        { id: '', name: '选项1', color: __tmGetCustomFieldPresetColor(0) },
                        { id: '', name: '选项2', color: __tmGetCustomFieldPresetColor(1) },
                    ];
                }
                renderDialog();
            });
            dialog.querySelectorAll('[data-tm-custom-field-open]').forEach((button) => {
                button.addEventListener('click', () => {
                    readDraftFromDom();
                    currentFieldId = String(button.getAttribute('data-tm-custom-field-open') || '').trim();
                    draft = resolveDraft(__tmGetCustomFieldDefs().find((field) => String(field?.id || '').trim() === currentFieldId) || null);
                    renderDialog();
                });
            });
            dialog.querySelectorAll('[data-tm-custom-field-new]').forEach((button) => {
                button.addEventListener('click', () => {
                    readDraftFromDom();
                    currentFieldId = '';
                    draft = resolveDraft(null, String(button.getAttribute('data-tm-custom-field-new') || '').trim());
                    renderDialog();
                });
            });
            dialog.querySelectorAll('[data-tm-custom-field-option-delete]').forEach((button) => {
                button.addEventListener('click', () => {
                    readDraftFromDom();
                    const index = Number(button.getAttribute('data-tm-custom-field-option-delete'));
                    draft.options = (Array.isArray(draft.options) ? draft.options : []).filter((_, optionIndex) => optionIndex !== index);
                    renderDialog();
                });
            });
            dialog.querySelectorAll('[data-tm-custom-field-option-move-up]').forEach((button) => {
                button.addEventListener('click', () => {
                    readDraftFromDom();
                    const index = Number(button.getAttribute('data-tm-custom-field-option-move-up'));
                    if (index <= 0) return;
                    const nextOptions = Array.isArray(draft.options) ? draft.options.slice() : [];
                    [nextOptions[index - 1], nextOptions[index]] = [nextOptions[index], nextOptions[index - 1]];
                    draft.options = nextOptions;
                    renderDialog();
                });
            });
            dialog.querySelectorAll('[data-tm-custom-field-option-move-down]').forEach((button) => {
                button.addEventListener('click', () => {
                    readDraftFromDom();
                    const index = Number(button.getAttribute('data-tm-custom-field-option-move-down'));
                    const nextOptions = Array.isArray(draft.options) ? draft.options.slice() : [];
                    if (index < 0 || index >= nextOptions.length - 1) return;
                    [nextOptions[index + 1], nextOptions[index]] = [nextOptions[index], nextOptions[index + 1]];
                    draft.options = nextOptions;
                    renderDialog();
                });
            });
        };

        backdrop.addEventListener('click', (event) => {
            if (event.target === backdrop) close();
        });
        document.body.appendChild(backdrop);
        renderDialog();
    };

    window.tmShowColumnHeaderContextMenu = function(event, columnKey = '') {
        try {
            event?.preventDefault?.();
            event?.stopPropagation?.();
        } catch (e) {}
        const key = String(columnKey || '').trim();
        if (!key) return false;
        const existingMenu = document.getElementById('tm-column-context-menu');
        if (existingMenu) existingMenu.remove();
        if (state.columnContextMenuCloseHandler) {
            try { __tmClearOutsideCloseHandler(state.columnContextMenuCloseHandler); } catch (e) {}
            state.columnContextMenuCloseHandler = null;
        }
        const menu = document.createElement('div');
        menu.id = 'tm-column-context-menu';
        menu.style.cssText = `
            position: fixed;
            top: ${event.clientY}px;
            left: ${event.clientX}px;
            display: inline-flex;
            flex-direction: column;
            align-items: stretch;
            background: var(--b3-theme-background);
            border: 1px solid var(--b3-theme-surface-light);
            border-radius: 8px;
            box-shadow: 0 10px 28px rgba(0,0,0,0.22);
            padding: 6px 0;
            z-index: 200021;
            min-width: 180px;
            box-sizing: border-box;
        `;
        const close = () => {
            try { menu.remove(); } catch (e) {}
            if (state.columnContextMenuCloseHandler) {
                try { __tmClearOutsideCloseHandler(state.columnContextMenuCloseHandler); } catch (e) {}
                state.columnContextMenuCloseHandler = null;
            }
        };
        const createItem = (label, onClick, danger = false) => {
            const item = document.createElement('div');
            item.textContent = String(label || '');
            item.style.cssText = `padding:7px 12px;cursor:pointer;font-size:13px;color:${danger ? 'var(--b3-theme-error)' : 'var(--b3-theme-on-background)'};white-space:nowrap;`;
            item.onmouseenter = () => item.style.backgroundColor = 'var(--b3-theme-surface-light)';
            item.onmouseleave = () => item.style.backgroundColor = 'transparent';
            item.onclick = (ev) => {
                try { ev.stopPropagation(); } catch (e) {}
                close();
                onClick();
            };
            menu.appendChild(item);
        };
        const fieldId = __tmParseCustomFieldColumnKey(key);
        const field = fieldId ? __tmGetCustomFieldDefMap().get(fieldId) : null;
        createItem('新增单选列', () => window.tmOpenCustomFieldDialog('', { type: 'single' }));
        createItem('新增多选列', () => window.tmOpenCustomFieldDialog('', { type: 'multi' }));
        createItem('新增文本列', () => window.tmOpenCustomFieldDialog('', { type: 'text' }));
        createItem('管理自定义列', () => window.tmOpenCustomFieldDialog('', { manager: true }));
        if (field) {
            const divider = document.createElement('hr');
            divider.style.cssText = 'margin:4px 0;border:none;border-top:1px solid var(--b3-theme-surface-light);';
            menu.appendChild(divider);
            createItem(`编辑“${field.name}”`, () => window.tmOpenCustomFieldDialog(fieldId));
            createItem(`隐藏“${field.name}”`, () => window.toggleColumn(key, false, { refreshSettings: false }));
            createItem(`删除“${field.name}”`, () => { window.tmDeleteCustomFieldById(fieldId).catch(() => null); }, true);
        } else {
            const divider = document.createElement('hr');
            divider.style.cssText = 'margin:4px 0;border:none;border-top:1px solid var(--b3-theme-surface-light);';
            menu.appendChild(divider);
            createItem(`隐藏“${__tmResolveColumnLabel(key)}”`, () => window.toggleColumn(key, false, { refreshSettings: false }));
        }
        document.body.appendChild(menu);
        __tmClampFloatingMenuToViewport(menu, event.clientX, event.clientY, { margin: 8 });
        const closeHandler = () => close();
        state.columnContextMenuCloseHandler = closeHandler;
        __tmScheduleBindOutsideCloseHandler(closeHandler, { ignoreSelector: '#tm-column-context-menu' });
        return false;
    };

    // 更新列宽度
    window.updateColumnWidth = function(column, width) {
        if (!state.columnWidths) state.columnWidths = {};
        state.columnWidths[column] = width;
        SettingsStore.data.columnWidths = state.columnWidths;
        SettingsStore.save();
        render();
        // 更新设置界面的显示
        if (state.settingsModal) {
            const widthSettings = state.settingsModal.querySelector('.tm-width-settings');
            if (widthSettings) {
                widthSettings.innerHTML = renderColumnWidthSettings();
            }
        }
    };

    // 新增：切换分组
    window.switchDocGroup = async function(groupId) {
        try {
            await SettingsStore.updateCurrentGroupId(groupId);
            state.activeDocId = 'all';
            const currentRuleId = String(state.currentRule || SettingsStore.data.currentRule || '').trim();
            const nextRuleId = (state.filterRules || []).some((rule) => rule && rule.enabled && String(rule.id || '').trim() === currentRuleId)
                ? currentRuleId
                : '';
            state.currentRule = nextRuleId || null;
            SettingsStore.data.currentRule = nextRuleId || null;
            await SettingsStore.save();
            await loadSelectedDocuments({
                showInlineLoading: true,
                loadingStyleKind: 'topbar',
                loadingDelayMs: 0,
                source: 'legacy-switch-doc-group',
            });
            render();
            showSettings();
        } catch (e) {
            try { hint(`❌ 切换失败: ${e?.message || String(e)}`, 'error'); } catch (e2) {}
            throw e;
        }
    };

    async function __tmCreateGroupAndSelect(newGroup) {
        if (!newGroup || typeof newGroup !== 'object') return;
        const groups = SettingsStore.data.docGroups || [];
        const normalizedGroup = __tmNormalizeDocGroupConfig(newGroup, SettingsStore.data.docDefaultColorScheme);
        if (!normalizedGroup) return;
        groups.push(normalizedGroup);
        await SettingsStore.updateDocGroups(groups);
        await SettingsStore.updateCurrentGroupId(normalizedGroup.id);
        showSettings();
    };

    window.createNotebookGroup = async function() {
        await __tmRefreshNotebookCache(true);
        const notebooks = (Array.isArray(state.notebooks) ? state.notebooks : []).map((item) => ({
            value: String(item?.id || item?.box || '').trim(),
            label: String(item?.name || item?.title || '').trim() || String(item?.id || item?.box || '').trim()
        })).filter((item) => item.value);
        if (notebooks.length === 0) {
            hint('⚠ 未找到可用笔记本', 'warning');
            return;
        }
        const notebookId = await showSelectPrompt('选择笔记本', notebooks, notebooks[0].value);
        if (!notebookId) return;
        const notebookName = __tmGetNotebookDisplayName(notebookId, notebooks.find((item) => item.value === notebookId)?.label || '');
        await __tmCreateGroupAndSelect({
            id: 'g_' + Date.now(),
            name: notebookName,
            notebookId,
            docs: [],
            calendarSearchOptimization: { enabled: false, days: 90 }
        });
    };

    window.createCustomGroup = async function() {
        const name = await showPrompt('新建自定义分组', '请输入分组名称', '新分组');
        if (!name) return;
        await __tmCreateGroupAndSelect({
            id: 'g_' + Date.now(),
            name,
            docs: [],
            calendarSearchOptimization: { enabled: false, days: 90 }
        });
    };

    // 新增：删除当前分组
    window.deleteCurrentGroup = async function() {
        if (!confirm('确定要删除当前分组吗？')) return;

        const currentId = SettingsStore.data.currentGroupId;
        let groups = SettingsStore.data.docGroups || [];
        groups = groups.filter(g => g.id !== currentId);
        try {
            const pinMap = (SettingsStore.data.docPinnedByGroup && typeof SettingsStore.data.docPinnedByGroup === 'object')
                ? SettingsStore.data.docPinnedByGroup
                : {};
            if (Object.prototype.hasOwnProperty.call(pinMap, currentId)) {
                delete pinMap[currentId];
                SettingsStore.data.docPinnedByGroup = pinMap;
            }
        } catch (e) {}

        await SettingsStore.updateDocGroups(groups);
        await SettingsStore.updateCurrentGroupId('all');
        showSettings();
    };

