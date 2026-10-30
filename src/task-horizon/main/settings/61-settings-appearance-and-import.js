    window.tmRefreshDeviceRecognitionStatus = function() {
        state.settingsActiveTab = 'about';
        showSettings();
    };
    window.tmCopyDeviceRecognitionReport = async function() {
        const text = __tmBuildDeviceRecognitionReportText();
        if (!String(text || '').trim()) {
            hint(__tmT("settings.noDiagnosticContentToCopy"), 'warning');
            return false;
        }
        let ok = false;
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                ok = true;
            }
        } catch (e) {}
        if (!ok) {
            try {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.setAttribute('readonly', 'readonly');
                textarea.style.position = 'fixed';
                textarea.style.left = '-9999px';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                ok = document.execCommand('copy');
                textarea.remove();
            } catch (e) {}
        }
        hint(ok ? __tmT("settings.diagnosticsCopied") : __tmT("settings.copyFailedExpandTheJsonManuallyToCopyIt"), ok ? 'success' : 'error');
        return ok;
    };
    window.tmSwitchSettingsTab = function(tab) {
        __tmFlushSettingsInputs();
        state.settingsV2Page = null;
        state.settingsV2Source = null;
        const prev = state.settingsActiveTab || 'docs';
        if (tab === 'main') {
            state.settingsActiveTab = 'main';
        } else if (tab === 'docs') {
            state.settingsActiveTab = 'docs';
        } else if (tab === 'rules') {
            state.settingsActiveTab = 'rules';
        } else if (tab === 'appearance') {
            state.settingsActiveTab = 'appearance';
        } else if (tab === 'calendar') {
            state.settingsActiveTab = 'calendar';
        } else if (tab === 'ai') {
            state.settingsActiveTab = 'ai';
        } else if (tab === 'quadrant') {
            state.settingsActiveTab = 'quadrant';
        } else if (tab === 'priority') {
            state.priorityScoreDraft = state.priorityScoreDraft || __tmEnsurePriorityDraft();
            state.settingsActiveTab = 'priority';
        } else if (tab === 'benefits') {
            state.settingsActiveTab = 'benefits';
        } else if (tab === 'about') {
            state.settingsActiveTab = 'about';
        } else {
            state.settingsActiveTab = 'docs';
        }
        if ((state.settingsActiveTab || 'docs') === prev && state.settingsModal?.dataset.settingsPage === __tmSettingsV2CurrentPage()) return;
        state.settingsContentScrollTop = 0;
        showSettings();
        if (['priority', 'quadrant'].includes(tab)) window.tmJumpSettingsSection?.(`${tab}-${tab}-algo`);
    };

    // 移除独立的规则管理器弹窗逻辑
    // window.showRulesManager = function() {...}
    // 改为直接跳转到设置页的规则标签
    window.showRulesManager = function() {
        window.tmOpenSettingsV2Page('algo');
        window.tmJumpSettingsSection?.('rules-rules-algo');
    };

    // 渲染列设置（显示/排序/宽度）
    function renderColumnWidthSettings() {
        const availableCols = __tmGetAllColumnDefs();
        const availableKeys = new Set(availableCols.map((col) => String(col?.key || '').trim()).filter(Boolean));
        const seenOrderKeys = new Set();
        let currentOrder = (Array.isArray(SettingsStore.data.columnOrder) ? SettingsStore.data.columnOrder : __tmGetDefaultColumnOrder())
            .map((key) => String(key || '').trim())
            .filter((key) => {
                if (!key || !availableKeys.has(key) || seenOrderKeys.has(key)) return false;
                seenOrderKeys.add(key);
                return true;
            });
        if (!currentOrder.length) currentOrder = __tmGetDefaultColumnOrder().filter((key) => availableKeys.has(key));
        const widths = SettingsStore.data.columnWidths || {};
        const defaultWidths = __tmGetColumnWidthDefaults();

        let html = `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
                <div style="font-size:12px;color:var(--tm-secondary-text);">${__tmT("settings.customColumnsCanAlsoTakePartInDisplayOrdering")}</div>
                <button class="tm-btn tm-btn-secondary" onclick="tmOpenCustomFieldDialog('', { manager: true })" style="padding:4px 10px;font-size:12px;">${__tmT("settings.manageCustomColumns")}</button>
            </div>
            <div class="tm-column-list">
        `;

        // Visible columns
        currentOrder.forEach((key, index) => {
            const colDef = availableCols.find(c => c.key === key) || { key, label: key };
            const isFixedDateColumn = __tmIsFixedDateColumn(key);
            const width = isFixedDateColumn ? __tmGetFixedDateColumnWidth(key) : (widths[key] || defaultWidths[key] || 120);
            const widthControlHtml = isFixedDateColumn
                ? `<span style="flex:1;margin:0 8px;font-size:12px;color:var(--tm-secondary-text);">${__tmT("settings.fixedToDateContent")}</span>`
                : `<input type="range" min="10" max="800" value="${width}" style="flex: 1; margin: 0 8px;" onchange="updateColumnWidth('${key}', parseInt(this.value))" title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.resize")}">`;
            const widthText = isFixedDateColumn ? __tmT("settings.pxFixed", { width: width }) : `${width}px`;

            html += `
                <div class="tm-column-item" ${__tmSettingsSearchAttrs('appearance', __tmT("settings.columns", { value1: colDef.label || key }), __tmT("settings.controlsThisColumnSVisibilityOrderAndWidth"), { section: 'columns', key: `appearance-column-${key}` })} style="display: flex; align-items: center; gap: 8px; padding: 6px; background: var(--tm-input-bg); margin-bottom: 4px; border-radius: 4px;">
                    <input type="checkbox" checked onchange="toggleColumn('${key}', false)" title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.showHide")}">
                    <span style="width: 110px; font-weight: bold; font-size: 13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${esc(colDef.label || key)}">${esc(colDef.label || key)}</span>
                    <div style="display: flex; gap: 2px;">
                        <button class="tm-btn" onclick="moveColumn('${key}', -1)" ${index === 0 ? 'disabled' : ''} style="padding: 2px 6px; font-size: 10px;">↑</button>
                        <button class="tm-btn" onclick="moveColumn('${key}', 1)" ${index === currentOrder.length - 1 ? 'disabled' : ''} style="padding: 2px 6px; font-size: 10px;">↓</button>
                    </div>
                    ${widthControlHtml}
                    <span style="font-size: 12px; width: 70px; text-align: right;">${widthText}</span>
                </div>
            `;
        });

        // Invisible columns
        const hiddenCols = availableCols.filter(c => !currentOrder.includes(c.key));
        if (hiddenCols.length > 0) {
            html += `<div style="margin-top: 12px; font-size: 12px; color: var(--tm-secondary-text); margin-bottom: 4px;">${__tmT("settings.hiddenColumnsCheckToShow")}</div>`;
            hiddenCols.forEach(col => {
                html += `
                    <div class="tm-column-item" ${__tmSettingsSearchAttrs('appearance', __tmT("settings.columns2", { key: col.label || col.key }), __tmT("settings.controlsThisColumnSVisibilityOrderAndWidth"), { section: 'columns', key: `appearance-column-${col.key}` })} style="display: flex; align-items: center; gap: 8px; padding: 6px; opacity: 0.7;">
                        <input type="checkbox" onchange="toggleColumn('${col.key}', true)">
                        <span style="font-size: 13px;">${esc(col.label || col.key)}</span>
                    </div>
                `;
            });
        }

        html += '</div>';
        return html;
    }

    function renderAppearanceColorSettings() {
        const d = SettingsStore.data || {};
        const themeConfig = __tmNormalizeThemeConfig(d.themeConfig);
        const followSiyuan = !!d.enableSiyuanThemeColors;
        const themeDefaultsLight = __tmBuildEffectiveThemeAppearanceDefaults(themeConfig, false);
        const themeDefaultsDark = __tmBuildEffectiveThemeAppearanceDefaults(themeConfig, true);
        const themePaletteLight = __tmBuildEffectiveThemePalette(themeConfig, false);
        const themePaletteDark = __tmBuildEffectiveThemePalette(themeConfig, true);
        const hasImportedTheme = Object.keys(themeConfig.importLight || {}).length > 0;
        const themeSelectValue = themeConfig.source === 'imported' && hasImportedTheme ? '__imported__' : themeConfig.presetId;
        const topbarLight = __tmGetTopbarControlAppearance(false);
        const topbarDark = __tmGetTopbarControlAppearance(true);
        const canEditColor = (key) => !followSiyuan || __tmCanOverrideAppearanceColorWhenFollowingSiyuan(key);
        const colorValue = (key, fallback) => {
            if (!canEditColor(key)) return fallback;
            return d[key] || (followSiyuan ? __tmGetSiyuanFollowAppearanceColorDefault(key, fallback) : fallback);
        };
        const items = [
            {
                title: __tmT("settings.pluginTopBarGradient"),
                rows: [
                    { label: __tmT("settings.lightStart"), key: 'topbarGradientLightStart', value: colorValue('topbarGradientLightStart', themeDefaultsLight.topbarGradientStart) },
                    { label: __tmT("settings.lightEnd"), key: 'topbarGradientLightEnd', value: colorValue('topbarGradientLightEnd', themeDefaultsLight.topbarGradientEnd) },
                    { label: __tmT("settings.darkStart"), key: 'topbarGradientDarkStart', value: colorValue('topbarGradientDarkStart', themeDefaultsDark.topbarGradientStart) },
                    { label: __tmT("settings.darkEnd"), key: 'topbarGradientDarkEnd', value: colorValue('topbarGradientDarkEnd', themeDefaultsDark.topbarGradientEnd) },
                    { label: __tmT("settings.topBarTextLight"), key: 'topbarTextColorLight', value: colorValue('topbarTextColorLight', themeDefaultsLight.topbarTextColor) },
                    { label: __tmT("settings.topBarTextDark"), key: 'topbarTextColorDark', value: colorValue('topbarTextColorDark', themeDefaultsDark.topbarTextColor) }
                ]
            },
            {
                title: __tmT("settings.topBarControlColors"),
                rows: [
                    { label: __tmT("settings.backgroundLight"), key: 'topbarControlBgLight', value: topbarLight.controlBg },
                    { label: __tmT("settings.backgroundDark"), key: 'topbarControlBgDark', value: topbarDark.controlBg },
                    { label: __tmT("settings.textLight"), key: 'topbarControlTextLight', value: topbarLight.controlText },
                    { label: __tmT("settings.textDark"), key: 'topbarControlTextDark', value: topbarDark.controlText },
                    { label: __tmT("settings.borderLight"), key: 'topbarControlBorderLight', value: topbarLight.controlBorder },
                    { label: __tmT("settings.borderDark"), key: 'topbarControlBorderDark', value: topbarDark.controlBorder },
                    { label: __tmT("settings.hoverLight"), key: 'topbarControlHoverLight', value: topbarLight.controlHover },
                    { label: __tmT("settings.hoverDark"), key: 'topbarControlHoverDark', value: topbarDark.controlHover },
                    { label: __tmT("settings.viewSelectorBackgroundLight"), key: 'topbarControlSegmentBgLight', value: topbarLight.segBg },
                    { label: __tmT("settings.viewSelectorBackgroundDark"), key: 'topbarControlSegmentBgDark', value: topbarDark.segBg },
                    { label: __tmT("settings.segmentActiveLight"), key: 'topbarControlSegmentActiveBgLight', value: topbarLight.segActive },
                    { label: __tmT("settings.segmentActiveDark"), key: 'topbarControlSegmentActiveBgDark', value: topbarDark.segActive },
                    { label: __tmT("settings.shadowLight"), key: 'topbarControlShadowColorLight', value: topbarLight.shadowColor },
                    { label: __tmT("settings.shadowDark"), key: 'topbarControlShadowColorDark', value: topbarDark.shadowColor }
                ]
            },
            {
                title: __tmT("settings.taskContentColumnFontColor"),
                rows: [
                    { label: __tmT("settings.light"), key: 'taskContentColorLight', value: colorValue('taskContentColorLight', themeDefaultsLight.taskContentColor) },
                    { label: __tmT("settings.dark"), key: 'taskContentColorDark', value: colorValue('taskContentColorDark', themeDefaultsDark.taskContentColor) }
                ]
            },
            {
                title: __tmT("settings.otherTaskColumnFontColor"),
                rows: [
                    { label: __tmT("settings.light"), key: 'taskMetaColorLight', value: colorValue('taskMetaColorLight', themeDefaultsLight.taskMetaColor) },
                    { label: __tmT("settings.dark"), key: 'taskMetaColorDark', value: colorValue('taskMetaColorDark', themeDefaultsDark.taskMetaColor) }
                ]
            },
            {
                title: __tmT("settings.subtaskProgressBarBackground"),
                rows: [
                    { label: __tmT("settings.light"), key: 'progressBarColorLight', value: colorValue('progressBarColorLight', themeDefaultsLight.progressBarColor) },
                    { label: __tmT("settings.dark"), key: 'progressBarColorDark', value: colorValue('progressBarColorDark', themeDefaultsDark.progressBarColor) }
                ]
            },
            {
                title: __tmT("settings.calendarTodayHighlightColor"),
                rows: [
                    { label: __tmT("settings.light"), key: 'calendarTodayHighlightColorLight', value: colorValue('calendarTodayHighlightColorLight', themeDefaultsLight.calendarTodayHighlightColor) },
                    { label: __tmT("settings.dark"), key: 'calendarTodayHighlightColorDark', value: colorValue('calendarTodayHighlightColorDark', themeDefaultsDark.calendarTodayHighlightColor) }
                ]
            },
            {
                title: __tmT("settings.calendarBorderLineColor"),
                rows: [
                    { label: __tmT("settings.light"), key: 'calendarGridBorderColorLight', value: colorValue('calendarGridBorderColorLight', themeDefaultsLight.calendarGridBorderColor) },
                    { label: __tmT("settings.dark"), key: 'calendarGridBorderColorDark', value: colorValue('calendarGridBorderColorDark', themeDefaultsDark.calendarGridBorderColor) }
                ]
            },
            {
                title: __tmT("settings.tableBorderLineColor"),
                rows: [
                    { label: __tmT("settings.light"), key: 'tableBorderColorLight', value: colorValue('tableBorderColorLight', themeDefaultsLight.tableBorderColor) },
                    { label: __tmT("settings.dark"), key: 'tableBorderColorDark', value: colorValue('tableBorderColorDark', themeDefaultsDark.tableBorderColor) }
                ]
            },
            {
                title: __tmT("settings.groupNameByDocument"),
                rows: [
                    { label: __tmT("settings.light"), key: 'groupDocLabelColorLight', value: colorValue('groupDocLabelColorLight', themeDefaultsLight.groupDocLabelColor) },
                    { label: __tmT("settings.dark"), key: 'groupDocLabelColorDark', value: colorValue('groupDocLabelColorDark', themeDefaultsDark.groupDocLabelColor) }
                ]
            },
            {
                title: __tmT("settings.groupNameByTime"),
                rows: [
                    { label: __tmT("settings.futureBaseColorLight"), key: 'timeGroupBaseColorLight', value: colorValue('timeGroupBaseColorLight', themeDefaultsLight.timeGroupBaseColor) },
                    { label: __tmT("settings.futureBaseColorDark"), key: 'timeGroupBaseColorDark', value: colorValue('timeGroupBaseColorDark', themeDefaultsDark.timeGroupBaseColor) },
                    { label: __tmT("settings.overdueLight"), key: 'timeGroupOverdueColorLight', value: colorValue('timeGroupOverdueColorLight', themeDefaultsLight.timeGroupOverdueColor) },
                    { label: __tmT("settings.overdueDark"), key: 'timeGroupOverdueColorDark', value: colorValue('timeGroupOverdueColorDark', themeDefaultsDark.timeGroupOverdueColor) }
                ]
            },
            {
                title: __tmT("settings.tableViewUnscheduledGroupRowBackground"),
                rows: [
                    { label: __tmT("settings.light"), key: 'timeGroupPendingTaskBgColorLight', value: colorValue('timeGroupPendingTaskBgColorLight', themeDefaultsLight.timeGroupPendingTaskBgColor) },
                    { label: __tmT("settings.dark"), key: 'timeGroupPendingTaskBgColorDark', value: colorValue('timeGroupPendingTaskBgColorDark', themeDefaultsDark.timeGroupPendingTaskBgColor) }
                ]
            }
        ];

        const renderRow = (row) => {
            const raw = __tmNormalizeHexColor(row.value, '#000000') || '#000000';
            const displayValue = __tmFormatColorDisplayValue(raw);
            const disabled = !canEditColor(row.key);
            const disabledAttr = disabled ? __tmT("settings.disabledTitleAutoGeneratedFromTheCurrentThemeWhen") : '';
            const disabledStyle = disabled ? 'opacity:0.68;cursor:not-allowed;' : '';
            return `
                <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 8px;border:1px solid var(--tm-border-color);border-radius:8px;background:var(--tm-bg-color);">
                    <span style="font-size:12px;color:var(--tm-secondary-text);">${esc(row.label)}</span>
                    <button type="button" class="tm-color-btn" data-tm-color-key="${esc(row.key)}" data-tm-color-label="${esc(row.label)}" onclick="tmOpenAppearanceColorPicker(this)" style="${disabledStyle}"${disabledAttr}>
                        <span class="tm-color-swatch" style="background:${esc(raw)}"></span>
                        <span class="tm-color-text">${esc(displayValue)}</span>
                    </button>
                </label>
            `;
        };

        const metrics = [
            { label: __tmT("settings.controlRadius"), key: 'topbarControlRadiusPx', value: topbarLight.radiusPx, min: 0, max: 24 },
            { label: __tmT("settings.borderWidth"), key: 'topbarControlBorderWidthPx', value: topbarLight.borderWidthPx, min: 0, max: 4 },
            { label: __tmT("settings.shadowOffsetY"), key: 'topbarControlShadowYOffsetPx', value: topbarLight.shadowYOffsetPx, min: 0, max: 24 },
            { label: __tmT("settings.shadowBlur"), key: 'topbarControlShadowBlurPx', value: topbarLight.shadowBlurPx, min: 0, max: 48 },
            { label: __tmT("settings.shadowStrength"), key: 'topbarControlShadowStrengthPct', value: topbarLight.shadowStrengthPct, min: 0, max: 200, unit: '%' }
        ];

        const renderMetric = (item) => `
            <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border:1px solid var(--tm-border-color);border-radius:8px;background:var(--tm-bg-color);">
                <span style="font-size:12px;color:var(--tm-secondary-text);">${esc(item.label)}</span>
                <span style="display:inline-flex;align-items:center;gap:8px;">
                    <input
                        type="number"
                        min="${item.min}"
                        max="${item.max}"
                        step="1"
                        value="${Number(item.value) || 0}"
                        onchange="tmUpdateAppearanceMetric('${esc(item.key)}', this.value)"
                        style="width:84px;padding:6px 8px;border:1px solid var(--tm-input-border);border-radius:8px;background:var(--tm-input-bg);color:var(--tm-text-color);font-size:12px;box-sizing:border-box;"
                    >
                    <span style="font-size:12px;color:var(--tm-secondary-text);min-width:28px;text-align:right;">${esc(item.unit || 'px')}</span>
                </span>
            </label>
        `;

        const cards = items.map((it) => `
            <div ${__tmSettingsSearchAttrs('appearance', it.title, __tmT("settings.adjustLightAndDarkColorSchemes"), { section: 'colors', key: `appearance-colors-${it.rows[0].key}` })} style="padding:10px;border:1px solid var(--tm-border-color);border-radius:10px;background:var(--tm-card-bg);">
                <div style="font-weight:600;margin-bottom:10px;">${esc(it.title)}</div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;">
                    ${(it.rows || []).map(renderRow).join('')}
                </div>
            </div>
        `).join('');

        const buildTopbarPreviewBg = (startKey, endKey, defaults) => {
            const startValue = colorValue(startKey, defaults.topbarGradientStart) || defaults.topbarGradientStart;
            const endValue = colorValue(endKey, defaults.topbarGradientEnd) || defaults.topbarGradientEnd;
            if (followSiyuan) return esc(startValue || endValue);
            const start = __tmNormalizeHexColor(startValue, defaults.topbarGradientStart) || defaults.topbarGradientStart;
            const end = __tmNormalizeHexColor(endValue, defaults.topbarGradientEnd) || defaults.topbarGradientEnd;
            return `linear-gradient(135deg, ${esc(start)} 0%, ${esc(end)} 100%)`;
        };
        const previewLight = buildTopbarPreviewBg('topbarGradientLightStart', 'topbarGradientLightEnd', themeDefaultsLight);
        const previewDark = buildTopbarPreviewBg('topbarGradientDarkStart', 'topbarGradientDarkEnd', themeDefaultsDark);
        const themeOptions = __TM_THEME_PRESETS.map((preset) => `<option value="${esc(preset.id)}" ${themeSelectValue === preset.id ? 'selected' : ''}>${esc(preset.name)}</option>`).join('');
        const activeThemeName = followSiyuan
            ? __tmT("settings.siyuanThemeColors")
            : (themeConfig.source === 'imported' && hasImportedTheme ? (themeConfig.importName || 'Custom') : __tmGetThemePresetById(themeConfig.presetId).name);
        const themeControlDisabledAttr = followSiyuan ? ' disabled' : '';
        const themeControlDisabledStyle = followSiyuan ? 'opacity:0.68;cursor:not-allowed;' : '';
        const editableThemeTokens = [
            { key: 'background', label: __tmT("settings.background") },
            { key: 'sidebar', label: __tmT("settings.sidebar") },
            { key: 'card', label: __tmT("settings.card") },
            { key: 'primary', label: __tmT("settings.primary") },
            { key: 'accent', label: __tmT("settings.accent") },
            { key: 'destructive', label: __tmT("settings.danger") },
        ];
        const renderThemeTokenEditor = (token) => {
            const lightValue = __tmNormalizeHexColor(themePaletteLight[token.key], '#000000') || '#000000';
            const darkValue = __tmNormalizeHexColor(themePaletteDark[token.key], '#000000') || '#000000';
            const lightOverridden = !!String(themeConfig.overrideLight?.[token.key] || '').trim();
            const darkOverridden = !!String(themeConfig.overrideDark?.[token.key] || '').trim();
            return `
                <div ${__tmSettingsSearchAttrs('appearance', __tmT("settings.color", { label: token.label }), __tmT("settings.adjustThemeLightAndDarkColorsOverridesCanBe"), { section: 'colors', key: `appearance-theme-token-${token.key}` })} style="padding:10px;border:1px solid var(--tm-border-color);border-radius:10px;background:var(--tm-bg-color);display:flex;flex-direction:column;gap:8px;">
                    <div style="font-size:12px;font-weight:600;color:var(--tm-text-color);">${esc(token.label)}</div>
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                        <span style="font-size:12px;color:var(--tm-secondary-text);">${__tmT("settings.light2", { value1: lightOverridden ? __tmT("settings.overridden") : '' })}</span>
                        <span style="display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;">
                            <button type="button" class="tm-color-btn" onclick="tmOpenThemeTokenPicker('${esc(token.key)}','light')" style="min-width:128px;${themeControlDisabledStyle}"${themeControlDisabledAttr}>
                                <span class="tm-color-swatch" style="background:${esc(lightValue)}"></span>
                                <span class="tm-color-text">${esc(__tmFormatColorDisplayValue(lightValue))}</span>
                            </button>
                            ${lightOverridden ? `<button class="tm-btn tm-btn-gray" onclick="tmClearThemeTokenOverride('${esc(token.key)}','light')" style="padding:4px 8px;font-size:12px;${themeControlDisabledStyle}"${themeControlDisabledAttr}>${__tmT("task.clear")}</button>` : ''}
                        </span>
                    </div>
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                        <span style="font-size:12px;color:var(--tm-secondary-text);">${__tmT("settings.dark2", { value1: darkOverridden ? __tmT("settings.overridden") : '' })}</span>
                        <span style="display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;">
                            <button type="button" class="tm-color-btn" onclick="tmOpenThemeTokenPicker('${esc(token.key)}','dark')" style="min-width:128px;${themeControlDisabledStyle}"${themeControlDisabledAttr}>
                                <span class="tm-color-swatch" style="background:${esc(darkValue)}"></span>
                                <span class="tm-color-text">${esc(__tmFormatColorDisplayValue(darkValue))}</span>
                            </button>
                            ${darkOverridden ? `<button class="tm-btn tm-btn-gray" onclick="tmClearThemeTokenOverride('${esc(token.key)}','dark')" style="padding:4px 8px;font-size:12px;${themeControlDisabledStyle}"${themeControlDisabledAttr}>${__tmT("task.clear")}</button>` : ''}
                        </span>
                    </div>
                </div>
            `;
        };
        const renderThemeSwatches = (palette, label) => `
            <div style="padding:10px;border:1px solid var(--tm-border-color);border-radius:10px;background:var(--tm-card-bg);display:flex;flex-direction:column;gap:8px;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                    <span style="font-size:12px;color:var(--tm-secondary-text);">${esc(label)}</span>
                    <span style="font-size:11px;color:var(--tm-secondary-text);">${esc(activeThemeName)}</span>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <span title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.background")}" style="width:24px;height:24px;border-radius:8px;background:${esc(palette.background)};border:1px solid var(--tm-border-color);"></span>
                    <span title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.card")}" style="width:24px;height:24px;border-radius:8px;background:${esc(palette.card)};border:1px solid var(--tm-border-color);"></span>
                    <span title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.primary")}" style="width:24px;height:24px;border-radius:8px;background:${esc(palette.primary)};border:1px solid var(--tm-border-color);"></span>
                    <span title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.accent")}" style="width:24px;height:24px;border-radius:8px;background:${esc(palette.accent)};border:1px solid var(--tm-border-color);"></span>
                    <span title="${globalThis.__taskHorizonHostBridge.i18n.html("settings.danger")}" style="width:24px;height:24px;border-radius:8px;background:${esc(palette.destructive)};border:1px solid var(--tm-border-color);"></span>
                </div>
            </div>
        `;
        const currentThemeSourceText = followSiyuan
            ? __tmT("settings.siyuanThemeColors")
            : (themeConfig.source === 'imported' && hasImportedTheme ? __tmT("settings.importedTheme", { value1: themeConfig.importName || 'Custom' }) : __tmT("settings.preset", { name: __tmGetThemePresetById(themeConfig.presetId).name }));
        const themeSection = `
            <div style="padding:12px;border:1px solid var(--tm-border-color);border-radius:12px;background:var(--tm-card-bg);margin-bottom:12px;display:flex;flex-direction:column;gap:12px;">
                <label style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px;border:1px solid var(--tm-border-color);border-radius:10px;background:var(--tm-bg-color);">
                    <span style="display:flex;flex-direction:column;gap:4px;">
                        <span style="font-size:13px;color:var(--tm-text-color);font-weight:600;">${__tmT("settings.followSiyuanThemeColors")}</span>
                        <span style="font-size:12px;color:var(--tm-secondary-text);line-height:1.5;">${__tmT("settings.usesTheCurrentSiyuanThemeVariablesWhenOnRestores")}</span>
                    </span>
                    <input class="b3-switch fn__flex-center" type="checkbox" ${followSiyuan ? 'checked' : ''} onchange="tmToggleSiyuanThemeColors(this.checked)">
                </label>
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                    <div>
                        <div style="font-weight:600;">${__tmT("settings.themeScheme")}</div>
                        <div style="margin-top:4px;font-size:12px;color:var(--tm-secondary-text);line-height:1.5;">${__tmT("settings.supportsBuiltInPresetsAndTweakcnShadcnCssVariable")}<a href="${esc(__TM_TWEAKCN_URL)}" target="_blank" rel="noopener noreferrer" style="margin-left:6px;color:var(--tm-primary-color);text-decoration:none;">${__tmT("settings.openTweakcn")}</a></div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <select class="tm-rule-select" aria-label="${globalThis.__taskHorizonHostBridge.i18n.html("settings.themeScheme")}" onchange="tmSelectAppearanceTheme(this.value)" style="min-width:180px;${themeControlDisabledStyle}"${themeControlDisabledAttr}>
                            ${themeOptions}
                            ${hasImportedTheme ? `<option value="__imported__" ${themeSelectValue === '__imported__' ? 'selected' : ''}>${__tmT("settings.importedTheme2", { value1: esc(themeConfig.importName || 'Custom') })}</option>` : ''}
                        </select>
                        <button class="tm-btn tm-btn-gray" type="button" onclick="window.open('${esc(__TM_TWEAKCN_URL)}', '_blank', 'noopener,noreferrer')" style="padding:4px 10px;font-size:12px;${themeControlDisabledStyle}"${themeControlDisabledAttr}>${__tmT("settings.visitTweakcn")}</button>
                        <button class="tm-btn tm-btn-info" onclick="tmOpenThemeImportDialog()" style="padding:4px 10px;font-size:12px;${themeControlDisabledStyle}"${themeControlDisabledAttr}>${__tmT("settings.importTweakcn")}</button>
                        ${hasImportedTheme ? `<button class="tm-btn tm-btn-gray" onclick="tmClearImportedTheme()" style="padding:4px 10px;font-size:12px;${themeControlDisabledStyle}"${themeControlDisabledAttr}>${__tmT("settings.removeImport")}</button>` : ''}
                        <button class="tm-btn tm-btn-gray" onclick="tmResetThemeOverrides()" style="padding:4px 10px;font-size:12px;${themeControlDisabledStyle}"${themeControlDisabledAttr}>${__tmT("settings.resetCurrentTheme")}</button>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">
                    ${renderThemeSwatches(themePaletteLight, __tmT("settings.lightPreview"))}
                    ${renderThemeSwatches(themePaletteDark, __tmT("settings.darkPreview"))}
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;">
                    ${editableThemeTokens.map(renderThemeTokenEditor).join('')}
                </div>
                <div style="font-size:12px;color:var(--tm-secondary-text);line-height:1.5;">${__tmT("settings.currentSource", { currentThemeSourceText: esc(currentThemeSourceText) })}</div>
            </div>
        `;

        return `
            ${themeSection}
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px;">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <span style="font-size:12px;color:var(--tm-secondary-text);">${__tmT("settings.previewLight")}</span>
                    <div id="tmAppearancePreviewLight" style="width:180px;height:22px;border-radius:8px;background:${previewLight};border:1px solid rgba(0,0,0,0.06);"></div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <span style="font-size:12px;color:var(--tm-secondary-text);">${__tmT("settings.previewDark")}</span>
                    <div id="tmAppearancePreviewDark" style="width:180px;height:22px;border-radius:8px;background:${previewDark};border:1px solid rgba(0,0,0,0.06);"></div>
                </div>
            </div>
            <div style="padding:10px;border:1px solid var(--tm-border-color);border-radius:10px;background:var(--tm-card-bg);margin-bottom:12px;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px;">
                    <div style="font-weight:600;">${__tmT("settings.topBarControlStyle")}</div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;">
                    ${metrics.map(renderMetric).join('')}
                </div>
            </div>
            <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border:1px solid var(--tm-border-color);border-radius:10px;background:var(--tm-card-bg);margin-bottom:12px;">
                <span style="font-size:12px;color:var(--tm-secondary-text);">${__tmT("settings.useGroupColorsForTaskRowBackgroundsWithinGroups")}</span>
                <input class="b3-switch fn__flex-center" type="checkbox" ${d.enableGroupTaskBgByGroupColor ? 'checked' : ''} onchange="tmToggleGroupTaskBgByGroupColor(this.checked)">
            </label>
            <label style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:10px;border:1px solid var(--tm-border-color);border-radius:10px;background:var(--tm-card-bg);margin-bottom:12px;">
                <span style="display:flex;flex-direction:column;gap:4px;">
                    <span style="font-size:13px;color:var(--tm-text-color);font-weight:600;">${__tmT("settings.priorityIconStyle")}</span>
                    <span style="font-size:12px;color:var(--tm-secondary-text);">${__tmT("settings.switchThePriorityIconStyleJiraStyleOrFlag")}</span>
                </span>
                <select class="tm-rule-select" onchange="tmUpdatePriorityIconStyle(this.value)" style="min-width:180px;">
                    <option value="jira" ${__tmNormalizePriorityIconStyle(d.priorityIconStyle) === 'jira' ? 'selected' : ''}>${__tmT("settings.jiraStyle")}</option>
                    <option value="flag" ${__tmNormalizePriorityIconStyle(d.priorityIconStyle) === 'flag' ? 'selected' : ''}>${__tmT("settings.flagStyle")}</option>
                </select>
            </label>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;">
                ${cards}
            </div>
            <div style="margin-top:10px;font-size:12px;color:var(--tm-secondary-text);line-height:1.5;">${__tmT("settings.theColorButtonsAboveActAsTweakOverridesFor")}</div>
        `;
    }

    window.tmOpenAppearanceColorPicker = function(el) {
        const btn = el && el.nodeType === 1 ? el : null;
        const k = String(btn?.dataset?.tmColorKey || '').trim();
        const label = String(btn?.dataset?.tmColorLabel || __tmT("task.pickAColor")).trim() || __tmT("task.pickAColor");
        if (!k) return;
        if (__tmIsSiyuanThemeColorsEnabled() && !__tmCanOverrideAppearanceColorWhenFollowingSiyuan(k)) {
            hint(__tmT("settings.colorsAreGeneratedFromTheCurrentThemeWhenFollowing"), 'info');
            return;
        }
        const themeDefaultsLight = __tmBuildThemeAppearanceDefaults(SettingsStore.data?.themeConfig, false);
        const themeDefaultsDark = __tmBuildThemeAppearanceDefaults(SettingsStore.data?.themeConfig, true);
        const topbarLight = __tmGetTopbarControlAppearance(false);
        const topbarDark = __tmGetTopbarControlAppearance(true);
        const defaults = {
            topbarGradientLightStart: themeDefaultsLight.topbarGradientStart,
            topbarGradientLightEnd: themeDefaultsLight.topbarGradientEnd,
            topbarGradientDarkStart: themeDefaultsDark.topbarGradientStart,
            topbarGradientDarkEnd: themeDefaultsDark.topbarGradientEnd,
            topbarTextColorLight: themeDefaultsLight.topbarTextColor,
            topbarTextColorDark: themeDefaultsDark.topbarTextColor,
            topbarControlBgLight: topbarLight.controlBg,
            topbarControlBgDark: topbarDark.controlBg,
            topbarControlTextLight: topbarLight.controlText,
            topbarControlTextDark: topbarDark.controlText,
            topbarControlBorderLight: topbarLight.controlBorder,
            topbarControlBorderDark: topbarDark.controlBorder,
            topbarControlHoverLight: topbarLight.controlHover,
            topbarControlHoverDark: topbarDark.controlHover,
            topbarControlSegmentBgLight: topbarLight.segBg,
            topbarControlSegmentBgDark: topbarDark.segBg,
            topbarControlSegmentActiveBgLight: topbarLight.segActive,
            topbarControlSegmentActiveBgDark: topbarDark.segActive,
            topbarControlShadowColorLight: topbarLight.shadowColor,
            topbarControlShadowColorDark: topbarDark.shadowColor,
            taskContentColorLight: themeDefaultsLight.taskContentColor,
            taskContentColorDark: themeDefaultsDark.taskContentColor,
            taskMetaColorLight: themeDefaultsLight.taskMetaColor,
            taskMetaColorDark: themeDefaultsDark.taskMetaColor,
            groupDocLabelColorLight: themeDefaultsLight.groupDocLabelColor,
            groupDocLabelColorDark: themeDefaultsDark.groupDocLabelColor,
            timeGroupBaseColorLight: themeDefaultsLight.timeGroupBaseColor,
            timeGroupBaseColorDark: themeDefaultsDark.timeGroupBaseColor,
            timeGroupOverdueColorLight: themeDefaultsLight.timeGroupOverdueColor,
            timeGroupOverdueColorDark: themeDefaultsDark.timeGroupOverdueColor,
            timeGroupPendingTaskBgColorLight: themeDefaultsLight.timeGroupPendingTaskBgColor,
            timeGroupPendingTaskBgColorDark: themeDefaultsDark.timeGroupPendingTaskBgColor,
            progressBarColorLight: themeDefaultsLight.progressBarColor,
            progressBarColorDark: themeDefaultsDark.progressBarColor,
            calendarTodayHighlightColorLight: themeDefaultsLight.calendarTodayHighlightColor,
            calendarTodayHighlightColorDark: themeDefaultsDark.calendarTodayHighlightColor,
            calendarGridBorderColorLight: themeDefaultsLight.calendarGridBorderColor,
            calendarGridBorderColorDark: themeDefaultsDark.calendarGridBorderColor,
            tableBorderColorLight: themeDefaultsLight.tableBorderColor,
            tableBorderColorDark: themeDefaultsDark.tableBorderColor
        };
        const defaultColor = __tmIsSiyuanThemeColorsEnabled()
            ? __tmGetSiyuanFollowAppearanceColorDefault(k, defaults[k] || '#f44336')
            : (defaults[k] || '#f44336');
        const initial = __tmNormalizeHexColor(SettingsStore.data[k], defaultColor) || defaultColor;
        __tmOpenColorPickerDialog(label, initial, (next) => {
            tmUpdateAppearanceColor(k, next);
        }, { defaultColor });
    };

    window.tmUpdateAppearanceColor = async function(key, value) {
        const allowed = new Set([
            'topbarGradientLightStart', 'topbarGradientLightEnd', 'topbarGradientDarkStart', 'topbarGradientDarkEnd',
            'topbarTextColorLight', 'topbarTextColorDark',
            'topbarControlBgLight', 'topbarControlBgDark',
            'topbarControlTextLight', 'topbarControlTextDark',
            'topbarControlBorderLight', 'topbarControlBorderDark',
            'topbarControlHoverLight', 'topbarControlHoverDark',
            'topbarControlSegmentBgLight', 'topbarControlSegmentBgDark',
            'topbarControlSegmentActiveBgLight', 'topbarControlSegmentActiveBgDark',
            'topbarControlShadowColorLight', 'topbarControlShadowColorDark',
            'taskContentColorLight', 'taskContentColorDark',
            'taskMetaColorLight', 'taskMetaColorDark',
            'groupDocLabelColorLight', 'groupDocLabelColorDark',
            'timeGroupBaseColorLight', 'timeGroupBaseColorDark',
            'timeGroupOverdueColorLight', 'timeGroupOverdueColorDark',
            'timeGroupPendingTaskBgColorLight', 'timeGroupPendingTaskBgColorDark',
            'progressBarColorLight', 'progressBarColorDark',
            'calendarTodayHighlightColorLight', 'calendarTodayHighlightColorDark',
            'calendarGridBorderColorLight', 'calendarGridBorderColorDark',
            'tableBorderColorLight', 'tableBorderColorDark'
        ]);
        const k = String(key || '').trim();
        if (!allowed.has(k)) return;
        if (__tmIsSiyuanThemeColorsEnabled() && !__tmCanOverrideAppearanceColorWhenFollowingSiyuan(k)) {
            hint(__tmT("settings.colorsAreGeneratedFromTheCurrentThemeWhenFollowing"), 'info');
            return;
        }
        const v = __tmNormalizeHexColor(value, '');
        if (!v) return;
        SettingsStore.data[k] = v;
        await SettingsStore.save();
        try { __tmApplyAppearanceThemeVars(); } catch (e) {}
        try {
            const buttons = Array.from(document.querySelectorAll(`[data-tm-color-key="${k}"]`));
            buttons.forEach((b) => {
                const sw = b.querySelector?.('.tm-color-swatch');
                const tx = b.querySelector?.('.tm-color-text');
                try { if (sw) sw.style.background = v; } catch (e) {}
                try { if (tx) tx.textContent = __tmFormatColorDisplayValue(v); } catch (e) {}
            });
        } catch (e) {}
        try {
            const d = SettingsStore.data || {};
            const themeDefaultsLight = __tmBuildThemeAppearanceDefaults(d.themeConfig, false);
            const themeDefaultsDark = __tmBuildThemeAppearanceDefaults(d.themeConfig, true);
            const p1 = document.getElementById('tmAppearancePreviewLight');
            const p2 = document.getElementById('tmAppearancePreviewDark');
            const previewLight = `linear-gradient(135deg, ${__tmNormalizeHexColor(d.topbarGradientLightStart, themeDefaultsLight.topbarGradientStart) || themeDefaultsLight.topbarGradientStart} 0%, ${__tmNormalizeHexColor(d.topbarGradientLightEnd, themeDefaultsLight.topbarGradientEnd) || themeDefaultsLight.topbarGradientEnd} 100%)`;
            const previewDark = `linear-gradient(135deg, ${__tmNormalizeHexColor(d.topbarGradientDarkStart, themeDefaultsDark.topbarGradientStart) || themeDefaultsDark.topbarGradientStart} 0%, ${__tmNormalizeHexColor(d.topbarGradientDarkEnd, themeDefaultsDark.topbarGradientEnd) || themeDefaultsDark.topbarGradientEnd} 100%)`;
            if (p1) p1.style.background = previewLight;
            if (p2) p2.style.background = previewDark;
        } catch (e) {}
        render();
    };

    window.tmUpdateAppearanceMetric = async function(key, value) {
        const configs = {
            topbarControlRadiusPx: { min: 0, max: 24, fallback: 10 },
            topbarControlBorderWidthPx: { min: 0, max: 4, fallback: 1 },
            topbarControlShadowYOffsetPx: { min: 0, max: 24, fallback: 0 },
            topbarControlShadowBlurPx: { min: 0, max: 48, fallback: 0 },
            topbarControlShadowStrengthPct: { min: 0, max: 200, fallback: 100 },
        };
        const k = String(key || '').trim();
        const conf = configs[k];
        if (!conf) return;
        SettingsStore.data[k] = __tmNormalizeAppearanceMetric(value, conf.fallback, conf.min, conf.max);
        await SettingsStore.save();
        try { __tmApplyAppearanceThemeVars(); } catch (e) {}
        if (state.settingsModal) showSettings();
        render();
    };

    window.updateKanbanDragSyncSubtasks = async function(enabled) {
        SettingsStore.data.kanbanDragSyncSubtasks = !!enabled;
        await SettingsStore.save();
        render();
    };

    window.updateKanbanPreventSubtaskSeparation = async function(enabled) {
        SettingsStore.data.kanbanPreventSubtaskSeparation = !!enabled;
        await SettingsStore.save();
        render();
    };

    window.tmToggleGroupTaskBgByGroupColor = async function(enabled) {
        SettingsStore.data.enableGroupTaskBgByGroupColor = !!enabled;
        await SettingsStore.save();
        render();
    };

    window.tmToggleSiyuanThemeColors = async function(enabled) {
        SettingsStore.data.enableSiyuanThemeColors = !!enabled;
        await SettingsStore.save();
        try { __tmClearThemeColorRuntimeCaches(); } catch (e) {}
        try { __tmApplyAppearanceThemeVars(); } catch (e) {}
        if (state.settingsModal) showSettings();
        render();
    };

    window.tmUpdatePriorityIconStyle = async function(value) {
        SettingsStore.data.priorityIconStyle = __tmNormalizePriorityIconStyle(value);
        await SettingsStore.save();
        if (state.settingsModal) showSettings();
        render();
    };

    window.tmToggleTimelineForceSortByCompletionNearToday = async function(enabled) {
        SettingsStore.data.timelineForceSortByCompletionNearToday = !!enabled;
        await SettingsStore.save();
        render();
    };

    window.tmUpdateTimelineDependencyScope = async function(value) {
        SettingsStore.data.timelineDependencyScope = __tmNormalizeTimelineDependencyScope(value);
        await SettingsStore.save();
        try { state.__tmTimelineRenderDeps?.(); } catch (e) {}
        render();
    };

    window.updateGroupSortByBestSubtaskTimeInTimeQuadrant = async function(enabled) {
        SettingsStore.data.groupSortByBestSubtaskTimeInTimeQuadrant = !!enabled;
        await SettingsStore.save();
        render();
    };

    window.updatePinTasksWithinGroups = async function(enabled) {
        SettingsStore.data.pinTasksWithinGroups = !!enabled;
        await SettingsStore.save();
        render();
    };

    window.updateCompletedTasksTodayOnly = async function(enabled) {
        SettingsStore.data.completedTasksTodayOnly = !!enabled;
        await SettingsStore.save();
        state.listRenderSignature = '';
        if (state.settingsModal) showSettings();
        render();
    };

    window.updateCompletedTasksInlineInGroups = async function(enabled) {
        SettingsStore.data.completedTasksInlineInGroups = !!enabled;
        await SettingsStore.save();
        state.listRenderSignature = '';
        if (state.settingsModal) showSettings();
        render();
    };

    window.updateCompletedTasksGroupBy = async function(value) {
        SettingsStore.data.completedTasksGroupBy = __tmNormalizeCompletedTasksGroupBy(value);
        await SettingsStore.save();
        state.listRenderSignature = '';
        state.listDomRenderSignature = '';
        try { __tmRecomputeTaskProjection({ reason: 'completed-tasks-group-by' }); } catch (e) {}
        if (state.settingsModal) showSettings();
        render();
    };

    window.updateCollapseAllIncludesGroups = async function(enabled) {
        SettingsStore.data.collapseAllIncludesGroups = !!enabled;
        await SettingsStore.save();
        if (state.settingsModal) showSettings();
    };

    window.updateServerSyncOnManualRefresh = async function(enabled) {
        SettingsStore.data.serverSyncOnManualRefresh = !!enabled;
        await SettingsStore.save();
        if (state.settingsModal) showSettings();
    };

    window.updateServerSyncSessionStateOnManualRefresh = async function(enabled) {
        SettingsStore.data.serverSyncSessionStateOnManualRefresh = !!enabled;
        await SettingsStore.save();
        if (state.settingsModal) showSettings();
    };

    window.tmSelectAppearanceTheme = async function(value) {
        if (__tmIsSiyuanThemeColorsEnabled()) {
            hint(__tmT("settings.colorsAreGeneratedFromTheCurrentThemeWhenFollowing"), 'info');
            showSettings();
            return;
        }
        const next = String(value || '').trim();
        const current = __tmNormalizeThemeConfig(SettingsStore.data?.themeConfig);
        if (next === '__imported__') {
            if (!Object.keys(current.importLight || {}).length) return;
            current.source = 'imported';
        } else {
            current.source = 'preset';
            current.presetId = __tmGetThemePresetById(next).id;
        }
        SettingsStore.data.themeConfig = current;
        __tmApplyThemeConfigToAppearanceFields(current);
        await SettingsStore.save();
        try { __tmApplyAppearanceThemeVars(); } catch (e) {}
        if (state.settingsModal) showSettings();
        render();
    };

    window.tmOpenThemeTokenPicker = function(tokenKey, mode) {
        if (__tmIsSiyuanThemeColorsEnabled()) {
            hint(__tmT("settings.colorsAreGeneratedFromTheCurrentThemeWhenFollowing"), 'info');
            return;
        }
        const key = __tmNormalizeThemeTokenKey(tokenKey);
        const resolvedMode = String(mode || '').trim() === 'dark' ? 'dark' : 'light';
        if (!key) return;
        const config = __tmNormalizeThemeConfig(SettingsStore.data?.themeConfig);
        const palette = __tmBuildThemePalette(config, resolvedMode === 'dark');
        const current = __tmNormalizeHexColor(palette[key], '#000000') || '#000000';
        const label = `${key} ${resolvedMode === 'dark' ? __tmT("settings.dark") : __tmT("settings.light")}`;
        __tmOpenColorPickerDialog(label, current, (next) => {
            tmUpdateThemeTokenOverride(key, resolvedMode, next);
        }, { defaultColor: current });
    };

    window.tmUpdateThemeTokenOverride = async function(tokenKey, mode, value) {
        if (__tmIsSiyuanThemeColorsEnabled()) {
            hint(__tmT("settings.colorsAreGeneratedFromTheCurrentThemeWhenFollowing"), 'info');
            return;
        }
        const key = __tmNormalizeThemeTokenKey(tokenKey);
        const resolvedMode = String(mode || '').trim() === 'dark' ? 'dark' : 'light';
        const nextValue = __tmNormalizeHexColor(value, '');
        if (!key || !nextValue) return;
        const config = __tmNormalizeThemeConfig(SettingsStore.data?.themeConfig);
        const targetKey = resolvedMode === 'dark' ? 'overrideDark' : 'overrideLight';
        const target = { ...(config[targetKey] || {}) };
        target[key] = nextValue;
        config[targetKey] = __tmNormalizeThemeTokenMap(target);
        SettingsStore.data.themeConfig = config;
        __tmApplyThemeConfigToAppearanceFields(config);
        await SettingsStore.save();
        try { __tmApplyAppearanceThemeVars(); } catch (e) {}
        if (state.settingsModal) showSettings();
        render();
    };

    window.tmClearThemeTokenOverride = async function(tokenKey, mode) {
        if (__tmIsSiyuanThemeColorsEnabled()) {
            hint(__tmT("settings.colorsAreGeneratedFromTheCurrentThemeWhenFollowing"), 'info');
            return;
        }
        const key = __tmNormalizeThemeTokenKey(tokenKey);
        const resolvedMode = String(mode || '').trim() === 'dark' ? 'dark' : 'light';
        if (!key) return;
        const config = __tmNormalizeThemeConfig(SettingsStore.data?.themeConfig);
        const targetKey = resolvedMode === 'dark' ? 'overrideDark' : 'overrideLight';
        const target = { ...(config[targetKey] || {}) };
        delete target[key];
        config[targetKey] = __tmNormalizeThemeTokenMap(target);
        SettingsStore.data.themeConfig = config;
        __tmApplyThemeConfigToAppearanceFields(config);
        await SettingsStore.save();
        try { __tmApplyAppearanceThemeVars(); } catch (e) {}
        if (state.settingsModal) showSettings();
        render();
    };

    window.tmResetThemeOverrides = async function() {
        if (__tmIsSiyuanThemeColorsEnabled()) {
            hint(__tmT("settings.colorsAreGeneratedFromTheCurrentThemeWhenFollowing"), 'info');
            showSettings();
            return;
        }
        const config = __tmNormalizeThemeConfig(SettingsStore.data?.themeConfig);
        config.overrideLight = {};
        config.overrideDark = {};
        SettingsStore.data.themeConfig = config;
        __tmApplyThemeConfigToAppearanceFields(config);
        await SettingsStore.save();
        try { __tmApplyAppearanceThemeVars(); } catch (e) {}
        if (state.settingsModal) showSettings();
        render();
    };

    window.tmClearImportedTheme = async function() {
        if (__tmIsSiyuanThemeColorsEnabled()) {
            hint(__tmT("settings.colorsAreGeneratedFromTheCurrentThemeWhenFollowing"), 'info');
            showSettings();
            return;
        }
        const next = __tmNormalizeThemeConfig(SettingsStore.data?.themeConfig);
        next.source = 'preset';
        next.importName = '';
        next.importLight = {};
        next.importDark = {};
        next.overrideLight = {};
        next.overrideDark = {};
        SettingsStore.data.themeConfig = next;
        __tmApplyThemeConfigToAppearanceFields(next);
        await SettingsStore.save();
        try { __tmApplyAppearanceThemeVars(); } catch (e) {}
        if (state.settingsModal) showSettings();
        render();
    };

    function __tmTickTickNormalizeHeaderName(name) {
        return String(name || '')
            .replace(/^\uFEFF/, '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '');
    }

    function __tmParseCsvRows(text) {
        const source = String(text || '').replace(/^\uFEFF/, '');
        if (!source) return [];
        const rows = [];
        let row = [];
        let field = '';
        let inQuotes = false;
        for (let i = 0; i < source.length; i += 1) {
            const ch = source[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (source[i + 1] === '"') {
                        field += '"';
                        i += 1;
                    } else {
                        inQuotes = false;
                    }
                    continue;
                }
                field += ch;
                continue;
            }
            if (ch === '"') {
                inQuotes = true;
                continue;
            }
            if (ch === ',') {
                row.push(field);
                field = '';
                continue;
            }
            if (ch === '\r') {
                row.push(field);
                field = '';
                rows.push(row);
                row = [];
                if (source[i + 1] === '\n') i += 1;
                continue;
            }
            if (ch === '\n') {
                row.push(field);
                field = '';
                rows.push(row);
                row = [];
                continue;
            }
            field += ch;
        }
        row.push(field);
        rows.push(row);
        while (rows.length > 0) {
            const last = rows[rows.length - 1];
            if (Array.isArray(last) && last.some((cell) => String(cell || '').trim())) break;
            rows.pop();
        }
        return rows;
    }

    function __tmFindTickTickHeaderRowIndex(rows) {
        const list = Array.isArray(rows) ? rows : [];
        for (let i = 0; i < list.length; i += 1) {
            const normalized = (Array.isArray(list[i]) ? list[i] : []).map(__tmTickTickNormalizeHeaderName);
            if (normalized.includes('listname') && normalized.includes('title') && normalized.includes('status')) {
                return i;
            }
        }
        return -1;
    }

    function __tmBuildTickTickCsvCellGetter(headerRow) {
        const header = Array.isArray(headerRow) ? headerRow : [];
        const indexMap = new Map();
        header.forEach((cell, idx) => {
            const key = __tmTickTickNormalizeHeaderName(cell);
            if (key && !indexMap.has(key)) indexMap.set(key, idx);
        });
        return function getCell(row, aliases) {
            const source = Array.isArray(row) ? row : [];
            const names = Array.isArray(aliases) ? aliases : [aliases];
            for (const alias of names) {
                const key = __tmTickTickNormalizeHeaderName(alias);
                if (!key || !indexMap.has(key)) continue;
                return String(source[indexMap.get(key)] ?? '').trim();
            }
            return '';
        };
    }

    function __tmTickTickParseNumericField(value) {
        const text = String(value || '').trim();
        const match = text.match(/-?\d+/);
        return match ? Number(match[0]) : Number.NaN;
    }

    function __tmTickTickNormalizeTaskTitle(text) {
        return String(text || '').replace(/\s+/g, ' ').trim();
    }

    function __tmTickTickNormalizeTimezone(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        try {
            Intl.DateTimeFormat('en-US', { timeZone: raw }).format(new Date());
            return raw;
        } catch (e) {
            return '';
        }
    }

    function __tmTickTickFormatDateOnly(date, timezone) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        const tz = __tmTickTickNormalizeTimezone(timezone)
            || (() => {
                try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; }
            })()
            || 'UTC';
        try {
            const parts = new Intl.DateTimeFormat('en-CA', {
                timeZone: tz,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            }).formatToParts(date);
            const get = (type) => String(parts.find((item) => item.type === type)?.value || '').trim();
            const year = get('year');
            const month = get('month');
            const day = get('day');
            if (year && month && day) return `${year}-${month}-${day}`;
        } catch (e) {}
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function __tmTickTickParseDateOnly(value, timezone, options = {}) {
        const text = String(value || '').trim();
        if (!text) return '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
        const opts = (options && typeof options === 'object') ? options : {};
        if (opts.floating === true) {
            const floatingMatch = text.match(/^(\d{4}-\d{2}-\d{2})/);
            if (floatingMatch) return floatingMatch[1];
        }
        const normalized = text.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
        const parsed = new Date(normalized);
        if (!Number.isNaN(parsed.getTime())) {
            return __tmTickTickFormatDateOnly(parsed, timezone);
        }
        const fallbackMatch = text.match(/^(\d{4}-\d{2}-\d{2})/);
        return fallbackMatch ? fallbackMatch[1] : '';
    }

    function __tmTickTickParseChecklistContent(content) {
        const source = String(content || '').replace(/\r\n?/g, '\n');
        if (!source.trim()) return { remark: '', inlineSubtasks: [] };
        const inlineSubtasks = [];
        source.split('\n').forEach((line) => {
            const pieces = String(line || '')
                .split(/(?=[▪▫•●·]\s*)/g)
                .map((item) => String(item || '').trim())
                .filter(Boolean);
            const targets = pieces.length ? pieces : [String(line || '').trim()];
            targets.forEach((item) => {
                const normalized = String(item || '')
                    .replace(/^[▪▫•●·]\s*/, '')
                    .replace(/^[-*+]\s*/, '')
                    .replace(/^(?:\[[ xX]\]|[xX])\s*/, '')
                    .trim();
                const title = __tmTickTickNormalizeTaskTitle(normalized);
                if (title) inlineSubtasks.push(title);
            });
        });
        return {
            remark: '',
            inlineSubtasks,
        };
    }

    function __tmTickTickParseTagsCell(value) {
        const source = String(value || '').trim();
        if (!source) return [];
        const out = [];
        const seen = new Set();
        source.split(/\s*[,，]\s*/).forEach((item) => {
            const tag = String(item || '').trim();
            if (!tag || seen.has(tag)) return;
            seen.add(tag);
            out.push(tag);
        });
        return out;
    }

    function __tmTickTickMapPriority(value) {
        const raw = __tmTickTickParseNumericField(value);
        if (raw >= 5) return 'high';
        if (raw >= 3) return 'medium';
        if (raw >= 1) return 'low';
        return '';
    }

    function __tmNormalizeTickTickImportOptions(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        return {
            includeCompleted: opts.includeCompleted === true,
            includeArchived: opts.includeArchived === true,
            docConcurrency: Math.max(1, Math.min(6, Number(opts.docConcurrency) || 3)),
        };
    }

    function __tmBuildTickTickImportModel(csvText, options = {}) {
        const importOptions = __tmNormalizeTickTickImportOptions(options);
        const rows = __tmParseCsvRows(csvText);
        if (!rows.length) throw new Error(__tmT("settings.theCsvFileIsEmpty"));
        const headerRowIndex = __tmFindTickTickHeaderRowIndex(rows);
        if (headerRowIndex < 0) throw new Error(__tmT("settings.couldNotRecognizeTheTicktickCsvHeaderMakeSure"));
        const getCell = __tmBuildTickTickCsvCellGetter(rows[headerRowIndex]);
        const entries = [];
        let skippedCompleted = 0;
        let skippedArchived = 0;
        let skippedOtherStatus = 0;
        let skippedBlankTitle = 0;
        let pendingTasks = 0;
        let completedTasks = 0;
        let archivedTasks = 0;
        const tagNames = [];
        const tagSeen = new Set();
        const rememberTags = (tags) => {
            (Array.isArray(tags) ? tags : []).forEach((tag) => {
                const name = String(tag || '').trim();
                if (!name || tagSeen.has(name)) return;
                tagSeen.add(name);
                tagNames.push(name);
            });
        };
        for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
            const row = Array.isArray(rows[i]) ? rows[i] : [];
            if (!row.some((cell) => String(cell || '').trim())) continue;
            const title = __tmTickTickNormalizeTaskTitle(getCell(row, 'Title'));
            if (!title) {
                skippedBlankTitle += 1;
                continue;
            }
            const status = __tmTickTickParseNumericField(getCell(row, 'Status'));
            const isCompleted = status === 1;
            const isArchived = status === 2;
            const isDone = isCompleted || isArchived;
            const shouldInclude = status === 0
                || (isCompleted && importOptions.includeCompleted)
                || (isArchived && importOptions.includeArchived);
            if (!shouldInclude) {
                if (isCompleted) skippedCompleted += 1;
                else if (isArchived) skippedArchived += 1;
                else skippedOtherStatus += 1;
                continue;
            }
            if (status === 0) pendingTasks += 1;
            else if (isCompleted) completedTasks += 1;
            else if (isArchived) archivedTasks += 1;
            const kind = String(getCell(row, 'Kind')).trim().toLowerCase();
            const timezone = getCell(row, ['Timezone', 'Time Zone']);
            const floating = /^true$/i.test(getCell(row, ['Is Floating', 'IsFloating']));
            const rawContent = getCell(row, 'Content');
            const checklistInfo = kind === 'checklist'
                ? __tmTickTickParseChecklistContent(rawContent)
                : {
                    remark: __tmNormalizeRemarkMarkdown(rawContent || ''),
                    inlineSubtasks: [],
                };
            const sourceTaskId = getCell(row, ['taskId', 'Task ID']);
            const parentSourceId = getCell(row, ['parentId', 'Parent ID']);
            const tags = __tmTickTickParseTagsCell(getCell(row, 'Tags'));
            rememberTags(tags);
            entries.push({
                internalId: sourceTaskId || `__row_${i}`,
                sourceTaskId,
                parentSourceId,
                order: entries.length,
                folderName: getCell(row, ['Folder Name', 'FolderName']),
                docName: getCell(row, ['List Name', 'ListName']) || __tmT("settings.untitledList"),
                headingName: getCell(row, ['Column Name', 'ColumnName']),
                title,
                done: isDone,
                sourceStatus: status,
                kind,
                priority: __tmTickTickMapPriority(getCell(row, 'Priority')),
                startDate: __tmTickTickParseDateOnly(getCell(row, ['Start Date', 'StartDate']), timezone, { floating }),
                completionTime: __tmTickTickParseDateOnly(getCell(row, ['Due Date', 'DueDate']), timezone, { floating }),
                remark: checklistInfo.remark,
                inlineSubtasks: checklistInfo.inlineSubtasks,
                tags,
                children: [],
            });
        }
        const bySourceId = new Map();
        entries.forEach((entry) => {
            const key = String(entry?.sourceTaskId || '').trim();
            if (key && !bySourceId.has(key)) bySourceId.set(key, entry);
        });
        const roots = [];
        let orphanSubtasks = 0;
        entries.forEach((entry) => {
            const parentKey = String(entry?.parentSourceId || '').trim();
            if (!parentKey || parentKey === String(entry?.sourceTaskId || '').trim()) {
                roots.push(entry);
                return;
            }
            const parent = bySourceId.get(parentKey);
            if (!parent) {
                orphanSubtasks += 1;
                roots.push(entry);
                return;
            }
            parent.children.push(entry);
        });
        const buildImportTask = (entry, seen = new Set()) => {
            const key = String(entry?.internalId || '').trim();
            if (!entry || seen.has(key)) return null;
            const nextSeen = new Set(seen);
            if (key) nextSeen.add(key);
            const explicitChildren = (Array.isArray(entry.children) ? entry.children : [])
                .sort((a, b) => Number(a?.order) - Number(b?.order))
                .map((child) => buildImportTask(child, nextSeen))
                .filter(Boolean);
            const inlineChildren = (Array.isArray(entry.inlineSubtasks) ? entry.inlineSubtasks : [])
                .map((title, idx) => ({
                    internalId: `${key || 'inline'}:inline:${idx}`,
                    title: __tmTickTickNormalizeTaskTitle(title),
                    done: !!entry.done,
                    sourceStatus: Number(entry?.sourceStatus) || 0,
                    priority: '',
                    startDate: '',
                    completionTime: '',
                    remark: '',
                    tags: [],
                    children: [],
                }))
                .filter((item) => item.title);
            return {
                internalId: key,
                title: entry.title,
                done: !!entry.done,
                sourceStatus: Number(entry?.sourceStatus) || 0,
                priority: String(entry.priority || '').trim(),
                startDate: String(entry.startDate || '').trim(),
                completionTime: String(entry.completionTime || '').trim(),
                remark: String(entry.remark || '').trim(),
                tags: Array.isArray(entry.tags) ? entry.tags.slice() : [],
                children: inlineChildren.concat(explicitChildren),
                headingName: String(entry.headingName || '').trim(),
                docName: String(entry.docName || '').trim() || __tmT("settings.untitledList"),
                folderName: String(entry.folderName || '').trim(),
            };
        };
        const docs = [];
        const docMap = new Map();
        roots
            .sort((a, b) => Number(a?.order) - Number(b?.order))
            .forEach((entry) => {
                const task = buildImportTask(entry);
                if (!task || !task.title) return;
                const docName = task.docName || __tmT("settings.untitledList");
                let doc = docMap.get(docName);
                if (!doc) {
                    doc = {
                        name: docName,
                        folderName: task.folderName,
                        rootTasks: [],
                        headings: [],
                    };
                    docMap.set(docName, doc);
                    docs.push(doc);
                }
                const headingName = String(task.headingName || '').trim();
                if (!headingName) {
                    doc.rootTasks.push(task);
                    return;
                }
                let section = doc.headings.find((item) => String(item?.name || '').trim() === headingName);
                if (!section) {
                    section = { name: headingName, tasks: [] };
                    doc.headings.push(section);
                }
                section.tasks.push(task);
            });
        const countTasks = (task, depth = 0) => {
            const children = Array.isArray(task?.children) ? task.children : [];
            return children.reduce((acc, child) => {
                const childCount = countTasks(child, depth + 1);
                acc.tasks += childCount.tasks;
                acc.subtasks += childCount.subtasks;
                return acc;
            }, {
                tasks: 1,
                subtasks: depth > 0 ? 1 : 0,
            });
        };
        const totals = docs.reduce((acc, doc) => {
            doc.rootTasks.forEach((task) => {
                const counts = countTasks(task, 0);
                acc.tasks += counts.tasks;
                acc.subtasks += counts.subtasks;
            });
            doc.headings.forEach((section) => {
                acc.headings += 1;
                section.tasks.forEach((task) => {
                    const counts = countTasks(task, 0);
                    acc.tasks += counts.tasks;
                    acc.subtasks += counts.subtasks;
                });
            });
            return acc;
        }, { docs: docs.length, headings: 0, tasks: 0, subtasks: 0 });
        return {
            headerRowIndex,
            docs,
            summary: {
                ...totals,
                sourceRows: rows.length - (headerRowIndex + 1),
                pendingTasks,
                completedTasks,
                archivedTasks,
                skippedCompleted,
                skippedArchived,
                skippedOtherStatus,
                skippedBlankTitle,
                orphanSubtasks,
                tagCount: tagNames.length,
            },
            tagNames,
            options: importOptions,
        };
    }

    function __tmRenderTickTickImportSummary(model, options = {}) {
        const data = (model && typeof model === 'object') ? model : null;
        if (!data?.summary) return __tmT("settings.noCsvFileSelectedYet");
        const opts = (options && typeof options === 'object') ? options : {};
        const summary = data.summary;
        const extra = [];
        extra.push(__tmT("settings.detectedDocumentsHeadingsTasks", { value1: Number(summary.docs) || 0, value2: Number(summary.headings) || 0, value3: Number(summary.tasks) || 0 }));
        extra.push(__tmT("settings.toDoCompletedArchived", { value1: Number(summary.pendingTasks) || 0, value2: Number(summary.completedTasks) || 0, value3: Number(summary.archivedTasks) || 0 }));
        if (Number(summary.subtasks) > 0) extra.push(__tmT("settings.includingSubtasks", { subtasks: Number(summary.subtasks) }));
        extra.push(__tmT("settings.skippedCompletedArchived", { value1: Number(summary.skippedCompleted) || 0, value2: Number(summary.skippedArchived) || 0 }));
        if (Number(summary.skippedOtherStatus) > 0) extra.push(__tmT("settings.otherStatuses", { value1: Number(summary.skippedOtherStatus) || 0 }));
        if (Number(summary.skippedBlankTitle) > 0) extra.push(__tmT("settings.blankTitles", { skippedBlankTitle: Number(summary.skippedBlankTitle) }));
        if (Number(summary.orphanSubtasks) > 0) extra.push(__tmT("settings.subtasksWithoutAParentImportedAsRootTasks", { orphanSubtasks: Number(summary.orphanSubtasks) }));
        if (Number(summary.tagCount) > 0) extra.push(__tmT("settings.tagsATagsMultiSelectColumnWillBeCreated", { value1: Number(summary.tagCount) || 0 }));
        if (opts.fileName) extra.unshift(__tmT("settings.file", { value1: String(opts.fileName || '').trim() }));
        return extra.join('；');
    }

    async function __tmCreateTickTickTagsCustomField(tagNames) {
        const names = (Array.isArray(tagNames) ? tagNames : [])
            .map((item) => String(item || '').trim())
            .filter(Boolean);
        if (!names.length) return null;
        await __tmEnsureSettingsLoaded();
        const currentDefs = __tmGetCustomFieldDefs();
        const existingIds = new Set(currentDefs.map((field) => String(field?.id || '').trim()).filter(Boolean));
        const existingAttrKeys = new Set(currentDefs.map((field) => {
            const fieldId = String(field?.id || '').trim() || 'field';
            return __tmNormalizeCustomFieldAttrName(field?.attrKey || fieldId || field?.name || 'field', fieldId);
        }).filter(Boolean));
        const uniqueToken = (baseValue, seen) => {
            const base = String(baseValue || '').trim() || 'ticktick-tags';
            let next = base;
            let dedupe = 2;
            while (seen.has(next)) {
                next = `${base}-${dedupe}`;
                dedupe += 1;
            }
            seen.add(next);
            return next;
        };
        const fieldId = uniqueToken(__tmNormalizeCustomFieldId('ticktick-tags', 'ticktick-tags'), existingIds);
        const attrKey = uniqueToken(__tmNormalizeCustomFieldAttrName(fieldId, fieldId), existingAttrKeys);
        const optionSeen = new Set();
        const optionByName = new Map();
        const options = names.map((name, index) => {
            const baseOptionId = __tmNormalizeCustomFieldId(name, `tag-${index + 1}`);
            const optionId = uniqueToken(baseOptionId, optionSeen);
            optionByName.set(name, optionId);
            return {
                id: optionId,
                name,
                color: __tmGetCustomFieldPresetColor(index),
            };
        });
        const field = {
            id: fieldId,
            name: '标签',
            attrKey,
            type: 'multi',
            options,
            enabled: true,
        };
        SettingsStore.data.customFieldDefs = currentDefs.concat([field]);
        SettingsStore.normalizeColumns();
        await SettingsStore.save();
        return { field, fieldId, optionByName };
    }

    function __tmTickTickSanitizeDocName(name) {
        const trimmed = String(name || '').trim().replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
        return trimmed || __tmT("settings.untitledList");
    }

    function __tmExtractCreatedDocId(data) {
        if (typeof data === 'string') return String(data || '').trim();
        if (data && typeof data === 'object') {
            const candidates = [data.id, data.ID, data.docId, data.docID, data.docid];
            for (const item of candidates) {
                const id = String(item || '').trim();
                if (id) return id;
            }
        }
        return '';
    }

    async function __tmCreateTickTickImportDoc(notebookId, docName) {
        const box = String(notebookId || '').trim();
        if (!box) throw new Error(__tmT("settings.noTargetNotebookSelected"));
        const baseName = __tmTickTickSanitizeDocName(docName);
        let lastErr = null;
        for (let i = 0; i < 50; i += 1) {
            const nextName = i === 0 ? baseName : __tmT("settings.import", { baseName: baseName, value2: i + 1 });
            const path = `/${nextName}.sy`;
            try {
                const created = await API.createDocWithMd(box, path, '');
                let docId = __tmExtractCreatedDocId(created);
                if (!docId) {
                    const docs = await API.getAllDocuments().catch(() => []);
                    const hit = (Array.isArray(docs) ? docs : [])
                        .filter((item) => String(item?.notebook || '').trim() === box && String(item?.name || '').trim() === nextName)
                        .sort((a, b) => String(b?.created || '').localeCompare(String(a?.created || '')))[0];
                    docId = String(hit?.id || '').trim();
                }
                if (!docId) throw new Error(__tmT("settings.theDocumentWasCreatedButNoDocumentIdWas"));
                await __tmWaitForTickTickImportDocReady(docId);
                return { id: docId, name: nextName };
            } catch (e) {
                lastErr = e;
                const msg = String(e?.message || e || '').toLowerCase();
                if (i < 49 && (msg.includes('exist') || msg.includes('exists') || msg.includes('已存在') || msg.includes('duplicate'))) {
                    continue;
                }
                if (i < 2) continue;
                throw e;
            }
        }
        throw lastErr || new Error(__tmT("settings.failedToCreateTheImportDocument"));
    }

    async function __tmFlushTickTickImportTransaction() {
        const adapter = globalThis.__tmTaskHorizonBackendAdapter;
        if (adapter && typeof adapter.flushTransaction === 'function') {
            return await adapter.flushTransaction();
        }
        return await API.call('/api/sqlite/flushTransaction', {});
    }

    async function __tmWaitForTickTickImportDocReady(docId, options = {}) {
        const did = String(docId || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        if (!did) throw new Error(__tmT("settings.invalidDocumentId"));
        const retryDelays = Array.isArray(opts.retryDelays) && opts.retryDelays.length
            ? opts.retryDelays
            : [80, 160, 260, 420, 680, 1000];
        let lastErr = null;
        for (let i = 0; i <= retryDelays.length; i += 1) {
            try {
                const rows = await API.getBlocksByIds([did]);
                const row = Array.isArray(rows) ? rows[0] : null;
                if (String(row?.id || '').trim() === did && String(row?.type || '').trim() === 'd') {
                    try { await API.getBlockKramdown(did); } catch (e) {}
                    return did;
                }
                lastErr = new Error(__tmT("settings.theDocumentIsNotReadyYet"));
            } catch (e) {
                lastErr = e;
            }
            if (i < retryDelays.length) {
                try { await __tmFlushTickTickImportTransaction(); } catch (e2) {}
                await new Promise((resolve) => setTimeout(resolve, retryDelays[i]));
            }
        }
        throw lastErr || new Error(__tmT("settings.theDocumentIsNotReadyYet"));
    }

    async function __tmEnsureTickTickImportTaskId(taskId, options = {}) {
        let currentId = String(taskId || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        if (!currentId) throw new Error(__tmT("settings.invalidTaskId"));
        const retryDelays = Array.isArray(opts.retryDelays) && opts.retryDelays.length
            ? opts.retryDelays
            : [80, 160, 280, 420, 640, 900];
        let lastErr = null;
        for (let i = 0; i <= retryDelays.length; i += 1) {
            try {
                const rows = await API.getBlocksByIds([currentId]);
                const row = Array.isArray(rows) ? rows[0] : null;
                const isTask = String(row?.id || '').trim() === currentId
                    && String(row?.type || '').trim() === 'i'
                    && String(row?.subtype || '').trim() === 't';
                if (isTask) return currentId;
                const resolvedId = String(await __tmResolveInsertedTaskBlockId(currentId) || '').trim();
                if (resolvedId) {
                    if (resolvedId !== currentId) {
                        try { __tmCommitOptimisticTaskId(currentId, resolvedId); } catch (e) {}
                        currentId = resolvedId;
                        continue;
                    }
                    const resolvedRows = await API.getBlocksByIds([resolvedId]);
                    const resolvedRow = Array.isArray(resolvedRows) ? resolvedRows[0] : null;
                    const resolvedIsTask = String(resolvedRow?.id || '').trim() === resolvedId
                        && String(resolvedRow?.type || '').trim() === 'i'
                        && String(resolvedRow?.subtype || '').trim() === 't';
                    if (resolvedIsTask) return resolvedId;
                }
                lastErr = new Error(__tmT("settings.theNewTaskBlockIsNotReadyYet"));
            } catch (e) {
                lastErr = e;
            }
            if (i < retryDelays.length) {
                try { await __tmFlushTickTickImportTransaction(); } catch (e2) {}
                await new Promise((resolve) => setTimeout(resolve, retryDelays[i]));
            }
        }
        try { console.warn('[TickTick 导入] 任务块就绪校验超时，继续使用当前 ID:', currentId, lastErr); } catch (e) {}
        return currentId;
    }

    async function __tmEnsureTickTickImportHeadingId(headingId, options = {}) {
        let currentId = String(headingId || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        if (!currentId) return '';
        const retryDelays = Array.isArray(opts.retryDelays) && opts.retryDelays.length
            ? opts.retryDelays
            : [80, 160, 280, 420, 640, 900];
        let lastErr = null;
        for (let i = 0; i <= retryDelays.length; i += 1) {
            try {
                const rows = await API.getBlocksByIds([currentId]);
                const row = Array.isArray(rows) ? rows[0] : null;
                const isHeading = String(row?.id || '').trim() === currentId
                    && String(row?.type || '').trim() === 'h';
                if (isHeading) return currentId;
                lastErr = new Error(__tmT("settings.theHeadingBlockIsNotReadyYet"));
            } catch (e) {
                lastErr = e;
            }
            if (i < retryDelays.length) {
                try { await __tmFlushTickTickImportTransaction(); } catch (e2) {}
                await new Promise((resolve) => setTimeout(resolve, retryDelays[i]));
            }
        }
        try { console.warn('[TickTick 导入] 标题块就绪校验超时，继续使用当前 ID:', currentId, lastErr); } catch (e) {}
        return currentId;
    }

    async function __tmRunTickTickImportDocPool(items, worker, options = {}) {
        const list = Array.isArray(items) ? items : [];
        const runner = typeof worker === 'function' ? worker : null;
        const opts = (options && typeof options === 'object') ? options : {};
        const shouldCancel = typeof opts.shouldCancel === 'function' ? opts.shouldCancel : null;
        if (!runner || !list.length) return;
        const concurrency = Math.max(1, Math.min(list.length, Number(opts.concurrency) || 1));
        let cursor = 0;
        const workers = Array.from({ length: concurrency }, async () => {
            while (true) {
                __tmThrowIfTickTickImportCancelled({ shouldCancel });
                if (cursor >= list.length) return;
                const index = cursor;
                cursor += 1;
                await runner(list[index], index);
            }
        });
        await Promise.all(workers);
    }

    async function __tmAppendTickTickImportHeading(docId, headingName) {
        const did = String(docId || '').trim();
        const text = String(headingName || '').trim();
        if (!did || !text) return '';
        const headingLevel = __tmNormalizeHeadingLevel(SettingsStore.data.taskHeadingLevel || 'h2');
        const levelNum = Number((String(headingLevel).match(/^h([1-6])$/) || [])[1]) || 2;
        const hashes = '#'.repeat(Math.max(1, Math.min(6, levelNum)));
        const insertedId = await __tmAppendBlockOnce(did, `${hashes} ${text}`);
        const headingId = await __tmEnsureTickTickImportHeadingId(insertedId);
        try { await __tmWarmKanbanDocHeadings([did], { force: true }); } catch (e) {}
        return headingId;
    }

    async function __tmCreateTickTickImportTaskBlock(parentId, title, options = {}) {
        const targetParentId = String(parentId || '').trim();
        const text = __tmTickTickNormalizeTaskTitle(title || '');
        const opts = (options && typeof options === 'object') ? options : {};
        if (!targetParentId) throw new Error(__tmT("settings.importTargetNotFound"));
        if (!text) throw new Error(__tmT("settings.taskContentIsEmpty"));
        const md = `- [${opts.done === true ? 'x' : ' '}] ${text}`;
        let insertedId = '';
        const previousID = String(opts.previousID || '').trim();
        const nextID = String(opts.nextID || opts.insertBeforeId || '').trim();
        if (previousID || nextID) {
            const placement = {};
            if (previousID) placement.previousID = previousID;
            if (nextID) placement.nextID = nextID;
            insertedId = await __tmInsertBlockOnce(targetParentId, md, placement);
        } else if (opts.appendToBottom === true) {
            insertedId = await __tmAppendBlockOnce(targetParentId, md);
        } else {
            insertedId = await __tmAppendBlockOnce(targetParentId, md);
        }
        const resolvedId = await __tmResolveInsertedTaskBlockId(insertedId);
        return await __tmEnsureTickTickImportTaskId(resolvedId || insertedId);
    }

    function __tmThrowIfTickTickImportCancelled(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const shouldCancel = typeof opts.shouldCancel === 'function' ? opts.shouldCancel : null;
        if (!shouldCancel) return;
        let cancelled = false;
        try { cancelled = !!shouldCancel(); } catch (e) { cancelled = false; }
        if (cancelled) {
            const err = new Error(__tmT("settings.importCancelled"));
            err.__tmCancelled = true;
            throw err;
        }
    }

    async function __tmImportTickTickTaskNode(task, parentId, summary, depth = 0, options = {}) {
        const targetParentId = String(parentId || '').trim();
        const opts = (options && typeof options === 'object') ? options : {};
        const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
        const title = __tmTickTickNormalizeTaskTitle(task?.title || '');
        __tmThrowIfTickTickImportCancelled(opts);
        if (!targetParentId) throw new Error(__tmT("settings.importTargetNotFound"));
        if (!title) return '';
        if (onProgress) {
            try {
                onProgress({
                    current: depth > 0 ? __tmT("settings.importingSubtask", { title: title }) : __tmT("settings.importingTask", { title: title }),
                    currentTaskTitle: title,
                    currentDepth: depth,
                });
            } catch (e) {}
        }
        let taskId = await __tmCreateTickTickImportTaskBlock(
            targetParentId,
            title,
            depth <= 0
                ? {
                    done: task?.done === true,
                    previousID: String(opts.previousID || '').trim(),
                    nextID: String(opts.nextID || opts.insertBeforeId || '').trim(),
                    appendToBottom: opts.appendToBottom !== false,
                }
                : {
                    done: task?.done === true,
                    appendToBottom: true,
                }
        );
        const patch = {};
        if (task?.priority) patch.priority = String(task.priority).trim();
        if (task?.startDate) patch.startDate = String(task.startDate).trim();
        if (task?.completionTime) patch.completionTime = String(task.completionTime).trim();
        if (task?.remark) patch.remark = String(task.remark).trim();
        const tagsField = opts.tagsField && typeof opts.tagsField === 'object' ? opts.tagsField : null;
        const tagsFieldId = String(tagsField?.fieldId || '').trim();
        const tagOptionByName = tagsField?.optionByName instanceof Map ? tagsField.optionByName : null;
        const tagOptionIds = tagsFieldId && tagOptionByName
            ? (Array.isArray(task?.tags) ? task.tags : [])
                .map((name) => tagOptionByName.get(String(name || '').trim()) || '')
                .map((id) => String(id || '').trim())
                .filter(Boolean)
            : [];
        if (tagsFieldId && tagOptionIds.length) {
            patch.customFieldValues = { [tagsFieldId]: Array.from(new Set(tagOptionIds)) };
        }
        if (task?.done === true) {
            const doneStatusPatch = __tmBuildCheckboxStatusPatch(task, true);
            if (doneStatusPatch && typeof doneStatusPatch === 'object') Object.assign(patch, doneStatusPatch);
        }
        if (Object.keys(patch).length > 0) {
            taskId = await __tmPersistNewTaskAttrsOnce(taskId, patch, null, { skipFlush: true });
        }
        if (summary && typeof summary === 'object') {
            summary.tasks += 1;
            if (depth > 0) summary.subtasks += 1;
        }
        if (onProgress) {
            try {
                onProgress({
                    completedTasks: Number(summary?.tasks) || 0,
                    current: depth > 0 ? __tmT("settings.importedSubtask", { title: title }) : __tmT("settings.importedTask", { title: title }),
                    currentTaskTitle: title,
                    currentDepth: depth,
                });
            } catch (e) {}
        }
        const children = Array.isArray(task?.children) ? task.children : [];
        for (const child of children) {
            __tmThrowIfTickTickImportCancelled(opts);
            await __tmImportTickTickTaskNode(child, taskId, summary, depth + 1, opts);
        }
        return taskId;
    }

    async function __tmAttachNotebookToCurrentGroupForImport(notebookId) {
        const nextNotebookId = String(notebookId || '').trim();
        if (!nextNotebookId) return { attached: false, reason: 'no-notebook', groupId: '' };
        const clearImportGroupCaches = () => {
            try { __tmDocExpandCache.clear(); } catch (e) {}
            try { __tmResolvedDocIdsCache = null; } catch (e) {}
            try { __tmResolvedDocIdsPromise = null; } catch (e) {}
            try { window.__tmInvalidateDocScopeCache?.(); } catch (e) {}
            try { window.__tmCalendarDocsToGroupCache = null; } catch (e) {}
        };
        const refreshImportGroupSelects = (groupId) => {
            try { window.tmRefreshDocGroupTopbarSelects?.(groupId); } catch (e) {}
        };
        const groups = Array.isArray(SettingsStore.data.docGroups) ? SettingsStore.data.docGroups.slice() : [];
        const currentGroupId = String(SettingsStore.data.currentGroupId || 'all').trim() || 'all';
        const existingIdx = groups.findIndex((group) => String(group?.notebookId || '').trim() === nextNotebookId);
        if (existingIdx >= 0) {
            const groupId = String(groups[existingIdx]?.id || '').trim();
            if (groupId) {
                if (groupId !== currentGroupId) await SettingsStore.updateCurrentGroupId(groupId);
                clearImportGroupCaches();
                refreshImportGroupSelects(groupId);
                return {
                    attached: true,
                    changed: groupId !== currentGroupId,
                    created: false,
                    reason: groupId === currentGroupId ? 'same-notebook' : 'existing-notebook-group',
                    groupId,
                };
            }
        }
        const usedIds = new Set(groups.map((group) => String(group?.id || '').trim()).filter(Boolean));
        const baseId = `g_${Date.now()}_import`;
        let groupId = baseId;
        let dedupe = 2;
        while (usedIds.has(groupId)) {
            groupId = `${baseId}_${dedupe}`;
            dedupe += 1;
        }
        const notebookName = __tmGetNotebookDisplayName(nextNotebookId, nextNotebookId);
        const nextGroup = {
            id: groupId,
            name: notebookName,
            notebookId: nextNotebookId,
            docs: [],
            calendarSearchOptimization: { enabled: false, days: 90 }
        };
        await SettingsStore.updateDocGroups(groups.concat([nextGroup]));
        await SettingsStore.updateCurrentGroupId(groupId);
        clearImportGroupCaches();
        refreshImportGroupSelects(groupId);
        return { attached: true, changed: true, created: true, reason: 'created-notebook-group', groupId };
    }

    async function __tmImportTickTickModel(model, notebookId, options = {}) {
        const docs = Array.isArray(model?.docs) ? model.docs : [];
        const opts = (options && typeof options === 'object') ? options : {};
        const importOptions = __tmNormalizeTickTickImportOptions({
            ...model?.options,
            ...opts,
        });
        const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
        const shouldCancel = typeof opts.shouldCancel === 'function' ? opts.shouldCancel : null;
        if (!docs.length) throw new Error(__tmT("settings.noTasksToImport"));
        await __tmEnsureSettingsLoaded();
        await MetaStore.load();
        __tmThrowIfTickTickImportCancelled({ shouldCancel });
        let tagsField = null;
        if (Array.isArray(model?.tagNames) && model.tagNames.length > 0) {
            if (onProgress) {
                try { onProgress({ current: __tmT("settings.creatingTheTagsMultiSelectColumn") }); } catch (e) {}
            }
            tagsField = await __tmCreateTickTickTagsCustomField(model.tagNames);
        }
        const createdDocIds = [];
        const summary = { docs: 0, headings: 0, tasks: 0, subtasks: 0 };
        let progressState = {
            totalDocs: Math.max(0, docs.length),
            totalHeadings: Math.max(0, Number(model?.summary?.headings) || 0),
            totalTasks: Math.max(0, Number(model?.summary?.tasks) || 0),
            completedDocs: 0,
            completedHeadings: 0,
            completedTasks: 0,
            completedUnits: 0,
            totalUnits: 0,
            percent: 0,
            current: __tmT("settings.preparingToImportDocuments", { value1: Math.max(0, docs.length) }),
            currentDocName: '',
            currentHeadingName: '',
            currentTaskTitle: '',
            currentDepth: 0,
        };
        progressState.totalUnits = Math.max(1, progressState.totalDocs + progressState.totalHeadings + progressState.totalTasks);
        const emitProgress = (patch = {}) => {
            progressState = {
                ...progressState,
                ...(patch && typeof patch === 'object' ? patch : {}),
            };
            progressState.completedDocs = Math.max(0, Math.min(progressState.totalDocs, Number(progressState.completedDocs) || 0));
            progressState.completedHeadings = Math.max(0, Math.min(progressState.totalHeadings, Number(progressState.completedHeadings) || 0));
            progressState.completedTasks = Math.max(0, Math.min(progressState.totalTasks, Number(progressState.completedTasks) || 0));
            progressState.completedUnits = Math.max(
                0,
                Math.min(
                    progressState.totalUnits,
                    progressState.completedDocs + progressState.completedHeadings + progressState.completedTasks
                )
            );
            progressState.percent = progressState.totalUnits > 0
                ? Math.max(0, Math.min(100, Math.round((progressState.completedUnits / progressState.totalUnits) * 100)))
                : 100;
            if (onProgress) {
                try { onProgress({ ...progressState }); } catch (e) {}
            }
        };
        emitProgress();
        const processDoc = async (doc) => {
            __tmThrowIfTickTickImportCancelled({ shouldCancel });
            const currentDocName = String(doc?.name || '').trim() || __tmT("settings.untitledList");
            emitProgress({
                current: __tmT("settings.creatingDocument", { currentDocName: currentDocName }),
                currentDocName,
                currentHeadingName: '',
                currentTaskTitle: '',
                currentDepth: 0,
            });
            const createdDoc = await __tmCreateTickTickImportDoc(notebookId, doc?.name);
            const docId = String(createdDoc?.id || '').trim();
            if (!docId) throw new Error(__tmT("settings.failedToCreateDocument", { value1: String(doc?.name || '') }));
            createdDocIds.push(docId);
            summary.docs += 1;
            emitProgress({
                completedDocs: Number(summary.docs) || 0,
                current: __tmT("settings.createdDocument", { currentDocName: currentDocName }),
                currentDocName,
            });
            const rootTasks = Array.isArray(doc?.rootTasks) ? doc.rootTasks : [];
            for (const task of rootTasks) {
                __tmThrowIfTickTickImportCancelled({ shouldCancel });
                await __tmImportTickTickTaskNode(task, docId, summary, 0, {
                    onProgress: emitProgress,
                    currentDocName,
                    tagsField,
                    shouldCancel,
                });
            }
            const headings = Array.isArray(doc?.headings) ? doc.headings : [];
            for (const section of headings) {
                __tmThrowIfTickTickImportCancelled({ shouldCancel });
                const headingName = String(section?.name || '').trim();
                if (!headingName) continue;
                emitProgress({
                    current: __tmT("settings.creatingHeading", { headingName: headingName }),
                    currentDocName,
                    currentHeadingName: headingName,
                    currentTaskTitle: '',
                    currentDepth: 0,
                });
                const headingId = await __tmAppendTickTickImportHeading(docId, headingName);
                summary.headings += 1;
                emitProgress({
                    completedHeadings: Number(summary.headings) || 0,
                    current: __tmT("settings.createdHeading", { headingName: headingName }),
                    currentDocName,
                    currentHeadingName: headingName,
                });
                const sectionTasks = Array.isArray(section?.tasks) ? section.tasks : [];
                let previousID = headingId;
                for (const task of sectionTasks) {
                    __tmThrowIfTickTickImportCancelled({ shouldCancel });
                    previousID = await __tmImportTickTickTaskNode(task, docId, summary, 0, {
                        docId,
                        headingId,
                        previousID,
                        appendToBottom: false,
                        onProgress: emitProgress,
                        currentDocName,
                        currentHeadingName: headingName,
                        tagsField,
                        shouldCancel,
                    });
                }
            }
            try { __tmInvalidateTasksQueryCacheByDocId(docId); } catch (e) {}
        };
        await __tmRunTickTickImportDocPool(docs, processDoc, {
            concurrency: importOptions.docConcurrency,
            shouldCancel,
        });
        try { await __tmFlushTickTickImportTransaction(); } catch (e) {}
        try { await MetaStore.saveNow(); } catch (e) {}
        try {
            state.allDocuments = await API.getAllDocuments();
        } catch (e) {}
        const groupAttach = await __tmAttachNotebookToCurrentGroupForImport(notebookId);
        state.selectedDocIds = SettingsStore.data.selectedDocIds;
        await SettingsStore.save();
        try {
            await __tmLoadSelectedDocumentsPreserveChecklistScroll({
                source: 'ticktick-import',
                showInlineLoading: false,
            });
        } catch (e) {
            try {
                __tmScheduleViewRefresh({
                    mode: 'current',
                    withFilters: true,
                    reason: 'ticktick-import-fallback',
                });
            } catch (e2) {}
        }
        emitProgress({
            completedDocs: Number(summary.docs) || 0,
            completedHeadings: Number(summary.headings) || 0,
            completedTasks: Number(summary.tasks) || 0,
            current: __tmT("settings.importComplete"),
            percent: 100,
        });
        return { createdDocIds, summary, groupAttach };
    }

    window.tmOpenTickTickImportDialog = async function() {
        await SettingsStore.load();
        await __tmRefreshNotebookCache();
        if (!Array.isArray(state.notebooks) || state.notebooks.length === 0) {
            hint(__tmT("settings.noUsableNotebookFound"), 'error');
            return;
        }
        const existing = document.getElementById('tm-ticktick-import-modal');
        try { existing?.remove(); } catch (e) {}

        const modal = document.createElement('div');
        modal.id = 'tm-ticktick-import-modal';
        modal.className = 'tm-prompt-modal';

        const box = document.createElement('div');
        box.className = 'tm-prompt-box';
        box.style.width = 'min(92vw, 680px)';

        const title = document.createElement('div');
        title.className = 'tm-prompt-title';
        title.textContent = __tmT("settings.importTicktickCsv2");
        box.appendChild(title);

        const desc = document.createElement('div');
        desc.style.cssText = 'padding: 2px 0 10px; color: var(--tm-secondary-text); font-size: 13px; line-height: 1.7;';
        desc.textContent = __tmT("settings.listNameCreatesDocumentsColumnNameCreatesHeadingsTitle");
        box.appendChild(desc);

        const notebookRow = document.createElement('label');
        notebookRow.style.cssText = 'display:flex; flex-direction:column; gap:6px; padding: 2px 0 10px;';
        notebookRow.innerHTML = `<span style="font-size:13px;color:var(--tm-text-color);font-weight:600;">${__tmT("settings.targetNotebook")}</span>`;
        const notebookSelect = document.createElement('select');
        notebookSelect.className = 'tm-prompt-input tm-prompt-select';
        notebookSelect.style.width = '100%';
        notebookSelect.innerHTML = (Array.isArray(state.notebooks) ? state.notebooks : []).map((item, idx) => {
            const notebookId = String(item?.id || item?.box || '').trim();
            const notebookName = __tmGetNotebookDisplayName(notebookId, item?.name || item?.title || __tmT("settings.notebook2", { value1: idx + 1 }));
            return `<option value="${esc(notebookId)}">${esc(notebookName)}</option>`;
        }).join('');
        notebookRow.appendChild(notebookSelect);
        box.appendChild(notebookRow);

        const optionRow = document.createElement('div');
        optionRow.style.cssText = 'display:flex; flex-wrap:wrap; gap:12px; padding: 0 0 10px;';
        optionRow.innerHTML = `
            <label style="display:inline-flex; align-items:center; gap:6px; font-size:13px; color:var(--tm-text-color); cursor:pointer;">
                <input type="checkbox" class="b3-switch fn__flex-center" data-tm-ticktick-import-option="completed">
                <span>${__tmT("settings.importCompletedTasks")}</span>
            </label>
            <label style="display:inline-flex; align-items:center; gap:6px; font-size:13px; color:var(--tm-text-color); cursor:pointer;">
                <input type="checkbox" class="b3-switch fn__flex-center" data-tm-ticktick-import-option="archived">
                <span>${__tmT("settings.importArchivedTasks")}</span>
            </label>
        `;
        box.appendChild(optionRow);
        const includeCompletedInput = optionRow.querySelector('[data-tm-ticktick-import-option="completed"]');
        const includeArchivedInput = optionRow.querySelector('[data-tm-ticktick-import-option="archived"]');

        const helper = document.createElement('div');
        helper.style.cssText = 'padding: 10px 12px; border: 1px solid var(--tm-border-color); border-radius: 10px; background: color-mix(in srgb, var(--tm-card-bg, var(--tm-bg-color)) 92%, var(--tm-primary-color) 8%); color: var(--tm-secondary-text); font-size: 12px; line-height: 1.7; white-space: pre-wrap;';
        helper.textContent = __tmT("settings.noCsvFileSelectedYet");
        box.appendChild(helper);

        const progressWrap = document.createElement('div');
        progressWrap.style.cssText = 'display:none; margin-top:10px; padding:10px 12px; border:1px solid var(--tm-border-color); border-radius:10px; background:var(--tm-card-bg, var(--tm-bg-color));';

        const progressHead = document.createElement('div');
        progressHead.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:12px; font-size:12px; line-height:1.5; color:var(--tm-text-color);';

        const progressTitle = document.createElement('div');
        progressTitle.style.cssText = 'font-weight:600;';
        progressTitle.textContent = __tmT("settings.importProgress");
        progressHead.appendChild(progressTitle);

        const progressPercent = document.createElement('div');
        progressPercent.style.cssText = 'font-variant-numeric: tabular-nums; color: var(--tm-secondary-text);';
        progressPercent.textContent = '0%';
        progressHead.appendChild(progressPercent);
        progressWrap.appendChild(progressHead);

        const progressTrack = document.createElement('div');
        progressTrack.style.cssText = 'height:8px; margin-top:10px; border-radius:999px; background:color-mix(in srgb, var(--tm-border-color) 78%, transparent); overflow:hidden;';

        const progressFill = document.createElement('div');
        progressFill.style.cssText = 'width:0%; height:100%; border-radius:999px; background:var(--tm-primary-color); transition:width .2s ease;';
        progressTrack.appendChild(progressFill);
        progressWrap.appendChild(progressTrack);

        const progressMeta = document.createElement('div');
        progressMeta.style.cssText = 'margin-top:10px; font-size:12px; line-height:1.6; color:var(--tm-secondary-text); white-space:pre-wrap;';
        progressMeta.textContent = __tmT("settings.waitingToStartTheImport");
        progressWrap.appendChild(progressMeta);
        box.appendChild(progressWrap);

        const actions = document.createElement('div');
        actions.className = 'tm-prompt-buttons';
        actions.style.marginTop = '14px';

        const pickBtn = document.createElement('button');
        pickBtn.className = 'tm-prompt-btn tm-prompt-btn-secondary';
        pickBtn.textContent = __tmT("settings.chooseCsv");

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'tm-prompt-btn tm-prompt-btn-secondary';
        cancelBtn.textContent = __tmT("common.cancel");

        const okBtn = document.createElement('button');
        okBtn.className = 'tm-prompt-btn tm-prompt-btn-primary';
        okBtn.textContent = __tmT("settings.startImport");
        okBtn.disabled = true;
        okBtn.style.opacity = '0.6';

        actions.appendChild(pickBtn);
        actions.appendChild(cancelBtn);
        actions.appendChild(okBtn);
        box.appendChild(actions);

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.csv,text/csv';
        fileInput.style.display = 'none';

        modal.appendChild(box);
        modal.appendChild(fileInput);
        document.body.appendChild(modal);
        __tmApplyPopupOpenAnimation(modal, box);

        const removeFromStack = __tmModalStackBind(() => cancelBtn.click());
        let importModel = null;
        let fileName = '';
        let fileText = '';
        let importInFlight = false;
        let cancelRequested = false;

        const getImportOptions = () => ({
            includeCompleted: includeCompletedInput?.checked === true,
            includeArchived: includeArchivedInput?.checked === true,
            docConcurrency: 3,
        });

        const refreshHelper = (text, isError = false) => {
            helper.textContent = text;
            helper.style.color = isError ? 'var(--tm-danger-color)' : 'var(--tm-secondary-text)';
            try { helper.style.borderColor = isError ? 'var(--tm-danger-color)' : 'var(--tm-border-color)'; } catch (e) {}
        };

        const setProgressVisible = (visible) => {
            progressWrap.style.display = visible ? 'block' : 'none';
        };

        const refreshProgress = (info = null) => {
            if (!info || typeof info !== 'object') {
                progressPercent.textContent = '0%';
                progressFill.style.width = '0%';
                progressMeta.textContent = __tmT("settings.waitingToStartTheImport");
                return;
            }
            const percent = Math.max(0, Math.min(100, Math.round(Number(info.percent) || 0)));
            const completedUnits = Math.max(0, Number(info.completedUnits) || 0);
            const totalUnits = Math.max(1, Number(info.totalUnits) || 1);
            const totalDocs = Math.max(0, Number(info.totalDocs) || 0);
            const totalHeadings = Math.max(0, Number(info.totalHeadings) || 0);
            const totalTasks = Math.max(0, Number(info.totalTasks) || 0);
            const completedDocs = Math.max(0, Number(info.completedDocs) || 0);
            const completedHeadings = Math.max(0, Number(info.completedHeadings) || 0);
            const completedTasks = Math.max(0, Number(info.completedTasks) || 0);
            progressPercent.textContent = `${percent}%`;
            progressFill.style.width = `${percent}%`;
            const metaLines = [
                __tmT("settings.overallProgress", { completedUnits: completedUnits, totalUnits: totalUnits }),
                __tmT("settings.documentsHeadingsTasks", { completedDocs: completedDocs, totalDocs: totalDocs, completedHeadings: completedHeadings, totalHeadings: totalHeadings, completedTasks: completedTasks, totalTasks: totalTasks }),
            ];
            const current = String(info.current || '').trim();
            if (current) metaLines.push(__tmT("settings.current", { current: current }));
            progressMeta.textContent = metaLines.join('\n');
        };

        const refreshSubmitState = () => {
            if (importInFlight) {
                okBtn.disabled = true;
                okBtn.style.opacity = '0.6';
                return;
            }
            const enabled = !!importModel && Array.isArray(importModel?.docs) && importModel.docs.length > 0;
            okBtn.disabled = !enabled;
            okBtn.style.opacity = enabled ? '1' : '0.6';
        };

        const rebuildImportModel = () => {
            if (!fileText) {
                importModel = null;
                refreshHelper(__tmT("settings.noCsvFileSelectedYet"));
                setProgressVisible(false);
                refreshProgress(null);
                refreshSubmitState();
                return;
            }
            try {
                importModel = __tmBuildTickTickImportModel(fileText, getImportOptions());
                refreshHelper(__tmRenderTickTickImportSummary(importModel, { fileName }));
                setProgressVisible(false);
                refreshProgress(null);
            } catch (e) {
                importModel = null;
                refreshHelper(String(e?.message || e || __tmT("settings.csvParsingFailed")), true);
                setProgressVisible(false);
                refreshProgress(null);
            }
            refreshSubmitState();
        };

        pickBtn.onclick = () => fileInput.click();
        cancelBtn.onclick = () => {
            if (importInFlight) {
                cancelRequested = true;
                cancelBtn.disabled = true;
                cancelBtn.textContent = __tmT("settings.stopping");
                refreshHelper(__tmT("settings.stoppingTheImportOfPleaseWait", { value1: fileName || 'CSV' }));
                return;
            }
            removeFromStack();
            try { modal.remove(); } catch (e) {}
        };

        okBtn.onclick = async () => {
            if (!importModel) return;
            const notebookId = String(notebookSelect.value || '').trim();
            if (!notebookId) {
                refreshHelper(__tmT("settings.chooseATargetNotebookFirst"), true);
                return;
            }
            importInFlight = true;
            cancelRequested = false;
            pickBtn.disabled = true;
            cancelBtn.disabled = false;
            cancelBtn.textContent = __tmT("settings.cancelImport");
            okBtn.disabled = true;
            okBtn.style.opacity = '0.6';
            refreshHelper(__tmT("settings.importingThisMayTakeAFewMinutes", { value1: fileName || 'CSV' }));
            setProgressVisible(true);
            refreshProgress({
                percent: 0,
                completedUnits: 0,
                totalUnits: Math.max(1, (Number(importModel?.summary?.docs) || 0) + (Number(importModel?.summary?.headings) || 0) + (Number(importModel?.summary?.tasks) || 0)),
                totalDocs: Math.max(0, Number(importModel?.summary?.docs) || 0),
                totalHeadings: Math.max(0, Number(importModel?.summary?.headings) || 0),
                totalTasks: Math.max(0, Number(importModel?.summary?.tasks) || 0),
                completedDocs: 0,
                completedHeadings: 0,
                completedTasks: 0,
                current: __tmT("settings.importing", { value1: fileName || 'CSV' }),
            });
            try {
                const result = await __tmImportTickTickModel(importModel, notebookId, {
                    ...getImportOptions(),
                    onProgress: (progress) => {
                        refreshProgress(progress);
                    },
                    shouldCancel: () => cancelRequested === true,
                });
                importInFlight = false;
                removeFromStack();
                try { modal.remove(); } catch (e) {}
                const attach = result?.groupAttach;
                const attachText = attach?.created
                    ? __tmT("settings.andANewNotebookGroupWasCreatedAndSwitched")
                    : (attach?.reason === 'existing-notebook-group'
                        ? __tmT("settings.andSwitchedToTheImportNotebookGroup")
                        : (attach?.attached ? __tmT("settings.andTheImportNotebookWasBoundToTheCurrent") : ''));
                hint(__tmT("settings.ticktickCsvImportCompleteNewDocumentsTasksImported", { value1: Number(result?.summary?.docs) || 0, value2: Number(result?.summary?.tasks) || 0, attachText: attachText }), 'success');
                if (state.settingsModal && document.body.contains(state.settingsModal)) {
                    try { showSettings(); } catch (e) {}
                }
            } catch (e) {
                importInFlight = false;
                pickBtn.disabled = false;
                cancelBtn.disabled = false;
                cancelBtn.textContent = __tmT("common.cancel");
                const cancelled = !!(e && (e.__tmCancelled === true || String(e?.message || '').trim() === '导入已取消'));
                if (cancelled) {
                    refreshHelper(__tmT("settings.importCancelled2"));
                    try { hint(__tmT("settings.ticktickCsvImportCancelled"), 'info'); } catch (e2) {}
                } else {
                    refreshHelper(String(e?.message || e || __tmT("settings.importFailed")), true);
                }
                setProgressVisible(true);
                refreshSubmitState();
            }
        };

        fileInput.onchange = () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;
            fileName = String(file.name || '').trim();
            const reader = new FileReader();
            reader.onload = () => {
                fileText = String(reader.result || '');
                rebuildImportModel();
            };
            reader.onerror = () => {
                fileText = '';
                importModel = null;
                refreshHelper(__tmT("settings.failedToReadTheFileTryAgain"), true);
                setProgressVisible(false);
                refreshProgress(null);
                refreshSubmitState();
            };
            reader.readAsText(file, 'utf-8');
        };

        [includeCompletedInput, includeArchivedInput].forEach((input) => {
            input?.addEventListener('change', () => {
                if (importInFlight) {
                    try { input.checked = !input.checked; } catch (e) {}
                    return;
                }
                rebuildImportModel();
            });
        });

        modal.onclick = (event) => {
            if (event.target === modal) {
                try { event.preventDefault?.(); } catch (e) {}
                try { event.stopPropagation?.(); } catch (e) {}
            }
        };
    };

    window.tmOpenThemeImportDialog = function() {
        if (__tmIsSiyuanThemeColorsEnabled()) {
            hint(__tmT("settings.colorsAreGeneratedFromTheCurrentThemeWhenFollowing"), 'info');
            return;
        }
        __tmRemoveElementsById('tm-theme-import-backdrop');
        const currentConfig = __tmNormalizeThemeConfig(SettingsStore.data?.themeConfig);
        const backdrop = document.createElement('div');
        backdrop.id = 'tm-theme-import-backdrop';
        backdrop.className = 'tm-theme-import-backdrop';

        const dialog = document.createElement('div');
        dialog.className = 'tm-theme-import-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');

        const content = document.createElement('div');
        content.className = 'tm-theme-import-content';

        const title = document.createElement('div');
        title.className = 'tm-theme-import-title';
        title.textContent = __tmT("settings.importTweakcnShadcnTheme");
        content.appendChild(title);

        const desc = document.createElement('div');
        desc.className = 'tm-theme-import-desc';
        desc.innerHTML = `${__tmT("settings.pasteTheRootDarkCssVariablesExportedByTweakcn")}<br>${__tmT("settings.afterEditingAThemeInTweakcnClickCodeIn")}<a href="${__TM_TWEAKCN_URL}" target="_blank" rel="noopener noreferrer" style="margin-left:6px;color:var(--tm-primary-color);text-decoration:none;">${__tmT("settings.openTweakcn")}</a>`;
        content.appendChild(desc);

        const nameRow = document.createElement('label');
        nameRow.className = 'tm-theme-import-name';
        nameRow.innerHTML = `<span class="tm-theme-import-name-label">${__tmT("settings.themeName")}</span>`;
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = String(currentConfig.importName || '').trim();
        nameInput.placeholder = __tmT("settings.eGTweakcnSlate");
        nameInput.className = 'tm-theme-import-name-input';
        nameRow.appendChild(nameInput);
        content.appendChild(nameRow);

        const textarea = document.createElement('textarea');
        textarea.className = 'tm-theme-import-textarea';
        textarea.value = '';
        textarea.placeholder = ':root { --background: 210 20% 98%; ... }\n.dark { --background: 222 47% 11%; ... }';
        content.appendChild(textarea);

        const helper = document.createElement('div');
        helper.className = 'tm-theme-import-helper';
        helper.textContent = hasImportedTokens(currentConfig) ? __tmT("settings.currentlyImported", { value1: currentConfig.importName || 'Custom theme' }) : __tmT("settings.youCanPasteTweakcnThemeCssDirectly");
        content.appendChild(helper);

        const actions = document.createElement('div');
        actions.className = 'tm-color-actions tm-theme-import-actions';

        const fileBtn = document.createElement('button');
        fileBtn.type = 'button';
        fileBtn.className = 'tm-btn tm-btn-gray';
        fileBtn.textContent = __tmT("settings.importFile");

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'tm-btn tm-btn-gray';
        cancelBtn.textContent = __tmT("common.cancel");

        const okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.className = 'tm-btn tm-btn-primary';
        okBtn.textContent = __tmT("settings.applyTheme");

        const close = () => {
            try { backdrop.remove(); } catch (e) {}
        };

        const applyTheme = async () => {
            const parsed = __tmParseThemeCssVariables(textarea.value);
            if (!parsed || !Object.keys(parsed.light || {}).length) {
                helper.textContent = __tmT("settings.noUsableThemeVariablesWereParsedMakeSureThe");
                helper.style.color = 'var(--tm-danger-color)';
                try { textarea.style.borderColor = 'var(--tm-danger-color)'; } catch (e) {}
                return;
            }
            const next = __tmNormalizeThemeConfig({
                source: 'imported',
                presetId: currentConfig.presetId,
                importName: String(nameInput.value || '').trim() || 'Imported Theme',
                importLight: parsed.light,
                importDark: parsed.dark,
            });
            SettingsStore.data.themeConfig = next;
            __tmApplyThemeConfigToAppearanceFields(next);
            await SettingsStore.save();
            try { __tmApplyAppearanceThemeVars(); } catch (e) {}
            close();
            showSettings();
            render();
        };

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.css,text/css,.txt';
        fileInput.style.display = 'none';
        fileInput.onchange = () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                textarea.value = String(reader.result || '');
                if (!nameInput.value.trim()) {
                    nameInput.value = String(file.name || '').replace(/\.[^.]+$/, '').trim();
                }
                helper.textContent = __tmT("settings.loadedFile", { name: file.name });
                helper.style.color = 'var(--tm-secondary-text)';
                try { textarea.style.borderColor = 'var(--tm-input-border)'; } catch (e) {}
            };
            reader.readAsText(file);
        };

        fileBtn.onclick = () => fileInput.click();
        cancelBtn.onclick = close;
        okBtn.onclick = () => {
            applyTheme().catch((e) => {
                helper.textContent = String(e?.message || e || __tmT("settings.importFailed"));
                helper.style.color = 'var(--tm-danger-color)';
            });
        };

        backdrop.onclick = (event) => {
            if (event.target === backdrop) close();
        };

        actions.appendChild(fileBtn);
        actions.appendChild(cancelBtn);
        actions.appendChild(okBtn);
        dialog.appendChild(content);
        dialog.appendChild(fileInput);
        dialog.appendChild(actions);
        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);

        function hasImportedTokens(config) {
            try {
                return Object.keys(config?.importLight || {}).length > 0;
            } catch (e) {
                return false;
            }
        }
    };
