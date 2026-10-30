    function __tmRefreshVisibleTaskDetailsForColumnSettings(source = 'column-settings') {
        const targetIds = typeof __tmCollectVisibleTaskDetailTargetIds === 'function'
            ? __tmCollectVisibleTaskDetailTargetIds()
            : [];
        targetIds.forEach((taskId) => {
            try {
                __tmRefreshVisibleTaskDetailForTask(taskId, {
                    forceRebuild: true,
                    source,
                });
            } catch (e) {}
        });
    }

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
                hint(__tmT("settings.keepAtLeastOneColumn"), 'warning');
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
        try { SettingsStore.saveNow().catch(() => null); } catch (e) {}
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
            } catch (e) {}
            __tmRefreshVisibleTaskDetailsForColumnSettings('toggle-column');
            return;
        } else {
            try {
                await __tmCommitCustomFieldLoadPlan(prevCustomFieldPlan, nextCustomFieldPlan, {
                    hydrateVisible: true,
                });
            } catch (e) {}
        }
        render();
        __tmRefreshVisibleTaskDetailsForColumnSettings('toggle-column');
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
        __tmRefreshVisibleTaskDetailsForColumnSettings('move-column');
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

    function __tmIsLegacyWin7CompatMode() {
        try { return SettingsStore?.data?.legacyWin7CompatMode === true; } catch (e) {}
        return false;
    }

    function __tmGetCompatStatusOptionMarker(optionLike) {
        const option = (optionLike && typeof optionLike === 'object') ? optionLike : {};
        const id = String(option?.id || '').trim().toLowerCase();
        const name = String(option?.name || '').trim();
        const rawMarker = __tmNormalizeTaskStatusMarker(option?.marker, __tmGuessStatusOptionDefaultMarker(option, ' '));
        if (!__tmIsLegacyWin7CompatMode()) return rawMarker;
        if (String(rawMarker || '').trim().toUpperCase() === 'X') return 'X';
        if (id === 'done' || id === 'finish' || /完成|已完成|finish|done/i.test(name)) return 'X';
        return ' ';
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

    function __tmGetStatusOptionDeleteBlockReason(option) {
        const id = String(option?.id || '').trim();
        if (!id) return '';
        const options = SettingsStore.data.customStatusOptions || [];
        if (id === __tmResolveCheckboxLinkedStatusId(true, options)) {
            return __tmT("settings.thisStatusIsUsedAsTheStatusWhenChecked");
        }
        if (id === __tmResolveCheckboxLinkedStatusId(false, options)) {
            return __tmT("settings.thisStatusIsUsedAsTheDefaultUnfinishedStatus");
        }
        return '';
    }

    window.renderStatusOptionsList = function() {
        const options = SettingsStore.data.customStatusOptions || [];
        const compatMode = __tmIsLegacyWin7CompatMode();
        const markerInputTitle = compatMode
            ? __tmT("settings.legacySiyuanInCompatibilityModeSupportsOnlySpaceAnd")
            : __tmT("settings.spaceAndAreUnfinishedXIsFinishedAndIs2");
        const conflicts = globalThis.__tmTaskStatusRules.conflicts(options);
        const conflictIds = new Set(conflicts.flatMap((group) => group.items.map((item) => item.id)));
        const rows = [`
            <div style="display: flex; align-items: center; gap: 6px; margin: 2px 0 6px; flex-wrap: wrap; color: var(--tm-secondary-text); font-size: 12px; font-weight: 600;">
                <span style="width: 24px; min-width: 24px;"></span>
                <span style="width: 100px;">${__tmT("settings.statusName")}</span>
                <span style="width: 120px;">${__tmT("settings.attributeName")}</span>
                <span style="width: 56px; text-align: center;">${__tmT("settings.marker")}</span>
            </div>
        `];
        rows.push(...options.map((opt, index) => {
            const displayMarker = __tmGetCompatStatusOptionMarker(opt);
            const deleteBlockReason = __tmGetStatusOptionDeleteBlockReason(opt);
            return `
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;">
                <button
                    type="button"
                    data-tm-status-color-btn="${index}"
                    onclick="tmPickStatusOptionColor(${index})"
                    style="width: 24px; height: 24px; border: 1px solid var(--tm-border-color); padding: 0; background: ${esc(__tmNormalizeHexColor(opt?.color, __tmGetStatusPresetColor(index)) || __tmGetStatusPresetColor(index))}; cursor: pointer; border-radius: 6px; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18);"
                    title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.chooseAPresetPaletteOrCustomColor")}"
                ></button>
                <input type="text" value="${esc(globalThis.__taskHorizonHostBridge.i18n.builtinName('status', opt))}" onchange="updateStatusOption(${index}, 'name', this.value)" style="width: 100px; padding: 4px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px; font-size: 13px;" title="${globalThis.__taskHorizonHostBridge.i18n.html("task.rename")}">
                <input type="text" value="${esc(opt.id)}" onchange="updateStatusOption(${index}, 'id', this.value)" style="width: 120px; padding: 4px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px; font-size: 12px; font-family: monospace;" title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.changeIdUpdatesTaskStatuses")}">
                <input type="text" value="${esc(displayMarker.trim())}" onchange="updateStatusOption(${index}, 'marker', this.value)" placeholder="${globalThis.__taskHorizonHostBridge.i18n.html("task.space")}" ${compatMode ? 'disabled' : ''} style="width: 56px; padding: 4px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px; font-size: 12px; font-family: monospace; text-align: center; ${compatMode ? 'opacity:.72;cursor:not-allowed;' : ''}" title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.current2", { markerInputTitle: markerInputTitle, value2: __tmFormatStatusMarkerText(displayMarker) })}">
                <div style="display: flex; gap: 2px;">
                    <button class="tm-btn" onclick="moveStatusOption(${index}, -1)" ${index === 0 ? 'disabled' : ''} style="padding: 2px 6px; font-size: 11px;">↑</button>
                    <button class="tm-btn" onclick="moveStatusOption(${index}, 1)" ${index === options.length - 1 ? 'disabled' : ''} style="padding: 2px 6px; font-size: 11px;">↓</button>
                </div>
                ${conflictIds.has(opt.id) ? `<span style="color:var(--tm-danger-color);font-size:12px;">${__tmT("settings.duplicateMarkerExistingTasksKeepTheirOriginalStatus")}</span>` : ''}
                <button class="tm-btn tm-btn-danger" onclick="deleteStatusOption(${index})" ${deleteBlockReason ? `disabled title="${esc(deleteBlockReason)}"` : ''} style="padding: 2px 6px; font-size: 11px; ${deleteBlockReason ? 'opacity:.5;cursor:not-allowed;' : ''}">${__tmT("common.delete")}</button>
            </div>
        `; }));
        const draft = __tmGetStatusOptionDraft();
        if (draft) {
            rows.push(`
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;">
                    <button
                        type="button"
                        data-tm-status-color-btn="__draft__"
                        onclick="tmPickStatusOptionDraftColor()"
                        style="width: 24px; height: 24px; border: 1px solid var(--tm-border-color); padding: 0; background: ${esc(draft.color)}; cursor: pointer; border-radius: 6px; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18);"
                        title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.chooseAPresetPaletteOrCustomColor")}"
                    ></button>
                    <input data-tm-status-option-draft-name type="text" value="${esc(draft.name)}" oninput="updateStatusOptionDraft('name', this.value)" placeholder="${globalThis.__taskHorizonHostBridge.i18n.html("settings.statusName2")}" style="width: 100px; padding: 4px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px; font-size: 13px;" title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.enterStatusName")}">
                    <input data-tm-status-option-draft-id type="text" value="${esc(draft.id)}" oninput="updateStatusOptionDraft('id', this.value)" placeholder="${globalThis.__taskHorizonHostBridge.i18n.html("settings.customAttributeName")}" style="width: 120px; padding: 4px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px; font-size: 12px; font-family: monospace;" title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.enterAUniqueCustomAttributeName")}">
                    <input data-tm-status-option-draft-marker type="text" value="${esc(__tmGetCompatStatusOptionMarker(draft).trim())}" oninput="updateStatusOptionDraft('marker', this.value)" placeholder="${globalThis.__taskHorizonHostBridge.i18n.html("task.space")}" ${compatMode ? 'disabled' : ''} style="width: 56px; padding: 4px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px; font-size: 12px; font-family: monospace; text-align: center; ${compatMode ? 'opacity:.72;cursor:not-allowed;' : ''}" title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.current2", { markerInputTitle: markerInputTitle, value2: __tmFormatStatusMarkerText(__tmGetCompatStatusOptionMarker(draft)) })}">
                    <button class="tm-btn tm-btn-success" onclick="saveStatusOptionDraft()" style="padding: 2px 8px; font-size: 11px;">${__tmT("common.save")}</button>
                    <button class="tm-btn" onclick="cancelStatusOptionDraft()" style="padding: 2px 8px; font-size: 11px;">${__tmT("common.cancel")}</button>
                </div>
            `);
        }
        return rows.join('');
    };

    window.renderDurationOptionsList = function() {
        const options = __tmGetDurationPresetOptions();
        if (!options.length) {
            return `<div style="color: var(--tm-secondary-text); font-size: 12px;">${__tmT("settings.noDurationPresetsEditingKeepsUsingFreeFormValues")}</div>`;
        }
        const unit = globalThis.__tmDuration?.getUnit?.()
            || (String(SettingsStore?.data?.durationFormat || 'hours').trim() === 'minutes' ? 'minutes' : 'hours');
        const unitName = unit === 'minutes' ? __tmT("task.minutes") : __tmT("homepage.h2");
        const placeholder = unit === 'minutes' ? __tmT("settings.eG") : __tmT("settings.eG2");
        return options.map((value, index) => {
            const normalized = __tmNormalizeDurationPresetValue(value);
            const label = globalThis.__tmDuration?.formatPresetLabel?.(normalized, unit) || normalized;
            return `
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
                    <input type="text" data-tm-duration-option-input="${index}" value="${esc(normalized)}" onchange="updateDurationOption(${index}, this.value)" placeholder="${esc(placeholder)}" style="width: 200px; padding: 4px; border: 1px solid var(--tm-input-border); background: var(--tm-input-bg); color: var(--tm-text-color); border-radius: 4px; font-size: 12px; font-family: monospace;" title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.durationValueCurrentUnitAcceptsMH30mWithAutomatic", { unitName: unitName })}">
                    <span style="font-size:11px;color:var(--tm-secondary-text);min-width:44px;">= ${esc(label)}</span>
                    <div style="display:flex;gap:2px;">
                        <button class="tm-btn" onclick="moveDurationOption(${index}, -1)" ${index === 0 ? 'disabled' : ''} style="padding: 2px 6px; font-size: 11px;">↑</button>
                        <button class="tm-btn" onclick="moveDurationOption(${index}, 1)" ${index === options.length - 1 ? 'disabled' : ''} style="padding: 2px 6px; font-size: 11px;">↓</button>
                    </div>
                    <button class="tm-btn tm-btn-danger" onclick="deleteDurationOption(${index})" style="padding: 2px 6px; font-size: 11px;">${__tmT("common.delete")}</button>
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
        __tmOpenColorPickerDialog(__tmT("settings.statusColor"), current, async (next) => {
            await window.updateStatusOption?.(index, 'color', next);
        }, __tmBuildPresetColorPickerOptions(fallback));
    };

    window.tmPickStatusOptionDraftColor = function() {
        const draft = __tmGetStatusOptionDraft();
        if (!draft) return;
        const fallback = String(draft.color || '').trim() || __tmGetStatusPresetColor((SettingsStore.data.customStatusOptions || []).length);
        __tmOpenColorPickerDialog(__tmT("settings.statusColor"), fallback, async (next) => {
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
                    btn.title = __tmT("settings.clickToPickAPresetOrCustomColorCurrent", { value1: __tmFormatColorDisplayValue(nextColor) });
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
            hint(__tmT("settings.statusNameCannotBeEmpty"), 'warning');
            __tmFocusStatusOptionDraftInput();
            return;
        }
        if (!id) {
            hint(__tmT("settings.customAttributeNameCannotBeEmpty"), 'warning');
            __tmFocusStatusOptionDraftField('[data-tm-status-option-draft-id]');
            return;
        }
        const options = Array.isArray(SettingsStore.data.customStatusOptions) ? SettingsStore.data.customStatusOptions : [];
        if (options.some((o) => String(o?.id || '').trim() === id)) {
            hint(__tmT("settings.theCustomAttributeNameAlreadyExistsUseAnotherOne"), 'warning');
            __tmFocusStatusOptionDraftField('[data-tm-status-option-draft-id]');
            return;
        }
        const rawMarker = draft.marker == null ? '' : String(draft.marker).trim();
        const directMarker = __tmIsLegacyWin7CompatMode()
            ? __tmGetCompatStatusOptionMarker({ id, name, marker: rawMarker })
            : __tmNormalizeTaskStatusMarker(rawMarker, '');
        if (!__tmIsLegacyWin7CompatMode() && !directMarker && rawMarker !== '' && rawMarker !== ' ') {
            hint(__tmT("settings.theMarkerMustBeASingleByteCharacterAnd"), 'warning');
            __tmFocusStatusOptionDraftField('[data-tm-status-option-draft-marker]');
            return;
        }
        if (directMarker && directMarker !== ' ' && options.some((item) => __tmNormalizeTaskStatusMarker(item.marker, __tmGuessStatusOptionDefaultMarker(item)) === directMarker)) {
            hint(__tmT("settings.thisMarkerIsAlreadyUsedByAnotherStatusOnly"), 'warning');
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
        const unit = globalThis.__tmDuration?.getUnit?.()
            || (String(SettingsStore?.data?.durationFormat || 'hours').trim() === 'minutes' ? 'minutes' : 'hours');
        const unitName = unit === 'minutes' ? __tmT("task.minutes") : __tmT("homepage.h2");
        const example = unit === 'minutes' ? '30 / 60' : '0.5 / 1';
        const rawValue = await showPrompt(__tmT("settings.addDurationPreset2"), __tmT("settings.enterADurationValueCurrentUnitEGYou", { unitName: unitName, example: example }), '');
        if (rawValue == null) return;
        const value = __tmNormalizeDurationInputValue(rawValue);
        if (!value) {
            hint(__tmT("settings.durationValueCannotBeEmpty"), 'warning');
            return;
        }
        const options = __tmGetDurationPresetOptions();
        if (options.some((item) => __tmNormalizeDurationPresetValue(item).toLowerCase() === value.toLowerCase())) {
            hint(__tmT("settings.theDurationValueAlreadyExistsUseAnotherOne"), 'warning');
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
        if (!nextValue) {
            nextValue = mode === 'done'
                ? __tmGetCheckboxStatusBindingFallbackId(true, options)
                : __tmGetDefaultUndoneStatusId(options);
        }
        if (nextValue && !options.some((item) => String(item?.id || '').trim() === nextValue)) {
            hint(__tmT("settings.theStatusDoesNotExistChooseAgain"), 'warning');
            showSettings();
            return;
        }
        SettingsStore.data[key] = nextValue;
        __tmNormalizeCheckboxStatusBindingConfig(SettingsStore.data);
        await SettingsStore.save();
        showSettings();
        render();
    };

    window.updateAutoCompleteParentOnSubtasksDone = async function(enabled) {
        SettingsStore.data.autoCompleteParentOnSubtasksDone = !!enabled;
        await SettingsStore.save();
        showSettings();
    };

    window.updateStatusOption = async function(index, field, value) {
        const options = SettingsStore.data.customStatusOptions || [];
        if (!options[index]) return;

        if (field === 'id') {
            const nextId = String(value || '').trim();
            if (!nextId) {
                hint(__tmT("settings.idCannotBeEmpty"), 'warning');
                showSettings();
                return;
            }
            if (options.some((o, i) => i !== index && o.id === nextId)) {
                hint(__tmT("settings.theIdAlreadyExistsUseAnotherId"), 'warning');
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
            if (__tmIsLegacyWin7CompatMode()) {
                options[index].marker = __tmGetCompatStatusOptionMarker({ ...options[index], marker: value });
                SettingsStore.data.customStatusOptions = options;
                await SettingsStore.save();
                showSettings();
                render();
                try { window.tmQuickAddRefreshStatusSelect?.(); } catch (e) {}
                try { window.tmQuickAddRenderMeta?.(); } catch (e) {}
                return;
            }
            const rawMarker = value == null ? '' : String(value).trim();
            const directMarker = __tmNormalizeTaskStatusMarker(rawMarker, '');
            if (!directMarker && rawMarker !== '') {
                hint(__tmT("settings.theMarkerMustBeASingleByteCharacterAnd"), 'warning');
                showSettings();
                return;
            }
            const nextMarker = directMarker || ' ';
            if (nextMarker !== ' ' && nextMarker !== __tmNormalizeTaskStatusMarker(options[index].marker, ' ')
                && options.some((item, itemIndex) => itemIndex !== index && __tmNormalizeTaskStatusMarker(item.marker, __tmGuessStatusOptionDefaultMarker(item)) === nextMarker)) {
                hint(__tmT("settings.thisMarkerIsAlreadyUsedByAnotherStatusOnly"), 'warning');
                showSettings();
                return;
            }
            options[index].marker = nextMarker;
        } else {
            options[index][field] = value;
        }
        SettingsStore.data.customStatusOptions = options;
        await SettingsStore.save();
        if (field === 'color') {
            try {
                const nextColor = String(options[index]?.color || '').trim();
                const title = __tmT("settings.clickToPickAPresetOrCustomColorCurrent", { value1: __tmFormatColorDisplayValue(nextColor) });
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
        const nextValue = __tmNormalizeDurationInputValue(value);
        if (!nextValue) {
            hint(__tmT("settings.durationValueCannotBeEmpty"), 'warning');
            showSettings();
            return;
        }
        if (options.some((item, itemIndex) => itemIndex !== index && __tmNormalizeDurationPresetValue(item).toLowerCase() === nextValue.toLowerCase())) {
            hint(__tmT("settings.theDurationValueAlreadyExistsUseAnotherOne"), 'warning');
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
        const option = (SettingsStore.data.customStatusOptions || [])[index];
        if (!option) return;
        const optionId = option.id;
        let deleteBlockReason = __tmGetStatusOptionDeleteBlockReason(option);
        if (deleteBlockReason) {
            hint(deleteBlockReason, 'warning');
            return;
        }
        const ok = await showConfirm(__tmT("settings.deleteStatus"), __tmT("settings.deleteThisStatus"));
        if (!ok) return;
        const options = SettingsStore.data.customStatusOptions || [];
        const currentIndex = options.findIndex((item) => item.id === optionId);
        if (currentIndex < 0) return;
        deleteBlockReason = __tmGetStatusOptionDeleteBlockReason(options[currentIndex]);
        if (deleteBlockReason) {
            hint(deleteBlockReason, 'warning');
            return;
        }
        options.splice(currentIndex, 1);
        SettingsStore.data.customStatusOptions = options;
        __tmNormalizeCheckboxStatusBindingConfig(SettingsStore.data);
        await SettingsStore.save();
        showSettings(); // 刷新界面
        render(); // 刷新主界面
        try { window.tmQuickAddRefreshStatusSelect?.(); } catch (e) {}
        try { window.tmQuickAddRenderMeta?.(); } catch (e) {}
    };

    window.deleteDurationOption = async function(index) {
        const ok = await showConfirm(__tmT("settings.deleteDurationPreset"), __tmT("settings.deleteThisDurationPreset"));
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
        const ok = await showConfirm(__tmT("settings.deleteCustomColumn"), __tmT("settings.deleteHistoricalValuesOnExistingTasksAreNotCleaned", { value1: String(field?.name || currentFieldId).trim() || currentFieldId }));
        if (!ok) return false;
        const nextDefs = __tmGetCustomFieldDefs().filter((item) => String(item?.id || '').trim() !== currentFieldId);
        const colKey = __tmBuildCustomFieldColumnKey(currentFieldId);
        const compactKey = `customField:${currentFieldId}`;
        SettingsStore.data.customFieldDefs = nextDefs;
        SettingsStore.data.columnOrder = (Array.isArray(SettingsStore.data.columnOrder) ? SettingsStore.data.columnOrder : []).filter((key) => key !== colKey);
        SettingsStore.data.timelineColumnOrder = (Array.isArray(SettingsStore.data.timelineColumnOrder) ? SettingsStore.data.timelineColumnOrder : []).filter((key) => key !== colKey);
        SettingsStore.data.hiddenColumns = (Array.isArray(SettingsStore.data.hiddenColumns) ? SettingsStore.data.hiddenColumns : []).filter((key) => key !== colKey);
        ['desktopChecklistCompactMetaFields', 'dockChecklistCompactMetaFields', 'mobileChecklistCompactMetaFields'].forEach((settingsKey) => {
            SettingsStore.data[settingsKey] = __tmNormalizeCompactChecklistMetaFields(SettingsStore.data[settingsKey], []).filter((key) => key !== compactKey);
        });
        SettingsStore.data.quickbarInlineFields = (Array.isArray(SettingsStore.data.quickbarInlineFields) ? SettingsStore.data.quickbarInlineFields : []).filter((key) => String(key || '').trim() !== compactKey);
        SettingsStore.data.quickbarVisibleItems = (Array.isArray(SettingsStore.data.quickbarVisibleItems) ? SettingsStore.data.quickbarVisibleItems : []).filter((key) => String(key || '').trim() !== compactKey);
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
        try { globalThis.__taskHorizonQuickbarInvalidateCustomFieldScope?.(); } catch (e) {}
        hint(__tmT("settings.customColumnDeleted"), 'success');
        if (state.settingsModal) showSettings();
        render();
        return true;
    };

    window.tmClearCustomFieldSettings = async function() {
        const defs = __tmGetCustomFieldDefs();
        if (!defs.length) {
            hint(__tmT("settings.noCustomColumnSettings"), 'info');
            return false;
        }
        const ok = await showConfirm(__tmT("settings.clearCustomColumnSettings"), __tmT("settings.clearAllCustomColumnConfigurationsHistoricalValuesOnExisting"));
        if (!ok) return false;
        const colKeys = new Set(
            defs.map((field) => __tmBuildCustomFieldColumnKey(field?.id))
                .map((key) => String(key || '').trim())
                .filter(Boolean)
        );
        const compactKeys = new Set(
            defs.map((field) => `customField:${String(field?.id || '').trim()}`)
                .filter((key) => __tmParseCustomFieldColumnKey(key))
        );
        SettingsStore.data.customFieldDefs = [];
        SettingsStore.data.columnOrder = (Array.isArray(SettingsStore.data.columnOrder) ? SettingsStore.data.columnOrder : []).filter((key) => !colKeys.has(String(key || '').trim()));
        SettingsStore.data.timelineColumnOrder = (Array.isArray(SettingsStore.data.timelineColumnOrder) ? SettingsStore.data.timelineColumnOrder : []).filter((key) => !colKeys.has(String(key || '').trim()));
        SettingsStore.data.hiddenColumns = (Array.isArray(SettingsStore.data.hiddenColumns) ? SettingsStore.data.hiddenColumns : []).filter((key) => !colKeys.has(String(key || '').trim()));
        ['desktopChecklistCompactMetaFields', 'dockChecklistCompactMetaFields', 'mobileChecklistCompactMetaFields'].forEach((settingsKey) => {
            SettingsStore.data[settingsKey] = __tmNormalizeCompactChecklistMetaFields(SettingsStore.data[settingsKey], []).filter((key) => !compactKeys.has(String(key || '').trim()));
        });
        SettingsStore.data.quickbarInlineFields = (Array.isArray(SettingsStore.data.quickbarInlineFields) ? SettingsStore.data.quickbarInlineFields : []).filter((key) => !compactKeys.has(String(key || '').trim()));
        SettingsStore.data.quickbarVisibleItems = (Array.isArray(SettingsStore.data.quickbarVisibleItems) ? SettingsStore.data.quickbarVisibleItems : []).filter((key) => !compactKeys.has(String(key || '').trim()));
        if (SettingsStore.data.columnWidths && typeof SettingsStore.data.columnWidths === 'object') {
            colKeys.forEach((key) => { delete SettingsStore.data.columnWidths[key]; });
        }
        const patchRules = (rules) => {
            if (!Array.isArray(rules)) return;
            rules.forEach((rule) => {
                if (!rule || typeof rule !== 'object') return;
                if (Array.isArray(rule.conditions)) {
                    rule.conditions = rule.conditions.filter((condition) => !colKeys.has(String(condition?.field || '').trim()));
                }
                if (Array.isArray(rule.sort)) {
                    rule.sort = rule.sort.filter((sortRule) => !colKeys.has(String(sortRule?.field || '').trim()));
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
        try { globalThis.__taskHorizonQuickbarInvalidateCustomFieldScope?.(); } catch (e) {}
        hint(__tmT("settings.customColumnSettingsCleared"), 'success');
        if (state.settingsModal) showSettings();
        render();
        return true;
    };

    function __tmEnsureCustomFieldScopeDialogStyles() {
        const styleId = 'tm-custom-field-scope-dialog-styles';
        let styleEl = document.getElementById(styleId);
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            styleEl.dataset.tmStyleSource = 'custom-field-scope-dialog';
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = `
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-editor {
                border-radius: 12px;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-selection {
                display: grid;
                gap: 7px;
                padding: 9px 10px;
                border: 1px solid var(--b3-border-color, var(--tm-border-color));
                border-radius: 12px;
                background: var(--b3-theme-background, var(--tm-bg-color));
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-selection__header,
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-control__label {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                color: var(--b3-theme-on-surface-light, var(--tm-secondary-text));
                font-size: 12px;
                font-weight: 600;
                line-height: 1.4;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-selection__items {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                min-height: 30px;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-selection__empty,
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-empty,
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-help {
                color: var(--b3-theme-on-surface-light, var(--tm-secondary-text));
                font-size: 12px;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-selection__empty {
                align-self: center;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-token {
                display: inline-grid;
                grid-template-columns: auto minmax(0, 1fr) 14px;
                align-items: center;
                gap: 5px;
                max-width: min(100%, 300px);
                min-height: 30px;
                padding: 3px 7px 3px 9px;
                border: 1px solid color-mix(in srgb, var(--b3-theme-primary, var(--tm-primary-color)) 24%, var(--b3-border-color, var(--tm-border-color)));
                border-radius: 999px;
                background: color-mix(in srgb, var(--b3-theme-primary, var(--tm-primary-color)) 8%, var(--b3-theme-background, var(--tm-bg-color)));
                color: var(--b3-theme-on-surface, var(--tm-text-color));
                font: inherit;
                font-size: 12px;
                cursor: pointer;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-token:hover {
                border-color: var(--b3-theme-primary, var(--tm-primary-color));
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-token__type {
                color: var(--b3-theme-primary, var(--tm-primary-color));
                font-weight: 600;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-token__label {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-token svg {
                width: 13px;
                height: 13px;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-controls {
                display: grid;
                grid-template-columns: minmax(210px, 1.4fr) repeat(2, minmax(150px, 1fr));
                gap: 9px;
                min-width: 0;
                overflow: visible;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-control {
                position: relative;
                display: grid;
                gap: 5px;
                min-width: 0;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-search-wrap {
                position: relative;
                min-width: 0;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-search,
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-trigger {
                box-sizing: border-box;
                width: 100%;
                min-width: 0;
                height: 38px;
                border: 1px solid var(--b3-border-color, var(--tm-input-border));
                border-radius: 10px;
                background: var(--b3-theme-background, var(--tm-input-bg));
                color: var(--b3-theme-on-surface, var(--tm-text-color));
                font: inherit;
                font-size: 13px;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-search {
                padding: 0 11px;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-trigger {
                display: flex;
                align-items: center;
                justify-content: flex-start;
                gap: 8px;
                padding: 0 10px 0 11px;
                text-align: left;
                cursor: pointer;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-trigger > span {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-search:hover,
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-trigger:hover {
                border-color: color-mix(in srgb, var(--b3-theme-primary, var(--tm-primary-color)) 50%, var(--b3-border-color, var(--tm-border-color)));
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-search:focus,
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-search[aria-expanded="true"],
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-trigger[aria-expanded="true"] {
                border-color: var(--b3-theme-primary, var(--tm-primary-color));
                outline: 0;
                box-shadow: 0 0 0 2px color-mix(in srgb, var(--b3-theme-primary, var(--tm-primary-color)) 16%, transparent);
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-menu {
                position: absolute;
                z-index: 30;
                top: calc(100% + 5px);
                left: 0;
                box-sizing: border-box;
                width: 100%;
                max-height: 220px;
                overflow: auto;
                padding: 6px;
                border: 1px solid var(--b3-border-color, var(--tm-border-color));
                border-radius: 12px;
                background: var(--b3-theme-background, var(--tm-bg-color));
                box-shadow: var(--b3-dialog-shadow, 0 10px 28px rgba(0, 0, 0, 0.18));
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-control--documents .tm-custom-field-scope-menu {
                width: min(440px, calc(100vw - 48px));
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-menu[hidden] {
                display: none;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-choice {
                display: grid;
                grid-template-columns: 18px minmax(0, 1fr);
                align-items: center;
                gap: 7px;
                min-height: 34px;
                padding: 4px 7px;
                border-radius: 8px;
                color: var(--b3-theme-on-surface, var(--tm-text-color));
                font-size: 12px;
                cursor: pointer;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-choice:hover,
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-choice:has(input:checked) {
                background: var(--b3-theme-surface-light, var(--tm-hover-bg));
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-choice input {
                width: 16px;
                height: 16px;
                margin: 0;
                accent-color: var(--b3-theme-primary, var(--tm-primary-color));
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-choice__label {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-empty {
                padding: 12px 8px;
                text-align: center;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-scope-help {
                line-height: 1.5;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-option-tree {
                display: flex;
                flex-direction: column;
                min-width: 0;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-option-drop-line {
                position: relative;
                box-sizing: border-box;
                height: 8px;
                margin-left: calc(var(--tm-option-depth, 0) * 18px);
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-option-drop-line::before {
                content: '';
                position: absolute;
                inset: 3px 8px auto 8px;
                height: 2px;
                border-radius: 2px;
                background: transparent;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-option-drop-line.is-drag-over::before {
                background: var(--b3-theme-primary, var(--tm-primary-color));
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-option-row {
                display: grid;
                grid-template-columns: 30px 30px minmax(120px, 1fr) auto;
                align-items: center;
                gap: 7px;
                min-width: 0;
                min-height: 44px;
                margin-left: calc(var(--tm-option-depth, 0) * 18px);
                padding: 6px 7px;
                border: 1px solid var(--b3-border-color, var(--tm-border-color));
                border-radius: 8px;
                background: var(--b3-theme-background, var(--tm-card-bg));
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-option-row[data-depth]:not([data-depth="0"]) {
                border-left: 3px solid color-mix(in srgb, var(--b3-theme-primary, var(--tm-primary-color)) 32%, var(--b3-border-color, var(--tm-border-color)));
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-option-row.is-effectively-archived {
                opacity: 0.68;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-option-row.is-drag-over {
                border-color: var(--b3-theme-primary, var(--tm-primary-color));
                background: color-mix(in srgb, var(--b3-theme-primary, var(--tm-primary-color)) 7%, var(--b3-theme-background, var(--tm-card-bg)));
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-option-drag,
            #tm-custom-field-dialog-backdrop .tm-custom-field-option-action {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                box-sizing: border-box;
                width: 30px;
                height: 30px;
                padding: 0;
                border: 1px solid transparent;
                border-radius: 6px;
                background: transparent;
                color: var(--b3-theme-on-surface-light, var(--tm-secondary-text));
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-option-drag {
                cursor: grab;
                touch-action: none;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-option-drag:active {
                cursor: grabbing;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-option-action:not(:disabled) {
                cursor: pointer;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-option-action:not(:disabled):hover,
            #tm-custom-field-dialog-backdrop .tm-custom-field-option-drag:hover {
                border-color: var(--b3-border-color, var(--tm-border-color));
                background: var(--b3-theme-surface-light, var(--tm-hover-bg));
                color: var(--b3-theme-on-surface, var(--tm-text-color));
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-option-action:disabled,
            #tm-custom-field-dialog-backdrop .tm-custom-field-option-drag[aria-disabled="true"] {
                opacity: 0.34;
                cursor: default;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-option-drag svg,
            #tm-custom-field-dialog-backdrop .tm-custom-field-option-action svg {
                width: 15px;
                height: 15px;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-option-name-wrap {
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                align-items: center;
                gap: 6px;
                min-width: 0;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-option-name {
                box-sizing: border-box;
                width: 100%;
                min-width: 0;
                height: 32px;
                padding: 5px 8px;
                border: 1px solid var(--b3-border-color, var(--tm-input-border));
                border-radius: 7px;
                background: var(--b3-theme-background, var(--tm-input-bg));
                color: var(--b3-theme-on-surface, var(--tm-text-color));
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-option-badge {
                flex: none;
                color: var(--b3-theme-on-surface-light, var(--tm-secondary-text));
                font-size: 11px;
                white-space: nowrap;
            }
            #tm-custom-field-dialog-backdrop .tm-custom-field-option-actions {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 2px;
            }
            @media (max-width: 720px) {
                #tm-custom-field-dialog-backdrop .tm-custom-field-scope-controls {
                    grid-template-columns: 1fr;
                }
                #tm-custom-field-dialog-backdrop .tm-custom-field-scope-menu,
                #tm-custom-field-dialog-backdrop .tm-custom-field-scope-control--documents .tm-custom-field-scope-menu {
                    position: relative;
                    top: 0;
                    width: 100%;
                    margin-top: 1px;
                }
                #tm-custom-field-dialog-backdrop .tm-custom-field-scope-token {
                    max-width: 100%;
                }
                #tm-custom-field-dialog-backdrop .tm-custom-field-option-row {
                    grid-template-columns: 30px 30px minmax(0, 1fr);
                    margin-left: calc(var(--tm-option-depth, 0) * 12px);
                    padding: 7px;
                }
                #tm-custom-field-dialog-backdrop .tm-custom-field-option-drop-line {
                    margin-left: calc(var(--tm-option-depth, 0) * 12px);
                }
                #tm-custom-field-dialog-backdrop .tm-custom-field-option-actions {
                    grid-column: 2 / 4;
                    justify-content: flex-start;
                    flex-wrap: wrap;
                }
                #tm-custom-field-dialog-backdrop .tm-custom-field-option-action {
                    width: 36px;
                    height: 36px;
                }
            }
        `;
    }

    function __tmBuildCustomFieldScopeDocumentData(documents, taskTree, displayNameMode) {
        const docs = Array.isArray(documents) ? documents : [];
        const metaById = new Map();
        [Array.isArray(taskTree) ? taskTree : [], docs].forEach((items) => {
            items.forEach((doc) => {
                const id = String(doc?.id || '').trim();
                if (id && !metaById.has(id)) metaById.set(id, doc);
            });
        });
        const labeledDocs = docs.map((doc) => {
            const id = String(doc?.id || '').trim();
            const fallbackDoc = metaById.get(id);
            const name = String(doc?.name || fallbackDoc?.name || '').trim()
                || String(doc?.name || __tmT("kernel.untitledDocument")).trim() || __tmT("kernel.untitledDocument");
            const alias = __tmNormalizeDocAliasValue(doc?.alias || fallbackDoc?.alias);
            return { doc, id, label: displayNameMode === 'alias' ? alias || name : name };
        });
        labeledDocs.sort((a, b) => a.label.localeCompare(b.label, 'zh-Hans-CN'));
        return {
            documents: labeledDocs.map((entry) => entry.doc),
            labels: new Map(labeledDocs.filter((entry) => entry.id).map((entry) => [entry.id, entry.label])),
        };
    }

    function __tmBuildCustomFieldOptionRenderMetrics(runtime) {
        const siblingIndexById = new Map();
        const subtreeHeightById = new Map();
        runtime.childrenByParentId.forEach((children) => {
            children.forEach((option, index) => siblingIndexById.set(String(option?.id || '').trim(), index));
        });
        for (let index = runtime.options.length - 1; index >= 0; index -= 1) {
            const option = runtime.options[index];
            const id = String(option?.id || '').trim();
            const parentId = String(option?.parentId || '').trim();
            const height = subtreeHeightById.get(id) || 0;
            subtreeHeightById.set(id, height);
            if (parentId) {
                subtreeHeightById.set(parentId, Math.max(subtreeHeightById.get(parentId) || 0, height + 1));
            }
        }
        return { siblingIndexById, subtreeHeightById };
    }

    window.tmOpenCustomFieldDialog = async function(fieldId = '', options = {}) {
        __tmRemoveElementsById('tm-custom-field-dialog-backdrop');
        __tmEnsureCustomFieldScopeDialogStyles();
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
        let scopeDocSearch = '';
        let openScopePicker = '';
        let draggedOptionId = '';
        let scopeDocumentData = null;
        let scopeDocumentsLoading = false;
        let scopeDocumentsFailed = false;
        let scopeDocumentsLoadTimer = null;
        let refreshScopeDocumentUi = null;

        const createDraftOptionId = () => {
            const existingIds = new Set((Array.isArray(draft.options) ? draft.options : [])
                .map((option) => String(option?.id || '').trim())
                .filter(Boolean));
            const base = `option-${Date.now().toString(36)}`;
            let id = base;
            let suffix = 2;
            while (existingIds.has(id)) {
                id = `${base}-${suffix}`;
                suffix += 1;
            }
            return id;
        };

        const backdrop = document.createElement('div');
        backdrop.id = 'tm-custom-field-dialog-backdrop';
        backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:200050;display:flex;align-items:center;justify-content:center;padding:24px;';

        const dialog = document.createElement('div');
        dialog.style.cssText = 'width:min(860px,96vw);max-height:min(88vh,860px);background:var(--tm-bg-color);color:var(--tm-text-color);border:1px solid var(--tm-border-color);border-radius:16px;box-shadow:0 18px 48px rgba(0,0,0,0.2);display:flex;flex-direction:column;overflow:hidden;';
        backdrop.appendChild(dialog);

        const close = () => {
            if (scopeDocumentsLoadTimer !== null) clearTimeout(scopeDocumentsLoadTimer);
            try { backdrop.remove(); } catch (e) {}
        };

        const loadScopeDocuments = () => {
            if (scopeDocumentData || scopeDocumentsLoading || !backdrop.isConnected) return;
            scopeDocumentsLoading = true;
            scopeDocumentsFailed = false;
            scopeDocumentsLoadTimer = setTimeout(async () => {
                scopeDocumentsLoadTimer = null;
                if (!backdrop.isConnected) return;
                try {
                    if ((!Array.isArray(state.allDocuments) || !state.allDocuments.length) && typeof __tmEnsureAllDocumentsLoaded === 'function') {
                        await __tmEnsureAllDocumentsLoaded(false);
                    }
                    if (!backdrop.isConnected) return;
                    scopeDocumentData = __tmBuildCustomFieldScopeDocumentData(state.allDocuments, state.taskTree, __tmGetDocDisplayNameMode());
                } catch (e) {
                    scopeDocumentsFailed = true;
                } finally {
                    scopeDocumentsLoading = false;
                    if (backdrop.isConnected) refreshScopeDocumentUi?.();
                }
            }, 0);
        };

        const renderDialog = () => {
            const prevScrollEl = dialog.querySelector('[data-tm-custom-field-dialog-scroll]');
            const prevScrollTop = prevScrollEl ? prevScrollEl.scrollTop : 0;
            const prevScopeListScrollTops = new Map(Array.from(dialog.querySelectorAll('[data-tm-custom-field-scope-list]'))
                .map((list) => [String(list.getAttribute('data-tm-custom-field-scope-list') || ''), Number(list.scrollTop) || 0]));
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
            const draftScope = __tmNormalizeCustomFieldScope(draft.scope);
            const scopeMode = draftScope ? 'selected' : 'global';
            const selectedScope = draftScope || { docIds: [], docGroupIds: [], docTabGroupIds: [] };
            const buildScopeChoices = (items, selectedIds, resolveLabel, kind, emptyLabel) => {
                const selected = new Set(Array.isArray(selectedIds) ? selectedIds : []);
                const dataAttr = kind === 'doc'
                    ? 'data-tm-custom-field-scope-docs'
                    : (kind === 'docGroup' ? 'data-tm-custom-field-scope-doc-groups' : 'data-tm-custom-field-scope-tab-groups');
                const choices = (Array.isArray(items) ? items : []).map((item) => {
                    const id = String(item?.id || '').trim();
                    if (!id) return '';
                    const label = String(resolveLabel(item) || id).trim() || id;
                    return `
                        <label class="tm-custom-field-scope-choice" data-tm-custom-field-scope-choice="${kind}">
                            <input type="checkbox" ${dataAttr} value="${esc(id)}" ${selected.has(id) ? 'checked' : ''}>
                            <span class="tm-custom-field-scope-choice__label" title="${esc(label)}">${esc(label)}</span>
                        </label>
                    `;
                }).filter(Boolean);
                return choices.join('') || `<div class="tm-custom-field-scope-empty">${esc(emptyLabel)}</div>`;
            };
            let availableDocs = scopeDocumentData?.documents || [];
            const availableDocGroups = Array.isArray(SettingsStore?.data?.docGroups) ? SettingsStore.data.docGroups : [];
            const availableDocTabGroups = typeof __tmGetDocTabCustomGroups === 'function' ? __tmGetDocTabCustomGroups() : [];
            const resolveDocScopeLabel = (doc) => scopeDocumentData?.labels.get(String(doc?.id || '').trim()) || doc?.name || __tmT("kernel.untitledDocument");
            const resolveDocGroupScopeLabel = (group) => group?.name || __tmT("kernel.untitledDocumentGroup");
            const resolveDocTabGroupScopeLabel = (group) => group?.name || __tmT("task.untitledTabGroup");
            const resolveDocScopeSearchResults = (queryInput) => {
                const query = String(queryInput || '').trim().toLocaleLowerCase();
                if (!query) return { matches: [], shown: [] };
                const matches = availableDocs.filter((doc) => String(resolveDocScopeLabel(doc) || '').toLocaleLowerCase().includes(query));
                return { matches, shown: matches.slice(0, 60) };
            };
            const initialDocSearchResults = resolveDocScopeSearchResults(scopeDocSearch);
            const docScopePendingHtml = `<div class="tm-custom-field-scope-empty">${__tmT("task.loadingDocuments2")}</div>`;
            const docScopeChoices = scopeDocSearch
                ? (scopeDocumentData ? buildScopeChoices(initialDocSearchResults.shown, selectedScope.docIds, resolveDocScopeLabel, 'doc', __tmT("settings.noMatchingDocumentsFound")) : docScopePendingHtml)
                : '';
            const docGroupScopeChoices = buildScopeChoices(availableDocGroups, selectedScope.docGroupIds, resolveDocGroupScopeLabel, 'docGroup', __tmT("settings.noDocumentGroupsAvailable"));
            const docTabGroupScopeChoices = buildScopeChoices(availableDocTabGroups, selectedScope.docTabGroupIds, resolveDocTabGroupScopeLabel, 'tabGroup', __tmT("settings.noTabGroupsAvailable"));
            const buildScopeLabelMap = (items, resolveLabel) => new Map((Array.isArray(items) ? items : [])
                .map((item) => {
                    const id = String(item?.id || '').trim();
                    return id ? [id, String(resolveLabel(item) || id).trim() || id] : null;
                })
                .filter(Boolean));
            const docScopeLabelMap = scopeDocumentData?.labels || new Map();
            const docGroupScopeLabelMap = buildScopeLabelMap(availableDocGroups, resolveDocGroupScopeLabel);
            const docTabGroupScopeLabelMap = buildScopeLabelMap(availableDocTabGroups, resolveDocTabGroupScopeLabel);
            const selectedScopeItems = [
                ...selectedScope.docIds.map((id) => ({ kind: 'doc', type: __tmT("kernel.documents"), id, label: docScopeLabelMap.get(id) || (scopeDocumentData ? __tmT("settings.invalid", { id: id }) : id) })),
                ...selectedScope.docGroupIds.map((id) => ({ kind: 'docGroup', type: __tmT("calendar.documentGroups"), id, label: docGroupScopeLabelMap.get(id) || __tmT("settings.invalid", { id: id }) })),
                ...selectedScope.docTabGroupIds.map((id) => ({ kind: 'tabGroup', type: __tmT("task.tabGroups2"), id, label: docTabGroupScopeLabelMap.get(id) || __tmT("settings.invalid", { id: id }) })),
            ];
            const selectedScopeSummaryHtml = selectedScopeItems.length
                ? selectedScopeItems.map((item) => `
                    <button type="button" class="tm-custom-field-scope-token" data-tm-custom-field-scope-remove="${item.kind}" data-tm-scope-id="${esc(item.id)}" title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.remove", { type: item.type, label: item.label })}">
                        <span class="tm-custom-field-scope-token__type">${esc(item.type)}</span>
                        <span class="tm-custom-field-scope-token__label">${esc(item.label)}</span>
                        ${__tmRenderLucideIcon('x')}
                    </button>
                `).join('')
                : `<span class="tm-custom-field-scope-selection__empty">${__tmT("settings.noScopeSelectedYet")}</span>`;
            const listHtml = defsNow.map((field) => {
                const id = String(field?.id || '').trim();
                const active = id && id === currentFieldId;
                const fieldType = String(field?.type || '').trim();
                const fieldTypeLabel = fieldType === 'multi'
                    ? __tmT("task.multiSelect")
                    : (fieldType === 'text' ? __tmT("task.text") : __tmT("task.singleSelect"));
                const fieldScope = __tmNormalizeCustomFieldScope(field?.scope);
                const fieldScopeLabel = fieldScope ? __tmT("settings.specificScope") : __tmT("task.allDocuments");
                return `
                    <button type="button" data-tm-custom-field-open="${esc(id)}" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border:1px solid ${active ? 'var(--tm-primary-color)' : 'var(--tm-border-color)'};border-radius:10px;background:${active ? 'var(--tm-hover-bg)' : 'var(--tm-card-bg)'};color:var(--tm-text-color);cursor:pointer;text-align:left;">
                        <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(String(field?.name || id || __tmT("settings.untitledCustomColumn")).trim() || __tmT("settings.untitledCustomColumn"))}</span>
                        <span style="font-size:11px;color:var(--tm-secondary-text);flex:none;">${fieldTypeLabel} · ${fieldScopeLabel}</span>
                    </button>
                `;
            }).join('');
            const optionRuntime = __tmBuildCustomFieldOptionRuntime(draft);
            const optionMetrics = __tmBuildCustomFieldOptionRenderMetrics(optionRuntime);
            draft.options = optionRuntime.options.map((option) => ({ ...option }));
            const supportsDesktopDrag = !__tmIsMobileDevice();
            const renderOptionAction = (optionId, action, icon, title, disabled = false) => `
                <button type="button" class="tm-custom-field-option-action" data-tm-custom-field-option-action="${action}" data-option-id="${esc(optionId)}" title="${esc(title)}" aria-label="${esc(title)}" ${disabled ? 'disabled' : ''}>
                    ${__tmRenderLucideIcon(icon)}
                </button>
            `;
            const renderDropLine = (parentId, siblingIndex, depth) => `
                <div class="tm-custom-field-option-drop-line" style="--tm-option-depth:${depth};" data-tm-custom-field-option-drop-line data-target-parent-id="${esc(parentId)}" data-target-sibling-index="${siblingIndex}" aria-hidden="true"></div>
            `;
            const renderOptionNode = (option) => {
                const optionId = String(option?.id || '').trim();
                const parentId = String(option?.parentId || '').trim();
                const depth = Number(optionRuntime.depthById.get(optionId) || 0);
                const siblings = optionRuntime.childrenByParentId.get(parentId) || [];
                const siblingIndex = optionMetrics.siblingIndexById.get(optionId) ?? -1;
                const previousSibling = siblingIndex > 0 ? siblings[siblingIndex - 1] : null;
                const previousSiblingId = String(previousSibling?.id || '').trim();
                const canIndent = !!previousSiblingId
                    && depth + 1 + (optionMetrics.subtreeHeightById.get(optionId) || 0) < __TM_CUSTOM_FIELD_OPTION_MAX_DEPTH;
                const parentSiblingIndex = optionMetrics.siblingIndexById.get(parentId) ?? -1;
                const children = optionRuntime.childrenByParentId.get(optionId) || [];
                const directlyArchived = option?.archived === true;
                const effectivelyArchived = optionRuntime.effectiveArchivedById.get(optionId) === true;
                const archiveLabel = directlyArchived ? __tmT("settings.unarchive") : __tmT("settings.archiveOption");
                const stateLabel = directlyArchived
                    ? __tmT("settings.archived")
                    : (effectivelyArchived ? __tmT("settings.archiveWithParent") : __tmT("settings.level", { value1: depth + 1 }));
                const childHtml = children.map((child, index) => `${renderDropLine(optionId, index, depth + 1)}${renderOptionNode(child)}`).join('');
                return `
                    <div class="tm-custom-field-option-row${effectivelyArchived ? ' is-effectively-archived' : ''}" style="--tm-option-depth:${depth};" data-depth="${depth}" data-option-id="${esc(optionId)}" data-tm-custom-field-option-child-drop data-target-parent-id="${esc(optionId)}" data-target-sibling-index="${children.length}">
                        <button type="button" class="tm-custom-field-option-drag" data-tm-custom-field-option-drag data-option-id="${esc(optionId)}" draggable="${supportsDesktopDrag ? 'true' : 'false'}" aria-disabled="${supportsDesktopDrag ? 'false' : 'true'}" title="${supportsDesktopDrag ? __tmT("settings.dragToMoveOption") : __tmT("settings.onMobileUseTheMoveButtonsOnTheRight")}" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.dragToMoveOption")}">
                            ${__tmRenderLucideIcon('menu')}
                        </button>
                        <input data-tm-custom-field-option-color data-option-id="${esc(optionId)}" type="color" value="${esc(String(option?.color || __tmGetCustomFieldPresetColor(siblingIndex)).trim() || __tmGetCustomFieldPresetColor(siblingIndex))}" title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.optionscolor")}" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.optionscolor")}" style="width:28px;height:28px;border:none;padding:0;background:none;cursor:pointer;">
                        <div class="tm-custom-field-option-name-wrap">
                            <input class="tm-custom-field-option-name" data-tm-custom-field-option-name data-option-id="${esc(optionId)}" type="text" value="${esc(String(option?.name || '').trim())}" placeholder="${globalThis.__taskHorizonHostBridge.i18n.html("settings.optionsname")}">
                            <span class="tm-custom-field-option-badge">${stateLabel}</span>
                        </div>
                        <div class="tm-custom-field-option-actions">
                            ${renderOptionAction(optionId, 'up', 'arrow-up', __tmT("settings.moveUpSameLevel"), siblingIndex <= 0)}
                            ${renderOptionAction(optionId, 'down', 'arrow-down', __tmT("settings.moveDownSameLevel"), siblingIndex < 0 || siblingIndex >= siblings.length - 1)}
                            ${renderOptionAction(optionId, 'indent', 'text-indent', __tmT("settings.indentAsAChildOfThePreviousSiblingOption"), !canIndent)}
                            ${renderOptionAction(optionId, 'promote', 'text-outdent', __tmT("settings.outdentByOneLevel"), !parentId || parentSiblingIndex < 0)}
                            ${renderOptionAction(optionId, 'archive', 'archive', archiveLabel)}
                            ${renderOptionAction(optionId, 'delete', 'trash-2', children.length ? __tmT("settings.cannotDeleteWhileItHasChildOptions") : __tmT("settings.deleteOption"), children.length > 0)}
                        </div>
                    </div>
                    ${childHtml}
                    ${children.length ? renderDropLine(optionId, children.length, depth + 1) : ''}
                `;
            };
            const rootOptions = optionRuntime.childrenByParentId.get('') || [];
            const optionTreeHtml = rootOptions.map((option, index) => `${renderDropLine('', index, 0)}${renderOptionNode(option)}`).join('')
                + renderDropLine('', rootOptions.length, 0);
            dialog.innerHTML = `
                <div style="padding:${isCompact ? '14px 14px 12px' : '16px 18px'};border-bottom:1px solid var(--tm-border-color);display:flex;align-items:${isCompact ? 'flex-start' : 'center'};justify-content:space-between;gap:${isCompact ? '8px' : '12px'};flex-wrap:${isCompact ? 'wrap' : 'nowrap'};">
                    <div style="min-width:0;">
                        <div style="font-size:18px;font-weight:700;">${__tmT("settings.customSingleSelectMultiSelectTextColumns")}</div>
                        <div style="font-size:12px;color:var(--tm-secondary-text);margin-top:4px;line-height:1.5;">${__tmT("settings.rightClickATableHeaderToOpenThisAgain")}</div>
                    </div>
                    <button type="button" class="tm-btn tm-btn-gray" data-tm-custom-field-close style="padding:${isCompact ? '8px 12px' : '6px 10px'};min-height:${isCompact ? '40px' : 'auto'};${isCompact ? 'margin-left:auto;' : ''}">${__tmT("common.close")}</button>
                </div>
                <div data-tm-custom-field-dialog-scroll style="display:grid;grid-template-columns:${isCompact ? '1fr' : 'minmax(180px,220px) minmax(0,1fr)'};gap:${isCompact ? '12px' : '16px'};padding:${isCompact ? '14px' : '18px'};overflow:auto;">
                    <div style="display:flex;flex-direction:column;gap:10px;">
                        <div style="font-size:12px;font-weight:600;color:var(--tm-secondary-text);">${__tmT("settings.configuredCustomColumns")}</div>
                        <div style="display:${isCompact ? 'grid' : 'flex'};${isCompact ? `grid-template-columns:${isPhone ? '1fr' : 'repeat(auto-fit,minmax(132px,1fr))'};` : 'flex-direction:column;'}gap:8px;">${listHtml || `<div style="font-size:12px;color:var(--tm-secondary-text);padding:10px;border:1px dashed var(--tm-border-color);border-radius:10px;">${__tmT("settings.noCustomColumnsYet")}</div>`}</div>
                        <div style="display:grid;grid-template-columns:1fr;gap:8px;">
                            <button type="button" class="tm-btn tm-btn-primary" data-tm-custom-field-new style="padding:${isCompact ? '8px 12px' : '6px 10px'};font-size:12px;min-height:${isCompact ? '40px' : 'auto'};">${__tmT("settings.newCustomColumn")}</button>
                        </div>
                        ${defsNow.length ? `<button type="button" class="tm-btn tm-btn-danger" data-tm-custom-field-clear-all style="padding:${isCompact ? '8px 12px' : '6px 10px'};font-size:12px;min-height:${isCompact ? '40px' : 'auto'};">${__tmT("settings.clearCustomColumnSettings")}</button>` : ''}
                    </div>
                    <div style="display:flex;flex-direction:column;gap:14px;">
                        <div style="display:grid;grid-template-columns:${isCompact ? '1fr' : 'minmax(0,1fr) 120px'};gap:12px;">
                            <label style="display:flex;flex-direction:column;gap:6px;min-width:0;">
                                <span style="font-size:12px;color:var(--tm-secondary-text);">${__tmT("settings.customColumnName")}</span>
                                <input type="text" data-tm-custom-field-name value="${esc(String(draft.name || '').trim())}" placeholder="${globalThis.__taskHorizonHostBridge.i18n.html("settings.forExampleOwnerChannelTags")}" style="box-sizing:border-box;width:100%;min-width:0;padding:8px 10px;border:1px solid var(--tm-input-border);border-radius:10px;background:var(--tm-input-bg);color:var(--tm-text-color);">
                            </label>
                            <label style="display:flex;flex-direction:column;gap:6px;min-width:0;">
                                <span style="font-size:12px;color:var(--tm-secondary-text);">${__tmT("settings.customColumnType")}</span>
                                <select data-tm-custom-field-type style="box-sizing:border-box;width:100%;min-width:0;padding:8px 10px;border:1px solid var(--tm-input-border);border-radius:10px;background:var(--tm-input-bg);color:var(--tm-text-color);">
                                    <option value="single" ${draftType === 'single' ? 'selected' : ''}>${__tmT("task.singleSelect")}</option>
                                    <option value="multi" ${draftType === 'multi' ? 'selected' : ''}>${__tmT("task.multiSelect")}</option>
                                    <option value="text" ${draftType === 'text' ? 'selected' : ''}>${__tmT("task.text")}</option>
                                </select>
                            </label>
                        </div>
                        <label style="display:flex;flex-direction:column;gap:6px;">
                            <span style="font-size:12px;color:var(--tm-secondary-text);">${__tmT("settings.attributeKey")}</span>
                            <input type="text" data-tm-custom-field-attr-key value="${esc(String(draft.attrKey || '').trim())}" placeholder="${globalThis.__taskHorizonHostBridge.i18n.html("settings.forExampleLocationOwnerChannel")}" style="width:100%;padding:8px 10px;border:1px solid var(--tm-input-border);border-radius:10px;background:var(--tm-input-bg);color:var(--tm-text-color);">
                            <span style="font-size:12px;color:var(--tm-secondary-text);">${__tmT("settings.writtenToTheSiyuanBlockAttributeCustomTmKey")}</span>
                        </label>
                        <div style="display:flex;flex-direction:column;gap:10px;padding:12px;border:1px solid var(--tm-border-color);border-radius:10px;background:var(--tm-card-bg);">
                            <label style="display:flex;flex-direction:column;gap:6px;">
                                <span style="font-size:12px;color:var(--tm-secondary-text);">${__tmT("settings.scope")}</span>
                                <select data-tm-custom-field-scope-mode style="width:100%;padding:8px 10px;border:1px solid var(--tm-input-border);border-radius:8px;background:var(--tm-input-bg);color:var(--tm-text-color);">
                                    <option value="global" ${scopeMode === 'global' ? 'selected' : ''}>${__tmT("task.allDocuments")}</option>
                                    <option value="selected" ${scopeMode === 'selected' ? 'selected' : ''}>${__tmT("settings.specifiedDocumentsDocumentGroupsOrTabGroups")}</option>
                                </select>
                            </label>
                            ${scopeMode === 'selected' ? `
                                <div class="tm-custom-field-scope-selection">
                                    <div class="tm-custom-field-scope-selection__header">
                                        <span>${__tmT("settings.selectedScope")}</span>
                                        <span>${__tmT("settings.items", { length: selectedScopeItems.length })}</span>
                                    </div>
                                    <div class="tm-custom-field-scope-selection__items">${selectedScopeSummaryHtml}</div>
                                </div>
                                <div class="tm-custom-field-scope-controls">
                                    <div class="tm-custom-field-scope-control tm-custom-field-scope-control--documents" data-tm-custom-field-scope-control="doc">
                                        <div class="tm-custom-field-scope-control__label"><span>${__tmT("kernel.documents")}</span></div>
                                        <div class="tm-custom-field-scope-search-wrap">
                                            <input class="tm-custom-field-scope-search" type="search" data-tm-custom-field-scope-doc-search value="${esc(scopeDocSearch)}" placeholder="${globalThis.__taskHorizonHostBridge.i18n.html("settings.searchAndSelectDocuments")}" autocomplete="off" aria-expanded="${openScopePicker === 'doc' ? 'true' : 'false'}">
                                        </div>
                                        <div class="tm-custom-field-scope-help" data-tm-custom-field-scope-doc-status role="status" ${scopeDocumentData ? 'hidden' : ''}>${__tmT("task.loadingDocuments2")}</div>
                                        <div class="tm-custom-field-scope-menu" data-tm-custom-field-scope-list="doc" data-tm-custom-field-scope-doc-list ${openScopePicker === 'doc' ? '' : 'hidden'}>${scopeDocSearch ? docScopeChoices : `<div class="tm-custom-field-scope-empty">${__tmT("settings.typeADocumentNameToSearch")}</div>`}</div>
                                    </div>
                                    <div class="tm-custom-field-scope-control" data-tm-custom-field-scope-control="docGroup">
                                        <div class="tm-custom-field-scope-control__label"><span>${__tmT("calendar.documentGroups")}</span><span>${availableDocGroups.length}</span></div>
                                        <button type="button" class="tm-custom-field-scope-trigger" data-tm-custom-field-scope-trigger="docGroup" aria-expanded="${openScopePicker === 'docGroup' ? 'true' : 'false'}">
                                            <span>${selectedScope.docGroupIds.length ? __tmT("settings.selected4", { length: selectedScope.docGroupIds.length }) : __tmT("task.selectADocumentGroup")}</span>
                                        </button>
                                        <div class="tm-custom-field-scope-menu" data-tm-custom-field-scope-list="docGroup" ${openScopePicker === 'docGroup' ? '' : 'hidden'}>${docGroupScopeChoices}</div>
                                    </div>
                                    <div class="tm-custom-field-scope-control" data-tm-custom-field-scope-control="tabGroup">
                                        <div class="tm-custom-field-scope-control__label"><span>${__tmT("task.tabGroups2")}</span><span>${availableDocTabGroups.length}</span></div>
                                        <button type="button" class="tm-custom-field-scope-trigger" data-tm-custom-field-scope-trigger="tabGroup" aria-expanded="${openScopePicker === 'tabGroup' ? 'true' : 'false'}">
                                            <span>${selectedScope.docTabGroupIds.length ? __tmT("settings.selected4", { length: selectedScope.docTabGroupIds.length }) : __tmT("settings.selectTabGroup")}</span>
                                        </button>
                                        <div class="tm-custom-field-scope-menu" data-tm-custom-field-scope-list="tabGroup" ${openScopePicker === 'tabGroup' ? '' : 'hidden'}>${docTabGroupScopeChoices}</div>
                                    </div>
                                </div>
                                <span class="tm-custom-field-scope-help">${__tmT("settings.theThreeScopesApplyAsAUnion")}</span>
                            ` : ''}
                        </div>
                        ${supportsOptions ? `
                            <div style="display:flex;align-items:${isCompact ? 'stretch' : 'center'};justify-content:space-between;gap:12px;flex-direction:${isCompact ? 'column' : 'row'};">
                                <div style="min-width:0;">
                                    <div style="font-size:13px;font-weight:600;">${__tmT("settings.optionConfiguration")}</div>
                                    <div style="font-size:12px;color:var(--tm-secondary-text);margin-top:4px;">${__tmT("settings.upToThreeLevelsDragOnDesktopOnMobile")}</div>
                                </div>
                                <button type="button" class="tm-btn tm-btn-secondary" data-tm-custom-field-add-option style="padding:${isCompact ? '8px 12px' : '6px 10px'};font-size:12px;min-height:${isCompact ? '40px' : 'auto'};${isCompact ? 'width:100%;' : ''}">${__tmT("settings.addOption")}</button>
                            </div>
                            <div class="tm-custom-field-option-tree">${draft.options.length ? optionTreeHtml : `<div style="font-size:12px;color:var(--tm-secondary-text);padding:10px;border:1px dashed var(--tm-border-color);border-radius:8px;">${__tmT("settings.addAtLeastOneOption")}</div>`}</div>
                        ` : `
                            <div style="font-size:12px;color:var(--tm-secondary-text);padding:12px;border:1px dashed var(--tm-border-color);border-radius:10px;background:var(--tm-card-bg);line-height:1.6;">${__tmT("settings.textColumnsNeedNoPresetOptionsAfterCreationThey")}</div>
                        `}
                        <div style="display:flex;align-items:${isCompact ? 'stretch' : 'center'};justify-content:space-between;gap:10px;flex-wrap:wrap;flex-direction:${isCompact ? 'column' : 'row'};border-top:1px solid var(--tm-border-color);padding-top:14px;">
                            <div style="font-size:12px;color:var(--tm-secondary-text);width:${isCompact ? '100%' : 'auto'};line-height:1.5;">${currentFieldId ? __tmT("settings.editingCustomColumn", { value1: esc(String(draft.name || currentFieldId).trim() || currentFieldId) }) : __tmT("settings.newCustomColumnsJoinTheColumnSettingsAutomaticallyReorder")}</div>
                            <div style="display:${isCompact ? 'grid' : 'flex'};gap:8px;flex-wrap:wrap;width:${isCompact ? '100%' : 'auto'};${isCompact ? `grid-template-columns:${isPhone ? '1fr' : `repeat(${currentFieldId ? 3 : 2}, minmax(0,1fr))`};` : ''}">
                                ${currentFieldId ? `<button type="button" class="tm-btn tm-btn-danger" data-tm-custom-field-delete style="padding:${isCompact ? '8px 12px' : '6px 10px'};min-height:${isCompact ? '40px' : 'auto'};">${__tmT("settings.deleteCustomColumn")}</button>` : ''}
                                <button type="button" class="tm-btn tm-btn-secondary" data-tm-custom-field-cancel style="padding:${isCompact ? '8px 12px' : '6px 10px'};min-height:${isCompact ? '40px' : 'auto'};">${__tmT("common.cancel")}</button>
                                <button type="button" class="tm-btn tm-btn-primary" data-tm-custom-field-save style="padding:${isCompact ? '8px 12px' : '6px 12px'};min-height:${isCompact ? '40px' : 'auto'};">${__tmT("settings.saveCustomColumn")}</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            const nextScrollEl = dialog.querySelector('[data-tm-custom-field-dialog-scroll]');
            if (nextScrollEl) nextScrollEl.scrollTop = prevScrollTop;
            dialog.querySelectorAll('[data-tm-custom-field-scope-list]').forEach((list) => {
                const key = String(list.getAttribute('data-tm-custom-field-scope-list') || '');
                if (prevScopeListScrollTops.has(key)) list.scrollTop = prevScopeListScrollTops.get(key);
            });

            const readDraftFromDom = () => {
                const nameInput = dialog.querySelector('[data-tm-custom-field-name]');
                const typeSelect = dialog.querySelector('[data-tm-custom-field-type]');
                const attrKeyInput = dialog.querySelector('[data-tm-custom-field-attr-key]');
                const scopeModeSelect = dialog.querySelector('[data-tm-custom-field-scope-mode]');
                draft.name = String(nameInput?.value || '').trim();
                draft.attrKey = String(attrKeyInput?.value || '').trim();
                const nextType = String(typeSelect?.value || 'single').trim();
                draft.type = nextType === 'multi'
                    ? 'multi'
                    : (nextType === 'text' ? 'text' : 'single');
                const optionNameInputs = new Map(Array.from(dialog.querySelectorAll('[data-tm-custom-field-option-name]'))
                    .map((input) => [String(input?.getAttribute('data-option-id') || '').trim(), input]));
                const optionColorInputs = new Map(Array.from(dialog.querySelectorAll('[data-tm-custom-field-option-color]'))
                    .map((input) => [String(input?.getAttribute('data-option-id') || '').trim(), input]));
                draft.options = (Array.isArray(draft.options) ? draft.options : []).map((option, index) => {
                    const optionId = String(option?.id || '').trim();
                    const nameEl = optionNameInputs.get(optionId);
                    const colorEl = optionColorInputs.get(optionId);
                    return {
                        ...option,
                        name: String(nameEl?.value || option?.name || '').trim(),
                        color: __tmNormalizeHexColor(colorEl?.value || option?.color || '', __tmGetCustomFieldPresetColor(index)) || __tmGetCustomFieldPresetColor(index),
                    };
                });
                const nextScopeMode = String(scopeModeSelect?.value || 'global').trim();
                const previousScope = __tmNormalizeCustomFieldScope(draft.scope) || { docIds: [], docGroupIds: [], docTabGroupIds: [] };
                const readSelectedIds = (selector, previousIds) => {
                    const checkboxes = Array.from(dialog.querySelectorAll(selector));
                    const renderedIds = new Set(checkboxes.map((checkbox) => String(checkbox?.value || '').trim()).filter(Boolean));
                    const selectedIds = (Array.isArray(previousIds) ? previousIds : [])
                        .map((id) => String(id || '').trim())
                        .filter((id) => id && !renderedIds.has(id));
                    checkboxes.forEach((checkbox) => {
                        const id = String(checkbox?.value || '').trim();
                        if (id && checkbox.checked) selectedIds.push(id);
                    });
                    return Array.from(new Set(selectedIds));
                };
                draft.scope = nextScopeMode === 'selected'
                    ? __tmNormalizeCustomFieldScope({
                        docIds: readSelectedIds('[data-tm-custom-field-scope-docs]', previousScope.docIds),
                        docGroupIds: readSelectedIds('[data-tm-custom-field-scope-doc-groups]', previousScope.docGroupIds),
                        docTabGroupIds: readSelectedIds('[data-tm-custom-field-scope-tab-groups]', previousScope.docTabGroupIds),
                    })
                    : null;
            };
            const saveField = async () => {
                readDraftFromDom();
                const name = String(draft.name || '').trim();
                if (!name) {
                    hint(__tmT("settings.customColumnNameCannotBeEmpty"), 'warning');
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
                    hint(__tmT("settings.attributeKeyCannotBeEmpty"), 'warning');
                    return;
                }
                const draftType = String(draft.type || 'single').trim() === 'multi'
                    ? 'multi'
                    : (String(draft.type || '').trim() === 'text' ? 'text' : 'single');
                const optionsList = draftType === 'text'
                    ? []
                    : __tmFlattenCustomFieldOptionTree((Array.isArray(draft.options) ? draft.options : []).map((option, index) => ({
                        id: String(option?.id || '').trim() || `option_${index + 1}`,
                        name: String(option?.name || '').trim(),
                        color: String(option?.color || __tmGetCustomFieldPresetColor(index)).trim() || __tmGetCustomFieldPresetColor(index),
                        parentId: String(option?.parentId || '').trim(),
                        archived: option?.archived === true,
                    })).filter((option) => option.name));
                if (draftType !== 'text' && !optionsList.length) {
                    hint(__tmT("settings.keepAtLeastOneOption"), 'warning');
                    return;
                }
                const optionNames = optionsList.map((option) => String(option?.name || '').trim().toLocaleLowerCase());
                if (new Set(optionNames).size !== optionNames.length) {
                    hint(__tmT("settings.optionNamesWithinACustomColumnCannotRepeat"), 'warning');
                    return;
                }
                const nextScope = __tmNormalizeCustomFieldScope(draft.scope);
                if (nextScope && !nextScope.docIds.length && !nextScope.docGroupIds.length && !nextScope.docTabGroupIds.length) {
                    hint(__tmT("settings.withASpecificScopeSelectAtLeastOneDocument"), 'warning');
                    return;
                }
                const duplicateAttrField = others.find((field) => __tmNormalizeCustomFieldAttrName(field?.attrKey || field?.id || field?.name || 'field', field?.id || 'field') === attrKey);
                if (duplicateAttrField) {
                    hint(__tmT("settings.theAttributeKeyAlreadyExistsUseAnotherOne"), 'warning');
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
                        scope: nextScope,
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
                        scope: nextScope,
                    });
                }
                if (currentFieldId && prevAttrKey && prevAttrKey !== attrKey) {
                    await __tmMigrateCustomFieldAttrStorageKey(prevAttrKey, attrKey);
                }
                SettingsStore.data.customFieldDefs = nextDefs;
                SettingsStore.normalizeColumns();
                await SettingsStore.save();
                await __tmRefreshCustomFieldScopeMembership({ force: true });
                try { __tmRefreshSettingsProjectionView('custom-field-def-change'); } catch (e) {}
                currentFieldId = nextId;
                draft = resolveDraft(__tmGetCustomFieldDefs().find((field) => String(field?.id || '').trim() === nextId) || null);
                try { globalThis.__taskHorizonQuickbarInvalidateCustomFieldScope?.(); } catch (e) {}
                hint(__tmT("settings.customColumnSaved"), 'success');
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
            const clearAllFields = async () => {
                const cleared = await window.tmClearCustomFieldSettings();
                if (!cleared) return;
                currentFieldId = '';
                draft = resolveDraft(null, 'single');
                renderDialog();
            };

            dialog.querySelector('[data-tm-custom-field-close]')?.addEventListener('click', close);
            dialog.querySelector('[data-tm-custom-field-cancel]')?.addEventListener('click', close);
            dialog.querySelector('[data-tm-custom-field-save]')?.addEventListener('click', () => {
                saveField().catch((e) => {
                    hint(__tmT("settings.failedToSaveTheCustomColumn", { value1: e?.message || __tmT("plugin.unknownError") }), 'error');
                });
            });
            dialog.querySelector('[data-tm-custom-field-delete]')?.addEventListener('click', () => { deleteField().catch(() => null); });
            dialog.querySelector('[data-tm-custom-field-clear-all]')?.addEventListener('click', () => {
                clearAllFields().catch((e) => {
                    hint(__tmT("settings.failedToClearTheCustomColumnSettings", { value1: e?.message || __tmT("plugin.unknownError") }), 'error');
                });
            });
            dialog.querySelector('[data-tm-custom-field-add-option]')?.addEventListener('click', () => {
                readDraftFromDom();
                draft.options = [...(Array.isArray(draft.options) ? draft.options : []), {
                    id: createDraftOptionId(),
                    name: '',
                    color: __tmGetCustomFieldPresetColor(draft.options.length),
                    parentId: '',
                    archived: false,
                }];
                renderDialog();
            });
            dialog.querySelector('[data-tm-custom-field-type]')?.addEventListener('change', () => {
                readDraftFromDom();
                if (draft.type !== 'text' && (!Array.isArray(draft.options) || draft.options.length === 0)) {
                    draft.options = [
                        { id: createDraftOptionId(), name: '选项1', color: __tmGetCustomFieldPresetColor(0), parentId: '', archived: false },
                        { id: createDraftOptionId(), name: '选项2', color: __tmGetCustomFieldPresetColor(1), parentId: '', archived: false },
                    ];
                }
                renderDialog();
            });
            dialog.querySelector('[data-tm-custom-field-scope-mode]')?.addEventListener('change', () => {
                readDraftFromDom();
                openScopePicker = '';
                renderDialog();
            });
            const bindScopeCheckboxes = (root = dialog) => {
                root.querySelectorAll('[data-tm-custom-field-scope-docs], [data-tm-custom-field-scope-doc-groups], [data-tm-custom-field-scope-tab-groups]').forEach((checkbox) => {
                    checkbox.addEventListener('change', () => {
                        openScopePicker = String(checkbox.closest('[data-tm-custom-field-scope-control]')?.getAttribute('data-tm-custom-field-scope-control') || '').trim();
                        readDraftFromDom();
                        renderDialog();
                    });
                });
            };
            const docSearchInput = dialog.querySelector('[data-tm-custom-field-scope-doc-search]');
            const refreshDocSearchResults = () => {
                const listEl = dialog.querySelector('[data-tm-custom-field-scope-doc-list]');
                if (!listEl) return;
                const searchResults = resolveDocScopeSearchResults(scopeDocSearch);
                const selectedDocIds = __tmNormalizeCustomFieldScope(draft.scope)?.docIds || [];
                listEl.innerHTML = scopeDocSearch
                    ? (scopeDocumentData ? buildScopeChoices(searchResults.shown, selectedDocIds, resolveDocScopeLabel, 'doc', __tmT("settings.noMatchingDocumentsFound"))
                        : (scopeDocumentsFailed ? `<div class="tm-custom-field-scope-empty">${__tmT("settings.failedToLoadDocumentsTryAgain")}</div>` : docScopePendingHtml))
                    : `<div class="tm-custom-field-scope-empty">${__tmT("settings.typeADocumentNameToSearch")}</div>`;
                bindScopeCheckboxes(listEl);
            };
            refreshScopeDocumentUi = () => {
                availableDocs = scopeDocumentData?.documents || [];
                const statusEl = dialog.querySelector('[data-tm-custom-field-scope-doc-status]');
                if (statusEl) {
                    statusEl.hidden = !!scopeDocumentData;
                    statusEl.textContent = scopeDocumentsFailed ? __tmT("settings.failedToLoadDocumentsTryAgain") : __tmT("task.loadingDocuments2");
                    if (scopeDocumentsFailed) {
                        const retry = document.createElement('button');
                        retry.type = 'button';
                        retry.className = 'tm-btn tm-btn-secondary';
                        retry.textContent = __tmT("common.retry");
                        retry.addEventListener('click', () => { loadScopeDocuments(); refreshScopeDocumentUi(); });
                        statusEl.appendChild(retry);
                    }
                }
                if (scopeDocumentData) {
                    dialog.querySelectorAll('[data-tm-custom-field-scope-remove="doc"]').forEach((button) => {
                        const id = String(button.getAttribute('data-tm-scope-id') || '').trim();
                        const label = scopeDocumentData.labels.get(id) || __tmT("settings.invalid", { id: id });
                        const labelEl = button.querySelector('.tm-custom-field-scope-token__label');
                        if (labelEl) labelEl.textContent = label;
                        button.title = __tmT("settings.removeDocument", { label: label });
                    });
                }
                refreshDocSearchResults();
            };
            const openDocumentScopeMenu = () => {
                openScopePicker = 'doc';
                dialog.querySelectorAll('[data-tm-custom-field-scope-list]').forEach((menu) => {
                    menu.hidden = String(menu.getAttribute('data-tm-custom-field-scope-list') || '').trim() !== 'doc';
                });
                dialog.querySelectorAll('[data-tm-custom-field-scope-trigger]').forEach((trigger) => trigger.setAttribute('aria-expanded', 'false'));
                if (docSearchInput) docSearchInput.setAttribute('aria-expanded', 'true');
            };
            docSearchInput?.addEventListener('focus', openDocumentScopeMenu);
            docSearchInput?.addEventListener('click', openDocumentScopeMenu);
            docSearchInput?.addEventListener('input', (event) => {
                openDocumentScopeMenu();
                scopeDocSearch = String(event?.target?.value || '').trim().toLocaleLowerCase();
                const listEl = dialog.querySelector('[data-tm-custom-field-scope-doc-list]');
                refreshDocSearchResults();
                if (listEl) listEl.hidden = false;
            });
            dialog.querySelectorAll('[data-tm-custom-field-scope-trigger]').forEach((trigger) => {
                trigger.addEventListener('click', () => {
                    const kind = String(trigger.getAttribute('data-tm-custom-field-scope-trigger') || '').trim();
                    const shouldOpen = openScopePicker !== kind;
                    openScopePicker = shouldOpen ? kind : '';
                    dialog.querySelectorAll('[data-tm-custom-field-scope-list]').forEach((menu) => {
                        menu.hidden = String(menu.getAttribute('data-tm-custom-field-scope-list') || '').trim() !== openScopePicker;
                    });
                    dialog.querySelectorAll('[data-tm-custom-field-scope-trigger]').forEach((button) => {
                        button.setAttribute('aria-expanded', String(button.getAttribute('data-tm-custom-field-scope-trigger') || '').trim() === openScopePicker ? 'true' : 'false');
                    });
                    if (docSearchInput) docSearchInput.setAttribute('aria-expanded', 'false');
                });
            });
            bindScopeCheckboxes();
            dialog.querySelectorAll('[data-tm-custom-field-scope-remove]').forEach((button) => {
                button.addEventListener('click', () => {
                    readDraftFromDom();
                    const kind = String(button.getAttribute('data-tm-custom-field-scope-remove') || '').trim();
                    const id = String(button.getAttribute('data-tm-scope-id') || '').trim();
                    const key = kind === 'doc' ? 'docIds' : (kind === 'docGroup' ? 'docGroupIds' : 'docTabGroupIds');
                    if (draft.scope && id) draft.scope[key] = (Array.isArray(draft.scope[key]) ? draft.scope[key] : []).filter((itemId) => itemId !== id);
                    openScopePicker = '';
                    renderDialog();
                });
            });
            dialog.querySelectorAll('[data-tm-custom-field-open]').forEach((button) => {
                button.addEventListener('click', () => {
                    readDraftFromDom();
                    currentFieldId = String(button.getAttribute('data-tm-custom-field-open') || '').trim();
                    draft = resolveDraft(__tmGetCustomFieldDefs().find((field) => String(field?.id || '').trim() === currentFieldId) || null);
                    scopeDocSearch = '';
                    openScopePicker = '';
                    renderDialog();
                });
            });
            dialog.querySelectorAll('[data-tm-custom-field-new]').forEach((button) => {
                button.addEventListener('click', () => {
                    readDraftFromDom();
                    currentFieldId = '';
                    draft = resolveDraft(null, String(button.getAttribute('data-tm-custom-field-new') || '').trim());
                    scopeDocSearch = '';
                    openScopePicker = '';
                    renderDialog();
                });
            });
            const applyOptionMove = (move) => {
                const result = __tmMoveCustomFieldOptionSubtree(draft.options, move);
                if (!result.ok) {
                    const message = result.reason === 'max-depth'
                        ? __tmT("settings.upToThreeLevelsAreSupportedTheCurrentSubtree")
                        : (result.reason === 'cycle' ? __tmT("settings.anOptionCannotBeMovedIntoItselfOrIts") : __tmT("settings.theCurrentOptionCannotBeMovedThere"));
                    hint(`⚠️ ${message}`, 'warning');
                    return false;
                }
                draft.options = result.options;
                renderDialog();
                return true;
            };
            dialog.querySelectorAll('[data-tm-custom-field-option-action]').forEach((button) => {
                button.addEventListener('click', () => {
                    readDraftFromDom();
                    const action = String(button.getAttribute('data-tm-custom-field-option-action') || '').trim();
                    const optionId = String(button.getAttribute('data-option-id') || '').trim();
                    const runtime = __tmBuildCustomFieldOptionRuntime(draft.options);
                    const option = runtime.optionById.get(optionId);
                    if (!option) return;
                    const parentId = String(option?.parentId || '').trim();
                    const siblings = runtime.childrenByParentId.get(parentId) || [];
                    const siblingIndex = siblings.findIndex((item) => String(item?.id || '').trim() === optionId);
                    if (action === 'up') {
                        if (siblingIndex > 0) applyOptionMove({ sourceId: optionId, targetParentId: parentId, targetSiblingIndex: siblingIndex - 1 });
                        return;
                    }
                    if (action === 'down') {
                        if (siblingIndex >= 0 && siblingIndex < siblings.length - 1) applyOptionMove({ sourceId: optionId, targetParentId: parentId, targetSiblingIndex: siblingIndex + 2 });
                        return;
                    }
                    if (action === 'indent') {
                        const previousSiblingId = siblingIndex > 0 ? String(siblings[siblingIndex - 1]?.id || '').trim() : '';
                        if (!previousSiblingId) return;
                        applyOptionMove({
                            sourceId: optionId,
                            targetParentId: previousSiblingId,
                            targetSiblingIndex: (runtime.childrenByParentId.get(previousSiblingId) || []).length,
                        });
                        return;
                    }
                    if (action === 'promote') {
                        const parent = runtime.optionById.get(parentId);
                        if (!parent) return;
                        const targetParentId = String(parent?.parentId || '').trim();
                        const parentSiblings = runtime.childrenByParentId.get(targetParentId) || [];
                        const parentIndex = parentSiblings.findIndex((item) => String(item?.id || '').trim() === parentId);
                        if (parentIndex >= 0) applyOptionMove({ sourceId: optionId, targetParentId, targetSiblingIndex: parentIndex + 1 });
                        return;
                    }
                    if (action === 'archive') {
                        draft.options = draft.options.map((item) => String(item?.id || '').trim() === optionId
                            ? { ...item, archived: item?.archived !== true }
                            : item);
                        renderDialog();
                        return;
                    }
                    if (action === 'delete') {
                        if ((runtime.childrenByParentId.get(optionId) || []).length) {
                            hint(__tmT("settings.moveOrDeleteThisOptionSChildrenFirst"), 'warning');
                            return;
                        }
                        const optionName = String(option?.name || optionId).trim() || optionId;
                        if (!window.confirm(__tmT("settings.deleteOptionRawAttributeValuesInExistingTasksAre", { optionName: optionName }))) return;
                        draft.options = draft.options.filter((item) => String(item?.id || '').trim() !== optionId);
                        renderDialog();
                    }
                });
            });
            const clearOptionDropState = () => {
                dialog.querySelectorAll('.is-drag-over').forEach((element) => element.classList.remove('is-drag-over'));
            };
            dialog.querySelectorAll('[data-tm-custom-field-option-drag]').forEach((handle) => {
                handle.addEventListener('dragstart', (event) => {
                    if (!supportsDesktopDrag) {
                        event.preventDefault();
                        return;
                    }
                    readDraftFromDom();
                    draggedOptionId = String(handle.getAttribute('data-option-id') || '').trim();
                    try {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', draggedOptionId);
                    } catch (e) {}
                });
                handle.addEventListener('dragend', () => {
                    draggedOptionId = '';
                    clearOptionDropState();
                });
            });
            dialog.querySelectorAll('[data-tm-custom-field-option-drop-line], [data-tm-custom-field-option-child-drop]').forEach((target) => {
                target.addEventListener('dragover', (event) => {
                    if (!draggedOptionId) return;
                    event.preventDefault();
                    try { event.dataTransfer.dropEffect = 'move'; } catch (e) {}
                    clearOptionDropState();
                    target.classList.add('is-drag-over');
                });
                target.addEventListener('dragleave', (event) => {
                    if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
                    target.classList.remove('is-drag-over');
                });
                target.addEventListener('drop', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    readDraftFromDom();
                    const sourceId = draggedOptionId || String(event.dataTransfer?.getData?.('text/plain') || '').trim();
                    const targetParentId = String(target.getAttribute('data-target-parent-id') || '').trim();
                    const targetSiblingIndex = Number(target.getAttribute('data-target-sibling-index'));
                    draggedOptionId = '';
                    clearOptionDropState();
                    if (sourceId) applyOptionMove({ sourceId, targetParentId, targetSiblingIndex });
                });
            });
            dialog.onclick = (event) => {
                if (event?.target instanceof Element && event.target.closest('[data-tm-custom-field-scope-control]')) return;
                openScopePicker = '';
                dialog.querySelectorAll('[data-tm-custom-field-scope-list]').forEach((menu) => { menu.hidden = true; });
                dialog.querySelectorAll('[data-tm-custom-field-scope-trigger]').forEach((trigger) => trigger.setAttribute('aria-expanded', 'false'));
                dialog.querySelector('[data-tm-custom-field-scope-doc-search]')?.setAttribute('aria-expanded', 'false');
            };
            if (scopeMode === 'selected') {
                loadScopeDocuments();
                if (scopeDocumentsFailed) refreshScopeDocumentUi();
            }
        };

        backdrop.addEventListener('click', (event) => {
            if (event.target === backdrop) close();
        });
        document.body.appendChild(backdrop);
        renderDialog();
    };

    window.tmOpenTaskMetaAttrMigrationDialog = function() {
        const existing = document.getElementById('tm-task-meta-attr-dialog');
        if (existing) existing.remove();
        const fieldDefs = typeof __tmGetTaskMetaAttrFieldDefs === 'function' ? __tmGetTaskMetaAttrFieldDefs() : [];
        if (!fieldDefs.length) {
            hint(__tmT("settings.theBuiltInFieldAttributeConfigurationIsNotLoaded"), 'warning');
            return;
        }
        const backdrop = document.createElement('div');
        backdrop.id = 'tm-task-meta-attr-dialog';
        backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.42);z-index:200050;display:flex;align-items:center;justify-content:center;padding:18px;';
        const dialog = document.createElement('div');
        dialog.style.cssText = 'width:min(1080px,calc(100vw - 32px));max-height:min(760px,calc(100vh - 32px));overflow:hidden;display:flex;flex-direction:column;background:var(--b3-theme-background);color:var(--b3-theme-on-background);border:1px solid var(--b3-theme-surface-light);border-radius:8px;box-shadow:0 18px 54px rgba(0,0,0,.28);';
        backdrop.appendChild(dialog);

        const stateLocal = {
            selected: new Set(),
            draftKeys: {},
            preview: null,
            running: false,
            status: '',
        };
        fieldDefs.forEach((def) => {
            stateLocal.draftKeys[def.field] = __tmGetTaskMetaAttrKey(def.field);
        });

        const close = () => {
            if (stateLocal.running) {
                hint(__tmT("settings.aMigrationIsRunningWaitForItToFinish"), 'warning');
                return;
            }
            try { backdrop.remove(); } catch (e) {}
        };
        const isValueSet = (value) => {
            const text = String(value ?? '').trim();
            return !!text && text !== 'null' && text !== 'undefined';
        };
        const setStatus = (text) => {
            stateLocal.status = String(text || '').trim();
            const el = dialog.querySelector('[data-tm-task-meta-status]');
            if (el) el.textContent = stateLocal.status;
        };
        const getRowsFromDom = () => fieldDefs.map((def) => {
            const field = String(def.field || '').trim();
            const input = dialog.querySelector(`[data-tm-task-meta-key="${field}"]`);
            const checkbox = dialog.querySelector(`[data-tm-task-meta-migrate="${field}"]`);
            const defaultKey = String(def.defaultKey || '').trim();
            const draftValue = Object.prototype.hasOwnProperty.call(stateLocal.draftKeys, field)
                ? stateLocal.draftKeys[field]
                : __tmGetTaskMetaAttrKey(field);
            return {
                field,
                label: String(def.label || field).trim(),
                defaultKey,
                currentKey: __tmGetTaskMetaAttrKey(field),
                nextKey: String(input ? input.value : draftValue).trim() || defaultKey,
                migrate: !!checkbox?.checked,
            };
        });
        const buildFieldStats = () => {
            const out = {};
            fieldDefs.forEach((def) => {
                out[def.field] = { copy: 0, exists: 0, noOldValue: 0, conflict: 0, failed: 0, migrated: 0 };
            });
            return out;
        };
        const getPreviewStats = (field) => stateLocal.preview?.stats?.[field] || null;
        const renderStatsText = (field) => {
            const stats = getPreviewStats(field);
            if (!stats) return __tmT("settings.notPreviewed");
            const migrated = Number(stats.migrated || 0);
            const failed = Number(stats.failed || 0);
            const suffix = migrated || failed ? __tmT("settings.writtenFailed", { migrated: migrated, failed: failed }) : '';
            return __tmT("settings.migratableSkippedNoOldValueConflicts", { value1: stats.copy || 0, value2: stats.exists || 0, value3: stats.noOldValue || 0, value4: stats.conflict || 0, suffix: suffix });
        };
        const queryAllTaskRows = async () => {
            const rows = [];
            const limit = 4000;
            let offset = 0;
            for (let guard = 0; guard < 250; guard += 1) {
                const sql = `
                    SELECT id, parent_id, root_id
                    FROM blocks
                    WHERE type = 'i' AND subtype = 't'
                    ORDER BY id
                    LIMIT ${limit} OFFSET ${offset}
                `;
                const res = await API.call('/api/query/sql', { stmt: sql });
                if (!(res && res.code === 0 && Array.isArray(res.data))) break;
                rows.push(...res.data);
                if (res.data.length < limit) break;
                offset += limit;
            }
            return rows;
        };
        const resolveHostRows = async (tasks) => {
            const list = Array.isArray(tasks) ? tasks : [];
            try {
                if (typeof __tmPopulateTaskAttrHostIds === 'function') {
                    await __tmPopulateTaskAttrHostIds(list);
                    return list;
                }
            } catch (e) {}
            list.forEach((task) => {
                const id = String(task?.id || '').trim();
                task.attrHostId = id;
                task.attr_host_id = id;
            });
            return list;
        };
        const queryAttrRowsByHosts = async (hostIds, names) => {
            const safeHostIds = Array.from(new Set((Array.isArray(hostIds) ? hostIds : []).map((id) => String(id || '').trim()).filter((id) => /^[0-9]+-[a-zA-Z0-9]+$/.test(id))));
            const attrNames = Array.from(new Set((Array.isArray(names) ? names : []).map((name) => String(name || '').trim()).filter(Boolean)));
            const rowMap = new Map();
            if (!safeHostIds.length || !attrNames.length) return rowMap;
            const nameList = attrNames.map((name) => `'${name.replace(/'/g, "''")}'`).join(',');
            const chunkSize = 360;
            for (let i = 0; i < safeHostIds.length; i += chunkSize) {
                const chunk = safeHostIds.slice(i, i + chunkSize);
                const idList = chunk.map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
                const res = await API.call('/api/query/sql', {
                    stmt: `
                        SELECT block_id, name, value
                        FROM attributes
                        WHERE block_id IN (${idList})
                          AND name IN (${nameList})
                    `,
                });
                if (!(res && res.code === 0 && Array.isArray(res.data))) continue;
                res.data.forEach((row) => {
                    const blockId = String(row?.block_id || '').trim();
                    const name = String(row?.name || '').trim();
                    if (!blockId || !name) return;
                    if (!rowMap.has(blockId)) rowMap.set(blockId, {});
                    rowMap.get(blockId)[name] = String(row?.value ?? '');
                });
            }
            return rowMap;
        };
        const getMigrationOldKeys = (row) => {
            if (!row || !row.field || !row.nextKey) return [];
            return Array.from(new Set([
                ...(typeof __tmGetTaskMetaAttrReadKeys === 'function' ? __tmGetTaskMetaAttrReadKeys(row.field) : []),
                row.defaultKey,
                row.currentKey,
            ]
                .map((key) => String(key || '').trim())
                .filter((key) => key && key !== row.nextKey)));
        };
        const buildMigrationPlan = async (rowsForMigration, options = {}) => {
            const opts = (options && typeof options === 'object') ? options : {};
            const selectedRows = (Array.isArray(rowsForMigration) ? rowsForMigration : getRowsFromDom())
                .filter((row) => row && row.migrate && row.field && row.nextKey && getMigrationOldKeys(row).length > 0);
            const stats = buildFieldStats();
            const entries = [];
            if (!selectedRows.length) return { stats, entries, taskCount: 0, hostCount: 0 };
            const tasks = await queryAllTaskRows();
            setStatus(__tmT("settings.scannedTasksResolvingAttributeHostBlocks", { length: tasks.length }));
            await resolveHostRows(tasks);
            const hostIds = Array.from(new Set(tasks.map((task) => String(task?.attrHostId || task?.attr_host_id || task?.id || '').trim()).filter(Boolean)));
            const attrNames = [];
            selectedRows.forEach((row) => {
                attrNames.push(row.nextKey);
                (__tmGetTaskMetaAttrReadKeys(row.field) || []).forEach((key) => attrNames.push(key));
                attrNames.push(row.defaultKey);
            });
            const rowMap = await queryAttrRowsByHosts(hostIds, attrNames);
            const seenHostFields = new Set();
            tasks.forEach((task) => {
                const hostId = String(task?.attrHostId || task?.attr_host_id || task?.id || '').trim();
                if (!hostId) return;
                const attrs = rowMap.get(hostId) || {};
                selectedRows.forEach((row) => {
                    const field = row.field;
                    const dedupeKey = `${hostId}|${field}`;
                    if (seenHostFields.has(dedupeKey)) return;
                    seenHostFields.add(dedupeKey);
                    const nextKey = row.nextKey;
                    const nextValue = attrs[nextKey];
                    const oldKeys = getMigrationOldKeys(row);
                    const oldKey = oldKeys.find((key) => isValueSet(attrs[key])) || '';
                    const oldValue = oldKey ? attrs[oldKey] : '';
                    if (isValueSet(nextValue)) {
                        if (oldKey && String(nextValue ?? '') !== String(oldValue ?? '')) stats[field].conflict += 1;
                        else stats[field].exists += 1;
                        return;
                    }
                    if (!oldKey) {
                        stats[field].noOldValue += 1;
                        return;
                    }
                    stats[field].copy += 1;
                    entries.push({ hostId, field, oldKey, newKey: nextKey, value: String(oldValue ?? '') });
                });
            });
            if (opts.previewOnly !== true) stateLocal.preview = { stats, entries, taskCount: tasks.length, hostCount: hostIds.length };
            return { stats, entries, taskCount: tasks.length, hostCount: hostIds.length };
        };
        const saveFieldNames = async (rowsOverride = null) => {
            const rows = Array.isArray(rowsOverride) ? rowsOverride : getRowsFromDom();
            const draftKeys = {};
            rows.forEach((row) => { draftKeys[row.field] = row.nextKey || row.defaultKey; });
            const validation = __tmValidateTaskMetaAttrSettings(draftKeys);
            if (!validation.ok) {
                hint(`⚠️ ${validation.errors[0] || __tmT("settings.invalidAttributeName")}`, 'warning');
                setStatus(validation.errors.join('；'));
                return false;
            }
            const previousKeys = {};
            fieldDefs.forEach((def) => { previousKeys[def.field] = __tmGetTaskMetaAttrKey(def.field); });
            const nextAliases = __tmNormalizeTaskMetaAttrAliasSettings(SettingsStore.data.taskMetaAttrKeyAliases);
            fieldDefs.forEach((def) => {
                const field = def.field;
                const prev = previousKeys[field];
                const next = validation.keys[field] || def.defaultKey;
                const aliases = new Set(nextAliases[field] || []);
                if (prev && prev !== next) aliases.add(prev);
                aliases.add(def.defaultKey);
                aliases.delete(next);
                nextAliases[field] = Array.from(aliases).filter(Boolean);
            });
            fieldDefs.forEach((def) => {
                const field = def.field;
                const next = validation.keys[field] || def.defaultKey;
                Object.keys(nextAliases).forEach((aliasField) => {
                    if (aliasField === field) return;
                    nextAliases[aliasField] = (nextAliases[aliasField] || []).filter((key) => key !== next);
                });
            });
            SettingsStore.data.taskMetaAttrKeys = __tmNormalizeTaskMetaAttrKeySettings(validation.keys);
            SettingsStore.data.taskMetaAttrKeyAliases = __tmNormalizeTaskMetaAttrAliasSettings(nextAliases);
            try { SettingsStore.syncToLocal(); } catch (e) {}
            await SettingsStore.save();
            try { await SettingsStore.saveNow(); } catch (e) {}
            fieldDefs.forEach((def) => {
                stateLocal.draftKeys[def.field] = validation.keys[def.field] || def.defaultKey;
            });
            stateLocal.preview = null;
            setStatus(__tmT("settings.fieldNameSettingsSavedMigrationDoesNotRunAutomatically"));
            hint(__tmT("settings.builtInFieldAttributeNamesSaved"), 'success');
            return true;
        };
        const refreshAfterMigration = async () => {
            try { __tmInvalidateAllSqlCaches?.(); } catch (e) {}
            try { __tmClearCustomFieldAttrValueCache?.(); } catch (e) {}
            try { globalThis.__taskHorizonQuickbarInvalidateCustomFieldScope?.(); } catch (e) {}
            try {
                if (typeof loadSelectedDocuments === 'function') {
                    await loadSelectedDocuments({ showInlineLoading: false, source: 'task-meta-attr-migration' });
                    return;
                }
            } catch (e) {}
            try { render(); } catch (e) {}
        };
        const previewMigration = async () => {
            if (stateLocal.running) return;
            const rowsBeforeSave = getRowsFromDom();
            stateLocal.running = true;
            renderDialog();
            try {
                if (!(await saveFieldNames(rowsBeforeSave))) return;
                setStatus(__tmT("settings.previewingMigration"));
                const plan = await buildMigrationPlan(rowsBeforeSave, { previewOnly: false });
                setStatus(__tmT("settings.previewCompleteTasksHostBlocksMigratableItems", { taskCount: plan.taskCount, hostCount: plan.hostCount, length: plan.entries.length }));
            } catch (e) {
                setStatus(__tmT("settings.previewFailed", { value1: String(e?.message || e || __tmT("plugin.unknownError")) }));
                hint(__tmT("settings.previewFailed2", { value1: e?.message || __tmT("plugin.unknownError") }), 'error');
            } finally {
                stateLocal.running = false;
                renderDialog();
            }
        };
        const migrateSelected = async () => {
            if (stateLocal.running) return;
            const selectedRows = getRowsFromDom().filter((row) => row.migrate);
            if (!selectedRows.length) {
                hint(__tmT("settings.selectAtLeastOneField"), 'warning');
                return;
            }
            if (!confirm(__tmT("settings.migrationCopiesOldAttributeValuesToTheNewAttribute"))) return;
            const rowsBeforeSave = getRowsFromDom();
            stateLocal.running = true;
            renderDialog();
            try {
                if (!(await saveFieldNames(rowsBeforeSave))) return;
                setStatus(__tmT("settings.preparingMigration"));
                const plan = await buildMigrationPlan(rowsBeforeSave, { previewOnly: false });
                const entries = Array.isArray(plan.entries) ? plan.entries : [];
                const stats = plan.stats || buildFieldStats();
                if (!entries.length) {
                    stateLocal.preview = { ...plan, stats };
                    setStatus(__tmT("settings.nothingToMigrate"));
                    return;
                }
                const chunkSize = 40;
                for (let i = 0; i < entries.length; i += chunkSize) {
                    const chunk = entries.slice(i, i + chunkSize);
                    setStatus(__tmT("settings.migrating", { value1: Math.min(i + chunk.length, entries.length), length: entries.length }));
                    for (const entry of chunk) {
                        try {
                            const latest = await API.call('/api/attr/getBlockAttrs', { id: entry.hostId });
                            const attrs = latest && latest.code === 0 && latest.data && typeof latest.data === 'object' ? latest.data : {};
                            if (isValueSet(attrs[entry.newKey])) {
                                stats[entry.field].exists += 1;
                                continue;
                            }
                            const adapter = globalThis.__tmTaskHorizonBackendAdapter;
                            if (!adapter || typeof adapter.setAttrs !== 'function') throw new Error(__tmT("task.taskWriteAdapterIsNotReadySetattrs"));
                            await adapter.setAttrs(entry.hostId, { [entry.newKey]: entry.value });
                            stats[entry.field].migrated += 1;
                        } catch (e) {
                            stats[entry.field].failed += 1;
                        }
                    }
                }
                stateLocal.preview = { ...plan, stats };
                setStatus(__tmT("settings.migrationCompleteWroteItemsFailedItems", { value1: Object.values(stats).reduce((sum, item) => sum + Number(item.migrated || 0), 0), value2: Object.values(stats).reduce((sum, item) => sum + Number(item.failed || 0), 0) }));
                await refreshAfterMigration();
                hint(__tmT("settings.migrationComplete"), 'success');
            } catch (e) {
                setStatus(__tmT("settings.migrationFailed", { value1: String(e?.message || e || __tmT("plugin.unknownError")) }));
                hint(__tmT("settings.migrationFailed2", { value1: e?.message || __tmT("plugin.unknownError") }), 'error');
            } finally {
                stateLocal.running = false;
                renderDialog();
            }
        };
        function renderDialog() {
            const rowsHtml = fieldDefs.map((def) => {
                const field = String(def.field || '').trim();
                const currentKey = __tmGetTaskMetaAttrKey(field);
                const draftKey = Object.prototype.hasOwnProperty.call(stateLocal.draftKeys, field)
                    ? String(stateLocal.draftKeys[field] || '').trim()
                    : currentKey;
                const statsText = renderStatsText(field);
                const checked = stateLocal.selected.has(field) ? 'checked' : '';
                return `
                    <tr>
                        <td style="padding:8px 10px;border-top:1px solid var(--tm-border-color);"><input type="checkbox" data-tm-task-meta-migrate="${esc(field)}" ${checked}></td>
                        <td style="padding:8px 10px;border-top:1px solid var(--tm-border-color);font-weight:600;">${esc(def.label || field)}</td>
                        <td style="padding:8px 10px;border-top:1px solid var(--tm-border-color);font-family:monospace;font-size:12px;color:var(--tm-secondary-text);">${esc(def.defaultKey)}</td>
                        <td style="padding:8px 10px;border-top:1px solid var(--tm-border-color);font-family:monospace;font-size:12px;">${esc(currentKey)}</td>
                        <td style="padding:8px 10px;border-top:1px solid var(--tm-border-color);"><input class="b3-text-field" data-tm-task-meta-key="${esc(field)}" value="${esc(draftKey || currentKey)}" style="width:220px;font-family:monospace;font-size:12px;"></td>
                        <td style="padding:8px 10px;border-top:1px solid var(--tm-border-color);font-size:12px;color:var(--tm-secondary-text);white-space:nowrap;">${esc(statsText)}</td>
                    </tr>
                `;
            }).join('');
            dialog.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--tm-border-color);">
                    <div>
                        <div style="font-weight:700;font-size:15px;">${__tmT("settings.builtInFieldAttributeNamesMigration")}</div>
                        <div style="font-size:12px;color:var(--tm-secondary-text);margin-top:3px;">${__tmT("settings.savingFieldNamesDoesNotMigrateAutomaticallyMigrationOnly")}</div>
                    </div>
                    <button class="tm-btn tm-btn-secondary" data-tm-task-meta-close>${__tmT("common.close")}</button>
                </div>
                <div style="padding:12px 16px;overflow:auto;">
                    <div style="font-size:12px;line-height:1.6;color:var(--tm-secondary-text);background:var(--tm-card-bg);border:1px solid var(--tm-border-color);border-radius:8px;padding:10px 12px;margin-bottom:12px;">${__tmT("settings.risksOlderVersionsOnOtherDevicesStillWriteThe")}</div>
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        <thead>
                            <tr style="text-align:left;color:var(--tm-secondary-text);">
                                <th style="padding:6px 10px;width:62px;">${__tmT("settings.migrate")}</th>
                                <th style="padding:6px 10px;">${__tmT("settings.field")}</th>
                                <th style="padding:6px 10px;">${__tmT("settings.defaultAttribute")}</th>
                                <th style="padding:6px 10px;">${__tmT("settings.currentAttribute")}</th>
                                <th style="padding:6px 10px;">${__tmT("settings.newAttribute")}</th>
                                <th style="padding:6px 10px;">${__tmT("settings.previewStats")}</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-top:1px solid var(--tm-border-color);">
                    <div data-tm-task-meta-status style="font-size:12px;color:var(--tm-secondary-text);min-height:18px;">${esc(stateLocal.status || __tmT("settings.noMigrationWasPerformed"))}</div>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <button class="tm-btn tm-btn-secondary" data-tm-task-meta-save ${stateLocal.running ? 'disabled' : ''}>${__tmT("settings.saveFieldNames")}</button>
                        <button class="tm-btn tm-btn-secondary" data-tm-task-meta-preview ${stateLocal.running ? 'disabled' : ''}>${__tmT("settings.previewMigration")}</button>
                        <button class="tm-btn tm-btn-primary" data-tm-task-meta-migrate-run ${stateLocal.running ? 'disabled' : ''}>${__tmT("settings.migrateSelectedFields")}</button>
                    </div>
                </div>
            `;
            dialog.querySelectorAll('[data-tm-task-meta-migrate]').forEach((input) => {
                input.addEventListener('change', () => {
                    const field = String(input.getAttribute('data-tm-task-meta-migrate') || '').trim();
                    if (!field) return;
                    if (input.checked) stateLocal.selected.add(field);
                    else stateLocal.selected.delete(field);
                });
            });
            dialog.querySelectorAll('[data-tm-task-meta-key]').forEach((input) => {
                input.addEventListener('input', () => {
                    stateLocal.preview = null;
                    const field = String(input.getAttribute('data-tm-task-meta-key') || '').trim();
                    if (!field) return;
                    stateLocal.draftKeys[field] = String(input.value || '').trim();
                    stateLocal.selected.add(field);
                });
            });
            dialog.querySelector('[data-tm-task-meta-close]')?.addEventListener('click', close);
            dialog.querySelector('[data-tm-task-meta-save]')?.addEventListener('click', () => {
                saveFieldNames().then((ok) => { if (ok) renderDialog(); }).catch((e) => hint(__tmT("settings.saveFailed", { value1: e?.message || __tmT("plugin.unknownError") }), 'error'));
            });
            dialog.querySelector('[data-tm-task-meta-preview]')?.addEventListener('click', () => { previewMigration().catch(() => null); });
            dialog.querySelector('[data-tm-task-meta-migrate-run]')?.addEventListener('click', () => { migrateSelected().catch(() => null); });
        }
        backdrop.addEventListener('click', (event) => {
            if (event.target === backdrop) close();
        });
        document.body.appendChild(backdrop);
        renderDialog();
    };

    async function __tmApplyTimelineColumnOrder(nextOrder, source = 'timeline-columns') {
        const previousOrder = __tmGetTimelineColumnOrder();
        const normalizedOrder = __tmNormalizeTimelineColumnOrder(nextOrder);
        if (normalizedOrder.join('\u0000') === previousOrder.join('\u0000')) return true;
        const previousPlan = __tmBuildRuntimeCustomFieldLoadPlan({
            viewMode: 'timeline',
            colOrder: previousOrder,
        });
        SettingsStore.data.timelineColumnOrder = normalizedOrder;
        SettingsStore.normalizeColumns();
        try { SettingsStore.syncToLocal(); } catch (e) {}
        try { await SettingsStore.save(); } catch (e) {}
        const nextPlan = __tmBuildRuntimeCustomFieldLoadPlan({
            viewMode: 'timeline',
            colOrder: __tmGetTimelineColumnOrder(),
        });
        if (__tmDoesCustomFieldPlanNeedReload(previousPlan, nextPlan)) {
            try {
                await loadSelectedDocuments({
                    showInlineLoading: false,
                    source,
                });
                return true;
            } catch (e) {}
        }
        render();
        return true;
    }

    window.tmSetTimelineColumnVisible = async function(columnKey, visible) {
        const key = String(columnKey || '').trim();
        if (!key || !__tmGetKnownColumnKeys().has(key)) return false;
        const order = __tmGetTimelineColumnOrder();
        const hasColumn = order.includes(key);
        if (visible === true) {
            if (hasColumn) return true;
            return __tmApplyTimelineColumnOrder(order.concat(key), 'timeline-column-show');
        }
        if (!hasColumn) return true;
        if (order.length <= 1) {
            hint(__tmT("settings.theTimelineMustKeepAtLeastOneColumn"), 'info');
            return false;
        }
        return __tmApplyTimelineColumnOrder(order.filter((item) => item !== key), 'timeline-column-hide');
    };

    window.tmMoveTimelineColumn = async function(columnKey, direction) {
        const key = String(columnKey || '').trim();
        const step = Number(direction) < 0 ? -1 : 1;
        const order = __tmGetTimelineColumnOrder();
        const index = order.indexOf(key);
        const nextIndex = index + step;
        if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return false;
        [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
        return __tmApplyTimelineColumnOrder(order, 'timeline-column-move');
    };

    window.tmShowColumnHeaderContextMenu = function(event, columnKey = '', options = {}) {
        try {
            event?.preventDefault?.();
            event?.stopPropagation?.();
        } catch (e) {}
        const key = String(columnKey || '').trim();
        if (!key) return false;
        const scope = String(options?.scope || '').trim();
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
        const createDivider = () => {
            const divider = document.createElement('hr');
            divider.style.cssText = 'margin:4px 0;border:none;border-top:1px solid var(--b3-theme-surface-light);';
            menu.appendChild(divider);
        };
        if (scope === 'timeline') {
            const order = __tmGetTimelineColumnOrder();
            const index = order.indexOf(key);
            if (index > 0) createItem(__tmT("settings.moveLeft"), () => { window.tmMoveTimelineColumn(key, -1).catch(() => null); });
            if (index >= 0 && index < order.length - 1) createItem(__tmT("settings.moveRight"), () => { window.tmMoveTimelineColumn(key, 1).catch(() => null); });
            createItem(__tmT("settings.hide", { value1: __tmResolveColumnLabel(key) }), () => { window.tmSetTimelineColumnVisible(key, false).catch(() => null); });
            createDivider();

            const listLabel = document.createElement('div');
            listLabel.textContent = __tmT("settings.showColumn");
            listLabel.style.cssText = 'padding:4px 12px 3px;color:var(--b3-theme-on-surface);font-size:12px;';
            menu.appendChild(listLabel);
            const list = document.createElement('div');
            list.style.cssText = 'display:flex;flex-direction:column;max-height:260px;overflow-y:auto;overscroll-behavior:contain;';
            __tmGetAllColumnDefs().forEach((def) => {
                const colKey = String(def?.key || '').trim();
                if (!colKey) return;
                const row = document.createElement('label');
                row.style.cssText = 'display:flex;align-items:center;gap:8px;min-height:30px;padding:2px 12px;cursor:pointer;font-size:13px;color:var(--b3-theme-on-background);box-sizing:border-box;';
                row.onmouseenter = () => row.style.backgroundColor = 'var(--b3-theme-surface-light)';
                row.onmouseleave = () => row.style.backgroundColor = 'transparent';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = order.includes(colKey);
                checkbox.setAttribute('aria-label', __tmT("settings.show", { value1: __tmResolveColumnLabel(colKey) }));
                checkbox.addEventListener('change', () => {
                    const requested = checkbox.checked;
                    window.tmSetTimelineColumnVisible(colKey, requested).then((ok) => {
                        if (!ok) checkbox.checked = !requested;
                    }).catch(() => { checkbox.checked = !requested; });
                });
                const text = document.createElement('span');
                text.textContent = __tmResolveColumnLabel(colKey);
                text.style.cssText = 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
                row.append(checkbox, text);
                list.appendChild(row);
            });
            menu.appendChild(list);
            createDivider();
            createItem(__tmT("settings.manageCustomColumns"), () => window.tmOpenCustomFieldDialog('', { manager: true }));
            document.body.appendChild(menu);
            __tmClampFloatingMenuToViewport(menu, event.clientX, event.clientY, { margin: 8 });
            const closeHandler = () => close();
            state.columnContextMenuCloseHandler = closeHandler;
            __tmScheduleBindOutsideCloseHandler(closeHandler, { ignoreSelector: '#tm-column-context-menu' });
            return false;
        }
        const fieldId = __tmParseCustomFieldColumnKey(key);
        const field = fieldId ? __tmGetCustomFieldDefMap().get(fieldId) : null;
        createItem(__tmT("settings.addSingleSelectColumn"), () => window.tmOpenCustomFieldDialog('', { type: 'single' }));
        createItem(__tmT("settings.addMultiSelectColumn"), () => window.tmOpenCustomFieldDialog('', { type: 'multi' }));
        createItem(__tmT("settings.addTextColumn"), () => window.tmOpenCustomFieldDialog('', { type: 'text' }));
        createItem(__tmT("settings.manageCustomColumns"), () => window.tmOpenCustomFieldDialog('', { manager: true }));
        if (field) {
            createDivider();
            createItem(__tmT("settings.edit", { name: field.name }), () => window.tmOpenCustomFieldDialog(fieldId));
            createItem(__tmT("settings.hide2", { name: field.name }), () => window.toggleColumn(key, false, { refreshSettings: false }));
            createItem(__tmT("settings.delete", { name: field.name }), () => { window.tmDeleteCustomFieldById(fieldId).catch(() => null); }, true);
        } else {
            createDivider();
            createItem(__tmT("settings.hide", { value1: __tmResolveColumnLabel(key) }), () => window.toggleColumn(key, false, { refreshSettings: false }));
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
        if (__tmIsFixedDateColumn(column)) return;
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

    window.tmUpdateDocGroupSettingsQuery = function(value) {
        const rawQuery = String(value || '');
        const query = rawQuery.trim().toLowerCase();
        state.settingsDocGroupQuery = rawQuery;
        const manager = state.settingsModal?.querySelector?.('.tm-doc-group-manager');
        if (!manager) return;
        let visibleCount = 0;
        manager.querySelectorAll('[data-tm-doc-group-search-name]').forEach((item) => {
            const searchableName = String(item.dataset.tmDocGroupSearchName || '').toLowerCase();
            const visible = !query || searchableName.includes(query);
            item.hidden = !visible;
            if (visible) visibleCount += 1;
        });
        const empty = manager.querySelector('.tm-doc-group-manager__search-empty');
        if (empty) empty.hidden = visibleCount > 0;
        const clear = manager.querySelector('.tm-doc-group-manager__search button');
        if (clear) clear.hidden = !query;
    };

    window.tmClearDocGroupSettingsQuery = function() {
        const input = state.settingsModal?.querySelector?.('.tm-doc-group-manager__search input');
        if (input) input.value = '';
        window.tmUpdateDocGroupSettingsQuery('');
        try { input?.focus?.(); } catch (e) {}
    };

    window.tmSetDocGroupSettingsDetailTab = function(tab) {
        const normalized = String(tab || '').trim();
        state.settingsDocGroupDetailTab = ['sources', 'excluded', 'optimization'].includes(normalized)
            ? normalized
            : 'sources';
        showSettings();
    };

    window.tmSwitchSettingsDocGroup = async function(groupId) {
        const nextGroupId = String(groupId || 'all').trim() || 'all';
        const previousGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        if (nextGroupId === previousGroupId) return;
        const manager = state.settingsModal?.querySelector?.('.tm-doc-group-manager');
        const workspace = manager?.querySelector?.('.tm-doc-group-manager__workspace');
        if (workspace) workspace.setAttribute('aria-busy', 'true');
        manager?.querySelectorAll?.('[data-tm-call="tmSwitchSettingsDocGroup"]').forEach((button) => {
            let buttonGroupId = '';
            try {
                const args = JSON.parse(String(button.dataset.tmArgs || '[]'));
                buttonGroupId = String(Array.isArray(args) ? args[0] : '').trim();
            } catch (e) {}
            const selected = buttonGroupId === nextGroupId;
            button.classList.toggle('is-active', selected);
            button.setAttribute('aria-selected', selected ? 'true' : 'false');
        });
        try {
            await window.switchDocGroup(nextGroupId);
        } catch (e) {
            manager?.querySelectorAll?.('[data-tm-call="tmSwitchSettingsDocGroup"]').forEach((button) => {
                let buttonGroupId = '';
                try {
                    const args = JSON.parse(String(button.dataset.tmArgs || '[]'));
                    buttonGroupId = String(Array.isArray(args) ? args[0] : '').trim();
                } catch (e2) {}
                const selected = buttonGroupId === previousGroupId;
                button.classList.toggle('is-active', selected);
                button.setAttribute('aria-selected', selected ? 'true' : 'false');
            });
        } finally {
            if (workspace?.isConnected) workspace.setAttribute('aria-busy', 'false');
        }
    };

    // 新增：切换分组
    window.switchDocGroup = async function(groupId) {
        const previousGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        let savePromise = Promise.resolve();
        try {
            const nextGroupId = String(groupId || 'all').trim() || 'all';
            SettingsStore.data.currentGroupId = nextGroupId;
            __tmApplyCompletedVisibilityToRuntime();
            try { SettingsStore.syncToLocal(); } catch (e) {}
            savePromise = SettingsStore.save().catch(() => null);
            state.activeDocId = 'all';
            const currentRuleId = String(state.currentRule || SettingsStore.data.currentRule || '').trim();
            const nextRuleId = (state.filterRules || []).some((rule) => rule && rule.enabled && String(rule.id || '').trim() === currentRuleId)
                ? currentRuleId
                : '';
            state.currentRule = nextRuleId || null;
            SettingsStore.data.currentRule = nextRuleId || null;
            showSettings();
            await loadSelectedDocuments({
                showInlineLoading: true,
                loadingStyleKind: 'topbar',
                loadingDelayMs: 0,
                preferFastFirstPaint: true,
                skipSnapshotFirstPaint: true,
                taskIndexFirstPaintCachedOnly: false,
                refreshAfterTaskIndexFirstPaint: true,
                forceFastFirstPaintBudget: true,
                source: 'legacy-switch-doc-group',
            });
            try {
                if (typeof __tmFlushPendingCreatedTaskSnapshotRefreshesAfterGroupSwitch === 'function') {
                    await __tmFlushPendingCreatedTaskSnapshotRefreshesAfterGroupSwitch({
                        docIds: state.__tmLoadedDocIdsForTasks || [],
                        groupId: nextGroupId,
                        source: 'legacy-switch-doc-group-created-task',
                    });
                }
            } catch (e) {}
            await savePromise;
            __tmRenderPreservingCalendarSideDock();
        } catch (e) {
            try { await savePromise; } catch (e2) {}
            SettingsStore.data.currentGroupId = previousGroupId;
            __tmApplyCompletedVisibilityToRuntime();
            try { SettingsStore.syncToLocal(); } catch (e2) {}
            try { await SettingsStore.save(); } catch (e2) {}
            try { showSettings(); } catch (e2) {}
            try { hint(__tmT("settings.switchFailed", { value1: e?.message || String(e) }), 'error'); } catch (e2) {}
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

    const __TM_INITIAL_NOTEBOOK_GROUP_IMPORT_PROMPTED_KEY = 'tm_initial_notebook_group_import_prompted';

    function __tmCreateDocGroupId(usedIds, index = 0) {
        const used = usedIds instanceof Set ? usedIds : new Set();
        const base = `g_${Date.now()}_${Math.max(0, Number(index) || 0) + 1}`;
        let id = base;
        let suffix = 1;
        while (used.has(id)) {
            suffix += 1;
            id = `${base}_${suffix}`;
        }
        used.add(id);
        return id;
    }

    function __tmGetNotebookGroupImportNotebookOptions() {
        return (Array.isArray(state.notebooks) ? state.notebooks : []).map((item) => ({
            value: String(item?.id || item?.box || '').trim(),
            label: String(item?.name || item?.title || '').trim() || String(item?.id || item?.box || '').trim()
        })).filter((item) => item.value);
    }

    async function __tmImportAllNotebooksAsDocGroups(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        await __tmRefreshNotebookCache(true);
        const notebooks = __tmGetNotebookGroupImportNotebookOptions();
        if (notebooks.length === 0) {
            if (opts.showHints !== false) hint(__tmT("settings.noUsableNotebookFound2"), 'warning');
            return { imported: 0, total: 0, groups: [] };
        }

        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups.slice() : [];
        const usedIds = new Set(groups.map((group) => String(group?.id || '').trim()).filter(Boolean));
        const existingNotebookIds = new Set(groups.map((group) => String(group?.notebookId || '').trim()).filter(Boolean));
        const importedGroups = [];

        notebooks.forEach((item, index) => {
            const notebookId = String(item.value || '').trim();
            if (!notebookId || existingNotebookIds.has(notebookId)) return;
            existingNotebookIds.add(notebookId);
            importedGroups.push({
                id: __tmCreateDocGroupId(usedIds, index),
                name: __tmGetNotebookDisplayName(notebookId, item.label),
                notebookId,
                docs: [],
                calendarSearchOptimization: { enabled: false, days: 90 }
            });
        });

        if (importedGroups.length === 0) {
            if (opts.showHints !== false) hint(__tmT("settings.allNotebooksAreAlreadyInGroups"), 'warning');
            return { imported: 0, total: notebooks.length, groups: [] };
        }

        await SettingsStore.updateDocGroups(groups.concat(importedGroups));
        try { __tmDocExpandCache?.clear?.(); } catch (e) {}
        try { window.__tmInvalidateDocScopeCache?.(); } catch (e) {}
        try { window.__tmCalendarDocsToGroupCache = null; } catch (e) {}
        if (opts.refreshSettings !== false && state.settingsModal && document.body.contains(state.settingsModal)) {
            showSettings();
        }
        return { imported: importedGroups.length, total: notebooks.length, groups: importedGroups };
    }

    async function __tmPromptInitialNotebookGroupImportIfNeeded() {
        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        if (groups.some((group) => String(group?.id || '').trim())) return false;
        if (Storage.get(__TM_INITIAL_NOTEBOOK_GROUP_IMPORT_PROMPTED_KEY, false)) return false;
        if (state.__tmInitialNotebookGroupImportPromptPromise) {
            return await state.__tmInitialNotebookGroupImportPromptPromise;
        }

        const task = Promise.resolve().then(async () => {
            const freshGroups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
            if (freshGroups.some((group) => String(group?.id || '').trim())) return false;
            if (typeof showConfirm !== 'function') return false;
            const ok = await showConfirm(
                __tmT("settings.initializeDocumentGroups"),
                __tmT("settings.thereAreNoDocumentGroupsYetReadAllNotebooks")
            );
            Storage.set(__TM_INITIAL_NOTEBOOK_GROUP_IMPORT_PROMPTED_KEY, true);
            if (!ok) return false;
            const result = await __tmImportAllNotebooksAsDocGroups({
                refreshSettings: false,
                showHints: false
            });
            if (result.imported > 0) {
                hint(__tmT("settings.importedNotebookGroups", { imported: result.imported }), 'success');
                return true;
            }
            hint(__tmT("settings.noNotebooksToImport"), 'warning');
            return false;
        }).finally(() => {
            state.__tmInitialNotebookGroupImportPromptPromise = null;
        });
        state.__tmInitialNotebookGroupImportPromptPromise = task;
        return await task;
    }

    window.createNotebookGroup = async function() {
        await __tmRefreshNotebookCache(true);
        const notebooks = __tmGetNotebookGroupImportNotebookOptions();
        if (notebooks.length === 0) {
            hint(__tmT("settings.noUsableNotebookFound2"), 'warning');
            return;
        }
        const notebookId = await showSelectPrompt(__tmT("settings.selectNotebook"), notebooks, notebooks[0].value);
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
        const name = await showPrompt(__tmT("settings.newCustomGroup"), __tmT("settings.enterAGroupName"), __tmT("settings.newGroup"));
        if (!name) return;
        await __tmCreateGroupAndSelect({
            id: 'g_' + Date.now(),
            name,
            docs: [],
            calendarSearchOptimization: { enabled: false, days: 90 }
        });
    };

    window.tmMoveCurrentDocGroup = async function(direction) {
        const currentId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        if (currentId === 'all') return false;
        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        const currentIndex = groups.findIndex((group) => String(group?.id || '').trim() === currentId);
        const targetIndex = currentIndex + (Number(direction) < 0 ? -1 : 1);
        if (currentIndex < 0 || targetIndex < 0 || targetIndex >= groups.length) return false;
        const nextGroups = groups.slice();
        [nextGroups[currentIndex], nextGroups[targetIndex]] = [nextGroups[targetIndex], nextGroups[currentIndex]];
        await SettingsStore.updateDocGroups(nextGroups);
        try { window.tmRefreshDocGroupTopbarSelects?.(currentId); } catch (e) {}
        showSettings();
        return true;
    };

    window.renameCurrentGroup = async function() {
        const currentId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        if (currentId === 'all') return;

        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups : [];
        const group = groups.find((item) => String(item?.id || '').trim() === currentId);
        if (!group) {
            hint(__tmT("settings.theCurrentGroupWasNotFound"), 'warning');
            return;
        }
        if (String(group.notebookId || '').trim()) {
            hint(__tmT("settings.notebookGroupNamesFollowTheNotebookDisplayNameAnd"), 'warning');
            return;
        }

        const storedOldName = String(group.name || '').trim();
        const oldName = storedOldName || __tmResolveDocGroupName(group);
        const nextNameInput = await showPrompt(__tmT("settings.renameCustomGroup"), __tmT("settings.enterANewGroupName"), oldName);
        if (nextNameInput === null || nextNameInput === undefined) return;
        const nextName = String(nextNameInput || '').trim();
        if (!nextName) {
            hint(__tmT("settings.groupNameCannotBeEmpty"), 'warning');
            return;
        }
        if (nextName === storedOldName) return;

        group.name = nextName;
        await SettingsStore.updateDocGroups(groups);
        try { window.tmCloseTopbarSelects?.(); } catch (e) {}
        try { window.tmRefreshDocGroupTopbarSelects?.(currentId); } catch (e) {}
        try { render(); } catch (e) {}
        showSettings();
        hint(__tmT("settings.groupRenamed"), 'success');
    };

    // 新增：删除当前分组
    window.deleteCurrentGroup = async function() {
        const currentId = SettingsStore.data.currentGroupId;
        let groups = SettingsStore.data.docGroups || [];
        const currentGroup = groups.find((group) => String(group?.id || '').trim() === String(currentId || '').trim());
        const currentGroupName = __tmResolveDocGroupName(currentGroup) || __tmT("task.currentGroup");
        if (!confirm(__tmT("settings.deleteTheGroupThisDoesNotDeleteDocumentsIn", { currentGroupName: currentGroupName }))) return;
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
        try { window.tmCloseTopbarSelects?.(); } catch (e) {}
        try { window.tmRefreshDocGroupTopbarSelects?.('all'); } catch (e) {}
        showSettings();
    };
